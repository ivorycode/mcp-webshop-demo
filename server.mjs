import { serve } from '@hono/node-server'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import app from './dist/server/server.js'

const clientRoot = resolve(
  fileURLToPath(new URL('./dist/client/', import.meta.url)),
)
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
}

async function serveClientAsset(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null
  const pathname = decodeURIComponent(new URL(request.url).pathname)
  const filePath = resolve(clientRoot, `.${pathname}`)
  if (!filePath.startsWith(`${clientRoot}${sep}`)) return null

  try {
    const metadata = await stat(filePath)
    if (!metadata.isFile()) return null
    const headers = {
      'content-length': String(metadata.size),
      'content-type':
        contentTypes[extname(filePath)] ?? 'application/octet-stream',
    }
    if (/\/assets\/.*-[A-Za-z0-9_-]{8,}\.[^.]+$/.test(pathname)) {
      headers['cache-control'] = 'public, max-age=31536000, immutable'
    }
    return new Response(
      request.method === 'HEAD' ? null : await readFile(filePath),
      { headers },
    )
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'EISDIR') return null
    throw error
  }
}

async function serveApplication(request) {
  const response = await app.fetch(request)
  if (!response.headers.get('content-type')?.startsWith('text/html')) {
    return response
  }
  const headers = new Headers(response.headers)
  headers.set('cache-control', 'no-store')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

const port = Number(process.env.PORT ?? 3000)
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('PORT muss eine gültige TCP-Portnummer sein.')
}
if (
  process.env.NODE_ENV === 'production' &&
  process.env.CATALOG_MODE !== 'live'
) {
  throw new Error('Im Produktionsbetrieb muss CATALOG_MODE=live gesetzt sein.')
}

serve(
  {
    fetch: async (request) =>
      (await serveClientAsset(request)) ?? serveApplication(request),
    hostname: '0.0.0.0',
    port,
    overrideGlobalObjects: false,
  },
  (info) => {
    console.log(`Webshop listening on http://0.0.0.0:${info.port}`)
  },
)
