# Bug analysis — the room corners leave out a corner where an opening meets a wall

> **Type**: Bug analysis
> **Status**: Open
> **Ticket**: none
> **Date**: 2026-10-17
> **Base**: roomle-hi-example `fix/planning-skills-extension` (`40a88f6`); roomle-ui
> `fix/corner-group-window-offset-hint-RML-18201` (`822e50fb5`)
> **Backlog**: item 68 of [`../backlog/mcp-issues.md`](../backlog/mcp-issues.md)

## Affected repositories

- **roomle-hi-example**: the fix the agent sees. `roomCorners` in
  `hi-mcp/hi-mcp-server/agent-facing.ts` builds the `corners` of `get-plan-context`. The work also
  changes its test in `tests/tool-executors.test.ts`, D12 and §5.4 of
  [`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md), and removes backlog item 68.
- **roomle-ui**: the same change in its copy of `roomCorners`
  (`packages/web-sdk/packages/homag-intelligence/src/hi-plan-space.ts`) and its test in
  `__tests__/hi-plan-space-test.ts`. No tool command calls this copy, only its test does. It still
  changes, so that the two copies stay the same. The work is based on
  `fix/corner-group-window-offset-hint-RML-18201`.
- **ligna-store**: no change. The store's chat runs the same MCP server and has no copy of the
  corners.
- **RoomleCore**: no change. The contour is correct (D61).

## Symptom

The living room of the prompt tests is plan `ps_nwzhfk8bjc2gu02gsyocsdragi0rxey`, used by the tests
`sideboard-living-room-front-wall`, `living-room-sideboard-and-tv` and the random lowboard tests.
Its shape:

- It is L-shaped: the back right part reaches 1500 mm further back than the rest.
- Its front wall is floor-to-ceiling windows and a door, with a 5 mm piece of wall at the right
  end.
- Its right wall is floor-to-ceiling windows, with a 60 mm piece of wall.
- A 120 × 3600 mm partition stands free in the middle.

`rooms.rooms[0].corners` of `get-plan-context` lists seven corners. Only two of them are corners a
group can stand in:

| Corner listed | Point | What it is |
|---|---|---|
| back left | `[1935, 0, -3765]` | the inner corner of the L, where the room turns away |
| back left | `[-3185, 0, -3765]` | **a room corner** |
| back left | `[1935, 0, -5265]` | **a room corner** (the back left corner of the deeper part) |
| front right | `[1810, 0, -2550]` | a corner of the partition |
| front left | `[1930, 0, -2550]` | a corner of the partition |
| back left | `[1930, 0, 1050]` | a corner of the partition |
| back right | `[1810, 0, 1050]` | a corner of the partition |

Three room corners are missing from the list:

| Missing corner | Point | Walls |
|---|---|---|
| front left | `[-3185, 0, 2235]` | the left wall (wall 2) ends, the window of wall 3 starts |
| front right | `[6320, 0, 2235]` | the 5 mm piece (wall 9) ends, the window of wall 10 starts |
| back right | `[6320, 0, -5265]` | the window of wall 15 ends, the back wall (wall 16) starts |

The backlog names only the front left and front right corners. The back right corner is missing
too, and so is the inner corner of the L, which the list names as a room corner.

An agent that looks up a corner for a placement by point finds the wrong corner or none. For the
"front right" corner, for example, it finds the back end of the partition.

**Reproduce.** The corners depend on the walls only, so no model is needed:
`.temp/result/mcp-test-2026-10-16_18-18-00/gpt-6-astra/05-sideboard-living-room-front-wall/plan-context.json`
has the list above. The run named in the backlog (`mcp-test-2026-10-16_11-57-20`) is no longer in
`.temp/result`. In the stored runs of both living-room tests, the models placed every group by wall,
and none used the corners list.

## Investigation trace

### How the list is built

`get-plan-context` passes the rooms through `agentFacingRooms` (`tool-executors.ts:415`), which
names the walls, marks an opening as type `opening` and adds `corners: roomCorners(walls)`
(`agent-facing.ts:245-262`). `roomCorners` (`agent-facing.ts:75-112`, the same code in roomle-ui
`hi-plan-space.ts:510-547`) does three things:

1. It keeps the segments of type `wall` only: `walls.filter((wall) => wall.type === 'wall')`
   (`agent-facing.ts:81`, `hi-plan-space.ts:516`).
2. For every pair where one segment ends at the point where the other starts, it skips pairs that
   run in a straight line (|dot| > 0.999). Every other angle counts.
3. It names the corner back/front plus left/right from the two sides, with the ending segment's
   `facingRotationY` as `posRotationY`.

### Why the corners at an opening are left out

A door or a floor-to-ceiling window splits the wall in the kernel's contour, and the opening is a
segment of its own without a type (D61). Where the opening reaches a corner, the corner has no pair
of `wall` segments:

- At the front left corner, the opening of wall 3 starts.
- At the front right corner, the opening of wall 10 starts.
- At the back right corner, the opening of wall 15 ends.

Step 1 removes these openings, so step 2 never sees a pair there.

The type filter has no other effect. Segments of one wall run in a straight line, so step 2 already
gives no corner between a wall piece and the opening beside it (the test
`it('still lists four corners when a door splits a wall, and none between collinear walls')`,
`hi-plan-space-test.ts:842`).

### Why the partition and the inner corner of the L are listed

The kernel's contour runs with the room on its left (D61), also around the partition: wall 20 runs
from `[1810, 0, 1050]` to `[1810, 0, -2550]` and faces 270, towards the room on its left.
`deriveWalls` takes `facingRotationY` from that rule (`atan2(dz, -dx)`, `hi-plan-context.ts:802`).

Step 2 counts any angle, also a turn away from the room:

- At the inner corner of the L, the left wall 0 runs to the front and wall 1 turns away from the
  room's side of wall 0.
- At the four corners of the partition, the contour turns away from the room four times.

No group stands in such a corner the way a corner kitchen does. A group against one of the two
walls faces away from the other one.

The backlog's cause names the subpaths ("takes … the walls of every subpath of the contour"). The
subpath is not the distinction. The inner corner of the L belongs to the outer contour and turns
away from the room in the same way. A partition joined to an outer wall would also be part of the
outer contour, and its free end would give two such corners.

### What the probe shows

`roomle-ui`'s `wallFaces` and `roomCorners` were run on the stored plan contexts of all eight
distinct rooms of the prompt-test runs in `.temp/result`, against a corner rule without the type
filter and with a turn test:

- The six other rooms (the default kitchen room, the open-plan room, the utility room, the closet
  room and the two attic rooms) keep their corners unchanged.
- The living room gets the five room corners and nothing else. This includes the plan context of
  the same plan from a run of 2026-10-08 (`random-2-oak-sideboard-grey-wall`), which has no
  partition yet.
- Corners built from the segments and corners built from the faces (`wallFaces`) give the same list
  in all eight rooms. A face only joins segments that run in a straight line, and step 2 never
  makes a corner between those.

## Root cause

`roomCorners` (`hi-mcp/hi-mcp-server/agent-facing.ts:80-112`; roomle-ui `hi-plan-space.ts:515-547`)
treats a room corner as "two segments of type `wall` meeting at an angle":

1. **The type filter** (`agent-facing.ts:81`, `hi-plan-space.ts:516`) drops the opening segments
   that the kernel's contour has at a corner. A corner is a property of the contour, not of the
   segments' type.
2. **No turn test.** A corner where the contour turns away from the room gets a name and a
   `posRotationY` as if a corner kitchen could stand there. This covers the inner corner of an
   L-shaped room and the corners of a partition.

The served text is not the cause. The rule "every room of get-plan-context carries a corners list"
(`hi-mcp-server.ts:33`) is correct. The list it points to is wrong.

## Proposed fix

The rule: **a room corner is a point where one segment of the contour ends and the next starts at an
angle, turning into the room.** It applies to walls and openings alike. With the room on the
contour's left (D61), "into the room" means that the next segment runs to the side that the ending
segment faces: `along[1] * next[0] - along[0] * next[1] > 0`, the facing of `deriveWalls` written as
a vector.

**roomle-hi-example**, `roomCorners` in `agent-facing.ts`:

- Drop the type filter. The loop runs over all walls.
- Add the turn test beside the straight-line test.
- The comment says "where the contour turns into the room, at a wall or an opening".
- The names, `point` and `posRotationY` stay as they are. An opening segment has its `side` and
  `facingRotationY` like a wall.

**roomle-ui**: the same change in `roomCorners` of `hi-plan-space.ts`.

**Decision for the review:** a partition and the inner corner of an L-shaped room give no room
corners. The proposal is to record this in D12 of `docs/hi-mcp-behaviour.md`, with the rejected
alternative: listing the corners of the partition. These corners are what the backlog asked to
decide.

**Documentation**, in the same change:

- §5.4 of `docs/hi-mcp-behaviour.md`, the `corners` of `rooms`: "where the contour turns into the
  room, also where a door or a floor-to-ceiling window reaches the corner".
- `.agents/skills/hi-mcp-tools.md:72`, `docs/hi-mcp-server.md:326` and
  `hi-mcp/hi-mcp-server/README.md:312` stay as they are. They say "per room corner" and make no
  claim about the walls.
- No served text changes.
- Backlog item 68 leaves `.agents/backlog/mcp-issues.md` (overview row and section) and
  `.agents/backlog/README.md`.

## Tests of the fix

- roomle-ui `__tests__/hi-plan-space-test.ts`: a new test in `describe('roomCorners')`,
  `it('lists the corners where the contour turns into the room, also at a window, and none of the partition')`.
  It runs on `LIVING_ROOM_WALLS` (line 1047, referenced inside the `it`) and expects, in contour
  order:
  - back left `[-3185, 0, -3765]` 0
  - front left `[-3185, 0, 2235]` 90
  - front right `[6320, 0, 2235]` 180
  - back right `[6320, 0, -5265]` 270
  - back left `[1935, 0, -5265]` 0

  The rectangle, door and split tests stay as they are.
- roomle-hi-example `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts`: beside
  `it('names the walls, marks the openings and lists the room corners')` (line 265), a test with
  the living room's walls (built with a small `wall` helper, openings without a type) that expects
  the same five corners from `get-plan-context`.

Verify with:

- roomle-ui: `UNIT_TEST=true npx vitest run --no-cache --config vite.build.config.mts
  packages/homag-intelligence` in `packages/web-sdk`, then `npm run lint:types:sdk` and
  `npm run lint:code:sdk`.
- roomle-hi-example: `npm test` and `npm run typecheck` in `hi-mcp`, then `npm run lint` and
  `npm run format:check`.

## What the fix does not do

- **The names stay back/front plus left/right.** An L-shaped room has two "back left" corners,
  which the agent tells apart by their `point`.
- **The placement by `wall` and `alignment` does not change.** It finds the corner of a wall face
  through `adjoiningWall` (D81) and never reads this list.

## Rejected approaches

- **Build the corners from `wallFaces`, as the backlog proposes.** It gives the same corners in
  every room, because a face only joins segments in a straight line. But the server has no copy of
  `wallFaces` and would need one. Dropping the type filter is the smaller change.
- **Leave out the subpaths after the first `M` of the contour.** This misses the inner corner of an
  L-shaped room and the free end of a partition joined to a wall. It would also drop a real corner
  of a hole that is not convex.
- **List the corners that turn away from the room with a flag.** No placement uses them, and the
  agent would have to learn to skip them.
