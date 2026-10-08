# Bug Analysis: a new group stands on an obstacle without a hint

> **Type**: Bug Analysis
> **Domain**: hi-mcp — the served obstacle and walls rules (`AUTHORING_RULES`, `hi-mcp-server.ts`); the results of `create-or-replace-groups` and `place-group` (`tool-executors.ts`); the geometry in `plan-space.ts`
> **Trigger**: [RML-18077](https://roomle.atlassian.net/browse/RML-18077); backlog [`mcp-test-open-issues.md`](../backlog/mcp-test-open-issues.md) issue 49; related: [RML-18036](https://roomle.atlassian.net/browse/RML-18036) (D45, the obstacles), issues 41 and 53 of the same backlog, [RML-18041](https://roomle.atlassian.net/browse/RML-18041) (umbrella)
> **Date**: 2026-10-07
> **Author**: AI Assistant
> **Status**: Open — implemented on `fix/new-group-on-an-obstacle-RML-18077`, [verified](#implementation-and-verification) with unit tests and live, the model runs wait for a go; not yet merged

## Affected repositories

- **roomle-hi-example**: the fix. The results of `create-or-replace-groups` and `place-group` get
  a `hint` for each root module that stands on an obstacle or in front of a door or a window, with
  the free stretches of its wall. The obstacle rule gets shorter, and the served text announces
  the `hint`. The change comes with unit tests, a new decision and the §8 rows in
  `docs/hi-mcp-behaviour.md`, the tool references, and the removal of backlog issue 49.

Not changed:

- **roomle-ui**: the `obstacles` section of the plan context (`shapeObstacles`,
  `hi-plan-context.ts:897`) already returns the objects with their kind, outline and height
  range. The raw groups (`getExternalObjectGroups`) give each root module's geometry and
  rotation, as they already do for G22 and D43. The server already reads both after the load.
  The pages need no new planner method.
- **ligna-store**: it uses the same MCP server and gets the fix with its deployment.

## Symptom

A new group is placed across a window, onto furniture or into another group. The result reports
success and has no hint. The agent then tells the user that the request was done.

## Reproduction

The ticket's run is `mcp-test-2026-10-07_11-58-22`, gpt-6-astra test 32 ("Image only, no text",
Default Room). The model built a galley kitchen from a photo. The group on the left wall has the
placement `posGroup` [-685, 0, -965] at `posRotationY` 90. The 2800 mm row then ends flush in the
back left corner, as in the photo. In `plan-context.json`:

| | Outline (x, z) | Height |
|---|---|---|
| Window in the back wall (`wall` 5, `fromEndMm` [235, 2335]) | x −450 to 1650, z −3885 to −3765 | 950 to 2170 |
| OTB30 `d92e40fb`, the last wall unit of the row, in the corner | x −685 to −279, z −3765 to −3363 | 1480 to 2200 |

The OTB30 hangs on the left wall and is 406 mm deep, so it reaches 406 mm along the back wall.
The window starts 235 mm from the corner, so the wall unit stands in front of its first 171 mm.
No result said so, and the answer did not mention it.

The same thing happens in other runs, with every model:

| Run | Model, test | Placement the model sent | Obstacle |
|---|---|---|---|
| `mcp-test-2026-10-07_09-46-08` | gpt-6-astra 09 | the same [-685, 0, -965] / 90 | the corner OTB30 in front of the window's first 168 mm |
| `mcp-test-2026-10-06_14-25-34` | gpt-5-mini 01 | centred on the back wall, d 1550 | wall units in front of the window from 1550 to 2335 mm |
| `mcp-test-2026-10-06_14-25-34` | gpt-5.4-mini 01 | at the back wall's end | three wall units in front of the window |
| `mcp-test-2026-10-06_14-25-34` | gpt-5-mini 02 | flush into the back left corner | two tall units on the sofa |
| `mcp-test-2026-10-06_14-25-34` | gpt-5-mini 03 | an island at [1000, 0, 5000] | the island runs into the kitchen's base units |
| `mcp-test-2026-10-06_14-25-34` | gpt-5.4-mini 02 | flush into the back left corner, after a `place-group` of the existing kitchen | tall units on the sofa and in the moved kitchen |
| `mcp-test-2026-10-07_07-20-49` | gpt-5.4-mini 07, 09 | a row longer than the wall before the door (07: a 4761 mm leg on the 4045 mm wall) | the tall oven housing (07) and a base unit (09) in the door opening |
| `mcp-test-2026-10-07_07-20-49` | gpt-5.4-mini 28 | two groups of one HTB60 on the back wall | the sofa and the side table |

gpt-6-astra passed the three obstacle tests (`obstacle-window-back-wall`,
`obstacle-back-wall-beside-the-sofa`, `obstacle-island-free-spot`). It fails when the obstacle is
on the neighbouring wall. gpt-5-mini failed all three tests, and gpt-5.4-mini failed two. The
obstacle rule has not changed since it was added on 2026-10-06 (`7f00c05`), so every run above
used the served text of today's code.

## Cause

The agent's placements follow the served text. Most of them are recipes of the walls rule. The
others (the island, the two single HTB60) are points the model picked without the overlap test
that the rule leaves to it. No result reports an overlap.

1. **The obstacle rule hands the overlap test to the model** (`hi-mcp-server.ts:24`). The rule
   says: "A root module cannot stand where an object or a root module of another group overlaps
   it both in the outline and in the height range", and "keep that span free". To follow it
   before the call, the model has to:
   - **derive where each of its root modules will stand.** It has the placement, the relations
     and the catalog dimensions. The outlines exist only after the planner has calculated the
     group.
   - **compare every root module with every object and every root module of the other groups**,
     in outline and height range.
   - **see that a door's or a window's span also concerns the adjoining wall.** The rule gives
     the span "measured from the wall's end like d", which describes a group placed against the
     opening's own wall. A unit in the corner of the adjoining wall reaches into the span by its
     depth, and the rule does not say so. That is test 32: the window is on the back wall, and
     the group stands on the left wall.

   This is geometry the server can derive itself (guideline step 2, "Simplify the tool API").
   The model only has the inputs, and the result it gets afterwards does not tell it.

2. **The walls rule offers recipes that ignore obstacles** (`hi-mcp-server.ts:22`). The recipes
   are: "posGroup = end puts the group flush into the corner", "centred: d = (lengthMm − group
   width) / 2", and "right end flush into the corner at the wall's start: d = lengthMm − group
   width". The obstacle rule comes two rules later and does not refer back to them. The models
   take the recipes as they are: centred (gpt-5-mini 01), at the end (gpt-5.4-mini 01), flush
   into the corner (gpt-5-mini 02) and flush at the start (gpt-6-astra 09 and 32, d = 5000 −
   2800 = 2200).

