import { bearerAuthChallengeResponse, createMcpHandler, OAuthError, OAuthErrorCode, verifyBearerToken, type AuthInfo } from '@modelcontextprotocol/server'
import { originAllowed, resourceMetadataUrl, resourceUrl, type Scope } from './config.mts'
import { BodyError, cors, json, readText } from './http.mts'
import { KenDo } from './kendo.mts'
import { verifyAccessToken, type OAuthDeps, type VerifiedToken } from './oauth.mts'
import { buildServer } from './tools.mts'

// POST /mcp: Streamable HTTP, stateless (a fresh server per request, which suits Netlify Functions). The
// SDK serves the 2026-07-28 protocol and falls back to 2025-era stateless serving for older clients.

const MAX_BODY = 256 * 1024

const handler = createMcpHandler(
  ({ authInfo }) => {
    const token = authInfo?.extra as unknown as VerifiedToken & { db: OAuthDeps['db'] }
    const kendo = new KenDo({ db: token.db, uid: token.uid, clientId: token.clientId, clientName: token.clientName })
    return buildServer({ kendo, scopes: authInfo!.scopes as Scope[] })
  },
  { onerror: (err) => console.error('mcp', err.message) },
)

export async function handleMcp(req: Request, deps: OAuthDeps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  // Browsers on other sites can't drive this endpoint (DNS rebinding and cross-site protection).
  if (!originAllowed(req.headers.get('origin'))) return json({ error: 'forbidden_origin' }, 403)

  let auth: AuthInfo
  try {
    auth = await verifyBearerToken(req.headers.get('authorization'), {
      verifier: {
        async verifyAccessToken(token) {
          const found = await verifyAccessToken(deps, token)
          if (!found) throw new OAuthError(OAuthErrorCode.InvalidToken, 'The access token is invalid, expired or was disconnected in KenDo.')
          return {
            token,
            clientId: found.clientId,
            scopes: found.scopes,
            expiresAt: Math.floor(found.expiresAt / 1000),
            resource: new URL(found.resource),
            extra: { ...found, db: deps.db } as unknown as Record<string, unknown>,
          }
        },
      },
      expectedResource: new URL(resourceUrl()),
      resourceMetadataUrl: resourceMetadataUrl(),
    })
  } catch (err) {
    const res = bearerAuthChallengeResponse(err, { resourceMetadataUrl: resourceMetadataUrl() })
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }

  // Long-lived streams would hold a function open (and spend Netlify credits); this server is stateless.
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { ...cors, Allow: 'POST, OPTIONS' })

  let body: string
  try {
    body = await readText(req, MAX_BODY)
  } catch (err) {
    return json({ error: 'invalid_request', error_description: (err as Error).message }, err instanceof BodyError ? err.status : 400, cors)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400, cors)
  }
  const forwarded = new Request(req.url, { method: 'POST', headers: req.headers, body })
  const res = await handler.fetch(forwarded, { authInfo: auth, parsedBody: parsed })
  const headers = new Headers(res.headers)
  for (const [k, v] of Object.entries(cors)) headers.set(k, v)
  return new Response(res.body, { status: res.status, headers })
}
