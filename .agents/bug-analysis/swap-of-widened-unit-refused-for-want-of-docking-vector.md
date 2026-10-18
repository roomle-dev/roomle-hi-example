# Bug analysis — a swap of a widened unit is refused for want of a docking vector

> **Type**: Bug analysis
> **Status**: Open — fix proposed, not implemented
> **Date**: 2026-10-18
> **Base**: roomle-hi-example `feat/mcp-test-report-scripts` (`980b506`); roomle-ui
> `fix/wall-unit-heights-after-plinth-change` (`8cfd98e71`), one commit on
> `fix/room-corners-at-openings` (`a008be42d`) — the branch every roomle-ui change for this bug
> must be based on
> **Backlog**: item 78 of [`../backlog/mcp-issues.md`](../backlog/mcp-issues.md)

## Affected repositories

- **roomle-ui** — the proposed fix: `_takeOverPropertiesFromOriginalGroup`
  (`packages/web-sdk/packages/homag-intelligence/src/glue-logic.ts:3287`), the one step that
  rebuilds a recalculated root's properties, takes over the original root's `dockInfos` when the
  calculated root has none — with the start/end points recomputed from the calculated root's
  geometry (trace 3, the caveat of the fix). Unit tests in `__tests__/hi-tool-commands/`. The fix
  is based on `fix/room-corners-at-openings`. `swapRootModules` (`hi-tools.ts:908`) and the plan
  context (`hi-plan-context.ts:311,704`) read the inventory correctly once it is kept; they need
  no change.
- **roomle-hi-example** — this analysis and backlog item 78 (the cause and the responsible
  updated with the analysis). No code change: the agent's two calls are legitimate planning, and
  the stored test `edit-swap-units` already covers the outcome.
- **RoomleCore (the planner kernel)** — no change expected. The kernel's C++ reads `dockInfos`
  only on the way in (`src/configurator/external/deserializer/external-module-group-deserializer.cpp:112`)
  and writes none; the vectors it derives for docking are computed fresh from the root module's
  docking vector definitions
  (`src/configurator/external/docking/external-module-group-docking-vectors.cpp`). Named because
  the open question below — whether the recalculated group loses the dockInfos in the kernel's
  calculation or in the library's calc.js — is kernel-adjacent, and because the fix's caveat
  names the kernel's derivation as the neutral source for the vector points.
- **The library (HOMAG Furniture_Smith, server-side calculation)** — no change proposed. The
  tempting library-side fix — the calc.js re-attaching the docking vector definitions to its
  recalculated roots — changes the data the library calculates, and suggesting a change of the
  library's calculation is not a valid bug fix (Rejected approaches). Named because open question
  1 asks whether the calc.js's returned group is where the dockInfos are dropped; if the answer
  traces a real defect in the library's own calculation — code that works against its overall
  intention — it is reported like the items of
  [`../backlog/library-issues.md`](../backlog/library-issues.md), not proposed as this bug's fix.
- **ligna-store** — no change: the store runs the same roomle-ui and planner and holds no copy of
  the tool command.

## Symptom

