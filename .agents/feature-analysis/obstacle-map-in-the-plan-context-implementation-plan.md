# RML-18036: implementation plan — the obstacles section of the plan context and its unit tests

> **Type**: Implementation plan (step 4 of the [change workflow](../../AGENTS.md#suggested-change-workflow))
> **Analysis**: [obstacle-map-in-the-plan-context.md](obstacle-map-in-the-plan-context.md) — the findings, the design and the alternatives this plan builds on
> **Date**: 2026-10-06
> **Author**: AI Assistant
> **Status**: Open — waiting for the review (step 5)
> **Branches**: `feat/hi-plan-obstacles-RML-18036` in roomle-ui (from `feat/hi-row-edit-commands-RML-18045`, `d5effc991`) and in roomle-hi-example (from `feat/hi-row-edit-tools-RML-18045`, `8e1fc2f`, carries the analysis and this plan); none in the ligna-store — it needs no change
> **Scope**: the branches build on the RML-18045 branches, which are not released, so this work is verified locally the same way — the roomle-ui dev server of the branch, the example page with `server_url`. Nothing is pushed, merged or released until the user says so

---

## Assumptions

The four open questions of the analysis, answered as it recommends. The review confirms or changes
them; the commits they affect are named.

1. **`obstacles` is a default section** of `get-plan-context`. roomle-ui commit 2, roomle-hi-example
   commit 2.
2. **Root outlines are included**, per HI group, without the generated roots (worktop, toe kick).
   roomle-ui commit 2.
3. **Polygon outlines with `bottomMm` and `topMm`**, no axis-aligned ranges. roomle-ui commit 2.
4. **No room index on the objects.** Doors and windows get the room and the wall they lie in from
   the server (finding 2). roomle-hi-example commit 2.

## What the planning added to the analysis

A headless probe of `getObstacleMap` on 2026-10-06 (local planner of the base branch, example page)
read the kernel's map for the default test room (`ps_8jjg0zezlblb48vzn8qas9vwwn7fqbg`: a door, a
window, no HI group) and for the ticket's plan (`ps_qwm5odi6tyflyqwpdcxz1la791ho633`: 2 HI groups,
26 objects, 3 doors). It changed two parts of the design.

