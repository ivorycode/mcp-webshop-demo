import { formatMoney } from '../../lib/media.ts'
import type { Order } from '../../lib/types.ts'

export function OrdersPanel({
  isLoggedIn,
  orders,
  isFetching,
  onRefresh,
}: {
  isLoggedIn: boolean
  orders: Array<Order>
  isFetching: boolean
  onRefresh: () => void
}) {
  return (
    <section className="island-panel rounded-[1.75rem] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="island-kicker mb-2">Aufträge</p>
          <h2 className="m-0 text-2xl font-semibold text-[var(--ink-strong)]">
            Letzte Aufträge
          </h2>
        </div>
        <button
          type="button"
          className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold"
          onClick={onRefresh}
          disabled={!isLoggedIn || isFetching}
        >
          Aktualisieren
        </button>
      </div>
      {!isLoggedIn ? (
        <p className="mt-4 text-sm text-[var(--ink-soft)]">
          Konto auswählen, um Aufträge zu sehen.
        </p>
      ) : !orders.length ? (
        <p className="mt-4 text-sm text-[var(--ink-soft)]">
          Noch keine Aufträge.
        </p>
      ) : null}
      <div className="mt-4 grid gap-3">
        {orders.map((order) => (
          <article
            key={order.orderId}
            className="rounded-xl border border-[var(--line)] bg-white/70 p-4"
          >
            <div className="flex justify-between gap-3">
              <strong>{order.orderId}</strong>
              <span>{formatMoney(order.totalAmount)}</span>
            </div>
            <p className="mt-1 text-xs text-[var(--ink-soft)]">
              {new Date(order.submittedAt).toLocaleString('de-CH')} ·{' '}
              {order.totalItems} Artikel
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
