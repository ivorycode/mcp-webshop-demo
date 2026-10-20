// Chat-Widget in zwei Darstellungen:
// - mode="assistant": schwebendes Panel im Webshop. Text-Chat, dessen
//   Tool-Aufrufe die Shop-Oberfläche steuern (assistant-mode.ts).
// - mode="workspace": vollflächiger Chat auf /chat. Tool-Resultate erscheinen
//   als Widgets direkt im Chat (ToolPartView.tsx).
//
// Beide Modi verwenden dieselbe Chat-Route und dieselben Tools; der Modus wird
// dem Server mitgesendet und wählt nur die Modellanweisungen.

import { useEffect, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { useRouterState } from '@tanstack/react-router'
import { generateId, isToolUIPart } from 'ai'
import { MessageCircle, SendHorizonal, Sparkles, X } from 'lucide-react'
import { addToCart, checkoutCart } from '../../../lib/client-api.ts'
import { formatMoney } from '../../../lib/media.ts'
import {
  dispatchCartChanged,
  dispatchShopSearch,
} from '../../../lib/shop-events.ts'
import {
  createChatInstance,
  fetchChatConfigStatus,
} from '../client/chat-client.ts'
import { chatStarterPrompts } from '../shared/chat-config.ts'
import type { ChatConfigStatus, ChatMode } from '../shared/chat-config.ts'
import {
  assistantToolText,
  parseApprovalAnswer,
  pendingCheckoutApproval,
} from './assistant-mode.ts'
import type { ShopPart } from './assistant-mode.ts'
import { ToolPartView } from './ToolPartView.tsx'
import type { WidgetActions } from './ToolPartView.tsx'

// Text ist in beiden Modi sichtbar. Tool-Parts zeigt der Workspace als Widget,
// der Assistant nur als Fehler- oder Freigabetext; interne Parts wie
// step-start bleiben verborgen.
function isVisiblePart(part: ShopPart, mode: ChatMode): boolean {
  // Leere Text-Parts überspringen: Das SDK legt den Text-Part schon beim Start
  // der Antwort an, noch ohne Inhalt. Sonst blitzt eine leere Blase auf, und
  // eine reine Tool-Antwort im Workspace hinterliesse eine leere Nachricht.
  if (part.type === 'text') return Boolean(part.text)
  return mode === 'workspace'
    ? isToolUIPart(part)
    : assistantToolText(part) !== null
}

export default function ChatbotWidget({
  mode = 'assistant',
}: {
  mode?: ChatMode
}) {
  const isWorkspace = mode === 'workspace'
  // Der schwebende Assistant blendet sich auf der Chat-Route aus.
  const isOnChatRoute = useRouterState({
    select: (state) => state.matches.some((match) => match.routeId === '/chat'),
  })
  const [isOpen, setIsOpen] = useState(isWorkspace)
  const [input, setInput] = useState('')
  const [approvalError, setApprovalError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isActionBusy, setIsActionBusy] = useState(false)
  const [configStatus, setConfigStatus] = useState<ChatConfigStatus | null>(
    null,
  )
  const inputRef = useRef<HTMLInputElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const chatRef = useRef<ReturnType<typeof createChatInstance> | null>(null)
  // Tool-Aufrufe, auf die die Seite bereits reagiert hat (Events nur einmal auslösen).
  const handledToolCalls = useRef(new Set<string>())

  chatRef.current ??= createChatInstance(`webshop-chat-${mode}`, mode)

  const {
    messages,
    sendMessage,
    setMessages,
    status,
    error,
    addToolApprovalResponse,
  } = useChat({
    chat: chatRef.current,
  })

  const isBusy = status === 'submitted' || status === 'streaming'
  const isUnconfigured = configStatus?.configured === false

  useEffect(() => {
    fetchChatConfigStatus()
      .then(setConfigStatus)
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const element = scrollRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages, isBusy])

  // Die Seite reagiert auf abgeschlossene Tool-Aufrufe: Suche übernehmen,
  // Warenkorb-Anzeige aktualisieren (Events aus lib/shop-events.ts).
  useEffect(() => {
    for (const part of messages.flatMap((message) => message.parts)) {
      if (!isToolUIPart(part) || part.state !== 'output-available') continue
      if (handledToolCalls.current.has(part.toolCallId)) continue
      handledToolCalls.current.add(part.toolCallId)

      if (part.type === 'tool-searchProducts' && part.output.ok) {
        dispatchShopSearch(part.output.searchTerm)
      }
      if (
        part.type === 'tool-addToCart' ||
        part.type === 'tool-removeFromCart' ||
        part.type === 'tool-checkout'
      ) {
        dispatchCartChanged()
      }
    }
  }, [messages])

  function approveCheckout(id: string, approved: boolean) {
    void addToolApprovalResponse({
      id,
      approved,
      reason: approved ? undefined : 'Abgelehnt im Chat',
    })
  }

  async function submitPrompt(prompt: string) {
    const text = prompt.trim()
    if (!text || isBusy || isUnconfigured) return

    // Assistant: Eine offene Checkout-Freigabe wird mit Ja/Nein beantwortet,
    // nicht mit einer weiteren Modellanfrage.
    const approvalId = isWorkspace ? null : pendingCheckoutApproval(messages)
    if (approvalId) {
      const approved = parseApprovalAnswer(text)
      if (approved === null) {
        setApprovalError(
          'Bitte bestätigen Sie die Bestellung mit Ja oder lehnen Sie mit Nein ab.',
        )
        return
      }
      setApprovalError(null)
      setInput('')
      approveCheckout(approvalId, approved)
      return
    }

    setApprovalError(null)
    setIsOpen(true)
    setInput('')
    requestAnimationFrame(() => inputRef.current?.focus())
    await sendMessage({ text })
  }

  // Eindeutige Widget-Buttons rufen die Shop-API direkt auf. Die ausgeführte
  // Aktion wird als Nachricht in den Chat-Verlauf übernommen, damit das Modell
  // sie im nächsten Zug kennt.
  async function runDirectAction(action: () => Promise<string>) {
    if (isActionBusy || isBusy) return
    setIsActionBusy(true)
    setActionError(null)
    try {
      const confirmation = await action()
      dispatchCartChanged()
      setMessages((current) => [
        ...current,
        {
          id: generateId(),
          role: 'user',
          parts: [{ type: 'text', text: confirmation }],
        },
      ])
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : 'Die Aktion ist fehlgeschlagen.',
      )
    } finally {
      setIsActionBusy(false)
    }
  }

  const widgetActions: WidgetActions = {
    actionsDisabled: isActionBusy || isBusy,
    onApprove: approveCheckout,
    onAddArticle: (articleNumber) =>
      void runDirectAction(async () => {
        const cart = await addToCart(articleNumber, 1)
        return `Artikel ${articleNumber} über den Button in den Warenkorb gelegt. Der Warenkorb enthält jetzt ${cart.totalItems} Artikel.`
      }),
    onCheckout: () =>
      void runDirectAction(async () => {
        const order = await checkoutCart()
        return `Bestellung ${order.orderId} mit ${order.totalItems} Artikeln (${formatMoney(order.totalAmount)}) über den Button abgeschickt.`
      }),
  }

  function clearChat() {
    setMessages([])
    handledToolCalls.current.clear()
    setApprovalError(null)
    setActionError(null)
  }

  if (!isWorkspace && isOnChatRoute) return null

  return (
    <div
      className={`chatbot-shell${isWorkspace ? ' chatbot-shell-screen' : ''}`}
    >
      {isOpen ? (
        <section
          className={`chatbot-panel rise-in${isWorkspace ? ' chatbot-panel-screen' : ''}`}
          aria-label="Chatbot"
        >
          <header className="chatbot-header">
            <div>
              <p className="chatbot-kicker">KI-Einkaufsassistent</p>
              <h2 className="chatbot-title">Shop Chat</h2>
            </div>
            <div className="chatbot-header-actions">
              <button
                type="button"
                className="chatbot-text-button"
                onClick={clearChat}
                disabled={messages.length === 0 || isBusy}
              >
                Leeren
              </button>
              {!isWorkspace ? (
                <button
                  type="button"
                  className="chatbot-icon-button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Chat schliessen"
                >
                  <X size={18} />
                </button>
              ) : null}
            </div>
          </header>

          <div className="chatbot-transcript" ref={scrollRef}>
            <div className="chatbot-transcript-inner">
              {messages.length === 0 ? (
                <div className="chatbot-empty-state">
                  <div className="chatbot-empty-icon">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h3>Produkte suchen, Warenkorb füllen, bestellen.</h3>
                    <p>
                      {isWorkspace
                        ? 'Produkte, Warenkorb und Bestellungen erscheinen als Widgets direkt im Chat.'
                        : 'Schreiben Sie Ihren Wunsch. Der Assistent antwortet mit Text und steuert Suche und Warenkorb im Shop.'}
                      {configStatus?.model
                        ? ` Modell: ${configStatus.model}.`
                        : ''}
                    </p>
                    {isUnconfigured ? (
                      <div className="chatbot-dev-hint">
                        <strong>Kein KI-Provider konfiguriert.</strong>
                        <p>
                          In der lokalen .env AI_PROVIDER und den passenden
                          API-Key setzen, dann den Dev-Server neu starten.
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {messages.map((message) => {
                const visibleParts = message.parts.filter((part) =>
                  isVisiblePart(part, mode),
                )
                if (visibleParts.length === 0) return null
                return (
                  <article
                    key={message.id}
                    className={`chatbot-message chatbot-message-${message.role}`}
                  >
                    <div className="chatbot-message-label">
                      {message.role === 'user' ? 'Sie' : 'Assistent'}
                    </div>
                    <div className="chatbot-bubble-stack">
                      {visibleParts.map((part, index) => (
                        <MessagePart
                          key={
                            isToolUIPart(part)
                              ? part.toolCallId
                              : `${message.id}-${index}`
                          }
                          part={part}
                          mode={mode}
                          actions={widgetActions}
                        />
                      ))}
                    </div>
                  </article>
                )
              })}

              {error ? (
                <div className="chatbot-system-note chatbot-system-note-error">
                  {error.message}
                </div>
              ) : null}
              {actionError ? (
                <p
                  role="alert"
                  className="chatbot-system-note chatbot-system-note-error"
                >
                  {actionError}
                </p>
              ) : null}
              {approvalError ? (
                <p role="alert" className="chatbot-system-note">
                  {approvalError}
                </p>
              ) : null}
              {!isWorkspace && isBusy ? (
                <p className="chatbot-system-note" role="status">
                  Anfrage wird bearbeitet …
                </p>
              ) : null}
            </div>
          </div>

          {messages.length === 0 ? (
            <div className="chatbot-prompts">
              {chatStarterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="chatbot-prompt"
                  onClick={() => void submitPrompt(prompt)}
                  disabled={isBusy || isUnconfigured}
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}

          <form
            className="chatbot-composer"
            onSubmit={(event) => {
              event.preventDefault()
              void submitPrompt(input)
            }}
          >
            <label className="sr-only" htmlFor="chatbot-input">
              Nachricht eingeben
            </label>
            <input
              id="chatbot-input"
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="z. B. Suche Mozzarella"
              className="chatbot-input"
              disabled={isUnconfigured}
            />
            <button
              type="submit"
              className="chatbot-submit"
              disabled={isBusy || !input.trim() || isUnconfigured}
            >
              <SendHorizonal size={16} />
            </button>
          </form>
        </section>
      ) : null}

      {!isWorkspace ? (
        <button
          type="button"
          className="chatbot-launcher"
          onClick={() => setIsOpen((value) => !value)}
          aria-expanded={isOpen}
          aria-label="Chatbot öffnen"
        >
          <span className="chatbot-launcher-icon">
            <MessageCircle size={18} />
          </span>
          <span>
            <strong>Shop Chat</strong>
            <small>Produkte suchen und bestellen</small>
          </span>
        </button>
      ) : null}
    </div>
  )
}

function MessagePart({
  part,
  mode,
  actions,
}: {
  part: ShopPart
  mode: ChatMode
  actions: WidgetActions
}) {
  if (part.type === 'text') {
    return <div className="chatbot-bubble whitespace-pre-line">{part.text}</div>
  }
  if (mode === 'assistant') {
    const text = assistantToolText(part)
    return text ? (
      <div className="chatbot-bubble whitespace-pre-line">{text}</div>
    ) : null
  }
  return <ToolPartView part={part} actions={actions} />
}
