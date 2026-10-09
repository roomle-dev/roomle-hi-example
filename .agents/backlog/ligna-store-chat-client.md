# Backlog: the ligna-store chat as a client of the HI MCP server

> **Type**: Backlog items (ligna-store)
> **Domain**: ligna-store `hi-mcp/chat.ts`; reference: the example chat `hi-mcp/hi-mcp-chat` of this repository
> **Status**: Open
> **Ticket**: [RML-18033](https://roomle.atlassian.net/browse/RML-18033)

The store runs its own chat against the same MCP server as the example chat. Where the two differ,
the store loses what the example already handles.

## Overview

| # | Issue | To do |
|---|---|---|
| 1 | [The images of `get-plan-images` reach Mistral as base64 text](#1-the-images-of-get-plan-images-reach-mistral-as-base64-text) | Move tool images into a user message with the example's middleware |
| 2 | [A turn can end without an answer](#2-a-turn-can-end-without-an-answer) | Reserve the final step for the model's answer |

---

## 1. The images of `get-plan-images` reach Mistral as base64 text

**Problem.** `getLanguageModel` creates the Mistral models with `createMistral({ apiKey })(model)`
and no middleware (ligna-store `hi-mcp/chat.ts:47-50`), and `mistral-large-latest` and
`mistral-medium-latest` are chat models with image input (`hi-mcp/chat-options.ts`).
`@ai-sdk/mistral` sends the content of a tool result as JSON text, while Mistral reads images only in
user messages, so the two PNGs of `get-plan-images` reach the model as base64 and can overflow its
context.

**To do.** Wrap the Mistral model with `wrapLanguageModel` and the example's middleware
`toolResultFilesAsUserMessages` (`hi-mcp/hi-mcp-chat/tool-result-images.ts:67`, used in
`chat-server.ts:50-53`), which moves the images of a tool result into a user message after the tool
message.

**Test.** The example's `tests/tool-result-images.test.ts` covers the middleware; in the store, a
Mistral turn that calls `get-plan-images` answers from the images.

**Reproduce.** Not reproduced in a run; follows from the code above.

## 2. A turn can end without an answer

**Problem.** `streamChat` stops after eight steps with `stopWhen: stepCountIs(8)` (ligna-store
`hi-mcp/chat.ts:75`), and every step may call a tool. A turn whose tool calls need corrections or a
retry uses all eight steps on tools and ends without a summary.

**To do.** Take the example's step policy `chatSteps` (`hi-mcp/hi-mcp-chat/chat-steps.ts:10`): the
last step may not call a tool, so the turn always ends with an answer. The number of steps is a
product choice of its own; the example uses 16.

**Test.** The example's `it('ends a turn that uses every step with the model answer')` in
`hi-mcp/hi-mcp-chat/tests/chat-steps.test.ts`; in the store, a turn that calls a tool in every step
still ends with an answer.

**Reproduce.** Not reproduced in a run; follows from the code above.
