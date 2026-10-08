# Bug Analysis: a new group is placed at a point the model computes

> **Type**: Bug Analysis
> **Domain**: hi-mcp — the placement of a new group in `create-or-replace-groups` (`normalizePlacement`, `tool-executors.ts`); the served placement text (`AUTHORING_RULES` and the descriptions of `create-or-replace-groups`, `get-plan-context` and `place-group`, `hi-mcp-server.ts`); the wall geometry of `place-group` (`placeGroupAtWall`, `tool-executors.ts`; `plan-space.ts`)
> **Trigger**: [RML-18078](https://roomle.atlassian.net/browse/RML-18078); backlog [`mcp-test-open-issues.md`](../backlog/mcp-test-open-issues.md) issue 27; decision D23 (deferred) of [`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md); related: [RML-18007](https://roomle.atlassian.net/browse/RML-18007) (`place-group`, D21), [RML-17966](https://roomle.atlassian.net/browse/RML-17966) (removed the old wall placement), [RML-18041](https://roomle.atlassian.net/browse/RML-18041)
> **Date**: 2026-10-08
> **Author**: AI Assistant
> **Status**: Open — implemented on `fix/place-new-group-by-wall-RML-18078` and [verified](#implementation-and-verification) with unit tests and live without a model; the chat check waits for a go; not yet merged

## Affected repositories

- **roomle-hi-example**: the fix. `create-or-replace-groups` takes a placement by wall, alignment
  and offset beside the placement by point, and the server computes the position as `place-group`
  does. The wall logic of `place-group` moves out of its executor so that both tools use it. The
  served text teaches the wall form. The change comes with unit tests, D23 in effect, the rows of
  §6–§8 in `docs/hi-mcp-behaviour.md`, the tool references, and the removal of backlog issue 27.

Not changed:

- **roomle-ui**: the planner methods exist. A load without `repositioningData`,
  `getExternalObjectGroups` and the reload with `repositioningData` are what `place-group` uses
  today. The page allow-lists stay as they are.
- **ligna-store**: it uses the same MCP server and gets the change with its deployment.

## Symptom

The user asks for a group "on the back wall". The group then stands outside the room, past the
far corner of the wall, or on another wall. The result reports success, and the answer says the
group stands at the wall. Nothing tells the agent: a group outside the room is never refused
(D22).

Other models take two calls. They create the group without a placement and move it with
`place-group`. The group ends up right, but the second call costs a step and a reload.

## Reproduction

The Default Room, as the plan context gives it:

| Wall | `start` | `end` | `facingRotationY` |
|---|---|---|---|
| back wall (`top`, 5) | [4815, 0, −3765], the back right corner | [−685, 0, −3765], the back left corner | 0 |
| left wall (`left`, 0) | [−685, 0, −3765], the back left corner | [−685, 0, 1235], the front left corner | 90 |
| right wall (`right`, 4) | [4815, 0, 280], at the door | [4815, 0, −3765], the back right corner | 270 |

A group runs from `posGroup` towards the wall's `start`. Only `end` puts it flush into a corner
without its width.

| Run | Model, test | Prompt | Placement sent | Rules read | Result |
|---|---|---|---|---|---|
| `mcp-test-2026-10-06_08-31-06` | gpt-5.4-mini 02 | "add a group of 4 cabinets to the wall in the back" | [4815, 0, −3765] / 0, the back wall's start | no | four UTB60 from the back right corner to the right, through the right wall, outside the room |
| `mcp-test-2026-10-06_08-31-06` | gpt-5.4-mini 06 | "create a kitchen like the one in the image on the left-hand wall of the room" | [−685, 0, −3765] / 90, the left wall's start | yes | the row stands behind the back wall, outside the room |
| `mcp-test-2026-10-07_07-20-49` | gpt-5.4-mini 02 | the same as above | [4815, 0, −3765] / 0 | yes, after a refused first call | outside the room behind the right wall |
| `mcp-test-2026-10-07_07-20-49` | gpt-5.4-mini 06 | the same as above | [−685, 0, −3765] / 0, the corner "back left" with its `posRotationY` | no | the row stands on the back wall below the window; the answer says the left wall |
| `mcp-test-2026-10-07_07-20-49` | gpt-5.4-mini 10 | (an image of three tall units, no text) | [3750, 0, −3320] / 270, a computed point | no | one wardrobe free in the room, 1065 mm off the right wall and 445 mm off the back wall; the answer says the back right corner |
| `mcp-test-2026-10-07_07-20-49` | gpt-5.4-mini 27 | "add four base cabinets with wall cabinets above them on the back wall" | the refused first call: [−685, 0, −3765] / 0, the end; after the rules: [4815, 0, −3765] / 0, the start | yes | x 4815 to 7215, outside the room behind the right wall |

The unevaluated runs of the same matrix at reasoning effort `low` and `medium` show three more
placements at a wall's start (low 06 twice, medium 10).

The placement text has not changed since `7f00c05` (2026-10-06 14:17): the runs of 2026-10-07
used the served text of today's code. The runs of 2026-10-06 08:31 differ only in the obstacle
rule, which did not exist yet.

**Every placement of a new group in the five test runs of 2026-10-06 and 2026-10-07**, sorted by
the point the model sent:

| Model | At a wall's end | Along a wall (computed) | At a wall's start | Free point |
|---|---|---|---|---|
| gpt-5-mini | 12 | 1 | 0 | 1 |
| gpt-6-astra | 35 | 18 | 0 | 7 |
| gpt-5.4-mini (all efforts) | 44 | 11 | 7 | 5 |

"At a wall's end" includes gpt-5.4-mini 06 of 2026-10-07: the back wall's end, though the user
asked for the left wall. The free points include the islands the tests ask for.

**The two-call path**, a group created without a placement and moved with `place-group`:
gpt-6-astra 06 (`2026-10-06_08-31-06`), 02 (`2026-10-06_14-25-34`), 28 (`2026-10-07_09-46-08`
and `2026-10-07_11-58-22`), gpt-5.4-mini at effort `medium` 28. Each passed.

## What the model reads

The HI chat does not pass the server's instructions to the model (§4 of
`docs/hi-mcp-behaviour.md`). A model that does not call `get-authoring-rules` sees the tool
descriptions and the plan context only.

| Where | Served text |
|---|---|
| `create-or-replace-groups` description, `hi-mcp-server.ts:245-248` | "Position a new group in the same call with placement ({ posGroup, posRotationY }: the room point of the group's back left corner and its rotation; take them from a wall of get-plan-context: its end point and its facingRotationY put the group flush into the corner at the wall's end, a room corner point with the rotation from the corner rules puts a group that starts with a corner article into that corner)" |
| `get-plan-context` description, `hi-mcp-server.ts:160-162` | "start/end [x, 0, z] in millimetres (the 3D contour points on the floor), lengthMm, type, heightMm, thicknessMm and facingRotationY - the posRotationY of a group standing with its back against that wall" |
| The plan context, `rooms[].corners` | `{ name: "back left", point: [−685, 0, −3765], posRotationY: 0 }` — the rotation of a corner kitchen in that corner (C18) |
| `place-group` description, `hi-mcp-server.ts:279-280` | "Use it to move a group, or to position a group created without placement, against a wall or into a corner - never compute wall points for this yourself." |
| Rules, `hi-mcp-server.ts:22` | "posGroup = end puts the group flush into the corner at the wall's end, the row running towards start. Along the wall: posGroup = end + d * (start - end) / lengthMm - centred: d = (lengthMm - group width) / 2; right end flush into the corner at the wall's start: d = lengthMm - group width; the group width is the sum of the article widths of the row" |
| Rules, example 4, `hi-mcp-server.ts:58` | "the row centred on the back wall": `posGroup = end + d * (start - end) / lengthMm`, `d = (lengthMm - <group width>) / 2` |

## Cause

The served text and the tool API lead the model to the wrong point. "The server accepted it" is
no cause: a group outside the room must stay possible (D22).

1. **The API asks for a point that fits one corner only.** A placement names the room point of
   the group's back left corner. Of a wall's two corners, only its `end` is that point. Every
   other position along the wall is arithmetic with the group's width (rules, `:22`, example 4).
   The model has to sum the article widths of the row from the catalog. The guideline names this
   case: what the server can derive — a point, a rotation — the server derives
   ([AGENTS.md — Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort), step 2).
2. **The served text names that corner by the contour, not as the user sees it.** "Its end point
   … the corner at the wall's end" (`:246-247`) and "start/end … the 3D contour points"
   (`:160-161`) never say which corner the end is. The end of the back wall is its left corner
   as seen from the room, the end of the left wall its front corner. A model that wants a
   corner — the one the user names, the one beside a window, or the "start" of a row — takes the
   point of that corner. All seven points at a wall's start carry the wall's own rotation, so the
   row runs past the wall's far corner, out of the room.
3. **The corners list hands out a point and a rotation that fit one wall of the two.** A corner's
   `posRotationY` is the rotation of a corner kitchen. A straight row with it stands on the wall
   that ends in that corner, not on the other one. gpt-5.4-mini 06 of 2026-10-07 took the corner
   "back left" with its 0 for the left wall, and the row stood on the back wall.
4. **The `place-group` description teaches the two-call path.** "Use it … to position a group
   created without placement … never compute wall points for this yourself" (`:279-280`). For a
   new group this contradicts the `create-or-replace-groups` description, which asks for the
   point in the same call. gpt-6-astra follows `place-group`: the result is right, at the cost of
   a call and a reload.
5. **The wall vocabulary exists for existing groups only.** `place-group` takes a wall, an
   alignment and an offset and computes the position from the calculated footprint (D21).
   `create-or-replace-groups` drops these fields (G11, `normalizePlacement`,
   `tool-executors.ts:991-1003`) and points to `place-group`. Their use in a new group is
   deferred (D23).

**Clarifying the text alone does not fix it.** gpt-5.4-mini read the rules, which say "end", in
06 of 2026-10-06 and 27 of 2026-10-07, and still took the start. In 27 its first call, refused
for its payload shape, had the end. After the rules, it moved to the start. A likely reason is
the window on the left half of the back wall: the obstacle rule asks for a free stretch, and
the recipe for the right end needs the width. A centred or an offset row stays arithmetic with
any wording.

## Fix

The fix is step 2 of the guideline: simplify the tool API. The agent names the wall and where
along it, and the server derives the point and the rotation, as `place-group` does (D23).

1. **Two forms of placement.** `create-or-replace-groups` accepts
   `placement { wall, alignment?, offsetMm?, roomIndex? }` — the parameters of `place-group`,
   with its defaults (C9) and side labels (C10) — beside `{ posGroup, posRotationY, rootId? }`.
   `normalizePlacement` keeps the wall fields, and G11 no longer drops them.
2. **The `place-group` logic, shared.** For a wall placement, the server loads the group
   without `repositioningData`, reads the calculated group, and computes the position with
   `placeGroupAtWall`. It checks the target against the other groups and reloads the group with
   `repositionedGroup`, which keeps the generated roots and their colours. A group with a corner
   article goes into the corner when the alignment names the adjoining wall. The anchor probe
   (C6) is not needed: the calculated group gives the footprint and the corner. The group-wide
   attributes (G46) and the obstacle hint (D55) follow as today.
3. **Feedback, not rejection.** A wall the room does not have does not fail the group (D30). The
   placement is not used, as with G10, and the correction names the walls of the room.
4. **The served text teaches the wall form** for a group at a wall or in a room corner. The
   corner is named by the side label of the adjoining wall ("wall right, alignment back" is the
   back right corner), and `center` and `offsetMm` cover the rest. `posGroup` stays for a free
   spot such as an island. The recipes with `end`, `start` and `d`, the point of example 1 and
   example 4 leave the text. The `place-group` description no longer offers itself for a group
   created without placement.

What stays: a placement on a group that is already in the plan is not used (G16, D26), and a
group outside the room is not refused (D22).

## Decisions to take

**D46 and the ticket disagree on the loads.** The ticket's constraint "load first, then place"
loads a group twice. D46 decided that "a new group stands where the placement says after the one
load that creates it", and it rejected a correction load after the creation: "every offset
group would load twice and visibly jump". D46 is about the placement by point, where the server
learns the anchor's frame before the load. For a wall placement the server needs the group's
width, and only the planner calculates it.

| # | Question | Options | Recommendation |
|---|---|---|---|
| Q1 | How the server learns the width | **A** — load, then move: the group is loaded at the plan origin and reloaded at the wall, as `place-group` and the wall placement before RML-17966 did. Two planner steps, which `undo` counts (D47). D46 gets an exception for the wall form. **B** — probe, then one load: the whole group is loaded and undone, as the anchor probe does today, then loaded once at its place. D46 holds, but every call calculates the group twice, and the probe's footprint has to be turned into the anchor's frame, a second geometry path (the 10 mm worktop overhang D46 names) | **A**. It reuses `place-group` as it is. The probe of a new article variant loads twice today too, and the wall form needs no probe. RML-17966 removed the old wall placement because its geometry lived three times on the pages, not because of the second load |
| Q2 | A target that overlaps another group | The behaviour of `place-group`: move the group along the wall to the nearest free position, with a correction (G22, D27). Or the behaviour of `create-or-replace-groups`: build it as asked, with the hint (D55) | The behaviour of `place-group`, since the wall form is its vocabulary. Objects, doors and windows get the D55 hint, as after `place-group` |
| Q3 | A group of wall units only | The wall form has no height, and the first load puts the group on the floor. Options: (a) such a group keeps `posGroup` with its mounting height; (b) the server hangs it at the height of the wall units (D35); (c) an optional `bottomMm` in the wall form | (a): no new field and no new rule for a rare case. The text says so in one clause |
| Q4 | A placement with both forms | The wall form is used, and `posGroup` and `posRotationY` are dropped with a correction | As stated: the wall form cannot run out of the room |
| Q5 | `alignment` `start` and `end` | They stay accepted, as in `place-group`. In `place-group` they mean the wall's points (`wallSpanStart`, `plan-space.ts:1008`), so the group stands in the room either way. The text teaches the side labels of the adjoining walls for a corner, `center` for a centred group, and `end` with `offsetMm` for a free stretch: the obstacles and the hint give a stretch as `fromEndMm`, measured from the wall's end, so `end` and `offsetMm` = the start of the stretch put the group on it without knowing which corner the end is | As stated |
| Q6 | The interim of the ticket (To do 2: "a wall's end is the corner on the left as seen from the room") | Needed only if D23 waits. With the wall form, the end recipe leaves the description | Implement D23 now and drop the interim |

## Tests

- **Unit** (`tool-executors.test.ts`): a new group placed by wall and alignment loads once without
  `repositioningData` and is reloaded once with the computed position, and the anchor probe does
  not run. `center`, an adjoining wall's side label and `offsetMm` give the positions of
  `place-group`. A corner group goes into the corner the alignment names. An overlap moves the
  group along the wall with a correction (Q2). A wall the room does not have builds the group
  without the placement, with a correction. The point form is unchanged, and both forms work in
  one call. `undo` reverts both loads (D47).
- **Unit** (`hi-mcp-server.test.ts`): the description and the rules teach the wall form. They
  carry no `end + d` recipe and do not offer `place-group` for a new group, and they never name
  internals (`repositioningData`, D10).
- **Test prompts** (`docs/test-prompts.json`): `four-cabinets-back-wall` and
  `image-kitchen-left-wall` cover the wrong corner. A centred row on the back wall is to be
  added.
- **Chat**, as the ticket asks, after the implementation and only on request: "add a group of 4
  cabinets to the wall in the back" and a centred row with gpt-5.4-mini, three runs each. About
  6 runs × 30 s, a few minutes. The group stands inside the room at the wall after one
  `create-or-replace-groups` call.

## Implementation plan

> **Status**: proposed, awaiting review — no code before it is approved. The plan takes Q1 to Q6 of
> [Decisions to take](#decisions-to-take) as recommended. The review confirms them, first of all
> the second load of Q1, which needs an exception in D46.

Only roomle-hi-example changes. Seven steps, each verified:

1. The shared wall placement (`tool-executors.ts`) → verify: every `place-group` test passes
   unchanged.
2. The wall form in `create-or-replace-groups` (`tool-executors.ts`) → verify: the new tests pass,
   and the existing tests pass with the two placement cases changed below.
3. The served text (`hi-mcp-server.ts`) → verify: the changed and the new tests of
   `hi-mcp-server.test.ts` pass.
4. `npm run typecheck`, `npm test`, `npm run lint`, `npm run format:check` → all green.
5. The documentation → verify: `check-markdown-links.js` reports no bad link.
6. A live check against the planner, without a model → verify: every group stands where its
   placement says after one call.
7. The test prompt of a centred row (`docs/test-prompts.json`) → verify: the file parses and the
   runner lists the test.

The chat check of the ticket is not part of the plan. It runs only when it is asked for.

### 1. The shared wall placement: `tool-executors.ts`

The `place-group` executor is split into three functions that both tools call. The executor keeps
its order of steps, its messages and its result.

- **`wallPlacementSpec(fields)`** builds the `WallPlacementSpec` from `wall`, `alignment`,
  `offsetMm` and `roomIndex`: `back` and `front` read as `top` and `bottom` (C10), the defaults
  `center`, 0 and room 0 (C9).
- **`resolveWallPlacement(rooms, spec, prefix, corrections)`** runs `resolveWall` (G19) and centres
  an alignment that runs parallel to the wall, with the correction of G20. `place-group` passes an
  empty prefix, so its message stays as it is.
- **`wallTarget(rawGroup, resolved, spec, others, label, corrections)`** runs `placeGroupAtWall`,
  the overlap test against `others` and `freePlacementAlongWall`, and adds the two corrections of
  G22 with `label` as the subject: `Group 'g1'` for `place-group`, `posGroups[0]: group '…'` for
  `create-or-replace-groups`. It returns the `GroupPlacement`.

`standsAt` and the reload stay in the `place-group` executor.

### 2. The wall form: `tool-executors.ts`

**The placement** (`normalizePlacement`, `:973`). A placement with a `wall` field is a wall
placement. `WALL_PLACEMENT_FIELDS` gets `roomIndex`.

| Input | What the server does | Correction (new ID) |
|---|---|---|
| a wall placement with fields of neither form | drops them | G11, reworded: "the placement takes wall, alignment, offsetMm and roomIndex, or posGroup, posRotationY and rootId - … dropped" |
| `wall` neither a side label (`left`, `right`, `top`, `bottom`, `back`, `front`) nor an integer ≥ 0 | does not use the placement; the planner positions the group | G55 |
| `alignment` not one of the nine values of `place-group`, `offsetMm` not a finite number, `roomIndex` not an integer ≥ 0 | uses its default: `center`, 0, room 0 | G56 |
| a wall placement that also names `posGroup`, `posRotationY` or `rootId` | uses the wall and drops the point fields (Q4) | G57 |
| a placement by point | unchanged (G10, G12–G14) | — |

The text of G10 names both forms: "the placement is not { wall, alignment?, offsetMm? } or
{ posGroup, posRotationY } - …".

**The executor** (`create-or-replace-groups`, `:3146`):

1. `preContext` reads `rooms` as well when a group of the call has a wall placement.
2. After G16, every remaining wall placement is resolved with `resolveWallPlacement`. A room or a
   wall the plan does not have leaves the group without its placement; the correction is the
   message of G19 followed by "- the placement was not used, so the planner positions the group"
   (G55). The resolved placements are kept in a map per call group, and `group.placement` is
   deleted. The anchor probe and `toRepositioningData` therefore see only placements by point, and
   that code stays as it is.
3. The load is unchanged: a group placed by wall reaches the planner without
   `repositioningData`.
4. **`placeAtWalls`**, new, runs right after the load when the map is not empty:
   - It reads the plan's groups once and matches them to the call groups (`matchResultGroups`).
     It stores the result id on each call group (`CallGroup.resultId`). `matchResultGroups` takes a
     stored `resultId` before the order of the new groups, because the kernel's list of groups
     (`getExternalObjectGroups`, RoomleCore) may list a reloaded group in another place. The
     group-wide attributes, the remembered agent ids and the obstacle hint therefore find the same
     group as before.
   - It reads the raw groups. `others` holds every raw group except the groups of the call placed
     by wall, which stand where the planner put them until they are moved.
   - Per group placed by wall, in the order of the call: `wallTarget`, then the target's volume
     joins `others`, so the next group of the call does not take the same place.
     `repositionedGroup` adds the group to the reload.
   - A group without a raw group or a footprint is not moved (G58): "group '…' has no calculated
     geometry - it was not placed at the … wall; place-group moves it once it is calculated".
   - One reload of all moved groups, `loadExternalObjectGroupLayout(…, 'posGroups', { reason:
     'adjusted' })`. A reload that loads nothing leaves the groups where the planner put them, with
     a correction per group (G59): "group '…' could not be reloaded at the … wall - it stays where
     the planner put it; place-group moves it".
5. The rest of the call is unchanged: the plan is read again, the group-wide attributes are set
   (G46) and the obstacle hint is added (D55). The hint for a group without a position names both
   forms: "A group gets its position from the placement it is created with - { wall, alignment?,
   offsetMm? } or { posGroup, posRotationY } (see get-authoring-rules) -, or place-group moves it
   against a wall or into a room corner."

The undo records need no change: `countingPlannerApi` counts the reload as a second step of the
call, and `undo` steps back twice (D47).

### 3. The served text: `hi-mcp-server.ts`

**`create-or-replace-groups`** (`:245-248`). The placement sentence becomes:

> Position a new group in the same call with placement. At a wall or in a room corner: { wall,
> alignment?, offsetMm? } - wall a side label (left, right, back, front) or a wall index;
> alignment center (the default) or the side label of the adjoining wall, which puts the group
> flush into that corner (wall back with alignment right: the back right corner), a group that
> starts with a corner article into the corner; offsetMm moves it along the wall away from that
> corner. The server computes the point and the rotation. Anywhere else, an island or a free spot:
> { posGroup, posRotationY }, the room point of the group's back left corner and its rotation.

**`place-group`** (`:279-280`). "Use it to move a group, or to position a group created without
placement, against a wall or into a corner - never compute wall points for this yourself." becomes
"Use it to move a group that is already in the plan; a new group takes the same wall, alignment and
offsetMm in its placement in create-or-replace-groups."

**`INSTRUCTIONS`**, step 2 (`:68`). The placement in brackets becomes "({ wall, alignment?,
offsetMm? } at a wall or in a room corner - the server computes the point -, { posGroup,
posRotationY } anywhere else; a plan into a room corner starts with a corner article, cornerArticle
true in the catalog)".

