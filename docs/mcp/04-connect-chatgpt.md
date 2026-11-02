# 04 · Connect ChatGPT

> I couldn't open OpenAI's help pages from the build environment (network blocked), so the plan and menu details below are from what I know as of mid-2026 and need a quick check on the day. The server side follows the MCP authorization spec and is tested with the official MCP client.

## What you need

* KenDo deployed with this branch merged (Netlify), and `FIREBASE_SERVICE_ACCOUNT` set as it already is.
* A ChatGPT plan that allows custom MCP connectors with write actions. At the time of writing that is **developer mode** (Settings → Apps & Connectors → Advanced → Developer mode) on Plus and Pro, and admin-enabled connectors on Business/Enterprise/Edu. Free accounts can't add custom connectors. OpenAI changes this often; if the option is missing, that's the reason, not KenDo.

## Steps

1. In KenDo, open **Settings → AI apps** and copy the link (`https://kendoktb.netlify.app/mcp`).
2. In ChatGPT: **Settings → Apps & Connectors → Create** (or "Add custom connector").
3. Name: `KenDo`. MCP server URL: paste the link. Authentication: **OAuth**. Leave client id/secret empty (ChatGPT registers itself).
4. Tick that you trust the app, then **Create**. ChatGPT opens KenDo's sign-in.
5. Sign in to KenDo as usual, untick anything you don't want ChatGPT to have, and press **Allow**.
6. In a chat, pick KenDo from the tools/apps menu (in developer mode ChatGPT asks before each write).

ChatGPT now appears under **Settings → AI apps** in KenDo, where **Disconnect** cuts it off at once.

## Return address

ChatGPT's OAuth return address is allowlisted: `https://chatgpt.com/connector_platform_oauth_redirect` (plus `https://chatgpt.com/connector/oauth/…` and `https://platform.openai.com/apps-manage/oauth`). If ChatGPT shows "redirect URI not allowed", add the exact address it used to Netlify env `MCP_REDIRECT_URIS` and redeploy.

## First things to try

1. "Using KenDo, show me everything due today, ordered by priority."
2. "Create a KenDo task to submit my assignment tomorrow at 6 pm."
3. "Analyse my KenDo priority matrix and tell me what needs attention this week."
4. "Move my unfinished tasks from today to Friday. Show me the plan first."
5. "Create a recurring Bible study task on Thursdays at 7 pm."
