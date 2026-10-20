import { useEffect, useState } from 'react'

/**
 * Kleines Dev-Panel: listet die per WebMCP registrierten Tools (getTools) und
 * führt eines mit JSON-Eingabe aus (executeTool). Ersetzt für Tests den Agenten.
 */
export default function ToolConsole() {
  const [open, setOpen] = useState(false)
  const [tools, setTools] = useState<Array<WebMCPRegisteredTool>>([])
  const [selected, setSelected] = useState('')
  const [input, setInput] = useState('{}')
  const [output, setOutput] = useState('')
  const [busy, setBusy] = useState(false)
  const [available, setAvailable] = useState(false)

  const tool = tools.find((t) => t.name === selected)

  useEffect(() => {
    const context = document.modelContext
    if (!context) return
    setAvailable(true)
    const refresh = async () => {
      const list = await context.getTools()
      setTools(list)
      setSelected((current) => current || (list[0]?.name ?? ''))
    }
    void refresh()
    context.addEventListener('toolchange', refresh)
    return () => context.removeEventListener('toolchange', refresh)
  }, [])

  // Eingabevorlage aus den Schema-Properties des gewählten Tools.
  useEffect(() => {
    const properties = Object.keys(schemaProperties(tool?.inputSchema))
    setInput(
      JSON.stringify(Object.fromEntries(properties.map((name) => [name, '']))),
    )
    setOutput('')
  }, [tool])

  const execute = async () => {
    const context = document.modelContext
    if (!tool || !context) return
    setBusy(true)
    try {
      const raw = await context.executeTool(
        tool,
        JSON.stringify(JSON.parse(input)),
      )
      setOutput(
        raw === null
          ? 'null (Navigation)'
          : JSON.stringify(JSON.parse(raw), null, 2),
      )
    } catch (error) {
      setOutput(
        `Fehler: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed right-4 bottom-24 z-40 w-[min(28rem,calc(100vw-2rem))] text-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="ml-auto block rounded-full border border-[var(--line)] bg-white px-4 py-2 font-semibold text-[var(--ink-strong)] shadow"
      >
        {available
          ? `WebMCP Tool-Konsole (${tools.length})`
          : 'WebMCP nicht verfügbar'}
      </button>
      {open && available ? (
        <div className="mt-2 rounded-xl border border-[var(--line)] bg-white p-3 shadow-lg">
          <div className="flex gap-2">
            <select
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              className="flex-1 rounded-md border border-[var(--line)] px-2 py-1"
            >
              {tools.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                  {t.annotations?.readOnlyHint ? ' (read-only)' : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={execute}
              disabled={!tool || busy}
              className="action-button rounded-md px-3 py-1 font-semibold text-white disabled:opacity-60"
            >
              Ausführen
            </button>
          </div>
          <p className="mt-2 text-xs text-[var(--ink-soft)]">
            {tool?.description}
          </p>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={2}
            className="mt-2 w-full rounded-md border border-[var(--line)] px-2 py-1 font-mono text-xs"
          />
          <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-[#f3f4f6] p-2 font-mono text-xs whitespace-pre-wrap">
            {output}
          </pre>
        </div>
      ) : null}
    </div>
  )
}

/** Chrome liefert inputSchema aus getTools() als JSON-String. */
function schemaProperties(
  inputSchema: object | string | undefined,
): Record<string, unknown> {
  try {
    const schema = (
      typeof inputSchema === 'string' ? JSON.parse(inputSchema) : inputSchema
    ) as { properties?: Record<string, unknown> } | undefined
    return schema?.properties ?? {}
  } catch {
    return {}
  }
}
