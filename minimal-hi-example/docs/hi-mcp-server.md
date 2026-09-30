# HI Presets Example & MCP Server — Reference

The complete documentation of this directory: the standalone HI presets
example ([`index.html`](../index.html)) and the start launcher
([`start.mjs`](../start.mjs)) that serves it and starts the repository's single
MCP server implementation, [`hi-mcp/hi-mcp-poc-json`](../../../hi-mcp/hi-mcp-poc-json/),
so an AI agent can orchestrate HOMAG Intelligence (HI) object groups in a live
planning session. The agent retrieves the plan context (master data, rooms,
articles, existing groups) and creates or modifies HI object groups — without
computing root-module positions itself.

The MCP server is the TypeScript implementation from
`hi-mcp/hi-mcp-poc-json` (the copy of the roomle-ui PoC
[RML-17693](https://roomle.atlassian.net/browse/RML-17693)): the MCP protocol
layer is `@modelcontextprotocol/sdk` with zod tool schemas, and the page bridge
is a WebSocket. It is used as-is; the launcher only wires environment
variables. The same server also serves the INT-stage ligna-store as its client,
and it is the one deployed to Azure and Cloudflare.

The server is **agent-agnostic**: it contains no client-specific code. Any
MCP client with Streamable HTTP transport support can connect (Claude Code,
the Claude desktop app, Cursor, VS Code Copilot agent mode, Gemini CLI,
custom clients built with an MCP SDK).

For the shortest path to a first successful tool call, see the
[README](../README.md) in this directory.

## The example

A standalone, copy-paste version of the embedding-lib HI presets demo. It
contains the complete interface and browser JavaScript in one
[`index.html`](../index.html), requires no build step, and loads only
`@roomle/embedding-lib@7.1.0` from unpkg.

The preset dropdown is filled from `GET <HI_SERVER_BASE_URL>/backends/list`,
the same endpoint the source presets demo uses. There is no hardcoded preset
list: when the request fails the dropdown stays empty, the failure is logged
to the panel, and the page falls back to the `backendId` and `library_id`
query parameters.

Use the preset and library controls in the top bar, or supply query
parameters:

| Parameter | Effect |
| --------- | ------ |
| `mcp=true` | Enables the MCP browser bridge (without it the example behaves as a plain demo) |
| `mcp_port` | The MCP server port the bridge connects to (default 3100; the launcher appends it when `HI_MCP_PORT` is set) |
| `backendId` | Selects the HI backend |
| `library_id` | Overrides the preset's library |
| `plan_id` | Selects the plan loaded at startup |
| `language` | Selects the HI and planner locale |
| `user_right` | Accepts `Simple`, `Advanced`, or `Master` |
| `server_url` | Overrides the Rubens UI server the planner is loaded from. Defaults to `https://www.roomle.com/t/bo-test/` |

The page also forwards the optional feature and debug query parameters used
by the original presets demo. Browser developer tools expose the planner as
`window.instance` for debugging.

The example uses the shared HI test proxy. Deployments should replace
`HI_SERVER_BASE_URL`, `HI_AUTH_DATA`, `EMBEDDING_ID`, default plan, and API
credentials with their own environment-specific values. The included
`HI_AUTH_DATA` is the same test-proxy credential used by the source presets
demo; it must not be reused as a production credential.

## Architecture

```text
AI agent (any MCP client) --Streamable HTTP--> http://localhost:3100/mcp
                                               hi-mcp/hi-mcp-poc-json server.ts (vite-node)
                                               runs the tools (validation, composition, hints)
                                               |  WebSocket /bridge: planner method calls
                                               v
                                   the example page (index.html, served by the launcher on :3000)
                                   executes the allow-listed methods on roomDesignerApi.extended
```

Two processes started by one launcher: `start.mjs` serves `index.html` on
port 3000 and spawns the MCP server (`hi-mcp/hi-mcp-poc-json/server.ts`) on
port 3100, pointing its "no page connected" error at the example URL
(`HI_MCP_STORE_URL`). Port 3000 is the server's default WebSocket origin
allow-list entry, so no extra configuration is needed. The page cannot listen
on a port, so it connects **outward** to the server: it opens a WebSocket
(`ws://localhost:3100/bridge`), receives planner method calls over it, and
sends each result back over the same socket. The tools themselves run in the
server; each tool calls one or more planner methods, which the page executes
against `roomDesignerApi.extended`. The page executes only the methods on its
allow-list (`getExternalObjectPlanContext`, `loadExternalObjectGroupLayout`,
`externalObjectGroupOperation` — the command tools, `fetchPrice`,
`getExternalObjectSnapshot`, `getExternalObjectGroups`, `removeExternalObject` — the last two
for the corner point of a corner article, see the server skill) — nothing else of the planner API, such as
placing an order, is reachable from the server.

| File | Responsibility |
| ---- | -------------- |
| `start.mjs` | The launcher: build gate (`npm install` + typecheck of the `hi-mcp` workspace), static file server for this directory on :3000, spawns the MCP server with `HI_MCP_STORE_URL` set, opens the browser |
| `hi-mcp/hi-mcp-poc-json/*` | The MCP server: `/mcp` (SDK Streamable HTTP: initialize, tools/list, tools/call), tool definitions with zod schemas, the tool logic (`tool-executors.ts`: payload validation, planner call composition, hints), the planner methods it calls (`planner-api.ts`), the WebSocket page bridge with call correlation and timeouts, server instructions and authoring rules — unchanged, shared with the ligna-store client and the cloud deployments |
| `index.html` | The example itself, plus the MCP section at the end: the WebSocket browser bridge that executes the allow-listed planner methods |
| `package.json` | The `start` script that runs the launcher, and `dev` which adds `server_url=http://localhost:5173/` |

## Prerequisites

- Node 20+ (the first start installs the `hi-mcp` workspace and typechecks the server)

## Running

```bash
npm start          # or directly: node start.mjs
```

To develop against a local Rubens UI dev server (start it first on
<http://localhost:5173/>), run `npm run dev` instead — it passes
`server_url=http://localhost:5173/` to the example, so the planner loads from
the local UI instead of `https://www.roomle.com/t/bo-test/`. `--dev` implies
that URL; override it with `EXAMPLE_SERVER_URL=<url> npm run dev`.

The launcher installs and typechecks the `hi-mcp` workspace (the build gate),
serves the example, starts the MCP server, and opens the example in the
default browser at `http://localhost:3000/?mcp=true` (pass `--no-open` to
skip that). If port 3000 is taken (the ligna-store dev server uses it too),
start with another page port: `EXAMPLE_PORT=3101 npm start`.

Select a preset (or enter a library id) in the top bar and keep the tab
open — the server terminal logs `page connected`.

Without the MCP part the example can still be served by any static file
server (e.g. `npx http-server -c-1 -p 39485`); only the `mcp=true` bridge
requires the MCP server started by the launcher.

The launcher also supports a built-in AI chat (Mistral) that drives the same
MCP tools without an external client: `npm start mistral <api-key>` — see
[ai-chat.md](./ai-chat.md).

## Connecting an MCP client

Prefer the **user scope**: the server is installed once and available in
every folder, so the agent session does not have to run in this repository.

### Claude Code

Via CLI (user scope):

```bash
claude mcp add --transport http --scope user hi-orchestrator http://localhost:3100/mcp
```

Without the CLI on the PATH (e.g. VS Code extension only): merge the
`mcpServers` entry into the **top level** of the existing `~/.claude.json` —
do not replace the file, it holds other state:

```json
{ "mcpServers": { "hi-orchestrator": { "type": "http", "url": "http://localhost:3100/mcp" } } }
```

Project-scoped alternative: the same object in a `.mcp.json` file in the
folder the session runs in.

### Claude desktop app

A pure chat client — nothing of the code is visible, which makes it a good
fit for audience demos.

Register the server in the desktop config file via the
[`mcp-remote`](https://www.npmjs.com/package/mcp-remote) bridge (the app's
Connectors settings offer no way to add a custom localhost server):

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

Use the **absolute** path to `npx` (find it with `which npx` on macOS/Linux,
`where npx` on Windows) — GUI apps do not see your shell PATH, so a bare
`npx` fails silently. If the file already exists, merge the `mcpServers`
entry into it. Fully quit and reopen the app afterwards; the tools appear
behind the tools icon of the chat input.

### GitHub Copilot (VS Code agent mode)

User scope (works in every folder): Command Palette → _MCP: Open User
Configuration_ and add the server to the `mcp.json` that opens — note VS
Code's own schema with the `servers` key:

```json
{ "servers": { "hi-orchestrator": { "type": "http", "url": "http://localhost:3100/mcp" } } }
```

Workspace-scoped alternative: the same JSON in a `.vscode/mcp.json` in the
folder the session runs in. Then open Copilot Chat, switch to **Agent** mode,
and check the tools picker — the `hi-orchestrator` tools appear there (a
trust prompt is shown on first use).

### GitHub Copilot CLI

Register the server in `~/.copilot/mcp-config.json`
(`%USERPROFILE%\.copilot\mcp-config.json` on Windows) — the CLI uses the
common `mcpServers` schema, **not** VS Code's `servers` key:

```json
{ "mcpServers": { "hi-orchestrator": { "type": "http", "url": "http://localhost:3100/mcp" } } }
```

### Copilot on github.com

Copilot web chat, the cloud coding agent, and a repository-level
`.github/mcp.json` all run on GitHub's servers and cannot reach
`http://localhost:3100`. Using them would require exposing the server through
a public tunnel (e.g. ngrok) — out of scope for this example; use the local
VS Code agent mode or the Copilot CLI instead.

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

At initialize, the server delivers **instructions** to the agent: the
workflow, the pos-group authoring rules, and the docking semantics (see
[Authoring pos groups](#authoring-pos-groups)).

## Tool reference

The tools run in the server, but every planner call they make executes in the
example page, so a tool is only as fast as the page. The timeout applies per
planner call: 30 s by default, 120 s for `loadExternalObjectGroupLayout`
(`create-or-replace-groups`, `place-group`), `externalObjectGroupOperation`
(the [command tools](#editing-a-group-the-command-tools)) and
`getExternalObjectSnapshot` (`get-order-data`, `get-plan-images`).

### get-plan-context

Returns a snapshot of the HI planning session, agent-ready as the planner API
(`getExternalObjectPlanContext`) provides it — compacted sections, one
coordinate system throughout (3D, right-handed, Y up).

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `include` | `('masterData' \| 'rooms' \| 'articles' \| 'groups')[]` | no | Sections to include; `rooms`, `articles` and `groups` when omitted |

- `rooms` — every room carries its contour `levels` with 3D segments
  (`pos: [x, level, -y]`, the same right-handed coordinate system as a group's
  `pos`, Y up) and a derived `walls` array — per wall: a `side` label
  (`left`/`right`/`top`/`bottom` as seen in the top-view image), `start`/`end`
  (`[x, 0, z]` in millimetres, the 3D contour points on the floor),
  `lengthMm`, `type`, `heightMm`, `thicknessMm`, and `facingRotationY` — the
  `posRotationY` of a group standing with its back against that wall (see
  [Positioning a group](#positioning-a-group))
- `articles` — compact catalog: `articleId`, `articleName`, `desc`,
  `imageUrl`, `category`, and per root module its master-data `module` (id,
  name, desc, imageUrl), `dimensions` (the template's `Dim` attributes with
  name and value), `mainAttributes` (the values of the `isMain` attributes),
  `dockingVectors` (the names of its docking vectors — from the template, or
  from a calculated root of the same article in the plan), `insertLevels` and
  `subModules` (fronts, appliances — id, name, desc, imageUrl);
  `cornerArticle` is `true` for an article made for a room corner (it carries
  `LeftBack`/`RightBack` docking vectors)
- `groups` — the groups currently in the plan: a read-only `position`
  (`pos`, `rotationY`, `footprint`) and per root the article pick (`id`,
  `articleId`, input `attributes`, `contextData` with vector names only) plus
  read-only facts (`articleName`, `desc`, `imageUrl`, `category`,
  `dockingVectors`, `freeDockingVectors` — the vectors no docking entry uses,
  where a new root can dock — `subModules` with id and imageUrl,
  `isGenerated`). No root positions, no geometry. A returned group is a valid
  `create-or-replace-groups` payload as it is
- `masterData` — only when included explicitly: per library the root modules
  (id, name, desc, imageUrl) with their relevant attribute ids, and the
  attributes a customer sees (`isMain` or `userRight` `Simple`) with desc,
  imageUrl, type, group and `selections` (value, name, desc and imageUrl —
  the swatch of a material). The same compacted attribute vocabulary is
  searched by [find-attributes](#find-attributes)

Example: `{ "include": ["articles", "groups"] }`

### get-authoring-rules

No parameters. Returns the [authoring rules](#authoring-pos-groups) as text:
the payload format of `create-or-replace-groups`, the root-module fields, how
to position a new group with a `placement`, the docking vectors with their valid pairs, `mode` and
`offset`, and the recipes for a row, a wall unit above a base unit, an island
and a corner. Answered by the server itself — it works even without a
connected page. Agents should fetch this before authoring pos groups (the same
text is delivered as server instructions at initialize, but not every client
surfaces those).

### find-attributes

Searches the attribute vocabulary of the loaded libraries by text — attribute
id, name, description, group or selection name — and returns the matching
attributes with their `selections` and the root modules that carry them. The
vocabulary is the compacted master data of `get-plan-context` (root modules
and their customer-facing attributes). At most 20 matches are returned; narrow
the text when the result carries a `hint`.

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `text` | `string` | yes | Text to search for, case-insensitive |
| `libraryId` | `string` | no | Restrict the search to one library |

Example: `{ "text": "front" }`

### create-or-replace-groups

Creates or replaces HI object groups from an array of pos groups — and
positions new groups in the same call. A group whose `id` matches an existing
group **completely replaces** that group and keeps its position (root modules
keep their ids when they already exist in the replaced group); all other
groups are created with regenerated ids. Roots are **article picks** (`{ id, articleId, attributes?,
contextData? }`) — the glue logic completes them from the article template;
the planner calculates and arranges the docked root modules. The agent never
authors root positions.

A new group is positioned with `placement: { posGroup, posRotationY,
rootId? }` — see [Positioning a group](#positioning-a-group). It is applied
once, during the load that creates the group, so the group never appears at
the origin first.

Invalid payloads are rejected with per-group validation errors before
anything is loaded: missing `roots`, missing pick fields (`id`, `articleId`),
an unknown `articleId` (the error lists the catalog), `articlePos`/`rotationY`
on any root or `pos`/`rotationY` on a group, undocked roots in a multi-root group,
an invalid `placement` (`posGroup` not three numbers, `posRotationY` missing
or not a number — state 0 explicitly, `rootId` not a root of the group, any
other field), and a `placement` on a group that is already in the plan.

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `posGroups` | `object[]` (min 1) | yes | Pos groups following the [authoring rules](#authoring-pos-groups) |

Returns the loaded runtime ids and the resulting groups (with their final
ids, `pos`, `rotationY`, `footprint`), plus a hint when a group of this call
is still unpositioned.

Example — a row of three tall units along the right wall of a 4000 × 3000 mm
room, from the back right corner, one call. `posGroup` is the right wall's
`end` (`[4000, 0, -3000]`), `270` its `facingRotationY`:

```json
{
  "posGroups": [
    {
      "libraryId": "<libraryId>",
      "placement": { "posGroup": [4000, 0, -3000], "posRotationY": 270 },
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

Example — an L-shaped kitchen in the back right corner of the same room is
ONE group starting with the corner article `c1`: `posGroup` is the corner
point, `270` the rotation of the right back corner; the row docked to its
`RightBottom` runs along the right wall, the row docked to its `LeftBottom`
along the back wall (one unit per row shown):

```json
{
  "posGroups": [
    {
      "libraryId": "<libraryId>",
      "placement": { "posGroup": [4000, 0, -3000], "posRotationY": 270 },
      "roots": [
        {
          "id": "c1",
          "articleId": "<corner article>",
          "contextData": {
            "dockedRoots": [
              {
                "ownDockingVector": "RightBottom",
                "dockedRoots": [
                  { "id": "r1", "dockingVector": "LeftBottom", "mode": "StartStart", "offset": [0, 0, 0] }
                ]
              },
              {
                "ownDockingVector": "LeftBottom",
                "dockedRoots": [
                  { "id": "l1", "dockingVector": "RightBottom", "mode": "StartStart", "offset": [0, 0, 0] }
                ]
              }
            ]
          }
        },
        { "id": "r1", "articleId": "<base unit>" },
        { "id": "l1", "articleId": "<base unit>" }
      ]
    }
  ]
}
```

### place-group

Moves an existing group against a wall or into a room corner. The tool runs in
the server: it reads the rooms and the groups, takes the calculated group from
the planner (`getExternalObjectGroups`), computes the position from the wall,
the alignment and the group's footprint — a group with a corner article goes
into the corner when the alignment names the adjoining wall — and reloads the
group there, once. The roots and their docking stay as they are. A target that
touches or overlaps another group is rejected and the group is not moved; the
error names the group, its nearest root and the free docking vectors to dock
to instead. No page change: the planner methods it calls are on every page's
allow-list.

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `groupId` | `string` | yes | Id of the group (a unique prefix is accepted) |
| `wall` | `'left' \| 'right' \| 'top' \| 'bottom' \| number` | yes | Side label (the longest wall of type `wall` on that side) or wall index |
| `alignment` | `'start' \| 'center' \| 'end' \| side label` | no | Position along the wall; the side label of an adjoining wall means flush into that corner (`wall: "right"` + `alignment: "top"` is the back right corner). Default `center` |
| `offsetMm` | `number` | no | Extra distance along the wall. Default 0 |
| `roomIndex` | `number` | no | Room in the `rooms` array. Default 0 |

Returns `placedIn` (`corner` or `wall`), the wall, and the resulting group
with its `position`. The group keeps its height, so a group of wall units only
stays at its mounting height.

Example: `{ "groupId": "a1b2c3", "wall": "right", "alignment": "top" }`

### Editing a group: the command tools

The command tools change a group that is already in the plan. Each one calls
the planner's group command API (`externalObjectGroupOperation`, roomle-ui),
which performs the edit with the planner's own group features and answers once
the planner has loaded the result. Every command keeps the group's position and
returns `{ command, groups, removedGroupIds }`: the affected groups in the
`get-plan-context` shape and the ids of removed groups. An unknown id, an
occupied docking vector or groups of different libraries are rejected before
anything changes. Group ids accept a unique prefix; article ids are checked
against the catalog, and the error lists the valid ones.

| Tool | Parameters | Effect |
| ---- | ---------- | ------ |
| `change-module-attribute` | `rootModuleId`, `moduleId?`, `attributeId`, `value` | Sets an attribute of a root module, or of one of its sub modules (the id in `subModules`) |
| `change-group-attribute` | `groupId`, `attributeId`, `value` | Sets the attribute on every root and sub module of the group that has it; the result lists the `changedModuleIds` |
| `delete-group` | `groupId` | Removes the group |
| `delete-root-module` | `rootModuleId` | Removes one unit; units no longer docked together become separate groups where they stand, and removing the only unit removes the group. Generated roots (worktop, toe kick) cannot be removed |
| `merge-article-into-group` | `groupId`, `articleId`, `attributes?`, `dockTo: { rootId, ownDockingVector, dockingVector, mode?, offset? }` | Docks a new unit of the article to a free docking vector of a root of the group (`mode` default `StartStart`, `offset` default `[0, 0, 0]`) |
| `exchange-root-module` | `groupId`, `rootModuleId`, `articleId` | Replaces a unit with an article of one root module; the new unit keeps the position and the docking |
| `merge-groups` | `targetGroupId`, `groupIds` | Merges the groups into the target group where they stand, like the planner's merge action; nothing is moved and no docking is added |

`value` is a string or a boolean; numbers are passed as strings. Attribute ids
and allowed values come from the `masterData` section of `get-plan-context` or
from `find-attributes`.

Examples:

- `change-module-attribute`: `{ "rootModuleId": "id0001", "attributeId": "b", "value": "900" }`
- `change-group-attribute`: `{ "groupId": "a1b2c3", "attributeId": "front", "value": "white" }`
- `merge-article-into-group`: `{ "groupId": "a1b2c3", "articleId": "<drawer unit>", "dockTo": { "rootId": "id0003", "ownDockingVector": "RightBottom", "dockingVector": "LeftBottom" } }`

### get-price

No parameters. Calculates and returns the price/order data of the current
planning situation.

### get-order-data

No parameters. Returns the order data of the current planning situation
without placing an order.

### get-plan-images

No parameters. Renders the current plan and returns a perspective image and a
top-view image as MCP image content, so the agent can inspect the plan
visually. The top-view orientation matches the wall `side` labels of
`get-plan-context`: a wall with side `right` is at the right edge of the top
image, `top` at the upper edge.

## Authoring pos groups

The guiding principle: **the agent declares what and where, the planner
arranges the units.** The agent picks the articles, docks them and gives the
group one point and one rotation; the planner calculates every root position.

- A pos group is `{ id?, libraryId?, placement?, roots: [...] }`.
  Sending a group whose `id` matches an existing group
  replaces that group and keeps its position; without a matching `id` a new
  group is created at its `placement`.
- A root module is an **article pick and nothing else**: `{ id, articleId,
  attributes?, contextData? }`. The server rejects a root that carries
  `articlePos` or `rotationY` and a group that carries `pos` or `rotationY`,
  ignores every other field, and drops roots marked `isGenerated` (worktop,
  toe kick — the library regenerates them). Every root position comes from
  the docking; the position of a new group comes from its `placement`. `id` is a
  temporary unique id of your choice for new
  roots (regenerated by the planner, docking and placement references are
  remapped automatically); keep the real ids of roots that already exist in a
  replaced group. The catalog says what an article is (`desc`, `category`),
  how big it is (`dimensions`), how it docks (`dockingVectors`) and what it
  contains (`subModules`). Sub-modules come with the article — the agent
  authors articles, their attributes and their docking, nothing else.
  Everything else the calculation needs — the master-data module and the full
  input attribute set — is completed automatically from the article template.
  `attributes` are `[{ id, value }]` overrides; attribute ids and allowed
  values come from the `masterData` section (requested explicitly) or from
  `find-attributes`.
- **Never author a position**: no `articlePos`/`rotationY` on a root, no
  `pos`/`rotationY` on a group — the payload is rejected. Roots are
  positioned by docking only; a new group is positioned with `placement`
  only — see [Positioning a group](#positioning-a-group).
- **Extending a kitchen**: units next to an existing group are roots of that
  group, never a new group. Dock each new unit to a free docking vector of the
  root it continues (`freeDockingVectors` per root: a free `LeftBottom` takes
  the new root's `RightBottom`, a free `RightBottom` takes `LeftBottom`, a
  free `Top` vector takes the new root's `Bottom` vector) — one unit with
  [merge-article-into-group](#editing-a-group-the-command-tools), several at
  once by adding the picks to the group from `get-plan-context` and
  resubmitting it with its id. A new group is only for a free stretch of wall
  or a free spot in the room. The other edits of an existing group — replace
  or remove a unit, change attributes, join groups — are command tools too.
- Docking (`contextData`) relates the root modules of a group to each other
  and is **required**: in a group with several roots, every additional root
  must be docked to a root that is already placed (undocked roots are
  rejected — they would all land at the same spot). The docking entry is
  written on the placed root (the anchor) and lists the new root under
  `dockedRoots`; the anchor's `ownDockingVector` meets the new root's
  `dockingVector`. Docking vector *names* suffice; the indices are resolved
  automatically. An `offset` only takes effect in this direction — an entry
  written on the new root loses it.
- Docking vectors are named edges of a root module (`dockInfos`; the names
  per article are in the catalog as `dockingVectors`). `Left`/`Right` vectors
  lie on the side faces and run from the back to the front, `Back` vectors
  lie on the back face and run from left to right; `Top`/`Bottom` name the
  upper and lower edge; `LeftBack`/`RightBack` exist only on corner articles
  — they are the back edges of the arms of an L-shaped corner module, and
  their start point is the article's corner point. Valid pairs (anchor → new
  root): beside —
  `RightBottom → LeftBottom` (to the right), `LeftBottom → RightBottom` (to
  the left); on top — `LeftTop → LeftBottom`, `RightTop → RightBottom`,
  `BackTop → BackBottom` (the new root may be narrower); back to back —
  `BackBottom → BackBottom`, `BackTop → BackTop` (the new root is turned by
  180°, omit `mode`). A root without docking vectors (a hood, for example)
  cannot be docked and gets its own group.
- `mode` selects which endpoints coincide: `StartStart` (default) the start
  points — the backs for side vectors, the left edges for back vectors;
  `EndEnd` the end points; `StartEnd` and `EndStart` mix them. `offset` is a
  translation `[x, y, z]` in millimetres added to the new root after docking
  — `y` for the gap between a base unit and the wall unit above it, `x` for a
  gap in a row. Recipes: a row (`RightBottom → LeftBottom`, chained), a wall
  unit above a base unit (`LeftTop → LeftBottom` with a `y` offset), a narrow
  wall unit right-aligned above a wide base unit (`BackTop → BackBottom`,
  `EndEnd`, `y` offset), a worktop lying on a unit (`LeftTop → LeftBottom`,
  no offset), an island (`BackBottom → BackBottom`, no `mode`), a room corner
  (start the group with a corner article, `cornerArticle: true` in the
  catalog, give the group a `placement` with the corner point as
  `posGroup` and the `facingRotationY` of the wall that ends in that corner
  as `posRotationY`, and continue the rows along both walls from its
  `RightBottom` and `LeftBottom` — prefer this over butting two straight units
  together).
- Verify results numerically: the returned groups carry `position` (`pos`,
  `rotationY`, `footprint`) and per root the `dockingVectors`, the input
  attributes and the docking; `logMessages` entries with category `Error`
  mean the input is wrong (typically a bad `articleId` or attribute value).

## Positioning a group

A new group is positioned by one point and one rotation, given in the call
that creates it: `placement: { posGroup, posRotationY, rootId? }` — the same
for a group at a wall, in a corner, or anywhere in the room.

- **One group per kitchen**: every unit standing beside, above or back to
  back with another unit is a root of the same group, docked to it. The group
  carries one placement — a kitchen is never split into several positioned
  groups.
- **Point**: `posGroup` is the room point of the group's back left bottom
  corner, in millimetres (`y` = 0 on the floor; for a group of wall units
  only, their mounting height). In a room corner it is the corner point.
- **Rotation**: `posRotationY` turns the group around `posGroup`, in degrees,
  **counter-clockwise as seen from above** (in the top-view image). This is
  the `rotationY` convention of the kernel and the glue logic, verified in
  [the refactoring analysis](../../.agents/refactoring-analysis/group-placement-via-repositioning-data.md#2-rotation-sense-of-posrotationy-d1).
- **Walls**: every wall in `get-plan-context` has `start`/`end` (floor points
  in the coordinates of `posGroup`), `lengthMm`, `type` and
  `facingRotationY`. With `posRotationY` = the wall's `facingRotationY` the
  group's back stands against the wall, and the group runs from `posGroup`
  towards the wall's `start`:

  | Target | `posGroup` |
  | --- | --- |
  | Flush into the corner at the wall's end | `end` |
  | At a distance d from that corner | `end + d · (start − end) / lengthMm` |
  | Centred on the wall | the same, d = (lengthMm − group width) / 2 |
  | Right end flush into the corner at the wall's start | the same, d = lengthMm − group width |

  The group width is the sum of the unit widths of the row plus any x
  docking offsets (gaps) between them (`dimensions` in the catalog;
  `position.footprint.widthMm` of a loaded group already includes the gaps).
- **Rectangular room** (back = top, front = bottom in the top-view image). A
  corner takes the corner point as `posGroup` and the `facingRotationY` of the
  wall that ends in that corner; a corner kitchen starts with a corner
  article, and its rows run along both walls:

  | Wall / corner | `posRotationY` | Corner: `RightBottom` row runs along | Corner: `LeftBottom` row runs along |
  | --- | --- | --- | --- |
  | Back wall / left back corner | 0 | back wall, to the right | left wall, to the front |
  | Left wall / left front corner | 90 | left wall, to the back | front wall, to the right |
  | Front wall / right front corner | 180 | front wall, to the left | right wall, to the back |
  | Right wall / right back corner | 270 | right wall, to the front | back wall, to the left |

- **Two corner articles** (a U-shaped kitchen): set `rootId` to the corner
  article that goes into the corner `posGroup` names.
- **Anywhere else** (an island, the middle of the room, next to a door): any
  free floor point as `posGroup`, any `posRotationY`.
- **New groups only**: the placement is applied once, when the group is
  created. A placement on a group that is already in the plan is rejected; a
  group resubmitted without placement keeps its position.
- **Moving a group**: [place-group](#place-group) moves an existing group
  against a wall or into a room corner by the wall's side label, an alignment
  and an offset — the server computes the position.

## Demo walkthrough

With a connected agent, this sequence exercises the whole example:

1. `get-plan-context` — rooms (with walls), compact articles (with docking
   vectors and dimensions), current groups; `find-attributes` for the
   attribute behind a requested property
2. `create-or-replace-groups` — create one group with two docked cabinets and
   a `placement` with the right wall's `end` as `posGroup` and its
   `facingRotationY` as `posRotationY`; they appear arranged along the right
   wall, from the back right corner
3. Take the group from the result, change it, resubmit with its id — the
   group is updated, not duplicated
4. `place-group` — move the group to another wall or into a corner
   (`wall: "left"`, or `wall: "right"` with `alignment: "top"` for the back
   right corner)
5. `change-module-attribute` — change a dimension; the plan updates visibly.
   `merge-article-into-group`, `exchange-root-module` and
   `delete-root-module` add, replace and remove a unit
6. `get-price` — returns the total
7. `get-plan-images` — the agent sees the plan

## Example prompts

Ready-to-use prompts for the connected agent, from read-only to write
operations:

| Prompt | Tools the agent should use |
| ------ | -------------------------- |
| "What articles are available in this library? Summarize them with their descriptions." | `get-plan-context` (`articles`) |
| "Describe the room and the groups currently in the plan." | `get-plan-context` (`rooms`, `groups`) |
| "Create a sideboard of three docked cabinets, 800 mm wide each, against the longest wall." | `get-plan-context`, `create-or-replace-groups` |
| "Add a group of three tall units to the wall on the right." | `get-plan-context`, `create-or-replace-groups` (`placement` from the right wall) |
| "Add a wardrobe next to the existing group." | `get-plan-context`, `merge-article-into-group` (the wardrobe docks to a free vector of the group's end root) |
| "Make all cabinets in the group 900 mm high." | `get-plan-context`, `change-group-attribute` |
| "Make the fronts of the whole kitchen white." | `find-attributes`, `change-group-attribute` |
| "Which attribute sets the front colour, and which values are allowed?" | `find-attributes` |
| "Put a wall unit above each base unit." | `get-plan-context`, `create-or-replace-groups` (replace, stacking recipe) |
| "Plan an L-shaped kitchen into the back right corner." | `get-plan-context` (a `cornerArticle`), `create-or-replace-groups` (corner recipe, `placement` at the corner point, `posRotationY` 270) |
| "Move the group to the back right corner." | `get-plan-context`, `place-group` (`wall: "right"`, `alignment: "top"`) |
| "Move the kitchen to the left wall, centred." | `get-plan-context`, `place-group` (`wall: "left"`) |
| "Replace the middle cabinet with a drawer unit." | `get-plan-context`, `exchange-root-module` |
| "Remove the middle cabinet." | `get-plan-context`, `delete-root-module` (the rest splits into two groups) |
| "Join the two groups standing side by side." | `get-plan-context`, `merge-groups` |
| "Delete the island." | `get-plan-context`, `delete-group` |
| "What does the current plan cost?" | `get-price` |
| "Show me the plan." | `get-plan-images` |

## Troubleshooting

| Symptom | Cause / fix |
| ------- | ----------- |
| Tool error `No HI page connected` | Open `http://localhost:3000/?mcp=true` (the URL the error names) and keep the tab open |
| Tool error `... is not a function` | The page targets a Rubens UI whose web-sdk does not contain the plan-context APIs — override `server_url` to a deployment (or local UI dev server) that does |
| Port 3100 already in use | The server names the fix itself (`lsof -ti tcp:3100 \| xargs kill`) |
| Several example tabs open | The most recently connected tab receives the tool calls; close the others |
| `get-price` / `get-order-data` fail | No preset selected in the top bar, or the HI test proxy rejected the credentials |
| Page reloaded | The bridge reconnects automatically — no restart needed |
| Empty `articles`/`masterData` | No library loaded yet — select a preset or enter a library id in the top bar |
