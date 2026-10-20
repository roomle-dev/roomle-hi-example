# HI MCP in the embedding-lib, first step: the MCP server's tools in roomle-ui and the HI presets demo on them

> **Type**: Feature Analysis\
> **Status**: Open\
> **Date**: 2026-10-20\
> **Base**: roomle-hi-example `master` at `433f7e9`; roomle-ui `release/bo-test` at `728317a91`\
> **Source**: [RML-18196](https://roomle.atlassian.net/browse/RML-18196), the first step\
> **Backlog**: `hi-tools-in-the-embedding-lib.md` (removed)

## Affected repositories

| Repository | Required work |
|---|---|
| **roomle-ui — `release/bo-test`** | A copy of the MCP server's tool code in `packages/embedding-lib/src/homag-intelligence/hi-mcp/`, exposed as `createHiMcpTools` in `packages/embedding-lib/src/hi.ts`. zod as a dependency bundled into the tool code, the size check of the embedding build narrowed to the main file. The HI presets demo (`hi-presets-example.ts`, `planning-assistant.ts`) uses the tool set instead of the MCP client and the WebSocket bridge. Unit tests and the embedding documentation. |
| **roomle-hi-example** | The MCP server stays: the ligna-store and the example page still use it. A script that exports today's `tools/list` and `skills/list` as the fixture of the roomle-ui tests (`hi-mcp-server/export-fixture.ts`), decision D94 of `docs/hi-mcp-behaviour.md` and the rule that a tool change goes into both copies. This document. |
| **ligna-store** | No change in this step. |
| **Cloudflare** | No change in this step. The PRD Worker keeps serving the live store. |

## What was asked and why

RML-18196 removes the HI MCP server hosted on Cloudflare: the page provides the HI tools itself.
This analysis covers the first step only:

- **Copy** the MCP server implementation from roomle-hi-example into roomle-ui,
  `packages/embedding-lib/src/homag-intelligence`, and expose it in `packages/embedding-lib/src/hi.ts`.
- **Migrate the HI presets demo** of roomle-ui (`packages/embedding-lib/examples/demos/hi-presets-example.ts`)
  to the new implementation.
- **Out of scope:** the Vercel AI SDK and the connection to the AI agent. Read here as: the
  embedding-lib imports no AI SDK and knows no model, provider, key or agent loop. The demo keeps
  its loop (`streamText`, `loadChatModel`, the step limit, the prompts) unchanged; only the source
  of its `tools` changes.

"Copy", not "move": the ligna-store and the example page of this repository still call the server
(the backlog item, §2.1), so the server and its tests stay in roomle-hi-example until those hosts
switch in later steps of the ticket.

The reason for the whole ticket: every tool call leaves the browser and comes back into the same
page — page → Worker → container → WebSocket bridge → the same page → `roomDesignerApi.extended`.
Since ADR 0007 every plan-changing tool is one planner call, so what the server adds is plain
TypeScript that can run in the page.

## How it works today

### The MCP server (roomle-hi-example `hi-mcp/hi-mcp-server`)

| File | Lines | What it holds | Node or network |
|---|---|---|---|
| `hi-mcp-server.ts` | 1007 | `createHiMcpServer(plannerApi): McpServer` (`:159`). 28 tools, each registered with `server.registerTool` — name, description, a zod raw shape as input schema, handler (`:212`–`:1004`). The served text: `MOUNTING_GUIDANCE` (`:15`), `AUTHORING_RULES` (`:21`), `INSTRUCTIONS` (`:83`), `SKILL_IN_SESSION` (`:94`). Result shaping: `textResult` with `withoutImageUrls` (`:116`–`:126`), the two images of `get-plan-images` (`:973`–`:1004`). The tool log `runTool` (`:174`–`:198`). The Skills extension of MCP: the skill resources (`:459`–`:479`), `skills/list` and `skills/get` (`:481`–`:507`). | the MCP SDK (`McpServer`, `McpError`, `:1`–`:2`) |
| `tool-executors.ts` | 577 | The executor per tool (`toolExecutors`, `:380`–`:577`); the forward of the plan-changing tools (`inPlanner`, `:361`–`:378`); the plan context in the agent's words, `find-attributes`; one plan change at a time (`planChanges`, `oneAtATime`, `:104`–`:111`); the undo record (`countingPlannerApi`, `recorded`, `revertToolCall`). | module-level state: the queue `planChanges` (`:104`) and the `planHistory` singleton (`:8`) |
| `agent-facing.ts` | 287 | Wall names, corners, the wall of a door or window. | none, no imports |
| `plan-history.ts` | 129 | `PlanHistory` (`:18`–`:119`), the singleton `planHistory` (`:121`), `connectPlanHistory` that feeds it the bridge's `historyChange` events and resets it when a page connects (`:123`–`:129`). | the singleton; the bridge |
| `planner-api.ts` | 65 | The `PlannerApi` type: the six planner methods (`:7`–`:29`). `createPlannerApi` relays them over the bridge with the timeouts 30 s and 120 s (`:31`–`:65`, `page-bridge.ts:5`–`:6`). | the bridge |
| `skills.ts` | 197 | The planning skills: frontmatter parser, `loadSkills` at module load (`:197`), `readSkillFile` (`:177`–`:195`), `skillManifest` with SHA-256 digests for the Skills extension (`:166`–`:174`). | `node:crypto`, `node:fs`, `node:path`, `node:url`, `Buffer` (`:1`–`:4`, `:168`) |
| `skills/` | 10 files, 123 KB | Four skills in the Agent Skills format: `image-planning`, `kitchen-planning`, `kitchen-planning-fr`, `living-room-planning`, each with `SKILL.md`, three of them with `references/`. | none |
| `server.ts`, `page-bridge.ts`, `types.ts` | 158, 159, 47 | HTTP `/mcp`, the WebSocket `/bridge`, a new `McpServer` per request (`server.ts:57`–`:59`), the planner-call log line (`page-bridge.ts:144`–`:146`), the call timeout (`:149`–`:153`). | yes |

Only `skills.ts` uses Node APIs among the files that carry tool logic. The tests:
`tool-executors.test.ts` (1942 lines), `hi-mcp-server.test.ts` (1825, drives the server with the MCP
`Client` over `InMemoryTransport` and a fake page socket), `skills.test.ts` (328, writes skill
directories to a temp dir with `node:fs`), `interior-fittings.test.ts` (216, MCP client),
`plan-history.test.ts` (97), and the network-only `page-bridge.test.ts`, `planner-api.test.ts`,
`fake-page-socket.ts`, `example-launcher.test.ts`.

### The HI presets demo (roomle-ui `release/bo-test`)

- `hi-presets-example.ts:448`–`:449` reads the URL parameters `api_key` and `mcpServer`; the
  assistant window is enabled only with both (`featureFlags.planningAssistant: !!apiKey && !!mcpServer`,
  `:477`). `:631`–`:640` starts the assistant with `mcpServer`.
- `examples/utils/homag-intelligence/planning-assistant.ts` runs the agent in the page:
  - the AI SDK and the providers from esm.sh with `deps=zod@4.6.5` (`:9`), `loadChatModel`
    (`:62`–`:111`);
  - the allow-list of the six planner methods (`PLANNER_METHODS`, `:15`–`:22`);
  - `mcpServer` in `PlanningAssistantOptions` (`:54`–`:55`), a session and client id per page and
    the `/mcp` and `/bridge` URLs (`:128`–`:135`);
  - per turn a new `createMCPClient` (`:172`–`:181`), `tools: await mcpClient.tools()` (`:187`),
    `close` in `finally` (`:215`);
  - `onHistoryChange` forwarded to the bridge (`:223`–`:226`);
  - the WebSocket bridge with `hello`, `ready`, `call` → `extended[method](...args)` → `result`,
    the reconnect every 3 s and the availability messages to the window (`:219`–`:281`).
- The ticket and the backlog item name a `DEFAULT_MCP_SERVER` in `planning-assistant.ts`; it no
  longer exists. The demo has no default server: without `mcpServer` there is no assistant.
- Tests: `tests/unit/embedding-lib/homag-intelligence/planning-assistant.spec.ts` mocks
  `@ai-sdk/mcp` (`:14`–`:19`) and `WebSocket` (`:43`–`:48`) and tests the bridge: the forward of
  scoped interior reads (`:86`), a failed turn left out of later requests (`:118`), no reconnect
  after abort (`:150`). `hi-presets-example.spec.ts:53`–`:62` checks that the assistant needs both
  `api_key` and `mcpServer`.

### The embedding-lib

- `src/hi.ts` is the `./hi` entry: `setupHi`, the HI callbacks, the requests, the order manager and
  types. `src/homag-intelligence/` holds `hi-callbacks.ts`, `hi-order-manager.ts`, `hi-requests.ts`,
  `hi-setup.ts`, `hi-utils.ts`.
- The package has no dependencies (`public/package.json`); the build bundles everything. zod is
  not in roomle-ui's `package-lock.json` at all.
- The build (`config/vite.config.embedding.mts`) has three entries: the main file, `hi` and
  `embedding-plugins` (`:67`–`:92`). The size check `conditional-size-check` (`:109`–`:127`) is
  meant for the main bundle only, as its comment says, but runs `fileSizeCheck(16)` on the whole
  bundle as soon as the main file is in it; `vite-file-size-check.ts` throws for every chunk or
  asset above 16 KB.
- Types are emitted by `vite-plugin-dts` with `tsconfig.dts.json` (`rollupTypes: false`), so
  every source file gets its own `.d.ts`.
- A planner call is `extended.<method>(...)`, a `postMessage` request that returns a promise
  (`src/connector.ts:70`–`:109`, `packages/common/src/utils/message-handler.ts:79`). It has no
  timeout.
- Unit tests run with vitest 4.1.2 in happy-dom (`config/vite.config.ui.mts:81`–`:86`);
  `npm run test:unit` runs `npm run lint` first. oxlint allows `any`.

## The gap

What cannot be copied as it is:

1. **The MCP protocol.** The hosts need an AI SDK tool set — what `mcpClient.tools()` returns
   today — not a server. `McpServer`, `McpError`, `INSTRUCTIONS` (sent with `initialize`, read by
   none of the three hosts' loops) and the Skills extension (`skills/list`, `skills/get`, the skill
   resources; read only by external MCP clients) have no consumer in the page.
2. **The skills are read from disk** with `node:fs` at module load.
3. **The state is per process.** The queue and the `PlanHistory` are module singletons; the server
   resets the history when a page connects. In the page there can be one tool set per planner
   instance.
4. **The history events come from the bridge.** The undo record needs the planner's
   `onHistoryChange`; today the page forwards it over the WebSocket.
5. **The timeouts and the planner-call log are the bridge's.** A `postMessage` call has neither.
6. **The embedding-lib has no zod**, its size check fails any file above 16 KB, and its emitted
   types must not make zod a dependency of the hosts.
7. **The model-facing surface is produced by other code.** Today the MCP SDK converts the zod
   shapes to JSON Schema and `@ai-sdk/mcp` turns the MCP results into model output. With a plain
   tool set the AI SDK does both. See [The model-facing surface](#the-model-facing-surface).

## Proposed design

### Location, names, entry

The tool code goes to `packages/embedding-lib/src/homag-intelligence/hi-mcp/`, a subfolder as the
ticket names it, so the 6 files and the `skills/` folder stay apart from the existing HI files. The
files keep their names (decision of the ticket): `hi-mcp-server.ts`, `tool-executors.ts`,
`agent-facing.ts`, `plan-history.ts`, `planner-api.ts`, `skills.ts`, `skills/` (copied unchanged).
`server.ts`, `page-bridge.ts` and `types.ts` are not copied.

`src/hi.ts` exports one function:

```ts
createHiMcpTools(roomDesignerApi): Promise<HiMcpTools>
```

- It is asynchronous because it loads the tool code with one dynamic `import()` of
  `./homag-intelligence/hi-mcp/hi-mcp-server`. zod, the tool text and the skills then form a lazy
  chunk that only a host creating the tool set loads; `hi.js`, which every HI host loads, grows by
  a few lines. This removes the bundle-size risk the ticket names.
- `HiMcpTools` is a record of tool name → tool, each with `type: 'dynamic'`, `description`,
  `inputSchema`, `execute` and `toModelOutput`: the shape the AI SDK's `streamText` accepts as `tools` — the same tools `mcpClient.tools()`
  returns today (see [The model-facing surface](#the-model-facing-surface)). The type is declared
  in the embedding-lib; it names neither zod nor the AI SDK, so the public `hi.d.ts` adds no
  dependency to a host.
- `roomDesignerApi` is typed as the `PlannerApi` of `planner-api.ts`: the six planner methods plus
  `callbacks.onHistoryChange`.

### What changes in the copied files

| File | Change |
|---|---|
| `hi-mcp-server.ts` | `createHiMcpServer` becomes `createHiMcpTools`. Each `server.registerTool` call becomes a call of a small `registerTool` of the tool set with the same arguments, so descriptions, shapes and handlers stay character for character; it adds the schema, the validation, the error results and `toModelOutput` of [The model-facing surface](#the-model-facing-surface). `runTool` and its log lines stay. Removed: `McpServer`, `McpError`, `INSTRUCTIONS`, `SKILLS_EXTENSION`, `SKILL_ENTRIES`, the skill resources, `skills/list`, `skills/get`. |
| `tool-executors.ts` | The executor table is built per tool set: the queue `planChanges` and the `PlanHistory` become members of the tool set instead of module state. The executors themselves stay. |
| `plan-history.ts` | `PlanHistory` stays. The singleton and `connectPlanHistory` go: a new tool set starts with an empty history, which is what `reset()` on a page connect did. |
| `planner-api.ts` | The `PlannerApi` type stays and gains `callbacks.onHistoryChange`. `createPlannerApi(bridge)` becomes a wrapper around `roomDesignerApi.extended`: each of the six methods with the timeout of today (30 s; 120 s for `externalObjectGroupOperation` and `getExternalObjectSnapshot`), the timeout error text of today and the planner-call log line of today (`page-bridge.ts:144`–`:153`). |
| `skills.ts` | The skill files come from `import.meta.glob('./skills/**/*', { query: '?raw', import: 'default', eager: true })` inside the lazy chunk, instead of `node:fs`. The frontmatter parser, `loadSkills` checks, `skillIndex` and `readSkillFile` stay. `skillManifest`, `createHash` and `Buffer` go: they served only the Skills extension. |
| `agent-facing.ts` | Unchanged. |

### History events

At creation the tool set reads the host's `extended.callbacks.onHistoryChange` and installs a
handler that calls `PlanHistory.historyChanged()` and then the host's handler, as
`hi-mcp-client/browser-bridge.ts:102`–`:112` does today. A host that sets its own handler sets it
before it creates the tool set. The demo sets none once the bridge is gone.

### The tool log

`runTool` writes the lines of today to the page console: `[hi-mcp] tool <name>`, `… args <json>`,
`… feedback <json>`, `… error <json>`. The planner wrapper adds the `[hi-mcp] call <n>` line that
`page-bridge.ts` writes today. It writes no line with the result of a planner call: that line would
put the snapshot images of every `get-plan-images` (hundreds of KB) into the console of every host,
the live store included. The step of the ticket that moves the prompt runner of this repository to
the page records the planner calls in the example page instead, by wrapping the planner API the
page hands to `createHiMcpTools` (confirmed by the user on 2026-10-20).

### The model-facing surface

The change is in transport and place only; what the model sees must not change. Today two
libraries produce that surface, and a plain zod tool set would hand both jobs to the AI SDK, which
does them differently. Traced in the installed `@modelcontextprotocol/sdk` 1.30.0, `@ai-sdk/mcp`
2.0.62, `ai` 7.0.122 and `@ai-sdk/provider-utils` 5.0.51 (`node_modules` of this repository), and
checked with a probe of both paths against the AI SDK's mock model:

| | Today: MCP server → `@ai-sdk/mcp` | A plain zod tool set |
|---|---|---|
| Input JSON Schema | The MCP SDK converts the shape with zod's `toJSONSchema`, target `draft-7`, io `input` (`server/zod-json-schema-compat.js:18`–`:24`, `server/mcp.js:75`–`:82`). `@ai-sdk/mcp` wraps it in `jsonSchema()` with `additionalProperties: false` added (`dist/index.js:3226`–`:3236`): `additionalProperties: false` on the top level only, `$schema` kept. | The same conversion (`provider-utils` `zod4Schema`, `dist/index.js:3229`–`:3247`), then `addAdditionalPropertiesToJsonSchema` (`:1949`–`:1986`) sets `additionalProperties: false` on **every nested object** as well. |
| Who validates | The MCP server only; `jsonSchema()` without `validate` lets every input through the AI SDK (`provider-utils` `:3278`). | The AI SDK, before `execute`. |
| Invalid input | A normal tool result, no error flag: `MCP error -32602: Input validation error: Invalid arguments for tool <name>: <message> at <path>`, one line per issue (`server/mcp.js:166`–`:180`, `server/zod-compat.js:141`–`:152`). | An `error-text` output: `AI_InvalidToolInputError: Invalid input for tool <name>: AI_TypeValidationError: Type validation failed: Value: {…}. Error message: [<the issues as pretty JSON>]` (`ai` `dist/index.js:4751`–`:4773`, `:9612`–`:9640`, `:2184`). Anthropic gets `is_error`. |
| A tool that throws | A normal tool result, no error flag, text = the error message (`server/mcp.js:100`–`:161`). | An `error-text` output `Error: <message>` (`ai` `:3739`–`:3757`). |
| Result and images | `execute` returns the MCP result; `mcpToModelOutput` (`@ai-sdk/mcp` `:2582`–`:2602`) makes text parts and, for an image, a `file` part with the base64 data. | Whatever the tool set's `toModelOutput` returns. |
| Tool kind | `dynamicTool` (`type: 'dynamic'`). | static, unless set. |

The hosts also read the MCP result: the ligna-store's recovery (`hi-mcp/chat-recovery.ts:137`,
`:147`) and the example's chat backend (`hi-mcp-chat/chat-recovery.ts:157`, `:172`) check
`result.isError`.

So the tool set does in-process what the page no longer gets from the two libraries — the
`tools/call` handler of the MCP SDK and the tool wrapper of `@ai-sdk/mcp`:

- **`inputSchema`** is a Standard Schema of the tool set, not the zod schema itself: its
  `jsonSchema.input()` returns zod's `toJSONSchema` of `z.object(shape)` with target `draft-7` and io
  `input`, the call the MCP SDK makes, and its `validate` passes every value through. The AI SDK takes the
  Standard Schema path (`provider-utils` `asSchema`, `:3176`–`:3209`), so it neither validates nor
  rejects the input.
- **`execute`** validates with the zod schema and returns the MCP result: on invalid input one
  text part `MCP error -32602: Input validation error: Invalid arguments for tool <name>: <issues>`,
  the issues formatted as the MCP SDK formats them, and `isError: true`; when the executor throws,
  the same with the error message; otherwise the content the server's handler returns today (`textResult`, the
  images of `get-plan-images`, the preamble of `get-skill`).
- **`toModelOutput`** is `mcpToModelOutput` of `@ai-sdk/mcp`, copied.
- **`type: 'dynamic'`**, as the MCP tools are.

With that, the result text, the images, the validation errors, the thrown errors and the
`isError` the hosts read are the same as today, and a host keeps its loop and its recovery. One
difference remains: the AI SDK also runs a Standard Schema through `addAdditionalPropertiesToJsonSchema`,
so nested objects get `additionalProperties: false`. Only the AI SDK's own schema value —
`jsonSchema()`, marked with `Symbol.for('vercel.ai.schema')` (`provider-utils` `:3147`, `isSchema`
`:3173`) — skips that pass; building that marker without importing the AI SDK depends on an
internal of it. See [Decisions](#decisions).

This also answers the zod copy: the AI SDK detects zod and Standard Schemas by duck typing
(`~standard`, `_zod`), and zod keeps the `.describe()` texts in a registry on `globalThis`. The
probe with a second zod copy produced the same JSON Schema and the same issues.

### The demo

`planning-assistant.ts`:

- Remove `PLANNER_METHODS`, `mcpServer` in `PlanningAssistantOptions`, the session and client ids
  and URLs, the `@ai-sdk/mcp` import, `createMCPClient` and `close`, the `onHistoryChange` forward,
  the WebSocket bridge with its reconnect and its availability messages.
- Add `createHiMcpTools(roomDesignerApi)` (from `@roomle/embedding-lib/hi`, which the demo already
  imports) to the `Promise.all` of the setup, and pass the tool set as `tools` to `streamText`.
- Send the `availability` output with `available: true` once the setup succeeded; today the bridge's
  `ready` sends it.
- Unchanged: the AI SDK imports, `loadChatModel`, `MAX_CHAT_STEPS`, `prepareStep`, the prompts, the
  conversation, the `images` output.

`hi-presets-example.ts`: drop `mcpServer` (`:449`), enable the assistant with
`planningAssistant: !!apiKey` (`:477`), start it without `mcpServer` (`:631`–`:640`).

### Tests (roomle-ui, `tests/unit/embedding-lib/homag-intelligence/hi-mcp/`)

- **Ported:** `tool-executors`, `plan-history`, `skills` (synthetic skill maps instead of temp
  directories), `interior-fittings` and `hi-mcp-server` (tool list, log format, results) — calling
  the tool set directly instead of an MCP client over `InMemoryTransport` and the fake page socket.
- **New:**
  - every tool's name, description and input JSON Schema (`inputSchema['~standard'].jsonSchema.input()`)
    equals a fixture of today's `tools/list`, produced once from the server at `433f7e9`;
  - invalid input and a throwing executor give today's MCP result: the text, `isError: true`, and
    the model output of `mcpToModelOutput`;
  - `get-plan-images` gives the two `file` parts;
  - the tool set calls only the six planner methods; this test replaces the allow-list of the
    bridge (D1 and D2 of `docs/hi-mcp-behaviour.md`);
  - two tool sets do not share a queue or a history;
  - the history handler chains the host's handler;
  - the planner call timeouts.
- **Updated:** `planning-assistant.spec.ts` loses the `@ai-sdk/mcp` and `WebSocket` mocks and the
  three bridge tests and checks that the tool set reaches `streamText`. `hi-presets-example.spec.ts`
  enables the assistant with `api_key` alone.
- **Not ported:** `page-bridge`, `fake-page-socket`, `planner-api` (replaced by the six-methods
  test), `example-launcher`.

## Alternatives considered

- **An MCP server in the page** behind an in-memory transport: rejected by the ticket. It brings the
  MCP SDK into the host bundle and gives the three hosts nothing a tool set does not.
- **The zod schemas handed to the AI SDK as they are:** fewer lines, but the AI SDK then validates,
  and the model gets other texts for invalid input and for a tool that throws, as an error output
  instead of a result. The `isError` that the hosts' recovery reads would be gone too
  ([The model-facing surface](#the-model-facing-surface)).
- **Move instead of copy:** not possible in this step. The ligna-store and the example page still
  call the server, and the PRD Worker serves the live store.
- **The tool code statically in `hi.js`**, as the backlog item assumes: every HI host would load
  zod and about 2,000 lines of tools and text, also without a chat. One dynamic import costs an
  `async` factory and nothing else.
- **A synchronous factory with only the skills lazy:** the `get-skill` description lists every
  skill's name and description, so the frontmatter of every `SKILL.md` is needed when the tool set
  is created. Either the `SKILL.md` files are eager after all, or the factory is asynchronous; the
  dynamic import above makes it asynchronous anyway.

## Decisions

Confirmed by the user on 2026-10-20.

1. **Nested `additionalProperties: false` is accepted.** The tool set hands over today's JSON
   Schema, but the AI SDK adds `additionalProperties: false` to every nested object, where today
   only the top level has it. Equal to the provider as well needs the AI SDK's internal schema
   marker. A nested object with an extra key is rejected neither today nor then (zod strips
   unknown keys); the schema only tells the model not to send one.
2. **A `streamText` turn with the AI SDK's mock model is a unit test.** It is the only automated
   check that the AI SDK takes the tool set as the hosts use it; `ai` (7.0.122, the demo's version)
   becomes a dev dependency of roomle-ui, for the test only. The embedding-lib does not import it.
3. **`createHiMcpTools` is asynchronous**, different from the ticket's synchronous
   `createHiMcpTools(roomDesignerApi, options?) → ToolSet`, so the tool code is a lazy chunk.
   No `options` either: nothing in this step needs one.
4. **The code goes into the subfolder `src/homag-intelligence/hi-mcp/`**, as the ticket names it,
   not directly into `src/homag-intelligence/`.
5. **Tool changes while there are two copies:** a tool change goes into both copies in the same
   task until the server is deleted, and the roomle-ui fixture is regenerated with it.

## The code and documents the work touches

roomle-ui `release/bo-test`:

- new: `packages/embedding-lib/src/homag-intelligence/hi-mcp/` (6 files and `skills/`);
- `packages/embedding-lib/src/hi.ts` — `createHiMcpTools` and its types;
- `package.json`, `package-lock.json` — zod `4.6.5` in `dependencies`, the version the server and the
  demo's esm.sh imports use (bundled into the tool code; the published package keeps no
  dependencies); `ai` `7.0.122` in `devDependencies`, for the `streamText` test only (decision 2);
- `config/vite.config.embedding.mts:109`–`:127` — the size check on the main file only;
- `packages/embedding-lib/examples/utils/homag-intelligence/planning-assistant.ts`,
  `packages/embedding-lib/examples/demos/hi-presets-example.ts`;
- `tests/unit/embedding-lib/homag-intelligence/` — the tests above;
- `packages/embedding-lib/docs/homag-intelligence-embedding.md` — a section on `createHiMcpTools`;
  the planning assistant section (`:1978`) and the `getExternalObjectAgentPrompts` text (`:1956`)
  name the tool set instead of the HI MCP server; the `api_key` row (`:2319`) without `mcpServer`;
  the `mcpServer` row (`:2321`) goes;
- `packages/web-sdk/packages/homag-intelligence/src/hi-agent-prompts.ts:1`, `:9`–`:10` and
  `.agents/homag-intelligence.md:241` — the skills are served by the tool set of the embedding-lib.

roomle-hi-example: this document and its index rows; `hi-mcp/hi-mcp-server/export-fixture.ts` and
the script `export:fixture`; D94 in `docs/hi-mcp-behaviour.md`; the two-copies rule in `AGENTS.md`
and `.agents/skills/hi-mcp-server.md`; the script in `.agents/context/deployment-and-testing.md`.
The server, its docs and its skills stay until the later steps of the ticket.

## Risks

- **Two copies until the server goes.** From this step until the store and the example switch, a
  tool change has to be made in both copies, or the demo and the other hosts plan with different
  tools. The fixture test catches a drift in roomle-ui only against the copied state.
- **The model-facing surface.** It stays the same except for the nested
  `additionalProperties: false` (decision 1). A "test the mcp" run per model, compared per
  test with a reference run of the server build, confirms it — only on request.
- **A lazy chunk in a library build with two outputs.** The plain and the minified output each get
  their own chunk; `hi.js` and `hi.min.js` must load their own one. The build check below covers
  it.

## Verification

1. `npm run build:embedding` passes; the main file stays under 16 KB, `hi.min.js` grows only by the
   factory, and the tool code is a separate chunk.
2. `npm run test:unit` is green.
3. A live turn in the demo with `api_key` and no `mcpServer` creates a group, changes an attribute,
   is undone by `undo` and renders `get-plan-images`; the browser makes no request to `workers.dev`
   or to a local MCP server.
