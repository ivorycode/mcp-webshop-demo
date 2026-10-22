/**
 * Pure, framework-free implementation of the mocked endpoints.
 * Kept separate from server.mjs so it can be unit-tested and reused.
 */

function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip umlauts/accents: käse -> kase
    .replace(/ß/g, 'ss')
}

/** Fields of a search hit that are matched against the search term. */
function searchableText(article) {
  return normalize(
    [article.description, article.brand, article.articleNumber].join(' '),
  )
}

const searchAliases = {
  parmesan: ['parmigiano'],
}

function matchesToken(haystack, token) {
  return (
    haystack.includes(token) ||
    searchAliases[token]?.some((alias) => haystack.includes(alias))
  )
}

export function createMockApi(dataset) {
  const searchArticles = dataset.searchArticles ?? []
  const details = dataset.details ?? {}

  /**
   * GET /de/webshop/resources/articles/search?searchTerm=...
   * Every whitespace-separated token of the term must match (AND search).
   * Empty term returns everything, like a catalog listing.
   */
  function search(searchTerm, { page = 0, pageSize = 100 } = {}) {
    const tokens = normalize(searchTerm).split(/\s+/).filter(Boolean)
    const hits = searchArticles.filter((article) => {
      const haystack = searchableText(article)
      return tokens.every((token) => matchesToken(haystack, token))
    })

    const start = page * pageSize
    const pageArticles = hits.slice(start, start + pageSize)

    return {
      isAuthenticated: false,
      searchTerm,
      showTileView: false,
      searchResponse: {
        articles: pageArticles,
        totalCount: hits.length,
        itemCount: pageArticles.length,
        page,
        pageSize,
        originalSearchTerm: searchTerm,
        didYouMeanTerms: [],
        searchTerm,
        filters: [],
      },
    }
  }

  /** GET /de/webshop/resources/articles/<articleNumber>/detail */
  function detail(articleNumber) {
    const article = details[articleNumber]
    if (!article) {
      return null
    }
    return { article }
  }

  return {
    search,
    detail,
    articleCount: () => searchArticles.length,
  }
}
