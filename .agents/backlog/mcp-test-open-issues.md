# Open issues of the MCP test

> **Type**: Backlog — what is to be done after the analyses of "test the mcp"
> **Domain**: hi-mcp — `create-or-replace-groups`, `merge-article-into-group`, the command tools
> (`hi-mcp/hi-mcp-server/tool-executors.ts`, `group-layout.ts`, `group-placement.ts`), the served
> rules (`hi-mcp-server.ts`), the chat (`hi-mcp/hi-mcp-chat`); two roomle-ui defects and one
> RoomleCore defect
> **Maintained by**: step 7 of [the testing skill](../skills/hi-mcp-testing.md#7-open-issues)
> **Analysis**: the causes verified on `master` and the fixes proposed per issue, with the live
> reproduction against the local planner, in
> [rml-18041-mcp-test-open-issues.md](../bug-analysis/rml-18041-mcp-test-open-issues.md) (RML-18041)

Each issue names the problem, the test prompt that shows it, the cause in the code, the to-do and
its test. An issue leaves this list when its fix is in the code. The guideline for every server
issue is [Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort): correct where the
intent is clear, report what was corrected, and never drop the agent's content silently.

## Overview

| # | Issue | Kind | Test prompt | Priority |
|---|---|---|---|---|
| 3 | [A docking ring anchors the wrong root](#3-a-docking-ring-anchors-the-wrong-root) | bug, MCP server | four cabinets on the back wall; oven, fridge, sink in the corner | low — docking written as `contextData` only |
| 7 | [Docking to a vector the article does not have](#7-docking-to-a-vector-the-article-does-not-have) | hardening | oven, fridge, sink in the corner | medium |
| 11 | [A merged group reaches into the back wall](#11-a-merged-group-reaches-into-the-back-wall) | bug, RoomleCore — [RML-18040](https://roomle.atlassian.net/browse/RML-18040) | join groups | — |
| 13 | [Undocked wall units reject the whole group](#13-undocked-wall-units-reject-the-whole-group) | hardening | full kitchen around the corner | low — docking written as `contextData` only |
| 14 | [A floor unit is docked onto a top vector](#14-a-floor-unit-is-docked-onto-a-top-vector) | hardening | image: kitchen on the left-hand wall | low — docking written as `contextData` only |
| 15 | [A G7 correction docks a part by a wall unit at floor level](#15-a-g7-correction-docks-a-part-by-a-wall-unit-at-floor-level) | bug, MCP server | image: kitchen in the back right corner | low — docking written as `contextData` only |
| 16 | [`change-module-attribute` fails with "checkAttributes.get is not a function"](#16-change-module-attribute-fails-with-checkattributesget-is-not-a-function) | bug, roomle-ui — [RML-18039](https://roomle.atlassian.net/browse/RML-18039) | image only, no text | critical — an attribute edit fails |
| 23 | [A worktop colour change drops hanging wall units onto the worktop](#23-a-worktop-colour-change-drops-hanging-wall-units-onto-the-worktop) | bug, roomle-ui | full kitchen around the corner | high — wall cabinets on the worktop |
| 27 | [A new group without a placement, moved with `place-group` right after](#27-a-new-group-without-a-placement-moved-with-place-group-right-after) | hardening | three tall units; four cabinets; image only | medium — a second call and a reload |
| 35 | [The handleless right corner unit as the first root with two legs stands 239 mm in the wall](#35-the-handleless-right-corner-unit-as-the-first-root-with-two-legs-stands-239-mm-in-the-wall) | bug, MCP server placement or planner | full kitchen around the corner | high — the kitchen stands in the wall |
| 36 | [A wall-unit row runs into a unit hung above a base unit](#36-a-wall-unit-row-runs-into-a-unit-hung-above-a-base-unit) | hardening | image: kitchen in the back right corner | medium — two wall units in one place |
| 37 | [A first call with an empty roots array](#37-a-first-call-with-an-empty-roots-array) | hardening, instructions | corner kitchens, image only | low — one lost step |
| 38 | [A provider answer the AI SDK cannot process ends the turn without an answer](#38-a-provider-answer-the-ai-sdk-cannot-process-ends-the-turn-without-an-answer) | hardening, chat | image only, no text | low — once in 54 runs |
| 39 | [A unit merged into a coloured kitchen keeps the default material](#39-a-unit-merged-into-a-coloured-kitchen-keeps-the-default-material) | hardening | image: planning on the right-hand wall | medium — a dark wall unit in a white kitchen |

What stays open, by priority:

- **Planner defects**: 23 (a worktop colour change drops hanging wall units, roomle-ui, needs its
  own ticket), 16 ([RML-18039](https://roomle.atlassian.net/browse/RML-18039), roomle-ui, fixed on
  a branch), 11 ([RML-18040](https://roomle.atlassian.net/browse/RML-18040), RoomleCore).
- **A decision**: 27 — D23, `placement { wall, alignment, offsetMm }` in `create-or-replace-groups`.
- **Found by the test run of 2026-10-04** (`mcp-test-2026-10-04_13-00-37`, the fixes of RML-18041): 35 (a
  corner kitchen in the wall), 36 and 37.
- **Found by the test run of 2026-10-05** (`mcp-test-2026-10-05_14-20-34`, the undo and redo tools of
  RML-18044, bo-test planner): 39.
- **Docking written as `contextData`**: 3, 7, 13, 14 and 15 do not occur with relations and stay
  for the `contextData` form the server still accepts.

## 3. A docking ring anchors the wrong root

**Problem.** The model docks cab1 → cab2 → cab3 → cab4 along `RightBottom` and also cab4 on cab1's
`LeftBottom`, which closes the row into a ring. The planner arranges cab4 left of cab1, but the
server anchors another root: the row stands through the side wall, without a correction. A unit
docked to both ends of a corner kitchen's legs closes the same kind of ring.

**Cause.**
- `findAnchorRoot` (`group-placement.ts`) walks left through `dockingRelations`, whose maps keep one
  partner per root (the last entry wins). On a ring it stops wherever it meets a visited root.
- The planner arranges breadth-first from the first root, so the first entry that reaches a root
  places it.
- Server and planner disagree, and the anchor is not the leftmost unit.

**To do.**
- Break a ring in `completeDocking` (`tool-executors.ts`). In the planner's order (breadth-first
  from the first root), the side entry that reaches an already reached root is dropped and reported:
  "the docking of 'cab4' on the LeftBottom of 'cab1' closes a ring - dropped".
- Then the anchor walk and the planner agree.

**Test.** The ring of four loads as one row with the ring entry dropped; the anchor is the row's
left end (cab1); the correction is reported.

**Scope.** Not with relations: one relation per unit cannot form a ring that the server does not
see, and a relation that closes one is dropped and reported (G33). Open for docking written as
`contextData`.

## 7. Docking to a vector the article does not have

**Problem.** The model docks the sink `BackBottom → BackBottom` to a corner article. A corner article
has no `BackBottom`; its vectors are `Left/RightBack*`, `Left*` and `Right*`. The planner puts the
sink at the corner's origin, inside the corner cabinet, without an error.

**Cause.** `create-or-replace-groups` does not check `ownDockingVector` or `dockingVector` against
the article's vectors. On an empty plan the catalog has none (backlog
[article template geometry](roomle-ui-article-template-geometry.md)). The anchor probe calculates
the anchor's docking vectors, but the server keeps only its frame.

**To do.**
- Check the vectors of an entry where they are known: the catalog's `dockingVectors` (articles
  already in the plan), and the probe's `dockInfos` (anchors — keep the vector names alongside the
  anchor frame).
- A vector the article does not have is replaced by the nearest valid one if the intent is clear.
  `BackBottom` on a corner article means behind it, and a corner article has no behind, so the entry
  is dropped, the root is docked like an undocked root (G7), and both are reported.

**Test.** The shape above with the corner's vectors known: the sink entry is dropped and reported,
and the sink is docked to a free row end, not inside the corner.

**Scope.** Not with relations: the server picks the vectors of the relation, and `behind` a corner
article is ignored and reported (G36). Open for docking written as `contextData`.

## 11. A merged group reaches into the back wall

**Problem.** After `delete-root-module` and `merge-groups`, the merged group's toe kick reaches
120 mm into the back wall: the group's footprint starts at x −120 before the unit in the corner.

**Cause and to-do.** Neither the HOMAG library nor the glue. The kernel traces the merged-in
unit's surroundings around the wall body, so the merge report's contour has a wall at the corner,
120 mm behind the units. The library ends the toe kick there, and the kernel's next `plan_changed`
moves the origin onto the toe kick
([analysis](../bug-analysis/merged-group-toe-kick-reaches-into-the-wall.md#result-2026-10-03)).
The fix is planned in RoomleCore (`ObjectSurroundings::findClosestOutlineIndices`, branch
`fix/merged-group-surroundings-RML-18040`, with a reproduction test):
[RML-18040](https://roomle.atlassian.net/browse/RML-18040). No MCP server change.

**Latest run** (`mcp-test-2026-10-02_12-45-24`): 16 — footprint 1920 mm for two units spanning 1800 mm.

**Latest run** (`mcp-test-2026-10-02_13-47-02`): gpt-5-mini 16 (1920 mm). Not in gpt-6-astra 16: the model moved the second
group next to the first with `place-group` before merging. The toe kick reaches into the wall only
when the merged units stand apart.

**Latest runs** (`mcp-test-2026-10-02_17-25-40`): gpt-5-mini 16, gpt-5.4-mini 16 (1920 mm). Not in gpt-6-astra 16, which closed the gap with `place-group` first.

**Latest run** (`mcp-test-2026-10-03_18-13-02`): mistral-large-latest 16 (1920 mm).

## 13. Undocked wall units reject the whole group

**Problem.** `create-or-replace-groups` with every unit undocked — floor units and two wall units —
fails with "Invalid pos groups - nothing was loaded: roots 'wall1', 'wall2' are not docked to a
placed root". The floor units would have been docked as a row (G7), but the wall units had no
wall-unit row to join. The model's retry kept the walnut fronts on one unit only (issue 6).

**Cause.** `connectUnreachedRoots` (`tool-executors.ts`) docks an unreached part only to a reached
root of its own kind (`isWallUnit(root) === kind`). The first wall unit of a kitchen has none, so
the group is not built ([Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort):
the intent is clear, and the server can correct it).

**To do.**
- Hang the first undocked wall unit on a free `*Top` of a reached floor unit, at the wall-unit
  height of issue 10. Dock further wall units beside it, as G7 does, and report it.
- This depends on the height decision of issue 10.

**Test.** A group of floor units and two undocked wall units loads. The wall units hang above the
floor row, and the correction names them.

**Latest run** (`mcp-test-2026-10-02_12-45-24`): 10.

**Latest run** (`mcp-test-2026-10-02_13-47-02`): gpt-5.4-mini 10.
- The first call was refused for the undocked `wallcab1`, `wallcab2`, `hood`.
- The second was refused for an empty group (`posGroups[1]: needs a non-empty roots array`) and two
  roots on one side vector the server could not move apart.
- The third call loaded, with walnut on one unit.

**Scope.** Not with relations: a wall unit without a relation hangs beside a tall unit or above a
floor unit (G31). Open for docking written as `contextData`.

## 14. A floor unit is docked onto a top vector

**Problem.** The model docked the sink base unit `SUT60` on `U2TB90.LeftTop` with
`offset [0, 660, 0]`. The sink base unit hangs in the air above a base unit.

**Cause.** The server uses the catalog category only for undocked roots (G7). A docking entry that
puts a floor unit (category not "Wall Units") on a `*Top` vector passes unchanged.

**To do.**
- A floor unit docked on a `*Top` vector of another floor unit is docked to the free end of that
  row instead, and the correction says so.
- Decide on the exceptions first (a top unit on a tall unit, an article whose category is unknown).

**Test.** A sink base unit on a base unit's `LeftTop` is docked beside it, with the correction.

**Latest run** (`mcp-test-2026-10-02_12-45-24`): 06.

**Scope.** Not with relations: a floor unit `above` a unit is put `rightOf` it (G34). Open for docking
written as `contextData`.

## 15. A G7 correction docks a part by a wall unit at floor level

**Problem.** The first root of a group is not connected to the rest. G7 docks the unconnected part to
the free end of the first root's row, but it may pick a wall unit of the part as the lead:
- in gpt-5.4-mini 07, `upperLeft`, an `OFKB90`, was docked to the fridge's `RightBottom`;
- the wall unit then stands at floor level, and the 24 other roots hang off it.

**Cause.** `connectUnreachedRoots` (`tool-executors.ts`) takes `kind = isWallUnit(partRoots[0])` and
filters the target by that kind. The lead is `partRoots.find(…)`, any root of the part with a free
side vector, whatever its kind.

**To do.**
- Filter the lead by the same kind as the target: a floor part is docked by a floor unit, a
  wall-unit part by a wall unit.
- If the part has no lead of its kind with a free side vector, it is not built (G7, second row),
  with the docking entry to send.

**Test.** A group whose first root stands alone and whose other roots form a floor row with a wall
unit as the first root of the part with a free `LeftBottom`: the part is docked by its floor unit,
and the wall unit stays on its carrier.

**Latest run** (`mcp-test-2026-10-02_13-47-02`): gpt-5.4-mini 07.

**Scope.** Not with relations: a root without a relation continues the row of its kind in list
order (G31), so G7 does not run for them. Open for docking written as `contextData`.

## 16. `change-module-attribute` fails with "checkAttributes.get is not a function"

**Problem.** `change-module-attribute` with `mod_HeightPosInsertion` 1420 on a root of a group the
model had created, changed and recreated in the same session fails in the page with "iframe:
checkAttributes.get is not a function" — a TypeError, not a validation message.

**Cause** (reproduced — [analysis](../bug-analysis/check-attributes-lost-after-a-discarded-calculation.md),
follow-up [RML-18039](https://roomle.atlassian.net/browse/RML-18039)). The trigger is a replace the
library cannot calculate: the glue discards it and restores the last calculated group from a JSON
copy. A module's `checkAttributes` is a `Map`
(`homag-intelligence/src/model/oc-scripts-domain.model.ts`). roomle-ui's `deepCopy` is
`JSON.parse(JSON.stringify(…))` (`common-core/src/utils/common-utils.ts`), so a copied or restored
group carries `checkAttributes` as a plain object. The glue logic copies groups in several places
(`_storeCalculatedGroup`, `_discardCalculation`, the article maps). The `.get` call is not in
roomle-ui's sources, so it is in the HOMAG library code that receives the module.

**To do.** roomle-ui: review and merge [roomle-ui#3074](https://github.com/roomle-dev/roomle-ui/pull/3074) — `structuredClone` instead of `deepCopy` in
`_storeCalculatedGroup`, `_addGroupToMap` and `_discardCalculation`, implemented and verified on the
branch `fix/hi-keep-check-attributes-on-discard-RML-18039` (2026-10-04 — see the analysis). The
entry leaves the backlog when the fix is merged and deployed.

**Test.** `glue-logic-test.ts`, `changeModuleAttribute`: "changes an attribute after the library
could not calculate the previous change" — the restored root keeps its `checkAttributes` `Map`, and
the next change succeeds.

**Latest run** (`mcp-test-2026-10-02_13-47-02`): gpt-6-astra 09 (the model recovered by deleting and rebuilding the groups).

## 23. A worktop colour change drops hanging wall units onto the worktop

**Problem.** Replaying gpt-5-mini 10: the wall units and the hood stand at y 1480 after the load and
after `change-group-attribute mod_FrontColor`, and at y 820 after `mod_CountertopColor`. A group of
one base unit and one wall unit keeps y 1480 after the same command, with the relation and with the
same docking written as `contextData`. gpt-6-astra 10 lost the wall units above the sink the same
way and deleted them.

**Cause.** Not found. The worktop regeneration of `mod_CountertopColor` is the likely trigger; the
planner stores the reciprocal of a docking entry without its offset
(`hi-root-module-arrangement.ts:684-692`).

**To do.** Reproduce in roomle-ui with the payload of gpt-5-mini 10 (`run.json`, second
`create-or-replace-groups`), find where the offset is lost, fix it there.

**Test.** A glue-logic test: a group with a wall unit hung by an offset keeps its height after a
worktop colour change.

**Latest run** (`mcp-test-2026-10-02_17-25-40`): gpt-5-mini 10, gpt-6-astra 10.

**Latest runs** (`mcp-test-2026-10-04_13-00-37`, local planner): gpt-5-mini 06, 09, 11; gpt-5.4-mini 11 —
the hood hung `above` a base or hob unit with offset `[0, 660, 0]` stands at y 820 after the
`change-group-attribute` commands the server now runs for the kitchen-wide materials (D36); the wall
units with the same offset keep 1480. Not deterministic: gpt-6-astra 07 kept the hood at 1480 through
eleven commands (the hood carried a `mod_HoodId` override). Since the server sets the materials
itself, every kitchen with a hood and a material shows it — the ticket for roomle-ui is urgent.

**Latest run** (`mcp-test-2026-10-05_14-20-34`, bo-test planner): gpt-5-mini 11 — an `OTB60` at y 820
on the worktop after the colour commands (`order-data.json`), the deployed planner shows it too.

## 27. A new group without a placement, moved with `place-group` right after

**Problem.** For a centred or offset row the model sent no placement and called `place-group`
(`alignment` center, `offsetMm`) right after; the reload exposes the group to issues 22 and 23.

**Cause.** The rules make a centred row a computation (example 4); `place-group` takes alignment and
offset. `placement { wall, alignment, offsetMm }` is deferred (D23).

**To do.** Decide D23: a placement by wall, alignment and offset in `create-or-replace-groups`.

**Test.** A centred row is placed in one call.

**Latest run** (`mcp-test-2026-10-02_17-25-40`): gpt-6-astra 01, 02, 09.

**Latest runs** (`mcp-test-2026-10-04_13-00-37`): gpt-6-astra 02 and 06 (create at the wall's end, then
`place-group … center`); gpt-5.4-mini 02, 09 and 10 placed a group with a point and a rotation that do
not belong together (the wall's `start` with the back wall's rotation, a corner point with another
wall's rotation) and gpt-5.4-mini 06 sent no placement at all — all three groups stand outside the
room or free in it. A placement by wall and alignment would make these lookups.

## 35. The handleless right corner unit as the first root with two legs stands 239 mm in the wall

**Problem.** `EUERTB90` (the handleless right-handed corner unit) as the first root, with units
`rightOf` and `leftOf` it, placed at the back right corner `[4815, 0, -3765]` / 270: the group stands
with its back 239 mm in the right wall (`order-data.json` group pos `[5054, 0, -3765]`, footprint x
2944–5054). The same article as the anchor with one leg (gpt-5.4-mini 04) and as the second root
(07), and the `UERTB90` with two legs (gpt-6-astra 07), stand inside the room.

**Cause.** Not analysed yet. The server sent the corner point with the anchor frame
`rootRelPos [261, 0, 0]`, `rootRelRotationY 0` (`planner-calls.json`); the planner arranged the corner
unit at `[261, 0, 239]` in group space, so the left leg's back line lies 239 mm behind the corner
unit's. Either the frame of the handleless right corner (`anchorFrameOfRoot`, `group-placement.ts`)
misses the article's back offset, or the planner's arrangement of the left leg does.

**To do.** Reproduce with the payload of gpt-5.4-mini 11 (`run.json`), compare the probe's
`dockInfos` of `EUERTB90` with those of `UERTB90`, and fix the frame or report the planner defect.

**Test.** The payload of gpt-5.4-mini 11 loads with the corner unit's back edges on both walls.

**Latest run** (`mcp-test-2026-10-04_13-00-37`): gpt-5.4-mini 11.

## 36. A wall-unit row runs into a unit hung above a base unit

**Problem.** `wall1 above base1`, `wall2 rightOf wall1`, `wall3 rightOf wall2` and `wall4 above
base3`: the row ends exactly where `wall4` hangs, so a 300 mm shelf and a 600 mm wall unit share the
place (`order-data.json`: both at z 2361). Nothing reports it.

**Cause.** The compile separates two units `above` one carrier (G44) and two roots on one side
vector (G8); a row that reaches a unit hung `above` another carrier is not checked — the server
knows no widths while compiling.

**To do.** With the unit widths of the catalog (`mod_Width`), a unit `above` a floor unit whose
place the wall-unit row already covers goes `rightOf` the row's last unit, reported.

**Test.** The shape above compiles `wall4` `rightOf` `wall3` with the correction.

**Latest run** (`mcp-test-2026-10-04_13-00-37`): gpt-5.4-mini 07.

**Latest run** (`mcp-test-2026-10-05_14-20-34`): gpt-5-mini 11 — the same collision made by G44 itself:
the hood and `w1` both `above` the hob unit, G44 moved `w1` `rightOf` the hood, into the place of
`w2` `above` the sink unit (two `OTB60` at z 1260 in `order-data.json`). The to-do covers it when
G44 checks the place it moves the unit to.

## 37. A first call with an empty roots array

**Problem.** gpt-5.4-mini sends `create-or-replace-groups` with `roots: []` first (an id, a placement,
attributes, no units), gets G1 ("needs a non-empty roots array … fetch the payload format with the
get-authoring-rules tool"), fetches the rules and sends the kitchen — one lost step per run.

**Cause.** The tool description names the roots as article picks but not as required before anything
else; the model seems to open the group first and add the units later.

**To do.** One clause in the `create-or-replace-groups` description: a group is created with all its
units in one call — `roots` holds at least one article pick; there is no empty group to fill later.

**Test.** `hi-mcp-server.test.ts` asserts the clause.

**Latest runs** (`mcp-test-2026-10-04_13-00-37`): gpt-5.4-mini 03, 04, 09.

## 38. A provider answer the AI SDK cannot process ends the turn without an answer

**Problem.** gpt-6-astra's turn ended after its last tool call with the error "Failed to process
successful response" from the chat's provider call: the stream carries the opening sentence, the
`[error]` line, and no summary (`run.json` `errors`, exit 1). The plan holds what the tools changed.

**Cause.** Not identified — the error is the AI SDK's for a provider response it cannot parse; the
chat logs neither the response nor the step it belonged to.

**To do.** Log the failing step with the provider's status and body in the chat backend
(`onStepEnd` and the `error` part of the stream, `hi-mcp/hi-mcp-chat/chat-server.ts`), then decide
whether a retry of the step is safe (the tool calls of the step are already carried out).

**Test.** The chat handler test streams an `error` part and asserts the logged step.

**Latest run** (`mcp-test-2026-10-04_13-00-37`): gpt-6-astra 09.

## 39. A unit merged into a coloured kitchen keeps the default material

**Problem.** gpt-5-mini 08 of 2026-10-05 created a white kitchen (`mod_FrontColor` 192 kitchen-wide,
set on every unit after the load and reported) and then added two `O2TB90` wall units with
`merge-article-into-group`: they hang at the wall-unit height but carry the default dark front. The
answer said nothing about it.

**Cause.** `merge-article-into-group` forwards only the `attributes` the agent sends
(`tool-executors.ts`, the executor of `merge-article-into-group`); the kitchen-wide attributes of
D36 are set by `create-or-replace-groups` after its load and are not part of the group, so a later
unit does not inherit them.

**To do.** Give the merged unit the value the group's article roots share for a material attribute
the new article carries (`mod_FrontColor`, `mod_CarcaseColor`, … — every root of the group with the
same value) when the agent sent none, and report it as a correction; an attribute the agent sent wins.

**Test.** A group whose roots all carry `mod_FrontColor` 192: `merge-article-into-group` without
attributes forwards `mod_FrontColor` 192 with the correction; with `mod_FrontColor` 160 sent, 160.

**Latest run** (`mcp-test-2026-10-05_14-20-34`): gpt-5-mini 08.
