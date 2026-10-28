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
[library-issues.md](library-issues.md). A calculation error of the library is an MCP issue here
when an invalid attribute value the tools sent caused it, and a library issue there otherwise
(D99 of [roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#3-decisions)). An issue leaves
this document when its fix is in the code.
The guideline for every server issue is
[Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort): wrong content an agent creates
is an instruction problem first; correct where the intent is clear, report what was corrected, and
never drop the agent's content silently.

Keep this document, its guidance and its overview table when no issues are open, ready for new issues.

## Overview

| # | Issue | Kind | Responsible | Priority | Model | Reasoning effort |
|---|---|---|---|---|---|---|
| 116 | [A conflict a row edit leaves is not resolved](#116-a-conflict-a-row-edit-leaves-is-not-resolved) | hardening | roomle-ui served text: the rule for results, `delete-article-and-compact` (`hi-mcp-server.ts`), the overlap correction (`hi-tools.ts`) — analysed in [the bug analysis](../bug-analysis/conflict-a-row-edit-leaves-is-not-resolved.md): the rule calls corrections changes already applied and has no sentence for two units a call leaves in one place; the door is named by the hint and handled as the rules ask | low | gpt-6-astra | provider default |
| 117 | [The catalog serves 19 descriptions in full](#117-the-catalog-serves-19-descriptions-in-full) | hardening | roomle-ui `shortDescription` (`hi-mcp/agent-facing.ts`) | low — about 11 KB, 2,400 tokens of the cached prefix | | |

`run.json` and `planner-calls.json` of the run directories named under **Reproduce** hold the payload
the model sent; the directories are under `.temp/result/`. The root `logMessages` in `plan.xml`'s
`externalConfiguration` retain library calculation diagnostics that compact plan contexts omit.

## 116. A conflict a row edit leaves is not resolved

**Problem.** After a row edit the agent reports a conflict the edit left and stops: removing the
corner unit turns a leg into one straight row whose fridge reaches 155 mm into the door opening,
removing the unit next to the corner leaves the wall unit above it overlapping the hood that moved
in. The answers name the conflict and leave it to the user; in earlier sessions the agent moved the
wall unit in a follow-up call.

**Cause.** The rule for results (`hi-mcp-server.ts`) calls `corrections` what the server changed
and has already applied, and `hint` something to check; it has no sentence for two units a call
leaves in one place. The overlap correction ends "remove one of them or move the units above" and
does not say who makes the edit. The door is named by the row hint of the same result (D43, D55),
and the answers do what the obstacles rule asks: keep the row and name the door. The analysis leaves
to the review whether the agent should clear it ([the bug
analysis](../bug-analysis/conflict-a-row-edit-leaves-is-not-resolved.md)).

**To do.** roomle-ui served text: the rule for results says that a result naming two units that
now overlap leaves a plan that cannot be built, and that the agent resolves it with one more call;
the overlap correction ends "delete one of them or move it with one more call"; the description of
`delete-article-and-compact` names the unit above that keeps its place. The `expect` of
`edit-remove-next-to-corner` asks for the resolved overlap.

**Test.** `edit-remove-next-to-corner`: the final plan holds no overlap above the right leg, and
the answer says how it was resolved. `edit-remove-corner-unit`: the answer names the tall unit in
front of the door and what would clear it.

**Reproduce.** `mcp-test-2026-10-27_07-11-41`, gpt-6-astra 24 (`edit-remove-corner-unit`): `delete-article-and-compact` of the corner unit `814c6854` on `corner-kitchen-wall-units`; the fridge `ad52e21b` ends at y -435, the door opening spans y -1180 to -280.

## 117. The catalog serves 19 descriptions in full

**Problem.** The catalog of `get-plan-context` serves 19 of the 111 Furniture_Smith descriptions
with every section — `PURPOSE`, `TYPICAL_PLACEMENT`, `REQUIREMENTS`, … —, not shortened to
`FUNCTION` and `AI_SELECTION_HINT` (D63): the sink units, the articles with two doors, the flap and
single-door wall cabinets, `HTB60`, `HWR_HB600T2`. 15,822 bytes where the two lines are 4,812, about
11 KB and 2,400 tokens of the cached prefix.

**Cause.** `shortDescription` (roomle-ui `hi-mcp/agent-facing.ts`) takes a section's text from the
line after its name (`FUNCTION:` then a line break); a description with nothing to take keeps all
of it. The 19 descriptions write each section on one line (`FUNCTION: Sink base unit, …`) — the
format of [the suggested library changes](../../docs/library-information/suggested-library-changes.md);
the 92 others put the text on the next line.

**To do.** roomle-ui: `shortDescription` reads a section's text on its own line and on the line of
its name; a test with both forms in `__tests__/hi-mcp/tool-executors-test.ts`
(`describe('article descriptions')`). The library-neutral policy holds: the function reads the
section names D63 names, no article.

**Test.** `get-plan-context` with `articles`: the catalog line of `SUT60` is its `FUNCTION` and
`AI_SELECTION_HINT` text; the section is about 11 KB smaller.

**Reproduce.** The example page on the planner of `feat/hi-mcp-merge` (4415cdffd) or bo-test:
`get-plan-context` with `articles`; the desc of `SUT60` holds `PURPOSE:`.

