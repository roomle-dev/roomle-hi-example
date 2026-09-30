# Feature Analysis: HI MCP command API (RML-18004)

> **Type**: Feature Analysis
> **Domain**: hi-mcp — MCP server tools and executors (`hi-mcp/hi-mcp-poc-json`), the page bridges; roomle-ui `homag-intelligence` (`glue-logic.ts`, `hi-plan-context.ts`, `external-object-api.ts`) and `planner-core` (`roomle-planner.ts`)
> **Trigger**: Jira [RML-18004](https://roomle.atlassian.net/browse/RML-18004) "hi mcp command api" — a new planner API `externalObjectGroupOperation(command, payload)` in roomle-ui that delegates to the glue logic, the operations implemented in `hi-plan-context.ts` on top of existing glue-logic features, and one MCP tool per command; designed so that new commands are easy to add
> **Date**: 2026-09-30
> **Author**: AI Assistant
> **Status**: Implemented
> **Branch**: `feat/hi-mcp-command-api-RML-18004` (roomle-ui, roomle-hi-example, ligna-store)

> **Close-out (2026-09-30)**: implemented as planned, with the implementation decisions listed in
> the [close-out report](#close-out-report-2026-09-30) — the main one: no timeout, every kernel
> operation completes with the kernel's own report. Verified with the unit tests of both
> repositories and live, through the real planner. The living reference is
> `minimal-hi-example/docs/hi-mcp-server.md` (the command tools), `.agents/skills/hi-mcp-tools.md`
> and roomle-ui `.agents/homag-intelligence.md`.

> **Update (2026-09-30, implementation plan)**: the [implementation plan](#implementation-plan-2026-09-30)
> below resolves the open questions with the recommendations of the analysis and with the kernel
> facts verified in RoomleCore (`mergeObjects` merges the groups where they stand, the first group
> of the list survives, every callback fires synchronously before the kernel call returns). The
> analysis above is kept as written.

---

## What was asked and why

The MCP server can create or replace whole groups (`create-or-replace-groups`), move a group
(`place-group`) and set one attribute (`update-attribute`). Every other edit of an existing
kitchen — remove a unit, swap a unit for another article, add one unit, recolour a whole group,
join two groups — today means: take the group from `get-plan-context`, edit the pos group by hand
and resubmit it as a replace. That works for some edits, but the agent has to rebuild the docking
graph itself, and it cannot express what the planner UI does with one click (delete a root module
with the kernel splitting the rest, merge two groups, swap a module keeping its docking).

The ticket asks for seven commands, each an MCP tool, all going through **one** new planner API:

| # | Command (ticket wording) | Glue-logic feature that exists today |
|---|---|---|
| 1 | change an attribute of a module | `updateAttribute` |
| 2 | change an attribute of a group (apply to all modules of the group) | `modifyAttribute` with a module list |
| 3 | delete a group | planner `removeExternalObject(groupId)` → kernel → `removedGroup` |
| 4 | delete a root module | planner `removeExternalObject(rootId)` → kernel → `deleteRootModule` |
| 5 | merge an article into a group at a certain position | the pos-groups replace path (`createOrReplacePosDataFromArticleLayout`) with an article-pick root |
| 6 | exchange a root module in a group with an article | `swapRootModule` |
| 7 | merge groups (the "Merge Group" button of the flying menu) | planner `mergeItems` → kernel → `mergeGroups` |

The design goal named in the ticket: adding a command later must be easy.

## How the area works today

### roomle-hi-example: tools in the server, planner methods in the page

Since [ADR 0001](../decisions/0001-hi-mcp-tool-logic-in-the-server.md) the tool logic runs in the
server (`tool-executors.ts`), and every planner call travels over the WebSocket bridge as a method
call the page executes on `roomDesignerApi.extended`
(`hi-mcp/hi-mcp-poc-json/planner-api.ts:24-43`, `page-bridge.ts:73-108`). The page executes only
the methods on its allow-list — the page's security boundary:

- `minimal-hi-example/index.html:1050-1058` (`MCP_PLANNER_METHODS`)
- `hi-mcp/hi-mcp-poc-json-client/browser-bridge.ts:12-20` (`PLANNER_METHODS`)
- the ligna-store copy `ligna-store/hi-mcp/browser-bridge.ts` (identical today, copied by hand)

`tests/planner-api.test.ts:61-66` fails when the server's `PlannerApi` and the reference
allow-list diverge. Seven methods are exposed today: `getExternalObjectPlanContext`,
`loadExternalObjectGroupLayout`, `updateExternalObjectGroupAttribute`, `fetchPrice`,
`getExternalObjectSnapshot`, `getExternalObjectGroups`, `removeExternalObject`.

**Every new planner method costs four files in three repositories** (`planner-api.ts`, two
reference allow-lists, the ligna-store copy) plus a deployment of the store page. That is the
cost the one-method command API avoids: the seven commands, and every later one, travel through a
single allow-list entry.

Tool registration is `hi-mcp-server.ts` (`registerTool` with a zod schema, handler via `runTool`)
and the executors are keyed by tool name in `tool-executors.ts:452`. The served instructions and
authoring rules (`hi-mcp-server.ts:114-180`) tell the agent to modify a group by resubmitting it
(`:139`: "To modify an existing group, take it from get-plan-context, change it, and resubmit
it with its id"). `tests/hi-mcp-server.test.ts:10-20` pins the tool list (nine tools).

`update-attribute` (`hi-mcp-server.ts:366-395`, executor `:824-832`) already implements command 1
through `updateExternalObjectGroupAttribute` — the only agent-facing edit of an existing group
besides the replace.

### roomle-ui: how a planner method reaches the glue logic

- `roomDesignerApi.extended` is not a registry: every public, non-underscore method of
  `RoomlePlanner` is exposed automatically (`packages/embedding-lib/src/roomle-embedding-lib.ts:67-83`,
  `src/configurator/embedding/exposed-api.ts:379-382`). The typed contract is the interface
  `ExternalObjectAPI` (`packages/web-sdk/packages/homag-intelligence/src/external-object-api.ts:209-463`),
  which `RoomlePlanner` implements.
- The delegation template is `getExternalObjectPlanContext`
  (`planner-core/src/roomle-planner.ts:3101-3109`): get the glue logic from
  `this._homagIntelligence?.getGlueLogic()`, return `{}` without HI, otherwise call it.
- The glue logic reaches the planner back through `RoomDesignerRequests`
  (`homag-intelligence/src/api.ts`): `loadPosGroups` (`:27`), `deleteGroup` (`:83`) and
  `deleteRootModule` (`:87`) — the last two call `removeExternalObject`.
- A new `GlueLogic` method must also be forwarded by `GlueLayerRequestDebugLogging`
  (`debug-logging.ts:28`); a new `RoomDesignerRequests` method by `RoomDesignerApi`,
  `GlueLayerResponseDebugLogging` (`debug-logging.ts:429`) and `__tests__/__mocks__.ts:16`.
  The last comparable change is commit `74f22512dd` ("feat: hi plan context and group layout api").

### roomle-ui: `hi-plan-context.ts` is pure shaping, not an operation layer

`hi-plan-context.ts` (756 lines) exports the plan-context types and pure functions
(`compactMasterData`, `compactArticle`, `shapeGroup`, `shapeRooms`, `deriveWalls`, …). It imports
only the domain model types; **`glue-logic.ts` imports from it** (`:37-44`), not the other way
round, and it holds no state and no access to the glue logic's `_groupMap`. Tests:
`__tests__/hi-plan-context-test.ts` (754 lines, no mocks).

So "the operation implemented in `hi-plan-context.ts`" cannot mean calling
`GlueLogicImplementation` from there: the private lookups the commands need (`_getGroup` `:434`,
`_findRootModuleInAllGroups` `:2611`, `_collectModulesWithAttribute` `:2179`) and the planner
requests live on the glue logic. The design below resolves this with a small operations
interface (see [Proposed design](#proposed-design)).

### roomle-ui: the seven features, and who drives them

`glue-logic.ts` unless noted.

| Command | Existing code | Input it takes | Notes |
|---|---|---|---|
| 1 change module attribute | `updateAttribute(rootModuleId, moduleId \| null, attributeId, value)` `:1858-1891` | root id, optional sub-module id | finds the group by root id, `_modifyAttributeOfModules` `:2323`, one `loadPosGroups` with `CHANGE_ATTRIBUTE`; silent `return` on a missing root |
| 2 change group attribute | `modifyAttribute(groupId, moduleIdObjects: ExternalModuleInformation[], attributeName, value)` `:1893-1930` | group id and the modules to change | with an **empty** list it sets only the group-level `posDataJson.attributes` (`_modifyAttributeOfGroup` `:2304`); with a list every `subModuleId ?? rootModuleId` is changed in one calculation and one load. The UI's group panel gets the module list from the kernel; the glue logic can derive it itself with `_collectModulesWithAttribute(module, attributeId, masterData, result)` `:2179-2202` (walks sub-modules via `masterData.modules[].assignedAttributes`) |
| 3 delete group | planner `removeExternalObject(groupId)` `roomle-planner.ts:2901-2929`, reachable as `RoomDesignerRequests.deleteGroup` `api.ts:83` | group id | kernel `deletePlanElementByIds` → callback `externalObjectConfigurationDeleted` (`services/planner-kernel-access.ts:937`) → `glueLogic.removedGroup(groupId)` `:1297` drops it from `_groupMap` |
| 4 delete root module | planner `removeExternalObject(rootId)`, reachable as `RoomDesignerRequests.deleteRootModule` `api.ts:87` | root id | `getDeleteComponentContext` decides `canBeDeleted` — a refusal returns **silently**; the kernel computes the remaining group and the split-off groups and calls back `deleteRootModule(remainingGroup, rootId, splitOffGroups)` `:989-1021` (`externalObjectComponentDeleted` `planner-kernel-access.ts:947`) |
| 5 merge article into group | `createOrReplacePosDataFromArticleLayout({ posGroups }, 'posGroups')` `:566` → `_createOrReplacePosGroupsFromLayout` `:680-745`; an article-pick root (`_isArticlePickRoot` `:747`) is completed by `_prepareArticlePickRoots` `:779-842`; ids of existing roots are kept, new roots get fresh ids with remapped docking (`_replaceRootModuleIdsAndRemapDockedRoots` `:844`) | the group with one more root, docked by `contextData` on the anchor root | this is exactly what `create-or-replace-groups` does today from the server; `addSubArticle` `:2464` is for sub-articles, not root modules; the kernel drag-in merge (`_insertExternalObject` with `tryToMergeNewGroups`) is interactive |
| 6 exchange root module | `swapRootModule(groupId, rootModuleId, articleId)` `:2234-2302` | group id, root id, article id | copies `articlePos`/`rotationY`, transfers the docking context (`transferDockingContext` `:311`), rearranges, loads with `SWAP_MODULE` and a `moduleIdMap`; single-root articles only; silent `return` on a missing group or root |
| 7 merge groups | flying menu: `mergeSelection` (`src/common/components/flying-menu/FlyingMenu.vue:545-559`) → `RoomlePlanner.mergeItems(planObjects)` `:1115` → `PlannerKernelAccess.mergeItems` (`services/planner-kernel-access.ts:597`) → kernel `mergeObjects` → callback `externalObjectConfigurationsMerged` (`:991`) → `glueLogic.mergeGroups(targetGroup: ExternalObjectGroup, idsOfGroupsMerged, idOfTargetRootModule, mergedWithDragging=false)` `:1148-1207` → load with `MERGE_WITH_ON_ACTION` | plan objects (runtime), at least two, same library (`use-planner-actions-visibility.ts:89-103`) | the glue logic only **reacts**: the kernel computes the merged geometry, the target root and the docking. No `RoomDesignerRequests` method reaches `mergeItems` today; group id → runtime id goes through `getExternalObjectComponent(groupId, '').runtimeId` and `getPlanObjectForRuntimeId` `roomle-planner.ts:3341` |

Two facts shape the design:

1. **Commands 3, 4 and 7 are kernel-driven.** The glue logic cannot perform them; it asks the
   planner (through `RoomDesignerRequests`) and the kernel calls back. Their result is only known
   after the callback, so the command has to wait for it before it answers (the completion signal —
   see Open questions Q5).
2. **Commands 1, 2, 5 and 6 are glue-logic-driven** and already end in one `loadPosGroups`; the
   command only validates and forwards.

There is no command-string dispatch anywhere in the HI package. The established vocabulary
pattern is a `const` object plus a derived union type (`HI_CONTEXT_ACTION`,
`HI_LOAD_OBJECT_REASON` in `external-object-api.ts:79-109`); `layoutType` of
`createOrReplacePosDataFromArticleLayout` (`'posGroups' | 'nobila'`) is the closest string switch.

## The gap

- One agent-facing edit of an existing group exists (`update-attribute`); the other six edits
  are either impossible for the agent (merge groups, delete a root module with the kernel's split
  behaviour) or need it to rebuild the pos group by hand (delete root, exchange root, add a
  unit).
- Each of those edits maps to code that already exists in roomle-ui, but behind different
  entry points (glue logic, planner, kernel callback) with different id kinds (HI ids vs.
  runtime ids) — nothing unifies them.
- Adding an operation to the MCP server today costs a new planner method in four files across
  three repositories.

## Proposed design

### roomle-ui

**1. The planner API** — one method on `ExternalObjectAPI` and `RoomlePlanner`, following the
`getExternalObjectPlanContext` template:

```ts
externalObjectGroupOperation(command: HiGroupOperation, payload: object): Promise<HiGroupOperationResult>;
```

`RoomlePlanner` gets the glue logic, throws "HI not available" without it, and delegates to
`glueLogic.executeGroupOperation(command, payload)`. Exposed automatically as
`roomDesignerApi.extended.externalObjectGroupOperation`.

**2. The command layer in `hi-plan-context.ts`** — the ticket's home for the operations, kept
pure and testable without the glue logic:

- the vocabulary: `HI_GROUP_OPERATION = { CHANGE_MODULE_ATTRIBUTE: 'change-module-attribute',
  CHANGE_GROUP_ATTRIBUTE: 'change-group-attribute', DELETE_GROUP: 'delete-group',
  DELETE_ROOT_MODULE: 'delete-root-module', MERGE_ARTICLE_INTO_GROUP: 'merge-article-into-group',
  EXCHANGE_ROOT_MODULE: 'exchange-root-module', MERGE_GROUPS: 'merge-groups' } as const` with the
  `HiGroupOperation` union type, and one payload type per command
- the operations interface the glue logic implements — the seven existing features behind
  intention-revealing names:

  ```ts
  export interface HiGroupOperations {
    updateModuleAttribute(rootModuleId, moduleId | null, attributeId, value): Promise<HiPlanGroup>;
    updateGroupAttribute(groupId, attributeId, value): Promise<HiPlanGroup>;   // modifyAttribute over every module carrying the attribute
    deleteGroup(groupId): Promise<void>;
    deleteRootModule(rootModuleId): Promise<HiPlanGroup[]>;                     // the remaining and split-off groups
    mergeArticleIntoGroup(groupId, pick, docking): Promise<HiPlanGroup>;         // replace path with one more article-pick root
    exchangeRootModule(groupId, rootModuleId, articleId): Promise<HiPlanGroup>;
    mergeGroups(targetGroupId, groupIds): Promise<HiPlanGroup>;
  }
  ```

- the dispatcher `executeGroupOperation(command, payload, ops: HiGroupOperations)`: a
  `Record<HiGroupOperation, handler>` — each handler validates its payload (ids are non-empty
  strings, docking vectors named, no coordinates) and calls one `ops` method; an unknown command
  fails with the list of known commands; the result is shaped with the existing `shapeGroup`, so
  the agent sees the same group shape as in `get-plan-context`

Adding a command later = one entry in `HI_GROUP_OPERATION`, one payload type, one handler, one
`ops` method. No planner API change, no page change.

**3. The glue logic** implements `HiGroupOperations` (on `GlueLogicImplementation`, forwarded by
`GlueLayerRequestDebugLogging`) and exposes `executeGroupOperation(command, payload)` on the
`GlueLogic` interface, which calls the pure dispatcher with `this`:

- `updateModuleAttribute` → `updateAttribute`, but failing loudly when the root is unknown
  (today a silent return)
- `updateGroupAttribute` → collect every module of the group carrying the attribute
  (`_collectModulesWithAttribute` over the roots; open question Q2 whether sub-modules are
  included) → `modifyAttribute(groupId, moduleIdObjects, attributeId, value)`; fails when no
  module carries the attribute
- `deleteGroup` → `_designerRequests.deleteGroup(groupId)` after checking `_getGroup`
- `deleteRootModule` → `_designerRequests.deleteRootModule(rootId)`; the kernel's `canBeDeleted`
  refusal must become an error, not silence (Q5)
- `mergeArticleIntoGroup` → the group's `posDataJson` plus one article-pick root `{ id, articleId,
  attributes?, contextData? }` docked on the anchor root as the authoring rules describe
  (`{ ownDockingVector, dockedRoots: [{ id, dockingVector, mode?, offset? }] }`) →
  `createOrReplacePosDataFromArticleLayout({ posGroups: [group] }, 'posGroups')` → the planner's
  load (as `loadExternalObjectGroupLayout` does). "At a certain position" is a docking position,
  never coordinates — the same principle as everywhere else in the HI authoring
- `exchangeRootModule` → `swapRootModule`, failing loudly on an unknown group or root
- `mergeGroups` → a new `RoomDesignerRequests.mergeGroups(groupIds: string[])`
  (`RoomDesignerApi`: resolve each group id to its runtime id via `getExternalObjectComponent`,
  then `getPlanObjectForRuntimeId`, then `mergeItems`) — the same path as the flying menu
  button; the kernel calls back `mergeGroups` as it does today

**4. Result and completion.** Every command answers with the affected groups in the plan-context
shape plus the ids of removed groups: `{ command, groups: HiPlanGroup[], removedGroupIds?:
string[] }`. For the glue-logic-driven commands the group is known when `loadPosGroups` returns.
For the kernel-driven commands the glue logic learns the result in the callback (`removedGroup`,
`deleteRootModule`, `mergeGroups`); the request method resolves when that callback has run for
the requested ids (a pending-operation map keyed by group/root id, resolved in the callback,
rejected on the kernel's silent refusal or a timeout). This is the completion signal the plan
must name (Q5).

**5. Documentation** in roomle-ui: the "External Object API Reference" of
`packages/embedding-lib/docs/homag-intelligence-embedding.md` (a `####` entry with signature,
parameters and one example per command), `packages/web-sdk/packages/index.ts` type exports.

### roomle-hi-example

- `planner-api.ts`: `externalObjectGroupOperation(command, payload)` with the snapshot timeout
  (every command but the deletes ends in a group calculation and load, like
  `loadExternalObjectGroupLayout`)
- the allow-lists: `MCP_PLANNER_METHODS` in `index.html`, `PLANNER_METHODS` in
  `browser-bridge.ts`, then the ligna-store copy — one entry for all commands
- `tool-executors.ts`: seven executors, each validating its arguments and forwarding one
  command; `hi-mcp-server.ts`: seven `registerTool` calls with zod schemas naming ids and
  docking as the agent knows them from `get-plan-context`
- `update-attribute` is superseded by `change-module-attribute` (Q1); with it,
  `updateExternalObjectGroupAttribute` leaves `PlannerApi` and the allow-lists
- the served instructions and authoring rules: the workflow gains "edit an existing group with
  the command tools; resubmit the whole group only for a rebuild"
- tests: `tool-executors.test.ts` (one `describe` per tool: validation, the forwarded command and
  payload, the result), `hi-mcp-server.test.ts` (`EXPECTED_TOOLS`, the served text),
  `planner-api.test.ts` (parity with the allow-list)
- documentation: `minimal-hi-example/docs/hi-mcp-server.md` (tool reference, architecture
  allow-list paragraph, demo walkthrough, example prompts), `.agents/skills/hi-mcp-tools.md`,
  `.agents/skills/hi-mcp-server.md` (adding a tool no longer needs a page change for a command),
  `.agents/skills/hi-authoring-rules.md` and `roomle-hi-concepts.md` (modifying a group),
  `AGENTS.md` tool list, `docs/testing-prompts.md` (prompts for the seven edits)

### Tool contracts (agent-facing)

| Tool | Parameters | Command |
|---|---|---|
| `change-module-attribute` | `rootModuleId`, `moduleId?`, `attributeId`, `value` | 1 |
| `change-group-attribute` | `groupId`, `attributeId`, `value` | 2 |
| `delete-group` | `groupId` | 3 |
| `delete-root-module` | `rootModuleId` | 4 |
| `merge-article-into-group` | `groupId`, `articleId`, `attributes?`, `dockTo: { rootId, ownDockingVector, dockingVector, mode?, offset? }` | 5 |
| `exchange-root-module` | `groupId`, `rootModuleId`, `articleId` | 6 |
| `merge-groups` | `targetGroupId`, `groupIds` (one or more) | 7 |

A unique id prefix is accepted for group ids as in `place-group`. Ids and docking vector names
come from `get-plan-context`; article ids from its catalog (validated in the server as
`create-or-replace-groups` does, so the agent gets the catalog list on a typo).

## Alternatives considered and rejected

- **One planner method per operation** (`removeExternalObjectGroup`, `swapExternalObjectRoot`, …):
  seven new allow-list entries now and one per later command, in four files across three
  repositories with a store deployment each time. Contradicts the ticket's extensibility goal.
- **Implement the edits in the MCP server on the replace path** (`create-or-replace-groups` with
  the group edited by the server: drop a root, swap an `articleId`, append a docked pick): works
  for commands 4–6 in simple cases but re-implements what the glue logic does with the proper
  reasons (`SWAP_MODULE`, `DELETE_MODULE`), id maps and the kernel's split-off behaviour; cannot
  do `merge-groups` or a `delete-group` with the kernel's selection handling. The ticket puts the
  operations into roomle-ui deliberately.
- **One MCP tool `group-operation { command, payload }`**: fewer registrations, but the agent loses
  the per-tool zod schema and description; the ticket asks for one tool per command, and the
  server's tool descriptions are where the agent learns the parameters.
- **The dispatcher inside `GlueLogicImplementation` only**, `hi-plan-context.ts` untouched:
  simplest, but the command vocabulary and validation would be untestable without the glue-logic
  test harness, and the ticket names `hi-plan-context.ts` as the operations' home. The
  operations-interface split keeps the pure part there and the stateful part where the state is.
- **`hi-plan-context.ts` calling `GlueLogicImplementation` directly**: an import cycle
  (`glue-logic.ts` imports the shaping functions) and no access to the private lookups; rejected
  in favour of the injected `HiGroupOperations`.

## Open questions (for the review of this analysis)

- **Q1 — `update-attribute`.** Retire it in favour of `change-module-attribute` (same parameters,
  same behaviour, one path), or keep both? Recommendation: retire; two tools for one edit confuse
  the agent, and `updateExternalObjectGroupAttribute` can leave the allow-lists.
- **Q2 — "all modules in the group".** Root modules only, or every root and sub-module that
  carries the attribute according to the master data (the way the UI's group panel behaves)?
  Recommendation: every module carrying the attribute, and the result lists which changed.
- **Q3 — the "certain position" of `merge-article-into-group`.** A docking position (anchor root
  + vector pair + mode/offset), never coordinates — consistent with the authoring rules.
  Confirm.
- **Q4 — `merge-groups` semantics.** What the kernel does with groups that do not touch, and
  which root becomes `idOfTargetRootModule`, is decided in the kernel (`mergeObjects`). To be
  verified in a live session before the plan fixes the parameters; the flying menu requires the
  same library id.
- **Q5 — completion signal of the kernel-driven commands.** `removeExternalObject` returns
  `void` and refuses silently when `canBeDeleted` is false; the glue logic learns the result in a
  callback. The plan must name how the request resolves (pending map resolved in
  `removedGroup`/`deleteRootModule`/`mergeGroups`, rejected on refusal or timeout) — see
  roomle-ui `.agents/async-shared-state.md` Rule 9.
- **Q6 — result shape.** `{ command, groups, removedGroupIds? }` with groups in the
  `get-plan-context` shape; or the loaded runtime ids like `loadExternalObjectGroupLayout`?
  Recommendation: the shaped groups — the agent already knows that shape.
- **Q7 — deployment order.** The example page loads the planner from
  `https://www.roomle.com/t/bo-test/` and the ligna-store from INT; the tools only work once
  roomle-ui with the command API is deployed there. Until then the example runs with `npm run dev`
  against a local UI dev server.

## Code and documents the work would touch

**roomle-ui**

- `packages/web-sdk/packages/homag-intelligence/src/external-object-api.ts` — interface method,
  `HI_GROUP_OPERATION`, payload and result types
- `packages/web-sdk/packages/homag-intelligence/src/hi-plan-context.ts` — vocabulary,
  `HiGroupOperations`, `executeGroupOperation`, payload validation, result shaping
- `packages/web-sdk/packages/homag-intelligence/src/glue-logic.ts` — `GlueLogic.executeGroupOperation`,
  the `HiGroupOperations` implementation, the pending-callback resolution
- `packages/web-sdk/packages/homag-intelligence/src/api.ts` — `RoomDesignerRequests.mergeGroups`
  and its `RoomDesignerApi` implementation (runtime-id resolution, `mergeItems`)
- `packages/web-sdk/packages/homag-intelligence/src/debug-logging.ts` — both forwarders
- `packages/web-sdk/packages/planner-core/src/roomle-planner.ts` — `externalObjectGroupOperation`
- `packages/web-sdk/packages/index.ts` — type exports
- tests: `homag-intelligence/__tests__/hi-plan-context-test.ts` (dispatcher with a mock
  `HiGroupOperations`), `glue-logic-test.ts` (the seven operations against
  `RoomDesignerRequestsMock`, `__mocks__.ts` extended), `planner-core/__tests__/roomle-planner.ts`
  (delegation, no HI)
- `packages/embedding-lib/docs/homag-intelligence-embedding.md` — API reference entries

**roomle-hi-example**

- `hi-mcp/hi-mcp-poc-json/planner-api.ts`, `tool-executors.ts`, `hi-mcp-server.ts`
- `hi-mcp/hi-mcp-poc-json-client/browser-bridge.ts`, `minimal-hi-example/index.html`
- tests: `tests/tool-executors.test.ts`, `tests/hi-mcp-server.test.ts`, `tests/planner-api.test.ts`
- `minimal-hi-example/docs/hi-mcp-server.md`, `.agents/skills/hi-mcp-tools.md`,
  `.agents/skills/hi-mcp-server.md`, `.agents/skills/hi-authoring-rules.md`,
  `.agents/skills/roomle-hi-concepts.md`, `AGENTS.md`, `docs/testing-prompts.md`

**ligna-store**

- `hi-mcp/browser-bridge.ts` — the allow-list entry (copy of the reference client)

## Verification

1. roomle-ui: `vitest` of the web-sdk green (new dispatcher, glue-logic and planner tests),
   `tsc` clean → verify: the suites named above pass
2. hi-mcp: `npm test` and `npm run typecheck` at the `hi-mcp` root → verify: the tool list, the
   forwarded commands and the allow-list parity tests pass
3. Live: `npm run dev` against a local UI dev server with the roomle-ui branch, one prompt per
   command from `docs/testing-prompts.md`, the result checked with `get-plan-context` and
   `get-plan-images` → verify: each command changes the plan as the flying menu would

---

## Implementation plan (2026-09-30)

### Assumptions (the open questions, resolved as recommended)

| Q | Decision |
|---|---|
| Q1 | `update-attribute` is retired; `change-module-attribute` replaces it. `updateExternalObjectGroupAttribute` leaves `PlannerApi` and the allow-lists |
| Q2 | `change-group-attribute` changes every root module and sub-module of the group whose master-data module carries the attribute (`assignedAttributes`), in one calculation and one load; the result lists the changed module ids |
| Q3 | The position of `merge-article-into-group` is a docking position: `dockTo { rootId, ownDockingVector, dockingVector, mode?, offset? }`, never coordinates |
| Q4 | The kernel's `mergeObjects` (`RoomleCore src/planner/configurable/configurable-object-dock-operator.cpp:160-218`, `external-module-group-dock-configurator.cpp:208-252`) requires at least two distinct external groups of compatible libraries and **nothing else**: no touch or docking check, nothing is moved, the groups are merged where they stand (a gap stays a gap), no docking connections are added and the sources' `contextData` is dropped. The **first** group of the list survives; `targetRootModuleId` is its first root module. A refused merge is silent. So `merge-groups { targetGroupId, groupIds }` puts the target first, validates the preconditions itself, and the tool description tells the agent that the groups keep their positions |
| Q5 | Completion signal: the kernel fires `externalObjectConfigurationDeleted`, `externalObjectComponentDeleted` and `externalObjectConfigurationsMerged` **synchronously** inside the kernel call (`PlanChangeAggregator`, `plan-element-change-collector.cpp:21-56`); the web layer hands the merge to the glue logic after `wait(0)` (`planner-kernel-access.ts:1505`), and the glue-logic handlers `deleteRootModule` and `mergeGroups` are async (calculation + load). The glue logic therefore keeps a **pending-operation map keyed by group id**, settled at the end of its own `removedGroup`, `deleteRootModule` and `mergeGroups`; a request whose key is not settled within 10 s rejects ("the planner did not perform …"). Every precondition the kernel checks silently is checked in the glue logic first, so the timeout is the exception path only |
| Q6 | Result: `{ command, groups: HiPlanGroup[], removedGroupIds: string[], changedModuleIds?: string[] }`, the groups shaped by `shapeGroup` — the `get-plan-context` shape |
| Q7 | roomle-ui first; the hi-example server is developed against mocks in parallel and verified live with `npm run dev` against a local UI dev server on the roomle-ui branch. The ligna-store gets the one allow-list entry in a separate PR |

Kernel facts that shape the delete command (`RoomleCore src/planner/interaction/plan-interaction-handler.cpp:1258-1310`,
`external-module-group-dock-configurator.cpp:151-182`): the kernel deletes any `ARTICLE` root module
and silently ignores `GENERATED` ones (the web layer's `canBeDeleted` says the same:
`permissionToDelete` is `ALWAYS` for article roots); deleting the **only** root deletes the whole
group and fires `externalObjectConfigurationDeleted`, not `ComponentDeleted`; the remaining roots
are split into connected assemblies, the first keeps the group id, the others arrive without a
`groupId` and get their ids in `_splitOffGroupsFromGroups`.

### roomle-ui — branch `feat/hi-mcp-command-api-RML-18004`

Step → verify:

1. **Vocabulary and types in `hi-plan-context.ts`** — `HI_GROUP_OPERATION` (`change-module-attribute`,
   `change-group-attribute`, `delete-group`, `delete-root-module`, `merge-article-into-group`,
   `exchange-root-module`, `merge-groups`) with the `HiGroupOperation` union, one payload interface
   per command, `HiGroupOperationResult`, and the `HiGroupOperations` interface:

   ```ts
   export interface HiGroupOperations {
     updateModuleAttribute(rootModuleId: string, moduleId: string | null, attributeId: string, value: string | boolean): Promise<PosGroup>;
     updateGroupAttribute(groupId: string, attributeId: string, value: string | boolean): Promise<{ group: PosGroup; changedModuleIds: string[] }>;
     deleteGroup(groupId: string): Promise<void>;
     deleteRootModule(rootModuleId: string): Promise<{ groups: PosGroup[]; removedGroupIds: string[] }>;
     mergeArticleIntoGroup(groupId: string, pick: HiArticlePick, dockTo: HiDockTarget): Promise<PosGroup>;
     exchangeRootModule(groupId: string, rootModuleId: string, articleId: string): Promise<PosGroup>;
     mergeGroups(targetGroupId: string, groupIds: string[]): Promise<{ group: PosGroup; removedGroupIds: string[] }>;
   }
   ```
   → verify: `tsc` clean; types exported from `external-object-api.ts` and `packages/web-sdk/packages/index.ts`

2. **The dispatcher in `hi-plan-context.ts`** — `executeGroupOperation(command: string, payload:
   unknown, ops: HiGroupOperations): Promise<HiGroupOperationResult>`: a
   `Record<HiGroupOperation, handler>`; an unknown command throws `Unknown command '…'. Known
   commands: …`; every handler validates its payload (`<command>: <field> must be a non-empty
   string`; `merge-article-into-group` rejects `articlePos`/`rotationY`/`pos` on the pick and
   requires `dockTo.rootId`, `ownDockingVector`, `dockingVector`; `merge-groups` requires at least
   one source and rejects the target among the sources or a duplicate), calls exactly one `ops`
   method and shapes the result with `shapeGroup`
   → verify: the `executeGroupOperation` tests of step 8 pass against a mock `HiGroupOperations`

3. **The planner request for merging** — `RoomDesignerRequests.mergeGroups(groupIds: string[]):
   Promise<void>` (`glue-logic.ts:123`), implemented in `RoomDesignerApi` (`api.ts`) as a call of a
   new planner method `RoomlePlanner.mergeExternalObjects(groupIds: string[]): Promise<void>`
   (next to `removeExternalObject`): per id `_sceneManager.getExternalObjectComponent(id, '')` →
   `runtimeId` → `getPlanObjectForRuntimeId` → `getPlanElement()`, in the given order (the first
   survives), then `mergeItems(planObjects)`; a missing plan object throws. Forwarded by
   `GlueLayerResponseDebugLogging`; `RoomDesignerRequestsMock.mergeGroups` added
   → verify: the planner test of step 9 passes; `__mocks__.ts` compiles

4. **The operations on `GlueLogicImplementation`** (`implements HiGroupOperations`) with the
   pending-operation map `_pendingKernelOperations: Map<string, { resolve, reject, timer }>`
   (`_awaitKernelOperation(groupId, command)`, `_settleKernelOperation(groupId)`):
   - `updateModuleAttribute`: `_findRootModuleInAllGroups` (throw on unknown root), `_findModule`
     on the sub-module id (throw on unknown module), then the existing `updateAttribute` body
     (`:1858`); returns the group's `posDataJson`
   - `updateGroupAttribute`: `_getGroup` (throw), `_collectModulesWithAttribute` (`:2179`) over every
     root; throw when no module carries the attribute; `modifyAttribute(groupId, modules as
     ExternalModuleInformation[], attributeId, String(value))` (`:1893`); returns the group and the
     module ids
   - `deleteGroup`: `_getGroup` (throw); `_awaitKernelOperation`; `_designerRequests.deleteGroup`;
     settled at the end of `removedGroup` (`:1297`)
   - `deleteRootModule`: `_findRootModuleInAllGroups` (throw); throw on `isGenerated` (the kernel
     would ignore it silently); `_awaitKernelOperation(group.id)`;
     `_designerRequests.deleteRootModule`; settled at the end of `deleteRootModule` (`:989`,
     after `_loadPosData` and `_groupsModified`, resolving with the remaining and the split-off
     groups) or of `removedGroup` (the sole root: resolving with the group id removed)
   - `mergeArticleIntoGroup`: `_getGroup` (throw), anchor root exists and is not generated (throw),
     article resolvable (the lookup `_prepareArticlePickRoots` uses; throw with the catalog hint);
     build the pos group: the non-generated roots with `stripDockingIndices`, the docking entry
     appended to the anchor's `contextData.dockedRoots`, the pick `{ id: _getNextID(), articleId,
     attributes? }` appended to `roots`; `createOrReplacePosDataFromArticleLayout({ posGroups:
     [group] }, 'posGroups')` (`:566`, keeps the existing root ids and remaps the docking), then
     `_designerRequests.loadPosGroups(replaced, { reason: ADJUSTED, applyGroupPosition: true })`
     (the same load `loadExternalObjectGroupLayout` performs, `roomle-planner.ts:2449-2477`);
     returns the replaced group
   - `exchangeRootModule`: `_getGroup`, root exists and is not generated, `newPosDataFromId`
     resolves the article with exactly one non-generated root (every silent `return` of
     `swapRootModule` `:2234-2302` becomes a thrown error), then the existing swap body; returns
     the group
   - `mergeGroups`: every id resolves in `_groupMap` (throw), target not among the sources, no
     duplicates, one `libraryId` across all (the kernel's `areLibrariesCompatible`, refused
     silently otherwise); `_awaitKernelOperation(targetGroupId)`;
     `_designerRequests.mergeGroups([targetGroupId, ...groupIds])`; settled at the end of
     `mergeGroups` (`:1148`), resolving with the target group and the deleted source ids
   - `GlueLogic.executeGroupOperation(command, payload)` = `executeGroupOperation(command, payload,
     this)`; forwarded by `GlueLayerRequestDebugLogging`
   → verify: the glue-logic tests of step 8 pass; the existing `mergeGroups`, `deleteRootModule`,
   `removedGroup`, `swapRootModule`, `modifyAttribute`, `updateAttribute` suites stay green

5. **The planner API** — `ExternalObjectAPI.externalObjectGroupOperation(command: HiGroupOperation,
   payload: object): Promise<HiGroupOperationResult>` with JSDoc (`external-object-api.ts`);
   `RoomlePlanner.externalObjectGroupOperation` cancels dockings like
   `updateExternalObjectGroupAttribute` (`roomle-planner.ts:2726`) and delegates to
   `glueLogic.executeGroupOperation`; **throws** `HI is not available` without the HI module (an
   operation cannot answer with an empty object the way `getExternalObjectPlanContext` does)
   → verify: the planner tests of step 9 pass; `roomDesignerApi.extended.externalObjectGroupOperation`
   is callable from the example page (`npm run dev`)

6. **Documentation** — `packages/embedding-lib/docs/homag-intelligence-embedding.md`, "External
   Object API Reference": one `####` entry for `externalObjectGroupOperation` with the command
   table, one payload example per command, the result shape, and the merge note (groups keep
   their positions, no docking is added)
   → verify: every command of `HI_GROUP_OPERATION` appears in the reference

7. **Exports** — `packages/web-sdk/packages/index.ts`: `HI_GROUP_OPERATION`, the
   `HiGroupOperation*` types → verify: `tsc` clean, `npm run build` of the web-sdk

### roomle-ui — unit tests (vitest, `packages/web-sdk`)

8. **`homag-intelligence/__tests__/hi-plan-context-test.ts`**, new `describe('executeGroupOperation')`
   with `ops` = one `vi.fn()` per `HiGroupOperations` method returning fixture pos groups:
   - an unknown command rejects with the list of the seven known commands and calls no `ops` method
   - per command: a missing or empty required field rejects with `<command>: <field> …` and calls
     nothing (table-driven `it.each` over command × field)
   - `change-module-attribute` forwards `(rootModuleId, moduleId ?? null, attributeId, value)`;
     `change-group-attribute` forwards `(groupId, attributeId, value)` and returns
     `changedModuleIds`; `delete-group` returns `removedGroupIds: [groupId]` and empty `groups`;
     `delete-root-module` returns the remaining and split-off groups shaped; `merge-article-into-group`
     forwards the pick (id-less, attributes kept) and the `dockTo` with defaults `mode: 'StartStart'`,
     `offset: [0, 0, 0]`, rejects a pick with `articlePos`/`rotationY`; `exchange-root-module`
     forwards `(groupId, rootModuleId, articleId)`; `merge-groups` forwards `(targetGroupId,
     groupIds)`, rejects an empty list, the target among the sources and duplicates
   - the result carries `command`, the groups in the `shapeGroup` shape (no `articlePos`, docking
     indices stripped) and `removedGroupIds`

   **`homag-intelligence/__tests__/glue-logic-test.ts`**, new `describe('group operations')` on the
   existing harness (`newGlueLogic`, `arrangePosGroupForTest`, spies on
   `_designerRequests.loadPosGroups` / `deleteGroup` / `deleteRootModule` / `mergeGroups`,
   `vi.useFakeTimers()` for the timeout cases):
   - `updateModuleAttribute`: unknown root rejects; unknown sub-module rejects; sets the value and
     loads once with `CHANGE_ATTRIBUTE`; returns the group
   - `updateGroupAttribute`: with `LibraryDataMock` (`module-1` carries `color`) changes every root
     and sub-module carrying the attribute and none other, one `loadPosGroups`, returns their ids;
     rejects when no module carries it; rejects on an unknown group
   - `deleteGroup`: unknown group rejects without a request; calls `deleteGroup(groupId)` and
     resolves once `removedGroup(groupId)` ran, with `removedGroupIds: [groupId]`; rejects after
     10 s when the callback never comes (fake timers)
   - `deleteRootModule`: unknown root rejects; generated root rejects without a request; calls
     `deleteRootModule(rootId)` and resolves after `deleteRootModule(remaining, rootId, splitOff)`
     with the remaining group (root removed) and the split-off groups (new ids); resolves via
     `removedGroup` when the sole root goes (`removedGroupIds: [groupId]`, `groups: []`)
   - `mergeArticleIntoGroup`: unknown group / anchor / article rejects; the existing root ids are
     kept, the new root has a fresh id, the docking entry sits on the anchor's `contextData` with
     the remapped id, one `loadPosGroups` with `applyGroupPosition: true`, `_groupsModified`
     reports the group as changed; generated roots of the input are dropped
   - `exchangeRootModule`: unknown group / root rejects; an article with two roots rejects;
     otherwise the docking is transferred, the load carries `SWAP_MODULE` and the `moduleIdMap`
     (the existing `swapRootModule` assertions reused)
   - `mergeGroups`: unknown id, target among the sources, duplicate, different `libraryId` reject
     without a request; calls `mergeGroups([target, ...sources])` in that order; resolves after
     the `mergeGroups(targetGroup, sources, rootId, false)` callback with the target group holding
     the sources' non-generated roots and `removedGroupIds` = the sources; rejects after 10 s
     without a callback
   - `executeGroupOperation` on the glue logic runs the dispatcher with the glue logic as `ops`
     (one end-to-end case: `change-module-attribute` on a seeded group)
   - the pending map never leaks: a settled key is removed, a timer is cleared on settle

9. **`planner-core/__tests__/roomle-planner.ts`** (pattern of the `getExternalObjectPlanContext`
   tests, `:4172-4195`):
   - `externalObjectGroupOperation` cancels dockings, delegates `(command, payload)` to
     `glueLogic.executeGroupOperation` and returns its result; rejects with `HI is not available`
     without the HI module (added to the `cancelDockings` `it.each` at `:4507`)
   - `mergeExternalObjects` resolves each group id through `_sceneManager.getExternalObjectComponent`
     and `getPlanObjectForRuntimeId`, calls `mergeItems` with the plan elements in the given
     order, and throws when an id has no plan object (mocks as in the `removeExternalObject`
     tests `:2835-3160`)

### roomle-hi-example — branch `feat/hi-mcp-command-api-RML-18004`

10. **`planner-api.ts`** — `externalObjectGroupOperation(command: string, payload:
    Record<string, unknown>)` forwarded with `SNAPSHOT_CALL_TIMEOUT_MS` (every command but the
    deletes ends in a calculation and a load); `updateExternalObjectGroupAttribute` removed
    → verify: `planner-api.test.ts` (step 13)

11. **The allow-lists** — `MCP_PLANNER_METHODS` (`index.html:1050`) and `PLANNER_METHODS`
    (`browser-bridge.ts:12`): `externalObjectGroupOperation` in, `updateExternalObjectGroupAttribute`
    out; the ligna-store copy in its own PR
    → verify: the parity test; `npm run dev` page executes the method

12. **The tools** — `tool-executors.ts`: a helper `runGroupOperation(api, command, payload)` and one
    executor per command (`change-module-attribute`, `change-group-attribute`, `delete-group`,
    `delete-root-module`, `merge-article-into-group`, `exchange-root-module`, `merge-groups`); group
    ids resolved by id or unique prefix with the `place-group` lookup extracted into
    `findGroup(groups, groupId)`; `merge-article-into-group` and `exchange-root-module` validate
    the `articleId` against the catalog (`validateArticlePickIds`, the catalog list in the error);
    `update-attribute` removed. `hi-mcp-server.ts`: seven `registerTool` calls with zod schemas
    (`dockTo` as an object schema with the vector pair, `mode` enum, `offset` tuple; `groupIds`
    `min(1)`); descriptions name the ids of `get-plan-context`, and `merge-groups` says the groups
    keep their positions and no docking is added — dock a unit with `merge-article-into-group`
    instead; `update-attribute` removed. The instructions gain a workflow step "edit an existing
    group with the command tools"; authoring rule `:139` says "to add, remove or exchange a single
    unit or change attributes, use the command tools; resubmit the whole group with
    create-or-replace-groups only to rebuild it"
    → verify: the tests of step 13; `npm run typecheck`

13. **Unit tests** (vitest, `hi-mcp` root):
    - `tests/tool-executors.test.ts`, one `describe` per tool on `createApi` (extended with
      `externalObjectGroupOperation: vi.fn(async () => ({ command, groups: [], removedGroupIds: [] }))`):
      each tool forwards exactly its command and payload (`change-module-attribute` sends
      `moduleId: null` when omitted; `merge-groups` sends the target first); `delete-group`,
      `delete-root-module`, `exchange-root-module`, `merge-groups` and `merge-article-into-group`
      accept a unique group-id prefix and reject an unknown or ambiguous one with the group list;
      `merge-article-into-group` and `exchange-root-module` reject an `articleId` not in the
      catalog with the catalog list and never call the operation; the result is passed through;
      a planner error is passed through as the tool error; the `update-attribute` tests removed
    - `tests/hi-mcp-server.test.ts`: `EXPECTED_TOOLS` = 15 (nine minus `update-attribute` plus
      seven); every tool's zod schema rejects a missing required field before any planner call
      (`it.each`); the served instructions and rules contain the command-tools workflow line and
      the "keep their positions" merge note; the internal-word guard extended with
      `executeGroupOperation` and `_pendingKernelOperations` (never served to the agent)
    - `tests/planner-api.test.ts`: `externalObjectGroupOperation` forwards `[command, payload]`
      with the snapshot timeout; the parity assertion against `PLANNER_METHODS` holds
    → verify: `npm test` and `npm run typecheck` at the `hi-mcp` root green

14. **Documentation** — `minimal-hi-example/docs/hi-mcp-server.md` (the allow-list paragraph, a
    tool reference entry per command, `update-attribute` removed, demo walkthrough step 5 and the
    example prompts "Delete the middle cabinet", "Replace the middle cabinet with a drawer unit",
    "Add a unit to the right of the group", "Make the whole group white", "Join the two groups");
    `.agents/skills/hi-mcp-tools.md` (overview and reference); `.agents/skills/hi-mcp-server.md`
    ("Adding New Tools": a command tool needs no page change); `.agents/skills/hi-authoring-rules.md`
    and `roomle-hi-concepts.md` (modifying a group: the command tools vs. the replace);
    `AGENTS.md` (tool list, the adding-tools steps); `docs/testing-prompts.md` (a "Group editing"
    section with one prompt per command); this analysis closed out as Implemented
    → verify: every tool name of `EXPECTED_TOOLS` appears in `hi-mcp-server.md` and `hi-mcp-tools.md`

15. **Live verification** — `npm run dev` with the roomle-ui branch served locally, one prompt per
    command from `docs/testing-prompts.md`, the result checked with `get-plan-context` and
    `get-plan-images` → verify: each command changes the plan as the flying menu or the group panel
    would; a merge of two groups standing apart keeps the gap; deleting the middle unit of a row
    of three yields two groups

### Considered and rejected (plan level)

- **Returning a `boolean` from `removeExternalObject` to report a refused delete**: an interface
  change for one case; the pending-operation map reports every refusal (delete and merge) the same
  way, and the glue logic checks the kernel's silent preconditions beforehand.
- **Resolving runtime ids inside `RoomDesignerApi.mergeGroups`**: the scene manager is private to
  the planner; a planner method `mergeExternalObjects` mirrors `removeExternalObject`.
- **A generic `group-operation` tool in the server that forwards any command string**: the seven
  typed tools are the ticket's requirement and the agent's interface; the server maps tool → command
  explicitly, so an unknown command never reaches the planner from the agent.
- **Keeping `update-attribute` beside `change-module-attribute`**: two tools for one edit.

---

## Close-out report (2026-09-30)

### What was built

- **roomle-ui**: `ExternalObjectAPI.externalObjectGroupOperation(command, payload)` on
  `RoomlePlanner` (throws without HI); the vocabulary `HI_GROUP_OPERATION`, the payload types, the
  `HiGroupOperations` interface and the dispatcher `runGroupOperation` in `hi-plan-context.ts`; the
  seven operations on `GlueLogicImplementation` (`changeModuleAttribute`, `changeGroupAttribute`,
  `deleteGroup`, `deleteRootModuleById`, `mergeArticleIntoGroup`, `exchangeRootModule`,
  `mergeGroupsById`) plus `getCalculatedGroups`; `RoomDesignerRequests.mergeGroups` with the internal
  planner method `_mergeExternalObjects`; both debug-logging forwarders; exports and the embedding
  API reference entry.
- **roomle-hi-example**: seven MCP tools replacing `update-attribute`, one planner method
  (`externalObjectGroupOperation`, snapshot timeout) replacing `updateExternalObjectGroupAttribute`
  in `planner-api.ts` and both allow-lists; the served workflow step, the authoring rules and
  example 5 point to the command tools; documentation and skills updated.
- **ligna-store**: the allow-list entry (`hi-mcp/browser-bridge.ts`, identical to the reference
  client).

### Decisions taken during the implementation

1. **No timeout.** The plan's 10 s rejection was a timer for correctness (roomle-ui
   `.agents/async-shared-state.md`, Rules 7 and 9). The completion signal exists: the glue logic's
   kernel reports `removedGroup`, `deleteRootModule` and `mergeGroups` settle a deferred armed per
   group id before the request. A root module deletion is reported within the request, so an
   unreported one is rejected at once as refused; a group deletion and a merge are reported later,
   so their preconditions (group in the scene, one library) are checked before the request. A
   second operation on a group with a pending one is rejected.
2. **Operations resolve after the planner load.** The plan context reads the groups from the
   kernel, so `updateAttribute`, `modifyAttribute`, `swapRootModule` and the `deleteRootModule` and
   `mergeGroups` reports now await their `loadPosGroups` at the end; the order of their side effects
   is unchanged.
3. **`removeExternalObject` switches child object mode off before it deletes a group** (found live).
   Deleting a root module by id puts its group into child object mode, and in that mode the kernel
   deleted only the group's first root module. This was a defect of the public API, not of the new
   commands; the fix mirrors `selectExternalObject`.
4. **Merge results name the merged groups from the request** (found live): the kernel reports them
   as removed while the merge is loaded, before `mergeGroups` does its own bookkeeping.
5. A sub module is accepted by its master-data module name, because the plan context shows sub
   modules by `name`; `changedModuleIds` use the same names.
6. `_mergeExternalObjects` is internal (underscore), so the public API gains only the one method.
7. `merge-article-into-group` keeps the generated roots in the replaced group, like the glue
   logic's own merge, swap and delete.
8. The ligna-store branch is stacked on the local, unpushed `refactor/hi-mcp-group-positioning-RML-18007`
   (`f4f6619`), whose allow-list already carries the two methods the merged server calls.

### Verification

| Check | Result |
|---|---|
| roomle-ui SDK suite (`npm run test`, web-sdk) | 126 files, 2000 passed, 24 skipped; a second full run after the last fixes had 7 unrelated tests hit the 100 ms timeout, all 7 files pass on their own (316 tests) |
| roomle-ui types (`npm run lint:types`: ui, sdk, embedding) | clean |
| roomle-ui `lint:code:sdk`, `format:push` | 0 errors (1 existing warning in an unrelated file), formatted |
| roomle-ui `lint:docs:ui` / `lint:docs:sdk` | exit 3 with the same 22 warnings as clean master / a type error inside the third-party `bun-webgpu` package |
| hi-mcp `npm run typecheck`, `npm test` | clean, 181 tests pass; the `cf` worker suite does not load (`@cloudflare/containers` not installed, as before) |
| Live, local roomle-ui dev server + example page in headless Chromium + MCP client | 8 of 8 steps: change module and group attribute, merge an article, exchange, delete a root (the row splits), merge the two groups, three rejections, delete the merged group (plan empty) |

Not done: the ligna-store page was not run live; nothing is pushed and no pull request is open.
