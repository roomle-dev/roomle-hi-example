# Backlog: the HI tool set in the planner, the embedding-lib forwards to it

> **Type**: Backlog item (architecture)
> **Domain**: roomle-ui embedding-lib — the HI tool set (`packages/embedding-lib/src/homag-intelligence/hi-mcp/`, `hi-mcp-tools.ts`, `hi-planning-assistant.ts`, `hi.ts`); roomle-ui planner — `packages/web-sdk/packages/homag-intelligence/`, `planner-core/src/roomle-planner.ts`; roomle-hi-example: the prompt runner and the documentation
> **Status**: Open — to be decided with the user; the names of the two planner methods are proposals

---

## Problem

The HI tools are split across two bundles of roomle-ui:

- **The tool logic runs in the planner**, the page of `https://www.roomle.com/t/bo-test/` (or a
  local roomle-ui) in the iframe of the host. Every plan-changing tool is one
  `externalObjectGroupOperation` (roomle-ui `roomle-planner.ts:3240`, `runToolCommand` in
  `hi-tool-commands.ts:1404`, [ADR 0007](../decisions/0007-hi-mcp-tool-logic-in-the-planner.md)).
- **The tool set runs in the host page**, in the embedding-lib. It holds the names, the descriptions,
  the input schemas, `AUTHORING_RULES`, the skills, the agent-facing shaping of `get-plan-context`
  and `find-attributes`, and the undo bookkeeping. `createHiMcpTools` (`hi-mcp-tools.ts:12`) loads
  it from `hi-mcp/hi-mcp-server.ts:134`
  ([ADR 0011](../decisions/0011-the-hi-tools-live-in-the-embedding-lib.md)).

The tool set reaches the planner through six `roomDesignerApi.extended` methods (`PlannerApi`,
`planner-api.ts:7`). Each call is a postMessage round trip into the iframe
(`Connector.handleSetup`, `connector.ts:70`, `:92`). This has three costs:

- **A change to the tool set ships separately from the tool logic.** A description, a rule, a skill
  or the shaping of a result reaches a host only with a new embedding-lib build that every host pins
  again. The example loads `@roomle/embedding-lib@0.0.0-dev-a40887e`
  (`minimal-hi-example/index.html:225`, `:235`); the ligna-store loads its package version. A change
  to the tool logic reaches the hosts with the planner deployment instead, so a host can pair a tool
  set with a planner from a different state.
- **A tool call makes several round trips.** A plan-changing tool makes at least two: the operation,
  then `readGroupsKey`. An undo or a redo makes one per history step, plus one to read the groups
  (`tool-executors.ts`).
- **The undo bookkeeping takes over the host's callback.** It replaces the planner callback
  `onHistoryChange` of the host with its own handler, which calls the host's
  (`hi-mcp-server.ts:142`). A host that sets its own handler must set it before calling
  `createHiMcpTools` (`hi-mcp-tools.ts:3`).

## Proposed change

1. **roomle-ui planner: move the tool set.** It moves from
   `packages/embedding-lib/src/homag-intelligence/hi-mcp/` into the planner
   (`packages/web-sdk/packages/homag-intelligence/`): `hi-mcp-server.ts`, `mcp-tool.ts`,
   `mcp-tool-types.ts`, `tool-executors.ts`, `agent-facing.ts`, `plan-history.ts`, `skills.ts` and
   `skills/`. It stays a lazy chunk, loaded on the first call.
   - The tools call the planner's methods directly instead of through `roomDesignerApi.extended`.
     The per-call timeouts of `planner-api.ts:1` move with them.
   - `PlanHistory` listens to the planner's history change itself and leaves the host's
     `onHistoryChange` alone.
2. **roomle-ui planner API: add two planner methods.** The names are proposals:
   - `getHiMcpToolDefinitions(): Promise<{ name, description, inputSchema }[]>` returns
     `inputSchema` as the JSON Schema that `mcpTool` serves today (`mcp-tool.ts:56`, draft-7,
     input).
   - `callHiMcpTool(name, input): Promise<McpToolResult>` validates the input as `mcpTool` does
     (`mcp-tool.ts:73`). It answers an invalid input, a thrown error and an unknown tool name as an
     `isError` result, with the same texts as today.
3. **roomle-ui embedding-lib: forward to the planner.** `createHiMcpTools(roomDesignerApi)` keeps
   its signature and its result `HiMcpTools`, and builds every tool from `getHiMcpToolDefinitions`:
   - the input schema as today: a Standard Schema with the served JSON Schema and no validation of
     its own (`mcp-tool.ts:68`);
   - `execute` calls `callHiMcpTool`;
   - `toModelOutput` is `mcpToModelOutput`.

   A planner without the two methods is an older deployment. `handleSetup` lists the planner's
   methods, so `createHiMcpTools` rejects with an error that says the planner needs an update. zod
   leaves the embedding-lib, because only `hi-mcp/` uses it.
