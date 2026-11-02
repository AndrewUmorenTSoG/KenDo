// Small HTTP helpers shared by the OAuth and MCP functions.

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, MCP-Protocol-Version, Mcp-Session-Id',
  'Access-Control-Max-Age': '86400',
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  })
}

export class BodyError extends Error {
  constructor(readonly status: number) {
    super(status === 413 ? 'Request body too large.' : 'Request body could not be read.')
  }
}

// Reads at most `limit` bytes, whatever Content-Length claims.
export async function readText(req: Request, limit: number) {
  const declared = Number(req.headers.get('content-length') ?? 0)
  if (declared > limit) throw new BodyError(413)
  if (!req.body) return ''
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) {
      await reader.cancel().catch(() => undefined)
      throw new BodyError(413)
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}

// OAuth endpoints take form posts (and, leniently, JSON). Only string values are kept.
export async function readParams(req: Request, limit = 16_384): Promise<Record<string, string>> {
  const text = await readText(req, limit)
  const type = req.headers.get('content-type') ?? ''
  let entries: [string, unknown][]
  if (type.includes('application/json')) {
    try {
      entries = Object.entries(JSON.parse(text || '{}'))
    } catch {
      throw new BodyError(400)
    }
  } else entries = [...new URLSearchParams(text)]
  return Object.fromEntries(entries.filter((e): e is [string, string] => typeof e[1] === 'string'))
}

export async function readJson(req: Request, limit = 16_384): Promise<Record<string, unknown>> {
  try {
    const value = JSON.parse((await readText(req, limit)) || '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch (err) {
    if (err instanceof BodyError) throw err
    throw new BodyError(400)
  }
}
