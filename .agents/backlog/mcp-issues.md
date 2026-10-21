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
| 82 | [The model asks instead of building the group the user asked for on a wall of floor-to-ceiling windows](#82-the-model-asks-instead-of-building-the-group-the-user-asked-for-on-a-wall-of-floor-to-ceiling-windows) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:42`, the placement rule) | low | gpt-6-astra | |
| 83 | [Where no free stretch of the wall fits the group, it is placed over existing furniture and reported](#83-where-no-free-stretch-of-the-wall-fits-the-group-it-is-placed-over-existing-furniture-and-reported) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:42`, the placement rule) | low | gpt-6-astra | |
| 84 | [The find-attributes answer lists the values without naming the attribute](#84-the-find-attributes-answer-lists-the-values-without-naming-the-attribute) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:252-268`, the `find-attributes` description) | low | gpt-6-astra | |
| 85 | [insert-article-into-group takes a between-pair whose root modules do not stand side by side](#85-insert-article-into-group-takes-a-between-pair-whose-root-modules-do-not-stand-side-by-side) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:700-708,720`); roomle-ui `hi-tool-commands.ts` (the insert's result) | low | gpt-6-astra | |
| 86 | [A swapped row of different unit widths stands through the wall](#86-a-swapped-row-of-different-unit-widths-stands-through-the-wall) | bug | roomle-ui `glue-logic.ts` (`_runGroupCalculation`, the attribute loads without `applyGroupPosition`), `hi-root-module-arrangement.ts` (the footprint check of `keepWallDistances`); analysed in [repaired-root-module-moves-its-group.md](../bug-analysis/repaired-root-module-moves-its-group.md): not the swap — the load that recalculates the failed root leaves the position to the kernel, which keeps that root's center and moves the row 600 mm; the load must apply the group position while a footprint is incomplete | medium | gpt-6-astra | |
| 87 | [The smodel asks instead of building when the user's reference does not match the plan](#87-the-model-asks-instead-of-building-when-the-users-reference-does-not-match-the-plan) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:42`, the placement rule) | low | gpt-6-astra | |
| 89 | [Wall units in separate groups do not follow their edited carriers](#89-wall-units-in-separate-groups-do-not-follow-their-edited-carriers) | bug | roomle-ui `hi-tools.ts` (`insertArticleIntoGroup`, `swapRootModules`, `removeArticleFromGroup`), `hi-root-module-arrangement.ts` (`carriersOfUnitsInOtherGroups`, `groupsFollowingTheirCarriers`) | medium | gpt-6-astra | |
| 90 | [A group placed over existing objects is not disclosed](#90-a-group-placed-over-existing-objects-is-not-disclosed) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:42`, the placement rule) | low | gpt-6-astra | |
| 91 | [The answer describes the two legs of the L-shaped kitchen swapped](#91-the-answer-describes-the-two-legs-of-the-l-shaped-kitchen-swapped) | hardening | roomle-hi-example served text (the answer rules, `hi-mcp-server.ts:94-102`) | low | gpt-6-astra | |
| 92 | [The answer names a supply without its position](#92-the-answer-names-a-supply-without-its-position) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:42`, the placement rule) | low | gpt-6-astra | |

`run.json` and `planner-calls.json` of the run directories named under **Reproduce** hold the payload
the model sent; the directories are under `.temp/result/`. The root `logMessages` in `plan.xml`'s
`externalConfiguration` retain library calculation diagnostics that compact plan contexts omit.

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

**Problem.** After widening the last of three tall units to 900 mm (Error 14019), correcting its
door and swapping it with the first, the row's back end stands 600 mm through the back wall (32).
The row is contiguous and its doors are correct — only its place is wrong. The row moves on the
door correction, not on the swap.

**Cause.** Not the swap: the row is 600 mm in the wall before it. The agent's door correction lets
the library calculate the widened unit again (it had no docking vectors, D95). The glue logic keeps
the group transform but loads without `applyGroupPosition` (`loadWithChangedAttributes`,
`packages/web-sdk/packages/homag-intelligence/src/glue-logic.ts:2193-2205` in roomle-ui; the flag
`arrangementMovedGroup` is set only when the arrangement moved the group, `:2059-2062`). The kernel
then keeps a reference root in place, and for the root without docking vectors it keeps the root's
center (RoomleCore `configurable-object-position-update-operator.cpp:349,439`). The center moves
from the failed geometry to the calculated one, and the group moves with it. The swap afterwards
keeps the row where it is. Analysed in
[repaired-root-module-moves-its-group.md](../bug-analysis/repaired-root-module-moves-its-group.md).

**To do.** roomle-ui: the load after a calculation in which the group before or the calculated
group has a root without docking vectors applies the group position (`_runGroupCalculation`, a
shared footprint check with `keepWallDistances`).

**Test.** `edit-swap-units`: after the swap the row's back end stays at z −3765. roomle-ui
`glue-logic-test.ts`: an attribute change that fails a root and one that recalculates a failed root
both load with `applyGroupPosition`; one with complete footprints loads without it.

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

**Problem.** After an insert or a swap moves base-row carriers, the wall units in a separate group
do not follow them. After a swap exchanges the hob and the sink across the corner, the separate hood
group stays on the right leg instead of following the hob, and the back-wall wall-unit group stays in
its old place instead of following the sink (33). After a `delete-article-and-compact` next to the
corner moves the hob into the gap, the separate group of the hood and the wall unit above the removed
unit keeps its place and the correction names it, while the same-group wall unit `5b754b36` moves
into the hood's place, so a wall unit overlaps the hood (31).

**Cause.** The rules (`hi-mcp-server.ts:45`), insert description (`:710-711`) and swap description
(`:762`) promise that units above move with their carriers (D42). `delete-article-and-compact`
finds the units above in other groups by room position and moves each such group as a whole
(`removeArticleFromGroup` with `carriersOfUnitsInOtherGroups` and `groupsFollowingTheirCarriers`,
`hi-root-module-arrangement.ts` in roomle-ui); `insertArticleIntoGroup` and `swapRootModules`
(`hi-tools.ts`) pass only the edited group to `arrangeAndLoad`, so the units of other groups never
enter the lookup. A group whose units follow different carriers — in 31 the wall unit above the
removed unit keeps its place (D42: the hob carries the hood already) and the hood follows the hob —
keeps its place as a whole.

**To do.** roomle-ui: insert and swap move the groups of units above with their carriers as
`removeArticleFromGroup` does. For a group whose units follow different carriers, decide with the
user: move its units within the group, or split it. Keep the served promise and D42 consistent;
do not prescribe an extra `place-group` for every base-row edit.

**Test.** `edit-remove-next-to-corner`, `edit-swap-hob-unit` and `edit-insert-below-wall-units`: the
hood and the affected wall units follow their carriers without an extra placement call. Planner
tests for insert and swap with units above in separate groups, and for a group whose units follow
different carriers.

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
