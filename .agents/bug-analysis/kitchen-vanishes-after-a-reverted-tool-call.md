# Bug analysis: the kitchen vanishes when the tool set reverts a call the library could not calculate completely

> **Type**: Bug analysis
> **Status**: Open — the fix is proposed below; the new decision and three points are to be confirmed by the user (D51)
> **Date**: 2026-10-24
> **Base**: roomle-hi-example `master` `bfa3d77`; roomle-ui `feat/hi-mcp` `82a103019` (local — the
> five commits of 2026-10-24: D105, D106, D107, D108 and the coordinate-system documentation)
> **Backlog**: none — the symptom was reported by the user from the example page with `gpt-6-astra` on
> the local planner; it touches [library-calculation-gaps.md](../backlog/library-calculation-gaps.md),
> whose text assumes D106

## Affected repositories

- **roomle-ui**, branch `feat/hi-mcp`, the tool layer only: the HI tools (`hi-tools.ts`:
  `_loadGroupLayout`, `changeAttributes`, `changeModuleAttribute`, `changeGroupAttribute`, the row
  edits and the exchange — the discard before the load), the tool commands (`hi-tool-commands.ts`,
  `hi-tool-payload.ts`: the results say what was discarded), the HI tool set
  (`hi-mcp/tool-executors.ts`: the revert by undo goes; `hi-mcp/plan-history.ts`: `clearUndone`), the
  served text (`hi-mcp/hi-mcp-server.ts`), the tests, and `.agents/homag-intelligence/hi-tools-behaviour.md`
  (a new decision, D106, D108, G68, §2.3), `hi-tools-reference.md`, `library-errors.md` and
  `tool-executors.md`. **`glue-logic.ts` stays unchanged**: it calculates, stores and logs a failed
  calculation as it does today (D95); the tools use its public methods.
- **roomle-hi-example**: documentation only — the wiki page
  [Why the agent cannot plan what the library cannot build](../wiki/why-the-agent-cannot-plan-what-the-library-cannot-build.md),
  the backlog ([library-calculation-gaps.md](../backlog/library-calculation-gaps.md), the test item
  "The models after a call the library cannot calculate" and item 107 of
  [mcp-issues.md](../backlog/mcp-issues.md)), `.agents/skills/hi-mcp-tools.md` and
  `.agents/skills/hi-mcp-testing.md`.
- **ligna-store**: unchanged. The discard lives in the planner's tool layer, so the store gets the
  fix with the planner at its server URL. No new embedding-lib version: the forwarding of
  `createHiMcpTools` does not change.

The roomle-ui paths below are relative to `packages/web-sdk/packages/homag-intelligence/src/`; the
line numbers are those of `82a103019`.

## Symptom

