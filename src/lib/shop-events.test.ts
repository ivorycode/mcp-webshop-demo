import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SHOP_CART_CHANGED_EVENT,
  subscribeToCartChanges,
} from './shop-events.ts'

test('cart change subscriptions work on every route and can be removed', () => {
  const target = new EventTarget()
  let notifications = 0
  const unsubscribe = subscribeToCartChanges(() => {
    notifications += 1
  }, target)

  target.dispatchEvent(new Event(SHOP_CART_CHANGED_EVENT))
  unsubscribe()
  target.dispatchEvent(new Event(SHOP_CART_CHANGED_EVENT))

  assert.equal(notifications, 1)
})
