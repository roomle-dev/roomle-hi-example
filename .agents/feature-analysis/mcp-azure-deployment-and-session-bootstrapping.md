> **Type**: Feature Analysis
> **Domain**: HI MCP Server, ligna-store integration, Azure deployment
> **Trigger**: "I need a solution where these three cases are possible: (1) MCP server local + store local, (2) MCP server local + deployed store, (3) MCP server in Azure + deployed store."
> **Date**: 2026-09-26
> **Author**: AI Assistant
> **Status**: Open (connectivity implemented and verified; the Azure deployment itself is the remaining step)

---

## Executive Summary

The PoC must run in three setups, with no code change between them — only configuration:

| # | MCP server | ligna-store page |
| - | ---------- | ---------------- |
| 1 | local, `http(s)://localhost:3100/mcp` | local, `http://localhost:3000/?store.stage=INT&id=…` |
| 2 | local, `http(s)://localhost:3100/mcp` | deployed, `https://www.roomle.com/t/ligna-store-test/?store.stage=INT&id=…` |
| 3 | Azure, `https://<app>.azurewebsites.net/mcp` | deployed, `https://www.roomle.com/t/ligna-store-test/?store.stage=INT&id=…&mcp_server=…` |

The clean solution is **one mechanism** that covers all three: the store page's bridge derives its
connection target from a single rule — *no `mcp_server` URL param → connect to `ws://localhost:3100`
(loopback is not mixed content, so this works from http and https pages alike; https pages add a
`wss://localhost:3100` fallback for browsers that refuse the loopback exemption); `mcp_server`
param → connect to that server, scheme normalized (`https`→`wss`)*. The server side is symmetric:
everything machine-specific (port, host, allowed page origins, TLS) is an environment variable
with a default that reproduces case 1 exactly.

**Status: implemented and verified** (commits in both repositories, see section 5). Cases 1 and 2
work today; case 3 needs only the Azure App Service deployment — the code supports it.

---

## 1. The Requirement

1. **Case 1** — everything local: `npm run dev` store, `npm start` MCP server, `ws://localhost:3100`.
2. **Case 2** — store deployed on `https://www.roomle.com/t/ligna-store-test/`, MCP server still on
   the developer machine. The page connects to `ws://localhost:3100` — loopback connections are
   **not** mixed content (w3c mixed-content spec / MDN), so this works from the https page with
   the plain local server; a `wss` fallback covers strict browsers (server then needs mkcert TLS).
3. **Case 3** — MCP server on Azure App Service; the deployed store page connects outward to the
   cloud server; MCP clients connect to the public `https://…/mcp` endpoint. This removes the
   same-machine restriction of case 2: any browser (the user's, a colleague's) can hold the
   session, and the agent can sit on any machine.

Not in scope (explicitly deferred, see section 6): the headless engine (section 16, scenario 3 of
[sales-configurator-ai-integration.md](./sales-configurator-ai-integration.md)); multi-user
session isolation; fire-and-forget task queues.

---

## 2. The Solution

### 2.1 One rule in the page bridge

`ligna-store/hi-mcp/browser-bridge.ts` (kept verbatim in sync with
`hi-mcp/hi-mcp-server/browser-bridge.ts`):

```ts
resolveBridgeUrl(serverUrl?) =
  serverUrl  ? normalize(serverUrl) + '/bridge'     // mcp_server param: ws(s) or http(s) input
             : `${page protocol === 'https:' ? 'wss' : 'ws'}://localhost:3100/bridge`
```

`Planner.vue` passes the `mcp_server` query param (absent by default). Result per case:

| Case | Page protocol | `mcp_server` | Bridge connects to |
| ---- | ------------- | ------------- | ------------------- |
| 1 | http | — | `ws://localhost:3100/bridge` |
| 2 | https | — | `ws://localhost:3100/bridge` (loopback is not mixed content), then `wss://localhost:3100/bridge` as fallback |
| 3 | https | `https://<app>.azurewebsites.net` | `wss://<app>.azurewebsites.net/bridge` |

### 2.2 Server configuration (environment variables, all optional)

`hi-mcp/hi-mcp-server/server.ts`:

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `HI_MCP_PORT` / `PORT` | `3100` | listen port; App Service injects `PORT` |
| `HOST` | all interfaces | bind address; set `0.0.0.0` explicitly on Azure if required |
| `HI_MCP_PAGE_ORIGINS` | `http://localhost:3000`, `http://127.0.0.1:3000`, `https://www.roomle.com` | comma-separated allowed page origins |
| `HI_MCP_TLS_CERT` + `HI_MCP_TLS_KEY` | (plain HTTP) | TLS for case 2 (mkcert); **not** needed on Azure — App Service terminates TLS in front |

No variables set → case 1, byte-for-byte the previous behavior.

### 2.3 What each case looks like in practice

