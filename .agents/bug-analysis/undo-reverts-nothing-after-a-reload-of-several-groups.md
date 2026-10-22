# Bug analysis — undo reverts nothing after a tool call that reloads several groups at once

> **Type**: Bug analysis
> **Status**: Open
> **Date**: 2026-10-22
> **Base**: roomle-hi-example `master` (`bbf995b`); roomle-ui `feat/hi-mcp-improvements` (`725e0dda3`,
> the commit of the reproducing run); RoomleCore `master` (`f4e9eab5d`, read only)
> **Backlog**: [item 102](../backlog/mcp-issues.md#102-undo-reverts-nothing-after-a-tool-call-that-reloads-several-groups-at-once)

## Affected repositories

- **roomle-ui** (`feat/hi-mcp-improvements`) — the fix: the planner's tool-call step (`runToolCall`,
  `plan-interaction-manager.ts`) waits for the plan changes the kernel reports when the step is
  committed, keeps their reloads in the step and commits it again before the tool command answers;
  `externalObjectGroupOperation` (`roomle-planner.ts`) and `PlannerKernelAccess`
  (`planner-kernel-access.ts`) supply the collection of those reports. Unit tests in planner-core and
  the hi-mcp tool executors. The tool set (`plan-history.ts`, `tool-executors.ts`) stays as it is.
- **roomle-hi-example** — D77 and D79 of `docs/hi-mcp-behaviour.md` when the fix lands; backlog
  item 102.
- **RoomleCore** — unchanged: the planning-situation update at the end of an interaction is intended,
  and its interaction contract asks the embedder to answer it inside that interaction.
- **ligna-store, embedding-lib** — unchanged: the tools run in the planner, both get the fix with the
  planner at their server URL; no new embedding-lib version.

## Symptom and reproduction

**The run.** `mcp-test-2026-10-22_09-29-56`, gpt-6-astra 10 (`image-only-no-text`), local roomle-ui
`725e0dda3`, plan `ps_sje41pva5egn6qp5xti55q6c7fcfin5`. The agent creates two groups in one
`create-or-replace-groups` (placed by wall 0 and wall 8, nine and three roots); the library cannot
calculate roots of both, so `notLoaded` names both groups. The agent calls `undo`. The undo makes one
plan-context read and no planner undo call (`console.log`: `call 6: getExternalObjectPlanContext`
between its args and its feedback); the groups `9ed4ec9a` and `2702debf` stay, and the agent changes
their attributes instead of building them again. The run's log does not show the undo's `hint`: the
feedback line carries `corrections` and `notLoaded` only (`hi-mcp-server.ts:175-181`).

**The replay, without a model.** roomle-ui `npm run dev` on :5173 at `725e0dda3`;
`EXAMPLE_PORT=3001 node minimal-hi-example/start.mjs --dev --no-open`; headless Chromium on
`http://localhost:3001/?backendId=HI_PRE_Roomle_Milestone_2&library_id=Furniture_Smith&server_url=http%3A%2F%2Flocalhost%3A5173%2F&id=ps_sje41pva5egn6qp5xti55q6c7fcfin5`.
The run's `args` go through `window.instance.extended.callExternalObjectAgentTool`, followed by
`undo`. In the planner frame, `PlanHistory`, the kernel callback `_externalObjectPlanChanged`,
`loadExternalObjectGroups`, `runToolCall` and `changedGroupPlanningSituation` are wrapped with a log
through their prototypes (modules imported by their Vite URLs). The script is kept locally in the
git-ignored `.temp/replay-102.mjs` (`node .temp/replay-102.mjs <variant>`).

| Call replayed, then `undo` | Groups one reload of the call carries | `notLoaded` | History events after the answer | `undo` |
|---|---|---|---|---|
| the run's create | 2 | both groups | 2 | `undone: null`, hint "The plan was changed in the planner after the last tool call …" |
| the same two groups without the handle and backsplash values that fail | 2 | none | 2 | `undone: null`, the same hint |
| the run's group 0 alone | 1 | group 0 | 0 | reverts the create |
| the run's group 1 alone | 1 | group 1 | 0 | reverts the create |
| group 0 alone, without the failing values | 1 | none | 0 | reverts the create |
| a second create, group 1 into the plan with group 0 | 1 | none | 0 | reverts the create |
| `change-group-attribute` in the two-group plan | 1 | — | 0 | reverts the change |
| `delete-article-in-place` of the dishwasher, which splits group 0 into four groups | 4 | — | 4 | `undone: null`, the same hint |

The library's partial calculation is not the trigger. The defect follows the number of groups one
reload of the call carries: two or more. A create with one group in `notLoaded` undoes correctly
because such a create loads one group.

