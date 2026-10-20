// Tool-Contracts: Name, Beschreibung und Eingabe-Schema der Webshop-Tools.
//
// Ein Vertrag, drei Adapter:
// - Chat registriert sie als Tools des Vercel AI SDK (features/chat)
// - MCP ergänzt sie um die loginId und bietet sie externen Agenten an (features/mcp)
// - WebMCP registriert sie im Browser unter document.modelContext (features/webmcp)
//
// Die Beschreibungen sind für das Sprachmodell bestimmt: Sie sind das
// "User Interface" des Tools gegenüber dem Modell.

import { z } from 'zod'
import { MAX_LINE_QUANTITY } from '../shop-rules.ts'

export const searchProductsInput = z.object({
  term: z
    .string()
    .trim()
    .min(1)
    .describe(
      'Suchbegriff für Produkte im Katalog, z. B. "Milch" oder "Basmati".',
    ),
})

export const addToCartInput = z.object({
  articleNumber: z
    .string()
    .trim()
    .min(1)
    .describe('Exakte Artikelnummer aus einem Suchresultat.'),
  quantity: z
    .number()
    .int()
    .min(1)
    .max(MAX_LINE_QUANTITY)
    .default(1)
    .describe('Anzahl Verkaufseinheiten. Standard: 1.'),
})

export const removeFromCartInput = z.object({
  articleNumber: z
    .string()
    .trim()
    .min(1)
    .describe('Artikelnummer der zu entfernenden Position.'),
})

export const emptyInput = z.object({})

export const toolDescriptions = {
  searchProducts:
    'Sucht Produkte im Webshop-Katalog zu einem Suchbegriff und liefert die besten Treffer mit Artikelnummer und Preis.',
  getCart:
    'Liefert den aktuellen Inhalt des Warenkorbs mit Positionen, Mengen und Gesamtbetrag.',
  addToCart: 'Legt einen Artikel anhand seiner Artikelnummer in den Warenkorb.',
  removeFromCart:
    'Entfernt eine Position anhand ihrer Artikelnummer aus dem Warenkorb.',
  checkout:
    'Schliesst die Bestellung ab: Der Warenkorb wird als Bestellung abgeschickt und geleert. Nur nach ausdrücklicher Bestätigung durch die Benutzerin oder den Benutzer aufrufen.',
} as const

export type ToolName = keyof typeof toolDescriptions

/** JSON Schema (Draft 2020-12) eines Zod-Schemas, z. B. für WebMCP `registerTool`. */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema)
}
