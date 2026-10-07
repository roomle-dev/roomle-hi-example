# Pages, Chat and Launcher

The page side of the bridge, the launcher that starts the example, and the chat backend. How the
chat behaves for the user, with its models and the image feature, is described in
[ai-chat.md](../../minimal-hi-example/docs/ai-chat.md); this page describes the code.
[Back to the overview](./README.md).

## The page side of the bridge

Three copies of the same client exist:

| Copy | Used by | Tests |
| ---- | ------- | ----- |
| `hi-mcp/hi-mcp-client/browser-bridge.ts` + `types.ts` | the reference copy of the ligna-store's bridge | `hi-mcp-client/tests/browser-bridge.test.ts` |
| `ligna-store/hi-mcp/browser-bridge.ts` + `types.ts` | the store page | — (synced by hand from the reference copy) |
| inline in `minimal-hi-example/index.html` | the example page, with `?mcp=true` | — |

### What every copy does

1. **Connect** to the server's `/bridge`, with `?session=<id>` when a session is set.
2. **Send `hello`** on open: `example`, `url`, `protocol: 2`, `clientId`.
3. **Wait for `ready`.** Calls before `ready` are ignored.
4. **Run a `call`:** a method outside the allow-list answers `Planner method not exposed: <method>`;
   otherwise `await roomDesignerApi.extended[method](...args)` and reply `{ ok: true, result }`, or
   `{ ok: false, error }` with the error message.
5. **Relay history:** wrap `extended.callbacks.onHistoryChange` — call the host page's handler
   first, then send `{ kind: 'event', name: 'historyChange', undo, redo }`.
6. **Reconnect** after 3 s (`RECONNECT_DELAY_MS`) on close — except after close code 4409, when
   another page owns the planner: then report "occupied" and stop.

The allow-list is `getExternalObjectPlanContext`, `loadExternalObjectGroupLayout`,
`externalObjectGroupOperation`, `fetchPrice`, `getExternalObjectSnapshot`, `getExternalObjectGroups`,
`removeExternalObject`, `undo`, `redo` — the methods of `planner-api.ts`
(`tests/planner-api.test.ts` checks that the client list matches).

### Differences

| | `browser-bridge.ts` | `index.html` |
| - | ------------------- | ------------ |
| Server URL | `options.serverUrl`, `options.sessionId` | query parameters `mcp_server`, `mcp_port`, `mcp_session` |
| URL fallback | on an `https:` page without a server URL also `wss://localhost:3100/bridge`, rotated when a socket never opened | one URL |
| `hello.example` / `url` | `ligna-store` / the page URL without `api_key` | `minimal-hi-example` / the full URL |
| `clientId` | `options.clientId` (may be missing) | a `crypto.randomUUID()` per page load |
| Status | `onStatusChange`: connecting, connected, occupied, unavailable; `retry()`, `dispose()` | `setMcpConnection` enables or disables the chat input |

`resolveBridgeUrls` / `resolveBridgeUrl` turn an `http(s)` server URL into `ws(s)`, strip a trailing
slash, and append `/bridge`.

## The launcher — `minimal-hi-example/start.mjs`

`npm start` at the repository root runs `node minimal-hi-example/start.mjs` with the positional
arguments; flags must be passed to the script directly (`node minimal-hi-example/start.mjs --no-open`).

### Arguments

| Argument | Effect |
| -------- | ------ |
| `<provider> <api-key>` | Also start the chat backend. The provider is one of `CHAT_PROVIDERS` or a `mistral-*`, `claude-*`, `gemini-*` model id; an unknown provider or a missing key exits with 1 |
| `--dev` | The planner loads from `http://localhost:5173/` (`EXAMPLE_SERVER_URL` overrides) |
| `--cf` | Use the deployed server `https://hi-mcp-poc.hi-orchestrator.workers.dev` with the OS user name as session; no local MCP server; the page must run on port 3000 |
| `--no-open` | Do not open the browser |

| Variable | Default | Effect |
| -------- | ------- | ------ |
| `EXAMPLE_PORT` | 3000 | page port |
| `HI_MCP_PORT` | 3100 | MCP port; adds `&mcp_port=` to the page URL only when set |
| `HI_CHAT_PORT` | 3200 | chat port; adds `&chat_port=` only when set |
| `EXAMPLE_SERVER_URL` | — | the planner's Rubens UI, passed as `server_url` |
| `HI_MCP_PAGE_ORIGINS`, `HI_CHAT_PAGE_ORIGINS` | the page's localhost origins (+ `https://www.roomle.com` for MCP) | set on the children when unset |

### What it does

1. **Build gate:** `npm install` in `hi-mcp/` when `node_modules` is missing, then always
   `npm run typecheck`; a failure stops the launcher.
