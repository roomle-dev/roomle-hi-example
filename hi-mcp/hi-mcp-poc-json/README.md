# HI Group Orchestrator MCP Server (PoC) — hi-mcp-poc-json

A proof-of-concept [MCP](https://modelcontextprotocol.io/) server that lets an AI agent orchestrate
HOMAG Intelligence (HI) object groups in a live planning session of the **ligna-store**. The agent
retrieves the plan context (master data, rooms, articles, existing groups) and creates or modifies
HI object groups from a single JSON pos-group payload — without computing root-module positions
itself ("poc-json": the whole kitchen comes from one `posGroups` JSON).

The server is **agent-agnostic**: it contains no client-specific code. Any MCP client with
Streamable HTTP transport support can connect (Claude Code, the Claude desktop app, Cursor,
VS Code Copilot agent mode, Gemini CLI, custom clients built with an MCP SDK).

Copied from the roomle-ui repository's
`packages/embedding-lib/examples/hi-mcp-server`
([RML-17693](https://roomle.atlassian.net/browse/RML-17693)) and adapted to the ligna-store client —
the roomle-ui original will be deleted; this copy and the store-side bridge in
`ligna-store/hi-mcp/` are the future home of the code.

For the shortest path to a first successful tool call, see [QUICKSTART.md](./QUICKSTART.md).

## Architecture

```text
AI agent (any MCP client) --Streamable HTTP--> http://localhost:3100/mcp
                                               Standalone Node process (this folder)
                                               |  ws://localhost:3100  (page connects out)
                                               v
                                   ligna-store (nuxt dev server, localhost:3000)
                                   executes tools against roomDesignerApi.extended
```

The store page cannot listen on a port, so it connects **outward** to the MCP server via WebSocket.
The server relays each tool call into the page, where it runs against `roomDesignerApi.extended`
(the `extended.*` proxy derives its methods automatically from `RoomlePlanner.prototype`, so the
web-sdk APIs (`getExternalObjectPlanContext`, `loadExternalObjectGroupLayout`, …) are reachable
as-is). The page-side bridge lives in the store repository (`ligna-store/hi-mcp/`); this folder
contains the server side.

| Port | Process |
| ---- | ------- |
| 3000 | ligna-store dev server (`npm run dev`) — the client page |
| 3100 | this MCP server (`npm start`) — MCP endpoint `/mcp` + WebSocket bridge |

| File | Responsibility |
| ---- | -------------- |
| `server.ts` | Entry point: HTTP server on :3100 hosting `/mcp` and the WebSocket upgrade |
| `package.json` | Self-contained dependencies of the server (MCP SDK, ws, zod, vite-node) |
| `hi-mcp-server.ts` | `McpServer` setup: server instructions + tool registrations with zod schemas |
| `page-bridge.ts` | Connected-page registry, call correlation, timeouts, "no page connected" error |
| `browser-bridge.ts` | Browser side (reference copy — the store runs its own): WebSocket client, executes tool calls, replies with results |
| `tool-executors.ts` | Tool name → `roomDesignerApi.extended` call + context shaping for the agent (also copied to the store) |
| `plan-space.ts` | Pure geometry: wall derivation (side labels, facing rotation), group footprints, wall placement |
| `types.ts` | Shared WebSocket message protocol |
| `tests/` | Unit tests (vitest, configured at the `hi-mcp/` workspace root) |

## Prerequisites

- Node 20 (the roomle-ui original pins Node 24 and runs `vite-node` 6; this copy pins
  `vite-node` 3.2.4 + `vite` 6.4.3 so it runs on the local Node 20)
- `npm install` in the `hi-mcp/` folder (installs this workspace and all PoCs)
- The ligna-store repository checked out next to this one (the client page)

## Running

Two processes — the MCP server and the store:

```bash
# 1. roomle-hi-example
cd hi-mcp
npm start                                   # MCP server on :3100
```

```bash
# 2. ligna-store
npm run dev                                 # store dev server on :3000
```

The MCP server prints `➜  Local: http://localhost:3100/mcp` when it is ready. It reports an
occupied port with the command to free it instead of a bare stack trace, and — when started
through a wrapper script whose stdin it inherits — it shuts itself down when that script ends, so
no orphaned instance keeps the port.

Then open the store page **with the INT stage and a plan id** (keep the tab open):

```text
http://localhost:3000/?store.stage=INT&id=ps_bse5tc50687uh64hm8jul7j1kiuacyx
```

The INT stage selects the `bo-test` UI server and the `HI_PRE_Roomle_Milestone_2` HI backend; the
store resolves the HI credentials server-side via the backend id, so no credentials are needed
here. The store-side bridge starts automatically when the stage is INT — no extra query parameter.
The page connects to the MCP server; the server terminal logs `page connected`.

### Notes on the client page

| Parameter | Effect |
| --------- | ------ |
| `store.stage=INT` | Required for this PoC: selects the `bo-test` UI + `HI_PRE_Roomle_Milestone_2` HI backend and activates the store-side bridge |
| `id=<plan id>` | Loads a plan / plan snapshot into the planner (a `ps_…` id from the INT environment) |
| `mcp_server=<url>` | Points the bridge at a remote MCP server (e.g. the Azure or Cloudflare deployment), e.g. `mcp_server=https://hi-mcp-poc.example.com` — `http(s)` or `ws(s)` both accepted. Without it the bridge connects to the local server on the page's own protocol |
| `mcp_session=<name>` | Session name for parallel use on a per-session deployment (Cloudflare): routes the page's bridge to a container of its own (`?session=` on the bridge URL). Without a remote server it is ignored — harmless everywhere else |

### The setup matrix (which setup needs which URL parameters)

Every combination below works; the parameters are purely additive — nothing breaks when they
are left out, and a local server simply ignores `mcp_session`.

| Store page | `mcp_server` | `mcp_session` | Bridge connects to | Parallel users |
| ---------- | ------------ | -------------- | ------------------ | ------------- |
| local (`http://localhost:3000`) | — | — | `ws://localhost:3100/bridge` | n/a — one local session |
| deployed (`https://www.roomle.com/…`) | — | — | `ws://localhost:3100/bridge` (loopback), `wss://localhost:3100/bridge` as browser fallback — the **local server on the user's machine** | n/a — one local session per machine |
| deployed | Cloudflare Worker URL | — | the Worker's shared `default` container | one shared session (newest tab wins) |
| deployed | Cloudflare Worker URL | a session name | the Worker's container for `?session=<name>` | **each user plans in their own container — no interference** |
| any | any (also none) | a session name | the session rides along on the bridge URL; local servers ignore it | harmless |

MCP clients connect to `http://localhost:3100/mcp` for the local setups and to
`https://<server>/mcp` (Cloudflare: plus `?session=<name>`, the same name as the store page's
`mcp_session`) for the cloud setups.

### Server configuration (environment variables, all optional)

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `HI_MCP_PORT` / `PORT` | `3100` | listen port (App Service injects `PORT`) |
| `HOST` | all interfaces | bind address |
| `HI_MCP_PAGE_ORIGINS` | `http://localhost:3000`, `http://127.0.0.1:3000`, `https://www.roomle.com` | comma-separated allowed page origins |
| `HI_MCP_TLS_CERT` + `HI_MCP_TLS_KEY` | plain HTTP | TLS certificate + key for the local wss/https variant |

### The three supported setups

| Setup | Server | Store page | MCP client |
| ----- | ------ | ---------- | ---------- |
| local + local | `npm start` | `http://localhost:3000/?store.stage=INT&id=…` | `http://localhost:3100/mcp` |
| local server + deployed store | `npm start` | `https://www.roomle.com/t/ligna-store-test/?store.stage=INT&id=…` | `http://localhost:3100/mcp` |
| Azure server + deployed store | App Service, WebSockets enabled | `…&mcp_server=https://<app>.azurewebsites.net` appended | `https://<app>.azurewebsites.net/mcp` |

The bridge always tries `ws://localhost:3100` first — loopback connections are not mixed
content, so this works from an http page (local store) and from an https page (deployed store)
alike. On https pages it falls back to `wss://localhost:3100` for browsers that refuse the
loopback exemption (the optional TLS variant below). The `mcp_server` parameter overrides host,
port and scheme.

### Connecting the deployed store (test stage)

Open `https://www.roomle.com/t/ligna-store-test/?store.stage=INT&id=<plan id>` (the store
deployment must contain the `feat/hi-mcp` branch: the `hi-mcp/` bridge and the hook in
`Planner.vue`). The page connects to the local MCP server over `ws://localhost:3100/bridge` —
no certificate needed. The server terminal logs `page connected`.

Only if your browser refuses the loopback `ws` connection, run the server with a locally trusted
certificate and the bridge's `wss` fallback picks it up:

```bash
mkcert -install && mkcert localhost    # once: a locally trusted certificate
HI_MCP_TLS_CERT=localhost.pem HI_MCP_TLS_KEY=localhost-key.pem npm start
```

The MCP endpoint is then `https://localhost:3100/mcp`; if an MCP client rejects the certificate,
point `NODE_EXTRA_CA_CERTS` at the mkcert root CA (`mkcert -CAROOT` prints its folder).

## Connecting an MCP client

Prefer the **user scope**: the server is installed once and available in every folder, so the
agent session does not have to run in the repository root.

### Claude Code

Via CLI (user scope):

```bash
claude mcp add --transport http --scope user hi-orchestrator http://localhost:3100/mcp
```

Without the CLI on the PATH (e.g. VS Code extension only): merge the `mcpServers` entry into the
**top level** of the existing `~/.claude.json` — do not replace the file, it holds other state:

```json
{ "mcpServers": { "hi-orchestrator": { "type": "http", "url": "http://localhost:3100/mcp" } } }
```

Project-scoped alternative: the same object in a `.mcp.json` file in the folder the session runs
in.

### Claude desktop app

A pure chat client — nothing of the code is visible, which makes it a good fit for audience demos.

Register the server in the desktop config file via the
[`mcp-remote`](https://www.npmjs.com/package/mcp-remote) bridge (the app's Connectors settings
offer no way to add a custom localhost server):

| OS | Config file |
| -- | ----------- |
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

```json
{
  "mcpServers": {
    "hi-orchestrator": {
      "command": "/absolute/path/to/npx",
      "args": ["mcp-remote", "http://localhost:3100/mcp"]
    }
  }
}
```

Use the **absolute** path to `npx` (find it with `which npx` on macOS/Linux, `where npx` on
Windows) — GUI apps do not see your shell PATH, so a bare `npx` fails silently. If the file
already exists, merge the `mcpServers` entry into it. Fully quit and reopen the app afterwards;
the tools appear behind the tools icon of the chat input.

### GitHub Copilot (VS Code agent mode)

User scope (works in every folder): Command Palette → _MCP: Open User Configuration_ and add the
server to the `mcp.json` that opens — note VS Code's own schema with the `servers` key:

```json
{ "servers": { "hi-orchestrator": { "type": "http", "url": "http://localhost:3100/mcp" } } }
```

Workspace-scoped alternative: the same JSON in a `.vscode/mcp.json` in the folder the session runs
in. Then open Copilot Chat, switch to **Agent** mode, and check the tools picker — the
`hi-orchestrator` tools appear there (a trust prompt is shown on first use).

### GitHub Copilot CLI

Register the server in `~/.copilot/mcp-config.json` (`%USERPROFILE%\.copilot\mcp-config.json` on
Windows) — the CLI uses the common `mcpServers` schema, **not** VS Code's `servers` key:

```json
{ "mcpServers": { "hi-orchestrator": { "type": "http", "url": "http://localhost:3100/mcp" } } }
```

### Copilot on github.com

Copilot web chat, the cloud coding agent, and a repository-level `.github/mcp.json` all run on
GitHub's servers and cannot reach `http://localhost:3100`. Using them would require exposing the
server through a public tunnel (e.g. ngrok) — out of scope for this PoC; use the local VS Code
agent mode or the Copilot CLI instead.

### Other clients

Cursor and most other clients use the common `mcpServers` schema:

```json
{ "mcpServers": { "hi-orchestrator": { "url": "http://localhost:3100/mcp" } } }
```

Clients that only support the stdio transport can bridge via
[`mcp-remote`](https://www.npmjs.com/package/mcp-remote):

```json
{ "mcpServers": { "hi-orchestrator": { "command": "npx", "args": ["mcp-remote", "http://localhost:3100/mcp"] } } }
```

At initialize, the server delivers **instructions** to the agent: the workflow, the pos-group
authoring rules, and the docking semantics (see [Authoring pos groups](#authoring-pos-groups)).

## Tool reference

Tool calls run in the store page and are only as fast as the page. The default timeout is 30 s;
`create-or-replace-groups`, `place-group`, `get-order-data`, and `get-plan-images` use 120 s.

### get-plan-context

Returns a snapshot of the HI planning session, shaped for the agent.

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `include` | `('masterData' \| 'rooms' \| 'articles' \| 'groups')[]` | no | Sections to include; `rooms`, `articles` and `groups` when omitted |

- `rooms` — wall contours of all rooms; every room additionally carries a derived `walls` array —
  per wall: a `side` label (`left`/`right`/`top`/`bottom` as seen in the top-view image),
  `start`/`end` (`[x, z]` in millimetres, the same space as a group's `pos`), `lengthMm`, `type`,
  `heightMm`, `thicknessMm`, and the `facingRotationY` a group needs to stand against that wall
- `articles` — compact catalog: `articleId`, `articleName`, `desc`, `imageUrl`, `category`, and
  per root module its master-data `module` (id, name, desc), `dimensions` (the template's `Dim`
  attributes with name and value), `mainAttributes` (the values of the `isMain` attributes),
  `dockingVectors` (the names of its docking vectors — from the template, or from a calculated
  root of the same article in the plan), `insertLevels` and `subModules` (fronts, appliances);
  `cornerArticle` is `true` for an article made for a room corner (it carries `LeftBack`/`RightBack`
  docking vectors)
- `groups` — the groups currently in the plan: a read-only `position` (`pos`, `rotationY`,
  `footprint`) and per root the article pick (`id`, `articleId`, input `attributes`,
  `contextData` with vector names only) plus read-only facts (`articleName`, `desc`, `category`,
  `dockingVectors`, `freeDockingVectors` — the vectors no docking entry uses, where a new root can
  dock — `subModules`, `isGenerated`). No root positions, no geometry. A returned group is a valid
  `create-or-replace-groups` payload as it is
- `masterData` — only when included explicitly: per library the root modules with their relevant
  attribute ids, and the attributes a customer sees (`isMain` or `userRight` `Simple`) with
  description, type, group and `selections` (value and name, no image URLs). Everything else is
  reachable through [find-attributes](#find-attributes)

Example: `{ "include": ["articles", "groups"] }`

### get-authoring-rules

No parameters. Returns the [authoring rules](#authoring-pos-groups) as text: the payload format of
`create-or-replace-groups`, the root-module fields, the placement options, the docking vectors with
their valid pairs, `mode` and `offset`, and the recipes for a row, a wall unit above a base unit, an
island and a corner. Answered by the server itself — it works even without a connected page.
Agents should fetch this before authoring pos groups (the same text is delivered as server
instructions at initialize, but not every client surfaces those).

### find-attributes

Searches the attribute vocabulary of the loaded libraries by text — attribute id, name,
description, group or selection name — and returns the matching attributes with their
`selections`, their `userRight`, and the root modules that carry them. It searches the full master
data, so it also finds the attributes the compact `masterData` section leaves out. At most 20
matches are returned; narrow the text when the result carries a `hint`.

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `text` | `string` | yes | Text to search for, case-insensitive |
| `libraryId` | `string` | no | Restrict the search to one library |

Example: `{ "text": "front" }`

### create-or-replace-groups

Creates or replaces HI object groups from an array of pos groups — and positions them in the same
call. A group whose `id` matches an existing group **completely replaces** that group (root
modules keep their ids when they already exist in the replaced group); all other groups are
created with regenerated ids. Roots are **article picks** (`{ id, articleId, attributes?,
contextData? }`) — the glue logic completes them from the article template; the planner calculates
and arranges the docked root modules. The agent never authors coordinates.

Positioning, per group:

- `placement: { wall, alignment?, offsetMm?, roomIndex? }` — stands the group against a wall.
  `wall` is a side label (`left`/`right`/`top`/`bottom`; the longest wall on that side is used) or
  a wall index from the room's `walls` array. `alignment` is `center` (default), `start`/`end`,
  or the side label of an adjoining wall to sit flush in that corner (`wall: "right",
  alignment: "top"` is the back right corner). A group with a corner article is placed by its
  corner point: the point goes exactly into the room corner and the article is turned so that
  both back edges lie along the two walls; any other group is placed by its footprint. The wall
  is resolved before anything loads, and the result reports `placedBy` per group. A placement
  whose footprint touches or overlaps another group is rejected: the groups created by the call
  are removed again, and the error names that group, its nearest root and the root's free docking
  vectors — the new units belong into that group, docked there.
- `repositioningData: { posGroup, posRotationY?, rootId, rootRelPos?, rootRelRotationY? }` —
  places the root `rootId` at the free point `posGroup` (applied once, during the load, so the
  group never appears at the origin first). Not combinable with `placement`.

Invalid payloads are rejected with per-group validation errors before anything is loaded: missing
`roots`, missing pick fields (`id`, `articleId`), an unknown `articleId` (the error lists the
catalog), `articlePos`/`rotationY` on any root or `pos`/`rotationY` on a group, undocked roots in a multi-root group,
and invalid `placement` values.

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `posGroups` | `object[]` (min 1) | yes | Pos groups following the [authoring rules](#authoring-pos-groups) |

Returns the loaded runtime ids and the resulting groups (with their final ids, `pos`,
`rotationY`, `footprint`), plus a hint when a group of this call is still unpositioned.

Example — a row of three tall units against the right wall, one call:

```json
{
  "posGroups": [
    {
      "libraryId": "<libraryId>",
      "placement": { "wall": "right" },
      "roots": [
        {
          "id": "u1",
          "articleId": "<articleId>",
          "contextData": {
            "dockedRoots": [
              {
                "ownDockingVector": "RightBottom",
                "dockedRoots": [
                  { "id": "u2", "dockingVector": "LeftBottom", "mode": "StartStart", "offset": [0, 0, 0] }
                ]
              }
            ]
          }
        },
        {
          "id": "u2",
          "articleId": "<articleId>",
          "contextData": {
            "dockedRoots": [
              {
                "ownDockingVector": "RightBottom",
                "dockedRoots": [
                  { "id": "u3", "dockingVector": "LeftBottom", "mode": "StartStart", "offset": [0, 0, 0] }
                ]
              }
            ]
          }
        },
        { "id": "u3", "articleId": "<articleId>" }
      ]
    }
  ]
}
```

### place-group

Moves an existing group against a wall: computes the group `pos`/`rotationY` from the wall, the
alignment, and the group's calculated footprint — or, for a group with a corner article and the
adjoining wall as alignment, from the article's corner point — then reloads the group with that
placement as `repositioningData` of its first root. No root positions travel; the planner arranges
the roots from their docking and derives the group position. A target that touches or overlaps
another group is rejected and the group is not moved; the error names the group and the free
docking vectors to dock to instead.

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `groupId` | `string` | yes | Id of the group (a unique prefix is accepted) |
| `wall` | `'left' \| 'right' \| 'top' \| 'bottom' \| number` | yes | Side label (the longest wall on that side) or wall index |
| `alignment` | `'start' \| 'center' \| 'end' \| side label` | no | Position along the wall; a side label means flush into that corner. Default `center` |
| `offsetMm` | `number` | no | Extra distance along the wall. Default 0 |
| `roomIndex` | `number` | no | Room in the `rooms` array. Default 0 |

Returns the applied `pos`/`rotationY`, the footprint, the wall, and the resulting group.

Example: `{ "groupId": "a1b2c3", "wall": "right", "alignment": "top" }`

### update-attribute

Sets one attribute of a root module or sub module. Attribute ids and allowed values come from the
`masterData` section of `get-plan-context`.

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `rootModuleId` | `string` | yes | Id of the root module |
| `moduleId` | `string` | no | Id of the sub module; omit to change the root module itself |
| `attributeId` | `string` | yes | Id of the attribute |
| `value` | `string \| boolean` | yes | New value; numbers are passed as strings |

Example: `{ "rootModuleId": "id0001", "attributeId": "b", "value": "900" }`

### get-price

No parameters. Calculates and returns the price/order data of the current planning situation.

### get-order-data

No parameters. Returns the order data of the current planning situation without placing an order.

### get-plan-images

No parameters. Renders the current plan and returns a perspective image and a top-view image as
MCP image content, so the agent can inspect the plan visually. The top-view orientation matches
the wall `side` labels of `get-plan-context`: a wall with side `right` is at the right edge of
the top image, `top` at the upper edge.

## Authoring pos groups

The guiding principle: **the agent declares what, the planner computes where.**

- A pos group is `{ id?, libraryId?, placement?, repositioningData?, roots: [...] }`. Sending a
  group whose `id` matches an existing group replaces that group; without a matching `id` a new
  group is created.
- A root module is an **article pick and nothing else**: `{ id, articleId, attributes?, contextData? }`.
  The server rejects a root that carries `articlePos` or `rotationY` and a group that carries `pos`
  or `rotationY`, ignores every other field, and drops roots marked `isGenerated` (worktop, toe
  kick — the library regenerates them). Every root position comes from the docking; the group
  position comes from `placement` or `repositioningData`. `id` is a
  temporary unique id of your choice for new roots (regenerated by the planner, docking and
  repositioning references are remapped automatically); keep the real ids of roots that already
  exist in a replaced group. The catalog says what an article is (`desc`, `category`), how big it
  is (`dimensions`), how it docks (`dockingVectors`) and what it contains (`subModules`).
  Sub-modules come with the article — the agent authors articles, their attributes and their
  docking, nothing else. Everything else the calculation needs — the master-data module and the
  full input attribute set — is completed automatically from the article template. `attributes`
  are `[{ id, value }]` overrides; attribute ids and allowed values come from the `masterData`
  section (requested explicitly) or from `find-attributes`.
- **Never author a position**: no `articlePos`/`rotationY` on a root, no `pos`/`rotationY` on a
  group — the payload is rejected. Roots are positioned by docking only; a group is positioned
  declaratively, with `placement` (wall) or `repositioningData` (free point) — see
  [create-or-replace-groups](#create-or-replace-groups). The server follows the same rule for its
  own re-loads: a placement travels as `repositioningData` of the group's first root, never as
  root positions.
- **Extending a kitchen**: units next to an existing group are roots of that group, never a new
  group. Take the group from `get-plan-context`, add the new picks, dock each to a free docking
  vector of the root it continues (`freeDockingVectors` per root: a free `LeftBottom` takes the new
  root's `RightBottom`, a free `RightBottom` takes `LeftBottom`, a free `Top` vector takes the new
  root's `Bottom` vector), and resubmit the group with its id. A new group with a placement is only
  for a free stretch of wall — a placement that meets another group is rejected.
- Docking (`contextData`) relates the root modules of a group to each other and is **required**:
  in a group with several roots, every additional root must be docked to a root that is already
  placed (undocked roots are rejected — they would all land at the same spot). The docking entry
  is written on the placed root (the anchor) and lists the new root under `dockedRoots`; the
  anchor's `ownDockingVector` meets the new root's `dockingVector`. Docking vector *names*
  suffice; the indices are resolved automatically. An `offset` only takes effect in this
  direction — an entry written on the new root loses it.
- Docking vectors are named edges of a root module (`dockInfos`; the names per article are in the
  catalog as `dockingVectors`). `Left`/`Right` vectors lie on the side faces and run from the back
  to the front, `Back` vectors lie on the back face and run from left to right; `Top`/`Bottom`
  name the upper and lower edge; `LeftBack`/`RightBack` exist only on corner articles — they are
  the back edges of the arms of an L-shaped corner module, and their start point is the article's
  corner point. Valid pairs (anchor → new root): beside — `RightBottom → LeftBottom`
  (to the right), `LeftBottom → RightBottom` (to the left); on top — `LeftTop → LeftBottom`,
  `RightTop → RightBottom`, `BackTop → BackBottom` (the new root may be narrower); back to back —
  `BackBottom → BackBottom`, `BackTop → BackTop` (the new root is turned by 180°, omit `mode`).
  A root without docking vectors (a hood, for example) cannot be docked and gets its own group.
- `mode` selects which endpoints coincide: `StartStart` (default) the start points — the backs
  for side vectors, the left edges for back vectors; `EndEnd` the end points; `StartEnd` and
  `EndStart` mix them. `offset` is a translation `[x, y, z]` in millimetres added to the new root
  after docking — `y` for the gap between a base unit and the wall unit above it, `x` for a gap
  in a row. Recipes: a row (`RightBottom → LeftBottom`, chained), a wall unit above a base unit
  (`LeftTop → LeftBottom` with a `y` offset), a narrow wall unit right-aligned above a wide base
  unit (`BackTop → BackBottom`, `EndEnd`, `y` offset), a worktop lying on a unit
  (`LeftTop → LeftBottom`, no offset), an island (`BackBottom → BackBottom`, no `mode`), a
  room corner (start the group with a corner article, `cornerArticle: true` in the catalog, give
  it `placement: { wall, alignment: <side of the adjoining wall> }`, and continue the rows along
  both walls from its `RightBottom` and `LeftBottom` — prefer this over butting two straight
  units together).
- Verify results numerically: the returned groups carry `position` (`pos`, `rotationY`,
  `footprint`) and per root the `dockingVectors`, the input attributes and the docking; `logMessages`
  entries with category `Error` mean the input is wrong (typically a bad `articleId` or attribute
  value).

## Demo walkthrough

With a connected agent, this sequence exercises the whole PoC:

1. `get-plan-context` — rooms (with walls), compact articles (with docking vectors and
   dimensions), current groups; `find-attributes` for the attribute behind a requested property
2. `create-or-replace-groups` — create one group with two docked cabinets and
   `placement: { "wall": "right" }`; they appear arranged against the right wall
3. Take the group from the result, change it, resubmit with its id — the group is updated, not
   duplicated
4. `place-group` — move the group to another wall or into a corner
5. `update-attribute` — change a dimension; the plan updates visibly
6. `get-price` — returns the total
7. `get-plan-images` — the agent sees the plan

## Example prompts

Ready-to-use prompts for the connected agent, from read-only to write operations:

| Prompt | Tools the agent should use |
| ------ | -------------------------- |
| "What articles are available in this library? Summarize them with their descriptions." | `get-plan-context` (`articles`) |
| "Describe the room and the groups currently in the plan." | `get-plan-context` (`rooms`, `groups`) |
| "Create a sideboard of three docked cabinets, 800 mm wide each, against the longest wall." | `get-plan-context`, `create-or-replace-groups` |
| "Add a group of three tall units to the wall on the right." | `get-plan-context`, `create-or-replace-groups` (with `placement`) |
| "Move the group to the back right corner." | `place-group` (`wall: "right", alignment: "top"`) |
| "Add a wardrobe next to the existing group." | `get-plan-context`, `create-or-replace-groups` (replace: the wardrobe docks to a free vector of the group's end root) |
| "Make all cabinets in the group 900 mm high." | `get-plan-context`, `create-or-replace-groups` (replace) or `update-attribute` |
| "Which attribute sets the front colour, and which values are allowed?" | `find-attributes` |
| "Put a wall unit above each base unit." | `get-plan-context`, `create-or-replace-groups` (replace, stacking recipe) |
| "Plan an L-shaped kitchen into the back right corner." | `get-plan-context` (a `cornerArticle`), `create-or-replace-groups` (corner recipe, `placement: { wall: "right", alignment: "top" }`) |
| "Replace the middle cabinet with a drawer unit." | `get-plan-context`, `create-or-replace-groups` (replace) |
| "What does the current plan cost?" | `get-price` |
| "Show me the plan." | `get-plan-images` |

## Troubleshooting

| Symptom | Cause / fix |
| ------- | ----------- |
| Tool error `No HI page connected` | Start the store (`npm run dev`) and open `http://localhost:3000/?store.stage=INT&id=<plan id>` and keep the tab open — the bridge starts with the INT stage |
| Tool error `... is not a function` | The UI served for the stage (`bo-test` at INT) does not contain the Part 1 HI APIs (`getExternalObjectPlanContext`, …) — the web-sdk deployment there has to catch up |
| Port 3100 already in use | The server names the fix itself (`lsof -ti tcp:3100 \| xargs kill`); since the auto-shutdown guard this should only happen when a second instance is started deliberately. The zero-dependency `minimal-hi-example/hi-mcp-server.js` also uses 3100 — run only one of them |
| Several store tabs open | The most recently connected tab receives the tool calls; close the others |
| `get-price` / `get-order-data` fail | Wrong stage (the HI backend is resolved from it — use `store.stage=INT`), or no HI backend reachable for the milestone backend id |
| Page reloaded | The bridge reconnects automatically every 3 s — no restart needed |
| Empty `articles`/`masterData` | No library loaded yet — open the store with an `id` query param that loads a plan of the HI library |

## Removing the PoC

The PoC is deliberately self-contained — its dependencies live in this folder's own
`package.json`, installed through the `hi-mcp/` workspace root. To remove it, delete:

- this folder (`hi-mcp/hi-mcp-poc-json/`) and its entry in the `workspaces` array of
  `hi-mcp/package.json`
- the `hi-mcp/` folder with the page-side bridge in the ligna-store repository
- the INT-stage hook in `ligna-store/components/blocks/Planner.vue`
