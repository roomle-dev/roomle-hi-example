# A merged group's toe kick reaches 120 mm into the back wall

> **Type**: Bug Analysis
> **Domain**: roomle-ui `homag-intelligence` — delete a root module, then merge the split groups (`src/glue-logic.ts`: `deleteRootModule`, `_splitOffGroupsFromGroups`, `mergeGroups`); reached through the MCP tools `delete-root-module` and `merge-groups`, but the same code serves the planner's own delete and merge actions
> **Trigger**: "test the mcp" run `.temp/result/mcp-test-2026-10-01_10-23-00/report.md` (gpt-5-mini, planner `bo-test`), runs 09 and 12; the same numbers in run 12 of the Mistral suite (09:10) and the gpt-6-astra suite (09:44)
> **Date**: 2026-10-01
> **Author**: AI Assistant
> **Status**: Open — [RML-18040](https://roomle.atlassian.net/browse/RML-18040) (RoomleCore merge report)
> **Branch**: — (not fixed, see [Status of the fix](#status-of-the-fix))

---

## Symptom

Setup: three `HTB60` against the right wall from the back right corner (`posGroup [4815, 0,
-3765]`, 270), then "remove the middle unit", then "join the two groups on the right wall".

| After | Group | `pos` | Width | Roots (`plan-context.json`) |
|---|---|---|---|---|
| `delete-root-module` (09) | `a6910cad` | `[4815, 0, -3765]` | 600 | `HTB60` docked `RightBottom →` the deleted `ca0c5b78`; toe kick `e0a5134b` |
| | `e524f010` | `[4815, 0, -2565]` | 600 | `HTB60` docked `LeftBottom →` the deleted `ca0c5b78`; toe kick `e0a5134b` |
| `merge-groups` (12) | `cf667d04` | `[4815, 0, -3885]` | 1920 | both `HTB60`, each still docked to the deleted `8cdf3367`; one toe kick |

`plan.xml` of 12: the object spans z −3885 … −1965 (`y="-2925" width="1920"`, rotation 90); the
units at local x 120 and 1320, the toe kick at local x 0. The back wall's interior face is at
z −3765: the merged group starts 120 mm inside the wall, and the top object image shows the first
unit's toe kick reaching 120 mm past the unit's back end. The units stand where they stood; the
renders of the whole plan do not show it. Four suites, four times the same numbers — the model
input differs only in ids (Mistral 09:10, gpt-6-astra 09:44, gpt-5-mini 10:23 and its rerun
10:57, where 09 again shows both split groups docked to the deleted root and sharing one toe-kick
id).

## Investigation so far

- **Stale docking after the delete.** `deleteRootModule` (`glue-logic.ts:1343-1384` on
  `feat/hi-mcp-command-api-RML-18004`) removes the root from `roots` but leaves the
  `contextData.dockedRoots` entries of the other roots that name it; the split-off group copies
  them (`_splitOffGroupsFromGroups`). Both groups of 09 dock to a root that no longer exists.
- **One toe kick in two groups.** Both split groups list the generated toe kick `e0a5134b`
  (09) — the split copies the generated root into the new group with its id.
- **The merge.** `mergeGroups` (`glue-logic.ts:1512-1583`) appends the source group's
  non-generated roots to the target ("the generated ones are already in the target group"),
  takes the merged group's geometry from the kernel's report (`_updateGroupGeometry(targetGroupData,
  targetGroup)`), recalculates and reloads. The merged posData has the units at x 120 and 1320 —
  the origin the kernel reported lies 120 mm before the first unit.

Open: whether the 120 mm come from the kernel's merged geometry (a bounding box that includes the
shared toe kick or something of the source group), from the library's toe-kick generation over a
docking graph with stale entries, or from both. Answering it needs the merge reproduced against
the local planner with the kernel's `targetGroup` logged — 120 mm is also the plan's wall
thickness, which may be a coincidence.

## Status of the fix

Not fixed in this round. The delete, split and merge paths are the subject of the open roomle-ui
branch `fix/hi-calculation-error-handling-RML-18019-RML-18017` ("keep merges, splits, moves and
deletions the library cannot calculate"); a change to them here would collide with that work, and
the cause is not pinned down. Next step: reproduce in the planner UI without the MCP (three tall
units, delete the middle one, merge) on the local planner, log the kernel's merged group, and
decide there whether the stale docking and the shared toe kick of the split are the cause.

## Result (2026-10-02)

The question was whether the HOMAG library is at fault or the update logic. The library is not:
`calculateGroup` gets a wrong origin and a wrong surrounding contour from the kernel's merge report.

Checked live on the Three Tall Units plan with `getExternalObjectGroups()`, in the group frame:

| State | Origin | Units / toe kick | Floor contour |
|---|---|---|---|
| before the delete | `[4815, 0, -3765]` | x 0 / 600 / 1200, toe kick 0 | right wall along y 0, back wall at x 0 — correct |
| after the merge | `[4815, 0, -3885]` (120 mm inside the back wall) | x 120 / 1320, toe kick 0 | walls at y 0 only from x 120 to 1020, a diagonal to (0, −120), walls along y −120 inside the right wall; no back wall at x 120 |

- The glue (`mergeGroups` → `_updateGroupGeometry` → `_setGroupPosition`, `_setGroupContour`)
  passes the position and contours of the kernel's report to `calculateGroup` unchanged.
- The report comes from RoomleCore: `sendMergeGroups`, and `createSurroundings(object, {},
  changedGroup, mergedObjects)` in `createGroupChangeData`.

Follow-up: [RML-18040](https://roomle.atlassian.net/browse/RML-18040). No MCP server change.
