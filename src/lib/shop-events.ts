// Browser-Events, über die andere Teile der Seite (z. B. ein Chatbot oder
// WebMCP-Tools) die Shop-Oberfläche steuern können, ohne sie direkt zu kennen.

export const SHOP_SEARCH_EVENT = 'shop:search'
export const SHOP_CART_CHANGED_EVENT = 'shop:cart-changed'

export function dispatchShopSearch(term: string) {
  window.dispatchEvent(new CustomEvent(SHOP_SEARCH_EVENT, { detail: { term } }))
}

export function dispatchCartChanged() {
  window.dispatchEvent(new CustomEvent(SHOP_CART_CHANGED_EVENT))
}

export function subscribeToCartChanges(
  listener: EventListener,
  target: EventTarget = window,
) {
  target.addEventListener(SHOP_CART_CHANGED_EVENT, listener)
  return () => target.removeEventListener(SHOP_CART_CHANGED_EVENT, listener)
}
