# image-kitchen-left-wall: detailed OpenAI Astra timing — the status line of the window

| Field | Value |
|---|---|
| Type / domain | Benchmark / HI Planning Assistant |
| Trigger | Repeat image-kitchen-left-wall with proposal B, the status line of the window; RML-18303 |
| Date / author | 2026-10-27 / Claude Code |
| Status | Measured: two completed turns, two saved plans |
| Ticket | [RML-18303](https://roomle.atlassian.net/browse/RML-18303) |
| Data | Raw captures in ignored `.temp/result/benchmark-05-iklw-oa-2026-10-27/rep-1` and `rep-2`; manifest, timing runner, hook check and derivation scripts in the same folder |
| Repeat | Same fixture and direct OpenAI provider, local planner; procedure below |
| PDF | `.temp/result/benchmark-05-iklw-oa-2026-10-27/05-iklw-oa-rc-status-2026-10-27.pdf` |

Affected repositories:

- **roomle-ui:** the planner measured, `feat/hi-mcp-merge` at 3956db258 — the planner of report 04 (9577d925b) plus proposal B (bd4d1d1c9): the planning assistant names a tool in the window's status as soon as the model starts writing its call, and requests a reasoning summary whose first lines it shows as the status. No runtime change of the planner.
- **roomle-hi-example:** this report, the indexes and the [comparison](iklw-oa-rc-cmp-2026-10-26.md).

## Executive summary

First successful kitchen creation completed in **29.910 / 27.002 s** from assistant turn start; mean **28.456 s**, -1.206 s against report 04. Complete turns took **65.774 / 54.134 s**; mean **59.954 s**, with **10 / 7 model calls**. Calls 1–3 — the skills, the planning reference, the create — are those of 04 in both runs. The turns differ after the create, by the agent's choices: run 1 renders, changes the sink, reads the obstacles and renders again; run 2 does not render and sets the handle design after the backsplash fails. That is where the turn's +7.627 s against 04 comes from, not from proposal B.

Proposal B, measured:

- **The tool status comes with the start of the call.** The window names `create-or-replace-groups` **5.587 / 3.667 s** before the create tool starts, while the model streams the payload; in 04 the name came 0.178 / 0.182 s before. The first status appears after 3.224 / 3.150 s.
- **The reasoning summary does not come earlier than the first output — it is the first output.** Every request carries `reasoning.summary: 'auto'`, and OpenAI accepts it for gpt-6-astra. A summary streams on 2 of 10 and 4 of 7 calls; its first line reaches the window 0.4–1.8 ms after the call's first generated output, and those calls wait no less for it than the same calls in 04 (the reference round of run 2: 11.384 s, against 9.368 / 10.584 s). Run 1 shows no summary before the kitchen, run 2 one, at the end of the reference round. The longest stretch without any window update before the kitchen is **8.992 / 11.568 s** (04: 11.056 / 10.729 s): the wait for the first output of the reference round, which the summary does not shorten.
- **No measurable cost.** Calls 1–3 take 3.535 / 3.403, 10.605 / 13.023, 13.775 / 8.437 s against 5.335 / 4.300, 11.575 / 12.780, 11.028 / 10.000 s in 04, with 79 / 79, 295 / 324, 694 / 622 output tokens against 79 / 79, 287 / 246, 666 / 683. Two repetitions show no difference beyond the run-to-run spread.

## What was asked and run

Test: **image-kitchen-left-wall**, from [docs/test-prompts.json](../../docs/test-prompts.json).

> create a kitchen like the one in the image on the left-hand wall of the room

Image: [kitchen-1.png](../../docs/images/kitchen-1.png), SHA-256 07a3fe7a8cb1f57f392f356cc52b8a2af78afe9e2ec4fe6e88a9a13e8b3b3d95. Starting plan: **ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv**, default-room. Two fresh browsers and conversations sent this exact prompt and the original image. The suite suffix was omitted; no random cases, pacing or paid warm-ups were added.

| Setting | Measured value |
|---|---|
| Model CLI / key reference | openai:gpt-6-astra / $OPENAI_ASSISTANT_API_KEY; no resolved credentials in artifacts |
| Endpoint / reasoning | https://api.openai.com/v1/responses / provider-default effort; `reasoning.summary: 'auto'` on every request |
| Planner | http://localhost:5173/, a dev server of the roomle-ui checkout started for this capture; no other planner server was running |
| roomle-ui SHA | 3956db258 on `feat/hi-mcp-merge`, unchanged through both runs: 04's 9577d925b plus bd4d1d1c9 |
| Embedding-lib | Published `@roomle/embedding-lib@0.0.0-dev-bd4d1d1` from jsDelivr, as the example pins it; its source equals `packages/embedding-lib/src` of the measured checkout |
| Example | http://localhost:3103/ |
| roomle-hi-example SHA | 28c22af on `docs/proposal-b-progress-in-the-window` |
| Node / Chromium | Node v23.5.0; Playwright 1.55.0 bundled Chromium, headless with `--enable-gpu` |
| First-call cache reads | 0 / 77,268 tokens; run 1 found no cached prefix, run 2 a warm one |
| Transport | Responses chaining; full first request, stored provider response plus new tool outputs thereafter |

## How it was measured

The collector of report 04, regenerated from the current [prompt runner](../scripts/run-hi-mcp-prompt.js): in the example page, the hook marks every `/v1/responses` fetch (start, response headers, the end of the stream read through a clone, request bytes), the tool bridge `callExternalObjectAgentTool` (start, end, result bytes) and every output part the window receives, with its type and text; in the planner frame, it wraps the seven planner methods of `window.RoomlePlanner` and timestamps the `[hi-mcp]` log lines. Turn start and end are taken around `onPlanningAssistantPrompt`. All marks are `performance.timeOrigin + performance.now()`. One addition: the fetch hook records the `reasoning` object of each request body, parsed after the request is dispatched. No response routing is used, so the browser's HTTP cache works as usual.

A hook check before the paid runs sent the same turn with an invalid key: the bootstrap tool, its planner call and the log lines were timed, and the one model request — carrying `reasoning: { summary: 'auto' }` — was rejected with HTTP 401, without inference. Its request bytes equal the assistant's own measurement. A first attempt ended in a transient "Failed to fetch" and is kept as `hook-check.attempt-1`.

Both paid repetitions completed without provider or chat errors, retries or snapshot failures; no repetition is excluded. The backsplash calculation failure is tool feedback, separate from chat success.

## How to read the step deltas

Start/End are seconds relative to the assistant turn start. Delta is elapsed time, rounded to three decimals; the elapsed-ms columns keep short calls. A model call ends when its response stream ends, measured through the clone; its start is that end minus the SDK's response duration, so the start is derived. Model duration includes transport, provider work and streaming. Tool wall time is the union of parallel intervals. A nested planner call belongs to the tool of the last `[hi-mcp] tool` line before its own `[hi-mcp] call` line in the planner frame. Planner calls without such a line are the planner's own price refresh after a plan change, listed apart. A window update is any output part the window receives: a status (`activity`) or a piece of answer text. A status without a space is a tool name, one with a space the first line of a reasoning summary. Runner start follows browser launch; subprocess time includes launch and shutdown.

### From skills to the first kitchen

Initial skills complete when the image-planning and kitchen-planning SKILL.md files of the first round are back; the mandatory planning reference is the second milestone.

| Milestone / interval | Run 1 s | Run 2 s |
|---|---|---|
| Initial image/kitchen SKILL.md complete (timestamp) | 3.564 | 3.428 |
| Last required reference complete (timestamp) | 14.172 | 16.454 |
| First create starts (timestamp) | 27.948 | 24.894 |
| First create completes (timestamp) | 29.910 | 27.002 |
| Initial main files → kitchen complete (delta) | 26.346 | 23.573 |
| All required files → kitchen complete (delta) | 15.738 | 10.547 |
| Model time in last interval | 13.775 | 8.437 |
| Create tool delta | 1.962 | 2.108 |
| Local remainder in last interval | 0.001 | 0.002 |

## Results: milestones and total time

| Measurement (seconds) | Run 1 | Run 2 | Mean |
|---|---|---|---|
| Page/library/assistant ready (recorded run start) | 4.950 | 5.209 | 5.080 |
| Warm bootstrap/reference acquisition | 0.018 | 0.016 | 0.017 |
| First model output (turn start) | 3.279 | 3.159 | 3.219 |
| First visible text (turn start) | 12.290 | 15.917 | 14.103 |
| First kitchen completed (turn start) | 29.910 | 27.002 | 28.456 |
| First kitchen completed (recorded run start) | 35.075 | 32.374 | 33.724 |
| First kitchen completed (subprocess start) | 35.320 | 32.610 | 33.965 |
| Create tool alone | 1.962 | 2.108 | 2.035 |
| Turn start → answer complete | 65.774 | 54.134 | 59.954 |
| After first kitchen → answer complete | 35.864 | 27.132 | 31.498 |
| Runner chat phase | 66.528 | 54.822 | 60.675 |
| Post-chat context/images/snapshot | 4.560 | 4.005 | 4.282 |
| Recorded ready + chat + snapshot | 76.038 | 64.036 | 70.037 |
| Full subprocess | 76.530 | 64.512 | 70.521 |

The runner's first plan change, the planner history event of the create measured from the runner's own turn start, is 29.921 / 27.009 s, within 12 ms of the create tool's end.

## Results: the status line of the window

What the window shows before the answer, the subject of proposal B. The 04 columns come from the retained captures of report 04, read with the same script.

| Measurement (seconds from turn start) | 04 run 1 | 04 run 2 | 05 run 1 | 05 run 2 |
|---|---|---|---|---|
| First status | 5.203 | 4.081 | 3.224 | 3.150 |
| First reasoning summary line | — | — | 40.389 | 14.816 |
| First answer text | 14.730 | 14.914 | 12.290 | 15.917 |
| Status names create-or-replace-groups | 27.791 | 26.931 | 22.361 | 21.227 |
| Create tool starts | 27.969 | 27.114 | 27.948 | 24.894 |
| Lead of that status before the create tool | 0.178 | 0.182 | 5.587 | 3.667 |
| First kitchen completed | 30.062 | 29.261 | 29.910 | 27.002 |
| Reasoning summary lines before the kitchen / in the turn | 0 / 0 | 0 / 0 | 0 / 2 | 1 / 4 |
| Longest time without a window update before the kitchen (interval) | 11.056 (16.734–27.791) | 10.729 (4.185–14.914) | 8.992 (3.298–12.290) | 11.568 (3.248–14.816) |
| Longest time without a window update in the turn (interval) | 11.056 (16.734–27.791) | 10.729 (4.185–14.914) | 8.992 (3.298–12.290) | 11.568 (3.248–14.816) |

The reasoning summary lines of 05, with the model call they belong to:

| Run | Shown s | Status text | Model call | Reasoning tokens of the call | After the call's first output, ms |
|---|---|---|---|---|---|
| 1 | 40.389 | Preparing to render image | 6 | 31 | 1.1 |
| 1 | 47.626 | Fixing sink configuration | 7 | 47 | 1.2 |
| 2 | 14.816 | Evaluating kitchen layout | 2 | 226 | 1.8 |
| 2 | 30.814 | Exploring backsplash and sink geometry | 4 | 21 | 0.8 |
| 2 | 35.597 | Considering handle options | 5 | 38 | 0.9 |
| 2 | 50.745 | Considering image comparisons | 7 | 72 | 0.4 |

- **The tool status covers the payload stream.** At `tool-input-start` the window names the tool while the model still writes its input. For the create, that is the call's first output: the name stands 5.587 / 3.667 s before the tool starts, the 5.574 / 3.667 s the create call streams after its first output (the 13 ms difference in run 1 is the derivation of the call's start).
- **A summary line is the call's first output.** Each line arrives 0.4–1.8 ms after its call's first generated output, so it says what the model did while the window waited. Calls 7 / 6 of the turns reason; only 2 / 4 stream a summary — the create call (195 / 90 reasoning tokens) streams none in either run, so its wait for the first output (8.201 / 4.771 s) shows the status of the reference skill.
- **The longest silence is the wait for the reference round's first output** in both runs (call 2, 8.723 / 11.384 s). In 04, run 1's longest silence ran through the create call — its reasoning and its whole payload — until the complete call (16.734–27.791 s); the tool status now ends that stretch at the call's first output. Run 2 of 04 had its longest silence in the reference round, as 05.

