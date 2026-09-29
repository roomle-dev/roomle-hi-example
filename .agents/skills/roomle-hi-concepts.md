# Roomle HI Concepts

> Core HOMAG Intelligence (HI) concepts for the roomle-hi-example repository. This skill provides foundational knowledge about the HI data model, relationships, and architecture patterns.

## When to Load This Skill

Load this skill when working with:
- HI data structures (rooms, walls, articles, groups)
- Docking vectors and docking relationships
- Group positioning with `repositioningData`
- Article catalog and module selection
- HI-specific parameters and attributes

**Do NOT load** for general Roomle planner concepts not specific to HI, or for MCP server implementation details (use `hi-mcp-server.md` instead).

---

## Overview

HOMAG Intelligence (HI) is Roomle's system for kitchen cabinet configuration, pricing, and order management. It extends the Roomle planner with domain-specific concepts for kitchen planning.

## Core Entities

### 1. Rooms

A **Room** represents a bounded space in the plan with walls, floor, and optionally ceiling.

**Properties:**
- `id` — Unique identifier
- `walls` — Array of wall objects with side labels
- `floor` — Floor object
- `ceiling` — Ceiling object (optional)
- `dimensions` — Width, depth, height

**Wall Properties:**
- `sideLabel` — String label identifying the wall (e.g., "left", "right", "front", "back")
- `coordinates` — Array of [x, y, z] points defining the wall path
- `length` — Wall length in millimeters
- `height` — Wall height in millimeters
- `thickness` — Wall thickness in millimeters

**Example:**
```javascript
{
  id: "room_1",
  walls: [
    { sideLabel: "front", length: 4000, height: 2800, thickness: 200 },
    { sideLabel: "right", length: 3000, height: 2800, thickness: 200 },
    { sideLabel: "back", length: 4000, height: 2800, thickness: 200 },
    { sideLabel: "left", length: 3000, height: 2800, thickness: 200 }
  ]
}
```

### 2. Articles

An **Article** is a catalog entry representing a kitchen cabinet module. Articles are organized in a hierarchical catalog structure.

**Properties:**
- `id` — Unique identifier (e.g., `catalog:article:HICabinet_600`)
- `name` — Human-readable name
- `category` — Category classification (e.g., "Base Cabinet", "Wall Cabinet", "Tall Cabinet")
- `dimensions` — Object dimensions (width, depth, height)
- `dockingVectors` — Array of docking connection points
- `parameters` — Configurable parameters (colors, materials, sizes)
- `attributes` — HI-specific attributes for pricing and configuration

**Docking Vector Properties:**
- `id` — Unique vector identifier within the article
- `position` — [x, y, z] position relative to article origin
- `direction` — [x, y, z] normal vector
- `type` — Docking type (e.g., "front", "back", "left", "right", "top", "bottom")
- `compatibleCategories` — Array of article categories that can dock here

**Article Hierarchy:**
```
Catalog
├── HI
│   ├── Base Cabinets
│   │   ├── HICabinet_600
│   │   ├── HICabinet_800
│   │   └── ...
│   ├── Wall Cabinets
│   └── Tall Cabinets
└── Accessories
    ├── Handles
    ├── Drawers
    └── ...
```

### 3. Groups

A **Group** is a collection of root modules (article instances) with docking relationships. Groups represent complete kitchen configurations (e.g., a base cabinet with drawers and doors).

