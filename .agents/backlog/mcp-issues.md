# Open MCP issues

> **Type**: Backlog — defects and hardening in the MCP server, chat and planner
> **Domain**: hi-mcp — the served text (`hi-mcp/hi-mcp-server/hi-mcp-server.ts`), the forward of
> the plan-changing tools (`tool-executors.ts`), the chat (`hi-mcp/hi-mcp-chat`); roomle-ui — the HI
> tool commands (`hi-tool-commands.ts`, `hi-group-layout.ts`, `hi-group-placement.ts`,
> `hi-wall-placement.ts`, `hi-tool-hints.ts`) and the defects the runs show
> **Maintained by**: step 7 of [the testing skill](../skills/hi-mcp-testing.md#7-open-issues)

These are issues in the MCP server, chat or planner detected by the MCP prompt tests.

Each issue names the problem, its cause, the to-do, the test of the fix and how to reproduce it; the
overview names the module, team or repository responsible for the fix, and the model and the
reasoning effort of the run that reproduces it — empty where it is unknown; a model the chat sends
no effort for runs at its provider's default. Library data issues are tracked in
[library-issues.md](library-issues.md). An issue leaves this document when its fix is in the code.
The guideline for every server issue is
[Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort): wrong content an agent creates
is an instruction problem first; correct where the intent is clear, report what was corrected, and
never drop the agent's content silently.

## Overview

| # | Issue | Kind | Responsible | Priority | Model | Reasoning effort |
|---|---|---|---|---|---|---|
| 74 | [An island's back row of other widths lands off the front row](#74-an-islands-back-row-of-other-widths-lands-off-the-front-row) | hardening | analysed: roomle-hi-example served text (`hi-mcp-server.ts`, `behind`) — the description says neither where a turned unit lines up with a wider neighbour nor which way the relations run in a turned row; roomle-ui `pairOf` for `behind` (`hi-group-layout.ts`) — the compile pins the turned unit at the neighbour's left end with offset 0 and no field to name the other end. Fix proposed in [the analysis](../bug-analysis/islands-back-row-of-other-widths-lands-off-the-front-row.md): the served text first, the `align` the server derives the offset from along the neighbour's width axis as the fallback, to be based on roomle-ui `fix/room-corners-at-openings` | low | gpt-6.1-sol | |
| 78 | [A swap of a widened unit is refused for want of a docking vector](#78-a-swap-of-a-widened-unit-is-refused-for-want-of-a-docking-vector) | defect | analysed: roomle-ui `modifyAttributesOfModules` and `_takeOverPropertiesFromOriginalGroup` (`glue-logic.ts:2650,3287`) — the recalculation behind `change-module-attribute` returns the width-changed root without its dockInfos and the take-over restores every root property but them; the swap's `handOver` (`hi-tools.ts:954-972`) then drops the side docking with the correction at :967. Fix proposed in [the analysis](../bug-analysis/swap-of-widened-unit-refused-for-want-of-docking-vector.md): the take-over keeps the original root's dockInfos with the points recomputed from the calculated geometry, to be based on roomle-ui `fix/room-corners-at-openings` | medium | gpt-6-astra | |

`run.json` and `planner-calls.json` of the run directories named under **Reproduce** hold the payload
the model sent; the directories are under `.temp/result/`.

## 74. An island's back row of other widths lands off the front row

**Problem.** For an island with a front row of 900, 600 and 900 mm units and a back row of four
600 mm units, the agent docks the first back unit `behind` the 900 mm unit at the end of the front
row and the others `rightOf` it. The back row lines up with the inner end of that unit and runs past
the far end of the front row: 300 mm off at both ends, a step in the worktop.

**Cause.** Analysed in [the bug analysis](../bug-analysis/islands-back-row-of-other-widths-lands-off-the-front-row.md).
The served description of `behind` ("back to back with that root module, turned by 180 degrees (an
island)", `hi-mcp-server.ts`) says neither where a turned unit lines up with a wider neighbour nor
which way `rightOf` runs in the turned row, and the compile (`pairOf` for `behind`,
`hi-group-layout.ts`) pins the turned unit at the neighbour's left end, seen from the neighbour's
front, with offset 0 and no field to name the other end (`align` is read for every relation but
ignored for `behind`, `gapMm` is ignored, G37). The agent's natural composition — the first back unit
behind the row's end unit, the back row continuing `rightOf` — then lands the back row off the front
row by the width difference at both ends; the mirror composition (behind the row's first unit,
continuing `leftOf`) lands flush, which the other stored runs show.

**To do.** Fix, proposed in [the analysis](../bug-analysis/islands-back-row-of-other-widths-lands-off-the-front-row.md),
in roomle-hi-example first: clarify the description of `behind` (`hi-mcp-server.ts`) — where a turned
unit lines up and which way the relations run in a turned row, in library-neutral words, with the
composition that lines a back row up with the row in front of it. If that does not suffice, simplify
the API in roomle-ui `pairOf` (`hi-group-layout.ts`, based on `fix/room-corners-at-openings`): the
server lines up a unit `behind` a wider one at the end the agent names (`align`) and derives the
offset from the catalog widths along the neighbour's width axis in the group's frame.

**Test.** `image-planning-right-wall`: the island's two rows end flush at both ends.

**Reproduce.** `mcp-test-2026-10-16_19-30-19`: gpt-6.1-sol 48 (`image-planning-right-wall`, the second `create-or-replace-groups`, the island group): `rear1` (`EUTB60`) `behind` `islandright` (`EUS2A90`), `rear2` to `rear4` `rightOf`; back row z -3240 to -840 against the front row z -2940 to -540.

## 78. A swap of a widened unit is refused for want of a docking vector

**Problem.** `change-module-attribute` `mod_Width` 900 on the last `HTB60` of the three-tall-units
row leaves the recalculated root module without docking vectors (`dockingVectors: []` in
`get-plan-context`); the following `swap-root-modules` drops the docking ("'8774cac2…' has no docking
vector 'RightBottom' - its docking to 'a7271f1b…' was dropped") and does not apply; the model undoes
it and the plan keeps the original order. In `mcp-test-2026-10-17_18-40-40` (gpt-5-mini 32) the same
defect also removed the unit's front and left two overlapping units. The same article at width 900
has its six docking vectors when created (`edit-replace-unit-wider`) or when the row's first unit's
width is changed (`edit-change-one-unit`), and the same two calls kept the vectors in
`mcp-test-2026-10-17_13-28-41` (gpt-6-astra 32) — not every time.

**Cause.** Analysed in [the bug analysis](../bug-analysis/swap-of-widened-unit-refused-for-want-of-docking-vector.md).
The recalculation behind `change-module-attribute` (`changeAttributes`, `hi-tools.ts:456` →
`modifyAttributesOfModules`, `glue-logic.ts:2650` → `_takeOverPropertiesFromOriginalGroup`,
`glue-logic.ts:3287`) returns the width-changed root module without its dockInfos — the take-over
restores position, rotation, contextData and article info but not the dockInfos — and the swap's
`handOver` (`hi-tools.ts:954-972`) drops the side docking where the new owner has no matching vector
(the correction at :967). Where exactly the dockInfos are dropped (the library's calc.js or a step
between the calc and the store) is the analysis' open question; the roomle-ui fix stands regardless.

**To do.** Fix, proposed in [the analysis](../bug-analysis/swap-of-widened-unit-refused-for-want-of-docking-vector.md),
in roomle-ui `_takeOverPropertiesFromOriginalGroup` (`glue-logic.ts:3287`, based on
`fix/room-corners-at-openings`): keep the original root's dockInfos across the recalculation when
the calculated root has none, with the start/end points recomputed from the calculated root's
geometry. The swap then applies without a correction.

**Test.** `edit-swap-units`: after `change-module-attribute` `mod_Width` 900 on the last unit, the
widened root keeps its six docking vectors and `swap-root-modules` swaps without a correction — the
row is 2100 mm with the 900 mm unit in the back corner; a unit test in roomle-ui
`__tests__/hi-tool-commands/`.

**Reproduce.** `mcp-test-2026-10-18_14-48-28`: gpt-6-astra 32 (`edit-swap-units`, turn 2):
`change-module-attribute` `mod_Width` 900 on `8774cac2-8b83-405d-b88c-f0e5cd2452fb`, then
`swap-root-modules` on `0010443c-519a-437b-8fe5-364f13887ca4` and `8774cac2…`; the correction
"'8774cac2…' has no docking vector 'RightBottom' - its docking to 'a7271f1b…' was dropped";
`dockingVectors: []` of `8774cac2` in `plan-context.json`.
