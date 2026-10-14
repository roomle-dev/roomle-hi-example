# RML-18164: the six improvements of the kitchen-from-image benchmark — implementation plan

> **Type**: Feature analysis and implementation plan (steps 2 and 4 of the [change workflow](../../AGENTS.md#suggested-change-workflow))
> **Analysis**: [kitchen-from-image-time.md](../benchmarks/kitchen-from-image-time.md), section 9 — the second measurement, its six flaws and improvements
> **Backlog**: [one-undo-step-per-tool-call.md](../backlog/one-undo-step-per-tool-call.md) — its three to-dos are the steps 2a, 2b and 2c of improvement 2
> **Trigger**: [RML-18164](https://roomle.atlassian.net/browse/RML-18164) "hi mcp - implement performance improvements", created from [RML-18064](https://roomle.atlassian.net/browse/RML-18064)
> **Date**: 2026-10-14
> **Author**: AI Assistant
> **Status**: Open — reviewed 2026-10-14: performance only, no change of the planner's behaviour (improvement 5 is a rule sentence); nothing implemented, no run made
> **Branches**: roomle-hi-example `feat/rml-18164-kitchen-from-image-improvements` (from `master`, 63970bb); roomle-ui `feat/hi-kitchen-from-image-improvements-RML-18164` (from `release/bo-test`, 56256a5b7 — the HI commits since `fix/hi-mcp-api-and-tools` are on `release/bo-test` and not on `master`)

## Affected repositories

- **roomle-hi-example** — the MCP server: the attribute vocabulary as a default section of
  `get-plan-context` (1), the end of the follow-up wait in the undo accounting (2), the served text
  about `desc` and `articleDescriptions` (4); the unit tests, the living documentation, the
  benchmark rounds and their results.
- **roomle-ui** — the HI tool commands (`packages/web-sdk/packages/homag-intelligence`): every
  command resolves after its last reload and reports no follow-ups (2b), shorter library-change and
  `notLoaded` sentences (6); the planner
  (`packages/web-sdk/packages/planner-core`): a tool call is one planner undo step (2c); the unit
  tests and the embedding documentation. Developed locally: `npm run dev` on port 5173, the example
  with `--dev`.
- **ligna-store** — no change. Its chat takes the tools and their text from the server, its page
  bridge forwards `externalObjectGroupOperation`, and it gets the command changes with the planner it
  embeds.
- **The library data** — improvement 3 is a library issue
  ([library-issues.md](../backlog/library-issues.md), item 64); this plan implements nothing for it
  ([2.3](#23-improvement-3--the-sizes-an-article-takes)).

---

## 1. What was asked and why

The ticket: implement the six improvements of the second measurement
([kitchen-from-image-time.md §9.6](../benchmarks/kitchen-from-image-time.md#96-proposed-improvements)),
one after another; after each one check the results, measure the performance gain and verify with a
very small set of tests that the change is stable. The measurement: gpt-6-astra needs 57 s, 5.8
steps and 321k input tokens per run on the four kitchen-from-image tests; the six improvements are
expected to save about 20 s and 2 steps.

This document is the plan: per improvement what the code does today, what changes, the unit
tests, the check after it; then the order, the runs and their cost. The ticket is about
performance: the served text, the results and the time a call takes change, the planner's
behaviour does not — the one exception is the backlog item the user asked to include (2c).

## 2. How the area works today, and what changes

### 2.1 Improvement 1 — the vocabulary in the plan context

**Today.** `get-plan-context` (`hi-mcp/hi-mcp-server/tool-executors.ts`) returns `rooms`, `articles`,
`groups` and `obstacles` by default; the attribute vocabulary is in `masterData`, returned only on
request, and `find-attributes` searches it (D64). The catalog shows each root module's
`mainAttributes` with bare values (`mod_FrontColor` "152") and no value list. The rules say
"Attribute ids and their values come from the masterData section (request it with include) or from
find-attributes" (`AUTHORING_RULES`, `hi-mcp-server.ts`); the instructions' step 1 says "Add
masterData to include for the attribute vocabulary, or look an attribute up with find-attributes".
A model that follows them searches, one property per step: 1.5 search-only steps and 12.5 s per
run with gpt-6-astra, 3–6 steps with gpt-5.4-mini (§9.5.1 of the benchmark).

The compacted master data of roomle-ui (`compactMasterData`, `hi-plan-context.ts`): per library the
20 root modules (article roots and generated roots), the 61 customer-facing attributes assigned to
them (`isMain` or `userRight` Simple: `id`, `name`, `desc`, `imageUrl`, `type`, `group`,
`selections` with `value`, `name`, `desc`, `imageUrl`) and the group settings. Measured on
`docs/library-information/master-data.json`: the 61 attributes without images are 31,219
characters; with a value list several attributes share listed once 20,119 characters, about 5.2k
tokens (live on 2026-10-13: 20,950); 38 attributes carry a value list, 28 distinct lists, the colour
list of 21 values shared by nine attributes.

**Change (D76).** A new section `attributes`, in the default sections: per library id, as
`masterData` is keyed, the customer-facing attributes with `id`, `name`, `desc`, `group`, `type` and
`selections` (`value`, `name`, `desc` — no `imageUrl`, D7); a value list an earlier attribute of the
library already lists is replaced by `sameSelectionsAs`, as `find-attributes` does (D64). No
modules and no group settings: they stay in `masterData`, on request. The server fetches
`masterData` from the planner when `attributes` is in the request and derives the section
(`agentFacingAttributes` in `agent-facing.ts`, `withSharedSelectionsOnce` generalised to it);
`masterData` requested beside it is returned as it is from the same planner call.

The served text says where the vocabulary is: the rules sentence becomes "Attribute ids and their
values are in the attributes section of get-plan-context — every customer-facing attribute with its
values; a value list several attributes share is listed once, sameSelectionsAs names the attribute
that lists it; the desc of a colour value carries its code. find-attributes answers a question about
one attribute"; the instructions' step 1 names the section; the `get-plan-context` description and
its `include` description describe it; the `find-attributes` description starts with "Searches the
attribute vocabulary that get-plan-context returns in its attributes section".

### 2.2 Improvement 2 — no wait for an event that does not come, and an undo that works

**Today.** A tool command in roomle-ui (`runToolCommand`, `hi-tool-commands.ts`) reports
`historySteps`, one per load that loaded something and one per group operation, and
`historyFollowUps`, one per group operation of `FOLLOW_UP_COMMANDS` (`change-module-attribute`,
`change-group-attribute`, `change-attributes`, `exchange-root-module`, `insert-article-into-group`,
`swap-root-modules`) and per `remove-article-from-group` that closed the gap — the commands whose
load the kernel answers with the group's position (`respondWithPositionInPlan`, roomle-ui
`roomle-planner.ts`), after which roomle-ui reloads the group once more
(`changedGroupPlanningSituation`, `glue-logic.ts`, reason `PLAN_CHANGED`). The server
(`countingPlannerApi`, `tool-executors.ts`) waits up to 2 s (`FOLLOW_UP_WAIT_MS`) for
`historySteps + historyFollowUps` history events, records the call unsettled when they do not come,
and `undo` of an unsettled call waits 2 s more and undoes nothing (`STILL_FINISHING`).

**The runs.** In the sessions of 2026-10-11 and 2026-10-13, 13 of 16 plan-changing calls spend
2.0–2.6 s in the server beyond their planner calls (§9.5.2); live, a create with group attributes
answered at 445 ms with its three events relayed by then, and the server read the groups at
2,558 ms. None of the 6 calls of 2026-10-08 waited. `swap-root-modules` of 2026-10-13 took 0.8 s:
its follow-up event arrived.

**Hypothesis.** roomle-ui dc96fa1f4 (2026-10-10, "await attribute planning updates before returning
groups") runs the attribute operations inside the kernel-operation slot (`_requestKernelOperation`,
`hi-tools.ts` `changeAttributes`, `modifyRootModuleAttribute`, `modifyGroupAttribute`): the
operation resolves after its reload has landed, so the step is committed before the command answers
and no history event follows it — while `runToolCommand` still reports one follow-up. The deployed
bo-test planner got dc96fa1f4 between the sessions of 2026-10-08 (no waits) and 2026-10-11
(waits). The commands outside the slot — exchange, insert, swap, the gap-closing remove — still
reload after they resolve. The runs record neither the counts nor the events, so this is the
hypothesis the first step of the improvement checks live ([6.2](#62-improvement-2)).

**The backlog item.** [one-undo-step-per-tool-call.md](../backlog/one-undo-step-per-tool-call.md)
describes the same workaround from the planner's side and asks for three things in roomle-ui:
(1) trace the history events of a colour command against the server's expected count — step 2a;
(2) `externalObjectGroupOperation` resolves after the command's follow-up reload — step 2b;
(3) one planner undo step per tool call, so that the planner's own undo button and the server's
`undo` revert a kitchen with its materials in one step instead of three — step 2c. Its description
predates the 2026-10-10 commit (it still says the attribute commands resolve before their reload)
and D71 (it plans begin and end methods on the page allow-lists; since the whole tool runs inside
one `externalObjectGroupOperation`, the grouping needs no new page method). The item is closed with
step 2c: it leaves the backlog once the roomle-ui change is on `release/bo-test` or `master`.

**Measured (step 2a, 2026-10-14, local planner, `default-room`).** Every follow-up command answered
after its reload with exactly its steps' events before the answer and none within 3 s after it: the
create with a wall placement and ten group attributes 3 steps (events at 328, 857 and 1,701 ms,
the answer at 1,697 ms) with 1 follow-up reported; `change-module-attribute`,
`change-group-attribute`, `exchange-root-module`, `insert-article-into-group`, `swap-root-modules`
and `delete-article-and-compact` 1 step each, 1 follow-up reported, one event before the answer.
The server's own time was 2.0 s on each of them (tool time minus planner time), and `undo` after
each waited 2.0 s and undid nothing ("has not finished the last change yet"); `place-group`, which
reports no follow-up, was undone in 0.5 s. The hypothesis holds, for the commands outside the
kernel-operation slot too: no command needs wrapping, roomle-ui only stops reporting follow-ups.

**Change (D77, step 2b).** The planner answers a tool command settled: every command resolves after
its last reload — exchange, insert, swap and the gap-closing remove run in the kernel-operation
slot as the attribute commands do —, `runToolCommand` reports no follow-ups (`FOLLOW_UP_COMMANDS`
and `hasFollowUp` go; `historyFollowUps` leaves `HiToolCommandResult` and the typedoc of
`externalObjectGroupOperation`), and the
server counts `historySteps` only: the follow-up wait, `followUpEvents`, `lateFollowUps`,
`expectLateFollowUp`, `settleLastDone`, `settled` and `STILL_FINISHING` go; `recorded` records every
call settled, `revertToolCall` loses its unsettled branch; a `historyFollowUps` in a result is
ignored, so an older planner changes nothing. Should the live check find a command whose event
still lands after it resolves and that cannot run in the slot, the server keeps a wait for that
command alone, named in the plan's result.

**Change (D79, step 2c).** A tool call is one planner undo step. Today every HI load with a reason
other than `load`, `plan_changed`, `position_changed`, `split`, `swap_group` and
`merge_with_dragging` starts a step of its own (`_interactionBeforeLoadingExternalObjectGroups`,
`roomle-planner.ts` → `manageExternalObjectLoadingStart` → `_hold` without `resume`,
`plan-interaction-manager.ts`), so a create with a wall placement and materials makes three steps:
the load, the reload at the wall, the `change-attributes`. The planner already pins one interaction
across several operations for a product swap: `replaceObject(elementId, perform)` holds the step,
the operations inside resume it, the last release commits it (`describe('replaceObject')` in
`planner-core/__tests__/plan-interaction-manager.ts`). `externalObjectGroupOperation`
(`roomle-planner.ts`) runs an HI tool command (`HI_TOOL_COMMANDS`) the same way: the interaction
manager holds a step for the call, `manageExternalObjectLoadingStart` and
`manageExternalObjectLoadingEnd` resume and keep that step while it is held instead of committing,
and the end of the call releases it — one commit, one history event, one undo for the user and
for the server; a call that throws after it changed the plan is released in a `finally` as
`replaceObject` is, so its half-done change is one step too. The group operations the planner
runs directly (D3) are one step today and stay as they are. `runToolCommand` reports
`historySteps` 1 when it changed the plan and 0 when it did not;
the server's accounting stays as it is and simply gets 1. Constraints from the item: the undo
history is shared with the user, and a plan load clears it without an event — unchanged.

### 2.3 Improvement 3 — the sizes an article takes

**Evaluation.** The master data gives a dimension attribute no value list and no range:
`mod_Height`, `mod_Width` and `mod_Depth` are type Dim without `selections` (as 21 of the 24 Dim
attributes; `mod_PlinthAreaHeight` has 9 values, `mod_IslandBackwallWidth` and `mod_GroupWidth`
one each — these come with improvement 1). There is nothing to pass through, and the sizes a
flip-lift wall cabinet takes are in the library's hands: the descs (library issue 64, reported to
the HOMAG library team). **No code change, no run.** The duplicated `notLoaded` sentences of that
case are improvement 6.

### 2.4 Improvement 4 — say what `desc` covers

**Today.** The `include` description says "articleDescriptions for the full descriptions of the
articles", the tool description "(per article its full description: purpose, placement,
requirements, neighbours, restrictions, style) is returned only when included explicitly". A model
that is to pick articles from a photo asks for everything: 4 of 12 runs request the section in their
first step, 22k tokens more in every later step (§9.5.4).

**Change (D63 amended).** Both descriptions say that `desc` — what the article is and when to pick
it — is enough to choose an article, and that `articleDescriptions` answers a question about one
article's requirements and neighbours and is not needed to plan. Served text only.

### 2.5 Improvement 5 — a group moved after the create

**Today, and what the data shows.** The analysis names as the cause that the placement by wall
keeps clear of the walls and the obstacles but not of a group of the same call. The code says
otherwise: `placeAtWalls` (`hi-tool-commands.ts`) places the groups of a call one after another and
adds each placed group to the `others` the next one is tested against (`wallTarget`,
`hi-wall-placement.ts`). The three image-only runs show the real obstacle: the left group — the
tall-unit run, 622 mm deep — is placed in the back left corner (`wall: left, alignment: back`), and
the back wall has a window 235–2,335 mm from that corner (sill 950 mm): the first unit stands in the
600 mm strip in front of the window's first 387 mm. The right group (1,220–2,020 mm wide, back right
corner) overlaps nothing. The create built the groups as sent; its `hint` named the root module in
front of the window (D55, `obstacleHint`, `hi-tool-hints.ts`), and the model moved the left group
650–800 mm along the left wall with `place-group` — one step, 8 s, in all three runs. The hint text
is not logged (gap of §9.8); the first step of the improvement reproduces the create live and reads
it ([6.5](#65-improvement-5)).

**Change (served text).** The placement stays as it is. The rules' obstacle paragraph tells the
agent what the three runs show it did not derive from the obstacles it was given: a group placed in
a room corner reaches along the adjoining wall by its depth, so a door or a window within that depth
of the corner on the adjoining wall is in its way — choose the other corner, or an offsetMm past
the opening's span; base units lower than a window's sill fit below it (already there). The agent
then places the group right in the create instead of moving it in a second step.

### 2.6 Improvement 6 — shorter create results

**Today.** A library-change sentence (D59, `libraryChangeSentences`, `hi-tool-attributes.ts`) lists
every root module changed alike by id and article: "with its group attributes the library changed
mod_HardwareColor of root modules 'cdf317ec-…' (HK260), 'a9c8291b-…' (SUT60), … to "WhiteColor"" —
about 1,000 characters each, ten of them in one create of the right-wall test. A root module the
library cannot calculate gets one `notLoaded` error each (`readLoadOutcomes` in `hi-tool-payload.ts`
for a restored replace, the `failedRoots` loop of the create command), five identical sentences
of 430 characters for five flip-lift cabinets. A create result reaches 22.9k tokens (§9.5.6).

**Change (D59 and D73 amended).** A library-change sentence names the root modules by article and
count — "of 7 root modules (HK260, SUT60, UHS60, US2A30, OFKB60 ×2, OTB30)", "of every root module"
when it hit all of them; the ids are in `groups`. A `notLoaded` entry has one error per cause: the
root modules that failed with the same first diagnostic line in one sentence — "the library could
not calculate root modules 'w1', 'w2', 'w3' (OSKB60 ×2, OSKB90) of group '…' - <diagnostic>. Check
…" — and `rootIds` as today.

## 3. The gap

Six flaws cost the agent steps and tokens; four are the server's served text and results (1, 4)
or the planner's command results (6), one is the planner's history accounting (2), one is the
served rules about obstacles (5). Improvement 3 is the library's.

## 4. Proposed design

The changes of section 2, implemented in the order of [section 9](#9-implementation-plan), each
one checked before the next. The decisions D76, D77 and D79 go into §3 of
[hi-mcp-behaviour.md](../../docs/hi-mcp-behaviour.md) under a new heading "Vocabulary and results
(2026-10-14)"; D59, D63 and D73 are amended in place.

## 5. Alternatives considered and rejected

| Alternative | Why not |
|---|---|
| The vocabulary section built in roomle-ui (`getExternalObjectPlanContext`) instead of the server | The server already derives `articleDescriptions`, the wall names and the corners from the planner's sections, and the shared-list logic exists in `find-attributes`; a server-side section reaches the ligna-store without a planner deployment |
| `rootModules` per attribute in the vocabulary, as `find-attributes` reports them | 61 attributes × up to 20 module ids, about 10k characters more in every step; the catalog's `mainAttributes` show which attributes a root module carries, and an attribute's `group` ("Countertop \| Design") says what it belongs to; `find-attributes` keeps the root modules for a question |
| The colour, program, handle and plinth attributes only (3.1k tokens) | The server would choose per library which attributes matter — library knowledge the policy forbids (§2.4 of hi-mcp-behaviour.md) |
| The server stops waiting and keeps `historyFollowUps` as an "events that may come late" count | The late-event bookkeeping (`lateFollowUps`, `settled`) stays for a case the planner no longer produces once every command resolves settled; simpler to make the planner's answer the truth |
| The begin and end methods of the backlog item on the page allow-lists, called by the server around each tool call | Two more page methods and bridge calls per tool call; since D71 the whole tool runs inside one `externalObjectGroupOperation`, which can hold the step itself |
| The server undoes a call's steps one by one, as today, and the planner keeps a step per load | The user's undo button reverts a kitchen with materials in three clicks, the first leaving it without its materials — the backlog's own problem |
| Improvement 5 as a change of the placement by wall — the group moved along its wall away from an opening, with a correction | A change of the planner's behaviour; the ticket is about performance. The agent has the opening in the obstacles section and chooses the place itself |
| A create that drops an override the library cannot calculate on a new root module (improvement 3) | The same: a change of the planner's behaviour, and the user may want exactly that size |
| Improvement 6 without the root module ids anywhere | The ids stay in `groups` and in `notLoaded.rootIds`; only the sentences drop them |

## 6. Tests

Every improvement brings its unit tests with the code; the suites: roomle-hi-example
`hi-mcp/hi-mcp-server/tests/tool-executors.test.ts`, `hi-mcp-server.test.ts`,
`plan-history.test.ts`; roomle-ui `homag-intelligence/__tests__/hi-tool-commands/*.ts`,
`hi-tools-test.ts`, `hi-wall-placement`/`hi-plan-space-test.ts`.

### 6.1 Improvement 1

`tool-executors.test.ts`, `describe('get-plan-context')`:

1. **returns the attribute vocabulary by default, without images, a shared value list once** — the
   default request fetches `masterData` from the planner too; the result has `attributes` keyed by
   library id and no `masterData`; no `imageUrl` on attributes or values; the second attribute with
   the same list carries `sameSelectionsAs` and no `selections`.
2. **returns masterData as it is beside the vocabulary when both are requested** — one planner call.
3. **keeps the vocabulary out when the request names other sections** (`include: ['rooms']`).
4. Adapted: 'passes the plan context through with the default sections' (the default list), 'passes
   only the explicitly requested sections through'.

`hi-mcp-server.test.ts`:

5. **tells the agent that the attribute vocabulary is in the plan context and that find-attributes
   answers a question** — the rules sentence, the instructions' step 1, the `include` description,
   the `find-attributes` description.

### 6.2 Improvement 2

The live check first (no model; the launcher on spare ports with `--dev`, headless Chromium, the
bridge frames logged with their time): per command the history events before and after it resolves,
its `historySteps` and `historyFollowUps` — create with a wall placement and three group attributes,
`change-module-attribute`, `change-group-attribute` with two attributes, `exchange-root-module`,
`insert-article-into-group`, `swap-root-modules`, `delete-article-and-compact` that closes the gap,
and `undo` after each. The result goes into this document ([8](#8-decisions-taken-in-the-plan) decides the rest
of the change) before the code changes.

roomle-ui, `hi-tools-test.ts` / `glue-logic-test.ts`:

6. **exchange-root-module resolves after the reload the kernel's position answer causes** —
   `loadPosGroups` spied: the `PLAN_CHANGED` reload is awaited before the result; the same for
   insert, swap and the gap-closing remove (one test each, or one parameterised).

`__tests__/hi-tool-commands/run-tool-command-test.ts`:

7. **reports the steps of a command and no follow-ups** — replaces 'counts the follow-up reload of a
   command that reloads the group'; 'answers a tool that fails after it changed the plan …' and
   `hi-tools-test.ts` line 2544 adapted.

roomle-hi-example, `tool-executors.test.ts`, `describe('undo and redo')` — the fake planner loses
`followUpDelayMs`/`followUpDelaysMs`:

8. **records a call as soon as it resolves, whatever follow-ups its result reports** — a result with
   `historyFollowUps` 1 and no further event: the call returns without a wait, `undo` reverts it
   with its steps.
9. **reverts an attribute change right after it with one planner undo**.
10. Removed: 'withholds undo while the follow-up reload …', 'undoes a call once its late follow-up
    …', 'waits for the follow-up reload of a delete …', "takes a follow-up that lands after the wait
    …", 'expects every follow-up reload …', 'waits for the follow-up reload of an attribute change',
    'waits for a follow-up reload at most two seconds', 'does not wait after a command without a
    follow-up …'; `plan-history.test.ts` loses the late follow-up tests.

Step 2c, roomle-ui `planner-core/__tests__/plan-interaction-manager.ts` and `roomle-planner.ts`:

10a. **runs an external object group operation as one undo step** — a load, a reload with reason
     `adjusted` and a load with reason `change_attribute` inside the operation: `startInteraction`
     once, `commit` once, one `planHistoryStateChanged`.
10b. **commits the step when the operation throws after a load** — the `finally` release.
10c. **leaves a group operation the planner runs directly as one step** (D3, unchanged).
10d. **does not group the loads outside a tool call** — a plain `loadExternalObjectGroupLayout`
     still starts its own step.

`homag-intelligence/__tests__/hi-tool-commands/run-tool-command-test.ts`:

10e. **reports one step for a tool call that changed the plan and none for one that did not** —
     adapts 'counts every group command as an undo step' and 'counts a load that loaded something
     as an undo step'.

roomle-hi-example `tool-executors.test.ts`: 'reverts a kitchen with three materials with two planner
undos' and 'reverts a new group placed by wall, its load and its reload, in one undo' become
**reverts a create with materials and a wall placement with one planner undo**; the fake planner's
step model (`historyPlanner`) answers one step per call.

### 6.3 Improvement 3

None — no code change.

### 6.4 Improvement 4

`hi-mcp-server.test.ts`:

11. **tells the agent that desc suffices to pick an article and what articleDescriptions is for**.

### 6.5 Improvement 5

The live reproduction first: the create of run 48 of 2026-10-13 (two groups, left and right wall,
both `alignment: back`, on `default-room`), the hint read, the positions measured.

`hi-mcp-server.test.ts`:

12. **tells the agent that a corner group reaches along the adjoining wall by its depth and that an
    opening there is in its way**.

### 6.6 Improvement 6

roomle-ui, `group-commands-test.ts` `describe('library changes')` and
`create-or-replace-groups-placement-test.ts`:

13. **names the root modules the library changed alike by article and count** — adapts 'names the
    root modules the library changed alike in one sentence'; "every root module" when all.
14. **reports the root modules the library could not calculate for the same reason in one error** —
    adapts 'reports a replace the planner restored, with the root module the library could not
    calculate' and 'passes on the root module the library could not calculate with the group
    attributes'; two causes give two errors.

### 6.7 The check after every improvement

The same small set every time, on one build and the local planner: the four kitchen-from-image
tests (`image-kitchen-left-wall`, `image-kitchen-back-right-corner`, `image-planning-right-wall`,
`image-only-no-text`) with gpt-6-astra, twice each — 8 runs, two sessions of the runner (the test
ids of a session are unique), about 15 minutes, about 2.6M input tokens
([hi-mcp-benchmarking.md](../skills/hi-mcp-benchmarking.md)):

```bash
for rep in a b; do
  SESSION=".temp/result/benchmark-rml-18164-<step>-$rep"
  mkdir -p "$SESSION"
  jq '.randomTests = 0 | .models = [{ "provider": "gpt-6-astra", "apiKey": "$AZURE_GPT_KEY" }]
      | .tests |= map(select(.id | startswith("image-kitchen") or . == "image-planning-right-wall" or . == "image-only-no-text"))' \
    docs/test-prompts.json > "$SESSION/tests.json"
  node .agents/scripts/run-hi-mcp-tests.js "$SESSION/tests.json" --out "$SESSION" --dev > "$SESSION/runner.log" 2>&1
done
node .agents/scripts/benchmark-hi-mcp-runs.js .temp/result/benchmark-rml-18164-<step>-a .temp/result/benchmark-rml-18164-<step>-b \
  --out .agents/benchmarks/kitchen-from-image-time-rml-18164/<step>
```

Compared with the round before, per test: chat seconds, steps, input tokens; the search-only steps
(1), the tool time of the plan-changing calls and the `undo` calls (2), the first step's result
tokens and `articleDescriptions` requests (4), a `place-group` after the create (5), the result
tokens of the creates (6). **Stable** means: every run
creates the planning its test asks for (the top and perspective images, the group attributes in the
create args), no correction, error or `notLoaded` the round before did not have. A regression stops
the next improvement until it is understood ([a-fix-must-not-break-another-model](../../AGENTS.md)
applies to the other models only on the user's request — see [7](#7-code-and-documents-the-work-touches)).

The smaller variant, on the user's word: one run per test, 4 runs, about 8 minutes and 1.3M tokens
per round — no spread, so a difference under about 15 s per test says little.

## 7. Code and documents the work touches

| Repository | File | Change |
|---|---|---|
| roomle-hi-example | `hi-mcp/hi-mcp-server/tool-executors.ts` | 1: the section `attributes` (default, derived from `masterData`); 2: `countingPlannerApi`, `recorded`, `revertToolCall` without the follow-up wait |
| | `hi-mcp/hi-mcp-server/agent-facing.ts` | 1: `agentFacingAttributes` |
| | `hi-mcp/hi-mcp-server/plan-history.ts` | 2: `lateFollowUps`, `expectLateFollowUp`, `settleLastDone`, `settled` removed |
| | `hi-mcp/hi-mcp-server/hi-mcp-server.ts` | 1: rules, instructions, `get-plan-context` and `find-attributes` descriptions; 4: the `desc`/`articleDescriptions` sentences; 5: the rules' obstacle sentence |
| | `hi-mcp/hi-mcp-server/tests/*.test.ts` | the tests of [6](#6-tests) |
| | `docs/hi-mcp-behaviour.md` | D76, D77, D79 new, D59, D63, D73 amended; §4 (the follow-up paragraph, one step per call), §5.1, §5.2 (the obstacle sentence), §5.4 (`attributes` row), §6 (`get-plan-context` include, `find-attributes`, `undo`), §8.3 (the sentences of 6), §8.8 (the unsettled row goes) |
| | `docs/hi-mcp-server.md`, `.agents/skills/hi-mcp-tools.md` | `get-plan-context`, `find-attributes`, the create result and `undo` sections |
| | `.agents/backlog/one-undo-step-per-tool-call.md` | 2: all three to-dos are steps 2a–2c; the item is deleted once the roomle-ui change is on `release/bo-test` or `master` ([backlogs hold only open work](../backlog/README.md)); until then its status names this plan |
| | `.agents/benchmarks/kitchen-from-image-time.md` | section 10: the baseline and the round per improvement, before/after per test; `kitchen-from-image-time-rml-18164/<step>/` the benchmarks |
| roomle-ui | `homag-intelligence/src/hi-tools.ts` | 2: exchange, insert, swap, the gap-closing remove in the kernel-operation slot |
| | `homag-intelligence/src/hi-tool-commands.ts` | 2: `FOLLOW_UP_COMMANDS`, `hasFollowUp`, the follow-up count go; 6: the `failedRoots` errors once per cause |
| | `homag-intelligence/src/hi-plan-context.ts`, `external-object-api.ts` | 2: `historyFollowUps` removed; `historySteps` 1 or 0 (2c) |
| | `planner-core/src/roomle-planner.ts`, `planner-core/src/services/plan-interaction-manager.ts` | 2c: `externalObjectGroupOperation` holds one step for an HI tool command; the external-object load start and end resume and keep a held tool-call step |
| | `planner-core/__tests__/plan-interaction-manager.ts`, `roomle-planner.ts` | tests 10a–10d |
| | `homag-intelligence/src/hi-tool-attributes.ts`, `hi-tool-payload.ts` | 6: the sentences |
| | `homag-intelligence/__tests__/…` | the tests of [6](#6-tests) |
| | `embedding-lib/docs/homag-intelligence-embedding.md`, `.agents/homag-intelligence.md` | 2: the result fields and the undo paragraph; 6: the sentences |

Not in this plan, on request only: the like-for-like runs of the other three models (24 runs,
about 60 min, about 8M tokens), a full "test the mcp" at the end (54 runs with gpt-6-astra, about
35 min).

## 8. Decisions taken in the plan

No open question. The internal choices, decided here:

- The vocabulary section is named `attributes`, is in the default sections, keyed by library id,
  without the modules and the group settings (D76).
- `historyFollowUps` leaves the command result and the typedoc; the server ignores it when an older
  planner still sends it (D77).
- After step 2c the command reports `historySteps` 1 or 0 and the server's accounting stays as it
  is (D79).
- A library-change sentence names the root modules by article and count; the ids are in `groups`
  (improvement 6).
- The check set runs twice per round, the benchmarking rule's minimum for a comparison.

## 9. Implementation plan

Each step ends with its check; a step starts only when the one before is green. Runs happen only
in the steps that name them, with the set of [6.7](#67-the-check-after-every-improvement).

| # | Step | Repositories | Verify |
|---|---|---|---|
| 0 | **Baseline, like for like**: the set of 6.7 on the current build — roomle-hi-example master (63970bb), roomle-ui `release/bo-test` (56256a5b7), local planner | — | 8 runs valid (no chat error); `benchmark.md` of the baseline written; the numbers against §9.4.1 of the benchmark |
| 1 | **Improvement 1**: the section, the served text, tests 1–5, the docs | roomle-hi-example | `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check` green; live without a model: the section's size on `default-room` (about 20k characters), `masterData` unchanged; the set of 6.7: search-only steps near 0, chat s and steps down, the group attributes of the creates with real ids and values |
| 2a | **Improvement 2, the bug analysis**: the live history-event check of 6.2; the result and the decided change into this document and the ticket | — | per command: events before and after the resolve, steps, follow-ups |
| 2b | **Improvement 2, settled commands**: roomle-ui the slot for the remaining commands and no follow-ups, the server without the wait, tests 6–10, the docs | roomle-ui, roomle-hi-example | roomle-ui `CI=true npm run test -- --run packages/homag-intelligence` in `packages/web-sdk` and its lint; roomle-hi-example suite green; live: a create with materials, `undo` reverts it (three planner undos, no 2 s); `change-module-attribute` then `undo` |
| 2c | **Improvement 2, one undo step per tool call** (the backlog item's to-do 3): the held step in `planner-core`, `historySteps` 1 or 0, tests 10a–10e and the server's undo tests, the docs; the backlog item marked in progress | roomle-ui, roomle-hi-example | `planner-core` and `homag-intelligence` suites and lint; roomle-hi-example suite; live: a create with materials and a wall placement, one planner undo reverts it (the kitchen gone with its materials), redo brings it back, the planner's undo button alike; the set of 6.7: tool time of the plan-changing calls without the 2 s, every `undo` of the runs undoes in one step |
| 3 | **Improvement 3, the evaluation**: 2.3 into the benchmark document's section 10, the backlog item 64 referenced | roomle-hi-example (docs) | no run |
| 4 | **Improvement 4**: the served text, test 11, the docs | roomle-hi-example | suite green; the set of 6.7: no `articleDescriptions` in a first step, first-step result tokens |
| 5a | **Improvement 5, the reproduction**: the create of run 48 live, the hint read | — | the hint names the window; the positions as in the run |
| 5b | **Improvement 5, the rule sentence**: test 12, the docs | roomle-hi-example | suite green; the set of 6.7: `image-only-no-text` without a `place-group` after the create, the other tests unchanged |
| 6 | **Improvement 6**: the sentences, tests 13–14, the docs | roomle-ui, roomle-hi-example (docs) | roomle-ui suite green; the set of 6.7: result tokens of the creates, the planning unchanged |
| 7 | **Close**: section 10 of the benchmark document with the before/after table per step; this document's status; the results as a ticket comment | roomle-hi-example | `check-markdown-links.js` on the changed documents |

Commits, about three per repository: roomle-hi-example — this plan; the server changes of 1, 2 and 4
with their tests and docs; the measurements (section 10, the benchmark folders). roomle-ui — the
settled commands and the one-step tool call (2); the sentences (6). Pushed; pull requests on request.

Cost of the runs: steps 0, 1, 2c, 4, 5b and 6 — 6 rounds × 8 runs, about 90 minutes and about
16M input tokens with gpt-6-astra; the 4-run variant halves both. Step 2b is verified live and by
the unit tests; its round is the one after 2c, which completes improvement 2.
