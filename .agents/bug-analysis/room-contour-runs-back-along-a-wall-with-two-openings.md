# Bug Analysis: the room contour runs back along a wall with two openings

> **Type**: Bug Analysis
> **Domain**: RoomleCore `ObjectSurroundings::addOpeningToContour` (`src/planner/geometry/object-surrounding-geometry.cpp`); consumers: roomle-ui `deriveWalls` (`homag-intelligence/src/hi-plan-context.ts`), the `walls` of `get-plan-context` and the wall placement of `place-group`
> **Trigger**: [RML-18072](https://roomle.atlassian.net/browse/RML-18072); origin: [finding 1 of the plan context backlog](../backlog/plan-context-open-findings.md#1-a-wall-entry-that-runs-against-the-contour-gets-the-opposite-side)
> **Date**: 2026-10-07
> **Author**: AI Assistant
> **Status**: Open — root cause verified against RoomleCore `master`; the RoomleCore analysis is on its branch `fix/second-opening-room-contour` (documentation only, no fix yet)

## Affected repositories

- **RoomleCore** — the defect and the fix: `addOpeningToContour` splits only the wall piece the
  opening overlaps; a test with two doors on one wall in `plan-room-geometry-test.cpp` and one for
  the surroundings of an object in `object-surrounding-geometry-test.cpp`; the contour invariant in
  `documentation/features/walls/room-contour-geometry.md`; the analysis
  `documentation/bug-analysis/second-opening-on-a-wall-makes-the-room-contour-run-back.md`.
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

## Fix

RoomleCore, `addOpeningToContour`: skip a wall piece the opening does not overlap
(`dEnd <= 0 || dStart >= segmentLength`) before splitting it. The split of the overlapped piece
stays as it is.

## Tests

- RoomleCore `plan room geometry modes`: two doors on one wall, in both insertion orders —
  wall, gap, wall, gap, wall, every point inside the wall and ordered in the wall's direction.
- RoomleCore `object-surrounding-geometry-test.cpp`: the surroundings of an object in front of a
  wall with two openings (`getObjectSurroundings` calls the same `addWallOpenings`; not reproduced).
- roomle-hi-example: nothing to add — the server has no logic to change. The reproduction below is
  the acceptance check once the kernel is in roomle-ui.

## Reproduce

`get-plan-context` on the Open-Plan Room. Today the front wall has an entry with the side `top`
and `facingRotationY` 0 from x 401 to −1749. Fixed: every entry of the front wall has the side
`bottom` and `facingRotationY` 180, and the wall after door 69 runs from 401 to 3248.

In RoomleCore: `npm run rapi:plan -- ps_qwm5odi6tyflyqwpdcxz1la791ho633` in `node/`, load the plan
in `TEST_CASE("playground load plan XML")` and dump
`PlanRoomGeometry(PlanRoomGeometryMode::PLAN).fillRoomGeometry(floor, contours)`.

## Next steps

1. RoomleCore: the implementation plan (fix, the two tests, the invariant in the contour
   documentation), then the fix on `fix/second-opening-room-contour`.
2. A kernel release and the `roomle-core-hsc` bump in roomle-ui.
3. roomle-hi-example: run the reproduction, remove finding 1 from the backlog, close this analysis.