## Results: where the assistant turn goes

| Component | Run 1 s | Run 1 share | Run 2 s | Run 2 share |
|---|---|---|---|---|
| Model calls (union) | 62.147 | 94.49% | 51.072 | 94.34% |
| Tools including bootstrap (union) | 3.597 | 5.47% | 3.038 | 5.61% |
| Model/tool overlap (subtract once) | 0.000 | 0.00% | 0.000 | 0.00% |
| Other client work/gaps | 0.029 | 0.04% | 0.023 | 0.04% |
| Assistant turn | 65.774 | 100.00% | 54.134 | 100.00% |

## Results: model, tools and planner calls in order

### Run 1

Recorded start: 2026-10-27T11:23:30.720Z; direct OpenAI Responses.

**Agent steps — duration per decision and tool execution**

| Step | Following tools/work | Start s | End s | Agent/model delta s | Tools delta s | Total step delta s |
|---|---|---|---|---|---|---|
| 1 | get-plan-context; get-skill (image-planning); get-skill (kitchen-planning) | 0.023 | 3.564 | 3.535 | 0.005 | 3.541 |
| 2 | get-skill (kitchen-planning / references/planning-reference.md) | 3.566 | 14.172 | 10.605 | 0.000 | 10.605 |
| 3 | create-or-replace-groups | 14.172 | 29.910 | 13.775 | 1.962 | 15.737 |
| 4 | find-attributes | 29.910 | 33.665 | 3.744 | 0.011 | 3.755 |
| 5 | change-group-attribute | 33.666 | 37.436 | 3.631 | 0.139 | 3.771 |
| 6 | get-plan-images | 37.437 | 42.656 | 4.772 | 0.446 | 5.219 |
| 7 | change-module-attribute | 42.657 | 50.127 | 6.796 | 0.673 | 7.471 |
| 8 | get-plan-context | 50.128 | 54.077 | 3.939 | 0.009 | 3.949 |
| 9 | get-plan-images | 54.078 | 59.693 | 5.275 | 0.339 | 5.615 |
| 10 | Final answer | 59.694 | 65.774 | 6.077 | 0.000 | 6.080 |

