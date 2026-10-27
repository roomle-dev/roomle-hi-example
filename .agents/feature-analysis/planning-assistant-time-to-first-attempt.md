# Planning Assistant: the time to the first attempt

> **Type**: Feature analysis — the ticket's performance ideas evaluated, and how to proceed
> **Status**: Open — proposal D implemented on `feat/hi-mcp-performance` (roomle-ui 43eda3a47,
> not deployed; [§10](#10-implementation-state)); A, B, C, E and F open
> **Date**: 2026-10-27
> **Ticket**: [RML-18303](https://roomle.atlassian.net/browse/RML-18303)
> **Base**: roomle-hi-example `master` at 9ec622e with `@roomle/embedding-lib@0.0.0-dev-130245d`
> (roomle-ui `feat/hi-mcp-merge` at 130245dbd); the planner of `release/bo-test`
> **Data**: the "test the mcp" session `.temp/result/mcp-test-2026-10-27_07-11-41` (gpt-6-astra on
> Azure, 79 runs, no request pacing), the benchmark series
> [01](../benchmarks/01-iklw-oa-orig-2026-10-26.md) / [02](../benchmarks/02-iklw-oa-rc-2026-10-26.md) /
> [03](../benchmarks/03-iklw-oa-rc-preloads-2026-10-26.md) and
> [their comparison](../benchmarks/iklw-oa-rc-cmp-2026-10-26.md), the
> [shared-reference benchmark](../benchmarks/planning-assistant-prompt-caching.md)

## Affected repositories

- **roomle-ui** — the served text of `get-skill` and the skill reading (`hi-mcp/skills.ts`,
  `hi-mcp-server.ts`); the planning assistant's stream handling and provider options
  (`hi-planning-assistant.ts`) with the status of the chat window; the plan images of
  `get-plan-images` (`tool-executors.ts`); the library context cache (`hi-library-context.ts`).
- **roomle-hi-example** — this analysis, a benchmark 04 per measured step, the "First result"
  column of the test reports as the standing metric.
- **ligna-store** — no change; it gets every improvement with the planner and the embedding-lib.

## 1. What was asked

The ticket lists ideas to cut the token usage and the response time of the Planning Assistant:
prompt caching, the plan context and the image-planning skill added to the prompt automatically,
scaled-down input and plan images, tool memoization, precalculated docking vectors, attribute
indexing and selective retrieval. Some are evaluated and implemented, some are not. The complaint
behind the ticket is the wall-clock time: the assistant is far too slow, above all until the first
attempt appears in the plan when a complete kitchen is planned from a prompt or from an image.

This analysis answers three questions: where the ticket's ideas stand, where the time to the first
attempt goes today, and which changes shorten it, in which order. It changes no productive code
and makes no model run; every number comes from retained runs.

## 2. The ticket's ideas, evaluated

| Idea | State | Evidence | Verdict |
|---|---|---|---|
| Prompt caching | Implemented: the shared reference prefix ([ADR 0014](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/the-planning-assistant-uses-a-shared-reference-prefix.md)), the optional Azure cache boundary, Responses chaining ([prompt-caching.md](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/prompt-caching.md)) | The first call of a fresh conversation reads 74,806 of its 77,193 input tokens from the cache; it still waits 2.8–10 s for its first output ([§4](#4-where-the-time-to-the-first-attempt-goes)) | Done. The prefill is not where the time goes: a round costs about 3.5 s even with an empty answer |
| The plan context added to every prompt | Evaluated and rejected ([ADR 0015](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/keep-live-plan-state-and-image-guidance-on-demand.md), [benchmark 03](../benchmarks/03-iklw-oa-rc-preloads-2026-10-26.md)) | 8 instead of 6 model calls, a third more input tokens, the first kitchen still at call 3 | Closed |
| The image-planning skill added to the first image prompt | Evaluated and rejected (ADR 0015) | Same measurement: the kitchen skill and its reference still take two rounds | Closed |
| Scale down the input image | Implemented: the chat window redraws a dropped image as a JPEG with the long side at most 1568 px (`prepareImage`, roomle-ui `planning-assistant-image.ts`); the test runner does the same | The test image arrives as 1568 × 1276 px, 198,683 bytes, about 2,000 input tokens of 77,000 | Done. A smaller image saves nothing measurable and loses what the model reads |
| Scale down the plan images | Implemented as proposal D on `feat/hi-mcp-performance` ([§10](#10-implementation-state)) | `get-plan-images` answers 2,738,222 bytes: two PNG renders at 1024 px, 509 KB and 1.56 MB; the request that carries them takes 3.4 s to its response headers, the others about 1 s. As JPEG the pair is 194,960 bytes | [Proposal D](#d-plan-images-as-jpeg): after the first attempt, not before it |
| Tool memoization | Open | The read tools answer in 0.3–13 ms, an attribute change in about 0.16 s, the renders in 0.4–0.5 s, the create in 1.2–1.8 s; no tool is called twice with the same input in a turn, and a later turn finds the result in its history | Rejected: nothing to save |
| Precalculated docking vectors | Open: the planner compacts the library context on every read (ADR 0013) | 12–20 ms warm, 0.7 s on the first read after the library load | [Proposal F](#f-keep-the-compacted-library-context): the backlog item, worth its 0.7 s only on the first prompt of a page |
| Attribute indexing | Open | `find-attributes` answers in 13 ms, and no kitchen creation calls it since the vocabulary is in the plan context | Rejected: nothing to save |
| Selective retrieval (RAG) | Open | The input size costs about 13 ms per 1,000 tokens ([kitchen-from-image-time.md](../benchmarks/kitchen-from-image-time.md)), 97 % of the prefix is read from the cache, and a per-request selection would break the shared prefix and add a step | Rejected for the response time; reconsider when a library outgrows the prefix |

## 3. How a kitchen comes about today

The planning assistant of the embedding-lib (`startPlanningAssistant`,
`packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts`) acquires the compact
library reference (articles and attributes, 270,617 bytes) at the start of every user turn and
sends it before the history and the user message; the tool schemas (43,246 bytes) go with every
call. The system prompt (roomle-ui `hi-agent-prompts.ts`) asks the model to read the live plan
sections and to follow the skill of the request before it plans: `kitchen-planning` for a kitchen,
`image-planning` for an image. The kitchen skill (`hi-mcp/skills/kitchen-planning/SKILL.md`,
19,280 bytes) asks on its line 14 to read `references/planning-reference.md` (15,247 bytes) before
any numerical guidance; the source catalog stays optional. Every file is one `get-skill` call.

Every kitchen creation of the session therefore runs the same three rounds before the plan changes:

| Round | Text prompt | Image prompt |
|---|---|---|
| 1 | `get-plan-context` (live sections) and `get-skill kitchen-planning` | the same plus `get-skill image-planning`, all in one call |
| 2 | `get-skill kitchen-planning references/planning-reference.md` | the same |
| 3 | `create-or-replace-groups` | the same |

After the create, every one of the ten kitchen runs reads the plan context again, renders the two
plan images, tries the backsplash where the image shows one (the library cannot calculate it:
[library issue 10](../backlog/library-issues.md#10-backsplashes-the-library-cannot-calculate)) and
writes the answer. The image-only run with tall units needs no kitchen skill and creates at
call 2, after 16.6 s.

## 4. Where the time to the first attempt goes

The "First result" of a test report is the time from the prompt to the first change of the plan in
the planner ([test-prompts.md](../../docs/test-prompts.md), `planning-time.js`). The ten kitchen
creations of the session, gpt-6-astra on Azure, with the model calls up to the create:

| Run | First result s | Turn s | Call 1 s | Call 2 s | Create call s (first output after) | Create output / reasoning tokens |
|---|---|---|---|---|---|---|
| 44 Oven, hood, sink, fridge in the corner | 44.0 | 58.3 | 10.0 | 3.6 | 27.1 (19.6) | 1,043 / 499 |
| 50 Kitchen in the back right corner | 41.7 | 67.2 | 2.8 | 2.8 | 33.6 (23.1) | 1,189 / 516 |
| 51 Oven, fridge, sink in the corner | 36.7 | 60.9 | 6.6 | 2.9 | 24.8 (15.1) | 966 / 339 |
| 52 Full kitchen, walnut, dark marble, corner | 31.7 | 45.2 | 3.2 | 3.9 | 22.2 (13.9) | 876 / 333 |
| 68 Image: kitchen on the left-hand wall | 36.4 | 72.2 | 5.5 | 11.7 | 17.6 (8.8) | 725 / 178 |
| 69 Image: kitchen in the back right corner | 42.6 | 58.2 | 7.6 | 12.7 | 19.8 (11.8) | 779 / 218 |
| 70 Image: planning on the right-hand wall | 53.3 | 88.5 | 5.1 | 28.1 | 17.1 (7.0) | 898 / 141 |
| 72 Image only, no text | 62.7 | 93.3 | 3.6 | 15.0 | 27.8 (19.5) | 910 / 335 |
| 73 Image: tall units in the back right corner | 43.7 | 80.7 | 4.3 | 21.1 | 15.2 (6.7) | 699 / 97 |
| 67 Image only: tall units (no kitchen skill) | 16.6 | 53.5 | 3.8 | 11.8 = the create (7.3) | — | 397 / 124 |

Run 71 (image only, no text) is left out of the pattern: its first call took 65.2 s for 79 output
tokens, a provider stall, and its first result came after 112.6 s.

What the table shows:

1. **The create call is the biggest block**: 15–34 s, of which the wait for its first output is
   7–23 s. That wait is the model's reasoning: 333–516 reasoning tokens in the text creations.
   The payload the model then streams is compact — 390–500 tokens for 12–16 root modules, 31–45
   tokens per root — so about half of the create's output tokens are reasoning, the rest the
   payload and a sentence of text.
2. **The two rounds before it cost 7–14 s in a text creation**: the calls answer with 30–62 output
   tokens and no reasoning; their time is the fixed price of a round. In an image creation the
   second round costs 12–28 s, because the model analyses the image and the reference there
   (192–491 reasoning tokens).
3. **The user sees no text for 15–33 s**: the first visible text comes with the create call of a
   text creation, with the reference call or the create call of an image creation; the window's
   status names a tool only once its input is complete.

The step cost over the 411 model calls of the session:

| Measure | Value |
|---|---|
| Wait for the first output: median / p90 / p95 | 3.1 s / 8.1 s / 12.3 s |
| Calls with at most 100 output tokens (285): response time median / p90 | 3.5 s / 6.1 s |
| Calls with at least 500 output tokens (17): first output / response time, median | 13.9 s / 21.1 s |
| Streaming after the first output | about 10 s per 1,000 output tokens |

The OpenAI-direct series says the same with the local planner: benchmark 02 creates the kitchen
after 29.6 and 32.0 s with the same three rounds (3.8–5.9 s, 12.5–13.7 s, 10.8–12.4 s plus the
create tool's 1.2–1.5 s). Response chaining took the repeated uploads out of the later calls, and
the shared prefix made the first call's prefill cheap; neither touches the number of rounds or the
reasoning inside a call.

## 5. The gap

The time to the first attempt is three model rounds and the reasoning of the create call. The
fixed price of a round is about 3.5 s; the reasoning before the payload is 7–23 s; the payload
streams in 4–6 s; the planner builds the kitchen in 1.2–1.8 s. Nothing the tools or the planner
do is on that path for more than two seconds. So the levers are: fewer rounds before the create,
less to decide in the create call, and something to look at while the model thinks.

## 6. Proposed improvements

Savings are per creation, estimated from the step cost of [§4](#4-where-the-time-to-the-first-attempt-goes);
the benchmark of [§7](#7-how-to-proceed) measures them.

### A. One skill round: the mandatory reference served with the skill

**What changes.** `get-skill` answers `SKILL.md` together with the reference files the skill asks
to read before planning (the planning reference), under their own headings; the source catalog and
any other file stay on demand through `file`. The description of `get-skill` says so. The skill files
stay as their authors deliver them (D75 of [hi-tools-behaviour.md](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#3-decisions)):
the bundle is the tool's doing, in `readSkillFile` of roomle-ui `hi-mcp/skills.ts`, and the
session preamble stays in front.

**What it saves.** One round before every kitchen and living-room creation: 3–4 s in a text
creation, 3–6 s in an image creation. The reasoning the model does in the reference round moves into
the create call; the bundle does not remove it. The image-only tall-unit run, which needs no kitchen
skill, shows the shape: the create at call 2.

**Alternative.** The skill index in the description names the required files, so that the model
requests both files in one round. It depends on the model doing so; the bundle is deterministic.

**Rejected.** The skills in the shared prefix: measured as variant C of the
[shared-reference benchmark](../benchmarks/planning-assistant-prompt-caching.md#content-variant-results-and-decision)
— fewer calls in the creations, but a larger input on every edit turn and no overall gain (ADR 0014).

### B. Progress in the window while the model thinks

**What changes.** The planning assistant emits the `activity` part at `tool-input-start`, which
the AI SDK streams when the model starts writing a tool call, instead of at `tool-call`, which
comes when the input is complete (`hi-planning-assistant.ts`, the stream handling). The window then
says "Building the kitchen" while the payload streams, 4–6 s before the kitchen appears. Where the
provider streams reasoning summaries (the `reasoningSummary` option of the OpenAI Responses adapter,
which the Azure adapter shares; `reasoning-delta` parts), the assistant passes them as a status, so the window shows what the model
is doing during the 7–23 s of reasoning; the chat window shows the status in its working line
(`planning-assistant-store.ts`, `PlanningAssistantChat.vue`).

**What it saves.** Nothing on the clock; it is the perceived latency. Today the window shows
"working" with the name of the last completed tool for up to 30 s.

**Cost and risk.** Summary tokens are output tokens, a few hundred per turn. Whether the Azure
deployments stream summaries is to verify; without them the status falls back to the activity.

### C. Less to decide in the create call

The reasoning before the payload is the largest block and the model's own. Two levers:

- **The reasoning effort** is the direct one; it is decided in
  [RML-18043](https://roomle.atlassian.net/browse/RML-18043), not here. The gpt-6-astra deployment
  runs at the provider's default (`FOUNDRY_DEPLOYMENTS`, `start.mjs`).
- **A worked example of a create payload** in the served text — a one-row kitchen with its
  relations, placement and group attributes, with placeholder article ids so the text stays
  library-neutral ([§2.4](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#24-instructions)).
  A model that can copy a shape reasons about the content only. The gain is unknown; it is an
  experiment with the benchmark of §7, and it is dropped if the measurement shows nothing.

The payload itself is already compact (31–45 tokens per root); a terser schema would save a second
or two of streaming at the price of a tool API change for every client — not proposed.

### D. Plan images as JPEG

**What changes.** `get-plan-images` answers its two renders as JPEG with the long side at most
1024 px (`tool-executors.ts`, re-encoded in the planner frame as `prepareImage` does for the input
image; or a format option of `getExternalObjectSnapshot`). The saved snapshot keeps its PNGs.

**What it saves.** About 2.4 MB per images call and about 2 s on the request that carries them;
the image tokens the model pays barely change (the two renders add about 2,400 input tokens
today). On the providers without response chaining the saving repeats with every later call of the
turn, and the Mistral overflow of the backlog item "Images of a tool result for Mistral" shrinks
with it. After the first attempt, not before it.

**State.** Implemented on `feat/hi-mcp-performance`; the format is chosen in the renderer, not
re-encoded in the tool ([§10](#10-implementation-state)).

### E. The rounds after the create

Every kitchen run of the session renders the plan images once after the create and reads the
context again; the answer comes 20–40 s after the first result. The authoring rules say to verify
the result numerically and not to judge a position from a rendering alone, and nothing says when
a render is due. A candidate for the served text: render only when the user asks to see the plan,
when a correction reports a conflict, or to compare a planning with the image it comes from. It
saves a round and the heavy final request in a text creation, about 5 s of planning time; it does
not change the first result. It is measured by the planning-time column of the suite, and it stays
out if the answers get worse.

### F. Keep the compacted library context

The backlog item of the planner ([Caching the library context](../backlog/README.md#planner-roomle-ui-roomlecore)):
keep the compacted context from the library load until the next catalog load
(`hi-library-context.ts`). It saves the 0.7 s of the first read after the load, once per page, in a
host without the test runner's warm-up read — the ligna-store. Cheap; it does nothing for the
later prompts.

### Not proposed

| Idea | Why not |
|---|---|
| The preloads of benchmark 03 again | ADR 0015: they add a lifecycle and no round goes away while the skill still takes two |
| A first partial kitchen (the base row first, the rest in a second call) | One more round (about 3.5 s) and a second group that must dock onto the first; the first attempt would be a half kitchen |
| Streaming the tool input into the planner while the model still writes | The group is laid out from its relations; a partial group cannot be built, and the planner's create takes 1.5 s of the 30 |
| A watchdog that resends a call without a first output after a limit | The p95 of the wait is 12 s, one call of 411 stalled for 65 s; a resend doubles the cost of a legitimate long reasoning. Measure the tail over more sessions first |
| Another model | Out of scope here; the measurement protocol of §7 works for any |

## 7. How to proceed

In this order, one build per step, each step measured before the next:

1. **B** — no model cost, no measurement needed beyond the window: the user sees progress from the
   first seconds. An embedding-lib change; the build is asked for.
2. **A** with a **benchmark 04**: `image-kitchen-left-wall` and `full-kitchen-walnut-marble-corner`,
   two repetitions each, `openai:gpt-6-astra` with the local planner as in reports 01–03, about five
   minutes and 2.5 million input tokens; the report in `.agents/benchmarks/04-…` and a row in the
   comparison. Accept A when the create comes at call 2 and the first kitchen is earlier.
3. **D** and **F** — small planner changes, verified with the minimum set of "test the mcp": the
   first-result and planning-time columns, and the images' bytes in the runs. D is implemented and
   measured without a model ([§10](#10-implementation-state)); its model run is open.
4. **E** as an instruction change measured by the full suite's planning times and verdicts.
5. **C** — the worked example as an experiment on the benchmark of step 2; the reasoning effort in
   RML-18043.

The standing metric is the **First result** column of every "test the mcp" report. The baseline is
the session `mcp-test-2026-10-27_07-11-41`: text kitchens 31.7–44.0 s, image kitchens 36.4–62.7 s.
A and F take the sure seconds; whether the first attempt gets under 20 s depends on the reasoning
of the create call, which only C changes.

## 8. Code and documents the work would touch

| Repository | Code | Documents |
|---|---|---|
| roomle-ui | `hi-mcp/skills.ts` (`readSkillFile`), the `get-skill` registration in `hi-mcp-server.ts`, `__tests__/hi-mcp/skills-test.ts`, `hi-mcp-server-test.ts`, `test-helpers/unit/hi-mcp-fixture.json` (A); `packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts` (stream parts, provider options), `src/common/store/planning-assistant-store.ts`, `PlanningAssistantChat.vue` and their tests (B); `hi-mcp/tool-executors.ts` or `planner-core/src/roomle-planner.ts` (D); `hi-library-context.ts` (F); the served rules in `hi-mcp-server.ts` (C, E) | `.agents/homag-intelligence/hi-tools-behaviour.md` (a decision row per change), `hi-tools-reference.md`, `agent-architecture.md`, `prompt-caching.md` |
| roomle-hi-example | the benchmark 04 session and report; `minimal-hi-example/index.html` for a new embedding-lib pin | this analysis; `.agents/skills/hi-mcp-tools.md` (`get-skill`), `docs/ai-chat.md` (the status of the window), `.agents/benchmarks/README.md`, the backlog rows of the accepted steps |

## 9. Measurement gaps

- The wait for the first output of a call combines provider queueing, prefill and reasoning; the
  three cannot be separated from the retained data. The reasoning tokens show that the wait of the
  create call is reasoning for the most part, not that it is reasoning alone.
- The first result is the first change of the plan the runner sees, not the first painted frame.
- The Azure session and the OpenAI-direct benchmarks are the same model on different deployments;
  their numbers are compared for the shape of a turn, not for the seconds.
- Ten creations and two repetitions per benchmark establish the pattern and its spread, not a
  p95; the stall of run 71 shows the tail every protocol has to leave room for.

## 10. Implementation state

| Proposal | State |
|---|---|
| A — one skill round | Open |
| B — progress in the window | Open |
| C — less to decide in the create call | Open |
| D — plan images as JPEG | Implemented on `feat/hi-mcp-performance`: roomle-ui 43eda3a47, roomle-hi-example the commit of this section; local, not pushed, not deployed |
| E — the rounds after the create | Open |
| F — keep the compacted library context | Open |

### Proposal D, as implemented

The format is decided where the image is rendered. `PrepareImageOptions` of the planner's image
renderer takes `type` and `quality`; a JPEG of a prepared image is drawn on white in the same
synchronous step as the encode, because the group view has a transparent background that a JPEG
turns black. `getExternalObjectSnapshot` takes `imageType` and `imageQuality` and passes them to
its renders only when they are set, so the saved plan snapshot and every other caller keep PNG.
`get-plan-images` asks for JPEG at quality 0.8 and labels its image contents `image/jpeg`; its
description and the served-text fixture are unchanged. The decision is D117 of roomle-ui
`.agents/homag-intelligence/hi-tools-behaviour.md`. The example's prompt runner names a saved
plan image by its format, `.jpg` or `.png`.

The change is planner code: the example and the ligna-store get it with the planner's deployment
to bo-test, and no embedding-lib build is needed.

### Proposal D, measured without a model

The local planner of `feat/hi-mcp-performance` on :5173, the example page in headless Chromium,
the plan snapshot of the left-wall image kitchen (`ps_t0box9y3wtzgj3mksoeywi95ii1enue`, one group).
Four rounds on one page alternate a snapshot without a format (PNG) with a `get-plan-images` call
(JPEG).

| Measure | PNG, snapshot without a format | JPEG, `get-plan-images` |
|---|---|---|
| Tool result bytes of the pair | 2,754,898 | 194,960 |
| Group view, 1024 × 1024 | 508,363 bytes | 52,335 bytes |
| Top view, 1024 × 936 | 1,557,621 bytes | 93,695 bytes |
| First call | 413 ms | 350 ms |
| Later calls | 284–288 ms | 250–261 ms |
| Pixel at the corner of both images | transparent | white |

The tool result is 93 % smaller and the call is not slower. The images show the same kitchen and
room as the PNGs. What the smaller result saves on the model request that carries it needs a model
run; benchmark 03 measured that request with the PNG pair at 3.4 s to its response headers,
against about 1 s for the others.

Unit tests: the renderer's format for the top view, the perspective and the dimensions composite;
the four renders of a snapshot with a format; the tool's snapshot request and image contents; the
embedding-lib's file parts; the runner's file names.
