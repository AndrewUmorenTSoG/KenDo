# 05 · Connect GitHub Copilot and Copilot Studio

> Microsoft's and VS Code's docs couldn't be opened from the build environment, so menu names here are from what I know as of mid-2026. The server is standards-based (Streamable HTTP, OAuth 2.1 + PKCE with discovery, DCR and client metadata documents) and was tested with the official MCP client doing the same flow VS Code does.

## GitHub Copilot in VS Code (agent mode)

Needs VS Code with GitHub Copilot (any Copilot plan, including Free; organisations can switch MCP off by policy).

1. Command Palette → **MCP: Add Server…** → **HTTP**, URL `https://kendoktb.netlify.app/mcp`, name `kendo`. Or create `.vscode/mcp.json` (workspace) or add to your user `mcp.json`:

   ```json
   {
     "servers": {
       "kendo": {
         "type": "http",
         "url": "https://kendoktb.netlify.app/mcp"
       }
     }
   }
   ```

2. Start the server (the **Start** link above it in `mcp.json`, or **MCP: List Servers**). VS Code finds KenDo's sign-in by itself and opens the browser.
3. Sign in to KenDo, press **Allow**. VS Code returns via `http://127.0.0.1:<port>` or `https://vscode.dev/redirect`, both allowlisted.
4. Open Copilot Chat in **Agent** mode, check `kendo` in the tools list, and ask "What's on my KenDo agenda this week?". VS Code asks before running write tools.

This repo deliberately doesn't commit a `.vscode/mcp.json` (it's ignored by `.gitignore`); the snippet above is the whole file.

## Microsoft Copilot Studio (custom agents)

Copilot Studio can add an existing MCP server to an agent with OAuth 2.0. Licensing: it needs a Copilot Studio licence or trial in a Power Platform environment, which costs money after the trial; KenDo itself stays free.

1. In your agent: **Tools → Add a tool → New tool → Model Context Protocol**.
2. Server name `KenDo`, description "Kenny's tasks and notes", server URL `https://kendoktb.netlify.app/mcp`.
3. Authentication **OAuth 2.0**, type **Dynamic discovery** (uses `/.well-known/…` and registers itself). If your tenant only offers **Manual**, register a client first:

   ```bash
   curl -X POST https://kendoktb.netlify.app/oauth/register \
     -H 'Content-Type: application/json' \
     -d '{"client_name":"Copilot Studio","token_endpoint_auth_method":"client_secret_post","redirect_uris":["https://global.consent.azure-apim.net/redirect/<from Copilot Studio>"]}'
   ```

   and enter: client id and secret from the answer, authorisation URL `https://kendoktb.netlify.app/connect`, token URL `https://kendoktb.netlify.app/oauth/token`, refresh URL the same, scopes `kendo:tasks:read kendo:tasks:write kendo:projects:read kendo:matrix:read kendo:matrix:write kendo:calendar:read kendo:notes:read kendo:notes:write kendo:reminders:write`.
4. Create the connection and sign in to KenDo when asked.

Power Platform consent hosts (`https://global.consent.azure-apim.net/redirect…` and regional `https://<region>.consent.azure-apim.net/redirect…`) are allowlisted.

## Other Copilots

* **Microsoft 365 Copilot / Copilot app (consumer):** no way to add your own MCP server today, other than through a Copilot Studio agent published to Microsoft 365. Not supported directly.
* **Copilot coding agent on GitHub.com:** has its own MCP settings per repository and is meant for coding tasks; not a sensible home for KenDo.
* **Claude** (bonus): Settings → Connectors → Add custom connector with the same URL works with the same sign-in (its return address is allowlisted).
