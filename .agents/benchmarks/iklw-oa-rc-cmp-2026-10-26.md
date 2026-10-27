# image-kitchen-left-wall: benchmark comparison

| Field | Value |
|---|---|
| Type / updated / author | Benchmark comparison / 2026-10-27 / Codex; 04 added by Claude Code |
| Ticket | [RML-18303](https://roomle.atlassian.net/browse/RML-18303) |
| 01 — baseline | [Original measurement](01-iklw-oa-orig-2026-10-26.md) |
| 02 — response chaining | [Response-chaining measurement](02-iklw-oa-rc-2026-10-26.md) |
| 03 — response chaining + preloads | [Live-context and first-image guidance measurement](03-iklw-oa-rc-preloads-2026-10-26.md) |
| 04 — response chaining + JPEG images + renders when due | [Current performance changes measurement](04-iklw-oa-rc-jpg-due-2026-10-27.md) |
| Selected implementation | 02 behavior; rollback commit 432119f80; embedding dev 0.0.0-dev-432119f; 03's preloads rejected |
| Model / key reference | openai:gpt-6-astra / $OPENAI_ASSISTANT_API_KEY |
| Settings | Direct OpenAI Responses; provider-default reasoning; local planner :5173; embedding source from :3001 in 01–03, its published build 0.0.0-dev-130245d of the same source in 04; same exact prompt/image/starting plan; no suite suffix/pacing |
| Data / PDF | Raw captures in ignored .temp; the captures of 01–03 are no longer on disk; 04 data, scripts and PDFs in .temp/result/benchmark-04-iklw-oa-2026-10-27/ |

Affected repositories:

- **roomle-hi-example:** four independent reports, this unnumbered comparison and indexes.
- **roomle-ui:** measured assistant/provider transport, prompt preloads and planner/tool instructions; in 04 the JPEG plan images and the served text on when a render is due and on building a turn's changes on their results.

This is the single unnumbered comparison for the series. **01 remains the original baseline; 02 adds response chaining; 03 adds both prompt preloads to response chaining; 04 adds to 02's response chaining the JPEG plan images and the served text on when a render is due and on building a turn's changes on their results.** Each contains two independent repetitions. Earlier reports remain unchanged; the extra fresh-baseline experiment is not substituted for 01.

The 03 mean first-kitchen time is **29.974 s**, -2.73% against 02, while mean completed-turn time is **54.359 s**, 1.41% against 02. The turns use **8 calls each**, versus **6 each** in 02, and mean input rises from **548,708.5 to 730,936.5 tokens** (33.21%). These observations do **not** establish a completion-time improvement from preloading.

The 04 mean first-kitchen time is **29.661 s**, -3.74% against 02, and the mean completed turn **52.327 s**, -2.38% against 02. The upload per turn falls from **3,654,756 to 1,128,619 bytes** (-69.12%), because the request that carries the plan images shrinks from 2.79–2.82 MB to 0.23 MB, with 0.94–0.96 s instead of 2.9–3.2 s to its response headers. The turns use **7 calls each**: the agent renders the plan after its last change, in a round of its own, and mean input rises to **636,660.5 tokens** (16.03% above 02). Two repetitions do not establish an improvement beyond the run-to-run spread.

## Decision: discard 03's preloads and keep 02's behavior

The automatic live-context and first-image preloads are rejected. Their extra prompt/history/
presence lifecycle complicates the process without a demonstrated overall performance benefit.
The selected code is the response-chaining implementation measured in **02**; the rollback is
commit `432119f80` and embedding-lib dev `0.0.0-dev-432119f`, with the affected source/tests/fixture verified
byte-equivalent to `80484dc71`. See
[ADR 0015](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/keep-live-plan-state-and-image-guidance-on-demand.md)
and [the retained analysis](../feature-analysis/prompt-preloads.md#10-rejection-and-restoration-of-response-chaining-behavior--2026-10-26).

All 01/02/03 measurements, the call-sequence explanation and raw evidence remain intact.
**No additional benchmark is run for this restoration; there is no report 04.** Unit/wire tests,
the embedding build and offline package checks verify the restored implementation.

## Reports compared

| Report | Version | Repetitions | roomle-ui SHA | roomle-hi-example SHA at capture |
|---|---|---|---|---|
| [01 original](01-iklw-oa-orig-2026-10-26.md) | Full accumulated input | 2 | `6d088dde93908575229b02a8bdc2dd080f96c71e` | `d68a737a770481fd96776097c49412a7f3f4cd28` |
| [02 response chaining](02-iklw-oa-rc-2026-10-26.md) | Stored response ID + new tool outputs | 2 | `80484dc71e0889e24d3251e42090c1ff2eca10f7` | `5a5708d9577c766f7c87e4731f06aa8dc59bc4c0` |
| [03 chaining + preloads](03-iklw-oa-rc-preloads-2026-10-26.md) | Chaining + scoped live state + first-user-image guidance | 2 | `5426d65c4845ba1371de92e48b49f8bb58c8a6b8` | `9eeabb386a7ad617614adf192e1be921f9be2f9b` |
| [04 chaining + JPEG images + renders when due](04-iklw-oa-rc-jpg-due-2026-10-27.md) | Chaining + JPEG plan images + served text on renders and reads | 2 | `9577d925bff4bdc9adc0a7c8133c6d82597d1808` (feat/hi-mcp-merge; feat/hi-mcp-performance bbac39fa7 plus one planner file) | `048a54adc3184cbc59279400426e4c6cc6a9b36f` |

## Request bytes per model call

Each entry is **one HTTP request**, in uncompressed serialized UTF-8 JSON body bytes; turn totals are separate below. Call numbers identify sequence, not identical work. The first three decisions still discover kitchen main guidance, obtain its required reference, then create. Later verification tools/order differ. Missing calls are —, never zero.

### Repetition 1

| Model call | 01 original bytes | 02 chaining bytes | 03 preloads bytes | 02 − 01 bytes | 03 − 01 bytes | 03 − 02 bytes | 04 JPEG/due bytes | 04 − 01 bytes | 04 − 02 bytes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 603,820 | 603,820 | 615,365 | 0 | 11,545 | 11,545 | 604,199 | 379 | 379 |
| 2 | 636,035 | 75,258 | 63,742 | -560,777 | -572,293 | -11,516 | 75,439 | -560,596 | 181 |
| 3 | 651,859 | 58,959 | 58,888 | -592,900 | -592,971 | -71 | 59,140 | -592,719 | 181 |
| 4 | 680,920 | 70,271 | 69,442 | -610,649 | -611,478 | -829 | 70,591 | -610,329 | 320 |
| 5 | 681,983 | 2,817,741 | 44,254 | 2,135,758 | -637,729 | -2,773,487 | 46,437 | -635,546 | -2,771,304 |
| 6 | 682,740 | 44,021 | 43,950 | -638,719 | -638,790 | -71 | 44,202 | -638,538 | 181 |
| 7 | 3,330,545 | — | 45,348 | — | -3,285,197 | — | 227,979 | -3,102,566 | — |
| 8 | — | — | 2,781,737 | — | — | — | — | — | — |

### Repetition 2

| Model call | 01 original bytes | 02 chaining bytes | 03 preloads bytes | 02 − 01 bytes | 03 − 01 bytes | 03 − 02 bytes | 04 JPEG/due bytes | 04 − 01 bytes | 04 − 02 bytes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 603,820 | 603,820 | 615,365 | 0 | 11,545 | 11,545 | 604,199 | 379 | 379 |
| 2 | 636,035 | 75,258 | 63,742 | -560,777 | -572,293 | -11,516 | 75,439 | -560,596 | 181 |
| 3 | 651,859 | 58,959 | 58,888 | -592,900 | -592,971 | -71 | 59,140 | -592,719 | 181 |
| 4 | 682,230 | 70,230 | 69,442 | -612,000 | -612,788 | -788 | 72,239 | -609,991 | 2,009 |
| 5 | 3,465,240 | 2,787,154 | 44,254 | -678,086 | -3,420,986 | -2,742,900 | 46,437 | -3,418,803 | -2,740,717 |
| 6 | 3,466,084 | 44,021 | 43,950 | -3,422,063 | -3,422,134 | -71 | 44,202 | -3,421,882 | 181 |
| 7 | — | — | 45,348 | — | — | — | 227,595 | — | — |
| 8 | — | — | 2,689,805 | — | — | — | — | — | — |

First requests grow from **603,820 bytes** in 01/02 to **615,365 bytes** in 03. The new first request contains live state and served image guidance, plus revised supplied-state instructions/tool descriptions. Image-bearing verification requests occur at different call indices; larger bytes at a particular index do not establish regression in the same operation. In 04 the first request is **604,199 bytes**, 379 more than in 02 for the longer served text, and the images travel in call 7 as **227,979 / 227,595 bytes** of JPEG.

## Timing differences

Values are means of two repetitions, calculated from unrounded retained timestamps; the 04 deltas use the published means of 01–03, whose raw captures are no longer on disk. Duration deltas are seconds; negative means shorter observed time. Bootstrap in 03 includes live-state and conditional skill acquisition, so its scope differs from the earlier library-only acquisition.

| Measurement | 01 mean s | 02 mean s | 03 mean s | 02 − 01 s | 03 − 01 s | 03 − 02 s | 04 mean s | 04 − 01 s | 04 − 02 s |
|---|---|---|---|---|---|---|---|---|---|
| Page/library/assistant ready | 5.701 | 5.593 | 5.911 | -0.107 | 0.210 | 0.318 | 7.756 | 2.055 | 2.163 |
| Warm bootstrap/reference acquisition (scope above) | 0.018 | 0.015 | 0.020 | -0.003 | 0.002 | 0.005 | 0.015 | -0.003 | 0.000 |
| First generated output (turn start) | 4.799 | 4.546 | 3.859 | -0.253 | -0.939 | -0.686 | 4.576 | -0.223 | 0.030 |
| First visible text (turn start) | 25.413 | 19.272 | 22.321 | -6.141 | -3.092 | 3.049 | 14.822 | -10.591 | -4.450 |
| First successful kitchen complete (turn start) | 45.365 | 30.815 | 29.974 | -14.550 | -15.392 | -0.841 | 29.661 | -15.704 | -1.154 |
| First kitchen complete (recorded run start) | 51.275 | 36.570 | 36.083 | -14.706 | -15.193 | -0.487 | 37.588 | -13.687 | 1.018 |
| First kitchen complete (subprocess start) | 51.484 | 36.788 | 36.291 | -14.696 | -15.193 | -0.497 | 37.853 | -13.631 | 1.065 |
| Create tool alone | 1.634 | 1.239 | 1.690 | -0.395 | 0.056 | 0.452 | 2.120 | 0.486 | 0.881 |
| Assistant turn → answer complete | 75.305 | 53.601 | 54.359 | -21.703 | -20.946 | 0.757 | 52.327 | -22.979 | -1.274 |
| After first kitchen → answer complete | 29.939 | 22.786 | 24.385 | -7.153 | -5.554 | 1.599 | 22.665 | -7.274 | -0.121 |
| Runner chat phase | 75.537 | 53.791 | 54.581 | -21.746 | -20.956 | 0.789 | 53.025 | -22.513 | -0.766 |
| Post-chat context/images/snapshot | 8.631 | 5.448 | 6.000 | -3.183 | -2.631 | 0.552 | 4.822 | -3.809 | -0.626 |
| Recorded ready + chat + snapshot | 89.869 | 64.832 | 66.492 | -25.037 | -23.378 | 1.659 | 65.603 | -24.266 | 0.771 |
| Full subprocess | 90.328 | 65.302 | 66.946 | -25.025 | -23.381 | 1.643 | 66.115 | -24.213 | 0.813 |
| Initial main skill files → first kitchen | 40.237 | 25.942 | 25.544 | -14.295 | -14.693 | -0.398 | 24.818 | -15.419 | -1.124 |
| All required skill files → first kitchen | 17.679 | 12.839 | 14.523 | -4.840 | -3.156 | 1.684 | 12.637 | -5.042 | -0.202 |

| Measurement | 02 vs 01 | 03 vs 01 | 03 vs 02 | 04 vs 01 | 04 vs 02 |
|---|---|---|---|---|---|
| Page/library/assistant ready | -1.89% | 3.68% | 5.68% | 36.05% | 38.67% |
| Warm bootstrap/reference acquisition (scope above) | -15.08% | 10.34% | 29.93% | -18.89% | -2.67% |
| First generated output (turn start) | -5.28% | -19.58% | -15.10% | -4.64% | 0.67% |
| First visible text (turn start) | -24.17% | -12.17% | 15.82% | -41.68% | -23.09% |
| First successful kitchen complete (turn start) | -32.07% | -33.93% | -2.73% | -34.62% | -3.74% |
| First kitchen complete (recorded run start) | -28.68% | -29.63% | -1.33% | -26.69% | 2.78% |
| First kitchen complete (subprocess start) | -28.55% | -29.51% | -1.35% | -26.48% | 2.90% |
| Create tool alone | -24.20% | 3.45% | 36.48% | 29.76% | 71.12% |
| Assistant turn → answer complete | -28.82% | -27.81% | 1.41% | -30.51% | -2.38% |
| After first kitchen → answer complete | -23.89% | -18.55% | 7.02% | -24.30% | -0.53% |
| Runner chat phase | -28.79% | -27.74% | 1.47% | -29.80% | -1.42% |
| Post-chat context/images/snapshot | -36.88% | -30.48% | 10.13% | -44.13% | -11.48% |
| Recorded ready + chat + snapshot | -27.86% | -26.01% | 2.56% | -27.00% | 1.19% |
| Full subprocess | -27.70% | -25.89% | 2.52% | -26.81% | 1.24% |
| Initial main skill files → first kitchen | -35.53% | -36.52% | -1.54% | -38.32% | -4.33% |
| All required skill files → first kitchen | -27.38% | -17.85% | 13.11% | -28.52% | -1.57% |

## Individual repetition milestones

These are separate sessions, not paired controlled trials.

| Repetition | 01 kitchen s | 02 kitchen s | 03 kitchen s | 01 turn s | 02 turn s | 03 turn s | 04 kitchen s | 04 turn s |
|---|---|---|---|---|---|---|---|---|
| 1 | 29.914 | 29.600 | 31.849 | 54.653 | 51.803 | 55.708 | 30.062 | 52.969 |
| 2 | 60.817 | 32.030 | 28.099 | 95.956 | 55.400 | 53.009 | 29.261 | 51.684 |

## Agent processing by comparable stage

The initial stage in 03 requests only the kitchen main file because image guidance/live state are already supplied. The mandatory reference and create decisions remain. Post-create work is grouped by actual position after the create, rather than matching unrelated later call numbers. Model time includes provider round trip and streaming.

| Stage | 01 mean s | 02 mean s | 03 mean s | 03 − 01 s | 03 − 02 s | 04 mean s | 04 − 01 s | 04 − 02 s |
|---|---|---|---|---|---|---|---|---|
| Initial plan/skill discovery | 5.098 | 4.840 | 4.404 | -0.694 | -0.436 | 4.817 | -0.281 | -0.023 |
| Mandatory planning reference | 22.553 | 13.099 | 11.019 | -11.534 | -2.080 | 12.178 | -10.375 | -0.921 |
| Decide and emit kitchen create | 16.038 | 11.598 | 12.831 | -3.207 | 1.233 | 10.514 | -5.524 | -1.084 |
| All model calls after creation | 29.297 | 22.174 | 23.736 | -5.562 | 1.562 | 22.069 | -7.228 | -0.105 |
| All model calls | 72.986 | 51.711 | 51.989 | -20.997 | 0.278 | 49.578 | -23.408 | -2.133 |
| All tool wall time including bootstrap | 2.280 | 1.866 | 2.345 | 0.066 | 0.479 | 2.724 | 0.444 | 0.858 |

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
| 4 / 1 | 7 | 1,127,987 | 0 | 635,788 | 1,416 |
| 4 / 2 | 7 | 1,129,251 | 0 | 637,533 | 1,481 |

Mean turn uploads: **8,386,585 → 3,654,756 → 3,676,760 → 1,128,619 bytes** (01 → 02 → 03 → 04). 03 changes by -56.16% against 01 and 0.60% against 02; 04 by -86.54% against 01 and -69.12% against 02. Chained continuations in 02/03 upload zero repeated serialized input-item bytes; stable tool schemas are still present. Earlier context still contributes input usage. Smaller uploads establish neither lower token cost nor isolated model compute savings.

## Why model calls increase from six to eight

Both repetitions follow the sequence below. One row is one model request; several tools in a row
are requested together, so removing one tool from that row does not remove the model request.

| Model call | 02 response chaining | 03 response chaining + preloads | 04 response chaining + JPEG images + renders when due |
|---|---|---|---|
| Before inference | Compact library preload | Compact library/live-context preload and image-skill preload | Compact library preload |
| 1 | Initial live context + image skill + kitchen skill | Kitchen skill | Initial live context + image skill + kitchen skill |
| 2 | Kitchen planning reference | Kitchen planning reference | Kitchen planning reference |
| 3 | Create kitchen | Create kitchen | Create kitchen |
| 4 | Backsplash attribute lookup + plan images + current context | Backsplash attribute lookup | Backsplash attribute lookup + current context: obstacles only |
| 5 | Enable backsplash (library calculation fails) | Enable backsplash (library calculation fails) | Enable backsplash (library calculation fails) |
| 6 | Final answer | Current context: obstacles only | Plan images (JPEG) |
| 7 | — | Plan images | Final answer |
| 8 | — | Final answer | — |

The preload removes the initial model-requested context/image-skill tools, but call 1 still needs
the applicable kitchen skill. That skill's `SKILL.md:14` requests its planning reference before
numerical guidance or installation-risk review, accounting for call 2. Creation therefore stays
at call 3. The observed two-call increase comes entirely from the later reads occupying separate
model requests rather than sharing call 4. This is not an HTTP retry or a failed preload.
02 captures images/context before the backsplash enable attempt; 03 captures them afterwards.
Batching future verification reads should respect the last relevant write, rather than depend on
that write failing and leaving earlier images valid.

The later obstacle read follows creation and the failed backsplash attempt; it is not a repeated
initial read before creation. The initial obstacle snapshot describes the starting scene, while
creation adds group geometry. The system prompt asks for missing/stale sections and confirmed
write results, and the create-tool description supplies positions, footprints and collision hints.
The retained captures do not include the complete create result/hint, so they cannot establish
that the later obstacle read was necessary, or why the model did not batch independent reads.
They establish the sequence and count, not a deterministic causal effect of preloading.

The remaining optimization targets are the skill/reference dependency and the verification
instructions/API: reuse sufficient confirmed write feedback and request remaining independent
reads together. A context preload alone cannot remove a round that still has another prerequisite.
No new model runs or productive-code changes are used for this explanation.

04 makes seven calls. Calls 1–3 are those of 02. Call 4 batches the backsplash attribute lookup with
a read of the obstacles only: the create result carries the groups, the obstacles it does not.
The plan images move behind the backsplash enable, into call 6, as in 03: the served text names the
comparison of a planning from an image with that image as an occasion of a render, and the agent
renders after its last change, so the images show the final state. That round costs 5.701 / 6.936 s;
the JPEG images save about 2 s on the response headers of the request that carries them and most of
its upload. Batching the render with the lookup, as in 02, would save the round but show a state the
next write changes. The text kitchens, where the served text expects no render, are not part of
this test.

## Interpretation and limits

- 01/02 reports and their original measurements remain intact. All 01 numbers come from its retained original records; 02 uses candidate-1/candidate-2 only. The separate fresh-baseline experiment is excluded.
- 03 supplies the image main file and current plan before inference, and neither is redundantly requested as an initial read. Kitchen main guidance and its reference still require two decisions. The first create remains model decision 3 in all versions.
- Post-create work in 03 is sequential: attribute discovery, failed backsplash enable, obstacle read, images, final answer. In 02 some reads/images run together. Both 03 turns use eight model calls rather than six. This is an observed tool-choice/order difference, not proof that preloads inherently cause it. No overall turn-time benefit is established.
- Same direct model/provider, exact prompt, original image, starting plan and local runtime origins are used. Source versions, model decisions, tool descriptions, measurement times and provider cache state differ. Equal lengths do not establish identical content. Original reference digests differ across its repetitions; each later report has its own measured reference identity. No cold-cache equivalence is assumed.
- All six saved plans have a 3,010 mm kitchen centred on the left wall and disclose the failed backsplash calculation. 03 uses a general storage unit beside the sink where 02 uses an integrated dishwasher; 03's two wood finishes also differ. Approximate appliance/front/finish matches limit image fidelity and make outcomes nonidentical.
- The large-plan offline probe in 03 measures a synthetic 100-group snapshot of about 2.28 MB, with no model request. It establishes serialization/input overhead, not provider latency for a physically loaded large scene.
- Two repetitions per version establish observations and ranges, not p95, service levels or isolated causal latency savings. Individual preload contributions require a separately scoped four-variant experiment.
- 04 measures roomle-ui 9577d925b on `feat/hi-mcp-merge`, which differs from `feat/hi-mcp-performance` in one planner file, with the published embedding-lib build of the same source; its hooks were rebuilt, because the collector of 01–03 is no longer on disk. Run 1 found no cached prefix, run 2 a warm one.
- In 04 the create tool takes 2.093 / 2.147 s, against 1.215 / 1.262 s in 02, while the planner's own price refresh runs alongside the create's planner operation. 01–03 did not time that refresh, so its share in their create times is unknown; the cause of the slower create is not established.
- Both saved 04 plans hold the 3,010 mm kitchen of 03 centred on the left wall, with the same nine articles, and disclose the backsplash the library cannot calculate (Error 14034).

## Adding future results

Keep this comparison unnumbered and preserve original baseline 01. Add the next standalone measurement as 05, with its own settings, source SHAs, evidence and two valid repetitions. Extend per-call bytes, timing/stage, usage and quality tables here with actual values; preserve missing counters as unknown. Compare against 01 and explicitly label adjacent-run deltas. Raw captures and final-report PDFs stay in .temp.
