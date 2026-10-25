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
| 111 | [A discarded new group of a create names its root modules by ids the call never sent](#111-a-discarded-new-group-of-a-create-names-its-root-modules-by-ids-the-call-never-sent) | defect | roomle-ui `_loadGroupLayout` (`hi-tools.ts`) | low | | |
| 112 | [A discarded group of a create is reported to the host as added and then deleted](#112-a-discarded-group-of-a-create-is-reported-to-the-host-as-added-and-then-deleted) | defect | roomle-ui the create of a `posGroups` layout (`hi-tools.ts`) | low | | |

`run.json` and `planner-calls.json` of the run directories named under **Reproduce** hold the payload
the model sent; the directories are under `.temp/result/`. The root `logMessages` in `plan.xml`'s
`externalConfiguration` retain library calculation diagnostics that compact plan contexts omit.

## 111. A discarded new group of a create names its root modules by ids the call never sent

**Problem.** When the library cannot calculate a new group of `create-or-replace-groups`, the tools
discard it before the load (D106), and the error and `notLoaded[].rootIds` name its root modules,
and the group, by the ids the planner gave them: "posGroups[0]: nothing was changed - the library
could not calculate root module 'id0002' (cabinet-600) of group 'id0003' - …". The call sent the
root `u1` and no group id, and the plan never holds either id. A root module a replace adds is
named the same way.

**Cause.** The tools give every root module of a new group, and a root module a replace adds,
a fresh id (`_replaceRootModuleIdsAndRemapDockedRoots`, roomle-ui `hi-tools.ts:961`, the map `:965`).
`_loadGroupLayout` (`hi-tools.ts`) calls `newLibraryFailures` without names for them. The staged
row edits name the units they add through `newRoots` of `newLibraryFailures`; the create does not.

**To do.** roomle-ui `hi-tools.ts`, `_loadGroupLayout`: pair the root modules of a built group with
the roots of `layout.posGroups[outcome.index]` — a root kept in a replace by its id, the others by
their order when the articles line up, as `loadedRootOf` (`hi-tool-attributes.ts`) does after the
load — and hand the call's root ids to `newLibraryFailures` as `newRoots`; name a new group the plan
does not hold by its `posGroups[i]` prefix alone. An article with several root modules expands into
roots the call did not name (`<id>:<index>`), which keep their ids. No change to `glue-logic.ts`.

**Test.** roomle-ui `__tests__/hi-tools-test.ts`:
`it('discards a new group of a create the library could not calculate before the load and builds the others')`
names `u1` in the error and in `notLoaded[].rootIds` instead of any id; a replace that adds a root
the library cannot calculate names it by the call's id.

**Reproduce.** Model-free, unit level: `create-or-replace-groups` with one new group, root `u1`, that
the library cannot calculate (the setup of the create discard test) names
`root module 'id0002' (cabinet-600) of group 'id0003'`.

## 112. A discarded group of a create is reported to the host as added and then deleted

**Problem.** A new group of a create that the tools discard before the load (D106) is reported to
the host as added and then as deleted; a discarded replace is reported as changed twice. The host
sees a group that never reached the scene.

**Cause.** The create of a `posGroups` layout reports its groups to the host at its end
(`groupsModified`, roomle-ui `hi-tools.ts:863`, `glue-logic.ts:2756`), and the discard of a group
the library could not calculate removes it again: a new group through `removedGroup`
(`glue-logic.ts:1251`), a replaced group back through `changedGroupFromHistory`
(`glue-logic.ts:1265`). With the create in the tools, the verdict could come before the report.

**To do.** roomle-ui `hi-tools.ts`, `createOrReplacePosGroupsFromLayout`: check the groups the
library could not calculate before the report and report only what loads — a discarded new group
is never reported as added, a discarded replace is reported once. No change to `glue-logic.ts`.

**Test.** roomle-ui `__tests__/hi-tools-test.ts`: the host notifications of a discarded new group
of a create name no added group; a discarded replace names one change.

**Reproduce.** Model-free, unit level: `create-or-replace-groups` with one new group the library
cannot calculate (the setup of the create discard test) reports the group to the host as added
and then as deleted.
