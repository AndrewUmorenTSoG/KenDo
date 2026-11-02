import { authorizationServerMetadata, baseUrl, protectedResourceMetadata } from './config.mts'
import { BodyError, cors, json, readJson, readParams } from './http.mts'
import {
  checkAuthorizeRequest,
  decide,
  describeRequest,
  exchange,
  OAuthFailure,
  RedirectFailure,
  registerClient,
  revoke,
  type OAuthDeps,
} from './oauth.mts'

const stringRecord = (v: unknown): Record<string, string> =>
  v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === 'string')) : {}

function failure(err: unknown) {
  if (err instanceof RedirectFailure) return json({ error: err.code, error_description: err.message, redirect: err.location }, 400, cors)
  if (err instanceof OAuthFailure) return json({ error: err.code, error_description: err.message }, err.status, cors)
  if (err instanceof BodyError) return json({ error: 'invalid_request', error_description: err.message }, err.status, cors)
  console.error('oauth error', err instanceof Error ? err.message : 'unknown')
  return json({ error: 'server_error', error_description: 'Something went wrong.' }, 500, cors)
}

// The consent page lives on the KenDo site itself, so only it may ask for codes.
const sameSite = (req: Request) => req.headers.get('origin') === baseUrl()

export async function handleOAuth(req: Request, deps: OAuthDeps): Promise<Response> {
  const path = new URL(req.url).pathname.replace(/\/+$/, '')
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

  if (path === '/.well-known/oauth-authorization-server')
    return json(authorizationServerMetadata(), 200, { ...cors, 'Cache-Control': 'public, max-age=3600' })
  if (path === '/.well-known/oauth-protected-resource' || path === '/.well-known/oauth-protected-resource/mcp')
    return json(protectedResourceMetadata(), 200, { ...cors, 'Cache-Control': 'public, max-age=3600' })

  if (req.method !== 'POST') return json({ error: 'invalid_request', error_description: 'Use POST.' }, 405, { ...cors, Allow: 'POST' })

  try {
    switch (path) {
      case '/oauth/register':
        return json(await registerClient(deps, await readJson(req)), 201, cors)
      case '/oauth/token':
        return json(await exchange(deps, await readParams(req), req.headers.get('authorization')), 200, { ...cors, Pragma: 'no-cache' })
      case '/oauth/revoke':
        await revoke(deps, await readParams(req), req.headers.get('authorization'))
        return new Response(null, { status: 200, headers: cors })
      case '/oauth/authorize/check': {
        if (!sameSite(req)) return json({ error: 'invalid_request' }, 403)
        const body = await readJson(req)
        return json(describeRequest(await checkAuthorizeRequest(deps, stringRecord(body.params))))
      }
      case '/oauth/authorize/decision': {
        if (!sameSite(req)) return json({ error: 'invalid_request' }, 403)
        const body = await readJson(req)
        const scopes = Array.isArray(body.scopes) ? body.scopes.filter((s): s is string => typeof s === 'string') : undefined
        const redirect = await decide(deps, stringRecord(body.params), String(body.idToken ?? ''), body.approve === true, scopes)
        return json({ redirect })
      }
    }
    return json({ error: 'not_found' }, 404, cors)
  } catch (err) {
    return failure(err)
  }
}