| Call | SDK start s | End s | Delta s (model) | First output s | Remaining s | Input tokens | Output / reasoning | Request bytes | Tools after model |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.023 | 3.558 | 3.535 | 3.256 | 0.279 | 77,271 | 79 / 0 | 604,230 | #2 get-plan-context, #3 get-skill, #4 get-skill |
| 2 | 3.566 | 14.171 | 10.605 | 8.723 | 1.882 | 84,140 | 295 / 192 | 75,470 | #5 get-skill |
| 3 | 14.172 | 27.947 | 13.775 | 8.201 | 5.574 | 87,479 | 694 / 195 | 59,171 | #6 create-or-replace-groups |
| 4 | 29.910 | 33.654 | 3.744 | 3.394 | 0.350 | 95,481 | 38 / 9 | 71,682 | #7 find-attributes |
| 5 | 33.666 | 37.296 | 3.631 | 3.096 | 0.535 | 95,690 | 53 / 0 | 44,537 | #8 change-group-attribute |
| 6 | 37.437 | 42.209 | 4.772 | 2.951 | 1.821 | 95,877 | 117 / 31 | 44,233 | #9 get-plan-images |
| 7 | 42.657 | 49.453 | 6.796 | 4.968 | 1.828 | 98,418 | 111 / 47 | 227,066 | #10 change-module-attribute |
| 8 | 50.128 | 54.067 | 3.939 | 3.133 | 0.806 | 98,584 | 34 / 11 | 43,949 | #11 get-plan-context |
| 9 | 54.078 | 59.353 | 5.275 | 4.215 | 1.060 | 99,453 | 71 / 11 | 45,631 | #12 get-plan-images |
| 10 | 59.694 | 65.771 | 6.077 | 2.803 | 3.274 | 101,948 | 136 / 0 | 228,310 | Final answer |

