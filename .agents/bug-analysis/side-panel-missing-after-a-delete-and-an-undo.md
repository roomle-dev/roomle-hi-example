# Bug analysis — a side panel the agent sent is missing from the plan

> **Type**: Bug analysis
> **Status**: Open
> **Date**: 2026-10-22
> **Base**: roomle-hi-example `docs/analyse-the-element-type-attribute-for-the-agent` (`de5013b`);
> roomle-ui `release/bo-test` (`5f8dd1031`, the planner of the replay); RoomleCore `master`
> (`f4e9eab5d`, read only)
> **Backlog**: [item 101](../backlog/mcp-issues.md#101-a-side-panel-the-agent-sent-is-missing-from-the-plan-without-a-report)

## Affected repositories

- **RoomleCore**: the remaining fix. When the planner deletes a root module, it splits the group by
  the docking of the group, not only by docking vectors that touch geometrically
  (`splitManipulatedGroupIntoAssemblies`, `external-module-group-dock-configurator.cpp:724`). A unit
  that hangs above another unit then stays in its group. The RoomleCore team confirms first that the
  geometric split is not intended.
- **roomle-ui**: unchanged. The undo that reverted nothing is the defect of D101, fixed by
  `9ba1fc010` and on `release/bo-test` since `7798ed8d8`.
- **roomle-hi-example**: backlog item 101 names this analysis and the remaining work.
- **ligna-store, embedding-lib**: unchanged.

## Symptom and reproduction

**The run.** `mcp-test-2026-10-22_07-57-33`, gpt-6-astra 06 (`kitchen-family-two-kids`). It started
at 08:02 (+0200) on bo-test, with plan `ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv`. The agent's calls, from
`planner-calls.json` and `console.log`:

| # | Call | What the run records |
|---|---|---|
| 1 | `create-or-replace-groups` | an L-shaped kitchen on the right wall; corrections only |
| 2 | `undo` | reverts the create (a planner `undo`, four planner calls) |
| 3 | `create-or-replace-groups` | the same kitchen on the left wall: one group of 16 roots, among them `cupspanel` `W35O` `leftOf` the wall cabinet `cups` `O2TB90`; corrections only, no `notLoaded` |
| 4 | `get-plan-context` (obstacles), `get-plan-images` | — |
| 5 | `delete-article-in-place` `b2646c89` | 2122 ms |
| 6 | `undo` | 17 ms, one plan-context read (`call 17`), **no planner `undo`** |
| 7 | `merge-groups` | target `556610f7`, merging in `1bfb849a` and `ed5ce3aa` |

The final plan has one group, `556610f7`, with 15 article roots: every root of the second create
except `W35O`. The agent's answer names no side panel.

**The replay, without a model.** `.temp/replay-101.mjs` is git-ignored and kept locally. It ran with
`EXAMPLE_PORT=3001 node minimal-hi-example/start.mjs --no-open` on the run's plan against bo-test,
through `window.instance.extended.callExternalObjectAgentTool`. It replays calls 1, 2 and 3, then
deletes one root module in place and calls `undo`. After each call it reads the groups.

| Root module deleted | Groups after the delete | `undo` |
|---|---|---|
| `W35O`, the panel | 3: the 13 floor roots with the worktop and toe kick; the hood `DU` alone; the wall cabinet `O2TB90` alone | `undone: delete-article-in-place`; one group of 18 roots with `W35O` |
| `W60U`, the end panel of the left leg, far from the units above | 4: the 12 floor roots with the worktop and toe kick; `DU`, `W35O` and `O2TB90`, each alone | `undone: delete-article-in-place`; one group of 18 roots |

The second create builds the panel: its root is in the group (`e152cc57 W35O` in the first replay).

## Investigation trace

### 1. The create built the panel, and the agent deleted it

- **The replay builds `W35O`** with the run's arguments, and the run's create reported nothing as
  not built.
- **The run keeps the root ids from the create to the end.** The create's correction names
  `59c840e6` (`O2TB90`), and the final plan holds `59c840e6 O2TB90`.
- **The deleted root is the panel.** The id the agent deleted, `b2646c89`, is not in the final plan.
  The only article of the create missing from the final plan is `W35O`. A deleted root that was not
  `W35O` would leave the final plan short of a second article.
- **Deleting `W35O` in the replay gives the run's three groups:** the floor units, the hood and the
  wall cabinet. The agent then merged exactly three groups.

So the panel left the plan through the agent's own `delete-article-in-place`. The agent decided this
after looking at `get-plan-images`; the run does not record why.

### 2. The undo reverted nothing: the defect of D101

The undo took 17 ms and made one plan-context read and no planner `undo`. That is the path of
`revertToolCall` (roomle-ui `hi-mcp/tool-executors.ts`) that finds no tool call to revert: it reads
the groups once and answers with `undone: null` and a hint. The run's log does not show the hint,
because the feedback line carries only `corrections` and `notLoaded`.

The delete split one group into three, so its step reloaded three groups at once. For such a reload
the kernel reports `externalObjectPlanChanged` for every group at the end of the interaction. The
history events of those reloads arrived after the delete had answered, and the tool set took them
for a change in the planner. The undo therefore refused to revert the delete. This is the defect the
analysis of backlog item 102 reproduced with a splitting delete. D101 of
[`.agents/context/hi-mcp-behaviour.md`](../context/hi-mcp-behaviour.md#3-decisions) describes its
fix: the planner keeps those reloads in the call's step and answers after them (roomle-ui
`9ba1fc010`, 11:24).

The fix reached `release/bo-test` with `7798ed8d8` at 11:30, after the run had started at 08:02. In
the replay against today's bo-test, the same undo reverts the delete and brings the panel back
(table above).

### 3. The agent merged the groups back without the panel

After the failed undo, the plan held three groups: the floor units, the hood and the wall cabinet.
The agent merged them back into one (`merge-groups`) but did not send the panel again. The tool
results named every step:

- the delete's result listed three groups;
- the undo answered that it had reverted nothing.

So the panel was not dropped without a report. It left the plan through the agent's delete, and the
undo that should have brought it back failed with a hint. With the fix of D101, the undo restores the
panel and the single group.

### 4. Why a delete splits off the units above

The delete of a side panel, or of an end panel at the other end of the kitchen, splits off every
unit that hangs above the floor units. The group's docking (`contextData`, read in the replay after
the second create) hangs them on the floor units:

