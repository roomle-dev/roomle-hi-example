# HI Presets Example

The documentation of `minimal-hi-example/` — the standalone HI presets example
([`index.html`](../../minimal-hi-example/index.html)) and its start launcher
([`start.mjs`](../../minimal-hi-example/start.mjs)). The example runs the HI tools of the
roomle-ui planner (`packages/web-sdk/packages/homag-intelligence/src/hi-mcp/`), which the embedding-lib
hands to the agent of the page (`createHiMcpTools`,
[ADR 0012](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/the-hi-tool-set-runs-in-the-planner.md)). With them, an AI agent
orchestrates HOMAG Intelligence (HI) object groups in a live planning session: the agent retrieves
the plan context (master data, rooms, articles, existing groups) and creates or modifies HI object
groups — without computing root-module positions itself.

The HI tools are documented in roomle-ui: the
[tool reference](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-reference.md),
the [behaviour reference](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md)
and the [HOMAG Intelligence guideline](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence.md)
with the architecture.

The example page runs the HI MCP tools of the embedding-lib
(`createHiMcpTools`) in the page, and the planning assistant of the embedding-lib
(`startPlanningAssistant`) chats with them in the AI Planning Assistant window
([ai-chat.md](../../docs/ai-chat.md)).

For the shortest path to a first chat turn in the example, see the
[README](../../minimal-hi-example/README.md) of `minimal-hi-example/`.

## The example

A standalone, copy-paste version of the embedding-lib HI presets demo. It
contains the complete interface and browser JavaScript in one
[`index.html`](../../minimal-hi-example/index.html), requires no build step, and loads only
`@roomle/embedding-lib` and its `hi.js` from unpkg, pinned to the alpha release `9.0.0-alpha.5`
([unreleased-embedding-lib.md](../../docs/setup/unreleased-embedding-lib.md)).

The preset dropdown is filled from `GET <HI_SERVER_BASE_URL>/backends/list`,
the same endpoint the source presets demo uses. There is no hardcoded preset
list: when the request fails the dropdown stays empty, the failure is logged
to the panel, and the page falls back to the `backendId` and `library_id`
query parameters.

Use the preset and library controls in the top bar, or supply query
parameters:

| Parameter | Effect |
| --------- | ------ |
| `chat` | `true` shows the AI Planning Assistant window and starts the chat with the model the launcher serves (the launcher appends it when it is started with a model) |
| `backendId` | Selects the HI backend |
| `library_id` | Overrides the preset's library |
| `id` | Selects the plan loaded at startup |
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
the example page (index.html, served by the launcher on :3000)
  AI Planning Assistant window
    |  onPlanningAssistantPrompt
    v
  startPlanningAssistant (embedding-lib) --streamText--> the model of /planning-assistant-config.json
    |  the HI MCP tools of the embedding-lib (createHiMcpTools), forwarding every call
    v
  roomDesignerApi.extended.callExternalObjectAgentTool: the tools run in the planner,
  on its seven planner methods; roomle-ui performs the plan-changing tools (HI tool commands)
```

The example is one process: `start.mjs` serves `index.html` on port 3000 and, when it is started
with a model, the `PlanningAssistantConfig` of that model at `/planning-assistant-config.json`. The
tools run in the planner: the page forwards every tool call to
`roomDesignerApi.extended.callExternalObjectAgentTool`, and the tool calls one or more planner
methods there. A tool that changes the plan is one call,
`externalObjectGroupOperation(<tool name>, <the tool's arguments>)`: roomle-ui
performs the whole tool as an HI tool command (`hi-tool-commands.ts`) — the
corrections, the docking from the relations, the placement, the group
materials, the hints — and answers with the tool's result.

| File | Responsibility |
| ---- | -------------- |
| `minimal-hi-example/start.mjs` | The launcher: static file server for `minimal-hi-example/` on :3000, the model of the chat at `/planning-assistant-config.json` (to this machine only), opens the browser |
| `minimal-hi-example/index.html` | The example itself, plus the chat at the end: `startPlanningAssistant` with the model of the launcher, on a planner API that records the tool calls the planner runs, for the test scripts |
| `minimal-hi-example/package.json` | The `start` script that runs the launcher and `dev` which adds `server_url=http://localhost:5173/` |
| roomle-ui `packages/web-sdk/packages/homag-intelligence/src/hi-mcp/*` | The HI tools: tool definitions with zod schemas and the served text (`hi-mcp-server.ts`), the tool executors (`tool-executors.ts`: the plan context in the agent's words, `find-attributes`, the forward of the plan-changing tools, undo and redo), the planner methods they call (`planner-api.ts`), the planning skills — shared with the ligna-store |

## Prerequisites

- Node 20+ for the launcher

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

The launcher serves the example and opens it in the default browser at
`http://localhost:3000/?backendId=HI_PRE_Roomle_Milestone_2&library_id=Furniture_Smith`
(`npm start -- --no-open` skips that). If port 3000 is taken (the ligna-store dev server uses it
too), start with another page port: `EXAMPLE_PORT=3101 npm start`. Ctrl+C or SIGTERM to the
launcher stops the page server.

Without the chat the example can still be served by any static file
server (e.g. `npx http-server -c-1 -p 39485`); only the chat needs the model the launcher serves.

The chat: `npm start <model> <api-key>` (for example `npm start mistral <api-key>`) opens the
example with `chat=true` and serves the model to the page — see [ai-chat.md](../../docs/ai-chat.md).

## Demo walkthrough

With a connected agent, this sequence exercises every kind of tool:

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
| Tool error `... is not a function` | The page targets a Rubens UI whose web-sdk does not contain the plan-context APIs — override `server_url` to a deployment (or local UI dev server) that does |
| `get-price` / `get-order-data` fail | No HI library loaded on the page, or the HI proxy rejected the credentials |
| Empty `articles`/`masterData` | No library loaded on the page yet |
