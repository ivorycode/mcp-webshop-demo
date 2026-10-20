// Darstellung des Warenkorbs (rein präsentational). Wird von beiden Apps
// verwendet: in der Such-App als Zusammenfassung, in der Warenkorb-App als
// Hauptansicht mit Entfernen- und Bestellen-Aktionen.

import styles from '../webshop.module.css'
import { formatChf, productImageUrl } from './tool-result.ts'
import type { CartPayload } from './tool-result.ts'

export function CartView({
  cart,
  busy,
  message,
  onRemove,
  onCheckout,
  emptyMessage = 'Noch keine Artikel im Warenkorb.',
}: {
  cart: CartPayload | null
  busy: boolean
  message: string | null
  onRemove?: (articleNumber: string) => void
  onCheckout?: () => void
  emptyMessage?: string
}) {
  return (
    <section className={styles.cartSection} aria-labelledby="cart-heading">
      <h3 className={styles.cartHeading} id="cart-heading">
        Warenkorb
        {cart ? (
          <>
            {' '}
            · {cart.totalItems} Artikel · <code>{cart.loginId}</code>
          </>
        ) : null}
      </h3>
      {message ? <div className={styles.error}>{message}</div> : null}
      {cart === null ? (
        <p className={styles.meta}>
          {busy
            ? 'Warenkorb wird geladen …'
            : 'Noch kein Warenkorbresultat vorhanden.'}
        </p>
      ) : cart.items.length === 0 ? (
        <p className={styles.meta}>{emptyMessage}</p>
      ) : (
        <>
          <ul className={styles.cartList}>
            {cart.items.map((line) => {
              const image = productImageUrl(line.celumId)
              return (
                <li key={line.articleNumber} className={styles.cartLine}>
                  {image ? (
                    <img
                      className={styles.cartThumb}
                      src={image}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <div className={styles.cartThumb} />
                  )}
                  <div className={styles.cartLineBody}>
                    <div className={styles.cartLineTitle}>
                      {line.description}
                    </div>
                    <div className={styles.cartLineMeta}>
                      Art. {line.articleNumber} · {line.quantity} ×{' '}
                      {formatChf(line.price)} → {formatChf(line.lineTotal)}
                    </div>
                  </div>
                  <div className={styles.cartLineActions}>
                    {onRemove ? (
                      <button
                        type="button"
                        className={styles.removeLineButton}
                        disabled={busy}
                        onClick={() => onRemove(line.articleNumber)}
                      >
                        Entfernen
                      </button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
          <div className={styles.cartFooter}>
            <span className={styles.cartTotal}>
              Total {formatChf(cart.totalAmount)}
            </span>
            {onCheckout ? (
              <button
                type="button"
                className={styles.checkoutButton}
                disabled={busy || cart.items.length === 0}
                onClick={onCheckout}
              >
                Bestellung abschliessen
              </button>
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}
