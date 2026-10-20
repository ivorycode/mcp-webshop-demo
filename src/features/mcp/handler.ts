// HTTP-Handler für den Streamable-HTTP-Transport unter /mcp (routes/mcp.tsx).
// Der optionale Schutz für die öffentliche Demo liegt in
// public-demo-guard.server.ts und ist lokal inaktiv.

import { createMcpHandler } from '@modelcontextprotocol/server'
import { buildMcpServer } from './server.ts'

export const mcpHandler = createMcpHandler(buildMcpServer)
