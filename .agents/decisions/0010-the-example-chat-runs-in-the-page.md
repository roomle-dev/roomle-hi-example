# ADR 0010 — The example's chat runs in the page, with the planning assistant of the embedding-lib

> **Status**: Accepted — the clause that keeps the MCP server is superseded by [ADR 0011](0011-the-hi-tools-live-in-the-embedding-lib.md)
> **Date**: 2026-10-20
> **Ticket**: [RML-18196](https://roomle.atlassian.net/browse/RML-18196); supersedes the example's part of [ADR 0003](0003-the-ai-chat-is-an-mcp-client-beside-the-server.md) and the launcher part of [ADR 0002](0002-one-mcp-server-configured-from-outside.md)

## Context

The roomle-ui embedding-lib carries a copy of the HI MCP tools (`createHiMcpTools`, D94 of
[hi-mcp-behaviour.md](../../docs/hi-mcp-behaviour.md#3-decisions)) and a planning assistant that
runs the agent loop with them in the page (`startPlanningAssistant`), configured by one JSON object,
the `PlanningAssistantConfig`. With them, the example page no longer needs the MCP server, its page
bridge or the chat backend `hi-mcp-chat` to chat with the planner. The key stays a CLI argument of
the launcher, as in ADR 0003.

## Decision

- The example page runs `startPlanningAssistant` of the embedding-lib; the tools call the planner of
  the page directly. The page has no MCP bridge, and the launcher starts no MCP server and no chat
  backend. `hi-mcp-chat` is deleted.
- The launcher has no build gate: the example needs no install of the `hi-mcp` workspace.
- The launcher turns the model name and the key of its command line into the
  `PlanningAssistantConfig` and serves it at `/planning-assistant-config.json`, to requests from this
  machine only and with `Cache-Control: no-store`. The page fetches it when it is opened with
  `chat=true`.
- The prompt runner sends the prompts through the page (`onPlanningAssistantPrompt`) and reads the
  tool calls from the page console and the planner calls from the page.
- The ligna-store runs the same planning assistant in its planner page, with the model and the key
  of its URL (ligna-store `hi-mcp/chat-options.ts`); it has no MCP bridge either.
- The MCP server, the reference client `hi-mcp-client` and the Cloudflare deployment stay for
  external MCP clients.

## Consequences

- One chat implementation for the example: the embedding-lib's. A change to the agent loop, the step
  policy or the tools is made in roomle-ui and reaches the example with a new embedding-lib version.
- The key is in the page: it is read from the launcher and sent to the provider by the browser. It
  is in no URL, browser history or log; anyone with the page open on this machine can read it. The
  provider must allow browser calls (CORS).
- External MCP clients reach a planner only through a page that runs the page bridge; neither the
  example nor the ligna-store does.
- The planning assistant has no image middleware for Mistral, so a Mistral model fails on a turn
  that calls `get-plan-images` ([ai-chat.md](../../docs/ai-chat.md#images-in-tool-results)).
- The prompt runs log no step data (tokens, duration per step); the turn is what the window shows.

## Rejected

- **Keep the chat backend for the example**: a second agent loop beside the embedding-lib's, and
  the example would not show how a host uses the embedding-lib.
- **The key in the page URL** (as in the ligna-store): it ends up in the browser history and the
  printed URL; the launcher can hold it and hand it over on request instead.
- **Keep the example's MCP bridge beside the in-page chat**: the in-page tools make it redundant,
  and two clients would compete for the planner of one page.
