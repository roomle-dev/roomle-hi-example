# HI MCP Server Skill

**Load this skill when the task involves:** MCP server architecture, HTTP handling, the WebSocket bridge, Model Context Protocol implementation, tool registration, or server-side logic in `minimal-hi-example` / `hi-mcp/hi-mcp-poc-json`.

## Overview

The HI MCP Server lets AI agents orchestrate HOMAG Intelligence (HI) object groups in live Roomle room-planner sessions. There is **one MCP server implementation** in this repository: the TypeScript server in `hi-mcp/hi-mcp-poc-json` (`@modelcontextprotocol/sdk` + `ws` + zod, run via `vite-node`). The former zero-dependency variant in `minimal-hi-example` was removed; its start UX lives on in the launcher `minimal-hi-example/start.mjs`.

Clients of the same server: the standalone HI presets example (`minimal-hi-example/index.html`, started by the launcher) and the INT-stage ligna-store (its page-side bridge is `hi-mcp/hi-mcp-poc-json-client/`).

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│              start.mjs launcher (port 3000)              │
│  - build gate: npm install + typecheck of hi-mcp         │
│  - serves minimal-hi-example/ (the example page)         │
│  - spawns the MCP server, opens the browser              │
└────────────────────────┬────────────────────────────────┘
                         │ spawn
                         ▼
┌─────────────────────────────────────────────────────────┐
│        hi-mcp/hi-mcp-poc-json server.ts (port 3100)       │
│                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │  HTTP Server │    │   MCP Layer  │    │  WS Bridge  │  │
│  │ POST /mcp only│   │ (MCP SDK,    │    │ (ws,        │  │
│  │              │    │  zod tools)  │    │  /bridge)   │  │
│  └─────────────┘    └─────────────┘    └─────────────┘  │
└─────────────────────────────────────────────────────────┘
                         │  WebSocket
                         ▼
              ┌──────────────────────┐
              │  Example page (index.html, :3000)  │
              │  roomDesignerApi.extended          │
              └──────────────────────┘
```

### Key Components

#### 1. Launcher (`minimal-hi-example/start.mjs`)
- **Build gate**: installs the `hi-mcp` workspace when `node_modules` is missing and runs the typecheck (`npm run typecheck` at the `hi-mcp` root) before anything starts.
- **Static serving**: serves `minimal-hi-example/` on port 3000 (configurable via `EXAMPLE_PORT`) — the port in the server's default WebSocket origin allow-list, so no extra configuration is needed.
- **Server spawn**: `npm start --workspace hi-mcp-poc-json` in the `hi-mcp` root, with `HI_MCP_STORE_URL` pointing the "no page connected" error at the example URL.
- **Browser auto-open**, skipped with `--no-open`.
- Exits when the MCP server exits; SIGINT/SIGTERM kill the child and exit.

#### 2. MCP server (`hi-mcp/hi-mcp-poc-json/server.ts`)
- **Port**: 3100 (`HI_MCP_PORT` / `PORT` env)
- **Routes**: `POST /mcp` (Streamable HTTP, JSON response mode, stateless — a new `McpServer` + transport per request); everything else is 404
- **Protocol**: `@modelcontextprotocol/sdk`, tools registered with zod schemas in `hi-mcp-server.ts`
- **Origin allow-list**: `HI_MCP_PAGE_ORIGINS` (default: `http://localhost:3000`, `http://127.0.0.1:3000`, `https://www.roomle.com`)
- **Env**: `HI_MCP_PORT`, `HOST`, `HI_MCP_PAGE_ORIGINS`, `HI_MCP_STORE_URL`, `HI_MCP_TLS_CERT`/`HI_MCP_TLS_KEY` (optional TLS)
- Orphan guard: shuts down with the dev script when its stdin pipe ends

#### 3. WebSocket bridge
- `GET ws://…/bridge` (WebSocket upgrade, origin-checked) connects the page
- The page sends `{kind:'hello', example, url, protocol: 2}`; the server relays planner method calls `{kind:'call', id, method, args: [...]}` and the page answers `{kind:'result', id, ok, result|error}` (`types.ts`, `BRIDGE_PROTOCOL`)
- A page whose hello carries no `protocol: 2` (an outdated, tool-level bridge) stays connected, but every call fails with an "update the page bridge" error
- The server correlates calls by id, with per-method timeouts (`planner-api.ts`: 120 s for `loadExternalObjectGroupLayout` and `getExternalObjectSnapshot`, 30 s otherwise) and a single-page policy: a newer connection replaces the previous one

