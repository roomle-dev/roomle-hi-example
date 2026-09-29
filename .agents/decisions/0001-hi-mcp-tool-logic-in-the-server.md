# ADR 0001 — HI MCP tool logic runs in the MCP server, pages only execute planner methods

> **Status**: Accepted
> **Date**: 2026-09-29
> **Analysis**: [hi-mcp-tool-logic-in-client-pages.md](../refactoring-analysis/hi-mcp-tool-logic-in-client-pages.md)

## Context

The HI planning session lives in the user's browser tab, so the MCP server reaches the planner
only through a page that connects outward to it (WebSocket `/bridge`). Until this decision, every
client page also carried the complete tool implementations: payload validation, planner call
composition and agent hints, copied into the ligna-store, `minimal-hi-example/index.html` and the
reference client. The server held only the tool contracts. The copies drifted: the only deployed
client enforced an older rule than the one the server published.

## Decision

- The tools run in `hi-mcp/hi-mcp-poc-json` (`tool-executors.ts`). They reach the planner through
  `planner-api.ts`, which forwards each planner method call over the bridge.
- The bridge protocol is method-level (`BRIDGE_PROTOCOL` 2):
  `{ kind: 'call', id, method, args: [...] }`. The page announces the protocol in its `hello`. A
  page without it gets an "update the page bridge" error on every call.
- Every page executes only the planner methods on its allow-list: `getExternalObjectPlanContext`,
  `loadExternalObjectGroupLayout`, `updateExternalObjectGroupAttribute`, `fetchPrice`,
  `getExternalObjectSnapshot`. The allow-list is the page's security boundary. A test keeps it
  identical to the server's `PlannerApi`.

## Consequences

- A tool change is a server change only. Pages change only when a tool needs a new planner
  method. Methods that place orders or overwrite the plan need an explicit decision before they
  are added.
- The tool logic is tested where it runs.
- `create-or-replace-groups` makes four page round trips instead of one.
- Timeouts apply per planner call.
- Each host still carries the thin bridge. Moving the bridge into embedding-lib or the Rubens UI
  (alternative C of the analysis) remains the product direction. Moving payload validation into
  the planner API (alternative B) remains open.

## Rejected

- Keeping the tool logic in every page.
- Shipping executor code from the server into the page at runtime (remote code in the shop page).
- A headless planner on the server (contradicts live editing in the user's session).

See the analysis for the full comparison.
