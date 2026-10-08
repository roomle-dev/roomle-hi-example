# Backlog: one planner undo step per tool call

> **Type**: Backlog item (roomle-ui; removes a workaround in the MCP server)
> **Domain**: roomle-ui `planner-core` — the undo step machinery (`plan-interaction-manager.ts`) and `externalObjectGroupOperation`; consumer: the hi-mcp `undo` and `redo` tools (D37, D38 in [hi-mcp-behaviour.md](../../docs/hi-mcp-behaviour.md#architecture))
> **Jira**: follow-up of [RML-18044](https://roomle.atlassian.net/browse/RML-18044)

## Problem

One tool call puts one or several steps on the planner's undo history, and the command tools
resolve before their last reload:

- `create-or-replace-groups` makes one step for the load and one per group-wide attribute (D36).
  The planner's own undo button reverts such a call piecewise: a kitchen with a material takes two
  clicks, and the first leaves the kitchen without its material.
- `change-module-attribute`, `change-group-attribute`, `exchange-root-module`,
  `insert-article-into-group`, `swap-root-modules` and a `remove-article-from-group` that closed the
  gap resolve after their own load, but the kernel answers that load with the group's position
  (`respondWithPositionInPlan`, roomle-ui `roomle-planner.ts:2657`), and roomle-ui reloads the group
  once more — a second history event that joins the step, before or after the command resolves.
  On the roomle-ui dev server this follow-up lands about 3 s after the command (cause unknown); on
  the deployed planner it lands within the result.

The server works around both: it counts the steps of every tool call (`countingPlannerApi`,
`hi-mcp/hi-mcp-server/tool-executors.ts:2585`), waits up to 2 s for the follow-up of the commands in
`FOLLOW_UP_COMMANDS` (`:2547`, `FOLLOW_UP_WAIT_MS` `:2559`), records a call whose follow-up has not
arrived as unsettled, and withholds `undo` until it lands. The step count and the list of follow-up
commands are roomle-ui behaviour copied into the server.

## Cause

An HI load with a reason other than `load`, `plan_changed`, `position_changed`, `split`,
`swap_group` or `merge_with_dragging` starts a new step: `manageExternalObjectLoadingStart` →
`_hold` without `resume` commits any open or held step first (roomle-ui
`packages/web-sdk/packages/planner-core/src/services/plan-interaction-manager.ts:320`, `:351`), so an
HI load never joins an enclosing step. `expectContinuation` and `onCoreLoad` (`:481`, `:485`) are
made for the follow-up reload, and nothing calls them.

## To do

In roomle-ui:

1. `externalObjectGroupOperation` resolves after the command's follow-up reload
   (`expectContinuation` / `onCoreLoad`).
2. A begin and an end method on `RoomlePlanner` that group a tool call into one step: HI loads
   between them resume the held step instead of committing it.

Then in the server: drop the follow-up wait (1), and set the steps of every tool call to one (2) —
the page allow-lists gain the two methods by explicit decision (D2).

## Test

- roomle-ui: a `change-group-attribute` command resolves after its follow-up reload; a load and a
  `change-group-attribute` between the begin and the end method are undone by one `undo()`.
- hi-mcp `tests/tool-executors.test.ts`, `describe('undo and redo')`: the follow-up tests become
  tests of one step per call.

Constraints: the undo history is shared with the user, and a plan load clears it without an event;
the anchor probe undoes its own load, which must stay outside the grouped step.

**Reproduce.** Default Room (`ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv`): `create-or-replace-groups` of a
row with `mod_FrontColor` in the group's `attributes`, then the planner's undo button — the first
click takes only the colour back. Three Tall Units (`ps_qply732i7knwtkfjm1z86sa8vrt00ms`) against the
roomle-ui dev server: `insert-article-into-group` returns after about 3.6 s, the server waiting for
the follow-up reload.
