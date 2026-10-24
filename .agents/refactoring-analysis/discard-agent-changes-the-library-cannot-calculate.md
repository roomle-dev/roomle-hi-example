# Discard an agent's change the library cannot calculate

> **Type**: Refactoring analysis
> **Status**: Open
> **Date**: 2026-10-24
> **Base**: roomle-hi-example `refactor/agent-coordinate-system-z-up` `46d3c3a` (on `master`
> `36343fd`); roomle-ui `feat/hi-mcp` `5d4a0f314`, whose HI code equals `master` `7e2e54fb3` apart
> from the served relation text

## Affected repositories

- **roomle-ui** — the HI tool commands: `runToolCommand` reads the library's verdict before and
  after every plan-changing call and reports the root modules the call made fail; the HI tool set:
  such a call is reverted with the planner's undo, not recorded, and answered with an error result;
  the glue logic only to make an exception of the calculation visible to the tool command (decision
  3); the served text; the tests; `.agents/homag-intelligence/` (`library-errors.md`,
  `hi-tools-behaviour.md`, `hi-tools-reference.md`).
- **roomle-hi-example** — the wiki page
  [why-the-agent-cannot-plan-what-the-library-cannot-build.md](../wiki/why-the-agent-cannot-plan-what-the-library-cannot-build.md),
  the backlog [library-calculation-gaps.md](../backlog/library-calculation-gaps.md) (items 5 and 6
  are closed by this work, 1 and 2 shrink), the skills `hi-mcp-tools.md`, `roomle-hi-concepts.md`
  and `hi-mcp-testing.md`.
- **embedding-lib** (in roomle-ui) — unchanged: `createHiMcpTools` forwards the calls, and an error
  result is already an error result. No new version.
- **ligna-store** — unchanged: it gets the behaviour with the planner (the bo-test deployment).
- **RoomleCore** — unchanged: the planner's undo of the tool call's step restores the plan.
- **HOMAG library** — unchanged.

## Summary

- **Today** a change the library cannot calculate is kept (D95). `create-or-replace-groups` builds
  the group with the failed root modules and names them in `notLoaded`; the attribute tools keep the
  change and name them in `corrections` (C25); the eight other plan-changing tools keep it without a
  note; an exception of the calculation leaves the group uncalculated without a note.
- **The rule asked for:** a change of the agent that the library answers with `Error` or `Fatal` is
  not allowed. It is discarded, the original groups (`PosGroup`) stay as they were, and the agent is
  told that the change was not possible and nothing was changed.
- **History:** roomle-ui discarded a failed calculation once, in the glue logic (`37633e576`,
  2026-09-15). `7194b5f42` and `5bca7ea7a` (2026-10-14/15) removed it, because the glue logic
  calculates every edit, also the user's own in the planner, and the discard reverted those — "such
  as the height of a cabinet". The rule therefore belongs to the HI tools, which only the agent's
  calls pass. The user's edits in the planner keep D95.
- **Proposal:** every plan-changing tool call is all or nothing towards the library. The tool
  command compares the `Error` and `Fatal` diagnostics before and after the call; when the call made
  a root module fail, the tool set reverts the call with the planner's undo — a tool call is one
  undo step of the planner, so the undo restores the plan before the call exactly —, records
  nothing, and answers with an error result: nothing was changed, which root modules failed with
  which diagnostic, what to send instead.
- **A guard:** the discard refuses the agent's input (step 5 of
  [Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort)); section 2 gives the reason
  steps 1–4 do not meet the rule.
- Five decisions are open (section 7); the main ones: only root modules the call made fail, or
  every failing one; the whole call, or only the failing group of a create.

## 1. What the current code does

roomle-ui paths are relative to `packages/web-sdk/packages/homag-intelligence/src/`.

### 1.1 The library's verdict

