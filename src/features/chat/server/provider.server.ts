// Liefert ein Sprachmodell des Vercel AI SDK anhand der Umgebungsvariablen.
//
//   AI_PROVIDER = openai | anthropic | google   (Pflicht)
//   AI_MODEL    = Modell-ID (optional, sonst ein günstiges Standardmodell)
//   <PROVIDER>_API_KEY

import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogle } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

export type AiProvider = 'openai' | 'anthropic' | 'google'

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  openai: 'gpt-5.4-mini',
  anthropic: 'claude-haiku-4-5',
  google: 'gemini-3.5-flash',
}

export const API_KEY_VARIABLES: Record<AiProvider, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
}

function isProvider(value: string | undefined): value is AiProvider {
  return value === 'openai' || value === 'anthropic' || value === 'google'
}

export function resolveProvider(): AiProvider {
  const provider = process.env.AI_PROVIDER
  if (!isProvider(provider)) {
    throw new Error(
      'AI_PROVIDER muss auf openai, anthropic oder google gesetzt sein (siehe lokale .env.example).',
    )
  }
  if (!process.env[API_KEY_VARIABLES[provider]]) {
    throw new Error(
      `${API_KEY_VARIABLES[provider]} ist nicht gesetzt (siehe lokale .env.example).`,
    )
  }
  return provider
}

/** Gibt zurück, ob ein Provider und sein Key konfiguriert sind, ohne zu werfen. */
export function isProviderConfigured(): boolean {
  try {
    resolveProvider()
    return true
  } catch {
    return false
  }
}

export function createModel(modelId?: string): LanguageModel {
  const provider = resolveProvider()
  const id = modelId ?? process.env.AI_MODEL ?? DEFAULT_MODELS[provider]
  switch (provider) {
    case 'openai':
      return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(id)
    case 'anthropic':
      return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(id)
    case 'google':
      return createGoogle({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })(
        id,
      )
  }
}

export function describeModel(): string {
  const provider = resolveProvider()
  return `${provider} / ${process.env.AI_MODEL ?? DEFAULT_MODELS[provider]}`
}
