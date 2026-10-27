# Planning Assistant: the time to the first attempt

> **Type**: Feature analysis — the ticket's performance ideas evaluated, and how to proceed
> **Status**: Open — D done and E implemented, its text-kitchen run open: roomle-hi-example on
> `master` (#211), roomle-ui 43eda3a47 and bbac39fa7 pushed on `feat/hi-mcp-performance` and
> `feat/hi-mcp-merge`, not on `release/bo-test`; B done on roomle-ui `feat/hi-mcp-performance`:
> the tool named at the start of its call kept, the reasoning summary discarded after benchmark 05,
> published as `@roomle/embedding-lib@0.0.0-dev-5e54d0f` and loaded by the example
> ([§10](#10-implementation-state)); A done on roomle-ui `feat/hi-mcp-performance` (e8964c3df),
> accepted in [benchmark 06](../benchmarks/06-az-skill-2026-10-27.md) on the Azure deployment;
> G analysed in [planning-assistant-skill-selector.md](planning-assistant-skill-selector.md); C and
> F open
> **Date**: 2026-10-27
> **Ticket**: [RML-18303](https://roomle.atlassian.net/browse/RML-18303)
> **Base**: roomle-hi-example `master` at 324138e with `@roomle/embedding-lib@0.0.0-dev-130245d`
> (roomle-ui `feat/hi-mcp-merge` at 130245dbd); the planner of `release/bo-test`
> **Data**: the "test the mcp" session `.temp/result/mcp-test-2026-10-27_07-11-41` (gpt-6-astra on
> Azure, 79 runs, no request pacing), the benchmark series
> [01](../benchmarks/01-iklw-oa-orig-2026-10-26.md) / [02](../benchmarks/02-iklw-oa-rc-2026-10-26.md) /
> [03](../benchmarks/03-iklw-oa-rc-preloads-2026-10-26.md) /
> [04](../benchmarks/04-iklw-oa-rc-jpg-due-2026-10-27.md) /
> [05](../benchmarks/05-iklw-oa-rc-status-2026-10-27.md) and
> [their comparison](../benchmarks/iklw-oa-rc-cmp-2026-10-26.md), on the Azure deployment
> [06](../benchmarks/06-az-skill-2026-10-27.md) and [the comparison of the Azure series](../benchmarks/az-cmp-2026-10-27.md), the
> [shared-reference benchmark](../benchmarks/planning-assistant-prompt-caching.md), the external
> document [Kitchen AI Planner: Skill-Architektur und Context Loading](../../docs/external/planning-improvements.md)

## Affected repositories

- **roomle-ui** — the served text of `get-skill` and the skill reading (`hi-mcp/skills.ts`,
  `hi-mcp-server.ts`); the planning assistant's stream handling and provider options
  (`hi-planning-assistant.ts`) with the status of the chat window; the plan images of
  `get-plan-images` (`tool-executors.ts`); the library context cache (`hi-library-context.ts`);
  the skills of a turn selected before its first model call (`hi-planning-assistant.ts`, G).
- **roomle-hi-example** — this analysis, a benchmark per measured step, the "First result"
  column of the test reports as the standing metric; the external document in `docs/external/`;
  with G, the selector model of the launcher.
- **ligna-store** — no change for A–F; it gets every improvement with the planner and the
  embedding-lib. With G, the selector model in its chat options (`hi-mcp/chat-options.ts`).

## 1. What was asked

The ticket lists ideas to cut the token usage and the response time of the Planning Assistant:
prompt caching, the plan context and the image-planning skill added to the prompt automatically,
scaled-down input and plan images, tool memoization, precalculated docking vectors, attribute
indexing and selective retrieval. Some are evaluated and implemented, some are not. The complaint
behind the ticket is the wall-clock time: the assistant is far too slow, above all until the first
attempt appears in the plan when a complete kitchen is planned from a prompt or from an image.

An external document,
[Kitchen AI Planner: Skill-Architektur und Context Loading](../../docs/external/planning-improvements.md)
(German, kept as received in `docs/external/`), answers a question of the ticket's author: whether
the skills can be trained into gpt-6-astra on Azure Foundry, so that the model stops reading them
on every request. It advises against fine-tuning and for an agent architecture with selective
context loading: small permanent system instructions, a skill registry of names and descriptions,
the instructions of a skill loaded only when it is activated, domain knowledge through tools and
retrieval, a small router model in front of the planning model, and JSON schema for the output.
[§2](#2-the-tickets-ideas-evaluated) holds its proposals against the implementation: most of them
are in place; the router yields one new proposal,
[G](#g-the-skills-of-the-turn-selected-before-the-first-call), and fine-tuning is rejected with
the document's own reasons.

This analysis answers three questions: where the ticket's ideas and the document's proposals
stand, where the time to the first attempt goes today, and which changes shorten it, in which
order. It changes no productive code and makes no model run; every number comes from retained
runs.

## 2. The ticket's ideas, evaluated

| Idea | State | Evidence | Verdict |
|---|---|---|---|
| Prompt caching | Implemented: the shared reference prefix ([ADR 0014](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/the-planning-assistant-uses-a-shared-reference-prefix.md)), the optional Azure cache boundary, Responses chaining ([prompt-caching.md](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/prompt-caching.md)) | The first call of a fresh conversation reads 74,806 of its 77,193 input tokens from the cache; it still waits 2.8–10 s for its first output ([§4](#4-where-the-time-to-the-first-attempt-goes)) | Done. The prefill is not where the time goes: a round costs about 3.5 s even with an empty answer |
| The plan context added to every prompt | Evaluated and rejected ([ADR 0015](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/keep-live-plan-state-and-image-guidance-on-demand.md), [benchmark 03](../benchmarks/03-iklw-oa-rc-preloads-2026-10-26.md)) | 8 instead of 6 model calls, a third more input tokens, the first kitchen still at call 3 | Closed by ADR 0015; [the analysis of G](planning-assistant-skill-selector.md) reopens it with the session's first calls — 89 of 99 turns read the live sections before anything else, and the create at call 1 needs them supplied —, decided with benchmark 07 |
| The image-planning skill added to the first image prompt | Evaluated and rejected (ADR 0015) | Same measurement: the kitchen skill and its reference still take two rounds | Closed. [Proposal G](#g-the-skills-of-the-turn-selected-before-the-first-call) supplies the kitchen skill with its reference instead — the two rounds that remain — selected per request |
| Scale down the input image | Implemented: the chat window redraws a dropped image as a JPEG with the long side at most 1568 px (`prepareImage`, roomle-ui `planning-assistant-image.ts`); the test runner does the same | The test image arrives as 1568 × 1276 px, 198,683 bytes, about 2,000 input tokens of 77,000 | Done. A smaller image saves nothing measurable and loses what the model reads |
| Scale down the plan images | Implemented as proposal D ([§10](#10-implementation-state)) | `get-plan-images` answers 2,738,222 bytes: two PNG renders at 1024 px, 509 KB and 1.56 MB; the request that carries them takes 3.4 s to its response headers, the others about 1 s. As JPEG the pair is 194,960 bytes, and [benchmark 04](../benchmarks/04-iklw-oa-rc-jpg-due-2026-10-27.md) measures the request that carries it at 0.95 s | Done, as [proposal D](#d-plan-images-as-jpeg). It saves after the first attempt, not before it |
| Tool memoization | Open | The read tools answer in 0.3–13 ms, an attribute change in about 0.16 s, the renders in 0.4–0.5 s, the create in 1.2–1.8 s; no tool is called twice with the same input in a turn, and a later turn finds the result in its history | Rejected: nothing to save |
| Precalculated docking vectors | Open: the planner compacts the library context on every read (ADR 0013) | 12–20 ms warm, 0.7 s on the first read after the library load | [Proposal F](#f-keep-the-compacted-library-context): the backlog item, worth its 0.7 s only on the first prompt of a page |
| Attribute indexing | Open | `find-attributes` answers in 13 ms, and no kitchen creation calls it since the vocabulary is in the plan context | Rejected: nothing to save |
| Selective retrieval (RAG) | Open | The input size costs about 13 ms per 1,000 tokens ([kitchen-from-image-time.md](../benchmarks/kitchen-from-image-time.md)), 97 % of the prefix is read from the cache, and a per-request selection would break the shared prefix and add a step | Rejected for the response time; reconsider when a library outgrows the prefix |

### The external document's proposals

The document describes its target as four layers — small permanent instructions, a skill registry,
dynamic skill loading, domain knowledge through tools — with a router model in front. Held against
the implementation (the sizes are bytes of the served text; a token is about four bytes):

| The document proposes | What the assistant has | Verdict |
|---|---|---|
| No fine-tuning: the rules stay outside the model weights, because supervised fine-tuning teaches how to answer, not which rules to know, and every change of a rule would need training, data set and validation again | The rules are text: the authoring rules, the skills as HOMAG delivers them (D75 of [hi-tools-behaviour.md](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#3-decisions)) and the descriptions of the library data, changed without a model | Agreed — [Not proposed](#not-proposed) |
| Small permanent system instructions, 500–1,500 tokens | The system prompt is 2,259 bytes (roomle-ui `hi-agent-prompts.ts`); the shared block in front of every call is the authoring rules, 21,855 bytes (ADR 0014, variant B of the [shared-reference benchmark](../benchmarks/planning-assistant-prompt-caching.md#content-variant-results-and-decision)); the tool definitions, 43,246 bytes, go with every call | In place. Together 67,360 bytes of a first call's 77,193 input tokens, read from the cache like the library |
| A skill registry, always in the context: name, description, when to use | `skillIndex` in the description of `get-skill` (roomle-ui `hi-mcp/skills.ts`, `hi-mcp-server.ts`): one line per skill with its name and its description, which says when to use it | In place |
| A skill in three parts — metadata, instructions loaded only when the skill is activated, resources — and the skill as a tool, `get_skill("kitchen-planning")` | The Agent Skills format: the frontmatter, `SKILL.md` on `get-skill name`, the references on `get-skill name file`; the source catalog stays optional | In place. What it costs is the rounds: the skill at call 1, its mandatory reference at call 2 ([§3](#3-how-a-kitchen-comes-about-today)) |
| Domain knowledge through tools and retrieval — catalog search, article lookup, validation, price — not in the prompt | `find-attributes`, the sections of `get-plan-context`, `get-price`, the corrections of the create; the compact catalog itself, 270,617 bytes, is in the shared prefix (ADR 0014) | The catalog stays in the prefix: 97 % of it is read from the cache, and a search per article pick would cost a round each — the selective retrieval of the table above |
| A small router model in front: it recognizes the intent, selects the skills and the data, and the planning model gets them with the request | Nothing: the planning model selects the skill itself in its first call and reads it in two rounds | [Proposal G](#g-the-skills-of-the-turn-selected-before-the-first-call) |
| JSON schema for the output | Every tool input is a JSON Schema the planner validates (roomle-ui `hi-mcp/mcp-tool.ts`); the output of the assistant is the plan, not a JSON answer | In place as far as it applies |
| Versioned skills, deployed apart from the model | The skills are files of the planner, deployed with it | Not a matter of the response time |

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

**State.** Done: roomle-ui e8964c3df on `feat/hi-mcp-performance` — `get-skill` answers a room
skill with its planning reference under a line that names it as included, the image skill alone,
a file requested with `file` alone (D120 of roomle-ui `hi-tools-behaviour.md`); planner code, no
embedding-lib build. Accepted in [benchmark 06](../benchmarks/06-az-skill-2026-10-27.md) on the
Azure deployment: every run creates at call 2 and none fetches the reference; the image kitchen
after 26.3 / 33.0 s (the session's run 68 on the same deployment: 36.4 s), the text kitchen after
28.3 / 32.3 s (run 52: 31.7 s); the reasoning of the reference round moved into the create call
([§10](#10-implementation-state)).

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

**State.** Done on roomle-ui `feat/hi-mcp-performance`. Benchmark 05 measured both parts on
OpenAI: the tool status comes with the start of the payload; the reasoning summary is a call's
first output and does not fill the wait for it. The tool status is kept, the reasoning summary
discarded; published as `@roomle/embedding-lib@0.0.0-dev-5e54d0f` and loaded by the example
([§10](#10-implementation-state)).

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

**State.** Done: implemented, the format chosen in the renderer, not re-encoded in the tool, and
measured with a model in [benchmark 04](../benchmarks/04-iklw-oa-rc-jpg-due-2026-10-27.md) — the
request that carries the images 0.95 s to its response headers against 2.9–3.2 s with the PNGs,
the upload per turn 69 % below 02 ([§10](#10-implementation-state)).

### E. The rounds after the create

Every kitchen run of the session renders the plan images once after the create and reads the
context again; the answer comes 20–40 s after the first result. The authoring rules say to verify
the result numerically and not to judge a position from a rendering alone, and nothing says when
a render is due. A candidate for the served text: render only when the user asks to see the plan,
when a correction reports a conflict, or to compare a planning with the image it comes from. It
saves a round and the heavy final request in a text creation, about 5 s of planning time; it does
not change the first result. It is measured by the planning-time column of the suite, and it stays
out if the answers get worse.

**State.** Implemented: the occasions of a render in the description of `get-plan-images`, and
the read after a change in the system prompt. Benchmark 04 shows both in the image kitchen: the
render stays by design, after the last change, and the read after the create asks for the
obstacles only. The text kitchens, where no render is due, are not measured yet
([§10](#10-implementation-state)).

### F. Keep the compacted library context

The backlog item of the planner ([Caching the library context](../backlog/README.md#planner-roomle-ui-roomlecore)):
keep the compacted context from the library load until the next catalog load
(`hi-library-context.ts`). It saves the 0.7 s of the first read after the load, once per page, in a
host without the test runner's warm-up read — the ligna-store. Cheap; it does nothing for the
later prompts.

### G. The skills of the turn selected before the first call

The router of the external document. **What changes.** Before the first model call of a turn,
the planning assistant determines the skills of the request — the kitchen skill for a kitchen (the
France skill in France), the living-room skill, the image-planning skill when an image comes — and
supplies each one together with the reference its `SKILL.md` asks to read before planning, as
supplied skill files in the turn's user message, before the user's text. The system prompt already
provides for them: "Use supplied skill files; fetch missing skills and references with get-skill".
The assistant reads the files through `get-skill`, with the session preamble the tool serves, as it
reads the library through `get-plan-context`; a skill the conversation already holds, supplied or
fetched, is not supplied again. The selection is one short call to a small, fast model named in the
config — the document's GPT-6 Luna; on Azure a small deployment of the same family, on OpenAI a
mini model — with the skill index of `get-skill`, the user's text and whether an image comes,
answering the names of the skills to supply for a request that plans a room, and none for an edit,
a question or a look. An unknown name or a failed call supplies nothing, and the turn runs as today.

**What it saves.** The two rounds before the create: 7–14 s in a text creation, 15–40 s in an image
creation, minus the selector call; the reasoning on the image and the reference does not go away
but moves into the create call. The create comes at call 1. A wrong selection costs nothing beyond
today: the model fetches what it misses with `get-skill`.

**Cost and risk.** One more model call per turn, about 1–2 s for a small model with a short input —
estimated, not measured ([§9](#9-measurement-gaps)); the step timing of the usage record measures
it. The first request of a creation turn grows by the skill and its reference, 34,527 bytes for a
kitchen, at the end of the input, so the cached prefix stays intact; an edit turn grows by nothing,
which is what variant C of the shared-reference benchmark lacked. It is the preload lifecycle ADR
0015 rejected — a supplied-skill state in the host —, so G needs the evidence that decision asks for
and a decision of its own. Benchmark 03 preloaded the image skill and the live context, and the
kitchen skill with its reference still took two rounds; G supplies those two. It is an embedding-lib
change, so the build is asked for, and the hosts name the selector model in their config
(`start.mjs`, ligna-store `chat-options.ts`); without one the assistant selects nothing.

**Alternative.** No model: the words of the skill index matched against the user's text, plus the
image. Free and deterministic, but "Oven, hood, sink, fridge in the corner" (run 44) names no
kitchen — a request the small model classifies and a word match does not. With A in place, G saves
one round instead of two, so A comes first and G is decided on A's build.

**State.** Analysed in [planning-assistant-skill-selector.md](planning-assistant-skill-selector.md):
the create at call 1 needs the live sections supplied with the turn as well, so G has two parts —
the skills selected per request by the small model, the plan state supplied per turn —; benchmark
07 on the Azure deployment measures it ([§7](#7-how-to-proceed)).

### Not proposed

| Idea | Why not |
|---|---|
| The preloads of benchmark 03 again | ADR 0015: they add a lifecycle and no round goes away while the skill still takes two |
| The skills trained into the model | The external document itself advises against it: supervised fine-tuning teaches how to answer, not which rules to know, every change of a rule means training, data set and validation again, and the document finds no fine-tuning offer for gpt-6-astra in Foundry. The rules change with the library, the region and the skills HOMAG delivers (D75); the price of a round and the reasoning of the create call do not depend on where the rules are |
| The catalog behind a search tool instead of in the prefix | The selective retrieval of [§2](#2-the-tickets-ideas-evaluated): the prefix is read from the cache, a search per article pick is a round each |
| Trimming the tool definitions, 43,246 bytes with every call | About 13 ms per 1,000 tokens, read from the cache: a tenth of a second per call |
| A first partial kitchen (the base row first, the rest in a second call) | One more round (about 3.5 s) and a second group that must dock onto the first; the first attempt would be a half kitchen |
| Streaming the tool input into the planner while the model still writes | The group is laid out from its relations; a partial group cannot be built, and the planner's create takes 1.5 s of the 30 |
| A watchdog that resends a call without a first output after a limit | The p95 of the wait is 12 s, one call of 411 stalled for 65 s; a resend doubles the cost of a legitimate long reasoning. Measure the tail over more sessions first |
| Another model | Out of scope here; the measurement protocol of §7 works for any |

## 7. How to proceed

A, B, D and E are done ([§10](#10-implementation-state)): B's tool status is in the embedding-lib
the example loads; A, D and E are planner code on `feat/hi-mcp-performance`, A accepted in
[benchmark 06](../benchmarks/06-az-skill-2026-10-27.md). What the window shows during the wait
before a call's first output — the remainder of B — is a proposal of its own, to be decided. The
open steps, in this order, one build per step, each step measured before the next, every
benchmark on the Azure deployment (`gpt-6-astra` with `$AZURE_GPT_KEY`, the provider of every
benchmark from 06 on; the series and its baseline in
[the comparison of the Azure series](../benchmarks/az-cmp-2026-10-27.md)):

1. **G** on the build of A, analysed in [the analysis of G](planning-assistant-skill-selector.md):
   the selector and the plan state supplied per turn, measured by benchmark 07 — the two creations
   of 06 and the move of run 01, two repetitions each, on the local embedding source. Accept G when
   the create and the move come at call 1 and the selector's call is shorter than the round it
   replaces; otherwise the selector stays out. An embedding-lib change, the build asked for after
   the measurement, and a decision of its own beside ADR 0015.
2. **F** — a small planner change, verified with the minimum set of "test the mcp": the
   first-result column.
3. **E's run on the text kitchens** — the minimum set plus the two tests whose renders must stay,
   measured by the planning times and the verdicts
   ([§10](#proposal-e-measured-and-to-be-measured)).
4. **C** — the worked example as an experiment on the benchmark of 06; the reasoning effort in
   RML-18043.

The standing metric is the **First result** column of every "test the mcp" report. The baseline is
the session `mcp-test-2026-10-27_07-11-41`: text kitchens 31.7–44.0 s, image kitchens 36.4–62.7 s.
A, G and F take the seconds of the rounds; whether the first attempt gets under 20 s depends on the
reasoning of the create call, which only C changes.

## 8. Code and documents the work would touch

| Repository | Code | Documents |
|---|---|---|
| roomle-ui | `hi-mcp/skills.ts` (`readSkillFile`), the `get-skill` registration in `hi-mcp-server.ts`, `__tests__/hi-mcp/skills-test.ts`, `hi-mcp-server-test.ts`, `test-helpers/unit/hi-mcp-fixture.json` (A); `packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts` (stream parts, provider options), `src/common/store/planning-assistant-store.ts`, `PlanningAssistantChat.vue` and their tests (B); `hi-mcp/tool-executors.ts` or `planner-core/src/roomle-planner.ts` (D); `hi-library-context.ts` (F); the served rules in `hi-mcp-server.ts` (C, E); `hi-planning-assistant.ts` (the selector call before the first model call, the supplied skill files, the selector model of `PlanningAssistantConfig`) and `tests/unit/embedding-lib/homag-intelligence/hi-planning-assistant.spec.ts` (G) | `.agents/homag-intelligence/hi-tools-behaviour.md` (a decision row per change), `hi-tools-reference.md`, `agent-architecture.md`, `prompt-caching.md`; with G an ADR beside ADR 0015 |
| roomle-hi-example | the benchmark session and report of every measured step; `minimal-hi-example/index.html` for a new embedding-lib pin; `minimal-hi-example/start.mjs` (the selector model, G) | this analysis; `.agents/skills/hi-mcp-tools.md` (`get-skill`), `docs/ai-chat.md` (the status of the window; the selector model), `.agents/benchmarks/README.md`, the backlog rows of the accepted steps |
| ligna-store | `hi-mcp/chat-options.ts` (the selector model, G) | — |

## 9. Measurement gaps

- The wait for the first output of a call combines provider queueing, prefill and reasoning; the
  three cannot be separated from the retained data. The reasoning tokens show that the wait of the
  create call is reasoning for the most part, not that it is reasoning alone.
- The first result is the first change of the plan the runner sees, not the first painted frame.
- The Azure session and the OpenAI-direct benchmarks are the same model on different deployments;
  their numbers are compared for the shape of a turn, not for the seconds.
- Ten creations and two repetitions per benchmark establish the pattern and its spread, not a
  p95; the stall of run 71 shows the tail every protocol has to leave room for.
- The selector call of G is estimated: no retained run has a call with a short input to a small
  model. The 3.5 s of a round are gpt-6-astra's with the full input.

## 10. Implementation state

| Proposal | State |
|---|---|
| A — one skill round | Done: roomle-ui e8964c3df on `feat/hi-mcp-performance`, not on `release/bo-test`; planner code, no embedding-lib build; accepted in [benchmark 06](../benchmarks/06-az-skill-2026-10-27.md) on the Azure deployment, the create at call 2 in every run ([below](#proposal-a-as-implemented-and-measured)) |
| B — progress in the window | Done: the tool named at the start of its call kept (roomle-ui bd4d1d1c9), the reasoning summary discarded after [benchmark 05](../benchmarks/05-iklw-oa-rc-status-2026-10-27.md) (5e54d0f1a), both on `feat/hi-mcp-performance`; published as `@roomle/embedding-lib@0.0.0-dev-5e54d0f`, which the example loads; the ligna-store pin open ([below](#proposal-b-as-implemented)) |
| C — less to decide in the create call | Open |
| D — plan images as JPEG | Done: roomle-ui 43eda3a47, pushed on `feat/hi-mcp-performance` and `feat/hi-mcp-merge`, not on `release/bo-test`; roomle-hi-example on `master` (#211); measured with a model in [benchmark 04](../benchmarks/04-iklw-oa-rc-jpg-due-2026-10-27.md) |
| E — the rounds after the create | Implemented: roomle-ui bbac39fa7, pushed as D; roomle-hi-example on `master` (#211). Measured for the image kitchen in benchmark 04; the run on the text kitchens open ([below](#proposal-e-measured-and-to-be-measured)) |
| F — keep the compacted library context | Open |
| G — the skills of the turn selected before the first call | Open — analysed in [planning-assistant-skill-selector.md](planning-assistant-skill-selector.md); measured by benchmark 07 on the Azure deployment |

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

### Proposal E, as implemented

Two sentences of the served text, both instructions, no guard:

- The description of `get-plan-images` opens with the occasions of a render: the user asks to see
  the plan or to look inside a cabinet, or a planning from an image the user sent is compared with
  that image; a create or edit result already carries the positions to verify, so a check needs no
  render. The verification rule of the authoring rules stays as it is (D118 of roomle-ui
  `.agents/homag-intelligence/hi-tools-behaviour.md`).
- The system prompt asks for the fresh read of rooms, groups, obstacles and installation elements
  before the first change of a turn; within a turn, the result of a change is the current state of
  its groups, the next change builds on it, and a new read is due only for what a result does not
  carry, or after undo and redo (D119).

Guarded by a test on each sentence; the served-text fixture carries the new description. The
example's tool skill says the same. The change is planner code: the example and the ligna-store
get it with the planner's deployment to bo-test, and no embedding-lib build is needed.

### Proposal E, measured and to be measured

What the session of 2026-10-27 shows and E takes away: 17 renders in 16 of 79 runs, of which 5
were asked for, 7 belong to image plannings and 5 are the five text kitchen creations, where
nothing asked for a render; no other text creation renders. After a change, 30 of the 72 runs with
one read the plan context again, the kitchen creations right after their create and before their
first edit.

[Benchmark 04](../benchmarks/04-iklw-oa-rc-jpg-due-2026-10-27.md) — the image kitchen, two
repetitions — shows E in the case where a render is due: the agent renders once, after its last
change, because the served text names the comparison with the user's image as an occasion, so the
images show the final state (a round of its own, 5.7 / 6.9 s); after the create it reads the
obstacles only, 1,853 bytes, batched with the attribute lookup, because the create result carries
the groups.

The run on the text kitchens is open: the minimum set of "test the mcp" plus `plan-images-kitchen` and
`open-cabinet-look-inside`, whose renders must stay, with gpt-6-astra on the local planner of
`feat/hi-mcp-performance`; compared per test with the session of 2026-10-27 on the
`get-plan-images` calls (text kitchens none, the two asked tests one), the plan context reads
after a change, the planning time, the first result and the verdicts. E is accepted when the text
kitchens answer without a render and without the read before their first edit, the asked renders
stay and no verdict gets worse; otherwise the commit is reverted.

### Proposal A, as implemented and measured

`get-skill` answers a room skill with the reference its `SKILL.md` asks to read before planning in
one result: the session preamble, the skill, then the reference under a separator and the line
"The file references/planning-reference.md of this skill, included here:"; the image skill has
none; a file requested with `file` comes alone, the source catalog among them. The required files
are named per skill in roomle-ui `hi-mcp/skills.ts`, a required path that is no file of its skill
fails the load, and the skill files stay as their authors deliver them (D75). The description of
`get-skill` says what the result holds; the system prompt is unchanged. Decision D120 of roomle-ui
`.agents/homag-intelligence/hi-tools-behaviour.md`; the kitchen skill result is 35,685 bytes
instead of two results of 20,247 and 15,393 bytes.

[Benchmark 06](../benchmarks/06-az-skill-2026-10-27.md), `gpt-6-astra` on the Azure deployment,
two repetitions each of the image kitchen on the left wall and the walnut kitchen around the back
right corner, on the local planner with A:

| Measurement | Session run 68 (image) | 06 image | Session run 52 (text) | 06 text |
|---|---|---|---|---|
| Model calls | 7 | 6 / 5 | 5 | 3 / 3 |
| The reference round | 11.7 s, 192 reasoning tokens | none | 3.9 s | none |
| The create: call / delta s / reasoning tokens | 3 / 17.6 / 178 | 2 / 18.0 and 24.6 / 219 and 330 | 3 / 22.2 / 333 | 2 / 20.7 and 20.9 / 319 and 332 |
| First kitchen, seconds | 36.4 | 26.3 / 33.0 (mean 29.7) | 31.7 | 28.3 / 32.3 (mean 30.3) |
| Turn, seconds | 72.2 | 59.3 / 60.2 | 45.2 | 36.3 / 38.2 |
| Input tokens | 660,980 | 552,136 / 453,191 | 431,096 | 252,384 / 251,708 |

Every run creates at call 2 and none fetches the reference. A text creation gains the round, an
image creation the round minus the reasoning that moves into the create call, which is where the
time before the first attempt now is: 18–25 s, more than half of it the wait for its first output
(C). The kitchens are those of benchmarks 04 and 05 and of the test's expectation. The create tool
took 3.3–3.5 s, 8.1 s in one text run, the planner's price refresh alongside — the planner's time,
not the model's.

### Proposal B, as implemented

One change in the planning assistant (roomle-ui
`packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts`), none in the window:
the `activity` part goes out at `tool-input-start`, when the model starts writing a tool call,
and again at `tool-call`, when its input is complete — the same tool name, so a provider that
delivers a call whole still names it (roomle-ui bd4d1d1c9).

The second part of the plan — a reasoning summary requested on the OpenAI and Azure Responses
routes (`reasoningSummary: 'auto'`) and its first lines shown as the status — was built with it
and measured in benchmark 05 ([below](#proposal-b-measured)). It is discarded (roomle-ui
5e54d0f1a): the request option, the handling of the reasoning parts, their tests and the
documentation of the summary. The assistant shows no reasoning text; with a configured reasoning
effort, the pinned Azure adapter adds `reasoning.summary: 'detailed'` on its own, as it did before
B, and the assistant ignores those parts.

Unit tests: the activity at the start and at the completion of a call; the pinned SDK streams
`tool-input-start` with the tool name before the complete call. The decision row — the tool status,
and the reasoning summary rejected with the measurement — is in roomle-ui `prompt-caching.md`;
`agent-architecture.md` and the chat guide here describe the status line.

The change is embedding-lib code, published as `@roomle/embedding-lib@0.0.0-dev-5e54d0f` from
roomle-ui `feat/hi-mcp-performance`; the example loads it, the pin of the ligna-store is open.

### Proposal B, measured

[Benchmark 05](../benchmarks/05-iklw-oa-rc-status-2026-10-27.md) — the image kitchen on the
left wall, `openai:gpt-6-astra`, two repetitions on the planner of 04 with
`0.0.0-dev-bd4d1d1`; the 04 captures read with the same script as the baseline:

| Measurement, seconds from turn start | 04 | 05 |
|---|---|---|
| The status names `create-or-replace-groups`, before the create tool starts | 0.178 / 0.182 | 5.587 / 3.667 |
| First status | 5.203 / 4.081 | 3.224 / 3.150 |
| Reasoning summary lines before the kitchen / in the turn | 0 / 0 and 0 / 0 | 0 / 2 and 1 / 4 |
| Longest time without a window update before the kitchen | 11.056 / 10.729 | 8.992 / 11.568 |
| First kitchen, mean | 29.661 | 28.456 |

- **The tool status does what it should.** The window names the create with the call's first
  output and keeps it for the 3.7–5.6 s the payload streams; in 04 the name came with the complete
  input, 0.18 s before the tool ran.
- **The reasoning summary does not.** OpenAI accepts `reasoning.summary: 'auto'` for gpt-6-astra
  — no 400 —, but streams a summary on 2 of 10 and 4 of 7 calls, never on the create call, and each
  summary line is its call's first output (0.4–1.8 ms after it). Those calls wait for their first
  output no less than in 04. The wait before a call's first output stays a status that names the
  last tool; the longest silence is the reference round's wait in both runs. Calls without any
  reasoning tokens also wait about 3 s for their first output, so the wait is not reasoning alone.
- **No measurable cost** on calls 1–3, the same work in 04 and 05; the summary tokens are not
  reported apart from the output tokens.

**Decision: keep the tool status, discard the reasoning summary.** The summary has no measured
benefit, adds output tokens on every call it streams on, and would carry the unverified risk of a
deployment that rejects `reasoning.summary` and fails every turn. Discarded in roomle-ui 5e54d0f1a;
the tool status stays. What the window could show during the wait is a status the assistant sets
itself when it sends a request; that is a new proposal, to be decided.