**`AUTHORING_RULES`**:

- **The corner relation rule** (`:18`). "give the group a placement with the room corner point and
  the posRotationY of that corner from the room's corners list" becomes "give the group a placement
  at one wall of that corner with the other wall as alignment (the back right corner: wall right,
  alignment back)".
- **Placement** (`:21`), new:

  > placement positions a new group, in one of two forms. At a wall or in a room corner: { wall,
  > alignment?, offsetMm?, roomIndex? } - wall a side label (left, right, back, front; back = top,
  > front = bottom in the top-view image) or the index of a wall in the walls array; alignment
  > center (the default), the side label of the adjoining wall to stand flush in the corner the two
  > walls share (wall back with alignment right: the back right corner; with two corner articles
  > the first one in roots goes into the corner), or end; offsetMm moves the group along the wall
  > away from that corner or from the wall's end; roomIndex the room, 0 by default. The server
  > computes the point and the rotation from the calculated group, as place-group does; a group
  > that would overlap another group moves along the wall to the nearest free place, and
  > corrections say so. Anywhere else - an island, the middle of the room - and for a group of wall
  > units only: { posGroup: [x, y, z], posRotationY, rootId? } - posGroup the room point of the
  > group's back left bottom corner in millimetres (y up, y = 0 on the floor; for a group of wall
  > units only, their mounting height), posRotationY its rotation in degrees, counter-clockwise as
  > seen from above (in the top-view image), required, 0 for no rotation; rootId optional: with two
  > corner articles, the one that goes into the corner posGroup names. A placement is applied
  > exactly once, when the group is created; a placement on a group that is already in the plan is
  > not used (move it with place-group), and groups returned by get-plan-context never carry this
  > field.

