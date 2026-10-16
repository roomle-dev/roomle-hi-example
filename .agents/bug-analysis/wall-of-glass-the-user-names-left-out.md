# Bug analysis — a wall of floor-to-ceiling glass the user names is left out

> **Type**: Bug analysis
> **Status**: Open
> **Ticket**: none — backlog item [65](../backlog/mcp-issues.md#65-a-wall-of-floor-to-ceiling-glass-the-user-names-is-left-out) of `mcp-issues.md`
> **Date**: 2026-10-16

## Affected repositories

- **roomle-hi-example** — the served text of the MCP server: the rule sentences of `AUTHORING_RULES`
  and `INSTRUCTIONS` in `hi-mcp/hi-mcp-server/hi-mcp-server.ts` that make the agent keep a wall of
  openings clear; `docs/hi-mcp-behaviour.md` (§2.4, §8.3, G19, a decision row),
  `docs/hi-mcp-server.md` (the `wall` parameter), `.agents/skills/hi-mcp-tools.md`; the backlog
  item 65.
- **roomle-ui** — `resolveWall` in
  `packages/web-sdk/packages/homag-intelligence/src/hi-wall-placement.ts`: what a side label such as
  `front` resolves to; the tests in `__tests__/hi-tool-commands/create-or-replace-groups-placement-test.ts`
  and `place-group-test.ts`.
- **ligna-store** — unchanged: its chat runs the same MCP server and the same planner.
- **RoomleCore** — unchanged: the contour is right (D61) — an opening that reaches the floor splits
  the wall, a door and a floor-to-ceiling window alike.

## Symptom

Test 05 `sideboard-living-room-front-wall` of [`docs/test-prompts.json`](../../docs/test-prompts.json):
plan `living-room` (`ps_nwzhfk8bjc2gu02gsyocsdragi0rxey`), prompt "add a sideboard of three low
cabinets to the front wall". Expected: one `create-or-replace-groups` call with a placement by wall
(front, centred), one group of three low cabinets with its back against the front wall, inside the
room.

Session `mcp-test-2026-10-14_13-34-58` (gpt-6-astra, roomle-hi-example `340532f`, roomle-ui
`6df952e35`, run `gpt-6-astra/05-sideboard-living-room-front-wall`): the agent calls
`get-plan-context`, `get-authoring-rules` and `get-skill`, no tool that changes the plan, and
answers:

> I haven't added the sideboard: the front wall is occupied by floor-to-ceiling windows and a
> 2,020 mm-wide door, with no clear stretch for three cabinets. I'd use three 600 mm SB_UB600
> single-door sideboard cabinets. Would you like them on the back wall instead?

The plan stays empty (`order-data.json`: no items). Test 10 `living-room-sideboard-and-tv` of the
same session builds the TV unit on the back wall and leaves the sideboard out with the same
reasoning. Session `mcp-test-2026-10-13_17-19-39` (gpt-6-astra): the same in both tests — four of
four gpt-6-astra runs.

The two Mistral sessions show what happens when the agent does send the placement:

| Session | Model | Payload | Result |
|---|---|---|---|
| `mcp-test-2026-10-12_10-23-42` | Mistral-Large-3 | `placement { wall: "front", alignment: "center" }`, three `LB_UB600` of 1000 mm | the group at `[3370, 0, -2550]`, rotation 180: in the middle of the room, its back to the 120 mm end face of the partition (wall 21) — fail |
| `mcp-test-2026-10-12_13-35-57` | mistral-large-4 | the same placement, `SB_UB600S`, `SB_US600`, `SB_UB600` | the reload at `[2770, 0, -2550]`; the agent reads the position and moves the group with `place-group { wall: 6 }` to the front wall at z 2235 — two steps instead of one, partial |

Test 10 of both sessions went the same way: four of four Mistral runs resolve `front` to the
partition.

## Reproduction

- With a model: the test `sideboard-living-room-front-wall` with gpt-6-astra
  ([the testing skill](../skills/hi-mcp-testing.md)), or `run-hi-mcp-prompt.js` on the plan with
  the prompt — the refusal, in every gpt-6-astra run so far.
- Without a model, the second cause: the payload of the Mistral-Large-3 run (`planner-calls.json`
  of its run directory) through `create-or-replace-groups` on the plan `living-room` — the result's
  position is at z −2550, not z 2235. At unit level: `resolveWall` with the walls of the living room
  (below) and `{ wall: 'bottom' }` returns wall 21.

## Investigation trace

### 1. The front wall as the agent sees it

`plan-context.json` of the run, room 0, the entries with side `bottom` — every one named
"front wall" by the server (`agentFacingRooms`, `hi-mcp/hi-mcp-server/agent-facing.ts:245`):

| Wall | Type | x from | x to | Length | What it is |
|---|---|---|---|---|---|
| 3 | opening | −3185 | −1705 | 1480 | window, 0 to 2520 mm |
| 4 | opening | −1705 | 315 | 2020 | door, 0 to 2520 mm |
| 5 | opening | 315 | 1815 | 1500 | window, 0 to 2520 mm |
| 6 | opening | 1815 | 3315 | 1500 | window, 0 to 2520 mm |
| 7 | opening | 3315 | 4815 | 1500 | window, 0 to 2520 mm |
| 8 | opening | 4815 | 6315 | 1500 | window, 0 to 2520 mm |
| 9 | wall | 6315 | 6320 | 5 | the wall piece between the last window and the corner |
| 21 | wall | 1810 | 1930 | 120 | the end face of the partition at z −2550, inside the room |

All at z 2235 but wall 21. The `obstacles` section lists the five windows and the door, each on its
wall with `fromEndMm` `[0, 1500]` (the door `[0, 2020]`), `bottomMm` 0, `topMm` 2520. The right wall
is the same: walls 10 to 15 are five windows and a 60 mm piece; the partition's long face (wall 20,
3600 mm) is the only right wall of type `wall` longer than that.

