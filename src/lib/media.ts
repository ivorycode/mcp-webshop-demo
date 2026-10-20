// Darstellungshelfer der Shop-Oberfläche: Preisformat und Bild-URLs.
//
// Produktbilder und Icons kommen im Mock-Modus vom lokalen Katalogdienst,
// sonst von den Transgourmet-Origins. Der Katalog-Origin wird beim Build
// über `define` in vite.config.ts eingesetzt.

import type { ApiIcon } from './types.ts'

declare const __TRANSGOURMET_API_ORIGIN__: string

const CATALOG_API_ORIGIN = __TRANSGOURMET_API_ORIGIN__.replace(/\/$/, '')
const LIVE_IMAGE_ORIGIN = 'https://webshop.transgourmet.ch'
const LIVE_MEDIA_ORIGIN = 'https://webpreview.transgourmet.ch'

function isTransgourmetOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin)
    return (
      hostname === 'transgourmet.ch' || hostname.endsWith('.transgourmet.ch')
    )
  } catch {
    return false
  }
}

const USE_MOCK_MEDIA = !isTransgourmetOrigin(CATALOG_API_ORIGIN)

const moneyFormatter = new Intl.NumberFormat('de-CH', {
  style: 'currency',
  currency: 'CHF',
})

export function formatMoney(value: number | null | undefined): string {
  return moneyFormatter.format(value ?? 0)
}

export function articleImageUrl(
  celumId: string | null | undefined,
): string | null {
  if (!celumId) return null
  const origin = USE_MOCK_MEDIA ? CATALOG_API_ORIGIN : LIVE_IMAGE_ORIGIN
  return `${origin}/shop/productimages/article/${celumId}.jpg`
}

/** Pfad einer Icon-URL, egal ob absolut oder relativ angegeben. */
function mediaPath(imgSrc: string): string {
  try {
    const url = new URL(imgSrc)
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return imgSrc.startsWith('/') ? imgSrc : `/${imgSrc}`
  }
}

export function isEcoscoreIcon(icon: ApiIcon): boolean {
  return (
    icon.id.toLowerCase().startsWith('ecoscore') ||
    icon.imgSrc.toLowerCase().includes('/ecoscore/')
  )
}

export function ecoscoreLabel(icon: ApiIcon): string | null {
  for (const source of [icon.title ?? '', icon.imgSrc, icon.id]) {
    const match = source.match(
      /(?:eco(?:-?score)?[^A-E]*|tag_color_)([A-E])(?:[_\s-]*(?:plus|minus|\+|-))?/i,
    )
    if (match) return match[1].toUpperCase()
  }
  return null
}

export function iconImageUrl(icon: ApiIcon): string {
  if (USE_MOCK_MEDIA) return `${CATALOG_API_ORIGIN}${mediaPath(icon.imgSrc)}`
  const isAbsolute = /^https?:\/\//.test(icon.imgSrc)
  // Fremde absolute URLs bleiben unverändert.
  if (isAbsolute && !isTransgourmetOrigin(icon.imgSrc)) return icon.imgSrc
  const path = mediaPath(icon.imgSrc)
  // Produktpiktogramme und Ecoscore-Assets liegen auf unterschiedlichen Hosts.
  const origin = path.startsWith('/shop/productimages/picto/')
    ? LIVE_IMAGE_ORIGIN
    : LIVE_MEDIA_ORIGIN
  return `${origin}${path}`
}

/** Ecoscore-Icons zuerst, sonst Reihenfolge des Katalogs. */
export function orderIcons(icons: Array<ApiIcon>): Array<ApiIcon> {
  return [...icons].sort(
    (left, right) =>
      Number(isEcoscoreIcon(right)) - Number(isEcoscoreIcon(left)),
  )
}