`change-module-attribute` `mod_Width` 900 on the last unit of a row leaves the recalculated root
module without docking vectors (`dockingVectors: []` in `get-plan-context`); the following
`swap-root-modules` drops the side docking with a correction ("'…' has no docking vector
'RightBottom' - its docking to '…' was dropped"), applies undocked, and the model undoes the swap,
so the plan keeps the original order.

**Reproduce.** `mcp-test-2026-10-18_08-45-09`, gpt-6.1-sol 32 (`edit-swap-units`, plan
three-tall-units, the prompts "make the last unit 900 mm wide" and "swap the first and the last
unit"; run directory
`.temp/result/mcp-test-2026-10-18_08-45-09/gpt-6.1-sol/32-edit-swap-units/`). The row is group
`064a7d91-b583-4883-b71b-95c324d3d824` with the `HTB60` roots `0010443c-519a-437b-8fe5-364f13887ca4`
(first), `a7271f1b-50d5-4b50-97ca-7a5bf75f77fa` (middle) and `8774cac2-8b83-405d-b88c-f0e5cd2452fb`
(last, against the wall).

Turn 1, `change-module-attribute` `{"rootModuleId":"8774cac2…","attributeId":"mod_Width","value":900}`
— no correction, no error.

Turn 2, `swap-root-modules`
`{"groupId":"064a7d91…","rootModuleIds":["0010443c…","8774cac2…"]}` — the correction:

```
swap-root-modules: '8774cac2-8b83-405d-b88c-f0e5cd2452fb' has no docking vector 'RightBottom' - its docking to 'a7271f1b-50d5-4b50-97ca-7a5bf75f77fa' was dropped
```

followed by `undo`. The model's answer: "I couldn't complete the swap: the 900 mm unit lacks the
connection needed in the first position, and the result extended past the room wall. I undid the
change, so the original order and 900 mm width are preserved."

The final `plan-context.json` — the state after the undo, that is the state turn 1 produced — has
the widened root `8774cac2` with `dockingVectors: []` and `freeDockingVectors: []`, while the other
two `HTB60` roots carry all six vectors (`LeftBottom`, `LeftTop`, `RightBottom`, `RightTop`,
`BackBottom`, `BackTop`).

In `mcp-test-2026-10-17_18-40-40` (gpt-5-mini 32) the same defect is worse: the same correction,
the widened root with zero docking vectors, no undo — the applied swap also removed the unit's
front and left two overlapping units.

## Investigation trace

1. **The empty dockInfos predate the swap — two independent proofs.** The undo of turn 2 restores
   the group to its turn-1 state; the final plan context is that state, and it shows
   `dockingVectors: []` on the widened root — the width change (turn 1) left them empty. The swap's
   own correction proves it independently: `handOver` (`hi-tools.ts:954-972`) builds the correction
   from `dockingVectorNames(newOwner)` — the dockInfos of `groupItem.posDataJson` read before any
   swap mutation (the contextData rewrite at `hi-tools.ts:978-990` runs before the articlePos swap
   and before `arrangeAndLoad`), and `swapRootModules` never mutates `dockInfos`. The correction
   names 'RightBottom' missing on `8774cac2`, so its dockInfos were already empty when the swap
   started.
2. **The recalculation chain of turn 1, and the one step that rebuilds the root.** The
   `change-module-attribute` tool command (`hi-tool-commands.ts:774`) builds one `change-attributes`
   command per group (no moduleId in the call) with the payload
   `{groupId, attributes:[{attributeId, value, rootModuleIds}]}`. `changeAttributes`
   (`hi-tools.ts:456`) resolves the attribute targets and runs the group operation;
   `modifyAttributesOfModules` (`glue-logic.ts:2650`) solves the attribute conflict, sets the value
   (`_setAttribute`, `isInput = true`) and calls `_calculateAndUpdateGroupMap`
   (`glue-logic.ts:2682` → `:1983`), which runs `_runGroupCalculation` (`glue-logic.ts:2014`):
   `recalculatedGroup = this._calculate(groupData.posDataJson)` (`:2019`) → `_calculate`
   (`:3065`) → `_updatePosData` → `libraryData.calculateGroup(posGroup)` (`:3069`) — which is the
   library's calc.js (`homag-intelligence.ts:159-161`:
   `calculateGroup: (groupData) => libraryExports.calc(groupData)`; loaded from the Roomle
   backend via `libLoadCalcScript`, `minimal-hi-example/index.html`) — and then
   `_takeOverPropertiesFromOriginalGroup` (`:3272` call, `:3287` definition). That step takes over
   the position and rotation, the contextData (only when the calculated root lacks it),
   libraryId, articleName/articleId, imageUrl, desc, category, additionalText and canBeDeleted —
   **but not `dockInfos`**. The arrangement may run a second `_calculate`
   (`_arrangeRootModulesAndCalculateIfChanged`, `glue-logic.ts:3083`, second calculation at
   `:3116` when the arrangement moved something). `_storeCalculatedGroup` (`:2049`, definition
   `:2063`) stores the result in the group map; `loadWithChangedAttributes` (`:2178`) loads it into
   the planner with `HI_LOAD_OBJECT_REASON.CHANGE_ATTRIBUTE`. `glue-logic.ts` mentions `dockInfos`
   only at `:336` (`uniqueDockingVectorIndex`) and `:352` (the `transferDockingContext` comment) —
   nothing in the recalculation chain restores them.
