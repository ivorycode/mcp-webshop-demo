// MCP-App-Server: dieselben Tools wie der Text-Server (features/mcp/server.ts),
// ergänzt um zwei Dinge. Jedes Tool verweist über _meta.ui.resourceUri auf eine
// MCP App, und der Server liefert diese Apps als HTML-Resources aus. Ein
// geeigneter Host rendert die App neben dem Tool-Resultat.

import { McpServer } from '@modelcontextprotocol/server'
import { registerShopTools } from '../mcp/server.ts'
import { registerUiResources } from './register-ui-resources.ts'
import { CART_UI_URI, SEARCH_UI_URI, uiToolMeta } from './resource-meta.ts'

export function buildMcpAppServer(): McpServer {
  const server = new McpServer({ name: 'webshop-mcp-app', version: '3.0.0' })
  registerShopTools(server, {
    searchProducts: uiToolMeta(SEARCH_UI_URI),
    getCart: uiToolMeta(CART_UI_URI),
    addToCart: uiToolMeta(CART_UI_URI),
    removeFromCart: uiToolMeta(CART_UI_URI),
    checkout: uiToolMeta(CART_UI_URI),
    getOrders: uiToolMeta(CART_UI_URI),
  })
  registerUiResources(server)
  return server
}
