# Every look at the plan ends the turn

> **Type**: Bug Analysis  
> **Status**: Open — the fix is implemented and verified with the unit tests on the working branch, and the analysis stays open until it lands on the planner branch (`release/bo-test`) or `master`; the release verification is recorded here then, and ["cleanup analyses"](../skills/hi-analysis-cleanup.md) closes and deletes it  
> **Date**: 2026-11-01  
> **Backlog**: [Where Mistral Large falls short of the prompts](../backlog/mistral-large-prompt-issues.md), issue 11 ("Every look at the plan ends the turn") — removed when the fix was implemented, per [the backlog rule](../backlog/README.md)  
> **Base**: roomle-hi-example `analysis/every-look-at-the-plan-ends-the-turn` (from `master` `f1bd307`); roomle-ui `feat/hi-planning-assistant-lightweight` (`04cca686c`)  
> **Fix**: roomle-ui `feat/hi-planning-assistant-lightweight` `04cca686c` — the `mistral` case of `loadChatModel` wraps the provider model with `withToolImagesAsUserMessage` (`packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts`), so the images of a tool result go into a user message after the tool message and `@ai-sdk/mistral` sends them as `image_url` parts; unit tests in `tests/unit/embedding-lib/homag-intelligence/hi-planning-assistant.spec.ts` (the images of a tool result move into a user message in `doGenerate` and `doStream`, tool results without images stay as they are); living reference in roomle-ui `.agents/homag-intelligence/agent-architecture.md` and in `docs/ai-chat.md` § "Images in tool results". Verified with the unit tests — 140 pass in `tests/unit/embedding-lib/homag-intelligence`, lint and types clean; the re-run of the 11 `mistral-large-4` prompt tests against the local dev planner is still open — see §4

**Affected repositories**

- **roomle-ui** (on `feat/hi-planning-assistant-lightweight`): the planning assistant of the
  embedding-lib — `loadChatModel`'s `mistral` case
  (`packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts:237-242`), which returns
  the provider model without the `withToolImagesAsUserMessage` wrapper the `openai-compatible` case
  applies (`:218-235`); the wrapper itself (`:101-175`); the unit tests
  (`tests/unit/embedding-lib/homag-intelligence/hi-planning-assistant.spec.ts` — the assertion at
  `:129-132` expects the unwrapped model — plus a request-shape test in the pattern of
  `hi-planning-openai-compatible.spec.ts`).
- **roomle-hi-example**: this analysis and the backlog item it comes from; `docs/ai-chat.md` §
  "Images in tool results" when the fix lands (it currently tells the user to pick a GPT, Claude or
  Gemini model for plannings that look at the plan).
- **Unchanged:** the HI MCP tools and the planner — the tool result format is the AI SDK's shape and
  correct (`hi-mcp-tools.ts` `mcpToModelOutput`, `:49-63`); the HI tool commands; `@ai-sdk/mistral`
  itself (loaded from the CDN, not a dependency — the fix goes around it in the embedding-lib); the
  library's calculation.

## 1. Symptom and reproduction

A Mistral model that checks its work with `get-plan-images` ends the turn with an error instead of
an answer. 11 of the 52 runs of `mcp-test-2026-10-21_16-59-20` (`mistral-large-4`) end so
(large-4 04, 05, 10, 15, 19, 32, 34, 41, 47, 48, 52); in 9 of the 11 the plan already fulfils the
request, but the user sees "The planning assistant failed: …" instead of the answer, and a
conversation ends there — the swap of large-4 41 is never sent. Smaller renders fit (large-4 13,
14), so it is the size, not the call. `mistral-large-latest` shows the issue in its runs only through
the chat timeout, not as a context error.

**Reproduce.** Run "test the mcp" with `mistral:mistral-large-4` on `media-unit-left-wall`
(large-4 04) against the local roomle-ui (`--dev`): the model calls `get-plan-images` after a plan
change, the next model request is rejected, the turn ends with the error output. The request log of
the planning assistant (`describeModelRequest` through the `observeRequest` transport,
`hi-planning-usage.ts:110`) shows the tool message's content at 1.2–2.0 million tokens against the
1,048,576-token context of `mistral-large-4-0`.

**Reproduce at unit level.** `loadChatModel({ provider: 'mistral', model, apiKey })` returns the raw
provider model (`hi-planning-assistant.ts:237-242`). Feed it a prompt with a `tool`-role message
whose `output` is `{ type: 'content', value: [{ type: 'file', mediaType: 'image/jpeg', data: { type:
'data', data: <base64> } }] }`: `@ai-sdk/mistral@4.0.54` sends the tool message as
`content: JSON.stringify(output.value)` — the base64 as JSON text. The same `file` part in a
`user`-role message becomes an `image_url` part with a data URL.

## 2. Investigation trace

1. `get-plan-images` returns its two renders as `image` content parts (roomle-ui
   `packages/web-sdk/packages/homag-intelligence/src/hi-mcp/hi-mcp-server.ts:1180-1185`), about
   0.2 MB of base64 each for a kitchen.