- **Walls** (`:22`), shortened to what the point form needs:

  > Walls: every room of get-plan-context carries a walls array - per wall its index, side, name
  > (back wall, front wall, left wall, right wall), start and end (points [x, 0, z] on the floor, in
  > the coordinates of posGroup), lengthMm, type and facingRotationY, the posRotationY of a group
  > with its back against that wall (back 0, left 90, front 180, right 270 in a rectangular room);
  > use the walls of type wall (an entry of type opening is a door). For a group anywhere else (an
  > island, the middle of the room, next to a door): any point on the floor that obstacles leaves
  > free as posGroup, any posRotationY.

- **Room corners** (`:23`), in the user's view instead of the contour's:

  > Room corners: every room of get-plan-context carries a corners list - per corner its name (back
  > left, back right, front left, front right; back = top, front = bottom in the top-view image)
  > and its point. A group in a room corner names one of the two walls as wall and the other as
  > alignment; a corner article first in the group goes into the corner. Looking into the corner
  > from the room, the root modules rightOf the corner article run along the wall on the right, the
  > root modules leftOf it along the wall on the left (the back right corner: rightOf along the
  > right wall, leftOf along the back wall). This holds for both hands of corner article.

  The sentence holds in all four corners: it follows the table of §7 of
  `docs/hi-mcp-behaviour.md`, which `plan-space.test.ts` and `group-placement.test.ts` guard.
