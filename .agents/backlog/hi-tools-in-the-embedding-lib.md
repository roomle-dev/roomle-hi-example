# Backlog: the HI tools in the embedding-lib instead of the Cloudflare MCP server

> **Type**: Backlog item (architecture)
> **Domain**: the HI MCP server `hi-mcp/hi-mcp-server`, its Cloudflare deployment `hi-mcp/cf`, the page bridges and the chats of the three hosts; roomle-ui `packages/embedding-lib`
> **Status**: Open — analysed 2026-10-16; the decisions of §6 are taken

## Affected repositories

- **roomle-ui** — a new embedding-lib entry point holds the tools, the served text, the planning
  skills and the undo bookkeeping. The HI presets demo (`hi-presets-example.ts`) uses it instead of
  the hosted server.
- **ligna-store** — the chat takes its tools from the embedding-lib. The page bridge, the MCP
  client and the server URL handling go.
- **roomle-hi-example** — the MCP server, the page bridges, the Cloudflare deployment and the
  external-client setups go. The example page uses the embedding-lib tools. The test runner reads
  from the page instead of the server. The docs, ADRs and skills follow.
- **Outside the code** — the Cloudflare Workers and containers (PRD, DEV, the personal
  `hi-mcp-poc`), the GitHub environments `cloudflare` / `cloudflare-dev` and the branches
  `release/cloudflare` / `release/cloudflare.dev`.

## 1. Goal and scope

Decided by the user on 2026-10-16:

- **Remove the hosted MCP server.** The page itself provides the HI tools.
- **Only three consumers.** The tools are used by:
  - roomle-ui `packages/embedding-lib/examples/demos/hi-presets-example.ts`;
  - the HI presets example of this repository (`minimal-hi-example/index.html`);
  - the ligna-store.

  There is no other use case: no external MCP client (Claude Code, Claude Desktop, Copilot,
  Ollama, Jan AI, Le Chat).
- **The implementation goes into the embedding-lib** (roomle-ui).
- **Only the MCP server goes into the embedding-lib:** its tools, its served text, its planning
  skills and its undo record.
- **The Vercel AI SDK part stays in the hosts in this step.** That is the agent loop (`streamText`,
  the step limit, the recovery) and the mapping of models to providers:
  - the Foundry base URL;
  - the model aliases;
  - the reasoning effort per model;
  - the lists of models that read images;
  - the Mistral image middleware.

  This part is hard-coded per host and is not a general solution yet. Each host keeps its loop and
  replaces only its MCP client with the tool set.

## 2. Today

### 2.1 The three consumers

Every tool call leaves the browser and comes back into the same page:

```text
page (agent loop) ──HTTP /mcp?session&client──> Worker ──> container (hi-mcp-server)
      ▲                                                          │
      └───────────── WebSocket /bridge, same page ◄──────────────┘
                     roomDesignerApi.extended.<one of six planner methods>
```

| Consumer | Agent loop | Provider key | Tools from | Page bridge |
|---|---|---|---|---|
| roomle-ui HI presets demo (on `release/bo-test`, not on master) | in the page, AI SDK from esm.sh (`examples/utils/homag-intelligence/planning-assistant.ts`) | page URL `api_key` | PRD Worker, `DEFAULT_MCP_SERVER` (`planning-assistant.ts:5-6`) | inline (`planning-assistant.ts:218-271`) |
| ligna-store (`master`) | in the page, AI SDK from npm (`hi-mcp/chat.ts:117-172`) | store URL `api_key` | PRD Worker, unless `mcp_server` names another (`hi-mcp/chat-options.ts:39`, `:70-85`) | `hi-mcp/browser-bridge.ts`, a copy of `hi-mcp/hi-mcp-client/` |
| HI presets example | Node backend `hi-mcp/hi-mcp-chat` on :3200 | launcher CLI argument → backend environment (ADR 0003) | local server :3100, or the DEV Worker with `npm run start:cf` | inline (`minimal-hi-example/index.html:930-1080`) |

How the pieces fit together:

- **Every loop is the AI SDK.** Each one calls `createMCPClient(...).tools()` and passes the result
  to `streamText`.
