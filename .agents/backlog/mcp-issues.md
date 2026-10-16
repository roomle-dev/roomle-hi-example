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
| 66 | [A corner group stands in front of the adjoining wall's window](#66-a-corner-group-stands-in-front-of-the-adjoining-walls-window) | hardening | roomle-ui `obstacleHint` (`hi-tool-hints.ts`) | low | gpt-6-astra | |
| 67 | [The planning skills are served by a tool only](#67-the-planning-skills-are-served-by-a-tool-only) | follow-up | roomle-hi-example MCP server (`hi-mcp-server.ts`, `skills.ts`) | low | | |
| 68 | [The room corners leave out a corner where an opening meets a wall](#68-the-room-corners-leave-out-a-corner-where-an-opening-meets-a-wall) | defect | roomle-ui `roomCorners` (`hi-plan-space.ts`), roomle-hi-example `roomCorners` (`agent-facing.ts`) | low | | |
| 72 | [The wall units hang at two heights after a plinth height in the group attributes](#72-the-wall-units-hang-at-two-heights-after-a-plinth-height-in-the-group-attributes) | defect | roomle-ui `create-or-replace-groups` tool command (`hi-tool-commands.ts`, `hangGapOf` in `hi-group-layout.ts`) or the planner — not analysed | medium | gpt-6.1-sol | |
| 73 | [A wall-unit side panel beside a wall unit is moved into the floor row](#73-a-wall-unit-side-panel-beside-a-wall-unit-is-moved-into-the-floor-row) | defect | roomle-ui `relationsToDocking`, `isWallUnitArticle` (`hi-group-layout.ts`) | low | gpt-6.1-sol | |
| 74 | [An island's back row of other widths lands off the front row](#74-an-islands-back-row-of-other-widths-lands-off-the-front-row) | hardening | roomle-hi-example served text (`hi-mcp-server.ts`, `behind`), roomle-ui `relationsToDocking` (`hi-group-layout.ts`) | low | gpt-6.1-sol | |

`run.json` and `planner-calls.json` of the run directories named under **Reproduce** hold the payload
the model sent; the directories are under `.temp/result/`.

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

**Test.** A test in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts`: `skills/list` answers every
skill with the manifest of `loadSkills()`, and `resources/read` of every manifest entry
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

**Reproduce.** `mcp-test-2026-10-16_11-57-20`: gpt-6-astra 05 (`sideboard-living-room-front-wall`), `rooms.rooms[0].corners` of `plan-context.json`.

## 72. The wall units hang at two heights after a plinth height in the group attributes

**Problem.** A create whose group attributes set a plinth height other than the library's
(`mod_PlinthAreaHeight` 150 or 120 against 100) hangs the wall units of one kitchen at two heights.
The library raises the floor and tall units by the difference and one wall unit — every raised one
stood beside a tall unit —, the corrections name them (D59); the other wall units and the range hood
keep the height of the old plinth, 50 or 20 mm below the tall units that D35 hangs them flush with.

**Cause.** Not analysed. The hang gap of a wall unit `above` a floor unit is relative to the floor
unit (D35, `hangGapOf`: the plinth cancels out); the group attributes are set after the load (D36);
after a reload the kernel's docking no longer links a wall unit to the floor unit it was placed above
(D42). A wall unit placed above a floor unit may therefore keep its height when the floor unit rises,
while the wall unit beside a tall unit follows it.

**To do.** Analyse where the height of the wall units is fixed and why only the one beside a tall
unit follows the plinth. Then every wall unit hung above a floor unit stays flush with the tall units
after the group attributes change the plinth height — no change of the served text.

**Test.** A roomle-ui test of `create-or-replace-groups` with `mod_PlinthAreaHeight` in the group
attributes (`__tests__/hi-tool-commands/create-or-replace-groups-input-test.ts`), and
`kitchen-back-right-corner`: every wall unit's top at the tall units' top.

**Reproduce.** `mcp-test-2026-10-16_19-30-19`: gpt-6.1-sol 35 (`kitchen-back-right-corner`): `mod_PlinthAreaHeight` 150 in the group attributes; `O2TB90` at 1480 to 2200 and the hood at 1480, the `OTB60` beside the fridge-freezer at 1530 to 2250 like the fridge (`obstacles.groups` of `plan-context.json`).

## 73. A wall-unit side panel beside a wall unit is moved into the floor row

**Problem.** The agent puts the wall-unit side panel `W35O` ("Wall-unit side / cover panel",
category "Kitchen / Cover Panels / Side Panels") `rightOf` a wall unit to close the wall-unit row.
The tool command takes it for a floor unit — "floor unit 'wallend' cannot stand rightOf the wall unit
'cups' - it continues the floor row" —, drops the relation, puts it `rightOf` the last root by
default and docks it at the free end of the floor leg, where a wall-unit panel stands on the floor.

**Cause.** `isWallUnitArticle` (`hi-group-layout.ts`) knows a wall unit by the words "Wall Units" in
the category, or a hood; a wall-level article of another category counts as a floor unit, and the
correction for a floor unit beside a wall unit moves it. The correction changes what the agent
asked for instead of carrying it out ([Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort):
correct only where the intent is clear).

**To do.** Tell wall-level articles from floor articles by data the library gives every article —
its default mounting height or its docking vectors — rather than by a category word, so an article
`rightOf` a wall unit docks beside it; until then, keep an article the agent puts beside a wall unit
there and report it, rather than moving it to the floor row.

**Test.** `__tests__/hi-group-layout-test.ts`: a wall-level panel `rightOf` a wall unit docks to the
wall unit's side.

**Reproduce.** `mcp-test-2026-10-16_19-30-19`: gpt-6.1-sol 50 (`kitchen-conversation`, turn 1, the first `create-or-replace-groups`): `wallend` (`W35O`) `rightOf` the wall unit `cups` (`OFKB60`), the three corrections on `wallend`.

## 74. An island's back row of other widths lands off the front row

**Problem.** For an island with a front row of 900, 600 and 900 mm units and a back row of four
600 mm units, the agent docks the first back unit `behind` the 900 mm unit at the end of the front
row and the others `rightOf` it. The back row lines up with the inner end of that unit and runs past
the far end of the front row: 300 mm off at both ends, a step in the worktop.

**Cause.** The served description of `behind` ("back to back with that root module, turned by 180
degrees (an island)", `hi-mcp-server.ts`) says neither where a turned unit lines up with a wider
neighbour nor which way `rightOf` runs in the turned row. The compile docks the back vectors to each
other (`relationsToDocking`, `hi-group-layout.ts`): in this run the turned unit lines up with its
neighbour's left end, seen from the neighbour's front, and `rightOf` in the turned row runs on to that
side.

**To do.** Clarify the description of `behind` first: where a turned unit lines up and which way the
relations run in a turned row, in library-neutral words. If that does not suffice, simplify the API:
the server lines up a unit `behind` a wider one at the end the agent names (`align`) and derives the
offset.

**Test.** `image-planning-right-wall`: the island's two rows end flush at both ends.

**Reproduce.** `mcp-test-2026-10-16_19-30-19`: gpt-6.1-sol 48 (`image-planning-right-wall`, the second `create-or-replace-groups`, the island group): `rear1` (`EUTB60`) `behind` `islandright` (`EUS2A90`), `rear2` to `rear4` `rightOf`; back row z -3240 to -840 against the front row z -2940 to -540.
