import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const ASSETS_DIR = path.join(DATA_DIR, 'assets')
const force = process.argv.includes('--force')

const dataset = JSON.parse(
  await readFile(path.join(DATA_DIR, 'articles.json'), 'utf8'),
)

const celumIds = new Set()
const iconSources = new Set()

function collect(value) {
  if (!value || typeof value !== 'object') return

  if (value.celumId) celumIds.add(String(value.celumId))
  if (typeof value.imgSrc === 'string') iconSources.add(value.imgSrc)

  for (const child of Object.values(value)) collect(child)
}

collect(dataset)

const downloads = new Map()

for (const celumId of celumIds) {
  downloads.set(
    path.join('productimages', 'article', `${celumId}.jpg`),
    `https://webshop.transgourmet.ch/shop/productimages/article/${celumId}.jpg`,
  )
}

for (const source of iconSources) {
  const url = new URL(source, 'https://webpreview.transgourmet.ch')
  const relativePath = url.pathname.startsWith('/shop/productimages/')
    ? url.pathname.slice('/shop/'.length)
    : url.pathname.slice('/assets/'.length)
  downloads.set(relativePath, url.href)
}

async function download([relativePath, source]) {
  const destination = path.join(ASSETS_DIR, relativePath)

  if (!force) {
    try {
      const existing = await readFile(destination)
      if (existing.length > 0) return { downloaded: false, relativePath }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }

  const response = await fetch(source)
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${source}`)
  }

  const body = Buffer.from(await response.arrayBuffer())
  await mkdir(path.dirname(destination), { recursive: true })
  await writeFile(destination, body)
  return { downloaded: true, relativePath }
}

const entries = [...downloads.entries()]
let downloaded = 0

for (let index = 0; index < entries.length; index += 8) {
  const results = await Promise.all(
    entries.slice(index, index + 8).map(download),
  )
  downloaded += results.filter((result) => result.downloaded).length
  process.stdout.write(
    `\rAssets: ${Math.min(index + 8, entries.length)}/${entries.length}`,
  )
}

console.log(
  `\n${downloaded} heruntergeladen, ${entries.length - downloaded} bereits vorhanden.`,
)
