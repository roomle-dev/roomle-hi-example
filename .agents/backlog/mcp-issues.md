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
[library-issues.md](library-issues.md). A calculation error of the library is an MCP issue here
when an invalid attribute value the tools sent caused it, and a library issue there otherwise
(D99 of [roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#3-decisions)). An issue leaves
this document when its fix is in the code.
The guideline for every server issue is
[Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort): wrong content an agent creates
is an instruction problem first; correct where the intent is clear, report what was corrected, and
never drop the agent's content silently.

## Overview

| # | Issue | Kind | Responsible | Priority | Model | Reasoning effort |
|---|---|---|---|---|---|---|
| 83 | [Where no free stretch of the wall fits the group, it is placed over existing furniture and reported](#83-where-no-free-stretch-of-the-wall-fits-the-group-it-is-placed-over-existing-furniture-and-reported) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:42`, the placement rule) | low | gpt-6-astra | |
| 85 | [insert-article-into-group takes a between-pair whose root modules do not stand side by side](#85-insert-article-into-group-takes-a-between-pair-whose-root-modules-do-not-stand-side-by-side) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:700-708,720`); roomle-ui `hi-tool-commands.ts` (the insert's result) | low | gpt-6-astra | |
| 90 | [A group placed over existing objects is not disclosed](#90-a-group-placed-over-existing-objects-is-not-disclosed) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:42`, the placement rule) | low | gpt-6-astra | |
| 91 | [The answer describes the two legs of the L-shaped kitchen swapped](#91-the-answer-describes-the-two-legs-of-the-l-shaped-kitchen-swapped) | hardening | roomle-hi-example served text (the answer rules, `hi-mcp-server.ts:94-102`) | low | gpt-6-astra | |
| 96 | ["One more shelf" adds the shelf set the cabinet already shows](#96-one-more-shelf-adds-the-shelf-set-the-cabinet-already-shows) | hardening | roomle-ui planner (`get-interior-design-options`, the plan context's fittings) or the library data (not analysed) | low | gpt-6-astra | |
| 97 | [Wall units docked beside the hood hang higher than the other wall units](#97-wall-units-docked-beside-the-hood-hang-higher-than-the-other-wall-units) | defect | roomle-ui served text (`hi-mcp-server.ts:28,30`, the `above` relation and the range hood rule) — [bug analysis](../bug-analysis/wall-units-beside-the-hood-hang-higher.md): the served rules give one leg the hood's clearance | low | gpt-6-astra | |
| 98 | [A row with a worktop placed into a corner stands 10 mm off the wall](#98-a-row-with-a-worktop-placed-into-a-corner-stands-10-mm-off-the-wall) | defect (not analysed) | roomle-ui `hi-wall-placement.ts` or the library's worktop (not analysed) | low | gpt-6-astra | |
| 103 | [A unit on top of a follower in another group stays behind when the row below moves](#103-a-unit-on-top-of-a-follower-in-another-group-stays-behind-when-the-row-below-moves) | defect | roomle-ui `groupsFollowingTheirCarriers` (`hi-root-module-arrangement.ts`) | low | | |
| 104 | [A unit of another group keeps its height when its carrier changes height](#104-a-unit-of-another-group-keeps-its-height-when-its-carrier-changes-height) | defect | roomle-ui `groupsFollowingTheirCarriers` (`hi-root-module-arrangement.ts`) | low | | |

`run.json` and `planner-calls.json` of the run directories named under **Reproduce** hold the payload
the model sent; the directories are under `.temp/result/`. The root `logMessages` in `plan.xml`'s
`externalConfiguration` retain library calculation diagnostics that compact plan contexts omit.

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

## 96. "One more shelf" adds the shelf set the cabinet already shows

**Problem.** Asked for one more shelf in a tall cabinet without fittings (Furniture_Smith `HTB60`),
the model adds the adjustable-shelf set (`AdjShelves`) and answers that a shelf was added — but the
cabinet already renders the same four shelves, so nothing changes for the user (41: 12
`part_ShelfadjWood` in `plan.xml`, the same as the unedited cabinets of 08).

**Cause.** Not analysed. The plan context lists no fitting for a cabinet without fittings, though the
library renders its default adjustable shelves (`mod_RackAreaType` Adj), so the model cannot see
that the shelves are there; what `get-interior-design-options` returns for that cabinet is not
recorded in the runs, and the `AdjShelves` desc may not say that it is the cabinet's default set.

**To do.** Analyse what `get-interior-design-options` returns for the cabinet without fittings and
whether its result or the plan context can show the shelves the library renders (roomle-ui
planner); what the agent lacks about the article goes into the desc of the library data,
never into a served rule.

**Test.** `edit-add-subarticle-look-inside`: the opened middle cabinet shows one shelf more than in
`open-cabinet-look-inside`.

**Reproduce.** `mcp-test-2026-10-22_19-45-49`, gpt-6-astra 41 (`edit-add-subarticle-look-inside`,
bo-test `205cc9bc8`): `add-interior-fitting` of `AdjShelves` into the middle unit `a7271f1b`; `plan.xml` holds 12
`part_ShelfadjWood`, the same as the unedited kitchen of 08.

## 97. Wall units docked beside the hood hang higher than the other wall units

**Problem.** In a corner kitchen the wall units docked beside the range hood hang 150 mm higher than
the wall units of the other leg: `mod_HeightPosInsertion` 1570 against 1420, visible in the object
image. The model sent `gapMm` 750 for the first wall unit of the hood's leg and 600 for the other
leg; the tool built both as sent, so no correction names them.

**Cause.** The served rules ([bug analysis](../bug-analysis/wall-units-beside-the-hood-hang-higher.md)).
The range hood rule (roomle-ui `hi-mcp-server.ts:30`, "further wall units and the range hood continue
rightOf or leftOf each other") puts the hood into the wall-unit row, bottoms flush, so the hood's
clearance above the hob is the `gapMm` of the row's first wall unit; the model gives a hood 650 to
750 mm and lifts that leg with it. The `above` relation (`:28`) does not say that the wall units of a
group hang at one height, so each leg carries its own `gapMm`.

**To do.** roomle-ui `feat/hi-mcp` served text: the range hood hangs `above` the hob unit with its
own `gapMm`, the wall units beside it `above` their own floor units (`:30`); every wall unit of a
group hangs at one height, top flush with the tall units, one `gapMm` for all (`:28`). Verify model
acceptance.

**Test.** `full-kitchen-walnut-marble-corner`: the wall units of both legs hang at one height.

**Reproduce.** `mcp-test-2026-10-22_19-45-49`, gpt-6-astra 52 (`full-kitchen-walnut-marble-corner`,
bo-test `205cc9bc8`): roots `wallright` `OTB60` `above` `landing1` `gapMm` 750, `hood` `DU`
`rightOf` `wallright`, `wallend` `OTB60` `rightOf` `hood`, `wallprep` `O2TB90` `above` `prep`
`gapMm` 600; both OTB60 at 1570, the back-wall wall units at 1420.

## 98. A row with a worktop placed into a corner stands 10 mm off the wall

**Problem.** A base row with a worktop placed with `wall` right and `alignment` back stands 10 mm off
the back wall right after the create: group position z -3755, the back wall at -3765, and the
group's footprint runs from x 0 to 2110 for 2100 mm of carcasses, so neither a carcass nor the
worktop reaches the wall. No correction or hint names the shift. Rows without a worktop placed the
same way stand at the wall (two wardrobes at z -3765), and so does a corner kitchen whose corner
unit is the anchor.

**Cause.** Not analysed. The footprint of a row with a worktop placed by wall elsewhere starts at
x -10, the worktop's overhang beyond the first carcass (four base units centred on the back wall:
x -10 to 2410); in the corner row it starts at 0, and the 10 mm of the overhang lie at the front
end. Whether the placement into the corner (roomle-ui `hi-wall-placement.ts`) keeps room for an
overhang the library puts at the other end, or the library's worktop generation moves it, is open.

**To do.** roomle-ui: replay the create of the run (its `planner-calls.json`) against the local
planner, read the group position, the footprint and the worktop's overhangs after the load, and fix
the step that leaves the row off the wall.

**Test.** roomle-ui `hi-tool-commands` tests: a row with a worktop placed by wall into a corner
stands with its first carcass or its worktop at the wall; the random test 75 of
`mcp-test-2026-10-22_19-45-49` (`random-5-base-row-right-wall-corner`) as a fixed prompt test.

**Reproduce.** `mcp-test-2026-10-22_19-45-49`, gpt-6-astra 75 (`random-5-base-row-right-wall-corner`,
bo-test `205cc9bc8`): one `create-or-replace-groups` with `placement` `{ wall: right, alignment: back }`
of `U2TB90`, `US2A60`, `US2A60`; the group `f32075ff` at `[4815, 0, -3755]`, rotation 270, footprint
x 0 to 2110.

## 103. A unit on top of a follower in another group stays behind when the row below moves

**Problem.** A floor unit carries a wall unit of another group, and a unit stands on top of that wall
unit in the wall unit's group. A row edit that moves the floor unit moves the wall unit with it, but
the unit on top stays where it was and stands apart from the wall unit.

**Cause.** `groupsFollowingTheirCarriers` (roomle-ui `hi-root-module-arrangement.ts:396-457`) moves
only the units of other groups that a root of the edited group carries directly:
`carriersOfUnitsInOtherGroups` (`:364-378`) leaves out a unit carried by a unit of its own group.
`_moveUnitsOfOtherGroupsWithTheirCarriers` (`hi-tools.ts:1314-1348`) loads the follower group without
rearranging it, so its docking does not take the unit on top along. Within the edited group,
`moveUnitsAboveWithTheirCarriers` moves the units bottom-up through such a stack (`:241-250`).

**To do.** roomle-ui: move the units of the follower group that stand on a moved follower with it,
bottom-up, as `moveUnitsAboveWithTheirCarriers` does within the edited group.

**Test.** roomle-ui `hi-root-module-arrangement` tests: a floor unit moved by 600 mm takes a wall unit
of another group and the unit on top of that wall unit along.

**Reproduce.** No run yet: a floor unit in one group, a wall unit with a unit on top in another group
above it; `insert-article-into-group` before the floor unit.

## 104. A unit of another group keeps its height when its carrier changes height

**Problem.** A row edit puts a carrier of another height where the old one stood — a 900 mm base unit
in place of a 720 mm one. A unit of another group that stood on the old carrier keeps its height and
overlaps the new carrier by the difference.

**Cause.** `groupsFollowingTheirCarriers` (roomle-ui `hi-root-module-arrangement.ts:408-423`) moves a
unit by the change of its carrier's origin and rotation only. A carrier of another height at the same
origin gives no move, and the unchanged-pose check (`:445`) drops the unit. Within the edited group,
`moveUnitsAboveWithTheirCarriers` corrects a unit by the change of its carrier's docking top
(`:285-300`).

**To do.** roomle-ui: apply the change of the carrier's docking top to the units of other groups, as
`moveUnitsAboveWithTheirCarriers` does, before the unchanged-pose check.

**Test.** roomle-ui `hi-root-module-arrangement` tests: a 720 mm carrier exchanged for a 900 mm one
lifts a unit of another group on top of it by 180 mm.

**Reproduce.** No run yet: a unit of another group on top of a base unit; `exchange-root-module` of
the base unit for a taller article.
