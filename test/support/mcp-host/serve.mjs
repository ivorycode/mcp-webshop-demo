import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    'mcp-origin': { type: 'string', default: 'http://localhost:3052' },
  },
})
const mcpOrigin = new URL(values['mcp-origin']).origin

const root = fileURLToPath(new URL('.', import.meta.url))
const servers = []
for (const port of [43553, 43552]) {
  const server = await createServer({
    configFile: false,
    root,
    // Each Vite server needs its own optimizer cache, including the webshop.
    cacheDir: fileURLToPath(
      new URL(`../../../node_modules/.vite/mcp-host-${port}`, import.meta.url),
    ),
    server: {
      host: '127.0.0.1',
      port,
      strictPort: true,
      proxy: port === 43552 ? { '/mcp': mcpOrigin } : undefined,
    },
  })
  await server.listen()
  servers.push(server)
}
console.log(`MCP-App-Host: http://127.0.0.1:43552 (MCP: ${mcpOrigin}/mcp)`)
console.log('Webshop und Mock-Katalog müssen separat laufen.')

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await Promise.all(servers.map((server) => server.close()))
    process.exit(0)
  })
}