- **The system prompt is the planner's.** It comes from `getExternalObjectAgentPrompts` (roomle-ui
  `homag-intelligence/src/hi-agent-prompts.ts`).
- **The server's `INSTRUCTIONS` reach no model.** The constant (`hi-mcp-server.ts:67`) is sent
  with `initialize`, and none of the three loops reads it. Only external MCP clients ever did.
- **The embedding-lib runs in the host page.** The planner runs in an iframe:
  `roomDesignerApi.extended.<method>(...)` is a `postMessage` call that returns a promise
  (`packages/embedding-lib/src/connector.ts:70-109`, `packages/common/src/utils/message-handler.ts:79`).
- **The bridge already calls exactly that.** It executes each planner method in the page with
  `extended[method](...args)`.

### 2.2 What the server does

Since ADR 0007, every plan-changing tool is a single call, `externalObjectGroupOperation(<tool>,
<args>)`, which roomle-ui performs. The server keeps the following:

| Part | Where | Node or network only? |
|---|---|---|
| Tool registry: 21 tools, zod input schemas, descriptions, `AUTHORING_RULES`, `INSTRUCTIONS` | `hi-mcp-server.ts` (786 lines) | no; `McpServer` is the only MCP piece |
| Result shaping: compact JSON without `imageUrl` (`textResult`, `:91-98`), images of `get-plan-images` (`:755ff`) | `hi-mcp-server.ts` | no |
| Tool log: `[hi-mcp] tool X`, `… args`, `… feedback`, `… error` (`runTool`, `:139-163`) | `hi-mcp-server.ts` | stdout |
| Plan context in the agent's words, `find-attributes`, forward of the plan-changing tools | `tool-executors.ts`, `agent-facing.ts` | no |
| One plan change at a time (`oneAtATime`, `tool-executors.ts:103`) | `tool-executors.ts` | module-level queue |
| Undo record of the tool calls (`countingPlannerApi`, `recorded`, `:135-194`; `PlanHistory`) | `tool-executors.ts`, `plan-history.ts` | module-level singleton (`plan-history.ts:121`); fed by the bridge's `historyChange` events |
| Planning skills (`get-skill`), about 123 KB of Markdown in `skills/` | `skills.ts` | reads files with `node:fs` (`skills.ts:1-3`) |
| The six planner methods with timeouts of 30 s / 120 s | `planner-api.ts`, `page-bridge.ts:5-6` | bridge |
| HTTP `/mcp`, CORS, `?client=` → 409 | `server.ts` | yes |
| WebSocket `/bridge`: page registry, close 4409, call correlation, "No HI page connected" | `page-bridge.ts`, `types.ts` | yes |
| Cloudflare Worker and container per `?session=`; at most 5 instances; 15 min sleep, then ~10 s cold start | `hi-mcp/cf/` | yes |

Only the last three rows exist because of the network. Everything else is plain TypeScript that
runs in a browser once the skills are bundled and the module-level state becomes per instance.

## 3. Proposed design

### 3.1 The MCP server in `packages/embedding-lib/src/homag-intelligence`

The MCP server's files move into `packages/embedding-lib/src/homag-intelligence/hi-mcp/` and keep
their names: `hi-mcp-server.ts`, `tool-executors.ts`, `agent-facing.ts`, `plan-history.ts`,
`skills.ts` and `skills/`. `src/hi.ts` (the `./hi` entry) exports one function in place of
`createHiMcpServer`:

```ts
createHiMcpTools(roomDesignerApi, options?) → ToolSet
```

It is AI SDK compatible but does not import the AI SDK. It knows no model, no provider and no
key. The host passes the tool set to its own `streamText` in place of `mcpClient.tools()`.

- **Each tool** is `{ description, inputSchema, execute, toModelOutput }`.
- **`inputSchema` is a Standard Schema.** AI SDK 7 accepts these as `FlexibleSchema`
  (`@ai-sdk/provider-utils` `index.d.ts:836-841`); zod 4 schemas implement it. The zod schemas of
  `hi-mcp-server.ts` move unchanged.
- **`execute` is the executor of `tool-executors.ts`.** It runs on `roomDesignerApi.extended`
  directly.
- **`toModelOutput` returns exactly what the model gets today:**
  - the compact JSON text without `imageUrl`;
  - the two images of `get-plan-images` as file parts.
