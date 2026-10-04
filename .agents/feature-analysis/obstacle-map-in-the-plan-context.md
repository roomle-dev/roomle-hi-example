# Feature Analysis: The obstacle map in the plan context (RML-18036)

> **Type**: Feature Analysis
> **Domain**: roomle-ui `homag-intelligence` and `planner-core` (the plan context), hi-mcp `get-plan-context` and the served rules (roomle-hi-example); verified against the obstacle map of RoomleCore
> **Trigger**: Jira [RML-18036](https://roomle.atlassian.net/browse/RML-18036) — add the obstacle map to the plan context for the HI MCP, in the coordinate system of the plan context, with the HI object groups as separate objects carrying their group id; question: can the individual root modules be encoded too?
> **Date**: 2026-10-04
> **Author**: AI Assistant
> **Status**: Open

---

## What was asked and why

The ticket asks for obstacle information in the plan context of the HI MCP:

1. The obstacle map of the planner — objects, doors and windows — in the coordinate system the plan
   context uses for everything else.
2. The HI object groups set apart from the obstacles, as separate objects with their group id: the
   agent must be able to tell a group it may edit from an obstacle it has to plan around, and the
   groups' outlines should help it to see where the groups stand.
3. If possible, the individual root modules as well.

Today the agent knows the room as walls and corners and the groups as article picks with one
position each. It does not know where a door, a window or a sofa is, so it plans a row of wall units
across a window, a kitchen in front of a door, or an island into an armchair. The server's own
geometry (`place-group`, D27) sees other HI groups only, never the planner's objects.

## How it works today

### The obstacle map of the kernel (RoomleCore)

`PlanModelViewHelper::getObstacleMap(plan)` (`src/planner/view/plan-model-view-helper.cpp:1486-1498`)
refreshes the plan's placement validator and returns its obstacle map as a DTO:
`{ points: Vector2[], obstacles: Obstacle2d[] }`. It is part of the kernel web API
(`node/src/embind/plannerCoreInterface.ts:931`, DTOs `:548-563`, type constants `:187-191`); the
RoomleCore node loader wraps it (`node/src/loader/planElementManager.ts:403-406`) and the debug app
`node/debug-apps/src/apps/obstacle-2d` draws it — the "Obstacle 2D View" of the ticket (walls red,
objects yellow, construction objects orange). roomle-ui calls it nowhere.

An obstacle is a line segment on the floor with a vertical range
(`src/util/geometry/obstacle-map-2d.h`): `type`, `associatedObjectIds`, the point indices `p0`/`p1`,
`bottom`/`top`, `normalizedDirection`, `length`. The placement validator fills the map
(`src/planner/geometry/placement-validator.cpp:245-334`):

| Source | Type | Segments | Id | Vertical range |
|---|---|---|---|---|
| every visible wall | `GLOBAL` | the four edges of the wall's outline polygon (the end faces only at a free wall end) | the wall's runtime id | 0 .. wall height |
| every visible plan object | `OBJECT_WITH_ID`, or `CONSTRUCTION_WITH_ID` for a construction object (a door, a window, a wall-mounted element) | the edges of the object's counter-clockwise outline contour in the plan — the real ground outline of its bounding geometry, else the corners of its assembled bounds (`plan-collision-geometry.cpp:31-64`); an object in child-object mode its bottom rectangle | the object's runtime id | `center.z` .. `center.z + size.z` |

Three properties matter for the design:

- **Segments of one object stay with that object.** A new segment merges only with collinear
  segments of the same type that share one of its ids (`obstacle-map-2d.cpp:149-163`); walls merge
  across walls. So the segments of an object can be regrouped by their id into the object's outline
  polygon, but a wall segment cannot be told from its neighbour, and both faces of every wall are in
  the map.
- **An HI group is one object.** An external object is one plan object (`isExternalObject()`, no
  parent — `plan-model-view-helper.cpp:1212-1231`); its root modules and sub modules are
  *components* of that object (`ObjectComponent.externalRootModuleId`,
  `external-configurator-plug-in.cpp:538-575`). The map therefore holds one outline per group — for
  an L-shaped kitchen an L-shaped polygon — and nothing per root module.
- **The ids are runtime ids.** `getId()` is the runtime id (`src/planner/model/plan-element.h:94`),
  the same id `getExternalObjectGroups(plan)` lists per group next to its serialized `PosGroup`
  (`runtimeId`, `serializedDefinition` with the group `id`), and the same id a kernel plan object is
  fetched by. The object type — `door`, `window` — is on the plan object (`getObjectType()`, used in
  roomle-ui `planner-kernel-access.ts:787-788`), not in the map.

Coordinates are the plan's: millimetres, `x`/`y` on the floor, `z` up. The plan context converts a
plan point to pos space as `[x, level, -y]` (roomle-ui `hi-plan-context.ts:668-682`).

### The plan context (roomle-ui)

`getPlanContext(include)` (`glue-logic.ts:931-990`) builds the sections `rooms`, `articles`,
`groups`, `masterData` from two designer requests (`glue-logic.ts:158-161`): `getPosDataOfAllGroups`
and `getRoomInformation`, implemented in `api.ts:95-107` on the planner's public methods
`getExternalObjectGroups` and `getExternalRoomInformation` (`roomle-planner.ts:3129-3149`,
`:3164-3181`), which read the kernel through `getPlanModelViewHelper()` (`:992-994`). The shaping is
pure and unit-tested in `hi-plan-context.ts` (`shapeRooms`, `deriveWalls`, `shapeGroup`,
`groupFootprint`; tests `__tests__/hi-plan-context-test.ts`, `__tests__/glue-logic-test.ts:8686`).
The types `HiPlanContextSection` and `HiPlanContext` live in `external-object-api.ts:167-178`, the
API documentation at `:429-441`; `packages/web-sdk/packages/index.ts` exports them. Since
[RML-17966](../refactoring-analysis/agent-ready-plan-context-in-glue-logic.md) the context is
agent-ready as roomle-ui returns it — the server adds words, not geometry.

**Openings today.** The kernel's room contour comes per level (`plan-room-geometry.cpp:47-66`,
`:110-150`): level 0 (the floor), one level per sill and lintel of the openings attached to the
walls, and the ceiling; an opening is a segment without a type. In the default test room
(`.temp/result/mcp-test-2026-10-04_13-00-37/gpt-6-astra/08-image-planning-right-wall/plan-context.json`)
the level 0 contour shows the door on the right wall (x 4815, z 1180 → 280), the level 950 contour
the window on the back wall (z -3765, x 1650 → -450) up to level 2100. `deriveWalls` uses level 0
only (`hi-plan-context.ts:722`), so the door is a wall entry of type `opening` (server, C18) and the
window is visible only to a reader of the raw `levels`. (The RML-18041 analysis, issue 12, said
windows are not in the contour; they are, on the sill level.)

