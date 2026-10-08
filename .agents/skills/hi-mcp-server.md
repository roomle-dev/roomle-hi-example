# HI MCP Server Skill

**Load this skill when the task involves:** MCP server architecture, HTTP handling, the WebSocket bridge, Model Context Protocol implementation, tool registration, or server-side logic in `minimal-hi-example` / `hi-mcp/hi-mcp-server`.

## Overview

The HI MCP Server lets AI agents orchestrate HOMAG Intelligence (HI) object groups in live Roomle room-planner sessions. There is **one MCP server implementation** in this repository: the TypeScript server in `hi-mcp/hi-mcp-server` (`@modelcontextprotocol/sdk` + `ws` + zod, run via `vite-node`). It carries no client-specific code and serves no page: every client wires itself to it through environment variables, and the example page is served and opened by the launcher `minimal-hi-example/start.mjs` ([ADR 0002](../decisions/0002-one-mcp-server-configured-from-outside.md)).

Clients of the same server: the standalone HI presets example (`minimal-hi-example/index.html`, started by the launcher) and the ligna-store, whose bridge starts together with its chat window — on any stage, with the `model`, `api_key` and `mcp_server` query parameters (its page-side bridge is a copy of `hi-mcp/hi-mcp-client/`).

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
│        hi-mcp/hi-mcp-server/server.ts (port 3100)         │
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
- **Build gate**: installs the `hi-mcp` workspace when `node_modules` is missing and runs the typecheck (`npm run typecheck` at the `hi-mcp` root) before anything starts. There is no compiled artifact: `vite-node` runs the TypeScript.
- **Static serving**: serves `minimal-hi-example/` on port 3000 (configurable via `EXAMPLE_PORT`).
- **Server spawn**: `npm start --workspace hi-mcp-server` in the `hi-mcp` root, with `HI_MCP_STORE_URL` pointing the "no page connected" error at the example URL and, unless set, `HI_MCP_PAGE_ORIGINS` naming the page's origin (`localhost` and `127.0.0.1` on the page port, plus `https://www.roomle.com`) — another `EXAMPLE_PORT` needs no extra configuration. `HI_MCP_PORT` moves the server and is passed to the page as `mcp_port`.
- **Browser auto-open**, skipped with `--no-open`.
- Exits when the MCP server exits; SIGINT/SIGTERM kill the child and exit.

#### 2. MCP server (`hi-mcp/hi-mcp-server/server.ts`)
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
- The server takes a result only from the active page — every call goes there — and ignores a frame that is not a JSON object, so a stray socket cannot answer a call or end the server
- The server correlates calls by id, with per-method timeouts (`planner-api.ts`: 120 s for `loadExternalObjectGroupLayout`, `externalObjectGroupOperation` and `getExternalObjectSnapshot`, 30 s otherwise) and a single-page policy: an OPEN owner rejects a new page (close 4409, "Planner session in use"; the page stops reconnecting); a CLOSING owner gives way after its pending calls are rejected — guarded by `it('rejects a second page without disrupting the active planner call')` and `it('accepts a replacement when the previous socket is closing')` in `hi-mcp/hi-mcp-server/tests/page-bridge.test.ts`