3. **The swap reads the inventory and drops the docking.** `swapRootModules` (`hi-tools.ts:908`)
   checks the corner pair, removes the top side links (`removeDockingEntries`), re-aims the bottom
   side dockings at the other root, then hands the side contexts over (`handOver`,
   `hi-tools.ts:954`): a dockedContext survives only if
   `dockingVectorNames(newOwner).includes(dockedContext.ownDockingVector)`, where
   `dockingVectorNames` (`hi-plan-context.ts:311-315`) maps `root.dockInfos` to ids, excluding
   `CollisionBox`. `firstSideContexts` = [RightBottom→a7271f1b, RightTop→a7271f1b] handed to
   `second` (`8774cac2`): `dockingVectorNames(8774cac2)` = [] → 'RightBottom' not included → the
   correction at `hi-tools.ts:967`, the docking dropped. The swap then applies undocked
   (`arrangeAndLoad`) — a correction, not a guard. The plan context serves the same inventory
   (`dockingVectors: dockingVectorNames(root)`, `hi-plan-context.ts:704`), hence
   `dockingVectors: []` in `get-plan-context`.
4. **The planner's docking re-resolution half-docks the row.** Run 32's `plan.xml`: `8774cac2` has
   `dockInfos: []` but keeps its own `dockedRoots` [LeftBottom→a7271f1b, LeftTop→a7271f1b];
   `a7271f1b`'s `dockedRoots` lost the Right*→`8774cac2` entries. In run 16's `plan.xml` (widening
   the first unit, trace 5) all three roots have six dockInfos and the full dockedRoots. So the
   scene and the group map disagree after the failing call: the widened root keeps its left
   docking, the middle root loses its right docking — the half-docked row behind the
   overlapping-units result of the 18-40-40 run.
