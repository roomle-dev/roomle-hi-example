# Pages, Chat and Launcher

The page side of the bridge, the launcher that starts the example, and the chat of the example
page. How the chat behaves for the user, with its models and the image feature, is described in
[ai-chat.md](../../docs/ai-chat.md); this page describes the code.
[Back to the overview](./README.md).

## The page side of the bridge

The MCP server reaches a planner page through its `/bridge`. The example page has no bridge any
more: it runs the HI MCP tools of the embedding-lib itself ([The chat of the example
page](#the-chat-of-the-example-page)). Two copies of the same client exist:

| Copy | Used by | Tests |
| ---- | ------- | ----- |
| `hi-mcp/hi-mcp-client/browser-bridge.ts` + `types.ts` | the reference copy of the ligna-store's bridge | `hi-mcp-client/tests/browser-bridge.test.ts` |
| `ligna-store/hi-mcp/browser-bridge.ts` + `types.ts` | the store page | — (synced by hand from the reference copy) |

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

The allow-list is `getExternalObjectPlanContext`, `externalObjectGroupOperation`, `fetchPrice`,
`getExternalObjectSnapshot`, `undo`, `redo` — the methods of `planner-api.ts`
(`tests/planner-api.test.ts` checks that the client list matches).

`browser-bridge.ts` takes the server URL and the session from `options.serverUrl` and
`options.sessionId`; on an `https:` page without a server URL it also tries
`wss://localhost:3100/bridge`, rotated when a socket never opened. `resolveBridgeUrls` turns an
`http(s)` server URL into `ws(s)`, strips a trailing slash, and appends `/bridge`. It reports
connecting, connected, occupied and unavailable through `onStatusChange` and has `retry()` and
`dispose()`; `hello` carries `ligna-store` and the page URL without `api_key`.

The store's `Planner.vue` resolves `mcpOptions` from `mcp_server` and `mcp_session`, then starts
the bridge when its planner is available. The resolver generates one `clientId` and uses it as
the session when none is supplied. Optional `chatOptions` reuse that identity and add a supported
model, API key and image support; only then does the planner show the chat window
(`featureFlags.planningAssistant`) and `hi-mcp/chat-host.ts` feed it. Missing or invalid chat
settings leave the bridge enabled. A page without a valid `mcp_server` starts no bridge, including
on INT. Unmount and locale reload dispose the bridge and optional chat together.

## The launcher — `minimal-hi-example/start.mjs`

The root `start` and `dev` scripts invoke `node minimal-hi-example/start.mjs` directly, with
`--dev` for the local Rubens UI. npm forwards positional arguments and flags after `--`, for
example `npm start -- --no-open` or `npm run dev -- mistral <api-key> --no-open`.

### Arguments

| Argument | Effect |
| -------- | ------ |
| `<model> <api-key>` | Also serve the model of the page's chat and open the page with the chat window. The model is a name of `MODEL_ALIASES`, a deployment of `FOUNDRY_DEPLOYMENTS` or a `gpt-*`, `mistral-*`, `claude-*`, `gemini-*` model id; an unknown model or a missing key exits with 1 |
| `--dev` | The planner loads from `http://localhost:5173/` (`EXAMPLE_SERVER_URL` overrides) |
| `--no-open` | Do not open the browser |

| Variable | Default | Effect |
| -------- | ------- | ------ |
| `EXAMPLE_PORT` | 3000 | page port |
| `EXAMPLE_SERVER_URL` | — | the planner's Rubens UI, passed as `server_url` |
| `HI_CHAT_MODEL` | — | replaces the model of every provider other than the Foundry deployments (an Azure deployment name for `azure`) |
| `AZURE_RESOURCE_NAME` | — | required for `azure` / `openai`: the resource of that deployment |
| `HI_CHAT_REASONING_EFFORT` | per deployment | the reasoning effort of an Azure model on the Responses API |

### What it does

1. **Model:** `planningAssistantConfig` turns the model name and the key into the
   `PlanningAssistantConfig` of the embedding-lib — `{ provider, model, apiKey, baseUrl?,
   chatCompletions?, reasoningEffort?, readsImages }`. Every `gpt-*` id and the names of
   `FOUNDRY_DEPLOYMENTS` are Azure deployments on the HI Foundry resource (`FOUNDRY_BASE_URL`), or
   on the resource their entry names (`gpt-6.1-sol`); `mistral-large-3` uses Chat Completions;
   gpt-5-mini and gpt-5.4-mini get the reasoning effort `high`. The aliases map to Mistral,
   Anthropic, Google and an Azure deployment on `AZURE_RESOURCE_NAME`, whose base URL is the one the
   AI SDK builds from a resource name. `readsImages` holds for every Anthropic and Google model,
   every `gpt-*` deployment on a Foundry resource and the ids of `IMAGE_INPUT_MODELS`.
2. **Static server** for `minimal-hi-example/` (`/` → `index.html`; only `.html`, `.js`, `.md`, `.json`).
3. **Config:** `/planning-assistant-config.json` answers the config as JSON with
   `Cache-Control: no-store`, to a request from this machine only (`127.0.0.1`, `::1`; 403
   otherwise), and 404 without a model.
4. **Prints** `Example:` and, with a model, `Model:` (provider and model, never the key) — the test
   scripts parse the `Example:` line — and opens
   `http://localhost:3000/?backendId=HI_PRE_Roomle_Milestone_2&library_id=Furniture_Smith`, plus
   `chat=true` with a model and `server_url`.

SIGINT and SIGTERM end the launcher with 0, and the page server stops with it.
`hi-mcp-server/tests/example-launcher.test.ts` checks the config of a model, the 404 without one,
and that the page port can be bound again after signalling only the launcher PID (POSIX).

## The chat of the example page

`index.html` imports `@roomle/embedding-lib` and its `hi.js` from unpkg — the dev version
`0.0.0-dev-a4754cb` until a release has the planning assistant
([unreleased-embedding-lib.md](../../docs/setup/unreleased-embedding-lib.md)). With `?chat=true`
the page sets `featureFlags.planningAssistant` in the planner options, and `startChat`:

1. leaves the chat off, with a line in the debug log, when the planner has no
   `planningAssistantOutput` (no AI Planning Assistant window);
2. fetches `/planning-assistant-config.json` from the launcher; without it, it reports the window
   unavailable with the message to start the example with a model;
3. calls `startPlanningAssistant(recordedPlannerApi(roomDesignerApi), config, signal)` of the
   embedding-lib, which loads the AI SDK and the provider from esm.sh, requests the prompts of the
   planner (`getExternalObjectAgentPrompts()`), creates the HI MCP tools, registers
   `onPlanningAssistantPrompt` and runs every turn with `streamText` (at most 16 steps, the last
   without tools).

`recordedPlannerApi` is the planner API the planning assistant runs on: a proxy of
`roomDesignerApi.extended` that records every call of the six planner methods in
`window.hiPlannerCalls` (`id`, `method`, `args`, `ms`, `ok`, `error`, and the answer of a
snapshot, which holds the images `get-plan-images` shows the agent) and every output part of the
window in `window.hiPlanningAssistantOutput`. Its `callbacks` are the planner's own, so the
assistant's `onPlanningAssistantPrompt` and the tools' `onHistoryChange` land there.
`window.hiAgentPlanContext(include)` creates a tool set of its own and answers the plan context in
the agent's words, as the tool `get-plan-context` does. The tools log every tool call and planner
call to the page console (`[hi-mcp] tool …`, `[hi-mcp] call <n>: …`), the planning assistant its
errors (`[planning-assistant] …`).

## Before you change these files

- **The chat is the embedding-lib's.** The loop, the tools, the served text and the planning skills
  live in roomle-ui `packages/embedding-lib`; the page only hands it the model and the planner API.
  A new embedding-lib version means raising the version in the two imports of `index.html`.
- **The prompts come from the planner:** the planning assistant requests
  `getExternalObjectAgentPrompts()`; a change of a prompt is a change in roomle-ui
  `hi-agent-prompts.ts`.
- **The model names are the launcher's.** A new model or deployment is an entry in `start.mjs`
  (`FOUNDRY_DEPLOYMENTS`, `MODEL_ALIASES`, `IMAGE_INPUT_MODELS`).
- **Two bridge copies.** A protocol change touches the server's `types.ts`, the client's
  `types.ts` and the ligna-store copy, and raises `BRIDGE_PROTOCOL`.
- **The test scripts use page globals** — `window.instance`, `window.hiPosGroupsCompletelyLoaded`,
  `window.hiPlannerCalls`, `window.hiPlanningAssistantOutput` and `window.hiAgentPlanContext` of
  `index.html` ([Deployment and testing](./deployment-and-testing.md#end-to-end-runs)).
