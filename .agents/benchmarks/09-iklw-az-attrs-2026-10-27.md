# image-kitchen-left-wall: detailed Azure gpt-6-astra timing — benchmark 09, the two-level attribute section

| Field | Value |
|---|---|
| Type / domain | Benchmark / HI Planning Assistant |
| Trigger | Benchmark 09: the two-level attribute section (D122) — the values of the attributes a planning sets at the create in the prefix, every other attribute with the number of its values and its values through find-attributes —, measured against [the baseline](baseline-iklw-az-2026-10-27.md); RML-18303 |
| Date / author | 2026-10-27 / Claude Code |
| Status | Measured: two completed turns, two saved plans |
| Ticket | [RML-18303](https://roomle.atlassian.net/browse/RML-18303) |
| Data | Measurements are retained in the tables below; raw captures remain in the ignored .temp/result/benchmark-09-az-attrs-2026-10-27 folder |
| Repeat | The fixture and settings of the baseline, the local planner with the two-level attribute section and the published embedding-lib; procedure below |

Affected repositories:

- **roomle-hi-example:** this benchmark report and the documentation indexes. Raw evidence remains local in .temp.
- **roomle-ui:** the planner measured with the two-level attribute section — 5fd409e84 on feat/hi-mcp-performance, merged into feat/hi-mcp-merge as 4415cdffd; the embedding-lib unchanged.

## Executive summary

The first completed kitchen create took **32.758 s** and **27.019 s** from assistant turn start; mean **29.889 s** (the baseline: 31.378 s). The complete assistant turn took **105.629 s** and **53.036 s**; mean **79.333 s** (75.696 s). Model calls occupied **94.59%** and **94.52%** of those turns.

Both runs create the kitchen in **model call 2**, and no run looks anything up before it: the create sets the look from the value lists the attributes section keeps — Classic fronts in Olive green 160, Walnut 215 for the carcase, the worktop and the toekick, the rail handle 20 — and leaves the attributes shown with `valueCount` to the article. Every first request carries **70,358 input tokens**, **8,722 fewer** than the baseline's 79,080; the library reference returns 232,192 bytes instead of 270,617. The create call takes **25.015 s** and **17.904 s**, of which **16.241 s** and **9.366 s** pass before its first output; kitchen creation itself took **1.768 s** and **1.559 s**.

Right after the kitchen, both runs look up the handle colour with one `find-attributes` call by ids (3.980 / 2.886 s) and set it black (4.871 / 3.437 s), after a first change that also asked for the backsplash and failed on the library's error, as in the baseline. Neither create set a sink model, so the article's Metra sink stands on the sink unit beside the hob, where the baselines had chosen the Axis sink: in run 2 the sink reaches over the hob in the final plan; run 1 saw it in its render and spent **40.742 s** on a swap, two door changes, a read and a second render. These are request/response wall times, including network and provider work, not isolated server compute times.

## What was asked and run

Test: **image-kitchen-left-wall**, from [docs/test-prompts.json](../../docs/test-prompts.json).

> create a kitchen like the one in the image on the left-hand wall of the room

Image: [kitchen-1.png](../../docs/images/kitchen-1.png), SHA-256 07a3fe7a8cb1f57f392f356cc52b8a2af78afe9e2ec4fe6e88a9a13e8b3b3d95. Starting plan: **ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv**, default-room. Exactly this prompt was sent; the optional suite prompt suffix was omitted. Two fresh browsers and conversations used the same prompt/image and source revisions. No random cases, provider warm-up requests or request pacing were added.

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

The skill responses of call 1 contain image-planning SKILL.md and kitchen-planning SKILL.md, the kitchen skill with its planning reference in one result of 35,685 bytes; no separate reference is fetched, and no model call reads the live plan sections before the create, since the plan state comes with the turn. There is therefore one starting point:

| Milestone / interval | Run 1 s | Run 2 s |
|---|---|---|
| Image/kitchen skill responses complete (timestamp) | 5.970 | 7.552 |
| First kitchen create starts (timestamp) | 30.989 | 25.460 |
| First kitchen create completes (timestamp) | 32.758 | 27.019 |
| Delta: skill responses → first kitchen complete | 26.788 | 19.467 |
| ↳ Agent/model call 2 within that interval | 25.015 | 17.904 |
| ↳ Kitchen creation tool within that interval | 1.768 | 1.559 |
| ↳ Local gaps within that interval | 0.004 | 0.004 |

For example, run 1 takes **26.788 s** from the skill files (5.970 s) to the completed kitchen (32.758 s). The model spends **25.015 s** deciding and emitting the kitchen payload — **16.241 s** of it before its first output, with 344 reasoning tokens —; the create tool then takes **1.768 s**, with about **0.004 s** of local gaps. Run 2 takes **19.467 s** over the same interval. The baseline took 29.195 / 25.555 s.

## Results: milestones and total time

| Measurement (seconds) | Run 1 | Run 2 | Mean |
|---|---|---|---|
| Page/library/assistant ready (recorded run start) | 5.382 | 5.338 | 5.360 |
| Library reference and plan state acquisition inside turn (warm) | 0.019 | 0.019 | 0.019 |
| First model generated output (turn start) | 5.765 | 7.363 | 6.564 |
| First visible assistant text (turn start) | 22.215 | 16.922 | 19.569 |
| First successful kitchen create completed (turn start) | 32.758 | 27.019 | 29.888 |
| First successful kitchen create completed (recorded run start) | 38.306 | 32.540 | 35.423 |
| First successful kitchen create completed (subprocess start) | 38.584 | 32.788 | 35.686 |
| Create tool execution alone | 1.768 | 1.559 | 1.664 |
| Assistant turn start → answer complete | 105.629 | 53.036 | 79.332 |
| Time after the first kitchen until answer complete | 72.871 | 26.017 | 49.444 |
| Runner chat phase (includes image preparation/collection) | 106.337 | 53.752 | 80.044 |
| Post-chat context, images and saved snapshot | 4.668 | 5.045 | 4.856 |
| Recorded run: ready + chat + snapshot | 116.387 | 64.135 | 90.261 |
| Full subprocess: browser startup through launcher shutdown | 116.922 | 64.625 | 90.773 |

"First kitchen" here means the first successful create-or-replace-groups result, including its placement and returned groups. Each run made one successful create and retained that kitchen. Actual scene insertion happens during the tool and can precede its result; see the limitations below.

## Results: where the assistant turn goes

| Wall time component | Run 1 s | Run 1 share | Run 2 s | Run 2 share |
|---|---|---|---|---|
| Model calls (union) | 99.911 | 94.59% | 50.129 | 94.52% |
| Tools including the reads before the first request (union) | 5.685 | 5.38% | 2.881 | 5.43% |
| Model/tool overlap (subtract once) | 0.000 | 0.00% | 0.000 | 0.00% |
| Other client work / gaps | 0.033 | 0.03% | 0.026 | 0.05% |
| Assistant turn | 105.629 | 100.00% | 53.036 | 100.00% |

The model sum is taken from the SDK's measured call durations; the tool union comes from browser start/end intervals. The remaining client time closes the measured turn exactly before display rounding. Summing individual tool durations would overcount the concurrent tools.

## Results: model, tools and planner calls in order

### Run 1

Recorded start: **2026-10-27T20:27:39.445Z** (27/10/2026 21:27:39 Europe/Vienna). Model/provider: Azure Responses, gpt-6-astra.

**Agent steps — duration per decision and tool execution**

| Step | Result / following tools | Start s | End s | Agent/model delta s | Tools delta s | Total step delta s |
|---|---|---|---|---|---|---|
| 1 | get-skill (image-planning); get-skill (kitchen-planning) | 0.024 | 5.970 | 5.942 | 0.002 | 5.946 |
| 2 | create-or-replace-groups | 5.974 | 32.758 | 25.015 | 1.768 | 26.784 |
| 3 | find-attributes | 32.758 | 36.738 | 3.971 | 0.009 | 3.980 |
| 4 | change-group-attribute | 36.739 | 46.267 | 9.372 | 0.157 | 9.529 |
| 5 | change-group-attribute | 46.268 | 51.139 | 4.149 | 0.722 | 4.871 |
| 6 | get-plan-images | 51.139 | 58.117 | 6.533 | 0.445 | 6.978 |
| 7 | get-plan-context | 58.119 | 69.177 | 11.044 | 0.013 | 11.058 |
| 8 | swap-root-modules | 69.177 | 83.775 | 13.740 | 0.857 | 14.598 |
| 9 | change-module-attribute | 83.776 | 87.820 | 3.370 | 0.673 | 4.044 |
| 10 | change-module-attribute | 87.821 | 91.039 | 2.544 | 0.674 | 3.218 |
| 11 | get-plan-context | 91.040 | 94.750 | 3.701 | 0.009 | 3.711 |
| 12 | get-plan-images | 94.751 | 98.864 | 3.773 | 0.340 | 4.113 |
| 13 | Final answer | 98.866 | 105.629 | 6.759 | 0.000 | 6.763 |

| Call | SDK start s | End s | Delta s (model) | First output s¹ | Remaining s² | Input tokens | Output / reasoning | Request bytes | Tools after model |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.024 | 5.966 | 5.942 | 5.742 | 0.200 | 70,358 | 55 / 0 | 572,792 | #3 get-skill; #4 get-skill |
| 2 | 5.974 | 30.989 | 25.015 | 16.241 | 8.774 | 78,500 | 839 / 344 | 85,912 | #5 create-or-replace-groups |
| 3 | 32.758 | 36.729 | 3.971 | 3.149 | 0.822 | 86,012 | 39 / 0 | 69,547 | #6 find-attributes |
| 4 | 36.739 | 46.110 | 9.372 | 8.305 | 1.067 | 87,904 | 119 / 34 | 52,198 | #7 change-group-attribute |
| 5 | 46.268 | 50.417 | 4.149 | 3.025 | 1.124 | 88,164 | 70 / 0 | 44,946 | #8 change-group-attribute |
| 6 | 51.139 | 57.672 | 6.533 | 4.034 | 2.498 | 88,566 | 141 / 53 | 45,294 | #9 get-plan-images |
| 7 | 58.119 | 69.163 | 11.044 | 10.636 | 0.408 | 91,131 | 232 / 209 | 227,255 | #10 get-plan-context |
| 8 | 69.177 | 82.917 | 13.740 | 10.878 | 2.862 | 92,201 | 346 / 200 | 46,338 | #11 swap-root-modules |
| 9 | 83.776 | 87.146 | 3.370 | 2.239 | 1.131 | 99,319 | 77 / 0 | 70,563 | #12 change-module-attribute |
| 10 | 87.821 | 90.365 | 2.544 | 1.793 | 0.751 | 99,497 | 61 / 0 | 44,744 | #13 change-module-attribute |
| 11 | 91.040 | 94.740 | 3.701 | 3.398 | 0.302 | 99,644 | 21 / 0 | 44,703 | #14 get-plan-context |
| 12 | 94.751 | 98.524 | 3.773 | 2.197 | 1.576 | 100,503 | 66 / 11 | 46,338 | #15 get-plan-images |
| 13 | 98.866 | 105.625 | 6.759 | 3.414 | 3.345 | 102,993 | 152 / 0 | 227,767 | Final answer |

¹ From the SDK model-call start to its first generated output; this can be reasoning, a tool call or text. ² The remaining model-stream time is response duration minus first-output duration. It is not a pure text-generation or reasoning measurement. Request fetch starts and response-header times remain in the local timeline.json capture.

| Call | Tool / requested information | Start s | End s | Delta s (tool) | Elapsed ms | Nested planner ms³ | Remaining ms⁴ | Result bytes | Result |
|---|---|---|---|---|---|---|---|---|---|
| 1 | get-plan-context: articles, attributes | 0.000 | 0.014 | 0.0133 | 13.3 | 5.6 | 7.7 | 232,192 | OK |
| 2 | get-plan-context: rooms, groups, obstacles, installationElements | 0.001 | 0.017 | 0.0163 | 16.3 | 2.5 | 13.8 | 5,631 | OK |
| 3 | get-skill: image-planning / SKILL.md | 5.968 | 5.969 | 0.0017 | 1.7 | 0.0 | 1.7 | 5,658 | OK |
| 4 | get-skill: kitchen-planning / SKILL.md | 5.968 | 5.970 | 0.0017 | 1.7 | 0.0 | 1.7 | 35,685 | OK |
| 5 | create-or-replace-groups: 1 group, 9 roots; placement left / center | 30.989 | 32.758 | 1.7684 | 1768.4 | 1718.0 | 50.4 | 25,056 | OK |
| 6 | find-attributes: ids mod_HandleColor, mod_HandlePosType, mod_SinkId | 36.729 | 36.738 | 0.0085 | 8.5 | 7.6 | 0.9 | 7,707 | OK |
| 7 | change-group-attribute: mod_HandleColor=Black, mod_HandlePosType=01, mod_CreateBacksplash=true | 46.111 | 46.267 | 0.1566 | 156.6 | 152.2 | 4.4 | 470 | Library error |
| 8 | change-group-attribute: mod_HandleColor=Black, mod_HandlePosType=01 | 50.417 | 51.139 | 0.7217 | 721.7 | 523.7 | 198.0 | 803 | OK |
| 9 | get-plan-images | 57.673 | 58.117 | 0.4445 | 444.5 | 416.4 | 28.1 | 182,744 | OK |
| 10 | get-plan-context: obstacles | 69.163 | 69.177 | 0.0132 | 13.2 | 11.9 | 1.3 | 1,847 | OK |
| 11 | swap-root-modules | 82.918 | 83.775 | 0.8570 | 857.0 | 684.4 | 172.6 | 26,072 | OK |
| 12 | change-module-attribute: mod_DoorDirectionSelection=Right | 87.147 | 87.820 | 0.6735 | 673.5 | 488.4 | 185.1 | 253 | OK |
| 13 | change-module-attribute: mod_DoorDirectionSelection=Left | 90.366 | 91.039 | 0.6736 | 673.6 | 508.0 | 165.6 | 212 | OK |
| 14 | get-plan-context: obstacles | 94.742 | 94.750 | 0.0089 | 8.9 | 7.6 | 1.3 | 1,847 | OK |
| 15 | get-plan-images | 98.524 | 98.864 | 0.3403 | 340.3 | 321.0 | 19.3 | 183,256 | OK |

³ Union of the underlying planner-call intervals inside this tool. ⁴ Tool elapsed minus nested planner intervals: forwarding, scheduling, validation, projection, serialization and any uninstrumented work. This is not a pure CPU measurement. Calls #1 and #2 are the assistant's automatic reads of the library reference and the plan state, before the first model request, rather than model-requested tools.

| Call | Containing tool | Planner method / arguments | Start s | End s | Delta s (planner) | Elapsed ms |
|---|---|---|---|---|---|---|
| 1 | #1 | getExternalObjectLibraryContext [["articles","masterData"]] | 0.002 | 0.007 | 0.0056 | 5.6 |
| 2 | #2 | getExternalObjectPlanContext [["rooms","groups","obstacles","installationElements"]] | 0.010 | 0.013 | 0.0025 | 2.5 |
| 3 | #5 | getExternalObjectPlanContext [["groups"]] | 30.991 | 30.991 | 0.0002 | 0.2 |
| 4 | #5 | externalObjectGroupOperation ["create-or-replace-groups"] | 30.991 | 32.702 | 1.7105 | 1710.5 |
| 5 | #5 | getExternalObjectPlanContext [["groups"]] | 32.702 | 32.709 | 0.0073 | 7.3 |
| 6 | #6 | getExternalObjectPlanContext [["groups"]] | 36.730 | 36.737 | 0.0076 | 7.6 |
| 7 | #6 | getExternalObjectLibraryContext [["masterData"]] | 36.730 | 36.737 | 0.0068 | 6.8 |
| 8 | #7 | getExternalObjectPlanContext [["groups"]] | 46.111 | 46.118 | 0.0071 | 7.1 |
| 9 | #7 | externalObjectGroupOperation ["change-group-attribute"] | 46.118 | 46.264 | 0.1451 | 145.1 |
| 10 | #8 | getExternalObjectPlanContext [["groups"]] | 50.417 | 50.423 | 0.0059 | 5.9 |
| 11 | #8 | externalObjectGroupOperation ["change-group-attribute"] | 50.423 | 50.935 | 0.5111 | 511.1 |
| 12 | #8 | getExternalObjectPlanContext [["groups"]] | 50.935 | 50.942 | 0.0067 | 6.7 |
| 13 | #9 | getExternalObjectSnapshot [["perspectiveObjectImage","topImage","keepOpenGeometry","imageType","imageQuality"]] | 57.674 | 58.091 | 0.4164 | 416.4 |
| 14 | #10 | getExternalObjectPlanContext [["obstacles","rooms"]] | 69.164 | 69.176 | 0.0119 | 11.9 |
| 15 | #11 | getExternalObjectPlanContext [["groups"]] | 82.920 | 82.937 | 0.0163 | 16.3 |
| 16 | #11 | externalObjectGroupOperation ["swap-root-modules"] | 82.937 | 83.599 | 0.6625 | 662.5 |
| 17 | #11 | getExternalObjectPlanContext [["groups"]] | 83.600 | 83.605 | 0.0056 | 5.6 |
| 18 | #12 | getExternalObjectPlanContext [["groups"]] | 87.148 | 87.159 | 0.0107 | 10.7 |
| 19 | #12 | externalObjectGroupOperation ["change-module-attribute"] | 87.159 | 87.631 | 0.4723 | 472.3 |
| 20 | #12 | getExternalObjectPlanContext [["groups"]] | 87.632 | 87.637 | 0.0054 | 5.4 |
| 21 | #13 | getExternalObjectPlanContext [["groups"]] | 90.366 | 90.372 | 0.0057 | 5.7 |
| 22 | #13 | externalObjectGroupOperation ["change-module-attribute"] | 90.372 | 90.868 | 0.4964 | 496.4 |
| 23 | #13 | getExternalObjectPlanContext [["groups"]] | 90.868 | 90.874 | 0.0059 | 5.9 |
| 24 | #14 | getExternalObjectPlanContext [["obstacles","rooms"]] | 94.742 | 94.750 | 0.0076 | 7.6 |
| 25 | #15 | getExternalObjectSnapshot [["perspectiveObjectImage","topImage","keepOpenGeometry","imageType","imageQuality"]] | 98.524 | 98.845 | 0.3210 | 321.0 |

The planner's own price refresh after the plan change, without a tool: 31.478–32.809 s, 32.813–33.281 s, 46.275–46.688 s, 51.167–51.634 s, 51.635–52.065 s, 83.786–84.448 s, 84.448–84.889 s, 87.832–88.331 s, 88.331–88.850 s, 91.055–91.533 s, 91.534–91.915 s.

Local capture: `.temp/result/benchmark-09-az-attrs-2026-10-27/iklw-rep-1/` (run.json, timeline.json, planner-calls.json and plan-context.json).

### Run 2

Recorded start: **2026-10-27T20:29:36.358Z** (27/10/2026 21:29:36 Europe/Vienna). Model/provider: Azure Responses, gpt-6-astra.

**Agent steps — duration per decision and tool execution**

| Step | Result / following tools | Start s | End s | Agent/model delta s | Tools delta s | Total step delta s |
|---|---|---|---|---|---|---|
| 1 | get-skill (image-planning); get-skill (kitchen-planning) | 0.025 | 7.552 | 7.523 | 0.002 | 7.527 |
| 2 | create-or-replace-groups | 7.556 | 27.019 | 17.904 | 1.559 | 19.463 |
| 3 | find-attributes | 27.020 | 29.905 | 2.875 | 0.011 | 2.886 |
| 4 | change-group-attribute | 29.906 | 32.920 | 2.876 | 0.137 | 3.015 |
| 5 | change-group-attribute | 32.921 | 36.358 | 2.722 | 0.715 | 3.437 |
| 6 | get-plan-images | 36.359 | 46.179 | 9.378 | 0.441 | 9.820 |
| 7 | Final answer | 46.180 | 53.036 | 6.852 | 0.000 | 6.856 |

| Call | SDK start s | End s | Delta s (model) | First output s¹ | Remaining s² | Input tokens | Output / reasoning | Request bytes | Tools after model |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.025 | 7.548 | 7.523 | 7.338 | 0.185 | 70,358 | 55 / 0 | 572,792 | #3 get-skill; #4 get-skill |
| 2 | 7.556 | 25.459 | 17.904 | 9.366 | 8.537 | 78,500 | 672 / 179 | 85,912 | #5 create-or-replace-groups |
| 3 | 27.020 | 29.895 | 2.875 | 2.387 | 0.488 | 85,872 | 29 / 0 | 69,547 | #6 find-attributes |
| 4 | 29.906 | 32.782 | 2.876 | 1.698 | 1.178 | 86,331 | 75 / 0 | 46,173 | #7 change-group-attribute |
| 5 | 32.921 | 35.643 | 2.722 | 1.852 | 0.870 | 86,548 | 58 / 0 | 44,946 | #8 change-group-attribute |
| 6 | 36.359 | 45.737 | 9.378 | 5.346 | 4.032 | 86,974 | 209 / 64 | 45,372 | #9 get-plan-images |
| 7 | 46.180 | 53.032 | 6.852 | 4.936 | 1.915 | 89,607 | 115 / 50 | 226,647 | Final answer |

¹ From the SDK model-call start to its first generated output; this can be reasoning, a tool call or text. ² The remaining model-stream time is response duration minus first-output duration. It is not a pure text-generation or reasoning measurement. Request fetch starts and response-header times remain in the local timeline.json capture.

| Call | Tool / requested information | Start s | End s | Delta s (tool) | Elapsed ms | Nested planner ms³ | Remaining ms⁴ | Result bytes | Result |
|---|---|---|---|---|---|---|---|---|---|
| 1 | get-plan-context: articles, attributes | 0.001 | 0.016 | 0.0151 | 15.1 | 5.6 | 9.5 | 232,192 | OK |
| 2 | get-plan-context: rooms, groups, obstacles, installationElements | 0.001 | 0.017 | 0.0162 | 16.2 | 2.6 | 13.6 | 5,631 | OK |
| 3 | get-skill: image-planning / SKILL.md | 7.550 | 7.552 | 0.0018 | 1.8 | 0.0 | 1.8 | 5,658 | OK |
| 4 | get-skill: kitchen-planning / SKILL.md | 7.550 | 7.552 | 0.0019 | 1.9 | 0.0 | 1.9 | 35,685 | OK |
| 5 | create-or-replace-groups: 1 group, 9 roots; placement left / center | 25.460 | 27.019 | 1.5589 | 1558.9 | 1493.2 | 65.7 | 25,056 | OK |
| 6 | find-attributes: ids mod_HandleColor | 29.895 | 29.905 | 0.0105 | 10.5 | 7.5 | 3.0 | 1,682 | OK |
| 7 | change-group-attribute: mod_HandleColor=Black, mod_CreateBacksplash=true | 32.783 | 32.920 | 0.1370 | 137.0 | 131.0 | 6.0 | 470 | Library error |
| 8 | change-group-attribute: mod_HandleColor=Black | 35.644 | 36.358 | 0.7150 | 715.0 | 517.0 | 198.0 | 881 | OK |
| 9 | get-plan-images | 45.737 | 46.179 | 0.4411 | 441.1 | 415.3 | 25.8 | 182,136 | OK |

³ Union of the underlying planner-call intervals inside this tool. ⁴ Tool elapsed minus nested planner intervals: forwarding, scheduling, validation, projection, serialization and any uninstrumented work. This is not a pure CPU measurement. Calls #1 and #2 are the assistant's automatic reads of the library reference and the plan state, before the first model request, rather than model-requested tools.

| Call | Containing tool | Planner method / arguments | Start s | End s | Delta s (planner) | Elapsed ms |
|---|---|---|---|---|---|---|
| 1 | #1 | getExternalObjectLibraryContext [["articles","masterData"]] | 0.002 | 0.007 | 0.0056 | 5.6 |
| 2 | #2 | getExternalObjectPlanContext [["rooms","groups","obstacles","installationElements"]] | 0.010 | 0.013 | 0.0026 | 2.6 |
| 3 | #5 | getExternalObjectPlanContext [["groups"]] | 25.462 | 25.462 | 0.0002 | 0.2 |
| 4 | #5 | externalObjectGroupOperation ["create-or-replace-groups"] | 25.462 | 26.949 | 1.4867 | 1486.7 |
| 5 | #5 | getExternalObjectPlanContext [["groups"]] | 26.949 | 26.956 | 0.0063 | 6.3 |
| 6 | #6 | getExternalObjectPlanContext [["groups"]] | 29.895 | 29.903 | 0.0075 | 7.5 |
| 7 | #6 | getExternalObjectLibraryContext [["masterData"]] | 29.895 | 29.902 | 0.0067 | 6.7 |
| 8 | #7 | getExternalObjectPlanContext [["groups"]] | 32.786 | 32.798 | 0.0119 | 11.9 |
| 9 | #7 | externalObjectGroupOperation ["change-group-attribute"] | 32.798 | 32.917 | 0.1191 | 119.1 |
| 10 | #8 | getExternalObjectPlanContext [["groups"]] | 35.644 | 35.651 | 0.0065 | 6.5 |
| 11 | #8 | externalObjectGroupOperation ["change-group-attribute"] | 35.651 | 36.155 | 0.5046 | 504.6 |
| 12 | #8 | getExternalObjectPlanContext [["groups"]] | 36.156 | 36.162 | 0.0059 | 5.9 |
| 13 | #9 | getExternalObjectSnapshot [["perspectiveObjectImage","topImage","keepOpenGeometry","imageType","imageQuality"]] | 45.739 | 46.154 | 0.4153 | 415.3 |

The planner's own price refresh after the plan change, without a tool: 25.954–27.317 s, 27.319–27.799 s, 32.928–33.578 s, 36.386–37.025 s, 37.025–37.461 s.

Local capture: `.temp/result/benchmark-09-az-attrs-2026-10-27/iklw-rep-2/` (run.json, timeline.json, planner-calls.json and plan-context.json).

## Context, cache and transport

| Measurement | Run 1 | Run 2 |
|---|---|---|
| Model calls | 13 | 7 |
| Tools including the reads before the first request | 15 | 9 |
| Input tokens | 1,184,792 | 584,190 |
| Output tokens (include reasoning) | 2,218 | 1,213 |
| Reasoning tokens | 851 | 293 |
| Cache-read tokens / share of input | 1,081,763 / 91.30% | 573,062 / 98.10% |
| Cache-write tokens | 102,990 | 11,107 |
| First call: cache-read tokens | 0 | 70,355 |
| Request JSON bytes, all calls | 1,578,397 | 1,091,389 |
| Reference bytes (exclude tools/current input) | 257,666 | 257,666 |
| Shared-reference SHA-256 | `df3d26033b7fc0275b0bae589b411113d3611a69a8ede7b4ba066347733f525a` | `df3d26033b7fc0275b0bae589b411113d3611a69a8ede7b4ba066347733f525a` |
| Plan state bytes (supplied with the turn) | 4,822 | 4,822 |
| Information tools, elapsed union ms | 49.1 | 29.1 |
| Information tools, summed call ms (overlap included) | 63.6 | 45.5 |
| Saved plan snapshot | `ps_t269atvz4f1uhnetyz7xr3k507uk1yo` | `ps_t26104gn9m11h4qy8df24p5pfeh4sx2e` |

All token/cache/reasoning fields have complete coverage for completed calls. Cache reads are already part of input tokens and reasoning is already part of output tokens. Request bytes count the whole uncompressed JSON sent on every fetch, including image data. With Responses chaining a later request carries only its new input, so a whole turn sends **1,578,397** and **1,091,389 bytes**, of which the first request is **572,792 bytes** (the baseline: 610,274). Both runs read the same shared reference, **257,666 bytes** with the same SHA-256 — 38,016 bytes less than the baseline's 295,682, the value lists that left the attributes section. The first call of run 1 reads **no token** from the cache: it is the first request with the new prefix on this deployment. Run 2's first call reads **70,355 of its 70,358 input tokens** from the cache; over the turn the cache covers 91.30% and 98.10% of the input.

The library reference returns **232,192 bytes**, the plan state **5,631 bytes**; both come with the turn before the first request. The `find-attributes` results are **7,707** and **1,682 bytes** — the values of three and of one attribute. The get-plan-images results are about **183 KB** each, two JPEG renders, part of the next request.

## Findings and the evidence behind them

### 1. The first kitchen stays at call 2, with nothing looked up before it

Call 1 fetches the two skills; call 2 is the create in both runs, as in the baseline. Neither create sets an attribute the section shows with `valueCount`: the authoring rule says that the first kitchen does not wait for a lookup and that such an attribute keeps its article's value until a change after the create. The baseline's creates had set the handle colour and position, the hob and the sink model from the lists in the prefix; here the hob is the article's ET601FNP1E — the model the baseline chose —, the handle colour and the sink model are the article's.

The create call takes **25.015 / 17.904 s** (the baseline: 27.884 / 23.730 s), **16.241 / 9.366 s** until its first output (17.620 / 13.735 s), with **344 / 179 reasoning tokens** (378 / 269) and **839 / 672 output tokens** (967 / 852). The payload is shorter by the attributes it no longer sets. Of the 32.758 / 27.019 s to the first kitchen, the create call is 76% / 66%. Two runs per build do not separate the change from the provider's spread.

### 2. Every request carries 8,722 input tokens less

The first request carries **70,358 input tokens** in both runs, against **79,080** in the baseline; the create call **78,500** against 87,222. The difference, 8,722 tokens, is the value lists that left the attributes section — 33,399 bytes of the section (121,067 → 87,668, measured without a model before the runs) and 38,016 bytes of the shared reference as sent. That is more than the 7,300 tokens the analysis estimated at 4.53 bytes per token: the value lists, codes and colour codes, tokenize at about 3.8 bytes per token. Every later call of the turn carries the same difference.

The first call of run 1 reads nothing from the cache — the first request with the new prefix — and takes 5.942 s against the baseline's 3.877 s; run 2's first call reads the prefix from the cache and still waits 7.338 s for its first output. Both are within the provider-side waits of the baselines (up to 16.6 s before a first output without reasoning).

### 3. The handle colour costs a lookup round after the kitchen

Right after the create, both runs call `find-attributes` by ids — run 1 for the handle colour, the handle position and the sink model in one call (3.980 s), run 2 for the handle colour (2.886 s) — and set the handles black with `change-group-attribute`; the library then switches the rail handle to the curved bow handle, as in the baseline. The first change of each run also asked for the backsplash and failed on Error 14034 (9.529 / 3.015 s), the second set the handles alone (4.871 / 3.437 s). The baseline's runs spent their lookup round on the backsplash (8.085 / 3.885 s) and changed the handles after it too; the shape after the kitchen is the same, the round looks up other attributes.

### 4. The article's sink stands over the hob

The image kitchen puts the sink unit SUT60 beside the oven-and-hob unit UHS60. Both baseline creates set `mod_SinkId` Axis_R from the list in the prefix; that sink sits within its unit. Here the list is one call away (`valueCount` 12), the create leaves the sink to the article, and the article's Metra_R sink reaches over the hob: run 2 ends with it — its answer speaks of "limited preparation space between sink and hob" —, run 1 looked up `mod_SinkId` with the handle attributes but did not set it, saw the overlap in its first render, read the obstacles (11.058 s), swapped the sink unit with the base unit beside it (14.598 s), set the door hinges of the sink unit and two wall cabinets (4.044 + 3.218 s), read the obstacles again (3.711 s) and rendered again (4.113 s): **40.742 s** of its 72.871 s after the kitchen.

The cause is the rule served with the two-level section: the first kitchen does not wait for a lookup, so an attribute without its list in the prefix keeps the article's value, and the article's value of the sink model does not fit beside a hob. The lists the analysis expected to cost a round cost a defect here: the sink model is a sub module's attribute, outside the structural level 1.

### 5. Plan verification

Both snapshots contain one **3,010 mm** kitchen centred on the left wall at [-685, -240, 0] with **rotationZ = 90°**: fridge-freezer, drawer-and-door base, oven with hob, the sink base, a door base, three wall cabinets and the chimney hood (HK260, USTB60, UHS60, SUT60, UTB60, OTB60 ×3, DU) — run 1 with the sink base moved to the end of the row. The object perspectives and top views were inspected: olive-green fronts, walnut-effect carcases and wall cabinets, black bow handles, as in the baseline's run 2; run 2's sink reaches over the hob. Both answers disclose the missing dark backsplash. This is a latency benchmark of those resulting plans, not an assertion of pixel-identical image reproduction.

## Proposed experiments and rejected conclusions

| Candidate | What this run supports | Expected saving / limit |
|---|---|---|
| Keep the two-level section with the first-kitchen rule | The first kitchen at call 2 with no lookup before it; 8,722 input tokens less per request; the create call 25.015 / 17.904 s against 27.884 / 23.730 s | The sink model stays the article's: one run of two ends with the sink over the hob, the other spends 40.742 s fixing it. Accepting it needs an answer to the sink. |
| The sink model in the create, through the rule | Both baseline creates chose Axis_R from the list; here no create looks it up | Asking for a lookup of the sink before the create is the round the first-kitchen rule avoids; a rule naming the sink is library content in the served text (§2.4). |
| A structural level 1 that keeps the sink model | The sink model is an attribute of the sink sub module of SUT60 | The attributes of the catalog's sub modules keep 288 attributes and 111 KB of the section — almost no saving (the analysis, §7). |
| The neutral wording without the first-kitchen rule | Not measured: every run here followed the rule | The agent could look up the sink before the create — one round before the first kitchen, the rejection criterion of the analysis. |
| Tool memoization / attribute indexing / precalculated docking vectors | The information tools take milliseconds; find-attributes by ids 8.5 / 10.5 ms | Local work is not the bottleneck. |

## Measurement gaps and open work

- **First painted frame:** no GPU presentation/paint marker was captured. Create-tool completion is an upper bound for a loaded kitchen; first visible geometry could appear earlier within the 1.559–1.768 s create.
- **Provider internals:** model time combines network, queueing, input processing, reasoning, generation and SDK stream handling. Time to first output does not isolate prefill; response-header time does not isolate network RTT.
- **Tool internals:** the planner table separates planner access from the surrounding tool, but does not profile every individual filtering, projection, docking, library-calculation or kernel-load function. Remaining tool time must not be renamed CPU assembly time.
- **Final text start:** first visible text refers to the first planning preamble; the end of the turn marks completion of the final answer. Final-answer text-delta start was not separately instrumented.
- **Startup attribution:** page/module/library/plan/assistant initialization, the runner's readiness read and the assistant's library read before the first prompt overlap inside the ready phase. They were not profiled individually.
- **Instrumentation overhead:** extra console events, UTF-8 size measurement and log delivery add unquantified overhead; both runs have the same hooks. The planner is a Vite development server; do not use these page-startup numbers as production cold-start numbers.
- **Sampling:** two runs establish a repeated measurement and show large variation after the kitchen. They do not establish a p95, a stable service-level expectation or the cause of provider variability. Another pair costs about 3 minutes and 1.8M input tokens, most of them read from the cache.6M input tokens, most of them read from the cache.
- **The baseline is another hour's provider state:** the baseline ran at 17:02–17:06 UTC, these runs at 20:27–20:30 UTC; the first request of run 1 met an empty cache for the new prefix. The seconds of two runs per build do not separate the change from the provider's spread; the input tokens do.

## The benchmark to repeat

Use the commits, image digest and settings in manifest.json (local: `.temp/result/benchmark-09-az-attrs-2026-10-27/manifest.json`). Keep the planner on port 5173 and check that its checkout is the one to measure — here `feat/hi-mcp-merge` at 4415cdffd, the baselines' a8fe64618 plus the two-level attribute section; the example page pins the embedding-lib. Keep `"provider": "gpt-6-astra", "apiKey": "$AZURE_GPT_KEY"` with the key in AZURE_GPT_KEY. Do not silently substitute another provider.

```sh
cd .temp/result/benchmark-09-az-attrs-2026-10-27
node make-timing-runner.mjs
REPS=1,2 node run-reps.mjs iklw fkwm
node analyze.mjs iklw-rep-1 iklw-rep-2 fkwm-rep-1 fkwm-rep-2
node write-prose.mjs
node write-09-iklw.mjs
```

The timing runner is byte for byte the baselines' (the prompt runner is unchanged since); `analyze.mjs` is the baselines' with one change, a `find-attributes` call by `ids` labelled by its ids. `probe/` holds the sections read without a model before the runs. Before a new capture, copy these scripts into a fresh dated session directory and point the paths there; never overwrite this evidence.

Retain run.json, timeline.json, planner-calls.json, plan-context.json, source SHAs, exclusions and snapshot IDs. Compute interval unions rather than summing concurrent tools; check the counts against the model usage and recorded calls.

Verification performed: every model request paired with a completed model call and its diagnostics bytes; all tool starts paired with ends; the nested planner calls paired with their log lines, the two parallel reads before the first request by their method; the interval accounting reconciles with the full-turn duration; one failed backsplash call per run; both snapshot IDs present; the roomle-ui checkout stayed on 4415cdffd through all four runs of the session.
