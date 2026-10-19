# Open MCP issues

> **Type**: Backlog — defects and hardening in the MCP server, chat and planner
> **Domain**: hi-mcp — the served text (`hi-mcp/hi-mcp-server/hi-mcp-server.ts`), the forward of
> the plan-changing tools (`tool-executors.ts`), the chat (`hi-mcp/hi-mcp-chat`); roomle-ui — the HI
> tool commands (`hi-tool-commands.ts`, `hi-group-layout.ts`, `hi-group-placement.ts`,
> `hi-wall-placement.ts`, `hi-tool-hints.ts`) and the defects the runs show
> **Maintained by**: step 7 of [the testing skill](../skills/hi-mcp-testing.md#7-open-issues)

These are issues in the MCP server, chat or planner detected by the MCP prompt tests.

Each issue names the problem, its cause, the to-do, the test of the fix and how to reproduce it; the
overview names the module, team or repository responsible for the fix, and the model and the
reasoning effort of the run that reproduces it — empty where it is unknown; a model the chat sends
no effort for runs at its provider's default. Library data issues are tracked in
[library-issues.md](library-issues.md). An issue leaves this document when its fix is in the code.
The guideline for every server issue is
[Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort): wrong content an agent creates
is an instruction problem first; correct where the intent is clear, report what was corrected, and
never drop the agent's content silently.

## Overview

| # | Issue | Kind | Responsible | Priority | Model | Reasoning effort |
|---|---|---|---|---|---|---|
| 74 | [An island's back row of other widths lands off the front row](#74-an-islands-back-row-of-other-widths-lands-off-the-front-row) | hardening | roomle-hi-example `AUTHORING_RULES` (`hi-mcp-server.ts:30-34`): explain the endpoint and turned-row viewpoint. Conditional roomle-ui fallback: explicit end alignment through endpoint modes in `pairOf` (`hi-group-layout.ts:846-860`), with reciprocal modes when the entry changes owner. [Analysis and verification](../bug-analysis/islands-back-row-of-other-widths-lands-off-the-front-row.md) | low | gpt-6.1-sol | |
| 81 | [The corner-removal correction reports wall units as turned that stay on the back wall](#81-the-corner-removal-correction-reports-wall-units-as-turned-that-stay-on-the-back-wall) | bug | roomle-ui `hi-tool-commands.ts` (the corner-article correction), `hi-root-module-arrangement.ts` (`moveUnitsAboveWithTheirCarriers`) | medium | gpt-6-astra | |
| 82 | [The model asks instead of building the group the user asked for on a wall of floor-to-ceiling windows](#82-the-model-asks-instead-of-building-the-group-the-user-asked-for-on-a-wall-of-floor-to-ceiling-windows) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:42`, the placement rule) | low | gpt-6-astra | |
| 83 | [Where no free stretch of the wall fits the group, it is placed over existing furniture and reported](#83-where-no-free-stretch-of-the-wall-fits-the-group-it-is-placed-over-existing-furniture-and-reported) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:42`, the placement rule) | low | gpt-6-astra | |
| 84 | [The find-attributes answer lists the values without naming the attribute](#84-the-find-attributes-answer-lists-the-values-without-naming-the-attribute) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:252-268`, the `find-attributes` description) | low | gpt-6-astra | |
| 85 | [insert-article-into-group takes a between-pair whose root modules do not stand side by side](#85-insert-article-into-group-takes-a-between-pair-whose-root-modules-do-not-stand-side-by-side) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:700-708,720`); roomle-ui `hi-tool-commands.ts` (the insert's result) | low | gpt-6-astra | |
| 86 | [A swapped row of different unit widths stands through the wall](#86-a-swapped-row-of-different-unit-widths-stands-through-the-wall) | bug | roomle-ui `hi-tools.ts:908` (`swapRootModules`) with `glue-logic.ts:2593` (`arrangeAndLoad`) and `hi-root-module-arrangement.ts:412` (`keepWallDistances`) | medium | gpt-6-astra | |
| 87 | [The model asks instead of building when the user's reference does not match the plan](#87-the-model-asks-instead-of-building-when-the-users-reference-does-not-match-the-plan) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:42`, the placement rule) and the test (`docs/test-prompts.json`, the expect of `installation-elements-supplies`) | low | gpt-6-astra | |
| 88 | [The model conflates an oven and a hob into one cabinet](#88-the-model-conflates-an-oven-and-a-hob-into-one-cabinet) | hardening | roomle-hi-example served text (the kitchen skill, `hi-mcp/hi-mcp-server/skills/kitchen-planning/SKILL.md`) | low | gpt-6-astra | |
| 89 | [Wall units do not follow a base row an edit shifted under them](#89-wall-units-do-not-follow-a-base-row-an-edit-shifted-under-them) | hardening | roomle-hi-example served text (the rules or the edit tools' descriptions: wall units are separate groups an edit leaves behind, move them with `place-group`) | low | gpt-6-astra | |

`run.json` and `planner-calls.json` of the run directories named under **Reproduce** hold the payload
the model sent; the directories are under `.temp/result/`. The root `logMessages` in `plan.xml`'s
`externalConfiguration` retain library calculation diagnostics that compact plan contexts omit.

## 74. An island's back row of other widths lands off the front row

**Problem.** An island with a front row of 900, 600 and 900 mm units and a back row of four
600 mm units has a 300 mm step at both ends. The first rear unit is `behind` the last front unit,
and its row continues `rightOf`.

**Cause.** The served `behind` description (`hi-mcp-server.ts:34`) omits the aligned end and the
viewpoint of side relations in the turned row. `pairOf` (`hi-group-layout.ts:859-860`) emits the
back-vector pair with no mode and zero offset. Its reversed partner frame aligns the turned
cabinet to the target's left end; `rightOf` in the rear row runs towards the front row's left.
For this composition the local extents are front `[0,2400]`, back `[-300,2100]`. An omitted mode
is different from explicit `StartStart` for back vectors. `align` is parsed but ignored for
`behind`. See [the analysis](../bug-analysis/islands-back-row-of-other-widths-lands-off-the-front-row.md).

**To do.** Clarify `AUTHORING_RULES` (`hi-mcp-server.ts:30-34`): side relations use the named
neighbour's front; for equal-length flush rows, put the first rear unit behind the first front
unit and continue `leftOf`. Verify model acceptance. If needed, let `behind` name an end in
roomle-ui: retain the default, use `EndStart` for right alignment and mirror it to `StartEnd`
when the unit owns the entry (`hi-group-layout.ts:922-937`). Actual endpoints supply the
geometry without catalog-width offsets or orientation tracking. Update served-text tests and
references; roomle-ui work retains `fix/room-corners-at-openings` ancestry.

**Test.** `image-planning-right-wall`: the island's equal-length rows end flush at both ends.
Permanent geometry tests cover different unit widths and preserve deliberate steps; a fallback
also covers rotated targets, wider rear units and reciprocal mode ownership.

**Reproduce.** `mcp-test-2026-10-16_19-30-19`, gpt-6.1-sol 48 (`image-planning-right-wall`, the
second `create-or-replace-groups`, the island): `rear1` (`EUTB60`) `behind` `islandright`
(`EUS2A90`), `rear2` to `rear4` `rightOf`; back row z −3240 to −840 against front z −2940 to −540.

## 81. The corner-removal correction reports wall units as turned that stay on the back wall

**Problem.** `delete-article-and-compact` of a corner unit answers "the leg of '46ce47e7' (UTB60)
with the units above it turned by 90°", but the wall units that stood above the turned leg reload
in a separate group and stay on the back wall. The plan contradicts the reported correction.

**Cause.** The corner-article correction (`hi-tool-commands.ts`) reports the units above the turned
leg as turned. `moveUnitsAboveWithTheirCarriers`
(`packages/web-sdk/packages/homag-intelligence/src/hi-root-module-arrangement.ts` in roomle-ui)
only maps roots of the edited group; the wall units above the leg belong to a separate group, so
they are not turned with it.

**To do.** roomle-ui: turn the separate group's wall units with the leg, or make the correction
name only what turned and name the wall units that stayed. This is correction and feedback
accuracy, not a guard: nothing is refused, the agent's content is built.

**Test.** `edit-remove-corner-unit`: the turned leg's wall units turn with it, or the correction
names them as staying on the back wall.

**Reproduce.** `mcp-test-2026-10-19_19-42-59`, gpt-6-astra 29 (`edit-remove-corner-unit`, plan
snapshot `ps_sb65gx8cnnic18lb3gxenhqd3zsogq1`, local roomle-ui :5173): the
`delete-article-and-compact` of UERTB90 `814c6854-af4a-4370-807b-b1c0526dc1a0` answers the
correction quoted above; the final plan has the main group `031ee57a` as one straight row of
4200 mm along the right wall (x 4198..4815, z −3765..435) while the wall-unit group `85510a7e`
(wl1+wl2) stays on the back wall (x 2954..4154, z −3765..−3359, rotationY 0.03) and the
right-leg wall-unit group `afbe92eb` also stays, so the hood is no longer above the hob.

## 82. The model asks instead of building the group the user asked for on a wall of floor-to-ceiling windows

**Problem.** On a wall of floor-to-ceiling windows the model asks a clarifying question instead of
creating the group the user asked for (05), and where it builds, it discloses the placement as a
problem (64). The served rule says a group goes where the user puts it, also when a door or a window
is there (D51), and the obstacle test builds the group anyway and names what it stands in front of
(D55).

**Cause.** The placement rule (`hi-mcp-server.ts:42`) states that a placement in front of a window is
legitimate and that the answer says what the group stands in front of, but not that the group is
built when the user names the wall — a model reads the legitimacy as a permission it may decline and
stops to ask.

**To do.** roomle-hi-example served text (`hi-mcp-server.ts:42`): say that a group the user asks for
on a wall of windows is built and the answer names the windows — one sentence. Verify model
acceptance.

**Test.** `sideboard-living-room-front-wall`: the model creates the sideboard on the glazed front
wall and the answer names the windows.

**Reproduce.** `mcp-test-2026-10-19_07-42-07`, gpt-6-astra 05 (`sideboard-living-room-front-wall`):
no `create-or-replace-groups` call — the model asks whether to place the sideboard in front of the
glazing or against a solid wall; and 64 (`random-4-cabinet-undo-redo`): the model places a low
cabinet in front of floor-to-ceiling windows and discloses it. Local roomle-ui :5173.

## 83. Where no free stretch of the wall fits the group, it is placed over existing furniture and reported

**Problem.** On the closets back wall, where no free stretch fits the requested row, the model places
the wardrobes over existing objects and reports the overlap: four wardrobes over two objects (12),
five wardrobes over a low object by 568 × 570 mm (35); smaller overlaps are disclosed as well (34,
36, 39). The obstacle test builds the group anyway and names what a root stands on and the free
stretches of its wall (D55).

**Cause.** The placement rule (`hi-mcp-server.ts:42`) says to choose a stretch of wall that obstacles
leaves free only "where the user leaves the place open"; when the user names a wall whose free
stretches are too short for the requested width, no served sentence says what to do, and the model
builds over the furniture and reports.

**To do.** roomle-hi-example served text (`hi-mcp-server.ts:42`): say what to do when the wall the
user names has no free stretch of the requested width — ask, or place where a stretch fits and say
so. Verify model acceptance.

**Test.** `wardrobe-door-hinges`, `wardrobe-split-door-hinges`: the model asks or places in a free
stretch instead of overlapping the furniture.

**Reproduce.** `mcp-test-2026-10-19_19-42-59`, gpt-6-astra 12 (`wardrobe-door-hinges`, local
roomle-ui :5173): four wardrobes over two objects on the closets back wall (240 mm over the
1170 mm unit x −430..3050, 568 mm over the low cabinet x 3506..4074), the answer discloses the
overlap; the runs pass — their expects cover the door hinges only.

## 84. The find-attributes answer lists the values without naming the attribute

**Problem.** `find-attributes` returns the matching attributes with their values, and the model's
answer lists the values without naming the attribute id (18: the 21 front colours listed, the
attribute never named).

**Cause.** The `find-attributes` description (`hi-mcp-server.ts:252-268`) says what the tool returns
but not that the answer names the attribute id.

**To do.** roomle-hi-example served text: one sentence in the `find-attributes` description — the
answer names the attribute id with its values.

**Test.** `attributes-find-front-colour`: the answer names the attribute id with the front colours.

**Reproduce.** `mcp-test-2026-10-19_19-42-59`, gpt-6-astra 18 (`attributes-find-front-colour`,
local roomle-ui :5173): the answer lists the 21 front colours in a table, never names the
attribute id (`mod_FrontColor`).

## 85. insert-article-into-group takes a between-pair whose root modules do not stand side by side

**Problem.** `insert-article-into-group` inserts between two root modules that are adjacent in the
docking chain but do not stand side by side in space; the insert lands beside one of them (27: the
sink and a base unit on the back leg of the L-shape; the insert landed beside the sink).

**Cause.** The `insert-article-into-group` description (`hi-mcp-server.ts:700-708,720`) says "between
two root modules that stand side by side", but the payload's between-ids are not tested against the
geometry — chain adjacency is enough for the insert, and the result does not say that the named pair
does not stand side by side.

**To do.** roomle-ui `hi-tool-commands.ts` (the insert's result): when the two named root modules do
not stand side by side, the result says so and where the article landed — feedback, not a refusal
(Guards Are a Last Resort); alternatively one sentence in the served description says what side by
side means (two root modules that name each other's side docking vectors). Verify model acceptance.

**Test.** `edit-insert-below-wall-units`: the insert lands between the two root modules that stand
side by side, or the result says the named pair does not stand side by side. The test's premise is
stale: `docs/test-prompts.md` describes the corner kitchen with the sink on the right leg, the saved
plan of `corner-kitchen-wall-units` has it on the back leg (27).

**Reproduce.** `mcp-test-2026-10-19_07-42-07`, gpt-6-astra 27 (`edit-insert-below-wall-units`): the
model named the sink and a base unit (adjacent in the docking chain, not side by side in space); the
insert landed beside the sink. Local roomle-ui :5173.

## 86. A swapped row of different unit widths stands through the wall

**Problem.** `swap-root-modules` of two root modules of different widths in a row against a wall
moves the whole row behind its place: after widening the last of three tall units to 900 mm and
swapping it with the first, the row's back end stands 600 mm through the back wall (32). The row is
contiguous and its doors are correct — only its place is wrong.

**Cause.** `swapRootModules` (`packages/web-sdk/packages/homag-intelligence/src/hi-tools.ts:908` in
roomle-ui) exchanges the two roots' bottom-side docking links, article positions and rotations, then
re-arranges the group with `REARRANGED_ROW_LOAD` (`hi-tools.ts:65-72`, `applyGroupPosition: true` —
"the glue logic dictates the group position"). `keepWallDistances`
(`packages/web-sdk/packages/homag-intelligence/src/hi-root-module-arrangement.ts:412`) translates
the group so the arranged docking box's wall-facing side keeps its room position. With swapped roots
of different widths (600 ↔ 900 mm) the arranged box is offset 600 mm from the original's, so the
whole row translates 600 mm backwards through the wall. The doc of `arrangeAndLoad`
(`glue-logic.ts:2588-2592`) — "the side at a wall keeps its place" — and the doc of
`swapRootModules` (`hi-tools.ts:905-906`) — "the row keeps its length, and its side at a wall keeps
its place" — are both broken for this case. An equal-width swap keeps the row in place
(`edit-swap-hob-unit` passes).

**To do.** roomle-ui: keep the row's wall-side end in place when the swapped roots have different
widths — anchor the wall-side end of the arranged row, or clamp the translated group into the room.
This is a planner defect, not a guard: the agent's input is valid and the planner builds impossible
geometry.

**Test.** `edit-swap-units`: after the swap the row's back end stays at z −3765. A permanent
geometry test swaps different-width roots at a wall and asserts the wall-side end keeps its place.

**Reproduce.** `mcp-test-2026-10-19_10-57-22`, gpt-6-astra 32 (`edit-swap-units`, plan snapshot
`ps_s9yhi76jypo1d6qhe3tfpgsv80rfpj8`, local roomle-ui :5173): turn 1 `change-module-attribute`
`mod_Width` 900 on `8774cac2-8b83-405d-b88c-f0e5cd2452fb` (error 14019 diagnostic, the model
corrected the door to `LeftRight`), turn 2 `swap-root-modules` of
`0010443c-519a-437b-8fe5-364f13887ca4` and `8774cac2` — the final row runs z −4365..−2265 (group
`064a7d91` at pos [4815, 0, −4365]) against the back wall at z −3765.

## 87. The model asks instead of building when the user's reference does not match the plan

**Problem.** When the user's reference does not match the plan, the model asks a clarifying question
instead of creating the group the user asked for (50): the user asks for a base cabinet on the back
wall in front of the plug, the plan has no plug on the back wall (the plug is on the left wall), and
the model lists the supplies correctly, states there is no plug on the back wall, then asks whether
to place the cabinet in front of the left-wall plug or on the back wall — nothing is created. The
same class shows where the request needs a choice the served text leaves open (60, turn 7): the user
says "Add a pull-out larder unit", the model answers "Nothing added yet" and asks which wall has
full-height space.

**Cause.** The placement rule (`hi-mcp-server.ts:42`) states when a placement is legitimate (D51)
but not that a group the user asks for is built where the user points; when the user's reference
names a supply that is elsewhere, no served sentence says to name where it is and build at the
nearest matching place, so the model reads the legitimacy as a permission it may decline and stops
to ask (the issue-82 class). And the test adds a second cause: the expect of
`installation-elements-supplies` (`docs/test-prompts.json`) asks for "a base cabinet against the
back wall standing on the plug", but the plan it loads (`room-with-supplies`) has no plug on the
back wall — the model cannot meet the expect by building.

**To do.** roomle-hi-example served text (`hi-mcp-server.ts:42`): say that a group the user asks
for is built where the user points, and when the user's reference names a supply that is elsewhere,
the answer names where it is and builds at the nearest matching place — one sentence. And the test:
fix the expect of `installation-elements-supplies` to the plan it loads (the plug is on the left
wall), or load a plan with a plug on the back wall. Verify model acceptance.

**Test.** `installation-elements-supplies`: the model builds the base cabinet and the answer names
where the plug is; `kitchen-conversation` turn 7: the model adds the pull-out larder unit.

**Reproduce.** `mcp-test-2026-10-19_19-42-59`, gpt-6-astra 50 (`installation-elements-supplies`,
plan snapshot `ps_sb7ea5wes24sjuq3t9q6eptgjo8e4cu`, local roomle-ui :5173): no planner call that
changes the plan — the model asks "Should I place the base cabinet in front of the confirmed
left-wall plug, or on the back wall beneath that small object? I haven't added the cabinet yet."

## 88. The model conflates an oven and a hob into one cabinet

**Problem.** Where the user asks for an oven and a hob, the model sends the hob cabinet as an
"oven-and-hob" unit and claims the oven in its answer: no oven article is in the plan (44, 45, 46).
In the other kitchen runs the model used the oven article correctly (57, 58, 60, 61).

**Cause.** The kitchen skill (`hi-mcp/hi-mcp-server/skills/kitchen-planning/SKILL.md`) lists the
cooking zone as "hob, oven, heat-safe landing surfaces, and cookware" but never says that an oven
and a hob are two appliances planned with two articles; the model reads "oven, hob" as one unit,
picks the hob cabinet and stretches its answer over both.

**To do.** roomle-hi-example served text: one library-neutral sentence in the kitchen skill's
cooking zone — an oven and a hob are two appliances, plan an article for each the user names.
Verify model acceptance.

**Test.** `kitchen-oven-fridge-sink-corner`, `kitchen-oven-hood-sink-fridge-corner`,
`full-kitchen-walnut-marble-corner`: the plan has an oven article and a hob article, and the answer
does not claim one cabinet is both.

**Reproduce.** `mcp-test-2026-10-19_19-42-59`, gpt-6-astra 45
(`kitchen-oven-hood-sink-fridge-corner`, local roomle-ui :5173): the model sent the hob cabinet
UHS60 as the oven-and-hob unit; the answer says "Oven and hob: combined in the 600 mm UHS60
cabinet" and "All five requested items are included" — no oven article is in the plan.

## 89. Wall units do not follow a base row an edit shifted under them

**Problem.** When an edit shifts a base row under wall units, the wall-unit groups stay where they
are: after `swap-root-modules` exchanged the hob and the sink unit, the hood group stayed on the
right leg — no longer above the hob — and the wall unit above the sink stayed on the back wall; the
answer discloses both (30). After `insert-article-into-group` shifted the sink, the wall unit above
it did not move with it and the answer does not name it (27). Where the model moved the wall-unit
group itself with `place-group`, the alignment held (28).

**Cause.** Wall units are separate groups in the plan; the edit tools shift only the edited group,
and no served sentence says that an edit which shifts a base row under wall units leaves the wall
units behind — move them with `place-group`. The model has to know this to keep the hood above the
hob.

**To do.** roomle-hi-example served text: one sentence in the rules or the edit tools' descriptions
— wall units are separate groups, an edit that shifts the base row under them leaves them, move them
with `place-group`. Verify model acceptance.

**Test.** `edit-swap-hob-unit`, `edit-insert-below-wall-units`: the wall units above the shifted
row keep their alignment with it, or the answer names the wall units that stayed.

**Reproduce.** `mcp-test-2026-10-19_19-42-59`, gpt-6-astra 27 (`edit-insert-below-wall-units`,
local roomle-ui :5173): the insert shifted the sink and the dishwasher 600 mm along the back leg,
the wall unit above the sink (group `85510a7e`) did not move with it and the answer does not name
it.
