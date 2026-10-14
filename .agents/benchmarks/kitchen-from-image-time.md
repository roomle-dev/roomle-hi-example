# Benchmark: Where the time goes when the HI agent plans a kitchen from an image

> **Type**: Benchmark and performance analysis
> **Domain**: `hi-mcp/hi-mcp-server` (served text, tool results, `create-or-replace-groups`), `hi-mcp/hi-mcp-chat` (step loop); roomle-ui (the group attribute command)
> **Trigger**: [RML-18064](https://roomle.atlassian.net/browse/RML-18064) "HI agent: analyse where the time goes when it plans a kitchen from an image"
> **Date**: 2026-10-08; second measurement 2026-10-13 ([9](#9-second-measurement-2026-10-13-after-the-five-improvements)); third measurement 2026-10-14 ([10](#10-third-measurement-2026-10-14-the-six-improvements-one-after-another))
> **Author**: AI Assistant
> **Status**: Measured — the six improvements of [9.6](#96-proposed-improvements) implemented one after another and measured on one build and the local planner ([10](#10-third-measurement-2026-10-14-the-six-improvements-one-after-another)): 104 s → 75 s, 8.4 → 6.8 steps, 531k → 397k input tokens per run, the saving from the vocabulary section; the second runs of the other three models stay open ([9.7](#97-open-runs-not-made))
> **Data**: [kitchen-from-image-time/benchmark.md](kitchen-from-image-time/benchmark.md) (the baseline, every run step by step), `kitchen-from-image-time/benchmark.json`; the second measurement in [kitchen-from-image-time-2026-10-13/benchmark.md](kitchen-from-image-time-2026-10-13/benchmark.md) and its `benchmark.json`
> **How to repeat**: [hi-mcp-benchmarking.md](../skills/hi-mcp-benchmarking.md)

**Repositories**

- **roomle-hi-example** — this benchmark, the benchmark script and skill, the planner-call timing
  of the run script; improvements 1, 3, 4 and 5 change the MCP server's served text and tool
  results.
- **roomle-ui** — improvement 2: one planner command that sets several group attributes in one
  recalculation; improvement 3 only if several root modules are to be set in one recalculation.
- **ligna-store** — no change; its chat uses the same MCP server, its page bridge already forwards
  `externalObjectGroupOperation`, and it gets the planner command of improvement 2 with the planner
  it embeds.

The ticket asks for the analysis in `.agents/feature-analysis/`; it lives in the new folder
`.agents/benchmarks/` at the user's request (2026-10-08), with the benchmark it is based on.

---

## Executive summary

gpt-6-astra needs **92 s and 10.2 model steps** on average to plan a kitchen from an image — the
baseline of the three tests with two valid runs each (6 runs, 60–140 s);
`image-planning-right-wall` has one valid run and joins the baseline with its second
([6](#6-open-the-other-two-models)). The step analysis below uses all 7 valid runs (95 s and 10.4
steps on average). The chat time is almost all model time (83 %); the tools take 17 %.

1. **The number of steps decides the time.** Every step costs about 4–5 s even when the model writes
   only a tool call; output adds about 11.6 s per 1,000 tokens. The input size barely counts with
   gpt-6-astra: about 13 ms per 1,000 input tokens.
2. **45 % of the time comes after the first `create-or-replace-groups`** — re-reads, attribute edits,
   undos and rebuilds: 300 s of 667 s, the final answers left out.
3. The biggest blocks: the create steps (37 %: about 13 s authoring and 7.5 s tool per create),
   `find-attributes` (21 %, 2.9 steps per run), edits after the create (22 %), re-reads (11 %), the
   final answer (10 %).
4. **Five flaws cost steps or seconds**, each traced to the served text, a tool result or the tool
   API ([4](#4-flaws-that-cost-steps-and-time)). The tool description of `find-attributes` names "the
   front colour" as its example; the library spells it "Front color", and that search finds
   nothing.
5. **Input tokens cost money, not time.** 699k input tokens per run in the baseline. 62 % of all
   input tokens are the first step's results (article catalog and rules), sent again in every later
   step. The catalog's article descriptions alone are 49 % of the catalog.

The five improvements in [5](#5-proposed-improvements) were expected to save about 30–40 s of the
92 s (about 4–6 steps) and a quarter to a third of the input tokens. The runs since they landed
average 49 s, 5.4 steps and 268k input tokens on three builds and two planners: that describes the
state since, not what the five improvements saved ([9](#9-second-measurement-2026-10-13-after-the-five-improvements)); the like-for-like runs are open
([9.7](#97-open-runs-not-made)). Each one says what it changes and what it
saves. The other two models of `docs/test-prompts.json` need runs before their breakdown exists
([6](#6-open-the-other-two-models)).

---

## 1. What was asked

The ticket: find what takes the agent most of its time when it plans a kitchen from an image, which
flaws cost it unnecessary steps (tool descriptions, authoring rules, tool results, corrections,
retries, missing or misleading data), and which improvements would shorten the time to a correct
kitchen. The tests: `image-kitchen-left-wall`, `image-kitchen-back-right-corner`,
`image-planning-right-wall` and `image-only-no-text` of
[test-prompts.json](../../docs/test-prompts.json), all on the plan `default-room`.

Out of scope, by the ticket: a lower reasoning effort or another model (RML-18043 decides the
effort). This analysis looks only at code, context and prompting. No productive code changes.

## 2. How it was measured

| Source | What it gives |
|---|---|
| `console.log` of a run, `[hi-chat] step N` lines (`chat-steps.ts`, `logStepUsage`) | per model step: input, output and reasoning tokens, the tools called with the size of their input, the finish reason, the step's duration |
| `console.log`, `[hi-chat] tool done: X (N ms)` | each tool's duration as the chat saw it |
| `console.log`, `[hi-mcp] call N: method` | which planner calls each tool made |
| `run.json` | the chat time per turn, and per plan-changing tool call its `args`, `corrections`, `notLoaded`, `error` |
| `planner-calls.json` | the planner calls with their arguments; with this change also `ms`, the page's time per call |

The script [benchmark-hi-mcp-runs.js](../scripts/benchmark-hi-mcp-runs.js) reads them and writes
the per-step tables of [benchmark.md](kitchen-from-image-time/benchmark.md). Derived values:

- **Tools s** of a step: its longest tool — the tools of a step run side by side.
- **Model s**: the step's duration without its tools. An upper bound of the tool time comes off it:
  a tool may start while the model still streams its other calls.
- **Result tokens**: the next step's input minus this step's input and output — about what the
  step's tool results add to the context.

**The runs**: the four tests in the two local "test the mcp" sessions with gpt-6-astra (the
provider's default effort, the deployed bo-test planner): `mcp-test-2026-10-07_11-58-22` (runs 1–4
of the benchmark) and `mcp-test-2026-10-08_13-56-35` (runs 5–8). No model was run for this analysis.
Run 2 ended with the provider error "Failed to process successful response" 62 s into its seventh
step; it is left out of every figure below, and the benchmark marks it and leaves it out of its
per-test and tool tables. **The baseline** takes only the tests with at least two valid runs, as the
[benchmarking rules](../skills/hi-mcp-benchmarking.md#rules) ask: `image-kitchen-left-wall`,
`image-kitchen-back-right-corner` and `image-only-no-text`. The step analysis (3.2–3.5, 4) uses all 7
valid runs: a run is evidence of what a step costs whether its test has a second run or not. The snapshot save of runs 1, 3 and 4 failed with HTTP
400 after the chat — it does not touch the chat time.

**The served sizes** were measured live without a model: the launcher on spare ports, headless
Chromium with `default-room`, `get-plan-context` and `find-attributes` called through the MCP SDK
client.

## 3. Results

### 3.1 Per test

| Test | Valid runs | Chat s | Steps | Input tokens |
|---|---|---|---|---|
| `image-kitchen-left-wall` | 2 | 69, 71 | 9, 10 | 563k, 631k |
| `image-kitchen-back-right-corner` | 2 | 137, 60 | 16, 7 | 1,350k, 455k |
| `image-only-no-text` | 2 | 140, 76 | 12, 7 | 786k, 413k |
| **Baseline: mean of the three tests** | 6 | **92** | **10.2** | **699k** |
| `image-planning-right-wall` — not in the baseline, one valid run | 1 | 113 | 12 | 1,102k |
| Mean of all 7 valid runs, for the step analysis | 7 | 95 | 10.4 | 757k |

The spread within a test is large — 60 s against 137 s for the same prompt and image. The long runs
are the ones that rebuild after the first create ([4.5](#45-rebuilds-after-the-first-create)).

### 3.2 Where the time goes, by kind of step

| Kind of step | Steps | Time | Share | Model s | Tools s |
|---|---|---|---|---|---|
| `create-or-replace-groups` | 12 | 244 s | 37 % | 154 | 90 |
| edit, undo, place after the create | 20 | 144 s | 22 % | 122 | 22 |
| `find-attributes` only | 20 | 140 s | 21 % | 140 | 0.4 |
| read: rules, plan context, images | 14 | 70 s | 11 % | 68 | 2 |
| final answer | 7 | 67 s | 10 % | 67 | 0 |
| **All, 7 runs** | 73 | 667 s | | 551 | 115 |

The 14 read steps are the 7 first steps (`get-authoring-rules` with `get-plan-context`, 3.4–5.6 s)
and 7 re-reads after the create (`get-plan-context` for rooms and obstacles, `get-plan-images`).

### 3.3 What a step costs

Least squares over the 73 steps: **model s ≈ 4.3 + 0.013 × input k-tokens + 11.6 × output
k-tokens** (R² 0.49). Steps that write less than 120 output tokens: median 3.8 s at less than 30k
input tokens, 4.7–5.0 s at 50k–150k. With gpt-6-astra a step costs a fixed 4–5 s, and only the
authoring of a group (400–1,250 output tokens: 10–22 s) is expensive. One step less saves about 5 s;
50k input tokens less save about 0.7 s per step.

### 3.4 What the context is made of

The first step's results add 49.5k–49.7k tokens in every run, and every later step sends them again:
**3.27M of the 5.30M input tokens (62 %)**. Measured live on `default-room`:

| Part | Characters | Share of the first step's results |
|---|---|---|
| `get-plan-context` → `articles` (111 articles) | 167,480 | 88 % |
| — of it, the articles' `desc` (nine sections each: FUNCTION, PURPOSE, … AI_SELECTION_HINT) | 82,138 | 43 % |
| — of it, `rootModules` (module, dimensions, main attributes, docking vectors, sub modules) | 66,701 | 35 % |
| `get-authoring-rules` | 18,179 | 10 % |
| `get-plan-context` → `rooms`, `obstacles`, `groups` | 4,764 | 2 % |

What the later steps add: `create-or-replace-groups` 6.0–16.6k tokens (every group in the plan,
plus the corrections), a command tool up to 9.3k (the whole changed group), a `find-attributes`
batch up to 9.4k.

### 3.5 The tools

| Tool | Calls (7 runs) | Mean | Note |
|---|---|---|---|
| `create-or-replace-groups` | 12 | 7.6 s | 0.65–1.2 s without group attributes; 5.3–9.2 s with 7–9 `change-group-attribute` planner commands; 9.2–16.4 s with 16–22 |
| `undo` of a create | 2 | 2.9 s, 4.4 s | replays one planner undo per planner command of the create: 8 and 17 |
| command tools, `undo` of a command | 19 | 0.1–1.6 s | one planner command and its reads |
| `find-attributes`, `get-plan-context`, `get-authoring-rules` | 68 | 10–30 ms | |
| `get-plan-images` | 3 | 0.6–0.7 s | |

Each group attribute costs about 0.6 s: `create-or-replace-groups` sets every group attribute that is
not a library group setting with its own `change-group-attribute` command after the load (D36,
G46 in [hi-mcp-behaviour.md](../../docs/hi-mcp-behaviour.md)), and the planner recalculates the
group for each one. `create-or-replace-groups` takes 90 s of the 115 s of tool time, about 75–80 s
of it for these commands.

## 4. Flaws that cost steps and time

### 4.1 `find-attributes` finds the material in several steps

**Evidence**: 2.9 `find-attributes` steps per run, 140 s, 21 % of the chat time. Several of them
bring back almost nothing: run 1 step 6, run 4 steps 5 and 7, run 5 steps 3, 6 and 8 (0.0–0.5k
result tokens) — the model searches again. Run 4 spends four search steps (30 s) before its first
create, run 8 three (30 s).

**Cause** — the served text and the search, measured live:

- The tool description names "the front colour" as its example. The library spells the attribute
  "Front color": `find-attributes "front colour"` returns `{"matches":[],"total":0}`. So does
  "worktop" — the library says "Countertop".
- The search compares the whole text as one substring, so two words in another order or another
  spelling find nothing.
- A colour name finds every colour attribute: "green" and "oak" each return 11 attributes with the
  same 21 values (17,364 characters, about 4.5k tokens), and every later step sends that again.
- The catalog's `mainAttributes` show the default values as bare numbers (`mod_FrontColor` "152"),
  so the palette is only to be found by a search.

The queries themselves are not recorded ([7](#7-measurement-gaps)); the cause is the live check of
the vocabulary, not the runs' payloads.

### 4.2 Every group attribute is its own planner command

**Evidence**: [3.5](#35-the-tools). A create with 7–22 group attributes takes 5.3–16.4 s instead of
about 1 s; 13 % of the chat time. Undoing such a create replays 8–17 planner undos (run 3 step 5,
run 4 step 8: 2.9 and 4.4 s).

**Cause**: the planner's command API. D36 sets every group attribute that is not one of the
library's group settings on every unit after the load, and the planner's `change-group-attribute`
takes one `attributeId` (roomle-ui `hi-plan-context.ts`), so the server sends one command per
attribute. The rules ask for exactly these attributes ("a material for the whole group in the
group's attributes"), so every kitchen pays for them.

### 4.3 Command results carry the whole group, and one call changes one attribute of one root

**Evidence**: run 6 sets accent fronts with five `change-module-attribute` calls in five steps
(steps 5–11, with an undo and a read between them, 48 s); each result adds about 8.4k tokens, 42k
in total, sent again in every later step. Run 3 needs place-group, change-group-attribute and delete-group in steps of
their own.

**Cause**: the tool API. `change-module-attribute` takes one `rootModuleId` and one attribute, and
its result is `{ command, groups, … }` with the changed group in the plan-context shape
([hi-mcp-behaviour.md, the command tools](../../docs/hi-mcp-behaviour.md#the-command-tools)).

### 4.4 Corrections that are no corrections

**Evidence**: 8–37 corrections per run. Most say that a group attribute "was set on every unit of
group '…'" — what the rules asked for. Each sentence of the library changes (D59) lists every group
attribute of the call as the cause: run 6 has four of them of about 600 characters each. Run 4 reads
"mod_BacksplashColor could not be set on group …" (no module of the group has it), undoes the create
and builds it again without the backsplash: 2 steps, 29 s.

**Cause**: the tool result. G46 reports the expected outcome of D36 in `corrections`, the channel
for "the server changed your input", and lists a group attribute no module carries as a failed
correction. `find-attributes` offers `mod_BacksplashColor` and `mod_BacksplashHeight` for the
kitchen articles, so the model has no way to know beforehand.

### 4.5 Rebuilds after the first create

**Evidence**: 45 % of the chat time comes after the first create, the final answers left out. Run 3 (`image-kitchen-back-right-corner`,
137 s): four creates, two undos, delete-root-module, place-group, change-group-attribute and
delete-group — 13 steps and 107 s after its first create; the second session's run of the same
test (run 7) needs 4 steps and 25 s. Run 3 places the corner kitchen with a point
(`posGroup [4815, 0, -3765]`, `posRotationY 270`) instead of the corner placement by `wall` and
`alignment`, then reads the plan context and undoes.

**Cause**: not determinable from the data. gpt-6-astra writes no text between its steps, the create
result's `hint` (a root module on an obstacle, D55) is not in the server's feedback log, and the
read tools' inputs are not recorded ([7](#7-measurement-gaps)). The point placement suggests that
the corner placement did not tell the model enough about the window and the door in the corner, but
this is a hypothesis to measure, not a finding.

### 4.6 The catalog in every step (cost)

**Evidence**: [3.4](#34-what-the-context-is-made-of). 62 % of all input tokens are the first step's
results sent again; 43 % of those are the nine-section article descriptions, of which a kitchen task
uses the kitchen articles only (62 of 111).

**Cause**: the information the server provides. `get-plan-context` returns the whole catalog with
every description by default, and the step loop sends the whole history every step. With
gpt-6-astra the 50k tokens cost about 0.7 s per step; with models whose prefill weighs more,
possibly more — to be measured ([6](#6-open-the-other-two-models)).

## 5. Proposed improvements

Savings are per run, against the gpt-6-astra baseline of 92 s, 10.2 steps and 699k input tokens.
They overlap in part and are estimates from the step cost of [3.3](#33-what-a-step-costs), fitted
over all 7 valid runs; the benchmark of [8](#8-the-benchmark-to-repeat) measures them.

| # | Improvement | Repositories | Changes | Expected saving |
|---|---|---|---|---|
| 1 | **One search finds the material.** The `find-attributes` description's example in the library's words ("Front color"); a search that matches each word on its own and both spellings (colour/color, worktop/countertop); the shared colour palette once per result instead of 21 values per attribute. Better still: the group-wide material attributes (front, carcase, worktop, toe kick, handle) and their palette in `get-authoring-rules`, so a kitchen needs no search | roomle-hi-example | the `find-attributes` description in `hi-mcp-server.ts`, its search in `tool-executors.ts`, `AUTHORING_RULES` | 1–2 steps, 7–14 s; up to 2.9 steps and 20 s with the palette in the rules; 5–10k result tokens |
| 2 | **Several group attributes in one planner command.** A roomle-ui command that sets a list of attributes on a group with one recalculation, used by `create-or-replace-groups` for the group attributes (D36) | roomle-ui, roomle-hi-example | roomle-ui: the command in `HI_GROUP_OPERATION` (`hi-plan-context.ts`); roomle-hi-example: `applyGroupWideAttributes` sends it, `docs/hi-mcp-behaviour.md` | 5–6 s per create, about 9 s per run; an undo of a create in one planner undo instead of 8–17 (the backlog item "one planner undo step per tool call", implemented with RML-18164) |
| 3 | **Edit several root modules in one call, answer with what changed.** `change-module-attribute` with a list of root modules (or of changes); command results with the changed root modules and the corrections instead of the whole group | roomle-hi-example; roomle-ui only to set several root modules in one recalculation | the schema in `hi-mcp-server.ts`, the command executors in `tool-executors.ts`; without a roomle-ui change the server sends one planner command per root module | about 1 step per run (run 6: 3–4 steps, 25 s); 6–8k tokens per avoided result |
| 4 | **Corrections only for corrections.** The group attributes set by D36 named once and short (or not at all), not one correction each; a D59 sentence names the attribute that caused the change, not every attribute of the call; a group attribute no module of the group carries reported as a note, not a failure | roomle-hi-example | G46 and D59 in `tool-executors.ts`, `docs/hi-mcp-behaviour.md` | 1–3k tokens per create; the undo-and-rebuild of run 4 (2 steps, 29 s) |
| 5 | **A compact catalog.** `get-plan-context` returns per article one line of description (its AI_SELECTION_HINT, 56 characters on average) instead of nine sections; the full description on request | roomle-hi-example | `get-plan-context` in `tool-executors.ts`, its description in `hi-mcp-server.ts`; the library's descriptions stay as they are | about 19k tokens per step, about a quarter of the input tokens; about 0.25 s per step (2–3 s per run) with gpt-6-astra, to be measured for the other models |

Improvements 1–4 shorten the path to the first correct create; [4.5](#45-rebuilds-after-the-first-create)
needs the measurement gaps closed before a fix can be named.

Rejected:

- **A lower reasoning effort or another model** — out of scope by the ticket (RML-18043).
- **Leaving out `get-authoring-rules`** — the rules are 10 % of the first step's results and the
  step costs about 4 s, but the rules are what makes the first create right.
- **The rules in the chat's system prompt to save the first step** — about 4 s, but it binds the
  chat to one MCP server's text; the ligna-store chat and external agents read the rules from the
  server.

## 6. Open: the other two models

The acceptance criteria ask for the breakdown of every model of `docs/test-prompts.json`:
gpt-5-mini, gpt-5.4-mini and gpt-6-astra. No local run of the first two exists (the run named in the
ticket's baseline, `mcp-test-2026-10-07_07-20-49`, is no longer on this machine).

The proposed run, not started — it waits for a go:

| Variant | Runs | Time | Input tokens |
|---|---|---|---|
| the four tests × gpt-5-mini and gpt-5.4-mini, once | 8 | about 15–25 min | about 4–6M |
| the same, twice (for the spread) | 16 | about 30–50 min | about 8–12M |
| plus gpt-6-astra once, for the planner times per call (`ms`, new) and the second valid run of `image-planning-right-wall`, which then joins the baseline | +4 | +8 min | +3M |

## 7. Measurement gaps

| Gap | Consequence | Closing it |
|---|---|---|
| The inputs of the read tools (`find-attributes` queries) and the size of every tool result are not logged | the searches of [4.1](#41-find-attributes-finds-the-material-in-several-steps) are inferred, not read | the chat's tool log names the input and the result size of every tool (`chat-server.ts`, one line) — productive code, a follow-up |
| The `hint` of `create-or-replace-groups` is not in the server's feedback log line | `run.json` cannot show whether the model saw an obstacle hint | add `hint` to the `feedback` line of `hi-mcp-server.ts` — a follow-up |
| gpt-6-astra writes no text between steps | why a model undid or rebuilt cannot be read | reasoning summaries from the provider — a follow-up, with its cost |
| Planner time per call | the 7.6 s of a create could only be attributed by counting calls | closed with this change: `planner-calls.json` carries `ms` per call |

## 8. The benchmark to repeat

After an improvement, run the four tests again — same models, same plan, at least two runs per
test — and compare with [benchmark.md](kitchen-from-image-time/benchmark.md): chat seconds,
steps and input tokens per test, and the share of the step kinds of [3.2](#32-where-the-time-goes-by-kind-of-step).
How: [hi-mcp-benchmarking.md](../skills/hi-mcp-benchmarking.md).

---

## 9. Second measurement, 2026-10-13: after the five improvements

The five improvements of [5](#5-proposed-improvements) are on master
(`feat: compact plan context, docking rules and find-attributes`, 9c4a537; roomle-ui
`change-attributes`). This section repeats the benchmark on the runs made since, as the ticket
asks, and answers the question that prompted the repeat: does `find-attributes` take most of the
time? No model was run for it.

### 9.1 Executive summary

In the runs since the improvements, gpt-6-astra needs on average **49 s and 5.4 steps** on the
three baseline tests (9 runs, 35–59 s) and 268k input tokens; the baseline was 92 s, 10.2 steps and
699k. Over all four tests: 57 s, 5.8 steps and 321k tokens (12 runs, 35–122 s). The nine runs come
from three builds and two planners, one run per build and test ([9.3](#93-how-it-was-measured)): they describe the state
since the improvements and do not measure what the five improvements saved — that needs the
like-for-like runs of [9.7](#97-open-runs-not-made). The chat time is 88 % model time, 12 % tools.

1. **`find-attributes` is not the tool that takes the time, but the steps it occupies are the second
   block.** The tool answers in 26 ms (63 calls, 1.6 s in 12 runs). The model spends 1.5 steps per
   run on searches alone — 12.5 s per run, 22 % of the chat time, the second block after the
   create steps (40 %) — and starts 9 of 12 runs with a search beside the reads. With gpt-5.4-mini
   the search steps are 28 % (56 s per run). The cause is what the model has to search for: the
   attribute vocabulary is not in the plan context, and it costs 5.5k tokens with shared value
   lists listed once ([9.5.1](#951-the-vocabulary-is-only-to-be-searched)).
2. **Most plan-changing tool calls of the two newest sessions wait 2 s in the server** for a
   follow-up history event that does not arrive: 13 of their 16 calls, 32 s outside the planner
   calls in 8 runs (4.0 s per run); none of the 6 calls of the 10-08 session waits. The `undo` after
   such a call waits 2 s more and undoes nothing ([9.5.2](#952-the-2-s-wait-and-the-withheld-undo)).
3. **Sizes the library cannot calculate** cost the right-wall test its second create: 1–3 steps,
   23–41 s in 2 of 3 runs; the catalog gives each dimension's value, not its range
   ([9.5.3](#953-sizes-the-library-cannot-calculate)).
4. Three smaller flaws: the full article descriptions requested in step 1 of 4 runs (+22k tokens
   per step), a group moved after the create in all three image-only runs (one step, 8 s), and
   create results of up to 23k tokens ([9.5.4](#954-the-full-article-descriptions-in-step-1)–[9.5.6](#956-create-results-of-up-to-23k-tokens)).

The improvements of [9.6](#96-proposed-improvements) are expected to save about 20 s and 2 steps of
the 57 s and 5.8 steps per run.

### 9.2 What was asked

Repeat the analysis of RML-18064 after the first round of improvements, with the user's
hypothesis that `find-attributes` takes most of the time ([hi-mcp-benchmarking.md](../skills/hi-mcp-benchmarking.md)).

### 9.3 How it was measured

The same sources and derived values as [2](#2-how-it-was-measured). The runs are the four tests in
every "test the mcp" session since the improvements, 24 runs; the sessions differ in build and
planner, which no run records ([9.8](#98-measurement-gaps)):

| Session | Server | Planner | Models |
|---|---|---|---|
| `mcp-test-2026-10-08_18-33-08` | the improvements branch (server-side tool logic, group attributes in one `change-attributes` command) | deployed bo-test | gpt-5-mini, gpt-5.4-mini, gpt-6-astra |
| `mcp-test-2026-10-11_11-41-48` | master of that day, same architecture | deployed bo-test | gpt-6-astra |
| `mcp-test-2026-10-12_10-23-42` | master of that day | deployed bo-test | Mistral-Large-3 |
| `mcp-test-2026-10-13_17-19-39` | master of that day — the plan-changing tools run in roomle-ui (D71) | local roomle-ui (`--dev`) | gpt-6-astra |

Left out: the gpt-5.4-mini run of `image-kitchen-left-wall` (run 5), whose turn was ended after
5 minutes. The gpt-6-astra tables pool the three sessions (3 runs per test, one per build): they describe the
state since the improvements, not a like-for-like comparison with the baseline ([9.7](#97-open-runs-not-made)); the other three models
have one run per test and give a step breakdown, not a baseline. The planner time per call comes
from `planner-calls.json` (`ms`), so the server's own time in a tool call is the tool's time minus
its planner calls.

**Live, without a model** (the launcher on spare ports, headless Chromium, the bo-test planner,
`default-room`): the size of every served section and of 27 searches, and one timed
`create-or-replace-groups` with five group attributes, its `undo`, and one
`change-module-attribute`, with the history events the page relayed. 3.84 characters per token,
from the first step's 135,301 characters and 35,212 result tokens.

### 9.4 Results

#### 9.4.1 The baseline and the runs since, per test (gpt-6-astra)

| Test | Baseline: chat s | steps | input tokens | Since: 10-08 | 10-11 | 10-13 | Since, mean of 3 |
|---|---|---|---|---|---|---|---|
| `image-kitchen-left-wall` | 69, 71 | 9, 10 | 563k, 631k | 55 s, 8, 368k | 49 s, 4, 214k | 35 s, 4, 154k | **46 s, 5.3, 245k** |
| `image-kitchen-back-right-corner` | 137, 60 | 16, 7 | 1,350k, 455k | 42 s, 4, 140k | 42 s, 5, 283k | 59 s, 7, 453k | **48 s, 5.3, 292k** |
| `image-only-no-text` | 140, 76 | 12, 7 | 786k, 413k | 53 s, 6, 248k | 53 s, 5, 295k | 50 s, 6, 258k | **52 s, 5.7, 267k** |
| **Baseline, the three tests** | **92 s** | **10.2** | **699k** | | | | **49 s, 5.4, 268k** |
| `image-planning-right-wall` (one valid run before) | 113 | 12 | 1,102k | 43 s, 4, 154k | 122 s, 10, 885k | 87 s, 7, 397k | 84 s, 7.0, 479k |
| All four tests | 95 s | 10.4 | 757k | | | | 57 s, 5.8, 321k |

The three columns since the improvements are three builds and two planners, one run each
([9.3](#93-how-it-was-measured)): the table describes both states, it does not attribute the difference to the five
improvements.

The spread within a test is still large where the first create fails in part: the right-wall test
takes 43 s with one create and 87–122 s with two ([9.5.3](#953-sizes-the-library-cannot-calculate)).

#### 9.4.2 Where the time goes, by kind of step (gpt-6-astra, 12 runs)

| Kind of step | Steps | Time | Share | Model s | Tools s | Before |
|---|---|---|---|---|---|---|
| `create-or-replace-groups` | 14 | 274 s | 40 % | 209 | 65 | 37 % |
| edit, undo, place after the create | 8 | 71 s | 10 % | 57 | 14 | 22 % |
| `find-attributes` only | 18 | 150 s | 22 % | 150 | 0.5 | 21 % |
| first step with a search beside the reads | 9 | 40 s | 6 % | 40 | 0.3 | — |
| read: rules, plan context, images | 9 | 47 s | 7 % | 45 | 2 | 11 % |
| final answer | 12 | 104 s | 15 % | 104 | 0 | 10 % |
| **All** | 70 | 686 s | | 605 | 81 | |

After the first create: 17 steps and 156 s (23 % of the time, before 45 %) — the second create of
the right-wall test (2 runs), the move of a group in the image-only test (3 runs), two width retries
(1 run), `get-plan-images` (3 runs), and 4 steps of the 10-08 left-wall run (a re-read, searches,
images, a swap).

#### 9.4.3 What a step costs, per model

Least squares of the model time of a step against its input and output tokens:

| Model | Steps | Fixed | Per 1k input tokens | Per 1k output tokens | R² | Where the time is |
|---|---|---|---|---|---|---|
| gpt-6-astra | 70 | 4.1 s | 30 ms | 11.2 s | 0.65 | the number of steps; a step with little output takes 5.0 s (median; 3.2–22.6) |
| gpt-5-mini | 16 | 4.7 s | — | 7.5 s | 0.99 | the reasoning: 6.2k reasoning tokens per create, 2.2k per final answer |
| gpt-5.4-mini | 28 | 4.8 s | — | 8.2 s | 0.98 | the reasoning: 1.6k tokens per search step |
| Mistral-Large-3 | 13 | 0.6 s | 131 ms | 6.0 s | 0.90 | the input: the 35k-token context costs 4.6 s per step |

The input coefficient of the two minis came out negative and is left out. For gpt-6-astra the
coefficient is about twice the first measurement's 13 ms; with R² 0.65 both are rough.

#### 9.4.4 The other models

| Model | Runs | Chat s | Steps | Input tokens | Pattern |
|---|---|---|---|---|---|
| gpt-5-mini | 4 | 81–113 | 4 | 227–232k | two reads, one create (53 s, 6.2k reasoning tokens), one answer (22 s); no search — it sets 4–6 group attributes with values it reads from the catalog |
| gpt-5.4-mini | 3 | 161–233 | 5–13 | 268–635k | one search per step, 3–6 search steps per run with 1.6k reasoning tokens each: 56 s per run, 28 % |
| Mistral-Large-3 | 4 | 20–66 | 3–4 | 116–199k | read, create, answer; no search — three runs set no group attributes, the fourth invents ids the library has not (`mod_WorktopColor`, `mod_PlinthColor`) |

Mistral-Large-3 is fast because it skips the vocabulary, at the price of a kitchen without its
materials — the vocabulary in the context ([9.6](#96-proposed-improvements), 1) would cost it
0.7 s per step.

#### 9.4.5 What the context is made of

The first step's results are 32–37k tokens (plan context 116,509 characters, of which the catalog
111,700 with 17,320 of article `desc`; rules 18,792) — 55–60k in the four runs that request
`articleDescriptions` too ([9.5.4](#954-the-full-article-descriptions-in-step-1)). The searches add
1.5–5.5k tokens per run, a create result 6.4–22.9k, a command result 78–171 tokens.

#### 9.4.6 The tools

| Tool | Calls (gpt-6-astra, 12 runs) | Mean | Note |
|---|---|---|---|
| `create-or-replace-groups` | 14 | 4.6 s | the planner's operation 1.5–4.0 s for 9–23 roots with 7–10 group attributes — the same on bo-test (loads plus `change-attributes`) and in roomle-ui (one command) — plus a 2 s wait in the server in 9 of the 10 creates of the 10-11 and 10-13 sessions, twice for a two-group create of 10-11, and in none of the 4 creates of 10-08 ([9.5.2](#952-the-2-s-wait-and-the-withheld-undo)) |
| `change-module-attribute` | 2 | 2.8 s | 0.6–0.9 s planner, 2 s wait |
| `undo` | 2 | 2.1 s | no planner undo: withheld ([9.5.2](#952-the-2-s-wait-and-the-withheld-undo)) |
| `place-group`, `swap-root-modules` | 4 | 0.8–1.5 s | |
| `find-attributes` | 63 | 26 ms | 5.3 calls per run |
| `get-plan-context`, `get-authoring-rules`, `get-plan-images` | 30 | 10 ms–0.6 s | |

### 9.5 Flaws that cost steps and time

#### 9.5.1 The vocabulary is only to be searched

**Evidence**: 18 steps of 70 are searches alone (12.5 s per run, median 6.1 s per step, four
steps of 12.8–22.6 s — three with 205–453 reasoning tokens, one with 66 output tokens and no
reasoning); 9 first steps carry a search beside the reads; 5 of 12 runs search in two steps before
the create (runs 12, 15, 23, 24; run 9 after it). The search texts are not logged, only their
length: 4–20 letters, three or four per step. Live: `color` returns the 12 colour attributes
(7,934 characters), `front color` 3,385, `carcase color` 2,806, `countertop` 2,473, `handle`
3,382; `handleless`, `oven` and `hob` return nothing. gpt-5.4-mini makes one search per step,
3–6 steps per run.

**Cause**: the served text and the information the plan context carries. The rules say that
attribute ids and values come from the `masterData` section or from `find-attributes`; the
catalog shows each root module's main attributes with bare values (`mod_HandleDesign` "10") and
no value list. A model that follows the rules searches, one property at a time; gpt-5-mini guesses
values from the catalog, Mistral-Large-3 sets nothing or invents ids ([9.4.4](#944-the-other-models)).

**The vocabulary measured live** (bo-test, `default-room`): `masterData` 37,119 characters
(9.7k tokens) — 61 attributes with 354 values in 24 distinct value lists, 20 modules; the
attributes with shared lists listed once 20,950 characters (5.5k tokens); the colour, program,
handle and plinth attributes alone 11,758 (3.1k tokens); one colour list of 21 values 1,355.

#### 9.5.2 The 2 s wait and the withheld undo

**Evidence**: the tool time of a plan-changing call minus its planner calls — the server's own
time — is 2.0–2.6 s in 7 of 8 calls of the 10-11 session and 2.01–2.02 s in 6 of 8 of the 10-13
session (runs 21–23: creates and two `change-module-attribute` calls; run 24's create and
`place-group`: 35 and 18 ms); a create with two groups waits twice (runs 15, 16: 4.4 and 4.6 s).
The 13 calls that wait spend 32 s outside their planner calls — 15 waits of 2 s and 2 s of other
server work —, 4.0 s per run of the two sessions. None of the 6 calls of the 10-08 session waits:
their server time, 0.4–1.7 s, is the server-side tool logic between its planner calls. Live: a create with five group attributes
took 2,575 ms; the planner's operation answered at 445 ms, the page relayed three history events at
134, 289 and 445 ms, then nothing until the server read the groups at 2,558 ms. A
`change-module-attribute` took 3,618 ms: operation 1,606 ms, one history event at 1,609 ms. The
`undo` after the create took 2,015 ms, called no planner undo and answered `undone: null`. In
run 15 the model called `undo` twice (2.06 s each, no planner undo), then replaced the group under
its id — 2 steps and 18 s for nothing. The 10-13 test report names the same failure in its random
test 53; the backlog item "one planner undo step per tool call"
has it.

**Cause**: the server's history accounting (`countingPlannerApi`, `FOLLOW_UP_WAIT_MS`,
`tool-executors.ts`) waits for `historySteps` plus `historyFollowUps` events after a command of
`FOLLOW_UP_COMMANDS` (roomle-ui `hi-tool-commands.ts`), and records the call as unsettled when
they do not come, which withholds `undo`. Hypothesis, because the runs record neither the two
counts nor the events: on the bo-test planner and the local roomle-ui the follow-up reload of
`change-attributes` and `change-module-attribute` makes no history event of its own, so the
server expects one event more than the planner sends — a bug analysis for roomle-ui and the
server, not an instruction.

#### 9.5.3 Sizes the library cannot calculate

**Evidence**: `image-planning-right-wall`, runs 15 and 23: the first create puts flip-lift wall
cabinets (`OSKB60`, `OSKB90`) with `mod_Height` 360 on the tall units; the library cannot calculate
them (Error 14023, `tab_FlipliftSettings`), `notLoaded` names them with the same sentence five
times, and the result is 21.7k and 22.9k tokens. Run 23 replaces the group with `OTB60` at 360 mm
in a second create (1 step, 22.7 s); run 15 calls `undo` twice (withheld) and creates again
(3 steps, 41 s). Run 10 of the same test avoided it. Run 22 (`image-kitchen-back-right-corner`)
sets `mod_Width` 150 on a unit, gets "could not calculate", sets 450, and re-reads the plan:
3 steps, 23 s.

**Cause**: the library data — the catalog gives each dimension its value, not the sizes the
article takes, and the descs name no range (backlog [library-issues.md](../backlog/library-issues.md),
item 64). The duplicated sentence is the tool result ([9.5.6](#956-create-results-of-up-to-23k-tokens)).

#### 9.5.4 The full article descriptions in step 1

**Evidence**: runs 13, 14, 16 and 22 call `get-plan-context` with `articleDescriptions` in their
first step (the input `{"include":["rooms","articles","articleDescriptions","groups","obstacles"]}`,
75 characters); their first step's results are 55–60k tokens instead of 32–37k, and their input
tokens 214–453k. Live: the section is 85,314 characters, 22.2k tokens. By the fit about 0.7 s per
step with gpt-6-astra, 3–4 s per run; 2.9 s per step with Mistral-Large-3.

**Cause**: the served text of `include` says what the section is ("the full descriptions of the
articles"), not that `desc` already carries the function and the selection hint — a model that is
to pick articles from a photo asks for everything it can get.

#### 9.5.5 A group moved after the create

**Evidence**: `image-only-no-text`, all three runs: the create places two groups by wall, left and
right, both `alignment: back` with `offsetMm` 150–350; the next step moves the left group with
`place-group` to `offsetMm` 650–800 — 7.9–8.3 s per run. The create's `hint` is empty.

**Cause**: the tool API. The placement by wall keeps clear of the walls and the obstacles, not of
a group of the same call that stands in the corner; the model reads the overlap from the
footprints in the result and moves one group.

#### 9.5.6 Create results of up to 23k tokens

**Evidence**: 6.4–22.9k result tokens per create. Run 23's first create: 10 library-change
sentences of about 1,000 characters each, every one listing the root modules by id and article,
and five identical `notLoaded` sentences of 430 characters. The command results are compact now
(78–171 tokens).

**Cause**: the tool result (D59, D73). It costs tokens, not time, with gpt-6-astra (0.1–0.2 s per
later step); with Mistral-Large-3 0.5 s per step.

### 9.6 Proposed improvements

Savings per run against the gpt-6-astra mean of 57 s, 5.8 steps and 321k input tokens, from the
step cost of [9.4.3](#943-what-a-step-costs-per-model).

| # | Improvement | Repositories | Changes | Expected saving |
|---|---|---|---|---|
| 1 | **The vocabulary in the plan context.** `get-plan-context` returns by default the attributes of the compacted master data with shared value lists listed once (5.5k tokens); the rules and the catalog say that ids and values are there, so a kitchen needs no search. `find-attributes` stays for a question | roomle-hi-example | `get-plan-context` in `tool-executors.ts`, its description and `AUTHORING_RULES` in `hi-mcp-server.ts` | 1.5 steps and about 11 s per run (12.5 s of search steps, minus 0.2 s per step for the tokens); with gpt-5.4-mini 3 steps and about 56 s; input tokens about +24k (the section in every step, the search results gone). Mistral-Large-3 gets real ids for +2 s |
| 2 | **No wait for an event that does not come, and an undo that works.** A bug analysis of the follow-up accounting with the planner's history events logged; then either roomle-ui emits the event or the server stops expecting it | roomle-ui, roomle-hi-example | `countingPlannerApi`, `revertToolCall`, `tool-executors.ts`; `runToolCommand`, `FOLLOW_UP_COMMANDS`, roomle-ui `hi-tool-commands.ts` | 2 s per wait: about 3.8 s per run in the two newest sessions (15 waits in 8 runs), 2.5 s per run over all 12; `undo` after a create or an attribute change undoes (run 15: 2 steps, 18 s) |
| 3 | **The sizes an article takes in its catalog entry.** The library names the heights and depths of the flip-lift cabinets and the widths of the units in the descs (library item 64); the catalog's `dimensions` carry a value list where the master data has one | library data (desc); roomle-hi-example only if the master data has ranges to pass through | the descs; `agentFacingArticle` | 1–3 steps and 23–41 s in 2 of 12 runs, about 5 s per run on average |
| 4 | **Say what `desc` covers.** The `include` description: `desc` has the function and the selection hint, enough to pick; `articleDescriptions` answers a question about an article's requirements and neighbours | roomle-hi-example | the `get-plan-context` description in `hi-mcp-server.ts` | 22k tokens per step in a third of the runs, about 1 s per run on average; 3–4 s in those runs |
| 5 | **The placement by wall keeps clear of the group in the corner.** `alignment: back` moves a group past the footprint of a group that already stands in that corner — of the same call too — and the result says so as a correction | roomle-ui (`hi-wall-placement.ts`, the create command) | the wall placement | 1 step and 8 s per run with two groups on adjacent walls (3 of 12 runs), about 2 s per run on average |
| 6 | **Shorter create results.** A library-change sentence names the root modules by article and count, not by id (the ids are in `groups`); a `notLoaded` error once per cause with the roots it hit | roomle-ui (the create command, D59, D73) | the result text | 3–5k tokens per create result; 0.1–0.2 s per later step, 0.5 s with Mistral-Large-3 |

Together about 20 s and 2 steps of the 57 s and 5.8 steps. Improvements 1, 4 and 6 are served
text and results; 2, 3 and 5 need roomle-ui or the library.

Rejected:

- **A shorter final answer.** 12 final steps, 104 s (15 %), 89–161 output tokens: the step's fixed
  4–5 s is the cost, not the text.
- **The group attributes set by the model without a vocabulary**, as gpt-5-mini and Mistral do —
  the one guesses values, the other ids.
- **A lower reasoning effort or another model** — out of scope by the ticket.

### 9.7 Open: runs not made

The three gpt-6-astra sessions are three builds and two planners; the benchmarking rule asks for
like with like. Not started — it waits for a go:

| Variant | Runs | Time | Input tokens |
|---|---|---|---|
| the four tests twice with gpt-6-astra on the current master and the local planner (`--dev`) | 8 | about 15 min | about 2.6M |
| the same for gpt-5-mini, gpt-5.4-mini and Mistral-Large-3 (their second run per test) | 24 | about 60 min | about 8M |

### 9.8 Measurement gaps

| Gap | Consequence | Closing it |
|---|---|---|
| The text of a `find-attributes` call is not logged, only its length | what the model searched for is inferred ([9.5.1](#951-the-vocabulary-is-only-to-be-searched)) | the chat's step line prints a tool input under 80 characters as it is |
| `historySteps`, `historyFollowUps` and the relayed history events are not logged | the cause of the 2 s wait is a hypothesis ([9.5.2](#952-the-2-s-wait-and-the-withheld-undo)) | the server logs both counts per command and each history event |
| The server's own time in a tool call is not logged | computed here as tool time minus planner time | one line per plan-changing call: planner ms, wait ms |
| A run does not record the server commit and the planner it used | the sessions are told apart by date and URL | `run.json` carries the commit and `server_url` |
| gpt-6-astra writes no text between steps | why a model moved or replaced a group is read from the payloads | as before |

### 9.9 The benchmark to repeat

After the next improvement: the four tests, twice each, one build, one planner;
`node .agents/scripts/benchmark-hi-mcp-runs.js <session> --test … --out .agents/benchmarks/kitchen-from-image-time-<date>`,
and compare chat seconds, steps and input tokens per test with
[kitchen-from-image-time-2026-10-13/benchmark.md](kitchen-from-image-time-2026-10-13/benchmark.md)
and the step kinds of [9.4.2](#942-where-the-time-goes-by-kind-of-step-gpt-6-astra-12-runs).

---

## 10. Third measurement, 2026-10-14: the six improvements, one after another

[RML-18164](https://roomle.atlassian.net/browse/RML-18164) implements the improvements of [9.6](#96-proposed-improvements)
in the order of its implementation plan (decisions D76, D77 and D79 of
[hi-mcp-behaviour.md](../../docs/hi-mcp-behaviour.md#3-decisions)), and measures
each one with the same small set: the four kitchen-from-image tests with gpt-6-astra, twice each,
on one build and the local planner (`--dev`, roomle-ui `release/bo-test` at 56256a5b7 plus the
improvements), two runner sessions per round. The benchmarks are in
`kitchen-from-image-time-rml-18164/<step>/`, the sessions in `.temp/result/benchmark-rml-18164-<step>-{a,b}`.
Every round compares with the round before it; a round is stable when every run creates the
planning its test asks for and no correction, error or group not built is new.

### 10.1 The rounds

| Round | Build (roomle-hi-example / roomle-ui) | `image-kitchen-left-wall` | `image-kitchen-back-right-corner` | `image-planning-right-wall` | `image-only-no-text` | Mean |
|---|---|---|---|---|---|---|
| Baseline | 63970bb (master) / 56256a5b7 (`release/bo-test`) | 52 / 42 s, 5 / 5, 238k / 237k | 102 / 133 s, 10 / 12, 700k / 716k | 187 / 136 s, 9 / 9, 664k / 719k | 87 / 91 s, 9 / 8, 507k / 471k | **104 s, 8.4, 531k** |
| 1 — the vocabulary in the plan context | eee7a6e / 56256a5b7 | 42 / 51 s, 5 / 5, 243k / 245k | 119 / 75 s, 9 / 7, 619k / 386k | 101 / 91 s, 7 / 7, 474k / 446k | 63 / 60 s, 6 / 6, 327k / 324k | **75 s, 6.5, 383k** |
| 2 — settled commands, one undo step per tool call | 67a1097 / 740e27e67 | 50 / 42 s, 4 / 4, 181k / 179k | 70 / 116 s, 7 / 8, 392k / 478k | 77 / 124 s, 7 / 11, 465k / 891k | 54 / 59 s, 6 / 6, 328k / 325k | **74 s, 6.6, 405k** |
| 4 — desc is enough to pick an article | 6579fb3 / 740e27e67 | 49 / 39 s, 5 / 5, 246k / 245k | 106 / 97 s, 10 / 10, 613k / 639k | 84 / 102 s, 9 / 7, 658k / 460k | 72 / 81 s, 6 / 6, 319k / 326k | **79 s, 7.3, 438k** |
| 5 — the rule about a corner group and the adjoining wall | c77ca0c / 740e27e67 | 39 / 45 s, 4 / 4, 180k / 180k | 65 / 85 s, 7 / 7, 388k / 387k | 77 / 97 s, 9 / 11, 638k / 846k | 91 / 59 s, 9 / 6, 562k / 324k | **70 s, 7.1, 438k** |
| 6 — shorter library-change and `notLoaded` sentences | c77ca0c / ddc2da33c | 36 / 41 s, 5 / 5, 244k / 245k | 69 / 95 s, 7 / 9, 384k / 528k | 89 / 125 s, 6 / 10, 372k / 760k | 73 / 70 s, 6 / 6, 324k / 323k | **75 s, 6.8, 397k** |

Per cell: chat seconds, steps and input tokens, the two runs as "a / b".

The baseline is slower than the runs of 2026-10-13 (57 s, 5.8 steps): in 5 of its 8 runs the first
create reports a root module the library could not calculate (`notLoaded`), the agent calls `undo`
twice — withheld, 2 s each, nothing undone (§9.5.2) — and creates again; the planner in headless
Chromium answers a create in 4–5 s.

**Round 1** (improvement 1): `find-attributes` is not called once in the 8 runs — the baseline had
17 search steps in its 8 runs —, every create sets 7–10 group attributes with ids and values of the
vocabulary, all 8 runs valid; 29 s, 1.9 steps and 148k input tokens less per run than the
baseline. The spread of the corner test (75–119 s) is the first create's `notLoaded` and the
withheld undos of 4 of the 8 runs (improvement 2).

**Round 2** (improvement 2): the 4 `undo` calls of the 8 runs revert their create in 28–44 ms
each (round 1: 3 calls of 2.0 s, two of them undoing nothing), a create takes 2.9 s in the planner
instead of 4.3 s, and the server's own time per plan-changing call is gone. The chat time is that
of round 1: the 2 s per call lie within the spread of the corner and right-wall tests (70–124 s).
The first `image-only-no-text` run of session a ended in a provider stall after its first step
(no answer to the second model call for 294 s, no tool involved) and is left out; the test was
rerun by hand on the same build (`04-image-only-no-text.attempt-1` keeps the stalled run).

**Round 4** (improvement 4): stable, 8 valid runs (one transport failure, "Failed to process
successful response", the runner retried). Nothing to save in these runs: no first step of any
round today — the baseline included — requested `articleDescriptions`, unlike 4 of the 12 runs of
2026-10-13; the served text stays for the models that do. The 5 s above round 2 are the spread of
the corner and image-only tests.

**Round 5** (improvement 5): stable, 8 valid runs. No saving on this model: both `image-only-no-text`
runs still place the tall-unit run in the back left corner and move it with `place-group` in the
next step, as the three runs of 2026-10-13 did; the rule sentence stays as information for the
agent, the step it was to save is still there.

**Round 6** (improvement 6): stable, 8 valid runs (one provider stall after the create — no final
answer for 260 s —, left out and rerun by hand on the same build). The correction and `notLoaded`
text of a create fell from 2,064 to 1,245 characters on average (9 and 8 creates; a library-change
sentence names "9 root modules (PH15L, HK260, …, OSKB60 ×3)" instead of nine ids); the create
result as a whole stays at about 11k tokens — it is the groups —, and the chat time is that of the
rounds before.

### 10.2 Improvement 3 — evaluated, no code change

The master data gives a dimension attribute no value list and no range: `mod_Height`, `mod_Width`
and `mod_Depth` are of type Dim without `selections`, like 21 of the 24 Dim attributes
(`mod_PlinthAreaHeight` has 9 values, `mod_IslandBackwallWidth` and `mod_GroupWidth` one each —
these come with the vocabulary section of improvement 1). There is nothing for the catalog to
pass through, and the sizes a flip-lift wall cabinet takes are the library's: its descs, library
issue 64 ([library-issues.md](../backlog/library-issues.md)). The duplicated `notLoaded` sentences
of that case are improvement 6.

### 10.3 What improved

| Round | Chat s | Steps | Input tokens | Against the baseline |
|---|---|---|---|---|
| Baseline | 104 | 8.4 | 531k | — |
| 1 — the vocabulary in the plan context | 75 | 6.5 | 383k | −29 s, −1.9 steps, −148k |
| 2 — settled commands, one undo step per tool call | 74 | 6.6 | 405k | −30 s, −1.8, −126k |
| 4 — `desc` is enough to pick an article | 79 | 7.3 | 438k | −25 s, −1.1, −93k |
| 5 — the rule about a corner group and the adjoining wall | 70 | 7.1 | 438k | −34 s, −1.3, −93k |
| 6 — shorter library-change and `notLoaded` sentences | 75 | 6.8 | 397k | −29 s, −1.6, −134k |

The saving comes from improvement 1: the vocabulary in the plan context takes every search step
away (17 search steps in the 8 baseline runs, none since), 28 % of the chat time, 19 % of the
steps and a quarter of the input tokens. Rounds 2–6 lie within the spread of one build (70–79 s
means, the slowest test 77–125 s between its two runs): improvement 2 saves its 2 s per
plan-changing call and makes `undo` work at once — the planner answers a create in 2.9 s instead of
4.3 s, an undo in 36 ms instead of 2 s, and the user's undo button reverts a tool call in one click
—, improvement 6 makes the corrections of a create 40 % shorter, and improvements 4 and 5 change
nothing the runs of this model and day do (no run requested `articleDescriptions`, the image-only
runs still move their left group after the create); their sentences stay as information. Every
round was stable: every run built the planning its test asks for, with its materials; two
provider stalls and one transport failure were left out and rerun or retried, no run failed on the
planning.
