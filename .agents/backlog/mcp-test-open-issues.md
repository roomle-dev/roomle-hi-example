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
| 45 | ["The middle unit" read from the docking](#45-the-middle-unit-read-from-the-docking) | plan context | medium — the wrong unit edited |
| 46 | [A new group beside an existing one for "add a cabinet to the right of the kitchen"](#46-a-new-group-beside-an-existing-one-for-add-a-cabinet-to-the-right-of-the-kitchen) | instructions | medium — a separate group |
| 48 | [A worktop colour sent as `mod_PaneltopColor`](#48-a-worktop-colour-sent-as-mod_paneltopcolor) | `find-attributes` | medium — the worktop keeps its default |
| 52 | [A group material overwrites a unit's own value](#52-a-group-material-overwrites-a-units-own-value) | bug, MCP server | medium — accents lost, the agent repairs them |
| 36 | [A wall-unit row runs into a unit hung above a base unit](#36-a-wall-unit-row-runs-into-a-unit-hung-above-a-base-unit) | MCP server correction | medium — two wall units in one place |
| 42 | [A wall unit that keeps its place overlaps the unit that moved in below it](#42-a-wall-unit-that-keeps-its-place-overlaps-the-unit-that-moved-in-below-it) | roomle-ui command, MCP server feedback | medium — two units above in one place |
| 53 | [`place-group` reports an overlap with a group inside an L-shaped group](#53-place-group-reports-an-overlap-with-a-group-inside-an-l-shaped-group) | bug, MCP server | medium — a wrong note, or a group moved away |
| 54 | [A group centred on a wall stands off the centre when the group materials are set](#54-a-group-centred-on-a-wall-stands-off-the-centre-when-the-group-materials-are-set) | bug, MCP server placement | medium — the group 100 to 200 mm off the centre |
| 55 | [A 450 mm dishwasher takes a 600 mm slot in the row](#55-a-450-mm-dishwasher-takes-a-600-mm-slot-in-the-row) | bug, planner or library | medium — the range hood off the hob |
| 57 | [A program sent after its colour resets the colour](#57-a-program-sent-after-its-colour-resets-the-colour) | MCP server correction | medium — a wrong material until the agent repairs it |
| 41 | [A row edit puts a unit in front of a door without a hint](#41-a-row-edit-puts-a-unit-in-front-of-a-door-without-a-hint) | MCP server feedback | low — the unit stands inside the room |
| 37 | [A first call with a guessed payload](#37-a-first-call-with-a-guessed-payload) | instructions | low — one lost step |
| 47 | [A root id sent as the group id is refused](#47-a-root-id-sent-as-the-group-id-is-refused) | MCP server correction | low — one lost step |
| 38 | [A provider answer the AI SDK cannot process ends the turn without an answer](#38-a-provider-answer-the-ai-sdk-cannot-process-ends-the-turn-without-an-answer) | chat | low — rare |
| 56 | [A group material no module of the group carries](#56-a-group-material-no-module-of-the-group-carries) | instructions | low — a material not built, reported |
| 58 | [Several attributes of a group take one call each](#58-several-attributes-of-a-group-take-one-call-each) | tool API, speed | low — more planner commands and undo steps |
| 59 | [`undo` and a create answer with every group of the plan](#59-undo-and-a-create-answer-with-every-group-of-the-plan) | tool result, speed | low — context sent again in every later step |
| 13 | [Undocked wall units reject the whole group](#13-undocked-wall-units-reject-the-whole-group) | MCP server correction | low — a group without relations only |
| 50 | [Two units on one Top side vector take the same place](#50-two-units-on-one-top-side-vector-take-the-same-place) | MCP server correction | low — two units in one place |
| 3 | [A docking ring anchors the wrong root](#3-a-docking-ring-anchors-the-wrong-root) | bug, MCP server | low — docking written as `contextData` only |
| 7 | [Docking to a vector the article does not have](#7-docking-to-a-vector-the-article-does-not-have) | MCP server correction | low — docking written as `contextData` only |
| 14 | [A floor unit is docked onto a top vector](#14-a-floor-unit-is-docked-onto-a-top-vector) | MCP server correction | low — docking written as `contextData` only |
| 15 | [A G7 correction docks a part by a wall unit at floor level](#15-a-g7-correction-docks-a-part-by-a-wall-unit-at-floor-level) | bug, MCP server | low — docking written as `contextData` only |

`run.json` and `planner-calls.json` of the run directories named under **Reproduce** hold the payload
the model sent; the directories are under `.temp/result/`.

## 45. "The middle unit" read from the docking

**Problem.** For "replace the middle unit" gpt-5.4-mini exchanges the first unit of the row.

**Cause.** The `groups` section gives the roots no row position (D15: no root positions) and lists
them in creation order, not in row order — an inserted unit is listed last. The `obstacles` section
gives each root's outline (roomle-ui `shapeObstacles`, `hi-plan-context.ts:897`), but not its place in
the row: the model has to derive the order from the outlines or the docking entries.

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
and sets `mod_PaneltopColor` as a group-wide attribute; no module has it, the planner refuses it
(P3, reported), and the worktop keeps its default.

**Cause.** `find-attributes` reads "worktop" as "countertop" (D64), so "worktop colour" finds
`mod_CountertopColor`. A search for a colour alone lists the matches in master-data order, and
`mod_PaneltopColor` ("Color", group "Paneltop") comes first; nothing in the match says that the
panel top is not the worktop.

**To do.** Replay the `find-attributes` calls of the run below. Then order the matches of a colour
search so that the attributes of the kitchen articles come before the panel top, or name the
generated root module of each attribute (worktop `mr_Countertop`, panel top) in the match.

**Test.** A `find-attributes` test: "worktop colour" returns `mod_CountertopColor` first, and a
colour search names the worktop's attribute as the worktop's.

**Reproduce.** `mcp-test-2026-10-06_08-31-06`: gpt-5.4-mini 11.

## 52. A group material overwrites a unit's own value

**Problem.** When the agent sends a material for the group and another value of it on single roots —
an accent: dark wall units in a light kitchen, `Modern` fronts on two wall units of a `Classic`
kitchen — every unit ends with the group's value. `groupAttributes` names the attribute as set, and
the agent needs further calls to restore the accents.

**Cause.** `applyGroupWideAttributes` (`tool-executors.ts`) sends the group attributes after the
load of a create and of a replace as one `change-attributes` command without `rootModuleIds`, which
sets each attribute on every root and sub module of the group that carries it — over the roots' own
values from the load. D36 keeps a unit attribute on some roots per unit.

**To do.** Append each root's own value of a group attribute to the same `change-attributes`
command as an entry with its `rootModuleIds`, after the group's entry — the entries apply in their
order — and name those roots in `groupAttributes`.

**Test.** A tool-executors test: a group with `mod_FrontColor` 190 and two roots with
`mod_FrontColor` 326 — one `change-attributes` command whose last entry sets 326 on the two roots,
and `groupAttributes` names them.

**Reproduce.** `mcp-test-2026-10-07_11-58-22`: gpt-6-astra 29 (the niche wall units).
## 36. A wall-unit row runs into a unit hung above a base unit

**Problem.** `wall1 above base1`, `wall2 rightOf wall1`, `wall3 rightOf wall2` and `wall4 above
base3`: the row ends where `wall4` hangs, so two units share one place. The server's own correction
G44 (two units `above` one carrier: the second put `rightOf` the first) can move a unit into the
place of another unit above the next carrier the same way. Nothing reports it.

**Cause.** The compile separates two units `above` one carrier (G44, `group-layout.ts:499`), and
`completeDocking` then separates two roots on one side vector (G8, `separateSideVectorPartners`,
`tool-executors.ts:1415`); neither checks whether a row reaches a unit hung `above` another carrier
— the compile has the catalog, but does not use the widths.

**To do.** With the unit widths of the catalog (`mod_Width`), a unit `above` a floor unit whose place
the wall-unit row already covers goes `rightOf` the row's last unit, reported; G44 checks the place it
moves a unit to the same way.

**Test.** The shape above compiles `wall4` `rightOf` `wall3` with the correction.

**Reproduce.** `mcp-test-2026-10-07_07-20-49`: gpt-5.4-mini-low 11 (G44).

## 42. A wall unit that keeps its place overlaps the unit that moved in below it

**Problem.** `delete-article-and-compact` on the unit next to the corner of the Corner Kitchen: the hob
unit moves into the gap with its range hood (D42), and the wall unit above the removed unit keeps
its place, because the hob unit carries a unit above it already. The hood now hangs in the place of
that wall unit. The correction says that the wall unit keeps its place, not that it overlaps the
hood.

**Cause.** `removeArticleFromGroup` (roomle-ui `glue-logic.ts`) keeps a unit above the removed root
in place when the neighbour that moves into the gap carries a unit above it already. The server's
row hints (`withRowHints`, `tool-executors.ts`) compare whole groups, so an overlap of two units of
the same group is not seen.

**To do.** The correction names the unit above that the kept unit now overlaps, and says what the
agent can do: remove the kept unit with `delete-article-and-compact`, or move the units above. The
planner tests the kept unit's box against the boxes of the units above that moved
(`carriersOfUnitsAbove`, `hi-root-module-arrangement.ts`).

**Test.** Extend the glue-logic test `it('keeps a unit above in place when the neighbour carries one
already')` (roomle-ui `glue-logic-test.ts`), whose kept unit already overlaps the unit that moved in:
the correction names the overlapped unit; a remove whose kept unit overlaps nothing gives the
correction without it.

**Reproduce.** `mcp-test-2026-10-08_13-56-35`: gpt-6-astra 15.
## 53. `place-group` reports an overlap with a group inside an L-shaped group

**Problem.** In a plan with an L-shaped kitchen along two walls and an island in front of it,
`place-group` on the kitchen reports "Group … overlaps group … - there is no free position on the top
wall for it, so it stands where it was asked to", although no root module of the kitchen overlaps
the island. Had a free stretch existed, the server would have moved the kitchen along the wall away
from an island it never touched. A new group placed by wall (D23) takes the same test: placed against
such an L-shaped group, it is moved away from a group it does not touch.

**Cause.** `placedGroupVolumes` and `overlappedGroupIds` (`tool-executors.ts`) build one volume per
group from `groupFootprint` (`plan-space.ts`), the rectangle around all its root modules. The
rectangle of an L-shaped group covers the floor inside the L. `wallTarget` and
`freePlacementAlongWall` — for `place-group` and for a placement by wall in
`create-or-replace-groups` (`placeAtWalls`) — and the row edit hints of D43 (`rowReachHints`) use the
same volumes.

**To do.** Test overlaps per root module: one volume per root from `rootFootprintPoints`, two groups
overlap when a root of one overlaps a root of the other. Keep the group rectangle only as a quick
pre-test.

**Test.** A tool-executors test: an L-shaped group and a small group inside its L. `place-group` on
the L reports no overlap and does not move it, nor does a new group placed by wall beside the L; a
group that does overlap a root module still gets the note.

**Reproduce.** `mcp-test-2026-10-07_11-58-22`: gpt-6-astra 33 (turn 7).

## 54. A group centred on a wall stands off the centre when the group materials are set

**Problem.** A new group placed by wall with alignment `center`, whose group materials the server
sets after the load (D36), can stand 100 to 200 mm off the wall's centre. The server centres the
footprint it measures after the first load, and the group the materials leave behind is narrower or
wider: 3396 mm measured and 3010 mm built (193 mm off), 3619 mm measured and 3832 mm built (106 mm
off). A group without group materials stands centred to within 5 mm.

**Cause.** Not analysed. The placement by wall (D23) loads the group, computes the target from the
calculated group and reloads it; the group materials (D36) follow the reload. Which material changes
the extent — an end panel (`W60H`, `mod_Upright*`), a handle, a re-arrangement — is open.

**To do.** Find the attribute that changes the footprint between the measurement and the built
group; then measure after the group materials, or set them before the measurement, so that the
group is centred once.

**Test.** A unit test of the placement by wall with group attributes in `tool-executors.test.ts`:
the target uses the footprint the group has with its materials; the test `image-kitchen-left-wall`
of `docs/test-prompts.json` stands centred within 10 mm.

**Reproduce.** `mcp-test-2026-10-08_16-33-40`: gpt-6-astra 30 (3010 mm built, 193 mm off).

## 55. A 450 mm dishwasher takes a 600 mm slot in the row

**Problem.** `GSP` (dishwasher front) with `mod_Width` 450 is 450 mm wide in the order data, but in
the row it takes 600 mm: its outline spans 599 mm, and the next root module starts 600 mm after it.
A range hood the agent placed for a 450 mm dishwasher hangs 152 mm off the hob. Nothing reports it.

**Cause.** Not analysed: the library may build the 600 mm appliance niche whatever the front width,
or the docking vectors of `GSP` do not follow `mod_Width`.

**To do.** Compare the docking vectors and the geometry of `GSP` at `mod_Width` 450 and 600 in the
planner. Either the row follows the width, or the article catalog of the plan context says that
`GSP` takes 600 mm.

**Test.** A row with `GSP` at `mod_Width` 450: the next root module starts 450 mm after it, or the
catalog's `dimensions` of `GSP` name the fixed width.

**Reproduce.** `mcp-test-2026-10-08_13-56-35`: gpt-6-astra 34.

## 57. A program sent after its colour resets the colour

**Problem.** The agent sends the group attributes `mod_CountertopColor` 216 and then
`mod_CountertopProgram` Cube; the library resets the worktop colour to the program's 152 (Cloudy
blue). The correction says so (D59), and the agent spends two more steps to set the colour again.

**Cause.** `change-attributes` applies its entries in the order the agent sent them, each with the
library's conflict results, and a program resets a colour it does not offer. The rules ask for the
program first only for the fronts ("Choose it by its desc first, then the front colour").

**To do.** `applyGroupWideAttributes` sends the program attributes (`mod_*Program`) of the group
attributes before the others, so that a colour sent with its program survives; the rules need no
change.

**Test.** A tool-executors test: group attributes `[mod_CountertopColor, mod_CountertopProgram]` —
the `change-attributes` entries start with the program.

**Reproduce.** `mcp-test-2026-10-08_16-33-40`: gpt-6-astra 34.

## 41. A row edit puts a unit in front of a door without a hint

**Problem.** Inserting a drawer unit between the hob unit and the sink unit of the Corner Kitchen
grows the right leg from 3561 to 4161 mm. The tall unit at its end then stands from z −204 to 396,
in front of the door of that wall (z 280 to 1180). The result has no hint.

**Cause.** `rowReachHints` (`tool-executors.ts`, D43) tests the corners of the group's volume against
the room contour with `pointInsideRoom`. A door is a segment of that contour (`type` null at level 0),
so a row in front of it still stands inside the room.

**To do.** The D43 hint also names an opening the row now stands in front of and did not before: the
row's back edge along a wall overlaps an opening segment of that wall at the row's height (a door at
level 0, a window at the height of the units). The obstacle hint of D55 runs this test for new and
placed groups: `objectBlockers` (`tool-executors.ts`) turns each door and window into the strip in
front of it (`stripInFrontOfWall`, `plan-space.ts`), and `obstacleHint` names the root modules in it
with the free stretches of their wall; `withRowHints` can call it with the groups before the edit as
`before`. The row is built anyway; the user may want it so.

**Test.** A tool-executors test: a row along a wall with a door segment. An insert that makes the row
reach into the door's span gives the hint; a row that stood in front of the door before the edit
gives none.

**Reproduce.** `mcp-test-2026-10-08_13-56-35`: gpt-6-astra 16.
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
chat logs the error (`chat-server.ts:152`), but neither the provider's response nor the step it
belongs to.

**To do.** Log the failing step with the provider's status and body in the chat backend
(`onStepEnd` and the `error` part of the stream, `hi-mcp/hi-mcp-chat/chat-server.ts`), then decide
whether a retry of the step is safe (the tool calls of the step are already carried out).

**Test.** The stream-part loop of `chat-server.ts` has no test: the logging moves into a tested
module (e.g. `chat-steps.ts`), whose test feeds an `error` part and asserts the logged step.

**Reproduce.** `mcp-test-2026-10-07_11-58-22`: gpt-6-astra 29.
## 56. A group material no module of the group carries

**Problem.** The agent sends `mod_BacksplashColor` and `mod_BacksplashHeight` as group materials for
groups the library builds without a backsplash, and `mod_UprightColor` for a group without an end
panel. `groupAttributes` names them in `notCarried`, and the material the user asked
for — the dark backsplash of an image — is not built.

**Cause.** The `masterData` section lists the attributes of every generated root module (D48), the
backsplash included, and nothing tells the agent which generated root modules a group gets or when
the library generates a backsplash.

**To do.** Find in the library when it generates a backsplash (a group setting, an article). Then
say it in the served text, or let the server set the attribute that switches the backsplash on when
the agent sends a backsplash material.

**Test.** A unit test of the served text in `hi-mcp-server.test.ts`; the test
`image-kitchen-left-wall` of `docs/test-prompts.json`: the backsplash of the image is built, or the
answer says why not.

**Reproduce.** `mcp-test-2026-10-08_16-33-40`: gpt-6-astra 30 and 31.

## 58. Several attributes of a group take one call each

**Problem.** "Only handleless fronts and dark colours" on a kitchen and its island became ten
`change-group-attribute` calls in one step — five attributes on two groups. Each call is a planner
command with its own calculation, load and undo step, and its own result in the agent's context.

**Cause.** The tool API: `change-group-attribute` takes one `attributeId` and one `value`. The
planner's `change-attributes` sets a list in one calculation (D36, D62), but no tool offers the list
for an existing group.

**To do.** `change-group-attribute` takes `attributes: [{ attributeId, value }]` beside the single
attribute and sends them as one `change-attributes`; its description says so.

**Test.** A tool-executors test: three attributes on one group — one `change-attributes` command
with three entries; a served-text test for the description.

**Reproduce.** `mcp-test-2026-10-08_16-33-40`: gpt-6-astra 35 (turn 5).

## 59. `undo` and a create answer with every group of the plan

**Problem.** The result of `undo` and `redo`, and of `create-or-replace-groups`, carries every group
of the plan in the plan-context shape: one `undo` of an attribute change added 14.9k tokens to the
agent's context, a create of two groups 16.9k, and every later step of the turn sends them again.

**Cause.** The tool results: `undo` and `redo` return every group of the plan now, a create every
group in the plan (§6 of `docs/hi-mcp-behaviour.md`), whatever the call changed.

**To do.** Measure first whether the agent reads the plan context after these calls when they
return less. Then return the groups the call changed — a create the groups of the call, `undo` the
groups the reverted call changed — and the ids of the others.

**Test.** Tool-executors tests of the two results; the benchmark of the kitchen-from-image tests
(`.agents/benchmarks/`) for the steps and tokens.

**Reproduce.** `mcp-test-2026-10-08_16-33-40`: gpt-6-astra 31 (the create of step 4, the `undo` of
step 6).

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
`tool-executors.ts:1184`; `sidePartnersOf`, `:1214`), and the compile writes `RightTop → LeftTop` for
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

**Reproduce.** Not reproduced in a run; follows from the code above.

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

**Reproduce.** Not reproduced in a run; follows from the code above.

## 14. A floor unit is docked onto a top vector

**Problem.** Docking written as `contextData` that docks a floor unit on a `*Top` vector of another
floor unit (a sink base unit on a base unit's `LeftTop` with `offset [0, 660, 0]`) makes it hang in
the air above that unit.

**Cause.** The server reads the catalog for undocked roots (G7) and for corner articles (G8), but no
check looks at the vector a floor unit is docked to: an entry that puts a floor unit (category not
"Wall Units") on a `*Top` vector passes unchanged.

**To do.** Decide the exceptions first (a top unit on a tall unit, an article whose category is
unknown). Then a floor unit docked on a `*Top` vector of another floor unit is docked to the free end
of that row instead, and the correction says so.

**Test.** A sink base unit on a base unit's `LeftTop` is docked beside it, with the correction.

**Scope.** Docking written as `contextData` only: with relations a floor unit `above` a unit is put
`rightOf` it (G34).

**Reproduce.** Not reproduced in a run; follows from the code above.

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
kind in list order (G31), so G7 finds no unconnected root to dock.

**Reproduce.** Not reproduced in a run; follows from the code above.