- `DU`: `LeftBottom` → `UKS2A90.LeftTop` (the hood above the hob unit);
- `O2TB90`: `LeftBottom` → `US2A90.LeftTop`, and `LeftBottom` → `W35O.RightBottom`;
- `W35O`: `LeftBottom` → `UERTB90.LeftTop`, and `RightBottom` → `O2TB90.LeftBottom`.

After the delete of `W35O`, `DU` and `O2TB90` have no docking at all. The hood's docking to the hob
unit is gone, although it has nothing to do with the panel.

**The planner leaves the split to RoomleCore.** roomle-ui's `deleteRootModule` (`glue-logic.ts:1265`)
receives the remaining group and the split-off groups from the kernel callback
`_externalObjectComponentDeleted` (`planner-kernel-access.ts:1494`). It removes the docking to the
deleted root, splits off the groups it is given (`_splitOffGroupsFromGroups`) and reloads them.

**RoomleCore computes the split from geometry.** The delete operator
(`ConfigurableObjectDeleteChildOperator::tryDeleteChildObject`,
`configurable-object-delete-child-operator.cpp:33`) asks the dock configurator for the groups:

1. `ModuleGroupDockConfigurator::tryDeleteChild`
   (`external-module-group-dock-configurator.cpp:166`) erases the root module from the group
   structure: from its root modules and from the `contextData` docking
   (`eraseRootModulesFromGroup`, `:698`).
