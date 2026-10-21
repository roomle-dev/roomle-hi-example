# Bug analysis — repairing a root module the library could not calculate moves its group through the wall

> **Type**: Bug analysis
> **Status**: Open — reproduced without a model; fix proposed and checked in the live planner, not implemented
> **Date**: 2026-10-21
> **Base**: roomle-ui `feat/hi-mcp-improvements` (`a40887e99`); roomle-hi-example `master` (`80655b5`);
> the bo-test planner (the same `hi-tools.ts`, `glue-logic.ts` and `hi-root-module-arrangement.ts`
> as the roomle-ui base); RoomleCore `master` (`f4352517f`) for the kernel trace
> **Backlog**: [item 86](../backlog/mcp-issues.md#86-a-swapped-row-of-different-unit-widths-stands-through-the-wall)

## Affected repositories

- **roomle-ui** (`feat/hi-mcp-improvements`) — the glue logic of the planner. After a calculation in
  which a root module has no docking vectors, before or after the change (the library could not
  calculate it, D95), the load applies the group position. The kernel then keeps the group where
  the glue logic keeps it. `_runGroupCalculation`
  (`packages/web-sdk/packages/homag-intelligence/src/glue-logic.ts:2029-2075`) sets the flag that
  the loads read: `updateAttribute` (`:2148-2156`), `loadWithChangedAttributes` (`:2193-2205`) and
  `arrangeAndLoad` (`:2618-2621`). The footprint check of `keepWallDistances`
  (`hi-root-module-arrangement.ts:541-553`) becomes a shared helper. The tests go in
  `homag-intelligence/__tests__/glue-logic-test.ts` and `hi-root-module-arrangement-test.ts`, and the
  flag's paragraph in roomle-ui `.agents/homag-intelligence.md:175` is updated.
  `swapRootModules` (`hi-tools.ts:1031-1129`) does not change: the swap keeps the row where it finds
  it.
- **roomle-hi-example** — documentation only: D95 of `docs/hi-mcp-behaviour.md` (its "keeps the
  group transform" names the applied group position and the new guarding test) and the backlog.
  The fix runs in the planner (web-sdk), so it reaches the example and the ligna-store with the
  bo-test deployment. No embedding-lib pin.

ligna-store needs no change; it loads the same planner. RoomleCore needs no change (see
Alternatives). The library calculation needs no change either. Error 14019 for a 900 mm HTB60 with
a single-door hinge is the library's answer to an invalid combination. Its description is
library-issues 78.

## Symptom

`edit-swap-units` (plan `three-tall-units`, "make the last unit 900 mm wide", then "swap the first
and the last unit") ends with the row at z −4365..−2265. The back wall is at z −3765, so the row
stands 600 mm through it. The backlog item blames the swap, but the swap is not the cause: the row
is already 600 mm in the wall before the swap. The move happens on the agent's correction of the
widened unit, the change that lets the library calculate it again.

## Reproduction

The reproduction needs no model. It replays the reproduce's planner calls in the example page:

- page on :3001, bo-test planner, headless Chromium;
- `window.instance.extended.externalObjectGroupOperation` for each call;
- the glue logic's `loadPosGroups` wrapped in the planner frame, to log what the glue logic sends
  and what the kernel answers (the `plan_changed` load that follows).

Plan `three-tall-units` (`ps_s3p5hmscmmsnshopj2tybjwmt7ijy5o`): group `064a7d91` on the right wall,
pos [4815, 0, −3765], rotation 270. Its roots are `0010443c` (A, in the back corner), `a7271f1b` (B)
and `8774cac2` (C), all HTB60 at 600 mm, z −3765..−1965. The local x axis of the group runs along
the wall, towards +z in the room.

| Step | Call | The glue logic sends | The kernel answers | The row in the room |
|---|---|---|---|---|
| 1 | `change-module-attribute` `mod_Width` 900 on C | pos z −3765, A 0 / B 600 / C 1200; C without docking vectors (Error 14019) | pos z −3765 | z −3765..−2565, C failed |
| 2 | `change-module-attribute` `mod_DoorDirectionSelection` `LeftRight` on C | pos z −3765, A 0 / B 600 / C 1200, C 900 mm with docking vectors | **pos z −4365** | **z −4365..−2265: 600 mm through the back wall** |
| 3 | `swap-root-modules` A, C (`rearrange`, `applyGroupPosition`) | pos z −4365, C 0 / B 900 / A 1500 | pos z −4365 | z −4365..−2265: the swap keeps the wrong place |

The item's original run `mcp-test-2026-10-19_10-57-22` is no longer kept locally. The replay ends
on its numbers exactly: group pos [4815, 0, −4365], row z −4365..−2265. The two later runs
(`mcp-test-2026-10-20_12-45-30` and `_19-13-28`, gpt-6-astra 36) did not exercise it: the model
undid the failed widening instead of correcting the door.

Variants of the same replay:

| Variant | Result |
|---|---|
| Step 2 sets C back to 600 mm instead of the door | the kernel answers pos z −4215: the group moves 450 mm |
| A fails (door `Right`, then `mod_Width` 900) and is repaired (door `LeftRight`) | the failing load moves the group: A stands at z −3915, 150 mm through the back wall, and stays there after the repair |
| A is widened to 900 mm (calculates at once), then A and C are swapped | row z −3765..−1665 before and after the swap: a swap of different widths keeps its place |
| B is widened to 900 mm (calculates at once) | the group does not move |
| Steps 1–3 with `applyGroupPosition: true` forced on every attribute load | pos z −3765 after every step; after the swap C (900 mm) stands in the corner at z −3765..−2865, the row at z −3765..−1665: the expectation of `edit-swap-units` |
| A fails and is repaired, with `applyGroupPosition: true` forced | A stays at z −3765 throughout (on the failing load the kernel answers −3781 with every `articlePos` +16: the same room position) |

## Investigation trace

1. **The tool command** `change-module-attribute` (`hi-tool-commands.ts:909`) sends
   `change-attributes` to `changeAttributes` (`hi-tools.ts:534`). It calls
   `modifyAttributesOfModules` (`glue-logic.ts:2665`), which sets the value and calculates the
   group with `rearrange = _getArrangementCorrectionEnabled()` through `_calculateAndUpdateGroupMap`
   (`:1998`) and `_runGroupCalculation` (`:2029`).
2. **The calculation and the arrangement.** `_runGroupCalculation` lets the library calculate and
   then arranges against the group before the change (`_arrangeRootModulesAndCalculateIfChanged`,
   `:3232-3267`). In step 2, C regains its docking vectors at 900 mm. The arrangement starts from A at
   the origin and puts B at 600 and C at 1200. Nothing moves: `changed` is false and
   `keepWallDistances` does not run. Had it run, it would have kept the transform: it returns
   `false` as soon as either footprint misses the docking vectors of a root
   (`hi-root-module-arrangement.ts:541-553`, D95). `arrangementMovedGroup` (`glue-logic.ts:2059-2062`)
   stays false.
3. **The load.** `loadWithChangedAttributes` (`glue-logic.ts:2193-2205`) loads with the reason
   `change_attribute` and adds `applyGroupPosition` only when `arrangementMovedGroup` is set, which
   it is not here. The group it sends is right: pos z −3765, roots at 0 / 600 / 1200.
4. **The planner.** `_loadOrUpdateExternalObjectGroup` (`planner-core/src/roomle-planner.ts:2643`)
   passes `applyGroupPosition: false` (`:2658-2660`) to the kernel's
   `addOrUpdateExternalPlanObjects`.
5. **The kernel keeps one reference root in place.** After a configuration change, RoomleCore
   (`src/planner/configurable/configurable-object-position-update-operator.cpp`) keeps the group in
   the room by one root:
   - `findExternalObjectRoots` (`:266`) takes the best-ranked root of the old configuration
     (`findExternalObjectRoot`, `:288`). The ranking (`compareEntities`, `:54`) goes by module type,
     back corner vectors, wall contact, orientation and position.
   - `keepEntityPosition` (`:335`) keeps one of that root's docking vectors in place
     (`keepEntityPositionByDockingVectors`, `:341`).
   - It gives up when the root has no docking vectors in either configuration (`:349`). The kernel
     then keeps the root's center (`keepEntityPositionByCenterPosition`, `:439`).
6. **The displacement is the change of C's center.** In the failed configuration, C's center is at
   x 1050 of the group, 150 mm before its `articlePos` 1200. Calculated at 900 mm, the center is at
   1650, a move of −600. At 600 mm it is at 1500, a move of −450. Both match the kernel's answers
   exactly, so the kernel took C as its reference and kept its center. Which ranking criterion
   selects the failed C was not traced further. In the variant where A fails, the reference is A,
   which has no vectors in the new configuration. The same center fallback moves the group 150 mm.
   A root that calculates in both configurations keeps a vector, and nothing moves (the widening
   variants).
7. **The wrong position is kept from then on.** The kernel answers with the moved position
   (`respondWithPositionInPlan`), the glue logic stores it, and every later edit starts from it. The
   swap's `arrangeAndLoad` applies that position correctly, so the row stays where the kernel put
   it.

## Root cause

The glue logic keeps the group transform of a calculation in which a root module has no docking
vectors (D95), but it does not make the kernel keep it.

- The loads after the calculation apply the group position only when the arrangement moved the
  group: `loadWithChangedAttributes` (`glue-logic.ts:2193-2205`), `updateAttribute` (`:2148-2156`)
  and `arrangeAndLoad` (`:2618-2621`), all reading `arrangementMovedGroup`, set at `:2059-2062`.
- Without `applyGroupPosition` the kernel positions the group itself. It keeps a reference root in
  place.
- When that root has no docking vectors in the old or the new configuration, the kernel keeps its
  center instead. That is the case for the root module the library could not calculate. Its center
  moves from the failed geometry to the calculated one, and the whole group moves with it: 600 mm
  here, into the back wall.

The swap is not involved. `swapRootModules` and `arrangeAndLoad` keep the row exactly where they
find it (the variant "A widened, then swapped"). The cause the backlog item names does not occur:
`keepWallDistances` does not translate the swapped row, because the arranged box of the swap starts
where the original one does.

## Why the current code produces this result

The flag was made for one case: `keepWallDistances` moved the group, so the kernel has to apply the
new position. roomle-ui `.agents/homag-intelligence.md:175` describes this: "That load must then
carry `applyGroupPosition: true`, otherwise the kernel keeps the object where it is". For every
other attribute change, the kernel and the glue logic agree, because the reference root keeps a
docking vector in both configurations.

A root module the library could not calculate has no docking vectors (D95). That is exactly the
state in which the kernel falls back to the root's center. The center of the failed geometry is not
where the calculated root's center will be, and the failing load changes the center the other way.

## Proposed fix (roomle-ui)

1. **A shared footprint check.** `hasCompleteDockingFootprint(group)` in
   `hi-root-module-arrangement.ts` says whether every non-generated root has docking vectors with a
   start and an end. It is the check `keepWallDistances` makes inline (`:541-553`), and
   `keepWallDistances` uses the helper from then on.
2. **The load applies the group position when a footprint is incomplete.** In the arrangement block
   of `_runGroupCalculation` (`glue-logic.ts:2047-2063`), the flag that the loads read is also set
   when the group before the change (`arrangement.originalGroup`) or the calculated group has an
   incomplete footprint. Its name and doc say what it means: the load applies the group position
   because the arrangement moved the group, or kept its transform because a root has no docking
   vectors (for example `appliesGroupPosition`). The three loads read it as they do today.
3. **Nothing else.** The position the glue logic sends is the kernel's last answer
   (`respondWithPositionInPlan`), and the kernel applies `pos` and `articlePos` exactly on
   `applyGroupPosition`. RoomleCore guards this with
   `TEST_CASE("external configurable object - configured group position is applied exactly")`
   (`test/planner/configurable/plan-external-configuration-update-test.cpp:1121`). The forced
   variant shows the result: the row stays at z −3765 in every step, and the swap puts the 900 mm
   unit into the corner.

**Scope.** Only calculations in which a root's footprint is incomplete change. Every other
attribute load leaves the position to the kernel as today. The fix also covers the planner's own
attribute changes (`updateAttribute`, `modifyAttribute`), which have the same defect in the planner
UI, and an `exchange-root-module` whose new root fails (`arrangeAndLoad`). A library without
arrangement correction, or a calculation that adds or removes roots, stays as it is: the
arrangement block does not run for them.

## Alternatives considered

- **Fix the swap** (the backlog item's to-do: anchor the wall-side end of the arranged row, or clamp
  the group into the room). Rejected: the swap keeps the row in place, and the row is in the wall
  before it. Clamping a group into the room would also refuse what the user may want, a group
  outside the room ([Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort)).
- **Apply the group position on every attribute load.** Rejected for this bug: every attribute
  change would move from the kernel's anchor to the glue logic's. That includes rows whose end the
  kernel keeps today by a vector of its reference root: a behaviour change beyond this defect. The
  narrow condition covers exactly the state in which the kernel has no vector to keep.
- **Change the kernel:** never take a root without docking vectors in both configurations as the
  reference (RoomleCore `findExternalObjectRoots`). Rejected as the fix. The glue logic owns where an
  HI group stands after its arrangement, and the kernel's contract gives it the means to dictate
  that: `applyGroupPosition` (RoomleCore
  `.agents/context/docking-in-designer/arrangement-correction.md`, "What the kernel still owns"). A
  kernel change needs a RoomleCore release and would still guess an anchor that the glue logic
  knows. It remains a possible hardening of the kernel for other external objects.
- **Served text: tell the agent to undo a failed edit instead of correcting it.** Rejected: the
  agent's correction is right (D95 and C25 ask for it: "change the failing values"), and the planner
  must not move the group for it.
- **Copy the previous docking vectors onto the failed root.** Already rejected in D95: its front
  stays unbuilt, and after a resize the copied vectors are stale.

## Tests

roomle-ui:

- `__tests__/glue-logic-test.ts`, beside
  `it('keeps the change and logs the root module the library reports an error for')` (`:2699`):
  - an attribute change that makes a root fail loads the group with `applyGroupPosition: true` and
    the position of the group before;
  - an attribute change that recalculates a failed root loads with `applyGroupPosition: true`, the
    position unchanged and the roots at 0 / 600 / 1200. The setup is the door correction of the
    reproduce: a row at a wall, the failed root at the far end, recalculated at 900 mm;
  - an attribute change with complete footprints before and after loads without it, as today;
  - the existing test expects `{ reason: CHANGE_ATTRIBUTE }` for the failing load. Its expected
    options change wherever the arrangement runs in it.
- `__tests__/hi-root-module-arrangement-test.ts`: `hasCompleteDockingFootprint` for a group with a
  failed root, a generated root without vectors and a complete group. The existing
  `it.each(['before', 'after'])('keeps the group transform when the %s measurement omits a failed root')`
  (`:2035`) keeps passing.
- `__tests__/hi-tools-test.ts`: the swap tests stay as they are. A swap of different widths at a
  wall with a contour, asserting that the position stays, guards D41 for the swap (the backlog
  item's suggested test). It passes today.

The kernel's re-anchoring cannot be unit-tested in roomle-ui. The end-to-end check is the live
replay of the Reproduction, without forcing, on a planner that carries the fix: steps 1–3 end with
the row at z −3765..−1665 and C in the corner.

The prompt test `edit-swap-units` already expects "the row stays contiguous at 2100 mm and its back
end at z -3765". It passes once the fix is on bo-test and the model corrects the door instead of
undoing (library-issues 78).
