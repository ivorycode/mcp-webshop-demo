import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MockLanguageModelV4 } from 'ai/test'
import { runScenario } from './support/mcp-llm-client.mjs'

const loginId = 'kantine-campus'
let callId = 0
const call = (toolName, input) => ({
  type: 'tool-call',
  toolCallId: `call-${++callId}`,
  toolName,
  input: JSON.stringify(input),
})
const say = (text) => ({ type: 'text', text })

function scriptedModel(script) {
  let index = 0
  return new MockLanguageModelV4({
    doGenerate: async (options) => {
      assert.ok(index < script.length, 'Unexpected extra model call')
      const entry = script[index++]
      const content = typeof entry === 'function' ? entry(options) : entry
      return {
        content,
        finishReason: {
          unified: content.some((part) => part.type === 'tool-call')
            ? 'tool-calls'
            : 'stop',
          raw: undefined,
        },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 5, text: 5, reasoning: 0 },
        },
        warnings: [],
      }
    },
  })
}

// The MCP starter enables these checks only after its callbacks are filled in.
const options = { skip: false }

test(
  'LLM client discovers MCP tools, forwards results and preserves follow-up context',
  options,
  async (t) => {
    const model = scriptedModel([
      (request) => {
        assert.equal(request.tools.length, 6)
        assert.match(
          request.tools.find((tool) => tool.name === 'addToCart').inputSchema
            .properties.loginId.description,
          /kantine-campus/,
        )
        return [call('searchProducts', { term: 'Milch' })]
      },
      (request) => {
        assert.match(JSON.stringify(request.prompt), /Quality Vollmilch/)
        return [
          call('addToCart', { loginId, articleNumber: '022600', quantity: 2 }),
        ]
      },
      [say('Zwei Einheiten sind im Warenkorb.')],
      (request) => {
        assert.match(JSON.stringify(request.prompt), /Zwei Einheiten/)
        return [call('removeFromCart', { loginId, articleNumber: '022600' })]
      },
      [say('Die Milch ist entfernt.')],
    ])
    const report = {}
    await runScenario(t, { name: 'cart', model, report })
    assert.equal(report.turns.length, 2)
    assert.equal(report.turns[0].usage.totalTokens, 45)
    assert.equal(report.state[loginId].totalItems, 0)
  },
)

test(
  'checkout evaluation verifies the order ID in the model answer',
  options,
  async (t) => {
    const model = scriptedModel([
      [call('checkout', { loginId })],
      [call('getOrders', { loginId })],
      (request) => {
        const orderResult = request.prompt
          .filter((message) => message.role === 'tool')
          .flatMap((message) => message.content)
          .find((part) => part.toolName === 'checkout')
        return [
          say(
            `Bestellung ${orderResult.output.value.structuredContent.orderId} übermittelt.`,
          ),
        ]
      },
    ])
    await runScenario(t, { name: 'checkout', model, report: {} })
  },
)

for (const name of ['missing-account', 'unknown-account']) {
  test(
    `${name} evaluation accepts a clarification without changing accounts`,
    options,
    async (t) => {
      const model = scriptedModel([
        [say('Welches gültige Demo-Konto möchten Sie verwenden?')],
      ])
      await runScenario(t, { name, model, report: {} })
    },
  )
}

test(
  'evaluation rejects a model claiming success without executing tools',
  options,
  async (t) => {
    const model = scriptedModel([[say('Die Milch wurde hinzugefügt.')]])
    await assert.rejects(
      runScenario(t, { name: 'cart', model, report: {} }),
      /searchProducts/,
    )
  },
)

test(
  'evaluation catches checkout even if the model later hides it by restoring the cart',
  options,
  async (t) => {
    const model = scriptedModel([
      [call('searchProducts', { term: 'Milch' })],
      [call('addToCart', { loginId, articleNumber: '022600', quantity: 2 })],
      [call('checkout', { loginId })],
      [call('addToCart', { loginId, articleNumber: '022600', quantity: 2 })],
      [say('Zwei Einheiten im Warenkorb.')],
    ])
    await assert.rejects(
      runScenario(t, { name: 'cart', model, report: {} }),
      /checkout/,
    )
  },
)

test(
  'evaluation stops a model that keeps calling tools at the step limit',
  options,
  async (t) => {
    const model = scriptedModel(
      Array.from({ length: 6 }, () => [call('getCart', { loginId })]),
    )
    const report = {}
    await assert.rejects(
      runScenario(t, { name: 'cart', model, report }),
      /Schrittlimit/,
    )
    assert.equal(model.doGenerateCalls.length, 6)
    assert.equal(report.calls.length, 6)
  },
)

test(
  'evaluation bounds parallel tool calls as well as model steps',
  options,
  async (t) => {
    const model = scriptedModel([
      Array.from({ length: 13 }, () => call('getCart', { loginId })),
      [say('Der Warenkorb ist leer.')],
    ])
    const report = {}
    await assert.rejects(
      runScenario(t, { name: 'cart', model, report }),
      /Tool-Limit/,
    )
    assert.equal(report.calls.filter((entry) => entry.result).length, 12)
  },
)

test(
  'evaluation aborts a slow provider and retains diagnostic state',
  options,
  async (t) => {
    const model = new MockLanguageModelV4({
      doGenerate: ({ abortSignal }) =>
        new Promise((_, reject) => {
          abortSignal.addEventListener(
            'abort',
            () => reject(abortSignal.reason),
            { once: true },
          )
        }),
    })
    const report = {}
    await assert.rejects(
      runScenario(t, { name: 'cart', model, report, timeoutMs: 20 }),
      /abort|timeout/i,
    )
    assert.equal(report.state[loginId].totalItems, 0)
  },
)
