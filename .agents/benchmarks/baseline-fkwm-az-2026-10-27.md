# full-kitchen-walnut-marble-corner: detailed Azure gpt-6-astra timing — the baseline

| Field | Value |
|---|---|
| Type / domain | Benchmark / HI Planning Assistant |
| Trigger | The baseline of the time measurement for full-kitchen-walnut-marble-corner on the Azure deployment, with proposals A, B, D, E, F, the plan state per turn and the two-level attribute section (D122) in place; RML-18303 |
| Date / author | 2026-10-28 / Claude Code |
| Status | Measured: two completed turns, two saved plans |
| Ticket | [RML-18303](https://roomle.atlassian.net/browse/RML-18303) |
| Data | Measurements are retained in the tables below; raw captures remain in the ignored .temp/result/baseline-fkwm-az-2026-10-28 folder |
| Repeat | Same fixture, the Azure deployment, the local planner and the published embedding-lib; procedure below |

Affected repositories:

- **roomle-hi-example:** this benchmark report and the documentation indexes. Raw evidence remains local in .temp.
- **roomle-ui:** the planner and the embedding-lib measured, unchanged.

## Executive summary

The first completed kitchen create took **24.285 s** and **23.676 s** from assistant turn start; mean **23.980 s**. The complete assistant turn took **32.778 s** and **29.054 s**; mean **30.916 s**. Model calls occupied **89.30%** and **89.57%** of those turns.

Both runs create the kitchen in **model call 2**. Call 1 fetches the kitchen skill — with its planning reference in one result — and the library reference and the plan state come with the turn, read in **18.5 ms** and **20.3 ms** before the first request. The create call is the largest block: **17.615 s** and **18.714 s**, of which **10.132 s** and **11.346 s** pass before its first output, with 229 and 220 reasoning tokens. Kitchen creation itself took **3.473 s** and **2.999 s**. The first call, the skill fetch, waited 2.475 s and 1.528 s for its response headers, 22 output tokens without reasoning.

After the kitchen, both runs answer: run 1 after **8.493 s**, run 2 after **5.378 s**. These are request/response wall times, including network and provider work, not isolated server compute times. The first-kitchen milestone is successful create-tool completion: a conservative point by which the kitchen has been loaded into the plan, not a measured first painted GPU frame.

## What was asked and run

Test: **full-kitchen-walnut-marble-corner**, from [docs/test-prompts.json](../../docs/test-prompts.json).

> create a kitchen with an oven, hob, cooker hood, fridge, sink and cabinet with drawers, as well as wall cabinets in the back right corner of the room. Arrange the kitchen around the corner. The front of the kitchen should be made of walnut and the worktop should be made of dark marble

Starting plan: **ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv**, default-room. Exactly this prompt was sent; the optional suite prompt suffix was omitted. Two fresh browsers and conversations used the same prompt and source revisions. No random cases, provider warm-up requests or request pacing were added.

| Setting | Measured value |
|---|---|
| Provider / key reference | `"provider": "gpt-6-astra", "apiKey": "$AZURE_GPT_KEY"`; resolved key never written to artifacts |
| Actual provider endpoint | https://dfhifoundrysweden.services.ai.azure.com/openai/v1/responses (the HI Azure AI Foundry resource, Responses API, reference cache breakpoint on) |
| Reasoning effort | Provider default; no explicit reasoning override |
| Planner | http://localhost:5173/; the already running local roomle-ui, feat/hi-mcp-performance |
| Assistant / embedding source | https://cdn.jsdelivr.net/npm/@roomle/embedding-lib@0.0.0-dev-1b4351d (roomle-embedding-lib.js and hi.js), as the example pins it |
| Example page | http://localhost:3103/ |
| roomle-hi-example SHA | f5b8368 (feat/hi-mcp-performance, at master) |
| roomle-ui SHA | 5fd409e84 (feat/hi-mcp-performance) |
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
| Kitchen skill response complete (timestamp) | 3.192 | 1.960 |
| First kitchen create starts (timestamp) | 20.812 | 20.677 |
| First kitchen create completes (timestamp) | 24.285 | 23.676 |
| Delta: skill responses → first kitchen complete | 21.093 | 21.715 |
| ↳ Agent/model call 2 within that interval | 17.615 | 18.714 |
| ↳ Kitchen creation tool within that interval | 3.473 | 2.999 |
| ↳ Local gaps within that interval | 0.004 | 0.003 |

For example, run 1 takes **21.093 s** from the skill file (3.192 s) to the completed kitchen (24.285 s). The model spends **17.615 s** deciding and emitting the kitchen payload — **10.132 s** of it before its first output, with 229 reasoning tokens —; the create tool then takes **3.473 s**, with about **0.004 s** of local gaps. Run 2 takes **21.715 s** over the same interval.

## Results: milestones and total time

| Measurement (seconds) | Run 1 | Run 2 | Mean |
|---|---|---|---|
| Page/library/assistant ready (recorded run start) | 4.200 | 4.038 | 4.119 |
| Library reference and plan state acquisition inside turn (warm) | 0.018 | 0.020 | 0.019 |
| First model generated output (turn start) | 2.883 | 1.698 | 2.290 |
| First visible assistant text (turn start) | 13.328 | 13.309 | 13.318 |
| First successful kitchen create completed (turn start) | 24.285 | 23.676 | 23.980 |
| First successful kitchen create completed (recorded run start) | 28.488 | 27.716 | 28.102 |
| First successful kitchen create completed (subprocess start) | 28.720 | 27.956 | 28.338 |
| Create tool execution alone | 3.473 | 2.999 | 3.236 |
| Assistant turn start → answer complete | 32.778 | 29.054 | 30.916 |
| Time after the first kitchen until answer complete | 8.493 | 5.378 | 6.935 |
| Runner chat phase (includes the collection) | 33.297 | 29.578 | 31.438 |
| Post-chat context, images and saved snapshot | 5.145 | 6.348 | 5.747 |
| Recorded run: ready + chat + snapshot | 42.642 | 39.964 | 41.303 |
| Full subprocess: browser startup through launcher shutdown | 55.518 | 40.449 | 47.983 |

"First kitchen" here means the first successful create-or-replace-groups result, including its placement and returned groups. Each run made one successful create and retained that kitchen. Actual scene insertion happens during the tool and can precede its result; see the limitations below.

## Results: where the assistant turn goes

| Wall time component | Run 1 s | Run 1 share | Run 2 s | Run 2 share |
|---|---|---|---|---|
| Model calls (union) | 29.271 | 89.30% | 26.023 | 89.57% |
| Tools including the reads before the first request (union) | 3.491 | 10.65% | 3.017 | 10.38% |
| Model/tool overlap (subtract once) | 0.000 | 0.00% | 0.000 | 0.00% |
| Other client work / gaps | 0.016 | 0.05% | 0.014 | 0.05% |
| Assistant turn | 32.778 | 100.00% | 29.054 | 100.00% |

The model sum is taken from the SDK's measured call durations; the tool union comes from browser start/end intervals. The remaining client time closes the measured turn exactly before display rounding. Summing individual tool durations would overcount the concurrent tools.

## Results: model, tools and planner calls in order

### Run 1

Recorded start: **2026-10-28T06:36:23.493Z** (28/10/2026 07:36:23 Europe/Vienna). Model/provider: Azure Responses, gpt-6-astra.

**Agent steps — duration per decision and tool execution**

| Step | Result / following tools | Start s | End s | Agent/model delta s | Tools delta s | Total step delta s |
|---|---|---|---|---|---|---|
| 1 | get-skill (kitchen-planning) | 0.023 | 3.192 | 3.167 | 0.001 | 3.169 |
| 2 | create-or-replace-groups | 3.195 | 24.285 | 17.615 | 3.473 | 21.090 |
| 3 | Final answer | 24.286 | 32.778 | 8.488 | 0.000 | 8.492 |

| Call | SDK start s | End s | Delta s (model) | First output s¹ | Remaining s² | Input tokens | Output / reasoning | Request bytes | Tools after model |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.023 | 3.190 | 3.167 | 2.860 | 0.307 | 68,238 | 22 / 0 | 308,613 | #3 get-skill |
| 2 | 3.195 | 20.811 | 17.615 | 10.132 | 7.483 | 75,139 | 761 / 229 | 80,176 | #4 create-or-replace-groups |
| 3 | 24.286 | 32.774 | 8.488 | 5.048 | 3.440 | 86,259 | 205 / 54 | 83,377 | Final answer |

¹ From the SDK model-call start to its first generated output; this can be reasoning, a tool call or text. ² The remaining model-stream time is response duration minus first-output duration. It is not a pure text-generation or reasoning measurement. Request fetch starts and response-header times remain in the local timeline.json capture.

| Call | Tool / requested information | Start s | End s | Delta s (tool) | Elapsed ms | Nested planner ms³ | Remaining ms⁴ | Result bytes | Result |
|---|---|---|---|---|---|---|---|---|---|
| 1 | get-plan-context: articles, attributes | 0.001 | 0.016 | 0.0153 | 15.3 | 5.7 | 9.6 | 232,777 | OK |
| 2 | get-plan-context: rooms, groups, obstacles, installationElements | 0.001 | 0.017 | 0.0164 | 16.4 | 2.6 | 13.8 | 5,631 | OK |
| 3 | get-skill: kitchen-planning / SKILL.md | 3.191 | 3.192 | 0.0009 | 0.9 | 0.0 | 0.9 | 35,685 | OK |
| 4 | create-or-replace-groups: 1 group, 14 roots; placement right / back | 20.812 | 24.285 | 3.4734 | 3473.4 | 3216.8 | 256.6 | 38,886 | OK |

³ Union of the underlying planner-call intervals inside this tool. ⁴ Tool elapsed minus nested planner intervals: forwarding, scheduling, validation, projection, serialization and any uninstrumented work. This is not a pure CPU measurement. Calls #1 and #2 are the assistant's automatic reads of the library reference and the plan state, before the first model request, rather than model-requested tools.

| Call | Containing tool | Planner method / arguments | Start s | End s | Delta s (planner) | Elapsed ms |
|---|---|---|---|---|---|---|
| 1 | #1 | getExternalObjectLibraryContext [["articles","masterData"]] | 0.002 | 0.007 | 0.0057 | 5.7 |
| 2 | #2 | getExternalObjectPlanContext [["rooms","groups","obstacles","installationElements"]] | 0.010 | 0.013 | 0.0026 | 2.6 |
| 3 | #4 | getExternalObjectPlanContext [["groups"]] | 20.814 | 20.815 | 0.0004 | 0.4 |
| 4 | #4 | externalObjectGroupOperation ["create-or-replace-groups"] | 20.815 | 24.021 | 3.2066 | 3206.6 |
| 5 | #4 | getExternalObjectPlanContext [["groups"]] | 24.022 | 24.031 | 0.0098 | 9.8 |

The planner's own price refresh after the plan change, without a tool: 21.796–23.760 s, 24.310–24.948 s, 24.949–25.710 s.

Local capture: `.temp/result/baseline-fkwm-az-2026-10-28/fkwm-rep-1/` (run.json, timeline.json, planner-calls.json and plan-context.json).

### Run 2

Recorded start: **2026-10-28T06:37:19.036Z** (28/10/2026 07:37:19 Europe/Vienna). Model/provider: Azure Responses, gpt-6-astra.

**Agent steps — duration per decision and tool execution**

| Step | Result / following tools | Start s | End s | Agent/model delta s | Tools delta s | Total step delta s |
|---|---|---|---|---|---|---|
| 1 | get-skill (kitchen-planning) | 0.023 | 1.960 | 1.935 | 0.001 | 1.937 |
| 2 | create-or-replace-groups | 1.962 | 23.676 | 18.714 | 2.999 | 21.714 |
| 3 | Final answer | 23.677 | 29.054 | 5.375 | 0.000 | 5.377 |

| Call | SDK start s | End s | Delta s (model) | First output s¹ | Remaining s² | Input tokens | Output / reasoning | Request bytes | Tools after model |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.023 | 1.958 | 1.935 | 1.674 | 0.261 | 68,238 | 22 / 0 | 308,613 | #3 get-skill |
| 2 | 1.962 | 20.676 | 18.714 | 11.346 | 7.368 | 75,139 | 740 / 220 | 80,176 | #4 create-or-replace-groups |
| 3 | 23.677 | 29.051 | 5.375 | 1.900 | 3.474 | 85,837 | 164 / 0 | 81,744 | Final answer |

¹ From the SDK model-call start to its first generated output; this can be reasoning, a tool call or text. ² The remaining model-stream time is response duration minus first-output duration. It is not a pure text-generation or reasoning measurement. Request fetch starts and response-header times remain in the local timeline.json capture.

| Call | Tool / requested information | Start s | End s | Delta s (tool) | Elapsed ms | Nested planner ms³ | Remaining ms⁴ | Result bytes | Result |
|---|---|---|---|---|---|---|---|---|---|
| 1 | get-plan-context: articles, attributes | 0.000 | 0.016 | 0.0157 | 15.7 | 5.8 | 9.9 | 232,777 | OK |
| 2 | get-plan-context: rooms, groups, obstacles, installationElements | 0.001 | 0.017 | 0.0167 | 16.7 | 2.7 | 14.0 | 5,631 | OK |
| 3 | get-skill: kitchen-planning / SKILL.md | 1.960 | 1.960 | 0.0008 | 0.8 | 0.0 | 0.8 | 35,685 | OK |
| 4 | create-or-replace-groups: 1 group, 13 roots; placement right / back | 20.677 | 23.676 | 2.9990 | 2999.0 | 2798.0 | 201.0 | 37,253 | OK |

³ Union of the underlying planner-call intervals inside this tool. ⁴ Tool elapsed minus nested planner intervals: forwarding, scheduling, validation, projection, serialization and any uninstrumented work. This is not a pure CPU measurement. Calls #1 and #2 are the assistant's automatic reads of the library reference and the plan state, before the first model request, rather than model-requested tools.

| Call | Containing tool | Planner method / arguments | Start s | End s | Delta s (planner) | Elapsed ms |
|---|---|---|---|---|---|---|
| 1 | #1 | getExternalObjectLibraryContext [["articles","masterData"]] | 0.001 | 0.007 | 0.0058 | 5.8 |
| 2 | #2 | getExternalObjectPlanContext [["rooms","groups","obstacles","installationElements"]] | 0.010 | 0.013 | 0.0027 | 2.7 |
| 3 | #4 | getExternalObjectPlanContext [["groups"]] | 20.679 | 20.679 | 0.0003 | 0.3 |
| 4 | #4 | externalObjectGroupOperation ["create-or-replace-groups"] | 20.679 | 23.467 | 2.7875 | 2787.5 |
| 5 | #4 | getExternalObjectPlanContext [["groups"]] | 23.467 | 23.477 | 0.0102 | 10.2 |

The planner's own price refresh after the plan change, without a tool: 21.606–23.743 s, 23.759–24.197 s, 24.198–24.748 s.

Local capture: `.temp/result/baseline-fkwm-az-2026-10-28/fkwm-rep-2/` (run.json, timeline.json, planner-calls.json and plan-context.json).

## Context, cache and transport

| Measurement | Run 1 | Run 2 |
|---|---|---|
| Model calls | 3 | 3 |
| Tools including the reads before the first request | 4 | 4 |
| Input tokens | 229,636 | 229,214 |
| Output tokens (include reasoning) | 988 | 926 |
| Reasoning tokens | 283 | 220 |
| Cache-read tokens / share of input | 218,507 / 95.15% | 218,507 / 95.33% |
| Cache-write tokens | 11,120 | 10,698 |
| First call: cache-read tokens | 68,235 | 68,235 |
| Request JSON bytes, all calls | 472,166 | 470,533 |
| Reference bytes (exclude tools/current input) | 258,251 | 258,251 |
| Shared-reference SHA-256 | `b6d6b7dc146b5cd3af90c9d01e3cdce3a6b52ea12099c6234e5d4a48c976f4e8` | `b6d6b7dc146b5cd3af90c9d01e3cdce3a6b52ea12099c6234e5d4a48c976f4e8` |
| Plan state bytes (supplied with the turn) | 4,822 | 4,822 |
| Information tools, elapsed union ms | 17.4 | 17.7 |
| Information tools, summed call ms (overlap included) | 32.6 | 33.2 |
| Saved plan snapshot | `ps_t3l4xegzy1w11qaaqvinkk5o2bjhb0g` | `ps_t3l12bf7g2woyg51nm4iq5473rhrcia3` |

All token/cache/reasoning fields have complete coverage for completed calls. Cache reads are already part of input tokens and reasoning is already part of output tokens. Request bytes count the whole uncompressed JSON sent on every fetch. With Responses chaining a later request carries only its new input, so a whole turn sends **472,166** and **470,533 bytes**, of which the first request is **308,613 bytes**. Both runs read the same shared reference, **258,251 bytes** with the same SHA-256 as the image baseline. The first call of each run reads **68,235 of its 68,238 input tokens** from the cache; over the turn the cache covers 95.15% and 95.33% of the input. A fresh browser does not establish a cold provider cache.

The library reference returns **232,777 bytes**, the plan state **5,631 bytes**; both come with the turn before the first request. No run renders: a text creation has no occasion for the plan images.

## Findings and the evidence behind them

### 1. The create call is where the time before the first kitchen goes

Call 1 ends after **3.190 / 1.958 s** with the skill request. Call 2, the create, then takes **17.615 / 18.714 s**: **10.132 / 11.346 s** until its first output and **7.483 / 7.368 s** streaming the payload, with **229 / 220 reasoning tokens** and **761 / 740 output tokens**. The create tool adds **3.473 / 2.999 s**, the local gaps a few milliseconds. Of the 24.285 / 23.676 s to the first kitchen, the create call is 73% / 79%.

The request/model boundary localizes this to the model round trip, not planner execution. The cause inside that boundary is **unknown**: provider queueing, input processing, reasoning, generation and network are not separately exposed. The text kitchen reasons longer before its payload than the image kitchen of [the image baseline](baseline-iklw-az-2026-10-27.md) (8.913 / 5.736 s, 200 / 123 reasoning tokens): it composes 14 and 13 root modules around a corner where the image kitchen copies a row of nine.

### 2. Information gathering is cheap locally; the reads come with the turn

The library reference and the plan state are read in parallel before the first request: **15.3 / 16.4 ms** in run 1 and **15.7 / 16.7 ms** in run 2 as tools, **5.7 / 2.6 ms** and **5.8 / 2.7 ms** in the planner. The skill takes **0.9 / 0.8 ms**. All information tools of a turn take **17.4 / 17.7 ms** in union. No model call reads the live plan sections, before the create or after it.

### 3. Neither run corrects its kitchen after the create

The creates got no hint; their corrections name what the library set along with the group attributes — the carcase program and the insertion heights. Both runs answer in call 3, **8.488 / 5.375 s**, 5.048 / 1.900 s of it until the first output. Run 1's back run ends 694 mm before the window and its right-wall leg 184 mm before the doorway, run 2's 394 and 484 mm.

### 4. The first call waits briefly without reasoning

The first call — the skill fetch, 22 output tokens and no reasoning — waits **2.475 / 1.528 s** for its response headers and 2.860 / 1.674 s for its first output. Both first calls read 68,235 of their 68,238 input tokens from the provider's cache. No call of the two turns waits long for its first output without reasoning.

### 5. The kitchen is the requested one

Both snapshots contain an L-shaped kitchen around the back right corner at [4815, 3765, 0] with **rotationZ = 270°**: on the back wall the sink unit SUT60, drawer units and wall cabinets; on the right wall drawer units, the oven-and-hob unit UHS60 with the cooker hood DU above it and the tall fridge HK60 at the end of the leg, wall cabinets; Walnut fronts and carcases in the Nature program and a Dark marble worktop, as asked. Run 1 builds 14 root modules around the corner unit UERTB90 (2,471 mm along the back wall, 3,861 mm along the right wall), run 2 13 around the same corner unit (2,771 / 3,561 mm, a 25 mm worktop). The perspectives and top views were inspected: both kitchens stand clear of the window and the door.

## Proposed experiments and rejected conclusions

| Candidate | What this run supports | Expected saving / limit |
|---|---|---|
| Less to decide in the create call | The create call takes 17.615 / 18.714 s, 10.132 / 11.346 s of it before its first output, with 229 / 220 reasoning tokens | The largest block before the first kitchen. The worked examples of a create payload are in the served text already; the reasoning effort is out of scope at the moment. No lever is open. |
| Plan the window clearance in the create | Neither run changes its kitchen after the create; both stand clear of the window | The create sees the window in the plan state. No saving is open in these runs. |
| A watchdog for calls without a first output | The first calls wait 2.475 / 1.528 s for their headers without reasoning | A resend doubles the cost of a legitimate long reasoning. Measure the tail over more runs first. |
| Tool memoization / attribute indexing / precalculated docking vectors | The information tools take 17.4 / 17.7 ms in union; the create tool 3.473 / 2.999 s | Local work is not the bottleneck: removing every information tool saves milliseconds. |

## Measurement gaps and open work

- **First painted frame:** no GPU presentation/paint marker was captured. Create-tool completion is an upper bound for a loaded kitchen; first visible geometry could appear earlier within the 2.999–3.473 s create.
- **Provider internals:** model time combines network, queueing, input processing, reasoning, generation and SDK stream handling. Time to first output does not isolate prefill; response-header time does not isolate network RTT.
- **Tool internals:** the planner table separates planner access from the surrounding tool, but does not profile every individual filtering, projection, docking, library-calculation or kernel-load function. Remaining tool time must not be renamed CPU assembly time.
- **Final text start:** first visible text refers to the first planning preamble; the end of the turn marks completion of the final answer. Final-answer text-delta start was not separately instrumented.
- **Startup attribution:** page/module/library/plan/assistant initialization, the runner's readiness read and the assistant's library read before the first prompt overlap inside the ready phase. They were not profiled individually.
- **Instrumentation overhead:** extra console events, UTF-8 size measurement and log delivery add unquantified overhead; both runs have the same hooks. The planner is a Vite development server; do not use these page-startup numbers as production cold-start numbers.
- **Sampling:** two runs establish a repeated measurement and show the variation of single calls. They do not establish a p95, a stable service-level expectation or the cause of provider variability. Another pair costs about 1.6 minutes and 0.46M input tokens, most of them read from the cache.

## The benchmark to repeat

Use the commits and settings in manifest.json (local: `.temp/result/baseline-fkwm-az-2026-10-28/manifest.json`). Keep the planner on port 5173 and check that its checkout is the one to measure; the example page pins the embedding-lib. Keep `"provider": "gpt-6-astra", "apiKey": "$AZURE_GPT_KEY"` with the key in AZURE_GPT_KEY. Do not silently substitute another provider.

```sh
cd .temp/result/baseline-fkwm-az-2026-10-28
node make-timing-runner.mjs
REPS=1,2 node run-reps.mjs fkwm
node analyze.mjs fkwm-rep-1 fkwm-rep-2
node write-baseline.mjs
```

Before a new capture, copy these scripts into a fresh dated session directory and point the paths there; never overwrite this evidence. A measurement against this baseline uses the same test, the same settings and a report of this layout.

Retain run.json, timeline.json, planner-calls.json, plan-context.json, source SHAs, exclusions and snapshot IDs. Compute interval unions rather than summing concurrent tools; check the counts against the model usage and recorded calls.

Verification performed: every model request paired with a completed model call and its diagnostics bytes; all tool starts paired with ends; the nested planner calls paired with their log lines, the two parallel reads before the first request by their method; the interval accounting reconciles with the full-turn duration; both snapshot IDs present; the roomle-ui checkout stayed on 5fd409e84 through both runs.
