# 08 · Implementation task matrix

The development plan for this integration (not KenDo's priority matrix).

| ID | Phase | Owner | Depends on | Priority | Deliverable | Test / acceptance | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M1 | Inspect | Claude Code | – | High | `00-existing-system-audit.md` | Facts cite files; matrix meaning confirmed from `MatrixPage.tsx` | Done |
| M2 | Domain | Claude Code | M1 | High | `src/lib/taskRules.ts`, `matrixRank` field | App builds; matrix page unchanged except ranked order | Done |
| M3 | Auth | Claude Code | M1 | High | OAuth server, discovery, DCR, CIMD, consent page | `oauth.test.mts` | Done |
| M4 | MCP | Claude Code | M2, M3 | High | `/mcp`, 32 tools | `mcp.test.mts`, official client | Done |
| M5 | Matrix and planning | Claude Code | M4 | High | analyse, preview, apply, undo, schedule | matrix and bulk tests | Done |
| M6 | Reminders | Claude Code | M4 | High | set/cancel reminders in tz | `reminders.test.mts`, BST tests | Done |
| M7 | Settings | Claude Code | M3 | Medium | AI apps list with Disconnect | Disconnect stops calls (test 6) | Done |
| M8 | Look and feel | Codex | M7 | Low | Polish `/connect` and Settings → AI apps to the design system if wanted | Visual check on phone and PC | Open |
| M9 | Deploy | Andrew | M1–M7 | High | Merge PR (one 15-credit deploy) | `curl` checks in 06 | Open |
| M10 | ChatGPT | Andrew | M9 | High | Connector added, approved | Five prompts in 04 work; task shows in KenDo | Open |
| M11 | VS Code | Andrew | M9 | Medium | `kendo` server added | Agenda answer in agent mode | Open |
| M12 | Copilot Studio | Andrew | M9 | Low | Only with a licence/trial | Agent lists KenDo tools | Open |
| M13 | Stricter approval (optional) | Claude Code + Codex | M5 | Low | Approve plans inside KenDo instead of a code in chat | Plan can't apply until tapped in KenDo | Idea |
