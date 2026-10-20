import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { clearCart, getCart, requireAccount } from '../../lib/shop.server.ts'

export const Route = createFileRoute('/api/cart')({
  server: {
    handlers: {
      GET: () => {
        const account = requireAccount()
        if (account instanceof Response) return account
        return json(getCart(account.loginId))
      },
      DELETE: () => {
        const account = requireAccount()
        if (account instanceof Response) return account
        return json(clearCart(account.loginId))
      },
    },
  },
})
