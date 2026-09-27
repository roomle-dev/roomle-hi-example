> **Type**: Feature Analysis
> **Domain**: HI MCP Server, TypeScript project setup, ligna-store integration
> **Trigger**: "Analyse the feature request for roomle-hi-example: hi-mcp TypeScript project with hi-mcp-poc-json as first MCP server PoC, client is the INT-stage ligna-store"
> **Date**: 2026-09-26
> **Author**: AI Assistant
> **Status**: Open

---

## Executive Summary

Establish `hi-mcp/` in roomle-hi-example as a Node.js TypeScript project that will host **multiple MCP
server proof of concepts**, starting with `hi-mcp/hi-mcp-poc-json/`. The first PoC is a copy of the
roomle-ui repository's `packages/embedding-lib/examples/hi-mcp-server/` (RML-17693) — the
`@modelcontextprotocol/sdk`-based server whose `create-or-replace-groups` tool generates HI object
groups (kitchens) **from a single JSON pos-group payload** — adapted so that its client is no longer
the roomle-ui `hi-presets-example` but the **ligna-store**, started locally (`npm run dev`) on
`http://localhost:3000/?store.stage=INT&id=ps_bse5tc50687uh64hm8jul7j1kiuacyx`.

The server side copies almost unchanged; the real integration work is on the client side: the
browser-bridge (plus its page-side dependencies `tool-executors.ts`, `plan-space.ts`, `types.ts`) must
be placed into the ligna-store in a new `hi-mcp/` subdirectory and started from
`components/blocks/Planner.vue` when the store runs with the **INT stage** (`store.stage=INT`) — the
bridge condition replaces the `mcp=true` flag of the roomle-ui hook
(`packages/embedding-lib/examples/demos/hi-presets-example.ts:352`).

