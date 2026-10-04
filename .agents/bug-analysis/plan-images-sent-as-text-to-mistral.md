# get-plan-images reaches Mistral as base64 text

> **Type**: Bug Analysis
> **Domain**: hi-mcp-chat — the chat backend's Mistral model (`hi-mcp/hi-mcp-chat/chat-server.ts`); the tool-result conversion of `@ai-sdk/mistral`; the `get-plan-images` tool (`hi-mcp/hi-mcp-server/hi-mcp-server.ts`)
> **Trigger**: "test the mcp" run `.temp/result/mcp-test-2026-09-30_18-52-26/report.md` (mistral-large-latest, planner `bo-test`): 4 of 13 runs ended with `Prompt … > 262144 maximum context length` right after `get-plan-images`
> **Date**: 2026-10-01
> **Author**: AI Assistant
> **Status**: Fixed
> **Branch**: `fix/chat-context-overflow-mistral`

---

## Symptom

| Run | Prompt | Tools before the error | Prompt tokens of the failing request |
|---|---|---|---|
| 03 | plan a kitchen in the back right corner of the room | … → place-group → get-plan-images | 1,462,493 |
| 04 | … oven, range hood, sink and fridge in the back right corner | … → create-or-replace-groups ‖ get-plan-images | 2,149,663 |
| 07 | add a cabinet with drawers to the right of the kitchen | … → create-or-replace-groups → get-plan-images | 2,135,883 |
| 11 | setup turn of "make the fronts of the whole kitchen white" | … → create-or-replace-groups ‖ get-plan-images | 2,146,298 |

Mistral Large's context is 262,144 tokens. The request after `get-plan-images` was 5.6 to 8.2
times that, the turn ended with the provider's error and no answer (`run.json` `errors`). The
gpt-5.4-mini run of 18:34 on the same code had no such error.

## Investigation

**The tool result.** `get-plan-images` (`hi-mcp-server.ts:446-475`) returns two MCP `image`
content blocks — the perspective and the top image as base64 PNG. The images of run 03 are
1024 × 1024 (371 KB) and 1024 × 936 (1.5 MB): about 2.5 million base64 characters.

**The MCP client.** `@ai-sdk/mcp` 2.0.62 gives every MCP tool `toModelOutput: mcpToModelOutput`
(`node_modules/@ai-sdk/mcp/dist/index.js:2582-2604`): an MCP `image` block becomes a tool-result
content part `{ type: 'file', mediaType, data: { type: 'data', data } }`. The chat backend's
tool wrapper (`chat-server.ts:71-102`) spreads the tool and keeps `toModelOutput`. Up to here
the images are images.

**The provider.** Each provider converts a tool result of type `content` into its API format:

| Provider (version in the lockfile) | `content` with a `file` part |
|---|---|
| `@ai-sdk/anthropic` 4.0.68 | an `image` block in the `tool_result` (`dist/index.js:3119-3165`) |
| `@ai-sdk/google` 4.0.85 | `inlineData` in the `functionResponse` parts (`dist/index.js:430-451`) |
| `@ai-sdk/azure` 4.0.85 (Responses API, `dist/index.js:243-395`) | `input_image` in `function_call_output` (`@ai-sdk/openai` `dist/index.js:6399-6430`) |
| **`@ai-sdk/mistral` 4.0.54** | **`JSON.stringify(output.value)`** (`dist/index.js:221-224`) |

The Mistral provider writes the whole content array, base64 data included, as the text of the
`tool` message. The latest release, 4.0.56, does the same. The model receives 2.5 million
characters of base64 as text — the 1.5 to 2.1 million tokens of the error — and could not read
an image from it even if it fit.

**What the Mistral API accepts.** A direct request to `mistral-large-latest` with the run's top
image (1024 × 936) as an `image_url` chunk in a **user** message that follows the `tool`
message was accepted: 1,391 prompt tokens in total, and the model described the image. Mistral
takes images in user messages; only the provider's tool-message path flattens them.

## Root cause

`@ai-sdk/mistral` serializes a tool result's `content` parts with `JSON.stringify`
(`node_modules/@ai-sdk/mistral/dist/index.js:221-224`), so the image parts of `get-plan-images`
reach Mistral as base64 text. The chat backend passes such tool results to the Mistral model
unchanged (`chat-server.ts:42-43`, `:104-113`).

## Fix

*Implemented in `db97c16` as proposed.*

In the chat backend, the Mistral model is wrapped (`wrapLanguageModel` from `ai`) with a middleware
whose `transformParams` moves the `file` parts of every tool result into a user message right
after that tool message. The tool result keeps its text parts and a short note that the images
follow in the next message. The other providers keep their native image handling; only the
Mistral model is wrapped.

- New module `hi-mcp/hi-mcp-chat/tool-result-images.ts`: the middleware and the prompt
  transform it uses.
- `chat-server.ts`: the `mistral` case of `getLanguageModel` returns the wrapped model.
- Unit tests `hi-mcp/hi-mcp-chat/tests/tool-result-images.test.ts`: the images of a tool result
  move into a user message after the tool message, the text parts stay; a prompt without image
  parts is unchanged.
- Docs: `minimal-hi-example/docs/ai-chat.md` (Mistral and tool-result images), the testing
  skill's "When a run fails" row for the context error.

### Alternatives rejected

- **Replace the images by a text note for Mistral, or hide `get-plan-images` from it** — fixes
  the error but takes the visual check away from a vision model that can use it.
- **Upgrade `@ai-sdk/mistral`** — 4.0.56, the latest release, serializes the same way.
- **Smaller images in the MCP server** — any base64 text costs about one token per character;
  a smaller image still arrives as unreadable text.

## Validation

- Unit tests `hi-mcp-chat/tests/tool-result-images.test.ts` (4) pass; the workspace typecheck passes.
- Live: "call get-plan-images and describe in two sentences what you see in the top view image"
  with `mistral` — one tool call, no error, 12.6 s; the answer describes the empty preset room
  correctly. Stored as `00-check-get-plan-images` of the run below.
- "test the mcp" with Mistral, `.temp/result/mcp-test-2026-10-01_09-10-40/report.md`: no run
  ended with an error (4 before). The model did not call `get-plan-images` in that suite, so the
  live check above is the evidence for this fix.
