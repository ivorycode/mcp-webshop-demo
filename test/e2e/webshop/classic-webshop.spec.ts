import { expect, test } from '@playwright/test'

test('hydrates cleanly when WebMCP is available before React starts', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    const context = new EventTarget() as WebMCPModelContext
    context.registerTool = (_tool, options) =>
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 0)
        options?.signal?.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(new DOMException('signal is aborted', 'AbortError'))
        })
      })
    context.getTools = async () => []
    context.executeTool = async () => '{}'
    context.ontoolchange = null
    Object.defineProperty(document, 'modelContext', { value: context })
  })
  expect(
    (
      await page.request.post('/api/session', {
        data: { loginId: 'kantine-campus' },
      })
    ).ok(),
  ).toBeTruthy()

  await page.goto('/')
  await expect(
    page.getByText('Kantine Campus').filter({ visible: true }).first(),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'WebMCP Tool-Konsole (0)' }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('classic webshop stays usable without the experimental WebMCP API', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  const failed: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('requestfailed', (request) =>
    failed.push(`${request.method()} ${request.url()}`),
  )
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Demo Web Shop', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'WebMCP nicht verfügbar' }),
  ).toBeVisible()
  await expect(page.locator('form[toolname]')).toHaveCount(0)
  await expect(page.locator('input[name="query"]')).toBeVisible()
  const loginId = testInfo.project.use.isMobile
    ? 'kantine-campus'
    : 'hotel-alpenblick'
  expect(
    (await page.request.post('/api/session', { data: { loginId } })).ok(),
  ).toBeTruthy()
  await page.reload()
  await expect(
    page
      .getByText(
        testInfo.project.use.isMobile ? 'Kantine Campus' : 'Hotel Alpenblick',
      )
      .filter({ visible: true })
      .first(),
  ).toBeVisible()
  expect((await page.request.get('/api/search?term=Reis')).ok()).toBeTruthy()
  expect(
    await page.locator('body').evaluate((body) => body.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width)
  expect(errors).toEqual([])
  expect(failed).toEqual([])
})
