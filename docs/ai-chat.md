# AI Chat in the Example — Reference

The example page has a built-in AI chat that plans with the HI tools: the model
reads the plan context and creates, modifies, or positions object groups by
calling the HI MCP tools. It turns the example into a self-contained demo — no
Claude Code or Copilot needed.

The chat runs in the page with the planning assistant of the roomle-ui
embedding-lib: `startPlanningAssistant` of `@roomle/embedding-lib/hi`, a
[Vercel AI SDK](https://sdk.vercel.ai) loop with the HI MCP tools of the
embedding-lib (`createHiMcpTools`) — the tools of
`hi-mcp-server` without an MCP server. Its
reference is roomle-ui `packages/embedding-lib/docs/homag-intelligence-embedding.md`,
"The AI Planning Assistant agent" and "HI MCP tools for an AI agent". The page
loads the embedding-lib alpha release `9.0.0-alpha.5` from unpkg
([unreleased-embedding-lib.md](setup/unreleased-embedding-lib.md)).
Supported providers: **Mistral**, **Anthropic (Claude)**, **Google (Gemini)** and
**Azure OpenAI**.

## Running it

```bash
npm start mistral <api-key>           # mistral-large-latest (default)
npm start mistral-medium <api-key>   # mistral-medium-latest
npm start mistral-large-4 <api-key>  # mistral-large-4-0
npm start claude <api-key>           # claude-sonnet-4-5
npm start gemini <api-key>           # gemini-2.5-pro (Gemini API key from Google AI Studio)
npm start azure <api-key>            # gpt-4o deployment (see below)
npm start gpt-5-mini <api-key>       # gpt-5-mini on the HI Azure AI Foundry resource
npm start gpt-5.4-mini <api-key>     # gpt-5.4-mini on the HI Azure AI Foundry resource
npm start gpt-6-astra <api-key>      # gpt-6-astra on the HI Azure AI Foundry resource
npm start gpt-6.1-sol <api-key>      # gpt-6.1-sol on its own Foundry resource (the key of that resource)
npm run dev <model> <api-key>        # same, planner from the local Rubens UI dev server (:5173)
```

The model name selects the provider and the model:

| Model name | Provider | Model |
| ---------- | -------- | ----- |
| `mistral` | Mistral | `mistral-large-latest` (default) |
| `mistral-medium` | Mistral | `mistral-medium-latest` |
| `mistral-large` | Mistral | `mistral-large-latest` |
| `mistral-large-3` | Azure OpenAI (HI Azure AI Foundry resource) | the `mistral-large-3` deployment |
| `mistral-large-4` | Mistral | `mistral-large-4-0` |
| any `mistral-*` model id | Mistral | passed through (e.g. `mistral-small-latest`) |
| `claude` / `anthropic` | Anthropic | `claude-sonnet-4-5` |
| `claude-sonnet` | Anthropic | `claude-sonnet-4-5` |
| `claude-opus` | Anthropic | `claude-opus-4-1` |
| any `claude-*` model id | Anthropic | passed through |
| `gemini` / `google` / `gemini-pro` | Google (Gemini API) | `gemini-2.5-pro` |
| `gemini-flash` | Google (Gemini API) | `gemini-2.5-flash` |
| any `gemini-*` model id | Google (Gemini API) | passed through (e.g. `gemini-3-pro-preview`) |
| `azure` / `openai` | Azure OpenAI | `gpt-4o` (deployment name — see below) |
| any `gpt-*` model id (e.g. `gpt-5-mini`, `gpt-5.4-mini`, `gpt-6-astra`) | Azure OpenAI (HI Azure AI Foundry resource) | the deployment of the same name |
| `gpt-6.1-sol` | Azure OpenAI (its own Foundry resource) | the `gpt-6.1-sol` deployment |

Model names and ids are matched case-insensitively, so `Mistral-Large-3` and
`mistral-large-3` are the same request.

The launcher (`minimal-hi-example/start.mjs`) turns the model name and the key
into the `PlanningAssistantConfig` of the embedding-lib — a JSON object with the
provider, the model, the key and, for an Azure deployment, the endpoint of its
resource, the API and the reasoning effort, and whether the model reads images
(`planningAssistantConfig` in `start.mjs`). It serves the config to the page at
`/planning-assistant-config.json`, to this machine only, and opens the page with
`&chat=true`, so the planner shows the button of the chat window. Without a model
the page has no chat. Guarded by
`it('serves the planning assistant config of the model to this machine')` in
`minimal-hi-example/tests/start.test.js`.

Azure needs two extra pieces: the resource name via the `AZURE_RESOURCE_NAME`
environment variable, and the **deployment name** (not the model name) via
`HI_CHAT_MODEL` — Azure deployments are user-named:

```bash
AZURE_RESOURCE_NAME=my-resource HI_CHAT_MODEL=my-gpt4o-deployment npm start azure <api-key>
```

`HI_CHAT_MODEL` replaces the model of every provider other than the Foundry
deployments.

Every `gpt-*` model and `mistral-large-3` need neither: they are deployments on the HI
Azure AI Foundry resource and are called through its OpenAI v1 endpoint
`https://dfhifoundrysweden.services.ai.azure.com/openai/v1` with the resource's
API key. `gpt-6.1-sol` is deployed on another Foundry resource and is called through its endpoint
`https://controller-mes-resource.services.ai.azure.com/openai/v1` with that resource's API key
(`baseUrl` of its entry in `FOUNDRY_DEPLOYMENTS` of `start.mjs`). A base URL ends in `/openai/v1`: the AI SDK
appends `/responses` or `/chat/completions` itself. `AZURE_RESOURCE_NAME` and `HI_CHAT_MODEL` are ignored for them, so values
left in the shell from an `azure` run cannot redirect them. `mistral-large-3` is an
exception to the mistral provider: it is served from the Foundry resource, not from
the Mistral API. A `gpt-*` name is passed through as the deployment name
without checking that the deployment exists: a missing deployment fails when the
chat calls the provider, as the error of the first turn. The chat
sets no `temperature`: the GPT deployments are reasoning models and reject it.

**API per deployment.** The Foundry GPT deployments use the Responses API, which
supports image input, function tools and reasoning together. GPT-6 Astra tool
calls require Responses; omitting reasoning effort retains the deployment default
and does not make Chat Completions compatible.
[Official OpenAI documentation](https://developers.openai.com/api/docs/guides/latest-model).
Foundry `mistral-large-3` uses Chat Completions (`chatCompletions: true` in its
config): its Responses endpoint rejects image input.

**Reasoning effort.** The launcher gives the lightweight deployments gpt-5.4-mini and gpt-5-mini the
reasoning effort `high` (`reasoningEffort` of the config, from `FOUNDRY_DEPLOYMENTS` in
`start.mjs`): accuracy goes over speed, and they plan worse than gpt-6-astra. gpt-6-astra and
gpt-6.1-sol run at their default. `HI_CHAT_REASONING_EFFORT` overrides the effort of every Azure
model reached through the Responses API; Mistral, Anthropic and Google models get none, and neither
does a deployment on Chat Completions. The defaults measured on the Foundry resource (2026-10-07):
gpt-5.4-mini does not reason (0 reasoning tokens in every step), gpt-5-mini and gpt-6-astra reason
as at `medium`. gpt-5-mini and gpt-5.4-mini read images and have a 400k context window.

The effort was chosen from the 32 tests of `docs/test-prompts.json`, one run each, evaluated as
"test the mcp" does (2026-10-07, with the chat backend of that time):

| Effort | Pass / partial / fail | Shortfalls from its own planning | Chat median / max | Reasoning tokens (32 runs) |
|---|---|---|---|---|
| none | 16 / 2 / 14 | 15 | 7 s / 20 s | 0 |
| `low` | 22 / 3 / 7 | 9 | 11 s / 142 s | 17,498 |
| `medium` | not evaluated | — | 24 s / 240 s | 117,414 |

At `low`, tests 01, 02, 04, 16, 18, 19, 24 and 26 pass that failed without reasoning; 12 (a new
group instead of a merge) got worse. The runs at `high` are not evaluated.

## The chat window

The chat window is the **AI Planning Assistant** of the planner (roomle-ui
`PlanningAssistantChat.vue`). With `?chat=true` the page creates the planner
with `featureFlags.planningAssistant`, and the button with the adjust icon at
the bottom of the planner opens the chat in the drawer, where it looks like the
other panels of the planner. The window shows the messages and the replies; the
planning assistant in the page runs the turns. The window hands every message to
the page with the planner callback `onPlanningAssistantPrompt`, and the planning
assistant passes the output of the turn to the window with
`planningAssistantOutput`, one part per call: the new text of the reply, the
running tool, the end of the turn or its error, whether the input is available,
and whether the window takes images (roomle-ui
`packages/embedding-lib/docs/homag-intelligence-embedding.md`, "The AI Planning
Assistant window"). A planner without the window gets no chat; the debug log
says "the planner has no AI Planning Assistant window - no chat". A page opened
with `?chat=true` without a model from the launcher shows the window unavailable,
with the message to start the example with `npm start <model> <api-key>`.

The **Show panel** checkbox shows and hides the debug panel (parameters,
buttons, console log).

The planning assistant keeps the conversation in the page. It requests the
prompts of the chat from the planner once —
`roomDesignerApi.extended.getExternalObjectAgentPrompts()`, the system prompt
and the image prompt of the roomle-ui glue logic. The window renders the replies
as **markdown** (bold, lists, headings, code) with [marked](https://marked.js.org)
and sanitizes them with [DOMPurify](https://github.com/cure53/DOMPurify). While
the model runs tools, the window's status line names the running tool
("assistant is working… get-plan-context"). Tools run in the page and can take
seconds to minutes (`get-plan-images` up to 120 s) — the status line is what
tells you the agent is still working. The tools log every call and every planner
call to the page console (`[hi-mcp] tool …`, `[hi-mcp] call …`).

### A chat turn

The planning assistant gives the model the system prompt of the planner (its
sentences in the [behaviour reference](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#4-how-a-tool-call-runs)),
the conversation and the HI MCP tools, and runs `streamText` in steps: a step is
one model call and the tool calls it returns.

- A turn has at most 16 steps. The last one runs with `toolChoice: 'none'`, so a
  turn that uses every step still ends with the model's answer instead of a tool
  result.
- A turn that fails ends with an error in the window (`The planning assistant
  failed: …`) and is left out of the conversation of later turns; the plan keeps
  what the tools changed.
- Invalid tool input and a failing tool reach the model as the tool's result
  with the text the MCP server would send, so the model can correct the call.

## Images in the chat

The chat takes an image only when the model reads images: `readsImages` of the
config, which the launcher sets for every Anthropic and Google model, every
`gpt-*` deployment on a Foundry resource, and from the other providers the ids in
`IMAGE_INPUT_MODELS` of `start.mjs`: `mistral-large-latest`,
`mistral-medium-latest`, `mistral-large-3`, `mistral-large-4-0`, `gpt-4o`,
`gpt-5-mini`, `gpt-5.4-mini` and `gpt-6-astra`. Any other id gets no image input.
That includes a pass-through `mistral-*` id and an Azure deployment named with
`HI_CHAT_MODEL`: an unknown model gets no image feature rather than a provider
error halfway through a turn.

In the window (only when the model reads images):

- **Drop**: the whole chat window catches a dropped file (header, messages
  and input), and a dashed outline marks it while a file is dragged over it.
  A file that is not an image, or
  that the browser cannot decode (HEIC in Chrome), is not attached; the status
  line says so. The input placeholder reads "Ask the assistant or drop an
  image...". One image per message: a new drop replaces the attached one, and
  only the latest drop is attached, even if an earlier one takes longer to
  prepare. A send waits for an image that is still being prepared, so it goes
  along with that message.
- **The image the model gets**: the window redraws the image as a JPEG
  (quality 0.9) with a long side of at most **1568 px**. That is the size
  Claude reads natively, and enough detail for every configured model. A
  smaller image keeps its size. The EXIF rotation of a phone photo is applied,
  and transparent parts become white.
- **Preview**: the attached image is shown small above the input, with a × to
  remove it. After sending, it is shown in the user's message.
- **Text**: an image can be sent with an empty input. The user's message then
  shows only the image, and the model gets the image prompt of the planner: "Plan
  the furniture in the image as close to it as possible - fetch the planning
  skill image-planning with get-skill and follow it."
- The images stay in the conversation and go along with every turn, so a
  follow-up can refer to the image. Every step of a turn sends them again (up
  to 16 times), which is why the window scales them down.

With images off, the window takes no dropped file and the chat is text-only.

### Images in tool results

`get-plan-images` returns its two renders as file parts of the tool result.
Anthropic, Google and Azure send those to the model as images. `@ai-sdk/mistral`
writes a tool result's content as JSON text — two renders were 1.5 to 2.1
million tokens of base64 against Mistral Large's 262k context. The planning
assistant of the embedding-lib does not move the images of a Mistral tool result
into a user message, so a Mistral model fails on a turn that calls
`get-plan-images`. Use a GPT, Claude or Gemini
model for plannings that look at the plan.

The tools keep their results small for every model: compact JSON without the
signed `imageUrl` of the master data
([behaviour reference §5.3](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#53-result-format)).

## Architecture

```
[Launcher: minimal-hi-example/start.mjs]
  ├── serves the example page on :3000
  └── serves the PlanningAssistantConfig (model, key, endpoint) at
      /planning-assistant-config.json, to this machine only
            │
            ▼
[Browser: index.html]
  ├── Planner with the AI Planning Assistant window (featureFlags.planningAssistant)
  │     onPlanningAssistantPrompt ──▶ planning assistant ──▶ planningAssistantOutput
  └── startPlanningAssistant of @roomle/embedding-lib/hi
        ├── the model via the @ai-sdk provider packages (from esm.sh)
        └── streamText with createHiMcpTools ──▶ roomDesignerApi.extended.callExternalObjectAgentTool (the tools run in the planner)
```

The page passes `startPlanningAssistant` a planner API that records the tool
calls the planner runs in `window.hiPlannerCalls` and the output of the window in
`window.hiPlanningAssistantOutput`; `window.hiAgentPlanContext(include)` answers
the plan context in the agent's words. The prompt runner of "test the mcp" reads
them (`.agents/scripts/run-hi-mcp-prompt.js`).

## Security notes

- The API key travels: CLI argument → launcher → `/planning-assistant-config.json`
  → the page, which calls the provider with it. The launcher serves the config to
  requests from this machine only, under a `localhost` or loopback Host, so a site
  whose name resolves to this machine (DNS rebinding) cannot read it (403
  otherwise), and keeps the key out of the page URL and its log.
- A CLI argument is visible in `ps` for the lifetime of the process — accepted
  for a local dev example.
- The key is in the page: anyone with the page open can read it in the browser.
  Acceptable for a local example on this machine, not for a hosted page.

## Troubleshooting

| Symptom | Cause and fix |
| ------- | ------------- |
| The window says there is no model for the planning assistant | The page was opened with `?chat=true` without a model — start with `npm start <model> <api-key>` |
| `unsupported model` when starting | The model name is not known — see the table above |
| `the planner has no AI Planning Assistant window - no chat` in the debug log | The planner UI has no planning assistant yet — start with `npm run dev` against a roomle-ui that has it, or a server URL whose planner has it |
| `failed to load: HI is not available` in the debug log, no chat | The planner was created without its HI module, so it has no prompts for the chat (`getExternalObjectAgentPrompts` rejects) |
| `AZURE_RESOURCE_NAME is required` | The `azure` provider needs the resource name env var and the deployment name in `HI_CHAT_MODEL` |
| `The planning assistant failed: …` in the window | The provider rejected the key or the model, or a Mistral model got the images of `get-plan-images` — check the key, or set `HI_CHAT_MODEL` |
| A dropped image is not attached | Images are off: the model is not known to read images |

## The chat in the ligna-store

The ligna-store runs the same planning assistant of the embedding-lib in the
planner's AI Planning Assistant window: `startPlanningAssistant` of
`@roomle/embedding-lib/hi`, with the HI MCP tools of the embedding-lib
(`createHiMcpTools`, D94 of the
[behaviour reference](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#3-decisions)), which call the planner of
the store page directly — no MCP server, no page bridge and no MCP client. The
store URL parameters `model` (default `gpt-6-astra`) and `api_key` turn into the
`PlanningAssistantConfig` (ligna-store `hi-mcp/chat-options.ts`), and the browser
calls the model with `api_key` directly (Mistral and the Foundry endpoint allow
browser CORS). Its reference is the ligna-store's `hi-mcp/README.md`; why a key
in the store URL is for a demo only:
[ADR 0003](../.agents/decisions/0003-the-ai-chat-is-an-mcp-client-beside-the-server.md).
Where the store's chat differs from this one is open in the
[backlog](../.agents/backlog/README.md#chat).

## Open follow-ups

The open work on the chat is in the [backlog](../.agents/backlog/README.md#chat).