- **Obstacles** (`:24`). "its span along that wall measured from the wall's end like d" loses
  "like d". "Put a new group on a stretch of wall or a spot that obstacles leaves free, with the
  recipes above too;" becomes "Put a new group on a stretch of wall or a spot that obstacles leaves
  free: fromEndMm is measured from the wall's end, so a placement with that wall, alignment end and
  offsetMm = the start of a free stretch puts the group on it;" (Q5).
- **Moving** (`:26`). "call place-group: the wall by side label or index, alignment start, center
  or end, or the side label of the adjoining wall to sit flush in that corner (wall right +
  alignment top is the back right corner), offsetMm along the wall." becomes "call place-group with
  wall, alignment and offsetMm as in a placement."
- **Example 1** (`:32-37`): `"placement": { "wall": "right", "alignment": "back" }`, introduced as
  "placed at the right wall, flush into its corner with the back wall".
- **Example 3** (`:47-57`): `"placement": { "wall": "right", "alignment": "back" }`; "looking into
  the corner from the room, the root modules rightOf c1 run along the right wall, the root modules
  leftOf it along the back wall".
- **Example 4** (`:58`): "the row centred on the back wall" is `"placement": { "wall": "back" }` -
  centred is the default.

The corners list keeps its `posRotationY` in the plan context (C18), as the point form of a corner
group still uses it. The `get-plan-context` description is not changed.

