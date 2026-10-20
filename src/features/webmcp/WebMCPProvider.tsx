import { useEffect } from 'react'
import { registerShopTools } from './webmcp-tools.ts'

/**
 * Registriert die WebMCP-Tools, sobald die Seite im Browser läuft.
 * Nur im Effekt: Beim Server-Rendering gibt es kein `document`.
 * Der Cleanup meldet die Tools per AbortController wieder ab.
 */
export default function WebMCPProvider() {
  useEffect(() => {
    if (!document.modelContext) return
    return registerShopTools(document.modelContext)
  }, [])
  return null
}
