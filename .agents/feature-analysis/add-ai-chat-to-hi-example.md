# Add AI Chat to the HI MCP Example

> **Type**: Feature Analysis
> **Domain**: HI MCP Server, AI Integration, Example Page UI
> **Trigger**: Jira ticket [RML-17984](https://roomle.atlassian.net/browse/RML-17984) "add chat in hi mcp example" with the Vercel AI SDK comment ([155492](https://roomle.atlassian.net/browse/RML-17984?focusedCommentId=155492), preserved in [`../skills/vercel-ai-sdk-chat.md`](../skills/vercel-ai-sdk-chat.md))
> **Date**: 2026-09-29
> **Author**: AI Assistant
> **Status**: Implemented

---

## Close-out (2026-09-29)

Implemented per the plan posted on the ticket, for local use with all three providers of the ticket comment: Mistral, Anthropic, and Azure OpenAI. Working tree: branch `feat/rml-17984-ai-chat-mistral`.

- **Chat backend**: new workspace package `hi-mcp/hi-mcp-chat` (`chat-config.ts`, `chat-handler.ts`, `chat-server.ts`) with `POST /chat` — a plain text stream built from a custom ReadableStream over the `streamText` result (including `[tool]` status lines and `[error]` relaying) — plus `GET /health`, CORS for the example page origins, and loopback binding. The `hi-mcp-server` server is untouched; the chat is just another MCP client of it.
- **Invocation**: `npm start <provider> <api-key>` / `npm run dev <provider> <api-key>` (verified: npm forwards the args through both workspace script layers without `--`). `start.mjs` parses them, spawns the chat backend with `HI_CHAT_TOKEN` and `HI_CHAT_PROVIDER`, and appends `&chat=true` to the opened URL. Token never lands in URL, page, or logs.
- **Providers**: Mistral (`mistral`, `mistral-medium`, `mistral-large`, any `mistral-*` id), Anthropic (`claude`/`anthropic`/`claude-*` ids), Azure OpenAI (`azure`/`openai` with `AZURE_RESOURCE_NAME` and the deployment name in `HI_CHAT_MODEL`).
- **Page**: chat UI in `.left-section`, chat visible at startup with `chat=true`, "Show panel" switches between chat (unchecked) and debug panel (checked) — open question 1 resolved that way; without `chat=true` the old behavior is unchanged. Replies render as sanitized markdown (marked + DOMPurify, loaded lazily only when the chat is enabled); the chat layout is applied before planner init so the scene centers correctly.
- **Tests**: `hi-mcp/hi-mcp-chat/tests/chat-handler.test.ts` (15 tests: config, provider resolution, body validation including malformed JSON and null bodies, CORS, 503/400/403/500 paths, streaming) — all pass; typecheck passes for all three workspace projects.
- **Docs**: new `minimal-hi-example/docs/ai-chat.md`, usage README at the repository root, and the local-wiring section in `.agents/skills/vercel-ai-sdk-chat.md`.

Not carried into this iteration (still open): AI SDK data stream protocol for richer per-tool status than the `[tool]` lines (open question 4), conversation memory (open question 5), deployment use, keyless Azure Entra ID auth. Open question 2 was settled by the plan: separate `chat=true` page param plus env-based key delivery instead of a token in the URL. Open question 3 (provider scope) was resolved beyond the plan: all three providers are implemented.

Side effect worth noting: installing the new package forced a workspace-wide zod alignment — `hi-mcp/hi-mcp-server` now pins zod 4.6.5 (was 4.5.4) because the Vercel AI SDK packages require 4.6+ and two zod copies broke the poc-json typecheck. The root `package-lock.json` was refreshed (it was stale and did not include the `cf` workspace yet). The `cf` test suite fails to load `@cloudflare/containers` in vitest, but this failure reproduces identically on the commit before this feature — pre-existing, not caused by the chat work.

---

## Executive Summary

RML-17984 asks for an AI chat window in the HI presets example, placed in the same spot as the debug panel in the left section, with the "Show panel" checkbox toggling between chat and debug panel. The chat is implemented with the Vercel AI SDK and activated via a URL parameter carrying the model provider and API token.

The analysis concludes that the chat needs a **new backend route** (the page cannot hold provider keys, and the example page is plain HTML without a build step) that acts as an **MCP client of the existing hi-mcp-server**. The page only gains the chat UI and a streaming fetch consumer; the existing MCP bridge and tool executors stay untouched. Three design decisions need confirmation before implementation: the toggle semantics, the backend package location, and the client streaming protocol.

This is the first concrete implementation step of the broader vision analyzed in [`sales-configurator-ai-integration.md`](sales-configurator-ai-integration.md) and stated as the repository purpose: a chat window where planning can be executed through natural language.

---

## 1. What Was Asked and Why

From the ticket description:

1. **Chat window in the left section** of `minimal-hi-example/index.html`, at the same place as the debug UI that appears with the "Show panel" checkbox. Toggling the checkbox switches the view between the AI chat window and the debug panel.
2. **Vercel AI SDK** as the integration technology. The ticket comment (see [`../skills/vercel-ai-sdk-chat.md`](../skills/vercel-ai-sdk-chat.md)) prescribes a three-tier architecture: browser chat UI, backend API route (Vercel AI SDK, `streamText`, `@ai-sdk/mcp`), and the MCP server. Provider authentication must stay server side; supported providers are Azure OpenAI, Anthropic, and Mistral.
3. **Activation via URL parameter** containing the model provider and API token.

Why: the HI MCP server today requires an external MCP client (Claude Code, Copilot) to drive the planner. A built-in chat makes the example self-contained and is the reference shape for the future npm package that sales configurators can embed.

## 2. How the Area Works Today

- **Left section / debug panel**: `.left-section` (index.html:74, style `display: none` by default) contains `#tc-area` with the parameter UI, action buttons, and `#console-log` (index.html:173-190). The `#toggle-panel` checkbox (index.html:164-165) switches it between `flex` and `none` (index.html:780-786). Unchecked means the whole left section is hidden.
- **Page setup**: single HTML file, no build step, ES module scripts, inline JS. The planner is embedded with `RoomleConfiguratorApi` from the embedding lib; `DEFAULT_SERVER_URL` (index.html:234) is the bo-test tenant the example loads — the chat feature does not touch the planner embed configuration.
- **MCP activation**: the page only connects to the MCP server when `?mcp=true`. `startMcpBrowserBridge` (index.html:2141-2196) opens `ws://localhost:{mcp_port}/bridge` (default 3100), receives tool calls, and executes them via `mcpToolExecutors` (index.html:1661) against `roomDesignerApi.extended`.
- **MCP server**: `hi-mcp/hi-mcp-server/server.ts` (vite-node, TypeScript, `@modelcontextprotocol/sdk`) serves `POST /mcp` (Streamable HTTP) and the `/bridge` WebSocket. It is shared with the ligna-store client and the cloud deployments, and documented as "unchanged, shared".
- **Launcher**: `minimal-hi-example/start.mjs` serves the page on :3000 and spawns the MCP server on :3100, opening the browser at `http://localhost:3000/?mcp=true`.

## 3. Gap Analysis

| Requirement | Current state | Gap |
|---|---|---|
| Chat UI in left section | Left section holds only the debug panel | New chat container + toggle between the two views |
| LLM orchestration | None; an external MCP client (Claude/Copilot) is required | Backend route with `streamText` + provider packages |
| Server-side provider auth | None | New route holding provider + token, never rendered into the page |
| MCP client in the chat backend | Only the browser bridge acts as client-side executor | Chat backend must connect to `http://localhost:3100/mcp` via `@ai-sdk/mcp` |
| Activation via URL parameter | Page knows `mcp`, `mcp_port`, and option params (index.html:269-289) | New param(s) for provider and API token |

## 4. Proposed Design

### 4.1 Architecture

```
[Browser: index.html]
  ├── Chat UI in .left-section (new)
  │     └── POST http://localhost:3200/chat { messages, provider, token }
  └── Existing MCP browser bridge (unchanged, needs ?mcp=true)
            │ ws://localhost:3100/bridge
            ▼
[Chat backend: NEW hi-mcp/hi-mcp-chat]  (Vercel AI SDK, server side)
  ├── Builds model from provider + token (azure | anthropic | mistral)
  ├── MCP client via @ai-sdk/mcp → http://localhost:3100/mcp
  └── streamText({ model, messages, tools }) → streamed response
            │ Streamable HTTP /mcp (tools/call relayed over /bridge)
            ▼
[hi-mcp/hi-mcp-server] → page → roomDesignerApi.extended
```

The chain is deliberate: the LLM's tool calls go through the existing MCP server and browser bridge, so all existing HI tools (`get-plan-context`, `create-or-replace-groups`, ...) work in the chat without any change to the server or the executors.

### 4.2 Chat UI and toggle

- Add a chat container (message list + text input) in `.left-section` next to `#tc-area`.
- Toggle semantics (see open question 1): recommended reading of the ticket is that the checkbox selects the view — **unchecked shows the chat (new default), checked shows the debug panel**. This keeps today's debug behavior on "checked" intact and makes the chat the primary interface of the example.
- Both views live in the left section; the checkbox switches visibility between them instead of hiding the section entirely.

### 4.3 Activation via URL parameter

- The ticket requires a URL parameter with provider and API token, e.g. `?chat=true&chat_provider=mistral&chat_token=<API_KEY>`.
- The page reads the params on load and only activates the chat when present; it forwards provider and token in the body of each `/chat` request. The token is never written into the page or logged by the backend.
- Security note: a URL parameter puts the token into the browser history and server access logs. Acceptable for a local dev example; the analysis flags that production variants must move to server-side env config (the ticket comment's default) or keyless Azure Entra ID auth.

### 4.4 Chat backend

- New npm workspace package `hi-mcp/hi-mcp-chat` (TypeScript, vite-node, spawned by `start.mjs` like the MCP server) exposing `POST /chat`.
- Route logic per the ticket comment: create MCP client against `http://localhost:3100/mcp`, `await mcpClient.tools()`, select the model from the provider param with the token supplied per request, `streamText`, stream back.
- `start.mjs` gains the spawn (port 3200) and appends the chat params to the opened URL when configured via environment variables.

### 4.5 Client streaming

- The example page has no React, so `useChat` (`@ai-sdk/react`) is not available. The chat client in `index.html` is a plain `fetch` consumer of the streamed response.
- Recommended: a minimal SSE/text stream from the backend (e.g. `result.toTextStreamResponse()`) that the page reads via the response body reader and appends to the message list. Tool-call progress can be surfaced as simple status lines ("calling get-plan-context...").

## 5. Alternatives Considered and Rejected

| Alternative | Why rejected |
|---|---|
| Chat entirely in the page (direct LLM calls from the browser) | Provider API keys would be exposed to the browser; the ticket comment explicitly requires server-side authentication |
| Add the `/chat` route to `hi-mcp/hi-mcp-server/server.ts` | That server is shared with the ligna-store client and cloud deployments and documented as unchanged; a chat route with its own deps would leak example-only concerns into it |
| Implement the route in `start.mjs` directly | start.mjs is a plain-Node launcher without TypeScript/transpilation and with a no-new-dependencies rule; the Vercel AI SDK needs TS + npm deps, which belong in the workspace |
| Use an external MCP client (status quo) | Defeats the purpose: the example should be self-contained and usable without Claude Code/Copilot |

## 6. Code and Documents the Work Would Touch

| File | Change |
|---|---|
| `minimal-hi-example/index.html` | Chat UI in `.left-section`, toggle logic (index.html:780-786), URL param handling, chat client |
| `minimal-hi-example/start.mjs` | Spawn chat backend, pass MCP URL, append chat params to opened URL |
| `hi-mcp/hi-mcp-chat/` (new workspace package) | `POST /chat` route: provider selection, `@ai-sdk/mcp` client, `streamText` |
| `hi-mcp/package.json` | Workspace script/typecheck/test coverage for the new package |
| `hi-mcp/hi-mcp-chat/tests/` | Unit tests: provider/model selection, request handling, error relaying |
| `minimal-hi-example/docs/` (new chat doc or extension of hi-mcp-server.md) | Living reference for the chat feature |
| `.agents/skills/vercel-ai-sdk-chat.md` | Created with this analysis (ticket comment preserved) |
| `AGENTS.md`, `.agents/README.md` | Index/catalog entries |

## 7. Open Questions

1. **Toggle semantics** — Does "unchecked" show the chat (recommended, chat becomes the default view) or hide the left section entirely, with chat and debug alternating on repeated checks? Needs confirmation against the ticket author's intent.
2. **URL parameter format** — One combined parameter (`chat=mistral:<token>`) or separate provider/token params? Combined matches the ticket wording ("a URL parameter"), separate is easier to read.
3. **Provider scope** — Azure (needs resource/deployment name in addition to the token), Anthropic, and Mistral per the comment; are all three required for the first iteration or is one (e.g. Mistral) enough for the PoC?
4. **Client streaming protocol** — Full AI SDK data stream protocol (needs a parsing client) vs. plain text stream (recommended for the vanilla-JS page). If the full protocol is desired, the page needs a small parser or the chat gets a tiny bundled client.
5. **Conversation memory** — The proposed route is stateless (messages sent from the page on every turn). Sufficient for the PoC; memory/context management is covered by the sales-configurator analysis.
