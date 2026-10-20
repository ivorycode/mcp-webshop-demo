// Separate-origin outer frame; the inner app has an opaque origin and cannot
// access either the host or this proxy's DOM. Relay only between these windows.
const hostOrigin = 'http://127.0.0.1:43552'
const app = document.createElement('iframe')
app.title = 'MCP App'
app.sandbox.add('allow-scripts', 'allow-forms')
app.style.cssText = 'width:100%;height:100vh;border:0;display:block'
document.body.append(app)

window.addEventListener('message', (event) => {
  if (event.source === window.parent && event.origin === hostOrigin) {
    const message = event.data
    if (message?.method === 'ui/notifications/sandbox-resource-ready') {
      // Permit only explicit HTTPS resource origins, never additional directives.
      const domains = (message.params.csp?.resourceDomains ?? []).filter(
        (value: unknown) => {
          if (typeof value !== 'string') return false
          try {
            return (
              new URL(value).origin === value && value.startsWith('https://')
            )
          } catch {
            return false
          }
        },
      )
      const csp = `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: ${domains.join(' ')}; font-src data: ${domains.join(' ')}; connect-src 'none'; base-uri 'none'; form-action 'none'`
      const html = new DOMParser().parseFromString(
        message.params.html,
        'text/html',
      )
      const policy = html.createElement('meta')
      policy.httpEquiv = 'Content-Security-Policy'
      policy.content = csp
      html.head.prepend(policy)
      app.srcdoc = '<!doctype html>' + html.documentElement.outerHTML
    } else {
      app.contentWindow?.postMessage(message, '*')
    }
  } else if (event.source === app.contentWindow) {
    window.parent.postMessage(event.data, hostOrigin)
  }
})
window.parent.postMessage(
  {
    jsonrpc: '2.0',
    method: 'ui/notifications/sandbox-proxy-ready',
    params: {},
  },
  hostOrigin,
)
