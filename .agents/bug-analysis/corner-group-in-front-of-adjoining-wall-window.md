# Bug analysis — a corner group stands in front of the adjoining wall's window

> **Type**: Bug analysis
> **Status**: Fixed
> **Ticket**: [RML-18201](https://roomle.atlassian.net/browse/RML-18201)
> **Date**: 2026-10-16
> **Base**: roomle-hi-example `master` (`5e384ca`); roomle-ui `feat/configurator-planning-assistant-RML-18085`
> (`67baffd7f`, its HI sources equal `release/bo-test` `b2dbcb202`)
> **Backlog**: item 66 of [`../backlog/mcp-issues.md`](../backlog/mcp-issues.md), removed with the fix

## Affected repositories

- **roomle-ui** — the fix: the obstacle hint of the HI tool commands (`obstacleHint`,
  `freeStretchesNote`, `homag-intelligence/src/hi-tool-hints.ts`), the two tool commands that pass
  it their wall placement (`create-or-replace-groups` and `place-group`, `hi-tool-commands.ts`) and
  their tests in `__tests__/hi-tool-commands/`. The fix is based on
  `feat/configurator-planning-assistant-RML-18085`.
- **roomle-hi-example** — the served sentences on the hint (`AUTHORING_RULES` and the description of
  `create-or-replace-groups`, `hi-mcp/hi-mcp-server/hi-mcp-server.ts`) and their test, D55 and §8 of
  [`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md), the tool reference
  ([`.agents/skills/hi-mcp-tools.md`](../skills/hi-mcp-tools.md),
  [`docs/hi-mcp-server.md`](../../docs/hi-mcp-server.md)), backlog item 66, this analysis.
- **ligna-store** — no change: the store runs the same MCP server and planner and holds no copy of
  the hint or the rule.
- **RoomleCore** — no change: the room contour and the window are right.

## Symptom

Test `image-only-no-text` (plan `ps_s04w4a2spp6ifskj43clh1y2g6r436i`, `default-room`, a galley
kitchen from `docs/images/kitchen-4.png` without text), gpt-6-astra, session
`mcp-test-2026-10-14_13-34-58`, run 48:

1. `create-or-replace-groups` creates the left run with the placement wall `left`, alignment
   `back`, `offsetMm` 450.
2. The result's `hint` names the wall unit at the back end of the run in front of the back wall's
   window.
3. The agent moves the group with `place-group` to `offsetMm` 650 — one more step, about 8 s.

The run directory of that session is no longer in `.temp/result`. The geometry below comes from
the rerun of the same test on the same plan (session `mcp-test-2026-10-16_11-57-20`, run 48, the
same units placed with `offsetMm` 600), shifted by the 150 mm of the reference's `offsetMm` 450.
The hint of the reference is the D55 example of `create-or-replace-groups` in §8 of
[`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md), with the same numbers.

## The geometry

| What | Where |
|---|---|
| Room | x −685 to 4815, z −3765 (back) to 1235 (front) |
| Left wall (wall 0) | x −685, from z −3765 (its start, the back corner) to z 1235 (its end, the front corner), 5000 mm |
| Window (back wall, wall 5) | x −450 to 1650, `fromEndMm` 235 to 2335 (the back wall ends at the left corner), 950 to 2170 mm |
| Strip in front of the window | x −450 to 1650, z −3765 to −3165 (600 mm, `WALL_STRIP_MM`), 950 to 2170 mm |
| Left run | fridge HK260 at the front end … drawers US2A30 at the back end, wall units OTB60, OTB60, hood DU, OTB30; footprint 2710 mm, root modules 2700 mm — the footprint begins 10 mm before the back-most root modules |
| Back end at `offsetMm` 450 | US2A30 0 to 870 mm — below the sill, clear; OTB30 1530 to 2250 mm, 403 mm deep (x −685 to −282), z −3305 to −3005 |
| Overlap of the OTB30 with the strip | x −450 to −282 (168 mm), z −3305 to −3165 (140 mm), height 1530 to 2170 mm |

At `offsetMm` 590 the OTB30 begins 600 mm from the back wall and touches the strip without
overlapping it. The agent's 650 clears it by 60 mm.

## Investigation trace

### The first placement: the served corner rule of the build

The reference ran on roomle-hi-example `340532f`. Its corner rule in `AUTHORING_RULES`
(`hi-mcp/hi-mcp-server/hi-mcp-server.ts:26` today) read:

> A group placed in a room corner reaches along the adjoining wall by its depth: a door or a window
> within that depth of the corner on the adjoining wall is in its way - choose the other corner, or
> an offsetMm past the opening's span.

The opening's span is measured along the back wall (`fromEndMm` 235 to 2335), `offsetMm` along the
left wall. "Past the opening's span" names no distance on the group's wall; the only number the
agent had near the corner was 235, and 450 is past it. The rule pointed the agent at the wrong
axis.

roomle-hi-example `7c26d9c` (2026-10-14 14:47, on master) changed the rule to:

> … when the user leaves the corner open, choose the other corner, or an offsetMm of at least 600 mm
> from that corner, which keeps the group out of the 600 mm strip in front of the opening.

In the rerun of 2026-10-16 the model placed both runs with `offsetMm` 600 in one call, without
`place-group`. The report of that session keeps item 66 open: one run that does not show it is no
fix.

### What the hint says

The create calls `obstacleHint` after the load and the wall placement
(`hi-tool-commands.ts:595-608`), `place-group` after its reload (`hi-tool-commands.ts:732-743`).

- `objectBlockers` (`hi-tool-hints.ts:292-333`) turns the window into the strip in front of it on
  its own wall: `stripInFrontOfWall(wall, [from, to], WALL_STRIP_MM)` (`hi-tool-hints.ts:316`,
  `hi-plan-space.ts:959-968`).
- `obstacleHint` (`hi-tool-hints.ts:426-503`) tests every root module of the groups of the call
  against the blockers; the OTB30 overlaps the strip (`volumesOverlap`, `hi-plan-space.ts:803-812`).
- `freeStretchesNote` (`hi-tool-hints.ts:379-410`) adds the free stretches of the root module's
  wall. Its wall is the one it faces away from (`wallOfRoot`, `hi-plan-space.ts:978-1005`): the
  left wall.
- `freeStretchesAlongWall` (`hi-plan-space.ts:1010-1055`) lays a strip as deep as the root module
  along the whole left wall, at its height, and takes out the span of every blocker that overlaps
  it — the window's strip included: it covers 0 to 600 mm from the left wall's start. The free
  stretch is 600 to 5000 from the start, returned as `fromEndMm` measured from the wall's end:
  **0 to 4400**.

The hint therefore reads (D55, §8):

> Root module 'w1' (OTB30) of group '…' stands in front of the window in the back wall (wall 5,
> fromEndMm 235 to 2335, 950 to 2170 mm) - free stretches of the left wall (wall 0) at its height:
> fromEndMm 0 to 4400. The groups were built as sent - move or change them if the user did not ask
> for them there.

The window does shorten the stretch. The backlog's cause sentence ("the free stretches of the root
module's own wall — which the adjoining wall's window does not shorten") is not accurate; the gap is
the frame the stretch is given in.

### The frame of the placement

The agent moves the group by `wall`, `alignment` and `offsetMm`:

- a side label as alignment resolves to the start or the end of the wall
  (`resolveWallAlignment`, `hi-plan-space.ts:1097-1119`): `back` on the left wall is its `start`;
- `wallSpanStart` (`hi-plan-space.ts:1122-1139`) measures `offsetMm` from that corner — from the
  start for `start`, from the end for `end`, from the middle for `center` — and for the group's
  footprint, not for a root module.

To keep the run in the back corner, the agent has to turn "fromEndMm 0 to 4400" on the left wall
into an `offsetMm` from the back corner: 5000 − 4400 = 600 for the root module, minus the 10 mm by
which the footprint begins before it, 590. Nothing in the hint names the wall's length, which end is
the back corner, or the root module's place in the group. The agent sent 650.

The served rule offers a direct path only for a free stretch at the wall's end: "a placement with
that wall, alignment end and offsetMm = the start of a free stretch puts the group on it"
(`hi-mcp-server.ts:26`). Here that would put the run into the front corner, away from where the
image has it.

### What the tool knows

The tool has every number it needs at the call of `obstacleHint`:

- the create resolves each wall placement before the load (`wallPlacements`,
  `hi-tool-commands.ts:383-408`: the spec of `wallPlacementSpec`, `hi-wall-placement.ts:467-476`,
  and the resolved wall of `resolveWallPlacement`, `hi-wall-placement.ts:480-501`) and places the
  group by `wallTarget` (`hi-tool-commands.ts:185-192`, `hi-wall-placement.ts:505-552`), whose
  `GroupPlacement` names the piece or face the group stands along (`along`) and `placedIn`
  (`hi-wall-placement.ts:272-280`, `348-393`);
- `place-group` has the same spec and placement (`hi-tool-commands.ts:643-664`, `706`).

`obstacleHint` receives neither (`ObstacleHintInput`, `hi-tool-hints.ts:412-420`).

## Root cause

1. **Served text — the corner rule** (`hi-mcp/hi-mcp-server/hi-mcp-server.ts:26` at `340532f`):
   "an offsetMm past the opening's span" sent the agent to the opening's span on the adjoining wall
   instead of a distance on its own wall. Clarified by `7c26d9c`, on master.
2. **Tool API — the hint answers in another frame than the placement** (`freeStretchesNote`,
   `hi-tool-hints.ts:379-410`; `freeStretchesAlongWall`, `hi-plan-space.ts:1010-1055`): it names the
   root module's free stretches in `fromEndMm` of its wall, while the agent places the group by
   alignment and `offsetMm` from the corner. The agent computes a number the tool can derive
   (Guards Are a Last Resort, step 2). Open.

## Why the current code produces this

`obstacleHint` is a test of the plan after the call: it knows the root modules and the blockers, not
the placement that put them there. Its free stretches serve a placement the agent has not made yet
— "choose a stretch … alignment end and offsetMm = the start of a free stretch". For a group that
is already placed into a corner and only needs to move away from it, the stretch is in the frame of
the wall's far end.

## Proposed fix

Result only, no change of the placement: the group is still built where the agent put it (D51,
D55).

**roomle-ui.**

- `obstacleHint` gets the wall placements of the groups of the call: per group id the spec
  (`wall`, `alignment`, `offsetMm` as the agent sent them) and the `GroupPlacement` of `wallTarget`.
  The create passes them from `wallPlacements` and the placements of the loop at
  `hi-tool-commands.ts:172-200`, `place-group` its `spec` and `placement`. Row edits
  (`withRowHints`, `hi-tool-hints.ts:211-251`) pass none.
- For a group placed at a wall (`placedIn` `wall`) whose root modules stand in the strip in front
  of a door or a window of another wall than their own, and whose own wall is the piece or face the
  group stands along: the spans along that wall of the strip and of those root modules
  (`spanAlongWall`) give the shift that moves the root modules out of the strip, away from the
  corner the strip lies at. The shifted span start of the group, turned back into the `offsetMm` of
  the sent alignment (the inverse of `wallSpanStart`: `start` → the span start; `end` → wall length
  − footprint width − span start; `center` → span start − (wall length − footprint width) / 2), is
  named once per group and opening, after its root module sentences, with the wall and alignment
  as applied — for example: "Group '…' stands clear of the window in the back wall at offsetMm 590
  with wall left and alignment back."
- Fallbacks, with today's hint unchanged: a door or a window of the root module's own wall (the
  free stretches and the rule's "alignment end" path serve it), a group placed by point, a corner
  article placed by its corner point (`placedIn` `corner` — its `offsetMm` moves the corner along
  one wall, off the other), and a shift that would make the group reach past the wall's other end.

**roomle-hi-example.**

- The served sentences on the hint — the last sentence of the obstacles rule
  (`hi-mcp-server.ts:26`) and the `create-or-replace-groups` description (`hi-mcp-server.ts:329`) —
  name the clearing `offsetMm` for a group placed into a corner in front of an opening of the
  adjoining wall. Shorter, not longer: one clause.
- D55 (§3) and the D55 rows of §8 of `docs/hi-mcp-behaviour.md` with the new hint text;
  `.agents/skills/hi-mcp-tools.md` (lines 82, 207), `docs/hi-mcp-server.md` (lines 496, 573),
  `.agents/skills/hi-authoring-rules.md` (lines 235, 299) and `.agents/skills/roomle-hi-concepts.md`
  (line 170) where they describe the hint's content.
- Backlog item 66 leaves `.agents/backlog/mcp-issues.md`.

## What the fix does not do

The hint arrives with the create's result; after a placement in the strip the agent still moves the
group, one step. The fix makes that step exact without the agent's arithmetic. The first placement
is the served rule's (root cause 1). The backlog's test ("the create places the left group clear of
the back wall's window, no `place-group` after it") checks the rule, not the hint, and the rerun of
2026-10-16 met it.

## Rejected approaches

- **Move the group out of the strip** (a correction): D55 builds a group where the agent puts it —
  the user may want a unit there — and `place-group` does not move a group off an opening. The
  server cannot tell a corner the user named from one the agent chose.
- **Measure the free stretches from the aligned corner instead of the wall's end**: it would change
  the frame of every hint and break the rule's "alignment end and offsetMm = the start of a free
  stretch"; D81 rejected stretches in another frame than the placement for the same reason.
- **A guard against a placement in the strip**: wrong content is an instruction problem first
  (Guards Are a Last Resort), and the user may want it (D51).
- **A longer served rule**: the rule names the 600 mm since `7c26d9c`; the remaining computation is
  the tool's to do.

## Fix

Implemented as planned on the branches `fix/corner-group-window-offset-hint-RML-18201` of roomle-ui
(based on `feat/configurator-planning-assistant-RML-18085`) and roomle-hi-example. The hint of the
reproduction now reads "… fromEndMm 0 to 4400. Group '…' stands clear of the window in the back
wall at offsetMm 590 with wall left and alignment back. …" (D55 in §3 and §8 of
[`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md)).

Validation: roomle-ui homag-intelligence 1020 tests pass (12 new), `lint:types:sdk`, oxlint and
prettier clean; roomle-hi-example `hi-mcp` 276 tests pass, `typecheck`, `lint` and `format:check`
clean. No model run and no live check.

## Implementation plan

Branches: roomle-ui `fix/corner-group-window-offset-hint-RML-18201` from
`feat/configurator-planning-assistant-RML-18085` (`67baffd7f`); roomle-hi-example
`fix/corner-group-window-offset-hint-RML-18201` (this branch). The paths of roomle-ui are under
`packages/web-sdk/packages/homag-intelligence/`.

### 1. The arithmetic — roomle-ui `src/hi-plan-space.ts`

- `clearingOffsetMm(wall, alignment, groupSpan, rootSpan, blockedSpan, toleranceMm)`, exported,
  beside `wallSpanStart`. The spans are measured along the wall from its start, as `spanAlongWall`
  returns them. Returns the `offsetMm` of the same alignment that moves the group out of the
  blocked span, or `undefined`:
  - the wall's length as `wallSpanStart` measures it;
  - a blocked span at the start (`from` ≤ tolerance) moves the group towards the end by
    `blocked.to − root.from`; at the end (`to` ≥ length − tolerance) towards the start by
    `blocked.from − root.to`; at both ends or at neither: `undefined`;
  - the new span start is `group.from` + the shift; a group that would reach past either end of the
    wall (beyond the tolerance): `undefined`;
  - `resolveWallAlignment` turns it into the `offsetMm`: `start` → the span start; `end` → length −
    width − span start; `center` → span start − (length − width) / 2; `Math.round(…) + 0`. Rounding
    to the millimetre stays within the 5 mm overlap tolerance.
- `wallsRunParallel(a, b)`, exported: the two walls face the same way or opposite ways (the private
  `sameAngle` on `facingRotationY` and `facingRotationY + 180`).

→ verify: the new `hi-plan-space-test.ts` cases pass.

### 2. The hint — roomle-ui `src/hi-tool-hints.ts`, `src/hi-wall-placement.ts`

- `hi-wall-placement.ts`: `export` the existing interface `WallPlacementSpec`; nothing else changes.
- `Blocker` gets `opening?: { wall: DerivedWall; name: string }`, set by `objectBlockers` for a door
  or a window: its wall and `` `${object.kind} in the ${wallName(wall.side)}` `` — the words the root
  module sentence already uses. The existing texts stay as they are.
- `export interface WallHintPlacement { spec: WallPlacementSpec; along: DerivedWall }` and
  `ObstacleHintInput.wallPlacements?: Map<string, WallHintPlacement>`, keyed by group id.
- A local `clearingNotes` per tested group with a wall placement: for each opening the group's
  sentences name (the blocker is in `found` of one of its root modules) whose wall does not run
  parallel to `along`:
  - the root modules of the group in that strip (`volumesOverlap`, before-filter not applied, so a
    replace counts the root modules that stood there already); when one of them does not stand
    along `along` (`wallOfRoot([along], root, WALL_STRIP_MM)`), no note;
  - `spanAlongWall(along, …)` of the group's floor corners (`floorCorners(rawGroup)`, the footprint
    the placement used), of those root modules together, and of the strip clipped to the wall;
  - `clearingOffsetMm(along, spec.alignment, …, OVERLAP_TOLERANCE_MM)`; `undefined` → no note;
  - the note: `Group '<id>' stands clear of the <name> at offsetMm <n> with wall <wall> and
    alignment <alignment>.` — `<wall>` and `<alignment>` as the placement was applied (after the
    parallel-alignment correction), `top` and `bottom` named `back` and `front` as the served rules
    name them, a wall index and `start`, `center`, `end` as they are.
- `obstacleHint` pushes a group's notes after its root module sentences, before the closing.
  `withRowHints` passes no placements, so row edits keep their hint.

→ verify: the existing `describe('obstacle hints')` tests pass unchanged.

### 3. The placements — roomle-ui `src/hi-tool-commands.ts`

- `placeAtWalls(planner, wallPlacements, corrections, placedAlong)`: after `wallTarget`, a placement
  with `along` (a group placed by its footprint, not a corner article by its corner point) is
  recorded as `placedAlong.set(resultId, { spec, along: placement.along })`.
- `create-or-replace-groups`: a `Map<string, WallHintPlacement>` passed to `placeAtWalls` and as
  `wallPlacements` to `obstacleHint`.
- `place-group`: `wallPlacements` with the group's `spec` and the final `placement.along` — after
  the as-built placement — when it has one. The early return of a group that already stands as
  asked stays without a hint.

→ verify: `UNIT_TEST=true npx vitest run --no-cache --config vite.build.config.mts
packages/homag-intelligence` in `packages/web-sdk`; `npm run lint:types:sdk` and
`npm run lint:code:sdk` at the roomle-ui root.

### 4. Served text and documentation — roomle-hi-example

- `hi-mcp/hi-mcp-server/hi-mcp-server.ts:26`, the last sentence of the obstacles rule: "… with the
  free stretches of its wall, and for a group placed at a wall in front of a door or a window of the
  adjoining wall the offsetMm that keeps it clear." `hi-mcp-server.ts:329`, the `hint` of the
  `create-or-replace-groups` description: "… with the free stretches of its wall and the offsetMm
  that clears an opening of the adjoining wall". The `place-group` description names no hint
  content and stays.
- `docs/hi-mcp-behaviour.md`: D55 (§3) gets the sentence of the clearing `offsetMm` with its
  fallbacks and the guarding tests; line 879 (§7); the D55 rows of §8 for `create-or-replace-groups`
  (line 1002) and `place-group` (line 1014) with the new example text.
- `.agents/skills/hi-mcp-tools.md` (lines 82, 207), `docs/hi-mcp-server.md` (lines 496, 573, 837),
  `.agents/skills/hi-authoring-rules.md` (lines 235, 299), `.agents/skills/roomle-hi-concepts.md`
  (line 170): one clause where they list what the hint names.
- Backlog: item 66 leaves `.agents/backlog/mcp-issues.md` (overview row and section) and
  `.agents/backlog/README.md` (line 13).

→ verify: `npm test` and `npm run typecheck` in `hi-mcp`; `npm run lint` and `npm run format:check`
at the root.

### 5. Commits

roomle-ui: one commit, the hint with its tests. roomle-hi-example: one commit, the served text, its
test, the documentation and the backlog. Then the analysis is closed out by "cleanup analyses". No
model run and no live check unless asked.

## Unit tests

### roomle-ui `__tests__/hi-plan-space-test.ts`

`describe('clearingOffsetMm')` on `WALL_RIGHT` (3000 mm, from the front corner to the back corner):

| Case | Group span | Root span | Blocked span | Alignment | Expected |
|---|---|---|---|---|---|
| blocked at the start | 100 to 1700 | 100 to 900 | 0 to 600 | `start` | 600 |
| blocked at the end, side label | 1400 to 3000 | 2200 to 3000 | 2400 to 3000 | `top` (the end) | 600 |
| centred | 700 to 2300 | 700 to 1500 | 0 to 800 | `center` | 100 |
| blocked in the middle | 0 to 1600 | 0 to 800 | 1000 to 1600 | `start` | `undefined` |
| group would reach past the other end | 0 to 2600 | 0 to 800 | 0 to 600 | `start` | `undefined` |

`describe('wallsRunParallel')`: `WALL_RIGHT` with itself and with `WALL_LEFT` — true; with
`WALL_TOP` — false.

### roomle-ui `__tests__/hi-tool-commands/create-or-replace-groups-placement-test.ts`

In `describe('create-or-replace-groups wall placement')`, with `createWallApi` (the 4000 x 3000 mm
room, rows of 800 mm base units 720 mm high) and its `obstacles` option. The base units are lower
than a window's sill, so the opening is a door: `windowBehindTheBackWall(300, 1200)` with kind
`door`, 0 to 2100 mm, and the same behind the front and the left wall.

- `it('names the offsetMm that keeps a group in the back corner clear of the back wall's door')`:
  two picks, wall `left`, alignment `back`, `offsetMm` 450, door in the back wall at x 300 to 1200.
  The back root module stands in its strip; the hint: its sentence with "free stretches of the left
  wall (wall 3) at its height: fromEndMm 0 to 2400", then "Group 'new-1' stands clear of the door in
  the back wall at offsetMm 600 with wall left and alignment back.", then the closing.
- `it('names the offsetMm of the other corner, measured from the wall's end')`: two picks, wall 3,
  alignment `end`, door in the front wall at x 300 to 1200 (fromEndMm 2800 to 3700): "free
  stretches … fromEndMm 600 to 3000" and "Group 'new-1' stands clear of the door in the front wall at
  offsetMm 600 with wall 3 and alignment end."
- `it('names no offsetMm for a door of the group's own wall')`: two picks, wall `left`, alignment
  `back`, a door in the left wall at its back end: the hint as today, without "stands clear".
- `it('names no offsetMm when the group would reach past the other end of the wall')`: four picks
  (3200 mm), wall `left`, alignment `back`, the back wall's door: the hint as today.
- `it('names no offsetMm for a corner article placed into the corner')`: `cornerRootIds`, wall
  `left`, alignment `back`, the back wall's door: no "stands clear".

The test at line 1995 of `describe('obstacle hints')` — a group without a wall placement — keeps
its expectation and guards the fallback of a placement by point.

### roomle-ui `__tests__/hi-tool-commands/place-group-test.ts`

`it('names the offsetMm that keeps the moved group clear of the adjoining wall's window')`:
`createPlaceApi` with one `tallRoot()` (800 x 600 x 2000 mm), `place-group` with wall `left`,
alignment `back` and `{ objects: [windowBehindTheBackWall(300, 1300)], groups: [] }`. The hint: "Root
module 'r1' (article-1) of group 'g1' stands in front of the window in the back wall (wall 2,
fromEndMm 300 to 1300, 950 to 2170 mm) - free stretches of the left wall (wall 3) at its height:
fromEndMm 0 to 2400. Group 'g1' stands clear of the window in the back wall at offsetMm 600 with
wall left and alignment back. The group was placed anyway - move or change it if the user did not
ask for it there."

The row-edit hints keep their tests in `group-commands-test.ts` unchanged.

### roomle-hi-example `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts`

The expectations at lines 982 (the obstacles rule) and 1001 (the `create-or-replace-groups`
description) with the new sentences.

**Reproduce.** The hint part is deterministic: the unit test at line 1995 of
`create-or-replace-groups-placement-test.ts` shows today's hint without anything in the frame of a
placement. The first placement is model-dependent: test `image-only-no-text` with gpt-6-astra
(session `mcp-test-2026-10-14_13-34-58` showed it, `mcp-test-2026-10-16_11-57-20` did not).
