# HI Authoring Rules Skill

**Load this skill when the task involves:** HI group authoring, docking patterns, article selection, positioning new groups with a placement, group creation, or understanding how to properly structure HI object groups.

## Core Principle

**Never author root positions.** Roots are positioned by docking; a new group is positioned by its `placement` — one point and one rotation taken from the walls.

**One kitchen is one group.** Every unit standing beside, above or back to back with another unit is a docked root of the same group; the group carries one placement. Never split a kitchen into several positioned groups.

Direct coordinate properties like `articlePos`, `rotationY`, `pos`, or `rotationY` will be **rejected**.

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
  attributes: Attribute[],  // Optional: attribute overrides
  contextData: ContextData // Optional: docking information
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

## Docking System

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
| Above | LeftTop/RightTop/BackTop | LeftBottom/RightBottom/BackBottom | StartStart | ~600 |
| Behind | BackBottom | BackBottom | (none) | 0 |

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
  wall units only, its y is their mounting height. In a room corner it is the corner point.
- **Rotation sense**: positive `posRotationY` turns the group counter-clockwise as seen from above
  (in the top-view image) — the `rotationY` convention of the kernel (RoomleCore) and the glue logic.
  The right wall is **270**, the left wall **90**.
- **Against a wall**: `posRotationY` = the wall's `facingRotationY`; the group's back stands against
  the wall and the group runs from `posGroup` towards the wall's `start`. `posGroup` = `end` puts
  it flush into the corner at the wall's end; `end + d · (start − end) / lengthMm` shifts it by d;
  d = (lengthMm − group width) / 2 centres it; d = lengthMm − group width puts its right end into
  the corner at the wall's `start`.
- **Corner**: `posGroup` = the corner point, `posRotationY` = the `facingRotationY` of the wall that
  ends in that corner; a corner kitchen starts with a corner article.

| Rectangular room (back = top in the top view) | `posRotationY` | Corner: `RightBottom` row along | Corner: `LeftBottom` row along |
|---|---|---|---|
| Back wall / left back corner | 0 | back wall, to the right | left wall, to the front |
| Left wall / left front corner | 90 | left wall, to the back | front wall, to the right |
| Front wall / right front corner | 180 | front wall, to the left | right wall, to the back |
| Right wall / right back corner | 270 | right wall, to the front | back wall, to the left |

- **Two corner articles** (a U-shaped kitchen): set `rootId` to the corner article that goes into
  the corner `posGroup` names.
- **Anywhere else** (island, middle of the room, next to a door): any free floor point, any rotation.
- **New groups only**: the placement is applied once, when the group is created. A placement on a
  group already in the plan is rejected; a group resubmitted without placement keeps its position.

### Moving a group

An existing group is moved with `place-group`, not with a placement: the wall by side label or
index, `alignment` `start`, `center` (default) or `end` along it, or the side label of the
adjoining wall to sit flush in that corner (`wall: 'right'`, `alignment: 'top'` is the back right
corner), and `offsetMm` along the wall. The server computes the position from the group's
calculated footprint; a group with a corner article goes into the corner the alignment names. The
roots and their docking stay as they are, and the group keeps its height. A target that meets
another group is rejected and the group is not moved — units that belong together are docked into
one group.

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

### Will be rejected:
- Groups with `pos` or `rotationY`
- Roots with `articlePos` or `rotationY`
- `repositioningData` on a group (use `placement`)
- Invalid `placement` (`posGroup` not `[x, y, z]`, `posRotationY` missing or not a number — state 0 explicitly, `rootId` not a root of the group, any other field)
- A `placement` on a group that is already in the plan
- Invalid articleId
- Roots the docking does not connect to the first root (two chains that never meet, a root with no docking)
- Invalid docking vectors

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
    {
      id: 'u1', articleId: 'base-unit-600',
      contextData: {
        dockedRoots: [{ ownDockingVector: 'RightBottom', dockedRoots: [{ id: 'u2', dockingVector: 'LeftBottom' }] }]
      }
    },
    { id: 'u2', articleId: 'base-unit-600' }
  ]
}
```

### Pattern 2: L-Shaped Corner
```javascript
{
  // left back corner of a 4000 x 3000 room: the end of the back wall, facing 0
  placement: { posGroup: [0, 0, -3000], posRotationY: 0 },
  roots: [
    {
      id: 'corner', articleId: 'corner-unit-900', cornerArticle: true,
      contextData: {
        dockedRoots: [
          { ownDockingVector: 'LeftBottom', dockedRoots: [{ id: 'u1', dockingVector: 'RightBottom' }] },
          { ownDockingVector: 'RightBottom', dockedRoots: [{ id: 'u2', dockingVector: 'LeftBottom' }] }
        ]
      }
    },
    { id: 'u1', articleId: 'base-unit-600' },
    { id: 'u2', articleId: 'base-unit-600' }
  ]
}
```

### Pattern 3: Base with Wall Unit Above
```javascript
{
  // centred on the left wall: d = (3000 - 600) / 2 = 1200
  placement: { posGroup: [0, 0, -1200], posRotationY: 90 },
  roots: [
    {
      id: 'base', articleId: 'base-unit-600',
      contextData: {
        dockedRoots: [{
          ownDockingVector: 'LeftTop',
          dockedRoots: [{ id: 'wall', dockingVector: 'LeftBottom', offset: [0, 600, 0] }]
        }]
      }
    },
    { id: 'wall', articleId: 'wall-unit-600' }
  ]
}
```

## Common Mistakes

1. **Direct coordinates**: Never use `articlePos`, `rotationY`, `pos`, `rotationY`
2. **Unconnected roots**: Every root must be reachable through the docking from the first root; roots docked only among themselves land on top of the first root
3. **Wrong vector pairs**: Use compatible pairs (RightBottom → LeftBottom, etc.)
4. **Docking to non-existent root**: An entry naming an id outside the group connects nothing; a root docked only that way is rejected
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
