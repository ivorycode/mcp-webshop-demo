import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  getCurrentAccount,
  loginAccount,
  logoutAccount,
} from '../../lib/session.server.ts'

export const Route = createFileRoute('/api/session')({
  server: {
    handlers: {
      GET: () => json({ account: getCurrentAccount() }),
      POST: async ({ request }) => {
        const body = (await request.json()) as { loginId?: string }
        const loginId = body.loginId?.trim() ?? ''
        if (!loginId) return json({ error: 'Login-ID fehlt.' }, { status: 400 })
        try {
          return json({ account: loginAccount(loginId) })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Konto konnte nicht ausgewählt werden.',
            },
            { status: 400 },
          )
        }
      },
      DELETE: () => {
        logoutAccount()
        return json({ ok: true as const })
      },
    },
  },
})
