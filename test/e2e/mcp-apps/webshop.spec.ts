import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client'

const appFrame = (page: Page) =>
  page
    .frameLocator('iframe[title="App-Sandbox"]')
    .frameLocator('iframe[title="MCP App"]')

async function load(
  page: Page,
  tool = 'searchProducts',
  login = 'restaurant-baeren',
) {
  await page.getByLabel('App', { exact: true }).selectOption(tool)
  await page.getByLabel('Login-ID').fill(login)
  await page.getByRole('button', { name: 'App laden' }).click()
  await expect(page.getByRole('status')).toHaveText('App bereit')
  return appFrame(page)
}

test.beforeEach(async ({ page, request }) => {
  // The catalog boundary is local, including images whose URLs are baked into the apps.
  await page.route('https://webshop.transgourmet.ch/**', async (route) => {
    const url = new URL(route.request().url())
    const response = await request.get(`http://127.0.0.1:43555${url.pathname}`)
    await route.fulfill({ response })
  })
  // Reset carts through public tools, so tests also work individually and on repeat.
  const client = new Client({ name: 'mcp-app-test-setup', version: '1.0.0' })
  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL('http://127.0.0.1:43554/mcp')),
    )
    for (const loginId of ['restaurant-baeren', 'hotel-alpenblick']) {
      const cart = await client.callTool({
        name: 'getCart',
        arguments: { loginId },
      })
      const data = cart.structuredContent as {
        items: Array<{ articleNumber: string }>
      }
      for (const { articleNumber } of data.items) {
        await client.callTool({
          name: 'removeFromCart',
          arguments: { loginId, articleNumber },
        })
      }
    }
  } finally {
    await client.close()
  }
})

test('search app receives tool results and can search again through the host', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'App laden' }).click()
  const app = appFrame(page)
  await expect(
    app.getByRole('heading', { name: 'Webshop Produktsuche' }),
  ).toBeVisible()
  await expect(app.getByRole('article').first()).toBeVisible()
  await app.getByRole('searchbox').fill('zzzz-kein-produkt-987654')
  await app.getByRole('button', { name: 'Suchen', exact: true }).click()
  await expect(app.getByText('0 von 0 Treffern')).toBeVisible()
  await expect(app.getByRole('article')).toHaveCount(0)
})

for (const notifications of ['supported', 'unsupported', 'reject']) {
  test(`cart actions with ${notifications} host notifications`, async ({
    page,
  }) => {
    const errors: string[] = []
    const warnings: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'warning') warnings.push(message.text())
    })
    await page.goto(`/?notifications=${notifications}`)
    const app = await load(page)
    const product = app.getByRole('article').filter({ hasText: '022600' })
    await product.getByRole('spinbutton', { name: 'Menge' }).fill('2')
    await product.getByRole('button', { name: 'In den Warenkorb' }).click()
    await expect(
      app.getByRole('heading', { name: /Warenkorb · 2 Artikel/ }),
    ).toBeVisible()
    await expect(
      product.getByRole('button', { name: 'In den Warenkorb' }),
    ).toBeEnabled()
    await expect(
      app.getByText(/MCP error|Artikel konnte nicht hinzugefügt werden/),
    ).toHaveCount(0)
    if (notifications !== 'unsupported') {
      await expect(page.locator('#context')).toContainText(
        '2 × Artikel 022600 hinzugefügt',
      )
    } else {
      await expect(page.locator('#context')).toBeEmpty()
    }

    await load(page, 'getCart', 'hotel-alpenblick')
    await expect(
      app.getByText('Noch keine Artikel im Warenkorb.'),
    ).toBeVisible()
    await load(page, 'getCart')
    await expect(
      app.getByRole('heading', { name: /Warenkorb · 2 Artikel/ }),
    ).toBeVisible()
    await app.getByRole('button', { name: 'Entfernen' }).click()
    await expect(
      app.getByText('Noch keine Artikel im Warenkorb.'),
    ).toBeVisible()
    if (notifications !== 'unsupported') {
      await expect(page.locator('#context')).toContainText(
        'Artikel 022600 entfernt',
      )
    } else {
      await expect(page.locator('#context')).toBeEmpty()
    }
    await load(page, 'getCart')
    await expect(
      app.getByText('Noch keine Artikel im Warenkorb.'),
    ).toBeVisible()

    await load(page)
    await product.getByRole('button', { name: 'In den Warenkorb' }).click()
    await expect(
      app.getByRole('heading', { name: /Warenkorb · 1 Artikel/ }),
    ).toBeVisible()
    await load(page, 'getCart')
    await app.getByRole('button', { name: 'Bestellung abschliessen' }).click()
    await expect(app.getByRole('status')).toContainText(
      'Bestellung abgeschickt (Mock)',
    )
    await expect(
      app.getByText('Noch keine Artikel im Warenkorb.'),
    ).toBeVisible()
    if (notifications !== 'unsupported') {
      await expect(page.locator('#messages')).toContainText(
        'wurde in der Webshop-UI abgeschickt',
      )
    } else {
      await expect(page.locator('#messages')).toBeEmpty()
    }
    await load(page, 'getCart')
    await expect(
      app.getByText('Noch keine Artikel im Warenkorb.'),
    ).toBeVisible()
    await expect(
      app.getByText(/\d+ Bestellung\(en\) im Verlauf/),
    ).not.toHaveText('0 Bestellung(en) im Verlauf.')
    expect(errors).toEqual([])
    if (notifications === 'reject') {
      await expect
        .poll(
          () =>
            warnings.filter((text) =>
              text.includes('Host-Benachrichtigung fehlgeschlagen'),
            ).length,
        )
        .toBe(4)
    } else {
      expect(
        warnings.filter((text) =>
          text.includes('Host-Benachrichtigung fehlgeschlagen'),
        ),
      ).toEqual([])
    }
  })
}

test('anonymous search disables cart mutations', async ({ page }) => {
  await page.goto('/')
  const app = await load(page, 'searchProducts', '')
  await expect(app.getByRole('article').first()).toBeVisible()
  await expect(
    app.getByRole('button', { name: 'In den Warenkorb' }).first(),
  ).toBeDisabled()
  await expect(
    app.getByText('In dieser App gibt es bewusst keine Kontoauswahl.', {
      exact: false,
    }),
  ).toBeVisible()
})

test('invalid account errors reach the embedded app', async ({ page }) => {
  await page.goto('/')
  const app = await load(page, 'getCart', 'unbekanntes-konto')
  await expect(
    app.getByText('Unbekannte Login-ID "unbekanntes-konto".'),
  ).toBeVisible()
  await expect(
    app.getByRole('button', { name: 'Bestellung abschliessen' }),
  ).toHaveCount(0)
})

test('checkout result sent by the host displays the order confirmation', async ({
  page,
}) => {
  await page.goto('/')
  const app = await load(page)
  await app
    .getByRole('article')
    .filter({ hasText: '022600' })
    .getByRole('button', { name: 'In den Warenkorb' })
    .click()
  await expect(
    app.getByRole('heading', { name: /Warenkorb · 1 Artikel/ }),
  ).toBeVisible()
  await load(page, 'checkout')
  await expect(app.getByRole('status')).toContainText(
    'Bestellung abgeschickt (Mock)',
  )
  await expect(app.getByText('Noch keine Artikel im Warenkorb.')).toBeVisible()
})
