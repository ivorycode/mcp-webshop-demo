// Klassischer Webshop: Suche, Artikeldetail, Warenkorb, Aufträge, Demo-Login.
//
// Diese Route ist die Ausgangsbasis des Workshops und enthält keine KI. Sie
// reagiert aber auf die Shop-Events aus lib/shop-events.ts, über die Chat und
// WebMCP die sichtbare Oberfläche steuern.

import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArticleDetailPanel } from '../components/shop/ArticleDetailPanel.tsx'
import { CartPanel } from '../components/shop/CartPanel.tsx'
import { LoginDialog } from '../components/shop/LoginDialog.tsx'
import { OrdersPanel } from '../components/shop/OrdersPanel.tsx'
import { SearchPanel } from '../components/shop/SearchPanel.tsx'
import * as api from '../lib/client-api.ts'
import {
  SHOP_CART_CHANGED_EVENT,
  SHOP_SEARCH_EVENT,
} from '../lib/shop-events.ts'
import { useHydrated } from '../lib/use-hydrated.ts'

export const Route = createFileRoute('/')({ component: App })

function App() {
  const isHydrated = useHydrated()
  const queryClient = useQueryClient()

  const [searchInput, setSearchInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [selectedArticleNumber, setSelectedArticleNumber] = useState<
    string | null
  >(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [isLoginOpen, setIsLoginOpen] = useState(false)

  const applySearchTerm = (term: string) => {
    const nextTerm = term.trim()
    setSearchInput(nextTerm)
    setActiveSearch(nextTerm)
    setSelectedArticleNumber(null)
    setFlash(null)
  }

  const sessionQuery = useQuery({
    queryKey: ['session'],
    queryFn: api.getSession,
    enabled: isHydrated,
  })
  // Ein anderer Teil des Baums kann den gemeinsamen Query-Cache bereits
  // gefüllt haben. Während der eigenen Hydration trotzdem das SSR-Bild zeigen.
  const account = isHydrated ? (sessionQuery.data?.account ?? null) : null
  const isLoggedIn = account !== null

  const cartQuery = useQuery({
    queryKey: ['cart'],
    queryFn: api.getCart,
    enabled: isHydrated && isLoggedIn,
  })
  const ordersQuery = useQuery({
    queryKey: ['orders'],
    queryFn: api.getOrders,
    enabled: isHydrated && isLoggedIn,
  })
  const searchQuery = useQuery({
    queryKey: ['search', activeSearch],
    queryFn: () => api.search(activeSearch),
    enabled: isHydrated && activeSearch.length > 0,
    staleTime: 60_000,
  })
  const detailQuery = useQuery({
    queryKey: ['article', selectedArticleNumber],
    queryFn: () => api.getArticle(selectedArticleNumber as string),
    enabled: isHydrated && selectedArticleNumber !== null,
  })

  const invalidate = (...keys: Array<string>) =>
    Promise.all(
      keys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
    )

  const loginMutation = useMutation({
    mutationFn: api.login,
    onSuccess: async ({ account: loggedIn }) => {
      setFlash(`Angemeldet als ${loggedIn.name}.`)
      setIsLoginOpen(false)
      await invalidate('session', 'cart', 'orders')
    },
  })
  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSuccess: async () => {
      setFlash(
        'Abgemeldet. Der Server hält die Warenkörbe pro Demo-Konto getrennt.',
      )
      setIsLoginOpen(false)
      await invalidate('session', 'cart', 'orders')
    },
  })
  const addMutation = useMutation({
    mutationFn: (articleNumber: string) => api.addToCart(articleNumber, 1),
    onSuccess: async () => {
      setFlash('Artikel wurde zum Warenkorb hinzugefügt.')
      await invalidate('cart')
    },
  })
  const quantityMutation = useMutation({
    mutationFn: ({
      articleNumber,
      quantity,
    }: {
      articleNumber: string
      quantity: number
    }) => api.updateCartItem(articleNumber, quantity),
    onSuccess: () => invalidate('cart'),
  })
  const removeMutation = useMutation({
    mutationFn: api.removeCartItem,
    onSuccess: () => invalidate('cart'),
  })
  const clearMutation = useMutation({
    mutationFn: api.clearCart,
    onSuccess: async () => {
      setFlash('Warenkorb wurde geleert.')
      await invalidate('cart')
    },
  })
  const checkoutMutation = useMutation({
    mutationFn: api.checkoutCart,
    onSuccess: async (order) => {
      setFlash(
        `Bestellung erfolgreich übermittelt. Bestellnummer: ${order.orderId}.`,
      )
      await invalidate('cart', 'orders')
    },
  })

  const searchResults = searchQuery.data?.articles ?? []

  // Suchbegriff aus der URL (?q=) übernehmen und dort nachführen.
  useEffect(() => {
    if (!isHydrated) return
    const readTermFromUrl = () =>
      applySearchTerm(new URL(window.location.href).searchParams.get('q') ?? '')
    readTermFromUrl()
    window.addEventListener('popstate', readTermFromUrl)
    return () => window.removeEventListener('popstate', readTermFromUrl)
  }, [isHydrated])

  useEffect(() => {
    if (!isHydrated) return
    const url = new URL(window.location.href)
    if (activeSearch) url.searchParams.set('q', activeSearch)
    else url.searchParams.delete('q')
    window.history.replaceState({}, '', url)
  }, [activeSearch, isHydrated])

  // Shop-Events: Chat und WebMCP steuern Suche und Warenkorb dieser Seite.
  useEffect(() => {
    if (!isHydrated) return
    // Für diese Demo löst der Client nach der Suche im Chat oder via WebMCP
    // bewusst eine zweite Suche für die Shop-Anzeige aus, sofern keine frischen
    // Ergebnisse im Query-Cache liegen. Das hält die Synchronisierung einfach:
    // Das Event überträgt nur den Suchbegriff.
    // Mögliche Optimierungen: vollständige Suchergebnisse an den Query-Cache
    // übergeben oder die Katalogabfragen serverseitig cachen. Die auf fünf Treffer
    // gekürzten Chat-Ergebnisse reichen zum Befüllen des Shop-Caches nicht aus.
    const onSearch = (event: Event) =>
      applySearchTerm(
        (event as CustomEvent<{ term?: string }>).detail.term ?? '',
      )
    const onCartChanged = () => void invalidate('cart', 'orders')
    window.addEventListener(SHOP_SEARCH_EVENT, onSearch)
    window.addEventListener(SHOP_CART_CHANGED_EVENT, onCartChanged)
    return () => {
      window.removeEventListener(SHOP_SEARCH_EVENT, onSearch)
      window.removeEventListener(SHOP_CART_CHANGED_EVENT, onCartChanged)
    }
  }, [isHydrated])

  const cartMutationError =
    addMutation.error ??
    quantityMutation.error ??
    removeMutation.error ??
    clearMutation.error ??
    checkoutMutation.error

  return (
    <>
      <main className="page-wrap px-4 pb-12 pt-8">
        <section className="hero-panel rise-in rounded-xl px-6 py-7 sm:px-8 sm:py-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_320px] lg:items-start">
            <div>
              <p className="island-kicker mb-3">
                Schweizer Grosshandel Katalog
              </p>
              <h1 className="display-title mb-4 max-w-4xl text-4xl leading-[0.98] font-bold tracking-tight text-[var(--ink-strong)] sm:text-6xl">
                Demo Web Shop
              </h1>
            </div>
            <aside className="hero-aside rounded-lg border border-[var(--line)] px-4 py-3.5">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
                Aktives Konto
              </p>
              <p className="mt-1 text-base font-semibold text-[var(--ink-strong)]">
                {account?.name ?? 'Nicht angemeldet'}
              </p>
              <button
                type="button"
                className="mt-3 rounded-md border border-[var(--line)] bg-white px-4 py-1.5 text-sm font-semibold text-[var(--ink-strong)] transition hover:border-[var(--line-strong)] hover:bg-[var(--link-bg-hover)]"
                onClick={() => setIsLoginOpen(true)}
              >
                {account ? 'Konto wechseln' : 'Anmelden'}
              </button>
            </aside>
          </div>
        </section>

        {flash ? (
          <section className="mt-5 rounded-2xl border border-[rgba(42,130,102,0.28)] bg-[rgba(248,252,243,0.85)] px-4 py-3 text-sm text-[var(--ink-strong)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{flash}</span>
              <button
                type="button"
                className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold text-[var(--ink-soft)]"
                onClick={() => setFlash(null)}
              >
                Schliessen
              </button>
            </div>
          </section>
        ) : null}

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
          <div className="space-y-6">
            <SearchPanel
              searchInput={searchInput}
              onSearchInputChange={setSearchInput}
              activeSearch={activeSearch}
              onSearch={applySearchTerm}
              isFetching={searchQuery.isFetching}
              totalCount={searchQuery.data?.totalCount ?? 0}
              error={searchQuery.error}
              articles={searchResults}
              selectedArticleNumber={selectedArticleNumber}
              onSelectArticle={setSelectedArticleNumber}
              onAddToCart={addMutation.mutate}
              canAddToCart={isLoggedIn && !addMutation.isPending}
            />
            <OrdersPanel
              isLoggedIn={isLoggedIn}
              orders={ordersQuery.data?.orders ?? []}
              isFetching={ordersQuery.isFetching}
              onRefresh={() => void ordersQuery.refetch()}
            />
          </div>

          <div className="space-y-6">
            <ArticleDetailPanel
              articleNumber={selectedArticleNumber}
              article={detailQuery.data}
              fallback={
                searchResults.find(
                  (a) => a.articleNumber === selectedArticleNumber,
                ) ?? null
              }
              isPending={detailQuery.isPending}
              error={detailQuery.error}
              onClose={() => setSelectedArticleNumber(null)}
              onAddToCart={addMutation.mutate}
              canAddToCart={isLoggedIn && !addMutation.isPending}
            />
            <CartPanel
              isLoggedIn={isLoggedIn}
              cart={cartQuery.data}
              isPending={cartQuery.isPending}
              error={cartQuery.error}
              onChangeQuantity={(articleNumber, quantity) =>
                quantityMutation.mutate({ articleNumber, quantity })
              }
              onRemove={removeMutation.mutate}
              onClear={() => clearMutation.mutate()}
              onCheckout={() => checkoutMutation.mutate()}
              isClearing={clearMutation.isPending}
              isCheckingOut={checkoutMutation.isPending}
              mutationError={cartMutationError}
            />
          </div>
        </section>
      </main>

      {isLoginOpen ? (
        <LoginDialog
          account={account}
          onLogin={(loginId) => {
            setFlash(null)
            loginMutation.mutate(loginId)
          }}
          onLogout={() => {
            setFlash(null)
            logoutMutation.mutate()
          }}
          onClose={() => setIsLoginOpen(false)}
          isPending={loginMutation.isPending || logoutMutation.isPending}
          error={loginMutation.error ?? logoutMutation.error}
        />
      ) : null}
    </>
  )
}
