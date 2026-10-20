import { formatMoney } from '../../lib/media.ts'
import type { CartState } from '../../lib/types.ts'
import { ArticleImage } from './ArticleIcons.tsx'

type CartPanelProps = {
  isLoggedIn: boolean
  cart: CartState | undefined
  isPending: boolean
  error: Error | null
  onChangeQuantity: (articleNumber: string, quantity: number) => void
  onRemove: (articleNumber: string) => void
  onClear: () => void
  onCheckout: () => void
  isClearing: boolean
  isCheckingOut: boolean
  mutationError: Error | null
}

export function CartPanel(props: CartPanelProps) {
  const cart = props.isLoggedIn ? props.cart : undefined
  const items = cart?.items ?? []
  const totalItems = cart?.totalItems ?? 0
  return (
    <section id="cart" className="panel scroll-mt-28 rounded-[1.75rem] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="island-kicker mb-2">Warenkorb</p>
          <h2 className="m-0 text-2xl font-semibold text-[var(--ink-strong)]">
            Warenkorb
          </h2>
        </div>
        <div className="text-right text-sm text-[var(--ink-soft)]">
          <div>
            {totalItems} {totalItems === 1 ? 'Position' : 'Positionen'}
          </div>
          <div className="text-lg font-semibold text-[var(--ink-strong)]">
            {formatMoney(cart?.totalAmount)}
          </div>
        </div>
      </div>

      {!props.isLoggedIn ? (
        <p className="mt-5 text-sm text-[var(--ink-soft)]">
          Wähle ein Demo-Konto, um einen eigenen Warenkorb zu erstellen und zu
          verwalten.
        </p>
      ) : props.isPending ? (
        <p className="mt-5 text-sm text-[var(--ink-soft)]">
          Warenkorb wird geladen...
        </p>
      ) : props.error ? (
        <p className="mt-5 text-sm font-medium text-[var(--alert)]">
          {props.error.message}
        </p>
      ) : (
        <>
          <div className="mt-5 space-y-3">
            {items.map((item) => (
              <article
                key={item.articleNumber}
                className="rounded-[1.4rem] border border-[var(--line)] bg-white/72 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <ArticleImage
                      celumId={item.celumId}
                      alt={item.description}
                      className="cart-thumb"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--ink-strong)]">
                        {item.description}
                      </div>
                      <div className="mt-1 text-xs text-[var(--ink-soft)]">
                        {item.articleNumber} · {item.sellAmount ?? '-'}{' '}
                        {item.sellUnit ?? ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-[var(--ink-strong)]">
                    {formatMoney(item.lineTotal)}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[rgba(255,255,255,0.72)] px-2 py-1">
                    <button
                      type="button"
                      className="quantity-button"
                      onClick={() =>
                        props.onChangeQuantity(
                          item.articleNumber,
                          item.quantity - 1,
                        )
                      }
                    >
                      -
                    </button>
                    <span className="min-w-8 text-center text-sm font-semibold text-[var(--ink-strong)]">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      className="quantity-button"
                      onClick={() =>
                        props.onChangeQuantity(
                          item.articleNumber,
                          item.quantity + 1,
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className="text-sm font-semibold text-[var(--alert)]"
                    onClick={() => props.onRemove(item.articleNumber)}
                  >
                    Entfernen
                  </button>
                </div>
              </article>
            ))}
          </div>

          {!items.length ? (
            <p className="mt-5 text-sm text-[var(--ink-soft)]">
              Der Warenkorb ist leer. Füge einen Artikel aus den Suchergebnissen
              oder aus der Detailansicht hinzu.
            </p>
          ) : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className="rounded-2xl border border-[var(--line)] bg-white/70 px-5 py-3 text-sm font-semibold text-[var(--ink-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={props.onClear}
              disabled={!items.length || props.isClearing}
            >
              {props.isClearing ? 'Leeren...' : 'Warenkorb leeren'}
            </button>
            <button
              type="button"
              className="action-button rounded-2xl px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              onClick={props.onCheckout}
              disabled={!items.length || props.isCheckingOut}
            >
              {props.isCheckingOut ? 'Senden...' : 'Warenkorb senden'}
            </button>
          </div>

          {props.mutationError ? (
            <p className="mt-4 text-sm font-medium text-[var(--alert)]">
              {props.mutationError.message}
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}
