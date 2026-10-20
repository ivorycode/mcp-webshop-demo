// Shop-Zustand im Prozessspeicher: pro Demo-Konto ein aktiver Warenkorb und
// die letzten Bestellungen. Kein Persistieren, kein externer Checkout.
//
// Alle Zugänge desselben Node-Prozesses (Web-API, Chat-Tools, MCP über HTTP)
// teilen diesen Zustand. Ein stdio-MCP-Server ist ein eigener Prozess mit
// eigenem Zustand.

import { randomUUID } from 'node:crypto'
import { MAX_LINE_QUANTITY, isValidQuantity } from './shop-rules.ts'
import type { ArticleDetail, CartItem, CartState, Order } from './types.ts'

type ActiveCart = { id: string; items: Array<CartItem> }
type AccountState = { activeCart: ActiveCart | null; orders: Array<Order> }

const MAX_ORDERS_PER_ACCOUNT = 20

const states = new Map<string, AccountState>()

const stateFor = (loginId: string): AccountState =>
  states.get(loginId) ?? { activeCart: null, orders: [] }

const round = (value: number) => Math.round(value * 100) / 100

function cartLine(article: ArticleDetail, quantity: number): CartItem {
  const price = article.price ?? 0
  return {
    articleNumber: article.articleNumber,
    celumId: article.celumId,
    description: article.description,
    unitText: article.unitText,
    price,
    quantity,
    lineTotal: round(price * quantity),
    sellAmount: article.sellAmount,
    sellUnit: article.sellUnit,
  }
}

function withQuantity(item: CartItem, quantity: number): CartItem {
  return { ...item, quantity, lineTotal: round(item.price * quantity) }
}

function summarize(cart: ActiveCart | null): CartState {
  const items = cart?.items ?? []
  return {
    cartId: cart?.id ?? null,
    items,
    totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount: round(items.reduce((sum, item) => sum + item.lineTotal, 0)),
  }
}

function saveCart(loginId: string, activeCart: ActiveCart): CartState {
  states.set(loginId, { ...stateFor(loginId), activeCart })
  return summarize(activeCart)
}

function requireActiveCart(loginId: string): ActiveCart {
  const cart = stateFor(loginId).activeCart
  if (!cart) throw new Error('Es gibt keinen aktiven Warenkorb.')
  return cart
}

export function getCart(loginId: string): CartState {
  return summarize(stateFor(loginId).activeCart)
}

export function addToCart(
  loginId: string,
  article: ArticleDetail,
  quantity: number,
): CartState {
  if (!isValidQuantity(quantity)) {
    throw new Error(
      `Die Menge muss eine Ganzzahl zwischen 1 und ${MAX_LINE_QUANTITY} sein.`,
    )
  }
  const cart = stateFor(loginId).activeCart ?? {
    id: `cart_${randomUUID()}`,
    items: [],
  }
  const existing = cart.items.find(
    (item) => item.articleNumber === article.articleNumber,
  )
  if (existing && !isValidQuantity(existing.quantity + quantity)) {
    throw new Error(
      `Pro Position sind höchstens ${MAX_LINE_QUANTITY} Einheiten möglich.`,
    )
  }
  const items = existing
    ? cart.items.map((item) =>
        item === existing ? withQuantity(item, item.quantity + quantity) : item,
      )
    : [...cart.items, cartLine(article, quantity)]
  return saveCart(loginId, { ...cart, items })
}

export function updateCartQuantity(
  loginId: string,
  articleNumber: string,
  quantity: number,
): CartState {
  if (!isValidQuantity(quantity, { allowZero: true })) {
    throw new Error(
      `Die Menge muss eine Ganzzahl zwischen 0 und ${MAX_LINE_QUANTITY} sein.`,
    )
  }
  const cart = requireActiveCart(loginId)
  const items = cart.items
    .map((item) =>
      item.articleNumber === articleNumber
        ? withQuantity(item, quantity)
        : item,
    )
    .filter((item) => item.quantity > 0)
  return saveCart(loginId, { ...cart, items })
}

export function removeFromCart(
  loginId: string,
  articleNumber: string,
): CartState {
  const cart = requireActiveCart(loginId)
  if (!cart.items.some((item) => item.articleNumber === articleNumber)) {
    throw new Error(`Artikel ${articleNumber} ist nicht im Warenkorb.`)
  }
  return saveCart(loginId, {
    ...cart,
    items: cart.items.filter((item) => item.articleNumber !== articleNumber),
  })
}

export function clearCart(loginId: string): CartState {
  const cart = stateFor(loginId).activeCart
  return cart ? saveCart(loginId, { ...cart, items: [] }) : summarize(null)
}

/** Wandelt den aktiven Warenkorb in eine Bestellung um und leert ihn. */
export function checkout(loginId: string): Order {
  const state = stateFor(loginId)
  if (!state.activeCart?.items.length) {
    throw new Error('Es gibt keinen gefüllten aktiven Warenkorb.')
  }
  const cart = summarize(state.activeCart)
  const order: Order = {
    orderId: state.activeCart.id,
    loginId,
    submittedAt: new Date().toISOString(),
    items: cart.items,
    totalItems: cart.totalItems,
    totalAmount: cart.totalAmount,
  }
  states.set(loginId, {
    activeCart: null,
    orders: [...state.orders, order].slice(-MAX_ORDERS_PER_ACCOUNT),
  })
  return order
}

/** Bestellungen, neueste zuerst. */
export function getOrders(loginId: string): Array<Order> {
  return [...stateFor(loginId).orders].reverse()
}

export function resetShopState(): void {
  states.clear()
}