Why the contour looks like this: the kernel splits a wall piece by the opening that overlaps it
(D61, RoomleCore `ObjectSurroundings::addOpeningToContour`) when the opening reaches the floor — a
door, and a window with `bottomMm` 0. A window with a sill does not split the wall: in the
`default-room` (run 39 of the same session) the back wall is one 5500 mm segment of type `wall`
with the window (`bottomMm` 950) as an obstacle on it, `fromEndMm` 235 to 2335. roomle-ui
`deriveWalls` (`hi-plan-context.ts:777`) makes one wall entry per contour segment, `type` from the
segment — none for an opening —, and the server types the untyped ones `opening` (C18). The
partition is the second subpath of the contour (`M` at `[1810, 0, 1050]`); its four faces become
walls of the room, with the sides their facing gives them.

### 2. What the served text tells the agent

`AUTHORING_RULES` and `INSTRUCTIONS`, `hi-mcp/hi-mcp-server/hi-mcp-server.ts`:

| Line | Sentence |
|---|---|
| 24 | "use the walls of type wall (an entry of type opening is a door)" |
| 26 | "Put a new group on a stretch of wall or a spot that obstacles leaves free: fromEndMm is measured from the wall's end, so a placement with that wall, alignment end and offsetMm = the start of a free stretch puts the group on it; base units lower than a window's bottomMm fit below it." … "an offsetMm of at least 600 mm from that corner, which keeps the group out of the 600 mm strip in front of the opening" |
| 27 | "A new group is only for a free stretch of wall or a free spot in the room (obstacles shows what is taken) - never position a new group against an existing one." |
| 71 | "a new group is only for a free stretch of wall" |
| 193 | (`get-plan-context` description) "When a door or window determines a placement, briefly name it and explain whether the final placement keeps it clear" |

Nothing says that the wall the user names is where the group goes, or that a window a group stands
in front of is reported, not avoided. The server's own decision says the opposite of what the agent
concludes: D55 builds a root module in front of a window anyway — "the user may want a cabinet in
front of a window (D51)" — and names it in the `hint`. The agent follows the text to the letter: all
four gpt-6-astra answers quote it ("no clear stretch", "I'll keep those openings clear"). By rule 24
the front wall of type `wall` is 5 mm long.

The living-room skill (`hi-mcp/hi-mcp-server/skills/living-room-planning/SKILL.md`) points the same
way — "Keep required exits and escape openings usable", "Mark fixed features, required access,
opening arcs, and no-go areas before placing furniture", the counterexample "blocks a window
handle" — but the 2026-10-13 run refused without having read it: the rules alone suffice.

### 3. What the tool does with the placement the user asked for

