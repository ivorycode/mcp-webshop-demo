// Einfacher Schutz der Chat-Route: Die App bezahlt das Modell, also begrenzt
// sie, was ein Client auslösen kann.
//
// - Grösse des Request-Bodys und Länge der Nachrichten
// - Anzahl Nachrichten, die ans Modell gehen (höchstens die letzten N, ab Nutzer)
// - Anfragen pro Minute und Client (In-Memory, pro Server-Prozess)
//
// Schritt-, Token- und Zeitlimits der Modellschleife setzt chat-route.server.ts
// aus chatLimits.

import { validateUIMessages } from 'ai'
import type { UIMessage } from 'ai'
import type { ChatMode } from '../shared/chat-config.ts'

export const chatLimits = {
  maxRequestBytes: Number(process.env.CHAT_MAX_REQUEST_BYTES ?? 128_000),
  maxMessages: Number(process.env.CHAT_MAX_MESSAGES ?? 15),
  maxCharactersPerMessage: Number(
    process.env.CHAT_MAX_CHARACTERS_PER_MESSAGE ?? 8_000,
  ),
  maxContextCharacters: Number(
    process.env.CHAT_MAX_CONTEXT_CHARACTERS ?? 40_000,
  ),
  maxRequestsPerMinute: Number(process.env.CHAT_MAX_REQUESTS_PER_MINUTE ?? 20),
  maxSteps: Number(process.env.CHAT_MAX_STEPS ?? 16),
  maxOutputTokens: Number(process.env.CHAT_MAX_OUTPUT_TOKENS ?? 2_048),
  timeoutMs: Number(process.env.CHAT_TIMEOUT_MS ?? 30_000),
} as const

type GuardFailure = { ok: false; status: number; error: string }
type GuardSuccess<TMessage extends UIMessage> = {
  ok: true
  messages: Array<TMessage>
  mode: ChatMode
}

const requestLog = new Map<string, Array<number>>()

function clientKey(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  )
}

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const recent = (requestLog.get(key) ?? []).filter(
    (time) => now - time < 60_000,
  )
  recent.push(now)
  requestLog.set(key, recent)
  return recent.length > chatLimits.maxRequestsPerMinute
}

export async function guardChatRequest<TMessage extends UIMessage>(
  request: Request,
  tools: Record<string, unknown>,
): Promise<GuardFailure | GuardSuccess<TMessage>> {
  if (
    Number(request.headers.get('content-length') ?? 0) >
    chatLimits.maxRequestBytes
  ) {
    return { ok: false, status: 413, error: 'Die Chat-Anfrage ist zu gross.' }
  }
  if (isRateLimited(clientKey(request))) {
    return {
      ok: false,
      status: 429,
      error: 'Zu viele Chat-Anfragen. Bitte in einer Minute erneut versuchen.',
    }
  }

  try {
    const body = (await request.json()) as {
      messages?: unknown
      mode?: unknown
    }
    const mode = body.mode ?? 'workspace'
    if (mode !== 'assistant' && mode !== 'workspace') {
      return { ok: false, status: 400, error: 'Ungültiger Chat-Modus.' }
    }
    // validateUIMessages prüft die Struktur der Nachrichten und Tool-Parts gegen die Tool-Schemas.
    const messages = await validateUIMessages<TMessage>({
      messages: Array.isArray(body.messages) ? body.messages : [],
      tools: tools as never,
    })
    const characterCounts = messages.map(
      (message) => JSON.stringify(message.parts).length,
    )
    if (
      characterCounts.some(
        (count) => count > chatLimits.maxCharactersPerMessage,
      )
    ) {
      return {
        ok: false,
        status: 413,
        error: 'Eine Chat-Nachricht ist zu lang.',
      }
    }
    if (
      characterCounts.reduce((sum, count) => sum + count, 0) >
      chatLimits.maxContextCharacters
    ) {
      return { ok: false, status: 413, error: 'Der Chat-Kontext ist zu gross.' }
    }
    // Ein abgeschnittener Assistant-Tool-Aufruf darf nicht den Verlauf beginnen.
    const recent = messages.slice(-chatLimits.maxMessages)
    const firstUser = recent.findIndex((message) => message.role === 'user')
    if (firstUser === -1) {
      return {
        ok: false,
        status: 400,
        error: 'Der Chat-Kontext enthält keine Nutzernachricht.',
      }
    }
    return { ok: true, messages: recent.slice(firstUser), mode }
  } catch {
    return { ok: false, status: 400, error: 'Ungültige Chat-Anfrage.' }
  }
}
