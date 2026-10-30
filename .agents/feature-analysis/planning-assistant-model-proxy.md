# The Planning Assistant through the model proxy of the HI server

> **Type**: Feature Analysis  
> **Status**: Open  
> **Date**: 2026-10-30  
> **Ticket**: [RML-18350](https://roomle.atlassian.net/browse/RML-18350)  
> **Base**: roomle-hi-example `feat/df-sales-portal-sc-example` (`5518e37`); roomle-ui
> `feat/hi-mcp-performance` (`cbf9b7b01`), the base of the roomle-ui change

**Affected repositories**

- **roomle-ui** (a branch off `feat/hi-mcp-performance`): the embedding-lib's planning assistant
  reaches an OpenAI-compatible endpoint with the host's headers and without a provider key, and
  moves the images of a tool result into a user message on Chat Completions; unit tests and the
  embedding-lib and `.agents/` documentation. A new embedding-lib dev build afterwards, only after
  asking.
- **roomle-hi-example**: `df-salesPortal_sc-example/index.html` reads `enableAIPlanning`, opens the
  AI Planning Assistant window and starts the planning assistant on the proxy, on the new
  embedding-lib dev build; its context document and the repository structure in `AGENTS.md`.
- **df-salesPortal** (HOMAG, Azure DevOps): the proxy is its pull request 130219; nothing changes
  there for this work. Its `salesConfigurator/test01/wwwroot/index.html` takes over the page's
  change.
- **Unchanged:** the planner (web-sdk) — the tools, the prompts and the window come with the
  planner at `https://www.roomle.com/t/bo-test/`; the ligna-store.

## 1. What was asked and why

The sales configurator page of the HOMAG df-salesPortal is to get the AI Planning Assistant — the
chat that plans with the HI tools. Its backend now acts as a proxy for the model: the page talks to
the backend, and the backend adds the provider key and resolves the model and its endpoint, so
neither reaches the browser. The developer of the backend asks us to integrate the chat into the
page; our copy of that page is `df-salesPortal_sc-example/index.html`.

What the backend provides (ticket description, pull request 130219 "Feature/aiPlanningData"):

| Part | What it is |
|---|---|
| `POST /api/ai/v1/chat/completions` | OpenAI Chat Completions, JSON or SSE, one completion per request. Forwards the messages, tool definitions and tool results and the common generation parameters; executes no tools; other provider-specific fields are not forwarded |
| `POST /api/chat` | An AI SDK UI message stream for `useChat`: text messages only, rejects tool and attachment parts |
| `POST /api/ai/v1/images/generations`, `/images/edits` | Image generation and editing (`AIFeatures.Rendering`) |
| Model aliases | `assistant` or `planning` → `AIFeatures.Planning`; `rendering` → `AIFeatures.Rendering`. The answer carries the alias, not the model id |
| Authentication | The Basic authorization of the HI server. The user must belong to exactly one backend configuration, else 401; a backend without the AI feature answers 503. No `backendId` parameter |
| Configuration | Per backend in the appsettings: `AIFeatures.Planning` and `.Rendering`, each with `Endpoint`, `ApiKey` and `Model` (the deployment name on an Azure AI Foundry resource) |
| Feature flags | `GET /backends/list` answers `enableAIPlanning` and `enableAIRendering` per backend |
| Not in it | The Responses API ("models requiring the Responses API need an additional adapter"); per-user rate limits, quotas and budgets |

The ticket also warns: the page must not configure a provider `apiKey`, because the AI SDK would
then replace the Basic authorization with a Bearer one.

**Observed on 2026-10-30** against `https://dfscfgtest01-app.azurewebsites.net`, without credentials
and without a model call: the preflight of `/api/ai/v1/chat/completions` answers 204 with
`access-control-allow-origin: *`, `access-control-allow-methods: POST` and the requested headers
echoed; a POST without authorization answers 401 with `WWW-Authenticate: Basic`. The route is
deployed on the test server, and a page on another origin (`localhost`, GitHub Pages) can call it
with an explicit `Authorization` header.

## 2. How it works today

### 2.1 The sales configurator page

`df-salesPortal_sc-example/index.html`:

- imports `@roomle/embedding-lib@6.10.0` and its `hi.js` from unpkg (`:90`, `:95`). The `hi.js` of
  6.10.0 — and of the latest release 8.2.1 — exports no `startPlanningAssistant`; only the
  `9.0.0-alpha` versions and the dev builds do;
- holds the HI server's Basic authorization in the page (`getHiAuthData`, `:105`) and uses it for
  the HI proxy (`proxy_request?url=`, `:103`), the prices and the order;
- hardcodes the library, plan, configuration, catalogs and user rights (`:107`–`:122`) and reads
  nothing from `/backends/list`;
- creates the planner without `featureFlags.planningAssistant` (`:162`), so the planner has no
  AI Planning Assistant window.

### 2.2 The planning assistant of the embedding-lib

roomle-ui `packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts` on
`feat/hi-mcp-performance`:

- **`PlanningAssistantConfig`** (`:20`) is a JSON object: `provider` is `azure`, `openai`,
  `mistral`, `anthropic` or `google`; `apiKey` is required; `baseUrl`, `chatCompletions` and
  `reasoningEffort` apply to `azure` only. There is no way to send a header of the host.
- **`loadChatModel`** (`:91`) creates each provider with its key: `createOpenAI({ apiKey })` on
  OpenAI's Responses API, `createAzure({ apiKey, baseURL })` on the Responses API or with
  `chatCompletions` on Chat Completions, and the Mistral, Anthropic and Google providers. Every
  one of them authenticates with the key (`Authorization: Bearer`, `api-key`, `x-api-key`, …). An
  unknown provider throws (`:158`).
- **Responses only:** the continuation with `previousResponseId` (`:398`–`:400`) and the
  `referenceCacheBreakpoint` (`:212`) apply to `openai` and to `azure` without `chatCompletions`;
  every other provider sends the whole history with every step.
- The usage record names `config.provider` and the model (`:501`); the window offers the image
  drop with `readsImages` (`:528`).

The hosts: the sign-in example (`hi-sc-example`) takes provider, model and key from its form
(`model-config.ts`); the minimal example from its launcher (`/planning-assistant-config.json`).
Both put the provider key into the browser.

### 2.3 Images in tool results on Chat Completions

`get-plan-images` answers its renders as image parts, which `mcpToModelOutput`
(`hi-mcp-tools.ts:49`) hands to the AI SDK as file parts of a `content` tool output. The Chat
Completions converters write such an output as JSON text:

- `@ai-sdk/openai@4.0.81` (under `@ai-sdk/azure` with `chatCompletions`):
  `contentValue = JSON.stringify(output.value)` for `content`;
- `@ai-sdk/openai-compatible`: the same, unless `supportsMultiPartToolContent` is set.

The model then gets about 0.2 MB of base64 text per call instead of two images
([Images in tool results](../../docs/ai-chat.md#images-in-tool-results)) — the defect the backlog
item "Images of a tool result for Mistral" describes for `@ai-sdk/mistral`. The Chat Completions
API takes text only in a tool message, so `supportsMultiPartToolContent` does not help: the
images have to go into a user message.

## 3. The gap

1. **The embedding-lib cannot reach the proxy.** No provider talks Chat Completions to a given
   base URL with the host's `Authorization` header and no key. `azure` and `openai` require a key
   and authenticate with it.
2. **Plan images reach the model as text** on every Chat Completions path — the proxy's only API.
   The planning model of the proxy is a GPT deployment that reads images; through the proxy it would
   get base64 text instead.
3. **The page has no chat:** an embedding-lib without the planning assistant, no window, no flag.
4. **To be verified with a model:** whether the deployment behind the proxy (`gpt-6-astra` in the
   backend's configuration) answers Chat Completions with tools — the minimal example runs it on
   the Responses API — and whether the proxy forwards `reasoning_effort` and
   `stream_options.include_usage`. Without `reasoning_effort` the deployment's default applies;
   without the usage option the usage record stays `unavailable`.

## 4. Proposed design

### 4.1 roomle-ui: an OpenAI-compatible provider

A new provider `openai-compatible` in `PlanningAssistantConfig` — any endpoint that speaks OpenAI
Chat Completions, not only this proxy:

```ts
{
  provider: 'openai-compatible',
  baseUrl: 'https://dfscfgtest01-app.azurewebsites.net/api/ai/v1',
  model: 'planning',
  headers: { Authorization: 'Basic …' },
  readsImages: true,
}
```

- `baseUrl` is required for it; `apiKey` becomes optional for it (when given, it is sent as Bearer,
  as the AI SDK does); a new `headers` field — a plain object of strings, so the config stays JSON —
  goes with every model request.
- `loadChatModel` creates it with `createOpenAICompatible({ name, baseURL, headers, includeUsage:
  true, ...transport })(model)` from esm.sh, pinned to `@ai-sdk/openai-compatible@3.0.59` — the
  version on `@ai-sdk/provider@4.0.19` and `@ai-sdk/provider-utils@5.0.51`, as `ai@7.0.122` and
  `@ai-sdk/openai@4.0.81` — with the same `zod` as the other packages.
- `includeUsage` asks for the usage in the stream, so the usage record has its counts.
- The Responses-only paths stay off for it: the continuation check (`:398`) and the cache
  breakpoint (`:212`) do not name it.

### 4.2 roomle-ui: the images of a tool result into a user message

A `wrapLanguageModel` middleware in the planning assistant, for the providers whose API takes no
images in a tool result: `openai-compatible`, `azure` with `chatCompletions` and `mistral`. Before
each request it takes the file parts out of the tool results of the prompt, leaves a text in their
place ("The images follow in the next message"), and adds them as a user message right after the
tool messages, which Chat Completions allows. The tool results in the history stay as they are, so
the move repeats for each request. Including `mistral` closes the backlog item "Images of a tool
result for Mistral" in the same change.

### 4.3 roomle-hi-example: the sales configurator page

In `df-salesPortal_sc-example/index.html`:

1. Both imports on the new dev build, `@roomle/embedding-lib@0.0.0-dev-<sha>`.
2. In the SC settings, the proxy's base URL beside the HI server's
   (`getAiProxyBaseUrl = () => 'https://dfscfgtest01-app.azurewebsites.net/api/ai/v1'`) and the
   alias `planning`. In the df-salesPortal deployment the page and the backend share one origin, so
   there the URL is relative.
3. Before the planner: `GET <HI server>/backends/list` with the Basic authorization;
   `enableAIPlanning` of the user's backend switches the chat on. The proxy serves only a user with
   exactly one backend, so the page reads the single entry and leaves the chat off for any other
   answer.
4. `featureFlags.planningAssistant: enableAIPlanning` in the planner options.
5. With the flag, after `createPlanner`: `startPlanningAssistant(instance, config, signal)` with the
   config of 4.1 — the page's own `getHiAuthData()` as the `Authorization` header, no key.
   `readsImages: true`: the page does not know the model behind the alias, and the configured
   planning model reads images.

### 4.4 Tests

- roomle-ui, beside `tests/unit/embedding-lib/homag-intelligence/hi-planning-openai.spec.ts` (which
  mocks the esm.sh import with the npm package and stubs `fetch`): a request of the
  `openai-compatible` provider goes to `<baseUrl>/chat/completions` with the host's
  `Authorization` header and no Bearer or `api-key` header, the alias as `model` and
  `stream_options.include_usage`; a later step sends no `previous_response_id`; a config without
  `baseUrl` fails setup with a message. This needs `@ai-sdk/openai-compatible@3.0.59` as a dev
  dependency of roomle-ui.
- roomle-ui: the middleware moves the images of a tool result into a user message for
  `openai-compatible`, `azure` with `chatCompletions` and `mistral`, keeps the tool result's text,
  and leaves the prompt of `azure` on Responses, `anthropic` and `google` unchanged.
- roomle-hi-example: the page is inline HTML without unit tests, like the minimal example. Its
  check is a live run (section 6).

## 5. Alternatives considered

| Alternative | Why not |
|---|---|
| The ticket's option 1: `useChat` against `/api/chat` | The route takes text messages only and rejects tool parts; the planning assistant runs the HI tools in the page and needs tool calls and results |
| `azure` with the proxy as `baseUrl` and `chatCompletions` | `createAzure` requires a key and sends it as `api-key`; the proxy is no Foundry resource; the Basic header would need the same new `headers` field anyway |
| `openai` with a `baseURL` and `.chat()` | `createOpenAI` requires a key and sends `Authorization: Bearer`, which the host header would have to overwrite; `openai` means OpenAI's Responses API, and the continuation keys on it |
| A custom `fetch` in the config | A function breaks the config as a JSON object; a `headers` object carries the authorization as well |
| `supportsMultiPartToolContent` instead of the middleware | The Chat Completions API takes text only in a tool message |
| A Responses route in the proxy | Not offered; it is the backend's decision, and the proxy names it an additional adapter |
| The sign-in example on the proxy too | Not asked: the ticket names the sales configurator page. It could use the proxy when its backend has `enableAIPlanning` and no model is entered |

## 6. Verification, risks and open points

- **A live run needs a go**, because it calls the model: one turn of the page on the proxy that
  creates a kitchen and looks at it with `get-plan-images` — tool calls, streaming, the usage record
  and the images as images (section 3, point 4).
- **The embedding-lib dev build needs a go** before it is started (the hard rule of `AGENTS.md`).
  Before the live run, check that the pinned build carries the provider.
- **Credentials.** With `enableAIPlanning`, the HI user's Basic authorization also pays for model
  calls, and the proxy has no rate limits or budgets yet. The example user's password is in the
  page of this public repository, so anyone can use it. The AI feature should not be enabled for a
  user whose password is public; the password is to be changed on the HI server.
- **Performance.** Without the Responses continuation every step sends the whole history; Azure
  caches a repeated prefix of Chat Completions on its own. Timings of the page are not comparable
  with the benchmarks of `gpt-6-astra` on the Responses API.
- **Not in scope:** AI rendering (`enableAIRendering`, `/api/ai/v1/images/*`) — neither the
  embedding-lib nor the page has a consumer for it.

## 7. Code and documents the work touches

| Repository | File | Change |
|---|---|---|
| roomle-ui | `packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts` | `openai-compatible` provider, `headers`, optional `apiKey`; the image middleware |
| roomle-ui | `tests/unit/embedding-lib/homag-intelligence/` | a spec of the provider and of the middleware |
| roomle-ui | `package.json` | dev dependency `@ai-sdk/openai-compatible@3.0.59` |
| roomle-ui | `packages/embedding-lib/docs/homag-intelligence-embedding.md` | the config table, an example with the proxy |
| roomle-ui | `.agents/homag-intelligence/agent-architecture.md` | the provider list of `loadChatModel`, `PlanningAssistantConfig` |
| roomle-ui | `.agents/homag-intelligence/prompt-caching.md` | the new provider among those without continuation |
| roomle-hi-example | `df-salesPortal_sc-example/index.html` | the flag, the window, the planning assistant on the proxy, the dev build |
| roomle-hi-example | `.agents/context/df-sales-portal-sc-example.md` (new), `.agents/context/README.md` | the page and its chat |
| roomle-hi-example | `AGENTS.md` | `df-salesPortal_sc-example/` in the repository structure |
| roomle-hi-example | `docs/ai-chat.md`, `.agents/backlog/README.md` | images in tool results on Chat Completions; the Mistral item removed with 4.2 |

## 8. Decisions for the review

1. The provider name `openai-compatible` with `baseUrl` and `headers` (4.1).
2. The image middleware in this change, with `mistral` included (4.2).
3. The flag from the single entry of `/backends/list`; the chat off for any other answer (4.3).
4. `readsImages: true` in the page, or a flag of the backend for it.
