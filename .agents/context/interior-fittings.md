# Interior fitting implementation

## Interior Design tools

Interior Design, interior fittings and sub-articles refer to supported fittings inside an existing HI group. Read `get-interior-design-options` with `groupId` and optional `rootId`, `containerModuleId`, `articleId` filters. It returns unique installed instance IDs, parent-local measured positions, explicit settings and compatible library articles with destination tuples. It uses the existing context read with a scoped `interiorDesign` section; it waits behind writes, changes no selection and creates no history entry. Unsupported capability, no available additions and a discovery error have different outcomes.

| Tool | Required arguments beyond groupId |
| --- | --- |
| `add-interior-fitting` | `articleId`, `destination: { rootId, containerModuleId, parentModuleId }` |
| `move-interior-fitting` | `instanceId`, destination and/or `insertPosition` |
| `delete-interior-fittings` | Non-empty `instanceIds` list |
| `replace-interior-fitting` | `instanceId`, replacement `articleId` |

Add, move and replace accept an optional `insertPosition: [x, y, z]`: millimetres, x right/y up/z front, relative to the destination parent module. Add without it uses the library default; move/replace retain measured source placement. Missing source measurement requires a point. Library adjustments are reported, including a no-op when an insert ignores the requested move. An upper/lower instance is chosen from measured heights within the same parent, never list order. Clarify an ambiguous instance or an unspecified interior edit.

Discovery precedes edits. A generated container ID can expire after calculation; a stale explicit destination fails. The UI revalidates library compatibility inside each edit, stages changes and awaits final loading. Transfer stays within one group. Delete validates the complete batch and deduplicates IDs with a correction. Replacement removes the source only on the working copy, calculates available containers, adds/calculates the replacement and publishes one final group. Calculation failure preserves the original; a load failure restores it and awaits restoration. If restoration fails, the error says so.

Results retain `changed`, `addedInstanceIds`, `removedInstanceIds`, final `fittings`, and `corrections`. Recreation may change IDs. A changed call is one undoable action; no-op or failed-before-change calls add none. A failure after loading retains the planner's undo record. Groups include compact `interiorFittings`, so history detects an interior-only move or setting change with an unchanged cabinet outline. Never rebuild nested module trees or issue separate delete/add calls as replacement.

The server owns schemas, serial forwarding and agent wording. The roomle-ui implementation is based on `feat/water-connection`; it owns fitting identity, compatibility, calculation, completion and restoration. The bridge still exposes six planner methods. Chat recovery treats discovery as read-only and distinguishes returned fitting results from pending/failed edits.


## Validation

Unit tests cover MCP schema rejection, exact scoped/legacy forwarding, serial reads, interior-only undo/redo comparison, browser transport and interrupted chat feedback. SDK tests cover staging and awaited restoration of cache and scene. Direct planner/MCP validation passed with Furniture_Smith from HI_PRE_Roomle_Milestone_2; dated script identity and acceptance evidence are in [the feature analysis](../feature-analysis/interior-design-sub-articles.md#implementation-evidence--2026-10-19). Its generated container IDs change across calculations and its modular front inserts may ignore requested vertical positions. Each other library needs its own acceptance run to establish supported fitting and placement behaviour. Live AI acceptance also requires authorization to send the session's plan/tool results to the selected provider; mocked prompt tests establish served wording only.
