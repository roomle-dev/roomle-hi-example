# HI MCP — Implementation

How the HI MCP is built: the processes, the modules and their responsibilities, the protocols
between them, and what to know before changing them. Written for developers who change or extend
the code.

This documentation describes **how** the code works. **What** the server does towards an agent and
**why** — the rules it serves, every decision, guard, correction and feedback message — is in
[hi-mcp-behaviour.md](../hi-mcp-behaviour.md); this documentation links to it instead of repeating
it. How to use the HI MCP is in the [user guide](../user-guide/README.md), how to install and
deploy it in [setup](../setup/).

| Page | Covers |
| ---- | ------ |
| [MCP server](./mcp-server.md) | `server.ts`, tool registration, the page bridge, the planner methods, undo and redo |
| [Tool executors](./tool-executors.md) | `tool-executors.ts`: the pipeline of every tool, the plan context the agent sees, corrections, row edits |
| [Layout and placement](./layout-and-placement.md) | `group-layout.ts`, `group-placement.ts`, `plan-space.ts`, the coordinate conventions |
| [Pages, chat and launcher](./pages-chat-and-launcher.md) | the page side of the bridge, `start.mjs`, the chat backend `hi-mcp-chat` |
| [Deployment and testing](./deployment-and-testing.md) | Cloudflare, the workspaces and scripts, the unit tests, the end-to-end test runs |

## The system

```text
AI agent (any MCP client) ───────────────── MCP ──────────────┐
example page chat ──> hi-mcp-chat (:3200) ── MCP ─────────────┤
ligna-store chat (runs in the page) ──────── MCP ─────────────┤
                                                              ▼
                                  hi-mcp-server (:3100)   POST /mcp — Streamable HTTP, stateless
                                    tool executors: validate, correct, compose planner calls,
                                    shape results
                                                              ▲
                                                              │ WS /bridge — the page connects out
                                  planner page: minimal-hi-example/index.html (:3000) or the store
                                    runs allow-listed methods on roomDesignerApi.extended
                                                              │
                                  roomle-ui web-sdk (homag-intelligence): plan context, layout
                                    loading, group commands, undo history, HI calculation
```

- **The server holds the tool logic, the page holds the planner.** A browser page cannot accept
  connections, so it connects outward to the server's WebSocket `/bridge`. A tool runs in the server
  and sends each planner call it needs over the bridge; the page executes it on
  `roomDesignerApi.extended` and answers ([ADR 0001](../../.agents/decisions/0001-hi-mcp-tool-logic-in-the-server.md)).
- **The page executes only allow-listed methods** — the ones `planner-api.ts` calls. Nothing else of
  the planner API (placing an order, overwriting the plan) is reachable from the server.
- **The planner does the planning.** The server never computes root-module positions. It turns the
  agent's relations into docking, derives a placement transform, and hands both to the planner,
  whose glue logic and HI calculation arrange the units exactly as for interactive planning.
- **One server, many clients.** The same server serves the example page, the ligna-store, the chat
  backend and external MCP clients, locally and on Cloudflare; clients wire themselves to it through
  URL parameters and environment variables
  ([ADR 0002](../../.agents/decisions/0002-one-mcp-server-configured-from-outside.md)).

### Processes and ports

| Process | Started by | Port | Code |
| ------- | ---------- | ---- | ---- |
| Example page (static files) | `npm start` (`minimal-hi-example/start.mjs`) | 3000 (`EXAMPLE_PORT`) | `minimal-hi-example/index.html` |
| MCP server | the launcher, `npm run mcp-server`, or the Cloudflare container | 3100 (`HI_MCP_PORT`, else `PORT`) | `hi-mcp/hi-mcp-server/` |
| Chat backend | the launcher, with `npm start <provider> <api-key>` | 3200 (`HI_CHAT_PORT`), bound to 127.0.0.1 | `hi-mcp/hi-mcp-chat/` |
| ligna-store dev server | `npm run dev` in the ligna-store | 3000 | `ligna-store/hi-mcp/` (bridge and chat in the store) |
| Cloudflare Worker + Container | `wrangler deploy` | — | `hi-mcp/cf/` |

## A tool call from end to end

`create-or-replace-groups` from the built-in chat, as an example:

1. The user types into the chat window of the example page. The page posts the whole conversation
   and its bridge `clientId` to `POST /chat` of the chat backend.
