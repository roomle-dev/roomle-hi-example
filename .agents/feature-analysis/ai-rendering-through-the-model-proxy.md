# The AI image chat through the model proxy of the HI server

> **Type**: Feature Analysis  
> **Status**: Open  
> **Date**: 2026-10-30  
> **Ticket**: [RML-18350](https://roomle.atlassian.net/browse/RML-18350)  
> **Base**: roomle-hi-example `feat/df-sales-portal-sc-example` (`3fc3142`); roomle-ui
> `feat/planning-assistant-model-proxy-RML-18350` (`4c2797aeb`, `feat/hi-mcp-performance` with
> `master` merged and the `openai-compatible` provider of the planning assistant)

**Affected repositories**

- **roomle-ui** (on `feat/planning-assistant-model-proxy-RML-18350`): the AI image chat of the
  Rubens UI generates its images through the host page when the host offers it — a callback and an
  output method in the web-sdk, a host mode in the chat's store, and in the embedding-lib a function
  that answers the callback with the proxy's `images/edits`; unit tests and the AI image chat
  reference. The Rubens UI and web-sdk parts reach the pages only with a **bo-test deployment**; the
  embedding-lib part needs a **new embedding-lib dev build**.
- **roomle-hi-example**: `df-salesPortal_sc-example/index.html` reads `enableAIRendering` and starts
  the image generation on the proxy; its context document.
- **df-salesPortal** (HOMAG, Azure DevOps): the proxy's image routes are its pull request 130219;
  nothing changes there for this work. Its `salesConfigurator/test01/wwwroot/index.html` takes over
  the change of the page.
- **Unchanged:** the HI tools and the planning assistant; the ligna-store.

## 1. What was asked and why

RML-18350 asks to integrate "the AI stuff" of the sales configurator through the backend's model
proxy, so that neither the provider key nor the model or its endpoint reaches the browser. The proxy
serves two features, and both are switched per backend:

| Feature | Flag in `/backends/list` | Routes | Model alias | Configuration |
|---|---|---|---|---|
| Planning | `enableAIPlanning` | `POST /api/ai/v1/chat/completions` (and `/api/chat`) | `planning`, `assistant` | `AIFeatures.Planning` |
| Rendering | `enableAIRendering` | `POST /api/ai/v1/images/edits` (multipart), `POST /api/ai/v1/images/generations` (JSON) | `rendering` | `AIFeatures.Rendering` (`gpt-image-2.5-sunburst` in the ticket's screenshot) |

The planning part is implemented (the `openai-compatible` provider, roomle-ui `4c2797aeb`; the sales
portal page, the sign-in and the minimal example). **The rendering part was left out of the first
analysis with one line that called it out of scope and claimed nothing consumes it. That was wrong:
the Rubens UI has an AI image chat, with its own button at the bottom of the planner, and it
generates exactly what the proxy's rendering routes serve.** This analysis covers that part.

From the ticket, for the image routes: Azure GPT image models returning `b64_json`; a URL answer is
rejected; `response_format: 'b64_json'` is accepted and dropped upstream; other response formats and
streaming are rejected; 1–4 images per request; a 25 MiB body limit and a ten-minute timeout; image
answers are buffered. The older HI server endpoint `/image/edit` with the global `AiFoundry`
configuration stays as it is — "existing UI callers must switch to the new route". No caller of
`/image/edit` exists in roomle-ui, the ligna-store or roomle-hi-example (searched).

## 2. How it works today

### 2.1 The AI image chat of the Rubens UI

- **The button and the panel.** With `featureFlags.imageGen` the planner shows `AiChatButton`
  (`data-test-id="ai-chat-button"`, the first of the bottom buttons, `src/planner/components/PlannerMain.vue:26`)
  and registers the panel `AiImageChat` (`src/planner/components/PlannerSidebar.vue:64`); the
  configurator has the same chat (`src/configurator/components/ConfiguratorMain.vue:15`, `:34`).
  `isImageGenEnabled` reads `initData.featureFlags.imageGen` (`src/configurator/store/ui-state-store.ts:154`).
- **Observed on the sales portal page** (headless Chromium, 2026-10-30, no render sent): the page
  sets no `imageGen` flag, yet the button is there, so the remote config of the configuration
  `948zg40lbmdbthwcoym0m1e4coqa55z` switches it on. The button opens "AI IMAGE ASSISTANT" with a
  **Log in** form.
- **Login.** `AiImageChat.vue:9` shows `AiChatLogin` while `isAuthenticated` is false, which is
  `authToken !== ''` (`src/common/store/ai-chat-store.ts:318`): a Roomle account token from the
  Rapi, kept in `localStorage`. It applies to every path below, the Sunburst escape hatch included.
- **The two paths of a render** (`send`, `ai-chat-store.ts:395`, the choice at `:452`):
  1. **Roomle's img-gen backend** (`generateImage`, `src/common/utils/img-gen.ts:243`): multipart
     to `app.alpha.roomle.com` or `app.roomle.com` `/b2c-api/v1/img-gen` with the Rapi token; the
     backend picks the model (`imageGenConfig.model`: `sunburst`, `sunburst-foundry`, Gemini models)
     with Roomle's own keys. The host is a fixed table (`IMG_GEN_URLS`, `img-gen.ts:10`), chosen by
     `imageGenConfig.stage`.
  2. **Sunburst from the browser** (`generateSunburstImage`, `img-gen.ts:309`): with the URL
     parameter `?sunburst=<OpenAI key>` or `?sunburstLocal=<HOMAG Foundry key>`
     (`takeSunburstKeys`, `ai-chat-store.ts:42`), multipart `POST <host>/images/edits` with
     `model: gpt-image-2.5-sunburst`, `prompt`, `size` (`1536x1024`, `1024x1536` or `1024x1024`),
     `quality: medium` and `image`; the answer's `data[0].b64_json` is the image. A key check
     `GET <host>/models` runs once before the first upload (`checkSunburstKey`, `img-gen.ts:289`;
     404 counts as unknown). The key sits in the URL — the reference names it a demo escape hatch.
- **What a render sends:** a capture of the plan (a photo camera at eye level, 2048 px on the long
  edge, JPEG), the prompt with the material legend, the light facts and the staging list; a
  follow-up edits the last result instead of a new capture. Reference: roomle-ui
  `packages/embedding-lib/docs/ai-image-chat.md`.
- **Init data never carries a URL for it.** The settings follow the init-data priority — query
  parameters beat embedding options beat the remote config beat the defaults — and merge field by
  field. The reference states for `stage`: "A fixed table, never a URL from init data", so a link
  cannot send the upload and the token to another host.

### 2.2 The proxy, observed

On `https://dfscfgtest01-app.azurewebsites.net` (2026-10-30, without a model call):
`GET /api/ai/v1/models` with the Basic authorization answers 404; the preflight of
`/api/ai/v1/images/edits` answers 204 with `access-control-allow-origin: *` and the requested
headers. `/backends/list` sends neither `enableAIRendering` nor `enableAIPlanning` for the user of
the page yet.

### 2.3 How the planner reaches its host page today

- **The planning assistant** (roomle-ui, `4c2797aeb`): the window lives in the planner, the agent in
  the host page. The window fires `callbacks.onPlanningAssistantPrompt` (web-sdk
  `common-core/src/utils/ui-callback.ts:74`, `PlanningAssistantChat.vue:230`), the host answers
  with `planningAssistantOutput` (`planner-core/src/roomle-planner.ts:3258`, the configurator's
  twin in `configurator-core`), and `startPlanningAssistant` of the embedding-lib
  (`hi-planning-assistant.ts:275`) implements the host side with the page's config — the proxy's
  base URL and the `Authorization` header never enter the init data.
- **The HI library callbacks** (`setupHi`, embedding-lib `homag-intelligence/hi-setup.ts`): the host
  exposes `onLoadArticleCatalog`, `onFetchPrice` and the others over a comlink port, and the
  planner awaits their answers — credentials stay in the host page.

## 3. The gap

1. **No way to the proxy.** The chat reaches Roomle's backend (Rapi token) or a Sunburst host whose
   key comes from the URL. It has no path that authorizes with the host page's credentials and asks
   for the model alias `rendering`.
2. **The login blocks it.** Without a Roomle account the chat shows only the login form, on every
   path.
3. **A URL in init data would open a hole.** An option such as `imageGenConfig.imagesApi.baseUrl`
   set by the page would be overridable by a query parameter, field by field: a crafted link could
   keep the page's `Authorization` header and redirect the upload — with the HOMAG credentials — to
   any host. This is what the fixed `IMG_GEN_URLS` table prevents today.
4. **The page does not use the flag.** `df-salesPortal_sc-example/index.html` reads
   `enableAIPlanning` only.

## 4. Proposed design

The pattern of the planning assistant: the chat stays in the planner, the request runs in the host
page with the host's credentials.

### 4.1 roomle-ui, web-sdk: a callback and an output

- `ImageGenRequest` `{ id, prompt, image }` — `image` the JPEG of the render as a data URL, as
  `PlanningAssistantPrompt` carries its images — and `ImageGenOutput`, one part per call:
  `{ type: 'availability', available, text? }` and `{ type: 'result', id, image?, text? }`
  (`image` a data URL of the answer, `text` an error or a message). Beside `planning-assistant.ts`
  in `common-core`.
- `callbacks.onImageGenRequest(request)` in `ui-callback.ts`, forwarded to the host like
  `onPlanningAssistantPrompt`; `onImageGenOutput(part)` not forwarded.
- `imageGenOutput(part)` on the planner (`roomle-planner.ts`) and the configurator
  (`roomle-configurator.ts`), which calls `onImageGenOutput` — the twin of `planningAssistantOutput`.

### 4.2 roomle-ui, Rubens UI: a host mode of the AI image chat

In `ai-chat-store.ts`:

- `hostAvailable` follows the `availability` parts of `onImageGenOutput`. While it is true the chat
  is in **host mode**: `isAuthenticated` is true (no Roomle login), and `send` fires
  `onImageGenRequest` with a new `id` and the prompt the Sunburst path builds (the material legend
  inside), then waits for the `result` of that `id`. The image becomes the entry's image; `text`
  becomes its text, as an error on the other paths does.
- A reset or **New session** stops waiting: a late `result` of an earlier `id` is dropped.
- Host mode wins over `?sunburst=` / `?sunburstLocal=` and over the img-gen backend. Without a host
  report the chat behaves as today.
- Nothing new in the init data: the host mode exists only while the host page reports it, so no
  query parameter can switch or redirect it.

### 4.3 roomle-ui, embedding-lib: the host side

`startImageGeneration(instance, config, signal)`, the counterpart of `startPlanningAssistant`, with
a JSON config `{ baseUrl, model, headers?, apiKey?, quality? }`:

- registers `callbacks.onImageGenRequest`, which posts multipart `<baseUrl>/images/edits` with
  `model`, `prompt`, `size` (from the image's orientation, as `sunburstSizeOf` does), `quality`
  (`medium` unless given) and `image`, sends `headers` (and `apiKey` as Bearer when given), and
  answers `imageGenOutput({ type: 'result', id, image })` from `data[0].b64_json`, or with the
  status and the error text;
- then reports `imageGenOutput({ type: 'availability', available: true })`; an abort of `signal`
  reports it unavailable.

For the proxy: `{ baseUrl: '<HI server>/api/ai/v1', model: 'rendering', headers: { Authorization: <Basic> } }`.

### 4.4 roomle-hi-example: the sales portal page

- Read `enableAIRendering` from the same single entry of `/backends/list` as `enableAIPlanning`.
- With it: `featureFlags.imageGen: true` and, after `createPlanner`, `startImageGeneration` with
  the config of 4.3 — `getAiProxyBaseUrl()`, `rendering`, `getHiAuthData()`.
- Without it: the page leaves `featureFlags.imageGen` to the configuration, as today.

### 4.5 Tests

- roomle-ui `tests/unit/common/store/ai-chat-store.spec.ts`: host mode after an `availability`
  report — no login; `send` fires `onImageGenRequest` with the prompt and the capture; the `result`
  of the `id` becomes the entry's image, an error text its text; a late result after **New session**
  is dropped; host mode over the Sunburst keys; without a report the img-gen path as today.
- roomle-ui, a spec of `startImageGeneration` beside `hi-planning-openai-compatible.spec.ts`
  (`fetch` stubbed): the request to `<baseUrl>/images/edits` with the headers, no Bearer without a
  key, the model alias, the size of a landscape and a portrait image; the `result` from
  `b64_json`; an error status as `text`; the `availability` report.
- roomle-ui `tests/integration/common/components/AiImageChat.spec.ts`: the chat without the login
  form in host mode.
- web-sdk: `imageGenOutput` reaches `onImageGenOutput` (planner and configurator).
- roomle-hi-example: the page is inline HTML; its check is a model-free page run (section 6).

## 5. Alternatives considered

| Alternative | Why not |
|---|---|
| `imageGenConfig.imagesApi` with `baseUrl` and `headers` in the init data | Query parameters override init data field by field: a link could redirect the upload with the page's `Authorization` to any host (section 3, point 3); it breaks "never a URL from init data" |
| A fixed table entry for the HI proxy, credentials from `hi.serverOptions.authData` | Ties the generic image chat to the HI integration and to one HI server URL in the Rubens UI; the HI server differs per installation |
| An `onGenerateImage` in the HI callbacks of `setupHi` | Same coupling to HI; the configurator and non-HI planners could not use it |
| Roomle's img-gen backend with `model: sunburst-foundry` | Roomle's key and Roomle's configuration, not the backend's `AIFeatures.Rendering`; needs the Roomle login |
| `?sunburstLocal=<Foundry key>` | The key in the URL and in the browser — what the ticket wants to avoid |
| The proxy's `images/generations` | Text to image: the chat edits a capture of the plan, so it needs `images/edits` |

## 6. Verification, risks and open points

- **Not verified without a model call:** whether the proxy forwards `size` and `quality` of
  `images/edits`, and that it accepts the alias `rendering` — one real image through the proxy, on
  request.
- **Deployment:** the Rubens UI and the web-sdk parts reach the pages with a bo-test deployment;
  `startImageGeneration` with a new embedding-lib dev build (one go each).
- **The flag:** dfscfgtest01 sends no `enableAIRendering` yet.
- **Data and cost:** a render uploads a 2048 px capture of the plan to the HOMAG backend and costs
  an image generation; the proxy has no rate limits or budgets yet, and the Basic authorization of
  the example's user is public in this repository.
- **New session** stops waiting but not the running request of the host; a cancel callback is left
  out (decision 4).

## 7. Code and documents the work touches

| Repository | File | Change |
|---|---|---|
| roomle-ui | `packages/web-sdk/packages/common-core/src/` (`planning-assistant.ts` or a sibling), `utils/ui-callback.ts` | `ImageGenRequest`, `ImageGenOutput`, `onImageGenRequest`, `onImageGenOutput` |
| roomle-ui | `packages/web-sdk/packages/planner-core/src/roomle-planner.ts`, `configurator-core/src/roomle-configurator.ts` | `imageGenOutput` |
| roomle-ui | `src/common/store/ai-chat-store.ts` | host mode |
| roomle-ui | `packages/embedding-lib/src/` (`hi.ts` or the main entry) | `startImageGeneration` |
| roomle-ui | `tests/unit/common/store/ai-chat-store.spec.ts`, `tests/integration/common/components/AiImageChat.spec.ts`, `tests/unit/embedding-lib/…` | the tests of 4.5 |
| roomle-ui | `packages/embedding-lib/docs/ai-image-chat.md`, `homag-intelligence-embedding.md` | the host mode, `startImageGeneration` with the proxy |
| roomle-hi-example | `df-salesPortal_sc-example/index.html` | `enableAIRendering`, `featureFlags.imageGen`, `startImageGeneration` |
| roomle-hi-example | `.agents/context/df-sales-portal-sc-example.md` | the image chat on the proxy |

## 8. Decisions for the review

1. Host mode through a callback and an output (4.1–4.3) instead of a URL in the init data.
2. Where `startImageGeneration` lives: `@roomle/embedding-lib/hi` beside `startPlanningAssistant`, or
   the main entry, since the image chat is not HI-specific.
3. Without `enableAIRendering`: the page leaves the button to the configuration (today's login
   path), or hides it with `featureFlags.imageGen: false`.
4. A cancel of a running request (`onImageGenCancel`) now, or later.
5. The sign-in and the minimal example get the image chat on the proxy too, with the same flag rule.
