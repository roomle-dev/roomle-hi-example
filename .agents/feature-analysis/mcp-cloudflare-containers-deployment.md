> **Type**: Feature Analysis
> **Domain**: HI MCP Server, Cloudflare deployment, multi-user access
> **Trigger**: "I want the MCP server hosted on Cloudflare so anyone in the company can open the store URL, register the MCP server in their client, and try it — without repository access. How does roomle-model-exporter (src/mcp) do it, and can we do it the same way?"
> **Date**: 2026-09-26
> **Author**: AI Assistant
> **Status**: Open

---

## Executive Summary

The hi-mcp server (`hi-mcp/hi-mcp-poc-json`) is to be **hosted on Cloudflare** — actually running
there, not tunneled from a laptop — so that anyone in the company can try the PoC with nothing but
two URLs: the deployed ligna-store page and the public MCP endpoint.

The reference is the **roomle-model-exporter** repository, which already runs its Planner MCP
server on Cloudflare (see
[planner-mcp-server-analysis.md](./planner-mcp-server-analysis.md), section 9.3). Its mechanism
was examined in the actual code (`roomle-model-exporter/cf/`): the server runs **unchanged inside
a Cloudflare Container**, and a small Worker fronts it — **no rewrite of the server for
Cloudflare**. This analysis concludes: **yes, hi-mcp can do it the same way**, with one material
difference and one genuine unknown:

- **Difference**: the exporter's tool calls execute *inside* the container (headless planner).
  hi-mcp's tool calls execute *in the browser page* (ligna-store) — the container is only a relay
  between MCP clients and a connected page. This difference is mostly favorable: our container is
  tiny (no GPU, no headless SDK) and cheap to run.
- **Unknown**: hi-mcp's `/bridge` needs a **WebSocket upgrade from a browser through the Worker
  into the container**. The exporter has no WebSocket at all (its MCP endpoint is POST-only HTTP),
  so it proves nothing about this path. The fallback is designed and small (terminate the
  WebSocket at the Worker edge, relay the frames over HTTP) — it must be verified **first** after
  the first deployment.

As a bonus, the exporter's per-user container allocation (`getByName`) solves hi-mcp's
multi-user limitation (single connected page) with platform means instead of a server rewrite:
one container per session isolates each colleague's page+agent pair.

---

## 1. What Was Asked and Why

1. **Hosting on Cloudflare**: the MCP server runs in the cloud, reachable by URL, independent of
   any developer machine (the earlier quick-tunnel was explicitly rejected for this reason — it
   dies with the laptop, and it was run without authorization once, which must not repeat).
2. **Company-wide try-out without repository access**: a colleague opens
   `https://www.roomle.com/t/ligna-store-test/?store.stage=INT&id=ps_…` (with the server parameter),
   registers the MCP server in their client (Claude, Mistral, …), and plans a kitchen. No git
   clone, no `npm install`, no tunnel.
3. **Simplest possible setup**, modeled on how the roomle-model-exporter already does it
   (`src/mcp` + `cf/`).

---

## 2. Current State

### 2.1 How roomle-model-exporter does it (verified in the code)

```text
MCP client ──https──> Worker (cf/src/worker.ts + mcp-api.ts, ~600 lines total)
                      ├─ initialize + tools/list: answered AT THE EDGE from a
                      │  static tool-manifest.json — no container touched
                      └─ tools/call: env.PLANNER.getByName(<signed-in email>)
                                        │  (container bound as a Durable Object)
                                        ▼
                          PlannerContainer (cf/src/planner-container.ts,
                          extends Container from @cloudflare/containers):
                          one container per user, sleepAfter 15m, retired after 4h,
                          plan snapshot saved before sleep and restored on boot
                                        ▼
                          the unchanged Bun MCP server (Dockerfile, PORT env,
                          MCP_MODE=1) — the same code that runs on Cloud Run
```

| File | Role |
| ---- | ---- |
| `cf/wrangler.jsonc` | Worker + container config: container class `PlannerContainer`, image `../Dockerfile`, `standard-2`, `max_instances: 20`, bound as a Durable Object class, KV namespace for OAuth sessions |
| `cf/src/planner-container.ts` | Container lifecycle: env vars per container, `sleepAfter`, retire schedule, snapshot/restore, `containerFetch` |
| `cf/src/mcp-api.ts` | Edge: answers MCP discovery from `tool-manifest.json`; forwards `tools/call` to the user's container with an internal token |
| `cf/src/google-auth.ts` | Google OAuth, restricted to `roomle.com` accounts, session cookie in KV |
| `.github/workflows/cd-cloudflare.yaml` | deploy = `npx wrangler deploy` with `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` secrets |
| `Dockerfile` | The server itself — unchanged code, `PORT` env |

