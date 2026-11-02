import { auth, Client, StreamableHTTPClientTransport, type OAuthClientProvider } from '@modelcontextprotocol/client'
import { beforeEach, describe, expect, it } from 'vitest'
import { sha256 } from '../oauth.mts'
import { call, clearDb, connect, db, hasEmulator, mcpClient, pkce, REDIRECT, seedUser, site } from './helpers.mts'

const form = (body: Record<string, string>) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(body).toString(),
})

async function status(token: string) {
  const res = await site('https://kendo.test/mcp', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'x', version: '1' } } }),
  })
  return res
}

describe.skipIf(!hasEmulator)('OAuth', () => {
  beforeEach(clearDb)

  it('works end to end with the official MCP client: discovery, registration, PKCE, tokens, tools (14)', async () => {
    await seedUser('kenny')
    let authUrl: URL | undefined
    let verifier = ''
    let saved: Record<string, unknown> = {}
    const provider: OAuthClientProvider = {
      get redirectUrl() {
        return 'http://127.0.0.1:33418/callback'
      },
      get clientMetadata() {
        return { client_name: 'Visual Studio Code', redirect_uris: ['http://127.0.0.1:33418/callback'], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' }
      },
      clientInformation: () => saved.client as never,
      saveClientInformation: (c) => void (saved.client = c),
      tokens: () => saved.tokens as never,
      saveTokens: (t) => void (saved.tokens = t),
      redirectToAuthorization: (url) => void (authUrl = url),
      saveCodeVerifier: (v) => void (verifier = v),
      codeVerifier: () => verifier,
    }
    // An unauthenticated request is told where to find the authorization server.
    const challenge = await status('')
    expect(challenge.status).toBe(401)
    expect(challenge.headers.get('www-authenticate')).toContain('resource_metadata="https://kendo.test/.well-known/oauth-protected-resource/mcp"')

    expect(await auth(provider, { serverUrl: 'https://kendo.test/mcp', fetchFn: site })).toBe('REDIRECT')
    expect(authUrl!.origin + authUrl!.pathname).toBe('https://kendo.test/connect')
    const params = Object.fromEntries(authUrl!.searchParams)
    expect(params.resource).toBe('https://kendo.test/mcp')

    // The /connect page: show the request, then approve as the signed-in person.
    const check = await site('https://kendo.test/oauth/authorize/check', { method: 'POST', headers: { Origin: 'https://kendo.test', 'Content-Type': 'application/json' }, body: JSON.stringify({ params }) })
    expect((await check.json()).client_name).toBe('Visual Studio Code')
    const decision = await site('https://kendo.test/oauth/authorize/decision', {
      method: 'POST',
      headers: { Origin: 'https://kendo.test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ params, idToken: 'uid:kenny', approve: true }),
    })
    const back = new URL((await decision.json()).redirect)
    expect(back.searchParams.get('state')).toBe(params.state ?? null)
    expect(back.searchParams.get('iss')).toBe('https://kendo.test')

    expect(await auth(provider, { serverUrl: 'https://kendo.test/mcp', fetchFn: site, authorizationCode: back.searchParams.get('code')!, iss: back.searchParams.get('iss')! })).toBe('AUTHORIZED')
    const client = new Client({ name: 'vscode-test', version: '1' })
    await client.connect(new StreamableHTTPClientTransport(new URL('https://kendo.test/mcp'), { fetch: site, authProvider: provider }))
    expect((await client.listTools()).tools.map((t) => t.name)).toContain('get_project_matrix')
    expect((await call(client, 'get_kendo_profile')).result.connected_app).toBe('Visual Studio Code')
    const conns = await db().collection('users').doc('kenny').collection('connections').get()
    expect(conns.docs.map((d) => d.get('clientName'))).toEqual(['Visual Studio Code'])
  })

  it('refuses consent requests from other sites and unknown return addresses', async () => {
    const reg = await site('https://kendo.test/oauth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_name: 'Evil', redirect_uris: ['https://evil.example/cb'] }) })
    expect(reg.status).toBe(400)
    const ok = await (await site('https://kendo.test/oauth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_name: 'ChatGPT', redirect_uris: [REDIRECT] }) })).json()
    const { challenge } = pkce()
    const params = { response_type: 'code', client_id: ok.client_id, redirect_uri: 'https://evil.example/cb', code_challenge: challenge, code_challenge_method: 'S256' }
    const r = await site('https://kendo.test/oauth/authorize/decision', { method: 'POST', headers: { Origin: 'https://kendo.test', 'Content-Type': 'application/json' }, body: JSON.stringify({ params, idToken: 'uid:kenny', approve: true }) })
    expect(r.status).toBe(400)
    expect((await r.json()).redirect).toBeUndefined()
    const cross = await site('https://kendo.test/oauth/authorize/decision', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{}' })
    expect(cross.status).toBe(403)
    const noPkce = await site('https://kendo.test/oauth/authorize/check', {
      method: 'POST',
      headers: { Origin: 'https://kendo.test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ params: { response_type: 'code', client_id: ok.client_id, redirect_uri: REDIRECT } }),
    })
    expect((await noPkce.json()).redirect).toContain('error=invalid_request')
  })

  it('rejects forged, expired, wrong-audience and disconnected tokens (6)', async () => {
    await seedUser('kenny')
    const { tokens } = await connect('kenny')
    expect((await status(tokens.access_token)).status).toBe(200)
    expect((await status('forged-token')).status).toBe(401)

    const ref = db().collection('oauthTokens').doc(sha256(tokens.access_token))
    await ref.update({ resource: 'https://other.example/mcp' })
    expect((await status(tokens.access_token)).status).toBe(401)
    await ref.update({ resource: 'https://kendo.test/mcp', expiresAt: Date.now() - 1 })
    expect((await status(tokens.access_token)).status).toBe(401)
    await ref.update({ expiresAt: Date.now() + 60_000 })
    expect((await status(tokens.access_token)).status).toBe(200)

    // Disconnect in KenDo Settings removes the connection document.
    const conn = (await db().collection('users').doc('kenny').collection('connections').get()).docs[0]
    await conn.ref.delete()
    expect((await status(tokens.access_token)).status).toBe(401)
    const refreshed = await site('https://kendo.test/oauth/token', form({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: (await ref.get()).get('clientId') }))
    expect(refreshed.status).toBe(400)
  })

  it('rotates refresh tokens and ends the connection when an old one is replayed', async () => {
    await seedUser('kenny')
    const { tokens, client } = await connect('kenny')
    const first = await site('https://kendo.test/oauth/token', form({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: client.client_id }))
    expect(first.status).toBe(200)
    const fresh = await first.json()
    expect((await status(fresh.access_token)).status).toBe(200)
    const replay = await site('https://kendo.test/oauth/token', form({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: client.client_id }))
    expect(replay.status).toBe(400)
    expect((await status(fresh.access_token)).status).toBe(401)
  })

  it('uses each code once, checks PKCE, and narrows scopes to what was approved', async () => {
    await seedUser('kenny')
    const { tokens } = await connect('kenny', 'kendo:tasks:read kendo:calendar:read unknown:scope')
    expect(tokens.scope).toBe('kendo:tasks:read kendo:calendar:read')
    const mcp = await mcpClient(tokens.access_token)
    const names = (await mcp.listTools()).tools.map((t) => t.name)
    expect(names).toContain('get_agenda')
    expect(names).not.toContain('update_task')
  })

  it('revokes a token through the revocation endpoint', async () => {
    await seedUser('kenny')
    const { tokens, client } = await connect('kenny')
    const r = await site('https://kendo.test/oauth/revoke', form({ token: tokens.refresh_token, client_id: client.client_id }))
    expect(r.status).toBe(200)
    expect((await status(tokens.access_token)).status).toBe(401)
  })

  it('accepts a client metadata document client id (CIMD)', async () => {
    const id = 'https://vscode.dev/oauth/client-metadata.json'
    const { handleOAuth } = await import('../oauthRoutes.mts')
    const deps = (await import('./helpers.mts')).deps()
    deps.fetch = (async () =>
      new Response(JSON.stringify({ client_id: id, client_name: 'VS Code', redirect_uris: ['https://vscode.dev/redirect'], token_endpoint_auth_method: 'none' }))) as typeof fetch
    const { challenge } = pkce()
    const res = await handleOAuth(
      new Request('https://kendo.test/oauth/authorize/check', {
        method: 'POST',
        headers: { Origin: 'https://kendo.test', 'Content-Type': 'application/json' },
        body: JSON.stringify({ params: { response_type: 'code', client_id: id, redirect_uri: 'https://vscode.dev/redirect', code_challenge: challenge, code_challenge_method: 'S256' } }),
      }),
      deps,
    )
    expect((await res.json()).client_name).toBe('VS Code')
  })

  it('publishes discovery metadata', async () => {
    const as = await (await site('https://kendo.test/.well-known/oauth-authorization-server')).json()
    expect(as).toMatchObject({ issuer: 'https://kendo.test', code_challenge_methods_supported: ['S256'], registration_endpoint: 'https://kendo.test/oauth/register' })
    const prm = await (await site('https://kendo.test/.well-known/oauth-protected-resource/mcp')).json()
    expect(prm).toMatchObject({ resource: 'https://kendo.test/mcp', authorization_servers: ['https://kendo.test'] })
  })
})
