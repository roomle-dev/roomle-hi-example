# A unit of another group keeps its height when its carrier changes height

> **Type**: Bug analysis
> **Status**: Open
> **Date**: 2026-10-25
> **Base**: roomle-hi-example `master` (`5de694b`); roomle-ui `feat/hi-mcp` (`7f880754a`, with the fix of item 103)
> **Backlog**: [mcp-issues.md #104](../backlog/mcp-issues.md#104-a-unit-of-another-group-keeps-its-height-when-its-carrier-changes-height)

## Affected repositories

- **roomle-ui** (`feat/hi-mcp`) — `hi-root-module-arrangement.ts`:
  - `moveOf` in `groupsFollowingTheirCarriers` adds the change of the carrier's docking top to the
    move, so a unit of another group keeps its clearance to the carrier, as a unit of the edited row
    does.
  - Unit tests in `__tests__/hi-root-module-arrangement-test.ts` and `__tests__/hi-tools-test.ts`.
  - D42 in `.agents/homag-intelligence/hi-tools-behaviour.md`, the units-above paragraph of
    `.agents/homag-intelligence.md` and "Row edits" of `.agents/homag-intelligence/tool-executors.md`.
  - `hi-tools.ts`, `glue-logic.ts`, `moveUnitsAboveWithTheirCarriers` and `hi-tool-hints.ts` stay
    unchanged.
- **roomle-hi-example** — this analysis and backlog item 104.
- **Library, embedding-lib, ligna-store** — unchanged. `createHiMcpTools` forwards the row edits as
  they are, so no new embedding-lib version is needed. The example page and the ligna-store get the
  fix with the planner.

The roomle-ui paths are relative to `packages/web-sdk/packages/homag-intelligence/src/` unless they
start with `__tests__/` or `.agents/`. The D-numbers are those of
[roomle-ui `hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md).

## Result

A row edit moves the units of other groups that stand above a root of the edited row (D42). It
moves each by the change of its carrier's origin and rotation. The carrier's docking top never
enters that move. The edited row moves its own units by the change of the docking top, so they keep
their clearance to the carrier.

Two row edits put a carrier of another height under a unit:

- **`exchange-root-module`**, with an article of another height or `attributes` that change the
  height.
- **`delete-article-and-compact`**, when the neighbour that moves into the gap has another height
  than the removed root.

The unit of another group then keeps its height. It stands inside a taller carrier or floats above a
lower one, and a hanging unit loses or gains clearance. The agent's call is right; the tools move the
unit to the wrong height.

## Symptom

No test run shows it yet. The backlog item comes from reading the code during the analysis of
item 103.

- **An exchange of a floor unit for a tall unit** leaves a wall unit of another group, hung above
  the floor unit, inside the tall unit. The plan image does not show the wall unit at all. The
  result returns only the edited group, and its hint says "the row now overlaps group '…'".
- **A `delete-article-and-compact`** whose taller neighbour moves into the gap leaves the wall unit
  inside the neighbour. The correction says the unit "now stands above" the neighbour, but it stands
  inside it.
- **The same wall unit in the edited row** is lifted by the rise of the docking top, and the hint
  names it as moved.

## Reproduction

### In the planner

Model-free replay through `callExternalObjectAgentTool` in the example page, on the deployed bo-test
planner (`release/bo-test` `1d9adf51e`, pos space), plan `empty-room-with-water-connection`
(`ps_sau169slquuapnhdz3fdmc0u24eplrcf`, room height 2800 mm). On bo-test, `moveOf` of
`groupsFollowingTheirCarriers`, the exchange's carrier override (`hi-tools.ts`) and the renamed root
of `swapRootModuleWithAttributes` (`glue-logic.ts`) are the same code as on `feat/hi-mcp`. The script,
its output and the plan images are in `.temp/result/repro-unit-keeps-height-2026-10-25/`.

Heights are room heights of the docking vectors: the bottom and the top of a unit's docking box.
`US2A60` has its docking top at 820 mm (carcase and plinth), `H2TB60` at 2200 mm.

| Scenario | Steps | Wall unit `OTB60` before | After the edit |
|---|---|---|---|
| A, exchange | `US2A60` `a` and `b` at the back wall; `OTB60` in its own group, placed by point 1400 mm up above `b`; `exchange-root-module` of `b` for `H2TB60` | 1400–2120 | **1400–2120**, inside the `H2TB60` (0–2200) |
| B, delete | `US2A60` `a`, `b` and `H2TB60` `c`; the same `OTB60` above `b`; `delete-article-and-compact` of `b` | 1400–2120 | **1400–2120**; `c` moves from x 525 to −75, into `b`'s place |
| C, edited row | `US2A60` `a`, `b` and `OTB60` `w` `above` `b`, all in one group; `exchange-root-module` of `b` for `H2TB60` | 1480–2200 | 2860–3580, lifted by 1380 |

- **A**: the result returns only the row (`groups` with one id). The hint is "the row now overlaps
  group '…'" (D43). `A3-exchange.image-0.png` shows the base unit and the tall unit; the wall unit is
  inside the tall unit and cannot be seen.
- **B**: the correction is "the unit '…' (OTB60) above '…' (US2A60) now stands above '…' (H2TB60)",
  and the hint is "the row now overlaps group '…'".
- **C**: the hint names the `OTB60` as moved with the unit below it. The edited row keeps the 660 mm
  clearance above the new docking top, and so the wall unit reaches through the ceiling. See
  [Consequence for a tall carrier](#consequence-for-a-tall-carrier).

### In the tools

A temporary vitest on `feat/hi-mcp` (`7f880754a`), with the mocks of `__tests__/hi-tools-test.ts`.
It was run and then deleted. Its carriers have a `LeftTop` docking vector at 720 mm, and a catalog
article with its `LeftTop` at 900 mm (or 2100 mm) replaces them:

| Edit | Unit of another group (room y) | Result | The same unit in the edited group |
|---|---|---|---|
| exchange of `root-1` (720) for the 900 mm article, a unit on top of `root-1` | stays at 720, 180 mm inside the carrier | `groupIds` `['group-1']`, one load | 900 |
| exchange of `root-1` for the 900 mm article, a unit hung at 1380 | stays at 1380, clearance 660 → 480 | `groupIds` `['group-1']`, one load | — |
| exchange of `root-1` for the 2100 mm article, a unit hung at 1380 | — | — | 2760 |
| `removeArticleFromGroup` of `root-2` (720) of the free row, `root-3` (900) moves into its place, a unit on top of `root-2` | stays at 720 | `groupIds` `['group-1']`, correction "now stands above 'root-3'" | 900 |

`groupsFollowingTheirCarriers` on its own returns `[]` for a carrier whose docking top rises from 720
to 900 at the same origin, with a wall unit of another group on it and a unit on top of that.

## Investigation

### How the edited row keeps its units above on their carrier

- **The exchange.** `swapRootModuleWithAttributes` (`glue-logic.ts:2788`) puts the new root at the
  replaced root's `articlePos` and rotation. In its copy of the group before the change, it gives
  the replaced root the new root's id (`:2830-2837`). `carriersOfUnitsAbove` then finds the new root
  as the carrier of the units above, and the replaced root, under the same id, as their reference.
  `arrangeAndLoad` runs `moveUnitsAboveWithTheirCarriers` on the arranged group
  (`_arrangeRootModulesAndCalculateIfChanged`, `:3537-3539`).
- **The delete.** `removeArticleFromGroup` names the neighbour that moves into the gap as the carrier
  of the units above the removed root, with the removed root as their reference
  (`carrierOverrides`, `hi-tools.ts:1197-1200`). It passes them to `arrangeAndLoad` (`:1241-1247`).
- **`moveUnitsAboveWithTheirCarriers`** (`hi-root-module-arrangement.ts:219-318`) moves a unit along
  the floor by the change of its carrier's origin (`:280-284`). Its height is the change of the
  docking top: the unit's height plus the carrier's top after the edit, minus the reference's top
  before it (`:285-311`). The unit keeps its clearance to the docking top. This is D42's clearance
  rule: "the arrangement preserves the clearance measured between their docking vectors".

### How the units of other groups move

1. **Before the edit**, `_unitsOfOtherGroupsAbove` (`hi-tools.ts:1498-1511`) finds the units of
   other groups above the edited row by room position (`carriersOfUnitsInOtherGroups`,
   `hi-root-module-arrangement.ts:364-385`).
2. **Each unit gets its carrier and reference** (`followersOf`, `hi-tools.ts:104-113`). An exchange
   names the new root as the carrier and the replaced root, by its old id, as the reference
   (`:973-988`). The tools' copy of the group before the change (`:941`) is taken before the swap
   and keeps the old id. A delete passes its `carrierOverrides` (`:1252`).
3. **`groupsFollowingTheirCarriers`** (`hi-root-module-arrangement.ts:405-482`) computes the move of
   each unit in `moveOf` (`:417-432`). The move is the room pose of the carrier after the edit times
   the inverse of the room pose of the reference before it. A unit on top of a unit of another group
   takes that unit's move (`moveOfUnit`, `:433-449`). A unit whose pose does not change is dropped
   (`samePose`, `:470-471`).
4. **`_moveUnitsOfOtherGroupsWithTheirCarriers`** (`hi-tools.ts:1519-1553`) sets the new poses and
   loads each group with a moved unit, without arranging it.

### Why the unit keeps its height

- **The move holds no change of height.** All rotations of the planner turn about the vertical
  axis, so the vertical part of a move from `moveOf` is the change of the carrier's origin height,
  which a row edit keeps. The docking top, which `moveUnitsAboveWithTheirCarriers` measures
  (`:285-311`), never enters `moveOf`.
- **The exchange gives no move at all.** The new root stands at the replaced root's origin, so the
  move is the identity, `samePose` drops the unit, and its group is neither loaded nor returned.
- **The delete moves the unit along the floor only.** The neighbour moves into the gap; standing
  where the removed root stood, as in scenario B, it too gives the identity. Whatever its height,
  the unit keeps its own.
- **A stack keeps its height as a whole.** A unit on top of the unit of another group takes that
  unit's move (item 103), which holds no change of height either.

### Which edits and carriers are affected

- **`exchange-root-module`**: an article of another height, or `attributes` that change the height
  of the new root. It affects every unit of another group above the replaced root.
- **`delete-article-and-compact`**: a neighbour of another height that takes the place of the removed
  root. A unit that keeps its place because the neighbour carries a unit already is not moved at all
  (D42) and is not affected.
- **`insert-article-into-group`, `merge-article-into-group`, `swap-root-modules`**: a unit follows its
  own carrier, which keeps its height. They are affected only if the library recalculates a carrier's
  height in the edit. The fix covers that case too.

Not affected:

- **The edited row.** `moveUnitsAboveWithTheirCarriers` keeps the clearance.
- **The hint.** `movedUnitsAboveHint` (`hi-tool-hints.ts:117`) compares the room poses of all roots
  before and after the edit, height included (`roomPose`, `:128-138`). It names a unit that only
  moves up or down.
- **The attribute commands.** `change-module-attribute` and `change-group-attribute` move the units
  above of the edited group only; no attribute command moves the units of other groups (D42: "A width
  change by an attribute command moves the units above of the edited group only"). A height change by
  an attribute command leaves the units of other groups in place by that decision, not by this
  defect.

## Root cause

`moveOf` in `groupsFollowingTheirCarriers` (`hi-root-module-arrangement.ts:417-432`) derives the move
of a unit of another group from its carrier's origin and rotation only. The carrier's docking top,
which `moveUnitsAboveWithTheirCarriers` uses for the height of the edited row's units (`:285-311`),
never enters it. A carrier of another height gives the unit no change of height. At the same origin
it gives no move at all, and `samePose` (`:470-471`) drops the unit.

D42 moves a unit of another group "the way its carrier went … as for the edited group's own units",
and the edited group keeps the clearance to the docking top.

## Proposed fix

The server can place the unit itself, so no correction, guard or new hint is needed. This is step 2
of [Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort): the server derives the
height. The fix is in `moveOf`, which only the tools call. `glue-logic.ts` imports
`moveUnitsAboveWithTheirCarriers` from that module and nothing of this fix (D110).

`moveOf` adds a vertical shift to the move: by how much the carrier's docking top stands higher above
its origin after the edit than the reference's did before it. The move's own vertical part already
holds the change of the origin height, so together the unit goes up or down by the change of the
docking top in the room, as `moveUnitsAboveWithTheirCarriers` moves it:

```ts
/** How much higher the carrier's docking top stands above its origin than the reference's did. */
const riseOfDockingTop = (
  reference: PosModuleRootData,
  carrier: PosModuleRootData,
): number => {
  const before = getDockingVectorBox({ roots: [reference] } as PosGroup)?.max.y;
  const after = getDockingVectorBox({ roots: [carrier] } as PosGroup)?.max.y;
  return before === undefined || after === undefined
    ? 0
    : after - (carrier.articlePos?.[1] ?? 0) - (before - (reference.articlePos?.[1] ?? 0));
};
```

In `moveOf`, the returned move becomes
`new Matrix4().makeTranslation(0, riseOfDockingTop(reference, carrier), 0).multiply(move)`. A shift
along the vertical axis in the room is the same shift in every group's frame, so the unit's new pose
in its own group follows as it does now.

- **A turned carrier** keeps its move as it is, with the shift of its own docking top: the carrier is
  the same root, so the shift is 0 unless the library changed its height in the edit.
- **A carrier that has no docking vectors, or a reference that has none,** gives no shift, as
  `moveUnitsAboveWithTheirCarriers` makes none.

What follows unchanged:

- **The stack.** A unit on top of the unit of another group takes that unit's move (`moveOfUnit`),
  shift included, so the stack keeps its shape.
- **The loads.** A unit whose height changes is no longer dropped by `samePose`;
  `_moveUnitsOfOtherGroupsWithTheirCarriers` loads its group and returns it in `groupIds`.
- **The delete.** The correction "now stands above" is true. The overlap check of the units that
  keep their place (`hi-tools.ts:1254-1281`) reads the other groups after their load, so it sees the
  new heights.
- **The hints.** The moved-units hint names the unit, and the overlap hint of scenarios A and B no
  longer fires.

### Consequence for a tall carrier

The fix gives a unit of another group the clearance rule the edited row has. Over a much taller
carrier, the rule lifts the unit by the full rise. In scenario C, the edited row lifts a wall unit
over a new tall unit to 2860–3580 mm in a 2800 mm room. With the fix, scenarios A and B put the
`OTB60` of the other group at 2780–3500 mm. The unit then stands in the same wrong place as within the
edited row, instead of inside the tall unit.

Where a unit should go over a carrier that leaves no room for it is a question of D42's clearance
rule for every unit above, in the edited row and in the other groups alike. It is not part of this
defect, whose fix makes the units of other groups follow the rule the edited row follows.

## Alternatives considered

- **Correct the height per unit after the move, in its own group's frame, as
  `moveUnitsAboveWithTheirCarriers` corrects `articlePos[1]`** — rejected. A unit on top of a unit of
  another group would need its own carrier's top, and the stack would be measured twice. A shift in
  `moveOf` reaches every unit of the stack through `moveOfUnit`.
- **Put the unit on the new docking top, with no clearance, or lift it only as far as an overlap
  needs** — rejected for this defect. It departs from D42's clearance rule, which the edited row
  follows. Changing that rule is the question of [the tall carrier](#consequence-for-a-tall-carrier),
  for the edited row as well.
- **Load the group of the unit with its arrangement** (`arrangeAndLoad(…, true, …)`) — rejected by
  D42. The arrangement re-docks the group and keeps its side at a wall, which can move its other
  units.
- **A hint or a correction that names the unit inside its carrier** — rejected. The server can place
  it itself, and the agent could only repeat the edit on the other group.
- **Change `glue-logic.ts`** — rejected by D110, and not needed: the edited row's behaviour is
  right, and the fix lives in the tools.
- **Move the units of other groups on an attribute command too** — out of scope. D42 decides that
  the attribute commands move the units above of the edited group only.

## Tests

- `__tests__/hi-root-module-arrangement-test.ts`, `describe('in other groups')`:
  - `it.each([[900, 180], [600, -120]])('moves a unit of another group and the unit on top of it with the docking top of its carrier, %i mm high at the same origin')`:
    `base-2` with its `LeftTop` at the given height and its origin unchanged. `wall-2` of
    `stackedWallRow()` goes to `[0, 180, 0]` (or `[0, -120, 0]`) in its frame, `top-2` to
    `[0, 900, 0]` (or `[0, 600, 0]`).
  - `it('keeps the clearance to the docking top of a carrier of another height that takes the place of the root it stood above')`:
    followers `['wall-2', 'base-1', 'base-2']`, `base-1` at `[600, 0, 0]` with its `LeftTop` at 900.
    `wall-2` goes to `[0, 180, 0]`.
  - `it('leaves a group whose carriers did not move')` keeps passing: the same docking top gives no
    shift.
- `__tests__/hi-tools-test.ts`:
  - `describe('exchangeRootModule with units above in other groups')`,
    `it("lifts the unit of another group on top of the exchanged root to the new article's docking top")`:
    `dockedPairGroup()` with a `LeftTop` at 720 on `root-1`, `group-2` with a unit at
    `[0, 720, 0]`, and a catalog article with its `LeftTop` at 900. The unit stands at
    `[0, 900, 0]`, `groupIds` is `['group-1', 'group-2']`, and there are two loads.
  - `describe('with units above in other groups')` under the delete,
    `it('lifts the unit of another group above the removed root onto the taller neighbour that takes its place')`:
    the free row with `LeftTop`s at 720, 720 and 900, a unit at 720 above `root-2`. It stands at 900
    above `root-3`, and `groupIds` holds its group.
  - `it('keeps the unit of another group above the exchanged root where the new root stands')` keeps
    passing: neither root has a top vector.
- The tests named in D42 keep passing unchanged, among them the `moveUnitsAboveWithTheirCarriers`
  tests and every `describe('with units above in other groups')`.
- No prompt test: the agent's call is right, and the defect is the tools' move. The replay of
  `.temp/result/repro-unit-keeps-height-2026-10-25/` with `--dev` against the local planner shows the
  `OTB60` of scenarios A and B at 2780–3500 mm and the moved-units hint naming it.

## Documents

- roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md`, **D42**: "moves each such unit within
  its group the way its carrier went — turned with a leg that turns, …" gains "and up or down by the
  change of its carrier's docking top, keeping its clearance as a unit of the edited row does". The
  new tests join its list.
- roomle-ui `.agents/homag-intelligence.md`, the units-above paragraph: `groupsFollowingTheirCarriers`
  gives each unit the move of its carrier and the change of the carrier's docking top above its
  origin.
- roomle-ui `.agents/homag-intelligence/tool-executors.md`, "Row edits": "the way its carrier went"
  gains "and by the change of its docking top".
