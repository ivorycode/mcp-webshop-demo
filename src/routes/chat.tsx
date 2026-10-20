// Zweite Darstellung des Chats: eigene Route mit vollflächigem Panel.
//
// Es ist derselbe ChatbotWidget, nur im workspace-Modus - ohne Launcher und ohne
// Schliessen-Button. Der schwebende Chat aus dem Root-Layout blendet sich auf
// dieser Route selbst aus.

import { createFileRoute } from '@tanstack/react-router'
import ChatbotWidget from '../features/chat/ui/ChatbotWidget.tsx'

export const Route = createFileRoute('/chat')({
  component: ChatScreen,
})

function ChatScreen() {
  return (
    <main className="chatbot-screen-page">
      <div className="page-wrap chatbot-screen-wrap">
        <ChatbotWidget mode="workspace" />
      </div>
    </main>
  )
}
