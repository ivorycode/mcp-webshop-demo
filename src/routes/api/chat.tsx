import { createFileRoute } from '@tanstack/react-router'
import { chatRouteHandlers } from '../../features/chat/server/chat-route.server.ts'

export const Route = createFileRoute('/api/chat')({
  server: { handlers: chatRouteHandlers },
})
