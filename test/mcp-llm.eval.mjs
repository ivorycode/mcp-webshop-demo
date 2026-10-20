// Explicit opt-in: this filename is outside npm test's *.test.mjs glob.
import 'dotenv/config'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import {
  API_KEY_VARIABLES,
  createModel,
  describeModel,
} from '../src/features/chat/server/provider.server.ts'
import {
  limits,
  runScenario,
  scenarioNames,
} from './support/mcp-llm-client.mjs'

function integer(name, fallback, min, max) {
  const value = Number(process.env[name] ?? fallback)
  assert.ok(
    Number.isInteger(value) && value >= min && value <= max,
    `${name} muss eine Ganzzahl zwischen ${min} und ${max} sein.`,
  )
  return value
}

function errorMessage(error) {
  let message = `${error.name}: ${error.message}`
  for (const variable of Object.values(API_KEY_VARIABLES)) {
    if (process.env[variable])
      message = message.replaceAll(process.env[variable], '[REDACTED]')
  }
  return message
}

test('LLM bedient den echten MCP-Server', async (t) => {
  // Misconfiguration fails explicitly instead of silently skipping a paid eval.
  const modelLabel = describeModel()
  const model = createModel()
  const trials = integer('MCP_LLM_TRIALS', 1, 1, 5)
  const timeoutMs = integer(
    'MCP_LLM_TIMEOUT_MS',
    limits.timeoutMs,
    1000,
    180_000,
  )
  const selected = process.env.MCP_LLM_SCENARIO
  assert.ok(
    !selected || scenarioNames.includes(selected),
    `MCP_LLM_SCENARIO: erlaubt sind ${scenarioNames.join(', ')}.`,
  )
  const scenarios = selected ? [selected] : scenarioNames
  await mkdir('test-results', { recursive: true })
  const directory = await mkdtemp(resolve('test-results/mcp-llm-'))
  const results = []
  t.diagnostic(`Modell: ${modelLabel}; Berichte: ${directory}`)
  t.after(async () => {
    await writeFile(
      `${directory}/summary.json`,
      JSON.stringify(
        {
          model: modelLabel,
          trials,
          scenarios,
          results,
          passed: results.filter((result) => result.passed).length,
          total: results.length,
        },
        null,
        2,
      ) + '\n',
    )
  })
  for (let trial = 1; trial <= trials; trial++) {
    for (const name of scenarios) {
      await t.test(`${name} / Durchlauf ${trial}`, async (scenario) => {
        const report = {
          model: modelLabel,
          trial,
          startedAt: new Date().toISOString(),
          passed: false,
        }
        try {
          await runScenario(scenario, { name, model, report, timeoutMs })
          report.passed = true
        } catch (error) {
          report.error = errorMessage(error)
          // Avoid dumping provider request objects (and possibly headers) via node:test.
          throw new Error(report.error)
        } finally {
          const file = `${name}-${trial}.json`
          await writeFile(
            `${directory}/${file}`,
            JSON.stringify(report, null, 2) + '\n',
          )
          results.push({ scenario: name, trial, passed: report.passed, file })
        }
      })
    }
  }
})
