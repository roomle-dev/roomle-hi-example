# HI MCP Server Skill

**Load this skill when the task involves:** MCP server architecture, HTTP handling, the WebSocket bridge, Model Context Protocol implementation, tool registration, or server-side logic in `minimal-hi-example` / `hi-mcp/hi-mcp-server`.

## Overview

The HI MCP Server lets AI agents orchestrate HOMAG Intelligence (HI) object groups in live Roomle room-planner sessions. There is **one MCP server implementation** in this repository: the TypeScript server in `hi-mcp/hi-mcp-server` (`@modelcontextprotocol/sdk` + `ws` + zod, run via `vite-node`). It carries no client-specific code and serves no page: every client wires itself to it through environment variables, and the example page is served and opened by the launcher `minimal-hi-example/start.mjs` ([ADR 0002](../decisions/0002-one-mcp-server-configured-from-outside.md)).

Clients of the same server: the standalone HI presets example (`minimal-hi-example/index.html`, started by the launcher) and the ligna-store, whose bridge starts on any stage with a valid `mcp_server` query parameter. `model` and `api_key` add its optional chat window; missing or invalid chat settings leave the bridge enabled. The store resolves one client/session identity for bridge and chat, using `mcp_session` or a fresh per-page ID (its page-side bridge is a copy of `hi-mcp/hi-mcp-client/`).

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
- **Server spawn**: Node invokes the installed `vite-node` CLI with `server.ts` directly in the `hi-mcp-server` workspace, with `HI_MCP_STORE_URL` pointing the "no page connected" error at the example URL and, unless set, `HI_MCP_PAGE_ORIGINS` naming the page's origin (`localhost` and `127.0.0.1` on the page port, plus `https://www.roomle.com`) — another `EXAMPLE_PORT` needs no extra configuration. `HI_MCP_PORT` moves the server and is passed to the page as `mcp_port`.
- **Browser auto-open**, skipped with `--no-open`.
- Exits when a server child exits; SIGINT/SIGTERM stop the direct MCP and optional chat children and exit, releasing their ports with the page port. The POSIX process regression in `hi-mcp-server/tests/example-launcher.test.ts` signals only the launcher PID and verifies all three ports can be bound again.

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
- The server correlates calls by id, with per-method timeouts (`planner-api.ts`: 120 s for `externalObjectGroupOperation` and `getExternalObjectSnapshot`, 30 s otherwise) and a single-page policy: an OPEN owner rejects a new page (close 4409, "Planner session in use"; the page stops reconnecting); a CLOSING owner gives way after its pending calls are rejected — guarded by `it('rejects a second page without disrupting the active planner call')` and `it('accepts a replacement when the previous socket is closing')` in `hi-mcp/hi-mcp-server/tests/page-bridge.test.ts`