3. **No result reports an obstacle.**
   - `create-or-replace-groups` (`tool-executors.ts:3165`) gives a `hint` only for an
     unpositioned group, and for a new group at the same point and rotation as another group
     (`groupsAtTheSamePlace`, `tool-executors.ts:1638`, within 5 mm). gpt-5-mini 03's island was
     not at the kitchen's point, so it got no hint.
   - `place-group` tests only the other groups (G22, D27, `tool-executors.ts:3233`), by the
     rectangle around each group (issue 53). It never tests objects, doors or windows.
   - Row edits (D43, `rowReachHints`, `tool-executors.ts:619`) test the room contour and the
     other groups. Doors are issue 41.

4. **An outline test cannot catch a door or a window.** Doors and windows lie behind the room
   boundary and only touch it (D45). In test 32 the window's outline ends at z −3765, where the
   OTB30 begins. `volumesOverlap` (`plan-space.ts:658`) counts that as touching, which is no
   overlap. A test for openings has to use the opening's span along its wall, which the server
   already computes (`wallOfOpening`, `plan-space.ts:695`, C21), and the space in front of it.

5. **The served text never mentions the `hint`.** "Read corrections and notLoaded in a result"
   (`hi-mcp-server.ts:30`) names two of the three feedback fields. "Verify results numerically"
   (`hi-mcp-server.ts:28`) sends the model to a second `get-plan-context` and the same geometry
   as in step 1. In test 32 the model called `get-plan-context` only once, before its first
   create.

## Fix

Following the guideline: the server derives what the model cannot (step 2), and it reports what
it found without refusing anything (step 4, D22, D51). The user may want a cabinet in front of a
window, so the group is built anyway.

### The test

After the load (`create-or-replace-groups`) and after the reload (`place-group`), the server
reads `obstacles` and `rooms` together with the `groups` it already reads, and the raw groups
for the root modules' geometry and rotation. It adds the walls of the doors and windows (C21)
and tests each root module of each group of the call:

