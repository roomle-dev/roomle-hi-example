# HI Agent Architecture

How the AI Planning Assistant plans with the HI tools. This page covers the components, where each
one runs, the channels between them, and every hop a prompt takes from the chat window down to the
RoomleCore kernel and back. Written for developers who change the chat window, the agent loop, the
tools or the planner methods the tools use.
[Back to the overview](./README.md).

Related pages:

- What the tools do towards the agent (the served rules, the guards, the corrections and the
  feedback): [hi-mcp-behaviour.md](hi-mcp-behaviour.md).
- The executors one by one: [Tool executors](./tool-executors.md).
- The example page and its launcher: [Pages, chat and launcher](./pages-chat-and-launcher.md).

Code references without a repository name are roomle-ui paths, from the roomle-ui root, with the line
numbers of the branch `feat/hi-mcp`. RoomleCore, ligna-store and roomle-hi-example references name
their repository.

## There is no MCP server

"HI MCP" names a **tool set**, not a server. The tools keep the shape of MCP tools:

- a tool definition is what `tools/list` answers: name, description and the JSON Schema of the input;
- a tool result is what `tools/call` answers: `content` and `isError`.

Nothing speaks the MCP protocol: there is no JSON-RPC, no transport, no endpoint and no port. Three
parts carry the agent:

| Part | Runs in | Owns |
| ---- | ------- | ---- |
| The chat window (AI Planning Assistant) | the planner iframe | what the user types and reads |
| The planning assistant | the host page | the agent loop, the model, the API key, the conversation |
| The HI tool set | the planner iframe | the tools, the served text, the planning skills, the undo bookkeeping of tool calls |

[ADR 0009](../decisions/0009-the-chat-window-is-a-panel-of-the-planner.md) puts the window in the
planner and the loop in the host. [ADR 0010](../decisions/0010-the-example-chat-runs-in-the-page.md)
runs the loop in the page. [ADR 0011](../decisions/0011-the-hi-tools-live-in-the-embedding-lib.md)
and [ADR 0012](../decisions/0012-the-hi-tool-set-runs-in-the-planner.md) put the tool set in the
planner, and [ADR 0013](../decisions/0013-the-library-context-is-a-planner-method-of-its-own.md)
adds the library context as a seventh planner method. An external MCP client (Claude Code, Claude
Desktop) cannot reach the tools. What an endpoint for one would take is in
[the wiki](../wiki/hi-mcp-endpoint-for-external-clients.md).

## The components

```text
host page (a browser window): roomle-hi-example index.html, or the ligna-store Planner.vue
│
├── @roomle/embedding-lib
│   ├── RoomleEmbeddingApi / Connector       roomDesignerApi.extended.<method>, .callbacks.<callback>
│   ├── startPlanningAssistant               the agent loop: AI SDK streamText ──HTTPS──▶ model provider
│   │   └── createHiMcpTools                 AI SDK tools that forward every call to the planner
│   └── setupHi                              the HiCallbacks ──HTTPS──▶ HI backend (library, price, orders)
│
│   ▲ ▼  embedding messages: postMessage + MessageChannel, JSON      (channels 1, 2)
│   ▲ ▼  HI channel: Comlink on the "connect_hi" MessagePort          (channel 5)
│
└── planner iframe: Rubens UI (roomle-ui)
    ├── ExposedApi                           runs the host's messages, forwards the planner callbacks
    ├── Vue app: PlanningAssistantChat.vue ⇄ planning-assistant-store
    ├── web-sdk RoomlePlanner (planner-core)
    │   ├── agent methods                    getExternalObjectAgentPrompts, getExternalObjectAgentTools,
    │   │                                    callExternalObjectAgentTool, planningAssistantOutput
    │   ├── HI tool set                      homag-intelligence/src/hi-mcp, a lazy chunk; calls seven
    │   │                                    planner methods of the same RoomlePlanner directly
    │   └── HomagIntelligence
    │       ├── glue logic ─ HiToolsImplementation ─ HI tool commands
    │       ├── the library calc script      window.exports, run on the main thread
    │       └── RoomDesignerApi              the glue logic's view of the planner
    └── RoomleCore (WASM)                    PlanInteractionHandler, PlanModelViewHelper (embind)
```

## The roles

### The chat window: `PlanningAssistantChat.vue`

`src/common/components/PlanningAssistantChat.vue` is a panel of the planner's drawer.

- **When it is shown:** the planner registers it only with `featureFlags.planningAssistant`
  (`isPlanningAssistantEnabled`, `src/configurator/store/ui-state-store.ts:163`; the panel route at
  `src/planner/components/PlannerSidebar.vue:67`). The bottom-bar button opens it
  (`openPlanningAssistant`, `src/planner/components/PlannerMain.vue:368`).
- **What it knows:** no agent, tool or model. It sends a `PlanningAssistantPrompt` and shows the
  `PlanningAssistantOutput` parts it receives.
- **Input:**
  - Text. Enter sends, unless an input method is still composing.
  - A dropped image. `prepareImage` (`src/common/utils/planning-assistant-image.ts:18`) turns it
    into a JPEG data URL: the long side at most 1568 px, EXIF rotation applied, transparent parts
    white. The window offers the drop only after the host enables it.
  - Voice through the Web Speech API. The transcript goes into the input for review and is not sent.
