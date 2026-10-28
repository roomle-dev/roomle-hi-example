# image-kitchen-left-wall: detailed Azure gpt-6-astra timing — the baseline

| Field | Value |
|---|---|
| Type / domain | Benchmark / HI Planning Assistant |
| Trigger | The baseline of the time measurement for image-kitchen-left-wall on the Azure deployment, with proposals A, B, D, E, F, the plan state per turn and the two-level attribute section (D122) in place; RML-18303 |
| Date / author | 2026-10-28 / Claude Code |
| Status | Measured: two completed turns, two saved plans |
| Ticket | [RML-18303](https://roomle.atlassian.net/browse/RML-18303) |
| Data | Measurements are retained in the tables below; raw captures remain in the ignored .temp/result/baseline-iklw-az-2026-10-28 folder |
| Repeat | Same fixture, the Azure deployment, the local planner and the published embedding-lib; procedure below |

Affected repositories:

- **roomle-hi-example:** this benchmark report and the documentation indexes. Raw evidence remains local in .temp.
- **roomle-ui:** the planner and the embedding-lib measured, unchanged.

## Executive summary

The first completed kitchen create took **23.913 s** and **18.850 s** from assistant turn start; mean **21.381 s**. The complete assistant turn took **51.603 s** and **49.673 s**; mean **50.638 s**. Model calls occupied **93.46%** and **93.09%** of those turns.

Both runs create the kitchen in **model call 2**. Call 1 fetches the image and the kitchen skill — the kitchen skill with its planning reference in one result — and the library reference and the plan state come with the turn, read in **20.6 ms** and **19.0 ms** before the first request. The create call is the largest block: **17.167 s** and **13.618 s**, of which **8.913 s** and **5.736 s** pass before its first output. Kitchen creation itself took **2.010 s** and **2.150 s**.

After the kitchen, the runs do the same work: run 1 spends **27.691 s** — a lookup of the handle colour and the backsplash, the backsplash the library cannot calculate, the black handles, a render and the answer —, run 2 **30.823 s**, its lookup call waiting 13.5 s for its first output. These are request/response wall times, including network and provider work, not isolated server compute times. The first-kitchen milestone is successful create-tool completion: a conservative point by which the kitchen has been loaded into the plan, not a measured first painted GPU frame.

## What was asked and run

Test: **image-kitchen-left-wall**, from [docs/test-prompts.json](../../docs/test-prompts.json).

> create a kitchen like the one in the image on the left-hand wall of the room

Image: [kitchen-1.png](../../docs/images/kitchen-1.png), SHA-256 07a3fe7a8cb1f57f392f356cc52b8a2af78afe9e2ec4fe6e88a9a13e8b3b3d95. Starting plan: **ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv**, default-room. Exactly this prompt was sent; the optional suite prompt suffix was omitted. Two fresh browsers and conversations used the same prompt/image and source revisions. No random cases, provider warm-up requests or request pacing were added.

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

The skill responses of call 1 contain image-planning SKILL.md and kitchen-planning SKILL.md, the kitchen skill with its planning reference in one result of 35,685 bytes; no separate reference is fetched, and no model call reads the live plan sections before the create, since the plan state comes with the turn. There is therefore one starting point:

| Milestone / interval | Run 1 s | Run 2 s |
|---|---|---|
| Image/kitchen skill responses complete (timestamp) | 4.734 | 3.079 |
| First kitchen create starts (timestamp) | 21.902 | 16.700 |
| First kitchen create completes (timestamp) | 23.913 | 18.850 |
| Delta: skill responses → first kitchen complete | 19.179 | 15.771 |
| ↳ Agent/model call 2 within that interval | 17.167 | 13.618 |
| ↳ Kitchen creation tool within that interval | 2.010 | 2.150 |
| ↳ Local gaps within that interval | 0.002 | 0.002 |

For example, run 1 takes **19.179 s** from the skill files (4.734 s) to the completed kitchen (23.913 s). The model spends **17.167 s** deciding and emitting the kitchen payload — **8.913 s** of it before its first output, with 200 reasoning tokens —; the create tool then takes **2.010 s**, with about **0.002 s** of local gaps. Run 2 takes **15.771 s** over the same interval.

## Results: milestones and total time

| Measurement (seconds) | Run 1 | Run 2 | Mean |
|---|---|---|---|
| Page/library/assistant ready (recorded run start) | 6.567 | 4.847 | 5.707 |
| Library reference and plan state acquisition inside turn (warm) | 0.021 | 0.019 | 0.020 |
| First model generated output (turn start) | 4.609 | 2.876 | 3.743 |
| First visible assistant text (turn start) | 13.648 | 8.817 | 11.232 |
| First successful kitchen create completed (turn start) | 23.913 | 18.850 | 21.381 |
| First successful kitchen create completed (recorded run start) | 30.660 | 23.865 | 27.263 |
| First successful kitchen create completed (subprocess start) | 31.008 | 24.166 | 27.587 |
| Create tool execution alone | 2.010 | 2.150 | 2.080 |
| Assistant turn start → answer complete | 51.603 | 49.673 | 50.638 |
| Time after the first kitchen until answer complete | 27.691 | 30.823 | 29.257 |
| Runner chat phase (includes image preparation/collection) | 52.300 | 50.372 | 51.336 |
| Post-chat context, images and saved snapshot | 4.588 | 3.577 | 4.082 |
| Recorded run: ready + chat + snapshot | 63.455 | 58.796 | 61.126 |
| Full subprocess: browser startup through launcher shutdown | 64.053 | 59.436 | 61.745 |

"First kitchen" here means the first successful create-or-replace-groups result, including its placement and returned groups. Each run made one successful create and retained that kitchen. Actual scene insertion happens during the tool and can precede its result; see the limitations below.

## Results: where the assistant turn goes

| Wall time component | Run 1 s | Run 1 share | Run 2 s | Run 2 share |
|---|---|---|---|---|
| Model calls (union) | 48.229 | 93.46% | 46.242 | 93.09% |
| Tools including the reads before the first request (union) | 3.350 | 6.49% | 3.410 | 6.87% |
| Model/tool overlap (subtract once) | 0.000 | 0.00% | 0.000 | 0.00% |
| Other client work / gaps | 0.025 | 0.05% | 0.021 | 0.04% |
| Assistant turn | 51.603 | 100.00% | 49.673 | 100.00% |

The model sum is taken from the SDK's measured call durations; the tool union comes from browser start/end intervals. The remaining client time closes the measured turn exactly before display rounding. Summing individual tool durations would overcount the concurrent tools.

## Results: model, tools and planner calls in order

### Run 1

Recorded start: **2026-10-28T06:34:20.025Z** (28/10/2026 07:34:20 Europe/Vienna). Model/provider: Azure Responses, gpt-6-astra.

**Agent steps — duration per decision and tool execution**

| Step | Result / following tools | Start s | End s | Agent/model delta s | Tools delta s | Total step delta s |
|---|---|---|---|---|---|---|
| 1 | get-skill (image-planning); get-skill (kitchen-planning) | 0.026 | 4.734 | 4.707 | 0.001 | 4.708 |
| 2 | create-or-replace-groups | 4.735 | 23.913 | 17.167 | 2.010 | 19.177 |
| 3 | find-attributes | 23.913 | 26.138 | 2.214 | 0.011 | 2.225 |
| 4 | change-group-attribute | 26.139 | 34.751 | 8.466 | 0.145 | 8.612 |
| 5 | change-group-attribute | 34.758 | 38.175 | 2.699 | 0.717 | 3.416 |
| 6 | get-plan-images | 38.175 | 46.738 | 8.114 | 0.448 | 8.562 |
| 7 | Final answer | 46.739 | 51.603 | 4.863 | 0.000 | 4.864 |

| Call | SDK start s | End s | Delta s (model) | First output s¹ | Remaining s² | Input tokens | Output / reasoning | Request bytes | Tools after model |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.026 | 4.733 | 4.707 | 4.583 | 0.124 | 70,547 | 55 / 0 | 573,377 | #3 get-skill; #4 get-skill |
| 2 | 4.735 | 21.902 | 17.167 | 8.913 | 8.254 | 78,689 | 747 / 200 | 85,912 | #5 create-or-replace-groups |
| 3 | 23.913 | 26.127 | 2.214 | 1.714 | 0.499 | 86,441 | 35 / 0 | 70,922 | #6 find-attributes |
| 4 | 26.139 | 34.605 | 8.466 | 7.799 | 0.667 | 87,057 | 55 / 0 | 46,866 | #7 change-group-attribute |
| 5 | 34.758 | 37.457 | 2.699 | 1.966 | 0.733 | 87,250 | 53 / 0 | 44,946 | #8 change-group-attribute |
| 6 | 38.175 | 46.289 | 8.114 | 3.074 | 5.039 | 87,664 | 132 / 28 | 45,376 | #9 get-plan-images |
| 7 | 46.739 | 51.602 | 4.863 | 1.968 | 2.895 | 90,220 | 119 / 0 | 237,647 | Final answer |

¹ From the SDK model-call start to its first generated output; this can be reasoning, a tool call or text. ² The remaining model-stream time is response duration minus first-output duration. It is not a pure text-generation or reasoning measurement. Request fetch starts and response-header times remain in the local timeline.json capture.

| Call | Tool / requested information | Start s | End s | Delta s (tool) | Elapsed ms | Nested planner ms³ | Remaining ms⁴ | Result bytes | Result |
|---|---|---|---|---|---|---|---|---|---|
| 1 | get-plan-context: articles, attributes | 0.000 | 0.014 | 0.0140 | 14.0 | 5.8 | 8.2 | 232,777 | OK |
| 2 | get-plan-context: rooms, groups, obstacles, installationElements | 0.001 | 0.018 | 0.0169 | 16.9 | 2.5 | 14.4 | 5,631 | OK |
| 3 | get-skill: image-planning / SKILL.md | 4.733 | 4.734 | 0.0005 | 0.5 | 0.0 | 0.5 | 5,658 | OK |
| 4 | get-skill: kitchen-planning / SKILL.md | 4.733 | 4.734 | 0.0006 | 0.6 | 0.0 | 0.6 | 35,685 | OK |
| 5 | create-or-replace-groups: 1 group, 9 roots; placement left / center | 21.902 | 23.913 | 2.0101 | 2010.1 | 1787.3 | 222.8 | 26,431 | OK |
| 6 | find-attributes: ids mod_HandleColor, mod_CreateBacksplash | 26.127 | 26.138 | 0.0110 | 11.0 | 7.5 | 3.5 | 2,375 | OK |
| 7 | change-group-attribute: mod_CreateBacksplash=true | 34.606 | 34.751 | 0.1449 | 144.9 | 139.3 | 5.6 | 470 | Library error |
| 8 | change-group-attribute: mod_HandleColor=Black | 37.457 | 38.175 | 0.7174 | 717.4 | 521.8 | 195.6 | 885 | OK |
| 9 | get-plan-images | 46.289 | 46.738 | 0.4484 | 448.4 | 420.5 | 27.9 | 193,136 | OK |

³ Union of the underlying planner-call intervals inside this tool. ⁴ Tool elapsed minus nested planner intervals: forwarding, scheduling, validation, projection, serialization and any uninstrumented work. This is not a pure CPU measurement. Calls #1 and #2 are the assistant's automatic reads of the library reference and the plan state, before the first model request, rather than model-requested tools.

| Call | Containing tool | Planner method / arguments | Start s | End s | Delta s (planner) | Elapsed ms |
|---|---|---|---|---|---|---|
| 1 | #1 | getExternalObjectLibraryContext [["articles","masterData"]] | 0.002 | 0.007 | 0.0058 | 5.8 |
| 2 | #2 | getExternalObjectPlanContext [["rooms","groups","obstacles","installationElements"]] | 0.011 | 0.013 | 0.0025 | 2.5 |
| 3 | #5 | getExternalObjectPlanContext [["groups"]] | 21.903 | 21.903 | 0.0001 | 0.1 |
| 4 | #5 | externalObjectGroupOperation ["create-or-replace-groups"] | 21.903 | 23.685 | 1.7815 | 1781.5 |
| 5 | #5 | getExternalObjectPlanContext [["groups"]] | 23.685 | 23.691 | 0.0057 | 5.7 |
| 6 | #6 | getExternalObjectPlanContext [["groups"]] | 26.128 | 26.135 | 0.0075 | 7.5 |
| 7 | #6 | getExternalObjectLibraryContext [["masterData"]] | 26.128 | 26.134 | 0.0065 | 6.5 |
| 8 | #7 | getExternalObjectPlanContext [["groups"]] | 34.608 | 34.620 | 0.0127 | 12.7 |
| 9 | #7 | externalObjectGroupOperation ["change-group-attribute"] | 34.620 | 34.747 | 0.1266 | 126.6 |
| 10 | #8 | getExternalObjectPlanContext [["groups"]] | 37.458 | 37.463 | 0.0056 | 5.6 |
| 11 | #8 | externalObjectGroupOperation ["change-group-attribute"] | 37.463 | 37.974 | 0.5108 | 510.8 |
| 12 | #8 | getExternalObjectPlanContext [["groups"]] | 37.974 | 37.980 | 0.0054 | 5.4 |
| 13 | #9 | getExternalObjectSnapshot [["perspectiveObjectImage","topImage","keepOpenGeometry","imageType","imageQuality"]] | 46.290 | 46.710 | 0.4205 | 420.5 |

The planner's own price refresh after the plan change, without a tool: 22.431–25.336 s, 25.336–26.892 s, 34.768–35.329 s, 38.203–38.651 s, 38.651–39.152 s.

Local capture: `.temp/result/baseline-iklw-az-2026-10-28/iklw-rep-1/` (run.json, timeline.json, planner-calls.json and plan-context.json).

### Run 2

Recorded start: **2026-10-28T06:35:24.049Z** (28/10/2026 07:35:24 Europe/Vienna). Model/provider: Azure Responses, gpt-6-astra.

**Agent steps — duration per decision and tool execution**

| Step | Result / following tools | Start s | End s | Agent/model delta s | Tools delta s | Total step delta s |
|---|---|---|---|---|---|---|
| 1 | get-skill (image-planning); get-skill (kitchen-planning) | 0.024 | 3.079 | 3.053 | 0.001 | 3.054 |
| 2 | create-or-replace-groups | 3.080 | 18.850 | 13.618 | 2.150 | 15.769 |
| 3 | find-attributes | 18.851 | 32.928 | 14.060 | 0.016 | 14.077 |
| 4 | change-group-attribute | 32.928 | 36.116 | 2.523 | 0.664 | 3.188 |
| 5 | change-group-attribute | 36.117 | 38.910 | 2.677 | 0.116 | 2.793 |
| 6 | get-plan-images | 38.910 | 44.790 | 5.432 | 0.447 | 5.880 |
| 7 | Final answer | 44.792 | 49.673 | 4.878 | 0.000 | 4.881 |

| Call | SDK start s | End s | Delta s (model) | First output s¹ | Remaining s² | Input tokens | Output / reasoning | Request bytes | Tools after model |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.024 | 3.077 | 3.053 | 2.852 | 0.201 | 70,547 | 55 / 0 | 573,377 | #3 get-skill; #4 get-skill |
| 2 | 3.080 | 16.699 | 13.618 | 5.736 | 7.883 | 78,689 | 645 / 123 | 85,912 | #5 create-or-replace-groups |
| 3 | 18.851 | 32.911 | 14.060 | 13.480 | 0.580 | 86,287 | 40 / 0 | 70,591 | #6 find-attributes |
| 4 | 32.928 | 35.451 | 2.523 | 1.673 | 0.850 | 87,816 | 67 / 0 | 50,841 | #7 change-group-attribute |
| 5 | 36.117 | 38.794 | 2.677 | 2.076 | 0.601 | 88,219 | 68 / 13 | 45,310 | #8 change-group-attribute |
| 6 | 38.910 | 44.343 | 5.432 | 3.078 | 2.354 | 88,424 | 112 / 19 | 44,946 | #9 get-plan-images |
| 7 | 44.792 | 49.670 | 4.878 | 1.928 | 2.950 | 90,960 | 128 / 0 | 237,903 | Final answer |

¹ From the SDK model-call start to its first generated output; this can be reasoning, a tool call or text. ² The remaining model-stream time is response duration minus first-output duration. It is not a pure text-generation or reasoning measurement. Request fetch starts and response-header times remain in the local timeline.json capture.

| Call | Tool / requested information | Start s | End s | Delta s (tool) | Elapsed ms | Nested planner ms³ | Remaining ms⁴ | Result bytes | Result |
|---|---|---|---|---|---|---|---|---|---|
| 1 | get-plan-context: articles, attributes | 0.001 | 0.016 | 0.0153 | 15.3 | 5.8 | 9.5 | 232,777 | OK |
| 2 | get-plan-context: rooms, groups, obstacles, installationElements | 0.001 | 0.017 | 0.0163 | 16.3 | 2.5 | 13.8 | 5,631 | OK |
| 3 | get-skill: image-planning / SKILL.md | 3.078 | 3.079 | 0.0007 | 0.7 | 0.0 | 0.7 | 5,658 | OK |
| 4 | get-skill: kitchen-planning / SKILL.md | 3.078 | 3.079 | 0.0007 | 0.7 | 0.0 | 0.7 | 35,685 | OK |
| 5 | create-or-replace-groups: 1 group, 9 roots; placement left / center | 16.700 | 18.850 | 2.1500 | 2150.0 | 1932.7 | 217.3 | 26,100 | OK |
| 6 | find-attributes: ids mod_HandleColor, mod_HandlePosType, mod_CreateBacksplash | 32.911 | 32.928 | 0.0160 | 16.0 | 13.9 | 2.1 | 6,350 | OK |
| 7 | change-group-attribute: mod_HandleColor=Black, mod_HandlePosType=01 | 35.452 | 36.116 | 0.6643 | 664.3 | 502.4 | 161.9 | 819 | OK |
| 8 | change-group-attribute: mod_CreateBacksplash=true | 38.794 | 38.910 | 0.1159 | 115.9 | 112.4 | 3.5 | 470 | Library error |
| 9 | get-plan-images | 44.344 | 44.790 | 0.4467 | 446.7 | 423.9 | 22.8 | 193,392 | OK |

³ Union of the underlying planner-call intervals inside this tool. ⁴ Tool elapsed minus nested planner intervals: forwarding, scheduling, validation, projection, serialization and any uninstrumented work. This is not a pure CPU measurement. Calls #1 and #2 are the assistant's automatic reads of the library reference and the plan state, before the first model request, rather than model-requested tools.

| Call | Containing tool | Planner method / arguments | Start s | End s | Delta s (planner) | Elapsed ms |
|---|---|---|---|---|---|---|
| 1 | #1 | getExternalObjectLibraryContext [["articles","masterData"]] | 0.002 | 0.008 | 0.0058 | 5.8 |
| 2 | #2 | getExternalObjectPlanContext [["rooms","groups","obstacles","installationElements"]] | 0.011 | 0.013 | 0.0025 | 2.5 |
| 3 | #5 | getExternalObjectPlanContext [["groups"]] | 16.702 | 16.703 | 0.0003 | 0.3 |
| 4 | #5 | externalObjectGroupOperation ["create-or-replace-groups"] | 16.703 | 18.630 | 1.9270 | 1927.0 |
| 5 | #5 | getExternalObjectPlanContext [["groups"]] | 18.630 | 18.635 | 0.0054 | 5.4 |
| 6 | #6 | getExternalObjectPlanContext [["groups"]] | 32.913 | 32.927 | 0.0139 | 13.9 |
| 7 | #6 | getExternalObjectLibraryContext [["masterData"]] | 32.913 | 32.926 | 0.0126 | 12.6 |
| 8 | #7 | getExternalObjectPlanContext [["groups"]] | 35.454 | 35.463 | 0.0088 | 8.8 |
| 9 | #7 | externalObjectGroupOperation ["change-group-attribute"] | 35.463 | 35.951 | 0.4882 | 488.2 |
| 10 | #7 | getExternalObjectPlanContext [["groups"]] | 35.951 | 35.957 | 0.0054 | 5.4 |
| 11 | #8 | getExternalObjectPlanContext [["groups"]] | 38.794 | 38.800 | 0.0054 | 5.4 |
| 12 | #8 | externalObjectGroupOperation ["change-group-attribute"] | 38.800 | 38.907 | 0.1070 | 107.0 |
| 13 | #9 | getExternalObjectSnapshot [["perspectiveObjectImage","topImage","keepOpenGeometry","imageType","imageQuality"]] | 44.345 | 44.769 | 0.4239 | 423.9 |

The planner's own price refresh after the plan change, without a tool: 17.178–18.869 s, 18.904–19.446 s, 19.447–19.934 s, 36.171–36.682 s, 36.683–37.122 s, 38.921–39.425 s.

Local capture: `.temp/result/baseline-iklw-az-2026-10-28/iklw-rep-2/` (run.json, timeline.json, planner-calls.json and plan-context.json).

## Context, cache and transport

| Measurement | Run 1 | Run 2 |
|---|---|---|
| Model calls | 7 | 7 |
| Tools including the reads before the first request | 9 | 9 |
| Input tokens | 587,868 | 590,942 |
| Output tokens (include reasoning) | 1,196 | 1,115 |
| Reasoning tokens | 228 | 155 |
| Cache-read tokens / share of input | 576,316 / 98.03% | 578,650 / 97.92% |
| Cache-write tokens | 11,531 | 12,271 |
| First call: cache-read tokens | 70,544 | 70,544 |
| Request JSON bytes, all calls | 1,105,046 | 1,108,880 |
| Reference bytes (exclude tools/current input) | 258,251 | 258,251 |
| Shared-reference SHA-256 | `b6d6b7dc146b5cd3af90c9d01e3cdce3a6b52ea12099c6234e5d4a48c976f4e8` | `b6d6b7dc146b5cd3af90c9d01e3cdce3a6b52ea12099c6234e5d4a48c976f4e8` |
| Plan state bytes (supplied with the turn) | 4,822 | 4,822 |
| Information tools, elapsed union ms | 28.7 | 33.3 |
| Information tools, summed call ms (overlap included) | 43.0 | 49.0 |
| Saved plan snapshot | `ps_t3kn4cnoa4dtbrt8pc2tao6gz226bab` | `ps_t3l146qxav0kgkqwc184sfhl2ksatbus` |

All token/cache/reasoning fields have complete coverage for completed calls. Cache reads are already part of input tokens and reasoning is already part of output tokens. Request bytes count the whole uncompressed JSON sent on every fetch, including image data. With Responses chaining a later request carries only its new input, so a whole turn sends **1,105,046** and **1,108,880 bytes**, of which the first request is **573,377 bytes**. Both runs read the same shared reference, **258,251 bytes** with the same SHA-256. The first call of each run reads **70,544 of its 70,547 input tokens** from the cache, written by earlier requests with the same prefix on this deployment; a fresh browser does not establish a cold provider cache.

The library reference returns **232,777 bytes**, the plan state **5,631 bytes**; both come with the turn before the first request. The get-plan-images results are **193,136** and **193,392 bytes**, two JPEG renders, taking **448.4 ms** and **446.7 ms** locally; they are part of the next request.

## Findings and the evidence behind them

### 1. The create call is where the time before the first kitchen goes

Call 1 ends after **4.733 / 3.077 s** with the two skill requests. Call 2, the create, then takes **17.167 / 13.618 s**: **8.913 / 5.736 s** until its first output and **8.254 / 7.883 s** streaming the payload, with **200 / 123 reasoning tokens** and **747 / 645 output tokens**. The create tool adds **2.010 / 2.150 s**, the local gaps a few milliseconds. Of the 23.913 / 18.850 s to the first kitchen, the create call is 72% / 72%.

The request/model boundary localizes this to the model round trip, not planner execution. The cause inside that boundary is **unknown**: provider queueing, input processing, reasoning, generation and network are not separately exposed. Benchmark 01 — the same test on direct OpenAI with the original build — created at call 3, after a separate round for the planning reference; its turns are compared with this baseline for the shape, not for the seconds, since provider and deployment differ.

### 2. Information gathering is cheap locally; the reads come with the turn

The library reference and the plan state are read in parallel before the first request: **14.0 / 16.9 ms** in run 1 and **15.3 / 16.3 ms** in run 2 as tools, **5.8 / 2.5 ms** and **5.8 / 2.5 ms** in the planner. The skills take **0.5–0.7 ms**. All information tools of a turn take **28.7 / 33.3 ms** in union. No model call reads the live plan sections, before the create or after it; the one read after it is `find-attributes` by ids (11.0 / 16.0 ms, 2,375 / 6,350 bytes).

### 3. Post-create work has the same shape in both runs

Run 1 spends **27.691 s** after the kitchen: call 3 looks up the handle colour and the backsplash switch by ids (2.225 s), call 4 enables the backsplash and fails (8.612 s), call 5 sets the handles black (3.416 s), call 6 renders (8.562 s) and call 7 answers (4.864 s). Run 2 spends **30.823 s**: the lookup of the handle colour, the handle position and the backsplash switch (14.077 s, 13.480 s of it until its first output), the black handles with the horizontal position (3.188 s), the failing backsplash (2.793 s), the render (5.880 s) and the answer (4.881 s). With the black handle colour the library switches the rail handle the create set to the curved bow handle in both runs, and the result names it.

### 4. Some calls wait long for their first output without reasoning

Run 2's call 3 waits **13.480 s** for its first output with 40 output tokens and no reasoning, run 1's call 4 **7.799 s** with 55 output tokens and no reasoning; run 1's call 3 and run 2's call 4, of the same kind, wait **1.714 s** and **1.673 s**. The inputs are of the same size (86–88k tokens, almost all read from the cache). The cause is not exposed; it is the provider's side of the round trip.

### 5. The backsplash remains absent

Both runs enable `mod_CreateBacksplash`, and both get the same library error: Error 14034, no entry in `tab_GrainDirectionSettings` for the backsplash. The change takes **144.9 / 115.9 ms**; the model rounds around it cost seconds. The open issue is [library backlog §10](../backlog/library-issues.md#10-backsplashes-the-library-cannot-calculate). Both answers disclose the missing backsplash.

### 6. Plan verification

Both snapshots contain one **3,010 mm** kitchen centred on the left wall at [-685, -240, 0] with **rotationZ = 90°**, about 1 m from each end of the wall. Both runs build the same row: fridge-freezer, drawer-and-door base, oven with hob, the dishwasher, the sink base, three wall cabinets and the chimney hood (HK260, USTB60, UHS60, GSP, SUT60, OTB60 ×3, DU); the dishwasher stands on the side the sink's drainer reaches over. The object perspectives and top views were inspected: olive-green Classic fronts, the oak decor 224 for the carcases, the worktop, the plinth and the wall cabinets, black bow handles — vertical in run 1, horizontal in run 2. Approximate library finishes, a two-section fridge front and the absent dark backsplash limit fidelity to the photo; both answers name them. This is a latency benchmark of those resulting plans, not an assertion of pixel-identical image reproduction.

## Proposed experiments and rejected conclusions

| Candidate | What this run supports | Expected saving / limit |
|---|---|---|
| Less to decide in the create call (proposal C: a worked example of a create payload; the reasoning effort, RML-18043) | The create call takes 17.167 / 13.618 s, 8.913 / 5.736 s of it before its first output, with 200 / 123 reasoning tokens | The largest block before the first kitchen. Its saving is unknown until a run of the same layout is compared with this baseline. |
| Set the attributes of an image kitchen in the create | Both runs look up the handle colour after the create and set it black: run 1 in calls 3 and 5 (2.225 + 3.416 s), run 2 in calls 3 and 4 (14.077 + 3.188 s) | Fewer rounds after the first kitchen. The changes depend on what the model reads in the image, so no saving is established. |
| Resolve the backsplash calculation/advertised capability | Both runs look up the backsplash with the handle colour and fail to create it: the failing change costs 8.612 s in run 1 (call 4), 2.793 s in run 2 (call 5) | A working switch improves fidelity; a reliable capability description in the library data could avoid the futile round. Library issue 10. |
| A watchdog for calls without a first output | Run 2's call 3 and run 1's call 4 wait 13.5 and 7.8 s for their first output without reasoning | A resend doubles the cost of a legitimate long reasoning. Measure the tail over more runs first. |
| Tool memoization / attribute indexing / precalculated docking vectors | The information tools take 28.7 / 33.3 ms in union; the create tool 2.010 / 2.150 s | Local work is not the bottleneck: removing every information tool saves milliseconds. |

## Measurement gaps and open work

- **First painted frame:** no GPU presentation/paint marker was captured. Create-tool completion is an upper bound for a loaded kitchen; first visible geometry could appear earlier within the 2.010–2.150 s create.
- **Provider internals:** model time combines network, queueing, input processing, reasoning, generation and SDK stream handling. Time to first output does not isolate prefill; response-header time does not isolate network RTT.
- **Tool internals:** the planner table separates planner access from the surrounding tool, but does not profile every individual filtering, projection, docking, library-calculation or kernel-load function. Remaining tool time must not be renamed CPU assembly time.
- **Final text start:** first visible text refers to the first planning preamble; the end of the turn marks completion of the final answer. Final-answer text-delta start was not separately instrumented.
- **Startup attribution:** page/module/library/plan/assistant initialization, the runner's readiness read and the assistant's library read before the first prompt overlap inside the ready phase. They were not profiled individually.
- **Instrumentation overhead:** extra console events, UTF-8 size measurement and log delivery add unquantified overhead; both runs have the same hooks. The planner is a Vite development server; do not use these page-startup numbers as production cold-start numbers.
- **Sampling:** two runs establish a repeated measurement and show the variation of single calls. They do not establish a p95, a stable service-level expectation or the cause of provider variability. Another pair costs about 2 minutes and 1.2M input tokens, most of them read from the cache.

## The benchmark to repeat

Use the commits, image digest and settings in manifest.json (local: `.temp/result/baseline-iklw-az-2026-10-28/manifest.json`). Keep the planner on port 5173 and check that its checkout is the one to measure; the example page pins the embedding-lib. Keep `"provider": "gpt-6-astra", "apiKey": "$AZURE_GPT_KEY"` with the key in AZURE_GPT_KEY. Do not silently substitute another provider.

```sh
cd .temp/result/baseline-iklw-az-2026-10-28
node make-timing-runner.mjs
REPS=1,2 node run-reps.mjs iklw
node analyze.mjs iklw-rep-1 iklw-rep-2
node write-baseline.mjs
```

Before a new capture, copy these scripts into a fresh dated session directory and point the paths there; never overwrite this evidence. A measurement against this baseline uses the same test, the same settings and a report of this layout.

Retain run.json, timeline.json, planner-calls.json, plan-context.json, source SHAs, exclusions and snapshot IDs. Compute interval unions rather than summing concurrent tools; check the counts against the model usage and recorded calls.

Verification performed: every model request paired with a completed model call and its diagnostics bytes; all tool starts paired with ends; the nested planner calls paired with their log lines, the two parallel reads before the first request by their method; the interval accounting reconciles with the full-turn duration; one failed backsplash call per run; both snapshot IDs present; the roomle-ui checkout stayed on 5fd409e84 through both runs.
