import assert from 'node:assert/strict'
import test from 'node:test'
import type * as Media from './media.ts'
import type { ApiIcon } from './types.ts'

async function loadMedia(origin: string) {
  Object.assign(globalThis, { __TRANSGOURMET_API_ORIGIN__: origin })
  try {
    return (await import(
      new URL(`./media.ts?origin=${encodeURIComponent(origin)}`, import.meta.url)
        .href
    )) as typeof Media
  } finally {
    Reflect.deleteProperty(globalThis, '__TRANSGOURMET_API_ORIGIN__')
  }
}

const live = await loadMedia('https://webshoppreview.transgourmet.ch')
const mock = await loadMedia('http://localhost:4040/')

function icon(imgSrc: string): ApiIcon {
  return { id: 'suisse-garantie', title: 'Suisse Garantie', imgSrc }
}

test('live pictograms use the image origin for absolute and relative catalog URLs', () => {
  const path = '/shop/productimages/picto/134020.jpg'
  for (const source of [
    path,
    path.slice(1),
    `https://webshop.transgourmet.ch${path}`,
    `https://webpreview.transgourmet.ch${path}`,
    `https://webshoppreview.transgourmet.ch${path}`,
  ]) {
    assert.equal(
      live.iconImageUrl(icon(source)),
      `https://webshop.transgourmet.ch${path}`,
    )
  }
  assert.equal(
    live.iconImageUrl(icon(`${path}?v=1#icon`)),
    `https://webshop.transgourmet.ch${path}?v=1#icon`,
  )
})

test('ecoscore, external icons and article images keep their hosts', () => {
  const path = '/assets/ecoscore/picto/Tag_color_B_plus.svg'
  assert.equal(
    live.iconImageUrl(icon(path)),
    `https://webpreview.transgourmet.ch${path}`,
  )
  const external = 'https://example.com/shop/productimages/picto/134020.jpg'
  assert.equal(live.iconImageUrl(icon(external)), external)
  assert.equal(
    live.articleImageUrl('117264'),
    'https://webshop.transgourmet.ch/shop/productimages/article/117264.jpg',
  )
})

test('mock media stays on the local catalog origin', () => {
  for (const path of [
    '/shop/productimages/picto/134020.jpg',
    '/assets/ecoscore/picto/Tag_color_B_plus.svg',
  ]) {
    for (const source of [path, `https://webshoppreview.transgourmet.ch${path}`]) {
      assert.equal(mock.iconImageUrl(icon(source)), `http://localhost:4040${path}`)
    }
  }
  assert.equal(
    mock.articleImageUrl('117264'),
    'http://localhost:4040/shop/productimages/article/117264.jpg',
  )
})
