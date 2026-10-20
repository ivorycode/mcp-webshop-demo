// Chat-Route: empfängt UI-Nachrichten vom Widget, ruft das Modell mit den
// Session-gebundenen Tools auf und streamt UI-Nachrichten-Parts zurück.
//
// GET  /api/chat  → Konfigurationsstatus (Provider konfiguriert?)
// POST /api/chat  → UI Message Stream (Text-Parts, Tool-Parts, Freigaben)

import { json } from '@tanstack/react-start'
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
} from 'ai'
import { getChatSystemPrompt } from '../shared/chat-config.ts'
import type { ChatConfigStatus } from '../shared/chat-config.ts'
import { shopTools } from './ai-tools.server.ts'
import type { ShopUIMessage } from './ai-tools.server.ts'
import { chatLimits, guardChatRequest } from './chat-guard.server.ts'
import {
  createModel,
  describeModel,
  isProviderConfigured,
} from './provider.server.ts'

function configStatus(): ChatConfigStatus {
  const configured = isProviderConfigured()
  return { configured, model: configured ? describeModel() : null }
}

export const chatRouteHandlers = {
  GET: () => json(configStatus()),

  POST: async ({ request }: { request: Request }) => {
    if (!isProviderConfigured()) {
      return json(
        {
          error:
            'Kein KI-Provider konfiguriert: AI_PROVIDER und API-Key in der lokalen .env setzen.',
        },
        { status: 500 },
      )
    }

    const guard = await guardChatRequest<ShopUIMessage>(request, shopTools)
    if (!guard.ok) return json({ error: guard.error }, { status: guard.status })

    const result = streamText({
      model: createModel(),
      instructions: getChatSystemPrompt(guard.mode),
      // UI-Nachrichten (mit Parts) → Modell-Nachrichten (user/assistant/tool)
      messages: await convertToModelMessages(guard.messages, {
        tools: shopTools,
      }),
      tools: shopTools,
      // Human-in-the-loop: checkout wird erst nach Freigabe im Widget ausgeführt.
      toolApproval: { checkout: 'user-approval' },
      stopWhen: isStepCount(chatLimits.maxSteps),
      maxOutputTokens: chatLimits.maxOutputTokens,
      temperature: 0.2,
      abortSignal: AbortSignal.any([
        request.signal,
        AbortSignal.timeout(chatLimits.timeoutMs),
      ]),
    })

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        originalMessages: guard.messages,
      }),
    })
  },
}
