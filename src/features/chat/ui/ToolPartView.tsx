// Workspace-Modus: Tool-Parts werden als Widgets direkt im Chat dargestellt.
// Die eindeutigen Buttons «In den Warenkorb» und «Bestellung abschliessen»
// rufen die Shop-API direkt auf, ohne Umweg über das Modell.

import { getToolName, isToolUIPart } from 'ai'
import { articleImageUrl, formatMoney } from '../../../lib/media.ts'
import type { ShopPart } from './assistant-mode.ts'

export type WidgetActions = {
  onAddArticle: (articleNumber: string) => void
  onCheckout: () => void
  onApprove: (approvalId: string, approved: boolean) => void
  actionsDisabled: boolean
}

type PartOfType<T extends ShopPart['type']> = Extract<
  ShopPart,
  { type: T; state: 'output-available' }
>
type SearchOutput = Extract<
  PartOfType<'tool-searchProducts'>['output'],
  { ok: true }
>
type CartOutput = Extract<PartOfType<'tool-getCart'>['output'], { ok: true }>
type CheckoutPart = Extract<ShopPart, { type: 'tool-checkout' }>

export function ToolPartView({
  part,
  actions,
}: {
  part: ShopPart
  actions: WidgetActions
}) {
  if (!isToolUIPart(part)) return null

  // Zustände, die für alle Tools gleich behandelt werden
  if (part.state === 'output-error') {
    return <Note error text={part.errorText} />
  }
  if (part.state === 'output-denied')
    return <Note text="Bestellung nicht ausgelöst." />

  switch (part.type) {
    case 'tool-searchProducts':
      if (part.state !== 'output-available') {
        return (
          <Note
            text={`Suche läuft${part.input?.term ? ` nach "${part.input.term}"` : ''}...`}
          />
        )
      }
      if (!part.output.ok) return <Note error text={part.output.error} />
      return <SearchResultCards output={part.output} actions={actions} />

    case 'tool-getCart':
    case 'tool-addToCart':
    case 'tool-removeFromCart':
      if (part.state !== 'output-available')
        return <Note text="Warenkorb wird aktualisiert..." />
      if (!part.output.ok) return <Note error text={part.output.error} />
      return <CartTable output={part.output} actions={actions} />

    case 'tool-checkout':
      return <CheckoutPartView part={part} actions={actions} />

    default:
      return <Note text={`${getToolName(part)}: ${part.state}`} />
  }
}

function Note({ text, error = false }: { text: string; error?: boolean }) {
  return (
    <div
      className={`chatbot-system-note${error ? ' chatbot-system-note-error' : ''}`}
    >
      {text}
    </div>
  )
}

function CheckoutPartView({
  part,
  actions,
}: {
  part: CheckoutPart
  actions: WidgetActions
}) {
  if (part.state === 'approval-requested') {
    return (
      <section className="chatbot-summary-card">
        <div className="chatbot-summary-head">
          <div>
            <p>Bestätigung erforderlich</p>
            <strong>Bestellung jetzt abschicken?</strong>
          </div>
        </div>
        <div className="chatbot-action-row">
          <button
            type="button"
            className="chatbot-secondary-action"
            onClick={() => actions.onApprove(part.approval.id, false)}
          >
            Abbrechen
          </button>
          <button
            type="button"
            className="chatbot-primary-action"
            onClick={() => actions.onApprove(part.approval.id, true)}
          >
            Bestellung abschicken
          </button>
        </div>
      </section>
    )
  }
  if (part.state === 'approval-responded') {
    return (
      <Note
        text={
          part.approval.approved
            ? 'Bestellung wird ausgelöst...'
            : 'Bestellung abgebrochen.'
        }
      />
    )
  }
  if (part.state !== 'output-available')
    return <Note text="Bestellung wird vorbereitet..." />
  if (!part.output.ok) return <Note error text={part.output.error} />
  return (
    <section className="chatbot-summary-card chatbot-summary-card-success">
      <div className="chatbot-summary-head">
        <div>
          <p>Bestellung übermittelt</p>
          <strong>{part.output.orderId}</strong>
        </div>
        <span className="chatbot-price">
          {formatMoney(part.output.totalAmount)}
        </span>
      </div>
      <div className="chatbot-summary-list">
        <div className="chatbot-summary-item">
          <div>
            <strong>{part.output.totalItems} Artikel</strong>
            <p>{new Date(part.output.submittedAt).toLocaleString('de-CH')}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function SearchResultCards({
  output,
  actions,
}: {
  output: SearchOutput
  actions: WidgetActions
}) {
  return (
    <section className="chatbot-card-grid">
      <div className="chatbot-result-meta">
        <strong>{output.totalCount} Treffer</strong> für "{output.searchTerm}"
      </div>
      {output.articles.map((article) => {
        const image = articleImageUrl(article.celumId)
        return (
          <article key={article.articleNumber} className="chatbot-product-card">
            <div className="chatbot-product-topline">
              <span className="chatbot-article-badge">
                {article.articleNumber}
              </span>
              <span className="chatbot-price">
                {formatMoney(article.price)}
              </span>
            </div>
            <div className="chatbot-product-body">
              <div className="chatbot-product-thumb">
                {image ? (
                  <img src={image} alt={article.description} loading="lazy" />
                ) : (
                  <div className="article-thumb-fallback">Kein Bild</div>
                )}
              </div>
              <div className="chatbot-product-copy">
                <h3>{article.description}</h3>
                <p>
                  {article.brand ? `${article.brand} · ` : ''}
                  {article.unitText ?? '-'}
                </p>
              </div>
            </div>
            <div className="chatbot-action-row">
              <button
                type="button"
                className="chatbot-primary-action"
                disabled={actions.actionsDisabled}
                onClick={() => actions.onAddArticle(article.articleNumber)}
              >
                In den Warenkorb
              </button>
            </div>
          </article>
        )
      })}
    </section>
  )
}

function CartTable({
  output,
  actions,
}: {
  output: CartOutput
  actions: WidgetActions
}) {
  return (
    <section className="chatbot-summary-card">
      <div className="chatbot-summary-head">
        <div>
          <p>{output.message ?? 'Warenkorb'}</p>
          <strong>{output.totalItems} Artikel</strong>
        </div>
        <span className="chatbot-price">{formatMoney(output.totalAmount)}</span>
      </div>
      {output.items.length ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--sea-ink-soft)]">
              <th className="py-1 pr-2 font-semibold">Artikel</th>
              <th className="py-1 pr-2 text-right font-semibold">Menge</th>
              <th className="py-1 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {output.items.map((item) => (
              <tr
                key={item.articleNumber}
                className="border-t border-[var(--line)]"
              >
                <td className="py-1 pr-2">
                  {item.description}
                  <span className="block text-xs text-[var(--sea-ink-soft)]">
                    {item.articleNumber}
                  </span>
                </td>
                <td className="py-1 pr-2 text-right">{item.quantity}</td>
                <td className="py-1 text-right">
                  {formatMoney(item.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="chatbot-empty-copy">Der Warenkorb ist leer.</p>
      )}
      {output.items.length ? (
        <button
          type="button"
          className="chatbot-primary-action chatbot-full-width"
          disabled={actions.actionsDisabled}
          onClick={() => actions.onCheckout()}
        >
          Bestellung abschliessen
        </button>
      ) : null}
    </section>
  )
}
