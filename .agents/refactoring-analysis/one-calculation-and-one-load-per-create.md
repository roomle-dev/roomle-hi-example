# One calculation and one load per create

| Field | Value |
|---|---|
| Type / domain | Refactoring analysis / HI tool commands — `create-or-replace-groups` with a placement by wall and group attributes |
| Status | Open |
| Date / author | 2026-10-29 / Claude Code |
| Ticket | [RML-18303](https://roomle.atlassian.net/browse/RML-18303) |
| Origin | Proposal C of [the performance analysis](planning-assistant-performance-next-steps.md), §5.3 — the first of its order (§8.1): measured model-free before and after, its unit tests, the decisions |
| Base | roomle-hi-example `b6efad0` (`master`); roomle-ui `da0f50b80` (`feat/hi-mcp-performance` — the branch the roomle-ui change goes into) |
| Evidence | [The text baseline](../benchmarks/baseline-fkwm-az-2026-10-28.md) and [the image baseline](../benchmarks/baseline-iklw-az-2026-10-28.md) of 2026-10-28; the kitchen runs 52 and 68 of the test session `.temp/result/mcp-test-2026-10-28_19-47-49` (their create payloads in `planner-calls.json`); the code of `hi-tool-commands.ts`, `hi-tools.ts`, `hi-tool-attributes.ts`, `hi-wall-placement.ts`, `hi-plan-space.ts`, `hi-root-module-arrangement.ts`, `glue-logic.ts`, `roomle-planner.ts` and `planner-kernel-access.ts` |
| Scope | Analysis only — no code change, no model run, no embedding-lib build |

Affected repositories:

- **roomle-ui** (`feat/hi-mcp-performance`): the tool commands (`hi-tool-commands.ts`: `HiToolPlanner`, the create, the wall arithmetic of `placeAtWalls`, the counting of `runToolCommand`); the tools (`hi-tools.ts`: `_toolPlanner`, the calculation without a load, the positioned load, `change-attributes` on a calculated group); the answer of a group operation (`hi-plan-context.ts`); their tests and mocks; the behaviour reference (D23, D36, D70, D106, the §8 rows of the create, one new decision), `hi-tools-reference.md`, `tool-executors.md`, `agent-architecture.md`, `layout-and-placement.md` and `homag-intelligence.md`.
- **roomle-hi-example**: this analysis and the indexes; `.agents/skills/hi-mcp-tools.md` (the order of the create); the model-free replay report in `.agents/benchmarks/`.
- **Unchanged, where a reader expects a change:** `glue-logic.ts` — the hard rule, the tools implement what they need; the planner's public API (`external-object-api.ts`, `roomle-planner.ts`, the tools' `planner-api.ts`) — the tool commands run in the planner on `HiToolPlanner` (D71, ADR 0012) and the embedding-lib forwards the call as before, so no embedding-lib build; the served text and the fixture `hi-mcp-fixture.json` — no served sentence describes the loads of the create (the one "reloads it there" is `place-group`'s, which stays); the library; the ligna-store and the example page, which get the change with the planner.

## 1. Conclusion

`create-or-replace-groups` builds a kitchen placed at a wall with its group materials in **three or four rounds of calculate, publish and load** — at the planner's origin, at the wall, once more as built at the wall when the library builds the ends there otherwise, and once for the materials — and every kernel load brings the kernel's own follow-up: the planning situation it reports, the glue logic's recalculation and reload. Only the first calculation and the one for the materials produce something the kitchen needs. The position does not enter the library's calculation — the library learns the walls from the kernel after a load (§2.3) — and the materials can be inputs of the first load.

The target: **the tools calculate first and load once.** The create calculates the groups without loading them (the calculation `_loadGroupLayout` runs today, with D106's verdict, minus the publication and the kernel load), sets the group materials on the calculated groups, computes the wall targets from them as `placeAtWalls` does today, and loads the groups once at their targets with one publication. Then it measures them as built there and places once more only a group that does not stand as asked (D70, the fallback). Two library calculations and one kernel load instead of three or four of each; `undo` stays one step (D79); the results, the corrections, the hints and the discard of D106 keep their content; nothing the agent reads changes.

Expected: the create tool from 3.24 s to about 1.2 s for the text kitchen and from 2.08 s to about 0.9 s for the image kitchen — the parent analysis's estimate from the price of one calculation and load (§3.1 there) —, on the first kitchen and on the turn, in every run. **Measured model-free first:** a replay of the two kitchens' create payloads on the current build and on the build with the change counts the library calculations, the publications, the kernel loads and the kernel's follow-ups and times each (§5). No model token is spent; the paid screen comes with A–E (§8.3 of the parent analysis).

## 2. What the create does today, and why it is a problem

### 2.1 The rounds

The command `'create-or-replace-groups'` of `HI_TOOL_COMMANDS` (`hi-tool-commands.ts:508`) prepares the groups — the corrections, the article ids, the agent's group ids, the relations into docking, the overrides, the anchor frames — and then changes the plan in up to four rounds. Each round is a library calculation, a publication to the host and a kernel load, and each kernel load may bring the kernel's follow-up:

| Round | Code | Library calculation | Publication | Kernel load |
|---|---|---|---|---|
| 1. The load at the origin | `loadExternalObjectGroupLayout({ posGroups }, 'posGroups', { reason: ADJUSTED })` (`hi-tool-commands.ts:795`) → `_loadGroupLayout` (`hi-tools.ts:698`) → `_calculatePosGroupsLayout` (`:788`) | a new group: `addNewGroup`, `solveInitialNewGroup`, `arrangeRootModulesAndCalculateIfChanged`; a replaced one: `calculateAndUpdateGroupMap` | `groupsModified(added, changed)` (`:753`) | `loadPosGroups(loaded, { applyGroupPosition: true, reason })` (`:756`) |
| 2. The reload at the wall | `placeAtWalls` (`hi-tool-commands.ts:297`): `wallTarget` on the calculated groups, `repositionedGroup`, `loadExternalObjectGroupLayout` (`:372`) | the replace path of `_calculatePosGroupsLayout`: `calculateAndUpdateGroupMap(existing, true, true)`, whose arrangement applies the repositioning (`_applyRepositioningData`, `hi-root-module-arrangement.ts:887`) | yes | yes |
| 3. The reload as built (D70) | `placeOnceMoreAsBuilt` (`:243`): the measure at the wall, `loadExternalObjectGroupLayout` (`:282`) for the groups that do not stand as asked | yes | yes | yes |
| 4. The group materials | `applyGroupWideAttributes` (`hi-tool-attributes.ts:665`) → `externalObjectGroupOperation('change-attributes')` → `changeAttributes` (`hi-tools.ts:1263`) → `_changeAttributes` (`:1120`) | `modifyAttributesOfModules` (`glue-logic.ts:2369`): the conflicts solved, `calculateAndUpdateGroupMap` | `loadWithChangedAttributes` (`glue-logic.ts:1901`): `groupsModified` | `loadPosGroups(…, { reason: CHANGE_ATTRIBUTE })` |

**The kernel's follow-up.** A load goes through `RoomDesignerApi.loadPosGroups` (`api.ts:55`) to `RoomlePlanner.loadExternalObjectGroups` (`roomle-planner.ts:2485`) and `_loadOrUpdateExternalObjectGroup` (`:2658`), which calls `plannerKernelAccess.loadExternalObjectGroups` (`planner-kernel-access.ts:1517`). That waits for every plan change the kernel reports during the load (`reportedPlanChanges`): `_externalObjectPlanChanged` → `changedGroupPlanningSituation` (`glue-logic.ts:1293`) writes the kernel's positions and the roots' context data into the group (`_updateGroupGeometry`, `:1489`; `_setRootModuleContextData`, `:1551`), calculates the group again with the library, loads it with `PLAN_CHANGED` or `POSITION_CHANGED`, and publishes it once more. The tool's load answers after that.

**Every publication costs the host a price.** `groupsModified` (`glue-logic.ts:2756`) calls `onPosGroupAdded` or `onPosGroupChanged` and then `_calculatePrice` → `onPriceCalc`; the example page answers each with `fetchPrice`, a request to the HI proxy, coalesced into one running fetch and one rerun (`createCoalescingTaskRunner`, `index.html`). The baselines show the fetches: three during and after the text create (21.796–23.760 s, 24.310–24.948 s, 24.949–25.710 s in run 1; the create ran 20.815–24.021 s), two during the image create. The count of fetches is a floor for the count of publications — the runner coalesces them.

### 2.2 The measure

| Create | Tool, ms | Nested `externalObjectGroupOperation`, ms | Where |
|---|---|---|---|
| Text kitchen: 14 / 13 roots, `right` / `back`, 13 group attributes | 3,473 / 2,999 | 3,207 / 2,788 | the text baseline, runs 1 and 2 |
| Image kitchen: 9 roots, `left` / `center`, 9 group attributes | 2,010 / 2,150 | 1,782 / 1,927 | the image baseline, runs 1 and 2 |
| The same two kitchens in the session | 2,409 / 2,340 | — | runs 52 and 68 of `mcp-test-2026-10-28_19-47-49` |
| One calculation and one load of the same kitchens (`change-group-attribute`) | 1,068 / 882 | — | runs 52 and 68; 812–1,099 ms in the kitchens of the session, 522 and 717 ms in the baselines |

One calculation and load of a kitchen costs 0.5–1.2 s; the create spends 2.0–3.5 s on three or four of them. How a round splits into the library's calculation, the kernel's load and the follow-up is in no capture: the baselines' planner tables hold the whole tool as one nested call. The replay of §5 measures the split.

### 2.3 Why the rounds are more than the kitchen needs

1. **The position does not enter the library's calculation.** `_calculatePosGroupsLayout` calculates a new group as the library builds it for nowhere: no wall distances, both ends free (D70). The library learns where the group stands from the kernel: after a load the kernel reports the planning situation, `_setRootModuleContextData` writes the roots' context data, and the recalculation of the follow-up builds the ends for the wall. The reload at the wall (round 2) therefore recalculates a group whose calculation cannot change with its position; what changes it comes with the kernel's follow-up, after the load, in round 1 and in round 2 alike. D23 reasoned that the width a wall placement needs exists only after the calculation — which holds — and rejected "a probe of the whole group and one load at the target: every call would calculate the group twice and turn the footprint into the anchor's frame on a second path". The code calculates the group three or four times today, and the second path exists: `repositionedGroup` (`hi-wall-placement.ts:235`) and `repositioningFromPlacement` (`hi-plan-space.ts:1142`) turn a wall target into the planner's repositioning on every wall placement.
2. **The materials can be inputs of the first load.** D36 sets the group materials after the last reload because "the planner answers an attribute command before the calculated group carries the new values, so a reload after it would send the values before it". That reason orders a command on a loaded group against a reload after it. It does not apply to values set on the calculated group before its first load: `_changeAttributes` sets them as inputs (`_setAttribute`, `isInput: true`) and calculates; the one load carries them, and the kernel's follow-up recalculates with them.
3. **The as-built measure needs the kernel.** The library builds a group for its place — wider end units at a wall, no worktop overhang at the end at the wall — and the tools do not predict that rule (D70, §2.4 of the behaviour reference). The measure after the load stays, and its reload stays as the fallback. How often the fallback is taken is for the replay to count (§5): for the text kitchen in the back right corner probably once — the end at the wall loses its overhang, the case of the test `places a new group by wall once more by its measure at the new place when the library builds it there otherwise` —, for the image kitchen centred on the left wall probably never.
4. **Every round publishes.** Three or four publications per create, each a price request of the host.

### 2.4 What D23 keeps right

The width exists only after the calculation, so the wall arithmetic runs on the calculated group: `groupFootprint` (`hi-plan-space.ts:206`) reads the calculated parts and docking vectors, `wallTarget` (`hi-wall-placement.ts:581`) the footprint and the heights. The overlap corrections (G22), the groups of a call counted at their targets and the corner arithmetic stay. Nothing in `hi-wall-placement.ts` and `hi-plan-space.ts` changes.

## 3. The target shape

### 3.1 Two planner methods of the tools, and `change-attributes` before the load

`HiToolPlanner` (`hi-tool-commands.ts:118`), implemented by `_toolPlanner` of `HiToolsImplementation` (`hi-tools.ts:338`) and mocked by `createApi` of the tool command tests, gains:

- **`calculateExternalObjectGroupLayout({ posGroups })`** — the first half of `_loadGroupLayout`: the snapshots of the replaced groups, `_calculatePosGroupsLayout`, D106's verdict per group (a new group the library cannot calculate leaves the group map, a replaced one gets its snapshot back), **no publication and no kernel load**. It answers `{ outcomes, groups }`: the outcomes as a load answers them, so `readLoadOutcomes` reads them unchanged, and the calculated groups raw, as `getExternalObjectGroups` lists a loaded group. The tools record the calculated groups that await their load (`_calculatedNotLoaded`: group id → added or replaced) until the load or the end of the tool call.
- **`loadCalculatedExternalObjectGroups(groups, options)`** with `groups: Array<{ id, repositioningData? }>` — the second half: for each group with a repositioning, the arrangement's own repositioning step applied on the calculated group (`_applyRepositioningData`, G = T · R⁻¹, `hi-root-module-arrangement.ts:887`, made callable for a calculated group — no library calculation, no arrangement); then **one** `groupsModified(added, changed)` and **one** `loadPosGroups(loaded, { applyGroupPosition: true, ...options })`, with the kernel's follow-up as it is. It answers the load outcomes (the ids) and clears the record.

`_loadGroupLayout` becomes the two in sequence and keeps serving `loadExternalObjectGroupLayout`: the placement by point, the replace without a placement, the reloads of D70 and of `place-group`. `createOrReplacePosGroupsFromLayout`, the public direct-layout wrapper, stays as it is (D106).

- **`change-attributes` on a calculated group.** `changeAttributes` (`hi-tools.ts:1263`) requires the group in the scene (`_requireGroupsInScene`, `:2246`). For a group the tools have calculated and not loaded, it takes the group item of the map; `_changeAttributes` calculates (`modifyAttributesOfModules`), applies D106's verdict (`_discardCalculated` puts the snapshot back on a failure) and **does not load** — the group stays calculated-not-loaded, with the attributes as inputs. `runGroupOperation` (`hi-plan-context.ts:1756`) answers `groups` from the scene; for a group not in the scene it answers the calculated group of the map, so `libraryChangeSentences` and the `rootValues` report of `applyGroupWideAttributes` work unchanged. The payload and the verified options (`checkAttributeValues`, `:2388`, which reads the group map already) are the same as on a loaded group.

### 3.2 The order of the create

Steps 1–9 of today ([the create in `tool-executors.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/tool-executors.md)) stay: the preparation, the catalog, the plan context, the ids, the relations, the overrides, the anchor frames and the repositioning of the placements by point. Then:

10. **Calculate:** `calculateExternalObjectGroupLayout({ posGroups })`; `readLoadOutcomes`, `rememberAgentGroupIds` and the "nothing was created" errors as today, on the calculation's outcomes — a `DiscardedChange` when every group was discarded.
11. **The group materials, on the calculated groups:** `applyGroupWideAttributes(planner, callGroups, calculatedGroups, …)` unchanged — `groupSettingIdsOf` from the master data, `programsFirst`, `rootValuesOf` on the calculated roots, `checkAttributeValues`, one `change-attributes` command per group (§3.1), the `groupAttributes` report and the corrections. The materials come before the wall arithmetic because an attribute can change the geometry the footprint is read from.
12. **The wall targets, from the calculated groups with their materials:** the arithmetic of `placeAtWalls` without its reload — `wallTarget` per group, the other groups of the call counted at their targets, the G22 corrections, `placedAlong`, `repositioningFromPlacement` per group.
13. **One load:** `loadCalculatedExternalObjectGroups` with every calculated group, the repositioning on the groups placed by wall, `{ reason: ADJUSTED }`.
14. **After the load:** read the groups; a group placed by wall that still covers the floor it would cover without its placement is named as today (G59, "the planner did not load it there; place-group moves it"); `placeOnceMoreAsBuilt` measures the others as built at the wall and reloads the ones that do not stand as asked through `loadExternalObjectGroupLayout`, as today (D70, the fallback); read again when it reloaded.
15. The hints, `notLoaded`, `corrections`, `groupAttributes`, the result groups and `groupLabels` as today.

The counting planner of `runToolCommand` (`hi-tool-commands.ts:1588`): the calculation reads the groups before the change (`beforeTheChange`, the snapshot for the library verdict — before the map changes) and makes no step; the positioned load makes the step when it loaded a group, as a load does today; `historySteps` stays 1 or 0 (D79).

### 3.3 What stays

- **`place-group`** is unchanged: one reload through `loadExternalObjectGroupLayout` and the as-built fallback, as today. `placeOnceMoreAsBuilt` stays the shared helper with its reload.
- **A replace of a group of the plan:** the calculated replacement waits in the map while the scene holds the old group — the scene read answers the kernel's `serializedDefinition` of each loaded group (`getExternalObjectGroups`, `roomle-planner.ts`), not the map —, so "the group before the change stays" holds until the one load; a replace with a placement keeps dropping the placement with its correction.
- **The placement by point:** its repositioning is applied in the first calculation's arrangement, as today.
- The discard of D106, the overlap corrections G22, the not-moved correction G59, the verified options D107, the one undo step D79, the kernel's follow-up in the glue logic (the hard rule).
- **The served text and the result shape:** nothing the agent reads changes.

### 3.4 What the change makes of the four rounds

| | Today | With the change |
|---|---|---|
| Library calculations by the tools | 3–4: the group, at the wall, as built, with the materials | 2: the group, with the materials (a third one in the fallback) |
| Publications by the tools | 3–4 | 1 (+1 in the fallback) |
| Kernel loads by the tools | 3–4 | 1 (+1 in the fallback) |
| The kernel's follow-ups | one per load that changes the planning situation | the same per load |
| Undo steps | 1 (D79) | 1 |
| The result | — | the same |

## 4. The tests

| Test file | What changes |
|---|---|
| `__tests__/hi-tool-commands/__mocks__.ts` | `createApi` gains `calculateExternalObjectGroupLayout` (the picks become a calculated group, kept pending) and `loadCalculatedExternalObjectGroups` (applies the repositioning, answers the ids); `groupsBeforeAndAfter` counts the positioned load as the first change |
| `create-or-replace-groups-placement-test.ts`, `describe('create-or-replace-groups loading')` | `loads article picks only, with docking stripped to vector names`: the picks go to the calculation, the one load carries the ids; the anchor-frame tests: the repositioning of a placement by point reaches the calculation; `fetches the article catalog once per call`, the agent-id and `notLoaded` tests read the calculation's outcomes |
| the same file, `describe('create-or-replace-groups wall placement')` | `createWallApi` calculates at the arrival and positions on the load; `loads` lists the positioned load and the fallback reloads; `loads a new group placed by wall once without a position and reloads it once at the wall` becomes `calculates a new group placed by wall, positions it and loads it once` — one load with `repositioningData { posGroup: [4000, 0, -3000], posRotationY: 270, rootId: 'u1' }`; the as-built tests keep the fallback reload as the second load with the same repositionings; the overlap, corner, glass-wall and offset tests keep their targets and corrections; `names each group the reload left where it was` reads the load |
| the same file, `describe('create-or-replace-groups materials')` | the `change-attributes` command runs before the load, on the calculated group, with the same payload; "after the load" in the names becomes "before the load"; the one load's group carries the attributes as inputs; the discarded-attributes test: the group loaded without them, the correction as today |
| `run-tool-command-test.ts` | a calculation makes no step and reads the groups before the change; the positioned load makes the step |
| `__tests__/hi-tools-test.ts`, `describe('HI tool commands')` | `performs a tool in the planner: the group is calculated, loaded at its position and counted for undo` stays one `loadPosGroups`; new, through the real glue logic: a create with a wall placement and group attributes — `calculateGroup` runs for the group and for the attributes, `loadPosGroups` once with `applyGroupPosition` and the group at the wall, the host notified once (`added` once, `prices` once, before the kernel's follow-up), the loaded group with the attributes as inputs; a create whose group attributes the library cannot calculate: the group loaded without them, one notification; a discarded group: nothing published, as `host notifications of a discarded layout` tests today |
| the same file, `describe('group operations')` | `change-attributes` on a group the tools have calculated and not loaded: calculates, no load, the library-failure verdict puts the snapshot back; on a loaded group as today |
| `place-group-test.ts`, `group-commands-test.ts`, `hi-mcp-server-test.ts`, `hi-mcp-fixture.json` | unchanged |

Output changes to expect: none in the results the agent reads — `loaded`, `groups`, `groupAttributes`, `corrections`, `hint` and `notLoaded` keep their content; the wording of G59 loses "reload". The planner-call log of a create shows one load instead of two to four, and the host one publication instead of three or four before the kernel's follow-up.

## 5. The benchmark: the replay, before and after

**No model.** The two create payloads are replayed through `instance.extended.callExternalObjectAgentTool('create-or-replace-groups', input)` in a headless page, as [run-hi-mcp-prompt.js](../scripts/run-hi-mcp-prompt.js) opens it and as the warm-up probe of benchmarks 12 and 13 did (`.temp/result/benchmark-12-13-az-cat-2026-10-28/collector/probe-hooks.mjs`).

**The payloads.** The captures of the baselines are not retained; the session's runs 52 (`full-kitchen-walnut-marble-corner`: 14 roots, `right` / `back`, 13 group attributes) and 68 (`image-kitchen-left-wall`: 9 roots, `left` / `center`, 9 group attributes) hold the create payloads of the same fixtures in their `planner-calls.json`, and are the payloads of the replay. The plan `ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv` (the default room of the baselines), `Furniture_Smith` on `HI_PRE_Roomle_Milestone_2`.

**The page.** The launcher on a spare port (`EXAMPLE_PORT=3103 node minimal-hi-example/start.mjs --no-open --dev`) with `EXAMPLE_SERVER_URL` to a dev server started from the roomle-ui checkout at the measured commit (an own Vite on 5174, as the collector of benchmarks 12 and 13 did — never the user's 5173), `&id=` the plan; wait for `hiPosGroupsCompletelyLoaded` and the articles. Before: `da0f50b80`. After: the commit with the change. The same payloads, the same planner, the same plan.

**The capture.** The collector's `timing-init.js` as it is — the page's `fetch` wrapped (the price fetches to `/api/price/calculate`), the planner frame's `[hi-mcp] call` lines — plus, in the planner frame, wrappers on the glue logic found by walking the frame's window (the live-check path): `designerRequests.loadPosGroups` (start, end, reason, groups), the library's `calculateGroup` (count, ms), `groupsModified` (count), `changedGroupPlanningSituation` (count, ms). Per payload three replays, each on a fresh page or after `undo`; after each the groups through `get-plan-context` and `getExternalObjectGroups()` (position, rotation, root count, the input attributes), and the top image for the eye.

**Read, in this order:**

1. **The counts** per create, before and after: the tools' library calculations, publications and kernel loads, the kernel's follow-ups, the price fetches, and whether the fallback of D70 was taken. The structural criterion: one tool load and one tool publication per create, the fallback only where the measure finds the group standing otherwise.
2. **The milliseconds**: the tool (`callExternalObjectAgentTool` start to end), each load, each calculation, each follow-up; the mean of the three replays. The expectation of the parent analysis: the tool below 1.5 s for the text kitchen and below 1.2 s for the image kitchen. Not faster in the mean means the change failed, whatever the counts say.
3. **The plans**: the same groups before and after — the kitchen at the wall or in the corner with the same position and rotation, the same root modules, the materials set as inputs, the same corrections in the result.

**The document.** One report in `.agents/benchmarks/`, `replay-create-loads-2026-10-xx.md`, with the two builds side by side — the counts and the milliseconds per payload —, registered in the benchmarks index and in `.agents/README.md`; the raw captures in `.temp/`. It is the "before, without a model" of §8.3 of the parent analysis; the paid screen of A–E follows there.

## 6. The decisions

In roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md`, §3, in the roomle-ui change:

| Decision | Change |
|---|---|
| D23 | The order of a placement by wall: the tool calculates the group without a position, computes the target from the calculated group, sets its group materials on it and loads it once at the target; after the load it measures the group as built and places it once more when it does not stand as asked (D70). "Two loads — three when a group is placed once more" becomes "one load — two when a group is placed once more". The rejected "probe of the whole group and one load at the target" is what the tools do now, with the calculation they ran already and the repositioning path `placeAtWalls` had; the rejection of "a width from the catalog before the load" stays |
| D36 | "after the last reload" becomes "on the calculated group before its load": the values are inputs of the one load, and the ordering reason — the planner answers an attribute command before the calculated group carries the new values — has no reload to order against. The group settings stay the master data's; the one `change-attributes` command stays |
| D70 | "after the reload" becomes "after the load"; the substance stays: the library builds the group for its place, the kernel tells the place, the tool measures and places once more |
| D106 | the verdict lives in the calculation without a load (`calculateExternalObjectGroupLayout`), and the attribute change on a calculated group calculates, applies the verdict and does not load |
| D79 | unchanged; a calculation is no step |
| new, D126 | **A create calculates first and loads once.** The rounds of today and their cost (§2), the two methods and the order (§3), the replay (§5). Rejected: the group materials as inputs of the first calculation — the generated roots they are set on and the verified options they are checked against exist only after it; the wall distances predicted before the load — D70; the positioned load for `place-group` and for the fallback of D70, which re-dock a wall unit above a floor unit at the reload (C24) and keep their reload here, a possible second step the same replay measures; a kernel move without a load — the kernel's API, out of scope |

The §8 rows of the create (G59, the D70 rows) lose "reload". The living reference follows in the same change: `hi-tools-reference.md` (the create's positioning paragraph), `tool-executors.md` (the stages 10–11 of the create), `agent-architecture.md` (the steps 16–19), `layout-and-placement.md` (the paragraph on `placeAtWalls`), `homag-intelligence.md` (the planner seam, `_loadGroupLayout`); in roomle-hi-example `.agents/skills/hi-mcp-tools.md` (the positioning paragraph of the create).

## 7. Not proposed

| Candidate | Why not |
|---|---|
| The materials as inputs of the first calculation | the worktop colour goes on the generated worktop, which exists after the calculation; the verified options (D107) come with the calculation |
| The wall distances given to the library before the load | the tools would predict one library's wall rule (D70, §2.4 of the behaviour reference); the kernel tells the place |
| `place-group` and the fallback of D70 with the positioned load | their reload re-docks a wall unit hanging above a floor unit (C24) and the fallback is taken only where the measure finds a difference; one helper, one path, unchanged — a second step once the replay shows the split between the library's calculation and the kernel's load |
| A kernel move of the group instead of a load | a planner API change for the fallback case only |
| Fewer price refreshes by the page or the glue logic | the publications drop with the rounds; the page's coalescing and the glue logic stay (the hard rule) |
| A change of the served text | nothing the agent reads changes |

## 8. The order of the work

1. **The replay before**, on `da0f50b80`: the counts and the milliseconds of the two creates (§5) — the baseline of the tool, and the split between the library's calculation, the kernel's load and the follow-up, which no capture has.
2. **The two methods and `change-attributes` on a calculated group** (`hi-tools.ts`, `hi-plan-context.ts`), with their tests in `hi-tools-test.ts`.
3. **The order of the create** (`hi-tool-commands.ts`), with the tests of the loading, the wall placement, the materials and `run-tool-command-test.ts`; `npm run test` of the web-sdk, format and lint.
4. **The decisions and the living reference** (§6), in the same roomle-ui commit on `feat/hi-mcp-performance`; the skill in roomle-hi-example.
5. **The replay after**, the report in `.agents/benchmarks/`, the indexes. The change stays when the criterion of §5 holds and the tool is faster in the mean; otherwise it is reverted and the report says why.
6. Then **A** of the parent analysis.
