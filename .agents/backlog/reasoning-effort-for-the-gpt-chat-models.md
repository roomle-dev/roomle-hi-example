# Backlog: reasoning effort for the GPT chat models

> **Type**: Backlog item (hardening, chat)
> **Domain**: `hi-mcp/hi-mcp-chat` — `chat-server.ts` (`streamText`), `chat-config.ts` (the Foundry deployments)
> **Origin**: the test `mcp-test-2026-10-02_17-25-40`: gpt-5-mini 12 pass / 5 partial / 0 fail, gpt-5.4-mini 9 / 3 / 5
> **Date**: 2026-10-03
> **Status**: Open

---

**Increasing the reasoning effort must be considered and investigated** before gpt-5.4-mini is
judged as the weaker planner, and before the chat's model is chosen. The two models may not have
run at the same reasoning effort (see the hypothesis below). Until that is measured, the comparison
may not be a fair one. See [To do](#to-do).

## What was measured

gpt-5.4-mini planned clearly worse than gpt-5-mini, although it is the newer model. In
`mcp-test-2026-10-02_17-25-40` it was never better on a single test. Its five fails are
planning mistakes, not format mistakes: a placement at the wrong end of a wall, rows longer
than the wall, appliances left out, and an exchange instead of a width change (14). It writes the
relations correctly: 9 of its 10 creating runs used them, and none needed a correction. The
earlier session with the old format (`mcp-test-2026-10-02_13-47-02`) has the same order: 12 / 3 / 2
against 7 / 6 / 4.

gpt-5.4-mini was also 2 to 4 times faster on almost every test (chat duration from `run.json`):

| Test | gpt-5-mini | gpt-5.4-mini |
|---|---|---|
| 03 kitchen in the back right corner | 37.5 s | 10.5 s |
| 06 image: kitchen on the left-hand wall | 67.7 s | 15.2 s |
| 08 image: planning on the right-hand wall | 45.7 s | 14.3 s |
| 10 full kitchen around the corner | 54.0 s | 40.5 s |

The runs record no token usage, so how much each model reasoned is not known.

## Hypothesis: the two models ran with different reasoning efforts

The chat sends no reasoning effort (`streamText` in `hi-mcp/hi-mcp-chat/chat-server.ts`), so each
model runs at its default. OpenAI documents different defaults for the two models:

| Model | Reasoning efforts | Default |
|---|---|---|
| gpt-5-mini | `minimal`, `low`, `medium`, `high` | `medium` |
| gpt-5.4-mini | `none`, `low`, `medium`, `high`, `xhigh` | `none` |

**If** the Azure AI Foundry deployments use the same defaults, gpt-5-mini reasoned before each
step and gpt-5.4-mini did not reason at all. That would explain both measurements: the failures
are the kind that planning without reasoning produces (a row not added up against the wall length,
a requested appliance not checked off), and a model without reasoning answers faster.

This is not established. The Foundry defaults are not verified, and faster answers alone do not
show a lower effort: gpt-5.4-mini is also presented as a faster model. Step 1 of [To do](#to-do)
tests the hypothesis.

## Where the hint came from

A question to Gemini ("why does gpt-5-mini give much better results than gpt-5.4-mini with our
MCP?") gave three reasons. The checked facts in this document replace them:

- **Both models read images**: confirmed. Both take text and image input and have a 400k context
  window. The chat already sends images to both (`IMAGE_INPUT_MODELS`).
- **gpt-5.4-mini is tuned for speed and agentic coding, and is faster and cheaper**: that is how
  OpenAI presents it. "More than twice as fast" was not checked against our deployment. The chat
  durations above show a gap of that size, but they may also contain a difference in reasoning.
- **gpt-5.4-mini has to be asked for a higher reasoning effort, otherwise it puts speed first**:
  its documented default is `none`, which matches. Whether this caused the result is the
  hypothesis above. The reasoning effort is set by the chat client, in `streamText`. The MCP server
  and its served rules cannot set it.
- **Ask for step-by-step reasoning in the system prompt**: a weaker substitute for the reasoning
  effort. A reasoning model does this itself when its effort is above `none`. Try it only if a
  higher effort is not enough.

## To do

> **State 2026-10-04**: steps 1 and 3 are in the code (RML-18041): every step logs its tokens
> (`logStepUsage`, `hi-mcp-chat/chat-steps.ts`), and `HI_CHAT_REASONING_EFFORT` sets the effort
> for the Foundry deployments (`providerOptions.azure.reasoningEffort`). The measurement and the
> choice of a shared value (step 2) are open.

1. **Measure first.** Log the reasoning tokens of every step
   (`usage.outputTokenDetails.reasoningTokens` in the `onStepFinish` of `streamText`) and write
   them into `run.json` of the test runner. This shows the effective default on Foundry, tests
   the hypothesis, and gives a baseline.
2. **Set the reasoning effort for the Foundry deployments.** Add it to `streamText` for the
   `azure` provider, either as `providerOptions: { azure: { reasoningEffort } }` or as the AI SDK 7
   call setting `reasoning`. Start with `medium` for both models, so they run under the same
   conditions. If Foundry matches the OpenAI defaults, gpt-5-mini keeps its current behaviour and
   gpt-5.4-mini runs with reasoning.
   The default `none` is rejected by gpt-5-mini, so do not use it as a shared value.
3. **Make it adjustable for tests.** Add one environment variable, e.g. `HI_CHAT_REASONING_EFFORT`,
   so "test the mcp" can compare `low`, `medium` and `high` without a code change. Document it in
   the environment table of `minimal-hi-example/docs/ai-chat.md`.
4. **Run "test the mcp" again** with gpt-5.4-mini at `medium`, and compare it with gpt-5-mini at
   the same effort. Compare the duration too: a higher effort makes the largest prompts slower,
   which touches [issue 17](mcp-test-open-issues.md#17-a-chat-turn-without-an-answer-for-10-minutes)
   (a chat turn without an answer for 10 minutes).
5. **Decide which model the chat should use** from that run: gpt-5.4-mini only replaces gpt-5-mini
   if it plans at least as well at an effort that keeps a large kitchen within a minute or two.

## Test

- A chat handler unit test: a Foundry deployment gets the configured reasoning effort in its
  provider options, and a Mistral or Anthropic model gets none.
- "Test the mcp" with gpt-5-mini and gpt-5.4-mini at the same reasoning effort. gpt-5.4-mini has no
  fail that comes from its own planning (wrong end of the wall, a row longer than the wall,
  missing appliances).

## Sources

- [GPT-5.4 mini model page](https://developers.openai.com/docs/models/gpt-5.4-mini): reasoning
  effort `none` (default) to `xhigh`; text and image input; 400k context
- [Using GPT-5.4](https://developers.openai.com/api/docs/guides/gpt-5.4): GPT-5.4 defaults to no
  reasoning
- [Reasoning models](https://developers.openai.com/api/docs/guides/reasoning): the reasoning effort
  values
- [Vercel AI Gateway: OpenAI reasoning](https://vercel.com/docs/ai-gateway/capabilities/reasoning/openai):
  gpt-5-mini supports `minimal` to `high`, default `medium`, and rejects `none`
- [Introducing GPT-5.4 mini and nano](https://openai.com/index/introducing-gpt-5-4-mini-and-nano/)
