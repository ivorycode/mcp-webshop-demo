import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { getCart, getSession } from '../lib/client-api.ts'
import { subscribeToCartChanges } from '../lib/shop-events.ts'
import { useHydrated } from '../lib/use-hydrated.ts'

export default function Header() {
  const isHydrated = useHydrated()
  const queryClient = useQueryClient()

  const sessionQuery = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    enabled: isHydrated,
  })

  const cartQuery = useQuery({
    queryKey: ['cart'],
    queryFn: getCart,
    enabled: isHydrated && Boolean(sessionQuery.data?.account),
  })

  // Ein anderer Teil des Baums kann den gemeinsamen Query-Cache bereits
  // gefüllt haben. Während der eigenen Hydration trotzdem das SSR-Bild zeigen.
  const account = isHydrated ? (sessionQuery.data?.account ?? null) : null
  const cartPositionCount = account ? (cartQuery.data?.items.length ?? 0) : 0

  useEffect(
    () =>
      subscribeToCartChanges(() => {
        void queryClient.invalidateQueries({ queryKey: ['cart'] })
      }),
    [queryClient],
  )

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--header-bg)] px-4 shadow-[0_4px_18px_rgba(17,24,39,0.06)]">
      <div className="header-accent" />
      <nav className="page-wrap relative flex flex-wrap items-center gap-x-4 gap-y-3 py-3 pr-14 sm:py-4 sm:pr-64">
        <div className="absolute top-3 right-0 flex items-center gap-2 sm:top-4">
          {account ? (
            <span
              className="hidden max-w-44 items-center gap-2 truncate rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-xs font-semibold text-[var(--sea-ink-soft)] sm:inline-flex"
              title={account.name}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                width="16"
                height="16"
                className="shrink-0"
              >
                <path
                  fill="currentColor"
                  d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm-8 9a8 8 0 0 1 16 0H4Z"
                />
              </svg>
              <span className="truncate">{account.name}</span>
            </span>
          ) : null}
          <Link
            to="/"
            hash="cart"
            className="header-icon relative inline-flex rounded-md border border-transparent p-2 text-[var(--sea-ink-soft)]"
            aria-label={`${cartPositionCount} ${cartPositionCount === 1 ? 'Position' : 'Positionen'} im Warenkorb`}
          >
            {cartPositionCount > 0 ? (
              <span className="absolute -top-1 -right-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full border border-white bg-[var(--lagoon)] px-1 text-[0.65rem] font-bold leading-none text-white shadow-[0_6px_14px_rgba(217,31,38,0.28)]">
                {cartPositionCount}
              </span>
            ) : null}
            <svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22">
              <path
                fill="currentColor"
                d="M3 4h2.2c.5 0 1 .3 1.1.8l.5 2.2H20a1 1 0 0 1 1 1.2l-1.3 6.2a1.5 1.5 0 0 1-1.5 1.2H9.1a1.5 1.5 0 0 1-1.5-1.2L5.7 6H3V4zm6.6 14a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4zm7 0a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4z"
              />
            </svg>
          </Link>
        </div>

        <h2 className="m-0 flex-shrink-0 text-base font-semibold tracking-tight">
          <Link
            to="/"
            className="brand-lockup inline-flex items-center gap-3 rounded-md border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-sm text-[var(--sea-ink)] no-underline sm:px-4"
          >
            <span className="brand-mark" aria-hidden="true" />
            <span>
              <strong className="block text-[0.95rem] leading-none">
                Demo Web Shop
              </strong>
              <span className="mt-1 block text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--sea-ink-soft)]">
                Schweizer Grosshandel
              </span>
            </span>
          </Link>
        </h2>

        <div className="ml-auto flex items-center gap-1.5 sm:ml-0 sm:gap-2">
          <a
            href="https://web.transgourmet.ch/de/webshop"
            target="_blank"
            rel="noreferrer"
            className="header-icon hidden rounded-md border border-transparent p-2 text-[var(--sea-ink-soft)] sm:block"
          >
            <span className="sr-only">Transgourmet-Webshop öffnen</span>
            <svg viewBox="0 0 24 24" aria-hidden="true" width="24" height="24">
              <path
                fill="currentColor"
                d="M4 5h16v2H4V5zm2 4h12v10H6V9zm4 2v2h4v-2h-4z"
              />
            </svg>
          </a>
        </div>

        <div className="order-3 flex w-full flex-wrap items-center gap-x-6 gap-y-2 border-t border-[var(--line)] pt-3 text-sm font-semibold sm:order-2 sm:w-auto sm:border-t-0 sm:pt-0">
          <Link
            to="/"
            className="nav-link"
            activeProps={{ className: 'nav-link is-active' }}
          >
            Shop
          </Link>
          <Link
            to="/about"
            className="nav-link"
            activeProps={{ className: 'nav-link is-active' }}
          >
            Hinweise
          </Link>
          <Link
            to="/chat"
            className="nav-link"
            activeProps={{ className: 'nav-link is-active' }}
          >
            Shop Chat
          </Link>
        </div>
      </nav>
    </header>
  )
}
