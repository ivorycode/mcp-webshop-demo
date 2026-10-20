import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { checkout, requireAccount } from '../../../lib/shop.server.ts'

export const Route = createFileRoute('/api/cart/checkout')({
  server: {
    handlers: {
      POST: () => {
        const account = requireAccount()
        if (account instanceof Response) return account
        try {
          return json(checkout(account.loginId))
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Checkout fehlgeschlagen.',
            },
            { status: 400 },
          )
        }
      },
    },
  },
})
