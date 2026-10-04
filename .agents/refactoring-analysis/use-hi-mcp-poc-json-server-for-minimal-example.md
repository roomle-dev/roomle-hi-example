> **Type**: Refactoring Analysis
> **Domain**: HI MCP Server, minimal-hi-example, hi-mcp workspace
> **Trigger**: "Refactor minimal-hi-example so that it no longer has its own MCP server implementation; the start script should start the example and the MCP server, with the implementation of hi-mcp/hi-mcp-server used instead. index.html should not be completely changed — only adapt if absolutely necessary, and it stays a single HTML file with inline JavaScript. The poc-json server is to be used as-is, not modified."
> **Date**: 2026-09-27
> **Author**: AI Assistant
> **Status**: Done

---

## Executive Summary

`minimal-hi-example` currently contains a complete, self-written MCP server
(`hi-mcp-server.js`, 618 lines) that parallels — and duplicates — the TypeScript server in
`hi-mcp/hi-mcp-server` (the maintained line: SDK-based protocol handling, zod tool schemas,
unit tests, Azure/Cloudflare deployments). The refactoring removes the separate implementation:
the `hi-mcp-server` server becomes the only MCP server, **used as-is, without any change**,
and the start script in `minimal-hi-example` starts the example page and that server together,
making sure the server is built locally (dependencies installed, types checked) before it
starts.

The `hi-mcp-server` server does not serve static files — by design, it expects the client
page to bring its own host, like the ligna-store does. The start launcher in
`minimal-hi-example` therefore serves the example page itself, on port 3000 — the port the
server's **default origin allow-list already contains** (`server.ts:19–27`) — and spawns the
server on port 3100. The server's existing environment variables (`HI_MCP_PAGE_ORIGINS`,
`HI_MCP_STORE_URL`, `HI_MCP_PORT`) are the entire integration surface; no file under `hi-mcp/`
is touched.

The one absolutely necessary change in `index.html`: the ~55-line inline
`startMcpBrowserBridge` transport switches from EventSource+fetch to WebSocket, because the
server's bridge is a WebSocket. Everything else in `index.html` — the single-file structure,
the inline tool executors and geometry, the `?mcp=true` gate — stays as it is.

---

## 1. What the Current Code Does and Why It Is a Problem

### 1.1 The two parallel MCP server implementations

| | `minimal-hi-example/hi-mcp-server.js` | `hi-mcp/hi-mcp-server/` |
|---|---|---|
| Protocol layer | hand-rolled JSON-RPC over HTTP (`handleJsonRpcRequest`, lines 263–303) | `@modelcontextprotocol/sdk` 1.30.0 `McpServer` + `StreamableHTTPServerTransport` (`hi-mcp-server.ts`, `server.ts:33–49`) |
| Tool schemas | plain JSON objects in a `TOOLS` array (lines 81–261) | zod schemas via `registerTool` (`hi-mcp-server.ts:78–319`) |
| Page bridge | SSE + fetch: `GET /bridge` (lines 396–414), `POST /bridge/result` (lines 416–429) | WebSocket: `ws` server on `/bridge` upgrade (`server.ts:82–96`), `PageBridge` class (`page-bridge.ts`) |
| Static serving | serves `minimal-hi-example/` (`handleStatic`, lines 431–451) | none — 404 for everything but `/mcp` (`server.ts:22–28`) |
| Browser open | `openInBrowser` on start, `--no-open` flag (lines 536–560, 566–568) | none |
| Dependencies | zero (design constraint of this variant) | `@modelcontextprotocol/sdk`, `ws`, `zod`, run via `vite-node` |
| Tests | none | unit tests in `tests/` (vitest, `hi-mcp` workspace root) |
| Client-facing text | example page URL in errors and startup log | ligna-store URL in errors and startup log (`page-bridge.ts:76–79`, `server.ts:131`) |

Both expose the same 9 tools with the same descriptions and the same MCP endpoint
(`POST /mcp`, port 3100, JSON responses). The tool *logic* also exists twice on the page
side: inline in `index.html` (`mcpToolExecutors`, lines 1925–2424) and as TypeScript in
`hi-mcp/hi-mcp-client/` (`tool-executors.ts`, `plan-space.ts`) — the copy the
ligna-store runs.