4. **roomle-hi-example: move the run recording to the forwarding method.** The six planner methods
   no longer cross the iframe, so the example's recorder no longer sees them. That recorder
   (`recordedPlannerApi`, `minimal-hi-example/index.html:939-985`) records only those six methods,
   and keeps a result only for `getExternalObjectSnapshot`.
   - The recorder records `callHiMcpTool` instead: the tool, its input, its time, and its success or
     error. It keeps the result of a `get-plan-images` call.
   - The runner (`run-hi-mcp-prompt.js:537-549`) and `planImageFiles` (`plan-images.js:10`) take the
     images the agent saw from the image parts of those results, instead of from the snapshot
     answers.
   - `planner-calls.json` then lists tool calls, not planner calls. Its readers,
     `benchmark-hi-mcp-runs.js:157` and `extract-run-facts.js:89`, read tool calls. If the
     benchmark still needs the time of each planner method, the planner reports it.
5. **roomle-hi-example: update the documentation.**
   - Add an ADR that supersedes the location clause of ADR 0011: the tool set lives in the planner,
     and the embedding-lib forwards to it.
   - Update D94 of [`hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md#3-decisions),
     [`hi-mcp-server.md`](../../docs/hi-mcp-server.md),
     [`tool-executors.md`](../context/tool-executors.md) and
     [`hi-mcp-tools.md`](../skills/hi-mcp-tools.md).
   - Repoint every path into `packages/embedding-lib/src/homag-intelligence/hi-mcp/` in this
     repository (`git grep -n "embedding-lib/src/homag-intelligence/hi-mcp"`).

## Constraints

- **Only the tool set moves.**
  - The agent loop, the model and the provider key stay in the host (`startPlanningAssistant`,
    [ADR 0009](../decisions/0009-the-chat-window-is-a-panel-of-the-planner.md)).
  - The plan-changing tool logic stays in `externalObjectGroupOperation` (ADR 0007).
  - The six planner methods stay public for other hosts.
- **No MCP SDK and no MCP endpoint.** The planner serves a tool set, not the MCP protocol (D94). An
  endpoint for external MCP clients is a separate decision.
- **The tool code stays a lazy chunk**, so a planner without a chat does not load zod or the skills
  (D94).
- **The model sees the same tools.** The names, descriptions and input schemas stay unchanged, and
  so do the result texts, validation texts included. The D94 guards in roomle-ui
  `hi-mcp-fixture.spec.ts` and `hi-mcp-stream-text.spec.ts` check this.
- **`HiMcpPlannerApi` stays exported.** It is a public type of `@roomle/embedding-lib/hi`
  (`hi.ts:35`), and `PlanningAssistantPlannerApi` extends it (`hi-planning-assistant.ts:30`).
- **The wrapper keeps a timeout per tool call.** `MessageHandler.sendMessage` has no timeout
  (`message-handler.ts:79`), so without one a planner that stops answering leaves the turn open.
- **The prompt runner must still record the `[hi-mcp]` console lines.** After the move they come
  from the planner frame, which is a cross-origin iframe in the example. `run-hi-mcp-prompt.js:199`
  records them with `page.on('console')`. Check that it still receives them; if it does not, record
  the console of the planner frame.

## Test

roomle-ui:

- **The moved tests run against the planner.** The tests of
  `tests/unit/embedding-lib/homag-intelligence/hi-mcp/` move into the `homag-intelligence` tests of
  web-sdk: fixture, stream-text, tool-executors, plan-history, skills, interior-fittings and
  mcp-tool. The fixture test still matches.
- **Planner methods:**
  - `getHiMcpToolDefinitions` serves the fixture's names, descriptions and schemas.
  - `callHiMcpTool` answers an invalid input with the validation text of the MCP SDK.
  - A thrown error and an unknown tool name each come back as an `isError` result.
- **Embedding-lib wrapper:**
  - `createHiMcpTools` builds the tools from the definitions.
  - `execute` forwards the name and the input, and returns the planner's result unchanged.
  - A planner without the methods rejects with the update error.
  - The host's `onHistoryChange` stays untouched.
- **The assistant tests pass with the forwarding tool set:** `hi-planning-assistant.spec.ts` and
  `hi-mcp-stream-text.spec.ts`.

roomle-hi-example:

- **The scripts' tests** (`.agents/scripts/tests/`) cover `planImageFiles` with the image parts of a
  `get-plan-images` result, and the readers of `planner-calls.json` with tool calls.
- **A "test the mcp" run** of [`test-prompts.json`](../../docs/test-prompts.json) against a local
  roomle-ui with the change, `undo-a-wrong-command` and a turn with `get-plan-images` included. The
  run writes the `[hi-mcp]` lines into `run.json`, the tool calls into `planner-calls.json`, and the
  images of the `get-plan-images` turn as `turn-<n>-plan-images-<k>-…png`.

## Reproduce

Change a tool description in roomle-ui `hi-mcp-server.ts` and deploy the planner to `/t/bo-test`.
The example page (`index.html:225`, `:235`) keeps serving the old description until a new
embedding-lib build is pinned.

## References

- [ADR 0011](../decisions/0011-the-hi-tools-live-in-the-embedding-lib.md) — where the tools live
- [ADR 0007](../decisions/0007-hi-mcp-tool-logic-in-the-planner.md) — the tool logic runs in the
  planner
- [ADR 0009](../decisions/0009-the-chat-window-is-a-panel-of-the-planner.md) — the agent loop stays
  in the host
- D80 (the chat prompts already come from the planner) and D94 (the tool set of the embedding-lib)
  of [`hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md#3-decisions)
