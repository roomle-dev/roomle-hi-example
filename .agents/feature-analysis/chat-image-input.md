# Feature Analysis: Images in the Planning Assistant Chat

**Date:** 2026-10-01
**Status:** Implemented (2026-10-01, see [Close-Out](#close-out-2026-10-01))
**Branch:** `feat/chat-image-input` (from `master`)

## What Was Asked and Why

Add images to the chat window ("Planning Assistant") of the HI example
(`minimal-hi-example/index.html`):

1. The feature is enabled only if the chat model can read images.
2. The input field of the chat window is a drop target for an image. (Review: the whole chat
   overlay catches drops.)
3. Once an image is added, a small preview is shown in the chat window.
4. The image is part of the context for the agent.
5. With an image and no text, the text is "Plan a kitchen like the one in the image."

Why: [`docs/testing-prompts.md`](../../docs/testing-prompts.md) already has two image prompts
("Image-Based Kitchen Creation", with `docs/images/kitchen-right-wall-reference.png` and
`kitchen-back-right-corner-reference.png`) that no chat can run today. Every "test the mcp" report
lists them as "2 skipped (image)". In a sales configurator, a customer who brings a photo of a
kitchen they like is the natural use of this.

Scope assumption: the example page and its backend `hi-mcp/hi-mcp-chat`, plus the image rule in the
MCP server's instructions. The ligna-store chat runs its own Vercel AI SDK in the store page
([analysis](hi-mcp-chat-window-in-ligna-store.md)) and is not part of this feature.

## Review Decisions (2026-10-01)

| Topic | Decision |
| ----- | -------- |
| The server rule "Evaluate an image (a rendering of get-plan-images or any other picture) only for …" | Too broad. Rephrase it so the rule counts only for the `imageUrl` images of the master data. See [§4](#4-the-server-rule-counts-only-for-the-catalog-images). |
| Size of the image sent to the agent | It must be neither too large nor too small. 2048 px was too large. Decision: long side at most 1568 px. See [§3, image size](#image-size). |
| Preview in the chat | Left to the implementation. Only the image sent to the agent matters. |
| A file dropped next to the input | The chat overlay catches drops. See [§3, drop target](#drop-target). |
| `gpt-6-astra` | Reads images. It is one of the most recent and capable models. |

Defaults taken without a further question:

- One image per message. A new drop replaces the attached image.
- A model that is not known to read images gets no image feature. No opt-in variable.
- No `original` detail for the OpenAI models.
- The `get-plan-images` description loses its "evaluate the images only for …" sentence, because
  the rule counts only for `imageUrl`.

## How the Area Works Today

### The page sends text only

- The form is a `<textarea id="chat-input">` and the send button
  ([index.html:390-405](../../minimal-hi-example/index.html#L390-L405)), inside the overlay
  `#chat-overlay` (379). The page has no drag or drop handling. For a file dropped on the page, the
  browser's default is to open the file in the tab, which replaces the planner, and the plan is lost.
- `startChat` ([index.html:1268-1389](../../minimal-hi-example/index.html#L1268-L1389)) holds
  `conversation` as `{ role, content: string }` (1279). `send` returns early when the text is empty
  ([1310](../../minimal-hi-example/index.html#L1310)), pushes the text (1314), renders it with
  `addMessage('user', text)` (1315, `innerText`) and POSTs the whole conversation on every turn
  ([1327](../../minimal-hi-example/index.html#L1327)).
- The chat starts after the planner is created (the top-level `await` at
  [index.html:1000](../../minimal-hi-example/index.html#L1000), `startChat` at 1390).
- The page knows nothing about the model. The launcher passes only `chat=true` and `chat_port`
  ([start.mjs:109](../../minimal-hi-example/start.mjs#L109)).

### The backend accepts string content only

- `ChatMessage { role, content: string }`
  ([chat-config.ts:72-75](../../hi-mcp/hi-mcp-chat/chat-config.ts#L72-L75)).
  `parseChatMessages` rejects any content that is not a string
  ([chat-config.ts:126](../../hi-mcp/hi-mcp-chat/chat-config.ts#L126)).
- `resolveChatModel` returns `{ provider, modelId, baseUrl? }` and says nothing about what the model
  can read ([chat-config.ts:47](../../hi-mcp/hi-mcp-chat/chat-config.ts#L47)).
  `getChatConfig` applies `HI_CHAT_MODEL` afterwards (97).
- The handler answers `/health` with `ok`
  ([chat-handler.ts:36](../../hi-mcp/hi-mcp-chat/chat-handler.ts#L36)) and returns 404 for every
  path other than `/chat` (40). It passes the parsed messages unchanged to `streamChat` (71-72),
  which passes them to `streamText({ messages })`
  ([chat-server.ts:109-112](../../hi-mcp/hi-mcp-chat/chat-server.ts#L109-L112)).
- The Mistral middleware moves only the images of tool results. User messages pass through
  unchanged ([tool-result-images.ts:47](../../hi-mcp/hi-mcp-chat/tool-result-images.ts#L47)).

### The SDK and all four providers already carry an image in a user message

- AI SDK 7 (`ai` 7.0.122): a user message can hold `{ type: 'image', image, mediaType? }`.
- A **data URL** string is decoded inline (`node_modules/ai/dist/index.js:1446-1456`,
  `convertUrlToFilePartData`). **Any other URL** string is downloaded **by the backend** unless the
  provider fetches URLs itself (`downloadAssets`, index.js:1852-1914). The backend therefore
  must accept only data URLs from the page.
- Each provider maps a user image to its own image input: Mistral to `image_url`
  (`@ai-sdk/mistral` dist:128-131), Anthropic to an `image` block, Google to `inlineData`, and
  Azure (through the OpenAI Responses model of `@ai-sdk/openai`) to `input_image`. The OpenAI
  provider passes `providerOptions.<provider>.imageDetail` through unchanged
  (`@ai-sdk/openai` dist:5405-5415).
- Images already reach the models today, in the other direction: since the fix of
  [get-plan-images reaches Mistral as base64 text](../bug-analysis/plan-images-sent-as-text-to-mistral.md),
  Mistral Large reads the renders of `get-plan-images`, at about 1.3k tokens per image.

### Which configured models read images

| CLI name | Model | Reads images | Source |
| -------- | ----- | ------------ | ------ |
| `mistral`, `mistral-large` | `mistral-large-latest` | yes | this repository: reads the `get-plan-images` renders (test runs of 2026-10-01) |
| `mistral-medium` | `mistral-medium-latest` | yes | Mistral (Medium 3 is multimodal); not checked here |
| other `mistral-*` ids | passed through | depends on the version (`mistral-large-2411` no, `mistral-large-2512` yes) | — |
| `claude`, `anthropic`, `claude-sonnet`, `claude-opus`, `claude-*` | Anthropic | yes | every Claude model on the API reads images |
| `gemini`, `google`, `gemini-pro`, `gemini-flash`, `gemini-*` | Google | yes | Gemini chat models are multimodal |
| `azure`, `openai` | `gpt-4o` | yes | OpenAI |
| `azure` + `HI_CHAT_MODEL=<deployment>` | user-named deployment | unknown | the deployment name does not say which model it is |
| `gpt-5-mini` | Foundry deployment | yes | OpenAI |
| `gpt-5.4-mini` | Foundry deployment | expected yes | to verify with one call |
| `gpt-6-astra` | Foundry deployment | yes | review, 2026-10-01 |

### How the providers handle a large image

| Provider | Limit | What the model uses |
| -------- | ----- | ------------------- |
| Anthropic | 10 MB per image (base64), 8000×8000 px ([vision](https://platform.claude.com/docs/en/build-with-claude/vision)) | Most models scale down to a long side of 1568 px (about 1.15 MP) themselves. A larger upload only adds latency. |
| OpenAI / Azure (gpt-5.4 and later) | 512 MB per request, PNG/JPEG/WEBP/non-animated GIF ([images and vision](https://developers.openai.com/api/docs/guides/images-vision)) | `high` detail: up to 2048 px on the long side. `original` detail (gpt-5.4 and later, on request): up to 6000 px |
| Mistral | 20 MB per image, 8 images per request ([known limitations](https://docs.mistral.ai/resources/known-limitations)) | Scaled internally (Pixtral to 1024×1024) |
| Google | 20 MB of inline data per **request**, base64 included ([input file requirements](https://firebase.google.com/docs/ai-logic/input-file-requirements)) | Tokens per image set by `media_resolution`; not checked further |

Two things follow from this table:

- At their default settings, the configured models read between about 1024 px (Mistral) and
  2048 px (gpt-5.4 and later) on the long side. Claude reads 1568 px.
- The page sends the whole conversation on every turn, and the SDK sends it again on every step
  (up to 16). Each image therefore goes out up to 16 times per turn, and every image of the
  conversation counts against Gemini's 20 MB per request.

### The server rule on images

[hi-mcp-server.ts:8](../../hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts#L8) (`AUTHORING_RULES`): "Every
desc … is authoritative … Evaluate an image (a rendering of get-plan-images or any other picture)
only for what no desc and no dimension states - never take the kind or the size of an article from
an image." The same rule appears in shorter form in the `get-plan-context` description ("trust
them over any image", [120](../../hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts#L120)) and in the
`get-plan-images` description ("evaluate the images only for what those do not state",
[462](../../hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts#L462)).
[tests/hi-mcp-server.test.ts:191-202](../../hi-mcp/hi-mcp-poc-json/tests/hi-mcp-server.test.ts#L191-L202)
pins all three statements.

The original request was narrower ([article-size-and-trusted-descriptions.md](article-size-and-trusted-descriptions.md),
"What was asked": "trust the description of an article rather than evaluate the **catalog
images**"). That analysis widened the rule to renders and user pictures. Its reason was that the
catalog images never reach the agent: `withoutImageUrls`
([hi-mcp-server.ts:77](../../hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts#L77)) strips every `imageUrl`
of an article, module and attribute value (e.g.
[master-data.json:2644](../../docs/library-information/master-data.json#L2644)) from every tool
result. As worded now, "any other picture" covers the user's photo. A model following the rule
would read a reference kitchen only for what no `desc` states, which is the opposite of what this
feature needs.

## The Gap

1. The page cannot take an image, show a preview or send one.
2. The wire format between page and backend carries string content only.
3. Neither the backend nor the page knows whether the model reads images.
4. A message without text is not sent.
5. The server rule on images also covers the user's image.

## Proposed Design

### 1. The backend decides the capability from the resolved model

- `ChatConfig` gains `imageInput: boolean`. `getChatConfig` computes it from the final provider and
  model id, after the `HI_CHAT_MODEL` override:
  - `anthropic` and `google` → `true` for every model id;
  - otherwise `true` only for the ids in a list `IMAGE_INPUT_MODELS`:
    `mistral-large-latest`, `mistral-medium-latest`, `gpt-4o`, `gpt-5-mini`, `gpt-6-astra`, plus
    `gpt-5.4-mini` once one call has confirmed it;
  - every other id (Mistral pass-through ids, user-named Azure deployments) → `false`.

  An unknown model gets no image feature. The alternative is a provider error halfway through a
  turn.
- `GET /capabilities` → `200 {"imageInput": true}` as JSON, with the same CORS headers as every
  response. `/health` keeps answering `ok`, because the run script polls it
  ([run-hi-mcp-prompt.js:332](../scripts/run-hi-mcp-prompt.js#L332)).
- `POST /chat` with an image while `imageInput` is `false` → `400` "The model <provider:model>
  does not read images". The run script and curl reach the backend without the page.
- The startup banner gets an `Images: yes|no` line next to `Model:`.

### 2. Wire format: `images` on a user message

```json
{
  "role": "user",
  "content": "Plan a kitchen like the one in the image.",
  "images": ["data:image/jpeg;base64,/9j/4AAQ..."]
}
```

- `parseChatMessages` accepts `images` as an optional field, on `user` messages only. It is an
  array of strings, each a `data:image/(jpeg|png|webp|gif);base64,` URL, the formats all four
  providers accept. A URL is rejected, so the backend never downloads anything. The backend
  listens on loopback only but holds the provider key.
- A single function (`toModelMessages`, in `chat-config.ts`) turns a message with images into
  `{ role: 'user', content: [{ type: 'text', text: content }, ...images.map((image) => ({ type: 'image', image }))] }`.
  Messages without images stay as they are, so existing callers such as the run script need no
  change.
- `StreamChat` takes the converted messages.

### 3. The page: drop target, image, preview, send

All of this is active only when `GET /capabilities` answers `imageInput: true`. The page fetches it
once in `startChat`. If the answer is `false`, or the backend cannot be reached, the chat stays
text-only exactly as today (the overlay catches no drops), and the debug log says why.

#### Drop target

- The whole `#chat-overlay` catches file drops: header, messages, status and form. `dragenter` and
  `dragover` call `preventDefault`, set `dropEffect = 'copy'` and mark the overlay as a drop
  target (an outline in the accent colour `#dd1818`). They do this only when
  `dataTransfer.types` includes `Files`, so dragging text into the input keeps working natively.
  `dragleave` and `drop` remove the mark.
- `drop` takes the first `image/*` file. For any other file, a short note appears in the status
  line and nothing is attached. A drop on the collapsed overlay (header only) expands it, so the
  preview is visible.
- A drop outside the overlay, on the planner, is not handled by the chat.
- The placeholder becomes "Ask the assistant or drop an image..." so the drop target is
  discoverable.

#### Image size

The page always sends the agent the image at a **long side of at most 1568 px**, as a JPEG at
quality 0.9. The aspect ratio is kept, and the background is white so transparent parts do not turn
black. A smaller image keeps its size and is never enlarged.

- A phone photo of 4032×3024 px becomes 1568×1176 px.
- The reference image `kitchen-right-wall-reference.png` (1858×1512 px) becomes 1568×1276 px.
- If the browser cannot decode a file (HEIC in Chrome), a note appears and nothing is attached.

Why 1568 px: this is the size Claude reads natively. It is more than Mistral reads (about
1024 px), and it gives the gpt-5 models enough to work with at their default detail. A kitchen
photo at this size still shows every unit, handle and appliance. A larger image adds little detail
for any configured model but is uploaded on every step of a turn (up to 16). A smaller one starts
to lose detail for Claude and the OpenAI models.

Size of the upload: a JPEG of this size is expected to be a few hundred KB, to be measured in the
live test. Gemini's 20 MB per request then holds the images of a long conversation.

The limit is one constant in the page, so it can be tuned after the live test.

#### Preview

The page shows the attached image small above the input, with a × to remove it. After sending, it
shows the image in the user's message bubble. Both are the same image, scaled down by CSS for
display only.

#### Send

- `send` goes ahead when there is text or an image. With an image and empty text, the text is
  `Plan a kitchen like the one in the image.`.
- The page pushes `{ role: 'user', content: text, images: [dataUrl] }`. The user bubble shows the
  image and the text, so the default text is visible as what was asked. After sending, the
  pending preview is cleared.
- Images stay in `conversation` and go with every turn. The model keeps the reference for
  follow-ups such as "make the fronts like in the photo".

"Plan a kitchen like the one in the image." names no wall, so the agent chooses the placement
itself, from `get-plan-context` and the photo. That is intended. The live test shows where it
puts the kitchen.

### 4. The server rule counts only for the catalog images

The rule keeps `desc` and `dimensions` authoritative over the catalog images of the master data
(`imageUrl`). It no longer says anything about renders or any other picture.

| Where | Today | Proposed |
| ----- | ----- | -------- |
| `AUTHORING_RULES` ([hi-mcp-server.ts:8](../../hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts#L8)) | "… trust dimensions for how big an article is. Evaluate an image (a rendering of get-plan-images or any other picture) only for what no desc and no dimension states - never take the kind or the size of an article from an image." | "… trust dimensions for how big an article is. Both are authoritative over the catalog images of the master data (imageUrl): never take the kind or the size of an article from a catalog image." |
| `get-plan-context` description ([120](../../hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts#L120)) | "Every desc is authoritative and dimensions give the size - trust them over any image." | "Every desc is authoritative and dimensions give the size - trust them over the catalog images (imageUrl)." |
| `get-plan-images` description ([460-462](../../hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts#L460-L462)) | "The images show how the plan looks: what an article is and how big it is come from the desc and dimensions of get-plan-context - evaluate the images only for what those do not state." | sentence removed (a render is not a catalog image) |

- The tests at [tests/hi-mcp-server.test.ts:191-202](../../hi-mcp/hi-mcp-poc-json/tests/hi-mcp-server.test.ts#L191-L202)
  pin the new wording instead. A new assertion checks that no served text contains "any other
  picture" or "any image".
- `withoutImageUrls` stays. Today no `imageUrl` reaches the agent, so the rule takes effect only
  when a tool passes catalog images. It no longer gets in the way of the user's photo or the
  renders.
- The change is client-agnostic. It also applies to Claude Code, Copilot and the ligna-store chat,
  which use the same MCP server.

### Not changed

The MCP tools and their results, `withoutImageUrls`, the page bridge, the launcher, the Mistral
middleware and the ligna-store chat.

### Accepted limits

- Every step of a turn resends the whole prompt, images included. A turn of n steps sends each
  image n times. The same is already true of `get-plan-images` results.
- The page fetches the capability once, when the chat starts. If the chat backend is not listening
  yet, images stay off until a reload. The launcher does not wait for the backend
  ([start.mjs:242-253](../../minimal-hi-example/start.mjs#L242-L253)), but the chat starts only
  after the planner has loaded, which is usually slower than the backend start.
- With images off, a file dropped on the page still opens in the tab, as today.

## Alternatives Considered and Rejected

| Alternative | Why rejected |
| ----------- | ------------ |
| Long side 2048 px, unchanged up to 5 MB (second draft) | Too large (review). Uploaded on every step of a turn, for little extra detail. |
| Send every image unchanged, up to the provider limits | Adds no detail (every provider scales down itself), but adds upload time on up to 16 steps per turn, and fills Gemini's 20 MB per request after a few photos. |
| Long side 1024 px | Too small: Claude and the OpenAI models read more, and the details of a kitchen photo start to go. |
| `original` detail for gpt-5.4 and later | Up to 6000 px, but up to four times the tokens on every step, and only for two of the configured models. |
| The launcher passes `chat_images=true` in the page URL | The launcher is plain Node and does not resolve models (`chat-config.ts` does), so it would duplicate the model table. A page opened by hand would also be wrong. |
| Ask the provider at startup (Mistral's `GET /v1/models/{id}` reports `capabilities.vision`) | Only Mistral reports it in this form. It adds a startup network call and a failure mode, and the other providers still need a table. |
| Always enable images and let the provider reject them | Contradicts "only enabled if the model can read images". The error would arrive mid-stream, after the user had waited. |
| The page sends AI SDK parts (`content: [{ type: 'image', image }]`) | Couples the page to the SDK message format. An `image` URL would make the backend download it. |
| Scale the image in the backend | Needs an image library, a new dependency. The page already has a canvas. |
| Drop the images of older turns to save tokens | The model loses the reference for follow-ups. |
| Keep the server rule and add a sentence that the user's image is an exception | Keeps the over-broad rule and patches it. The review asked for the rule to count only for `imageUrl`. |

## Code and Documents the Work Would Touch

| File | Change |
| ---- | ------ |
| `hi-mcp/hi-mcp-chat/chat-config.ts` | `imageInput` in `ChatConfig`, `IMAGE_INPUT_MODELS`; `images` in `ChatMessage` and its validation; `toModelMessages` |
| `hi-mcp/hi-mcp-chat/chat-handler.ts` | `GET /capabilities`; `400` for images when `imageInput` is false; `StreamChat` over the converted messages |
| `hi-mcp/hi-mcp-chat/chat-server.ts` | Converted messages into `streamText`; `Images:` line in the banner |
| `hi-mcp/hi-mcp-chat/tests/chat-handler.test.ts` | `imageInput` per alias, pass-through id and `HI_CHAT_MODEL` override; `images` validation (data URL accepted; http URL, non-image media type, images on an assistant message rejected); `toModelMessages`; `/capabilities`; the `400` path |
| `minimal-hi-example/index.html` | CSS for the drop mark and the preview; preview markup in `#chat-form`; in `startChat`: capability fetch, drop handling on `#chat-overlay`, image preparation (JPEG, long side at most 1568 px), send with images, image in the user bubble |
| `hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts` | The three statements of [§4](#4-the-server-rule-counts-only-for-the-catalog-images) |
| `hi-mcp/hi-mcp-poc-json/tests/hi-mcp-server.test.ts` | Pins the new wording; no "any other picture" / "any image" |
| `minimal-hi-example/docs/ai-chat.md` | New section "Images in the chat": which models, `/capabilities`, the `images` field, the 1568 px rule, the overlay as drop target |
| `minimal-hi-example/docs/hi-mcp-server.md` (566-576) | "Every `desc` is authoritative": over the catalog images only |
| `.agents/skills/hi-mcp-tools.md` (60-63) | "Trusted descriptions": over the catalog images only |
| `.agents/skills/vercel-ai-sdk-chat.md` | Local wiring: user images as data URLs only (the SDK downloads URLs) |
| `.agents/README.md`, `.agents/feature-analysis/README.md` | Index lines (added with this analysis) |

Follow-ups, not part of this feature:

- `run-hi-mcp-prompt.js` gets an `--image <path>` option, so the testing skill can run the two
  image prompts instead of skipping them.
- The ligna-store chat window.
- Paste from the clipboard and a file picker button. A drop-only control cannot be reached with
  the keyboard.

## Verification (Definition of Done)

1. `npm test` and the typecheck of the `hi-mcp` workspace pass, including the new and changed
   tests.
2. Live, headless (Playwright, as in the earlier live checks), `npm start mistral <key>`:
   - a synthetic `drop` of `docs/images/kitchen-right-wall-reference.png` (1858×1512, 1.9 MB) on
     the overlay's message area shows the preview, and the request carries a 1568×1276 px JPEG
     (its size is noted);
   - sending with an empty input shows the image and "Plan a kitchen like the one in the image."
     in the user bubble;
   - the turn creates a group, and its `get-plan-images` render is compared with the reference.
3. The same turn with `gpt-6-astra` (and once with `gpt-5.4-mini`, before it goes on
   `IMAGE_INPUT_MODELS`).
4. A model without image input (`npm start mistral-large-2411 <key>`): `/capabilities` answers
   `false`, and the overlay shows no drop mark and the old placeholder.
5. Text-only turns behave as before.

## Implementation Plan (2026-10-01)

> **Status**: implemented on 2026-10-01, see [Close-Out](#close-out-2026-10-01). The plan below is
> the approved one; the close-out lists where the implementation differs.
> **Branch**: `feat/chat-image-input`, from `master`. The analysis (this document and the two
> index lines) is its first commit.
> **Baseline**: `cd hi-mcp && npx vitest run`: 214 tests in 11 files pass. `npm run typecheck`
> is clean.

### Step 1. The backend knows whether the model reads images (`hi-mcp-chat/chat-config.ts`)

```ts
export const IMAGE_INPUT_MODELS = [
  'mistral-large-latest',
  'mistral-medium-latest',
  'gpt-4o',
  'gpt-5-mini',
  'gpt-6-astra',
];

export const readsImages = (provider: ChatProvider, modelId: string) =>
  provider === 'anthropic' || provider === 'google' || IMAGE_INPUT_MODELS.includes(modelId);
```

`ChatConfig` gains `imageInput: boolean`. `getChatConfig` first computes the final `modelId` (the
existing `HI_CHAT_MODEL` rule, unchanged), then sets `imageInput: readsImages(provider, modelId)`.
`gpt-5.4-mini` joins the list only after the live call in step 7.

→ verify: unit tests. `imageInput` is true for the default model, `claude`, `gemini-flash`,
`gpt-5-mini`, `gpt-6-astra`, `azure` (gpt-4o) and `claude` + `HI_CHAT_MODEL=claude-haiku-4-5`.
It is false for `mistral-large-2411`, `gpt-5.4-mini` and `azure` + `HI_CHAT_MODEL=my-deployment`.

### Step 2. User messages carry images (`chat-config.ts`)

- `ChatMessage` gains `images?: string[]`.
- `parseChatMessages` checks `images` when it is present:
  - it is an array;
  - it is on a `user` message only;
  - every entry matches `^data:image/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+=*$`.

  Otherwise it throws a `ChatRequestError` that names the rule. A message without `images` is
  returned exactly as today. An empty array counts as no images.
- `toModelMessages(messages: ChatMessage[]): ModelMessage[]` (type import from `ai`):
  - a message without images stays `{ role, content }`;
  - a message with images becomes
    `{ role: 'user', content: [{ type: 'text', text }, ...images.map((image) => ({ type: 'image', image }))] }`.

→ verify: unit tests.
- A user message with a JPEG data URL is kept.
- These are rejected: an `http` URL, `data:text/plain`, images on an assistant message, and a string
  instead of an array.
- `toModelMessages` keeps text messages and builds the parts for an image message.

### Step 3. The handler (`hi-mcp-chat/chat-handler.ts`)

- `GET /capabilities` → `200`, `Content-Type: application/json`, `{"imageInput": <bool>}`, with
  the CORS headers. It sits next to `/health`, which stays `ok`.
- After `parseChatMessages`: when `config.imageInput` is false and a message carries images,
  throw `ChatRequestError("The model <provider>:<modelId> does not read images")` → `400`.
- `StreamChat` becomes `(messages: ModelMessage[]) => Promise<Response>`. The handler calls
  `streamChat(toModelMessages(messages))`.

→ verify: unit tests.
- `/capabilities` answers both values, with CORS for the page origin.
- An image on a model without image input gets `400`, and `streamChat` is not called.
- An image on a model that reads images reaches `streamChat` as parts.
- The existing test "streams the assistant answer" passes unchanged.

### Step 4. The chat server (`hi-mcp-chat/chat-server.ts`)

- `streamChat` takes the `ModelMessage[]` and passes them to `streamText` as today.
- The banner gets `➜  Images:  yes` or `no` below `Model:`.

→ verify: `npm run typecheck`, and the banner in the live run.

### Step 5. The server rule (`hi-mcp-poc-json/hi-mcp-server.ts`)

- The three texts of [§4](#4-the-server-rule-counts-only-for-the-catalog-images): `AUTHORING_RULES`
  (line 8), the `get-plan-context` description (120), and the `get-plan-images` description
  (460-462, where the sentence is removed).
- [tests/hi-mcp-server.test.ts:178-202](../../hi-mcp/hi-mcp-poc-json/tests/hi-mcp-server.test.ts#L178-L202):
  - the assertions pin the new wording: "authoritative over the catalog images of the master data
    (imageUrl)" and "trust them over the catalog images (imageUrl)";
  - `get-plan-images` no longer contains "evaluate the images only";
  - a new assertion checks that neither the server instructions, nor the rules, nor any tool
    description contains "any other picture" or "any image".

→ verify: `npx vitest run hi-mcp-poc-json/tests/hi-mcp-server.test.ts`.

### Step 6. The page (`minimal-hi-example/index.html`)

**Markup**: `<div id="chat-attachment" class="hidden">`, placed before `#chat-form` in
`#chat-overlay-content`. It holds an `<img alt="Attached image">` and a
`<button type="button" aria-label="Remove image">×</button>`.

**CSS**:
- `#chat-overlay.drop-target`: a dashed outline in `#dd1818`;
- `#chat-attachment img`: max 64 px high;
- `.chat-message img`: block, max 120 px high, max 100 % wide.

**Script**, all inside `startChat`:

- Constants: `IMAGE_MAX_SIDE = 1568`, `IMAGE_QUALITY = 0.9`,
  `DEFAULT_IMAGE_PROMPT = 'Plan a kitchen like the one in the image.'`.
- Capability: `GET http://localhost:<chat_port>/capabilities`. Anything other than
  `imageInput: true` (an error, `false`, no backend) leaves the chat exactly as today. The debug log
  records `images enabled` or the reason they are off. Everything below runs only when images are
  enabled.
- `prepareImage(file)`:
  1. `createImageBitmap(file, { imageOrientation: 'from-image' })`, so a phone photo keeps its
     EXIF rotation, which the canvas re-encode would otherwise lose;
  2. scale = `min(1, IMAGE_MAX_SIDE / longest side)`;
  3. a canvas of the scaled size, filled white, with the bitmap drawn on it;
  4. `bitmap.close()`;
  5. return `canvas.toDataURL('image/jpeg', IMAGE_QUALITY)`.

  A file the browser cannot decode rejects the promise.
- Drop handling on `#chat-overlay`, only for drags whose `dataTransfer.types` include `Files`.
  Text drags into the input stay native.
  - `dragenter`/`dragover`: `preventDefault`, `dropEffect = 'copy'`, add `drop-target`;
  - `dragleave`: remove `drop-target` only when `relatedTarget` is outside the overlay, so moving
    across child elements does not flicker;
  - `drop`: `preventDefault`, remove the mark, take the first `image/*` file. If the overlay is
    collapsed, expand it (`chatOverlayToggle.click()`). Then `prepareImage` and attach.
  - Without an image file, or when decoding fails, the status line shows "Only images can be
    added." or "The image could not be read." for 4 s (only when no turn is running; the debug log
    records it always).
- Attachment: `attachedImage` holds the data URL. Attaching shows `#chat-attachment` with the
  image. The × button and sending clear it. A new drop replaces it.
- Placeholder: "Ask the assistant or drop an image...".
- `send`:
  1. `text = input.value.trim() || (attachedImage ? DEFAULT_IMAGE_PROMPT : '')`. It returns when
     `text` is empty or a turn is running, as today.
  2. It pushes `{ role: 'user', content: text, images: [attachedImage] }`, or the plain message
     without an image.
  3. `addMessage('user', text, image)` sets `innerText` and then prepends the `<img>`.
- `conversation` keeps the images. Every turn sends them again (decision of the analysis).

→ verify: step 7.

### Step 7. Live verification (headless, as in the earlier live checks)

Prerequisites:
- Check ports 3000/3100/3200 first. If they are taken by a session I did not start, run with
  `EXAMPLE_PORT=3001 HI_CHAT_PORT=3201`.
- The Mistral and the Foundry API keys.

1. `node minimal-hi-example/start.mjs mistral <key> --no-open`. The banner shows `Images: yes`. In Playwright (Chromium,
   SwiftShader):
   - a synthetic `dragenter`/`dragover`/`drop` with a `DataTransfer` holding
     `docs/images/kitchen-right-wall-reference.png`, dispatched on `#chat-messages`, shows the
     preview;
   - send with an empty input;
   - the captured `POST /chat` body carries one `image/jpeg` data URL. Its decoded size is
     1568×1276, and its byte size is recorded;
   - the user bubble shows the image and "Plan a kitchen like the one in the image.";
   - after the stream ends, `get-plan-images` is saved and compared with the reference image.
2. The same turn with `gpt-6-astra`, then with `gpt-5.4-mini`. If `gpt-5.4-mini` reads the image,
   it goes on `IMAGE_INPUT_MODELS` (one-line commit, with a test).
3. `node minimal-hi-example/start.mjs mistral-large-2411 dummy --no-open`. `/capabilities` answers `false`, the placeholder
   is unchanged, and a dropped file is not attached. No valid key is needed, because the provider is
   never called.
4. One text-only turn behaves as before.
5. `npx vitest run` and `npm run typecheck` pass. The test count is 214 plus the new tests.

### Step 8. Documentation

| Document | Change |
| -------- | ------ |
| `minimal-hi-example/docs/ai-chat.md` | New section "Images in the chat": which models, drop on the overlay, 1568 px JPEG, the `images` field, `GET /capabilities`, the `400`; endpoints and troubleshooting rows |
| `minimal-hi-example/docs/hi-mcp-server.md` (566-576) | "Every `desc` is authoritative": over the catalog images (`imageUrl`) only |
| `.agents/skills/hi-mcp-tools.md` (60-63) | "Trusted descriptions": over the catalog images only |
| `.agents/skills/vercel-ai-sdk-chat.md` | Local wiring: user images as data URLs only, because the SDK downloads URLs itself |
| this document | Close-out: what was verified, status `Implemented` |

### Commits

| # | Commit | Content |
| - | ------ | ------- |
| 0 | `docs: analyse images in the planning assistant chat` | this document, the two index lines |
| 1 | `feat: tell the chat page whether the model reads images` | steps 1, 3 (`/capabilities`), 4 (banner) with tests |
| 2 | `feat: accept images on user messages in the chat backend` | steps 2, 3 (`400`, `toModelMessages`), 4 with tests |
| 3 | `fix: limit the desc-over-image rule to the catalog images` | step 5 with tests, `hi-mcp-server.md`, `hi-mcp-tools.md` |
| 4 | `feat: drop an image on the planning assistant chat` | step 6 |
| 5 | `docs: describe images in the planning assistant chat` | `ai-chat.md`, `vercel-ai-sdk-chat.md` |
| 6 | `docs: close out the chat image analysis` | after step 7; with `gpt-5.4-mini` on the list if it reads the image |

Not touched: the MCP tools, `withoutImageUrls`, the page bridge, the launcher, the Mistral
middleware, the ligna-store.

## Close-Out (2026-10-01)

Implemented as planned on `feat/chat-image-input`, with three differences:

1. **File parts, not image parts.** User images go to `streamText` as
   `{ type: 'file', data: <data URL>, mediaType: 'image/…' }`. AI SDK 7 deprecates the `image`
   part, and the first live run logged that warning on every step. The SDK's mock model confirmed
   that the data URL is converted inline (base64, `image/jpeg`, no download). The `gpt-5.4-mini`
   run logged no warning.
2. **Documentation in the code commits.** Each documentation update went into the commit of the
   code it describes, at the review's request, instead of a separate docs commit.
3. **`gpt-5.4-mini` reads images.** One direct call with the 1568 px reference listed its units
   correctly (tall sage-green unit, wood wall cabinets, oven, sage base cabinets) at 892 input
   tokens. It is now on `IMAGE_INPUT_MODELS`.

### Commits

| Commit | Content |
| ------ | ------- |
| `a9c5581` docs: analyse images in the planning assistant chat | this document, index lines |
| `8e12a7c` feat: tell the chat page whether the model reads images | `readsImages`, `imageInput`, `GET /capabilities`, banner, tests, `ai-chat.md` |
| `216767f` feat: accept images on user messages in the chat backend | `images`, validation, `toModelMessages`, `400`, tests, `ai-chat.md`, chat skill |
| `3d1abd5` fix: limit the desc-over-image rule to the catalog images | the three server texts, tests, `hi-mcp-server.md`, `hi-mcp-tools.md` |
| `6f66aba` feat: drop an image on the planning assistant chat | `index.html`, `ai-chat.md` (page part, troubleshooting) |
| `5146d2a` fix: send user images as file parts instead of the deprecated image part | `toModelMessages`, tests, docs |
| `0361391` feat: read images with gpt-5.4-mini | list, test, `ai-chat.md` |

### Verification

- `cd hi-mcp && npx vitest run`: 222 tests in 11 files pass (214 before). `npm run typecheck` is
  clean.

Live, headless Chromium (page :3001, MCP :3110, chat :3201, the deployed planner), with
`docs/images/kitchen-right-wall-reference.png` (1858×1512 PNG, 1.9 MB) as a synthetic drop on the
chat messages, then sent with an empty input:

| Model | Page | Request | Image turn | Plan |
| ----- | ---- | ------- | ---------- | ---- |
| `mistral-large-latest` | outline while dragging, the drop is caught, 64 px preview, image and default text in the user message | one `image/jpeg`, 1568×1276, 194 KB, "Plan a kitchen like the one in the image." | 37 s | It read the photo (tall fridge unit, wall units, hood, oven, sink), but split the kitchen into three groups at the left wall, partly outside the room. This is a model finding, the known placement weakness. |
| `gpt-6-astra` | the same | the same | 124 s | One straight 3 m run on the right wall: tall fridge unit on the left, oven and hob in the middle, sink on the right, three oak wall cabinets (one left of the hood, two right), olive-green fronts, wood worktop and plinth. It matches the reference. |
| `gpt-5.4-mini` | the same | the same (file parts, no warning) | 23 s | It read the photo (tall unit on the left, green and wood fronts) but created only one tall unit, and said so in its answer. This is a model finding. |
| `mistral-large-2411` (no image input) | `Images: no`, `/capabilities` false, old placeholder, the drop is neither prevented nor attached | — | — | — |

In every run, the text turn that followed ("Which units did you use?") sent the image again in
the first user message, and the model answered from its plan.

Not verified: a real drop from the desktop by a person (only synthetic `DragEvent`s), a phone
photo with an EXIF rotation, HEIC, Safari and Firefox. Claude and Gemini were not run either,
because no keys were available.

### Open

- The server rule change (`3d1abd5`) reaches the Cloudflare-hosted MCP server with its next
  deployment (a push to `release/cloudflare`).
- The follow-ups listed above: `--image` for the run script and the testing skill, the ligna-store
  chat, paste from the clipboard and a file picker.

The living reference is the section "Images in the chat" in
[ai-chat.md](../../minimal-hi-example/docs/ai-chat.md), plus
[hi-mcp-server.md](../../minimal-hi-example/docs/hi-mcp-server.md) and
[hi-mcp-tools.md](../skills/hi-mcp-tools.md) for the rule, and
[vercel-ai-sdk-chat.md](../skills/vercel-ai-sdk-chat.md) for the wiring.
