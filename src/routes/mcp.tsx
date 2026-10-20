import { createFileRoute } from '@tanstack/react-router'
import { mcpHandler } from '../features/mcp/handler.ts'
import { guardPublicMcpRequest } from '../features/mcp/public-demo-guard.server.ts'

// Streamable-HTTP-Endpunkt mit den MCP-Tools, ohne UI. Die MCP-App-Variante
// mit denselben Tools und den HTML-Resources liegt unter /mcp-app.
const serve = async ({ request }: { request: Request }) =>
  (await guardPublicMcpRequest(request)) ?? mcpHandler.fetch(request)

export const Route = createFileRoute('/mcp')({
  server: { handlers: { GET: serve, POST: serve, DELETE: serve } },
})
