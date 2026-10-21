# Where Mistral Large falls short of the prompts

> **Type**: Backlog — improvement candidates: where the MCP server could give a weaker model better
> information or hints
> **Domain**: the served text and the input schemas (`hi-mcp/hi-mcp-server/hi-mcp-server.ts`), the
> plan context in the agent's words (`agent-facing.ts`), roomle-ui — the HI tool commands
> (`hi-tool-commands.ts`, `hi-tool-payload.ts`, `hi-tool-hints.ts`)
> **Source**: the MCP tests `mcp-test-2026-10-17_10-50-12` (`mistral-large-latest`: every test of
> `docs/test-prompts.json` and five random tests) and `mcp-test-2026-10-21_16-59-20`
> (`mistral-large-4`: the tests 01–52 of `docs/test-prompts.json`, stopped as too slow), both
> against the local roomle-ui (`--dev`)

The chat model `mistral-large-latest` fulfils far fewer prompts than the GPT models: 23 pass,
17 partial, 16 fail of 56 runs, while gpt-6-astra passed 55 of 56 runs that morning — the same
51 fixed tests and five random tests of its own — against the same planner
(`mcp-test-2026-10-17_09-31-13`). The issues below are model findings, not
defects: the tools build what the model sends. They show where the served text, the input schemas
or the tool results leave a weaker model too much to get right. Each issue states what the model
does, what the investigation should start from and a direction; none is analysed in depth.

