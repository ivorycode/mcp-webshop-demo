import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import type {
  CartData,
  CheckoutToolResult,
  SearchProductsResult,
  ToolError,
} from '../../src/lib/tools/results.ts'

const toolNames = [
  'addToCart',
  'checkout',
  'getCart',
  'removeFromCart',
  'searchProducts',
]

async function expectShopTools(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(async () =>
          (await document.modelContext!.getTools())
            .map((tool) => tool.name)
            .sort(),
        ),
      {
        message:
          'Five native shop tools are required. Complete exercise steps 1–5 in the starter.',
      },
    )
    .toEqual(toolNames)
}

// Descriptors contain a Window reference: discover and execute in the same
// page.evaluate call. Never replace modelContext, fetch or the tool callbacks.
async function callTool<T>(
  page: Page,
  toolName: string,
  argumentsObject: object = {},
): Promise<T> {
  return page.evaluate(
    async ({ name, input }) => {
      const context = document.modelContext!
      const tool = (await context.getTools()).find(
        (candidate) => candidate.name === name,
      )
      if (!tool) throw new Error(`Native tool ${name} is missing`)
      const raw = await context.executeTool(tool, JSON.stringify(input))
      if (raw === null) throw new Error(`Unexpected navigation from ${name}`)
      return JSON.parse(raw)
    },
    { name: toolName, input: argumentsObject },
  )
}

test.beforeEach(async ({ page, browser }, testInfo) => {
  testInfo.annotations.push({ type: 'Chrome', description: browser.version() })
  await page.goto('/')
  expect(
    await page.evaluate(() => ({
      registerTool: typeof document.modelContext?.registerTool,
      getTools: typeof document.modelContext?.getTools,
      executeTool: typeof document.modelContext?.executeTool,
    })),
    'Native WebMCP is required: install a compatible Chrome and enable WebMCPTesting. No mock or skip is used.',
  ).toEqual({
    registerTool: 'function',
    getTools: 'function',
    executeTool: 'function',
  })
  await expectShopTools(page)
})

test('native discovery and anonymous search update the visible shop', async ({
  page,
}) => {
  await expect(
    page.getByRole('button', { name: 'WebMCP Tool-Konsole (5)', exact: true }),
  ).toBeVisible()
  const schemas = await page.evaluate(async () =>
    (await document.modelContext!.getTools()).map((tool) => ({
      name: tool.name,
      schema:
        typeof tool.inputSchema === 'string'
          ? JSON.parse(tool.inputSchema)
          : tool.inputSchema,
    })),
  )
  for (const { schema } of schemas) {
    expect(schema.type).toBe('object')
    expect(schema.properties).not.toHaveProperty('loginId')
  }
  expect(
    schemas.find(({ name }) => name === 'searchProducts')?.schema.required,
  ).toContain('term')

  const result = await callTool<Extract<SearchProductsResult, { ok: true }>>(
    page,
    'searchProducts',
    { term: 'Milch' },
  )
  expect(result.ok).toBe(true)
  expect(result.searchTerm).toBe('Milch')
  // The workshop catalog has more than five milk products.
  expect(result.totalCount).toBeGreaterThan(5)
  expect(result.shownCount).toBe(5)
  expect(result.articles).toHaveLength(5)
  await expect(page.locator('input[name="query"]')).toHaveValue('Milch')
  const searchPanel = page
    .locator('section')
    .filter({
      has: page.getByRole('heading', {
        name: 'Transgourmet-Artikelsuche',
        exact: true,
      }),
    })
    .last()
  await expect(searchPanel.locator('article')).toHaveCount(result.totalCount)
  await expect(
    searchPanel.getByText(result.articles[0].articleNumber, { exact: true }),
  ).toBeVisible()

  for (const name of ['getCart', 'addToCart', 'removeFromCart', 'checkout']) {
    const input =
      name === 'addToCart'
        ? { articleNumber: result.articles[0].articleNumber, quantity: 2 }
        : name === 'removeFromCart'
          ? { articleNumber: result.articles[0].articleNumber }
          : {}
    const error = await callTool<ToolError>(page, name, input)
    expect(error.ok).toBe(false)
    expect(error.error).toContain('Nicht angemeldet')
  }
})

test('the tool console executes native search after a page reload', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.reload()
  await expectShopTools(page)
  await page
    .getByRole('button', { name: 'WebMCP Tool-Konsole (5)', exact: true })
    .click()
  await page.getByRole('combobox').selectOption('searchProducts')
  await page.locator('textarea').fill(JSON.stringify({ term: 'Milch' }))
  await page.getByRole('button', { name: 'Ausführen', exact: true }).click()
  await expect(page.locator('pre')).toContainText('"ok": true')
  await expect(page.locator('input[name="query"]')).toHaveValue('Milch')
  expect(errors).toEqual([])
})

async function login(page: Page, loginId: string, label: string) {
  await page
    .getByRole('button', { name: /^(Anmelden|Konto wechseln)$/ })
    .click()
  await page.getByRole('combobox').selectOption(loginId)
  await page
    .locator('form')
    .getByRole('button', { name: 'Anmelden', exact: true })
    .click()
  await expect(page.locator('aside')).toContainText(label)
  await expect(
    page
      .locator('#cart')
      .getByRole('button', { name: 'Warenkorb leeren', exact: true }),
  ).toBeVisible()
}

