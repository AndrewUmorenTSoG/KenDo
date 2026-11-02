import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { FieldValue, type Firestore } from 'firebase-admin/firestore'
import {
  ACCESS_TOKEN_SECONDS,
  ALL_SCOPES,
  baseUrl,
  CODE_SECONDS,
  isScope,
  redirectAllowed,
  REFRESH_TOKEN_SECONDS,
  resourceUrl,
  SCOPES,
  type Scope,
} from './config.mts'

// A small OAuth 2.1 authorization server in front of Firebase sign-in. AI apps register (or present a
// client metadata document), send the person to /connect where they sign in to KenDo and approve, and get
// short-lived access tokens bound to this MCP server. Everything is stored in Firestore collections that
// the security rules never expose to browsers; the person's list of connections lives in
// users/{uid}/connections so Settings can show and remove them. Removing one cuts the app off at once.

export interface OAuthDeps {
  db: Firestore
  // Verifies a Firebase ID token from the KenDo web app and returns the signed-in user.
  verifyIdToken: (token: string) => Promise<{ uid: string; name?: string; email?: string }>
  fetch?: typeof fetch
  now?: () => number
}

export class OAuthFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

export interface Client {
  client_id: string
  client_name: string
  redirect_uris: string[]
  token_endpoint_auth_method: 'none' | 'client_secret_post' | 'client_secret_basic'
  secretHash?: string
  metadataDocument?: boolean
  createdAt: number
}

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')
const random = (bytes = 32) => randomBytes(bytes).toString('base64url')
const s256 = (verifier: string) => createHash('sha256').update(verifier).digest('base64url')

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

const cleanName = (name: unknown) =>
  (typeof name === 'string' ? name : '')
    // Control characters and markup have no place in a name shown on the consent screen.
    .replace(/[\p{C}<>]/gu, '')
    .trim()
    .slice(0, 60) || 'An AI app'

const col = (deps: OAuthDeps, name: 'oauthClients' | 'oauthCodes' | 'oauthTokens' | 'oauthMeta') => deps.db.collection(name)
const now = (deps: OAuthDeps) => (deps.now ? deps.now() : Date.now())

export function parseScopes(scope: unknown): Scope[] {
  const asked = typeof scope === 'string' ? scope.split(/\s+/).filter(Boolean) : []
  const known = [...new Set(asked.filter(isScope))]
  // Clients that ask for nothing we know get the full list, which the person can trim on the consent screen.
  return known.length ? known : [...ALL_SCOPES]
}

// --- Clients -------------------------------------------------------------------------------------------

const REGISTRATIONS_PER_HOUR = 30

export async function registerClient(deps: OAuthDeps, body: Record<string, unknown>) {
  const uris = body.redirect_uris
  if (!Array.isArray(uris) || !uris.length || uris.length > 10 || !uris.every((u) => typeof u === 'string'))
    throw new OAuthFailure('invalid_redirect_uri', 'redirect_uris must list 1 to 10 addresses.')
  const bad = uris.find((u) => !redirectAllowed(u))
  if (bad) throw new OAuthFailure('invalid_redirect_uri', `This redirect address is not allowed: ${String(bad).slice(0, 200)}`)
  const method = (body.token_endpoint_auth_method ?? 'none') as string
  if (!['none', 'client_secret_post', 'client_secret_basic'].includes(method))
    throw new OAuthFailure('invalid_client_metadata', 'token_endpoint_auth_method must be none, client_secret_post or client_secret_basic.')
  const grants = (body.grant_types ?? ['authorization_code']) as unknown
  if (!Array.isArray(grants) || grants.some((g) => g !== 'authorization_code' && g !== 'refresh_token'))
    throw new OAuthFailure('invalid_client_metadata', 'Only authorization_code and refresh_token grants are supported.')

  // A global cap keeps anyone from filling the database with registrations.
  const hour = Math.floor(now(deps) / 3_600_000)
  const meter = col(deps, 'oauthMeta').doc('registrations')
  await deps.db.runTransaction(async (tx) => {
    const snap = await tx.get(meter)
    const count = snap.get('hour') === hour ? (snap.get('count') as number) : 0
    if (count >= REGISTRATIONS_PER_HOUR) throw new OAuthFailure('temporarily_unavailable', 'Too many registrations. Try again later.', 429)
    tx.set(meter, { hour, count: count + 1 })
  })

  const clientId = `kendo_${random(18)}`
  const secret = method === 'none' ? undefined : random(32)
  const client: Client = {
    client_id: clientId,
    client_name: cleanName(body.client_name),
    redirect_uris: uris as string[],
    token_endpoint_auth_method: method as Client['token_endpoint_auth_method'],
    createdAt: now(deps),
    ...(secret ? { secretHash: sha256(secret) } : {}),
  }
  await col(deps, 'oauthClients').doc(clientId).set(client)
  return {
    client_id: clientId,
    client_id_issued_at: Math.floor(client.createdAt / 1000),
    ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
    client_name: client.client_name,
    redirect_uris: client.redirect_uris,
    token_endpoint_auth_method: method,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
  }
}

