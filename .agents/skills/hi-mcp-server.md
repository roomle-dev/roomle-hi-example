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
- **Origin allow-list**: `HI_MCP_PAGE_ORIGINS` (default: `http://localhost:3000`, `http://127.0.0.1:3000`, `https://www.roomle.com`) — applies to the `/bridge` upgrade and to browser calls of `/mcp`: these origins get CORS headers (`OPTIONS` preflight 204), every other origin gets none (preflight 403). Requests without an `Origin` (curl, server-side MCP clients) are unaffected
- **Env**: `HI_MCP_PORT`, `HOST`, `HI_MCP_PAGE_ORIGINS`, `HI_MCP_STORE_URL`, `HI_MCP_TLS_CERT`/`HI_MCP_TLS_KEY` (optional TLS)
- Orphan guard: shuts down with the dev script when its stdin pipe ends

#### 3. WebSocket bridge
- `GET ws://…/bridge` (WebSocket upgrade, origin-checked) connects the page
- The page sends `{kind:'hello', example, url, protocol: 2}`; the server relays planner method calls `{kind:'call', id, method, args: [...]}` and the page answers `{kind:'result', id, ok, result|error}` (`types.ts`, `BRIDGE_PROTOCOL`)
- A page whose hello carries no `protocol: 2` (an outdated, tool-level bridge) stays connected, but every call fails with an "update the page bridge" error
- The server correlates calls by id, with per-method timeouts (`planner-api.ts`: 120 s for `loadExternalObjectGroupLayout`, `externalObjectGroupOperation` and `getExternalObjectSnapshot`, 30 s otherwise) and a single-page policy: a newer connection replaces the previous one

#### 4. Tool logic (`tool-executors.ts`, `planner-api.ts`)
- The tool handlers in `hi-mcp-server.ts` run the executors in `tool-executors.ts`: payload validation, planner call composition, response shaping, agent hints
- The executors call the planner through `PlannerApi` (`planner-api.ts`): the seven planner methods the tools need, each forwarded over the bridge with positional arguments. All parameters are required — the call travels as JSON, which turns `undefined` into `null`
- The command tools (`change-module-attribute`, `change-group-attribute`, `merge-article-into-group`, `exchange-root-module`, `delete-root-module`, `delete-group`, `merge-groups`) share one planner method, `externalObjectGroupOperation(command, payload)`. Their executors resolve group id prefixes, check article ids against the catalog and forward the command; the edit runs in roomle-ui (`runGroupOperation` in `homag-intelligence/src/hi-plan-context.ts` over the operations of the glue logic), which answers with the affected groups in the plan-context shape once the planner has loaded them. Deletions and merges are performed by the kernel: the glue logic waits for the kernel's report of the group (`removedGroup`, `deleteRootModule`, `mergeGroups`), and a root module deletion the kernel does not report within the request is rejected as refused

#### 5. Group placement (internal)

Internal to the server: not part of the tool interface and never mentioned to the agent — the served rules, the tool descriptions, the tool reference and the authoring skills only know `placement`. `tests/hi-mcp-server.test.ts` guards the served text.