#### 4. Tool logic (`tool-executors.ts`, `planner-api.ts`)
- The tool handlers in `hi-mcp-server.ts` run the executors in `tool-executors.ts`: payload validation, planner call composition, response shaping, agent hints
- The executors call the planner through `PlannerApi` (`planner-api.ts`): the five planner methods the tools need, each forwarded over the bridge with positional arguments. All parameters are required — the call travels as JSON, which turns `undefined` into `null`

### Bridge — page side (minimal-hi-example/index.html)

- Active only with the `mcp=true` query parameter
- Connects a `WebSocket` to `ws://localhost:3100/bridge`, reconnects every 3 s on close
- Executes the planner methods on its allow-list (`MCP_PLANNER_METHODS`) against `roomDesignerApi.extended`, rejects every other method, sends results back over the socket — no tool logic in the page

The ligna-store runs the same protocol via `hi-mcp/hi-mcp-poc-json-client/` (browser-bridge with `PLANNER_METHODS`, types) — no automatic sync, copy after changes. The allow-lists change only when a tool needs a new planner method; `tests/planner-api.test.ts` fails when the server's planner methods and the client allow-list diverge.

## Server Lifecycle

1. Launcher: build gate (install + typecheck)
2. Launcher: static server listens on :3000
3. Launcher: spawns the MCP server (vite-node server.ts) with env vars
4. Server listens on :3100 and waits for a page
5. Launcher opens the browser at the example URL (unless `--no-open`)
6. Page with `mcp=true` connects via WebSocket; server logs `page connected`

## Tool Execution Flow

1. MCP Client sends tools/call to `POST /mcp`
2. SDK validates against the zod schema
3. Server runs the tool's executor (`tool-executors.ts`); an invalid payload is rejected here, before any planner call
4. Each planner call of the executor goes over the page WebSocket as a method call
5. Page executes the method via `roomDesignerApi.extended` and sends the result back over the socket
6. The executor composes the results; the server returns the tool result to the MCP client

## Timeouts and Error Handling

- Timeouts apply per planner call; default: 30 seconds
- Snapshot calls (`loadExternalObjectGroupLayout` for `create-or-replace-groups`, `getExternalObjectSnapshot` for `get-order-data` and `get-plan-images`): 120 seconds
- No page connected: error names the client URL (`HI_MCP_STORE_URL`)
- Unit tests: `npm test` at the `hi-mcp` root (vitest)

## Adding New Tools

1. Register the tool in `hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts` (zod schema, handler via `runTool`)
2. Implement the executor in `hi-mcp/hi-mcp-poc-json/tool-executors.ts` — no page changes
3. Only if the tool needs a planner method not exposed yet: add it to `planner-api.ts` and to every page allow-list (`MCP_PLANNER_METHODS` in `minimal-hi-example/index.html`, `PLANNER_METHODS` in `hi-mcp/hi-mcp-poc-json-client/browser-bridge.ts`, then copy to the ligna-store). Keep methods that place orders or overwrite the plan out unless explicitly decided
4. Update documentation (`minimal-hi-example/docs/hi-mcp-server.md`, `.agents/skills/hi-mcp-tools.md`)
5. Add/extend unit tests in `hi-mcp/hi-mcp-poc-json/tests/`
6. `npm test` + `npm run typecheck` at the `hi-mcp` root

## Modifying Existing Tools

1. Understand current behavior; the tool logic lives in the server only (`tool-executors.ts`)
2. Maintain backward compatibility; update the zod schema if needed
3. Deploy the server — the pages need no change unless the planner methods change
4. Test with existing clients

## Common Issues and Solutions

| Issue | Solution |
|---|---|
| Page not connecting | Open `http://localhost:3000/?mcp=true` and keep the tab open |
| Port 3000 in use | `EXAMPLE_PORT=3101 npm start` (then set `HI_MCP_PAGE_ORIGINS` for the chosen origin) |
| Port 3100 in use | The server names the fix (`lsof -ti tcp:3100 \| xargs kill`) |
| Tools timing out | Expensive operation — check the snapshot timeout class of the tool |
| Invalid parameters | Validated against the zod schema by the SDK |
| First start is slow | Build gate: workspace install + typecheck run first |

## Useful Commands

```bash
npm start                          # from the repository root: page + MCP server
node minimal-hi-example/start.mjs --no-open   # same, without opening a browser
EXAMPLE_PORT=3101 npm start         # other page port
cd hi-mcp && npm test               # unit tests
cd hi-mcp && npm run typecheck      # typecheck used by the build gate
```