2. The chat backend runs one `streamText` turn with the MCP tools of `http://localhost:3100/mcp?client=<clientId>`.
   The model calls `get-plan-context`, then `create-or-replace-groups`.
3. The MCP server handles each tool call in a fresh `McpServer` + transport (stateless). The
   `client` parameter binds the request to the page that owns the planner; another page gets 409.
4. The tool handler logs the call and clones the arguments; the executor runs inside `oneAtATime`
   (one plan change at a time) and `recorded` (counts the planner steps for undo).
5. The executor validates and corrects the payload, compiles the relations into docking
   (`group-layout.ts`), probes the anchor frame of a new group's anchor article if it does not know
   it yet (`group-placement.ts`), and composes `loadExternalObjectGroupLayout(...)`.
6. `planner-api.ts` sends the call over the bridge: `{ kind: 'call', id, method, args }`. The page
   checks the allow-list, runs the method on `roomDesignerApi.extended`, and replies
   `{ kind: 'result', id, ok, result }`. The planner's `onHistoryChange` arrives as `historyChange`
   events.
7. The executor reads the plan again, applies kitchen-wide attributes, collects corrections, hints
   and `notLoaded` groups, and returns the result. `inPlacementFrame` rewrites every group position
   into the placement frame the agent writes; `withoutImageUrls` strips signed URLs.
8. The chat backend streams the model's answer to the page, with a `[tool] <name>` line per tool call
   for the status line.

