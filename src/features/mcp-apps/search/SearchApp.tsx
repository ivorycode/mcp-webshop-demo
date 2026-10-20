// MCP App «Produktsuche»: wird vom Host neben dem searchProducts-Resultat
// gerendert. Suche und «In den Warenkorb» rufen die MCP-Tools über
// app.callServerTool() direkt auf. Ohne loginId bleibt das Hinzufügen
// deaktiviert; die App hat bewusst keine Kontoauswahl.

import { useApp, useHostStyles } from '@modelcontextprotocol/ext-apps/react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import styles from '../webshop.module.css'
import { CartView } from '../shared/CartView.tsx'
import {
  getCartPayload,
  getSearchPayload,
  getToolError,
} from '../shared/tool-result.ts'
import type { CartPayload, SearchPayload } from '../shared/tool-result.ts'
import { ProductCard } from './ProductCard.tsx'

export function SearchApp() {
  const [query, setQuery] = useState('')
  const [loginId, setLoginId] = useState<string | null>(null)
  const [payload, setPayload] = useState<SearchPayload | null>(null)
  const [cart, setCart] = useState<CartPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const showSearchResult = (data: SearchPayload) => {
    setPayload(data)
    setQuery(data.searchTerm)
    setLoginId(data.loginId)
    setMessage(null)
  }

  const { app, error: connectError } = useApp({
    appInfo: { name: 'Webshop Produktsuche', version: '3.0.0' },
    capabilities: {},
    onAppCreated: (createdApp) => {
      createdApp.onteardown = async () => ({})
      createdApp.onerror = console.error
      createdApp.ontoolinput = (params) => {
        const term = params.arguments?.term
        const login = params.arguments?.loginId
        if (typeof term === 'string') setQuery(term)
        setLoginId(typeof login === 'string' ? login : null)
      }
      createdApp.ontoolresult = (toolResult) => {
        const data = getSearchPayload(toolResult)
        if (data) showSearchResult(data)
        else setMessage(getToolError(toolResult) ?? 'Unerwartetes Resultat.')
        setLoading(false)
      }
    },
  })
  useHostStyles(app)

  const runSearch = async (term: string) => {
    if (!app || !term.trim()) return
    setLoading(true)
    setMessage(null)
    try {
      const toolResult = await app.callServerTool({
        name: 'searchProducts',
        arguments: { term: term.trim(), ...(loginId ? { loginId } : {}) },
      })
      const data = getSearchPayload(toolResult)
      if (!data)
        throw new Error(getToolError(toolResult) ?? 'Unerwartetes Resultat.')
      showSearchResult(data)
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : 'Suche fehlgeschlagen.',
      )
    } finally {
      setLoading(false)
    }
  }

  const addToCart = async (articleNumber: string, quantity: number) => {
    if (!app || !loginId) return
    setLoading(true)
    setMessage(null)
    try {
      const toolResult = await app.callServerTool({
        name: 'addToCart',
        arguments: { loginId, articleNumber, quantity },
      })
      const updated = getCartPayload(toolResult)
      if (!updated)
        throw new Error(
          getToolError(toolResult) ??
            'Artikel konnte nicht hinzugefügt werden.',
        )
      setCart(updated)
      // Dem MCP Inspector fehlt die Capability updateModelContext für Kontextmeldungen.
      if (app.getHostCapabilities()?.updateModelContext) {
        try {
          await app.updateModelContext({
            content: [
              {
                type: 'text',
                text: `Konto ${loginId}: ${quantity} × Artikel ${articleNumber} hinzugefügt; nun ${updated.totalItems} Artikel im Warenkorb.`,
              },
            ],
          })
        } catch (cause) {
          // Die Shop-Aktion ist bereits erfolgreich; nur die Host-Meldung scheitert.
          console.warn('Host-Benachrichtigung fehlgeschlagen:', cause)
        }
      }
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : 'Artikel konnte nicht hinzugefügt werden.',
      )
    } finally {
      setLoading(false)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void runSearch(query)
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
          Webshop Produktsuche
        </h2>
      </div>
      <form className={styles.searchRow} onSubmit={submit}>
        <input
          className={styles.searchInput}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="z. B. Milch, Kaffee, Tomaten"
        />
        <button
          className={styles.searchButton}
          type="submit"
          disabled={loading || !query.trim()}
        >
          {loading ? '…' : 'Suchen'}
        </button>
      </form>
      {!loginId ? (
        <div className={styles.error}>
          Nenne dem Assistenten eines der drei Demo-Konten, um Artikel
          hinzuzufügen. In dieser App gibt es bewusst keine Kontoauswahl.
        </div>
      ) : null}
      {message ? <div className={styles.error}>{message}</div> : null}
      {payload ? (
        <p className={styles.meta}>
          {payload.shownCount} von {payload.totalCount} Treffern für "
          {payload.searchTerm}"
        </p>
      ) : null}
      {payload?.articles.length ? (
        <div className={styles.grid}>
          {payload.articles.map((product) => (
            <ProductCard
              key={product.articleNumber}
              product={product}
              disabled={loading || !loginId}
              onAdd={addToCart}
            />
          ))}
        </div>
      ) : null}
      <CartView cart={cart} busy={loading} message={null} />
    </main>
  )
}
