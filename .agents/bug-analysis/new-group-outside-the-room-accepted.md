# create-or-replace-groups loads a new group outside the room

> **Type**: Bug Analysis
> **Domain**: hi-mcp — `create-or-replace-groups` after the load (`hi-mcp/hi-mcp-poc-json/tool-executors.ts`), the room geometry helpers (`plan-space.ts`), the served rules (`hi-mcp-server.ts`)
> **Trigger**: "test the mcp" run `.temp/result/mcp-test-2026-10-01_11-35-00/report.md` (Mistral Large, planner `bo-test`): 2 of 4 fails, runs 02 and 12
> **Date**: 2026-10-01
> **Author**: AI Assistant
> **Status**: Rejected — the fix was implemented on `fix/mistral-mcp-test` and dropped in review before PR #42; it never reached `master`
> **Branch**: `fix/mistral-mcp-test`

> **Rejected (2026-10-01, review)**: a group outside the room is not a defect the server may
> refuse. The user can ask for a placement outside the room (a terrace, a neighbouring space
> without walls in the plan, a parking spot while planning), and the server cannot tell that
> request from a wrong placement. The room check was removed with its tests, rule sentence and
> docs. A group outside the room stays a **model finding** in "test the mcp", not a hardening
> candidate (`.agents/skills/hi-mcp-testing.md`). The sections below record the analysis as it
> was made. The validation numbers (suite 12:08) show what the check did while it existed.

---

## Scope

The report classifies both runs as model findings with a hardening candidate. The model's
placement was wrong, and the server loaded a group that stands entirely outside the room. No
plan may contain such a group. The server has the walls and the group's calculated footprint
after the load, so it can refuse it. This analysis treats that as the server's defect.

The same gap was located once before, as H1 of
[unconnected-docking-graph-accepted.md](unconnected-docking-graph-accepted.md#h1-a-footprint-outside-the-room-runs-02-06)
(gpt-5.4-mini, 2026-09-30, runs 02 and 06), and was left open for review. This suite shows it
again with another model.

## Symptom

| Run | Prompt | Placement sent (`planner-calls.json`) | Group after the load (`plan-context.json`) |
|---|---|---|---|
| 02 | add a group of 4 cabinets to the wall in the back | `posGroup [4815, 0, -3765]`, `posRotationY 0` (four `OTB60`) | `pos [4815, 0, -3765]`, `rotationY 0`, footprint x 0 … 2400, z 0 … 406 |
| 12 (setup) | add a group of three tall units to the wall on the right | `posGroup [4815, 0, 1235]`, `posRotationY 270` (three `KS_HT600`) | `pos [4815, 0, 1235]`, `rotationY 270`, footprint x 0 … 1800, z 0 … 617 |

The room spans x −685 … 4815, z −3765 … 1235. Its walls (`rooms.rooms[0].walls`) are:

| Index | Side | Start | End | Facing |
|---|---|---|---|---|
| 1 | bottom | `[-685, 0, 1235]` | `[4815, 0, 1235]` | 180 |
| 2, 3, 4 | right | `[4815, 0, 1235]` … | … `[4815, 0, -3765]` (3 = the door opening) | 270 |
| 5 | top | `[4815, 0, -3765]` | `[-685, 0, -3765]` | 0 |

- **02**: `[4815, 0, -3765]` is the back wall's `start`. Rotated 0, the row runs room +x from
  there, so it spans x 4815 … 7215 and stands behind the right wall. The top image shows the grey
  strip right of the room. The model's answer says "flush into the back right corner".
- **12**: `[4815, 0, 1235]` is the start of the right side, the front right corner. Rotated 270,
  the row runs room +z, so it spans z 1235 … 3035 in front of the front wall (`plan.xml`:
  `y="2135" width="1800"`). The following delete and merge worked on a group outside the room.

The footprint corners in room coordinates, computed from the plan context of every run of the
suite. "Outside" is how far the farthest corner lies outside the floor polygon of the walls:

| Run | Group | Outside |
|---|---|---|
| 02 | `728c2b8c` | **2400 mm** |
| 12 | `44d31f42` | **1800 mm** |
| 04 | `4dec1ab8` (flush in the corner) | 10 mm |
| 07 | `5e5c7332` (flush in the front right corner) | 10 mm |
| all others (01, 03, 05, 06, 07, 08–11) | | 0 mm |

The 10 mm come from flush placements: the outermost part of the group (the worktop or the side)
reaches 10 mm past the carcase into the adjoining wall. Corner kitchens (03, 05, 06) stand at
0 mm now that the server applies the corner offset itself.

## Investigation

`create-or-replace-groups` (`tool-executors.ts:613-813`):

1. It validates the payload before any planner call (`:616-693`) and reads the plan's groups
   (`:695-699`, `beforeGroupIds`).
2. It turns the placement into `repositioningData` (`:753-770`, `toRepositioningData` in
   `group-placement.ts:224-256`). That is a pure transform: `posGroup` and `posRotationY` pass
   through unchanged unless a corner article needs its offset.
3. It loads (`:772-778`) and reads the groups again (`:786-789`). Every group then carries
   `position: { pos, rotationY, footprint: { x, z, widthMm, depthMm } }`. The footprint is
   group-local, which is the shape `footprintCornersInRoom` takes (`plan-space.ts:399-412`).
4. Its only check after the load is the hint for a new group without a position (`:796-811`).

Nothing compares the footprint with the room. The walls the comparison needs are in the plan
context (`rooms`). roomle-ui derives them from the straight segments of the level-0 contour, in
contour order (`hi-plan-context.ts`, `deriveWalls`), so the walls' start points form the floor
polygon. A room with curved segments has no walls.

A check before the load is not possible. The footprint is the planner's arrangement (docking,
corner offsets, generated worktop and toe kick), not the sum of the catalog dimensions.

