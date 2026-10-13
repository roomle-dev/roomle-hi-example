# The group load answers per input group what the planner built

> **Date**: 2026-10-13 (supersedes the bug analysis of 2026-10-10, written against the tool logic in the server)
> **Status**: Implemented — roomle-ui `feat/hi-layout-load-outcome-RML-18139` (not merged), documentation on `docs/group-load-result-analysis`
> **Ticket**: [RML-18139](https://roomle.atlassian.net/browse/RML-18139)
> **Base**: roomle-ui `refactor/hi-tool-logic-RML-18147` (`e19768f53`, the tool logic in the planner — [RML-18147](https://roomle.atlassian.net/browse/RML-18147), [ADR 0007](../decisions/0007-hi-mcp-tool-logic-in-the-planner.md)); roomle-hi-example `master` (`91516aa`)
> **Related**: [RML-18033](https://roomle.atlassian.net/browse/RML-18033) (guards and auto correction, D30)

## Affected repositories

- **roomle-ui** — the glue-logic answers a `posGroups` layout load per input group: the group of
  the plan it became, or restored after a calculation the library could not do, or left out with
  the reason (`glue-logic.ts`); the `create-or-replace-groups` command reads that answer
  (`hi-tool-commands.ts`, `hi-tool-ids.ts`, `hi-tool-payload.ts`): a left-out group and a restored
  replace go to `notLoaded`, and the groups of the call are paired with the groups of the plan by
  the answer instead of by their order.
- **roomle-hi-example** — no code change: the server forwards the tool and passes the result on
  (`inPlanner`, `tool-executors.ts`). The behaviour documentation and the tool reference change
  with the result, and the backlog item closes.
- **ligna-store** — no change; it consumes the same tool results.

## 1. What was asked and why

The ticket asks that the load result of `create-or-replace-groups` names per input group what the
planner did with it — built, restored, left out with the reason — and that the tool reports a
left-out group in `notLoaded`, pairs the groups of the call with the groups of the plan by that
answer instead of by their order, and reads a restored replace from it.

The ticket's precondition — "the current approach should be refactored, much of the code in the
HI MCP server tool implementation could be moved to the roomle-ui glue-logic" — is met by
RML-18147: on the base branch the whole tool runs in roomle-ui as the command
`create-or-replace-groups` (`HI_TOOL_COMMANDS`, `hi-tool-commands.ts`), and the server only
forwards it. Everything below is therefore a roomle-ui change, and the public planner API
(`loadExternalObjectGroupLayout`, `LoadExternalObjectGroupResult`) is not on the path any more.

## 2. How the load works today on the base branch

### 2.1 The seam

The command reaches the plan through `HiToolPlanner` (`hi-tool-commands.ts:92-115`). Its layout
load answers with ids only:

```ts
loadExternalObjectGroupLayout(
  layout: { posGroups: any[] },
  layoutType: 'posGroups',
  options: LoadExternalObjectOptions,
): Promise<Array<{ id: string }>>;
```

`HiToolsImplementation` implements it in-process (`_loadGroupLayout`, `hi-tools.ts:343-362`): it
calls `createOrReplacePosDataFromArticleLayout` of the glue-logic, loads the calculated groups
with `loadPosGroups` and returns `loaded.map((group) => ({ id: group.id }))` — the glue-logic's
group ids, which are the ids the plan context reports. The kernel's runtime ids of
`LoadExternalObjectGroupResult` (`external-object-api.ts:151-153`, `roomle-planner.ts:2485-2512`)
are not involved.

### 2.2 Where the per-input-group outcome exists and is dropped

`_createOrReplacePosGroupsFromLayout` (`glue-logic.ts:751-821`) walks the input groups in order
and is the only place that knows both sides. Per input group it does one of four things:

| Input group | What happens | Recorded? |
|---|---|---|
| no roots (`:762-764`) | `continue` | no — the command drops such a group before the load (G1), so the glue-logic never sees one from the tool |
| its id is in the plan and `calculationInProgress` (`:773-779`) | `console.error`, `continue` | no — the realistic left-out case: the group is being calculated by a user interaction while the tool runs |
| its id is in the plan (`:780-801`) | replace: `_calculateAndUpdateGroupMap(existingGroupItem, true, true)`, the result pushed to `processedPosGroups` | the group, not whether the calculation took |
| new (`:804-815`) | `_addNewGroup` (an uncalculated group is added too, `:2099-2109`), arranged and stored, pushed | the group |

It returns `processedPosGroups`, or `undefined` when nothing was processed (`:816-820`). An
exception thrown while one group is calculated rejects the whole load: nothing is loaded, the
groups added to `_groupMap` before it stay there unloaded, and the tool rejects with the
planner's message.

### 2.3 The restored replace

A replace the library cannot calculate does not fail. `_runGroupCalculation`
(`glue-logic.ts:1967-2021`) compares the recalculated group with the last calculated one
(`newlyFailedRootModules`, `:444-454`); when a root module newly fails it records the ids in
`groupData.discardedRootModuleIds` (`:1989-1991`) and `_discardCalculation` (`:2046-2056`)
restores the previous group, re-registers it and returns it as the calculated group. The load
reports the old group as loaded, under its id. The failed root modules with their library
diagnostics reach only the console (`_logFailedRootModules`, `:2058-2067`).
`discardedRootModuleIds` has one reader, the D69 retry of `changeAttributes`
(`hi-tools.ts:543-560`).

### 2.4 What the command does with the ids

The command loads (`hi-tool-commands.ts:538-556`), checks only that the answer is not empty, and
reads the plan context. From there every pairing of a group of the call with a group of the plan
goes through `matchResultGroups` (`hi-tool-ids.ts:290-309`): a group with a `resultId` by it, a
replaced group by its id, a new group by its order among the groups the load added
(`newGroups[nextNew++]`). Six consumers depend on that pairing:

- `placeAtWalls` (`hi-tool-commands.ts:147-247`) — guarded by a count: when the planner built
  more or fewer new groups than the call sent, it moves no group and says so per group (G60,
  `:154-170`); else it pairs once and stores `resultId`.
- `applyGroupWideAttributes` (`hi-tool-attributes.ts:363-372`) — the group materials of a group.
- `rememberAgentGroupIds` (`hi-tool-ids.ts:338-352`) — the agent's id for a regenerated group id.
- the `failedRoots` loop (`hi-tool-commands.ts:617-642`) — per-root library errors in `notLoaded`.
- the obstacle hint's `groupIds` (`:645-652`) and `callGroupIds` for the result's `groups`
  (`:674-680`).

A left-out group shifts every pairing behind it. The restored replace is detected by comparing
article ids before and after (`reportRevertedReplaces`, `hi-tool-payload.ts:230-256`): a group
whose roots still hold the previous articles gets a correction naming no root module and no
diagnostic. A discarded replace that changed only attributes or docking has the same article ids
before and after, so it is not detected at all.

The `it.fails` test of the ticket lives in roomle-ui now
(`__tests__/hi-tool-commands/create-or-replace-groups-input-test.ts:20-40`): two input groups, the
planner builds one, `notLoaded` should name the other by its index.

## 3. The gap

The outcome per input group is produced once, in `_createOrReplacePosGroupsFromLayout`, and
discarded there. The command gets a list of ids with no index, so it pairs by order and can only
check that the list is not empty. Three consequences:

1. A group the planner leaves out is not reported, and the groups behind it get the wrong
   materials, remembered ids and error attribution; the wall placement refuses to place any group
   of the call (G60).
2. A restored replace is reported as a success and detected only by a heuristic on the article
   ids, which names no root module and misses a replace that changed attributes only.
3. The order-based pairing is a guess that is right only while every input group becomes exactly
   one plan group, in order.

## 4. Proposed design

### 4.1 roomle-ui, glue-logic: the layout load answers per input group

A new type next to `GroupItem` in `glue-logic.ts`:

```ts
/** What a posGroups layout load did with one input group. */
export interface LayoutGroupOutcome {
  index: number;                              // the input group's index in the layout
  id?: string;                                // the group of the plan it became; absent when left out
  outcome: 'built' | 'restored' | 'leftOut';
  reason?: string;                            // leftOut: why
  failedRootModules?: Array<{                 // restored: the root modules the library could not calculate
    id: string;
    articleId?: string;
    message: string;                          // the first line of the first Error or Fatal diagnostic
  }>;
}
```

`_createOrReplacePosGroupsFromLayout` becomes the public
`createOrReplacePosGroupsFromLayout(layout): Promise<{ groups: PosGroup[]; outcomes: LayoutGroupOutcome[] }>`
and records one outcome per input group where it decides today:

- no roots → `leftOut`, "the group has no roots";
- `calculationInProgress` → `leftOut`, "a calculation of group '…' is in progress";
- a replace → after `_calculateAndUpdateGroupMap`, `restored` when the group item holds
  discarded root modules, else `built`;
- a new group → `built`;
- an exception while one group is prepared or calculated → `leftOut` with the error message; the
  other groups go on (D30: a call loads every group that can be built). Today such an exception
  rejects the whole load and leaves the groups added before it in `_groupMap` unloaded.

`createOrReplacePosDataFromArticleLayout` (`glue-logic.ts:637-645`) keeps its signature and, for
`posGroups`, returns the `groups` of the new method (or `undefined` when empty), so the public
planner API, its tests and the other caller in `hi-tools.ts` stay as they are.

For the diagnostics of a restored replace, `GroupItem.discardedRootModuleIds?: string[]`
(`glue-logic.ts:296`) becomes `discardedRootModules?: PosModuleRootData[]` — the failed root
modules `_runGroupCalculation` already has (`:1981-1996`), with their `logMessages`. The D69
reader (`hi-tools.ts:543-560`) maps them to ids. Nothing else changes in the discard path.

### 4.2 roomle-ui, the tool command reads the answer

`HiToolPlanner.loadExternalObjectGroupLayout` returns `Promise<LayoutGroupOutcome[]>`;
`_loadGroupLayout` (`hi-tools.ts:343-362`) loads the `groups` and returns the `outcomes`.

In `create-or-replace-groups`, right after the load (`hi-tool-commands.ts:538-556`):

- every `built` or `restored` outcome sets `callGroups[outcome.index].resultId = outcome.id` — the
  index of the layout maps to the call group at that position, since the layout holds the
  buildable call groups in their order;
- a `leftOut` outcome moves its call group to `notLoaded`:
  `{ index, id?, errors: ["posGroups[i]: the planner did not build the group - <reason>; send it again"] }`,
  and the group leaves `callGroups`, so no later step touches it;
- a `restored` outcome moves its call group to `notLoaded` with the failed root modules:
  `{ index, id, rootIds, errors: ["posGroups[i]: the planner could not calculate the new layout of group '…' and kept its previous content - the library could not calculate root module '…' (<article>) - <diagnostic>. Check posGroups[i].attributes and the root's attribute overrides against the library data; change the failing values or replace the article"] }`
  — the shape and the advice of the `failedRoots` entries (step 9 of §6 of the behaviour
  document). `reportRevertedReplaces` and its correction go. The restored group stays in the
  result's `groups` as it is now, since it is a group of the call;
- the "nothing loaded" check throws, as today, when no outcome is `built` or `restored`, with every
  `notLoaded` error;
- a `built` id that the plan does not hold after the load is reported as not loaded as well — the
  one check the glue-logic cannot make for the kernel.

`matchResultGroups(callGroups, groups)` pairs by `resultId` only: the `beforeGroupIds` parameter
and the order fallback go. Its callers (`placeAtWalls`, `applyGroupWideAttributes`,
`rememberAgentGroupIds`, the `failedRoots` loop, the obstacle `groupIds`, `callGroupIds`) drop the
argument and are otherwise unchanged. `placeAtWalls` loses the count guard G60 and its own pairing:
every group of the call that was built goes to its wall, a left-out one is skipped by the existing
`resultId === undefined` check (`:201`). G59 (a reloaded group that still covers its floor) stays.

The result keeps `loaded: [{ id }]` for the agent — the `built` and `restored` entries — so the
served description ("returns the loaded object ids") and the server stay true. `runToolCommand`
(`hi-tool-commands.ts:1312-1322`) counts a load as an undo step when any outcome has an id; the
reloads of `place-group` and `placeAtWalls` read the same answer and keep their checks.

### 4.3 roomle-hi-example: documentation only

The server forwards the tool (`inPlanner('create-or-replace-groups')`, `tool-executors.ts`) and the
`notLoaded` shape `{ index, id?, rootIds?, errors }` is unchanged, so the served text — "notLoaded
lists the groups and the roots it could not build or fully calculate, with what to send instead"
(`hi-mcp-server.ts:32`, `:281-283`) — stays true. The documents of §7 change.

## 5. Alternatives considered and rejected

- **Extend the public `LoadExternalObjectGroupResult`** (the proposal of the 2026-10-10 analysis).
  On the base branch the tool path does not pass through `RoomlePlanner.loadExternalObjectGroupLayout`
  (D71: `_loadGroupLayout` goes to the glue-logic directly), the public result carries kernel
  runtime ids that name no group of the plan context, and its other consumers — the catalog
  example and the planner-core tests — need nothing of it. The public API stays as it is.
- **A list of runtime ids per input group** (`ids: number[]`, for a split group). The tool path
  answers with the glue-logic group id, one per group; the kernel splits a group only on
  delete-in-place, which the glue-logic learns from the kernel's callbacks, not from a layout load.
- **Pair by the order of the answer.** `processedPosGroups` is in input order, but a left-out
  group still shifts it; the index is the answer, the order is a guess.
- **Keep the article comparison for the restored replace.** It names no root module and no
  diagnostic, and it misses a discarded replace whose article ids did not change.
- **Refuse a call when the planner left out a group.** A guard against D30 and §2.2 of the
  behaviour document: the other groups of the call are built and the result says what was not.
- **Build the answer in the server first.** Not possible any more: the server has no load of its
  own (D71).

## 6. Tests

roomle-ui `__tests__/glue-logic-test.ts`, `describe('createOrReplacePosDataFromArticleLayout - posGroups')`
(`:6257`), on the new method:

- `it('names per input group the group of the plan it became')` — two new groups, two `built`
  outcomes with the indexes 0 and 1 and the regenerated ids
- `it('names a group without roots as left out')` — extends `should skip groups without roots`
  (`:6671-6686`): the group is left out with its reason, the other group is built
- `it('names a group whose calculation is in progress as left out')`
- `it('names a replace the library could not calculate as restored, with the root modules and their diagnostics')`
  — the discard pattern of `discards the change when the library reports an error for a root module`
  (`:2611-2653`): `calculateGroup` mocked to fail one root; the outcome is `restored` with that
  root module's id and the first line of its message, and the group map holds the previous group
- `it('leaves out a group whose calculation throws and builds the others')`

roomle-ui `__tests__/hi-tool-commands/`:

- `it.fails('RML-18139: reports a group omitted by the planner in notLoaded')`
  (`create-or-replace-groups-input-test.ts:20`) becomes a regular test, with the load mock
  answering per input group
- `it('sets the group attributes on the second group when the planner left out the first')` — the
  pairing test of the ticket
- `it('remembers the agent id of the group that was built when the planner left out the one before it')`
- `it('places the groups the planner built by wall and names the one it left out')` — replaces
  `moves no group by wall when the planner built more or fewer new groups than the call sent, and says so`
  (`create-or-replace-groups-placement-test.ts:2448-2467`); `createWallApi` (`:2066-2141`) answers
  per input group
- `it('reports a replace the planner restored, with the root module the library could not calculate')`
  — replaces `reports a replace the planner reverted to the previous content` (`:873-889`)
- `it('reports a built group the plan does not hold after the load')`
- `run-tool-command-test.ts`: `counts a load that loaded something as an undo step` (`:63-75`)
  with the new answer; `it('counts no undo step for a load that left every group out')`
- `__mocks__.ts`: the default load of `createApi` answers one `built` outcome per input group

roomle-ui `__tests__/hi-tools-test.ts`, `describe('HI tool commands')` (`:2489`):

- `it('answers the layout load of a tool per input group')` — through the real glue-logic, a
  group whose calculation the library mock fails is restored and named

roomle-hi-example: no code change, so no new server test; the existing forwarding tests stay.

## 7. Code and documents the work touches

roomle-ui (`packages/web-sdk/packages/homag-intelligence/`):

| File | Change |
|---|---|
| `src/glue-logic.ts` | `LayoutGroupOutcome`; `createOrReplacePosGroupsFromLayout` with the outcomes, `createOrReplacePosDataFromArticleLayout` delegating; `GroupItem.discardedRootModules` |
| `src/hi-tools.ts` | `_loadGroupLayout` returns the outcomes; the D69 reader maps `discardedRootModules` to ids |
| `src/hi-tool-commands.ts` | `HiToolPlanner.loadExternalObjectGroupLayout` type; the create command reads the outcomes; `placeAtWalls` without G60; `runToolCommand` step count; `place-group`'s reload check |
| `src/hi-tool-ids.ts` | `matchResultGroups` by `resultId`, `rememberAgentGroupIds` |
| `src/hi-tool-payload.ts` | `reportRevertedReplaces` removed |
| `src/hi-tool-attributes.ts` | `applyGroupWideAttributes` without `beforeGroupIds` |
| the tests of §6 | |
| `.agents/homag-intelligence.md` | the planner seam paragraph: the layout load answers per input group |
| `packages/embedding-lib/docs/homag-intelligence-embedding.md` | the `create-or-replace-groups` result paragraph: `notLoaded` names a group the planner left out and a replace it restored |

roomle-hi-example:

| File | Change |
|---|---|
| `docs/hi-mcp-behaviour.md` | a decision row (the planner answers per input group, the pairing by the answer; rejected: by order, the article comparison, the public load result); D23 loses its pairing-by-order sentence and G60; §6 `create-or-replace-groups` steps 6, 7 and 9 and the result paragraph; §8.3: the G60 row goes, the restored-replace row becomes a `notLoaded` row, a row for a group the planner left out |
| `docs/hi-mcp-server.md` | the `notLoaded` paragraph of `create-or-replace-groups` |
| `docs/implementation/tool-executors.md` | steps 10 and 11 of the pipeline |
| `.agents/skills/hi-mcp-tools.md` | the **Returns** paragraph of `create-or-replace-groups` |
| `.agents/backlog/planner-load-outcome-per-group.md`, `.agents/backlog/README.md` | the item leaves the backlog when the roomle-ui change lands |

ligna-store: nothing.

## 8. Decisions to confirm

1. **A restored replace goes to `notLoaded`**, with `rootIds` and the diagnostics, instead of the
   correction of today. The group was not built as sent, which is what `notLoaded` reports (D30),
   and the entry gets the shape and the advice of the loaded-root errors. The alternative keeps it
   a correction with the root modules named.
2. **An exception while one group is calculated leaves that group out** and the others load,
   instead of rejecting the whole call. It follows D30 and removes the groups left unloaded in
   `_groupMap` today; it changes what the agent sees for such a call from an error to a partial
   result with `notLoaded`.
3. **The diagnostics of a restored replace travel in the group item** (`discardedRootModules`
   instead of `discardedRootModuleIds`). The alternative keeps the ids only; the `notLoaded` entry
   then names the root modules without the library's reason.

## 9. Implementation plan

The plan builds on §4 with the three choices of §8 taken as proposed: a restored replace goes to
`notLoaded`, an exception while one group is calculated leaves that group out, and the group item
carries the discarded root modules with their diagnostics. One deviation from §4.1: the glue-logic
passes each diagnostic as the library wrote it, and the command shortens it to its first line
without the trailing period, as its loaded-root loop does — one formatting, in one place.

### 9.1 Branches, commits, verification

| Repository | Branch | Commits |
|---|---|---|
| roomle-ui | `feat/hi-layout-load-outcome-RML-18139` off `refactor/hi-tool-logic-RML-18147` | 1 `feat: answer the hi layout load per input group` (step 1), 2 `feat: report the groups the planner left out or restored in notLoaded` (step 2), 3 `docs: document the layout load answer per input group` (step 3) |
| roomle-hi-example | `docs/layout-load-answer` off `master` | `docs: pair the groups of a create by the planner's answer` (step 4) |

After every roomle-ui step: `cd packages/web-sdk && npm run test -- homag-intelligence` (the tests of
the package), then at the root `npm run lint:types`, `npm run lint:code` and `npm run format`.
roomle-hi-example changes no code; `npm run format:check` for the docs. A live check on the local
dev build (roomle-ui on :5173 with `npm run dev`, the example with `--dev`) only on request.

### 9.2 Step 1 — the glue-logic answers per input group (roomle-ui)

`src/glue-logic.ts`:

- `GroupItem.discardedRootModuleIds?: string[]` (`:296`) becomes
  `discardedRootModules?: PosModuleRootData[]`; `_runGroupCalculation` resets it (`:1972`) and
  stores `failedRootModules` (`:1989-1991`). The D69 reader in `changeAttributes`
  (`src/hi-tools.ts:543-560`) reads the ids from it: `groupItem.discardedRootModules.map((root) => root.id)`.
- `export interface LayoutGroupOutcome` next to `GroupItem`, as in §4.1, with
  `failedRootModules?: Array<{ id: string; articleId?: string; message: string }>` where `message`
  is the `msg` of the root module's first `Error` or `Fatal` log message
  (`CALCULATION_ERROR_CATEGORIES`).
- `_createOrReplacePosGroupsFromLayout` (`:751-821`) becomes
  `public async createOrReplacePosGroupsFromLayout(articleLayoutJson): Promise<{ groups: PosGroup[]; outcomes: LayoutGroupOutcome[] }>`.
  It walks `inputGroups.entries()` and records per index: no roots → `leftOut`, "the group has no
  roots"; `calculationInProgress` → `leftOut`, "a calculation of group '<id>' is in progress"
  (the `console.error` stays); a replace → after `_calculateAndUpdateGroupMap`, `restored` with
  the group id and the failed root modules when `existingGroupItem.discardedRootModules` is
  non-empty, else `built` with the group id; a new group → `built` with
  `emulatorGroupItem.posDataJson.id`. The body of one iteration runs in a `try`; a thrown error
  records `leftOut` with the error's message and the loop goes on. A missing or empty `posGroups`
  returns empty lists. `_groupsModified` runs when a group was processed, as today.
- `createOrReplacePosDataFromArticleLayout` (`:637-645`) calls the new method for `posGroups` and
  returns its `groups`, or `undefined` when there are none — the planner API, `debug-logging.ts`
  and `mergeArticleIntoGroup` (`src/hi-tools.ts:677-690`) stay unchanged.

Tests, `__tests__/glue-logic-test.ts`, `describe('createOrReplacePosDataFromArticleLayout - posGroups')`
(`:6257`), with `newAgentPosGroup`, `spyOnNotifications`, `getPosGroupTestResult` and
`testLibraryOf` of the file:

- `it('names per input group the group of the plan it became')` — two new groups → two `built`
  outcomes, indexes 0 and 1, the ids of the returned groups.
- `it('names a group without roots as left out')` — extends
  `should skip groups without roots` (`:6671-6686`): a group without roots beside a group with one;
  the outcome of index 0 is `leftOut` with "the group has no roots", index 1 `built`;
  `createOrReplacePosDataFromArticleLayout` still returns the one group.
- `it('names a group whose calculation is in progress as left out')` — a group created through
  the layout, `getPosGroupTestResult(id)!.calculationInProgress = true`, the layout replaces it:
  `leftOut` with "a calculation of group '…' is in progress", `groups` empty.
- `it('names a replace the library could not calculate as restored, with the root modules and their diagnostics')`
  — a group created through the layout, then replaced with `calculateGroup` mocked as in
  `discards the change when the library reports an error for a root module` (`:2611-2653`): the
  outcome is `restored` with the group id and `failedRootModules` `[{ id, message: 'Could not find entry in tab_DoorSettings' }]`,
  the stored group is the previous one.
- `it('leaves out a group whose calculation throws and builds the others')` —
  `HiRootModuleArrangementOperator.prototype.arrangeRootModules` mocked once to throw (the spy
  pattern of `:6276`): index 0 `leftOut` with the message, index 1 `built`, one group returned.
- `describe('changeAttributes')` of `__tests__/hi-tools-test.ts` (`:626`) stays green: the D69
  tests read the corrections only.

### 9.3 Step 2 — the command reads the answer (roomle-ui)

`src/hi-tool-commands.ts`:

- `HiToolPlanner.loadExternalObjectGroupLayout` (`:99-103`) returns
  `Promise<LayoutGroupOutcome[]>` (type import from `glue-logic.ts`).
- `create-or-replace-groups`, after the load (`:538`): for every outcome with an `id`,
  `callGroups[outcome.index].resultId = outcome.id`; a `leftOut` outcome pushes
  `{ index: callGroup.index, ...(id), errors: ["posGroups[i]: the planner did not build the group - <reason>; check the group and send it again"] }`
  to `notLoaded`; a `restored` outcome pushes
  `{ index, id, rootIds, errors }` with one error per failed root module:
  "posGroups[i]: the planner could not calculate the new layout of group '<id>' and kept its
  previous content - the library could not calculate root module '<root>' (<article>) -
  <first line>. Check posGroups[i].attributes and the root's attribute overrides against the
  library data; change the failing values or replace the article". Then
  `callGroups = callGroups.filter((callGroup) => callGroup.resultId !== undefined)`, so the left-out
  groups leave the call; a restored group stays in it with its id and the later steps treat it as
  a replaced group, as today. The "nothing loaded" check (`:545-556`) throws when no outcome has an
  id, with the `notLoaded` errors as today. `reportRevertedReplaces` (`:565-570`) and its import go.
  `loaded` in the result (`:683`) becomes the outcomes with an id, as `[{ id }]`.
- `placeAtWalls` (`:147-247`) takes `planner`, `wallPlacements` and `corrections`: the count
  guard G60 (`:154-170`) and its own `matchResultGroups` call (`:172-178`) go; the `resultId`
  is set already, and a left-out group is skipped by `:201`.
- `runToolCommand` (`:1312-1322`) counts a load as a step when `loaded.some((outcome) => outcome.id !== undefined)`.
- `place-group` (`:735-747`): the reload check reads the same, and the error names the reason:
  "Group '<id>' could not be reloaded at the new position - <reason>".

`src/hi-tool-ids.ts`: `matchResultGroups(callGroups, groups)` (`:290-309`) pairs by `resultId`
only — `beforeGroupIds`, `matched` and `newGroups` go; `rememberAgentGroupIds` (`:338-352`)
drops `beforeGroupIds`. `src/hi-tool-attributes.ts`: `applyGroupWideAttributes` (`:363-372`)
drops it too. `src/hi-tool-payload.ts`: `reportRevertedReplaces` and `articlePicksOf`
(`:224-256`) go. `src/hi-tools.ts`: `_loadGroupLayout` (`:343-362`) calls
`createOrReplacePosGroupsFromLayout`, loads `groups` when there are any and returns `outcomes`.

Tests. Every load fake answers one outcome per input group, with the id of the group it puts into
the plan: `createApi` (`__tests__/hi-tool-commands/__mocks__.ts:285`) answers
`layout.posGroups.map((group, index) => ({ index, id: group.id ?? \`loaded-${index + 1}\`, outcome: 'built' }))`,
and a harness that adds groups to its plan context after the load — `createSequenceApi`,
`createMaterialsApi` (`create-or-replace-groups-placement-test.ts:1153`), `createWallApi`
(`:2066-2141`, `omitted` answers `leftOut`), the fakes at `:318`, `:337`, `:556`, `:788`,
`:1830`, `place-group-test.ts:42`, `:85`, `:230` and `run-tool-command-test.ts:78` — answers the
ids of those groups in the order of the call, which is the pairing these tests model. The
existing assertions on `result.loaded` (`:376`, `:849`, `:888`, `:1729`, `hi-tools-test.ts:2539`)
keep their shape. New or rewritten tests:

- `create-or-replace-groups-input-test.ts:20`: `it.fails` becomes
  `it('RML-18139: reports a group the planner left out in notLoaded, with its reason')` — the
  load answers `built` with `created-group` for index 0 and `leftOut` with "a calculation of
  group 'x' is in progress" for index 1; `notLoaded` is
  `[{ index: 1, errors: [stringContaining("did not build the group - a calculation of group 'x' is in progress")] }]`,
  `loaded` `[{ id: 'created-group' }]`, `groups` holds `created-group`.
- `it('rejects a call whose every group the planner left out, with the reasons')` — every outcome
  `leftOut`; rejects with "No groups were created or replaced" and the reasons; no undo step
  (`runToolCommand` rethrows at `steps === 0`).
- `describe('create-or-replace-groups materials')`:
  `it('sets the group attributes on the second group when the planner left out the first')` — two
  new groups with `attributes`, the load answers `leftOut` for index 0 and `g-new` for index 1;
  one `change-attributes` on `g-new`, `groupAttributes` `[{ index: 1, id: 'g-new', … }]`,
  `notLoaded` names index 0.
- `it('remembers the agent id of the group the planner built when it left out the one before it')`
  — after the pattern of `replaces the group created earlier under the agent's own id` (`:740`):
  two new groups `k1`, `k2`, the first left out; a second call with `k2` replaces `g-new`.
- `describe('create-or-replace-groups wall placement')`:
  `moves no group by wall when the planner built more or fewer new groups than the call sent, and says so`
  (`:2448-2467`) becomes
  `it('places the groups the planner built by wall and names the one it left out')` —
  `placedBy([row({ wall: 'left' }), row({ wall: 'back' })], { omitted: [0] })`: two loads, the
  second group reloaded at the back wall, `notLoaded` `[{ index: 0, errors: [...] }]`, no G60
  correction.
- `reports a replace the planner reverted to the previous content` (`:873-889`) becomes
  `it('reports a replace the planner restored, with the root module the library could not calculate')`
  — the load answers `restored` for `g1` with
  `failedRootModules: [{ id: 'u2', articleId: 'article-1', message: 'Width cannot be calculated\nInternal stack trace' }]`;
  `notLoaded` is `[{ index: 0, id: 'g1', rootIds: ['u2'], errors: [the sentence of §9.3 with 'Width cannot be calculated'] }]`,
  no correction, `groups` holds `g1`.
- `place-group-test.ts`: `it('names the reason when the planner does not reload the group')` — the
  load answers `leftOut`; rejects with "could not be reloaded at the new position - <reason>".
- `hi-tools-test.ts`, `describe('HI tool commands')` (`:2489`):
  `it('reports a replace the library could not calculate through the real glue-logic')` — a group
  created with `executeGroupOperation('create-or-replace-groups', …)` as in `:2513`, then replaced
  with `calculateGroup` mocked to fail its root: `result.notLoaded` names the group with `rootIds`
  and the diagnostic, `result.groups[0].id` is the group's id, `loadPosGroups` was called twice.
- `run-tool-command-test.ts:63-75` stays as the guard of the step count with the new answer.

### 9.4 Step 3 — roomle-ui documentation

- `.agents/homag-intelligence.md:213`, the planner seam: the layout load answers per input group
  (`LayoutGroupOutcome`: built, restored, left out with the reason), the command pairs the groups
  of the call by it. `:217`, testing: the fake load answers one outcome per input group.
- `packages/embedding-lib/docs/homag-intelligence-embedding.md:1818`, the result paragraph of
  `create-or-replace-groups`: `notLoaded` also names a group the planner left out, with the reason,
  and a replace it restored because the library could not calculate the new layout, with the
  root modules. The `loadExternalObjectGroupLayout` section (`:1376-1402`) is unchanged.

### 9.5 Step 4 — roomle-hi-example documentation

- `docs/hi-mcp-behaviour.md`: a decision row D73 under a new heading "Load answers (2026-10-13)":
  the planner answers a layout load per input group and the tool pairs the groups of the call by
  that answer; a left-out group and a restored replace are reported in `notLoaded`; rejected: the
  pairing by order (G60), the article comparison, an extension of the public load result (D71),
  runtime ids; guarded by the tests of §9.3. D23 (`:181`) loses "The new groups of the plan are
  paired with the call's by their order; … the server moves no group by wall (G60)" and gets "the
  groups of the call are paired with the plan's by the planner's answer (D73)". §6
  `create-or-replace-groups`: step 6 reads the answer and reports a left-out group and a restored
  replace; step 7 loses "matches the groups of the call to the plan's groups once" and
  "(G58–G60)" becomes "(G58, G59)"; the result paragraph names both in `notLoaded`. §8.3: the G60
  row goes; the row "the planner loads nothing" becomes "no group of the call was built or
  restored"; the row of the restored replace becomes a `notLoaded` row with the new sentence; a
  new row "a group the planner left out — a calculation of the group in progress, an error while
  it was calculated" → `notLoaded` "the planner did not build the group - …; check the group and
  send it again".
- `docs/hi-mcp-server.md:446-470`: the `notLoaded` sentence names a group the planner left out
  and a replace it restored.
- `docs/implementation/tool-executors.md:135-168`: step 10 — the load answers per input group;
  step 11 — the pairing by the answer, `placeAtWalls` without the count, the restored replace
  from the answer instead of `reportRevertedReplaces`.
- `.agents/skills/hi-mcp-tools.md:141`: the **Returns** paragraph.
- `.agents/backlog/planner-load-outcome-per-group.md` is deleted and its row leaves
  `.agents/backlog/README.md:40` and `.agents/README.md`; this analysis is set to Implemented.

## 10. Implementation report

roomle-ui `feat/hi-layout-load-outcome-RML-18139`, off `refactor/hi-tool-logic-RML-18147`, one
commit for steps 1 to 3: `5b502b8c7` feat: answer the hi layout load per input group and pair the
groups by it.

Verification: the tests of `homag-intelligence` and the planner-core `roomle-planner` tests pass,
1116 tests with one skipped; step 1 alone passed as well. The typecheck and oxlint
report nothing in the changed files. `npm run lint:docs:sdk` reports one error in
`node_modules/bun-webgpu`, the same on the base commit. No live check and no model run.

Deviations from §9:

- **The failed root modules of a restored replace are named by the ids the call gave them.**
  `_replaceRootModuleIdsAndRemapDockedRoots` returns its map of sent to regenerated ids, and the
  layout load maps a regenerated id back. A regenerated id names nothing in the restored plan, and
  a root module the replace adds is the usual cause of a restore.
- **A replace whose calculation throws keeps its previous group.** The group item gets its previous
  `posDataJson` back, so the glue-logic does not hold the uncalculated input of a group left out.
- **`mergeArticleIntoGroup` names the planner's reason** when its layout load builds nothing, in
  place of "still being calculated", which would be wrong for a calculation that threw.
- **The check of a built id against the plan after the load** (§4.2, last bullet) is not
  implemented; §9 does not list it either.
- **The tests.** The existing `should skip groups without roots` stays as it is, and the left-out
  case is a test of its own. `__mocks__.ts` gains `builtAs` and `loadAnswer` for the answer of a
  fake load; the sequence, materials and obstacle harnesses answer by `loadAnswer`, which pairs as
  the planner they model does.
- **roomle-hi-example.** The documentation is on this branch, not on a new `docs/layout-load-answer`,
  so that the analysis and the documentation travel together. The backlog item
  `planner-load-outcome-per-group.md` is removed.

Open: the roomle-ui pull request. The pull request of the base branch, #3115, is closed, so no
pull request was opened on top of it.
