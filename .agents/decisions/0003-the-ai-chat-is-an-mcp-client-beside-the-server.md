# ADR 0003 — The AI chat is an MCP client beside the MCP server

> **Status**: Accepted
> **Date**: 2026-09-30
> **Analysis**: [RML-17984](https://roomle.atlassian.net/browse/RML-17984) (the chat in the example); the ligna-store chat window: [PR #37](https://github.com/roomle-dev/roomle-hi-example/pull/37) and ligna-store `6043ce3`

## Context

A chat that plans with the HI tools needs three things the MCP server does not have: a model
provider, its API key and the Vercel AI SDK loop (`streamText` with the MCP tools). Two hosts get a
chat. The example page is plain HTML without a build step, started by a local launcher. The
ligna-store is a static Nuxt site without a backend; its MCP server runs in a Cloudflare container
per session and is shared by every client.

## Decision

- The MCP server serves no chat. Every chat is an MCP client of `/mcp`, like Claude Code or Copilot,
  so the tools and the served text are the same for every client.
- The example: the chat backend `hi-mcp/hi-mcp-chat`, a workspace package and a process of its own
  on loopback (`127.0.0.1:3200`), started by the launcher with `npm start <provider> <api-key>`. The
  key goes from the CLI argument into the backend's environment (`HI_CHAT_TOKEN`), never into the
  page or a URL. The backend connects to `/mcp?client=<clientId>` of the page that sent the prompt.
- The ligna-store: the AI SDK runs in the store page (ligna-store `hi-mcp/chat.ts`). It calls
  Mistral and the HI Azure AI Foundry endpoint directly (both allow browser CORS) with the key of the
  store URL (`api_key`), and takes the tools from `<mcp_server>/mcp`. The server answers the store
  origin for `/mcp` (`HI_MCP_PAGE_ORIGINS`, the list that guards `/bridge`).

## Consequences

- The MCP server and its Cloudflare image carry no AI SDK and never see a provider key; the key is in
  no Worker or container log.
- There are two chat implementations, the example's backend and the store's page module. A change to
  the step policy, the system prompt or the Mistral image middleware is made in both.
- The store's key is visible in the browser history, in the access logs of the store host and in the
  page. The store keeps it out of the page URL its bridge announces. This is acceptable for a demo
  only: before a production store, the key moves to a server-side secret (e.g. a Worker secret
  per model).
- The example's chat backend stays local; nothing outside the machine reaches it.

## Rejected

- **The chat in the example page with the provider key**: the example has a launcher that can hold
  the key outside the browser, so it does.
- **`POST /chat` on the MCP server** (`hi-mcp-server/server.ts`), for the example and again for the
  store with per-request credentials (`Authorization: Bearer`, a model allow-list): it pulls the AI
  SDK and provider keys into the server every client shares, and the Cloudflare image with it.
- **The chat route in `start.mjs`**: the launcher is plain Node without TypeScript and without
  dependencies.
- **A second process in the Cloudflare container** with `/chat` on its own port: a two-process
  start, and locally a fifth store URL parameter.
- **The chat in the Cloudflare Worker**: a second chat implementation, and local and deployed runs
  would differ.
