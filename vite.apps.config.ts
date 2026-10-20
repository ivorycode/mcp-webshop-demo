import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

const input = process.env.INPUT
if (!input) throw new Error('INPUT muss search-ui.html oder cart-ui.html sein.')

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    rollupOptions: { input },
    outDir: 'dist',
    emptyOutDir: false,
  },
})
