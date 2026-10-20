// Assistant-Modus: Der Chat ist eine Fernsteuerung der Shop-Oberfläche.
// Tool-Resultate erscheinen nicht als Widgets, sondern wirken auf Suche,
// Warenkorb und Bestellungen im Shop. Sichtbar bleibt nur, was der Benutzer
// im Chat selbst beantworten muss: Fehler und die Checkout-Freigabe.

import { isToolUIPart } from 'ai'
import type { ShopUIMessage } from '../server/ai-tools.server.ts'
import type { ToolError } from '../../../lib/tools/results.ts'

export type ShopPart = ShopUIMessage['parts'][number]

export const CHECKOUT_QUESTION =
  'Bestellung jetzt abschicken? Antworten Sie mit Ja oder Nein.'

function isToolError(output: unknown): output is ToolError {
  return (
    typeof output === 'object' &&
    output !== null &&
    'ok' in output &&
    output.ok === false
  )
}

/** Text eines Tool-Parts im Assistant-Modus, oder null wenn der Part unsichtbar bleibt. */
export function assistantToolText(part: ShopPart): string | null {
  if (!isToolUIPart(part)) return null
  if (part.state === 'output-error') return part.errorText
  if (part.state === 'output-denied') return 'Bestellung nicht ausgelöst.'
  if (part.state === 'output-available' && isToolError(part.output))
    return part.output.error
  if (part.type === 'tool-checkout') {
    if (part.state === 'approval-requested') return CHECKOUT_QUESTION
    if (part.state === 'approval-responded') {
      return part.approval.approved
        ? 'Sie haben die Bestellung freigegeben. Sie wird jetzt abgeschickt.'
        : 'Sie haben die Bestellung abgelehnt.'
    }
  }
  return null
}

/** Die offene Checkout-Freigabe, die auf eine Ja/Nein-Eingabe wartet. */
export function pendingCheckoutApproval(
  messages: Array<ShopUIMessage>,
): string | null {
  for (const message of messages) {
    for (const part of message.parts) {
      if (
        part.type === 'tool-checkout' &&
        part.state === 'approval-requested'
      ) {
        return part.approval.id
      }
    }
  }
  return null
}

/** Interpretiert eine Eingabe als Freigabe (true), Ablehnung (false) oder weder noch (null). */
export function parseApprovalAnswer(text: string): boolean | null {
  const answer = text
    .toLocaleLowerCase('de-CH')
    .replace(/[.!?]+$/, '')
    .trim()
  if (answer === 'ja') return true
  if (answer === 'nein') return false
  return null
}
