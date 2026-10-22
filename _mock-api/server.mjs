/**
 * Mock of the Transgourmet webshop article API.
 *
 * Mirrors the two endpoints the demo (webshop-with-ai) actually calls:
 *
 *   GET /de/webshop/resources/articles/search?searchTerm=<term>
 *   GET /de/webshop/resources/articles/<articleNumber>/detail
 *
 * Responses are shaped like the real API (snapshot of real data in data/articles.json).
 * Additionally serves the locally mirrored product images / icons so the demo can run fully offline:
 *
 *   GET /shop/productimages/article/<celumId>.jpg      (real host: webshop.transgourmet.ch)
 *   GET /shop/productimages/picto/<celumId>.jpg        (real host: webshop.transgourmet.ch)
 *   GET /assets/ecoscore/picto/<file>.svg              (real host: webpreview.transgourmet.ch)
 */
import http from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'
import path from 'node:path'

import { createMockApi } from './mock-api.mjs'

let envFile
try {
  envFile = readFileSync('.env', 'utf8')
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
if (envFile !== undefined) {
  const variables = parseEnv(envFile)
  for (const [name, value] of Object.entries(variables)) {
    process.env[name] ??= value
  }
  console.log(
    `.env loaded: ${Object.keys(variables).join(', ') || '(no variables)'}`,
  )
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT ?? 4040)
const DELAY_MS = Number(process.env.MOCK_DELAY_MS ?? 150)

const dataset = JSON.parse(
  readFileSync(path.join(__dirname, 'data', 'articles.json'), 'utf8'),
)
const ASSETS_DIR = path.join(__dirname, 'data', 'assets')

const ARTICLES_PREFIX = '/de/webshop/resources/articles'

function send(
  res,
  status,
  body,
  contentType = 'application/json; charset=utf-8',
) {
  res.writeHead(status, {
    'content-type': contentType,
    'access-control-allow-origin': '*',
    'cache-control': 'no-store',
  })
  res.end(
    typeof body === 'string' || Buffer.isBuffer(body)
      ? body
      : JSON.stringify(body),
  )
}

function sendAsset(res, relativePath, contentType) {
  try {
    return send(
      res,
      200,
      readFileSync(path.join(ASSETS_DIR, relativePath)),
      contentType,
    )
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return send(res, 404, { error: `Mock asset not found: ${relativePath}` })
    }
    throw error
  }
}

export function createMockServer({
  mockDataset = dataset,
  delayMs = DELAY_MS,
} = {}) {
  const api = createMockApi(mockDataset)

  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const { pathname } = url

    if (req.method === 'OPTIONS') {
      return send(res, 204, '')
    }
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs))
    }

    console.log(
      `${new Date().toISOString()} ${req.method} ${pathname}${url.search}`,
    )

    if (pathname === '/' || pathname === '/health') {
      return send(res, 200, {
        ok: true,
        articles: api.articleCount(),
        endpoints: [
          `${ARTICLES_PREFIX}/search?searchTerm=<term>`,
          `${ARTICLES_PREFIX}/<articleNumber>/detail`,
          '/shop/productimages/article/<celumId>.jpg',
          '/shop/productimages/picto/<celumId>.jpg',
          '/assets/ecoscore/picto/<file>.svg',
        ],
      })
    }

    if (pathname === `${ARTICLES_PREFIX}/search`) {
      const searchTerm = url.searchParams.get('searchTerm') ?? ''
      const page = Number(url.searchParams.get('page') ?? 0)
      const pageSize = Number(url.searchParams.get('pageSize') ?? 100)
      return send(res, 200, api.search(searchTerm, { page, pageSize }))
    }

    const detailMatch = pathname.match(
      new RegExp(`^${ARTICLES_PREFIX}/([^/]+)/detail$`),
    )
    if (detailMatch) {
      const detail = api.detail(decodeURIComponent(detailMatch[1]))
      if (!detail) {
        // Real API returns 404 for unknown article numbers.
        return send(res, 404, { error: 'Article not found' })
      }
      return send(res, 200, detail)
    }

    const imgMatch = pathname.match(
      /^\/shop\/productimages\/article\/(\d+)\.jpg$/,
    )
    if (imgMatch) {
      return sendAsset(
        res,
        path.join('productimages', 'article', `${imgMatch[1]}.jpg`),
        'image/jpeg',
      )
    }

    const pictoMatch = pathname.match(
      /^\/shop\/productimages\/picto\/(\d+)\.jpg$/,
    )
    if (pictoMatch) {
      return sendAsset(
        res,
        path.join('productimages', 'picto', `${pictoMatch[1]}.jpg`),
        'image/jpeg',
      )
    }

    const iconMatch = pathname.match(
      /^\/assets\/ecoscore\/picto\/(Tag_color_[A-Za-z_+-]+\.svg)$/,
    )
    if (iconMatch) {
      return sendAsset(
        res,
        path.join('ecoscore', 'picto', iconMatch[1]),
        'image/svg+xml',
      )
    }

    send(res, 404, { error: `No mock route for ${pathname}` })
  })
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const server = createMockServer()
  server.listen(PORT, () => {
    console.log(`Transgourmet mock API listening on http://localhost:${PORT}`)
    console.log(
      `  ${createMockApi(dataset).articleCount()} articles loaded, ${DELAY_MS}ms simulated latency`,
    )
    console.log(
      `  Try: http://localhost:${PORT}${ARTICLES_PREFIX}/search?searchTerm=tomaten`,
    )
  })
}
