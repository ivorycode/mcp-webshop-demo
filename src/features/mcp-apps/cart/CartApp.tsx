// MCP App «Warenkorb»: wird vom Host neben den Resultaten der Cart-Tools
// gerendert. Buttons rufen die MCP-Tools über app.callServerTool() direkt auf,
// ohne erneuten Modellentscheid, und melden die Aktion dem Host.

import { useApp, useHostStyles } from '@modelcontextprotocol/ext-apps/react'
import { useCallback, useState } from 'react'
import styles from '../webshop.module.css'
import { CartView } from '../shared/CartView.tsx'
import { OrderBanner } from '../shared/OrderBanner.tsx'
import {
  getCartPayload,
  getCheckoutPayload,
  getToolError,
} from '../shared/tool-result.ts'
import type {
  CartPayload,
  CheckoutPayload,
  ToolResultLike,
} from '../shared/tool-result.ts'

export function CartApp() {
  const [loginId, setLoginId] = useState<string | null>(null)
  const [cart, setCart] = useState<CartPayload | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [order, setOrder] = useState<CheckoutPayload | null>(null)

  // Ein Tool-Resultat ist entweder eine Bestellbestätigung (mit Warenkorb)
  // oder ein Warenkorb.
  const showToolResult = (toolResult: ToolResultLike) => {
    const checkoutData = getCheckoutPayload(toolResult)
    const cartData = checkoutData?.cart ?? getCartPayload(toolResult)
    if (!cartData) {
      setMessage(getToolError(toolResult) ?? 'Unerwartetes Resultat.')
      return
    }
    setLoginId(cartData.loginId)
    setCart(cartData)
    setMessage(null)
    if (checkoutData) setOrder(checkoutData)
  }

  const { app, error: connectError } = useApp({
    appInfo: { name: 'Webshop Warenkorb', version: '3.0.0' },
    capabilities: {},
    onAppCreated: (createdApp) => {
      createdApp.onteardown = async () => ({})
      createdApp.onerror = console.error
      createdApp.ontoolinput = (params) => {
        const login = params.arguments?.loginId
        if (typeof login === 'string') setLoginId(login)
      }
      createdApp.ontoolresult = showToolResult
    },
  })
  useHostStyles(app)

  const callCartTool = useCallback(
    async (name: string, args: Record<string, unknown>) => {
      if (!app || !loginId) return null
      setBusy(true)
      setMessage(null)
      try {
        const toolResult = await app.callServerTool({
          name,
          arguments: { loginId, ...args },
        })
        const error = getToolError(toolResult)
        if (error) setMessage(error)
        return error ? null : toolResult
      } catch (cause) {
        setMessage(
          cause instanceof Error
            ? cause.message
            : 'Tool-Aufruf fehlgeschlagen.',
        )
        return null
      } finally {
        setBusy(false)
      }
    },
    [app, loginId],
  )

  const removeLine = async (articleNumber: string) => {
    const toolResult = await callCartTool('removeFromCart', { articleNumber })
    const updated = toolResult && getCartPayload(toolResult)
    if (!updated) return
    setCart(updated)
    // Dem MCP Inspector fehlt die Capability updateModelContext für Kontextmeldungen.
    if (app?.getHostCapabilities()?.updateModelContext) {
      try {
        await app.updateModelContext({
          content: [
            {
              type: 'text',
              text: `Konto ${updated.loginId}: Artikel ${articleNumber} entfernt; noch ${updated.totalItems} Artikel.`,
            },
          ],
        })
      } catch (cause) {
        // Die Shop-Aktion ist bereits erfolgreich; nur die Host-Meldung scheitert.
        console.warn('Host-Benachrichtigung fehlgeschlagen:', cause)
      }
    }
  }

  const checkout = async () => {
    const toolResult = await callCartTool('checkout', {})
    const confirmation = toolResult && getCheckoutPayload(toolResult)
    if (!confirmation) return
    setOrder(confirmation)
    setCart(confirmation.cart)
    // Dem MCP Inspector fehlt die Capability message für Chat-Nachrichten.
    if (app?.getHostCapabilities()?.message) {
      try {
        await app.sendMessage({
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Bestellung ${confirmation.orderId} für Konto ${confirmation.loginId} wurde in der Webshop-UI abgeschickt. Bitte kurz bestätigen.`,
            },
          ],
        })
      } catch (cause) {
        // Die Shop-Aktion ist bereits erfolgreich; nur die Host-Meldung scheitert.
        console.warn('Host-Benachrichtigung fehlgeschlagen:', cause)
      }
    }
  }

  if (connectError) {
    return (
      <div className={styles.error}>
        <strong>Fehler:</strong> {connectError.message}
      </div>
    )
  }
  if (!app)
    return (
      <div className={styles.loading}>
        Verbindung zum Host wird hergestellt …
      </div>
    )

  return (
    <main className={styles.main}>
      <div className={styles.mainHeader}>
        <h2 className={`${styles.heading} ${styles.headingBrand}`}>
          Webshop Warenkorb
        </h2>
      </div>
      {loginId ? (
        <p className={styles.meta}>
          Demo-Konto: <code>{loginId}</code>
        </p>
      ) : (
        <div className={styles.error}>
          Bitte zuerst ein Demo-Konto im Gespräch nennen.
        </div>
      )}
      {order ? (
        <OrderBanner order={order} onClose={() => setOrder(null)} />
      ) : null}
      <CartView
        cart={cart}
        busy={busy}
        message={message}
        onRemove={removeLine}
        onCheckout={checkout}
      />
      {cart ? (
        <p className={styles.meta}>
          {cart.orders.length} Bestellung(en) im Verlauf.
        </p>
      ) : null}
    </main>
  )
}
