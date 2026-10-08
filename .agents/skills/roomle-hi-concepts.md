# Roomle HI Concepts

> Core HOMAG Intelligence (HI) concepts for the roomle-hi-example repository. This skill provides foundational knowledge about the HI data model, relationships, and architecture patterns.

## When to Load This Skill

Load this skill when working with:
- HI data structures (rooms, walls, articles, groups, obstacles)
- Docking vectors and docking relationships
- Positioning new groups with a `placement`
- Article catalog and module selection
- HI-specific parameters and attributes

**Do NOT load** for general Roomle planner concepts not specific to HI, or for MCP server implementation details (use `hi-mcp-server.md` instead).

---

## Overview

HOMAG Intelligence (HI) is Roomle's system for configuring, pricing and ordering furniture built
from the articles of a library — kitchens, wardrobes, sideboards, utility rooms. It extends the
Roomle planner with domain-specific concepts. The data below is what `get-plan-context` returns;
the complete field list is §5.4 of
[hi-mcp-behaviour.md](../../docs/hi-mcp-behaviour.md#54-the-plan-context-get-plan-context).

One coordinate system throughout: 3D, right-handed, Y up, millimetres. A floor point is
`[x, 0, z]`; the back of a rectangular room (`top` in the top-view image) lies at the smallest z.

## Core Entities

### 1. Rooms

`rooms: { rooms: [{ levels, walls, corners }] }` — per room the contour per level, the walls
derived from it, and the room corners.

**Wall properties:**
- `index` — position in the room's `walls` array
- `side` — `left`, `right`, `top`, `bottom` as seen in the top-view image (back = top, front = bottom)
- `name` — back wall, front wall, left wall, right wall
- `start`, `end` — floor points `[x, 0, z]`; the contour runs counter-clockwise, the interior on the left
- `lengthMm`, `heightMm`, `thicknessMm`
- `type` — `wall`, or `opening` for a door
- `facingRotationY` — the rotation of a group standing with its back against that wall

**Corner properties:** `name` (back left, back right, front left, front right), `point`, and
`posRotationY` — the rotation of a corner kitchen in that corner, the `facingRotationY` of the
wall that ends there.

**Example** (a 4000 × 3000 mm room):
```javascript
{
  walls: [
    { index: 0, side: "bottom", name: "front wall", start: [0, 0, 0], end: [4000, 0, 0], lengthMm: 4000, type: "wall", facingRotationY: 180 },
    { index: 1, side: "right", name: "right wall", start: [4000, 0, 0], end: [4000, 0, -3000], lengthMm: 3000, type: "wall", facingRotationY: 270 },
    { index: 2, side: "top", name: "back wall", start: [4000, 0, -3000], end: [0, 0, -3000], lengthMm: 4000, type: "wall", facingRotationY: 0 },
    { index: 3, side: "left", name: "left wall", start: [0, 0, -3000], end: [0, 0, 0], lengthMm: 3000, type: "wall", facingRotationY: 90 }
  ],
  corners: [
    { name: "front right", point: [4000, 0, 0], posRotationY: 180 },
    { name: "back right", point: [4000, 0, -3000], posRotationY: 270 },
    { name: "back left", point: [0, 0, -3000], posRotationY: 0 },
    { name: "front left", point: [0, 0, 0], posRotationY: 90 }
  ]
}
```

### 2. Articles

An **article** is a catalog entry of a library: a cabinet, a wardrobe, an appliance, a panel. It
consists of one or more root modules; placed in a group, each becomes a root.

**Properties:**
- `articleId`, `articleName`, `desc` — `desc` is authoritative for what the article is
- `category` — the library's path, e.g. `Kitchen | Base Units | Corner`, `Kitchen | Wall Units | Storage`, `Living | Sideboard`
- `libraryId`, `catalog`
- `cornerArticle` — true for an article made for a room corner
- `rootModules` — per root module: `module` (id, name, desc), `dimensions` (the size attributes with id, name and value in mm), `mainAttributes`, `dockingVectors` (names), `subModules` (fronts, appliances)

The catalog carries docking vector names, no coordinates. On an empty plan an article whose
template has no docking data (the range hood `DU`) lists no docking vectors and no size: unknown,
not undockable. Field reference: [hi-authoring-rules.md](./hi-authoring-rules.md#article-catalog).

### 3. Groups

A **group** is one piece of furniture: root modules (article picks) related to each other by
docking — a kitchen, a wardrobe, a row of cabinets. Every article standing beside, above or back
to back with another one is a root of the same group.

**As `get-plan-context` returns it** (a valid `create-or-replace-groups` payload as it is):
- `id`, `libraryId`, `attributes` — group settings and a material for the whole group
- `position` — read-only: `pos` (the room point of its back left bottom corner), `rotationY`, `footprint`
- `roots` — per root its `id`, `articleId`, input `attributes`, `contextData` (the docking, vector names only), and read-only facts: `articleName`, `desc`, `category`, `isGenerated` (worktop, toe kick — the library generates them), `dockingVectors`, `freeDockingVectors`, `subModules`. No root positions

**As a new group is authored:**
```javascript
{
  libraryId: "<libraryId>",
  placement: { wall: "right", alignment: "back" }, // the right wall, flush into its corner with the back wall
  roots: [
    { id: "u1", articleId: "<base unit>" },
    { id: "u2", articleId: "<base unit>", rightOf: "u1" },
    { id: "w1", articleId: "<wall unit>", above: "u1" }
  ]
}
```

Every root after the first names one neighbour with one relation — `rightOf`, `leftOf`, `onTop`,
`above`, `behind` — and the server builds the docking from it
([hi-authoring-rules.md](./hi-authoring-rules.md#relations)).

**Placement properties**, at a wall or in a room corner:
- `wall` — a side label (`left`, `right`, `back`, `front`) or a wall index
- `alignment` — optional: `center` (default), the side label of the adjoining wall (flush into that corner), or `end`
- `offsetMm` — optional: the distance from that corner or from the wall's end
- `roomIndex` — optional, 0 by default

Anywhere else, and for a group of wall units only:
- `posGroup` — [x, y, z] in millimetres: the room point of the group's back left bottom corner
- `posRotationY` — rotation of the group in degrees, counter-clockwise as seen from above
- `rootId` — optional, only with two corner articles: the one that goes into the corner `posGroup` names

### 4. Docking System

The **docking** relates the roots of a group; the planner derives every root position from it.

- **Docking vector**: a contact edge of a root module, a line with a start and an end in root-local
  coordinates, named by side: `LeftBottom`, `RightBottom`, `LeftTop`, `RightTop`, `BackBottom`,
  `BackTop`; a corner article also has `LeftBackBottom`/`RightBackBottom` (and `…Top`), starting at
  its corner point. Side vectors run back to front, back and top/bottom vectors left to right.
- **Docking entry**: on a root, its `ownDockingVector` and the `dockingVector` of each root it names
  (`contextData.dockedRoots`). `RightBottom → LeftBottom` puts that root to the right,
  `LeftBottom → RightBottom` to the left, a Top vector → a Bottom vector on top,
  `BackBottom → BackBottom` back to back.
- **Mode**: `StartStart` (default), `EndEnd`, `StartEnd`, `EndStart` — which ends of the two vectors meet.
- **Offset**: `[x, y, z]` in millimetres, added after docking (y lifts a wall unit above a floor unit).
- **Free docking vector**: a vector without a partner — where a new root can dock (`freeDockingVectors`).

**Arrangement** (roomle-ui `hi-root-module-arrangement.ts`): the planner puts the first root at the
group origin and places every other root breadth-first along the docking; a root docked to a
corner article's `LeftBottom` is turned by 90°.

**Origin and docking corner**: a root's origin is usually the back left bottom corner of its docking
vectors, but not always — a range hood is centred on its origin, the corner point of a corner
article lies off its origin, and a right-handed corner article (`mod_CarcaseDirection` Right) is
turned. The server places and reports every group by the docking corner
([hi-mcp-server.md §5](./hi-mcp-server.md#5-group-placement-internal)).

### 5. Positioning

A new group is positioned in the call that creates it: at a wall or in a room corner by
`placement: { wall, alignment?, offsetMm?, roomIndex? }` — the server computes the point from the
calculated group, as `place-group` does —, anywhere else by `placement: { posGroup, posRotationY,
rootId? }`, one point and one rotation.

- `posGroup` is the room point of the group's back left bottom corner; in a room corner it is the
  corner point.
- One piece of furniture is one group: every further article is a root module of the same group, never a
  separately positioned group. Each article after the first names its neighbour with one relation (`rightOf`,
  `leftOf`, `onTop`, `above`, `behind`), and the server builds the docking from it — see
  [hi-authoring-rules.md](./hi-authoring-rules.md#relations).
- `posRotationY` is in degrees, counter-clockwise as seen from above. Against a wall it is the
  wall's `facingRotationY` (rectangular room: back 0, left 90, front 180, right 270), and the
  group runs from `posGroup` towards the wall's `start`; a group at a wall takes the placement by
  wall instead.
- Free space comes from the `obstacles` section of `get-plan-context`: doors, windows and other
  objects as outlines with a height range, and the root module outlines of every group. A door or a
  window names the wall it lies in and its span from the wall's end — see
  [hi-authoring-rules.md](./hi-authoring-rules.md#positioning-a-group). The result's `hint` names a
  root module that stands on an obstacle or in front of a door or a window, with the free stretches
  of its wall; the group is built anyway.
- It is applied once, when the group is created. A placement on a group that is already in the
  plan is not used — the group keeps its position, and `corrections` says so; a group resubmitted
  without placement keeps its position.
- A group outside the room is allowed — the user may ask for one.
- An existing group is moved with `place-group`: a wall by side label or index, an alignment along
  it (the side label of the adjoining wall puts it flush into that corner, a corner article into
  the corner) and an offset; the server computes the position from the calculated group — see
  [hi-mcp-tools.md](./hi-mcp-tools.md#place-group).
- An existing group is edited with the command tools: a unit is added (docked to a free docking
  vector), inserted, replaced, swapped or removed, attributes are changed, and groups are joined —
  see [hi-mcp-tools.md](./hi-mcp-tools.md#the-command-tools).

The wall and corner rules are in [hi-authoring-rules.md](./hi-authoring-rules.md#positioning-a-group).
RoomleCore ADR 0011 ("a numeric placement never rotates the object") concerns the planner's
interactive numeric placement, not the `placement` of a new group: `posRotationY` does rotate the
group.

### Rotation sense

`rotationY` and `posRotationY` are **counter-clockwise as seen from above**, in HI space and in the
kernel alike: the right wall and the back right corner are 270, the left wall and the front left
corner 90. Clockwise values (right 90, left 270) would put every group at a side wall against the
opposite wall. Verified against RoomleCore:

- The deserializer passes the angle through unchanged (`setGroupRotation(toRadians(rotationY))`,
  `external-module-group-deserializer.cpp`), and the yaw is `atan2` of the direction vector.
- HI space (Y up) becomes kernel space (Z up) by `(x, y, z) → (x, −z, y)`, a +90° rotation about X
  with determinant +1 (`module-group-coordinate-converter.h`): a proper rotation, no mirroring. A
  right-handed rotation about the kernel's up axis is therefore a right-handed rotation about HI +Y.
- The golden Furniture_Smith L-shape (`test/data/golden/plans/furniture-smith-l-shape/`) has
  `rotationY` 270: its main row runs along local +x, which at 270 is room +z, down the right wall;
  the kernel's top view shows the L in the back right corner.

roomle-ui states the same (`packages/embedding-lib/docs/pos-group-data-model.md`: positive is
counter-clockwise from above, right-hand rule).

## HI-Specific Concepts

### Attribute Groups

The library's attributes come with the master data (`get-plan-context` with `masterData`, searched
by `find-attributes`). Each attribute has an `id` (e.g. `mod_FrontColor`, `mod_Width`), a `name`,
a `desc`, a `type` (`Text`, `Bool`, `Dim`, `Integer`), a `group` and its `selections` (value, name
and desc). The master data's root modules name the attribute ids assigned to them; a size is an
attribute of type `Dim`.

**Attribute groups** of Furniture_Smith, for example: `Carcase | Dimensions`, `Carcase | Design`,
`Front | Design`, `FrontOpening | Handle`, `Hardware | Hinge`, `Countertop | Design`, `Toekick`.

An attribute is set on a root by its id (`attributes: [{ id, value }]`, `change-module-attribute`),
on a whole group in the group's `attributes` or with `change-group-attribute`.

### Article Parameters

Parameters are user-configurable properties of articles.

**Parameter Types:**
- `Range` — Numeric value with min/max/step
- `Enum` — Selection from predefined options
- `Boolean` — True/false toggle
- `Color` — RGB or named color value
- `Text` — String value

**Range Parameter Properties:**
- `min` — Minimum value
- `max` — Maximum value
- `step` — Increment step
- `unit` — Unit (mm, degrees, etc.)
- `imperialStep` — Step for imperial units (if applicable)

### Group Adjustment

Groups can be **adjusted to wall width**, which automatically:
1. Calculates the available wall space
2. Distributes root modules to fill the space
3. Respects minimum and maximum module sizes
4. Maintains docking relationships

**Adjustment Properties:**
- `wallLabel` — Wall to adjust against
- `leftOffset` — Distance from wall start
- `rightOffset` — Distance from wall end
- `gap` — Space between modules

## Data Flow

### From Plan to HI

```
Roomle Plan
    │
    ▼
Plan Context (get-plan-context)
    │
    ▼
├── Rooms (levels, walls, corners)
├── Articles (the catalog)
├── Groups (root modules + docking)
└── Obstacles (doors, windows, objects, the root module outlines of every group)
    │
    ▼
HI Configuration
```

### Group Creation Flow

```
1. Select Articles
   │
   ▼
2. Create Root Modules
   │
   ▼
3. Name each root's neighbour (relation)
   │
   ▼
4. Set the placement
   │
   ▼
5. create-or-replace-groups Tool
   │
   ▼
6. Roomle Planner Updates
   │
   ▼
7. Visual Feedback
```

### Price Calculation Flow

```
1. get-price Tool
   │
   ▼
2. The planner's price calculation (fetchPrice) over the plan
   │
   ▼
3. The planner's price result
```

## Important Rules and Constraints

### Authoring Rules

1. **Never Author Root Positions** — Roots are positioned by docking, a new group by its `placement`
2. **Roots Are Related** — Every root after the first names a neighbour of the same group; the server connects a root without one to the free end of the row of its kind and says so
3. **Valid Docking Pairs** — `RightBottom → LeftBottom`, `LeftBottom → RightBottom`, a Top vector → a Bottom vector, `BackBottom → BackBottom`
4. **Positions Come From the Walls** — A group at a wall or in a room corner names the wall and the alignment; the server computes the point
5. **Docking Vectors Must Exist** — A docking names vectors the article has

### Positioning Rules

1. **One Placement** — Every new group is positioned with a `placement`: by wall at a wall or in a room corner, by point anywhere else
2. **Against a Wall** — `wall` and `alignment` (the side label of the adjoining wall for a corner, `center`, or `end` with `offsetMm`); the server computes the point from the calculated group
3. **Docking Vectors Transform** — Vectors are transformed with root's position and rotation
4. **Extend, Don't Butt** — Units next to an existing group are docked into that group (one unit: `merge-article-into-group`); groups may touch and overlap when created, and `place-group` moves a target that overlaps another group along the wall to the nearest free position
5. **Moving** — An existing group is moved with `place-group`, never with a placement

### Docking Rules

1. **Partner Vectors** — Left docks to right, a Top vector to a Bottom vector, back to back
2. **Docking Mode** — Which ends of the two vectors meet (`StartStart`, `EndEnd`, `StartEnd`, `EndStart`)
3. **Docking Offset** — Applied after the docking
4. **Free Vectors** — Indicate where new modules can be added

## Common Patterns

### Creating a Simple Cabinet Group

```javascript
// Step 1: Pick articles from the catalog of get-plan-context
const context = await callTool("get-plan-context", {});
const baseUnit = context.articles.find(a => a.category?.includes("Base Units"));

// Step 2: The group - every root after the first names its neighbour
const group = {
  libraryId: baseUnit.libraryId,
  roots: [
    { id: "u1", articleId: baseUnit.articleId },
    { id: "u2", articleId: baseUnit.articleId, rightOf: "u1" }
  ],
  placement: { wall: "front", alignment: "left" } // flush into the front left corner
};

// Step 3: Send to Roomle via create-or-replace-groups
await callTool("create-or-replace-groups", { posGroups: [group] });
```

### Querying Plan State

```javascript
// Get complete plan context
const context = await callTool("get-plan-context", {});

// Extract rooms
const rooms = context.rooms;

// Find a specific wall
const frontWall = rooms.rooms[0].walls.find(w => w.side === "bottom"); // front = bottom in the top view

// Get all groups
const groups = context.groups;

// Get articles from catalog
const articles = context.articles;
```

### Centring a Group on a Wall

```javascript
// centred is the default alignment; the server computes the point from the calculated group
const group = {
  roots: [
    { id: "u1", articleId: "<base unit 600>" },
    { id: "u2", articleId: "<base unit 600>", rightOf: "u1" }
  ],
  placement: { wall: "front" }
};
```

## Error Handling

The server corrects what it can and builds every group it can
([hi-mcp-behaviour.md §8](../../docs/hi-mcp-behaviour.md#8-guards-corrections-and-feedback)):

1. **`corrections`** — what the server changed in the input and applied: a placement it cannot use
   (`posGroup` not a point, no numeric `posRotationY`) or one on a group already in the plan is not
   used, a `rootId` that names no root is dropped, `repositioningData` is taken as the placement,
   a `place-group` target that overlaps another group is moved along the wall; and what the planner
   or the library changed beyond what was sent — a docking the planner dropped, a front program the
   library switched with a front colour (D59)
2. **`notLoaded`** — the groups or roots that could not be built, with what to send instead: an
   `articleId` the catalog does not have, a root the server cannot dock
3. **Error result** — only when nothing in the call can be built, or a tool cannot act (an unknown
   group id, a wall that does not exist)

### Error Response Format

A call in which no group can be built comes back as a tool error result whose text lists every problem:

```text
Invalid pos groups - nothing was loaded:
posGroups[0]: needs a non-empty roots array
Fetch the payload format with the get-authoring-rules tool.
```

## Best Practices

### Group Design

1. **One Group per Piece of Furniture** — Relate every unit to its neighbour in the same group
2. **Corner Articles for Corners** — A corner kitchen starts with a corner article
3. **Read the Catalog** — `desc`, `category` and `dimensions` say what an article is and how big
4. **Position by Wall** — Name the wall and the alignment of a group at a wall or in a room corner; a point only anywhere else
5. **Verify Numerically** — Check the returned `position` and `corrections`

### Performance

1. **Batch Operations** — Use `create-or-replace-groups` for multiple groups
2. **Minimize Queries** — Cache plan context when possible
3. **Validate Early** — Check docking and the placement before creating groups
4. **Use Timeouts** — Planner calls time out after 30 s, loads, commands and snapshots after 120 s

### Debugging

1. **Inspect Plan Context** — Use `get-plan-context` to see current state
2. **Check Docking Vectors** — Verify the vectors exist (`dockingVectors`, `freeDockingVectors`)
3. **Check the Walls** — Take `start`/`end`/`facingRotationY` from the room's `walls` array
4. **Test Incrementally** — Create groups one at a time to isolate issues

## Related Skills

- **[hi-mcp-server.md](./hi-mcp-server.md)** — MCP server architecture and implementation
- **[hi-authoring-rules.md](./hi-authoring-rules.md)** — Detailed HI authoring patterns and rules
- **[hi-mcp-tools.md](./hi-mcp-tools.md)** — Complete MCP tool reference with examples

## References

- [AGENTS.md](../../AGENTS.md) — AI assistant instructions
- [.agents/README.md](../README.md) — Digital brain index
- [docs/hi-mcp-server.md](../../docs/hi-mcp-server.md) — User-facing MCP documentation
