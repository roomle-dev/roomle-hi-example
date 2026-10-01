# Refactoring Analysis: Parts (PosPartData) in the groups of the plan context

> **Type**: Refactoring Analysis
> **Domain**: homag-intelligence (roomle-ui): `getPlanContext` / `getExternalObjectPlanContext`; hi-mcp (roomle-hi-example)
> **Trigger**: "parts (PosPartData) should be removed from the groups in the plan context (getPlanContext roomle-ui) … parts just put a huge amount of data in the context, but are not needed in any way". Analyse the assumption: is there anything that speaks against it?
> **Date**: 2026-10-01
> **Author**: AI Assistant
> **Status**: Open
> **Branch**: `refactor/hi-plan-context-without-parts` (roomle-ui from `master`, roomle-hi-example)

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
`Info` log messages (see [Follow-up](#follow-up-needs-a-decision)).

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

## Follow-up (needs a decision)

Keeping only the `Warning` and `Error` root `logMessages` would cut the groups section by about 60 %.
Where to filter is still open:

- in roomle-ui `shapeRoot`, because the plan context is meant to be agent-ready as is (RML-17966); or
- in the MCP server `textResult`, where the `imageUrl` stripping went because the plan context API
  also serves other callers ([tool results exceed the context](../bug-analysis/tool-results-exceed-mistral-context.md)).

This analysis does not cover that change.

## Code and documents the work would touch

None for the parts. The roomle-ui branch `refactor/hi-plan-context-without-parts` stays empty
unless the follow-up lands there.
