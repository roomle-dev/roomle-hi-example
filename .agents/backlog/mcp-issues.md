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
| 98 | [A row with a worktop placed into a corner stands 10 mm off the wall](#98-a-row-with-a-worktop-placed-into-a-corner-stands-10-mm-off-the-wall) | defect (not analysed) | roomle-ui `hi-wall-placement.ts` or the library's worktop (not analysed) | low | gpt-6-astra | |
| 103 | [A unit on top of a follower in another group stays behind when the row below moves](#103-a-unit-on-top-of-a-follower-in-another-group-stays-behind-when-the-row-below-moves) | defect | roomle-ui `groupsFollowingTheirCarriers` (`hi-root-module-arrangement.ts`) | low | | |
| 104 | [A unit of another group keeps its height when its carrier changes height](#104-a-unit-of-another-group-keeps-its-height-when-its-carrier-changes-height) | defect | roomle-ui `groupsFollowingTheirCarriers` (`hi-root-module-arrangement.ts`) | low | | |
| 107 | [A discarded exchange names the root module id of the unit it would have put in](#107-a-discarded-exchange-names-the-root-module-id-of-the-unit-it-would-have-put-in) | defect | roomle-ui `_stagedFailures`, `newLibraryFailures` (`hi-tools.ts`, `hi-tool-payload.ts`) | low | | |
| 108 | [The glue logic holds implementation of the Planning Assistant](#108-the-glue-logic-holds-implementation-of-the-planning-assistant) | refactoring | roomle-ui HI tools (`hi-tools.ts`, `hi-tool-*.ts`); `glue-logic.ts` keeps the API functions | medium | | |

`run.json` and `planner-calls.json` of the run directories named under **Reproduce** hold the payload
the model sent; the directories are under `.temp/result/`. The root `logMessages` in `plan.xml`'s
`externalConfiguration` retain library calculation diagnostics that compact plan contexts omit.

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

## 107. A discarded exchange names the root module id of the unit it would have put in

**Problem.** When the library cannot calculate the unit an `exchange-root-module` puts in, the tools
discard the change before the load (D106) and the error names the new root module by the id the
staged copy gave it. That id is never in the plan: the agent sent the id of the unit it wanted to
exchange and reads another one it cannot find. A discarded `merge-article-into-group` and
`insert-article-into-group` name their new unit the same way.

**Cause.** `newLibraryFailures` (roomle-ui `hi-tool-payload.ts`) names a root module by its id after
the calculation, and the staged change builds the new unit with a fresh id (`_expandArticlePick`,
`_stagedFailures`, `hi-tools.ts`). Only a create maps the plan's ids back to the call
(`groupLabels`, the groups as `posGroups[i]`); no row edit maps a new root module to the root module
it replaces or to the article it adds.

**To do.** roomle-ui: the staged verdict of `exchange-root-module` names its new root module by the
`rootModuleId` of the call; `insert-article-into-group` and `merge-article-into-group` name it as the
new unit with its article.

**Test.** roomle-ui `__tests__/hi-tools-test.ts`: a discarded exchange names the new root module by
the `rootModuleId` of the call; a discarded merge names the new unit with its article.

**Reproduce.** In the example page with a planner that discards a change before the load (roomle-ui
`feat/hi-mcp`, `--dev`), model-free: create two `OTB60` side by side, then `exchange-root-module` of
the second with `OTB60` and the attributes `mod_Width` 900 and `mod_DoorDirectionSelection` `Left`;
the error names a root module id the plan does not hold.

## 108. The glue logic holds implementation of the Planning Assistant

**Problem.** `glue-logic.ts` implements manipulations that only the Planning Assistant makes. Its
methods below are reached only from the HI tools (`hi-tools.ts`, `hi-tool-commands.ts`), never from
the planner's UI. The glue logic serves the UI, the tools serve the Planning Assistant
([Hard Rule](../../AGENTS.md#hard-rule-the-planning-assistant-stays-out-of-the-glue-logic)); a
change for the Planning Assistant then has to touch the glue logic.

- The create and replace of a `posGroups` layout: `createOrReplacePosGroupsFromLayout` (`:865`) with
  `_isArticlePickRoot` (`:965`), `_applyRootAttributeOverrides` (`:978`), `overrideTargetsOf`
  (`:1009`), `prepareArticlePickRoots` (`:1032`), `inheritNeighbourAttributes` (`:1665`),
  `_keepSubModuleInputsOfKeptRoots` (`:1689`), `_inheritAttributesOfAddedRoots` (`:1745`) and the
  outcome per group (`LayoutGroupOutcome`). The planner's API reaches it through
  `createOrReplacePosDataFromArticleLayout(…, 'posGroups')` (`:743`, from `roomle-planner.ts:2512`).
- The article template of the anchor: `calculateArticleTemplate` (`:1105`) with its cache.
- The attributes of an exchange: `swapRootModuleWithAttributes` (`:2788`); the UI's
  `swapRootModule` (`:2779`) delegates to it.
- The staged loads of the discard (D106): `loadWithChangedAttributes` (`:2449`), `arrangeAndLoad`
  (`:2876`).
- The interior fittings: `getInteriorDesignOptions` (`:3031`), `editInterior` (`:3046`).

The lines are those of `glue-logic.ts` on roomle-ui `feat/hi-mcp`.

**Cause.** The tools grew on the glue logic's group map and calculation: what a tool needed was added
to `glue-logic.ts`.

**To do.** roomle-ui: confirm per method that only the tools reach it, then move its implementation
into the tools. `glue-logic.ts` keeps the API functions the planner exposes —
`createOrReplacePosDataFromArticleLayout` and the UI's `swapRootModule` —, which delegate to the
implementation in the tools; the UI's behaviour is unchanged. Update the package layout in roomle-ui
`.agents/homag-intelligence.md`.

**Test.** roomle-ui `__tests__/glue-logic-test.ts`, `__tests__/hi-tools-test.ts` and
`__tests__/hi-tool-commands/` pass; the tests of a moved method move with it.

**Reproduce.** `grep` the moved methods in roomle-ui `packages/`: outside `glue-logic.ts`, only
`hi-tools.ts` and `hi-tool-commands.ts` call them.
