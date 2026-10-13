# ADR 0007 — The tool logic of the plan-changing HI MCP tools runs in the planner

> **Status**: Accepted
> **Date**: 2026-10-13
> **Ticket**: RML-18147; analysis [move-tool-logic-to-glue-logic.md](../refactoring-analysis/move-tool-logic-to-glue-logic.md), decisions D71 and D72 of [hi-mcp-behaviour.md](../../docs/hi-mcp-behaviour.md#3-decisions)
> **Supersedes in part**: [ADR 0001](0001-hi-mcp-tool-logic-in-the-server.md) — where the tool logic runs

## Context

The MCP server reaches the planner only through the page bridge. Its tools composed every change
of the plan from planner calls: a layout load, the raw calculated groups, the plan context and the
group commands. The server re-derived geometry the planner had already calculated, validated and
resolved ids the planner checked again, and learned the anchor frame of a placement by loading a
probe group into the live plan and undoing it. Every server need became a planner method on every
page allow-list.

## Decision

- Every tool that changes the plan is one planner call, `externalObjectGroupOperation(<tool name>,
  <the tool's arguments>)`. roomle-ui performs the whole tool (`hi-tool-commands.ts` and the
  `hi-tool-*` modules of `homag-intelligence`): validation and corrections, id and article
  resolution, relations into docking, placement by point and at a wall, group materials, hints,
  library changes, the groups in the placement frame.
- The anchor frame of a placement comes from the article template the glue logic calculates
  outside the plan (`calculateArticleTemplate`), not from a probe load.
- The tools use six planner methods: `getExternalObjectPlanContext`,
  `externalObjectGroupOperation`, `fetchPrice`, `getExternalObjectSnapshot`, `undo`, `redo`.
  `externalObjectGroupOperation` carries every change; a new tool is a new command, not a new
  method.
- The server keeps the tool registry and the served text, the agent-facing shaping of
  `get-plan-context`, `find-attributes`, the serialisation of plan changes and the undo
  bookkeeping of tool calls. A tool result reports the undo steps it made (`historySteps`) and the
  follow-up reloads they cause (`historyFollowUps`).

The bridge protocol and the allow-list as the page's security boundary stay as ADR 0001 decided.

## Consequences

- A change of a plan-changing tool is a roomle-ui change; the server changes only for the served
  text, the agent-facing shaping and the undo bookkeeping.
- The tool logic is tested in roomle-ui (`__tests__/hi-tool-commands/`), the server's tests cover
  forwarding, `get-plan-context`, `find-attributes` and undo/redo.
- `create-or-replace-groups` is one page round trip; the catalog of the plan context can carry the
  docking vectors and the corner point of an article that is not in the plan (`articleIds`).
- A tool that fails after it changed the plan answers with its error and the undo steps it made;
  the server records the steps, so undo reverts the half-done call, and raises the error to the
  agent.

## Rejected

- Keeping the tool logic in the server and adding planner methods for what it needs: it grows the
  planner API, and the catalog stays incomplete for every other consumer.
- A dedicated planner method per tool: `externalObjectGroupOperation` already carries a command and
  a payload.
- Translating the relations into docking in the server: the translation needs the calculated plan
  (D72).
