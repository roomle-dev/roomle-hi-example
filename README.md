# HI Presets Example

A standalone, copy-paste version of the embedding-lib HI presets demo. It
contains the complete interface and browser JavaScript in one
[`index.html`](./index.html), requires no build step, and loads only
`@roomle/embedding-lib@7.1.0` from unpkg.

The repository also carries an optional MCP server
([`hi-mcp-server.js`](./hi-mcp-server.js)) so an AI agent can orchestrate HI
object groups in the live session — a standalone, zero-dependency variant of
the roomle-ui repository's `packages/embedding-lib/examples/hi-mcp-server/`
PoC ([RML-17693](https://roomle.atlassian.net/browse/RML-17693)).

## Run it

One process serves the example and hosts the MCP server (Node 18+, no
`npm install`, no build):

```bash
npm start          # or directly: node hi-mcp-server.js
```

It opens the example in the default browser at
<http://localhost:3100/?mcp=true> (pass `--no-open` to skip that). Opening
the page without the `mcp=true` query parameter runs the example without the
MCP bridge.

Without the MCP part the directory can still be served by any static file
server (e.g. `npx http-server -c-1 -p 39485`); only the `mcp=true` bridge
requires the page to be served by `hi-mcp-server.js`.

## Connect an AI agent (MCP)

The MCP endpoint is `http://localhost:3100/mcp` (Streamable HTTP). Register it
in any MCP client, e.g. Claude Code:

```bash
claude mcp add --transport http --scope user hi-orchestrator http://localhost:3100/mcp
```

Open the example with `?mcp=true` and keep the tab open — the server terminal
logs `page connected`, and the agent's tool calls (get-plan-context,
create-or-replace-groups, place-group, update-attribute, get-price,
get-order-data, get-plan-images) run in the page against
`roomDesignerApi.extended`. Tool reference, client configuration for other
agents, authoring rules, and troubleshooting: see the README of the source
PoC in the roomle-ui repository
(`packages/embedding-lib/examples/hi-mcp-server/`).

`hi-mcp-server.js` has no dependencies: the MCP protocol layer (JSON-RPC over
HTTP) is hand-rolled, and the page bridge uses SSE + `fetch` instead of a
WebSocket. The tool executors and placement geometry live in the MCP section
at the end of [`index.html`](./index.html).

## Configure it

The preset dropdown is filled from `GET <HI_SERVER_BASE_URL>/backends/list`,
the same endpoint the source presets demo uses. There is no hardcoded preset
list: when the request fails the dropdown stays empty, the failure is logged to
the panel, and the page falls back to the `backendId` and `library_id` query
parameters.

Use the preset and library controls in the top bar, or supply query parameters:

- `backendId` selects the HI backend.
- `library_id` overrides the preset's library.
- `plan_id` selects the plan loaded at startup.
- `language` selects the HI and planner locale.
- `user_right` accepts `Simple`, `Advanced`, or `Master`.

The page also forwards the optional feature and debug query parameters used by
the original presets demo. Browser developer tools expose the planner as
`window.instance` for debugging.

The example uses the shared HI test proxy. Deployments should replace
`HI_SERVER_BASE_URL`, `HI_AUTH_DATA`, `EMBEDDING_ID`, default plan, and API
credentials with their own environment-specific values. The included
`HI_AUTH_DATA` is the same test-proxy credential used by the source presets
demo; it must not be reused as a production credential.
