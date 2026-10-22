import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createMockApi } from './mock-api.mjs'
import { createMockServer } from './server.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataset = JSON.parse(
  readFileSync(new URL('./data/articles.json', import.meta.url), 'utf8'),
)
const api = createMockApi(dataset)

test('search matches description case-insensitively and ignores umlauts', () => {
  const a = api.search('Käse')
  const b = api.search('kase')
  assert.ok(a.searchResponse.totalCount > 0)
  assert.equal(a.searchResponse.totalCount, b.searchResponse.totalCount)
  assert.equal(a.searchTerm, 'Käse')
})

test('search response has the shape the demo maps', () => {
  const { searchResponse } = api.search('tomaten')
  const article = searchResponse.articles[0]
  for (const key of [
    'articleNumber',
    'description',
    'celumId',
    'icons',
    'price',
    'oldPrice',
    'sellAmount',
    'sellUnit',
    'status',
    'brand',
    'unitText',
  ]) {
    assert.ok(key in article, `missing ${key}`)
  }
  assert.equal(searchResponse.itemCount, searchResponse.articles.length)
})

test('unknown term yields empty result', () => {
  assert.equal(api.search('xyzzy-nonexistent').searchResponse.totalCount, 0)
})

test('search includes the egg assortment with details', () => {
  const expectedEggSearchResults = [
    '095000',
    '095101',
    '095164',
    '095191',
    '095930',
  ]
  const eggArticleNumbers = new Set(
    api
      .search('eier')
      .searchResponse.articles.map((article) => article.articleNumber),
  )

  for (const articleNumber of expectedEggSearchResults) {
    assert.ok(eggArticleNumbers.has(articleNumber), `missing ${articleNumber}`)
  }

  for (const articleNumber of [...expectedEggSearchResults, '095801']) {
    assert.equal(api.detail(articleNumber).article.articleNumber, articleNumber)
  }
})

test('catalog covers omelettes, spaghetti and carrot cake ingredients', () => {
  const recipes = {
    omelettes: [
      ['eier', '095164'],
      ['milch', '022600'],
      ['butter', '027281'],
      ['mehl', '228001'],
      ['salz', '560002'],
      ['pfeffer', '512630'],
    ],
    spaghetti: [
      ['spaghetti', '410970'],
      ['pelati', '246220'],
      ['zwiebeln', '045900'],
      ['knoblauch', '042582'],
      ['basilikum', '040326'],
      ['parmesan', '010341'],
      ['olivenöl', '101470'],
      ['salz', '560002'],
      ['pfeffer', '512630'],
    ],
    carrotCake: [
      ['karotten', '044626'],
      ['eier', '095164'],
      ['mehl', '228001'],
      ['zucker', '110060'],
      ['mandeln', '371301'],
      ['zitrone', '048826'],
      ['backpulver', '314001'],
      ['zimt', '549980'],
      ['nelken', '549591'],
      ['puderzucker', '110320'],
      ['salz', '560002'],
    ],
  }

  for (const [recipe, ingredients] of Object.entries(recipes)) {
    for (const [searchTerm, articleNumber] of ingredients) {
      const searchResults = api.search(searchTerm).searchResponse.articles
      assert.ok(
        searchResults.some(
          (article) => article.articleNumber === articleNumber,
        ),
        `${recipe}: search for ${searchTerm} is missing ${articleNumber}`,
      )
      assert.equal(
        api.detail(articleNumber)?.article.articleNumber,
        articleNumber,
        `${recipe}: detail is missing for ${articleNumber}`,
      )
    }
  }
})

test('detail returns article for known number and null for unknown', () => {
  const known = api.search('').searchResponse.articles[0].articleNumber
  const { article } = api.detail(known)
  assert.ok(article.articleNumber)
  assert.ok('nutritionFact' in article)
  assert.ok(Array.isArray(article.allergenContains))
  assert.equal(api.detail('000000'), null)
})

test('every product and icon in the dataset has a local asset', () => {
  const missing = []

  function check(value) {
    if (!value || typeof value !== 'object') return

    if (value.celumId) {
      const relativePath = path.join(
        'productimages',
        'article',
        `${value.celumId}.jpg`,
      )
      if (!existsSync(path.join(__dirname, 'data', 'assets', relativePath))) {
        missing.push(relativePath)
      }
    }

    if (typeof value.imgSrc === 'string') {
      const pathname = new URL(
        value.imgSrc,
        'https://webpreview.transgourmet.ch',
      ).pathname
      const relativePath = pathname.startsWith('/shop/productimages/')
        ? pathname.slice('/shop/'.length)
        : pathname.slice('/assets/'.length)
      if (!existsSync(path.join(__dirname, 'data', 'assets', relativePath))) {
        missing.push(relativePath)
      }
    }

    for (const child of Object.values(value)) check(child)
  }

  check(dataset)
  assert.deepEqual([...new Set(missing)], [])
})

test('product images and icons are served by the mock API', async () => {
  const server = createMockServer({ delayMs: 0 })
  const media = [
    ['/shop/productimages/article/717189.jpg', 'image/jpeg'],
    ['/shop/productimages/article/224834.jpg', 'image/jpeg'],
    ['/shop/productimages/article/133748.jpg', 'image/jpeg'],
    ['/shop/productimages/picto/112364.jpg', 'image/jpeg'],
    ['/shop/productimages/picto/112384.jpg', 'image/jpeg'],
    ['/assets/ecoscore/picto/Tag_color_B_plus.svg', 'image/svg+xml'],
    ['/assets/ecoscore/picto/Tag_color_C_minus.svg', 'image/svg+xml'],
  ]

  for (const [pathname, contentType] of media) {
    const response = await new Promise((resolve) => {
      const state = { status: null, headers: null }
      server.emit(
        'request',
        { method: 'GET', url: pathname },
        {
          writeHead(status, headers) {
            state.status = status
            state.headers = headers
          },
          end(body) {
            resolve({ ...state, body })
          },
        },
      )
    })

    assert.equal(response.status, 200, pathname)
    assert.equal(response.headers['content-type'], contentType)
    assert.ok(response.body.length > 0, pathname)
  }
})

test('public HTTP contracts work on a listening standalone server', async (t) => {
  const server = createMockServer({ delayMs: 0 })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  t.after(() => new Promise((resolve) => server.close(resolve)))

  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const origin = `http://127.0.0.1:${address.port}`

  const search = await fetch(
    `${origin}/de/webshop/resources/articles/search?searchTerm=tomaten`,
  )
  assert.equal(search.status, 200)
  assert.match(search.headers.get('content-type'), /^application\/json/)
  const searchBody = await search.json()
  assert.ok(searchBody.searchResponse.articles.length > 0)

  const articleNumber = searchBody.searchResponse.articles[0].articleNumber
  const detail = await fetch(
    `${origin}/de/webshop/resources/articles/${articleNumber}/detail`,
  )
  assert.equal(detail.status, 200)
  assert.equal((await detail.json()).article.articleNumber, articleNumber)

  const image = await fetch(
    `${origin}/shop/productimages/article/${searchBody.searchResponse.articles[0].celumId}.jpg`,
  )
  assert.equal(image.status, 200)
  assert.equal(image.headers.get('content-type'), 'image/jpeg')
})