`mistral-large-4` passes far more of them: 33 pass, 5 partial, 14 fail of the 52 runs of
`mcp-test-2026-10-21_16-59-20` (the fixed tests 01–52; the session stopped there, about 3 minutes
per run). None of its 14 fails is a planning defect: 11 end on the images of `get-plan-images`
([11](#11-every-look-at-the-plan-ends-the-turn)), 3 on the chat timeout
([13](#13-turns-take-minutes)); in 9 of the 11 the plan already fulfils the request. Its 5 partial
runs are issues 4 and 12. Issues 1, 2, 3, 5, 6, 7 and 9 do not show in its runs.

A run number alone names a run of `mcp-test-2026-10-17_10-50-12` (`mistral-large-latest`);
"large-4 NN" names run NN of `mcp-test-2026-10-21_16-59-20`, whose test file numbers the tests
differently.

Every direction stays library-neutral: no article, category or value of a library goes into the
served text ([library-neutral](../../AGENTS.md#library-neutral)), and none of them refuses input
([Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort)).

**The model.** `mistral-large-latest` is an alias that moves with Mistral's releases. On
2026-10-17 the Mistral API answers it with `mistral-large-2512` (`GET /v1/models/mistral-large-latest`),
not with Mistral Large 4, which is the model `mistral-large-4` (`mistral-large-4-0`) and the
launcher's provider name `mistral-large-4`. The payload, placement and id issues (1–3, 5–7, 9) do
not show in the 52 runs of `mistral-large-4` (its image tests did not run); the tool choice of an
edit (4), attributes nobody asked for (8) and the answers (10) remain, and the images of a tool
result (11), the hinge of a new row end (12) and the speed (13) come with it.

## Overview

| # | Issue | Runs mistral-large-latest (of 56) | Runs mistral-large-4 (of 52) | Responsible | Direction |
|---|---|---|---|---|---|
| 1 | [The payload format is guessed: relations and ids the server does not read](#1-the-payload-format-is-guessed-relations-and-ids-the-server-does-not-read) | 18 | 0 | MCP server — input schema; roomle-ui — payload normalisation | Declare the group and root fields in the input schema; map the relation forms the model writes |
| 2 | [One piece of furniture is sent as several groups](#2-one-piece-of-furniture-is-sent-as-several-groups) | 8 | 0 | roomle-ui — HI tool command | Merge the groups of one call whose relations name each other's roots |
| 3 | [Wall units in a group of their own stand on the floor](#3-wall-units-in-a-group-of-their-own-stand-on-the-floor) | 4 | 0 | roomle-ui — wall placement | Hang a group of wall units only at the wall-unit height, or say that it stands on the floor |
| 4 | [Edits are made with the wrong tool](#4-edits-are-made-with-the-wrong-tool) | 9 | 4 | MCP server — tool descriptions; roomle-ui — results | Open the edit tools' descriptions with the user's words; a hint when a replace is an edit |
| 5 | [Obstacle hints are handed to the user instead of acted on](#5-obstacle-hints-are-handed-to-the-user-instead-of-acted-on) | 4 | 0 | roomle-ui — hints | Name the placement that clears the obstacle on the group's own wall |
| 6 | [A described wall or room is missed](#6-a-described-wall-or-room-is-missed) | 3 | 0 | MCP server — plan context | Describe each wall in the plan context: free stretches, openings, a sloping ceiling |
| 7 | [Rows and unit counts do not fit the request or the wall](#7-rows-and-unit-counts-do-not-fit-the-request-or-the-wall) | 5 | 0 | roomle-ui — results | Say in the result when a group reaches past its wall or out of the room |
| 8 | [Attribute ids and values are guessed](#8-attribute-ids-and-values-are-guessed) | 6 | 2 | roomle-ui — attribute commands; served text | Resolve a value name to the value and say so; check what invites unrequested materials |
| 9 | [Ids are guessed before the plan is read](#9-ids-are-guessed-before-the-plan-is-read) | 6 | 0 | roomle-ui — group lookup | Use the only group of the plan for an unknown group id and say so |
| 10 | [Answers do not match the plan](#10-answers-do-not-match-the-plan) | 9 | 1 | MCP server — results | Name in the result where each group stands, in the plan context's words |
| 11 | [Every look at the plan ends the turn](#11-every-look-at-the-plan-ends-the-turn) | — | 11 | embedding-lib — planning assistant | Move the images of a tool result into a user message for Mistral models |
| 12 | [The door at a new row end keeps its hinge](#12-the-door-at-a-new-row-end-keeps-its-hinge) | — | 1 | MCP server — served text | Name a delete that leaves the gap among the edits that give a row new ends |
| 13 | [Turns take minutes](#13-turns-take-minutes) | — | 3 | embedding-lib — planning assistant; MCP server — served text and results | Measure where the time of a turn goes before changing anything |

"—": not counted in that session.

Run 50 (the seven-turn kitchen conversation) ended with Mistral's rate limit in all three attempts;
it counts as an environment failure and is in none of the issues.

## 1. The payload format is guessed: relations and ids the server does not read

**Problem.** The model writes relations as `"relation": "rightOf"` without a neighbour, as
`relation` with `relatesTo`, `relToRootId` or `neighbourId`, or as a `relations` list beside the
roots, and leaves the first root without an id while the others refer to it as `root_1` or
`ROOT#1` (the server names it `root-1`). The server ignores these relations and docks the roots in
a row in their order — right when the order is the row's, wrong otherwise: a START piece of an
endless wardrobe ends up second (45). Runs 01, 05, 08, 11,
12, 14, 18, 36, 40, 42, 45, 46, 47, 51, 52 (relations), and the id-less roots in 16 runs.

**Finding.** The errors come from the runs that skip `get-authoring-rules`: 16 of the 19 runs with
a create but without the rules show them, 2 of the 16 runs that fetched the rules. The input schema
of `create-or-replace-groups` declares `posGroups` as `record(string, unknown)`; the field names
are only in the rules and in the prose of the description.

**Direction.** Declare the group fields (`id`, `placement`, `attributes`, `roots`) and the root
fields (`id`, `articleId`, `attributes`, `rightOf`, `leftOf`, `onTop`, `above`, `behind`) in the
input schema, open to further fields, so the schema carries the format a model reads first — low
effort. Map the pair forms (`relation` with a neighbour key) onto the relation and name the mapping
in `corrections`. Resolve `root_1`, `ROOT#1` and the like to the n-th root, or give an id-less root
an id that matches the model's reference.

**mistral-large-4.** Every create of its 52 runs names its relations with the declared keys and
ids, with or without `get-authoring-rules`.

**Reproduce.** `mcp-test-2026-10-17_10-50-12`, mistral-large-latest 45 (`image-only-tall-units`).

## 2. One piece of furniture is sent as several groups

**Problem.** A row, a wardrobe pair or a whole kitchen comes as several posGroups with the same
placement, the units naming roots of the other posGroups. The server moves each group beside the
previous one (G22) and leaves them separate; a posGroup without a placement lands at the plan
origin (08). Runs 06, 08, 11, 12, 40, 46, 47, 51 — 51 sends a kitchen as 33 groups of one unit.

**Direction.** When the posGroups of one call name each other's roots in their relations, merge
them into one group and say so in `corrections` — the intent is clear from the relations. Check
whether the "ONE group" sentence reaches a model that skips `get-authoring-rules` (it is in the
tool description, issue 1).

**mistral-large-4.** Every create sends one posGroup per piece of furniture, a whole L-shaped
kitchen with its wall units and hood included (large-4 47, 50).

**Reproduce.** `mcp-test-2026-10-17_10-50-12`, mistral-large-latest 08 (`attic-room-tall-units-right-wall`).

## 3. Wall units in a group of their own stand on the floor

**Problem.** The model places wall cabinets as a group of their own with the wall form
(`placement { wall }`): for "cabinets" (02) or split off a kitchen (46, 47, 51). The group stands on
the floor (0..720 mm), and no correction or hint says so.

**Finding.** The served text keeps the wall-unit height to the point form (`posGroup` with the
mounting height); the wall form puts every group on the floor.

**Direction.** Hang a group of wall units only, placed by wall, at the height the planner gives
wall units, or at least name it in the result. With issue 2 solved, wall units split off a kitchen
join its group and hang above its floor units.

**mistral-large-4.** Its wall units go into the group of their floor units with `above` and hang
at 1480 mm (large-4 51).

**Reproduce.** `mcp-test-2026-10-17_10-50-12`, mistral-large-latest 02 (`four-cabinets-back-wall`).

## 4. Edits are made with the wrong tool

**Problem.** The model re-sends a whole group with `create-or-replace-groups` for edits that have
their own tool: a move (09), a width (15, 31 — exchanged for another article), an exchange (23), one
more unit (18, 42, 54, 55). A replace without a placement keeps the group's origin, so a reversed or
extended row runs through a wall (09, 55); a new group with the id of an existing unit duplicates
it (18); a new group of one wall cabinet lands at the plan origin (54). Run 30 deletes with the
compacting delete where the test expects the in-place delete.

**Direction.** Open each edit tool's description with the words a user says for it — "move",
"wider" or "900 mm wide", "add one more", "above" — as `delete-article-in-place` and
`delete-article-and-compact` do (D58). A replace of an existing group that only adds or reorders
its roots could answer with a hint naming the edit tool. Say in the result when a replaced group's
units now stand outside the room.

**mistral-large-4.** The edits use their own tools — move, width, exchange, insert, swap, merge,
the interior fittings — with two exceptions. "Delete the middle unit" closes the gap with
`delete-article-and-compact` where D58 makes the in-place delete the default (large-4 44, 45, 46;
the same words give the in-place delete in large-4 35). A widening the library cannot calculate
is answered with another kind of article: Error 14019 for a tall unit at 900 mm, and the model
exchanges it for a 900 mm base cabinet instead of correcting the door direction it keeps
(large-4 36) — the correction ends "change the failing values or replace the article".

**Reproduce.** `mcp-test-2026-10-21_16-59-20`, mistral-large-4 44 (`undo-last-change`).

## 5. Obstacle hints are handed to the user instead of acted on

**Problem.** The hint names the door, the window, the sofa or the chair a group stands on and the
free stretches of its wall; the model repeats it to the user and asks what to do instead of moving
the group: a row in a door opening (07), wall cabinets in front of a window with room beside it
(39), tall cabinets on the sofa (40), an island on a dining chair (41).

**Direction.** Name the placement that clears it on the group's own wall — the `offsetMm` and
`alignment` of a free stretch the group fits — as D55 does for an opening of the adjoining wall;
for a point placement, a free point. Check whether a served sentence like "when the hint names a
free stretch the group fits, move it there" is enough.

**mistral-large-4.** It acts on the hint: a row in front of a door in the adjoining wall is
deleted and built again in the free stretch (large-4 07); a placement clears a window of the
adjoining wall by an offset (large-4 09).

**Reproduce.** `mcp-test-2026-10-17_10-50-12`, mistral-large-latest 40 (`obstacle-back-wall-beside-the-sofa`).

## 6. A described wall or room is missed

**Problem.** The model misses the place the prompt describes: "under the attic slope" goes to the
back wall of the other room (13), "the solid grey wall of the living area" to a glass front of the
dining area (52), "the left-hand wall" to the back wall (46).

**Direction.** Describe each wall in the plan context in the agent's words: its free stretches, the
share of openings (a glass front is mostly openings) and a sloping ceiling above it from the contour
levels. Room data only, library-neutral.

**mistral-large-4.** It reads the slope from the level slices of the attic room and places the
storage along the wall under it (large-4 14).

**Reproduce.** `mcp-test-2026-10-17_10-50-12`, mistral-large-latest 13 (`attic-room-storage-under-slope`).

## 7. Rows and unit counts do not fit the request or the wall

**Problem.** A 6.2 m row on a 5 m wall, through the door and out of the room (49); tall units on top
of a media unit asked to be low (04); four units for an image with three (45); three wardrobes for
two (11); a 60 cm article stretched to 1800 mm, which the library cannot calculate (10).

**Direction.** Say in the result when a group reaches past the end of its wall or out of the room —
a note, never a refusal (the user may want it). The width the library cannot calculate is in
`notLoaded` already.

**mistral-large-4.** Not seen in its 52 runs; its image tests did not run.

**Reproduce.** `mcp-test-2026-10-17_10-50-12`, mistral-large-latest 49 (`image-only-no-text`).

## 8. Attribute ids and values are guessed

**Problem.** The model sends `frontColor` and the word "white" (55) without `find-attributes`; the
id is rejected, the value is accepted and the front disappears. It also sets front and carcase
colours nobody asked for (01, 05, 06, 11, 41).

**Direction.** Resolve a value given by its name to the value of that name and say so in
`corrections`; give feedback with the values when no name matches. Check which served sentence or
skill invites the model to choose materials the user did not ask for.

**mistral-large-4.** It sends valid ids and values for what is asked, from the master data of the
plan context or from `find-attributes` (large-4 17, 47, 50), but adds what nobody asked for: two tall cabinets get fronts
matched to the room's kitchen and an attribute id no module has (`mod_GroupGenerationLogic`), then
three attribute changes to undo the library's program switch (large-4 52); a 400 mm wardrobe gets
a hanging rail the library cannot calculate (large-4 40).

**Reproduce.** `mcp-test-2026-10-21_16-59-20`, mistral-large-4 52 (`obstacle-back-wall-beside-the-sofa`).

## 9. Ids are guessed before the plan is read

**Problem.** The model calls a tool with an invented group id — "kitchen", "group_1",
"Kitchen_back_wall", ids of the form `g1719233219344` — before it reads the plan (21, 30, 31, 50,
52, 55). The error lists the groups of the plan and the next call uses one; each guess costs a step.

**Direction.** With exactly one group in the plan, an unknown group id means that group: use it and
say so — the error already names the one fix.

**mistral-large-4.** Every edit reads the plan first and uses the ids it lists.

**Reproduce.** `mcp-test-2026-10-17_10-50-12`, mistral-large-latest 21 (`edit-delete-group`).

## 10. Answers do not match the plan

**Problem.** The answers name walls the groups do not stand at (09, 22, 24, 43), units that were not
added (42), images the model misread (44), wall units hanging where they stand on the floor (46,
47), front colours the plan does not have (01).

**Direction.** Name in the result of a plan-changing tool where each group stands, in the plan
context's words — the wall, the corner, the stretch along it — so the answer can repeat it instead
of deriving it from coordinates.

**mistral-large-4.** Its answers match the plan, with one slip: the wall unit that moved with an
inserted drawer unit is called the one "above the fridge" — it hangs above the drawer unit next to
the fridge (large-4 31).

**Reproduce.** `mcp-test-2026-10-21_16-59-20`, mistral-large-4 31 (`edit-insert-below-wall-units`).

## 11. Every look at the plan ends the turn

**Problem.** `mistral-large-4` checks its work with `get-plan-images` after most plan changes, and
in one run before it plans (large-4 10). The planning assistant passes the renders of the tool
result to `@ai-sdk/mistral`, which writes them into the prompt as base64 JSON text — 1.2 to 2.0
million tokens against a context of 1,048,576 — and the turn ends with an error. 11 of 52 runs end
so (large-4 04, 05, 10, 15, 19, 32, 34, 41, 47, 48, 52); in 9 of them the plan already fulfils
the request, but the user sees the error instead of the answer, and a conversation ends there: the
swap of large-4 41 is never sent. Smaller renders fit (large-4 13, 14).

**Direction.** The open Chat item "Images of a tool result for Mistral" of the
[backlog index](README.md#chat): move the images of a tool result into a user message for Mistral
models in the planning assistant of the embedding-lib (roomle-ui `hi-planning-assistant.ts`, a
`wrapLanguageModel` middleware). The tests of a Mistral model measure little else until then.

**Reproduce.** `mcp-test-2026-10-21_16-59-20`, mistral-large-4 04 (`media-unit-left-wall`).

## 12. The door at a new row end keeps its hinge

**Problem.** "Delete the middle cabinet and leave the gap" splits a row of five single-door
wardrobes into two rows; the new right end of the left row keeps the left hinge of a middle door,
so its handle is on the outside of the row (large-4 39). After a swap, an exchange, an added
article or a compacting delete the model hinges the new end right (large-4 37, 38, 40, 43, 46).

**Finding.** The authoring rule names the edits that give a row a new end as "an article added,
deleted, exchanged or swapped at an end". A delete in place in the middle of a row is no delete at
an end, yet it gives both new rows a new end.

**Direction.** Name a delete that leaves the gap, and so splits the row, among the edits that give
a row new ends — in the authoring rule and in the new-end reminder of `get-plan-context`. Served text
only: D84 rejects the server setting the hinge side.

**Reproduce.** `mcp-test-2026-10-21_16-59-20`, mistral-large-4 39 (`wardrobe-split-door-hinges`).

## 13. Turns take minutes

**Problem.** A `mistral-large-4` run takes about 3 minutes: the chat a median of 80 s and a mean of
153 s per run. 3 of 52 runs send nothing for the rest of the run script's 600 s chat timeout —
twice right after reading the plan, so nothing is built (large-4 06, 49), once after the create of a
whole kitchen, so the answer is missing (large-4 50). A session of the 75 tests takes about 4 hours;
`mcp-test-2026-10-21_16-59-20` was stopped after 52.

**Direction.** Measure where the time of a turn goes before changing anything — reasoning, output
tokens, the size of the served text, the plan context and the tool results — with the step log of
the planning assistant (the open Chat item "A step log for the benchmark" of the
[backlog index](README.md#chat)). A speed-up changes the served text, the results and their size,
never the planning.

**Reproduce.** `mcp-test-2026-10-21_16-59-20`, mistral-large-4 49 (`kitchen-oven-hood-sink-fridge-corner`).
