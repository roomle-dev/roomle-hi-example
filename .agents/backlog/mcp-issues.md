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
| 81 | [The corner-removal correction reports wall units as turned that stay on the back wall](#81-the-corner-removal-correction-reports-wall-units-as-turned-that-stay-on-the-back-wall) | bug | roomle-ui `hi-tools.ts` (`removeArticleFromGroup`, the corner correction), `hi-root-module-arrangement.ts` (`carriersOfUnitsAbove`); analysed in [corner-removal-reports-separate-wall-units-as-turned.md](../bug-analysis/corner-removal-reports-separate-wall-units-as-turned.md): the units above follow carriers of their own group only — the wall-unit groups of both legs must follow, the same cause as 89 | medium | gpt-6-astra | |
| 82 | [The model asks instead of building the group the user asked for on a wall of floor-to-ceiling windows](#82-the-model-asks-instead-of-building-the-group-the-user-asked-for-on-a-wall-of-floor-to-ceiling-windows) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:42`, the placement rule) | low | gpt-6-astra | |
| 83 | [Where no free stretch of the wall fits the group, it is placed over existing furniture and reported](#83-where-no-free-stretch-of-the-wall-fits-the-group-it-is-placed-over-existing-furniture-and-reported) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:42`, the placement rule) | low | gpt-6-astra | |
| 84 | [The find-attributes answer lists the values without naming the attribute](#84-the-find-attributes-answer-lists-the-values-without-naming-the-attribute) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:252-268`, the `find-attributes` description) | low | gpt-6-astra | |
| 85 | [insert-article-into-group takes a between-pair whose root modules do not stand side by side](#85-insert-article-into-group-takes-a-between-pair-whose-root-modules-do-not-stand-side-by-side) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:700-708,720`); roomle-ui `hi-tool-commands.ts` (the insert's result) | low | gpt-6-astra | |
| 86 | [A swapped row of different unit widths stands through the wall](#86-a-swapped-row-of-different-unit-widths-stands-through-the-wall) | bug | roomle-ui `hi-tools.ts:908` (`swapRootModules`) with `glue-logic.ts:2593` (`arrangeAndLoad`) and `hi-root-module-arrangement.ts:412` (`keepWallDistances`) | medium | gpt-6-astra | |
| 87 | [The model asks instead of building when the user's reference does not match the plan](#87-the-model-asks-instead-of-building-when-the-users-reference-does-not-match-the-plan) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:42`, the placement rule) | low | gpt-6-astra | |
| 89 | [Wall units in separate groups do not follow their edited carriers](#89-wall-units-in-separate-groups-do-not-follow-their-edited-carriers) | bug | roomle-ui `hi-tools.ts` (`insertArticleIntoGroup`, `swapRootModules`), `glue-logic.ts` (`arrangeAndLoad`), `hi-root-module-arrangement.ts` (`carriersOfUnitsAbove`, `moveUnitsAboveWithTheirCarriers`) | medium | gpt-6-astra | |
| 90 | [A group placed over existing objects is not disclosed](#90-a-group-placed-over-existing-objects-is-not-disclosed) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:42`, the placement rule) | low | gpt-6-astra | |
| 91 | [The answer describes the two legs of the L-shaped kitchen swapped](#91-the-answer-describes-the-two-legs-of-the-l-shaped-kitchen-swapped) | hardening | roomle-hi-example served text (the answer rules, `hi-mcp-server.ts:94-102`) | low | gpt-6-astra | |
| 92 | [The answer names a supply without its position](#92-the-answer-names-a-supply-without-its-position) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:42`, the placement rule) | low | gpt-6-astra | |

`run.json` and `planner-calls.json` of the run directories named under **Reproduce** hold the payload
the model sent; the directories are under `.temp/result/`. The root `logMessages` in `plan.xml`'s
`externalConfiguration` retain library calculation diagnostics that compact plan contexts omit.

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

**Reproduce.** `mcp-test-2026-10-20_06-45-46`, gpt-6-astra 32 (`edit-remove-corner-unit`, plan
snapshot `ps_scph5bhgqme6y1wp1fg90ya64sdvag5`, local roomle-ui :5173): the
`delete-article-and-compact` of the corner unit UERTB90 `814c6854-af4a-4370-807b-b1c0526dc1a0`
answers "the leg of '46ce47e7' (UTB60) with the units above it turned by 90°"; the legs form one
straight 4200 mm row along the right wall (x 4198..4815, z −3765..435) while the wall-unit group
`85510a7e` (wl1+wl2) stays on the back wall (x 2954..4154, z −3765..−3359) and the right-leg
wall-unit group `afbe92eb` also stays, so the hood is no longer above the hob.

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
the wardrobes over existing objects and reports the overlap (38: five 400 mm wardrobes over the low
object x 3506..4074, 568 × 570 mm). In the other tests on that wall it asks instead (12, 37, 39, 42)
— an answer the To do accepts. The obstacle test builds the group anyway and names what a root stands
on and the free stretches of its wall (D55).

**Cause.** The placement rule (`hi-mcp-server.ts:42`) says to choose a stretch of wall that obstacles
leaves free only "where the user leaves the place open"; when the user names a wall whose free
stretches are too short for the requested width, no served sentence says what to do, and the model
builds over the furniture and reports.

**To do.** roomle-hi-example served text (`hi-mcp-server.ts:42`): say what to do when the wall the
user names has no free stretch of the requested width — ask, or place where a stretch fits and say
so. Verify model acceptance.

**Test.** None in the suite: the wardrobe tests of the closets plan use its free right wall, so no
test names a wall without a free stretch of the requested width.

**Reproduce.** `mcp-test-2026-10-20_06-45-46`, gpt-6-astra 38 (`wardrobe-split-door-hinges`, local
roomle-ui :5173): five 400 mm single-door wardrobes (2000 mm) on the closets back wall over the low
object x 3506..4074 (568 × 570 mm), the answer discloses the overlap; the run passes — its expect
covers the door hinges only.

## 84. The find-attributes answer lists the values without naming the attribute

**Problem.** `find-attributes` returns the matching attributes with their values, and the model's
answer lists the values without naming the attribute id (18: the 21 front colours listed, the
attribute never named).

**Cause.** The `find-attributes` description (`hi-mcp-server.ts:252-268`) says what the tool returns
but not that the answer names the attribute id.

**To do.** roomle-hi-example served text: one sentence in the `find-attributes` description — the
answer names the attribute id with its values.

**Test.** `attributes-find-front-colour`: the answer names the attribute id with the front colours.

**Reproduce.** `mcp-test-2026-10-20_06-45-46`, gpt-6-astra 18 (`attributes-find-front-colour`,
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

**Test.** None in the suite: `edit-insert-below-wall-units` names two root modules that stand side
by side (the hob unit and the drawer unit next to the fridge). A test of the issue names two root
modules that are adjacent in the docking chain but do not stand side by side, and checks that the
result says so.

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
instead of creating the group the user asked for (53): the user asks for a base cabinet on the back
wall in front of the plug, the plan has no plug on the back wall (the plug is on the left wall), and
the model lists the supplies correctly, states there is no plug on the back wall, then asks whether
to place the cabinet in front of the back-wall object or in front of the left-wall plug — nothing is
created. The same class shows where the request needs a choice the served text leaves open (63,
turn 7): the user says "Add a pull-out larder unit", the model answers that the plan already has a
larder, that another would exceed its own 3.8 m limit, and asks whether to rework the run or use
another wall — "No changes made yet".

**Cause.** The placement rule (`hi-mcp-server.ts:42`) states when a placement is legitimate (D51)
but not that a group the user asks for is built where the user points; when the user's reference
names a supply that is elsewhere, no served sentence says to name where it is and build at the
nearest matching place, so the model reads the legitimacy as a permission it may decline and stops
to ask (the issue-82 class).

**To do.** roomle-hi-example served text (`hi-mcp-server.ts:42`): say that a group the user asks
for is built where the user points, and when the user's reference names a supply that is elsewhere,
the answer names where it is and builds at the nearest matching place — one sentence. Verify model
acceptance.

**Test.** `kitchen-conversation` turn 7: the model adds the pull-out larder unit. No other test of
the suite names a reference that does not match its plan.

**Reproduce.** `mcp-test-2026-10-20_06-45-46`, gpt-6-astra 53 (`installation-elements-supplies`,
plan snapshot `ps_scqns3qvwl3fuav4v8m0syqrzcmhuj`, local roomle-ui :5173): no planner call that
changes the plan — the model lists the plug (194 mm above the floor, 3635 mm from the back-left
corner) and the water connection (535 mm, 1615 mm), both on the left wall, states there is no plug
on the back wall, then asks "Should I place the base cabinet in front of that back-wall object, or
in front of the confirmed plug on the left wall? I haven't added the cabinet yet."

## 89. Wall units in separate groups do not follow their edited carriers

**Problem.** After an edit shifts or exchanges base-row carriers, the wall units in a separate group
do not follow them. After a `delete-article-and-compact` next to the corner moves the hob into the
gap, the separate hood group stays on the right leg while a same-group wall unit moves into the
hood's place, so a wall unit overlaps the hood (31). After a swap exchanges the hob and the sink
across the corner, the separate hood group stays on the right leg instead of following the hob, and
the back-wall wall-unit group stays in its old place instead of following the sink (33). A wall unit
can also be a root of the edited group: the saved main group `031ee57a` contains `OTB60` root
`5b754b36`. Separate groups are the failing case, not the shape of every wall-unit row.

**Cause.** The rules (`hi-mcp-server.ts:45`), insert description (`:710-711`) and swap description
(`:762`) promise that units above move with their carriers.
[D42](../../docs/hi-mcp-behaviour.md#3-decisions) explicitly finds carriers by position when a
reload loses the docking across a gap. The planner implements that position lookup only within
one group: `insertArticleIntoGroup` and `swapRootModules` (`hi-tools.ts:717,941` in roomle-ui)
pass the edited group's before/after state to `arrangeAndLoad` (`glue-logic.ts:2604`), which calls
`moveUnitsAboveWithTheirCarriers` (`glue-logic.ts:3256`); a `delete-article-and-compact` that moves
a carrier re-arranges the group the same way (31). Both `carriersOfUnitsAbove`
(`hi-root-module-arrangement.ts:144`) and its follower maps (`:219-242`) enumerate only that
group's roots. Units in the separate groups `85510a7e` and `afbe92eb` never enter the lookup.
This is a planner failure against D42, not a missing instruction to call `place-group`.

**To do.** roomle-ui: find the units above the edited carriers across the scene groups before the
edit, using their room-space positions, and apply their carrier's displacement and rotation after
the edit, including after a reload loses the docking link. Preserve the existing same-group
following and leave unrelated wall units in place; a separate wall row can span several carriers,
so moving its whole group blindly is not sufficient. Keep the served promise and D42 consistent
with the planner; do not prescribe an extra `place-group` for every base-row edit.

**Test.** `edit-remove-next-to-corner` and `edit-swap-hob-unit`: the hood and affected wall
units follow their original carriers without an extra placement call. Permanent planner tests
cover followers within the edited group and in separate groups, including a reloaded gap with no
docking link, a carrier turning across a corner, and unrelated wall units that stay in place.
Disclosure alone does not satisfy the movement promised by D42.

**Reproduce.** `mcp-test-2026-10-20_06-45-46`, gpt-6-astra 33 (`edit-swap-hob-unit`, local
roomle-ui :5173): `swap-root-modules` of the hob UKS2A60 `379fa7a9` and the sink SUT60 `31616143`
— the two units change places, but the separate hood group `afbe92eb` (OTB60 + DU) stays on the
right leg instead of following the hob to the back leg, and the back-wall wall-unit group `85510a7e`
stays in its old place instead of following the sink; the answer discloses that the hood was not
moved. The saved `plan-context.json` and `plan.xml` retain the group membership and resulting
positions.

## 90. A group placed over existing objects is not disclosed

**Problem.** `obstacle-island-free-spot` (52): the model places a new island of three US2A60 base
cabinets (1800 mm) away from the walls, opposite the kitchen (x 800..1417, z 4200..6000), over a
plant (x 869..1031, z 5220..5380) and a chair (x 851.76..1048.24, z 4331.05..4528.95); the answer
reports only the aisle ("It leaves approximately 1,214 mm of aisle facing the kitchen; existing
furniture remains unchanged") and never names the objects the island stands over.

**Cause.** The placement rule (`hi-mcp-server.ts:42`) says the answer says what the group stands in
front of (a door or a window) and that the result's hint names every root module that overlaps an
object, but no served sentence says the answer names the objects a group stands over — the model
reports the aisle and drops the hint's overlaps. Where the user leaves the place open, the rule says
to choose a spot that obstacles leave free; the model chose one they do not leave free and did not
disclose it.

**To do.** roomle-hi-example served text (`hi-mcp-server.ts:42` or the result-reading rule `:49`):
one sentence — the answer names every object and group a root module stands over, also where the
user leaves the place open. Verify model acceptance.

**Test.** `obstacle-island-free-spot`: the model places the island clear of the plant and the chair,
or the answer names them.

**Reproduce.** `mcp-test-2026-10-20_06-45-46`, gpt-6-astra 52 (`obstacle-island-free-spot`, local
roomle-ui :5173): one `create-or-replace-groups` with `placement.posGroup` [800, 0, 6000] and
`posRotationY` 90, three US2A60 roots `rightOf` each other; the plan context's obstacle outlines put
the plant and the chair under the island's roots; the answer discloses only the aisle.

## 91. The answer describes the two legs of the L-shaped kitchen swapped

**Problem.** `image-kitchen-back-right-corner` (60): the plan is right — the fridge HK260 and the hob
UKS2A60 with the hood on the right run, the sink SUT60, dishwasher GSP, pantry H2TB60 and the oven
HOTS2AB60 at working height on the back run — but the answer's bullet says "Fridge-freezer and hob
on the back run; sink, integrated dishwasher, pantry and raised oven on the right", swapping the two
legs.

**Cause.** No served sentence says the answer describes the plan as it stands, naming the wall each
group stands on (the plan context names the walls); the model paraphrases the two runs from memory
and swaps them.

**To do.** roomle-hi-example served text (the answer rules, `hi-mcp-server.ts:94-102`): one sentence
— the answer describes the plan as it stands, naming the wall of each group. Verify model acceptance.

**Test.** `image-kitchen-back-right-corner`: the answer's description names the two legs as the plan
has them.

**Reproduce.** `mcp-test-2026-10-20_06-45-46`, gpt-6-astra 60 (`image-kitchen-back-right-corner`,
plan snapshot `ps_scriq9ltecd67bb427i97vk6f2dbkbi`, local roomle-ui :5173): the final answer's
composition bullet swaps the two legs against the plan.

## 92. The answer names a supply without its position

**Problem.** The same class as 84: `sink-cabinet-at-water-connection` (54) — the model builds the
sink cabinet SUT60 and the support UTB60 (1220 mm) on the back wall covering the water connection
(x 3280, y −3725 against the back wall), but the answer says "near the existing water connection"
without its position, which the expect asks for.

**Cause.** The served text says the answer says what a group stands in front of and, per the to-do of
issue 87, names where a reference that does not match is — but no sentence says the answer names
where the user's reference is when it matches, so the model names the connection without its
position.

**To do.** roomle-hi-example served text (`hi-mcp-server.ts:42`, the placement rule): one sentence —
the answer names where the user's reference is. Verify model acceptance.

**Test.** `sink-cabinet-at-water-connection`: the answer names the water connection's position.

**Reproduce.** `mcp-test-2026-10-20_06-45-46`, gpt-6-astra 54 (`sink-cabinet-at-water-connection`,
local roomle-ui :5173): one `create-or-replace-groups`, the sink cabinet spanning x 2990..3590 over
the connection at x 3280; the answer names the connection without its position.
