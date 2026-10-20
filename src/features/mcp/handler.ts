// HTTP-Handler für den Streamable-HTTP-Transport unter /mcp (routes/mcp.tsx):
// nur Tools, kein UI. Die MCP-App-Variante liegt unter /mcp-app
// (features/mcp-apps/handler.ts). Der optionale Schutz für die öffentliche Demo
// liegt in public-demo-guard.server.ts und ist lokal inaktiv.

import { createMcpHandler } from '@modelcontextprotocol/server'
import { buildMcpServer } from './server.ts'

export const mcpHandler = createMcpHandler(buildMcpServer)