| Call | Tool / requested information | Start s | End s | Delta s (tool) | Elapsed ms | Nested planner ms | Remaining ms | Result bytes | Outcome |
|---|---|---|---|---|---|---|---|---|---|
| 1 | get-plan-context: articles, attributes | 0.000 | 0.013 | 0.013 | 12.9 | 6.3 | 6.6 | 270,617 | OK |
| 2 | get-plan-context: rooms, groups, obstacles, installationElements | 3.559 | 3.563 | 0.005 | 4.8 | 2.5 | 2.3 | 5,631 | OK |
| 3 | get-skill: image-planning / SKILL.md | 3.559 | 3.563 | 0.005 | 4.8 | 0.0 | 4.8 | 5,658 | OK |
| 4 | get-skill: kitchen-planning / SKILL.md | 3.559 | 3.564 | 0.005 | 4.9 | 0.0 | 4.9 | 20,247 | OK |
| 5 | get-skill: kitchen-planning / references/planning-reference.md | 14.171 | 14.172 | 0.000 | 0.3 | 0.0 | 0.3 | 15,393 | OK |
| 6 | create-or-replace-groups: 1 group, 9 roots; placement left / center | 27.948 | 29.910 | 1.962 | 1961.5 | 1762.6 | 198.9 | 27,904 | OK |
| 7 | find-attributes: Create backsplash | 33.654 | 33.665 | 0.011 | 10.6 | 7.6 | 3.0 | 759 | OK |
| 8 | change-group-attribute: mod_CreateBacksplash=true | 37.297 | 37.436 | 0.139 | 138.9 | 133.3 | 5.6 | 470 | Tool error |
| 9 | get-plan-images | 42.209 | 42.656 | 0.446 | 446.3 | 425.7 | 20.6 | 183,268 | OK |
| 10 | change-module-attribute: mod_SinkId=Axia_Grey_L | 49.454 | 50.127 | 0.673 | 673.5 | 509.4 | 164.1 | 171 | OK |
| 11 | get-plan-context: obstacles | 54.068 | 54.077 | 0.009 | 9.5 | 7.5 | 2.0 | 1,853 | OK |
| 12 | get-plan-images | 59.354 | 59.693 | 0.339 | 339.0 | 308.8 | 30.2 | 184,512 | OK |

