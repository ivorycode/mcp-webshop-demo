// MCP-Server des Webshops: Dieselben Contracts wie Chat und WebMCP, ergänzt um
// die loginId. Ein externer Agent hat keine Browser-Session; er nennt das
// Demo-Konto ausdrücklich. Dieser Server liefert nur Tools mit Text- und
// Datenresultaten, kein UI. Die MCP-App-Variante (features/mcp-apps/app-server.ts)
// registriert dieselben Tools mit UI-Metadaten und ergänzt die HTML-Resources.

import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { DEMO_ACCOUNTS, findAccount } from '../../lib/accounts.ts'
import * as shop from '../../lib/shop.server.ts'
import {
  addToCartInput,
  emptyInput,
  removeFromCartInput,
  searchProductsInput,
  toolDescriptions,
} from '../../lib/tools/contracts.ts'
import { toolHandlers } from '../../lib/tools/handlers.server.ts'
import type { CartResult } from '../../lib/tools/results.ts'

const loginIdInput = z
  .string()
  .trim()
  .min(1)
  .describe(
    `Login-ID eines Demo-Kontos: ${DEMO_ACCOUNTS.map((a) => a.loginId).join(', ')}.`,
  )

// Nur die Such-App braucht ein Konto für ihren «In den Warenkorb»-Button.
const searchWithLoginInput = searchProductsInput.extend({
  loginId: loginIdInput.optional(),
})

const withLoginId = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  schema.extend({ loginId: loginIdInput })

type ToolData = Record<string, unknown> & { ok: boolean }

/**
 * Wer das Resultat liest. `text`: nur das Modell, `app`: das Modell und eine
 * MCP App, die dieselben Daten bereits als UI zeigt.
 */
type ResultMode = 'text' | 'app'

/**
 * Hinweis an das Modell im App-Modus. Ohne ihn fasst ChatGPT die Daten, die
 * das Widget schon zeigt, zusätzlich als Text zusammen.
 */
export const APP_RESULT_HINT =
  'Die Daten werden dem Benutzer bereits in der App angezeigt. ' +
  'Liste sie nicht erneut auf, sondern beantworte nur die Frage und biete nächste Schritte an.'

/** MCP-Resultat: Text für das Modell, strukturierte Daten für Host und App. */
function toolResult(data: ToolData, text: string, mode: ResultMode) {
  const content =
    mode === 'app' && data.ok
      ? // Die App zeigt die Daten; das Modell soll sie nicht wiederholen.
        // structuredContent bleibt, damit Folgeaufrufe Artikelnummern kennen.
        [{ type: 'text' as const, text: `${text} ${APP_RESULT_HINT}` }]
      : // Manche Hosts geben nur content an das Modell weiter. Die Daten müssen
        // auch dort stehen, damit Folgeaufrufe z. B. Artikelnummern verwenden können.
        [
          { type: 'text' as const, text },
          { type: 'text' as const, text: JSON.stringify(data) },
        ]
  return {
    content,
    structuredContent: data,
    ...(data.ok ? {} : { isError: true }),
  }
}

function invalidLogin(loginId: string, mode: ResultMode) {
  const validAccounts = DEMO_ACCOUNTS.map((account) => account.loginId)
  return toolResult(
    {
      ok: false,
      error: `Unbekannte Login-ID "${loginId}".`,
      validAccounts: DEMO_ACCOUNTS,
    },
    `Unbekanntes Demo-Konto. Gültig sind: ${validAccounts.join(', ')}.`,
    mode,
  )
}

/** Prüft die loginId und reicht sie an den Handler weiter. */
function withAccount<TInput extends { loginId: string }>(
  mode: ResultMode,
  run: (
    loginId: string,
    input: TInput,
  ) => ReturnType<typeof toolResult> | Promise<ReturnType<typeof toolResult>>,
) {
  return (input: TInput) => {
    const account = findAccount(input.loginId)
    return account
      ? run(account.loginId, input)
      : invalidLogin(input.loginId, mode)
  }
}

/** Warenkorb-Daten für die Warenkorb-App: Resultat plus Konto und Bestellverlauf. */
function cartPayload<T extends CartResult>(loginId: string, data: T) {
  return { ...data, loginId, orders: shop.getOrders(loginId) }
}

export type ShopToolName =
  | 'searchProducts'
  | 'getCart'
  | 'addToCart'
  | 'removeFromCart'
  | 'checkout'
  | 'getOrders'

/** UI-Metadaten pro Tool; nur die MCP-App-Variante übergibt sie. */
export type ToolUiMeta = Record<ShopToolName, Record<string, unknown>>

