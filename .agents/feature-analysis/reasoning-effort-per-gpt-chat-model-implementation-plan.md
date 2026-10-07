# RML-18043: implementation plan — a reasoning effort per GPT chat model, step by step

> **Type**: Implementation plan (step 4 of the [change workflow](../../AGENTS.md#suggested-change-workflow))
> **Analysis**: [reasoning-effort-per-gpt-chat-model.md](reasoning-effort-per-gpt-chat-model.md) — the
> SDK path, the measured defaults and the gpt-5.4-mini results this plan rests on
> **Date**: 2026-10-07
> **Author**: AI Assistant
> **Status**: Step 1 done, step 2 open, step 3 only on request
> **Branch**: `feat/reasoning-effort-per-model-RML-18043` (roomle-hi-example: steps 1 and the
> documents), a new branch for step 2; `feat/hi-mcp-reasoning-effort-RML-18043` (ligna-store, step 2)

---

## Rules of this plan

- **One step at a time.** A step ends with a verified, usable result; the next starts only after it.
- **No long run without a go.** Before any run or evaluation longer than 30 minutes, the agent names
  its run time and token cost and waits for an explicit go.

## Step 1 — fix the reasoning-token log (done)

`fix: log the reasoning tokens of every chat step`.

| File | Change |
|---|---|
| `hi-mcp/hi-mcp-chat/chat-steps.ts` | the step usage is typed with the SDK's `LanguageModelUsage`, so a renamed field fails the typecheck instead of logging 0; the line reads `outputTokenDetails.reasoningTokens` |
| `hi-mcp/hi-mcp-chat/tests/chat-steps.test.ts` | **logs the reasoning tokens of a step**: a step with 40 of 50 output tokens spent on reasoning logs "100 in, 50 out, 40 reasoning tokens"; it failed before the fix |
| `minimal-hi-example/docs/ai-chat.md` | the step log shows the reasoning tokens; "out" counts them too |

Verified: the unit tests, and live on 2026-10-07 — gpt-5-mini logged 64 to 1,408 reasoning tokens
per step, gpt-5.4-mini 0 (analysis 3.1).

## Step 2 — set the effort per deployment and verify it (about 40 minutes)

| Deployment | Effort |
|---|---|
| gpt-5.4-mini | `low` |
| gpt-5-mini | `medium` |
| gpt-6-astra | `medium` |

Why these values: analysis [4, step 2](reasoning-effort-per-gpt-chat-model.md#step-2--an-effort-per-deployment-from-the-data-verified).

### Code — roomle-hi-example

| File | Change |
|---|---|
| `hi-mcp/hi-mcp-chat/chat-config.ts` | `FOUNDRY_DEPLOYMENTS` becomes `Record<string, { reasoningEffort?: string }>` with the efforts above; `resolveChatModel` checks it with `Object.hasOwn`. `getChatConfig`: `HI_CHAT_REASONING_EFFORT`, else the Foundry deployment's effort. `chatProviderOptions(config)`, moved here from `chat-server.ts`: the effort under `azure` with `reasoningSummary: null` for the azure provider, `undefined` otherwise |
| `hi-mcp/hi-mcp-chat/chat-server.ts` | uses `chatProviderOptions`; its own `providerOptions` goes |

### Unit tests — `hi-mcp/hi-mcp-chat/tests/chat-handler.test.ts`, `describe('reasoning effort')`

1. **gives every Foundry deployment its reasoning effort** — `low`, `medium`, `medium`, written as
   literals, and `chatProviderOptions` carries them under `azure`.
2. **lets HI_CHAT_REASONING_EFFORT override the deployment's effort** — gpt-5.4-mini with `high` →
   `high`.
3. **sends no reasoning effort to Mistral, Anthropic and Google models** — with and without the
   variable; the `openai` alias (gpt-4o on a resource of its own) gets only the variable.
4. **sends the effort as reasoning.effort of the Responses request** — `createAzure` with a fetch
   stub: the request goes to `<FOUNDRY_BASE_URL>/responses` and its `reasoning` is the effort only,
   without a summary. An SDK upgrade that changes the option key or the summary fails here.

### Live verification (about 5 minutes)

One run per deployment, against the deployed planner:

```bash
node .agents/scripts/run-hi-mcp-prompt.js gpt-5.4-mini "$AZURE_GPT_KEY" "add a group of three tall units to the wall on the right" --plan ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv
```

The step log of gpt-5.4-mini shows reasoning tokens above 0 (0 today), and every run creates its
group. The planning quality at `low` is measured already (analysis 3.2).

### Code — ligna-store (about 15 minutes with its check)

| File | Change |
|---|---|
| `hi-mcp/chat.ts` | `REASONING_EFFORTS` with the same three values, copied by hand from `FOUNDRY_DEPLOYMENTS`; `streamText` sends the model's effort under `azure` with `reasoningSummary: null`. The Mistral models get none |
| `hi-mcp/README.md` | the efforts; "Provenance and sync" names the copy source |

No unit tests in the store (it has no unit-test setup; the rule is tested in roomle-hi-example).
Verification: `npm run lint`, and one prompt in the local store with gpt-5.4-mini whose request to
`…/openai/v1/responses` must carry `reasoning.effort` `low`.

### Documentation

- [ai-chat.md](../../minimal-hi-example/docs/ai-chat.md): the effort per deployment, the override,
  the summary left out; the environment table row of `HI_CHAT_REASONING_EFFORT`; the ligna-store
  section.
- [hi-mcp-behaviour.md](../../hi-mcp/docs/hi-mcp-behaviour.md): decision **D50** (the chat sends
  each Foundry deployment its effort; the MCP server cannot set it) and the HI chat bullet of §4.
- The backlog item keeps only step 3.

## Step 3 — detailed measurement (only on request)

The options, their run time and token cost are in the analysis,
[step 3](reasoning-effort-per-gpt-chat-model.md#step-3--detailed-measurement-only-on-request):
from 15 minutes (evaluate the 32 stored gpt-5.4-mini runs at `medium`) to about 8 hours (every
effort of the three models, twice). The test runner needs no change: one session per effort with
`HI_CHAT_REASONING_EFFORT` in its environment. Nothing of step 3 starts without an explicit go.

## Risks

- **A rejected value ends the turn**: `low` and `medium` are accepted by all three deployments
  (measured at `medium`, documented for `low`); `none` is rejected by gpt-5-mini and gpt-6-astra.
- **Longer turns for gpt-5.4-mini**: median 11 s instead of 7 s at `low`.
- **The values rest on one run per test**: step 3 can repeat them.