The library writes `logMessages` onto every root module it calculates, and onto the group, with a
`category` of `Fatal`, `Error`, `Warning`, `Info` or `Debug`. roomle-ui counts `Error` and `Fatal`
as a failure (`CALCULATION_ERROR_CATEGORIES`, `glue-logic.ts:463`; `rootModulesWithCalculationError`,
`:472`; `newlyFailedRootModules`, `:487` — the roots that fail now and did not before the change). A
failed root module can lack its docking vectors and its front parts (D95). The details are in roomle-ui
`.agents/homag-intelligence/library-errors.md`.

### 1.2 What each tool does with it

| Tool | Today | Where |
|---|---|---|
| `create-or-replace-groups` | builds the group with its failed root modules; `notLoaded` per group: `the library could not calculate root module … - <first line>. … The loaded groups and other roots were kept.` | `hi-tool-commands.ts:721-753` |
| `change-module-attribute`, `change-group-attribute` | keeps the change; `corrections` (C25): "… The applied changes and other roots were kept." | `withLibraryChanges`, `hi-tool-attributes.ts:237`, the failures `:254-276` |
| `place-group`, `delete-article-in-place`, `delete-article-and-compact`, `merge-article-into-group`, `insert-article-into-group`, `exchange-root-module`, `swap-root-modules`, `merge-groups` | keeps the change, no note | backlog item 6 |
| the four interior fitting tools | **refuse already**: the edit is staged on a copy and rejected when it leaves a root module failed that did not fail before ("The library could not calculate the edited interior.", `hi-interior-design.ts:735`); a failure after the load reloads the original group (`glue-logic.ts:3100-3125`) | D96 |
| any tool, the library's `calculateGroup` throws | `_calculate` (`glue-logic.ts:3456-3470`) logs it and returns the group uncalculated; the messages were cleared before (`_updatePosData`, `:3781`), so nothing reports a failure | backlog item 5 |

### 1.3 The discard that was removed

`37633e576` (2026-09-15, "discard a module change when the library calculation fails") restored the
group from its last clean calculation in the glue logic. `7194b5f42` (2026-10-14) and `5bca7ea7a`
(2026-10-15, "keep every library calculation and only log failed root modules") removed it with
the reason: "Discarding a calculation reverts changes the user made, such as the height of a
cabinet." D95 and the wiki ("A failed calculation is kept, not discarded") record the outcome and
reject the discard: the value may be the user's, resetting it needs the library's valid
combinations, and the agent repairs a kept group with one more call.

The new rule differs in both points: it covers the agent's tool calls only, not the user's edits in
the planner, and it resets no value — it reverts the whole call, which needs no knowledge of the
valid combinations.

`hi-tools-behaviour.md` D73 and its §8 row (lines 288 and 1104) still describe a replace "the
planner restored … (roomle-ui `_discardCalculation`)"; that function left the code with
`5bca7ea7a`. The rewrite of D73 below removes the stale part.

### 1.4 The undo the tools already have

- **One planner step per tool call.** `runToolCall` (`planner-core/src/services/plan-interaction-manager.ts:365`)
  makes every `externalObjectGroupOperation` one step of the planner's undo history, committed at
  the end of the call, also when it throws after a change.
- **The record.** `recorded` (`hi-mcp/tool-executors.ts:229`) records every plan-changing call with
  its planner steps and the plan before and after it (`groupsBefore`, `groupsAfter`, the groups key
  rounded to 0.1 mm).
- **The revert.** `stepHistory` (`:265`) runs one planner `undo` per step and waits for its history
  event; `revertToolCall` (`:295`) checks the plan before and after and takes a revert back that does
  not give the plan of before (`CHANGED_IN_PLANNER`, `:158`).
- **The history.** `PlanHistory.record` clears the undone calls (`hi-mcp/plan-history.ts:73-75`),
  `forget` clears everything (`:101-103`).

### 1.5 Why it is a problem

A change the library cannot calculate leaves a root module in the plan that the library did not
build: without docking vectors and fronts, in the price and the order without a note (backlog item
1), invisible to every later call (item 2), after eight tools not even named (item 6), and after an
exception not calculated at all (item 5). The agent can thus hand the user a planning the library
cannot build. The user rules such a change out.

