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
| 104 | [A unit of another group keeps its height when its carrier changes height](#104-a-unit-of-another-group-keeps-its-height-when-its-carrier-changes-height) | defect | roomle-ui `groupsFollowingTheirCarriers` (`hi-root-module-arrangement.ts`) — [analysed](../bug-analysis/unit-of-other-group-keeps-height-when-carrier-changes-height.md): `moveOf` moves a unit of another group by its carrier's origin and rotation only, never by the change of its docking top, so an exchange or a delete that puts a carrier of another height under it leaves the unit at its height; the edited row keeps the clearance | low | | |
| 107 | [A discarded exchange names the root module id of the unit it would have put in](#107-a-discarded-exchange-names-the-root-module-id-of-the-unit-it-would-have-put-in) | defect | roomle-ui `_stagedFailures`, `newLibraryFailures` (`hi-tools.ts`, `hi-tool-payload.ts`) | low | | |
| 108 | [The glue logic holds implementation of the Planning Assistant](#108-the-glue-logic-holds-implementation-of-the-planning-assistant) | refactoring | roomle-ui HI tools (`hi-tools.ts`, `hi-tool-*.ts`); `glue-logic.ts` keeps the API functions | medium | | |

`run.json` and `planner-calls.json` of the run directories named under **Reproduce** hold the payload
the model sent; the directories are under `.temp/result/`. The root `logMessages` in `plan.xml`'s
`externalConfiguration` retain library calculation diagnostics that compact plan contexts omit.

## 104. A unit of another group keeps its height when its carrier changes height

**Problem.** A row edit puts a carrier of another height under a unit of another group: an
`exchange-root-module` for an article of another height, or a `delete-article-and-compact` whose
neighbour of another height moves into the gap. The unit keeps its height. It stands inside a taller
carrier or floats above a lower one, and a hanging wall unit loses or gains clearance. The same unit
in the edited row keeps its clearance to the docking top.

**Cause.** [Analysed](../bug-analysis/unit-of-other-group-keeps-height-when-carrier-changes-height.md).
`moveOf` in `groupsFollowingTheirCarriers` (roomle-ui `hi-root-module-arrangement.ts:417-432`) moves a
unit of another group by the change of its carrier's origin and rotation only; the carrier's docking
top never enters it. An exchange at the same origin gives no move, and `samePose` (`:470-471`) drops
the unit; a delete moves it along the floor only. Within the edited group,
`moveUnitsAboveWithTheirCarriers` moves a unit by the change of its carrier's docking top
(`:285-311`), D42's clearance rule.

**To do.** roomle-ui `feat/hi-mcp`, `hi-root-module-arrangement.ts`: `moveOf` adds to the move how
much higher the carrier's docking top stands above its origin than the reference's did, so the unit
and the units on top of it keep their clearance, as in the edited row. No change to `hi-tools.ts`,
`glue-logic.ts` or the hints.

**Test.** roomle-ui `hi-root-module-arrangement-test.ts`: a carrier whose docking top rises by 180 mm
or drops by 120 mm at the same origin moves a unit of another group and the unit on top of it by as
much; `hi-tools-test.ts`: an exchange for a taller article and a delete with a taller neighbour lift
the unit of another group onto the new docking top and return its group.

**Reproduce.** Model-free in the example page on bo-test (`release/bo-test` `1d9adf51e`), plan
`empty-room-with-water-connection`: `US2A60` `a` and `b` at the back wall, an `OTB60` in its own group
placed by point 1400 mm up above `b`, then `exchange-root-module` of `b` for `H2TB60`: the `OTB60`
stays at 1400–2120 mm, inside the tall unit (docking top 2200 mm). Script in
`.temp/result/repro-unit-keeps-height-2026-10-25/`.

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
