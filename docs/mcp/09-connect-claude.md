# 09 · Connect Claude (works on the free plan)

> Claude's help pages couldn't be opened from the build environment, so menu names are from what I know as of mid-2026; check them once. At that time the free Claude plan allowed **one** custom connector, which is all KenDo needs.

## What you need

* A Claude account (free is fine) at https://claude.ai.
* KenDo deployed with the MCP server (PR #1 merged).

## Steps (on a computer, in the browser)

1. Open https://claude.ai and sign in.
2. Click your name (bottom left) → **Settings** → **Connectors**.
3. Click **Add custom connector**.
4. Name: `KenDo`. Remote MCP server URL: `https://kendoktb.netlify.app/mcp` (also on KenDo's **Settings → AI apps**, with a Copy button). Leave the advanced OAuth fields empty.
5. Click **Add**, then **Connect** next to KenDo.
6. A KenDo window opens. Sign in to KenDo with your own account, untick anything Claude shouldn't do, and press **Allow**.
7. Back in Claude, start a new chat. In the **+** / tools menu, check that **KenDo** is switched on.

Claude now shows under **Settings → AI apps** in KenDo, where **Disconnect** cuts it off at once.

The connector is saved to the Claude account, so it also works in the Claude apps on Android and iPhone once added on the web.

## Things to try

* "What's on my KenDo list today, most important first?"
* "Add a KenDo task to call Mum tomorrow at 6pm."
* "Look at my KenDo priority matrix and tell me what needs attention this week."
* "Plan my afternoon in KenDo between 1pm and 5pm. Show me the plan before changing anything."
* "Turn my latest KenDo note into tasks."

Claude asks before using a KenDo tool that changes something; choose **Allow once** or **Always allow** as you prefer. Bigger changes are always shown as a plan first.

## If it doesn't work

| Symptom | Fix |
| --- | --- |
| "Add custom connector" is missing or greyed out | The free plan's one connector is already used, or the plan rules changed; remove another custom connector or check Claude's plan page |
| KenDo says the return address isn't allowed | Add the exact address it shows to Netlify env `MCP_REDIRECT_URIS` (Claude's `https://claude.ai/api/mcp/auth_callback` is already allowed) |
| Claude says it can't reach KenDo | Check `https://kendoktb.netlify.app/.well-known/oauth-authorization-server` opens |
