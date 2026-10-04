# HI Authoring Rules Skill

**Load this skill when the task involves:** HI group authoring, docking patterns, article selection, positioning new groups with a placement, group creation, or understanding how to properly structure HI object groups.

## Core Principle

**Never author root positions.** Roots are positioned by their relation — each unit names its neighbour, and the server builds the docking; a new group is positioned by its `placement` — one point and one rotation taken from the walls.

**One kitchen is one group.** Every unit standing beside, above or back to back with another unit is a related root of the same group; the group carries one placement. Never split a kitchen into several positioned groups.

Direct coordinate properties — `pos`/`rotationY` on a group, `articlePos`/`rotationY` on a root — are **ignored**: the server drops them and reports it in `corrections`.

## Group Structure

### Group
```javascript
{
  id: string,              // Unique identifier
  libraryId: string,       // Optional library identifier
  placement: object,       // { posGroup, posRotationY, rootId? } - positions a new group
  roots: Root[]            // Required: array of root modules
}
```

### Root Module
```javascript
{
  id: string,              // Unique within group
  articleId: string,       // From catalog (required)
  attributes: Attribute[],  // Optional: overrides of that unit; a material for the whole kitchen goes into the group's attributes
  // one relation to a root of the same group (every root after the first):
  rightOf | leftOf | onTop | above | behind: string,
  align: 'left' | 'right' | 'back',  // Optional, onTop and above
  gapMm: number           // Optional, onTop and above
}
```

## Article Catalog

Access via `get-plan-context` with `include: 'articles'`:

```javascript
{
  articles: [
    {
      articleId: string,
      name: string,
      desc: string,
      category: string,           // base-unit, wall-unit, tall-unit, corner-unit, worktop, appliance
      dimensions: { width, depth, height },  // millimeters
      dockingVectors: string[],   // Available docking vector names
      cornerArticle: boolean       // True for L-shaped corner articles
    }
  ]
}
```

## Relations