2. `splitManipulatedGroupIntoAssemblies` (`:724`) does not read that `contextData`. It takes the
   docking vectors of the group's calculated geometry (`getDockVectorsOfManipulatedModules`, `:737`,
   with `calculateObjectDockingVectors(false)`). It then forms assemblies of the root modules whose
   vectors are connected (`findRootModuleAssembliesByAnalyzingAdjacentDockingVectors`, `:803`).
3. `findDockingVectorPairs` (`external-module-group-docking-vectors.cpp:178`) connects two vectors
   only when `getDockingVectorAlignment` finds them `docked` (`:202`), that is, lying on each other.

A unit that hangs above a floor unit has a gap between its bottom vector and the floor unit's top
vector. The group docks it with an offset for that gap, but the geometry gives no connection, so it
becomes an assembly of its own. The panel and the wall cabinet beside it have no geometric
connection either, although the group docks them side by side.

This contradicts what the tools state:

- `delete-article-in-place` splits off "root modules no longer docked together"
  ([§6 of the behaviour reference](../context/hi-mcp-behaviour.md#6-tools));
- D42: units above follow the unit they hang from.

It also hits the planner's own delete: a user who deletes a base unit in the planner gets the wall
units split off the same way.

## Root cause

**The panel is missing** because the undo of the agent's delete reverted nothing. That is the defect
of D101: the history events of a reload of several groups arrived after the call, and the tool set
took them for a change in the planner (`revertToolCall`, roomle-ui `hi-mcp/tool-executors.ts`). It
is fixed in roomle-ui `9ba1fc010`, which the run's bo-test did not carry yet.

**The delete split the group**, which is what made the agent undo it.
`ModuleGroupDockConfigurator::splitManipulatedGroupIntoAssemblies`
(RoomleCore `external-module-group-dock-configurator.cpp:724`) splits the remaining root modules by
docking vectors that touch geometrically (`findDockingVectorPairs`,
`external-module-group-docking-vectors.cpp:202`). It ignores the group's docking (`contextData`),
which `tryDeleteChild` has just updated (`:166`, `:698`). Every unit docked with an offset, such as a
wall unit or hood hanging above a floor unit, becomes a group of its own after any delete in place.

## Proposed fix

1. **The missing panel: no new code.** D101 fixes the undo. The replay against today's bo-test shows
   the undo reverting the delete and the panel back in the single group.
2. **The split: RoomleCore.** `splitManipulatedGroupIntoAssemblies` also joins the root modules that
   the manipulated group's `contextData` docks together. That is the docking `tryDeleteChild` keeps
   after it erased the deleted root. A delete then splits a group only where it breaks the docking:
   a hood stays with its hob unit, and the wall units stay with the floor units they hang from. The
   RoomleCore team confirms first that the geometric split is not intended, since the change also
   applies to the planner's own delete.

## Unit tests

- **RoomleCore**: a test of `ModuleGroupDockConfigurator::tryDeleteChild` with a group of two floor
  units, a wall unit docked above one of them with an offset, and an end panel. Deleting the end
  panel returns one assembly that holds the wall unit. Deleting the floor unit the wall unit hangs
  from splits it off.
- **roomle-ui**: none. The undo of a splitting delete is guarded by the tests of D101.

## Alternatives considered

- **Rejoin the split-off groups in roomle-ui** (`deleteRootModule`, `glue-logic.ts:1265`): merge each
  split-off group back when the original group's `contextData` docks it to the remaining group.
  Rejected: the glue would undo a decision of the kernel in a second reload. The split would have
  two sources of truth, and the kernel's report would stay wrong for every other consumer.
- **A hint in the result of `delete-article-in-place`** that names the units split off. Rejected as
  the fix: the result already lists the groups, and a hint describes the split instead of keeping
  the units where they hang.