roomle-ui `resolveWall` (`hi-wall-placement.ts:294-322`): a side label resolves to the longest wall
of that side with `type === 'wall'` (lines 308 to 314); documented as G19 in
[`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md) §8.3 — "a side label means the longest
wall of type `wall` on that side" — and in the `wall` row of the tool reference
(`docs/hi-mcp-server.md:565`). In the living room the candidates for `bottom` are wall 9 (5 mm) and
wall 21 (120 mm): the partition's end face wins. `placeAgainstWall` (`hi-plan-space.ts:1069`)
centres the group's width on that 120 mm segment: a sideboard of about 1800 mm spans x 970 to 2770
at z −2550, rotation 180, in the middle of the room, 840 mm past the face on either side — the
reload position `[2770, 0, −2550]` of the mistral-large-4 run; the three 1000 mm cabinets of
Mistral-Large-3 gave `[3370, 0, −2550]`. No correction says which wall was chosen, so an agent
learns it only from the returned position. The index form takes any segment: `place-group
{ wall: 6 }` put the group on the 1500 mm opening segment at z 2235, as mistral-large-4 did.

Why the rule is what it is: a wall with a door in it is two wall entries of the same side, and the
longer piece is the wall as the user means it, clear of the door. It breaks when the openings reach
the floor along the whole wall: the longest piece of type `wall` on that side is a sliver, or
another wall of that side — here a face of the partition, which no user calls the front wall.
Without the partition the label would fall to wall 9 and centre the sideboard on x 6317.5: x 5417.5
to 7217.5, 897.5 mm past the right boundary of the room (x 6320).

The same code is on roomle-ui `release/bo-test` and on the feature branch of the 2026-10-14 build;
the last commit on the file (`16863864f`, 2026-10-13) left these lines as they are. roomle-ui `master`
has no `hi-wall-placement.ts` yet, so the fix lands on `release/bo-test`.

### 4. The hint for a group in front of the glass

`objectBlockers` (`hi-tool-hints.ts:283-307`) builds the 600 mm strip in front of every door and
window from the `obstacles`, and the `hint` names every root module in it (D55). `wallOfRoot`
(`hi-plan-space.ts:906`) considers walls of type `wall` only, so for a root module in front of an
opening segment the free stretches are left out — as §8 of the behaviour document says. The
mistral-large-4 run shows it: the hint named the three root modules and the windows of walls 5, 6
and 7, and the group was built. The planner side behaves as D51 and D55 intend once the group is
asked for and lands on the right wall.

## Root cause

Two causes, one behind the other; the test's expectation needs both fixed.

1. **The served text (roomle-hi-example).** The rule sentences of lines 26, 27 and 71 make a free
   stretch of wall the condition for a new group, and line 24 makes a wall an entry of type `wall`.
   On a wall that is openings from end to end the agent finds no stretch and no wall, and the text
   never says that the wall the user names comes first, nor that a window the group stands in front
   of is reported, not avoided — which is what D51 and D55 already decide for the server. This is
   the cause of the failures of 2026-10-13 and 2026-10-14: nothing is built.
2. **The side label (roomle-ui `resolveWall`).** A side label resolves to the longest contour
   segment of type `wall` on that side. The openings are not counted, so when they reach the floor
   along the whole wall the label lands on a sliver or on another wall of that side. This is the
   cause of the results of 2026-10-12: the sideboard on the partition. In the gpt-6-astra sessions
   it is hidden behind cause 1 and surfaces as soon as the agent sends the placement.

Not a cause: the kernel's contour (D61 — a floor-to-ceiling window is an opening of the wall), the
library, the planner's load (the group is calculated and loaded as sent).

## Why the to-do of backlog item 65 is not enough

Item 65 names cause 1 and asks for a served-text change only. With that alone the agent sends
`{ wall: "front", alignment: "center" }` and the tool builds the sideboard with its back to the
partition's end face at z −2550 — the Mistral results. The test still fails ("with its back against
the front wall"), and the user gets a sideboard in the middle of the room without a word about it.

## Proposed fix

### roomle-ui — a side label names the wall face the user sees

`resolveWall`: a side label resolves to the **face** of the room on that side — the longest straight
run of consecutive contour segments of that side, openings included, from corner to corner — and
within the face the group goes on the longest piece of type `wall` when the calculated group fits
on it, else across the face as a whole. The face is the wall as the user names it; a window does
not make it less of a wall.

- Living room, `front`: the face is walls 3 to 9, x −3185 to 6320 at z 2235 (9505 mm); its only
  piece of type `wall` is 5 mm, so a sideboard of about 1800 mm is centred on the face: x 667.5 to
  2467.5, back at z 2235, rotation 180, in front of the windows of walls 5 and 6, 352 mm clear of
  the door. The `hint` names the two windows; the answer names them (the `get-plan-context`
  sentence of line 193 already asks for that). The partition's face (120 mm) is a face of its own
  and loses.
- A wall with a door in the middle (two pieces of type `wall`): the longer piece, as today — the
  group stays clear of the door. The existing tests guard it.
- `right` in the living room: the glass façade, walls 10 to 15 (7500 mm), not the partition's long
  face (wall 20, 3600 mm) that wins today.
- The index form stays per segment: `wall: 6` is that 1500 mm segment, with `fromEndMm` and the free
  stretches per segment as the obstacles give them.

Rejected: resolving the label to the face and placing across the face in every case — a group
centred on a wall with a door in the middle would stand in front of the door. Rejected: keeping
today's comparison between the pieces of type `wall` of a side and falling back to a face only when
the chosen piece is narrower than the group — the chosen piece is the partition's (120 mm beats
5 mm), so the fallback would land on the partition's face, never on the glass front. The face is
chosen first, the piece within it second.

No guard, no correction: the group is built where the user puts it, and the result says what it
stands in front of (D51, D55).

### roomle-hi-example — the served text

`hi-mcp-server.ts`, shorter rather than longer:

- Line 26: a group goes where the user puts it — the wall, the corner or the spot the user names,
  with a door or a window there or not; the result's `hint` names what it stands in front of, and
  the answer says so. The free stretches are for the place the user leaves open; the `fromEndMm`
  sentence and the corner sentence stay as the guidance for that case.
- Lines 27 and 71: the point of "a new group is only for a free stretch of wall" is the sentence
  after it — articles next to an existing group are root modules of that group, never a new group
  against it. Say that without "free stretch".
- Line 24: a door or a floor-to-ceiling window splits a wall into several entries of the same side
  and name — pieces of type `wall` and `opening`s; a side label names the whole wall and the server
  picks the piece. Replaces "an entry of type opening is a door".

Library-neutral as before: no article, category or measure of one library.

### Documentation

- `docs/hi-mcp-behaviour.md`: the `wall` sentence of §8.3 and the G19 row (a side label means the
  face); a decision row for the face and the piece; the Obstacles paragraph of §2.4 (the wall the
  user names comes first).
- `docs/hi-mcp-server.md` (`wall` row), `.agents/skills/hi-mcp-tools.md`.
- Backlog item 65: cause 2 and the roomle-ui to-do; the item leaves the backlog with the fix.

### Tests

- roomle-ui `__tests__/hi-tool-commands/create-or-replace-groups-placement-test.ts`: a room whose
  front wall is openings end to end with a 5 mm piece, and a partition inside the room with a
  120 mm face of the same side — `placement { wall: 'front' }` puts the group with its back on the
  front face, centred on it; a back wall with a door in the middle keeps the longer piece; the same
  for `place-group` in `place-group-test.ts`. The face building in `__tests__/hi-plan-space-test.ts`
  or a test file of `hi-wall-placement.ts`.
- roomle-hi-example `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts`: the served rules say that
  the wall the user names is where the group goes.
- `docs/test-prompts.json`: `sideboard-living-room-front-wall` and `living-room-sideboard-and-tv`
  pass — the sideboard with its back against the front wall at z 2235, inside the room, the answer
  names the windows; every other placement test unchanged, each model compared with its reference
  session.

## Open points for the plan

1. **Corners.** `roomCorners` (`agent-facing.ts:80`, roomle-ui `hi-plan-space.ts:443`) builds the
   corners from walls of type `wall` only, so the living room has no front left corner at
   `[−3185, 0, 2235]` and no front right corner at `[6320, 0, 2235]` — an opening ends there —,
   while the four corners of the partition are listed as room corners ("front right" at
   `[1810, 0, −2550]`). The face model should serve the corners too: a corner is where one face
   ends and another starts.
2. **The partition.** The second subpath of the contour is a pillar inside the room. Whether its
   faces are walls of the room for a side label at all, or only by index, is to decide; the kernel
   marks it by the `M` only.
3. **The free stretches of a face.** `wallOfRoot` finds no wall for a root module in front of an
   opening segment, so the hint gives no free stretches there. Along the face they could be given.

## References

- Run directories under `.temp/result/`: `mcp-test-2026-10-14_13-34-58/gpt-6-astra/05-…` and
  `10-…`, `mcp-test-2026-10-13_17-19-39/gpt-6-astra/05-…`,
  `mcp-test-2026-10-12_10-23-42/Mistral-Large-3/05-…`,
  `mcp-test-2026-10-12_13-35-57/mistral-large-4/05-…`
- Backlog item 65; decisions D23, D45, D51, D55, D61; guard G19; C18, C21 of
  [`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md)
- The testing skill: [`.agents/skills/hi-mcp-testing.md`](../skills/hi-mcp-testing.md)
