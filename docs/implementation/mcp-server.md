# MCP Server

The process, the MCP endpoint, the tool registration, the page bridge, the planner methods, and the
undo record. All files are in `hi-mcp/hi-mcp-server/`. The tool logic itself is described in
[Tool executors](./tool-executors.md). [Back to the overview](./README.md).

## The process — `server.ts`

`npm start` in `hi-mcp/` runs `vite-node server.ts`. At module load the server creates the two
singletons every request shares: `const bridge = new PageBridge()` and
`connectPlanHistory(bridge, planHistory)`, which feeds the page's history events into the undo
record.

### Configuration

| Variable | Effect | Default |
| -------- | ------ | ------- |
| `HI_MCP_PORT`, then `PORT` | Listening port | 3100 (`HI_MCP_PORT` in `types.ts`) |
| `HOST` | Bind address | all interfaces |
| `HI_MCP_PAGE_ORIGINS` | Comma-separated origins allowed for `/bridge` and for CORS on `/mcp` | `http://localhost:3000`, `http://127.0.0.1:3000`, `https://www.roomle.com` |
| `HI_MCP_TLS_CERT` + `HI_MCP_TLS_KEY` | Serve HTTPS and WSS instead of HTTP and WS | off |
| `HI_MCP_STORE_URL` | The page URL named in the "No HI page connected" error | `http://localhost:3000/?store.stage=INT` |

A stray `PORT` in the environment moves the server — the launcher and the pages assume 3100 unless
`HI_MCP_PORT` is set.

### HTTP

`requestHandler` serves one route:

- **Only `/mcp`.** Any URL that does not start with `/mcp` gets 404 `Not found - the MCP endpoint is
  /mcp`. There is no health route on the MCP server (the chat backend has one).
- **CORS.** An `Origin` in `HI_MCP_PAGE_ORIGINS` gets `Access-Control-Allow-Origin` with that origin,
  `Vary: Origin` and the MCP headers (`MCP_CORS_HEADERS`); a preflight from it gets 204, from any
  other origin 403. A non-preflight request from another origin is not refused — it only gets no
  CORS headers, so a browser cannot read the answer. Requests without `Origin` (server-side MCP
  clients) pass.
- **Client binding.** With `?client=<id>`, the request is refused with 409 `This chat is not connected
  to its planner page` unless `bridge.isClientActive(id)` — the id of the page that owns the planner.
  Requests without `client` (Claude Code, Claude desktop, the test scripts) drive whichever page is
  connected.
- **Stateless transport.** Every request gets a new `McpServer` (`createHiMcpServer(createPlannerApi(bridge, clientId))`)
  and a new `StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })`:
  no `Mcp-Session-Id`, JSON instead of SSE. Both are closed when the response closes. An exception
  before the headers are sent gives 500 `Internal server error`. The MCP SDK itself answers 406 for
  a wrong `Accept` header and 405 for other methods.

