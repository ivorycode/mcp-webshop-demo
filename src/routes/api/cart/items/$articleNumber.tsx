import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  removeFromCart,
  requireAccount,
  updateCartQuantity,
} from '../../../../lib/shop.server.ts'

const failed = (error: unknown, fallback: string) =>
  json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 400 },
  )

export const Route = createFileRoute('/api/cart/items/$articleNumber')({
  server: {
    handlers: {
      PATCH: async ({ params, request }) => {
        const account = requireAccount()
        if (account instanceof Response) return account
        const body = (await request.json()) as { quantity?: number }
        try {
          return json(
            updateCartQuantity(
              account.loginId,
              params.articleNumber,
              Number(body.quantity),
            ),
          )
        } catch (error) {
          return failed(error, 'Menge konnte nicht geändert werden.')
        }
      },
      DELETE: ({ params }) => {
        const account = requireAccount()
        if (account instanceof Response) return account
        try {
          return json(removeFromCart(account.loginId, params.articleNumber))
        } catch (error) {
          return failed(error, 'Artikel konnte nicht entfernt werden.')
        }
      },
    },
  },
})