1. **On an object**: its outline and height range overlap an object's by more than 5 mm
   (`volumesOverlap`, `OVERLAP_TOLERANCE_MM`). Touching is no overlap.
2. **In another group** (`create-or-replace-groups` only): the same test against each root module
   of the other groups, root by root and not by the group rectangle. `place-group` keeps G22 for
   the groups.
3. **In front of a door or a window**: two conditions together:
   - it overlaps the strip in front of the opening: the opening's `fromEndMm` span on its wall,
     reaching the wall strip's depth ([default 1](#defaults-for-review)) into the room;
   - its height range reaches above the opening's `bottomMm`. A door starts at the floor; base
     units below a window's sill are fine.

### The hint

There is one sentence per root module that the test finds. Each sentence names:

- the root module's id and article;
- what it stands on or in front of: an object, another group's root module by id, or a door or
  window by its wall's name and its `fromEndMm` span;
- the free stretches of the wall the root module stands against, at its height, as `fromEndMm`
  ranges. A stretch is free when nothing stands in front of it within the root module's depth:
  no object, no root module of another group, and no strip in front of a door or window. A root
  module that stands against no wall, such as one in an island, gets no stretches.

A root module's wall is the wall it faces away from: its rotation in the room equals the wall's
`facingRotationY`, and its back lies within the wall strip. At a corner the rotation decides: the
OTB30 of test 32 touches the left and the back wall and faces away from the left wall. Each leg
of an L-shaped group gets its own wall. For test 32, with the default strip of 600 mm, the hint
would read:

> Root module 'd92e40fb' (OTB30) of group '4d696867' stands in front of the window in the back
> wall (wall 5, fromEndMm 235 to 2335, from 950 mm) - free stretches of the left wall (wall 0) at
> its height: fromEndMm 0 to 4400.

The new test replaces `groupsAtTheSamePlace`, because a group at another group's point overlaps
that group's root modules. Its advice moves into the sentence about another group: "if the units
belong together, send them as one group or join them with merge-groups".

### The served text

- **The obstacle rule** (`hi-mcp-server.ts:24`) shrinks to what the hint does not cover:
  - what `obstacles` lists;
  - that a new group goes on a stretch of wall or a spot that `obstacles` leaves free, including
    when it is placed with a recipe of the walls rule;
  - that the result's `hint` names each root module that stands on an obstacle or in front of a
    door or window, together with the free stretches of its wall.

  The comparison of outlines, height ranges and spans leaves the served text.
- **"Read corrections and notLoaded in a result"** (`hi-mcp-server.ts:30`) also names `hint`:
  something to check that stopped nothing.
- **"Verify results numerically"** (`hi-mcp-server.ts:28`) drops its sentence about obstacles.
- **The `place-group` description** says that the result's `hint` names objects, doors and
  windows that the group stands on or in front of.

Backlog issue 41 (a row edit puts a unit in front of a door) can use the same test in
`withRowHints` later. It stays a ticket of its own.

## Defaults for review

These follow the ticket and the planner's own behaviour. They are written down so that the
review can change them before the plan:

1. **The wall strip: 600 mm**, about the depth of a base unit. A unit at the wall in front of a
   door or a window is caught, also when it hangs on the adjoining wall as in test 32. An island
   or a table further into the room is not. A root module whose back lies within the strip of a
   wall it faces away from stands at that wall. The value is a constant beside
   `OVERLAP_TOLERANCE_MM`.
2. **`place-group` reports objects, doors and windows only with the hint.** It does not move the
   group away from them. G22 (D27) keeps moving a group along the wall away from other groups.
   Avoiding objects and openings in the same way would be new behaviour, and this fix does not
   propose it.
3. **Which groups are tested**: every group the call creates, and every group it replaces. A
   replaced group is reported only for what it did not stand on before, as in D43. For that the
   server reads the raw groups before the load when the call replaces a group. The objects do
   not change during the call.
4. **An object's outline that is not convex** (the L of a sofa) is tested like its convex hull.
   That can report a root module that stands inside the L, the same limit as issue 53.

## Implementation plan

All in roomle-hi-example, on the branch `fix/new-group-on-an-obstacle-RML-18077`. The plan takes
the four defaults above as they are.

