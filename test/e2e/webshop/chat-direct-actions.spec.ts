// F5: Eindeutige Widget-Buttons («In den Warenkorb», «Bestellung abschliessen»)
// rufen die Shop-API direkt auf. Es entsteht kein zusätzlicher Modellaufruf;
// die ausgeführte Aktion erscheint als Nachricht im Chat-Kontext.

import { expect, test } from '@playwright/test'
import type { Route } from '@playwright/test'

const product = {
  articleNumber: '022600',
  description: 'Test Vollmilch',
  price: 1.29,
  celumId: null,
  icons: [],
  brand: 'Test',
  unitText: '1 l',
  oldPrice: null,
  sellAmount: 1,
  sellUnit: 'St',
  status: null,
}
const searchResult = {
  ok: true,
  searchTerm: 'Milch',
  totalCount: 1,
  shownCount: 1,
  articles: [product],
  itemCount: 1,
  page: 0,
  pageSize: 5,
}
const cartToolOutput = {
  ok: true,
  cartId: 'test-cart',
  items: [{ ...product, quantity: 2, lineTotal: 2.58 }],
  totalItems: 2,
  totalAmount: 2.58,
}
const cartStateAfterAdd = {
  cartId: 'test-cart',
  items: [{ ...product, quantity: 3, lineTotal: 3.87 }],
  totalItems: 3,
  totalAmount: 3.87,
}
const checkoutResult = {
  orderId: 'TG-2026-001',
  loginId: 'kantine-campus',
  submittedAt: '2026-09-05T10:00:00.000Z',
  items: [{ ...product, quantity: 3, lineTotal: 3.87 }],
  totalItems: 3,
  totalAmount: 3.87,
}

async function stream(route: Route, chunks: object[]) {
  await route.fulfill({
    contentType: 'text/event-stream',
    headers: { 'x-vercel-ai-ui-message-stream': 'v1' },
    body:
      chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('') +
      'data: [DONE]\n\n',
  })
}

test('workspace widget buttons call the shop API directly without a model round-trip', async ({
  page,
}) => {
  let chatPosts = 0
  let addBody: unknown
  let checkoutCalls = 0
  await page.route('**/api/session', (route) =>
    route.fulfill({
      json: { account: { loginId: 'kantine-campus', name: 'Kantine Campus' } },
    }),
  )
  await page.route('**/api/orders', (route) =>
    route.fulfill({ json: { orders: [] } }),
  )
  await page.route('**/api/cart', (route) =>
    route.fulfill({
      json: { cartId: null, items: [], totalItems: 0, totalAmount: 0 },
    }),
  )
  await page.route('**/api/cart/items', (route) => {
    addBody = route.request().postDataJSON()
    return route.fulfill({ json: cartStateAfterAdd })
  })
  await page.route('**/api/cart/checkout', (route) => {
    checkoutCalls++
    return route.fulfill({ json: checkoutResult })
  })
  await page.route('**/api/chat', async (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({ json: { configured: true, model: 'Test' } })
    chatPosts++
    await stream(route, [
      { type: 'start', messageId: 'result' },
      {
        type: 'tool-input-available',
        toolCallId: 'search',
        toolName: 'searchProducts',
        input: { term: 'Milch' },
      },
      {
        type: 'tool-output-available',
        toolCallId: 'search',
        output: searchResult,
      },
      {
        type: 'tool-input-available',
        toolCallId: 'cart',
        toolName: 'getCart',
        input: {},
      },
      {
        type: 'tool-output-available',
        toolCallId: 'cart',
        output: cartToolOutput,
      },
      { type: 'finish' },
    ])
  })

  const configured = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/chat') &&
      response.request().method() === 'GET',
  )
  await page.goto('/chat')
  await configured

  const input = page.getByRole('textbox', { name: 'Nachricht eingeben' })
  await input.fill('Suche Milch')
  await input.press('Enter')
  const chat = page.getByRole('region', { name: 'Chatbot' })
  await expect(chat.locator('.chatbot-product-card')).toContainText(
    'Test Vollmilch',
  )

  // «In den Warenkorb» ruft POST /api/cart/items direkt auf und dokumentiert
  // die Aktion als Chat-Nachricht.
  await chat.getByRole('button', { name: 'In den Warenkorb' }).click()
  await expect(chat).toContainText(
    'Artikel 022600 über den Button in den Warenkorb gelegt.',
  )
  expect(addBody).toEqual({ articleNumber: '022600', quantity: 1 })

  // «Bestellung abschliessen» ruft POST /api/cart/checkout direkt auf.
  await chat.getByRole('button', { name: 'Bestellung abschliessen' }).click()
  await expect(chat).toContainText('Bestellung TG-2026-001')
  expect(checkoutCalls).toBe(1)

  // Kein weiterer Modellaufruf durch die Buttons.
  expect(chatPosts).toBe(1)
})
