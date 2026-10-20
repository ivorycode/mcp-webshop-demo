// Lesen der MCP-Tool-Resultate in den Apps. Die Basis-Typen kommen aus
// lib/tools/results.ts; der MCP-Server ergänzt loginId und Bestellverlauf.

import type { Order } from '../../../lib/types.ts'
import type {
  CartResult,
  CheckoutToolResult,
  SearchProductsResult,
} from '../../../lib/tools/results.ts'

export type { SearchProductItem } from '../../../lib/tools/results.ts'
export type { CartItem, Order } from '../../../lib/types.ts'

export type ToolResultLike = {
  isError?: boolean
  structuredContent?: Record<string, unknown>
  content?: Array<{ type: string; text?: string }>
}

export type SearchPayload = Extract<SearchProductsResult, { ok: true }> & {
  loginId: string | null
}
export type CartPayload = Extract<CartResult, { ok: true }> & {
  loginId: string
  orders: Array<Order>
}
export type CheckoutPayload = Extract<CheckoutToolResult, { ok: true }> & {
  loginId: string
  cart: CartPayload
}

const structured = (result: ToolResultLike) =>
  result.isError || !result.structuredContent ? null : result.structuredContent

export function getSearchPayload(result: ToolResultLike): SearchPayload | null {
  const data = structured(result)
  return data?.ok === true && Array.isArray(data.articles)
    ? (data as SearchPayload)
    : null
}

export function getCartPayload(result: ToolResultLike): CartPayload | null {
  const data = structured(result)
  return data?.ok === true &&
    typeof data.loginId === 'string' &&
    Array.isArray(data.items)
    ? (data as CartPayload)
    : null
}

export function getCheckoutPayload(
  result: ToolResultLike,
): CheckoutPayload | null {
  const data = structured(result)
  return data?.ok === true &&
    typeof data.orderId === 'string' &&
    typeof data.cart === 'object'
    ? (data as CheckoutPayload)
    : null
}

export function getToolError(result: ToolResultLike): string | null {
  const fromStructured = result.structuredContent?.error
  if (typeof fromStructured === 'string') return fromStructured
  if (result.isError) {
    return (
      result.content?.find((block) => block.type === 'text')?.text ??
      'Tool-Aufruf fehlgeschlagen.'
    )
  }
  return null
}

const chf = new Intl.NumberFormat('de-CH', {
  style: 'currency',
  currency: 'CHF',
})

export function formatChf(value: number | null): string {
  return value === null ? '–' : chf.format(value)
}

/** Die Apps laufen in einem fremden Host und laden Bilder immer vom Live-Origin. */
export function productImageUrl(celumId: string | null): string | null {
  return celumId
    ? `https://webshop.transgourmet.ch/shop/productimages/article/${celumId}.jpg`
    : null
}