- **Per instance:**
  - the plan-change queue (`oneAtATime`) and the `PlanHistory`;
  - one `onHistoryChange` handler that chains the host's own handler, as `browser-bridge.ts`
    does today.

  A planner remount (the store's locale switch) creates a new tool set.
- **Planner calls keep the timeouts of today**: 30 s, and 120 s for `externalObjectGroupOperation`
  and `getExternalObjectSnapshot`. A `postMessage` call has no timeout of its own.
- **The tool log goes to the page console**, in the format of today (`[hi-mcp] tool X args|feedback|error
  <json>`). It adds one line per planner call with method, arguments, result and time; these
  replace the bridge frames the test runner records (§5).
- **The planning skills are bundled.** The `get-skill` description needs only the frontmatter
  index. Each skill's files load as a lazy chunk on first use.
- **No `INSTRUCTIONS`.** The constant goes, because it reaches none of the three loops (§2.1).
  `AUTHORING_RULES` stays as the result of `get-authoring-rules`.
- **The six planner methods stay the security boundary.** The tool set calls only these methods,
  and a unit test pins the list. That test replaces the bridge allow-list (D1 and D2 of
  `hi-mcp-behaviour.md`); it adds no new restriction for the agent. There is no remote caller any
  more: the model reaches the planner only through these tools.

**No MCP protocol in the page.** The consumers need a `ToolSet`, which is what
`mcpClient.tools()` produces today. A browser `McpServer` behind an in-memory transport would
deliver the same tool set over JSON-RPC. It would also bring the MCP SDK into the host bundle: its
server imports `ajv`, and the package depends on express, hono and others (`@modelcontextprotocol/sdk`
1.30.0). That buys nothing for these three consumers.

**Bundle size.** The embedding-lib has no dependencies (`packages/embedding-lib/public/package.json`),
and its build fails any minified chunk above 16 KB:

- The limit is `config/vite.config.embedding.mts:8`.
- The check at `:107-125` runs on the whole bundle as soon as the main file is in it, although its
  comment says "only … main bundle". Today the main bundle is 15.0 KB and `hi.min.js` 4.1 KB.
- `hi.js` then carries zod and about 2,000 lines of tools and text; the skills are lazy chunks.
  The check has to be narrowed to the main file, as its comment intends.

### 3.2 What moves, what goes

| Today (roomle-hi-example) | After |
|---|---|
| `hi-mcp-server/hi-mcp-server.ts`, minus `McpServer` and `INSTRUCTIONS` | `src/homag-intelligence/hi-mcp/hi-mcp-server.ts` |
| `tool-executors.ts`, `agent-facing.ts`, `plan-history.ts` | `src/homag-intelligence/hi-mcp/`, same names, state per instance |
| `skills.ts` + `skills/` | `src/homag-intelligence/hi-mcp/`; files bundled, no `node:fs` |
| `planner-api.ts` | the `PlannerApi` type plus the timeouts |
| `server.ts`, `page-bridge.ts`, `types.ts` | deleted |
| `hi-mcp-client/` (reference bridge) and its copies in ligna-store and `index.html` | deleted |
| `hi-mcp/cf/`, `.github/workflows/deploy-cloudflare.yml` | deleted |
| The AI SDK part of the hosts: roomle-ui demo `planning-assistant.ts`, ligna-store `hi-mcp/chat.ts`, `chat-host.ts`, `chat-options.ts`, `chat-recovery.ts`, the example's `hi-mcp-chat/` | stays in the host (§1); only the MCP client is replaced by the tool set |
| `hi-mcp-chat/` as a backend process | deleted; its loop, provider mapping, recovery, image middleware and step log move into the example page (§6) |
| Server unit tests: `tool-executors`, `plan-history`, `skills`, `hi-mcp-server` (tool list, log format) | move to roomle-ui `tests/unit/embedding-lib/homag-intelligence/` (vitest) |
| Server unit tests: `page-bridge`, `fake-page-socket`, `planner-api`, `cf/tests`, `hi-mcp-client/tests` | deleted; `planner-api` becomes "the tool set calls exactly the six planner methods" |

### 3.3 The model-facing surface stays the same

The change is in transport and location only. What the model sees must not change:

- **The tool names, descriptions and input JSON Schemas are identical to today's `tools/list`.**
  The MCP SDK and the AI SDK each convert zod to JSON Schema in their own way. A unit test
  compares every tool's schema with a fixture of today's `tools/list` answer.
- **The result text and the images are identical.** The tool set returns the images as file
  parts, as `@ai-sdk/mcp` delivers them today. Moving them into a user message for Mistral
  (`hi-mcp-chat/tool-result-images.ts`) stays in the host's loop.
- **Invalid input still reaches the model as an error it can correct.** Today the MCP SDK answers
  an `isError` result with "Input validation error". Under the AI SDK, the invalid tool call comes
  back as a tool error. A unit test with the AI SDK's mock model shows that the model gets it.
- **A tool that throws still reaches the model as a tool error.** This includes a plan change that
  failed after its undo steps.

### 3.4 The example's chat

The example's agent loop runs in a Node backend (`hi-mcp-chat`). With the tools in the page, that
backend can no longer call them directly. There are two ways out:

- **The loop moves into the page**, as in the store and the roomle-ui demo:
  - the page gets its own AI SDK loop and provider mapping, as the roomle-ui demo has one
    (`planning-assistant.ts`), not from the embedding-lib (§1);
  - the launcher hands the key to the page (`api_key`, localhost only);
  - `hi-mcp-chat` goes as a process;
  - its `[hi-chat] step …` and `tool done …` lines come from the page console.
- **The loop stays in the backend** with its provider mapping, and the page executes the tool
  calls the backend streams to it. That is a bridge again (backend ↔ page), and it is the subject
  of [backend-agent-loop-with-browser-scene-tools.md](backend-agent-loop-with-browser-scene-tools.md).

## 4. The work per repository

### 4.1 roomle-ui (from `release/bo-test`, which carries the tool commands and the chat window)

1. **Move the MCP server's files** into `packages/embedding-lib/src/homag-intelligence/hi-mcp/`
   as §3.2 lists, and export `createHiMcpTools` from `src/hi.ts`. Narrow the size check.
   → verify: `npm run build:embedding` passes; the main bundle stays under 16 KB.
2. **Port the unit tests and add the surface tests of §3.3:**
   - the schema fixture;
   - the six planner methods;
   - the per-instance state;
   - the history chaining;
   - the timeouts;
   - a `streamText` turn with the mock model.

   → verify: `npm run test:unit` is green.
3. **The demo uses the tool set.**
   - `examples/utils/homag-intelligence/planning-assistant.ts`: drop `DEFAULT_MCP_SERVER`, the
     `mcpServer` option, `@ai-sdk/mcp`, the session and client ids, the bridge and its
     availability states; pass `createHiMcpTools(roomDesignerApi)` to `streamText`. The loop and
     the model mapping (`loadChatModel`) stay as they are.
   - `hi-presets-example.ts:37-41, 630-636`: drop `mcpServer`.

   → verify: a live turn in the demo creates a group, and undo reverts it.
4. **Docs and comments.**
   - `packages/embedding-lib/docs/homag-intelligence-embedding.md`: replace the `mcpServer` row
     (`:2359`) with a section on `createHiMcpTools`.
   - `hi-agent-prompts.ts:1, 9` and `.agents/homag-intelligence.md:225` place the skills and tools
     in "the HI MCP server" of roomle-hi-example; point them to the MCP tools of the embedding-lib.
5. **Release** the embedding-lib (npm).

### 4.2 ligna-store (after the embedding-lib release)

1. **Swap the tools in the chat.** `hi-mcp/chat.ts`: replace `createMCPClient` (`:123-131`) with
   the tool set the host passes in. The loop and `getLanguageModel` stay.
2. **Simplify the chat host and the options.**
   - `hi-mcp/chat-host.ts`: drop the bridge status and the 4409 retry (`:51-77`); the window is
     available once the tool set exists.
   - `hi-mcp/chat-options.ts`: drop `McpOptions`, `DEFAULT_MCP_SERVER`, `mcp_server`, `mcp_session`
     and the URL helpers.
   - `hi-mcp/chat-recovery.ts:3-28`: keep the tool names in sync with the tool set.
3. **Delete the bridge.** Delete `hi-mcp/browser-bridge.ts` and `hi-mcp/types.ts`. In
   `components/blocks/Planner.vue`, remove the bridge start and dispose (`:267-284`, `:464-469`).
4. **Dependencies and README.** `package.json`: drop `@ai-sdk/mcp` (`:22`) and bump
   `@roomle/embedding-lib` (`:25`, now 7.0.0). `hi-mcp/README.md`: rewrite.

→ verify: in the local store with `?store.stage=INT&api_key=…`, a turn creates a group and the
browser makes no request to workers.dev.

### 4.3 roomle-hi-example

1. **Example page.** `minimal-hi-example/index.html`:
   - raise the unpkg imports of `@roomle/embedding-lib` and its `hi.js` (`:225-233`, 7.1.0) to the
     release with `createHiMcpTools`;
   - delete the MCP section (`:930-1080`) and the `mcp`, `mcp_server`, `mcp_session` and
     `mcp_port` parameters;
   - run the chat in the page (§6). Load the AI SDK from esm.sh, as the roomle-ui demo does, and
     keep what `hi-mcp-chat` does today: the models of the tests, the reasoning effort, the Mistral
     image middleware, the recovery, the step limit and the step log.
2. **Load a local roomle-ui.** Add a page parameter that loads the embedding-lib from a local
   roomle-ui instead of unpkg. Without it, "test the mcp" cannot test an unreleased tool change:
   today it tests "the MCP server of the checkout".
3. **Launcher.** `minimal-hi-example/start.mjs`: remove the server spawn (`:201-213`), the chat
   backend (`:215-232`), the `hi-mcp` build gate (`:148-155`), `--cf` (`:48-57`, `:248-253`,
   `:268`) and `HI_MCP_*`. Hand the key to the page and print the example URL without it (§5).
4. **Delete:**
   - `hi-mcp/hi-mcp-server/`, `hi-mcp/hi-mcp-client/` and `hi-mcp/cf/`;
   - the workspaces and the scripts `mcp-server`, `start:cf`, `deploy:cf` and `deploy:cf:dev`;
   - `.dockerignore`, the `cloudflare:workers` alias in `hi-mcp/vitest.config.ts`, and
     `.github/workflows/deploy-cloudflare.yml`.
5. **Test runner:** see §5.
6. **Documentation** (list in §8):
   - one new ADR that supersedes 0001, 0002 and 0004 and the parts of 0003, 0005 and 0008 about
     the server;
   - a new decision row in `docs/hi-mcp-behaviour.md` §3, and its §4 rewritten (how a tool call
     runs);
   - `docs/implementation/`, `docs/hi-mcp-server.md`, the skills, `AGENTS.md`,
     `.github/copilot-instructions.md` and the READMEs.

### 4.4 Teardown (last)

1. **Wait for the releases.** The live store (`www.roomle.com/t/ligna-store/`) and the roomle-ui
   demo on bo-test call the PRD Worker today. Tear it down only after both releases without it
   are live.
2. **Cloudflare (Roomle account):** delete the Workers `hi-planning-assistant` and
   `hi-planning-assistant-dev` and their container apps.
3. **Cloudflare (personal account):** delete the Worker `hi-mcp-poc`.
4. **GitHub:** delete the environments `cloudflare` and `cloudflare-dev` with their secrets, and
   the branches `release/cloudflare` and `release/cloudflare.dev`.

Every step needs the account owner and an explicit go.

## 5. The test runner

`run-hi-mcp-prompt.js` is the only script that talks to the server. The others read the files it
writes.

| What it takes from the server today | Instead |
|---|---|
| Readiness: polls `get-plan-context` over raw JSON-RPC on :3110 (`callMcpTool`, `:264-291`; `:567-571`) | `window.hiPosGroupsCompletelyLoaded` plus the articles of `getExternalObjectPlanContext` via `evaluateInPage` |
| `plan-context.json`, the plan context in the agent's words (`:602-609`) | the `get-plan-context` tool of the page's tool set, run with `evaluateInPage` (the example exposes the tool set on `window`, as it exposes `instance`) |
| `run.json` `toolCalls` from the server's stdout lines (`TOOL_CALL_LINE`, `:56`; `recordToolCall`, `:148-189`) | the same lines from the page console (Playwright `page.on('console')`) |
| `planner-calls.json` from the bridge frames (`recordPlannerCalls`, `:326-364`) | the planner-call lines of the tool set |
| The page's `clientId` from the bridge `hello` frame (`:348-350`, `:572-576`) | not needed |
| Port 3110 for the server (`:41-45`) | not needed |

With the chat in the page (§6), the runner also loses the chat backend:

| What it takes from the chat backend today | Instead |
|---|---|
| `GET :3200/health` before the first prompt (`:554-558`) | the page's chat is ready |
| Each prompt with the whole conversation and the image as `POST :3200/chat` (`postChat`, `sendChat`, `:388-425`) | the runner hands the prompt and the image to the page's chat with `evaluateInPage` and waits for the end of the turn; the conversation lives in the page |
| `[tool]` and `[error]` lines of the stream → `turns[].tools`, `errors` (`splitChatStream`, `:366-383`) | the result of the turn, or the page console |
| `[hi-chat] step …`, `tool done …`, `chat done …` on the backend's stdout (benchmark `LINE`, `:38-45`) | the same lines from the page's loop, in the page console |
| The key on the launcher's command line | the launcher hands it to the page. The `Example:` line it prints goes into every run's `console.log`, so it prints the URL without the key, and the runner adds the key itself |

`run.json`, `planner-calls.json` and `console.log` keep their names and formats, so the report,
the benchmark and `update-planning-results.js` read them as before. The runs stay comparable to
the reference runs only if the page's loop does what `hi-mcp-chat` does (§4.3).

The benchmark matches the `[hi-mcp] tool` and `[hi-mcp] call N` lines (`benchmark-hi-mcp-runs.js:38-45`).
Its join of `[hi-mcp] call N` with `planner-calls.json` needs the new planner-call lines to carry
the same id.

The skills `hi-mcp-testing.md`, `hi-mcp-benchmarking.md` and `update-planning-results.md` describe
the server process, port 3110 and the bridge frames; they follow the runner.

## 6. Decisions

Decided by the user on 2026-10-16:

- **A plain tool set.** There is no MCP protocol in the page (§3.1).
- **Only the MCP server's tools and skills go into the embedding-lib**, under
  `src/homag-intelligence`. The AI SDK part stays in the hosts (§1).
- **The names stay.** "MCP" stays in the code, the docs and the tests.

- **The example's chat runs in the page** (option A of §3.4). The example page runs its own AI
  SDK loop, like the store and the demo, and the Node process `hi-mcp-chat` goes. The API key
  reaches the page through its URL, on localhost only.

## 7. Risks

- **Release coupling.** Today a server deploy reaches every client at once. Afterwards a tool
  change needs an embedding-lib release and a version bump in the ligna-store and in the example's
  unpkg URL. The roomle-ui demo uses the source directly. ADR 0001 rejected an npm package for this
  reason.

  Two things now weigh against that. The tool logic already lives in roomle-ui (ADR 0007). And
  the tool definitions can no longer drift from the tool commands within one repository. They can
  still drift between the embedding-lib version of a host and the Rubens UI behind its
  `server_url`; that is the same as between the server and the Rubens UI today.
- **The model-facing surface could change unnoticed.** Schema conversion, validation errors or
  the result format could differ from today. Covered by the tests of §3.3. A "test the mcp" run
  per model, compared per test with a reference run, confirms it before the teardown.
- **The provider key stays in the page.** This holds for the store and the demo (unchanged) and,
  with option A of §6, for the example (localhost). It is not a step back for the
  hosted consumers, because their key is already in the page.
- **Bundle size.** zod and the served text come into `hi.js`, which every HI host loads, also
  without a chat. The skills load lazily.
- **Order of the teardown.** The live store and bo-test call the PRD Worker until their releases
  land (§4.4).

## 8. What becomes obsolete

- **Backlog items:** [deployment-and-session-issues.md](deployment-and-session-issues.md) #3 (no
  public endpoint left) and #4 (part of the teardown in §4.4).
  [ligna-store-chat-client.md](ligna-store-chat-client.md) #1 stays: the Mistral image
  middleware is part of the host's loop.