#### 4. Tool logic (`tool-executors.ts`, `agent-facing.ts`, `planner-api.ts`; roomle-ui `hi-tool-commands.ts`)
- The tool handlers in `hi-mcp-server.ts` run the executors in `tool-executors.ts`. The server keeps the tool registry and the served text, `get-plan-context` in the agent's words (`agent-facing.ts`: wall names, room corners, the wall of a door or a window, `cornerArticle` completed from the category on an empty plan, `cornerPoint` left out, short descriptions), `find-attributes`, the compaction of the two attribute tools' results (`compactAttributeResult`), one plan change at a time (`oneAtATime`) and the undo record (`recorded`, `countingPlannerApi`, `revertToolCall`)
- Every plan-changing tool (`create-or-replace-groups`, `place-group`, `change-module-attribute`, `change-group-attribute`, `delete-group`, `delete-article-in-place`, `delete-article-and-compact`, `merge-article-into-group`, `exchange-root-module`, `insert-article-into-group`, `swap-root-modules`, `merge-groups`) is one planner call, `externalObjectGroupOperation(<tool name>, <the tool's arguments>)` (`inPlanner`). roomle-ui performs the whole tool (D71): `HiToolsImplementation.executeGroupOperation` (`hi-tools.ts`) runs a command named like a tool through `runToolCommand` and `HI_TOOL_COMMANDS` (`hi-tool-commands.ts`), every other command as a group operation (`runGroupOperation` in `hi-plan-context.ts`). A tool command validates and corrects the input, resolves ids and articles (`hi-tool-ids.ts`), normalises the payload (`hi-tool-payload.ts`), translates the relations into docking (`hi-group-layout.ts`, D72) and completes it (`hi-tool-docking.ts`), places a new group by point or by wall (`hi-group-placement.ts`, `hi-wall-placement.ts`, `hi-plan-space.ts`), sets the group materials and names the library's changes (`hi-tool-attributes.ts`), adds the hints (`hi-tool-hints.ts`), reports what it could not build in `notLoaded`, and reports every group in the placement frame with `rowIndex` (`inPlacementFrame`). The result carries `historySteps` and `historyFollowUps`, which the server counts for undo and removes
- A tool command reaches the planner through `HiToolPlanner`, which `HiToolsImplementation` implements in the planner itself: the plan context, the calculated groups, the layout load, the group operations and `calculateArticleTemplate`. The command tools resolve group id prefixes and check article ids against the catalog (an id in another spelling is read in the catalog's spelling; `merge-article-into-group` also moves a taken side to the free end of the row and derives a missing partner vector — all reported in `corrections`) and run the group operation, which answers with the affected groups in the plan-context shape once the planner has loaded them. Deletions and merges are performed by the kernel: the group operation waits for the kernel's report of the group (`removedGroup`, `deleteRootModule`, `mergeGroups`), and a root module deletion the kernel does not report within the request is rejected as refused
- The executors call the planner through `PlannerApi` (`planner-api.ts`): the six planner methods the tools need (`getExternalObjectPlanContext`, `externalObjectGroupOperation`, `fetchPrice`, `getExternalObjectSnapshot`, `undo`, `redo`), each forwarded over the bridge with positional arguments. All parameters are required — the call travels as JSON, which turns `undefined` into `null`

#### 5. Group placement (internal)

Internal to the tool commands: not part of the tool interface and never mentioned to the agent — the served rules, the tool descriptions, the tool reference and the authoring skills only know `placement`. `tests/hi-mcp-server.test.ts` guards the served text. All files below are in roomle-ui `packages/web-sdk/packages/homag-intelligence/src/`.

- A new group carries `placement { posGroup, posRotationY, rootId? }`. `create-or-replace-groups` turns it into the planner's `repositioningData { posGroup, posRotationY, rootId, rootRelPos?, rootRelRotationY? }` before the load that creates the group (`toRepositioningData` in `hi-group-placement.ts`).
- A new group placed by wall (`placement { wall, alignment?, offsetMm?, roomIndex? }`, D23) gets no `repositioningData` and no anchor frame: `create-or-replace-groups` loads it where the planner puts it, matches the new groups to the call once (`CallGroup.resultId` — the kernel may list a reloaded group elsewhere), computes each target from the calculated group with the logic of `place-group` (`wallTarget`: `placeGroupAtWall`, the overlap test, `freePlacementAlongWall`, `hi-wall-placement.ts`) and reloads the groups placed by wall in one load with `repositionedGroup` (`placeAtWalls` in `hi-tool-commands.ts`). A group of the call counts in the overlap test once it has its target. The pairing is by order, so when the planner built more or fewer new groups than the call sent, no group is moved (G60); after the reload, a group that still covers the floor it covered before did not move (G59, `floorCorners`, `sameFloor`) — the load answers with runtime ids only, and the planner keeps the group origin at another root or corner after a reload (10 mm off for a row with a worktop overhang, 261 mm for a corner group), so the origin tells nothing.
- The anchor (`findAnchorRoot`): from `rootId` or the first root down to the unit carrying it (`*Top → *Bottom` docking), then left along its row (`RightBottom`/`LeftBottom` docking, read in both directions); a corner article (`cornerArticle` in the catalog) on the row is the anchor, because its left arm turns away along the second wall.
- Every anchor is placed by its **anchor frame** (`anchorFrameOfRoot`): its docking corner — the back left bottom corner of its docking vectors — and its turn. The docking corner of a cabinet is its origin; it lies off the origin for a range hood (`DU`, centred: `[-299, 0, 0]`), a TV panel (`SM_TV`: `[-635, 0, -40]`) and the corner articles (Furniture_Smith `mr_CornerunitStraight`: `[-261, 0, 0]` for the left-handed `UERTB90`/`EUERTB90`, `[1161, 0, 0]` for the right-handed `UELTB90`/`EUELTB90` — the corner point). The turn brings a corner to the back left: the rotation from the left-handed frame (`RightBack` along +x, `LeftBack` along +z) to the article's, 270 for carcase direction Right, 0 for every other article. The docking corner is the minimum of the docking vector end points taken in the turned frame. `toRepositioningData` sends `posGroup` and `posRotationY` as the agent gave them and, for a frame that is not the identity, `rootRelPos = rotate(−point, −turn)` and `rootRelRotationY = −turn`; the planner composes `T(posGroup, posRotationY) · T(rootRelPos, rootRelRotationY) · R_root⁻¹`, so the docking corner lands on the point the agent gave and a corner article's back edges run along the walls the corner table names. The frame depends on the article **and its attributes** (`mod_CarcaseDirection` can be overridden, and all four corner articles share the module), so the tool command reads it from the anchor's article template: `calculateArticleTemplate(articleId, attributes)` of the glue logic (`glue-logic.ts`) calculates the article with the anchor's attribute overrides as a single-pick group outside the plan — nothing is loaded, the planner's undo history gets no step — and keeps the template per library, article and sorted attribute overrides until the library's article templates are loaded again (`loadPosData`); a failed calculation is not kept. A template without docking vectors gives the identity. When the template cannot be calculated, the group is loaded by the unit's origin and `corrections` says so (G17). `get-plan-context` strips `cornerPoint` from the articles it returns (D10, D33 and D46 of [the behaviour reference](../../docs/hi-mcp-behaviour.md#3-decisions)).
- The groups the tools return report their `position` in the same frame (`inPlacementFrame` in `hi-tool-commands.ts`, `positionInPlacementFrame` in `hi-group-placement.ts`): the plan context of the planner (`HiToolsImplementation.getPlanContext`) and every tool command and group operation result replace each group's `position` — `pos` the room point of the anchor's docking corner, `rotationY` the group's plus the anchor's rotation plus the turn, the footprint measured from there, and with two corner articles `rootId`, the anchor's id — the planner regenerates root ids, so the corner a placement named cannot be told after the load — and give every root of a row its `rowIndex` (`withRowIndices`). The planner keeps the group origin where it likes (the anchor's origin after a create, the box minimum after a reload), so the agent reads back exactly the `posGroup` and `posRotationY` it placed with. The tool commands' own geometry (`place-group`, the wall placement) reads the planner's values.
- The tools that change the plan (`create-or-replace-groups`, `place-group`, the ten group commands, `undo` and `redo`) run one after another (`oneAtATime` in `tool-executors.ts`, through `planChange` for the recorded tools); `get-plan-context` waits with them, so it never reads a plan halfway through a change; the other read-only tools do not wait. The page runs every planner call it receives at once, and models do call several tools in parallel (`create-or-replace-groups` beside `place-group` or `change-group-attribute` in the test runs) — the undo record of a call compares the plan before and after it, so a concurrent call would mix into it. A call that fails does not hold up the next one. A new plan-changing tool is wrapped the same way (`inPlanner`).
- A placement on a group that is already in the plan is not used, and `corrections` says so: the planner would re-apply it on the replace and move the group, so no `repositioningData` is sent and the group keeps its position. The same holds for a placement the tool command cannot use (not an object, `posGroup` not a point, no numeric `posRotationY`): the planner positions the group. Moving groups is not part of the placement; `place-group` moves them.
- `place-group` works on the calculated group, not on the anchor walk: `hi-plan-space.ts` derives the footprint from part boxes, docking vector points or the `b`/`t` attributes and the corner geometry from the `LeftBack*`/`RightBack*` vectors, puts the corner point into the shared corner by matching the two back edges to the walls (`placeCornerAtWalls`) or the footprint against the wall (`placeAgainstWall`), and yields the group transform. `repositioningFromPlacement` turns it into the room transform of the first article root from that root's transform in the group; the planner's `G = T · R_root⁻¹` reverses exactly that, so the result is exact for any root and needs no corner offset. The group keeps its y (wall units). Groups may touch; a target that overlaps another group — footprints (separating axis test) and height ranges overlap by more than 5 mm (`OVERLAP_TOLERANCE_MM`, `volumesOverlap`) — is moved along the same wall to the nearest free position (`freePlacementAlongWall`) before the one reload, and `corrections` names the group and the distance; into a corner, or without a free position on the wall, the group is placed as asked and the overlap reported. The reload sends the calculated roots without `articlePos`/`rotationY` and docking indices, with `reason: 'adjusted'`. The result reports `placedIn` (`corner` or `wall`) and never the internal fields.
- A corner article is recognised by the catalog's `cornerArticle` flag, its `category` ("… | Base Units | Corner") or its root module name (`mr_CornerunitStraight`) — `isCornerArticle`. roomle-ui derives the flag and the `cornerPoint` from docking data that only a calculated root of the article provides — a root in the plan, or the template of an article a caller names in `getExternalObjectPlanContext(include, { articleIds })` —, and neither the tool commands nor `get-plan-context` name article ids, so on an empty plan the catalog carries no flag and no point. The anchor walk (`isCornerArticle`, `hi-group-placement.ts`) and `get-plan-context` (`agent-facing.ts`) therefore also read the category and the module name; without them the anchor walk would treat the corner article as a plain unit, walk along its turned left arm and anchor the arm's end, which turns the kitchen by 90° (plan snapshot `ps_qid6jsck322rq3g2stszoxzue4uwnxw`).

