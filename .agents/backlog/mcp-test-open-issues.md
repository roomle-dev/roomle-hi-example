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
| 62 | [A correction names units by their id only](#62-a-correction-names-units-by-their-id-only) | MCP server feedback | roomle-hi-example `hi-mcp-server` | low — the answer stays vague | gpt-6-astra |  |
| 63 | [The answer does not name the window a placement keeps clear](#63-the-answer-does-not-name-the-window-a-placement-keeps-clear) | instructions | roomle-hi-example `hi-mcp-server` | low — the plan is right | gpt-6-astra |  |
| 64 | [A free-standing wall is missing from the plan context](#64-a-free-standing-wall-is-missing-from-the-plan-context) — [RML-18116](https://roomle.atlassian.net/browse/RML-18116) | roomle-ui plan context | roomle-ui `homag-intelligence` | medium — a group can be planned into the wall | gpt-6-astra |  |
| 38 | [A provider answer the AI SDK cannot process ends the turn without an answer](#38-a-provider-answer-the-ai-sdk-cannot-process-ends-the-turn-without-an-answer) | chat | roomle-hi-example `hi-mcp-chat` | low — rare | gpt-5-mini | high |

`run.json` and `planner-calls.json` of the run directories named under **Reproduce** hold the payload
the model sent; the directories are under `.temp/result/`.

## 62. A correction names units by their id only

**Problem.** After `delete-article-and-compact` of a corner article the correction says "the leg of
'46ce47e7…' … turned by 90°", and the answer says "one leg turned" where the test expects the wall
of the leg; the answer of an insert says "the sink-side units shifted" for a wall unit that moved.

**Cause.** The correction of the planner (`removeArticleFromGroup`, roomle-ui `glue-logic.ts`) and the
row hint of D42 (`tool-executors.ts`) name root modules by their id; the agent does not translate
them into words.

**To do.** Name a root module with its article (`'…' (UTB60)`) and a leg with its wall in
these corrections and hints, as the library-change corrections do (D59).

**Test.** The glue-logic test of the corner removal and the `tool-executors.test.ts` test of the D42
hint expect the article ids in the sentences.

**Reproduce.** `mcp-test-2026-10-09_00-59-22`: gpt-6-astra 16.

## 63. The answer does not name the window a placement keeps clear

**Problem.** The test `obstacle-window-back-wall` expects the answer to say that the cabinets keep
the window clear; the plan does, the answer does not mention the window.

**Cause.** No served sentence asks the agent to name the doors and windows a placement avoids.

**To do.** Decide whether the answer has to name them; if so, one sentence in the instructions.

**Test.** The test `obstacle-window-back-wall`: the answer names the window.

**Reproduce.** `mcp-test-2026-10-09_00-59-22`: gpt-6-astra 27.

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

## 38. A provider answer the AI SDK cannot process ends the turn without an answer

**Problem.** A turn can end after its last tool call with the error "Failed to process successful
response" from the chat's provider call: the stream carries the opening sentence and the `[error]`
line, and no summary. The plan holds what the tools changed.

**Cause.** Not identified — the error is the AI SDK's for a provider response it cannot parse; it
ends the stream with a throw, not with an error part, in the model step after a tool call (gpt-5-mini
after a `get-plan-context` with `masterData`). The chat logs the failing step with what the provider
answered: per cause the error, the HTTP status, the url, the provider's request id and the body,
text or value the SDK could not process (`createStepLog`, `describeStepError`,
`hi-mcp/hi-mcp-chat/chat-steps.ts`; called for an error part and for the throw in `chat-server.ts`).
The ligna-store chat logs the same `[hi-mcp] chat step n failed` line in the browser console
(`describeChatError`, `hi-mcp/chat.ts`).

**To do.** Read the `[hi-chat] step n failed` line of the next run that shows the error, then decide
whether a retry of the step is safe — the tool calls of the step are already carried out — and
retry it in the chat backend, or end the turn with an answer that says what the tools changed.

**Test.** A `chat-steps.test.ts` test feeds the failing answer the log shows and asserts the retry or
the answer the turn ends with.

**Reproduce.** `mcp-test-2026-10-08_18-33-08`: gpt-5-mini 37.
