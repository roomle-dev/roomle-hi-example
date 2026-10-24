# Bug analysis: a root module the library could not calculate is not visible to the agent

> **Type**: Bug analysis
> **Status**: Open — the fix is proposed below; three points are to be confirmed by the user (D51)
> **Date**: 2026-10-24
> **Base**: roomle-hi-example `master` `b36593e`; roomle-ui `feat/hi-mcp` `345f72def` (local, with
> the commits of D106 and D107)
> **Backlog**: [library-calculation-gaps.md #2](../backlog/library-calculation-gaps.md#2-a-root-module-the-library-could-not-calculate-is-not-visible-after-the-call-that-caused-it)

## Affected repositories

- **roomle-ui**, branch `feat/hi-mcp`: the plan context (`hi-plan-context.ts`: `shapeRoot`,
  `shapeGroup`, `HiPlanRoot`, `HiPlanGroup`), the payload's read-only fields and the library's
  verdict (`hi-tool-payload.ts`), the served `get-plan-context` description
  (`hi-mcp/hi-mcp-server.ts`), the tests, and `.agents/homag-intelligence/hi-tools-behaviour.md`
  (D9, §5.4, §5.5), `hi-tools-reference.md` and `library-errors.md`.
- **roomle-hi-example**: documentation only — `.agents/skills/hi-mcp-tools.md`, the wiki page
  [Why the agent cannot plan what the library cannot build](../wiki/why-the-agent-cannot-plan-what-the-library-cannot-build.md),
  and the backlog (item 2 leaves; item 1 refers to the helper this fix moves).
- **ligna-store**: unchanged. It gets the field and the served text with the planner at its server
  URL. No new embedding-lib version: the forwarding of `createHiMcpTools` does not change.

The roomle-ui paths below are relative to `packages/web-sdk/packages/homag-intelligence/src/`.

## Symptom

A root module the library could not calculate stays in the plan when the user's edit in the
planner caused it (D95), when a saved plan holds it, or when an undo — the planner's or the agent's
`undo` tool — restores a plan with it. Nothing tells the agent. `get-plan-context` lists it like
any other root module: its article, its input attributes with the value that failed, its sub
modules. Only its empty `dockingVectors` and `freeDockingVectors` differ, and an empty list is no
verdict — the root modules of an article can carry no docking vectors of their own (D74).

The agent therefore describes the unit as planned ("a 900 mm wall unit with one door"), tells the
user the planning is complete, and plans around it. Its later tool calls do not reveal it either:
D106 reverts a call only for a root module that fails after the call and did not before, so a call
that leaves the failed root module failing — a group attribute change, or a repair attempt with a
value the library cannot calculate either — succeeds without a note.

## Reproduction

**In the example page** (model-free, `instance.extended.callExternalObjectAgentTool`):

1. Load a plan with an `OTB60` wall unit of Furniture_Smith.
2. In the planner's attribute panel set `mod_DoorDirectionSelection` `Left`, then `mod_Width` 900
   ([library issue 80](../backlog/library-issues.md#80-wall-units-at-900-mm-with-a-single-door-the-library-cannot-calculate)).
   The planner keeps the edit; the console logs
   `Library messages for root module <id> of group <id>: […]`.
3. `get-plan-context` lists the `OTB60` with `mod_Width` 900, `dockingVectors: []` and no
   diagnostic.

**In a unit test** (scratch vitest beside `hi-plan-context-test.ts`, run and deleted): a group with
one root module that carries a `Warning` and an `Error` message
(`'No door width for 900 mm.\nat stack line'`) and no `dockInfos`. `shapeGroup` returns:

```json
{
  "id": "root-1",
  "articleId": "OTB60",
  "articleName": "Wall unit",
  "attributes": [{ "id": "mod_Width", "value": 900 }],
  "dockingVectors": [],
  "freeDockingVectors": [],
  "subModules": []
}
```

`newLibraryFailures([], [group])` on the same group returns
`the library could not calculate root module 'root-1' (OTB60) of group 'group-1' - No door width for 900 mm`.
The tools know the verdict; the plan context drops it.

## Investigation trace

### Where the library's verdict lives

- The library writes its diagnostics into `logMessages` of each root module (category `Info`,
  `Warning`, `Error`, `Fatal`) and of the group. A calculation that throws leaves a `Fatal` message
  on the group (`_calculate`, `glue-logic.ts:3488`).
- The glue logic stores every calculation, failed root modules included (D95; `_runGroupCalculation`,
  `glue-logic.ts:2282`), and loads it into RoomleCore. A loaded plan is calculated again on load
  (`HI_LOAD_OBJECT_REASON.LOAD`, `glue-logic.ts:1936`), so its messages are current.
- The planner hands the groups back as their serialized definitions, `logMessages` included
  (`getExternalObjectGroups`, `planner-core/src/roomle-planner.ts:3199`; `getPosDataOfAllGroups`,
  `api.ts:124`).

### Who reads the verdict today

- `newLibraryFailures` (`hi-tool-payload.ts:288`), with `calculationErrorOf` (`:270`, the first
  `Error` or `Fatal` message) and `firstLineOf` (`:224`), in `runToolCommand`
  (`hi-tool-commands.ts:1443`): only the failures a tool call caused (D106). A root module that
  failed before the call is skipped on purpose, so the agent can repair it.
- `_logFailedRootModules` (`glue-logic.ts:2344`): the console, for the newly failed roots of a
  calculation.

Nothing else. Every other path that shows the plan to the agent goes through the plan context.

### What the agent reads

- `get-plan-context` (`hi-mcp/tool-executors.ts:482`) → `getExternalObjectPlanContext` →
  `createPlanContext`, which maps the planner's groups with `shapeGroup`
  (`hi-plan-context.ts:1039`).
- `shapeGroup` (`hi-plan-context.ts:729`) keeps `id`, `libraryId`, `position`, `attributes`,
  `interiorFittings` and the roots by `shapeRoot` — no `logMessages`.
- `shapeRoot` (`hi-plan-context.ts:706`) keeps the article pick and read-only facts. Its comment
  (`:702-705`) says it: "No positions, no geometry, no log messages." `dockingVectors` come from the
  root's `dockInfos` (`dockingVectorNames`, `:321`), which a failed calculation leaves empty.
- The same shaped groups are in the results of the plan-changing tools that return groups
  (`create-or-replace-groups`, `place-group`, the row edits, `merge-groups`, through the group
  operations, `hi-plan-context.ts:1731`) and of `undo` and `redo` (`hi-mcp/tool-executors.ts:349`,
  `:409`). `change-module-attribute` and `change-group-attribute` answer compactly, without groups
  (`compactAttributeResult`, `hi-mcp/tool-executors.ts:224`).
- The served `get-plan-context` description (`hi-mcp/hi-mcp-server.ts:328`) and the authoring rules
  say nothing about a root module the library could not calculate.

## Root cause

The plan context gives the agent no field for the library's verdict on a root module:
`shapeRoot`, `hi-plan-context.ts:706-726`, and for the group `shapeGroup`, `:729-740`, leave
`logMessages` out — D9 withholds them because they are large — and nothing smaller stands in for
the one fact the agent needs, that the root module is not built and why. The served
`get-plan-context` description (`hi-mcp/hi-mcp-server.ts:328`) does not tell the agent that such a
root module exists or what to do with it.

## Why the current code produces wrong results

The agent describes the plan from the plan context. For a failed root module that context shows
exactly what the user asked for — the article and the value that failed — and leaves out the one
thing that contradicts it. The agent cannot infer the failure from the empty docking vectors: an
article may have none of its own, and the served text does not say what an empty list means. The
served text is where the agent learns how to read the plan; it carries no word for this case, so
the agent's answer is wrong although every tool worked as specified.

D106 makes it worse for the agent's own calls in one case: since a root module that failed before
the call does not stand against it, a repair attempt that fails again succeeds silently, and the
agent reports the repair as done.

## Proposed fix

All in roomle-ui `feat/hi-mcp`. Nothing is refused and nothing is reverted; D95 and D106 stay as
they are.

1. **One definition of the library's verdict.** Move `calculationErrorOf`
   (`hi-tool-payload.ts:270`) and `firstLineOf` (`:224`) into `hi-plan-context.ts` and export them;
   `hi-tool-payload.ts` imports them for `newLibraryFailures` and `byCause`. `hi-plan-context.ts`
   imports neither the payload module nor the tool commands, so no import cycle arises.
2. **The field on the root module.** `shapeRoot` adds `calculationError` — the first line of the
   root module's first `Error` or `Fatal` message, as D106 words it — only when there is one:
   `...(error !== undefined && { calculationError: firstLineOf(error) })`. `HiPlanRoot` gains
   `calculationError?: string`. The field is new in the planner's public plan context
   (`getExternalObjectPlanContext`); nothing there is removed or renamed. The comment of
   `shapeRoot` names the field instead of "no log messages". `logMessages` stay withheld (D9).
3. **The field on the group** (point A below): `shapeGroup` adds the same field for a group whose
   own messages carry an `Error` or `Fatal` — the calculation that throws (`_calculate`); `HiPlanGroup`
   gains `calculationError?: string`.
4. **A resubmitted group stays silent.** `calculationError` joins `READ_ONLY_ROOT_FIELDS`
   (`hi-tool-payload.ts:455`) and, with point 3, `READ_ONLY_GROUP_FIELDS` (`:443`). Without it,
   a group from `get-plan-context` sent back as it is would get a correction for an unused field
   from `reportUnusedFields` (`:687`).
5. **The served text.** One library-neutral sentence in the `get-plan-context` description: a root
   module with `calculationError` is not built — the library could not calculate it with its
   attribute values, so it has no docking vectors and no fronts until a value the library can
   calculate replaces the one that failed; the answer says so and does not describe it as planned.
   The same field in the groups of a tool result means the same.

What the field reaches without further code: `get-plan-context`, and the groups in the results of
`create-or-replace-groups`, `place-group`, the row edits, `merge-groups`, `undo` and `redo` —
`agentFacingGroups` keeps every root field it does not filter.

### Comparisons that read the shaped groups

The field becomes part of every comparison built on the shaped groups: the undo record's
`groupsKey` (`hi-mcp/tool-executors.ts:113`), the changed groups of `changedGroupsOnly` (`:209`)
and the check of a failed interior edit (`glue-logic.ts:3132`). Both sides of each comparison come
from the stored calculation, so an unchanged plan gives the same key; a root module that fails or
recovers counts as a change of its group, which it is.

## To confirm (D51)

- **A. The group's own failure.** The backlog item names root modules. A group whose calculation
  threw carries a `Fatal` message on the group until the next calculation clears it, and is
  invisible in the same way. Recommended: the same field on the group (point 3) — the same gap,
  two lines.
- **B. A call that leaves a failed root module failing.** The result of `change-module-attribute`
  and `change-group-attribute` carries no groups, so a repair attempt that fails again succeeds
  without a note. Recommended: their result names, in `corrections`, every root module of the
  changed groups that carries `calculationError` after the call — "root module '…' is still not
  built - …" — so the agent sees its repair did not work. Not part of the backlog item; without it
  the agent learns it only from its next `get-plan-context`.
- **C. The name and the content.** `calculationError` with the first line of the message, as D106
  words a failure. Alternatives below.

## Alternatives considered

- **Serving `logMessages`.** Rejected by D9: they are large, and the agent needs one line.
- **A flag without the cause** (`notBuilt: true`). The agent could not tell the user why, nor which
  value to change.
- **A top-level list of the failed root modules in `get-plan-context`.** The groups in the tool
  results would not carry it, and the agent reads a root module where it is.
- **Leaving the failed root module out of the plan context.** It is in the plan; a group sent back
  without it loses it.
- **Reverting or refusing the user's edit.** D95 rejects it: the value may be the user's.

## Tests

roomle-ui:

- `__tests__/hi-plan-context-test.ts`: a root module with an `Error` message carries
  `calculationError` with the first line of its first `Error` or `Fatal` message, without the full
  stop and the stack; a root module with `Warning` and `Info` messages only, and one without
  messages, carry none; with point A, a group with a `Fatal` message carries the field, a root
  module's failure does not put it on the group.
- `__tests__/hi-tool-commands/create-or-replace-groups-input-test.ts`: a group from the plan context
  with `calculationError` on a root sent back as it is gets no correction for it.
- `__tests__/hi-mcp/hi-mcp-server-test.ts`: the `get-plan-context` description says that a root
  module with `calculationError` is not built and that the answer says so.
- The tests of `newLibraryFailures` (`describe("the library's verdict")` in
  `__tests__/hi-tool-commands/run-tool-command-test.ts`) pass unchanged after the move.
- With point B: `__tests__/hi-tool-commands/group-commands-test.ts`, a `change-module-attribute`
  on a group with a root module that failed before and still fails names it in `corrections`; one
  that recovers names nothing.

## Documentation

- roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md`: D9 (the log messages stay withheld,
  `calculationError` carries the first line), the groups row of §5.4, the "Parts and log messages"
  row of §5.5, the `get-plan-context` section of §6; with point B, the correction in §8.5.
- roomle-ui `hi-tools-reference.md`: the root fields of `get-plan-context` (`:81`).
- roomle-ui `library-errors.md`: "The plan context carries no library messages" (`:278`) and "Only
  part of a diagnostic reaches the agent" (`:319`).
- roomle-hi-example: [`hi-mcp-tools.md`](../skills/hi-mcp-tools.md), the
  [wiki page](../wiki/why-the-agent-cannot-plan-what-the-library-cannot-build.md) (the paragraph on
  the user's edit), and [library-calculation-gaps.md](../backlog/library-calculation-gaps.md):
  item 2 leaves, item 1 points at the moved helper.

## Validation after the fix

The unit tests above. The page check of the reproduction runs only when the user asks for it, on a
planner that carries the change (the bo-test deployment or a local roomle-ui dev server).