### The MCP server (roomle-hi-example)

`get-plan-context` passes the planner's context through (`tool-executors.ts:2328-2353`): it filters
the requested sections (`PLAN_CONTEXT_SECTIONS`, `DEFAULT_SECTIONS`, `:55-64`; C12), names the walls
and corners (`agentFacingRooms`, `:593-608`) and completes the articles. The tool description and the
`include` schema (`hi-mcp-server.ts:137-170`), `INSTRUCTIONS` step 1 (`:62`) and the placement rules
(`:20-23`) describe the sections. The server derives group footprints and height ranges from the raw
groups itself (`plan-space.ts:184-284`, `rootFootprintInRoom` `:595-601`, `volumesOverlap` `:658`)
for the overlap correction of `place-group` (D27, G22) — those see HI groups only.
[hi-mcp-behaviour.md](../../hi-mcp/docs/hi-mcp-behaviour.md) §5.4 documents the sections, §5.5 what
is withheld: root positions and geometry (D15).

## The gap

The agent has no information about anything in the room that is not a wall or an HI group, and it
has no room-space outline of the groups either — `position.footprint` is measured in the placement
frame from `pos`. The kernel already computes exactly this information for its own placement
validation, in a form that is one shaping step away from the plan context: regroup the segments per
object, convert to pos space, name what each object is, and attach the group id to the HI groups.
Root modules are not in the obstacle map; their outlines are a second, independent source.