### 2.2 The hi-mcp server today

Implemented per [mcp-azure-deployment-and-session-bootstrapping.md](./mcp-azure-deployment-and-session-bootstrapping.md):
cases 1–2 (local server, local and deployed store) work; case 3 (cloud server, deployed store) is
code-complete and configuration-only. Relevant facts:

- `server.ts`: env-driven `PORT`/`HOST`/`HI_MCP_PAGE_ORIGINS` (default contains
  `https://www.roomle.com`); `/mcp` is stateless Streamable HTTP (fresh `McpServer` per request);
  TLS is terminated in front (App Service or Cloudflare) — no certificates in the container.
- `page-bridge.ts`: **single connected page** (newest `hello` wins), call correlation, 30 s/120 s
  timeouts — the one-per-server limitation.
- Store bridge (`ligna-store/hi-mcp/browser-bridge.ts`): `mcp_server` URL param selects the
  server (`https://` → `wss://…/bridge`); without it, localhost.
- 73 unit tests, `tsc` clean; the full relay chain verified locally with a fake page and a real
  MCP SDK client.

### 2.3 The decisive architectural difference

| | exporter | hi-mcp |
| - | -------- | ------ |
| Tool execution | inside the container (headless SDK) | **in the browser page** (ligna-store) |
| Container workload | heavy (GPU rendering) | **tiny relay** (correlate calls, forward frames) |
| Browser ↔ server channel | none — HTTP POST only | **WebSocket `/bridge`** |
| Per-user isolation | container per user (OAuth email) | missing today (single page) |

Two consequences: (a) the WebSocket `/bridge` through the Cloudflare edge is **unproven** — the
exporter never routes a WebSocket; (b) the exporter's per-user container pattern maps directly
onto our multi-user gap and makes the container cheap.

---

## 3. Proposed Design

