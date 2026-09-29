# Straight row docked past the corner: anchor in the corner, neighbour inside the wall

> **Type**: Bug Analysis
> **Domain**: hi-mcp — agent instructions and payload validation of the MCP server (`hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts`, `tool-executors.ts`); planner behaviour verified against homag-intelligence (roomle-ui) and the plan snapshot
> **Trigger**: prompt "plan a kitchen with an oven, a sink and a fridge in the back right corner of the room" — the second unit stands in the corner, the first does not
> **Date**: 2026-09-29
> **Author**: AI Assistant
> **Status**: Open

> **Progress (2026-09-29)**: F1, F2 and F5 are implemented on branch
> `fix/straight-row-corner-anchor-offset` (instructions only): the docking rules name the frame
> of Left/Right (as seen from the front of the unit), the wall rule states that a row continues
> from the anchor's `RightBottom` only and that a `LeftBottom` neighbour lands inside the adjoining
> wall, the per-corner leg table moved under the corner-article recipe and is marked "corner
> article only" with the straight-unit alternative beside it, and the verify rule checks
> `position.footprint` against the walls. Mirrored into `minimal-hi-example/docs/hi-mcp-server.md`
> and `.agents/skills/hi-authoring-rules.md`; one test asserts the new rule text.
>
> **Progress (2026-09-29, later)**: F3 and F4 are implemented in `tool-executors.ts` on the same
> branch. F3 collects every beside and back-to-back joint (`RightBottom ↔ LeftBottom`,
> `BackBottom ↔ BackBottom`, `BackTop ↔ BackTop`) from the authored `contextData` and rejects a
> vector claimed by two different partners, naming root, vector and partners; stacking pairs are
> exempt. F4 fetches `rooms` with the pre-load context and, after the load, tests the four corners
> of each created or replaced group's `footprint` (shrunk by 1 mm) against the level-0 floor
> contour of every room with a point-in-polygon test; a group inside no room gets a `hint` with
> its footprint and the room extent that points at the docking. 20 new unit tests cover both
> (conflicts through two joints, in one entry, back to back, on the new root; accepted chains,
> two-sided joints, corner article rows, stacked wall units; hints for the back and the right
> wall, flush placement, replaced versus untouched groups, combined hints, an L-shaped room,
> several rooms, missing rooms or footprint). After the PR review (#24) the room check also
> rejects a box edge crossing a contour edge (a box spanning the arms of a U-shaped room), the hint
> names the extent of the room the anchor stands in, and an anchor in no room is reported as a
> wrong `posGroup` instead of wrong docking; the PoC README carries the same rules and contract.
> The live verification with a fresh agent session is still pending — the analysis stays Open
> until then.

---

## Symptom and Reproduction

Prompt: "plan a kitchen with an oven, a sink and a fridge in the back right corner of the room",
same 5620 × 5120 mm room as the two earlier corner analyses (interior 5500 × 5000 mm, wall
thickness 120). Plan snapshot `ps_qg8qrlxkx1vwtq3yv1zk2fu3tcg5u2l` (downloaded with RoomleCore
`node/`: `npm run rapi:plan -- <id>`, external configuration extracted from the plan XML).
Screenshot `.temp/Screenshot 2026-09-29 at 18.03.10.png` (not committed).

What the screenshot shows, looking at the right wall: the tall oven unit stands left of the room
corner, sticking through the back wall; the tall fridge unit stands in the corner; the sink base
unit with its worktop is drawn through the lower part of the fridge unit.

## Data (from the snapshot)

One group, `libraryId Furniture_Smith`, `pos [4815, 0, -3765]`, `rotationY -90` (= 270),
`logMessages []`. The interior back right corner of the room is `[4815, 0, -3765]` — wall axes at
x 4875 / plan-y −3825, thickness 120, 60 mm to the interior face. So the **group origin is exactly
in the corner**.

Three article roots (plus the generated toe kick, countertop and finger grip), all straight
`mr_StorageunitSingle` units, `rotationY 0`, in this order:

| # | Root | Article | Width | `articlePos` (group-local) | Authored docking (`contextData`) |
|---|---|---|---|---|---|
| 1 | `e5192f7b` | `HK60` (tall fridge unit) | 600 | `[0, 0, 0]` | own `LeftBottom` → oven `RightBottom`, StartStart, `[0, 0, 0]` |
| 2 | `1730fe3b` | `HOTS2AB60` (tall oven unit) | 600 | `[-600, 0, 0]` | own `RightBottom` → sink `LeftBottom`, StartStart, `[0, 0, 0]` (plus the planner-completed reciprocal → fridge `LeftBottom`) |
| 3 | `ed41b072` | `ESUB2A90` (sink base unit) | 900 | `[0, 0, 0]` | none |

Every side vector of these units starts at the root origin: `LeftBottom [0, 0, 0] → [0, 0, 561]`,
`RightBottom [width, 0, 0] → [width, 0, 561]`, `BackBottom [0, 0, 0] → [width, 0, 0]`. None of
them carries a `LeftBack*`/`RightBack*` vector — **no corner article and no `cornerPoint` is
involved**.

Room-space placement (group rotation 270: local +x → room +z, local +z → room −x):

| Root | Room x | Room z | Where that is |
|---|---|---|---|
| fridge | 4254 … 4815 | −3765 … −3165 | flush in the back right corner, back against the right wall ✓ |
| oven | 4254 … 4815 | −4365 … −3765 | **600 mm behind the interior face of the back wall** (480 mm outside the building) |
| sink | 4254 … 4815 | −3765 … −2865 | **on top of the fridge** for the first 600 mm |

Group footprint (docking-vector box): x `[4254, 4815]`, z `[−4365, −2865]`.

## Investigation

### What the planner did (roomle-ui, no fault)

`_createOrReplacePosGroupsFromLayout` (`glue-logic.ts:680`) copies the article template into each
pick (`_prepareArticlePickRoots`, `:779`) and arranges the group
(`_arrangeRootModulesAndCalculateIfChanged`, `:2758`):

1. `_arrangePositions` (`hi-root-module-arrangement.ts:771`) seeds with `roots[0]` — no authored
   root carries an `articlePos`, so `_findRootClosestToZero` (`:911`) falls back to the first root
   (`:929`): the fridge gets `articlePos [0, 0, 0]`.
2. `_arrangeConnectedRoots` (`:825`) walks the docking breadth-first. Fridge `LeftBottom` (start
   `[0, 0, 0]`) meets oven `RightBottom` (start `[600, 0, 0]`) StartStart → oven at `[-600, 0, 0]`.
   Oven `RightBottom` (start `[0, 0, 0]` in group space) meets sink `LeftBottom` → sink at
   `[0, 0, 0]`. Exactly what `setModulePositionFromDocking` (`:351`) is asked to do; the fridge is
   already positioned, so the reciprocal entry the planner completed (`_completeDockingContextData`,
   `:502`) is skipped.
3. `_applyRepositioningData` (`:414`) puts the anchor root's origin at `posGroup` with
   `posRotationY`: fridge origin → `[4815, 0, -3765]`, rotation 270.

The planner has no collision or room-bounds check by design (see the refactoring analysis, D3:
"overlapping groups are not rejected"). It arranged the group exactly as authored.

`calculatedCornerPointsByRoot` (`hi-plan-context.ts:506`) and `cornerPointOfRoot` (`:280`) only
look at `LeftBack*`/`RightBack*` vectors (`CORNER_DOCKING_VECTOR_IDS`), so for the three straight
articles they yield nothing and the catalog carries no `cornerPoint` for them. The information
the plan context provided was correct: the wall data (`deriveWalls`, `:707`) gives the right wall
`start [4815, 0, 1235] → end [4815, 0, -3765]`, `facingRotationY 270`, and the back wall
`start [4815, 0, -3765] → end [-685, 0, -3765]`, `facingRotationY 0` — the agent took the right
wall's `end` and `facingRotationY`, and both are right.

### What the agent sent (reconstructed)

The server logs only the tool name (`hi-mcp-server.ts:90`), so the payload is reconstructed from
the snapshot, and the reconstruction is unambiguous:

- `roots` in the order fridge, oven, sink (the glue logic keeps the order; the fridge became the
  seed because it is first).
- `repositioningData: { posGroup: [4815, 0, -3765], posRotationY: 270, rootId: <fridge> }` — with
  the oven or the sink as `rootId` the group origin would have landed 600 mm further along the
  wall (`G = T · R⁻¹`, `:435`), not in the corner.
- The docking of the table above.

The intent behind it reads as: *the fridge goes into the corner; the oven goes "to the left" of
the fridge; the sink goes next to the oven.* "Left" is the top-view room direction along the back
wall (from the back right corner, the back wall runs to the left in the top view). But the agent
combined it with `posRotationY 270`, the rotation of the **right** wall — and with the wrong
vector for the sink.

### Why the payload passed the server

`create-or-replace-groups` (`tool-executors.ts:211-236`) checks only that every root is *related*
by docking: `dockedRootIds` = {fridge, oven, sink}, no undocked root, accepted. It does not see
that

- the oven's `RightBottom` is claimed twice — by the fridge (through the fridge's own entry,
  which is the same physical joint seen from the other side) and by the sink — so two units are
  docked beside the same side of one unit and must overlap;
