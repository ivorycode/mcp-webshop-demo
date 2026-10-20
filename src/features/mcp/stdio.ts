// Der MCP-App-Server über stdio, z. B. für Claude Desktop oder den Inspector.
// Achtung: eigener Prozess, eigener Shop-Zustand (siehe lib/shop-state.ts).

import 'dotenv/config'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { buildMcpAppServer } from '../mcp-apps/app-server.ts'

serveStdio(buildMcpAppServer)
console.error('webshop-mcp-server (stdio) gestartet')
