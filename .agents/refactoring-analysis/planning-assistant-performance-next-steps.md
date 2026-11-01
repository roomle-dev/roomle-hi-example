# Planning Assistant performance: what a second of a turn is made of, and the levers that move it

| Field | Value |
|---|---|
| Type / domain | Refactoring analysis / HI Planning Assistant performance |
| Status | Open — proposals; C was implemented and failed (benchmark 14: the walnut kitchen 1.1 s later, the image turn 10.7 s later than the baselines), reverted |
| Date / author | 2026-10-29 / Claude Code |
| Ticket | [RML-18303](https://roomle.atlassian.net/browse/RML-18303) |
| Base | roomle-hi-example `e3f1de2` (`docs/article-catalog-three-levels-analysis`); roomle-ui `da0f50b80` (`feat/hi-mcp-performance`) |
| Evidence | [The two baselines of 2026-10-28](../benchmarks/README.md) and benchmarks 09–13 (`gpt-6-astra` on Azure, the local planner, embedding-lib `0.0.0-dev-1b4351d`); the 79 runs of the test session `.temp/result/mcp-test-2026-10-28_19-47-49` (the same model and embedding-lib on bo-test: 105 turns, 350 model calls, 58 creations); the ticket's description and 50 comments; the code of the tools, the tool commands and the planning assistant |
| Replaces | The analysis of 2026-10-28 in this file. Its section 6 was implemented as D123 and failed ([benchmark 10](../benchmarks/az-cmp-2026-10-27.md#10-against-the-baselines)); its section 7.2 was implemented as the article catalog in three levels and failed ([benchmarks 12 and 13](../benchmarks/az-cmp-2026-10-27.md#12-and-13-against-the-baselines)) |
| Scope | Analysis only. No model run, no deployment change, no embedding-lib build |

Affected repositories:

- **roomle-ui:** the served text (`hi-agent-prompts.ts`, `AUTHORING_RULES` and the tool descriptions of `hi-mcp/hi-mcp-server.ts`); the attribute projection (`hi-mcp/agent-facing.ts`); the create tool command and the group attributes (`hi-tool-commands.ts`, `hi-tool-attributes.ts`) with a calculation without a load in `hi-tools.ts` and the planner API of the tools (`hi-mcp/planner-api.ts`, `external-object-api.ts`, `planner-core/src/roomle-planner.ts`); the skills a request names (`hi-mcp/skills.ts`, the prompts contract); the planning assistant of the embedding-lib (`hi-planning-assistant.ts`); their tests; the behaviour reference and the decisions D23, D36, D70, D115, D122.
- **roomle-hi-example:** this analysis and the indexes; the benchmark reports of the measurements; the pin of the embedding-lib once a build is asked for.

## 1. Conclusion

A turn of the Planning Assistant on `gpt-6-astra` is paid in four currencies, and the test session of 2026-10-28 prices each of them (§3): **a model round costs 2.7 s** before the model writes anything, **a reasoning token 34 ms**, **an output token 14 ms**, and **a calculation and load of a kitchen in the planner 0.5–1.2 s**. Cached input tokens — the library reference, the rules, the tool definitions, the skills — cost nothing the measurements can see. With these four prices the two baselines of 2026-10-28 are reproduced to within a second (§3.2).

The two attempts that failed spent their effort on things that are not currencies: D123 asked the model to arrange its calls differently, and the model did not; the article catalog in three levels removed 7,500–29,000 cached input tokens per request, which cost no time (§2). This analysis proposes only levers that remove a round, output tokens or planner loads, and each has a **structural criterion** that a capture shows without the provider's spread:

| Lever | What goes | Text kitchen | Image kitchen | Depends on the model |
|---|---|---|---|---|
| **A** The skills of a request supplied with it (§5.1) | the skill round before the create | −2.3 s to the first kitchen | −3.3 s | no — a word match in the planner; a miss costs nothing |
| **B** The tool call before the narration (§5.2) | 250–340 characters of text before the create | −1.5 s | −2.1 s | yes — one sentence; the criterion is zero text before the call |
| **C** One calculation and one load per create (§5.3) | two of the three or four loads of a kitchen | −2.0 s | −1.2 s | no — the tool command |
| **D** The finishes of a kitchen in the create (§5.4) | the lookup, the handle edit and the backsplash attempt after the image kitchen | — | −13 to −19 s of the 29 s after the kitchen | partly — the values in the prefix, the create that keeps what calculates |
| **E** The create payload with the defaults (§5.5) | 60–100 output tokens of the payload | −1.0 s | −0.9 s | yes — the examples; small, last |

Projected with the prices of §3 (not measured): the text kitchen comes after **about 18 s** instead of 24.0 s and the turn ends after about 25 s instead of 30.9 s; the image kitchen comes after **about 15 s** instead of 21.4 s and the turn ends after **about 27 s** instead of 50.6 s. The image targets (15–20 s, 25–50 s) are met in the projection, the text final target (20–40 s) too. The text first-kitchen target of **10 s is out of reach of every lever in the code**: the create call alone costs 2.7 s of round, 7.7 s of reasoning (225 tokens) and 7.4 s of payload; without the skill round, without narration and with a 1.2 s planner it still ends at about 17 s. The 10 s target needs the reasoning of the create call near zero, which is the reasoning-effort setting of [RML-18043](https://roomle.atlassian.net/browse/RML-18043), and a payload of about 350 tokens (§6).

The order is C and A first (deterministic, measured without a model run), then B and D (served text and projection, one paid screen), E last.

## 2. Why the two attempts failed, and what this analysis does differently

**D123 — the finishing calls in one response.** The analysis of 2026-10-28 asked the model, in one sentence of the system prompt, to send the handle edit, the backsplash attempt and the render in one response. Benchmark 10 shows the model keeping one call per response in both image runs, with every argument known; the captures do not show what kept the calls apart. The saving was a round budget the model had to grant.

**The article catalog in three levels.** The analysis proposed an overview, article details by id, a category directory and shared descriptions, and benchmarks 12 and 13 measured the whole of it: every request 7,542 input tokens smaller (12) or 29,272 smaller (13), the seconds within the provider's spread, the directory a round later. The tokens it removed were read from the provider's cache; the cost of a cached token is not visible in any capture of the series — benchmark 13's first calls with 41,275 and 38,966 input tokens take 2.3–9.0 s, the text baseline's with 68,238 tokens 1.9–3.2 s.

Both analyses ranked the ideas by the bytes they removed from the request, and both carried a saving the ticket's own evidence had already priced at nothing: comment 9 of the ticket found a round at about 3.5 s with an empty answer and the cache at 97 % on 2026-10-27, and the response-time wiki said before the attempts that the prefill is not where the time goes.

What this analysis does differently:

1. **Every lever is priced in a currency that a capture shows to cost time**: rounds, reasoning tokens, output tokens, planner loads (§3). An idea that only removes cached input is not a lever.
2. **Every lever has a structural criterion** — a count in the capture (calls, tool calls, text characters before a call, price fetches per create, output tokens) — that decides before the seconds are read, because two runs on a shared deployment carry a spread of 2–5 s per call.
3. **The server does the work where it can.** A and C need nothing from the model; D needs the model to keep setting the attributes it sets today; only B and E ask the model to write differently, and both ask for *less* output, which the capture counts.
4. **The ideas of the ticket are each named with their state** (§4), so that nothing already measured is proposed again.

## 3. What a second of a turn is made of

### 3.1 The four currencies

From the 350 completed model calls of the test session of 2026-10-28 (`gpt-6-astra`, Azure Responses, 79 runs, the deployment's default reasoning), the per-call `responseTimeMs`, `timeToFirstOutputMs`, output and reasoning tokens of the usage records; the planner steps from the `planner-calls.json` of the runs:

| Currency | Price | Evidence |
|---|---|---|
| **A model round** — the wait before the first output of a call that reasons nothing and answers with a tool call of up to 60 tokens | **2.7 s median**, 3.3–3.6 s at the third quartile, 4.6–5.2 s at the 90th percentile, 11.7 s at most | 123 such calls; the first call of a turn, which uploads the whole request (about 300 KB), 2.9 s median (47 calls), 0.2 s more than a chained call |
| **A reasoning token** | **34 ms** — the wait for the first output fits 2.9 s + 34 s per 1,000 reasoning tokens over the 113 calls that reason | calls with 0 reasoning tokens wait 2.0 s in the median, 1–100 tokens 3.3 s, 101–300 tokens 7.6 s, 301–600 tokens 18.2 s |
| **An output token** | **14 ms** — 70 tokens per second in the median (45 at the 10th percentile, 86 at the 90th) | the 59 calls with at least 150 visible output tokens, response time minus the first-output wait |
| **A calculation and load of a group in the planner** | **0.5–1.2 s for a kitchen** of 9–17 root modules, 0.3–0.5 s for a row of three | `change-group-attribute` on a kitchen, one calculation and one load: 812–1,099 ms in the session's text kitchens, 882 ms in the image kitchen, 522 and 717 ms in the baselines; `place-group` of a kitchen 1,228 ms |
| A JSON byte of a create payload | 0.34 token — the payloads tokenize at **2.4–3.3 bytes per token** | 22 creates with their visible output tokens and their argument bytes |

**What costs nothing the captures show:** a cached input token (benchmarks 12 and 13, §2); the reads of the tools (the library reference and the plan state 15–20 ms, a skill 1 ms, `find-attributes` 4–120 ms); the upload of the first request (0.2 s); a render (0.45 s).

### 3.2 The baselines, priced

The create call of the baselines, priced with §3.1 (mean of two runs; the measured value in brackets):

| Component | Text kitchen (walnut corner) | Image kitchen (left wall) |
|---|---|---|
| The skill round, call 1 | 2.55 s (measured 2.55) | 3.88 s (measured 3.88, with the image's tokens) |
| The create call: round | 2.9 s | 2.9 s |
| The create call: reasoning, 225 / 162 tokens × 34 ms | 7.6 s | 5.5 s |
| The create call: payload and preamble, 526 / 535 visible tokens × 14 ms | 7.4 s | 7.5 s |
| The create call, together | **17.9 s (measured 18.16)** | **15.9 s (measured 15.39)** |
| The create tool | 3.24 s (measured) | 2.08 s (measured) |
| **First kitchen** | **23.7 s (measured 23.98)** | **21.9 s (measured 21.38)** |
| After the kitchen: the answer | 6.9 s: a round, 27 reasoning tokens, 158 output tokens | — |
| After the kitchen: lookup, backsplash, handles, render, answer | — | 29.3 s: five rounds (13.5 s of round floor), 7.8 and 13.5 s of provider waits without reasoning, the render 0.45 s |
| **Turn** | **30.9 s** | **50.6 s** |

The create call is the largest block in both, and its three parts are of the same size: the round, the reasoning and the payload. The preamble the model writes before the create — "I'll build an L-shaped kitchen in the back-right corner…", 272 / 255 characters in the text runs, 326 / 339 in the image runs — takes 1.49 / 1.42 s and 2.15 / 2.08 s between the first text and the start of the tool input.

Of the 29.3 s after the image kitchen, 13.5 s are the floor of five rounds and 21.3 s (run 2's lookup wait of 13.5 s, run 1's backsplash wait of 7.8 s) are the provider's tail on calls that reason nothing: every round removed removes its floor and its exposure to that tail. In the session, the 11 kitchen creations spend 12–73 s of model time after the create in 1–9 rounds; the image kitchens 5–9 rounds.

### 3.3 The targets against the prices

| Milestone | Target | Baseline | What the target leaves for the create call |
|---|---|---|---|
| Text: first kitchen | 10 s | 24.0 s | with no skill round and a 1.2 s planner: **8.8 s** — the round (2.9 s) and a 460-token payload (6.4 s) alone exceed it; the reasoning (7.6 s) has no room |
| Text: final result | 20–40 s | 30.9 s | met; the levers bring it to about 25 s |
| Image: first kitchen | 15–20 s | 21.4 s | with no skill round, no narration and a 0.9 s planner: about 15 s |
| Image: final result | 25–50 s | 50.6 s | met at the upper end; the rounds after the kitchen are the lever |

"Image interpreted" has no marker and gets none here: the model reads the image inside the create call, and no event of the stream separates the reading from the planning.

## 4. The ideas of the ticket and of the earlier analysis, and their state

| Idea | State | Where it stands |
|---|---|---|
| Prompt caching | in place (ADR 0014, the Azure boundary, response chaining) | the first call reads 68,235 of 68,238 tokens from the cache; the wait of a round is not prefill |
| The plan context with every prompt | in place (ADR 0016, D121) | the edits gained 7 s; a creation gains nothing by design |
| The image skill with the first image | rejected (ADR 0015, D115) on benchmark 03, where the kitchen skill still took a round | **A reopens it** with the kitchen skill supplied as well, so the round goes |
| The input image scaled down | in place | 2,000 of 70,000 tokens; nothing to save |
| The plan images scaled down (JPEG) | in place (D117) | the images call costs a round, not bytes |
| Tool memoization | nothing to save | the reads take milliseconds and no tool is called twice with the same input |
| Precalculated docking vectors | in place as the library read before the first prompt (F) | 0.75 s of the first prompt of a page |
| Attribute indexing | in place as the two-level attribute section (D122) | **D extends it** by the attributes of the same library group |
| Selective retrieval, the catalog in levels, shared descriptions | rejected (benchmarks 12 and 13) | cached tokens cost nothing; the directory costs a round |
| One skill round with the reference (A of the earlier series) | in place (D120) | the reference round is gone |
| The status line at the tool input (B of the earlier series) | in place | feedback, not time |
| Renders and reads when due (E of the earlier series) | in place (D118, D119) | the text kitchens render nothing |
| The skill selector with a second model (G) | backlog, deferred to the choice of the models | **A takes the round without a second model**; the selector stays for the prompts a word misses |
| The finishing calls in one response | rejected (D123, benchmark 10) | **D removes the calls instead of arranging them** |
| Generate the action before narrating it | not tried | **B** |
| Structural attribute families | not tried; the earlier analysis kept it as a comparator | **D**, with the numbers of §5.4 |
| The reasoning effort of the create call | out of scope here (RML-18043) | the only lever on 7.6 s of the text kitchen (§6) |

## 5. The proposals

### 5.1 A — The skills of a request supplied with it

**Finding.** Every creation spends its first model call on `get-skill`: 2.55 s in the text baseline, 3.88 s in the image baseline, 22–55 output tokens, no reasoning — a round that carries nothing but the name of a skill. In the session, 32 of the 79 first turns fetch a room skill before they plan, and the create is the second call in 10 of the 11 kitchens.

**Cause.** The system prompt names the skill for each kind of room and says to fetch a missing one; the host supplies none, so the model's first call is always that fetch. ADR 0015 rejected a preload of the image skill, measured when the kitchen skill still needed a round; the selector backlog waits for a second model. Nothing reads the user's text before the first call.

**Target shape.** The planner serves, with the agent prompts, the words that name each skill — `skills: [{ name, words }]` beside `systemPrompt` and `referenceBlocks` of `getExternalObjectAgentPrompts()` (`hi-agent-prompts.ts`, `skills.ts`): for `kitchen-planning` the kitchen and its appliances in the languages the planner serves (kitchen, Küche, cuisine, hob, oven, sink …), for `kitchen-planning-fr` the same words with France, for `living-room-planning` the living room, the sideboard, the media unit and the TV, for `image-planning` no words — it is due with every image. Before the first model call of a turn, the planning assistant (`hi-planning-assistant.ts`) matches the user's text against the words, adds the image skill when the message carries an image, drops every skill the conversation already holds — a supplied message or a `get-skill` result in the history — and reads each remaining one through its own `get-skill` tool, as it reads the library reference. The skills go into one user-role message, "Supplied skill files:", after the plan state and before the user message, and are retained with the user message on success, so a later turn does not supply them again. The system prompt already says "Use supplied skill files; fetch missing skills and references with get-skill", so the model's behaviour on a supplied skill is the behaviour it has on a skill it fetched. No word in the text, no image: nothing is supplied, and the turn runs as today.

**What a miss and a false positive cost.** A prompt the words do not name ("add three base cabinets to the left wall", which fetches the kitchen skill) runs as today — the model fetches the skill in its first call; nothing is lost. A skill supplied where the model would not have fetched one ("delete the kitchen") costs its 35,685 bytes once in that conversation, read from the cache in every later call: the currency that costs nothing (§3.1). The asymmetry is why a word match is enough here where the selector backlog found it insufficient as a replacement of the model's judgement: it was measured as a selector that must be right, not as a supply that may be silent.

**Coverage in the session** (the word list above, the 79 first turns): the words name the fetched skill in 17 of the 32 turns that fetch one, both benchmark fixtures among them; they miss 15 (prompts that name cabinets, not the room); they name a skill in 9 turns that fetch none, all of them edits and questions about a kitchen.

**Opportunity.** The create becomes the first call: −2.55 s in the text kitchen, −3.88 s in the image kitchen, less the first call's upload (0.2 s) and, for the image, the reading of the image that moves into the create call (about 0.4 s): **about −2.3 s and −3.3 s** to the first kitchen and to the turn. The supplied skill's 9,000 tokens are new input of the first request (about 0.1 s of prefill at the session's rate) and cached afterwards.

**Scope and tests.** roomle-ui: `hi-agent-prompts.ts` (the contract), `hi-mcp/skills.ts` (the words per skill; the skill files stay as delivered, D75), `roomle-planner.ts` (`getExternalObjectAgentPrompts` carries them), `hi-planning-assistant.ts` (the match, the read, the message, the retention). Tests: `__tests__/hi-agent-prompts-test.ts` (every skill of the planner has its words, the French one France), `tests/unit/embedding-lib/homag-intelligence/hi-planning-assistant.spec.ts` (a kitchen prompt supplies the kitchen skill before the user message; an image supplies the image skill; a prompt without a word supplies nothing; a skill in the history is not supplied again; a failed read supplies nothing and the turn runs), the Azure wire spec (the message's role and place). Decisions: D115's image part is superseded for the reason ADR 0016 gave for the state (the round goes only when every skill of the request comes with it); the selector backlog keeps the misses. Structural criterion: the create is model call 1 in every run of both fixtures, and no call of the turn fetches a skill.

### 5.2 B — The tool call before the narration

**Finding.** Every create call opens with a paragraph that announces the plan — 255–339 characters, 60–80 output tokens — before the tool input starts: 1.49 / 1.42 s in the text baseline, 2.15 / 2.08 s in the image baseline, measured from the first text delta to the `tool-input-start` of the create. The render call of the image kitchen does the same before `get-plan-images` (379 and 139 characters in benchmark 10).

**Cause.** The system prompt says "Call tools instead of describing what you would do, then summarize what you changed", and `SKILL_IN_SESSION` asks for "a concept with stated assumptions" named "in your answer". Neither says that the call comes first and the assumptions after the result; the model states them before the call as well, and the answer repeats them.

**Target shape.** The [opening response of a planning turn](../../docs/ai-chat.md) requires one brief sentence about the requested action before detailed planning, in the user's language, followed by tools in the same turn. That approved requirement replaces this proposal's zero-text-before-tools criterion. Keep the short intent response; put detailed assumptions, substitutions and open checks in the confirmed answer after the tools. `SKILL_IN_SESSION` already says "name them in your answer". The status line continues to name a tool at `tool-input-start`.

**A second step to measure with it:** the Responses API's text verbosity. The pinned OpenAI adapter (4.0.81) takes `textVerbosity` among its Responses options, and the Azure adapter forwards those options under its own key, as it forwards `reasoningEffort` (`loadChatModel`, `hi-planning-assistant.ts`; the wire spec verifies the request); `low` shortens every text the model writes — the preamble, the summary before a render, the final answer (158–205 tokens, 2.2–2.9 s of the text turn) — without a sentence the model may ignore. It is a configuration of the assistant, measured as a variant of its own, not the default until measured.

**Opportunity.** The measured 1.4–2.1 s of the long create preamble is an upper bound on the narration that could be removed, not a saving this feature can claim: its short opening also takes output time. Measure first response, first kitchen and completed answer separately. The opening must describe the prompt, occur in the first model response before tool use, and be followed by actual execution. The verbosity option remains a separate experiment and is not part of this feature.

**Scope and tests.** `hi-agent-prompts.ts` and `__tests__/hi-agent-prompts-test.ts` for the opening contract; `hi-planning-assistant.spec.ts`, `hi-planning-continuation.spec.ts` and `PlanningAssistantChat.spec.ts` for immediate forwarding, phase/history preservation, continued tool work and rendering. The tool definitions and their fixture do not change. Real model captures decide whether first text arrives earlier; mock tests establish the stream lifecycle only. If it remains late, record that result rather than claim a performance improvement or silently add another model.

### 5.3 C — One calculation and one load per create

**Finding.** `create-or-replace-groups` costs 3.47 / 3.00 s for the text kitchen and 2.01 / 2.15 s for the image kitchen; 3.3–8.1 s in benchmark 06; 2.3–4.1 s for the kitchens of the session. One calculation and load of a kitchen costs 0.5–1.2 s (§3.1). The planner refreshes its price three times per text create in the baselines (21.796–23.760 s, 24.310–24.948 s, 24.949–25.710 s in run 1), once per publication of the groups — one per load.

**Cause.** The command (`hi-tool-commands.ts`, `'create-or-replace-groups'`) loads a group placed at a wall up to four times, each a library calculation, a kernel load and a publication to the host:

1. `loadExternalObjectGroupLayout` at the origin — the width a wall placement needs exists only after the calculation (D23);
2. `placeAtWalls` → `loadExternalObjectGroupLayout` at the wall, `reason: ADJUSTED`;
3. `placeOnceMoreAsBuilt` → a third load when the library built the group otherwise at the wall — wider end units, no worktop overhang at the wall (D70);
4. `applyGroupWideAttributes` → `change-attributes`, a calculation and a load for the fronts, the worktop and the carcase, after the last reload because the planner answers an attribute command before the calculated group carries the values (D36, D23).

D23 rejected "a probe of the whole group and one load at the target" because every call would calculate the group twice. It does so today, and loads it two to four times.

**Target shape.** The tools calculate first and load once. `hi-tools.ts` gains, beside `_loadGroupLayout`, a calculation without a load for the planner API of the tools: `calculateExternalObjectGroupLayout(layout)` — `_calculatePosGroupsLayout` with the verdict of D106 (a group the library cannot calculate leaves the group map, a replaced one gets its calculated snapshot back), no kernel load, no `groupsModified`, no price — answering the calculated groups with their footprint and generated roots; and `loadCalculatedExternalObjectGroups(ids, options)` — the kernel load and the one publication of groups the map holds. The command then runs: calculate at the origin → `wallTarget` from the calculated footprint, as `placeAtWalls` computes it today → the group attributes applied to the calculated group (`modifyAttributesOfModules` on the group item, the verdict of D106) → one calculation at the target with the attributes → one load. The as-built check of D70 stays as a check: a group calculated at its target carries its wall distances, so the library builds its ends for the wall in that calculation, and the measure stands as asked; the reload of D70 stays as the fallback for the case it does not. The result, the corrections, the hints and the undo record keep their content; the undo record counts one step instead of two to four (D47).

**Opportunity.** The create tool at about one load: **−2.0 s** for the text kitchen (3.24 → about 1.2 s), **−1.2 s** for the image kitchen (2.08 → about 0.9 s), on the first kitchen and on the turn, in every run. Structural criterion: one price fetch per create in the capture, the tool below 1.5 s for the text fixture and 1.2 s for the image fixture, the saved plans those of the baselines.

**Measured first, without a model.** A replay of the two baseline create payloads through `instance.extended.callExternalObjectAgentTool` in a headless page on the local planner, opened as [run-hi-mcp-prompt.js](../scripts/run-hi-mcp-prompt.js) opens it, without a model, the price fetches and the tool's elapsed milliseconds captured as the timing collector captures them: the count of loads and the cost of each on the current build, then the same on the build with C. No model token is spent.

**Scope and tests.** roomle-ui `hi-tools.ts`, `hi-mcp/planner-api.ts`, `external-object-api.ts`, `roomle-planner.ts` (the two methods), `hi-tool-commands.ts` (the create and `place-group`, which shares `placeOnceMoreAsBuilt`), `hi-tool-attributes.ts` (the attributes before the load). Tests: `__tests__/hi-tool-commands/create-or-replace-groups-placement-test.ts` and `place-group-test.ts` carry the placements, the as-built case, the overlap corrections and the attribute order (`programsFirst`); they change their expectation of the planner calls — one load — and keep every expectation of the results; `__tests__/hi-tools-test.ts` for the calculation without a load (D106's discard, the replaced group's snapshot, no publication). Decisions D23, D36 and D70 are rewritten to the one-load order. Not touched: `glue-logic.ts` (the hard rule); the library's calculation.

**Implemented and failed.** The replay of the two kitchens shows the create tool 1.0 to 1.4 s faster with one load; [benchmark 14](../benchmarks/az-cmp-2026-10-27.md#14-against-the-baselines) shows the create tool at 1.0 / 0.6 s against 3.2 / 2.1 s, but the walnut kitchen 1.1 s later and the image turn 10.7 s later than the baselines in the mean of two runs. roomle-ui d5904ab2f reverts 7a9f50fc8; D127 of the behaviour reference records the rejected proposal. The one load at a wall needs the kernel's plan answer, which the plain load reason does not ask for.

### 5.4 D — The finishes of a kitchen in the create

**Finding.** After the image kitchen, both baseline runs look up the handle colour, set the handles black and try the backsplash, one round each: 2.2 + 3.4 + 8.6 s in run 1, 14.1 + 3.2 + 2.8 s in run 2 — **14.2 and 20.1 s** of the 27.7 and 30.8 s after the kitchen. In the session, every image kitchen makes 5–9 calls after its create, with `find-attributes` and `change-group-attribute` among them; the text kitchens 1–8.

**Cause, in the served text.** The authoring rules say "an attribute with valueCount keeps its article's value until you change it after the create", and D122 lists the values of the attributes the catalog names per root module, the group settings and the generated modules: the handle design is among them, the handle colour and position are not — they carry `valueCount`. The image skill says to read "the fronts, the handles, the worktop and the carcase from the image and set them as attributes of the group, with the values the attribute vocabulary offers". For the handles, the vocabulary offers no values, so the model looks them up and sets them in a round of their own, as the rules tell it to. Before D122, the creates set them in the create: 14 of 49 creates of the session of 2026-10-27 set such an attribute, every create of the two baselines of that day.

**Cause, in the tool.** The backsplash switch is listed — run 2 of the baseline sets it without a lookup —, and the library cannot calculate it ([library issue 10](../backlog/library-issues.md#10-backsplashes-the-library-cannot-calculate)). A group attribute the library cannot calculate discards every group attribute of the create's `change-attributes` command: `applyGroupWideAttributes` sends them in one command, and on `DiscardedChange` reports "the group attributes A, B, C were not set — nothing was changed" — the kitchen stands without its fronts. The model's separate round for the backsplash is the safe path the tool leaves it.

**Target shape.**

1. **The values of the same group** (`createAttributeIds`, `agent-facing.ts`): an attribute whose library `group` path is the complete path of an attribute the create criterion selects gets its value list too; the library's grouping is data, no attribute is named. The retained probe on the sections of 2026-10-27 (`.temp/rml-18303-analysis/attribute-family-probe.json`): 31 more value lists, the handle colour, position, length and matrix among them, 102 → 71 `valueCount` entries, **+16,191 bytes (about 4,300 cached tokens)** of the attribute section. A library whose attributes carry no groups keeps the criterion of D122.
2. **The create keeps what calculates** (`applyGroupWideAttributes`, `hi-tool-attributes.ts`; with C, before the one load): when the library discards the combined attribute command, the tool applies the attributes one by one, keeps every one the library calculates, and names each one it could not set with the library's message in `corrections` — "the group attribute mod_X was not set on group G: <message>; the others are set". Only a failure pays the extra calculations. The rule for results says that such an attribute is not sent again in the turn; the answer names it.
3. **The rule** keeps "in the create, set the attributes whose values the section lists"; the sentence on `valueCount` stays for the attributes that still carry it.

**Opportunity.** The image kitchen's lookup and handle rounds go in both runs (−5.6 s and −17.3 s), the backsplash round goes when the model sends the switch with the create as the image skill asks (−8.6 s and −2.8 s); the create grows by three attributes (about 40 output tokens, 0.6 s) and whatever reasoning they add. **−13 to −19 s** of the 29.3 s after the image kitchen; the first kitchen about 0.5–1 s later. The earlier analysis ranked this a comparator behind "layout first, finishes afterwards"; the prices say the finishes cost half a second in the create and 14–20 s after it, and the layout is still what the create builds first. Structural criterion: no `find-attributes` and no `change-group-attribute` after the create in the image runs; black handles and the olive fronts in the saved plan; the backsplash named in the create's corrections and in the answer.

**Scope and tests.** roomle-ui `agent-facing.ts` and `describe('the values of the attributes a planning sets at the create')` in `__tests__/hi-mcp/tool-executors-test.ts` (the group path, an empty group, a second library with other groups, the shared lists); `hi-tool-attributes.ts` and `create-or-replace-groups-placement-test.ts` (one attribute the library discards: the others set, the one named; all set: one command); `AUTHORING_RULES` and `hi-mcp-server-test.ts`; the fixture. D122 is extended, D36 and D106 get the kept attributes. The library-neutral policy holds: the group path is the library's structure, the failing attribute is named by its id from the call.

### 5.5 E — The create payload with the defaults

**Finding.** The create payloads carry 1,230–1,800 bytes for 9–14 root modules: an id of the model's choice on every root ("sinkdrawers", "landingwall"), a relation on every root but the first, 2.4–3.3 bytes per token, 500–600 visible tokens, 7–8 s of streaming. The rules allow less: "a root without a relation continues the row of its kind", and an id is needed only where another root names it.

**Target shape.** The examples of `AUTHORING_RULES` show the defaults — a row as a list of article picks, an id only on a root another root names — and the rule's "corrections says so" for a root without a relation goes: a default used is no correction. The schema stays.

**Opportunity.** On the five payloads of the baselines and the session, the form with the defaults and two-character ids is 176–281 bytes shorter: **61–97 tokens, 0.8–1.4 s** of the create call. It is the smallest lever and the one most dependent on the model's habit; it is served text only (`hi-mcp-server.ts`, `hi-mcp-server-test.ts`, the fixture) and rides along with B's screen. Structural criterion: the create's visible output tokens; the plans unchanged.

## 6. What the levers give, and what they do not

Projected with the prices of §3.1 from the means of the baselines; a projection, not a measurement:

| Milestone | Baseline | A | B | C | D | E | Projected | Target |
|---|---|---|---|---|---|---|---|---|
| Text: first kitchen | 23.98 s | −2.3 | −1.5 | −2.0 | — | −1.0 | **about 17–18 s** | 10 s |
| Text: final result | 30.92 s | −2.3 | −1.5 (−2.5 with the verbosity) | −2.0 | — | −1.0 | **about 24–25 s** | 20–40 s |
| Image: first kitchen | 21.38 s | −3.3 | −2.1 | −1.2 | +0.7 | −0.9 | **about 14–15 s** | 15–20 s |
| Image: final result | 50.64 s | −3.3 | −2.1 | −1.2 | −16 (+0.7) | −0.9 | **about 27–28 s** | 25–50 s |

**What stays.** The create call keeps its round (2.9 s), its reasoning (7.6 s for the text kitchen, 5.5 s for the image) and the payload that remains (about 5–6 s). Those three are 16 s of the 17–18 s projected for the text kitchen, and they are the model's: the round is the deployment's latency on a cached context of 70,000 tokens (benchmark 13 shows no smaller round on 41,000), the reasoning is the deployment's default effort, the payload is the kitchen.

**The 10 s text target** therefore needs what this analysis does not change: the reasoning-effort setting of [RML-18043](https://roomle.atlassian.net/browse/RML-18043), which is the only lever on the 7.6 s — at 34 ms a token, a create that reasons with 50 tokens instead of 225 saves 6 s —, and the payload of E. With both, the create call is about 2.9 + 1.7 + 5.2 = 9.8 s, the kitchen after about 11 s. The target is reached, if at all, by RML-18043 on top of A–E; it is not promised here.

**The provider's tail.** 10 % of the rounds wait 4.6–5.2 s or more for a first output without reasoning, the longest of them 11.7 s; the image baseline's post-create calls hit it twice (7.8 s, 13.5 s). A and D remove four of the image kitchen's seven rounds and with them most of the exposure; nothing in the code shortens a tail the provider owns, and a resend doubles a legitimate long reasoning (the watchdog stays rejected).

## 7. Not proposed

| Candidate | Why not |
|---|---|
| The skill selector with a second model (backlog G) | A takes the round without a second model, a second config per host and a second key; the backlog stays for the prompts a word misses, 15 of 32 in the session |
| The skills in the shared prefix | A supplies only the skills of the request, and the prefix stays what ADR 0014 made it; a prefix with every room's skill would cost nothing measurable per the prices, but no capture says what a model that holds every room's skill on every turn applies, and a supplied skill is read as a fetched one is |
| The catalog in levels, selective retrieval, shared descriptions, trimmed tool definitions, a smaller image | cached input tokens, the currency that costs nothing (§2, §3.1) |
| The finishing calls in one response (D123) | the model keeps one call per response; D removes the calls instead |
| A batch tool, an ordered tool contract, a render with every edit | D123's rejected alternatives stay rejected: the queue orders the calls, and D118 keeps the render to when it is due |
| Tool memoization, an attribute index, a cache of the compacted library | milliseconds (§3.1) |
| A partial kitchen first, the tool input streamed into the planner | a group is laid out from its relations; half a kitchen is one more round |
| A watchdog or a hedged request on a stalled call | doubles the cost of a legitimate long reasoning; the tail is the provider's |
| The skills trained into the model | the rules change with the library and the region; the round and the reasoning do not move |
| A change of the price refresh | three fetches per create because of three loads; C leaves one, and the fetch runs beside the turn, not on its path |
| A change of the library's calculation, of `glue-logic.ts`, of the delivered skill files | out of bounds (the hard rule, D75) |

## 8. The order of the work, the tests and the benchmark

### 8.1 Order

1. **C** — measured model-free before and after (the replay of §5.3), its unit tests, the decisions. Implemented, failed in benchmark 14, reverted (§5.3).
2. **A** — its unit tests; the match checked against the prompts of `docs/test-prompts.json` and the session's 79 prompts without a model (a script over the prompts and the fetched skills of `planner-calls.json`, as §5.1's numbers were made).
3. **B, D and E** — served text and projection; their unit tests and the fixture.
4. **One paid screen** of the build with A–E (§8.3). Then the minimum test set on the build before anything is merged — a served-text change holds for every model ([the testing skill](../skills/hi-mcp-testing.md)).
5. The embedding-lib build for A and B's verbosity option, asked for; the pin in `minimal-hi-example/index.html`.

### 8.2 The tests, per proposal

| Proposal | Guarded by |
|---|---|
| A | `hi-agent-prompts-test.ts`: every skill has its words, the French skill France; `hi-planning-assistant.spec.ts`: the supplied message and its place, the image skill with an image, nothing without a word, a held skill not supplied again, a failed read; `hi-planning-azure.spec.ts`: the wire |
| B | `hi-agent-prompts-test.ts`: the sentence; `hi-planning-azure.spec.ts`: the verbosity option on the request when configured, absent otherwise |
| C | `create-or-replace-groups-placement-test.ts`, `place-group-test.ts`: one load per create, the as-built fallback, the overlap corrections, the attribute order, the undo steps; `hi-tools-test.ts`: the calculation without a load and D106's verdict in it |
| D | `tool-executors-test.ts`: the values of the same group, a library without groups, a second library; `create-or-replace-groups-placement-test.ts`: a discarded attribute named, the others set; `hi-mcp-server-test.ts`: the rules |
| E | `hi-mcp-server-test.ts`: the examples with the defaults, no correction for a default used; `create-or-replace-groups-input-test.ts`: a row without relations and without ids builds |

Every served-text change updates `packages/web-sdk/packages/test-helpers/unit/hi-mcp-fixture.json`; every decision changed updates roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md` (D23, D36, D70, D106, D115, D122, a row each for A–E) and `prompt-caching.md` for A and B.

### 8.3 The benchmark

**Before, without a model:** C's replay on the current build and on the build with C — the loads, the price fetches and the tool's milliseconds of the two baseline payloads.

**The screen:** the two fixtures of the baselines — `full-kitchen-walnut-marble-corner` and `image-kitchen-left-wall`, plan `ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv`, `kitchen-1.png` — two repetitions each on the build with A–E, `gpt-6-astra` on Azure with `$AZURE_GPT_KEY`, the deployment's default reasoning, the local planner, after one warm-up turn, with the collector and in the layout of the baselines ([the timing skill](../skills/hi-mcp-timing-benchmark.md)); the verbosity variant two more runs per fixture if B's sentence alone leaves a preamble. About 5 minutes and 1.3M input tokens, most of them cached; one more pair per fixture when the spread hides a difference. No run before the user's go.

**Read in this order:**

1. The structural criteria, one per lever, from the capture: the create at call 1 and no skill fetch (A); no text before the create's tool input, the visible output tokens of the create (B, E); one price fetch per create and the tool's milliseconds (C); no lookup and no attribute call after the image create, the handles and the backsplash in the result (D). A lever whose criterion fails is reverted on its own; the others stay.
2. The seconds against the baselines of 2026-10-28, mean of two runs, read with the prices of §3.1: the first kitchen and the turn of each fixture, the create call's first-output wait and streaming, the rounds after the kitchen. A lever is accepted when its criterion holds and the milestones it touches are below the baselines' means by more than the baselines' own spread (text: 0.6 s on the first kitchen, 3.7 s on the turn; image: 5.1 s and 1.9 s).
3. The plans: the kitchens of the baselines — the L around the back right corner with walnut fronts and the dark marble worktop; the 3,010 mm row on the left wall with olive fronts, black handles and the backsplash named as missing.

A report per fixture in `.agents/benchmarks/` in the layout of the baselines, and the comparison in `az-cmp-2026-10-27.md`. The response-time wiki's table of the levers in place and of the levers that do not shorten a turn is updated from the result.
