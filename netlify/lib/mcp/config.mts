// Settings for the KenDo connector (the MCP server and its sign-in), read from Netlify environment variables.

export const SCOPES = {
  'kendo:tasks:read': 'See your tasks and reminders',
  'kendo:tasks:write': 'Add, change, complete and delete tasks',
  'kendo:projects:read': 'See your projects',
  'kendo:projects:write': 'Add and rename projects',
  'kendo:matrix:read': 'See your priority matrix',
  'kendo:matrix:write': 'Rearrange your priority matrix',
  'kendo:calendar:read': 'See your calendar',
  'kendo:notes:read': 'See your notes',
  'kendo:notes:write': 'Add and change notes',
  'kendo:reminders:write': 'Set and cancel reminders',
} as const

export type Scope = keyof typeof SCOPES
export const ALL_SCOPES = Object.keys(SCOPES) as Scope[]
export const isScope = (s: string): s is Scope => s in SCOPES

export const ACCESS_TOKEN_SECONDS = 60 * 60
export const REFRESH_TOKEN_SECONDS = 30 * 24 * 60 * 60
export const CODE_SECONDS = 5 * 60
export const PLAN_SECONDS = 15 * 60

// The site's public address: KENDO_PUBLIC_URL if set, else Netlify's own (the primary domain in
// production, the preview's address on deploy previews and branch deploys).
export function baseUrl() {
  const env = process.env
  const netlify = env.CONTEXT && env.CONTEXT !== 'production' ? env.DEPLOY_PRIME_URL || env.URL : env.URL
  const url = env.KENDO_PUBLIC_URL || netlify || 'http://localhost:8888'
  return url.replace(/\/+$/, '')
}

export const resourceUrl = () => `${baseUrl()}/mcp`
export const resourceMetadataUrl = () => `${baseUrl()}/.well-known/oauth-protected-resource/mcp`

// Where AI apps may send people back after they approve the connection. Loopback addresses (VS Code on
// the same computer) are always allowed. An entry matches exactly or as a path prefix.
const REDIRECTS = [
  'https://chatgpt.com/connector_platform_oauth_redirect',
  'https://chatgpt.com/connector/oauth',
  'https://platform.openai.com/apps-manage/oauth',
  'https://vscode.dev/redirect',
  'https://insiders.vscode.dev/redirect',
  'https://global.consent.azure-apim.net/redirect',
  'https://claude.ai/api/mcp/auth_callback',
  'https://claude.com/api/mcp/auth_callback',
]
// Power Platform (Copilot Studio) also uses regional consent hosts.
const REDIRECT_PATTERNS = [/^https:\/\/[a-z0-9-]+\.consent\.azure-apim\.net\/redirect(\/|$)/]

export function redirectAllowed(uri: string) {
  let url: URL
  try {
    url = new URL(uri)
  } catch {
    return false
  }
  if (url.hash || url.username || url.password) return false
  if (url.protocol === 'http:') return ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:') return false
  const extra = (process.env.MCP_REDIRECT_URIS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const clean = `${url.origin}${url.pathname}`
  return (
    [...REDIRECTS, ...extra].some((entry) => clean === entry || clean.startsWith(entry.endsWith('/') ? entry : `${entry}/`)) ||
    REDIRECT_PATTERNS.some((re) => re.test(clean))
  )
}

// Browser origins allowed to call /mcp. Desktop apps and servers send no Origin header and are unaffected.
const ORIGINS = [
  'https://chatgpt.com',
  'https://chat.openai.com',
  'https://vscode.dev',
  'https://insiders.vscode.dev',
  'https://github.com',
  'https://claude.ai',
  'https://copilotstudio.microsoft.com',
]

export function originAllowed(origin: string | null) {
  if (!origin) return true
  const extra = (process.env.MCP_ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (origin.startsWith('vscode-')) return true
  return [baseUrl(), ...ORIGINS, ...extra].includes(origin)
}

export function authorizationServerMetadata() {
  const base = baseUrl()
  return {
    issuer: base,
    authorization_endpoint: `${base}/connect`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    revocation_endpoint: `${base}/oauth/revoke`,
    scopes_supported: ALL_SCOPES,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    revocation_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
    service_documentation: 'https://github.com/andrewumorentsog/kendo/tree/main/docs/mcp',
  }
}

export function protectedResourceMetadata() {
  return {
    resource: resourceUrl(),
    authorization_servers: [baseUrl()],
    scopes_supported: ALL_SCOPES,
    bearer_methods_supported: ['header'],
    resource_name: 'KenDo',
    resource_documentation: 'https://github.com/andrewumorentsog/kendo/tree/main/docs/mcp',
  }
}
