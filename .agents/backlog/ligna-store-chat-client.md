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