5. **The controls isolate the width change on the last unit.** Same session, same build:
   - Run 16 (`edit-change-one-unit`, "make the first unit 900 mm wide"):
     `change-module-attribute` `mod_Width` 900 on the FIRST unit `0010443c` — the final plan
     context has all three `HTB60` roots with six docking vectors.
   - Run 24 (`edit-replace-unit-wider`, "replace the middle unit with a 900 mm wide tall cabinet
     with drawers"): `exchange-root-module` creating an `HTS2AB60` w900 — fine.
   Within one build, widening the first unit keeps the vectors and widening the last loses them;
   the two calls differ only in which root carries the new width. Hypothesis, not traced further
   (the calc.js is server-side library code): the arrangement's second `_calculate`
   (`glue-logic.ts:3116`) fires for the wall-side unit — `keepWallDistances` repositions the row
   when the last unit grows into the wall distance — and not for the first.
   - Across sessions: `mcp-test-2026-10-17_13-28-41` (gpt-6-astra 32, planner build `b2dbcb202`):
     the same two calls, no correction, the swap succeeded, all roots keep six vectors.
     `mcp-test-2026-10-17_18-40-40` (gpt-5-mini 32) and the reproduce run lose them. The roomle-ui
     sources of both operations (`glue-logic.ts`, `hi-tools.ts`, `hi-plan-context.ts`) are
     identical between `b2dbcb202` and the investigation checkout `8cfd98e71`; the kernel WASM pin
     is identical (`packages/web-sdk/package.json` has no diff between them); roomle-hi-example
     between the sessions differs only in docs. The deployed planner build of the failing sessions
     is not recorded in the runs — the difference is in the deployed library calc.js or kernel
     build, or nondeterminism in the calc.
6. **Empty dockInfos are a tolerated state, so the loss went unnoticed.** `getDockingVectorBox`
   (`hi-root-module-arrangement.ts:104-126`) skips roots without dockInfos, and the docking setter
   logs "dockInfos is missing for root …" and returns (`hi-root-module-arrangement.ts:843-846`).
   Generated roots legitimately have none (the `mr_Toekick` of the same group), so nothing flags a
   calculated article root that lost them.

## Root cause

The recalculation behind `change-module-attribute` — `changeAttributes` (`hi-tools.ts:456`) →
`modifyAttributesOfModules` (`glue-logic.ts:2650`) → `_runGroupCalculation` (`glue-logic.ts:2014`)
→ `_calculate` (`glue-logic.ts:3065`) → the library's calc.js (`homag-intelligence.ts:159-161`),
possibly twice via `_arrangeRootModulesAndCalculateIfChanged` (`glue-logic.ts:3083`, `:3116`) —
can return the width-changed root module without its `dockInfos`, and the one step that rebuilds
the root's properties, `_takeOverPropertiesFromOriginalGroup` (`glue-logic.ts:3287`), restores
position, rotation, contextData and article info but not the dockInfos. The group map then holds
the widened root without docking vectors (`glue-logic.ts:2049,2063`), the plan context serves
`dockingVectors: []` (`hi-plan-context.ts:311,704`), the planner's docking re-resolution drops the
neighbour's side dockings to it (trace 4), and the swap's `handOver` (`hi-tools.ts:954-972`) drops
the side docking with the correction at `:967` and applies undocked.

## Why the current code produces wrong results

`_takeOverPropertiesFromOriginalGroup` was written for recalculations that legitimately change
root properties; the dockInfos were simply not in its list, and nothing else in the chain
restores them (trace 2). The swap trusts `dockInfos` as the root's vector inventory and reads a
missing vector as "this docking cannot exist on the new owner" — right when the vectors genuinely
differ (a corner article carries different vectors), wrong when the inventory was lost. And
because a correction is not a guard, the swap applies in the broken state; the planner's
re-resolution then half-docks the row (the widened root keeps its left docking, the middle root
loses its right), which is the overlapping-units result of the 18-40-40 run. The model reads the
correction, cannot repair the payload — the width change is legitimate — and undoes.

## Proposed fix

Keep the docking vectors across the recalculation, in roomle-ui: `_takeOverPropertiesFromOriginalGroup`
(`glue-logic.ts:3287`) takes over the original root's `dockInfos` when the calculated root has none
— the same take-over step that already restores the contextData, one property earlier in the same
loop.

The caveat the implementation must settle: a dockInfo's start/end points are geometry, and a width
change moves them (the Right* vectors of a 600 mm unit start at x=600, of a 900 mm unit at x=900).
A wholesale take-over would serve stale endpoints to `getDockingVectorBox`
(`hi-root-module-arrangement.ts:104-126`, the group's docking box for placement), the `rootPoints`
fallback (`hi-plan-context.ts:466`) and `cornerPointOfRoot` (`hi-plan-context.ts:338`, corner
articles only). The clean fix therefore re-derives the points from the calculated root's geometry
— the docking vector definitions are per-module and unchanged by a width change, and RoomleCore
derives fresh vectors from `rootModule->getProperties().dockingVectors.vectors`
(`src/configurator/external/docking/external-module-group-docking-vectors.cpp`), which is the
neutral source to read.

The fix is the roomle-ui take-over alone; no library-side alternative is proposed (Rejected
approaches).

## What the fix does not do

- It does not change `handOver` (`hi-tools.ts:954-972`) or the plan context: they read the
  inventory correctly once it is kept.
- It does not change the served text: the agent's two calls are legitimate — widen the last unit,
  swap the first and the last — and the tool must build both.
- It does not touch the planner's checks: the docking re-resolution on load stays as it is.
- It does not give generated roots docking vectors: the take-over fires only when the calculated
  root lost vectors the original had — a generated root has none in either (trace 6).

## Rejected approaches

- **Make `handOver` keep the docking despite the missing vector** (`hi-tools.ts:954-972`). Hides
  the symptom: the plan context would still serve `dockingVectors: []`, the planner's
  re-resolution would still drop the neighbour's side dockings (trace 4), and the next edit would
  hit the same wall. The root cause is the lost inventory, not the swap's reading of it.
- **A guard that refuses the swap.** The agent's swap is legitimate; the missing vector is the
  tool's product, not the agent's input ([Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort)).
- **A served-text change.** Nothing in the instructions misleads the agent; both calls are correct
  planning.
- **A RoomleCore change.** The kernel only reads `dockInfos`
  (`external-module-group-deserializer.cpp:112`) and derives the docking vectors fresh from the
  root module's definitions (`external-module-group-docking-vectors.cpp`); the loss is not in the
  kernel's sources.
- **A change in the library's calculation** — the calc.js re-attaching the docking vector
  definitions to its recalculated roots. It changes the data the library calculates, and the MCP
  deals with the library as it is: it explains the library's behaviour and capabilities to the
  agent, so the fix belongs in the MCP server and the tools and API of roomle-ui. This is not a
  hard rule — the library has code, and a real bug in it that works against its overall intention
  (a calculation formula that computes the wrong thing) is a valid library fix, reported like the
  items of [`../backlog/library-issues.md`](../backlog/library-issues.md) — but "make the calc keep
  the dockInfos" asks the library to calculate differently so the MCP stops seeing the defect.

## Test

`edit-swap-units`: after `change-module-attribute` `mod_Width` 900 on the last unit, the widened
root keeps its six docking vectors and `swap-root-modules` swaps without a correction — the row is
2100 mm with the 900 mm unit in the back corner. A unit test in roomle-ui
`__tests__/hi-tool-commands/`.

## Implementation plan (sketch, roomle-ui, based on `fix/room-corners-at-openings`)

1. Reproduce in a roomle-ui unit test: a three-root row, `changeAttributes` `mod_Width` 900 on the
   last root, assert the widened root keeps its six dockInfos. The test's library stub returns a
   root without dockInfos, mirroring the deployed calc — this pins the loss inside roomle-ui's
   chain, independent of the deployed calc.js.
2. `_takeOverPropertiesFromOriginalGroup` (`glue-logic.ts:3287`): when the calculated root has no
   `dockInfos` and the original root has some, take them over — with the start/end points
   recomputed from the calculated root's geometry. Settle in implementation whether the points
   are recomputed in roomle-ui or re-derived from the calculated root's docking vector definitions
   (the kernel's derivation, trace 2).
3. `__tests__/hi-tool-commands/` — the `edit-swap-units` scenario end to end: widen the last unit,
   swap the first and the last, no correction, the row 2100 mm with the 900 mm unit in the back
   corner; plus a case that widening the first unit still keeps the vectors (the run-16 control,
   trace 5).
4. If a run still shows the loss after the take-over, trace open question 1 (where the dockInfos
   are dropped). A real defect in the library's own calculation — code that works against its
   overall intention — is reported like the items of
   [`../backlog/library-issues.md`](../backlog/library-issues.md); the fix of this bug stays in
   roomle-ui either way.

## Open questions

- **Where exactly the dockInfos are dropped** — in the library calc.js's returned group, or in a
  step between the calc and the store — is not traced to the line. The calc.js is server-side
  library code (loaded from the Roomle backend via `libLoadCalcScript`,
  `minimal-hi-example/index.html`); RoomleCore's C++ only reads dockInfos
  (`external-module-group-deserializer.cpp:112`) and writes none. The roomle-ui fix stands
  regardless: the take-over step is the one place that rebuilds the root's properties, and it
  skips dockInfos.
- **Why the same payload keeps the vectors in `mcp-test-2026-10-17_13-28-41` (planner build
  `b2dbcb202`) and loses them in the two later sessions** (trace 5): the deployed planner build of
  the failing sessions is not recorded in the runs; the difference is in the deployed library
  calc.js or kernel build, or nondeterminism in the calc.
- **Why widening the first unit keeps the vectors and widening the last loses them within one
  build** (trace 5): hypothesis — the arrangement's second `_calculate` (`glue-logic.ts:3116`)
  fires for the wall-side unit and not for the first; not traced into the calc.js.
