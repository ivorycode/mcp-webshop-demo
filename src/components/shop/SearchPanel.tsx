import { formatMoney } from '../../lib/media.ts'
import type { SearchArticle } from '../../lib/types.ts'
import { ArticleIcons, ArticleImage } from './ArticleIcons.tsx'

type SearchPanelProps = {
  searchInput: string
  onSearchInputChange: (value: string) => void
  activeSearch: string
  onSearch: (term: string) => void
  isFetching: boolean
  totalCount: number
  error: Error | null
  articles: Array<SearchArticle>
  selectedArticleNumber: string | null
  onSelectArticle: (articleNumber: string) => void
  onAddToCart: (articleNumber: string) => void
  canAddToCart: boolean
}

export function SearchPanel(props: SearchPanelProps) {
  const { articles, isFetching, activeSearch } = props
  return (
    <section className="panel rounded-[1.75rem] p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="island-kicker mb-2">Suche</p>
          <h2 className="m-0 text-2xl font-semibold text-[var(--ink-strong)]">
            Transgourmet-Artikelsuche
          </h2>
        </div>
        <p className="m-0 text-sm text-[var(--ink-soft)]">
          Aktueller Suchbegriff: <strong>{activeSearch}</strong>
        </p>
      </div>

      <form
        className="mt-5 flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault()
          props.onSearch(props.searchInput)
        }}
      >
        <input
          name="query"
          required
          value={props.searchInput}
          onChange={(event) => props.onSearchInputChange(event.target.value)}
          placeholder="Suchbegriff eingeben"
          className="flex-1 rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none placeholder:text-[var(--ink-muted)]"
        />
        <button
          type="submit"
          className="action-button rounded-2xl px-5 py-3 text-sm font-semibold text-white"
        >
          Artikel suchen
        </button>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--ink-soft)]">
        <span>
          {isFetching
            ? 'Suche läuft...'
            : activeSearch
              ? `${props.totalCount} Artikel gefunden`
              : 'Kein Suchbegriff aktiv'}
        </span>
        <span>
          Die Ergebnisse kommen vom weitergeleiteten Transgourmet-Endpunkt.
        </span>
      </div>

      {props.error ? (
        <p className="mt-3 text-sm font-medium text-[var(--alert)]">
          {props.error.message}
        </p>
      ) : null}

      <div className="mt-5 grid gap-3">
        {articles.map((article) => (
          <SearchResultCard
            key={article.articleNumber}
            article={article}
            active={props.selectedArticleNumber === article.articleNumber}
            onSelect={() => props.onSelectArticle(article.articleNumber)}
            onAddToCart={() => props.onAddToCart(article.articleNumber)}
            canAddToCart={props.canAddToCart}
          />
        ))}

        {!isFetching && !articles.length ? (
          <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] bg-white/45 px-4 py-8 text-center text-sm text-[var(--ink-soft)]">
            Noch keine Ergebnisse. Gib einen Suchbegriff ein oder versuche es
            mit einem Produkt wie <strong>milch</strong>.
          </div>
        ) : null}
      </div>
    </section>
  )
}

function SearchResultCard({
  article,
  active,
  onSelect,
  onAddToCart,
  canAddToCart,
}: {
  article: SearchArticle
  active: boolean
  onSelect: () => void
  onAddToCart: () => void
  canAddToCart: boolean
}) {
  const isOnSale =
    article.oldPrice !== null && article.oldPrice > (article.price ?? 0)
  return (
    <article
      className={`rounded-[1.5rem] border px-4 py-4 transition ${
        active
          ? 'border-[rgba(196,124,54,0.48)] bg-[rgba(255,251,242,0.96)] shadow-[0_14px_28px_rgba(112,80,43,0.12)]'
          : 'border-[var(--line)] bg-white/68 hover:-translate-y-0.5 hover:border-[rgba(42,130,102,0.26)]'
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <ArticleImage
          celumId={article.celumId}
          alt={article.description}
          className="article-thumb"
        />
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={onSelect}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[rgba(196,124,54,0.12)] px-2.5 py-1 text-xs font-semibold tracking-[0.14em] text-[var(--amber-deep)] uppercase">
              {article.articleNumber}
            </span>
            <ArticleIcons icons={article.icons} />
            {isOnSale ? (
              <span className="rounded-full bg-[rgba(181,59,59,0.1)] px-2.5 py-1 text-xs font-semibold text-[var(--alert)]">
                Aktion
              </span>
            ) : null}
          </div>
          <h3 className="mt-3 text-lg font-semibold text-[var(--ink-strong)]">
            {article.description}
          </h3>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Liefereinheit {article.unitText ?? '-'} · Verkaufseinheit{' '}
            {article.sellAmount ?? '-'} {article.sellUnit ?? ''}
          </p>
        </button>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <div className="text-left lg:text-right">
            <div className="text-xl font-semibold text-[var(--ink-strong)]">
              {formatMoney(article.price)}
            </div>
            {article.oldPrice ? (
              <div className="text-sm text-[var(--ink-muted)] line-through">
                {formatMoney(article.oldPrice)}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full border border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--ink-strong)]"
              onClick={onSelect}
            >
              Details
            </button>
            <button
              type="button"
              className="action-button rounded-full px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onAddToCart}
              disabled={!canAddToCart}
            >
              In den Warenkorb
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
