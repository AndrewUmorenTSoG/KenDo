import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { createHash, randomBytes } from 'node:crypto'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { handleMcp } from '../mcpRoute.mts'
import { decide, exchange, registerClient, type OAuthDeps } from '../oauth.mts'
import { handleOAuth } from '../oauthRoutes.mts'

export const PROJECT = 'demo-kendo'
export const hasEmulator = !!process.env.FIRESTORE_EMULATOR_HOST

export function db(): Firestore {
  if (!getApps().length) initializeApp({ projectId: PROJECT })
  return getFirestore()
}

export async function clearDb() {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' })
}

// Firebase ID tokens in tests are just "uid:<uid>".
export const deps = (): OAuthDeps => ({
  db: db(),
  verifyIdToken: async (token) => {
    if (!token.startsWith('uid:')) throw new Error('bad token')
    return { uid: token.slice(4) }
  },
})

// The deployed site, in process: every request to https://kendo.test goes to the two functions.
export const site: typeof fetch = async (input, init) => {
  const req = input instanceof Request ? input : new Request(input, init)
  const path = new URL(req.url).pathname
  if (path === '/mcp') return handleMcp(req, deps())
  return handleOAuth(req, deps())
}

export const pkce = () => {
  const verifier = randomBytes(32).toString('base64url')
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') }
}

export const REDIRECT = 'https://chatgpt.com/connector_platform_oauth_redirect'

// Runs the OAuth flow as an AI app would, with the person approving on /connect.
export async function connect(uid: string, scope?: string, clientName = 'ChatGPT') {
  const d = deps()
  const client = await registerClient(d, { client_name: clientName, redirect_uris: [REDIRECT] })
  const { verifier, challenge } = pkce()
  const params = {
    response_type: 'code',
    client_id: client.client_id,
    redirect_uri: REDIRECT,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: 'xyz',
    ...(scope ? { scope } : {}),
  }
  const redirect = new URL(await decide(d, params, `uid:${uid}`, true))
  const code = redirect.searchParams.get('code')!
  const tokens = await exchange(d, { grant_type: 'authorization_code', code, code_verifier: verifier, client_id: client.client_id, redirect_uri: REDIRECT }, null)
  return { client, tokens }
}

export async function mcpClient(accessToken: string) {
  const client = new Client({ name: 'kendo-test', version: '1.0.0' })
  const transport = new StreamableHTTPClientTransport(new URL('https://kendo.test/mcp'), {
    fetch: site,
    requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
  await client.connect(transport)
  return client
}

// Calls a tool and returns its structured answer.
export async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const res = await client.callTool({ name, arguments: args })
  return res.structuredContent as { success: boolean; result: any; error?: { code: string; message: string }; action?: string }
}

export async function seedUser(uid: string, profile: Record<string, unknown> = {}) {
  await db().collection('users').doc(uid).set({ name: uid, timeZone: 'Europe/London', seeded: true, ...profile })
}

export async function seedTask(uid: string, data: Record<string, unknown>, id?: string, path?: string) {
  const col = path ? db().collection(path) : db().collection('users').doc(uid).collection('tasks')
  const ref = id ? col.doc(id) : col.doc()
  const now = Date.now()
  await ref.set({
    title: 'Task',
    description: '',
    projectId: null,
    priority: 'medium',
    status: 'todo',
    energy: 'low',
    important: false,
    date: '',
    time: '',
    estimate: 25,
    repeat: 'never',
    tags: [],
    subtasks: [],
    comments: [],
    activity: [],
    dependsOn: null,
    noteId: null,
    reminder: false,
    remindAt: null,
    reminderSent: false,
    completedOn: null,
    uid,
    createdAt: now,
    updatedAt: now,
    ...data,
  })
  return ref.id
}

// create_task only previews; this approves and applies it, then returns the task as get_task shows it.
export async function createTask(client: Client, args: Record<string, unknown>) {
  const preview = await call(client, 'create_task', args)
  if (!preview.success) return preview
  const applied = await call(client, 'apply_plan', { plan_id: preview.result.plan_id, confirmation_code: preview.result.confirmation_code })
  if (!applied.success) return applied
  return { ...(await call(client, 'get_task', { task_id: preview.result.task.id })), action: 'created' }
}