## Proposed design

### A new section `obstacles`

`get-plan-context` gains a section `obstacles`, default like `rooms`, `articles` and `groups`
(the agent positions a group in nearly every turn, and the section is small — see Limits). Its shape,
in the coordinate system of the plan context (3D, right-handed, Y up, millimetres; floor points
`[x, 0, z]` like a wall's `start`/`end`):

```json
"obstacles": {
  "obstacles": [
    { "kind": "door",   "outline": [[x, 0, z], [x, 0, z], [x, 0, z], [x, 0, z]], "bottomMm": 0,   "topMm": 2100 },
    { "kind": "window", "outline": [[x, 0, z], …],                               "bottomMm": 950, "topMm": 2100 },
    { "kind": "object", "outline": [[x, 0, z], …],                               "bottomMm": 0,   "topMm": 820 }
  ],
  "groups": [
    { "id": "<group id>", "outline": [[x, 0, z], …], "bottomMm": 0, "topMm": 2200,
      "roots": [ { "id": "<root id>", "outline": [[x, 0, z], …], "bottomMm": 0, "topMm": 720 } ] }
  ]
}
```

- `obstacles` — every plan object that is not an HI group: `kind` from the kernel object type
  (`door`, `window`, anything else `object` — the ticket does not need the objects identified),
  `outline` the object's segments chained into its floor polygon, `bottomMm`/`topMm` its vertical
  range. A window therefore says from which height it blocks the wall. No names: an obstacle is an
  obstacle.
- `groups` — one entry per HI group with its `id` (the id `groups` uses), its `outline` from the
  obstacle map (an L for an L-shaped kitchen) and its vertical range, and `roots`: per root module
  that is not generated (no worktop, no toe kick — their extent is the row's) its `id`, its floor
  outline and its vertical range in room space. The `groups` section stays as it is (D11: a group is
  a valid payload; C2: nothing new to strip).
- **Not included**: the wall segments (`GLOBAL`). The `rooms` section has the walls per room, named,
  with their openings; the obstacle map's wall segments are both faces of every wall, merged across
  walls and without a room — they would only confuse.

### roomle-ui

1. **planner-core** — `roomle-planner.ts`: a public method beside `getExternalRoomInformation`,
   e.g. `getPlanObstacles()`, that returns the kernel obstacle map (`convertCObject` of
   `planModelViewHelper.getObstacleMap(plan)`) together with what each associated runtime id is:
   `wall`, `door`, `window`, `object` or `group` with its group id. The kinds come from the kernel's
   plan objects (`getObjectType()`, `isExternalObject()`), the group ids from
   `getExternalObjectGroups(plan)` (`runtimeId` → the `id` of the serialized group, as
   `_getExternalObjectGroupsInPlan` reads it, `:1871-1878`). The method is thin: no shaping.
2. **homag-intelligence** — `glue-logic.ts`: `DesignerRequests.getPlanObstacles()` (`api.ts`
   forwards it); `getPlanContext` fills `obstacles` when included, sharing the calculated groups it
   already fetches for `groups` and `articles`.
3. **`hi-plan-context.ts`** — `shapeObstacles(obstacleMap, calculatedGroups)`: drop `GLOBAL`,
   group the segments by id, chain them by their point indices into the polygon, convert
   `(x, y) → [x, 0, -y]` with `round2`, take `bottomMm`/`topMm` from the segments; put the groups
   into `groups` with their id and add the root outlines: per non-generated root the corners of its
   parts' bounding box in group space (the part walk of `groupFootprint`) transformed by the group's
   `pos` and `rotationY` into room space, the vertical range from the same parts — the counterpart of
   the server's `rootFootprintInRoom` (`plan-space.ts:595-601`), which stays where it is.
4. **Types and docs** — `HiPlanContextSection` gains `'obstacles'`, `HiPlanContext` the field, the
   `getExternalObjectPlanContext` documentation the section (`external-object-api.ts`); the exports
   follow automatically.
5. **Tests** — `hi-plan-context-test.ts`: a fixture map with a wall, a door, a window, an object and
   a group of two roots → walls dropped, polygons chained and converted, kinds, group id, root
   outlines, vertical ranges, no `-0`; `glue-logic-test.ts`: the request is made only when the
   section is included, the section arrives shaped; planner-core: the mapping of runtime ids to kinds
   and group ids with a mocked kernel.

### roomle-hi-example (MCP server)

1. `tool-executors.ts:55-64`: `obstacles` in `PLAN_CONTEXT_SECTIONS` and `DEFAULT_SECTIONS`; the
   executor passes the section through unchanged. A planner without the section (an older roomle-ui)
   returns none, and the tool works as today.
2. `hi-mcp-server.ts`: the `get-plan-context` description and the `include` description name the
   section; `INSTRUCTIONS` step 1 lists it; the placement rules say where "a free stretch of wall"
   comes from — check `obstacles`: a door, a window below the top of the units, another object or
   another group's outline is not free — and the verify rule (`:26`) points to the groups' room-space
   outlines. Shorter sentences, not more of them.
3. `hi-mcp/docs/hi-mcp-behaviour.md`: the row in §5.4, §5.5 (root geometry is withheld in `groups`;
   the read-only root outlines of `obstacles` are the exception), the `include` type in §6 and a
   decision D37 recording the section, the dropped walls, the read-only root outlines and the default.
4. Documentation: `minimal-hi-example/docs/hi-mcp-server.md` (get-plan-context, Positioning a
   group), `hi-mcp/hi-mcp-server/README.md:296-323`, `.agents/skills/hi-mcp-tools.md`,
   `.agents/skills/roomle-hi-concepts.md`, `.agents/skills/hi-authoring-rules.md`, `AGENTS.md:381`.
5. Tests: `tests/hi-mcp-server.test.ts` (the description names the section, `include` accepts it, the
   default sections include it), `tests/tool-executors.test.ts` (the section passes through; an
   unknown section is still ignored, C12).
6. **No page change.** The section travels through `getExternalObjectPlanContext`, which every page
   allow-list already carries; the example page, `hi-mcp-client` and the ligna-store bridge stay as
   they are.

### Sequence and dependency

roomle-ui first (the shaping and its tests), verified against the example with a roomle-ui worktree
(`.agents/skills` and the memory notes describe the setup); then the server. The server change can
be merged independently — it tolerates a missing section — but the agent sees obstacles only once the
roomle-ui build the example loads carries them.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Pass the kernel's obstacle map through as it is (points, segments, kernel ids) | A segment soup in plan coordinates with runtime ids that mean nothing to the agent and both faces of every wall; breaks the one-coordinate-system rule of the plan context |
| Shape the obstacles in the MCP server | Needs a new planner method on every page allow-list (example, `hi-mcp-client`, ligna-store); contradicts RML-17966 — the plan context is agent-ready as roomle-ui returns it |
| The plan XML (`getExternalObjectSnapshot({ planXML: true })` exists in the API) | Another coordinate system, far more than the agent needs — as the ticket says |
| `getGroundContoursOfObjects(plan)` as the polygon source | The same outlines, but without the vertical range and the type; a second lookup per object. The obstacle map carries `bottom`/`top`, which a window needs |
| Root outlines from the kernel (`getExternalGroupStructure`: root positions without extents; `getExternalObjectComponent`: one call per root) | The calculated `PosGroup` the glue logic already holds has every root's parts; one source, no extra calls |
| Root outlines inside `groups[].roots` | Breaks D11 and C2 — a returned group must stay a payload as it is — and invites models to author positions (D15) |
| Doors and windows as `openings` on the walls of `rooms` instead of a section | Covers openings only, not objects and not groups. The obstacles section covers all three; an `openings` list per wall can still be derived from it later if models read it better |

## Open questions for refinement

1. **Default section?** Recommended yes: the agent positions in nearly every turn, the section is
   small, and the HI chat passes no server instructions that would tell the model to request it.
2. **Root outlines?** Recommended yes, as the ticket asks, in `obstacles.groups[].roots`, without
   the generated roots.
3. **Polygon or ranges?** Recommended the polygon `outline` with `bottomMm`/`topMm`: a rotated
   object or an L-shaped group needs it, and the points compare directly with the walls' `start`/`end`.
   If models struggle with the arithmetic, the server can add axis-aligned `x`/`z` ranges in
   `agentFacing…` later, as it added the wall names.
4. **Rooms?** The obstacle map is plan-wide; the proposal lists the obstacles without a room index.
   A `roomIndex` can be added by the server with `roomOfPoint` (`plan-space.ts:500`) once a plan with
   several rooms calls for it.

## Limits and risks

- **Size.** A door or a window is about 150 characters, a group with its roots about 100 per root;
  the default test room with two kitchens comes to under 3 kB beside the 50 kB of `groups`.
- **Chaining.** The segments of an object are merged only where collinear; chaining by point indices
  yields the polygon as long as the outline is simple, which the kernel's outline is. To verify on
  the ticket's plan (`ps_qwm5odi6tyflyqwpdcxz1la791ho633`, library Furniture_Smith) and the default
  test room.
- **Kernel cost.** `getObstacleMap` refreshes the placement validator when the plan changed — the
  same work the planner does for snapping; no new kernel API is needed.
- **Hidden objects** are not in the map; the agent does not plan around what the user cannot see.

## Verification

- roomle-ui: the unit tests above, `tsc` clean; live with a roomle-ui worktree against the example:
  the default test room lists the door at x 4815 between z 1180 and 280 with `bottomMm` 0, the window
  on the back wall between x 1650 and -450 with `bottomMm` 950 and `topMm` 2100, every HI group with
  its id and an outline that matches its `position`, no walls; the ticket's plan lists its objects.
- roomle-hi-example: the server tests above; `npm run typecheck`, `npm run lint`, `npm run format:check`;
  "test the mcp" with a prompt that touches the window wall ("add a group of 4 cabinets to the wall in
  the back" with wall units) — the agent keeps the wall units off the window and says so.

## Code and documents the work would touch

| Repository | Files |
|---|---|
| roomle-ui | `packages/web-sdk/packages/planner-core/src/roomle-planner.ts`; `packages/web-sdk/packages/homag-intelligence/src/glue-logic.ts`, `api.ts`, `hi-plan-context.ts`, `external-object-api.ts`; tests `__tests__/hi-plan-context-test.ts`, `__tests__/glue-logic-test.ts`, `planner-core/__tests__/roomle-planner.ts` |
| roomle-hi-example | `hi-mcp/hi-mcp-server/tool-executors.ts`, `hi-mcp-server.ts`; tests `tests/hi-mcp-server.test.ts`, `tests/tool-executors.test.ts`; `hi-mcp/docs/hi-mcp-behaviour.md`; `minimal-hi-example/docs/hi-mcp-server.md`; `hi-mcp/hi-mcp-server/README.md`; `.agents/skills/hi-mcp-tools.md`, `roomle-hi-concepts.md`, `hi-authoring-rules.md`; `AGENTS.md` |
| RoomleCore | nothing — `getObstacleMap` is in the web API |
| ligna-store, example page, `hi-mcp-client` | nothing — no new planner method |
