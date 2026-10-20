import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './test/e2e',
  // Demo accounts share server state across both suites and device projects.
  workers: 1,
  reporter: 'line',
  use: {
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command:
        'cross-env PORT=43555 MOCK_DELAY_MS=0 npm start --prefix ../../01-mock-api',
      url: 'http://127.0.0.1:43555/health',
    },
    {
      command:
        'npm run build:apps && cross-env CATALOG_MODE=mock MOCK_CATALOG_ORIGIN=http://127.0.0.1:43555 ENABLE_PUBLIC_MCP_GUARDS=false vite --host 127.0.0.1 --port 43554 --strictPort',
      url: 'http://127.0.0.1:43554/health',
      timeout: 60_000,
    },
    {
      command: 'npm run dev:mcp-host -- --mcp-origin http://127.0.0.1:43554',
      url: 'http://127.0.0.1:43552',
    },
  ],
  projects: [
    {
      name: 'webshop-desktop',
      testDir: './test/e2e/webshop',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:43554' },
    },
    {
      name: 'webshop-mobile',
      testDir: './test/e2e/webshop',
      use: { ...devices['Pixel 7'], baseURL: 'http://127.0.0.1:43554' },
    },
    {
      name: 'mcp-apps-desktop',
      testDir: './test/e2e/mcp-apps',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:43552' },
    },
    {
      name: 'mcp-apps-mobile',
      testDir: './test/e2e/mcp-apps',
      use: { ...devices['Pixel 7'], baseURL: 'http://127.0.0.1:43552' },
    },
  ],
})
