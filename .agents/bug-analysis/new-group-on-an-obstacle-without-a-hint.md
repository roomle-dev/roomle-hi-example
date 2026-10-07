# Bug Analysis: a new group stands on an obstacle without a hint

> **Type**: Bug Analysis
> **Domain**: hi-mcp — the served obstacle and walls rules (`AUTHORING_RULES`, `hi-mcp-server.ts`); the results of `create-or-replace-groups` and `place-group` (`tool-executors.ts`); the geometry in `plan-space.ts`
> **Trigger**: [RML-18077](https://roomle.atlassian.net/browse/RML-18077); backlog [`mcp-test-open-issues.md`](../backlog/mcp-test-open-issues.md) issue 49; related: [RML-18036](https://roomle.atlassian.net/browse/RML-18036) (D45, the obstacles), issues 41 and 53 of the same backlog, [RML-18041](https://roomle.atlassian.net/browse/RML-18041) (umbrella)
> **Date**: 2026-10-07
> **Author**: AI Assistant
> **Status**: Open — analysed, not fixed

## Affected repositories

- **roomle-hi-example**: the fix. The results of `create-or-replace-groups` and `place-group` get
  a `hint` for each root module that stands on an obstacle or in front of a door or a window, with
  the free stretches of its wall. The obstacle rule gets shorter, and the served text announces
  the `hint`. The change comes with unit tests, a new decision and the §8 rows in
  `docs/hi-mcp-behaviour.md`, the tool references, and the removal of backlog issue 49.

Not changed:

- **roomle-ui**: the `obstacles` section of the plan context (`shapeObstacles`,
  `hi-plan-context.ts:897`) already returns everything the test needs. It returns the objects
  with their kind, outline and height range, and the outline and height range of every root
  module of every group. The server already reads the plan context after the load and adds the
  section to that call. The pages need no new planner method.
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
reads `obstacles` and `rooms` together with the `groups` it already reads. It adds the walls of
the doors and windows (C21) and tests each root module of each group of the call:

1. **On an object**: its outline and height range overlap an object's by more than 5 mm
   (`volumesOverlap`, `OVERLAP_TOLERANCE_MM`). Touching is no overlap.
2. **In another group** (`create-or-replace-groups` only): the same test against each root module
   of the other groups, root by root and not by the group rectangle. `place-group` keeps G22 for
   the groups.
3. **In front of a door or a window**: three conditions together:
   - its outline comes within the opening clearance ([default 1](#defaults-for-review)) of the
     opening's wall line;
   - its span along that wall overlaps the opening's `fromEndMm` by more than 5 mm;
   - its height range reaches above the opening's `bottomMm`. A door starts at the floor; base
     units below a window's sill are fine.

### The hint

There is one sentence per root module that the test finds. Each sentence names:

- the root module's id and article;
- what it stands on or in front of: an object, another group's root module by id, or a door or
  window by its wall's name and its `fromEndMm` span;
- the free stretches of the wall the group stands against, at that root module's height, as
  `fromEndMm` ranges. A stretch is free when nothing stands in front of it within the root
  module's depth: no object, no root module of another group, and no space kept clear in front
  of a door or window. A group that stands against no wall, such as an island, gets no
  stretches.

The group's wall is the wall whose `facingRotationY` equals the group's rotation and whose line
its back touches. For test 32, with the default clearance of 600 mm, the hint would read:

> root module 'd92e40fb' (OTB30) stands in front of the window in the back wall (fromEndMm 235 to
> 2335, from 950 mm); free stretches of the left wall at its height: fromEndMm 0 to 4400 - move or
> change the group if the user did not ask for it there

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

1. **Opening clearance: 600 mm**, about the depth of a base unit. A unit at the wall in front of a
   door or a window is caught, also when it hangs on the adjoining wall as in test 32. An island
   or a table further into the room is not. The value is a constant beside
   `OVERLAP_TOLERANCE_MM`.
2. **`place-group` reports objects, doors and windows only with the hint.** It does not move the
   group away from them. G22 (D27) keeps moving a group along the wall away from other groups.
   Avoiding objects and openings in the same way would be new behaviour, and this fix does not
   propose it.
3. **Which groups are tested**: every group the call creates, and every group it replaces. A
   replaced group is reported only for what it did not stand on before, as in D43. The read of
   the plan context before the load (`tool-executors.ts:2994`) then adds `obstacles`.
4. **An object's outline that is not convex** (the L of a sofa) is tested like its convex hull.
   That can report a root module that stands inside the L, the same limit as issue 53.

## Test

- **tool-executors tests** with the existing `obstacles` fixture: a group created across a window,
  onto an object and into another group gets the hint with the free stretches. A corner unit on
  the adjoining wall that reaches into the window's span gets it too. A base unit below the
  window's `bottomMm`, a group beside the obstacles and a group touching them get none. A
  replaced group that already stood in front of the window gets none. `place-group` onto a sofa
  gets the hint.
- **hi-mcp-server tests**: the served text names `hint` beside `corrections` and `notLoaded`, and
  it no longer asks the model to compare outlines.
- **MCP tests** `obstacle-window-back-wall`, `obstacle-back-wall-beside-the-sofa` and
  `obstacle-island-free-spot` with gpt-5-mini and gpt-5.4-mini, and `image-only-no-text` with
  gpt-6-astra: the group ends clear of the obstacles, after one correction at most.