- **ADRs:** 0001 (rest), 0002 and 0004 are superseded. 0003, 0005 and 0008 are superseded in part
  (the server, the deployment, the accounts).
- **Docs:**
  - `docs/setup/`: `cloudflare-mcp-server.md`, `azure-mcp-server.md`,
    `connect-agent-to-cloud-mcp.md`, `local-mcp-server.md`, `ollama-vscode-mcp-setup.md` and
    `jan-ai-setup.md`;
  - the "Connecting an MCP client" sections of `docs/hi-mcp-server.md` and
    `hi-mcp/hi-mcp-server/README.md`;
  - the cloud and session parts of `docs/user-guide/README.md`;
  - the bridge and launcher parts of `docs/implementation/`;
  - `hi-mcp/QUICKSTART.md` and `hi-mcp/hi-mcp-server/QUICKSTART.md`.
- **Skills:** `.agents/skills/hi-mcp-cloudflare-deployment.md` goes;
  `.agents/skills/hi-mcp-server.md` is rewritten for the embedding-lib.
- **AGENTS.md and `.github/copilot-instructions.md`:**
  - the repository tree;
  - "MCP Server Architecture" items 2–4;
  - "Bridge Communication", "MCP Client Connection" and "Deploying to Cloudflare";
  - the `start:cf` and `mcp-server` scripts;
  - the skill rows.