The same call from an external MCP client skips steps 1, 2 and 8 and has no `client` binding.
[hi-mcp-behaviour.md §4](../hi-mcp-behaviour.md#4-how-a-tool-call-runs) describes the call from the
agent's side.

## Repository map

| Path | What it is |
| ---- | ---------- |
| `hi-mcp/hi-mcp-server/server.ts` | Process entry: HTTP server, `/mcp`, the `/bridge` upgrade, origins, the `client` check |
| `hi-mcp/hi-mcp-server/hi-mcp-server.ts` | `McpServer` per request: served instructions and rules, the 20 tool registrations (zod), logging, result shaping |
| `hi-mcp/hi-mcp-server/tool-executors.ts` | The tool logic — the largest file (≈3,700 lines) |
| `hi-mcp/hi-mcp-server/group-layout.ts` | Relations (`rightOf`, `above`, …) → docking entries |
| `hi-mcp/hi-mcp-server/group-placement.ts` | Placement of a new group: anchor root, anchor frame, repositioning data; reading positions back in the placement frame |
| `hi-mcp/hi-mcp-server/plan-space.ts` | Geometry: footprints, heights, walls, corners, wall placement, overlap and in-room tests |
| `hi-mcp/hi-mcp-server/plan-history.ts` | The record of plan-changing tool calls for `undo` and `redo` |
| `hi-mcp/hi-mcp-server/planner-api.ts` | The planner methods the tools may call, with their timeouts |
| `hi-mcp/hi-mcp-server/page-bridge.ts` | The connected page, call correlation, timeouts, protocol check |
| `hi-mcp/hi-mcp-server/types.ts` | The bridge message protocol, `BRIDGE_PROTOCOL` |
| `hi-mcp/hi-mcp-client/` | The page side of the bridge (`browser-bridge.ts`), the tested reference copy of the ligna-store's bridge |
| `hi-mcp/hi-mcp-chat/` | The chat backend (Vercel AI SDK): `POST /chat`, an MCP client of the server |
| `hi-mcp/cf/` | Cloudflare deployment: Worker, Container, Dockerfile |
| `minimal-hi-example/index.html` | The example page: HI presets demo, its own copy of the bridge, the chat window |
| `minimal-hi-example/start.mjs` | The launcher: build gate, static serving, spawns server and chat |
| `.agents/scripts/run-hi-mcp-prompt.js`, `run-hi-mcp-tests.js` | End-to-end runs of prompts through chat, server and a headless planner |
| `docs/test-prompts.json` | The end-to-end test cases |

The roomle-ui side, in `packages/web-sdk/packages/`:

| Path | What it is |
| ---- | ---------- |
| `homag-intelligence/src/external-object-api.ts` | The interface of the planner methods the tools call, with their documentation |
| `planner-core/src/roomle-planner.ts` | Their implementation on `RoomlePlanner` (`getExternalObjectPlanContext`, `loadExternalObjectGroupLayout`, `externalObjectGroupOperation`, …) |
| `homag-intelligence/src/hi-plan-context.ts` | The plan context: rooms with derived walls, catalog, groups, obstacles, master data; `HI_GROUP_OPERATION`, the group commands |
| `homag-intelligence/src/glue-logic.ts` | The group commands and the layout loading in the glue logic |
| `homag-intelligence/src/hi-root-module-arrangement.ts` | Row edits: the units above and their carriers (`carriersOfUnitsAbove`) |

## State and concurrency

The server creates a new `McpServer` per HTTP request, but its state lives in module singletons for
the lifetime of the process:

| State | Where | Reset |
| ----- | ----- | ----- |
| The connected page and its pending calls | `PageBridge` in `server.ts` | on disconnect |
| The undo record of tool calls | `planHistory` in `plan-history.ts` | when a page is accepted, or when the user changes the plan |
| The chain of plan changes | `planChanges` (`oneAtATime`) in `tool-executors.ts` | never |
| Anchor frames, master data, agent group ids | `knownAnchorFrames`, `knownMasterData`, `agentGroupIds` in `tool-executors.ts` | only in tests |

- **One page per process.** A second page is refused with WebSocket close code 4409 while the first
  is open. On Cloudflare, one process runs per `session`.
- **One plan change at a time, across all clients.** `oneAtATime` serializes every plan-changing tool
  and `get-plan-context`, because the page runs the calls it receives concurrently and the anchor
  probe finds its own groups by comparing the plan before and after a load.
- **A timed-out planner call is not cancelled** — the page may still execute it after the tool failed.

## Changing the code

### Add a tool

1. Register it in `hi-mcp-server.ts` with a zod schema, a description and a handler that calls
   `runTool`. A tool that changes the plan also goes into `PLAN_CHANGING_TOOLS` (its arguments and
   feedback are logged).
2. Add the executor to `toolExecutors` in `tool-executors.ts`. A plan-changing executor is wrapped in
   `planChange(tool, inPlacementFrame(...))` — without it, the tool is not serialized, undo does not
   see it, and its planner steps arrive as "user changes" that clear the undo record.
3. An edit of an existing group needs no new planner method: add the command in roomle-ui
   (`HI_GROUP_OPERATION` in `hi-plan-context.ts`, executed in `glue-logic.ts`) and forward it with
   `externalObjectGroupOperation`.
4. Only a tool that needs a new planner method extends `planner-api.ts` **and** every page
   allow-list: `MCP_PLANNER_METHODS` in `minimal-hi-example/index.html`, `PLANNER_METHODS` in
   `hi-mcp/hi-mcp-client/browser-bridge.ts`, and the ligna-store copy. `tests/planner-api.test.ts`
   checks that the client allow-list matches the planner API.
5. Unit tests in the matching `tests/` folder; then the behaviour reference, the tool reference in
   `docs/hi-mcp-server.md` and `.agents/skills/hi-mcp-tools.md`.

### Contracts that are easy to break

- **The served text is the server's interface.** The instructions, `AUTHORING_RULES` and the tool
  descriptions in `hi-mcp-server.ts`, and every correction, hint and error message, are read by the
  agents, quoted in [hi-mcp-behaviour.md](../hi-mcp-behaviour.md), and checked by tests. Change both
  in the same commit.
- **The log format is parsed.** `[hi-mcp] tool <name> args|feedback|error <json>` is read by
  `run-hi-mcp-prompt.js` to collect the tool calls of a turn.
- **The bridge protocol has three copies** — `hi-mcp-server/types.ts`, `hi-mcp-client/types.ts` and
  the ligna-store's — plus the inline bridge of `index.html`. Change `BRIDGE_PROTOCOL` when the
  protocol changes; the server refuses calls to a page with another protocol.
- **Undo counts roomle-ui's planner steps.** Which commands reload twice (`FOLLOW_UP_COMMANDS`) is
  roomle-ui behaviour mirrored in `tool-executors.ts`.
- **Geometry exists twice.** The footprint in the plan context is computed by roomle-ui
  (`hi-plan-context.ts`), the one of `place-group` by `plan-space.ts`. Keep them in step.
- **Guards are a last resort.** Before a check refuses agent input, read
  [Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort).