2. `mcpToModelOutput` (`packages/embedding-lib/src/homag-intelligence/hi-mcp-tools.ts:49-63`) hands
   every non-text part of a tool result to the AI SDK as a `file` part in the tool result's
   `output.value` — the shape `@ai-sdk/mcp` uses.
3. `streamText` puts the tool result into a `tool`-role message of the next request's prompt, and
   the planning assistant keeps it in the conversation (`hi-planning-assistant.ts`,
   `messages.push(userMessage, ...continuedSteps, ...await result.responseMessages)`).
4. `loadChatModel` wraps only the `openai-compatible` model with `withToolImagesAsUserMessage`
   (`hi-planning-assistant.ts:234`); the `mistral` case returns the raw model (`:237-242`). The
   comment at `:111-112` states the reason for the wrapper: "Chat Completions takes text only in a
   tool message: the images of the tool results go into a user message right after it."
5. `@ai-sdk/mistral@4.0.54` (loaded from esm.sh at `hi-planning-assistant.ts:239`) converts a
   `tool` message with `output.type === 'content'` to `content: JSON.stringify(output.value)` —
   the Mistral Chat Completions API has no image field in a tool message, so the provider
   serializes the whole value array, `file` parts included, as JSON text. The renders land in the
   prompt as base64 JSON text, 1.2–2.0 million tokens for two of them.
6. In a `user` message the same provider converts a `file` part with an image media type to
   `{ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,…' } }` — a real image that the
   model reads as an image and that the API counts as image tokens, not text tokens.
7. The oversized request is rejected by the API (context length exceeded); `streamText` emits an
   `error` part; `isRejectedContinuation` (`hi-planning-assistant.ts:88-91`) does not match this
   error, so there is no continuation retry; the catch block outputs
   `{ type: 'error', text: 'The planning assistant failed: …' }` and the turn ends.

## 3. Root cause

roomle-ui `packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts:237-242`: the
`mistral` case of `loadChatModel` returns the provider model without `withToolImagesAsUserMessage`,
although the Mistral Chat Completions API has the same text-only limit for tool messages as the
OpenAI-compatible endpoints the wrapper was written for.

Why the current code produces the error: with the raw model, the `file` parts of a `get-plan-images`
result stay in the `tool` message; `@ai-sdk/mistral` has no way to send them but as JSON text; two
renders as base64 JSON exceed the 1,048,576-token context of `mistral-large-4-0`; the request fails
and the turn ends with an error instead of the model's answer.

## 4. Proposed fix

In the `mistral` case of `loadChatModel` (`hi-planning-assistant.ts:237-242`), wrap the model like
the `openai-compatible` case does:

```ts
return {
  languageModel: withToolImagesAsUserMessage(
    createMistral({ apiKey, ...transport })(model),
  ),
};
```

The wrapper (`toolImagesAsUserMessage`, `:113-152`, applied per request in `doGenerate`/`doStream`,
`:157-175`) moves every `file` part out of each `tool` message into a `user` message right after it
and leaves the text note "The images of this result follow in the next message." in the tool
message. The Mistral provider converts the user message's `file` parts to `image_url` parts, so the
model gets real images and the prompt stays within its context. Because the wrapper sits on the
model, it also applies to the conversation history that every step resends — no one-time transform
of the stored messages.

**Tests.** In `tests/unit/embedding-lib/homag-intelligence/hi-planning-assistant.spec.ts`, update
the Mistral assertion at `:129-132` to expect the wrapped model (the mocked `createMistral` returns
`{ mistral: model }`, so the expectation becomes the wrapper around it, e.g. checking
`doGenerate` rewrites the prompt). Add a request-shape test in the pattern of
`hi-planning-openai-compatible.spec.ts` ("moves the images of a tool result into a user message
after the tool message"): a mocked `createMistral` whose model records the prompt of `doGenerate`;
assert the tool message carries only text plus the note, that no base64 is in it, and that a
`user` message with the image follows.

**Validation.** Re-run the 11 failing runs of `mcp-test-2026-10-21_16-59-20` with
`mistral:mistral-large-4` (large-4 04, 05, 10, 15, 19, 32, 34, 41, 47, 48, 52): no turn may end on
the context error after `get-plan-images`, and the request log must show `image_url` parts in a
user message instead of base64 JSON in the tool message. Then update `docs/ai-chat.md` § "Images in
tool results": with the fix, Mistral sends the renders as images too, and the advice to pick a GPT,
Claude or Gemini model for plannings that look at the plan goes away.

**Alternatives considered and rejected**

- Downscale or drop the renders for Mistral: changes what the model sees and hides the cause; the
  window already scales the images, and a model that cannot see the plan cannot check its work.
- Change `@ai-sdk/mistral` to send tool-message images: the Mistral API has no image field in a tool
  message, and the package is loaded from the CDN, not a dependency — not possible from here.
- A guard in `get-plan-images` refusing renders for Mistral models: a guard is a last resort and
  refuses what the user legitimately asked for.
- Leave the tool result as text and let the model read positions only: the model calls
  `get-plan-images` precisely to look at the plan; the defect is the transport, not the tool.