- A new group carries `placement { posGroup, posRotationY, rootId? }`. `create-or-replace-groups` turns it into the planner's `repositioningData { posGroup, posRotationY, rootId }` before the one load that creates the group (`toRepositioningData` in `group-placement.ts`).
- The anchor (`findAnchorRoot`): from `rootId` or the first root down to the unit carrying it (`*Top → *Bottom` docking), then left along its row (`RightBottom`/`LeftBottom` docking, read in both directions); a corner article (`cornerArticle` in the catalog) on the row is the anchor, because its left arm turns away along the second wall.
- A corner article is placed by its **corner frame** (`cornerFrameOfRoot`): the corner point — the shared start of its `LeftBack*`/`RightBack*` vectors, which can lie off the origin (Furniture_Smith `mr_CornerunitStraight`: root-local `[-261, 0, 0]` for the left-handed `UERTB90`/`EUERTB90`, `[1161, 0, 0]` for the right-handed `UELTB90`/`EUELTB90`) — and its turn: the rotation from the left-handed frame (`RightBack` along +x, `LeftBack` along +z) to the article's, 0 for carcase direction Left, 270 for Right. `toRepositioningData` turns the group by `posRotationY − turn` and adds the negated corner point, rotated by that rotation, to `posGroup` (no `rootRelPos`, the planner receives the anchor origin's room point): the corner point lands on the point the agent gave and both back edges run along the walls the corner table names, for either hand. The hand and the point depend on the article **and its attributes** (`mod_CarcaseDirection` can be overridden, and all four articles share the module), so `probeCornerFrame` loads a single-pick probe of the anchor as authored — article and attribute overrides — reads the frame from its docking vectors, removes every calculated group the probe load added (`removeExternalObject`; the load result carries runtime ids only, so the probe is found by comparing the raw groups before and after) and remembers the frame per library, article and attribute overrides for the server's lifetime (`cornerVariantKey`, `knownCornerFrames`) — one extra load per corner variant and server start, before the agent's group is loaded once. The plan's calculated groups, the module name and the catalog's `cornerPoint` are not used: none of them tells the variant the agent authored ([bug analysis](../bug-analysis/right-handed-corner-article-placed-outside-the-room.md)). A probed article without corner vectors is remembered with no offset and no turn. When the probe calculates nothing, the call fails before the group is loaded instead of loading it off the corner. `get-plan-context` strips `cornerPoint` from the articles it returns.
- The tools that change the plan (`create-or-replace-groups`, `place-group` and the seven group commands) run one after another (`oneAtATime` in `tool-executors.ts`); the read-only tools do not wait. The page runs every planner call it receives at once, and models do call several tools in parallel (`create-or-replace-groups` beside `place-group` or `change-group-attribute` in the test runs) — the probe finds its groups by comparing the raw groups before and after its load, so the groups a concurrent call loads or splits meanwhile would count as its own and be removed. A call that fails does not hold up the next one. A new plan-changing tool is wrapped the same way.
- A placement on a group that is already in the plan is rejected: the planner would re-apply it on the replace and move the group. Moving groups is not part of the placement; `place-group` moves them.
- `place-group` works on the calculated group (`getExternalObjectGroups`), not on the anchor walk: `plan-space.ts` (recovered from the page-side tool of `a4df7f5^`) derives the footprint from part boxes, docking vector points or the `b`/`t` attributes and the corner geometry from the `LeftBack*`/`RightBack*` vectors, puts the corner point into the shared corner by matching the two back edges to the walls (`placeCornerAtWalls`) or the footprint against the wall (`placeAgainstWall`), and yields the group transform. `repositioningFromPlacement` turns it into the room transform of the first article root from that root's transform in the group; the planner's `G = T · R_root⁻¹` reverses exactly that, so the result is exact for any root and needs no corner offset. The group keeps its y (wall units), and a target whose footprint meets another group's (separating axis test, 5 mm) is rejected before the one reload. The reload sends the calculated roots without `articlePos`/`rotationY` and docking indices, with `reason: 'adjusted'`. The result reports `placedIn` (`corner` or `wall`) and never the internal fields.
- A corner article is recognised by the catalog's `cornerArticle` flag, its `category` ("… | Base Units | Corner") or its root module name (`mr_CornerunitStraight`) — `isCornerArticle`. roomle-ui derives the flag and the `cornerPoint` from docking data that only a calculated root of the article provides, so on an empty plan the flag is false and the point missing; without the fallback the anchor walk treated the corner article as a plain unit, walked along its turned left arm and anchored the arm's end, which turned the kitchen by 90° (plan snapshot `ps_qid6jsck322rq3g2stszoxzue4uwnxw`). `get-plan-context` completes the flag for the agent the same way. The corner point that is missing on an empty plan comes from the probe (above); roomle-ui calculating the article templates for the catalog would make the probe unnecessary ([backlog](../backlog/roomle-ui-article-template-geometry.md)).

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
- Snapshot calls (`loadExternalObjectGroupLayout` for `create-or-replace-groups` and `place-group`, `externalObjectGroupOperation` for the command tools, `getExternalObjectSnapshot` for `get-order-data` and `get-plan-images`): 120 seconds
- No page connected: error names the client URL (`HI_MCP_STORE_URL`)
- Unit tests: `npm test` at the `hi-mcp` root (vitest)

## Adding New Tools

1. Register the tool in `hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts` (zod schema, handler via `runTool`)
2. Implement the executor in `hi-mcp/hi-mcp-poc-json/tool-executors.ts` — no page changes
3. An edit of existing groups is a command: add it in roomle-ui (`HI_GROUP_OPERATION`, a payload type and a handler in `hi-plan-context.ts`, an operation on the glue logic) and forward it here through `externalObjectGroupOperation` — no page change
4. Only if the tool needs a planner method not exposed yet: add it to `planner-api.ts` and to every page allow-list (`MCP_PLANNER_METHODS` in `minimal-hi-example/index.html`, `PLANNER_METHODS` in `hi-mcp/hi-mcp-poc-json-client/browser-bridge.ts`, then copy to the ligna-store). Keep methods that place orders or overwrite the plan out unless explicitly decided
5. Update documentation (`minimal-hi-example/docs/hi-mcp-server.md`, `.agents/skills/hi-mcp-tools.md`)
6. Add/extend unit tests in `hi-mcp/hi-mcp-poc-json/tests/`
7. `npm test` + `npm run typecheck` at the `hi-mcp` root

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
npm run start:cf                    # page + the Cloudflare-hosted MCP server, no local server
cd hi-mcp && npm test               # unit tests
cd hi-mcp && npm run typecheck      # typecheck used by the build gate
```