The user plans a kitchen from an image in the example page (the tests of the category "planning
from images" in [`docs/test-prompts.json`](../../docs/test-prompts.json)), with `gpt-6-astra` on the
local planner of `feat/hi-mcp`. The kitchen appears in the planner, vanishes a second later, and the
plan stays empty for the tens of seconds the model needs to compose its next attempt. The next
kitchen appears and can vanish the same way. The assistant needs several attempts for a planning
that the builds of the days before made in one call.

The user's requirement: a planning does not have to be right at the first attempt — it can be
changed or replaced — but it must never vanish completely for seconds before something new appears.
A change of the agent that the library cannot calculate is discarded by the tools in the
background: the group before the change is preserved, nothing is loaded, and the agent is told that
the change was not possible and nothing was changed. The glue logic is not part of that: it keeps
every calculation and logs a failed root module, for the agent's calls as for the user's edits.

## Reproduction

Model-free, on `82a103019`, against the dev server on `:5173` and a launcher of its own
(`EXAMPLE_PORT=3002 HI_CHAT_PORT=3202 node minimal-hi-example/start.mjs --dev --no-open`), on the
plan `default-room` (`ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv`), with
`window.instance.extended.callExternalObjectAgentTool` in the page and
`getExternalObjectGroups()` polled every 200 ms. The payload is the `create-or-replace-groups` of a
recorded image planning on the build before D106:
`.temp/result/mcp-test-2026-10-22_19-45-49/gpt-6-astra/66-image-kitchen-left-wall/planner-calls.json`
— the kitchen of `kitchen-1.png` on the left wall, eleven units, the backsplash enabled with
`mod_CreateBacksplash` on four base units and `mod_BacksplashColor` 326, `mod_BacksplashHeight` 660
as group attributes. The script and its output are in
`.temp/result/repro-kitchen-vanishes-2026-10-24/`.

| Time | What the planner holds | What happens |
|---|---|---|
| 0.0 s | 0 groups | the call starts |
| 1.3 s | 1 group, 12 root modules | the kitchen is loaded, calculated and placed at the left wall — the eleven units and the generated backsplash |
| 2.6 s | 0 groups | the tool set calls the planner's `undo` (`[hi-mcp] call 3: undo`) |
| 2.6 s | 0 groups | the tool answers an error result |

The error result:

```text
create-or-replace-groups: nothing was changed - posGroups[0]: the library could not calculate root
module 'cc3bc7d5-…' (mr_Backsplash) of group '2624a79f-…' - Error 14034: Could not find entry in
tab_GrainDirectionSettings for input values: part_Backsplash - undefined - undefined - undefined -
1200 - 660. The plan is as it was before this call. Change the failing values or replace the
article, and send the call again.
```

The control: the same payload without the backsplash (`mod_CreateBacksplash` and the two group
attributes removed) is built in 2.0 s and stays — one group, eleven root modules, `pos`
`[-685, -240, 0]`, `rotationZ` 90, centred on the left wall. The placement by wall is right on
`82a103019`: the coordinate-system refactoring of the day (D105) is not involved.

In the chat the same sequence runs with a model step between the attempts: the kitchen appears,
vanishes after about a second, and the plan is empty until the model has read the error, decided
what to change and sent the eleven units again — 20 to 40 s for a payload of this size — and the
new kitchen is calculated. When the cause remains, the second kitchen vanishes as well. The
backsplash is such a cause: the library calculates no backsplash with any colour and height the
agent sends ([library issue 93](../backlog/library-issues.md#93-backsplashes-the-library-cannot-calculate)).

## Investigation

### What changed today

Five commits of 2026-10-24 on roomle-ui `feat/hi-mcp`:

| Commit | Decision | Role in the symptom |
|---|---|---|
| `5d4a0f314` docs: the coordinate systems | — | none |
| `246149810` the agent works in the planner's coordinate system | D105 | none — the control above places the group right |
| `6512f5890` discard an agent change the library cannot calculate | D106 | **the cause**: the discard is a planner `undo` after the whole tool ran, not a discard of the tools before the load |
| `345f72def` check attribute values against the library's verified options before an edit | D107 | none — it prevents part of the failures before they happen; it does not catch a generated root or a size |
| `82a103019` show the agent the root modules the library could not calculate | D108 | none — `calculationError` on every failed root module in every result and in the plan context |

### The path of the revert

1. `runToolCommand` (`hi-tool-commands.ts:1443`) reads the calculated groups right before the
   command's first plan change (`beforeTheChange`, `:1457`) and again after the whole command has
   run, and names every root module and group that carries an `Error` or `Fatal` message after the
   call and did not before: `libraryFailures` (`:1461-1467`, `:1533`; `newLibraryFailures` in
   `hi-tool-payload.ts`). For a create the whole command has run by then: the layout load into the
   planner (`_loadGroupLayout`, `hi-tools.ts:487`, `designerRequests.loadPosGroups` `:494`), the
   placement by wall (`placeAtWalls`, `hi-tool-commands.ts:710`) and the group attributes
   (`applyGroupWideAttributes`, `:720`). The kitchen stands in the scene.
2. `inPlanner` (`hi-mcp/tool-executors.ts:445`) throws a `LibraryFailure` (`:458-460`) when the
   result carries `libraryFailures` — before the result reaches the agent.
3. `recorded` (`:281`) catches it (`:289-304`): `stepHistory` runs the planner's `undo` once per
   step of the call (`:294`) — the kitchen leaves the scene —, compares the plan with the plan
   before the call, records nothing, and throws the error of `discardedCall` (`:172`): "nothing was
   changed … The plan is as it was before this call. Change the failing values or replace the
   article, and send the call again."
4. The agent gets the error result and starts over with the whole kitchen.

### Why the discard is not the one the user asked for

The user's design — the tools store the original group, let the library calculate, and on a
library error restore the original and tell the agent that nothing was changed — needs no undo,
because nothing is loaded into the scene. Today's tool layer has the means for it and does not use
them:

- **The tools own the load on the paths that matter.** The layout load of a create is two steps
  in the tool layer: `createOrReplacePosGroupsFromLayout` calculates the groups into the glue
  logic's group map, and the tools load them into the kernel afterwards
  (`_loadGroupLayout`, `hi-tools.ts:487-500`, `designerRequests.loadPosGroups` `:494`). An
  attribute change is two steps as well: `modifyAttributesOfModules` calculates, and the tools
  call `loadWithChangedAttributes` for the load (`changeAttributes`, `hi-tools.ts:655-663`).
  Between the two steps the calculated group is in the tools' hands and nowhere in the scene.
- **The tools store the original already.** Every row edit takes a deep copy of the group before
  it changes it (`groupBeforeChange`, used in `mergeArticleIntoGroup`, `insertArticleIntoGroup`,
  `removeArticleFromGroup`, `swapRootModules`), and the tool command reads the groups before a
  replace (`rawBefore`, `hi-tool-commands.ts:443`).
- **The verdict is a tool helper.** `newLibraryFailures` (`hi-tool-payload.ts`) compares two
  groups by their `Error` and `Fatal` messages; `runToolCommand` applies it after the call only.
- **The restore has a public API.** The glue logic takes a group back without a load through the
  notifications the kernel uses: `changedGroupFromHistory(group, false)` (`glue-logic.ts:1818`)
  calculates a given group, stores it as the group of the plan and notifies the host without
  loading; `removedGroup(id)` (`:1804`) takes a group out of the group map. The tools hold the
  group item as well and write its `posDataJson` directly in every row edit.
- **The interior tools do it this way since D96**: `stageInteriorEdit` (`hi-interior-design.ts:435`)
  changes a `structuredClone` of the group, calculates it with the library
  (`library.calculateGroup`, `:558`, `:719`) and refuses an edit the library cannot calculate with
  "nothing was changed" before anything is loaded.

D106 considered the discard in the glue logic and on a copy for every command, rejected both, and
chose the undo. The tool layer, which owns the load, was not considered. The glue logic's own
handling — it keeps the calculation and logs the failed root module — is right and stays: it serves
the user's edits in the planner as well (D95).

### What the build before D106 did

On `1a7fc84a2` (2026-10-23) and the recorded runs of 2026-10-21 and 2026-10-22 the create kept
the kitchen and named the failed root module in `notLoaded`:

```text
posGroups[0]: the library could not calculate root module '…' (mr_Backsplash) of group '…' - Error
14034: …. Check posGroups[0].attributes and the root's attribute overrides against the library
data; change the failing values or replace the article. The loaded groups and other roots were kept.
```

(removed by `6512f5890` in `hi-tool-commands.ts` and in `withLibraryChanges` of
`hi-tool-attributes.ts`). The agent repaired the group in place:

- `66-image-kitchen-left-wall`: one `change-group-attribute` with another backsplash colour, then
  `mod_CreateBacksplash` false — the kitchen stood the whole time, the answer reported the omission.
- `69-image-only-no-text`: two `change-group-attribute` with colour, height and thickness, then
  `mod_CreateBacksplash` false on six root modules and an exchange of the hood.

### How often a create carries a failed root module

In the image plannings of `mcp-test-2026-10-22_19-45-49` (`gpt-6-astra`), three of the four
kitchens left the first `create-or-replace-groups` with a root module the library could not
calculate: the backsplash in `66` and `69` (Error 14034), a `GSP` panel in `68` (Error 1300x). Only
`67` had none. The runs of 2026-10-21 and the morning of 2026-10-22 show the same picture — two to
eight "could not calculate" lines per image planning. On a build with D106 each of these creates
is undone, and the kitchen vanishes once per attempt.

### The served text sends the agent into the discarded call

The `create-or-replace-groups` description (`hi-mcp/hi-mcp-server.ts:500-501`) says: "For a
requested part the library generates, use find-attributes to look for an enabling attribute on
the units; if available, enable it, then set the part's attributes after it is generated." The
image tests expect exactly that for the backsplash. Seven lines later (`:508`) the same description
says: "A call the library cannot calculate changes nothing." A generated part does not exist
before the load, so no check of the call can rule it out (D107 checks the article template and the
loaded group's attribute values), and the step the description promises — set the part's attributes
after it is generated — can never be reached when the whole group is discarded for it. This
sentence has to change with the fix: the part is enabled after the group is built, with
`change-group-attribute`, so a part the library cannot calculate discards that change and the group
stays.

### Side effects of the undo

- The undone step stays on the planner's redo history (D106 says so): the planner's redo button
  brings the vanished kitchen back, failed backsplash included.
- When the undo cannot be confirmed — the history event does not arrive within the wait, or the
  plan after it is not the plan before the call — `recorded` calls `markChangedInPlanner`
  (`tool-executors.ts:302`): every record is forgotten and the agent's own `undo` answers "The plan
  was changed in the planner …" until the next recorded call.

## Root cause

The discard of D106 runs at the wrong place and by the wrong means: `runToolCommand` reads the
library's verdict after the whole tool command, when the change has been loaded into the scene,
placed and given its group attributes (`hi-tool-commands.ts:1533`), and the tool set discards the
change with the planner's `undo` (`hi-mcp/tool-executors.ts:289-304`, thrown at `:458-460`). The
tools never use the group before the change, which they hold, and never withhold the load, which
they own; the scene shows the change and then its removal.

The verdict itself is right. What is wrong is when and how the tools discard the change.

## Why the current code is wrong

1. **The planning vanishes.** The load, the placement and the group attributes happen in the
   planner before the verdict is read, so the user sees the kitchen appear and disappear; the plan
   stays empty for a model step, and with a persistent library issue the cycle repeats. The user
   rules this out: a planning may be wrong and be changed or replaced, it may not vanish.
2. **It is not the discard that was decided.** "Nothing was changed" is true of the plan data after
   the undo, not of what the user saw, and the undone step sits on the redo history. The tools
   have the original group and the load in their hands and use an undo instead.
3. **It discards every group of the call for one root module.**
   [Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort) names the harm: "one wrong
   group discards every group of the call." D106 undoes the whole call — "also the groups of a
   create the library could calculate" — because one planner step is one undo. A discard per group
   before the load has no such constraint: the groups the library calculates are built, the one it
   cannot is left out and named, as `notLoaded` does for a group with an unknown article.
4. **It removes the object the repair needs, and the served text prescribes that repair.** The
   command tools work on a group of the plan; the recorded runs show the agent repairing a failed
   backsplash in one or two of them while the kitchen stands. After the undo there is nothing to
   repair, and the description's "enable it, then set the part's attributes after it is generated"
   cannot be followed.

## Proposed fix

### The decision: a planning does not vanish while it is adapted, improved or fixed

A new row in §3 of roomle-ui `hi-tools-behaviour.md` (the next number after D108), decided by the
user, under a new heading "A planning that stays":

> **A planning does not vanish while it is adapted, improved or fixed.** What stands in the plan
> stays until its replacement is calculated and loaded. No tool takes a planning out of the scene
> on its own initiative: a change the library cannot calculate is discarded by the tools before it
> is loaded — the group before the change is kept, the agent is told that nothing was changed —, a
> group that is replaced is swapped when the new calculation is loaded, and only the user, or the
> agent with `undo` and `delete-group` on the user's behalf, removes a planning. The agent is told
> to correct a group of the plan in place — the command tools, or a replace with the group's id —
> rather than to undo it and send it again. The glue logic is not part of the discard: it keeps and
> logs every calculation, the user's edits included (D95). Rejected: discarding a change the
> library cannot calculate with the planner's undo after the load — the whole call vanishes from
> the scene for one root module the agent could not foresee, the plan stays empty for a model step,
> and the undone step stays on the redo history.

D106 keeps its sentence — **a tool call the library cannot calculate changes nothing** — and gets
the mechanism the user asked for: the tools discard the change before the load, per group, and
answer "nothing was changed". Its rejected column takes the undo with the reasons above. D108 loses
"a call that makes one fail is reverted" and says "is discarded by the tools before the load"; D95
stays as it is.

### roomle-ui: the discard in the tool layer, before the load

The verdict is the one `newLibraryFailures` (`hi-tool-payload.ts`) gives for a group before and
after a calculation: a root module — a generated one included — or the group's own messages carry
an `Error` or `Fatal` message after the change and did not before. The tools read it before they
load, and restore through the glue logic's public API:

| Tool | The tool layer today | The discard |
|---|---|---|
| `create-or-replace-groups`, a new group | `_loadGroupLayout` (`hi-tools.ts:487`): `createOrReplacePosGroupsFromLayout` calculates the groups into the group map and returns them; the tools load them (`:494`) | before the load: a group the library could not calculate is not loaded and leaves the group map (`removedGroup(id)`, `glue-logic.ts:1804`); its outcome becomes `leftOut` with the library's sentence; the other groups of the call load as sent |
| `create-or-replace-groups`, a replace | the same place; the tools take `structuredClone(getGroup(id).posDataJson)` before the call | before the load: the group before the change goes back (`changedGroupFromHistory(previous, false)`, `glue-logic.ts:1818` — it calculates the previous group, stores it and notifies the host without a load), the group in the scene stays as it is; `leftOut` |
| the group attributes of a create; `change-group-attribute` and `change-module-attribute` on root modules — the `change-attributes` operation | `changeAttributes` (`hi-tools.ts:597`): `modifyAttributesOfModules` calculates (`:655`), the tools call `loadWithChangedAttributes` (`:659`) | between the two: the copy taken before the call goes back the same way, no load; the operation answers `changed: false` with the failures |
| `change-module-attribute` on a sub module; `change-group-attribute` with one attribute | `changeModuleAttribute` (`:506`) and `changeGroupAttribute` (`:561`) call `updateAttribute` and `modifyAttribute` of the glue logic, which calculate and load in one call | the tools route both through the two-step path of `changeAttributes` — `modifyAttributesOfModules` takes the same targets, sub modules included (`_attributeTargets`) — and the row above covers them |
| `merge-article-into-group`, `insert-article-into-group`, `delete-article-and-compact`, `swap-root-modules` | the tools change `groupItem.posDataJson` and call `arrangeAndLoad` (`glue-logic.ts:2876`), which calculates and loads in one call | the tools stage the change on a `structuredClone` of the group first, calculate the copy with the library (`getLibraryData(group).calculateGroup(copy)`, as `stageInteriorEdit` does), and change the real group and call `arrangeAndLoad` only when the verdict is clean; otherwise nothing runs — `changed: false` with the failures. One library calculation more per call |
| `exchange-root-module` | `swapRootModuleWithAttributes` of the glue logic builds the new root and calls `arrangeAndLoad` | the tools stage the exchange on a copy — the new root from `newPosDataFromId` and `inheritNeighbourAttributes` (both public) with the overrides, in place of the old one — and run the glue logic's exchange only on a clean verdict |
| `delete-article-in-place`, `merge-groups` | the kernel changes the plan first (`designerRequests.deleteRootModule`, `hi-tools.ts:695`; `designerRequests.mergeGroups`, `:846`); the glue logic calculates the reported group afterwards | to be confirmed: stage the remaining group, or the merged group, on a copy before asking the kernel; or report only (`calculationError`, D108) — a delete or a merge seldom makes a remaining unit fail |
| `delete-group`, `place-group`, `open-or-close-*` | no calculation | nothing to discard |
| the interior tools | staged on a copy, refused before the load (D96) | as they are — the model |

The restore through `changedGroupFromHistory` and `removedGroup` keeps the host informed (the
price, the group list) as the glue logic informs it after every change; the direct assignment of
the item's `posDataJson` and `lastCalculatedPosDataJson` — which the tools write already — is the
alternative, without the host's notification.

The failures reach the agent worded as today's G68 words them — "the library could not calculate
root module 'x' (ART) of group 'g' - " and the first line of the library's message — with "nothing
was changed" in front, per group:

- a create: `notLoaded` for the discarded group — `posGroups[i]: nothing was changed - the library
  could not calculate root module … - …; change the failing values or replace the article` —, the
  other groups of the call built; when every group is discarded, the call's error says so (the
  existing "No groups were created or replaced" with the sentences);
- the group attributes of a create: a correction — `posGroups[i]: the group attributes were not set
  - the library could not calculate … - …` —, the group stays as loaded;
- every other tool: the error result `<tool>: nothing was changed - the library could not calculate
  … - …. Change the failing values or replace the article, and send the call again.`, with
  `changed: false`, so `runToolCommand` counts no step and nothing is recorded for undo.

`runToolCommand` keeps reading the verdict after the call (`libraryFailures`) as the safety net for
the two kernel-first paths and for a follow-up calculation; it is reported, never undone.

### roomle-ui: the tool set

`hi-mcp/tool-executors.ts`: `inPlanner` (`:445`) no longer throws for `libraryFailures`; the `catch`
of `recorded` (`:289-304`), `LibraryFailure` (`:163`) and `discardedCall` (`:172`) go; `clearUndone`
of `hi-mcp/plan-history.ts:107` becomes unused and goes. A result's `libraryFailures` — the safety
net — is passed to the agent beside `corrections` and `hint`.

### roomle-ui: the served text

`hi-mcp/hi-mcp-server.ts`:

- `:45`, `:508`, `:611`, `:649`: "A call the library cannot calculate changes nothing" stays and
  says where the answer is: for a create in `notLoaded` per group, the other groups built; for the
  other tools the error result.
- `:500-501`: a part the library generates is enabled after the group is built, with
  `change-group-attribute`; a part the library cannot calculate discards that change and the group
  stays; the answer reports the omission.
- The "Undo a wrong result" rule (`:44`) gets one sentence for the decision: a group of the plan
  that should be different is sent again with its id, or edited with the command tools; the plan
  keeps the group until the replacement is loaded. (The recorded run `69` shows the other path: the
  agent's own `undo` after its first create, then a second create — the plan was empty between
  them.)

### roomle-ui: tests

- `__tests__/hi-tools-test.ts`, with the real glue logic as `it('reports the root module of a
  replace the library could not calculate through the real glue-logic')` (`:3839`) runs it: a
  layout load whose generated root fails loads nothing (`loadPosGroups` is not called), the glue
  logic's groups are as before, the outcome is `leftOut`; a replace whose new calculation fails
  leaves the previous group in the group map and loads nothing; `changeAttributes` restores and
  loads nothing; a `mergeArticleIntoGroup` whose staged calculation fails calls `arrangeAndLoad`
  not at all and answers `changed: false`. The `libraryFailures` tests (`:352`, `:407`, `:575`)
  become tests of the discard.
- `__tests__/glue-logic-test.ts`: untouched — the glue logic keeps and logs a failed calculation.
- `__tests__/hi-tool-commands/run-tool-command-test.ts:242`, `describe("the library's verdict")`:
  stays for the safety net; a new case: a discarded operation makes no step.
- `__tests__/hi-tool-commands/create-or-replace-groups-input-test.ts`: a discarded group in
  `notLoaded`, the other groups built.
- `__tests__/hi-mcp/tool-executors-test.ts:2351`, `describe('a call the library could not
  calculate')`: the four tests of the undo (`:2352`, `:2370`, `:2384`, `:2396`) go; one test that a
  result with `libraryFailures` is passed on and recorded like any other.
- `__tests__/hi-mcp/hi-mcp-server-test.ts`: the served sentences.
- A model-free replay of the reproduction above on the fixed build: the create answers with
  `notLoaded` and the group count never changes; the create without the backsplash is built; a
  `change-group-attribute` that enables the backsplash on the built group answers "nothing was
  changed" and the kitchen stays.

### Documentation

- roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md`: the new decision, D106, D108, G68
  (`:1137`), §2.3 (`:92-96`), the mentions at `:458`, `:813`, `:826`, `:835`, `:905`;
  `hi-tools-reference.md` (`:236-238`, `:375-376`); `library-errors.md` (§The HI tool commands, §The
  HI tools, `:87`, `:116`, `:267`, `:277`, `:328`); `tool-executors.md` (`:187`, `:195`, `:295`,
  `:370`).
- roomle-hi-example: the wiki page (the short answer, the table row "A value the library cannot
  calculate", the section "A failed calculation of the agent's change is discarded, the user's is
  kept" — it describes the undo and calls it a guard);
  [library-calculation-gaps.md](../backlog/library-calculation-gaps.md) (`:11-12`, `:44`); the
  backlog README's test item "The models after a call the library cannot calculate" (it checks the
  resent create on a build with the discard before the load); [mcp-issues.md #107](../backlog/mcp-issues.md#107-a-reverted-exchange-names-the-root-module-id-of-the-unit-it-took-back)
  (the exchange is discarded before the load — the item is verified against that and removed or
  rewritten); `.agents/skills/hi-mcp-tools.md` (`:321-323`); `.agents/skills/hi-mcp-testing.md`
  (`:313`). [Library issue 93](../backlog/library-issues.md#93-backsplashes-the-library-cannot-calculate)
  is updated to the discard of the attribute change.

### To be confirmed by the user (D51)

1. **The decision above and the mechanism of D106** — the tools discard before the load, per group,
   and restore through `changedGroupFromHistory` and `removedGroup`; the glue logic stays as it is.
2. **`delete-article-in-place` and `merge-groups`**, where the kernel changes the plan before the
   library calculates: stage the resulting group on a copy before asking the kernel, or report only
   (D108) — a delete or a merge seldom makes a remaining unit fail, and no undo is run either way.
3. **The sentence in the "Undo a wrong result" rule** — a served-text change beyond the discard,
   proposed because the decision covers the agent's own undo-and-resend as well.

### What is not reverted

None of today's other work: D105 (verified by the control), D107 (independent, it prevents part of
the failures), D108 (the failed root module the user's edits leave stays visible), the verdict of
`runToolCommand` (the safety net) and the `Fatal` message of `_calculate`. The fix moves the
discard of `6512f5890` from the tool set's undo into the tools, before the load, and rewrites its
served sentences and its documents. The glue logic is not changed.
