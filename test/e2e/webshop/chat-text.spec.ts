import { expect, test } from '@playwright/test'

for (const mode of ['assistant', 'workspace'] as const) {
  test(`shows assistant clarification text in ${mode} chat`, async ({
    page,
  }) => {
    const answer = 'Welche Variante möchten Sie?\nVollmilch oder Haferdrink?'
    await page.route('**/api/chat', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: { configured: true, model: 'Test' } })
        return
      }
      const chunks = [
        { type: 'start', messageId: 'clarification' },
        { type: 'text-start', id: 'answer' },
        { type: 'text-delta', id: 'answer', delta: answer },
        { type: 'text-end', id: 'answer' },
        { type: 'finish' },
      ]
      await route.fulfill({
        contentType: 'text/event-stream',
        headers: { 'x-vercel-ai-ui-message-stream': 'v1' },
        body:
          chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('') +
          'data: [DONE]\n\n',
      })
    })

    const configured = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/chat') &&
        response.request().method() === 'GET',
    )
    await page.goto(mode === 'workspace' ? '/chat' : '/')
    await configured
    if (mode === 'assistant') {
      await page.getByRole('button', { name: 'Chatbot öffnen' }).click()
    }
    const input = page.getByRole('textbox', { name: 'Nachricht eingeben' })
    await input.fill('Ich möchte Milch.')
    await input.press('Enter')

    await expect(page.locator('.chatbot-message-user')).toContainText(
      'Ich möchte Milch.',
    )
    await expect(
      page.locator('.chatbot-message-assistant .chatbot-bubble'),
    ).toHaveText(answer)
    await expect(page.getByText('Textantwort ausgeblendet')).toHaveCount(0)
  })
}
