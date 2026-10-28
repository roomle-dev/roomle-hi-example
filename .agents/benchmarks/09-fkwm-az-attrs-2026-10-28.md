# full-kitchen-walnut-marble-corner: detailed Azure gpt-6-astra timing — benchmark 09, the two-level attribute section

| Field | Value |
|---|---|
| Type / domain | Benchmark / HI Planning Assistant |
| Trigger | Benchmark 09: the two-level attribute section (D122) — the values of the attributes a planning sets at the create in the prefix, every other attribute with the number of its values and its values through find-attributes —, with the corrected descriptions of the sink units and of mod_SinkId in the library, measured against [the baseline](baseline-fkwm-az-2026-10-27.md); RML-18303 |
| Date / author | 2026-10-28 / Claude Code |
| Status | Measured: two completed turns, two saved plans |
| Ticket | [RML-18303](https://roomle.atlassian.net/browse/RML-18303) |
| Data | Measurements are retained in the tables below; raw captures remain in the ignored .temp/result/benchmark-09-az-attrs-2026-10-28 folder |
| Repeat | The fixture and settings of the baseline, the local planner with the two-level attribute section and the published embedding-lib; procedure below |

Affected repositories:

- **roomle-hi-example:** this benchmark report and the documentation indexes. Raw evidence remains local in .temp.
- **roomle-ui:** the planner measured with the two-level attribute section — 5fd409e84 on feat/hi-mcp-performance, merged into feat/hi-mcp-merge as 4415cdffd; the embedding-lib unchanged.

## Executive summary

The first completed kitchen create took **40.042 s** and **25.929 s** from assistant turn start; mean **32.986 s** (the baseline: 38.086 s). The complete assistant turn took **46.369 s** and **30.950 s**; mean **38.660 s** (57.925 s). Model calls occupied **94.15%** and **90.61%** of those turns.

Both runs create the kitchen in **model call 2**, and no run looks anything up before it or after it: the create sets the walnut fronts and carcase (Nature 215) and the dark marble worktop (324) from the value lists the attributes section keeps and leaves the hob and oven models to the article, whose ET601FNP1E and HE510ABS2 are the models the baseline's creates had chosen. The sink unit stands left of the corner unit with a base unit on its left, the side its drainer reaches over. Every first request carries **68,238 input tokens**, **8,533 fewer** than the baseline's 76,771. The create call takes **29.344 s** and **18.886 s** (30.035 / 26.826 s), of which **22.954 s** and **13.236 s** pass before its first output, with 215 / 318 reasoning tokens (431 / 404) and 695 / 758 output tokens (1,005 / 1,009). Kitchen creation itself took **2.672 s** and **2.871 s**.

After the kitchen both runs answer at once: **6.327 s** and **5.021 s**. Run 1's first call waited 7.666 s for its first output and its create call 22.954 s, without more reasoning than run 2; the cause is not exposed. These are request/response wall times, including network and provider work, not isolated server compute times.

## What was asked and run

Test: **full-kitchen-walnut-marble-corner**, from [docs/test-prompts.json](../../docs/test-prompts.json).

> create a kitchen with an oven, hob, cooker hood, fridge, sink and cabinet with drawers, as well as wall cabinets in the back right corner of the room. Arrange the kitchen around the corner. The front of the kitchen should be made of walnut and the worktop should be made of dark marble

Starting plan: **ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv**, default-room. Exactly this prompt was sent; the optional suite prompt suffix was omitted. Two fresh browsers and conversations used the same prompt and source revisions. No random cases, provider warm-up requests or request pacing were added.

| Setting | Measured value |
|---|---|
| Provider / key reference | `"provider": "gpt-6-astra", "apiKey": "$AZURE_GPT_KEY"`; resolved key never written to artifacts |
| Actual provider endpoint | https://dfhifoundrysweden.services.ai.azure.com/openai/v1/responses (the HI Azure AI Foundry resource, Responses API, reference cache breakpoint on) |
| Reasoning effort | Provider default; no explicit reasoning override |
| Planner | http://localhost:5173/; a roomle-ui dev server started for this capture from the checkout on feat/hi-mcp-merge with the two-level attribute section |
| Assistant / embedding source | https://cdn.jsdelivr.net/npm/@roomle/embedding-lib@0.0.0-dev-1b4351d (roomle-embedding-lib.js and hi.js), as the example pins it |
| Example page | http://localhost:3103/ |
| roomle-hi-example SHA | 14f321e (docs/attribute-information-validation) |
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
| Kitchen skill response complete (timestamp) | 8.019 | 4.169 |
| First kitchen create starts (timestamp) | 37.370 | 23.058 |
| First kitchen create completes (timestamp) | 40.042 | 25.929 |
| Delta: skill responses → first kitchen complete | 32.023 | 21.760 |
| ↳ Agent/model call 2 within that interval | 29.344 | 18.886 |
| ↳ Kitchen creation tool within that interval | 2.672 | 2.871 |
| ↳ Local gaps within that interval | 0.006 | 0.003 |

For example, run 2 takes **21.760 s** from the skill file (4.169 s) to the completed kitchen (25.929 s). The model spends **18.886 s** deciding and emitting the kitchen payload — **13.236 s** of it before its first output, with 318 reasoning tokens —; the create tool then takes **2.871 s**, with about **0.003 s** of local gaps. Run 1 takes **32.023 s** over the same interval. The baseline took 33.071 / 29.521 s.

## Results: milestones and total time

| Measurement (seconds) | Run 1 | Run 2 | Mean |
|---|---|---|---|
| Page/library/assistant ready (recorded run start) | 4.662 | 4.691 | 4.676 |
| Library reference and plan state acquisition inside turn (warm) | 0.019 | 0.020 | 0.020 |
| First model generated output (turn start) | 7.688 | 3.928 | 5.808 |
| First visible assistant text (turn start) | 30.979 | 27.786 | 29.382 |
| First successful kitchen create completed (turn start) | 40.042 | 25.929 | 32.986 |
| First successful kitchen create completed (recorded run start) | 44.708 | 30.623 | 37.666 |
| First successful kitchen create completed (subprocess start) | 45.012 | 30.855 | 37.934 |
| Create tool execution alone | 2.672 | 2.871 | 2.772 |
| Assistant turn start → answer complete | 46.369 | 30.950 | 38.660 |
| Time after the first kitchen until answer complete | 6.327 | 5.021 | 5.674 |
| Runner chat phase (includes the collection) | 46.892 | 31.479 | 39.185 |
| Post-chat context, images and saved snapshot | 5.130 | 5.300 | 5.215 |
| Recorded run: ready + chat + snapshot | 56.684 | 41.470 | 49.077 |
| Full subprocess: browser startup through launcher shutdown | 57.234 | 41.945 | 49.590 |

"First kitchen" here means the first successful create-or-replace-groups result, including its placement and returned groups. Each run made one successful create and retained that kitchen. Actual scene insertion happens during the tool and can precede its result; see the limitations below.

## Results: where the assistant turn goes

| Wall time component | Run 1 s | Run 1 share | Run 2 s | Run 2 share |
|---|---|---|---|---|
| Model calls (union) | 43.659 | 94.15% | 28.045 | 90.61% |
| Tools including the reads before the first request (union) | 2.691 | 5.80% | 2.890 | 9.34% |
| Model/tool overlap (subtract once) | 0.000 | 0.00% | 0.000 | 0.00% |
| Other client work / gaps | 0.020 | 0.04% | 0.015 | 0.05% |
| Assistant turn | 46.369 | 100.00% | 30.950 | 100.00% |

The model sum is taken from the SDK's measured call durations; the tool union comes from browser start/end intervals. The remaining client time closes the measured turn exactly before display rounding. Summing individual tool durations would overcount the concurrent tools.

## Results: model, tools and planner calls in order

### Run 1

Recorded start: **2026-10-28T06:13:02.214Z** (28/10/2026 07:13:02 Europe/Vienna). Model/provider: Azure Responses, gpt-6-astra.

**Agent steps — duration per decision and tool execution**

| Step | Result / following tools | Start s | End s | Agent/model delta s | Tools delta s | Total step delta s |
|---|---|---|---|---|---|---|
| 1 | get-skill (kitchen-planning) | 0.023 | 8.019 | 7.992 | 0.002 | 7.997 |
| 2 | create-or-replace-groups | 8.024 | 40.042 | 29.344 | 2.672 | 32.018 |
| 3 | Final answer | 40.043 | 46.369 | 6.323 | 0.000 | 6.327 |

| Call | SDK start s | End s | Delta s (model) | First output s¹ | Remaining s² | Input tokens | Output / reasoning | Request bytes | Tools after model |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.023 | 8.015 | 7.992 | 7.666 | 0.327 | 68,238 | 22 / 0 | 308,613 | #3 get-skill |
| 2 | 8.024 | 37.368 | 29.344 | 22.954 | 6.390 | 75,139 | 695 / 215 | 80,176 | #4 create-or-replace-groups |
| 3 | 40.043 | 46.366 | 6.323 | 3.064 | 3.259 | 84,893 | 201 / 49 | 78,574 | Final answer |

¹ From the SDK model-call start to its first generated output; this can be reasoning, a tool call or text. ² The remaining model-stream time is response duration minus first-output duration. It is not a pure text-generation or reasoning measurement. Request fetch starts and response-header times remain in the local timeline.json capture.

| Call | Tool / requested information | Start s | End s | Delta s (tool) | Elapsed ms | Nested planner ms³ | Remaining ms⁴ | Result bytes | Result |
|---|---|---|---|---|---|---|---|---|---|
| 1 | get-plan-context: articles, attributes | 0.000 | 0.013 | 0.0130 | 13.0 | 5.3 | 7.7 | 232,777 | OK |
| 2 | get-plan-context: rooms, groups, obstacles, installationElements | 0.001 | 0.017 | 0.0162 | 16.2 | 2.5 | 13.7 | 5,631 | OK |
| 3 | get-skill: kitchen-planning / SKILL.md | 8.017 | 8.019 | 0.0023 | 2.3 | 0.0 | 2.3 | 35,685 | OK |
| 4 | create-or-replace-groups: 1 group, 12 roots; placement right / back | 37.370 | 40.042 | 2.6723 | 2672.3 | 2576.1 | 96.2 | 34,083 | OK |

³ Union of the underlying planner-call intervals inside this tool. ⁴ Tool elapsed minus nested planner intervals: forwarding, scheduling, validation, projection, serialization and any uninstrumented work. This is not a pure CPU measurement. Calls #1 and #2 are the assistant's automatic reads of the library reference and the plan state, before the first model request, rather than model-requested tools.

| Call | Containing tool | Planner method / arguments | Start s | End s | Delta s (planner) | Elapsed ms |
|---|---|---|---|---|---|---|
| 1 | #1 | getExternalObjectLibraryContext [["articles","masterData"]] | 0.001 | 0.007 | 0.0053 | 5.3 |
| 2 | #2 | getExternalObjectPlanContext [["rooms","groups","obstacles","installationElements"]] | 0.010 | 0.012 | 0.0025 | 2.5 |
| 3 | #4 | getExternalObjectPlanContext [["groups"]] | 37.371 | 37.372 | 0.0003 | 0.3 |
| 4 | #4 | externalObjectGroupOperation ["create-or-replace-groups"] | 37.372 | 39.939 | 2.5674 | 2567.4 |
| 5 | #4 | getExternalObjectPlanContext [["groups"]] | 39.940 | 39.948 | 0.0084 | 8.4 |

The planner's own price refresh after the plan change, without a tool: 38.277–41.187 s, 41.188–41.614 s.

Local capture: `.temp/result/benchmark-09-az-attrs-2026-10-28/fkwm-rep-1/` (run.json, timeline.json, planner-calls.json and plan-context.json).

### Run 2

Recorded start: **2026-10-28T06:13:59.392Z** (28/10/2026 07:13:59 Europe/Vienna). Model/provider: Azure Responses, gpt-6-astra.

**Agent steps — duration per decision and tool execution**

| Step | Result / following tools | Start s | End s | Agent/model delta s | Tools delta s | Total step delta s |
|---|---|---|---|---|---|---|
| 1 | get-skill (kitchen-planning) | 0.024 | 4.169 | 4.143 | 0.001 | 4.145 |
| 2 | create-or-replace-groups | 4.171 | 25.929 | 18.886 | 2.871 | 21.758 |
| 3 | Final answer | 25.930 | 30.950 | 5.016 | 0.000 | 5.020 |

| Call | SDK start s | End s | Delta s (model) | First output s¹ | Remaining s² | Input tokens | Output / reasoning | Request bytes | Tools after model |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.024 | 4.167 | 4.143 | 3.904 | 0.239 | 68,238 | 22 / 0 | 308,613 | #3 get-skill |
| 2 | 4.171 | 23.057 | 18.886 | 13.236 | 5.649 | 75,139 | 758 / 318 | 80,176 | #4 create-or-replace-groups |
| 3 | 25.930 | 30.946 | 5.016 | 1.856 | 3.160 | 84,727 | 146 / 0 | 77,607 | Final answer |

¹ From the SDK model-call start to its first generated output; this can be reasoning, a tool call or text. ² The remaining model-stream time is response duration minus first-output duration. It is not a pure text-generation or reasoning measurement. Request fetch starts and response-header times remain in the local timeline.json capture.

| Call | Tool / requested information | Start s | End s | Delta s (tool) | Elapsed ms | Nested planner ms³ | Remaining ms⁴ | Result bytes | Result |
|---|---|---|---|---|---|---|---|---|---|
| 1 | get-plan-context: articles, attributes | 0.001 | 0.017 | 0.0167 | 16.7 | 5.7 | 11.0 | 232,777 | OK |
| 2 | get-plan-context: rooms, groups, obstacles, installationElements | 0.001 | 0.018 | 0.0178 | 17.8 | 2.8 | 15.0 | 5,631 | OK |
| 3 | get-skill: kitchen-planning / SKILL.md | 4.168 | 4.169 | 0.0005 | 0.5 | 0.0 | 0.5 | 35,685 | OK |
| 4 | create-or-replace-groups: 1 group, 12 roots; placement right / back | 23.058 | 25.929 | 2.8713 | 2871.3 | 2629.2 | 242.1 | 33,116 | OK |

³ Union of the underlying planner-call intervals inside this tool. ⁴ Tool elapsed minus nested planner intervals: forwarding, scheduling, validation, projection, serialization and any uninstrumented work. This is not a pure CPU measurement. Calls #1 and #2 are the assistant's automatic reads of the library reference and the plan state, before the first model request, rather than model-requested tools.

| Call | Containing tool | Planner method / arguments | Start s | End s | Delta s (planner) | Elapsed ms |
|---|---|---|---|---|---|---|
| 1 | #1 | getExternalObjectLibraryContext [["articles","masterData"]] | 0.002 | 0.007 | 0.0057 | 5.7 |
| 2 | #2 | getExternalObjectPlanContext [["rooms","groups","obstacles","installationElements"]] | 0.010 | 0.013 | 0.0028 | 2.8 |
| 3 | #4 | getExternalObjectPlanContext [["groups"]] | 23.061 | 23.061 | 0.0004 | 0.4 |
| 4 | #4 | externalObjectGroupOperation ["create-or-replace-groups"] | 23.062 | 25.682 | 2.6203 | 2620.3 |
| 5 | #4 | getExternalObjectPlanContext [["groups"]] | 25.682 | 25.691 | 0.0085 | 8.5 |

The planner's own price refresh after the plan change, without a tool: 23.874–25.927 s, 25.947–26.611 s, 26.612–27.195 s.

Local capture: `.temp/result/benchmark-09-az-attrs-2026-10-28/fkwm-rep-2/` (run.json, timeline.json, planner-calls.json and plan-context.json).

## Context, cache and transport

| Measurement | Run 1 | Run 2 |
|---|---|---|
| Model calls | 3 | 3 |
| Tools including the reads before the first request | 4 | 4 |
| Input tokens | 228,270 | 228,104 |
| Output tokens (include reasoning) | 918 | 926 |
| Reasoning tokens | 264 | 318 |
| Cache-read tokens / share of input | 209,783 / 91.90% | 218,507 / 95.79% |
| Cache-write tokens | 18,478 | 9,588 |
| First call: cache-read tokens | 66,412 | 68,235 |
| Request JSON bytes, all calls | 467,363 | 466,396 |
| Reference bytes (exclude tools/current input) | 258,251 | 258,251 |
| Shared-reference SHA-256 | `b6d6b7dc146b5cd3af90c9d01e3cdce3a6b52ea12099c6234e5d4a48c976f4e8` | `b6d6b7dc146b5cd3af90c9d01e3cdce3a6b52ea12099c6234e5d4a48c976f4e8` |
| Plan state bytes (supplied with the turn) | 4,822 | 4,822 |
| Information tools, elapsed union ms | 18.6 | 18.4 |
| Information tools, summed call ms (overlap included) | 31.5 | 35.0 |
| Saved plan snapshot | `ps_t3jh3zwiucremfb8f22js9ga1an8q59` | `ps_t3jc5kzaivj4vtdnxm6akeyjoi6yit7` |

All token/cache/reasoning fields have complete coverage for completed calls. Cache reads are already part of input tokens and reasoning is already part of output tokens. Request bytes count the whole uncompressed JSON sent on every fetch. With Responses chaining a later request carries only its new input, so a whole turn sends **467,363** and **466,396 bytes**, of which the first request is **308,613 bytes** (the baseline: 345,510). Both runs read the same shared reference, **258,251 bytes** with the same SHA-256 as the image kitchen of this benchmark — 37,431 bytes less than the baseline's 295,682. The first call of run 1 reads **66,412 of its 68,238 input tokens** from the cache, written by the image kitchen's requests with the same prefix; run 2's first call **68,235**; over the turn the cache covers 91.90% and 95.79% of the input.

The library reference returns **232,777 bytes**, the plan state **5,631 bytes**; both come with the turn before the first request. No run renders: a text creation has no occasion for the plan images.

## Findings and the evidence behind them

### 1. The create call: fewer tokens, one slow run

Call 1 ends after **7.992 / 4.143 s** with the skill request. Call 2, the create, then takes **29.344 / 18.886 s**: **22.954 / 13.236 s** until its first output and **6.390 / 5.650 s** streaming the payload, with **215 / 318 reasoning tokens** and **695 / 758 output tokens**. The baseline's create calls took 30.035 / 26.826 s with 431 / 404 reasoning tokens and 1,005 / 1,009 output tokens: here the payload sets no hob and oven model. Run 1 waits long for its first output in both calls without more reasoning than run 2 — the provider's side of the round trip, as in the baseline's long waits; run 2 falls below the baseline's spread.

### 2. Every request carries 8,533 input tokens less

The first request carries **68,238 input tokens** against **76,771** in the baseline, the create call **75,139** against 83,672, the same 8,533 tokens as in the image kitchen.

### 3. The sink and the appliances

Both runs put the sink unit `SUT60` left of the corner unit on the back wall, with a drawer base (run 1) or a door base (run 2) on its left: the outline of the sink unit overlaps that unit by 410 mm, its drainer, and no hob unit; the oven-and-hob unit stands on the right wall. The hob and the oven are the article's — the models the baseline's creates had set.

### 4. The kitchen is the requested one

Both snapshots contain an L-shaped kitchen around the back right corner with the corner unit UERTB90: on the back wall the sink unit SUT60, a drawer or door base and wall cabinets, the fridge housing HK60 at the end of the back wall in run 1, of the right wall in run 2; on the right wall drawer units and the oven-and-hob unit UHS60 with the cooker hood DU above it; walnut fronts and carcases in the Nature program and a dark marble worktop, as asked. No create got a hint; both answers say the window and the doorway stay clear. The perspectives were inspected.

## Proposed experiments and rejected conclusions

| Candidate | What this run supports | Expected saving / limit |
|---|---|---|
| Keep the two-level section with the first-kitchen rule | The first kitchen at call 2 with no lookup; 8,533 input tokens less per request; the create payload smaller (695 / 758 output tokens against 1,005 / 1,009) | The article's hob and oven are the baseline's choice; the sink stands clear of the hob. |
| A watchdog for calls without a first output | Run 1 waits 7.666 s and 22.954 s for the first output of its two calls | A resend doubles the cost of a legitimate long reasoning. Measure the tail over more runs first. |
| Tool memoization / attribute indexing / precalculated docking vectors | The information tools take milliseconds; the create tool 2.672 / 2.871 s | Local work is not the bottleneck. |

## Measurement gaps and open work

- **First painted frame:** no GPU presentation/paint marker was captured. Create-tool completion is an upper bound for a loaded kitchen; first visible geometry could appear earlier within the 2.672–2.871 s create.
- **Provider internals:** model time combines network, queueing, input processing, reasoning, generation and SDK stream handling. Time to first output does not isolate prefill; response-header time does not isolate network RTT.
- **Tool internals:** the planner table separates planner access from the surrounding tool, but does not profile every individual filtering, projection, docking, library-calculation or kernel-load function. Remaining tool time must not be renamed CPU assembly time.
- **Final text start:** first visible text refers to the first planning preamble; the end of the turn marks completion of the final answer. Final-answer text-delta start was not separately instrumented.
- **Startup attribution:** page/module/library/plan/assistant initialization, the runner's readiness read and the assistant's library read before the first prompt overlap inside the ready phase. They were not profiled individually.
- **Instrumentation overhead:** extra console events, UTF-8 size measurement and log delivery add unquantified overhead; both runs have the same hooks. The planner is a Vite development server; do not use these page-startup numbers as production cold-start numbers.
- **Sampling:** two runs establish a repeated measurement and show large variation after the kitchen and in the first call. They do not establish a p95, a stable service-level expectation or the cause of provider variability. Another pair costs about 1.5 minutes and 0.5M input tokens, most of them read from the cache.5 minutes and 0.7M input tokens, most of them read from the cache.
- **The baseline's first-kitchen time:** its run 1 met a cold cache and its run 2 a 10 s first call; here run 1 waits long in both its calls. The skill-to-kitchen interval and the create call compare better than the turn start.

## The benchmark to repeat

Use the commits, and settings in manifest.json (local: `.temp/result/benchmark-09-az-attrs-2026-10-28/manifest.json`). Keep the planner on port 5173 and check that its checkout is the one to measure — here `feat/hi-mcp-merge` at 4415cdffd, the baselines' a8fe64618 plus the two-level attribute section; the example page pins the embedding-lib. Keep `"provider": "gpt-6-astra", "apiKey": "$AZURE_GPT_KEY"` with the key in AZURE_GPT_KEY. Do not silently substitute another provider.

```sh
cd .temp/result/benchmark-09-az-attrs-2026-10-28
node make-timing-runner.mjs
REPS=1,2 node run-reps.mjs iklw fkwm
node analyze.mjs iklw-rep-1 iklw-rep-2 fkwm-rep-1 fkwm-rep-2
node write-prose.mjs
node write-09-fkwm.mjs
```

The timing runner is byte for byte the baselines' (the prompt runner is unchanged since); `analyze.mjs` is the baselines' with one change, a `find-attributes` call by `ids` labelled by its ids. `probe/` holds the sections read without a model before the runs. Before a new capture, copy these scripts into a fresh dated session directory and point the paths there; never overwrite this evidence.

Retain run.json, timeline.json, planner-calls.json, plan-context.json, source SHAs, exclusions and snapshot IDs. Compute interval unions rather than summing concurrent tools; check the counts against the model usage and recorded calls.

Verification performed: every model request paired with a completed model call and its diagnostics bytes; all tool starts paired with ends; the nested planner calls paired with their log lines, the two parallel reads before the first request by their method; the interval accounting reconciles with the full-turn duration; both snapshot IDs present; the roomle-ui checkout stayed on 4415cdffd through all four runs of the session.
