// WebMCP: Die Webshop-Tools als native Browser-Tools der geöffneten Seite.
//
// Dieselben Contracts wie Chat und MCP; ausgeführt werden sie aber im Browser
// über die Web-API und damit mit der Session des sichtbaren Demo-Kontos.
// Nach jedem Aufruf informiert ein Shop-Event die Oberfläche, damit Suche,
// Warenkorb und Bestellungen ohne Reload nachziehen.

import type { z } from 'zod'
import {
  ApiRequestError,
  addToCart,
  checkoutCart,
  getCart,
  removeCartItem,
  search,
} from '../../lib/client-api.ts'
import {
  dispatchCartChanged,
  dispatchShopSearch,
} from '../../lib/shop-events.ts'
import {
  addToCartInput,
  emptyInput,
  removeFromCartInput,
  searchProductsInput,
  toJsonSchema,
  toolDescriptions,
} from '../../lib/tools/contracts.ts'
import type { ToolName } from '../../lib/tools/contracts.ts'
import type {
  CartResult,
  CheckoutToolResult,
  SearchProductsResult,
  ToolError,
} from '../../lib/tools/results.ts'

const MAX_SEARCH_RESULTS = 5

function toToolError(error: unknown): ToolError {
  if (error instanceof ApiRequestError && error.status === 401) {
    return {
      ok: false,
      error:
        'Nicht angemeldet. Zuerst eines der drei Demo-Konten im Webshop auswählen.',
    }
  }
  return {
    ok: false,
    error:
      error instanceof Error
        ? error.message
        : 'Die Tool-Ausführung ist fehlgeschlagen.',
  }
}

/** Baut ein WebMCP-Tool aus Contract, Annotationen und Ausführung. */
function defineTool<TSchema extends z.ZodObject>(
  name: ToolName,
  schema: TSchema,
  annotations: WebMCPToolAnnotations,
  run: (input: z.infer<TSchema>) => Promise<unknown>,
): WebMCPModelContextTool {
  return {
    name,
    description: toolDescriptions[name],
    inputSchema: toJsonSchema(schema),
    annotations,
    async execute(input) {
      const parsed = schema.safeParse(input)
      if (!parsed.success) {
        return {
          ok: false,
          error: `Ungültige Eingabe: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`,
        }
      }
      try {
        return await run(parsed.data)
      } catch (error) {
        return toToolError(error)
      }
    },
  }
}

export const shopTools: Array<WebMCPModelContextTool> = [
  defineTool(
    'searchProducts',
    searchProductsInput,
    // Suchresultate sind Katalogdaten, keine Anweisungen an den Agenten.
    { readOnlyHint: true, untrustedContentHint: true },
    async ({ term }): Promise<SearchProductsResult> => {
      const data = await search(term)
      dispatchShopSearch(data.searchTerm)
      const articles = data.articles.slice(0, MAX_SEARCH_RESULTS)
      return {
        ok: true,
        searchTerm: data.searchTerm,
        totalCount: data.totalCount,
        shownCount: articles.length,
        articles,
      }
    },
  ),
  defineTool(
    'getCart',
    emptyInput,
    { readOnlyHint: true },
    async (): Promise<CartResult> => ({
      ok: true,
      ...(await getCart()),
    }),
  ),
  defineTool(
    'addToCart',
    addToCartInput,
    { readOnlyHint: false },
    async ({ articleNumber, quantity }): Promise<CartResult> => {
      const cart = await addToCart(articleNumber, quantity)
      dispatchCartChanged()
      return {
        ok: true,
        ...cart,
        message: `${quantity} × ${articleNumber} wurde in den Warenkorb gelegt.`,
      }
    },
  ),
  defineTool(
    'removeFromCart',
    removeFromCartInput,
    { readOnlyHint: false },
    async ({ articleNumber }): Promise<CartResult> => {
      const cart = await removeCartItem(articleNumber)
      dispatchCartChanged()
      return {
        ok: true,
        ...cart,
        message: `Artikel ${articleNumber} entfernt.`,
      }
    },
  ),
  defineTool(
    'checkout',
    emptyInput,
    { readOnlyHint: false },
    async (): Promise<CheckoutToolResult> => {
      const { orderId, submittedAt, totalItems, totalAmount } =
        await checkoutCart()
      dispatchCartChanged()
      return { ok: true, orderId, submittedAt, totalItems, totalAmount }
    },
  ),
]

/**
 * Registriert alle Tools mit einem gemeinsamen AbortController.
 * Der zurückgegebene Cleanup meldet sie wieder ab (z. B. beim Unmount).
 */
export function registerShopTools(
  modelContext: WebMCPModelContext,
): () => void {
  const controller = new AbortController()
  for (const tool of shopTools) {
    modelContext
      .registerTool(tool, { signal: controller.signal })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.error(
          `WebMCP: registerTool(${tool.name}) fehlgeschlagen`,
          error,
        )
      })
  }
  return () => controller.abort()
}
