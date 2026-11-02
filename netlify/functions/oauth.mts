import type { Config } from '@netlify/functions'
import { getAuth } from 'firebase-admin/auth'
import { adminDb } from '../lib/admin.mts'
import { handleOAuth } from '../lib/mcp/oauthRoutes.mts'

// Sign-in for AI apps (ChatGPT, GitHub Copilot, Copilot Studio) connecting to KenDo's MCP server.
export default (req: Request) => {
  const db = adminDb()
  return handleOAuth(req, {
    db,
    // Revoked or disabled Firebase accounts can't approve new connections.
    verifyIdToken: (token) => getAuth().verifyIdToken(token, true),
  })
}

export const config: Config = {
  path: [
    '/oauth/register',
    '/oauth/token',
    '/oauth/revoke',
    '/oauth/authorize/check',
    '/oauth/authorize/decision',
    '/.well-known/oauth-authorization-server',
    '/.well-known/oauth-protected-resource',
    '/.well-known/oauth-protected-resource/mcp',
  ],
}