async function clearCart(page: Page) {
  const button = page
    .locator('#cart')
    .getByRole('button', { name: 'Warenkorb leeren', exact: true })
  if (await button.isEnabled()) await button.click()
  await expect(page.locator('#cart article')).toHaveCount(0)
  expect(await callTool<CartData>(page, 'getCart')).toMatchObject({
    ok: true,
    items: [],
    totalItems: 0,
  })
}

test('native cart tools share the selected account and update cart and orders without reload', async ({
  page,
}) => {
  await login(page, 'hotel-alpenblick', 'Hotel Alpenblick')
  await clearCart(page)
  await login(page, 'restaurant-baeren', 'Restaurant Bären')
  await clearCart(page)
  const search = await callTool<Extract<SearchProductsResult, { ok: true }>>(
    page,
    'searchProducts',
    { term: 'Milch' },
  )
  const articleNumber = search.articles[0].articleNumber
  const cart = page.locator('#cart')

  const added = await callTool<CartData>(page, 'addToCart', {
    articleNumber,
    quantity: 2,
  })
  expect(added).toMatchObject({
    ok: true,
    totalItems: 2,
    items: [{ articleNumber, quantity: 2 }],
  })
  await expect(cart.locator('article')).toHaveCount(1)
  await expect(cart.getByText('2 Positionen', { exact: true })).toBeVisible()
  await expect(cart.locator('article')).toContainText(articleNumber)

  // Manual UI actions must also be reflected by the next native tool call.
  await cart.getByRole('button', { name: '+', exact: true }).click()
  await expect(cart.getByText('3 Positionen', { exact: true })).toBeVisible()
  expect(await callTool<CartData>(page, 'getCart')).toMatchObject({
    ok: true,
    totalItems: 3,
  })

  // Tools read the current cookie on each call, not the account at registration.
  await login(page, 'hotel-alpenblick', 'Hotel Alpenblick')
  expect(await callTool<CartData>(page, 'getCart')).toMatchObject({
    ok: true,
    items: [],
    totalItems: 0,
  })
  await expect(cart.locator('article')).toHaveCount(0)
  await login(page, 'restaurant-baeren', 'Restaurant Bären')
  expect(await callTool<CartData>(page, 'getCart')).toMatchObject({
    ok: true,
    totalItems: 3,
  })
  await expect(cart.getByText('3 Positionen', { exact: true })).toBeVisible()

  expect(
    await callTool<CartData>(page, 'removeFromCart', { articleNumber }),
  ).toMatchObject({ ok: true, items: [], totalItems: 0 })
  await expect(cart.locator('article')).toHaveCount(0)
  await expect(cart.getByText('0 Positionen', { exact: true })).toBeVisible()

  const beforeCheckout = await callTool<CartData>(page, 'addToCart', {
    articleNumber,
    quantity: 2,
  })
  await expect(cart.getByText('2 Positionen', { exact: true })).toBeVisible()
  const orders = page
    .locator('section')
    .filter({
      has: page.getByRole('heading', { name: 'Letzte Aufträge', exact: true }),
    })
    .last()
  const orderCount = await orders.locator('article').count()
  // The test explicitly authorizes this demo checkout.
  const order = await callTool<Extract<CheckoutToolResult, { ok: true }>>(
    page,
    'checkout',
  )
  expect(order.ok).toBe(true)
  expect(order.orderId).toBeTruthy()
  expect(Number.isNaN(Date.parse(order.submittedAt))).toBe(false)
  expect(order.totalItems).toBe(2)
  expect(order.totalAmount).toBe(beforeCheckout.totalAmount)
  expect(await callTool<CartData>(page, 'getCart')).toMatchObject({
    ok: true,
    items: [],
    totalItems: 0,
    totalAmount: 0,
  })
  await expect(cart.locator('article')).toHaveCount(0)
  await expect(orders.locator('article')).toHaveCount(orderCount + 1)
  await expect(orders.getByText(order.orderId, { exact: true })).toBeVisible()

  const emptyCheckout = await callTool<ToolError>(page, 'checkout')
  expect(emptyCheckout.ok).toBe(false)
  expect(emptyCheckout.error).toContain('keinen gefüllten aktiven Warenkorb')
  await expect(orders.locator('article')).toHaveCount(orderCount + 1)
})

test('native invalid inputs and unknown articles leave the cart unchanged', async ({
  page,
}) => {
  await login(page, 'kantine-campus', 'Kantine Campus')
  await clearCart(page)
  const before = await callTool<CartData>(page, 'getCart')
  // Valid JSON reaches the real tool's Zod validator in the supported Chrome.
  const invalid = await callTool<ToolError>(page, 'addToCart', {
    articleNumber: '022600',
    quantity: 0,
  })
  expect(invalid.ok).toBe(false)
  expect(invalid.error).toContain('Ungültige Eingabe')
  expect(await callTool<CartData>(page, 'getCart')).toEqual(before)

  const unknown = await callTool<ToolError>(page, 'addToCart', {
    articleNumber: 'no-such-workshop-article',
    quantity: 1,
  })
  expect(unknown.ok).toBe(false)
  expect(unknown.error).toBeTruthy()
  expect(await callTool<CartData>(page, 'getCart')).toEqual(before)
  await expect(page.locator('#cart article')).toHaveCount(0)
})
