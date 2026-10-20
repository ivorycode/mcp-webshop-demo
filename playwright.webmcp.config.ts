import { defineConfig, devices } from '@playwright/test'

// Separate suite: requires installed Chrome with native WebMCP support.
// The ordinary Playwright suite must still pass with the unfinished starter.
export default defineConfig({
  testDir: './test/webmcp-native',
  workers: 1,
  retries: 0,
  reporter: 'line',
  outputDir: 'test-results/webmcp-native',
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    baseURL: 'http://127.0.0.1:43556',
    launchOptions: { args: ['--enable-features=WebMCPTesting'] },
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command:
        'cross-env PORT=43557 MOCK_DELAY_MS=0 npm start --prefix ../../01-mock-api',
      url: 'http://127.0.0.1:43557/health',
    },
    {
      command:
        'npm run build:apps && cross-env CATALOG_MODE=mock MOCK_CATALOG_ORIGIN=http://127.0.0.1:43557 ENABLE_PUBLIC_MCP_GUARDS=false vite --host 127.0.0.1 --port 43556 --strictPort',
      url: 'http://127.0.0.1:43556/health',
      timeout: 60_000,
    },
  ],
})