| Call | Parent tool | Planner method / arguments | Start s | End s | Delta s (planner) | Elapsed ms |
|---|---|---|---|---|---|---|
| 1 | 1 | getExternalObjectLibraryContext [["articles", "masterData"]] | 0.001 | 0.008 | 0.006 | 6.3 |
| 2 | 2 | getExternalObjectPlanContext [["rooms", "groups", "obstacles", "installationElements"]] | 3.559 | 3.561 | 0.003 | 2.5 |
| 3 | 6 | getExternalObjectPlanContext [["groups"]] | 27.949 | 27.949 | 0.000 | 0.1 |
| 4 | 6 | externalObjectGroupOperation ["create-or-replace-groups"] | 27.949 | 29.706 | 1.756 | 1756.5 |
| 5 | 6 | getExternalObjectPlanContext [["groups"]] | 29.706 | 29.712 | 0.006 | 6.0 |
| 6 | 7 | getExternalObjectPlanContext [["groups"]] | 33.656 | 33.663 | 0.008 | 7.6 |
| 7 | 7 | getExternalObjectLibraryContext [["masterData"]] | 33.656 | 33.662 | 0.007 | 6.7 |
| 8 | 8 | getExternalObjectPlanContext [["groups"]] | 37.299 | 37.309 | 0.011 | 10.5 |
| 9 | 8 | externalObjectGroupOperation ["change-group-attribute"] | 37.309 | 37.432 | 0.123 | 122.8 |
| 10 | 9 | getExternalObjectSnapshot [["perspectiveObjectImage", "topImage", "keepOpenGeometry", "imageType", "imageQuality"]] | 42.210 | 42.636 | 0.426 | 425.7 |
| 11 | 10 | getExternalObjectPlanContext [["groups"]] | 49.455 | 49.466 | 0.010 | 10.4 |
| 12 | 10 | externalObjectGroupOperation ["change-module-attribute"] | 49.466 | 49.959 | 0.493 | 493.1 |
| 13 | 10 | getExternalObjectPlanContext [["groups"]] | 49.959 | 49.965 | 0.006 | 5.9 |
| 14 | 11 | getExternalObjectPlanContext [["obstacles", "rooms"]] | 54.069 | 54.077 | 0.007 | 7.5 |
| 15 | 12 | getExternalObjectSnapshot [["perspectiveObjectImage", "topImage", "keepOpenGeometry", "imageType", "imageQuality"]] | 59.355 | 59.664 | 0.309 | 308.8 |

**Individual HTTP requests — UTF-8 serialized JSON body bytes**

| Attempt | SDK step | Fetch start s | Fetch → headers s | Request bytes | New input bytes | Repeated input bytes | Input bytes | Tools bytes | Envelope bytes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | 0.035 | 2.080 | 604,230 | 560,621 | 0 | 560,621 | 43,498 | 111 |
| 2 | 2 | 3.569 | 1.044 | 75,470 | 31,767 | 0 | 31,767 | 43,498 | 205 |
| 3 | 3 | 14.174 | 1.088 | 59,171 | 15,470 | 0 | 15,470 | 43,498 | 203 |
| 4 | 4 | 30.180 | 1.127 | 71,682 | 27,981 | 0 | 27,981 | 43,498 | 203 |
| 5 | 5 | 33.666 | 1.307 | 44,537 | 836 | 0 | 836 | 43,498 | 203 |
| 6 | 6 | 37.443 | 0.841 | 44,233 | 532 | 0 | 532 | 43,498 | 203 |
| 7 | 7 | 42.664 | 0.900 | 227,066 | 183,365 | 0 | 183,365 | 43,498 | 203 |
| 8 | 8 | 50.137 | 0.826 | 43,949 | 248 | 0 | 248 | 43,498 | 203 |
| 9 | 9 | 54.079 | 1.065 | 45,631 | 1,930 | 0 | 1,930 | 43,498 | 203 |
| 10 | 10 | 59.702 | 1.376 | 228,310 | 184,609 | 0 | 184,609 | 43,498 | 203 |

The planner's own price refresh, without a tool's call line: 28.453–30.202, 30.204–30.735, 37.446–37.869, 50.139–50.501, 50.502–50.965 s.

### Run 2

Recorded start: 2026-10-27T11:24:47.257Z; direct OpenAI Responses.

