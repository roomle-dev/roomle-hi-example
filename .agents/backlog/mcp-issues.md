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
(D99 of [`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md#3-decisions)). An issue leaves
this document when its fix is in the code.
The guideline for every server issue is
[Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort): wrong content an agent creates
is an instruction problem first; correct where the intent is clear, report what was corrected, and
never drop the agent's content silently.

## Overview

| # | Issue | Kind | Responsible | Priority | Model | Reasoning effort |
|---|---|---|---|---|---|---|
| 83 | [Where no free stretch of the wall fits the group, it is placed over existing furniture and reported](#83-where-no-free-stretch-of-the-wall-fits-the-group-it-is-placed-over-existing-furniture-and-reported) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:42`, the placement rule) | low | gpt-6-astra | |
| 84 | [The find-attributes answer lists the values without naming the attribute](#84-the-find-attributes-answer-lists-the-values-without-naming-the-attribute) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:252-268`, the `find-attributes` description) | low | gpt-6-astra | |
| 85 | [insert-article-into-group takes a between-pair whose root modules do not stand side by side](#85-insert-article-into-group-takes-a-between-pair-whose-root-modules-do-not-stand-side-by-side) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:700-708,720`); roomle-ui `hi-tool-commands.ts` (the insert's result) | low | gpt-6-astra | |
| 90 | [A group placed over existing objects is not disclosed](#90-a-group-placed-over-existing-objects-is-not-disclosed) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:42`, the placement rule) | low | gpt-6-astra | |
| 91 | [The answer describes the two legs of the L-shaped kitchen swapped](#91-the-answer-describes-the-two-legs-of-the-l-shaped-kitchen-swapped) | hardening | roomle-hi-example served text (the answer rules, `hi-mcp-server.ts:94-102`) | low | gpt-6-astra | |
| 96 | ["One more shelf" adds the shelf set the cabinet already shows](#96-one-more-shelf-adds-the-shelf-set-the-cabinet-already-shows) | hardening | roomle-ui embedding-lib (`get-interior-design-options`, the plan context's fittings) or the library data (not analysed) | low | gpt-6-astra | |
| 97 | [Wall units docked beside the hood hang higher than the other wall units](#97-wall-units-docked-beside-the-hood-hang-higher-than-the-other-wall-units) | defect (not analysed) | roomle-ui HI tool commands, the library or the planner (not analysed) | low | gpt-6-astra | |
| 98 | [A row placed into a corner stands 10 mm off the wall after later edits](#98-a-row-placed-into-a-corner-stands-10-mm-off-the-wall-after-later-edits) | defect (not analysed) | roomle-ui `hi-tool-commands.ts` (the resubmit by id or the merge, not analysed) | low | gpt-6-astra | |

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

## 84. The find-attributes answer lists the values without naming the attribute

**Problem.** `find-attributes` returns the matching attributes with their values, and the model's
answer lists the values without naming the attribute id (18: the 21 front colours listed, the
attribute never named).

**Cause.** The `find-attributes` description (`hi-mcp-server.ts:252-268`) says what the tool returns
but not that the answer names the attribute id.

**To do.** roomle-hi-example served text: one sentence in the `find-attributes` description — the
answer names the attribute id with its values.

**Test.** `attributes-find-front-colour`: the answer names the attribute id with the front colours.

**Reproduce.** `mcp-test-2026-10-21_12-49-36`, gpt-6-astra 18 (`attributes-find-front-colour`,
bo-test): the answer lists the 21 front colours in four style groups, never names the attribute id
(`mod_FrontColor`).

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
cabinet already renders the same four shelves, so nothing changes for the user (61: 12
`part_ShelfadjWood` in `plan.xml`, the same as the unedited cabinets of 59).

**Cause.** Not analysed. The plan context lists no fitting for a cabinet without fittings, though the
library renders its default adjustable shelves (`mod_RackAreaType` Adj), so the model cannot see
that the shelves are there; what `get-interior-design-options` returns for that cabinet is not
recorded in the runs, and the `AdjShelves` desc may not say that it is the cabinet's default set.

**To do.** Analyse what `get-interior-design-options` returns for the cabinet without fittings and
whether its result or the plan context can show the shelves the library renders (roomle-ui
embedding-lib); what the agent lacks about the article goes into the desc of the library data,
never into a served rule.

**Test.** `edit-add-subarticle-look-inside`: the opened middle cabinet shows one shelf more than in
`open-cabinet-look-inside`.

**Reproduce.** `mcp-test-2026-10-21_12-49-36`, gpt-6-astra 61 (`edit-add-subarticle-look-inside`,
bo-test): `add-interior-fitting` of `AdjShelves` into the middle unit `a7271f1b`; `plan.xml` holds 12
`part_ShelfadjWood`, the same as the unedited kitchen of 59.

## 97. Wall units docked beside the hood hang higher than the other wall units

**Problem.** In a corner kitchen the wall units docked beside the range hood hang 150 mm higher than
the wall units of the other leg: `mod_HeightPosInsertion` 1570 against 1420, visible in the object
image. The model sent no height, and no correction reports the change.

**Cause.** Not analysed. The model docked the hood `rightOf` a wall unit that stands `above` a base
unit, and the next wall unit `rightOf` the hood, instead of the hood `above` the hob; the hood and
both wall units of that row hang from 1570 mm, where the hood hangs from 1470 to 1620 mm in the
other runs, by the plinth. Whether the tool command (`relationsToDocking`, the height of a row above), the library (a
row docked to a hood takes the hood's insertion height) or the planner sets the 1570 is open.

**To do.** roomle-ui: replay the run's `create-or-replace-groups` (its `planner-calls.json`) against
the local planner, read `mod_HeightPosInsertion` of the three roots of the right-wall row after the
load and find which step sets it; then decide between the tool command, the served rule for hoods
and the library's desc.

**Test.** `full-kitchen-walnut-marble-corner`: the wall units of both legs hang at one height.

**Reproduce.** `mcp-test-2026-10-21_12-49-36`, gpt-6-astra 50 (`full-kitchen-walnut-marble-corner`,
bo-test): roots `wallRight` `OTB60` `above` `prepRight`, `hood` `DU` `rightOf` `wallRight`,
`wallLanding` `OTB60` `rightOf` `hood`; both OTB60 at 1570, the back-wall wall units at 1420.

## 98. A row placed into a corner stands 10 mm off the wall after later edits

**Problem.** A base row placed with `wall` right and `alignment` back stands 10 mm off the back wall
at the end of a three-turn conversation (group position z -3755, the back wall at -3765). No
correction or hint names the shift.

**Cause.** Not analysed. Turn 1 places the row, turn 2 resubmits the group by its id without
placement with three wall units, turn 3 merges a drawer unit at the front end. The runs record only
the plan after the last turn, so which call moves the row is unknown; a replace without placement
keeps the group's position (D46), and a merge keeps the earlier root modules in place (D82).

**To do.** roomle-ui: replay the three calls of the run (its `planner-calls.json`) against the local
planner, read the group position after each, and fix the call that moves the row.

**Test.** roomle-ui `hi-tool-commands` tests: a resubmit by id without placement and a merge at the
free end keep the first root module of a corner row at the wall.

**Reproduce.** `mcp-test-2026-10-21_12-49-36`, gpt-6-astra 74 (`random-4-base-row-wall-units-extend`,
bo-test): the final group `b4bdd14a` at `[4815, 0, -3755]`, rotation 270.