### Unit tests

**`tests/tool-executors.test.ts`**. `makeRoot`, `makeGroup`, `cornerDockInfos` and `repositioned`
move from `describe('place-group')` to the top of the file, so that both tools use them. A new
`describe('create-or-replace-groups wall placement')` has a fake planner whose first load adds
the calculated new group at a position given per test, and whose reload of a group in the plan
moves it (`repositioned`). Its tests:

- `it('loads a new group placed by wall once without a position and reloads it once at the wall')`:
  wall right, alignment back. Two loads and no probe; the first without `repositioningData`, the
  reload with `posGroup` [4000, 0, −3000] and 270.
- `it('centres a new group on the wall by default')`: wall back → [1600, 0, −3000], 0.
- `it("measures offsetMm from the wall's end with alignment end")`: wall back, end, 500 →
  [500, 0, −3000].
- `it('puts a new group that starts with a corner article into the corner the alignment names')`:
  [4000, 0, −2739], 270, as the `place-group` test of the same name.
- `it('moves a new group off another group along the wall and says so')` (G22).
- `it('counts the other new groups of the call at their targets, not where the planner first put them')`:
  the planner puts every new group into the back left corner, and two groups go into the back left
  corner. The first is not moved; the second is moved beside the first, with the correction.
- `it('places one group by wall and another by point in one call')`: the group placed by point gets
  its `repositioningData` and the probe in the first load; only the group placed by wall is
  reloaded.