- the row runs from the corner in the direction the wall does not continue.

After the load, the result gives the agent `position.pos = [4815, 0, -3765]` — the intended corner
point — and the verify rule (`hi-mcp-server.ts:32`) asks it to check exactly that. The check
passes, the agent reports success. The footprint (`z [−4365, −2865]` against a back wall at
`z −3765`) would have shown the problem, but no rule asks for it, and the plan context carries no
root positions (`shapeRoot`, `hi-plan-context.ts:618`: "no positions, no geometry"), so the
overlap of sink and fridge is invisible to the agent and to the server.

## Root Cause

**The agent misapplied the docking side, and neither the instructions nor the server catch it.**

1. **The instructions never say where a straight unit's `LeftBottom` row goes when the unit
   stands at a wall's end.** The rules describe the wall placement one-directionally: "posGroup =
   end puts the anchor flush into the corner at the wall's end, the row running towards start"
   (`hi-mcp-server.ts:28`). That the row must therefore be chained through `RightBottom →
   LeftBottom` — and that a `LeftBottom → RightBottom` chain from the same anchor runs *past* the
   corner into the adjoining wall — is left implicit. Example 1 shows the right chain but does not
   say why.
2. **The corner rule invites the misreading.** "right back 270 - RightBottom along the right wall
   to the front, LeftBottom along the back wall to the left" (`:29`) is true for a **corner
   article**, whose two arms are turned 90° against each other. For a straight unit at rotation
   270, `LeftBottom` and `RightBottom` lie on the same line: `LeftBottom` runs along the right
   wall *backwards*, into the back wall. The sentence is qualified ("with the corner article
   anchored at the corner point"), but it is the only place that names "the back wall to the
   left" for the back right corner, and an agent planning a straight row into that corner picks
   it up.
3. **"Left" and "right" are never anchored to a frame.** The docking rules use "to the left/right"
   as seen from the front of the unit (group-local x); the corner and wall rules use "left/right
   wall", "back = top", "to the left" as seen in the top view. For the back wall (rotation 0)
   both frames agree; for the right wall (rotation 270) they do not — group-local "right" is
   top-view "down", group-local "left" is top-view "up", into the back wall. The rules state the
   rotation sense but not this consequence.
4. **No consistency check on the docking graph, no room-bounds feedback.** The server accepts a
   side vector docked to two partners, and the result reports only the anchor point, which was
   right. Both earlier corner analyses ended with the same gap: the agent cannot tell a good
   placement from a bad one from what the tool returns.

Answering the three questions of the trigger:

| Question | Answer |
|---|---|
| Does the agent interpret the MCP instructions incorrectly? | Yes — it chained the row to the anchor's `LeftBottom` at a wall end where only `RightBottom` continues into the room, and docked the sink to a vector the fridge already occupies. |
| Is there a problem in the MCP? | Yes, two: the instructions leave the direction rule implicit and word the corner rule so that it reads as a straight-unit rule; the validation and the result feedback cannot catch either mistake. |
| Does roomle-ui provide wrong information (`calculatedCornerPointsByRoot`)? | No. No corner article is involved; the straight units carry no corner vectors and get no `cornerPoint`. The walls, the anchor placement and the docking arrangement are exactly as specified. |

## Proposed Fix

Instructions and validation in `hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts` and `tool-executors.ts`,
mirrored into `minimal-hi-example/docs/hi-mcp-server.md` and `.agents/skills/hi-authoring-rules.md`.

### F1 — State the direction rule for a straight anchor (instructions)

In the wall rule (`:28`) and in Example 1: *the row continues from the anchor's `RightBottom`
only. With `posGroup = end` the anchor's left side is the corner; a unit docked to its
`LeftBottom` stands beyond the corner, inside the adjoining wall. To run a row the other way
along a wall, anchor its leftmost unit and position it with `d = lengthMm − group width`, or use
a corner article.* And one sentence on the frame: *`LeftBottom`/`RightBottom` are the sides as seen
from the front of the unit (group-local); "left wall"/"to the left" in the corner rules are
top-view directions — they coincide only at rotation 0.*

### F2 — Separate the corner rule from the straight-unit case (instructions)

Move the per-corner leg table (`:29`) under the corner-article recipe (`:25`) and open it with
"corner article only". Add the straight-unit alternative right there: "*n* straight units in the
back right corner: either a row along the right wall (Example 1: anchor at the right wall's `end`,
rotation 270, chain `RightBottom → LeftBottom`) or a row along the back wall (anchor = the
leftmost unit at `end + (lengthMm − group width) · (start − end) / lengthMm` of the back wall,
rotation 0, same chain)." For this prompt the numbers are `posGroup [4815, 0, -3765]` / 270, or
`posGroup [2715, 0, -3765]` / 0 with a 2100 mm row.

### F3 — Reject a side vector docked to two neighbours (validation, `tool-executors.ts`)

Build the joint list from the authored `contextData`: each entry `(A, ownVector) → (B, vector)`
occupies both `(A, ownVector)` and `(B, vector)`. If a `LeftBottom`/`RightBottom`/`BackBottom`
vector of one root is occupied by two different partners through *beside* or *back-to-back*
pairs, reject with the message: `posGroups[0]: root 'oven' RightBottom is docked to both 'fridge'
and 'sink' - a side takes one neighbour; chain the row (A lists B, B lists C)`. Top vectors stay
unchecked (several wall units above one wide base unit are legitimate with x offsets).

### F4 — Report a group outside the room (feedback, `tool-executors.ts`)

After the load, compare each created or replaced group's `position.footprint` with the floor
contour of the room it is in (`rooms[].levels[level 0]`, already fetched by `get-plan-context`;
the server can request `rooms` together with `groups`). If a footprint corner lies outside the
contour, add a `hint`: `Group <id> extends beyond the room: footprint z -4365 < back wall z
-3765 - a unit is docked past the corner into the wall (dock the row to the anchor's RightBottom,
see get-authoring-rules).` Article-agnostic; it would also have caught the 261 mm case of the
corner point analysis.

### F5 — Verify rule (instructions)

Extend the verify rule (`:32`): compare `position.footprint` with the walls of the room — every
footprint edge must lie inside the interior contour; a footprint that crosses a wall means a
unit is docked in the wrong direction, not a wrong `posGroup`.

### Optional — log the tool arguments

The earlier corner analysis proposed it and it was not done: log the `create-or-replace-groups`
payload in the server so the next failed run can be diagnosed from the log instead of a
snapshot.

**Recommendation**: F1, F2 and F5 now (instructions only, no code risk), F3 and F4 in the same
change — F4 is the safety net that turns a silent wrong placement into a corrected one, F3 the
cheap check that catches the contradictory docking before anything loads.

## Verification

1. Fresh agent session, same prompt, same room. The payload is one group anchored at the right
   wall's `end` with rotation 270, all three units chained through `RightBottom → LeftBottom`
   (or the back-wall variant of F2), and no side vector docked twice.
2. Returned `position.footprint` lies inside `x [-685, 4815]`, `z [-3765, 1235]`; `get-plan-images`
   shows the three units in a row from the corner, nothing inside a wall, nothing overlapping.
3. Resubmit the reconstructed payload of this analysis: F3 rejects it naming the oven's
   `RightBottom`; with F3 bypassed, F4 returns the out-of-room hint.
4. Unit tests: a contradictory docking is rejected (F3); a footprint outside the contour yields
   the hint and one inside does not (F4); the existing loading tests stay green.