After the valid two-group create, the plan context's groups after the late reloads equal those of the
create's answer to the tenth of a millimetre, and the planner's own undo button reverts the whole
create with one click.

## Investigation trace

The run's create replayed, in ms from the start of the tool call:

| ms | What happens | Where |
|---|---|---|
| 0 | the tool set begins the call (`planHistory.begin()`) | `tool-executors.ts:230` |
| 1397–1883 | `placeAtWalls` moves both new groups to their walls in **one** reload (`ADJUSTED`); the kernel reports their plan changes inside that load, and the reloads answering them are awaited (`insideLoad: true`) | `hi-tool-commands.ts:283-285`; `planner-kernel-access.ts:1519-1546` |
| 2047–3435 | the group materials: one `change-attributes` reload per group | `hi-tool-attributes.ts:427-438`; `glue-logic.ts:2265-2277` |
| 3462 | the tool command is done; `runToolCall` commits the call's step: `_release` → `commit()` → `endInteraction()`; the kernel fires `planHistoryStateChanged` — history event 1, in flight, the call's own | `plan-interaction-manager.ts:214-241, 362-376`; `planner-kernel-access.ts:908-918` |
| 3463 | in the same `endInteraction()` the kernel reports `externalObjectPlanChanged` for **both** groups — outside any load (`insideLoad: false`), so nothing waits for their reloads | RoomleCore `elements-in-interaction.cpp:414-417`; `planner-kernel-access.ts:1005-1013, 1535-1546` |
| 3465 | `runToolCall` returns, the tool command answers | `roomle-planner.ts:3300-3312` |
| 3472 | the tool set records the create (`steps: 1`, `groupsAfter` read now) and ends the call (`planHistory.end()`) | `tool-executors.ts:233-253` |
| 3547 | `wait(0)` has passed: `changedGroupPlanningSituation` for both groups; each calculates its group and reloads it with `PLAN_CHANGED` | `planner-kernel-access.ts:1538-1543`; `glue-logic.ts:1693-1708` |
| 3711 | the first reload resumes the committed step and commits it again: history event 2 with `inFlight` false → `historyChanged` → `forget()`, `changedInPlanner` | `roomle-planner.ts:2729-2736, 2756-2777`; `plan-history.ts:32-41` |
| 3915 | the second reload: history event 3, the records forgotten again | |
| undo | `lastDone()` is empty → the `CHANGED_IN_PLANNER` hint, one plan-context read, no planner undo | `tool-executors.ts:296-311` |

