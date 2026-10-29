# The create replayed without a model: the loads of a kitchen before and after one calculation and one load

| Field | Value |
|---|---|
| Type / domain | Benchmark, model-free / the planner's work in `create-or-replace-groups` |
| Trigger | Proposal C of [the performance analysis](../refactoring-analysis/planning-assistant-performance-next-steps.md), §5.3, whose refactoring analysis asked for the create measured model-free before and after and is closed out into D125 of the HI tools' decisions and this report; [RML-18303](https://roomle.atlassian.net/browse/RML-18303) |
| Date / author | 2026-10-29 / Claude Code |
| Status | Measured; the change stays |
| Before | roomle-ui `da0f50b80` (`feat/hi-mcp-performance`) |
| After | roomle-ui `7a9f50fc8` (`feat/hi-mcp-performance`): the create calculates first and loads once (D125) |
| Data | `.temp/result/replay-create-loads-2026-10-29/`: `before/` and `after/` with one folder per replay (`replay.json`, the plan images), `collector/replay.mjs`, `collector/summarize.mjs`, `collector/probe-follow-up.mjs` and `probe-follow-up.log` |
| How to repeat | §9 |

Affected repositories: roomle-ui (the change measured, `feat/hi-mcp-performance`); roomle-hi-example (this report).

## 1. Executive summary

The create tool of the two benchmark kitchens is **1.0 to 1.4 s faster**, in every replay: the walnut corner kitchen from 3.19 s to 1.97 s as the model sent it and from 3.75 s to 2.40 s with materials the library calculates, the image kitchen on the left wall from 2.82 s to 1.77 s (means of three replays each, the whole tool from the forward to its answer). The planner's work in the tool drops from two or three loads by the tools, one or two follow-ups of the kernel and four or five publications to the host, to **one load by the tools, one follow-up and two publications**; the library calculates the kitchen six times instead of nine (walnut) and five instead of eight (image). The loaded kitchens are the same: the same position, rotation and footprint in the plan context, the same root modules with the same input attributes.

One finding changed the implementation: a group loaded once at a wall with the plain load reason gets **no follow-up from the kernel** — no planning situation, no walls, so the library builds its ends for nowhere — where the reload of the old order did. The one load of a group placed at a wall therefore asks the kernel for its plan answer (`PLACED`), which brings the follow-up: the probe of §4.4 shows the walls reported and the end at the wall built flush only then.

What remains in the tool is not the loads: **111 small library calculations, 0.75 to 0.95 s per create**, the article templates and the verified options the override checks and the group materials ask for, cost as much as the kitchen's own calculations and its load together (§6).

## 2. What was asked

Proposal C: the tools calculate first and load once — the create's load at the planner's origin, its reload at the wall, its reload as built and its load for the materials become two calculations and one load. The analysis asked for a replay of the two baseline kitchens' create payloads through `callExternalObjectAgentTool` on the current build and on the build with the change, with the library calculations, the publications, the kernel loads and its follow-ups counted and timed, and the plans compared, before a model is paid for.

## 3. How it was measured

