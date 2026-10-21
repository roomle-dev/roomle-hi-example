# Coordinate Systems

How the HI tools describe positions and rotations to an AI agent, which tools make the agent read or
write coordinates, and where the implementation converts between the coordinate systems of the
agent, roomle-ui and RoomleCore. Read it before changing anything that reads or writes a position,
a rotation, a wall span or a footprint. [Back to the overview](./README.md).

The geometry of the placement — the anchor walk, the relations, the docking — is described in
[Layout and placement](./layout-and-placement.md); the rules the agent gets in
[hi-mcp-behaviour.md §5](../../docs/hi-mcp-behaviour.md#5-information-the-server-provides) and
[§7](../../docs/hi-mcp-behaviour.md#7-positioning). This document follows one question through all
of them: which frame is a number in, and where does it change frame.

Paths:

| Short form | Repository and folder |
| ---------- | --------------------- |
| `hi-mcp/…` | roomle-ui `packages/embedding-lib/src/homag-intelligence/hi-mcp/` — the HI tools (`createHiMcpTools`) |
| `hi/…` | roomle-ui `packages/web-sdk/packages/homag-intelligence/src/` — the plan context and the HI tool commands |
| `planner-core/…` | roomle-ui `packages/web-sdk/packages/planner-core/src/` |
| `src/…` | RoomleCore `src/` — the kernel |

## 1. The coordinate system and where the agent learns it

### 1.1 The agent's coordinate system

The agent works in **one coordinate system**, called *pos space* in the code because it is the space
of a `PosGroup` (the HI group JSON). Every number the agent reads or writes is in it, or is a
distance measured inside it.

| Property | Value |
| -------- | ----- |
| Units | millimetres; angles in degrees |
| Handedness | right-handed |
| Up | `+y`; the floor of the room is `y = 0` |
| Top-view image | `+x` points to the right edge, `−z` to the upper edge, `+z` to the lower edge |
| Back wall | the upper edge of the top view (`side: 'top'`, name *back wall*) — the most negative `z` |
| Front wall | the lower edge of the top view (`side: 'bottom'`, name *front wall*) — the largest `z` |
| Origin | the origin of the plan; `x` is the kernel's `x`, `z` is the kernel's `−y`, `y` is the kernel's height `z` |

A point is `[x, y, z]`. Floor points are written `[x, 0, z]`; points that belong to a contour
level carry that level: `[x, level, z]`.

#### Rotation

A rotation is a rotation about `+y`, in degrees, **counter-clockwise as seen from above** — in the
top-view image. roomle-ui turns a point `[x, y, z]` by `θ` with this formula everywhere, and the
kernel's yaw gives the same result (3.1):

```text
[x, y, z]  ↦  [x·cos θ + z·sin θ,  y,  −x·sin θ + z·cos θ]
```

At 90° a group's local `+x` turns to room `−z` (towards the back wall) and its local `+z` (its
front) turns to room `+x`. The planner may report 270° as −90°; the tools normalise to 0–360.

#### The local frame of an article and of a group

| Axis | Direction |
| ---- | --------- |
| `+x` | to the right, as seen from the front |
| `+y` | up |
| `z = 0` | the back of the article |
| `+z` | towards the front |

At rotation 0 the back of a group faces `−z`, the back wall. *Right* and *left* in the served rules
always mean "as seen from the front", which is the local `+x` / `−x` of the group: `rightOf`,
`leftOf`, `rowIndex` (1 at the left end), the hinge side of a door, the left-to-right order of the
image-planning skill.

#### The walls and the 1D coordinates along them

Every wall of `get-plan-context` has `start` and `end` (floor points), `lengthMm` and
`facingRotationY` — the rotation of a group standing with its back against the wall. The kernel's
room contour runs counter-clockwise with the room on its left (D61 of
[hi-mcp-behaviour.md](../../docs/hi-mcp-behaviour.md#3-decisions)), so in a rectangular room:

| `side` | `name` | Runs in the top view (start → end) | `end` lies in the corner | `facingRotationY` |
| ------ | ------ | ---------------------------------- | ------------------------ | ----------------- |
| `top` | back wall | right → left | back left | 0 |
| `left` | left wall | back → front | front left | 90 |
| `bottom` | front wall | left → right | front right | 180 |
| `right` | right wall | front → back | back right | 270 |

A group placed with `posRotationY = facingRotationY` stands with its back to the wall, and its row
(local `+x`) runs from the wall's `end` towards its `start`. This is why the distances along a wall
are measured **from the wall's end**: they count from the corner where a row starts.

| Name | What it measures |
| ---- | ---------------- |
| `fromEndMm: [from, to]` | the span of a door or a window along its wall, measured from the wall's end; the same unit as the free stretches in a `hint` |
| `offsetMm` | the distance along the wall away from the corner named by `alignment`, or from the wall's end (`alignment: 'end'`), or from the centre (`center`, the default) |
| `alignment` | `start` / `end` — the wall's endpoints; `center`; or the side label of the adjoining wall — flush into the corner the two walls share |

With `alignment: 'end'` and `offsetMm = d` the group's back left corner is `d` from the wall's end,
so the start of a free stretch `fromEndMm` can be used as `offsetMm` directly.

The side labels name the whole wall face; a door or a floor-to-ceiling window splits it into several
entries of the same side (pieces of type `wall` and the openings between them). A wall index names
one piece.

#### Room corners

Every room carries `corners`: per corner its `name` (back left, back right, front left, front
right), its floor `point` and `posRotationY` — the `facingRotationY` of the wall that ends in the
corner, the rotation of a corner kitchen there: back left 0, front left 90, front right 180, back
right 270 (D13, D33, D83).

#### The position of a group — the placement frame

A group's position is expressed in the frame a placement names, wherever the planner keeps the
group origin internally:

| Field | Meaning |
| ----- | ------- |
| `pos` | the room point of the group's **back left bottom corner** — the docking corner of its anchor root (the leftmost root of a row, the corner article of a corner group) |
| `rotationY` | the rotation of the group, as `posRotationY` of a placement |
| `rootId` | only with two corner articles: the root the `pos` belongs to |
| `footprint` | `x` and `z` ranges with `widthMm` and `depthMm`, measured from `pos` in the anchor's turned frame: for a row, `x` along the row to the right and `z` towards the front; for a corner group the frame of its corner article, whose two back edges run along `+x` and `+z` |

The agent can copy a group's `pos` and `rotationY` into a new placement and gets the same position.

#### Heights

`y` is the height above the floor. `posGroup[1]` is 0 for a group on the floor and the mounting
height for a group of wall units only. `bottomMm` / `topMm` of the obstacles are absolute heights.
`gapMm` of `onTop` and `above` and the `y` of a `dockTo.offset` are clearances, not positions. A
placement at a wall keeps the group's height.

#### Frames that are not the room

| Frame | Where the agent meets it | Axes |
| ----- | ------------------------ | ---- |
| Group space | `dockTo.offset` of `merge-article-into-group` — a translation added after docking | the group's local axes |
| Parent-local space of an interior fitting | `position` in `get-interior-design-options`, `insertPosition` of the fitting tools | `x` right, `y` up, `z` front, relative to the parent module (`parentModuleId`); a fitting's position is where its parts start (the lowest corner of their boxes) |

#### The top-view image

`get-plan-images` returns the HI groups alone seen from their front, and a top view of the plan. The
top view shows the room as the side labels name it: the wall with `side: 'right'` at the right
edge, `top` at the upper edge. The agent can check a position visually there, but the rules tell it
to verify positions numerically.

### 1.2 Where the agent learns it

The agent learns the coordinate system only from the text the HI tools serve and from the data they
return. No channel states it in one place.

| Channel | Source | What it says about coordinates |
| ------- | ------ | ------------------------------ |
| System prompt of the planning assistant | `SYSTEM_PROMPT` in `hi/hi-agent-prompts.ts`, passed as `instructions` by `startPlanningAssistant` (`hi-planning-assistant.ts` of the embedding-lib) | nothing |
| MCP server instructions | — | `createHiMcpTools` serves no instructions; the tools are plain AI SDK tools without the MCP handshake |
| Tool descriptions and parameter descriptions | `registerTool(…)` calls in `hi-mcp/hi-mcp-server.ts` | the axes, the wall vocabulary, the placement forms, the obstacle and installation element frames, the offset and insertion frames — see below |
| Authoring rules | `AUTHORING_RULES` in `hi-mcp/hi-mcp-server.ts`, returned by `get-authoring-rules` | the placement, walls, room corners, obstacles, relations and the examples — see below |
| Planning skills | `hi-mcp/skills/*/SKILL.md`, returned by `get-skill`; `SKILL_IN_SESSION` before every `SKILL.md` | no coordinates; image-planning orders a row "from left to right as seen from the front" and chooses walls and corners by name |
| Tool results | the plan context and the tool command results | the numbers themselves, `corrections` and `hint` texts that name `fromEndMm` stretches and the `offsetMm` that clears an opening |

#### In the tool descriptions

`get-plan-context` states the system itself:

> one coordinate system throughout: 3D, right-handed, Y up (group pos and room contours use
> pos: [x, level, -y])

and, per section: the walls with "a side label (left/right/top/bottom as seen in the top-view
image), start/end [x, 0, z] in millimetres (the 3D contour points on the floor), lengthMm, type,
heightMm, thicknessMm and facingRotationY - the posRotationY of a group standing with its back
against that wall"; the groups with "position with pos - the room point of the group's back left
bottom corner, as a placement names it - rotationY, rootId … and footprint" and "no root positions,
no geometry"; the obstacles "in the coordinates of the walls", with "outline (floor points
[x, 0, z]) and bottomMm/topMm" and for a door or a window "fromEndMm (its span along that wall from
the wall's end)"; the installation elements with "position [x, level, z] in the coordinates of the
walls".

`create-or-replace-groups` names both placement forms: `{ wall, alignment?, offsetMm?, roomIndex? }`
— "offsetMm moves it along the wall away from that corner or from the wall's end - the fromEndMm of
the obstacles is measured from there" — and `{ posGroup, posRotationY }`, "the room point of the
group's back left corner and its rotation".

`place-group` describes its parameters: `wall` as "a side label as seen in the top view … or a wall
index", `alignment` as "'center' (default), 'start'/'end' (the wall's endpoints), or the side label
of an adjoining wall to sit flush in that corner (e.g. wall "right" + alignment "top" is the back
right corner in the top view)", `offsetMm` as "Extra distance in millimetres along the wall from the
chosen alignment".

`merge-article-into-group` describes `dockTo.offset` as "[x, y, z] in millimetres added after
docking"; it does not name the frame (group space).

The interior fitting tools share the parameter `insertPosition`: "Millimetres x right, y up,
z front, relative to parentModuleId - the frame of a fitting position from
get-interior-design-options; to move a fitting by an offset, add it to that position."

`get-plan-images` says the top view's "orientation matches the wall side labels of
get-plan-context: a wall with side 'right' is at the right edge of the top image, 'top' at the upper
edge".

#### In the authoring rules

- **Relations** — "right and left as seen from the front".
- **placement** — the wall form, and the point form: "posGroup the room point of the group's back
  left bottom corner in millimetres (y up, y = 0 on the floor; for a group of wall units only, their
  mounting height), posRotationY its rotation in degrees, counter-clockwise as seen from above (in
  the top-view image), required, 0 for no rotation".
- **Walls** — "start and end (points [x, 0, z] on the floor, in the coordinates of posGroup),
  lengthMm, type and facingRotationY, the posRotationY of a group with its back against that wall
  (back 0, left 90, front 180, right 270 in a rectangular room)", and that a door or a
  floor-to-ceiling window splits a wall into several entries of the same side.
- **Room corners** — the corner names and points (back = top, front = bottom in the top-view image)
  and which leg runs along which wall. The corner entries also carry `posRotationY`; the rules do not
  mention it.
- **Obstacles** — "fromEndMm is measured from the wall's end, so a placement with that wall,
  alignment end and offsetMm = the start of a free stretch puts the group on it", and the 600 mm
  `offsetMm` that keeps a corner group clear of an opening of the adjoining wall.
- **Verify results numerically** — the returned groups carry `position` (`pos`, `rotationY`,
  `footprint`); "Do not judge a position from a rendering alone."
- **rowIndex** — "1 at the left end as seen from the front".
- **Examples 1, 3 and 4** — a placement at the right wall flush into the back corner, an L-shaped
  kitchen in the back right corner, a row centred on the back wall.

No served text names the direction of `+x` or `+z` in the top view; the agent reads it from the
walls' `start`/`end` and side labels. The agent is told never to author a position on a root or a
group; it positions only a new group, by its placement.

#### What the agent is not given

The kernel's plan coordinates (`x`, `y` on the floor, `z` up), the raw group origin the planner
keeps, the root positions (`articlePos`, `rotationY` of a root), the docking vector points and the
`cornerPoint` of an article (removed by `agentFacingArticle`), `repositioningData`, and the part
matrices. A position the agent sends on a root or a group is dropped and reported in `corrections`.

## 2. The tools in which the agent deals with coordinates

| Tool | Reads | Writes |
| ---- | ----- | ------ |
| `get-plan-context` | room contours, walls, corners, obstacles, installation elements, group positions and footprints | — |
| `create-or-replace-groups` | the `position` of the groups in the result; `fromEndMm` stretches and the clearing `offsetMm` in `hint` | `placement` of a new group: `{ wall, alignment, offsetMm, roomIndex }` or `{ posGroup, posRotationY, rootId }`; `gapMm` of a relation |
| `place-group` | the `position` of the moved group; `hint` | `wall`, `alignment`, `offsetMm`, `roomIndex` |
| `merge-article-into-group` | the `position` of the changed group | `dockTo.offset` (group space) |
| `get-interior-design-options` | `position` of every fitting (parent-local) | — |
| `add-interior-fitting`, `move-interior-fitting`, `replace-interior-fitting` | the placement of the fitting in the result | `insertPosition` (parent-local) |
| `insert-article-into-group`, `exchange-root-module`, `swap-root-modules`, `delete-article-and-compact`, `delete-article-in-place`, `merge-groups`, `undo`, `redo` | the `position` of the returned groups | — |
| `get-plan-images` | the top view, oriented like the side labels | — |

The other tools — `find-attributes`, `get-authoring-rules`, `get-skill`, `change-module-attribute`,
`change-group-attribute`, `delete-group`, `open-or-close-group`, `open-or-close-article`, `get-price`,
`get-order-data`, `delete-interior-fittings` — neither take nor return coordinates. A size attribute
(width, depth, height) is a dimension, not a position.

### get-plan-context

The agent's whole picture of the room is in its sections, all in pos space:

| Section | Coordinates |
| ------- | ----------- |
| `rooms[].levels[].segments[].pos` | the room contour, `[x, level, z]` per segment, with the SVG command `cmd` (`M`, `L`, `Z`, …) |
| `rooms[].walls[]` | `start`, `end` (`[x, 0, z]`), `lengthMm`, `facingRotationY`, `side`, `name`, `index` |
| `rooms[].corners[]` | `name`, `point` (`[x, 0, z]`), `posRotationY` |
| `obstacles.objects[]` | `outline` (`[x, 0, z]` around the object), `bottomMm`, `topMm`; a door or a window also `roomIndex`, `wall` (an index), `fromEndMm` |
| `obstacles.groups[].roots[]` | the `outline` of every root module in the room, `bottomMm`, `topMm` |
| `installationElements[]` | `position` `[x, level, z]` of an electric plug or a water connection |
| `groups[].position` | `pos`, `rotationY`, `rootId`, `footprint` in the placement frame |
| `groups[].roots[].rowIndex` | the place of a root in its row, 1 at the left end as seen from the front |

### create-or-replace-groups

The only tool in which the agent writes room coordinates. A new group carries one `placement`:

- **At a wall or in a room corner** — `{ wall, alignment?, offsetMm?, roomIndex? }`. The agent names
  a wall by side label (`left`, `right`, `back`/`top`, `front`/`bottom`) or index, and positions the
  group along it in one dimension. The server computes the point and the rotation.
- **Anywhere else, and a group of wall units only** — `{ posGroup: [x, y, z], posRotationY,
  rootId? }`. The agent writes a room point and a rotation: the back left bottom corner of the group
  and its counter-clockwise rotation. For a group in a corner, `point` and `posRotationY` of the
  room's `corners` entry; for a group against a wall, the wall's `facingRotationY`.

A placement on a group that is already in the plan is not used; `pos`/`rotationY` on a group and
`articlePos`/`rotationY` on a root are dropped and reported. `gapMm` of `onTop` or `above` is a
vertical clearance. The result reports every group's `position` in the placement frame; a
`hint` names root modules on obstacles with the free stretches of their wall (`fromEndMm`) and the
`offsetMm` that clears an opening of the adjoining wall.

### place-group

Moves an existing group by `wall`, `alignment`, `offsetMm` and `roomIndex` — the same values as the
wall form of a placement. A target that overlaps another group moves along the wall; `corrections`
say by how many millimetres.

### merge-article-into-group

`dockTo.offset: [x, y, z]` is a translation in the group's frame, added to the docked root after
docking. Its `y` is the clearance of an article hung above a floor unit; omitted, the server sets the
hang gap. The tool positions by docking, never by room coordinates (D19).

### The interior fitting tools

`get-interior-design-options` returns per fitting its `position` relative to its parent module;
`add-interior-fitting`, `move-interior-fitting` and `replace-interior-fitting` take an optional
`insertPosition` in the same frame. To move a fitting by an offset, the agent adds the offset to its
position.

### The tools that return groups

Every command tool, `undo` and `redo` return the changed groups with their `position` in the
placement frame, so the agent can check a move numerically and copy a position into a placement.

### get-plan-images

No numbers, but the top view is the agent's only picture of the room; its orientation follows the
side labels.

## 3. Where the implementation converts coordinates

Four coordinate systems meet:

| System | Up | Floor plane | Who uses it |
| ------ | -- | ----------- | ----------- |
| **Kernel plan space** | `+z` | `x`, `y` | RoomleCore: walls, room contours, obstacle map, plan objects |
| **Pos space (room)** | `+y` | `x`, `z = −y_kernel` | the agent, the plan context, a group's `pos`, every placement |
| **Group space** | `+y` | the group's local `x`, `z` | root positions (`articlePos`, `rotationY`), footprints, docking offsets, part matrices when the group's `ver` is above 0 |
| **Root space / parent-local** | `+y` | the root's local `x`, `z` | docking vector points, interior fitting positions |

```text
RoomleCore (z up)                         roomle-ui web-sdk (pos space, y up)               HI tools → agent
─────────────────                         ───────────────────────────────────               ────────────────
room contour (x, y) at level  ─────────▶  convertContour: [x, level, −y]  ─▶ deriveWalls ─▶ agentFacingRooms: names, corners
obstacle map points (x, y)    ─────────▶  shapeObstacles: [x, 0, −y]                     ─▶ agentFacingObstacles: wall, fromEndMm
plan object centre {x, y, z}  ─────────▶  _gatherInstallationElements: [x, z, −y]
group JSON (pos space)        ─────────▶  shapeGroup / rootOutline  ─▶ inPlacementFrame  ─▶ position { pos, rotationY, footprint }

agent placement                                                                             ◀── { posGroup, posRotationY } / { wall, … }
group JSON with repositioningData ◀──────  toRepositioningData / repositioningFromPlacement
ModuleGroupCoordinateConverter    ◀──────  HiRootModuleArrangementOperator: group.pos, rotationY
```

### 3.1 RoomleCore: pos space ↔ kernel space

The kernel keeps an HI group as its JSON definition in pos space and converts it when it builds the
plan object.

- **`ModuleGroupCoordinateConverter`** (`src/shared/core/module-group-coordinate-converter.h`) is the
  conversion. `ModuleDefinitionToModelCoordinateSystemTransformation` holds the matrix
  `{1, 0, 0, 0, 0, 0, −1, 0, 0, 1, 0, 0, 0, 0, 0, 1}`. `Matrix4` is row-major (`operator*` in
  `src/util/geometry/matrix.h`), so a pos-space point `[x, y, z]` becomes the kernel point
  `(x, −z, y)`. The yaw axis is the kernel's up axis and the angle scale is 1: a pos-space
  `rotationY` is the kernel's yaw angle unchanged, and both are counter-clockwise from above (D13).
- **`ModuleGroupDefinition::update`** (`src/configurator/external/definition/external-module-group-definition.cpp`)
  turns the group's `pos` and `rotationY` into `groupPosInModelSpace` and `groupYawAngleInRadians`
  (`CoordinateConverter::newTransformationFromOriginAndYawOrientation`, `convertYawAngle`). The
  deserializer (`external-module-group-deserializer.cpp`) reads `pos`, `rotationY` in degrees, and
  per root `articlePos` and `rotationY`.
- **`ModuleGroupConfigurator::createConfigurationProperties`**
  (`src/configurator/external/external-module-group-configurator.cpp`) places the plan object by the
  bottom centre of the group's box, transformed by the group's corner transformation.
- **The way back** — `PlanModelViewHelper::getExternalObjectGroups` returns each group's
  `serializedDefinition`, the JSON in pos space; roomle-ui (`getExternalObjectGroups` in
  `planner-core/roomle-planner.ts`) parses it. This is the *raw group*: its `pos` is the group
  origin as the planner keeps it, which can lie on any root or corner after a reload.
- **Room contour and obstacle map** stay in kernel plan space when they leave the kernel
  (`PlanModelViewHelper::getExternalRoomInformation` in `PLAN` mode, `getObstacleMap`). roomle-ui
  converts them (3.2).
- **Plan XML** of version 2 stores `y` mirrored: `PlanXmlReader::convertPointFromPlanXML`
  (`src/planner/serializer/plan-xml-reader.cpp`) reads `(x, −y, z)`. A pos-space `z` therefore equals
  the `y` of a version 2 plan XML.
- **The group view of `get-plan-images`** turns the camera by `Plan::getRotationForFrontView`
  (`src/planner/model/plan.cpp`), from the docking vectors of the groups.

### 3.2 roomle-ui: kernel data → the plan context

The planner methods hand the kernel's data to `createPlanContext` (`hi/hi-plan-context.ts`), which
returns every section in pos space. The comment on the module says so: "in one coordinate system -
3D, right-handed, Y up, the coordinate system of `PosGroup`".

| Data | Kernel source | Conversion | Code |
| ---- | ------------- | ---------- | ---- |
| Room contour | `getExternalRoomInformation(PLAN)` (`planner-core/roomle-planner.ts`) | per segment `(x, y)` of a contour at `level` → `[x, level, −y]`; a `Z` segment takes the point of the last `M` | `convertContour`, `convertContourSegment` |
| Walls | the converted contour of level 0 (or the first level) | only straight contours (`M`, `L`, `Z`); per segment `start`/`end` `[x, 0, z]`, `lengthMm`, `facingRotationY = atan2(dz, −dx)` normalised to 0–360, `side` by the 90° bucket of `facingRotationY` (90 left, 180 bottom, 270 right, else top) | `deriveWalls`, `sideFromFacing` |
| Obstacle objects | `getObstacleMap` (`_getExternalPlanObstacles`) — points `(x, y)` and segments with `bottom`/`top` | the segments of one object chained into an outline (bounding rectangle when they form no loop); points → `[x, 0, −y]`; `bottom`/`top` → `bottomMm`/`topMm` unchanged (the kernel's `z`) | `shapeObstacles`, `chainOutline` |
| Root modules of the groups (obstacles) | the raw groups | the box of the root's points in group space → its four floor corners turned and moved by the group's `pos` and `rotationY`; heights + the group's `y` | `rootOutline`, `rootPoints`, `transformPointByRoot` |
| Installation elements | the live plan objects (`hi/api.ts`) | `owner.getCenter()` `{x, y, z}` → `[x, z, −y]` | `_gatherInstallationElements`, `shapeInstallationElements` |
| Groups | the raw groups | `position: { pos, rotationY, footprint }` raw — the footprint is the group-space bounding box of the roots' points; turned into the placement frame afterwards (3.4) | `shapeGroup`, `groupFootprint` |

The points of a root in group space come from its parts (`fullMatrix`, column-major with the
translation in elements 12–14, `transformPointByMatrix`), else from its docking points turned by the
root, else from its size attributes. The part matrices are in group space when the library's
`posGroupVersion` (`group.ver`) is above 0, and in root space otherwise — `rootPoints` turns them by
the root then.

### 3.3 HI tools: the agent's vocabulary

The `get-plan-context` executor (`hi-mcp/tool-executors.ts`) passes the plan context through and adds
the agent's words with the functions of `hi-mcp/agent-facing.ts`. It converts no coordinates; it
derives values in the same space:

| Function | Adds |
| -------- | ---- |
| `agentFacingRooms` | per wall its `name` (`wallName`: top → back wall, bottom → front wall), `type: 'opening'` for a contour segment without type; per room its `corners` (`roomCorners`) |
| `roomCorners` | a corner where a wall ends and the next starts at an angle that turns into the room; `name` from the two sides, `point` the shared floor point, `posRotationY` the `facingRotationY` of the wall that ends there |
| `agentFacingObstacles` / `wallOfOpening` | for a door or a window the wall whose line its outline touches over the longest stretch (within the wall's thickness), and its span along that wall from the wall's end: `fromEndMm = [length − to, length − from]` of `spanAlongWall` |
| `agentFacingArticle` | removes the article's `cornerPoint` — a root-space point the agent must not use |

`hi/hi-plan-space.ts` has its own `wallName`, `roomCorners`, `spanAlongWall` and `wallOfOpening` for
the hints of the tool commands; keep both copies in step.

### 3.4 roomle-ui: raw group → placement frame

The agent reads a group in the frame it places one with. `positionInPlacementFrame`
(`hi/hi-group-placement.ts`) computes it from the raw group:

1. **The anchor** — `findAnchorRoot` with `hasCornerVectors`: the first corner article on the walk,
   else the left end of the row (see [Layout and placement](./layout-and-placement.md#the-anchor-root--findanchorroot)).
2. **The anchor frame** — `anchorFrameOfRoot`: the turn of a corner article from its `RightBack…` or
   `LeftBack…` docking vector (`cornerTurnOf`, 270 for a right-handed corner article, else 0), and the
   docking corner as the minimum of all docking vector points in the turned frame (the
   `CollisionBox` vector excluded).
3. **The corner in group space** — the frame point turned by the root's `rotationY` plus its
   `articlePos`.
4. **The corner in the room** — that point turned by the group's `rotationY` plus the group's `pos`.
5. **The rotation** — group `rotationY` + root `rotationY` + turn, normalised to 0–360.
6. **The footprint** — `footprintInFrame`: the group-space footprint measured from the corner and
   turned back by the root's rotation and turn.
7. **`rootId`** — only when the group has more than one corner root.

`inPlacementFrame` (`hi/hi-tool-commands.ts`) applies it, and adds the `rowIndex` of every root
(`withRowIndices`), to:

- the plan context — `HiToolsImplementation.getPlanContext` (`hi/hi-tools.ts`),
- every group operation result — `executeGroupOperation` (`hi/hi-tools.ts`),
- every tool command result — `runToolCommand` (`hi/hi-tool-commands.ts`).

### 3.5 roomle-ui: placement by point → repositioningData

`create-or-replace-groups` with `{ posGroup, posRotationY, rootId? }`:

1. **Positions are dropped** — `prepareGroup` (`hi/hi-tool-payload.ts`) deletes `pos`/`rotationY`
   of a group and `articlePos`/`rotationY` of its roots and reports it; a `repositioningData` the
   agent sent becomes the placement when there is none.
2. **The anchor** — `anchorRootOf` (`hi/hi-group-placement.ts`), from `rootId` or `roots[0]`, with
   the catalog's `cornerArticle` flag.
3. **The anchor frame** — the tool command calculates the anchor's article with its attribute
   overrides outside the plan (`planner.calculateArticleTemplate`) and takes `anchorFrameOfRoot` of
   its first calculated root, once per `anchorVariantKey`. Without a template the group is placed by
   the unit's origin and a correction says so.
4. **`toRepositioningData`** — `posGroup`, `posRotationY` and `rootId` pass through; with a frame
   other than the identity it adds `rootRelPos = R(−turn)·(−point)` and
   `rootRelRotationY = −turn`, so the anchor's docking corner, not its origin, lands on `posGroup`.
5. **The ids** — the glue logic regenerates the root ids and remaps `repositioningData.rootId`
   (`_replaceRootModuleIdsAndRemapDockedRoots` in `hi/glue-logic.ts`).
6. **The group transform** — `HiRootModuleArrangementOperator._applyRepositioningData`
   (`hi/hi-root-module-arrangement.ts`) arranges the roots in group space first, then composes
   `G = T(posGroup, posRotationY) · T(rootRelPos, rootRelRotationY) · M_root⁻¹` with three.js
   matrices (`getPositionTransformation`, `makeRotationY`) and decomposes it into the group's `pos`
   and `rotationY` (`setGroupPositionFromTransformation`, Euler order `YXZ`). This is where a 270°
   placement can come back as −90°.
7. **The kernel** converts `pos` and `rotationY` to kernel space (3.1).

### 3.6 roomle-ui: placement by wall and place-group

A placement `{ wall, … }` and `place-group` take the same path in `hi/hi-wall-placement.ts` and
`hi/hi-plan-space.ts`. A new group is loaded first, where the planner puts it, because the wall
arithmetic needs the calculated group (`placeAtWalls` in `hi/hi-tool-commands.ts`).

1. **The spec** — `wallPlacementSpec`: `back` → `top`, `front` → `bottom` (`SIDE_SYNONYMS`), the
   defaults `center`, 0 and room 0.
2. **The wall** — `resolveWallPlacement` / `resolveWall`: a side label names the longest face of that
   side (`wallFaces`), an index one piece; an alignment that runs parallel to the wall becomes
   `center` with a correction. `pieceOrFace` puts the group on the longest piece of the face when it
   fits there.
3. **The footprint** — `groupFootprint` of `hi-plan-space.ts`, in group space, from the calculated
   raw group.
4. **A corner group** (alignment names the adjoining wall and the group has a corner article) —
   `placeCornerAtWalls`: the shared corner point of the two walls (`sharedCorner`), the rotation
   that lays the corner article's two back edges (`groupCornerGeometry`) along the two walls
   (`rotateDirection`, both assignments of the edges tried), and
   `pos = cornerPoint − R(rotation)·corner.point + alongWall · offsetMm`, where `corner.point` is the
   corner article's corner point in group space.
5. **Every other group** — `placeAgainstWall`:
   - `resolveWallAlignment` turns a side label into `start` or `end`: `left` and `top` are the
     smaller `x` and `z`, `right` and `bottom` the larger.
   - `wallSpanStart` gives where the group's span starts, measured from the wall's start: `start` →
     `offsetMm`; `end` → `length − width − offsetMm`; `center` → `(length − width) / 2 + offsetMm`.
   - The group's local `x` runs against the wall's direction, so its back left corner sits at
     `start + along · (spanStart + width)`; the footprint's minimum, turned by `facingRotationY`, is
     subtracted to get the raw group origin.
   - The rotation is the wall's `facingRotationY`.
6. **The height** — the raw group's `y` is kept (`placeGroupAtWall`).
7. **Overlaps** — `wallTarget`: a target whose root modules overlap another group's
   (`overlappedGroupIds`, `rootVolumesInRoom`) moves along the wall to the nearest free position
   (`freePlacementAlongWall`).
8. **The reload** — `repositionedGroup` sends the calculated group back without root positions;
   `repositioningFromPlacement` expresses the raw group position as the room transform of its first
   article root: `posGroup` = that root's `articlePos` turned and moved by the placement,
   `posRotationY` = placement rotation + root rotation, no `rootRelPos`. The planner reloads it
   (`HI_LOAD_OBJECT_REASON.ADJUSTED`) and applies it as in 3.5 step 6. `standsAt` skips the reload
   when the group already stands there (5 mm, the same rotation modulo 360).

### 3.7 roomle-ui: the distances along a wall in the feedback

The hints of `hi/hi-tool-hints.ts` speak the agent's 1D wall coordinates:

| Function (`hi/hi-plan-space.ts`) | Converts |
| -------------------------------- | -------- |
| `wallOfRoot` | the wall a root module faces away from: turned like the wall's `facingRotationY`, its back within the strip of `WALL_STRIP_MM` (600 mm) |
| `freeStretchesAlongWall` | the stretches of a wall, measured from its end, where a root module stands clear of every blocker |
| `stripInFrontOfWall`, `pointAlongWall` | a span measured from the wall's end and a depth into the room (`intoRoom` — the wall's `facingRotationY` applied to `[0, 1]`) → floor points |
| `clearingOffsetMm` | a blocked span, measured from the wall's start → the `offsetMm` of the same `alignment` that clears it |

### 3.8 roomle-ui: group space ↔ room space

The two geometry modules convert between group space and room space with the same rotation formula:

| Function | File | Converts |
| -------- | ---- | -------- |
| `transformPointByRoot` | `hi-plan-context.ts`, `hi-plan-space.ts` | a local point by a root's (or a group's) `articlePos`/`pos` and `rotationY` |
| `transformPointByMatrix` | `hi-plan-context.ts`, `hi-plan-space.ts` | a part box corner by its column-major `fullMatrix` |
| `groupPointToRoot` | `hi-plan-space.ts` | group space → root space (the inverse of `transformPointByRoot`) |
| `groupPointToRoom`, `footprintCornersInRoom`, `rootFootprintInRoom` | `hi-plan-space.ts` | group-space floor points → room floor points |
| `rootVolumesInRoom` | `hi-plan-space.ts` | every non-generated root as a box in the room with its height range and rotation |
| `rotatedAboutY` | `hi-group-placement.ts` | a point turned about `y` |
| `rotateDirection` | `hi-plan-space.ts` | a floor direction `[x, z]` turned about `y` |

The footprint exists twice: `groupFootprint` of `hi-plan-context.ts` for the plan context and of
`hi-plan-space.ts` for the placement. Both read parts, docking points and size attributes in the same
order.

### 3.9 roomle-ui: docking offsets

`dockTo.offset` and the offsets of the relations' docking entries are group-space translations: the
arrangement premultiplies the docked root's transformation by the offset
(`hi/hi-root-module-arrangement.ts`, "the offset is a group-space translation"), and
`mirrorDockOffset` negates it for the reciprocal entry on the partner root. The hang gap of an
article above a floor unit is written into the offset's `y` (`hi/hi-tool-docking.ts` for
`merge-article-into-group`, `relationsToDocking` in `hi/hi-group-layout.ts` for `above`).

### 3.10 roomle-ui: interior fittings

`interiorFittings` (`hi/hi-interior-design.ts`) reports a fitting's `position` as the lowest corner
of its parts' boxes in root space (`partsStart`; `groupPointToRoot` turns group-space part matrices
into root space), minus the parent module's `positionRelativeToRoot` (the root itself: 0), else its
module's `positionRelativeToRoot` minus the parent's. An add with `insertPosition` hands the point to
the library (`addSubArticle`); because the library reads the insertion point in a frame of its own,
the tool command measures where the fitting landed and adds once more at `2 · requested − measured`.

### 3.11 Rounding

The plan context and the placements round coordinates to 0.01 mm (`round2`, `+ 0` turns `−0` into
`0`). The undo record compares groups rounded to 0.1 mm (`roundedToTenthMm` in
`hi-mcp/tool-executors.ts`).

### 3.12 Keep in step

- **The served text and the conversions** — the rotation sense, the wall `end` rule, the side labels
  and the corner rotations are written into `AUTHORING_RULES` and the tool descriptions
  (`hi-mcp/hi-mcp-server.ts`) and into [hi-mcp-behaviour.md](../../docs/hi-mcp-behaviour.md); change them
  together with `deriveWalls`, `placeAgainstWall`, `placeCornerAtWalls` and `roomCorners`.
- **The sign of `z`** — `[x, level, −y]` is applied in three places in roomle-ui
  (`convertContourSegment`, `shapeObstacles`, `_gatherInstallationElements`); the kernel applies the
  same mapping with `ModuleGroupCoordinateConverter`.
- **The placement frame** — a result that carries groups and does not pass through
  `inPlacementFrame` shows the raw group origin, which the agent cannot use as a placement.