**Why the kernel reports at the end of the step.** RoomleCore `LoadExternalPlanObject::updateGroups`
(`src/planner/interaction/load-external-plan-object.cpp:155-171`) requests a surrounding update at
the end of the interaction for every group of a reload that carries two or more groups with a changed
structure, unless the load locks callbacks. `endInteraction` turns each request into
`setSurroundingChanged`, which the kernel reports as `externalObjectPlanChanged`
(`src/planner/interaction/elements-in-interaction.cpp:390-395, 414-417`). This is intended: the
planning situation of groups changed together is recalculated once all of them are in place
(`8f1007ebf1`, "added missing external object planing situation callbacks"). RoomleCore's interaction
contract (`.agents/context/homag-intelligence/hi-object/externalObjects.md`, "Interaction contract for
callback-driven reloads") asks the embedder to answer such a report inside the interaction it came
from; the `PLAN_CHANGED` reload does so — it resumes the step. A one-group reload requests nothing,
and the `PLAN_CHANGED` reloads lock callbacks (`roomle-planner.ts:2680`), so they request nothing
either.

Since D79 the call holds one interaction step and commits it once, at its end. The reports the kernel
defers to the end of the interaction therefore come from that commit, after the call's last load.

## Root cause

`UndoRedoHandler.runToolCall` (roomle-ui `planner-core/src/services/plan-interaction-manager.ts:362-376`)
commits the tool call's step in its `finally` and returns at once. When the step reloaded two or more
groups at once, that commit makes the kernel report `externalObjectPlanChanged` for them
(`planner-kernel-access.ts:1005-1013`). `PlannerKernelAccess._externalObjectPlanChanged` (`:1535-1546`)
waits for a report's reload only inside a load: `_externalObjectPlanChanges` is set by
`loadExternalObjectGroups` (`:1519-1533`) and by nothing else. The reloads
(`changedGroupPlanningSituation`, `glue-logic.ts:1693-1708`) therefore run after
`externalObjectGroupOperation` (`roomle-planner.ts:3300-3312`) has answered: each resumes the committed
step and commits it again (`roomle-planner.ts:2729-2736, 2756-2777`), and each commit fires
`onHistoryChange`.

## Why the current code produces wrong results

The tool set relies on D77: the planner answers a tool command settled, with every history event of
the call before the answer. The late events break it. `PlanHistory.historyChanged`
(`plan-history.ts:32-41`) takes an event while no tool call runs for a change the user made in the
planner (D38) and forgets every record, so `revertToolCall` finds no record and answers that the plan
was changed in the planner (`tool-executors.ts:302-311`). The agent reads that the user changed the
plan and builds on the groups it wanted to discard.

The planner itself stays consistent: the reloads join the call's step, its history holds one step,
and its undo button reverts the create with one click. Only the history events arrive late — three
events for one step, two of them after the answer. The record is also read too early: `groupsAfter`
(`tool-executors.ts:238`) comes from a plan the planner is still recalculating. In the replay the
reloads leave the plan-context groups unchanged, but nothing makes that hold for every planning
situation, and an undo compares the plan with that key.

## Proposed clean fix

The planner answers a tool command only after the plan changes its commit reports are reloaded —
roomle-ui planner-core, `feat/hi-mcp-improvements`:

1. **`PlannerKernelAccess`** (`planner-kernel-access.ts:1519-1533`): the collection of reported plan
   changes that `loadExternalObjectGroups` makes around a load becomes available for any kernel call —
   the same body under a name that says so, e.g. `awaitReportedPlanChanges(kernelCall)`;
   `loadExternalObjectGroups` keeps its signature and calls it.
2. **`runToolCall`** (`plan-interaction-manager.ts:362-376`) takes the commit wrapper from its caller.
   A call that started a step commits it through the wrapper while `_toolCall` is still set: the
   reloads answering the reports resume the step (`resumeExternalObjectLoading`) and leave it open,
   as every load inside a tool call does (`manageExternalObjectLoadingEnd`, `:403-406`). When one of
   them resumed the step, `runToolCall` commits it once more; then it clears `_toolCall` and returns.
3. **`externalObjectGroupOperation`** (`roomle-planner.ts:3300-3312`) passes the kernel access's
   collection as that wrapper.

The second commit reports nothing: the `PLAN_CHANGED` reloads lock callbacks, so they request no
surrounding update (RoomleCore `load-external-plan-object.cpp:158-167`) — the settling cannot loop.
The call stays one planner step; its history events — two for a step whose commit reported plan
changes — all arrive before the answer; the tool set's record is read from the settled plan; `undo`
reverts the call with one planner undo. D77 holds again, and the tool set does not change. The cost:
a call whose commit reports plan changes answers after their reloads — about 450 ms for two groups in
the replay, work the planner does today after the answer.

## Rejected approaches

- **The tool set waits for late history events after every call** — D77 rejected it: a wait on every
  plan-changing call, and the tool set cannot know how many events to expect.
- **The tool set ignores history events shortly after a call** — it cannot tell them from a change the
  user makes right after the call, and `undo` would then revert across the user's change (D38).
- **Lock callbacks for the tool commands' multi-group reloads, or reload the groups of `placeAtWalls`
  one by one** — skips the planning-situation update the kernel requests on purpose; a splitting
  delete reloads all its groups at once by nature, so the defect stays for every other multi-group
  reload.
- **Report the planning situation at the load instead of at the end of the interaction (RoomleCore)** —
  a change of the kernel's process; the kernel's contract places the answer in the embedder.

## Tests

roomle-ui:

- `planner-core/__tests__/plan-interaction-manager.ts`, `describe('runToolCall')`:
  `it('reloads the plan changes its commit reports inside the step before it returns')` — the commit
  wrapper starts a `plan_changed` reload (`resumeExternalObjectLoading`,
  `manageExternalObjectLoadingEnd(true)`) on the commit; `runToolCall` resolves after the reload, with
  one `startInteraction`, two `endInteraction` and nothing committed after it resolves. The four
  existing tests keep their counts: a commit that reports nothing commits once.
- `planner-core/__tests__/planner-kernel-access.ts`: the collection waits for the plan changes reported
  during the kernel call and for none reported after it.
- `planner-core/__tests__/roomle-planner.ts`: `it('runs an external object group operation as one tool
  call step of the interaction manager')` (`:225`) — the step is committed through the kernel access's
  collection.
- `homag-intelligence/__tests__/hi-mcp/tool-executors-test.ts`:
  `it('reverts a create whose planner fires several history events before it answers')` — the tool
  set's side of the contract.

Live, with the replay of this analysis and no model: the run's create, the valid two-group create and
the splitting delete, each followed by `undo` — the undo reverts the call, and no history event
arrives after the answer.
