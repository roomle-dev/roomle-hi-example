# HI Presets Example & MCP Server — Reference

The complete documentation of this repository: the standalone HI presets
example ([`index.html`](../index.html)) and the [MCP](https://modelcontextprotocol.io/)
server ([`hi-mcp-server.js`](../hi-mcp-server.js)) that lets an AI agent
orchestrate HOMAG Intelligence (HI) object groups in a live planning session.
The agent retrieves the plan context (master data, rooms, articles, existing
groups) and creates or modifies HI object groups — without computing
root-module positions itself.

It is a standalone, zero-dependency variant of the roomle-ui repository's
`packages/embedding-lib/examples/hi-mcp-server/` PoC
([RML-17693](https://roomle.atlassian.net/browse/RML-17693)): the MCP
protocol layer (JSON-RPC over Streamable HTTP) is hand-rolled instead of
using `@modelcontextprotocol/sdk`, and the page bridge uses SSE + `fetch`
instead of a WebSocket, so nothing needs `npm install`, TypeScript, or a
build.

The server is **agent-agnostic**: it contains no client-specific code. Any
MCP client with Streamable HTTP transport support can connect (Claude Code,
the Claude desktop app, Cursor, VS Code Copilot agent mode, Gemini CLI,
custom clients built with an MCP SDK).

For the shortest path to a first successful tool call, see the
[README](../README.md) in the repository root.

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
                                               hi-mcp-server.js (one Node process, zero deps)
                                               |  SSE /bridge + POST /bridge/result
                                               v
                                   the example page (index.html, served by the same process)
                                   executes tools against roomDesignerApi.extended
```

One process on port 3100 does everything: it serves `index.html`, hosts the
MCP endpoint `/mcp`, and hosts the page bridge. The page cannot listen on a
port, so it connects **outward** to the server: it receives tool calls over a
server-sent-events stream (`GET /bridge`) and posts each result back
(`POST /bridge/result`). Tool calls run in the page against
`roomDesignerApi.extended`.

| File | Responsibility |
| ---- | -------------- |
| `hi-mcp-server.js` | HTTP server on :3100: static files, `/mcp` (JSON-RPC: initialize, tools/list, tools/call), the SSE page bridge, call correlation and timeouts, tool definitions with JSON-Schema inputs, server instructions and authoring rules, browser auto-open |
| `index.html` | The example itself, plus the MCP section at the end: the SSE browser bridge, the tool executors (tool name → `roomDesignerApi.extended` call + context shaping), and the placement geometry (wall derivation, group footprints, wall placement) |
| `package.json` | Only the `start` script — there are no dependencies |

## Prerequisites

- Node 18+ (`npm install` is **not** needed)

## Running

```bash
npm start          # or directly: node hi-mcp-server.js
```

The server prints its URLs when ready and opens the example in the default
browser at `http://localhost:3100/?mcp=true` (pass `--no-open` to skip that).
It reports an occupied port with the command to free it instead of a bare
stack trace.

Select a preset (or enter a library id) in the top bar and keep the tab
open — the server terminal logs `page connected`.

Without the MCP part the repository can still be served by any static file
server (e.g. `npx http-server -c-1 -p 39485`); only the `mcp=true` bridge
requires the page to be served by `hi-mcp-server.js`.

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

Tool calls run in the example page and are only as fast as the page. The
default timeout is 30 s; `create-or-replace-groups`, `place-group`,
`get-order-data`, and `get-plan-images` use 120 s.

### get-plan-context

Returns a snapshot of the HI planning session, shaped for the agent.

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `include` | `('masterData' \| 'rooms' \| 'articles' \| 'groups')[]` | no | Sections to include; all sections when omitted |

- `masterData` — module and attribute vocabulary per library, including
  descriptions and allowed values (`selections`)
- `rooms` — wall contours of all rooms; every room additionally carries a
  derived `walls` array — per wall: a `side` label (`left`/`right`/`top`/
  `bottom` as seen in the top-view image), `start`/`end` (`[x, z]` in
  millimetres, the same space as a group's `pos`), `lengthMm`, `type`,
  `heightMm`, `thicknessMm`, and the `facingRotationY` a group needs to stand
  against that wall
- `articles` — compact catalog: `articleId`, `articleName`, `desc`,
  `imageUrl`, `category`, root-module names and dimension attributes
  (`b`/`h`/`t` and `mod_Width`/`mod_Height`/`mod_Depth`)
- `groups` — the groups currently in the plan with their `pos`, `rotationY`
  and a derived `footprint`, without calculated geometry (`parts`,
  `contours`, and `repositioningData` stripped); a stripped group is still a
  valid `create-or-replace-groups` payload

Example: `{ "include": ["articles", "groups"] }`

### get-authoring-rules

No parameters. Returns the [authoring rules](#authoring-pos-groups) as text:
the payload format of `create-or-replace-groups`, the root-module fields, the
coordinate and dimension conventions, and the docking-topology semantics.
Answered by the server itself — it works even without a connected page.
Agents should fetch this before authoring pos groups (the same text is
delivered as server instructions at initialize, but not every client surfaces
those).

### create-or-replace-groups

Creates or replaces HI object groups from an array of pos groups — and
positions them in the same call. A group whose `id` matches an existing group
**completely replaces** that group (root modules keep their ids when they
already exist in the replaced group); all other groups are created with
regenerated ids. Roots are **article picks** (`{ id, articleId, attributes?,
contextData? }`) — the glue logic completes them from the article template;
the planner calculates and arranges the docked root modules. The agent never
authors coordinates.

Positioning, per group:

- `placement: { wall, alignment?, offsetMm?, roomIndex? }` — stands the group
  against a wall. `wall` is a side label (`left`/`right`/`top`/`bottom`; the
  longest wall on that side is used) or a wall index from the room's `walls`
  array. `alignment` is `center` (default), `start`/`end`, or the side label
  of an adjoining wall to sit flush in that corner (`wall: "right",
  alignment: "top"` is the back right corner). The wall is resolved before
  anything loads.
- `repositioningData: { posGroup, posRotationY?, rootId, rootRelPos?,
  rootRelRotationY? }` — places the root `rootId` at the free point
  `posGroup` (applied once, during the load, so the group never appears at
  the origin first). Not combinable with `placement`.

Invalid payloads are rejected with per-group validation errors before
anything is loaded: missing `roots`, missing pick fields (`id`, `articleId`),
an unknown `articleId` (the error lists the catalog), authored
`articlePos`/`rotationY` on new roots, undocked roots in a multi-root group,
and invalid `placement` values.

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `posGroups` | `object[]` (min 1) | yes | Pos groups following the [authoring rules](#authoring-pos-groups) |

Returns the loaded runtime ids and the resulting groups (with their final
ids, `pos`, `rotationY`, `footprint`), plus a hint when a group of this call
is still unpositioned.

Example — a row of three tall units against the right wall, one call:

```json
{
  "posGroups": [
    {
      "libraryId": "<libraryId>",
      "placement": { "wall": "right" },
      "roots": [
        { "id": "u1", "articleId": "<articleId>" },
        {
          "id": "u2",
          "articleId": "<articleId>",
          "contextData": {
            "dockedRoots": [
              {
                "ownDockingVector": "LeftBottom",
                "dockedRoots": [
                  { "id": "u1", "dockingVector": "RightBottom", "mode": "StartStart", "offset": [0, 0, 0] }
                ]
              }
            ]
          }
        },
        {
          "id": "u3",
          "articleId": "<articleId>",
          "contextData": {
            "dockedRoots": [
              {
                "ownDockingVector": "LeftBottom",
                "dockedRoots": [
                  { "id": "u2", "dockingVector": "RightBottom", "mode": "StartStart", "offset": [0, 0, 0] }
                ]
              }
            ]
          }
        }
      ]
    }
  ]
}
```

### place-group

Moves an existing group against a wall: computes the group `pos`/`rotationY`
from the wall, the alignment, and the group's calculated footprint, then
reloads the group there.

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `groupId` | `string` | yes | Id of the group (a unique prefix is accepted) |
| `wall` | `'left' \| 'right' \| 'top' \| 'bottom' \| number` | yes | Side label (the longest wall on that side) or wall index |
| `alignment` | `'start' \| 'center' \| 'end' \| side label` | no | Position along the wall; a side label means flush into that corner. Default `center` |
| `offsetMm` | `number` | no | Extra distance along the wall. Default 0 |
| `roomIndex` | `number` | no | Room in the `rooms` array. Default 0 |

Returns the applied `pos`/`rotationY`, the footprint, the wall, and the
resulting group.

Example: `{ "groupId": "a1b2c3", "wall": "right", "alignment": "top" }`

### update-attribute

Sets one attribute of a root module or sub module. Attribute ids and allowed
values come from the `masterData` section of `get-plan-context`.

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `rootModuleId` | `string` | yes | Id of the root module |
| `moduleId` | `string` | no | Id of the sub module; omit to change the root module itself |
| `attributeId` | `string` | yes | Id of the attribute |
| `value` | `string \| boolean` | yes | New value; numbers are passed as strings |

Example: `{ "rootModuleId": "id0001", "attributeId": "b", "value": "900" }`

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

The guiding principle: **the agent declares what, the planner computes
where.**

- A pos group is `{ id?, libraryId?, placement?, repositioningData?,
  roots: [...] }`. Sending a group whose `id` matches an existing group
  replaces that group; without a matching `id` a new group is created.
- A root module is an **article pick**: `{ id, articleId, attributes?,
  contextData? }`. `id` is a temporary unique id of your choice for new roots
  (regenerated by the planner, docking and repositioning references are
  remapped automatically); keep the real ids of roots that already exist in a
  replaced group. Everything else the calculation needs — the master-data
  module and the full input attribute set — is completed automatically from
  the article template. `attributes` are `[{ id, value }]` overrides;
  attribute ids and allowed values come from `masterData`.
- **Never set `pos`, `rotationY` or `articlePos`** — all positions and
  rotations are computed by the planner, and new roots carrying
  `articlePos`/`rotationY` are rejected. Position a group declaratively
  instead, with `placement` (wall) or `repositioningData` (free point) — see
  [create-or-replace-groups](#create-or-replace-groups).
- Docking (`contextData`) relates the root modules of a group to each other
  and is **required**: in a group with several roots, every additional root
  must dock to another root (undocked roots are rejected — they would all
  land at the same spot). Docking vector *names* suffice; the indices are
  resolved automatically. The `mode` (`StartStart`, `EndEnd`, `StartEnd`,
  `EndStart`) selects which endpoints of the two docking vectors are aligned.
  The docking vectors of an article can be inspected on the calculated groups
  in the plan (`dockInfos`).
- Verify results numerically: the returned groups carry `pos`, `rotationY`
  and `footprint`, and `logMessages` entries with category `Error` mean the
  input is wrong (typically a bad `articleId` or attribute value).

## Demo walkthrough

With a connected agent, this sequence exercises the whole example:

1. `get-plan-context` — master data with descriptions, compact articles,
   rooms (with walls), current groups
2. `create-or-replace-groups` — create one group with two docked cabinets and
   `placement: { "wall": "right" }`; they appear arranged against the right
   wall
3. Take the group from the result, change it, resubmit with its id — the
   group is updated, not duplicated
4. `place-group` — move the group to another wall or into a corner
5. `update-attribute` — change a dimension; the plan updates visibly
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
| "Add a group of three tall units to the wall on the right." | `get-plan-context`, `create-or-replace-groups` (with `placement`) |
| "Move the group to the back right corner." | `place-group` (`wall: "right", alignment: "top"`) |
| "Add a wardrobe next to the existing group." | `get-plan-context`, `create-or-replace-groups` |
| "Make all cabinets in the group 900 mm high." | `get-plan-context`, `create-or-replace-groups` (replace) or `update-attribute` |
| "Replace the middle cabinet with a drawer unit." | `get-plan-context`, `create-or-replace-groups` (replace) |
| "What does the current plan cost?" | `get-price` |
| "Show me the plan." | `get-plan-images` |

## Troubleshooting

| Symptom | Cause / fix |
| ------- | ----------- |
| Tool error `No HI example page connected` | Open `http://localhost:3100/?mcp=true` and keep the tab open |
| Tool error `... is not a function` | The page targets a Rubens UI whose web-sdk does not contain the plan-context APIs — override `server_url` to a deployment (or local UI dev server) that does |
| Port 3100 already in use | The server names the fix itself (`lsof -ti tcp:3100 \| xargs kill`) |
| Several example tabs open | The most recently connected tab receives the tool calls; close the others |
| `get-price` / `get-order-data` fail | No preset selected in the top bar, or the HI test proxy rejected the credentials |
| Page reloaded | The bridge reconnects automatically — no restart needed |
| Empty `articles`/`masterData` | No library loaded yet — select a preset or enter a library id in the top bar |
