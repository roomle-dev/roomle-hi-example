# HI Group Orchestrator MCP Server (PoC) — hi-mcp-poc-json

A proof-of-concept [MCP](https://modelcontextprotocol.io/) server that lets an AI agent orchestrate
HOMAG Intelligence (HI) object groups in a live planning session of the **ligna-store**. The agent
retrieves the plan context (master data, rooms, articles, existing groups) and creates or modifies
HI object groups from a single JSON pos-group payload — without computing root-module positions
itself ("poc-json": the whole kitchen comes from one `posGroups` JSON).

The server is **agent-agnostic**: it contains no client-specific code. Any MCP client with
Streamable HTTP transport support can connect (Claude Code, the Claude desktop app, Cursor,
VS Code Copilot agent mode, Gemini CLI, custom clients built with an MCP SDK).

Besides the ligna-store, the standalone HI presets example of this repository is a client of
the same server: `minimal-hi-example/start.mjs` serves it on port 3000, spawns this server,
and its inline page bridge uses the same WebSocket protocol. See
[`minimal-hi-example/docs/hi-mcp-server.md`](../../minimal-hi-example/docs/hi-mcp-server.md).

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
The tools run in this server (`tool-executors.ts`: payload validation, planner call composition,
agent hints). Each planner call a tool makes is relayed into the page as a method call, where it
runs against `roomDesignerApi.extended` (the `extended.*` proxy derives its methods automatically
from `RoomlePlanner.prototype`, so the web-sdk APIs (`getExternalObjectPlanContext`,
`loadExternalObjectGroupLayout`, …) are reachable as-is). The page executes only the planner
methods on its allow-list — the ones `planner-api.ts` calls. The page-side bridge lives in the
store repository (`ligna-store/hi-mcp/`), its tested copy in
[`../hi-mcp-poc-json-client/`](../hi-mcp-poc-json-client/); this folder contains the server side
and all tool logic.

| Port | Process |
| ---- | ------- |
| 3000 | the client page — ligna-store dev server (`npm run dev`) or the HI presets example launcher (`minimal-hi-example/start.mjs`) |
| 3100 | this MCP server (`npm start`) — MCP endpoint `/mcp` + WebSocket bridge |

| File | Responsibility |
| ---- | -------------- |
| `server.ts` | Entry point: HTTP server on :3100 hosting `/mcp` and the WebSocket upgrade |
| `package.json` | Self-contained dependencies of the server (MCP SDK, ws, zod, vite-node) |
| `hi-mcp-server.ts` | `McpServer` setup: server instructions + tool registrations with zod schemas; the handlers run the tool executors |
| `tool-executors.ts` | The tool logic: payload validation, planner call composition, response shaping, agent hints |
| `group-placement.ts` | The placement of a new group: finds the root it is anchored at by following the docking and derives the planner's repositioning |
| `plan-space.ts` | The geometry of `place-group`: footprint and corner geometry of a calculated group, wall and corner placement, the overlap test between groups |
| `planner-api.ts` | The planner methods the tools call, forwarded to the page with per-method timeouts |
| `page-bridge.ts` | Connected-page registry, call correlation, timeouts, protocol check, "no page connected" error |
| `types.ts` | WebSocket message protocol, `BRIDGE_PROTOCOL` (the page side carries its own copy) |
| `tests/` | Unit tests of the server and the tool logic (vitest, configured at the `hi-mcp/` workspace root) |

The page side — the browser bridge with its planner method allow-list and its unit tests — is in
[`../hi-mcp-poc-json-client/`](../hi-mcp-poc-json-client/).

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
| HI example (`npm run start:cf`, `http://localhost:3000`) | Cloudflare Worker URL (set by the launcher) | the OS user name (set by the launcher) | the Worker's container for `?session=<user name>` | one container per OS user name; two machines with the same user name share it |

MCP clients connect to `http://localhost:3100/mcp` for the local setups and to
`https://<server>/mcp` (Cloudflare: plus `?session=<name>`, the same name as the store page's
`mcp_session`) for the cloud setups.

### Server configuration (environment variables, all optional)

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `HI_MCP_PORT` / `PORT` | `3100` | listen port (App Service injects `PORT`) |
| `HOST` | all interfaces | bind address |
| `HI_MCP_PAGE_ORIGINS` | `http://localhost:3000`, `http://127.0.0.1:3000`, `https://www.roomle.com` | comma-separated allowed page origins: the only origins that may open the `/bridge` WebSocket and call `/mcp` from a browser (CORS, e.g. the ligna-store chat window) |
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

The behaviour reference — guidelines, decisions, every guard, correction and feedback message, and
the information the server provides — is [../docs/hi-mcp-behaviour.md](../docs/hi-mcp-behaviour.md).

The tools run in this server, but every planner call they make executes in the store page, so a
tool is only as fast as the page. The timeout applies per planner call: 30 s by default, 120 s for
`loadExternalObjectGroupLayout` (`create-or-replace-groups`, `place-group`),
`externalObjectGroupOperation` (the command tools) and `getExternalObjectSnapshot`
(`get-order-data`, `get-plan-images`).

A JSON result comes back as compact JSON without the `imageUrl` fields of the planner's plan
context: a signed CDN URL for every article, module and attribute value — three quarters of the
tokens of `get-plan-context`, and no agent can open them.

### get-plan-context

Returns a snapshot of the HI planning session, shaped for the agent.

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `include` | `('masterData' \| 'rooms' \| 'articles' \| 'groups')[]` | no | Sections to include; `rooms`, `articles` and `groups` when omitted |

- `rooms` — every room carries its contour `levels` with 3D segments (`pos: [x, level, -y]`,
  the same right-handed coordinate system as a group's `pos`, Y up) and a derived `walls` array —
  per wall: a `side` label (`left`/`right`/`top`/`bottom` as seen in the top-view image),
  `start`/`end` (`[x, 0, z]` in millimetres, the 3D contour points on the floor), `lengthMm`,
  `type`, `heightMm`, `thicknessMm`, and `facingRotationY` — the `posRotationY` of a group standing
  with its back against that wall (see [Positioning a group](#positioning-a-group))
- `articles` — compact catalog: `articleId`, `articleName`, `desc`, `category`, and
  per root module its master-data `module` (id, name, desc), `dimensions` (the
  template's `Dim` attributes with name and value), `mainAttributes` (the values of the `isMain`
  attributes), `dockingVectors` (the names of its docking vectors — from the template, or from a
  calculated root of the same article in the plan), `insertLevels` and `subModules` (fronts,
  appliances — id, name, desc);
  `cornerArticle` is `true` for an article made for a room corner (it carries `LeftBack`/`RightBack`
  docking vectors)
- `groups` — the groups currently in the plan: a read-only `position` (`pos`, `rotationY`,
  `footprint`) as a placement names it — `pos` the room point of the group's back left bottom
  corner, `rotationY` the rotation of the placement, the footprint measured from `pos`, and with two
  corner articles `rootId`, the one `pos` belongs to — and per root the article pick (`id`, `articleId`, input `attributes`,
  `contextData` with vector names only) plus read-only facts (`articleName`, `desc`,
  `category`, `dockingVectors`, `freeDockingVectors` — the vectors no docking entry uses, where a
  new root can dock — `subModules` with their id, `isGenerated`). No root positions, no
  geometry. A returned group is a valid `create-or-replace-groups` payload as it is
- `masterData` — only when included explicitly: per library the root modules (id, name,
  desc) with their relevant attribute ids, and the attributes a customer sees (`isMain` or
  `userRight` `Simple`) with desc, type, group and `selections` (value, name and desc). The same compacted attribute vocabulary is searched by
  [find-attributes](#find-attributes)

Example: `{ "include": ["articles", "groups"] }`

### get-authoring-rules

No parameters. Returns the [authoring rules](#authoring-pos-groups) as text: the payload format of
`create-or-replace-groups`, the root-module fields, how to position a new group
with a `placement`, the docking vectors with their valid pairs, `mode` and `offset`, and the recipes for a row, a wall unit above a base unit, an
island and a corner. Answered by the server itself — it works even without a connected page.
Agents should fetch this before authoring pos groups (the same text is delivered as server
instructions at initialize, but not every client surfaces those).

### find-attributes

Searches the attribute vocabulary of the loaded libraries by text — attribute id, name,
description, group or selection name — and returns the matching attributes with their
`selections` and the root modules that carry them. The vocabulary is the compacted master data of
`get-plan-context` (root modules and their customer-facing attributes). At most 20 matches are
returned; narrow the text when the result carries a `hint`.

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `text` | `string` | yes | Text to search for, case-insensitive |
| `libraryId` | `string` | no | Restrict the search to one library |

Example: `{ "text": "front" }`

### create-or-replace-groups

Creates or replaces HI object groups from an array of pos groups — and positions new groups in the
same call. A group whose `id` matches an existing group **completely replaces** that group and
keeps its position (root modules keep their ids when they already exist in the replaced group);
all other groups are created with regenerated ids. Roots are **article picks** (`{ id, articleId,
attributes? }`), and every root after the first names its neighbour with one relation — `rightOf`,
`leftOf`, `onTop`, `above` or `behind` — from which the server builds the docking (`contextData`,
`group-layout.ts`). The glue logic completes the picks from the article template, and the planner
arranges the root modules. The agent never authors root positions. Docking written as
`contextData` — a group from `get-plan-context` carries it — is still accepted.

A new group is positioned with `placement: { posGroup, posRotationY, rootId? }` — see
[Positioning a group](#positioning-a-group). It is applied once, during the load that creates the
group, so the group never appears at the origin first.

The server corrects what it can and reports each correction in `corrections`: it drops
`articlePos`/`rotationY` on roots and `pos`/`rotationY` on groups, puts a root without a relation
into the row of its kind, and does not use a placement it cannot read or one on a group that is already in
the plan (the planner positions the group, an existing group keeps its position). A group it cannot
build — no roots, an unknown `articleId`, roots it cannot dock — is reported in `notLoaded` with
what to send instead, and the other groups of the call load. The call fails only when no group can
be built. Every guard and correction:
[hi-mcp-behaviour.md §8](../docs/hi-mcp-behaviour.md#8-guards-corrections-and-feedback).

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `posGroups` | `object[]` (min 1) | yes | Pos groups following the [authoring rules](#authoring-pos-groups) |

Returns the loaded runtime ids and the resulting groups (with their final ids, `pos`,
`rotationY`, `footprint`), plus a hint when a group of this call is still unpositioned,
`corrections` (what the server changed in the input) and `notLoaded` (`[{ index, id?, errors }]`,
the groups it could not build).

Example — a row of three tall units along the right wall of a 4000 × 3000 mm room, from the back
right corner, one call. `posGroup` is the right wall's `end` (`[4000, 0, -3000]`), `270` its
`facingRotationY`:

```json
{
  "posGroups": [
    {
      "libraryId": "<libraryId>",
      "placement": { "posGroup": [4000, 0, -3000], "posRotationY": 270 },
      "roots": [
        { "id": "u1", "articleId": "<articleId>" },
        { "id": "u2", "articleId": "<articleId>", "rightOf": "u1" },
        { "id": "u3", "articleId": "<articleId>", "rightOf": "u2" }
      ]
    }
  ]
}
```

Example — an L-shaped kitchen in the back right corner of the same room is ONE group starting
with the corner article `c1`: `posGroup` is the corner point, `270` the rotation of the right
back corner; the units `rightOf` the corner article run along the right wall, the units `leftOf` it
along the back wall, and the wall units hang beside the tall unit and above the base unit:

```json
{
  "posGroups": [
    {
      "libraryId": "<libraryId>",
      "placement": { "posGroup": [4000, 0, -3000], "posRotationY": 270 },
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

Moves an existing group against a wall or into a room corner. The tool runs in the server: it
reads the rooms and the groups, takes the calculated group from the planner
(`getExternalObjectGroups`), computes the position from the wall, the alignment and the group's
footprint — a group with a corner article goes into the corner when the alignment names the
adjoining wall — and reloads the group there, once. The roots and their docking stay as they are.
Groups may touch. A target that overlaps another group — footprints and height ranges overlap by
more than 5 mm — is moved along the same wall to the nearest free position, and `corrections`
names the group and the distance and suggests `merge-groups` if the units belong together; into a
corner, or without a free position on the wall, the group is placed as asked and the overlap
reported. No page change: the planner methods it calls are on every page's allow-list.

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `groupId` | `string` | yes | Id of the group (a unique prefix is accepted) |
| `wall` | `'left' \| 'right' \| 'top' \| 'bottom' \| 'back' \| 'front' \| number` | yes | Side label (the longest wall of type `wall` on that side; `back` is `top`, `front` is `bottom`) or wall index |
| `alignment` | `'start' \| 'center' \| 'end' \| side label` | no | Position along the wall; the side label of an adjoining wall means flush into that corner (`wall: "right"` + `alignment: "top"` is the back right corner); one parallel to the wall centres the group. Default `center` |
| `offsetMm` | `number` | no | Extra distance along the wall. Default 0 |
| `roomIndex` | `number` | no | Room in the `rooms` array. Default 0 |

Returns `placedIn` (`corner` or `wall`), the wall, and the resulting group with its `position`,
plus `corrections` when the server corrected the request. The group keeps its height, so a group
of wall units only stays at its mounting height.

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
root at the free end of that row, and a `dockingVector` the article does not
have becomes the partner of `ownDockingVector`. The result reports these in
`corrections`. The planner's own checks (e.g. groups of different libraries
in `merge-groups`) are unchanged, and their message is passed on as the error.
Group ids accept a unique prefix.

| Tool | Parameters | Effect |
| ---- | ---------- | ------ |
| `change-module-attribute` | `rootModuleId`, `moduleId?`, `attributeId`, `value` | Sets an attribute of a root module, or of one of its sub modules (the id in `subModules`) |
| `change-group-attribute` | `groupId`, `attributeId`, `value` | Sets the attribute on every root and sub module of the group that has it; the result lists the `changedModuleIds` |
| `delete-group` | `groupId` | Removes the group |
| `delete-root-module` | `rootModuleId` | Removes one unit; units no longer docked together become separate groups where they stand, and removing the only unit removes the group. Generated roots (worktop, toe kick) cannot be removed |
| `merge-article-into-group` | `groupId`, `articleId`, `attributes?`, `dockTo: { rootId, ownDockingVector, dockingVector, mode?, offset? }` | Docks a new unit of the article to a free docking vector of a root of the group (`mode` default `StartStart`, `offset` default `[0, 0, 0]`) |
| `exchange-root-module` | `groupId`, `rootModuleId`, `articleId` | Replaces a unit with an article of one root module; the new unit keeps the position and the docking |
| `merge-groups` | `targetGroupId`, `groupIds` | Merges the groups into the target group where they stand, like the planner's merge action; nothing is moved and no docking is added |

`value` is a string, a number (passed on as its string) or a boolean. Attribute
ids and allowed values come from the `masterData` section of `get-plan-context`
or from `find-attributes`.

Examples:

- `change-module-attribute`: `{ "rootModuleId": "id0001", "attributeId": "b", "value": "900" }`
- `change-group-attribute`: `{ "groupId": "a1b2c3", "attributeId": "front", "value": "white" }`
- `merge-article-into-group`: `{ "groupId": "a1b2c3", "articleId": "<drawer unit>", "dockTo": { "rootId": "id0003", "ownDockingVector": "RightBottom", "dockingVector": "LeftBottom" } }`

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

The guiding principle: **the agent declares what and where, the planner arranges the units.** The
agent picks the articles, docks them and gives the group one point and one rotation; the planner
calculates every root position.

- A pos group is `{ id?, libraryId?, placement?, roots: [...] }`. Sending a group whose `id`
  matches an existing group replaces that group and keeps its position; without a matching `id` a
  new group is created at its `placement`.
- A root module is an **article pick and nothing else**: `{ id, articleId, attributes? }` plus one
  relation that names its neighbour.
  The server drops `articlePos`/`rotationY` on a root and `pos`/`rotationY` on a group (reported
  in `corrections`), ignores every other field, and drops roots marked `isGenerated` (worktop, toe
  kick — the library regenerates them). Every root position comes from its relation; the position
  of a new group comes from its `placement`. `id` is a
  temporary unique id of your choice for new roots (regenerated by the planner, docking and
  placement references are remapped automatically); keep the real ids of roots that already
  exist in a replaced group. The catalog says what an article is (`desc`, `category`), how big it
  is (`dimensions`), how it docks (`dockingVectors`) and what it contains (`subModules`).
  Sub-modules come with the article — the agent authors articles, their attributes and their
  relations, nothing else. Everything else the calculation needs — the master-data module and the
  full input attribute set — is completed automatically from the article template. `attributes`
  are `[{ id, value }]` overrides; attribute ids and allowed values come from the `masterData`
  section (requested explicitly) or from `find-attributes`.
- **Never author a position**: no `articlePos`/`rotationY` on a root, no `pos`/`rotationY` on a
  group — the server drops them. Roots are positioned by their relation only; a new group is
  positioned with `placement` only — see [Positioning a group](#positioning-a-group).
- **Extending a kitchen**: units next to an existing group are roots of that group, never a new
  group. Dock each new unit to a free docking vector of the root it continues (`freeDockingVectors`
  per root: a free `LeftBottom` takes the new root's `RightBottom`, a free `RightBottom` takes
  `LeftBottom`, a free `Top` vector takes the new root's `Bottom` vector) — one unit with
  `merge-article-into-group`, several at once by adding the picks, each with its relation, to the
  group from `get-plan-context` and resubmitting it with its id. A new group is only for a free stretch of
  wall or a free spot in the room. The other edits of an existing group — replace or remove a unit,
  change attributes, join groups — are command tools too.
- **Relations**: every root after the first names one neighbour of the same group by its id, with
  exactly one of these fields; the server builds the docking from it (`group-layout.ts`, D34 in the
  [behaviour reference](../docs/hi-mcp-behaviour.md#3-decisions)):

  | Relation | Meaning | Docking the server builds |
  | --- | --- | --- |
  | `rightOf` / `leftOf` | right / left of that unit, as seen from the front | `RightBottom → LeftBottom` / `LeftBottom → RightBottom`; a wall unit beside a tall unit `RightTop → LeftTop` / `LeftTop → RightTop` — the tops are flush |
  | `onTop` | stands on top of that unit (stacking, several levels); `align` `left` (default), `right`, `back`; `gapMm` lifts it | `LeftTop → LeftBottom`, `RightTop → RightBottom`, `BackTop → BackBottom` |
  | `above` | a wall unit hanging above that floor unit; `gapMm` sets the gap | `LeftTop → LeftBottom` with the gap that puts the wall unit's top at the top of the tall units (D35) |
  | `behind` | back to back, turned by 180° (an island) | `BackBottom → BackBottom` |

  Wall units and the range hood continue `rightOf` or `leftOf` each other. A corner kitchen starts
  with a corner article and continues one row `rightOf` it and the other `leftOf` it. A root without
  a relation continues the row of its kind, reported in `corrections`. The server writes each entry
  on the root the planner reaches first, so an offset always takes effect; vertical docking vectors
  are never used.
- **Docking vectors** are the named edges behind the relations (`dockInfos`; the names per article
  are in the catalog as `dockingVectors`). Groups from `get-plan-context` show their docking as
  `contextData`: per root its `ownDockingVector` and the `dockingVector` of each root it names —
  `RightBottom → LeftBottom` puts that root to the right, `LeftBottom → RightBottom` to the left, a
  `Top` vector → a `Bottom` vector on top, `BackBottom → BackBottom` back to back.
  `freeDockingVectors` are the vectors a new unit can dock to; `merge-article-into-group` names them
  in `dockTo`. A payload may still carry `contextData`; the server then docks a part the docking
  does not connect to the free end of a row of its kind, and moves the later of two roots on one
  side vector at the same place to the free end of that row.
- Verify results numerically: the returned groups carry `position` (`pos`, `rotationY`,
  `footprint`) and per root the `dockingVectors`, the input attributes and the docking.

## Positioning a group

A new group is positioned by one point and one rotation, given in the call that creates it:
`placement: { posGroup, posRotationY, rootId? }` — the same for a group at a wall, in a corner,
or anywhere in the room.

- **One group per kitchen**: every unit standing beside, above or back to back with another unit
  is a root of the same group, related to it. The group carries one placement — a kitchen is never
  split into several positioned groups.
- **Point**: `posGroup` is the room point of the group's back left bottom corner, in millimetres
  (`y` = 0 on the floor; for a group of wall units only, their mounting height). In a room corner
  it is the corner point.
- **Rotation**: `posRotationY` turns the group around `posGroup`, in degrees, **counter-clockwise
  as seen from above** (in the top-view image). This is the `rotationY` convention of the kernel
  and the glue logic, verified in
  [the refactoring analysis](../../.agents/refactoring-analysis/group-placement-via-repositioning-data.md#2-rotation-sense-of-posrotationy-d1).
- **Walls**: every wall in `get-plan-context` has `start`/`end` (floor points in the coordinates
  of `posGroup`), `lengthMm`, `type` and `facingRotationY`. With `posRotationY` = the wall's
  `facingRotationY` the group's back stands against the wall, and the group runs from `posGroup`
  towards the wall's `start`:

  | Target | `posGroup` |
  | --- | --- |
  | Flush into the corner at the wall's end | `end` |
  | At a distance d from that corner | `end + d · (start − end) / lengthMm` |
  | Centred on the wall | the same, d = (lengthMm − group width) / 2 |
  | Right end flush into the corner at the wall's start | the same, d = lengthMm − group width |

  The group width is the sum of the unit widths of the row (`dimensions` in the catalog;
  `position.footprint.widthMm` of a loaded group gives it).
- **Rectangular room** (back = top, front = bottom in the top-view image). A corner takes the
  corner point as `posGroup` and the `facingRotationY` of the wall that ends in that corner; a
  corner kitchen starts with a corner article, and its rows run along both walls:

  | Wall / corner | `posRotationY` | Corner: `RightBottom` row runs along | Corner: `LeftBottom` row runs along |
  | --- | --- | --- | --- |
  | Back wall / left back corner | 0 | back wall, to the right | left wall, to the front |
  | Left wall / left front corner | 90 | left wall, to the back | front wall, to the right |
  | Front wall / right front corner | 180 | front wall, to the left | right wall, to the back |
  | Right wall / right back corner | 270 | right wall, to the front | back wall, to the left |

  The table holds for both hands of corner article: the server turns one whose corner point lies
  on its right (`mod_CarcaseDirection` Right, e.g. `UELTB90`) by 90° more itself, so its rows run
  as listed. The group is read back with the `posGroup` and `posRotationY` it was placed with.

- **Two corner articles** (a U-shaped kitchen): set `rootId` to the corner article that goes into
  the corner `posGroup` names.
- **Anywhere else** (an island, the middle of the room, next to a door): any free floor point as
  `posGroup`, any `posRotationY`.
- **New groups only**: the placement is applied once, when the group is created. A placement on a
  group that is already in the plan is not used — the group keeps its position, and `corrections`
  says so; a group resubmitted without placement keeps its position.
- **Moving a group**: [place-group](#place-group) moves an existing group against a wall or into a
  room corner by the wall's side label, an alignment and an offset — the server computes the
  position.

## Demo walkthrough

With a connected agent, this sequence exercises the whole PoC:

1. `get-plan-context` — rooms (with walls), compact articles (with docking vectors and
   dimensions), current groups; `find-attributes` for the attribute behind a requested property
2. `create-or-replace-groups` — create one group with two docked cabinets and a `placement`
   with the right wall's `end` as `posGroup` and its `facingRotationY` as `posRotationY`; they
   appear arranged along the right wall, from the back right corner
3. Take the group from the result, change it, resubmit with its id — the group is updated, not
   duplicated
4. `place-group` — move the group to another wall or into a corner (`wall: "left"`, or
   `wall: "right"` with `alignment: "top"` for the back right corner)
5. `change-module-attribute` — change a dimension; the plan updates visibly.
   `merge-article-into-group`, `exchange-root-module` and
   `delete-root-module` add, replace and remove a unit
6. `get-price` — returns the total
7. `get-plan-images` — the agent sees the plan

## Example prompts

Ready-to-use prompts for the connected agent, from read-only to write operations:

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
| Tool error `No HI page connected` | Start the store (`npm run dev`) and open `http://localhost:3000/?store.stage=INT&id=<plan id>` and keep the tab open — the bridge starts with the INT stage |
| Tool error `... is not a function` | The UI served for the stage (`bo-test` at INT) does not contain the Part 1 HI APIs (`getExternalObjectPlanContext`, …) — the web-sdk deployment there has to catch up |
| Port 3100 already in use | The server names the fix itself (`lsof -ti tcp:3100 \| xargs kill`); since the auto-shutdown guard this should only happen when a second instance is started deliberately |
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
