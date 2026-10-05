# Feature Analysis: Undo and redo tools for the HI MCP server (RML-18044)

> **Type**: Feature Analysis
> **Domain**: hi-mcp `tool-executors.ts`, `hi-mcp-server.ts`, `planner-api.ts`, the page bridges (roomle-hi-example); the planner's undo history in roomle-ui `planner-core` and RoomleCore `planner::HistoryManager` (read, not changed)
> **Trigger**: Jira [RML-18044](https://roomle.atlassian.net/browse/RML-18044) — add an `undo` and a `redo` tool; the agent is told to undo a result that is not what was asked. Question of the analysis: the roomle-ui API exposes `undo` and `redo` — can the feature be built in roomle-hi-example alone?
> **Date**: 2026-10-05
> **Author**: AI Assistant
> **Status**: Implemented 2026-10-05 — see the [close-out](#close-out-2026-10-05)
> **Branch**: `feat/undo-redo-tools-RML-18044` — [PR #64](https://github.com/roomle-dev/roomle-hi-example/pull/64); ligna-store `feat/hi-mcp-undo-redo-RML-18044`, merged into `feat/general-default-image-prompt` — [PR #74](https://github.com/roomle-dev/ligna-store/pull/74)
> **Plan**: [undo-and-redo-tools-implementation-plan.md](undo-and-redo-tools-implementation-plan.md); the step counts below were measured live on 2026-10-05 — see [Live verification](#live-verification-2026-10-05)

---

## What was asked and why

One `undo` call reverts the plan change of the last tool call that changed the plan; one `redo`
call brings it back. The served rules tell the agent to undo a wrong result and send a corrected
call instead of piling corrections onto a wrong plan, and the tools serve a chat user who asks to
undo or redo the last change.

The ticket description lists three ways to make one undo revert one tool call — grouping in
roomle-ui (A), counting planner steps in the server (B), a server-side snapshot (C) — and asks
which to take. The user's hint narrows the question: `RoomlePlanner.undo()` and `redo()` are
public, so the page can already call them; perhaps nothing in roomle-ui has to change.

**Answer in one paragraph.** Yes, the tools can be built in roomle-hi-example alone: the planner's
`undo`, `redo` *and* its history callback `onHistoryChange` reach the page through the embedding
lib without any roomle-ui change. What roomle-hi-example cannot change is what one planner step
contains, and one tool call makes between one and several steps. A roomle-hi-example-only build
therefore has to know the steps each of its own planner calls makes, has to wait for the planner's
late follow-up reloads, and has to notice plan changes it did not make. The design below does
this with the history callback relayed over the page bridge; the parts that encode roomle-ui
behaviour are named as such, and a roomle-ui follow-up (one step per tool call) would remove them.

## How it works today

### The planner's undo (roomle-ui, RoomleCore)

- `RoomlePlanner.undo()` / `redo()` (`roomle-planner.ts:3430-3440`) call the scene manager
  (`planner-scene-manager.ts:2777-2800`): in configurator mode the configurator's own history,
  else `planInteractionManager.undo()` — `reset()` (force-closes any open step) and the kernel's
  `undo()` (`plan-interaction-manager.ts:258-290`). Both resolve with nothing.
- The kernel's `HistoryManager` (`src/planner/history/history-manager.h:38-60`, `.cpp`): a list of
  revertable actions, at most 500. `undo()` and `redo()` do nothing when there is no step
  (`.cpp:46-66`). Actions between `startHistoryGroup` and `endHistoryGroup` form one step
  (`RevertableGroup`); `resumeHistoryGroup` reopens the last step, but only while no redo is
  possible (`isResumePossible`, `.cpp:126-157`); a new step deletes the redo future
  (`addAction` → `deleteFuture`, `.cpp:68-90`). `trackHistoryChange` fires
  `planHistoryStateChanged` on every committed step, every undo and every redo — not on `clear()`
  (`.cpp:23-31`).
- roomle-ui turns that into `onHistoryChange(undoPossible, redoPossible)`
  (`planner-kernel-access.ts:884-894`, `roomle-planner-ui-callback.ts:178`). `RoomlePlanner` has
  no `canUndo`/`canRedo`; the kernel's `isUndoPossible()`/`isRedoPossible()`
  (`typings/planner.ts:453-455`) are private to the planner.
- **What an undo does to an HI group.** `RevertableObjectChanged::revertAction`
  (`revertable-object-changed.cpp:28-34`) restores the object's parameters, including its
  external configuration (`plan-object.cpp:326-352`); the external plug-in reports
  `externalObjectConfigurationChanged` (`external-configurator-manipulation-callbacks.cpp:56-61`);
  roomle-ui passes the restored pos group to `changedGroupFromHistory(group, false)`
  (`planner-kernel-access.ts:1448-1456`, `glue-logic.ts:1717-1743`), which recalculates it with the
  library and updates the glue logic's map without a reload. The kernel restores the object; the
  library's state follows.
- The history is cleared by a plan load (`loadPlanXML` → `reset()` + `clearHistory`) and by
  `externalObjectsCompletelyLoaded` (`roomle-planner.ts:2343-2345`, called by `api.ts:38` when the
  HI library has loaded the plan's groups). Neither fires `onHistoryChange`.

### What one tool call puts on the history

The step machinery is `plan-interaction-manager.ts`: `_hold`/`_release` (`:320-349`) open and close
a step around a held phase, `run()` (`:133-230`) around one kernel call, `commit()` (`:232-256`)
ends the step. An HI load (`_interactionBeforeLoadingExternalObjectGroups`,
`roomle-planner.ts:2677-2733`) with reason `load`, `plan_changed`, `position_changed`, `split`,
`swap_group` or `merge_with_dragging` *resumes* the open step; every other reason — `adjusted`,
`change_attribute`, `swap_module`, `delete_module`, `merge_with_on_action` — starts a new one
(`manageExternalObjectLoadingStart` → `_hold(resume: false)`, which **commits any open or held
step first**) and commits after the load (`manageExternalObjectLoadingEnd(true)`).

The steps per planner call the server makes (`planner-api.ts`), traced in the code. **The live
check corrected two rows**: `delete-root-module` and `merge-groups` make one step, not two — see
[Live verification](#live-verification-2026-10-05):

| Planner call of the server | roomle-ui | Steps |
|---|---|---|
| `loadExternalObjectGroupLayout(…, { reason: 'adjusted' })` — `create-or-replace-groups`, `place-group`, the anchor probe | one hold/release around `addOrUpdateExternalPlanObjects`; `respondWithPositionInPlan` is false for `adjusted` (`roomle-planner.ts:2636-2640`), so no follow-up | 1 |
| `removeExternalObject(probeId)` — the probe | `deletePlanElementByIds` → `removeElement`, an immediate step (`undo-redo-steps.ts`) | 1 |
| `externalObjectGroupOperation('change-group-attribute' \| 'change-module-attribute')` | `modifyAttribute` loads with `change_attribute` (`glue-logic.ts:2324-2356`): one step, plus the late follow-up below, which resumes it | 1 |
| `… ('exchange-root-module')` | `swap_module` (`glue-logic.ts:2726`): the same | 1 |
| `… ('merge-article-into-group')` | `createOrReplacePosDataFromArticleLayout` and a load with `adjusted` (`glue-logic.ts:1097-1160`) | 1 |
| `… ('delete-group')` | `removeExternalObject(groupId)` → `removeElement`; the kernel reports `REMOVED_GROUP`, the glue logic drops the group, no load (`glue-logic.ts:1071-1078`, `:1702-1715`) | 1 |
| `… ('delete-root-module')` | `removeObjectWithId` → one step; the kernel reports `REMOVED_ROOT` → `deleteRootModule` recalculates and loads with `delete_module` → a second step (`glue-logic.ts:1374-1414`) | 2 |
| `… ('merge-groups')` | `mergeObjects` → one step; the kernel reports the merge → `mergeGroups` loads with `merge_with_on_action` → a second step (`glue-logic.ts:1543-1608`) | 2 |

Per tool: `create-or-replace-groups` = 1 (the load) + 2 per anchor the probe calculates
(`probeAnchorFrame`, `tool-executors.ts:636-676`) + 1 per kitchen-wide attribute set after the
load (D36, `applyKitchenWideAttributes`, `:1420-1462`); `place-group` = 1, or 0 when the group
already stands there; the command tools as in the table. A kitchen with a material and a probed
corner article is four planner steps; the planner's own undo button then reverts the material
first, the load second, and its third undo brings the probe group back — the same half-steps the
agent would get (measured live: four steps, the ghost on the third undo).

### The late follow-up reload

A load with reason `load`, `change_attribute` or `swap_module` asks the kernel to answer with the
group's position (`respondWithPositionInPlan`). The answer arrives as `externalObjectPlanChanged`
→ `await wait(0)` (`planner-kernel-access.ts:1497-1503`) → `changedGroupPlanningSituation`
(`glue-logic.ts:1745-1760`) → a recalculation (`_runGroupCalculation`, another `wait(0)`,
`:2151-2155`) → a reload with `plan_changed`, which resumes the step. The command's promise
resolves after its own load and `getCalculatedGroups()` (`hi-plan-context.ts:1098-1123`), so the
tool result and the follow-up race in the page's event loop. `expectContinuation`/`onCoreLoad`
(`plan-interaction-manager.ts:481-495`) were made for this, but nothing in roomle-ui calls them
today.

If a planner `undo` lands before the follow-up: the undo makes redo possible, so the follow-up
cannot resume the step (`isResumePossible` needs no redo) and becomes a new step, which deletes
the redo future; its content is the glue logic's map at that moment — already reset by
`changedGroupFromHistory` or not. Both outcomes are wrong, and which one happens is a matter of
milliseconds.

### Grouping in roomle-ui does not come for free

`executeWithInteraction` (`roomle-planner.ts:3332-3340`) and `transaction()`
(`plan-interaction-manager.ts:401-449`) hold a step across several kernel calls, and `run()` keeps
a held step. An HI load inside such a transaction does **not** join it: `manageExternalObjectLoadingStart`
commits the held step and opens its own (`_hold`, `:320-335`). The existing `removeElements`
transaction (`roomle-planner.ts:1615-1640`) groups kernel removals only. Option A of the ticket is
therefore not two exposed methods but a change of the step machinery — the HI loads have to
resume an enclosing held step — plus the methods and a planner deployment.

### What the page can reach without a roomle-ui change

The embedding lib exposes every public prototype method of `RoomlePlanner` as
`roomDesignerApi.extended.<name>` (`exposed-api.ts:379-382`, `getMethodNames` and
`HIDDEN_METHODS` in `roomle-embedding-lib.ts:63-85`) and forwards every property of its
`callbacks` object as `roomDesignerApi.extended.callbacks.<name>` (`exposed-api.ts:231-258`,
registered beside the planner UI's own listener with `connector.addCallback`). The method list is
fetched at runtime (`GET_METHODS`), so neither the example's embedding-lib 7.1.0 nor the store's
7.0.0 needs a bump. Hence, today:

- `roomDesignerApi.extended.undo()` and `.redo()` work — they resolve with nothing;
- `roomDesignerApi.extended.callbacks.onHistoryChange = (undo, redo) => …` fires on every
  committed step, undo and redo.

### The server and the bridges (roomle-hi-example)

`planner-api.ts` names seven planner methods; the three page allow-lists mirror them
(`index.html:1270-1278`, `hi-mcp-client/browser-bridge.ts:12-20`, ligna-store
`hi-mcp/browser-bridge.ts:8-16`). The bridge protocol (`types.ts`, protocol 2) knows `hello`,
`ready`, `call` and `result` — the page never sends anything on its own. Tools that change the
plan run one after another (`oneAtATime`, `tool-executors.ts:2278-2284`, D4); every plan-changing
call logs its arguments and feedback (`runTool`, `hi-mcp-server.ts:105-130`). The planner MCP server
of roomle-model-exporter has `undo`/`redo` tools that call `planner.undo`/`planner.redo` once
("One call reverts one step", `src/mcp/tools.ts:1061-1073`); there every edit is one step, so one
call is enough.

## The gap

1. One planner undo reverts one step, and a tool call makes one to several.
2. The planner tells the page nothing about an undo: not whether there was a step, not what it
   reverted. The tool has to answer "nothing to undo".
3. A command's follow-up reload can land after the tool result, and an undo before it corrupts the
   history.
4. The history is shared with the user and cleared by plan loads without a signal. A planner undo
   after the user's own edit reverts the user's edit.
5. The anchor probe and the kitchen-wide material multiply the steps of `create-or-replace-groups`,
   for the agent and for the user's undo button alike.

## Proposed design

### D37 — `undo`, `redo` and the history callback join the page bridge

- `undo` and `redo` go on `planner-api.ts` and the three allow-lists, by explicit decision (D2):
  they revert and restore the planner's own history steps, exactly what the user's undo button
  does; nothing is placed and no plan is overwritten beyond that.
- The page relays the planner's `onHistoryChange` as a bridge message
  `{ kind: 'event', name: 'historyChange', undo, redo }`. The page sets
  `extended.callbacks.onHistoryChange` and forwards — no tool logic in the page (ADR 0001). The
  server handles the message in `page-bridge.ts`; the protocol stays 2. On a page without the
  relay, `undo` fails with the page's own "Planner method not exposed: undo", the existing path.

### The server's record of its calls

A small `plan-history.ts`, used by `oneAtATime`: for every plan-changing tool call that succeeded,
`{ tool, steps, groupsBefore, groupsAfter }`, and the list of undone calls for redo. The record is
dropped when a page connects — the history does not survive a page reload (out of scope).

- `groupsBefore`/`groupsAfter` are the raw groups (`getExternalObjectGroups()`, the kernel's
  serialized definitions — what an undo restores byte for byte), read before and after the
  executor. Two cheap planner calls per plan-changing tool call.
- `steps` is the sum over the planner calls the executor made, by the table above as corrected by
  the live check: 1 per load, removal and command. The executors count their own calls; nothing is
  inferred from the planner. **This table is roomle-ui behaviour** — the live verification below
  confirms it, and the compare after an undo (next section) catches a change.
- Every history event is attributed to the tool call in flight, or counted as *outside* when no
  plan-changing call runs — the user edited the plan in the planner.

### The probe leaves no step

After the probe load and the read of the anchor's docking vectors, the server calls `undo()`
instead of `removeExternalObject(probe.id)`: the probe's load step disappears from the history,
and the real load's `addAction` deletes the redo future it left. `create-or-replace-groups` is
then 1 step plus its kitchen-wide attributes, and the user's undo button no longer stops at the
probe. Verified live: the undo of the probe load removes the probe group from the raw groups and from the
plan context, and the next step deletes the redo future it left. Fallback: a probe group still in
the plan is removed as today.

### Waiting for the follow-up

After `change-module-attribute`, `change-group-attribute` and `exchange-root-module` — the
commands whose load answers with the position — the executor returns only after the command has
produced its second history event (the follow-up's re-commit), with a 2 s cap. (Refined after the
live check: the first version waited for one more event *after the result*, but the follow-up
usually lands before it.) The other
tools return at once. An undo therefore never runs before the previous call's reloads have landed
(acceptance criterion), and `groupsAfter` is read after them. **The list of three commands is
roomle-ui behaviour** (`respondWithPositionInPlan`).

### The `undo` tool

No parameters. In the `oneAtATime` queue.

1. No record → `{ undone: null, groups }` with a hint: nothing to undo, no tool call has changed
   the plan since the page connected. Not an error.
2. The plan must be as the last call left it: no outside event since its result, and the raw groups
   equal `groupsAfter`. Otherwise nothing is undone, and the result says that the plan was changed
   in the planner since the last tool call (the number of steps, the groups that differ) and that
   the planner's undo button reverts those changes.
3. `undo()` once per step. Each call must fire one history event; a call without one means the
   planner had no step (the history was cleared) — the server stops, drops its record and says so.
4. It reads the raw groups and compares them with `groupsBefore`. Equal: `{ undone: <tool>, groups }`
   in the plan-context shape (`get-plan-context`'s `groups`, through `inPlacementFrame`). Unequal:
   the same, plus a hint naming the groups that differ — the canary for a changed step count in
   roomle-ui.
5. The record moves to the redo list.

### The `redo` tool

The mirror: the last undone record; the plan must equal its `groupsBefore` with no outside event;
`redo()` once per step; compare with `groupsAfter`; `{ redone: <tool>, groups }`. A new
plan-changing call clears the redo list, as the planner drops its own redo future. Nothing to
redo → `{ redone: null, groups }` with the hint.

### The instructions

- `AUTHORING_RULES`, after "Verify results numerically": *When a result is not what was asked —
  the wrong wall, a unit missing or replaced by mistake, a merge or a delete that went wrong — call
  undo once and send the corrected call; never pile corrections onto a wrong plan. A group that only
  needs a change is edited with the command tools or replaced, not undone. undo and redo also serve
  the user who asks for them.*
- `INSTRUCTIONS` step 3: one clause — `undo` reverts the last tool call that changed the plan,
  `redo` brings it back.
- Tool descriptions: `undo` — reverts the plan change of the last tool call that changed the plan;
  one call per tool call, call it again for the call before; returns what was undone and the groups
  now; says when there is nothing to undo. `redo` — brings back the last undone tool call; gone
  after a new change.

Short, as the guideline asks (§2.4 of the behaviour reference): the rule says when to undo and
when not to, nothing about steps.

### Decisions the ticket left open

| Open decision | Proposal | Why |
|---|---|---|
| How one undo reverts one tool call | B with the relayed callback: the server undoes the steps its own planner calls made, verifies against the groups it read before, and waits for the follow-ups. Option A (roomle-ui) as the follow-up ticket | A is a change of the step machinery plus a deployment; with B the feature ships from roomle-hi-example now, and A later shrinks `steps` to 1 and removes the wait |
| The anchor probe | undone instead of removed | leaves no step for anyone |
| Whose changes `undo` reverts | tool calls only; a plan changed in the planner since is reported, not undone | the server cannot tell what the user meant by "undo" after their own edit; the planner's button serves that, and an unasked revert of manual work loses data |
| History state from the planner | not needed: the relayed `onHistoryChange` answers "nothing to undo" (no event on `undo()`) and settles the follow-ups | no roomle-ui change |
| Command or planner method | planner methods on the allow-list (D2) | the history is the planner's, not the glue logic's; a command would need roomle-ui for no gain |

## Alternatives considered

- **A — roomle-ui groups a tool call into one step** (begin/end methods on `RoomlePlanner`, HI
  loads resuming a held step, `canUndo`/`canRedo`): exact, and it fixes the user's undo button,
  which today reverts an agent call piecewise. Not chosen for this ticket: it needs the step
  machinery changed, tested and deployed to the stage the example and the store use. Proposed as
  the follow-up; the server design above then sets `steps = 1` and drops the wait.
- **B without the callback** — undo blindly by the table: no "nothing to undo", no way to see a
  cleared history or a user edit, no settling of the follow-ups. Rejected.
- **C — a server snapshot restored by a load**: no dependence on the step machinery, but no true
  revert either: a re-created group gets regenerated ids, every restored group is recalculated by
  the library, a replace the library cannot calculate is silently discarded
  (`_discardCalculation`), the restore adds steps of its own so the user's undo button then undoes
  the agent's undo, and user edits on the groups are overwritten. Rejected.
- **A uniform quiet period** after every plan-changing call instead of the one-event wait for the
  three commands: simpler to state, but either slow (a library calculation can take hundreds of
  milliseconds) or unsafe. Rejected; the one-event wait names its roomle-ui dependency openly.

## What the work touches

| Area | Files |
|---|---|
| Server tools | `hi-mcp/hi-mcp-server/hi-mcp-server.ts` (two tools, `PLAN_CHANGING_TOOLS`, the rule and the instruction), `tool-executors.ts` (the bookkeeping in `oneAtATime`, the probe undo, the follow-up wait), new `plan-history.ts`, `planner-api.ts` (`undo`, `redo`), `page-bridge.ts` and `types.ts` (the event message) |
| Pages | `minimal-hi-example/index.html` (allow-list, callback relay), `hi-mcp/hi-mcp-client/browser-bridge.ts`, then the ligna-store's `hi-mcp/browser-bridge.ts` |
| Unit tests | `tests/tool-executors.test.ts`: steps per tool, the probe undo, nothing to undo, redo after undo, redo gone after a change, a user change blocks the undo, the queue; `tests/hi-mcp-server.test.ts`: the tool list and the rule text; `tests/planner-api.test.ts`, `hi-mcp-client/tests`: allow-lists and the relay |
| MCP tests | `docs/test-prompts.json`: a user asks to undo the last change; a user asks to redo it; a two-prompt test where the second prompt corrects the first ("no, the base unit — undo that and delete the base unit") |
| Documentation | `hi-mcp/docs/hi-mcp-behaviour.md` (D37, the tools in §6, the planner methods in §4, the instruction in §5), `minimal-hi-example/docs/hi-mcp-server.md` (tool reference), `.agents/skills/hi-mcp-tools.md`, `.agents/skills/hi-mcp-server.md` (the bridge event), this document |
| Follow-up ticket (roomle-ui) | one step per tool call: `beginExternalObjectTransaction`/`endExternalObjectTransaction` on `RoomlePlanner`, HI loads resuming a held step in `plan-interaction-manager.ts`, `canUndo`/`canRedo` or a boolean from `undo()` |

## Live verification (2026-10-05)

A headless page (Playwright, the example on ports 3001/3110) on the deployed planner
`roomle.com/t/bo-test` (Roomle Core 3.0.1-alpha.1) — the local dev servers were restarted during
the session. The script set `extended.callbacks.onHistoryChange`, cleared the history with
`extended.externalObjectsCompletelyLoaded()` before each tool call, ran the tool through the MCP
server, undid with `extended.undo()` until the planner reported no step left, compared the raw
groups (`getExternalObjectGroups`, numbers rounded to 0.1 mm), the plan context groups and the
order data with the state before the call, and redid every step.

| Tool call | Steps | History events during the call | After the undos | After the redos |
|---|---|---|---|---|
| `create-or-replace-groups`, corner kitchen, new anchor, two kitchen-wide attributes | 5: probe load, probe removal, load, 2 attributes | 7 | equal to before after 3 undos; the 4th brings the probe group back (ghost), the 5th removes it | equal to after |
| `create-or-replace-groups`, known anchor, one kitchen-wide attribute | 2 | 3 | equal | equal |
| `create-or-replace-groups`, new row, known anchor / replace | 1 | 1 | equal | equal |
| `change-group-attribute` | 1 | 2 (the follow-up 61 ms after the result once, 5 ms before it in 7 runs) | equal | equal |
| `change-module-attribute`, `exchange-root-module` | 1 | 2 | equal | equal |
| `merge-article-into-group`, `place-group`, `merge-groups` | 1 | 2 | equal | equal |
| `delete-root-module` (split into two groups) | 1 | 5 | equal | equal |
| `delete-group` | 1 | 1 | equal | equal |

The plan context groups and the order data equalled the state before after every undo, and the
state after after every redo.

| Claim | Result |
|---|---|
| 1. the steps per planner call | one per load, command and removal; `delete-root-module` and `merge-groups` one, not two |
| 2. the undo of the probe load removes the probe | yes, from the raw groups and the plan context; the next step deletes the redo future (its event reports redo false) |
| 3. after the undos, the raw groups equal those before the call | yes, for every tool |
| 4. the follow-up re-commit fires one event after the result | it fires the command's second event, in 15 of 15 cases, but usually before the result — the wait counts events per command instead |
| 5. an empty history fires no event; a plan load clears it silently | an `undo()` on the empty history after the plan load fired no event and changed nothing |
| 6. configurator mode | not checked (out of scope) |

Other observations: an `undo()` call took up to 3 s to return (the restored groups are
recalculated); every undo and redo fired exactly one event and no late reload; the history event
counts per call vary with roomle-ui internals and are no measure of steps.

**A defect of today's behaviour**: after an agent call with a probe, the planner's undo button
reaches the probe's two steps under the agent's steps and shows the probed article as a group at the
plan origin for one step. The probe undo of the plan fixes it.

## Close-out (2026-10-05)

Implemented as designed, with the refinements of the
[plan](undo-and-redo-tools-implementation-plan.md#close-out-2026-10-05). The living reference is
[hi-mcp-behaviour.md](../../hi-mcp/docs/hi-mcp-behaviour.md) — D37, D38, `undo` and `redo` in §6,
§8.8.

- The design stands: `undo` and `redo` on the allow-lists, the history callback relayed as a bridge
  event, the server's record of its tool calls with the planner steps they made, the probe undone,
  an undo refused after a change in the planner.
- What the analysis did not foresee: a client that does not pass the server's instructions on —
  the HI chat — never shows the model the undo rule, so the description of `undo` itself says when
  to use it; and the planner clears its undo history when the HI library has loaded a plan's groups,
  so a change made before that cannot be undone (the server says so; the test run script now waits).
- Verified with the tools in a live planner (bo-test) and in "test the mcp" with gpt-5-mini: the
  three undo tests pass, and no other test called `undo` or `redo`
  (`.temp/result/mcp-test-2026-10-05_14-20-34/report.md`).