A new folder `hi-mcp/cf/` (the hi-mcp analog of the exporter's `cf/`), deployed to the Cloudflare
account as a Worker with one container:

```text
colleague's MCP client ──https──> https://hi-mcp-poc.<account>.workers.dev/mcp
                                   Worker: routes /mcp and /bridge to the container
                                   (session key from the URL; later: OAuth)
                                        ▼
                          HiMcpContainer (one per session; sleepAfter 15m)
                                        ▼
                          the unchanged hi-mcp Node server (PORT env, npm start)
                                        ▲
colleague's browser ───wss────>  …/bridge  (store page with mcp_server param)
```

### 3.1 Phase 1 — PoC (single shared session, no auth)

1. **Dockerfile**: `node:20`, copy the `hi-mcp` workspace, `npm install`, `npm start` (`PORT` env).
   `vite-node` runs as the container's process; if it misbehaves, the plain-Node build fallback
   applies (documented in [azure-mcp-server.md](../hi-mcp/docs/azure-mcp-server.md)).
2. **Container class** (analog of `planner-container.ts`): `extends Container`, `sleepAfter`
   short for the PoC; no snapshot/restore needed — the relay holds no durable state worth
   restoring (the page reconnects on its own).
3. **Worker**: routes both paths to **one** container (`getByName('default')`): `POST /mcp` →
   `container.fetch(request)`; `/bridge` WebSocket upgrade → forwarded the same way **if the
   platform passes upgrades** (see risk 6.1).
4. **Security posture**: unguessable worker name, time-boxed, deleted after the trial —
   same convention as the Azure guide. No OAuth yet.
5. Colleague flow: store URL
   `…?store.stage=INT&id=ps_…&mcp_server=https://hi-mcp-poc.<account>.workers.dev` and MCP client
   URL `https://hi-mcp-poc.<account>.workers.dev/mcp`. No store change needed (`mcp_server`
   param exists).
6. **Deploy is run by the requester** (`npx wrangler deploy` in their terminal) — per the agreed
   boundary, nothing cloud-side is executed by the assistant.

### 3.2 Phase 2 — company-wide (per-session containers)

The exporter's `getByName(email)` becomes `getByName(<session id>)` for us, because — unlike the
exporter — hi-mcp has **two** parties (MCP client *and* browser page) that must land in the same
container:

- The session id is an unguessable token in **both** URLs: `…/mcp?session=<id>` for the MCP
  client and `…&mcp_session=<id>` for the store page; the Worker routes both to
  `getByName(session)`.
- Store change needed: pass `mcp_session` through to the bridge and include it in the `hello`
  (the session field planned in the earlier analyses' wire protocol — backwards compatible).
- Result: every colleague gets an isolated container (own page registry, own pending calls);
  the single-page limitation disappears per container. Containers sleep after inactivity —
  a colleague "trying it" costs seconds of compute.
- Optional later: copy the exporter's `google-auth.ts` (roomle.com accounts) for managed access
  instead of handing out session links.

### 3.3 What stays untouched

The 9 tools, `tool-executors.ts`, `plan-space.ts`, the store hook logic, the authoring rules —
all page-side, all unchanged. Only routing/lifecycle code is new.

---

## 4. Implementation Plan

| # | Step | Who | Verify |
| - | ---- | ---- | ------ |
| 1 | `hi-mcp/cf/`: Dockerfile, container class, Worker (phase 1), `wrangler.jsonc` | assistant (code only) | `docker build` succeeds locally; container runs, `/mcp` answers in the local image |
| 2 | Unit tests for the Worker routing (container binding mocked) | assistant | `npm test` green |
| 3 | `wrangler deploy` | **requester, in their terminal** | `initialize` on `https://…workers.dev/mcp` → 200 |
| 4 | WebSocket passthrough check: open the store with `&mcp_server=…` | requester + assistant (logs) | `page connected` in `wrangler tail` |
| 5 | Only if 4 fails: edge WebSocket relay in the Worker (~50 lines: frames ↔ HTTP to the container; the wire protocol is tiny JSON messages) | assistant (code), requester (redeploy) | same check |
| 6 | Phase 2: session routing (`?session=` / `mcp_session`), store param passthrough, per-session containers | assistant (code), requester (redeploy) | two parallel sessions isolated |
| 7 | Docs: `hi-mcp/docs/cloudflare-mcp-server.md` (sibling of the Azure guide), analysis close-out | assistant | docs indexed |

Estimated effort for phase 1 (steps 1–5): well under a day — the exporter's `cf/` is the template,
and our container is a fraction of its weight.

**Status 2026-09-26**: steps 1–2 are implemented and verified locally — `hi-mcp/cf/` (Dockerfile,
`HiMcpContainer`, Worker routing, `wrangler.jsonc`), 3 Worker routing tests (76 total, `tsc`
clean), and the full local container proof: `docker build` of the exact image Cloudflare builds,
`initialize` → 200 inside the container, a page connecting with the `https://www.roomle.com`
origin over the bridge, and a complete MCP client → container → page → back round trip. Deploy
guide: [hi-mcp/docs/cloudflare-mcp-server.md](../hi-mcp/docs/cloudflare-mcp-server.md). Remaining
for the requester: step 3 (`cd hi-mcp/cf && npx wrangler deploy`, Workers Paid account) and
step 4 — the WebSocket passthrough check on the live deployment, the one unknown this
implementation cannot answer locally.

**Status 2026-09-26 (later), deployment done**: steps 3–5 are resolved — deployed by the
requester, **the WebSocket upgrade passes through the Worker into the container** (risk 6.1
answered: it works, no edge-relay fallback needed), and Mistral Le Chat drove the visible store
session end-to-end. Skill: [hi-mcp-cloudflare-deployment.md](../skills/hi-mcp-cloudflare-deployment.md);
agent guide: [connect-agent-to-cloud-mcp.md](../hi-mcp/docs/connect-agent-to-cloud-mcp.md).
Still open: phase 2 (per-session containers) and the access-control decision (6.3).

**Status 2026-09-26 (evening), phase 2 implemented**: per-session containers are live — the
Worker routes `?session=<id>` (MCP clients) and the store page's `mcp_session` → bridge URL
query to `getByName(<session>)`, so parallel users each get their own container and never
interfere; without a session id the shared `default` container is used. Store change: the
`mcp_session` parameter is passed through `Planner.vue` to the bridge (kept verbatim in sync
with the roomle-hi-example copy). Session names are user-chosen and act as weak access tokens
(see 6.3); managed auth remains open. Remaining: the access-control decision (6.3).

---

## 5. Prerequisites and Open Questions for the Requester

1. **Cloudflare plan**: Cloudflare Containers require the **Workers Paid** plan (~$5/month) on the
   account that deploys. The exporter's deployment (`roomle-planner-mcp.<account>.workers.dev`)
   lives on a Roomle account that already has this — **question for the exporter team**: which
   account is that, and how are `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` managed — reuse it,
   or use your own account with Workers Paid?
2. **Deploy**: `wrangler` login in the requester's terminal; the assistant never deploys.
3. **WebSocket passthrough** (risk 6.1): the first deploy exists to answer this question.
4. **Cost**: our container is a relay — the smallest instance type; sleeping after inactivity.
   Instance costs on Workers Paid are usage-based; for a handout-to-colleagues PoC this is
   negligible.

---

## 6. Risks and Open Questions

### 6.1 Risk: WebSocket upgrade through Worker → container (the core unknown)

The exporter routes only plain HTTP to containers; whether `containerFetch` passes WebSocket
upgrades is undocumented beta behavior. Two outcomes, both covered: (a) it works — nothing extra
to build; (b) it fails — the Worker terminates the WebSocket at the edge and relays each
`hello`/`call`/`result` frame as an HTTP request to the container (~50 lines; our protocol is
small JSON messages with 3 kinds). The check is step 4 of the plan and must happen before any
further investment.

### 6.2 Risk: Containers beta

Cloudflare Containers are beta (April 2025); rough edges in lifecycle/observability are possible.
The exporter's production use of them is the strongest available mitigation — the pattern is
proven in-house, including CI/CD.

### 6.3 Open decision: access control

Phase 1 is an open endpoint with an unguessable name, time-boxed — acceptable for a handout
demo, same convention as the Azure guide. Phase 2 options: session links (planned, no account
needed) or the exporter's Google OAuth restricted to roomle.com. Decide before widening the
audience beyond a trial.

### 6.4 Known unknowns carried over (unchanged by Cloudflare)

- `bo-test` HI planner APIs (`getExternalObjectPlanContext`) — still unverified with a real plan;
  the first real `get-plan-context` answers it, identically in every setup.
- Plan id `ps_bse5tc…` must exist in the INT environment.
- `vite-node` as the container process — plain-Node build fallback exists.

### 6.5 Session pairing (phase 2)

Both of a user's parties (client + page) must carry the same session token. The handout becomes
a pair of links containing the same `session`/`mcp_session` id — a small UX constraint to accept
or automate later with an `open-store-page` tool (roadmap).

---

## 7. Alternatives Considered

1. **Worker + Durable Object rewrite** (the earlier proposal, no container) — rejected: it
   rewrites the server core (`server.ts` + `page-bridge.ts`) into Worker runtime APIs, while the
   container pattern runs the server unchanged. The container pattern also provides per-session
   isolation for free.
2. **Quick tunnel (`cloudflared`)** — rejected: not hosting; dies with the laptop; explicitly
   forbidden after the unauthorized run.
3. **Azure App Service** — blocked on missing access rights (documented, ready in
   [azure-mcp-server.md](../hi-mcp/docs/azure-mcp-server.md)); Cloudflare is the available path,
   not a replacement for the Azure option.
4. **Cloud Run** — the exporter deploys there too; viable, but the requester asked for Cloudflare
   and already has an account.
5. **Edge-only MCP (discovery at the Worker, like the exporter's `mcp-api.ts`)** — partially
   adopted: unnecessary for the PoC (the container answers discovery fine), worth copying in
   phase 2 to keep idle connectors cheap (the exporter serves `initialize`/`tools/list` without
   booting containers).

---

## 8. Files the Work Would Touch

| Path | Change |
| ---- | ------ |
| `hi-mcp/cf/Dockerfile`, `hi-mcp/cf/wrangler.jsonc`, `hi-mcp/cf/src/{container,worker}.ts`, `hi-mcp/cf/package.json` | new — modeled on `roomle-model-exporter/cf/` |
| `hi-mcp/cf/tests/` | Worker routing tests |
| `hi-mcp/docs/cloudflare-mcp-server.md` | new — the colleague-facing setup guide (sibling of the Azure guide) |
| `ligna-store/hi-mcp/browser-bridge.ts`, `ligna-store/components/blocks/Planner.vue` | phase 2 only: `mcp_session` passthrough + `sessionId` in `hello` (kept in sync with the roomle-hi-example copy) |
| `hi-mcp/hi-mcp-poc-json/types.ts` | phase 2 only: optional `sessionId` in the wire protocol |

---

## 9. Relation to the Other Analyses

- Extends [mcp-azure-deployment-and-session-bootstrapping.md](./mcp-azure-deployment-and-session-bootstrapping.md):
  the same case-3 goal ("server in the cloud"), with Cloudflare Containers as the available
  hosting platform instead of App Service; the Azure guide remains valid for when the access
  rights arrive.
- Adopts the per-user container allocation from
  [planner-mcp-server-analysis.md](./planner-mcp-server-analysis.md) (section 9.3) — which
  replaces the earlier "sessions via server-side registry" roadmap item with a platform-level
  answer (container per session).
- The headless engine (exporter's scenario) remains explicitly out of scope, as before.
