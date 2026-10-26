# image-kitchen-left-wall: benchmark comparison

| Field | Value |
|---|---|
| Type / updated / author | Benchmark comparison / 2026-10-26 / Codex |
| Ticket | [RML-18303](https://roomle.atlassian.net/browse/RML-18303) |
| 01 — baseline | [Original measurement](01-iklw-oa-orig-2026-10-26.md) |
| 02 — new run | [Response-chaining measurement](02-iklw-oa-rc-2026-10-26.md) |
| Model / key reference | openai:gpt-6-astra / $OPENAI_ASSISTANT_API_KEY |
| Settings | Direct OpenAI Responses; provider-default reasoning; local planner :5173; same prompt/image/starting plan |
| Source revisions | 01: roomle-ui 6d088dde93908575229b02a8bdc2dd080f96c71e / example d68a737a770481fd96776097c49412a7f3f4cd28; 02: roomle-ui 80484dc71e0889e24d3251e42090c1ff2eca10f7 / example 5a5708d9577c766f7c87e4731f06aa8dc59bc4c0 |
| Data / PDF | Ignored .temp/response-chaining-implementation/; comparison PDF has the same unnumbered basename |

Affected repositories:

- **roomle-hi-example:** this comparison, the two numbered reports and indexes.
- **roomle-ui:** measured assistant/provider transport and planner.

This is the single unnumbered comparison for this benchmark series. **01 is the original baseline; 02 is the new run.** Each report contains two repetitions. Future numbered measurements are added here, preserving existing results and the original baseline. The extra fresh-baseline experiment is not substituted for report 01; its existing captures remain local.

## Reports compared

| Report | Version | Repetitions | roomle-ui revision |
|---|---|---|---|
| [01 — original](01-iklw-oa-orig-2026-10-26.md) | Full accumulated input | 2 | 6d088dde93908575229b02a8bdc2dd080f96c71e |
| [02 — response chaining](02-iklw-oa-rc-2026-10-26.md) | Stored response ID + new tool outputs | 2 | 80484dc71e0889e24d3251e42090c1ff2eca10f7 |

## Request bytes per model call

**Every value below is the size of one HTTP request**, in uncompressed serialized UTF-8 JSON bytes. These are the values in each report’s **Request bytes** model-table column. Delta is 02 − 01. Call numbers indicate order, not identical work: later tool choices and the point at which plan images are requested differ. Both call 2 entries retrieve the mandatory planning reference and both call 3 entries create the kitchen.

### Repetition 1

| Model call | 01 original Request bytes | 02 new Request bytes | Delta bytes (02 − 01) |
|---|---|---|---|
| 1 | 603,820 | 603,820 | +0 |
| 2 | 636,035 | 75,258 | −560,777 |
| 3 | 651,859 | 58,959 | −592,900 |
| 4 | 680,920 | 70,271 | −610,649 |
| 5 | 681,983 | 2,817,741 | +2,135,758 |
| 6 | 682,740 | 44,021 | −638,719 |
| 7 | 3,330,545 | — | — |

### Repetition 2

| Model call | 01 original Request bytes | 02 new Request bytes | Delta bytes (02 − 01) |
|---|---|---|---|
| 1 | 603,820 | 603,820 | +0 |
| 2 | 636,035 | 75,258 | −560,777 |
| 3 | 651,859 | 58,959 | −592,900 |
| 4 | 682,230 | 70,230 | −612,000 |
| 5 | 3,465,240 | 2,787,154 | −678,086 |
| 6 | 3,466,084 | 44,021 | −3,422,063 |

Both first requests have **603,820 bytes**. Each second request changes from **636,035 to 75,258 bytes** (-88.17%); call 3 changes from **651,859 to 58,959 bytes** (-90.96%). The fifth new request contains freshly captured plan images; the original repetitions request images at different points. Missing calls are shown as —, not zero.

## Timing differences

Means/medians use the two repetitions of each numbered measurement. **Delta = 02 − 01**; negative durations mean shorter observed wall time. Values are calculated from retained unrounded timestamps, then displayed to three decimals. The preserved original report rounds its printed values.

| Measurement | 01 original mean s | 02 new mean s | Delta s | Change |
|---|---|---|---|---|
| Page/library/assistant ready (recorded run start) | 5.701 | 5.593 | -0.107 | -1.89% |
| Shared reference acquisition inside turn (warm) | 0.018 | 0.015 | -0.003 | -15.08% |
| First model generated output (turn start) | 4.799 | 4.546 | -0.253 | -5.28% |
| First visible assistant text (turn start) | 25.413 | 19.272 | -6.141 | -24.17% |
| First successful kitchen create completed (turn start) | 45.365 | 30.815 | -14.550 | -32.07% |
| First successful kitchen create completed (recorded run start) | 51.275 | 36.570 | -14.706 | -28.68% |
| First successful kitchen create completed (subprocess start) | 51.484 | 36.788 | -14.696 | -28.55% |
| Create tool execution alone | 1.634 | 1.239 | -0.395 | -24.20% |
| Assistant turn start → answer complete | 75.305 | 53.601 | -21.703 | -28.82% |
| Time after the first kitchen until answer complete | 29.939 | 22.786 | -7.153 | -23.89% |
| Runner chat phase (includes image preparation/collection) | 75.537 | 53.791 | -21.746 | -28.79% |
| Post-chat context, images and saved snapshot | 8.631 | 5.448 | -3.183 | -36.88% |
| Recorded run: ready + chat + snapshot | 89.869 | 64.832 | -25.037 | -27.86% |
| Full subprocess: browser startup through launcher shutdown | 90.328 | 65.302 | -25.025 | -27.70% |
| Initial SKILL.md responses → first kitchen | 40.237 | 25.942 | -14.295 | -35.53% |
| All required skill files → first kitchen | 17.679 | 12.839 | -4.840 | -27.38% |

## Individual repetition milestones

Repetition indices identify observations within each measurement. These are separate sessions, not paired controlled trials.

| Repetition | 01 first kitchen s | 02 first kitchen s | Delta s | 01 turn s | 02 turn s | Delta s |
|---|---|---|---|---|---|---|
| 1 | 29.914 | 29.600 | -0.314 | 54.653 | 51.803 | -2.850 |
| 2 | 60.817 | 32.030 | -28.787 | 95.956 | 55.400 | -40.557 |

## Agent processing by comparable stage

The first three model decisions perform comparable work. Later decisions are grouped as post-create work because their tools/order differ. Model time includes the round trip and streamed response, not isolated compute.

| Stage | 01 original mean s | 02 new mean s | Delta s |
|---|---|---|---|
| Initial plan/skill discovery | 5.098 | 4.840 | -0.259 |
| Mandatory planning reference | 22.553 | 13.099 | -9.454 |
| Decide and emit the kitchen create | 16.038 | 11.598 | -4.440 |
| All model calls after creation | 29.297 | 22.174 | -7.123 |
| All model calls | 72.986 | 51.711 | -21.276 |
| All tool wall time | 2.280 | 1.866 | -0.414 |

## Per-repetition usage and transport totals

Totals here summarize the entire turn; the per-call byte comparison above is the primary transport table. “Not captured” is not zero.

| Report / repetition | Model calls | Request bytes (turn total) | Repeated input bytes (turn total) | Input tokens | Output tokens |
|---|---|---|---|---|---|
| 01 / 1 | 7 | 7,267,902 | Not captured | 632,050 | 1,101 |
| 01 / 2 | 6 | 9,505,268 | Not captured | 559,844 | 1,750 |
| 02 / 1 | 6 | 3,670,070 | 0 | 556,621 | 1,119 |
| 02 / 2 | 6 | 3,639,442 | 0 | 540,796 | 1,365 |

Mean uploaded bytes across a turn change from **8,386,585 to 3,654,756** (-56.42%). This is explicitly a turn total, separate from each call’s bytes. Earlier context still contributes model input tokens when using response chaining; an upload reduction alone does not establish a token-cost saving.

## Interpretation and limits

- The original report is retained unchanged as 01. All 01 values here come from its retained timing records; 02 values come only from candidate-1 and candidate-2.
- Same model/provider, prompt, original image, starting plan and local planner URL are used. Source versions, provider cache state, decisions, call counts and measurement times differ. This is an observed before/after comparison, not an isolated causal latency test.
- Original reference digests differ across its repetitions; both new digests match. Equal first-request byte counts do not establish equal request contents across all four conversations. No cold-cache equivalence is assumed.
- Continuations in 02 upload zero repeated serialized input-item bytes; stable tool schemas still accompany requests. The original capture does not supply this item-level counter.
- Each measurement retains two saved kitchens, one successful create per repetition, a 3,010 mm kitchen at the left wall and a disclosed failed backsplash calculation. Approximate finishes/fridge fronts and other article choices limit image fidelity.
- Two repetitions per version establish the shown observations and ranges; they do not establish p95 or a service-level expectation. No new model runs were made to correct these documents.

## Adding future results

Keep this comparison unnumbered. Give the next standalone measurement the next run number (03, then 04, and so on). Preserve earlier reports and add each result to the report registry, per-call request-byte tables, timing/stage tables and usage table here. Keep comparisons against original 01 visible and label any additional adjacent-run deltas explicitly. Record source versions, settings and missing counters for each added run; do not fill future measurements with estimates.
