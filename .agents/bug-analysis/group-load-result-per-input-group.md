# The group load result names per input group what the planner built

> **Date**: 2026-10-10
> **Status**: Open — analysis
> **Ticket**: [RML-18139](https://roomle.atlassian.net/browse/RML-18139)
> **Branch**: `fix/hi-mcp-api-and-tools` (roomle-hi-example), `fix/hi-mcp-api-and-tools` (roomle-ui)
> **Related**: [RML-18140](https://roomle.atlassian.net/browse/RML-18140) (article template geometry in the plan context), [RML-18033](https://roomle.atlassian.net/browse/RML-18033) (guards and auto correction)

## Affected repositories

- **roomle-ui** — the layout load answers per input group: input group id/index, the resulting plan group id(s), and built / restored / left out with the reason. The answer is produced where the layout is calculated, in the glue-logic.
- **roomle-hi-example** — the server reports a left-out group in `notLoaded` with the planner's reason, pairs result groups with input groups by that answer instead of by order, and reads a restored replace from it.
- **ligna-store** — no change; it consumes the same tool results.

## Symptom

`create-or-replace-groups` reports in `notLoaded` only the groups the server itself excluded before the load. A group the planner does not build is not reported at all, and the groups that *were* built are then attributed to the wrong input groups.

The ticket's `it.fails` test shows it with a mock planner (`hi-mcp/hi-mcp-server/tests/tool-executors.test.ts:968`):

```ts
it.fails('RML-18139: reports a group omitted by the planner in notLoaded', async () => {
  // plan context: first call has the groups, second call has none,
  // third call has one group 'created-group'
  const result = await toolExecutors['create-or-replace-groups'](api, {
    posGroups: [{ roots: [pick()] }, { roots: [{ ...pick(), id: 'other-root' }] }],
  });
  expect(result.notLoaded).toEqual([{ index: 1, errors: expect.any(Array) }]);
});
```

Two input groups are sent, the planner builds one. The expected answer names the left-out input group by its index; today the result carries no `notLoaded` entry at all.

## Investigation

### What the server gets back from the load

`loadExternalObjectGroupLayout` returns one entry per loaded plan object, and that entry is the runtime id and nothing else (`packages/web-sdk/packages/homag-intelligence/src/external-object-api.ts:149-151`):

```ts
export interface LoadExternalObjectGroupResult {
  id: number; // runtime id of the loaded ConfiguratorPlanObjectViewModel
}
```

The planner builds the array in `packages/web-sdk/packages/planner-core/src/roomle-planner.ts:2482`:

```ts
return (await this._loadExternalObjectGroup(groupData, loadOptions)).map(
  (group) => ({ id: group.getId() }),
);
```

The input groups are gone by then. `groupData` is the *calculated* result of `createOrReplacePosDataFromArticleLayout` (`glue-logic.ts:899`), which for the `posGroups` layout type delegates to `_createOrReplacePosGroupsFromLayout` (`glue-logic.ts:1013`). That loop is the only place that still knows both sides: it walks `articleLayoutJson.posGroups` one by one (`glue-logic.ts:1023`), decides per input group whether it replaces an existing group (`glue-logic.ts:1032-1063`) or is added as a new one (`glue-logic.ts:1065-1075`), and returns `processedPosGroups` — the calculated groups, in input order, with the input groups that produced nothing silently dropped:

```ts
for (const inputGroup of inputGroups) {
  if (!inputGroup?.roots || inputGroup.roots.length === 0) {
    continue;                                    // left out, no record
  }
  ...
  if (existingGroupItem) {
    ...
    const replacedGroup = await this._calculateAndUpdateGroupMap(existingGroupItem, true, true);
    changedPosGroups.push(replacedGroup);
    processedPosGroups.push(replacedGroup);
    continue;
  }
  ...
  addedPosGroups.push(emulatorGroupItem.posDataJson);
  processedPosGroups.push(emulatorGroupItem.posDataJson);
}
if (processedPosGroups.length === 0) {
  return undefined;
}
await this._groupsModified(addedPosGroups, changedPosGroups, []);
return processedPosGroups;
```

The per-input-group outcome exists here and is thrown away. Everything downstream can only count.

### What the server does with the count

The server pairs the call's groups with the result groups **by order** (`matchResultGroups`, `hi-mcp/hi-mcp-server/tool-executors.ts:2327`): a replaced group by its id, a new group by its position among the groups the load added (`newGroups[nextNew++]`), or by the id matched before a reload. Three consumers depend on that pairing:

- `applyGroupWideAttributes` (`tool-executors.ts:2879`) sets group-wide attributes on the paired result group.
- `rememberAgentGroupIds` (`tool-executors.ts:2384`) remembers the agent's id for a regenerated group id.
- the `failedRoots` loop in the executor (`tool-executors.ts:4857-4890`) attributes per-root library errors to the paired group.

A left-out group shifts every pairing behind it. The attributes land on the wrong group, the remembered ids are wrong, and the per-root errors are attributed to the wrong input. `placeAtWalls` (`tool-executors.ts:4810`) moves no group when the counts differ, because it has nothing to pair.

### The only check that the load produced anything

The executor verifies that the load returned *something*, not that it returned *what was asked for* (`tool-executors.ts:4786-4796`):

```ts
if (!loaded || loaded.length === 0) {
  throw new Error('No groups were created or replaced. …');
}
```

One group out of five is enough to pass. The four that were left out are invisible.

### The restored replace is the same gap

A replace the library cannot calculate does not fail either. `_calculateAndUpdateGroupMap` (`glue-logic.ts:~3004`) runs the calculation, and when `newlyFailedRootModules(recalculatedGroup, restorableGroup)` is non-empty it calls `_discardCalculation` (`glue-logic.ts:3109-3119`), which `structuredClone`s the previous group, stores it as the group's `posDataJson`, re-registers it in `_groupMap` and **returns it as the calculated group**. The load therefore reports the *old* group as loaded, with a runtime id, and the server cannot tell it apart from a successful replace.

The server detects this only by comparing articles after the fact (`reportRevertedReplaces`, `tool-executors.ts:2986`): it compares `articlePicksOf(group.roots)` (sent) with `articlePicksOf(result.roots)` (got) and `articlePicksOf(previous.roots)`, and pushes a correction naming the group. That is a heuristic on the payload, not the planner's answer, and it only works for a replace — a left-out *new* group has no previous group to compare against.

## Root cause

The load result carries the runtime ids of the loaded plan objects and nothing else (`LoadExternalObjectGroupResult`, `external-object-api.ts:149-151`). The per-input-group outcome — which input group produced which plan group, and which produced none and why — is known exactly once, in `_createOrReplacePosGroupsFromLayout` (`glue-logic.ts:1013-1081`), and is discarded there. The server is left with a list of ids and no way to map them back to the input, so it pairs by order (`matchResultGroups`, `tool-executors.ts:2327`) and can only check that the list is not empty (`tool-executors.ts:4786`).

The information is not missing from the system; it is dropped at the seam between the glue-logic and the planner's return value.

## Why the current code is wrong

- **Pairing by order is a guess.** It is correct only while every input group produces exactly one plan group, in order. A left-out group, a group that produces several plan objects, or a restored replace all break it, and the failure is silent: attributes, remembered ids and error attribution land on the wrong group.
- **A left-out group is not reported.** The user asked for five groups and got four; the result says nothing about the fifth. The agent cannot correct what it is not told.
- **A restored replace is reported as a success.** The planner restored the previous group because it could not calculate the new one; the result presents it as loaded. The server's article comparison is a workaround for a missing answer, and it cannot cover a left-out new group.
- **The check is on the wrong thing.** `loaded.length === 0` asks whether the load produced anything, not whether it produced what was asked for.

## Proposed fix

### roomle-ui — the load result names per input group what happened

Extend `LoadExternalObjectGroupResult` (`external-object-api.ts:149-151`) so each entry answers for one input group. One input group can produce **zero** plan objects (left out) or **several** (split into more than one plan object), so the ids are a list, not a single id:

```ts
export interface LoadExternalObjectGroupResult {
  ids: number[];           // runtime ids of the loaded ConfiguratorPlanObjectViewModels; empty when left out
  inputIndex: number;      // index of the input group in the layout
  inputGroupId?: string;   // the input group's id, when it had one
  outcome: 'built' | 'restored' | 'leftOut';
  reason?: string;         // the planner's reason for 'restored' and 'leftOut'
}
```

`ids` is empty exactly when `outcome` is `'leftOut'`, and carries more than one entry when the input
group became several plan objects — the case the backlog item
[`planner-load-outcome-per-group.md`](../backlog/planner-load-outcome-per-group.md) names. A
singular `id` could not represent either without a fake value.

`_createOrReplacePosGroupsFromLayout` (`glue-logic.ts:1013`) already walks the input groups in order and knows the outcome of each; it records it alongside `processedPosGroups` instead of dropping it. `_discardCalculation` (`glue-logic.ts:3109-3119`) is the one place that knows a replace was restored, so it marks the outcome there. `roomle-planner.ts:2482` carries the outcome through the `.map()` instead of reducing each group to `{ id }`.

The reason strings come from the planner and the library — the same diagnostics `_logFailedRootModules` (`glue-logic.ts:3121-3131`) already produces — so the server never has to guess.

### roomle-hi-example — the server reads the answer

- `matchResultGroups` (`tool-executors.ts:2327`) pairs by `inputIndex` instead of by order. The order-based fallback stays only for a planner that does not answer yet, so the change is not a hard break.
- A `leftOut` entry becomes a `notLoaded` entry (`NotLoadedGroup`, `tool-executors.ts:3011`) carrying the input index and the planner's reason, so the `it.fails` test at `tool-executors.test.ts:968` becomes a regular test.
- A `restored` entry replaces the article comparison in `reportRevertedReplaces` (`tool-executors.ts:2986`): the server reads the outcome and the reason instead of inferring them from the payload.
- The `loaded.length === 0` check (`tool-executors.ts:4786`) stays as the last resort for a call where nothing at all could be built.

## Ordering — where this sits

This is an **independent, reusable prerequisite** of the refactoring in
[`move-tool-logic-to-glue-logic.md`](../refactoring-analysis/move-tool-logic-to-glue-logic.md), not a
consequence of it, and it is independent of RML-18140.

The per-input-group outcome is produced in the glue-logic — `_createOrReplacePosGroupsFromLayout` is
glue-logic code — so it can be built there directly, without a server implementation and without a
later move. The refactoring then reuses it: `create-or-replace-groups` becomes one
`externalObjectGroupOperation` command, and the load result is part of that command's answer, so the
outcome record is exactly the kind of answer the refactoring's command result is meant to carry.

The two tickets are independent and do not block each other:

- **RML-18140** is about the *catalog* geometry of an article that is not in the plan: the server needs an article's docking vectors and corner point before it can author a group. It is answered by the per-article, lazy, cached template calculation in the glue-logic.
- **RML-18139** is about the *load result* naming what the planner built per input group. It is answered by the outcome record in `_createOrReplacePosGroupsFromLayout`.

Both are produced by the glue-logic and both travel in the command result once the refactoring lands.
Neither needs the other, and neither needs the refactoring to land first.

## Tests

- `it.fails('RML-18139: reports a group omitted by the planner in notLoaded')` (`tool-executors.test.ts:968`) becomes a regular test.
- A call whose first group is left out sets group-wide attributes on the second group's result — the pairing test.
- A restored replace is reported from the planner's outcome, not from the article comparison.
- roomle-ui names the uncalculable group in the load result.
