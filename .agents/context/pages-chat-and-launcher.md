# Pages, Chat and Launcher

The launcher that starts the example and the chat of the example page. How the chat behaves for the user, with its models and the image feature, is described in
[ai-chat.md](../../docs/ai-chat.md); this page describes the code.
[Back to the overview](./README.md).

## The launcher — `minimal-hi-example/start.mjs`

The root `start` and `dev` scripts invoke `node minimal-hi-example/start.mjs` directly, with
`--dev` for the local Rubens UI. npm forwards positional arguments and flags after `--`, for
example `npm start -- --no-open` or `npm run dev -- mistral <api-key> --no-open`.

### Arguments

| Argument | Effect |
| -------- | ------ |
| `<model> <api-key>` | Also serve the model of the page's chat and open the page with the chat window. The model is `openai:<model-id>`, a name of `MODEL_ALIASES`, a deployment of `FOUNDRY_DEPLOYMENTS` or a `gpt-*`, `mistral-*`, `claude-*`, `gemini-*` model id; an unknown model or a missing key exits with 1 |
| `--dev` | The planner loads from `http://localhost:5173/` (`EXAMPLE_SERVER_URL` overrides) |
| `--no-open` | Do not open the browser |

| Variable | Default | Effect |
| -------- | ------- | ------ |
| `EXAMPLE_PORT` | 3000 | page port |
| `EXAMPLE_SERVER_URL` | — | the planner's Rubens UI, passed as `server_url` |
| `HI_CHAT_MODEL` | — | replaces the model of every provider other than the Foundry deployments and explicit `openai:<model-id>` requests (an Azure deployment name for `azure`) |
| `AZURE_RESOURCE_NAME` | — | required for `azure` / `openai`: the resource of that deployment |
| `HI_CHAT_REASONING_EFFORT` | per deployment | the reasoning effort of an Azure model on the Responses API |
| `HI_CHAT_LIBRARY_REFERENCE_BUDGET` | — (the assistant's 256,000) | `libraryReferenceBudget` of the config, a positive integer of bytes: above it the library reference is the category directory (`withLibraryReferenceBudget`) |

### What it does

1. **Model:** `planningAssistantConfig` turns the model name and the key into the
   `PlanningAssistantConfig` of the embedding-lib — `{ provider, model, apiKey, baseUrl?,
   chatCompletions?, reasoningEffort?, referenceCacheBreakpoint?, readsImages }`. Every `gpt-*` id and the names of
   `FOUNDRY_DEPLOYMENTS` are Azure deployments on the HI Foundry resource (`FOUNDRY_BASE_URL`), or
   on the resource their entry names (`gpt-6.1-sol`); `mistral-large-3` uses Chat Completions;
   gpt-5-mini and gpt-5.4-mini get the reasoning effort `high`. The aliases map to Mistral,
   Anthropic, Google and an Azure deployment on `AZURE_RESOURCE_NAME`, whose base URL is the one the
   AI SDK builds from a resource name. `readsImages` holds for every Anthropic and Google model,
   every `gpt-*` deployment on a Foundry resource and the ids of `IMAGE_INPUT_MODELS`.
   The two configured GPT-6 deployments opt in to `referenceCacheBreakpoint`; other deployment
   names do not inherit that capability. It requires an embedding-lib that supports the option.
   `openai:<model-id>` selects provider `openai` before alias/deployment matching and preserves
   the complete suffix. It passes the supplied key, enables image input and uses the embedding-lib's
   OpenAI Responses adapter. Azure variables and `HI_CHAT_MODEL` cannot redirect that request.
   An empty suffix exits with the `openai:<model-id>` usage message.
2. **Static server** for `minimal-hi-example/` (`/` → `index.html`; only `.html`, `.js`, `.md`, `.json`).
3. **Config:** `/planning-assistant-config.json` answers the config as JSON with
   `Cache-Control: no-store`, to a request from this machine only (`127.0.0.1`, `::1`) under a
   loopback Host (`localhost`, `127.0.0.1`, `[::1]` with the page port), so a site whose name
   resolves to this machine (DNS rebinding) cannot read the key; 403 otherwise, 404 without a model.
4. **Prints** `Example:` and, with a model, `Model:` (provider and model, never the key) — the test
   scripts parse the `Example:` line — and opens
   `http://localhost:3000/?backendId=HI_PRE_Roomle_Milestone_2&library_id=Furniture_Smith`, plus
   `chat=true` with a model and `server_url`.

SIGINT and SIGTERM end the launcher with 0, and the page server stops with it.
`minimal-hi-example/tests/start.test.js` checks the config of a model, the 404 without one,
the 403 for a foreign Host, and that the page port can be bound again after signalling only the launcher PID (POSIX).

## The chat of the example page

`index.html` imports `@roomle/embedding-lib` and its `hi.js` from jsDelivr's npm CDN, pinned to the dev version
`0.0.0-dev-5e54d0f`
([unreleased-embedding-lib.md](../../docs/setup/unreleased-embedding-lib.md)). With `?chat=true`
the page sets `featureFlags.planningAssistant` in the planner options, and `startChat`:

1. leaves the chat off, with a line in the debug log, when the planner has no
   `planningAssistantOutput` (no AI Planning Assistant window);
2. fetches `/planning-assistant-config.json` from the launcher; without it, it reports the window
   unavailable with the message to start the example with a model;
3. calls `startPlanningAssistant(recordedPlannerApi(roomDesignerApi), config, signal)` of the
   embedding-lib, which loads the AI SDK and the provider from esm.sh, requests the prompts of the
   planner (`getExternalObjectAgentPrompts()`), creates the HI MCP tools from the tools the planner
   serves (`getExternalObjectAgentTools()`), registers
   `onPlanningAssistantPrompt` and runs every turn with `streamText` (at most 16 steps, the last
   without tools).

`recordedPlannerApi` is the planner API the planning assistant runs on: a proxy of
`roomDesignerApi.extended` that records every tool call the planner runs
(`callExternalObjectAgentTool`) in `window.hiPlannerCalls` (`id`, `tool`, `input`, `ms`, `ok`,
`error` — the text of an `isError` result or the rejection —, and the result of `get-plan-images`,
which holds the images the agent saw) and every output part of the window in
`window.hiPlanningAssistantOutput`. Its `callbacks` are the planner's own, so the assistant's
`onPlanningAssistantPrompt` lands there. `window.hiAgentPlanContext(include)` answers the plan
context in the agent's words, as the tool `get-plan-context` does, without being recorded. The
tools log every tool call and planner call to the console of the planner's frame, which the page
console carries (`[hi-mcp] tool …`, `[hi-mcp] call <n>: …`); the planning assistant logs its
errors (`[planning-assistant] …`) and one `[planning-assistant] usage <JSON>` record per accepted
prompt. The record names the resolved provider/model, input/output/total tokens and coverage,
without the key or prompt contents. The prompt runner collects this host-page record separately
from the planner-frame tool log; the [testing reference](deployment-and-testing.md#prompt-token-accounting)
defines the stored measurements and their report totals.

The local planning assistant can supply a shared reference before conversation history: common
rules plus a compact article/attribute projection refreshed each turn. The example owns neither
the reference content nor its assembly. At the start of every turn the assistant reads the current
rooms/groups/obstacles/installation elements through `get-plan-context` and supplies them after the
history as the plan state of the turn
([ADR 0016](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/the-planning-assistant-supplies-the-plan-state-per-turn.md));
the model obtains relevant image/room/region skills through `get-skill`. Genuine successful tool
calls/results remain in history; the automatic library and plan state messages stay outside it.
The host has no first-image guidance/presence lifecycle:
[ADR 0015](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/keep-live-plan-state-and-image-guidance-on-demand.md)
rejects that automatic preload because its added complexity has no demonstrated overall benefit.
The launcher selects verified deployment capabilities; the embedding-lib
owns prompt assembly and cache policy. Architecture, lifecycle and decisions live in roomle-ui's
[prompt-caching reference](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/prompt-caching.md).
Version 1 diagnostics preserve cache-read/write coverage, model-call timings and request/reference
bytes and digests without storing prompt content or credentials. The runner records both local
embedding imports and planner origins so a local benchmark can verify its actual runtime.
`referenceAcquisitionMs` covers the library and plan state reads and the reference measurement
before inference; the reference digest covers instructions/library only. Before the first prompt the
assistant reads the planner's library context until the catalog has loaded, so that the planner
has calculated the article templates when the first turn acquires its reference; the console line
`[planning-assistant] library read before the first prompt` gives the articles and milliseconds.
The runner's wait for the catalog makes the same read, so a run's first turn is warm either way. Historical benchmark 03 keeps
its measured preload semantics and is retained as evidence of the rejected attempt.

## Before you change these files

- **The chat is roomle-ui's.** The loop lives in roomle-ui `packages/embedding-lib`; the tools, the
  served text and the planning skills in the planner
  ([ADR 0012](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/the-hi-tool-set-runs-in-the-planner.md)), so they come with the
  planner at the server URL. The page only hands the loop the model and the planner API. A new
  embedding-lib version means raising the version in the two imports of `index.html`.
- **The prompts come from the planner:** the planning assistant requests
  `getExternalObjectAgentPrompts()`; a change of a prompt is a change in roomle-ui
  `hi-agent-prompts.ts`.
- **The model names are the launcher's.** A new model or deployment is an entry in `start.mjs`
  (`FOUNDRY_DEPLOYMENTS`, `MODEL_ALIASES`, `IMAGE_INPUT_MODELS`).
- **The test scripts use page globals** — `window.instance`, `window.hiPosGroupsCompletelyLoaded`,
  `window.hiPlannerCalls`, `window.hiPlanningAssistantOutput`, `window.hiAgentPlanContext` and
  `window.hiPlanningAssistantAbort` (ends a turn that takes too long) of `index.html` ([Deployment and testing](./deployment-and-testing.md#end-to-end-runs)).

### Responses request transport

OpenAI and Azure Responses start each user turn with current library reference and successful
history, then send new tool results with the preceding stored provider response ID. The chain
ends with the turn. Other providers send full accumulated input. The embedding-lib owns this
behavior; see roomle-ui [prompt caching and continuations](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/prompt-caching.md).

Request diagnostics include zero-based SDK step association and input/tools/envelope sections.
New/repeated serialized input items are measured within the turn using digests, independently of
provider cache usage. Missing digest support leaves repetition unknown. No bodies or keys are
stored. The benchmark displays model steps from 1 and each HTTP attempt separately.
