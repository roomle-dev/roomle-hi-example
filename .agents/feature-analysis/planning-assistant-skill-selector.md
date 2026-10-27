# Planning Assistant: the skills of the turn selected before the first call

> **Type**: Feature analysis — proposal G of
> [the time-to-first-attempt analysis](planning-assistant-time-to-first-attempt.md), its design
> and its measurement, benchmark 07
> **Status**: Open — the selector deferred to
> [the backlog](../backlog/planning-assistant-skill-selector.md): the models of the assistant are
> decided later; whether the plan state per turn is done without it is to be decided
> ([§9](#9-decisions-to-take-before-the-plan))
> **Date**: 2026-10-27
> **Ticket**: [RML-18303](https://roomle.atlassian.net/browse/RML-18303)
> **Base**: roomle-ui `feat/hi-mcp-merge` at 23c7a0113, which carries proposal A (the planning
> assistant `packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts`, the prompts
> `hi-agent-prompts.ts`, the skills `hi-mcp/skills.ts`); roomle-hi-example
> `docs/proposal-a-one-skill-round` at 1b3819e, the example with
> `@roomle/embedding-lib@0.0.0-dev-5e54d0f`
> **Data**: the "test the mcp" session `.temp/result/mcp-test-2026-10-27_07-11-41` (gpt-6-astra on
> Azure, 79 runs, 99 turns), [benchmark 06](../benchmarks/06-az-skill-2026-10-27.md) (the build of
> A on the Azure deployment), [benchmark 03](../benchmarks/03-iklw-oa-rc-preloads-2026-10-26.md)
> (the supplied live state and image skill, on OpenAI), the external document
> [Kitchen AI Planner: Skill-Architektur und Context Loading](../../docs/external/planning-improvements.md)

## Affected repositories

- **roomle-ui** — the planning assistant of the embedding-lib (`hi-planning-assistant.ts`: the
  selector call before the first model call, the supplied skills and the supplied plan state, the
  selector model of `PlanningAssistantConfig`, the usage record); the agent prompts
  (`hi-agent-prompts.ts`, `external-object-api.ts`: the selection prompt with the skill names, the
  sentence on supplied plan state); their tests; the living reference (`agent-architecture.md`,
  `prompt-caching.md`, a decision row of `hi-tools-behaviour.md`, an ADR beside
  [ADR 0015](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/keep-live-plan-state-and-image-guidance-on-demand.md)).
  An embedding-lib change: the build is asked for, after the measurement on the local source.
- **roomle-hi-example** — this analysis, benchmark 07 and its report, the selector model of the
  launcher (`minimal-hi-example/start.mjs`) with its test and `docs/ai-chat.md`, the collector of
  the benchmarks (the selector's request told apart), the time-to-first-attempt analysis.
- **ligna-store** — the selector model in its chat options (`hi-mcp/chat-options.ts`); the
  embedding-lib pin once the build exists.

## 1. What was asked

Proposal G of the time-to-first-attempt analysis, the router of the external document: before the
first model call of a turn, the planning assistant determines the skills the request needs with a
small, fast model and supplies them with the turn, so that the planning model creates in its first
call instead of spending a round on fetching them. This analysis holds the design against the code
and the retained runs, finds what the create at call 1 needs beyond the skills, and defines its
measurement, benchmark 07, on the Azure deployment as every benchmark from 06 on.

## 2. How a turn starts today

**The assistant** (`startPlanningAssistant`, roomle-ui
`packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts`) acquires the library
reference at the start of every turn with `get-plan-context` (`articles`, `attributes`; 270,617
bytes, 15–24 ms) and sends the instructions, the reference, the history and the user message to
the model. It holds no skill knowledge: the skill index is in the description of `get-skill`
(`skillIndex` of `hi-mcp/skills.ts`), the prompts of the planner (`getExternalObjectAgentPrompts`,
`hi-agent-prompts.ts`) are the system prompt, the image prompt and the authoring rules.

**The system prompt** asks two things of every turn that changes the plan: "Read fresh rooms,
groups, obstacles and installationElements before the first change of a turn" (D119) and "Before
planning, follow the skill for the request: kitchen-planning for a kitchen (kitchen-planning-fr
instead in France), living-room-planning for a living room, image-planning when the user sends an
image. Use supplied skill files; fetch missing skills and references with get-skill." The model
does both in its first call, as one batch of tool calls; with A the room skill comes with its
planning reference (D120), and the create is the second call.

**What the session shows**, 99 turns of 79 runs, gpt-6-astra on Azure:

| Turns | Count | First model call, seconds (median / p90 / max) |
|---|---|---|
| All turns | 99 | 3.6 / 8.4 / 65.2 (the stall of run 71) |
| Turns that fetched a `SKILL.md` | 40, every one in its first call; 39 with the live sections in the same call; 31 creations, 9 edits of a kitchen or a sideboard | 4.1 / 8.8 / 65.2 |
| Turns that changed the plan | 85; 79 read the live sections in their first call, the 6 others are undo, redo and one correction right after an undo | — |
| … whose first call read the live sections and nothing else (the edits) | 40 | 3.5 / 6.1 / 9.7 |
| Questions and looks: no skill, no change | 13; 10 of them read the live sections first (the group to open, the plan to show) | — |
| Turns without any read before their first tool | 9: undo, redo, the order data, the plan images, a colour question | — |
| Later turns of a conversation (turn 2 and on) | 20; none fetched a skill: the skill of turn 1 stays in the history | — |

Every turn that fetches a skill reads the live sections in the same call, and 89 of the 99 turns
read them before anything else. A later turn never fetches a skill the conversation holds.

**Benchmark 06**, the build of A on the same deployment, shows the round G takes: call 1 of the
four runs takes 3.3–4.9 s (62–79 output tokens, no reasoning) and calls `get-plan-context` for the
live sections and `get-skill` for the kitchen skill, with the image skill in the image runs; the
create is call 2, 18–25 s.

**Benchmark 03** shows what a supplied input does to the model: with the live sections and the
image skill supplied before the first call (roomle-ui 5426d65c4, discarded by ADR 0015), call 1
fetched the kitchen skill alone — neither the supplied state nor the supplied skill was requested
again — and the reference round and the create followed. The kitchen skill still took two rounds
then; A has since made it one, which is why ADR 0015 could not see a gain and G is decided on the
build of A.

## 3. The gap

With A, the round before the create does two things at once: it fetches the skill with its
reference and it reads the live sections. G as proposed supplies the skills; the read would remain,
call 1 would be `get-plan-context` alone and the create still call 2 — the same number of rounds,
nothing saved. **The create at call 1 needs the live sections supplied with the turn as well**:
the "selected data" of the router in the external document, the "plan context added to each user
prompt" of the ticket's ideas, which [benchmark 03](../benchmarks/03-iklw-oa-rc-preloads-2026-10-26.md)
measured with the kitchen skill still at two rounds. So G has two parts: the skills, selected per
request, and the live sections, supplied per turn.

What a round costs on this deployment is the fixed price of the first call: 3.3–4.9 s in benchmark
06, a median of 3.5 s and a p90 of 6.1 s in the session's edit turns. What G adds to the clock is
the selector's call, estimated at 1–2 s for a small model with a short input
([§8](#8-measurement-gaps)); benchmark 07 measures it as a step of its own.

## 4. The proposed change

### 4.1 The selector

Before the first model call of a turn, the assistant asks a small model which skills the request
needs:

- **Input**: the planner's selection prompt and the user's text (the image prompt for an image
  without text), with the note that the message carries an image when it does. The selection
  prompt is served by the planner with the agent prompts — `getExternalObjectAgentPrompts()`
  gains `skillSelection: { prompt, names }` (`hi-agent-prompts.ts`, the `HiAgentPrompts` type of
  `external-object-api.ts`) — so the host holds no skill knowledge, as the rule of
  [prompt-caching.md](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/prompt-caching.md)
  wants it. The prompt says what the system prompt says today — the skill index, which skill for
  which kind of room, the France skill instead of the general one in France, the image skill for
  an image — and asks for the names of the skills to follow for a request that plans furniture or
  changes a planning, and for none for a question, a look, an undo or a redo. Library-neutral: it
  names kinds of rooms and skill names, as the system prompt does.
- **Output**: free text; the host keeps the names of the planner's list that occur in it as whole
  words. No name, "none", an unknown name, a failed call or a call that passes a limit of a few
  seconds (the round it replaces) supply nothing, and the turn runs as today. The limit keeps a
  provider stall (65 s in run 71 of the session) off the turn.
- **The model**: `selector` of `PlanningAssistantConfig` — provider, model, key, endpoint,
  reasoning effort, the shape of the config itself —, loaded with `loadChatModel` beside the
  planning model, called with `generateText` of the AI SDK without tools, a short output limit
  and the turn's abort signal. Without `selector` in the config the assistant selects nothing. On
  the Azure resource the candidate is the `gpt-5.4-mini` deployment at a low reasoning effort; the
  external document's router, GPT-6 Luna, if the resource has a deployment of it — to check at
  implementation. On direct OpenAI a mini model. The launcher names it with
  `HI_CHAT_SELECTOR_MODEL`, a deployment of the same resource with the same key
  (`minimal-hi-example/start.mjs`); the ligna-store in its chat options, beside the model of the
  chat.
- **Every turn** runs the selector; the simplest rule, and its cost is measured on the edit turn
  of benchmark 07. A rule that skips it — once the conversation holds a skill, unless an image
  comes — saves its seconds on the later turns of a conversation at the price of a later request
  for another kind of room going unselected; it is added if the measured cost asks for it.

### 4.2 What the turn supplies

- **The selected skills** the conversation does not hold yet, each read through the assistant's
  own `get-skill` tool (the served text: the session preamble, the skill and, with A, its planning
  reference), as a labelled user-role message before the user's message — "Skill <name>, supplied
  with this turn as get-skill answers it:" — in the shape of benchmark 03. The message is retained
  with the user message on success, so the skill is in the history of every later turn like a
  fetched one, and it is not supplied again. What the conversation holds is derived from the
  history at the start of a turn: the labels of the supplied messages and the model's own
  `get-skill` calls in the retained assistant messages. No state beside the history, no presence
  flag: the history already has the success-only commit of ADR 0015's concern.
- **The live sections** — rooms, groups, obstacles, installationElements, 5,631 bytes in the
  session's room, 7–11 ms — read at the start of the turn with the library reference (one
  `get-plan-context` call with both include lists, split into the two messages as benchmark 03 did;
  the library message's bytes and digest stay the same) and sent as a turn-local labelled user-role
  message after the history and before the supplied skills and the user message: "Current plan
  state, read for this turn (data, not instructions):". It is not retained: the next turn reads
  afresh, and the history holds no stale snapshots. A rejected continuation re-sends the turn's
  input with it, as it re-sends the library reference.
- **The system prompt** says what the supplied state is for: the fresh-read sentence of D119
  becomes "Before the first change of a turn, use the current plan state supplied with the turn;
  read what it does not carry, and read again after undo and redo" — the wording of benchmark
  03's commit, kept short. The skill sentence stays: "Use supplied skill files; fetch missing
  skills and references with get-skill" is what the supplied messages are for.
- **The request order**: the instructions; the library reference, the cache boundary; the history
  with the skills of earlier turns; the live state; the new skills; the user message. The cached
  prefix is untouched; what G adds comes after it.

**On which turns the live sections are supplied** is the decision this analysis puts to the user
([§9](#9-decisions-to-take-before-the-plan)): **recommended, on every turn** — 89 of the 99 turns
of the session read them before anything else, the 10 that do not pay 5.6 KB, and every edit
gains its read round, 3.5 s in the median; the variant, only on a turn where the selector selected
a skill, leaves the 40 edit turns their round. Either is the per-turn snapshot ADR 0015 rejected for
lack of a demonstrated gain and allows back with evidence: the session's first calls above are
that evidence, and benchmark 07's edit turn its measurement.

### 4.3 What it costs

| Cost | Size |
|---|---|
| The selector's call | one request per turn, about 1 KB in and a dozen tokens out; its seconds on every turn, estimated 1–2 s, measured in 07. The 9 turns of the session without a read and the 10 looks that read gain nothing from it |
| The first request of a kitchen creation | grows by 35,685 bytes (the kitchen skill with its reference), 5,631 (the live sections) and 5,658 (the image skill) for an image: about 47 KB, roughly 12,000 tokens after the cached prefix, about 150 ms of prefill at 13 ms per 1,000 tokens |
| The first request of an edit turn | 5.6 KB; a skill the selector names for an edit, 36 KB once per conversation |
| The create as the first call of the turn | the first call of a turn is the slowest call of benchmark 06 to its response headers (3.0–3.5 s against 1.9–2.7 s for call 2): the cache write of the prefix and the upload of the full request. That part moves into the create call and does not go away; the gain of a creation is the round's model time minus it |

Expected on the build of A, benchmark 06 as the baseline: a creation 1–3 s earlier (call 1's
3.3–4.9 s minus the selector and the moved prefix work), an edit 2–5 s earlier (its read round, 3.5
s in the median and 6.1 s at the p90, minus the selector). The reasoning of the create call stays
what it is (C).

### 4.4 Risks

- **The model reads the supplied input again.** Benchmark 03 shows it does not for the live state
  and the image skill; the room skill supplied is new in 07. A read after the supply is a wording
  matter of the labels and the system prompt, not a guard.
- **A wrong selection.** None where a skill was due: the model fetches it, a round, as today. A
  skill the model would not have fetched: 36 KB once per conversation. The France skill: the
  selector has the same rule as the system prompt and the user's words.
- **The selector's tail.** Bounded by its limit; the turn goes on as today.
- **Large plans.** The live sections of a plan with 100 groups are 2.3 MB (the preflight of
  benchmark 03); the model reads the same through the tool when it changes such a plan, on a
  question turn it is waste. The plans of the ligna-store hold one kitchen; not solved here, noted
  in [§8](#8-measurement-gaps).
- **Two lifecycles for the window to abort**: the selector's call and the turn's stream share the
  turn's abort signal, so a stop in the window ends both.

## 5. Alternatives, rejected

| Alternative | Why not |
|---|---|
| No model: the words of the skill index matched against the user's text, plus the image | Measured on the session's 79 first turns: a word match for kitchen, living room and image names every skill the model fetched in 13 of the 40 turns that fetched one, misses 27 ("add three base cabinets to the left wall", "add a sideboard of three low cabinets", "replace the middle unit with a cabinet with drawers" fetch the kitchen or the living-room skill without naming the room) and names a skill in 6 turns where the model fetched none ("which front colours can I choose for the kitchen?", "delete the kitchen"). The skill of a request is in the furniture vocabulary and the plan, which a word list does not hold |
| The planning model as its own selector, a first call with the short input | A call of the planning model with the full prefix is the round G wants to save: 3.3–4.9 s |
| The skill derived from the plan — a kitchen in the plan, the kitchen skill | Library knowledge in the host; an empty room says nothing; the region stays unknown |
| Every room skill supplied on the first turn, or all skills in the shared prefix | Variant C of [the shared-reference benchmark](../benchmarks/planning-assistant-prompt-caching.md#content-variant-results-and-decision): every turn pays for every room's guidance (ADR 0014) |
| The skills only, the live sections on demand | The read stays in call 1 and the create at call 2: no round saved ([§3](#3-the-gap)) |
| The live sections only with a selected skill | The variant of [§4.2](#42-what-the-turn-supplies): it leaves the 40 edit turns of the session their read round; decided in §9 |
| Benchmark 03's preloads as they were | The image skill by a fixed name in the host and no room skill: ADR 0015. G supplies what the model needs for its first call, selected per request |
| The selector only on the first turn of a conversation | Saves its seconds later, misses a later image or another kind of room; kept as the rule to add if the measured cost on edit turns asks for it ([§4.1](#41-the-selector)) |
| The selector started beside the planning model's first call, the call restarted when the selection comes | Two calls where one is due; the restart costs what it saves |
| The selector plans too — a structured create payload from the small model | The router routes; the planning stays with the planning model and the create's reasoning is C's matter |

## 6. Benchmark 07

The measurement of G, run with [the timing benchmark skill](../skills/hi-mcp-timing-benchmark.md)
as part of the implementation:

| Setting | Value |
|---|---|
| Provider | `"provider": "gpt-6-astra", "apiKey": "$AZURE_GPT_KEY"` — the Azure deployment, as for every benchmark from 06 on; provider-default reasoning, no request pacing |
| Selector | the `gpt-5.4-mini` deployment of the same resource at a low reasoning effort (`HI_CHAT_SELECTOR_MODEL`), or a GPT-6 Luna deployment if the resource has one |
| Tests | `image-kitchen-left-wall` and `full-kitchen-walnut-marble-corner` as in 06, and `place-group-move-kitchen` — "move the kitchen to the left wall" on the three-tall-units plan, run 01 of the session: first call 8.0 s, first result 12.5 s, 4 model calls — as the edit turn |
| Repetitions | two per test, fresh conversations: six runs, about ten minutes and 3 million input tokens plus the selector's |
| Planner and embedding-lib | the local dev server on :5173 of the roomle-ui branch with A and G, and the local embedding source of the same checkout through the import overrides of [the setup guide](../../docs/setup/unreleased-embedding-lib.md), as benchmark 03 ran: no embedding-lib build before the measurement |
| Collector | the collector of benchmark 06; the selector's request is told apart by the model of its body and reported as a step of its own |
| Report | `.agents/benchmarks/07-…` with the tables of the timing skill; a row in [the comparison of the Azure series](../benchmarks/az-cmp-2026-10-27.md) |

**Accepted when**, in every run:

1. the create of a creation run, and the `place-group` of the edit run, is the planning model's
   first call; no call before it reads the live sections or fetches a supplied skill, and the
   selector named the skills due — the kitchen skill, with the image skill for the image;
2. the selector's call, measured, is shorter than the round it replaces — call 1 of benchmark 06,
   3.3–4.9 s; the first call of run 01, 8.0 s;
3. the kitchens are those of benchmark 06 and the move is the move of run 01;
4. the first kitchen and the first result are not later than in benchmark 06 and run 01 beyond the
   spread of two repetitions — 4.0 s for the text kitchen and 6.7 s for the image kitchen in 06,
   which is why criteria 1 and 2 decide and 4 guards; expected 1–3 s earlier for the creations and
   2–5 s for the move.

A supplied input the model reads again sends the design back to its labels and the system prompt.
The selector stays out when criterion 1 or 2 fails; the live sections per turn are decided on the
edit runs on their own: they stay when the `place-group` comes at call 1 and the first result is
earlier, even if the selector goes.

## 7. Code and documents the work would touch

| Repository | Code and tests | Documents |
|---|---|---|
| roomle-ui | `packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts` (the selector call with its limit, the held skills derived from the history, the supplied skill messages, the live-state message, `selector` of `PlanningAssistantConfig`, the selector's step in the usage record); `homag-intelligence/src/hi-agent-prompts.ts` and `external-object-api.ts` (`skillSelection`, the supplied-state sentence); `tests/unit/embedding-lib/homag-intelligence/hi-planning-assistant.spec.ts` (the selector is asked with the planner's prompt, the user's text and the image note; the names of its answer are filtered by the planner's list; the selected skills are read with `get-skill` and sent before the user message and retained; a skill the conversation holds, supplied or fetched by the model, is not supplied again; the live sections are sent per turn and not retained, and the library message's bytes stay; no selector in the config, no call; a failed, empty or slow selection supplies nothing; the usage record carries the selector's time and names); `hi-planning-azure.spec.ts` and `hi-planning-openai.spec.ts` (the wire order: reference, history, live state, skills, user); `hi-planning-continuation.spec.ts` (a rejected continuation re-sends the turn-local messages); `__tests__/hi-agent-prompts-test.ts` (the selection prompt names every skill of the planner and asks for none on a question; the supplied-state sentence) | `.agents/homag-intelligence/agent-architecture.md` (the timeline of a kitchen turn, the rows "Skill contents" and "Live plan context" of the information table); `prompt-caching.md` (the request order, the skill lifetime); `hi-tools-behaviour.md` (D119 reworded, a decision row for the selector and the supplied state); a new ADR, the skills of a turn selected before the first call and the plan state supplied per turn, which supersedes the per-turn part of ADR 0015 |
| roomle-hi-example | `minimal-hi-example/start.mjs` (`HI_CHAT_SELECTOR_MODEL` into `selector` of the served config) and `minimal-hi-example/tests/start.test.js`; the collector of the benchmarks (the selector's request); the benchmark session and `07-…` report, the Azure comparison | this analysis; [the time-to-first-attempt analysis](planning-assistant-time-to-first-attempt.md) (G's state, §2, §7, §10); `docs/ai-chat.md` (the selector model); `.agents/context/hi-mcp-server.md` (the launcher's config); the indexes |
| ligna-store | `hi-mcp/chat-options.ts` (the selector of the config) and its tests; the embedding-lib pin after the build | — |

## 8. Measurement gaps

- The selector's time is estimated: no retained run has a call of a small model with a short
  input; the session's 3.5 s of a round are gpt-6-astra's with the full prefix. Benchmark 07
  measures it as a step.
- The wait before a call's first output does not separate queueing, prefill, the cache write and
  reasoning; how much of call 1's 3.3–4.9 s moves into the create call as the first call of the
  turn is what criteria 2 and 4 observe together.
- Two repetitions give the shape and a range, not a p95; the spread of benchmark 06 is larger than
  the expected gain of a creation.
- The ligna-store's plans and the size of their live sections are not measured; the 2.3 MB of a
  100-group plan come from benchmark 03's offline preflight.

## 9. Decisions to take before the plan

1. **The live sections on every turn** (recommended) or only with a selected skill — either
   supersedes the per-turn part of ADR 0015, with the session's first calls as the evidence it asks
   for and benchmark 07's edit turn as the measurement.
2. **The selector** is a matter of the choice of the models, decided later: its deployment, its
   effort and its skip rule are in [the backlog item](../backlog/planning-assistant-skill-selector.md).
   G without the selector is the plan state supplied per turn, decided in 1; it takes the read
   round of the edits and looks (50 of the session's 99 turns) and nothing of a creation, whose
   first call still fetches the skill.
3. **The embedding-lib build** after the code and the measurement on the local source, before the
   example's pin and the ligna-store get it — asked for, as the hard rule says.
