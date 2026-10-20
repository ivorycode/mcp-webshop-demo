import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'

// Both transports run against their own local catalog, never the live API.
export async function startMockCatalog(t, port) {
  const mock = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('../../../01-mock-api/', import.meta.url),
    env: { ...process.env, PORT: String(port), MOCK_DELAY_MS: '0' },
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  let diagnostics = ''
  mock.stderr.setEncoding('utf8')
  mock.stderr.on('data', (chunk) => {
    diagnostics += chunk
  })
  t.after(() => mock.kill())
  const origin = `http://127.0.0.1:${port}`
  for (let attempt = 0; attempt < 100; attempt++) {
    if (mock.exitCode !== null)
      throw new Error(`Mock catalog exited (${mock.exitCode}): ${diagnostics}`)
    try {
      if ((await fetch(`${origin}/health`)).ok) return origin
    } catch {}
    await setTimeout(50)
  }
  throw new Error(`Mock catalog did not become ready: ${diagnostics}`)
}

function text(result) {
  const blocks = result.content.filter((block) => block.type === 'text')
  assert.ok(blocks.length > 0, 'MCP result must contain text for the model')
  for (const block of blocks) assert.ok(block.text.trim().length > 0)
  return blocks.map((block) => block.text).join('\n')
}

function success(result) {
  assert.notEqual(result.isError, true, text(result))
  assert.equal(result.structuredContent?.ok, true, text(result))
  return result.structuredContent
}