## 9. Alternatives considered

- **Keep a server, local only.** Leave the protocol and the bridge as they are, and drop only
  Cloudflare. The store and the demo would then need a server next to every browser, so this does
  not reach the goal.
- **An MCP server in the page** (in-memory transport): replaced by the plain tool set (§3.1, §6).
- **The agent loop and the provider mapping in the embedding-lib as well** (one
  `startPlanningAssistant` for the three hosts). Not in this step, decided by the user on
  2026-10-16. The three loops differ:
  - roomle-ui demo: 16 steps, reasoning effort per model, no recovery;
  - store: 8 steps, recovery, no Mistral image middleware;
  - example backend: steps, recovery, image middleware, step log.

  Each maps models to providers with hard-coded lists, which is not a general solution yet.
- **The tool definitions in the Rubens UI** (web-sdk, next to the prompts and the tool commands),
  served to the host as data: one release with the tool commands, no npm bump for a text change.
  `execute` would still run in the host. Not chosen: the user placed the implementation in the
  embedding-lib.
- **AI SDK client-side tools** (tools without `execute`, run by `useChat`): no host uses `useChat`.
  The loops run in the page, so the tools can carry `execute` directly.

## Test

- roomle-ui unit tests: those of §4.1 step 2, run with `npm run test:unit`.
- Live checks:
  - the roomle-ui demo, the local store and the example each run a turn that creates a group,
    changes an attribute, undoes and renders `get-plan-images`;
  - the browser makes no request to workers.dev or localhost:3100.
