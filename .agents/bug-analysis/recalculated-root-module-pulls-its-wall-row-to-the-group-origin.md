# Bug analysis — a root module the library calculates again pulls its wall row to the group origin

> **Type**: Bug analysis
> **Status**: Open — reproduced; arrangement fix proposed, not implemented
> **Date**: 2026-10-21
> **Base**: roomle-ui `feat/hi-mcp-improvements` (`c92cf6b11`); roomle-hi-example `master` (`08f3169`)
> **Backlog**: [item 95](../backlog/mcp-issues.md#95-a-tall-filler-panel-kept-by-id-in-a-replace-is-taken-for-a-wall-unit)

## Affected repositories

- **roomle-ui** (`feat/hi-mcp-improvements`): in `HiRootModuleArrangementOperator._arrangePositions`,
  a root module that regains its docking vectors no longer seeds a docking cluster while another
  root module has a position (`packages/web-sdk/packages/homag-intelligence/src/hi-root-module-arrangement.ts:1208`,
  `:1325-1337`). Tests go in `homag-intelligence/__tests__/hi-root-module-arrangement-test.ts` and
  `__tests__/hi-tools-test.ts`; the living reference is `.agents/homag-intelligence.md:174,189`.
  The tool commands (`hi-tool-commands.ts`, `hi-group-layout.ts`) stay as they are.
- **roomle-hi-example**: documentation only. That is D95 in `docs/hi-mcp-behaviour.md` and the seed
  rule in `.agents/context/layout-and-placement.md:166`. No embedding-lib pin changes: the
  arrangement runs in the planner (web-sdk), so the example page gets the fix from the planner it
  loads (local :5173 with `--dev`, bo-test after its deployment).
- **ligna-store**: no change. Like the example page, it gets the fix with the planner.

The served text and the library calculation need no change.

## Symptom and reproduction

In a replace by ids of a kitchen run, the tool command treats the tall filler panel `PH15L`
(`Kitchen | Cover Panels | Fillers`, 2160 mm) as a wall unit. Two corrections follow:

- "floor unit '760355f3…' (HK260) cannot stand rightOf the wall unit '1147a3da…' (PH15L) - it
  continues the floor row". This drops the fridge's relation to the filler.
- "root '1147a3da…' names no neighbour - it was put rightOf '760355f3…'". This moves the filler
  behind the fridge.

The model then undoes the replace and rebuilds the run without the filler.

**Reproduce.** `mcp-test-2026-10-21_08-37-33`, gpt-6-astra 66 (`image-planning-right-wall`, start
plan `ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv`, local roomle-ui :5173). Three plan-changing calls lead
to the corrections (planner calls 3, 6 and 9 of `planner-calls.json`):

1. `create-or-replace-groups` builds the run `fill` (PH15L, 50 mm), `fridge` `rightOf` `fill`, …,
   `end`. It builds two dark wall units: `dark1` (O2TB90) `above` `prep` with `gapMm` 540, and
   `dark2` `rightOf` `dark1`. On top of them it puts `top1` (OTB60, 900 mm, one door) `onTop`
   `dark1` with `align: "back"`, and `top2` `rightOf` `top1`. The result names `top1` and `top2`
   in `notLoaded`: the library could not calculate them (Error 14019, no `tab_DoorSettings` entry
   for a 900 mm single door).
2. `change-module-attribute` sets `mod_DoorDirectionSelection` `LeftRight` on `top1` and `top2`.
   This is the recovery D95 describes, and the library now calculates both. The result reports
   "the library changed mod_HeightPosInsertion of 2 root modules (O2TB90 ×2) from "1360" to
   "-600"".
3. `create-or-replace-groups` sends the group by its ids. The filler is the first root without a
   relation, and the fridge stands `rightOf` it, as in the create. This call returns the two
   corrections above.

The three calls replayed without a model against the branch give the same corrections (see
[Verification](#verification)).

## Investigation trace

Positions are in group space, from the replay (`getExternalObjectGroups()` after each call).

**After the create.** The floor run stands from `fill` `[106,0,0]` to `end` `[3756,0,0]`. The wall
units hang at y 1360..1960: `dark1` at `[1356,1360,0]` and `dark2` at `[2256,1360,0]`. `top1` and
`top2` have no docking vectors and stand at `[106,0,0]`, the place of the run's first root module.
No docking placed them there. `carriersOfUnitsAbove` finds `dark1 → prep` and `dark2 → dw`.

The docking context links only vectors that touch (D42), so the floor run and the wall row are two
clusters. `top1`'s entry `BackBottom → dark1.BackTop` (the `onTop` relation) joins the wall row's
cluster.

**The attribute edit.** `change-module-attribute` runs the planner's `change-attributes`. The glue
logic recalculates and arranges the group with the original group
(`glue-logic.ts:2069-2088`, `_arrangeRootModulesAndCalculateIfChanged` `:3257`). `_arrangePositions`
(`hi-root-module-arrangement.ts:1193-1245`) then picks its seeds:

- The first seed (`:1208`) is the root module closest to `[0,0,0]`. `fill` and the two top units
  tie at 106 mm, so `fill` wins by array order and the floor run is arranged from it.
- The next seed (`:1221-1228`, `_findRemainingSeedWithPosition` `:1325-1337`) is the remaining
  root module with a position closest to `[0,0,0]`. That is `top1` at 106 mm, against 1914 mm for
  `dark1`. `top1` now has docking vectors, so it counts.
- The breadth-first docking from `top1` (`_arrangeConnectedRoots` `:1247-1323`,
  `setModulePositionFromDocking` `:1302`) puts `dark1`'s `BackTop` on `top1`'s `BackBottom`.
  `_validateAndCompleteContextData` (`:1040-1126`) mirrored the entry, so it docks in that
  direction as well.

The arrangement alone gives `top1` `[106,0,0]`, `top2` `[1006,0,0]`, `dark1` `[106,-600,0]` and
`dark2` `[1006,-600,0]`. The planner's reload shifts the origin by −106:

| Root module | Position | Docking-vector box |
|---|---|---|
| `fill` | `[0,0,0]` | x 0..50, y 0..2260 |
| `dark1` | `[0,-600,0]` | x 0..900, y −600..0, z 0..350 |
| `dark2` | `[900,-600,0]` | x 900..1800, y −600..0 |
| `top1` | `[0,0,0]` | x 0..900, y 0..300 |
| `top2` | `[900,0,0]` | x 900..1800, y 0..300 |

The top units now stand on the floor in the place of the filler, the fridge, the oven and the prep
unit, and the dark wall units hang below the floor. `mod_HeightPosInsertion` of `dark1` and `dark2`
is −600, which is the "library change" the result reports. `moveUnitsAboveWithTheirCarriers`
leaves `dark1` where the docking put it (D42: a unit the docking moved stays).
`carriersOfUnitsAbove` now finds `fill → dark1`, `fridge → dark1`, `oven → dark2`, `prep → dark2`,
`top1 → dark1` and `top2 → dark2`.

**The replace.** `retainedWallRoots` (`hi-tool-commands.ts:412-434`) keeps as wall roots the roots
sent by id, with their article and without a relation, that `carriersOfUnitsAbove(previous)` finds
above another root module (D85: retained calculated carriers establish upper roots).

- Only the filler is sent so. Its box starts at y 0 on `dark1`'s top (y ≤ 0), and its centre
  (x 25, z 280.5) lies over `dark1` (`hi-root-module-arrangement.ts:144-172`).
- `wallRootsOf` (`hi-group-layout.ts:79-101`) accepts it. Its category matches neither the
  base-unit nor the tall-unit pattern (`isFloorUnitArticle` `:74-77`), so by D85 it carries no
  floor evidence.
- `relationsToDocking` then drops `fridge rightOf fill` (`hi-group-layout.ts:456`) and puts the
  filler `rightOf` the fridge (`:618`).

The third correction of the call ("'c1253d7d…' and 'd309e09b…' both hang above '9aca450e…'") is
about the agent's own repair of the broken wall row, and it is correct. In the replay, the replace
leaves the group at y −1360; that follows from the broken group before it and is outside this
analysis.

The agent's three payloads say what it wants and follow the served rules. Error 14019 is a library
value combination that the tool reports (D73, C25), and the attribute edit is the recovery D95
describes. No served text leads to the defect; it lies in the planner's arrangement.

## Root cause

`HiRootModuleArrangementOperator._arrangePositions` seeds a docking cluster from a position no
docking gave (`hi-root-module-arrangement.ts:1208` and `:1221-1228` with
`_findRemainingSeedWithPosition`, `:1325-1337`).

A root module that the library could not calculate in the original group has no docking vectors
there, so its `articlePos` is the place the planner gives a root module it cannot dock: the group
origin, where the run's first root module stands. Once a valid value lets the library calculate it
again, it has docking vectors and qualifies as a seed. Standing at the origin, it beats every
calculated root module of a cluster that is not docked to the first one, such as a wall row that
hangs with a gap. The cluster is then arranged from that position: every calculated root module of
it moves to dock to the recovered one, and the recovered one stays where no docking put it.

## Why the current code produces wrong results

The seed rule assumes every root module with a position stands where the docking or the user put
it, and that the seed "keeps what it defined" (`.agents/context/layout-and-placement.md:166`). D95
breaks that assumption for a recovered root module: its position belongs to the failed calculation
before. Its docking entries do say where it belongs (on `dark1`), and the arrangement can follow
them in either direction. The seed decides the direction, and it picks the wrong one.

The first cluster usually escapes. Its first root module stands at the origin too and comes first
in the array, and the existing recovery tests (`it('keeps the group in place when a
change-module-attribute lets the library calculate a failed root module again')`,
`hi-tools-test.ts:372`) recover a root module of that cluster. A recovered unit on top of, beside or
in a wall row seeds that row whenever it is the row's root module closest to the origin, which it
is by construction.

Everything after the arrangement reads the broken positions as the truth:

- The library derives the insertion heights −600 from them.
- The attribute result reports that as a library change.
- `carriersOfUnitsAbove` takes the floor run's left end for units above the dark wall units.
- The next replace by ids keeps the filler as a wall root.

## Proposed fix

In roomle-ui on `feat/hi-mcp-improvements`, `hi-root-module-arrangement.ts`: **a root module that
regains its docking vectors seeds no cluster while another root module left to arrange has a
position.** "Regains" means it has none in `_originalGroup` and has them in the group being
arranged. Both seed choices take their candidates through the same filter:

```ts
private _regainedDockingVectors(root: PosModuleRootData): boolean {
  const original = this._originalGroup?.roots.find(
    (candidate) => candidate.id === root.id,
  );
  return (
    original !== undefined &&
    !original.dockInfos?.length &&
    !!root.dockInfos?.length
  );
}

// A root module the library calculates again stands where the failed
// calculation left it; its docking entries place it.
private _seedCandidates(roots: PosModuleRootData[]): PosModuleRootData[] {
  const placed = roots.filter(
    (root) =>
      root.articlePos !== undefined && !this._regainedDockingVectors(root),
  );
  return placed.length > 0 ? placed : roots;
}
```

`:1208` becomes `this._findRootClosestToZero(this._seedCandidates(nonGeneratedRoots))`, and
`_findRemainingSeedWithPosition` passes `remainingWithPosition` through `_seedCandidates`. The
breadth-first docking then reaches the recovered root module from its calculated neighbour by the
mirrored entry and places it, as it places any other root module of the cluster.

What changes:

- The reproduce: `dark1` and `dark2` keep `[1356,1360,0]` and `[2256,1360,0]`. `top1` and `top2`
  stand on them at `[1356,1960,0]` and `[2256,1960,0]`, back-aligned as the create asked.
- `carriersOfUnitsAbove` again finds `dark1 → prep`, `dark2 → dw`, `top1 → dark1` and
  `top2 → dark2`.
- No insertion height changes, so the attribute result reports none.
- The filler is no unit above any more, so the replace keeps `fridge rightOf fill` without a
  correction. This follows from `hi-tool-commands.ts:431-434`; the replay of the replace on the
  fixed code is part of the fix's verification.

What stays:

- Every flow without an original group (a create, a placement, an adjust: `allowRepositioning`).
- A recovery inside the first cluster.
- A cluster whose only positioned root modules regained their vectors, through the fallback.
- D95's applied group position (`rootModuleGainedOrLostDockingVectors`) and `keepWallDistances`.

**Tests (roomle-ui).**

- `__tests__/hi-root-module-arrangement-test.ts`, beside `it.each([0, 1])('uses the requested
  mode when original root %s has no vectors after a failed calculation')`:
  - `it('arranges a unit on top from its wall unit when the library calculates the unit again')`.
    The setup is a floor unit at the origin, a wall unit hanging 540 mm above it in its own cluster,
    and a unit on top docked `BackBottom` → the wall unit's `BackTop`, without docking vectors in
    the original group and at the floor unit's position. Expected: the wall unit keeps its position,
    the unit on top stands on it, and `carriersOfUnitsAbove` names no floor unit.
  - `it('seeds a cluster from a root that regained its docking vectors when no other root of it
    has a position')`.
- `__tests__/hi-tools-test.ts`, beside `:372`: `it('keeps the wall units in place when a
  change-module-attribute lets the library calculate a unit on top of them')`. It runs through
  `executeGroupOperation('change-module-attribute')`, with the `calculateGroup` spy failing the
  unit on top for one value and calculating it for the other, as the test at `:372` does.

The backlog's replace test (the filler first, the next unit `rightOf` it) checks the tool command on
a plan that is wrong before the call. `retainedWallRoots` already works on a correct plan and is
guarded by `it.each(…)('retains measured mounting unless replaced by new intent (relation: %s,
article: %s, gap: %s)')` (D85), so no tool-command test is added.

**Documentation.**

- roomle-hi-example: D95 in `docs/hi-mcp-behaviour.md` (the recalculation arranges from a root
  module the library calculated before, with the new tests) and the seed rule of
  `.agents/context/layout-and-placement.md:166`.
- roomle-ui: the seed sentence of `.agents/homag-intelligence.md:174` and the recovery paragraph
  `:189`.
- Item 95 leaves `.agents/backlog/mcp-issues.md` once the fix is implemented.

## Constraints and rejected approaches

- **Keep a root module that stands on the floor out of the units above** (`retainedWallRoots` or
  `carriersOfUnitsAbove`, the backlog's second option). This acts on the symptom: the plan is
  already broken before the replace, with wall units below the floor and units on top in the floor
  run. There is also no floor in group space to test against, since the kernel re-anchors the
  origin and the plan context reports this group at y −600.
- **Count filler panels as floor units** (`isFloorUnitArticle`). That puts library content in the
  tools' logic (§2.4). D85 gives an unmatched category no floor evidence on purpose.
- **Clear the recovered root module's `articlePos` before the arrangement.** The effect on the
  seeds is the same, but it changes the group that `keepWallDistances`, the carrier lookup and the
  kernel's centre-keeping read. The seed choice is the one place that decides.
- **Give the failed root module its intended place at the create** (copy docking vectors). D95
  rejects this: its front stays unbuilt and the vectors go stale.
- **A served rule against editing a root module the library could not calculate.** The edit is the
  recovery D95 asks for, and the agent did the right thing.
- **Changing the library's door settings for a 900 mm single door.** That is not a valid fix (the
  library is taken as it is), and it would only hide the arrangement defect for this one value.

## Verification

Run on 2026-10-21 on roomle-ui `feat/hi-mcp-improvements` `c92cf6b11`. That is the run's planner
code plus `c92cf6b11` itself, which only changes a type declaration.

- **Replay.** A headless replay of the run's three plan-changing planner calls on the start plan.
  It used Playwright, the example page on :3002 and a roomle-ui dev server on :5174, and sent the
  recorded arguments through `window.instance.extended.externalObjectGroupOperation`, with the ids
  mapped to the replay's. It returned the run's corrections and the positions of the trace.
- **The arrangement alone.** A temporary vitest beside `hi-root-module-arrangement-test.ts` ran
  `HiRootModuleArrangementOperator` on the replayed groups: the group after the create as the
  original, the same group with the top units' recalculated docking vectors as the input. It gives
  `dark1` at y −600 and `fill → dark1`. With the top units' placeholder positions removed, which is
  what the proposed seed rule does, it gives `dark1` in place, `top1` at `[1356,1960,0]` and no
  floor root module carried.

The replay script, the fixture and both outputs are kept in `.temp/verify-mcp-95/`. The temporary
test was deleted. No production or permanent test code changed, and no model was run.