// Use the third account so the existing HTTP/Web-API cross-check stays isolated.
export async function testMcpToolContract(t, client) {
  await t.test(
    'search returns catalog products and readable text with or without an account',
    async () => {
      for (const account of [{}, { loginId: 'kantine-campus' }]) {
        const result = await client.callTool({
          name: 'searchProducts',
          arguments: { term: 'Milch', ...account },
        })
        const data = success(result)
        assert.equal(data.loginId, account.loginId ?? null)
        assert.equal(data.searchTerm, 'Milch')
        assert.ok(data.shownCount > 0 && data.shownCount <= 5)
        assert.equal(data.articles.length, data.shownCount)
        assert.ok(data.totalCount >= data.shownCount)
        assert.ok(
          data.articles.some((article) => article.articleNumber === '022600'),
        )
        for (const article of data.articles) {
          assert.equal(typeof article.description, 'string')
          assert.equal(typeof article.price, 'number')
        }
        assert.match(text(result), /Milch/)
        assert.ok(text(result).includes(String(data.shownCount)))
      }
    },
  )

  const loginId = 'kantine-campus'
  const call = (name, args = {}) =>
    client.callTool({ name, arguments: { loginId, ...args } })

  await t.test(
    'search with no matches is a successful empty result',
    async () => {
      const result = await call('searchProducts', {
        term: 'no-such-product-78431',
      })
      const data = success(result)
      assert.equal(data.totalCount, 0)
      assert.equal(data.shownCount, 0)
      assert.deepEqual(data.articles, [])
      assert.match(text(result), /0 Produkte/)
    },
  )

  await t.test(
    'all tools reject unknown accounts with usable recovery information',
    async () => {
      for (const name of [
        'searchProducts',
        'getCart',
        'addToCart',
        'removeFromCart',
        'checkout',
        'getOrders',
      ]) {
        const result = await call(name, {
          loginId: 'unknown',
          term: 'Milch',
          articleNumber: '022600',
          quantity: 1,
        })
        assert.equal(result.isError, true, name)
        assert.equal(result.structuredContent?.ok, false, name)
        assert.deepEqual(
          result.structuredContent.validAccounts.map(
            (account) => account.loginId,
          ),
          ['restaurant-baeren', 'hotel-alpenblick', 'kantine-campus'],
        )
        assert.match(text(result), /Unbekannt/)
        assert.match(text(result), /kantine-campus/)
      }
      assert.equal(success(await call('getCart')).totalItems, 0)
      assert.deepEqual(success(await call('getOrders')).orders, [])
    },
  )

  await t.test(
    'MCP schemas reject missing, blank and invalid arguments without changing state',
    async () => {
      const inputs = [
        ['searchProducts', {}],
        ['searchProducts', { term: '   ' }],
        ...['getCart', 'getOrders', 'checkout'].map((name) => [name, {}]),
        ['getCart', { loginId: '   ' }],
        ['addToCart', { articleNumber: '022600' }],
        ['addToCart', { loginId }],
        ['removeFromCart', { loginId }],
        ['removeFromCart', { loginId, articleNumber: '   ' }],
        ...[0, -1, 1.5, 100, '2'].map((quantity) => [
          'addToCart',
          { loginId, articleNumber: '022600', quantity },
        ]),
      ]
      for (const [name, args] of inputs) {
        const result = await client.callTool({ name, arguments: args })
        assert.equal(result.isError, true, `${name}: ${JSON.stringify(args)}`)
        text(result)
      }
      assert.equal(success(await call('getCart')).totalItems, 0)
      assert.deepEqual(success(await call('getOrders')).orders, [])
    },
  )

  await t.test(
    'all six tools expose descriptions, account schemas and effect annotations',
    async () => {
      const { tools } = await client.listTools()
      for (const tool of tools) {
        assert.ok(tool.description?.trim(), tool.name)
        assert.equal(tool.inputSchema.properties.loginId.type, 'string')
        assert.match(
          tool.inputSchema.properties.loginId.description,
          /kantine-campus/,
        )
        assert.equal(
          tool.inputSchema.required.includes('loginId'),
          tool.name !== 'searchProducts',
        )
        assert.equal(
          tool.annotations.readOnlyHint,
          ['searchProducts', 'getCart', 'getOrders'].includes(tool.name),
        )
      }
      const add = tools.find((tool) => tool.name === 'addToCart')
      assert.equal(add.inputSchema.properties.quantity.default, 1)
      assert.equal(add.annotations.idempotentHint, false)
      const checkout = tools.find((tool) => tool.name === 'checkout')
      assert.equal(checkout.annotations.destructiveHint, true)
      assert.equal(checkout.annotations.idempotentHint, false)
      assert.match(checkout.description, /Bestätigung/)
    },
  )

  await t.test(
    'add, read, remove, checkout and order history agree through MCP and in text',
    async () => {
      const empty = await call('getCart')
      assert.equal(success(empty).cartId, null)
      assert.match(text(empty), /leer/)
      assert.match(text(await call('getOrders')), /0 Bestellungen/)

      const added = await call('addToCart', { articleNumber: '022600' })
      assert.equal(success(added).totalItems, 1)
      assert.match(text(added), /022600.*hinzugefügt/)
      success(await call('addToCart', { articleNumber: '022600', quantity: 2 }))
      const full = await call('getCart')
      const cart = success(full)
      assert.equal(cart.items.length, 1)
      assert.equal(cart.items[0].quantity, 3)
      assert.equal(cart.totalAmount, 3.87)
      assert.match(text(full), /3 Artikel/)

      const removed = await call('removeFromCart', { articleNumber: '022600' })
      assert.deepEqual(success(removed).items, [])
      assert.match(text(removed), /022600.*entfernt/)
      assert.equal(success(await call('getCart')).totalItems, 0)

      success(await call('addToCart', { articleNumber: '022600', quantity: 2 }))
      const checkedOut = await call('checkout')
      const order = success(checkedOut)
      assert.equal(order.orderId, cart.cartId)
      assert.equal(order.totalItems, 2)
      assert.equal(order.totalAmount, 2.58)
      assert.ok(Number.isFinite(Date.parse(order.submittedAt)))
      assert.ok(text(checkedOut).includes(order.orderId))
      assert.match(text(checkedOut), /übermittelt/)
      assert.equal(order.cart.cartId, null)
      assert.deepEqual(order.cart.items, [])
      assert.equal(success(await call('getCart')).cartId, null)

      const history = await call('getOrders')
      const data = success(history)
      assert.equal(data.loginId, loginId)
      assert.equal(data.orders.length, 1)
      assert.equal(data.orders[0].orderId, order.orderId)
      assert.equal(data.orders[0].totalAmount, 2.58)
      assert.equal(data.orders[0].items[0].quantity, 2)
      assert.match(text(history), /1 Bestellungen/)
      assert.deepEqual(
        success(await call('getOrders', { loginId: 'restaurant-baeren' }))
          .orders,
        [],
      )
      assert.equal(
        success(await call('getCart', { loginId: 'restaurant-baeren' }))
          .totalItems,
        0,
      )

      const next = success(await call('addToCart', { articleNumber: '022600' }))
      assert.notEqual(next.cartId, order.orderId)
      assert.deepEqual(success(await call('getOrders')).orders, data.orders)
      success(await call('removeFromCart', { articleNumber: '022600' }))
    },
  )

  await t.test(
    'business errors contain error text and leave cart and orders unchanged',
    async () => {
      const before = success(await call('getOrders'))
      for (const [name, args] of [
        ['checkout', {}],
        ['removeFromCart', { articleNumber: 'missing-product' }],
        ['addToCart', { articleNumber: 'missing-product' }],
      ]) {
        const result = await call(name, args)
        assert.equal(result.isError, true, name)
        assert.equal(result.structuredContent?.ok, false)
        assert.equal(result.structuredContent.loginId, loginId)
        assert.ok(result.structuredContent.error.length > 0)
        assert.ok(text(result).includes(result.structuredContent.error))
        assert.deepEqual(success(await call('getOrders')), before)
      }
      success(
        await call('addToCart', { articleNumber: '022600', quantity: 99 }),
      )
      const overflow = await call('addToCart', {
        articleNumber: '022600',
        quantity: 1,
      })
      assert.equal(overflow.isError, true)
      assert.equal(overflow.structuredContent?.ok, false)
      assert.match(text(overflow), /99/)
      assert.equal(success(await call('getCart')).totalItems, 99)
      success(await call('removeFromCart', { articleNumber: '022600' }))
      assert.deepEqual(success(await call('getOrders')).orders, before.orders)
    },
  )

  await t.test(
    'a content-only client can search, add and verify products without UI data',
    async () => {
      // Some hosts pass only content to the model, while the App gets structuredContent.
      const callFromText = async (name, args = {}) => {
        const result = await client.callTool({
          name,
          arguments: { loginId: 'kantine-campus', ...args },
        })
        assert.notEqual(result.isError, true, text(result))
        const json = result.content.find((block) => {
          if (block.type !== 'text') return false
          try {
            return JSON.parse(block.text)?.ok === true
          } catch {
            return false
          }
        })
        assert.ok(
          json,
          `${name}: content must include usable product/cart data`,
        )
        return JSON.parse(json.text)
      }
      const search = await callFromText('searchProducts', { term: 'Milch' })
      const product = search.articles.find((article) =>
        article.description.includes('Vollmilch'),
      )
      assert.ok(product, 'Model must be able to select a product by its name')
      assert.equal(typeof product.articleNumber, 'string')
      assert.ok(product.articleNumber.length > 0)
      assert.equal(typeof product.price, 'number')
      assert.ok(product.unitText)
      assert.ok(product.sellAmount > 0)
      assert.ok(product.sellUnit)
      try {
        const added = await callFromText('addToCart', {
          articleNumber: product.articleNumber,
          quantity: 2,
        })
        assert.equal(added.totalItems, 2)
        const cart = await callFromText('getCart')
        assert.equal(cart.items.length, 1)
        assert.equal(cart.items[0].articleNumber, product.articleNumber)
        assert.equal(cart.items[0].quantity, 2)
        assert.equal(
          cart.totalAmount,
          Math.round(product.price * 2 * 100) / 100,
        )
      } finally {
        await client.callTool({
          name: 'removeFromCart',
          arguments: {
            loginId: 'kantine-campus',
            articleNumber: product.articleNumber,
          },
        })
      }
    },
  )
}