- "test the mcp" over the three models, compared per test with a reference session of the
  server build (only on request).

**Reproduce.** Open the store with `?store.stage=INT&api_key=…`. Every tool call shows in the
network panel as a `POST` to `hi-planning-assistant.dashiell-bell.workers.dev/mcp` while the
planner's own `/bridge` WebSocket carries the planner calls back.

## References

- [ADR 0001](../decisions/0001-hi-mcp-tool-logic-in-the-server.md) — rejected client-side tools
  ("external agents still need the remote endpoint", "puts the tool logic back into the page");
  both reasons are gone (§1; ADR 0007).
- [ADR 0003](../decisions/0003-the-ai-chat-is-an-mcp-client-beside-the-server.md) — the chats as
  MCP clients; the key in the store page.
- [ADR 0004](../decisions/0004-hi-mcp-server-on-cloudflare-containers.md) — the container per
  session, its limits.
- [ADR 0007](../decisions/0007-hi-mcp-tool-logic-in-the-planner.md) — the tool logic in the
  planner; what the server keeps.
- [planning-assistant-chat-in-roomle-ui.md](../feature-analysis/planning-assistant-chat-in-roomle-ui.md)
  — the chat window and the host callbacks the tools plug into.
- [backend-agent-loop-with-browser-scene-tools.md](backend-agent-loop-with-browser-scene-tools.md)
  — the key off the browser, for a production store.
