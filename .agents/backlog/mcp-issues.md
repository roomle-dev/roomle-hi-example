# Open MCP issues

> **Type**: Backlog — defects and hardening in the MCP server, chat and planner
> **Domain**: hi-mcp — the served text (`hi-mcp/hi-mcp-server/hi-mcp-server.ts`), the forward of
> the plan-changing tools (`tool-executors.ts`), the chat (`hi-mcp/hi-mcp-chat`); roomle-ui — the HI
> tool commands (`hi-tool-commands.ts`, `hi-group-layout.ts`, `hi-group-placement.ts`,
> `hi-wall-placement.ts`, `hi-tool-hints.ts`) and the defects the runs show
> **Maintained by**: step 7 of [the testing skill](../skills/hi-mcp-testing.md#7-open-issues)

These are issues in the MCP server, chat or planner detected by the MCP prompt tests.

Each issue names the problem, its cause, the to-do, the test of the fix and how to reproduce it; the
overview names the module, team or repository responsible for the fix, and the model and the
reasoning effort of the run that reproduces it — empty where it is unknown; a model the chat sends
no effort for runs at its provider's default. Library data issues are tracked in
[library-issues.md](library-issues.md). An issue leaves this document when its fix is in the code.
The guideline for every server issue is
[Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort): wrong content an agent creates
is an instruction problem first; correct where the intent is clear, report what was corrected, and
never drop the agent's content silently.

## Overview

| # | Issue | Kind | Responsible | Priority | Model | Reasoning effort |
|---|---|---|---|---|---|---|
| 74 | [An island's back row of other widths lands off the front row](#74-an-islands-back-row-of-other-widths-lands-off-the-front-row) | hardening | roomle-hi-example `AUTHORING_RULES` (`hi-mcp-server.ts:30-34`): explain the endpoint and turned-row viewpoint. Conditional roomle-ui fallback: explicit end alignment through endpoint modes in `pairOf` (`hi-group-layout.ts:846-860`), with reciprocal modes when the entry changes owner. [Analysis and verification](../bug-analysis/islands-back-row-of-other-widths-lands-off-the-front-row.md) | low | gpt-6.1-sol | |
| 78 | [A swap of a widened unit is refused for want of a docking vector](#78-a-swap-of-a-widened-unit-is-refused-for-want-of-a-docking-vector) | defect | roomle-ui attribute-tool feedback (`hi-tool-attributes.ts:231`): expose the library calculation error behind the missing vectors; HI library descriptions: explain the width-dependent door arrangement. [Analysis and verification](../bug-analysis/swap-of-widened-unit-refused-for-want-of-docking-vector.md) | medium | gpt-6-astra | |

`run.json` and `planner-calls.json` of the run directories named under **Reproduce** hold the payload
the model sent; the directories are under `.temp/result/`. The root `logMessages` in `plan.xml`'s
`externalConfiguration` retain library calculation diagnostics that compact plan contexts omit.

## 74. An island's back row of other widths lands off the front row

**Problem.** An island with a front row of 900, 600 and 900 mm units and a back row of four
600 mm units has a 300 mm step at both ends. The first rear unit is `behind` the last front unit,
and its row continues `rightOf`.

**Cause.** The served `behind` description (`hi-mcp-server.ts:34`) omits the aligned end and the
viewpoint of side relations in the turned row. `pairOf` (`hi-group-layout.ts:859-860`) emits the
back-vector pair with no mode and zero offset. Its reversed partner frame aligns the turned
cabinet to the target's left end; `rightOf` in the rear row runs towards the front row's left.
For this composition the local extents are front `[0,2400]`, back `[-300,2100]`. An omitted mode
is different from explicit `StartStart` for back vectors. `align` is parsed but ignored for
`behind`. See [the analysis](../bug-analysis/islands-back-row-of-other-widths-lands-off-the-front-row.md).

**To do.** Clarify `AUTHORING_RULES` (`hi-mcp-server.ts:30-34`): side relations use the named
neighbour's front; for equal-length flush rows, put the first rear unit behind the first front
unit and continue `leftOf`. Verify model acceptance. If needed, let `behind` name an end in
roomle-ui: retain the default, use `EndStart` for right alignment and mirror it to `StartEnd`
when the unit owns the entry (`hi-group-layout.ts:922-937`). Actual endpoints supply the
geometry without catalog-width offsets or orientation tracking. Update served-text tests and
references; roomle-ui work retains `fix/room-corners-at-openings` ancestry.

**Test.** `image-planning-right-wall`: the island's equal-length rows end flush at both ends.
Permanent geometry tests cover different unit widths and preserve deliberate steps; a fallback
also covers rotated targets, wider rear units and reciprocal mode ownership.

**Reproduce.** `mcp-test-2026-10-16_19-30-19`, gpt-6.1-sol 48 (`image-planning-right-wall`, the
second `create-or-replace-groups`, the island): `rear1` (`EUTB60`) `behind` `islandright`
(`EUS2A90`), `rear2` to `rear4` `rightOf`; back row z −3240 to −840 against front z −2940 to −540.

## 78. A swap of a widened unit is refused for want of a docking vector

**Problem.** Widening the last `HTB60` of `three-tall-units` to 900 mm retains its explicit
`mod_DoorDirectionSelection: Right`. The library cannot calculate that configuration; the root
loses docking vectors and its front has no generated parts, but the attribute result reports no
calculation problem. The following swap applies with a dropped `RightBottom` link, then the
model undoes it. This is a successful tool response with broken content, not a refused call.

**Cause.** The saved root has Error 14019: no `tab_DoorSettings` entry for the 900 mm tall unit
with `Right`. The successful 900 mm control uses `Automatic`, resolves its door to `LeftRight`
and keeps six vectors. The article description says one door without describing its
width-dependent configuration. `withLibraryChanges` (`hi-tool-attributes.ts:231-251`, called
at `hi-tool-commands.ts:957,1013`) reports attribute adjustments but omits raw root Error/Fatal
messages; `shapeRoot` (`hi-plan-context.ts:689-710`) omits them too. The swap's `handOver`
(`hi-tools.ts:954-972`) then reports the downstream missing-vector symptom. See
[the analysis](../bug-analysis/swap-of-widened-unit-refused-for-want-of-docking-vector.md).

**To do.** In roomle-ui, include root-specific calculation diagnostics and recovery guidance in
both attribute tools' results, keeping the applied edits and valid roots. Follow the feedback
pattern of `create-or-replace-groups` (`hi-tool-commands.ts:654-689`); use `corrections`, retained
by the MCP `compactAttributeResult` (`tool-executors.ts:344-352`). Clarify the library's
width-dependent door descriptions, then recover valid hinge inputs before the swap. Keep
library-specific facts in data. Do not restore old `dockInfos` over a failed calculation or
silently reset hinge settings. Roomle-ui work retains `fix/room-corners-at-openings` ancestry.

**Test.** Unit coverage through the tool/glue path: a failed attribute calculation keeps the edit
and returns the affected root and diagnostic; MCP compaction retains it. Live `edit-swap-units`:
recover a supported 900 mm paired-door configuration, then swap with complete front geometry,
six docking vectors and a contiguous 2100 mm row, its back end at z −3765. Match outer hinges
to the calculated single or paired doors; a dropped docking followed by undo fails.

**Reproduce.** `mcp-test-2026-10-18_14-48-28`, gpt-6-astra 32 (`edit-swap-units`, local planner
`e4989a862`): widen `8774cac2-8b83-405d-b88c-f0e5cd2452fb`, then swap it with `0010443c…`;
`run.json` records the dropped `RightBottom` link and undo, while `plan.xml` records Error 14019
and the retained `Right` input on the widened root.