2. **Static server** for `minimal-hi-example/` (`/` → `index.html`; only `.html`, `.js`, `.md`, `.json`).
3. **MCP server:** `npm start --workspace hi-mcp-server` with `HI_MCP_STORE_URL` set to the example URL.
4. **Chat backend** (with a provider): `npm start --workspace hi-mcp-chat` with `HI_CHAT_TOKEN`,
   `HI_CHAT_PROVIDER` and `HI_MCP_URL`.
5. **Prints** `Example:`, `MCP:` and `Chat:` lines — the test scripts parse the `Example:` line — and
   opens `http://localhost:3000/?mcp=true&backendId=HI_PRE_Roomle_Milestone_2&library_id=Furniture_Smith`
   plus `chat=true`, ports, `server_url` or the Cloudflare parameters.

When a child exits, the launcher exits with its code; SIGINT and SIGTERM stop both children.

## The chat backend — `hi-mcp/hi-mcp-chat`

A small HTTP server on 127.0.0.1 (`HI_CHAT_PORT`, 3200) that runs one model turn per request with the
Vercel AI SDK and the MCP tools of the server. Only the example page uses it; the ligna-store runs
its chat in the page.

| File | Responsibility |
| ---- | -------------- |
| `chat-server.ts` | the HTTP server, the model, the MCP client, `streamText` |
| `chat-handler.ts` | routing, CORS, request validation |
| `chat-config.ts` | configuration, provider and model resolution, the system prompt, images |
| `chat-steps.ts` | the step loop and the step log |
| `tool-result-images.ts` | the Mistral middleware for images in tool results |

### Endpoints

| Path | Answer |
| ---- | ------ |
| `GET /health` | `ok` |
| `GET /capabilities` | `{ "imageInput": boolean }` — whether the model reads images |
| `POST /chat` | the streamed answer; 400 for a missing `clientId` or images to a model that cannot read them, 403 for another origin, 503 without a token |

Request: `{ messages: [{ role, content, images? }], clientId }` — the whole conversation, images as
base64 data URLs on user messages. Response: `text/plain`, streamed — the model's text, a line
`[tool] <name>` when a tool starts, and `[error] <message>` for errors and timeouts.

### A turn

1. **Model:** `resolveChatModel` maps the provider name — the Azure AI Foundry deployments
   (`gpt-5-mini`, `gpt-5.4-mini`, `gpt-6-astra`), the aliases (`mistral`, `claude`, `gemini`, …) and
   pass-through `mistral*`, `claude*`, `gemini-*` ids; `getLanguageModel` builds the provider (Mistral
   wrapped with the image middleware).
2. **MCP client:** a new `createMCPClient` per request, on `HI_MCP_URL` with `client=<clientId>` set —
   a `session` parameter survives. It is closed when the stream ends.
3. **Tools:** `mcpClient.tools()`, each `execute` wrapped to write the `[tool]` line and log its time.
4. **`streamText`** with `CHAT_SYSTEM_PROMPT` as instructions, at most `MAX_CHAT_STEPS` (16) steps; the
   last step runs with `toolChoice: 'none'`, so a turn always ends with an answer. The turn is
   aborted after `HI_CHAT_TURN_TIMEOUT_MS` (5 minutes).
5. **Step log:** tokens in, out and reasoning, tool calls, finish reason and duration per step.

`HI_CHAT_REASONING_EFFORT` is passed as `providerOptions.azure.reasoningEffort` to the Azure models.

### Images

`readsImages` decides whether a model gets images: every Anthropic and Google model and the ids in
`IMAGE_INPUT_MODELS`. User images become `file` parts. `@ai-sdk/mistral` sends tool results as JSON
text, so for Mistral `toolResultFilesAsUserMessages` moves the images of a tool result
(`get-plan-images`) into a user message right after it.

### The page side of the chat — `index.html`

With `?chat=true` the page posts to `http://localhost:<chat_port>/chat`, reads the stream
incrementally, shows the last `[tool]` name in the status line, renders the answer as Markdown
(marked + DOMPurify), and keeps the input disabled until the bridge is accepted. `GET /capabilities`
enables image drops; `prepareImage` redraws an image as JPEG with a long side of at most 1568 px.

## Before you change these files

- **The `clientId` chain:** the page creates it, sends it in `hello`, in every chat request, and the
  chat backend in `/mcp?client=`. The server refuses a chat whose page no longer owns the planner.
- **Three bridge copies.** A protocol change touches the server's `types.ts`, the client's
  `types.ts`, the ligna-store copy and `index.html`, and raises `BRIDGE_PROTOCOL`.
- **The page keeps only the text of earlier turns.** Tool results are not resent; images are, with
  every later turn.
- **The test scripts use page globals** — `window.instance` and `window.hiPosGroupsCompletelyLoaded`
  of `index.html` ([Deployment and testing](./deployment-and-testing.md#end-to-end-runs)).
