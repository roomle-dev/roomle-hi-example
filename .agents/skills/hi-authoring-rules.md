# HI Authoring Rules Skill

**Load this skill when the task involves:** HI group authoring, docking patterns, article selection, group positioning with repositioningData, group creation, or understanding how to properly structure HI object groups.

## Core Principle

**Never author root positions.** Roots are positioned by docking; a group is positioned by its `repositioningData` — one point and one rotation taken from the walls.

**One kitchen is one group.** Every unit standing beside, above or back to back with another unit is a docked root of the same group; only the anchor root carries a position. Never split a kitchen into several positioned groups.

Direct coordinate properties like `articlePos`, `rotationY`, `pos`, or `rotationY` will be **rejected**.

## Group Structure

### Group
```javascript
{
  id: string,              // Unique identifier
  libraryId: string,       // Optional library identifier
  repositioningData: object, // { posGroup, posRotationY, rootId } - positions the group
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
2. No undocked roots (except first)
3. Chain docking allowed (A → B → C)
4. Multiple dockings per anchor allowed
5. Vector compatibility required
6. No circular docking

## Positioning a group

A group is positioned by one point and one rotation — at a wall, in a corner, or anywhere in the
room:

```javascript
{
  posGroup: [x, y, z],   // left back bottom corner of the anchor root in the room, mm (y = 0 on the floor)
  posRotationY: number,  // degrees, counter-clockwise as seen from above
  rootId: string,        // the anchor: the root the docking starts from, listed first in roots
  rootRelPos: [x, y, z]  // optional root-local offset, rotated with posRotationY - the negated cornerPoint of a corner article
}
```

- **Anchor**: `rootId` names the root the docking chains start from, listed first in `roots` (in
  an L-shaped kitchen the corner article, in a row its leftmost unit). Its left back bottom corner
  is placed exactly at `posGroup`; for a group of wall units only, `posGroup` y is their mounting
  height.
- **Rotation sense**: positive `posRotationY` turns the group counter-clockwise as seen from above
  (in the top-view image) — the `rotationY` convention of the kernel (RoomleCore) and the glue logic.
  The right wall is **270**, the left wall **90**.
- **Against a wall**: `posRotationY` = the wall's `facingRotationY`; the group's back stands against
  the wall and the group runs from `posGroup` towards the wall's `start`. `posGroup` = `end` puts
  it flush into the corner at the wall's end; `end + d · (start − end) / lengthMm` shifts it by d;
  d = (lengthMm − group width) / 2 centres it; d = lengthMm − group width puts its right end into
  the corner at the wall's `start`.
- **Corner**: `posGroup` = the corner point, `posRotationY` = the `facingRotationY` of the wall that
  ends in that corner. A corner article's corner point can lie left of its root origin (the blind
  zone) — the catalog's `cornerPoint` says where, root-local (Furniture_Smith: `[-261, 0, 0]`).
  Add `rootRelPos` = the negated `cornerPoint`: it is rotated with `posRotationY`, so the same
  value is right in every corner; never add the offset to the room point `posGroup` without
  rotating it by `posRotationY` first. No `cornerPoint` in the catalog yet (empty plan)? Load,
  then resubmit with `posGroup` shifted by (intended corner − returned `position.pos`), keeping
  `posRotationY` — the room-space delta already contains the rotation.

| Rectangular room (back = top in the top view) | `posRotationY` | Corner: `RightBottom` row along | Corner: `LeftBottom` row along |
|---|---|---|---|
| Back wall / left back corner | 0 | back wall, to the right | left wall, to the front |
| Left wall / left front corner | 90 | left wall, to the back | front wall, to the right |
| Front wall / right front corner | 180 | front wall, to the left | right wall, to the back |
| Right wall / right back corner | 270 | right wall, to the front | back wall, to the left |

- **Anywhere else** (island, middle of the room, next to a door): any free floor point, any rotation.
- **Moving**: resubmit the group with its id and a new `repositioningData`; a replace without it
  keeps the group where it is.

## Validation Rules

### Will be rejected:
- Groups with `pos` or `rotationY`
- Roots with `articlePos` or `rotationY`
- `placement` (removed — use `repositioningData`)
- Invalid `repositioningData` (`posGroup` not `[x, y, z]`, `posRotationY` not a number, `rootId` not a root of the group, `rootRelPos` not `[x, y, z]`)
- Invalid articleId
- Undocked roots
- Invalid docking vectors

## Practical Patterns

### Pattern 1: Simple Row
```javascript
{
  // centred on the left wall of a 4000 x 3000 room (start [0, 0, -3000], end [0, 0, 0], facing 90):
  // d = (3000 - 1200) / 2 = 900 from the end towards the start
  repositioningData: { posGroup: [0, 0, -900], posRotationY: 90, rootId: 'u1' },
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
  // left back corner of a 4000 x 3000 room: the end of the back wall, facing 0;
  // rootRelPos negates the corner article's catalog cornerPoint [-261, 0, 0]
  repositioningData: { posGroup: [0, 0, -3000], posRotationY: 0, rootId: 'corner', rootRelPos: [261, 0, 0] },
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
  repositioningData: { posGroup: [0, 0, -1200], posRotationY: 90, rootId: 'base' },
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
2. **Undocked roots**: Every non-first root must be docked
3. **Wrong vector pairs**: Use compatible pairs (RightBottom → LeftBottom, etc.)
4. **Docking to non-existent root**: All referenced IDs must exist in group
5. **Circular docking**: A root cannot dock to itself directly or indirectly

## Workflow

1. Get context: `get-plan-context({ include: 'rooms,articles,groups' })`
2. Review rooms, articles, existing groups
3. Create group with proper docking and repositioningData
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
