> **Type**: Refactoring Analysis
> **Domain**: hi-mcp — roomle-hi-example (MCP server, reference client, minimal example) and ligna-store (client copy); verified against homag-intelligence (roomle-ui) and the external-object kernel code (RoomleCore)
> **Trigger**: Jira [RML-17966](https://roomle.atlassian.net/browse/RML-17966?focusedCommentId=155478), comment 155478 — `placeGroupAtWall` and `placeCornerAtWall(s)` are highly specialised (walls and corners only) and must be removed entirely from ligna-store and roomle-hi-example; the HI MCP must explain how to place groups with `repositioningData` (`posGroup`, `posRotationY`, `rootId`).
> **Date**: 2026-09-29
> **Author**: AI Assistant
> **Status**: Open

---

## Executive Summary

The embedding systems compute group positions themselves today. `create-or-replace-groups`
accepts a declarative `placement: { wall, alignment?, offsetMm?, roomIndex? }`, and the
`place-group` tool moves an existing group with the same vocabulary. Behind both sits the page-side
geometry: `placeGroupAtWall` and `placeCornerAtWalls`, plus group footprints, corner-article
geometry and a separating-axis contact test. That is about 550 lines of `plan-space.ts` and half of
`tool-executors.ts`, present **three times**: the reference client, its ligna-store copy and the
inline JavaScript in `minimal-hi-example/index.html`. It only knows "against a wall" and "into a
corner". Free placements — the centre of the room, an island, next to a door — cannot be
expressed.

The planner does not need any of this. `repositioningData` already creates and moves groups at any
point in the room, and the placement code itself ends by converting every placement into
`repositioningData` of one root. Removing the wall math removes no planner capability. What changes
is that the agent computes `posGroup`/`posRotationY` itself, and the MCP server has to teach it how.

**Key finding (decision D1): the rotation values in the comment are mirrored.** The comment
defines `posRotationY` as the clockwise rotation and lists 90° for the right back corner and right
wall, and 270° for the left front corner and left wall. RoomleCore shows the opposite, and so do a
real Furniture_Smith L-shaped plan in RoomleCore's golden data and its top-view render, roomle-ui
and the current server text. `posRotationY`, like every PosGroup `rotationY`, is
**counter-clockwise as seen from above**. The right back corner and the right wall are **270°**;
the left front corner and the left wall are **90°**. RoomleCore converts HI space to kernel space
with a proper rotation and passes the angle through unchanged, so there is no clockwise convention
to handle there. Recommendation: the MCP text tells the agent to use each wall's `facingRotationY`,
which the plan context already provides, plus the corrected table.

Scope: roomle-hi-example (server text, `place-group`, reference client, example page, tests,
documentation) and ligna-store (client copy). roomle-ui and RoomleCore need no change. The
explanation depends on the wall data from roomle-ui PR #3051, which is still open.

---

## The Request (comment 155478)

- Remove `placeGroupAtWall` and `placeCornerAtWall` entirely from ligna-store and
  roomle-hi-example. They are specialised solutions for walls and corners and no general way to
  place objects in a room.
- The HI MCP must explain how to place groups with the `repositioningData` of the generated group,
  setting `posGroup`, `posRotationY` and `rootId`.
- The group origin is its left back point: `rootId` = the leftmost and backmost root module, and
  `posGroup` = the back left position of that module in the room. `posRotationY` is the rotation
  of the group around `posGroup`, in degrees. The comment says "clockwise"; see
  [Verification 2](#2-rotation-sense-of-posrotationy-d1) for why that is not what the planner does.
- Corner: `posGroup` = the exact corner coordinates, with a rotation per corner.
- Wall: `posGroup` = the position of the group's far left module, with a rotation per wall.
- Room contours are defined by the walls; every wall has a start and an end in the coordinate
  system of `posGroup`.

Reading notes:

- The code names are `placeGroupAtWall` (`tool-executors.ts:308`, `index.html:1625`) and
  `placeCornerAtWalls`, plural (`plan-space.ts:327`, `index.html:1234`).
- "If a group is to be placed on the right wall" is read as "on a wall", because the list that
  follows covers all four walls.
- The wall data the comment relies on already exists. Wall `start`/`end` are 3D pos-space points
  since this ticket's previous step (roomle-ui PR #3051, open; roomle-hi-example PR #19 and
  ligna-store PR #64, merged).

---

## Current State

### Two placement flows on the page side

Line numbers are for `hi-mcp/hi-mcp-poc-json-client/tool-executors.ts`. The ligna-store copy has
the same structure: `place-group` at `:692`, `placeGroupAtWall` at `:308`.

1. **`create-or-replace-groups` with `placement`**
   - Validates `placement` (`:477-503`) and resolves the wall from the plan context's `walls`
     before anything loads (`resolveWall`, `:272-304`; `:531-558`).
   - Loads the groups (`:560`), then fetches the raw calculated geometry with
     `getExternalObjectGroups()` (`:582`).
   - Computes a placement per group with `placeGroupAtWall` (`:306-338`, called at `:615`).
   - Rejects a placement whose footprint touches another group and removes the created groups
     again (`findGroupContact`/`contactError`, `:61-125`; `:620-660`).
   - Reloads the placed groups with `repositioningData` of their first article root
     (`repositionedGroup`, `:169-186`, via `repositioningFromPlacement`, `plan-space.ts:476-495`;
     `:661-670`).
   - The result carries `placements` with `placedBy`/`cornerRootId` (`:637-644`). The hint for an
     unpositioned group points to `placement` or `place-group` (`:686-696`).
2. **`place-group`** (server `hi-mcp-server.ts:180-234`, executor `tool-executors.ts:699-782`):
   runs the same math on an existing group and reloads it.

### The geometry behind it (`plan-space.ts`, 558 lines, byte-identical in ligna-store)

| Function | Lines | Purpose |
|---|---|---|
| `groupFootprint`, `rootFootprintPoints` | 137-209 | Bounding box from part boxes, falling back to docking-vector points, then to the `b`/`t` attributes |
| `groupCornerGeometry`, `rootCornerGeometry` | 240-292 | Corner point and back-edge directions from the `LeftBack*`/`RightBack*` vectors |
| `sharedCorner`, `adjoiningWall` | 302-322 | The corner two walls share |
| `placeCornerAtWalls` | 324-374 | Tries two edge-to-wall assignments × ±angle until both back edges run along the walls |
| `resolveWallAlignment`, `placeAgainstWall` | 497-558 | Alignment along a wall, footprint flush to the wall |
| `footprintCornersInRoom`, `rootFootprintInRoom`, `convexPolygonsTouch` | 397-465 | Contact test (separating axis theorem) |
| `repositioningFromPlacement` | 467-495 | Placement → `repositioningData` of the anchor root |

Nothing else imports `plan-space.ts` (only `tool-executors.ts` and `tests/plan-space.test.ts`).
Once the placement flows are removed, the whole module is dead.

### Why it is a problem

- **Specialised.** The only positions it can express are "against a wall" and "into a corner".
  `wall`/`alignment`/`offsetMm` is an abstraction the embedding systems invented. The planner's own
  positioning primitive is `repositioningData`.
- **Planning logic in the embedding system.** This is the same design flaw as comment 155424
  (`compactMasterData`): the embedding system should relay, not compute.
- **Three copies that already drift.** ligna-store's `tool-executors.ts` lacks fix `467a6e6`,
  which fails the call when a placement resolves to no group. `index.html` carries its own inline
  copy (`:926-1351`, `:1357-1659`, `:1799-2106`).
- **Heuristic geometry.** The footprint fallbacks and the corner edge matching guess at the
  geometry. The client's corner fixture puts the corner point at local `[0, 0, 600]`
  (`plan-space.test.ts:250-256`). That contradicts the kernel's corner articles, whose corner point
  is the origin (see [Verification 3](#3-group-origin-and-the-corner-rule)).
- **Placement comes first in the server text.** `repositioningData` is documented as an equal
  alternative (`hi-mcp-server.ts:11`, `:46`), but the instructions, recipes and examples all teach
  `placement` and `place-group`.

---

## Verification

### 1. `repositioningData` alone creates and moves groups (roomle-ui)

| Fact | Evidence |
|---|---|
| The root `rootId` ends up with its origin (left back bottom corner) at `posGroup` and world yaw `posRotationY`: G = T(posGroup, posRotationY) · T(rootRelPos, rootRelRotationY) · R_root⁻¹ | `hi-root-module-arrangement.ts:414-447` |
| New groups: a temporary root id in `rootId` is remapped to the regenerated id | `glue-logic.ts:870-875` |
| Replaced groups (matching `id`) are recalculated with the submitted `repositioningData` | `glue-logic.ts:701-724` |
| Without `repositioningData`, a replace keeps the old `pos`/`rotationY` | `glue-logic.ts:2952-2961`, `hi-root-module-arrangement.ts:142-144` |
| It is applied exactly once and never returned by `get-plan-context` | `glue-logic.ts:2753-2769` |
| Today's clients already use exactly this path for every placement | `tool-executors.ts:169-186`, test `tool-executors.test.ts:573` |

Consequence: `posRotationY` is the world rotation of the **anchor root**. That equals the group
rotation only if the anchor is not turned within the group. In the golden L-shape below, the roots
of the side row have `rotationY 90` inside the group, and a back-to-back island partner is turned
by 180°. The anchor must be a root that is not turned within the group.

### 2. Rotation sense of `posRotationY` (D1)

The ticket author's position is that the PosGroup rotation is clockwise because it lives in a
different coordinate system, and that RoomleCore handles the conversion. Verified against
RoomleCore `2b77596bd`:

| Step | Evidence (RoomleCore) | Result |
|---|---|---|
| Deserialize | `external-module-group-deserializer.cpp:63-65` (group), `:105-107` (root) | `setGroupRotation(toRadians(rotationY))` — no sign change |
| Group transform | `external-module-group-definition.cpp:159-166` (group), `:227-232` (root) | `newTransformationFromOriginAndYawOrientation(pos, Vector2::fromAngle(rotation))` |
| Yaw angle | `vector-2.h:112-116`, `:268-270`; `coordinate-converter.cpp:82-92` | `fromAngle(a) = (cos a, sin a)`, `angleOfVector = atan2(y, x)`: the angle passes through unchanged; yaw scale 1 (`module-group-coordinate-converter.cpp:15-17`, not even read by `coordinate-converter.cpp:8-13`) |
| Space conversion | `module-group-coordinate-converter.h:11-12`, row-major per `matrix.h:139-148` | `C·(x, y, z) = (x, −z, y)`: +90° about X, det +1 — a proper rotation, no mirroring (HI Y-up → kernel Z-up, kernel y = −z, the inverse of the plan context's `(x, y) → (x, level, −y)`) |
| Rotation | `vector-3.cpp:18` (`UP = (0, 0, 1)`), `matrix.cpp:788-817` | Right-handed Rodrigues rotation about +Z: `[[c, −s, 0], [s, c, 0], [0, 0, 1]]` |
| Reverse direction | `coordinate-converter.cpp:25-35` | Yaw axis C⁻¹·UP = +Y, scale 1 — symmetric |

A right-handed rotation about the kernel's up axis, carried back through the proper rotation `C`,
is a right-handed rotation about HI +Y: **counter-clockwise as seen from above**, in both spaces.

**Golden data** — `test/data/golden/plans/furniture-smith-l-shape/`, a real Furniture_Smith
L-shaped kitchen serialized by the kernel:

- Group: `pos [4815, 0, −3765]`, `rotationY 270`.
  - Row A runs along local +X: roots at `articlePos` x = 261 … 2661, `rotationY 0`; 3261 mm long.
  - Row B runs along local +Z: roots at z = 1280 … 2780, `rotationY 90`; 2780 mm long.
  - The corner module sits at `[0, 0, 0]`.
- `_ground_contours.json` gives the L footprint in kernel plan coordinates. Its outer corner is
  (4815, 3765), which is the group `pos` converted. One arm runs from it to y = 504 (3261 mm,
  toward −y), the other to x = 2035 (2780 mm, toward −x).
- Counter-clockwise at 270°:
  - Local +X → (cos 270, 0, −sin 270) = (0, 0, +1) in HI = kernel −y ✓ (row A).
  - Local +Z → (sin 270, 0, cos 270) = (−1, 0, 0) = −x ✓ (row B).
  - A clockwise 270° would send row A to HI −Z (kernel +y), outside the footprint ✗.
- `_top.ppm`, the kernel's top-view render: the L's outer corner is at the **top right**. A 244 px
  arm runs down the right edge and a 208 px arm along the top edge. The ratio 1.173 equals
  3261 / 2780, so the long arm is row A. The group at `rotationY 270` is the kitchen in the
  **right back corner**, and its main row runs down the right wall.

roomle-ui and the current MCP text agree:

- `pos-group-data-model.md:69`: positive = counter-clockwise from above, right-hand rule.
- `hi-root-module-arrangement.ts:49-59`: three.js `makeRotationY` for `posGroup`/`posRotationY`.
- `hi-plan-context.ts:628-642`: a wall a group faces at 270° lies on the right.
- `hi-mcp-server.ts:46`: back right corner → `posRotationY: 270`.

Where the "clockwise" impression can come from: turning a kitchen from the back wall to the right
wall *looks* like 90° clockwise, and 90° clockwise is `rotationY` 270 (= −90).

| Target | Comment (clockwise) | Verified (`posRotationY`) |
|---|---|---|
| back wall / left back corner | 0 | 0 |
| right wall / right back corner | 90 | **270** |
| front wall / right front corner | 180 | 180 |
| left wall / left front corner | 270 | **90** |

With the comment's values, every group placed at a side wall or into a side corner would stand at
the opposite wall.

### 3. Group origin and the corner rule

- The comment's "left back point" matches the kernel contract. The external-object origin is the
  back bottom left corner (RoomleCore `documentation/homag-intelligence/hi-object/externalObjects.md`),
  and the outbound group `pos` is the back-bottom-left corner of the group box (RoomleCore
  `documentation/bug-analysis/external-group-position-corner-frame-asymmetry.md`).
- "`posGroup` = the exact corner coordinates" works because a corner article's corner point *is*
  its origin:
  - The kernel parity fixture `leftCornerDockInfos` starts `LeftBack*`/`RightBack*` at
    `[0, 0, 0]` (roomle-ui `hi-root-module-arrangement-parity-test.ts:37-46`).
  - In the golden L-shape, the corner module sits at the group origin, and the group `pos` is the
    L's outer corner.
- With the verified rotation table, the rule holds for every corner. The rotation is the
  `facingRotationY` of the wall that *ends* in that corner, because contours run counter-clockwise
  with the interior on the left (`hi-plan-context.ts:644-647`):
  - the back wall ends in the left back corner (0),
  - the left wall in the left front corner (90),
  - the front wall in the right front corner (180),
  - the right wall in the right back corner (270).

---

## Scope of the Change

### roomle-hi-example

| File | Change |
|---|---|
| `hi-mcp/hi-mcp-poc-json-client/plan-space.ts` | Delete (whole module becomes unused) |
| `hi-mcp/hi-mcp-poc-json-client/tests/plan-space.test.ts` | Delete |
| `hi-mcp/hi-mcp-poc-json-client/tool-executors.ts` | Remove: imports `:2-19`; `dockingVectorNames`, `freeDockingVectors`, `PARTNER_VECTOR`, `CONTACT_TOLERANCE_MM`, `findGroupContact`, `contactError` (`:32-125`, which were used only by the contact error); `withoutPositions`, `repositionedGroup` (`:157-186`); `WALL_SIDES` … `placeGroupAtWall` (`:244-338`); placement validation (`:477-503`), `'placement'` in the field whitelist (`:521`), wall resolution (`:531-558`), post-load placement (`:578-671`); `place-group` (`:699-782`, D2). Reword the messages `:417`, `:436` and the hint `:686-696`. Add the `repositioningData` checks (D4) and the `placement` rejection (D5). Keep `isGeneratedRoot`, `stripDockingIndices`, `toArticlePick`, `validateArticlePickIds` |
| `hi-mcp/hi-mcp-poc-json-client/tests/tool-executors.test.ts` | See [Tests](#tests) |
| `hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts` | `AUTHORING_RULES` (`:6-46`): replace the placement lines `:7-11`, `:19`, `:27-28` and the examples `:31-46` with the positioning section drafted below. `INSTRUCTIONS` (`:48-56`): steps 2-3. Descriptions: `get-authoring-rules` (`:133-137`, "the placement options"), `create-or-replace-groups` (`:148-160`), `get-plan-context` (`:76-92`, link `facingRotationY` to `posRotationY`). Remove the `place-group` registration (`:180-234`, D2) |
| `hi-mcp/hi-mcp-poc-json/tests/hi-mcp-server.test.ts` | Tool list (`:9-17`) and count (`:49`), snapshot-timeout test (`:79-112`) |
| `minimal-hi-example/index.html` | Same removals in the inline copy: geometry block `:926-1351`; `:1357-1442`, `:1478-1531`, `:1586-1659`; placement parts of `create-or-replace-groups` `:1799-1828`, `:1846`, `:1856-1880`, `:1901-1995`; hint `:2013-2019`; `place-group` `:2022-2106`. Keep `removeExternalObject` at `:672` (page UI) |
| Living docs | `minimal-hi-example/docs/hi-mcp-server.md` (tool reference, authoring section, demo walkthrough, example prompts, architecture table "placement geometry"); `hi-mcp/hi-mcp-poc-json/README.md`, `QUICKSTART.md`; `minimal-hi-example/README.md:53`; `hi-mcp/hi-mcp-poc-json-client/README.md:11`; `minimal-hi-example/docs/hi-mcp-poc-presentation.md:76-77`; `.agents/skills/hi-mcp-tools.md`, `hi-authoring-rules.md`, `roomle-hi-concepts.md` (placement sections), `hi-mcp-server.md:90`; `AGENTS.md:119,155-156,174,178-179,314`; `.github/copilot-instructions.md:82,95,102-104` |
| Not touched | Historical records in `.agents/feature-analysis/` and `.agents/refactoring-analysis/`; `hi-mcp/cf/` (no placement code) |

### ligna-store

| File | Change |
|---|---|
| `hi-mcp/plan-space.ts` | Delete |
| `hi-mcp/tool-executors.ts` | Same removals as the reference client (`place-group` at `:692-776`). Afterwards the file is identical to the reference client again, which also ends the existing drift |
| `hi-mcp/README.md:7` | "Pure geometry lives in `plan-space.ts`" → remove |
| `components/blocks/Planner.vue:251` | No change (imports only `browser-bridge`) |

### roomle-ui and RoomleCore — no change

The plan context already provides what the explanation needs: walls with `start`/`end` in pos
space, `lengthMm`, `type`, the `side` label and `facingRotationY` (`hi-plan-context.ts:648-686`).
The glue logic applies `repositioningData` correctly. RoomleCore needs no conversion (D1).

---

## Proposed Target Shape

### Page-side executors (reference client, ligna-store copy, `index.html`)

- `create-or-replace-groups`:
  - Validates picks, docking, `pos`/`rotationY` (unchanged), plus `repositioningData` (D4) and a
    stale `placement` (D5).
  - Keeps only `id`, `libraryId`, `roots`, `repositioningData` on a group.
  - Validates the article ids, then makes **one** `loadExternalObjectGroupLayout` call and one
    `getExternalObjectPlanContext(['groups'])`.
  - Returns `{ loaded, groups, hint? }`.
  - No `getExternalObjectGroups`, no rollback, no second load.
- `place-group` is gone (D2). Moving a group means resubmitting it with its id and a new
  `repositioningData`.
- No geometry on the page side at all.

### MCP server — the positioning section (draft, to be finalised in the implementation plan)

> Position a group with `repositioningData: { posGroup: [x, y, z], posRotationY, rootId }` — the
> only way to position a group; never author `pos`/`rotationY` or root positions.
> - The origin of a group is its left back point. Set `rootId` to the leftmost root of the group's
>   back row — a unit standing on the floor that is not turned within the group (in an L-shaped
>   group: the corner article) — and `posGroup` to the room position of that root's left back
>   bottom corner, in millimetres (y = 0 on the floor; for a group of wall units only, the
>   mounting height).
> - `posRotationY` turns the group around `posGroup`, in degrees, **counter-clockwise as seen from
>   above** (in the top-view image).
> - Walls: every wall of `get-plan-context` has `start` and `end` — points `[x, 0, z]` on the
>   floor in the coordinates of `posGroup` — and `facingRotationY`. Use walls of type `wall`. With
>   `posRotationY` = the wall's `facingRotationY`, the group's back stands against that wall and
>   the group runs from `posGroup` towards the wall's `start`. Flush into the corner at the wall's
>   end: `posGroup = end`. At a distance d from that corner:
>   `posGroup = end + d · (start − end) / lengthMm`; centred: d = (lengthMm − group width) / 2;
>   right end into the start corner: d = lengthMm − group width.
> - In a rectangular room (back = top, front = bottom in the top-view image): back wall 0, left
>   wall 90, front wall 180, right wall 270. Corners (`posGroup` = the corner point): left back 0,
>   left front 90, right front 180, right back 270.
> - Anywhere else (an island, the room centre, next to a door): any floor point as `posGroup`, any
>   `posRotationY`.
> - To move an existing group, resubmit it from `get-plan-context` with its id and a new
>   `repositioningData`. A replace without `repositioningData` keeps the group where it is.
> - Verify with the returned `position` (`pos`, `rotationY`, `footprint`) and `get-plan-images`.

The examples are rewritten with `repositioningData`. For the row against the right wall:
`posGroup` = the right wall's `end` (the right back corner), `posRotationY` = its
`facingRotationY` (270). The recipes (row, wall unit above, island, corner article) stay; the
corner recipe gets the corner rule.

---

## Decisions (open — to be confirmed in the analysis review)

| # | Question | Recommendation | Alternative |
|---|---|---|---|
| D1 | Rotation convention in the MCP text | Verified convention (counter-clockwise from above; right = 270, left = 90); primary rule "`posRotationY` = the wall's `facingRotationY`"; no conversion anywhere | The comment's clockwise values. That would need a sign flip in one place (e.g. glue logic) and would break the data-model contract, the HI library's own `groupAdjust` repositioning and every stored plan — rejected |
| D2 | `place-group` | Remove the tool; moving = `create-or-replace-groups` with id + `repositioningData` (one way to do it, as the comment describes) | Keep a thin `{ groupId, posGroup, posRotationY, rootId }` wrapper without geometry; saves the agent from resubmitting a large group |
| D3 | Contact guard (a placement meeting another group is rejected, pointing at docking) | Remove; it needs the full geometry this ticket removes. The "extend the group, do not butt a new one" rule stays in the text | Keep it for `repositioningData` in the clients (keeps ~200 lines of geometry), or add a collision check to the glue logic as a separate ticket |
| D4 | Validate `repositioningData` | Yes, small: `rootId` must be a root id of the group (otherwise the glue logic only logs an error and puts the *group* origin at `posGroup`, `hi-root-module-arrangement.ts:432-442`); `posGroup` three finite numbers; `posRotationY` a finite number if given | No validation |
| D5 | A group that still carries `placement` (stale agent context, old deployments) | Reject with a pointer to `repositioningData` | Strip it silently — the group then lands at the plan origin with only a hint |
| D6 | `rootRelPos`/`rootRelRotationY` | Leave out of the agent text (the comment names three fields; the glue logic still accepts them) | Keep documenting them |
| D7 | Wall naming | Keep the side labels `left`/`right`/`top`/`bottom`; the text maps back = top, front = bottom | Rename to back/front in roomle-ui (separate roomle-ui change) |

---

## Tests

Baseline (2026-09-29, `cd hi-mcp && npx vitest run`): 69 tests pass in 5 files — `plan-space` 22,
`browser-bridge` 5, `tool-executors` 26, `page-bridge` 9, `hi-mcp-server` 7. `cf/tests/worker.test.ts`
fails to load because `@cloudflare/containers` is not installed locally; this is pre-existing and
unrelated.

- **Removed:**
  - `tests/plan-space.test.ts` (22).
  - In `tool-executors.test.ts`: `rejects an invalid placement` (`:440`), `resolves a placement
    before loading and re-applies it as repositioningData` (`:573`), `removes the created groups
    again when a placement meets an existing group` (`:653`).
  - `describe('place-group')` (`:710-802`, 4 tests, D2).
- **Adapted:**
  - `keeps repositioningData of a group without a placement` (`:551`) becomes the pass-through
    test: `repositioningData` reaches `loadExternalObjectGroupLayout` unchanged, with one load and
    no `getExternalObjectGroups` call.
  - The fake API (`:214-216`) loses `getExternalObjectGroups`/`removeExternalObject`.
  - `hi-mcp-server.test.ts`: tool list without `place-group` (`:9-17`), "exactly the eight
    expected tools" (`:49`), snapshot timeouts without `place-group` (`:79-112`).
- **New:**
  - D4: an unknown `rootId` and a malformed `posGroup` are rejected and nothing is loaded.
  - D5: `placement` is rejected with the pointer.
  - The hint for an unpositioned group names `repositioningData`.
- **Expected:** 40 remaining tests plus the new ones, in 4 files (+ the pre-existing `cf` failure).
- ligna-store has no unit tests for `hi-mcp/`; they live in roomle-hi-example
  (`ligna-store/hi-mcp/README.md`). The sync check is that `ligna-store/hi-mcp/tool-executors.ts`
  is identical to the reference client.

---

## Output Changes to Expect

| Aspect | Before | After |
|---|---|---|
| Tools | 9, including `place-group` | 8 (D2) |
| `create-or-replace-groups` input | `placement` or `repositioningData` | `repositioningData` only; `placement` rejected (D5) |
| `create-or-replace-groups` result | `{ loaded, groups, placements?, hint? }`; contact rejection with rollback | `{ loaded, groups, hint? }`; no contact rejection (D3) |
| Server instructions / `get-authoring-rules` | Teach `placement` first, `repositioningData` as an alternative | Teach `repositioningData` only, with the wall and corner rules |
| `get-plan-context` | — | Data unchanged; the description links `facingRotationY` to `posRotationY` |
| Page code | Geometry in 3 copies | No geometry: `plan-space.ts` deleted twice (558 lines each), ~450 of 815 lines of `tool-executors.ts`, roughly 900 of 2202 lines of `index.html` |

---

## Risks and Dependencies

1. **The agent computes positions now.** That covers group width for centred or right-aligned
   placements and the wall direction. Mitigation: the `facingRotationY` and `end` rule; the
   returned `position`/`footprint` and `get-plan-images` for checking.
2. **Rotation sense (D1).** With the comment's values, side-wall and side-corner placements are
   mirrored. The draft text avoids the trap by making `facingRotationY` the primary rule.
3. **Anchor choice.** `posRotationY` is the anchor root's world rotation. An anchor turned within
   the group (side row of an L, back-to-back partner) turns the whole group; the text must require
   an unturned floor unit.
4. **Loss of the contact guard (D3).** Agents may butt a new group against an existing one instead
   of extending it.
5. **Deployment order.**
   - A new server with old pages works: the old pages support `repositioningData`.
   - New pages with an old server fail: the old server still advertises `placement` and
     `place-group`, which then get rejected or are unknown on the page.
   - So update the server, including its Cloudflare/Azure deployments (skill
     `hi-mcp-cloudflare-deployment.md`), no later than the pages.
6. **roomle-ui PR #3051 is still open.** It provides the 3D wall `start`/`end` and
   `facingRotationY`. The explanation depends on the Rubens UI the pages load (bo-test by default,
   or the local dev server) including it. The merged client changes (#19, #64) depend on it
   already.
7. **Assumption carried over:** room contours run counter-clockwise, interior on the left
   (`hi-plan-context.ts:644-647`), so `facingRotationY` points into the room. This refactoring
   does not change it.

---

## Verification Plan (after implementation)

1. `cd hi-mcp && npm run typecheck && npm test` passes, apart from the pre-existing `cf` load
   failure.
2. `diff` of ligna-store `hi-mcp/tool-executors.ts` against the reference client shows no
   difference. ligna-store builds.
3. Live, in a rectangular room (`npm start`, MCP client connected):
   - A row with `posGroup` = right wall `end` and `posRotationY` = its `facingRotationY` (270)
     stands against the right wall, flush into the right back corner in `get-plan-images`.
   - A corner article placed into each of the four corners.
   - Moving a group by resubmitting it with new `repositioningData`.
   - This is also the live confirmation of D1; it was not possible in the analysis session because
     the `hi-orchestrator` MCP server was not connected.

---

## Noticed, Out of Scope

- `.agents/skills/roomle-hi-concepts.md` contains older inaccuracies beyond placement (e.g.
  `rotation: [x, y, z]` Euler rotations on roots, ADR 0010/0011 claims about numeric placement).
  Only its placement sections are updated here.

---

## References

- Jira RML-17966 — comment 155478 (this request), comment 155424 (the preceding plan-context
  refactoring: [agent-ready-plan-context-in-glue-logic.md](agent-ready-plan-context-in-glue-logic.md))
- roomle-ui PR #3051 (open), roomle-hi-example PR #19, ligna-store PR #64 (merged) — walls as 3D
  pos-space points
- roomle-ui: `packages/web-sdk/packages/homag-intelligence/src/hi-root-module-arrangement.ts`,
  `glue-logic.ts`, `hi-plan-context.ts`; `packages/embedding-lib/docs/pos-group-data-model.md`
- RoomleCore `2b77596bd`: `src/shared/core/module-group-coordinate-converter.{h,cpp}`,
  `src/util/geometry/coordinate-converter.cpp`, `src/util/geometry/matrix.{h,cpp}`,
  `src/configurator/external/deserializer/external-module-group-deserializer.cpp`,
  `src/configurator/external/definition/external-module-group-definition.cpp`,
  `test/data/golden/plans/furniture-smith-l-shape/`,
  `documentation/homag-intelligence/hi-object/externalObjects.md`