The duplication is the problem: two protocol layers, two bridge protocols, two copies of
every tool fix must be maintained in parallel, and only one of the two lines is tested and
deployed (Azure, Cloudflare). The AGENTS.md hard rule "No external dependencies — the server
must remain zero-dependency" (Code Style section) was written for the standalone variant and
now actively blocks the consolidation.

### 1.2 What starts today

- Root `package.json`: `"start": "node minimal-hi-example/hi-mcp-server.js"` — starts the
  old server, which also serves and opens the example page.
- `minimal-hi-example/package.json`: `"start": "node hi-mcp-server.js"`.
- `hi-mcp/package.json`: `"start": "npm start --workspace hi-mcp-server"` → `vite-node
  server.ts` — starts only the MCP server, waits for the ligna-store page (which is not
  running in this setup).

### 1.3 How the page talks to the server today

`index.html` (single file, inline JS) gates the bridge on `?mcp=true` (line 2484) and runs
`startMcpBrowserBridge(roomDesignerApi)` (lines 2426–2482): an `EventSource` on
`/bridge?url=…` receives `{kind:'call', id, tool, args}` messages, the inline
`mcpToolExecutors` run them against `roomDesignerApi.extended`, and results are POSTed to
`/bridge/result` as `{kind:'result', id, ok, result|error}`. The message shapes are the same
as the WebSocket protocol in `hi-mcp-server/types.ts` (`McpBridgeCall` / `McpBridgeResult`) —
only the transport differs (and the `hello` handshake, which the SSE variant replaces with the
`url` query parameter).

---

## 2. Scope with File:Line References

