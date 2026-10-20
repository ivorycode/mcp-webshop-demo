// Die Webshop-Tools als Tools des Vercel AI SDK, gebunden an die Session.
//
// Beschreibung und Eingabe-Schema kommen aus den gemeinsamen Contracts. Die
// loginId kommt aus dem Session-Cookie des angemeldeten Kontos, niemals vom
// Modell: Das Modell kann keinen fremden Warenkorb adressieren.

import { tool } from 'ai'
import type { InferUITools, UIDataTypes, UIMessage } from 'ai'
import {
  addToCartInput,
  emptyInput,
  removeFromCartInput,
  searchProductsInput,
  toolDescriptions,
} from '../../../lib/tools/contracts.ts'
import { toolHandlers } from '../../../lib/tools/handlers.server.ts'
import type { ToolError } from '../../../lib/tools/results.ts'
import { getCurrentAccount } from '../../../lib/session.server.ts'

const LOGIN_REQUIRED: ToolError = {
  ok: false,
  error:
    'Bitte zuerst ein Demo-Konto auswählen, um den Warenkorb zu verwenden.',
}

/** Bindet einen Handler an das Konto der aktuellen Browser-Session. */
function forSession<TInput, TResult>(
  run: (loginId: string, input: TInput) => TResult,
) {
  return (input: TInput): TResult | ToolError => {
    const account = getCurrentAccount()
    return account ? run(account.loginId, input) : LOGIN_REQUIRED
  }
}

export const shopTools = {
  searchProducts: tool({
    description: toolDescriptions.searchProducts,
    inputSchema: searchProductsInput,
    execute: (input) => toolHandlers.searchProducts(input),
  }),

  getCart: tool({
    description: toolDescriptions.getCart,
    inputSchema: emptyInput,
    execute: forSession((loginId) => toolHandlers.getCart(loginId)),
  }),

  addToCart: tool({
    description: toolDescriptions.addToCart,
    inputSchema: addToCartInput,
    execute: forSession((loginId, input) =>
      toolHandlers.addToCart(loginId, input),
    ),
  }),

  removeFromCart: tool({
    description: toolDescriptions.removeFromCart,
    inputSchema: removeFromCartInput,
    execute: forSession((loginId, input) =>
      toolHandlers.removeFromCart(loginId, input),
    ),
  }),

  // checkout hat Seiteneffekte: Die Freigabe erfolgt in chat-route.server.ts
  // über toolApproval (Human-in-the-loop), nicht im Tool selbst.
  checkout: tool({
    description: toolDescriptions.checkout,
    inputSchema: emptyInput,
    execute: forSession((loginId) => toolHandlers.checkout(loginId)),
  }),
}

/** UI-Nachricht mit typisierten Tool-Parts (tool-searchProducts, tool-getCart, ...). */
export type ShopUIMessage = UIMessage<
  never,
  UIDataTypes,
  InferUITools<typeof shopTools>
>
