# Feature Analysis: A reasoning effort per GPT chat model

> **Type**: Feature Analysis
> **Domain**: `hi-mcp/hi-mcp-chat` (`chat-config.ts`, `chat-server.ts`, `chat-steps.ts`); ligna-store `hi-mcp/chat.ts`
> **Trigger**: [RML-18043](https://roomle.atlassian.net/browse/RML-18043) "hi mcp - increase reasoning effort for lightweight models"; backlog item [reasoning-effort-for-the-gpt-chat-models.md](../backlog/reasoning-effort-for-the-gpt-chat-models.md)
> **Date**: 2026-10-07
> **Author**: AI Assistant
> **Status**: Open — step 1 done, step 2 open, step 3 only on request
> **Plan**: [reasoning-effort-per-gpt-chat-model-implementation-plan.md](reasoning-effort-per-gpt-chat-model-implementation-plan.md)

---

## Executive Summary

gpt-5.4-mini plans worse than gpt-5-mini and gpt-6-astra with the same server, tests and planner.
The cause is its reasoning: the chat sends no reasoning effort, and gpt-5.4-mini's default on the HI
Azure AI Foundry resource is no reasoning at all — 0 reasoning tokens in every step, measured on
2026-10-07. gpt-5-mini and gpt-6-astra reason by default, as at `medium`.

The work goes **step by step**. Each step ends with a verified, usable result before the next one
starts:

| Step | What | Status | Time |
|---|---|---|---|
| 1 | Fix the step log: it read a field AI SDK 7 no longer has and showed 0 reasoning tokens for every model | done | — |
| 2 | Set an effort per Foundry deployment from the data already measured — gpt-5.4-mini `low`, gpt-5-mini `medium`, gpt-6-astra `medium` — and verify it with unit tests and one live run per deployment; the same in the ligna-store chat | open | about 40 minutes |
| 3 | Detailed measurement of further efforts | only on request | 15 minutes to 8 hours, see [3](#step-3--detailed-measurement-only-on-request) |

Step 3 is never started without asking first: the agent names the option, its run time and its
token cost, and waits for an explicit go.

---

## 1. What was asked

The ticket's goal: the reasoning effort for each GPT chat model of the HI example chat that gives
the most correct plans. Accuracy goes over speed. The only speed limit is the chat's turn timeout: a
turn that has not answered after 5 minutes is aborted (`HI_CHAT_TURN_TIMEOUT_MS`).

Out of scope: the MCP server, its rules and its tools (they cannot set the effort); step-by-step
reasoning asked for in the system prompt; the reasoning settings of the other providers; which model
the chat uses by default.

## 2. How it works

### 2.1 The effort reaches the deployments as a provider option

- `getChatConfig` takes the effort from `HI_CHAT_REASONING_EFFORT`
  ([chat-config.ts](../../hi-mcp/hi-mcp-chat/chat-config.ts)); `chat-server.ts` sends it as
  `providerOptions.azure.reasoningEffort`, for the azure provider only. Unset, each deployment runs
  at its own default.
- `createAzure(...)(deployment)` is an `OpenAIResponsesLanguageModel` (`azure.responses`): the
  Responses API of the Foundry `openai/v1` endpoint. It reads `providerOptions.azure` and sends
  `reasoning.effort`.
- For gpt-6 models the SDK allows only `low` to `max` and drops any other value with a warning; for
  gpt-5-mini and gpt-5.4-mini it validates nothing, and a value the model rejects ends the turn with
  HTTP 400.
- Whenever an effort is set, the SDK also asks for `reasoning.summary: 'detailed'`. The chat streams
  only text, so the summary never reaches the page. `reasoningSummary: null` beside the effort
  leaves it out of the request (checked with a stubbed fetch, 2026-10-07).
- The ligna-store chat (`hi-mcp/chat.ts`) runs its own `streamText` against the same three
  deployments and sends no effort.

### 2.2 The step log (step 1)

`logStepUsage` ([chat-steps.ts](../../hi-mcp/hi-mcp-chat/chat-steps.ts)) logs one line per model
call: tokens in, out and spent on reasoning, the tools and the duration. It read
`usage.outputTokens.reasoning`; in AI SDK 7 a step's `usage.outputTokens` is a number and the
reasoning tokens are in `usage.outputTokenDetails.reasoningTokens`, so every step logged 0. Step 1
reads the right field, typed with the SDK's `LanguageModelUsage`. "out" counts the reasoning tokens
too.

## 3. Measured on 2026-10-07

Local roomle-ui dev server on master (be0cecf66). Result directories under `.temp/result/` (local).

### 3.1 The defaults on Foundry

Two tests per deployment (three tall units, kitchen in the back right corner), no effort set
(`effort-defaults-2026-10-07_07-12-53`), then the same at `medium`
(`effort-medium-2026-10-07_07-16-35`):

| Deployment | Reasoning tokens per step, default | Reasoning tokens per step, `medium` | Default |
|---|---|---|---|
| gpt-5-mini | 256, 256, 640, 640 / 192, 128, 1216, 384 | 64, 192, 384, 320 / 192, 64, 1408, 704 | reasons, like `medium` |
| gpt-5.4-mini | 0 in every step | 196, 516, 89 / 98, 5696, 217 | **no reasoning** |
| gpt-6-astra | 0, 0, 0, 0 / 0, 179, 37, 0 | 0, 0, 0 / 0, 161, 72 | reasons a little, like `medium` |

Foundry accepted `medium` with the SDK's reasoning summary for all three deployments.

### 3.2 gpt-5.4-mini by effort

The 32 tests of `docs/test-prompts.json`, one run each, evaluated as "test the mcp" does
(`mcp-test-2026-10-07_07-20-49`):

| Effort | Pass / partial / fail | Shortfalls from its own planning | Chat median / max | Reasoning tokens (32 runs) |
|---|---|---|---|---|
| none (today) | 16 / 2 / 14 | 15 | 7 s / 20 s | 0 |
| `low` | 22 / 3 / 7 | 9 | 11 s / 142 s | 17,498 |
| `medium` | not evaluated | — | 24 s / 240 s | 117,414 |

- At `low`, tests 01, 02, 04, 16, 18, 19, 24 and 26 pass that failed without reasoning; 12 (a new
  group instead of a merge) got worse.
- `low`'s slowest turn (142 s) waited on a `get-plan-images` call that timed out. `medium`'s slowest
  turn took 240 s, close to the 5-minute turn timeout.
- The session was stopped after these three pairs; the 3 runs at `high` are not evaluated.

### 3.3 Earlier, at the defaults

The 29 tests of 2026-10-06 (`mcp-test-2026-10-06_08-31-06`): gpt-5-mini 24 / 5 / 0 (chat 24 s /
53 s), gpt-6-astra 28 / 1 / 0 (13 s / 152 s). Both ran at their default, which measures as
`medium`.

### 3.4 Found in passing — not part of this ticket

Bugs of the MCP server the evaluation of 2026-10-07 showed, for the MCP test backlog:

- The G45 correction hangs a unit "above" a tall unit above the next tall unit: `floorBeside`
  (`group-layout.ts`) excludes wall units only, not tall units (runs 04, 08, 11 without reasoning).
- `change-group-attribute` passes a value label ("White" for `mod_FrontColor`) to the planner
  unchecked; the planner answers ok and changes nothing (run 19 without reasoning).

Every run's snapshot save failed with HTTP 400 against the local planner — the known item of
[mcp-test-infrastructure-issues.md](../backlog/mcp-test-infrastructure-issues.md); the runs kept
their images and plan context.

## 4. The approach

### Step 1 — the step log (done)

See [2.2](#22-the-step-log-step-1). Unit test: a step with 40 reasoning tokens logs "40 reasoning
tokens".

### Step 2 — an effort per deployment from the data, verified

| Deployment | Today | Step 2 | Why |
|---|---|---|---|
| gpt-5.4-mini | no reasoning | `low` | fewer fails than without reasoning (7 against 14, 3.2); `medium` is not evaluated and its slowest turn came close to the turn timeout |
| gpt-5-mini | its default, like `medium` | `medium` | plans well at it (3.3); set explicitly so a changed Foundry default does not change the chat |
| gpt-6-astra | its default, like `medium` | `medium` | the reference; plans well at it (3.3) |

- `FOUNDRY_DEPLOYMENTS` in `chat-config.ts` carries each deployment's effort;
  `HI_CHAT_REASONING_EFFORT` overrides it; Mistral, Anthropic and Google models get none.
- The chat does not ask for the reasoning summary (`reasoningSummary: null`): it never shows it.
- The ligna-store chat gets the same table.
- Verification: unit tests, and one live run per deployment in which the step log must show
  reasoning tokens for gpt-5.4-mini and the run must create its group.

### Step 3 — detailed measurement, only on request

Measured run times of 2026-10-07 for the 32 tests: 14 minutes without reasoning, 19 at `low`, 36 at
`medium`, about 50 expected at `high` (81 s median per run in the 3 runs that ran). Evaluating one
model and effort takes about 12 minutes and 320k tokens.

| Option | Answers | Run time | Evaluation |
|---|---|---|---|
| A | Is `medium` better than `low` for gpt-5.4-mini? Evaluate the 32 stored `medium` runs | none | ~15 minutes, ~0.3M tokens |
| B | gpt-5.4-mini at `high` | ~50 minutes | ~15 minutes, ~0.3M tokens |
| C | gpt-5-mini at `low`, `medium`, `high` | ~2 hours | ~40 minutes, ~1M tokens |
| D | Every effort of the three models, each run twice | ~8 hours | ~3 hours, ~4M tokens |

The runner needs no change for it: one session per effort, with `HI_CHAT_REASONING_EFFORT` in its
environment. Before starting, the agent names the option with its time and token cost and waits for
an explicit go.

## 5. Alternatives considered

| Alternative | Why not |
|---|---|
| The full matrix first, then set the efforts | Hours of runs before any improvement lands; started on 2026-10-07 and stopped |
| The SDK's standard `reasoning` call setting instead of `providerOptions.azure` | It applies to every provider (Anthropic and Google would derive a thinking budget from it) and does not accept `max`; `providerOptions` wins over it anyway |
| `medium` for gpt-5.4-mini now | Not evaluated; its slowest turn came close to the turn timeout. Option A of step 3 decides it in 15 minutes |
| Step-by-step reasoning asked for in the system prompt | A weaker substitute; only if no effort is enough |

## 6. Risks

- **A rejected value ends the turn**: gpt-5-mini and gpt-6-astra reject `none`. Step 2 uses `low` and
  `medium` only, which all three accept.
- **Longer turns**: gpt-5.4-mini's median chat time rises from 7 s to 11 s at `low`. The store chat
  has no turn timeout and streams nothing while a model reasons.
- **One run per test**: the 3.2 numbers carry run-to-run variance; option D of step 3 repeats them.

## 7. Files

| File | Step |
|---|---|
| `hi-mcp/hi-mcp-chat/chat-steps.ts`, `tests/chat-steps.test.ts` | 1 |
| `hi-mcp/hi-mcp-chat/chat-config.ts`, `chat-server.ts`, `tests/chat-handler.test.ts` | 2 |
| ligna-store `hi-mcp/chat.ts`, `hi-mcp/README.md` | 2 |
| `docs/ai-chat.md`, `docs/hi-mcp-behaviour.md` | 1, 2 |
| `.agents/backlog/reasoning-effort-for-the-gpt-chat-models.md` and its index rows | 2 (step 3 stays as the open part) |
