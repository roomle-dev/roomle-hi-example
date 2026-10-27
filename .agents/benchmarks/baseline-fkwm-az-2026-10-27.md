# full-kitchen-walnut-marble-corner: detailed Azure gpt-6-astra timing — the baseline

| Field | Value |
|---|---|
| Type / domain | Benchmark / HI Planning Assistant |
| Trigger | The baseline of the time measurement for full-kitchen-walnut-marble-corner on the Azure deployment, with proposals A, B, D, E, F and the plan state per turn in place; RML-18303 |
| Date / author | 2026-10-27 / Claude Code |
| Status | Measured: two completed turns, two saved plans |
| Ticket | [RML-18303](https://roomle.atlassian.net/browse/RML-18303) |
| Data | Measurements are retained in the tables below; raw captures remain in the ignored .temp/result/baseline-fkwm-az-2026-10-27 folder |
| Repeat | Same fixture, the Azure deployment, the local planner and the published embedding-lib; procedure below |

Affected repositories:

- **roomle-hi-example:** this benchmark report and the documentation indexes. Raw evidence remains local in .temp.
- **roomle-ui:** the planner and the embedding-lib measured, unchanged.

## Executive summary

The first completed kitchen create took **36.119 s** and **40.052 s** from assistant turn start; mean **38.086 s**. The complete assistant turn took **68.411 s** and **47.439 s**; mean **57.925 s**. Model calls occupied **92.15%** and **94.23%** of those turns.

Both runs create the kitchen in **model call 2**. Call 1 fetches the kitchen skill — with its planning reference in one result — and the library reference and the plan state come with the turn, read in **18.6 ms** and **32.2 ms** before the first request. The create call is the largest block: **30.035 s** and **26.826 s**, of which **19.982 s** and **17.294 s** pass before its first output, with 431 and 404 reasoning tokens. Kitchen creation itself took **3.034 s** and **2.689 s**. In run 2 the first call, the skill fetch, waited 9.96 s for its response headers, 22 output tokens without reasoning.

After the kitchen, the runs differ: run 1 spends **32.292 s** shortening the back run to clear the window — two deletes and an answer —, run 2 answers after **7.387 s**. These are request/response wall times, including network and provider work, not isolated server compute times. The first-kitchen milestone is successful create-tool completion: a conservative point by which the kitchen has been loaded into the plan, not a measured first painted GPU frame.

## What was asked and run

Test: **full-kitchen-walnut-marble-corner**, from [docs/test-prompts.json](../../docs/test-prompts.json).

> create a kitchen with an oven, hob, cooker hood, fridge, sink and cabinet with drawers, as well as wall cabinets in the back right corner of the room. Arrange the kitchen around the corner. The front of the kitchen should be made of walnut and the worktop should be made of dark marble

Starting plan: **ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv**, default-room. Exactly this prompt was sent; the optional suite prompt suffix was omitted. Two fresh browsers and conversations used the same prompt and source revisions. No random cases, provider warm-up requests or request pacing were added.

| Setting | Measured value |
|---|---|
| Provider / key reference | `"provider": "gpt-6-astra", "apiKey": "$AZURE_GPT_KEY"`; resolved key never written to artifacts |
| Actual provider endpoint | https://dfhifoundrysweden.services.ai.azure.com/openai/v1/responses (the HI Azure AI Foundry resource, Responses API, reference cache breakpoint on) |
| Reasoning effort | Provider default; no explicit reasoning override |
| Planner | http://localhost:5173/; the already running local roomle-ui, feat/hi-mcp-merge |
| Assistant / embedding source | https://cdn.jsdelivr.net/npm/@roomle/embedding-lib@0.0.0-dev-1b4351d (roomle-embedding-lib.js and hi.js), as the example pins it |
| Example page | http://localhost:3103/ |
| roomle-hi-example SHA | 8bc6329 (master) |
| roomle-ui SHA | a8fe64618 (feat/hi-mcp-merge) |
| Node / Chromium | Node 23.5.0; Playwright 1.55.0 bundled Chromium, headless with --enable-gpu |
| Initial provider cache state | Unknown for each run; measured cache counters below |

## How it was measured

A copy of [run-hi-mcp-prompt.js](../scripts/run-hi-mcp-prompt.js), written by the session's make-timing-runner.mjs, retained its normal prompt, usage, tool, plan and snapshot collection and added timestamp-only hooks with a Playwright init script. No productive file was modified, and no response routing was used, so the browser's HTTP cache works as usual.

- The assistant's existing diagnostics supply per-call response duration, time to first output, reference acquisition, first visible text, tokens, cache counters, request bytes and full-turn duration.
- Browser events mark turn start and end around onPlanningAssistantPrompt, each model fetch (start, response headers, the end of the stream read through a clone), tool forwarding start/end through callExternalObjectAgentTool, every output part of the window, and every planner-method start/end in the planner frame with its [hi-mcp] log line.
- Browser timestamps use performance.timeOrigin + performance.now(), so the host and iframe share an epoch. Tables use seconds relative to assistant turn start.
- Tool result sizes are UTF-8 bytes of JSON.stringify(result), including the MCP wrapper and base64 image content where present. They are not model tokens or compressed HTTP bytes.
- Nested planner calls are attributed by the [hi-mcp] tool and call log lines; the two reads before the first request run in parallel and are told apart by their planner method. Nested planner time is included in tool time. Overlapping tools are counted once for wall time. Model/tool overlap is measured from intervals and subtracted once; it is 0.000 s / 0.000 s here.
- Recorded run start is the runner's runSession start, after browser launch. The subprocess measurement also includes browser launch, output writing and browser/launcher shutdown. Its result is distinct from the recorded ready + chat + snapshot phases.
- The runner waits until the library context lists articles before it sends the prompt, and the assistant reads the library before the first prompt itself; both reads calculate the article templates. The reads of the turn are therefore warm, as in the hosts.

Both turns completed without provider/chat errors, retries or excluded attempts, and both saved a plan.

## How to read the step deltas

**Agent/model delta s** is how long the model call takes to return its decision, tool arguments or text. It includes the provider round trip and stream handling. **Tools delta s** is the time spent executing that step's tools, counting parallel calls once. **Total step delta s** runs from the start of the model call until its tools complete; the last step ends when the assistant turn completes. The difference includes local handling within the step. Small gaps between steps and the initial reads of the library reference and the plan state are outside these step totals.

The **Start s** and **End s** columns are timestamps measured from assistant turn start; they are not durations. In the detailed call tables, **Delta s = End s − Start s** is the duration of that individual call. Tool/planner tables retain milliseconds as additional detail.

### From skills to the first kitchen

The skill response of call 1 contains kitchen-planning SKILL.md with its planning reference in one result of 35,685 bytes; no separate reference is fetched, and no model call reads the live plan sections before the create, since the plan state comes with the turn. There is therefore one starting point:

| Milestone / interval | Run 1 s | Run 2 s |
|---|---|---|
| Kitchen skill response complete (timestamp) | 3.048 | 10.530 |
| First kitchen create starts (timestamp) | 33.085 | 37.363 |
| First kitchen create completes (timestamp) | 36.119 | 40.052 |
| Delta: skill responses → first kitchen complete | 33.071 | 29.521 |
| ↳ Agent/model call 2 within that interval | 30.035 | 26.826 |
| ↳ Kitchen creation tool within that interval | 3.034 | 2.689 |
| ↳ Local gaps within that interval | 0.002 | 0.006 |

For example, run 1 takes **33.071 s** from the skill file (3.048 s) to the completed kitchen (36.119 s). The model spends **30.035 s** deciding and emitting the kitchen payload — **19.982 s** of it before its first output, with 431 reasoning tokens —; the create tool then takes **3.034 s**, with about **0.002 s** of local gaps. Run 2 takes **29.522 s** over the same interval.

## Results: milestones and total time

| Measurement (seconds) | Run 1 | Run 2 | Mean |
|---|---|---|---|
| Page/library/assistant ready (recorded run start) | 5.712 | 5.381 | 5.546 |
| Library reference and plan state acquisition inside turn (warm) | 0.019 | 0.032 | 0.025 |
| First model generated output (turn start) | 2.748 | 10.211 | 6.480 |
| First visible assistant text (turn start) | 23.032 | 27.830 | 25.431 |
| First successful kitchen create completed (turn start) | 36.119 | 40.052 | 38.085 |
| First successful kitchen create completed (recorded run start) | 41.833 | 45.436 | 43.634 |
| First successful kitchen create completed (subprocess start) | 42.067 | 45.676 | 43.871 |
| Create tool execution alone | 3.034 | 2.689 | 2.862 |
| Assistant turn start → answer complete | 68.411 | 47.439 | 57.925 |
| Time after the first kitchen until answer complete | 32.292 | 7.387 | 19.840 |
| Runner chat phase (includes the collection) | 68.940 | 47.966 | 58.453 |
| Post-chat context, images and saved snapshot | 5.905 | 5.544 | 5.724 |
| Recorded run: ready + chat + snapshot | 80.557 | 58.891 | 69.724 |
| Full subprocess: browser startup through launcher shutdown | 81.046 | 59.372 | 70.209 |

"First kitchen" here means the first successful create-or-replace-groups result, including its placement and returned groups. Each run made one successful create and retained that kitchen. Actual scene insertion happens during the tool and can precede its result; see the limitations below.

## Results: where the assistant turn goes

| Wall time component | Run 1 s | Run 1 share | Run 2 s | Run 2 share |
|---|---|---|---|---|
| Model calls (union) | 63.041 | 92.15% | 44.700 | 94.23% |
| Tools including the reads before the first request (union) | 5.354 | 7.83% | 2.718 | 5.73% |
| Model/tool overlap (subtract once) | 0.000 | 0.00% | 0.000 | 0.00% |
| Other client work / gaps | 0.016 | 0.02% | 0.021 | 0.04% |
| Assistant turn | 68.411 | 100.00% | 47.439 | 100.00% |

The model sum is taken from the SDK's measured call durations; the tool union comes from browser start/end intervals. The remaining client time closes the measured turn exactly before display rounding. Summing individual tool durations would overcount the concurrent tools.

## Results: model, tools and planner calls in order

### Run 1

Recorded start: **2026-10-27T19:28:50.507Z** (27/10/2026 20:28:50 Europe/Vienna). Model/provider: Azure Responses, gpt-6-astra.

**Agent steps — duration per decision and tool execution**

| Step | Result / following tools | Start s | End s | Agent/model delta s | Tools delta s | Total step delta s |
|---|---|---|---|---|---|---|
| 1 | get-skill (kitchen-planning) | 0.023 | 3.048 | 3.024 | 0.001 | 3.025 |
| 2 | create-or-replace-groups | 3.049 | 36.119 | 30.035 | 3.034 | 33.070 |
| 3 | delete-article-and-compact | 36.120 | 55.780 | 18.402 | 1.258 | 19.660 |
| 4 | delete-article-and-compact | 55.782 | 59.914 | 3.087 | 1.045 | 4.132 |
| 5 | Final answer | 59.915 | 68.411 | 8.494 | 0.000 | 8.496 |

| Call | SDK start s | End s | Delta s (model) | First output s¹ | Remaining s² | Input tokens | Output / reasoning | Request bytes | Tools after model |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.023 | 3.046 | 3.024 | 2.726 | 0.298 | 76,771 | 22 / 0 | 345,510 | #3 get-skill |
| 2 | 3.049 | 33.084 | 30.035 | 19.982 | 10.053 | 83,672 | 1,005 / 431 | 79,642 | #4 create-or-replace-groups |
| 3 | 36.120 | 54.522 | 18.402 | 17.788 | 0.614 | 94,303 | 353 / 304 | 79,854 | #5 delete-article-and-compact |
| 4 | 55.782 | 58.869 | 3.087 | 2.419 | 0.667 | 103,542 | 66 / 15 | 77,084 | #6 delete-article-and-compact |
| 5 | 59.915 | 68.409 | 8.494 | 4.598 | 3.896 | 111,564 | 162 / 0 | 73,998 | Final answer |

¹ From the SDK model-call start to its first generated output; this can be reasoning, a tool call or text. ² The remaining model-stream time is response duration minus first-output duration. It is not a pure text-generation or reasoning measurement. Request fetch starts and response-header times remain in the local timeline.json capture.

| Call | Tool / requested information | Start s | End s | Delta s (tool) | Elapsed ms | Nested planner ms³ | Remaining ms⁴ | Result bytes | Result |
|---|---|---|---|---|---|---|---|---|---|
| 1 | get-plan-context: articles, attributes | 0.000 | 0.015 | 0.0143 | 14.3 | 5.1 | 9.2 | 270,617 | OK |
| 2 | get-plan-context: rooms, groups, obstacles, installationElements | 0.001 | 0.016 | 0.0157 | 15.7 | 2.8 | 12.9 | 5,631 | OK |
| 3 | get-skill: kitchen-planning / SKILL.md | 3.047 | 3.048 | 0.0005 | 0.5 | 0.0 | 0.5 | 35,685 | OK |
| 4 | create-or-replace-groups: 1 group, 14 roots; placement right / back | 33.085 | 36.119 | 3.0344 | 3034.4 | 2940.0 | 94.4 | 35,897 | OK |
| 5 | delete-article-and-compact | 54.522 | 55.780 | 1.2584 | 1258.4 | 1023.7 | 234.7 | 33,127 | OK |
| 6 | delete-article-and-compact | 58.869 | 59.914 | 1.0449 | 1044.9 | 813.1 | 231.8 | 30,041 | OK |

³ Union of the underlying planner-call intervals inside this tool. ⁴ Tool elapsed minus nested planner intervals: forwarding, scheduling, validation, projection, serialization and any uninstrumented work. This is not a pure CPU measurement. Calls #1 and #2 are the assistant's automatic reads of the library reference and the plan state, before the first model request, rather than model-requested tools.

| Call | Containing tool | Planner method / arguments | Start s | End s | Delta s (planner) | Elapsed ms |
|---|---|---|---|---|---|---|
| 1 | #1 | getExternalObjectLibraryContext [["articles","masterData"]] | 0.001 | 0.006 | 0.0051 | 5.1 |
| 2 | #2 | getExternalObjectPlanContext [["rooms","groups","obstacles","installationElements"]] | 0.009 | 0.012 | 0.0028 | 2.8 |
| 3 | #4 | getExternalObjectPlanContext [["groups"]] | 33.086 | 33.086 | 0.0001 | 0.1 |
| 4 | #4 | externalObjectGroupOperation ["create-or-replace-groups"] | 33.087 | 36.017 | 2.9300 | 2930.0 |
| 5 | #4 | getExternalObjectPlanContext [["groups"]] | 36.017 | 36.027 | 0.0099 | 9.9 |
| 6 | #5 | getExternalObjectPlanContext [["groups"]] | 54.522 | 54.535 | 0.0126 | 12.6 |
| 7 | #5 | externalObjectGroupOperation ["delete-article-and-compact"] | 54.535 | 55.536 | 1.0009 | 1000.9 |
| 8 | #5 | getExternalObjectPlanContext [["groups"]] | 55.536 | 55.547 | 0.0102 | 10.2 |
| 9 | #6 | getExternalObjectPlanContext [["groups"]] | 58.869 | 58.879 | 0.0095 | 9.5 |
| 10 | #6 | externalObjectGroupOperation ["delete-article-and-compact"] | 58.879 | 59.674 | 0.7955 | 795.5 |
| 11 | #6 | getExternalObjectPlanContext [["groups"]] | 59.675 | 59.683 | 0.0081 | 8.1 |

The planner's own price refresh after the plan change, without a tool: 34.129–36.140 s, 36.152–36.692 s, 36.693–37.159 s, 55.802–56.415 s, 56.415–56.873 s, 59.931–60.542 s, 60.543–61.069 s.

Local capture: `.temp/result/baseline-fkwm-az-2026-10-27/fkwm-rep-1/` (run.json, timeline.json, planner-calls.json and plan-context.json).

### Run 2

Recorded start: **2026-10-27T19:30:11.579Z** (27/10/2026 20:30:11 Europe/Vienna). Model/provider: Azure Responses, gpt-6-astra.

**Agent steps — duration per decision and tool execution**

| Step | Result / following tools | Start s | End s | Agent/model delta s | Tools delta s | Total step delta s |
|---|---|---|---|---|---|---|
| 1 | get-skill (kitchen-planning) | 0.036 | 10.530 | 10.490 | 0.002 | 10.494 |
| 2 | create-or-replace-groups | 10.535 | 40.052 | 26.826 | 2.689 | 29.516 |
| 3 | Final answer | 40.052 | 47.439 | 7.383 | 0.000 | 7.386 |

| Call | SDK start s | End s | Delta s (model) | First output s¹ | Remaining s² | Input tokens | Output / reasoning | Request bytes | Tools after model |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.036 | 10.526 | 10.490 | 10.175 | 0.315 | 76,771 | 22 / 0 | 345,510 | #3 get-skill |
| 2 | 10.535 | 37.362 | 26.826 | 17.294 | 9.533 | 83,672 | 1,009 / 404 | 79,642 | #4 create-or-replace-groups |
| 3 | 40.052 | 47.436 | 7.383 | 3.337 | 4.047 | 93,861 | 153 / 0 | 78,086 | Final answer |

¹ From the SDK model-call start to its first generated output; this can be reasoning, a tool call or text. ² The remaining model-stream time is response duration minus first-output duration. It is not a pure text-generation or reasoning measurement. Request fetch starts and response-header times remain in the local timeline.json capture.

| Call | Tool / requested information | Start s | End s | Delta s (tool) | Elapsed ms | Nested planner ms³ | Remaining ms⁴ | Result bytes | Result |
|---|---|---|---|---|---|---|---|---|---|
| 1 | get-plan-context: articles, attributes | 0.001 | 0.026 | 0.0256 | 25.6 | 10.2 | 15.4 | 270,617 | OK |
| 2 | get-plan-context: rooms, groups, obstacles, installationElements | 0.001 | 0.028 | 0.0273 | 27.3 | 2.6 | 24.7 | 5,631 | OK |
| 3 | get-skill: kitchen-planning / SKILL.md | 10.528 | 10.530 | 0.0019 | 1.9 | 0.0 | 1.9 | 35,685 | OK |
| 4 | create-or-replace-groups: 1 group, 14 roots; placement right / back | 37.363 | 40.052 | 2.6888 | 2688.8 | 2614.6 | 74.2 | 34,129 | OK |

³ Union of the underlying planner-call intervals inside this tool. ⁴ Tool elapsed minus nested planner intervals: forwarding, scheduling, validation, projection, serialization and any uninstrumented work. This is not a pure CPU measurement. Calls #1 and #2 are the assistant's automatic reads of the library reference and the plan state, before the first model request, rather than model-requested tools.

| Call | Containing tool | Planner method / arguments | Start s | End s | Delta s (planner) | Elapsed ms |
|---|---|---|---|---|---|---|
| 1 | #1 | getExternalObjectLibraryContext [["articles","masterData"]] | 0.002 | 0.012 | 0.0102 | 10.2 |
| 2 | #2 | getExternalObjectPlanContext [["rooms","groups","obstacles","installationElements"]] | 0.015 | 0.017 | 0.0026 | 2.6 |
| 3 | #4 | getExternalObjectPlanContext [["groups"]] | 37.366 | 37.366 | 0.0004 | 0.4 |
| 4 | #4 | externalObjectGroupOperation ["create-or-replace-groups"] | 37.366 | 39.972 | 2.6058 | 2605.8 |
| 5 | #4 | getExternalObjectPlanContext [["groups"]] | 39.972 | 39.981 | 0.0084 | 8.4 |

The planner's own price refresh after the plan change, without a tool: 38.247–40.086 s, 40.100–40.622 s, 40.623–41.239 s.

Local capture: `.temp/result/baseline-fkwm-az-2026-10-27/fkwm-rep-2/` (run.json, timeline.json, planner-calls.json and plan-context.json).

## Context, cache and transport

| Measurement | Run 1 | Run 2 |
|---|---|---|
| Model calls | 5 | 3 |
| Tools including the reads before the first request | 6 | 4 |
| Input tokens | 469,852 | 254,304 |
| Output tokens (include reasoning) | 1,608 | 1,184 |
| Reasoning tokens | 750 | 404 |
| Cache-read tokens / share of input | 358,276 / 76.25% | 244,106 / 95.99% |
| Cache-write tokens | 111,561 | 10,189 |
| First call: cache-read tokens | 0 | 76,768 |
| Request JSON bytes, all calls | 656,088 | 503,238 |
| Reference bytes (exclude tools/current input) | 295,682 | 295,682 |
| Shared-reference SHA-256 | `2974a3a3ddd8857b8d789c90e6cf9c3588a47977df0abb285521d1692dd6fbf8` | `2974a3a3ddd8857b8d789c90e6cf9c3588a47977df0abb285521d1692dd6fbf8` |
| Plan state bytes (supplied with the turn) | 4,822 | 4,822 |
| Information tools, elapsed union ms | 16.3 | 29.3 |
| Information tools, summed call ms (overlap included) | 30.5 | 54.8 |
| Saved plan snapshot | `ps_t21g6bafa3pp2qz0li8dxzwac81jwvu` | `ps_t211vjhik5ayyya7gvbjv4ybpo7wcgf` |

All token/cache/reasoning fields have complete coverage for completed calls. Cache reads are already part of input tokens and reasoning is already part of output tokens. Request bytes count the whole uncompressed JSON sent on every fetch. With Responses chaining a later request carries only its new input, so a whole turn sends **656,088** and **503,238 bytes**, of which the first request is **345,510 bytes**. Both runs read the same shared reference, **295,682 bytes** with the same SHA-256 as the image baseline. The first call of run 1 reads **no token** from the cache — the provider had no prefix cached —, run 2's first call **76,768 of its 76,771 input tokens**; over the turn the cache covers 76.25% and 95.99% of the input. A fresh browser does not establish a cold provider cache; run 1 met one.

The library reference returns **270,617 bytes**, the plan state **5,631 bytes**; both come with the turn before the first request. No run renders: a text creation has no occasion for the plan images.

## Findings and the evidence behind them

### 1. The create call is where the time before the first kitchen goes

Call 1 ends after **3.024 / 10.490 s** with the skill request. Call 2, the create, then takes **30.035 / 26.826 s**: **19.982 / 17.294 s** until its first output and **10.053 / 9.533 s** streaming the payload, with **431 / 404 reasoning tokens** and **1,005 / 1,009 output tokens**. The create tool adds **3.034 / 2.689 s**, the local gaps a few milliseconds. Of the 36.119 / 40.052 s to the first kitchen, the create call is 83% / 67%.

The request/model boundary localizes this to the model round trip, not planner execution. The cause inside that boundary is **unknown**: provider queueing, input processing, reasoning, generation and network are not separately exposed. The text kitchen reasons longer before its payload than the image kitchen of [the image baseline](baseline-iklw-az-2026-10-27.md) (17.6 / 13.7 s, 378 / 269 reasoning tokens): it composes 14 root modules around a corner where the image kitchen copies a row of nine.

### 2. Information gathering is cheap locally; the reads come with the turn

The library reference and the plan state are read in parallel before the first request: **14.3 / 15.7 ms** in run 1 and **25.6 / 27.3 ms** in run 2 as tools, **5.1 / 2.8 ms** and **10.2 / 2.6 ms** in the planner. The skill takes **0.5 / 1.9 ms**. All information tools of a turn take **16.3 / 29.3 ms** in union. No model call reads the live plan sections, before the create or after it.

### 3. Run 1 corrects its own kitchen after the create

The create of run 1 got no hint and no correction. The agent then shortened the back run to keep the sink clear of the window: call 3 deleted the 30 cm drawer unit at the window end with `delete-article-and-compact` (18.402 s, 17.788 s of it until its first output, 304 reasoning tokens), the server kept the wall unit above it in place and said so, and call 4 deleted that wall unit (3.087 s). The run ends 94 mm clear of the window and 984 mm before the doorway; run 2, which built the same kitchen with a shorter back run in its create, answers at call 3.

### 4. A first call can wait without reasoning

Run 2's first call — the skill fetch, 22 output tokens and no reasoning — waits **9.96 s** for its response headers and 10.175 s for its first output; run 1's same call waits 2.726 s. Run 1's first call read nothing from the provider's cache, run 2's almost everything, so the wait is not the prefill of an uncached prefix. The cause is not exposed; it is the provider's side of the round trip, as in the image baseline's long first-output waits.

### 5. The kitchen is the requested one

Both snapshots contain an L-shaped kitchen around the back right corner at [4815, 3765, 0] with **rotationZ = 270°**: on the back wall the sink unit SUT60, drawer units and wall cabinets; on the right wall drawer units, the oven-and-hob unit UHS60 with the cooker hood DU above it and the tall fridge-freezer HK260 at the end of the leg, wall cabinets; Walnut fronts in the Nature program and a Dark marble worktop, as asked. Run 1 builds 12 root modules around the corner unit UELTB90, run 2 14 around UERTB90, with end panels. The perspectives and top views were inspected: both kitchens stand clear of the window and the door.

## Proposed experiments and rejected conclusions

| Candidate | What this run supports | Expected saving / limit |
|---|---|---|
| Less to decide in the create call | The create call takes 30.035 / 26.826 s, 19.982 / 17.294 s of it before its first output, with 431 / 404 reasoning tokens | The largest block before the first kitchen. The worked examples of a create payload are in the served text already; the reasoning effort is out of scope at the moment. No lever is open. |
| Plan the window clearance in the create | Run 1 deletes two units after its create to clear the window (21.489 s for the two calls) | The create sees the window in the plan state; a correction afterwards is the model's choice, not a missing instruction. No saving is established from one run. |
| A watchdog for calls without a first output | Run 2's first call waits 9.96 s for its headers without reasoning | A resend doubles the cost of a legitimate long reasoning. Measure the tail over more runs first. |
| Tool memoization / attribute indexing / precalculated docking vectors | The information tools take 16.3 / 29.3 ms in union; the create tool 3.034 / 2.689 s | Local work is not the bottleneck: removing every information tool saves milliseconds. |

## Measurement gaps and open work

- **First painted frame:** no GPU presentation/paint marker was captured. Create-tool completion is an upper bound for a loaded kitchen; first visible geometry could appear earlier within the 2.689–3.034 s create.
- **Provider internals:** model time combines network, queueing, input processing, reasoning, generation and SDK stream handling. Time to first output does not isolate prefill; response-header time does not isolate network RTT.
- **Tool internals:** the planner table separates planner access from the surrounding tool, but does not profile every individual filtering, projection, docking, library-calculation or kernel-load function. Remaining tool time must not be renamed CPU assembly time.
- **Final text start:** first visible text refers to the first planning preamble; the end of the turn marks completion of the final answer. Final-answer text-delta start was not separately instrumented.
- **Startup attribution:** page/module/library/plan/assistant initialization, the runner's readiness read and the assistant's library read before the first prompt overlap inside the ready phase. They were not profiled individually.
- **Instrumentation overhead:** extra console events, UTF-8 size measurement and log delivery add unquantified overhead; both runs have the same hooks. The planner is a Vite development server; do not use these page-startup numbers as production cold-start numbers.
- **Sampling:** two runs establish a repeated measurement and show large variation after the kitchen and in the first call. They do not establish a p95, a stable service-level expectation or the cause of provider variability. Another pair costs about 2.5 minutes and 0.7M input tokens, most of them read from the cache.

## The benchmark to repeat

Use the commits and settings in manifest.json (local: `.temp/result/baseline-fkwm-az-2026-10-27/manifest.json`). Keep the planner on port 5173 and check that its checkout is the one to measure; the example page pins the embedding-lib. Keep `"provider": "gpt-6-astra", "apiKey": "$AZURE_GPT_KEY"` with the key in AZURE_GPT_KEY. Do not silently substitute another provider.

```sh
cd .temp/result/baseline-fkwm-az-2026-10-27
node make-timing-runner.mjs
REPS=1,2 node run-reps.mjs fkwm
node analyze.mjs fkwm-rep-1 fkwm-rep-2
node write-baseline.mjs
```

Before a new capture, copy these scripts into a fresh dated session directory and point the paths there; never overwrite this evidence. A measurement against this baseline uses the same test, the same settings and a report of this layout.

Retain run.json, timeline.json, planner-calls.json, plan-context.json, source SHAs, exclusions and snapshot IDs. Compute interval unions rather than summing concurrent tools; check the counts against the model usage and recorded calls.

Verification performed: every model request paired with a completed model call and its diagnostics bytes; all tool starts paired with ends; the nested planner calls paired with their log lines, the two parallel reads before the first request by their method; the interval accounting reconciles with the full-turn duration; both snapshot IDs present; the roomle-ui checkout stayed on a8fe64618 through both runs.
