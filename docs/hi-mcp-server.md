# HI Presets Example & MCP Server — Reference

The complete documentation of `minimal-hi-example/`: the standalone HI presets
example ([`index.html`](../minimal-hi-example/index.html)) and the start launcher
([`start.mjs`](../minimal-hi-example/start.mjs)) that serves it and starts the repository's single
MCP server implementation, [`hi-mcp/hi-mcp-server`](../hi-mcp/hi-mcp-server/),
so an AI agent can orchestrate HOMAG Intelligence (HI) object groups in a live
planning session. The agent retrieves the plan context (master data, rooms,
articles, existing groups) and creates or modifies HI object groups — without
computing root-module positions itself.

The MCP server is the TypeScript implementation from
`hi-mcp/hi-mcp-server` (the copy of the roomle-ui PoC
[RML-17693](https://roomle.atlassian.net/browse/RML-17693)): the MCP protocol
layer is `@modelcontextprotocol/sdk` with zod tool schemas, and the page bridge
is a WebSocket. It is used as-is; the launcher only wires environment
variables ([ADR 0002](../.agents/decisions/0002-one-mcp-server-configured-from-outside.md)).
The same server also serves the ligna-store as its client — its chat window,
opened with the `model`, `api_key` and `mcp_server` query parameters — and it is
the one deployed to Cloudflare ([cloudflare-mcp-server.md](setup/cloudflare-mcp-server.md));
[azure-mcp-server.md](setup/azure-mcp-server.md) is the runbook for Azure App Service.

The server is **agent-agnostic**: it contains no client-specific code. Any
MCP client with Streamable HTTP transport support can connect (Claude Code,
the Claude desktop app, Cursor, VS Code Copilot agent mode, Gemini CLI,
custom clients built with an MCP SDK).

For the shortest path to a first successful tool call, see the
[README](../minimal-hi-example/README.md) of `minimal-hi-example/`.

## The example

A standalone, copy-paste version of the embedding-lib HI presets demo. It
contains the complete interface and browser JavaScript in one
[`index.html`](../minimal-hi-example/index.html), requires no build step, and loads only
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
| `mcp_server` | Base URL of a deployed MCP server; the bridge connects to its `/bridge` instead of `ws://localhost:<mcp_port>` (set by `npm run start:cf`) |
| `mcp_session` | The session on that server — its container on Cloudflare (set by `npm run start:cf`) |
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
                                               hi-mcp/hi-mcp-server/server.ts (vite-node)
                                               runs the tools (validation, composition, hints)
                                               |  WebSocket /bridge: planner method calls
                                               v
                                   the example page (index.html, served by the launcher on :3000)
                                   executes the allow-listed methods on roomDesignerApi.extended
```

Two processes started by one launcher: `start.mjs` serves `index.html` on
port 3000 and spawns the MCP server (`hi-mcp/hi-mcp-server/server.ts`) on
port 3100, pointing its "no page connected" error at the example URL
(`HI_MCP_STORE_URL`) and its WebSocket origin allow-list (`HI_MCP_PAGE_ORIGINS`)
at the page's origin — another page port (`EXAMPLE_PORT`) needs no extra
configuration. The page cannot listen
on a port, so it connects **outward** to the server: it opens a WebSocket
(`ws://localhost:3100/bridge`), receives planner method calls over it, and
sends each result back over the same socket. The tools themselves run in the
server; each tool calls one or more planner methods, which the page executes
against `roomDesignerApi.extended`. The page executes only the methods on its
allow-list (`getExternalObjectPlanContext`, `loadExternalObjectGroupLayout`,
`externalObjectGroupOperation` — the command tools, `fetchPrice`,
`getExternalObjectSnapshot`, `getExternalObjectGroups` — the calculated groups
for `place-group`, the positions, the row hints and the anchor probe,
`removeExternalObject` — what an undo of the anchor probe left, `undo`, `redo`;
see the server skill) — nothing else of the planner API, such as placing an
order, is reachable from the server. The allow-list is `MCP_PLANNER_METHODS` in
`index.html` and lists exactly the methods of `planner-api.ts`, as the
reference client's `PLANNER_METHODS` does — guarded for that copy by
`it('calls exactly the planner methods the page bridge exposes')` in
`hi-mcp/hi-mcp-server/tests/planner-api.test.ts`; the inline copy is kept equal by hand.

To start only the MCP server from the repository root, run `npm run mcp-server`.
It serves `/mcp` and `/bridge` on port 3100 without starting the example page
or the chat backend. A second page trying to join an occupied server is refused
without disconnecting the first (WebSocket close 4409); the example page reports
this in its MCP log and stops reconnecting. Guarded by
`it('rejects a second page without disrupting the active planner call')` in
`hi-mcp/hi-mcp-server/tests/page-bridge.test.ts`.

| File | Responsibility |
| ---- | -------------- |
| `start.mjs` | The launcher: build gate (`npm install` + typecheck of the `hi-mcp` workspace), static file server for `minimal-hi-example/` on :3000, spawns the MCP server with `HI_MCP_STORE_URL` set, opens the browser |
| `hi-mcp/hi-mcp-server/*` | The MCP server: `/mcp` (SDK Streamable HTTP: initialize, tools/list, tools/call), tool definitions with zod schemas, the tool logic (`tool-executors.ts`: payload validation, planner call composition, hints), the planner methods it calls (`planner-api.ts`), the WebSocket page bridge with call correlation and timeouts, server instructions and authoring rules — unchanged, shared with the ligna-store client and the cloud deployments |
| `index.html` | The example itself, plus the MCP section at the end: the WebSocket browser bridge that executes the allow-listed planner methods |
| `package.json` | The `start` script that runs the launcher, `dev` which adds `server_url=http://localhost:5173/`, and `start:cf` which uses the MCP server deployed on Cloudflare |

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
that URL; override it with `EXAMPLE_SERVER_URL=<url> npm run dev`. The URL lives
in `start.mjs` behind `--dev`, not as an inline variable of the npm script, so
the script runs under Windows `cmd` as well.

To use the MCP server deployed on Cloudflare instead of a local one, run
`npm run start:cf` (`--cf`; it can be combined with the chat arguments and with
`--dev`). The launcher then starts no local MCP server. It opens the example with
`mcp_server=https://hi-mcp-poc.hi-orchestrator.workers.dev&mcp_session=<OS user name>`,
points the chat at `…/mcp?session=<OS user name>` and prints that URL for
external MCP clients. Each OS user name gets a container of its own. Two
machines with the same user name share it: the first page keeps the planner,
and the server refuses the other one (WebSocket close 4409), which then shows
"This server already has a planner connected". The example
has to run on port 3000, because `http://localhost:3000` is the only local origin
the deployed server accepts, and the launcher refuses another `EXAMPLE_PORT`.
The deployment runs the last deployed image, so server changes on a branch
need a deploy first: a push to `release/cloudflare`, or `npm run deploy:cf`. Details:
[cloudflare-mcp-server.md](setup/cloudflare-mcp-server.md).

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

The behaviour reference — guidelines, decisions, every guard, correction and feedback message, and
the information the server provides — is [../../docs/hi-mcp-behaviour.md](hi-mcp-behaviour.md).

The tools run in the server, but every planner call they make executes in the
example page, so a tool is only as fast as the page. The timeout applies per
planner call: 30 s by default, 120 s for `loadExternalObjectGroupLayout`
(`create-or-replace-groups`, `place-group`), `externalObjectGroupOperation`
(the [command tools](#editing-a-group-the-command-tools)) and
`getExternalObjectSnapshot` (`get-order-data`, `get-plan-images`).

A JSON result comes back as compact JSON without the `imageUrl` fields of
the planner's plan context: a signed CDN URL for every article, module and
attribute value — three quarters of the tokens of `get-plan-context`, and no
agent can open them.

### get-plan-context

Returns a snapshot of the HI planning session, agent-ready as the planner API
(`getExternalObjectPlanContext`) provides it — compacted sections, one
coordinate system throughout (3D, right-handed, Y up).

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `include` | `('masterData' \| 'rooms' \| 'articles' \| 'articleDescriptions' \| 'groups' \| 'obstacles')[]` | no | Sections to include; `rooms`, `articles`, `groups` and `obstacles` when omitted |

- `rooms` — every room carries its contour `levels` with 3D segments
  (`pos: [x, level, -y]`, the same right-handed coordinate system as a group's
  `pos`, Y up) and a derived `walls` array — per wall: a `side` label
  (`left`/`right`/`top`/`bottom` as seen in the top-view image), `start`/`end`
  (`[x, 0, z]` in millimetres, the 3D contour points on the floor),
  `lengthMm`, `type` (`wall`, or `opening` for a door), `heightMm`, `thicknessMm`,
  a `name` in the user's words (back wall, front wall, left wall, right wall) and
  `facingRotationY` — the `posRotationY` of a group standing with its back
  against that wall (see [Positioning a group](#positioning-a-group)) — and a
  `corners` list: per room corner its `name` (back left, back right, front
  left, front right), `point` and the `posRotationY` of a corner kitchen there
- `articles` — compact catalog: `articleId`, `articleName`, `desc` (of a
  description written in sections, its FUNCTION and AI_SELECTION_HINT lines:
  what the article is and when to pick it),
  `category`, and per root module its master-data `module` (id, name,
  desc), `dimensions` (the template's `Dim` attributes with id,
  name and value in millimetres — for Furniture_Smith `mod_Width`, `mod_Depth`,
  `mod_Height`; a root in `groups` carries the same ids among its input
  `attributes`), `mainAttributes` (the values of the `isMain` attributes),
  `dockingVectors` (the names of its docking vectors — from the template, or
  from a calculated root of the same article in the plan), `insertLevels` and
  `subModules` (fronts, appliances — id, name, desc);
  `cornerArticle` is `true` for an article made for a room corner (it carries
  `LeftBack`/`RightBack` docking vectors)
- `groups` — the groups currently in the plan: a read-only `position`
  (`pos`, `rotationY`, `footprint`) as a placement names it — `pos` the room
  point of the group's back left bottom corner, `rotationY` the rotation of the
  placement, the footprint measured from `pos`, and with two corner articles
  `rootId`, the one `pos` belongs to — and per root the article pick (`id`,
  `articleId`, input `attributes`, `contextData` with vector names only) plus
  read-only facts (`articleName`, `desc`, `category`,
  `dockingVectors`, `freeDockingVectors` — the vectors no docking entry uses,
  where a new root can dock — `subModules` with their id,
  `isGenerated`). No root positions, no geometry. A returned group is a valid
  `create-or-replace-groups` payload as it is
- `obstacles` — what stands in the room, in the coordinates of the walls:
  `objects`, every plan object that is not an HI group, with `kind` (`door`,
  `window`, `object`), `outline` (floor points `[x, 0, z]`) and
  `bottomMm`/`topMm` — a door or a window also with `roomIndex`, `wall` (its
  index in the walls array) and `fromEndMm`, its span along that wall measured
  from the wall's end —, and `groups`, per HI group the `id`, `outline` and
  `bottomMm`/`topMm` of every root module that is not generated, from the
  parts of the calculated group. No walls. Requested alone, the server fetches
  the rooms too for the walls of the doors and windows
- `masterData` — only when included explicitly: per library the root modules
  (id, name, desc) with their relevant attribute ids, and the attributes a
  customer sees (`isMain` or `userRight` `Simple`) with desc, type, group and
  `selections` (value, name and desc), and `groupSettings`, the attributes the
  library's group orchestrator sets on a group. The same compacted attribute
  vocabulary is searched by [find-attributes](#find-attributes)
- `articleDescriptions` — only when included explicitly: per article its
  `articleId` and full `desc` (purpose, placement, requirements, neighbours,
  restrictions, style)

Example: `{ "include": ["articles", "groups"] }`

### get-authoring-rules

No parameters. Returns the [authoring rules](#authoring-pos-groups) as text:
the payload format of `create-or-replace-groups`, the root-module fields, how
to position a new group with a `placement`, the relations a unit names its
neighbour with (`rightOf`, `leftOf`, `onTop`, `above`, `behind`), how to read the docking
vectors of existing groups, and examples for a row, wall units beside a tall unit and above base
units, and a corner kitchen. Answered by the server itself — it works even without a
connected page. Agents should fetch this before authoring pos groups (the same
text is delivered as server instructions at initialize, but not every client
surfaces those).

### find-attributes

Searches the attribute vocabulary of the loaded libraries by text — attribute
id, name, description, group or selection name — and returns the matching
attributes with their `selections` and the root modules that carry them. The
vocabulary is the compacted master data of `get-plan-context` (root modules
— the generated ones such as the worktop `mr_Countertop` included — and their
customer-facing attributes). Every word of the text is matched on its own, in
any order, and colour/color, grey/gray and worktop/countertop read alike: one
search for `color` returns every colour attribute — front, carcase, countertop,
toe kick and the others. A value list several attributes share is listed once;
the later attributes carry `sameSelectionsAs`, the id of the attribute that
lists it. Every match names its root modules with id and name, and the
attributes the root modules in the plan carry come first. At most 20 matches are returned; narrow
the text when the result carries a `hint`. The desc of a colour value
carries its code — `Cloudy blue (#506080)` —, the colour of that value;
the agent chooses a dark, a light or a blue value by it.

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
groups are created with regenerated ids. Roots are **article picks** (`{ id, articleId,
attributes? }`), and every root after the first names its neighbour with one relation — `rightOf`,
`leftOf`, `onTop`, `above` or `behind` — from which the server builds the docking (`contextData`).
The glue logic completes the picks from the article template, and the planner arranges the root
modules. The agent never authors root positions. Docking written as `contextData` — a group from
`get-plan-context` carries it — is still accepted. A root's `attributes` are
overrides of that root module; a material for the whole group goes into the group's
`attributes`, and the server sets it on every root module and on the worktop after the
load — after a create and after a replace, the programs first (`groupAttributes` says so) —,
and a root module that names its own value of it keeps that value; the library's group
settings (`groupSettings` of the master data) stay with the group. An override only the
generated worktop carries is moved to the group, and a resubmitted group keeps the colours
of its worktop and toe kick. A root module a replace adds inherits the attributes the
library passes on between neighbours (fronts, handles, carcase) from the root module it is
docked to; its own `attributes` override them.

A new group is positioned with `placement: { wall, alignment?, offsetMm?,
roomIndex? }` at a wall or in a room corner, or with `placement: { posGroup,
posRotationY, rootId? }` anywhere else — see
[Positioning a group](#positioning-a-group). A placement by point is applied
during the load that creates the group. A group placed by wall is loaded, then
moved to its wall in one reload, because its width exists only once the planner
has calculated it (D23).

The server corrects what it can and reports each correction in
`corrections`: it drops `articlePos`/`rotationY` on roots and `pos`/`rotationY`
on groups, puts a root without a relation into the row of its kind, and does not use
a placement it cannot read or one on a group that is already in the plan (the
planner positions the group, an existing group keeps its position). A group it
cannot build — no roots, an unknown `articleId`, roots it cannot dock — is
reported in `notLoaded` with what to send instead, and the other groups of the
call load. The call fails only when no group can be built. Every guard and
correction:
[hi-mcp-behaviour.md §8](hi-mcp-behaviour.md#8-guards-corrections-and-feedback).

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `posGroups` | `object[]` (min 1) | yes | Pos groups following the [authoring rules](#authoring-pos-groups) |

Returns the loaded runtime ids and the groups of the call (with their final
ids, `pos`, `rotationY`, `footprint`) and `otherGroupIds`, the other groups of
the plan, unchanged, plus a hint when a group of this call
is still unpositioned, `groupAttributes` (`[{ index, id, set, notCarried?, rootValues? }]`: per group the
group attributes set on every unit, those no unit of the group carries — the group stands
without them —, and the root modules that keep their own value of one), `corrections` (what the server changed in the input, and what the
library changed with the group attributes — a front colour reset by a front program)
and `notLoaded` (`[{ index, id?, rootIds?, errors }]`, the groups it could not build and, with
`rootIds`, the roots of a loaded group it could not build — one unknown article id drops that root,
not the group). A group id you gave an earlier group of the session replaces that group. A `hint`
names each root module of the call's groups that overlaps an object or a root module of another
group, or stands in front of a door or a window, with the free stretches of its wall as `fromEndMm`
ranges; the group is built anyway (D55).

Example — a row of three tall units along the right wall of a 4000 × 3000 mm
room, from the back right corner, one call, placed at the right wall flush
into its corner with the back wall:

```json
{
  "posGroups": [
    {
      "libraryId": "<libraryId>",
      "placement": { "wall": "right", "alignment": "back" },
      "roots": [
        { "id": "u1", "articleId": "<articleId>" },
        { "id": "u2", "articleId": "<articleId>", "rightOf": "u1" },
        { "id": "u3", "articleId": "<articleId>", "rightOf": "u2" }
      ]
    }
  ]
}
```

Example — an L-shaped kitchen in the back right corner of the same room is
ONE group starting with the corner article `c1`, placed at the right wall with
the back wall as alignment; looking into the corner from the room, the units
`rightOf` the corner article run along the right wall, the units `leftOf` it
along the back wall, and the wall units hang beside the tall unit and above the base unit:

```json
{
  "posGroups": [
    {
      "libraryId": "<libraryId>",
      "placement": { "wall": "right", "alignment": "back" },
      "roots": [
        { "id": "c1", "articleId": "<corner article>" },
        { "id": "r1", "articleId": "<base unit>", "rightOf": "c1" },
        { "id": "t1", "articleId": "<tall unit>", "rightOf": "r1" },
        { "id": "l1", "articleId": "<base unit>", "leftOf": "c1" },
        { "id": "w1", "articleId": "<wall unit>", "leftOf": "t1" },
        { "id": "w2", "articleId": "<wall unit>", "above": "l1" }
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
group there, once — the same logic places a new group by wall in
`create-or-replace-groups`. The roots and their docking stay as they are — a wall unit hanging above a
floor unit is docked to it again, so it keeps its place —, the generated
roots (worktop, toe kick) travel with the group and keep their colours, the group
keeps its attributes, and a group that already stands where asked is not reloaded. Groups may
touch. A target that overlaps another group — a root module of the one and a root
module of the other overlap by more than 5 mm in footprint and height — is moved along the same wall to the nearest free
position, and `corrections` names the group and the distance and suggests
`merge-groups` if the units belong together; into a corner, or without a free
position on the wall, the group is placed as asked and the overlap reported.
No page change: the planner methods it calls are on every page's allow-list.

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `groupId` | `string` | yes | Id of the group (a unique prefix is accepted) |
| `wall` | `'left' \| 'right' \| 'top' \| 'bottom' \| 'back' \| 'front' \| number` | yes | Side label (the longest wall of type `wall` on that side; `back` is `top`, `front` is `bottom`) or wall index |
| `alignment` | `'start' \| 'center' \| 'end' \| side label` | no | Position along the wall; the side label of an adjoining wall means flush into that corner (`wall: "right"` + `alignment: "top"` is the back right corner); one parallel to the wall centres the group. Default `center` |
| `offsetMm` | `number` | no | Extra distance along the wall. Default 0 |
| `roomIndex` | `number` | no | Room in the `rooms` array. Default 0 |

Returns `placedIn` (`corner` or `wall`), the wall, and the resulting group
with its `position`, plus `corrections` when the server corrected the request
and a `hint` when a root module stands on an object or in front of a door or a
window after the move, with the free stretches of its wall (D55). The group keeps its height, so a group of wall units only stays at its
mounting height.

Example: `{ "groupId": "a1b2c3", "wall": "right", "alignment": "top" }`

### Editing a group: the command tools

The command tools change a group that is already in the plan. Each one calls
the planner's group command API (`externalObjectGroupOperation`, roomle-ui),
which performs the edit with the planner's own group features and answers once
the planner has loaded the result. Every command keeps the group's position and
returns `{ command, groups, removedGroupIds }`: the affected groups in the
`get-plan-context` shape and the ids of removed groups. An unknown group or
article id fails before anything changes, and the error lists the valid ones;
an article id in another spelling is read in the catalog's spelling.
`merge-article-into-group` docks a unit sent to a taken side vector to the
named root's free other side, else to the root at the free end of that row (or
of its leg, when the row ends at a corner article), and a `dockingVector` the
article does not have becomes the partner of `ownDockingVector`; a wall unit
merged on top of a floor unit without a y offset gets the hang gap of the wall
units. The result reports these in
`corrections`. The planner's own checks (e.g. groups of different libraries
in `merge-groups`) are unchanged, and their message is passed on as the error.
Group ids accept a unique prefix; a root module id that is a unique prefix, differs only in
its first UUID segment or in one character is read as that root and reported.

| Tool | Parameters | Effect |
| ---- | ---------- | ------ |
| `change-module-attribute` | `rootModuleIds` (or one `rootModuleId`), `moduleId?`, `attributeId`, `value` | Sets an attribute of one or more root modules — of one group or of several — and of their sub modules that carry it, or with `moduleId` of that one sub module of each (the id in `subModules`); one planner command per group. Returns `{ command, groupIds, changedModuleIds?, corrections? }`, not the group; a root module it could not change and every other attribute the library changed with it — a front program switched by a front colour, which changes how the fronts are built — are named in `corrections` |
| `change-group-attribute` | `groupId`, `attributeId` and `value`, or `attributes: [{ attributeId, value }]` | Sets the attribute on every root and sub module of the group that has it; several attributes in one calculation with `attributes`, the programs first. Returns `{ command, groupIds, changedModuleIds, corrections? }`, not the group; every other attribute the library changed with it — a front program switched by a front colour, which changes how the fronts are built — is named in `corrections` |
| `delete-group` | `groupId` | Deletes the group |
| `delete-article-in-place` | `rootModuleId` | Deletes an article and leaves the gap — the tool for "delete" or "remove" unless the user asks to close the gap; root modules no longer docked together become separate groups where they stand, and deleting the only root module deletes the group. Generated roots (worktop, toe kick) cannot be deleted |
| `delete-article-and-compact` | `rootModuleId`, `groupId` (optional: the group of the root module) | Deletes an article and closes the gap — when the user asks to close it: the neighbours are docked to each other, the root modules at a wall stay, a wall unit hung on it hangs on the root module that moves into the gap. A root module with a neighbour on one side only is deleted and nothing else moves; a corner article between two legs is deleted and the gap closed by turning one leg by 90° with the units above it, and the result names the leg that turned; the only root module is deleted with its group (`gapClosed: false`) |
| `merge-article-into-group` | `groupId`, `articleId`, `attributes?`, `dockTo: { rootId, ownDockingVector, dockingVector, mode?, offset? }` | Docks the article as a new root module to a free docking vector of a root module of the group (`mode` default `StartStart`, `offset` default `[0, 0, 0]`); the new root module inherits the attributes the library passes on between neighbours (fronts, handles, carcase) from `dockTo.rootId`, and `attributes` override them |
| `insert-article-into-group` | `groupId`, `articleId`, `attributes?`, `between: [rootId, rootId]` | Inserts an article between two root modules that stand side by side, in either order, whatever the group and the article (a low cabinet between two wardrobes too); the root modules at a wall or in a corner keep their place and the others move by the article's width. Two root modules of one row that are no neighbours put the article beside the first-named, towards the second (reported). The new root module inherits the attributes the library passes on between neighbours from the first root module of `between`, and `attributes` override them |
| `exchange-root-module` | `groupId`, `rootModuleId`, `articleId`, `attributes?` | Replaces a root module with an article of one root module; the new root module keeps the position, the docking and the attributes the library passes on between neighbours, `attributes` override attributes of the new root module (`mod_Width` for another width - the other root modules move by the difference), and a docking the new article cannot take is named in `corrections` |
| `swap-root-modules` | `groupId`, `rootModuleIds: [rootId, rootId]` | Lets two root modules change places, neighbours or not; attributes and the wall units hanging from a root module go with it, the group keeps its length and the root modules at a wall keep their place |
| `merge-groups` | `targetGroupId`, `groupIds` | Merges the groups into the target group where they stand, like the planner's merge action; nothing is moved and no docking is added |

`value` is a string, a number (passed on as its string) or a boolean. Attribute
ids and their values come from the `masterData` section of `get-plan-context`
or from `find-attributes`. A value may come only with the value of a related attribute: a front
colour the front program does not offer switches the program, and the library makes that change in
its calculation, not in the master data.

In a row edit — insert, `delete-article-and-compact`, exchange, swap — the end of the row at a wall
or in a corner keeps its place and the other end moves; wall units and the
range hood move with the unit they hang from. The result's `hint` names those
units and says when the row now reaches past a wall or into another group; the
row is built anyway.

Examples:

- `change-module-attribute`: `{ "rootModuleIds": ["id0001", "id0003"], "attributeId": "mod_FrontColor", "value": "199" }`
- `change-group-attribute`: `{ "groupId": "a1b2c3", "attributeId": "front", "value": "white" }`
- `merge-article-into-group`: `{ "groupId": "a1b2c3", "articleId": "<drawer unit>", "dockTo": { "rootId": "id0003", "ownDockingVector": "RightBottom", "dockingVector": "LeftBottom" } }`
- `insert-article-into-group`: `{ "groupId": "a1b2c3", "articleId": "<drawer unit>", "between": ["id0001", "id0002"] }`
- `swap-root-modules`: `{ "groupId": "a1b2c3", "rootModuleIds": ["id0001", "id0003"] }`

### undo and redo

No parameters. `undo` reverts the plan change of the last tool call that
changed the plan — the planner steps that one call made, e.g. a kitchen and its
material — and `redo` brings it back. Call `undo` again to revert the call
before. Both return the reverted tool (`undone` / `redone`), the groups it changed as
they are now, `removedGroupIds` for the groups it took out of the plan and
`otherGroupIds` for the others. Nothing to undo or redo is a normal result with `undone: null` and a
`hint`; so is a plan the user changed in the planner after the last tool call
— the planner's own undo button reverts those changes. An undo that would not
give back the plan before the call, because the user changed the plan while the
call ran, is taken back and reported. A new change of the plan
ends redo.

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
image, `top` at the upper edge. The description tells the agent that the
images show how the plan looks, while what an article is and how big it is
come from `desc` and `dimensions` (see [Authoring pos groups](#authoring-pos-groups)).

## Authoring pos groups

The guiding principle: **the agent declares what and where, the planner
arranges the units.** The agent picks the articles, docks them and gives the
group one point and one rotation; the planner calculates every root position.

- A pos group is `{ id?, libraryId?, placement?, roots: [...] }`.
  Sending a group whose `id` matches an existing group
  replaces that group and keeps its position; without a matching `id` a new
  group is created at its `placement`.
- A root module is an **article pick and nothing else**: `{ id, articleId,
  attributes? }` plus one relation that names its neighbour. The server drops `articlePos`/`rotationY` on a
  root and `pos`/`rotationY` on a group (reported in `corrections`),
  ignores every other field, and drops roots marked `isGenerated` (worktop,
  toe kick — the library regenerates them). Every root position comes from
  its relation; the position of a new group comes from its `placement`. `id` is a
  temporary unique id of your choice for new
  roots (regenerated by the planner, docking and placement references are
  remapped automatically); keep the real ids of roots that already exist in a
  replaced group. The catalog says what an article is (`desc`, `category`),
  how big it is (`dimensions`), how it docks (`dockingVectors`) and what it
  contains (`subModules`). Sub-modules come with the article — the agent
  authors articles, their attributes and their relations, nothing else.
  Everything else the calculation needs — the master-data module and the full
  input attribute set — is completed automatically from the article template.
  `attributes` are `[{ id, value }]` overrides; attribute ids and allowed
  values come from the `masterData` section (requested explicitly) or from
  `find-attributes`. A unit's size is changed with `change-module-attribute`
  and the attribute id of the dimension (e.g. `mod_Width`), never its name.
- **Every `desc` is authoritative** — of an article, a root, a module, an
  attribute and an attribute value: the agent trusts it for what a thing is,
  and `dimensions` for how big an article is. A colour code in the desc of
  an attribute value — `Cloudy blue (#506080)` — is the colour of that
  value: the agent takes it as it is and chooses light, dark or a hue by it,
  not by the name. All of them are authoritative over the catalog images of
  the master data (`imageUrl`): the agent never takes the kind or the size
  of an article, or the colour of a value, from a catalog image. The rule covers
  only the catalog images. It does not cover the renderings of
  `get-plan-images` or an image the user attaches in the chat. This holds
  for a wrong `desc` too, by design: it is fixed in the library data, never
  worked around in the agent's instructions. Catalog images do not reach the
  agent today: the server strips every `imageUrl`. The range hood `DU` and the decoration TV
  `SM_TV` of Furniture_Smith have no `dimensions` — their templates carry no
  size attribute; the panels carry depth and height but no thickness.
- **Never author a position**: no `articlePos`/`rotationY` on a root, no
  `pos`/`rotationY` on a group — the server drops them. Roots are
  positioned by their relation only; a new group is positioned with `placement`
  only — see [Positioning a group](#positioning-a-group).
- **Extending a group**: articles next to an existing group are root modules of
  that group, never a new group. Dock each new article to a free docking vector of the
  root module it continues (`freeDockingVectors` per root: a free `LeftBottom` takes
  the new root's `RightBottom`, a free `RightBottom` takes `LeftBottom`, a
  free `Top` vector takes the new root's `Bottom` vector) — one unit with
  [merge-article-into-group](#editing-a-group-the-command-tools), several at
  once by adding the picks, each with its relation, to the group from
  `get-plan-context` and resubmitting it with its id. A new group is only for a free stretch of wall
  or a free spot in the room. The other edits of an existing group — replace
  or remove a unit, change attributes, join groups — are command tools too.
- **Relations**: every root after the first names one neighbour of the same
  group by its id, with exactly one of these fields; the server builds the
  docking from it (D34 in the
  [behaviour reference](hi-mcp-behaviour.md#3-decisions)):

  | Relation | Meaning | Docking the server builds |
  | --- | --- | --- |
  | `rightOf` / `leftOf` | right / left of that unit, as seen from the front | `RightBottom → LeftBottom` / `LeftBottom → RightBottom`; a wall unit beside a tall unit `RightTop → LeftTop` / `LeftTop → RightTop` — the tops are flush |
  | `onTop` | stands on top of that unit (stacking on a tall unit or a wall unit, several levels); `align` `left` (default), `right`, `back`; `gapMm` lifts it. On a kitchen base unit nothing stands: a wall unit hangs `above` it, a floor unit continues the row (both reported) | `LeftTop → LeftBottom`, `RightTop → RightBottom`, `BackTop → BackBottom` |
  | `above` | a wall unit hanging above that floor unit; `gapMm` sets the gap | `LeftTop → LeftBottom` with the gap that puts the wall unit's top at the top of the tall units (D35) |
  | `behind` | back to back, turned by 180° (an island) | `BackBottom → BackBottom` |

  Wall units continue `rightOf` or `leftOf` each other, and so does the range
  hood. A corner kitchen starts with a corner article (`cornerArticle: true`)
  and continues one row `rightOf` it and the other `leftOf` it. A root without
  a relation continues the row of its kind — right of the previous floor unit
  or wall unit in the list — and `corrections` says so. The server writes each
  entry on the root the planner reaches first, so an offset always takes
  effect; vertical docking vectors are never used.
- **Docking vectors** are the named edges behind the relations (`dockInfos`;
  the names per article are in the catalog as `dockingVectors`). Groups from
  `get-plan-context` show their docking as `contextData`: per root its
  `ownDockingVector` and the `dockingVector` of each root it names —
  `RightBottom → LeftBottom` puts that root to the right, `LeftBottom →
  RightBottom` to the left, a `Top` vector → a `Bottom` vector on top,
  `BackBottom → BackBottom` back to back. `freeDockingVectors` are the vectors
  a new unit can dock to; [merge-article-into-group](#editing-a-group-the-command-tools)
  names them in `dockTo`. A payload may still carry `contextData`; the server
  then reads every entry in both directions, docks a part the docking does not
  connect to the free end of a row of its kind, and moves the later of two roots
  on one side vector at the same place to the free end of that row, or of its
  leg when the row ends at a corner article.
- Verify results numerically: the returned groups carry `position` (`pos`,
  `rotationY`, `footprint`) and per root the `dockingVectors`, the input
  attributes and the docking.
- Undo a wrong result: when a result is not what was asked, call `undo` and
  send the corrected call; one undo reverts one tool call. A group that only
  needs a change is edited with the command tools.

## Positioning a group

A new group is positioned in the call that creates it, in one of two forms:

- **At a wall or in a room corner**: `placement: { wall, alignment?,
  offsetMm?, roomIndex? }`, the parameters and defaults of
  [place-group](#place-group) — `wall` a side label (`left`, `right`, `back`,
  `front`) or a wall index; `alignment` `center` (the default), the side label
  of the adjoining wall to stand flush in the corner the two walls share (wall
  `back` with alignment `right` is the back right corner), or `end`;
  `offsetMm` the distance from that corner or from the wall's end. The server
  computes the point and the rotation from the calculated group; a target that
  overlaps another group moves along the wall, and `corrections` says so.
- **Anywhere else**, and for a group of wall units only: one point and one
  rotation, `placement: { posGroup, posRotationY, rootId? }`.

- **One group per kitchen**: every unit standing beside, above or back to
  back with another unit is a root of the same group, related to it. The group
  carries one placement — a kitchen is never split into several positioned
  groups.
- **Point** (the second form): `posGroup` is the room point of the group's
  back left bottom corner, in millimetres (`y` = 0 on the floor; for a group
  of wall units only, their mounting height). In a room corner it is the
  corner point.
- **Rotation**: `posRotationY` turns the group around `posGroup`, in degrees,
  **counter-clockwise as seen from above** (in the top-view image). This is
  the `rotationY` convention of the kernel and the glue logic, verified against
  RoomleCore in [roomle-hi-concepts.md](../.agents/skills/roomle-hi-concepts.md#rotation-sense).
- **Walls**: every wall in `get-plan-context` has `start`/`end` (floor points
  in the coordinates of `posGroup`), `lengthMm`, `type` and
  `facingRotationY`. With `posRotationY` = the wall's `facingRotationY` the
  group's back stands against the wall, and the group runs from `posGroup`
  towards the wall's `start`. A group at a wall takes the first form, so that
  the server computes the point.
- **Room corners**: a corner kitchen starts with a corner article and names
  one wall of the corner as `wall` and the other as `alignment`; looking into
  the corner from the room, the `RightBottom` row runs along the wall on the
  right. Every room also carries a `corners` list with the `point` and the
  `posRotationY` of each corner — the `facingRotationY` of the wall that ends
  there — for the point form. For a rectangular room (back = top, front =
  bottom in the top-view image):

  | Wall / corner | `posRotationY` | Corner: `RightBottom` row runs along | Corner: `LeftBottom` row runs along |
  | --- | --- | --- | --- |
  | Back wall / left back corner | 0 | back wall, to the right | left wall, to the front |
  | Left wall / left front corner | 90 | left wall, to the back | front wall, to the right |
  | Front wall / right front corner | 180 | front wall, to the left | right wall, to the back |
  | Right wall / right back corner | 270 | right wall, to the front | back wall, to the left |

  The table holds for both hands of corner article: the server turns one whose corner point lies
  on its right (`mod_CarcaseDirection` Right, e.g. `UELTB90`) by 90° more itself, so its rows run
  as listed. The group is read back with the `posGroup` and `posRotationY` it was placed with.

- **Two corner articles** (a U-shaped kitchen): in the wall form the first
  corner article in `roots` goes into the corner; in the point form `rootId`
  names the corner article that goes into the corner `posGroup` names.
- **Anywhere else** (an island, the middle of the room, next to a door): any
  floor point `obstacles` leaves free as `posGroup`, any `posRotationY`.
- **Obstacles**: a new group goes on a stretch of wall or a spot `obstacles`
  leaves free — a stretch by alignment `end` and `offsetMm` = the start of its
  `fromEndMm`; base units lower than a window's
  `bottomMm` fit below it. The result's `hint` names every root module that
  overlaps an object or another group or stands in front of a door or a window,
  with the free stretches of its wall (D55).
- **New groups only**: the placement is applied once, when the group is
  created. A placement on a group that is already in the plan is not used —
  the group keeps its position, and `corrections` says so; a group
  resubmitted without placement keeps its position.
- **Moving a group**: [place-group](#place-group) moves an existing group
  against a wall or into a room corner by the wall's side label, an alignment
  and an offset — the server computes the position.

## Demo walkthrough

With a connected agent, this sequence exercises the whole example:

1. `get-plan-context` — rooms (with walls), compact articles (with docking
   vectors and dimensions), current groups; `find-attributes` for the
   attribute behind a requested property
2. `create-or-replace-groups` — create one group of two cabinets, the second
   `rightOf` the first, and
   a `placement` `{ "wall": "right", "alignment": "back" }`; they appear arranged along the right
   wall, from the back right corner
3. Take the group from the result, change it, resubmit with its id — the
   group is updated, not duplicated
4. `place-group` — move the group to another wall or into a corner
   (`wall: "left"`, or `wall: "right"` with `alignment: "top"` for the back
   right corner)
5. `change-module-attribute` — change a dimension; the plan updates visibly.
   `merge-article-into-group`, `exchange-root-module` and
   `delete-article-in-place` add, replace and remove a unit
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
| "Add a group of three tall units to the wall on the right." | `get-plan-context`, `create-or-replace-groups` (`placement` `{ wall: "right" }`) |
| "Add a wardrobe next to the existing group." | `get-plan-context`, `merge-article-into-group` (the wardrobe docks to a free vector of the group's end root) |
| "Make all cabinets in the group 900 mm high." | `get-plan-context`, `change-group-attribute` |
| "Make the fronts of the whole kitchen white." | `find-attributes`, `change-group-attribute` |
| "Which attribute sets the front colour, and which values are allowed?" | `find-attributes` |
| "Put a wall unit above each base unit." | `get-plan-context`, `create-or-replace-groups` (replace, a wall unit `above` each base unit) |
| "Plan an L-shaped kitchen into the back right corner." | `get-plan-context` (a `cornerArticle`), `create-or-replace-groups` (a corner article with rows `rightOf` and `leftOf` it, `placement` `{ wall: "right", alignment: "back" }`) |
| "Move the group to the back right corner." | `get-plan-context`, `place-group` (`wall: "right"`, `alignment: "top"`) |
| "Move the kitchen to the left wall, centred." | `get-plan-context`, `place-group` (`wall: "left"`) |
| "Replace the middle cabinet with a drawer unit." | `get-plan-context`, `exchange-root-module` |
| "Insert a low cabinet between the high cabinets." | `get-plan-context`, `insert-article-into-group` |
| "Swap the first and the last cabinet." | `get-plan-context`, `swap-root-modules` |
| "Remove the middle cabinet." | `get-plan-context`, `delete-article-in-place` (the default: the gap stays, the rest splits into two groups) |
| "Remove the middle cabinet and close the gap." | `get-plan-context`, `delete-article-and-compact` (the row closes the gap) |
| "Undo that." | `undo` |
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
| Several example tabs open | The first connected tab keeps the server; a further tab reports "This server already has a planner connected" and stops reconnecting — close the first tab and reload the other |
| `get-price` / `get-order-data` fail | No preset selected in the top bar, or the HI test proxy rejected the credentials |
| Page reloaded | The bridge reconnects automatically — no restart needed |
| Empty `articles`/`masterData` | No library loaded yet — select a preset or enter a library id in the top bar |