1. **The kernel's outline of an HI group is not where the group stands.** Group `c2b9fe06…`
   (10 roots on the right wall, flush in the back right corner) has the obstacle outline x 2687 to
   3248, z 2563 to 6563. Its parts span x 2623 to 3248, z 2314 to 6563. The kernel's own plan
   overview (`dimensions` 4259 × 587, centre z 4444) and the plan context (`pos` z 2314.05,
   `footprint.widthMm` 4259.36) agree with the parts. The map starts 249 mm after the corner and is
   64 mm too shallow. Group `3440804f…` is 109 mm too short and 56 mm too shallow in the same way. So
   the outlines of the groups and their root modules come from the parts of the calculated groups,
   the same data as `position.footprint` and the server's `place-group` geometry. The obstacle map
   supplies everything that is not an HI group. For those objects its outlines are exact: they equal
   `getGroundContoursOfObjects`. A group entry carries no outline of its own: the group is the union
   of its root modules, and a bounding box would block the free inner corner of an L. Why the kernel
   outline differs is a RoomleCore question outside this ticket (see
   [Considered and rejected](#considered-and-rejected-plan-level)).
2. **Doors and windows lie in the wall, not in the room.** The window of the default room has the
   outline z -3885 to -3765 behind the back wall (z -3765), the door x 4815 to 5825 behind the right
   wall (x 4815). Every door of the ticket's plan lies outside the room too. Their outlines only touch
   the room, so the overlap test the analysis proposed for the served rules never flags a cabinet in
   front of a window. Doors are already covered: the walls array splits a wall at a door and gives
   the door its own entry of type `opening`, so a row inside one wall entry never covers a door.
   Windows split nothing. The server therefore adds three fields to every door and window: the
   `roomIndex` and the `wall` it lies in — the two arguments `place-group` takes — and `fromEndMm`,
   its span along that wall measured from the wall's end. That span is the `d` of the placement
   formula `posGroup = end + d * (start - end) / lengthMm`, so the agent compares it with its own
   placement directly.
3. **roomle-ui types the kernel API itself.** `packages/web-sdk/packages/typings/planner.ts` does not
   declare `getObstacleMap`. The installed kernel (`roomle-core-hsc` 3.1.0-alpha.3) binds it: the
   method is in `RoomleCore.wasm` and in its `plannerCoreInterface.d.ts`. So the typings gain the
   method and its DTOs, and the core needs no upgrade.
4. **There are three implementations of `RoomDesignerRequests`, not one.** Besides `api.ts`, the
   logging wrapper `debug-logging.ts` forwards every request, and `__tests__/__mocks__.ts` mocks it.
   All three gain the new request.
5. **The chaining holds on real data.** Every object chains into one closed loop: 4 segments, 8 for
   the two doors with a frame. Walls come as open face segments and are dropped. A merge can swap a
   segment's `p0` and `p1` (`mergeObstaclesIfIntersecting`), so the chain is walked undirected.
   Points are unique in the map (`UniqueIndices2d`), so neighbouring segments share their index.
6. **The objects are typed, the ticket does not need it.** Every plan object has an object type
   (`table`, `seating`, `sofa`, `lighting`, `decoration`, `storage`, `garden`, `door`, `window`).
   `kind` stays `door`, `window` or `object`, as the ticket asks. The height range tells the
   remaining cases apart: a rug (`decoration`) spans 0 to 20 mm, the pendant lamps over the dining
   table 1525 to 2800 mm.
7. **Naming.** The list of objects is `obstacles.objects`, not `obstacles.obstacles`.

## The section

roomle-ui returns it in the coordinate system of the plan context: floor points `[x, 0, z]`, like a
wall's `start` and `end`, millimetres, rounded to 0.01. The values below are from the probe.

```json
"obstacles": {
  "objects": [
    { "kind": "window", "outline": [[1650, 0, -3885], [-450, 0, -3885], [-450, 0, -3765], [1650, 0, -3765]],
      "bottomMm": 950, "topMm": 2170 },
    { "kind": "object", "outline": [[-3545, 0, 5532], [-1545, 0, 5532], [-1545, 0, 4632], [-3545, 0, 4632]],
      "bottomMm": 0, "topMm": 740 }
  ],
  "groups": [
    { "id": "c2b9fe06-9bef-4fb3-b7bf-c44f72ce09aa",
      "roots": [
        { "id": "<root id>", "outline": [[2623, 0, 2314], [3248, 0, 2314], [3248, 0, 3163], [2623, 0, 3163]],
          "bottomMm": 1, "topMm": 2200 }
      ] }
  ]
}
```

The server adds to the window `"roomIndex": 0, "wall": <index>, "fromEndMm": [<from>, <to>]`.

## roomle-ui — branch `feat/hi-plan-obstacles-RML-18036`

Every commit passes `CI=true npm run test -- --run packages/homag-intelligence packages/planner-core`
in `packages/web-sdk`, the typecheck and the lint (`npm run` scripts only).

### Commit 1 — `feat: read the obstacle map of the plan`

- `packages/web-sdk/packages/typings/planner.ts`: `CORE_OBSTACLE_TYPE` (`GLOBAL` 0, `OBJECT_WITH_ID`
  1, `CONSTRUCTION_WITH_ID` 2), `ObstacleType`, `Obstacle2d`, `ObstacleMap2d` as the kernel declares
  them, and `getObstacleMap(plan: Plan): ObstacleMap2d` on the `PlanModelViewHelper` interface beside
  `getExternalRoomInformation`.
- `planner-core/src/roomle-planner.ts`: `_getExternalPlanObstacles()`, beside
  `getExternalRoomInformation`. It returns `convertCObject(getObstacleMap(plan))` together with
  `kinds`, the kind of every id that a segment other than `GLOBAL` names. The kind comes from the plan
  element of `getPlanObjectForRuntimeId(id)`: `isExternalObject()` gives `group`;
  `getObjectCategory()` gives `door` (`DOOR`), `window` (`WINDOW`) or `object` (anything else), the
  way `isDoorOrWindowConstruction` reads it. The method does no shaping. The underscore follows
  `_mergeExternalObjects`: the glue logic calls it, and it is not part of the documented API.
- `homag-intelligence/src/external-object-api.ts`: the type `ExternalPlanObstacles`
  (`points`, `obstacles`, `kinds`) beside `ExternalRoomInformation`.
- Test (`planner-core/__tests__/roomle-planner.ts`, the `getExternalRoomInformation` pattern): a
  mocked `getObstacleMap` with the segments of a wall, a door, a window, a chair and an HI group, plus
  stubbed view models. The result checks the map passed unchanged, the kinds `door`, `window`,
  `object` and `group`, and that the wall id gets no kind.

### Commit 2 — `feat: add the obstacles section to the plan context`

- `glue-logic.ts`: `getPlanObstacles(): Promise<ExternalPlanObstacles>` on `RoomDesignerRequests`.
  `getPlanContext` fetches it when `obstacles` is included. The calculated groups are fetched when
  `groups`, `articles` or `obstacles` is included — one fetch for all three. It sets
  `context.obstacles = shapeObstacles(planObstacles, calculatedGroups)`.
- `api.ts` forwards the request to `_getExternalPlanObstacles()`, `debug-logging.ts` logs and forwards
  it, and `__mocks__.ts` returns an empty map.
- `hi-plan-context.ts`:
  - Types: `HiPlanObstacle` (`kind`, `outline`, `bottomMm`, `topMm`), `HiPlanRootOutline` (`id`,
    `outline`, `bottomMm`, `topMm`), `HiPlanGroupObstacles` (`id`, `roots`) and `HiPlanObstacles`
    (`objects`, `groups`).
  - `rootFootprintPoints` becomes `rootPoints` and returns the root's points in group space in 3D.
    The size fallback gets the `h` attribute as its height. `groupFootprint` reads their x and z, so
    its results do not change, and the existing `groupFootprint` tests guard the refactoring.
  - `shapeObstacles(planObstacles, groups)`:
    - It drops the `GLOBAL` segments and the segments of ids of kind `group`.
    - It sorts the remaining segments by their id. The kernel merges only segments of the same
      object, so every segment names one object.
    - It chains each object's segments by their point indices into a closed loop, walked
      undirected. When the segments do not form one loop, the outline is the bounding rectangle of
      their points, so an obstacle is never dropped.
    - It converts `(x, y)` to `[x, 0, -y]`, rounded with `round2`, and takes `bottomMm` and `topMm`
      from the segments.
    - Per calculated group and per root module that is not generated, the outline is the four
      corners of the box of its points. The box is measured in group space and turned into room
      space with the group's `pos` and `rotationY` (`transformPointByRoot`). The vertical range is
      its lowest and highest point in room space. A root module without points is left out.
- `external-object-api.ts`: `HiPlanContextSection` gains `'obstacles'`, `HiPlanContext` gains
  `obstacles?: HiPlanObstacles`, and the JSDoc of `getExternalObjectPlanContext` names the section.
  The web-sdk index exports the types already.
- Tests (`__tests__/hi-plan-context-test.ts`, `describe('shapeObstacles')`):
  1. The walls and the kernel outlines of the HI groups are dropped.
  2. A door, a window and a chair become closed outlines in `[x, 0, -y]`, with kinds, `bottomMm`,
     `topMm` and no `-0`. A segment with swapped `p0` and `p1` still chains.
  3. An object whose segments form no loop gets the bounding rectangle of its points.
  4. The root outlines of a group at `rotationY` 270 match the probe's numbers for the first root
     (x 2623 to 3248, z 2314 to 3163, 1 to 2200 mm). A worktop and a toe kick are left out.
  5. A root module without parts falls back to its `dockInfos`, then to its `b`, `t` and `h`
     attributes.
- Tests (`__tests__/glue-logic-test.ts`, `describe('getPlanContext')`):
  1. `getPlanObstacles` is called only when `obstacles` is included; `['groups']` does not call it.
  2. `obstacles`, `groups` and `articles` together make one `getPosDataOfAllGroups` call.
  3. With no `include`, the context contains `obstacles`.

## roomle-hi-example — branch `feat/hi-plan-obstacles-RML-18036`

Every commit passes `npm test`, `npm run typecheck`, `npm run lint` and `npm run format:check` in
`hi-mcp`.

### Commit 1 — `docs: plan the obstacles section of the plan context`

This plan, linked from the analysis and the two indexes.

### Commit 2 — `feat: obstacles in the plan context of the hi mcp`

- `tool-executors.ts`:
  - `obstacles` joins `PLAN_CONTEXT_SECTIONS` and `DEFAULT_SECTIONS`.
  - When `obstacles` is requested without `rooms`, the executor fetches `rooms` too and leaves them
    out of the result.
  - `agentFacingObstacles(obstacles, rooms)` runs after `agentFacingRooms`. It gives every door and
    window `roomIndex`, `wall` and `fromEndMm`, and passes everything else through unchanged.
  - A planner without the section — an older roomle-ui, the ligna-store's INT build — returns
    none, and the tool works as it does today.
- `plan-space.ts`: `wallOfOpening(outline, rooms)`, built on `spanAlongWall`.
  - A wall qualifies when the outline touches its line — its nearest point lies within the wall's
    thickness, or within 1 mm when the wall has none — and its span along the wall overlaps the wall
    by more than 1 mm.
  - The wall with the longest overlap wins.
  - `fromEndMm` is `[lengthMm - to, lengthMm - from]` of that span, clipped to the wall.
- `hi-mcp-server.ts`, served text in the words of the rules, shorter rather than longer:
  - The `get-plan-context` description names the section. `include` lists it, and the default it
    states becomes "rooms, articles, groups and obstacles".
  - `INSTRUCTIONS` step 1 names the obstacles.
  - A new rule after the walls rule: "obstacles lists what stands in the room, in the coordinates of
    the walls: objects — doors, windows, other furniture — with their kind, outline and bottomMm to
    topMm, and per group its root modules with their outline and height range. A root module cannot
    stand where an object or a root module of another group overlaps it both in the outline and in
    the height range. A door or a window lies in a wall (roomIndex, wall, fromEndMm — its span along
    the wall, measured from the wall's end like d): keep that span free from the floor for a door,
    and from the window's bottomMm for a window — base units lower than bottomMm fit below it, tall
    units and wall units do not."
  - The walls rule ("Anywhere else … any free point on the floor") and the extending rule ("a free
    stretch of wall or a free spot in the room") point to `obstacles` for what is free.
  - The verify rule names the root outlines of `obstacles` as the room-space check of a result.
- Tests:
  - `tests/tool-executors.test.ts`:
    1. The default sections now include `obstacles`; the two tests that list them are updated.
    2. The section passes through, and the window gets `roomIndex`, `wall` and `fromEndMm` from a
       fixture of the default room.
    3. A request for `obstacles` alone fetches `rooms` and returns only `obstacles`.
    4. A context without the section returns no `obstacles` and raises no error.
    5. A chair gets no wall.
  - `tests/plan-space.test.ts`, `wallOfOpening`: it picks the wall with the longest overlap, measures
    from the wall's end, ignores a wall that only touches at a corner, and returns nothing for an
    outline away from every wall.
  - `tests/hi-mcp-server.test.ts`: the description, the `include` text and the rules name the
    section and the door and window rule.
- Docs, in the same commit:
  - `hi-mcp/docs/hi-mcp-behaviour.md`:
    - §5.4: the `obstacles` row and the default sections.
    - §5.5: root geometry is withheld in `groups`; the read-only root outlines of `obstacles` are
      the exception.
    - §6: the `include` type.
    - §8.2: C21 for the wall of a door or window, beside C18.
    - §3: decision D45 — the section is a default; group outlines come from the parts, not the
      kernel map; walls are dropped; doors and windows carry their wall.
  - `minimal-hi-example/docs/hi-mcp-server.md` (get-plan-context, positioning).
  - `hi-mcp/hi-mcp-server/README.md`.
  - `.agents/skills/hi-mcp-tools.md`, `roomle-hi-concepts.md`, `hi-authoring-rules.md`.
  - `AGENTS.md` (the get-plan-context line of "Testing Tool Calls").

### Commit 3 — `test: obstacles in the mcp test prompts`

`docs/test-prompts.json` (and `docs/test-prompts.md`) gain the plan `furnished-room`
(`ps_qwm5odi6tyflyqwpdcxz1la791ho633`) and three tests:

| id | plan | prompt | expect |
|---|---|---|---|
| `obstacle-window-back-wall` | default-room | add four base cabinets with wall cabinets above them on the back wall | the base units may run below the window; no wall unit or tall unit overlaps the window's span; the answer names the window |
| `obstacle-left-wall-furniture` | furnished-room | add a row of three tall cabinets on the left wall | the row stands where the left wall is free: clear of the storage unit and the table that stand against it, and of the wall lamp above the storage unit |
| `obstacle-island-free-spot` | furnished-room | add a kitchen island of three base cabinets in a free spot of the room | the island's outline overlaps no object and no group |

## ligna-store — no change

The section arrives through `getExternalObjectPlanContext`, which is on the store bridge's
allow-list (`ligna-store/hi-mcp/browser-bridge.ts`). The store's INT build of roomle-ui returns no
`obstacles` until a roomle-ui release carries them. The server handles the missing section, and the
store needs no check of its own.

## Order of the work — local only

1. roomle-ui commit 1, then commit 2, each with its tests, typecheck and lint.
2. Live check against the roomle-ui dev server of the branch, with the probe of this plan:
   - The default room lists the window and the door as in [The section](#the-section).
   - The ticket's plan lists its 26 objects and 3 doors, and both groups with root outlines that
     match their `position` and their walls.
   - No wall and no kernel group outline appear.
3. roomle-hi-example commit 2, then `get-plan-context` live over the MCP client: the window carries
   its wall and its span from the back wall's end.
4. "test the mcp" with the three new tests and the default-room tests, gpt-5-mini first and the
   user's models after. Commit 3.
5. Close-out in this plan, and the results as a comment on RML-18036.

## Considered and rejected (plan level)

| Alternative | Why not |
|---|---|
| Group outlines from the obstacle map, as the analysis proposed | 50 to 250 mm off on the ticket's plan (finding 1) |
| A group outline as the bounding box of its root modules | It blocks the free inner corner of an L-shaped group; the root outlines are exact |
| The overlap rule alone for doors and windows | Their outlines lie behind the wall and only touch the room (finding 2) |
| The wall of a door or window derived in roomle-ui | The wall index and the span from the wall's end are the server's placement vocabulary (`place-group`, the `posGroup` formula); the roomle-ui section stays a plain obstacle map in room space |
| Dropping flat objects (a rug) | The planner's map lists them, and the height range shows what they are |
| The object type (`table`, `sofa`) as `kind` | The ticket does not need objects identified; it is one field to add later |
| A hint when a new group overlaps an obstacle (as D43 does for groups) | The next step once the agent reads the section; not part of this ticket |
| Investigating the kernel's group outline | RoomleCore, outside this ticket; the plan does not depend on it. Worth a ticket of its own: the kernel's placement validation uses the same outline |

## Definition of done

- roomle-ui: `getExternalObjectPlanContext()` returns `obstacles`, with the doors, windows and other
  furniture as outlines and height ranges, and the HI groups as room-space root outlines from their
  parts. The tests above pass, and so do the typecheck and the lint.
- roomle-hi-example: `obstacles` is a default section, every door and window names its wall and its
  span, and the served text and the docs describe both. The tests pass, and the MCP test shows the
  agent keeping wall units off the window and the island off the furniture.
- Nothing is pushed, merged or released.
