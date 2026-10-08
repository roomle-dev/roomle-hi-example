# HI Authoring Rules Skill

**Load this skill when the task involves:** HI group authoring, docking patterns, article selection, positioning new groups with a placement, group creation, or understanding how to properly structure HI object groups.

## Core Principle

**Never author root positions.** Roots are positioned by their relation — each unit names its neighbour, and the server builds the docking; a new group is positioned by its `placement` — a wall with an alignment, or one point and one rotation.

**Words.** The catalog offers articles; a group is one piece of furniture made of articles (a kitchen, a wardrobe, a sideboard, a utility room); an article placed in a group is a root module. A high or tall cabinet or a wardrobe is about 2000 mm high, a low cabinet or base cabinet 720 mm. The user decides which articles stand next to each other; an article named by its kind comes from the category of its neighbours where that category has one.

**One piece of furniture is one group.** Every article standing beside, above or back to back with another article is a related root module of the same group; the group carries one placement. Never split one piece of furniture into several positioned groups.

**Fronts.** The front program says how a front is built — its desc: simple fronts, frame fronts with wooden filling, mitred frame fronts with glass filling, milled fronts. Choose it by its desc first, then the front colour. A program offers only some colours: a colour it does not offer switches the program, and a program resets a colour it does not offer; `corrections` name every such change. When the colour the user wants comes only with fronts built differently, keep the fronts: undo, take the closest colour the program offers, and tell the user which fronts the wanted colour comes with ([D59, D60](../../docs/hi-mcp-behaviour.md#3-decisions)).

Direct coordinate properties — `pos`/`rotationY` on a group, `articlePos`/`rotationY` on a root — are **ignored**: the server drops them and reports it in `corrections`.

## Group Structure

### Group
```javascript
{
  id: string,              // Unique identifier
  libraryId: string,       // Optional library identifier
  placement: object,       // { wall, alignment?, offsetMm?, roomIndex? } or { posGroup, posRotationY, rootId? } - positions a new group
  roots: Root[]            // Required: array of root modules
}
```

### Root Module
```javascript
{
  id: string,              // Unique within group
  articleId: string,       // From catalog (required)
  attributes: Attribute[],  // Optional: overrides of that root module; a material for the whole group goes into the group's attributes
  // one relation to a root of the same group (every root after the first):
  rightOf | leftOf | onTop | above | behind: string,
  align: 'left' | 'right' | 'back',  // Optional, onTop and above
  gapMm: number           // Optional, onTop and above
}
```

## Article Catalog

Access via `get-plan-context` (a default section, or `include: ['articles']`):

```javascript
{
  articles: [
    {
      articleId: string,
      articleName: string,
      desc: string,
      category: string,           // the library's path, e.g. 'Kitchen | Base Units | Corner'
      libraryId: string,
      catalog: string,
      cornerArticle: boolean,     // true for an article made for a room corner
      rootModules: [{
        module: { id, name, desc },
        dimensions: [{ id, name, value }],      // size attributes in millimetres (Width, Depth, Height)
        mainAttributes: [{ id, name, value }],
        dockingVectors: string[],               // docking vector names
        subModules: [{ id, name, desc }]
      }]
    }
  ]
}
```

On an empty plan the catalog can list an article without docking vectors and without size — the
range hood `DU`, whose template has none: that means unknown, not undockable. The server docks such
an article like any other (G7).

## Relations

Every root after the first names one neighbour of the same group by its id, with exactly one
relation; the server compiles the docking (`contextData`) from it
([behaviour reference D34](../../docs/hi-mcp-behaviour.md#3-decisions)):

| Relation | Meaning | Docking the server builds |
|---|---|---|
| `rightOf` / `leftOf` | right / left of that unit, as seen from the front | `RightBottom → LeftBottom` / `LeftBottom → RightBottom`; a wall unit beside a tall unit: `RightTop → LeftTop` / `LeftTop → RightTop`, tops flush |
| `onTop` | stands on that unit — a tall unit or a wall unit, any depth; `align` `left` (default), `right`, `back`; `gapMm` lifts it. On a kitchen base unit a wall unit hangs `above` it and a floor unit continues the row, reported | `LeftTop → LeftBottom`, `RightTop → RightBottom`, `BackTop → BackBottom` |
| `above` | a wall unit hanging above that floor unit; `gapMm` sets the gap | `LeftTop → LeftBottom` with the gap that puts its top at the top of the tall units (D35: tall − wall − base `mod_Height`, Furniture_Smith 660) |
| `behind` | back to back, turned by 180° (an island) | `BackBottom → BackBottom` |

- Wall units and the range hood continue `rightOf` / `leftOf` each other; a hood without wall units
  hangs `above` the hob unit. A hood beside a tall unit is hung `above` the floor unit on that side,
  and a floor unit beside a wall unit continues the floor row (corrections G40, G41).
- A corner kitchen starts with a corner article and continues one row `rightOf` it and the other
  `leftOf` it; the wall units of each leg hang `above` the floor units of that leg, never on or
  above the corner article. A wall unit beside a tall unit goes on the side of the base units
  (correction G51).
- A root without a relation continues the row of its kind (floor units, wall units); the first
  wall unit hangs beside a tall unit, else above a floor unit. `corrections` reports it.
- The server writes each entry on the root the planner reaches first, so an offset takes effect,
  and it never uses the vertical docking vectors.

## Docking System

The relations compile to these docking vectors. Groups from `get-plan-context` show them as
`contextData`, `merge-article-into-group` names them in `dockTo`, and a payload may still carry
`contextData`.

### Vector Types

- **Side vectors** (Left/Right): Run back to front, start=back, end=front
- **Back vectors** (BackBottom/BackTop): Run left to right, start=left, end=right
- **Top/Bottom vectors**: Run left to right, start=left, end=right
- **Corner vectors** (LeftBack/RightBack): Only on corner articles, start at corner point

### Valid Docking Pairs

| Direction | Anchor Vector | New Root Vector | Mode | Offset Y |
|---|---|---|---|---|
| Right | RightBottom | LeftBottom | StartStart | 0 |
| Left | LeftBottom | RightBottom | StartStart | 0 |
| Above | LeftTop/RightTop/BackTop | LeftBottom/RightBottom/BackBottom | StartStart | the gap below a wall unit (660 in Furniture_Smith) |
| Wall unit beside a tall unit | RightTop / LeftTop of the tall unit | LeftTop / RightTop | StartStart | 0 — tops flush |
| Behind | BackBottom | BackBottom | (none) | 0 |
| Range hood in a gap between wall units | RightBottom of the wall unit left of the gap | LeftBottom of the hood | StartStart | 0 |

### Mode Options

- `StartStart` (default): Start points coincide
- `EndEnd`: End points coincide
- `StartEnd`, `EndStart`: Mixed alignments

### Offset [x, y, z]

Millimeters added after docking:
- x: left/right (positive = right)
- y: vertical (positive = up)
- z: front/back (positive = forward)

### Context Data Structure

```javascript
{
  id: "anchor-root",
  contextData: {
    dockedRoots: [
      {
        ownDockingVector: "RightBottom",
        dockedRoots: [
          { id: "new-root", dockingVector: "LeftBottom", mode: "StartStart", offset: [0, 0, 0] }
        ]
      }
    ]
  }
}
```

## Docking Rules

1. The first root starts the docking; the root that carries the placement is found by the server (the left end of the floor row, or the corner article)
2. Every root connected to the first root through the docking, directly or through a chain (entries count in either direction)
3. Chain docking allowed (A → B → C)
4. Multiple dockings per anchor allowed
5. Vector compatibility required
6. No circular docking

## Positioning a group

A new group is positioned in the call that creates it, in one of two forms (D23):

```javascript
// at a wall or in a room corner - the server computes the point
placement: {
  wall: 'left' | 'right' | 'back' | 'front' | number, // side label or wall index
  alignment: string,     // optional - 'center' (default), the side label of the adjoining wall, 'end'
  offsetMm: number,      // optional - from that corner or from the wall's end
  roomIndex: number      // optional - 0 by default
}
// anywhere else, and for a group of wall units only
placement: {
  posGroup: [x, y, z],   // the group's back left bottom corner in the room, mm (y = 0 on the floor)
  posRotationY: number,  // degrees, counter-clockwise as seen from above
  rootId: string         // optional - only with two corner articles, see below
}
```

- **By wall**: the parameters and defaults of `place-group` ([Moving a group](#moving-a-group)).
  The side label of the adjoining wall puts the group flush into the corner the two walls share
  (`wall: 'back'`, `alignment: 'right'` is the back right corner) and a corner article into the
  corner; `end` with `offsetMm` measures from the wall's end, as `fromEndMm` of the obstacles does.
  The server loads the group, computes the target from the calculated group, moves a target that
  overlaps another group along the wall, and reloads the group there.

- **Point** (the second form): `posGroup` is the room point of the group's back left bottom corner; for a group of
  wall units only, its y is their mounting height. In a room corner it is the corner point. It
  holds for every article: the server places the anchor by the back left bottom corner of its
  docking vectors, also where its origin lies elsewhere (the centre of a range hood, the arm of a
  corner article). A returned group's `position.pos` and `rotationY` are read the same way; with two
  corner articles, `position.rootId` names the one `pos` belongs to.
- **Rotation sense**: positive `posRotationY` turns the group counter-clockwise as seen from above
  (in the top-view image) — the `rotationY` convention of the kernel (RoomleCore) and the glue logic
  ([rotation sense](./roomle-hi-concepts.md#rotation-sense)). The right wall is **270**, the left
  wall **90**.
- **Against a wall** with a point: `posRotationY` = the wall's `facingRotationY`; the group's back
  stands against the wall and the group runs from `posGroup` towards the wall's `start`. A group at
  a wall takes the placement by wall, so that the server computes the point.
- **Corner**: a corner kitchen starts with a corner article and names one wall of the corner as
  `wall` and the other as `alignment`; looking into the corner from the room, the units `rightOf`
  the corner article run along the wall on the right. With a point: the `point` and `posRotationY`
  of the corner in the room's `corners` list of `get-plan-context` (the `facingRotationY` of the
  wall that ends in that corner). For a right-handed corner
  article (`mod_CarcaseDirection` Right) the server adds 90° itself; the group is read back with
  the `posRotationY` it was placed with.

| Rectangular room (back = top in the top view) | `posRotationY` | Corner: the units `rightOf` the corner article run along | Corner: the units `leftOf` it run along |
|---|---|---|---|
| Back wall / left back corner | 0 | back wall, to the right | left wall, to the front |
| Left wall / left front corner | 90 | left wall, to the back | front wall, to the right |
| Front wall / right front corner | 180 | front wall, to the left | right wall, to the back |
| Right wall / right back corner | 270 | right wall, to the front | back wall, to the left |

- **Two corner articles** (a U-shaped kitchen): by wall, the first corner article in `roots` goes
  into the corner; with a point, `rootId` names the corner article that goes into the corner
  `posGroup` names.
- **Anywhere else** (island, middle of the room, next to a door): any floor point `obstacles` leaves
  free, any rotation.
- **Outside the room** is allowed: the server never refuses, moves or warns about a group placed
  outside the room — the user may ask for one ([D22](../../docs/hi-mcp-behaviour.md#3-decisions)).
- **Obstacles**: the `obstacles` section of `get-plan-context` lists what stands in the room — doors,
  windows and other objects with `kind`, `outline` and `bottomMm`/`topMm`, and per group the outlines
  of its root modules. A door or a window lies in a wall (`roomIndex`, `wall`, `fromEndMm` — its
  span from the wall's end). Put a new group on a stretch of wall or a spot that `obstacles` leaves
  free: a placement with that wall, alignment `end` and `offsetMm` = the start of a free stretch
  puts a group on it; base units lower than a window's `bottomMm` fit below it. The result's `hint`
  names every root module that overlaps an object or another group or stands in front of a door or
  a window, with the free stretches of its wall; the group is built anyway
  ([D55](../../docs/hi-mcp-behaviour.md#3-decisions)).
- **New groups only**: the placement is applied once, when the group is created. A placement on a
  group already in the plan is not used — the group keeps its position, and `corrections` says so;
  a group resubmitted without placement keeps its position.

### Moving a group

An existing group is moved with `place-group`, not with a placement: the wall by side label or
index, `alignment` `start`, `center` (default) or `end` along it, or the side label of the
adjoining wall to sit flush in that corner (`wall: 'right'`, `alignment: 'top'` is the back right
corner), and `offsetMm` along the wall. The server computes the position from the group's
calculated footprint; a group with a corner article goes into the corner the alignment names. The
roots and their docking stay as they are, and the group keeps its height. Groups may touch. A
target that overlaps another group (footprint and height range) is moved along the same wall to the
nearest free position; into a corner, or without a free position, the group is placed as asked.
`corrections` reports either — units that belong together are joined with `merge-groups` or docked
into one group.

### Editing a group

An existing group is edited with the command tools, never by positioning new units:
`merge-article-into-group` docks one more unit at a free end of a row with the docking pairs above
(`dockTo: { rootId, ownDockingVector, dockingVector, mode?, offset? }`, `ownDockingVector` one of
the root's `freeDockingVectors`), `insert-article-into-group` inserts a unit between two
neighbouring units (`between`), `delete-article-and-compact` deletes a unit and closes the gap,
`delete-article-in-place` deletes a unit and leaves the gap (units no longer docked together become
separate groups where they stand), `exchange-root-module` replaces a unit and keeps its docking —
with `attributes` also by one of another width —, `swap-root-modules` lets two units change places,
`delete-group` deletes a group, `change-module-attribute` and `change-group-attribute` set
attributes, and `merge-groups` joins groups where they stand, without moving them or adding
docking. In a row edit the end of the row at a wall or in a corner keeps its place and the other end
moves; wall units and the range hood move with the unit they hang from, and the result's `hint`
names them, and says when the row now reaches past a wall or into another group. Resubmitting the group with
`create-or-replace-groups` is for a rebuild, e.g. several new units at once — see
[hi-mcp-tools.md](./hi-mcp-tools.md#the-command-tools).

## Validation Rules

The server corrects what it can and builds every group it can; only a call in which no group can be
built is an error. Every guard and correction:
[hi-mcp-behaviour.md §8](../../docs/hi-mcp-behaviour.md#8-guards-corrections-and-feedback).

### Corrected and reported in `corrections` (the group is loaded):
- A root without a relation (in a group with relations) — put into the row of its kind; a relation to an unknown root or to itself, or one that closes a ring — ignored or dropped
- A floor unit `above` a unit — put `rightOf` it; a wall unit `rightOf` / `leftOf` a base unit — hung `above` it; `behind` a corner article — ignored
- `gapMm` beside a unit, an unknown `align`, a second relation field — ignored
- `pos`/`rotationY` on a group, `articlePos`/`rotationY` on a root — dropped
- `repositioningData` on a group — taken as the placement
- `placement`: fields of neither form dropped; by wall: a point beside the wall dropped, an `alignment`, `offsetMm` or `roomIndex` it cannot read taken as its default, a wall it cannot read or the room does not have not used, a target that overlaps another group moved along the wall; by point: `posGroup` `[x, z]` completed to `[x, 0, z]`, a `rootId` that names no root dropped; a placement the server cannot use (`posGroup` not a point, no numeric `posRotationY`) and a placement on a group that is already in the plan are not used — the planner positions the group, an existing group keeps its position
- A root without `id` gets `root-1`, `root-2`, …; a duplicate root id no docking entry names is renamed (`u1` → `u1-2`)
- Roots the docking does not connect to the first root — docked to the free end of a row of their kind (floor units or wall units), `mode` `StartStart`, `offset` `[0, 0, 0]`
- Two roots on one side docking vector (`LeftBottom`, `RightBottom`) at the same place — the later one is docked to the free end of that row, or of its leg when the row ends at a corner article; Top vectors and `BackBottom` may carry several
- An `articleId` in another spelling (case, whitespace) — read in the catalog's spelling
- A placed group whose anchor the server cannot calculate beforehand — placed by the unit's origin; `place-group` puts it against a wall or into a corner

### Not built, reported in `notLoaded` (the other groups of the call load):
- A group without roots, or with generated roots only
- A root without `articleId`, or an `articleId` the catalog does not have
- A duplicate root id that a docking entry names
- Roots the server cannot dock: no free row end, a wall unit without a wall-unit row to continue

### Returned as a hint (the group is loaded):
- A group of the call that is still unpositioned — it sits at the plan origin; a group gets its position from the placement it is created with, or `place-group` moves it against a wall or into a corner
- A root module that overlaps an object or a root module of another group, or stands in front of a door or a window — named with the free stretches of its wall; units that belong together are sent as one group or joined with `merge-groups`

## Practical Patterns

### Pattern 1: Simple Row
```javascript
{
  // centred on the left wall - center is the default alignment
  placement: { wall: 'left' },
  roots: [
    { id: 'u1', articleId: 'base-unit-600' },
    { id: 'u2', articleId: 'base-unit-600', rightOf: 'u1' }
  ]
}
```

### Pattern 2: L-Shaped Corner
```javascript
{
  // the left back corner: one wall of the corner as wall, the other as alignment
  placement: { wall: 'back', alignment: 'left' },
  roots: [
    { id: 'corner', articleId: 'corner-unit-900' },
    { id: 'u1', articleId: 'base-unit-600', leftOf: 'corner' },
    { id: 'u2', articleId: 'base-unit-600', rightOf: 'corner' }
  ]
}
```

### Pattern 3: Wall Units Beside a Tall Unit and Above a Base Unit
```javascript
{
  // centred on the left wall
  placement: { wall: 'left' },
  roots: [
    { id: 'tall', articleId: 'tall-unit-600' },
    { id: 'base', articleId: 'base-unit-600', rightOf: 'tall' },
    { id: 'wall1', articleId: 'wall-unit-600', rightOf: 'tall' },  // tops flush with the tall unit
    // without a tall unit: { id: 'wall1', articleId: 'wall-unit-600', above: 'base' }
    { id: 'top', articleId: 'top-unit-600', onTop: 'tall' }       // stacking
  ]
}
```

## Common Mistakes

1. **Direct coordinates**: Never use `articlePos`, `rotationY`, `pos`, `rotationY`
2. **Roots without a relation**: Every root after the first names its neighbour; a root without a relation continues the row of its kind, which may not be where you meant it
3. **Docking vectors in a new group**: Name the neighbour with a relation instead of writing `contextData`
4. **Docking to non-existent root**: An entry naming an id outside the group connects nothing; a root docked only that way is treated as unconnected — docked to the free end of a row (reported in `corrections`), or the group is not built when that is impossible (`notLoaded`)
5. **Circular docking**: A root cannot dock to itself directly or indirectly

## Workflow

1. Get context: `get-plan-context()` — the default sections rooms, articles, groups, obstacles
2. Review rooms, articles, existing groups and what stands in the room
3. Create the group with proper docking and a placement
4. Submit: `create-or-replace-groups({ posGroups: [group] })`
5. Verify with `get-plan-context` or `get-plan-images`

## Using Free Docking Vectors

When extending existing groups, check `freeDockingVectors` from `get-plan-context`:

```javascript
const group = context.groups.find(g => g.id === 'target');
const anchorRoot = group.roots.find(r => 
  r.freeDockingVectors?.some(v => v.name === 'RightBottom')
);
```

## Best Practices

1. Always use valid article IDs from catalog
2. Use proper docking chains
3. Prefer corner articles for corners
4. Validate before submitting
5. Check free vectors when extending groups
