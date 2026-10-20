// URIs und Metadaten der MCP Apps (HTML-Resources). Tools verweisen über
// _meta.ui.resourceUri auf diese URIs; der Host lädt die Resource und rendert
// sie in einem iframe neben dem Tool-Resultat.

import { RESOURCE_URI_META_KEY } from '@modelcontextprotocol/ext-apps'
import type {
  McpUiResourceMeta,
  McpUiToolMeta,
} from '@modelcontextprotocol/ext-apps'

export const SEARCH_UI_URI = 'ui://webshop/search-ui.html'
export const CART_UI_URI = 'ui://webshop/cart-ui.html'

/**
 * Tool-Metadaten: `_meta.ui.resourceUri` ist die spezifikationskonforme Form.
 * Der flache Schlüssel `ui/resourceUri` bleibt für ältere Hosts zusätzlich
 * gesetzt; unbekannte _meta-Felder werden von Hosts ignoriert.
 */
export function uiToolMeta(resourceUri: string) {
  const ui: McpUiToolMeta = { resourceUri }
  return { ui, [RESOURCE_URI_META_KEY]: resourceUri }
}

const csp: McpUiResourceMeta['csp'] = {
  // Ohne resourceDomains blockiert der Host das Laden der Produktbilder.
  resourceDomains: ['https://webshop.transgourmet.ch'],
}

/**
 * Resource-Metadaten: `_meta.ui` ist die spezifikationskonforme Form.
 * MCP Inspector 2.3.0 liest die CSP beim Rendern noch aus dem flachen
 * `_meta.csp`; deshalb beide Formen.
 */
export const uiResourceMeta = { ui: { csp } satisfies McpUiResourceMeta, csp }
