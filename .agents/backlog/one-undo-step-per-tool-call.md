# Backlog: one planner undo step per tool call

> **Type**: Backlog item (roomle-ui; removes a workaround in the MCP server)
> **Responsible**: roomle-ui `planner-core` and hi-mcp history accounting
> **Domain**: roomle-ui `planner-core` — the undo step machinery (`plan-interaction-manager.ts`) and `externalObjectGroupOperation`; consumer: the hi-mcp `undo` and `redo` tools (D37, D38 in [hi-mcp-behaviour.md](../../docs/hi-mcp-behaviour.md#architecture))
> **Jira**: follow-up of [RML-18044](https://roomle.atlassian.net/browse/RML-18044)

## Problem

One tool call puts one or several steps on the planner's undo history, and the command tools
resolve before their last reload:

- `create-or-replace-groups` makes one step for the load, one for the reload of the groups placed by
  wall (D23) and one per group-wide attribute (D36).
  The planner's own undo button reverts such a call piecewise: a kitchen with a material takes two
  clicks, and the first leaves the kitchen without its material.
- `change-module-attribute`, `change-group-attribute`, `exchange-root-module`,
  `insert-article-into-group`, `swap-root-modules` and a `delete-article-and-compact` that closed the
  gap resolve after their own load, but the kernel answers that load with the group's position
  (`respondWithPositionInPlan`, roomle-ui `roomle-planner.ts:2657`), and roomle-ui reloads the group
  once more — a second history event that joins the step, before or after the command resolves.

The server works around both: it counts the steps of every tool call (`countingPlannerApi`,
`hi-mcp/hi-mcp-server/tool-executors.ts:4106`), waits up to 2 s for the follow-up of the commands in
`FOLLOW_UP_COMMANDS` (`:4067`, `FOLLOW_UP_WAIT_MS` `:4080`), records a call whose follow-up has not
arrived as unsettled, and withholds `undo` until it lands. The step count and the list of follow-up
commands are roomle-ui behaviour copied into the server.

An applied front-colour change can remain unsettled through repeated `undo` calls: each waits
2 s and returns without calling the planner's `undo`, leaving the changed fronts in place.
`countingPlannerApi` expects two history events when a command emits any (`:4146`), and
`revertToolCall` withholds undo while the expected events are missing (`:4320`). The saved run does
not record history event counts, so whether the planner omits the follow-up or the server counts
an event that this command does not need remains to be diagnosed.

## Cause

An HI load with a reason other than `load`, `plan_changed`, `position_changed`, `split`,
`swap_group` or `merge_with_dragging` starts a new step: `manageExternalObjectLoadingStart` →
`_hold` without `resume` commits any open or held step first (roomle-ui
`packages/web-sdk/packages/planner-core/src/services/plan-interaction-manager.ts:320`, `:351`), so an
HI load never joins an enclosing step. `expectContinuation` and `onCoreLoad` (`:481`, `:485`) are
made for the follow-up reload, and nothing calls them.

## To do

In roomle-ui:

1. Trace the history events and completion of the sideboard colour command below, together with
   the server's expected event count. A completed command must settle; undo must still wait for
   an actual pending reload and respect intervening user changes.
2. `externalObjectGroupOperation` resolves after the command's follow-up reload
   (`expectContinuation` / `onCoreLoad`).
3. A begin and an end method on `RoomlePlanner` that group a tool call into one step: HI loads
   between them resume the held step instead of committing it.

Then in the server: align its completion accounting with the planner (1), drop the follow-up wait
(2), and set the steps of every tool call to one (3) —
the page allow-lists gain the two methods by explicit decision (D2).

## Test

- roomle-ui: a `change-group-attribute` command resolves after its follow-up reload; a load and a
  `change-group-attribute` between the begin and the end method are undone by one `undo()`.
- hi-mcp `tests/tool-executors.test.ts`, `describe('undo and redo')`: the follow-up tests become
  tests of one step per call.
- A sideboard colour change followed by undo restores every front's earlier colour without
  changing the group position or deleting the group; an actual delayed reload is awaited.

Constraints: the undo history is shared with the user, and a plan load clears it without an event;
the anchor probe undoes its own load, which must stay outside the grouped step.

**Reproduce.** `mcp-test-2026-10-11_11-41-48`: gpt-6-astra 53, turns 2–3 (`random-sideboard-attributes-and-undo`, bo-test): change the three fronts from 152 to 192, then undo; both undo calls leave all fronts at 192 and dispatch no planner undo.
