import assert from 'node:assert/strict'
import { test } from 'node:test'
import { catalogOrigin } from './catalog.server.ts'

test('catalog mode defaults to mock and supports explicit live mode', () => {
  assert.equal(catalogOrigin({}), 'http://localhost:4040')
  assert.equal(
    catalogOrigin({
      CATALOG_MODE: 'mock',
      MOCK_CATALOG_ORIGIN: 'http://mock/',
    }),
    'http://mock',
  )
  assert.equal(
    catalogOrigin({ CATALOG_MODE: 'live' }),
    'https://web.transgourmet.ch',
  )
  assert.throws(
    () => catalogOrigin({ CATALOG_MODE: 'other' }),
    /Unbekannter CATALOG_MODE/,
  )
})