### The geometry: `plan-space.ts`

Four pure functions, exported beside `volumesOverlap` (`plan-space.ts:658`):

1. **`rootVolumesInRoom(group)`**: one entry per root module of a raw group, without the
   generated ones (`isGenerated`). Each entry holds:
   - `id` and `articleId`;
   - `corners`: the four room-space corners of the root module's box, which is the box of
     `rootFootprintPoints` in group space turned by `groupPointToRoom`;
   - `heights`: its height range in the room, `rootHeights` plus the group's y;
   - `rotationY`: its rotation in the room, the group's `rotationY` plus the root module's,
     normalised.

   This is the box roomle-ui puts into the `obstacles` section (`rootOutline`), taken from the
   raw group because only the raw group carries the rotation.
2. **`stripInFrontOfWall(wall, [fromEndMm, toEndMm], depthMm)`**: the floor rectangle in front of
   a span of the wall, reaching `depthMm` into the room. Into the room is the direction
   `rotateDirection([0, 1], wall.facingRotationY)`, the front of a group with its back to the
   wall.
3. **`wallOfRoot(walls, root, depthMm)`**: the wall a root module faces away from. That is the
   wall of type `wall` that meets three conditions:
   - its `facingRotationY` equals the root module's `rotationY`;
   - the root module's span along it overlaps the wall;
   - its line is nearest to the root module's back, at most `depthMm` away.

   It returns undefined for a root module away from every wall, such as one in an island.
4. **`freeStretchesAlongWall(wall, root, blockers, toleranceMm)`**: the `fromEndMm` ranges of
   the wall where the root module would stand clear of every blocker. The root module is taken
   with its depth (its extent from the wall line) and its height range. Each step:
   - A blocker counts when its volume overlaps the strip in front of the wall at that depth and
     height (`volumesOverlap`).
   - A counting blocker's span along the wall (`spanAlongWall`) is taken out.
   - Stretches narrower than the root module along the wall are left out, and the values are
     rounded to whole millimetres.

### The test and the hint: `tool-executors.ts`

1. **`WALL_STRIP_MM = 600`**, beside `OVERLAP_TOLERANCE_MM` (`tool-executors.ts:2295`), is
   default 1.
2. **`obstacleFindings(root, blockers)`**: what one root volume overlaps, by `volumesOverlap`
   with `OVERLAP_TOLERANCE_MM`. It checks three kinds of blocker:
   - each object of kind `object`;
   - the strip in front of each door and window: `stripInFrontOfWall` of its wall and
     `fromEndMm`, with the heights `bottomMm` to `topMm`;
   - each root module of another group.

   Each finding carries a key for the comparison before and after a replace: an object by its
   kind and rounded outline, a root module by its id.
3. **`obstacleHint({ groupIds, rawGroups, obstacles, rooms, withGroups, before })`**: one sentence
   per root module of the named groups that has a finding.
   - The objects come from `agentFacingObstacles` (`tool-executors.ts:824`), which gives every
     door and window its wall (C21).
   - `before` holds the raw groups before the call. A finding that a replaced group's root
     module already had is dropped (default 3).
   - It returns undefined when there is no finding. It also returns undefined without an
     `obstacles` section: on a planner without D45 the tools work as before.
4. **The sentence:**

   > Root module '\<id\>' (\<articleId\>) of group '\<groupId\>' \<findings\> - free stretches of
   > the \<wall name\> (wall \<index\>) at its height: fromEndMm \<a\> to \<b\>, \<c\> to \<d\>.

   The findings are joined by "and":
   - `overlaps an object (x 1500 to 2000, z -1500 to -1000, 0 to 790 mm)`;
   - `overlaps root module 'r1' (article-1) of group 'g1'`;
   - `stands in front of the window in the back wall (wall 5, fromEndMm 235 to 2335, from 950 mm)`;
   - `stands in front of the door in the right wall (wall 3, fromEndMm 0 to 900)`.

   Without a wall the stretches part is left out. With a wall but no stretch wide enough, it
   reads "- no stretch of the left wall (wall 0) is free for it at its height". After all the
   sentences comes, once: "The groups were built as sent - move or change them if the user did
   not ask for them there." When another group is named, this follows: "If the units belong
   together, send them as one group or join them with merge-groups."

### `create-or-replace-groups`

