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
| 108 | [The glue logic holds implementation of the Planning Assistant](#108-the-glue-logic-holds-implementation-of-the-planning-assistant) | refactoring | roomle-ui HI tools (`hi-tools.ts`, `hi-tool-*.ts`); `glue-logic.ts` keeps the API functions — [analysed](../refactoring-analysis/glue-logic-holds-planning-assistant-code.md): the create, the article picks, the template, the interior fittings and the agent's part of the exchange move; `loadWithChangedAttributes` and `arrangeAndLoad` serve the UI too and stay; the UI's swap keeps an implementation of its own; four decisions open | medium | | |
| 111 | [A discarded new group of a create names its root modules by ids the call never sent](#111-a-discarded-new-group-of-a-create-names-its-root-modules-by-ids-the-call-never-sent) | defect | roomle-ui `_loadGroupLayout` (`hi-tools.ts`) | low | | |

`run.json` and `planner-calls.json` of the run directories named under **Reproduce** hold the payload
the model sent; the directories are under `.temp/result/`. The root `logMessages` in `plan.xml`'s
`externalConfiguration` retain library calculation diagnostics that compact plan contexts omit.

## 108. The glue logic holds implementation of the Planning Assistant

**Problem.** `glue-logic.ts` implements manipulations that only the Planning Assistant makes. Its
methods below are reached only from the HI tools (`hi-tools.ts`, `hi-tool-commands.ts`), never from
the planner's UI. The glue logic serves the UI, the tools serve the Planning Assistant
([Hard Rule](../../AGENTS.md#hard-rule-the-planning-assistant-stays-out-of-the-glue-logic)); a
change for the Planning Assistant then has to touch the glue logic.

- The create and replace of a `posGroups` layout: `createOrReplacePosGroupsFromLayout` (`:865`) with
  `_isArticlePickRoot` (`:965`), `_applyRootAttributeOverrides` (`:978`), `overrideTargetsOf`
  (`:1009`), `prepareArticlePickRoots` (`:1032`), `inheritNeighbourAttributes` (`:1665`),
  `_keepSubModuleInputsOfKeptRoots` (`:1689`), `_inheritAttributesOfAddedRoots` (`:1745`),
  `_replaceRootModuleIdsAndRemapDockedRoots` (`:1162`), `findPosArticleKey` (`:1252`) and the
  outcome per group (`LayoutGroupOutcome`). The planner's API reaches it through
  `createOrReplacePosDataFromArticleLayout(…, 'posGroups')` (`:743`, from `roomle-planner.ts:2512`).
- The article template of the anchor: `calculateArticleTemplate` (`:1105`) with its cache.
- The agent's part of the exchange: the sent attributes and the dropped dockings as the result of
  `swapRootModuleWithAttributes` (`:2788`), which is the UI's swap otherwise — the UI's
  `swapRootModule` (`:2779`) calls it without them.
- The interior fittings: `getInteriorDesignOptions` (`:3031`), `editInterior` (`:3046`).

`loadWithChangedAttributes` (`:2449`), `arrangeAndLoad` (`:2876`) and `groupBeforeChange` (`:2865`)
are steps of the UI's own attribute change and swap, which the tools share; they stay. The lines are
those of `glue-logic.ts` on roomle-ui `feat/hi-mcp` `80b1d3145`.

**Cause.** [Analysed](../refactoring-analysis/glue-logic-holds-planning-assistant-code.md). The tools
grew on the glue logic's group map and calculation: what a tool needed was added to
`glue-logic.ts`, and the agent's attributes and result were added to the UI's swap.

**To do.** roomle-ui: move the methods above into the tools (`hi-tools.ts`).
`createOrReplacePosDataFromArticleLayout` keeps its `nobila` branch and hands a `posGroups` layout to
the tools. The UI's `swapRootModule` keeps an implementation of its own, without the agent's
attributes and result; the tools' exchange runs the swap's steps itself. The steps of the glue logic
the moved code runs — the calculation, the initial checks, the arrangement, the group map, the host
notification — stay in the glue logic; the UI's behaviour is unchanged. The analysis lists four
open decisions. Update the package layout in roomle-ui `.agents/homag-intelligence.md`.

**Test.** roomle-ui `__tests__/glue-logic-test.ts`, `__tests__/hi-tools-test.ts`,
`__tests__/article-template-test.ts`, `__tests__/hi-interior-design-test.ts` and
`__tests__/hi-tool-commands/` pass with the same count; the tests of a moved method move with it.

**Reproduce.** `grep` the moved methods in roomle-ui `packages/`: outside `glue-logic.ts`, only
`hi-tools.ts` calls them; inside it, no UI path does.

## 111. A discarded new group of a create names its root modules by ids the call never sent

**Problem.** When the library cannot calculate a new group of `create-or-replace-groups`, the tools
discard it before the load (D106), and the error and `notLoaded[].rootIds` name its root modules,
and the group, by the ids the planner gave them: "posGroups[0]: nothing was changed - the library
could not calculate root module 'id0002' (cabinet-600) of group 'id0003' - …". The call sent the
root `u1` and no group id, and the plan never holds either id. A root module a replace adds is
named the same way.

**Cause.** The glue logic gives every root module of a new group, and a root module a replace adds,
a fresh id (`_replaceRootModuleIdsAndRemapDockedRoots`, roomle-ui `glue-logic.ts:930`, `:1169`).
`_loadGroupLayout` (`hi-tools.ts`) calls `newLibraryFailures` without names for them. The staged
row edits name the units they add through `newRoots` of `newLibraryFailures`; the create does not.

**To do.** roomle-ui `hi-tools.ts`, `_loadGroupLayout`: pair the root modules of a built group with
the roots of `layout.posGroups[outcome.index]` — a root kept in a replace by its id, the others by
their order when the articles line up, as `loadedRootOf` (`hi-tool-attributes.ts`) does after the
load — and hand the call's root ids to `newLibraryFailures` as `newRoots`; name a new group the plan
does not hold by its `posGroups[i]` prefix alone. An article with several root modules expands into
roots the call did not name (`<id>:<index>`), which keep their ids. No change to `glue-logic.ts`.

**Test.** roomle-ui `__tests__/hi-tools-test.ts`:
`it('discards a new group of a create the library could not calculate before the load and builds the others')`
names `u1` in the error and in `notLoaded[].rootIds` instead of any id; a replace that adds a root
the library cannot calculate names it by the call's id.

**Reproduce.** Model-free, unit level: `create-or-replace-groups` with one new group, root `u1`, that
the library cannot calculate (the setup of the create discard test) names
`root module 'id0002' (cabinet-600) of group 'id0003'`.