Every root after the first names one neighbour of the same group by its id, with exactly one
relation; the server compiles the docking (`contextData`) from it
([behaviour reference D34](../../hi-mcp/docs/hi-mcp-behaviour.md#3-decisions)):

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
  `leftOf` it.
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

1. Anchor must be placed first
2. Every root connected to the first root through the docking, directly or through a chain (entries count in either direction)
3. Chain docking allowed (A → B → C)
4. Multiple dockings per anchor allowed
5. Vector compatibility required
6. No circular docking

## Positioning a group

A new group is positioned by one point and one rotation, given in the call that creates it — at a
wall, in a corner, or anywhere in the room:

```javascript
placement: {
  posGroup: [x, y, z],   // the group's back left bottom corner in the room, mm (y = 0 on the floor)
  posRotationY: number,  // degrees, counter-clockwise as seen from above
  rootId: string         // optional - only with two corner articles, see below
}
```

- **Point**: `posGroup` is the room point of the group's back left bottom corner; for a group of
  wall units only, its y is their mounting height. In a room corner it is the corner point. It
  holds for every article: the server places the anchor by the back left bottom corner of its
  docking vectors, also where its origin lies elsewhere (the centre of a range hood, the arm of a
  corner article). A returned group's `position.pos` and `rotationY` are read the same way; with two
  corner articles, `position.rootId` names the one `pos` belongs to.
- **Rotation sense**: positive `posRotationY` turns the group counter-clockwise as seen from above
  (in the top-view image) — the `rotationY` convention of the kernel (RoomleCore) and the glue logic.
  The right wall is **270**, the left wall **90**.
- **Against a wall**: `posRotationY` = the wall's `facingRotationY`; the group's back stands against
  the wall and the group runs from `posGroup` towards the wall's `start`. `posGroup` = `end` puts
  it flush into the corner at the wall's end; `end + d · (start − end) / lengthMm` shifts it by d;
  d = (lengthMm − group width) / 2 centres it; d = lengthMm − group width puts its right end into
  the corner at the wall's `start`.
- **Corner**: `posGroup` = the corner point, `posRotationY` = the `facingRotationY` of the wall that
  ends in that corner; a corner kitchen starts with a corner article. For a right-handed corner
  article (`mod_CarcaseDirection` Right) the server adds 90° itself; the group is read back with
  the `posRotationY` it was placed with.

| Rectangular room (back = top in the top view) | `posRotationY` | Corner: the units `rightOf` the corner article run along | Corner: the units `leftOf` it run along |
|---|---|---|---|
| Back wall / left back corner | 0 | back wall, to the right | left wall, to the front |
| Left wall / left front corner | 90 | left wall, to the back | front wall, to the right |
| Front wall / right front corner | 180 | front wall, to the left | right wall, to the back |
| Right wall / right back corner | 270 | right wall, to the front | back wall, to the left |

- **Two corner articles** (a U-shaped kitchen): set `rootId` to the corner article that goes into
  the corner `posGroup` names.
- **Anywhere else** (island, middle of the room, next to a door): any free floor point, any rotation.
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
`merge-article-into-group` docks one more unit with the docking pairs above (`dockTo: { rootId,
ownDockingVector, dockingVector, mode?, offset? }`, `ownDockingVector` one of the root's
`freeDockingVectors`), `exchange-root-module` replaces a unit and keeps its docking,
`delete-root-module` removes a unit (units no longer docked together become separate groups where
they stand), `delete-group` removes a group, `change-module-attribute` and `change-group-attribute`
set attributes, and `merge-groups` joins groups where they stand, without moving them or adding
docking. Every command keeps the group's position. Resubmitting the group with
`create-or-replace-groups` is for a rebuild, e.g. several new units at once — see
[hi-mcp-tools.md](./hi-mcp-tools.md#the-command-tools).

## Validation Rules

The server corrects what it can and builds every group it can; only a call in which no group can be
built is an error. Every guard and correction:
[hi-mcp-behaviour.md §8](../../hi-mcp/docs/hi-mcp-behaviour.md#8-guards-corrections-and-feedback).

### Corrected and reported in `corrections` (the group is loaded):
- A root without a relation (in a group with relations) — put into the row of its kind; a relation to an unknown root or to itself, or one that closes a ring — ignored or dropped
- A floor unit `above` a unit — put `rightOf` it; a wall unit `rightOf` / `leftOf` a base unit — hung `above` it; `behind` a corner article — ignored
- `gapMm` beside a unit, an unknown `align`, a second relation field — ignored
- `pos`/`rotationY` on a group, `articlePos`/`rotationY` on a root — dropped
- `repositioningData` on a group — taken as the placement
- `placement`: other fields dropped, `posGroup` `[x, z]` completed to `[x, 0, z]`, a `rootId` that names no root dropped; a placement the server cannot use (`posGroup` not a point, no numeric `posRotationY`) and a placement on a group that is already in the plan are not used — the planner positions the group, an existing group keeps its position
- A root without `id` gets `root-1`, `root-2`, …; a duplicate root id no docking entry names is renamed (`u1` → `u1-2`)
- Roots the docking does not connect to the first root — docked to the free end of a row of their kind (floor units or wall units), `mode` `StartStart`, `offset` `[0, 0, 0]`
- Two roots on one side docking vector (`LeftBottom`, `RightBottom`) at the same place — the later one is docked to the free end of that row; Top vectors and `BackBottom` may carry several
- An `articleId` in another spelling (case, whitespace) — read in the catalog's spelling
- A placed group whose anchor the server cannot calculate beforehand — placed by the unit's origin; `place-group` puts it against a wall or into a corner

### Not built, reported in `notLoaded` (the other groups of the call load):
- A group without roots, or with generated roots only
- A root without `articleId`, or an `articleId` the catalog does not have
- A duplicate root id that a docking entry names
- Roots the server cannot dock: no free row end, a wall unit without a wall-unit row to continue

### Returned as a hint (the group is loaded):
- A group of the call that is still unpositioned — it sits at the plan origin; a group gets its position from the placement it is created with, or `place-group` moves it against a wall or into a corner

## Practical Patterns

### Pattern 1: Simple Row
```javascript
{
  // centred on the left wall of a 4000 x 3000 room (start [0, 0, -3000], end [0, 0, 0], facing 90):
  // d = (3000 - 1200) / 2 = 900 from the end towards the start
  placement: { posGroup: [0, 0, -900], posRotationY: 90 },
  roots: [
    { id: 'u1', articleId: 'base-unit-600' },
    { id: 'u2', articleId: 'base-unit-600', rightOf: 'u1' }
  ]
}
```

### Pattern 2: L-Shaped Corner
```javascript
{
  // left back corner of a 4000 x 3000 room: the end of the back wall, facing 0
  placement: { posGroup: [0, 0, -3000], posRotationY: 0 },
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
  // centred on the left wall: d = (3000 - 1200) / 2 = 900
  placement: { posGroup: [0, 0, -900], posRotationY: 90 },
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

1. Get context: `get-plan-context({ include: 'rooms,articles,groups' })`
2. Review rooms, articles, existing groups
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