| Case | Server start | Store URL | MCP client connects to |
| ---- | ------------ | --------- | ---------------------- |
| 1 | `npm start` | `http://localhost:3000/?store.stage=INT&id=ps_…` | `http://localhost:3100/mcp` |
| 2 | `npm start` | `https://www.roomle.com/t/ligna-store-test/?store.stage=INT&id=ps_…` | `http://localhost:3100/mcp` |
| 3 | deployed on App Service (section 3) | `https://www.roomle.com/t/ligna-store-test/?store.stage=INT&id=ps_…&mcp_server=https://<app>.azurewebsites.net` | `https://<app>.azurewebsites.net/mcp` |

---

## 3. Case 3: Azure App Service deployment (the remaining step)

Code-side everything is in place; what is left is deployment mechanics:

1. **Runtime**: App Service, Node 20 LTS; startup `npm start` (the `vite-node` runner works as a
   plain Node process for a PoC; if it ever causes trouble, a `tsc`/`vite build` node build replaces
   it — no protocol change involved).
2. **Configuration**: enable **WebSockets** in the App Service settings; app settings: nothing
   mandatory (`PORT` is injected; the default origin list already contains
   `https://www.roomle.com`; TLS is terminated by App Service, so `HI_MCP_TLS_*` stays unset).
3. **Store**: no further code change — the prepared URL carries `mcp_server`; the deployed store
   build must contain the `feat/hi-mcp` branch (bridge + hook).
4. **Security before going public**: an open `https://<app>/mcp` lets anyone drive a connected
   store page. For the PoC: keep the app name unguessable and time-boxed, or add a shared-secret
   header check on `/mcp`. Managed option later: App Service Easy Auth (per
   [Appendix D](./sales-configurator-ai-integration.md)). **Decision needed before exposing the
   endpoint beyond a demo.**

---

## 4. Verification (2026-09-26)

- **Unit tests**: 73 vitest tests green (70 previous + 3 for `resolveBridgeUrl`: https→wss,
  ws passthrough, http→ws + trailing slashes); `tsc --noEmit` clean.
- **Case 1** (regression): default start, `initialize` on `http://localhost:3100/mcp` → 200.
- **Case 2** (regression): TLS start → `initialize` on `https://localhost:3100/mcp` → 200,
  log shows the https scheme.
- **Case 3 wiring** (simulated locally): server on `HI_MCP_PORT=3200`, a fake store page
  connecting with `Origin: https://www.roomle.com` to `/bridge`, and a real MCP SDK client
  (`StreamableHTTPClientTransport`) calling `get-plan-context` through `/mcp` → call relayed to
  the page, page's result returned to the client. This verifies the full chain except Azure
  itself.

---

## 5. Implementation Record

| Repository | Commit | Change |
| ---------- | ------ | ------ |
| roomle-hi-example | (this change) | `server.ts`: env-driven port/host/origins; `browser-bridge.ts`: `resolveBridgeUrl` + `serverUrl` option; new `tests/browser-bridge.test.ts`; README config/case documentation; this rewritten analysis |
| roomle-hi-example | `fa27827` | TLS support (`HI_MCP_TLS_CERT`/`HI_MCP_TLS_KEY`), `https://www.roomle.com` origin, scheme auto-selection (cases 1+2) |
| ligna-store | (this change) | `browser-bridge.ts` re-synced; `Planner.vue` passes `mcp_server` to the bridge |
| ligna-store | `04875e3`, `cd7cbf1` | wss scheme selection; bridge + INT-stage hook |

---

## 6. Roadmap beyond the three cases (not needed for the PoC)

Kept for the later product discussion; none of it blocks the three cases:

1. **`open-store-page` tool** (section 16, scenarios 1+2): agent builds the case-3 URL with a
   session id and optionally opens the tab (`open`/`start`/`xdg-open`). Needs sessions first.
2. **Sessions / multi-user**: `PageBridge` currently holds one page (newest `hello` wins) —
   correct for one user; a public server with several users needs a session-keyed registry and an
   MCP-session ↔ page-session binding.
3. **Queued instructions** (fire-and-forget generation): needs storage (in-memory → Azure Storage).
4. **Endpoint auth**: shared-secret now, Easy Auth later (section 3.4).

---

## 7. Risks and Open Questions

1. **Public endpoint security** — decision needed before the Azure app is shared (section 3.4).
2. **`bo-test` HI APIs** — unchanged open item from [hi-mcp-poc-json.md](./hi-mcp-poc-json.md):
   whether the `bo-test` UI ships `getExternalObjectPlanContext` shows at the first
   `get-plan-context`; it is independent of all three connectivity cases.
3. **Plan id availability** — `ps_bse5tc50687uh64hm8jul7j1kiuacyx` must exist in the INT
   environment for cases 2 and 3.
4. **Session lifetime on Azure** — one page at a time; a second tab replaces the first (fine for
   the PoC, addressed by the sessions roadmap item).
