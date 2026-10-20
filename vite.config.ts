import 'dotenv/config'
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { catalogOrigin } from './src/lib/catalog.server.ts'

const tanstackStartVirtualDepExcludes = [
  '@tanstack/react-start-client',
  '@tanstack/react-start-server',
  '@tanstack/start-client-core',
  '@tanstack/start-server-core',
]

export default defineConfig({
  base: '/',
  build: {
    rollupOptions: {
      output: {
        assetFileNames(assetInfo) {
          const sourceName = assetInfo.names[0] ?? ''
          return sourceName.endsWith('.css')
            ? 'assets/styles.css'
            : 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
  define: {
    // Katalog-Origin für Bild-URLs im Browser (lib/media.ts); validiert CATALOG_MODE.
    __TRANSGOURMET_API_ORIGIN__: JSON.stringify(catalogOrigin()),
  },
  optimizeDeps: { exclude: tanstackStartVirtualDepExcludes },
  environments: {
    ssr: { optimizeDeps: { exclude: tanstackStartVirtualDepExcludes } },
  },
  plugins: [
    devtools({
      // Vite 8 forwards browser warnings and errors itself. Enabling TanStack's
      // bidirectional pipe as well creates a client/server feedback loop.
      consolePiping: { enabled: false },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})
