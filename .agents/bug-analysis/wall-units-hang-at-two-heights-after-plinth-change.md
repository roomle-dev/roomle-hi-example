# Bug analysis — the wall units hang at two heights after a plinth height in the group attributes

> **Type**: Bug analysis
> **Status**: Open — implemented and locally verified on working branches; not landed
> **Date**: 2026-10-17; validation 2026-10-18
> **Bases**: roomle-hi-example `master` (`6b7e7fc3`); roomle-ui
> `fix/room-corners-at-openings` (`a008be42d`)
> **Working branches**: `fix/wall-unit-heights-after-plinth-change` in both repositories
> **Backlog**: [MCP issue 72](../backlog/mcp-issues.md#72-the-wall-units-hang-at-two-heights-after-a-plinth-height-in-the-group-attributes)

## Affected repositories

- **roomle-ui** — fix the existing carrier-following geometry in
  `packages/web-sdk/packages/homag-intelligence/src/hi-root-module-arrangement.ts` and test its
  integration with the attribute calculation and load. Based on `fix/room-corners-at-openings`.
- **roomle-hi-example** — this analysis, issue 72, their indexes, the behaviour reference
  and relevant living documentation. No served-text or tool-schema change.

## Validation verdict

The symptom, the after-load application of group attributes, and the loss of non-touching
docking links are confirmed. **The original attribution to inconsistent backend library logic
and the proposed second insertion-height attribute command are not supported.** There is a
smaller fix in the existing roomle-ui arrangement path: follow the change of the carrier's
**docking top**, which can rise while its root position stays at y = 0.

The validated plan below replaces the original create-only re-hang proposal. The implemented
change also reaches existing-group attribute changes through their shared calculation path,
without another tool-specific implementation.

## Reproduction and measured evidence

Saved run: `.temp/result/mcp-test-2026-10-17_13-28-41/gpt-6-astra/49-image-kitchen-back-right-corner/`.
Inspect `planner-calls.json` call 11, the second `create-or-replace-groups`; `run.json` records its
corrections. Its group attributes include `mod_PlinthAreaHeight: 150`, against the default 100.
The wall row starts with `display1` (`OTB45`) `above: prep`; `display2` is `rightOf: display1`.
The hood is above the hob with `gapMm: 650`, and the shelf above the dishwasher with `gapMm: 600`.

The raw group is JSON in the XML-escaped `externalConfiguration` of `plan.xml`. Unlike the compact
plan context, it retains root positions and docking-vector coordinates. `order-data.json` gives
the same root positions and attributes; `plan-context.json` supplies rendered bounds.

| Root/article | Root y after the change | Docking bottom / top in group space | Relevant result |
|---|---:|---:|---|
| `prep` / `UTB60` | 0 | 0 / 870 | Top rises with the plinth; root stays on the floor |
| `fridge` / `HK260` | 0 | 0 / 2250 | Tall-unit top is 2250 |
| `display1`, `display2` / `OTB45` | 1480 | 1480 / 2200 | Both are 50 mm too low; target bottom 1530 |
| `hood` / `DU` | 1520 | 1520 / 2648 | Keeps the 650 gap above the hob's docking top 870 |
| `shelf` / `ORFB60` | 1470 | 1470 / 1830 | Keeps the 600 gap above the dishwasher's docking top 870 |

The final docking explains the differing outcomes without assuming different library rules:

- The two `OTB45` roots are docked only to each other, a separate cluster. Neither retains a
  link to the floor row.
- The hood retains its own reverse entry to the hob: `LeftBottom` → `LeftTop`, offset
  `[0, -650, 0]`. A lone unit can keep this entry when the kernel does not report a replacement
  context. The arrangement already tests this case.
- The shelf's `RightTop` touches the shorter tall unit's `LeftTop`; that surviving link explains
  its rise to top 1830. Its rise is not evidence of a library rule for shelves.

**Rendered bounds are not docking heights.** The hob's rendered top is 890 and the sink's 1233,
but their docking tops are both 870. Taking `obstacles.groups[].roots[].topMm + gapMm`, as the
original fix proposed, would incorrectly lift this correctly placed hood another 20 mm.

## Investigation trace and root cause

Paths below are relative to roomle-ui's `packages/web-sdk/packages/homag-intelligence/`, at
`a008be42d`.

1. `src/hi-group-layout.ts:141` (`hangGapOf`) computes the default gap from the tall, wall and
   base heights. Here it is 2100 − 720 − 720 = 660. `relationsToDocking` at line 170 compiles the
   relations. The initial base docking top 820 therefore hangs the cabinets at 1480.
2. `src/hi-tool-commands.ts:502` loads the group, places it at its wall, then calls
   `applyGroupWideAttributes` at line 543. `src/hi-tool-attributes.ts:363` applies non-group-setting
   attributes through `change-attributes`. The recorded corrections confirm insertion values
   of floor/tall units changing from 100 to 150.
3. `src/hi-tools.ts:456` (`changeAttributes`) calls `modifyAttributesOfModules`
   (`src/glue-logic.ts:2650`), which requests arrangement when the existing
   `enableArrangementCorrection` option is enabled. `_runGroupCalculation` at line 2014 calculates
   first, then `_arrangeRootModulesAndCalculateIfChanged` at line 3083 arranges, follows carriers,
   and recalculates if geometry moved. Arrangement ownership is already in this glue layer.
4. `src/hi-root-module-arrangement.ts:1011` arranges disconnected docking clusters independently,
   retaining the position of each cluster's seed. The wall pair therefore keeps its old height.
5. `carriersOfUnitsAbove` at line 141 recovers the carrier geometrically even without a touching
   link. On the saved group it finds display1 → prep, display2 → the corner root, hood → hob,
   and shelf → dishwasher. The two relevant floor tops have the same plinth delta.
6. **The missing part is in `moveUnitsAboveWithTheirCarriers`, line 216, especially line 277.**
   For a unit the arrangement left in place, it adds the carrier's root-position delta to the
   unit's root position. The base and corner roots remain at y = 0 when their docking tops rise
   by 50. The computed vertical delta is therefore zero. The helper knows which units should
   follow but does not account for the carrier's geometry changing above its origin.

This is a reproducible gap in shared arrangement logic, not an invalid agent payload. Different
surviving docking graphs can produce different outcomes for the same article. The saved run does
not isolate every library calculation stage, so it cannot establish the cause of every other
run cited in the original analysis. It does establish the wall-pair defect above.

## Corrections to the original analysis

- The library calculation is invoked locally as `libraryExports.calc(groupData)` in
  `src/homag-intelligence.ts:159`. Calling this an unreachable server-side recalculation was
  inaccurate; the library supplies the calculation code.
- An insertion-height attribute is not a portable API capability. `PosModuleAttribute` and
  `BaseMDAttributeInfo` (`src/model/oc-scripts-domain.model.ts:113,403`) contain no semantic role
  identifying one. Matching a library's id or description would introduce library knowledge.
  Accepting a calculated attribute in `changeAttributes` does not prove the library will honor it.
- The claim that an attribute command necessarily answers before its load is stale on this
  base: `changeAttributes` awaits `loadWithChangedAttributes`, which awaits `loadPosGroups`
  (`src/glue-logic.ts:2178`). The comment at `hi-tool-commands.ts:538` still gives that rationale;
  it is not evidence for adding another attribute command. Keep the current load/placement/material
  order for this fix; verify final geometry through the existing completion path.
- Undo is not an open step-count design question: `runToolCommand` at line 1262 reports one
  `historySteps` entry for a mutating tool, with the planner interaction holding the single step
  (D77/D79). The fix should introduce no extra tool command.
- `kitchen-back-right-corner` is not a deterministic regression: it asks for a kitchen and has
  neither a forced plinth value nor a height expectation. The recorded failing case is
  `image-kitchen-back-right-corner`. Neither prompt alone guarantees this payload.

## Fix plan

1. **Add the failing geometry regression first** in `__tests__/hi-root-module-arrangement-test.ts`,
   beside `describe('units above')`. Model a detached wall pair above floor roots whose positions
   stay fixed while their docking tops rise from 820 to 870. Require both cabinet bottoms to
   become 1530 and tops 2250. Confirm failure on the new branch before changing implementation.
2. **Extend the existing follower calculation in `hi-root-module-arrangement.ts`.** For a unit
   eligible for carrier following, preserve its measured docking clearance:

   ```text
   oldGap = oldUnitDockingBottom - oldReferenceDockingTop
   targetBottom = newCarrierDockingTop + oldGap
   targetRootY = currentRootY + targetBottom - currentUnitDockingBottom
   ```

   Use `getDockingVectorBox` in the same group frame. This incorporates both root translation
   and geometry change, and does not assume a unit's origin is its bottom. Keep the existing
   horizontal movement, rotation, bottom-up ordering, carrier overrides, rounding and tolerance.
   Preserve the rule that a unit already moved by docking keeps that placement; explicitly test
   geometry-only movement too so it cannot be lifted twice or undo an intentional height edit.
   Missing carrier/docking data supplies no invented height. Do not add attribute-id lookup,
   hang-link bookkeeping in the tool command, timers, or a second re-hang path.
3. **Verify the complete attribute operation** in `__tests__/glue-logic-test.ts`: a library fixture
   raises carrier docking tops without translating their roots, the real arrangement moves the
   wall pair, and the normal recalculation/load retains those positions. Assert loaded and returned
   geometry, retained group/root attributes, and unchanged horizontal placement. Keep the
   arrangement option's existing contract. Change glue logic only if this test demonstrates a
   necessary integration change; the expected productive change is the follower function.
4. **Verify the entry point and feedback.** The create path must still apply group attributes once
   after placement. Its regression belongs with the material tests in
   `__tests__/hi-tool-commands/create-or-replace-groups-placement-test.ts`, not the input-validation
   suite. Reuse the existing D59 comparison to report insertion-height changes when the library
   exposes them as inputs; do not promise or fabricate a correction for a calculated-only attribute.
   Check an existing-group attribute operation through the same shared path. Preserve one undo step.
5. **Replay the failing payload with the actual planner/library** and inspect the saved raw group,
   final plan context and images. Verify after the final callback/recalculation, then undo and redo.
   Only then mark the fix verified and update D35/D42/D59 and the relevant implementation reference
   in `docs/hi-mcp-behaviour.md`/`docs/implementation/`, plus roomle-ui's HI guidance. Describe the
   new invariant and guarding tests there; keep the investigation here until the fix lands.

This repairs the shared ownership point. It also benefits `change-group-attribute` and module
attribute edits that use the same arrangement path. It requires no change in RoomleCore,
HOMAG library data or ligna-store, and no change to `relationsToDocking`/`hangGapOf` or the served text.

## Unit-test plan

| Test | Fixture / assertion | Purpose |
|---|---|---|
| Detached wall row, fixed carrier origins | Two side-linked wall units at 1480; base/corner docking tops 820 → 870 at unchanged root y = 0; resulting bottoms 1530, tops 2250; x/z and rotation unchanged | Red regression for this bug |
| Smaller and negative changes | Parameterize carrier top changes +20 and −50, plus zero; move by exactly that delta, zero reports no movement | Prevent hard-coded 50 mm or lift-only behavior |
| Explicit clearances and nonzero local bottom | Clearances 600 and 650; a unit whose local docking bottom is 20; assert the resulting docking gap, not an insertion attribute | Preserve authored gaps and arbitrary origins |
| Already followed / deliberate placement | A surviving Top/Bottom link, a unit beside a tall unit, and an already moved unit; include a geometry-only lift | No double movement or override of a deliberate placement |
| Stacks and other operations | Bottom-up stacked units; keep existing translation, rotation and replacement-carrier cases; no carrier and generated-root cases | Guard shared arrangement behavior |
| Attribute operation with real arrangement | Fake only library calculation and kernel load; invoke the actual attribute operation, then assert the final loaded and returned group, including after recalculation; preserve attributes and option behavior | A helper-only fix must survive the glue path |
| Create routing and history | One material command after wall placement; final heights from the integration fixture; `historySteps: 1`; retain existing D59 reporting assertions | Keep tool result/undo semantics without a new correction command |

Use small anonymous geometry fixtures for the unit tests; a full saved kitchen is unnecessary.
The integration fixture must not move the wall row itself: that is the production function's job.
The first and attribute-operation regressions must fail before the fix. Mocked success of a
second `change-attributes` call would not test the cause or prove library support.

Acceptance for the recorded kitchen is specific: the **two default-hung cabinets** reach top
2250, the hood keeps its docking gap 650 and bottom 1520, and the shelf keeps gap 600 and bottom
1470. Explicit-gap units are not all required to share the tallest unit's top.

## Validation performed and remaining checks

- Confirmed both working branches; roomle-ui HEAD, its requested base and its local remote-tracking
  base all identify `a008be42d3dd01c3b1de563e112e0b8079b5f66d`. No fetch, merge or history rewrite.
- Read the recorded payload, corrections, raw `plan.xml`, `plan-context.json` and order data.
- Ran the actual `carriersOfUnitsAbove` and `moveUnitsAboveWithTheirCarriers` exports on a controlled
  before/after reconstruction from the saved raw group: lower the floor-root top vectors by 50
  for the before-state, lower the already-following hood/shelf by 50, leave the wall pair at 1480.
  The helper returns `false` and leaves both wall bottoms at 1480, where the expected result is
  1530. This is a deterministic geometry diagnostic, **not a fresh live planner reproduction**.
- Baseline: **3 test files, 190 tests passed**, using Node **24.12.0** (the repository pin):

  ```sh
  # roomle-ui/packages/web-sdk, with Node 24.12.0 on PATH
  npm run test -- --run \
    packages/homag-intelligence/__tests__/hi-root-module-arrangement-test.ts \
    packages/homag-intelligence/__tests__/hi-tool-commands/create-or-replace-groups-placement-test.ts \
    packages/homag-intelligence/__tests__/hi-tool-commands/run-tool-command-test.ts
  ```

  The first launch under the shell's Node 20.10.0 failed before collection because `styleText`
  was unavailable; rerunning with the repository pin passed. No dependency change was needed.
## Implementation and verification on the working branches

- Added the docking-clearance calculation to roomle-ui's existing
  `moveUnitsAboveWithTheirCarriers` path. The helper uses the old carrier top and wall-unit bottom,
  the new carrier top and wall-unit bottom, and retains the previous horizontal/rotation handling.
  It leaves a unit already moved by docking alone. No glue or tool-command code changed.
- Added the detached-pair regression and parameterized +50, +20, −50 and zero changes; explicit
  600/650 mm gaps, a nonzero local bottom, a stack, an already moved unit and a unit whose docking
  geometry already followed. The new regressions failed before the fix and passed after it. The
  actual `modifyAttribute` path is tested with library calculation moving only the carrier's
  docking top, including the arrangement option disabled. The existing create material test
  checks one group-attribute command after placement; the command tests check one history step.
- Full roomle-ui HI package suite: 18 files, 1,033 tests passed under Node 24.12.0. SDK lint:
  zero errors, one pre-existing unused-variable warning in `planner-core/__tests__/plan-view-model.ts`.
  SDK TypeScript and required format check passed.
- Replayed planner call 11 from the saved run against the local roomle-ui branch and the actual
  library. The raw plan and final context put both `OTB45` roots at 1530–2250, level with the
  `HK260` top 2250. The hood remains at bottom 1520, 650 above its carrier docking top 870;
  the shelf remains at bottom 1470, 600 above docking top 870. The top image was inspected.
  Undo removes the group; redo restores both cabinet tops at 2250. The create result reported
  the library's insertion-height changes through existing D59 feedback. D35 hang-gap
  derivation and D59 feedback needed no change; only the D42 behaviour text was updated.

The branch fix is locally verified. Issue 72 stays open until the roomle-ui fix lands.