The `session` query parameter is not read by the server: on Cloudflare the Worker routes it to a
container of its own ([Deployment](./deployment-and-testing.md#cloudflare)).

### WebSocket

A `WebSocketServer({ noServer: true })` takes the HTTP upgrade only for the pathname `/bridge`
(query parameters allowed) and, when the request has an `Origin`, only for an allowed origin; any
other upgrade is destroyed and logged. An accepted socket goes to `bridge.attachPage(socket)`.

### Lifecycle

- **Orphan guard:** when stdin is a pipe or a socket (not a TTY), the process exits when stdin ends,
  so a server spawned by a tool does not outlive it.
- **Port in use:** `EADDRINUSE` prints the `lsof -ti tcp:<port> | xargs kill` hint and exits with 1.

## The MCP server — `hi-mcp-server.ts`

`createHiMcpServer(roomDesignerApi)` builds
`new McpServer({ name: 'hi-group-orchestrator', version: '0.1.0' }, { instructions: INSTRUCTIONS })`
and registers the tools.

### Served text

| Constant | Served as | Content |
| -------- | --------- | ------- |
| `AUTHORING_RULES` | `get-authoring-rules` and the end of `INSTRUCTIONS` | the rule bullets and examples 1–6 |
| `INSTRUCTIONS` | the `instructions` of `initialize` | the four-step workflow, then `AUTHORING_RULES` |
| the tool descriptions | `tools/list` | one per registration |

The rules go out twice: in `initialize` for clients that pass server instructions to the model, and
from `get-authoring-rules` for those that do not — the chat backend does not
([hi-mcp-behaviour.md §5](../hi-mcp-behaviour.md#5-information-the-server-provides)). The text is a
template string in this file; there is no separate rules file.

### Tools

| Tool | Input (zod, short) | Executor wrapper | Planner methods |
| ---- | ------------------ | ---------------- | --------------- |
| `get-plan-context` | `include?: string[]` | `oneAtATime(inPlacementFrame(…))` | `getExternalObjectPlanContext`, `getExternalObjectGroups` |
| `find-attributes` | `text`, `libraryId?` | none | `getExternalObjectPlanContext(['masterData'])` |
| `get-authoring-rules` | — | none: returns `AUTHORING_RULES` | — |
| `create-or-replace-groups` | `posGroups: object[]` (≥ 1) | `planChange` | `loadExternalObjectGroupLayout`; the anchor probe also `undo`, `removeExternalObject` |
| `place-group` | `groupId`, `wall` (side label or index), `roomIndex?`, `alignment?`, `offsetMm?` | `planChange` | `getExternalObjectGroups`, `loadExternalObjectGroupLayout` |
| `change-module-attribute` | `rootModuleId`, `moduleId?`, `attributeId`, `value` | `planChange` | `externalObjectGroupOperation` |
| `change-group-attribute` | `groupId`, `attributeId`, `value` | `planChange` | same |
| `delete-group` | `groupId` | `planChange` | same |
| `delete-root-module` | `rootModuleId` | `planChange` | same |
| `remove-article-from-group` | `groupId`, `rootModuleId` | `planChange` | same |
| `merge-article-into-group` | `groupId`, `articleId`, `attributes?`, `dockTo` | `planChange` | same |
| `insert-article-into-group` | `groupId`, `articleId`, `attributes?`, `between: [id, id]` | `planChange` | same |
| `exchange-root-module` | `groupId`, `rootModuleId`, `articleId`, `attributes?` | `planChange` | same |
| `swap-root-modules` | `groupId`, `rootModuleIds: [id, id]` | `planChange` | same |
| `merge-groups` | `targetGroupId`, `groupIds` (≥ 1) | `planChange` | same |
| `undo`, `redo` | — | `oneAtATime(inPlacementFrame(revertToolCall(…)))` | `undo` / `redo`, `getExternalObjectGroups` |
| `get-price` | — | none | `fetchPrice` |
| `get-order-data` | — | none | `getExternalObjectSnapshot({ orderData: true })` |
| `get-plan-images` | — | none | `getExternalObjectSnapshot({ perspectiveImage, topImage })` |

`planChange = oneAtATime(recorded(tool, executor))`: serialized and recorded for undo
([Undo and redo](#undo-and-redo)). `find-attributes`, `get-price`, `get-order-data` and
`get-plan-images` run beside a plan change.

### Running a tool — `runTool`

Every handler except `get-authoring-rules` goes through `runTool`:

1. Logs `[hi-mcp] tool <name>`.
2. Clones the arguments (`structuredClone`) — executors correct their input in place, and the log
   shows what the agent sent.
3. For the tools in `PLAN_CHANGING_TOOLS` logs `args <json>`; after the call logs
   `feedback {corrections, notLoaded}` for those tools and for any result that carries them.
4. On an exception logs `error {message, args}` and rethrows.

The `args | feedback | error` lines are parsed by the end-to-end scripts
([Deployment and testing](./deployment-and-testing.md#end-to-end-runs)).

### Results and errors

- `textResult` returns one text content: `JSON.stringify(result, withoutImageUrls)` — compact JSON,
  with every `imageUrl` key removed at any depth (signed CDN URLs, three quarters of the plan
  context's tokens; D7).
- `get-plan-images` returns two image contents, perspective first, then top view, as `image/png`
  with the data URL prefix stripped (`stripDataUrlPrefix`); without images it returns the text
  result `{ error: 'No images available' }`.
- A thrown error becomes, through the SDK, a tool result `{ isError: true, content: [{ text: message }] }`
  — a tool error the model reads, not a JSON-RPC error. A zod failure arrives the same way as
  `Input validation error: …`. Unknown top-level keys are dropped by zod before the executor sees
  them.

## The page bridge — `page-bridge.ts`

`PageBridge` holds one page per process: the socket, its URL, protocol and `clientId`, the next call
id, the pending calls, and the listeners for history events and page acceptance.

### Accepting a page

On `hello`:

- If another socket is the page and still `OPEN`, the newcomer is closed with **4409** `Planner
  session in use`. The page shows "occupied" and does not reconnect.
- If the old socket is no longer open, its pending calls are rejected (`The demo page disconnected`)
  and the newcomer takes over.
- The accepted page's `url`, `protocol` and `clientId` are stored, `{ kind: 'ready' }` is sent, and the
  page-accepted listeners run — `planHistory.reset()` among them.

The protocol is not checked at `hello` — a page with an old protocol is accepted, and every call to
it fails with "outdated HI MCP page bridge". Frames that are not JSON objects are ignored; `result`
and `event` frames are taken only from the active page.

### Calling the page

`call(method, args, timeoutMs = DEFAULT_CALL_TIMEOUT_MS, clientId?)` checks, in this order: the
`clientId` is active; a page is connected and open (else "No HI page connected", naming
`HI_MCP_STORE_URL`); the page's protocol is `BRIDGE_PROTOCOL`. Then it takes the next id, logs
`call <id>: <method> <args, first 400 chars>`, sends `{ kind: 'call', id, method, args }` and starts the
timer.

- `ok: true` resolves with `result`; `ok: false` rejects with `error`.
- A timeout rejects with `Planner call '<method>' timed out after <ms>ms` and forgets the id; the
  page is not told and may still run the call. A late result for a forgotten id is ignored.
- When the page disconnects, every pending call is rejected with `The demo page disconnected`, and
  the page and its `clientId` are cleared.

`isClientActive(id)` is true when the page is open and its `clientId` is `id`.

## The bridge protocol — `types.ts`

`BRIDGE_PROTOCOL = 2`: the page executes planner methods, the tool logic runs in the server.

| Message | Direction | Fields |
| ------- | --------- | ------ |
| `hello` | page → server | `example`, `url`, `protocol?`, `clientId?` |
| `ready` | server → page | — |
| `call` | server → page | `id: number`, `method`, `args: unknown[]` |
| `result` | page → server | `id`, `ok`, `result?`, `error?` |
| `event` | page → server | `name: 'historyChange'`, `undo: boolean`, `redo: boolean` — one per committed planner step |

Close code **4409**: another page owns the planner. The page side carries its own copy of this file
([Pages, chat and launcher](./pages-chat-and-launcher.md#the-page-side-of-the-bridge)).

## The planner methods — `planner-api.ts`

`createPlannerApi(bridge, clientId?)` returns `{ extended: { … } }`, one function per method, each a
`bridge.call`. With a `clientId`, every call checks again that the client is active, so a chat
request cannot reach another page after a reconnect.

| Method | Timeout |
| ------ | ------- |
| `getExternalObjectPlanContext(include)` | 30 s |
| `loadExternalObjectGroupLayout(layout, layoutType, options)` | 120 s |
| `externalObjectGroupOperation(command, payload)` | 120 s |
| `getExternalObjectSnapshot(options)` | 120 s |
| `getExternalObjectGroups()` | 30 s |
| `fetchPrice()` | 30 s |
| `removeExternalObject(id)` | 30 s |
| `undo()`, `redo()` | 30 s |

The arguments travel as JSON, which turns `undefined` into `null` — pass every parameter explicitly
(`moduleId: args.moduleId ?? null`). Which tool uses which method, and why:
[hi-mcp-behaviour.md §4](../hi-mcp-behaviour.md#4-how-a-tool-call-runs).

## Undo and redo

`undo` reverts the plan change of the last tool call that changed the plan — however many planner
steps it took — and `redo` brings it back. The server cannot ask the planner which steps a tool
made, so it counts them.

### The record — `plan-history.ts`

`planHistory` keeps two stacks of `ToolCallRecord { tool, steps, groupsBefore, groupsAfter, settled }`
(`_done`, `_undone`), a count of history events, the late follow-ups it still expects, and whether
a tool call is in flight.

- **Telling tool steps from user changes** (`historyChanged`): every `historyChange` event of the
  active page is counted. While a tool call runs, the event is the call's own. Outside a call it is
  either a late follow-up the server expects, or a change the user made in the planner — then the
  record is forgotten and the next undo answers "changed in the planner".
- `record()` pushes a call and clears the redo stack; `reset()` (on page acceptance) clears all.

### Recording a call — `recorded` in `tool-executors.ts`

`recorded(tool, executor)` gives the executor a counting planner API (`countingPlannerApi`):

| Planner call | Steps |
| ------------ | ----- |
| `loadExternalObjectGroupLayout` that loaded something | +1 |
| `externalObjectGroupOperation`, `removeExternalObject` | +1 |
| `undo` (the anchor probe takes back its load) | −1 |

Every step ends redo (`planHistory.endRedo()`), as the planner drops its redo future. Before the
first step the counting API reads the raw groups (`groupsBefore`); after the call it reads them
again (`groupsAfter`). Plans are compared by `groupsKey`: the raw groups sorted by id, numbers
rounded to 0.1 mm.

Some roomle-ui commands commit a second step — the follow-up reload when the kernel reports the
group's new position. For `FOLLOW_UP_COMMANDS` (`change-module-attribute`, `change-group-attribute`,
`exchange-root-module`, `insert-article-into-group`, `swap-root-modules`) and for a
`remove-article-from-group` that closed the gap, the call waits up to `FOLLOW_UP_WAIT_MS` (2 s) for
that event — only when the page relays history events at all. A follow-up that has not arrived by
the end of the call is registered as expected (`expectLateFollowUp`) and the record is `settled:
false`.

### Reverting — `revertToolCall(direction)`

1. No record: `undone: null` / `redone: null` with a hint (nothing to undo, or changed in the planner).
2. Undo of an unsettled call: wait up to 2 s for its late follow-ups, else answer "still finishing".
3. The current plan must equal the call's end state (undo) or start state (redo); otherwise the
   record is forgotten — the user changed the plan.
4. `stepHistory` calls the planner's `undo()` / `redo()` once per recorded step, each confirmed by a
   history event within `HISTORY_EVENT_WAIT_MS` (1 s).
5. The plan must now equal the other state. If it does not, the steps are taken back the other way
   and the result says so.

The behaviour and every message: [hi-mcp-behaviour.md §6 undo, redo](../hi-mcp-behaviour.md#undo-redo)
and [§8.8](../hi-mcp-behaviour.md#88-undo-and-redo).

## Before you change these files

- **Every planner call of an executor goes through the API it is given.** A call on another planner
  API is not counted, and the undo record breaks.
- **A plan-changing tool must be wrapped in `planChange`.** Otherwise its history events arrive
  outside a call, count as user changes, and clear the undo record.
- **Undo relies on history events.** A page that does not relay `historyChange` gets no follow-up
  wait, and `stepHistory` times out after the first undo. Both shipped pages relay them.
- **Caches outlive a page change.** `planHistory` resets on `hello`; the anchor frames, the master
  data and the agent group ids in `tool-executors.ts` do not.
- **A rule or a message changed here** changes the server's behaviour — update
  [hi-mcp-behaviour.md](../hi-mcp-behaviour.md) in the same commit.
