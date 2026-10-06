# ADR 0001 — HI MCP tool logic runs in the MCP server, pages only execute planner methods

> **Status**: Accepted
> **Date**: 2026-09-29
> **Analysis**: the refactoring analysis of pull request [#23](https://github.com/roomle-dev/roomle-hi-example/pull/23) (git history, commit `20b20a0`)

## Context

The HI planning session lives in the user's browser tab, so the MCP server reaches the planner
only through a page that connects outward to it (WebSocket `/bridge`). Until this decision, every
client page also carried the complete tool implementations: payload validation, planner call
composition and agent hints, copied into the ligna-store, `minimal-hi-example/index.html` and the
reference client. The server held only the tool contracts. The copies drifted: the only deployed
client enforced an older rule than the one the server published.

## Decision

- The tools run in `hi-mcp/hi-mcp-server` (`tool-executors.ts`). They reach the planner through
  `planner-api.ts`, which forwards each planner method call over the bridge.
- The bridge protocol is method-level (`BRIDGE_PROTOCOL` 2):
  `{ kind: 'call', id, method, args: [...] }`. The page announces the protocol in its `hello`. A
  page without it gets an "update the page bridge" error on every call.
- Every page executes only the planner methods on its allow-list: `getExternalObjectPlanContext`,
  `loadExternalObjectGroupLayout`, `updateExternalObjectGroupAttribute`, `fetchPrice`,
  `getExternalObjectSnapshot`. The allow-list is the page's security boundary. A test keeps it
  identical to the server's `PlannerApi`.
  The list changes only by explicit decision: `externalObjectGroupOperation` replaced
  `updateExternalObjectGroupAttribute` (D3), `getExternalObjectGroups` and `removeExternalObject`
  joined for the anchor probe and the calculated groups, and `undo` and `redo` for the undo tools
  (D37). `PlannerApi` in `planner-api.ts` is the current list; its uses are in §4 of
  [hi-mcp-behaviour.md](../../hi-mcp/docs/hi-mcp-behaviour.md#4-how-a-tool-call-runs).

## Consequences

- A tool change is a server change only. Pages change only when a tool needs a new planner
  method. Methods that place orders or overwrite the plan need an explicit decision before they
  are added.
- The tool logic is tested where it runs.
- `create-or-replace-groups` makes four page round trips instead of one.
- Timeouts apply per planner call.
- Each host still carries the thin bridge. Moving the bridge into embedding-lib or the Rubens UI
  remains the product direction ([backlog](../backlog/one-page-bridge-for-every-host.md)). Moving
  payload validation into the planner API, with structured errors per input, remains open.

## Rejected

- Keeping the tool logic in every page.
- Publishing the page bridge together with the executors as an npm package: it removes the
  copies, but a tool change still needs a package release and an upgrade in every client, and the
  server and the page still drift apart.
- Shipping executor code from the server into the page at runtime (remote code in the shop page:
  the shop's CSP `script-src` would have to trust the MCP server, and the code could no longer be
  reviewed or pinned with subresource integrity).
- Client-side tools of the AI SDK for the in-page chat (tools without `execute`, run by the chat
  UI): they remove the relay for the built-in chat only — external agents still need the remote
  MCP endpoint — and put the tool logic back into the page.
- A headless planner on the server, as the Planner MCP server of roomle-model-exporter runs one in
  its container ([`docs/mcp-server.md`](https://github.com/roomle-dev/roomle-model-exporter/blob/feat/planner-mcp/docs/mcp-server.md),
  branch `feat/planner-mcp`): it contradicts live editing in the user's session and would need the
  plan synced back into that session.