| File | Role in the refactoring |
|---|---|
| `minimal-hi-example/hi-mcp-server.js` | **deleted** — the separate MCP server implementation this refactoring removes |
| `minimal-hi-example/start.mjs` (new, plain Node JS) | the launcher: build gate, static file server for the example (port 3000), spawn of the poc-json server, browser open. Static serving plus process wiring — not an MCP implementation |
| `minimal-hi-example/package.json` | `start` script rewritten to run the launcher |
| `package.json` (root) | `start` script rewritten to delegate to the `minimal-hi-example` workspace |
| `hi-mcp/hi-mcp-server/` (all files) | **not changed** — used as-is; the existing env vars (`HI_MCP_PAGE_ORIGINS`, `HI_MCP_STORE_URL`, `HI_MCP_PORT`) are the integration surface |
| `hi-mcp/hi-mcp-client/` | **not in scope** — it stays the page-side copy for the ligna-store; the example keeps its inline executors (see [5.3](#53-not-done-and-why)) |
| `minimal-hi-example/index.html` | one change: `startMcpBrowserBridge` (lines 2426–2482) switches from SSE+fetch to WebSocket; the comment block at lines 921–923 is updated to match. Everything else stays |
| Docs: `minimal-hi-example/docs/hi-mcp-server.md`, `.agents/skills/hi-mcp-server.md`, `AGENTS.md`, root + `minimal-hi-example` READMEs | living references updated: no more zero-dependency server, WebSocket bridge, new start flow |

---

## 3. Constraints from the Requester

1. `minimal-hi-example/index.html` is changed **only if absolutely necessary** and stays a
   **single HTML file with inline JavaScript** — no bundler, no external script files, no
   extraction of the tool executors.
2. The task is about the **MCP server**, not the example page — no redesign of the page.
3. After the refactoring a **start script still starts the MCP server** — `npm start` starts
   the example and the server.
4. **No separate MCP server implementation**: the implementation used is
   `hi-mcp/hi-mcp-server`'s — **used as-is, not modified** (requester's review of the first
   proposal).
5. The start script must **make sure the server is locally built** before starting it.

---

## 4. Proposed Target Shape

### 4.1 The poc-json server is used as-is

No file under `hi-mcp/` is modified. The server already exposes everything the example
setup needs, through environment variables (`server.ts:14–27`):

- `HI_MCP_PORT` / `PORT` — the MCP port (default 3100).
- `HI_MCP_PAGE_ORIGINS` — the WebSocket origin allow-list. Its **default already contains
  `http://localhost:3000` and `http://127.0.0.1:3000`** (`server.ts:19–27`): the server was
  built for a client page on port 3000 that it does not serve itself. The launcher serves
  the example on exactly that port, so the default allow-list fits with no configuration at
  all.
- `HI_MCP_STORE_URL` — the URL named in the "No HI page connected" error
  (`page-bridge.ts:76–79`); the launcher sets it to the example URL.

Serving static files and opening the browser were never the MCP server's job — the store
brings its own page and its own browser tab. The launcher takes those roles for the example,
exactly as the store's dev server does for the store.

### 4.2 The start script in minimal-hi-example

`minimal-hi-example/package.json` gets a start script that runs a small Node launcher
(`start.mjs`, plain JS, part of `minimal-hi-example` — static file serving plus process
wiring, not an MCP implementation):

1. **Build gate**: ensure the `hi-mcp` workspace is installed (`npm install` at the `hi-mcp`
   root if `node_modules` is missing — idempotent) and the types check
   (`npm run typecheck` at the `hi-mcp` root). `vite-node` then compiles `server.ts` on the
   fly, exactly as the PoC runs for the store. (Alternative for an explicit artifact: an
   esbuild bundle step — see [7.2](#72-decision-how-far-built-should-go).)
2. **Serve the example**: a static file server for `minimal-hi-example/` on port 3000
   (configurable), with the path-traversal guard and content types the old server had
   (`hi-mcp-server.js:431–451` is the reference; that code is deleted with it).
3. **Start the MCP server**: spawn `vite-node hi-mcp/hi-mcp-server/server.ts` with
   `HI_MCP_STORE_URL=http://localhost:3000/?mcp=true&backendId=HI_PRE_Roomle_Milestone_2&library_id=Furniture_Smith`
   so the "no page connected" error names the example URL.
4. **Open the browser** at the example URL (the `openInBrowser` logic from
   `hi-mcp-server.js:536–544` moves into the launcher; a `--no-open` flag is kept).

The example URL becomes `http://localhost:3000/?mcp=true&…` (the page), while the MCP
endpoint stays `http://localhost:3100/mcp` — existing MCP client registrations keep working.
Port 3000 is also the ligna-store dev server's port; the two are alternative clients of the
same server and are never run at once, and the launcher's port is configurable for the rare
conflict.

Root `package.json` `"start"` becomes a delegation to the `minimal-hi-example` workspace
script, so `npm start` from the repo root keeps working. The old `hi-mcp-server.js` is
deleted; nothing imports it (it is only referenced by the two `start` scripts and the docs).

### 4.3 The one absolutely necessary index.html change

The page cannot talk to the new server without changing its bridge transport — the server's
bridge is a WebSocket (`server.ts:82–96`), and it offers no SSE endpoints. That is the one
necessary edit, kept as small as the SSE block it replaces:

- `startMcpBrowserBridge` (lines 2426–2482): replace `EventSource` + `fetch('/bridge/result')`
  with a `WebSocket` to `ws://localhost:3100/bridge` (the bridge port differs from the page
  origin, so the URL is a constant; the multi-URL fallback logic of
  `hi-mcp-client/browser-bridge.ts:54–72` is not needed here). Send the `hello`
  message on open (the protocol of `types.ts`), keep replying `{kind:'result', id, ok, …}`
  over the socket, keep the 3-second reconnect on close. Roughly the same line count as the
  SSE version; the file stays a single HTML with inline JS.
- Update the bridge comment (lines 921–923) to name the `hi-mcp-server` server.
- Nothing else: `mcpToolExecutors` and all geometry (including `placeCornerAtWalls`,
  `deriveWalls`, the placement math) stay untouched; the `?mcp=true` gate (line 2484) stays;
  the message shapes already match `types.ts`.

Alternative rejected: teaching the poc-json server an SSE bridge (`/bridge` +
`/bridge/result`) so the page stays byte-identical. That would modify the shared
implementation — a second bridge transport in `server.ts`/`page-bridge.ts` that no other
client uses, and more new code than the ~55-line page change.

### 4.4 Client-facing strings in the server — accepted as-is

`page-bridge.ts:76–79` addresses "the ligna-store"; `server.ts:131` mentions it in the
startup log. With `HI_MCP_STORE_URL` set by the launcher, the actionable part of the error
(the URL) points at the example. The remaining "ligna-store" wording is cosmetic, is not
worth touching the shared server for, and is accepted. The `hello.example` field stays as it
is — the server ignores it (`page-bridge.ts:22–31` uses only `message.url`).

### 4.5 Documentation (per AGENTS.md "Where Documentation Goes")

| What | Where |
|---|---|
| New start flow, WebSocket bridge, launcher on port 3000 | `minimal-hi-example/docs/hi-mcp-server.md` (living reference) |
| Skill for the (now single) server | `.agents/skills/hi-mcp-server.md` — zero-dependency architecture sections replaced |
| AGENTS.md | structure tree (no more standalone server), MCP server rules (drop the zero-dependency hard rule, keep it scoped where it still applies), start commands |
| READMEs | root `README.md`, `minimal-hi-example/README.md`, `hi-mcp/hi-mcp-server/README.md` (document the example-page client and its launcher) |
| This analysis | closed out (status → Done) with the report after the work |

---

## 5. Tests Covering the Affected Behaviour

Existing: `npm test` / `npm run typecheck` at the `hi-mcp` root (70 unit tests across the
PoC server and client, `hi-mcp-server/tests/`, `hi-mcp-client/tests/`). The
refactoring does not touch a single line under `hi-mcp/` — they must stay green unchanged.

| Behaviour | Verification |
|---|---|
| The poc-json server is untouched | `git diff hi-mcp/` empty after the refactoring; `npm test` + `npm run typecheck` at the `hi-mcp` root stay green |
| Start script builds before starting | `rm -rf hi-mcp/node_modules && npm start` (from root) installs, typechecks and starts |
| Example page is served | `curl http://localhost:3000/` returns `index.html` |
| MCP endpoint answers | `curl -X POST http://localhost:3100/mcp` initialize/tools-list round-trip as before |
| Page connects via WebSocket | open `http://localhost:3000/?mcp=true&backendId=HI_PRE_Roomle_Milestone_2&library_id=Furniture_Smith`; server logs `page connected`, page logs the bridge connection |
| Tool round-trip through the new pair | MCP client `get-plan-context`, then `create-or-replace-groups` with a one-root group and a wall placement, then `get-plan-images` |
| Old server is gone and nothing breaks | `grep -rn "hi-mcp-server.js"` finds only historical records (analyses) and updated docs |

### 5.1 Not done, and why

- **No unit test for the launcher** — static file serving plus process wiring, the same
  scope decision as before (feature analysis `hi-mcp-poc-json.md`, §8: wiring around the
  tested units is covered by the manual smoke test). The MCP implementation's 70 unit tests
  stay untouched and green.

### 5.2 Not done, and why (continued)

- **No unification of the page-side executors** — `index.html` keeps its inline
  `mcpToolExecutors`; the `hi-mcp-client` copy keeps serving the ligna-store.
  Unifying would require bundling TypeScript into the HTML, violating constraint 1. The
  third copy is a known trade-off (see [7.4](#74-known-trade-off-three-copies-of-the-page-side-executors)).
- **No change to ports of the MCP endpoint, tool set, tool descriptions, endpoint URL** — MCP
  clients registered against `http://localhost:3100/mcp` keep working without
  reconfiguration.

---

## 6. Output Changes to Expect

| Aspect | Before | After |
|---|---|---|
| `npm start` (root) | starts `hi-mcp-server.js`, zero deps, instant | installs/checks `hi-mcp` workspace (first run slower), then launcher + `vite-node` server |
| Example URL | `http://localhost:3100/?mcp=true&…` | `http://localhost:3000/?mcp=true&…` (launcher-served, port configurable) |
| MCP endpoint | `POST http://localhost:3100/mcp`, hand-rolled JSON-RPC | `POST http://localhost:3100/mcp`, SDK Streamable HTTP (JSON responses, stateless) — same client registrations |
| Processes | one (static + MCP + bridge in one file) | two (launcher: static + browser open; spawned poc-json server: MCP + bridge) |
| Page bridge | SSE + fetch (same origin) | WebSocket (`ws://localhost:3100/bridge`, cross-origin from the page, allowed by the server's default origin list) |
| Tool list / tool results | 9 tools | identical 9 tools, identical result shapes |
| Dependencies of the example flow | none | `hi-mcp` workspace install (npm) required once |
| Server log/error wording | example page | example URL in errors (via `HI_MCP_STORE_URL`); "ligna-store" wording in the log/error text remains, accepted |

---

## 7. Risks, Decisions, Open Questions

### 7.1 Risk: the SDK endpoint differs subtly from the hand-rolled one

The poc-json server creates a **new `McpServer` and transport per request** with
`sessionIdGenerator: undefined` and `enableJsonResponse: true` (`server.ts:33–49`) — the
stateless JSON mode clients used against the hand-rolled server. The 9 tools, their schemas
and descriptions are character-identical between `hi-mcp-server.js` and `hi-mcp-server.ts`.
Residual risk is client-specific (e.g. headers the SDK requires); the existing PoC clients
(Claude Code, VS Code Copilot) already work against this exact server in the store setup, so
the risk is low and caught by the smoke test.

### 7.2 Decision: how far "locally built" should go — resolved

Two readings were on the table: (a) *runnable* — dependencies installed, TS compiles
(typecheck gate) before start, `vite-node` executes the TS; (b) *compiled artifact* — an
esbuild/tsc build producing `dist/server.js`, started with plain `node`. The requester
confirmed **(a)**: install + typecheck gate, `vite-node` runs the TS — no build config added
to the PoC, the same runner the store workflow uses.

### 7.3 Decision: the poc-json server stays untouched — resolved

The first draft of this analysis proposed env-gated static serving and browser-open
**inside** `server.ts`, to preserve the old one-process/one-port setup. Rejected in the
requester's review: the server's env surface (`HI_MCP_PAGE_ORIGINS`, `HI_MCP_STORE_URL`,
`HI_MCP_PORT`) exists precisely so clients can wire themselves to it, and its default
allow-list already names port 3000 — the server was designed for a page it does not serve.
Serving the example from the launcher on port 3000 uses the server exactly as the store
does: untouched, configured from outside. The costs — a second process and the changed
example URL — are accepted; the benefit is that the single MCP implementation carries zero
example-specific code. The requester explicitly welcomed the example URL moving to port
3000.

### 7.4 Known trade-off: three copies of the page-side executors

After the refactoring the tool executors exist in `index.html` (inline), in
`hi-mcp-client/` (TypeScript, tested) and in the ligna-store's `hi-mcp/` copy. A
tool-behaviour fix must be applied in up to three places. Accepted per constraint 1 (the
example stays a single HTML file); the two TS copies already document their sync duty
(`hi-mcp-client/README.md`).

### 7.5 Open question: fate of the zero-dependency constraint

AGENTS.md's "No external dependencies — the server must remain zero-dependency" is specific
to the deleted standalone server and must be removed with it. The refactoring should state
in AGENTS.md that the single MCP server is the `hi-mcp-server` workspace package (with its
own locked dependencies), so the constraint does not resurface as a review objection.

### 7.6 Risk: Node version

`vite-node` 3.2.4 / `vite` 6.4.3 were pinned for Node 20.10 (feature analysis
`hi-mcp-poc-json.md` §4.2). The launcher inherits that requirement; no new risk, but the
example's README should state Node 20+.

### 7.7 Risk: port 3000 collision

The launcher's static port (3000) matches the server's default allow-list but is also the
ligna-store dev server's port and a common dev port generally. The two clients are never
needed at once; if the port is taken, the launcher fails loudly (`EADDRINUSE`) and its port
is configurable — in which case `HI_MCP_PAGE_ORIGINS` must name the chosen origin. Default:
3000, no env vars needed.

---

## 8. Implementation Plan (draft — for the plan review)

| # | Step | Verify |
|---|---|---|
| 1 | `minimal-hi-example/start.mjs` launcher: build gate (install + typecheck) → static file server on :3000 → spawn `vite-node hi-mcp/hi-mcp-server/server.ts` with `HI_MCP_STORE_URL` → open browser (`--no-open` flag); rewrite `minimal-hi-example/package.json` and root `package.json` start scripts | clean-checkout first run serves the page on :3000 and MCP on :3100; `git diff hi-mcp/` empty |
| 2 | `index.html`: swap the inline bridge transport to WebSocket, update the bridge comment | page connects (`page connected` in the server log); file still single HTML, inline JS |
| 3 | Delete `hi-mcp-server.js` | only historical references remain; `grep` check |
| 4 | Documentation: `minimal-hi-example/docs/hi-mcp-server.md`, `.agents/skills/hi-mcp-server.md`, `AGENTS.md`, READMEs | docs cross-checked against the new flow |
| 5 | Close out this analysis (status → Done, report appended) | index in `.agents/README.md` updated |

---

## 9. Close-Out Report (2026-09-27)

### 9.1 What was implemented

| Change | File |
|---|---|
| New launcher: build gate (install + typecheck), static serving of the example on :3000, spawns the poc-json server with `HI_MCP_STORE_URL`, browser auto-open (`--no-open` kept), `EXAMPLE_PORT` override, exits with the server and on SIGINT/SIGTERM | `minimal-hi-example/start.mjs` (new) |
| Start scripts rewritten | `minimal-hi-example/package.json` (`node start.mjs`), root `package.json` (`npm start --workspace minimal-hi-example`) |
| Inline bridge transport switched from EventSource+fetch to WebSocket (`ws://localhost:3100/bridge`, `hello` handshake, same result messages, 3 s reconnect); bridge comment updated. Single-file structure, executors, geometry, `?mcp=true` gate untouched | `minimal-hi-example/index.html` |
| Separate MCP server implementation deleted | `minimal-hi-example/hi-mcp-server.js` (removed) |
| **`hi-mcp/` untouched** — verified by `git diff hi-mcp/` empty | — |
| Docs updated: living reference, skill, AGENTS.md (overview, structure tree, patterns, rules incl. removal of the zero-dependency hard rule, workflow), `minimal-hi-example/README.md`, poc-json README + `hi-mcp/docs/*`, `.github/copilot-instructions.md` | see git diff |

### 9.2 Verification

- `npm run typecheck` at the `hi-mcp` root: clean (the launcher's build gate runs the same).
- `npm test` at the `hi-mcp` root: 78/78 tests pass. One suite, `cf/tests/worker.test.ts`, fails to
  load — pre-existing and unrelated (the Cloudflare workspace's `@cloudflare/containers` is absent
  from the root `node_modules`); no `hi-mcp/` file was touched by this refactoring.
- Smoke test (`node minimal-hi-example/start.mjs --no-open`): page `200 text/html` on
  `http://localhost:3000/?mcp=true`; MCP `initialize` and `tools/list` round-trips on
  `http://localhost:3100/mcp` return the full server info and the 9 tools; path traversal probes
  serve only files under `minimal-hi-example/` (the WHATWG URL parser collapses dot segments
  before the guard, and the guard catches the rest); SIGTERM shuts down launcher and server,
  both ports free.
- Not verified end-to-end: the in-browser WebSocket leg (needs the real planner page in a
  browser). The page's message protocol is identical to `hi-mcp-client`'s tested
  bridge; the `page connected` log line with a real tab is the remaining manual check.

### 9.3 Deviation from the plan

- `start.mjs` initially kept the launcher alive after SIGINT/SIGTERM (it killed the MCP child but
  not itself), orphaning the static server — found by the smoke test and fixed (kill child, then
  `process.exit(0)`). Recorded here because the smoke-test cleanup chase it caused is part of
  the work's history.

### 9.4 Known trade-offs carried forward

- Example URL now `http://localhost:3000/?mcp=true` (welcomed by the requester); MCP endpoint
  unchanged at `http://localhost:3100/mcp`.
- "ligna-store" wording remains in the server's log and error text (§4.4); the error's URL points
  at the example via `HI_MCP_STORE_URL`.
- Three copies of the page-side executors (§7.4).
- Port 3000 shared with the ligna-store dev server (§7.7) — never needed at once, `EXAMPLE_PORT`
  escapes it.
