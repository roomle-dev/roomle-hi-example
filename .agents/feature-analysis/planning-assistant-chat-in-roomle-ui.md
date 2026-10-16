# RML-18190: the Planning Assistant chat window in roomle-ui

> **Type**: Feature analysis (step 2 of the [change workflow](../../AGENTS.md#suggested-change-workflow))  
> **Domain**: the chat window of the HI planning assistant — today an overlay every host page implements itself (the example page, the ligna-store); the host side of the chat in roomle-hi-example (the example page, the chat backend, the prompt runner); the planner callback and API the window needs  
> **Trigger**: [RML-18190](https://roomle.atlassian.net/browse/RML-18190) "HI MCP chat window"  
> **Date**: 2026-10-15  
> **Author**: AI Assistant  
> **Status**: Implemented 2026-10-15 — §8 on the branches below, with the deviations of §9. Unit tests, lint and type checks green; the live check (§8.2 step 3) and the prompt runner run not run. Branches not merged  
> **Branches**: roomle-ui `feat/planning-assistant-chat-RML-18190` (from `feat/hi-agent-prompts-RML-18187`); roomle-hi-example `feat/planning-assistant-chat-RML-18190` (from `docs/planning-assistant-chat-RML-18190`); ligna-store `feat/planning-assistant-chat-RML-18190` (from `feat/hi-agent-prompts-RML-18187`)  
> **Base branches**: roomle-ui `feat/hi-agent-prompts-RML-18187` (025489938 — the agent prompts API of RML-18187, itself on top of the HI tool commands of RML-18164; neither on `master` or `release/bo-test`); roomle-hi-example `master` (2c962d6); ligna-store `feat/hi-agent-prompts-RML-18187` (37c67b6)  

## Affected repositories

- **roomle-ui** — the work of the ticket: the panel `AI Planning Assistant` in the drawer, its
  bottom button behind `featureFlags.planningAssistant` with the icon `src/common/svgs/adjust.svg`,
  the prompt callback in `roomle-planner-ui-callback.ts`, the output API in `roomle-planner.ts`;
  both reach the embedding hosts without bridge code. Branched from `feat/hi-agent-prompts-RML-18187`.
- **roomle-hi-example** — the example page loses its chat overlay and becomes a host of the
  roomle-ui window: it sets the feature flag, registers the prompt callback, runs the turn against
  its chat backend and pushes the stream through the output API. The chat backend
  `hi-mcp/hi-mcp-chat`, the MCP server, the launcher and the prompt runner stay as they are. The
  documentation of the chat window moves with the window.
- **ligna-store** — its window `hi-mcp/chat-window.ts` goes; `Planner.vue` sets the flag, registers
  the callback and feeds the window from its agent loop `hi-mcp/chat.ts`, which stays. Named here
  because the ticket names the store; the store's change is a task of its own.

## 1. What was asked and why

The Planning Assistant chat is an overlay that every host page implements itself: the ligna-store
builds it with plain DOM code (`hi-mcp/chat-window.ts`, 539 lines, copied from the example page),
the example page with its own markup, CSS and script. The AI Image Assistant, by contrast, is a
panel of roomle-ui's drawer (`src/common/components/AiImageChat.vue`), opened by a button of the
bottom bar. The ticket asks for the same for the planning assistant:

- a new chat in roomle-ui, like `AiImageChat.vue`, titled **AI Planning Assistant**, shown in the
  drawer when a new bottom button is pressed; the button only with `featureFlags.planningAssistant`
  and, per the user (2026-10-15), with the icon `src/common/svgs/adjust.svg`;
- the window talks to the surrounding page: it sends the prompt and the images out through a
  callback of `roomle-planner-ui-callback.ts`, and receives the agent's output through a new API of
  `roomle-planner.ts`, which the ticket leaves to be defined — §4.1 defines it.

The ticket's screenshot shows both windows on the store page: the Planning Assistant overlay on the
left over the planner, the AI Image Assistant in the drawer on the right.

**Why.** One window instead of one per host: a host that embeds the planner gets the chat with it
and writes only the agent side — the callback and the output calls. The window gets roomle-ui's
look, drawer, i18n and feature flag handling, and the two copies of the window (store, example)
go. The agent loop — the model, the key, the MCP client — stays in the host, where
[ADR 0003](../decisions/0003-the-ai-chat-is-an-mcp-client-beside-the-server.md) put it.

## 2. How it works today

### 2.1 The example page — `minimal-hi-example/index.html`

The chat is an overlay on the left (`#chat-overlay`, lines 420–460; CSS 141–340) with the header
"Planning Assistant", a collapse toggle, the message list, a status line, the image attachment
preview and the input form. `?chat=true` shows it and hides the debug panel; the **Show panel**
checkbox switches between the two (lines 970–1030). The launcher appends `chat=true` and
`chat_port` to the URL when a chat provider is given (`start.mjs:121`).

`startChat` (lines 1411–1727) is the whole chat, about 320 lines:

| Part | What it does | Lines |
|---|---|---|
| Rendering | `marked` and `DOMPurify` from unpkg, imported only with the chat; the assistant's text is re-rendered as markdown on every chunk | 1412–1415, 1601–1603 |
| Prompts | `roomDesignerApi.extended.getExternalObjectAgentPrompts()` once, sent as `prompts` with every request (D80) | 1418–1420 |
| Availability | `onMcpConnectionChange` disables the input until the bridge accepts the page and shows the connection message in the status line | 1446–1454 |
| The turn | `send`: the history `conversation` (text only), the page's bridge `clientId` and the prompts to `POST /chat`; a fetch body reader; `[tool] <name>` lines go to the status line, the rest is the answer (`splitStreamText`) | 1472–1486, 1541–1627 |
| Images | only when `GET /capabilities` answers `imageInput: true`: a drop anywhere on the overlay, `prepareImage` redraws the file as JPEG, long side 1568 px, EXIF applied, white background; one image per message, a preview with ×, an empty text with an image allowed | 1517–1540, 1651–1725 |

The planner is embedded with `@roomle/embedding-lib@7.1.0` from unpkg (`createPlanner`, line
1090); the page passes `featureFlags` (`globalCallbacks`, `openCloseAnimation`, `localExport3d`,
lines 769–773) and `elements: { bottom_bar: false }` (line 776) — that hides the planner's
`BottomBar` (price and view bar), not the round `BottomButtons` the AI chat button sits in
(`PlannerMain.vue:216–232` checks readonly, loading and view-only, not `elements`). The page
already hooks an SDK callback the way a host does — `api.extended.callbacks.onHistoryChange` for
the bridge (line 1306).

### 2.2 The chat backend — `hi-mcp/hi-mcp-chat`

`POST /chat` takes `{ messages, clientId, prompts }` and answers a plain-text stream: the model's
text, a `[tool] <name>` line before every tool call, on failure an `[error] …` line and the recovery
summary (`chat-stream.ts:52–195`; `chat-handler.ts`). An image to a model that reads none is a
`400` before any model call. `GET /capabilities` says whether the model reads images. The backend
knows no window: it serves the page, the prompt runner and curl alike
([ai-chat.md](../../docs/ai-chat.md)).

### 2.3 The prompt runner — `.agents/scripts/run-hi-mcp-prompt.js`

The runner never touches the chat window. It reads the page's `clientId` from the bridge hello
(lines 332–350), the prompts from the planner of its page (`evaluateInPage('getExternalObjectAgentPrompts')`,
line 581), prepares an image in the page context (line 443) and posts every turn itself to
`POST /chat` over `node:http` (`postChat`, lines 388–398). It waits for the page global
`window.hiPosGroupsCompletelyLoaded` (line 299) and takes the snapshot through
`window.instance.extended` (line 509). "Test the mcp", the benchmark and "update planning results"
run through it and are untouched by the move.

### 2.4 The ligna-store — `hi-mcp/chat-window.ts` and `hi-mcp/chat.ts`

The window (`chat-window.ts`) is the example's overlay as a TypeScript module: the same markup
(`CHAT_MARKUP`, lines 228–262, title "Planning Assistant"), injected into the `#rml-planner` host of
`components/blocks/Planner.vue` beside the planner iframe, plus a **Retry connection** button of
its bridge handling, hidden unless the bridge reports `occupied` or `unavailable` (lines 340–357),
the same `prepareImage` (274–296)
and the same marked + DOMPurify rendering (298–299). The agent loop (`chat.ts`) runs the AI SDK in
the page: `streamChat(messages, …, { onText, onTool })` with the model called directly, an MCP
client per turn and `chat-recovery.ts`; `onText` gets the whole answer so far, `onTool` the tool
name (147–158). `Planner.vue:280–296` starts the window after `getExternalObjectAgentPrompts()`.
The store sets no `featureFlags`; a URL parameter `featureFlags.<name>=true` reaches the planner's
init data through `deepMergeCopy` (`Planner.vue:92–113`, `utils/init-data.ts:31–40`).

### 2.5 roomle-ui — the AI Image Assistant, the drawer, the bottom bar, the flags

- **The panel.** `src/common/components/AiImageChat.vue`: an `InteractionHeader` with the title
  `intl.t('ai-chat.header')` ("AI Image Assistant") and a close that switches back to the previous
  layer-0 panel (`uiActions.openLayer0View(previousLayer0Sidebar || CATALOG)`, lines 189–197); a
  message list of entries `{ prompt, image?, text? }` from the Pinia store
  `src/common/store/ai-chat-store.ts` (one entry per prompt, no streaming, plain text); a one-line
  `GenericInput` and a send button. It attaches no files: the image it sends is a screenshot of the
  scene (`exportCameraScreenshot`), posted by the store directly to the Roomle image backend
  (`src/common/utils/img-gen.ts`). Nothing of it goes through the host.
- **Mounting.** The panel type `LAYER_0_SIDEBAR_TYPES.AI_CHAT` (`use-event-emitter-listener.ts:11–16`),
  `BUTTON_ACTIONS.AI_CHAT` (`ui-state.ts:41`); the route in `PlannerSidebar.vue:61–63` and the
  keep-alive stack in `InteractionsContainer.vue:111–113, 288–307`, both only with
  `uiStateStore.isImageGenEnabled`; opened by `uiActions.openLayer0View` (`ui-actions.ts:150–178`,
  a `case` per type, which also expands the drawer).
- **The bottom button.** `PlannerMain.vue:25–34`: a `CollapsibleButton` with
  `v-if="uiStateStore.isImageGenEnabled"` around `AiChatButton.vue` (a `SelectionButton` with a
  gradient and an `<img>` of `rml-icon.svg`); the click handler `openAiChat` (335–346). Icons of
  `src/common/svgs/` are a sprite, used by name: `<SvgIcon :icon="'adjust'" />`
  (`FlyingMenu.vue:51`; `SvgIcon.vue` renders `#icon-<name>`).
- **The flag.** `UiFeatureFlags` in `src/configurator/embedding/types.ts:84–126`
  (`imageGen?: boolean` with `@hidden @description`), the computed
  `isImageGenEnabled = initData.featureFlags?.imageGen ?? false` (`ui-state-store.ts:145–146`),
  defaults in `packages/common/src/utils/init-data.ts:58–64`. A host sets a flag in the init data
  or as `?featureFlags.<name>=true`. `planningAssistant` exists nowhere yet.
- **i18n.** `intl.t('<block>.<key>')`; a missing key renders `''`, there is no fallback to English;
  `ai-chat.*` exists in `public/translations/en.json:251–267` only.
- **Markdown.** roomle-ui has no markdown dependency and no streaming code; `v-html` is used in
  `InteractionNotes.vue:9` and `GenericError.vue:14,18`.

### 2.6 roomle-ui — how a callback and a planner method reach a host page

The embedding needs no list for a new method or callback. At setup the planner enumerates its
public methods and the function properties of its callback objects and sends the names to the
embedding lib (`src/configurator/embedding/exposed-api.ts:357–359`, `_getMethodsAndCallbacks` from
line 368); the lib creates `extended.<method>` and `extended.callbacks.<event>` from the names
(`packages/embedding-lib/src/connector.ts:70–109`). The planner's `extended` namespace is the
`RoomlePlanner` instance; its callbacks object is the `RoomlePlannerUiCallback`
(`roomle-planner.ts:909–915`), a class of public arrow-function fields with no-op defaults
(`roomle-planner-ui-callback.ts:77–354`; the HI ones: `onExternalObjectModuleSelected`,
`onGetConfigurationForExternalObject`). Every field is forwarded to the host with
`connector.addCallback` (`exposed-api.ts:228–256`); the arguments cross `postMessage`, so they must
be structured-cloneable. Inside roomle-ui the UI subscribes to a callback with the same
`addCallback` chain (`src/common/business-logic/connector.ts:16–57`, registrations in
`src/planner/business-logic/sdk-connector-planner.ts:156ff`).

The agent prompts API of RML-18187 is the pattern for a planner method (commit `de0d215ed`):
the signature with JSDoc in the `ExternalObjectAPI` interface (`external-object-api.ts:499–505`),
the implementation `getExternalObjectAgentPrompts()` in `roomle-planner.ts:3195–3201`, a test in
`planner-core/__tests__/roomle-planner.ts:4407ff`, the documentation in
`packages/embedding-lib/docs/homag-intelligence-embedding.md:1947ff`, the types exported in
`packages/web-sdk/packages/index.ts:191–215`. It reaches the example page as
`roomDesignerApi.extended.getExternalObjectAgentPrompts()` with the embedding lib the page already
loads.

## 3. The gaps

1. **No window in roomle-ui, no flag, no button.** `planningAssistant` exists nowhere; the AI image
   chat is the closest pattern but differs in what the window needs: separate user and assistant
   messages, a streamed answer, markdown, a status line, image attachments from the user, an input
   that the host can disable.
2. **No channel from the window to the host and back.** The prompt has to leave the planner as a
   callback (`RoomlePlannerUiCallback`); the agent's output has to come back through a planner
   method. Neither exists; the ticket asks for the output API to be defined.
3. **Two host copies of the window and of the image preparation.** The example page and the
   store carry the same overlay, drop handling and `prepareImage`; both go.
4. **The hosts' agent loops speak two dialects.** The example streams plain text with `[tool]`
   lines from its backend, the store consumes AI SDK stream parts in the page. The output API has
   to be small enough for both to map onto.

## 4. Proposed design

### 4.1 The callback and the output API (roomle-ui)

**The prompt leaves the planner as one callback.** A new field of `RoomlePlannerUiCallback`:

```ts
onPlanningAssistantPrompt = (prompt: PlanningAssistantPrompt): void => undefined;

interface PlanningAssistantPrompt {
  text: string;      // what the user typed, trimmed; '' with images only
  images: string[];  // JPEG data URLs, long side at most 1568 px, EXIF applied, white background
}
```

Fired when the user sends. The window shows the user's message itself; the host appends the prompt
to the conversation it owns, fills the planner's `imagePrompt` for an image without text (as both
hosts do today: `toModelMessages` in `chat-config.ts`, `toUserMessage` in the store's `chat.ts`)
and runs the turn. The window prepares the image once for every host — the `prepareImage` of the
example page and of the store moves into roomle-ui; strings cross `postMessage` unchanged.

**The output comes back through one method with a typed part.** A new public method of
`RoomlePlanner`, exposed to the host as `extended.planningAssistantOutput`:

```ts
planningAssistantOutput(part: PlanningAssistantOutput): Promise<void>;

type PlanningAssistantOutput =
  | { type: 'text'; text: string }          // a piece of the answer of the running turn, markdown; appended
  | { type: 'activity'; text: string }      // what the agent is doing now, e.g. the tool it runs; the status line
  | { type: 'error'; text: string }         // the turn failed; the text is shown in the answer; ends the turn
  | { type: 'done' }                        // the turn is complete; the input is free again
  | { type: 'availability'; available: boolean; text?: string } // the input on or off, with the reason
  | { type: 'images'; enabled: boolean };   // the drop target on or off; off until the host enables it
```

Rules of the window: a prompt starts a turn and shows "assistant is working…" until `done` or
`error`; `text` parts append to the assistant entry of the running turn; `activity` replaces the
status line's detail; `availability` enables or disables the input and shows the reason, the input
starts enabled; `images` turns the drop target on — the original window wires its drop only when
the host's model reads images, and the window keeps that. One typed part instead of a method per
event keeps the surface at one method, and the union grows — a tool's input and result, a plan
snapshot link — without a new method.

How the planner method hands the part to the Vue layer is an implementation choice of the plan:
the existing route is a `RoomlePlannerUiCallback` field the UI subscribes to in
`sdk-connector-planner.ts`, which the embedding also forwards to the host (one `postMessage` per
part back to the host, harmless but wasted); a subscription on the planner that is not a callback
field avoids the echo. The types are exported from `packages/web-sdk/packages/index.ts` and
documented in `homag-intelligence-embedding.md` beside `getExternalObjectAgentPrompts`.

### 4.2 The window, the button, the flag (roomle-ui)

The window behaves as the original Planning Assistant window — what it shows, what it takes, when
its input is off — and looks like the other roomle-ui panels. Nothing else is added.

- `featureFlags.planningAssistant?: boolean` in `UiFeatureFlags` (`types.ts`), the computed
  `isPlanningAssistantEnabled` in `ui-state-store.ts`, the default `false`.
- `LAYER_0_SIDEBAR_TYPES.PLANNING_ASSISTANT`, `BUTTON_ACTIONS.PLANNING_ASSISTANT`, a `case` in
  `openLayer0View`, the route in `PlannerSidebar.vue` and the keep-alive stack in
  `InteractionsContainer.vue`, each behind the flag as the AI chat is.
- The bottom button in `PlannerMain.vue` next to the AI chat button: a `CollapsibleButton` with
  `v-if="uiStateStore.isPlanningAssistantEnabled"` around a `SelectionButton` with
  `<SvgIcon :icon="'adjust'" />`; the click opens the panel.
- `src/common/components/PlanningAssistantChat.vue` modelled on `AiImageChat.vue` (header
  `planning-assistant.header` = "AI Planning Assistant", close to the previous panel) with a Pinia
  store `planning-assistant-store.ts`: the entries (user: text and images; assistant: text,
  streaming flag, error), the running turn, the activity, the availability, the image input. The
  window renders the answer as markdown — the answers come in markdown (lists, bold, headings) —
  with `marked` and `DOMPurify`, the pair both hosts use today; the two dependencies of roomle-ui
  are decided (user, 2026-10-15). Images as in the original window: a drop onto the panel while the
  host has enabled images, the dashed outline while a file is dragged over it, one image per
  message with a preview and ×, an empty text with an image allowed, the note for a file that is
  no image. A file picker may come in addition (the backlog item
  [Paste and pick an image](../backlog/README.md#chat)), not as part of the move. Enter sends,
  Shift+Enter breaks the line.
- `planning-assistant.*` strings in `public/translations/en.json` and the other locales (a missing
  key renders empty).

### 4.3 The example page as a host (roomle-hi-example)

With `chat=true` the page sets `featureFlags.planningAssistant: true` in the planner options,
and after `createPlanner`:

- `roomDesignerApi.extended.callbacks.onPlanningAssistantPrompt = (prompt) => send(prompt)` —
  `send` keeps the `conversation`, posts `{ messages, clientId, prompts }` to `POST /chat` as
  today, and maps the plain-text stream onto parts: the answer text as `text`, a `[tool] <name>`
  line as `activity`, an HTTP error or a failed fetch as `error`, the end of the stream as `done`.
  The page keeps parsing its backend's stream (`splitStreamText` stays, now emitting the new part
  of the answer per chunk).
- `onMcpConnectionChange` pushes `{ type: 'availability', available: mcpPageAccepted, text: mcpConnectionMessage }`;
  the `GET /capabilities` answer becomes `{ type: 'images', enabled: imageInput }`.
- Gone: the overlay markup and CSS, the "Show panel" exclusion, the marked and DOMPurify imports,
  `addMessage`, `prepareImage` and the drop handling — about 320 lines of script, 40 of markup and
  200 of CSS, replaced by about 60 lines.

Unchanged: the chat backend, its tests, the launcher (`chat=true` stays the page's switch), the MCP
server, the bridge, the prompt runner and every script on it. The page keeps the planner at
`https://www.roomle.com/t/bo-test/` by default; until the roomle-ui branch is deployed there, the
chat runs with `npm run dev <provider> <api-key>` against the local roomle-ui dev server. The
embedding lib the page loads (`@roomle/embedding-lib@7.1.0`) needs no new version: the method and
the callback come with the planner's setup handshake (§2.6).

### 4.4 The ligna-store as a host

`Planner.vue` sets `featureFlags.planningAssistant` when `api_key` is given, registers
`extended.callbacks.onPlanningAssistantPrompt`, keeps the `conversation` and calls `streamChat` of
`chat.ts` with `onText` and `onTool` mapped onto `text` (the new part of the answer) and `activity`,
the result or the thrown error onto `done` or `error`, the bridge status onto `availability` and
its `imageInput` option onto `images`. `hi-mcp/chat-window.ts` goes, with `marked` and `dompurify`
from its `package.json`; `chat.ts`, `chat-options.ts`, `chat-recovery.ts` and `browser-bridge.ts`
stay.

## 5. Alternatives rejected

- **The window in the embedding lib or in a host-side package** (the direction of the former backlog item
  one page bridge for every host): no drawer, no
  roomle-ui look, i18n or feature flag; the ticket asks for the planner's drawer.
- **The agent loop in roomle-ui too** — the window calling the chat backend or the MCP server
  itself: the provider key, the model choice and the backend URL would be the planner's, and the
  planner would need the page's bridge `clientId`; ADR 0003 keeps the agent in the host.
- **The HI comlink channel** (`HiCallbacks`, `setupHi` of the embedding lib): it is the HI library
  side — master data, price, orders —, set up before the planner exists; the ticket names the
  planner UI callback and the planner API, and the window lives in the planner UI.
- **The output as HTML** rendered by the host and shown with `v-html`: the planner would trust
  host-rendered model output inside its own origin; rendering and sanitizing in roomle-ui keeps the
  boundary.
- **The whole answer at the end** instead of a stream: a turn takes seconds to minutes; the
  streamed text and the status line are what tells the user the agent works (ai-chat.md).
- **One planner method per event** (`appendPlanningAssistantText`, `setPlanningAssistantActivity`,
  `finishPlanningAssistantTurn`, …): three or four methods for one stream; a new kind of part
  would be a new method.
- **The answer as the callback's return value** (the `onGetConfigurationForExternalObject`
  pattern, a promise over `postMessage`): no streaming, one promise open for minutes, and the
  single-handler constraint of that pattern (`exposed-api.ts:243`).

## 6. Risks and open points

- **Two unmerged roomle-ui branches below the work.** The base branch carries RML-18164 and
  RML-18187; the chat window branch lands only after them. The example runs the feature with
  `npm run dev` against the local roomle-ui until a deployment on bo-test.
- **The echo of the output** if the planner method hands the parts to the UI through a callback
  field (§4.1): every part is also posted back to the host. To decide in the plan.
- **The drop target inside the iframe.** The panel takes the drop and prevents the browser's
  default, as the original overlay does; the planner's drag-in handling listens over the canvas,
  the drawer is outside it — to confirm in the live check.
- **The image size is fixed in roomle-ui** (1568 px): fine for every model configured today; a
  host cannot ask for another size without a change of the window.
- **The conversation lives in the host, the entries in the window.** A planner remount (the
  store's locale switch) empties the window; the host's history has to restart with it, as the
  store's chat restarts today.
- **Strings in every locale** — the AI chat strings exist in English only and render empty
  elsewhere; the planning assistant should not repeat that.

## 7. Code and documents the work would touch

### roomle-ui (`feat/planning-assistant-chat-RML-18190` from `feat/hi-agent-prompts-RML-18187`)

| File | Change |
|---|---|
| `packages/web-sdk/packages/planner-core/src/roomle-planner-ui-callback.ts` | `onPlanningAssistantPrompt`, the type `PlanningAssistantPrompt` |
| `packages/web-sdk/packages/planner-core/src/roomle-planner.ts` | `planningAssistantOutput(part)`, the type `PlanningAssistantOutput`, the hand-over to the UI |
| `packages/web-sdk/packages/index.ts` | export the two types |
| `packages/web-sdk/packages/planner-core/__tests__/roomle-planner.ts` | the method and the callback |
| `packages/embedding-lib/docs/homag-intelligence-embedding.md` | the host side: the flag, the callback, the parts, an example |
| `src/configurator/embedding/types.ts`, `packages/common/src/utils/init-data.ts`, `src/configurator/store/ui-state-store.ts` | `featureFlags.planningAssistant`, `isPlanningAssistantEnabled` |
| `src/common/composables/use-event-emitter-listener.ts`, `src/configurator/store/ui-state.ts`, `src/common/utils/ui-actions.ts` | the panel type, the button action, the `case` |
| `src/planner/components/PlannerSidebar.vue`, `src/configurator/components/utils/InteractionsContainer.vue` | the route and the keep-alive entry behind the flag |
| `src/planner/components/PlannerMain.vue` | the bottom button with `adjust` |
| `src/common/components/PlanningAssistantChat.vue`, `src/common/store/planning-assistant-store.ts` | the window and its state |
| `public/translations/*.json` | `planning-assistant.*` |
| `package.json` | `marked`, `dompurify` — the markdown rendering of the answers |
| `tests/unit/common/store/`, `tests/integration/planner/components/PlannerSidebar.spec.ts` | the store, the gated route |

### roomle-hi-example

| File | Change |
|---|---|
| `minimal-hi-example/index.html` | the flag with `chat=true`, the callback, the part mapping of the stream, the availability; the overlay, its CSS, the drop handling and the markdown imports go |
| `docs/ai-chat.md` | "The chat window" and "Images in the chat" describe roomle-ui's window and the page as its host; the architecture diagram |
| `docs/implementation/pages-chat-and-launcher.md`, `docs/implementation/README.md` | the page side of the chat, the flow steps 1 and 9, the file table |
| `docs/user-guide/README.md`, `README.md` | the button at the bottom opens the assistant in the drawer; the troubleshooting rows on the disabled input and the dropped image |
| `docs/hi-mcp-server.md` | line 19, the store's chat window |
| `docs/hi-mcp-behaviour.md` | D80's "in effect" column (`startChat`) |
| `.agents/skills/vercel-ai-sdk-chat.md` | the browser tier: the window in roomle-ui, the page as host |
| `.agents/decisions/0003-…` | consequences: one window, two agent loops |
| `.agents/backlog/README.md` | "Paste and pick an image in the chat window" stays open and moves to roomle-ui's window; "Per-tool status in the chat window" becomes the `activity` part |
| `.agents/backlog/one-page-bridge-for-every-host.md` | the window is in roomle-ui, the bridge stays per host |

### ligna-store (its own task)

`components/blocks/Planner.vue`, `hi-mcp/chat-window.ts` (removed), `hi-mcp/chat.ts` (the
`onText` delta), `package.json`, `hi-mcp/README.md` "AI chat window".

### Verification

- roomle-ui: `cd packages/web-sdk && npm run test -- roomle-planner`, the unit and integration
  tests of the store and the sidebar route, `npm run lint`.
- roomle-hi-example: `cd hi-mcp && npm test && npm run typecheck`, `npm run lint`,
  `npm run format:check`; the live check with `npm run dev <provider> <api-key>` against the local
  roomle-ui: the button shows with `chat=true` only, a prompt plans with the tool names in the
  status line, an image drop plans from the image, the input is off until the bridge accepts the
  page. One `run-hi-mcp-prompt.js` run as the regression check of the untouched runner.

## 8. Implementation plan

Step 4 of the change workflow. The order is roomle-ui first (the window and its API), then the
example page as the first host, checked live against the local roomle-ui, then the store. Every
step names its check; the unit tests are written with the code of their step. ligna-store has no
unit tests. Nothing of this is implemented yet.

### 8.1 roomle-ui — `feat/planning-assistant-chat-RML-18190` from `feat/hi-agent-prompts-RML-18187`

**Step 1 — the types and the callbacks (`packages/web-sdk/packages/planner-core/src/`).**
A new file `planning-assistant.ts` with the two types of §4.1, `PlanningAssistantPrompt`
(`text`, `images`) and `PlanningAssistantOutput` (the union of `text`, `activity`, `error`, `done`,
`availability`, `images`), each with JSDoc. In `roomle-planner-ui-callback.ts`, after
`onGetConfigurationForExternalObject`, two fields in the pattern of the class — public arrow
functions with a no-op default:

- `onPlanningAssistantPrompt = (prompt: PlanningAssistantPrompt): void => undefined;` — fired by the
  window when the user sends; the host's hook.
- `onPlanningAssistantOutput = (part: PlanningAssistantOutput): void => undefined;` — fired by the
  planner method of step 2; the UI's hook (step 6).

Both types are exported from `packages/web-sdk/packages/index.ts` in the HOMAG Intelligence block.
The callback fields are own properties, so the embedding handshake announces them (§2.6).

**Step 2 — the planner method (`roomle-planner.ts`).** After `getExternalObjectAgentPrompts`:

```ts
/** The output of the host's planning agent for the AI Planning Assistant window: one part per call. */
public async planningAssistantOutput(part: PlanningAssistantOutput): Promise<void> {
  this._roomlePlannerUiCallback.onPlanningAssistantOutput(part);
}
```

- Tests in `planner-core/__tests__/roomle-planner.ts`, next to the agent prompts tests (line 4407):
  `planningAssistantOutput should hand the part to the UI callback` (set
  `roomlePlanner.callbacks.onPlanningAssistantOutput = vi.fn()`, call with a `text` part, expect
  the call); `the planner callbacks carry the planning assistant callbacks as own functions`
  (`Object.getOwnPropertyNames(roomlePlanner.callbacks)` contains both names — the handshake
  relies on it).
- Check: `cd packages/web-sdk && npm run test -- roomle-planner`.

**Step 3 — the output stays off the host (`src/configurator/embedding/exposed-api.ts`).**
`onPlanningAssistantOutput` is the UI's hook only: a constant `UI_ONLY_SDK_CALLBACKS` with its
qualified name filters `availableSdkCallbacks` in `_forwardSdkCallbacks` (line 199) and in
`_getMethodsAndCallbacks` (line 383), so the host neither gets a stub nor a `postMessage` per part.
`onPlanningAssistantPrompt` stays forwarded.

- Test in `tests/unit/configurator/embedding/exposed-api.spec.ts`: `does not announce or forward the
  UI-only callback onPlanningAssistantOutput` — the SETUP message's `callbacks` carry
  `extended.callbacks.onPlanningAssistantPrompt` and not `…onPlanningAssistantOutput`, and calling the
  output callback sends no message.
- Check: `npm run test -- exposed-api`.

**Step 4 — the flag.** `planningAssistant?: boolean` in `UiFeatureFlags`
(`src/configurator/embedding/types.ts:84–126`), documented like `imageGen`: `@hidden @description
Shows the AI Planning Assistant chat, fed by the host page through onPlanningAssistantPrompt and
planningAssistantOutput, usage: featureFlags.planningAssistant=true`. The computed
`isPlanningAssistantEnabled = initData.featureFlags?.planningAssistant ?? false` in
`ui-state-store.ts` next to `isImageGenEnabled` (line 145). No default entry: absent is off, as
`imageGen`.

**Step 5 — the panel type and the opening.** `LAYER_0_SIDEBAR_TYPES.PLANNING_ASSISTANT:
'planningAssistant'` (`use-event-emitter-listener.ts:11–16`), `BUTTON_ACTIONS.PLANNING_ASSISTANT`
with the next free number (`ui-state.ts:41`), a `case` in `openLayer0View` (`ui-actions.ts:150–164`)
calling `openNewView(type, BUTTON_ACTIONS.PLANNING_ASSISTANT, true)` as the AI chat does.

**Step 6 — the store (`src/common/store/planning-assistant-store.ts`, Pinia
`planningAssistantStore`).** State: `entries` (`{ role: 'user'; text; image? }` and
`{ role: 'assistant'; text; failed? }`), `busy`, `activity`, `available` (starts `true`),
`availabilityText`, `imagesEnabled` (starts `false`). Actions:

- `send(text, image?)`: ignored while `busy` or not `available`, and for an empty text without an
  image; pushes the user entry and an empty assistant entry, sets `busy`, clears `activity`, and
  fires `(await sdkConnector.plannerApi).callbacks.onPlanningAssistantPrompt({ text, images })` —
  the same callback object the host's forwarding wrapper is installed on.
- `receive(part)`: `text` appends to the assistant entry of the running turn; `activity` sets the
  activity; `error` appends the text to that entry, marks it failed and ends the turn; `done` ends
  the turn (`busy` false, `activity` empty); `availability` sets `available` and the text; `images`
  sets `imagesEnabled`. A `text`, `activity`, `error` or `done` outside a running turn is ignored.
- The subscription: in `sdk-connector-planner.ts` `init`, beside the other `addCallback` calls
  (line 157), `this.addCallback('onPlanningAssistantOutput', (part) => usePlanningAssistantStore().receive(part))`.
- Tests in `tests/unit/common/store/planning-assistant-store.spec.ts`, modelled on
  `ai-chat-store.spec.ts` (`createTestingPinia`, a mocked `sdkConnector.plannerApi` with a
  `callbacks.onPlanningAssistantPrompt` spy): `send fires the prompt with the text and the image
  and opens the turn`; `send ignores an empty prompt, a prompt while busy and a prompt while
  unavailable`; `text parts append to the running assistant entry in order`; `activity sets the
  status and done clears the turn`; `error ends the turn with the text in the failed entry`;
  `availability and images are taken outside a turn, other parts are ignored outside a turn`.
  In `tests/unit/planner/business-logic/sdk-connector-planner.spec.ts`: `routes
  onPlanningAssistantOutput of the planner callbacks to the planning assistant store` (after `init`,
  `plannerApi.callbacks.onPlanningAssistantOutput(part)` reaches `receive`, as the
  `cameraStartsMoving` tests call the callbacks).
- Check: `npm run test -- planning-assistant-store sdk-connector-planner`.

**Step 7 — the markdown and the image helpers (`src/common/utils/`).** `markdown.ts`:
`renderMarkdown(text) => DOMPurify.sanitize(marked.parse(text, { breaks: true, async: false }))`,
the call both hosts make today; `marked` and `dompurify` added to `package.json` (decided, §4.2).
`planning-assistant-image.ts`: `prepareImage(file)` — the canvas redraw of the original window
(JPEG 0.9, long side 1568 px, EXIF applied, white background) — with the scale as a pure
`imageScale(width, height, maxSide)`.

- Tests: `tests/unit/common/utils/markdown.spec.ts`: `renders bold, a list and a line break` and
  `strips a script tag and an event handler`; `planning-assistant-image.spec.ts`: `imageScale
  keeps a small image and scales the long side to the maximum` (the canvas part has no jsdom
  support and is covered by the live check).
- Check: `npm run test -- markdown planning-assistant-image`.

**Step 8 — the window (`src/common/components/PlanningAssistantChat.vue`).** Modelled on
`AiImageChat.vue`, with `defineOptions({ inheritAttrs: false })` and the `onClose` prop:

- the `InteractionHeader` on desktop with `intl.t('planning-assistant.header')` and the close that
  returns to the previous layer-0 panel, as `AiImageChat.close` does;
- the message list from the store's entries: a user entry shows its image above its text, an
  assistant entry its rendered markdown (`v-html` of `renderMarkdown`), a failed one plain;
  auto-scroll on change as the AI chat;
- the status line: while `busy` "assistant is working…" plus the activity, while not `available`
  the availability text, otherwise hidden; a short note for four seconds for a rejected drop;
- the attachment preview with its × while an image is attached;
- the textarea with the placeholder `planning-assistant.placeholder`, or `…placeholder-images`
  while images are enabled; disabled while `busy` or not `available`; Enter sends, Shift+Enter
  breaks the line; the send button;
- the drop target: while `imagesEnabled`, `dragenter`/`dragover` on the panel root prevent the
  default and set the outline class, `dragleave` clears it, `drop` takes the first image file,
  prepares it and attaches it — only the latest drop counts, a send waits for a preparation still
  running —, a file that is no image gives the note "Only images can be added.", a file that
  cannot be read "The image could not be read.";
- styles in the panel's scss with the variables the AI chat uses; the dashed outline for the
  drop target.
- Test in `tests/integration/planner/components/PlanningAssistantChat.spec.ts` (vue test utils,
  testing pinia, `prepareImage` mocked): `shows the entries, the working status with the activity
  and the availability text`; `sends the input on Enter and keeps Shift+Enter as a line break`;
  `takes a dropped image only while images are enabled and notes a file that is no image`;
  `disables the input while busy or unavailable`.
- Check: `npm run test -- PlanningAssistantChat`.

**Step 9 — mounting and the button.**

- `PlannerSidebar.vue:61–63`: the route `[LAYER_0_SIDEBAR_TYPES.PLANNING_ASSISTANT]:
  PlanningAssistantChat` behind `isPlanningAssistantEnabled`, beside the AI chat route.
- `InteractionsContainer.vue`: the async import (line 111) and the keep-alive candidate
  (line 296) behind the flag, as the AI chat.
- `PlannerMain.vue:25–34`: a `CollapsibleButton` with `v-if="uiStateStore.isPlanningAssistantEnabled"`
  around a `SelectionButton` with `<SvgIcon :icon="'adjust'" class="svg-icon" />`,
  `data-test-id="planning-assistant-button"`, the `button-active` class from
  `latestLayer0Sidebar`, and `openPlanningAssistant` as `openAiChat` (line 335) with the new type.
- Tests: `PlannerSidebar.spec.ts:270–292` — the flagged routes are the AI chat and the planning
  assistant; `registers the planning assistant route when the planningAssistant feature flag is
  set`. `PlannerMain.spec.ts`: `shows the planning assistant button only with the feature flag` and
  `opens the planning assistant panel on click`.
- Check: `npm run test -- PlannerSidebar PlannerMain`.

**Step 10 — the strings.** The block `planning-assistant` in `public/translations/en.json`
beside `ai-chat`: `header` "AI Planning Assistant", `placeholder` "Ask the assistant...",
`placeholder-images` "Ask the assistant or drop an image...", `send` "Send", `working`
"assistant is working...", `remove-image` "Remove image", `only-images` "Only images can be
added.", `image-unreadable` "The image could not be read.", `failed` "Chat failed". The other
locale files get the block with the English text until translated — the `ai-chat` block exists in
English only and renders empty elsewhere (§6).

**Step 11 — the embedding documentation.** A section "The AI Planning Assistant window" in
`packages/embedding-lib/docs/homag-intelligence-embedding.md` after `getExternalObjectAgentPrompts`
(line 1947): the flag, `onPlanningAssistantPrompt`, `planningAssistantOutput` with the parts, and a
host example of twenty lines.

- Check of the whole: `npm run test`, `npm run lint`, `cd packages/web-sdk && npm run test --
  roomle-planner`; the dev server on :5173 for the hosts.

### 8.2 roomle-hi-example — `feat/planning-assistant-chat-RML-18190` from `docs/planning-assistant-chat-RML-18190`

**Step 1 — the page as a host (`minimal-hi-example/index.html`).**

- The `chat` query parameter is read where the options are built (today at line 973, after
  them): `featureFlags.planningAssistant: chatEnabled` joins the flags at lines 769–773.
- The overlay markup (lines 420–460), its CSS (141–340) and the toggle wiring with the "Show
  panel" exclusion (970–1030) go; the checkbox only shows and hides the debug panel, as without
  chat.
- `startChat` (1411–1727) becomes the host, about 60 lines, started with `chatEnabled` after
  `createPlanner`: the prompts once (`getExternalObjectAgentPrompts`), `chatUrl`, the
  `conversation`; `const output = (part) => roomDesignerApi.extended.planningAssistantOutput(part)`;
  `roomDesignerApi.extended.callbacks.onPlanningAssistantPrompt = (prompt) => send(prompt)`.
  `send`: the busy guard; the user message with `images` when the prompt has one; `POST /chat`
  with `messages`, `clientId` and `prompts` as today; the body reader keeps `splitStreamText` on
  the raw text and emits `text` with the part of the answer not yet sent and `activity` when the
  last tool changes; a failed response emits `error` with the backend's text, a thrown fetch
  `error` "Chat failed: …"; the end pushes the assistant message and emits `done`. The log lines
  (`logApiCall('chat')`, `logMessage('chat', …)`) stay. `onMcpConnectionChange` emits
  `availability` with `mcpPageAccepted` and `mcpConnectionMessage`; the `/capabilities` answer
  emits `images` once. The marked and DOMPurify imports, `addMessage`, `prepareImage` and the
  drop handling go.
- `start.mjs` is unchanged: `chat=true` and `chat_port` stay.
- Check: `npm run dev <provider> <api-key>` against the local roomle-ui — the live check of §7.
- Unit tests: the page's inline script has none and gets none (the backlog item on the inline
  bridge names the same gap); the `hi-mcp` workspace is unchanged and its suites are the
  regression check: `cd hi-mcp && npm test && npm run typecheck`, then `npm run lint` and
  `npm run format:check` at the root. The launcher test `example-launcher.test.ts` still starts
  the page with a dummy chat key. If a unit test of the host is wanted, the stream-to-part mapping
  moves into a module `minimal-hi-example/planning-assistant-host.mjs` the page imports, with a
  vitest file in `hi-mcp/hi-mcp-server/tests/` — that gives up the single-file page and is a
  decision for the review, not part of this plan.

**Step 2 — the documents.** The rows of §7: `docs/ai-chat.md` ("The chat window" describes the
roomle-ui panel and the page as its host, "Images in the chat" the drop in the panel and the
`images` part, the architecture diagram), `docs/implementation/pages-chat-and-launcher.md` and
`docs/implementation/README.md` (the page side, the flow steps 1 and 9, the file table),
`docs/user-guide/README.md` and `README.md` (the button at the bottom opens the assistant in the
drawer; the troubleshooting rows), `docs/hi-mcp-server.md:19`, `docs/hi-mcp-behaviour.md` (D80's
"in effect" column), `.agents/skills/vercel-ai-sdk-chat.md` (the browser tier), ADR 0003 (the
consequences: one window, two agent loops), `.agents/backlog/README.md` (the two chat rows) and
`.agents/backlog/one-page-bridge-for-every-host.md` (the window is in roomle-ui, the bridge per
host). Check: `node .agents/scripts/check-markdown-links.js` on the changed files.

**Step 3 — the live check**, with the local roomle-ui of §8.1 on :5173 and
`EXAMPLE_PORT=3001 HI_CHAT_PORT=3201 npm run dev gpt-5.4-mini <api-key>`: the button with the
`adjust` icon shows with `chat=true` only; the input is off with the bridge message until the
page is accepted; "create a kitchen in the back right corner" plans with the tool names in the
status line and the answer rendered as markdown; a dropped kitchen photo shows its preview, is
sent and plans from the image; a dropped text file gives the note; a second page on the server
disables the input; `undo` in the chat reverts the planning. Then one
`node .agents/scripts/run-hi-mcp-prompt.js` run as the regression check of the untouched runner.

### 8.3 ligna-store — `feat/planning-assistant-chat-RML-18190` from `feat/hi-agent-prompts-RML-18187` (no unit tests)

**Step 1 — `components/blocks/Planner.vue`.** After the `deepMergeCopy` of the options
(line 105): `options.featureFlags = { ...options.featureFlags, planningAssistant: !!chatOptions }`.
In the bridge block (lines 280–296) the import of `~/hi-mcp/chat-window` and `startChatWindow`
become `import('~/hi-mcp/chat-host')` and `startChatHost(instance.api, chatOptions, agentPrompts,
bridgeStatus)`; `bridge.retry` is no longer passed; `disposeChatWindow` stays as the host's
dispose.

**Step 2 — `hi-mcp/chat-host.ts`** (new, about 80 lines, replacing `chat-window.ts`):
`startChatHost(api, options, agentPrompts, bridgeStatus)` registers
`api.extended.callbacks.onPlanningAssistantPrompt`, keeps the `conversation: ModelMessage[]`,
emits `images` once with `options.imageInput`, watches `bridgeStatus` and emits `availability`
(`connected` → available, otherwise the status message), and on a prompt: the user message with
`toUserMessage(text, images, agentPrompts.imagePrompt)`, `streamChat` of `chat.ts` with `onText`
emitting `text` for the part of the answer not yet sent and `onTool` emitting `activity`; the
resolved messages join the conversation and `done` follows; a thrown error emits `error`
"Chat failed: …". `dispose` stops the watcher and unregisters the callback. `chat.ts`,
`chat-options.ts`, `chat-recovery.ts` and `browser-bridge.ts` are unchanged.

**Step 3 — removals and documents.** `hi-mcp/chat-window.ts` goes; `marked` and `dompurify`
leave `package.json` and the lockfile; `hi-mcp/README.md` "AI chat window" (lines 54–78) says
that the window is roomle-ui's panel behind `featureFlags.planningAssistant` and what the store
feeds it; the "Images in the chat" section names the `images` part.

**Step 4 — the check.** `npm run lint` is not applicable (`hi-mcp/` is in `.eslintignore`);
`npx nuxi typecheck` or the build; the live check in the local store (`npm run dev`, the store
URL with `store.stage=INT`, `model`, `api_key` and `mcp_server=http://localhost:3100`) against a
planner that carries the roomle-ui branch — the INT planner once bo-test has it, until then the
store's `overrideServerUrl` pointed at the roomle-ui dev server.

### 8.4 Commits

| Repository | Commits |
|---|---|
| roomle-ui | `feat: add the planning assistant callback and output api to the planner` (steps 1–3), `feat: add the ai planning assistant panel behind the planningAssistant flag` (steps 4–10), `docs: document the planning assistant window for embedding hosts` (step 11) |
| roomle-hi-example | `feat: host the planning assistant window of roomle-ui in the example page` (step 1), `docs: describe the planning assistant window in roomle-ui` (step 2) |
| ligna-store | `feat: feed the planning assistant window of roomle-ui from the store chat` (steps 1–3) |

No pull request is opened without a request; the branches are pushed when their steps are done.

## 9. Implementation notes

What the implementation does differently from §8, and why.

- **An `error` part replaces the answer of the turn** instead of being appended: both original
  windows replaced the partial answer with the error text (`assistantEntry.innerText = …`). The
  JSDoc of `PlanningAssistantOutput`, the embedding documentation and the store test say so.
- **The input is disabled only while the assistant is unavailable**, not while a turn runs: the
  original windows kept the input open during a turn and ignored a send; the store's `send`
  returns false then and the typed text stays.
- **The window fires the prompt through a function the panel passes to the store**
  (`planningAssistantStore.send(text, image, firePrompt)`), as `AiImageChat` passes
  `captureScene` to `aiChatStore.sendPrompt`; the store has no access to the SDK connector.
- **The strings** are in `src/common/translations/base.json` (the source uploaded to Loco),
  `en.json`, a German `de.json` and the English text in the other locale files, so no locale
  renders empty before the next Loco download. Keys: `header`, `attachment`, `remove-image`,
  `placeholder`, `placeholder-images`, `input-hint`, `send`, `working`, `only-images`,
  `image-unreadable`; `failed` is not needed, the host writes the error text.
- **The button** is a component of its own, `PlanningAssistantButton.vue`, like
  `ProductListButton.vue`.
- **The panel test** is `tests/integration/common/components/PlanningAssistantChat.spec.ts`, beside
  the other tests of `src/common/components`.
- **The markdown test** checks that the rendered HTML goes through DOMPurify (a spy), not the
  sanitizing itself: happy-dom's DOM keeps a script through DOMPurify, a browser's does not.
- **Dependencies:** `marked` 18.0.14 and `dompurify` 3.4.16, pinned, in `package-lock.json` with
  only their own entries and the nesting they cause (`marked` 15 under `semantic-release`,
  `dompurify` 2 under `jspdf`, `@types/trusted-types`); `bun.lock` is not updated (no bun on the
  machine).
- **Both hosts start no chat on a planner without the window**
  (`typeof extended.planningAssistantOutput !== 'function'`) and log it; without the check the
  example's availability hook would throw inside the bridge's socket handlers.
- **The example page's stream mapping** holds back a last line that is or may become a `[tool]`
  line until the next chunk, so the appended text never carries a part of a tool line; checked
  against every chunk size of a sample stream (a scratch script, not committed). With two tool
  lines in one chunk the window shows the later one, as the original status line did.
- **ligna-store `layouts/default.vue`:** the focus exception for `#chat-overlay` goes with the
  overlay — the window is inside the planner iframe, whose focus events do not reach the page.
- **Line references** into `index.html` and `Planner.vue` in the bridge backlog item are updated.
- **The input starts off**, not on as §4.1 has it, and shows "Connecting to the assistant..." until
  the host reports availability (review of PR #117): a message sent before the host listens — while
  the example page awaits the prompts, or when a host fails to start — opened a turn nothing ended.
  The example page reports availability only after it registered `onPlanningAssistantPrompt`. The
  original windows started disabled too.

Not run, as no model run is started without being asked: the live check of §8.2 step 3 and the
`run-hi-mcp-prompt.js` regression run. The store's live check (§8.3 step 4) is not run either.