One material risk surfaced during the analysis: the published `@roomle/web-sdk` 4.0.0 (the ligna-store
dependency) **does not declare `getExternalObjectPlanContext`**, the API every context/authoring tool
is built on. Compilation is unaffected (the tool executors type the planner API as `any`), but the
runtime served by the INT-stage UI (`https://www.roomle.com/t/bo-test`) must contain the Part 1 HI
APIs — this has to be verified first (see [7.1](#71-risk-getexternalobjectplancontext-availability)).

---

## Table of Contents

1. [What Was Asked and Why](#1-what-was-asked-and-why)
2. [Current State](#2-current-state)
3. [Gap Analysis](#3-gap-analysis)
4. [Proposed Design](#4-proposed-design)
5. [Alternatives Considered](#5-alternatives-considered)
6. [Files the Work Would Touch](#6-files-the-work-would-touch)
7. [Risks and Open Questions](#7-risks-and-open-questions)

---

## 1. What Was Asked and Why

### 1.1 Objective

1. **New subproject**: `hi-mcp/` in roomle-hi-example — a Node.js **TypeScript** project that will
   contain **multiple MCP server proof of concepts** over time.
2. **First PoC**: `hi-mcp/hi-mcp-poc-json/`. The "json" in the name refers to the fact that HI object
   groups (kitchens) are generated **from a single JSON** with this attempt: the agent submits one
   `posGroups` JSON payload (article picks + docking + placement) and `create-or-replace-groups`
   creates, docks and positions the whole group in one call. The agent never authors coordinates.
3. **Source of the implementation**: copy from roomle-ui
   `packages/embedding-lib/examples/hi-mcp-server/`, including its documentation (README.md,
   QUICKSTART.md), adapted to the new client.
4. **Client**: the **ligna-store**, but only when started with the **INT stage** — i.e. `npm run dev`
   in ligna-store and opening
   `http://localhost:3000/?store.stage=INT&id=ps_bse5tc50687uh64hm8jul7j1kiuacyx` (or a different
   plan id). The INT stage resolves to the `bo-test` UI server and the
   `HI_PRE_Roomle_Milestone_2` HI backend (see [2.3](#23-the-ligna-store-client)).
5. **Store-side bridge**: the roomle-ui implementation hooks the bridge into the `hi-presets-example`
   behind `?mcp=true` (`demos/hi-presets-example.ts:352`). For the new approach, the equivalent of
   `../hi-mcp-server/browser-bridge` has to be put **into the store**, in a subdirectory `hi-mcp`, and
   started from the planner setup — **gated on the INT stage instead of an `mcp` query parameter**
   (decision, see [7.3](#73-decision-stage-gating)).

### 1.2 Why

roomle-hi-example so far documents and prototypes MCP orchestration of HI groups against the
`hi-presets-example` page — first via the roomle-ui PoC, then via this repository's own zero-dependency
variant. The next step is to validate the same MCP orchestration against a **real embedding customer**,
the ligna-store, which has its own HI wiring (stage-based HI backend selection, price/order callbacks)
and loads concrete plans by id. A dedicated `hi-mcp/` TypeScript project gives these experiments a
permanent home in this repository, with one self-contained folder per attempt.

---

## 2. Current State

### 2.1 roomle-hi-example today

- **Root** contains the zero-dependency variant: `minimal-hi-example/hi-mcp-server.js` (hand-rolled JSON-RPC over
  Streamable HTTP, **SSE + fetch** page bridge, port 3100) plus `minimal-hi-example/index.html` (standalone copy of the
  hi-presets demo). Documented in `minimal-hi-example/docs/hi-mcp-server.md`.
- The new `hi-mcp/` directory does not exist yet. No TypeScript project, no `tsconfig.json`, no npm
  dependencies anywhere in the repository (`package.json` is metadata-only).
- Port 3100 is the established MCP port in both this repository and the roomle-ui source — relevant
  for [7.4](#74-decision-port-3100-collision).

### 2.2 The roomle-ui source (what gets copied)

`packages/embedding-lib/examples/hi-mcp-server/` — a self-contained TypeScript PoC
(RML-17693, `@modelcontextprotocol/sdk` 1.30.0, `ws`, `zod`, run via `vite-node`):

| File | Lines | Responsibility |
| ---- | ----- | -------------- |
| `server.ts` | 101 | Entry point: HTTP server on :3100 hosting `/mcp` (Streamable HTTP, JSON response mode) and the `/bridge` WebSocket upgrade; origin allow-list; EADDRINUSE handling; vite-node orphan guard |
| `hi-mcp-server.ts` | 319 | `McpServer` setup: server instructions + authoring rules text; 9 tool registrations with zod schemas (`get-plan-context`, `find-attributes`, `get-authoring-rules`, `create-or-replace-groups`, `place-group`, `update-attribute`, `get-price`, `get-order-data`, `get-plan-images`) |
| `page-bridge.ts` | 94 | Connected-page registry, call correlation, timeouts (30 s default, 120 s snapshot calls), "no page connected" error |
| `browser-bridge.ts` | 70 | Browser side: WebSocket client to `ws://localhost:3100/bridge`, `hello` handshake, executes tool calls via `toolExecutors`, auto-reconnect every 3 s |
| `tool-executors.ts` | 1028 | Tool name → `roomDesignerApi.extended` call + agent-facing context shaping; the only page-side logic beyond geometry |
| `plan-space.ts` | 647 | Pure geometry: wall derivation, footprints, wall/corner placement — no I/O, portable as-is |
| `types.ts` | 24 | Shared WebSocket message protocol (`hello` / `call` / `result`) + `HI_MCP_PORT = 3100` |
| `package.json` / `tsconfig.json` | — | Self-contained dependencies; tsconfig extends `../../tsconfig.lint.json` |
| `README.md` / `QUICKSTART.md` | 544 / 52 | Complete documentation: architecture, prerequisites, run instructions, MCP client registration for all major clients, tool reference, authoring rules, demo walkthrough, example prompts, troubleshooting |

Key integration facts:

- **Client hook** (`packages/embedding-lib/examples/demos/hi-presets-example.ts:352`):

  ```ts
  if (getQueryParam('mcp') === 'true') {
    const { startMcpBrowserBridge } = await import('../hi-mcp-server/browser-bridge');
    startMcpBrowserBridge(roomDesignerApi);
  }
  ```

- **API surface** the tool executors use (`tool-executors.ts`): `extended.getExternalObjectPlanContext`,
  `extended.loadExternalObjectGroupLayout`, `extended.removeExternalObject`,
  `extended.updateExternalObjectGroupAttribute`, `extended.fetchPrice`,
  `extended.getExternalObjectSnapshot`. The planner API is typed as `RoomDesignerApiType = any`
  (`examples/utils/homag-intelligence/overlay.ts:19`), so there is **no compile-time dependency** on
  any web-sdk version.
- **Page origins**: `server.ts` allows `http://localhost:3000` and `http://127.0.0.1:3000` — already
  the port the ligna-store dev server uses.
- **Root scripts** (`roomle-ui/package.json:12`): `dev:hi-mcp` runs the three processes (UI :5173,
  examples :3000, MCP :3100) via `concurrently`; `mcp:hi` runs the server alone.

### 2.3 The ligna-store client

Nuxt 3 app (`nuxt dev`, default port **3000**), `@roomle/embedding-lib` 7.0.0 +
`@roomle/web-sdk` 4.0.0:

- **Planner creation** — `components/blocks/Planner.vue` (`onMounted`):
  `setupHi(options.hi, {...})` with store HI callbacks, then
  `RubensEmbedding.createPlanner('ligna-demo-store-2026', configuratorElement, options)`. The created
  instance is used as `instance.api.extended.*` (e.g. `fetchPrice` at the `calcPrice` helper) — the
  same `extended` proxy surface the tool executors need. A query-param `id` (the plan id, e.g.
  `ps_bse5tc50687uh64hm8jul7j1kiuacyx`) is loaded via `instance.api.ui.loadObject(initId)`.
- **Stage detection** — `utils/settings.ts`: `store.stage` query param wins over localhost/PRE
  heuristics. `INT` selects `overrideServerUrl: https://www.roomle.com/t/bo-test` (plus
  `customApiUrl: https://api.roomle.com/v2`) and the HI backend
  `HI_PRE_Roomle_Milestone_2` (via the Azure HI proxy). Query params are parsed by
  `utils/init-data.ts:getQueryParams()` into dot-path objects, so the URL
  `?store.stage=INT&id=...` arrives as `params.store.stage === 'INT'` and `params.id`.
- **HI wiring**: `Planner.vue` passes `createHiServerOptions(language)` and price/order callbacks
  (`onFetchPrice` → `omPostRequest` to the HI proxy). The tools `get-price` / `get-order-data`
  therefore work in the store without extra wiring.
- **web-sdk typings**: the store's published `@roomle/web-sdk` 4.0.0 `roomle-sdk.d.ts` declares
  `loadExternalObjectGroupLayout`, `updateExternalObjectGroupAttribute`, `removeExternalObject`,
  `getExternalObjectSnapshot`, `fetchPrice` — but **not** `getExternalObjectPlanContext`, which only
  exists in roomle-ui's local web-sdk build. See [7.1](#71-risk-getexternalobjectplancontext-availability).

---

## 3. Gap Analysis

1. **No TypeScript project structure** in roomle-hi-example — `hi-mcp/` must be created as a
   project root (own `package.json`, tsconfig base, workspace layout for multiple PoCs).
2. **Server copy needs adaptation, not redesign**: `hello.example` says `hi-presets-example`
   (`browser-bridge.ts`), the "no page connected" error and startup log mention the hi-presets URL
   (`page-bridge.ts:66`, `server.ts:98`), README/QUICKSTART describe three processes and HI-backend
   flags (`use_server` / `run_locally`) that do not apply to the ligna-store (the store has its own
   stage-based HI wiring). Dependencies: `package.json` ports over as-is; `tsconfig.json` cannot
   extend `../../tsconfig.lint.json` (that path lives in roomle-ui) and needs a local base.
3. **Browser-bridge must live in the store**: `browser-bridge.ts` imports `toolExecutors`
   (`tool-executors.ts`), which imports `plan-space.ts` and `types.ts` — so the **page-side set is
   four files**, not one (`browser-bridge.ts`, `tool-executors.ts`, `plan-space.ts`, `types.ts`).
   Only `types.ts` is shared verbatim with the server copy; the store copy must replace the
   `RoomDesignerApiType` import (roomle-ui examples util) with a local type. This is a cross-repo
   duplication with no sync mechanism — acceptable for a PoC, but it must be stated in both READMEs.
4. **No hook in the store yet**: `Planner.vue` has no bridge activation. The natural place is
   right after `$rubensService.planner.setInstance(...)` / instance retrieval, dynamically imported
   so nothing loads unless the stage condition is met.
5. **The activation condition is the INT stage, not an `mcp` flag**: `settings.ts` already
   distinguishes the stages (`store.stage=INT` selects `bo-test` + `HI_PRE_Roomle_Milestone_2`), so
   the store-side hook gates on `params.store?.stage === 'INT'` — no extra query parameter (decision,
   see [7.3](#73-decision-stage-gating)).
6. **API availability at runtime is unverified**: the whole tool set builds on
   `getExternalObjectPlanContext`; whether the web-sdk served by `bo-test` (INT) contains it must be
   confirmed before any other work ([7.1](#71-risk-getexternalobjectplancontext-availability)).

---

## 4. Proposed Design

### 4.1 Directory layout in roomle-hi-example

```text
hi-mcp/
├── README.md                     # what this folder is, list of PoCs
├── package.json                   # npm workspace root: "workspaces": ["hi-mcp-poc-json"]
├── tsconfig.base.json             # shared compiler options for all PoCs (module NodeNext / strict)
└── hi-mcp-poc-json/               # PoC 1: copy of roomle-ui hi-mcp-server, adapted
    ├── package.json               # self-contained deps: @modelcontextprotocol/sdk, ws, zod, vite-node
    ├── tsconfig.json              # extends ../tsconfig.base.json
    ├── server.ts
    ├── hi-mcp-server.ts
    ├── page-bridge.ts
    ├── tool-executors.ts
    ├── plan-space.ts
    ├── types.ts
    ├── README.md                  # adapted from roomle-ui README
    └── QUICKSTART.md              # adapted from roomle-ui QUICKSTART
```

Rationale: npm **workspaces** at `hi-mcp/` root so `npm install` is one command for all future PoCs,
while each PoC stays a **self-contained package** (exactly the roomle-ui pattern: its dependencies are
deliberately kept out of the host repository root). The existing zero-dependency
`minimal-hi-example/hi-mcp-server.js` remains untouched — the two are parallel approaches, and
this is the successor line.

### 4.2 Changes to the copied server (hi-mcp-poc-json)

| Source element | Change |
| -------------- | ------ |
| `server.ts:98` startup log | "...waiting for the hi-presets example page" → "waiting for the ligna-store page (start it with npm run dev and open ?store.stage=INT&id=...)" |
| `server.ts` `ALLOWED_PAGE_ORIGINS` | unchanged — ligna-store dev server is also `localhost:3000` |
| `page-bridge.ts:66` "No HI demo page connected" error | point to the ligna-store URL |
| `browser-bridge.ts` hello `example` field | `'ligna-store'`; the `example` field can be generalized to `client` or kept as-is to avoid a protocol change (recommendation: keep the wire protocol identical, only change the value) |
| `package.json` name | `hi-mcp-poc-json` |
| `package.json` runner | `vite-node` pinned to 3.2.4 with `vite` 6.4.3 (deviation from the source: roomle-ui runs `vite-node` 6, which requires `vite` 8 / rolldown and Node ≥ 20.19 — the local environment runs Node 20.10) |
| `tsconfig.json` | extends `../tsconfig.base.json` instead of roomle-ui's `tsconfig.lint.json` |
| Tool set, authoring rules, instructions, geometry (`plan-space.ts`), bridge protocol | **unchanged** — they are client-agnostic by design |

### 4.3 ligna-store changes

```text
ligna-store/
├── hi-mcp/                        # page-side bridge (requested subdirectory)
│   ├── browser-bridge.ts          # from roomle-ui browser-bridge.ts (hello → 'ligna-store')
│   ├── tool-executors.ts          # from roomle-ui tool-executors.ts
│   ├── plan-space.ts              # from roomle-ui plan-space.ts (unchanged)
│   ├── types.ts                   # from roomle-ui types.ts (unchanged; wire protocol shared with the server)
│   └── README.md                  # provenance note: copied from roomle-ui RML-17693 (copy-only origin, no sync)
└── components/blocks/Planner.vue  # + INT-stage hook after the planner instance is ready
```

Hook in `Planner.vue`, after `$rubensService.planner.setInstance({ ... })` / instance retrieval
(the store-side equivalent of `hi-presets-example.ts:352` — the INT stage takes the role of the
`mcp=true` flag there):

```ts
if (params.store?.stage === 'INT') {
  const { startMcpBrowserBridge } = await import('~/hi-mcp/browser-bridge');
  startMcpBrowserBridge(instance.api);
}
```

- `params` is already available (`getQueryParams()` at the top of `onMounted`) — `store.stage=INT`
  arrives as `params.store.stage` via the dot-path parser (`utils/init-data.ts`).
- Dynamic import keeps the bridge (and `plan-space`, `tool-executors`) entirely out of the store bundle
  unless the store runs with the INT stage.
- Gating on the explicit query param (not on the settings fallback chain) means localhost runs without
  `store.stage` stay bridge-free (stage fallback `PRE`); loosen the condition later if PRE/PROD
  experiments are wanted.
- `startMcpBrowserBridge(instance.api)` passes the same `extended`-carrying object the store already
  uses; `RoomDesignerApiType` becomes a local `type` in `hi-mcp/` (e.g. alias for the planner instance
  type or `any`, as in the source).
- The reconnect loop (`browser-bridge.ts`) makes the bridge survive store hot reloads — no change
  needed.

### 4.4 Running the PoC (target state)

```bash
# 1. roomle-hi-example
cd hi-mcp && npm install
npm start --workspace hi-mcp-poc-json        # MCP server + WebSocket bridge on :3100

# 2. ligna-store
npm run dev                                 # Nuxt dev server on :3000

# 3. open the client page (keep the tab open) — the bridge starts
#    automatically because the stage is INT
#    http://localhost:3000/?store.stage=INT&id=ps_bse5tc50687uh64hm8jul7j1kiuacyx

# 4. connect any MCP client to
#    http://localhost:3100/mcp
```

Differences from the roomle-ui runbook that the adapted README/QUICKSTART must reflect:

- No `npm run dev` UI server on :5173 and no `dev:embedding` — the single client process is the store.
- No `use_server` / `run_locally` flags and no `VITE_HI_TEST_AUTH` — the store resolves HI
  credentials server-side via the backendId (`utils/settings.ts`), stage-driven.
- The plan is loaded by `id` query param (plan snapshot `ps_...`), not by selecting a preset.
- INT stage is required for the `HI_PRE_Roomle_Milestone_2` backend / `bo-test` UI combination the
  demo plan belongs to.

### 4.5 Documentation (per AGENTS.md "Where Documentation Goes")

| What | Where |
| ---- | ----- |
| PoC runbook, tool reference, authoring rules, client registration | adapted `hi-mcp/hi-mcp-poc-json/README.md` + `QUICKSTART.md` (source: roomle-ui) |
| Overview of the `hi-mcp/` project and its PoCs | new `hi-mcp/README.md`; link from root `README.md` |
| Living reference for the new server | new `minimal-hi-example/docs/hi-mcp-poc-presentation.md` (companion to `minimal-hi-example/docs/hi-mcp-server.md`), indexed in `.agents/README.md` |
| Store-side bridge provenance | `ligna-store/hi-mcp/README.md` (states the copy origin; the roomle-ui original will be deleted, ongoing sync applies only between this repository and the store) |
| Repository structure section | update `AGENTS.md` structure tree |
| This analysis | closed out (status → Implemented) once the work lands |

---

## 5. Alternatives Considered

1. **Reuse the existing zero-dependency SSE server instead of copying the roomle-ui TypeScript
   server.** Rejected: the request explicitly asks for the roomle-ui implementation as the source, and
   the TS/SDK variant is the maintained line (typed tool schemas via zod, SDK protocol compliance).
   The zero-dependency variant stays as a separate, independent experiment.
2. **Single `hi-mcp` package in the repository root instead of a per-PoC package.** Rejected: the
   request wants multiple PoCs under one project; npm workspaces give one install while keeping each
   PoC's dependencies isolated (the roomle-ui PoC deliberately keeps its deps out of the host root —
   same reasoning applies here).
3. **Publish the page-side bridge (browser-bridge/tool-executors/plan-space) as an npm package shared
   by roomle-ui, this repository and the store.** Rejected for the PoC: no publish pipeline for
   examples code, and a package indirection would slow the experiment. Consequence: a three-way copy
   with manual sync — documented as a known trade-off (see [7.2](#72-open-question-sync-of-the-page-side-copy)).
4. **Put the bridge into `@roomle/embedding-lib` itself instead of the store.** Rejected: the
   embedding-lib should not ship demo/dev tooling; the store is the client that owns its HI wiring
   (`setupHi` callbacks, stage config), so the bridge belongs next to `Planner.vue`.
5. **SSE + fetch bridge (as in the zero-dependency server) instead of WebSocket.** Rejected: the
   request says to copy the roomle-ui implementation, which uses the WebSocket bridge (`ws` on the
   server, native `WebSocket` in the page). No functional reason to diverge.
6. **Gate the bridge on an `mcp=true` query parameter (the roomle-ui pattern) instead of the INT
   stage.** Rejected per the requester's decision: the activation condition **is** the INT stage, at
   least for now — an extra flag would be redundant while the PoC targets the INT environment only
   (see [7.3](#73-decision-stage-gating)).

---

## 6. Files the Work Would Touch

### roomle-hi-example (all new)

| Path | Action |
| ---- | ------ |
| `hi-mcp/package.json`, `hi-mcp/tsconfig.base.json`, `hi-mcp/README.md` | create (workspace root) |
| `hi-mcp/hi-mcp-poc-json/*` | create — copy of roomle-ui `hi-mcp-server` (9 files per [2.2](#22-the-roomle-ui-source-what-gets-copied)), adapted per [4.2](#42-changes-to-the-copied-server-hi-mcp-poc-json) |
| `minimal-hi-example/docs/hi-mcp-poc-json.md` | create (living reference) |
| `AGENTS.md`, root `README.md`, `.agents/README.md` | update structure/index links |

### ligna-store

| Path | Action |
| ---- | ------ |
| `hi-mcp/{browser-bridge,tool-executors,plan-space,types}.ts`, `hi-mcp/README.md` | create — page-side copy, adapted per [4.3](#43-ligna-store-changes) |
| `components/blocks/Planner.vue` | add the INT-stage hook (dynamic import, after planner instance creation) |

---

## 7. Risks and Open Questions

### 7.1 Risk: `getExternalObjectPlanContext` availability

The store's published `@roomle/web-sdk` 4.0.0 typings do **not** declare
`getExternalObjectPlanContext` (verified: `roomle-sdk.d.ts` of ligna-store node_modules vs. roomle-ui's
local build, which has it). Compilation is unaffected (`RoomDesignerApiType = any`), but at runtime
the API must exist on the planner served by the **INT-stage UI (`bo-test`)** — the roomle-ui README
lists exactly this failure mode for deployed UIs without the Part 1 HI APIs. The INT stage uses the
`HI_PRE_Roomle_Milestone_2` backend, which suggests the matching milestone UI, but this is unproven.
**Verify first** (e.g. open the store with INT stage, call
`instance.api.extended.getExternalObjectPlanContext([])` from the console) before building anything
else; if absent, the PoC is blocked on a web-sdk deployment to `bo-test`.

### 7.2 Open question: sync of the page-side copy

The roomle-ui original (`packages/embedding-lib/examples/hi-mcp-server`, RML-17693) is the **copy
source only** — it **will be deleted later**, so there is no sync with roomle-ui in the future. After
the copy, the page-side files (`browser-bridge/tool-executors/plan-space/types`) exist in two places:
this repository's `hi-mcp-poc-json` and the ligna-store's `hi-mcp/`. That pair has no automatic sync
either — changes are applied manually, and both copies' READMEs state the provenance. A decision for
later is whether the store copy should be generated from this repository.

### 7.3 Decision: stage gating — **resolved**

The requester decided: the bridge activation condition is **`store.stage=INT` — no `mcp=true` query
parameter**, at least for now. The hook in `Planner.vue` gates on the explicit query param
(`params.store?.stage === 'INT'`); a localhost run without `store.stage` falls back to `PRE` and stays
bridge-free. The condition is expected to change once the PoC moves beyond the INT environment (e.g.
an explicit opt-in flag or a stage-independent toggle) — revisit then.

### 7.4 Decision: port 3100 collision

The new server defaults to 3100 — the same default as the `minimal-hi-example/hi-mcp-server.js` zero-dependency variant. Both can never run at once (and only one can talk to a page at a time anyway —
the browser-bridge of each targets a different client). Proposal: keep 3100 (parity with all existing
docs and MCP client registrations) and document that the two servers are mutually exclusive. A
distinct port (3101) would avoid the `EADDRINUSE` footgun but forces every documented client
registration to carry an exception for this PoC.

### 7.5 Open question: plan id and `ps_` snapshot semantics

The demo URL loads `id=ps_bse5tc50687uh64hm8jul7j1kiuacyx` (a plan snapshot id). Confirm the snapshot
exists in the INT environment and that `ui.loadObject` accepts it; otherwise pick a current INT plan
id. The adapted README should document how to obtain a valid id.

---

## 8. Implementation Plan

Steps 1–3 are in roomle-hi-example, steps 4–5 in the ligna-store repository (no unit tests there —
the store is an embedding customer, its only change is the bridge copy plus a small hook, and the
bridge copy is unit-tested here).

| # | Step | Verify |
| - | ---- | ------ |
| 1 | Scaffold `hi-mcp/` workspace root: `package.json` (npm workspaces, devDependencies `vitest`, `typescript`, `@types/node`; scripts `test`, `typecheck`), `tsconfig.base.json`, `vitest.config.ts`, `README.md` | `npm install` succeeds |
| 2 | Copy the 9 source files from roomle-ui into `hi-mcp/hi-mcp-poc-json/`, adapt per [4.2](#42-changes-to-the-copied-server-hi-mcp-poc-json); local `RoomDesignerApiType` in `types.ts` replaces the roomle-ui examples import | `tsc --noEmit` passes; `npm start` serves `/mcp` |
| 3 | Unit tests per [8.1](#81-unit-test-plan) in `hi-mcp-poc-json/tests/`, vitest configured at `hi-mcp/` root | `npm test` green |
| 4 | ligna-store: `hi-mcp/` page-side copy (`browser-bridge`, `tool-executors`, `plan-space`, `types`, provenance README) + `Planner.vue` INT-stage hook per [4.3](#43-ligna-store-changes) | manual: INT-stage store connects (server logs "page connected"), MCP client `get-plan-context` succeeds — also resolves [7.1](#71-risk-getexternalobjectplancontext-availability) |
| 5 | Documentation: adapt PoC `README.md`/`QUICKSTART.md` (done with step 2), update `AGENTS.md` structure tree (step 2), `minimal-hi-example/docs/hi-mcp-poc-json.md` living reference at close-out, close out this analysis (status → Implemented) | docs indexed in `.agents/README.md` |

Status 2026-09-26: steps 1–4 are implemented. Steps 1–3: server copy adapted, vitest suite with 70
unit tests green, typecheck clean, server smoke-tested on :3100. Step 4 (ligna-store,
commit `cd7cbf1` on its `feat/hi-mcp` branch): `hi-mcp/` page-side copy (verbatim from this
repository's tested copy, excluded from the store's lint to keep the sync diff clean),
`Planner.vue` INT-stage hook, provenance README; verified by a dev-server smoke test (all four
modules transform, the kitchens page renders, no compile errors). Still open: step 5 (living
reference `minimal-hi-example/docs/hi-mcp-poc-json.md`, close-out of this analysis) and the manual end-to-end
verification of [7.1](#71-risk-getexternalobjectplancontext-availability) — the runtime check of
`getExternalObjectPlanContext` on the `bo-test` UI needs the INT-stage store open in a real browser
with the MCP server running (`page connected` in the server log, then `get-plan-context`).

### 8.1 Unit test plan

vitest (configured at `hi-mcp/` root, `npm test` runs across all workspaces). Test files live in
`hi-mcp-poc-json/tests/` next to the units they cover. No browser, no network, no store — every
external edge is a mock: the `PageBridge` is tested against a fake WebSocket, the tool registrations
against a mock bridge, and the tool executors against a fake `roomDesignerApi.extended` with plan
fixtures.

| Test file | Unit | Cases |
| --------- | ---- | ----- |
| `plan-space.test.ts` | pure geometry (`plan-space.ts`) | `deriveWalls`: rectangular room → 4 walls with side labels (`bottom`/`right`/`top`/`left`), `start`/`end` in pos space (y sign flip), `lengthMm`, `type`/`heightMm`/`thicknessMm`, `facingRotationY` (180/270/0/90); degenerate contours (empty, single segment, non-straight cmd) → `[]`; `contourPointToPosSpace` sign flip + rounding; `groupFootprint` from part boxes (with/without `ver`, root transform), dock points, and `b`/`t` attribute fallback; `resolveWallAlignment` pass-through, side-label resolution, parallel-alignment error; `placeAgainstWall` start/center/end + `offsetMm` against a computed wall; `placeCornerAtWalls` puts the corner point into the room corner with the back edges along both walls; `convexPolygonsTouch` separated / flush-touching / overlapping / tolerance; `groupCornerGeometry` from `LeftBack`/`RightBack` dock vectors; `repositioningFromPlacement` anchor transform and rotation sum |
| `page-bridge.test.ts` | server-side bridge (`page-bridge.ts`) | `call` without a page → "No … page connected" error naming the store URL; `hello` registers the page; call→`send` correlation, `result` ok resolves / error rejects; call timeout (fake timers, 30 s default); a second page replaces the first and rejects pending calls; page disconnect rejects pending calls |
| `hi-mcp-server.test.ts` | MCP layer (`hi-mcp-server.ts`), via MCP SDK `Client` + `InMemoryTransport` | `tools/list` returns exactly the 9 tools; `get-authoring-rules` answered by the server itself (no bridge call); relayed tools pass name + args to the bridge and return the JSON text content; `create-or-replace-groups`/`place-group`/`get-order-data`/`get-plan-images` use the 120 s snapshot timeout; bridge error → `isError` result; `get-plan-images` strips the `data:image/...;base64,` prefix into MCP image content, empty snapshot → error text |
| `tool-executors.test.ts` | page-side executors (`tool-executors.ts`) with fake `roomDesignerApi.extended` | `get-plan-context`: default sections, `include` filtering, article compaction (dimensions, mainAttributes, docking vectors from template, `cornerArticle`), group shaping (input attributes only, docking indices stripped, `freeDockingVectors`), rooms with derived walls; `find-attributes`: text match, `libraryId` filter, 20-match cap + hint; `create-or-replace-groups`: every validation error (empty roots, group `pos`/`rotationY`, root `articlePos`, duplicate ids, undocked roots, invalid `placement.wall`, placement + repositioningData, unknown `articleId`) fails **before** `loadExternalObjectGroupLayout`; success: article picks only reach the planner, `reason: 'adjusted'`, placement resolved against the wall and re-applied as `repositioningData` of the first root, `placements` reported, unpositioned-group hint; placement contact → created groups removed again + rejection error; `place-group`: unknown id, prefix match, wall placement result (pos/rotationY/footprint/placedBy/wall), contact rejection without a reload; `update-attribute` passthrough (root and sub module); `get-price`, `get-order-data`, `get-plan-images` passthrough |

Scope notes:

- `server.ts` (entry point, port binding, origin allow-list) is covered by the manual run in
  step 2's verify, not by unit tests — it is 100 lines of wiring around the tested units.
- Fixtures for the executors are minimal hand-built plan contexts (rectangular 4000×3000 mm room,
  one 800×600 mm root derived from `b`/`t` attributes) with expected positions computed by hand —
  not from the functions under test.

Known limitations recorded from the PR review (2026-09-26), accepted for the PoC:

1. **Placement rollback keeps replaced groups' new roots** — when a placement is rejected, the
   created groups are removed but groups that replaced existing ones keep their new content
   (positions unchanged), as the error message states. Restoring the pre-call state of replaced
   groups would need a corrective load per rejected group — follow-up if the PoC becomes a shared
   tool. A preflight before loading is not possible: footprints exist only after the planner has
   calculated the load.
2. **No collision check between groups of the same call** — the contact check excludes all groups
   of the call, because the not-yet-placed ones sit at the plan origin (excluding only the current
   group would produce false collisions with those). The accurate fix is pairwise checks among the
   computed placements before the corrective load — follow-up; the next `get-plan-context` /
   `place-group` reports such overlaps.

