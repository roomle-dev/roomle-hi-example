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
| 62 | [`merge-article-into-group` moves a group placed in the conversation](#62-merge-article-into-group-moves-a-group-placed-in-the-conversation) | defect | roomle-ui `homag-intelligence` (`mergeArticleIntoGroup`) | high | gpt-6-astra | |
| 63 | [The worktop of a handleless kitchen renders white](#63-the-worktop-of-a-handleless-kitchen-renders-white) | defect, not analysed | roomle-ui render or HOMAG library — to analyse | medium | gpt-6-astra | |
| 65 | [A wall of floor-to-ceiling glass the user names is left out](#65-a-wall-of-floor-to-ceiling-glass-the-user-names-is-left-out) | hardening | roomle-hi-example served text (`AUTHORING_RULES`, `hi-mcp-server.ts`) | medium | gpt-6-astra | |
| 66 | [A corner group stands in front of the adjoining wall's window](#66-a-corner-group-stands-in-front-of-the-adjoining-walls-window) | hardening | roomle-ui `obstacleHint` (`hi-tool-hints.ts`) | low | gpt-6-astra | |
| 67 | [The planning skills are served by a tool only](#67-the-planning-skills-are-served-by-a-tool-only) | follow-up | roomle-hi-example MCP server (`hi-mcp-server.ts`, `skills.ts`) | low | | |

`run.json` and `planner-calls.json` of the run directories named under **Reproduce** hold the payload
the model sent; the directories are under `.temp/result/`.

## 62. `merge-article-into-group` moves a group placed in the conversation

**Problem.** On a group that `create-or-replace-groups` placed by wall or by point earlier in the conversation,
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

**Reproduce.** `mcp-test-2026-10-14_13-34-58`: gpt-6-astra 54 (`random-5-island-then-longer`, turn 2, local roomle-ui `6df952e35`): the island placed by point (`posGroup` [750, 0, 5680], rotation 90) stands at z 4480..5680 and moves to z 5090..6890 when a third `US2A60` is merged at the `RightBottom` of the second; without a model the run's two payloads (`planner-calls.json`) on the plan `open-plan-room` give the same move, and on `default-room` two `SB_UB600` placed by wall `back`, centred, then one merged `RightBottom` → `LeftBottom` to the second move from x 1465 to 255.

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

**Reproduce.** `mcp-test-2026-10-14_13-34-58`: gpt-6-astra 47 (`image-planning-right-wall`, plan snapshot `ps_rtop4vedm8hxgx2o2an3wgyg2nm85kn`): white worktops on the wall run and the island in the object image, 324 with the program Style in `order-data.json`.

## 65. A wall of floor-to-ceiling glass the user names is left out

**Problem.** "Add a sideboard of three low cabinets to the front wall" of the living room creates
nothing: the front wall is floor-to-ceiling windows and a door (every opening from `bottomMm` 0 to
2520 mm, between them a 5 mm piece of wall), and the agent answers that the wall has no free stretch
and asks whether to use the back wall. In a request for two groups it builds the other one and
leaves the sideboard out. The user named the wall; a sideboard in front of glass doors is a common
planning.

**Cause.** The served text: the obstacle rule of `AUTHORING_RULES` (`hi-mcp-server.ts`) says "Put a
new group on a stretch of wall or a spot that obstacles leaves free", which the agent reads as a
ban when the whole wall is openings, and nothing says that the wall the user names comes first.

**To do.** Clarify the rule sentence: a wall or a place the user names is where the group goes; the
free stretches are for choosing a place the user leaves open; when the named wall is all openings,
place the group there and say in the answer which openings it stands in front of. Served text only
— no guard, no correction.

**Test.** `sideboard-living-room-front-wall` creates the sideboard against the front wall and the
answer names the windows; `living-room-sideboard-and-tv` creates both groups.

**Reproduce.** `mcp-test-2026-10-14_13-34-58`: gpt-6-astra 05 (`sideboard-living-room-front-wall`): no tool call that changes the plan, the answer asks for another wall.

**Analysis.** [wall-of-glass-the-user-names-left-out.md](../bug-analysis/wall-of-glass-the-user-names-left-out.md): a second cause in roomle-ui — the side label `front` resolves to the longest wall piece of type `wall` on that side (`resolveWall`, `hi-wall-placement.ts`), here the 120 mm end face of the partition in the middle of the room; the served-text change alone puts the sideboard there (the Mistral runs of `mcp-test-2026-10-12_10-23-42` and `mcp-test-2026-10-12_13-35-57`).

## 66. A corner group stands in front of the adjoining wall's window

**Problem.** A group placed by wall into a corner (`alignment` the adjoining wall) whose adjoining
wall has a window within 600 mm of the corner stands in the strip in front of that window; the
create's `hint` names it, and the agent moves the group with `place-group` in the next step — one
step and about 8 s.

**Cause.** The hint names the free stretches of the root module's own wall — which the adjoining
wall's window does not shorten — not the `offsetMm` along the group's wall that clears the window's
strip (`WALL_STRIP_MM`, `hi-wall-placement.ts`; `obstacleHint`, `hi-tool-hints.ts`). The rules name
the 600 mm.

**To do.** Result only, no change of the placement: the hint of a root module in front of an opening
of the adjoining wall names the `offsetMm` along its own wall that clears it.

**Test.** `image-only-no-text`: the create places the left group clear of the back wall's window,
no `place-group` after it.

**Reproduce.** `mcp-test-2026-10-14_13-34-58`: gpt-6-astra 48 (`image-only-no-text`): the left group placed with wall `left`, alignment `back`, `offsetMm` 450, then moved with `place-group` to `offsetMm` 650.

## 67. The planning skills are served by a tool only

**Problem.** The planning skills of `hi-mcp/hi-mcp-server/skills/` reach the agent only through the
tool `get-skill` (`hi-mcp-server.ts:267-295`, `skills.ts`). The server declares no `resources`
capability and no Skills extension, so a host that loads skills by the official MCP extension
`io.modelcontextprotocol/skills` ([SEP-2640](https://modelcontextprotocol.io/seps/2640-skills-extension))
finds none. No client in use supports the extension yet
([client matrix](https://modelcontextprotocol.io/extensions/client-matrix)): Claude Code, Claude
Desktop, Claude web, VS Code Copilot and Cursor do not; `@ai-sdk/mcp` of both chats has no skills
API.

**To do.** When a client in use supports the extension, serve the same files by it in addition,
with no change to the files: `registerResource` per file under `skill://<name>/<path>` with
`text/markdown`; the request handlers `skills/list` and `skills/get` answering per skill its `uri`
(`skill://<name>/SKILL.md`), the frontmatter unchanged and the manifest of its files with the
SHA-256 digest and the byte size computed from the bytes served; the capability
`extensions['io.modelcontextprotocol/skills']` beside `resources` in `createHiMcpServer`
(`hi-mcp-server.ts:128`). `get-skill` stays for the clients without the extension, the two chats
among them. Record it in D75 of `docs/hi-mcp-behaviour.md`.

**Test.** A test in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts`: `skills/list` answers the
three skills with the manifest of `loadSkills()`, and `resources/read` of every manifest entry
answers bytes whose SHA-256 and size match it; the MCP Inspector CLI `--verify` passes against the
local server.

**Reproduce.** `tools/list` and `initialize` of the local server (`npm start`): the capabilities
carry no `resources` and no `extensions`.

**References.** [RML-18148](https://roomle.atlassian.net/browse/RML-18148), D75 and
[§5.6](../../docs/hi-mcp-behaviour.md#56-planning-skills-get-skill) of `hi-mcp-behaviour.md`.
