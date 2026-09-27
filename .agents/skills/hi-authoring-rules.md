# HI Authoring Rules Skill

**Load this skill when the task involves:** HI group authoring, docking patterns, article selection, placement rules, group creation, or understanding how to properly structure HI object groups.

## Core Principle

**Never author coordinates directly.** All positioning must be done through docking and placement.

Direct coordinate properties like `articlePos`, `rotationY`, `pos`, or `rotationY` will be **rejected**.

## Group Structure

### Group
```javascript
{
  id: string,              // Unique identifier
  libraryId: string,       // Optional library identifier
  placement: object,       // Wall-based positioning (mutually exclusive with repositioningData)
  repositioningData: object, // Coordinate-based positioning (mutually exclusive with placement)
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

## Placement System

```javascript
{
  wall: string | number,    // Wall label or index
  alignment: string,        // Position along wall (optional)
  offsetMm: number,        // Offset in mm (optional)
  roomIndex: number        // Target room (optional)
}
```

### Wall Identifiers

- Side labels: `'left'`, `'right'`, `'top'`, `'bottom'` (uses longest wall)
- Wall index: Numeric index from room's `walls` array

### Alignment Options

- `'center'` (default): Center of wall
- `'start'`, `'end'`: Wall endpoints
- `'left'`, `'right'`, `'top'`, `'bottom'`: Corner placement

### Corner Placement

With corner articles (`cornerArticle: true`):
- Article's corner point placed exactly at room corner
- Article rotated so both back edges lie along the two walls
- Group footprint flush into corner

### Repositioning Data (Alternative)

```javascript
{
  posGroup: [x, y, z],        // Position in mm (y = vertical)
  posRotationY: number,      // Yaw in degrees (optional)
  rootId: string,            // Anchor root ID
  rootRelPos: [x, y, z],     // Anchor offset (optional)
  rootRelRotationY: number   // Anchor rotation offset (optional)
}
```

**Note**: `placement` and `repositioningData` are mutually exclusive.

## Validation Rules

### Will be rejected:
- Groups with `pos` or `rotationY`
- Roots with `articlePos` or `rotationY`
- Both `placement` and `repositioningData`
- Invalid articleId
- Undocked roots
- Invalid docking vectors
- Invalid wall labels

## Practical Patterns

### Pattern 1: Simple Row
```javascript
{
  placement: { wall: 'left', alignment: 'center' },
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
  placement: { wall: 'left', alignment: 'top' },
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
  placement: { wall: 'left' },
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
3. Create group with proper docking and placement
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