// A client id that is an https URL points at the client's own metadata document (CIMD).
const isMetadataUrl = (id: string) => /^https:\/\//.test(id)

async function fetchClientMetadata(deps: OAuthDeps, id: string): Promise<Client> {
  const url = new URL(id)
  if (url.hash || url.username || url.password || url.pathname === '/' || /^[\d.]+$|^\[|^localhost$/i.test(url.hostname))
    throw new OAuthFailure('invalid_client', 'This client id is not a usable metadata document address.')
  const cached = await col(deps, 'oauthClients').doc(sha256(id)).get()
  if (cached.exists && now(deps) - (cached.get('createdAt') as number) < 24 * 3_600_000) return cached.data() as Client

  const res = await (deps.fetch ?? fetch)(id, { redirect: 'error', signal: AbortSignal.timeout(5000), headers: { Accept: 'application/json' } }).catch(
    () => null,
  )
  const text = res?.ok ? await res.text() : ''
  if (!text || text.length > 10_000) throw new OAuthFailure('invalid_client', 'The client metadata document could not be read.')
  let doc: Record<string, unknown>
  try {
    doc = JSON.parse(text)
  } catch {
    throw new OAuthFailure('invalid_client', 'The client metadata document is not JSON.')
  }
  if (doc.client_id !== id) throw new OAuthFailure('invalid_client', 'The metadata document names a different client_id.')
  const uris = Array.isArray(doc.redirect_uris) ? (doc.redirect_uris as unknown[]).filter((u): u is string => typeof u === 'string') : []
  if (!uris.length || uris.some((u) => !redirectAllowed(u))) throw new OAuthFailure('invalid_client', 'The client lists a redirect address that is not allowed.')
  const method = (doc.token_endpoint_auth_method ?? 'none') as string
  if (method !== 'none') throw new OAuthFailure('invalid_client', 'Only public clients may use a metadata document here.')
  const client: Client = {
    client_id: id,
    client_name: cleanName(doc.client_name ?? url.hostname),
    redirect_uris: uris.slice(0, 10),
    token_endpoint_auth_method: 'none',
    metadataDocument: true,
    createdAt: now(deps),
  }
  await col(deps, 'oauthClients').doc(sha256(id)).set(client)
  return client
}

export async function getClient(deps: OAuthDeps, clientId: unknown): Promise<Client> {
  if (typeof clientId !== 'string' || !clientId || clientId.length > 500) throw new OAuthFailure('invalid_client', 'Unknown client.', 401)
  if (isMetadataUrl(clientId)) return fetchClientMetadata(deps, clientId)
  const snap = await col(deps, 'oauthClients').doc(clientId).get()
  if (!snap.exists) throw new OAuthFailure('invalid_client', 'Unknown client.', 401)
  return snap.data() as Client
}

// Confidential clients prove themselves with their secret; public ones just name themselves.
async function authenticateClient(deps: OAuthDeps, params: Record<string, string>, authorization: string | null) {
  let id = params.client_id
  let secret = params.client_secret
  if (authorization?.startsWith('Basic ')) {
    const decoded = Buffer.from(authorization.slice(6), 'base64').toString()
    const split = decoded.indexOf(':')
    id = decodeURIComponent(decoded.slice(0, split))
    secret = decodeURIComponent(decoded.slice(split + 1))
  }
  const client = await getClient(deps, id)
  if (client.token_endpoint_auth_method !== 'none') {
    if (!secret || !client.secretHash || !safeEqual(sha256(secret), client.secretHash))
      throw new OAuthFailure('invalid_client', 'Client authentication failed.', 401)
  }
  return client
}

// --- Authorization ---------------------------------------------------------------------------------------

export interface AuthorizeRequest {
  client: Client
  redirectUri: string
  state?: string
  challenge: string
  scopes: Scope[]
  resource: string
}

// Checks the request /connect was opened with. Problems with the client or redirect address are shown on
// the page (never redirected); anything else goes back to the app as an OAuth error.
export async function checkAuthorizeRequest(deps: OAuthDeps, params: Record<string, string>): Promise<AuthorizeRequest> {
  const client = await getClient(deps, params.client_id).catch(() => {
    throw new OAuthFailure('invalid_client', 'This app is not registered with KenDo.')
  })
  const redirectUri = params.redirect_uri || (client.redirect_uris.length === 1 ? client.redirect_uris[0] : '')
  if (!client.redirect_uris.includes(redirectUri) || !redirectAllowed(redirectUri))
    throw new OAuthFailure('invalid_redirect_uri', 'The app sent an unexpected return address.')
  const back = (code: string, message: string) => new RedirectFailure(code, message, redirectUri, params.state)
  if (params.response_type !== 'code') throw back('unsupported_response_type', 'Only the code flow is supported.')
  if (!params.code_challenge || params.code_challenge_method !== 'S256' || !/^[\w-]{43,128}$/.test(params.code_challenge))
    throw back('invalid_request', 'PKCE with S256 is required.')
  const resource = params.resource || resourceUrl()
  if (resource.replace(/\/$/, '') !== resourceUrl()) throw back('invalid_target', 'Tokens can only be issued for the KenDo MCP server.')
  return { client, redirectUri, state: params.state, challenge: params.code_challenge, scopes: parseScopes(params.scope), resource: resourceUrl() }
}

export class RedirectFailure extends OAuthFailure {
  constructor(
    code: string,
    message: string,
    readonly redirectUri: string,
    readonly state?: string,
  ) {
    super(code, message)
  }
  get location() {
    return withParams(this.redirectUri, { error: this.code, error_description: this.message, state: this.state, iss: baseUrl() })
  }
}

function withParams(uri: string, params: Record<string, string | undefined>) {
  const url = new URL(uri)
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, v)
  return url.toString()
}