## Root cause

`create-or-replace-groups` (`tool-executors.ts:786-812` before the fix) accepted whatever the
planner arranged at the given placement. It did not test the resulting footprint against the
room, although both were in the plan context it read right after the load. A placement at a wall's `start` with
that wall's `facingRotationY` turns the row away from the room. The server loads it and reports
success, and the model takes the success at face value: both answers claim the group stands
against the wall.

## Why it was left open before

PR #24 (`bc6ce15`) had an out-of-room **hint** and was reverted in `1e979da`. The findings
([agent-placement-in-a-room-corner-findings.md](agent-placement-in-a-room-corner-findings.md),
§7 A1) attribute the bad corner runs of that evening to two things: the PR's rule sentences,
which described the corner article's second leg as an error, and the hint firing on the corner
article's first load. At that time the server did not add the corner offset, so every correct
corner kitchen stood 261 mm off at first. Since `686fe94`/`3134bf3`/`91075c9` the server places
the corner point exactly: runs 03, 05 and 06 stand 0 mm outside. Neither objection applies to a
check that runs on the final load only and adds no corner rule.

## Fix

1. **`plan-space.ts`**: `footprintOutsideRoomMm(corners, walls)` returns how far a footprint
   reaches outside the floor polygon of the walls. That is the largest distance of a footprint
   corner outside the polygon, and of a polygon corner inside the footprint (a group across a
   re-entrant corner of an L-shaped room). A room without walls gives 0.
2. **`tool-executors.ts`**, after the load of `create-or-replace-groups`:
   - it reads `['rooms', 'groups']` instead of `['groups']`, still one call;
   - for every group new in the plan (`!beforeGroupIds.has(id)`) with a position, it takes the
     footprint corners in the room (`outOfRoomErrors`);
   - a group counts as inside when one room holds it with at most `ROOM_TOLERANCE_MM` (100 mm)
     outside. The 10 mm overhang of a flush group passes; a group off by a unit width does not;
   - otherwise it removes every group the call created (`removeExternalObject`) and throws. The
     error names each group's rotation, size, footprint corners and distance outside, and the
     room's extent. It restates that `posGroup` is the back **left** corner and the row runs to
     the group's right, gives the formulas for flush at the wall's end and at its start, and
     names `place-group`.

   It rejects rather than hints, unlike PR #24: a hint leaves the group outside the room when the
   model ignores it, as the answers of 02 and 12 suggest it would.
3. **The served rules** (`hi-mcp-server.ts`, the placement bullet): a new group whose calculated
   footprint reaches outside the room is removed again and the call rejected.
4. **Tests**: `tests/plan-space.test.ts` covers inside or flush, outside (10 mm and 2400 mm), a
   turned footprint across the re-entrant corner of an L-shaped room, and a room without walls.
   `tests/tool-executors.test.ts` covers the run-02 shape (rejected, the new group removed), a
   flush group with a 10 mm overhang (loaded), and a group already in the plan (not checked).
   The existing test of the plan-context calls expects `['rooms', 'groups']`.
5. **Living docs**: `minimal-hi-example/docs/hi-mcp-server.md`,
   `hi-mcp/hi-mcp-poc-json/README.md`, `.agents/skills/hi-mcp-tools.md` (common errors),
   `.agents/skills/hi-authoring-rules.md` (validation rules), `.agents/skills/hi-mcp-testing.md`
   (the footprint outside the room is no longer a hardening example).

Not covered, by design:

- **A replaced group** (an existing id, no placement) that grows through a wall. Rejecting it
  would mean restoring the previous version. Neither suite saw a case.
- **`place-group`**. It computes the position from the walls itself; only a group longer than the
  wall could leave the room there.
- **Commands**. The merge of the open toe-kick analysis puts a group 120 mm into the wall (run 12
  of the second suite). That is a roomle-ui defect, and the commands are not checked.

## Validation

- `npm test` (hi-mcp, `hi-mcp-poc-json`): 193 tests pass, `npm run typecheck` is clean.
  `cf/tests/worker.test.ts` fails before and after the change: `@cloudflare/containers` is not
  installed in this checkout.
- **Live, bo-test, before the suite** (MCP tool calls straight to the server, headless page):
  - the run-02 payload was rejected with "reach 2400 mm outside the room … room 0 spans x
    −685 … 4815, z −3765 … 1235", and the plan context afterwards had no group;
  - the same group at `[2415, 0, -3765]` loaded.
- **"test the mcp" again** (`.temp/result/mcp-test-2026-10-01_12-08-07/report.md`, Mistral Large,
  bo-test):
  - the check fired in 9 calls of 5 runs (01, 02, 05, 07, 08); each rejected footprint lay
    600–2400 mm outside the room;
  - the model corrected the placement within the turn every time. In 05 the error's
    `d = lengthMm − width` led from `[4815 …]` and `[4215 …]` to `[3005, 0, -3765]`, flush into
    the back right corner;
  - no final plan has a group outside the room (first suite: 2); 02 and 12 went from fail to
    partial (02: in front of the window, 12: the known toe-kick defect);
  - no correct placement was rejected: every flush group stood at ≤ 10 mm.

## Alternatives considered and rejected

- **The hint of PR #24**: see above. It leaves the impossible plan in place.
- **A check before the load from catalog dimensions**: wrong for corner articles, gaps, worktop
  and toe kick. The calculated footprint is the only reliable one.
- **Moving the group into the room**: the server cannot know which corner or wall the model meant.
  `place-group` exists for that when the model names it.