## 2. Why a refusal

The discard refuses the agent's input. Following [Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort):

1. **Clarify the instructions** — the served text cannot name the value combinations a library's
   tables lack; they are library data, and the rules stay library-neutral.
2. **Simplify the tool API** — the agent chooses articles and values; the failing combination is
   one the library's own selections offer (D99: then a library bug). Checking a value against the
   library's verified options before an edit is open work
   ([attribute-values-checked-before-an-edit.md](../backlog/attribute-values-checked-before-an-edit.md));
   it prevents part of the failures and stays worth doing beside the discard.
3. **Correct the input** — the server does not know a valid combination (D95 rejected resetting the
   failing attribute).
4. **Build what it can and give feedback** — today's behaviour; it leaves the failed root module in
   the plan, which the user rules out.

So the refusal is the user's decision for the one case the library itself rejects. It keeps the
rest of the rule: the result says what was not built, why, and what to send instead.

## 3. The target shape

### 3.1 The rule

A plan-changing tool call of the agent whose calculation leaves a root module — a generated one
included — or the group with an `Error` or `Fatal` diagnostic it did not have before the call, or
whose calculation throws (decision 3), changes nothing: the plan returns to its state before the
call, and the agent gets an error result that says so.

It covers every tool of `PLAN_CHANGING_TOOLS` (`hi-mcp/hi-mcp-server.ts:103-122`) but `undo` and
`redo`, which restore a plan that existed. The interior fitting tools keep their staging, which
already meets the rule; their message says "nothing was changed" like the others.

### 3.2 Detection in the tool command

`runToolCommand` (`hi-tool-commands.ts:1404`) wraps every tool command:

1. **Before** the command: `getExternalObjectGroups`, the failing root modules by root id and the
   failing groups by group id.
2. **After** the command — after the load, the placement by wall and the group attributes:
   `getExternalObjectGroups` again; a root module or group that fails now and did not before is
   *newly failed*. The roots of a new group are all new; a replace keeps the ids of the root modules
   it keeps. Whether a merge and a split keep every root id is to be checked in the implementation;
   where they do not, the comparison runs per group.
3. **The result** carries `libraryFailures`: per group the root modules — by the ids the call gave
   them where the call named them — with their article and the first line of the first `Error` or
   `Fatal` message, grouped by cause. The sentences of today's two reports
   (`hi-tool-commands.ts:721-753`, `hi-tool-attributes.ts:254-276`, `byCause`, `rootModulesLabel`)
   become one function; `notLoaded` and `corrections` no longer carry failed root modules.

The tool commands already read `getExternalObjectGroups` after the call (`inPlacementFrame`); the
read before is one planner call more per plan-changing tool call.

### 3.3 The revert in the HI tool set

In `recorded` / `inPlanner` (`hi-mcp/tool-executors.ts:229`, `:374`), when the planner's answer
carries `libraryFailures`:

1. `stepHistory(api, 'undo', count.steps)` — the planner's undo of the call's step, the same path as
   the `undo` tool.
2. The plan must equal `count.groupsBefore`. When it does not — the user changed the plan in the
   planner while the call ran, or the history ran out — the result says that the change could not be
   taken back completely and asks to check the plan with `get-plan-context`, as `revertToolCall`
   does.
3. The call is not recorded, and the undone calls are cleared, as `record` clears them: the call's
   step replaced the planner's redo history, so an earlier undone call cannot be redone any more.
4. The executor throws the error text; `execute` turns it into an error result (`errorResult`,
   `hi-mcp/mcp-tool.ts:16-19`), and `runTool` logs it as `[hi-mcp] tool <name> error`.

The revert lives in the tool set because the tool set owns undo and its plan check (D38, D71). The
planner has no way to abort a step whose kernel changes are made; reloading the original groups
instead would add a second step, and the planner's undo button would then step back into the
failed state.