1. The read after the load (`tool-executors.ts:3124`) takes `['groups', 'obstacles', 'rooms']`.
   So does the second read after the group attributes (`:3148`) when it runs. The result still
   returns only `groups`.
2. With an `obstacles` section, the server reads the raw groups once and builds the hint for
   every group of the call (`matchResultGroups`), with `withGroups: true`.
3. When the call replaces a group (`beforeGroupIds`, `:2995`), the server also reads the raw
   groups before the load and passes them as `before`.
4. The hint takes the place of `groupsAtTheSamePlace` in the hints (`:3165`). `groupsAtTheSamePlace`
   and `sameRotation` (`:1630` to `:1667`) are deleted. The hint for an unpositioned group stays.

`inPlacementFrame` reads the raw groups once more afterwards. Sharing that read would mean
changing the wrapper, and this fix leaves it as it is.

### `place-group`

1. The first read (`:3203`) adds `obstacles`. The objects do not change during the call, and the
   rooms are already in that read.
2. After the reload, the server reads the raw groups once and builds the hint for the placed
   group with `withGroups: false` (default 2). The hint goes into the result beside
   `corrections`.
3. A group that already stands where asked is not reloaded and gets no hint.

### The served text: `hi-mcp-server.ts`

1. **The obstacle rule** (line 24) becomes:

   > Obstacles: the obstacles section of get-plan-context lists what stands in the room, in the
   > coordinates of the walls - objects (doors, windows, other furniture) with kind, outline (floor
   > points [x, 0, z]) and bottomMm to topMm, a door or a window also with roomIndex, wall and
   > fromEndMm, its span along that wall from the wall's end like d -, and per group its root
   > modules with id, outline and bottomMm to topMm. Put a new group on a stretch of wall or a
   > spot that obstacles leaves free, with the recipes above too; base units lower than a window's
   > bottomMm fit below it. The result's hint names every root module that overlaps an object or
   > another group or stands in front of a door or a window, with the free stretches of its wall.
2. **"Verify results numerically"** (line 28): "the obstacles of get-plan-context give the
   outlines of their root modules in the coordinates of the walls" becomes "the hint names a
   root module that stands on an obstacle".
3. **The feedback rule** (line 30) becomes: "Read corrections, notLoaded and hint in a result:
   corrections lists what the server changed in your input and has already applied; notLoaded
   lists the groups and the roots it could not build, with what to send instead; hint names
   something to check that stopped nothing - a root module on an obstacle, with the free
   stretches of its wall."
4. **The `create-or-replace-groups` description** (line 251) adds, after notLoaded: "and hint (a
   root module on an obstacle, in another group or in front of a door or a window, with the free
   stretches of its wall)".
5. **The `place-group` description** (line 277) ends with: "Returns placedIn (corner or wall),
   the wall, the resulting group and a hint when a root module stands on an object or in front of
   a door or a window."

### The documentation

1. **`docs/hi-mcp-behaviour.md`**:
   - the state line;
   - **D55** under Obstacles: the hint, the wall strip, and defaults 2 to 4;
   - the Obstacles bullet of §5.2 (line 320);
   - the results of `create-or-replace-groups` (lines 438 and 447) and `place-group` (line 474);
   - the Overlaps bullet of §7 (line 580);
   - the `hint` row of §8.1 (line 591);
   - in §8.3 the same-place row (line 689) becomes the D55 row, and §8.4 gets a D55 row;
   - the wall strip in §9.
2. **The tool references**, in the same wording:
   - `docs/hi-mcp-server.md`, lines 423 to 428 and the `place-group` result;
   - `.agents/skills/hi-mcp-tools.md`, line 122 and `place-group`;
   - `hi-mcp/hi-mcp-server/README.md`, line 402 and `place-group`;
   - `docs/implementation/tool-executors.md`, lines 102 to 105 and `place-group`.
3. **The backlog** (`mcp-test-open-issues.md`): issue 49 and its overview row go. The to-do of
   issue 41 names `obstacleFindings` for reuse.
4. **This analysis**: the status and the results of the verification.

### Unit tests

**`tests/plan-space.test.ts`**, new describe blocks:

1. **`rootVolumesInRoom`**, "turns the box of each root module into room space with its height
   and rotation".
   - Input: a group at [1000, 0, -3000] with rotation 90. One root module is turned by 90 like an
     L leg, and there is a generated worktop.
   - Expected: two volumes with their corners, heights and rotations (90 and 180), and no
     worktop.
