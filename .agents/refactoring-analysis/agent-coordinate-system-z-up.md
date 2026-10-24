# The agent works in the planner's coordinate system

> **Type**: Refactoring analysis
> **Status**: Open
> **Date**: 2026-10-24
> **Base**: roomle-hi-example `master` `36343fd`; roomle-ui `master` `7e2e54fb3` (`release/bo-test`
> `1d9adf51e` differs in the HI code only by the wording of two relation rules, no coordinates);
> RoomleCore `master` `ab26fa3c7`
> **Plan**: [RML-18295](https://roomle.atlassian.net/browse/RML-18295) comment 156490, checked
> against roomle-ui `feat/hi-mcp` `5d4a0f314`

## Affected repositories

- **roomle-ui** — the HI tool set (`hi-mcp/`): one conversion module between the agent's frame and
  pos space at the tool dispatch, the renamed rotation and footprint fields, the served rules and tool
  descriptions; the feedback texts of the HI tool commands that name a coordinate field
  (`hi-tool-payload.ts`, `hi-tool-commands.ts`); the doc comment of `getExternalObjectPlanContext`;
  the tests; `.agents/homag-intelligence/`, `coordinate-systems.md` first. The plan context, the HI
  geometry and the tool commands keep pos space.
- **roomle-hi-example** — the skills `hi-mcp-tools.md`, `hi-authoring-rules.md`,
  `roomle-hi-concepts.md`, `hi-mcp-testing.md`; the positioning line of `AGENTS.md`; the placement
  example of `docs/test-prompts.md`; `extract-run-facts.js` and its test, which read
  `position.rotationY`.
- **embedding-lib** (in roomle-ui) — unchanged. `createHiMcpTools` forwards the calls and serves no
  text of its own, so no new version is needed.
- **ligna-store** — unchanged. No code of it names a coordinate; it gets the new frame with the
  planner (the bo-test deployment).
- **RoomleCore** — unchanged. Its plan space is the target frame; `ModuleGroupCoordinateConverter`
  keeps converting the HI group JSON.
- **HOMAG library** — unchanged. The HI group JSON (`PosGroup`) keeps its frame, y up.

Paths: `hi/…` is roomle-ui `packages/web-sdk/packages/homag-intelligence/src/`, `hi-mcp/…` its
`hi-mcp/` folder, `__tests__/…` `packages/web-sdk/packages/homag-intelligence/__tests__/`; RoomleCore
paths start with `src/`.

## Summary

- The agent works in *pos space*: millimetres, **y up**, the floor in `x` and `z`, where `z` is the
  kernel's `−y`. The planner's data — the room contour, the obstacle map, the plan objects, the wall
  API — is RoomleCore's *plan space*: millimetres, **z up**, the floor in `x` and `y`.
- **The rotation does not turn the other way.** Pos space and plan space differ by a proper rotation
  (+90° about `x`), so the same angle turns a group the same way in both, counter-clockwise as seen
  from above, and the kernel takes the agent's `rotationY` unchanged as its yaw. What differs is the
  formula: written in pos-space coordinates, the counter-clockwise turn carries the signs of a
  clockwise one, because `+z` points down in the top view, and every direction angle the code derives
  in pos space has a flipped sign. D13 records the same result; the code confirms it (1.2).
- `coordinate-systems.md` is correct in substance. It misses the docking `offset` in `contextData`,
  which the agent reads and sends back, and it does not name the planner's own frames; three smaller
  points are listed in section 2. All of them are fixed in roomle-ui `feat/hi-mcp` `5d4a0f314`.
- **Proposal**: the agent reads and writes plan space. One module of the HI tool set converts every
  coordinate the agent reads or writes, at the tool dispatch. The rotation fields are renamed from
  `…RotationY` to `…RotationZ` and the footprint's `z` range becomes a `y` range; the served text and
  the feedback speak plan space. Rotation values stay as they are. The geometry of roomle-ui and the
  planner methods keep pos space.
- Four decisions are open (section 7): the names, the angle unit, where the conversion sits, and
  `posGroup`.

## 1. What the current code does

### 1.1 The frames

| Frame | Units | Up | Floor | Where |
|---|---|---|---|---|
| **Plan space** (RoomleCore) | mm, radians | `+z` | `x`, `y`; the back wall at the largest `y` | the kernel; the room contour and the obstacle map the HI tools read; the planner's data and wall API — `getObjects` (`center`, `rotation`, `typings/kernel.ts:344-363`), `drawWalls` (`WallDefinition.from`/`to` go straight into `addNode`, `planner-core/src/roomle-planner.ts:229-233`, `:1608-1648`; `typings/planner.ts:493-495`) |
| **three.js frame** (roomle-ui scene) | m, radians | `+y` | `x`, and `z` = plan `−y` | the scene; `insertObject` and `createPlanFromObject` take a position "x (left/right), y (up, down) and z (front, back) in meters" and convert it with `convertToKernel` (`roomle-planner.ts:1035-1060`, `common-core/src/utils/kernel-utils.ts:25-43`) |
| **Pos space** (the agent) | mm, degrees | `+y` | `x`, and `z` = plan `−y` | the HI group JSON (`PosGroup`), the plan context of the HI tools, every number the agent reads or writes |
| Group, root and parent-local space | mm, degrees | `+y` | local `x`, `z`; `+z` the front | root positions, docking offsets, interior fittings |

Pos space is the three.js frame in millimetres. The planner already has two frames: its data and its
wall API are plan space, its placement API for catalog items is the three.js frame.

### 1.2 Verification: the axes and the rotation

**The axes.** `ModuleDefinitionToModelCoordinateSystemTransformation`
(`src/shared/core/module-group-coordinate-converter.h:9-18`) holds the row-major matrix
`{1,0,0,0, 0,0,−1,0, 0,1,0,0, 0,0,0,1}`: a pos-space point `[x, y, z]` is the plan-space point
`(x, −z, y)`. Its determinant is +1 — a rotation by +90° about `x` —, so both frames are
right-handed and nothing is mirrored. roomle-ui applies the same mapping in three places
(`hi/hi-plan-context.ts:743-754` for the contour, `:966` for the obstacle outlines, `hi/api.ts:183-187`
for the installation elements), and for the three.js frame in `kernel-utils.ts:4-11` and `:25-43`.

**The rotation.**

- Pos space: `MatrixHelper::rotateRollAndTranslate` (`src/util/geometry/matrix.cpp:670-684`), roomle-ui's
  `rotatedAboutY` (`hi/hi-group-placement.ts:175-183`) and `transformPointByRoot`
  (`hi/hi-plan-context.ts:412-427`) and three.js `makeRotationY` turn a point by
  `[x cos θ + z sin θ, y, −x sin θ + z cos θ]`.
- Plan space: `newTransformationFromOriginAndYawOrientation` (`src/util/geometry/coordinate-converter.cpp:82-92`)
  turns by `rotationMatrixAxis(Vector3::UP, θ)` (`matrix.cpp:788-…`, `UP = (0, 0, 1)` in
  `src/util/geometry/vector-3.cpp:18`), the right-hand rotation `[x cos θ − y sin θ, x sin θ + y cos θ, z]`.
- The converter maps the yaw axis `+y` to `+z` with the angle scale 1
  (`module-group-coordinate-converter.cpp:11-17`). The deserializer reads `rotationY` in degrees
  (`src/configurator/external/deserializer/external-module-group-deserializer.cpp:63-68`, `:105-110`),
  and `ModuleGroupDefinition::update` takes it unchanged as the yaw
  (`src/configurator/external/definition/external-module-group-definition.cpp:158-167`).

| | Pos space (the agent today) | Plan space (the planner) |
|---|---|---|
| Turn by θ | `[x cos θ + z sin θ, y, −x sin θ + z cos θ]` | `[x cos θ − y sin θ, x sin θ + y cos θ, z]` |
| Seen from above | counter-clockwise | counter-clockwise |
| Local `+x` at 90° | room `−z`, towards the back wall | room `+y`, towards the back wall |
| Local front at 90° | room `+x` | room `+x` |
| Facing of a wall with direction `d` | `atan2(d_z, −d_x)` (`hi/hi-plan-context.ts:817`) | `atan2(−d_y, −d_x)` — the wall's direction turned by 180° |
| Back, left, front, right wall | 0, 90, 180, 270 | 0, 90, 180, 270 |

The assumption that the rotation turns the other way does not hold: an angle means the same turn in
both frames. What makes it look that way: in the `(x, z)` plane drawn with `z` upwards, the
pos-space formula is a clockwise turn; it is counter-clockwise only because `+z` points down in the
top view. The code that derives an angle from a direction in pos space carries that flip —
`atan2(d_z, −d_x)` in `deriveWalls`, `atan2(−dz, dx)` in `cornerTurnOf`
(`hi/hi-group-placement.ts:187-198`), `rotateDirection` (`hi/hi-plan-space.ts:352-361`). In plan space
they become the textbook formulas.

The planner UI shows the kernel's rotation in degrees, counter-clockwise
(`src/planner/components/overlays/product-settings/ProductRotation.vue:66-76`; the indicator turns by
CSS `rotate(−deg)`, `src/planner/components/RotationButtonWrapper.vue:16`). For an HI group its number
can still differ from the agent's `rotationY`: the agent reads the rotation of the placement frame —
group, anchor root and corner turn, normalised to 0–360 (`positionInPlacementFrame`,
`hi/hi-group-placement.ts:320-350`) —, the planner the yaw of the raw group, which after a reload can
be −90 instead of 270 or belong to another root. The sense is the same, the reference differs. The
target shape keeps this; it is no question of the frame.

### 1.3 Why it is a problem

- **Two frames once the agent edits the plan.** Tools for walls, doors or other plan objects will
  call the planner's data and wall API, which is plan space (`drawWalls`, `addNode`, `getObjects`).
  With pos space for the HI groups, the agent would switch frames between tools, or every new tool
  would convert on its own.
- **The agent's numbers are not the planner's.** A wall corner the planner holds at `(x, y)` is
  `[x, 0, −y]` for the agent, and the height of a contour level sits in the middle of the point.
- **Up in the top view is `−z`.** Every direction the agent works out from an image or a description
  ("in front of the window", "towards the back") carries a sign flip, and so does the `atan2` of a
  direction. In plan space the top view and the numbers agree: `+x` right, `+y` up.

## 2. Validation of coordinate-systems.md

roomle-ui `.agents/homag-intelligence/coordinate-systems.md`, checked against roomle-ui `master`
`7e2e54fb3` and RoomleCore `master` `ab26fa3c7`.

| Section | Claim | Result |
|---|---|---|
| 1.1 | Pos space: mm, right-handed, `+y` up, `z` = kernel `−y`; top view `+x` right, `−z` up | correct — the matrix of 1.2, `convertContourSegment` |
| 1.1 | The rotation formula, counter-clockwise from above, equal to the kernel's yaw | correct (1.2); confirms D13 |
| 1.1 | The wall table: the contour runs counter-clockwise with the room on its left; `facingRotationY` 0/90/180/270 | correct — `deriveWalls` and its test (`__tests__/hi-plan-context-test.ts:100-145`: the kernel contour `(3000, −3000) → (3000, 3000) → (−3000, 3000)` gives the right wall front → back, then the back wall) |
| 1.1, 2 | Group space: only `dockTo.offset` | **incomplete** — every root of a group the agent reads carries `contextData.dockedRoots[].dockedRoots[].offset`, a group-space vector (`stripDockingIndices`, `hi/hi-plan-context.ts:381-397`). The agent sends it back when it resubmits a group (`hi/hi-tool-payload.ts:19-20`), and the layout uses it (`hi/hi-group-layout.ts:121`, `:354-391`) |
| 1.2 | The quotes of the tool descriptions and the authoring rules | correct — `hi-mcp/hi-mcp-server.ts:34-37`, `:41`, `:199`, `:318-344`, `:468-476`, `:512`, `:529-555`, `:724`, `:758-762` |
| 2 | The walls of `get-plan-context`: `start`, `end`, `lengthMm`, `facingRotationY`, `side`, `name`, `index` | **incomplete** — also `type`, `heightMm` and `thicknessMm` (`hi/hi-plan-context.ts:819-829`); none of them a coordinate |
| 3.1 | The kernel's conversion, `ModuleGroupDefinition::update`, plan XML version 2 | correct; the deserializer is in `src/configurator/external/deserializer/`, not beside the definition |
| 3.2–3.6, 3.8–3.11 | The functions and their files | correct — every named function is in the named file |
| 3.7 | `WALL_STRIP_MM` among the functions of `hi-plan-space.ts` | **misplaced** — it is defined in `hi/hi-wall-placement.ts:188` |
| — | The planner's own frames | **missing** — the document compares pos space with the kernel only. The planner's data and wall API (plan space) and its placement API `insertObject` (three.js frame, metres) are the frames a plan-editing agent meets |

These points are fixed in roomle-ui `feat/hi-mcp` `5d4a0f314`. The refactoring rewrites
`coordinate-systems.md` for plan space (section 5).

## 3. The target shape

### 3.1 The agent's frame is plan space

| Property | Value |
|---|---|
| Units | millimetres; angles in degrees |
| Handedness | right-handed |
| Up | `+z`; the floor of the room is `z = 0` |
| Top view | `+x` to the right edge, `+y` to the upper edge |
| Back wall, front wall | the largest `y`, the smallest `y` |
| Origin and axes | the kernel's: a point the planner holds at `(x, y, z)` is `[x, y, z]` for the agent |
| Rotation | about `+z`, counter-clockwise as seen from above, `[x cos θ − y sin θ, x sin θ + y cos θ, z]`; the same values as today |
| Local frame of an article, a group, a parent module | `+x` right as seen from the front, `+z` up, `y = 0` the back, the front towards `−y` |

The local frame follows from the same mapping and keeps *right as seen from the front* at `+x`. A
front towards `+y` would either mirror the frame (left-handed) or turn right into `−x`.

One conversion serves room points, group-space and parent-local vectors alike: a pos-space
`[x, y, z]` is `[x, −z, y]` in plan space, a plan-space `[x, y, z]` is `[x, z, −y]` in pos space.
Angles pass unchanged.

### 3.2 What the agent reads and writes

| Where | Today (pos space) | Target (plan space) |
|---|---|---|
| `rooms…segments[].pos` | `[x, level, z]` | `[x, y, level]` — the kernel's contour point at its level |
| `walls[].start`, `end`; the `wall` of a `place-group` result | `[x, 0, z]` | `[x, y, 0]` |
| `walls[].facingRotationY`; the same of the `place-group` `wall` | 0, 90, 180, 270 | `facingRotationZ`, same values |
| `corners[].point`, `posRotationY` | `[x, 0, z]`, degrees | `[x, y, 0]`, `posRotationZ` |
| `obstacles.objects[].outline`, `obstacles.groups[].roots[].outline` | `[x, 0, z]` | `[x, y, 0]` |
| `installationElements[].position` | `[x, level, z]` | `[x, y, z]` — the kernel's centre, unconverted |
| `groups[].position` | `pos [x, y, z]`, `rotationY`, `footprint { x, z, widthMm, depthMm }` | `pos [x, y, z]`, `rotationZ`, `footprint { x, y, widthMm, depthMm }` with `y` from `−depthMm` to 0 |
| `roots[].contextData…offset`, read and sent | group space, `y` up | group space, `z` up |
| `placement` of `create-or-replace-groups` | `{ posGroup: [x, y, z], posRotationY, rootId? }`; `[x, z]` completed to `[x, 0, z]` | `{ posGroup: [x, y, z], posRotationZ, rootId? }`; `[x, y]` completed to `[x, y, 0]` |
| `dockTo.offset` of `merge-article-into-group` | `[x, y, z]`, `y` the clearance; without `y` the server sets the hang gap | `[x, y, z]`, `z` the clearance; without `z` the server sets the hang gap |
| `position` of a fitting, `insertPosition` | `x` right, `y` up, `z` front; the lowest corner of the parts | `x` right, `y` towards the back, `z` up; the back left bottom corner of the parts — the same point |

Unchanged: the wall form of a placement and `place-group` (`wall`, `alignment`, `offsetMm`,
`roomIndex`), the side labels, the corner names, the top view, `fromEndMm`, `lengthMm`, `widthMm`,
`depthMm`, `gapMm`, `bottomMm`, `topMm`, `rowIndex`, the docking vector names and every rotation
value.

### 3.3 Where the conversion sits

**One module of the HI tool set, `hi-mcp/agent-frame.ts`, called by the tool dispatch `runTool`
(`hi-mcp/hi-mcp-server.ts:168-191`)**: `fromAgentFrame` on the arguments before the executor runs,
`toAgentFrame` on the result after it. Every tool call passes `runTool`. The conversion works on the
fields of 3.2, not per tool:

- results: `rooms`, `obstacles`, `installationElements`, `groups`, `group`, `wall`, `fittings` and
  `interiorFittings`. `place-group` returns a single `group`, which `inPlanner` does not pass through
  `agentFacingGroups` (`hi-mcp/tool-executors.ts:375-397`), and the `wall` it used
  (`hi/hi-tool-commands.ts:842`, `:916`); the conversion covers both. The results of `get-price`,
  `get-order-data`, `get-skill` and `get-plan-images` carry no plan coordinates and pass unchanged.
- arguments: `posGroups[].placement`, `posGroups[].repositioningData` — taken as the placement
  (`hi/hi-tool-payload.ts:744-760`) —, `posGroups[].roots[].contextData`, `dockTo.offset`,
  `insertPosition`. A value that is not a point of three finite numbers passes as it is, so the
  payload checks below the boundary report it as they do in pos space.

`fromAgentFrame` completes a floor point `[x, y]` to `[x, y, 0]` before it converts — the completion
moves out of `normalizePlacement` (`hi/hi-tool-payload.ts:166-171`), whose correction would print
pos-space numbers. An absent `dockTo.offset` stays absent: the input schema takes three numbers or
none, and `hi/hi-tool-docking.ts:208` sets the hang gap when `offset[1]` is `undefined`. Its
corrections join the result's `corrections`. `runTool` keeps logging the arguments as the agent
sent them (`sent`), so a test run reads the agent's frame.

Below `runTool` nothing changes frame: the executors, `agent-facing.ts` (corners, wall names,
`fromEndMm`), the planner methods `getExternalObjectPlanContext` and `externalObjectGroupOperation`,
the HI tool commands and the geometry (`hi-plan-space.ts`, `hi-wall-placement.ts`,
`hi-group-placement.ts`, `hi-tool-hints.ts`) keep pos space and their tests.

### 3.4 The served text and the feedback

The agent learns the frame only from the served text (`coordinate-systems.md` §1.2). Every passage
that names an axis, a point or a rotation field changes with the frame:

| Text | Where | Change |
|---|---|---|
| Authoring rules: placement, walls, room corners, obstacles | `hi-mcp/hi-mcp-server.ts:34-37` | `y up` → `z up`, `[x, 0, z]` → `[x, y, 0]`, `posRotationY` → `posRotationZ`, `facingRotationY` → `facingRotationZ` |
| Authoring rules: verify results numerically | `:41` | `(pos, rotationZ, footprint)` |
| `get-plan-context` | `:318-344` | "Y up (group pos and room contours use pos: [x, level, -y])" → z up in the planner's coordinates; the walls, groups, obstacles and installation elements as in 3.2 |
| `create-or-replace-groups` | `:468-476` | `{ posGroup, posRotationZ }` |
| `insertPosition` | `:199` | the local frame of 3.1 |
| `merge-article-into-group`, `dockTo.offset` | `:724`, `:758-762` | "a supplied y value" → "a supplied z value" |
| Feedback on a placement | `hi/hi-tool-payload.ts:70-72`, `:155`, `:178` | `posRotationZ` |
| Positions dropped from a group or a root | `hi/hi-tool-payload.ts:739-741`, `:780-783` | the fields as the agent knows them: a `rotationZ` is dropped with them |
| A group without a position | `hi/hi-tool-commands.ts:777-781` | `posRotationZ`; the text of a group placed by the unit's origin (`:617-620`) names `posGroup` only and stays |
| A root module that overlaps an object: "x … to …, z … to …" | `hi/hi-tool-hints.ts:351-358` | the `x` range and the `y` range from the negated `z` values — a text the conversion cannot reach |
| A wall that is not found: "Available walls: …" with the pos-space walls | `hi/hi-wall-placement.ts:325-329` | the walls by index and side, without points |

`place-group`, `get-plan-images` and the planning skills name no axis and stay. The text stays
library-neutral.

### 3.5 What keeps pos space, and why

- The HI group JSON is the library's format and the kernel's input (`ModuleGroupCoordinateConverter`).
- roomle-ui's HI geometry works on raw groups in that frame and on walls derived from the same
  conversion; D13, D33, D61 and D83 and their tests calibrate it. Converting it gives the agent
  nothing it does not get at the boundary.
- The planner methods `getExternalObjectPlanContext` and `externalObjectGroupOperation` are public;
  their output keeps its frame. Their doc comment (`hi/external-object-api.ts:535-547`, "designed to
  be passed to an AI agent as it is … Y up") says the HI tools hand the context to the agent in plan
  space.

## 4. Alternatives

| Alternative | Why not |
|---|---|
| **The conversion in the planner, where `inPlacementFrame` sits** (`hi/hi-tools.ts:332-340`, `:377`; `hi/hi-tool-commands.ts:326-350`, `:1447`) | Changes the output of the public `getExternalObjectPlanContext` and the arguments of `externalObjectGroupOperation`; `agent-facing.ts` (corners, `fromEndMm`) would move to plan-space math. More code and an API change for the same result towards the agent. |
| **Plan space as the working frame of all HI geometry** (`hi-plan-context.ts`, `hi-plan-space.ts`, `hi-wall-placement.ts`, `hi-group-placement.ts`, `hi-tool-hints.ts`, `hi-interior-design.ts` — about 5,300 lines, and their tests) | The raw groups stay y up, so the geometry would convert at every group point instead of once at the boundary. A candidate for later, when the wall tools and the HI tools share geometry; not needed for one frame towards the agent. |
| **Keep pos space and explain the planner's frame to the agent** | Two frames for the agent: the problem itself. |
| **The three.js frame of `insertObject`** (metres, y up) | The planner's placement API for catalog items only; its data and wall API are plan space. Metres would change every length the agent reads. |
| **Keep the names `…RotationY`** | A rotation "about y" in a z-up frame names the wrong axis, and the field names are the agent's strongest hint at the frame. |

## 5. Scope

### roomle-ui

| File | Change |
|---|---|
| `hi-mcp/agent-frame.ts` (new) | `toAgentFrame`, `fromAgentFrame` |
| `hi-mcp/hi-mcp-server.ts:168-191` | `runTool` calls them |
| `hi-mcp/hi-mcp-server.ts` | the served text of 3.4 |
| `hi/hi-tool-payload.ts:70-72`, `:155`, `:166-171`, `:178`, `:739-741`, `:780-783` | the feedback texts; the floor-point completion moves to `fromAgentFrame` |
| `hi/hi-tool-commands.ts:777-781` | the feedback text |
| `hi/hi-tool-hints.ts:351-358`, `hi/hi-wall-placement.ts:325-329` | the object hint and the list of available walls (3.4) |
| `hi/external-object-api.ts:535-547` | the doc comment of `getExternalObjectPlanContext` |
| `packages/web-sdk/packages/test-helpers/unit/hi-mcp-fixture.json` | the tool descriptions, which `hi-mcp-fixture-test.ts`, `planner-core/__tests__/roomle-planner.ts` and `tests/unit/embedding-lib/homag-intelligence/hi-mcp/hi-mcp-stream-text.spec.ts` compare |
| `__tests__/hi-mcp/`, `__tests__/hi-tool-commands/` | section 6 |
| `.agents/homag-intelligence/coordinate-systems.md` | rewritten: plan space as the agent's frame, the boundary as its one conversion, the planner's frames, the points of section 2 |
| `.agents/homag-intelligence/hi-tools-behaviour.md` | D13 restated for z up; a decision row for the agent's frame; §5, §7 and the messages of §8 |
| `.agents/homag-intelligence/tool-executors.md` | the conversion in `runTool` |
| `.agents/homag-intelligence/hi-tools-reference.md`, `layout-and-placement.md`; `.agents/homag-intelligence.md` | the field names and the frame |

### roomle-hi-example

| File | Change |
|---|---|
| `.agents/skills/hi-mcp-tools.md`, `hi-authoring-rules.md`, `roomle-hi-concepts.md` | the frame, the fields, the examples |
| `.agents/skills/hi-mcp-testing.md:235`, `:243`, `:307`, `:325-328` | `plan-context.json` comes from the `get-plan-context` tool (`window.hiAgentPlanContext`, `minimal-hi-example/index.html:998-1006`) and is plan space, as are the agent's arguments; the `repositioningData` the server sends the planner stays pos space, so a bug verdict compares `posGroup` with it as `[x, z, −y]` |
| `AGENTS.md` — Key Architecture Patterns, Authoring Rules ("`posRotationY` counter-clockwise …") | `posRotationZ` |
| `docs/test-prompts.md:74`, `:120` | the placement example `[4815, 0, -3765]`, `posRotationY: 270` → `[4815, 3765, 0]`, `posRotationZ: 270` |
| `.agents/scripts/extract-run-facts.js:143`, `.agents/scripts/tests/report-scripts.test.js` | read `position.rotationZ`, and `rotationY` of older run folders |

The historical records — benchmarks, backlog, analyses, ADR 0001 — keep their wording. Texts that
name the fields of the HI group JSON (`pos`, `rotationY`, `articlePos` of the library's format, as in
`.agents/wiki/why-the-agent-cannot-plan-what-the-library-cannot-build.md:81`) stay: that format
keeps its frame.

## 6. Tests

Tests of the affected behaviour, and the output changes to expect:

- `__tests__/hi-mcp/hi-mcp-server-test.ts` — the served text, and what the agent reads through the
  tool set (`createHiMcpTools`): every coordinate in plan space — the floor's second coordinate is
  the negated old `z`, the height comes third; `rotationZ`, `facingRotationZ` and `posRotationZ`
  carry the old values; footprint `y` ranges run from `−depthMm` to 0. The tests of
  create-or-replace-groups, place-group and the installation elements there (`:1354`, `:1537`,
  `:1615`) pass through `runTool`.
- `hi-mcp-fixture-test.ts` — unchanged itself; the fixture it compares changes with the tool
  descriptions.
- `__tests__/hi-tool-commands/create-or-replace-groups-input-test.ts`,
  `create-or-replace-groups-placement-test.ts` — the feedback texts of 3.4; the floor-point
  completion leaves `normalizePlacement` (`input-test.ts:1514-1528`); the object hint (`:2028`)
  and the list of available walls (`:2487`).
- `__tests__/hi-tool-commands/place-group-test.ts:284` — the object hint.
- Unchanged: `__tests__/hi-mcp/tool-executors-test.ts` and `interior-fittings-test.ts`, which call
  `createToolExecutors` below `runTool`, and the other tests of the geometry and the tool commands
  (`hi-plan-context-test.ts`, `hi-plan-space-test.ts`, `hi-group-placement-test.ts`,
  `placement-frame-test.ts`, `group-commands-test.ts` and the others). They test pos space below the
  boundary.

New, `__tests__/hi-mcp/agent-frame-test.ts`:

- each field of 3.2 converted to plan space and back; the round trip returns the input;
- a rotation passes unchanged; a group at 90° has its local `+x` along `+y`;
- a floor point `[x, y]` is completed to `[x, y, 0]`, with the correction;
- a `dockTo.offset` without `z` arrives without `y`, so the server sets the hang gap;
- the walls of the fixture: `start` and `end` equal the kernel's contour points;
- `runTool` logs the arguments as sent.

The agent: the served text changes for every model, so the prompt tests ("test the mcp",
`docs/test-prompts.json`) decide whether the models place as well in plan space as in pos space —
every model on one build, compared per test with its reference session, started on request. A
placement by point (an island, a group of wall units only) is where the frame shows; the wall form
does not depend on it.

## 7. Open decisions

1. **Names** — `rotationZ`, `posRotationZ`, `facingRotationZ` and a footprint `y` range
   (recommended: only the axis letter changes, and the name still says the axis), or `rotation` as
   in the planner's `getObjects`, where it is radians.
2. **Angle unit** — degrees (recommended: today's values; a model writes 90 more reliably than
   1.5708) or the kernel's radians.
3. **Where the conversion sits** — the tool dispatch (recommended, 3.3) or the planner (section 4).
4. **`posGroup`** — keep (recommended: it names the group's position, not the frame) or rename it to
   `point`.

## 8. Rollout and risks

- The HI tool set runs in the planner (ADR 0012): the change reaches the example page and the
  ligna-store with the planner deployment to bo-test; no embedding-lib build.
- The models know both conventions — y up from three.js, z up from CAD and 2D plans. Whether one
  places better than the other is for the prompt tests to show; the wall form of a placement, which
  most prompts use, names no coordinate.
- The footprint and the fittings get negative `y` ranges; the served text names the front at `−y`.
- The conversion only swaps and negates rounded values: no new rounding; `−0` becomes `0`.