- `it('keeps each new group matched to its input when the planner lists a reloaded group last')`:
  the first of two new groups is placed by wall and carries a front colour. `change-group-attribute`
  goes to the first group, not to the second.
- `it('builds a new group without its placement when the room has no such wall, and says so')`
  (G55): one load and no reload.
- `it('reads a wall placement it can partly use with its defaults, and says so')` (G56):
  alignment `diagonal`, `offsetMm` `"far"` and `roomIndex` −1.
- `it('uses the wall when a placement names a wall and a point, and says so')` (G57).
- `it('centres a new group when the alignment runs parallel to the wall')` (G20).
- `it('leaves a new group it cannot place where the planner put it, and says so')` (G58, G59).

Changed tests:

- `it('completes a placement where the intent is clear')`: the case with `wall` and `alignment` is
  a wall placement now, without the "dropped" correction; the case with `scale` gets the new text
  of G11.
- `it('uses no placement on a group that is already in the plan, which keeps its position')` gets
  a wall placement as a second case.
- In `describe('undo and redo')`, `historyPlanner` gets an option under which a load of a group
  that is in the plan replaces it, and the created groups get the geometry of `makeRoot`. New:
  `it('reverts a new group placed by wall, its load and its reload, in one undo')` — two planner
  undo steps, and the plan is as before.

