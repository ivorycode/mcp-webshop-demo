import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { SHOP_CART_CHANGED_EVENT } from '../../lib/shop-events.ts'
import { registerShopTools, shopTools } from './webmcp-tools.ts'

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})

function tool(name: string): WebMCPModelContextTool {
  const found = shopTools.find((candidate) => candidate.name === name)
  assert.ok(found, `Tool ${name} fehlt`)
  return found
}

function fakeWindow(): { changed: () => number } {
  const target = new EventTarget()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: target,
  })
  let changed = 0
  target.addEventListener(SHOP_CART_CHANGED_EVENT, () => changed++)
  return { changed: () => changed }
}

const emptyCart = { cartId: null, items: [], totalItems: 0, totalAmount: 0 }

test('registers the five shared contracts and aborts them as one scope', () => {
  const registrations: Array<{
    tool: WebMCPModelContextTool
    signal?: AbortSignal
  }> = []
  const context = {
    registerTool(
      registered: WebMCPModelContextTool,
      options?: { signal?: AbortSignal },
    ) {
      registrations.push({ tool: registered, signal: options?.signal })
      return Promise.resolve()
    },
  } as WebMCPModelContext

  const unregister = registerShopTools(context)

  assert.deepEqual(
    registrations.map((entry) => entry.tool.name),
    ['searchProducts', 'getCart', 'addToCart', 'removeFromCart', 'checkout'],
  )
  assert.deepEqual(registrations[0]?.tool.annotations, {
    readOnlyHint: true,
    untrustedContentHint: true,
  })
  assert.deepEqual(
    registrations.map((entry) =>
      Object.keys(
        (entry.tool.inputSchema as { properties?: object }).properties ?? {},
      ),
    ),
    [['term'], [], ['articleNumber', 'quantity'], ['articleNumber'], []],
  )
  unregister()
  assert.ok(registrations.every((entry) => entry.signal?.aborted))
})

test('does not log expected registration aborts during React effect cleanup', async () => {
  const errors: Array<unknown> = []
  const originalError = console.error
  console.error = (...args: Array<unknown>) => errors.push(args)
  try {
    const context = {
      registerTool(
        _tool: WebMCPModelContextTool,
        options?: { signal?: AbortSignal },
      ) {
        return new Promise<void>((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () =>
            reject(new DOMException('signal is aborted', 'AbortError')),
          )
        })
      },
    } as WebMCPModelContext
    registerShopTools(context)()
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.deepEqual(errors, [])
  } finally {
    console.error = originalError
  }
})

test('addToCart calls the web API with the browser session and publishes a cart event', async () => {
  const { changed } = fakeWindow()
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), '/api/cart/items')
    assert.equal(init?.method, 'POST')
    assert.deepEqual(JSON.parse(String(init.body)), {
      articleNumber: '022600',
      quantity: 2,
    })
    return Response.json({ ...emptyCart, cartId: 'cart_demo', totalItems: 2 })
  }
  const value = (await tool('addToCart').execute({
    articleNumber: '022600',
    quantity: 2,
  })) as {
    ok: boolean
    message?: string
  }
  assert.equal(value.ok, true)
  assert.match(value.message ?? '', /2 × 022600/)
  assert.equal(changed(), 1)
})

test('searchProducts uses the shared term parameter and works without execution options', async () => {
  fakeWindow()
  globalThis.fetch = async (input) => {
    assert.equal(String(input), '/api/search?term=Milch')
    return Response.json({
      searchTerm: 'Milch',
      articles: [],
      totalCount: 0,
      itemCount: 0,
      page: 0,
      pageSize: 0,
    })
  }
  const value = await tool('searchProducts').execute({ term: 'Milch' })
  assert.deepEqual(value, {
    ok: true,
    searchTerm: 'Milch',
    totalCount: 0,
    shownCount: 0,
    articles: [],
  })
})

test('rejects invalid input before calling the web API', async () => {
  globalThis.fetch = async () =>
    assert.fail('fetch darf nicht aufgerufen werden')
  const value = (await tool('addToCart').execute({
    articleNumber: '',
    quantity: 100,
  })) as { ok: boolean; error: string }
  assert.equal(value.ok, false)
  assert.match(value.error, /Ungültige Eingabe/)
})

test('getCart, removeFromCart and checkout call the matching web API routes', async () => {
  const { changed } = fakeWindow()
  const requests: Array<string> = []
  globalThis.fetch = async (input, init) => {
    requests.push(`${init?.method ?? 'GET'} ${String(input)}`)
    if (String(input) === '/api/cart/checkout') {
      return Response.json({
        orderId: 'order_demo',
        submittedAt: 'now',
        totalItems: 0,
        totalAmount: 0,
        items: [],
        loginId: 'a',
      })
    }
    return Response.json(emptyCart)
  }
  assert.equal(
    ((await tool('getCart').execute({})) as { ok: boolean }).ok,
    true,
  )
  assert.equal(
    (
      (await tool('removeFromCart').execute({ articleNumber: '022600' })) as {
        ok: boolean
      }
    ).ok,
    true,
  )
  assert.deepEqual(await tool('checkout').execute({}), {
    ok: true,
    orderId: 'order_demo',
    submittedAt: 'now',
    totalItems: 0,
    totalAmount: 0,
  })
  assert.deepEqual(requests, [
    'GET /api/cart',
    'DELETE /api/cart/items/022600',
    'POST /api/cart/checkout',
  ])
  assert.equal(changed(), 2)
})
