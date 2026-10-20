// Optionaler Schutz des öffentlichen MCP-Endpunkts (Fly-Deployment):
// Body-Limit und Anfragen pro Minute. Lokal inaktiv, damit Übungen und
// Inspector unbeeinflusst bleiben. Aktivierung über ENABLE_PUBLIC_MCP_GUARDS=true.

type Environment = Record<string, string | undefined>

const requests = new Map<string, Array<number>>()

const tooLarge = () =>
  Response.json({ error: 'MCP-Anfrage ist zu gross.' }, { status: 413 })
const misconfigured = () =>
  Response.json(
    { error: 'Ungültige MCP-Guard-Konfiguration.' },
    { status: 500 },
  )

export async function guardPublicMcpRequest(
  request: Request,
  env: Environment = process.env,
): Promise<Response | null> {
  if (env.ENABLE_PUBLIC_MCP_GUARDS !== 'true') return null

  const maxBytes = Number(env.MCP_MAX_REQUEST_BYTES ?? 256_000)
  if (!Number.isFinite(maxBytes) || maxBytes < 1) return misconfigured()
  if (Number(request.headers.get('content-length') ?? 0) > maxBytes)
    return tooLarge()
  if (
    request.body &&
    (await request.clone().arrayBuffer()).byteLength > maxBytes
  ) {
    return tooLarge()
  }

  const limit = Number(env.MCP_MAX_REQUESTS_PER_MINUTE ?? 120)
  if (!Number.isFinite(limit) || limit < 1) return misconfigured()
  const key =
    request.headers.get('fly-client-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'local'
  const now = Date.now()
  const recent = (requests.get(key) ?? []).filter((time) => now - time < 60_000)
  recent.push(now)
  requests.set(key, recent)
  if (recent.length > limit) {
    return Response.json({ error: 'Zu viele MCP-Anfragen.' }, { status: 429 })
  }
  return null
}
