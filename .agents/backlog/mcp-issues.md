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
| 114 | [The provider rejects a chained model request of a turn](#114-the-provider-rejects-a-chained-model-request-of-a-turn) | defect | roomle-ui embedding-lib planning assistant (`hi-planning-assistant.ts`) — [analysed](../bug-analysis/rejected-response-continuation-ends-the-turn.md): continue the turn with the whole history when the provider rejects a continuation | high | gpt-6-astra | provider default |
| 115 | [An interior fitting added where the parent shows a default interior](#115-an-interior-fitting-added-where-the-parent-shows-a-default-interior) | hardening | roomle-ui served text: `get-interior-design-options`, `add-interior-fitting` (`hi-mcp-server.ts`) | low | gpt-6-astra | provider default |
| 116 | [A conflict a row edit leaves is not resolved](#116-a-conflict-a-row-edit-leaves-is-not-resolved) | hardening | roomle-ui served text: the rule for corrections, `delete-article-and-compact` (`hi-mcp-server.ts`) | low | gpt-6-astra | provider default |

`run.json` and `planner-calls.json` of the run directories named under **Reproduce** hold the payload
the model sent; the directories are under `.temp/result/`. The root `logMessages` in `plan.xml`'s
`externalConfiguration` retain library calculation diagnostics that compact plan contexts omit.

## 114. The provider rejects a chained model request of a turn

**Problem.** A model request the planning assistant chains on the previous response of the turn
fails, and the turn ends with "The planning assistant failed: …" and no answer: once with "No tool
output found for function call call_…" after a plan-changing tool had answered — the plan holds the
change, the user gets no answer —, once with "Previous response with id 'resp_…' not found" after
the first model call — a conversation of seven turns ends in its first. The runner does not retry
either error: neither is a transport failure.

**Cause.** Not analysed. The page loads embedding-lib `0.0.0-dev-432119f`, the build that chains
the model requests within a turn (roomle-ui `80484dc71`): a request sends the previous response id
and only the new items. The first error says that the provider expected the output of a function
call the request did not carry; the second, that the provider does not hold the response the
request names. The planning assistant has no way back to a request with the turn's whole history.

**To do.** roomle-ui: analyse the bug — which function call the first request lacked (a parallel
tool call of the step, a call whose output went to another request), and when the provider does not
hold a previous response; then send a chained request that carries every function call output of
the step, and answer a rejected chained request with one request with the turn's whole history.

**Test.** roomle-ui planning-assistant unit tests: a step with two tool calls chains a request with
both outputs; a provider rejection of a chained request ("Previous response … not found") is
answered with one request with the whole history and the turn ends with an answer; the prompt tests
`sideboard-row-one-more-cabinet` and `kitchen-conversation` end without a planning assistant error.

**Reproduce.** `mcp-test-2026-10-27_07-11-41`, gpt-6-astra 28 (`sideboard-row-one-more-cabinet`, "No tool output found", console.log line 22) and 74 (`kitchen-conversation`, "Previous response … not found", console.log line 14).

## 115. An interior fitting added where the parent shows a default interior

**Problem.** Asked to add one more shelf to a tall unit, the agent adds a `FixedShelf` to the
parent whose `defaultInteriors` lists the four adjustable shelves it shows; the fixed shelf takes
the place of the four, the correction says so, and the agent undoes it — one extra call and an undo
for a request that cannot be met.

**Cause.** The description of `get-interior-design-options` says that "an addition there takes its
place", but the agent reads `defaultInteriors` only after the addition, from its correction. Nothing
in the description of `add-interior-fitting` sends it to `defaultInteriors` before it adds.

**To do.** roomle-ui served text: the description of `add-interior-fitting` says that an addition
to a parent with a `defaultInteriors` entry replaces that default interior, so the agent checks
the entry first and tells the user what the parent already holds.

**Test.** `edit-add-subarticle-look-inside`: no `add-interior-fitting` replaces the four
adjustable shelves; the answer says the cabinet holds them.

**Reproduce.** `mcp-test-2026-10-27_07-11-41`, gpt-6-astra 41 (`edit-add-subarticle-look-inside`): `add-interior-fitting` of `FixedShelf` into parent `5b581d05` of the middle `HTB60`, the correction about the replaced default interior, then `undo`.

## 116. A conflict a row edit leaves is not resolved

**Problem.** After a row edit the agent reports a conflict the edit left and stops: removing the
corner unit turns a leg into one straight row whose fridge reaches 155 mm into the door opening,
removing the unit next to the corner leaves the wall unit above it overlapping the hood that moved
in. The answers name the conflict and leave it to the user; in earlier sessions the agent moved the
wall unit in a follow-up call.

**Cause.** The corrections of `delete-article-and-compact` name what the edit did — the unit above
keeps its place and overlaps, "remove one of them or move the units above"; the turned leg — but the
served text does not ask the agent to resolve a conflict a correction reports before it answers, and
a turned leg's correction says nothing about the door it now reaches.

**To do.** roomle-ui served text: the rule for corrections asks the agent to resolve a conflict a
correction reports — an overlap, a unit in a door opening — with a follow-up call where the request
leaves room for it, and to report it otherwise; the correction of a turned leg names an opening the
row now reaches.

**Test.** `edit-remove-next-to-corner` and `edit-remove-corner-unit`: the final plan holds no
overlap and no unit in the door opening, or the answer says why it could not resolve it.

**Reproduce.** `mcp-test-2026-10-27_07-11-41`, gpt-6-astra 24 (`edit-remove-corner-unit`): `delete-article-and-compact` of the corner unit `814c6854` on `corner-kitchen-wall-units`; the fridge `ad52e21b` ends at y -435, the door opening spans y -1180 to -280.
