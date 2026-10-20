// Registriert die gebauten HTML-Dateien (dist/*.html) als ui://-Resources.
//
// Native Registrierung über server.registerResource (SDK v2) statt über
// registerAppResource aus ext-apps: Die ext-apps-Helfer sind gegen SDK v1
// typisiert (ext-apps#702). Entscheidend sind mimeType und die UI-Metadaten.

import fs from 'node:fs/promises'
import path from 'node:path'
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps'
import type { McpServer } from '@modelcontextprotocol/server'
import { CART_UI_URI, SEARCH_UI_URI, uiResourceMeta } from './resource-meta.ts'

// Der Prozess startet lokal im Projektverzeichnis und auf Fly in /app.
const distDir = path.resolve(process.cwd(), 'dist')

async function readUiHtml(fileName: string): Promise<string> {
  try {
    return await fs.readFile(path.join(distDir, fileName), 'utf-8')
  } catch {
    throw new Error(
      `${fileName} nicht gefunden in ${distDir}. Zuerst "npm run build" ausführen.`,
    )
  }
}

function registerUiResource(
  server: McpServer,
  name: string,
  uri: string,
  fileName: string,
): void {
  server.registerResource(
    name,
    uri,
    { title: name, mimeType: RESOURCE_MIME_TYPE, _meta: uiResourceMeta },
    async () => ({
      contents: [
        {
          uri,
          mimeType: RESOURCE_MIME_TYPE,
          text: await readUiHtml(fileName),
          _meta: uiResourceMeta,
        },
      ],
    }),
  )
}

export function registerUiResources(server: McpServer): void {
  registerUiResource(
    server,
    'Webshop Produktsuche',
    SEARCH_UI_URI,
    'search-ui.html',
  )
  registerUiResource(server, 'Webshop Warenkorb', CART_UI_URI, 'cart-ui.html')
}
