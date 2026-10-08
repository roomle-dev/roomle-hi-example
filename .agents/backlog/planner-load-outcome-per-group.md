# Backlog: the planner's load result per input group

> **Type**: Backlog item (roomle-ui contract; consumer: the hi-mcp server's `create-or-replace-groups`)
> **Domain**: roomle-ui `homag-intelligence` — `loadExternalObjectGroupLayout` (`external-object-api.ts`, `glue-logic.ts`); hi-mcp `tool-executors.ts`
> **Status**: Open — needs a roomle-ui contract change
> **Ticket**: [RML-18033](https://roomle.atlassian.net/browse/RML-18033)

---

## Problem

`create-or-replace-groups` reports in `notLoaded` only the groups the server excluded before the load
(D30). A group of the call that the planner itself does not build is not reported: after the load
the server checks only that the result is not empty (`tool-executors.ts:3664-3674`), and the call
reads as a success.

**Cause.** `loadExternalObjectGroupLayout` returns one `{ id }` per loaded plan object — the runtime
id, nothing that names the input group (`LoadExternalObjectGroupResult`, roomle-ui
`external-object-api.ts:149-151`). Counting the runtime ids does not tell which group is missing:
the planner splits groups and generates ids.

The server pairs the new groups of the plan with the input groups in order (`matchResultGroups`,
`tool-executors.ts:1690-1709`). A group the planner leaves out shifts that pairing, so the
group-wide attributes (G46), the remembered agent ids (G50) and the hint of a group at the place of
another go to the wrong group. The placement by wall (D23) moves no group when the number of new
groups differs from the call's (G60); a pairing by the planner's answer would let it place the
groups that were built.

A replace the library cannot calculate is the same gap: roomle-ui restores the previous group
(`_discardCalculation`, `glue-logic.ts:2836`) and returns it as loaded; the server tells it only by
comparing the articles before and after (`reportRevertedReplaces`, `tool-executors.ts:2029`, the
§8.3 row "kept its previous content" of
[hi-mcp-behaviour.md](../../docs/hi-mcp-behaviour.md#83-create-or-replace-groups)).

## To do

1. **roomle-ui**: the load result names per input group what happened — the input group id or index,
   the plan group id it became (or the ids, when split), and whether it was built, restored after a
   failed calculation, or left out with the reason.
2. **Server**: report a group left out in `notLoaded` with the planner's reason and what to send
   instead, pair the input groups with the result by that answer instead of by order, and read a
   restored replace from it.

## Test

- `it.fails('RML-18033: reports a group omitted by the planner in notLoaded')` in
  `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` becomes a regular test: two new groups, the
  planner builds one, `notLoaded` names the other.
- A call whose first group the planner leaves out sets the group-wide attributes on the second
  group's result.
- roomle-ui: the load result of a layout with a group the library cannot calculate names that group.

**Reproduce.** Not reproduced in a run; the `it.fails` test above shows it with a mock planner.
