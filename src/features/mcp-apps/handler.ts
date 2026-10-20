// HTTP-Handler für den Streamable-HTTP-Transport unter /mcp-app
// (routes/mcp-app.tsx): Tools mit MCP-App-UI.

import { createMcpHandler } from '@modelcontextprotocol/server'
import { buildMcpAppServer } from './app-server.ts'

export const mcpAppHandler = createMcpHandler(buildMcpAppServer)
