// Zugriff auf den Produktkatalog: entweder der lokale Mock (01-mock-api) oder
// der Live-Katalog. Die Antworten werden auf die eigenen Typen reduziert.

import type {
  ApiIcon,
  ArticleDetail,
  ArticleFact,
  SearchArticle,
  SearchResult,
} from './types.ts'

const LIVE_ORIGIN = 'https://web.transgourmet.ch'

export function catalogOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const mode = env.CATALOG_MODE ?? 'mock'
  if (mode === 'mock') {
    return (env.MOCK_CATALOG_ORIGIN ?? 'http://localhost:4040').replace(
      /\/$/,
      '',
    )
  }
  if (mode === 'live') return LIVE_ORIGIN
  throw new Error(
    `Unbekannter CATALOG_MODE "${mode}". Erlaubt: mock oder live.`,
  )
}

async function fetchCatalog<T>(path: string): Promise<T> {
  const url = `${catalogOrigin()}/de/webshop/resources/articles${path}`
  let response: Response
  try {
    response = await fetch(url, { headers: { accept: 'application/json' } })
  } catch (error) {
    throw new Error(`Katalog-API nicht erreichbar (${url}): ${String(error)}`)
  }
  if (!response.ok) {
    throw new Error(
      `Katalog-API antwortete mit Status ${response.status} (${url}).`,
    )
  }
  return response.json() as Promise<T>
}

const num = (value: unknown): number | null =>
  typeof value === 'number' ? value : null

function icons(value: unknown): Array<ApiIcon> {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry: any) => ({
      id: String(entry.id ?? ''),
      imgSrc: String(entry.imgSrc ?? ''),
      title: entry.title ? String(entry.title) : null,
    }))
    .filter((entry) => entry.id && entry.imgSrc)
}

function facts(value: unknown): Array<ArticleFact> {
  if (!Array.isArray(value)) return []
  return value.map((entry: any) => ({
    id: Number(entry.id),
    text: String(entry.text),
  }))
}

function toSearchArticle(article: any): SearchArticle {
  return {
    articleNumber: String(article.articleNumber),
    celumId: article.celumId ? String(article.celumId) : null,
    icons: icons(article.icons),
    description: article.description ?? 'Unbekannter Artikel',
    brand: article.brand ?? null,
    unitText: article.unitText ?? null,
    price: num(article.price),
    oldPrice: num(article.oldPrice),
    sellAmount: num(article.sellAmount),
    sellUnit: article.sellUnit ?? null,
    status: article.status ?? null,
  }
}

export async function searchArticles(term: string): Promise<SearchResult> {
  const data = await fetchCatalog<any>(
    `/search?searchTerm=${encodeURIComponent(term)}`,
  )
  const response = data.searchResponse ?? {}
  const articles: Array<any> = Array.isArray(response.articles)
    ? response.articles
    : []
  return {
    searchTerm: data.searchTerm ?? term,
    articles: articles.map(toSearchArticle),
    totalCount: Number(response.totalCount ?? articles.length),
    itemCount: Number(response.itemCount ?? articles.length),
    page: Number(response.page ?? 0),
    pageSize: Number(response.pageSize ?? articles.length),
  }
}

export async function getArticleDetail(
  articleNumber: string,
): Promise<ArticleDetail> {
  const data = await fetchCatalog<any>(
    `/${encodeURIComponent(articleNumber)}/detail`,
  )
  const article = data.article ?? {}
  return {
    ...toSearchArticle(article),
    articleNumber: String(article.articleNumber ?? articleNumber),
    descriptionLong: article.descriptionLong ?? null,
    pricePerSellUnit: num(article.pricePerSellUnit),
    orderEndTimesText: article.orderEndTimesText ?? null,
    durability: article.durability ?? null,
    foodFact: article.foodFact ?? null,
    ingredients: article.ingredients ?? null,
    nutritionFact:
      article.nutritionFact && typeof article.nutritionFact === 'object'
        ? article.nutritionFact
        : null,
    allergenContains: facts(article.allergenContains),
    allergenMayContains: facts(article.allergenMayContains),
    specialDiet: facts(article.specialDiet),
    hergestellt: facts(article.hergestellt),
  }
}