2. **`stripInFrontOfWall`**, "lies in front of the span, into the room".
   - Input: the back wall of `room`, `fromEndMm` 1000 to 2000, depth 600.
   - Expected: x 1000 to 2000, z −3000 to −2400.
3. **`wallOfRoot`**, "finds the wall a root module faces away from":
   - a base unit against the back wall: wall 2;
   - a corner unit with rotation 90 that touches the back and the left wall: wall 3, the left
     wall;
   - a unit 13 mm off the wall, like the dishwasher of test 32: still that wall;
   - a unit 1000 mm from every wall: undefined.
4. **`freeStretchesAlongWall`**, "leaves out what stands in front of the wall at its height":
   - a window strip from 950 mm blocks a wall unit (1480 to 2200), but not a base unit (0 to
     720);
   - an object deeper in the room than the unit's depth blocks nothing;
   - a gap narrower than the unit is not listed.

**`tests/tool-executors.test.ts`**, a new `describe('obstacle hints')`. It uses the `room`
fixture with these obstacles:

- a window behind the back wall, x 1000 to 2000, from 950 mm;
- a door in the right wall;
- a chair at x 1500 to 2000, z −1500 to −1000, 0 to 790 mm;
- a sofa at the left wall, x 0 to 900, z −2000 to −1000, 0 to 800 mm.

The raw groups are built from cabinets whose docking vectors give their outline and height, as in
`describe('hints')` of the row edits. The fake returns the `obstacles` on every read that asks for
the section.

5. **"names the wall units across a window with the free stretches of the wall."** Base units
   with wall units above them, at [800, 0, −3000] with rotation 0. Both wall units get a sentence
   with "free stretches of the back wall (wall 2) at its height: fromEndMm 0 to 1000, 2000 to
   4000". The base units, below the window's `bottomMm`, get none.
6. **"names a corner unit on the adjoining wall that reaches into a window."** This is test 32: a
   base unit on the left wall in the back left corner with a 400 mm deep wall unit above it, and
   a window 300 mm from the corner. The wall unit gets a sentence with the left wall's "fromEndMm
   0 to 2400"; the base unit gets none.
7. **"names a root module on an object."** An island over the chair gets "overlaps an object (x
   1500 to 2000, z −1500 to −1000, 0 to 790 mm)", without stretches.
8. **"names a root module in another group and advises merging."** This replaces "hints at a new
   group that stands at the place of another". A new group at g1's place gets the sentence about
   `r1` of `g1`, and the merge-groups advice.
9. **"says nothing about a group beside or touching an obstacle."** A row that ends at the
   window's span and an island that touches the chair get no hint.
10. **"names only what a replaced group did not stand on before."** g1 is replaced with one more
    unit. The kept unit already stood in front of the window and gets no sentence. The new unit,
    also in front of the window, gets one.
11. **"builds without a hint and without an extra read on a planner without obstacles."** This is
    D45's fallback: no `obstacles` means no hint, and `getExternalObjectGroups` is called as many
    times as before.

In `describe('place-group')`, `createPlaceApi` gets an optional `obstacles` argument for its first
read. The existing tests do not pass one:

12. **"names an object the placed group stands on."** g1, a tall unit, is centred on the left
    wall onto the sofa. The hint names the object; the corrections stay as they are.
13. **"leaves another group to the corrections."** The G22 case: the corrections are the same as
    today, and there is no hint.

**`tests/hi-mcp-server.test.ts`**:

14. "tells the agent what stands in the room and to keep the span of a door or a window free"
    becomes "tells the agent what stands in the room and that the hint names a root module on an
    obstacle". It checks the new obstacle sentence, and that "A root module cannot stand where …"
    is gone.
15. The assertions on "Read corrections and notLoaded in a result" check the new feedback rule.
    The `create-or-replace-groups` and `place-group` descriptions name the hint. The check that
    no served text rejects anything stays.

The other tests of `create-or-replace-groups` and `place-group` stay as they are. Their reads carry
no `obstacles`, so they get no hint and no extra read.

### Verification

1. In `hi-mcp`: `npm test` and `npm run typecheck`. At the root: `npm run lint` and
   `npm run format:check`.
