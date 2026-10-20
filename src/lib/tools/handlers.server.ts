// Tool-Handler: Führen die Contracts gegen das Shop-Modul aus und liefern
// die Resultat-Typen aus results.ts. Fehler werden als { ok: false } gemeldet,
// damit das Modell sie lesen kann, statt dass der Aufruf abbricht.
//
// Die Handler kennen keine Session und kein Protokoll. Der Adapter (Chat, MCP)
// liefert die loginId: beim Chat aus dem Session-Cookie, bei MCP als Argument.

import * as shop from '../shop.server.ts'
import type {
  SearchProductItem,
  CartData,
  CartResult,
  CheckoutToolResult,
  SearchProductsResult,
  ToolError,
} from './results.ts'
import type { SearchArticle } from '../types.ts'

const MAX_SEARCH_RESULTS = 5

function toolError(error: unknown, fallback: string): ToolError {
  return { ok: false, error: error instanceof Error ? error.message : fallback }
}

function toSearchProductItem(article: SearchArticle): SearchProductItem {
  const {
    articleNumber,
    celumId,
    description,
    brand,
    price,
    unitText,
    sellAmount,
    sellUnit,
  } = article
  return {
    articleNumber,
    celumId,
    description,
    brand,
    price,
    unitText,
    sellAmount,
    sellUnit,
  }
}

export const toolHandlers = {
  async searchProducts({
    term,
  }: {
    term: string
  }): Promise<SearchProductsResult> {
    try {
      const result = await shop.searchArticles(term)
      const articles = result.articles.slice(0, MAX_SEARCH_RESULTS)
      return {
        ok: true,
        searchTerm: result.searchTerm,
        totalCount: result.totalCount,
        shownCount: articles.length,
        articles: articles.map(toSearchProductItem),
      }
    } catch (error) {
      return toolError(error, 'Suche fehlgeschlagen.')
    }
  },

  getCart(loginId: string): CartData {
    return { ok: true, ...shop.getCart(loginId) }
  },

  async addToCart(
    loginId: string,
    input: { articleNumber: string; quantity?: number },
  ): Promise<CartResult> {
    try {
      const cart = await shop.addToCart(
        loginId,
        input.articleNumber,
        input.quantity ?? 1,
      )
      return { ok: true, ...cart }
    } catch (error) {
      return toolError(error, 'Hinzufügen fehlgeschlagen.')
    }
  },

  removeFromCart(
    loginId: string,
    input: { articleNumber: string },
  ): CartResult {
    try {
      return { ok: true, ...shop.removeFromCart(loginId, input.articleNumber) }
    } catch (error) {
      return toolError(error, 'Entfernen fehlgeschlagen.')
    }
  },

  checkout(loginId: string): CheckoutToolResult {
    try {
      const { orderId, submittedAt, totalItems, totalAmount } =
        shop.checkout(loginId)
      return { ok: true, orderId, submittedAt, totalItems, totalAmount }
    } catch (error) {
      return toolError(error, 'Checkout fehlgeschlagen.')
    }
  },
}