export function describeRequest(req: AuthorizeRequest) {
  return {
    client_name: req.client.client_name,
    redirect_host: new URL(req.redirectUri).host,
    scopes: req.scopes.map((s) => ({ scope: s, label: SCOPES[s] })),
  }
}

// The person approved (or declined) on /connect. Returns where to send the browser next.
export async function decide(
  deps: OAuthDeps,
  params: Record<string, string>,
  idToken: string,
  approve: boolean,
  chosenScopes?: string[],
) {
  const req = await checkAuthorizeRequest(deps, params)
  const user = await deps.verifyIdToken(idToken).catch(() => {
    throw new OAuthFailure('access_denied', 'Please sign in to KenDo again.', 401)
  })
  if (!approve) return withParams(req.redirectUri, { error: 'access_denied', state: req.state, iss: baseUrl() })
  const scopes = chosenScopes ? req.scopes.filter((s) => chosenScopes.includes(s)) : req.scopes
  if (!scopes.length) return withParams(req.redirectUri, { error: 'access_denied', state: req.state, iss: baseUrl() })

  const code = random(32)
  await col(deps, 'oauthCodes').doc(sha256(code)).set({
    uid: user.uid,
    clientId: req.client.client_id,
    clientName: req.client.client_name,
    redirectUri: req.redirectUri,
    challenge: req.challenge,
    scopes,
    resource: req.resource,
    expiresAt: now(deps) + CODE_SECONDS * 1000,
    expireAt: new Date(now(deps) + 24 * 3_600_000),
    used: false,
  })
  return withParams(req.redirectUri, { code, state: req.state, iss: baseUrl() })
}