**Agent steps — duration per decision and tool execution**

| Step | Following tools/work | Start s | End s | Agent/model delta s | Tools delta s | Total step delta s |
|---|---|---|---|---|---|---|
| 1 | get-plan-context; get-skill (image-planning); get-skill (kitchen-planning) | 0.021 | 3.428 | 3.403 | 0.004 | 3.407 |
| 2 | get-skill (kitchen-planning / references/planning-reference.md) | 3.430 | 16.454 | 13.023 | 0.001 | 13.025 |
| 3 | create-or-replace-groups | 16.456 | 27.002 | 8.437 | 2.108 | 10.545 |
| 4 | find-attributes; get-plan-context | 27.002 | 32.059 | 5.039 | 0.016 | 5.057 |
| 5 | change-group-attribute | 32.060 | 37.036 | 4.836 | 0.139 | 4.976 |
| 6 | change-group-attribute | 37.037 | 46.430 | 8.632 | 0.761 | 9.393 |
| 7 | Final answer | 46.431 | 54.134 | 7.702 | 0.000 | 7.703 |

| Call | SDK start s | End s | Delta s (model) | First output s | Remaining s | Input tokens | Output / reasoning | Request bytes | Tools after model |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.021 | 3.424 | 3.403 | 3.138 | 0.265 | 77,271 | 79 / 0 | 604,230 | #2 get-plan-context, #3 get-skill, #4 get-skill |
| 2 | 3.430 | 16.453 | 13.023 | 11.384 | 1.639 | 84,140 | 324 / 226 | 75,470 | #5 get-skill |
| 3 | 16.456 | 24.893 | 8.437 | 4.771 | 3.667 | 87,508 | 622 / 90 | 59,171 | #6 create-or-replace-groups |
| 4 | 27.002 | 32.042 | 5.039 | 3.811 | 1.228 | 95,511 | 76 / 21 | 71,589 | #7 find-attributes, #8 get-plan-context |
| 5 | 32.060 | 36.896 | 4.836 | 3.536 | 1.300 | 96,614 | 112 / 38 | 46,468 | #9 change-group-attribute |
| 6 | 37.037 | 45.669 | 8.632 | 8.133 | 0.499 | 96,867 | 72 / 15 | 44,233 | #10 change-group-attribute |
| 7 | 46.431 | 54.132 | 7.702 | 4.314 | 3.388 | 97,235 | 247 / 72 | 44,378 | Final answer |

| Call | Tool / requested information | Start s | End s | Delta s (tool) | Elapsed ms | Nested planner ms | Remaining ms | Result bytes | Outcome |
|---|---|---|---|---|---|---|---|---|---|
| 1 | get-plan-context: articles, attributes | 0.001 | 0.010 | 0.010 | 9.8 | 5.7 | 4.1 | 270,617 | OK |
| 2 | get-plan-context: rooms, groups, obstacles, installationElements | 3.424 | 3.428 | 0.004 | 3.7 | 2.4 | 1.3 | 5,631 | OK |
| 3 | get-skill: image-planning / SKILL.md | 3.425 | 3.428 | 0.004 | 3.8 | 0.0 | 3.8 | 5,658 | OK |
| 4 | get-skill: kitchen-planning / SKILL.md | 3.425 | 3.428 | 0.004 | 3.8 | 0.0 | 3.8 | 20,247 | OK |
| 5 | get-skill: kitchen-planning / references/planning-reference.md | 16.454 | 16.454 | 0.001 | 0.7 | 0.0 | 0.7 | 15,393 | OK |
| 6 | create-or-replace-groups: 1 group, 9 roots; placement left / center | 24.894 | 27.002 | 2.108 | 2107.9 | 1916.3 | 191.6 | 27,811 | OK |
| 7 | find-attributes: Create backsplash | 32.043 | 32.059 | 0.016 | 16.3 | 8.1 | 8.2 | 759 | OK |
| 8 | get-plan-context: obstacles | 32.044 | 32.059 | 0.016 | 15.9 | 3.1 | 12.8 | 1,853 | OK |
| 9 | change-group-attribute: mod_CreateBacksplash=true, mod_HandleDesign=60 | 36.898 | 37.036 | 0.139 | 138.8 | 132.3 | 6.5 | 470 | Tool error |
| 10 | change-group-attribute: mod_HandleDesign=60 | 45.669 | 46.430 | 0.761 | 760.8 | 557.7 | 203.1 | 600 | OK |