#### 4. Tool logic (`tool-executors.ts`, `planner-api.ts`)
- The tool handlers in `hi-mcp-server.ts` run the executors in `tool-executors.ts`: payload validation, planner call composition, response shaping, agent hints
- The executors call the planner through `PlannerApi` (`planner-api.ts`): the nine planner methods the tools need (`getExternalObjectPlanContext`, `loadExternalObjectGroupLayout`, `externalObjectGroupOperation`, `fetchPrice`, `getExternalObjectSnapshot`, `getExternalObjectGroups`, `removeExternalObject`, `undo`, `redo`), each forwarded over the bridge with positional arguments. All parameters are required — the call travels as JSON, which turns `undefined` into `null`
- The command tools (`change-module-attribute`, `change-group-attribute`, `merge-article-into-group`, `insert-article-into-group`, `exchange-root-module`, `swap-root-modules`, `delete-article-and-compact`, `delete-article-in-place`, `delete-group`, `merge-groups`) share one planner method, `externalObjectGroupOperation(command, payload)`. Their executors resolve group id prefixes, check article ids against the catalog (an id in another spelling is read in the catalog's spelling; `merge-article-into-group` also moves a taken side to the free end of the row and derives a missing partner vector — all reported in `corrections`) and forward the command; the edit runs in roomle-ui (`runGroupOperation` in `homag-intelligence/src/hi-plan-context.ts` over the operations of the glue logic), which answers with the affected groups in the plan-context shape once the planner has loaded them. Deletions and merges are performed by the kernel: the glue logic waits for the kernel's report of the group (`removedGroup`, `deleteRootModule`, `mergeGroups`), and a root module deletion the kernel does not report within the request is rejected as refused

#### 5. Group placement (internal)

Internal to the server: not part of the tool interface and never mentioned to the agent — the served rules, the tool descriptions, the tool reference and the authoring skills only know `placement`. `tests/hi-mcp-server.test.ts` guards the served text.

- A new group carries `placement { posGroup, posRotationY, rootId? }`. `create-or-replace-groups` turns it into the planner's `repositioningData { posGroup, posRotationY, rootId, rootRelPos?, rootRelRotationY? }` before the load that creates the group (`toRepositioningData` in `group-placement.ts`).
- A new group placed by wall (`placement { wall, alignment?, offsetMm?, roomIndex? }`, D23) gets no `repositioningData` and no anchor probe: `create-or-replace-groups` loads it where the planner puts it, matches the new groups to the call once (`CallGroup.resultId` — the kernel may list a reloaded group elsewhere), computes each target from the calculated group with the logic of `place-group` (`wallTarget`: `placeGroupAtWall`, the overlap test, `freePlacementAlongWall`) and reloads the groups placed by wall in one call with `repositionedGroup` (`placeAtWalls` in `tool-executors.ts`). A group of the call counts in the overlap test once it has its target.
- The anchor (`findAnchorRoot`): from `rootId` or the first root down to the unit carrying it (`*Top → *Bottom` docking), then left along its row (`RightBottom`/`LeftBottom` docking, read in both directions); a corner article (`cornerArticle` in the catalog) on the row is the anchor, because its left arm turns away along the second wall.
- Every anchor is placed by its **anchor frame** (`anchorFrameOfRoot`): its docking corner — the back left bottom corner of its docking vectors — and its turn. The docking corner of a cabinet is its origin; it lies off the origin for a range hood (`DU`, centred: `[-299, 0, 0]`), a TV panel (`SM_TV`: `[-635, 0, -40]`) and the corner articles (Furniture_Smith `mr_CornerunitStraight`: `[-261, 0, 0]` for the left-handed `UERTB90`/`EUERTB90`, `[1161, 0, 0]` for the right-handed `UELTB90`/`EUELTB90` — the corner point). The turn brings a corner to the back left: the rotation from the left-handed frame (`RightBack` along +x, `LeftBack` along +z) to the article's, 270 for carcase direction Right, 0 for every other article. The docking corner is the minimum of the docking vector end points taken in the turned frame. `toRepositioningData` sends `posGroup` and `posRotationY` as the agent gave them and, for a frame that is not the identity, `rootRelPos = rotate(−point, −turn)` and `rootRelRotationY = −turn`; the planner composes `T(posGroup, posRotationY) · T(rootRelPos, rootRelRotationY) · R_root⁻¹`, so the docking corner lands on the point the agent gave and a corner article's back edges run along the walls the corner table names. The frame depends on the article **and its attributes** (`mod_CarcaseDirection` can be overridden, and all four corner articles share the module), and the catalog has no docking vector coordinates, so `probeAnchorFrame` loads a single-pick probe of the anchor as authored — article and attribute overrides — reads the frame from its docking vectors, takes the probe load back with `undo`, so it leaves no step on the planner's undo history, and removes with `removeExternalObject` what the undo left, or the whole probe on a page without `undo` (`takeBackProbe`; the load result carries runtime ids only, so the probe is found by comparing the raw groups before and after) and remembers the frame per library, article and attribute overrides for the server's lifetime (`anchorVariantKey`, `knownAnchorFrames`) — one extra load per anchor variant and server start (0.1–0.9 s measured), before the agent's group is loaded. Variants are probed one load each: the planner regenerates the probe's root ids, so the groups of a combined load could not be matched to their variants. A probed article without docking vectors gets the identity. When the probe calculates nothing, the group is loaded by the unit's origin and `corrections` says so. `get-plan-context` strips `cornerPoint` from the articles it returns (D10, D33 and D46 of [the behaviour reference](../../docs/hi-mcp-behaviour.md#3-decisions)).
- The groups the tools return report their `position` in the same frame (`inPlacementFrame` in `tool-executors.ts`, `positionInPlacementFrame` in `group-placement.ts`): after `get-plan-context`, `create-or-replace-groups`, `place-group` and the group commands, the server reads the raw groups once and replaces each group's `position` — `pos` the room point of the anchor's docking corner, `rotationY` the group's plus the anchor's rotation plus the turn, the footprint measured from there, and with two corner articles `rootId`, the anchor's id — the planner regenerates root ids, so the corner a placement named cannot be told after the load. The planner keeps the group origin where it likes (the anchor's origin after a create, the box minimum after a reload), so the agent reads back exactly the `posGroup` and `posRotationY` it placed with. The server's own geometry (`planGroups`, `place-group`) reads the planner's values.
- The tools that change the plan (`create-or-replace-groups`, `place-group`, the ten group commands, `undo` and `redo`) run one after another (`oneAtATime` in `tool-executors.ts`, through `planChange` for the recorded tools); `get-plan-context` waits with them, so its two reads - the plan context and the calculated groups of the positions - see one plan; the other read-only tools do not wait. The page runs every planner call it receives at once, and models do call several tools in parallel (`create-or-replace-groups` beside `place-group` or `change-group-attribute` in the test runs) — the probe finds its groups by comparing the raw groups before and after its load, so the groups a concurrent call loads or splits meanwhile would count as its own and be removed. A call that fails does not hold up the next one. A new plan-changing tool is wrapped the same way.
- A placement on a group that is already in the plan is not used, and `corrections` says so: the planner would re-apply it on the replace and move the group, so no `repositioningData` is sent and the group keeps its position. The same holds for a placement the server cannot use (not an object, `posGroup` not a point, no numeric `posRotationY`): the planner positions the group. Moving groups is not part of the placement; `place-group` moves them.
- `place-group` works on the calculated group (`getExternalObjectGroups`), not on the anchor walk: `plan-space.ts` (recovered from the page-side tool of `a4df7f5^`) derives the footprint from part boxes, docking vector points or the `b`/`t` attributes and the corner geometry from the `LeftBack*`/`RightBack*` vectors, puts the corner point into the shared corner by matching the two back edges to the walls (`placeCornerAtWalls`) or the footprint against the wall (`placeAgainstWall`), and yields the group transform. `repositioningFromPlacement` turns it into the room transform of the first article root from that root's transform in the group; the planner's `G = T · R_root⁻¹` reverses exactly that, so the result is exact for any root and needs no corner offset. The group keeps its y (wall units). Groups may touch; a target that overlaps another group — footprints (separating axis test) and height ranges overlap by more than 5 mm (`OVERLAP_TOLERANCE_MM`, `volumesOverlap`) — is moved along the same wall to the nearest free position (`freePlacementAlongWall`) before the one reload, and `corrections` names the group and the distance; into a corner, or without a free position on the wall, the group is placed as asked and the overlap reported. The reload sends the calculated roots without `articlePos`/`rotationY` and docking indices, with `reason: 'adjusted'`. The result reports `placedIn` (`corner` or `wall`) and never the internal fields.
- A corner article is recognised by the catalog's `cornerArticle` flag, its `category` ("… | Base Units | Corner") or its root module name (`mr_CornerunitStraight`) — `isCornerArticle`. roomle-ui derives the flag and the `cornerPoint` from docking data that only a calculated root of the article provides, so on an empty plan the flag is false and the point missing; without the fallback the anchor walk treated the corner article as a plain unit, walked along its turned left arm and anchored the arm's end, which turned the kitchen by 90° (plan snapshot `ps_qid6jsck322rq3g2stszoxzue4uwnxw`). `get-plan-context` completes the flag for the agent the same way. The corner point that is missing on an empty plan comes from the probe (above); roomle-ui calculating the article templates for the catalog would make the probe unnecessary ([backlog](../backlog/roomle-ui-article-template-geometry.md)).

