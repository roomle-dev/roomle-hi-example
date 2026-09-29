# AI Chat in the Example — Reference

The example page has a built-in AI chat that plans with the HI tools: the model
reads the plan context and creates, modifies, or positions object groups by
calling the same MCP tools an external MCP client would call. It turns the
example into a self-contained demo — no Claude Code or Copilot needed.

The chat uses the [Vercel AI SDK](https://sdk.vercel.ai) with **Mistral**,
**Anthropic (Claude)**, and **Azure OpenAI** as supported providers, and reuses
the MCP server from
[`hi-mcp/hi-mcp-poc-json`](../../hi-mcp/hi-mcp-poc-json/) unchanged.

## Running it

```bash
npm start mistral <api-key>           # mistral-large-latest (default)
npm start mistral-medium <api-key>   # mistral-medium-latest
npm start claude <api-key>           # claude-sonnet-4-5
npm start azure <api-key>            # gpt-4o deployment (see below)
npm start gpt-5-mini <api-key>       # gpt-5-mini on the HI Azure AI Foundry resource
npm start gpt-5.4-mini <api-key>     # gpt-5.4-mini on the HI Azure AI Foundry resource
npm run dev <provider> <api-key>     # same, planner from the local Rubens UI dev server (:5173)
```

The provider name selects the provider and model:

| CLI provider | Provider | Model |
| ------------ | -------- | ----- |
| `mistral` | Mistral | `mistral-large-latest` (default) |
| `mistral-medium` | Mistral | `mistral-medium-latest` |
| `mistral-large` | Mistral | `mistral-large-latest` |
| any `mistral-*` model id | Mistral | passed through (e.g. `mistral-small-latest`) |
| `claude` / `anthropic` | Anthropic | `claude-sonnet-4-5` |
| `claude-sonnet` | Anthropic | `claude-sonnet-4-5` |
| `claude-opus` | Anthropic | `claude-opus-4-1` |
| any `claude-*` model id | Anthropic | passed through |
| `azure` / `openai` | Azure OpenAI | `gpt-4o` (deployment name — see below) |
| `gpt-5-mini` / `gpt-5.4-mini` | Azure OpenAI (HI Azure AI Foundry resource) | the deployment of the same name |

Node 20+ (the repository's minimum). The Vercel AI SDK packages declare
`engines: node >= 22`; the chat is verified on Node 20, but stay on Node 22+
to remain inside the SDK's declared support range.

Azure needs two extra pieces: the resource name via the `AZURE_RESOURCE_NAME`
environment variable, and the **deployment name** (not the model name) via
`HI_CHAT_MODEL` — Azure deployments are user-named:

```bash
AZURE_RESOURCE_NAME=my-resource HI_CHAT_MODEL=my-gpt4o-deployment npm start azure <api-key>
```

`gpt-5-mini` and `gpt-5.4-mini` need neither: they are deployments on the HI
Azure AI Foundry resource and are called through its OpenAI v1 endpoint
`https://dfhifoundrysweden.services.ai.azure.com/openai/v1` with the resource's
API key. `AZURE_RESOURCE_NAME` and `HI_CHAT_MODEL` are ignored for them, so values
left in the shell from an `azure` run cannot redirect them.

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

Supported arguments: the provider name, then the API key. Both are plain
positional arguments — no `--` needed. Start without them and everything
behaves exactly as before (no chat backend, no chat window).

The provider aliases map to providers and model ids in
`hi-mcp/hi-mcp-chat/chat-config.ts` (`PROVIDER_MODEL_ALIASES`).

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
backend is stateless). Assistant replies are rendered as **markdown** (bold,
lists, headings, code) with [marked](https://marked.js.org) and sanitized with
[DOMPurify](https://github.com/cure53/DOMPurify), both loaded from unpkg —
like the embedding lib, the page has no build step. Replies stream as plain
text; while the model executes
tools, the chat backend emits `[tool] <name>` status lines into the stream —
the page shows the running tool in the status line ("assistant is working…
get-plan-context") and keeps those lines out of the reply. Tools run in the
MCP server, their planner calls in the page, and can take seconds to minutes
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
  ├── Mistral / Anthropic / Azure via the @ai-sdk provider packages (key from HI_CHAT_TOKEN)
  ├── MCP client via @ai-sdk/mcp → http://localhost:3100/mcp
  └── streamText(tools) → plain text stream
            │ Streamable HTTP /mcp
            ▼
[hi-mcp/hi-mcp-poc-json] → page bridge → roomDesignerApi.extended
```

The chain keeps the MCP server untouched: the chat backend is just another MCP
client, so every HI tool (`get-plan-context`, `create-or-replace-groups`,
`get-plan-images`, …) works in the chat exactly as it does for Claude or
Copilot. Moving a group is a `create-or-replace-groups` resubmit with its id
and a new `repositioningData` — there is no separate placement tool.

### The chat backend package

| File | Role |
| ---- | ---- |
| `chat-config.ts` | Environment parsing and request body validation |
| `chat-handler.ts` | HTTP handler factory: CORS, `/health`, `POST /chat`, error relay |
| `chat-server.ts` | Entry point: provider model (Mistral/Anthropic/Azure) + `@ai-sdk/mcp` + `streamText`, listen on the chat port |
| `tests/chat-handler.test.ts` | Unit tests (config, validation, CORS, error relay, streaming) |

Endpoints: `GET /health` (used for smoke tests) and `POST /chat`
(`{ "messages": [{ "role": "user", "content": "..." }] }` → plain text
stream). Errors are relayed as plain text with a matching status code: `503`
without a configured token, `400` for invalid bodies, `403` for disallowed
origins, `500` when the MCP server or Mistral call fails.

### Environment variables

| Variable | Default | Meaning |
| -------- | ------- | ------- |
| `HI_CHAT_TOKEN` | — | The provider API key (set by the launcher from the CLI argument) |
| `HI_CHAT_PROVIDER` | `mistral` | The CLI provider name (`mistral`, `mistral-medium`, `claude`, `azure`, `gpt-5-mini`, `gpt-5.4-mini`, or a full `mistral-*`/`claude-*` model id) |
| `HI_CHAT_PORT` | `3200` | Port of the chat backend (the page reads it via the `chat_port` query parameter) |
| `HI_CHAT_MODEL` | from the provider name | Overrides the model id (mainly Azure deployment names) without changing the provider; ignored for `gpt-5-mini`/`gpt-5.4-mini` |
| `AZURE_RESOURCE_NAME` | — | Required for `azure`/`openai`: the Azure OpenAI resource name (ignored for `gpt-5-mini`/`gpt-5.4-mini`) |
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
| `No API token configured` (503) | Chat backend started without a key — start with `npm start <provider> <api-key>` |
| `AZURE_RESOURCE_NAME is required` | The `azure` provider needs the resource name env var and the deployment name in `HI_CHAT_MODEL` |
| Reply says the tool failed with "no page connected" | The example page is not open (or not with `?mcp=true`) — the browser bridge is required for tool calls |
| `port 3200 is already in use` | A previous chat backend is still running — `lsof -ti tcp:3200 \| xargs kill`, or pick another port with `HI_CHAT_PORT` |
| Provider error in the reply | The provider API rejected the key or the model — check the key, or set `HI_CHAT_MODEL` |

## Open follow-ups

- AI SDK data stream protocol for per-tool status in the chat UI
- Conversation memory on the backend