| Call | Parent tool | Planner method / arguments | Start s | End s | Delta s (planner) | Elapsed ms |
|---|---|---|---|---|---|---|
| 1 | 1 | getExternalObjectLibraryContext [["articles", "masterData"]] | 0.002 | 0.007 | 0.006 | 5.7 |
| 2 | 2 | getExternalObjectPlanContext [["rooms", "groups", "obstacles", "installationElements"]] | 3.425 | 3.427 | 0.002 | 2.4 |
| 3 | 6 | getExternalObjectPlanContext [["groups"]] | 24.895 | 24.895 | 0.000 | 0.2 |
| 4 | 6 | externalObjectGroupOperation ["create-or-replace-groups"] | 24.895 | 26.805 | 1.910 | 1910.2 |
| 5 | 6 | getExternalObjectPlanContext [["groups"]] | 26.805 | 26.811 | 0.006 | 5.9 |
| 6 | 7 | getExternalObjectPlanContext [["groups"]] | 32.046 | 32.054 | 0.008 | 8.1 |
| 7 | 7 | getExternalObjectLibraryContext [["masterData"]] | 32.046 | 32.053 | 0.007 | 7.0 |
| 8 | 8 | getExternalObjectPlanContext [["obstacles", "rooms"]] | 32.056 | 32.059 | 0.003 | 3.1 |
| 9 | 9 | getExternalObjectPlanContext [["groups"]] | 36.900 | 36.912 | 0.012 | 11.8 |
| 10 | 9 | externalObjectGroupOperation ["change-group-attribute"] | 36.912 | 37.032 | 0.120 | 120.5 |
| 11 | 10 | getExternalObjectPlanContext [["groups"]] | 45.670 | 45.677 | 0.007 | 7.5 |
| 12 | 10 | externalObjectGroupOperation ["change-group-attribute"] | 45.677 | 46.222 | 0.544 | 544.4 |
| 13 | 10 | getExternalObjectPlanContext [["groups"]] | 46.222 | 46.228 | 0.006 | 5.8 |

**Individual HTTP requests — UTF-8 serialized JSON body bytes**

| Attempt | SDK step | Fetch start s | Fetch → headers s | Request bytes | New input bytes | Repeated input bytes | Input bytes | Tools bytes | Envelope bytes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | 0.034 | 1.098 | 604,230 | 560,621 | 0 | 560,621 | 43,498 | 111 |
| 2 | 2 | 3.433 | 0.896 | 75,470 | 31,767 | 0 | 31,767 | 43,498 | 205 |
| 3 | 3 | 16.458 | 0.853 | 59,171 | 15,470 | 0 | 15,470 | 43,498 | 203 |
| 4 | 4 | 27.081 | 0.826 | 71,589 | 27,888 | 0 | 27,888 | 43,498 | 203 |
| 5 | 5 | 32.061 | 0.844 | 46,468 | 2,766 | 0 | 2,766 | 43,498 | 204 |
| 6 | 6 | 37.042 | 1.090 | 44,233 | 532 | 0 | 532 | 43,498 | 203 |
| 7 | 7 | 46.458 | 0.789 | 44,378 | 677 | 0 | 677 | 43,498 | 203 |

The planner's own price refresh, without a tool's call line: 25.394–27.097, 27.104–27.649, 37.047–37.495, 46.459–46.914, 46.914–47.571 s.

## Usage, transport and saved plans

| Measurement | Run 1 | Run 2 |
|---|---|---|
| Model calls | 10 | 7 |
| Request bytes (turn total) | 1,444,279 | 945,539 |
| Repeated serialized input bytes (turn total) | 0 | 0 |
| Input tokens | 934,341 | 635,146 |
| Output / reasoning tokens | 1,628 / 496 | 1,532 / 462 |
| Cache read / coverage | 832,366 / complete | 622,030 / complete |
| Cache write / coverage | 101,945 / complete | 13,095 / complete |
| First-call cache read | 0 | 77,268 |
| Shared reference bytes | 295,482 | 295,482 |
| Shared reference SHA-256 | `9591664f362abea2796faa588748630471ff819ca0aad2061bbaa3191cea7013` | `9591664f362abea2796faa588748630471ff819ca0aad2061bbaa3191cea7013` |
| `reasoning` of every request body | `{ summary: 'auto' }`, 10 of 10 | `{ summary: 'auto' }`, 7 of 7 |
| get-plan-images result bytes (base64 image characters) | 183,268 (183,016); 184,512 (184,260) | none |
| Requests that carry images: call, bytes, fetch → headers | 7, 227,066, 0.900 s; 10, 228,310, 1.376 s | none: no render |
| Saved snapshot | ps_t0xbfktjbxmzfrkx9u0so8df8dl111j | ps_t0xd9b5minvdfsnhqli60e3e66a2nkk |

