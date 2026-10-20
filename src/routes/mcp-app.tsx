import { createFileRoute } from '@tanstack/react-router'
import { mcpAppHandler } from '../features/mcp-apps/handler.ts'
import { guardPublicMcpRequest } from '../features/mcp/public-demo-guard.server.ts'

// Streamable-HTTP-Endpunkt mit den MCP-Tools und den MCP-App-Resources.
const serve = async ({ request }: { request: Request }) =>
  (await guardPublicMcpRequest(request)) ?? mcpAppHandler.fetch(request)

export const Route = createFileRoute('/mcp-app')({
  server: { handlers: { GET: serve, POST: serve, DELETE: serve } },
})
