# Layout and Placement

How the server turns the agent's description of a group into something the planner can arrange:
the relations become docking (`group-layout.ts`), a placement becomes a repositioning of one anchor
root (`group-placement.ts`), and `place-group` computes a wall or corner position from the group's
geometry (`plan-space.ts`). All files are in `hi-mcp/hi-mcp-server/`. The rules the agent is given
are in [hi-mcp-behaviour.md §7](../hi-mcp-behaviour.md#7-positioning). [Back to the overview](./README.md).

## Coordinate conventions

Read this first — most geometry bugs mix up these frames.

- **Units:** millimetres, degrees.
- **Room space:** `[x, y, z]`, y up, the floor at y = 0. roomle-ui maps a plan contour point `(x, y)`
  to `[x, level, −y]`, so **z = −(plan y)**: the back wall — the top of the top view — has the most
  negative z. In plan-space 2D points are `[x, z]`.
- **Rotation:** counter-clockwise seen from above, with the same formula in all three files:
  `[x, y, z] ↦ [x cos θ + z sin θ, y, −x sin θ + z cos θ]`. At 90° local +x turns to room −z.
- **An article's local frame:** +x to the right seen from the front, +y up, the back at z = 0, +z
  towards the front. At rotation 0 the back faces −z, the back wall.
- **Wall facing:** `facingRotationY` is the rotation of a group with its back against the wall: back
  wall 0, left 90, front 180, right 270. With `posRotationY = facingRotationY` a row runs from the
  wall's `end` towards its `start`.

Three different "positions" of a group:

| Frame | What it is | Where |
| ----- | ---------- | ----- |
| **Placement** | the room point of the anchor root's docking corner (the back left bottom of the group) and the group's rotation | the agent's `placement`; `position` in every tool result |
| **Raw group** | the group origin as the planner keeps it — for some articles their centre; the planner may report 270 as −90 | `getExternalObjectGroups()`; computed by `placeAgainstWall`, `placeCornerAtWalls` |
| **Repositioning** | the transform of one root the planner applies to place the group | `repositioningData` sent with a layout |

Footprints and height ranges are in group space; `place-group` keeps the group's y.

## Relations to docking — group-layout.ts

The agent describes a group by naming, for every unit after the first, one neighbour and one
relation: `rightOf`, `leftOf`, `onTop`, `above`, `behind` (with `align` and `gapMm` for stacking).
`relationsToDocking(group, articles, prefix, corrections)` turns them into the planner's docking
entries. It changes `group.roots` in place, reports every change as a correction, and never refuses a
group (it returns no errors). A group without any relation field is left as it is — the agent sent
docking directly.

### Unit kinds

The kind of a unit comes from its catalog article (`catalogArticleOf`):

| Kind | Rule |
| ---- | ---- |
| wall unit | category matches `WALL_UNIT` (`/\bwall ?units?\b/i`), or a hood |
| hood | a root module id matches `/hood/i` |
| tall unit | category `/\btall ?units?\b/i`, or not a wall unit and `mod_Height` ≥ 1500 mm |
| base unit | category `/\bbase ?units?\b/i`, not tall, not wall — carries the worktop, nothing stands on it |
| corner | `isCornerArticle` (`group-placement.ts`) |

`hangGapOf` gives the gap between a floor unit and the wall unit above it, so the wall units' tops are
flush with the tall units: tall height − wall unit height − floor unit height (e.g. 2100 − 720 − 720
= 660). The tall height is the first tall root's, else the library's usual one (D35).

### The pipeline

1. **Read each root's relation** and delete the relation fields. Corrections: `align`/`gapMm` without
   a relation, several relations (the first wins), unknown or self target, a non-wall unit `above`
   (→ `rightOf`), a wall unit `onTop` a base unit (→ `above`), a floor unit `onTop` a base unit (→
   `rightOf`), a wall unit beside a floor unit that is not tall (→ `above`), a floor unit beside a
   wall unit (dropped), `behind` with a corner article (dropped).
2. **Tall units:** a unit `above` a tall unit, or a hood beside one, goes above the floor unit next
   to it; if there is none, beside the tall unit with the tops flush.
3. **Rings:** a relation that would close a ring is dropped (union-find over links and relations).
4. **A floor unit goes first:** the first non-wall root moves to `roots[0]` — the planner arranges
   from the first root.
5. **Default links** for units that name no neighbour: a floor unit right of the previous floor unit,
   a wall unit right of the previous wall unit, else beside the first tall unit or above the n-th
   base unit — each reported.
6. **Side flip:** wall units beside a tall unit on the side without floor units move to the other side.
7. **Two units above one carrier:** the later one goes right of the first one's row; a hood takes the
   first place.

### Vector pairs

| Relation | target vector → unit vector | Mode | Offset |
| -------- | --------------------------- | ---- | ------ |
| `rightOf` | `RightBottom → LeftBottom` | `StartStart` | `[0, 0, 0]` |
| `leftOf` | `LeftBottom → RightBottom` | `StartStart` | `[0, 0, 0]` |
| wall unit beside a tall unit | `RightTop → LeftTop` / `LeftTop → RightTop` | `StartStart` | `[0, 0, 0]` |
| `behind` | `BackBottom → BackBottom` | — | `[0, 0, 0]` |
| `onTop` / `above`, align left / right / back | `LeftTop → LeftBottom` / `RightTop → RightBottom` / `BackTop → BackBottom` | `StartStart` | `[0, gap, 0]` |

`gap` is `gapMm`, else for `above` a floor unit the hang gap, else 0 with a note.

**Entry direction matters.** The planner arranges breadth-first from the first root and applies an
offset only in the direction of the entry. The entry is written on whichever root a breadth-first
search from `roots[0]` reaches first: on the target as
`contextData.dockedRoots[{ ownDockingVector, dockedRoots: [{ id, dockingVector, mode, offset }] }]`,
or mirrored onto the unit with the vectors swapped and the y offset negated.

The module uses fixed vector names; it never reads an article's `dockingVectors`. Replacing a vector
an article does not have is done in `dockTarget` (merge-article-into-group); dropping positions in
`prepareGroup` ([Tool executors](./tool-executors.md#create-or-replace-groups)).

## Placing a new group — group-placement.ts

A new group comes with a `placement { posGroup, posRotationY, rootId? }`: the room point where the
group's back left bottom corner goes, and its rotation. The planner positions a group by the
transform of one root, so the server has to say which root and where that root goes.

### The anchor root — `findAnchorRoot`

`dockingRelations` reads the docking both ways: a `…Top → …Bottom` pair is a carrier, a
`RightBottom ↔ LeftBottom` pair are side neighbours; back-to-back and wall-unit-beside-tall links
are not followed, nor links to roots outside the group (worktop, toe kick).

The walk starts at `rootId` (or `roots[0]`), steps down to the carrier, returns a corner article as
soon as it meets one, otherwise walks to the left end of the row and from there right, returning the
first corner article or the left end. A row therefore anchors at its leftmost unit whatever order the
agent wrote it in; a corner kitchen anchors at its corner article.

Naming trap: in `dockingRelations` the map `rightOf.get(id)` is the root standing *to the right of*
`id` — the opposite sense of the agent's field `rightOf: X`.

`anchorRootOf` uses the catalog's `isCornerArticle` (the `cornerArticle` flag, or `corner` in the
category or a module id) — on an empty plan the catalog carries no flag yet.

### The anchor frame

Where the anchor's docking corner lies in its own coordinates differs per article: the origin of a
cabinet, the left edge of a hood (`[-299, 0, 0]`), `[-261, 0, 0]` for the left-handed corner
`UERTB90`, `[1161, 0, 0]` turned 270° for the right-handed `UELTB90`. `anchorFrameOfRoot` computes the
frame from the root's calculated docking vectors — the turn from its back corner vectors, the point
as the minimum of all vector points in the turned frame. The server learns the frame of each article
variant once with the anchor probe ([Tool executors](./tool-executors.md#the-anchor-probe)) and keeps
it in `knownAnchorFrames` by `anchorVariantKey`.

### Repositioning — `toRepositioningData`

`posGroup` and `posRotationY` pass through; `rootId` is the anchor. With a known frame it adds
`rootRelPos = R(−turn)·(−point)` and `rootRelRotationY = −turn`. The planner composes
`T(posGroup, posRotationY) · T(rootRelPos, rootRelRotationY) · R_root⁻¹`, which puts the anchor's
docking corner exactly on `posGroup`.

### Reading a group back: positionInPlacementFrame

`positionInPlacementFrame(rawGroup, footprint)` gives the position the agent would write: the room
point of the anchor's docking corner, the rotation (group + root + turn, 0–360), and `rootId` only
when the group has more than one corner root; the footprint is re-expressed from that corner.
`inPlacementFrame` applies it to every result that carries groups, so the agent can copy a position
into a new placement.

## Geometry — plan-space.ts

Used by `place-group`, the overlap and in-room tests of the row edits and of
`merge-article-into-group`, and the plan-context vocabulary.

| Function | Returns |
| -------- | ------- |
| `groupFootprint` | the bounding box on x/z in group space, from visible part boxes, else docking-vector points, else the width × depth attributes |
| `groupHeightRange` | `[bottom, top]` in group space |
| `groupCornerGeometry` | the corner of a corner group: root, point and the two leg directions |
| `wallName`, `roomCorners`, `adjoiningWall`, `sharedCorner` | wall names, the room's corners with their rotation, the wall adjoining a wall at a corner |
| `pointInsideRoom`, `roomOfPoint` | ray-cast point-in-polygon on the walls, openings included; L-shaped rooms work |
| `placeAgainstWall` | the raw group `{ pos, rotationY: facingRotationY }` for an alignment along a wall |
| `placeCornerAtWalls` | the raw group in a corner, flush with both walls, shifted by `offsetMm` |
| `wallSpanStart`, `spanAlongWall` | where along a wall a span starts; the span of a footprint along a wall |
| `alignmentRunsParallel`, `resolveWallAlignment` | a side label as `start` or `end` of a wall (left = smaller x, top = smaller z) |
| `volumesOverlap`, `convexPolygonsTouch` | overlap of two placed groups with a tolerance (separating axis test) |
| `wallOfOpening` | the wall, room and span of a door or window |
| `groupPointToRoom`, `footprintCornersInRoom`, `rootFootprintInRoom` | group space to room space |
| `repositioningFromPlacement` | the repositioning of a raw group position for `place-group` |

`DerivedWall` — the walls of the plan context — comes from roomle-ui (`deriveWalls` in
`hi-plan-context.ts`); only straight contour segments become walls.

## Before you change these files

- **The tests pin the geometry.** `tests/group-placement.test.ts` checks the anchor frames of every
  corner hand, the anchor walk (cycles, islands, wall units, generated roots, empty plans) and that
  the docking corner lands on `posGroup` at 0, 90, 180 and 270°; `tests/plan-space.test.ts` the wall
  and corner placements of the test room, an L-shaped room and a wall split by a door;
  `tests/group-layout.test.ts` a full kitchen of a real agent that must compile to exactly its own
  docking.
- **Footprints are bounding rectangles** — for L- and U-shaped groups the overlap and in-room tests
  are conservative.
- **roomle-ui computes footprints too.** The `position.footprint` of the plan context comes from
  roomle-ui (`hi-plan-context.ts`); `plan-space.ts` computes its own. Keep them in step.
- **The served rules depend on these conventions.** The rotation sense, the wall `end` rule and the
  corner-hand rule are written into `AUTHORING_RULES` (`hi-mcp-server.ts`) and the behaviour
  reference — change them together.
