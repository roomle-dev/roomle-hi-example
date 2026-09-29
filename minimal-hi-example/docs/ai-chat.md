# AI Chat in the Example — Reference

The example page has a built-in AI chat that plans with the HI tools: the model
reads the plan context and creates, modifies, or positions object groups by
calling the same MCP tools an external MCP client would call. It turns the
example into a self-contained demo — no Claude Code or Copilot needed.

The chat uses the [Vercel AI SDK](https://sdk.vercel.ai) with **Mistral** as
the only supported provider for now, and reuses the MCP server from
[`hi-mcp/hi-mcp-poc-json`](../../hi-mcp/hi-mcp-poc-json/) unchanged.

## Running it

```bash
npm start mistral <api-key>          # mistral-large-latest (planner from bo-test)
npm start mistral-medium <api-key>   # mistral-medium-3-5
npm start mistral-large <api-key>    # mistral-large-latest
npm run dev <provider> <api-key>     # same, planner from the local Rubens UI dev server (:5173)
```

The provider name selects the model:

| CLI provider | Mistral model |
| ------------ | ------------- |
| `mistral` | `mistral-large-latest` (default) |
| `mistral-large` | `mistral-large-latest` |
| `mistral-medium` | `mistral-medium-latest` |
| any `mistral-*` model id | passed through to Mistral (e.g. `mistral-medium-3-5`, `mistral-small-latest`) |

The `mistral-medium` alias follows Mistral's `-latest` pointer, so it moves
when Mistral ships a newer medium generation. Pin a full id (e.g.
`npm start mistral-medium-3-5 <api-key>`) when you need a specific generation.

The launcher then:

1. Runs the build gate (install + typecheck of the `hi-mcp` workspace, which
   now includes the `hi-mcp-chat` package).
2. Serves the example page on :3000 and starts the MCP server on :3100 as
   usual.
3. Starts the chat backend (`hi-mcp/hi-mcp-chat`) on :3200 with the API key
   passed as the `HI_CHAT_TOKEN` environment variable — never in the URL, never
   in the page.
4. Opens the browser with `&chat=true` appended, so the page starts with the
   chat window visible.

Supported arguments: the provider must be `mistral`, the API key follows it.
Both are plain positional arguments — no `--` needed. Start without them and
everything behaves exactly as before (no chat backend, no chat window).

The provider aliases above map to model ids in `hi-mcp/hi-mcp-chat/chat-config.ts` (`MODEL_ALIASES`); `HI_CHAT_MODEL` also accepts any full Mistral model id (e.g. `mistral-small-latest`).

## The chat window

With `?chat=true` the left section opens with the chat. The **Show panel**
checkbox switches the view:

| Checkbox | Left section shows |
| -------- | ------------------ |
| unchecked | AI chat |
| checked | Debug panel (parameters, buttons, console log) |

Without `chat=true` the checkbox keeps its old meaning: checked shows the
debug panel, unchecked hides the left section.

The conversation is held in the page and sent whole with every turn (the
backend is stateless). Replies stream as plain text; while the model executes
tools, the chat backend emits `[tool] <name>` status lines into the stream —
the page shows the running tool in the status line ("assistant is working…
get-plan-context") and keeps those lines out of the reply. Tool calls relay
through the MCP server to the page and can take seconds to minutes
(`get-plan-images` up to 120s) — the status line is what tells you the agent
is still working. The backend logs every request, MCP connection, tool call
(with duration), stream error, and finish to its terminal.

## Architecture

```
[Browser: index.html]
  ├── Chat UI (POST /chat with the message history)
  └── MCP browser bridge (unchanged, ?mcp=true)
            │ ws://localhost:3100/bridge
            ▼
[Chat backend: hi-mcp/hi-mcp-chat on :3200]
  ├── Mistral via @ai-sdk/mistral (key from HI_CHAT_TOKEN)
  ├── MCP client via @ai-sdk/mcp → http://localhost:3100/mcp
  └── streamText(tools) → plain text stream
            │ Streamable HTTP /mcp
            ▼
[hi-mcp/hi-mcp-poc-json] → page bridge → roomDesignerApi.extended
```

The chain keeps the MCP server untouched: the chat backend is just another MCP
client, so every HI tool (`get-plan-context`, `create-or-replace-groups`,
`place-group`, …) works in the chat exactly as it does for Claude or Copilot.

### The chat backend package

| File | Role |
| ---- | ---- |
| `chat-config.ts` | Environment parsing and request body validation |
| `chat-handler.ts` | HTTP handler factory: CORS, `/health`, `POST /chat`, error relay |
| `chat-server.ts` | Entry point: Mistral + `@ai-sdk/mcp` + `streamText`, listen on the chat port |
| `tests/chat-handler.test.ts` | Unit tests (config, validation, CORS, error relay, streaming) |

Endpoints: `GET /health` (used for smoke tests) and `POST /chat`
(`{ "messages": [{ "role": "user", "content": "..." }] }` → plain text
stream). Errors are relayed as plain text with a matching status code: `503`
without a configured token, `400` for invalid bodies, `403` for disallowed
origins, `500` when the MCP server or Mistral call fails.

### Environment variables

| Variable | Default | Meaning |
| -------- | ------- | ------- |
| `HI_CHAT_TOKEN` | — | The Mistral API key (set by the launcher from the CLI argument) |
| `HI_CHAT_PORT` | `3200` | Port of the chat backend (the page reads it via the `chat_port` query parameter) |
| `HI_CHAT_MODEL` | `mistral-large-latest` | The Mistral model id or a provider alias (`mistral`, `mistral-large`, `mistral-medium`) |
| `HI_MCP_URL` | `http://localhost:3100/mcp` | The MCP server the chat backend connects to |
| `HI_CHAT_PAGE_ORIGINS` | `http://localhost:3000`, `http://127.0.0.1:3000` | Allowed CORS origins (the launcher sets it to match `EXAMPLE_PORT`) |

## Security notes

- The API key travels: CLI argument → environment variable of the chat
  backend. It is never written into the page, the URL, or the launcher log.
- A CLI argument is visible in `ps` for the lifetime of the process — accepted
  for a local dev example. `HI_CHAT_TOKEN` works as an alternative without
  that exposure.
- CORS is restricted to the example page origins; requests without an origin
  (curl) are allowed for local debugging.

## Troubleshooting

| Symptom | Cause and fix |
| ------- | ------------- |
| `No API token configured` (503) | Chat backend started without a key — start with `npm start mistral <api-key>` |
| Reply says the tool failed with "no page connected" | The example page is not open (or not with `?mcp=true`) — the browser bridge is required for tool calls |
| `port 3200 is already in use` | A previous chat backend is still running — `lsof -ti tcp:3200 \| xargs kill`, or pick another port with `HI_CHAT_PORT` |
| Provider error in the reply | The Mistral API rejected the key or the model — check the key, or set `HI_CHAT_MODEL` |

## Open follow-ups

- Azure and Anthropic providers (the analysis in
  [`.agents/feature-analysis/add-ai-chat-to-hi-example.md`](../../.agents/feature-analysis/add-ai-chat-to-hi-example.md)
  keeps the full list of open questions)
- AI SDK data stream protocol for per-tool status in the chat UI
- Conversation memory on the backend
