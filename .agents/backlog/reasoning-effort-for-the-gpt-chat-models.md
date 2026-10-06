# Backlog: reasoning effort for the GPT chat models

> **Type**: Backlog item (hardening, chat)
> **Domain**: `hi-mcp/hi-mcp-chat` — `chat-server.ts` (`streamText`, `providerOptions`), `chat-steps.ts` (`logStepUsage`), `chat-config.ts` (the Foundry deployments)
> **Status**: Open

---

## Problem

gpt-5.4-mini plans clearly worse than gpt-5-mini and gpt-6-astra with the same server and the same
tests (29 tests, local planner):

| Model | Pass | Partial | Fail |
|---|---|---|---|
| gpt-6-astra | 28 | 1 | 0 |
| gpt-5-mini | 24 | 5 | 0 |
| gpt-5.4-mini | 16 | 7 | 6 |

Its fails are planning mistakes: a placement at the wrong end of a wall, a base row with two hobs and
no sink, a new group beside the kitchen instead of a merged unit, the wrong unit exchanged. It also
skips `get-authoring-rules` in most runs and answers 2 to 4 times faster.

Whether it reasons at all is not known. The chat sends no reasoning effort unless
`HI_CHAT_REASONING_EFFORT` is set, so each model runs at its default. OpenAI documents `none` as the
default of gpt-5.4-mini and `medium` for gpt-5-mini; the Foundry defaults are not verified. The step
log (`logStepUsage`) shows 0 reasoning tokens in every step of every model, gpt-5-mini included, so the
reasoning tokens do not reach the log — it cannot tell the effort.

## To do

1. **Make the reasoning measurable.** Find where Foundry reports the reasoning tokens (the raw
   response's `usage.output_tokens_details.reasoning_tokens`) and why `logStepUsage` reads 0 —
   the AI SDK's azure provider mapping of `usage.outputTokens.reasoning`. Fix the log or read the raw
   usage.
2. **Measure the defaults.** One prompt per model with no effort set: the reasoning tokens show the
   effective default on Foundry.
3. **Run "test the mcp" with gpt-5.4-mini at `HI_CHAT_REASONING_EFFORT=medium`** and compare it with
   gpt-5-mini at the same effort, including the chat duration of the largest prompts (the turn
   timeout is 5 minutes). `none` is rejected by gpt-5-mini, so it is no shared value.
4. **Decide the chat's model and effort** from that run: gpt-5.4-mini replaces gpt-5-mini only if it
   plans at least as well at an effort that keeps a large kitchen within a minute or two. Record the
   default in `minimal-hi-example/docs/ai-chat.md`, and decide whether the chosen model replaces
   `mistral`, the chat backend's default provider without `HI_CHAT_PROVIDER` (`resolveChatModel`,
   `hi-mcp/hi-mcp-chat/chat-config.ts`).

## Test

- A chat-steps test: a step whose usage carries reasoning tokens logs them.
- "Test the mcp" with gpt-5-mini and gpt-5.4-mini at the same reasoning effort: gpt-5.4-mini has no
  fail that comes from its own planning (wrong end of the wall, missing appliances, a new group beside
  an existing one).

## Sources

- [GPT-5.4 mini model page](https://developers.openai.com/docs/models/gpt-5.4-mini): reasoning effort
  `none` (default) to `xhigh`
- [Reasoning models](https://developers.openai.com/api/docs/guides/reasoning): the reasoning effort
  values
- [Vercel AI Gateway: OpenAI reasoning](https://vercel.com/docs/ai-gateway/capabilities/reasoning/openai):
  gpt-5-mini supports `minimal` to `high`, default `medium`, and rejects `none`
