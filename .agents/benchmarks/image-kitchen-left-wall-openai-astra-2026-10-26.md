# image-kitchen-left-wall: detailed OpenAI Astra timing

| Field | Value |
|---|---|
| Type / domain | Benchmark / HI Planning Assistant |
| Trigger | Detailed time measurement for image-kitchen-left-wall; RML-18303 |
| Date / author | 2026-10-26 / Codex |
| Status | Measured: two completed turns, two saved plans |
| Ticket | [RML-18303](https://roomle.atlassian.net/browse/RML-18303) |
| Data | Measurements are retained in the tables below; raw captures remain in the ignored .temp/image-kitchen-left-wall-timing-2026-10-26 folder |
| Repeat | Same fixture, direct OpenAI provider, local planner and local embedding source; procedure below |

Affected repositories:

- **roomle-hi-example:** this benchmark report and documentation indexes. Raw evidence remains local in .temp.
- **roomle-ui:** current local assistant/planner measured with temporary browser logging; application source unchanged. Future assistant/tool changes, if pursued, belong here.

## Executive summary

The first completed kitchen create took **29.914 s** and **60.817 s** from assistant turn start; mean **45.365 s**. The complete assistant turn took **54.653 s** and **95.956 s**; mean **75.305 s**. Model calls occupied **96.13%** and **97.37%** of those turns.

The measured bottleneck is model-request latency. Warm in-turn library/reference acquisition took only **16.3 ms** and **19.5 ms**. Kitchen creation itself took **1.447 s** and **1.821 s**. Both runs also attempted a backsplash that the library could not calculate, then accurately reported the omission.

These are request/response wall times, including network and provider work, not isolated server compute times. The first-kitchen milestone is successful create-tool completion: a conservative point by which the kitchen has been loaded into the plan, not a measured first painted GPU frame.

## What was asked and run

Test: **image-kitchen-left-wall**, from [docs/test-prompts.json](../../docs/test-prompts.json).

> create a kitchen like the one in the image on the left-hand wall of the room

Image: [kitchen-1.png](../../docs/images/kitchen-1.png). Starting plan: **ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv**, default-room. Exactly this prompt was sent; the optional suite prompt suffix was omitted. Two fresh browsers and conversations used the same prompt/image and source revisions. No random cases, provider warm-up requests or request pacing were added.

| Setting | Measured value |
|---|---|
| Model CLI / key reference | openai:gpt-6-astra / $OPENAI_ASSISTANT_API_KEY; resolved key never written to artifacts |
| Actual provider endpoint | https://api.openai.com/v1/responses |
| Reasoning effort | Provider default; no explicit reasoning override |
| Planner | http://localhost:5173/; the already running local roomle-ui |
| Assistant / embedding source | http://localhost:3001/src/hi.ts and /src/roomle-embedding-lib.ts |
| Example page | http://localhost:3103/ |
| roomle-hi-example SHA | d68a737a770481fd96776097c49412a7f3f4cd28 |
| roomle-ui SHA | 6d088dde93908575229b02a8bdc2dd080f96c71e |
| Node / Chromium | Node 22.23.3; Playwright 1.55.0 bundled Chromium, headless with --enable-gpu |
| Initial provider cache state | Unknown for each run; measured cache counters below |

## How it was measured

A scratch copy of [run-hi-mcp-prompt.js](../scripts/run-hi-mcp-prompt.js) retained its normal prompt, usage, tool, plan and snapshot collection. Playwright response transforms selected the local embedding source and injected timestamp-only instrumentation into the HTML, assistant module and planner-api module. No productive file was modified.

- The assistant's existing diagnostics supply per-call response duration, time to first output, reference acquisition, first visible text, tokens, cache counters, request bytes and full-turn duration.
- Browser events mark turn start, each model fetch, response headers, model-call completion, tool forwarding start/end, and every underlying planner-method start/end.
- Browser timestamps use performance.timeOrigin + performance.now(), so the host and iframe share an epoch. Tables use seconds relative to assistant turn start.
- Tool result sizes are UTF-8 bytes of JSON.stringify(result), including the MCP wrapper and base64 image content where present. They are not model tokens or compressed HTTP bytes.
- Nested planner calls are attributed using the tool-start log order and checked against method arguments and enclosing intervals. Nested planner time is included in tool time. Overlapping tools are counted once for wall time. Model/tool overlap is measured from intervals and subtracted once; it is 0.000 s / 0.000 s here.
- Recorded run start is the runner's runSession start, after browser launch. The subprocess measurement also includes browser launch, output writing and browser/launcher shutdown. Its result is distinct from the recorded ready + chat + snapshot phases.

Both turns completed without provider/chat errors and both saved a plan. One preparation attempt failed before sending any model request because a diagnostic replacement did not match transformed JavaScript; it is excluded, preserved in .temp/image-kitchen-left-wall-timing-2026-10-26/setup-attempt-1, and consumed no model tokens.

## How to read the step deltas

**Agent/model delta s** is how long the model call takes to return its decision, tool arguments or text. It includes the provider round trip and stream handling. **Tools delta s** is the time spent executing that step's tools, counting parallel calls once. **Total step delta s** runs from the start of the model call until its tools complete; the last step ends when the assistant turn completes. The difference includes local handling within the step. Small gaps between steps and the initial shared-reference preparation are outside these step totals.

The **Start s** and **End s** columns are timestamps measured from assistant turn start; they are not durations. In the detailed call tables, **Delta s = End s − Start s** is the duration of that individual call. Tool/planner tables retain milliseconds as additional detail.

### From skills to the first kitchen

The first pair of skill responses contains image-planning and kitchen-planning SKILL.md. The model subsequently fetches kitchen-planning/references/planning-reference.md. Therefore there are two useful starting points:

| Milestone / interval | Run 1 s | Run 2 s |
|---|---|---|
| Initial image/kitchen SKILL.md responses complete (timestamp) | 5.385 | 4.872 |
| Last required skill/reference response complete (timestamp) | 18.984 | 36.388 |
| First kitchen create starts (timestamp) | 28.466 | 58.996 |
| First kitchen create completes (timestamp) | 29.914 | 60.817 |
| Delta: initial SKILL.md responses → first kitchen complete | 24.529 | 55.945 |
| Delta: all required skill/reference responses → first kitchen complete | 10.930 | 24.429 |
| ↳ Agent/model call 3 within that last interval | 9.477 | 22.599 |
| ↳ Kitchen creation tool within that last interval | 1.447 | 1.821 |
| ↳ Local gaps within that last interval | 0.006 | 0.009 |

For example, run 1 takes **29.914 − 18.984 = 10.930 s** after all required skill/reference files arrive. The model spends **9.477 s** deciding and emitting the kitchen payload; the create tool then takes **1.447 s**, with about **0.006 s** of local gaps. Run 2 takes **24.429 s** over the same interval.

## Results: milestones and total time

| Measurement (seconds) | Run 1 | Run 2 | Mean |
|---|---|---|---|
| Page/library/assistant ready (recorded run start) | 5.502 | 5.900 | 5.701 |
| Shared reference acquisition inside turn (warm) | 0.016 | 0.019 | 0.018 |
| First model generated output (turn start) | 5.083 | 4.514 | 4.799 |
| First visible assistant text (turn start) | 17.165 | 33.660 | 25.413 |
| First successful kitchen create completed (turn start) | 29.914 | 60.817 | 45.365 |
| First successful kitchen create completed (recorded run start) | 35.626 | 66.925 | 51.275 |
| First successful kitchen create completed (subprocess start) | 35.831 | 67.137 | 51.484 |
| Create tool execution alone | 1.447 | 1.821 | 1.634 |
| Assistant turn start → answer complete | 54.653 | 95.956 | 75.305 |
| Time after the first kitchen until answer complete | 24.739 | 35.139 | 29.939 |
| Runner chat phase (includes image preparation/collection) | 54.885 | 96.189 | 75.537 |
| Post-chat context, images and saved snapshot | 5.107 | 12.155 | 8.631 |
| Recorded run: ready + chat + snapshot | 65.494 | 114.244 | 89.869 |
| Full subprocess: browser startup through launcher shutdown | 65.946 | 114.709 | 90.328 |

"First kitchen" here means the first successful create-or-replace-groups result, including its placement and returned groups. Each run made one successful create and retained that kitchen. Actual scene insertion happens during the tool and can precede its result; see the limitations below.

## Results: where the assistant turn goes

| Wall time component | Run 1 s | Run 1 share | Run 2 s | Run 2 share |
|---|---|---|---|---|
| Model calls (union) | 52.539 | 96.13% | 93.433 | 97.37% |
| Tools including bootstrap (union) | 2.078 | 3.80% | 2.482 | 2.59% |
| Model/tool overlap (subtract once) | 0.000 | 0.00% | 0.000 | 0.00% |
| Other client work / gaps | 0.036 | 0.07% | 0.041 | 0.04% |
| Assistant turn | 54.653 | 100.00% | 95.956 | 100.00% |

The model sum is taken from the SDK's measured call durations; the tool union comes from browser start/end intervals. The remaining client time closes the measured turn exactly before display rounding. Summing individual tool durations would overcount the concurrent tools, especially in run 2.

## Results: model, tools and planner calls in order

### Run 1

Recorded start: **2026-10-26T13:13:13.340Z** (26/10/2026, 14:13:13 Europe/Vienna). Model/provider: OpenAI Responses, gpt-6-astra.

**Agent steps — duration per decision and tool execution**

| Step | Result / following tools | Start s | End s | Agent/model delta s | Tools delta s | Total step delta s |
|---|---|---|---|---|---|---|
| 1 | get-plan-context; get-skill (image-planning); get-skill (kitchen-planning) | 0.022 | 5.385 | 5.356 | 0.006 | 5.363 |
| 2 | get-skill (kitchen-planning / references/planning-reference.md) | 5.388 | 18.984 | 13.595 | 0.001 | 13.596 |
| 3 | create-or-replace-groups | 18.989 | 29.914 | 9.477 | 1.447 | 10.925 |
| 4 | find-attributes | 29.916 | 35.056 | 5.122 | 0.017 | 5.140 |
| 5 | change-group-attribute | 35.058 | 38.313 | 3.119 | 0.135 | 3.254 |
| 6 | get-plan-images | 38.315 | 43.996 | 5.221 | 0.459 | 5.681 |
| 7 | Final answer | 43.999 | 54.653 | 10.649 | 0.000 | 10.654 |

| Call | SDK start s | End s | Delta s (model) | First output s¹ | Remaining s² | Input tokens | Output / reasoning | Request bytes | Tools after model |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.022 | 5.378 | 5.356 | 5.061 | 0.294 | 77,183 | 79 / 0 | 603,820 | #2 get-plan-context; #3 get-skill; #4 get-skill |
| 2 | 5.388 | 18.983 | 13.595 | 11.777 | 1.818 | 84,052 | 319 / 222 | 636,035 | #5 get-skill |
| 3 | 18.989 | 28.466 | 9.477 | 5.443 | 4.034 | 87,415 | 460 / 0 | 651,859 | #6 create-or-replace-groups |
| 4 | 29.916 | 35.039 | 5.122 | 4.461 | 0.661 | 94,989 | 32 / 10 | 680,920 | #7 find-attributes |
| 5 | 35.058 | 38.177 | 3.119 | 2.196 | 0.923 | 95,192 | 57 / 0 | 681,983 | #8 change-group-attribute |
| 6 | 38.315 | 43.536 | 5.221 | 4.708 | 0.513 | 95,390 | 15 / 0 | 682,740 | #9 get-plan-images |
| 7 | 43.999 | 54.648 | 10.649 | 7.060 | 3.589 | 97,829 | 139 / 0 | 3,330,545 | Final answer |

¹ From the SDK model-call start to its first generated output; this can be reasoning, a tool call or text. ² The remaining model-stream time is response duration minus first-output duration. It is not a pure text-generation or reasoning measurement. Request fetch starts and response-header times remain in the local detailed-timing.json capture.

| Call | Tool / requested information | Start s | End s | Delta s (tool) | Elapsed ms | Nested planner ms³ | Remaining ms⁴ | Result bytes | Result |
|---|---|---|---|---|---|---|---|---|---|
| 1 | get-plan-context: articles, attributes | 0.000 | 0.014 | 0.0136 | 13.6 | 6.7 | 6.9 | 270,617 | OK |
| 2 | get-plan-context: rooms, groups, obstacles, installationElements | 5.379 | 5.384 | 0.0053 | 5.3 | 2.9 | 2.4 | 5,631 | OK |
| 3 | get-skill: image-planning | 5.380 | 5.385 | 0.0050 | 5.0 | 0.0 | 5.0 | 5,658 | OK |
| 4 | get-skill: kitchen-planning | 5.380 | 5.385 | 0.0049 | 4.9 | 0.0 | 4.9 | 20,247 | OK |
| 5 | get-skill: kitchen-planning / references/planning-reference.md | 18.983 | 18.984 | 0.0007 | 0.7 | 0.0 | 0.7 | 15,393 | OK |
| 6 | create-or-replace-groups: Create the kitchen; wall=left, center | 28.466 | 29.914 | 1.4473 | 1447.3 | 1390.2 | 57.1 | 26,983 | OK |
| 7 | find-attributes: "Create backsplash" | 35.040 | 35.056 | 0.0165 | 16.5 | 12.3 | 4.2 | 759 | OK |
| 8 | change-group-attribute: Enable backsplash (failed calculation) | 38.177 | 38.313 | 0.1352 | 135.2 | 129.7 | 5.5 | 470 | Library error |
| 9 | get-plan-images: Object perspective and plan top view | 43.537 | 43.996 | 0.4586 | 458.6 | 426.9 | 31.7 | 2,647,598 | OK |

³ Union of the underlying planner-call intervals inside this tool. ⁴ Tool elapsed minus nested planner intervals: forwarding, scheduling, validation, projection, serialization and any uninstrumented work. This is not a pure CPU measurement. Calls #1 are the assistant's automatic library preload, before the first model request, rather than model-requested tools.

| Call | Containing tool | Planner method / arguments | Start s | End s | Delta s (planner) | Elapsed ms |
|---|---|---|---|---|---|---|
| 1 | #1 | getExternalObjectLibraryContext [["articles","masterData"]] | 0.001 | 0.008 | 0.0067 | 6.7 |
| 2 | #2 | getExternalObjectPlanContext [["rooms","groups","obstacles","installationElements"]] | 5.381 | 5.383 | 0.0030 | 3.0 |
| 3 | #6 | getExternalObjectPlanContext [["groups"]] | 28.470 | 28.471 | 0.0009 | 0.9 |
| 4 | #6 | externalObjectGroupOperation ["create-or-replace-groups"] | 28.471 | 29.854 | 1.3825 | 1382.5 |
| 5 | #6 | getExternalObjectPlanContext [["groups"]] | 29.854 | 29.861 | 0.0068 | 6.8 |
| 6 | #7 | getExternalObjectPlanContext [["groups"]] | 35.042 | 35.054 | 0.0123 | 12.3 |
| 7 | #7 | getExternalObjectLibraryContext [["masterData"]] | 35.042 | 35.053 | 0.0106 | 10.6 |
| 8 | #8 | getExternalObjectPlanContext [["groups"]] | 38.179 | 38.188 | 0.0096 | 9.6 |
| 9 | #8 | externalObjectGroupOperation ["change-group-attribute"] | 38.188 | 38.309 | 0.1201 | 120.1 |
| 10 | #9 | getExternalObjectSnapshot [{"perspectiveObjectImage":true,"topImage":true,"keepOpenGeometry":true}] | 43.540 | 43.967 | 0.4269 | 426.9 |

Local capture: `.temp/image-kitchen-left-wall-timing-2026-10-26/rep-1/openai-gpt-6-astra/01-image-kitchen-left-wall/` (run.json, timeline.json, planner-calls.json, console.log and plan-context.json).

### Run 2

Recorded start: **2026-10-26T13:14:19.294Z** (26/10/2026, 14:14:19 Europe/Vienna). Model/provider: OpenAI Responses, gpt-6-astra.

**Agent steps — duration per decision and tool execution**

| Step | Result / following tools | Start s | End s | Agent/model delta s | Tools delta s | Total step delta s |
|---|---|---|---|---|---|---|
| 1 | get-plan-context; get-skill (image-planning); get-skill (kitchen-planning) | 0.025 | 4.872 | 4.841 | 0.005 | 4.846 |
| 2 | get-skill (kitchen-planning / references/planning-reference.md) | 4.875 | 36.388 | 31.511 | 0.002 | 31.513 |
| 3 | create-or-replace-groups | 36.396 | 60.817 | 22.599 | 1.821 | 24.421 |
| 4 | get-plan-context; find-attributes; get-plan-images | 60.819 | 68.472 | 7.170 | 0.482 | 7.653 |
| 5 | change-group-attribute | 68.475 | 81.076 | 12.441 | 0.159 | 12.601 |
| 6 | Final answer | 81.080 | 95.956 | 14.872 | 0.000 | 14.877 |

| Call | SDK start s | End s | Delta s (model) | First output s¹ | Remaining s² | Input tokens | Output / reasoning | Request bytes | Tools after model |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.025 | 4.866 | 4.841 | 4.489 | 0.351 | 77,183 | 79 / 0 | 603,820 | #2 get-plan-context; #3 get-skill; #4 get-skill |
| 2 | 4.875 | 36.386 | 31.511 | 28.785 | 2.726 | 84,052 | 368 / 274 | 636,035 | #5 get-skill |
| 3 | 36.396 | 58.995 | 22.599 | 17.182 | 5.417 | 87,464 | 844 / 300 | 651,859 | #6 create-or-replace-groups |
| 4 | 60.819 | 67.989 | 7.170 | 6.718 | 0.453 | 95,667 | 137 / 62 | 682,230 | #7 get-plan-context; #8 find-attributes; #9 get-plan-images |
| 5 | 68.475 | 80.916 | 12.441 | 11.569 | 0.872 | 107,629 | 79 / 20 | 3,465,240 | #10 change-group-attribute |
| 6 | 81.080 | 95.952 | 14.872 | 9.854 | 5.019 | 107,849 | 243 / 86 | 3,466,084 | Final answer |

¹ From the SDK model-call start to its first generated output; this can be reasoning, a tool call or text. ² The remaining model-stream time is response duration minus first-output duration. It is not a pure text-generation or reasoning measurement. Request fetch starts and response-header times are preserved in detailed-timing.json.

| Call | Tool / requested information | Start s | End s | Delta s (tool) | Elapsed ms | Nested planner ms³ | Remaining ms⁴ | Result bytes | Result |
|---|---|---|---|---|---|---|---|---|---|
| 1 | get-plan-context: articles, attributes | 0.000 | 0.014 | 0.0134 | 13.4 | 6.7 | 6.7 | 270,617 | OK |
| 2 | get-plan-context: rooms, groups, obstacles, installationElements | 4.866 | 4.871 | 0.0048 | 4.8 | 3.0 | 1.8 | 5,631 | OK |
| 3 | get-skill: image-planning | 4.867 | 4.871 | 0.0046 | 4.6 | 0.0 | 4.6 | 5,658 | OK |
| 4 | get-skill: kitchen-planning | 4.867 | 4.872 | 0.0047 | 4.7 | 0.0 | 4.7 | 20,247 | OK |
| 5 | get-skill: kitchen-planning / references/planning-reference.md | 36.386 | 36.388 | 0.0017 | 1.7 | 0.0 | 1.7 | 15,393 | OK |
| 6 | create-or-replace-groups: Create the kitchen; wall=left, center | 58.996 | 60.817 | 1.8207 | 1820.7 | 1774.1 | 46.6 | 27,908 | OK |
| 7 | get-plan-context: rooms, groups, obstacles, installationElements | 67.990 | 68.468 | 0.4777 | 477.7 | 10.9 | 466.8 | 33,325 | OK |
| 8 | find-attributes: "Create backsplash" | 67.991 | 68.468 | 0.4775 | 477.5 | 7.0 | 470.5 | 759 | OK |
| 9 | get-plan-images: Object perspective and plan top view | 67.991 | 68.472 | 0.4813 | 481.3 | 429.2 | 52.1 | 2,748,154 | OK |
| 10 | change-group-attribute: Enable backsplash (failed calculation) | 80.917 | 81.076 | 0.1589 | 158.9 | 151.5 | 7.4 | 470 | Library error |

³ Union of the underlying planner-call intervals inside this tool. ⁴ Tool elapsed minus nested planner intervals: forwarding, scheduling, validation, projection, serialization and any uninstrumented work. This is not a pure CPU measurement. Calls #1 are the assistant's automatic library preload, before the first model request, rather than model-requested tools.

| Call | Containing tool | Planner method / arguments | Start s | End s | Delta s (planner) | Elapsed ms |
|---|---|---|---|---|---|---|
| 1 | #1 | getExternalObjectLibraryContext [["articles","masterData"]] | 0.001 | 0.008 | 0.0067 | 6.7 |
| 2 | #2 | getExternalObjectPlanContext [["rooms","groups","obstacles","installationElements"]] | 4.867 | 4.870 | 0.0030 | 3.0 |
| 3 | #6 | getExternalObjectPlanContext [["groups"]] | 59.000 | 59.000 | 0.0007 | 0.7 |
| 4 | #6 | externalObjectGroupOperation ["create-or-replace-groups"] | 59.001 | 60.768 | 1.7677 | 1767.7 |
| 5 | #6 | getExternalObjectPlanContext [["groups"]] | 60.769 | 60.774 | 0.0056 | 5.6 |
| 6 | #7 | getExternalObjectPlanContext [["rooms","groups","obstacles","installationElements"]] | 67.992 | 68.003 | 0.0109 | 10.9 |
| 7 | #8 | getExternalObjectPlanContext [["groups"]] | 68.004 | 68.011 | 0.0070 | 7.0 |
| 8 | #8 | getExternalObjectLibraryContext [["masterData"]] | 68.004 | 68.010 | 0.0061 | 6.1 |
| 9 | #9 | getExternalObjectSnapshot [{"perspectiveObjectImage":true,"topImage":true,"keepOpenGeometry":true}] | 68.013 | 68.442 | 0.4292 | 429.2 |
| 10 | #10 | getExternalObjectPlanContext [["groups"]] | 80.920 | 80.933 | 0.0128 | 12.8 |
| 11 | #10 | externalObjectGroupOperation ["change-group-attribute"] | 80.933 | 81.071 | 0.1387 | 138.7 |

Local capture: `.temp/image-kitchen-left-wall-timing-2026-10-26/rep-2/openai-gpt-6-astra/01-image-kitchen-left-wall/` (run.json, timeline.json, planner-calls.json, console.log and plan-context.json).

## Context, cache and transport

| Measurement | Run 1 | Run 2 |
|---|---|---|
| Model calls | 7 | 6 |
| Tools including library preload | 9 | 10 |
| Input tokens | 632,050 | 559,844 |
| Output tokens (include reasoning) | 1,101 | 1,750 |
| Reasoning tokens | 232 | 742 |
| Cache-read tokens / share of input | 534,203 / 84.52% | 465,366 / 83.12% |
| Cache-write tokens | 97,826 | 94,460 |
| Request JSON bytes, all calls | 7,267,902 | 9,505,268 |
| Reference bytes (exclude tools/current input) | 295,284 | 295,284 |
| Shared-reference SHA-256 | `ed8801dd17e42748c33ae385b131ea4e69c719f77053967819e9064bce7d3a88` | `ca75c4b7d9b27a9666d3ccdf879f9ac4a0acd6d4e9a90686519502270b80832f` |
| Information tools, elapsed union ms | 36.4 | 498.2 |
| Information tools, summed call ms (overlap included) | 46.0 | 984.4 |
| Saved plan snapshot | `ps_sxuccv6ydbeajjbdgtd5ijczrwq1qmu` | `ps_sxubvmgrldecgxa89hr0ft0i9y0ohpt` |

All token/cache/reasoning fields have complete coverage for completed calls. Cache reads are already part of input tokens and reasoning is already part of output tokens. Request bytes count the whole uncompressed JSON sent on every fetch, including image data. They are not saved by a provider cache hit. Both first requests have **603,820 bytes**, but the request and shared-reference SHA-256 digests **differ across the two fresh sessions** (see the retained run diagnostics). Equal byte counts therefore do not establish identical content. The first call of each run reports **zero cache reads**. A fresh browser does not establish a cold provider cache in general.

The initial library tool returns **270,617 bytes**. The shared-reference record is **295,284 bytes**, including assembled instructions/library data but excluding tool schemas/current input. Image/skill reads and later tool results grow the requests. The get-plan-images results are **2,647,598** and **2,748,154 bytes**, taking **458.6 ms** and **481.3 ms** locally, but they remain part of subsequent provider requests.

## Findings and the evidence behind them

### 1. Most of the variation is inside model calls, before kitchen creation

Run 2 takes **41.303 s** longer for the assistant turn despite using **6 calls instead of 7**. Calls 2 and 3 alone take **23.071 s** in run 1 versus **54.109 s** in run 2: a **31.038 s** difference. Both calls precede the first kitchen. The model-call table shows their inputs, first-output waits and reasoning counters.

The request/model boundary localizes this delay to the model round trip, not planner execution. The cause inside that boundary is **unknown**: provider queueing, input processing, reasoning, generation and network are not separately exposed. The extra reasoning tokens in run 2 are an observation, not proof that reasoning caused the delay. Fitting a token/second performance model to thirteen calls from two image runs would be unreliable.

### 2. Information gathering is cheap locally; additional model rounds are expensive

The runner checks readiness by reading library articles before the prompt, which populates article-template caches. The in-turn measurements are therefore warm reads. A separate pair of read-only fresh-browser probes skips that readiness pre-read: its first getExternalObjectLibraryContext request takes **739.5 / 732.5 ms**, with no model requests. This is preparation during initialization for the standard runner, not extra time to add to its measured chat. See probe timing/diff (local: `.temp/image-kitchen-left-wall-timing-2026-10-26/retained-evidence/reference-probe-diff.json`) and probe log (local: `.temp/image-kitchen-left-wall-timing-2026-10-26/retained-evidence/reference-probe-console.log`).

Bootstrap get-plan-context returns the complete library reference in **13.6 / 13.4 ms**. The first live-state read and both initial skill reads overlap and finish in about **5 ms**. Kitchen planning's required planning-reference.md is then fetched separately after model call 2, in **0.7 / 1.7 ms**.

That tool is fast; deciding to request it consumes a separate **13.595 / 31.511 s** model call. The workflow discovers the skill and its referenced file over two rounds. A request-scoped bundle containing that skill's mandatory reference is a candidate to test. It could remove that reference-discovery round, but cannot be credited with its whole duration because call 2 also produces a user-facing plan/preamble. No improvement is established by this measurement.

### 3. Parallel tool wall time includes scheduling and serialization

In run 2, get-plan-context, find-attributes and get-plan-images execute after model call 4. Their elapsed times are about **477–482 ms each**, but their combined wall-time interval is about **482.2 ms**, rather than their sum. The nested context calls take only a few milliseconds while the image snapshot takes **429.2 ms**. This is evidence that outer tool duration includes shared event-loop/forwarding work; it is not evidence that each read spends half a second assembling its JSON.

### 4. Post-create work adds substantial latency, and the backsplash remains absent

After the first kitchen is created, the assistant spends **24.739 / 35.139 s** searching for the backsplash switch, trying it, checking the plan/images and answering. Both switch calls return the same Error 14034, a missing tab_GrainDirectionSettings entry for part_Backsplash. They take only **135.2 / 158.9 ms**; the surrounding model decisions cost seconds.

The matching open issue is [library backlog §10](../backlog/library-issues.md#10-backsplashes-the-library-cannot-calculate). Its calculation cause remains unestablished. The library data advertises backsplash creation and the image asks for one; the tool attempts the advertised operation and reports the failed calculation. This is not evidence for refusing agent input or changing glue-logic.ts.

### 5. Shared-reference identity requires a separate check

The two captured reference digests differ despite equal byte lengths and the same fixture/source versions. The raw reference text was not captured during the paid runs, so the original changed field cannot be established from those runs alone. Two read-only probe pairs made no model requests. Both pairs returned identical content between their own sessions; the retained pair contains zero differing fields across the library projection and planner prompts. It does not reproduce the original digest difference. The retained pair includes both raw references (local: `.temp/image-kitchen-left-wall-timing-2026-10-26/retained-evidence/reference-probe-1.json`) and their diff/timings (local: `.temp/image-kitchen-left-wall-timing-2026-10-26/retained-evidence/reference-probe-diff.json`). A cache-key or stability fix needs the actual field diff before any implementation; these latency runs alone do not establish cross-conversation reuse.

### 6. Plan verification

Both snapshots contain one **3,010 mm** kitchen on the left wall with **rotationZ = 90°**. The main row follows the image: fridge/freezer, drawer-and-door base, cooker, storage base and sink; three wooden wall cabinets and a hood hang above it. Top views and object views were inspected. Approximate library finishes, a two-panel fridge front and the absent dark backsplash limit fidelity to the reference. Both answers disclose the missing backsplash; run 2 also explicitly names the fridge-front difference. This is a latency benchmark of those resulting plans, not an assertion of pixel-identical image reproduction.

The inspected top and object-perspective screenshots remain in the local capture folders. Saved snapshot IDs are listed in the context table above.

## Proposed experiments and rejected conclusions

| Candidate | What this run supports | Expected saving / limit |
|---|---|---|
| Bundle a selected skill with its mandatory reference | Both runs spend a separate model call before fetching kitchen-planning/references/planning-reference.md | A discovery round could be removed; the observed call costs 13.595–31.511 s, but part of it is useful planning/text. This is an upper-bound opportunity, not a measured saving. Needs the same two-run-or-larger comparison and planning checks. |
| Resolve the backsplash calculation/advertised capability | Both attempts fail with the same library lookup | A working switch improves image fidelity. A reliable unsupported-capability description could avoid a futile model/tool round; its saving cannot be isolated because searches/verification are mixed differently in the two runs. The calculation failure needs investigation in the affected planner/library path; any capability description belongs in library data, not a library-specific served rule. |
| Tool memoization / attribute indexing | Bootstrap acquisition is 16–20 ms and the run-1 search tool is about 16 ms | Local read CPU is not the observed bottleneck. Even eliminating the full measured information-tool union saves at most 0.036 / 0.498 s for these traces, and the larger value includes overlapping image work rather than reusable reads. |
| Precalculate docking vectors | Full kitchen create takes 1.447–1.821 s including calculation, loading, placement and feedback | Vector-only time is not isolated. Even eliminating the entire create is bounded by that 1.447–1.821 s, so do not claim it explains tens of seconds. |
| Change provider caching | Reported cache reads cover 84.52% / 83.12% of input, but each first request reads zero cached tokens | No Azure-vs-OpenAI or cache-on/off control was run. Neither cache speedup nor cross-conversation cache reuse is established. |
| Shrink image transport | Each plan-image tool returns about 2.65–2.75 MB | It reduces uploaded bytes if quality is maintained. Network upload/decode versus model image processing is not isolated, so no seconds saving is claimed. |

## Measurement gaps and open work

- **First painted frame:** no GPU presentation/paint marker was captured. Create-tool completion is an upper bound for a loaded kitchen; first visible geometry could appear earlier within the 1.447–1.821 s create. The exact first-frame timestamp requires a separate scene/render marker.
- **Provider internals:** model time combines network, queueing, input processing, reasoning, generation and SDK stream handling. Time to first output does not isolate prefill; response-header time does not isolate network RTT.
- **Tool internals:** the planner table separates planner access from the surrounding tool, but does not profile every individual filtering, projection, docking, library-calculation or kernel-load function. Remaining tool time must not be renamed CPU assembly time.
- **Final text start:** first visible text refers to the first planning preamble; the end of the turn marks completion of the final answer. Final-answer text-delta start was not separately instrumented.
- **Startup attribution:** page/module/library/plan/assistant initialization and the runner's readiness catalog pre-read overlap inside the ready phase. They were not profiled individually.
- **Instrumentation overhead:** response routing disables normal browser HTTP cache; extra console events, UTF-8 size measurement and log delivery add unquantified overhead. Both runs have the same hooks. Vite development compilation/server caches can still be warm. Do not use these page-startup numbers as production cold-start numbers.
- **Sampling:** two runs establish the requested repeated measurement and reveal large variation. They do not establish a p95, a stable service-level expectation or the cause of provider variability. No further paid runs or optimization variants are included. Another pair would cost approximately the observed 2–4 minutes and 1.19M input tokens, with variable output and provider latency.

## The benchmark to repeat

Use the exact commits, image digest and settings in manifest.json (local: `.temp/image-kitchen-left-wall-timing-2026-10-26/retained-evidence/manifest.json`). Keep the planner on port 5173; start the local assistant source with Node 22.23.3 using npm run dev:embedding -- --port 3001 --strictPort. Keep provider=openai, model=gpt-6-astra and the key in OPENAI_ASSISTANT_API_KEY. Do not silently substitute an Azure deployment.

For the existing local capture harness (scratch files are deliberately ignored by git):

```sh
node .temp/image-kitchen-left-wall-timing-2026-10-26/run-benchmark.mjs
node .agents/scripts/benchmark-hi-mcp-runs.js \
  .temp/image-kitchen-left-wall-timing-2026-10-26/rep-1 \
  .temp/image-kitchen-left-wall-timing-2026-10-26/rep-2 \
  --test image-kitchen-left-wall --out <new-output-directory>
```

Before a new capture, create a fresh dated scratch/session directory and update the harness output path; never overwrite this evidence. If scratch files are unavailable, copy the current prompt runner into the new scratch directory and recreate these measurement hooks: model fetch start/headers; assistant callback start/model-call-end/first-text; recordedPlannerApi tool start/end/result bytes; createPlannerApi method start/finally. Read URLs for both embedding imports must use the local source server as described in [local embedding setup](../../docs/setup/unreleased-embedding-lib.md). Keep performance.timeOrigin + performance.now() for all browser markers.

Retain run.json, timeline.json, planner-calls.json, plan-context.json, source SHAs, exclusions and snapshot IDs. Compute interval unions rather than summing concurrent tools; check the counts against the model usage and recorded calls. The standard benchmark intentionally leaves its current tools-s/other-s totals unknown because it lacks interval timestamps: the custom timing JSON here provides that additional evidence.

Verification performed: both runtime origin/module checks; every model request paired with a completed model call; all 19 tool starts paired with ends; nested planner calls paired; request-byte counts agree with assistant diagnostics; one failed backsplash call per run; both snapshot IDs present; timing interval accounting reconciles with full-turn duration; source-repository tracked state unchanged during capture.
