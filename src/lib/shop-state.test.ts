import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import {
  addToCart,
  checkout,
  getCart,
  getOrders,
  resetShopState,
  updateCartQuantity,
} from './shop-state.ts'
import type { ArticleDetail } from './types.ts'

const article = (description = 'Milch', price = 2): ArticleDetail => ({
  articleNumber: '1',
  celumId: null,
  icons: [],
  description,
  brand: null,
  unitText: null,
  price,
  oldPrice: null,
  sellAmount: null,
  sellUnit: null,
  status: null,
  descriptionLong: null,
  pricePerSellUnit: null,
  orderEndTimesText: null,
  durability: null,
  foodFact: null,
  ingredients: null,
  nutritionFact: null,
  allergenContains: [],
  allergenMayContains: [],
  specialDiet: [],
  hergestellt: [],
})

beforeEach(resetShopState)

test('creates one cart lazily, merges quantities and preserves the first snapshot', () => {
  assert.equal(getCart('a').cartId, null)
  const first = addToCart('a', article(), 1)
  const second = addToCart('a', article('Neuer Name', 99), 2)
  assert.equal(second.cartId, first.cartId)
  assert.deepEqual(second.items[0], {
    ...first.items[0],
    quantity: 3,
    lineTotal: 6,
  })
  assert.equal(second.totalAmount, 6)
})

test('enforces the shared quantity rule for every access path', () => {
  assert.throws(() => addToCart('a', article(), 0), /zwischen 1 und 99/)
  assert.throws(() => addToCart('a', article(), 1.5), /zwischen 1 und 99/)
  assert.throws(() => addToCart('a', article(), 100), /zwischen 1 und 99/)
  addToCart('a', article(), 99)
  assert.throws(() => addToCart('a', article(), 1), /höchstens 99/)
  assert.equal(updateCartQuantity('a', '1', 0).items.length, 0)
  assert.throws(() => updateCartQuantity('a', '1', -1), /zwischen 0 und 99/)
})

test('checkout turns the cart id into the order id and isolates accounts', () => {
  const cart = addToCart('a', article(), 1)
  const order = checkout('a')
  assert.equal(order.orderId, cart.cartId)
  assert.equal(getCart('a').cartId, null)
  assert.equal(getOrders('a').length, 1)
  assert.equal(getOrders('b').length, 0)
  assert.notEqual(addToCart('a', article(), 1).cartId, cart.cartId)
})

test('retains only the latest twenty orders, newest first', () => {
  for (let index = 0; index < 21; index++) {
    addToCart('a', article(), 1)
    checkout('a')
  }
  const orders = getOrders('a')
  assert.equal(orders.length, 20)
  assert.ok(orders[0].submittedAt >= orders[19].submittedAt)
})
