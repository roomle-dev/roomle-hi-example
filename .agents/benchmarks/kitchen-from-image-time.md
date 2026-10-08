# Benchmark: Where the time goes when the HI agent plans a kitchen from an image

> **Type**: Benchmark and performance analysis
> **Domain**: `hi-mcp/hi-mcp-server` (served text, tool results, `create-or-replace-groups`), `hi-mcp/hi-mcp-chat` (step loop); roomle-ui (the group attribute command)
> **Trigger**: [RML-18064](https://roomle.atlassian.net/browse/RML-18064) "HI agent: analyse where the time goes when it plans a kitchen from an image"
> **Date**: 2026-10-08
> **Author**: AI Assistant
> **Status**: Open — baseline measured for gpt-6-astra; gpt-5-mini and gpt-5.4-mini not run yet ([6](#6-open-the-other-two-models))
> **Data**: [kitchen-from-image-time/benchmark.md](kitchen-from-image-time/benchmark.md) (every run, step by step), `kitchen-from-image-time/benchmark.json`
> **How to repeat**: [hi-mcp-benchmarking.md](../skills/hi-mcp-benchmarking.md)
> **Plan**: [kitchen-from-image-time-implementation-plan.md](kitchen-from-image-time-implementation-plan.md) — the five improvements and their unit tests

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

The five improvements in [5](#5-proposed-improvements) are expected to save about 30–40 s of the
92 s (about 4–6 steps) and a quarter to a third of the input tokens. Each one says what it changes and what it
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
| 2 | **Several group attributes in one planner command.** A roomle-ui command that sets a list of attributes on a group with one recalculation, used by `create-or-replace-groups` for the group attributes (D36) | roomle-ui, roomle-hi-example | roomle-ui: the command in `HI_GROUP_OPERATION` (`hi-plan-context.ts`); roomle-hi-example: `applyGroupWideAttributes` sends it, `docs/hi-mcp-behaviour.md` | 5–6 s per create, about 9 s per run; an undo of a create in one planner undo instead of 8–17 (see [one-undo-step-per-tool-call.md](../backlog/one-undo-step-per-tool-call.md)) |
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
