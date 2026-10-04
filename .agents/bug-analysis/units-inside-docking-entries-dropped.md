# create-or-replace-groups drops the units the agent writes inside the docking

> **Type**: Bug Analysis
> **Domain**: hi-mcp — `create-or-replace-groups` (`hi-mcp/hi-mcp-server/tool-executors.ts`), the served rules (`hi-mcp-server.ts`), the test run script (`.agents/scripts/run-hi-mcp-prompt.js`)
> **Trigger**: "test the mcp" `.temp/result/mcp-test-2026-10-02_07-09-23`, run 06 ("Full kitchen, walnut fronts, dark marble worktop, around the corner") — reported there as a model finding, which it is not
> **Ticket**: [RML-18033](https://roomle.atlassian.net/browse/RML-18033)
> **Date**: 2026-10-02
> **Author**: AI Assistant
> **Status**: Fixed — on `docs/guards-as-last-resort`
> **Branch**: `docs/guards-as-last-resort`

## Symptom

Prompt 06 asks for a kitchen around the back right corner: oven, hob, cooker hood, fridge, sink, a
cabinet with drawers and wall cabinets, walnut fronts, a dark marble worktop. The plan holds the
corner base cabinet alone, with walnut fronts and a marble worktop. The model's answer lists every
unit. The run reported no correction and no error.

What reached the planner (`planner-calls.json`, the last `loadExternalObjectGroupLayout`):

```json
{ "id": "c1", "articleId": "EUERTB90", "contextData": { "dockedRoots": [
  { "ownDockingVector": "RightBottom", "dockedRoots": [{ "id": "r1" }] },
  { "ownDockingVector": "LeftBottom",  "dockedRoots": [{ "id": "l1" }] } ] } }
```

Each docking entry holds an id and nothing else — no `dockingVector`, which the rules require on
every entry.

## Evidence: what the model sent

The tool arguments were not recorded. A rerun of the prompt with a temporary log of the arguments
(`.temp/result/analysis-06/run-1/tool-args.jsonl`) shows the model's payload:

```json
{ "id": "corner1", "articleId": "UELTB90", "contextData": { "dockedRoots": [
  { "ownDockingVector": "RightBottom", "dockedRoots": [
    { "id": "fridge1", "articleId": "HK60", "contextData": { … } } ] },
  { "ownDockingVector": "LeftBottom", "dockedRoots": [
    { "id": "sink1", "articleId": "SUBA60", "contextData": { … } } ] } ] } },
{ "id": "hood1", "articleId": "DU" },
{ "id": "wallcab1", "articleId": "OFKB60", "contextData": { "dockedRoots": [
  { "ownDockingVector": "RightBottom", "dockedRoots": [{ "id": "wallcab2", "articleId": "OFKB60" }] } ] } }
```

The model wrote the kitchen as a tree. The fridge, the sink and the second wall cabinet are complete
units with their `articleId` and their own docking, but they sit inside the docking entries of their
neighbours and have no `dockingVector`.

- **First call:** after the units were stripped, the hood and the first wall cabinet had nothing to
  dock to, so the call was rejected.
- **Second call:** the model sent the corner cabinet with the nested fridge. It was stripped again,
  and the planner built the corner cabinet alone.

## Investigation

- **`stripDockingIndices`** (`tool-executors.ts`, applied by `toArticlePick` to every root) keeps
  `id`, `dockingVector`, `mode` and `offset` of an entry and drops everything else: the nested
  `articleId`, its attributes and its own docking. Nothing reports it.
- **An entry naming a root that is not in `roots`** connects nothing (C8 of the behaviour document).
  It was designed for a resubmitted group that still names a deleted unit, and it applied to new
  groups as well — silently.
- **The server already dropped other content silently:** unknown root and group fields, the group
  `attributes` of a resubmitted group (library settings such as `mod_GroupHeight`), and attribute
  overrides given as an object.
- **The served rules invite the tree:** "Write the docking entry on the placed root and **list the
  new root under dockedRoots**", and in the tool description "the placed root **lists the new
  root**". Read literally, the new root goes inside the entry.
- **The test run could not show it:** `run.json` held what the server sent to the planner, not what
  the model sent, and the new error log wrote the arguments after the server had already changed
  them. The run was classified as a model finding without the payload.

## Root cause

The refactoring of the guards (RML-18033) turned the rejections into corrections, but left the
server's silent drops untouched: it listed them as silent corrections "the rules describe as
normal". A unit written inside the docking is not normal: it is the agent's content. Dropping it
contradicts the decision that the server corrects what it can and reports what it cannot.

## Fix

1. **Units inside the docking become roots** (G23 of the behaviour document). An entry with an
   `articleId` is taken out as a root — recursively, so a tree builds — and the entry keeps the link.
   Reported.
2. **Docking entries are completed** (G24, G25). A missing `dockingVector` becomes the partner of
   the root's own vector, and `rootId` is read as `id`. A context without `ownDockingVector` is
   dropped, and its roots are docked like any undocked root. Reported.
3. **Roots named but never sent** (G26). In a new group, an entry naming a root that is not in
   `roots` and carries no article is dropped. The result says that nothing was built for it and what
   to send. A resubmitted group keeps its entries to deleted units silently.
4. **The instructions.** "Name the new root by its id under dockedRoots — the new root itself is an
   entry of roots like every other root", in the rules, the tool descriptions and the docking error.
5. **No silent drops** (G27, G28, D32):
   - Every field the server does not use is reported, unless it is a read-only field of
     `get-plan-context`.
   - Attribute overrides given as an object, or with `attributeId`, are read.
   - The group `attributes` reach the planner.
6. **What the agent sent is recorded.** The server logs the arguments of every plan-changing tool,
   copied before it corrects them. `run-hi-mcp-prompt.js` stores them with the feedback as
   `toolCalls`. "Test the mcp" compares them with the planner calls before it calls anything a model
   finding.

Tests (`tests/tool-executors.test.ts`, `tests/hi-mcp-server.test.ts`):
- the run-06 tree is built with all its units
- entries are completed
- roots named but never sent are reported
- unused fields are reported and the group attributes are kept
- a resubmitted group from `get-plan-context` produces no correction
- the logged arguments are the ones sent

## Validation

"Test the mcp" with gpt-5.4-mini on `3f688c3` (`.temp/result/mcp-test-2026-10-02_07-45-57/report.md`):
6 pass, 4 partial, 3 fail.

- **Run 06** sent the kitchen as a tree again: one root with six units inside the docking. All six
  were built and reported — the corner kitchen with hob, drawer unit, sink, fridge and two wall
  cabinets. The run went from fail to partial: the model left out the oven and the hood and set
  the colours on single units.
- **Every run:** what the model sent reached the planner or was reported. No unit vanished without
  a correction.

The suite found three new bugs in the correction logic, not fixed here:

1. **The anchor of a docking ring** (run 02). The server anchors a root the planner does not put
   first, so the row stands through the wall.
2. **An on-top docking counted as a side neighbour** (run 06). A wall cabinet beside a wall
   cabinet that sits on a base unit is moved to the floor row.
3. **A taken side re-targeted to the far end of the row** (run 07). The named root was itself the
   free end; the unit went into the corner, behind the wall.
