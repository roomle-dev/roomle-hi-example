# ADR 0009 — The chat window is a panel of the planner, the agent loop stays in the host

> **Status**: Accepted
> **Date**: 2026-10-15
> **Ticket**: [RML-18190](https://roomle.atlassian.net/browse/RML-18190); [ADR 0003](0003-the-ai-chat-is-an-mcp-client-beside-the-server.md) for the agent loop, D80 of [hi-mcp-behaviour.md](../../docs/hi-mcp-behaviour.md#3-decisions) for the prompts

## Context

A chat that plans with the HI tools has two halves: the window the user types into and reads, and
the agent loop — the model provider, its key and the AI SDK loop with the MCP tools. ADR 0003 keeps
the agent loop in the host: the example's chat backend, the ligna-store page. The window is the
same for every host, and the planner already shows the AI Image Assistant as a panel of its drawer.

## Decision

- The chat window is the **AI Planning Assistant**, a panel of the planner's drawer (roomle-ui
  `PlanningAssistantChat.vue`), opened by a button of the bottom bar that the planner shows with
  `featureFlags.planningAssistant`. Its strings are planner translations.
- The prompt leaves the planner through one UI callback, `onPlanningAssistantPrompt({ text,
  images })`. The window prepares the images once for every host: JPEG data URLs, the long side at
  most 1568 px.
- The output comes back through one planner method with a typed part,
  `planningAssistantOutput(part)`: `text` appends to the answer of the running turn, `activity`
  sets the status line, `error` replaces the answer and ends the turn, `done` ends it,
  `availability` turns the input on or off with its reason, `images` turns the drop target on or
  off. A new kind of output is a new part type, not a new method.
- The window renders the markdown of the answer and sanitizes it in the planner.
- The host keeps the conversation, the agent loop and the prompts of the planner (D80); it adds the
  planner's `imagePrompt` to an image without text. The window's input starts off and opens when
  the host reports availability; a host starts no chat on a planner without
  `planningAssistantOutput`.

## Consequences

- The example page and the ligna-store host the same window; their chat code is the host side only.
- The conversation lives in the host, the entries in the window: a remount of the planner empties
  the window, and the host's conversation restarts with it.
- The image size is the planner's; a host that needs another size needs a change of the window.

## Rejected

- The window in the embedding-lib or in a host-side package: it has no drawer, no planner look, no
  translations and no feature flag.
- The agent loop in the planner too, the window calling the chat backend or the MCP server: the
  provider key, the model choice and the backend URL would become the planner's, and the planner
  would need the page's bridge client id (ADR 0003).
- The HI channel of the embedding-lib (`HiCallbacks`, `setupHi`): it serves the library side —
  master data, price, orders — and is set up before the planner exists.
- The output as HTML the host renders and the planner shows: the planner would trust
  host-rendered model output inside its own origin.
- The whole answer at the end instead of a stream: a turn takes seconds to minutes, and the
  streamed text and the status line show the user that the agent works.
- One planner method per kind of output: several methods for one stream, and a new method for every
  new kind.
- The answer as the return value of the prompt callback: no streaming, one promise open for
  minutes, and a callback pattern with a single handler.
