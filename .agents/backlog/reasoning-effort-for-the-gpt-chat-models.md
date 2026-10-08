# Backlog: reasoning effort for the GPT chat models

> **Type**: Backlog item (hardening, chat)
> **Domain**: `hi-mcp/hi-mcp-chat` — `chat-config.ts` (`FOUNDRY_DEPLOYMENTS`), `chat-server.ts` (`providerOptions`); ligna-store `hi-mcp/chat.ts`
> **Status**: Open
> **Ticket**: [RML-18043](https://roomle.atlassian.net/browse/RML-18043)

---

## Problem

The example chat sends gpt-5.4-mini and gpt-5-mini the reasoning effort `high` (`FOUNDRY_DEPLOYMENTS`
in `chat-config.ts`): accuracy goes over speed, and the lightweight models plan worst. gpt-5.4-mini
does not reason at its Foundry default and failed 14 of the 32 tests of "test the mcp" without
reasoning against 7 at `low`; how they plan at `high`, and whether every turn stays within the
5-minute turn timeout, is not measured. The data:
[analysis, section 3](../feature-analysis/reasoning-effort-per-gpt-chat-model.md#3-measured-on-2026-10-07).

## To do

1. **The rest of step 2**: the same efforts in the ligna-store chat
   ([plan](../feature-analysis/reasoning-effort-per-gpt-chat-model-implementation-plan.md#step-2--set-the-effort-per-deployment-and-verify-it-about-40-minutes)
   — its values `low` and `medium` are replaced by `high` for the lightweight models).
2. **Step 3, only on request**: measure the 32 tests at `high` for gpt-5.4-mini and gpt-5-mini
   (about 50 minutes each), including the turns that come close to the turn timeout. The options
   with their run time and token cost are in the
   [analysis](../feature-analysis/reasoning-effort-per-gpt-chat-model.md#step-3--detailed-measurement-only-on-request);
   none starts without an explicit go.

## Test

- Unit tests: `it('gives the lightweight GPT deployments reasoning effort high')` covers the
  efforts, the override and the providers without one.
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
