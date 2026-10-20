// Gemeinsame Fachtypen des Webshops: Katalogdaten, Warenkorb, Bestellung.

export type ApiIcon = { id: string; imgSrc: string; title: string | null }

export type SearchArticle = {
  articleNumber: string
  celumId: string | null
  icons: Array<ApiIcon>
  description: string
  brand: string | null
  unitText: string | null
  price: number | null
  oldPrice: number | null
  sellAmount: number | null
  sellUnit: string | null
  status: string | null
}

export type SearchResult = {
  searchTerm: string
  articles: Array<SearchArticle>
  totalCount: number
  itemCount: number
  page: number
  pageSize: number
}

export type ArticleFact = { id: number; text: string }

export type ArticleDetail = SearchArticle & {
  descriptionLong: string | null
  pricePerSellUnit: number | null
  orderEndTimesText: string | null
  durability: string | null
  foodFact: string | null
  ingredients: string | null
  nutritionFact: Record<string, string | null> | null
  allergenContains: Array<ArticleFact>
  allergenMayContains: Array<ArticleFact>
  specialDiet: Array<ArticleFact>
  hergestellt: Array<ArticleFact>
}

export type CartItem = {
  articleNumber: string
  celumId: string | null
  description: string
  unitText: string | null
  price: number
  quantity: number
  lineTotal: number
  sellAmount: number | null
  sellUnit: string | null
}

export type CartState = {
  cartId: string | null
  items: Array<CartItem>
  totalItems: number
  totalAmount: number
}

/** Eine abgeschickte Bestellung. Die Bestellnummer ist die Id des bestellten Warenkorbs. */
export type Order = {
  orderId: string
  loginId: string
  submittedAt: string
  items: Array<CartItem>
  totalItems: number
  totalAmount: number
}

export type ApiErrorPayload = { error: string }
