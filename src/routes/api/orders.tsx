import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getOrders, requireAccount } from '../../lib/shop.server.ts'

export const Route = createFileRoute('/api/orders')({
  server: {
    handlers: {
      GET: () => {
        const account = requireAccount()
        if (account instanceof Response) return account
        return json({ orders: getOrders(account.loginId) })
      },
    },
  },
})