Request bytes are each call's UTF-8 body; continuations upload no repeated input. Earlier context still counts in the input tokens of a chained call. The envelope of every request is 31 bytes larger than in 04: the `reasoning` object. Summary tokens are not reported apart from the output tokens.

## Findings and plan verification

| Run | Position / rotation | Kitchen width mm | Article IDs (non-generated) | Outcome / limits |
|---|---|---|---|---|
| 1 | [-685,-240,0] / 90° | 3010 | HK260, USTB60, UHS60, SUT60, UTB60, OTB60, DU, OTB60, OTB60 | Backsplash Error 14034; the sink unit stands beside the oven unit, then changed to a left-hand basin; curved handles disclosed; two renders |
| 2 | [-685,-240,0] / 90° | 3010 | HK260, USTB60, UHS60, UTB60, SUT60, OTB60, DU, OTB60, OTB60 | Backsplash Error 14034; handle design set to the rectangular handle after a combined change with the backsplash failed; no render |

Each run has one successful create and a saved nonempty 3,010 mm kitchen centred on the left wall: the fridge column, a drawer unit, oven with hob and hood, a base unit and the sink unit, three wall units. Both answers disclose the missing dark backsplash after the library rejects its generation (Error 14034) and name the open checks. Fronts and woods are approximate: olive green fronts and walnut-effect finishes.

- **The model call sequence.** Calls 1–3 as in 04: live context, image skill and kitchen skill; the kitchen planning reference; the create. Run 1 then looks up the backsplash attribute, enables it (the library cannot calculate it), renders, changes the sink model, reads the obstacles, renders again and answers — 10 calls. Run 2 looks up the attribute together with the obstacles, enables the backsplash together with a handle design (the whole change fails with the backsplash), sets the handle design alone and answers — 7 calls.
- **The render is the agent's choice.** The served text names the comparison of a planning from an image with that image as an occasion of a render; run 1 renders after each change, run 2 not at all. Both answers describe the kitchen against the photo.
- **Run 1 departs from the photo's order.** It puts the sink unit beside the oven unit and the base unit after it, then changes the sink to a left-hand basin to keep the drainer away from the hob. Run 2 keeps the order of the photo, as both runs of 04 did.
- **The create tool takes 1.962 / 2.108 s**, as in 04; the planner's own price refresh again runs alongside its planner operation.

## Proposed experiments and rejected conclusions

- The reasoning summaries do not fill the wait for the first output: they are the first output. What the window can show during that wait is a status the assistant sets itself when it sends a request, which needs no provider support. That is a change of proposal B, to be decided, not measured here.
- Whether a summary can stream while the model still reasons is not visible in these captures; with `'auto'`, the calls with a summary wait for their first output no less than in 04.
- The Azure deployment of gpt-6-astra is not measured: this series runs on direct OpenAI. Whether Azure accepts `reasoning.summary` is the open part of B's live check.
- Two repetitions per version give observed values and ranges, not p95 or isolated causality; the provider cache state and the agent's post-create choices differ between the runs.

## Measurement gaps and open work

- Create completion is a conservative loaded-plan milestone, not the first painted frame; a window update is the output part the window receives, not its painted frame.
- Provider queueing, prefill, reasoning, generation, network and kernel or render work are not separated.
- First visible text is the planning preamble; the start of the final answer is not captured separately.
- The summary tokens are not reported apart from the output tokens; their cost is not separable from the different post-create work of the runs.
- The planner dev server was started for this capture; 04 used the user's running server of the same checkout.

## The benchmark to repeat

Keep this fixture and digest, the direct provider, the key-variable reference and provider-default reasoning; use the local planner on :5173 and check that its checkout carries the code to measure. In `.temp/result/benchmark-05-iklw-oa-2026-10-27/`, `make-timing-runner.mjs` writes `timing-runner.mjs` from the current prompt runner, `run-reps.mjs` runs two repetitions with bounded retries on example port 3103, `analyze.mjs` derives the tables from `timeline.json`, `run.json`, `subprocess.json` and `plan-context.json`, `status.mjs` derives the status line from `timeline.json` (also of 04), and `compare.mjs` and `write-report.mjs` write the comparison values and this report. Start a fresh session for the next numbered report and preserve 01–05; extend the unnumbered comparison with its measurements. Follow [the timing skill](../skills/hi-mcp-timing-benchmark.md).

Verification: every model request pairs with a completed model call and its diagnostics bytes; every tool start pairs with an end; every planner call of a tool pairs with its call line; the interval accounting reconciles with the turn duration; both saved plans support the create; every request body carries the reasoning summary; the roomle-ui checkout stayed on 3956db258 through both runs.
