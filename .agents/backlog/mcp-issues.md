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
