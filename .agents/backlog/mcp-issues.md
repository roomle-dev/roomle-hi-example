# Open MCP issues

> **Type**: Backlog — defects and hardening in the MCP server, chat and planner
> **Domain**: hi-mcp — `create-or-replace-groups`, `merge-article-into-group`, the command tools
> (`hi-mcp/hi-mcp-server/tool-executors.ts`, `group-layout.ts`, `group-placement.ts`), the served
> text (`hi-mcp-server.ts`), the chat (`hi-mcp/hi-mcp-chat`); roomle-ui defects the runs show
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
| 62 | [`merge-article-into-group` moves a group placed in the conversation](#62-merge-article-into-group-moves-a-group-placed-in-the-conversation) | defect | roomle-ui `homag-intelligence` (`mergeArticleIntoGroup`) | high | gpt-6-astra | |
| 63 | [The worktop of a handleless kitchen renders white](#63-the-worktop-of-a-handleless-kitchen-renders-white) | defect, not analysed | roomle-ui render or HOMAG library — to analyse | medium | gpt-6-astra | |

`run.json` and `planner-calls.json` of the run directories named under **Reproduce** hold the payload
the model sent; the directories are under `.temp/result/`.

## 62. `merge-article-into-group` moves a group placed in the conversation

**Problem.** On a group that `create-or-replace-groups` placed by wall earlier in the conversation,
`merge-article-into-group` docks the new root module where asked but moves the whole group by its
former width towards its left end: the new root module stands where the group's origin was. A
sideboard of two cabinets centred on the back wall of the living room (x -1225 to -25) stands at
x -2435 to -635 after one cabinet is merged on its right; on the right wall of the default room the
group slides into the back corner. The tool result reports no move, and the agent's answer says
nothing of it. Groups loaded from a plan snapshot keep their place under the same merge (the tests
`two-wardrobes-add-third` and `edit-add-one-unit`).

**Cause.** Not analysed. `mergeArticleIntoGroup` (roomle-ui
`homag-intelligence/src/hi-tools.ts:625`) rebuilds the group from a copy of its `posDataJson`
with the new root module and its docking (`createOrReplacePosGroupsFromLayout`) and loads it with
`applyGroupPosition: true`. Which position data of a group placed by wall (`hi-wall-placement.ts`)
puts the rebuilt group at the new root module remains to be traced.

**To do.** roomle-ui: keep the earlier root modules of the group in place when a root module is
merged; a merge only adds one.

**Test.** roomle-ui `__tests__/hi-tool-commands/`: a group placed by wall, then a root module merged
right of its last root module — the earlier root modules keep their positions; the same for a group
loaded from a snapshot. The random test `random-1-living-room-sideboard-extend-and-shrink` of the
Reproduce session as a fixed test.

**Reproduce.** `mcp-test-2026-10-13_17-19-39`: gpt-6-astra 50 (`random-1-living-room-sideboard-extend-and-shrink`, turn 2, local roomle-ui `56256a5b7`): the sideboard moves from x -1225..-25 to x -2435..-635. Without a model on the plan `default-room`: `create-or-replace-groups` with two `SB_UB600` (the second `rightOf` the first) and the placement wall `back`, alignment `center`, then `merge-article-into-group` with an `SB_UB600` docked `RightBottom` → `LeftBottom` to the second: the group moves from x 1465 to 255.

## 63. The worktop of a handleless kitchen renders white

**Problem.** In the handleless kitchen of the test `image-planning-right-wall` both countertops carry
`mod_CountertopColor` 324 (Dark marble) with `mod_CountertopProgram` Style in the order data, but
the planner renders a plain white worktop. The same countertop attributes render dark marble in a
handled kitchen (`full-kitchen-walnut-marble-corner`). The agent cannot see the difference.

**Cause.** Not analysed — the planner's render of the countertop in the handleless line, or the
library data.

**To do.** Analyse: load the plan snapshot of the Reproduce run, compare the countertop material of
the handleless kitchen with that of the handled one; fix it where it lies (roomle-ui, or a library
issue).

**Test.** `image-planning-right-wall`: the worktops render in the colour of `mod_CountertopColor`.

**Reproduce.** `mcp-test-2026-10-13_17-19-39`: gpt-6-astra 47 (`image-planning-right-wall`, plan snapshot `ps_rquv2y2uf7eho5aobjjfumjd8vdo2dq`): white worktops in the top and object images, 324 in `order-data.json`.
