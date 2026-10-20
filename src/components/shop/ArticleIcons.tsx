import {
  articleImageUrl,
  ecoscoreLabel,
  iconImageUrl,
  isEcoscoreIcon,
  orderIcons,
} from '../../lib/media.ts'
import type { ApiIcon } from '../../lib/types.ts'

/** Katalog-Icons eines Artikels, Ecoscore zuerst und mit Buchstabenlabel. */
export function ArticleIcons({
  icons,
  className = '',
}: {
  icons: Array<ApiIcon>
  className?: string
}) {
  if (!icons.length) return null
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {orderIcons(icons).map((icon) => {
        const label = isEcoscoreIcon(icon) ? ecoscoreLabel(icon) : null
        return (
          <span key={icon.id} className="inline-flex items-center gap-1">
            {label ? <span className="eco-score-label">{label}</span> : null}
            <img
              src={iconImageUrl(icon)}
              alt={icon.title ?? 'Artikelicon'}
              title={icon.title ?? undefined}
              className="article-icon"
              loading="lazy"
            />
          </span>
        )
      })}
    </div>
  )
}

export function ArticleImage({
  celumId,
  alt,
  className,
}: {
  celumId: string | null
  alt: string
  className: string
}) {
  const url = articleImageUrl(celumId)
  return (
    <div
      className={`${className} shrink-0 overflow-hidden rounded-lg bg-white`}
    >
      {url ? (
        <img
          src={url}
          alt={alt}
          className="h-full w-full object-contain"
          loading="lazy"
        />
      ) : (
        <div className="article-thumb-fallback">Kein Bild</div>
      )}
    </div>
  )
}
