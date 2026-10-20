// MCP-Server des Webshops: Dieselben Contracts wie Chat und WebMCP, ergänzt um
// die loginId. Ein externer Agent hat keine Browser-Session; er nennt das
// Demo-Konto ausdrücklich. Jedes Tool verweist zusätzlich auf eine MCP App
// (HTML-Resource), die ein geeigneter Host neben dem Resultat rendert.

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
import { registerUiResources } from '../mcp-apps/register-ui-resources.ts'
import {
  CART_UI_URI,
  SEARCH_UI_URI,
  uiToolMeta,
} from '../mcp-apps/resource-meta.ts'

const loginIdInput = z
  .string()
  .trim()
  .min(1)
  .describe(
    `Login-ID eines Demo-Kontos: ${DEMO_ACCOUNTS.map((a) => a.loginId).join(', ')}.`,
  )

const withLoginId = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  schema.extend({ loginId: loginIdInput })

type ToolData = Record<string, unknown> & { ok: boolean }

/** MCP-Resultat: Text für das Modell, strukturierte Daten für Host und App. */
function toolResult(data: ToolData, text: string) {
  return {
    // Manche Hosts geben nur content an das Modell weiter. Die Daten müssen
    // auch dort stehen, damit Folgeaufrufe z. B. Artikelnummern verwenden können.
    content: [
      { type: 'text' as const, text },
      { type: 'text' as const, text: JSON.stringify(data) },
    ],
    structuredContent: data,
    ...(data.ok ? {} : { isError: true }),
  }
}

function invalidLogin(loginId: string) {
  const validAccounts = DEMO_ACCOUNTS.map((account) => account.loginId)
  return toolResult(
    {
      ok: false,
      error: `Unbekannte Login-ID "${loginId}".`,
      validAccounts: DEMO_ACCOUNTS,
    },
    `Unbekanntes Demo-Konto. Gültig sind: ${validAccounts.join(', ')}.`,
  )
}

/** Prüft die loginId und reicht sie an den Handler weiter. */
function withAccount<TInput extends { loginId: string }>(
  run: (
    loginId: string,
    input: TInput,
  ) => ReturnType<typeof toolResult> | Promise<ReturnType<typeof toolResult>>,
) {
  return (input: TInput) => {
    const account = findAccount(input.loginId)
    return account ? run(account.loginId, input) : invalidLogin(input.loginId)
  }
}

/** Warenkorb-Daten für die Warenkorb-App: Resultat plus Konto und Bestellverlauf. */
function cartPayload<T extends CartResult>(loginId: string, data: T) {
  return { ...data, loginId, orders: shop.getOrders(loginId) }
}

export function buildMcpServer(): McpServer {
  const server = new McpServer({ name: 'webshop-mcp-app', version: '3.0.0' })

  server.registerTool(
    'searchProducts',
    {
      title: 'Produkte suchen',
      description: `${toolDescriptions.searchProducts} Mit loginId kann die Such-App Artikel direkt in den Warenkorb legen.`,
      // Die loginId wird nur an die Such-App durchgereicht, damit deren
      // «In den Warenkorb»-Button ein Konto kennt.
      inputSchema: searchProductsInput.extend({
        loginId: loginIdInput.optional(),
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
      _meta: uiToolMeta(SEARCH_UI_URI),
    },
    async ({ term, loginId }) => {
      if (loginId && !findAccount(loginId)) return invalidLogin(loginId)
      const data = await toolHandlers.searchProducts({ term })
      return toolResult(
        { ...data, loginId: loginId ?? null },
        data.ok
          ? `${data.shownCount} Produkte für "${data.searchTerm}" gefunden.`
          : data.error,
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
      _meta: uiToolMeta(CART_UI_URI),
    },
    withAccount((loginId) => {
      const data = cartPayload(loginId, toolHandlers.getCart(loginId))
      return toolResult(
        data,
        data.totalItems
          ? `Warenkorb enthält ${data.totalItems} Artikel.`
          : 'Der Warenkorb ist leer.',
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
      _meta: uiToolMeta(CART_UI_URI),
    },
    withAccount(async (loginId, { articleNumber, quantity }) => {
      const data = await toolHandlers.addToCart(loginId, {
        articleNumber,
        quantity,
      })
      return toolResult(
        cartPayload(loginId, data),
        data.ok ? `Artikel ${articleNumber} hinzugefügt.` : data.error,
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
      _meta: uiToolMeta(CART_UI_URI),
    },
    withAccount((loginId, { articleNumber }) => {
      const data = toolHandlers.removeFromCart(loginId, { articleNumber })
      return toolResult(
        cartPayload(loginId, data),
        data.ok ? `Artikel ${articleNumber} entfernt.` : data.error,
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
      _meta: uiToolMeta(CART_UI_URI),
    },
    withAccount((loginId) => {
      const data = toolHandlers.checkout(loginId)
      if (!data.ok) return toolResult(cartPayload(loginId, data), data.error)
      // Nach dem Checkout zeigt die Warenkorb-App den (leeren) Warenkorb und
      // die Bestätigung; dafür liefert das Resultat beides.
      const cart = cartPayload(loginId, toolHandlers.getCart(loginId))
      return toolResult(
        { ...data, loginId, cart },
        `Bestellung ${data.orderId} übermittelt.`,
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
      _meta: uiToolMeta(CART_UI_URI),
    },
    withAccount((loginId) => {
      const data = cartPayload(loginId, toolHandlers.getCart(loginId))
      return toolResult(data, `${data.orders.length} Bestellungen gefunden.`)
    }),
  )

  registerUiResources(server)
  return server
}
