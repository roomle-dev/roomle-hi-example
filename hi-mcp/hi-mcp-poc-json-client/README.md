# hi-mcp-poc-json-client — page side of the hi-mcp-poc-json server

The code that runs in the client page, not in the MCP server: the page connects outward to the
[hi-mcp-poc-json](../hi-mcp-poc-json/) server via WebSocket, executes the planner method calls the
server's tools make against `roomDesignerApi.extended` and replies with the results. The tool
logic itself runs in the server (`../hi-mcp-poc-json/tool-executors.ts`).

| File | Responsibility |
| ---- | -------------- |
| `browser-bridge.ts` | WebSocket client: connects to the server, executes the planner methods on its allow-list (`PLANNER_METHODS`), rejects every other method, replies with results |
| `types.ts` | WebSocket message protocol, `BRIDGE_PROTOCOL` (the server carries its own copy) |
| `tests/` | Unit tests (vitest, configured at the `hi-mcp/` workspace root) |

The ligna-store runs a verbatim copy of these two source files in its `hi-mcp/` folder — there
is no automatic sync, so copy them over after every change here. The message protocol in
`types.ts` must match the server. `PLANNER_METHODS` must list exactly the methods of
`../hi-mcp-poc-json/planner-api.ts` — `tests/planner-api.test.ts` in the server fails otherwise.
It changes only when a tool needs a new planner method.

`startMcpBrowserBridge` returns `retry` for a user-triggered reconnect and `dispose` for page
teardown. Call `dispose` when the owning planner unmounts to close its socket and cancel pending
reconnects, so a replacement page can claim the server.
