import { createFileRoute } from '@tanstack/react-router'
import { mcpHandler } from '../features/mcp/handler.ts'
import { guardPublicMcpRequest } from '../features/mcp/public-demo-guard.server.ts'

// Ein Streamable-HTTP-Endpunkt für alle MCP-Tools und die MCP-App-Resources.
const serve = async ({ request }: { request: Request }) =>
  (await guardPublicMcpRequest(request)) ?? mcpHandler.fetch(request)

export const Route = createFileRoute('/mcp')({
  server: { handlers: { GET: serve, POST: serve, DELETE: serve } },
})
