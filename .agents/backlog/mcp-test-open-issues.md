# Open issues of the MCP test

> **Type**: Backlog — what is still to be done about the planning the MCP server produces
> **Domain**: hi-mcp — `create-or-replace-groups`, `merge-article-into-group`, the command tools
> (`hi-mcp/hi-mcp-server/tool-executors.ts`, `group-layout.ts`, `group-placement.ts`), the served
> text (`hi-mcp-server.ts`), the chat (`hi-mcp/hi-mcp-chat`); roomle-ui defects the runs show
> **Maintained by**: step 7 of [the testing skill](../skills/hi-mcp-testing.md#7-open-issues)

Each issue names the problem, its cause, the to-do, the test of the fix and how to reproduce it. An
issue leaves this document when its fix is in the code. The guideline for every server issue is
[Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort): wrong content an agent creates
is an instruction problem first; correct where the intent is clear, report what was corrected, and
never drop the agent's content silently.

## Overview

| # | Issue | Kind | Priority |
|---|---|---|---|
| 23 | [A worktop colour change drops hanging wall units onto the worktop](#23-a-worktop-colour-change-drops-hanging-wall-units-onto-the-worktop) | bug, roomle-ui | high — wall cabinets on the worktop |
| 40 | [A unit colour after a kitchen-wide colour misses the doors](#40-a-unit-colour-after-a-kitchen-wide-colour-misses-the-doors) | bug, roomle-ui command | high — success reported, fronts unchanged |
| 51 | [A replace drops the group's materials](#51-a-replace-drops-the-groups-materials) | bug, MCP server | high — materials lost without a correction |
| 35 | [The handleless right corner unit as the first root with two legs stands 239 mm in the wall](#35-the-handleless-right-corner-unit-as-the-first-root-with-two-legs-stands-239-mm-in-the-wall) | bug, MCP server placement or planner | high — the kitchen stands in the wall |
| 49 | [A new group stands on an obstacle](#49-a-new-group-stands-on-an-obstacle) | MCP server feedback, instructions | high — cabinets across a window and on furniture |
| 27 | [A new group needs a point the model computes](#27-a-new-group-needs-a-point-the-model-computes) | decision D23, instructions | high — groups outside the room |
| 43 | ["Delete" and "remove" are taken for each other](#43-delete-and-remove-are-taken-for-each-other) | instructions | high — the other edit than asked |
| 45 | ["The middle unit" read from the docking](#45-the-middle-unit-read-from-the-docking) | plan context | medium — the wrong unit edited |
| 46 | [A new group beside an existing one for "add a cabinet to the right of the kitchen"](#46-a-new-group-beside-an-existing-one-for-add-a-cabinet-to-the-right-of-the-kitchen) | instructions | medium — a separate group |
| 48 | [A worktop colour sent as `mod_PaneltopColor`](#48-a-worktop-colour-sent-as-mod_paneltopcolor) | `find-attributes` | medium — the worktop keeps its default |
| 39 | [A unit added to a coloured kitchen keeps the default material](#39-a-unit-added-to-a-coloured-kitchen-keeps-the-default-material) | MCP server correction | medium — a dark unit in a white kitchen |
| 52 | [A group material overwrites a unit's own value](#52-a-group-material-overwrites-a-units-own-value) | bug, MCP server | medium — accents lost, the agent repairs them |
| 36 | [A wall-unit row runs into a unit hung above a base unit](#36-a-wall-unit-row-runs-into-a-unit-hung-above-a-base-unit) | MCP server correction | medium — two wall units in one place |
| 42 | [A wall unit that keeps its place overlaps the unit that moved in below it](#42-a-wall-unit-that-keeps-its-place-overlaps-the-unit-that-moved-in-below-it) | roomle-ui command, MCP server feedback | medium — two units above in one place |
| 41 | [A row edit puts a unit in front of a door without a hint](#41-a-row-edit-puts-a-unit-in-front-of-a-door-without-a-hint) | MCP server feedback | low — the unit stands inside the room |
| 37 | [A first call with a guessed payload](#37-a-first-call-with-a-guessed-payload) | instructions | low — one lost step |
| 47 | [A root id sent as the group id is refused](#47-a-root-id-sent-as-the-group-id-is-refused) | MCP server correction | low — one lost step |
| 38 | [A provider answer the AI SDK cannot process ends the turn without an answer](#38-a-provider-answer-the-ai-sdk-cannot-process-ends-the-turn-without-an-answer) | chat | low — rare |
| 13 | [Undocked wall units reject the whole group](#13-undocked-wall-units-reject-the-whole-group) | MCP server correction | low — a group without relations only |
| 50 | [Two units on one Top side vector take the same place](#50-two-units-on-one-top-side-vector-take-the-same-place) | MCP server correction | low — two units in one place |
| 3 | [A docking ring anchors the wrong root](#3-a-docking-ring-anchors-the-wrong-root) | bug, MCP server | low — docking written as `contextData` only |
| 7 | [Docking to a vector the article does not have](#7-docking-to-a-vector-the-article-does-not-have) | MCP server correction | low — docking written as `contextData` only |
| 14 | [A floor unit is docked onto a top vector](#14-a-floor-unit-is-docked-onto-a-top-vector) | MCP server correction | low — docking written as `contextData` only |
| 15 | [A G7 correction docks a part by a wall unit at floor level](#15-a-g7-correction-docks-a-part-by-a-wall-unit-at-floor-level) | bug, MCP server | low — docking written as `contextData` only |

`run.json` and `planner-calls.json` of the run directories named under **Reproduce** hold the payload
the model sent; the directories are under `.temp/result/`.

## 23. A worktop colour change drops hanging wall units onto the worktop

**Problem.** A wall unit or a range hood hung `above` a base unit stands at y 1480 after the load and
at y 820 — on the worktop — after the `change-group-attribute` commands the server runs for the
kitchen-wide materials (D36), typically after `mod_CountertopColor`. Units hung beside a tall unit or
beside the hood keep y 1480. A group of one base unit and one wall unit keeps y 1480 after the same
commands, and not every kitchen shows it. No correction reports it. Every kitchen with wall units and
a material is exposed, since the server sets the materials itself.

**Cause.** Not found. The worktop regeneration of `mod_CountertopColor` is the likely trigger;
suspected: the arrangement stores the reciprocal of a docking entry without its offset
(`hi-root-module-arrangement.ts`, roomle-ui).

**To do.** Open a roomle-ui ticket. Reproduce in roomle-ui with the payload below, find where the hang
offset is lost, and fix it there.

**Test.** A glue-logic test: a group with a wall unit hung by an offset above a base unit keeps its
height after `mod_FrontColor` and `mod_CountertopColor`.

**Reproduce.** `mcp-test-2026-10-06_08-31-06`: gpt-5-mini 11 (the wall unit above the sink) and
gpt-6-astra 09 (the wall unit of the facing run, sent with `gapMm 660`).

## 40. A unit colour after a kitchen-wide colour misses the doors

**Problem.** After a kitchen-wide `mod_FrontColor` (D36, set by `change-group-attribute`),
`change-module-attribute mod_FrontColor` without `moduleId` on one unit reports success and the plan
context shows the new value on the root, but the doors keep the kitchen-wide colour: in
`order-data.json` the root carries the new value and its `mf_Door` the old one.

**Cause.** `change-group-attribute` sets the attribute on every root and every sub module that
carries it (D20), so the doors hold their own value. `change-module-attribute` without `moduleId`
sets the root only.

**To do.** `change-module-attribute` without `moduleId` sets the attribute on the root and on its sub
modules that carry it, in one calculation — the root-level counterpart of D20 (roomle-ui, the command
in `hi-plan-context.ts` / `glue-logic.ts`). The tool description says that a unit attribute reaches
the unit's fronts.

**Test.** A glue-logic test: after `change-group-attribute mod_FrontColor` on a group, a
`change-module-attribute mod_FrontColor` on one root changes the front colour of that root's door.

**Reproduce.** `mcp-test-2026-10-07_09-46-08`: gpt-6-astra 08.

## 51. A replace drops the group's materials

**Problem.** `create-or-replace-groups` with the id of a group in the plan — a replace — loses the
group's materials: the units fall back to the default toe kick, worktop, outside carcase and handle
position, and the result has no correction. The call that created the group had set each of them
and reported it.

**Cause.** `applyKitchenWideAttributes` (`tool-executors.ts`) sets with `change-group-attribute`
only the group attributes the loaded group does not list among its own settings. After a replace
the group lists the attributes its load just sent, so none of them is set on the units; the replace
rebuilds the roots with their own attributes, and the values the first call set on every unit are
gone.

**To do.** Tell the library's group settings apart from the other group attributes without the
loaded group's list — e.g. from the master data — so a replace sets the same attributes on its units
as a create (D36), and reports each.

**Test.** A tool-executors test: a replace of a group with `mod_ToekickColor` in its `attributes`
runs `change-group-attribute mod_ToekickColor` after the load and reports it, as the create does.

**Reproduce.** `mcp-test-2026-10-07_09-46-08`: gpt-6-astra 06.

## 35. The handleless right corner unit as the first root with two legs stands 239 mm in the wall

**Problem.** `EUERTB90` (the handleless right-handed corner unit) as the first root, with units
`rightOf` and `leftOf` it, placed at the back right corner `[4815, 0, -3765]` / 270, can stand with
its back 239 mm in the right wall (group pos `[5054, 0, -3765]`, footprint x 2944–5054). The same
article with one leg or as a later root, and `UERTB90` with two legs, stand inside the room.

**Cause.** Not analysed. The server sends the corner point with the anchor frame
`rootRelPos [261, 0, 0]`, `rootRelRotationY 0`; the planner arranges the corner unit at
`[261, 0, 239]` in group space, so the left leg's back line lies 239 mm behind the corner unit's.
Either the frame of the handleless right corner (`anchorFrameOfRoot`, `group-placement.ts`) misses
the article's back offset, or the planner's arrangement of the left leg does.

**To do.** Reproduce with the payload below, compare the probe's `dockInfos` of `EUERTB90` with those
of `UERTB90`, and fix the frame or report the planner defect.

**Test.** The payload below loads with the corner unit's back edges on both walls.

**Reproduce.** `mcp-test-2026-10-04_13-00-37`: gpt-5.4-mini 11.

## 49. A new group stands on an obstacle

**Problem.** A new group is placed across a window, onto the sofa or into another group, and the
result reports success. gpt-5-mini centres a row on the window wall and hangs two wall units across
the window, puts two tall cabinets into the back left corner on the sofa, and runs an island into the
kitchen's base units; gpt-5.4-mini puts a row flush at the wall's end with three wall units across
the window.

**Cause.** The obstacle rule (`AUTHORING_RULES`, `hi-mcp-server.ts`) leaves the overlap test to the
model: it has to compare the outlines and height ranges of its root modules with every object, and a
window's `fromEndMm` with its own d. The walls rule hands it recipes that ignore obstacles — centred,
flush into a corner, at the wall's end — and the models take them. No result of
`create-or-replace-groups` or `place-group` says that a group overlaps an object, a door's or a
window's span or another group; D43 does that for row edits and other groups only.

**To do.** A hint in the results of `create-or-replace-groups` and `place-group`, like D43's: per
root module that overlaps an object or a root module of another group in outline and height range,
or stands in a door's span or in a window's span above its `bottomMm`, its id, what it overlaps,
and the free stretches of that wall as `fromEndMm` ranges. The group is built anyway — the user may
want it so. Then shorten the obstacle rule to what the hint does not cover. Issue 41 can use the same
test for a row edit.

**Test.** tool-executors tests: a group created across a window, onto an object and into another
group gets the hint with the free stretches; a group beside them gets none. The MCP tests
`obstacle-window-back-wall`, `obstacle-back-wall-beside-the-sofa` and `obstacle-island-free-spot`
with gpt-5-mini and gpt-5.4-mini: the group ends clear of the obstacles, after one correction at
most.

**Reproduce.** `mcp-test-2026-10-07_09-46-08`: gpt-6-astra 09.

## 27. A new group needs a point the model computes

**Problem.** A new group is positioned with `posGroup` and `posRotationY` the model takes from a wall:
its `end` and its `facingRotationY`, or a point computed along it for a centred or offset row. Models
take the wall's `start` instead of its `end` (the group runs out of the room), combine a point and a
rotation of different walls, or send no placement and move the group with `place-group` right after
(a second call and a reload).

**Cause.** The walls array names `start` and `end` in the direction of the room contour, so the end
of the back wall is its left corner — a model that reads "start" as the beginning of a row takes the
wrong corner. A centred row is a computation (example 4 of the rules). `place-group` takes a wall, an
alignment and an offset; `create-or-replace-groups` does not — `placement { wall, alignment,
offsetMm }` is deferred (D23). A group outside the room is never refused (D22).

**To do.** Decide D23: a placement by wall, alignment and offset in `create-or-replace-groups`, with
the point computed by the server as `place-group` does. Until then, say in the
`create-or-replace-groups` description which corner a wall's `end` is ("the corner on the left as seen
from the room").

**Constraints.** The footprint of a new group exists only once the planner has calculated it, so the
server loads the group without `repositioningData` and then runs the `place-group` logic in the same
call — `placeGroupAtWall` (`tool-executors.ts:2414`), the overlap check and the reload, moved out of
the `place-group` executor so that both use it; the reload keeps the generated roots and their
colours, as the reload of `place-group` does. `normalizePlacement` (`tool-executors.ts:946`) then
accepts `{ wall, alignment?, offsetMm?, roomIndex? }` beside `{ posGroup, posRotationY, rootId? }`,
and G11 no longer drops the wall fields. A width computed before the load from the catalog's
`mod_Width` of the floor row breaks on corner articles and range hoods.

**Test.** Unit: a new group placed by wall and alignment loads once without `repositioningData` and
is reloaded once with the computed one; a corner kitchen goes into the corner the alignment names.
"add a group of 4 cabinets to the wall in the back" and a centred row with gpt-5.4-mini: one call,
the group inside the room at the wall.

**Reproduce.** `mcp-test-2026-10-06_08-31-06`: gpt-5.4-mini 02 and 06 (the wall's start);
`mcp-test-2026-10-04_13-00-37`: gpt-5.4-mini 02, 09 and 10 (point and rotation of different walls),
gpt-6-astra 02 and 06 (no placement, then `place-group … center`).

## 43. "Delete" and "remove" are taken for each other

**Problem.** For "delete the middle unit" gpt-5-mini calls `remove-article-from-group` and closes the
gap; for "remove the middle unit" and "remove the base unit next to the corner unit" gpt-5.4-mini calls
`delete-root-module`, which splits the group — a corner kitchen into four groups.

**Cause.** Both tool descriptions open with the user's word (D40), and the models still take the
other tool, so the descriptions do not make the difference clear enough. Which sentence leads them
to the other tool is not analysed; the tool names differ in more than the verb, and both
descriptions speak of a root module.

**To do.** Analyse the tool choice of the runs below against the two descriptions and the tool list of
the instructions; make the user's verb the first thing each description says, in the same words.

**Test.** `hi-mcp-server.test.ts` pins the opening sentences; "delete the middle unit" and "remove
the middle unit" with gpt-5-mini and gpt-5.4-mini, three runs each, take the matching tool.

**Reproduce.** `mcp-test-2026-10-06_08-31-06`: gpt-5-mini 17, gpt-5.4-mini 16 and 24.

## 45. "The middle unit" read from the docking

**Problem.** For "replace the middle unit" gpt-5.4-mini exchanges the first unit of the row.

**Cause.** The plan context gives the roots no row position (D15: no root positions), and it lists
the roots in creation order, not in row order — an inserted unit is listed last. The model has to
read the order from the docking entries.

**To do.** Give every root of a row its position in the plan context (e.g. `rowIndex`, counted from
the end of the row at the wall), or list the roots in row order and say so in the `get-plan-context`
description.

**Test.** A tool-executors test: after an insert between the first and the second unit, the inserted
unit has row position 2. "replace the middle unit" with gpt-5.4-mini exchanges the middle unit.

**Reproduce.** `mcp-test-2026-10-06_08-31-06`: gpt-5.4-mini 14.

## 46. A new group beside an existing one for "add a cabinet to the right of the kitchen"

**Problem.** A model that does not read the rules creates a second group for a unit beside an
existing group instead of docking it with `merge-article-into-group`.

**Cause.** The `create-or-replace-groups` description says that articles beside each other are one
group, but not that an article beside an existing group goes into that group with
`merge-article-into-group`; only the instructions and the rules say so.

**To do.** One clause in the `create-or-replace-groups` description: "an article beside an existing
group goes into that group: `merge-article-into-group` at the end of a row,
`insert-article-into-group` between two root modules".

**Test.** `hi-mcp-server.test.ts` pins the clause; "add a cabinet with drawers to the right of the
kitchen" with gpt-5.4-mini merges the unit into the row.

**Reproduce.** `mcp-test-2026-10-06_08-31-06`: gpt-5.4-mini 12.

## 48. A worktop colour sent as `mod_PaneltopColor`

**Problem.** For "the worktop should be made of dark marble" gpt-5.4-mini searches `find-attributes`
and sets `mod_PaneltopColor` as a kitchen-wide attribute; no module has it, the planner refuses it
(P3, reported), and the worktop keeps its default.

**Cause.** Not analysed: which match of `find-attributes` for the model's search text leads it to
the panel top instead of `mod_CountertopColor`.

**To do.** Replay the `find-attributes` calls of the run below, and make the worktop's attribute the
first match for "worktop" (its desc or the result order).

**Test.** A `find-attributes` test: "worktop" and "worktop colour" return `mod_CountertopColor`
first.

**Reproduce.** `mcp-test-2026-10-06_08-31-06`: gpt-5.4-mini 11.

## 39. A unit added to a coloured kitchen keeps the default material

**Problem.** A unit added with `merge-article-into-group` or `insert-article-into-group` to a kitchen with a kitchen-wide material
(e.g. `mod_FrontColor` 192 on every unit) carries the default material; the answer does not say so.

**Cause.** `merge-article-into-group` and `insert-article-into-group` forward only the `attributes` the agent sends. The
kitchen-wide attributes of D36 are set by `create-or-replace-groups` after its load and are not part
of the group, so a later unit does not inherit them.

**To do.** Give the merged or inserted unit the value the group's article roots share for a material attribute
the new article carries (`mod_FrontColor`, `mod_CarcaseColor`, … — every root of the group with the
same value) when the agent sent none, and report it as a correction; an attribute the agent sent
wins.

**Test.** A group whose roots all carry `mod_FrontColor` 192: `merge-article-into-group` without
attributes forwards `mod_FrontColor` 192 with the correction; with `mod_FrontColor` 160 sent, 160.

**Reproduce.** `mcp-test-2026-10-07_09-46-08`: gpt-6-astra 26.

## 52. A group material overwrites a unit's own value

**Problem.** When the agent sends a material for the group and another value of it on single roots —
an accent: dark wall units in a light kitchen, `Modern` fronts on two wall units of a `Classic`
kitchen — every unit ends with the group's value. The correction says only "set on every unit", and
the agent needs further calls to restore the accents.

**Cause.** `applyKitchenWideAttributes` (`tool-executors.ts`) runs `change-group-attribute` after
the load, which sets the attribute on every root and sub module of the group (D20) — over the roots'
own values from the load. D36 keeps a unit attribute on some roots per unit.

**To do.** After a group attribute, set each root's own value of it again (with its sub modules, see
issue 40), and name those roots in the correction ("… set on every unit except …").

**Test.** A tool-executors test: a group with `mod_FrontColor` 190 and two roots with
`mod_FrontColor` 326 — after the load the two roots carry 326, the others 190, and the correction
names the two roots.

**Reproduce.** `mcp-test-2026-10-07_09-46-08`: gpt-6-astra 08.

## 36. A wall-unit row runs into a unit hung above a base unit

**Problem.** `wall1 above base1`, `wall2 rightOf wall1`, `wall3 rightOf wall2` and `wall4 above
base3`: the row ends where `wall4` hangs, so two units share one place. The server's own correction
G44 (two units `above` one carrier: the second put `rightOf` the first) can move a unit into the
place of another unit above the next carrier the same way. Nothing reports it.

**Cause.** The compile separates two units `above` one carrier (G44) and two roots on one side
vector (G8); it does not check whether a row reaches a unit hung `above` another carrier — it knows
no widths while compiling.

**To do.** With the unit widths of the catalog (`mod_Width`), a unit `above` a floor unit whose place
the wall-unit row already covers goes `rightOf` the row's last unit, reported; G44 checks the place it
moves a unit to the same way.

**Test.** The shape above compiles `wall4` `rightOf` `wall3` with the correction.

**Reproduce.** `mcp-test-2026-10-04_13-00-37`: gpt-5.4-mini 07; `mcp-test-2026-10-05_14-20-34`:
gpt-5-mini 11 (G44).

## 42. A wall unit that keeps its place overlaps the unit that moved in below it

**Problem.** `remove-article-from-group` on the unit next to the corner of the Corner Kitchen: the hob
unit moves into the gap with its range hood (D42), and the wall unit above the removed unit keeps
its place, because the hob unit carries a unit above it already. The hood now hangs in the place of
that wall unit. The correction says that the wall unit keeps its place, not that it overlaps the
hood.

**Cause.** `removeArticleFromGroup` (roomle-ui `glue-logic.ts`) keeps a unit above the removed root
in place when the neighbour that moves into the gap carries a unit above it already. The server's
row hints (`withRowHints`, `tool-executors.ts`) compare whole groups, so an overlap of two units of
the same group is not seen.

**To do.** The correction names the unit above that the kept unit now overlaps, and says what the
agent can do: remove the kept unit with `remove-article-from-group`, or move the units above. The
planner tests the kept unit's box against the boxes of the units above that moved
(`carriersOfUnitsAbove`, `hi-root-module-arrangement.ts`).

**Test.** A glue-logic test on the corner kitchen helpers: removing the unit next to the corner gives
the correction with the overlapped hood; a remove whose kept unit overlaps nothing gives the
correction without it.

**Reproduce.** `mcp-test-2026-10-06_08-31-06`: gpt-5-mini 24, gpt-6-astra 24.

## 41. A row edit puts a unit in front of a door without a hint

**Problem.** Inserting a drawer unit between the hob unit and the sink unit of the Corner Kitchen
grows the right leg from 3561 to 4161 mm. The tall unit at its end then stands from z −204 to 396,
in front of the door of that wall (z 280 to 1180). The result has no hint.

**Cause.** `rowReachHints` (`tool-executors.ts`, D43) tests the corners of the group's volume against
the room contour with `pointInsideRoom`. A door is a segment of that contour (`type` null at level 0),
so a row in front of it still stands inside the room.

**To do.** The D43 hint also names an opening the row now stands in front of and did not before: the
row's back edge along a wall overlaps an opening segment of that wall at the row's height (a door at
level 0, a window at the height of the units). The row is built anyway; the user may want it so.

**Test.** A tool-executors test: a row along a wall with a door segment. An insert that makes the row
reach into the door's span gives the hint; a row that stood in front of the door before the edit
gives none.

**Reproduce.** `mcp-test-2026-10-07_09-46-08`: gpt-6-astra 23.

## 37. A first call with a guessed payload

**Problem.** gpt-5.4-mini's first `create-or-replace-groups` call, before it reads the rules, sends an
empty `roots` array, or the units under another field (`articles`, `rootArticles`, `rootModules`) with `dockTo`.
The error asks for the payload format, the model fetches the rules and the second call loads — one
lost step.

**Cause.** The tool description names the roots as article picks and the relations, but not that
`roots` holds every unit of the group from the first call.

**To do.** One clause in the `create-or-replace-groups` description: a group is created with all its
units in one call — `roots` holds at least one article pick, each with its relation; there is no
empty group to fill later.

**Test.** `hi-mcp-server.test.ts` asserts the clause.

**Reproduce.** `mcp-test-2026-10-06_14-25-34`: gpt-5.4-mini 02.

## 47. A root id sent as the group id is refused

**Problem.** A command with a root id as `groupId` fails with "Group '…' not found. Groups in the plan:
…"; the model sends the call again with the group id.

**Cause.** `findGroup` (`tool-executors.ts`) looks the id up among group ids and their prefixes only.
A root id names its group unambiguously, so the intent is clear and the server can correct it
([Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort), step 3).

**To do.** `findGroup` reads a root id (or a unique prefix of one) as the group that holds it, and
the result says so in `corrections`.

**Test.** A tool-executors test: a command with a root id as `groupId` runs on that root's group and
reports the correction.

**Reproduce.** `mcp-test-2026-10-06_08-31-06`: gpt-5.4-mini 23.

## 38. A provider answer the AI SDK cannot process ends the turn without an answer

**Problem.** A turn can end after its last tool call with the error "Failed to process successful
response" from the chat's provider call: the stream carries the opening sentence and the `[error]`
line, and no summary. The plan holds what the tools changed.

**Cause.** Not identified — the error is the AI SDK's for a provider response it cannot parse; the
chat logs neither the response nor the step it belongs to.

**To do.** Log the failing step with the provider's status and body in the chat backend
(`onStepEnd` and the `error` part of the stream, `hi-mcp/hi-mcp-chat/chat-server.ts`), then decide
whether a retry of the step is safe (the tool calls of the step are already carried out).

**Test.** The chat handler test streams an `error` part and asserts the logged step.

**Reproduce.** `mcp-test-2026-10-07_09-46-08`: gpt-6-astra 24.

## 13. Undocked wall units reject the whole group

**Problem.** `create-or-replace-groups` with a group whose roots carry no relation and no docking —
floor units and wall units — fails as a whole: "Invalid pos groups - nothing was loaded: roots … are
not docked to a placed root". The floor units would be docked as a row (G7), but the wall units have
no wall-unit row to join. The refusal's example shows the `contextData` docking format, not the
relations the rules teach.

**Cause.** A group without any relation field goes the `contextData` path (D34).
`connectUnreachedRoots` (`tool-executors.ts`) docks an unreached part only to a reached root of its
own kind (`isWallUnit(root) === kind`); the first wall unit of a kitchen has none, so the group is
not built, although the intent is clear.

**To do.** Hang the first undocked wall unit on a free `*Top` of a reached floor unit, at the hang
height of D35 (`hangGapOf`), dock further wall units beside it as G7 does, and report it. The
refusal that remains for a part that cannot be connected shows the relations, not `contextData`.

**Test.** A group of floor units and two undocked wall units loads; the wall units hang above the
floor row, and the correction names them.

**Reproduce.** `mcp-test-2026-10-06_08-31-06`: gpt-5.4-mini 09 (first call).

## 50. Two units on one Top side vector take the same place

**Problem.** Two roots docked to one Top side vector of a root — `LeftTop` or `RightTop` — with the
same mode and offset stand in the same place, and nothing is reported. Two wall units `rightOf` one
tall unit both get the tall unit's `RightTop`; docking written as `contextData` can do the same.

**Cause.** The side correction (G8, D29) counts `LeftBottom` and `RightBottom` only (`SIDE_VECTORS`,
`sidePartnersOf`, `tool-executors.ts:1066-1135`), and the compile writes `RightTop → LeftTop` for
every wall unit `rightOf` a tall unit (`pairOf`, `group-layout.ts:539-551`).

**To do.** Count the Top side vectors in `sidePartnersOf` as sides of their own: the later of two
partners on one Top side vector at the same place goes to the free end of that wall-unit row,
reported as G8 does. A partner on the Top vector and one on the Bottom vector of the same side stay:
a wall unit and a base unit beside a tall unit are both legitimate.

**Test.** `t1` a tall unit, `w1 rightOf t1`, `w2 rightOf t1`: `w2` is docked to the `RightBottom` of
`w1`, with the correction; a wall unit and a base unit both beside `t1` load unchanged.

**Reproduce.** Not reproduced in a run; follows from the code above.

## 3. A docking ring anchors the wrong root

**Problem.** Docking written as `contextData` that closes a row into a ring (cab1 → cab2 → cab3 → cab4
along `RightBottom`, and cab4 on cab1's `LeftBottom`) makes the server anchor a root the planner does
not place first: the row stands through the side wall, without a correction. A unit docked to both
ends of a corner kitchen's legs closes the same kind of ring.

**Cause.** `findAnchorRoot` (`group-placement.ts`) walks left through `dockingRelations`, whose maps
keep one partner per root (the last entry wins), and on a ring stops wherever it meets a visited
root. The planner arranges breadth-first from the first root, so the first entry that reaches a root
places it. Server and planner disagree.

**To do.** Break a ring in `completeDocking` (`tool-executors.ts`): in the planner's order
(breadth-first from the first root), the side entry that reaches an already reached root is dropped
and reported ("the docking of 'cab4' on the LeftBottom of 'cab1' closes a ring - dropped").

**Test.** The ring of four loads as one row with the ring entry dropped; the anchor is the row's left
end (cab1); the correction is reported.

**Scope.** Docking written as `contextData` only: a relation that closes a ring is dropped and
reported (G33).

## 7. Docking to a vector the article does not have

**Problem.** Docking written as `contextData` that docks a unit to a vector the article does not have
(the sink `BackBottom → BackBottom` on a corner article, whose vectors are `Left/RightBack*`, `Left*`
and `Right*`) puts the unit at the corner's origin, inside the corner cabinet, without an error.

**Cause.** `create-or-replace-groups` does not check `ownDockingVector` or `dockingVector` against the
article's vectors. On an empty plan the catalog has none (backlog
[article template geometry](roomle-ui-article-template-geometry.md)); the anchor probe calculates the
anchor's docking vectors, but the server keeps only its frame.

**To do.** Check the vectors of an entry where they are known: the catalog's `dockingVectors`
(articles already in the plan) and the probe's `dockInfos` (anchors — keep the vector names alongside
the anchor frame). A vector the article does not have is replaced by the nearest valid one if the
intent is clear; `BackBottom` on a corner article means behind it, and a corner article has no
behind, so the entry is dropped, the root is docked like an undocked root (G7), and both are
reported.

**Test.** The shape above with the corner's vectors known: the sink entry is dropped and reported,
and the sink is docked to a free row end, not inside the corner.

**Scope.** Docking written as `contextData` only: with relations the server picks the vectors, and
`behind` a corner article is ignored and reported (G36).

## 14. A floor unit is docked onto a top vector

**Problem.** Docking written as `contextData` that docks a floor unit on a `*Top` vector of another
floor unit (a sink base unit on a base unit's `LeftTop` with `offset [0, 660, 0]`) makes it hang in
the air above that unit.

**Cause.** The server uses the catalog category only for undocked roots (G7). A docking entry that
puts a floor unit (category not "Wall Units") on a `*Top` vector passes unchanged.

**To do.** Decide the exceptions first (a top unit on a tall unit, an article whose category is
unknown). Then a floor unit docked on a `*Top` vector of another floor unit is docked to the free end
of that row instead, and the correction says so.

**Test.** A sink base unit on a base unit's `LeftTop` is docked beside it, with the correction.

**Scope.** Docking written as `contextData` only: with relations a floor unit `above` a unit is put
`rightOf` it (G34).

## 15. A G7 correction docks a part by a wall unit at floor level

**Problem.** When the first root of a group written as `contextData` is not connected to the rest, G7
docks the unconnected part to the free end of the first root's row, but it may pick a wall unit of
the part as the lead: the wall unit then stands at floor level, and the rest of the part hangs off
it.

**Cause.** `connectUnreachedRoots` (`tool-executors.ts`) takes `kind = isWallUnit(partRoots[0])` and
filters the target by that kind, but the lead is `partRoots.find(…)`, any root of the part with a
free side vector, whatever its kind.

**To do.** Filter the lead by the same kind as the target: a floor part is docked by a floor unit, a
wall-unit part by a wall unit. If the part has no lead of its kind with a free side vector, it is not
built (G7, second row), with the docking entry to send.

**Test.** A group whose first root stands alone and whose other roots form a floor row with a wall
unit as the first root of the part with a free `LeftBottom`: the part is docked by its floor unit,
and the wall unit stays on its carrier.

**Scope.** Docking written as `contextData` only: a root without a relation continues the row of its
kind in list order (G31), so G7 does not run for relations.
