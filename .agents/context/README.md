# HI MCP — Implementation

How the HI MCP is built: the processes, the modules and their responsibilities, the protocols
between them, and what to know before changing them. Written for developers who change or extend
the code.

This folder is the digital brain for the implementation in this repository: every new feature is
documented and added here, and every change to the implementation requires an update here.

This documentation describes **how** the code works. **What** the server does towards an agent and
**why** — the rules it serves, every decision, guard, correction and feedback message — is in
[hi-mcp-behaviour.md](../../docs/hi-mcp-behaviour.md); this documentation links to it instead of repeating
it. How to use the HI MCP is in the [user guide](../../docs/user-guide/README.md), how to install and
deploy it in [setup](../../docs/setup/).

| Page | Covers |
| ---- | ------ |
| [MCP server](./mcp-server.md) | `server.ts`, tool registration, the page bridge, the planner methods, undo and redo |
| [Tool executors](./tool-executors.md#tool-overview) | Overview table of all MCP tools; `tool-executors.ts`, `agent-facing.ts` and the tool commands of roomle-ui (`hi-tool-commands.ts`): tool pipelines, the plan context the agent sees, corrections, row edits |
| [Layout and placement](./layout-and-placement.md) | roomle-ui `hi-group-layout.ts`, `hi-group-placement.ts`, `hi-plan-space.ts`, `hi-wall-placement.ts`, the coordinate conventions |
| [Pages, chat and launcher](./pages-chat-and-launcher.md) | the page side of the bridge, `start.mjs`, the chat backend `hi-mcp-chat` |
| [Deployment and testing](./deployment-and-testing.md) | Cloudflare, the workspaces and scripts, the unit tests, the end-to-end test runs |

## The system

```text
AI agent (any MCP client) ───────────────── MCP ──────────────┐
example page chat ──> hi-mcp-chat (:3200) ── MCP ─────────────┤
ligna-store chat (runs in the page) ──────── MCP ─────────────┤
                                                              ▼
                                  hi-mcp-server (:3100)   POST /mcp — Streamable HTTP, stateless
                                    tool registry, served text, the plan context in the agent's
                                    words, undo and redo; a plan-changing tool is one planner call
                                                              ▲
                                                              │ WS /bridge — the page connects out
                                  planner page: minimal-hi-example/index.html (:3000) or the store
                                    runs allow-listed methods on roomDesignerApi.extended
                                                              │
                                  roomle-ui web-sdk (homag-intelligence): the HI tool commands,
                                    plan context, group operations, undo history, HI calculation
```

- **The server holds the tools, the page holds the planner.** A browser page cannot accept
  connections, so it connects outward to the server's WebSocket `/bridge`. A tool runs in the server
  and sends each planner call it needs over the bridge; the page executes it on
  `roomDesignerApi.extended` and answers ([ADR 0001](../../.agents/decisions/0001-hi-mcp-tool-logic-in-the-server.md)).
- **A tool that changes the plan is one planner call.** The server sends
  `externalObjectGroupOperation(<tool name>, <the tool's arguments>)`, and roomle-ui performs the
  whole tool as a tool command: corrections, ids, docking, placement, materials, hints (D71 of
  [hi-mcp-behaviour.md](../../docs/hi-mcp-behaviour.md#3-decisions)).
- **The page executes only allow-listed methods** — the ones `planner-api.ts` calls. Nothing else of
  the planner API (placing an order, overwriting the plan) is reachable from the server.
- **The planner does the planning.** No tool computes root-module positions. The tool commands turn
  the agent's relations into docking and derive a placement transform; the glue logic and the HI
  calculation arrange the units exactly as for interactive planning.
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

1. The user types into the chat window of the planner (the AI Planning Assistant of roomle-ui),
   which hands the message to the example page (`onPlanningAssistantPrompt`). The page posts the
   whole conversation and its bridge `clientId` to `POST /chat` of the chat backend.
2. The chat backend runs one `streamText` turn with the MCP tools of `http://localhost:3100/mcp?client=<clientId>`.
   The model calls `get-plan-context`, then `create-or-replace-groups`.
3. The MCP server handles each tool call in a fresh `McpServer` + transport (stateless). The
   `client` parameter binds the request to the page that owns the planner; another page gets 409.
4. The tool handler logs the call and clones the arguments; the executor runs inside `oneAtATime`
   (one plan change at a time) and `recorded` (counts the planner steps for undo).
5. The executor sends one planner call:
   `externalObjectGroupOperation('create-or-replace-groups', args)`.
6. `planner-api.ts` sends the call over the bridge: `{ kind: 'call', id, method, args }`. The page
   checks the allow-list, runs the method on `roomDesignerApi.extended`, and replies
   `{ kind: 'result', id, ok, result }`. The planner's `onHistoryChange` arrives as `historyChange`
   events.
7. In the page, roomle-ui runs the tool command (`runToolCommand`, `hi-tool-commands.ts`): it
   validates and corrects the payload, compiles the relations into docking (`hi-group-layout.ts`),
   takes the anchor frame of a new group's anchor from its article template
   (`calculateArticleTemplate`), loads the groups, moves the groups placed by wall, applies the
   group-wide attributes, collects corrections, hints and `notLoaded` groups, reports every group
   position in the placement frame the agent writes (`inPlacementFrame`), and answers with the result
   and the planner step it made (`historySteps`: the tool call is one step of the planner's history).
8. The executor counts the steps for undo and removes them from the result; `withoutImageUrls`
   strips signed URLs.
9. The chat backend streams the model's answer to the page, with a `[tool] <name>` line per tool call
   for the status line; the page passes both to the chat window (`planningAssistantOutput`).

The same call from an external MCP client skips steps 1, 2 and 9 and has no `client` binding.
[hi-mcp-behaviour.md §4](../../docs/hi-mcp-behaviour.md#4-how-a-tool-call-runs) describes the call from the
agent's side.

## Repository map

| Path | What it is |
| ---- | ---------- |
| `hi-mcp/hi-mcp-server/server.ts` | Process entry: HTTP server, `/mcp`, the `/bridge` upgrade, origins, the `client` check |
| `hi-mcp/hi-mcp-server/hi-mcp-server.ts` | `McpServer` per request: served instructions and rules, the 20 tool registrations (zod), logging, result shaping |
| `hi-mcp/hi-mcp-server/tool-executors.ts` | The tool executors: `get-plan-context`, `find-attributes`, the forward of every plan-changing tool, undo and redo, one plan change at a time |
| `hi-mcp/hi-mcp-server/agent-facing.ts` | The plan context in the agent's words: wall names, room corners, the wall of a door or a window, short descriptions |
| `hi-mcp/hi-mcp-server/plan-history.ts` | The record of plan-changing tool calls for `undo` and `redo` |
| `hi-mcp/hi-mcp-server/planner-api.ts` | The planner methods the tools may call, with their timeouts |
| `hi-mcp/hi-mcp-server/page-bridge.ts` | The connected page, call correlation, timeouts, protocol check |
| `hi-mcp/hi-mcp-server/types.ts` | The bridge message protocol, `BRIDGE_PROTOCOL` |
| `hi-mcp/hi-mcp-client/` | The page side of the bridge (`browser-bridge.ts`), the tested reference copy of the ligna-store's bridge |
| `hi-mcp/hi-mcp-chat/` | The chat backend (Vercel AI SDK): `POST /chat`, an MCP client of the server |
| `hi-mcp/cf/` | Cloudflare deployment: Worker, Container, Dockerfile |
| `minimal-hi-example/index.html` | The example page: HI presets demo, its own copy of the bridge, the host of the planner's chat window |
| `minimal-hi-example/start.mjs` | The launcher: build gate, static serving, spawns server and chat |
| `.agents/scripts/run-hi-mcp-prompt.js`, `run-hi-mcp-tests.js` | End-to-end runs of prompts through chat, server and a headless planner |
| `docs/test-prompts.json` | The end-to-end test cases |

The roomle-ui side, in `packages/web-sdk/packages/`:

| Path | What it is |
| ---- | ---------- |
| `homag-intelligence/src/external-object-api.ts` | The interface of the planner methods the tools call, with their documentation |
| `planner-core/src/roomle-planner.ts` | Their implementation on `RoomlePlanner` (`getExternalObjectPlanContext`, `externalObjectGroupOperation`, …) |
| `homag-intelligence/src/hi-tools.ts` | `HiToolsImplementation`: `getPlanContext` (the groups in the placement frame), `executeGroupOperation` (a command named like a tool runs the tool command, every other command the group operation), the group operations; it implements `HiToolPlanner` in the planner itself |
| `homag-intelligence/src/hi-tool-commands.ts` | The HI tool commands: `HI_TOOL_COMMANDS`, one per plan-changing tool, `runToolCommand` (reports `historySteps`), `inPlacementFrame` |
| `homag-intelligence/src/hi-tool-ids.ts`, `hi-tool-payload.ts`, `hi-tool-docking.ts`, `hi-tool-hints.ts`, `hi-tool-attributes.ts`, `hi-wall-placement.ts` | The parts of the tool commands: ids and articles, the payload, the docking, the hints, the group attributes and library changes, the wall placement |
| `homag-intelligence/src/hi-group-layout.ts`, `hi-group-placement.ts`, `hi-plan-space.ts` | Relations → docking, the anchor and its frame, the geometry ([Layout and placement](./layout-and-placement.md)) |
| `homag-intelligence/src/hi-plan-context.ts` | The plan context: rooms with derived walls, catalog, groups, obstacles, installation elements, master data, the article selector; `HI_GROUP_OPERATION`, the group operations; `HI_TOOL_COMMAND` |
| `homag-intelligence/src/glue-logic.ts` | The layout loading and `calculateArticleTemplate`, the article template calculated outside the plan |
| `homag-intelligence/src/hi-root-module-arrangement.ts` | Row edits: the units above and their carriers (`carriersOfUnitsAbove`) |

## State and concurrency

The server creates a new `McpServer` per HTTP request, but its state lives in module singletons for
the lifetime of the process:

| State | Where | Reset |
| ----- | ----- | ----- |
| The connected page and its pending calls | `PageBridge` in `server.ts` | on disconnect |
| The undo record of tool calls | `planHistory` in `plan-history.ts` | when a page is accepted, or when the user changes the plan |
| The chain of plan changes | `planChanges` (`oneAtATime`) in `tool-executors.ts` | never |
| The agent's group ids of earlier calls | `HiToolState.agentGroupIds` of roomle-ui `HiToolsImplementation` | with the planner page |
| The calculated article templates | `_articleTemplates` of the roomle-ui glue logic | when the library's article templates are loaded again (`loadPosData`) |

- **One page per process.** A second page is refused with WebSocket close code 4409 while the first
  is open. On Cloudflare, one process runs per `session`.
- **One plan change at a time, across all clients.** `oneAtATime` serializes every plan-changing tool
  and `get-plan-context`, because the page runs the calls it receives concurrently and the undo
  record of a call compares the plan before and after it.
- **A timed-out planner call is not cancelled** — the page may still execute it after the tool failed.

## Changing the code

### Add a tool

1. Register it in `hi-mcp-server.ts` with a zod schema, a description and a handler that calls
   `runTool`. A tool that changes the plan also goes into `PLAN_CHANGING_TOOLS` (its arguments and
   feedback are logged).
2. Add the executor to `toolExecutors` in `tool-executors.ts`. A plan-changing tool is
   `inPlanner(tool)`, which wraps the forward in `planChange` — without it, the tool is not
   serialized, undo does not see it, and its planner steps arrive as "user changes" that clear the
   undo record.
3. A plan-changing tool needs no new planner method: add its tool command in roomle-ui
   (`HI_TOOL_COMMAND` in `hi-plan-context.ts`, the command in `HI_TOOL_COMMANDS` of
   `hi-tool-commands.ts`), which reports its planner steps through `runToolCommand`. A new edit the
   planner does not offer yet is a group operation (`HI_GROUP_OPERATION`, executed in `hi-tools.ts`)
   the tool command runs.
4. Only a tool that needs a new planner method extends `planner-api.ts` **and** every page
   allow-list: `MCP_PLANNER_METHODS` in `minimal-hi-example/index.html`, `PLANNER_METHODS` in
   `hi-mcp/hi-mcp-client/browser-bridge.ts`, and the ligna-store copy. `tests/planner-api.test.ts`
   checks that the client allow-list matches the planner API.
5. Unit tests in the matching `tests/` folder — a tool command's in roomle-ui
   `homag-intelligence/__tests__/hi-tool-commands/`; then the behaviour reference, the tool reference
   in `docs/hi-mcp-server.md` and `.agents/skills/hi-mcp-tools.md`.

### Contracts that are easy to break

- **The served text is the server's interface.** The instructions, `AUTHORING_RULES` and the tool
  descriptions in `hi-mcp-server.ts`, and every correction, hint and error message — those of the
  tool commands in roomle-ui —, are read by the agents, quoted in
  [hi-mcp-behaviour.md](../../docs/hi-mcp-behaviour.md), and checked by tests. Change both in the same
  change: a message of a tool command with the behaviour reference that quotes it.
- **The log format is parsed.** `[hi-mcp] tool <name> args|feedback|error <json>` is read by
  `run-hi-mcp-prompt.js` to collect the tool calls of a turn.
- **The bridge protocol has three copies** — `hi-mcp-server/types.ts`, `hi-mcp-client/types.ts` and
  the ligna-store's — plus the inline bridge of `index.html`. Change `BRIDGE_PROTOCOL` when the
  protocol changes; the server refuses calls to a page with another protocol.
- **Undo counts roomle-ui's planner steps.** The planner runs a tool call as one step and the tool
  command reports it (`historySteps`, `hi-tool-commands.ts`). A tool command that changes the plan outside the `HiToolPlanner` it is
  given is not counted, and the undo record breaks.
- **Geometry exists twice in roomle-ui.** The footprint in the plan context is computed by
  `hi-plan-context.ts` (group space), the one of the placement by `hi-plan-space.ts` (room space).
  Keep them in step.
- **Guards are a last resort.** Before a check refuses agent input, read
  [Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort).

- [Interior fittings](interior-fittings.md) — discovery, fitting commands, identity, completion and history.
