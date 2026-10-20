import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { addToCart, requireAccount } from '../../../lib/shop.server.ts'
import { MAX_LINE_QUANTITY, isValidQuantity } from '../../../lib/shop-rules.ts'

export const Route = createFileRoute('/api/cart/items')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const account = requireAccount()
        if (account instanceof Response) return account

        const body = (await request.json()) as {
          articleNumber?: string
          quantity?: number
        }
        const articleNumber = body.articleNumber?.trim() ?? ''
        const quantity = Number(body.quantity ?? 1)
        if (!articleNumber)
          return json({ error: 'Artikelnummer fehlt.' }, { status: 400 })
        if (!isValidQuantity(quantity)) {
          return json(
            {
              error: `Die Menge muss eine Ganzzahl zwischen 1 und ${MAX_LINE_QUANTITY} sein.`,
            },
            { status: 400 },
          )
        }

        try {
          return json(await addToCart(account.loginId, articleNumber, quantity))
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Artikel konnte nicht hinzugefügt werden.',
            },
            { status: 502 },
          )
        }
      },
    },
  },
})
