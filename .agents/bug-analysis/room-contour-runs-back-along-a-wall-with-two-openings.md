# Bug Analysis: the room contour runs back along a wall with two openings

> **Type**: Bug Analysis
> **Domain**: RoomleCore `ObjectSurroundings::addOpeningToContour` (`src/planner/geometry/object-surrounding-geometry.cpp`); consumers: roomle-ui `deriveWalls` (`homag-intelligence/src/hi-plan-context.ts`), the `walls` of `get-plan-context` and the wall placement of `place-group`
> **Trigger**: [RML-18072](https://roomle.atlassian.net/browse/RML-18072); origin: [finding 1 of the plan context backlog](../backlog/plan-context-open-findings.md#1-a-wall-entry-that-runs-against-the-contour-gets-the-opposite-side)
> **Date**: 2026-10-07
> **Author**: AI Assistant
> **Status**: Open — fixed in RoomleCore ([PR #2565](https://github.com/roomle-internal/RoomleCore/pull/2565), not merged); roomle-ui takes it with the next kernel release, then the [reproduction](#reproduce) closes this analysis

## Affected repositories

- **RoomleCore** — the defect and the fix, in
  [PR #2565](https://github.com/roomle-internal/RoomleCore/pull/2565): `addOpeningToContour` splits
  only the wall piece the opening overlaps; tests in `object-surrounding-geometry-test.cpp` and
  `plan-room-geometry-test.cpp`; the contour invariant in
  `documentation/features/walls/room-contour-geometry.md` and an openings section in
  `documentation/homag-intelligence/surrounding-contour/surrounding-contour.md`. The RoomleCore
  analysis was closed out and deleted in the same pull request.
- **roomle-ui** — no code change. It takes the fixed kernel through the `roomle-core-hsc` URL in
  `packages/web-sdk/package.json` (today `3.1.0-alpha.4`). `deriveWalls` stays as it is.
- **roomle-hi-example** — no code change. This analysis; finding 1 leaves
  `plan-context-open-findings.md` once the fixed kernel is in roomle-ui and the
  [reproduction](#reproduce) passes.

Not changed: **ligna-store** — it gets the fix with the roomle-ui deployment. The HOMAG library
receives the room information for `groupAdjust` from the same kernel code (`ROOM` mode), so it gets
the fix with the kernel too.

## Symptom

`get-plan-context` on the Open-Plan Room (`ps_qwm5odi6tyflyqwpdcxz1la791ho633`) lists the front
wall (z −8616, two doors) as six entries where five are correct:

| Entry | From x | To x | Type | Side, name | `facingRotationY` | Correct |
|---|---|---|---|---|---|---|
| 1 | −4826 | −3849 | wall | bottom, front wall | 180 | yes |
| 2 | −3849 | −1749 | opening (door 73) | bottom | 180 | yes |
| 3 | −1749 | −1699 | wall | bottom, front wall | 180 | yes |
| 4 | −1699 | 401 | opening (door 69) | bottom | 180 | yes |
| 5 | 401 | **−1749** | opening | **top, back wall** | **0** | no — runs back along the wall |
| 6 | −1749 | 3248 | wall, 4997 mm | bottom, front wall | 180 | no — passes over both doors |

The correct plan has one wall entry 401 → 3248 after entry 4. The contour at level 2100 carries the
same two wrong segments; the `FLOOR` contour has no openings and is correct, and the single door
on the back wall is split correctly.

What the agent gets from it:

- Entry 5 is a "back wall" at the front of the room whose `facingRotationY` turns a group's back
  away from the wall.
- Entry 6 is a 4997 mm front wall across both doors, so a placement against it (`place-group`, or a
  `placement` taken from its `end`) can put a group in front of a door.
- The room corners are not affected: `roomCorners` (`plan-space.ts`) skips openings and collinear
  walls, so the front-left and front-right corners come out right.

## Cause

Verified on 2026-10-07 against RoomleCore `master`, `src/planner/geometry/object-surrounding-geometry.cpp`.

1. `fillRoomGeometryLayers` (`plan-room-geometry.cpp:310`) adds the openings of the room's walls one
   at a time: `addWallOpenings` → `appendOpening` → `addOpeningToContour` (`:615`).
2. `addOpeningToContour` takes the wall segments on the opening's wall from `getWallSegmentIndices`
   (`:760`). That returns every `WALL` segment on the wall line that overlaps the wall, not only the
   segment the opening lies on.
3. The first opening finds one segment and splits it correctly into wall, gap, wall. The second
   opening finds **both** pieces and is inserted into each of them. The two conditions that decide
   the split check only one end of the opening each: `dEnd < segmentLength` (`:661`) and
   `dStart > 0` (`:674`). `distanceToStartOfRay` is a signed projection
   (`normalized-ray-2.h:112`), so an opening entirely before the piece has a negative `dEnd` and
   passes the first condition; one entirely after the piece has `dStart` beyond the end and passes
   the second.
4. For the piece 401 → 3248, door 73 gives `dStart` −4250 and `dEnd` −2150: the kernel inserts a
   gap point at −1749 before the piece's start. That is entry 5, and the rest of the piece becomes
   entry 6. In the mirrored case a wall point is inserted beyond the piece's end.

Any straight wall face with two openings is affected unless the first opening touches an end of the
wall. The curved-wall path (`addOpeningOnCurvedWallToContour`) tests the overlap per segment and is
not affected.

## Why the fix is in RoomleCore and not in the consumers

- The kernel's `ROOM` and `PLAN` contour runs counter-clockwise with the room on its left
  (`turnFloorCorners(floorCorners, true)`, `plan-room-geometry.cpp:247`). `deriveWalls` takes the
  side and the facing from the segment direction, which is right for such a contour. Nothing is
  missing in what the kernel delivers, so no further query of the kernel is added (decided in the
  ticket).
- A side test in `deriveWalls` would hide the defect: entry 6 would still span both doors, and the
  same contour reaches the HOMAG library and the order data.
- The MCP server only names the walls (`wallName`) and builds the corners from them; it cannot
  tell a wall that runs back from a wall of a room that bulges.

## Reproduce

`get-plan-context` on the Open-Plan Room. Today the front wall has an entry with the side `top`
and `facingRotationY` 0 from x 401 to −1749. Fixed: every entry of the front wall has the side
`bottom` and `facingRotationY` 180, and the wall after door 69 runs from 401 to 3248.

In RoomleCore: `npm run rapi:plan -- ps_qwm5odi6tyflyqwpdcxz1la791ho633` in `node/`, load the plan
in `TEST_CASE("playground load plan XML")` and dump
`PlanRoomGeometry(PlanRoomGeometryMode::PLAN).fillRoomGeometry(floor, contours)`.

## Implementation plan

All code changes are in RoomleCore, on its branch `fix/second-opening-room-contour`, which holds the
RoomleCore analysis. The tests come first and must fail on the unfixed code; the fix then makes them
pass.

### RoomleCore: the fix

`ObjectSurroundings::addOpeningToContour` (`object-surrounding-geometry.cpp:615`), in the loop over
the wall pieces, right after `dStart` and `dEnd` are ordered (`:656`):

```cpp
if (dEnd <= math::epsilon::closeTo || dStart >= segmentLength - math::epsilon::closeTo) {
    continue;
}
```

- A wall piece the opening does not overlap stays as it is. The tolerance is the file's
  `math::epsilon::closeTo` (0.1 mm, as in `isLevelInsideOpening`), so an opening that only touches
  a piece's end leaves no zero-length piece in it.
- The split of the overlapped piece stays as it is: both conditions, the copies of height and
  thickness, the type change of the following segment.
- `getWallSegmentIndices` stays: `addAtticAngleToContour` needs every wall segment of the wall.
- The curved-wall path `addOpeningOnCurvedWallToContour` stays; it tests the overlap per segment
  already.
- The cognitive complexity of the function rises from 13 to 16 by my count, below the project
  limit of 25 (cpp:S3776, see RoomleCore #2524). No extraction is needed.
- No public signature changes, so the emscripten interfaces are not touched.

### RoomleCore: unit tests

All new tests use `test::plan::simpleSquare6x6`: inner faces at ±3000, walls 2800 high and 120
thick. The openings lie on the wall face y −3000, along which the room contour runs in +x.

| Opening | Width × depth × height | Centre x, bottom z | Span along the wall | Levels |
|---|---|---|---|---|
| door A | 900 × 120 × 2100 | −1500, 0 | −1950 … −1050 | 0 … 2100 |
| door B | 900 × 120 × 2100 | 1000, 0 | 550 … 1450 | 0 … 2100 |
| door C | 900 × 120 × 2100 | −250, 0 | −700 … 200 | 0 … 2100 |
| window W | 800 × 120 × 1000 | 1000, 900 | 600 … 1400 | 900 … 1900 |

Every section first requires each opening's wall (`getMainWallAttachedTo`) and span
(`getCornerFromLeft`, `getCornerToLeft`). A planner that moves an opening then fails that
precondition instead of the expectation.

**1. New `TEST_CASE("object surroundings split only the wall piece an opening lies on", "[geometry][wall]")`**
in `test/planner/geometry/object-surrounding-geometry-test.cpp`.

It calls `ObjectSurroundings::addWallOpenings` directly, on a hand-built level-0 contour of the
square — START (−3000, 3000), WALL (−3000, −3000), WALL (3000, −3000), WALL (3000, 3000),
WALL (−3000, 3000) — with the openings in an explicit order. Only this test controls the order:
the planner passes the openings in the order of `Wall::getAttachedObjects`, a
`std::set<ConstructionObjectPtr>` ordered by pointer, and each order fails today in a different
condition. A helper in the file's anonymous namespace compares a contour with the expected segments
(type, and position with `closeTo`).

| Section | Openings, in this order | Expected along y −3000 | Fails today in |
|---|---|---|---|
| the second opening lies after the first | A, B | level 0: wall to −1950, gap to −1050, wall to 550, gap to 1450, wall to 3000; level 2100: the square | `dStart > 0` |
| the second opening lies before the first | B, A | the same | `dEnd < segmentLength`, the Open-Plan Room case |
| the third opening lies between the first two | A, B, C | level 0: wall to −1950, gap to −1050, wall to −700, gap to 200, wall to 550, gap to 1450, wall to 3000 | both, in one call |
| the contour runs against the wall | A, B on the square traversed clockwise | level 0, from 3000: wall to 1450, gap to 550, wall to −1050, gap to −1950, wall to −3000 | `dEnd < segmentLength`, after the swap |
| a door and a window at different heights | A, W and W, A as two nested sections | level 0: gap of A; 900: gaps of A and W; 1900: gap of A; 2100: the square | the contour at 900 is copied with the first opening's gap |

**2. New SECTIONs in `TEST_CASE("plan room geometry modes")`**,
`test/planner/geometry/plan-room-geometry-test.cpp`. They take the path of
`getExternalRoomInformation`, with the planner's own opening order.

- **"plan mode splits a wall with two doors into wall, gap, wall, gap, wall"** — doors A and B,
  `PlanRoomGeometryMode::PLAN`, the mode roomle-ui requests; no section covers it yet. Level 0
  exactly: `M` (−3000, 3000), then `L` (−3000, −3000) wall, (−1950, −3000) wall,
  (−1050, −3000) gap, (550, −3000) wall, (1450, −3000) gap, (3000, −3000) wall, (3000, 3000) wall,
  (−3000, 3000) wall, each with height 2800 and thickness 120. It uses `requireWallSegment` and a new
  `requireGapSegment` for the type `""`. Levels 2100 and 2800 keep five segments.
- **"room mode keeps the points along a wall in its direction on every layer"** — doors A and C and
  window W. On every level the x values of the points on y −3000 increase strictly in contour
  order, and the wall and gap types alternate as expected: 0 and 1900 with the gaps of A and C, 900
  with A, C and W, 2100 and 2800 without a gap.
- **"room mode splits the face of a wall with objects at two doors"** — the overload for walls with
  objects, for the wall at y −3060 with `WallSide::Left` and with `WallSide::Right` as two nested
  sections. The right face is reversed (`plan-room-geometry.cpp:258`), so its points run from +x to
  −x. Expected: wall, gap, wall, gap, wall along the face, with its start and end taken from
  `createWallLine(side)`.

**3. New nested SECTION in `TEST_CASE("object surrounding geometry test")`, `SECTION("doors and windows")`**:
"square plan and two simple objects in corner with two windows near object". This is the
surroundings the HOMAG library receives for a group
(`external-configuration-manipulation.cpp:331`). The object is the one of the window sections: two
simple articles 800 × 600 × 900 at (−2200, 2700). The windows are 400 × 100 × 1000 at
(−2700, 3000, 900) and (−1700, 3000, 900). Levels 0, 1900 and 2800 are as in the one-window
section. Level 900: START (−3000, 3000), WALL (−3000, 2100), EMPTY (−1100, 2100),
EMPTY (−1100, 3000), WALL (−1500, 3000), EMPTY (−1900, 3000), WALL (−2500, 3000),
EMPTY (−2900, 3000), WALL (−3000, 3000).

**Must stay green unchanged:** the existing opening sections of both files, which have one opening
per wall; "object surrounding geometry at an opening of a curved wall"; "external room information
for the whole plan".

### RoomleCore: documentation

- `documentation/features/walls/room-contour-geometry.md`: a second invariant. The contour of
  `ROOM` and `PLAN` mode runs counter-clockwise with the room on its left, and the points along a
  wall face follow the face's direction, because an opening splits only the wall piece it overlaps.
  The new tests go into "Guarding tests".
- Close out the RoomleCore analysis with `roomle-analysis-closeout`: delete
  `documentation/bug-analysis/second-opening-on-a-wall-makes-the-room-contour-run-back.md` and its
  row in `documentation/README.md`, in the same branch.

### Verification

1. Build `PlannerKernelTest` and run the new sections on the unfixed code. They fail; the failing
   sections are recorded.
2. Apply the fix. Run `"[geometry]"`, `"[wall]"`, then the whole `PlannerKernelTest`, and
   `npm run format:c++`.
3. Playground: the Open-Plan Room in `PLAN` mode. The front wall reads wall to −3849, gap to −1749,
   wall to −1699, gap to 401, wall to 3248, at levels 0 and 2100. The downloaded plan file
   (`__ps_…`) is not committed.

### Commits and order

1. RoomleCore, branch `fix/second-opening-room-contour`, after its analysis commit:
   `fix: split only the wall piece an opening overlaps` with the fix and the tests, and
   `docs: state the direction of the room contour and close out its analysis`. Push and pull
   request wait for a go.
2. A kernel release with the fix. roomle-ui bumps `roomle-core-hsc`
   (`packages/web-sdk/package.json:39`) with no code change.
3. roomle-hi-example, after that roomle-ui deployment: the [reproduction](#reproduce), then finding 1
   leaves the backlog and this analysis is closed. No unit test here: the server has no code to
   change. ligna-store: nothing.

### Open points

1. **Live check before the pull request.** The acceptance criterion is read in `get-plan-context`.
   It can run before the pull request with a local kernel build in a local roomle-ui, or after the
   kernel release. The plan checks it after the release; the playground dump covers the kernel side
   before.
2. **An opening that covers a whole wall piece** keeps that piece a wall, because neither split
   condition fires. It needs overlapping openings, for example a door across the short wall between
   two others. It is not part of this fix.
3. **Two openings that touch.** The split conditions have no tolerance, so two openings that touch
   can leave a wall piece of a fraction of a millimetre between them. The fix leaves this as it is,
   as the ticket keeps the split unchanged.

## Implementation

[RoomleCore PR #2565](https://github.com/roomle-internal/RoomleCore/pull/2565), branch
`fix/second-opening-room-contour`, implements the plan without deviation in the fix. Two details
of the tests differ from the plan:

- On the walls of `simpleSquare6x6` the room side is the right face, not the left. The section for
  walls with objects therefore finds the wall by either face and derives the expected direction
  from the face line, for both faces.
- The expected contours are compared as text lists ("WALL −1950, −3000", "gap to −1050"), so a
  failure prints the whole contour.

| Check | Without the fix | With the fix |
|---|---|---|
| The new sections in both test files | every section fails, each with a contour that runs back | all pass |
| Full `PlannerKernelTest` (Debug) | — | 2752 test cases pass |
| Playground, Open-Plan Room, `PLAN` mode, front wall | the gap from 401 back to −1749, then a wall to 3248 | wall to −3849, gap to −1749, wall to −1699, gap to 401, wall to 3248, at levels 0 and 2100 |

Open: the [reproduction](#reproduce) in `get-plan-context` once roomle-ui takes a kernel release with
the fix.
