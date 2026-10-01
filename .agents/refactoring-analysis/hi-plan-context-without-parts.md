# Refactoring Analysis: Parts (PosPartData) in the groups of the plan context

> **Type**: Refactoring Analysis
> **Domain**: homag-intelligence (roomle-ui): `getPlanContext` / `getExternalObjectPlanContext`; hi-mcp (roomle-hi-example)
> **Trigger**: "parts (PosPartData) should be removed from the groups in the plan context (getPlanContext roomle-ui) … parts just put a huge amount of data in the context, but are not needed in any way". Analyse the assumption: is there anything that speaks against it?
> **Date**: 2026-10-01
> **Author**: AI Assistant
> **Status**: Done
> **Branch**: `refactor/hi-plan-context-without-parts` (roomle-ui from `master`, roomle-hi-example)
>
> **Close-out (2026-10-01)**: Parts were not changed; they were never in the plan context. By
> decision, **all** `logMessages` (not only `Info`) were removed from the plan context groups in
> roomle-ui, and the MCP server no longer tells the agent to check them. See the
> [Report](#report-close-out-2026-10-01).

## Verdict

The assumption has two halves, and they come out differently:

- *The agent does not need parts*: **true.** No tool description, rule or flow asks the agent to read
  a part.
- *Parts are in the groups of the plan context*: **false.** Since RML-17966 (roomle-ui PR #3051,
  merged) `getPlanContext` returns every group through `shapeGroup` / `shapeRoot`, a field whitelist
  without `parts`. The agent has received no parts since then. There is nothing to remove; a change
  in roomle-ui would not change the output.

What speaks against removing parts **upstream** of the shaping: they are the input of the footprint
the agent positions with, of the server's placement math, of the article pick detection and of the
planner's part list. And the heavy part of the groups section is something else: root `logMessages`
of category `Info`, about 65 % of it.

Recommendation: no code change for parts. If the goal is a smaller groups section, the lever is the
`Info` log messages (see [Follow-up](#follow-up-can-the-log-messages-be-removed)).

## The assumption checked

### In the code

| Where | What it shows |
|---|---|
| roomle-ui `homag-intelligence/src/glue-logic.ts:900` | `context.groups = (calculatedGroups ?? []).map(shapeGroup)`: every group of the plan context is shaped |
| roomle-ui `homag-intelligence/src/hi-plan-context.ts:618-655` | `shapeRoot` / `shapeGroup` build new objects from a whitelist. Root: id, articleId, articleName, desc, imageUrl, category, isGenerated, input attributes, contextData, dockingVectors, freeDockingVectors, subModules (id, imageUrl), logMessages. Group: id, libraryId, position, attributes, roots, logMessages. No `parts`, `modules` or `posData` |
| roomle-ui `homag-intelligence/src/hi-plan-context.ts:160-191` | `HiPlanRoot` / `HiPlanGroup`: the types have no parts field |
| roomle-ui `homag-intelligence/__tests__/hi-plan-context-test.ts:459` | the input root carries parts (`:478`), the shaped root is asserted with `toEqual` on an exact object (`:514`): a part in the output fails this test today |
| roomle-ui RML-18004 branches (`feat/hi-mcp-command-api-RML-18004`, `fix/hi-attribute-commands-RML-18004`, unmerged) | the group commands return `HiGroupOperationResult.groups: HiPlanGroup[]`, also through `shapeGroup` |
| `hi-mcp/hi-mcp-poc-json/tool-executors.ts` | `get-plan-context` passes the context through; `create-or-replace-groups` returns `loaded` (`LoadExternalObjectGroupResult` is `{ id: number }`) and the shaped groups; `place-group` returns the shaped group |
| ligna-store `hi-mcp/` | bridge and chat only: no shaping, no executors of its own |

### In a live result

The latest "test the mcp" run (`.temp/result/mcp-test-2026-10-01_12-08-07`, planner `bo-test`)
stores the `get-plan-context` result as the MCP server returns it (`run-hi-mcp-prompt.js:354`).
Run 06 (one group, 12 roots): 67 KB, **0 `parts` keys**. The deployed planner the tests run against
already serves the shaped context.

## Where the parts are used, and why they stay upstream

Parts live in the raw calculated groups (`getPosDataOfAllGroups`, `getExternalObjectGroups`), and
there they have readers:

1. **The footprint in the plan context.** `groupFootprint` (`hi-plan-context.ts:451`, through
   `rootFootprintPoints` `:406` and `collectParts` `:361`) takes the boxes of the visible parts.
   Without parts it falls back to the docking vector endpoints, then to a `b` × `t` box. Both are
   approximations that can leave out what stands outside the docking vectors. The agent is told to
   use `position.footprint.widthMm` for a row along a wall (`hi-mcp-server.ts:28`) and to verify
   positions with the footprint (`:33`).
2. **The MCP server's placement math.** `place-group` and the contact test read the raw groups
   (`tool-executors.ts:904`, `:446`, `:570`) and compute their own footprint from the parts
   (`plan-space.ts:94`). The corner probe reads the raw docking vectors (`tool-executors.ts:232`).
   These raw groups only travel over the page bridge; they never reach the agent.
3. **The article pick detection.** `_isArticlePickRoot` (`glue-logic.ts:747-755`) treats a root
   without `parts`, `modules` and `posData` as an article pick and completes it from the article
   template. `place-group` reloads the raw group (`repositionedGroup(rawGroup, …)`). If its parts
   were stripped, a calculated root without sub-modules would be re-completed as a pick instead of
   being reloaded as calculated.
4. **The planner part list.** `planner-core/src/utils/map-to-ui-plan-objects.ts:55` turns `parts`
   into the UI part list with prices.

Removing parts at the source breaks 1–4; removing them in the shaping changes nothing.

## What actually fills the groups section

Measured on the stored run, as compact JSON without `imageUrl` (the way `textResult` sends it):

| Run | Roots | Groups section | Root `logMessages` | Root `attributes` | Root `contextData` |
|---|---|---|---|---|---|
| 06 full kitchen | 12 | 31,226 chars | 20,210 (65 %) | 3,310 | 2,748 |
| 05 kitchen | 6 | 10,950 chars | 6,798 (62 %) | 942 | 714 |

All 53 log messages of run 06 are `Info`, the library's data completion notes (`Exception used
(mod_TypeElement: WallUnit) … 'basic_CarcaseShelftopConstruction' is now …`, `Module context
information returned incomplete data.`), each with `timestamp`, `seqNo` and `scope`. The agent is
told that only `Error` entries mean something (`hi-mcp-server.ts:33`, `:192`).

## Alternatives considered

- **Strip `parts` in `shapeRoot`**: rejected, because they are not there.
- **Strip `parts` in `getPosDataOfAllGroups` / `getExternalObjectGroups`**: rejected, because it
  breaks the footprint, the server placement math, the pick detection and the part list.
- **Drop the footprint, so the shaping no longer needs parts**: rejected, because the agent
  positions rows with it.

## Follow-up: can the log messages be removed?

**The `Info` ones, yes; the others, no.**

`Info` has no reader. Across both stored sessions (52 plan contexts and planner call logs) there are
532 log messages, all `Info`, from two library areas: `DataCompletionSetDefaultScripts_globalVars`
(420) and `ModuleAfterDataCompletion` (97). The 427 "Exception used … 'X' is now 'Y' instead of
'Z'" messages all concern internal `basic_*` construction attributes, never an attribute the agent
set. The rest are toe-kick and worktop generation notes ("mr_Toekick has been instantiated and has
received 3 generation contours."). No server code reads `logMessages`, and the glue logic reads only
the raw groups (below). Dropping `Info` cuts the groups section by about 60 %.

`Fatal`, `Error` and `Warning` must stay:

- **They are the agent's only feedback on a bad input in a new group.** Creating or replacing a
  group (`_calculateNewGroup`, roomle-ui `glue-logic.ts:1661`) loads the calculated result as it
  is. Only the modify flows discard a failed calculation (`_runGroupCalculation` `:1749`,
  `_rejectFailedCalculation` `:1825` in the sub-article flow). The MCP server validates article ids
  and the docking of `create-or-replace-groups`, not attribute values (`toArticlePick`,
  `tool-executors.ts:58`). The agent is told to check them (`hi-mcp-server.ts:33`, `:192`;
  `minimal-hi-example/docs/hi-mcp-server.md:625`).
- **The glue logic's own error check is not affected.** `rootModulesWithCalculationError`
  (`glue-logic.ts:387`) reads `Fatal`/`Error` on the raw calculated group, before any shaping.

Not verified: whether the HOMAG library writes an `Error` for an invalid attribute value. No stored
run had one, because no run submitted an invalid value.

Where to filter is open:

- in roomle-ui `shapeRoot` (`hi-plan-context.ts:638`), because the plan context is meant to be
  agent-ready as is (RML-17966), and no other caller reads the log messages of the plan context
  (the example page logs through `onLogMessage`, not the context); or
- in the MCP server `textResult`, where the `imageUrl` stripping went because the plan context API
  also serves other callers ([tool results exceed the context](../bug-analysis/tool-results-exceed-mistral-context.md)).

**Decision (2026-10-01, Gernot Steinegger):** remove the `logMessages` in `getPlanContext`, all
categories, in roomle-ui.

---

## Report (close-out, 2026-10-01)

### Summary of changes

`shapeRoot` and `shapeGroup` no longer copy `logMessages`, so the groups of `getPlanContext` carry
none, at root level or group level. The agent instructions and docs of the MCP server no longer
mention them. Parts stay as they were.

### Changed files

| Repository | File | Change |
|---|---|---|
| roomle-ui | `homag-intelligence/src/hi-plan-context.ts` | `logMessages` removed from `HiPlanRoot`, `HiPlanGroup`, `shapeRoot`, `shapeGroup`; the `PosErrorMsg` import dropped |
| roomle-ui | `homag-intelligence/__tests__/hi-plan-context-test.ts` | the `shapeGroup` test gives the root an `Error` and the group an `Info` message and asserts that neither survives |
| roomle-hi-example | `hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts` | the instruction "logMessages entries with category Error mean the input is wrong" and "any Error logMessages" in the `create-or-replace-groups` description removed |
| roomle-hi-example | `hi-mcp/hi-mcp-poc-json/tests/tool-executors.test.ts` | the shaped-group fixture loses `logMessages` (the raw-group fixture keeps it) |
| roomle-hi-example | `minimal-hi-example/docs/hi-mcp-server.md`, `hi-mcp/hi-mcp-poc-json/README.md`, `.agents/skills/hi-mcp-tools.md` | the same instruction removed from the docs |

The group commands of the unmerged RML-18004 branches return their groups through `shapeGroup`, so
they lose the log messages too once both are merged.

### Before / after

Computed from the stored run (compact JSON without `imageUrl`), not measured live:

| Run | Groups section before | After |
|---|---|---|
| 06 full kitchen, 12 roots | 31,226 chars | about 11,000 chars |
| 05 kitchen, 6 roots | 10,950 chars | about 4,150 chars |

### Tests

- roomle-ui: the adjusted `shapeGroup` test fails against the old `hi-plan-context.ts` and passes
  with the change. The homag-intelligence suite passes (409 tests on the branch; 465 on
  `feat/hi-mcp-command-api-RML-18004`, where the commit was cherry-picked as `e2712a6a7`).
  `lint:types` (UI, SDK, embedding) is clean.
- roomle-hi-example: the hi-mcp typecheck is clean and all 209 unit tests pass. `cf/tests/worker.test.ts`
  fails to load because `@cloudflare/containers` is missing from the local `node_modules`, as on
  `master`.

### Risks and open items

- **The agent loses its only feedback on a bad input in a new group.** Creating or replacing a group
  loads a failed calculation as it is, and the MCP server does not validate attribute values (see
  the follow-up above). A bad attribute override in `create-or-replace-groups` now goes unnoticed
  unless the result shows it otherwise (missing docking vectors, a wrong footprint). Not verified
  that the library writes an `Error` in that case at all.
- **Deployment:** planners without this roomle-ui commit (bo-test today) still return the log
  messages; the agent is no longer told about them.
- Not verified in a live planner session.
