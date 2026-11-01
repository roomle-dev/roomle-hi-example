# AI Chat in the Example — Reference

With a planning-assistant build that supports shared reference, common rules and compact library
data precede the conversation. Library data refreshes each turn; the assistant also reads the plan
state of the turn — rooms, groups, obstacles and installation elements — at the start of every
turn and sends it after the conversation, before the new message, so the model's first call can be
the change. Azure may reuse matching input computation automatically, but every
request still transmits its content. Cache-read/write coverage and request bytes are separate
measurements in test reports; missing counts are not zero. See the
[implementation and decisions](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/prompt-caching.md)
and [local-build setup](setup/unreleased-embedding-lib.md).

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
loads the pinned embedding-lib dev build from the npm CDN
([unreleased-embedding-lib.md](setup/unreleased-embedding-lib.md)).
Supported providers: **Azure OpenAI** (`azure`), **OpenAI** (`openai`), **Mistral** (`mistral`),
**Anthropic (Claude)** (`anthropic`), **Google (Gemini)** (`google`), any OpenAI-compatible endpoint
(`openai-compatible`) and, without a model, the [model proxy](#the-model-proxy) of the HI server.

The planner's prompt asks the model to begin a planning turn with one short sentence about the
requested action, in the user's language, before detailed planning. It streams through the same
answer as the later confirmed result, while tools run in between. Simple answers and necessary
clarifications are direct. The time until that opening arrives depends on the model and provider;
it is separate from the first change to the plan and the completed answer. The prompt comes from
the planner when the chat starts, so a planner prompt update needs a new chat session.

## Running it

```bash
npm start azure:gpt-6-astra "$AZURE_GPT_KEY"                     # a deployment on the HI Azure AI Foundry resource
npm start azure:gpt-5-mini "$AZURE_GPT_KEY" -- --reasoning-effort high
npm start mistral:mistral-large-4 "$MI_API_USAGE_KEY"            # the Mistral API
npm start anthropic:claude-sonnet-4-5 "$ANTHROPIC_API_KEY"
npm start google:gemini-2.5-pro "$GEMINI_API_KEY"                # Gemini API key from Google AI Studio
npm start openai:<model-id> "$OPENAI_ASSISTANT_API_KEY"          # the OpenAI Responses API
npm run dev azure:gpt-6-astra "$AZURE_GPT_KEY"                   # same, planner from the local Rubens UI dev server (:5173)
npm start                                                         # no model: only the example, no AI planning assistant (chat=false)
```

The model is `<provider>:<model-id>`: a provider of the embedding-lib — `anthropic`, `azure`,
`google`, `mistral`, `openai` or `openai-compatible` — and the exact model id at that provider, for
`azure` the deployment name. The launcher maps no names: the id goes to the provider as written,
with its case and any further colons (`openai:ft:gpt-4o:org:name:id`). A model without its provider
(`npm start mistral …`, `npm start gpt-6-astra …`), an unknown provider, an empty id and a model
without a key are rejected before the page starts. An id the provider does not have fails when the
chat calls it, as the error of the first turn. Choose a model that supports the tools and image
inputs the planning assistant uses.

The options of a model follow its key. `npm start` passes them on after `--`
(`npm start azure:gpt-5-mini "$AZURE_GPT_KEY" -- --reasoning-effort high`):

| Option | Provider | Effect |
| ------ | -------- | ------ |
| `--base-url <url>` | `azure`, `openai-compatible` | The endpoint. `azure` defaults to the HI Azure AI Foundry resource, `https://dfhifoundrysweden.services.ai.azure.com/openai/v1`; `openai-compatible` requires it |
| `--reasoning-effort <effort>` | `azure` | The reasoning effort; without it, the deployment's default |
| `--chat-completions` | `azure` | Chat Completions instead of the Responses API |
| `--cache-breakpoint` | `azure` on Responses | The cache boundary after the library reference |

The models of the tests (`models` of `docs/test-prompts.json`, which the test runner passes to the
launcher with these options):

| Model | Key | Options |
| ----- | --- | ------- |
| `azure:gpt-6-astra` | `$AZURE_GPT_KEY` | `--cache-breakpoint` |
| `azure:gpt-5-mini`, `azure:gpt-5.4-mini` | `$AZURE_GPT_KEY` | `--reasoning-effort high` |
| `azure:gpt-6.1-sol` | `$AZURE_GPT_SOL_KEY`, the key of its own Foundry resource | `--base-url https://controller-mes-resource.services.ai.azure.com/openai/v1 --cache-breakpoint` |
| `azure:mistral-large-3` | `$AZURE_GPT_KEY` | `--chat-completions` |

The launcher (`minimal-hi-example/start.mjs`, `planningAssistantConfig`) turns the model, the key
and the options into the `PlanningAssistantConfig` of the embedding-lib — the provider, the model,
the key, the endpoint, the API, the reasoning effort and the cache breakpoint, and `readsImages`,
which is `true` for every model. It serves the config to the page at
`/planning-assistant-config.json`, to this machine only, and opens the page with an explicit
`chat` parameter: `&chat=true` with a model, so the planner shows the button of the chat window,
and `&chat=false` without one, so plain `npm start` and `npm run dev` start only the example,
without the AI planning assistant — even when the HI server offers the model proxy. Without a
`chat` parameter at all (the page served by another static server) the model proxy decides. Guarded
by `minimal-hi-example/tests/start.test.js`.

## The model proxy

The chat runs on the model proxy of the HI server when the page has no `chat` parameter: the model,
its endpoint and its key stay in the backend, and the page authorizes with the Basic authorization
of the HI server. The page uses it when `/backends/list` answers exactly one backend and that
backend's `enableAIPlanning` is `true` — the proxy serves only a user of exactly one backend. The
launcher always appends `chat=false` without a model, so the example it opens never takes the proxy;
the page's user `test` has several backends, so without the parameter there is no chat either.

The page passes the planning assistant the provider `openai-compatible` with the base URL
`https://dfscfgtest01-app.azurewebsites.net/api/ai/v1`, the model name `planning` (the alias of the
backend's planning model), the header `Authorization` and no key. The proxy speaks Chat
Completions: every step sends the whole conversation, and the images of a tool result go to the
model in a user message after it. The sales portal example and the sign-in example use the proxy
the same way ([roomle-ui `homag-intelligence-embedding.md`](https://github.com/roomle-dev/roomle-ui/blob/master/packages/embedding-lib/docs/homag-intelligence-embedding.md),
"The AI Planning Assistant agent").

## Azure deployments

An `azure` model is a deployment on the HI Azure AI Foundry resource, called through its OpenAI v1
endpoint with the resource's API key; `--base-url` names a deployment on another resource. A base
URL ends in `/openai/v1`: the AI SDK appends `/responses` or `/chat/completions` itself. The chat
sets no `temperature`: the GPT deployments are reasoning models and reject it.

**API per deployment.** The Foundry GPT deployments use the Responses API, which
supports image input, function tools and reasoning together. GPT-6 Astra tool
calls require Responses; omitting reasoning effort retains the deployment default
and does not make Chat Completions compatible.
[Official OpenAI documentation](https://developers.openai.com/api/docs/guides/latest-model).
Foundry `mistral-large-3` runs with `--chat-completions`: its Responses endpoint rejects image
input.

**Cache breakpoint.** With an embedding-lib that supports shared reference caching,
`--cache-breakpoint` opts a deployment in to a cache boundary after the library reference; the
tests give it to `gpt-6-astra` and `gpt-6.1-sol`, deployments verified to support explicit
breakpoints. Without it a deployment keeps its default cache behavior. The complete prompt is still
sent on each request; this option concerns provider processing, not upload size. Integration
details and compatibility restrictions are in the
[prompt-caching reference](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/prompt-caching.md).

**Reasoning effort.** The tests give the lightweight deployments gpt-5.4-mini and gpt-5-mini the
reasoning effort `high` (`reasoningEffort` of their entries in the test JSONs,
`--reasoning-effort high` on the command line): accuracy goes over speed, and they plan worse than
gpt-6-astra. gpt-6-astra and gpt-6.1-sol run at their default. The option applies to `azure`
models; Mistral, Anthropic and Google models get none. The defaults measured on the Foundry resource
(2026-10-07): gpt-5.4-mini does not reason (0 reasoning tokens in every step), gpt-5-mini and
gpt-6-astra reason as at `medium`. gpt-5-mini and gpt-5.4-mini read images and have a 400k context
window.

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
`PlanningAssistantChat.vue`). With `?chat=true` — or the model proxy when no `chat` parameter is
given — the page creates the planner
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
with `?chat=true` without a model from the launcher and without the model proxy shows the window
unavailable, with the message to start the example with
`npm start <provider>:<model-id> <api-key>`.

The arrow button at the very left of the top bar shows and hides the debug
panel (parameters, buttons, console log) — chevron right while the panel is
hidden, chevron left while it is shown. The top bar follows the roomle-ui
look (Lato, white bar, pill buttons, red primary button), as
`minifabric-example/src/style.css` styles its panel.

The planning assistant keeps the conversation in the page. It requests the
prompts of the chat from the planner once —
`roomDesignerApi.extended.getExternalObjectAgentPrompts()`, the system prompt
and the image prompt of the roomle-ui glue logic. The window renders the replies
as **markdown** (bold, lists, headings, code) with [marked](https://marked.js.org)
and sanitizes them with [DOMPurify](https://github.com/cure53/DOMPurify). While
the model works, the window's status line names the tool it calls, as soon as the model starts
writing the call ("assistant is working… create-or-replace-groups", seconds before the groups
appear). Tools run in the page and can take
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

The chat takes an image when the model reads images: `readsImages` of the config, which the
launcher and the model proxy set for every model. A model that does not read images answers a
dropped image with a provider error, as the error of the turn — choose a model with image input
for plannings from images.

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

### Images in tool results

`get-plan-images` returns its two renders as JPEG file parts of the tool
result, about 0.2 MB of base64 for a kitchen. Anthropic, Google and Azure on the Responses API
send those to the model as images; on an OpenAI-compatible endpoint (the model proxy) the
planning assistant moves them into a user message after the tool result, because Chat
Completions takes text only in a tool message — as JSON text there, the renders would take a
large part of the model's context. The pinned dev build `0.0.0-dev-4c2797a` does not move them
for Mistral yet: there a Mistral model still gets the renders as base64 text, and a turn that
looks at the plan can end on the context overflow. From the dev build that carries the
roomle-ui fix on, Mistral is treated like an OpenAI-compatible endpoint.

The tools keep their results small for every model: compact JSON without the
signed image URLs of the master data and the order data
([behaviour reference §5.3](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#53-result-format)).

## Architecture

```
[Launcher: minimal-hi-example/start.mjs]
  ├── serves the example page on :3000 (the next free port when it is taken), opened with
  │   chat=false without a model — only the example, no AI planning assistant
  └── serves the PlanningAssistantConfig (model, key, endpoint) at
      /planning-assistant-config.json, to this machine only, with chat=true; without a chat
      parameter at all, the page takes the model proxy of the HI server
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
- On the model proxy no provider key reaches the page: the page sends the Basic
  authorization of the HI server, which then also pays for the model calls.

## Token usage

The assistant logs input, output and total tokens for each submitted prompt in the browser console.
The [test reports](test-prompts.md#token-counts-in-reports) show those counts per prompt and per test.
They include all calls of the turn, including tools and the final answer. Coverage can be complete,
partial or unavailable: a provider failure may leave some consumption unreported. Unknown counts
are not zero. These are usage measurements, without a price calculation.

## Troubleshooting

| Symptom | Cause and fix |
| ------- | ------------- |
| The window says there is no model for the planning assistant | The page was opened with `?chat=true` without a model and without the model proxy — start with `npm start <provider>:<model-id> <api-key>` |
| `… is no <provider>:<model-id>` when starting | The model has no provider or an unknown one — write it as `<provider>:<model-id>`, for example `azure:gpt-6-astra` |
| No chat window without a model | Expected: `npm start` without a model opens the page with `chat=false` — start with a model for the chat; without a `chat` parameter the model proxy needs exactly one backend of the user with `enableAIPlanning` |
| `the planner has no AI Planning Assistant window - no chat` in the debug log | The planner UI has no planning assistant yet — start with `npm run dev` against a roomle-ui that has it, or a server URL whose planner has it |
| `failed to load: HI is not available` in the debug log, no chat | The planner was created without its HI module, so it has no prompts for the chat (`getExternalObjectAgentPrompts` rejects) |
| `The planning assistant failed: …` in the window | The provider rejected the key or the model id, the model reads no images, or a Mistral model got the images of `get-plan-images` — check the key, the exact model id and `--base-url` |

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
