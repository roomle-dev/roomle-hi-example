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

## Overview

| # | Issue | Kind | Responsible | Priority | Model | Reasoning effort |
|---|---|---|---|---|---|---|
| 112 | [A discarded group of a create is reported to the host as added and then deleted](#112-a-discarded-group-of-a-create-is-reported-to-the-host-as-added-and-then-deleted) | defect | roomle-ui `hi-tools.ts` — [analysis](../bug-analysis/discarded-create-host-notifications.md): finish the tool's discard before host publication; preserve direct layout callbacks | low | | |

`run.json` and `planner-calls.json` of the run directories named under **Reproduce** hold the payload
the model sent; the directories are under `.temp/result/`. The root `logMessages` in `plan.xml`'s
`externalConfiguration` retain library calculation diagnostics that compact plan contexts omit.

## 112. A discarded group of a create is reported to the host as added and then deleted

**Problem.** A new group of a create that the tools discard before the load (D106) is reported to
the host as added and then as deleted; a discarded replace is reported as changed twice. The host
sees a group that never reached the scene.

**Cause.** The shared layout calculation publishes all its groups through `groupsModified`
(roomle-ui `hi-tools.ts:883`) before the tool's `_loadGroupLayout` checks the library verdict
(`:740`). Discard then reports a new candidate through `removedGroup` (`glue-logic.ts:1251`),
or a restored replacement through `changedGroupFromHistory` (`:1265`). Each publication also
requests pricing from the group map (`:2783`), initially including the failed candidates.

**To do.** roomle-ui `hi-tools.ts`: separate calculation from publication so the tool completes
all discard cleanup before reporting its final groups. Remove failed new candidates without a
delete notification; report a restored replacement once. Preserve the shared public layout API's
calculation and callback behaviour. No change to `glue-logic.ts`. See the
[open analysis](../bug-analysis/discarded-create-host-notifications.md).

**Test.** roomle-ui `__tests__/hi-tools-test.ts`: a discarded new candidate causes neither an
addition nor a deletion; a discarded replace names one restored change. Price payloads contain
no discarded candidates, including in mixed batches. Preserve successful/direct layout
notifications, partial success, failure identities and history counts.

**Reproduce.** Model-free: add callback spies to the existing create-discard and replace-discard
tests (`hi-tools-test.ts:4619`, `:4548`); the red `cabinet-600` mock reports an added failed group
then its deletion, or two changes for a failed replacement. Both first price payloads also carry
the failed candidate.
