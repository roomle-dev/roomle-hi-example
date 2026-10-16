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
| 63 | [The worktop of a handleless kitchen renders white](#63-the-worktop-of-a-handleless-kitchen-renders-white) | defect, not analysed | roomle-ui render or HOMAG library — to analyse | medium | gpt-6-astra | |
| 66 | [A corner group stands in front of the adjoining wall's window](#66-a-corner-group-stands-in-front-of-the-adjoining-walls-window) | hardening | roomle-ui `obstacleHint` (`hi-tool-hints.ts`) | low | gpt-6-astra | |
| 67 | [The planning skills are served by a tool only](#67-the-planning-skills-are-served-by-a-tool-only) | follow-up | roomle-hi-example MCP server (`hi-mcp-server.ts`, `skills.ts`) | low | | |
| 68 | [The room corners leave out a corner where an opening meets a wall](#68-the-room-corners-leave-out-a-corner-where-an-opening-meets-a-wall) | defect | roomle-ui `roomCorners` (`hi-plan-space.ts`), roomle-hi-example `roomCorners` (`agent-facing.ts`) | low | | |

`run.json` and `planner-calls.json` of the run directories named under **Reproduce** hold the payload
the model sent; the directories are under `.temp/result/`.

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

**Reproduce.** `mcp-test-2026-10-16_11-57-20`: gpt-6-astra 47 (`image-planning-right-wall`, plan snapshot `ps_s04glgtbh6qi0llnwzbyy4wl79vdgng`): white worktops on the wall run and the island in the object image, 326 with the program Style in `order-data.json`.

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

## 68. The room corners leave out a corner where an opening meets a wall

**Problem.** The `corners` of a room in `get-plan-context` list a corner only where two segments of
type `wall` meet. The living room of the prompt tests has no front left corner at
`[-3185, 0, 2235]` and no front right corner at `[6320, 0, 2235]`: a floor-to-ceiling window ends
there. The faces of the partition inside the room are listed as room corners instead, among them a
"front right" corner at `[1810, 0, -2550]`. An agent that reads the corners for a placement by point
finds the wrong corner or none.

**Cause.** `roomCorners` (roomle-ui `hi-plan-space.ts`, and the server's copy in
`hi-mcp/hi-mcp-server/agent-facing.ts`) takes the walls of type `wall` only and the walls of every
subpath of the contour as walls of the room. A placement by side label finds the corner of a wall
face (D81); the corners list does not.

**To do.** Build the corners from the faces (`wallFaces`): a corner where one face ends and the
next starts at an angle. Decide whether the faces of an inner subpath — a partition — give room
corners.

**Test.** roomle-ui `__tests__/hi-plan-space-test.ts` (`describe('roomCorners')`) and
`it('names the walls, marks the openings and lists the room corners')` in
`hi-mcp/hi-mcp-server/tests/tool-executors.test.ts`: the living-room walls give the outer corners,
the front left and the front right ones included.

**Reproduce.** `mcp-test-2026-10-14_13-34-58`: gpt-6-astra 05 (`sideboard-living-room-front-wall`), `rooms.rooms[0].corners` of `plan-context.json`.
