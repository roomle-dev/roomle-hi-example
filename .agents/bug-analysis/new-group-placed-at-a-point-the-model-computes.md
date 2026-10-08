# Bug Analysis: a new group is placed at a point the model computes

> **Type**: Bug Analysis
> **Domain**: hi-mcp — the placement of a new group in `create-or-replace-groups` (`normalizePlacement`, `tool-executors.ts`); the served placement text (`AUTHORING_RULES` and the descriptions of `create-or-replace-groups`, `get-plan-context` and `place-group`, `hi-mcp-server.ts`); the wall geometry of `place-group` (`placeGroupAtWall`, `tool-executors.ts`; `plan-space.ts`)
> **Trigger**: [RML-18078](https://roomle.atlassian.net/browse/RML-18078); backlog [`mcp-test-open-issues.md`](../backlog/mcp-test-open-issues.md) issue 27; decision D23 (deferred) of [`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md); related: [RML-18007](https://roomle.atlassian.net/browse/RML-18007) (`place-group`, D21), [RML-17966](https://roomle.atlassian.net/browse/RML-17966) (removed the old wall placement), [RML-18041](https://roomle.atlassian.net/browse/RML-18041)
> **Date**: 2026-10-08
> **Author**: AI Assistant
> **Status**: Open — analysed; D23 and the points of [Decisions to take](#decisions-to-take) wait for review

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
| Q5 | `alignment` `start` and `end` | They stay accepted, as in `place-group`, but the text teaches the side labels of the adjoining walls and `center`. In `place-group` they mean the wall's points (`wallSpanStart`, `plan-space.ts:1008`), so the group stands in the room either way | As stated |
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
