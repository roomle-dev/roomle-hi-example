# Backlog: reasoning effort for the GPT chat models

> **Type**: Backlog item (hardening, chat)
> **Domain**: `hi-mcp/hi-mcp-chat` — `chat-config.ts` (the Foundry deployments), `chat-server.ts` (`providerOptions`); ligna-store `hi-mcp/chat.ts`
> **Status**: Open
> **Ticket**: [RML-18043](https://roomle.atlassian.net/browse/RML-18043)

---

## Problem

gpt-5.4-mini plans without reasoning: the chat sends no reasoning effort, and the deployment's
default on the HI Azure AI Foundry resource is no reasoning — 0 reasoning tokens in every step.
Without reasoning it plans worse than at `low` (14 against 7 fails in the 32 tests of "test the
mcp"). gpt-5-mini and gpt-6-astra reason by default, as at `medium`. The data:
[analysis, section 3](../feature-analysis/reasoning-effort-per-gpt-chat-model.md#3-measured-on-2026-10-07).

## To do

1. **Step 2**: set the effort per Foundry deployment — gpt-5.4-mini `low`, gpt-5-mini `medium`,
   gpt-6-astra `medium` — in the example chat and the ligna-store chat, and verify it
   ([plan](../feature-analysis/reasoning-effort-per-gpt-chat-model-implementation-plan.md#step-2--set-the-effort-per-deployment-and-verify-it-about-40-minutes)).
2. **Step 3, only on request**: measure further efforts — first whether `medium` beats `low` for
   gpt-5.4-mini. The options with their run time and token cost are in the
   [analysis](../feature-analysis/reasoning-effort-per-gpt-chat-model.md#step-3--detailed-measurement-only-on-request);
   none starts without an explicit go.

## Test

- Unit tests: every Foundry deployment gets its effort, `HI_CHAT_REASONING_EFFORT` overrides it,
  Mistral, Anthropic and Google models get none, the Responses request carries the effort.
- One live run per deployment: gpt-5.4-mini's step log shows reasoning tokens above 0.

**Reproduce.** `.temp/result/mcp-test-2026-10-07_07-20-49` — `gpt-5.4-mini/` (no reasoning) against
`gpt-5.4-mini-low/`.

## Sources

- [GPT-5.4 mini model page](https://developers.openai.com/docs/models/gpt-5.4-mini): reasoning effort
  `none` (default) to `xhigh`
- [GPT-6 Astra model page](https://developers.openai.com/docs/models/gpt-6-astra): `low` to `max`
- [Reasoning models](https://developers.openai.com/api/docs/guides/reasoning): the reasoning effort
  values; gpt-6-astra answers `none` with HTTP 400
- [Vercel AI Gateway: OpenAI reasoning](https://vercel.com/docs/ai-gateway/capabilities/reasoning/openai)
