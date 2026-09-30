# Feature Analysis: Reintroduce the place-group tool in the MCP server (RML-18007, Task 2)

> **Type**: Feature Analysis
> **Domain**: hi-mcp — MCP server tools and executors (`hi-mcp/hi-mcp-poc-json`); the removed page-side implementation read from git (`a4df7f5^`); verified against the compact plan context of roomle-ui `homag-intelligence`
> **Trigger**: Jira [RML-18007](https://roomle.atlassian.net/browse/RML-18007), Task 2 — the `place-group` tool (`placeGroupAtWall` etc.), removed in "refactor: position groups with repositioning data only" (`a4df7f5`, PR #21), worked very well and must be reintroduced more or less as it was, implemented in the MCP server instead of the client; its documentation must be recovered
> **Date**: 2026-09-30
> **Author**: AI Assistant
> **Status**: Open

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
