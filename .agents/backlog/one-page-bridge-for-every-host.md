# Backlog: one page bridge for every host

> **Type**: Backlog item (architecture; roomle-hi-example, ligna-store, later roomle-ui embedding-lib)
> **Domain**: the page side of the MCP server — `hi-mcp/hi-mcp-client/`, the inline bridge of `minimal-hi-example/index.html`, the ligna-store copy in `hi-mcp/`
> **Status**: Open — the product direction of [ADR 0001](../decisions/0001-hi-mcp-tool-logic-in-the-server.md); not scheduled

---

## Problem

The tool logic runs in the MCP server ([ADR 0001](../decisions/0001-hi-mcp-tool-logic-in-the-server.md)),
but every host page still carries its own copy of the page bridge — the WebSocket client, the
`hello` with `BRIDGE_PROTOCOL`, the planner method allow-list, the history-event relay and the
reconnect:

| Copy | Where | Tested |
|---|---|---|
| Reference client | `hi-mcp/hi-mcp-client/browser-bridge.ts` (`PLANNER_METHODS` at `:13`), `types.ts` | yes, `hi-mcp/hi-mcp-client/tests/browser-bridge.test.ts` |
| HI presets example | `minimal-hi-example/index.html:1252-1405` (inline, `MCP_PLANNER_METHODS`) | no |
| ligna-store | `hi-mcp/browser-bridge.ts`, `hi-mcp/types.ts`, started in `components/blocks/Planner.vue:263-264` | no |

The copies are kept equal by hand. A protocol change (`BRIDGE_PROTOCOL`, `hi-mcp/hi-mcp-server/types.ts:4`)
or a new planner method on the allow-list is a change in two repositories and three files, and a
sales configurator that embeds the chat would need a fourth copy. Only the reference client's
allow-list is checked against `planner-api.ts`.

## To do

1. **Publish the thin bridge as a small package** (e.g. `@roomle/hi-mcp-bridge`): the code of
   `hi-mcp/hi-mcp-client/` with `startMcpBrowserBridge(roomDesignerApi, { serverUrl, sessionId,
   clientId, onStatusChange })`. The ligna-store imports it instead of its copy; the example page
   imports it from unpkg, as it already imports `@roomle/embedding-lib`.
2. **Move it into embedding-lib or the Rubens UI** once the protocol has settled: the host enables
   the bridge with one planner option, e.g.
   `createPlanner(configuratorId, container, { ...initData, mcp: { serverUrl, sessionId } })`, and
   ships no HI MCP code of its own. The bridge then runs next to `RoomlePlanner`, and the allow-list
   is versioned with the planner methods it exposes.

## Constraints

- The allow-list stays the page's security boundary (D1, D2 of
  [hi-mcp-behaviour.md](../../hi-mcp/docs/hi-mcp-behaviour.md#3-decisions)): methods that place
  orders or overwrite the plan stay out unless explicitly decided.
- The server never ships code into the page (rejected in ADR 0001): the bridge is a reviewed,
  versioned package, not a script loaded from the MCP server.
- In the Rubens UI, the WebSocket origin is the Rubens UI origin for every host: `HI_MCP_PAGE_ORIGINS`
  no longer identifies the store, routing relies on the session id alone, the Rubens UI CSP
  `connect-src` must allow the MCP server origins, and the host has to opt in explicitly.
- The example page stays a single HTML file with inline JavaScript: it may import the package, not
  bundle it.

## Test

`hi-mcp/hi-mcp-client/tests/browser-bridge.test.ts` moves with the code into the package, and
`it('calls exactly the planner methods the page bridge exposes')` in
`hi-mcp/hi-mcp-server/tests/planner-api.test.ts` checks the server's `PlannerApi` against the
package's allow-list — then against the only copy.

**Reproduce:** diff `hi-mcp/hi-mcp-client/browser-bridge.ts` against the ligna-store's
`hi-mcp/browser-bridge.ts` and against the inline bridge of `minimal-hi-example/index.html`.

## References

- [ADR 0001](../decisions/0001-hi-mcp-tool-logic-in-the-server.md) — the tool logic in the server, the
  bridge per host as its remaining cost
- [RML-17693](https://roomle.atlassian.net/browse/RML-17693) — the roomle-ui PoC the bridge is copied from
- The product goal: [sales-configurator-ai-integration.md](../feature-analysis/sales-configurator-ai-integration.md)
  and the purpose in [`.agents/README.md`](../README.md)
