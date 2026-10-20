// Typen für die native WebMCP-API (document.modelContext), geprüft mit Chrome 152.
// Chrome erwartet executeTool-Eingaben als JSON-String; der Spezifikationsentwurf
// mit Objekt-Eingabe ist noch nicht die hier getestete Browser-Schnittstelle.
//
// Lokal statt `webmcp-types` von npm: Das Package (0.1.5) kennt `executeTool()`
// noch nicht. Diese Datei ist ein Script (kein `export`), damit die
// Deklarationen global gelten.

interface WebMCPToolAnnotations {
  readOnlyHint?: boolean
  untrustedContentHint?: boolean
}

interface WebMCPToolExecuteOptions {
  signal: AbortSignal
}

interface WebMCPModelContextTool<TInput = Record<string, unknown>> {
  /** 1-128 Zeichen: ASCII-Buchstaben, Ziffern, '_', '-', '.' */
  name: string
  title?: string
  description: string
  /** JSON-Schema-Objekt (kein String) */
  inputSchema?: object
  /** Rückgabe: beliebiger JSON-Wert; der Browser serialisiert ihn für den Agenten. */
  execute: (
    input: TInput,
    options?: WebMCPToolExecuteOptions,
  ) => unknown | Promise<unknown>
  annotations?: WebMCPToolAnnotations
}

interface WebMCPRegisteredTool {
  name: string
  title?: string
  description: string
  /** Chrome liefert das Schema hier als JSON-String. */
  inputSchema?: object | string
  window: Window
  origin: string
  annotations?: WebMCPToolAnnotations
}

interface WebMCPModelContext extends EventTarget {
  registerTool: (
    tool: WebMCPModelContextTool<any>,
    options?: { signal?: AbortSignal; exposedTo?: Array<string> },
  ) => Promise<void>
  getTools: (options?: {
    fromOrigins?: Array<string>
  }) => Promise<Array<WebMCPRegisteredTool>>
  /** Liefert den JSON-String des Resultats, oder null wenn das Tool eine Navigation auslöste. */
  executeTool: (
    tool: WebMCPRegisteredTool,
    input?: string,
    options?: { signal?: AbortSignal },
  ) => Promise<string | null>
  ontoolchange: ((this: WebMCPModelContext, ev: Event) => unknown) | null
}

interface Document {
  /** Nur in Browsern mit aktiviertem WebMCP-Flag vorhanden. */
  readonly modelContext?: WebMCPModelContext
}
