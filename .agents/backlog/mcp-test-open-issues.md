# Open issues of the MCP test

> **Type**: Backlog — what is still to be done about the planning the MCP server produces
> **Domain**: hi-mcp — `create-or-replace-groups`, `merge-article-into-group`, the command tools
> (`hi-mcp/hi-mcp-server/tool-executors.ts`, `group-layout.ts`, `group-placement.ts`), the served
> text (`hi-mcp-server.ts`), the chat (`hi-mcp/hi-mcp-chat`); roomle-ui defects the runs show
> **Maintained by**: step 7 of [the testing skill](../skills/hi-mcp-testing.md#7-open-issues)

Each issue names the problem, its cause, the to-do, the test of the fix and how to reproduce it; the
overview names the module, team or repository responsible for the fix, and the model and the
reasoning effort of the run that reproduces it — empty where it is unknown; a model the chat sends
no effort for runs at its provider's default. A library issue — the library data lacks what the
agent needs — is described in [library-issues.md](library-issues.md); the overview links to it. An
issue leaves this document when its fix is in the code. The guideline for every server issue is
[Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort): wrong content an agent creates
is an instruction problem first; correct where the intent is clear, report what was corrected, and
never drop the agent's content silently.

## Overview

| # | Issue | Kind | Responsible | Priority | Model | Reasoning effort |
|---|---|---|---|---|---|---|
| 60 | [The sink top of a sink unit reaches past the row or over the hob](library-issues.md#60-the-sink-top-of-a-sink-unit-reaches-past-the-row-or-over-the-hob) | library information | HOMAG library | medium — the drainer in the air or over the hob | gpt-6-astra |  |
| 61 | [Handleless fronts done with a handle attribute](library-issues.md#61-handleless-fronts-done-with-a-handle-attribute) | library information | HOMAG library | medium — handled articles where the user asked for handleless ones | gpt-6-astra |  |
| 64 | [A free-standing wall is missing from the plan context](#64-a-free-standing-wall-is-missing-from-the-plan-context) — [RML-18116](https://roomle.atlassian.net/browse/RML-18116) | roomle-ui plan context | roomle-ui `homag-intelligence` | medium — a group can be planned into the wall | gpt-6-astra |  |

`run.json` and `planner-calls.json` of the run directories named under **Reproduce** hold the payload
the model sent; the directories are under `.temp/result/`.

## 64. A free-standing wall is missing from the plan context

**Ticket.** [RML-18116](https://roomle.atlassian.net/browse/RML-18116)

**Problem.** A wall that stands free in a room — the Living Room has one at x 1870 from z -2550 to
1050, 120 mm thick (`plan.xml`, edge 12 → 13) — is neither in `rooms[].walls` nor in `obstacles` of
`get-plan-context`. The agent sees it only in a rendering and can plan a group into it.

**Cause.** The plan context takes its walls from the room contours (roomle-ui `hi-plan-context.ts`);
a wall that is not part of a contour belongs to no room and is not listed as an obstacle.

**To do.** roomle-ui: list a wall that is not part of a room contour in `obstacles` with its outline
and height, as an object of its own kind. Then the server's obstacle hint (D55) covers it.

**Test.** A roomle-ui plan-context test with a free-standing wall; the random test of the run below:
the media unit stands clear of the wall.

**Reproduce.** `mcp-test-2026-10-09_00-59-22`: gpt-6-astra 36.
