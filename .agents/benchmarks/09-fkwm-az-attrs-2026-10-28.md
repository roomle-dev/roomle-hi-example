# full-kitchen-walnut-marble-corner: detailed Azure gpt-6-astra timing — benchmark 09, the two-level attribute section

| Field | Value |
|---|---|
| Type / domain | Benchmark / HI Planning Assistant |
| Trigger | Benchmark 09: the two-level attribute section (D122) — the values of the attributes a planning sets at the create in the prefix, every other attribute with the number of its values and its values through find-attributes —, measured against [the baseline](baseline-fkwm-az-2026-10-27.md); RML-18303 |
| Date / author | 2026-10-27 / Claude Code |
| Status | Measured: two completed turns, two saved plans |
| Ticket | [RML-18303](https://roomle.atlassian.net/browse/RML-18303) |
| Data | Measurements are retained in the tables below; raw captures remain in the ignored .temp/result/benchmark-09-az-attrs-2026-10-27 folder |
| Repeat | The fixture and settings of the baseline, the local planner with the two-level attribute section and the published embedding-lib; procedure below |

Affected repositories:

- **roomle-hi-example:** this benchmark report and the documentation indexes. Raw evidence remains local in .temp.
- **roomle-ui:** the planner measured with the two-level attribute section — 5fd409e84 on feat/hi-mcp-performance, merged into feat/hi-mcp-merge as 4415cdffd; the embedding-lib unchanged.

## Executive summary

The first completed kitchen create took **28.868 s** and **26.337 s** from assistant turn start; mean **27.603 s** (the baseline: 38.086 s). The complete assistant turn took **34.379 s** and **31.624 s**; mean **33.002 s** (57.925 s). Model calls occupied **92.64%** and **91.84%** of those turns.

Both runs create the kitchen in **model call 2**, and no run looks anything up before it or after it: the create sets the walnut fronts (Nature 215) and the dark marble worktop (324) from the value lists the attributes section keeps and leaves the hob and oven models — shown with `valueCount` — to the article, whose ET601FNP1E and HE510ABS2 are the models the baseline's creates had chosen. Every first request carries **68,049 input tokens**, **8,722 fewer** than the baseline's 76,771. The create call takes **22.008 s** and **21.669 s** (30.035 / 26.826 s), of which **15.946 s** and **12.794 s** pass before its first output (19.982 / 17.294 s), with 290 / 230 reasoning tokens (431 / 404) and 699 / 781 output tokens (1,005 / 1,009). Kitchen creation itself took **2.484 s** and **2.548 s**.

After the kitchen both runs answer at once: **5.511 s** and **5.287 s**. The baseline's turn was longer by its run 1, which deleted two units after the create to clear the window, and its first-kitchen time by a cold first call in run 1 and a 10 s wait in run 2. These are request/response wall times, including network and provider work, not isolated server compute times.

## What was asked and run

Test: **full-kitchen-walnut-marble-corner**, from [docs/test-prompts.json](../../docs/test-prompts.json).

> create a kitchen with an oven, hob, cooker hood, fridge, sink and cabinet with drawers, as well as wall cabinets in the back right corner of the room. Arrange the kitchen around the corner. The front of the kitchen should be made of walnut and the worktop should be made of dark marble

Starting plan: **ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv**, default-room. Exactly this prompt was sent; the optional suite prompt suffix was omitted. Two fresh browsers and conversations used the same prompt and source revisions. No random cases, provider warm-up requests or request pacing were added.

| Setting | Measured value |
|---|---|
| Provider / key reference | `"provider": "gpt-6-astra", "apiKey": "$AZURE_GPT_KEY"`; resolved key never written to artifacts |
| Actual provider endpoint | https://dfhifoundrysweden.services.ai.azure.com/openai/v1/responses (the HI Azure AI Foundry resource, Responses API, reference cache breakpoint on) |
| Reasoning effort | Provider default; no explicit reasoning override |
| Planner | http://localhost:5173/; the already running local roomle-ui, feat/hi-mcp-merge with the two-level attribute section |
| Assistant / embedding source | https://cdn.jsdelivr.net/npm/@roomle/embedding-lib@0.0.0-dev-1b4351d (roomle-embedding-lib.js and hi.js), as the example pins it |
| Example page | http://localhost:3103/ |
| roomle-hi-example SHA | 2ca86ef (docs/attribute-information-validation) |
| roomle-ui SHA | 4415cdffd (feat/hi-mcp-merge); the change 5fd409e84 on feat/hi-mcp-performance |
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
| Kitchen skill response complete (timestamp) | 4.371 | 2.116 |
| First kitchen create starts (timestamp) | 26.384 | 23.789 |
| First kitchen create completes (timestamp) | 28.868 | 26.337 |
| Delta: skill responses → first kitchen complete | 24.497 | 24.220 |
| ↳ Agent/model call 2 within that interval | 22.008 | 21.669 |
| ↳ Kitchen creation tool within that interval | 2.484 | 2.548 |
| ↳ Local gaps within that interval | 0.005 | 0.003 |

For example, run 1 takes **24.497 s** from the skill file (4.371 s) to the completed kitchen (28.868 s). The model spends **22.008 s** deciding and emitting the kitchen payload — **15.946 s** of it before its first output, with 290 reasoning tokens —; the create tool then takes **2.484 s**, with about **0.005 s** of local gaps. Run 2 takes **24.221 s** over the same interval. The baseline took 33.071 / 29.521 s.

## Results: milestones and total time

| Measurement (seconds) | Run 1 | Run 2 | Mean |
|---|---|---|---|
| Page/library/assistant ready (recorded run start) | 5.184 | 5.715 | 5.449 |
| Library reference and plan state acquisition inside turn (warm) | 0.030 | 0.019 | 0.025 |
| First model generated output (turn start) | 4.030 | 1.817 | 2.924 |
| First visible assistant text (turn start) | 30.983 | 14.913 | 22.948 |
| First successful kitchen create completed (turn start) | 28.868 | 26.337 | 27.602 |
| First successful kitchen create completed (recorded run start) | 34.057 | 32.054 | 33.056 |
| First successful kitchen create completed (subprocess start) | 34.299 | 32.279 | 33.289 |
| Create tool execution alone | 2.484 | 2.548 | 2.516 |
| Assistant turn start → answer complete | 34.379 | 31.624 | 33.001 |
| Time after the first kitchen until answer complete | 5.511 | 5.287 | 5.399 |
| Runner chat phase (includes the collection) | 34.914 | 32.143 | 33.529 |
| Post-chat context, images and saved snapshot | 5.344 | 5.549 | 5.447 |
| Recorded run: ready + chat + snapshot | 45.442 | 43.407 | 44.425 |
| Full subprocess: browser startup through launcher shutdown | 45.925 | 43.880 | 44.903 |

"First kitchen" here means the first successful create-or-replace-groups result, including its placement and returned groups. Each run made one successful create and retained that kitchen. Actual scene insertion happens during the tool and can precede its result; see the limitations below.

## Results: where the assistant turn goes

| Wall time component | Run 1 s | Run 1 share | Run 2 s | Run 2 share |
|---|---|---|---|---|
| Model calls (union) | 31.848 | 92.64% | 29.045 | 91.84% |
| Tools including the reads before the first request (union) | 2.513 | 7.31% | 2.565 | 8.11% |
| Model/tool overlap (subtract once) | 0.000 | 0.00% | 0.000 | 0.00% |
| Other client work / gaps | 0.019 | 0.05% | 0.014 | 0.04% |
| Assistant turn | 34.379 | 100.00% | 31.624 | 100.00% |

The model sum is taken from the SDK's measured call durations; the tool union comes from browser start/end intervals. The remaining client time closes the measured turn exactly before display rounding. Summing individual tool durations would overcount the concurrent tools.

## Results: model, tools and planner calls in order

### Run 1

Recorded start: **2026-10-27T20:30:40.995Z** (27/10/2026 21:30:40 Europe/Vienna). Model/provider: Azure Responses, gpt-6-astra.

**Agent steps — duration per decision and tool execution**

| Step | Result / following tools | Start s | End s | Agent/model delta s | Tools delta s | Total step delta s |
|---|---|---|---|---|---|---|
| 1 | get-skill (kitchen-planning) | 0.034 | 4.371 | 4.333 | 0.002 | 4.337 |
| 2 | create-or-replace-groups | 4.375 | 28.868 | 22.008 | 2.484 | 24.493 |
| 3 | Final answer | 28.869 | 34.379 | 5.506 | 0.000 | 5.510 |

| Call | SDK start s | End s | Delta s (model) | First output s¹ | Remaining s² | Input tokens | Output / reasoning | Request bytes | Tools after model |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.034 | 4.367 | 4.333 | 3.996 | 0.337 | 68,049 | 22 / 0 | 308,028 | #3 get-skill |
| 2 | 4.375 | 26.384 | 22.008 | 15.946 | 6.062 | 74,950 | 699 / 290 | 80,176 | #4 create-or-replace-groups |
| 3 | 28.869 | 34.375 | 5.506 | 2.114 | 3.392 | 84,015 | 145 / 0 | 75,827 | Final answer |

¹ From the SDK model-call start to its first generated output; this can be reasoning, a tool call or text. ² The remaining model-stream time is response duration minus first-output duration. It is not a pure text-generation or reasoning measurement. Request fetch starts and response-header times remain in the local timeline.json capture.

| Call | Tool / requested information | Start s | End s | Delta s (tool) | Elapsed ms | Nested planner ms³ | Remaining ms⁴ | Result bytes | Result |
|---|---|---|---|---|---|---|---|---|---|
| 1 | get-plan-context: articles, attributes | 0.000 | 0.026 | 0.0258 | 25.8 | 10.1 | 15.7 | 232,192 | OK |
| 2 | get-plan-context: rooms, groups, obstacles, installationElements | 0.001 | 0.027 | 0.0269 | 26.9 | 2.6 | 24.3 | 5,631 | OK |
| 3 | get-skill: kitchen-planning / SKILL.md | 4.369 | 4.371 | 0.0017 | 1.7 | 0.0 | 1.7 | 35,685 | OK |
| 4 | create-or-replace-groups: 1 group, 12 roots; placement right / back | 26.384 | 28.868 | 2.4838 | 2483.8 | 2412.6 | 71.2 | 31,336 | OK |

³ Union of the underlying planner-call intervals inside this tool. ⁴ Tool elapsed minus nested planner intervals: forwarding, scheduling, validation, projection, serialization and any uninstrumented work. This is not a pure CPU measurement. Calls #1 and #2 are the assistant's automatic reads of the library reference and the plan state, before the first model request, rather than model-requested tools.

| Call | Containing tool | Planner method / arguments | Start s | End s | Delta s (planner) | Elapsed ms |
|---|---|---|---|---|---|---|
| 1 | #1 | getExternalObjectLibraryContext [["articles","masterData"]] | 0.002 | 0.012 | 0.0101 | 10.1 |
| 2 | #2 | getExternalObjectPlanContext [["rooms","groups","obstacles","installationElements"]] | 0.015 | 0.018 | 0.0026 | 2.6 |
| 3 | #4 | getExternalObjectPlanContext [["groups"]] | 26.386 | 26.386 | 0.0002 | 0.2 |
| 4 | #4 | externalObjectGroupOperation ["create-or-replace-groups"] | 26.387 | 28.791 | 2.4041 | 2404.1 |
| 5 | #4 | getExternalObjectPlanContext [["groups"]] | 28.791 | 28.799 | 0.0083 | 8.3 |

The planner's own price refresh after the plan change, without a tool: 27.206–28.932 s, 28.946–29.446 s, 29.470–30.235 s.

Local capture: `.temp/result/benchmark-09-az-attrs-2026-10-27/fkwm-rep-1/` (run.json, timeline.json, planner-calls.json and plan-context.json).

### Run 2

Recorded start: **2026-10-27T20:31:26.920Z** (27/10/2026 21:31:26 Europe/Vienna). Model/provider: Azure Responses, gpt-6-astra.

**Agent steps — duration per decision and tool execution**

| Step | Result / following tools | Start s | End s | Agent/model delta s | Tools delta s | Total step delta s |
|---|---|---|---|---|---|---|
| 1 | get-skill (kitchen-planning) | 0.023 | 2.116 | 2.092 | 0.000 | 2.093 |
| 2 | create-or-replace-groups | 2.118 | 26.337 | 21.669 | 2.548 | 24.219 |
| 3 | Final answer | 26.337 | 31.624 | 5.283 | 0.000 | 5.286 |

| Call | SDK start s | End s | Delta s (model) | First output s¹ | Remaining s² | Input tokens | Output / reasoning | Request bytes | Tools after model |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.023 | 2.115 | 2.092 | 1.794 | 0.298 | 68,049 | 22 / 0 | 308,028 | #3 get-skill |
| 2 | 2.118 | 23.788 | 21.669 | 12.794 | 8.875 | 74,950 | 781 / 230 | 80,176 | #4 create-or-replace-groups |
| 3 | 26.337 | 31.621 | 5.283 | 1.516 | 3.767 | 85,303 | 158 / 0 | 80,194 | Final answer |

¹ From the SDK model-call start to its first generated output; this can be reasoning, a tool call or text. ² The remaining model-stream time is response duration minus first-output duration. It is not a pure text-generation or reasoning measurement. Request fetch starts and response-header times remain in the local timeline.json capture.

| Call | Tool / requested information | Start s | End s | Delta s (tool) | Elapsed ms | Nested planner ms³ | Remaining ms⁴ | Result bytes | Result |
|---|---|---|---|---|---|---|---|---|---|
| 1 | get-plan-context: articles, attributes | 0.001 | 0.016 | 0.0152 | 15.2 | 5.8 | 9.4 | 232,192 | OK |
| 2 | get-plan-context: rooms, groups, obstacles, installationElements | 0.001 | 0.017 | 0.0163 | 16.3 | 2.5 | 13.8 | 5,631 | OK |
| 3 | get-skill: kitchen-planning / SKILL.md | 2.116 | 2.116 | 0.0004 | 0.4 | 0.0 | 0.4 | 35,685 | OK |
| 4 | create-or-replace-groups: 1 group, 14 roots; placement right / back | 23.789 | 26.337 | 2.5481 | 2548.1 | 2454.5 | 93.6 | 35,703 | OK |

³ Union of the underlying planner-call intervals inside this tool. ⁴ Tool elapsed minus nested planner intervals: forwarding, scheduling, validation, projection, serialization and any uninstrumented work. This is not a pure CPU measurement. Calls #1 and #2 are the assistant's automatic reads of the library reference and the plan state, before the first model request, rather than model-requested tools.

| Call | Containing tool | Planner method / arguments | Start s | End s | Delta s (planner) | Elapsed ms |
|---|---|---|---|---|---|---|
| 1 | #1 | getExternalObjectLibraryContext [["articles","masterData"]] | 0.002 | 0.007 | 0.0058 | 5.8 |
| 2 | #2 | getExternalObjectPlanContext [["rooms","groups","obstacles","installationElements"]] | 0.010 | 0.013 | 0.0025 | 2.5 |
| 3 | #4 | getExternalObjectPlanContext [["groups"]] | 23.791 | 23.792 | 0.0003 | 0.3 |
| 4 | #4 | externalObjectGroupOperation ["create-or-replace-groups"] | 23.792 | 26.237 | 2.4456 | 2445.6 |
| 5 | #4 | getExternalObjectPlanContext [["groups"]] | 26.238 | 26.246 | 0.0086 | 8.6 |

The planner's own price refresh after the plan change, without a tool: 24.633–26.464 s, 26.525–27.197 s.

Local capture: `.temp/result/benchmark-09-az-attrs-2026-10-27/fkwm-rep-2/` (run.json, timeline.json, planner-calls.json and plan-context.json).

## Context, cache and transport

| Measurement | Run 1 | Run 2 |
|---|---|---|
| Model calls | 3 | 3 |
| Tools including the reads before the first request | 4 | 4 |
| Input tokens | 227,014 | 228,302 |
| Output tokens (include reasoning) | 866 | 961 |
| Reasoning tokens | 290 | 230 |
| Cache-read tokens / share of input | 209,216 / 92.16% | 217,940 / 95.46% |
| Cache-write tokens | 17,789 | 10,353 |
| First call: cache-read tokens | 66,223 | 68,046 |
| Request JSON bytes, all calls | 464,031 | 468,398 |
| Reference bytes (exclude tools/current input) | 257,666 | 257,666 |
| Shared-reference SHA-256 | `df3d26033b7fc0275b0bae589b411113d3611a69a8ede7b4ba066347733f525a` | `df3d26033b7fc0275b0bae589b411113d3611a69a8ede7b4ba066347733f525a` |
| Plan state bytes (supplied with the turn) | 4,822 | 4,822 |
| Information tools, elapsed union ms | 28.7 | 16.8 |
| Information tools, summed call ms (overlap included) | 54.4 | 31.9 |
| Saved plan snapshot | `ps_t26h12zd6dnxmlmkcyal6q3qzg2ekt9` | `ps_t26j561ndqcy2m8uug1wt3yk7nb15we` |

All token/cache/reasoning fields have complete coverage for completed calls. Cache reads are already part of input tokens and reasoning is already part of output tokens. Request bytes count the whole uncompressed JSON sent on every fetch. With Responses chaining a later request carries only its new input, so a whole turn sends **464,031** and **468,398 bytes**, of which the first request is **308,028 bytes** (the baseline: 345,510). Both runs read the same shared reference, **257,666 bytes** with the same SHA-256 as the image kitchen of this benchmark — 38,016 bytes less than the baseline's 295,682. The first call of run 1 reads **66,223 of its 68,049 input tokens** from the cache, written by the image kitchen's requests with the same prefix; run 2's first call **68,046**; over the turn the cache covers 92.16% and 95.46% of the input.

The library reference returns **232,192 bytes**, the plan state **5,631 bytes**; both come with the turn before the first request. No run renders: a text creation has no occasion for the plan images.

## Findings and the evidence behind them

### 1. The create call is shorter, and nothing is looked up

Call 1 ends after **4.333 / 2.092 s** with the skill request. Call 2, the create, then takes **22.008 / 21.669 s**: **15.946 / 12.794 s** until its first output and **6.062 / 8.875 s** streaming the payload, with **290 / 230 reasoning tokens** and **699 / 781 output tokens**. The baseline's create calls took 30.035 / 26.826 s with 431 / 404 reasoning tokens and 1,005 / 1,009 output tokens: here the payload sets no hob and oven model — the baseline's set `mod_HobSupplier`, `mod_HobId`, `mod_OvenSupplier1` and `mod_OvenId1` —, and both its creations of 09 fall below the baseline's spread. Two runs per build do not separate the change from the provider's spread; the shorter payload is measured, the shorter reasoning is consistent with fewer values to choose.

### 2. Every request carries 8,722 input tokens less

The first request carries **68,049 input tokens** against **76,771** in the baseline, the create call **74,950** against 83,672, the same 8,722 tokens as in the image kitchen: the value lists that left the attributes section.

### 3. The article keeps the appliance models the baseline chose

Both baseline creates set the hob ET601FNP1E and the oven HE510ABS2 from the lists in the prefix. Here the lists are one call away and the creates leave them to the article, whose values are the same models: the kitchens carry the same hob and oven, and no round looks them up.

### 4. The kitchen is the requested one

Both snapshots contain an L-shaped kitchen around the back right corner at [4815, 3765, 0] with **rotationZ = 270°**: on the back wall the sink unit SUT60, drawer units and wall cabinets; on the right wall drawer units, the oven-and-hob unit UHS60 with the cooker hood DU above it, a base unit and the tall fridge housing HK60, wall cabinets; walnut fronts in the Nature program and a dark marble worktop, as asked. Run 1 builds 12 root modules around the corner unit UERTB90, run 2 14 with two end panels. No create got a hint; both answers say the window and the doorway stay clear. The perspectives were inspected.

## Proposed experiments and rejected conclusions

| Candidate | What this run supports | Expected saving / limit |
|---|---|---|
| Keep the two-level section with the first-kitchen rule | The first kitchen at call 2 with no lookup; 8,722 input tokens less per request; the create call 22.008 / 21.669 s against 30.035 / 26.826 s | For this kitchen the article's values are the ones the baseline chose; the image kitchen of this benchmark shows the cost where they are not (the sink). |
| A watchdog for calls without a first output | No call here waited long; the baseline's run 2 waited 9.96 s in its first call | A resend doubles the cost of a legitimate long reasoning. Measure the tail over more runs first. |
| Tool memoization / attribute indexing / precalculated docking vectors | The information tools take milliseconds; the create tool 2.484 / 2.548 s | Local work is not the bottleneck. |

## Measurement gaps and open work

- **First painted frame:** no GPU presentation/paint marker was captured. Create-tool completion is an upper bound for a loaded kitchen; first visible geometry could appear earlier within the 2.484–2.548 s create.
- **Provider internals:** model time combines network, queueing, input processing, reasoning, generation and SDK stream handling. Time to first output does not isolate prefill; response-header time does not isolate network RTT.
- **Tool internals:** the planner table separates planner access from the surrounding tool, but does not profile every individual filtering, projection, docking, library-calculation or kernel-load function. Remaining tool time must not be renamed CPU assembly time.
- **Final text start:** first visible text refers to the first planning preamble; the end of the turn marks completion of the final answer. Final-answer text-delta start was not separately instrumented.
- **Startup attribution:** page/module/library/plan/assistant initialization, the runner's readiness read and the assistant's library read before the first prompt overlap inside the ready phase. They were not profiled individually.
- **Instrumentation overhead:** extra console events, UTF-8 size measurement and log delivery add unquantified overhead; both runs have the same hooks. The planner is a Vite development server; do not use these page-startup numbers as production cold-start numbers.
- **Sampling:** two runs establish a repeated measurement and show large variation after the kitchen and in the first call. They do not establish a p95, a stable service-level expectation or the cause of provider variability. Another pair costs about 1.5 minutes and 0.5M input tokens, most of them read from the cache.5 minutes and 0.7M input tokens, most of them read from the cache.
- **The baseline's first-kitchen time:** its run 1 met a cold cache and its run 2 a 10 s first call; the skill-to-kitchen interval (24.497 / 24.221 s against 33.071 / 29.521 s) and the create call compare better than the turn start.

## The benchmark to repeat

Use the commits, and settings in manifest.json (local: `.temp/result/benchmark-09-az-attrs-2026-10-27/manifest.json`). Keep the planner on port 5173 and check that its checkout is the one to measure — here `feat/hi-mcp-merge` at 4415cdffd, the baselines' a8fe64618 plus the two-level attribute section; the example page pins the embedding-lib. Keep `"provider": "gpt-6-astra", "apiKey": "$AZURE_GPT_KEY"` with the key in AZURE_GPT_KEY. Do not silently substitute another provider.

```sh
cd .temp/result/benchmark-09-az-attrs-2026-10-27
node make-timing-runner.mjs
REPS=1,2 node run-reps.mjs iklw fkwm
node analyze.mjs iklw-rep-1 iklw-rep-2 fkwm-rep-1 fkwm-rep-2
node write-prose.mjs
node write-09-fkwm.mjs
```

The timing runner is byte for byte the baselines' (the prompt runner is unchanged since); `analyze.mjs` is the baselines' with one change, a `find-attributes` call by `ids` labelled by its ids. `probe/` holds the sections read without a model before the runs. Before a new capture, copy these scripts into a fresh dated session directory and point the paths there; never overwrite this evidence.

Retain run.json, timeline.json, planner-calls.json, plan-context.json, source SHAs, exclusions and snapshot IDs. Compute interval unions rather than summing concurrent tools; check the counts against the model usage and recorded calls.

Verification performed: every model request paired with a completed model call and its diagnostics bytes; all tool starts paired with ends; the nested planner calls paired with their log lines, the two parallel reads before the first request by their method; the interval accounting reconciles with the full-turn duration; both snapshot IDs present; the roomle-ui checkout stayed on 4415cdffd through all four runs of the session.
