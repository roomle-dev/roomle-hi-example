# A row with a worktop placed into a corner stands 10 mm off the wall

> **Type**: Bug analysis
> **Status**: Open
> **Date**: 2026-10-24
> **Base**: roomle-hi-example `master` (`a896576`); roomle-ui `feat/hi-mcp` (`0b681db1d`)
> **Backlog**: [mcp-issues.md #98](../backlog/mcp-issues.md#98-a-row-with-a-worktop-placed-into-a-corner-stands-10-mm-off-the-wall)

## Affected repositories

- **roomle-ui** (`feat/hi-mcp`) — `hi-tool-commands.ts`:
  - The create's wall placement (`placeAtWalls`) measures each group again after its reload, and
    places it once more by that measure when it does not stand as asked — as `place-group` does
    (D70).
  - The step of `place-group` that does this moves into a function both commands call.
  - Unit tests are in `__tests__/hi-tool-commands/create-or-replace-groups-placement-test.ts`;
    `__tests__/hi-tool-commands/place-group-test.ts` keeps passing unchanged.
  - D23 and D70, and the D70 row of §8, in `.agents/homag-intelligence/hi-tools-behaviour.md`;
    step 11 of `.agents/homag-intelligence/tool-executors.md`; the wall placement paragraph of
    `.agents/homag-intelligence/layout-and-placement.md`.
  - `glue-logic.ts`, `hi-wall-placement.ts` and `hi-plan-space.ts` stay unchanged.
- **roomle-hi-example** — this analysis, backlog item 98, the create's wall placement in
  `.agents/skills/hi-mcp-tools.md`, and a fixed prompt test in `docs/test-prompts.json`.
- **Library, embedding-lib, ligna-store** — unchanged. The library builds the row correctly for the
  place it gets. `createHiMcpTools` forwards the tool as it is, so no new embedding-lib version is
  needed.

The roomle-ui paths are relative to `packages/web-sdk/packages/homag-intelligence/src/` unless they
start with `__tests__/` or `.agents/`. The D-, G- and C-numbers are those of
[roomle-ui `hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md).

## Result

The create places a new row by the footprint the row has where the planner first put it. There it
stands free, and the library gives the worktop a 10 mm overhang at both ends. The placement puts
that overhang against the back wall, so the first carcass starts 10 mm from the wall.

At the new place the library builds the row for that place. An end at a wall gets no overhang and
no visible side, so the worktop now ends flush with the first carcass, 10 mm from the wall. The
create reloads only once and does not measure the row again.

`place-group` measures a group again after its reload and places it once more when it does not
stand as asked (D70). With the same row and the same placement, `place-group` puts it at the wall.
The create lacks that step.

The library is not at fault. A worktop that ends flush at a wall and overhangs at a free end is the
intended kitchen, and the library calculates it for the place the tools give it.

## Symptom (as recorded)

`mcp-test-2026-10-22_19-45-49`, gpt-6-astra 75 (`random-5-base-row-right-wall-corner`, bo-test
`205cc9bc8`, plan `empty-room-with-water-connection`, `ps_sau169slquuapnhdz3fdmc0u24eplrcf`):

- **Prompt:** "add three base cabinets along the right wall, starting in the back right corner: one
  90 cm wide with two doors and two 60 cm wide with drawers."
- **Tool calls:** `get-plan-context` → `get-authoring-rules` → `get-skill` → one
  `create-or-replace-groups` with `placement { wall: right, alignment: back }` of `U2TB90`,
  `US2A60`, `US2A60`.
- **Plan:** the group at `[4815, 0, -3755]` (pos space), rotation 270, footprint x 0 to 2110 for
  2100 mm of carcasses. The back wall is at z −3765. No correction and no hint names the gap.

## Reproduction

Model-free replay, the same payload sent through `callExternalObjectAgentTool` in the example page,
each step undone before the next. Run on the deployed bo-test planner (`release/bo-test`
`1d9adf51e`) and on a local dev server of `feat/hi-mcp` (`0b681db1d`). Both give the same result,
bo-test in pos space and `feat/hi-mcp` in plan space. The script and its output are in
`.temp/result/repro-corner-row-off-the-wall-2026-10-24/`.

The numbers below are those of `feat/hi-mcp`. The right wall is at x 4815, the back wall at y 3765,
the front wall at y −1235. "Position" is the plan context's position of the group: the back left
corner of the first carcass. The footprint is measured from there.

| Step | Position y | Footprint x | Worktop length (`mod_LengthList`) | Carcass at the aligned end |
|---|---|---|---|---|
| Create without placement (where the planner puts it) | — | −10 to 2110 | 2120 | no wall distances (`DataComplete: false`) |
| Create with `{ wall: right, alignment: back }` (run 75) | **3755** | 0 to 2110 | 2110 | `DistanceWallLeft: 10`, `CarcaseVisLeft: 0` |
| … then `place-group` with the same spec | 3765 | 0 to 2110 | 2110 | `DistanceWallLeft: 0` |
| Create without placement, then `place-group` `{ right, back }` | 3765 | 0 to 2110 | 2110 | `DistanceWallLeft: 0` |
| Create with `{ wall: right, alignment: center }` | 2315 | −10 to 2110 | 2120 | both ends free |
| Create with `{ wall: right, alignment: front }` | 875 | −10 to 2100 | 2110 | last carcass `DistanceWallRight: 10` — the row ends at y −1225, **10 mm off the front wall** |

The carcass values are those of the library's `mod_ModuleContextInformationList` and
`mod_InformationList` on the calculated root modules.

## Investigation

### What the library builds

The calculated group carries, for each carcass, the distance of its sides to the walls
(`DistanceWallLeft`, `DistanceWallRight`) once it stands in the room. The library builds the row
for that place:

- **An end that stands at a wall** gets no visible side (`CarcaseVisLeft: 0`), and the worktop
  ends flush with the carcass.
- **A free end** gets a visible side, and the worktop overhangs it by 10 mm.

Where the planner first puts a new group, the library has no wall distances for it
(`DataComplete: false`), and both ends get the overhang: the worktop is 2120 mm long over 2100 mm of
carcasses, footprint x −10 to 2110. After the corner
placement, the first carcass is 10 mm from the back wall, and the library counts that end as at the
wall: no overhang, worktop 2110 mm. After `place-group`, the carcass is at the wall
(`DistanceWallLeft: 0`), and the worktop stays 2110 mm.

The library behaves the same way on both builds. This is the library as it is, and the MCP deals
with it.

### What the tools do

1. **The create loads the new group without a position** (D23). `placeAtWalls`
   (`hi-tool-commands.ts:232`) reads the calculated groups (`:238`) and computes each target with
   `wallTarget(rawGroup, …)` (`:267`) — from the footprint of the group at the planner's place,
   x −10 to 2110.
2. **`placeGroupAtWall` places that footprint** (`hi-wall-placement.ts:424`). The group starts
   with no corner article, so it goes by `placeAgainstWall` (`:460`, `hi-plan-space.ts:1260`):
   alignment `back` resolves to the wall's end, the span of the 2120 mm footprint ends at the back
   wall, and the group origin is set back by the footprint's `minX` of −10 (`hi-plan-space.ts:1283`).
   The worktop's −10 edge touches the wall. The first carcass starts 10 mm from it.
3. **`placeAtWalls` reloads every placed group once** (`hi-tool-commands.ts:299`). The library
   builds the row for the new place, and the overhang at the wall end goes. The carcasses stay where
   step 2 put them.
4. **After the reload, `placeAtWalls` only checks that the planner moved the group** (G59,
   `:306-318`). It does not measure the group again. The create reads the groups and answers with
   the row 10 mm off the wall.

`place-group` takes the same steps 1 to 3 (`hi-tool-commands.ts:855-885`), then measures the group
as built at the new place and reloads it once more when it does not stand as asked
(`:886-920`, D70). For this row the second measure has footprint 0 to 2110, its target puts the
carcass at the wall, and the library keeps the worktop flush there.

### Which placements are affected

A create that puts one end of a row with a worktop against a wall:

- both corner alignments of a wall, as in run 75 (`back`) and the `front` replay;
- by the same arithmetic, `start` or `end` with `offsetMm` 0 where that end of the wall is a
  corner.

Not affected:

- a centred row, or any row with both ends free;
- a group that starts with a corner article placed into the corner by its corner point
  (`placeCornerAtWalls`) — the corner point does not depend on the worktop;
- a row without a worktop, for example wardrobes;
- every group moved by `place-group`.

D70 names one more case: the library widens the units at the end of a row to reach a wall. A create
that ends in that case has the same gap: the create measures the row only before the library builds
it at the wall.

## Root cause

`placeAtWalls` (`hi-tool-commands.ts:232-319`) places a new group by its measure at the planner's
first place and reloads it once (`:299`). The library builds a group for its place (D70): at a wall
it drops the worktop overhang of that end, and it may widen the end units. The create never
measures the group as built at the new place, so the group stands off by the difference. Here that
is the 10 mm overhang.

D23 specifies the create's wall placement "as `place-group` moves a group", but the measure at the
new place (D70) was added to `place-group` only. The wall arithmetic (`wallTarget`,
`placeAgainstWall`) is correct for the group it measures. The group it measures is not the group
that stands there after the reload.

## Proposed fix

The server can place the row right itself, so no correction or hint is needed. This is step 2 of
[Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort): the server derives the
position, and the agent's placement stays as it is.

1. **One step for both commands.** The measure at the new place of `place-group`
   (`hi-tool-commands.ts:886-920`) becomes a function that takes the groups a reload placed at
   walls, each with its resolved wall, spec and prefix:
   - it reads the groups as built;
   - for each group it computes `wallTarget` again, with the other groups where they stand now;
   - the groups that do not stand at their new target (`standsAt`) are reloaded together at that
     target (`repositionedGroup`).

   It returns the placement of each group as built. The corrections of that measure replace the
   ones of the first measure for that group, as in `place-group` today. `place-group` calls it with
   its one group.
2. **`placeAtWalls` calls it after its reload**, for every group the reload moved: those not named by
   the G59 check. The groups of the call stand at their targets then, so the overlap test counts
   them there. `placedAlong` takes the `along` of the placement as built.
3. **Nothing else changes.**
   - The served text stays as it is.
   - The row stands as asked, so no correction is added.
   - The command stays one planner step (`historySteps: 1`, `runToolCommand`
     `hi-tool-commands.ts:1581-1589`), so `undo` reverts the call as before (D47).
   - The group materials are still set after the last reload (D36).

The cost is one more load, only for a group that does not stand as asked after the first reload: a
row with a worktop that ends at a wall, or a row whose end units the library widens. A centred row
and a corner article placed by its corner point load twice, as now.

### Alternatives considered

- **Place by the carcasses, without the generated roots** — rejected. Whether an end overhangs is
  the library's decision for each place. At a free end the overhang belongs to the group's span: in
  the overlap test, beside a door, and at an `offsetMm`. The tools would predict one library's
  worktop rule, and the tools stay library-neutral (§2.4).
- **Drop the overhang of the aligned end in the wall arithmetic** — rejected for the same reason.
- **A correction or a hint that names the 10 mm** — rejected. The server can place the row right
  itself, and the agent could only call `place-group` with the same spec.
- **A library change: keep the overhang at a wall, or move the carcasses to the wall** — not valid.
  The library builds the row correctly for its place, and a change in the data the library
  calculates is no valid fix ([the analysis skill](../skills/hi-analysis.md)).
- **Keep the wall distance in the glue logic on the reload** (`keepWallDistances`) — rejected. A
  change for the Planning Assistant never changes `glue-logic.ts` (D110).
- **Load the new group at its target in one load** — rejected by D23: every call would calculate
  the group twice. It would also not help: the library builds the row for its place only after the
  load.

## Tests

- `__tests__/hi-tool-commands/create-or-replace-groups-placement-test.ts`,
  `describe('create-or-replace-groups wall placement')`. `createWallApi` gets an option that
  rebuilds a reloaded group with another footprint: a generated root that overhangs both ends at
  the planner's place, and only the free end after the reload.
  - `it('places a new group by wall once more by its measure at the new place when the library builds it there otherwise')`:
    three loads. The third reloads the group with the repositioning that puts its first carcass at
    the wall. The result's position is at the wall, with no correction.
  - The same with `alignment` `front`: the last carcass ends at the front wall.
  - `it('loads a new group placed by wall once without a position and reloads it once at the wall')`
    keeps passing: a group that stands as asked after the reload is not loaded a third time.
  - Two groups of one call, one of them rebuilt with another footprint: only that one is reloaded
    once more, and the measure at the new place counts the other group at its target.
  - An overlap the measure at the new place finds replaces the correction of the first measure, as in
    `place-group`.
- `__tests__/hi-tool-commands/place-group-test.ts`: the two D70 tests
  (`it('places the group once more by its measure at the new place when the library builds it there with another width')`,
  `it('reports an overlap the measure at the new place finds when it places the group once more')`)
  keep passing with the shared function.
- Model acceptance: a fixed prompt test `base-row-right-wall-back-corner` in
  `docs/test-prompts.json`, plan `empty-room-with-water-connection`, with the prompt of run 75. It
  passes when the first carcass stands at the back wall. It runs only on request, on a planner that
  carries the change (bo-test after deployment, or the local roomle-ui with `--dev`).

## Documents

- roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md`:
  - **D23:** "reloads the group once" becomes "reloads the group, and places it once more by its
    measure at the new place when it does not stand as asked (D70)".
  - **D70:** covers the create's wall placement, with the worktop overhang beside the widened end
    units.
  - **The D70 row of §8** names both tools.
  - The guarding tests are added to D23 and D70.
- roomle-ui `.agents/homag-intelligence/tool-executors.md`, step 11: the measure at the new place
  after the reload.
- roomle-ui `.agents/homag-intelligence/layout-and-placement.md`, "Placing a new group": the same
  sentence.
- roomle-hi-example `.agents/skills/hi-mcp-tools.md`: the create's wall placement (around line
  211) names the measure at the new place, as the `place-group` paragraph (line 255) does.
