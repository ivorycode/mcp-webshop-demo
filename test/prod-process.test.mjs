import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import test from 'node:test'
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client'

test(
  'production server exposes health and the client assets referenced by HTML',
  { timeout: 20_000 },
  async () => {
    const port = 31_000 + Math.floor(Math.random() * 1_000)
    const child = spawn(process.execPath, ['server.mjs'], {
      env: {
        ...process.env,
        PORT: String(port),
        NODE_ENV: 'production',
        CATALOG_MODE: 'live',
        ENABLE_PUBLIC_MCP_GUARDS: 'true',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    try {
      let response
      for (let attempt = 0; attempt < 60; attempt += 1) {
        try {
          response = await fetch(`http://127.0.0.1:${port}/health`)
          break
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      }
      assert.equal(response?.status, 200)
      assert.deepEqual(await response.json(), { status: 'ok' })

      const page = await fetch(`http://127.0.0.1:${port}/`)
      assert.equal(page.status, 200)
      assert.equal(page.headers.get('cache-control'), 'no-store')
      const html = await page.text()
      assert.doesNotMatch(
        html,
        /toolname=|tooldescription=|toolparamdescription=|toolautosubmit=/,
        'the production app must only expose imperative WebMCP tools',
      )
      assert.match(
        html,
        /<input(?=[^>]*name="query")(?=[^>]*required="")[^>]*>/,
        'the regular product search form must remain available',
      )
      const assetPaths = [
        ...new Set(
          [
            ...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+\.(?:js|css))/g),
          ].map((match) => match[1]),
        ),
      ]
      assert.ok(
        assetPaths.length > 0,
        'SSR HTML must reference built JavaScript or CSS assets',
      )

      for (const assetPath of assetPaths) {
        const asset = await fetch(`http://127.0.0.1:${port}${assetPath}`)
        assert.equal(
          asset.status,
          200,
          `${assetPath} must be served by the production adapter`,
        )
        assert.match(asset.headers.get('content-type') ?? '', /javascript|css/)
      }

      const client = new Client({ name: 'production-smoke', version: '1.0.0' })
      try {
        await client.connect(
          new StreamableHTTPClientTransport(
            new URL(`http://127.0.0.1:${port}/mcp`),
          ),
        )
        for (const uri of [
          'ui://webshop/search-ui.html',
          'ui://webshop/cart-ui.html',
        ]) {
          const resource = await client.readResource({ uri })
          assert.match(resource.contents[0]?.text ?? '', /<!doctype html>/i)
        }
      } finally {
        await client.close()
      }
    } finally {
      child.kill('SIGTERM')
      await Promise.race([
        once(child, 'exit'),
        new Promise((resolve) => setTimeout(resolve, 2_000)),
      ])
    }
  },
)
