# AI Chat in the Example — Reference

The example page has a built-in AI chat that plans with the HI tools: the model
reads the plan context and creates, modifies, or positions object groups by
calling the same MCP tools an external MCP client would call. It turns the
example into a self-contained demo — no Claude Code or Copilot needed.

The chat uses the [Vercel AI SDK](https://sdk.vercel.ai) with **Mistral**,
**Anthropic (Claude)**, **Google (Gemini)**, and **Azure OpenAI** as supported providers, and reuses
the MCP server from
[`hi-mcp/hi-mcp-server`](../../hi-mcp/hi-mcp-server/) unchanged.

## Running it

```bash
npm start mistral <api-key>           # mistral-large-latest (default)
npm start mistral-medium <api-key>   # mistral-medium-latest
npm start claude <api-key>           # claude-sonnet-4-5
npm start gemini <api-key>           # gemini-2.5-pro (Gemini API key from Google AI Studio)
npm start azure <api-key>            # gpt-4o deployment (see below)
npm start gpt-5-mini <api-key>       # gpt-5-mini on the HI Azure AI Foundry resource
npm start gpt-5.4-mini <api-key>     # gpt-5.4-mini on the HI Azure AI Foundry resource
npm start gpt-6-astra <api-key>      # gpt-6-astra on the HI Azure AI Foundry resource
npm run dev <provider> <api-key>     # same, planner from the local Rubens UI dev server (:5173)
npm run start:cf <provider> <api-key> # same, MCP server deployed on Cloudflare instead of a local one
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
| `gemini` / `google` / `gemini-pro` | Google (Gemini API) | `gemini-2.5-pro` |
| `gemini-flash` | Google (Gemini API) | `gemini-2.5-flash` |
| any `gemini-*` model id | Google (Gemini API) | passed through (e.g. `gemini-3-pro-preview`) |
| `azure` / `openai` | Azure OpenAI | `gpt-4o` (deployment name — see below) |
| `gpt-5-mini` / `gpt-5.4-mini` / `gpt-6-astra` | Azure OpenAI (HI Azure AI Foundry resource) | the deployment of the same name |

Node 20+ (the repository's minimum). The Vercel AI SDK packages declare
`engines: node >= 22`; the chat is verified on Node 20, but stay on Node 22+
to remain inside the SDK's declared support range.

Azure needs two extra pieces: the resource name via the `AZURE_RESOURCE_NAME`
environment variable, and the **deployment name** (not the model name) via
`HI_CHAT_MODEL` — Azure deployments are user-named:

```bash
AZURE_RESOURCE_NAME=my-resource HI_CHAT_MODEL=my-gpt4o-deployment npm start azure <api-key>
```

`gpt-5-mini`, `gpt-5.4-mini` and `gpt-6-astra` need neither: they are deployments on the HI
Azure AI Foundry resource and are called through its OpenAI v1 endpoint
`https://dfhifoundrysweden.services.ai.azure.com/openai/v1` with the resource's
API key. `AZURE_RESOURCE_NAME` and `HI_CHAT_MODEL` are ignored for them, so values
left in the shell from an `azure` run cannot redirect them. Other `gpt-*` names are
not passed through: only these deployments exist on the resource, and an unknown
name fails at the launcher instead of as a provider error in the chat. The chat
sets no `temperature`: the GPT deployments are reasoning models and reject it.
Guarded by `it('resolves the Foundry deployments to the Foundry endpoint')` in
`hi-mcp/hi-mcp-chat/tests/chat-handler.test.ts`.

**Reasoning effort.** The chat sends the reasoning effort of `HI_CHAT_REASONING_EFFORT`
(`providerOptions.azure.reasoningEffort`) to the GPT deployments; unset, each deployment runs at
its default. Measured on the Foundry resource (2026-10-07): gpt-5.4-mini does not reason at its
default (0 reasoning tokens in every step), gpt-5-mini and gpt-6-astra reason as at `medium`. The
step log ([a chat turn](#a-chat-turn)) shows the reasoning tokens of every step. gpt-5-mini and
gpt-5.4-mini read images and have a 400k context window. The reasoning effort is set by the chat
client, not by the MCP server. An effort per deployment is open:
[backlog](../../.agents/backlog/reasoning-effort-for-the-gpt-chat-models.md).

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

With `?chat=true` the chat opens as an overlay on the left of the planner.
The button in its header collapses the overlay to the header (**−**) and
expands it again (**+**). The **Show panel** checkbox switches the view:

| Checkbox | Shows |
| -------- | ----- |
| unchecked | the chat overlay |
| checked | the debug panel (parameters, buttons, console log); the chat overlay is hidden |

Without `chat=true` there is no chat overlay: checked shows the debug panel,
unchecked hides it.

The conversation is held in the page and sent whole with every turn (the
backend is stateless). The page sends the same per-page `clientId` in its
WebSocket hello and each chat request. The input is disabled until the bridge
acknowledges this page, and on disconnect or when another page owns the planner.
The chat backend requires that ID and uses `/mcp?client=<clientId>`, so a tab
that does not own the planner cannot use the chat to change its plan. Assistant replies are rendered as **markdown** (bold,
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

### A chat turn

The backend gives the model the system prompt `CHAT_SYSTEM_PROMPT`
(`chat-config.ts`, its sentences in the
[behaviour reference](../../docs/hi-mcp-behaviour.md#4-how-a-tool-call-runs)),
the conversation and the MCP tools, and runs `streamText` in steps
(`chat-steps.ts`): a step is one model call and the tool calls it returns.

- A turn has at most 16 steps (`MAX_CHAT_STEPS`). The last one runs with
  `toolChoice: 'none'`, so a turn that uses every step still ends with the
  model's answer instead of a tool result. Without `stopWhen` the SDK stops
  after the first step and never runs the tools. Guarded by
  `it('ends a turn that uses every step with the model answer')` in
  `hi-mcp/hi-mcp-chat/tests/chat-steps.test.ts`.
- A turn that has not answered within `HI_CHAT_TURN_TIMEOUT_MS` is aborted
  and ends with an `[error]` line naming the limit; the plan keeps what the
  tools changed.
- Every step logs its tokens (in, out, reasoning), its tool calls and its
  duration (`[hi-chat] step n: …`); "out" counts the reasoning tokens too.
  Guarded by `it('logs the reasoning tokens of a step')` in
  `hi-mcp/hi-mcp-chat/tests/chat-steps.test.ts`.

## Images in the chat

The chat takes an image only when the model reads images. The chat backend
decides this from the model id it resolved (`readsImages` in
`hi-mcp/hi-mcp-chat/chat-config.ts`): every Anthropic and Google model, and
from the other providers the ids in `IMAGE_INPUT_MODELS`:
`mistral-large-latest`, `mistral-medium-latest`, `gpt-4o`, `gpt-5-mini`,
`gpt-5.4-mini` and `gpt-6-astra`. Any other id gets no image input. That includes a pass-through
`mistral-*` id and an Azure deployment named with `HI_CHAT_MODEL`: an unknown
model gets no image feature rather than a provider error halfway through a
turn. The table lives in the backend, which resolves the model — not in the
launcher, and not in a provider query (only Mistral reports vision). The startup
banner shows the result (`Images: yes` or `no`), and `GET /capabilities` gives
it to the page. Guarded by `it('knows which models read images')` in
`hi-mcp/hi-mcp-chat/tests/chat-handler.test.ts`.

In the page (only when `/capabilities` answers `imageInput: true`):

- **Drop**: the whole chat overlay catches a dropped file (header, messages
  and input), and a dashed outline marks it while a file is dragged over it.
  A drop on the collapsed overlay expands it. A file that is not an image, or
  that the browser cannot decode (HEIC in Chrome), is not attached; the status
  line says so. The input placeholder reads "Ask the assistant or drop an
  image...". One image per message: a new drop replaces the attached one, and
  only the latest drop is attached, even if an earlier one takes longer to
  prepare. A send waits for an image that is still being prepared, so it goes
  along with that message.
- **The image the model gets**: the page redraws the image as a JPEG
  (quality 0.9) with a long side of at most **1568 px**. That is the size
  Claude reads natively, and enough detail for every configured model. A
  smaller image keeps its size. The EXIF rotation of a phone photo is applied,
  and transparent parts become white. The debug log records the result
  (`image prepared: 1568x1276, … KB`).
- **Preview**: the attached image is shown small above the input, with a × to
  remove it. After sending, it is shown in the user's message.
- **Text**: an image can be sent with an empty input. The user's message then
  shows only the image, and the chat backend gives the model the default text
  (see below).
- The images stay in the conversation and go along with every turn, so a
  follow-up can refer to the image. Every step of a turn sends them again (up
  to 16 times), which is why the page scales them down: a larger image adds
  little detail for any configured model, and Gemini allows 20 MB of inline
  data per request.

With images off, the chat is text-only and a dropped file behaves as in any
page (the browser opens it).

A user message carries its images in `images`, an array of base64 data URLs
(`image/jpeg`, `image/png`, `image/webp` or `image/gif`):

```json
{ "role": "user", "content": "", "images": ["data:image/jpeg;base64,/9j/..."] }
```

A user message with images and an empty (or blank) `content` gets the text
"Identify the furniture in the image (for example a kitchen, wardrobe, media
unit, lowboard, sideboard, cabinet or utility room) and create a planning as
close to it as possible." (`DEFAULT_IMAGE_PROMPT` in `chat-config.ts`). The
backend adds it for every client, the page, the test script and curl alike.

The backend accepts no image URL, because the AI SDK would download it in the
backend. It passes the images to the model as file parts of the user message
(`toModelMessages`), and every provider reads them there. The Mistral
middleware moves only the images of tool results. An image sent to a model
that reads no images is answered with `400`.

## Architecture

```
[Browser: index.html]
  ├── Chat UI (POST /chat with the message history and clientId)
  └── MCP browser bridge (?mcp=true, same clientId in hello)
            │ ws://localhost:3100/bridge
            ▼
[Chat backend: hi-mcp/hi-mcp-chat on :3200]
  ├── Mistral / Anthropic / Google / Azure via the @ai-sdk provider packages (key from HI_CHAT_TOKEN)
  ├── MCP client via @ai-sdk/mcp → http://localhost:3100/mcp?client=<clientId>
  └── streamText(tools) → plain text stream
            │ Streamable HTTP /mcp
            ▼
[hi-mcp/hi-mcp-server] → page bridge → roomDesignerApi.extended
```

The chain keeps the MCP server untouched: the chat backend is just another MCP
client, so every HI tool (`get-plan-context`, `create-or-replace-groups`,
`get-plan-images`, …) works in the chat exactly as it does for Claude or
Copilot. A new group is positioned by the `placement` it is created with.

### The chat backend package

| File | Role |
| ---- | ---- |
| `chat-config.ts` | Environment parsing and request body validation |
| `chat-handler.ts` | HTTP handler factory: CORS, `/health`, `/capabilities`, `POST /chat`, error relay |
| `chat-server.ts` | Entry point: provider model (Mistral/Anthropic/Google/Azure) + `@ai-sdk/mcp` + `streamText`, listen on the chat port |
| `chat-steps.ts` | The step loop of a turn (16 steps, the last without tools), the step log, the turn timeout message |
| `tool-result-images.ts` | Mistral middleware: the images of a tool result go to the model as a user message |
| `tests/chat-handler.test.ts` | Unit tests (config, validation, CORS, error relay, streaming) |
| `tests/chat-steps.test.ts` | Unit tests of the step loop, the step log and the turn timeout (`MockLanguageModelV3`) |
| `tests/tool-result-images.test.ts` | Unit tests of the Mistral middleware |

### Images in tool results

`get-plan-images` returns its two renders as MCP image blocks; `@ai-sdk/mcp`
turns them into image parts of the tool result. Anthropic, Google and Azure
send those to the model as images. `@ai-sdk/mistral` writes a tool result's
content as JSON text — two renders were 1.5 to 2.1 million tokens of base64
against Mistral Large's 262k context. The Mistral model is therefore wrapped
with a middleware (`tool-result-images.ts`) that moves the images of every
tool result into a user message right after the tool message; Mistral reads
them there (about 1.3k tokens per image). The tool result keeps its text parts
and a note that the images follow. Smaller renders would not help: base64 text
costs about one token per character, and no model reads an image from it. Only
the Mistral model is wrapped; the other providers keep their native image
handling. Guarded by
`it('moves the images of a tool result into a user message after the tool message')`
in `hi-mcp/hi-mcp-chat/tests/tool-result-images.test.ts`.

The MCP server keeps its results small for every client: compact JSON without
the signed `imageUrl` of the master data
([behaviour reference §5.3](../../docs/hi-mcp-behaviour.md#53-result-format)).
A plan context with them fills half of Mistral Large's context.

Endpoints: `GET /health` (used for smoke tests), `GET /capabilities`
(`{ "imageInput": true }` when the model reads images — see
[Images in the chat](#images-in-the-chat)) and `POST /chat`
(`{ "messages": [{ "role": "user", "content": "..." }], "clientId": "<page ID>" }`
→ plain text stream). The prompt runner reads the page ID from the bridge hello
before posting to chat. Errors are relayed as plain text with a matching status code: `503`
without a configured token, `400` for invalid bodies or a missing `clientId`, `403` for disallowed
origins, `500` when the chat cannot start (the MCP server is unreachable, or the provider is not
configured, e.g. `AZURE_RESOURCE_NAME`). A failure after the stream started — a provider error, the
turn timeout — ends the stream with an `[error] …` line.

### Environment variables

| Variable | Default | Meaning |
| -------- | ------- | ------- |
| `HI_CHAT_TOKEN` | — | The provider API key (set by the launcher from the CLI argument) |
| `HI_CHAT_PROVIDER` | `mistral` | The CLI provider name (`mistral`, `mistral-medium`, `claude`, `gemini`, `azure`, `gpt-5-mini`, `gpt-5.4-mini`, `gpt-6-astra`, or a full `mistral-*`/`claude-*`/`gemini-*` model id) |
| `HI_CHAT_PORT` | `3200` | Port of the chat backend (the page reads it via the `chat_port` query parameter) |
| `HI_CHAT_MODEL` | from the provider name | Overrides the model id (mainly Azure deployment names) without changing the provider; ignored for `gpt-5-mini`/`gpt-5.4-mini`/`gpt-6-astra` |
| `AZURE_RESOURCE_NAME` | — | Required for `azure`/`openai`: the Azure OpenAI resource name (ignored for `gpt-5-mini`/`gpt-5.4-mini`/`gpt-6-astra`) |
| `HI_MCP_URL` | `http://localhost:3100/mcp` | The MCP server the chat backend connects to |
| `HI_CHAT_PAGE_ORIGINS` | `http://localhost:3000`, `http://127.0.0.1:3000` | Allowed CORS origins (the launcher sets it to match `EXAMPLE_PORT`) |
| `HI_CHAT_TURN_TIMEOUT_MS` | `300000` | A turn that has not answered within this time is aborted and ends with an `[error]` line naming the limit; the plan keeps what the tools changed |
| `HI_CHAT_REASONING_EFFORT` | — | The reasoning effort sent to the GPT deployments (`gpt-5-mini`, `gpt-5.4-mini`, `gpt-6-astra`), e.g. `medium`; unset, the deployment's default |

## Security notes

- The API key travels: CLI argument → environment variable of the chat
  backend. It is never written into the page, the URL, or the launcher log.
- A CLI argument is visible in `ps` for the lifetime of the process — accepted
  for a local dev example. `HI_CHAT_TOKEN` works as an alternative without
  that exposure.
- CORS is restricted to the example page origins; requests without an origin
  (curl) are allowed for local debugging, but must include the connected page's `clientId`.
- The chat backend listens on loopback (`127.0.0.1`) only: it holds the key and
  accepts requests without an origin, so no other device can reach it.

## Troubleshooting

| Symptom | Cause and fix |
| ------- | ------------- |
| `No API token configured` (503) | Chat backend started without a key — start with `npm start <provider> <api-key>` |
| Chat disabled: server already has a planner connected | Close the other planner page, then reload this one |
| `Chat request requires a page clientId` (400) | Include the browser page's bridge `clientId` in the chat request |
| `AZURE_RESOURCE_NAME is required` | The `azure` provider needs the resource name env var and the deployment name in `HI_CHAT_MODEL` |
| Reply says the tool failed with "no page connected" | The example page is not open (or not with `?mcp=true`) — the browser bridge is required for tool calls |
| `port 3200 is already in use` | A previous chat backend is still running — `lsof -ti tcp:3200 \| xargs kill`, or pick another port with `HI_CHAT_PORT` |
| Provider error in the reply | The provider API rejected the key or the model — check the key, or set `HI_CHAT_MODEL` |
| A dropped image opens in the tab instead of being attached | Images are off: the banner shows `Images: no` (the model is not known to read images), or the chat backend was not up yet when the page loaded the chat — the debug log says `images disabled - no capabilities`; reload the page |
| `The model … does not read images` (400) | An image was sent to a model without image input (curl, a script, or a page from an earlier backend) |

## The chat in the ligna-store

The ligna-store has a chat window of its own (ligna-store `hi-mcp/chat.ts`,
`chat-window.ts`, `chat-options.ts`), opened with the store URL parameters
`model`, `api_key` and `mcp_server`. It runs the Vercel AI SDK in the store
page: the model is called directly with `api_key` (Mistral and the Foundry
endpoint allow browser CORS), and the tools come from `<mcp_server>/mcp`, which
answers the store origin (`HI_MCP_PAGE_ORIGINS`,
[cloudflare-mcp-server.md](../../docs/setup/cloudflare-mcp-server.md#browser-clients-cors)).
The store keeps `api_key` out of the page URL its bridge announces. Its
reference is the ligna-store's `hi-mcp/README.md`; why neither chat is served
by the MCP server, and why a key in the store URL is for a demo only:
[ADR 0003](../../.agents/decisions/0003-the-ai-chat-is-an-mcp-client-beside-the-server.md).
Where the store's chat differs from this one is open in the
[backlog](../../.agents/backlog/README.md#ligna-store).

## Open follow-ups

The open work on the chat is in the [backlog](../../.agents/backlog/README.md#chat).
