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
| 117 | [The catalog serves 19 descriptions in full](#117-the-catalog-serves-19-descriptions-in-full) | hardening | roomle-ui `shortDescription` (`hi-mcp/agent-facing.ts`) | low — about 11 KB, 2,400 tokens of the cached prefix | | |

`run.json` and `planner-calls.json` of the run directories named under **Reproduce** hold the payload
the model sent; the directories are under `.temp/result/`. The root `logMessages` in `plan.xml`'s
`externalConfiguration` retain library calculation diagnostics that compact plan contexts omit.

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

