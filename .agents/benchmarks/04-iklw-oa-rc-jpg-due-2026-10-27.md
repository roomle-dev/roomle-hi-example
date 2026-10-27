# image-kitchen-left-wall: detailed OpenAI Astra timing — response chaining, JPEG plan images and renders when due

| Field | Value |
|---|---|
| Type / domain | Benchmark / HI Planning Assistant |
| Trigger | Repeat image-kitchen-left-wall with the current performance changes; RML-18303 |
| Date / author | 2026-10-27 / Claude Code |
| Status | Measured: two completed turns, two saved plans |
| Ticket | [RML-18303](https://roomle.atlassian.net/browse/RML-18303) |
| Data | Raw captures in ignored `.temp/result/benchmark-04-iklw-oa-2026-10-27/rep-1` and `rep-2`; manifest, timing runner, hook check and derivation scripts in the same folder |
| Repeat | Same fixture and direct OpenAI provider, local planner; procedure below |
| PDF | `.temp/result/benchmark-04-iklw-oa-2026-10-27/04-iklw-oa-rc-jpg-due-2026-10-27.pdf` |

Affected repositories:

- **roomle-ui:** the planner measured, `feat/hi-mcp-merge` at 9577d925b — `feat/hi-mcp-performance` at bbac39fa7 with the response chaining of 02, the JPEG plan images (43eda3a47) and the served text on when a render is due and on building a turn's changes on their results (bbac39fa7), plus one planner file of the merge branch.
- **roomle-hi-example:** this report, the indexes and the [comparison](iklw-oa-rc-cmp-2026-10-26.md).

## Executive summary

First successful kitchen creation completed in **30.062 / 29.261 s** from assistant turn start; mean **29.661 s**. Complete turns took **52.969 / 51.684 s**; mean **52.327 s**. Both turns used **7 model calls**.

Against report 02, the selected response-chaining implementation, the mean first kitchen is **-1.154 s** (-3.74 %) and the mean turn **-1.274 s** (-2.38 %). The upload per turn falls from 3,654,756 to **1,128,619 bytes** (-69.12 %): the plan images are JPEG, and the request that carries them is **227,979 / 227,595 bytes with 0.956 / 0.940 s to its response headers**, against 2.79–2.82 MB and 2.9–3.2 s in 02. The turn makes one model call more than 02: the agent renders the plan after its backsplash attempt, in a round of its own. Mean input is **636,660.5 tokens**, 16.03 % above 02. Two repetitions show these differences; they do not establish an improvement beyond the run-to-run spread.

## What was asked and run

Test: **image-kitchen-left-wall**, from [docs/test-prompts.json](../../docs/test-prompts.json).

> create a kitchen like the one in the image on the left-hand wall of the room

Image: [kitchen-1.png](../../docs/images/kitchen-1.png), SHA-256 07a3fe7a8cb1f57f392f356cc52b8a2af78afe9e2ec4fe6e88a9a13e8b3b3d95. Starting plan: **ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv**, default-room. Two fresh browsers and conversations sent this exact prompt and the original image. The suite suffix was omitted; no random cases, pacing or paid warm-ups were added.

| Setting | Measured value |
|---|---|
| Model CLI / key reference | openai:gpt-6-astra / $OPENAI_ASSISTANT_API_KEY; no resolved credentials in artifacts |
| Endpoint / reasoning | https://api.openai.com/v1/responses / provider default |
| Planner | http://localhost:5173/, the user's dev server of the roomle-ui checkout |
| roomle-ui SHA | 9577d925b on `feat/hi-mcp-merge`, unchanged through both runs; it differs from `feat/hi-mcp-performance` (bbac39fa7) in `planner-kernel-access.ts` only, the level override of the wall water connection |
| Embedding-lib | Published `@roomle/embedding-lib@0.0.0-dev-130245d` from jsDelivr, as the example pins it; its source equals `packages/embedding-lib/src` of the measured checkout. Reports 01–03 loaded the same source from a local server on :3001 |
| Example | http://localhost:3103/ |
| roomle-hi-example SHA | 048a54a on `feat/hi-mcp-performance` |
| Node / Chromium | Node v23.5.0; Playwright 1.55.0 bundled Chromium, headless with `--enable-gpu` |
| First-call cache reads | 0 / 77,268 tokens; run 1 found no cached prefix, run 2 a warm one |
| Transport | Responses chaining; full first request, stored provider response plus new tool outputs thereafter |

## How it was measured

The raw captures and the collector of reports 01–03 are no longer on disk, so the hooks were rebuilt after [the timing skill](../skills/hi-mcp-timing-benchmark.md): a copy of the [prompt runner](../scripts/run-hi-mcp-prompt.js) with absolute imports adds init scripts and two wrappers, and keeps every normal run file. In the example page, the hook marks every `/v1/responses` fetch (start, response headers, the end of the stream read through a clone, request bytes), the tool bridge `callExternalObjectAgentTool` (start, end, result bytes) and the window output. In the planner frame, it wraps the seven planner methods of `window.RoomlePlanner`, the instance the tool set calls, and timestamps the `[hi-mcp]` log lines. Turn start and end are taken around `onPlanningAssistantPrompt`. All marks are `performance.timeOrigin + performance.now()`. No response routing is used, so the browser's HTTP cache works as usual.

A hook check before the paid runs sent the same turn with an invalid key: the bootstrap tool, its planner call and the log lines were timed, and the one model request was rejected with HTTP 401, without inference. Its request bytes equal the assistant's own measurement.

Both paid repetitions completed without provider or chat errors, retries or snapshot failures; no repetition is excluded. The backsplash calculation failure is tool feedback, separate from chat success.

## How to read the step deltas

Start/End are seconds relative to the assistant turn start. Delta is elapsed time, rounded to three decimals; the elapsed-ms columns keep short calls. A model call ends when its response stream ends, measured through the clone; its start is that end minus the SDK's response duration, so the start is derived. It lies 1–57 ms before the fetch start, the time the SDK takes to build the request. Model duration includes transport, provider work and streaming. Tool wall time is the union of parallel intervals. A nested planner call belongs to the tool of the last `[hi-mcp] tool` line before its own `[hi-mcp] call` line in the planner frame. Planner calls without such a line are the planner's own price refresh after a plan change, listed apart. Runner start follows browser launch; subprocess time includes launch and shutdown.

### From skills to the first kitchen

Initial skills complete when the image-planning and kitchen-planning SKILL.md files of the first round are back; the mandatory planning reference is the second milestone.

| Milestone / interval | Run 1 s | Run 2 s |
|---|---|---|
| Initial image/kitchen SKILL.md complete (timestamp) | 5.359 | 4.327 |
| Last required reference complete (timestamp) | 16.938 | 17.110 |
| First create starts (timestamp) | 27.969 | 27.114 |
| First create completes (timestamp) | 30.062 | 29.261 |
| Initial main files → kitchen complete (delta) | 24.703 | 24.933 |
| All required files → kitchen complete (delta) | 13.124 | 12.150 |
| Model time in last interval | 11.028 | 10.000 |
| Create tool delta | 2.093 | 2.147 |
| Local remainder in last interval | 0.003 | 0.003 |

## Results: milestones and total time

| Measurement (seconds) | Run 1 | Run 2 | Mean |
|---|---|---|---|
| Page/library/assistant ready (recorded run start) | 4.945 | 10.567 | 7.756 |
| Warm bootstrap/reference acquisition | 0.015 | 0.015 | 0.015 |
| First model output (turn start) | 5.200 | 3.952 | 4.576 |
| First visible text (turn start) | 14.730 | 14.914 | 14.822 |
| First kitchen completed (turn start) | 30.062 | 29.261 | 29.661 |
| First kitchen completed (recorded run start) | 35.167 | 40.008 | 37.588 |
| First kitchen completed (subprocess start) | 35.400 | 40.306 | 37.853 |
| Create tool alone | 2.093 | 2.147 | 2.120 |
| Turn start → answer complete | 52.969 | 51.684 | 52.327 |
| After first kitchen → answer complete | 22.907 | 22.423 | 22.665 |
| Runner chat phase | 53.651 | 52.398 | 53.025 |
| Post-chat context/images/snapshot | 4.906 | 4.739 | 4.822 |
| Recorded ready + chat + snapshot | 63.502 | 67.704 | 65.603 |
| Full subprocess | 63.983 | 68.247 | 66.115 |

The runner's first plan change, the planner history event of the create measured from the runner's own turn start, is 30.069 / 29.269 s, within 8 ms of the create tool's end.

## Results: where the assistant turn goes

| Component | Run 1 s | Run 1 share | Run 2 s | Run 2 share |
|---|---|---|---|---|
| Model calls (union) | 50.255 | 94.88% | 48.901 | 94.62% |
| Tools including bootstrap (union) | 2.691 | 5.08% | 2.757 | 5.33% |
| Model/tool overlap (subtract once) | 0.000 | 0.00% | 0.000 | 0.00% |
| Other client work/gaps | 0.023 | 0.04% | 0.026 | 0.05% |
| Assistant turn | 52.969 | 100.00% | 51.684 | 100.00% |

## Results: model, tools and planner calls in order

### Run 1

Recorded start: 2026-10-27T10:06:06.707Z; direct OpenAI Responses.

**Agent steps — duration per decision and tool execution**

| Step | Following tools/work | Start s | End s | Agent/model delta s | Tools delta s | Total step delta s |
|---|---|---|---|---|---|---|
| 1 | get-plan-context; get-skill (image-planning); get-skill (kitchen-planning) | 0.020 | 5.359 | 5.335 | 0.004 | 5.339 |
| 2 | get-skill (kitchen-planning / references/planning-reference.md) | 5.361 | 16.938 | 11.575 | 0.001 | 11.577 |
| 3 | create-or-replace-groups | 16.940 | 30.062 | 11.028 | 2.093 | 13.122 |
| 4 | find-attributes; get-plan-context | 30.063 | 34.128 | 4.044 | 0.021 | 4.065 |
| 5 | change-group-attribute | 34.129 | 37.331 | 3.068 | 0.133 | 3.202 |
| 6 | get-plan-images | 37.331 | 43.462 | 5.701 | 0.429 | 6.131 |
| 7 | Final answer | 43.464 | 52.969 | 9.504 | 0.000 | 9.505 |

| Call | SDK start s | End s | Delta s (model) | First output s | Remaining s | Input tokens | Output / reasoning | Request bytes | Tools after model |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.020 | 5.354 | 5.335 | 5.180 | 0.154 | 77,271 | 79 / 0 | 604,199 | #2 get-plan-context, #3 get-skill, #4 get-skill |
| 2 | 5.361 | 16.936 | 11.575 | 9.368 | 2.207 | 84,140 | 287 / 190 | 75,439 | #5 get-skill |
| 3 | 16.940 | 27.968 | 11.028 | 7.482 | 3.547 | 87,471 | 666 / 151 | 59,140 | #6 create-or-replace-groups |
| 4 | 30.063 | 34.107 | 4.044 | 3.698 | 0.346 | 95,175 | 77 / 22 | 70,591 | #7 find-attributes, #8 get-plan-context |
| 5 | 34.129 | 37.197 | 3.068 | 2.534 | 0.534 | 96,261 | 57 / 0 | 46,437 | #9 change-group-attribute |
| 6 | 37.331 | 43.032 | 5.701 | 3.799 | 1.903 | 96,458 | 130 / 32 | 44,202 | #10 get-plan-images |
| 7 | 43.464 | 52.967 | 9.504 | 7.247 | 2.257 | 99,012 | 120 / 0 | 227,979 | Final answer |

| Call | Tool / requested information | Start s | End s | Delta s (tool) | Elapsed ms | Nested planner ms | Remaining ms | Result bytes | Outcome |
|---|---|---|---|---|---|---|---|---|---|
| 1 | get-plan-context: articles, attributes | 0.000 | 0.011 | 0.011 | 10.6 | 5.5 | 5.1 | 270,617 | OK |
| 2 | get-plan-context: rooms, groups, obstacles, installationElements | 5.355 | 5.359 | 0.004 | 3.7 | 2.3 | 1.4 | 5,631 | OK |
| 3 | get-skill: image-planning / SKILL.md | 5.355 | 5.359 | 0.004 | 3.7 | 0.0 | 3.7 | 5,658 | OK |
| 4 | get-skill: kitchen-planning / SKILL.md | 5.355 | 5.359 | 0.004 | 3.8 | 0.0 | 3.8 | 20,247 | OK |
| 5 | get-skill: kitchen-planning / references/planning-reference.md | 16.937 | 16.938 | 0.001 | 0.8 | 0.0 | 0.8 | 15,393 | OK |
| 6 | create-or-replace-groups: 1 group, 9 roots; placement left / center | 27.969 | 30.062 | 2.093 | 2093.4 | 1902.9 | 190.5 | 26,844 | OK |
| 7 | find-attributes: Create backsplash | 34.107 | 34.128 | 0.021 | 20.5 | 11.5 | 9.0 | 759 | OK |
| 8 | get-plan-context: obstacles | 34.108 | 34.128 | 0.021 | 20.5 | 3.9 | 16.6 | 1,853 | OK |
| 9 | change-group-attribute: mod_CreateBacksplash=true | 37.198 | 37.331 | 0.133 | 132.6 | 126.8 | 5.8 | 470 | Tool error |
| 10 | get-plan-images | 43.033 | 43.462 | 0.429 | 428.8 | 407.8 | 21.0 | 184,212 | OK |

| Call | Parent tool | Planner method / arguments | Start s | End s | Delta s (planner) | Elapsed ms |
|---|---|---|---|---|---|---|
| 1 | 1 | getExternalObjectLibraryContext [["articles", "masterData"]] | 0.002 | 0.007 | 0.005 | 5.5 |
| 2 | 2 | getExternalObjectPlanContext [["rooms", "groups", "obstacles", "installationElements"]] | 5.356 | 5.358 | 0.002 | 2.3 |
| 3 | 6 | getExternalObjectPlanContext [["groups"]] | 27.970 | 27.970 | 0.000 | 0.2 |
| 4 | 6 | externalObjectGroupOperation ["create-or-replace-groups"] | 27.970 | 29.866 | 1.897 | 1896.7 |
| 5 | 6 | getExternalObjectPlanContext [["groups"]] | 29.867 | 29.873 | 0.006 | 6.0 |
| 6 | 7 | getExternalObjectPlanContext [["groups"]] | 34.109 | 34.121 | 0.011 | 11.5 |
| 7 | 7 | getExternalObjectLibraryContext [["masterData"]] | 34.109 | 34.120 | 0.010 | 10.4 |
| 8 | 8 | getExternalObjectPlanContext [["obstacles", "rooms"]] | 34.123 | 34.127 | 0.004 | 3.9 |
| 9 | 9 | getExternalObjectPlanContext [["groups"]] | 37.200 | 37.210 | 0.010 | 10.0 |
| 10 | 9 | externalObjectGroupOperation ["change-group-attribute"] | 37.210 | 37.327 | 0.117 | 116.8 |
| 11 | 10 | getExternalObjectSnapshot [["perspectiveObjectImage", "topImage", "keepOpenGeometry", "imageType", "imageQuality"]] | 43.034 | 43.442 | 0.408 | 407.8 |

**Individual HTTP requests — UTF-8 serialized JSON body bytes**

| Attempt | SDK step | Fetch start s | Fetch → headers s | Request bytes | New input bytes | Repeated input bytes | Input bytes | Tools bytes | Envelope bytes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | 0.031 | 2.182 | 604,199 | 560,621 | 0 | 560,621 | 43,498 | 80 |
| 2 | 2 | 5.362 | 0.993 | 75,439 | 31,767 | 0 | 31,767 | 43,498 | 174 |
| 3 | 3 | 16.942 | 1.067 | 59,140 | 15,470 | 0 | 15,470 | 43,498 | 172 |
| 4 | 4 | 30.120 | 0.911 | 70,591 | 26,921 | 0 | 26,921 | 43,498 | 172 |
| 5 | 5 | 34.130 | 0.844 | 46,437 | 2,766 | 0 | 2,766 | 43,498 | 173 |
| 6 | 6 | 37.338 | 0.748 | 44,202 | 532 | 0 | 532 | 43,498 | 172 |
| 7 | 7 | 43.472 | 0.956 | 227,979 | 184,309 | 0 | 184,309 | 43,498 | 172 |

The planner's own price refresh, without a tool's call line: 28.460–30.372, 30.373–30.960, 37.340–37.787 s.

### Run 2

Recorded start: 2026-10-27T10:07:10.773Z; direct OpenAI Responses.

**Agent steps — duration per decision and tool execution**

| Step | Following tools/work | Start s | End s | Agent/model delta s | Tools delta s | Total step delta s |
|---|---|---|---|---|---|---|
| 1 | get-plan-context; get-skill (image-planning); get-skill (kitchen-planning) | 0.019 | 4.327 | 4.300 | 0.006 | 4.308 |
| 2 | get-skill (kitchen-planning / references/planning-reference.md) | 4.329 | 17.110 | 12.780 | 0.001 | 12.781 |
| 3 | create-or-replace-groups | 17.112 | 29.261 | 10.000 | 2.147 | 12.149 |
| 4 | find-attributes; get-plan-context | 29.261 | 36.342 | 7.056 | 0.023 | 7.081 |
| 5 | change-group-attribute | 36.342 | 39.610 | 3.133 | 0.133 | 3.268 |
| 6 | get-plan-images | 39.611 | 46.983 | 6.936 | 0.435 | 7.372 |
| 7 | Final answer | 46.984 | 51.684 | 4.696 | 0.000 | 4.700 |

| Call | SDK start s | End s | Delta s (model) | First output s | Remaining s | Input tokens | Output / reasoning | Request bytes | Tools after model |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.019 | 4.320 | 4.300 | 3.933 | 0.367 | 77,271 | 79 / 0 | 604,199 | #2 get-plan-context, #3 get-skill, #4 get-skill |
| 2 | 4.329 | 17.109 | 12.780 | 10.584 | 2.196 | 84,140 | 246 / 150 | 75,439 | #5 get-skill |
| 3 | 17.112 | 27.112 | 10.000 | 6.211 | 3.789 | 87,430 | 683 / 148 | 59,140 | #6 create-or-replace-groups |
| 4 | 29.261 | 36.318 | 7.056 | 6.803 | 0.254 | 95,573 | 123 / 68 | 72,239 | #7 find-attributes, #8 get-plan-context |
| 5 | 36.342 | 39.476 | 3.133 | 2.440 | 0.694 | 96,706 | 58 / 0 | 46,437 | #9 change-group-attribute |
| 6 | 39.611 | 46.546 | 6.936 | 4.750 | 2.185 | 96,910 | 169 / 66 | 44,202 | #10 get-plan-images |
| 7 | 46.984 | 51.680 | 4.696 | 2.084 | 2.612 | 99,503 | 123 / 0 | 227,595 | Final answer |

| Call | Tool / requested information | Start s | End s | Delta s (tool) | Elapsed ms | Nested planner ms | Remaining ms | Result bytes | Outcome |
|---|---|---|---|---|---|---|---|---|---|
| 1 | get-plan-context: articles, attributes | 0.000 | 0.012 | 0.011 | 11.3 | 6.0 | 5.3 | 270,617 | OK |
| 2 | get-plan-context: rooms, groups, obstacles, installationElements | 4.322 | 4.327 | 0.006 | 5.6 | 3.3 | 2.3 | 5,631 | OK |
| 3 | get-skill: image-planning / SKILL.md | 4.322 | 4.327 | 0.006 | 5.6 | 0.0 | 5.6 | 5,658 | OK |
| 4 | get-skill: kitchen-planning / SKILL.md | 4.322 | 4.327 | 0.005 | 5.4 | 0.0 | 5.4 | 20,247 | OK |
| 5 | get-skill: kitchen-planning / references/planning-reference.md | 17.110 | 17.110 | 0.001 | 0.6 | 0.0 | 0.6 | 15,393 | OK |
| 6 | create-or-replace-groups: 1 group, 9 roots; placement left / center | 27.114 | 29.261 | 2.147 | 2147.0 | 1906.8 | 240.2 | 28,492 | OK |
| 7 | find-attributes: Create backsplash | 36.319 | 36.342 | 0.023 | 23.1 | 14.9 | 8.2 | 759 | OK |
| 8 | get-plan-context: obstacles | 36.319 | 36.342 | 0.023 | 22.7 | 3.2 | 19.5 | 1,853 | OK |
| 9 | change-group-attribute: mod_CreateBacksplash=true | 39.477 | 39.610 | 0.133 | 133.1 | 127.2 | 5.9 | 470 | Tool error |
| 10 | get-plan-images | 46.547 | 46.983 | 0.435 | 435.5 | 413.2 | 22.3 | 183,828 | OK |

| Call | Parent tool | Planner method / arguments | Start s | End s | Delta s (planner) | Elapsed ms |
|---|---|---|---|---|---|---|
| 1 | 1 | getExternalObjectLibraryContext [["articles", "masterData"]] | 0.001 | 0.007 | 0.006 | 6.0 |
| 2 | 2 | getExternalObjectPlanContext [["rooms", "groups", "obstacles", "installationElements"]] | 4.323 | 4.326 | 0.003 | 3.3 |
| 3 | 6 | getExternalObjectPlanContext [["groups"]] | 27.116 | 27.116 | 0.000 | 0.3 |
| 4 | 6 | externalObjectGroupOperation ["create-or-replace-groups"] | 27.116 | 29.017 | 1.901 | 1900.6 |
| 5 | 6 | getExternalObjectPlanContext [["groups"]] | 29.017 | 29.023 | 0.006 | 5.9 |
| 6 | 7 | getExternalObjectPlanContext [["groups"]] | 36.321 | 36.336 | 0.015 | 14.9 |
| 7 | 7 | getExternalObjectLibraryContext [["masterData"]] | 36.322 | 36.335 | 0.014 | 13.6 |
| 8 | 8 | getExternalObjectPlanContext [["obstacles", "rooms"]] | 36.338 | 36.342 | 0.003 | 3.2 |
| 9 | 9 | getExternalObjectPlanContext [["groups"]] | 39.479 | 39.489 | 0.009 | 9.5 |
| 10 | 9 | externalObjectGroupOperation ["change-group-attribute"] | 39.489 | 39.606 | 0.118 | 117.7 |
| 11 | 10 | getExternalObjectSnapshot [["perspectiveObjectImage", "topImage", "keepOpenGeometry", "imageType", "imageQuality"]] | 46.549 | 46.962 | 0.413 | 413.2 |

**Individual HTTP requests — UTF-8 serialized JSON body bytes**

| Attempt | SDK step | Fetch start s | Fetch → headers s | Request bytes | New input bytes | Repeated input bytes | Input bytes | Tools bytes | Envelope bytes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | 0.029 | 1.593 | 604,199 | 560,621 | 0 | 560,621 | 43,498 | 80 |
| 2 | 2 | 4.331 | 1.442 | 75,439 | 31,767 | 0 | 31,767 | 43,498 | 174 |
| 3 | 3 | 17.114 | 0.773 | 59,140 | 15,470 | 0 | 15,470 | 43,498 | 172 |
| 4 | 4 | 29.292 | 0.938 | 72,239 | 28,569 | 0 | 28,569 | 43,498 | 172 |
| 5 | 5 | 36.344 | 0.919 | 46,437 | 2,766 | 0 | 2,766 | 43,498 | 173 |
| 6 | 6 | 39.615 | 0.913 | 44,202 | 532 | 0 | 532 | 43,498 | 172 |
| 7 | 7 | 46.993 | 0.940 | 227,595 | 183,925 | 0 | 183,925 | 43,498 | 172 |

The planner's own price refresh, without a tool's call line: 27.615–29.290, 29.297–29.913, 29.914–30.443, 39.617–40.531 s.

## Usage, transport and saved plans

| Measurement | Run 1 | Run 2 |
|---|---|---|
| Model calls | 7 | 7 |
| Request bytes (turn total) | 1,127,987 | 1,129,251 |
| Repeated serialized input bytes (turn total) | 0 | 0 |
| Input tokens | 635,788 | 637,533 |
| Output / reasoning tokens | 1,416 / 395 | 1,481 / 432 |
| Cache read / coverage | 536,758 / complete | 622,149 / complete |
| Cache write / coverage | 99,009 / complete | 15,363 / complete |
| First-call cache read | 0 | 77,268 |
| Shared reference bytes | 295,482 | 295,482 |
| Shared reference SHA-256 | `9591664f362abea2796faa588748630471ff819ca0aad2061bbaa3191cea7013` | `9591664f362abea2796faa588748630471ff819ca0aad2061bbaa3191cea7013` |
| get-plan-images result bytes (base64 image characters) | 184,212 (183,960) | 183,828 (183,576) |
| Request that carries the images: call, bytes, fetch → headers | 7, 227,979, 0.956 s | 7, 227,595, 0.940 s |
| Saved snapshot | ps_t0q3t70adsnqmzgjc9ybk8kyotsawqu | ps_t0q9f8uhq8ojuco3m10fkv1nwyfisk7 |

The images the agent saw are JPEG, 1024 × 1024 and 1024 × 936 px, 46 KB and 92 KB as files; the saved snapshot of the run keeps its PNGs. Request bytes are each call's UTF-8 body; continuations upload no repeated input. Earlier context still counts in the input tokens of a chained call.

## Findings and plan verification

| Run | Position / rotation | Kitchen width mm | Article IDs (non-generated) | Outcome / limits |
|---|---|---|---|---|
| 1 | [-685,-240,0] / 90° | 3010 | HK260, USTB60, UHS60, UTB60, SUT60, OTB60, DU, OTB60, OTB60 | Backsplash Error 14034; the library switched the handle design to the curved bow handle |
| 2 | [-685,-240,0] / 90° | 3010 | HK260, USTB60, UHS60, UTB60, SUT60, OTB60, DU, OTB60, OTB60 | Backsplash Error 14034; handle switched likewise; plinth 150 mm |

Each run has one successful create and a saved nonempty kitchen centred on the left wall, in the order of the photo: the fridge column, a drawer unit, oven with hob and hood, a base unit, the sink unit and three wall units. Both answers disclose the missing dark backsplash after the library rejects its generation (Error 14034, `tab_GrainDirectionSettings`), and both say they show the images for comparison with the photo. Fronts and woods are approximate: olive green fronts, a light wood in the renders where the photo shows oak.

- **The model call sequence.** 1: live context, image skill and kitchen skill; 2: the kitchen planning reference; 3: the create; 4: the backsplash attribute lookup and the obstacles; 5: the backsplash enable, which the library cannot calculate; 6: the plan images; 7: the final answer. Report 02 took the images in call 4, before the enable, and answered in call 6.
- **The render stays, after the last change.** The served text names the comparison of a planning from an image with that image as an occasion of a render, and the agent takes it. It takes it after its last write, so the images show the final state; that costs a round of its own (5.701 / 6.936 s).
- **The JPEG images shorten the request that carries them.** 227,979 / 227,595 bytes with 0.956 / 0.940 s to the response headers, against 2,817,741 / 2,787,154 bytes and 2.931 / 3.211 s in 02. The upload per turn is 69 % below 02.
- **The read after the create is for the obstacles.** The create result carries the groups; the agent reads only `obstacles` (1,853 bytes), batched with the attribute lookup in one round.
- **The create tool takes 2.1 s, against 1.2 s in 02.** The planner operation of the create takes 1.90 s. The planner's own price refresh starts 0.5 s into it and runs past its end (28.460–30.372 / 27.615–29.290 s). Whether the refresh slows the create on the main thread, or other source changes since 02 do, is not established: 02 did not time the refresh.

## Proposed experiments and rejected conclusions

- The text kitchens are the case where the served text of E expects no render; this image test keeps its render by design. The minimum set of "test the mcp" with `plan-images-kitchen` and `open-cabinet-look-inside` measures that case.
- A render before the last change, batched with the attribute lookup as in 02, would save the round but show a state the next write changes. The served text does not ask for it; no change is proposed.
- Profile the create's planner operation with and without the planner's price refresh, on one build, before naming a cause for the slower create.
- Two repetitions per version give observed values and ranges, not p95 or isolated causality; the provider cache state differed between the runs.

## Measurement gaps and open work

- Create completion is a conservative loaded-plan milestone, not the first painted frame.
- Provider queueing, prefill, reasoning, generation, network and kernel or render work are not separated.
- First visible text is the planning preamble; the start of the final answer is not captured separately.
- The embedding-lib is the published build of the same source, where 01–03 loaded it from a local server; the hooks differ from those of 01–03 and add unquantified overhead.
- The planner's price refresh was not timed in 01–03, so its share in their create times is unknown.
- Reports 01–03 keep no raw captures on disk; the comparison uses their published means.

## The benchmark to repeat

Keep this fixture and digest, the direct provider, the key-variable reference and provider-default reasoning; use the local planner on :5173 and check that its checkout carries the code to measure. In `.temp/result/benchmark-04-iklw-oa-2026-10-27/`, `make-timing-runner.mjs` writes `timing-runner.mjs` from the current prompt runner, `run-reps.mjs` runs two repetitions with bounded retries on example port 3103, `analyze.mjs` derives the tables from `timeline.json`, `run.json`, `subprocess.json` and `plan-context.json`, and `compare.mjs` and `write-report.mjs` write the comparison values and this report. Start a fresh session for the next numbered report and preserve 01–04; extend the unnumbered comparison with its measurements. Follow [the timing skill](../skills/hi-mcp-timing-benchmark.md).

Verification: every model request pairs with a completed model call and its diagnostics bytes; every tool start pairs with an end; every planner call of a tool pairs with its call line; the interval accounting reconciles with the turn duration; both saved plans support the create; the roomle-ui checkout stayed on 9577d925b through both runs.
