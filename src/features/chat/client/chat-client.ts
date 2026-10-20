// Chat-Instanz des Widgets. Eine Chat-Instanz hält Nachrichten und Status
// und spricht über den Transport mit der Chat-Route.

import { Chat } from '@ai-sdk/react'
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai'
import type { ShopUIMessage } from '../server/ai-tools.server.ts'
import { CHAT_API_PATH } from '../shared/chat-config.ts'
import type { ChatConfigStatus, ChatMode } from '../shared/chat-config.ts'

export function createChatInstance(id: string, mode: ChatMode) {
  return new Chat<ShopUIMessage>({
    id,
    transport: new DefaultChatTransport({ api: CHAT_API_PATH, body: { mode } }),
    // Nach einer Freigabe-Antwort (checkout ja/nein) automatisch weitersenden,
    // damit das Modell das Tool ausführt bzw. die Ablehnung verarbeitet.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  })
}

export async function fetchChatConfigStatus(): Promise<ChatConfigStatus> {
  const response = await fetch(CHAT_API_PATH, {
    headers: { accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`Request failed with ${response.status}`)
  return (await response.json()) as ChatConfigStatus
}
