# image-kitchen-left-wall: benchmark comparison

| Field | Value |
|---|---|
| Type / updated / author | Benchmark comparison / 2026-10-26 / Codex |
| Ticket | [RML-18303](https://roomle.atlassian.net/browse/RML-18303) |
| 01 — baseline | [Original measurement](01-iklw-oa-orig-2026-10-26.md) |
| 02 — response chaining | [Response-chaining measurement](02-iklw-oa-rc-2026-10-26.md) |
| 03 — response chaining + preloads | [Live-context and first-image guidance measurement](03-iklw-oa-rc-preloads-2026-10-26.md) |
| Model / key reference | openai:gpt-6-astra / $OPENAI_ASSISTANT_API_KEY |
| Settings | Direct OpenAI Responses; provider-default reasoning; local planner :5173 and embedding source :3001; same exact prompt/image/starting plan; no suite suffix/pacing |
| Data / PDF | Raw captures remain in ignored .temp; 03 data in .temp/result/prompt-preloads-2026-10-26/; updated comparison PDF in .temp/prompt-preloads-implementation/ |

Affected repositories:

- **roomle-hi-example:** three independent reports, this unnumbered comparison and indexes.
- **roomle-ui:** measured assistant/provider transport, prompt preloads and planner/tool instructions.

This is the single unnumbered comparison for the series. **01 remains the original baseline; 02 adds response chaining; 03 adds both prompt preloads to response chaining.** Each contains two independent repetitions. Earlier reports remain unchanged; the extra fresh-baseline experiment is not substituted for 01.

The 03 mean first-kitchen time is **29.974 s**, -2.73% against 02, while mean completed-turn time is **54.359 s**, 1.41% against 02. The turns use **8 calls each**, versus **6 each** in 02, and mean input rises from **548,708.5 to 730,936.5 tokens** (33.21%). These observations do **not** establish a completion-time improvement from preloading.

## Reports compared

| Report | Version | Repetitions | roomle-ui SHA | roomle-hi-example SHA at capture |
|---|---|---|---|---|
| [01 original](01-iklw-oa-orig-2026-10-26.md) | Full accumulated input | 2 | 6d088dde93908575229b02a8bdc2dd080f96c71e | d68a737a770481fd96776097c49412a7f3f4cd28 |
| [02 response chaining](02-iklw-oa-rc-2026-10-26.md) | Stored response ID + new tool outputs | 2 | 80484dc71e0889e24d3251e42090c1ff2eca10f7 | 5a5708d9577c766f7c87e4731f06aa8dc59bc4c0 |
| [03 chaining + preloads](03-iklw-oa-rc-preloads-2026-10-26.md) | Chaining + scoped live state + first-user-image guidance | 2 | 5426d65c4845ba1371de92e48b49f8bb58c8a6b8 | 9eeabb386a7ad617614adf192e1be921f9be2f9b |

## Request bytes per model call

Each entry is **one HTTP request**, in uncompressed serialized UTF-8 JSON body bytes; turn totals are separate below. Call numbers identify sequence, not identical work. The first three decisions still discover kitchen main guidance, obtain its required reference, then create. Later verification tools/order differ. Missing calls are —, never zero.

### Repetition 1

| Model call | 01 original bytes | 02 chaining bytes | 03 preloads bytes | 02 − 01 bytes | 03 − 01 bytes | 03 − 02 bytes |
|---|---|---|---|---|---|---|
| 1 | 603,820 | 603,820 | 615,365 | 0 | 11,545 | 11,545 |
| 2 | 636,035 | 75,258 | 63,742 | -560,777 | -572,293 | -11,516 |
| 3 | 651,859 | 58,959 | 58,888 | -592,900 | -592,971 | -71 |
| 4 | 680,920 | 70,271 | 69,442 | -610,649 | -611,478 | -829 |
| 5 | 681,983 | 2,817,741 | 44,254 | 2,135,758 | -637,729 | -2,773,487 |
| 6 | 682,740 | 44,021 | 43,950 | -638,719 | -638,790 | -71 |
| 7 | 3,330,545 | — | 45,348 | — | -3,285,197 | — |
| 8 | — | — | 2,781,737 | — | — | — |

### Repetition 2

| Model call | 01 original bytes | 02 chaining bytes | 03 preloads bytes | 02 − 01 bytes | 03 − 01 bytes | 03 − 02 bytes |
|---|---|---|---|---|---|---|
| 1 | 603,820 | 603,820 | 615,365 | 0 | 11,545 | 11,545 |
| 2 | 636,035 | 75,258 | 63,742 | -560,777 | -572,293 | -11,516 |
| 3 | 651,859 | 58,959 | 58,888 | -592,900 | -592,971 | -71 |
| 4 | 682,230 | 70,230 | 69,442 | -612,000 | -612,788 | -788 |
| 5 | 3,465,240 | 2,787,154 | 44,254 | -678,086 | -3,420,986 | -2,742,900 |
| 6 | 3,466,084 | 44,021 | 43,950 | -3,422,063 | -3,422,134 | -71 |
| 7 | — | — | 45,348 | — | — | — |
| 8 | — | — | 2,689,805 | — | — | — |

First requests grow from **603,820 bytes** in 01/02 to **615,365 bytes** in 03. The new first request contains live state and served image guidance, plus revised supplied-state instructions/tool descriptions. Image-bearing verification requests occur at different call indices; larger bytes at a particular index do not establish regression in the same operation.

## Timing differences

Values are means of two repetitions, calculated from unrounded retained timestamps. Duration deltas are seconds; negative means shorter observed time. Bootstrap in 03 includes live-state and conditional skill acquisition, so its scope differs from the earlier library-only acquisition.

| Measurement | 01 mean s | 02 mean s | 03 mean s | 02 − 01 s | 03 − 01 s | 03 − 02 s |
|---|---|---|---|---|---|---|
| Page/library/assistant ready | 5.701 | 5.593 | 5.911 | -0.107 | 0.210 | 0.318 |
| Warm bootstrap/reference acquisition (scope above) | 0.018 | 0.015 | 0.020 | -0.003 | 0.002 | 0.005 |
| First generated output (turn start) | 4.799 | 4.546 | 3.859 | -0.253 | -0.939 | -0.686 |
| First visible text (turn start) | 25.413 | 19.272 | 22.321 | -6.141 | -3.092 | 3.049 |
| First successful kitchen complete (turn start) | 45.365 | 30.815 | 29.974 | -14.550 | -15.392 | -0.841 |
| First kitchen complete (recorded run start) | 51.275 | 36.570 | 36.083 | -14.706 | -15.193 | -0.487 |
| First kitchen complete (subprocess start) | 51.484 | 36.788 | 36.291 | -14.696 | -15.193 | -0.497 |
| Create tool alone | 1.634 | 1.239 | 1.690 | -0.395 | 0.056 | 0.452 |
| Assistant turn → answer complete | 75.305 | 53.601 | 54.359 | -21.703 | -20.946 | 0.757 |
| After first kitchen → answer complete | 29.939 | 22.786 | 24.385 | -7.153 | -5.554 | 1.599 |
| Runner chat phase | 75.537 | 53.791 | 54.581 | -21.746 | -20.956 | 0.789 |
| Post-chat context/images/snapshot | 8.631 | 5.448 | 6.000 | -3.183 | -2.631 | 0.552 |
| Recorded ready + chat + snapshot | 89.869 | 64.832 | 66.492 | -25.037 | -23.378 | 1.659 |
| Full subprocess | 90.328 | 65.302 | 66.946 | -25.025 | -23.381 | 1.643 |
| Initial main skill files → first kitchen | 40.237 | 25.942 | 25.544 | -14.295 | -14.693 | -0.398 |
| All required skill files → first kitchen | 17.679 | 12.839 | 14.523 | -4.840 | -3.156 | 1.684 |

| Measurement | 02 vs 01 | 03 vs 01 | 03 vs 02 |
|---|---|---|---|
| Page/library/assistant ready | -1.89% | 3.68% | 5.68% |
| Warm bootstrap/reference acquisition (scope above) | -15.08% | 10.34% | 29.93% |
| First generated output (turn start) | -5.28% | -19.58% | -15.10% |
| First visible text (turn start) | -24.17% | -12.17% | 15.82% |
| First successful kitchen complete (turn start) | -32.07% | -33.93% | -2.73% |
| First kitchen complete (recorded run start) | -28.68% | -29.63% | -1.33% |
| First kitchen complete (subprocess start) | -28.55% | -29.51% | -1.35% |
| Create tool alone | -24.20% | 3.45% | 36.48% |
| Assistant turn → answer complete | -28.82% | -27.81% | 1.41% |
| After first kitchen → answer complete | -23.89% | -18.55% | 7.02% |
| Runner chat phase | -28.79% | -27.74% | 1.47% |
| Post-chat context/images/snapshot | -36.88% | -30.48% | 10.13% |
| Recorded ready + chat + snapshot | -27.86% | -26.01% | 2.56% |
| Full subprocess | -27.70% | -25.89% | 2.52% |
| Initial main skill files → first kitchen | -35.53% | -36.52% | -1.54% |
| All required skill files → first kitchen | -27.38% | -17.85% | 13.11% |

## Individual repetition milestones

These are separate sessions, not paired controlled trials.

| Repetition | 01 kitchen s | 02 kitchen s | 03 kitchen s | 01 turn s | 02 turn s | 03 turn s |
|---|---|---|---|---|---|---|
| 1 | 29.914 | 29.600 | 31.849 | 54.653 | 51.803 | 55.708 |
| 2 | 60.817 | 32.030 | 28.099 | 95.956 | 55.400 | 53.009 |

## Agent processing by comparable stage

The initial stage in 03 requests only the kitchen main file because image guidance/live state are already supplied. The mandatory reference and create decisions remain. Post-create work is grouped by actual position after the create, rather than matching unrelated later call numbers. Model time includes provider round trip and streaming.

| Stage | 01 mean s | 02 mean s | 03 mean s | 03 − 01 s | 03 − 02 s |
|---|---|---|---|---|---|
| Initial plan/skill discovery | 5.098 | 4.840 | 4.404 | -0.694 | -0.436 |
| Mandatory planning reference | 22.553 | 13.099 | 11.019 | -11.534 | -2.080 |
| Decide and emit kitchen create | 16.038 | 11.598 | 12.831 | -3.207 | 1.233 |
| All model calls after creation | 29.297 | 22.174 | 23.736 | -5.562 | 1.562 |
| All model calls | 72.986 | 51.711 | 51.989 | -20.997 | 0.278 |
| All tool wall time including bootstrap | 2.280 | 1.866 | 2.345 | 0.066 | 0.479 |

## Per-repetition usage and transport totals

These are whole-turn totals. Not captured is not zero.

| Report / repetition | Model calls | Request bytes (turn total) | Repeated input bytes (turn total) | Input tokens | Output tokens |
|---|---|---|---|---|---|
| 1 / 1 | 7 | 7,267,902 | Not captured | 632,050 | 1,101 |
| 1 / 2 | 6 | 9,505,268 | Not captured | 559,844 | 1,750 |
| 2 / 1 | 6 | 3,670,070 | 0 | 556,621 | 1,119 |
| 2 / 2 | 6 | 3,639,442 | 0 | 540,796 | 1,365 |
| 3 / 1 | 8 | 3,722,726 | 0 | 730,962 | 1,163 |
| 3 / 2 | 8 | 3,630,794 | 0 | 730,911 | 1,166 |

Mean turn uploads: **8,386,585 → 3,654,756 → 3,676,760 bytes** (01 → 02 → 03). 03 changes by -56.16% against 01 and 0.60% against 02. Chained continuations in 02/03 upload zero repeated serialized input-item bytes; stable tool schemas are still present. Earlier context still contributes input usage. Smaller uploads establish neither lower token cost nor isolated model compute savings.

## Interpretation and limits

- 01/02 reports and their original measurements remain intact. All 01 numbers come from its retained original records; 02 uses candidate-1/candidate-2 only. The separate fresh-baseline experiment is excluded.
- 03 supplies the image main file and current plan before inference, and neither is redundantly requested as an initial read. Kitchen main guidance and its reference still require two decisions. The first create remains model decision 3 in all versions.
- Post-create work in 03 is sequential: attribute discovery, failed backsplash enable, obstacle read, images, final answer. In 02 some reads/images run together. Both 03 turns use eight model calls rather than six. This is an observed tool-choice/order difference, not proof that preloads inherently cause it. No overall turn-time benefit is established.
- Same direct model/provider, exact prompt, original image, starting plan and local runtime origins are used. Source versions, model decisions, tool descriptions, measurement times and provider cache state differ. Equal lengths do not establish identical content. Original reference digests differ across its repetitions; each later report has its own measured reference identity. No cold-cache equivalence is assumed.
- All six saved plans have a 3,010 mm kitchen centred on the left wall and disclose the failed backsplash calculation. 03 uses a general storage unit beside the sink where 02 uses an integrated dishwasher; 03's two wood finishes also differ. Approximate appliance/front/finish matches limit image fidelity and make outcomes nonidentical.
- The large-plan offline probe in 03 measures a synthetic 100-group snapshot of about 2.28 MB, with no model request. It establishes serialization/input overhead, not provider latency for a physically loaded large scene.
- Two repetitions per version establish observations and ranges, not p95, service levels or isolated causal latency savings. Individual preload contributions require a separately scoped four-variant experiment.

## Adding future results

Keep this comparison unnumbered and preserve original baseline 01. Add the next standalone measurement as 04, with its own settings, source SHAs, evidence and two valid repetitions. Extend per-call bytes, timing/stage, usage and quality tables here with actual values; preserve missing counters as unknown. Compare against 01 and explicitly label adjacent-run deltas. Raw captures and final-report PDFs stay in .temp.
