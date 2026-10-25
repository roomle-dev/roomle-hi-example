# A unit on top of a follower in another group stays behind when the row below moves

> **Type**: Bug analysis
> **Status**: Open
> **Date**: 2026-10-25
> **Base**: roomle-hi-example `master` (`dfb227d`); roomle-ui `feat/hi-mcp` (`8b8e40543`)
> **Backlog**: [mcp-issues.md #103](../backlog/mcp-issues.md#103-a-unit-on-top-of-a-follower-in-another-group-stays-behind-when-the-row-below-moves)

## Affected repositories

- **roomle-ui** (`feat/hi-mcp`) — `hi-root-module-arrangement.ts`:
  - `carriersOfUnitsInOtherGroups` also returns the units of other groups that stand on such a unit,
    each with the unit it stands on, however high the stack.
  - `groupsFollowingTheirCarriers` moves a unit whose carrier is such a unit by the move of its
    carrier, in whatever group the two are.
  - `hi-tools.ts`: only the comment of `UnitsOfOtherGroupsAbove.carriers`. The five row edits and
    `_moveUnitsOfOtherGroupsWithTheirCarriers` stay as they are.
  - Unit tests in `__tests__/hi-root-module-arrangement-test.ts` and `__tests__/hi-tools-test.ts`.
  - D42 in `.agents/homag-intelligence/hi-tools-behaviour.md`, the units-above paragraph of
    `.agents/homag-intelligence.md` and "Row edits" of `.agents/homag-intelligence/tool-executors.md`.
  - `glue-logic.ts`, `moveUnitsAboveWithTheirCarriers` and `hi-tool-hints.ts` stay unchanged.
- **roomle-hi-example** — this analysis and backlog item 103.
- **Library, embedding-lib, ligna-store** — unchanged. `createHiMcpTools` forwards the row edits as
  they are, so no new embedding-lib version is needed. The example page and the ligna-store get the
  fix with the planner.

The roomle-ui paths are relative to `packages/web-sdk/packages/homag-intelligence/src/` unless they
start with `__tests__/` or `.agents/`. The D-numbers are those of
[roomle-ui `hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md).

## Result

A row edit moves the units of other groups that stand above a root of the edited row (D42). It finds
them by room position and moves each by the move of its carrier. It looks only one level up: a unit
counts only when its carrier is a root of the edited row. A unit on top of such a unit has a carrier
in another group, so the edit leaves it out. Its carrier moves away and the unit on top stays where
it was.

Within the edited row the same stack moves as one: `moveUnitsAboveWithTheirCarriers` moves the units
above bottom-up, so a unit on top of a wall unit goes where the wall unit went. The units of other
groups lack that second level.

The agent's call is right, and the library and the kernel are not at fault. The tools move the units
of the other groups and leave this one out.

## Symptom

No test run shows it yet. The backlog item comes from reading the code. The replay below shows it on
the deployed planner.

A floor unit carries a wall unit of another group, and a unit stands on top of that wall unit, in the
wall unit's group or in a third group. An insert before the floor unit moves the floor unit and the
wall unit by the width of the new unit. The unit on top keeps its place and hangs beside the wall
unit, at the height of the wall unit's top. The hint names only the wall unit as moved.

## Reproduction

### In the planner

Model-free replay through `callExternalObjectAgentTool` in the example page, on the deployed bo-test
planner (`release/bo-test` `1d9adf51e`, pos space), plan `empty-room-with-water-connection`
(`ps_sau169slquuapnhdz3fdmc0u24eplrcf`). `hi-root-module-arrangement.ts` is the same on bo-test and
`feat/hi-mcp`, and `_moveUnitsOfOtherGroupsWithTheirCarriers` is the same code. The script, its
output and the plan images are in `.temp/result/repro-unit-on-top-of-follower-2026-10-25/`.

1. `create-or-replace-groups`: `US2A60` `a`, `US2A60` `b` `rightOf` `a`, placement
   `{ wall: back, alignment: left }`.
2. `create-or-replace-groups`: `OTB60` `w`, `ORFB60` `t` `onTop` `w`, placed by point at the back
   left bottom corner of `b`, 1400 mm high (`posGroup [-75, 1400, -3765]`, `posRotationY 0`).
3. `insert-article-into-group` of `US2A60` between `a` and `b`.

Room x of each unit's origin (pos space):

| Unit | Before the insert | After the insert |
|---|---|---|
| base unit `b` | −75 | 525 |
| wall unit `OTB60` (other group) | −75, height 1400 | 525 — moved within its group |
| open shelf unit `ORFB60` on top of it (same group as `OTB60`) | −75, height 2120 | **−75** — stays |

- **The result** returns both groups. Its hint is "the wall units and the range hood above the moved
  units moved with them ('…' (OTB60)) …" and names no `ORFB60`.
- **The wall unit group** now spans 1200 mm (footprint x −600 to 600). The `ORFB60` still carries the
  docking entry `LeftBottom → OTB60:LeftTop` with offset 0, though it stands 600 mm beside the
  `OTB60`.
- **With the `ORFB60` in a third group**, placed by point on top of the `OTB60`, the result is the
  same: the `OTB60` moves, the `ORFB60` stays, and its group is neither loaded nor returned.

The perspective images before and after the insert (`02-create-wall-unit-with-top.image-0.png`,
`03-insert.image-0.png`) show the open shelf unit hanging beside the wall unit it stood on.

### In the tools

A temporary vitest on `feat/hi-mcp` (`8b8e40543`), with the mocks of `__tests__/hi-tools-test.ts`.
It was run and then deleted. It used the free row of `describe('with units above in other groups')`
under the insert, `wall-2` above `root-2` in `group-2`, and `top-2` on top of `wall-2`:

- **`carriersOfUnitsInOtherGroups`** returns `{ 'wall-2': 'root-2' }`, with no `top-2`.
- **`insertArticleIntoGroup`** of a 900 mm root between `root-1` and `root-2` moves `root-2` and
  `wall-2` from x 1600 to 2500. `top-2` stays at x 1600. That holds with `top-2` in `group-2` and in a
  `group-3`, and `group-3` is not loaded.

The test `it('finds the units of other groups above roots of the group by room position')` of
`__tests__/hi-root-module-arrangement-test.ts` already builds this stack (`top-2` on `wall-2` in
`wall-row`). It expects `top-2` to be left out.

## Investigation

### How a row edit moves the units of other groups

Every row edit of `hi-tools.ts` takes the same steps (D42): `mergeArticleIntoGroup` (`:849`),
`exchangeRootModule` (`:915`), `insertArticleIntoGroup` (`:1030`), `removeArticleFromGroup`
(`:1120`) and `swapRootModules` (`:1305`).

1. **Before the edit**, `_unitsOfOtherGroupsAbove` (`hi-tools.ts:1495-1508`) reads the other groups
   of the scene and calls `carriersOfUnitsInOtherGroups(group, others)`
   (`hi-root-module-arrangement.ts:364-378`). It puts the roots of the other groups into the edited
   group's space (`rootsInGroupSpace`, `:338-356`) and finds the carrier of every root by position
   (`carriersOfUnitsAbove`, `:144-175`): the highest root whose docking vectors end at or below the
   unit's bottom, with the unit's centre over it.
2. **The filter** (`:374-376`) keeps an entry only when the unit is not in the edited group and its
   carrier is: `!ownIds.has(unitId) && ownIds.has(carrierId)`.
3. **The edited group is arranged and loaded.** Within it,
   `moveUnitsAboveWithTheirCarriers` (`:219-318`) moves its units above bottom-up (`:241-250`), so
   its stacks move whole.
4. **`followersOf`** (`hi-tools.ts:101-110`) makes each entry a follower `{ carrierId, referenceId }`.
   The exchange and the delete name another carrier for some of them.
5. **`groupsFollowingTheirCarriers`** (`hi-root-module-arrangement.ts:396-457`) computes each
   follower's move from its carrier: `moveOf` (`:408-423`) looks the carrier up among the roots of
   the edited group after the edit (`rootsAfter`) and the reference among its roots before
   (`rootsBefore`). The move is the change of the carrier's room pose. Each moved unit gets its new
   pose in its own group's frame. A unit whose pose does not change is dropped (`:445`).
6. **`_moveUnitsOfOtherGroupsWithTheirCarriers`** (`hi-tools.ts:1516-1550`) sets those poses and
   loads each group with `arrangeAndLoad(otherItem, others[index], false, …)` (`:1542-1547`).

### Why the unit on top stays

- **Step 2 drops it.** For the replay, `carriersOfUnitsAbove` finds `ORFB60 → OTB60` and
  `OTB60 → b`. The filter keeps `OTB60 → b` and drops `ORFB60 → OTB60`, because the `OTB60` is not a
  root of the edited row. The comment of the function states it: "A unit on top of a unit of its own
  group is carried by that one and goes with its group."
- **Step 5 could not move it either.** `moveOf` looks the carrier up only among the roots of the
  edited group, so a follower whose carrier is in another group would get no move.
- **Step 6 does not take it along.** With `rearrange` false, `_calculateAndUpdateGroupMap`
  (`glue-logic.ts:2251-2280`) sets no pending arrangement. The library calculates the group with the
  positions the tools wrote, and neither `HiRootModuleArrangementOperator` nor
  `moveUnitsAboveWithTheirCarriers` runs on it (`glue-logic.ts:2298-2316`, `:3515-3549`). The
  docking entry of the unit on top does not move it: the kernel places the roots where the load puts
  them. The comment's "goes with its group" therefore holds only when the whole group moves, and
  here only the carrier moves within it.
- **The hint follows the planner.** `movedUnitsAboveHint` (`hi-tool-hints.ts:117-179`) compares every
  root of every group before and after the edit (`withRowHints`, `:245`). It names what moved, so it
  names the unit on top once the unit moves. It needs no change.

### Which edits and stacks are affected

- **All five row edits**: they share steps 1, 2, 5 and 6. The exchange and the delete name another
  carrier only for the units directly above the replaced or removed root. A unit on top of such a
  unit has no carrier of its own in the edit.
- **Every stack on a unit of another group**: a unit on top of a wall unit, a range hood, or a top
  unit on a tall unit of another group that stands on a root of the row. The stack can be in the
  carrier's group or in a third group, and it can be higher than two. The planner cannot tell the
  two groupings apart, and D42 finds carriers by position, whatever group each unit is in.
- **The overlap correction of `removeArticleFromGroup`** (`hi-tools.ts:1253-1277`) finds the units
  that moved in above the new carrier by following the carrier chain. That chain also ends at a unit
  of another group, so a unit on top that moved in is not checked either.

Not affected:

- **A stack within the edited row.** `moveUnitsAboveWithTheirCarriers` moves it bottom-up.
- **A unit of another group directly on a root of the row.** Step 2 keeps it.
- **A unit of the edited row on top of a unit of another group.** `carriersOfUnitsAbove` of the
  edited group finds its carrier among its own roots, the root below the unit of the other group,
  and moves it with that root.
- **An attribute change.** It moves the units above of the edited group only (D42).

Item 104 is a separate defect: a carrier that changes height at the same origin gives the units of
other groups no move. The fix below lets a unit on top take the move of its carrier, so a later fix of
104 that changes the carrier's move reaches the unit on top as well.

## Root cause

`carriersOfUnitsInOtherGroups` (`hi-root-module-arrangement.ts:374-376`) keeps a unit of another
group only when its carrier is a root of the edited group. `groupsFollowingTheirCarriers`
(`:408-423`) computes a move only from a carrier among the edited group's roots. A unit on top of a
unit of another group therefore never becomes a follower, and the load of its group without
arrangement (`hi-tools.ts:1542-1547`) keeps it where it was.

D42 requires the stack to move whole — "a wall unit, a range hood or a unit on top moves with the unit
below it" — and the edited row does it bottom-up. For the units of other groups the tools look only
one level up.

## Proposed fix

The server can move the unit itself, so no correction, guard or new hint is needed. This is step 2 of
[Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort): the server derives the
position. The fix is in two functions of `hi-root-module-arrangement.ts` that only the tools call.
`glue-logic.ts` imports `moveUnitsAboveWithTheirCarriers` from that module and nothing of this fix
(D110).

1. **`carriersOfUnitsInOtherGroups` follows the carrier chain.** It keeps a unit of another group
   whose chain of carriers reaches a root of the edited group, each unit with its own carrier: the
   `OTB60` with `b`, the `ORFB60` with the `OTB60`. The chain ends because a carrier always stands
   lower than its unit. The loop is the one `removeArticleFromGroup` uses for its overlap
   (`hi-tools.ts:1253-1259`). A stack that does not reach the edited group stays out.
2. **`groupsFollowingTheirCarriers` resolves the moves bottom-up.** A follower whose carrier is itself
   a follower (`followers.has(carrierId)`) takes the move it computed for that carrier. Every other
   follower keeps `moveOf`. A carrier without a move — gone, or turned against the root it stood above
   — gives its units on top none either, so they stay with it. The move is stored per unit, so the
   order of `others` and of their roots does not matter.
3. **`UnitsOfOtherGroupsAbove.carriers`** (`hi-tools.ts:96-97`) gets the new comment: a unit and the
   root it stands on, a root of the edited group or a unit of another group that stands on one.

What follows unchanged:

- **The row edits.** `followersOf` turns the new entries into followers with the carrier as their
  reference. The overrides of the exchange and the delete still name only the units directly above
  the replaced or removed root.
- **The loads.** `_moveUnitsOfOtherGroupsWithTheirCarriers` loads every group with a moved unit and
  returns it in `groupIds`, now also a third group with only the unit on top.
- **The overlap.** `removeArticleFromGroup` merges the entries into its `carriers`, so its overlap
  check also sees a unit on top that moved in above the new carrier.
- **The hint.** It names the moved unit on top beside the wall unit.

## Alternatives considered

- **Load the follower group with its arrangement** (`arrangeAndLoad(…, true, …)`), so that
  `moveUnitsAboveWithTheirCarriers` takes the unit on top along within the group — rejected. The
  arrangement re-docks the group and keeps its side at a wall, which can move the follower back or
  move other units of the group. It also never reaches a unit on top in a third group.
- **Call `moveUnitsAboveWithTheirCarriers` on each follower group after setting the follower poses**
  — rejected. It moves a stack within one group only, a unit on top in a third group stays, and the
  overlap check of `removeArticleFromGroup` would still miss the unit on top.
- **Move every group with a follower as a whole** — rejected by D42: a wall row over both legs of a
  corner goes to the wrong place.
- **Change `glue-logic.ts`** — rejected by D110. The fix lives in the tools.
- **A hint that names the unit on top as left behind** — rejected. The server can move it itself, and
  the agent could only repeat the edit on the wall row.

## Tests

- `__tests__/hi-root-module-arrangement-test.ts`, `describe('in other groups')`:
  - `it('finds the units of other groups above roots of the group by room position')`: the expected
    map becomes `{ 'wall-2': 'base-2', 'top-2': 'wall-2', 'wall-3': 'base-1' }`. That is the intended
    change of an existing test. A unit on top of `wall-9`, added to `elsewhere`, stays out of the
    map.
  - `it('moves a unit on top of a unit of another group with it, in the unit's group and in a third group')`:
    `base-2` moved by 600 moves `wall-2` and `top-2` by 600, with `top-2` in `wall-row` and in a
    group of its own.
  - `it('turns a unit on top with the unit of another group below it')`: `base-2` turned by 90
    turns `wall-2` and `top-2` about the same point.
  - `it('leaves a unit on top in place when the unit below it stays')`: a follower whose carrier is
    taken over turned (the `it.each` with 90) keeps the unit on top in place too.
- `__tests__/hi-tools-test.ts`, `describe('with units above in other groups')` under the insert:
  - `it('moves a unit on top of the unit of another group above a pushed root with it')`: the free
    row, `wall-2` and `top-2` in `group-2`, a 900 mm insert. `wall-2` and `top-2` move to x 2500.
    The second load is `group-2`, and `groupIds` is `['group-1', 'group-2']`.
  - `it('loads the group of a unit on top in a third group with it')`: `top-2` in `group-3`. Three
    loads, and `groupIds` is `['group-1', 'group-2', 'group-3']`.
- The existing tests named in D42 keep passing unchanged, among them every
  `describe('with units above in other groups')`, `describe('exchangeRootModule with units above in other groups')`
  and the `moveUnitsAboveWithTheirCarriers` tests.
- No prompt test: the agent's call is right, and the defect is the tools' move. The replay of
  `.temp/result/repro-unit-on-top-of-follower-2026-10-25/` with `--dev` against the local planner
  shows the `ORFB60` at x 525 and the hint naming both units.

## Documents

- roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md`, **D42**: "the planner finds the units
  of the other groups … that stand above a root of the edited row by room position" gains "and the
  units of other groups on top of those, bottom-up, whatever group each is in". The new tests join
  its list.
- roomle-ui `.agents/homag-intelligence.md`, the units-above paragraph: `carriersOfUnitsInOtherGroups`
  follows the carrier chain, and `groupsFollowingTheirCarriers` moves a unit on top by its carrier's
  move.
- roomle-ui `.agents/homag-intelligence/tool-executors.md`, "Row edits": the same sentence.
- roomle-hi-example `.agents/skills/hi-mcp-tools.md` stays as it is: "wall units of other groups move
  with the units below them, each within its group" holds for the stack too.
