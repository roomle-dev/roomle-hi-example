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
| 107 | [A discarded exchange names the root module id of the unit it would have put in](#107-a-discarded-exchange-names-the-root-module-id-of-the-unit-it-would-have-put-in) | defect | roomle-ui `_stagedFailures`, `newLibraryFailures` (`hi-tools.ts`, `hi-tool-payload.ts`) — [analysed](../bug-analysis/discarded-exchange-names-staged-root-module-id.md): the verdict names the new unit of the staged copy by the id `_expandArticlePick` drew for it, because `_stagedFailures` passes no names for the units its change adds; a create names the root modules of a discarded new group the same way | low | | |
| 108 | [The glue logic holds implementation of the Planning Assistant](#108-the-glue-logic-holds-implementation-of-the-planning-assistant) | refactoring | roomle-ui HI tools (`hi-tools.ts`, `hi-tool-*.ts`); `glue-logic.ts` keeps the API functions | medium | | |

`run.json` and `planner-calls.json` of the run directories named under **Reproduce** hold the payload
the model sent; the directories are under `.temp/result/`. The root `logMessages` in `plan.xml`'s
`externalConfiguration` retain library calculation diagnostics that compact plan contexts omit.

## 107. A discarded exchange names the root module id of the unit it would have put in

**Problem.** When the library cannot calculate the unit an `exchange-root-module` puts in, the tools
discard the change before the load (D106) and the error names the new root module by the id the
staged copy gave it. That id is never in the plan: the agent sent the id of the unit it wanted to
exchange and reads another one it cannot find. A discarded `merge-article-into-group` and
`insert-article-into-group` name their new unit the same way.

**Cause.** [Analysed](../bug-analysis/discarded-exchange-names-staged-root-module-id.md).
`newLibraryFailures` (roomle-ui `hi-tool-payload.ts:351-352`, `rootModulesLabel` at `:244-252`) names a
root module by its id in the calculated copy, and the staged change builds the new unit with a fresh
id (`_expandArticlePick`, `hi-tools.ts:1445`). `_stagedFailures` (`:575-601`) knows the units its
change adds but passes no names for them; `newLibraryFailures` takes names for groups only
(`labels`). A create names its groups as `posGroups[i]`, but the root modules of a discarded new
group, and its group id in the message, are the calculation's ids as well (`_loadGroupLayout`,
`:522`).

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
