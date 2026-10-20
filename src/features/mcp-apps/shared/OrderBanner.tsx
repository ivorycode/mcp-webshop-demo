import styles from '../webshop.module.css'
import { formatChf } from './tool-result.ts'
import type { CheckoutPayload } from './tool-result.ts'

export function OrderBanner({
  order,
  onClose,
}: {
  order: CheckoutPayload
  onClose: () => void
}) {
  return (
    <div className={styles.orderBannerContainer} role="status">
      <div className={styles.orderBannerBody}>
        <strong>Bestellung abgeschickt (Mock)</strong>
        <span>
          Bestellnummer: <strong>{order.orderId}</strong>
        </span>
        <span>
          Betrag: <strong>{formatChf(order.totalAmount)}</strong> (
          {order.totalItems} Artikel)
        </span>
      </div>
      <button
        type="button"
        className={styles.orderBannerCloseButton}
        onClick={onClose}
        aria-label="Bestätigung schliessen"
      >
        ×
      </button>
    </div>
  )
}