### 3.4 What the agent reads

```text
change-module-attribute: nothing was changed - with mod_Width 900 the library could not calculate
root module 'b2' (OTB60) of group '…' - Error 14019: Could not find entry in tab_DoorSettings for
input value: …. The plan is as it was before this call. Change the failing values or replace the
article, and send the call again.
```

```text
create-or-replace-groups: nothing was changed - the library could not calculate root module 'u2'
(OSKB60) of posGroups[0] - <first line>. The plan is as it was before this call. Change the failing
values in posGroups[0] or replace the article, and send the call again.
```

Served text (`hi-mcp/hi-mcp-server.ts`): the instructions (`:44`), the `create-or-replace-groups`
description (`:486`) and the attribute tools (`:588-589`, `:624-625`) say that a call the library cannot
calculate changes nothing and returns an error that names the root modules, the diagnostic and what
to change. `notLoaded` keeps what the planner left out (D73: a calculation in progress, an
exception inside the load) and the unknown article ids.

### 3.5 What stays

- The user's edits in the planner: the glue logic keeps every calculation (D95 for the planner).
- The arrangement's handling of a root module without docking vectors (`hi-root-module-arrangement.ts`):
  plans the user edited or loaded can still hold one.
- `undo`, `redo` and the interior staging.

## 4. Alternatives

| Alternative | Why not |
|---|---|
| **The discard in the glue logic** (`37633e576`) | reverts the user's own edits in the planner; removed for that reason |
| **Reload the original groups** | a second planner step: the planner's undo button steps back into the failed state, and the tool set would record two steps for one call |
| **Calculate on a copy before loading**, as the interior edits stage | the create's layout load, the arrangement and the placement by wall run in the planner; a dry run of every command duplicates them. The interior staging works because its edit stays inside one group's module tree. A candidate later for a create, where the article templates are calculated outside the plan already (`calculateArticleTemplate`) |
| **Keep and name** (today, D95) | the user rules it out for the agent |
| **Reset the failing attribute** | needs the library's valid combinations (D95) |

## 5. Scope

### roomle-ui

| File | Change |
|---|---|
| `hi-tool-commands.ts:1404` (`runToolCommand`) | the verdict before and after, `libraryFailures` |
| `hi-tool-commands.ts:721-753`, `hi-tool-attributes.ts:237-276`, `hi-tool-payload.ts` (`byCause`, `rootModulesLabel`) | one failure report instead of the create's `notLoaded` entries and C25 |
| `glue-logic.ts:3456-3470` (`_calculate`) | decision 3: an exception reported to the tool command; the planner's own edits unchanged |
| `hi-mcp/tool-executors.ts:229-258`, `:265-287`, `:374-397`; `hi-mcp/plan-history.ts` | the revert, no record, the undone calls cleared |
| `hi-mcp/hi-mcp-server.ts:44`, `:486`, `:588-589`, `:624-625` | the served text |
| `hi-interior-design.ts:735`, `glue-logic.ts:3100-3125` | the message: nothing was changed |
| `.agents/homag-intelligence/library-errors.md` | "The HI tool commands", "The HI tools", "What the handling does not cover" |
| `.agents/homag-intelligence/hi-tools-behaviour.md` | a decision for the discard; D95 restricted to the planner's own edits; D73 without the replace restore; C25 and the `notLoaded` rows of §8 replaced by the discard message |
| `.agents/homag-intelligence/hi-tools-reference.md` | the results of the plan-changing tools |

### roomle-hi-example

| File | Change |
|---|---|
| `.agents/wiki/why-the-agent-cannot-plan-what-the-library-cannot-build.md` | "What happens to wrong input" (a value the library cannot calculate, an exception), "A failed calculation is kept, not discarded", "An exception of the calculation reaches only the console", "The row edits report no library error" |
| `.agents/backlog/library-calculation-gaps.md` | item 6 done; item 5 done with decision 3; items 1 and 2 only for the planner's own edits and loaded plans |
| `.agents/skills/hi-mcp-tools.md:178`, `.agents/skills/roomle-hi-concepts.md:265` | the results |
| `.agents/skills/hi-mcp-testing.md` | a discarded call in a run (`[hi-mcp] tool … error`, "nothing was changed"): classified by D99 — an invalid value the MCP let through, or a library bug |