**Properties:**
- `id` — Unique identifier
- `name` — Human-readable name
- `roots` — Array of root module instances
- `dockingConnections` — Relationships between roots
- `repositioningData` — `{ posGroup, posRotationY, rootId }`, the group position (see [Positioning](#5-positioning))

**Root Module Properties:**
- `articleId` — Reference to the article catalog
- `position` — [x, y, z] world position
- `rotation` — [x, y, z] Euler rotation in degrees
- `parameters` — Override values for article parameters
- `dockingVectors` — Runtime docking vectors (may differ from article definition)

**Docking Connection Properties:**
- `fromRootIndex` — Index of source root in the group
- `fromDockingVectorId` — Docking vector ID on source root
- `toRootIndex` — Index of target root in the group
- `toDockingVectorId` — Docking vector ID on target root
- `mode` — Docking mode (e.g., "aligned", "flush", "center")
- `offset` — [x, y, z] offset from ideal docking position

**Repositioning Properties:**
- `posGroup` — [x, y, z] in millimetres: where the left back bottom corner of the anchor root goes
- `posRotationY` — rotation of the group in degrees, counter-clockwise as seen from above
- `rootId` — the anchor: the leftmost root of the back row

**Example Group:**
```javascript
{
  id: "kitchen_base_1",
  name: "Base Cabinet with Drawers",
  roots: [
    {
      articleId: "catalog:article:HICabinet_600",
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      parameters: { color: "white", width: 600 }
    },
    {
      articleId: "catalog:article:HIDrawer_600",
      position: [0, 0, 100],
      rotation: [0, 0, 0]
    }
  ],
  dockingConnections: [
    {
      fromRootIndex: 0,
      fromDockingVectorId: "front_center",
      toRootIndex: 1,
      toDockingVectorId: "back_center",
      mode: "aligned"
    }
  ],
  repositioningData: {
    posGroup: [4000, 0, -3000], // the end of the right wall of a 4000 x 3000 room
    posRotationY: 270,          // the right wall's facingRotationY
    rootId: "<id of the leftmost root>"
  }
}
```

### 4. Docking System

The **Docking System** defines how articles and groups connect to each other.

**Key Concepts:**

- **Docking Vector**: A connection point on an article where other articles can attach
- **Docking Pair**: A connection between two docking vectors (from one article to another)
- **Docking Mode**: How the connection is aligned (aligned, flush, center)
- **Docking Offset**: Additional offset from the ideal docking position
- **Free Docking Vector**: A docking vector with no connection, indicating where new articles can be added

**Docking Resolution:**
1. Match compatible categories between docking vectors
2. Align positions based on docking mode
3. Apply offset if specified
4. Validate collision and constraints

**Docking Vector Transformation:**
When a root module is placed in the world, its docking vectors are transformed:
```javascript
worldDockingVector = articleDockingVector
  .rotate(root.rotation)
  .translate(root.position)
```

### 5. Positioning

A group is positioned by `repositioningData: { posGroup, posRotationY, rootId }` — one point and
one rotation, the same for a group at a wall, in a corner or anywhere in the room. There is no
separate wall placement.

- `rootId` is the leftmost root of the group's back row (standing on the floor, not turned within
  the group); `posGroup` is its left back bottom corner in the room.
- `posRotationY` is in degrees, counter-clockwise as seen from above. Against a wall it is the
  wall's `facingRotationY` (rectangular room: back 0, left 90, front 180, right 270), and
  `posGroup` lies on the wall, from its `end` towards its `start`.
- It is applied once when the group loads; moving a group means resubmitting it with a new
  `repositioningData`.

The wall and corner rules are in [hi-authoring-rules.md](./hi-authoring-rules.md#positioning-a-group).
RoomleCore ADR 0011 ("a numeric placement never rotates the object") concerns the planner's
interactive numeric placement, not `repositioningData`: `posRotationY` does rotate the group.

## HI-Specific Concepts

### Attribute Groups

HI articles have **attribute groups** that define pricing, configuration, and manufacturing properties.

**Common Attribute Groups:**
- `General` — Basic properties (width, height, depth)
- `Material` — Surface materials (color, finish)
- `Hardware` — Handles, hinges, slides
- `Accessories` — Optional add-ons

**Attribute Properties:**
- `id` — Unique attribute identifier
- `name` — Display name
- `type` — Data type (string, number, boolean, enum)
- `value` — Current value
- `default` — Default value
- `options` — Available options (for enum types)
- `unit` — Unit of measurement (for numeric types)

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
├── Rooms (walls, floor, ceiling)
├── Articles (catalog entries)
└── Groups (root modules + docking)
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
3. Define Docking Connections
   │
   ▼
4. Set repositioningData
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
1. get-plan-context (current state)
   │
   ▼
2. Extract Groups and Articles
   │
   ▼
3. Resolve Article Pricing
   │
   ▼
4. Apply Parameters and Attributes
   │
   ▼
5. Sum Group Prices
   │
   ▼
6. get-price Tool Returns Total
```

## Important Rules and Constraints

### Authoring Rules

1. **Never Author Root Positions** — Roots are positioned by docking, the group by `repositioningData`
2. **Groups Must Be Docked** — Roots within a group must be docked to already-placed roots
3. **Valid Docking Pairs** — Only compatible categories can dock
4. **Positions Come From the Walls** — `posGroup` and `posRotationY` are taken from a wall's `start`/`end` and `facingRotationY`
5. **Docking Vectors Must Exist** — Cannot dock to non-existent vectors

### Positioning Rules

1. **One Mechanism** — Every group is positioned with `repositioningData` (a point and a rotation)
2. **Against a Wall** — `posRotationY` = the wall's `facingRotationY`, `posGroup` on the wall from its `end` towards its `start`
3. **Docking Vectors Transform** — Vectors are transformed with root's position and rotation
4. **Extend, Don't Butt** — Units next to an existing group are docked into that group; overlapping groups are not rejected

### Docking Rules

1. **Docking Vector Compatibility** — Check category compatibility before docking
2. **Docking Mode** — Determines alignment (aligned, flush, center)
3. **Docking Offset** — Applied after ideal position calculation
4. **Free Vectors** — Indicate where new modules can be added

## Common Patterns

### Creating a Simple Cabinet Group

```javascript
// Step 1: Define articles
const articles = [
  { id: "catalog:article:HICabinet_600", width: 600, depth: 600, height: 850 },
  { id: "catalog:article:HIDoor_600", width: 600, depth: 50, height: 700 }
];

// Step 2: Create group with docking
const group = {
  id: "cabinet_with_door",
  roots: [
    { articleId: articles[0].id, position: [0, 0, 0], rotation: [0, 0, 0] },
    { articleId: articles[1].id, position: [0, 0, 0], rotation: [0, 0, 0] }
  ],
  dockingConnections: [
    {
      fromRootIndex: 0,
      fromDockingVectorId: "front_top_left",
      toRootIndex: 1,
      toDockingVectorId: "back_bottom",
      mode: "aligned"
    }
  ],
  repositioningData: {
    posGroup: [3000, 0, 0], // front wall of a 4000 x 3000 room, 1000 mm from its end
    posRotationY: 180,      // the front wall's facingRotationY
    rootId: "<id of the leftmost root>"
  }
};

// Step 3: Send to Roomle via create-or-replace-groups
await callTool("create-or-replace-groups", { groups: [group] });
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

### Adjusting Group to Wall Width

```javascript
// Get wall dimensions
const wall = context.rooms.rooms[0].walls.find(w => w.side === "bottom");
const wallWidth = wall.lengthMm;

// Create group with adjustment
const group = {
  id: "wall_filling_cabinet",
  roots: [
    { articleId: "catalog:article:HICabinet_600", position: [0, 0, 0] },
    { articleId: "catalog:article:HICabinet_600", position: [0, 0, 0] }
  ],
  dockingConnections: [
    {
      fromRootIndex: 0,
      fromDockingVectorId: "right",
      toRootIndex: 1,
      toDockingVectorId: "left",
      mode: "aligned"
    }
  ],
  repositioningData: {
    posGroup: wall.end,               // flush into the corner at the wall's end
    posRotationY: wall.facingRotationY,
    rootId: "<id of the leftmost root>"
  },
  // Group will be adjusted to fill wall width
  adjustToWallWidth: true
};
```

## Error Handling

### Common Errors

1. **Removed `placement`** — a group with `placement` is rejected with a pointer to `repositioningData`
2. **Incompatible Docking** — Articles with incompatible categories cannot dock
3. **Missing Docking Vector** — Referenced docking vector does not exist on article
4. **Collision** — Group would intersect with wall or other group
5. **Invalid repositioningData** — `posGroup` not `[x, y, z]`, `posRotationY` not a number, or `rootId` not a root of the group

### Error Response Format

A rejected payload comes back as a tool error result whose text lists every problem:

```text
Invalid pos groups - nothing was loaded:
posGroups[0].repositioningData: rootId must be the id of one of the group's roots - the leftmost root of its back row
Fetch the payload format with the get-authoring-rules tool.
```

## Best Practices

### Group Design

1. **Start with Base Cabinet** — Use as anchor for other modules
2. **Dock Sequentially** — Add modules one at a time with proper docking
3. **Validate Docking** — Always check docking compatibility before adding
4. **Position From the Walls** — Take `posGroup`/`posRotationY` from a wall's `end` and `facingRotationY`
5. **Test Adjustment** — Verify group adjusts correctly to wall width

### Performance

1. **Batch Operations** — Use `create-or-replace-groups` for multiple groups
2. **Minimize Queries** — Cache plan context when possible
3. **Validate Early** — Check docking and repositioningData before creating groups
4. **Use Timeouts** — Set appropriate timeouts for tool calls (30s default, 120s for images)

### Debugging

1. **Inspect Plan Context** — Use `get-plan-context` to see current state
2. **Check Docking Vectors** — Verify vectors exist and are positioned correctly
3. **Check the Walls** — Take `start`/`end`/`facingRotationY` from the room's `walls` array
4. **Test Incrementally** — Create groups one at a time to isolate issues

## Related Skills

- **[hi-mcp-server.md](../hi-mcp-server.md)** — MCP server architecture and implementation
- **[hi-authoring-rules.md](../hi-authoring-rules.md)** — Detailed HI authoring patterns and rules
- **[hi-mcp-tools.md](../hi-mcp-tools.md)** — Complete MCP tool reference with examples

## References

- [AGENTS.md](../../AGENTS.md) — AI assistant instructions
- [.agents/README.md](../../README.md) — Digital brain index
- [minimal-hi-example/docs/hi-mcp-server.md](../../minimal-hi-example/docs/hi-mcp-server.md) — User-facing MCP documentation
