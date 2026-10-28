# image-kitchen-left-wall: detailed Azure gpt-6-astra timing — benchmark 09, the two-level attribute section

| Field | Value |
|---|---|
| Type / domain | Benchmark / HI Planning Assistant |
| Trigger | Benchmark 09: the two-level attribute section (D122) — the values of the attributes a planning sets at the create in the prefix, every other attribute with the number of its values and its values through find-attributes —, with the corrected descriptions of the sink units and of mod_SinkId in the library, measured against [the baseline](baseline-iklw-az-2026-10-27.md); RML-18303 |
| Date / author | 2026-10-28 / Claude Code |
| Status | Measured: two completed turns, two saved plans |
| Ticket | [RML-18303](https://roomle.atlassian.net/browse/RML-18303) |
| Data | Measurements are retained in the tables below; raw captures remain in the ignored .temp/result/benchmark-09-az-attrs-2026-10-28 folder |
| Repeat | The fixture and settings of the baseline, the local planner with the two-level attribute section and the published embedding-lib; procedure below |

Affected repositories:

- **roomle-hi-example:** this benchmark report and the documentation indexes. Raw evidence remains local in .temp.
- **roomle-ui:** the planner measured with the two-level attribute section — 5fd409e84 on feat/hi-mcp-performance, merged into feat/hi-mcp-merge as 4415cdffd; the embedding-lib unchanged.

## Executive summary

The first completed kitchen create took **24.546 s** and **24.756 s** from assistant turn start; mean **24.651 s** (the baseline: 31.378 s). The complete assistant turn took **47.771 s** and **48.800 s**; mean **48.286 s** (75.696 s). Model calls occupied **93.19%** and **94.01%** of those turns.

Both runs create the kitchen in **model call 2**, and no run looks anything up before it: the create sets the look from the value lists the attributes section keeps — Classic fronts in Olive green 160, the oak decor 224 for the carcase, the worktop and the toekick, the rail handle 20, the plinth height 150 — and leaves the attributes shown with `valueCount` to the article. Both put a base unit between the hob unit and the sink unit — a door base in run 1, the dishwasher in run 2 —, the side the drainer of the sink unit reaches over, as its corrected description says. Every first request carries **70,547 input tokens**, **8,533 fewer** than the baseline's 79,080. The create call takes **18.167 s** and **19.509 s**, of which **10.386 s** and **11.815 s** pass before its first output; kitchen creation itself took **1.950 s** and **1.678 s**.

After the kitchen, both runs look up the handle colour with one `find-attributes` call by ids and set it black, try the backsplash, which fails on the library's error as in the baseline, render once and answer: **23.225 s** and **24.043 s**. These are request/response wall times, including network and provider work, not isolated server compute times.

## What was asked and run

Test: **image-kitchen-left-wall**, from [docs/test-prompts.json](../../docs/test-prompts.json).

> create a kitchen like the one in the image on the left-hand wall of the room

Image: [kitchen-1.png](../../docs/images/kitchen-1.png), SHA-256 07a3fe7a8cb1f57f392f356cc52b8a2af78afe9e2ec4fe6e88a9a13e8b3b3d95. Starting plan: **ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv**, default-room. Exactly this prompt was sent; the optional suite prompt suffix was omitted. Two fresh browsers and conversations used the same prompt/image and source revisions. No random cases, provider warm-up requests or request pacing were added.

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

The skill responses of call 1 contain image-planning SKILL.md and kitchen-planning SKILL.md, the kitchen skill with its planning reference in one result of 35,685 bytes; no separate reference is fetched, and no model call reads the live plan sections before the create, since the plan state comes with the turn. There is therefore one starting point:

| Milestone / interval | Run 1 s | Run 2 s |
|---|---|---|
| Image/kitchen skill responses complete (timestamp) | 4.424 | 3.566 |
| First kitchen create starts (timestamp) | 22.596 | 23.078 |
| First kitchen create completes (timestamp) | 24.546 | 24.756 |
| Delta: skill responses → first kitchen complete | 20.122 | 21.191 |
| ↳ Agent/model call 2 within that interval | 18.167 | 19.509 |
| ↳ Kitchen creation tool within that interval | 1.950 | 1.678 |
| ↳ Local gaps within that interval | 0.005 | 0.004 |

For example, run 1 takes **20.122 s** from the skill files (4.424 s) to the completed kitchen (24.546 s). The model spends **18.167 s** deciding and emitting the kitchen payload — **10.386 s** of it before its first output, with 219 reasoning tokens —; the create tool then takes **1.950 s**, with about **0.005 s** of local gaps. Run 2 takes **21.190 s** over the same interval. The baseline took 29.195 / 25.555 s.

## Results: milestones and total time

| Measurement (seconds) | Run 1 | Run 2 | Mean |
|---|---|---|---|
| Page/library/assistant ready (recorded run start) | 4.409 | 4.715 | 4.562 |
| Library reference and plan state acquisition inside turn (warm) | 0.019 | 0.020 | 0.020 |
| First model generated output (turn start) | 4.300 | 3.392 | 3.846 |
| First visible assistant text (turn start) | 14.813 | 15.383 | 15.098 |
| First successful kitchen create completed (turn start) | 24.546 | 24.756 | 24.651 |
| First successful kitchen create completed (recorded run start) | 29.133 | 29.671 | 29.402 |
| First successful kitchen create completed (subprocess start) | 29.405 | 29.958 | 29.681 |
| Create tool execution alone | 1.950 | 1.678 | 1.814 |
| Assistant turn start → answer complete | 47.771 | 48.800 | 48.285 |
| Time after the first kitchen until answer complete | 23.225 | 24.043 | 23.634 |
| Runner chat phase (includes image preparation/collection) | 48.480 | 49.533 | 49.007 |
| Post-chat context, images and saved snapshot | 4.815 | 4.403 | 4.609 |
| Recorded run: ready + chat + snapshot | 57.704 | 58.651 | 58.178 |
| Full subprocess: browser startup through launcher shutdown | 58.231 | 59.185 | 58.708 |

"First kitchen" here means the first successful create-or-replace-groups result, including its placement and returned groups. Each run made one successful create and retained that kitchen. Actual scene insertion happens during the tool and can precede its result; see the limitations below.

## Results: where the assistant turn goes

| Wall time component | Run 1 s | Run 1 share | Run 2 s | Run 2 share |
|---|---|---|---|---|
| Model calls (union) | 44.516 | 93.19% | 45.878 | 94.01% |
| Tools including the reads before the first request (union) | 3.228 | 6.76% | 2.899 | 5.94% |
| Model/tool overlap (subtract once) | 0.001 | 0.00% | 0.000 | 0.00% |
| Other client work / gaps | 0.028 | 0.06% | 0.022 | 0.04% |
| Assistant turn | 47.771 | 100.00% | 48.800 | 100.00% |

The model sum is taken from the SDK's measured call durations; the tool union comes from browser start/end intervals. The remaining client time closes the measured turn exactly before display rounding. Summing individual tool durations would overcount the concurrent tools.

## Results: model, tools and planner calls in order

### Run 1

Recorded start: **2026-10-28T06:11:04.727Z** (28/10/2026 07:11:04 Europe/Vienna). Model/provider: Azure Responses, gpt-6-astra.

**Agent steps — duration per decision and tool execution**

| Step | Result / following tools | Start s | End s | Agent/model delta s | Tools delta s | Total step delta s |
|---|---|---|---|---|---|---|
| 1 | get-skill (image-planning); get-skill (kitchen-planning) | 0.025 | 4.424 | 4.394 | 0.003 | 4.399 |
| 2 | create-or-replace-groups | 4.427 | 24.546 | 18.167 | 1.950 | 20.119 |
| 3 | find-attributes | 24.547 | 27.199 | 2.639 | 0.013 | 2.652 |
| 4 | change-group-attribute | 27.200 | 30.601 | 2.734 | 0.666 | 3.401 |
| 5 | change-group-attribute | 30.602 | 35.127 | 4.395 | 0.129 | 4.525 |
| 6 | get-plan-images | 35.126 | 42.735 | 7.155 | 0.451 | 7.609 |
| 7 | Final answer | 42.736 | 47.771 | 5.031 | 0.000 | 5.035 |

| Call | SDK start s | End s | Delta s (model) | First output s¹ | Remaining s² | Input tokens | Output / reasoning | Request bytes | Tools after model |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.025 | 4.419 | 4.394 | 4.275 | 0.119 | 70,547 | 55 / 0 | 573,377 | #3 get-skill; #4 get-skill |
| 2 | 4.427 | 22.595 | 18.167 | 10.386 | 7.781 | 78,689 | 741 / 219 | 85,912 | #5 create-or-replace-groups |
| 3 | 24.547 | 27.186 | 2.639 | 2.092 | 0.547 | 86,395 | 33 / 0 | 70,519 | #6 find-attributes |
| 4 | 27.200 | 29.934 | 2.734 | 1.763 | 0.971 | 87,917 | 72 / 0 | 50,841 | #7 change-group-attribute |
| 5 | 30.602 | 34.997 | 4.395 | 3.530 | 0.865 | 88,334 | 58 / 0 | 45,294 | #8 change-group-attribute |
| 6 | 35.126 | 42.281 | 7.155 | 4.987 | 2.167 | 88,534 | 122 / 21 | 44,946 | #9 get-plan-images |
| 7 | 42.736 | 47.767 | 5.031 | 2.493 | 2.538 | 91,080 | 122 / 0 | 237,215 | Final answer |

¹ From the SDK model-call start to its first generated output; this can be reasoning, a tool call or text. ² The remaining model-stream time is response duration minus first-output duration. It is not a pure text-generation or reasoning measurement. Request fetch starts and response-header times remain in the local timeline.json capture.

| Call | Tool / requested information | Start s | End s | Delta s (tool) | Elapsed ms | Nested planner ms³ | Remaining ms⁴ | Result bytes | Result |
|---|---|---|---|---|---|---|---|---|---|
| 1 | get-plan-context: articles, attributes | 0.001 | 0.015 | 0.0146 | 14.6 | 5.6 | 9.0 | 232,777 | OK |
| 2 | get-plan-context: rooms, groups, obstacles, installationElements | 0.001 | 0.016 | 0.0156 | 15.6 | 2.4 | 13.2 | 5,631 | OK |
| 3 | get-skill: image-planning / SKILL.md | 4.421 | 4.423 | 0.0023 | 2.3 | 0.0 | 2.3 | 5,658 | OK |
| 4 | get-skill: kitchen-planning / SKILL.md | 4.421 | 4.424 | 0.0026 | 2.6 | 0.0 | 2.6 | 35,685 | OK |
| 5 | create-or-replace-groups: 1 group, 9 roots; placement left / center | 22.596 | 24.546 | 1.9500 | 1950.0 | 1728.8 | 221.2 | 26,028 | OK |
| 6 | find-attributes: ids mod_HandleColor, mod_HandlePosType, mod_CreateBacksplash | 27.186 | 27.199 | 0.0128 | 12.8 | 11.8 | 1.0 | 6,350 | OK |
| 7 | change-group-attribute: mod_HandleColor=Black, mod_HandlePosType=01 | 29.935 | 30.601 | 0.6663 | 666.3 | 486.2 | 180.1 | 803 | OK |
| 8 | change-group-attribute: mod_CreateBacksplash=true | 34.998 | 35.127 | 0.1292 | 129.2 | 124.7 | 4.5 | 470 | Library error |
| 9 | get-plan-images | 42.284 | 42.735 | 0.4511 | 451.1 | 425.0 | 26.1 | 192,704 | OK |

³ Union of the underlying planner-call intervals inside this tool. ⁴ Tool elapsed minus nested planner intervals: forwarding, scheduling, validation, projection, serialization and any uninstrumented work. This is not a pure CPU measurement. Calls #1 and #2 are the assistant's automatic reads of the library reference and the plan state, before the first model request, rather than model-requested tools.

| Call | Containing tool | Planner method / arguments | Start s | End s | Delta s (planner) | Elapsed ms |
|---|---|---|---|---|---|---|
| 1 | #1 | getExternalObjectLibraryContext [["articles","masterData"]] | 0.003 | 0.009 | 0.0056 | 5.6 |
| 2 | #2 | getExternalObjectPlanContext [["rooms","groups","obstacles","installationElements"]] | 0.011 | 0.014 | 0.0024 | 2.4 |
| 3 | #5 | getExternalObjectPlanContext [["groups"]] | 22.599 | 22.599 | 0.0004 | 0.4 |
| 4 | #5 | externalObjectGroupOperation ["create-or-replace-groups"] | 22.600 | 24.322 | 1.7226 | 1722.6 |
| 5 | #5 | getExternalObjectPlanContext [["groups"]] | 24.322 | 24.328 | 0.0058 | 5.8 |
| 6 | #6 | getExternalObjectPlanContext [["groups"]] | 27.187 | 27.199 | 0.0118 | 11.8 |
| 7 | #6 | getExternalObjectLibraryContext [["masterData"]] | 27.187 | 27.197 | 0.0104 | 10.4 |
| 8 | #7 | getExternalObjectPlanContext [["groups"]] | 29.935 | 29.941 | 0.0059 | 5.9 |
| 9 | #7 | externalObjectGroupOperation ["change-group-attribute"] | 29.941 | 30.416 | 0.4748 | 474.8 |
| 10 | #7 | getExternalObjectPlanContext [["groups"]] | 30.416 | 30.422 | 0.0055 | 5.5 |
| 11 | #8 | getExternalObjectPlanContext [["groups"]] | 34.999 | 35.009 | 0.0105 | 10.5 |
| 12 | #8 | externalObjectGroupOperation ["change-group-attribute"] | 35.009 | 35.123 | 0.1142 | 114.2 |
| 13 | #9 | getExternalObjectSnapshot [["perspectiveObjectImage","topImage","keepOpenGeometry","imageType","imageQuality"]] | 42.285 | 42.710 | 0.4250 | 425.0 |

The planner's own price refresh after the plan change, without a tool: 23.053–24.578 s, 24.582–25.388 s, 25.388–25.940 s, 30.628–31.091 s, 31.092–31.510 s, 35.138–35.564 s.

Local capture: `.temp/result/benchmark-09-az-attrs-2026-10-28/iklw-rep-1/` (run.json, timeline.json, planner-calls.json and plan-context.json).

### Run 2

Recorded start: **2026-10-28T06:12:02.993Z** (28/10/2026 07:12:02 Europe/Vienna). Model/provider: Azure Responses, gpt-6-astra.

**Agent steps — duration per decision and tool execution**

| Step | Result / following tools | Start s | End s | Agent/model delta s | Tools delta s | Total step delta s |
|---|---|---|---|---|---|---|
| 1 | get-skill (image-planning); get-skill (kitchen-planning) | 0.026 | 3.566 | 3.537 | 0.002 | 3.540 |
| 2 | create-or-replace-groups | 3.568 | 24.756 | 19.509 | 1.678 | 21.188 |
| 3 | find-attributes | 24.757 | 31.953 | 7.183 | 0.012 | 7.197 |
| 4 | change-group-attribute | 31.954 | 35.212 | 2.617 | 0.641 | 3.258 |
| 5 | change-group-attribute | 35.213 | 38.463 | 3.134 | 0.116 | 3.250 |
| 6 | get-plan-images | 38.464 | 43.275 | 4.379 | 0.432 | 4.811 |
| 7 | Final answer | 43.276 | 48.800 | 5.520 | 0.000 | 5.523 |

| Call | SDK start s | End s | Delta s (model) | First output s¹ | Remaining s² | Input tokens | Output / reasoning | Request bytes | Tools after model |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.026 | 3.563 | 3.537 | 3.366 | 0.171 | 70,547 | 55 / 0 | 573,377 | #3 get-skill; #4 get-skill |
| 2 | 3.568 | 23.077 | 19.509 | 11.815 | 7.694 | 78,689 | 812 / 280 | 85,912 | #5 create-or-replace-groups |
| 3 | 24.757 | 31.940 | 7.183 | 6.355 | 0.829 | 86,421 | 35 / 0 | 70,474 | #6 find-attributes |
| 4 | 31.954 | 34.571 | 2.617 | 1.946 | 0.670 | 87,037 | 53 / 0 | 46,866 | #7 change-group-attribute |
| 5 | 35.213 | 38.347 | 3.134 | 2.484 | 0.650 | 87,456 | 77 / 20 | 45,376 | #8 change-group-attribute |
| 6 | 38.464 | 42.843 | 4.379 | 2.669 | 1.710 | 87,669 | 95 / 9 | 44,946 | #9 get-plan-images |
| 7 | 43.276 | 48.797 | 5.520 | 2.685 | 2.836 | 90,188 | 138 / 0 | 237,647 | Final answer |

¹ From the SDK model-call start to its first generated output; this can be reasoning, a tool call or text. ² The remaining model-stream time is response duration minus first-output duration. It is not a pure text-generation or reasoning measurement. Request fetch starts and response-header times remain in the local timeline.json capture.

| Call | Tool / requested information | Start s | End s | Delta s (tool) | Elapsed ms | Nested planner ms³ | Remaining ms⁴ | Result bytes | Result |
|---|---|---|---|---|---|---|---|---|---|
| 1 | get-plan-context: articles, attributes | 0.001 | 0.017 | 0.0163 | 16.3 | 6.2 | 10.1 | 232,777 | OK |
| 2 | get-plan-context: rooms, groups, obstacles, installationElements | 0.001 | 0.018 | 0.0175 | 17.5 | 2.5 | 15.0 | 5,631 | OK |
| 3 | get-skill: image-planning / SKILL.md | 3.564 | 3.565 | 0.0011 | 1.1 | 0.0 | 1.1 | 5,658 | OK |
| 4 | get-skill: kitchen-planning / SKILL.md | 3.564 | 3.566 | 0.0013 | 1.3 | 0.0 | 1.3 | 35,685 | OK |
| 5 | create-or-replace-groups: 1 group, 9 roots; placement left / center | 23.078 | 24.756 | 1.6784 | 1678.4 | 1493.4 | 185.0 | 25,983 | OK |
| 6 | find-attributes: ids mod_HandleColor, mod_CreateBacksplash | 31.941 | 31.953 | 0.0124 | 12.4 | 10.1 | 2.3 | 2,375 | OK |
| 7 | change-group-attribute: mod_HandleColor=Black | 34.571 | 35.212 | 0.6411 | 641.1 | 477.1 | 164.0 | 885 | OK |
| 8 | change-group-attribute: mod_CreateBacksplash=true | 38.347 | 38.463 | 0.1158 | 115.8 | 111.7 | 4.1 | 470 | Library error |
| 9 | get-plan-images | 42.843 | 43.275 | 0.4325 | 432.5 | 411.9 | 20.6 | 193,136 | OK |

³ Union of the underlying planner-call intervals inside this tool. ⁴ Tool elapsed minus nested planner intervals: forwarding, scheduling, validation, projection, serialization and any uninstrumented work. This is not a pure CPU measurement. Calls #1 and #2 are the assistant's automatic reads of the library reference and the plan state, before the first model request, rather than model-requested tools.

| Call | Containing tool | Planner method / arguments | Start s | End s | Delta s (planner) | Elapsed ms |
|---|---|---|---|---|---|---|
| 1 | #1 | getExternalObjectLibraryContext [["articles","masterData"]] | 0.002 | 0.008 | 0.0062 | 6.2 |
| 2 | #2 | getExternalObjectPlanContext [["rooms","groups","obstacles","installationElements"]] | 0.011 | 0.014 | 0.0025 | 2.5 |
| 3 | #5 | getExternalObjectPlanContext [["groups"]] | 23.080 | 23.080 | 0.0001 | 0.1 |
| 4 | #5 | externalObjectGroupOperation ["create-or-replace-groups"] | 23.081 | 24.568 | 1.4877 | 1487.7 |
| 5 | #5 | getExternalObjectPlanContext [["groups"]] | 24.568 | 24.574 | 0.0056 | 5.6 |
| 6 | #6 | getExternalObjectPlanContext [["groups"]] | 31.943 | 31.953 | 0.0101 | 10.1 |
| 7 | #6 | getExternalObjectLibraryContext [["masterData"]] | 31.943 | 31.952 | 0.0091 | 9.1 |
| 8 | #7 | getExternalObjectPlanContext [["groups"]] | 34.572 | 34.577 | 0.0054 | 5.4 |
| 9 | #7 | externalObjectGroupOperation ["change-group-attribute"] | 34.577 | 35.043 | 0.4655 | 465.5 |
| 10 | #7 | getExternalObjectPlanContext [["groups"]] | 35.043 | 35.049 | 0.0062 | 6.2 |
| 11 | #8 | getExternalObjectPlanContext [["groups"]] | 38.348 | 38.360 | 0.0115 | 11.5 |
| 12 | #8 | externalObjectGroupOperation ["change-group-attribute"] | 38.360 | 38.460 | 0.1002 | 100.2 |
| 13 | #9 | getExternalObjectSnapshot [["perspectiveObjectImage","topImage","keepOpenGeometry","imageType","imageQuality"]] | 42.843 | 43.255 | 0.4119 | 411.9 |

The planner's own price refresh after the plan change, without a tool: 23.554–25.097 s, 25.102–25.978 s, 35.268–35.852 s, 35.852–36.263 s, 38.472–38.857 s.

Local capture: `.temp/result/benchmark-09-az-attrs-2026-10-28/iklw-rep-2/` (run.json, timeline.json, planner-calls.json and plan-context.json).

## Context, cache and transport

| Measurement | Run 1 | Run 2 |
|---|---|---|
| Model calls | 7 | 7 |
| Tools including the reads before the first request | 9 | 9 |
| Input tokens | 591,496 | 588,007 |
| Output tokens (include reasoning) | 1,203 | 1,265 |
| Reasoning tokens | 240 | 309 |
| Cache-read tokens / share of input | 500,398 / 84.60% | 576,487 / 98.04% |
| Cache-write tokens | 91,077 | 11,499 |
| First call: cache-read tokens | 0 | 70,544 |
| Request JSON bytes, all calls | 1,108,104 | 1,104,598 |
| Reference bytes (exclude tools/current input) | 258,251 | 258,251 |
| Shared-reference SHA-256 | `b6d6b7dc146b5cd3af90c9d01e3cdce3a6b52ea12099c6234e5d4a48c976f4e8` | `b6d6b7dc146b5cd3af90c9d01e3cdce3a6b52ea12099c6234e5d4a48c976f4e8` |
| Plan state bytes (supplied with the turn) | 4,822 | 4,822 |
| Information tools, elapsed union ms | 31.4 | 31.6 |
| Information tools, summed call ms (overlap included) | 47.9 | 48.6 |
| Saved plan snapshot | `ps_t3jqsbjlnx5rt85f0s3832r2r0oca9` | `ps_t3jci9s72du1j770kjux62i0luxwso1` |

All token/cache/reasoning fields have complete coverage for completed calls. Cache reads are already part of input tokens and reasoning is already part of output tokens. Request bytes count the whole uncompressed JSON sent on every fetch, including image data. With Responses chaining a later request carries only its new input, so a whole turn sends **1,108,104** and **1,104,598 bytes**, of which the first request is **573,377 bytes** (the baseline: 610,274). Both runs read the same shared reference, **258,251 bytes** with the same SHA-256 — 37,431 bytes less than the baseline's 295,682: the value lists that left the attributes section, less the longer descriptions of the sink units and of `mod_SinkId`. The first call of run 1 reads **no token** from the cache: the first request with this prefix, new with the corrected descriptions. Run 2's first call reads **70,544 of its 70,547 input tokens** from the cache; over the turn the cache covers 84.60% and 98.04% of the input.

The library reference returns **232,777 bytes**, the plan state **5,631 bytes**; both come with the turn before the first request. The `find-attributes` results are **6,350** and **2,375 bytes** — the values of three and of two attributes. The get-plan-images results are **192,704** and **193,136 bytes**, two JPEG renders, part of the next request.

## Findings and the evidence behind them

### 1. The first kitchen stays at call 2, with nothing looked up before it

Call 1 fetches the two skills; call 2 is the create in both runs, as in the baseline. Neither create sets an attribute the section shows with `valueCount`: the authoring rule says that the first kitchen does not wait for a lookup. The baseline's creates had set the handle colour and position, the hob and the sink model from the lists in the prefix; here the hob and the sink are the article's — the hob ET601FNP1E the baseline chose, the sink Metra_R.

The create call takes **18.167 / 19.509 s** (the baseline: 27.884 / 23.730 s), **10.386 / 11.815 s** until its first output (17.620 / 13.735 s), with **219 / 280 reasoning tokens** (378 / 269) and **741 / 812 output tokens** (967 / 852). Of the 24.546 / 24.756 s to the first kitchen, the create call is 74% / 79%. Both runs fall below the baseline's spread; two runs per build do not separate the change from the provider's spread.

### 2. The sink stands clear of the hob

The sink unit `SUT60` comes with the Metra sink, whose drainer reaches 410 mm past its left side; its description says so and asks for a base unit on the drainer side, not a hob unit. Both runs build the row of the photo with a unit between the hob unit and the sink unit: `HK260`, `USTB60`, `UHS60`, `UTB60`, `SUT60` in run 1, the dishwasher `GSP` in that place in run 2. The outline of the sink unit overlaps the unit on its left by 410 mm and no hob unit; the renders show the sink at the end of the row. No round after the kitchen concerns the sink. Both answers note the limited preparation space between drainer and hob, as in the photo.

### 3. Every request carries 8,533 input tokens less

The first request carries **70,547 input tokens** in both runs, against **79,080** in the baseline; the create call **78,689** against 87,222. The difference is the value lists that left the attributes section, less the longer descriptions of the sink units and of `mod_SinkId`: the section is 88,005 bytes against 121,067, measured without a model before the runs. Every later call of the turn carries the same difference. The first call of run 1 read nothing from the cache and took 4.394 s, run 2's 3.537 s.

### 4. The handle colour costs a lookup round after the kitchen

Right after the create, both runs call `find-attributes` by ids — run 1 for the handle colour, the handle position and the backsplash switch (2.652 s), run 2 for the handle colour and the backsplash switch (7.197 s) — and set the handles black with `change-group-attribute` (3.401 / 3.258 s); the library then switches the rail handle to the curved bow handle, as in the baseline. The backsplash fails on Error 14034 (4.525 / 3.250 s). The baseline's runs spent their lookup round on the backsplash and changed the handles after it too: the shape after the kitchen is the same, with fewer calls — 7 and 7 against 8 and 9.

### 5. Plan verification

Both snapshots contain one **3,010 mm** kitchen centred on the left wall at [-685, -240, 0] with **rotationZ = 90°**: fridge-freezer, drawer-and-door base, oven with hob, a door base (run 1) or the dishwasher (run 2), the sink base at the end, three wall cabinets and the chimney hood (HK260, USTB60, UHS60, UTB60 or GSP, SUT60, OTB60 ×3, DU). The object perspectives and top views were inspected: olive-green fronts, oak-effect carcases and wall cabinets, black bow handles, the sink at the right end clear of the hob. Both answers disclose the missing dark backsplash. This is a latency benchmark of those resulting plans, not an assertion of pixel-identical image reproduction.

## Proposed experiments and rejected conclusions

| Candidate | What this run supports | Expected saving / limit |
|---|---|---|
| Keep the two-level section with the first-kitchen rule | The first kitchen at call 2 with no lookup before it; 8,533 input tokens less per request; the create call 18.167 / 19.509 s against 27.884 / 23.730 s; the sink clear of the hob | The cost of the first measurement — the article's sink over the hob — is gone with the corrected descriptions; the handle colour costs one lookup round after the kitchen. |
| The catalog's shortening for descriptions with one line per section | The five sink units are served with every section: the shortening of D63 takes a section's text from the line after its name | 19 of 111 descriptions are served in full; a shortening that reads both forms makes the catalog smaller. Not measured here. |
| Tool memoization / attribute indexing / precalculated docking vectors | The information tools take milliseconds; find-attributes by ids 12.8 / 12.4 ms | Local work is not the bottleneck. |

## Measurement gaps and open work

- **First painted frame:** no GPU presentation/paint marker was captured. Create-tool completion is an upper bound for a loaded kitchen; first visible geometry could appear earlier within the 1.678–1.950 s create.
- **Provider internals:** model time combines network, queueing, input processing, reasoning, generation and SDK stream handling. Time to first output does not isolate prefill; response-header time does not isolate network RTT.
- **Tool internals:** the planner table separates planner access from the surrounding tool, but does not profile every individual filtering, projection, docking, library-calculation or kernel-load function. Remaining tool time must not be renamed CPU assembly time.
- **Final text start:** first visible text refers to the first planning preamble; the end of the turn marks completion of the final answer. Final-answer text-delta start was not separately instrumented.
- **Startup attribution:** page/module/library/plan/assistant initialization, the runner's readiness read and the assistant's library read before the first prompt overlap inside the ready phase. They were not profiled individually.
- **Instrumentation overhead:** extra console events, UTF-8 size measurement and log delivery add unquantified overhead; both runs have the same hooks. The planner is a Vite development server; do not use these page-startup numbers as production cold-start numbers.
- **Sampling:** two runs establish a repeated measurement and show large variation after the kitchen. They do not establish a p95, a stable service-level expectation or the cause of provider variability. Another pair costs about 2 minutes and 1.2M input tokens, most of them read from the cache.6M input tokens, most of them read from the cache.
- **The baseline is another day's provider state:** the baseline ran on 2026-10-27 at 17:02–17:06 UTC, these runs on 2026-10-28 at 06:11–06:13 UTC; the first request of run 1 met an empty cache for the new prefix. The seconds of two runs per build do not separate the change from the provider's spread; the input tokens do.
- **A first attempt that did not start:** the first attempt of run 1 timed out after 120 s waiting for the page and the library — the dev server, started for this capture, re-optimized its dependencies on the first page load —, before any model request. It is not counted; a page load without a model warmed the planner before the runs.

## The benchmark to repeat

Use the commits, image digest and settings in manifest.json (local: `.temp/result/benchmark-09-az-attrs-2026-10-28/manifest.json`). Keep the planner on port 5173 and check that its checkout is the one to measure — here `feat/hi-mcp-merge` at 4415cdffd, the baselines' a8fe64618 plus the two-level attribute section; the example page pins the embedding-lib. Keep `"provider": "gpt-6-astra", "apiKey": "$AZURE_GPT_KEY"` with the key in AZURE_GPT_KEY. Do not silently substitute another provider.

```sh
cd .temp/result/benchmark-09-az-attrs-2026-10-28
node make-timing-runner.mjs
REPS=1,2 node run-reps.mjs iklw fkwm
node analyze.mjs iklw-rep-1 iklw-rep-2 fkwm-rep-1 fkwm-rep-2
node write-prose.mjs
node write-09-iklw.mjs
```

The timing runner is byte for byte the baselines' (the prompt runner is unchanged since); `analyze.mjs` is the baselines' with one change, a `find-attributes` call by `ids` labelled by its ids. `probe/` holds the sections read without a model before the runs. Before a new capture, copy these scripts into a fresh dated session directory and point the paths there; never overwrite this evidence.

Retain run.json, timeline.json, planner-calls.json, plan-context.json, source SHAs, exclusions and snapshot IDs. Compute interval unions rather than summing concurrent tools; check the counts against the model usage and recorded calls.

Verification performed: every model request paired with a completed model call and its diagnostics bytes; all tool starts paired with ends; the nested planner calls paired with their log lines, the two parallel reads before the first request by their method; the interval accounting reconciles with the full-turn duration; one failed backsplash call per run; both snapshot IDs present; the roomle-ui checkout stayed on 4415cdffd through all four runs of the session.