## 6. Tests

Tests whose expectations change:

- `__tests__/hi-tools-test.ts` — "keeps a failed calculation and reports its diagnostic through %s",
  "reports only the final follow-up calculation errors through %s", "reports the root module of a
  replace the library could not calculate through the real glue-logic": the result carries
  `libraryFailures` instead of `corrections` and `notLoaded`.
- `__tests__/hi-tool-commands/group-commands-test.ts` — "groups roots with the same diagnostic and
  appends it after library changes": the one failure report.
- `__tests__/hi-tool-commands/create-or-replace-groups-placement-test.ts` — the failed-root
  `notLoaded` entries.
- `__tests__/hi-mcp/tool-executors-test.ts` — the C25 guard.
- Unchanged: `__tests__/glue-logic-test.ts` ("keeps the change and logs the root module …") and the
  arrangement tests — the planner's own edits keep D95.

New:

- `__tests__/hi-tool-commands/`: every plan-changing command, with a fake planner whose groups
  after the command hold a newly failing root module, reports it in `libraryFailures`; a root module
  that failed before and after does not (decision 1); a new group's failing root module does; a
  failing generated root does.
- `__tests__/hi-mcp/tool-executors-test.ts`: a planner answer with `libraryFailures` leads to one
  planner `undo`, no record — a following `undo` tool call reverts the call before —, and an error
  result that names the root modules and says that nothing was changed; a plan that differs from
  `groupsBefore` after the undo gives the "could not be taken back completely" text.
- `__tests__/glue-logic-test.ts` (decision 3): a library whose `calculateGroup` throws is reported
  to the tool command; an edit outside a tool call keeps today's behaviour.
- Live, model-free in the example page (`instance.extended.callExternalObjectAgentTool`), as the
  backlog's reproductions: `change-module-attribute` of an `OTB60` to `mod_Width` 900 with
  `mod_DoorDirectionSelection` `Left`, and `exchange-root-module` with the same values — an error
  result, and `getExternalObjectGroups` equal before and after.

The served text changes the agent's results, so the prompt tests ("test the mcp") show whether the
models recover from a discarded call — on request.

## 7. Open decisions

1. **Which failures** — only root modules the call made fail (recommended: a root module that
   failed before, from the user's edit or a loaded plan, would otherwise block every agent change
   of its group, its repair excepted) or every `Error` and `Fatal` after the call.
2. **How much of a call** — the whole call (recommended: "nothing was changed" holds, one planner
   step is one undo, and the error lists every failing root module of every group so the agent
   resends once) or only the failing group of a create, the others built — which keeps the guard
   rule that a wrong group does not cancel the valid ones, but needs a restore per group.
3. **An exception of the calculation** — counts like `Fatal` (recommended: the library calculated
   nothing) — needs `_calculate` to report it to the tool command; or stays as today.
4. **The planner's redo entry** — the reverted step stays on the planner's redo history until the
   next change; the planner's redo button could bring the failed change back. Leave it (recommended:
   the planner has no API to drop it, and the next change clears it) or add one.
5. **Group-level messages** — count an `Error` on the group as well (recommended); whether the
   library writes one on the group is not verified.

## 8. Risks

- **Partial progress is lost:** a create of a kitchen with one failing unit creates nothing. The
  error must name every failing root module with its cause, so the agent can resend the whole call
  once; the prompt tests show whether the models do.
- **The value the user asked for:** when the user names a value the library cannot calculate, the
  agent can only report it; the error says so plainly (D51).
- **A user editing during the call:** the undo may not restore the plan before the call; the result
  says so.
- **One more planner read** (`getExternalObjectGroups`) per plan-changing call.