### Bridge — page side (minimal-hi-example/index.html)

- Active only with the `mcp=true` query parameter
- Connects a `WebSocket` to `ws://localhost:<mcp_port, default 3100>/bridge`, or to the `/bridge` of `mcp_server` with `?session=<mcp_session>`; reconnects every 3 s on close, but not after the close 4409 of an occupied server
- Sends a per-page `clientId` in hello; the example chat sends the same ID to `/chat` and can submit only after the bridge acknowledges ownership with `ready`
- Executes the planner methods on its allow-list (`MCP_PLANNER_METHODS`, including `undo` and `redo`, D37) against `roomDesignerApi.extended`, rejects every other method, sends results back over the socket — no tool logic in the page
- Relays the planner's `extended.callbacks.onHistoryChange` as `{ kind: 'event', name: 'historyChange', undo, redo }` once accepted, calling a handler the host page set first; the server's `plan-history.ts` counts these events to tell its own planner steps from the user's changes

The ligna-store runs the same protocol via `hi-mcp/hi-mcp-client/` (browser-bridge with `PLANNER_METHODS`, types) — no automatic sync, copy after changes. The allow-lists change only when a tool needs a new planner method; `tests/planner-api.test.ts` fails when the server's planner methods and the client allow-list diverge.

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
3. Server runs the tool's executor (`tool-executors.ts`); the input is corrected here (reported in `corrections`), and what cannot be built is reported in `notLoaded` or, when nothing in the call can be done, as an error — see [§8 of the behaviour doc](../../docs/hi-mcp-behaviour.md#8-guards-corrections-and-feedback)
4. Each planner call of the executor goes over the page WebSocket as a method call
5. Page executes the method via `roomDesignerApi.extended` and sends the result back over the socket
6. The executor composes the results; the server returns the tool result to the MCP client

