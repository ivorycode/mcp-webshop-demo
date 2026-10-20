import { z } from 'zod'
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client'
import {
  AppBridge,
  PostMessageTransport,
  RESOURCE_MIME_TYPE,
  getToolUiResourceUri,
} from '@modelcontextprotocol/ext-apps/app-bridge'

// Testvarianten: fehlende Inspector-Capabilities oder fehlschlagende Host-Aufrufe.
const notifications = new URLSearchParams(location.search).get('notifications')

const info = { name: 'Webshop Testhost', version: '1.0.0' }
const client = new Client(info)
const form = document.querySelector('form')!
const button = document.querySelector('button')!
const status = document.querySelector('[role="status"]')!
const view = document.querySelector('#view')!
let bridge: AppBridge | undefined

function report(error: unknown) {
  status.textContent = `Fehler: ${error instanceof Error ? error.message : String(error)}`
}

async function callTool(params: Parameters<Client['callTool']>[0]) {
  const result = await client.callTool(params)
  return {
    ...result,
    structuredContent: z
      .record(z.string(), z.unknown())
      .optional()
      .parse(result.structuredContent),
  }
}

async function loadApp() {
  button.disabled = true
  status.textContent = 'App wird geladen …'
  try {
    await bridge?.close()
    view.replaceChildren()
    document.querySelector('#context')!.textContent = ''
    document.querySelector('#messages')!.textContent = ''
    const name = document.querySelector<HTMLSelectElement>('#tool')!.value
    const loginId = document.querySelector<HTMLInputElement>('#login')!.value
    const input = {
      ...(loginId ? { loginId } : {}),
      ...(name === 'searchProducts'
        ? { term: document.querySelector<HTMLInputElement>('#term')!.value }
        : {}),
    }
    const { tools } = await client.listTools()
    const tool = tools.find((candidate) => candidate.name === name)
    const uri = tool && getToolUiResourceUri({ _meta: tool._meta })
    if (!uri) throw new Error('Tool hat keine MCP-App-Ressource.')
    const resource = await client.readResource({ uri })
    if (resource.contents.length !== 1)
      throw new Error('Genau eine MCP-App-Ressource erwartet.')
    const content = resource.contents[0]
    if (content.mimeType !== RESOURCE_MIME_TYPE || !('text' in content)) {
      throw new Error('MCP-App-HTML fehlt.')
    }
    const result = await callTool({ name, arguments: input })
    const iframe = document.createElement('iframe')
    iframe.title = 'App-Sandbox'
    iframe.sandbox.add('allow-scripts', 'allow-same-origin', 'allow-forms')
    view.append(iframe)
    // ext-apps uses SDK v1 types; our server/client use SDK v2. Forward only
    // the wire-level tool requests instead of passing an incompatible Client.
    const current = new AppBridge(
      null,
      info,
      {
        serverTools: {},
        ...(notifications === 'unsupported'
          ? {}
          : { updateModelContext: { text: {} }, message: { text: {} } }),
      },
      {
        hostContext: { theme: 'light', platform: 'web', displayMode: 'inline' },
      },
    )
    bridge = current
    current.oncalltool = async (params) => {
      if (!tools.some((candidate) => candidate.name === params.name))
        throw new Error('Unbekanntes Tool.')
      return await callTool(params)
    }
    if (notifications !== 'unsupported') {
      current.onupdatemodelcontext = async (params) => {
        document.querySelector('#context')!.textContent = JSON.stringify(
          params,
          null,
          2,
        )
        if (notifications === 'reject')
          throw new Error('Host notification failed')
        return {}
      }
      current.onmessage = async (params) => {
        document.querySelector('#messages')!.textContent = JSON.stringify(
          params,
          null,
          2,
        )
        if (notifications === 'reject')
          throw new Error('Host notification failed')
        return {}
      }
    }
    current.onerror = report
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(
        () =>
          reject(
            new Error('App-Initialisierung hat das Zeitlimit überschritten.'),
          ),
        15_000,
      )
      current.oninitialized = () => {
        window.clearTimeout(timeout)
        resolve()
      }
      current.onsandboxready = async () => {
        try {
          await current.sendSandboxResourceReady({
            html: content.text,
            csp: z
              .object({
                csp: z
                  .object({ resourceDomains: z.array(z.string()).optional() })
                  .optional(),
              })
              .optional()
              .parse(content._meta?.ui)?.csp,
          })
        } catch (error) {
          window.clearTimeout(timeout)
          reject(error)
        }
      }
      current
        .connect(
          new PostMessageTransport(
            iframe.contentWindow!,
            iframe.contentWindow!,
          ),
        )
        .then(() => {
          iframe.src = 'http://127.0.0.1:43553/sandbox.html'
        })
        .catch((error) => {
          window.clearTimeout(timeout)
          reject(error)
        })
    })
    await current.sendToolInput({ arguments: input })
    await current.sendToolResult(result)
    status.textContent = 'App bereit'
  } finally {
    button.disabled = false
  }
}
form.addEventListener('submit', (event) => {
  event.preventDefault()
  void loadApp().catch(report)
})
try {
  await client.connect(
    new StreamableHTTPClientTransport(new URL('/mcp', location.href)),
  )
  status.textContent = 'Verbunden'
  button.disabled = false
} catch (error) {
  report(error)
}
