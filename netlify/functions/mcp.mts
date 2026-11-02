import type { Config } from '@netlify/functions'
import { getAuth } from 'firebase-admin/auth'
import { adminDb } from '../lib/admin.mts'
import { handleMcp } from '../lib/mcp/mcpRoute.mts'

// KenDo's MCP server: AI apps (ChatGPT, GitHub Copilot, Copilot Studio) read and manage KenDo here.
export default (req: Request) => {
  const db = adminDb()
  return handleMcp(req, { db, verifyIdToken: (token) => getAuth().verifyIdToken(token, true) })
}

export const config: Config = { path: '/mcp' }
