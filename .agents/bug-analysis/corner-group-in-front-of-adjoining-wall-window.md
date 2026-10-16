# Bug analysis — a corner group stands in front of the adjoining wall's window

> **Type**: Bug analysis
> **Status**: Open
> **Ticket**: [RML-18201](https://roomle.atlassian.net/browse/RML-18201)
> **Date**: 2026-10-16
> **Base**: roomle-hi-example `master` (`5e384ca`), roomle-ui `release/bo-test` (`b2dbcb202`)
> **Backlog**: item 66 of [`../backlog/mcp-issues.md`](../backlog/mcp-issues.md#66-a-corner-group-stands-in-front-of-the-adjoining-walls-window)

## Affected repositories

- **roomle-ui** — the fix: the obstacle hint of the HI tool commands (`obstacleHint`,
  `freeStretchesNote`, `homag-intelligence/src/hi-tool-hints.ts`), the two tool commands that pass
  it their wall placement (`create-or-replace-groups` and `place-group`, `hi-tool-commands.ts`) and
  their tests in `__tests__/hi-tool-commands/`. The fix lands on `release/bo-test`.
- **roomle-hi-example** — the served sentences on the hint (`AUTHORING_RULES` and the description of
  `create-or-replace-groups`, `hi-mcp/hi-mcp-server/hi-mcp-server.ts`) and their test, D55 and §8 of
  [`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md), the tool reference
  ([`.agents/skills/hi-mcp-tools.md`](../skills/hi-mcp-tools.md),
  [`docs/hi-mcp-server.md`](../../docs/hi-mcp-server.md)), backlog item 66, this analysis.
- **ligna-store** — no change: the store runs the same MCP server and planner and holds no copy of
  the hint or the rule.
- **RoomleCore** — no change: the room contour and the window are right.

## Symptom

Test `image-only-no-text` (plan `ps_s04w4a2spp6ifskj43clh1y2g6r436i`, `default-room`, a galley
kitchen from `docs/images/kitchen-4.png` without text), gpt-6-astra, session
`mcp-test-2026-10-14_13-34-58`, run 48:

1. `create-or-replace-groups` creates the left run with the placement wall `left`, alignment
   `back`, `offsetMm` 450.
2. The result's `hint` names the wall unit at the back end of the run in front of the back wall's
   window.
3. The agent moves the group with `place-group` to `offsetMm` 650 — one more step, about 8 s.

The run directory of that session is no longer in `.temp/result`. The geometry below comes from
the rerun of the same test on the same plan (session `mcp-test-2026-10-16_11-57-20`, run 48, the
same units placed with `offsetMm` 600), shifted by the 150 mm of the reference's `offsetMm` 450.
The hint of the reference is the D55 example of `create-or-replace-groups` in §8 of
[`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md), with the same numbers.

## The geometry

| What | Where |
|---|---|
| Room | x −685 to 4815, z −3765 (back) to 1235 (front) |
| Left wall (wall 0) | x −685, from z −3765 (its start, the back corner) to z 1235 (its end, the front corner), 5000 mm |
| Window (back wall, wall 5) | x −450 to 1650, `fromEndMm` 235 to 2335 (the back wall ends at the left corner), 950 to 2170 mm |
| Strip in front of the window | x −450 to 1650, z −3765 to −3165 (600 mm, `WALL_STRIP_MM`), 950 to 2170 mm |
| Left run | fridge HK260 at the front end … drawers US2A30 at the back end, wall units OTB60, OTB60, hood DU, OTB30; footprint 2710 mm, root modules 2700 mm — the footprint begins 10 mm before the back-most root modules |
| Back end at `offsetMm` 450 | US2A30 0 to 870 mm — below the sill, clear; OTB30 1530 to 2250 mm, 403 mm deep (x −685 to −282), z −3305 to −3005 |
| Overlap of the OTB30 with the strip | x −450 to −282 (168 mm), z −3305 to −3165 (140 mm), height 1530 to 2170 mm |

At `offsetMm` 590 the OTB30 begins 600 mm from the back wall and touches the strip without
overlapping it. The agent's 650 clears it by 60 mm.

## Investigation trace

### The first placement: the served corner rule of the build

The reference ran on roomle-hi-example `340532f`. Its corner rule in `AUTHORING_RULES`
(`hi-mcp/hi-mcp-server/hi-mcp-server.ts:26` today) read:

> A group placed in a room corner reaches along the adjoining wall by its depth: a door or a window
> within that depth of the corner on the adjoining wall is in its way - choose the other corner, or
> an offsetMm past the opening's span.

The opening's span is measured along the back wall (`fromEndMm` 235 to 2335), `offsetMm` along the
left wall. "Past the opening's span" names no distance on the group's wall; the only number the
agent had near the corner was 235, and 450 is past it. The rule pointed the agent at the wrong
axis.

roomle-hi-example `7c26d9c` (2026-10-14 14:47, on master) changed the rule to:

> … when the user leaves the corner open, choose the other corner, or an offsetMm of at least 600 mm
> from that corner, which keeps the group out of the 600 mm strip in front of the opening.

In the rerun of 2026-10-16 the model placed both runs with `offsetMm` 600 in one call, without
`place-group`. The report of that session keeps item 66 open: one run that does not show it is no
fix.

### What the hint says

The create calls `obstacleHint` after the load and the wall placement
(`hi-tool-commands.ts:595-608`), `place-group` after its reload (`hi-tool-commands.ts:732-743`).

- `objectBlockers` (`hi-tool-hints.ts:292-333`) turns the window into the strip in front of it on
  its own wall: `stripInFrontOfWall(wall, [from, to], WALL_STRIP_MM)` (`hi-tool-hints.ts:316`,
  `hi-plan-space.ts:959-968`).
- `obstacleHint` (`hi-tool-hints.ts:426-503`) tests every root module of the groups of the call
  against the blockers; the OTB30 overlaps the strip (`volumesOverlap`, `hi-plan-space.ts:803-812`).
- `freeStretchesNote` (`hi-tool-hints.ts:379-410`) adds the free stretches of the root module's
  wall. Its wall is the one it faces away from (`wallOfRoot`, `hi-plan-space.ts:978-1005`): the
  left wall.
- `freeStretchesAlongWall` (`hi-plan-space.ts:1010-1055`) lays a strip as deep as the root module
  along the whole left wall, at its height, and takes out the span of every blocker that overlaps
  it — the window's strip included: it covers 0 to 600 mm from the left wall's start. The free
  stretch is 600 to 5000 from the start, returned as `fromEndMm` measured from the wall's end:
  **0 to 4400**.

The hint therefore reads (D55, §8):

> Root module 'w1' (OTB30) of group '…' stands in front of the window in the back wall (wall 5,
> fromEndMm 235 to 2335, 950 to 2170 mm) - free stretches of the left wall (wall 0) at its height:
> fromEndMm 0 to 4400. The groups were built as sent - move or change them if the user did not ask
> for them there.

The window does shorten the stretch. The backlog's cause sentence ("the free stretches of the root
module's own wall — which the adjoining wall's window does not shorten") is not accurate; the gap is
the frame the stretch is given in.

### The frame of the placement

The agent moves the group by `wall`, `alignment` and `offsetMm`:

- a side label as alignment resolves to the start or the end of the wall
  (`resolveWallAlignment`, `hi-plan-space.ts:1097-1119`): `back` on the left wall is its `start`;
- `wallSpanStart` (`hi-plan-space.ts:1122-1139`) measures `offsetMm` from that corner — from the
  start for `start`, from the end for `end`, from the middle for `center` — and for the group's
  footprint, not for a root module.

To keep the run in the back corner, the agent has to turn "fromEndMm 0 to 4400" on the left wall
into an `offsetMm` from the back corner: 5000 − 4400 = 600 for the root module, minus the 10 mm by
which the footprint begins before it, 590. Nothing in the hint names the wall's length, which end is
the back corner, or the root module's place in the group. The agent sent 650.

The served rule offers a direct path only for a free stretch at the wall's end: "a placement with
that wall, alignment end and offsetMm = the start of a free stretch puts the group on it"
(`hi-mcp-server.ts:26`). Here that would put the run into the front corner, away from where the
image has it.

### What the tool knows

The tool has every number it needs at the call of `obstacleHint`:

- the create resolves each wall placement before the load (`wallPlacements`,
  `hi-tool-commands.ts:383-408`: the spec of `wallPlacementSpec`, `hi-wall-placement.ts:467-476`,
  and the resolved wall of `resolveWallPlacement`, `hi-wall-placement.ts:480-501`) and places the
  group by `wallTarget` (`hi-tool-commands.ts:185-192`, `hi-wall-placement.ts:505-552`), whose
  `GroupPlacement` names the piece or face the group stands along (`along`) and `placedIn`
  (`hi-wall-placement.ts:272-280`, `348-393`);
- `place-group` has the same spec and placement (`hi-tool-commands.ts:643-664`, `706`).

`obstacleHint` receives neither (`ObstacleHintInput`, `hi-tool-hints.ts:412-420`).

## Root cause

1. **Served text — the corner rule** (`hi-mcp/hi-mcp-server/hi-mcp-server.ts:26` at `340532f`):
   "an offsetMm past the opening's span" sent the agent to the opening's span on the adjoining wall
   instead of a distance on its own wall. Clarified by `7c26d9c`, on master.
2. **Tool API — the hint answers in another frame than the placement** (`freeStretchesNote`,
   `hi-tool-hints.ts:379-410`; `freeStretchesAlongWall`, `hi-plan-space.ts:1010-1055`): it names the
   root module's free stretches in `fromEndMm` of its wall, while the agent places the group by
   alignment and `offsetMm` from the corner. The agent computes a number the tool can derive
   (Guards Are a Last Resort, step 2). Open.

## Why the current code produces this

`obstacleHint` is a test of the plan after the call: it knows the root modules and the blockers, not
the placement that put them there. Its free stretches serve a placement the agent has not made yet
— "choose a stretch … alignment end and offsetMm = the start of a free stretch". For a group that
is already placed into a corner and only needs to move away from it, the stretch is in the frame of
the wall's far end.

## Proposed fix

Result only, no change of the placement: the group is still built where the agent put it (D51,
D55).

**roomle-ui.**

- `obstacleHint` gets the wall placements of the groups of the call: per group id the spec
  (`wall`, `alignment`, `offsetMm` as the agent sent them) and the `GroupPlacement` of `wallTarget`.
  The create passes them from `wallPlacements` and the placements of the loop at
  `hi-tool-commands.ts:172-200`, `place-group` its `spec` and `placement`. Row edits
  (`withRowHints`, `hi-tool-hints.ts:211-251`) pass none.
- For a group placed at a wall (`placedIn` `wall`) whose root modules stand in the strip in front
  of a door or a window of another wall than their own, and whose own wall is the piece or face the
  group stands along: the spans along that wall of the strip and of those root modules
  (`spanAlongWall`) give the shift that moves the root modules out of the strip, away from the
  corner the strip lies at. The shifted span start of the group, turned back into the `offsetMm` of
  the sent alignment (the inverse of `wallSpanStart`: `start` → the span start; `end` → wall length
  − footprint width − span start; `center` → span start − (wall length − footprint width) / 2), is
  named once per group and opening, after its root module sentences, with the wall and alignment
  as sent — for example: "offsetMm 590 with wall 'left' and alignment 'back' keeps group '…' clear
  of the window in the back wall."
- Fallbacks, with today's hint unchanged: a door or a window of the root module's own wall (the
  free stretches and the rule's "alignment end" path serve it), a group placed by point, a corner
  article placed by its corner point (`placedIn` `corner` — its `offsetMm` moves the corner along
  one wall, off the other), and a shift that would make the group reach past the wall's other end.

**roomle-hi-example.**

- The served sentences on the hint — the last sentence of the obstacles rule
  (`hi-mcp-server.ts:26`) and the `create-or-replace-groups` description (`hi-mcp-server.ts:329`) —
  name the clearing `offsetMm` for a group placed into a corner in front of an opening of the
  adjoining wall. Shorter, not longer: one clause.
- D55 (§3) and the D55 rows of §8 of `docs/hi-mcp-behaviour.md` with the new hint text;
  `.agents/skills/hi-mcp-tools.md` (lines 82, 207), `docs/hi-mcp-server.md` (lines 496, 573),
  `.agents/skills/hi-authoring-rules.md` (lines 235, 299) and `.agents/skills/roomle-hi-concepts.md`
  (line 170) where they describe the hint's content.
- Backlog item 66 leaves `.agents/backlog/mcp-issues.md`.

## What the fix does not do

The hint arrives with the create's result; after a placement in the strip the agent still moves the
group, one step. The fix makes that step exact without the agent's arithmetic. The first placement
is the served rule's (root cause 1). The backlog's test ("the create places the left group clear of
the back wall's window, no `place-group` after it") checks the rule, not the hint, and the rerun of
2026-10-16 met it.

## Rejected approaches

- **Move the group out of the strip** (a correction): D55 builds a group where the agent puts it —
  the user may want a unit there — and `place-group` does not move a group off an opening. The
  server cannot tell a corner the user named from one the agent chose.
- **Measure the free stretches from the aligned corner instead of the wall's end**: it would change
  the frame of every hint and break the rule's "alignment end and offsetMm = the start of a free
  stretch"; D81 rejected stretches in another frame than the placement for the same reason.
- **A guard against a placement in the strip**: wrong content is an instruction problem first
  (Guards Are a Last Resort), and the user may want it (D51).
- **A longer served rule**: the rule names the 600 mm since `7c26d9c`; the remaining computation is
  the tool's to do.

## Tests

**roomle-ui** (`packages/web-sdk/packages/homag-intelligence/__tests__/hi-tool-commands/`):

- `create-or-replace-groups-placement-test.ts`, `describe('obstacle hints')`: the case of
  `it('names a corner unit on the adjoining wall that reaches into a window')` (line 1995 — today
  "free stretches of the left wall (wall 3) at its height: fromEndMm 0 to 2400", nothing in the
  frame of the placement) sent with a placement by wall into the back corner: the hint names the
  clearing `offsetMm`. The same at the other corner with alignment `end`, where the shift runs the
  other way.
- The fallbacks: a window of the root module's own wall, a placement by point, a corner article
  placed into the corner, no `offsetMm` on the wall that clears it — the hint as today.
- `place-group-test.ts`: a group moved into a corner in front of the adjoining wall's window gets
  the clearing `offsetMm`.

**roomle-hi-example**: `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` (lines 982, 1001) with the
new served sentences.

**Reproduce.** The hint part is deterministic: the unit test at line 1995 above. The first placement
is model-dependent: test `image-only-no-text` with gpt-6-astra (session
`mcp-test-2026-10-14_13-34-58` showed it, `mcp-test-2026-10-16_11-57-20` did not).
