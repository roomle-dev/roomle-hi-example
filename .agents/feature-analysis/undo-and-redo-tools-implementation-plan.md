# RML-18044: implementation plan — the undo and redo tools and their unit tests

> **Type**: Implementation plan (step 4 of the [change workflow](../../AGENTS.md#suggested-change-workflow))
> **Analysis**: [undo-and-redo-tools.md](undo-and-redo-tools.md) — the design, the alternatives, and
> the live verification of 2026-10-05 that this plan rests on
> **Date**: 2026-10-05
> **Author**: AI Assistant
> **Status**: Implemented 2026-10-05 — see the [close-out](#close-out-2026-10-05)
> **Branch**: `feat/undo-redo-tools-RML-18044` (roomle-hi-example), `feat/hi-mcp-undo-redo-RML-18044` (ligna-store)

---

## What the live check changed

The analysis traced the planner steps in the code; the live check measured them on the deployed
planner (`roomle.com/t/bo-test`, Roomle Core 3.0.1-alpha.1), each call with a cleared history and
undone until the planner reported no step left. Details in the analysis, section
[Live verification](undo-and-redo-tools.md#live-verification-2026-10-05).

| Tool call | Planner steps measured |
|---|---|
| `create-or-replace-groups` | 1 for the load + 1 per kitchen-wide attribute (D36) + 2 per probed anchor |
| every other tool that changes the plan | 1 — `delete-root-module` and `merge-groups` included (traced as 2) |
| an undo or a redo | 1 history event, no new step, no late reload |

Three consequences for the plan:

1. **The step count is simple.** One step per successful planner load, group command and removal;
   no command needs a special count.
2. **The probe matters.** Its two steps lie *under* the agent's steps: after the real steps are
   undone the plan is back, and the next undo — the user's undo button today — brings the probe's
   corner unit back at the plan origin (a ghost). Undoing the probe instead of removing it fixes
   that for everyone.
3. **The follow-up wait counts events per command.** The follow-up reload of
   `change-module-attribute`, `change-group-attribute` and `exchange-root-module` produced the
   command's second history event in every case (15 of 15); it landed before the tool result in 14
   and 61 ms after it once. The analysis proposed to wait for "one more event after the result" —
   that would wait for the cap whenever the follow-up came first. The plan waits until the command
   has produced its two events instead.

## Assumptions

- **The design of the analysis stands**, with the refinement of point 3: undo and redo on the
  allow-lists (D37), the history callback relayed over the bridge, the server's record of its own
  tool calls, the probe undone, an undo refused after a change in the planner.
- **The agent's undo reverts tool calls only** (D38). An event that arrives while no tool call
  runs is a change in the planner: the server forgets its records, and `undo` says so until the
  next tool call. The user's undo button serves the user's own changes.
- **No roomle-ui change.** The optional roomle-ui follow-ups are listed at the end.
- **One pull request in roomle-hi-example** with four commits — bridge, tools, rules, MCP tests —
  and one in the ligna-store for its copy of the page bridge. Every commit passes `npm test`,
  `npm run typecheck`, `npm run lint` and `npm run format:check` in `hi-mcp`.

## Commit 1 — `feat: relay the planner's history changes over the page bridge`

### Code

| File | Change |
|---|---|
| `hi-mcp-server/types.ts`, `hi-mcp-client/types.ts` | `McpBridgeEvent { kind: 'event', name: 'historyChange', undo: boolean, redo: boolean }` in `McpBridgeMessage`. `BRIDGE_PROTOCOL` stays 2: the message is additive, and a page without it also lacks `undo` on its allow-list |
| `hi-mcp-server/planner-api.ts` | `undo()` and `redo()`, no arguments, default timeout (30 s; an undo took up to 3 s live) |
| `hi-mcp-server/page-bridge.ts` | `onHistoryChange(listener)` and `onPageAccepted(listener)`. In the message handler (`:33-62`): an `event` named `historyChange` from the active page calls the listeners with `undo` and `redo` as booleans; an event from any other socket, or of another name, is ignored. Accepting a `hello` (`:45`) calls the page listeners |
| `hi-mcp-server/plan-history.ts` (new) | `PlanHistory` (below) and `connectPlanHistory(bridge, history)`, which wires the two bridge listeners to `historyChanged()` and `reset()` |
| `hi-mcp-server/server.ts` | `connectPlanHistory(bridge, planHistory)` after `new PageBridge()` (`:12`) |
| `hi-mcp-client/browser-bridge.ts` | `PLANNER_METHODS` (`:12`) gains `undo`, `redo`. `startMcpBrowserBridge` keeps the host's `extended.callbacks.onHistoryChange`, installs its own that calls the host's first and then sends the event on the active socket once it is accepted; `dispose` (`:218`) puts the host's handler back |
| `minimal-hi-example/index.html` | the same in the inline bridge: `MCP_PLANNER_METHODS` (`:1270`) gains `undo`, `redo`; `startMcpBrowserBridge(api)` (`:1296`) relays the callback over the accepted socket |

`PlanHistory`, one per server process like the queue (`planChanges`) and the anchor frames:

| Member | Behaviour |
|---|---|
| `events` | the number of history events received |
| `historyChanged()` | counts the event and wakes the waiters. Outside a tool call (`inFlight` false) it forgets the records and the undone records and sets `changedInPlanner` |
| `waitForEvents(count, timeoutMs)` | resolves `true` once `events >= count`, `false` after the timeout |
| `begin()` / `end()` | marks a tool call in flight; its events belong to it |
| `record({ tool, steps, groupsBefore, groupsAfter })` | appends a record, forgets the undone records (a new change ends redo, as in the planner), clears `changedInPlanner` |
| `lastDone()`, `lastUndone()`, `markUndone()`, `markRedone()`, `forget()` | the two lists |
| `reset()` | everything cleared — a page was accepted, the planner's history is a new one |

### Unit tests

`tests/plan-history.test.ts` (new):

1. **counts the history events and wakes a waiter when the count is reached** — `waitForEvents(2)`
   resolves `true` after the second `historyChanged()`; with fake timers it resolves `false` at the
   timeout.
2. **forgets its records when the plan changes outside a tool call** — a record, then an event
   without `begin()` → no record, `changedInPlanner`; the same event between `begin()` and `end()`
   keeps the record.
3. **ends redo with a new record and starts over on reset** — `markUndone`, `record` → nothing to
   redo; `reset()` → nothing at all, `changedInPlanner` false.
4. **wires itself to the page bridge** — `connectPlanHistory` with a bridge stub: a relayed event
   counts, an accepted page resets.

`tests/page-bridge.test.ts`:

5. **relays the history events of the active page to its listeners** — `FakePageSocket.receive({
   kind: 'event', name: 'historyChange', undo: true, redo: false })` → listener `(true, false)`.
6. **ignores history events from another socket and events of another name** — a second socket
   refused with 4409 sends an event → no call.
7. **tells its listeners when a page is accepted** — after `hello` → the page listener once.

`tests/planner-api.test.ts`:

8. **forwards undo and redo without arguments and with the default timeout** — `bridge.call('undo',
   [])`; the existing allow-list test (`:72`) now fails until `PLANNER_METHODS` has both.

`hi-mcp-client/tests/browser-bridge.test.ts`:

9. **relays the planner's history changes once accepted and keeps the host's handler** — a host
   `vi.fn()` on `extended.callbacks.onHistoryChange`; before `ready` a call sends nothing; after
   `ready` it sends the event and calls the host handler with the same arguments.
10. **puts the host's handler back on disposal** — after `dispose()` the callback is the host's
    again and nothing is sent.
11. **executes undo and redo** — the existing "executes an exposed planner method" pattern for
    `undo`.

## Commit 2 — `feat: add the undo and redo tools`

### Code — `tool-executors.ts`

- **`recorded(tool, executor)`**, used inside `oneAtATime` (`:2278`) for the nine tools of
  `PLAN_CHANGING_TOOLS` (`hi-mcp-server.ts:83`): reads the raw groups (`getExternalObjectGroups`)
  as `groupsBefore`, calls `planHistory.begin()`, runs the executor with a **step-counting planner
  API**, then `end()`, and records the call when it made at least one step — also when the executor
  threw after a step — with `groupsAfter` read afterwards. Raw groups are compared as JSON, sorted
  by id, numbers rounded to 0.1 mm (the comparison the live check used).
- **The step-counting planner API** wraps `extended`: +1 after a successful
  `loadExternalObjectGroupLayout` that loaded something, +1 after a successful
  `externalObjectGroupOperation`, +1 after `removeExternalObject`, −1 after `undo`. After
  `externalObjectGroupOperation` with one of `FOLLOW_UP_COMMANDS` (`change-module-attribute`,
  `change-group-attribute`, `exchange-root-module`) it waits until the command has produced two
  history events since it started, at most `FOLLOW_UP_WAIT_MS` (2 s). The kitchen-wide attributes of
  `create-or-replace-groups` (`applyKitchenWideAttributes`, `:1418`) run through the same wrapper and
  wait too. The command list is roomle-ui behaviour (`respondWithPositionInPlan` for the reasons
  `change_attribute` and `swap_module`) — named so in the behaviour reference.
- **`probeAnchorFrame` (`:636`)**: after the probe load and the read of its groups, `undo()`
  instead of `removeExternalObject` per probe group (`:665-667`) — only when the load loaded
  something. A probe group still in the plan afterwards (re-read) is removed as today, as a
  fallback.
- **`undo`** (in `oneAtATime`, through `inPlacementFrame`):
  1. no record → `{ undone: null, groups, hint }`: nothing to undo — no tool call has changed the
     plan since the page connected, or (with `changedInPlanner`) the plan was changed in the planner
     after the last tool call and the planner's undo button reverts those changes;
  2. the raw groups differ from the record's `groupsAfter` → `forget()`, the same result with the
     planner hint;
  3. `begin()`; `undo()` once per step, each followed by `waitForEvents(events + 1,
     UNDO_EVENT_WAIT_MS)` (1 s); a missing event → `forget()` and `{ undone: null, groups, hint }`:
     the planner's history no longer holds the change (the plan was loaded again) — after a first
     step, "partly undone"; `end()`;
  4. `markUndone()`; `{ undone: <tool>, groups }` with every group of the plan in the plan-context
     shape, plus a `hint` naming the groups that differ from `groupsBefore` when they do.
- **`redo`**: the mirror on `lastUndone()` — the plan must equal its `groupsBefore`, `redo()` once
  per step, compared with `groupsAfter`, `markRedone()`, `{ redone: <tool>, groups, hint? }`.

### Code — `hi-mcp-server.ts`

- Two tools without parameters, after `merge-groups`:
  - `undo` — "Reverts the plan change of the last tool call that changed the plan, as the
    planner's undo does. Call it again to revert the call before. Returns the reverted tool and the
    groups now; when there is nothing to undo, the result says so."
  - `redo` — "Brings back the tool call the last undo reverted. A new change of the plan ends redo.
    Returns the restored tool and the groups now."
- `PLAN_CHANGING_TOOLS` gains `undo` and `redo`, so both are logged like the other plan changes.

### Unit tests — `tests/tool-executors.test.ts`, new `describe('undo and redo')`

A fake planner with a history: `createHistoryApi(planContext)` holds the raw groups, a past and a
future list; a load or a command pushes the state and calls `planHistory.historyChanged()`, a
follow-up command calls it a second time after a configurable delay, `undo` and `redo` move between
the lists and fire one event — or none on an empty list. `beforeEach` resets `planHistory`.

1. **reverts the last tool call with one planner undo and returns the groups as before** — a
   `change-group-attribute`, then `undo` → `extended.undo` once, `{ undone: 'change-group-attribute' }`,
   the groups of the state before.
2. **reverts a kitchen with a material in one call, one planner undo per step** — a
   `create-or-replace-groups` with a group attribute that is not a group setting → two planner
   undos.
3. **undoes the anchor probe instead of removing it** — a placed corner kitchen with an unknown
   anchor → `extended.undo` after the probe load, no `removeExternalObject`, the record counts the
   load only; a later `undo` tool call needs one planner undo and leaves no probe group.
4. **removes a probe group the undo left in the plan** — a fake whose undo keeps the probe →
   `removeExternalObject(probe id)`, the existing frame result.
5. **reverts two tool calls in reverse order, then has nothing to undo** — `change-group-attribute`,
   `delete-group`, three `undo` calls → the group back, the attribute back, then `{ undone: null }`
   without a planner call.
6. **says when there is nothing to undo or redo** — a fresh history → `undone: null` and
   `redone: null` with their hints, no planner call.
7. **brings an undone call back and forgets it after a new change** — `undo`, `redo` →
   `{ redone: … }` and the state after; `undo`, a new command, `redo` → `redone: null`.
8. **does not undo after a change in the planner** — an event outside a tool call → `undone: null`
   with the planner hint and no planner undo; the raw groups changed without an event → the same.
9. **stops when the planner's history no longer holds the change** — a fake undo without an event
   (the history was cleared) → `undone: null`, the hint, the records forgotten.
10. **hints at groups that differ from the state before** — a fake undo restoring another state →
    the result names the group.
11. **waits for the follow-up reload of an attribute change** — the second event 50 ms after the
    command resolves → the tool result after it, and the record's `groupsAfter` includes the
    follow-up's change; with fake timers, a follow-up that never comes ends the wait after 2 s.
12. **does not wait after a command without a follow-up** — `delete-group` resolves without a timer.
13. **runs undo in the queue, never beside another plan change** — a load that resolves late and an
    `undo` called at the same time → the planner undo after the load.
14. **records nothing for a call that changed nothing** — `place-group` on a group that already
    stands there, then `undo` → reverts the call before, not nothing (one planner undo, the earlier
    record).

The existing anchor-probe tests (`:1847-2330`) change from `removeExternalObject` to `undo`:
"has the planner calculate the corner article once, removes the probe …" and "removes every group
the probe load added, whatever its roots are called" become "… undoes the probe load …"; the fake
`createApi` (`:223-266`) gains `undo`.

`tests/hi-mcp-server.test.ts`:

15. **exposes exactly the expected tools** (`:63`) — with `undo` and `redo`.
16. **logs undo and redo like the other tools that change the plan** — one args and one feedback
    line each.
17. **runs undo through the page bridge and counts the events the page relays** — `FakePageSocket`
    answers `externalObjectGroupOperation`, `getExternalObjectGroups`, `undo`, and sends a
    `historyChange` event with each step → `undo` returns `undone`.
18. **answers nothing to undo as a result, not an error** — `undo` on a fresh server → `isError`
    false, `undone: null`.

## Commit 3 — `feat: tell the agent to undo a wrong result`

### Code — `hi-mcp-server.ts`

- `AUTHORING_RULES`, after "Verify results numerically" (`:26`): "- Undo a wrong result: when a
  result is not what was asked - the wrong wall, a unit missing or replaced by mistake, a merge or a
  delete that went wrong - call undo and send the corrected call, instead of correcting the wrong
  plan step by step; one undo reverts one tool call. A group that only needs a change is edited with
  the command tools. undo and redo also serve the user who asks for them."
- `INSTRUCTIONS` step 3 (`:64`), at the end: "undo reverts the last tool call that changed the plan,
  redo brings it back."

### Unit tests — `tests/hi-mcp-server.test.ts`

19. **tells the agent to undo a wrong result and send the corrected call** — the rules contain
    "call undo and send the corrected call" and "one undo reverts one tool call"; the instructions
    name undo and redo.
20. The existing guards of the served text stay green: "describes how to succeed instead of what is
    rejected" and "never tells the agent how the server positions a group internally" — the new
    text mentions neither steps nor the probe.

## Commit 4 — `test: undo and redo in the mcp test prompts`

`docs/test-prompts.json`, three tests on the plan `three-tall-units`. The operations run through
the MCP server, so the server's history holds them; `a7271f1b-…` is the middle unit the existing
test `edit-join-groups` deletes.

| id | operations | prompt | expect |
|---|---|---|---|
| `undo-last-change` | `delete-root-module` the middle unit | "undo the last change" | undo: one group of three tall units again |
| `redo-last-change` | `delete-root-module` the middle unit, `undo` | "redo that" | redo: the middle unit removed again, two groups |
| `undo-a-wrong-command` | `delete-root-module` the middle unit | "that was the wrong unit - remove the last unit, not the middle one" | undo, then `delete-root-module` on the last unit: one group of the first two units |

`docs/test-prompts.md` gets the three tests in its table.

## Documentation (with commits 1–3)

- [hi-mcp-behaviour.md](../../hi-mcp/docs/hi-mcp-behaviour.md): **D37** (undo and redo on the
  allow-list, the bridge event; D2 decision) and **D38** (the agent's undo reverts tool calls only;
  a change in the planner ends it); §4 the planner methods table (`undo`, `redo`;
  `removeExternalObject` only as the probe fallback), the bridge `event` message, the queue; §5.2 the
  undo rule; §6 the tools table and sections for `undo` and `redo`; §8.1 the `hint` channel for
  "nothing to undo", "changed in the planner", "history no longer holds it", "groups differ"; §8.2
  C6 (the probe is undone); §9 the follow-up wait (2 s) and the undo event wait (1 s).
- [hi-mcp-server.md](../../minimal-hi-example/docs/hi-mcp-server.md): tool reference sections
  `undo` and `redo`.
- [hi-mcp-tools.md](../skills/hi-mcp-tools.md) and [hi-mcp-server.md](../skills/hi-mcp-server.md)
  (skills): the tools, the allow-list, the bridge event.
- [hi-mcp-client/README.md](../../hi-mcp/hi-mcp-client/README.md): the relay; AGENTS.md "Testing
  Tool Calls": one bullet.
- The analysis is closed out after the work (`Implemented`), the plan gets its commit list.

## ligna-store

Copy `hi-mcp/hi-mcp-client/browser-bridge.ts` and `types.ts` to the store's `hi-mcp/` (the store's
copy differs only in its line width and the place of `BridgeStatus`), then format them with the
store's Prettier. `Planner.vue` needs no change: the store sets no
`onHistoryChange`, and the relay keeps a host handler anyway. Branch
`feat/hi-mcp-undo-redo-RML-18044`; push over HTTPS with the `gh` credential helper.

## Verification

1. **Unit tests** as above; `npm test` in `hi-mcp`.
2. **Live, headless** — the scratch script of the analysis, changed to call the tools: for every
   tool that changes the plan, the tool, `undo`, compare with before, `redo`, compare with after;
   two `undo` calls in a row; `undo` after a planner edit made from the page (`extended.undo` /
   a removal) → the planner hint; after a `create-or-replace-groups` with a probe and a material,
   the planner's own undo exhausts after two steps — no ghost.
3. **"test the mcp"** with gpt-5-mini: the three new tests pass, and no test that passed in the last
   run fails because the agent undid too much or went back and forth (acceptance criterion).

## Risks

- **A late event after the follow-up wait** counts as a change in the planner: `undo` then refuses
  with the planner hint. Conservative; seen in none of the 15 measured follow-ups.
- **The probe undo without a following load** (the real load throws): the planner keeps the probe
  load as a redo future, and the planner's redo button would bring the probe back. The server's own
  `redo` has no record of it. Rare; named in the behaviour reference.
- **Configurator mode** was not checked: `undo()` there acts on the configurator's history. The tool
  then sees no planner event and stops with the "history no longer holds it" hint; a configurator
  undo may already have happened. Out of scope (ticket); checked once live with a selected group.
- **The step table and the follow-up commands are roomle-ui behaviour.** The compare after each
  undo names a mismatch in a hint, so a roomle-ui change shows up in the results and in "test the
  mcp" instead of silently corrupting the plan.

## Optional roomle-ui follow-ups (not needed for this ticket)

- Resolve `externalObjectGroupOperation` after the follow-up reload (`expectContinuation` /
  `onCoreLoad` exist and are unused) — the server's follow-up wait then becomes a no-op.
- A history-neutral calculation of an article for the anchor frame — or the article template
  geometry of the backlog — so that no probe load is needed at all.

## Close-out (2026-10-05)

### Commits

| Repository | Commit | Content |
|---|---|---|
| roomle-hi-example | `5142f99` | commit 1 — the bridge event, `undo` and `redo` on `planner-api.ts` and the page allow-lists, `plan-history.ts` |
| roomle-hi-example | `fa7e0ca` | commit 2 — the tools, the recording in the queue, the probe undo |
| roomle-hi-example | `42d4623` | commit 3 — the undo rule in the served text |
| roomle-hi-example | `5eba045` | commit 4 — the three MCP test prompts |
| roomle-hi-example | `185d324` | the run script starts a test's operations after the plan groups are loaded |
| roomle-hi-example | `cba4800` | the `undo` description says when to undo |
| ligna-store | `b963587` | the store's copy of the page bridge (only the undo changes, in the store's formatting) |

### Deviations from the plan

1. **No wait on a page that relays no history.** The follow-up wait starts only when the command's
   first history event has arrived, so a page without the relay — an old store build against the
   deployed server — pays no 2 s per attribute command.
2. **The probe also falls back to removal when `undo` fails** — a page without `undo` on its
   allow-list — not only when the undo left the probe group in the plan.
3. **The `undo` description says when to undo** (`cba4800`). The first attempt of the test
   `undo-a-wrong-command` failed: the model never fetched the rules, and the HI chat does not pass the
   server's instructions on, so the rule of commit 3 never reached it. The tool list does.
4. **The run script waits for the plan groups** (`185d324`). The first attempt of
   `redo-last-change` ran its operations before the HI library had loaded the plan's groups; the
   planner then cleared its undo history, and the operation's undo correctly answered that the
   history no longer held the delete. The example page sets `window.hiPosGroupsCompletelyLoaded` in
   the HI callback `onPosGroupsCompletelyLoaded`, and the run script waits for it before a test's
   operations.
5. **30 new unit tests** (375 → 405) instead of the 20 named: some named tests became two.

### Verification

| Check | Result |
|---|---|
| `npm test`, typecheck, lint, format check in `hi-mcp` | 405 tests pass; all checks clean |
| Live, headless, bo-test planner, through the tools | every tool that changes the plan: `undo` restored the raw groups exactly and `redo` brought the result back, no hints; two undos in a row reverted `delete-group` and `merge-groups`; after a removal made in the planner, `undo` refused with the planner hint; after a `create-or-replace-groups` with a probe and a material, the planner's own undo ran out after two steps — no ghost |
| "test the mcp", gpt-5-mini, bo-test, 21 tests | 16 pass, 5 partial, 0 fail; the three undo tests pass (after the two fixes above); no other run called `undo` or `redo`; the five partials are the image and material tests that were partial in the last run too — [report](../../.temp/result/mcp-test-2026-10-05_14-20-34/report.md) (local), new backlog issue 39 |

The acceptance criteria of the ticket hold, with one note: the order data after an undo was compared
in the planner-level measurement of the analysis (equal for every tool), the tool-level live check
compared the raw groups.