The `place-group` tests stay as they are.

**`tests/hi-mcp-server.test.ts`**:

- `it('explains positioning with placement in the verified rotation sense')` expects the two forms
  of the placement rule, "counter-clockwise as seen from above", "back 0, left 90, front 180, right
  270", the corner sentence "Looking into the corner from the room, the root modules rightOf the
  corner article run along the wall on the right" and "To move an existing group against a wall or
  into a room corner, call place-group".
- `it('carries the one-group principle and the relation examples')` expects the placement of
  example 3 as `"placement": { "wall": "right", "alignment": "back" }`.
- `it('tells the agent what stands in the room and that the hint names a root module on an obstacle')`
  expects the new sentence for a free stretch.
- New: `it('places a new group by wall and alignment and leaves the point to the server')`. The
  `create-or-replace-groups` description names `{ wall, alignment?, offsetMm? }` and "The server
  computes the point and the rotation". The served text contains none of "end + d", "d = (lengthMm",
  "its end point and its facingRotationY", "position a group created without placement" and "never
  compute wall points".

`plan-space.test.ts` and `group-placement.test.ts` are not changed; the geometry stays as it is.

### The documentation

- `docs/hi-mcp-behaviour.md`: the state line; D23 in effect, with Q1 to Q6; D16 with both forms;
  D46 with the exception for the wall form; §5.1, §5.2, the steps of `create-or-replace-groups` in
  §6 (the wall placement after the load), §7 (positioning), §8.3 (G10 and G11 reworded, G55 to G59,
  G20 and G22 for `create-or-replace-groups`).
- The tool references: `docs/hi-mcp-server.md` and `hi-mcp/hi-mcp-server/README.md`
  (`create-or-replace-groups`: positioning and the example), `.agents/skills/hi-mcp-tools.md`.
- The skills: `.agents/skills/hi-authoring-rules.md` (placement, corners),
  `.agents/skills/roomle-hi-concepts.md` (positioning and its example),
  `.agents/skills/hi-mcp-server.md` (the placement).
- `docs/implementation/layout-and-placement.md` and `docs/implementation/tool-executors.md`: the
  shared wall placement and the step after the load.
- `AGENTS.md` and `.github/copilot-instructions.md`, pattern 5 of the architecture: the two
  forms.
- `.agents/backlog/mcp-test-open-issues.md`: issue 27 and its row leave the backlog.
- This analysis: closed out after the implementation.

### The live check

No model and no chat: the example page in headless Chromium against the deployed planner, the
MCP SDK client against the launcher on free ports. About 10 minutes. The calls, each in a fresh
plan of the Default Room:

1. Four `UTB60` with `{ wall: back, alignment: right }` → flush in the back right corner, inside the
   room.
2. The same with `{ wall: back }` → centred on the back wall.
3. An L-shaped group with a corner article and `{ wall: right, alignment: back }` → the corner
   article in the back right corner, the legs along the right and the back wall.
4. Two new groups in one call, one placed by wall with a front colour and one placed by point →
   each stands where its placement says, and the colour is on the first.

Each check reads the result's groups and the top image of `get-plan-images`. Undo is not part of
the live check.

### The test prompt: `docs/test-prompts.json`

A test `four-cabinets-centred-back-wall`: "add a row of four base cabinets centred on the back
wall", in the Default Room, expecting one `create-or-replace-groups` call with a wall placement
and the group centred on the back wall, inside the room. `docs/test-prompts.md` lists it.

### Commits

The plan is committed beside the analysis. The implementation follows in two commits: the code
with its tests, the served text and the documentation, then the test prompt.

## Implementation and verification

Implemented as planned on 2026-10-08, with the decisions Q1 to Q6 as recommended. Code, unit tests,
served text and documentation; the chat check was not run.

### Deviations from the plan

- **The reload keeps the group's attributes.** The live check found that a group placed by wall
  lost the attributes the library sets on a create (`mod_GroupGenerationLogic`,
  `mod_GroupWidthAdjustment` and five more): `repositionedGroup` sent no group `attributes`, and the
  planner keeps a reloaded group's attributes as sent. The reload of `place-group` is the same
  function, so moving a group dropped them too. `repositionedGroup` now sends the group's own
  attributes (C1 in `docs/hi-mcp-behaviour.md`), guarded by
  `it('reloads the group with its group attributes, which the planner keeps as sent')` and by the
  first test of the wall placement.
- **A correction of the shared wall logic** starts with the "posGroups[i]" prefix in
  `create-or-replace-groups` and as a sentence of its own in `place-group` (`sentence`); the
  messages of `place-group` are unchanged.
- **The test fake** of the wall placement calculates a new group as a row of base units with a
  height: a group without height data overlaps nothing (G22), and the overlap tests need one.

### Results

- **Unit tests**: 490 pass (`npx vitest run` in `hi-mcp`) — 13 new tests of the wall placement,
  the new `place-group` test of the group attributes, the new undo test and the new served-text
  test; the `place-group` tests pass unchanged. `npm run typecheck`, `npm run lint` and
  `npm run format:check` are clean, `check-markdown-links.js` reports no bad link.
- **Live check**, without a model: the example page in headless Chromium against the deployed
  planner (Default Room, `ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv`, a fresh plan per call), the MCP SDK
  client against the launcher on ports 3001 and 3110. After the fix of the group attributes:

  | Call | Result |
  |---|---|
  | Four `UTB60` by point at the back wall's end (reference) | [−685, 0, −3765], 0, 2420 mm, 7 group attributes |
  | Four `UTB60`, `{ wall: back, alignment: right }` | [2405, 0, −3765], 0 — flush in the back right corner (2405 + 2410 = 4815), 7 group attributes |
  | Four `UTB60`, `{ wall: back }` | [865, 0, −3765], 0 — centred, the position gpt-6-astra computed for the same row |
  | `UERTB90` with two units on each leg, `{ wall: right, alignment: back }` | [4815, 0, −3765], 270 — the corner article in the back right corner, the legs along the right and the back wall (top image) |
  | Two `UTB60` by `{ wall: left }` with `mod_FrontColor` 215, beside one `UTB60` by point | [−685, 0, −665], 90 and [1500, 0, −1500], 0; the colour on the first group's units only |
  | Two `UTB60` by point, then `place-group` `{ wall: right, alignment: back }` | moved into the back right corner, 7 group attributes kept |

  Each call took one `create-or-replace-groups` call of 1.1 to 1.5 s. The kernel listed the groups
  in the order of the load after the reload; the matching by `resultId` does not depend on it.
  Before the fix, the groups placed by wall had no group attributes, the one placed by point seven.

### Not run

- The chat check of the ticket ("add a group of 4 cabinets to the wall in the back" and a centred
  row with gpt-5.4-mini, three runs each, a few minutes) waits for a go.

### Noticed, not changed

- `.agents/skills/hi-authoring-rules.md`, the obstacles bullet of "Positioning a group", still says
  "A root module cannot stand where an object or another group's root module overlaps it" and "keep
  that span free" — the rule the served text dropped with D55 (RML-18077).
