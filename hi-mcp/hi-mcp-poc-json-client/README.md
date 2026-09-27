# hi-mcp-poc-json-client — page side of the hi-mcp-poc-json server

The code that runs in the client page, not in the MCP server: the page connects outward to the
[hi-mcp-poc-json](../hi-mcp-poc-json/) server via WebSocket, executes the relayed tool calls
against `roomDesignerApi.extended` and replies with the results.

| File | Responsibility |
| ---- | -------------- |
| `browser-bridge.ts` | WebSocket client: connects to the server, executes tool calls, replies with results |
| `tool-executors.ts` | Tool name → `roomDesignerApi.extended` calls + context shaping for the agent |
| `plan-space.ts` | Pure geometry: wall derivation (side labels, facing rotation), group footprints, wall placement |
| `types.ts` | WebSocket message protocol (the server carries its own copy) |
| `tests/` | Unit tests (vitest, configured at the `hi-mcp/` workspace root) |

The ligna-store runs a verbatim copy of these four source files in its `hi-mcp/` folder — there
is no automatic sync, so copy them over after every change here. The message protocol in
`types.ts` and the tool names must match the server.
