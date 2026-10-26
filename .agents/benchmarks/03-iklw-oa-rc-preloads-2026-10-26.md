# image-kitchen-left-wall: detailed OpenAI Astra timing — response chaining and preloads

| Field | Value |
|---|---|
| Type / domain | Benchmark / HI Planning Assistant |
| Trigger | Repeat image-kitchen-left-wall with live context and first-image guidance; RML-18303 |
| Date / author | 2026-10-26 / Codex |
| Status | Measured: two completed turns, two saved plans |
| Ticket | [RML-18303](https://roomle.atlassian.net/browse/RML-18303) |
| Data | Raw captures in ignored .temp/result/prompt-preloads-2026-10-26/rep-1 and rep-2; collectors/derived data in .temp/prompt-preloads-implementation/ |
| Repeat | Same fixture, direct OpenAI, local planner and embedding source; procedure below |
| PDF | .temp/prompt-preloads-implementation/03-iklw-oa-rc-preloads-2026-10-26.pdf |

Affected repositories:

- **roomle-ui:** assistant preloads/history and supplied-state instructions on feat/hi-mcp-performance, 5426d65c4845ba1371de92e48b49f8bb58c8a6b8.
- **roomle-hi-example:** example adoption, this report, indexes and the [three-report comparison](iklw-oa-rc-cmp-2026-10-26.md).

## Executive summary

First successful kitchen creation completed in **31.849 / 28.099 s** from assistant turn start; mean **29.974 s**. Complete turns took **55.708 / 53.009 s**; mean **54.359 s**. The turns used **8 / 8 model calls**. These are measured provider round trips, not isolated compute or a first painted GPU frame.

Both preloads arrived before the first inference. The current plan and image skill were no longer model-requested initial reads; kitchen guidance and its required reference still needed discovery. Mean full-turn time is **54.359 s**, compared with **53.601 s** in 02, and mean input is **730,936.5 tokens**, compared with **548,708.5**. Both new turns use eight model calls rather than six. **No overall completion-time improvement is established.** See the comparison for all three versions.

## What was asked and run

Test: **image-kitchen-left-wall**, from [docs/test-prompts.json](../../docs/test-prompts.json).

> create a kitchen like the one in the image on the left-hand wall of the room

Image: [kitchen-1.png](../../docs/images/kitchen-1.png), SHA-256 07a3fe7a8cb1f57f392f356cc52b8a2af78afe9e2ec4fe6e88a9a13e8b3b3d95. Starting plan: **ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv**, default-room. Two fresh browsers/conversations sent this exact prompt and original image. The suite suffix was omitted; no random cases, pacing or paid warm-ups were added.

| Setting | Measured value |
|---|---|
| Model CLI / key reference | openai:gpt-6-astra / $OPENAI_ASSISTANT_API_KEY; no resolved credentials in artifacts |
| Endpoint / reasoning | https://api.openai.com/v1/responses / provider default |
| Planner | http://localhost:5173/ from feat/hi-mcp-performance |
| Embedding imports | http://localhost:3001/src/hi.ts and /src/roomle-embedding-lib.ts |
| Example | http://localhost:3103/ |
| roomle-ui SHA | 5426d65c4845ba1371de92e48b49f8bb58c8a6b8 |
| roomle-hi-example SHA at capture | 9eeabb386a7ad617614adf192e1be921f9be2f9b |
| Source modifications | Source was committed; manifest retains source digests and repository patches |
| Node / Chromium | v22.23.3; Playwright 1.55.0 bundled Chromium, headless with GPU |
| First-call cache reads | 0 / 80,170 tokens; new browsers do not establish cold cache |
| Transport | Responses chaining; full first request, stored provider response plus new tool outputs thereafter |
| Published dev package | 0.0.0-dev-5426d65, [verified workflow](https://github.com/roomle-dev/roomle-ui/actions/runs/40379495687); benchmark uses local source |

## How it was measured

The scratch runner preserves the normal [prompt runner](../scripts/run-hi-mcp-prompt.js) collection. Temporary browser transforms validate every target and record epoch-based model, tool and nested planner boundaries. Existing diagnostics supply per-call duration, first output/text, bytes, digests and independently covered usage. Routing disables ordinary HTTP cache; instrumentation overhead is unquantified. Readiness catalog reads make in-turn acquisition warm.

The preflight used the real projected library/skill source with a mocked inference stream and **zero provider requests**. Text-only, first-image and later text turns retained one skill and one current snapshot, with identical library messages. A synthetic 100-group snapshot built from a real projected group measured **2,282,198 live-message bytes** and **28.7 ms** for the whole offline turn; it was not a physically loaded large scene or isolated serializer CPU measurement. The result shows substantial large-plan input overhead, not a universal low cost. All 100 groups were preserved and no write tools ran. Deterministic tests also preserve 1,000 groups. The published dev package passes the same offline lifecycle/size checks; its corresponding whole-turn probe takes 24.7 ms. Neither preflight makes paid requests.

Both paid repetitions completed without provider/chat errors, retries or snapshot failures. No repetition is excluded. The backsplash calculation failure is tool feedback, separate from chat success.

## How to read the step deltas

Start/End are seconds relative to assistant callback start. Delta is elapsed time, rounded to three decimals; elapsed-ms columns retain short call detail. Model duration includes transport/provider work and streaming. Tool wall time is the union of parallel intervals. Nested planner time is included in tool time; the remaining time includes forwarding, scheduling, projection and serialization, not isolated CPU assembly. SDK starts are derived from callback completion minus SDK duration. First output may be a tool call or reasoning; first visible text is separate. Runner start follows browser launch; subprocess time includes launch and shutdown.

### From skills to the first kitchen

Image-planning is supplied before inference; its real preload call is still measured. Initial skills complete when image and applicable kitchen main files are available; the later mandatory planning reference is a separate milestone.

| Milestone / interval | Run 1 s | Run 2 s |
|---|---|---|
| Initial image/kitchen SKILL.md complete (timestamp) | 5.310 | 3.550 |
| Last required reference complete (timestamp) | 17.438 | 13.464 |
| First create starts (timestamp) | 30.288 | 26.278 |
| First create completes (timestamp) | 31.849 | 28.099 |
| Initial main files → kitchen complete (delta) | 26.539 | 24.549 |
| All required files → kitchen complete (delta) | 14.410 | 14.635 |
| Model time in last interval | 12.849 | 12.812 |
| Create tool delta | 1.560 | 1.821 |
| Local remainder in last interval | 0.001 | 0.002 |

## Results: milestones and total time

| Measurement (seconds) | Run 1 | Run 2 | Mean |
|---|---|---|---|
| Page/library/assistant ready (recorded run start) | 6.210 | 5.612 | 5.911 |
| Combined warm bootstrap/reference measurement | 0.021 | 0.018 | 0.020 |
| First model output (turn start) | 4.745 | 2.974 | 3.859 |
| First visible text (turn start) | 24.476 | 20.166 | 22.321 |
| First kitchen completed (turn start) | 31.849 | 28.099 | 29.974 |
| First kitchen completed (recorded run start) | 38.275 | 33.891 | 36.083 |
| First kitchen completed (subprocess start) | 38.493 | 34.089 | 36.291 |
| Create tool alone | 1.560 | 1.821 | 1.690 |
| Turn start → answer complete | 55.708 | 53.009 | 54.359 |
| After first kitchen → answer complete | 23.860 | 24.911 | 24.385 |
| Runner chat phase | 55.945 | 53.216 | 54.581 |
| Post-chat context/images/snapshot | 6.519 | 5.481 | 6.000 |
| Recorded ready + chat + snapshot | 68.674 | 64.309 | 66.492 |
| Full subprocess | 69.136 | 64.756 | 66.946 |

## Results: where the assistant turn goes

| Component | Run 1 s | Run 1 share | Run 2 s | Run 2 share |
|---|---|---|---|---|
| Model calls (union) | 53.457 | 95.96% | 50.521 | 95.31% |
| Tools including bootstrap (union) | 2.228 | 4.00% | 2.463 | 4.65% |
| Model/tool overlap (subtract once) | 0.000 | 0.00% | 0.000 | 0.00% |
| Other client work/gaps | 0.023 | 0.04% | 0.026 | 0.05% |
| Assistant turn | 55.708 | 100.00% | 53.009 | 100.00% |

## Results: model, tools and planner calls in order

### Run 1

Recorded start: 2026-10-26T18:37:21.867Z; direct OpenAI Responses.

**Agent steps — duration per decision and tool execution**

| Step | Following tools/work | Start s | End s | Agent/model delta s | Tools delta s | Total step delta s |
|---|---|---|---|---|---|---|
| 1 | get-skill kitchen-planning | 0.026 | 5.310 | 5.282 | 0.001 | 5.283 |
| 2 | get-skill kitchen-planning / references/planning-reference.md | 5.312 | 17.438 | 12.126 | 0.000 | 12.127 |
| 3 | create-or-replace-groups | 17.439 | 31.849 | 12.849 | 1.560 | 14.410 |
| 4 | find-attributes | 31.852 | 35.816 | 3.951 | 0.013 | 3.964 |
| 5 | change-group-attribute | 35.817 | 41.380 | 5.401 | 0.161 | 5.563 |
| 6 | get-plan-context | 41.381 | 43.910 | 2.524 | 0.004 | 2.529 |
| 7 | get-plan-images | 43.910 | 46.812 | 2.430 | 0.471 | 2.902 |
| 8 | Final answer | 46.814 | 55.708 | 8.893 | 0.000 | 8.895 |

| Call | SDK start s | End s | Delta s (model) | First output s | Remaining s | Input tokens | Output / reasoning | Request bytes | Tools after model |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.026 | 5.309 | 5.282 | 4.718 | 0.564 | 80,173 | 22 / 0 | 615,365 | #3 get-skill |
| 2 | 5.312 | 17.438 | 12.126 | 11.492 | 0.634 | 84,027 | 220 / 188 | 63,742 | #4 get-skill |
| 3 | 17.439 | 30.288 | 12.849 | 7.037 | 5.812 | 87,291 | 646 / 124 | 58,888 | #5 create-or-replace-groups |
| 4 | 31.852 | 35.803 | 3.951 | 3.325 | 0.626 | 94,770 | 44 / 15 | 69,442 | #6 find-attributes |
| 5 | 35.817 | 41.218 | 5.401 | 4.679 | 0.722 | 94,985 | 55 / 0 | 44,254 | #7 change-group-attribute |
| 6 | 41.381 | 43.905 | 2.524 | 1.994 | 0.530 | 95,181 | 21 / 0 | 43,950 | #8 get-plan-context |
| 7 | 43.910 | 46.340 | 2.430 | 2.090 | 0.340 | 96,043 | 25 / 8 | 45,348 | #9 get-plan-images |
| 8 | 46.814 | 55.707 | 8.893 | 5.643 | 3.250 | 98,492 | 130 / 0 | 2,781,737 | Final answer |

| Call | Tool / requested information | Start s | End s | Delta s (tool) | Elapsed ms | Nested planner ms | Remaining ms | Result bytes | Outcome |
|---|---|---|---|---|---|---|---|---|---|
| 1 | get-skill: image-planning / SKILL.md | 0.000 | 0.013 | 0.013 | 12.9 | 0.0 | 12.9 | 5,658 | OK |
| 2 | get-plan-context: articles, attributes, rooms, groups, obstacles, installationElements | 0.001 | 0.017 | 0.017 | 16.6 | 8.9 | 7.7 | 276,208 | OK |
| 3 | get-skill: kitchen-planning / SKILL.md | 5.309 | 5.310 | 0.001 | 0.5 | 0.0 | 0.5 | 20,247 | OK |
| 4 | get-skill: kitchen-planning / references/planning-reference.md | 17.438 | 17.438 | 0.000 | 0.3 | 0.0 | 0.3 | 15,393 | OK |
| 5 | create-or-replace-groups: Create kitchen; placement left wall | 30.288 | 31.849 | 1.560 | 1560.2 | 1407.0 | 153.2 | 25,947 | OK |
| 6 | find-attributes: find-attributes | 35.803 | 35.816 | 0.013 | 13.1 | 7.9 | 5.2 | 759 | OK |
| 7 | change-group-attribute: change-group-attribute | 41.219 | 41.380 | 0.161 | 161.2 | 155.0 | 6.2 | 470 | Tool error |
| 8 | get-plan-context: obstacles | 43.905 | 43.910 | 0.004 | 4.4 | 3.7 | 0.7 | 1,853 | OK |
| 9 | get-plan-images: get-plan-images | 46.341 | 46.812 | 0.471 | 471.4 | 440.5 | 30.9 | 2,738,222 | OK |

| Call | Parent tool | Planner method / arguments | Start s | End s | Delta s (planner) | Elapsed ms |
|---|---|---|---|---|---|---|
| 1 | 2 | getExternalObjectPlanContext [["rooms","groups","obstacles","installationElements"]] | 0.002 | 0.011 | 0.009 | 8.9 |
| 2 | 2 | getExternalObjectLibraryContext [["articles","masterData"]] | 0.002 | 0.010 | 0.008 | 7.8 |
| 3 | 5 | getExternalObjectPlanContext [["groups"]] | 30.289 | 30.289 | 0.000 | 0.1 |
| 4 | 5 | externalObjectGroupOperation ["create-or-replace-groups"] | 30.290 | 31.690 | 1.401 | 1400.9 |
| 5 | 5 | getExternalObjectPlanContext [["groups"]] | 31.691 | 31.697 | 0.006 | 6.0 |
| 6 | 6 | getExternalObjectPlanContext [["groups"]] | 35.803 | 35.811 | 0.008 | 7.9 |
| 7 | 6 | getExternalObjectLibraryContext [["masterData"]] | 35.803 | 35.810 | 0.007 | 6.8 |
| 8 | 7 | getExternalObjectPlanContext [["groups"]] | 41.221 | 41.236 | 0.016 | 15.8 |
| 9 | 7 | externalObjectGroupOperation ["change-group-attribute"] | 41.237 | 41.376 | 0.139 | 139.2 |
| 10 | 8 | getExternalObjectPlanContext [["obstacles","rooms"]] | 43.906 | 43.909 | 0.004 | 3.7 |
| 11 | 9 | getExternalObjectSnapshot [{"perspectiveObjectImage":true,"topImage":true,"keepOpenGeometry":true}] | 46.342 | 46.783 | 0.441 | 440.5 |

**Individual HTTP requests — UTF-8 serialized JSON body bytes**

| Attempt | SDK step | Fetch start s | Fetch → headers s | Request bytes | New input bytes | Repeated input bytes | Input bytes | Tools bytes | Envelope bytes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | 0.039 | 2.171 | 615,365 | 572,037 | 0 | 572,037 | 43,246 | 82 |
| 2 | 2 | 5.313 | 1.151 | 63,742 | 20,324 | 0 | 20,324 | 43,246 | 172 |
| 3 | 3 | 17.440 | 1.229 | 58,888 | 15,470 | 0 | 15,470 | 43,246 | 172 |
| 4 | 4 | 32.118 | 1.095 | 69,442 | 26,024 | 0 | 26,024 | 43,246 | 172 |
| 5 | 5 | 35.817 | 0.911 | 44,254 | 836 | 0 | 836 | 43,246 | 172 |
| 6 | 6 | 41.386 | 1.216 | 43,950 | 532 | 0 | 532 | 43,246 | 172 |
| 7 | 7 | 43.914 | 0.897 | 45,348 | 1,930 | 0 | 1,930 | 43,246 | 172 |
| 8 | 8 | 46.843 | 3.399 | 2,781,737 | 2,738,319 | 0 | 2,738,319 | 43,246 | 172 |

### Run 2

Recorded start: 2026-10-26T18:38:30.984Z; direct OpenAI Responses.

**Agent steps — duration per decision and tool execution**

| Step | Following tools/work | Start s | End s | Agent/model delta s | Tools delta s | Total step delta s |
|---|---|---|---|---|---|---|
| 1 | get-skill kitchen-planning | 0.023 | 3.550 | 3.525 | 0.000 | 3.526 |
| 2 | get-skill kitchen-planning / references/planning-reference.md | 3.551 | 13.464 | 9.911 | 0.001 | 9.912 |
| 3 | create-or-replace-groups | 13.465 | 28.099 | 12.812 | 1.821 | 14.634 |
| 4 | find-attributes | 28.100 | 31.733 | 3.619 | 0.013 | 3.633 |
| 5 | change-group-attribute | 31.733 | 35.635 | 3.759 | 0.141 | 3.901 |
| 6 | get-plan-context | 35.635 | 38.938 | 3.292 | 0.009 | 3.303 |
| 7 | get-plan-images | 38.939 | 42.734 | 3.332 | 0.462 | 3.795 |
| 8 | Final answer | 42.735 | 53.009 | 10.269 | 0.000 | 10.274 |

| Call | SDK start s | End s | Delta s (model) | First output s | Remaining s | Input tokens | Output / reasoning | Request bytes | Tools after model |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.023 | 3.549 | 3.525 | 2.951 | 0.575 | 80,173 | 22 / 0 | 615,365 | #3 get-skill |
| 2 | 3.551 | 13.463 | 9.911 | 9.260 | 0.651 | 84,027 | 228 / 196 | 63,742 | #4 get-skill |
| 3 | 13.465 | 26.277 | 12.812 | 6.700 | 6.112 | 87,299 | 631 / 101 | 58,888 | #5 create-or-replace-groups |
| 4 | 28.100 | 31.719 | 3.619 | 2.736 | 0.883 | 94,769 | 20 / 0 | 69,442 | #6 find-attributes |
| 5 | 31.733 | 35.492 | 3.759 | 3.159 | 0.600 | 94,960 | 56 / 0 | 44,254 | #7 change-group-attribute |
| 6 | 35.635 | 38.928 | 3.292 | 2.914 | 0.378 | 95,157 | 36 / 13 | 43,950 | #8 get-plan-context |
| 7 | 38.939 | 42.271 | 3.332 | 2.773 | 0.559 | 96,037 | 28 / 11 | 45,348 | #9 get-plan-images |
| 8 | 42.735 | 53.005 | 10.269 | 6.834 | 3.435 | 98,489 | 145 / 0 | 2,689,805 | Final answer |

| Call | Tool / requested information | Start s | End s | Delta s (tool) | Elapsed ms | Nested planner ms | Remaining ms | Result bytes | Outcome |
|---|---|---|---|---|---|---|---|---|---|
| 1 | get-skill: image-planning / SKILL.md | 0.000 | 0.012 | 0.012 | 12.0 | 0.0 | 12.0 | 5,658 | OK |
| 2 | get-plan-context: articles, attributes, rooms, groups, obstacles, installationElements | 0.001 | 0.015 | 0.015 | 15.0 | 8.1 | 6.9 | 276,208 | OK |
| 3 | get-skill: kitchen-planning / SKILL.md | 3.549 | 3.550 | 0.000 | 0.4 | 0.0 | 0.4 | 20,247 | OK |
| 4 | get-skill: kitchen-planning / references/planning-reference.md | 13.463 | 13.464 | 0.001 | 0.6 | 0.0 | 0.6 | 15,393 | OK |
| 5 | create-or-replace-groups: Create kitchen; placement left wall | 26.278 | 28.099 | 1.821 | 1820.7 | 1624.9 | 195.8 | 25,947 | OK |
| 6 | find-attributes: find-attributes | 31.719 | 31.733 | 0.013 | 13.4 | 8.0 | 5.4 | 759 | OK |
| 7 | change-group-attribute: change-group-attribute | 35.493 | 35.635 | 0.141 | 141.1 | 134.7 | 6.4 | 470 | Tool error |
| 8 | get-plan-context: obstacles | 38.929 | 38.938 | 0.009 | 9.4 | 7.4 | 2.0 | 1,853 | OK |
| 9 | get-plan-images: get-plan-images | 42.272 | 42.734 | 0.462 | 461.9 | 430.0 | 31.9 | 2,646,290 | OK |

| Call | Parent tool | Planner method / arguments | Start s | End s | Delta s (planner) | Elapsed ms |
|---|---|---|---|---|---|---|
| 1 | 2 | getExternalObjectPlanContext [["rooms","groups","obstacles","installationElements"]] | 0.001 | 0.010 | 0.008 | 8.1 |
| 2 | 2 | getExternalObjectLibraryContext [["articles","masterData"]] | 0.002 | 0.009 | 0.007 | 7.0 |
| 3 | 5 | getExternalObjectPlanContext [["groups"]] | 26.281 | 26.282 | 0.001 | 0.8 |
| 4 | 5 | externalObjectGroupOperation ["create-or-replace-groups"] | 26.282 | 27.900 | 1.618 | 1617.6 |
| 5 | 5 | getExternalObjectPlanContext [["groups"]] | 27.900 | 27.906 | 0.006 | 6.5 |
| 6 | 6 | getExternalObjectPlanContext [["groups"]] | 31.720 | 31.728 | 0.008 | 8.0 |
| 7 | 6 | getExternalObjectLibraryContext [["masterData"]] | 31.720 | 31.727 | 0.007 | 6.9 |
| 8 | 7 | getExternalObjectPlanContext [["groups"]] | 35.496 | 35.510 | 0.014 | 14.0 |
| 9 | 7 | externalObjectGroupOperation ["change-group-attribute"] | 35.510 | 35.631 | 0.121 | 120.7 |
| 10 | 8 | getExternalObjectPlanContext [["obstacles","rooms"]] | 38.930 | 38.937 | 0.007 | 7.4 |
| 11 | 9 | getExternalObjectSnapshot [{"perspectiveObjectImage":true,"topImage":true,"keepOpenGeometry":true}] | 42.273 | 42.703 | 0.430 | 430.0 |

**Individual HTTP requests — UTF-8 serialized JSON body bytes**

| Attempt | SDK step | Fetch start s | Fetch → headers s | Request bytes | New input bytes | Repeated input bytes | Input bytes | Tools bytes | Envelope bytes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | 0.035 | 1.407 | 615,365 | 572,037 | 0 | 572,037 | 43,246 | 82 |
| 2 | 2 | 3.553 | 0.868 | 63,742 | 20,324 | 0 | 20,324 | 43,246 | 172 |
| 3 | 3 | 13.466 | 1.150 | 58,888 | 15,470 | 0 | 15,470 | 43,246 | 172 |
| 4 | 4 | 28.164 | 1.150 | 69,442 | 26,024 | 0 | 26,024 | 43,246 | 172 |
| 5 | 5 | 31.734 | 1.199 | 44,254 | 836 | 0 | 836 | 43,246 | 172 |
| 6 | 6 | 35.640 | 0.992 | 43,950 | 532 | 0 | 532 | 43,246 | 172 |
| 7 | 7 | 38.940 | 1.135 | 45,348 | 1,930 | 0 | 1,930 | 43,246 | 172 |
| 8 | 8 | 42.763 | 3.089 | 2,689,805 | 2,646,387 | 0 | 2,646,387 | 43,246 | 172 |

## Usage, preloads and saved plans

| Measurement | Run 1 | Run 2 |
|---|---|---|
| Model calls | 8 | 8 |
| Request bytes (turn total) | 3,722,726 | 3,630,794 |
| Repeated serialized input bytes (turn total) | 0 | 0 |
| Input tokens | 730,962 | 730,911 |
| Output / reasoning tokens | 1,163 / 335 | 1,166 / 321 |
| Cache read / coverage | 632,449 / complete | 716,425 / complete |
| Cache write / coverage | 98,489 / complete | 14,462 / complete |
| Shared reference bytes | 295,440 | 295,440 |
| Shared reference SHA-256 | 89099a5468544e0b47bf6665d039f1a4a9a6fd030cea84c58d09353320b7ad9a | 89099a5468544e0b47bf6665d039f1a4a9a6fd030cea84c58d09353320b7ad9a |
| Live snapshot message-array bytes | 5,710 | 5,710 |
| Image-skill message-array bytes | 5,690 | 5,690 |
| Saved snapshot | ps_syl3rw0nyi91yy7uveo92padocxjq9v | ps_sylgwlz94sv7s3ohgov7pqiu1sjt5tw |

Library, live snapshot and skill are different measurements. The preload byte counters serialize their labelled message arrays; the tool tables measure MCP result JSON including wrappers. Neither is an exact added HTTP-byte or token estimate. A combined context read does not expose independent library/plan CPU time. Request-byte reduction does not remove earlier context from chained model usage.

## Findings and plan verification

| Run | Position / rotation | Kitchen width mm | Article IDs (non-generated) | Outcome / limits |
|---|---|---|---|---|
| 1 | [-685,-240,0] / 90° | 3010 | HK260, USTB60, UHS60, UTB60, SUT60, OTB60, DU, OTB60, OTB60 | Backsplash Error 14034; see interpretation below |
| 2 | [-685,-240,0] / 90° | 3010 | HK260, USTB60, UHS60, UTB60, SUT60, OTB60, DU, OTB60, OTB60 | Backsplash Error 14034; see interpretation below |

Each run has one successful create and a saved nonempty kitchen on the left wall. Plan context, object-perspective/top views and saved XML/order data support the creation milestone. Both answers disclose the missing dark backsplash after the library rejects generation with Error 14034 / tab_GrainDirectionSettings. Appliance/front/handle/wood matches remain approximate; the photo is not reproduced exactly. The backsplash finding stays separate from prompt/transport timing.

## Proposed experiments and rejected conclusions

- Both preloads are present before inference. Kitchen main guidance and its mandatory reference remain on demand; inspect actual model calls before claiming a removed round.
- This two-repetition combined variant cannot isolate each preload's effect. The analysis's optional current/context-only/image-only/both experiment would require a separately scoped measurement.
- Large live snapshots add input on every accepted turn, including read-only requests. The synthetic probe establishes size/assembly overhead only; provider latency/token effects for a physically populated large scene remain unmeasured.
- Library computation and local read memoization are not established model-latency remedies by these captures. No numerical saving is extrapolated from local tool milliseconds.

## Measurement gaps and open work

- Create completion is a conservative loaded-plan milestone, not first painted frame.
- Provider queueing, prefill, reasoning, generation, network and kernel/render work are not separately isolated.
- First visible text may be a planning preamble; final-answer start is not separately captured.
- Browser routing and logging add unquantified overhead; catalog readiness warms reads and provider cache states differ across versions.
- Two repetitions describe observed values, not p95 or isolated causality. Source instructions/tool descriptions change alongside preloads.
- Full repository lint is not green: the UI TypeDoc check reports 22 warnings treated as errors, while SDK TypeDoc reports errors in image-renderer.ts:156 and bun-webgpu/structs_ffi.ts:703. Identical findings reproduce on a clean branch-base checkout with unchanged package-lock/dependencies. Changed-package tests, types/code checks, formatting and build pass.

## The benchmark to repeat

Preserve this fixture/digest, direct provider, key-variable reference and provider-default reasoning. Use the same local planner/embedding source selection; --dev alone selects only the planner. Start a fresh session with the next numbered report and preserve 01/02/03. Keep the unnumbered comparison and add actual measurements there. Follow [the timing skill](../skills/hi-mcp-timing-benchmark.md) and [local embedding setup](../../docs/setup/unreleased-embedding-lib.md).

Raw captures and scratch collectors remain in .temp. Verification pairs every model request/callback, forwarded tool and nested planner call; interval accounting and per-request input/tools/envelope totals reconcile. Saved plans support each create. Both report PDFs are generated from their final Markdown.
