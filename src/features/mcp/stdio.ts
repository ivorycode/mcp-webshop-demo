// Derselbe MCP-Server über stdio, z. B. für Claude Desktop oder den Inspector.
// Achtung: eigener Prozess, eigener Shop-Zustand (siehe lib/shop-state.ts).

import 'dotenv/config'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { buildMcpServer } from './server.ts'

serveStdio(buildMcpServer)
console.error('webshop-mcp-server (stdio) gestartet')
