// Resultat-Typen der Tools; die einzige Definition für Chat, MCP, MCP Apps
// und WebMCP. Bewusst klein: Das Modell bekommt nur, was es für die Antwort
// braucht (Token-Effizienz), die UI bekommt, was sie zum Rendern braucht
// (celumId für Bilder).

import type { CartItem, CartState } from '../types.ts'

export type ToolError = { ok: false; error: string }

export type SearchProductItem = Pick<
  CartItem,
  | 'articleNumber'
  | 'celumId'
  | 'description'
  | 'unitText'
  | 'sellAmount'
  | 'sellUnit'
> & { brand: string | null; price: number | null }

export type SearchProductsResult =
  | ToolError
  | {
      ok: true
      searchTerm: string
      totalCount: number
      shownCount: number
      articles: Array<SearchProductItem>
    }

export type CartData = { ok: true; message?: string } & CartState

export type CartResult = ToolError | CartData

export type CheckoutToolResult =
  | ToolError
  | {
      ok: true
      orderId: string
      submittedAt: string
      totalItems: number
      totalAmount: number
    }
