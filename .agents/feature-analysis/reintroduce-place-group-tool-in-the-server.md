# Feature Analysis: Reintroduce the place-group tool in the MCP server (RML-18007, Task 2)

> **Type**: Feature Analysis
> **Domain**: hi-mcp — MCP server tools and executors (`hi-mcp/hi-mcp-poc-json`); the removed page-side implementation read from git (`a4df7f5^`); verified against the compact plan context of roomle-ui `homag-intelligence`
> **Trigger**: Jira [RML-18007](https://roomle.atlassian.net/browse/RML-18007), Task 2 — the `place-group` tool (`placeGroupAtWall` etc.), removed in "refactor: position groups with repositioning data only" (`a4df7f5`, PR #21), worked very well and must be reintroduced more or less as it was, implemented in the MCP server instead of the client; its documentation must be recovered
> **Date**: 2026-09-30
> **Author**: AI Assistant
> **Status**: Open

> **Update (2026-09-30, implementation plan)**: Task 1 has since exposed `getExternalObjectGroups`
> (and `removeExternalObject`) to the server and added both to every page allow-list (`686fe94`,
> ligna-store `f4f6619`). That removes the only objection to B1, so the
> [implementation plan](#implementation-plan-2026-09-30) ports the old tool as it was instead of
> re-deriving it from the compact context (Proposed design steps 2–4). The analysis below is kept
> as written; where it says the server has no raw geometry, read the plan.

---

## What was asked and why

`a4df7f5` (RML-17966, decision D2 of
[group-placement-via-repositioning-data.md](../refactoring-analysis/group-placement-via-repositioning-data.md))
removed the `place-group` tool and the `placement { wall, alignment, offsetMm }` option together
with the page-side geometry module `plan-space.ts` — 2,580 lines across the reference client, the
ligna-store copy and the inline copy in `minimal-hi-example/index.html`. Since then the agent moves
a group by resubmitting it with a new `repositioningData` and computes wall points itself
(`end + d · (start − end) / lengthMm`). The findings of 2026-09-29/30 show that this arithmetic is
part of what the models get wrong. The tool that took a wall side label and an alignment and did
the arithmetic in code is to come back — in the server this time, where every tool runs since
ADR 0001.

## How it worked before `a4df7f5`

### The tool

Registration (`a4df7f5^:hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts:180-234`):

| Parameter | Type | Meaning |
|---|---|---|
| `groupId` | `string` | the group to place; a unique id prefix was accepted |
| `wall` | `'left' \| 'right' \| 'top' \| 'bottom' \| number` | side label as seen in the top view (the longest wall of type `wall` on that side) or a wall index of the room's `walls` array |
| `roomIndex?` | `number` | room in the `rooms` array, default 0 |
| `alignment?` | `'start' \| 'center' \| 'end' \| side label` | position along the wall; a side label = flush into the corner this wall shares with the wall on that side (`wall: "right", alignment: "top"` = back right corner); default `center` |
| `offsetMm?` | `number` | extra distance along the wall, default 0 |

The server forwarded the call to the page (`bridge.call('place-group', …)`), where the executor
ran (`a4df7f5^:hi-mcp/hi-mcp-poc-json-client/tool-executors.ts:699-782`):

1. `getExternalObjectPlanContext(['rooms', 'groups'])`; the group by id or unique prefix; the
   wall by side label or index (`resolveWall`, `:280-304`), the alignment checked early
   (`resolveWallAlignment`: a side label parallel to the wall is an error).
2. `getExternalObjectGroups()` for the **raw calculated group** — the placement math needed the
   part geometry and the `dockInfos`.
3. `placeGroupAtWall` (`:306-338`): with a corner article in the group and a side-label alignment
   naming an adjoining wall, `placeCornerAtWalls` put the article's corner point into the shared
   corner and turned the group so that both back edges ran along the two walls (`placedBy:
   'cornerPoint'`); every other case `placeAgainstWall` placed the group's footprint against the
   wall by alignment and offset (`placedBy: 'footprint'`).
4. A contact guard: the target footprint against every other group's footprint (separating axis
   test, 5 mm tolerance); a hit rejected the move and named the group, its nearest root and the
   free docking vectors to dock to instead.
5. Reload of the group with the placement expressed as `repositioningData` of its first root
   (`repositioningFromPlacement`), then `{ pos, rotationY, footprint, placedBy, cornerRootId?, wall, group }`.

### The geometry (`a4df7f5^:hi-mcp/hi-mcp-poc-json-client/plan-space.ts`, 558 lines)

`groupFootprint` (part boxes → `dockInfos` → `b`/`t` attributes), `rootCornerGeometry` /
`groupCornerGeometry` (corner point and back-edge directions from the `LeftBack*`/`RightBack*`
`dockInfos`), `sharedCorner`, `adjoiningWall`, `placeCornerAtWalls`, `footprintCornersInRoom`,
`convexPolygonsTouch`, `repositioningFromPlacement`, `resolveWallAlignment`, `placeAgainstWall`.
Tests: `plan-space.test.ts` (22) and `describe('place-group')` (4: unknown id, unique prefix,
places and reloads, rejects a contact).

### The documentation

`minimal-hi-example/docs/hi-mcp-server.md` `### place-group` (`aa86ee3^:399-422`: description,
parameter table, example `{ "groupId": "a1b2c3", "wall": "right", "alignment": "top" }`), the tool
reference intro (snapshot timeout class), demo walkthrough step 4 ("move the group to another wall
or into a corner"), the example prompt "Move the group to the back right corner" → `place-group`;
`.agents/skills/hi-mcp-tools.md` (overview table and `### place-group`); `AGENTS.md` (`:157`,
`:317`), `.github/copilot-instructions.md` (`:82`, `:95`, `:104`); the skill `hi-mcp-server.md`
timeout line (`:90`).

## What the server has today

- Planner methods ([planner-api.ts](../../hi-mcp/hi-mcp-poc-json/planner-api.ts)):
  `getExternalObjectPlanContext`, `loadExternalObjectGroupLayout`,
  `updateExternalObjectGroupAttribute`, `fetchPrice`, `getExternalObjectSnapshot` — the same five
  names in every page allow-list (`MCP_PLANNER_METHODS` in `index.html:1050`, `PLANNER_METHODS` in
  `browser-bridge.ts:12` and the ligna-store copy). **`getExternalObjectGroups` is not exposed**,
  so the server has no raw geometry.
- The compact plan context carries what the geometry module derived from the raw data:
  - per wall `index`, `side`, `start`, `end`, `lengthMm`, `type`, `facingRotationY`;
  - per group `position { pos, rotationY, footprint { x: [min, max], z: [min, max], widthMm, depthMm } }`
    — the footprint is computed **in group space** by the same `groupFootprint` the old module
    had (roomle-ui `hi-plan-context.ts:451`, part boxes → `dockInfos` → `b`/`t`), so `widthMm`
    is the extent along the group's own x axis, i.e. along the wall;
  - per article `cornerArticle` and `cornerPoint`.
- Task 1 ([group-placement-computed-in-the-mcp-server.md](group-placement-computed-in-the-mcp-server.md))
  adds `toRepositioningData(group, placement, articles)`: from `placement { posGroup, posRotationY }`
  it finds the anchor (the leftmost floor unit of the row, or the corner article) and applies the
  corner point offset.

## The gap

Moving a group to a wall or a corner is arithmetic on data the server already has: the wall's
`start`/`end`/`lengthMm`/`facingRotationY`, the group's `footprint.widthMm`, and the corner
convention verified in the refactoring analysis (§3: a corner takes the `facingRotationY` of the
wall that **ends** in it — contours run counter-clockwise, interior on the left). Nothing of the
raw geometry is needed, because Task 1 anchors the group by docking and catalog data, and the
footprint width comes compacted. The tool can therefore return without any page change.

## Proposed design

`place-group` registered in `hi-mcp-server.ts` with the **same input schema as before**
(`groupId`, `wall`, `roomIndex?`, `alignment?`, `offsetMm?`), executor in `tool-executors.ts`, the
wall arithmetic as pure functions in a small module (`wall-placement.ts`, recovered and reduced
from `plan-space.ts`):

1. `getExternalObjectPlanContext(['rooms', 'groups', 'articles'])`; the group by id or unique
   prefix (as before); the wall by side label (longest wall of type `wall` on that side) or index;
   the alignment resolved early (`resolveWallAlignment`, `sharedCorner`, `adjoiningWall` recovered
   as they were).
2. **Placement** (`{ posGroup, posRotationY }`, the Task 1 vocabulary):
   - **Corner** — the alignment is the side label of a wall that shares a corner with the target
     wall **and** the group contains a corner article (`cornerArticle` of a root's article):
     `posGroup` = the shared corner shifted by `offsetMm` along the target wall,
     `posRotationY` = the `facingRotationY` of the wall whose `end` is that corner (the corner
     rule; right back corner → the right wall → 270). This replaces the old direction matching of
     `placeCornerAtWalls`: an L-shaped corner article has one rotation that puts both back edges
     along the walls with the arms inside the room, and that is the rule's rotation.
   - **Along the wall** — otherwise: `resolvedAlignment` ∈ start/center/end (a side label resolves
     to the endpoint sharing that corner, as before); width = `position.footprint.widthMm`;
     `d` = `end`: 0, `center`: (lengthMm − width) / 2, `start`: lengthMm − width, then `offsetMm`
     with the old semantics (from `start` towards `end` for `start`, the reverse for `end`, along
     the wall for `center`); `posGroup = end + d · (start − end) / lengthMm`,
     `posRotationY = facingRotationY`. The old `placeAgainstWall` placed the footprint's minimum
     corner; the new one places the anchor's origin (Task 1). For a row these coincide (the
     leftmost unit's left back corner is the footprint minimum: backs aligned by `StartStart`
     docking, the leftmost root at the smallest x).
3. **Contact guard** (see D1): room-space footprint corners of the target
   (`footprintCornersInRoom` from `posGroup`/`posRotationY`/`footprint`) against every other
   group's (from its `position`), `convexPolygonsTouch` as before; a hit rejects the move, the
   error names the group and its roots' `freeDockingVectors` (both in the compact context).
4. **Reload** — the group from the groups section (a valid payload as it is) with its id and the
   derived `repositioningData`, using Task 1's `toRepositioningData` (anchor walk, corner offset).
   Task 1 accepts a `placement` on new groups only, so this reload goes through the executor
   directly, not through Task 1's `placement` input. Snapshot timeout class, as before.
5. **Result** — `{ placement: { posGroup, posRotationY }, placedIn: 'corner' | 'wall', wall,
   group }` with `group` from the after-context (its `position.pos`, `rotationY`, `footprint`).
   The old `placedBy: 'cornerPoint' | 'footprint'` is renamed: its values named the internal
   mechanism, which the agent must not see (see the next point).
6. Text: Task 1 removed the moving text; this task adds it back as "to move a group to a wall or
   into a corner, call `place-group`". Moving a group to a free point (not a wall or corner) is a
   Task 2 decision still to take — Task 1 rejects a `placement` on an existing group.
7. **The hard rule of Task 1 applies to this tool too**: its description, parameter
   descriptions, result, errors and documentation mention neither `repositioningData` nor
   `rootRelPos` nor `cornerPoint`, nor that a corner module has an offset. For the agent, a group
   with a corner article simply goes into the named corner. The guard test of Task 1 covers the
   `place-group` description.

### Documentation to recover (adapted to the server)

- `minimal-hi-example/docs/hi-mcp-server.md` and `hi-mcp/hi-mcp-poc-json/README.md`: the
  `### place-group` section from `aa86ee3^:399-422` (parameter table, example), minus the raw
  geometry sentence and minus "reloads the group with that placement as `repositioningData` of
  its first root" and "placed by the article's corner point" (hard rule, point 7 above), plus
  "runs in the server, no page change"; the timeout list; demo walkthrough
  step 4; the prompt rows "Move the group to the back right corner" (`place-group`, `wall: "right",
  alignment: "top"`) and "Add a group of three tall units to the wall on the right"
  (`create-or-replace-groups` then `place-group`, or `placement` from the wall).
- `.agents/skills/hi-mcp-tools.md`: overview row and the `### place-group` entry
  (`aa86ee3^:61-72`), "Moving" paragraph; `.agents/skills/hi-mcp-server.md` timeout line;
  `hi-authoring-rules.md` / `roomle-hi-concepts.md` "Moving a group".
- `AGENTS.md:157,316`, `.github/copilot-instructions.md:81,94-95,103-104`, `hi-mcp-poc-json/QUICKSTART.md`.

### Tests

- `wall-placement.test.ts`: recovered `resolveWallAlignment` (3), `sharedCorner`/`adjoiningWall`,
  the along-wall arithmetic (centre, start/end with offset, side-label alignment flush into the
  corner — the old `placeAgainstWall` cases expressed as `posGroup`), the corner rule for all four
  corners of the 4000 × 3000 test room, `convexPolygonsTouch` (5) if the guard is kept.
- `tool-executors.test.ts` `describe('place-group')`: unknown id; unique prefix; side label → the
  longest wall, `posGroup` centred, one load with the anchor's `repositioningData`; corner
  alignment with a corner article → the corner point and the rotation of the wall ending there,
  `rootRelPos`; corner alignment without a corner article → flush footprint placement; a target
  that meets another group is rejected without a load.
- `hi-mcp-server.test.ts`: nine tools; `place-group` in the snapshot timeout class.
- Live: "Move the group to the back right corner" and "move it to the left wall, centred" in the
  chat window; the L of the findings' P2 moved into another corner.

## Decisions to take

| # | Question | Recommendation | Alternative |
|---|---|---|---|
| D1 | Contact guard | Keep it, from the compact footprints (the pure SAT functions are recovered as they were). The rejection message was the mechanism that sent the agent back to "one kitchen is one group" | Drop it (D3 of RML-17966 stays); the guard becomes an approximation anyway (axis-aligned footprints in group space, not part-exact polygons) |
| D2 | `placement { wall, alignment?, offsetMm? }` also in `create-or-replace-groups` (the old one-call flow) | Not in this ticket; once `wall-placement.ts` exists it is a small follow-up — ask before adding | Add it now |
| D3 | Result shape | `{ placement, placedIn, wall, group }` (`pos`/`rotationY`/`footprint` are in `group.position`) | The old flat `{ pos, rotationY, footprint, placedBy, cornerRootId?, wall, group }` |

## Alternatives considered

| # | Alternative | Why rejected |
|---|---|---|
| B1 | Expose `getExternalObjectGroups` to the server and port `plan-space.ts` unchanged | Exact old behaviour, but a new planner method in every page allow-list (example page, reference bridge, ligna-store copy → page deployments) and 550 lines of geometry that the compact context already summarises. The ticket asks for the server, not the client |
| B2 | Keep moving by resubmitting with `placement` only (today's way, with Task 1) | That leaves the wall arithmetic with the agent — the part the findings show failing; the tool exists to do it in code |
| B3 | Corner placement by direction matching as `placeCornerAtWalls` did | Needs the back-edge directions from the raw `dockInfos`; the corner rule gives the same rotation from the wall data |

## Risks and dependencies

- **Order**: Task 1 first — `place-group` reuses `toRepositioningData`. Implementing it alone
  would duplicate the anchor and corner logic. Moving a group into a corner has the same
  dependency on the catalog's corner data as Task 1 (Task 1, open prerequisite).
- **Footprint assumption**: the anchor's origin is the footprint minimum for a row. A group whose
  leftmost floor unit is shallower than a neighbour with the backs aligned still holds (min z = 0).
  A group with a unit docked with an `offset` in z would not; acceptable, and visible in the
  returned `position`.
- **Contact guard approximation** (D1): axis-aligned group-space footprints; an L's footprint box
  covers its inner corner, so a group standing in the L's inner corner would be reported as a
  contact. As before (`groupFootprint` was the same box).
- **Deployment**: server only; pages unchanged. Update the deployed server
  ([hi-mcp-cloudflare-deployment.md](../skills/hi-mcp-cloudflare-deployment.md)).

## Code and documents touched

| File | Change |
|---|---|
| `hi-mcp/hi-mcp-poc-json/wall-placement.ts` | New: `resolveWall`, `resolveWallAlignment`, `sharedCorner`, `adjoiningWall`, the along-wall and corner arithmetic → `{ posGroup, posRotationY }`; `footprintCornersInRoom`, `convexPolygonsTouch` (D1) |
| `hi-mcp/hi-mcp-poc-json/tool-executors.ts` | `place-group` executor; the unpositioned-group hint |
| `hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts` | `place-group` registration (zod schema as before), `INSTRUCTIONS` step 3 |
| `hi-mcp/hi-mcp-poc-json/tests/` | `wall-placement.test.ts` (new), `tool-executors.test.ts` (`describe('place-group')`), `hi-mcp-server.test.ts` (nine tools, timeout class) |
| Docs and skills | See [Documentation to recover](#documentation-to-recover-adapted-to-the-server) |
| Not touched | Pages and bridges (no new planner method), roomle-ui, RoomleCore |

---

## Implementation plan (2026-09-30)

> **Status**: proposed, awaiting review (step 5 of the suggested change workflow) — no code before
> it is approved.
> **Scope**: `place-group` moves an **existing** group against a wall or into a room corner. New
> groups keep Task 1's `placement`; nothing in this plan changes how a group is created.
> **Branch**: `refactor/hi-mcp-group-positioning-RML-18007`, on top of Task 1 (`86b7e0c`).
> **Baseline**: `cd hi-mcp && npx vitest run` — 113 tests pass in 7 files;
> `cf/tests/worker.test.ts` fails to load (`@cloudflare/containers` not installed locally,
> pre-existing, unrelated); `npm run typecheck` clean.

### 0. What changed since the analysis

The analysis rejected porting the old geometry (B1) for one reason: the server had no raw
geometry, and exposing `getExternalObjectGroups` meant a new planner method in every page
allow-list. Task 1 has since done exactly that for the corner offset — `planner-api.ts`,
`MCP_PLANNER_METHODS` in `index.html:1056`, `PLANNER_METHODS` in `browser-bridge.ts:18`, the
ligna-store copy (`f4f6619`). The server can now read the calculated group with its root
transforms and docking vector coordinates, which is the input the old tool worked from.

The plan therefore **ports the old tool as it was, into the server** (decision Q1), instead of
re-deriving it from the compact context and Task 1's anchor walk:

| | Old tool, ported (this plan) | Analysis design (steps 2–4) |
|---|---|---|
| Geometry | the calculated group: footprint from part boxes, corner point and back-edge directions from the corner article's `LeftBack*`/`RightBack*` vectors | compact `position.footprint`, the corner rule, Task 1's anchor walk and corner point lookup |
| Exactness | any group: the tool computes the group transform and hands it to the planner as the room transform of the first root, computed with that root's own transform in the group (`repositioningFromPlacement`); the planner's `G = T · R_root⁻¹` (roomle-ui `hi-root-module-arrangement.ts:414-447`, re-read for this plan) reverses exactly that | exact only where the anchor's origin is the footprint minimum (risk "Footprint assumption") |
| Corner rotation | direction matching: the one rotation that lays both back edges along the two walls | assumes the article's arms match the corner table |
| Empty plan | no dependency: the group being moved is already calculated | the same corner-point dependency as Task 1 |
| Evidence | "worked very well" (ticket); 26 tests to recover | new code, new tests |
| Page change | none | none |

**Checked for this plan**: the recovered `groupCornerGeometry` + `placeCornerAtWalls` against the
Furniture_Smith corner article (`LeftBackBottom [-261, 0, 0] → [-261, 0, 661]`,
`RightBackBottom [-261, 0, 0] → [900, 0, 0]`, the fixture of `tests/tool-executors.test.ts:704`) in
the 4000 × 3000 test room gives exactly the corner table of the rules — back right 270, back
left 0, front left 90, front right 180 — and puts the corner point on the room corner in all four,
also when the first root is a straight unit and the corner article sits at `x = -900` in the
group. Straight row, right wall, alignment `top`: `pos [4000, 0, -3000]`, 270.

Moving therefore does not reuse `toRepositioningData`. That function exists because a **new**
group has no geometry before its one load. An existing group has geometry, and the exact
conversion needs neither the anchor walk nor the corner offset.

### 1. Recovered module `hi-mcp/hi-mcp-poc-json/plan-space.ts`

`a4df7f5^:hi-mcp/hi-mcp-poc-json-client/plan-space.ts` restored in the server, unchanged except
that `RepositioningData` is imported from `group-placement.ts` instead of being declared a second
time. It keeps its old name because it is recovered whole, not reduced to the `wall-placement.ts`
the analysis sketched.

Every export is used by the executor: `groupFootprint` (part boxes → docking vector points →
`b`/`t` attributes), `groupCornerGeometry`, `sharedCorner`, `adjoiningWall`, `placeCornerAtWalls`,
`resolveWallAlignment`, `placeAgainstWall`, `footprintCornersInRoom`, `rootFootprintInRoom`,
`convexPolygonsTouch`, `repositioningFromPlacement`; types `DerivedWall`, `GroupFootprint`,
`WallSide`, `WallAlignment`.

### 2. Executor `place-group` (`tool-executors.ts`)

Recovered from `a4df7f5^:hi-mcp/hi-mcp-poc-json-client/tool-executors.ts` — the executor
(`:699-782`), `resolveWall` and `placeGroupAtWall` (`:272-338`), `findGroupContact` and
`contactError` (`:58-126`), `withoutPositions` and `repositionedGroup` (`:157-190`):

1. `getExternalObjectPlanContext(['rooms', 'groups'])`; the group by id or unique prefix, else an
   error listing the group ids.
2. `resolveWall`: a side label → the longest wall of type `wall` on that side; or a wall index; an
   alignment parallel to the wall and an unknown room are rejected here, before anything else is
   fetched.
3. `getExternalObjectGroups()`; the calculated group by id, else "has no calculated geometry to
   place".
4. `placeGroupAtWall`: a side-label alignment + a corner article + the adjoining wall on that side
   → `placeCornerAtWalls`; every other case → `placeAgainstWall`.
5. Contact guard (D1): the target footprint in room space against every other calculated group's
   (separating axis test, 5 mm). A hit throws "Placement rejected - the group was not moved: …"
   naming the group, its nearest root, that root's free docking vectors and the docking entry to
   use instead; nothing is loaded.
6. Reload, one load: `{ id, libraryId, roots, repositioningData }` with the non-generated
   calculated roots without `articlePos`/`rotationY` and with docking indices stripped
   (`stripDockingIndices`, already in the file), `repositioningData` from `repositioningFromPlacement`
   for the first root; `'posGroups'`, `{ reason: 'adjusted' }` (the load already carries the 120 s
   snapshot timeout in `planner-api.ts`). An empty load result throws.
7. `getExternalObjectPlanContext(['groups'])`; returns `{ placedIn, wall, group }`.

Deliberate deviations from the old code:

| Old | New | Why |
|---|---|---|
| result `placedBy: 'cornerPoint' \| 'footprint'`, `cornerRootId` | `placedIn: 'corner' \| 'wall'` | hard rule: the result names no internal mechanism (Q3) |
| result `pos`, `rotationY`, `footprint` beside `group` | only in `group.position` | one source of numbers; the planner's numbers, not the tool's (Q3) |
| group `pos` y = 0 | the group's current y (`rawGroup.pos[1]`) | the old tool dropped a group of wall units only to the floor (Q4) |
| free docking vectors in the contact error computed again from the raw `dockInfos` | read from the compact group of the plan context (`freeDockingVectors`, fetched in step 1) | the list get-plan-context shows; no second implementation |
| `args.wall ?? args.wallIndex` | `args.wall` | `wallIndex` is not in the schema, zod drops it |

### 3. Registration and agent text (`hi-mcp-server.ts`)

- `place-group` with the old input schema and parameter descriptions: `groupId`, `wall`
  (`left`/`right`/`top`/`bottom` or an integer ≥ 0), `roomIndex?`, `alignment?`
  (`start`/`center`/`end` or a side label), `offsetMm?`.
- Description, rewritten under the hard rule (draft):
  > Moves an existing group against a wall of a room or into a room corner and reloads it there:
  > the server computes the position from the wall, the alignment and the group's calculated
  > footprint; a group with a corner article goes into the corner when the alignment names the
  > adjoining wall. A target that meets another group is rejected and the group is not moved.
  > Name the wall by its side label (left/right/top/bottom as seen in the top-view image) or its
  > index in the walls array of get-plan-context. Use it to move a group, or to position a group
  > created without placement, against a wall or into a corner - never compute wall points for
  > this yourself. Returns placedIn (corner or wall), the wall and the resulting group.
- `AUTHORING_RULES`:
  - the placement rule (`:26`) ends "… a placement on a group that is already in the plan is
    rejected - move it with place-group";
  - a move rule before the modify rule (`:30`), as it stood before `a4df7f5`: "To move an existing
    group against a wall or into a room corner, call place-group: wall by side label or index,
    alignment start, center or end, or the side label of the adjoining wall to sit flush in that
    corner (wall right + alignment top is the back right corner), offsetMm along the wall. The
    group keeps its roots and docking."
- `INSTRUCTIONS`: new step 3 "place-group: move an existing group to another wall or into a room
  corner when asked."; checking the result becomes step 4.
- Messages of `create-or-replace-groups`: the placement-on-an-existing-group error adds "or move
  it with place-group"; the unknown-keys error of a placement adds, when `wall`, `alignment` or
  `offsetMm` is among the keys, "- to stand a group against a wall or into a corner by its side
  label, call place-group" (announced as P4 in Task 1); the unpositioned-group hint adds "or
  position it with place-group".

### 4. Unit tests

**`tests/plan-space.test.ts`** — recovered from
`a4df7f5^:hi-mcp/hi-mcp-poc-json-client/tests/plan-space.test.ts`, 22 tests, only the import path
changes:

| describe | Cases |
|---|---|
| `groupFootprint` (5) | part boxes transformed by the root; part matrices in group space when `ver` > 0; docking vector fallback; `b`/`t` fallback; no geometry → undefined |
| `resolveWallAlignment` (3) | start/center/end pass through; a side label → the endpoint sharing that corner; a parallel alignment is rejected |
| `placeAgainstWall` (3) | centred `[4000, 0, -1900]`; start/end with offset; side label flush into the corner `[4000, 0, -3000]` |
| `placeCornerAtWalls` (2) | corner point into the corner with both back edges along the walls; offset along the wall |
| `convexPolygonsTouch` (5) | separated; flush; overlap; gap within the tolerance; degenerate |
| `groupCornerGeometry` (2) | corner point and back-edge directions; no corner article → undefined |
| `repositioningFromPlacement` (2) | anchor transformed into the room, rotations summed; a root without its own transform |

New in the same file:

| Case | Expected |
|---|---|
| `adjoiningWall` | the wall of type `wall` on the named side that shares a corner; undefined for the opposite side |
| the Furniture_Smith corner article in each corner of the test room (`it.each`) | back right 270 `pos [4000, 0, -2739]`, back left 0 `[261, 0, -3000]`, front left 90 `[0, 0, -261]`, front right 180 `[3739, 0, 0]`; the corner point lands on the room corner. Ties the ported direction matching to the corner table the agent reads |

**`tests/tool-executors.test.ts`**, `describe('place-group')` — raw-group fixtures `makeRoot` /
`makeGroup` and `createPlaceApi(shapedGroups, rawGroups, afterShapedGroups)` recovered from the
old test file (`:60-82`, `:711-731`):

| Case | Expected |
|---|---|
| unknown group id (recovered) | error names the groups in the plan; nothing loaded |
| unique id prefix `group-a` → `group-abc` (recovered) | loaded with `posGroup [4000, 0, -1900]`, 270 (asserted on the load instead of the old `result.pos`) |
| wall `right`, alignment `top`, no corner article (recovered, extended) | exactly one load: `{ id: 'g1', libraryId: 'lib-1', roots: [r1 without articlePos/rotationY], repositioningData: { posGroup: [4000, 0, -3000], posRotationY: 270, rootId: 'r1' } }`, `'posGroups'`, `{ reason: 'adjusted' }`; result `placedIn: 'wall'`, the right wall, the group of the after-context |
| target meets another group (recovered) | "Placement rejected - the group was not moved", names g2 and its root's free docking vectors from the plan context; nothing loaded |
| corner article, wall `right`, alignment `top` | `placedIn: 'corner'`; `repositioningData { posGroup: [4000, 0, -2739], posRotationY: 270, rootId: 'c1' }`; the serialized result contains none of `repositioningData`, `rootRelPos`, `cornerPoint` |
| corner article not the first root (r1 at the origin, c1 at `x = -900`) | anchor r1; the corner article's corner point, carried through the planner's `T · R_r1⁻¹ · R_c1`, lands on `[4000, 0, -3000]` |
| group of wall units only at height 1400 | `posGroup` y 1400 (deviation Q4) |
| a generated root (worktop) first | not in the payload; the first article root anchors |
| wall `right` + alignment `right`; `roomIndex` 1; a wall index that does not exist | each rejected; neither the raw groups fetched nor anything loaded |
| no calculated group for the id | "has no calculated geometry"; nothing loaded |

Adapted in `create-or-replace-groups`: "rejects a placement on a group that is already in the
plan" and "hints at placement for a created group without a position" also expect `place-group`;
the `wall` key case of "rejects an invalid placement" expects the pointer to `place-group`.

**`tests/hi-mcp-server.test.ts`**:

- "exposes exactly the nine expected tools" (`place-group` added).
- "explains positioning with placement …": `not.toMatch(/\bplace-group\b/)` becomes the move rule.
- The hard-rule guard ("never tells the agent how the server positions a group internally")
  covers the `place-group` description and schema through `listTools` without a change.
- New: "runs place-group as planner calls the page executes" — through the page bridge, calls
  `getExternalObjectPlanContext`, `getExternalObjectGroups`, `loadExternalObjectGroupLayout`,
  `getExternalObjectPlanContext`; the load carries the repositioned group. Guards the JSON
  transport and the allow-list.
- New: `wall: 'north'` is rejected by the schema without a planner call.

**`tests/planner-api.test.ts`**: unchanged, no new planner method.

Expected: about 150 tests (113 + 26 recovered + about 13 new), all green; typecheck clean.

### 5. Documentation

Agent-facing, recovered from `aa86ee3^` and adapted to the hard rule (no `repositioningData`,
no corner point, no "first root"):

- `minimal-hi-example/docs/hi-mcp-server.md` and `hi-mcp/hi-mcp-poc-json/README.md`:
  `### place-group` after `create-or-replace-groups` (`aa86ee3^:399-422`: description, parameter
  table, example `{ "groupId": "a1b2c3", "wall": "right", "alignment": "top" }`), "runs in the
  server, no page change", result `placedIn`/`wall`/`group`; the tool list and the timeout line;
  demo walkthrough step "move the group to another wall or into a corner"; example prompt rows
  "Move the group to the back right corner." → `place-group` (`wall: "right"`, `alignment: "top"`)
  and "Move the kitchen to the left wall, centred." → `place-group` (`wall: "left"`).
- `.agents/skills/hi-mcp-tools.md`: overview row and `### place-group` entry
  (`aa86ee3^:61-72`), with the new result.
- `.agents/skills/hi-authoring-rules.md`, `roomle-hi-concepts.md`: a "Moving a group" paragraph
  (place-group, wall + alignment + offsetMm, corner by the adjoining wall's side label, contact
  rejection).
- Tool lists: `AGENTS.md:317` (and the `hi-mcp-poc-json` file tree: `plan-space.ts`),
  `.github/copilot-instructions.md`, `hi-mcp/hi-mcp-poc-json/QUICKSTART.md`,
  `minimal-hi-example/docs/hi-mcp-poc-presentation.md:74`, `minimal-hi-example/docs/ai-chat.md:122`.

Internal, for server development only (decision P3 of Task 1):
`.agents/skills/hi-mcp-server.md` §5 replaces "Moving groups is not part of the placement" with a
place-group bullet (calculated group → `plan-space.ts` → group transform → `repositioningData` of
the first root; why it needs no anchor walk and no corner offset), and the timeout line lists
`place-group` with `create-or-replace-groups`.

Close-out: the analysis status, a report section, and the backlog entry "Make group positioning
easier for the agent" once Task 1 and Task 2 are both closed. Historical records stay untouched.

### 6. Commits

Conventional, no ticket number, each commit green:

1. `feat: recover the plan-space geometry in the mcp server` — §1 and `plan-space.test.ts`.
2. `feat: move a group against a wall or into a corner with place-group` — §2 and §3 together, so
   that the executor and the text never disagree; their tests.
3. `docs: describe moving a group with place-group` — §5.
4. `docs: close out the place-group analysis` — after the live verification.

### 7. Verification

1. `cd hi-mcp && npx vitest run && npm run typecheck`.
2. Live, maintainer: `npm start gpt-5.4-mini <key>` and `npm start mistral-large <key>`. Create a
   straight row and an L-shaped kitchen, then "Move the group to the back right corner", "Move it
   to the left wall, centred", "Move the kitchen into the front left corner", and a move onto a
   second group (expected: rejected, the group stays). Pass: one reload per move, the row flush
   along the wall, the L's corner point in the room corner, nothing inside a wall — checked in the
   snapshot as in the findings (`npm run rapi:plan` in RoomleCore).
3. The served text in Claude Desktop: `place-group` is listed, no internal field appears.
4. Deployment: server only (`hi-mcp-cloudflare-deployment.md`). The pages need the allow-list of
   `686fe94`/`f4f6619`, which Task 1 already requires.

### Decisions to confirm

| # | Question | Recommendation |
|---|---|---|
| Q1 | Geometry source (replaces Proposed design steps 2–4 and the rejection of B1) | Port the old tool: calculated group via `getExternalObjectGroups`, `plan-space.ts` recovered whole. Alternative: the analysis design on the compact context and Task 1's anchor walk |
| D1 | Contact guard | Keep it as it was (the rejection is what sends the agent back to "one kitchen is one group") |
| Q3 | Result shape (replaces D3) | `{ placedIn, wall, group }`; position, rotation and footprint only in `group.position` |
| Q4 | Height of a moved group | Keep the group's current y; the old tool put every group on the floor |
| D2 | `placement { wall, alignment, offsetMm }` in `create-or-replace-groups` | Not in this ticket; `plan-space.ts` makes it a small follow-up — ask first |
| Q5 | Moving a group to a free point (island, middle of the room) | Not in this ticket: `place-group` knows walls and corners, as before; the placement guard of Task 1 stays |

### Considered and rejected

- **Reusing Task 1's `toRepositioningData` for the move**: exact only for rows anchored at the
  footprint minimum and dependent on the corner-point lookup; the calculated group makes both
  unnecessary.
- **Keeping `placedBy: 'cornerPoint'`**: names the internal mechanism (hard rule).
- **Sending article picks (`toArticlePick`) on the reload**: a pick carries only the root's input
  attributes and is completed from the template again; a move should change nothing but the
  position. The calculated roots without positions carry everything the planner holds, as in the
  old tool. (Whether a pick would lose sub-module changes made with `update-attribute` was not
  verified; it is not needed for the decision.)