### Bridge — page side (minimal-hi-example/index.html)

- Active only with the `mcp=true` query parameter
- Connects a `WebSocket` to `ws://localhost:<mcp_port, default 3100>/bridge`, or to the `/bridge` of `mcp_server` with `?session=<mcp_session>`; reconnects every 3 s on close, but not after the close 4409 of an occupied server
- Sends a per-page `clientId` in hello; the example chat sends the same ID to `/chat` and can submit only after the bridge acknowledges ownership with `ready`
- Executes the planner methods on its allow-list (`MCP_PLANNER_METHODS`, including `undo` and `redo`, D37) against `roomDesignerApi.extended`, rejects every other method, sends results back over the socket — the bridge holds no tool logic; the tool commands are part of roomle-ui
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
3. Server runs the tool's executor (`tool-executors.ts`); a plan-changing tool sends one planner call, `externalObjectGroupOperation(<tool name>, <the tool's arguments>)`
4. Each planner call of the executor goes over the page WebSocket as a method call
5. Page executes the method via `roomDesignerApi.extended` and sends the result back over the socket; for a plan-changing tool roomle-ui runs the tool command, which corrects the input (reported in `corrections`) and reports what cannot be built in `notLoaded` or, when nothing in the call can be done, as an error — see [§8 of the behaviour doc](../../docs/hi-mcp-behaviour.md#8-guards-corrections-and-feedback)
6. The executor counts the reported planner steps for undo and shapes the result; the server returns the tool result to the MCP client

## Timeouts and Error Handling

- Timeouts apply per planner call; default: 30 seconds
- Snapshot calls (`externalObjectGroupOperation` for every plan-changing tool, `getExternalObjectSnapshot` for `get-order-data` and `get-plan-images`): 120 seconds
- No page connected: error names the client URL (`HI_MCP_STORE_URL`)
- Unit tests: `npm test` at the `hi-mcp` root (vitest)

## Adding New Tools

1. Register the tool in `hi-mcp/hi-mcp-server/hi-mcp-server.ts` (zod schema, handler via `runTool`)
2. Implement the executor in `hi-mcp/hi-mcp-server/tool-executors.ts` — no page changes
3. A plan-changing tool is a tool command in roomle-ui (`HI_TOOL_COMMAND` in `hi-plan-context.ts`, the command in `HI_TOOL_COMMANDS` of `hi-tool-commands.ts`, its unit tests in `homag-intelligence/__tests__/hi-tool-commands/`) and a forwarder here, `inPlanner('<tool name>')` — no page change. An edit the planner does not offer yet is a group operation the tool command runs (`HI_GROUP_OPERATION`, a payload type and a handler in `hi-plan-context.ts`, an operation in `hi-tools.ts`)
4. Only if the tool needs a planner method not exposed yet: add it to `planner-api.ts` and to every page allow-list (`MCP_PLANNER_METHODS` in `minimal-hi-example/index.html`, `PLANNER_METHODS` in `hi-mcp/hi-mcp-client/browser-bridge.ts`, then copy to the ligna-store). Keep methods that place orders or overwrite the plan out unless explicitly decided
5. Update documentation (`docs/hi-mcp-behaviour.md`, `docs/hi-mcp-server.md`, `.agents/skills/hi-mcp-tools.md`)
6. Add/extend unit tests in `hi-mcp/hi-mcp-server/tests/`
7. `npm test` + `npm run typecheck` at the `hi-mcp` root

## Modifying Existing Tools

1. Understand current behavior; the tool logic of a plan-changing tool lives in roomle-ui (`hi-tool-commands.ts`), the rest in the server (`tool-executors.ts`, `agent-facing.ts`)
2. Maintain backward compatibility; update the zod schema if needed
3. Deploy the server, or release roomle-ui for a tool command — the pages need no change unless the planner methods change
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
npm start -- --no-open             # same, without opening a browser
EXAMPLE_PORT=3101 npm start         # other page port
npm run start:cf                    # page + the Cloudflare-hosted MCP server, no local server
cd hi-mcp && npm test               # unit tests
cd hi-mcp && npm run typecheck      # typecheck used by the build gate
```