// --- Tokens ------------------------------------------------------------------------------------------------

export const connectionDoc = (deps: OAuthDeps, uid: string, grantId: string) =>
  deps.db.collection('users').doc(uid).collection('connections').doc(grantId)

interface TokenRecord {
  kind: 'access' | 'refresh'
  uid: string
  clientId: string
  grantId: string
  scopes: Scope[]
  resource: string
  expiresAt: number
  used?: boolean
}

function issue(deps: OAuthDeps, tx: FirebaseFirestore.Transaction, base: Omit<TokenRecord, 'kind' | 'expiresAt'>) {
  const access = random(32)
  const refresh = random(32)
  const t = now(deps)
  const put = (token: string, kind: TokenRecord['kind'], seconds: number) =>
    tx.set(col(deps, 'oauthTokens').doc(sha256(token)), {
      ...base,
      kind,
      expiresAt: t + seconds * 1000,
      // For an optional Firestore TTL policy on this field.
      expireAt: new Date(t + seconds * 1000),
    })
  put(access, 'access', ACCESS_TOKEN_SECONDS)
  put(refresh, 'refresh', REFRESH_TOKEN_SECONDS)
  return {
    access_token: access,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_SECONDS,
    refresh_token: refresh,
    scope: base.scopes.join(' '),
  }
}

export async function exchange(deps: OAuthDeps, params: Record<string, string>, authorization: string | null) {
  const client = await authenticateClient(deps, params, authorization)
  if (params.grant_type === 'authorization_code') return exchangeCode(deps, client, params)
  if (params.grant_type === 'refresh_token') return refresh(deps, client, params)
  throw new OAuthFailure('unsupported_grant_type', 'Use authorization_code or refresh_token.')
}

async function exchangeCode(deps: OAuthDeps, client: Client, params: Record<string, string>) {
  if (!params.code || !params.code_verifier) throw new OAuthFailure('invalid_request', 'code and code_verifier are required.')
  const ref = col(deps, 'oauthCodes').doc(sha256(params.code))
  const result = await deps.db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const code = snap.data()
    if (!code || code.clientId !== client.client_id) throw new OAuthFailure('invalid_grant', 'The code is not valid.')
    if (code.used) {
      // A code used twice may have been stolen: cut off whatever it produced.
      // (Returned rather than thrown, so the removal is committed.)
      if (code.grantId) tx.delete(connectionDoc(deps, code.uid, code.grantId))
      return null
    }
    if (code.expiresAt < now(deps)) throw new OAuthFailure('invalid_grant', 'The code has expired.')
    if ((params.redirect_uri || code.redirectUri) !== code.redirectUri) throw new OAuthFailure('invalid_grant', 'redirect_uri does not match.')
    if (!/^[\w.~-]{43,128}$/.test(params.code_verifier) || !safeEqual(s256(params.code_verifier), code.challenge))
      throw new OAuthFailure('invalid_grant', 'PKCE verification failed.')
    if (params.resource && params.resource.replace(/\/$/, '') !== code.resource) throw new OAuthFailure('invalid_target', 'Wrong resource.')

    const grantId = random(12)
    tx.update(ref, { used: true, grantId })
    tx.set(connectionDoc(deps, code.uid, grantId), {
      clientId: client.client_id,
      clientName: code.clientName,
      scopes: code.scopes,
      createdAt: now(deps),
      lastUsedAt: now(deps),
    })
    return issue(deps, tx, { uid: code.uid, clientId: client.client_id, grantId, scopes: code.scopes, resource: code.resource })
  })
  if (!result) throw new OAuthFailure('invalid_grant', 'The code has already been used.')
  return result
}

