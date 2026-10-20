// Serverseitiges Shop-Modul: Katalog plus Warenkorb und Bestellungen im
// Prozessspeicher. Web-API, Chat-Tools und MCP-Server rufen ausschliesslich
// diese Funktionen auf.

import { json } from '@tanstack/react-start'
import { getArticleDetail, searchArticles } from './catalog.server.ts'
import { getCurrentAccount } from './session.server.ts'
import * as state from './shop-state.ts'
import type { DemoAccount } from './accounts.ts'
import type { CartState } from './types.ts'

export { getArticleDetail, searchArticles }
export const {
  getCart,
  updateCartQuantity,
  removeFromCart,
  clearCart,
  checkout,
  getOrders,
} = state

/** Legt einen Artikel aus dem Katalog in den Warenkorb des Kontos. */
export async function addToCart(
  loginId: string,
  articleNumber: string,
  quantity: number,
): Promise<CartState> {
  const article = await getArticleDetail(articleNumber)
  return state.addToCart(loginId, article, quantity)
}

/** Liefert das Konto der Browser-Session oder eine 401-Antwort für die Web-API. */
export function requireAccount(): DemoAccount | Response {
  return (
    getCurrentAccount() ??
    json(
      {
        error:
          'Bitte zuerst ein Demo-Konto auswählen, um den Warenkorb zu verwenden.',
      },
      { status: 401 },
    )
  )
}
