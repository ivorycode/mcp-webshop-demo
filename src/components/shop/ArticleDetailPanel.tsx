import { formatMoney } from '../../lib/media.ts'
import type {
  ArticleDetail,
  ArticleFact,
  SearchArticle,
} from '../../lib/types.ts'
import { ArticleIcons, ArticleImage } from './ArticleIcons.tsx'

type ArticleDetailPanelProps = {
  articleNumber: string | null
  article: ArticleDetail | undefined
  /** Suchtreffer als Platzhalter, solange die Detaildaten fehlen. */
  fallback: SearchArticle | null
  isPending: boolean
  error: Error | null
  onClose: () => void
  onAddToCart: (articleNumber: string) => void
  canAddToCart: boolean
}

export function ArticleDetailPanel(props: ArticleDetailPanelProps) {
  const { articleNumber, article, fallback } = props
  return (
    <section className="panel rounded-[1.75rem] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="island-kicker mb-2">Artikeldetail</p>
          <h2 className="m-0 text-2xl font-semibold text-[var(--ink-strong)]">
            Produktinformationen
          </h2>
        </div>
        {articleNumber ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--ink-soft)]">
              {articleNumber}
            </span>
            <button
              type="button"
              className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold text-[var(--ink-soft)] transition hover:border-[var(--line-strong)] hover:bg-[var(--link-bg-hover)] hover:text-[var(--ink-strong)]"
              onClick={props.onClose}
            >
              Schliessen
            </button>
          </div>
        ) : null}
      </div>

      {!articleNumber ? (
        <p className="mt-5 text-sm text-[var(--ink-soft)]">
          Wähle einen Artikel aus den Suchergebnissen, um die Detailansicht zu
          laden.
        </p>
      ) : props.isPending ? (
        <p className="mt-5 text-sm text-[var(--ink-soft)]">
          Artikeldetails werden geladen...
        </p>
      ) : props.error ? (
        <p className="mt-5 text-sm font-medium text-[var(--alert)]">
          {props.error.message}
        </p>
      ) : article ? (
        <div className="mt-5 space-y-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <ArticleImage
              celumId={article.celumId}
              alt={article.description}
              className="detail-image"
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-semibold text-[var(--ink-strong)]">
                {article.description}
              </h3>
              <ArticleIcons icons={article.icons} className="mt-3 gap-2" />
              <p className="mt-2 text-sm text-[var(--ink-soft)]">
                {article.descriptionLong ??
                  article.foodFact ??
                  'Keine lange Beschreibung verfügbar.'}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DetailTile label="Preis" value={formatMoney(article.price)} />
            <DetailTile
              label="Verkaufseinheit"
              value={`${article.sellAmount ?? '-'} ${article.sellUnit ?? ''}`.trim()}
            />
            <DetailTile
              label="Bestellschluss"
              value={article.orderEndTimesText ?? '-'}
            />
            <DetailTile label="Lagerung" value={article.durability ?? '-'} />
          </div>

          {article.ingredients ? (
            <div>
              <p className="text-sm font-semibold text-[var(--ink-strong)]">
                Zutaten
              </p>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                {article.ingredients}
              </p>
            </div>
          ) : null}

          <FactList
            label="Enthält"
            facts={article.allergenContains}
            className="bg-[rgba(181,59,59,0.08)] text-[var(--alert)]"
          />
          <FactList
            label="Geeignet für"
            facts={article.specialDiet}
            className="bg-[rgba(42,130,102,0.1)] text-[var(--pine)]"
          />

          <button
            type="button"
            className="action-button w-full rounded-2xl px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => props.onAddToCart(article.articleNumber)}
            disabled={!props.canAddToCart}
          >
            Ausgewählten Artikel in den Warenkorb
          </button>
        </div>
      ) : fallback ? (
        <div className="mt-5 text-sm text-[var(--ink-soft)]">
          <ArticleImage
            celumId={fallback.celumId}
            alt={fallback.description}
            className="detail-image mb-4"
          />
          <p>{fallback.description}</p>
          <p className="mt-2">Preis: {formatMoney(fallback.price)}</p>
        </div>
      ) : null}
    </section>
  )
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.3rem] border border-[var(--line)] bg-white/68 px-4 py-3">
      <p className="m-0 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-[var(--ink-strong)]">
        {value}
      </p>
    </div>
  )
}

function FactList({
  label,
  facts,
  className,
}: {
  label: string
  facts: Array<ArticleFact>
  className: string
}) {
  if (!facts.length) return null
  return (
    <div>
      <p className="text-sm font-semibold text-[var(--ink-strong)]">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {facts.map((fact) => (
          <span
            key={`${fact.id}-${fact.text}`}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}
          >
            {fact.text}
          </span>
        ))}
      </div>
    </div>
  )
}