- **The page:** the example page on `http://localhost:3103/` (`EXAMPLE_PORT=3103 node minimal-hi-example/start.mjs --dev --no-open`), the planner from an own Vite dev server of the roomle-ui checkout on `http://localhost:5174/`, the plan `ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv` (the default room of the baselines, empty), `Furniture_Smith` on `HI_PRE_Roomle_Milestone_2`, the pinned embedding-lib `0.0.0-dev-1b4351d`. Headless Chromium through Playwright, a fresh page per replay, the library's articles listed and the plan's groups reported before the call.
- **The payloads:** the `create-or-replace-groups` inputs of the test session `mcp-test-2026-10-28_19-47-49`, run 52 (`full-kitchen-walnut-marble-corner`: 14 roots, placement right/back, 13 group attributes) and run 68 (`image-kitchen-left-wall`: 9 roots, left/center, 9 group attributes) — the fixtures of the baselines; the captures of the baselines themselves are not retained. The walnut payload's materials are discarded by the library as in the session (the countertop colour 324 at 40 mm has no edge mapping), so a third payload, `fkwmok`, carries the countertop values of the session's own follow-up (program Style, 25 mm), which calculate.
- **The hooks:** in the planner frame, wrappers on the glue logic found by walking the frame's window — `designerRequests.loadPosGroups` (start, end, reason, groups), the library's `calculateGroup` (count, ms, roots), `groupsModified` (the publications), `changedGroupPlanningSituation` (the kernel's follow-ups) and `executeGroupOperation` (the tool command); in the page, the tool forward timed around `callExternalObjectAgentTool` and the requests of the page recorded.
- **The reads after each replay:** the groups through `get-plan-context`, the raw groups with their input attributes, and the plan images.
- **The runs:** three replays per payload and build, nine per build; the after build after the unit tests of the change passed.
- **Not measured:** the page's price requests — the example page made none in the headless session —; the count of publications is the measure of what the host is asked to price.

## 4. Results

### 4.1 Per payload, the means of three replays

| Payload | Build | Tool s | Tool command s | Loads by the tools | Kernel follow-ups (s) | All kernel loads s | Publications | Kitchen calculations (s) | Small calculations (s) |
|---|---|---|---|---|---|---|---|---|---|
| Walnut as sent, materials discarded | before | 3.191 | 3.057 | 2 | 1 (0.587) | 1.104 | 4 | 9 (0.776) | 111 (0.763) |
| | after | **1.974** | 1.875 | 1 | 1 (0.249) | 0.642 | 2 | 6 (0.521) | 111 (0.779) |
| Walnut, materials calculable | before | 3.752 | 3.425 | 3 | 2 (0.945) | 2.037 | 5 | 9 (0.758) | 111 (0.748) |
| | after | **2.403** | 2.296 | 1 | 1 (0.312) | 0.796 | 2 | 6 (0.647) | 111 (0.954) |
| Image kitchen left wall | before | 2.822 | 2.561 | 3 | 2 (0.597) | 1.412 | 5 | 8 (0.385) | 111 (0.774) |
| | after | **1.771** | 1.689 | 1 | 1 (0.191) | 0.492 | 2 | 5 (0.290) | 111 (0.944) |

Tool s: from the forward of `callExternalObjectAgentTool` to its answer, the plan-context reads of the tool included. Tool command s: `executeGroupOperation` in the planner. Loads by the tools: `loadPosGroups` with a reason other than the follow-up's `plan_changed`. All kernel loads: every `loadPosGroups`, the follow-ups' included, as the sum of their durations. Kitchen calculations: `calculateGroup` on a group of more than four roots; small calculations: on a group of up to four roots — the article templates and the checks on module copies. A follow-up's seconds include its calculation and its load.

### 4.2 Per replay

| Build | Replay | Tool ms | Command ms | Load reasons | Publications | Kitchen calcs ms | Plan context: position, rotation, footprint |
|---|---|---|---|---|---|---|---|
| before | fkwm-1 | 3,212 | 3,137 | adjusted, adjusted, plan_changed | 4 | 775 | [4815, 3765, 0], 270°, 3880 × 2190 |
| before | fkwm-2 | 3,239 | 3,163 | adjusted, adjusted, plan_changed | 4 | 787 | the same |
| before | fkwm-3 | 3,121 | 2,871 | adjusted, adjusted, plan_changed | 4 | 765 | the same |
| after | fkwm-1 | 1,891 | 1,792 | placed, plan_changed | 2 | 497 | the same |
| after | fkwm-2 | 1,930 | 1,831 | placed, plan_changed | 2 | 509 | the same |
| after | fkwm-3 | 2,102 | 2,001 | placed, plan_changed | 2 | 557 | the same |
| before | fkwmok-1 | 3,559 | 3,124 | adjusted, adjusted, plan_changed, change_attribute, plan_changed | 5 | 771 | the same |
| before | fkwmok-2 | 3,885 | 3,603 | the same five | 5 | 756 | the same |
| before | fkwmok-3 | 3,813 | 3,547 | the same five | 5 | 746 | the same |
| after | fkwmok-1 | 2,330 | 2,231 | placed, plan_changed | 2 | 614 | the same |
| after | fkwmok-2 | 2,411 | 2,300 | placed, plan_changed | 2 | 670 | the same |
| after | fkwmok-3 | 2,468 | 2,358 | placed, plan_changed | 2 | 658 | the same |
| before | iklw-1 | 2,880 | 2,601 | adjusted, adjusted, plan_changed, change_attribute, plan_changed | 5 | 386 | [−685, −240, 0], 90°, 3010 × 622.3 |
| before | iklw-2 | 2,843 | 2,584 | the same five | 5 | 391 | the same |
| before | iklw-3 | 2,744 | 2,498 | the same five | 5 | 378 | the same |
| after | iklw-1 | 1,765 | 1,684 | placed, plan_changed | 2 | 290 | the same |
| after | iklw-2 | 1,761 | 1,683 | placed, plan_changed | 2 | 288 | the same |
| after | iklw-3 | 1,786 | 1,699 | placed, plan_changed | 2 | 291 | the same |

### 4.3 The rounds of the create, before and after

The walnut kitchen as the model sent it, replay 1 of each build, the events in the planner frame in seconds from the tool forward:

| Before (`da0f50b80`) | | After (`7a9f50fc8`) | |
|---|---|---|---|
| 0.07–0.82 | the article templates and the checks: 11 templates of 4 roots, 100 calculations of 1–3 roots | 0.07–0.85 | the same |
| 0.82–1.12 | the kitchen calculated: 3 calculations (132, 129, 59 ms) | 0.85–1.15 | the same |
| 1.19 | published (added); 1.20–1.37 loaded at the origin (171 ms), no follow-up | 1.15–1.35 | the materials calculated and discarded: 3 calculations, the snapshot back |
| 1.43–1.56 | the wall reload calculated: 2 calculations (125, 56 ms) | 1.38 | published (added); 1.39–1.79 loaded at the wall with the kernel's plan answer |
| 1.62 | published (changed); 1.64–2.06 reloaded at the wall (422 ms), with the follow-up: 1 calculation (60 ms), the `plan_changed` load (150 ms), published | 1.54–1.78 | the follow-up: 1 calculation, the `plan_changed` load, published |
| 2.15–2.28 | the materials calculated and discarded: 3 calculations, the restored group published | 1.79 | the tool command answers |
| 2.36 | the tool command answers | | |

With calculable materials (`fkwmok`) the old order adds the attribute load and its follow-up (a sixth round, 0.5–0.8 s); the new order calculates the materials on the calculated group and loads once.

### 4.4 The follow-up the one load needs

An earlier after build loaded the calculated group with the plain reason `adjusted`: the create took 1.61–1.71 s (walnut) and 1.26–1.29 s (image), with **no follow-up of the kernel**. The probe `probe-follow-up.mjs` loaded a row of two units at the right wall through the planner's layout API, fresh, with three reasons:

| Load reason | Kernel follow-up | Contours reported | The row's position after the load | End at the wall |
|---|---|---|---|---|
| `adjusted` | none | none | [3400, 0, −3000] as sent | the worktop overhangs, as calculated for nowhere |
| `change_attribute` | one (`plan_changed`) | 2 | [3400, 0, −3010] | built flush, the row re-anchored by the 10 mm |
| `load` | one | 2 | [3400, 0, −3010] | the same |

The kernel reports a new object's planning situation only when the load asks for its plan answer (`respondWithPositionInPlan`); a reload of an object of the plan reported it on the move. The old create got the walls through its reload; the new one asks for them with the load reason `PLACED`, which the planner answers like `change_attribute`. The difference to the plain load is the follow-up's 0.19–0.31 s, and the kitchen the library builds for its wall (D70).

### 4.5 The plans

The plan context reports the same group in every replay of a payload: the walnut kitchen at [4815, 3765, 0] with 270° and a footprint of 3880 × 2190 mm, 16 root modules with 2 generated; the image kitchen at [−685, −240, 0] with 90° and 3010 × 622.3 mm, 11 root modules with 2 generated. Every root module carries the same input attributes before and after. The raw group's origin differs — before, the kernel re-anchored the group at the corner article after the reload ([4815, 0, −3765], 270°), after, the group keeps the calculation's frame ([4815, 0, −3504], −90°) —, which the plan context's position, read from the anchor root, does not show.

The results differ in one place: the sentences that name what the library changed with the group attributes. Before, they were read from the group after the materials' own load and its follow-up; after, from the attribute command's answer on the calculated group, before the load. The image kitchen's result names the base units' insertion height (100 to 150) in both; before, it also named the wall units' (1480 to 1530) and the carcase program the colour switches (to ModernNature), which now show in the loaded group's attributes without a sentence (D125). The walnut kitchen's discard correction is the same in both.

## 5. Findings

1. **The create is faster by 1.0 to 1.4 s on every payload** (§4.1), a third of the tool. The saving is the loads: the origin load and the wall reload with its recalculation (walnut 0.46 s of loads and 0.25 s of calculations), the attribute load and its follow-up where the materials calculate (0.5–0.8 s), and two or three publications.
2. **One load, one follow-up, two publications** per create — the structural criterion of the analysis holds in all nine after replays; no replay took the fallback reload of D70.
3. **The one load must ask the kernel for its plan answer** (§4.4); without it the kitchen stands at the wall as calculated for nowhere.
4. **The library's 111 small calculations cost 0.75–0.95 s per create and do not move**: 11 article templates of 4 roots (about 0.1 s) for the override checks, and 100 calculations of 1–3 roots (0.6–0.85 s) for the verified options of the group attributes on module copies (D107) — 13 group attributes on the walnut kitchen, 9 on the image kitchen. They are the largest block of the tool now.
5. **The follow-up costs 0.19–0.31 s** (a calculation of the kitchen and a kernel load) and stays; the as-built fallback stays untaken on both fixtures.

## 6. What this suggests next

| Lever | What it would save | Note |
|---|---|---|
| The verified options of the group attributes checked once per module and attribute set, not per attribute | up to about 0.6 s per create with ten group attributes | the check runs `calculateGroup` on a module copy per attribute (`verifiedOptionsOfModule`); the same values could be checked on one copy, or on the calculated group's own check attributes | 
| The article templates of the override checks taken from the library context's cache | about 0.1 s | the planner calculates the templates for the catalog already (`calculateArticleTemplate` is cached per article and overrides) |

Neither is part of C; both are measured here, not proposed.

## 7. What is open

Benchmark 14 — the two fixtures with the model on this build against the baselines — runs after this replay; its reports and the comparison follow in `.agents/benchmarks/`.

## 8. Measurement gaps

- The page's price requests were not observed in the headless session; the publications stand in for them.
- The before captures of the baselines are not retained; the session's payloads of the same fixtures were replayed, the walnut one with its materials discarded by the library as in the session.
- The times are those of one machine with an idle model: in a chat the tool runs beside the stream and the page's work.

## 9. How to repeat

```bash
cd roomle-ui && npx vite --config config/vite.config.ui.mts --host --port 5174 --strictPort
cd roomle-hi-example/.temp/result/replay-create-loads-2026-10-29/collector
node replay.mjs before fkwm-1 fkwm-2 fkwm-3 fkwmok-1 fkwmok-2 fkwmok-3 iklw-1 iklw-2 iklw-3
node replay.mjs after fkwm-1 fkwm-2 fkwm-3 fkwmok-1 fkwmok-2 fkwmok-3 iklw-1 iklw-2 iklw-3
node summarize.mjs
node probe-follow-up.mjs adjusted change_attribute load
```

The replay starts the launcher on 3103 itself; `before` and `after` name the roomle-ui checkout's state at the time of the run (`roomleUiHead` in each `replay.json`).