## Timeouts and Error Handling

- Timeouts apply per planner call; default: 30 seconds
- Snapshot calls (`loadExternalObjectGroupLayout` for `create-or-replace-groups` and `place-group`, `externalObjectGroupOperation` for the command tools, `getExternalObjectSnapshot` for `get-order-data` and `get-plan-images`): 120 seconds
- No page connected: error names the client URL (`HI_MCP_STORE_URL`)
- Unit tests: `npm test` at the `hi-mcp` root (vitest)

## Adding New Tools

1. Register the tool in `hi-mcp/hi-mcp-server/hi-mcp-server.ts` (zod schema, handler via `runTool`)
2. Implement the executor in `hi-mcp/hi-mcp-server/tool-executors.ts` — no page changes
3. An edit of existing groups is a command: add it in roomle-ui (`HI_GROUP_OPERATION`, a payload type and a handler in `hi-plan-context.ts`, an operation on the glue logic) and forward it here through `externalObjectGroupOperation` — no page change
4. Only if the tool needs a planner method not exposed yet: add it to `planner-api.ts` and to every page allow-list (`MCP_PLANNER_METHODS` in `minimal-hi-example/index.html`, `PLANNER_METHODS` in `hi-mcp/hi-mcp-client/browser-bridge.ts`, then copy to the ligna-store). Keep methods that place orders or overwrite the plan out unless explicitly decided
5. Update documentation (`docs/hi-mcp-behaviour.md`, `docs/hi-mcp-server.md`, `.agents/skills/hi-mcp-tools.md`)
6. Add/extend unit tests in `hi-mcp/hi-mcp-server/tests/`
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
| Port 3000 in use | `EXAMPLE_PORT=3101 npm start` (the launcher sets `HI_MCP_PAGE_ORIGINS` for the chosen origin; `npm run start:cf` needs port 3000) |
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