/** Text-Server: nur Tools, keine Resources. */
export function buildMcpServer(): McpServer {
  const server = new McpServer({ name: 'webshop-mcp', version: '3.0.0' })
  registerShopTools(server)
  return server
}

/** Registriert die sechs Shop-Tools, mit uiMeta zusätzlich für MCP Apps. */
export function registerShopTools(server: McpServer, uiMeta?: ToolUiMeta) {
  const mode: ResultMode = uiMeta ? 'app' : 'text'
  const searchDescription = uiMeta
    ? `${toolDescriptions.searchProducts} Mit loginId kann die Such-App Artikel direkt in den Warenkorb legen.`
    : toolDescriptions.searchProducts
  server.registerTool(
    'searchProducts',
    {
      title: 'Produkte suchen',
      description: searchDescription,
      inputSchema: uiMeta ? searchWithLoginInput : searchProductsInput,
      annotations: { readOnlyHint: true, idempotentHint: true },
      _meta: uiMeta?.searchProducts,
    },
    async ({ term, loginId }: z.infer<typeof searchWithLoginInput>) => {
      if (loginId && !findAccount(loginId)) return invalidLogin(loginId, mode)
      const data = await toolHandlers.searchProducts({ term })
      return toolResult(
        uiMeta ? { ...data, loginId: loginId ?? null } : data,
        data.ok
          ? `${data.shownCount} Produkte für "${data.searchTerm}" gefunden.`
          : data.error,
        mode,
      )
    },
  )

  server.registerTool(
    'getCart',
    {
      title: 'Warenkorb anzeigen',
      description: toolDescriptions.getCart,
      inputSchema: withLoginId(emptyInput),
      annotations: { readOnlyHint: true, idempotentHint: true },
      _meta: uiMeta?.getCart,
    },
    withAccount(mode, (loginId) => {
      const data = cartPayload(loginId, toolHandlers.getCart(loginId))
      return toolResult(
        data,
        data.totalItems
          ? `Warenkorb enthält ${data.totalItems} Artikel.`
          : 'Der Warenkorb ist leer.',
        mode,
      )
    }),
  )

  server.registerTool(
    'addToCart',
    {
      title: 'Zum Warenkorb hinzufügen',
      description: toolDescriptions.addToCart,
      inputSchema: withLoginId(addToCartInput),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
      _meta: uiMeta?.addToCart,
    },
    withAccount(mode, async (loginId, { articleNumber, quantity }) => {
      const data = await toolHandlers.addToCart(loginId, {
        articleNumber,
        quantity,
      })
      return toolResult(
        cartPayload(loginId, data),
        data.ok ? `Artikel ${articleNumber} hinzugefügt.` : data.error,
        mode,
      )
    }),
  )

  server.registerTool(
    'removeFromCart',
    {
      title: 'Aus dem Warenkorb entfernen',
      description: toolDescriptions.removeFromCart,
      inputSchema: withLoginId(removeFromCartInput),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      },
      _meta: uiMeta?.removeFromCart,
    },
    withAccount(mode, (loginId, { articleNumber }) => {
      const data = toolHandlers.removeFromCart(loginId, { articleNumber })
      return toolResult(
        cartPayload(loginId, data),
        data.ok ? `Artikel ${articleNumber} entfernt.` : data.error,
        mode,
      )
    }),
  )

  server.registerTool(
    'checkout',
    {
      title: 'Bestellung abschliessen',
      description: toolDescriptions.checkout,
      inputSchema: withLoginId(emptyInput),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: uiMeta?.checkout,
    },
    withAccount(mode, (loginId) => {
      const data = toolHandlers.checkout(loginId)
      if (!data.ok) {
        return toolResult(cartPayload(loginId, data), data.error, mode)
      }
      // Nach dem Checkout zeigt die Warenkorb-App den (leeren) Warenkorb und
      // die Bestätigung; dafür liefert das Resultat beides.
      const cart = cartPayload(loginId, toolHandlers.getCart(loginId))
      return toolResult(
        { ...data, loginId, cart },
        `Bestellung ${data.orderId} übermittelt.`,
        mode,
      )
    }),
  )

  server.registerTool(
    'getOrders',
    {
      title: 'Bestellungen anzeigen',
      description: 'Zeigt die letzten Bestellungen des Demo-Kontos.',
      inputSchema: withLoginId(emptyInput),
      annotations: { readOnlyHint: true, idempotentHint: true },
      _meta: uiMeta?.getOrders,
    },
    withAccount(mode, (loginId) => {
      const data = cartPayload(loginId, toolHandlers.getCart(loginId))
      return toolResult(
        data,
        `${data.orders.length} Bestellungen gefunden.`,
        mode,
      )
    }),
  )
}