- **Sending:**
  - `send` (`:247`) waits for an image preparation that is still running, then calls
    `planningAssistantStore.send(text, image, firePrompt)`.
  - `firePrompt` (`:228`) calls `api.callbacks.onPlanningAssistantPrompt(prompt)` on the SDK of the
    application (`sdkApi`, `:223`). That SDK is the `RoomlePlanner`, or the `RoomleConfigurator` in
    a standalone configurator. The HI tools need the planner.
  - The call is not awaited.
- **Answers** render as sanitized markdown (`renderMarkdown`). A link opens in a new tab.

The Pinia store `src/common/store/planning-assistant-store.ts` holds what the window shows:

- **State:** `entries` (user and assistant), `busy`, `activity`, `available`, `availabilityText`
  and `imagesEnabled`. `available` stays off until the host reports it (`:34`). A message sent
  earlier would open a turn that nothing ends.
- **`send`** (`:61`) refuses an empty message, a message while a turn runs and a message while the
  assistant is unavailable. Otherwise it appends the user entry and an empty assistant entry, sets
  `busy`, and fires the prompt.
- **`receive`** (`:82`) applies one output part (see [Message formats](#message-formats)).

The window holds only these entries. The conversation the model sees lives in the host.

### The embedding bridge: embedding-lib `Connector` and Rubens UI `ExposedApi`

The host page and the planner are two browsing contexts. The planner is an iframe that the
embedding-lib creates (`_createIframe`, `packages/embedding-lib/src/roomle-embedding-lib.ts`). The
iframe gets `allow="microphone"` (`:498`) so that voice input works. Every call between the two
contexts is a message.

**Transport.** Both sides use `MessageHandler` (`packages/common/src/utils/message-handler.ts`).

- `sendMessage(message, args)` (`:79`) serializes `{ message, args }` with `JSON.stringify`, opens
  a `MessageChannel` and posts the string with `port2` to the other window (`:134`).
- The receiver runs the command (`_handleMessage`, `:140`) and answers on that port with
  `{ result }` or `{ error }`.
- Each call gets a channel of its own, which closes after the answer.
- Everything that crosses must survive JSON: prompts with their images, tool inputs, and tool
  results with base64 PNGs.

**Names.** Messages are named `<namespace>.<method>` or `<namespace>.callbacks.<callback>`. The
namespace of the planner's SDK is `extended` (`NAMESPACE`, `roomle-embedding-lib.ts:35`).

**Handshake** (`_executeMessage`, `roomle-embedding-lib.ts:526`):

1. The iframe sends `requestBoot` and receives the init data.
2. The iframe sends `setup` with the name of every exposed method and callback
   (`_getMethodsAndCallbacks`, `src/configurator/embedding/exposed-api.ts`). Public methods of the
   `RoomlePlanner` are exposed. Names that start with `_` are not.
3. `Connector.handleSetup` (`packages/embedding-lib/src/connector.ts:70`) builds a forwarder for
   each method, `roomDesignerApi.extended.<method>`. For each callback it builds a no-op slot,
   `extended.callbacks.<callback>`, for the host to overwrite.
4. The host sends `websiteReady`.

**Host → planner.** `roomDesignerApi.extended.foo(...args)` posts the message `extended.foo`.
`ExposedApi._handleMessage` (`exposed-api.ts:990`) calls `foo(...args)` on the `RoomlePlanner`
(`:1044`) and answers with the resolved value.

**Planner → host.**

- For every SDK callback the host may handle, `ExposedApi` chains a forwarder onto the planner's
  callback (`exposed-api.ts:239`, through `Connector.addCallback` with `allowMultiple` at
  `src/common/business-logic/connector.ts:16`).
- The forwarder posts `extended.callbacks.<name>` to every registered message handler and resolves
  with the last answer (`waitForLastResult`, `exposed-api.ts:103`).
- In the host, `Connector.executeMessage` (`packages/embedding-lib/src/connector.ts:112`) calls the
  function the host assigned to `extended.callbacks.<name>`, and answers when its promise settles.
- `onPlanningAssistantOutput` is UI-only. It is neither announced to nor forwarded to the host
  (`UI_ONLY_CALLBACKS`, `exposed-api.ts:79`).

### The planning assistant: `startPlanningAssistant`

`packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts` is exported from
`@roomle/embedding-lib/hi`. It is the agent loop, and it runs in the host page. It takes the planner
API, a `PlanningAssistantConfig` (`:11`) and an `AbortSignal`.

**Setup.** Four steps run in parallel (`:119`):

1. Load the AI SDK `ai@7.0.122` from esm.sh (`esm`, `:47`). The embedding-lib has no npm
   dependency on it.
2. Load the provider model (`loadChatModel`, `:51`):
   - `@ai-sdk/azure`, on the Responses API or with `chatCompletions` on Chat Completions;
   - `@ai-sdk/mistral`;
   - `@ai-sdk/anthropic`, with the header `anthropic-dangerous-direct-browser-access`;
   - `@ai-sdk/google`.
3. Request the planner's prompts (`getExternalObjectAgentPrompts`).
4. Create the tools (`createHiMcpTools`).

A failure in any of them reports the window unavailable, with the error as its text (`:127`).
Otherwise the assistant registers the turn handler as `extended.callbacks.onPlanningAssistantPrompt`
(`:133`), then reports `images` (from `readsImages`) and `availability: true` (`:181`).

**A turn** (`:133`–`:179`):

1. **The user message:** the text, or the planner's `imagePrompt` when an image comes without
   text, plus every image as a `file` part of type `image/jpeg`.
2. **The model call:** `streamText` (`:146`) with
   - `instructions`: the planner's `systemPrompt`;
   - `messages`: the conversation plus the new message;
   - `tools`;
   - `stopWhen: stepCountIs(16)`;
   - `abortSignal`;
   - `prepareStep`, which sets `toolChoice: 'none'` for the 16th step, so the last step always
     answers.
3. **The stream** (`:160`):
   - `text-delta` becomes a `text` part;
   - `tool-call` becomes an `activity` part with the tool name;
   - `error` is thrown.
4. **The end of the turn:** the conversation gets the user message and the response messages
   (`:170`). The tool calls and their results are among them, so later turns see the ids of the
   groups the tools created, for example. The window gets `done`.
5. **A failed turn:** any exception becomes an `error` part, `The planning assistant failed: …`, and
   the conversation stays as it was.

The conversation is the `messages` array in the closure, and it lives as long as the page. All
turns share the one signal. Aborting it ends the running turn, and because it stays aborted, every
later turn fails at once.

### The forwarding tools: `createHiMcpTools`

`packages/embedding-lib/src/homag-intelligence/hi-mcp-tools.ts:76` turns the planner's tools into
AI SDK tools without implementing any of them.

- **Definitions:** it calls `extended.getExternalObjectAgentTools()` once and builds one AI SDK
  dynamic tool per definition. Each tool gets the description and an input schema in Standard Schema
  form: `jsonSchema` returns the planner's JSON Schema, and `validate` lets every value through,
  because the planner validates.
- **Calls:** `execute(input)` calls `extended.callExternalObjectAgentTool(name, input)`. A rejected
  call, such as a message error, becomes an `isError` result with the error text (`:102`). The model
  reads it like any other result.
- **Results:** `toModelOutput` (`mcpToModelOutput`, `:49`) passes text parts to the model as text and
  image parts as `file` parts, as `@ai-sdk/mcp` would.
- **Old planners:** a planner without `getExternalObjectAgentTools` makes it throw "The planner has
  no HI agent tools …" (`:79`), and the assistant reports itself unavailable with that text.
- **Timeouts:** none of its own (ADR 0012).

### The planner's agent methods: `RoomlePlanner`

`packages/web-sdk/packages/planner-core/src/roomle-planner.ts`:

| Method | Line | Does |
| ------ | ---- | ---- |
| `getExternalObjectAgentPrompts()` | 3234 | the system prompt and the image prompt of `homag-intelligence/src/hi-agent-prompts.ts`, through the glue logic; `HI is not available` without HI |
| `getExternalObjectAgentTools()` | 3253 | the definitions of the tool set: name, description, JSON Schema |
| `callExternalObjectAgentTool(name, input)` | 3264 | runs one tool; an unknown name answers `MCP error -32602: Tool <name> not found` with `isError` |
| `planningAssistantOutput(part)` | 3247 | hands one output part to the window (`onPlanningAssistantOutput`) |

On first use, `_getHiAgentTools` (`:3280`) imports `homag-intelligence/src/hi-mcp/hi-mcp-server`
as a lazy chunk. It creates the tool set once per planner and passes the planner itself as the tool
set's `extended`. The tools therefore call the planner's methods directly, in the iframe, without a
message.

### The HI tool set: `homag-intelligence/src/hi-mcp/`

All paths below are in `packages/web-sdk/packages/homag-intelligence/src/hi-mcp/`.

| File | Role |
| ---- | ---- |
| `hi-mcp-server.ts` | `createHiMcpTools(roomDesignerApi)` (`:134`) registers every tool: its zod schema and its description, the served text. It chains the planner's `onHistoryChange` (`:143`). `runTool` (`:168`) logs `[hi-mcp] tool …` lines and runs the executor. `textResult` serializes a result as JSON without `imageUrl` |
| `mcp-tool.ts` | `mcpTool` (`:26`) serves the zod schema as a draft-7 JSON Schema. `execute` validates with `safeParseAsync`. An invalid input answers `MCP error -32602: Input validation error: …`; a thrown error answers its message. Both carry `isError` |
| `tool-executors.ts` | One executor per tool: `oneAtATime`, `recorded`, `inPlanner`, undo and redo of tool calls, and the agent-facing `get-plan-context` and `find-attributes` — [Tool executors](./tool-executors.md) |
| `planner-api.ts` | `createPlannerApi` (`:48`) wraps the seven planner methods the tools call. Each call gets a timeout (30 s; 120 s for `externalObjectGroupOperation` and `getExternalObjectSnapshot`) and a `[hi-mcp] call <n>` log line |
| `plan-history.ts` | `PlanHistory` records the tool calls that changed the plan, the planner steps each made, the plan before and after each, and the planner's history events |
| `agent-facing.ts` | The rooms, walls, obstacles, articles and attributes in the agent's words |
| `skills.ts`, `skills/` | The planning skills that `get-skill` serves |

The seven planner methods are `getExternalObjectPlanContext`, `getExternalObjectLibraryContext`,
`externalObjectGroupOperation`, `fetchPrice`, `getExternalObjectSnapshot`, `undo` and `redo`.

### The glue logic, its HI tools and the HI tool commands

All paths below are in `packages/web-sdk/packages/homag-intelligence/src/`.

**`HomagIntelligence`** (`homag-intelligence.ts:65`). The planner creates it when the init data carry
`hi` (`setupHomagIntelligence`, `planner-core/src/roomle-planner.ts:3739`). It opens the HI channel
and creates two things:

- `RoomDesignerApi` (`api.ts:44`), the glue logic's view of the planner. It loads groups
  (`loadPosGroups`, `:55`), reads the calculated groups (`getPosDataOfAllGroups`, `:124`), and reads
  rooms and obstacles. It also selects, opens and closes groups.
- The glue logic.

**The glue logic** (`GlueLogicImplementation`, `glue-logic.ts:508`) owns the HI side of the plan:

- the HI groups and their pos data (`_groupMap`);
- the loaded libraries (`libraryData`);
- the article catalogs;
- every path that changes an HI group: it arranges the root modules, runs the library calculation,
  loads the result into the planner and reports it to the host.

**The HI tools inside the glue logic.** The glue logic holds `_hiTools`, a `HiToolsImplementation`
(`:514`), and passes the agent's requests to it:

- `getPlanContext` (`:1121`);
- `getLibraryContext` (`:1128`);
- `executeGroupOperation` (`:1140`);
- `getAgentPrompts` (`:1147`).

**`HiToolsImplementation`** (`hi-tools.ts:306`) answers those requests:

- the plan context comes from `createPlanContext` in `hi-plan-context.ts`;
- the library context comes from `createLibraryContext` in `hi-library-context.ts`;
- `executeGroupOperation` (`:358`) dispatches. A command named like an HI tool runs that tool
  command; any other command runs a group operation (`runGroupOperation`).

Its `_toolPlanner` (`:313`) is the planner as the tool commands see it: the plan and library
context, the layout load, the group operations, the calculated groups and the article template. All
of it is called in the planner itself.

**The HI tool commands** (`hi-tool-commands.ts`):

- `HI_TOOL_COMMANDS` (`:362`) has one command per plan-changing tool.
- `runToolCommand` (`:1399`) counts the loads and group operations that changed the plan, and
  answers `historySteps` 1 or 0.
- A command performs the whole tool: validation and corrections, article and id resolution,
  relations into docking, placement, group attributes and hints. It reports the groups in the
  placement frame (`inPlacementFrame`, `:326`).

[Tool executors](./tool-executors.md) and [Layout and placement](./layout-and-placement.md) cover
the commands in detail.

### The HI library and the HI channel

The planner does not reach the HI backend itself. The host does that for it, over the HI channel.

**Opening the channel:**

1. `setupHomagIntelligence` opens a `MessageChannel` and posts `{ type: 'connect_hi', port }` to the
   host (`planner-core/src/roomle-planner.ts:3747`).
2. The planner wraps its end of the channel with Comlink.
3. The host's `setupHi` (`packages/embedding-lib/src/homag-intelligence/hi-setup.ts:31`) exposes its
   `HiCallbacks` on the other end (`:58`–`:64`).

`MessageHandler` ignores `connect_hi` messages (`message-handler.ts:148`).

**What crosses it:**

- **Planner → host, loading:** the planner loads the master data, the article catalog and the
  library's calc script (`onLoadMasterData`, `onLoadArticleCatalog`, `onLoadJavascript`). The host
  fetches them with the `libLoad…` functions of `hi-requests.ts`.
- **Planner → host, reporting:** the glue logic reports every group change in `_groupsModified`
  (`glue-logic.ts:3254`): `onPosGroupAdded`, `onPosGroupChanged`, `onPosGroupDeleted` and
  `onPriceCalc`.
- **Prices and orders:** `onFetchPrice` and `onPlaceOrder`. The host sends them to the HI Order
  Manager, so `get-price` crosses the HI channel too.

**Where the calculation runs:** in the planner frame. `_initCalcScript`
(`homag-intelligence.ts:321`) imports the calc script as a blob module that fills `window.exports`.
`calculateGroup` calls `libraryExports.calc(group)` (`:165`) synchronously, on the main thread.

### RoomleCore

**Loading a group.** The planner loads an HI group into the kernel as an external plan object:

1. `RoomlePlanner._loadOrUpdateExternalObjectGroup` (`planner-core/src/roomle-planner.ts:2653`)
   calls `planInteractionManager.addOrUpdateExternalPlanObjects`.
2. That reaches the embind method `PlanInteractionHandler.addOrUpdateExternalPlanObjects`, in
   RoomleCore `interfaces/emscripten/planner/plannerEmscriptenInterface.h:234` and
   `src/planner/interaction/plan-interaction-handler.cpp:1671`.
3. The kernel places, docks and merges the group in the plan.

**Reporting back.** The kernel answers through its plan callbacks:

1. A group whose planning situation changed is reported with `externalObjectPlanChanged` (RoomleCore
   `src/planner/interaction/kernel-callbacks.h:114`).
2. `PlannerKernelAccess._externalObjectPlanChanged`
   (`planner-core/src/services/planner-kernel-access.ts:1535`) calls
   `glueLogic.changedGroupPlanningSituation` (`glue-logic.ts:1693`).
3. The glue logic runs the library calculation again and reloads the group.

`loadExternalObjectGroups` (`planner-kernel-access.ts:1519`) waits for these follow-ups, so a load
answers only after the plan has settled.

**Reading the plan.** The plan context reads the kernel through `PlanModelViewHelper`, for example
`getExternalObjectGroups`.

### The hosts

A host only wires things up: the HI callbacks, the feature flag and the model config. It runs no
tool code.

- **The example page** (roomle-hi-example `minimal-hi-example/index.html`) calls `setupHi` with
  the HI callbacks (`:712`), then `createPlanner` (`:769`). Opened with `chat=true`, it sets
  `featureFlags.planningAssistant` and calls `startPlanningAssistant` (`:1035`). It passes:
  - `recordedPlannerApi(roomDesignerApi)`, a proxy of `extended` that records the tool calls and
    output parts for the test runner;
  - the config from `/planning-assistant-config.json`;
  - `chatAbort.signal`.

  Details: [Pages, chat and launcher](./pages-chat-and-launcher.md).
- **The ligna-store** (ligna-store `components/blocks/Planner.vue:266`) does the same with the model
  and key from its URL (`resolveChatOptions`, `hi-mcp/chat-options.ts`), and does not await the start.

## The channels

| # | From → to | Transport | What crosses |
| - | --------- | --------- | ------------ |
| 1 | window → planning assistant | The planner callback `onPlanningAssistantPrompt`, forwarded by `ExposedApi` as the message `extended.callbacks.onPlanningAssistantPrompt` | `PlanningAssistantPrompt`. The answer arrives when the turn ends |
| 2 | planning assistant → planner | Embedding messages `extended.<method>` | `getExternalObjectAgentPrompts`, `getExternalObjectAgentTools`, `callExternalObjectAgentTool`, `planningAssistantOutput` |
| 3 | planner → window | The UI callback `onPlanningAssistantOutput` in the iframe, registered at `src/planner/business-logic/sdk-connector-planner.ts:557` and passed to `planning-assistant-store.receive` | `PlanningAssistantOutput` |
| 4 | tool set → planner | Direct method calls on the `RoomlePlanner`, with timeouts | The seven planner methods |
| 5 | planner → host | Comlink on the `connect_hi` port | `HiCallbacks`: library, catalog, calc script, group reports, price, order |
| 6 | host → model provider | HTTPS from the browser, through the AI SDK provider | System prompt, conversation, tool schemas, tool results, images |
| 7 | host → HI backend | HTTPS (`hi-requests.ts`, `hi-order-manager.ts`) | Master data, catalog, calc script, price, orders |
| 8 | planner ↔ RoomleCore | embind calls and kernel callbacks | Serialized groups, plan objects, plan changes |

## Startup: how the parts find each other

1. **Host:** `setupHi(hiOptions, callbacks)` listens for `connect_hi`.
2. **Host:** `RoomleEmbeddingApi.createPlanner(…)` creates the iframe. After the handshake
   (`requestBoot`, `setup`, `websiteReady`), `roomDesignerApi.extended.*` and
   `extended.callbacks.*` exist.
3. **Planner:** `setupHomagIntelligence` posts `connect_hi`. Through the HI channel it loads the
   library (master data and calc script) and the article catalog. The glue logic is then ready.
4. **Host:** `startPlanningAssistant(roomDesignerApi, config, signal)`:
   1. imports the AI SDK and the provider package from esm.sh;
   2. calls `extended.getExternalObjectAgentPrompts()`: one message to the planner, which asks the
      glue logic's `getAgentPrompts()`;
   3. calls `extended.getExternalObjectAgentTools()`. In the planner, `_getHiAgentTools()` imports
      the tool set chunk and calls `createHiMcpTools(planner)`, which registers the tools and chains
      `onHistoryChange`. The definitions travel back as JSON;
   4. assigns `extended.callbacks.onPlanningAssistantPrompt = handler`;
   5. sends `planningAssistantOutput({ type: 'images', enabled })` and
      `planningAssistantOutput({ type: 'availability', available: true })`. The window's input opens.

## A prompt from end to end

Take "Plan a kitchen along the left wall". The model typically calls `get-skill`, then
`get-plan-context`, then `create-or-replace-groups`, then answers.

```text
[iframe] user ─▶ PlanningAssistantChat ─▶ store.send ─▶ planner callback ─▶ ExposedApi forwarder
                                                │ postMessage: extended.callbacks.onPlanningAssistantPrompt
                                                ▼
[host]   Connector.executeMessage ─▶ turn handler ─▶ streamText ──HTTPS──▶ model provider
                                                │ the model returns a tool call
                                                ▼
[host]   tool.execute ─▶ extended.callExternalObjectAgentTool ──postMessage──▶ ExposedApi
                                                ▼
[iframe] RoomlePlanner.callExternalObjectAgentTool ─▶ tool ─▶ executor ─▶ planner methods
                                                      ─▶ glue logic ─▶ library calc ─▶ RoomleCore
                                                │ McpToolResult, JSON on the MessageChannel port
                                                ▼
[host]   tool result ─▶ next model step … final text
         every text delta and tool call ─▶ extended.planningAssistantOutput ──postMessage──▶ [iframe] window
```

### 1. The window hands the prompt to the host

1. Enter calls `send` (`PlanningAssistantChat.vue:247`). It waits for the image preparation, then
   calls `store.send(text, image, firePrompt)`.
2. `store.send` (`planning-assistant-store.ts:61`) appends `{ role: 'user', text, image? }` and
   `{ role: 'assistant', text: '' }`, sets `busy`, and calls `firePrompt({ text, images })`.
3. `firePrompt` (`PlanningAssistantChat.vue:228`) calls
   `plannerApi.callbacks.onPlanningAssistantPrompt(prompt)` and does not await it.
4. The planner's callback is the chain `Connector.addCallback` built. Its first link is
   `ExposedApi`'s forwarder:
   1. it calls
      `waitForLastResult('extended.callbacks.onPlanningAssistantPrompt', handlers, prompt)`;
   2. `MessageHandler.sendMessage` serializes `{ message, args: [prompt] }`;
   3. the string is posted to `window.parent` together with the reply port. The images travel as
      data URL strings inside the JSON.
5. In the host, the `website` `MessageHandler` receives the message, and
   `RoomleEmbeddingApi._executeMessage` checks that it comes from its own iframe (`event.source`).
   `Connector.executeMessage` then calls `extended.callbacks.onPlanningAssistantPrompt(prompt)`, the
   turn handler. The reply port stays open until the handler's promise settles.

### 2. The turn runs in the host

6. The handler builds the user message and starts `streamText` (`hi-planning-assistant.ts:146`). The
   AI SDK sends the provider the system prompt, the conversation, the new message and the tools with
   their JSON Schemas. The request goes straight from the browser, with the key from the config.
7. While the stream runs, every `text-delta` and every `tool-call` becomes one
   `planningAssistantOutput` call ([step 24](#6-output-and-the-end-of-the-turn)).

### 3. A tool call crosses into the planner

8. The model returns a tool call, for example `create-or-replace-groups { posGroups: [...] }`. The AI
   SDK runs the tool's Standard Schema, which lets the input through, and calls `execute(input)`.
9. `execute` (`hi-mcp-tools.ts:99`) calls
   `extended.callExternalObjectAgentTool('create-or-replace-groups', input)`. That posts the message
   `extended.callExternalObjectAgentTool` with `args: [name, input]`. In the iframe,
   `ExposedApi._handleMessage` calls `RoomlePlanner.callExternalObjectAgentTool`
   (`roomle-planner.ts:3264`).
10. The planner looks the tool up in its cached tool set and calls `tool.execute(input)`. `mcpTool`
    validates the input with zod (`mcp-tool.ts:40`). An invalid input gets the `-32602` error result
    here, and the call ends.
11. The tool's handler in `hi-mcp-server.ts` calls `runTool` (`:168`). It logs
    `[hi-mcp] tool create-or-replace-groups` with the arguments, runs the executor, and logs the
    feedback line (`corrections`, `notLoaded`).

### 4. The executor changes the plan

12. **Queue and record.** `inPlanner('create-or-replace-groups')` is `oneAtATime(recorded(...))`
    (`tool-executors.ts:369`, `:215`, `:226`). It waits until the previous plan change or read has
    finished. `recorded` then wraps the planner API in `countingPlannerApi` (`:126`) and calls
    `planHistory.begin()`.
13. **Call the planner.** `countingPlannerApi.externalObjectGroupOperation` first reads the plan's
    groups (`getExternalObjectPlanContext(['groups'])`) as the comparison key `groupsBefore`. It
    then calls `externalObjectGroupOperation('create-or-replace-groups', args)` through
    `createPlannerApi`, with a 120 s timeout and a `[hi-mcp] call <n>` line. These are method calls
    on the same `RoomlePlanner`, not messages.
14. **One undo step.** `RoomlePlanner.externalObjectGroupOperation` (`roomle-planner.ts:3300`)
    cancels running dockings and wraps the call in `planInteractionManager.runToolCall`
    (`planner-core/src/services/plan-interaction-manager.ts:362`), so every load and group operation
    of the call lands in one step of the planner's undo history. The call then goes to the glue
    logic's `executeGroupOperation`, then to `HiToolsImplementation.executeGroupOperation`
    (`hi-tools.ts:358`), and from there to
    `runToolCommand(_toolPlanner, _toolState, command, args)` (`hi-tool-commands.ts:1399`).
15. **The tool command** (`HI_TOOL_COMMANDS['create-or-replace-groups']`, `:375`):
    - prepares and corrects the groups;
    - reads the library context (`articles`) and the plan context (`groups`, `obstacles`, and
      `rooms` for a wall placement);
    - resolves the article ids and the agent's group ids;
    - keeps the units above their carriers;
    - compiles the relations into docking (`relationsToDocking`);
    - calls `loadExternalObjectGroupLayout`.
16. **Calculate.** `_loadGroupLayout` (`hi-tools.ts:481`) calls
    `glueLogic.createOrReplacePosGroupsFromLayout` (`glue-logic.ts:810`). For each group, it:
    - runs the library calculation (`libraryExports.calc`);
    - arranges the root modules (`HiRootModuleArrangementOperator`), and calculates again when the
      arrangement moved one;
    - stores the group;
    - reports it to the host over the HI channel (`onPosGroupAdded` or `onPosGroupChanged`, then
      `onPriceCalc`).
17. **Load into the kernel.** `designerRequests.loadPosGroups(groups, { applyGroupPosition: true })`
    calls `RoomlePlanner.loadExternalObjectGroups`, then `_loadOrUpdateExternalObjectGroup`
    (`roomle-planner.ts:2653`). That runs:

    ```text
    plannerKernelAccess.loadExternalObjectGroups(() =>
      planInteractionManager.addOrUpdateExternalPlanObjects(
        serializedGroups, position, rotation, updateConfiguration, mergedGroups))
    ```

    which reaches RoomleCore `PlanInteractionHandler::addOrUpdateExternalPlanObjects`.
18. **Settle.** The kernel places and docks the group. When that changes the group's planning
    situation, the kernel reports `externalObjectPlanChanged`, and the glue logic calculates the
    group again in its new planning situation and reloads it
    (`changedGroupPlanningSituation`). `loadExternalObjectGroups` waits for these follow-ups before
    it answers.
19. **Answer.** The tool command collects the corrections, the hints and the `notLoaded` groups, and
    reports the groups in the placement frame (`inPlacementFrame`). `runToolCommand` adds
    `historySteps: 1`, or 0 when nothing changed. `runToolCall` ends and commits the undo step, and
    the planner fires `onHistoryChange`.
20. **History events.** `onHistoryChange` runs its chain. The tool set's handler counts the event
    (`planHistory.historyChanged`), then calls the earlier handlers, which are the planner UI's and
    `ExposedApi`'s forwarder to the host.
21. **Record for undo.** Back in the executor:
    - `countingPlannerApi` adds the steps;
    - `recorded` reads `groupsAfter` and records `{ tool, steps, groupsBefore, groupsAfter }` for
      `undo`;
    - `inPlanner` removes `historySteps` and `historyFollowUps`, and turns an `error` into a thrown
      error;
    - `textResult` serializes the result as JSON without image URLs.

### 5. The result goes back to the model

22. `RoomlePlanner.callExternalObjectAgentTool` resolves with the `McpToolResult`. `ExposedApi`
    answers `{ result }` on the port, the host's `extended.callExternalObjectAgentTool` resolves,
    and `execute` returns the result.
23. `toModelOutput` turns it into the model's tool result, and the AI SDK starts the next step with
    it. The reading tools (`get-plan-context`, `get-plan-images` and the others) take the same path
    with read-only planner methods. `get-plan-images` returns two PNGs as `image` parts, which reach
    the model as `file` parts.

### 6. Output and the end of the turn

24. **Output parts.** Each `planningAssistantOutput(part)` from step 7 takes this path:
    1. the host posts the message `extended.planningAssistantOutput`;
    2. in the iframe, `RoomlePlanner.planningAssistantOutput` (`roomle-planner.ts:3247`) calls
       `_roomlePlannerUiCallback.onPlanningAssistantOutput(part)`;
    3. the callback registered at `sdk-connector-planner.ts:557` calls `store.receive(part)`;
    4. Vue re-renders the answer and the status line, for example "working…
       create-or-replace-groups".

    The loop does not await these calls. Messages to one window arrive in the order they were
    posted, so the parts arrive in order.
25. **The final answer.** The model's last step answers with text only. When the stream ends, the
    handler appends the user message and the response messages to the conversation and sends
    `done`. `store.receive` ends the turn, and the input is free again.
26. **Closing the loop.** The handler's promise resolves, so the host answers the callback message
    from step 4 with `{ result: null }`. `waitForLastResult` resolves in the iframe; nothing awaits
    it.

**When the turn fails.** An `error` part in the stream, a rejected provider call or an abort becomes
an `error` part:

- the window replaces the answer with the error text, marks it failed, and ends the turn;
- the conversation does not change;
- the plan keeps what the tools changed. The `undo` tool or the planner's undo button reverts it.

## Message formats

**An embedding message** and its answer, as JSON strings on the `MessageChannel`:

```json
{"message":"extended.callExternalObjectAgentTool","args":["get-plan-context",{"include":["groups"]}]}
```

```json
{"result":{"content":[{"type":"text","text":"{\"groups\":[…]}"}]}}
```

A failure answers `{"error":"…"}`, and the forwarder on the other side rejects with it.

**`PlanningAssistantPrompt`** (`packages/web-sdk/packages/common-core/src/planning-assistant.ts:2`)
is `{ text, images }`:

- `text` is trimmed, and empty when only an image is sent;
- `images` are JPEG data URLs.

**`PlanningAssistantOutput`** (`planning-assistant.ts:18`) is one part per call. The store applies
it in `receive`:

| Part | Sent by the planning assistant when | The store |
| ---- | ----------------------------------- | --------- |
| `{ type: 'text', text }` | a text delta streams | appends `text` to the running answer |
| `{ type: 'activity', text }` | the model calls a tool (`text` is the tool name) | sets the status line |
| `{ type: 'error', text }` | the turn fails | replaces the answer with `text`, marks it failed, ends the turn |
| `{ type: 'done' }` | the turn is complete | ends the turn |
| `{ type: 'availability', available, text? }` | the setup ends or fails | turns the input on or off; off during a turn fails the running answer |
| `{ type: 'images', enabled }` | the setup ends (`readsImages`) | turns the image drop on or off |

`text`, `activity`, `error` and `done` apply only while a turn runs. Otherwise they are dropped.

**`HiAgentToolDefinition`** (`homag-intelligence/src/hi-mcp/mcp-tool-types.ts:11`) is
`{ name, description, inputSchema }`. The `inputSchema` is a draft-7 JSON Schema of the input.

**`McpToolResult`** (`mcp-tool-types.ts:2`):

- `content` is an array of `{ type: 'text', text }` and `{ type: 'image', data, mimeType }`, with
  `data` in base64 and no data URL prefix;
- `isError` marks a failed call.

**`PlanningAssistantConfig`** (`hi-planning-assistant.ts:11`) holds:

- `provider`: `azure`, `mistral`, `anthropic` or `google`;
- `model` and `apiKey`;
- `baseUrl`, `chatCompletions` and `reasoningEffort`, for `azure` only;
- `readsImages`.

## Concurrency, timeouts and errors

**One turn at a time.** The window sends nothing while `busy` and nothing before the host reports
`availability`.

**One tool call at a time.**

- `oneAtATime` queues every plan-changing tool, `undo`, `redo` and the reading tools: `get-plan-context`,
  `find-attributes`, `get-interior-design-options`, `get-price`, `get-order-data` and
  `get-plan-images`. So the record of a call never mixes with another call, and a read never sees a
  plan halfway through a change. Tool calls the model issues in parallel in one step run one after
  another.
- `get-skill` and `get-authoring-rules` do not touch the planner and are not queued.

**Steps.** A turn has at most 16 steps, and the last one runs without tools.

**Timeouts.**

- Each planner method the tools call has a timeout: 30 s, or 120 s for
  `externalObjectGroupOperation` and `getExternalObjectSnapshot` (`planner-api.ts:1`).
- The forwarded tool call, the embedding message and the provider call have no timeout of their
  own. A planner that stops answering leaves the turn open until the signal aborts it.

**Errors the model sees.** These arrive as tool results with `isError`, and the model can correct
its call:

- an invalid input;
- an unknown tool;
- a tool that throws;
- a planner method that times out;
- a forwarding that rejects.

A tool that fails after it has changed the plan answers with its error. Its steps are still recorded,
so `undo` reverts them.

**Errors the window sees.** An error of the model provider or of the stream ends the turn with an
`error` part.

**Missing parts.** A planner without HI, or without the agent methods, makes the setup fail, and the
window shows the reason as unavailable.

**User changes during a call.** The user can change the plan in the planner while a tool call runs.
The planner's history events then fall outside the tool calls, and `PlanHistory` forgets the
earlier records, so `undo` never reverts a change the user made
([Tool executors](./tool-executors.md#undo-redo)).

## Where the state lives

| State | Where | Lifetime |
| ----- | ----- | -------- |
| The conversation the model sees | host: the `messages` array of `startPlanningAssistant` | the page |
| The model, the key, the provider | host: `PlanningAssistantConfig` | the page |
| The window's entries, busy, availability | planner: `planning-assistant-store` | the planner app |
| The tool set and its `PlanHistory` | planner: `_hiAgentTools` of the `RoomlePlanner` | the planner instance |
| The agent's group ids of earlier `create-or-replace-groups` calls | planner: `HiToolsImplementation._toolState` | the planner instance |
| The HI groups, libraries and catalogs | planner: the glue logic (`_groupMap`, `libraryData`, `posArticleMap`) | the planner instance |
| The library calc script | planner: `window.exports` of the iframe | the planner instance |
| The plan and its undo history | planner and RoomleCore | the plan |

## Where a change goes

| Change | Where | Reaches the hosts with |
| ------ | ----- | ---------------------- |
| A tool, its schema or description, the served text, a planning skill | `homag-intelligence/src/hi-mcp/` | the planner deployment |
| What a plan-changing tool does | `homag-intelligence/src/hi-tool-commands.ts` and the `hi-tool-*` modules; the glue logic | the planner deployment |
| The system prompt or the image prompt | `homag-intelligence/src/hi-agent-prompts.ts` | the planner deployment |
| The agent loop, the providers, the step limit | `packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts` | a new embedding-lib version, built only on request ([AGENTS.md](../../AGENTS.md#hard-rule-no-embedding-lib-build-without-asking)) |
| The forwarding of tool calls | `packages/embedding-lib/src/homag-intelligence/hi-mcp-tools.ts` | a new embedding-lib version |
| The window, its input, its output parts | `src/common/components/PlanningAssistantChat.vue`, `src/common/store/planning-assistant-store.ts`, `common-core/src/planning-assistant.ts` | the planner deployment; a new part type also needs the host to send it |
| A planner method the tools call | `planner-core/src/roomle-planner.ts`, `homag-intelligence/src/hi-mcp/planner-api.ts` | the planner deployment |
| The model, the key | roomle-hi-example `minimal-hi-example/start.mjs`; ligna-store `hi-mcp/chat-options.ts` | the host |

## Tests that guard the path

| Part | Tests |
| ---- | ----- |
| Window and store | `tests/integration/common/components/PlanningAssistantChat.spec.ts`, `tests/unit/common/store/planning-assistant-store.spec.ts`, `tests/unit/common/utils/planning-assistant-image.spec.ts` |
| Callback forwarding to the host | `tests/unit/configurator/embedding/exposed-api.spec.ts` (`announces and forwards onPlanningAssistantPrompt to the host, but not the UI-only onPlanningAssistantOutput`) |
| Agent loop | `tests/unit/embedding-lib/homag-intelligence/hi-planning-assistant.spec.ts` |
| Forwarding tools in an AI SDK turn | `tests/unit/embedding-lib/homag-intelligence/hi-mcp/hi-mcp-tools.spec.ts`, `hi-mcp-stream-text.spec.ts` |
| Planner agent methods | `packages/web-sdk/packages/planner-core/__tests__/roomle-planner.ts` |
| Tool set | `packages/web-sdk/packages/homag-intelligence/__tests__/hi-mcp/` (`hi-mcp-server-test.ts`, `mcp-tool-test.ts`, `tool-executors-test.ts`, `plan-history-test.ts`, `hi-mcp-tools-test.ts`, `skills-test.ts`, `hi-mcp-fixture-test.ts`, `interior-fittings-test.ts`) |
| Tool commands | `packages/web-sdk/packages/homag-intelligence/__tests__/hi-tool-commands/` |
| End to end | roomle-hi-example prompt runs through the example page ([Scripts and testing](./deployment-and-testing.md#end-to-end-runs)) |