async function refresh(deps: OAuthDeps, client: Client, params: Record<string, string>) {
  if (!params.refresh_token) throw new OAuthFailure('invalid_request', 'refresh_token is required.')
  const ref = col(deps, 'oauthTokens').doc(sha256(params.refresh_token))
  const result = await deps.db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const token = snap.data() as TokenRecord | undefined
    if (!token || token.kind !== 'refresh' || token.clientId !== client.client_id) throw new OAuthFailure('invalid_grant', 'The refresh token is not valid.')
    const connection = connectionDoc(deps, token.uid, token.grantId)
    const grant = await tx.get(connection)
    if (token.used) {
      // Refresh tokens rotate; seeing an old one again means it leaked, so end the whole connection.
      // (Returned rather than thrown, so the removal is committed.)
      tx.delete(connection)
      return null
    }
    if (token.expiresAt < now(deps)) throw new OAuthFailure('invalid_grant', 'The refresh token has expired.')
    if (!grant.exists) throw new OAuthFailure('invalid_grant', 'This connection was removed in KenDo.')
    const scopes = params.scope ? parseScopes(params.scope).filter((s) => token.scopes.includes(s)) : token.scopes
    if (!scopes.length) throw new OAuthFailure('invalid_scope', 'No usable scopes.')
    tx.update(ref, { used: true })
    tx.update(connection, { lastUsedAt: now(deps) })
    return issue(deps, tx, { uid: token.uid, clientId: token.clientId, grantId: token.grantId, scopes, resource: token.resource })
  })
  if (!result) throw new OAuthFailure('invalid_grant', 'The refresh token has already been used.')
  return result
}

export async function revoke(deps: OAuthDeps, params: Record<string, string>, authorization: string | null) {
  const client = await authenticateClient(deps, params, authorization)
  if (!params.token) return
  const ref = col(deps, 'oauthTokens').doc(sha256(params.token))
  const snap = await ref.get()
  const token = snap.data() as TokenRecord | undefined
  // RFC 7009: unknown tokens (or another client's) are quietly ignored.
  if (!token || token.clientId !== client.client_id) return
  await ref.delete()
  if (token.kind === 'refresh') await connectionDoc(deps, token.uid, token.grantId).delete()
}

export interface VerifiedToken {
  uid: string
  clientId: string
  clientName: string
  grantId: string
  scopes: Scope[]
  resource: string
  expiresAt: number
}

// Used by /mcp on every request. The connection must still exist, so disconnecting in Settings is instant.
export async function verifyAccessToken(deps: OAuthDeps, token: string): Promise<VerifiedToken | null> {
  if (!token || token.length > 200) return null
  const snap = await col(deps, 'oauthTokens').doc(sha256(token)).get()
  const record = snap.data() as TokenRecord | undefined
  if (!record || record.kind !== 'access' || record.expiresAt <= now(deps)) return null
  const connection = await connectionDoc(deps, record.uid, record.grantId).get()
  if (!connection.exists) return null
  // "Last used" in Settings, without writing on every call.
  if (now(deps) - ((connection.get('lastUsedAt') as number) ?? 0) > 10 * 60_000)
    await connection.ref.update({ lastUsedAt: now(deps), uses: FieldValue.increment(1) }).catch(() => undefined)
  return {
    uid: record.uid,
    clientId: record.clientId,
    clientName: (connection.get('clientName') as string) ?? 'AI app',
    grantId: record.grantId,
    scopes: record.scopes,
    resource: record.resource,
    expiresAt: record.expiresAt,
  }
}
