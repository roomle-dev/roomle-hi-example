# image-kitchen-left-wall: detailed Azure gpt-6-astra timing — the baseline

| Field | Value |
|---|---|
| Type / domain | Benchmark / HI Planning Assistant |
| Trigger | The baseline of the time measurement for image-kitchen-left-wall on the Azure deployment, with proposals A, B, D, E, F and the plan state per turn in place; RML-18303 |
| Date / author | 2026-10-27 / Claude Code |
| Status | Measured: two completed turns, two saved plans |
| Ticket | [RML-18303](https://roomle.atlassian.net/browse/RML-18303) |
| Data | Measurements are retained in the tables below; raw captures remain in the ignored .temp/result/baseline-iklw-az-2026-10-27 folder |
| Repeat | Same fixture, the Azure deployment, the local planner and the published embedding-lib; procedure below |

Affected repositories:

- **roomle-hi-example:** this benchmark report and the documentation indexes. Raw evidence remains local in .temp.
- **roomle-ui:** the planner and the embedding-lib measured, unchanged.

## Executive summary

The first completed kitchen create took **33.099 s** and **29.657 s** from assistant turn start; mean **31.378 s**. The complete assistant turn took **96.941 s** and **54.451 s**; mean **75.696 s**. Model calls occupied **96.64%** and **94.24%** of those turns.

Both runs create the kitchen in **model call 2**. Call 1 fetches the image and the kitchen skill — the kitchen skill with its planning reference in one result — and the library reference and the plan state come with the turn, read in **19.5 ms** and **17.8 ms** before the first request. The create call is the largest block: **27.884 s** and **23.730 s**, of which **17.620 s** and **13.735 s** pass before its first output. Kitchen creation itself took **1.309 s** and **1.821 s**.

After the kitchen, the runs differ: run 1 spends **63.842 s** — the backsplash the library cannot calculate, two handle changes, a render and an answer whose first output waited 16.6 s —, run 2 **24.794 s**. These are request/response wall times, including network and provider work, not isolated server compute times. The first-kitchen milestone is successful create-tool completion: a conservative point by which the kitchen has been loaded into the plan, not a measured first painted GPU frame.

## What was asked and run

Test: **image-kitchen-left-wall**, from [docs/test-prompts.json](../../docs/test-prompts.json).

> create a kitchen like the one in the image on the left-hand wall of the room

Image: [kitchen-1.png](../../docs/images/kitchen-1.png), SHA-256 07a3fe7a8cb1f57f392f356cc52b8a2af78afe9e2ec4fe6e88a9a13e8b3b3d95. Starting plan: **ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv**, default-room. Exactly this prompt was sent; the optional suite prompt suffix was omitted. Two fresh browsers and conversations used the same prompt/image and source revisions. No random cases, provider warm-up requests or request pacing were added.

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
- Nested planner calls are attributed by the [hi-mcp] tool and call log lines; the two reads before the first request run in parallel and are told apart by their planner method. Nested planner time is included in tool time. Overlapping tools are counted once for wall time. Model/tool overlap is measured from intervals and subtracted once; it is 0.000 s / 0.002 s here.
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
| Image/kitchen skill responses complete (timestamp) | 3.903 | 4.102 |
| First kitchen create starts (timestamp) | 31.790 | 27.836 |
| First kitchen create completes (timestamp) | 33.099 | 29.657 |
| Delta: skill responses → first kitchen complete | 29.195 | 25.555 |
| ↳ Agent/model call 2 within that interval | 27.884 | 23.730 |
| ↳ Kitchen creation tool within that interval | 1.309 | 1.821 |
| ↳ Local gaps within that interval | 0.002 | 0.004 |

For example, run 1 takes **29.195 s** from the skill files (3.903 s) to the completed kitchen (33.099 s). The model spends **27.884 s** deciding and emitting the kitchen payload — **17.620 s** of it before its first output, with 378 reasoning tokens —; the create tool then takes **1.309 s**, with about **0.002 s** of local gaps. Run 2 takes **25.555 s** over the same interval.

## Results: milestones and total time

| Measurement (seconds) | Run 1 | Run 2 | Mean |
|---|---|---|---|
| Page/library/assistant ready (recorded run start) | 6.142 | 5.611 | 5.877 |
| Library reference and plan state acquisition inside turn (warm) | 0.019 | 0.018 | 0.019 |
| First model generated output (turn start) | 3.728 | 3.862 | 3.795 |
| First visible assistant text (turn start) | 21.525 | 17.842 | 19.683 |
| First successful kitchen create completed (turn start) | 33.099 | 29.657 | 31.378 |
| First successful kitchen create completed (recorded run start) | 39.409 | 35.437 | 37.423 |
| First successful kitchen create completed (subprocess start) | 39.701 | 35.715 | 37.708 |
| Create tool execution alone | 1.309 | 1.821 | 1.565 |
| Assistant turn start → answer complete | 96.941 | 54.451 | 75.696 |
| Time after the first kitchen until answer complete | 63.842 | 24.794 | 44.318 |
| Runner chat phase (includes image preparation/collection) | 97.647 | 55.147 | 76.397 |
| Post-chat context, images and saved snapshot | 4.626 | 4.726 | 4.676 |
| Recorded run: ready + chat + snapshot | 108.415 | 65.484 | 86.950 |
| Full subprocess: browser startup through launcher shutdown | 108.958 | 66.007 | 87.483 |

"First kitchen" here means the first successful create-or-replace-groups result, including its placement and returned groups. Each run made one successful create and retained that kitchen. Actual scene insertion happens during the tool and can precede its result; see the limitations below.

## Results: where the assistant turn goes

| Wall time component | Run 1 s | Run 1 share | Run 2 s | Run 2 share |
|---|---|---|---|---|
| Model calls (union) | 93.688 | 96.64% | 51.314 | 94.24% |
| Tools including the reads before the first request (union) | 3.229 | 3.33% | 3.112 | 5.71% |
| Model/tool overlap (subtract once) | 0.000 | 0.00% | 0.002 | 0.00% |
| Other client work / gaps | 0.024 | 0.02% | 0.027 | 0.05% |
| Assistant turn | 96.941 | 100.00% | 54.451 | 100.00% |

The model sum is taken from the SDK's measured call durations; the tool union comes from browser start/end intervals. The remaining client time closes the measured turn exactly before display rounding. Summing individual tool durations would overcount the concurrent tools.

## Results: model, tools and planner calls in order

### Run 1

Recorded start: **2026-10-27T17:02:47.351Z** (27/10/2026 18:02:47 Europe/Vienna). Model/provider: Azure Responses, gpt-6-astra.

**Agent steps — duration per decision and tool execution**

| Step | Result / following tools | Start s | End s | Agent/model delta s | Tools delta s | Total step delta s |
|---|---|---|---|---|---|---|
| 1 | get-skill (image-planning); get-skill (kitchen-planning) | 0.024 | 3.903 | 3.877 | 0.001 | 3.879 |
| 2 | create-or-replace-groups | 3.905 | 33.099 | 27.884 | 1.309 | 29.194 |
| 3 | find-attributes; get-plan-context | 33.100 | 41.202 | 8.085 | 0.017 | 8.103 |
| 4 | change-group-attribute | 41.203 | 55.954 | 14.605 | 0.146 | 14.752 |
| 5 | change-group-attribute | 55.955 | 65.149 | 8.538 | 0.655 | 9.195 |
| 6 | change-group-attribute | 65.150 | 70.785 | 4.989 | 0.644 | 5.635 |
| 7 | get-plan-images | 70.786 | 76.797 | 5.571 | 0.440 | 6.011 |
| 8 | Final answer | 76.798 | 96.941 | 20.139 | 0.000 | 20.143 |

| Call | SDK start s | End s | Delta s (model) | First output s¹ | Remaining s² | Input tokens | Output / reasoning | Request bytes | Tools after model |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.024 | 3.901 | 3.877 | 3.704 | 0.173 | 79,080 | 55 / 0 | 610,274 | #3 get-skill; #4 get-skill |
| 2 | 3.905 | 31.789 | 27.884 | 17.620 | 10.264 | 87,222 | 967 / 378 | 85,378 | #5 create-or-replace-groups |
| 3 | 33.100 | 41.184 | 8.085 | 7.898 | 0.187 | 95,519 | 153 / 91 | 71,732 | #6 find-attributes; #7 get-plan-context |
| 4 | 41.203 | 55.807 | 14.605 | 13.713 | 0.892 | 97,277 | 57 / 0 | 48,980 | #8 change-group-attribute |
| 5 | 55.955 | 64.493 | 8.538 | 7.111 | 1.427 | 97,477 | 203 / 111 | 44,412 | #9 change-group-attribute |
| 6 | 65.150 | 70.139 | 4.989 | 3.997 | 0.992 | 98,044 | 96 / 24 | 44,823 | #10 change-group-attribute |
| 7 | 70.786 | 76.356 | 5.571 | 2.615 | 2.956 | 98,409 | 116 / 19 | 44,501 | #11 get-plan-images |
| 8 | 76.798 | 96.937 | 20.139 | 16.553 | 3.586 | 100,949 | 134 / 0 | 238,989 | Final answer |

¹ From the SDK model-call start to its first generated output; this can be reasoning, a tool call or text. ² The remaining model-stream time is response duration minus first-output duration. It is not a pure text-generation or reasoning measurement. Request fetch starts and response-header times remain in the local timeline.json capture.

| Call | Tool / requested information | Start s | End s | Delta s (tool) | Elapsed ms | Nested planner ms³ | Remaining ms⁴ | Result bytes | Result |
|---|---|---|---|---|---|---|---|---|---|
| 1 | get-plan-context: articles, attributes | 0.001 | 0.015 | 0.0148 | 14.8 | 5.5 | 9.3 | 270,617 | OK |
| 2 | get-plan-context: rooms, groups, obstacles, installationElements | 0.001 | 0.017 | 0.0161 | 16.1 | 2.4 | 13.7 | 5,631 | OK |
| 3 | get-skill: image-planning / SKILL.md | 3.902 | 3.903 | 0.0007 | 0.7 | 0.0 | 0.7 | 5,658 | OK |
| 4 | get-skill: kitchen-planning / SKILL.md | 3.902 | 3.903 | 0.0007 | 0.7 | 0.0 | 0.7 | 35,685 | OK |
| 5 | create-or-replace-groups: 1 group, 9 roots; placement left / center | 31.790 | 33.099 | 1.3090 | 1309.0 | 1264.0 | 45.0 | 27,775 | OK |
| 6 | find-attributes: backsplash | 41.185 | 41.202 | 0.0171 | 17.1 | 10.5 | 6.6 | 3,094 | OK |
| 7 | get-plan-context: obstacles | 41.185 | 41.202 | 0.0171 | 17.1 | 3.1 | 14.0 | 1,851 | OK |
| 8 | change-group-attribute: mod_CreateBacksplash=true | 55.809 | 55.954 | 0.1456 | 145.6 | 139.8 | 5.8 | 470 | Library error |
| 9 | change-group-attribute: mod_HandleDesign=110, mod_DishwasherSupplier=Siemens, mod_DishwasherId=SN87TX02CE | 64.494 | 65.149 | 0.6551 | 655.1 | 493.7 | 161.4 | 866 | OK |
| 10 | change-group-attribute: mod_HandleDesign=100, mod_HandleColor=Black | 70.140 | 70.785 | 0.6445 | 644.5 | 479.6 | 164.9 | 544 | OK |
| 11 | get-plan-images | 76.357 | 76.797 | 0.4401 | 440.1 | 413.8 | 26.3 | 195,012 | OK |

³ Union of the underlying planner-call intervals inside this tool. ⁴ Tool elapsed minus nested planner intervals: forwarding, scheduling, validation, projection, serialization and any uninstrumented work. This is not a pure CPU measurement. Calls #1 and #2 are the assistant's automatic reads of the library reference and the plan state, before the first model request, rather than model-requested tools.

| Call | Containing tool | Planner method / arguments | Start s | End s | Delta s (planner) | Elapsed ms |
|---|---|---|---|---|---|---|
| 1 | #1 | getExternalObjectLibraryContext [["articles","masterData"]] | 0.002 | 0.007 | 0.0055 | 5.5 |
| 2 | #2 | getExternalObjectPlanContext [["rooms","groups","obstacles","installationElements"]] | 0.009 | 0.012 | 0.0024 | 2.4 |
| 3 | #5 | getExternalObjectPlanContext [["groups"]] | 31.792 | 31.792 | 0.0003 | 0.3 |
| 4 | #5 | externalObjectGroupOperation ["create-or-replace-groups"] | 31.793 | 33.050 | 1.2578 | 1257.8 |
| 5 | #5 | getExternalObjectPlanContext [["groups"]] | 33.051 | 33.057 | 0.0059 | 5.9 |
| 6 | #6 | getExternalObjectPlanContext [["groups"]] | 41.186 | 41.196 | 0.0105 | 10.5 |
| 7 | #6 | getExternalObjectLibraryContext [["masterData"]] | 41.186 | 41.196 | 0.0096 | 9.6 |
| 8 | #7 | getExternalObjectPlanContext [["obstacles","rooms"]] | 41.198 | 41.202 | 0.0031 | 3.1 |
| 9 | #8 | getExternalObjectPlanContext [["groups"]] | 55.810 | 55.821 | 0.0108 | 10.8 |
| 10 | #8 | externalObjectGroupOperation ["change-group-attribute"] | 55.821 | 55.950 | 0.1290 | 129.0 |
| 11 | #9 | getExternalObjectPlanContext [["groups"]] | 64.495 | 64.506 | 0.0102 | 10.2 |
| 12 | #9 | externalObjectGroupOperation ["change-group-attribute"] | 64.506 | 64.984 | 0.4782 | 478.2 |
| 13 | #9 | getExternalObjectPlanContext [["groups"]] | 64.984 | 64.990 | 0.0053 | 5.3 |
| 14 | #10 | getExternalObjectPlanContext [["groups"]] | 70.141 | 70.151 | 0.0099 | 9.9 |
| 15 | #10 | externalObjectGroupOperation ["change-group-attribute"] | 70.151 | 70.616 | 0.4645 | 464.5 |
| 16 | #10 | getExternalObjectPlanContext [["groups"]] | 70.616 | 70.621 | 0.0052 | 5.2 |
| 17 | #11 | getExternalObjectSnapshot [["perspectiveObjectImage","topImage","keepOpenGeometry","imageType","imageQuality"]] | 76.357 | 76.771 | 0.4138 | 413.8 |

The planner's own price refresh after the plan change, without a tool: 32.302–33.179 s, 33.180–33.840 s, 55.964–56.550 s, 65.192–65.621 s, 65.621–66.028 s, 70.797–71.268 s, 71.269–71.711 s.

Local capture: `.temp/result/baseline-iklw-az-2026-10-27/iklw-rep-1/` (run.json, timeline.json, planner-calls.json and plan-context.json).

### Run 2

Recorded start: **2026-10-27T17:04:36.314Z** (27/10/2026 18:04:36 Europe/Vienna). Model/provider: Azure Responses, gpt-6-astra.

**Agent steps — duration per decision and tool execution**

| Step | Result / following tools | Start s | End s | Agent/model delta s | Tools delta s | Total step delta s |
|---|---|---|---|---|---|---|
| 1 | get-skill (image-planning); get-skill (kitchen-planning) | 0.022 | 4.102 | 4.076 | 0.002 | 4.080 |
| 2 | create-or-replace-groups | 4.106 | 29.657 | 23.730 | 1.821 | 25.550 |
| 3 | find-attributes | 29.658 | 33.553 | 3.885 | 0.010 | 3.895 |
| 4 | change-group-attribute | 33.554 | 36.265 | 2.569 | 0.141 | 2.711 |
| 5 | get-plan-context | 36.266 | 38.517 | 2.246 | 0.005 | 2.251 |
| 6 | change-module-attribute | 38.515 | 42.778 | 3.584 | 0.676 | 4.263 |
| 7 | get-plan-context | 42.779 | 44.813 | 2.030 | 0.004 | 2.034 |
| 8 | get-plan-images | 44.813 | 48.565 | 3.312 | 0.438 | 3.752 |
| 9 | Final answer | 48.566 | 54.451 | 5.884 | 0.000 | 5.885 |

| Call | SDK start s | End s | Delta s (model) | First output s¹ | Remaining s² | Input tokens | Output / reasoning | Request bytes | Tools after model |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.022 | 4.098 | 4.076 | 3.839 | 0.236 | 79,080 | 55 / 0 | 610,274 | #3 get-skill; #4 get-skill |
| 2 | 4.106 | 27.836 | 23.730 | 13.735 | 9.995 | 87,222 | 852 / 269 | 85,378 | #5 create-or-replace-groups |
| 3 | 29.658 | 33.543 | 3.885 | 3.252 | 0.633 | 95,173 | 43 / 21 | 70,986 | #6 find-attributes |
| 4 | 33.554 | 36.123 | 2.569 | 1.806 | 0.762 | 95,387 | 57 / 0 | 44,716 | #7 change-group-attribute |
| 5 | 36.266 | 38.511 | 2.246 | 2.000 | 0.245 | 95,584 | 33 / 10 | 44,412 | #8 get-plan-context |
| 6 | 38.515 | 42.099 | 3.584 | 2.705 | 0.878 | 96,457 | 81 / 21 | 45,810 | #9 change-module-attribute |
| 7 | 42.779 | 44.809 | 2.030 | 1.717 | 0.313 | 96,597 | 21 / 0 | 44,128 | #10 get-plan-context |
| 8 | 44.813 | 48.125 | 3.312 | 2.433 | 0.879 | 97,458 | 56 / 11 | 45,810 | #11 get-plan-images |
| 9 | 48.566 | 54.450 | 5.884 | 2.393 | 3.490 | 99,938 | 135 / 0 | 228,069 | Final answer |

¹ From the SDK model-call start to its first generated output; this can be reasoning, a tool call or text. ² The remaining model-stream time is response duration minus first-output duration. It is not a pure text-generation or reasoning measurement. Request fetch starts and response-header times remain in the local timeline.json capture.

| Call | Tool / requested information | Start s | End s | Delta s (tool) | Elapsed ms | Nested planner ms³ | Remaining ms⁴ | Result bytes | Result |
|---|---|---|---|---|---|---|---|---|---|
| 1 | get-plan-context: articles, attributes | 0.001 | 0.014 | 0.0138 | 13.8 | 5.4 | 8.4 | 270,617 | OK |
| 2 | get-plan-context: rooms, groups, obstacles, installationElements | 0.001 | 0.016 | 0.0150 | 15.0 | 2.3 | 12.7 | 5,631 | OK |
| 3 | get-skill: image-planning / SKILL.md | 4.101 | 4.102 | 0.0015 | 1.5 | 0.0 | 1.5 | 5,658 | OK |
| 4 | get-skill: kitchen-planning / SKILL.md | 4.101 | 4.102 | 0.0017 | 1.7 | 0.0 | 1.7 | 35,685 | OK |
| 5 | create-or-replace-groups: 1 group, 9 roots; placement left / center | 27.836 | 29.657 | 1.8207 | 1820.7 | 1713.8 | 106.9 | 27,029 | OK |
| 6 | find-attributes: Create backsplash | 33.544 | 33.553 | 0.0098 | 9.8 | 7.5 | 2.3 | 759 | OK |
| 7 | change-group-attribute: mod_CreateBacksplash=true | 36.124 | 36.265 | 0.1412 | 141.2 | 135.2 | 6.0 | 470 | Library error |
| 8 | get-plan-context: obstacles | 38.512 | 38.517 | 0.0051 | 5.1 | 4.3 | 0.8 | 1,853 | OK |
| 9 | change-module-attribute: mod_SinkMoveWidth=0 | 42.103 | 42.778 | 0.6756 | 675.6 | 505.8 | 169.8 | 171 | OK |
| 10 | get-plan-context: obstacles | 44.809 | 44.813 | 0.0038 | 3.8 | 3.3 | 0.5 | 1,853 | OK |
| 11 | get-plan-images | 48.126 | 48.565 | 0.4383 | 438.3 | 412.0 | 26.3 | 184,092 | OK |

³ Union of the underlying planner-call intervals inside this tool. ⁴ Tool elapsed minus nested planner intervals: forwarding, scheduling, validation, projection, serialization and any uninstrumented work. This is not a pure CPU measurement. Calls #1 and #2 are the assistant's automatic reads of the library reference and the plan state, before the first model request, rather than model-requested tools.

| Call | Containing tool | Planner method / arguments | Start s | End s | Delta s (planner) | Elapsed ms |
|---|---|---|---|---|---|---|
| 1 | #1 | getExternalObjectLibraryContext [["articles","masterData"]] | 0.001 | 0.007 | 0.0054 | 5.4 |
| 2 | #2 | getExternalObjectPlanContext [["rooms","groups","obstacles","installationElements"]] | 0.009 | 0.011 | 0.0023 | 2.3 |
| 3 | #5 | getExternalObjectPlanContext [["groups"]] | 27.837 | 27.837 | 0.0001 | 0.1 |
| 4 | #5 | externalObjectGroupOperation ["create-or-replace-groups"] | 27.837 | 29.544 | 1.7067 | 1706.7 |
| 5 | #5 | getExternalObjectPlanContext [["groups"]] | 29.544 | 29.551 | 0.0070 | 7.0 |
| 6 | #6 | getExternalObjectPlanContext [["groups"]] | 33.544 | 33.551 | 0.0075 | 7.5 |
| 7 | #6 | getExternalObjectLibraryContext [["masterData"]] | 33.544 | 33.550 | 0.0065 | 6.5 |
| 8 | #7 | getExternalObjectPlanContext [["groups"]] | 36.125 | 36.139 | 0.0142 | 14.2 |
| 9 | #7 | externalObjectGroupOperation ["change-group-attribute"] | 36.140 | 36.261 | 0.1210 | 121.0 |
| 10 | #8 | getExternalObjectPlanContext [["obstacles","rooms"]] | 38.512 | 38.517 | 0.0043 | 4.3 |
| 11 | #9 | getExternalObjectPlanContext [["groups"]] | 42.104 | 42.118 | 0.0140 | 14.0 |
| 12 | #9 | externalObjectGroupOperation ["change-module-attribute"] | 42.119 | 42.605 | 0.4863 | 486.3 |
| 13 | #9 | getExternalObjectPlanContext [["groups"]] | 42.605 | 42.611 | 0.0055 | 5.5 |
| 14 | #10 | getExternalObjectPlanContext [["obstacles","rooms"]] | 44.809 | 44.812 | 0.0033 | 3.3 |
| 15 | #11 | getExternalObjectSnapshot [["perspectiveObjectImage","topImage","keepOpenGeometry","imageType","imageQuality"]] | 48.128 | 48.540 | 0.4120 | 412.0 |

The planner's own price refresh after the plan change, without a tool: 28.328–29.671 s, 29.678–30.209 s, 30.209–30.794 s, 36.274–36.708 s, 42.788–43.275 s, 43.275–43.675 s.

Local capture: `.temp/result/baseline-iklw-az-2026-10-27/iklw-rep-2/` (run.json, timeline.json, planner-calls.json and plan-context.json).

## Context, cache and transport

| Measurement | Run 1 | Run 2 |
|---|---|---|
| Model calls | 8 | 9 |
| Tools including the reads before the first request | 11 | 11 |
| Input tokens | 753,977 | 842,896 |
| Output tokens (include reasoning) | 1,781 | 1,333 |
| Reasoning tokens | 623 | 332 |
| Cache-read tokens / share of input | 740,226 / 98.18% | 830,153 / 98.49% |
| Cache-write tokens | 13,727 | 12,716 |
| First call: cache-read tokens | 79,077 | 79,077 |
| Request JSON bytes, all calls | 1,189,089 | 1,219,583 |
| Reference bytes (exclude tools/current input) | 295,682 | 295,682 |
| Shared-reference SHA-256 | `2974a3a3ddd8857b8d789c90e6cf9c3588a47977df0abb285521d1692dd6fbf8` | `2974a3a3ddd8857b8d789c90e6cf9c3588a47977df0abb285521d1692dd6fbf8` |
| Plan state bytes (supplied with the turn) | 4,822 | 4,822 |
| Information tools, elapsed union ms | 34.3 | 35.7 |
| Information tools, summed call ms (overlap included) | 66.5 | 50.7 |
| Saved plan snapshot | `ps_t1p2n7x4pnqnmrlzrkq9jaqfzaoxq5y` | `ps_t1p153f0xga6rgqg8r04f1p19i6tu2w5` |

All token/cache/reasoning fields have complete coverage for completed calls. Cache reads are already part of input tokens and reasoning is already part of output tokens. Request bytes count the whole uncompressed JSON sent on every fetch, including image data. With Responses chaining a later request carries only its new input, so a whole turn sends **1,189,089** and **1,219,583 bytes**, of which the first request is **610,274 bytes**. Both runs read the same shared reference, **295,682 bytes** with the same SHA-256. The first call of each run reads **79,077 of its 79,080 input tokens** from the cache, written by earlier requests with the same prefix on this deployment; a fresh browser does not establish a cold provider cache.

The library reference returns **270,617 bytes**, the plan state **5,631 bytes**; both come with the turn before the first request. The get-plan-images results are **195,012** and **184,092 bytes**, two JPEG renders, taking **440.1 ms** and **438.3 ms** locally; they are part of the next request.

## Findings and the evidence behind them

### 1. The create call is where the time before the first kitchen goes

Call 1 ends after **3.877 / 4.076 s** with the two skill requests. Call 2, the create, then takes **27.884 / 23.730 s**: **17.620 / 13.735 s** until its first output and **10.264 / 9.995 s** streaming the payload, with **378 / 269 reasoning tokens** and **967 / 852 output tokens**. The create tool adds **1.309 / 1.821 s**, the local gaps a few milliseconds. Of the 33.099 / 29.657 s to the first kitchen, the create call is 84% / 80%.

The request/model boundary localizes this to the model round trip, not planner execution. The cause inside that boundary is **unknown**: provider queueing, input processing, reasoning, generation and network are not separately exposed. Benchmark 01 — the same test on direct OpenAI with the original build — created at call 3, after a separate round for the planning reference; its turns are compared with this baseline for the shape, not for the seconds, since provider and deployment differ.

### 2. Information gathering is cheap locally; the reads come with the turn

The library reference and the plan state are read in parallel before the first request: **14.8 / 16.1 ms** in run 1 and **13.8 / 15.0 ms** in run 2 as tools, **5.5 / 2.4 ms** and **5.4 / 2.3 ms** in the planner. The skills take **0.7–1.7 ms**. All information tools of a turn take **34.3 / 35.7 ms** in union. No model call reads the live plan sections before the create; the reads after it ask for the obstacles only (1,851–1,853 bytes).

### 3. Post-create work makes most of the difference between the runs

Run 1 spends **63.842 s** after the kitchen: call 3 looks up the backsplash and reads the obstacles (8.085 s), call 4 enables it and fails (14.605 s), call 5 sets handle design 110 together with a dishwasher supplier and model (8.538 s), call 6 sets handle design 100 in black (4.989 s), call 7 renders (5.571 s) and call 8 answers (20.139 s). Run 2 spends **24.794 s**: the backsplash lookup (3.885 s) and the failing change (2.569 s), an obstacles read (2.246 s), the sink's move width (3.584 s), another obstacles read (2.030 s), the render (3.312 s) and the answer (5.884 s). The create's corrections had already set the handles of the run to the curved bow handle; run 1 changes them twice more.

### 4. Some calls wait long for their first output without reasoning

Run 1's call 4 waits **13.713 s** for its first output with 57 output tokens and no reasoning, its call 8 **16.553 s** with 134 output tokens and no reasoning; run 2's calls of the same kind wait **1.806 s** and **2.393 s**. The inputs are of the same size (95–101k tokens, almost all read from the cache). The cause is not exposed; it is the provider's side of the round trip.

### 5. The backsplash remains absent

Both runs enable `mod_CreateBacksplash`, and both get the same library error: Error 14034, no entry in `tab_GrainDirectionSettings` for the backsplash. The change takes **145.6 / 141.2 ms**; the model rounds around it cost seconds. The open issue is [library backlog §10](../backlog/library-issues.md#10-backsplashes-the-library-cannot-calculate). Both answers disclose the missing backsplash.

### 6. Plan verification

Both snapshots contain one **3,010 mm** kitchen centred on the left wall at [-685, -240, 0] with **rotationZ = 90°**, about 1 m from each end of the wall. Run 1: fridge-freezer, drawer-and-door base, oven with hob, a dishwasher, the sink base, three wall cabinets and the chimney hood (HK260, USTB60, UHS60, GSP, SUT60, OTB60 ×3, DU). Run 2: the same row with a door base instead of the dishwasher (UTB60), the nine articles of benchmarks 04–08. The object perspectives and top views were inspected: olive-green fronts, oak-effect (run 1) and walnut-effect (run 2) carcases and wall cabinets, black bow handles. Approximate library finishes, a two-section fridge front and the absent dark backsplash limit fidelity to the photo; both answers name them. This is a latency benchmark of those resulting plans, not an assertion of pixel-identical image reproduction.

## Proposed experiments and rejected conclusions

| Candidate | What this run supports | Expected saving / limit |
|---|---|---|
| Less to decide in the create call (proposal C: a worked example of a create payload; the reasoning effort, RML-18043) | The create call takes 27.884 / 23.730 s, 17.620 / 13.735 s of it before its first output, with 378 / 269 reasoning tokens | The largest block before the first kitchen. Its saving is unknown until a run of the same layout is compared with this baseline. |
| Set the attributes of an image kitchen in the create | Run 1 changes the handles twice after the create (8.538 + 4.989 s), run 2 the sink's move width (3.584 s) | Fewer rounds after the first kitchen. The changes depend on what the model reads in the image, so no saving is established. |
| Resolve the backsplash calculation/advertised capability | Both runs look up the backsplash and fail to create it: 22.690 s in run 1 (calls 3–4), 6.454 s in run 2 | A working switch improves fidelity; a reliable capability description in the library data could avoid the futile round. Library issue 10. |
| A watchdog for calls without a first output | Run 1's calls 4 and 8 wait 13.7 and 16.6 s for their first output without reasoning | A resend doubles the cost of a legitimate long reasoning. Measure the tail over more runs first. |
| Tool memoization / attribute indexing / precalculated docking vectors | The information tools take 34.3 / 35.7 ms in union; the create tool 1.309 / 1.821 s | Local work is not the bottleneck: removing every information tool saves milliseconds. |

## Measurement gaps and open work

- **First painted frame:** no GPU presentation/paint marker was captured. Create-tool completion is an upper bound for a loaded kitchen; first visible geometry could appear earlier within the 1.309–1.821 s create.
- **Provider internals:** model time combines network, queueing, input processing, reasoning, generation and SDK stream handling. Time to first output does not isolate prefill; response-header time does not isolate network RTT.
- **Tool internals:** the planner table separates planner access from the surrounding tool, but does not profile every individual filtering, projection, docking, library-calculation or kernel-load function. Remaining tool time must not be renamed CPU assembly time.
- **Final text start:** first visible text refers to the first planning preamble; the end of the turn marks completion of the final answer. Final-answer text-delta start was not separately instrumented.
- **Startup attribution:** page/module/library/plan/assistant initialization, the runner's readiness read and the assistant's library read before the first prompt overlap inside the ready phase. They were not profiled individually.
- **Instrumentation overhead:** extra console events, UTF-8 size measurement and log delivery add unquantified overhead; both runs have the same hooks. The planner is a Vite development server; do not use these page-startup numbers as production cold-start numbers.
- **Sampling:** two runs establish a repeated measurement and show large variation after the kitchen. They do not establish a p95, a stable service-level expectation or the cause of provider variability. Another pair costs about 3 minutes and 1.6M input tokens, most of them read from the cache.

## The benchmark to repeat

Use the commits, image digest and settings in manifest.json (local: `.temp/result/baseline-iklw-az-2026-10-27/manifest.json`). Keep the planner on port 5173 and check that its checkout is the one to measure; the example page pins the embedding-lib. Keep `"provider": "gpt-6-astra", "apiKey": "$AZURE_GPT_KEY"` with the key in AZURE_GPT_KEY. Do not silently substitute another provider.

```sh
cd .temp/result/baseline-iklw-az-2026-10-27
node make-timing-runner.mjs
REPS=1,2 node run-reps.mjs iklw
node analyze.mjs iklw-rep-1 iklw-rep-2
node write-baseline.mjs
```

Before a new capture, copy these scripts into a fresh dated session directory and point the paths there; never overwrite this evidence. A measurement against this baseline uses the same test, the same settings and a report of this layout.

Retain run.json, timeline.json, planner-calls.json, plan-context.json, source SHAs, exclusions and snapshot IDs. Compute interval unions rather than summing concurrent tools; check the counts against the model usage and recorded calls.

Verification performed: every model request paired with a completed model call and its diagnostics bytes; all tool starts paired with ends; the nested planner calls paired with their log lines, the two parallel reads before the first request by their method; the interval accounting reconciles with the full-turn duration; one failed backsplash call per run; both snapshot IDs present; the roomle-ui checkout stayed on a8fe64618 through both runs.
