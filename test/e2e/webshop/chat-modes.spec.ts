import { expect, test } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

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
const emptyCart = { cartId: null, items: [], totalItems: 0, totalAmount: 0 }
const fullCart = {
  ok: true,
  cartId: 'test-cart',
  items: [{ ...product, quantity: 2, lineTotal: 2.58 }],
  totalItems: 2,
  totalAmount: 2.58,
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

async function openChat(page: Page, mode: 'assistant' | 'workspace') {
  const configured = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/chat') &&
      response.request().method() === 'GET',
  )
  await page.goto(mode === 'assistant' ? '/' : '/chat')
  await configured
  if (mode === 'assistant')
    await page.getByRole('button', { name: 'Chatbot öffnen' }).click()
}

for (const mode of ['assistant', 'workspace'] as const) {
  test(`${mode} presents tool results in the intended surface`, async ({
    page,
  }) => {
    let changed = false
    await page.route('**/api/session', (route) =>
      route.fulfill({
        json: {
          account: { loginId: 'kantine-campus', name: 'Kantine Campus' },
        },
      }),
    )
    await page.route('**/api/cart', (route) =>
      route.fulfill({ json: changed ? fullCart : emptyCart }),
    )
    await page.route('**/api/orders', (route) =>
      route.fulfill({ json: { orders: [] } }),
    )
    await page.route('**/api/search?**', (route) =>
      route.fulfill({ json: searchResult }),
    )
    await page.route('**/api/chat', async (route) => {
      if (route.request().method() === 'GET')
        return route.fulfill({ json: { configured: true, model: 'Test' } })
      expect(route.request().postDataJSON().mode).toBe(mode)
      changed = true
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
          toolCallId: 'add',
          toolName: 'addToCart',
          input: { articleNumber: '022600', quantity: 2 },
        },
        { type: 'tool-output-available', toolCallId: 'add', output: fullCart },
        ...(mode === 'assistant'
          ? [
              { type: 'text-start', id: 'answer' },
              {
                type: 'text-delta',
                id: 'answer',
                delta:
                  'Zwei Milch sind im Warenkorb. Die Suche ist im Shop geöffnet.',
              },
              { type: 'text-end', id: 'answer' },
            ]
          : []),
        { type: 'finish' },
      ])
    })
    await openChat(page, mode)
    const input = page.getByRole('textbox', { name: 'Nachricht eingeben' })
    await input.fill('Lege zwei Milch in den Warenkorb.')
    await input.press('Enter')
    const chat = page.getByRole('region', { name: 'Chatbot' })
    if (mode === 'assistant') {
      await expect(chat).toContainText('Zwei Milch sind im Warenkorb.')
      await expect(
        chat.locator('.chatbot-product-card, .chatbot-summary-card, table'),
      ).toHaveCount(0)
      await expect(page.locator('input[name="query"]')).toHaveValue('Milch')
      await expect(page.locator('#cart')).toContainText('Test Vollmilch')
    } else {
      await expect(chat.locator('.chatbot-product-card')).toContainText(
        'Test Vollmilch',
      )
      await expect(chat.locator('table')).toContainText('Test Vollmilch')
    }
  })
}

for (const answer of ['Ja', 'Nein']) {
  test(`assistant checkout uses textual ${answer} as SDK approval`, async ({
    page,
  }) => {
    let posts = 0
    let approval: unknown
    await page.route('**/api/chat', async (route) => {
      if (route.request().method() === 'GET')
        return route.fulfill({ json: { configured: true, model: 'Test' } })
      const body = route.request().postDataJSON()
      expect(body.mode).toBe('assistant')
      posts++
      if (posts === 1) {
        await stream(route, [
          { type: 'start', messageId: 'checkout' },
          {
            type: 'tool-input-available',
            toolCallId: 'checkout-call',
            toolName: 'checkout',
            input: {},
          },
          {
            type: 'tool-approval-request',
            toolCallId: 'checkout-call',
            approvalId: 'approve-checkout',
          },
          { type: 'finish' },
        ])
      } else {
        approval = body.messages
          .flatMap((message: { parts: object[] }) => message.parts)
          .find(
            (part: { type: string }) => part.type === 'tool-checkout',
          ).approval
        await stream(route, [
          { type: 'start', messageId: 'confirmation' },
          { type: 'text-start', id: 'answer' },
          {
            type: 'text-delta',
            id: 'answer',
            delta:
              answer === 'Ja'
                ? 'Die Bestellung wurde abgeschickt.'
                : 'Die Bestellung wurde abgebrochen.',
          },
          { type: 'text-end', id: 'answer' },
          { type: 'finish' },
        ])
      }
    })
    await openChat(page, 'assistant')
    const input = page.getByRole('textbox', { name: 'Nachricht eingeben' })
    await input.fill('Bestellung abschliessen')
    await input.press('Enter')
    await expect(
      page.getByText(
        'Bestellung jetzt abschicken? Antworten Sie mit Ja oder Nein.',
      ),
    ).toBeVisible()
    await expect(page.locator('.chatbot-summary-card')).toHaveCount(0)
    await input.fill('Vielleicht')
    await input.press('Enter')
    await expect(page.getByRole('alert')).toContainText('Bitte bestätigen')
    expect(posts).toBe(1)
    await input.fill(answer)
    await input.press('Enter')
    await expect
      .poll(() => approval)
      .toMatchObject({ id: 'approve-checkout', approved: answer === 'Ja' })
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
}
