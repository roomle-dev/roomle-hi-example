# Bug analysis — wall units in separate groups do not follow their edited carriers

> **Type**: Bug analysis
> **Status**: Open — reproduced without a model (roomle-ui unit test); fix proposed, not implemented;
> one decision for the user (see [Decisions](#decisions-for-the-user))
> **Date**: 2026-10-21
> **Base**: roomle-ui `feat/hi-mcp-improvements` (`b951d6f54`); roomle-hi-example `master` (`b99ddce`);
> the runs of 2026-10-20 on the bo-test planner
> **Backlog**: [item 89](../backlog/mcp-issues.md#89-wall-units-in-separate-groups-do-not-follow-their-edited-carriers)

## Affected repositories

- **roomle-ui** (`feat/hi-mcp-improvements`) — the HI tools of the planner. The step that moves
  the groups of units above with their carriers lives inside `removeArticleFromGroup` only
  (`packages/web-sdk/packages/homag-intelligence/src/hi-tools.ts:835-1029`); it becomes a step every
  row edit runs: `insertArticleIntoGroup` (`:762-831`), `swapRootModules` (`:1031-1129`),
  `exchangeRootModule` (`:695-729`) and `mergeArticleIntoGroup` (`:644-693`). With the decision
  below, `groupsFollowingTheirCarriers` (`hi-root-module-arrangement.ts:386-443`) moves the units of
  a group whose units go different ways within their group instead of keeping the group in place.
  The tests go in `homag-intelligence/__tests__/hi-tools-test.ts`,
  `hi-root-module-arrangement-test.ts` and `hi-tool-commands/group-commands-test.ts`; the
  paragraphs *Remove*, *Swap* and *Units above* of roomle-ui `.agents/homag-intelligence.md:199-202`
  are updated.
- **roomle-hi-example** — documentation only: D42 and D52 of `docs/hi-mcp-behaviour.md` §3, the
  command-tool rows of §6, C20 of §8.5, the tool rows of `docs/hi-mcp-server.md`,
  `.agents/context/tool-executors.md`, `.agents/skills/hi-mcp-tools.md` and the backlog. The served
  text (`packages/embedding-lib/src/homag-intelligence/hi-mcp/hi-mcp-server.ts` in roomle-ui) does
  not change: the rule and the tool descriptions promise the behaviour already. The fix runs in the
  planner (web-sdk), so it reaches the example and the ligna-store with the bo-test deployment. No
  embedding-lib pin.

ligna-store needs no change; it loads the same planner. The library needs no change.

## Symptom

Plan `corner-kitchen-wall-units` (`ps_s7hy5nqvtts37wl79u6q8tq67bc12s2`): the floor units are one
group, the range hood and the wall unit beside it a second group, the two wall units on the back
wall a third. After `swap-root-modules` of the hob and the sink, the two floor units change legs,
but the hood group stays on the right leg and the back-wall group stays over the sink's old place.
After `delete-article-and-compact` of the drawer unit next to the corner, the hob moves into the
gap and its hood stays where it was.

| Group | Units | Before | After the swap (`mcp-test-2026-10-20_19-13-28`, 34) |
|---|---|---|---|
| `031ee57a` | the floor units; the wall unit `5b754b36` above the drawer unit `b9bbab7e` | [4815, 0, −3765], 270° | unchanged; the hob `379fa7a9` goes from row 6 (right leg) to row 2 (back leg), the sink `31616143` from row 2 to row 6 |
| `afbe92eb` | the wall unit `4c722e3d` above the drawer unit `7cd04e00` next to the corner, the hood `a834858d` above the hob | [4815, 1480, −2604], 270° | **unchanged** |
| `85510a7e` | one wall unit above the sink, one above the base unit `46ce47e7` | [2953.91, 1480, −3764.81], 0° | **unchanged** |

The answer of both swap runs (gpt-6-astra, 12-45-30 and 19-13-28) says "The separate extractor
hood has not moved; it will need realigning above the hob." The served text promises otherwise:
the rule (`hi-mcp-server.ts:40`: "wall units and the range hood move with the root module they
hang from", for an insert, a delete that closes the gap, an exchange or a swap), the insert
description (`:778-779`) and the swap description (`:831-832`) say it without restricting it to the
edited group.

## Reproduction

The reproduction needs no model: a vitest test in roomle-ui `homag-intelligence/__tests__/`, with
the fixtures of `hi-tools-test.ts` — the free row `root-1`, `root-2`, `root-3` (600 mm each, group
`group-1` at [1000, 0, −2000]) and a second group `group-2` of one unit hung 1380 mm above one of
the roots, the kernel scene holding both (`inScene`).

| Edit | `group-2` hangs above | Expected `group-2` position | Result on `b951d6f54` |
|---|---|---|---|
| `swapRootModules('group-1', ['root-1', 'root-3'])` | `root-1`, at [1000, 1380, −2000] | [2200, 1380, −2000] — `root-1` moved to group x 1200 | **[1000, 1380, −2000]**, one load (`group-1`), `groupIds: ['group-1']` |
| `insertArticleIntoGroup('group-1', 900 mm article, ['root-1', 'root-2'])` | `root-2`, at [1600, 1380, −2000] | [2500, 1380, −2000] — `root-2` moved to group x 1500 | **[1600, 1380, −2000]**, one load, `groupIds: ['group-1']` |
| `removeArticleFromGroup('group-1', 'root-2')` (reference) | `root-3`, at [2200, 1380, −2000] | [1600, 1380, −2000] — `root-3` moved into the gap | [1600, 1380, −2000], two loads, `groupIds: ['group-1', 'group-2']` |

The arranged floor group is right in every case (after the swap `root-3` 0 / `root-2` 600 /
`root-1` 1200; after the insert `root-1` 0 / new 600 / `root-2` 1500 / `root-3` 2100): only the
other group is missing.

The runs: `mcp-test-2026-10-20_19-13-28` and `_12-45-30`, gpt-6-astra 34 (`edit-swap-hob-unit`)
and 32 (`edit-remove-next-to-corner`), both on the bo-test planner; the positions of the table
above are from their `plan-context.json`. In 12-45-30 the delete alone leaves the hood group in
place and the answer says "The separate upper row stayed in place, causing an overlap with the
moved wall cabinet and leaving the extractor hood out of alignment with the hob"; in 19-13-28 the
model follows the delete with a `place-group` of the hood group (`wall: right, alignment: top,
offsetMm: 561`). The run named by the backlog item (`mcp-test-2026-10-20_06-45-46`) is no longer
kept locally.

`edit-insert-below-wall-units` (31 in 19-13-28) passes: the insert between the hob and the drawer
unit next to the fridge pushes the units towards the fridge, whose wall unit `5b754b36` is in the
floor group; the hob and the drawer unit next to the corner keep their place, so no unit of another
group has to move on this plan. The test guards the same-group move only.

## Investigation trace

1. **The tool command** (`hi-tool-commands.ts:1286` insert, `:1337` swap) resolves the ids and
   forwards one `externalObjectGroupOperation`. `withRowHints` (`hi-tool-hints.ts:237`) reads every
   group of the scene before and after, and `movedUnitsAboveHint` (`:117`) names the upper roots of
   every group whose room pose changed — the hint already covers units of other groups the edit
   moved, as the test `it('names the units of another group that moved with the units below them')`
   in `hi-tool-commands/group-commands-test.ts:2145` guards.
2. **The swap** (`hi-tools.ts:1031-1129`) exchanges the bottom side links of the two roots, their
   `articlePos` and `rotationY`, and calls `arrangeAndLoad(groupItem, originalGroup, true,
   REARRANGED_ROW_LOAD)` (`:1120`) for the edited group. It returns `groupIds: [groupId]`. It never
   reads another group.
3. **The insert** (`:762-831`) docks the new root between the two and calls the same
   `arrangeAndLoad` (`:813`). It returns `groupIds: [groupId]`.
4. **The glue logic knows one group at a time.** `arrangeAndLoad` (`glue-logic.ts:2629`) runs
   `_runGroupCalculation` (`:2051`) and `_arrangeRootModulesAndCalculateIfChanged` (`:3257`): the
   arrangement moves the roots of the edited group, and `moveUnitsAboveWithTheirCarriers`
   (`hi-root-module-arrangement.ts:219`) takes the units above *of that group* with their
   carriers, found by `carriersOfUnitsAbove` (`:144`) among the roots of the one group.
5. **The delete is the only edit that looks beyond the group.** `removeArticleFromGroup`
   (`hi-tools.ts:835-1029`) reads the other groups of the scene (`_otherGroupsInScene`, `:1195`),
   finds their units above roots of the edited group by room position
   (`carriersOfUnitsInOtherGroups`, `hi-root-module-arrangement.ts:340`), arranges and loads the
   edited group, and then moves each group whose units' carriers moved the same way
   (`groupsFollowingTheirCarriers`, `:386`), loading it at its new position (`hi-tools.ts:974-1000`)
   and returning it in `groupIds`. A group whose units went different ways is kept and named in a
   correction (`:1000-1005`).
6. **The behaviour reference records the gap, the served text does not.** D42 of
   `docs/hi-mcp-behaviour.md` says "An insert and a swap move the units above of the edited group
   only", while the rule and the two descriptions (`hi-mcp-server.ts:40, 778-779, 831-832`) promise
   the move for every edit.
7. **Exchange and merge have the same gap.** `exchangeRootModule` (`hi-tools.ts:695`) runs
   `swapRootModuleWithAttributes` (`glue-logic.ts:2542`), which arranges and loads the group itself:
   an exchange with another width moves the other roots of the row, and the units above them in
   other groups stay. `mergeArticleIntoGroup` (`hi-tools.ts:644`) arranges and loads the group:
   when the new root docks on the side at a wall, the whole group moves away from the wall (D82)
   and the units above it in other groups stay.
8. **Even the delete's following would not move the hood of the corner kitchen.** Both other
   groups of the plan hold one unit above a swapped root and one above a root that stays: in
   `afbe92eb` the hood turns to the back leg with the hob while the wall unit above `7cd04e00`
   stays; in `85510a7e` the wall unit above the sink turns to the right leg while the one above
   `46ce47e7` stays. `groupsFollowingTheirCarriers` compares the poses of a group's units and keeps
   the group when they differ (`hi-root-module-arrangement.ts:428-436`), so with the delete's step
   alone the swap would answer with two kept groups, and the hood would still not follow the hob.
   The same rule explains the delete run: the wall unit above the removed drawer unit keeps its
   place because the hob carries the hood already (D42, `hi-tools.ts:888-913`), the hood would move
   with the hob, so the group is kept and the floor group's wall unit `5b754b36`, moving with
   `b9bbab7e` into the hob's old place, now hangs where the hood hangs. The overlap check of the
   kept unit (`unitsOverlapping`, `:957-973`) measures in the arranged group only, so it does not name a
   unit of another group.

## Root cause

`hi-tools.ts:813` (`insertArticleIntoGroup`) and `:1120` (`swapRootModules`): the insert and the
swap arrange and load the edited group alone. The lookup of the units of other groups that hang
from its roots and their move exist only inside `removeArticleFromGroup` (`:848-851`, `:883`,
`:974-1005`), so after an insert or a swap the planner moves the carriers and leaves every unit
above them that belongs to another group where it was. The glue logic cannot do it in the
arrangement: it arranges one group, and the move of another group is a load of that group.

A second cause keeps the hood of a corner kitchen in place even where the following runs: a group
whose units follow carriers that moved differently keeps its place as a whole
(`groupsFollowingTheirCarriers`, `hi-root-module-arrangement.ts:428-436`, D42). A hood beside a
wall unit, or a wall row above a corner, is such a group whenever one of its carriers moves and
another does not.

## Proposed fix

**1. One following step for every row edit** (roomle-ui `hi-tools.ts`). The code of
`removeArticleFromGroup` that reads the other groups before the edit (`:848-851`, `:883`) and moves
the following groups after the load (`:974-1005`, the `groupIds` of the result) becomes two private methods of
`HiToolsImplementation`: one that collects the other groups and the carriers of their units above
before the edit, one that moves the following groups after the edited group is loaded and returns
their ids and corrections. `insertArticleIntoGroup`, `swapRootModules`, `removeArticleFromGroup`,
`exchangeRootModule` and `mergeArticleIntoGroup` call them around their load. The exchange passes
the new root id as the carrier of the units above the replaced root (the `moduleIdMap` of its
load), as the delete passes the neighbour that moves into the gap. The results list the moved
groups beside the edited one, as the delete's does; the hint names their moved units already.

**2. A group whose units go different ways moves its units within the group** (roomle-ui
`hi-root-module-arrangement.ts`, the decision below). `groupsFollowingTheirCarriers` already
computes the new room pose of every unit; for a group whose poses agree it keeps returning the
group's new position, and for a group whose poses differ it returns each unit's new position and
rotation in the group's frame (the group transformation inverted, applied to the unit's new room
pose, as `carriersOfUnitsInOtherGroups` converts the other way). The caller sets them on the roots
and loads the group with `REARRANGED_ROW_LOAD` without arranging it, as it loads a moved group
today. A unit whose carrier is gone, or turned against the root it stood above, stays, as today.
The `kept` list and its correction go away. This is what `moveUnitsAboveWithTheirCarriers` does for
the units of the edited group: each unit goes with its own carrier, and wall units docked beside
each other part where their carriers part — the kernel links only vectors that touch, so the reload
drops the docking between them and the arrangement leaves them where they are (D42).

**3. The overlap of a kept unit is measured across groups.** The correction of a unit that keeps
its place because the neighbour moving in carries a unit already (`hi-tools.ts:957-973`) compares
docking boxes in the arranged group. After the following groups are loaded, it compares in room
space over the edited group and the moved groups, so the delete of the corner kitchen names the
hood that moved in above the kept wall unit, whichever group each is in.

With 1–3 the three plans of the backlog item come out as the served text says:

| Edit on `corner-kitchen-wall-units` | Result |
|---|---|
| swap hob and sink | the hood turns to the back leg above the hob, the wall unit beside it stays above `7cd04e00`; the wall unit above the sink turns to the right leg above the sink, the one above `46ce47e7` stays; both groups are returned, the hint names the two moved units |
| delete the drawer unit next to the corner and compact | the hob moves into the gap with its hood; the wall unit above the removed unit keeps its place (the hob carries the hood already) and the correction names the hood that now overlaps it; `5b754b36` moves with `b9bbab7e` into the hood's old place, clear |
| insert between the hob and the drawer unit next to the fridge | unchanged: no unit of another group hangs from a root that moves |

### Decisions for the user

The backlog item asks to decide what happens to a group whose units follow carriers that moved
differently. The options:

| Option | Outcome on the swap of the corner kitchen | Assessment |
|---|---|---|
| **Move its units within the group** (proposed) | the hood follows the hob to the back leg, the wall unit beside it stays; the group spans both legs, its two units no longer docked | the served promise holds for every unit; no group is created; the same thing the edited group does with its own units |
| Keep the group and name it (today's D42) | the hood stays on the right leg, the correction asks for `place-group` or a wall-row edit | a `place-group` of the group moves the wall unit beside the hood too, so the agent cannot repair it in one call; the served promise stays broken for every wall row of its own over more than one moving carrier |
| Split the group along its carriers | the hood becomes a group of its own on the back leg | rejected by D42: it creates groups the agent did not ask for |

A second scope question: the step covers the exchange and the merge as well (point 1), since each
is one more caller of the same two methods and the served rule names the exchange. A width change
by `change-module-attribute`, which moves the other roots of the row inside the glue logic's
attribute flow, stays out of this fix and is named in the backlog if wanted.

### Alternatives rejected

- **A served rule asking for a `place-group` after every row edit**, or that wall units go into
  the group of their floor units — rejected by D42: a group of wall units of its own is a valid
  plan, and the rules describe how to succeed, not how to repair the planner.
- **Following in the glue logic's arrangement** (`_arrangeRootModulesAndCalculateIfChanged`) for
  every flow — the arrangement handles one group synchronously; the move of another group is a
  load the tool performs, with its own planner step the tool set counts for undo (D71). The row
  edits of `hi-tools.ts` are the flows that move roots along the row.
- **Moving every following group as a whole by the move of one of its units** — rejected by D42:
  a wall row over both legs goes to the wrong place.

## Tests

roomle-ui:

- `__tests__/hi-tools-test.ts`, `describe('with units above in other groups')` under
  `insertArticleIntoGroup` and `swapRootModules`, with the fixtures of the delete's tests: the group
  above a pushed or swapped root follows it (the two cases of the reproduction, with two loads and
  both ids in `groupIds`); a group above a swapped root and a staying root moves the one unit within
  the group and keeps the other (`cornerKitchen`: the hood turns with the hob across the corner);
  the exchange with another width moves the group above a pushed root; the merge on the wall side
  moves the groups above the row with it.
- `__tests__/hi-root-module-arrangement-test.ts`, `describe('in other groups')`: a group whose units
  go different ways returns their positions in its frame; the test `it('keeps a group of units
  above both legs in place and names its units')` in `hi-tools-test.ts` becomes the test that the
  wall row over both legs of a removed corner article follows both legs.
- `__tests__/hi-tool-commands/group-commands-test.ts`: the result of `swap-root-modules` and
  `insert-article-into-group` returns the moved group beside the edited one and the hint names its
  units.

roomle-hi-example, `docs/test-prompts.json`: `edit-swap-hob-unit` — the hood hangs above the hob on
the back leg and the wall unit above the sink on the right leg, without a `place-group`;
`edit-remove-next-to-corner` — the hob moves into the gap with its hood, the wall unit above the
removed unit keeps its place and the answer names it; `edit-insert-below-wall-units` — unchanged.

## Documentation

- roomle-hi-example `docs/hi-mcp-behaviour.md`: D42 (every row edit moves the units above of other
  groups; a group whose units go different ways moves them within the group; the sentence "An
  insert and a swap move the units above of the edited group only" goes), D52 (the group of the
  units above both legs follows both legs), the command-tool rows of §6 for the insert, the
  exchange, the merge and the swap, C20 of §8.5 (the kept-group correction goes, the overlap
  correction names units of other groups), the D42 hint row.
- roomle-hi-example `docs/hi-mcp-server.md` (the tool rows), `.agents/context/tool-executors.md`
  (*Row edits*), `.agents/skills/hi-mcp-tools.md` (the `hint` bullet and the command bullets), the
  backlog item.
- roomle-ui `.agents/homag-intelligence.md:199-202`: the following step belongs to every row edit;
  the units of a group move individually.
