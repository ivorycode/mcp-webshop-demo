import { createFileRoute } from '@tanstack/react-router'

// Healthcheck für das Deployment: prüft nur den eigenen Prozess, weder Katalog noch LLM.
export const Route = createFileRoute('/health')({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          { status: 'ok' },
          { headers: { 'cache-control': 'no-store' } },
        ),
    },
  },
})
