// Fachregeln, die Browser und Server teilen.

/** Höchstmenge pro Warenkorbposition. Gilt für Web-API, Chat, MCP und WebMCP. */
export const MAX_LINE_QUANTITY = 99

export function isValidQuantity(
  quantity: number,
  options: { allowZero: boolean } = { allowZero: false },
): boolean {
  if (!Number.isInteger(quantity) || quantity > MAX_LINE_QUANTITY) return false
  return options.allowZero ? quantity >= 0 : quantity > 0
}