2. **Live, headless**, as for RML-18074. The example page runs with a planner that has the
   obstacles section (roomle-ui master), and the tools are called directly, without a model. The
   script and its output go to `.temp/result/issue-RML-18077/`.
   - **Default Room** (`ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv`), the left group of test 32 (call 2
     of `run.json`): the hint names the OTB30 and the window, with the left wall's "fromEndMm 0
     to 4400". The right group gets no hint.
   - **Default Room**, gpt-5-mini 01's centred row (`posGroup` [865, 0, −3765]): the wall units
     in front of the window get a sentence; the base units do not.
   - **Open-plan room** (plan `open-plan-room` of `docs/test-prompts.json`), gpt-5-mini 02's two
     H2TB60 flush into the back left corner: the hint names the sofa.
   - **Open-plan room**, `place-group` of the kitchen onto the back wall: the hint names the sofa
     and the side table.
3. **MCP tests with models**, only after a go: `obstacle-window-back-wall`,
   `obstacle-back-wall-beside-the-sofa` and `obstacle-island-free-spot` with gpt-5-mini and
   gpt-5.4-mini, and `image-only-no-text` with gpt-6-astra. These are 7 runs, about 15 minutes.
   Expected: every group ends clear of the obstacles, after one correction at most.

## Implementation and verification

Implemented on `fix/new-group-on-an-obstacle-RML-18077` as planned (D55), with three differences:

- **No `obstacleFindings` function.** The test is the local `findings` of `obstacleHint`, over the
  blockers of `objectBlockers` (objects, and the strips in front of doors and windows) and
  `rootBlockersBeside` (the root modules of the other groups).
- **The closing sentence of `place-group`** reads "The group was placed anyway - move or change it
  if the user did not ask for it there." The `create-or-replace-groups` sentence is the planned one.
- **Test 11** pins three raw reads: the plan history's read before and after the call, and the
  placement frame's read. The executor of `master` makes the same three, so the hint adds none on
  a planner without the obstacles section.

Three existing assertions pinned the sections of the plan-context reads. They now expect
`obstacles` and `rooms`. The test "hints at a new group that stands at the place of another" is
replaced by test 8.

### Results

1. `npm test` (459 tests: 13 new, the two served-text tests extended), `npm run typecheck`, `npm run lint` and
   `npm run format:check` pass.
2. **Live, headless**: the deployed bo-test planner and the MCP server of the branch, with the
   tools called directly (`.temp/result/issue-RML-18077/verify-18077.mjs`, `verify.json`).
   - **Default Room, test 32's call 2** (both groups). The OTB30 in the back left corner gets
     "stands in front of the window in the back wall (wall 5, fromEndMm 235 to 2335, from 950 mm)
     - free stretches of the left wall (wall 0) at its height: fromEndMm 0 to 4400". The range
     hood DU gets the same sentence. It hangs 402 mm from the back wall and covers the window's
     first 266 mm, within the 600 mm strip (default 1). The group on the right wall gets none.
   - **Default Room, gpt-5-mini 01's centred row.** The two wall units in front of the window get
     the sentence, with the free stretch "fromEndMm 2335 to 5500". The 235 mm left of the window
     is narrower than a unit. The base units below the sill get none.
   - **Open-plan room, gpt-5-mini 02's two H2TB60 in the back left corner.** Both get "overlaps
     an object (x -4521 to -1502, z 2259 to 3319, 0 to 828 mm)", the sofa, with "free stretches
     of the back wall (wall 9) at its height: fromEndMm 3805 to 5416". That is x −1021 to 590,
     the stretch between the side table and the door that the test evaluation named.
   - **Open-plan room, `place-group` of the kitchen** to the back wall's end. Seven root modules
     get the sofa, and two also the side table (x −1461 to −1021, 0 to 450 mm). The G22
     corrections are as before.
3. **MCP tests with models**: not run yet; they wait for a go.

### Review of PR #77

- **An object outline is tested by its convex hull** (`convexHull`, `plan-space.ts`). The
  separating-axis test of `convexPolygonsTouch` holds for convex outlines only. With an L-shaped
  outline it tested only the L's own edge directions, so a unit in the L's bounding box but beyond
  its hull was reported. Default 4 now holds as written. Tests: `convexHull` in
  `plan-space.test.ts`, "tests an L-shaped object like its convex hull" in
  `tool-executors.test.ts`.

