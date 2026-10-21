# HI tools — behaviour

> **Living reference.** It describes how the HI tools of roomle-ui — served by the planner
> (`packages/web-sdk/packages/homag-intelligence/src/hi-mcp/`) and handed to an agent in the page by
> `createHiMcpTools` of the embedding-lib — behave towards an agent: the guidelines and decisions it follows, its tools, the information it provides, and every
> guard, automatic correction and feedback message. Every change to a tool, a served rule, a guard, a
> correction or a result updates this document in the same change.
>
> **State**: the code of 2026-10-13 — with the plan-changing tools performed by roomle-ui (D71, D72),
> with the placement of a new group by wall
> ([RML-18078](https://roomle.atlassian.net/browse/RML-18078), D23), with the obstacles of the plan context
> ([RML-18036](https://roomle.atlassian.net/browse/RML-18036), D45) and the hint that names a root
> module on an obstacle ([RML-18077](https://roomle.atlassian.net/browse/RML-18077), D55) —, with the group materials set
> after a replace too and new root modules that inherit from their neighbour ([RML-18075](https://roomle.atlassian.net/browse/RML-18075), D36, D56) —, the served text speaks of
> articles and root modules, not of kitchens (D44), with the row edit tools
> ([RML-18045](https://roomle.atlassian.net/browse/RML-18045)) and the undo and redo tools
> ([RML-18044](https://roomle.atlassian.net/browse/RML-18044)), after the fixes of the MCP test backlog
> ([RML-18041](https://roomle.atlassian.net/browse/RML-18041)), which built on the refactoring of
> the guards ([RML-18033](https://roomle.atlassian.net/browse/RML-18033)).
> A decision that is not implemented yet is marked **planned**; every other one is in effect.
>
> **Not covered here**: the example page and its setup. See
> [hi-mcp-server.md](hi-mcp-server.md) and [ai-chat.md](ai-chat.md).

## Contents

1. [Scope](#1-scope)
2. [Guidelines](#2-guidelines)
3. [Decisions](#3-decisions)
4. [How a tool call runs](#4-how-a-tool-call-runs)
5. [Information the server provides](#5-information-the-server-provides)
6. [Tools](#6-tools)
7. [Positioning](#7-positioning)
8. [Guards, corrections and feedback](#8-guards-corrections-and-feedback)
9. [Limits](#9-limits)

## 1. Scope

The server gives an agent tools to read and change HOMAG Intelligence (HI) object groups — a
kitchen, a row of cabinets — in a live Roomle planner session in the user's browser. Every planner
call runs in the connected page, and the page executes only the planner methods on its allow-list
([ADR 0001](../.agents/decisions/0001-hi-mcp-tool-logic-in-the-server.md)). A tool that changes the
plan is one planner call, `externalObjectGroupOperation(<tool name>, <the tool's arguments>)`, and
roomle-ui performs the whole tool (D71).

Three parts have different responsibilities:

- **The MCP server** (`hi-mcp/hi-mcp-server`) decides what the agent is told: the served text and
  the tool schemas, the plan context in the agent's words, `find-attributes`, and the undo and redo
  of tool calls.
- **The HI tool commands** (roomle-ui `homag-intelligence`, `hi-tool-commands.ts`) turn the agent's
  input of a plan-changing tool into planner operations: they correct the input, build the docking,
  place the group and answer with the tool's result. Their guards and corrections follow the
  [guidelines](#2-guidelines) of this document.
- **The planner's group operations** (roomle-ui `runGroupOperation`, `hi-plan-context.ts`) decide what
  can be built. Their checks protect the planner from breaking, and they are not loosened for the
  agent. Where it can, the tool command corrects the input before it runs an operation, and it
  passes the planner's messages on to the agent ([§8.5](#85-command-tools)).

In this document, "the server" is what the agent talks to — the MCP server together with the tool
commands its plan-changing tools run in roomle-ui. The code locations name the part.

## 2. Guidelines

### 2.1 The agent declares what and where, the planner arranges

The agent picks articles, sets their attributes, names for every unit one neighbour with one
relation (D34), and gives a new group a wall with an alignment, or one point and one rotation
(D23). The planner calculates every root
position. The server completes everything else: the docking from the relations, the article
template, the docking indices, the anchor root, and the anchor's frame — where its back left bottom
corner lies (D33).

### 2.2 Guards are a last resort

A **guard** refuses agent input because it identifies the input as wrong. A guard fights the
symptom: when an agent creates wrong content, the root cause is the MCP instructions — a rule, a
tool description or an example misleads the agent, asks it to combine more than it can, or the tool
API makes the wrong payload easy to write. The server therefore takes the first step that works:

1. **Clarify the instructions** that led the agent there — shorter, not longer.
2. **Simplify the tool API**, so that the server derives what the agent would otherwise have to
   compute or encode, and the wrong payload cannot be written.
3. **Correct the input and inform the agent.** When the intent is clear, the server corrects the
   input, builds the planning, and says in the result what it corrected.
4. **Give feedback and ask for the correction.** When the server cannot correct the input, it still
   builds what it can. The result says what was not built, why, and what to send instead.
5. **Reject only when nothing in the call can be built.**

The full guideline, with the rules for adding a guard, is in
[AGENTS.md — Guards Are a Last Resort](../AGENTS.md#guards-are-a-last-resort).

### 2.3 Feedback to the agent

Every result tells the agent what happened:

- **what was built** — the resulting groups with their position
- **what the server corrected, and what the planner or the library changed beyond what was sent** — a
  `corrections` list, one sentence per correction (C20, D59)
- **what was not built or fully calculated, and why** — a `notLoaded` list (`create-or-replace-groups`) that names what to send instead: a group, or with `rootIds` the roots that were omitted or whose loaded calculation has an `Error` or `Fatal` diagnostic
- **what to check** — a `hint` that stops nothing

An error result (`isError`) is the answer only when nothing could be done. A message names the fix
("dock it to …", "send …"), not only the fault. The tool result is the only feedback channel the
server uses, because every MCP client supports it.

### 2.4 Instructions

- **One source.** The served text lives in `hi-mcp-server.ts`: `INSTRUCTIONS`, `AUTHORING_RULES` and
  the tool descriptions. Documents describe that text; they never extend it.
- **Describe how to succeed**, not what is rejected. `tests/hi-mcp-server.test.ts` keeps the
  served text free of rejections and checks that it explains `corrections` and `notLoaded`.
- **Keep it short and plain.** A rule that needs a long explanation is a candidate for simplifying
  the API.
- **Explain relevant openings.** The `get-plan-context` description asks the agent to name a door
  or window that determines a placement and say whether the final placement keeps it clear,
  using the returned obstacle dimensions and final tool results. Both chats receive this sentence
  in the tool list, even without reading `get-authoring-rules`.
- **Library-neutral.** The server serves every HI library. The served text, the results and the
  server's logic carry no information about a specific library — no article, category, attribute,
  value or measure of one library, not even as an example. The only source of library information
  is the library data the plan context passes on: the master data and the article list, and in them
  the `desc` properties (D8). When the agent picks the wrong library content because it lacks
  information, the fix is the desc in the library data, never a served rule. The policy covers the
  served text, the results and the server's logic only: code comments, tests and markdown files are
  no violation.
- **Planning skills are served text on demand.** How to plan a room of one kind well — a kitchen,
  a living room — and how to plan from an image the user sends lives in skill files of the server
  package (`hi-mcp/hi-mcp-server/skills/`) and reaches the agent through `get-skill` and, in a host
  that supports the Skills extension of MCP, as that host's skills (D75,
  [§5.6](#56-planning-skills-get-skill)). The skill index in the description of `get-skill` is the
  one served text that names a kind of room; the general served text stays neutral. A skill is
  domain knowledge, not library content: it never names one library's article, attribute or value.
  The system prompt of the chats, which comes from the planner, names the skills too (D80).
- **Never mention internals**: `repositioningData`, the anchor frame, `rootRelPos`, `cornerPoint`,
  `externalObjectGroupOperation`. `tests/hi-mcp-server.test.ts` guards this
  ("never tells the agent how the server positions a group internally").

## 3. Decisions

Decisions about the behaviour towards the agent. **State**: *in effect* (implemented), *planned*
(decided, not implemented yet), *superseded* (replaced by a later decision, kept for the record).

### Architecture

| # | Decision | Date | Source | State |
|---|---|---|---|---|
| D1 | The tool logic runs in the MCP server. Pages execute only the planner methods on their allow-list, and the allow-list is the page's security boundary | 2026-09-29 | [ADR 0001](../.agents/decisions/0001-hi-mcp-tool-logic-in-the-server.md) | superseded in part by D71 — the tool logic of the plan-changing tools runs in roomle-ui; the allow-list stays the page's security boundary, `planner-api.ts` |
| D2 | Planner methods that place orders or overwrite the plan are added to the allow-list only by explicit decision | 2026-09-29 | ADR 0001 | in effect |
| D3 | **Group edits are commands the planner performs** with its own group features, through one planner method, `externalObjectGroupOperation(command, payload)`: a new command is a payload, not a new page allow-list entry. Every command is its own MCP tool with its own schema and description — no generic `group-operation` tool. Rejected: one planner method per command (an allow-list entry in every page per command), and the edits rebuilt by the server on the replace path (it would re-implement the planner's swap, delete and merge with their load reasons, id maps and the kernel's split). `update-attribute` is retired | 2026-09-30 | [RML-18004](https://roomle.atlassian.net/browse/RML-18004) | in effect — `runGroupOperation` (roomle-ui `hi-plan-context.ts`); the command tools, `HI_TOOL_COMMANDS` (roomle-ui `hi-tool-commands.ts`) |
| D4 | Tools that change the plan run one after another, never side by side | 2026-09-30 | `oneAtATime`, `tool-executors.ts` | in effect |
| D5 | The planner's checks protect the planner and are not changed for the agent. The server corrects input before forwarding it | 2026-10-02 | user decision | in effect |
| D37 | `undo` and `redo` join the page allow-lists by explicit decision (D2): they step through the planner's own undo history, as its undo button does, and place or overwrite nothing beyond it. The page relays the planner's `onHistoryChange` as a bridge event, so the server can tell the planner steps of its tool calls from the changes the user makes in the planner | 2026-10-05 | [RML-18044](https://roomle.atlassian.net/browse/RML-18044) | in effect — `planner-api.ts`, `plan-history.ts`, `browser-bridge.ts` |
| D38 | **The agent's undo reverts tool calls only.** The server records every tool call that changed the plan with the planner steps it made; `undo` reverts the last one while the plan is as that call left it. A history event while no tool call runs is a change in the planner: the server forgets its records, and `undo` says so — the planner's undo button serves the user's own changes | 2026-10-05 | [RML-18044](https://roomle.atlassian.net/browse/RML-18044) | in effect — `plan-history.ts`, `recorded`, `revertToolCall`, `tool-executors.ts` |
| D47 | **Undo steps back through the planner's own history.** `undo` calls the planner's `undo()` once per step the tool call made, and checks the plan against the one before the call. Rejected: a server snapshot restored by a load — a re-created group gets new ids, the library recalculates every restored group and may discard a replace it cannot calculate, the restore adds steps the user's undo button then undoes, and the user's own edits are overwritten; and stepping back blindly by a step table without the relayed history events — nothing would tell an empty or cleared history or a user's edit. The step count comes from roomle-ui: the planner runs a tool call as one step and the tool command reports it (`historySteps` 1, or 0 when it changed nothing; D77, D79) | 2026-10-05 | [RML-18044](https://roomle.atlassian.net/browse/RML-18044) | in effect — `countingPlannerApi`, `revertToolCall`, `tool-executors.ts`; `runToolCommand`, roomle-ui `hi-tool-commands.ts` |
| D6 | In the planner, merge, split, delete and move are always carried out, even if the result is incorrect; the errors of a previous operation never block the next one | 2026-10-01 | user rule (RML-18017, roomle-ui glue logic) | in effect (roomle-ui) |
| D71 | **The tool logic of the plan-changing tools runs in roomle-ui, and the planner API of the tools stays at six methods.** Every tool that changes the plan is one planner call, `externalObjectGroupOperation(<tool name>, <the tool's arguments>)`: roomle-ui runs a command named like a tool as that tool (`HI_TOOL_COMMANDS`) — the corrections, the id and article resolution, the docking from the relations (D72), the placement by point and by wall, the group materials, the hints, the library changes, `notLoaded`, the positions in the placement frame and `rowIndex` — and answers with the tool's result plus the planner step it made (`historySteps`, D47, D79). The commands read the plan context and the calculated groups, load layouts and calculate article templates in the planner itself. The server keeps the tool registry and the served text, the plan context in the agent's words, `find-attributes`, the serialisation of plan changes (D4) and undo and redo (D38). The tools call `getExternalObjectPlanContext`, `externalObjectGroupOperation`, `fetchPrice`, `getExternalObjectSnapshot`, `undo` and `redo`; a new plan-changing tool is a command, not a planner method. Rejected: the logic in the server with more planner methods — every need adds a method to every page allow-list, the server re-derives the geometry the planner has calculated, and an article that is not in the plan has no geometry for any other consumer; a planner method per tool — a command is cheaper than a method (D3) | 2026-10-13 | user ([RML-18147](https://roomle.atlassian.net/browse/RML-18147)) | in effect — `HI_TOOL_COMMANDS`, `runToolCommand`, roomle-ui `hi-tool-commands.ts`; `executeGroupOperation`, roomle-ui `hi-tools.ts`; `inPlanner`, `tool-executors.ts`; `planner-api.ts`, `PLANNER_METHODS` (`browser-bridge.ts`); guarded by `it('calls exactly the planner methods the page bridge exposes')` in `hi-mcp/hi-mcp-server/tests/planner-api.test.ts` and `it.each(toolCalls)('runs %s in the planner with its arguments as sent and returns the result without the planner steps')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` |
| D94 | **The tools run in the planner and reach the page through the roomle-ui embedding-lib.** The planner serves the tool set: `getExternalObjectAgentTools()` lists the tools as `tools/list` does, `callExternalObjectAgentTool(name, input)` runs one as `tools/call` does ([ADR 0012](../.agents/decisions/0012-the-hi-tool-set-runs-in-the-planner.md)). `createHiMcpTools(roomDesignerApi)` of `@roomle/embedding-lib/hi` turns them into an AI SDK tool set without the MCP protocol, which a host passes to its own `streamText`, and forwards every call. It returns MCP-shaped results, so the model gets the texts, the images, the validation errors and the thrown errors as a tool result with `isError`, and a call the planner does not answer as such a result too; the AI SDK adds `additionalProperties: false` to nested objects of the input schemas, where an MCP server sets it on the top level only. A tool change updates the fixture of the roomle-ui tests (`packages/web-sdk/packages/test-helpers/unit/hi-mcp-fixture.json`) in the same commit. Rejected: the zod schemas handed to the AI SDK as they are — other error texts as error outputs, and no `isError` for the hosts' recovery; an MCP server in the page — the MCP SDK in the host bundle; the tool code statically in the planner bundle — every planner would load zod and the tools also without a chat, so the planner loads them as a lazy chunk on the first call | 2026-10-20, 2026-10-21 | user | in effect — roomle-ui `packages/web-sdk/packages/homag-intelligence/src/hi-mcp/` and `packages/embedding-lib/src/homag-intelligence/hi-mcp-tools.ts`; guarded by `it('serves the tools of the server with their names, descriptions and input schemas')` in roomle-ui `packages/web-sdk/packages/homag-intelligence/__tests__/hi-mcp/hi-mcp-fixture-test.ts`, `test('getExternalObjectAgentTools should list the HI agent tools as the MCP server lists them')` in `planner-core/__tests__/roomle-planner.ts`, and `it('passes invalid input to the model as the validation text of the MCP SDK in a tool result, not as an error output')`, `it('hands the model the tools of the MCP server, with the objects of the input schemas closed')` in `tests/unit/embedding-lib/homag-intelligence/hi-mcp/hi-mcp-stream-text.spec.ts` |

### Information for the agent

| # | Decision | Date | Source | State |
|---|---|---|---|---|
| D7 | `imageUrl` is stripped from every JSON result: signed CDN URLs no agent can open, three quarters of the plan context's tokens. Stripped in the server for every MCP client — not in a chat client, and not in roomle-ui, whose plan context also serves the page | 2026-10-01 | Mistral context overflow in "test the mcp" ([PR #39](https://github.com/roomle-dev/roomle-hi-example/pull/39)) | in effect — `withoutImageUrls`, `hi-mcp-server.ts` |
| D8 | Every `desc` is authoritative, and `dimensions` give an article's size — over the catalog images only. A wrong `desc` is fixed in the library data, never worked around in the instructions: the descs of `UELTB90` and `UERTB90` name the opposite hand, and an agent asked for a hand takes the article the desc names | 2026-10-01 | user | in effect — rules `hi-mcp-server.ts:9`; guarded by `it('limits the desc-over-image rule to the catalog images')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` |
| D53 | **A colour code in the desc of an attribute value is the colour of that value**, taken as it is: a `#rrggbb` code — `Cloudy blue (#506080)` — tells light from dark and one hue from another, not the name. The rules and the descriptions of `get-plan-context` and `find-attributes` say so. The agent never sees a thumbnail (D7); the library tooling takes the code from the desc and analyses a thumbnail only for a value without one. Every Furniture_Smith colour value with a thumbnail carries its code. Rejected: a `colour` field the server derives — the desc reaches the agent unchanged, and the field would repeat it on every selection of every match; a sentence telling the agent to analyse the thumbnail of a value without a code — the agent sees no thumbnail (D7), and it would contradict D8 | 2026-10-07 | user | in effect — rules `hi-mcp-server.ts:9`; guarded by `it('tells the agent that a colour code in a desc is the colour of the value')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` |
| D9 | The groups of the plan context carry no parts and no log messages. The parts stay in the planner's calculated groups: the footprint, the placement geometry of the tool commands, the planner's article pick detection and its part list read them | 2026-10-01 | user | in effect — roomle-ui `shapeRoot`, `shapeGroup` |
| D48 | **The plan context is agent-ready as the planner returns it.** roomle-ui shapes it (`hi-plan-context.ts`): the master data reduced to the root modules — the generated ones included — and their customer-facing or Bool attributes, which `find-attributes` searches, plus the library's group settings, the attributes of its group orchestrator (`groupSettings`, [RML-18075](https://roomle.atlassian.net/browse/RML-18075)); the catalog with the docking vectors and the corner flag of every article (D74); the groups; the room contour in 3D (`[x, level, -y]`, the system of a group's `pos`) with the derived walls; the obstacles; the group positions in the frame of a placement with the `rowIndex` of every root (C14, D66). The pages pass it through. The server adds its own vocabulary — wall names, corners, the wall of a door or window (C18, C21) — and removes what the agent must not see (D7, D10). The footprint geometry exists twice in roomle-ui, in group space for the plan context (`hi-plan-context.ts`) and in room space for the placement (`hi-plan-space.ts`): accepted | 2026-09-28 | [RML-17966](https://roomle.atlassian.net/browse/RML-17966) | in effect — roomle-ui `getPlanContext`, `hi-plan-context.ts`, with `groupSettings` ([RML-18075](https://roomle.atlassian.net/browse/RML-18075)) |
| D10 | The agent is never told how the server positions a group internally; the articles' `cornerPoint` is removed from the plan context | 2026-09-30 | [RML-18007](https://roomle.atlassian.net/browse/RML-18007) Task 1, P3 | in effect — `agentFacingArticle`, `agent-facing.ts`; guarded by `it('never tells the agent how the server positions a group internally')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` |
| D11 | A group returned by `get-plan-context` is a valid `create-or-replace-groups` payload as it is | 2026-09-16 | rules (`AUTHORING_RULES`, `hi-mcp-server.ts`) | in effect |
| D12 | Walls are named by their side in the top-view image — `left`, `right`, `top`, `bottom`; the text maps back = top, front = bottom. Every wall also carries its `name` in the user's words (back wall, front wall, …), an opening its `type`, and every room its `corners` with their names and rotations ([RML-18041](https://roomle.atlassian.net/browse/RML-18041)) | 2026-09-02 | [RML-17966](https://roomle.atlassian.net/browse/RML-17966), D7 of the repositioning refactoring | in effect — `agentFacingRooms`, `roomCorners` |
| D83 | **A room corner is where the contour turns into the room.** The `corners` of a room list every point where a wall or an opening ends and the next starts at an angle that turns into the room — to the side the ending one faces, as the room lies on the left of the contour (D61). A door or a floor-to-ceiling window that reaches a corner keeps it. The corners of a partition and the inner corner of an L-shaped room turn away from the room and are none: no group stands in them as in a room corner. Rejected: the corners of a partition in the list — no placement uses them, and the agent would take them for room corners; corners built from the wall faces (`wallFaces`) — the same corners, with a copy of the faces in the server; leaving out the subpaths after the first of the contour — it keeps the inner corner of an L-shaped room and the free end of a partition joined to a wall | 2026-10-17 | user | in effect — `roomCorners`, `agent-facing.ts`, and its copy in roomle-ui `hi-plan-space.ts`; guarded by `it('lists the room corners where a window meets a wall, and none of the partition')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` and `it('lists the corners where the contour turns into the room, also at a window, and none of the partition')` in roomle-ui `__tests__/hi-plan-space-test.ts` |
| D61 | **The walls follow the kernel's room contour as it is.** The `ROOM` and `PLAN` contour of RoomleCore runs counter-clockwise with the room on its left, and an opening splits only the wall piece it overlaps, so the points along a wall face follow its direction, also with several doors and windows in one wall. roomle-ui (`deriveWalls`) takes each wall's `side` and `facingRotationY` from the direction of its segment; the server names the walls and builds the corners from them (C18). A wall entry with the wrong side is corrected in the kernel's contour. Rejected: a side test in `deriveWalls` or in the server — it hides the defect: the wrong entry still spans the openings, the same contour reaches the HOMAG library and the order data, and the server cannot tell a wall that runs back from the wall of a room that bulges; and a further query of the kernel — the contour carries everything the walls need | 2026-10-07 | user | in effect — RoomleCore `ObjectSurroundings::addOpeningToContour`, roomle-ui `deriveWalls`; guarded by `TEST_CASE("object surroundings split only the wall piece an opening lies on")` in RoomleCore `test/planner/geometry/object-surrounding-geometry-test.cpp` |
| D13 | Rotations are counter-clockwise as seen from above; a group against the right wall has 270, against the left wall 90. Not clockwise, as the ticket comment assumed: RoomleCore passes the angle through a proper rotation from HI space (Y up) to kernel space (Z up), and the golden Furniture_Smith L-shape at 270 stands in the back right corner ([rotation sense](../.agents/skills/roomle-hi-concepts.md#rotation-sense)) | 2026-09-29 | [RML-17966](https://roomle.atlassian.net/browse/RML-17966) comment 155478 (its clockwise values rejected), D1 of the repositioning refactoring | in effect |
| D97 | **`get-plan-images` shows the groups alone from their front and the top view of the plan, and names its images in a text.** The first image is the planner's object perspective (`perspectiveObjectImage`): the HI groups alone, framed on them and turned to their fronts, the room and every other object hidden, on a transparent background; the second is the top view of the whole plan, which carries the room context — where a group stands, its footprint, a gap to a wall. One text content before the images names them in order; without groups the planner renders no group view, and the text says so before the top view alone. One camera serves all groups: where fronts face opposite directions one side is seen from behind, and root modules can hide one another — the description says that a root module not seen is not missing. One text before the images, not a label beside each: a provider can join the text parts of a tool result ahead of its images (Gemini 3), and numbered names keep their meaning there. Rejected: the plan perspective — its camera stands at a fixed world angle above the room's front left corner, so a group is seen from the side or from behind, or hidden by other objects; all three images — one image more per call for a view of the room the agent does not act on; a parameter to choose the views — the agent would have to learn what to request; the plan perspective as a fallback without groups — the top view of an empty room is enough to plan into it | 2026-10-04 | user | in effect — `get-plan-images` in `tool-executors.ts` and `hi-mcp-server.ts` of the HI tools (roomle-ui `packages/web-sdk/packages/homag-intelligence/src/hi-mcp/`); guarded by `it('returns the plan images of the external object snapshot')` in roomle-ui `packages/web-sdk/packages/homag-intelligence/__tests__/hi-mcp/tool-executors-test.ts`, `it('shapes get-plan-images into a text naming the images, then the group view and the top view without the data-url prefix')` and `it('returns the top view alone and says so when the plan has no groups')` in `hi-mcp-server-test.ts` there, and `test('renders the object perspective and the top view, without the plan perspective, with the geometry as it is')` in roomle-ui `planner-core/__tests__/roomle-planner.ts` |

### Authoring and positioning

| # | Decision | Date | Source | State |
|---|---|---|---|---|
| D14 | One piece of furniture is one group ("one kitchen" until D44): articles beside, above or back to back are docked root modules of the same group | 2026-09-29 | rules `hi-mcp-server.ts:10` | in effect (rule) |
| D15 | A root is an article pick; root positions come from the docking only | 2026-09-16 | rules (`AUTHORING_RULES`, `hi-mcp-server.ts`) | in effect |
| D16 | A new group is positioned with `placement { posGroup, posRotationY, rootId? }` or, since D23, `placement { wall, alignment?, offsetMm?, roomIndex? }`, applied once, when the group is created; the server anchors it | 2026-09-30 | [RML-18007](https://roomle.atlassian.net/browse/RML-18007) Task 1 | in effect |
| D17 | With two corner articles, `rootId` names the one that goes into the corner `posGroup` names | 2026-09-30 | [RML-18007](https://roomle.atlassian.net/browse/RML-18007) Task 1, P1 | in effect |
| D18 | The server places a corner article by its corner point and turns a right-handed one by 90° itself | 2026-09-30 | [RML-18007](https://roomle.atlassian.net/browse/RML-18007) Task 1; `toRepositioningData` | superseded by D33, which keeps both for every article |
| D19 | `merge-article-into-group` positions by docking (`dockTo`), never by coordinates | 2026-09-30 | [RML-18004](https://roomle.atlassian.net/browse/RML-18004) | in effect |
| D20 | `change-group-attribute` sets the attribute on every root and sub module of the group whose master-data module carries it, in one calculation | 2026-09-30 | [RML-18004](https://roomle.atlassian.net/browse/RML-18004) | in effect |
| D54 | `change-module-attribute` without `moduleId` sets the attribute on the root module and on each of its sub modules whose master-data module carries it, in one calculation — the root-level counterpart of D20 and the planner's own root-module selection, so the front colour of a root module reaches its fronts after a group colour. A sub module with a value of its own gets the new value too, and `changedModuleIds` names every changed module; a root module without the attribute sets only its sub modules. With `moduleId` only that sub module changes | 2026-10-07 | [RML-18074](https://roomle.atlassian.net/browse/RML-18074) | in effect — roomle-ui `changeModuleAttribute`, `glue-logic.ts` |
| D21 | `place-group` works on the calculated group, keeps the group's height, and returns `{ placedIn, wall, group }`; it knows walls and corners, not free points | 2026-09-30 | [RML-18007](https://roomle.atlassian.net/browse/RML-18007) Task 2, Q1, Q3–Q5 | in effect — `place-group`, roomle-ui `hi-tool-commands.ts`; `hi-wall-placement.ts`, `hi-plan-space.ts` |
| D22 | A group outside the room is never refused, removed or warned about: the user may ask for it — a terrace, a space without walls in the plan, a parking spot while planning —, and the server cannot tell that request from a wrong placement. Rejected: a room check after the load. In "test the mcp" a group outside the room is a model finding ([hi-mcp-testing.md](../.agents/skills/hi-mcp-testing.md)) | 2026-10-01 | user, review before [PR #42](https://github.com/roomle-dev/roomle-hi-example/pull/42), which dropped the check with its rule sentence and tests | in effect |
| D23 | **A new group is placed by wall, alignment and offset**, as `place-group` moves a group: `placement { wall, alignment?, offsetMm?, roomIndex? }` in `create-or-replace-groups`, with the walls, alignments and defaults of `place-group`, beside the placement by point, which stays for an island, a free spot and a group of wall units only. The tool loads the group without a position, computes the target from the calculated group — the width a wall placement needs exists only after the calculation —, moves a target that overlaps another group along the wall (G22), reloads the group once and sets its group materials after the reload (D36): the planner answers an attribute command before the calculated group carries the new values, so a reload after it would send the values before it; no anchor frame is needed. Two loads and the material command, planner steps which `undo` reverts together (D47); D46 holds for the placement by point. A placement with a wall and a point uses the wall (G57); with two corner articles the first one in roots goes into the corner. The groups of the call are paired with the plan's by the planner's answer to the load (D73); a group the planner left out is not placed. After the reload it tells a group the planner did not move by the floor it covers, which is the floor it covered before: the load answers what the planner calculated, not where the group stands, and after a reload the planner keeps the group origin at another root or corner, so neither tells (G59). The served text teaches the wall form for a wall or a room corner — a corner by the side label of the adjoining wall, a free stretch by `end` and `offsetMm` from `fromEndMm`. The alignment `start` stays accepted, as in `place-group`, and is not taught: it is a contour term the models take for the wrong corner. Rejected: a probe of the whole group and one load at the target — every call would calculate the group twice and turn the footprint into the anchor's frame on a second path; a width from the catalog before the load — it breaks on corner articles and range hoods. | 2026-10-08 | user | in effect — `placeAtWalls`, roomle-ui `hi-tool-commands.ts`; `normalizeWallPlacement`, `hi-tool-payload.ts`; `wallTarget`, `hi-wall-placement.ts`; `AUTHORING_RULES`, the descriptions, `hi-mcp-server.ts`; guarded by `describe('create-or-replace-groups wall placement')` in roomle-ui `__tests__/hi-tool-commands/create-or-replace-groups-placement-test.ts`, `it('reverts a new group placed by wall, its load and its reload, in one undo')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts`, `it('places a new group by wall and alignment and leaves the point to the server')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts`, and the tests `four-cabinets-back-wall`, `four-cabinets-centred-back-wall` and `image-kitchen-left-wall` of `docs/test-prompts.json` |
| D24 | `place-group` rejects a target that meets another group (contact guard) | 2026-09-30 | [RML-18007](https://roomle.atlassian.net/browse/RML-18007) Task 2, D1 | superseded by D27 |
| D25 | A placement on a group that is already in the plan is rejected | 2026-09-30 | [RML-18007](https://roomle.atlassian.net/browse/RML-18007) Task 1 | superseded by D26 |
| D46 | **A new group stands where the placement says after the one load that creates it, and the tool owns its anchor.** This holds for the placement by point; a placement by wall loads the group and moves it (D23). The tool finds the anchor by the docking (C5), not by the order of the roots — the models did not list it first —, and takes the anchor's frame before the load from the article template, calculated outside the plan with the anchor's attribute overrides, so the frame follows the hand of a corner article and the width of a hood (C6, D33). Rejected: a correction load after the creation — load, read the calculated anchor, move it: every offset group would load twice and visibly jump, and moving is `place-group`'s (D21); a planner repositioning option that places a root by its docking corner — the corner turn is a convention of the served corner rules, not of the planner, and it needs a roomle-ui release; the footprint corner as the reference — it includes generated parts, the worktop overhangs by 10 mm; a special case for the range hood, such as centring it over the nearest hob — it guesses the intent, which docking states; a probe load of the anchor in the live plan, taken back by undo — a load and an undo per anchor variant, and the raw groups and the removal of a group on every page allow-list (D71) | 2026-10-02 | [RML-18007](https://roomle.atlassian.net/browse/RML-18007); user, 2026-10-02 (D33) | in effect — `findAnchorRoot`, `toRepositioningData`, roomle-ui `hi-group-placement.ts`; the anchor frames of `create-or-replace-groups`, roomle-ui `hi-tool-commands.ts`; `calculateArticleTemplate`, roomle-ui `glue-logic.ts` |
| D72 | **The relations become docking in roomle-ui.** `create-or-replace-groups` sends the relations (`rightOf`, `leftOf`, `onTop`, `above`, `behind`) as the agent wrote them, and its tool command compiles them into docking entries (D34); `merge-article-into-group` moves a taken side to the free end of the row there (D29). The translation needs the calculated plan — the free sides, the row ends, the room —, and the server sends the agent's intent. The planner's group operations take docking entries only. Rejected: the server translating the relations and sending docking entries — it would need the calculated groups, which only the planner has | 2026-10-13 | user ([RML-18147](https://roomle.atlassian.net/browse/RML-18147)) | in effect — `relationsToDocking`, roomle-ui `hi-group-layout.ts`; `dockTarget`, roomle-ui `hi-tool-docking.ts`; guarded by roomle-ui `__tests__/hi-group-layout-test.ts` |

### Guards and corrections (2026-10-02)

| # | Decision | Source | State |
|---|---|---|---|
| D26 | **A conflicting placement creates no `repositioningData`.** For a placement on a group that is already in the plan, or a placement the server cannot use, the server sends no `repositioningData`, and the planner (roomle-ui, RoomleCore) positions the group — an existing group keeps its position. The result says that the placement was not used | user, [RML-18033](https://roomle.atlassian.net/browse/RML-18033) | in effect — `normalizePlacement`, roomle-ui `hi-tool-payload.ts` |
| D27 | **Intersecting groups are allowed** (`place-group`). When the target overlaps another group, the server corrects the position along the wall and informs the agent; it never rejects. Touching is not an overlap. Two groups overlap when a root module of one overlaps a root module of the other: the box around an L-shaped group covers the floor inside the L, which its root modules leave free, so the boxes are only the quick test first | user, [RML-18033](https://roomle.atlassian.net/browse/RML-18033) | in effect — `freePlacementAlongWall`, `overlappedGroupIds`, `groupVolumes`, roomle-ui `hi-wall-placement.ts`; guarded by `it('reports no overlap with a group inside an L-shaped group that no root module touches')` and `it('still moves an L-shaped group away from a group that one of its root modules overlaps')` in roomle-ui `__tests__/hi-tool-commands/place-group-test.ts` |
| D28 | **Unconnected roots are connected automatically.** The server adds a docking entry (`PosDockedContextRoot`: `dockingVector`, `mode`, `offset`) that docks them to the free end of the row. The guard stays for roots that cannot be connected | user, [RML-18033](https://roomle.atlassian.net/browse/RML-18033) | in effect — `connectUnreachedRoots`, roomle-ui `hi-tool-docking.ts` |
| D29 | **A unit docked to an occupied side goes to the free end of that row** (`merge-article-into-group`, and two roots on one side vector in `create-or-replace-groups`). Refined 2026-10-04 ([RML-18041](https://roomle.atlassian.net/browse/RML-18041)): a row has two ends — `merge-article-into-group` walks in the direction the agent named and takes the named root's own free side only when the unit would stand outside the room at that end (the test runs showed the agents name the wrong root as often as the wrong direction; the room decides); a corner article ends a row, so a walk that meets one turns to the free end of the leg in the other direction | user, [RML-18033](https://roomle.atlassian.net/browse/RML-18033) | in effect — `separateSideVectorPartners`, `dockTarget`, `rowWalk`, roomle-ui `hi-tool-docking.ts` |
| D30 | **A call loads every group that can be built** and reports the others with what to send instead | user, [RML-18033](https://roomle.atlassian.net/browse/RML-18033) | in effect — `keepBuildable`, roomle-ui `hi-tool-payload.ts` |
| D31 | Guards are a last resort; the server corrects and informs, and gives feedback where it cannot correct | user guideline | in effect — §8 |
| D33 | **One anchor frame for every article.** A placement puts the docking corner of the anchor root — the back left bottom corner of its docking vectors — at `posGroup`, whatever article it is: the origin of a cabinet, the left edge of a range hood, the corner point of a corner article, which is also turned so that its corner lies back left. The groups the tools return report their position in the same frame: `pos` is the back left bottom corner, `rotationY` the rotation of the placement. An anchor whose template cannot be calculated does not fail its group (G17) | user, 2026-10-02 ([RML-18007](https://roomle.atlassian.net/browse/RML-18007); the range hood placed half its width off) | in effect — `anchorFrameOfRoot`, `toRepositioningData`, `positionInPlacementFrame`, roomle-ui `hi-group-placement.ts`; `inPlacementFrame`, roomle-ui `hi-tool-commands.ts` |
| D34 | **A unit names its neighbour, the server builds the docking.** Every root after the first names one neighbour with one relation — `rightOf`, `leftOf`, `onTop` (`align`, `gapMm`), `above` (`gapMm`), `behind` — and the server compiles the docking entries (`contextData`) from it: the vectors, the mode, the offset, and the root the entry goes on. A wall unit `rightOf` / `leftOf` a tall unit docks by the Top vectors. `contextData` stays accepted and is no longer taught; a group without any relation field is not touched. Rejected: rows written as arrays — wall units, corners between rows, stacking and islands each need a field of their own, and the nesting returns —, and a server that lays the group out from a list of articles and a wall — the order, the corner side and the wall units are the user's intent | user, 2026-10-02 ([RML-18038](https://roomle.atlassian.net/browse/RML-18038)) | in effect — `relationsToDocking`, roomle-ui `hi-group-layout.ts` |
| D85 | **Mounting is resolved for the layout.** Explicit base/tall category recognition supplies floor evidence; an unmatched category supplies none. Valid upper relations, Top-to-Bottom docking and retained calculated carriers establish upper roots; side links continue their row without crossing a tall junction. Unknown upper articles and finishing parts retain their mounting and gaps. A replace restores missing carrier links at measured offsets for unchanged retained roots; new relations and changed articles take precedence. The served rules explain selection from existing library descriptions and attributes. Rejected: mounting read from the articles' insert levels — a suggested insertion height does not say that an article cannot hang above another, and a library's catalog may list none (Furniture_Smith lists none); a fixed attribute value or a positive insertion height as the wall-unit test — library content in the server's logic (§2.4), and floor roots carry a positive insertion height from their plinth; the mounting of one layout written back as the article's type — it holds for that layout only | user, implementation plan, 2026-10-18 | in effect — `wallRootsOf`, `isFloorUnitArticle`, the roomle-ui tool commands and `MOUNTING_GUIDANCE` in `hi-mcp-server.ts`; guarded by `it.each(…)('keeps a panel %s a wall unit in the wall row')` and `it.each([undefined, 0, 500])('hangs an unknown-category utility unit with gap %s')` in roomle-ui `__tests__/hi-group-layout-test.ts`, `it.each(['forward', 'reverse', 'reciprocal'])('keeps unknown-category upper docking (%s)')` and `it.each(…)('retains measured mounting unless replaced by new intent (relation: %s, article: %s, gap: %s)')` in roomle-ui `__tests__/hi-tool-commands/create-or-replace-groups-input-test.ts`, `it.each([undefined, 0, 500])('merges an unknown upper article with y offset %s')` and `it('keeps unknown upper articles out of the turned floor-leg list')` in roomle-ui `__tests__/hi-tool-commands/group-commands-test.ts`, `it('preserves a detached 1280 mm utility unit at 500 mm clearance after a carrier height change')` in roomle-ui `__tests__/hi-root-module-arrangement-test.ts`, `it('explains mounting from library descriptions and continuing a wall row')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts`, and the test `utility-room-open-wall-units` of `docs/test-prompts.json` |
| D35 | **The hang height of a wall unit `above` a floor unit** is the height of the tall units — a tall unit of the group, else the usual tall unit of the library — minus the heights of the wall unit and the floor unit (`mod_Height`); base and tall units stand on the same plinth. Furniture_Smith: 2100 − 720 − 720 = 660. `gapMm` overrides it, including zero. Upper roots do not supply the current group's tall reference. A merged upper article receives the default only when its y offset is omitted; a numeric y offset, including zero, stays | [RML-18038](https://roomle.atlassian.net/browse/RML-18038) Decision 1, 2026-10-02; confirmed live 2026-10-04 ([RML-18041](https://roomle.atlassian.net/browse/RML-18041)): bottom 1480, top 2200, flush with the tall units | in effect — `hangGapOf`, roomle-ui `hi-group-layout.ts` |
| D36 | **A material for the whole group goes into the group's `attributes`.** A root's `attributes` are overrides of that root module. A group attribute that is not one of the library's group settings is set on every unit and generated root of the group after the load — all of them with one planner command, `change-attributes`, in one calculation and one undo step (amended 2026-10-08, [RML-18064](https://roomle.atlassian.net/browse/RML-18064)) — after a create and after a replace alike; an override only a generated root carries (the worktop colour on a base unit) is moved to the group; the colours of the generated roots a replace drops (C1) are set again. A unit attribute on some roots stays per unit — it may be an accent. A root module that names its own value of a group attribute keeps it: the same command sets the group's value on every unit and then the root module's own value on that root module — its own program attributes first, which the group's colour may have switched —, the entries applied in their order, and `groupAttributes` names those root modules in `rootValues`. The program attributes (`…Program`) go first in the command, because a program resets a colour it does not offer: a colour sent with its program stays. **The group settings come from the master data** (`groupSettings`, D48), not from the loaded group: the planner lets the library set a group's attributes on a create only and keeps them as sent on a replace, so a replace lost its materials (amended 2026-10-08, [RML-18075](https://roomle.atlassian.net/browse/RML-18075)); a planner without `groupSettings` falls back to the attributes the loaded group lists. **A replace builds what it is sent:** a root sent again without its attributes takes those of its article template — the group from `get-plan-context` carries each root's input attributes (user, 2026-10-08, [RML-18075](https://roomle.atlassian.net/browse/RML-18075)) | 2026-10-04 ([RML-18041](https://roomle.atlassian.net/browse/RML-18041)) | in effect — `applyGroupWideAttributes`, `rootValuesOf`, `programsFirst`, `groupSettingIdsOf`, `moveGeneratedRootOverrides`, roomle-ui `hi-tool-attributes.ts`; guarded by `it("sets a root module's own value of a group attribute on that root module after the group's value")` and `it('sends the program attributes of the group before the others, so a colour sent with its program stays')` in roomle-ui `__tests__/hi-tool-commands/create-or-replace-groups-placement-test.ts`; the replace part with the `groupSettings` of roomle-ui `compactMasterData` ([RML-18075](https://roomle.atlassian.net/browse/RML-18075)) |
| D32 | **Nothing the agent sends is dropped without a report.** What the server can build it builds — a unit written inside the docking becomes a root — and every field it cannot use is named in `corrections`. Only the read-only fields of a group from `get-plan-context` are ignored silently | user, 2026-10-02 ([RML-18033](https://roomle.atlassian.net/browse/RML-18033)) | in effect — `prepareGroup`, roomle-ui `hi-tool-payload.ts` |

### Row edits (2026-10-05)

| # | Decision | Source | State |
|---|---|---|---|
| D39 | **The row edits are planner commands.** `insert-article-into-group`, `delete-article-and-compact` (the roomle-ui command `remove-article-from-group`) and `swap-root-modules` are roomle-ui commands that rewrite the docking of the row and let the root module arrangement move the units, against the group before the edit, in one reload (D3). The server resolves the ids, corrects what it can and forwards one command. Rejected: the server rewriting the relations and replacing the group with `create-or-replace-groups` — the replace path keeps no wall distance, the server would have to pick the end that stays and position the group without the planner (D26), and a replace regenerates the ids; and an insert as a mode of `merge-article-into-group` — a tool named for the intent is what the model selects by, and a taken side there means the end of the row (D29) | [RML-18045](https://roomle.atlassian.net/browse/RML-18045) | in effect — `insert-article-into-group`, `swap-root-modules`, roomle-ui `hi-tool-commands.ts`; roomle-ui `glue-logic.ts` |
| D40 | **Remove and delete are two edits, named by the user's word.** The rules and the two tool descriptions tell the agent to take the user's word: "remove" is `remove-article-from-group`, "delete" is `delete-root-module` (added after the MCP test of 2026-10-05, where gpt-5-mini closed the gap for "delete the middle unit"). **Each description opens with its word** — "The tool for "delete": when the user asks to delete a unit, a cabinet, a module or an article, …" — and points to the other tool by its word, not by the gap: the HI chat does not read the rules, and with the word as an aside behind the gap gpt-5.4-mini took `delete-root-module` for "remove" in every chat run (amended 2026-10-08, [RML-18079](https://roomle.atlassian.net/browse/RML-18079)). "Remove" names this edit only: `delete-group` deletes a group. `remove-article-from-group` takes the `rootModuleId` alone, like `delete-root-module`; its `groupId` is optional (G54). `delete-root-module` deletes a unit and leaves the gap: units no longer docked together become separate groups where they stand. `remove-article-from-group` removes a unit and closes the gap: its two neighbours are docked to each other, and a unit hung on it hangs on the neighbour that moves into the gap. A unit at the end of a row leaves no gap: it is removed in the same reload and nothing else moves. **A remove never splits a group** (amended 2026-10-07, [RML-18065](https://roomle.atlassian.net/browse/RML-18065)): a corner article between two legs is removed and the gap closed as well (D52). Only the only unit of a group is deleted, with its group. A deletion splits by docking, so with `delete-root-module` wall units hanging with a gap above their floor units become groups of their own — that is what "delete" means | user, review of the plan, 2026-10-05; the corner article: user, 2026-10-07; the word first: [RML-18079](https://roomle.atlassian.net/browse/RML-18079), 2026-10-08 | superseded in part by D58 — what each edit does stays, under the names `delete-article-in-place` and `delete-article-and-compact`; the selection by the user's word goes |
| D41 | **Which part of a row moves.** The end of the row at a wall or in a corner keeps its place, and the other end moves; a row without a wall on its axis keeps the end at the group origin — the left end as seen from the front, the corner article of a corner kitchen. A row that grows from wall to wall is built anyway | [RML-18045](https://roomle.atlassian.net/browse/RML-18045) | in effect (roomle-ui `keepWallDistances`) |
| D42 | **Units above follow the unit they hang from.** A wall unit, a range hood or a unit on top moves with the unit below it — on an insert with the pushed unit, on a swap with its own unit, on an exchange with the new root module, on a merge with the group when the new root module on the wall side moves it away from the wall, on a `delete-article-and-compact` with the neighbour that takes the place of the removed unit, unless that neighbour carries a unit above it already: then the unit keeps its place, and the correction names the unit above that moved in and now overlaps it, whichever group each of the two is in. The planner finds the unit below by position: its docking context links only vectors that touch, so after a load a wall unit hanging with a gap is not docked to its floor unit. The units above of other groups follow as well, on every row edit: the planner finds the units of the other groups of the scene that stand above a root of the edited row by room position, and moves each such unit within its group the way its carrier went — turned with a leg that turns, shifted with a leg that moves along its wall, left relative to the root it stood above when another carrier of the same rotation takes over — in the same edit, so one `undo` reverts both; the group keeps its place and its origin, the units of one group part where their carriers part, and the result returns the moved groups beside the edited one. A unit whose carrier is gone, or turned against the root it stood above, stays. A width change by an attribute command moves the units above of the edited group only. The corrections of `delete-article-and-compact` label each named root with its id and article id, or its article name when the id is absent, from the group before removal. On an attribute change, an unchanged wall unit also follows a carrier whose docking top changes while its root stays in place: the arrangement preserves the clearance measured between their docking vectors and leaves a unit already moved by docking in place. Nothing edits the wall row automatically: the same tools edit it. Rejected: a second attribute command that sets an insertion height for the wall units — no attribute of the master data says it is one, and choosing one by its id is library knowledge (§2.4); hanging the units by the rendered tops of the plan context — a worktop or an appliance renders above its docking top, and the gap would grow by that overhang; moving every group with one carried unit as a whole by the move of that unit's carrier — a wall row over both legs goes to the wrong place; keeping a group in place whose units follow carriers that moved differently, named in a correction — the range hood of a corner kitchen then never follows its hob across the corner, and a `place-group` of the group takes the wall unit beside the hood along; splitting such a group along its carriers — it creates groups the agent did not ask for; a served rule that wall units go into the group of their floor units, or a `place-group` after every row edit — a group of wall units of its own is a valid plan (its placement by point) | [RML-18045](https://roomle.atlassian.net/browse/RML-18045) | in effect (roomle-ui) — `removeArticleFromGroup`, `insertArticleIntoGroup`, `swapRootModules`, `exchangeRootModule`, `mergeArticleIntoGroup`, `unitsOverlapping`, `rootsInGroupSpace`, `carriersOfUnitsInOtherGroups`, `groupsFollowingTheirCarriers`; guarded by `describe('with units above in other groups')` under the insert, the delete and the swap, `describe('exchangeRootModule with units above in other groups')` and `it('moves the units of another group above the row with the group when the merge on the wall side moves it')` in roomle-ui `__tests__/hi-tools-test.ts`, `describe('in other groups')` in `__tests__/hi-root-module-arrangement-test.ts`, `it('names the unit of another group that moved with a swapped unit')` and `it('names the unit of another group that moved with a pushed unit')` in `__tests__/hi-tool-commands/group-commands-test.ts`, `it('keeps a unit above in place when the neighbour carries one already')` in roomle-ui `glue-logic-test.ts` and the detached-wall-row tests in `hi-root-module-arrangement-test.ts` and `glue-logic-test.ts`: `it.each([50, 20, -50, 0])('keeps both detached wall units above carriers whose docking tops change by %i mm')`, `it.each([600, 650])('keeps an explicit %i mm gap above a carrier whose docking top rises')` and `it('leaves a unit the docking has already moved to the new height')` in roomle-ui `__tests__/hi-root-module-arrangement-test.ts`, and `it.each([true, false])('keeps detached wall units above their carriers after the attribute load (arrangement: %s)')` in roomle-ui `__tests__/glue-logic-test.ts` |
| D43 | **A row edit says what it did to the row.** When an insert, a merge (D82), a `delete-article-and-compact`, an exchange or a swap makes a row that stood inside the room reach past a wall, overlap a group it did not overlap before, or stand in front of a door or a window or on an object it did not stand on before (the test of D55), the result's `hint` says so; the row is built anyway. This is no warning about a group outside the room (D22): a group that stood outside before the edit is never reported. The `hint` also names the units above that moved with the unit below them by id and article id (D42). Movement is measured by room position and rotation before and after, so a change of group frame alone says nothing | [RML-18045](https://roomle.atlassian.net/browse/RML-18045), 2026-10-05 | in effect — `withRowHints`, `rowReachHints`, `obstacleHint`, roomle-ui `hi-tool-hints.ts`; guarded by `it('names a door the row stands in front of after the edit')` in roomle-ui `__tests__/hi-tool-commands/group-commands-test.ts` |
| D49 | **A size is an attribute.** A root module of another size is the same article with its size attribute set (`mod_Width` 900) — in `create-or-replace-groups` and in the `attributes` of `merge-article-into-group`, `insert-article-into-group` and `exchange-root-module`. The catalog has one size per article: without the rule, gpt-5-mini asked back whether "a 900 mm cabinet with drawers" meant a tall or a base unit (MCP test of 2026-10-05) | [RML-18045](https://roomle.atlassian.net/browse/RML-18045), 2026-10-05 | in effect — `AUTHORING_RULES`, the `exchange-root-module` description, `hi-mcp-server.ts` |

### Words (2026-10-06)

| # | Decision | Source | State |
|---|---|---|---|
| D44 | **The served text speaks of articles and root modules, not of kitchens.** The catalog offers articles; a group is one piece of furniture made of articles — a kitchen, a wardrobe, a sideboard, a utility room —; an article placed in a group is a root module. Kitchens are named only where a rule is about them (the corner rules) and in the list of kinds; no tool description names one. `insert-article-into-group` inserts between two root modules that stand side by side, whatever the group and whatever the article — a low cabinet between two high cabinets or wardrobes too —, and a group of two root modules has one place to insert, no gap needed (the sentence that made gpt-5.4-mini reach the tool); the user decides what stands between what. An article named by its kind comes from the category of its neighbours where that category has one. The chat's system prompt names every kind of HI furniture and tells the model to take the closest article of the catalog when the request names a kind. Found with "insert a low cabinet between the high cabinets" on a wardrobe group: the agent looked for a kitchen run of high cabinets and found none | user, 2026-10-06 ([RML-18045](https://roomle.atlassian.net/browse/RML-18045)); guarded by `it('speaks of articles and root modules, not of kitchens, and inserts between any two root modules')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` and the test `edit-insert-low-between-high` of `docs/test-prompts.json` | in effect — `AUTHORING_RULES`, `INSTRUCTIONS`, the tool descriptions, `hi-mcp-server.ts`; the system prompt of the chats, roomle-ui `hi-agent-prompts.ts` (D80) |
| D57 | **The code of the tools speaks of groups and articles, not of kitchens.** The names of functions and variables in `tool-executors.ts` and in the HI tool commands of roomle-ui (`hi-tool-commands.ts` and its modules) do not use the word "kitchen": the MCP works with groups and articles, the products are furniture made of cabinets, and the result can be a kitchen or something else — `applyKitchenWideAttributes` became `applyGroupWideAttributes` | user, 2026-10-08 ([RML-18075](https://roomle.atlassian.net/browse/RML-18075), comment 155885) | in effect — `tool-executors.ts`; roomle-ui `hi-tool-commands.ts`, `hi-tool-attributes.ts` |

### Obstacles (2026-10-06)

| # | Decision | Source | State |
|---|---|---|---|
| D45 | **What stands in the room is a default section of its own.** `get-plan-context` returns `obstacles`: the doors, windows and other plan objects of the kernel's obstacle map as floor outlines with their height range — `kind` door, window or object, no names: an obstacle is an obstacle —, and per HI group the room-space outlines of its root modules. The group outlines come from the parts of the calculated groups, not from the obstacle map: the kernel's outline of an HI group was 50 to 250 mm off on the ticket's plan. The walls of the map are left out — the `rooms` section has them, named and per room. Doors and windows lie behind the room boundary and only touch it, so an overlap test never flags them; the server gives each its wall and its span from the wall's end (C21), the terms of a placement. Root geometry stays out of `groups` (D15); the outlines in `obstacles` are read-only. A planner without the section returns none, and the tool works as before | [RML-18036](https://roomle.atlassian.net/browse/RML-18036) | in effect — `shapeObstacles` (roomle-ui `hi-plan-context.ts`), `agentFacingObstacles`, `wallOfOpening` |
| D55 | **The server tests the obstacles, and the result names what a root module stands on.** After the load of `create-or-replace-groups` and the reload of `place-group`, the server tests every root module of the groups of the call: does it overlap an object, a root module of another group (`create-or-replace-groups` only — `place-group` keeps G22), or the strip in front of a door or a window, within its height from `bottomMm` to `topMm` — base units below a window's sill and wall units above a door or a window are clear? The strip along a wall is 600 mm deep (`WALL_STRIP_MM`). The `hint` names each such root module, what it stands on or in front of, and the free stretches of its wall at its height as `fromEndMm` ranges; the group is built anyway — the user may want a cabinet in front of a window (D51). For a group placed at a wall whose root modules stand in the strip in front of a door or a window of an adjoining wall, at one end of the group's wall, the `hint` also names the `offsetMm` with the same wall and alignment that keeps the group clear of that strip: "Group '…' stands clear of the window in the back wall at offsetMm 590 with wall left and alignment back." — the wall and the alignment as applied, `top` and `bottom` named `back` and `front`. The agent would otherwise turn the `fromEndMm` of the free stretches, measured from the far end of the wall, into the `offsetMm` of its corner itself. No such sentence for an opening of the group's own wall, a group placed by point, a corner article placed by its corner point, a root module in the strip that stands at another wall, or a group that no `offsetMm` on its wall clears without reaching past an end. Rejected: the free stretches measured from the corner the group is aligned to — they would not be the `offsetMm` of a placement with alignment `end`, as the served rule uses them; the clearing `offsetMm` is a sentence of its own in the frame of the placement. `place-group` does not move a group off an object, a door or a window; it names them in the `hint`. A root module's wall is the wall it faces away from, with its back within the strip; at a corner its rotation decides, and each leg of an L-shaped group has its own wall. The root modules come from the calculated groups, which carry their rotation, the objects from `obstacles`. A replaced group is told only what it did not stand on before (as D43). An object outline that is not convex is tested like its convex hull. | user | in effect — `obstacleHint`, `objectBlockers`, roomle-ui `hi-tool-hints.ts`; `clearingNotes`, roomle-ui `hi-tool-hints.ts`; the wall placements `placeAtWalls` and `place-group` hand to it, roomle-ui `hi-tool-commands.ts`; `rootVolumesInRoom`, `stripInFrontOfWall`, `wallOfRoot`, `freeStretchesAlongWall`, `convexHull`, `clearingOffsetMm`, `wallsRunParallel`, roomle-ui `hi-plan-space.ts`; guarded by `describe('obstacle hints')` and `describe('the offsetMm that clears an opening of the adjoining wall')` in roomle-ui `__tests__/hi-tool-commands/create-or-replace-groups-placement-test.ts` and `it('names an object the placed group stands on')` and `it("names the offsetMm that keeps the moved group clear of the adjoining wall's window")` in roomle-ui `__tests__/hi-tool-commands/place-group-test.ts`, the tests of these seven functions in roomle-ui `__tests__/hi-plan-space-test.ts`, `it('tells the agent what stands in the room and that the hint names a root module on an obstacle')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts`, and the tests `obstacle-window-back-wall`, `obstacle-back-wall-beside-the-sofa` and `obstacle-island-free-spot` of `docs/test-prompts.json` |

### Flexibility (2026-10-07)

| # | Decision | Source | State |
|---|---|---|---|
| D51 | **The tools do not restrict the agent, and they always say what happens.** The goal is not to restrict the agent but to be as flexible as possible: a tool carries out what the agent asks wherever the planner can. What happens has to be clearly specified at all times — in the tool description before the call and in the result after it | user, 2026-10-07 ([RML-18065](https://roomle.atlassian.net/browse/RML-18065)) | in effect for every new or changed tool |
| D52 | **`delete-article-and-compact` of a corner article closes the gap.** It deletes a corner article between two legs like every other root module: its two neighbours are docked to each other, so one leg turns by 90° and the legs form one straight row. The units above the turned leg turn with it, also those of another group (D42). The end of the row at a wall keeps its place (D41), so the other leg may move along its wall, and its units above move with it: the turned leg stands where the other leg began, so its units land where the other leg's units hung. The description says so before the call; after it, the correction names the leg that turned and the leg it is docked to and says nothing about the units above, and the row hint names the wall units that moved (D42, D51). The server identifies the turned leg by its original wall and its destination wall from the root geometry in room coordinates, using the room containing each root. Roots with the same wall-to-wall turn are named together, with their ids and article ids; an unknown wall is omitted. Rejected: a kernel deletion of a corner article instead — it splits the group into its docked clusters, so each leg and each cluster of wall units becomes a group of its own; the two legs can be docked to each other once one of them turns | user | in effect — roomle-ui `removeArticleFromGroup`, `moveUnitsAboveWithTheirCarriers`, `groupsFollowingTheirCarriers`; `hi-mcp-server.ts`; guarded by `it('removes a corner article by turning one leg with the units above it and docking it to the other')`, `it('turns the unit of another group above the turned leg with it and leaves the unit above the other leg in place')` and `it('moves the unit above the turned leg within its group and leaves the unit above the other leg in place')` in roomle-ui `__tests__/hi-tools-test.ts` and the test `edit-remove-corner-unit` of `docs/test-prompts.json` |

### New root modules (2026-10-08)

| # | Decision | Source | State |
|---|---|---|---|
| D56 | **A new root module inherits from its neighbour, whatever the tool.** As an article added in the planner, a root module added to a group takes the attributes the library passes on between neighbours — those the master data marks `implicitRelevant`, as input values of the neighbour (Furniture_Smith: fronts, handles, carcase, plinth height, baseboard, ceiling filler; not the worktop and toe kick colours, which belong to the generated roots) — through the planner's own `_applyImplicitRelevantAttributes`. The neighbour: `dockTo.rootId` for `merge-article-into-group`, the first root module of `between` for `insert-article-into-group`, the replaced root module for `exchange-root-module`, and for a root a replace adds the root it is docked to, as the call sends it — several added roots in a chain inherit in docking order from the roots already in the group. The attributes sent with the new root module override the inherited ones. The descriptions of the four tools and the rules say so (D51); the returned group shows the inherited values as the new root module's input attributes. `merge-groups` keeps the planner's merge | user, 2026-10-08 ([RML-18075](https://roomle.atlassian.net/browse/RML-18075), comment 155885); guarded by `it('gives a new root module the implicitRelevant input attributes of its neighbour, and a sent attribute wins')` in roomle-ui `glue-logic-test.ts` and `it('tells the agent that a new root module inherits the attributes of its neighbour')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` | in effect — the descriptions and `AUTHORING_RULES` (`hi-mcp-server.ts`); roomle-ui `_inheritNeighbourAttributes`, `_inheritAttributesOfAddedRoots`, `glue-logic.ts` ([RML-18075](https://roomle.atlassian.net/browse/RML-18075)) |

### Delete edits (2026-10-08)

| # | Decision | Source | State |
|---|---|---|---|
| D58 | **The delete edits are named by their outcome, and the default leaves the gap.** `delete-article-in-place` deletes an article and leaves the gap; `delete-article-and-compact` deletes an article and closes the gap. "Delete" and "remove" mean the same: the tool is `delete-article-in-place`, unless the user asks to close the gap. The names speak of articles, as the plan context and the other edits (`merge-article-into-group`, `insert-article-into-group`) do. Each description opens with its outcome and the case it is for, and points to the other tool by the outcome; the result and the planner's corrections name the tool, not the planner command, which keeps its name. The names carry the outcome, not the user's word: the two verbs are near-synonyms to the models, and a description or a name that differs only in the verb does not tell them apart. The descriptions carry the selection, because the HI chat reads the tool list, not the rules (§4). Rejected: a higher reasoning effort — the served text has to work at the effort the user runs; and a check of the call — the server cannot tell from it which word the user said | user | in effect — the descriptions, `AUTHORING_RULES`, `INSTRUCTIONS`, `hi-mcp-server.ts`; `asTool`, roomle-ui `hi-tool-commands.ts`; guarded by `it('names the delete edits by their outcome and leaves the gap by default')` and `it("no longer names a delete edit by the user's word")` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts`, `it('%s forwards the planner command %s and names itself in the result')` and `it('%s names itself, not the planner command, in the corrections of the planner')` in roomle-ui `__tests__/hi-tool-commands/group-commands-test.ts`, and the tests `edit-delete-unit`, `edit-remove-unit` and `edit-remove-next-to-corner` of `docs/test-prompts.json` |

### Library changes (2026-10-08)

| # | Decision | Source | State |
|---|---|---|---|
| D59 | **The library's own changes are named.** After `change-module-attribute`, `change-group-attribute` and the group attributes set after a create or a replace (D36), the server compares the input attributes of the root modules before and after. Every other attribute whose value changed — a front program switched by a front colour, a front colour reset by a front program — and a set attribute that a root module the command set it on ends with another value of are named in `corrections`, with the value descs of the master data, the root modules changed alike in one sentence. The library ties attributes together only in its calculation, not in the master data (Furniture_Smith: the stone decors 316, 326, 324 and 380 come only with the front program Modern, mitred frame fronts with glass filling), so the agent learns it from the result. The rules and the descriptions of the two commands say so; the served text no longer calls the values "allowed values". After a create, the sentence names "its group attributes" as the cause (D65). Several root modules changed alike are named by article and count — "of 7 root modules (HK260, SUT60, OFKB60 ×2, …)" —, one by its id and article; the ids are in `groups` (amended 2026-10-14, [RML-18164](https://roomle.atlassian.net/browse/RML-18164): ten such sentences of about 1,000 characters each made a create result of 23k tokens) | [RML-18094](https://roomle.atlassian.net/browse/RML-18094) | in effect — `findLibraryChanges`, `libraryChangeSentences`, `withLibraryChanges`, `applyGroupWideAttributes`, roomle-ui `hi-tool-attributes.ts`; guarded by `describe('library changes')` in roomle-ui `__tests__/hi-tool-commands/group-commands-test.ts` and `it('names the group attributes once as the cause of a library change')` in roomle-ui `__tests__/hi-tool-commands/create-or-replace-groups-placement-test.ts` |
| D60 | **Keep the fronts, not the colour.** The front program says how a front is built; the agent chooses it by its desc first, then the colour. When the colour the user wants comes only with fronts built differently — dark marble only as mitred frame fronts with glass filling —, the agent keeps the fronts the user wants: it undoes a switched program, takes the closest colour their program offers and tells the user which fronts the wanted colour comes with. Rejected: loading a program and a colour together that the library's rules never produce — the planner renders it, but the next attribute change of that root module switches the program | the plan of [RML-18094](https://roomle.atlassian.net/browse/RML-18094), option (a), implemented on the user's go, 2026-10-08 | in effect — the Fronts rule of `AUTHORING_RULES`, `hi-mcp-server.ts`; guarded by `it('tells the agent that the front program says how a front is built and that a colour can switch it')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` |

### Speed (2026-10-08)

Decided with the plan of [RML-18064](https://roomle.atlassian.net/browse/RML-18064): every model step
costs a fixed 4–5 s, so the tools save steps and the agent's context.

| # | Decision | Source | State |
|---|---|---|---|
| D62 | **An attribute command answers with what changed.** `change-module-attribute` and `change-group-attribute` return `{ command, groupIds, changedModuleIds, corrections? }`, not the changed group: the agent knows what it set, and `get-plan-context` shows the group. The structural commands keep the whole group, because the agent needs its new root ids. `change-module-attribute` takes `rootModuleIds`, one or more root modules of one group or of several — the accent fronts of a kitchen in one call; the server sends one `change-attributes` per group, with `moduleId` one `change-module-attribute` per root module, names each group they changed once in `groupIds`, and names a root module it could not change in `corrections`. Rejected: compacting every command result — the agent would read the plan context after every structural edit | user, 2026-10-08 | in effect — `compactAttributeResult`, `tool-executors.ts`; `rootModulesByGroup`, roomle-ui `hi-tool-ids.ts`; roomle-ui `changeAttributes`, `glue-logic.ts`; guarded by `describe('attribute tools')` in roomle-ui `__tests__/hi-tool-commands/group-commands-test.ts` and `it.each(attributeCalls)('runs %s in the planner with its arguments as sent and answers with the ids of what changed')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` |
| D63 | **The catalog describes an article in one or two sentences.** `get-plan-context` shortens a description written in sections (FUNCTION:, PURPOSE:, …, AI_SELECTION_HINT:) to its FUNCTION and AI_SELECTION_HINT lines — what the article is and when to pick it; a description without these sections stays as it is. The full descriptions are in the section `articleDescriptions`, returned only on request; the tool and `include` descriptions say that `desc` is enough to choose an article and that `articleDescriptions` answers a question about one article, not the planning — a third of the runs requested the section in their first step, 22k tokens more in every later step (amended 2026-10-14, [RML-18164](https://roomle.atlassian.net/browse/RML-18164)). The nine sections of the Furniture_Smith articles were half of the catalog, and the catalog nine tenths of what every later model step sends again. Rejected: the hint alone — the function line says what the article is; filtering the catalog by category — the agent would have to know the category before it reads the catalog | plan of RML-18064 | in effect — `shortDescription`, `agentFacingArticle`, `agent-facing.ts`; guarded by `describe('article descriptions')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` |
| D64 | **One search finds the material.** `find-attributes` matches every word of the text on its own, in any order, and reads colour/color, grey/gray and worktop/countertop alike — the library spells "Front color" and "Countertop", the agent often "front colour" and "worktop". A value list several attributes share is listed once; the later attributes carry `sameSelectionsAs`, the attribute that lists it. Every match names the root modules that carry it with their id and name — the worktop's colour is the colour of the root module Countertop, the panel top's that of Top panel, both attributes named Color —, and the attributes the root modules in the plan carry come first: a group with a worktop has no panel top. Rejected: a synonym list of its own — every entry is a guess about the library's words; fuzzy matching — more matches, more tokens | plan of RML-18064 | in effect — `searchWords`, `attributeMatches`, `withSharedSelectionsOnce`, `tool-executors.ts`; guarded by `describe('words')` and `it('lists the attributes the root modules in the plan carry first, and names the root modules')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` |
| D65 | **The group attributes of a create are reported apart, not as corrections.** The create result names per group the attributes set on every unit and those no unit of the group carries in `groupAttributes` — for a requested generated part, find an enabling attribute with `find-attributes`, enable it when available, then set the part's attributes after generation; report only what remains missing; `corrections` keeps what the server changed in the input and what the library changed. A library change after a create names "its group attributes" as its cause, once per change, instead of listing every attribute of the call. Rejected: a guard on the attributes of a part not generated yet — it refuses a legitimate request and offers no way to build the part; the server sending those attributes again on its own after the part is generated — a retry hides why the library cannot calculate the part | plan of RML-18064 | in effect — `applyGroupWideAttributes`, `libraryChangeSentences`, roomle-ui `hi-tool-attributes.ts`; guarded by `describe('create-or-replace-groups materials')` in roomle-ui `__tests__/hi-tool-commands/create-or-replace-groups-placement-test.ts` and `it('explains how to enable a requested generated part before reporting what remains missing')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` |

### Rows and results (2026-10-08)

Decided with the backlog of the MCP test, implemented on the user's go.

| # | Decision | Source | State |
|---|---|---|---|
| D66 | **A root module of a row carries its place in it.** Every root module docked side by side with another one gets `rowIndex`, its place in its row, 1 at the left end as seen from the front; floor units and wall units form rows of their own, and a corner article joins the two legs into one row. The roots are listed in the order they were added — an inserted root module last —, so "the middle unit" is read from `rowIndex`, not from the order. Every group a tool returns in the plan-context shape carries it; it is read-only and ignored when the group is resubmitted (C2). A root module beside no other one, and a row closed into a ring, get none. Rejected: listing the roots in row order — the first root is where the planner starts its arrangement, and a resubmitted group would change | user, the MCP test backlog | in effect — `withRowIndices`, roomle-ui `hi-tool-docking.ts`; `inPlacementFrame`, roomle-ui `hi-tool-commands.ts`; the description of `get-plan-context` and `AUTHORING_RULES`, `hi-mcp-server.ts`; guarded by `it('gives every root module of a row its place in the row, counted from the left end')` in roomle-ui `__tests__/hi-tool-commands/placement-frame-test.ts` and `it('tells the agent the place of a root module in its row')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` |
| D67 | **Several attributes of a group in one call.** `change-group-attribute` takes `attributes: [{ attributeId, value }]` beside the single `attributeId` and `value`, and sends them as one `change-attributes` command — one calculation, one undo step —, the program attributes first (D36). An attribute no module of the group has is named in `corrections`; the others are set. One attribute alone stays the planner's `change-group-attribute` command | user, the MCP test backlog | in effect — `change-group-attribute`, roomle-ui `hi-tool-commands.ts`; the schema and description, `hi-mcp-server.ts`; guarded by `it('sets several attributes of a group with one planner command, the programs first')` in roomle-ui `__tests__/hi-tool-commands/group-commands-test.ts` |
| D68 | **A create, an undo and a redo answer with the groups they changed.** `create-or-replace-groups` returns the groups of the call in the plan-context shape and `otherGroupIds`, the other groups of the plan; `undo` and `redo` return the groups the reverted call changed as they are now, `removedGroupIds` for the groups they took out of the plan, and `otherGroupIds`. The agent knows the other groups already; every later step of the turn would send them again. An `undo` or `redo` that reverts nothing still returns every group | user, the MCP test backlog | in effect — `changedGroupsOnly`, roomle-ui `hi-tool-commands.ts`; `changedGroupsOnly`, `changedGroupIds`, `revertToolCall`, `tool-executors.ts`; guarded by `it('loads article picks only, with docking stripped to vector names')` in roomle-ui `__tests__/hi-tool-commands/create-or-replace-groups-placement-test.ts` and `it('returns the groups the reverted call changed, and the others by their id')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` |
| D69 | **A value the library cannot calculate a root module with is left out on that root module.** When the library cannot calculate a root module with the values of a `change-attributes` — the upright colour `192` on an end panel `W60H`, for example —, the planner sets the values again on every other root module, in one load, and names the root modules that keep their previous values in `corrections`; when no root module can take them, the group stays as it was. The planner restores a group it cannot calculate (P-checks stay, D5), so one root module does not cost the others their values. Rejected: the server infers a discarded calculation from unchanged attributes and retries each attribute separately — unchanged values identify neither a discard nor its failing root module, and separate retries lose the group-command boundary. The server passes the correction on — after a create prefixed with `posGroups[i]` | 2026-10-09, user | superseded by D95 — the planner keeps the calculation of an attribute edit, and the tool names the root modules it could not calculate (C25) |
| D70 | **`place-group` places a group by its measure at the new place.** The library builds a group for its place — at a wall it widens the units at the end of a row to reach the wall —, so a group measured at its old place can be wider or narrower at the new one. After the reload the server measures the group as built there and, when it does not stand as asked, places it once more by that measure; what that measure finds — an overlap with another group at the new place — is reported instead of what the first measure said | 2026-10-09, user | in effect — `place-group`, roomle-ui `hi-tool-commands.ts`; guarded by `it('places the group once more by its measure at the new place when the library builds it there with another width')` in roomle-ui `__tests__/hi-tool-commands/place-group-test.ts` |

### Load answers (2026-10-13)

Decided with the analysis of [RML-18139](https://roomle.atlassian.net/browse/RML-18139), on the tool
logic in the planner (D71).

| # | Decision | Source | State |
|---|---|---|---|
| D73 | **The planner answers a layout load per group of the call, and the tool pairs by that answer.** The layout load of `create-or-replace-groups` names per group of the call the group of the plan it became, the previous group it restored because the library could not calculate the replace — with the root modules it could not calculate, under the ids the call gave them —, or why it left the group out: a calculation of the group in progress, an error while it was calculated; the other groups go on (D30), and a replace that fails so keeps its previous group. The tool pairs the groups of the call with the plan's by that answer — for the group-wide attributes (D36), the agent's group ids (G50), the placement by wall (D23), the root diagnostics and the hints — and reports a group left out and a replace restored in `notLoaded`. Rejected: pairing the new groups of the plan with the call's by their order — a group left out shifts every pairing behind it, and the placement by wall can then place no group of the call; telling a restored replace by its articles before and after — it names no root module and misses a replace that changed attributes only; the planner's public load result with kernel runtime ids — the tools do not load through it (D71), and a runtime id names no group of the plan context | 2026-10-13, user | in effect — `createOrReplacePosGroupsFromLayout`, roomle-ui `glue-logic.ts`; `readLoadOutcomes`, roomle-ui `hi-tool-payload.ts`; `matchResultGroups`, roomle-ui `hi-tool-ids.ts`; guarded by `it('names per input group the group of the plan it became')` and `it('names a replace the library could not calculate as restored, with the root modules and their diagnostics')` in roomle-ui `__tests__/glue-logic-test.ts`, `it('sets the group attributes on the second group when the planner left out the first')` and `it('places the groups the planner built by wall and names the one it left out')` in roomle-ui `__tests__/hi-tool-commands/create-or-replace-groups-placement-test.ts` |

### The catalog (2026-10-13)

Decided with the analysis of [RML-18140](https://roomle.atlassian.net/browse/RML-18140), on the tool logic in the planner (D71).

| # | Decision | Source | State |
|---|---|---|---|
| D74 | **The catalog carries the docking vectors and the corner flag of every article.** An article that is not in the plan has its geometry from its template, which the planner calculates outside the plan on the first catalog request, once per article until the library's article templates are loaded again — 0.75 s for a library of 111 articles, a few milliseconds per article. `cornerArticle` comes from the corner docking vectors of the calculated article only, in the planner; the server passes it through and removes `cornerPoint` (D10), and the tool commands tell a corner article by the same flag. An article whose template cannot be calculated lists no docking vectors and is no corner article. A caller of the planner API that names `articleIds` (`HiPlanContextOptions`) gets the templates of those articles only. Rejected: the word corner in the category or the module id, in the server or the tool commands — a guess, wrong for a library that names its corner unit otherwise, and library knowledge in the server; a pass over the catalog in the background after the article templates load — nothing to hide at that cost; a size derived from the docking vectors for an article without a `Dim` attribute — the agent docks it by relation, and its `desc` says what it is | 2026-10-13, user ([RML-18140](https://roomle.atlassian.net/browse/RML-18140)) | in effect — `createPlanContext`, roomle-ui `hi-plan-context.ts`; `calculateArticleTemplate`, `glue-logic.ts`; `isCornerArticle`, `hi-group-placement.ts`; `agentFacingArticle`, `agent-facing.ts`; guarded by `describe('article templates')` in roomle-ui `__tests__/hi-plan-context-test.ts`, `it('recognises a corner article by its flag')` in roomle-ui `__tests__/hi-group-placement-test.ts` and `it('passes the corner flag through as the planner reports it')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` |

### Planning skills (2026-10-14)

| # | Decision | Source | State |
|---|---|---|---|
| D75 | **Domain planning knowledge is served on demand by the tool `get-skill`.** The skills are files in the Agent Skills format in the server package (`hi-mcp/hi-mcp-server/skills/<name>/`: `SKILL.md` with `name` and `description` in its frontmatter, and the supporting files it names), maintained as their authors deliver them. The description of `get-skill` lists every skill by its frontmatter, so the agent of every client sees the index in the tool list; the result of a `SKILL.md` starts with a preamble that maps the skill onto the planning session — the survey is the plan context, the products are the catalog, what the plan context does not carry is an assumption to name —, never written into the files. The Skills extension of MCP (`io.modelcontextprotocol/skills`, SEP-2640) serves the same files in addition, to a host that loads skills itself: the server declares it in the `initialize` capabilities beside `resources`, answers `skills/list` and `skills/get` with per skill the URI of its `SKILL.md` (`skill://<name>/SKILL.md`), its frontmatter and the manifest of its files — URI, SHA-256 digest and byte size of the text served —, and serves every file as a resource under `skill://<name>/<path>`, as it is, without the preamble; on protocol `2025-11-25`, without the `resultType`, `ttlMs` and `cacheScope` of revision `2026-07-28`, which the MCP SDK 1.x does not speak, and without `directoryRead`. `get-skill` stays for every client without the extension, the two chats among them. Rejected: the skills in the chats' system prompts — two implementations and their tokens in every step of every turn; skill files in the IDE workspaces only — the server is installed at user scope, and the chats, Claude Desktop and Le Chat load no skill files; the skills in `INSTRUCTIONS` or `AUTHORING_RULES` — every agent would carry every skill, and the chats do not pass the instructions; MCP resources or prompts alone — a resource is an attachment the user adds, a prompt a command the user invokes, neither is model-driven; the Skills extension of MCP alone — none of the clients in use supports it; the preamble in the `SKILL.md` the extension serves — the files are served as their authors deliver them; one tool per skill — the tool list grows with every kind of room; a planning tool in the server — the agent declares, the planner arranges (§2.1) | 2026-10-14, user ([RML-18148](https://roomle.atlassian.net/browse/RML-18148)); the Skills extension 2026-10-17, user | in effect — `skills.ts` (`loadSkills`, `skillIndex`, `readSkillFile`, `skillUri`, `skillManifest`), `SKILL_IN_SESSION`, the registration of `get-skill`, `SKILL_ENTRIES`, the skill resources and the handlers of `skills/list` and `skills/get` in `hi-mcp-server.ts`; guarded by `it('lists every planning skill with its description in the get-skill description and tells the agent to fetch it before planning')`, `it('answers get-skill as text, with the session preamble before the skill and without it before a supporting file')` and `describe('hi-mcp-server skills extension')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts`, `describe('skillManifest')` and `describe('the skills of the server')` in `hi-mcp/hi-mcp-server/tests/skills.test.ts`, and the check `npx @modelcontextprotocol/inspector@2.11.0 --cli <server>/mcp --transport http --method skills/list --verify` |
| D80 | **The chat prompts come from the planner, and the system prompt names the planning skills.** The system prompt and the image prompt of an AI chat with the HI tools are text of the roomle-ui glue logic (`hi-agent-prompts.ts`): the planner's `getExternalObjectAgentPrompts()` returns them as `systemPrompt` and `imagePrompt`, an object that may carry more later; when a library says which furniture it generates, the glue logic composes the prompt from it. The page requests them once when the chat starts and sends them with every chat request (`prompts`); the chats keep no prompts of their own, and the backend answers a request without them with 400. The system prompt names the skills by their directory names — `kitchen-planning`, `kitchen-planning-fr`, `living-room-planning`, `image-planning` — and asks the agent to fetch the skill of the request with `get-skill`: a name contract between roomle-ui and the skills of the server; an unknown name gets the list of the skills (G65). Handling an image is a skill, `image-planning`, for an image with or without text: the image is the brief, a room skill supplies its checks. An image without text gets `imagePrompt`, which names it. Rejected: the prompts through the MCP server — a seventh planner method on the bridge allow-lists (D71), a server endpoint for the chats' sake, and an MCP prompt is invoked by the user; the prompts in the served text of the server — it names no library content (§2.4), the glue logic is per library; the image handling as a skill only — a message without text asks the model for nothing, and the server never sees the user's message; the chat loading the image skill itself for an image without text — code in every chat, and the skill text in every later step of the conversation | 2026-10-14, user ([RML-18187](https://roomle.atlassian.net/browse/RML-18187)) | in effect — `hi-agent-prompts.ts`, `GlueLogic.getAgentPrompts` and `getExternalObjectAgentPrompts` of the planner (roomle-ui); `startPlanningAssistant` of the roomle-ui embedding-lib, `run-hi-mcp-prompt.js`; ligna-store `components/blocks/Planner.vue` and `hi-mcp/chat.ts`; `skills/image-planning/`; guarded by `describe('getAgentPrompts')` in roomle-ui `homag-intelligence/__tests__/hi-agent-prompts-test.ts` and `describe('the skills of the server')` in `hi-mcp/hi-mcp-server/tests/skills.test.ts` |

### Vocabulary and results (2026-10-14)

| # | Decision | Source | State |
|---|---|---|---|
| D76 | **The attribute vocabulary is a default section of the plan context.** `get-plan-context` returns `attributes` by default: per library the customer-facing or Bool attributes of the compacted master data — `id`, `name`, `desc`, `group`, `type`, `selections` with value, name and desc — with a value list several attributes share listed once, `sameSelectionsAs` naming the attribute that lists it (as `find-attributes`, D64); the root modules and the group settings stay in `masterData`, on request. The rules, the instructions and the tool descriptions say that the ids and values are there, so a planning needs no search; `find-attributes` answers a question about one attribute. A model that had to search the vocabulary spent 1.5 search-only steps and 12.5 s per run on it (gpt-6-astra; gpt-5.4-mini 3–6 steps); the section costs about 5k tokens per step. Rejected: the colour, program, handle and plinth attributes only — the server would choose per library which attributes matter (§2.4); the root modules per attribute in the section — about 10k characters more in every step, and the catalog's `mainAttributes` say which attributes a root module carries; every attribute assigned to a root module — about four times the vocabulary (Furniture_Smith), mostly internal attributes no agent sets, while the root-assigned Bool attributes carry the generation switches and their descs say what they do; a generation switch recognised by its id or attribute group — library content in the server's logic (§2.4) | 2026-10-14, [RML-18164](https://roomle.atlassian.net/browse/RML-18164) | in effect — `get-plan-context` (`tool-executors.ts`), `agentFacingAttributes` (`agent-facing.ts`); the served text in `hi-mcp-server.ts`; guarded by `it('returns the attribute vocabulary by default, a shared value list once, and no master data')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` and `it('tells the agent that the attribute vocabulary is in the plan context and that find-attributes answers a question')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` |
| D77 | **A tool command answers settled.** The planner answers a tool command after its last reload, so every history event of the call has arrived when it answers; the server counts `historySteps` only, waits for no follow-up event, and `undo` reverts the call at once. Every follow-up command — the attribute commands, exchange, insert, swap, the gap-closing delete — relays exactly its steps' events before its answer and none after it, so a server wait for one event more would cost every plan-changing call 2 s and withhold `undo` after it. roomle-ui reports no follow-ups. Rejected: a wait in the server that counts late events — bookkeeping for a case the planner does not produce | 2026-10-14, [RML-18164](https://roomle.atlassian.net/browse/RML-18164) | in effect — `countingPlannerApi`, `recorded`, `revertToolCall` (`tool-executors.ts`), `plan-history.ts`; roomle-ui `runToolCommand` (`hi-tool-commands.ts`); guarded by `it('records a call as soon as it resolves, whatever follow-ups its result reports')` and `it('reverts an attribute change right after it with one planner undo')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` |
| D79 | **A tool call is one planner undo step.** The planner's `externalObjectGroupOperation` holds one interaction step for an HI tool command, as `replaceObject` pins one step across a remove and an add: the loads and group operations inside the call resume that step instead of committing one each, and the end of the call commits it — one history event, one undo for the user's button and for the server's `undo`; a call that throws after it changed the plan is released as well, so its half-done change is one step. The command reports `historySteps` 1 when it changed the plan and 0 when it did not, and the server's accounting stays as it is. With a step per load, a create with a wall placement and materials would make three steps — the load, the reload at the wall, the attribute command — and the planner's undo button would revert it piecewise, the first click leaving the kitchen without its materials. Rejected: begin and end methods on the page allow-lists called by the server around each call — two more bridge calls per tool call, and since D71 the whole tool runs inside one planner call, which holds the step itself | 2026-10-14, [RML-18164](https://roomle.atlassian.net/browse/RML-18164), the backlog item one planner undo step per tool call | in effect — roomle-ui `runToolCall` (`plan-interaction-manager.ts`), `externalObjectGroupOperation` (`roomle-planner.ts`), `runToolCommand` (`hi-tool-commands.ts`); guarded by `describe('runToolCall')` in roomle-ui `planner-core/__tests__/plan-interaction-manager.ts`, `it('runs an external object group operation as one tool call step of the interaction manager')` in roomle-ui `planner-core/__tests__/roomle-planner.ts`, `it('reports one step for a tool call that loaded and ran several things')` in roomle-ui `__tests__/hi-tool-commands/run-tool-command-test.ts` and `it('reverts a create with materials with one planner undo')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` |

### Walls (2026-10-16)

| # | Decision | Source | State |
|---|---|---|---|
| D81 | **A side label names the wall face, and a group goes where the user puts it.** A door or a floor-to-ceiling window splits a wall into several contour segments of the same side (D61); a window with a sill does not. A side label names the face of that side: the longest run of its segments in a straight line — the pieces of type `wall` and the openings between them, also across the start of the contour — with at least one piece of wall (`wallFaces`). The group goes on the face's longest piece of wall when its width fits there (5 mm tolerance), so it keeps clear of a door beside it; else across the whole face, in front of the glass or the door. A corner alignment uses the corner of that piece or face, and the adjoining wall is a face too, so a wall of glass adjoins a corner. A wall index names one segment. The end face of a partition inside the room is a face like any other and is shorter than the outer wall of its side. `place-group` answers with the face as its `wall`, without its pieces. The hint of a root module in front of an opening, with no piece of wall behind it, names the face by its pieces — "the front wall (walls 3 to 9)" — and lists its free stretches per piece, measured from that piece's end like the `fromEndMm` of a placement by wall index. The served rules say that a group goes on the wall, the corner or the spot the user names, also in front of a door or a window, and that the answer names the openings; the free stretches are for a place the user leaves open. No guard and no correction: the group is built where the user puts it, and the hint names what it stands in front of (D51, D55). Rejected: the face in every case — a group centred on a wall with a door in the middle would stand in front of the door; the face only when the longest piece of the side is narrower than the group — that piece can be the end of a partition, and the group would land there; a corner alignment always into the corner of the face — a group that fits beside a door at the corner would stand in front of the door; the hint's stretches measured along the face — a placement by side label measures `offsetMm` along the piece the group fits on, so the agent would place it wrong. | 2026-10-16, user ([RML-18198](https://roomle.atlassian.net/browse/RML-18198)) | in effect — `wallFaces`, `adjoiningWall`, `wallOfRoot` (roomle-ui `hi-plan-space.ts`); `resolveWall`, `pieceOrFace`, `resultWall` (`hi-wall-placement.ts`); `freeStretchesNote` (`hi-tool-hints.ts`); `AUTHORING_RULES` and the `wall` description of `place-group` (`hi-mcp-server.ts`); guarded by `describe('a wall of floor-to-ceiling glass')` in roomle-ui `__tests__/hi-tool-commands/create-or-replace-groups-placement-test.ts`, `it('moves a group onto the glass front the user names and answers with the whole front')` in `place-group-test.ts`, `describe('wallFaces')` and `describe('the walls of a room as faces')` in `__tests__/hi-plan-space-test.ts`, `it('tells the agent that a group goes on the wall the user names, also a wall of glass')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts`, and the test `living-room-sideboard-and-tv` of `docs/test-prompts.json` |

### Merge (2026-10-16)

| # | Decision | Source | State |
|---|---|---|---|
| D82 | **A merge is a row edit.** `merge-article-into-group` arranges the group against the group before the merge and loads it once, as the insert does (D39): the earlier root modules keep their place, the row grows at its free end, and a root module docked on the side at a wall moves the group away from that wall (D41). The arrangement starts from the root module nearest the group origin; the new root module starts where the root module it docks to stands, so the arrangement never starts from it, also in a group with no root module at its origin — a group the library generated with a part there, or one placed by wall or by point, whose roots the reload re-anchors. The result carries the row hints (D43). Rejected: the arrangement starting from a root module of the group before the change — the insert's start position is enough and leaves the arrangement as it is | user, 2026-10-16 | in effect — `mergeArticleIntoGroup`, roomle-ui `hi-tools.ts`; `merge-article-into-group` with `withRowHints`, roomle-ui `hi-tool-commands.ts`; guarded by `describe('mergeArticleIntoGroup')` under `row edits` in roomle-ui `__tests__/hi-tools-test.ts`, `it('tells when a merge makes the row reach past a wall')` in roomle-ui `__tests__/hi-tool-commands/group-commands-test.ts` and the test `sideboard-row-one-more-cabinet` of `docs/test-prompts.json` |

### Doors (2026-10-17)

| # | Decision | Source | State |
|---|---|---|---|
| D84 | **The doors at the two ends of a row are hinged at its outer sides.** No handle is on the outside of a row: the door at the left end is hinged on the left, the door at the right end on the right, as seen from the front; a pair of doors side by side is hinged at its two outer sides. The agent sets it with the library's door direction — the value for single doors or for a pair of doors, as the article has — on the root modules at the two ends, `rowIndex` 1 and the last (a corner article joins the legs into one row, D66), and again on the root module at an end after an edit that gives the row a new end: an article added, deleted, exchanged or swapped at an end, because a library need not pass the door direction on between neighbours (D56; Furniture_Smith does not). The other doors keep their side, the former end after the row grows too. The rule names no attribute and no value; the library data says which (§2.4). Rejected: the server setting or correcting the side of the ends by `rowIndex` — it needs the library's door direction attribute and its values, library information in the server's logic; the reminder repeated in the descriptions or the results of the edit tools — every request carries the whole tool list, so the one reminder in `get-plan-context` reaches every edit | user, 2026-10-17 | in effect — `AUTHORING_RULES` and the new-end reminder in the description of `get-plan-context` (`hi-mcp-server.ts` and its copy in roomle-ui `packages/web-sdk/packages/homag-intelligence/src/hi-mcp/hi-mcp-server.ts`, D94), delivered in both chats' tool lists; guarded by `it('tells the agent to hinge the doors at the two ends of a row at its outer sides')` and `it('tells the agent to hinge new row ends through the tool list without fetching authoring rules')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` and the tests `wardrobe-door-hinges`, `wardrobe-extend-door-hinge`, `edit-swap-door-hinges`, `wardrobe-swap-door-hinges`, `wardrobe-split-door-hinges`, `wardrobe-exchange-end-door-hinge`, `edit-swap-paired-door-hinges`, `edit-exchange-drawer-end` and `undo-a-wrong-command` of `docs/test-prompts.json` |

### Installation elements (2026-10-19)

| # | Decision | Source | State |
|---|---|---|---|
| D86 | **Electric plugs and water connections are installation elements, not obstacles.** The plan context carries them in a default section `installationElements`: per element its `type` — `ElectricPlug` or `WaterConnection` — and its `position` `[x, level, z]` in the coordinates of the walls; a position only, no size. They leave `obstacles` (D45): a group may stand on a supply, so the placement feedback (D55) reports no overlap for it, while a light switch and the other plan objects stay obstacle objects. The HI layer gathers the elements from the live plan objects — one entry per placed supply assembly, hidden owners omitted — and the planner adapter stays generic. The session preamble of the skills names the known connection positions and keeps the other services unknown. Rejected: leaving the supplies in `obstacles` — a group in front of a plug would be told it stands on an object; filtering them in the MCP server only — the placement feedback of the roomle-ui tool commands would still report them; recognising them by article id, name or level 43 — catalog content, and 43 is a general height level other objects share; removing them from RoomleCore's obstacle map — other consumers of the map need their geometry | [RML-18023](https://roomle.atlassian.net/browse/RML-18023) comment 156276 | in effect — roomle-ui `api.ts` (`_gatherInstallationElements`), `shapeInstallationElements` and the supply exclusion of `shapeObstacles` (roomle-ui `hi-plan-context.ts`); `installationElements` in `DEFAULT_SECTIONS` and the description of `get-plan-context`, `SKILL_IN_SESSION` (`hi-mcp-server.ts`); guarded by `describe('shapeInstallationElements')` and the installation-element tests of `describe('getPlanContext')` in roomle-ui `__tests__/hi-plan-context-test.ts`, `describe('RoomDesignerApi.getPlanObstacles')` in roomle-ui `__tests__/api-test.ts`, `it('passes the installation elements through unchanged')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts`, `it('returns the installation elements of the plan context as JSON')` and the description assertions of `it('tells the agent what stands in the room and that the hint names a root module on an obstacle')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts`, and the supply tests `it('does not report an overlap with a supply the group stands on')` in roomle-ui `__tests__/hi-tool-commands/place-group-test.ts` and `it('does not name a supply the group stands on')` in roomle-ui `__tests__/hi-tool-commands/create-or-replace-groups-placement-test.ts` |

### Kitchen placement (2026-10-19)

| # | Decision | Source | State |
|---|---|---|---|
| D87 | **A kitchen without a named place is planned with its sink near a water connection.** The kitchen skills state the rule: when the user does not name a place for the kitchen, plan it so that the sink stands near a water connection of the plan, if the room has one; the installation elements of the plan context list the water connections with their positions (D86). The rule lives in the kitchen skills, not the general served text, which stays neutral between the kinds of rooms (§2.4) | user, 2026-10-19 | in effect — the kitchen skills `kitchen-planning/SKILL.md` and `kitchen-planning-fr/SKILL.md`; guarded by `it('tells the agent to plan a kitchen without a named place with its sink near a water connection')` in `hi-mcp/hi-mcp-server/tests/skills.test.ts` |

### Calculation errors (2026-10-19)

| # | Decision | Source | State |
|---|---|---|---|
| D95 | **An attribute edit the library cannot calculate is kept and named.** When the library cannot calculate a root module after `change-module-attribute` or `change-group-attribute`, the planner keeps the edit and the calculation, and the tool names the root module with the first line of its diagnostic and the action — check the group's attributes and the root's overrides against the library data, change the failing values or replace the article (C25). Such a root module has no docking vectors and no front parts until a valid value recalculates it; that recalculation arranges with the new vectors, keeps the requested docking mode where the previous vectors are missing, and keeps the group transform while either docking footprint is incomplete. A root module the library could not calculate when it was added was never docked: the planner put it where another root module stands. When an edit lets the library calculate it, its docking places it: it does not start its docking cluster while another root module of the cluster has a position, so a unit on top of a wall unit docks onto the wall unit instead of pulling the wall row down to the group origin. A root module that failed after it was docked keeps its place and may start its cluster. The group stays where it stands in the room as well: the load of a calculation in which a root module loses or regains its docking vectors applies the group position. Without it the kernel keeps the group in place by that root module's center, which moves between the failed and the calculated geometry — a row whose far unit is widened and then corrected would move by the change of that center, through the wall at its other end. A later row edit drops a docking to a vector the root module does not have and says so (C20). Rejected: copying the previous docking vectors onto the failed root module — its front stays unbuilt, and after a resize the copied vectors are stale; keeping a docking link to a vector the root module does not have, or refusing an edit of such a root module — both act on the symptom; resetting the failing attribute automatically — the value may be the user's, and the server would need the library's valid combinations (§2.4); returning the whole calculated group — one diagnostic line per cause keeps the compact result (D62); applying the group position on every attribute load — a group whose root modules keep their docking vectors, or never have any, stays with the kernel's anchor as the planner places it; another reference root in the kernel — the glue logic knows the group position and the kernel applies it exactly; moving or clamping the row after a later swap — the swap keeps the row where it stands (D41), and a group outside the room may be wanted; docking every root module that regains its docking vectors from its neighbours — a row whose first unit failed in place and recovers would no longer keep its end where it stands; keeping a root module that stands on the floor out of the units above, or counting filler panels as floor units — both act on the symptom, and the second puts library content in the tools' logic (§2.4) | user, 2026-10-19; the applied group position and the never-docked root module 2026-10-21 | in effect — `withLibraryChanges`, roomle-ui `hi-tool-attributes.ts`; `_logFailedRootModules`, `rootModuleGainedOrLostDockingVectors` in `_runGroupCalculation`, roomle-ui `glue-logic.ts`; `_getDockMode`, `keepWallDistances`, `_seedCandidates`, roomle-ui `hi-root-module-arrangement.ts`; `compactAttributeResult`, `tool-executors.ts`; guarded by `it('keeps the change and logs the root module the library reports an error for')` and `describe('a root module the library could not calculate')` in roomle-ui `__tests__/glue-logic-test.ts`, `it('keeps the group in place when a change-module-attribute lets the library calculate a failed root module again')` and `it('keeps the end of a row in a corner in place when roots of different widths change places')` in roomle-ui `__tests__/hi-tools-test.ts`, `it.each(['change-module-attribute', 'change-group-attribute'])('keeps a failed calculation and reports its diagnostic through %s')` in roomle-ui `__tests__/hi-tools-test.ts`, `it.each([0, 1])('uses the requested mode when original root %s has no vectors after a failed calculation')`, `it.each(['before', 'after'])('keeps the group transform when the %s measurement omits a failed root')` and `describe('a root the library calculates for the first time')` in roomle-ui `__tests__/hi-root-module-arrangement-test.ts`, `it('keeps the wall unit in place when a change-module-attribute lets the library calculate the unit on top of it for the first time')` in roomle-ui `__tests__/hi-tools-test.ts`, and `it.each(attributeCalls)('runs %s in the planner with its arguments as sent and answers with the ids of what changed')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` |

### Doors and drawers (2026-10-20)

| # | Decision | Source | State |
|---|---|---|---|
| D88 | **The agent opens doors and drawers to look inside, and the images show them as they are.** `open-or-close-group` (`groupId`, `open`) and `open-or-close-article` (`rootModuleId`, `open`) are tool commands of roomle-ui, sent through `externalObjectGroupOperation` (D71): group operations of `hi-tools.ts` that call the planner's `openOrCloseGeometryOfExternalObject`. They switch at once, without animation, so an image right after shows the final state. A root module opens without the root modules docked to it. They change the view, not the plan: `changed: false` and `historySteps` 0, so the planner makes no undo step and the server records nothing for `undo` (D38, D47). A target without doors or drawers is named in `corrections`. `get-plan-images` requests the snapshot with `keepOpenGeometry`, so its images show the doors and drawers as they are; without that property the planner's snapshot closes them, as for an order. Rejected: the planner method as a seventh method of the page allow-lists (D71); the flying-menu path `setAnimationValueOfPlanObject`, which acts on the user's selection and runs in a plan interaction; one tool with an optional root module; a toggle — the agent does not see the current state; restoring the open state inside the interior-fitting commands after the reload of a group — the served rule opens the cabinet right before the images, whether or not a reload keeps it open | user, 2026-10-20 | in effect — `open-or-close-group` and `open-or-close-article` in `hi-mcp-server.ts` and `tool-executors.ts`, `get-plan-images` in `tool-executors.ts`; roomle-ui `hi-tools.ts`, `roomle-planner.ts`; guarded by `it('keeps the undo record of the last plan change when a cabinet is opened after it')` and `it('returns the plan images of the external object snapshot')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts`, `it('tells the agent to open a cabinet before it looks inside with get-plan-images')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts`, and in roomle-ui by `test('opens one root module: its component without the root modules docked to it')`, `test('opens the first root module only, although its component is the one of the group')` and `test('renders every requested asset with the geometry as it is when keepOpenGeometry is set')` in `planner-core/__tests__/roomle-planner.ts` and `it('reports no step for opening or closing doors and drawers')` in `homag-intelligence/__tests__/hi-tool-commands/run-tool-command-test.ts` |

### Interior fittings (2026-10-20)

| # | Decision | Source | State |
|---|---|---|---|
| D96 | **Interior fittings are edited by five tools of their own, each edit one staged tool command of roomle-ui.** `get-interior-design-options` reads through the scoped `interiorDesign` section of `getExternalObjectPlanContext` — no selection, no history entry, queued behind plan changes; `add-interior-fitting`, `move-interior-fitting`, `delete-interior-fittings` and `replace-interior-fitting` are tool commands sent through `externalObjectGroupOperation` (D71), so the planner API stays at six methods. Each command asks the library for the compatible articles within its own call, addresses installed fittings by their unique instance ids, stages the edit on a copy of the group, awaits the final load and returns the loaded fittings; a replacement removes the source on the copy only, so a replacement the library cannot build leaves the original in place. Groups carry read-only `interiorFittings`, which a resubmitted group drops. Rejected: forwarding the planner's interactive sub-article methods as they are — they keep one compatibility list for every group, do not await their load and return nothing for an edit the library did not make; the root edit tools (`delete-article-and-compact`, `exchange-root-module`) — they edit the cabinet, not the fitting; the agent rebuilding a group's nested module tree — it duplicates the library's assembly and loses unrelated fittings, settings and docking; a replacement as a delete and an add — a plan without the original in between, and two undo steps; a planner method per tool, or discovery through the edit route — a read must not enter the edit route; fitting kinds, containers or placement attributes in the served text (library-neutral, §2.4) | user, 2026-10-19 | in effect — roomle-ui `hi-interior-design.ts` (`interiorOptions`, `compatibleArticles`, `stageInteriorEdit`), `hi-tool-commands.ts`, `hi-tool-payload.ts` (`READ_ONLY_GROUP_FIELDS`); `hi-mcp-server.ts`, `tool-executors.ts`; guarded by the `interior fitting identity and staging` and `interior API completion and restoration` tests in roomle-ui `homag-intelligence/__tests__/hi-interior-design-test.ts` and `it('forwards scoped read options and never enters the edit route')`, `it('records an interior-only move and confirms undo and redo with unchanged cabinet roots')` in `hi-mcp/hi-mcp-server/tests/interior-fittings.test.ts` |
| D89 | **A fitting's position is where its parts start, and the tool command places a fitting at the requested point.** A library can keep a fitting's module at the origin of the interior and place its parts by the insertion point, so the module's origin says nothing about where the fitting is. `position` is therefore the lowest corner of the fitting's own visible parts, relative to its parent, in root space (group-space part matrices converted back); a fitting without parts keeps its module origin. `insertPosition` uses the same frame. The library reads the point in a frame of its own: the tool command adds at the point, measures the calculated fitting and, when it landed elsewhere, adds once more on the pre-add copy at the point mirrored by that deviation — exact for a constant frame offset. A retained source setting that moves any fitting is reset (C28), so a move keeps the placement the library derived from the point. Rejected: naming a library's placement attributes in the served text or reporting them as the position (library-neutral, §2.4); dropping the settings copy as the planner's drag does (it keeps a moved or replaced fitting's explicit settings); refusing a point outside the interior (a guard, §2.2); an offset parameter for the move — not needed while the agent can add the offset to the measured position | user, 2026-10-20 | in effect — roomle-ui `hi-interior-design.ts` (`interiorFittings`, `stageInteriorEdit`), `hi-plan-space.ts`; the `insertPosition` and `get-interior-design-options` descriptions in `hi-mcp-server.ts`; guarded by the `interior fittings placed by their parts` tests in roomle-ui `homag-intelligence/__tests__/hi-interior-design-test.ts` and `it('tells the agent that a fitting moves by an offset added to its discovered position')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` |

### Islands (2026-10-20)

| # | Decision | Source | State |
|---|---|---|---|
| D98 | **`behind` stands flush with the end of its neighbour where the turned unit's own row starts.** The back-to-back pair gets an explicit endpoint mode: the neighbour's right end, seen from its front, when the side relations that name the turned unit continue its row to its right only — `EndStart` on the neighbour's entry —, else its left end — `StartEnd`: no row, a row to the left, rows on both sides. The turned unit names `behind`, so only the relations that name it make its row. An entry written on the turned unit carries the mirrored mode (C16), so the layout follows from the relations, not from the order of the roots: for two back vectors without a mode, the planner puts the start of the entry's owner on the end of its partner, and the end would follow whichever root comes first. A turned row of the same total length ends flush at both ends, whichever end of the island it starts from; rows of different total lengths keep their step at the far end. The endpoints of the actual vectors place the unit — no catalog widths, offsets or orientation —, and the kernel captures back-to-back pairs with the same modes. The served text stays: the relations the agent writes already say where the turned row runs. Rejected: the served text alone — it would have to teach one composition and the order of the roots, against a composition the models write unprompted; `align` on `behind` — the agent would work out the end the server derives; aligning whole rows after the compilation, or refusing pairs of different widths — a deliberate step is legitimate; explicit `StartStart` — another placement; offsets from catalog widths — the vector endpoints express the alignment | user, 2026-10-20 | in effect — `pairOf` in `relationsToDocking`, roomle-ui `hi-group-layout.ts`; guarded by `it.each(...)('docks behind by the back vectors, flush at the end the turned row starts from: %s')`, `it('mirrors the mode of behind when the planner reaches the unit first')` and `describe('an island of rows back to back')` in roomle-ui `__tests__/hi-group-layout-test.ts` |

### The cause of a calculation error (2026-10-21)

| # | Decision | Source | State |
|---|---|---|---|
| D99 | **A calculation error of the library is an MCP bug when an invalid attribute value caused it, and a library bug otherwise.** A value is invalid when the library rules it out: the attribute's selections and their descriptions, or the verified options the library gives for the module (`getVerifiedAttributeOptions`: an `Invalid` entry, a value outside the range). A value the library accepts must calculate; when it does not, the library is at fault, and the issue goes to `.agents/backlog/library-issues.md` and to the library development team. When the tools sent an invalid value, the MCP is at fault: the served text or the tool API led the agent to the value, or the tool applied it without checking it. The tools' handling of a failed calculation (D73, D95, C25) is a fallback that keeps the plan usable; it is not a path a valid planning takes. Rejected: treating every calculation error as intended library behaviour — a value the library accepts and cannot calculate leaves a root module without geometry, which no planning asks for | user, 2026-10-21 | in effect for the classification of issues and analyses; the check of a value against the verified options before an edit is open work — [attribute-values-checked-before-an-edit.md](../.agents/backlog/attribute-values-checked-before-an-edit.md) |

## 4. How a tool call runs

- **MCP endpoint**: `POST /mcp` — Streamable HTTP, JSON response mode, stateless (a new transport per
  request), port 3100 (`HI_MCP_PORT` or `PORT`). On Cloudflare, `?session=` routes to a per-session
  container. Browser chats include `?client=<page ID>`; requests with an ID other than the active
  page's are refused with HTTP 409, including `tools/list`. External MCP clients without a page ID
  can still call tools against the currently connected page.
- **Page bridge**: the page connects to the WebSocket `/bridge` (from any origin),
  announces bridge protocol 2, and executes the planner methods the tools send on
  `roomDesignerApi.extended`. Its `hello` may carry a browser chat ID; the server sends `ready`
  only after accepting the page. A second page is closed with code 4409 without replacing the
  active OPEN page. If the owner socket is CLOSING, its pending calls are rejected before the new
  page is accepted; the old socket's later close does not remove the new owner. Each planner call from a page-bound chat rechecks the ID, so a request cannot jump
  to a different page after a disconnect. The server answers a call only with a result from the
  active page, the one the call went to; a frame that is not a JSON object is ignored. The page
  relays the planner's `onHistoryChange` callback — one call per committed step, undo and redo of
  the planner's undo history — as `{ kind: 'event', name: 'historyChange', undo, redo }` once it
  is accepted, and keeps a handler the host page set; the server counts the events of the active
  page only (`plan-history.ts`, D37) and starts a new history when it accepts a page.
- **Planner methods** (`planner-api.ts`), with the timeout per call:

  | Method | Used by | Timeout |
  |---|---|---|
  | `getExternalObjectPlanContext(include)` | every tool that reads the plan; the plan before and after a tool call that changes it (D38) | 30 s |
  | `externalObjectGroupOperation(command, payload)` | every tool that changes the plan: the command is the tool's name, the payload its arguments (D71) | 120 s |
  | `undo()` | `undo` | 30 s |
  | `redo()` | `redo` | 30 s |
  | `fetchPrice()` | `get-price` | 30 s |
  | `getExternalObjectSnapshot(options)` | `get-order-data`, `get-plan-images` | 120 s |

- **The tool commands** (roomle-ui): `executeGroupOperation` (`hi-tools.ts`) runs a command named like
  a tool as that tool — `runToolCommand` with `HI_TOOL_COMMANDS` (`hi-tool-commands.ts`) —, every
  other command as a group operation of the planner (`runGroupOperation`, D3). A tool command reads
  the plan context and the calculated groups, loads layouts, calculates article templates and runs
  group operations in the planner itself, and answers with the tool's result — its groups in the
  placement frame (C14) — plus `historySteps`; the server removes it before the agent sees the
  result. The plan context of the planner reports the groups in the placement
  frame too.
- **One plan change at a time.** The tools that change the plan wait for each other (D4): the record
  of a call for undo compares the plan before and after it, and the page runs every planner call it
  receives at once, so a concurrent call would mix into the record. `get-plan-context` waits with
  them, so it never reads a plan halfway through a change. `undo` and `redo` wait with them too: an
  undo never runs beside another plan change.
- **Every tool call that changes the plan is recorded** (D38): the planner runs a tool command as
  one step of its undo history (D79), and the tool command reports `historySteps` 1 when it changed
  the plan — a load that loaded something or a group operation — and 0 when it did not
  (`runToolCommand`, guarded by `describe('runToolCommand')` in roomle-ui
  `__tests__/hi-tool-commands/run-tool-command-test.ts`); the server counts the steps of a call, a
  result without `historySteps` as one step (`countingPlannerApi`). A tool that fails after it changed the plan
  answers with `error` and its steps instead of rejecting: the server records the steps, so undo
  reverts the half-done call, and raises the error to the agent (`inPlanner`, guarded by
  `it('records the steps of a tool that failed after it changed the plan and relays its error')` in
  `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts`). It reads the groups of the plan context before
  the call and after it (`readGroupsKey`). The group-wide attributes of a create are one group
  operation (D36), within the call's step. The planner answers a tool command after its last reload — the kernel's position
  answer after an attribute change, an exchange, an insert, a swap or a gap-closing delete reloads the
  group within the command (roomle-ui `_requestKernelOperation`) —, so every history event of a call
  has arrived when the call answers, and the server waits for none (D77; guarded by
  `it('records a call as soon as it resolves, whatever follow-ups its result reports')` in
  `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts`); a `historyFollowUps` an older planner reports
  is ignored. The history events while a call runs are its own; any other one is a change in the
  planner. A recorded call ends redo, as the planner drops its redo future with a new step.
- **The store connection** starts when its planner is available and `mcp_server` is valid,
  independently of chat settings. `mcp_session` selects a shared session; without it the store
  generates one per page. Bridge and optional chat resolve one client/session identity, so the
  chat's `client` parameter owns exactly that planner. External agents use the same session
  without a browser `client` parameter. Cloudflare supplies `HI_MCP_STORE_URL` with the request's
  session (or `default`) before container startup, so the no-page error directs the user to the
  agent's session without requiring chat credentials.
- **The HI chat of the example page** is the planning assistant of the roomle-ui embedding-lib
  (`startPlanningAssistant`, `hi-planning-assistant.ts`), which runs the copy of the tools in the
  page (D94) — no MCP client of this server. It gives the model the system prompt of the planner —
  `systemPrompt` of the planner's `getExternalObjectAgentPrompts()` (D80), six sentences: the first
  names what HI plans, "kitchens, wardrobes, living room and utility furniture, all made of
  articles", not "a kitchen", which made a wardrobe group look foreign to the model (D44); the fourth
  tells it to take the closest article of the catalog when the request names a kind of article, and
  to say which one, instead of asking; the fifth asks it to summarise what it changed from the last
  tool results only, never by repeating them, and to name what was asked but is not in the plan; the
  sixth names the planning skills and asks it to fetch the one of the request with `get-skill` — and
  **not** the server's initialize instructions. The model receives the full authoring rules through
  `get-authoring-rules`; reminders in tool descriptions, including the D84 end-door trigger in
  `get-plan-context`, reach it through the tool list on every request. A chat turn has 16 steps; the
  last one cannot call a tool, so the turn reserves an answer step (`MAX_CHAT_STEPS`). A turn that
  fails — a provider or stream failure — ends with "The planning assistant failed: <message>" and
  is not kept: the next turn sees the completed turns only, with their tool calls and results. The
  turn has no time limit and no interruption summary, and the steps are not logged. gpt-5.4-mini
  and gpt-5-mini plan at reasoning effort `high`
  ([RML-18043](https://roomle.atlassian.net/browse/RML-18043)), `HI_CHAT_REASONING_EFFORT` of the
  launcher overrides it for every GPT deployment
  ([RML-18041](https://roomle.atlassian.net/browse/RML-18041)). The chat of the ligna-store is an MCP
  client of this server with its own turn loop, recovery and step log (ligna-store
  `hi-mcp/chat.ts`, `chat-recovery.ts`).

## 5. Information the server provides

### 5.1 Server instructions (at initialize)

`INSTRUCTIONS` (`hi-mcp-server.ts`) says first what everything is made of — the catalog
offers articles, a group is one piece of furniture made of articles (a kitchen, a wardrobe, a
sideboard, a utility room), an article placed in a group is a root module (D44) — and contains the
typical workflow followed by the full authoring rules:

1. `get-plan-context` — rooms with walls, the article catalog, the attribute vocabulary, the groups,
   the obstacles; `find-attributes` for a question about one attribute (D76).
2. For a room of a kind `get-skill` lists, or for an image, the skill first (D75, D80). `create-or-replace-groups` — the whole piece of furniture as one group: article picks, docking,
   one placement. A matching id replaces a group and keeps its position. Units next to an existing
   group are added to it.
3. The command tools to edit an existing group; `place-group` to move one; `undo` reverts the last
   tool call that changed the plan, `redo` brings it back.
4. `get-price` / `get-order-data` to check, `get-plan-images` to inspect; to look inside a cabinet,
   `open-or-close-article` (a whole group: `open-or-close-group`) right before `get-plan-images` (D88).

Not every client passes these instructions to the model; the HI chat does not (§4).

### 5.2 Authoring rules (`get-authoring-rules`)

`AUTHORING_RULES` (`hi-mcp-server.ts`) is plain text. It is served at initialize and by the
tool. It covers:

- **Words** (D44): the catalog offers articles; a group is one piece of furniture made of
  articles — a kitchen, a wardrobe, a sideboard, a utility room, a row of cabinets; an article
  placed in a group is a root module, which the user may call a cabinet, a unit or a module; the
  kind of an article comes from its description and its size from dimensions; the user decides which
  articles stand next to each other; an article the user names by its kind comes from the category
  of its neighbours where that category has one (a kitchen cabinet into a kitchen, a wardrobe into
  a wardrobe), else from the closest kind of another category.
- **The payload**: a group is `{ id?, libraryId?, placement?, attributes?, roots }` (a unit of another size is the same article with its size attribute set, also in the `attributes` of the command tools, D49) — `attributes`
  take the library's group settings and a material for the whole group (D36), of which a root module
  keeps a value of its own —, and a root is
  `{ id, articleId, attributes?, contextData? }`. Which catalog fields say what an article is
  (`desc`, `category`), how big it is (`dimensions`), how it docks (`dockingVectors`), and what it
  contains (`subModules`), plus `cornerArticle`.
- **Trusted descriptions** (D8, D53) — a colour code in the desc of a value is its colour; a desc
  says what an article is, not where the user may put it —,
  **one piece of furniture is one group** (D14), **never author a position** (D15).
- **Fronts** (D59, D60): the front program says how a front is built, by its desc — chosen first,
  then the colour; a colour the program does not offer switches the program, a program resets a
  colour it does not offer, and `corrections` name every such change; when the wanted colour comes
  only with fronts built differently, the agent keeps the fronts, takes the closest colour and tells
  the user.
- **Doors** (D84): in a row, the door at the left end is hinged on the left and the door at the right
  end on the right, as seen from the front, a pair of doors side by side at its two outer sides; the
  agent sets it with the attribute whose values say the hinge side — the value for single doors or
  for a pair, as the article has — on the root modules at the two ends (`rowIndex` 1 and the last),
  and again on the root module at an end after an edit that gives the row a new end; the other doors
  keep their side.
- **Relations**: every root after the first names one neighbour — `rightOf`, `leftOf`, `onTop`
  (`align`, `gapMm`), `above` (`gapMm`), `behind`; wall units beside a tall unit, corner kitchens,
  and the default for a root without a relation (D34).
- **Docking vectors**: how to read the `contextData` of a group from `get-plan-context`, and the
  vectors `merge-article-into-group` names in `dockTo`.
- **Placement** (D23, D81): by wall, alignment and offset at a wall or in a room corner — the server
  computes the point; a side label names the whole wall, its doors and floor-to-ceiling windows
  included —, by point and rotation anywhere else and for a group of wall units only; the
  walls array for the point form; which leg of a corner group runs along which wall, as seen from
  the room.
- **Obstacles** (D45, D55, D81): what the `obstacles` section lists, a door's or a window's wall and span
  from the wall's end; root outlines bound the calculated parts and can extend past their docking
  edges over a neighbour in the same group — that overlap alone is not a placement error;
  that a group goes on the wall, the corner or the spot the user names, also in front of a door or
  a window, and the answer names them; that where the user leaves the place open a new group goes on
  a stretch of wall or a spot `obstacles` leaves free —
  a stretch by alignment `end` and `offsetMm` = the start of its `fromEndMm` —, that base units lower than a window's `bottomMm` fit
  below it, that a group placed in a room corner reaches along the adjoining wall by its depth, so
  a door or a window of the adjoining wall that begins within that depth of the corner is in its
  way (when the user leaves the corner open: the other corner, or an `offsetMm` of at least 600 mm
  from that corner — the strip in front
  of an opening the hint tests, `WALL_STRIP_MM`), and that the result's `hint` names every root
  module on an obstacle with the free stretches of its wall and, for a group placed at a wall in
  front of a door or a window of the adjoining wall, the `offsetMm` that keeps it clear.
- **Extending** — at the end of a row with `merge-article-into-group`, between two root modules
  with `insert-article-into-group`; a new root module inherits from the root module it is docked
  to (D56) —, moving with `place-group`, editing with the command tools and which
  end of a row moves in a row edit (D41, D42), a root module named by its place found by its
  `rowIndex` (D66), verifying results
  numerically, and **undoing a wrong result**: call `undo` and send the corrected call instead of
  correcting the wrong plan piece by piece; a group that only needs a change is edited (D38).
- **Six examples**: a row along a wall, wall units beside a tall unit and above base units, an
  L-shaped corner kitchen, a row centred on a wall, adding a cabinet with `merge-article-into-group`,
  inserting a low cabinet between the high cabinets of any group — a wardrobe too — with
  `insert-article-into-group`.

### 5.3 Result format

- **JSON results** are one text content with compact JSON. Every `imageUrl` is removed at any depth
  (D7). Guarded by `it('returns tool results as compact JSON without image URLs')` in
  `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts`.
- **`get-plan-images`** returns one text content that names the images, then two image contents (PNG):
  the group view and the top view. Without groups in the plan the text says so, and the top view comes
  alone (D97).
- **`get-authoring-rules`** returns the rules as plain text.
- **`get-skill`** returns the skill file as plain text, a `SKILL.md` after the session preamble (§5.6).
- **An error** is an error result (`isError: true`) with the message as text. A schema error reads
  "Input validation error: …".
- Results that change the plan carry `corrections` when the server corrected the input or the
  library changed an attribute beyond the one set (D59), and
  `create-or-replace-groups` reports the groups it could not build in `notLoaded` (§2.3).

### 5.4 The plan context (`get-plan-context`)

One coordinate system throughout: 3D, right-handed, Y up, millimetres. A contour point is
`[x, level, -y]`, the same system as a group's `pos`.

| Section | Content |
|---|---|
| `rooms` | `{ rooms: [{ levels, walls }] }`. `levels`: the contour per level, segments with `cmd`, `pos`, `type` (e.g. `wall`, or none for an opening), `height`, `thickness`. `walls`, derived per room by roomle-ui from the direction of the contour, which runs counter-clockwise with the room on its left (D61): `index`, `side` (as seen in the top view), `name` (back wall, front wall, left wall, right wall), `start`/`end` (`[x, 0, z]` on the floor), `lengthMm`, `type` (`wall`, or `opening` for a door — the contour gives it no type), `heightMm`, `thicknessMm`, `facingRotationY` — the rotation of a group with its back against that wall. `corners`, per room: `name` (back left, back right, front left, front right), `point` and `posRotationY` — the rotation of a corner kitchen in that corner, where the contour turns into the room, also where a door or a floor-to-ceiling window reaches the corner (D83). The server adds the names, the opening type and the corners (C18) |
| `articles` | The catalog: `articleId`, `articleName`, `desc` — of a description written in sections its FUNCTION and AI_SELECTION_HINT lines (D63) —, `category`, `libraryId`, `catalog`, `cornerArticle`. Per root module: `module` (id, name, desc), `dimensions` (size attributes with id, name and value in mm), `mainAttributes`, `dockingVectors` (names), `insertLevels`, `subModules` (id, name, desc). The planner derives `dockingVectors` and `cornerArticle` of every article from the calculated article — a root of it in the plan, or else its template (D74); the server removes `cornerPoint` (D10) |
| `attributes` | Per library id: the customer-facing or Bool attributes of the compacted master data — `id`, `name`, `desc`, `group`, `type`, `selections` (value, name, desc) —, a value list several attributes share listed once, the later attributes with `sameSelectionsAs` instead (D76). The root modules and the group settings are in `masterData` |
| `groups` | Per group: `id`, `libraryId`, `attributes`, read-only `position` (`pos`, `rotationY`, `footprint` with `x`, `z`, `widthMm`, `depthMm`), and `roots`. `pos` and `rotationY` are what a placement would name for the group where it stands: `pos` the room point of its back left bottom corner — the docking corner of its anchor root — and `rotationY` the rotation of the placement; the footprint is measured from `pos`. A group with two corner articles also carries `rootId`, the corner article `pos` belongs to, as in a placement (D17): the planner regenerates root ids, so the corner a placement named cannot be told after the load. roomle-ui derives them from the calculated groups, wherever the planner keeps the group origin (D33); a group the planner has not positioned keeps the planner's `position`. Per root: the article pick (`id`, `articleId`, input `attributes`, `contextData` with vector names only) and read-only facts (`articleName`, `desc`, `category`, `isGenerated`, `dockingVectors`, `freeDockingVectors`, `subModules` with their id, and `rowIndex` — its place in its row, 1 at the left end as seen from the front, D66). Per group also read-only `interiorFittings`: the installed fittings with `instanceId`, `rootId`, `parentModuleId`, `articleId`, `position` and their explicit `attributes` ([Interior Design tools](#interior-design-tools)). The roots are listed in the order they were added. No root positions, no geometry |
| `masterData` | Only when requested. Per library id: the root modules (`id`, `name`, `desc`, assigned attribute ids) — the article roots and the roots the library generates (worktop `mr_Countertop`, toe kick, finger grip, backsplash, …: the sub modules of the master data's `Root` group), so the worktop colour `mod_CountertopColor` is found — and the customer-facing or Bool attributes (`id`, `name`, `desc`, `type`, `group`, `selections` with value, name and desc; the desc of a colour value carries its code, e.g. `Cloudy blue (#506080)`, D53) — and `groupSettings`, the attributes the library's group orchestrator sets on a group (D36; planned, D48) |
| `articleDescriptions` | Only when requested. Per article `articleId` and its full `desc` (D63) |
| `obstacles` | `{ objects, groups }`. `objects`: every plan object that is not an HI group — `kind` (`door`, `window`, `object`), `outline` (floor points `[x, 0, z]`) and `bottomMm`/`topMm`; a door or a window also `roomIndex`, `wall` (its index in the walls array) and `fromEndMm`, its span along that wall measured from the wall's end (C21). `groups`: per HI group its `id` and per root module that is not generated its `id`, `outline` (four floor points in room space) and `bottomMm`/`topMm`, from the parts of the calculated group (D45). No walls, no supplies — electric plugs and water connections are installation elements (D86) |
| `installationElements` | The electric plugs and the water connections of the plan: per element its `type` (`ElectricPlug` or `WaterConnection`) and its `position` `[x, level, z]` in the coordinates of the walls — a position only, no size. They are no obstacles: a group may stand on a supply (D86) |

Default sections: `rooms`, `articles`, `attributes`, `groups`, `obstacles`, `installationElements`. Requested without `rooms`, `obstacles` makes the server fetch
the rooms too, for the walls of the doors and windows, and return only `obstacles`; `attributes`
makes it fetch `masterData` too and return the vocabulary derived from it, `masterData` requested
beside it as it is.

Root outlines bound the calculated parts and can extend past their docking edges over a neighbour
in the same group. That overlap alone is not a placement error. Both the authoring rules and the
`get-plan-context` description explain this; article-specific overhangs belong in the library's
descriptions.

The answer explains a door or window relevant to the placement, using its span and height together
with the final group geometry and tool feedback. Cabinets below a sill are described as below the
window only when their tops are below its `bottomMm`; cabinets beside it clear its horizontal
span. An overlap is described as an overlap. Missing dimensions or an absent overlap hint alone
do not establish clearance.

### 5.5 What the agent is not given

| Withheld | Why |
|---|---|
| `imageUrl` everywhere | The agent cannot open them, and they cost three quarters of the tokens (D7) |
| Root positions and geometry in `groups` | Root positions come from the docking (D15); the read-only root outlines of `obstacles` are the exception (D45) |
| Articles' `cornerPoint`, `repositioningData`, the anchor frame | Internal to the placement (D10) |
| Parts and log messages of the groups | Not needed, and large (D9) |

### 5.6 Planning skills (`get-skill`)

The planning skills tell the agent how to plan a room of one kind, or from an image the user sends,
well — the zones, the sequence, the dimensions with their qualification, the checks, what the answer
delivers (D75). Each is a
directory of `hi-mcp/hi-mcp-server/skills/` in the Agent Skills format: `SKILL.md` with `name` and
`description` in its frontmatter, and the supporting files its body names by relative path.

| Skill | For | Supporting files |
|---|---|---|
| `image-planning` | furniture from an image or photo, with or without text: identify the pieces, read the layout, the counts and the sizes, map them onto the room and the catalog; the image is the brief, a room skill supplies its checks | none |
| `kitchen-planning` | a residential kitchen, Germany/EU by default; a kitchen without a named place is planned with its sink near a water connection (D87) | `references/planning-reference.md` (dimensions with their status, the installation and usability checklist), `references/source-catalog.md` (the sources, for a citation question only) |
| `kitchen-planning-fr` | a residential kitchen in France; the same rule for the sink (D87) | the same two, for France |
| `living-room-planning` | a living room: seating, TV and media, storage, routes | the same two, for a living room |

- **The index.** The description of `get-skill` lists every skill as `- <name>: <description>`,
  generated from the frontmatter when the server starts, and asks the agent to fetch the skill of a
  kind of room, or of an image, before planning it and the files the skill names. `INSTRUCTIONS`
  step 2 says the same.
- **Named by the chats.** The system prompt the chats get from the planner names every skill (D80);
  a skill of a new name needs the same name in roomle-ui `hi-agent-prompts.ts`.
- **The preamble.** A `SKILL.md` result starts with `SKILL_IN_SESSION` (`hi-mcp-server.ts`): in
  this session the survey is the plan context — the walls, the doors and windows, the obstacles, the
  installation elements with the positions of the electric plugs and the water connections — and the
  products are the catalog; what the plan context does not carry — services beyond those connection
  positions, budget, inventory, the household — is unknown, so the agent plans a concept with stated
  assumptions and names them instead of asking first, unless the user asks to be interviewed; the
  layout is the groups it creates, one group per piece of furniture, checked against the returned
  positions and the obstacles; alternatives and open checks are named in the answer, not built. A
  supporting file comes without it.
- **The frontmatter** is read as the YAML of Agent Skills: per field a plain, quoted, multi-line or
  block scalar (`|`, `>`, with the chomping `-` and `+`), comments, and fields with nested values
  such as `metadata`, which the server does not use. `skills/list` carries every field with the
  value a YAML parser reads from the served `SKILL.md` — a block scalar with its final line break, a
  nested field as an object of its fields —, so a host's frontmatter check finds them equal; the
  index of `get-skill` takes the description without its final line break. Guarded by
  `it('keeps the chomping of a block scalar and a value on the line after its field, as YAML reads them')`
  in `hi-mcp/hi-mcp-server/tests/skills.test.ts`.
- **The files.** The server reads only a file of the skill's list — the files below its directory,
  hidden files left out —, with LF line endings. A path may start with `./`, as the skills link
  their references. A skill whose `name` differs from its directory,
  without frontmatter or description, or without `SKILL.md`, stops the server at start.
- **The Skills extension.** A host that loads skills itself by the official MCP extension
  `io.modelcontextprotocol/skills` (SEP-2640) gets the same files. The `initialize` capabilities
  declare `resources` and the extension, with an empty configuration. `skills/list` answers every
  skill with the URI of its `SKILL.md` (`skill://<name>/SKILL.md`), its frontmatter and its
  manifest: per file, `SKILL.md` first, its URI `skill://<name>/<path>`, the SHA-256 digest and the
  byte size of the text served, computed when the server starts. `skills/get` answers one skill by
  the URI of its `SKILL.md` (G67). Every file is a resource (`resources/list`, `resources/read`)
  named `<name>/<path>`, with `text/markdown` and the text `get-skill` serves, without the preamble:
  the files go out as their authors deliver them. The results follow protocol `2025-11-25` and
  carry no `resultType`, `ttlMs` or `cacheScope`; there is no `directoryRead`. The server logs
  `[hi-mcp] skills/list`, `[hi-mcp] skills/get <uri>` and `[hi-mcp] resources/read <uri>`. None of
  the clients in use loads skills this way; they use `get-skill`.

## 6. Tools

| Tool | Changes the plan | Result |
|---|---|---|
| `get-plan-context` | no | the plan context (§5.4) |
| `find-attributes` | no | `{ matches, total, hint? }` |
| `get-authoring-rules` | no | the rules as text |
| `get-skill` | no | a skill file as text (§5.6) |
| `create-or-replace-groups` | yes | `{ loaded, groups, otherGroupIds?, groupAttributes?, hint? }` |
| `place-group` | yes | `{ placedIn, wall, group }` |
| `change-module-attribute`, `change-group-attribute` | yes | `{ command, groupIds, changedModuleIds?, corrections? }` (D62) |
| `delete-group`, `delete-article-in-place`, `delete-article-and-compact`, `merge-article-into-group`, `insert-article-into-group`, `exchange-root-module`, `swap-root-modules`, `merge-groups` | yes | `{ command, groups, removedGroupIds, changedModuleIds?, gapClosed?, corrections?, hint? }` |
| `undo`, `redo` | yes | `{ undone \| redone, groups, removedGroupIds?, otherGroupIds?, hint? }` |
| `open-or-close-group`, `open-or-close-article` | no — the view only (D88) | `{ command, groups: [], removedGroupIds: [], changed: false, corrections? }` |
| `get-price` | no | the planner's price result |
| `get-order-data` | no | the order data, or `null` |
| `get-plan-images` | no | a text naming the images, the group view and the top view |

### get-plan-context

| Parameter | Type | Default |
|---|---|---|
| `include` | `('rooms' \| 'articles' \| 'attributes' \| 'groups' \| 'obstacles' \| 'installationElements' \| 'masterData' \| 'articleDescriptions')[]` | rooms, articles, attributes, groups, obstacles, installationElements |

The server passes the planner's plan context through. In the articles it removes `cornerPoint`
(D10) and shortens a sectioned description (D63); `articleDescriptions` carries the full ones, read
from the planner's articles; `attributes` is the vocabulary derived from the planner's `masterData`
(D76). Every door and window of the obstacles gets its wall (C21). The planner
reports the groups in the placement frame with the `rowIndex` of every root (C14, D66), and the
docking vectors and `cornerArticle` of every article, of an article that is not in the plan from its
template (D74); a caller that names `articleIds` (`getExternalObjectPlanContext(include, { articleIds })`)
gets the templates of those articles only, and `get-plan-context` names none.

The tool description reminds the agent to hinge doors at new row ends at the outer sides after
an edit: left at the left end, right at the right end, as seen from the front. The library's
descriptions supply the attribute and value for single or paired doors; other door directions
stay unchanged (D84). Both chats send this description in their tool list, including when the
agent does not fetch the authoring rules. Guarded by `it('tells the agent to hinge new row ends
through the tool list without fetching authoring rules')` in
`hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts`.

### find-attributes

| Parameter | Type | Default |
|---|---|---|
| `text` | non-empty string | — |
| `libraryId` | string | all libraries |

The tool answers a question about one attribute (D76). The server searches the compacted master
data — the vocabulary the `attributes` section of `get-plan-context` lists — case-insensitively:
attribute id, name, desc, group, and per selection its name, desc and value. Every word of the text has to be in one of these fields,
and colour/color, grey/gray and worktop/countertop read alike (D64). A match is the attribute with
its `libraryId` and the `rootModules` that carry it, each `{ id, name }`; a value list an earlier match already lists is
replaced by `sameSelectionsAs`, the id of that attribute. The attributes the root modules of the plan's
groups carry — among their input attributes — come first, the others after them in the order of the
master data (D64). It returns at most 20 matches, the
`total`, and a `hint` to narrow the text when there are more. The desc of a colour value carries its code, and the description tells
the agent to choose a dark, a light or a blue value by it (D53).

The vocabulary retains attributes assigned to article roots or generated roots when they are main,
Simple, or Bool. Bool attributes include generation switches and other toggles; their descriptions
explain their purpose. Attributes assigned only to ordinary submodules and unassigned attributes
are excluded. The catalog's `mainAttributes` still contains only main attributes. Guarded by
`it.each(['Advanced', 'Master'])('keeps root-assigned %s Bools and their carrier assignments')` and
`it('keeps unassigned and submodule-only Bools out of the vocabulary')` in roomle-ui
`__tests__/hi-plan-context-test.ts`, and by `it('exposes a Bool generation switch without selections in
the vocabulary and attribute search')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts`.

### get-authoring-rules

No parameters. Answered by the server without a planner call, so it works without a connected page.

### get-skill

`{ name, file? }` — `name` a skill of the index, `file` a path inside the skill
(`references/planning-reference.md`), `SKILL.md` by default. Answered by the server without a planner
call, so it works without a connected page; logged like every tool (`[hi-mcp] tool get-skill`). The
index, the preamble and the skills: §5.6. An unknown name or file is an error result (§8.9).

### create-or-replace-groups

| Parameter | Type |
|---|---|
| `posGroups` | non-empty array of pos groups (§5.2) |

A group whose id is in the plan is **replaced** and keeps its position (the planner keeps root ids
that already exist); a root module the replace adds inherits from the root module it is docked to
(D56). Every other group is **created** with regenerated ids, and the docking references are
remapped.

The tool command runs these steps (roomle-ui `hi-tool-commands.ts`):

1. It drops generated roots (C1) and prepares each group: it drops docking it cannot read (G29),
   takes units written inside the docking as roots (G23), completes the docking entries (G24, G25), reports the fields it does not use
   (G27), reads the attribute overrides (G28), and corrects positions, root ids, repositioning data
   and the placement (G1–G14).
2. It reduces the roots to article picks and strips the docking indices (C2, C3).
3. It reads the article ids in the catalog's spelling (G15), checks docking written as `contextData`
   against the vectors of the catalog (G62) and against a floor unit on a base unit (G63), compiles
   the relations into docking entries (D34, C15, C16, G31–G45, G64), reports the roots a new group
   names in its docking but never sends (G26), completes the docking (G8, G61, G7), drops a
   placement on a group that is already in the plan (G16), and resolves the wall of a placement by
   wall (G55, G20).
4. For every group placed by point, it takes the frame of the anchor — its docking corner and, for a corner
   article, its turn — from the anchor's article template, calculated outside the plan once per
   library, article and attribute set (C6, G17).
5. It turns the placement by point into the planner's repositioning of the anchor root (C5, C6). The group
   reaches the planner with `id`, `libraryId`, `roots`, `attributes` and the repositioning.
6. It loads the groups that can be built in one call with `reason: 'adjusted'` and reads the
   planner's answer per group (D73): a group the planner left out, and a replace it restored because
   the library could not calculate the new layout, go to `notLoaded`; every other group is paired
   with the group of the plan it became. It reads the groups and adds a hint for a group of the call
   that has no position. For a replace it reads the calculated groups before the load (D55).
7. It moves the groups placed by wall to their walls (D23): it computes each target from the
   calculated group as `place-group` does — an overlap with another group, or with a group of the
   call already at its target, moves it along the wall (G22) —, and reloads them in one call
   (G58, G59).
8. It sets the group-wide attributes (D36) — the group attributes that are not among the library's
   group settings (`groupSettings` of the master data; without them, the attributes the loaded
   group lists), the overrides moved off the roots (G47) and the colours of the generated roots it
   dropped (G48) — on every unit of the group with one planner command, `change-attributes`
   (G46), the programs first and a root module's own value after the group's, after a create and
   after a replace, and reads the groups again.
9. It reads the final calculated groups and reports roots with `Error` or `Fatal` calculation logs in
   `notLoaded`, matched to the original input index by the planner's answer (D73). Each root gets its first
   diagnostic line and an action to check the group's attributes and the root's overrides against
   the library data, then change the failing values or replace the article. Loaded groups
   and their other roots stay in the result; warnings and errors of unrelated groups are ignored.
   Group-attribute recovery is guarded by
   `names group attributes in the recovery advice for a root calculation %s after applying them`
   in roomle-ui `__tests__/hi-tool-commands/create-or-replace-groups-placement-test.ts`.
10. It uses the same calculated groups to test the root modules of the groups of the call against the
    obstacles and the other groups and adds the `hint` of D55.

A group that cannot be built at one of these steps leaves the call and goes to `notLoaded`; the
others go on.

**Result**: `loaded` (the ids of the groups the planner built or restored), `groups` (the groups of the call, in the
plan-context shape), `otherGroupIds` (the other groups of the plan, unchanged — D68), `groupAttributes` (per group of the call `{ index, id, set, notCarried?, rootValues? }`: the group attributes set on every unit, those no unit of the group carries — D65 —, and the root modules that keep their own value of one, `{ id, value, rootModuleIds }` — D36), `hint` (an unpositioned group, a root module on an obstacle — D55), `corrections` (what the server changed in the input, and what the library changed with the group attributes — D59), and `notLoaded`
— `[{ index, id?, rootIds?, errors }]` for the groups it could not build (D30) or the planner left
out, for a replace the planner restored with `rootIds` the root modules the library could not
calculate (D73), and, with `rootIds`, for the roots of a loaded group it could not build (G15) or
fully calculate. A calculation diagnostic
does not remove the root or group from the planner. A conflicting placement is not sent (D26).

`notCarried` describes attributes without a current target, not unsupported content. For a requested
part the library generates, the description asks the agent to find an enabling attribute, enable it
when available, then apply the part's attributes after generation and report only what remains
missing. Attribute targets are resolved before recalculation: materials sent beside a group-level
switch can be skipped even when that call generates the part. A settled follow-up
`change-group-attribute` applies them to the generated part; a root the library then cannot
calculate is named in `corrections` (C25). A switch in root attributes reaches
the initial calculation, so group materials can apply in the same create call.

### place-group

| Parameter | Type | Default |
|---|---|---|
| `groupId` | id or unique prefix | — |
| `wall` | `left` \| `right` \| `top` \| `bottom` \| `back` \| `front` \| wall index | — |
| `alignment` | `start` \| `center` \| `end` \| side label of an adjoining wall | `center` |
| `offsetMm` | number, along the wall | 0 |
| `roomIndex` | integer | 0 |

The server finds the group (G18) and the wall (G19, G20): a side label means the face of that side
(D81) — the longest run of wall pieces, doors and floor-to-ceiling windows in a straight line — and
the group goes on its longest piece of wall where it fits, else across the face; a wall index means
that one segment. It reads the calculated group (G21) and computes the position:

- **into the corner** — when the alignment names an adjoining wall and the group has a corner
  article: its corner point goes into the corner the two walls share, and its back edges run along
  them
- **against the wall** — otherwise, by its footprint

The group keeps its height. The server checks the target against the other groups (G22) and reloads
the group once, with its roots — the generated ones included —, its group attributes and its docking
(C1), a unit above docked to the unit below it again (C24). A group that
already stands where asked is not reloaded. The same logic places a new group by wall in
`create-or-replace-groups` (D23).

**Result**: `placedIn` (`corner` or `wall`), the `wall` (a face without its pieces), the resulting `group`, `corrections`
when the server corrected the request — an overlap moves the group along the wall (D27), an
alignment parallel to the wall centres it —, and a `hint` when a root module stands on an object or
in front of a door or a window after the reload (D55).

### The command tools

Each command tool is a tool command of roomle-ui (`hi-tool-commands.ts`): it resolves the ids,
corrects what it can and runs one group operation of the planner (`runGroupOperation`) — the
attribute tools one per group or per root module —, which edits the group with the planner's own
features and answers once the result is loaded. The group keeps its position.

| Tool | Parameters | Tool command before the operation | Planner |
|---|---|---|---|
| `change-module-attribute` | `rootModuleIds` (or one `rootModuleId`), `moduleId?`, `attributeId`, `value` | resolves every root id (C17); sends one `change-attributes` per group of the root modules, with `moduleId` one `change-module-attribute` per root module (D62) | sets the attribute on the root modules and on their sub modules that carry it, or with `moduleId` on that one sub module (D54, P1, P2); a root module it could not change, and the attributes the library changed with it, are named in `corrections` (C22) |
| `change-group-attribute` | `groupId`, `attributeId` and `value`, or `attributes [{ attributeId, value }]` | resolves the group id (G18, C23); one attribute: the planner command `change-group-attribute`, several: one `change-attributes`, the programs first (D67) | sets them on every module that has them (D20, P3); an attribute of the list no module has is named in `corrections`; the attributes the library changed with them are named in `corrections` (C22) |
| `delete-group` | `groupId` | resolves the group id | deletes the group |
| `delete-article-in-place` | `rootModuleId` | resolves the root id (C17) | deletes the root module and leaves the gap: root modules no longer docked together become separate groups where they stand (P4, D40) |
| `delete-article-and-compact` | `rootModuleId`, `groupId` optional | resolves the group id and the root id (C17); without `groupId`, the group that holds the root module (G54) | deletes the root module and closes the gap; a root module with a neighbour on one side only is deleted and nothing else moves; a corner article between two legs is deleted and the gap closed by turning one leg by 90° with the units above it, the correction names the leg with root ids and article labels, and the hint names its original and destination wall when known (D52); the units above in other groups move with the root modules below them, each within its group, and their groups are returned beside the edited one (D42); the only root module is deleted with its group, reported with `gapClosed: false` (D40, P4) |
| `merge-article-into-group` | `groupId`, `articleId`, `attributes?`, `dockTo { rootId, ownDockingVector, dockingVector, mode?, offset? }` | resolves the group id and `dockTo.rootId` (C17), reads the article id in the catalog's spelling (G15), moves an occupied side to the free end of the row (D29), derives a missing partner vector (P7) and the hang gap of a wall unit on a floor unit (D35) | docks the article as a new root module, which inherits from `dockTo.rootId` (D56); the earlier root modules keep their place and the row grows at its free end, a root module docked on the side at a wall moves the group away from the wall, and the units above it in other groups move with it (D41, D42, D82) (P5–P8) |
| `insert-article-into-group` | `groupId`, `articleId`, `attributes?`, `between [rootId, rootId]` | resolves the group id and the root ids (C17), reads the article id in the catalog's spelling (G15), inserts beside the first-named root when the two are no neighbours (C19, G52) | docks the new root module between the two, whatever the group and the article (D44); it inherits from the first root of `between` (D56); the root modules at a wall stay (D41, P14, P16), and the units above the moved root modules move with them, also in other groups (D42) |
| `exchange-root-module` | `groupId`, `rootModuleId`, `articleId`, `attributes?` | resolves the group id and the root id (C17), checks the article (G15) | replaces the root module; the new one keeps its docking and inherits from the replaced one (D56); `attributes` override attributes of the new root module, e.g. another width, and the other root modules move by the difference, with the units above them, also in other groups (D42); a docking the new article cannot take is named in `corrections` (P9, C20) |
| `swap-root-modules` | `groupId`, `rootModuleIds [rootId, rootId]` | resolves the group id and the root ids (C17); one root twice is an error (G53) | the two root modules change places with their attributes and the wall units above them, also in other groups (D42, P15) |
| `merge-groups` | `targetGroupId`, `groupIds` | resolves every group id | merges where they stand: nothing is moved, no docking is added (P10) |

`value` is a string, a number (passed on as its string) or a boolean. **Result** of the two
attribute commands: `{ command, groupIds, changedModuleIds?, corrections? }` (D62). **Result** of
the others: `{ command, groups, removedGroupIds, changedModuleIds?, gapClosed? }` — the affected groups in the plan-context
shape, and for `delete-article-and-compact` whether the gap was closed — plus `corrections` when the server corrected the input before the operation, followed by the planner's corrections, each named by its tool (C20), and after an attribute command the attributes the library changed besides the one set (C22).

Attribute commands wait for their load's kernel planning-situation callbacks and calculated follow-up
loads. An unrelated user move does not complete the command. Their planner result and the server's
library-change feedback therefore read attributes derived from the actual placement, including an
insertion height the library adjusts. The [command implementation](../.agents/context/tool-executors.md#the-command-tools)
describes callback ownership, operation-slot lifetime and the guarding planner tests.

Both attribute commands read the settled raw groups they changed and append calculation
diagnostics to `corrections` (C25). Each root's first Error/Fatal message contributes its first
line; roots with the same diagnostic are grouped within their group. The message names the
group, root ids and articles and asks the agent to check group attributes and retained root
overrides against the library data, then change the failing values or replace the article.
Applied changes and other roots remain. Warnings and errors of unrelated groups are omitted.
When valid input recovers missing docking geometry, the arrangement keeps the requested mode
if the original vectors are unavailable, and keeps the group transform while either group's
whole docking footprint is unknown.

### undo, redo

No parameters. `undo` reverts the plan change of the last tool call that changed the plan; `redo`
brings back the call the last `undo` reverted (D38). The description of `undo` says when to use it — a result that is not
what was asked, then the corrected call — because a client that does not pass the server's
instructions on, like the HI chat (§4), shows the model only the tool list. The description of
`redo` opens with its case — the user asks to redo or to bring back what was undone ("redo it",
"bring it back") — and the one of `undo` sends that case to `redo`: its "call it again to revert
the call before" alone reads as the way back to a model.

1. No record → the tool name is `null` and a `hint` says why: nothing to undo or redo, or the plan
   was changed in the planner after the last tool call.
2. The plan must be as the call left it — the groups of the plan context compared to the tenth of a
   millimetre —,
   else the records are forgotten and the result is the planner hint.
3. One planner `undo()` or `redo()` per step of the call, each confirmed by its history event
   within 1 s; a missing event — the planner's history was cleared, e.g. by a plan load — forgets
   the records and says so.
4. The plan must now be the plan before (for `undo`) or after (for `redo`) the call. If it is not
   — the user changed the plan in the planner while the call ran, so that change sits among the
   call's steps —, the same number of steps is taken back in the other direction, the records are
   forgotten, and the `hint` says so. A wrong revert is never left in place.
5. The call moves to the other list. The result names the tool and returns the groups the call
   changed — by the plan before and after it — as they are now, in the plan-context shape,
   `removedGroupIds` for the groups the revert took out of the plan, and `otherGroupIds` for the
   others (D68). A result that reverted nothing returns every group of the plan.

A new recorded tool call ends redo, as in the planner. The records live in the server process and
start over when a page is accepted. Not covered: the planner's configurator mode, where `undo()`
acts on the configurator's history — the tool then sees no history event and answers that the
history no longer holds the call, though a configurator step may have been undone.

### open-or-close-group, open-or-close-article

- **`open-or-close-group`** opens (`open: true`) or closes every door and drawer of a group,
  **`open-or-close-article`** those of one root module, without the root modules docked to it.
- They switch at once and change the view only: not saved, no undo step, no change of the price or
  the order (D88). A group or root module without doors or drawers is named in `corrections`; an
  unknown id rejects (P11).
- The served text tells the agent to open a cabinet right before `get-plan-images` when it wants
  to look inside — in rule 4 of the instructions (§5.1) and in the descriptions of
  `get-plan-images` and `get-interior-design-options`.

### get-price, get-order-data, get-plan-images

- **`get-price`** returns the planner's price calculation (`fetchPrice`).
- **`get-order-data`** returns the order data of the current plan without placing an order, or
  `null`.
- **`get-plan-images`** renders the groups alone, seen from their front without the room (the
  planner's object perspective), and the top view of the whole plan, with the doors and drawers as
  they are in the planner (`keepOpenGeometry`, D88). A text before the images names them; without
  groups the top view comes alone (D97). It waits for a plan change or an opening that runs
  (`oneAtATime`, D4), so the images show its result. The top view matches the wall side labels. Without
  images, the result is `{ "error": "No images available" }`.

Mounting settings and article selection come from the existing library descriptions and attributes; categories organize the catalog. The authoring rules and the descriptions of `get-plan-context` and `create-or-replace-groups` explain `above`, explicit clearance and continuing an upper row with finishing parts (D85). Short descriptions retain FUNCTION and AI_SELECTION_HINT; full requirements remain available through `articleDescriptions`. Unknown categories keep explicit upper relations and gaps, including stacking requests.

## 7. Positioning

- **A new group** gets a placement in one of two forms (D16, D23):
  - **At a wall or in a room corner**: `placement { wall, alignment?, offsetMm?, roomIndex? }`, the
    parameters and defaults of `place-group`. The server loads the group, computes the target from
    the calculated group and reloads it there. `end` with `offsetMm` measures from the wall's end,
    as the `fromEndMm` of the obstacles does.
  - **Anywhere else**, and for a group of wall units only: `placement { posGroup, posRotationY,
    rootId? }`. `posGroup` is the room point of the group's back left bottom corner (`y` = 0 on the
    floor; for wall units only, their mounting height), `posRotationY` is in degrees,
    counter-clockwise from above (D13). Against a wall, `posRotationY` is the wall's
    `facingRotationY`, and the group runs from `posGroup` towards the wall's `start`.
- **In a room corner**, a corner kitchen starts with a corner article. The wall form names one wall
  of the corner as `wall` and the other as `alignment`; the point form takes the `point` and the
  `posRotationY` of the corner in the room's `corners` list (§5.4) — the `facingRotationY` of the
  wall that ends in the corner. Looking into the corner from the room, the `RightBottom` row runs
  along the wall on the right. For a rectangular room (back = top):

  | Corner | `posRotationY` | `RightBottom` row runs along | `LeftBottom` row runs along |
  |---|---|---|---|
  | left back | 0 | back wall, to the right | left wall, to the front |
  | left front | 90 | left wall, to the back | front wall, to the right |
  | right front | 180 | front wall, to the left | right wall, to the back |
  | right back | 270 | right wall, to the front | back wall, to the left |

  The table holds for both hands of corner article: the server turns a right-handed one by 90° more
  itself, and the group is read back with the rotation it was placed with (D33) — guarded by
  `it('turns the right-handed corner article by 90 degrees more at %d degrees')` in roomle-ui
  `__tests__/hi-group-placement-test.ts`; `place-group` puts a corner article into each corner with
  the rotation of the table — guarded by
  `it('puts the corner point into the %s corner with the rotation of the corner rules')` in
  roomle-ui `__tests__/hi-plan-space-test.ts`.
- **The anchor** of a placement by point: the root whose back left corner goes to `posGroup`. The server finds it (C5) and
  places it by its docking corner, wherever its origin is (C6, D33), before the one load that
  creates the group (D46) — guarded by
  `it('puts the docking corner of every offset article on posGroup at %d degrees')` in roomle-ui
  `__tests__/hi-group-placement-test.ts` and
  `it('places a range hood by its left edge, not by its centre')` in roomle-ui
  `__tests__/hi-tool-commands/create-or-replace-groups-placement-test.ts`.
- **Moving** an existing group: `place-group`, by wall, alignment and offset (D21).
- **Outside the room** is allowed (D22).
- **A conflicting placement** — on a group that is already in the plan, or one the server cannot
  use — creates no `repositioningData`, and the planner positions the group; an existing group
  keeps its position (D26).
- **Overlaps**: in `place-group` and in a placement by wall, a target that overlaps another group —
  a root module of the one overlaps a root module of the other — is moved along the wall
  (D27). Groups may touch. A root module on an object, in another group or in front of a door or a
  window is built as sent, and the `hint` names it with the free stretches of its wall and, for a
  group placed at a wall in front of a door or a window of the adjoining wall, the `offsetMm` that keeps it clear (D55).

## 8. Guards, corrections and feedback

### 8.1 How feedback reaches the agent

| Channel | When | Content |
|---|---|---|
| `corrections` | the server changed the input, or the library changed an attribute beyond the one set (D59) | One sentence per correction: the group (input index and id) or the command, what was sent, and what the server did. In `create-or-replace-groups`, `place-group` and the command tools that take a root id or an article — `change-module-attribute`, `delete-article-in-place`, `delete-article-and-compact`, `merge-article-into-group`, `insert-article-into-group`, `exchange-root-module`, `swap-root-modules` —, there followed by the planner's corrections (C20); after `change-module-attribute`, `change-group-attribute` and the group attributes of a create or a replace, last the attributes the library changed (C22, G46). The group attributes a create set are not corrections: they are in `groupAttributes` (D65) |
| `notLoaded` | a group of `create-or-replace-groups` cannot be built, or a group loads without some of its roots | `[{ index, id?, rootIds?, errors }]`, each error naming what to send instead; the other groups and roots load |
| `hint` | something to check; nothing stopped | an unpositioned group (`create-or-replace-groups`), a root module on an obstacle (`create-or-replace-groups`, `place-group`, D55), what a row edit did to the row — past a wall, into another group, in front of a door or a window (D42, D43) —, more than 20 matches (`find-attributes`), why `undo` or `redo` reverted nothing, groups that differ after an `undo` or `redo` (§8.8) |
| Error result | nothing in the call can be done | `create-or-replace-groups`: no group can be built, or the planner loaded none; the other tools: a guard of §8.4–8.6, or the planner's message |

A correction that the rules describe as normal is silent (§8.2). A correction of a mistake is
always reported, and nothing the agent sends is dropped without a report (D32).

For every call of a tool that changes the plan, the server logs what the agent sent — copied before
it corrects anything — and the feedback, one JSON line each (`[hi-mcp] tool <name> args|feedback|error
…`). Every such call ends with exactly one feedback or error line, an empty `feedback {}` included.
The calls run in the order they were made (D4), so a test run pairs the lines in that order and stores
them per turn as `toolCalls` in `run.json`, also when the agent calls a tool twice at once.

### 8.2 Silent corrections

| ID | Correction | Where |
|---|---|---|
| C1 | Roots marked `isGenerated` (worktop, toe kick) are dropped from a `create-or-replace-groups` payload; the library regenerates them, and their input attributes are set again after the load (G48). The reload of `place-group` and of a placement by wall keeps them, so they keep their attributes — the worktop colour — over the move, and it sends the group's own attributes, which the planner keeps as sent on a reload — without them the reload drops the library's group settings (`mod_GroupGenerationLogic` and the others). Guarded by `it('reloads the group with its group attributes, which the planner keeps as sent')` in roomle-ui `__tests__/hi-tool-commands/place-group-test.ts` | `prepareGroup`, roomle-ui `hi-tool-payload.ts`; `repositionedGroup`, `hi-wall-placement.ts` |
| C2 | The read-only fields of a group from `get-plan-context` are ignored: per root `rowIndex`, `articleName`, `desc`, `category`, `imageUrl`, `isGenerated`, `dockingVectors`, `freeDockingVectors`, `subModules`, `logMessages`; per group `position`, `logMessages`, `interiorFittings`. Every other field the server does not use is reported (G27). The group `attributes` reach the planner | `prepareGroup`; the field strip of `create-or-replace-groups` |
| C3 | Docking vector indices are stripped and resolved from the names | `stripDockingIndices` |
| C4 | A unique prefix of a group id is accepted | `findGroup` |
| C5 | The anchor is found by walking from the start root down to the floor unit carrying it, then left along its row, stopping at a corner article. A wall unit named as anchor leads to the base unit below it. Only the Bottom side pairs make row neighbours in this walk: counted as neighbours, the Top pairs of a wall unit hanging beside a tall unit would make that wall unit the anchor — C15 starts a relation group on the floor instead | `findAnchorRoot`, `dockingRelations`, roomle-ui `hi-group-placement.ts` |
| C6 | The anchor is placed by its docking corner — the origin of a cabinet, the left edge of a range hood, the corner point of a corner article — and a right-handed corner article is turned by 90°. The frame comes from the docking vectors of the anchor's article template, calculated with the anchor's attribute overrides outside the plan: nothing is loaded, and the planner's undo history gets no step. The template is calculated once per library, article and attributes, until the library's article templates are loaded again; a template without docking vectors gives the identity. The frame reaches the planner as `rootRelPos` and `rootRelRotationY`. Guarded by `it("has the planner calculate the corner article's template once and loads the group with its frame")` and `it("calculates the anchor's template with its attributes and keeps one frame per attribute set")` in roomle-ui `__tests__/hi-tool-commands/create-or-replace-groups-placement-test.ts` and `describe('calculateArticleTemplate')` in roomle-ui `__tests__/article-template-test.ts` | `anchorFrameOfRoot`, `toRepositioningData`, roomle-ui `hi-group-placement.ts`; the anchor frames of `create-or-replace-groups`, `hi-tool-commands.ts`; `calculateArticleTemplate`, `glue-logic.ts` |
| C8 | In a resubmitted group, a docking entry that names a root outside the group connects nothing and is kept, so a group whose unit was deleted still loads. In a new group it is reported (G26) | `dockingNeighbours`, `reportUnsentRoots` |
| C9 | `place-group` defaults: alignment `center`, offset 0, room 0; the group keeps its height | `place-group` |
| C10 | `back` and `front` name the `top` and the `bottom` wall (`place-group` `wall` and `alignment`) | `sideLabel` |
| C11 | A number as the value of `change-module-attribute` or `change-group-attribute` is passed on as its string — the planner's attribute commands take a string or a boolean. Attribute overrides of `create-or-replace-groups` and `merge-article-into-group` keep their numbers: the layout and the article pick take a number, a string or a boolean | `attributeValue` |
| C12 | An unknown `get-plan-context` section is ignored; none left means the default sections | `get-plan-context` |
| C13 | A docking entry with `rootId` instead of `id` is read by its `rootId` | `completeDockingEntries` |
| C14 | The position of a returned group is reported in the frame of a placement: `pos` the back left bottom corner, `rotationY` the rotation of the placement, the footprint from there, and with two corner articles `rootId`, the one `pos` belongs to (D33). roomle-ui reports the groups of the plan context and of every tool result in this frame. Guarded by `describe('positions in the placement frame')` in roomle-ui `__tests__/hi-tool-commands/placement-frame-test.ts` | `positionInPlacementFrame`, roomle-ui `hi-group-placement.ts`; `inPlacementFrame`, `hi-tool-commands.ts` |
| C15 | A group with relations whose list starts with a wall unit starts with its first floor unit, so the placement anchors on the floor | `relationsToDocking` |
| C18 | Every wall of the plan context gets its `name` (back wall, front wall, left wall, right wall), a wall entry without a type — a door opening — the type `opening`, and every room its `corners` (`name`, `point`, `posRotationY`; D83) | `agentFacingRooms`, `wallName`, `roomCorners`, `agent-facing.ts` |
| C21 | Every door and window of the obstacles gets `roomIndex`, `wall` and `fromEndMm`: the wall whose line its outline touches — within the wall's thickness — over the longest stretch, and its span along that wall measured from the wall's end, like the `d` of a placement | `agentFacingObstacles`, `wallOfOpening`, `agent-facing.ts` |
| C24 | Before the reload of `place-group` and of a placement by wall, a unit above another root module — a wall unit, a range hood, a unit on top — is docked to it again: the kernel's docking links only vectors that touch, so a unit hanging with a gap is docked to nothing below it in a calculated group, and the reload, which sends no positions, would put it on the floor. The unit below is found by position, as the planner finds it (roomle-ui `carriersOfUnitsAbove`): the unit's docking vectors begin at or above its top and their centre lies over it, the highest such root module carrying it. The entry docks the unit's `LeftBottom` to the carrier's `LeftTop` with the offset that keeps it where it stands, in the group's frame — also on a turned leg. Guarded by `it('docks a wall unit hanging above a floor unit to it again before the reload, so it keeps its place')` in roomle-ui `__tests__/hi-tool-commands/place-group-test.ts` | `withUnitsAboveDocked`, `repositionedGroup`, roomle-ui `hi-wall-placement.ts`; `dockingVectorBox`, `dockingVectorStart`, `hi-plan-space.ts` |
| C16 | A relation is written as a docking entry on the root the planner reaches first — breadth-first from the first root —, mirrored with the mode mirrored (`StartEnd` ↔ `EndStart`) and the offset negated when its target comes later; the planner applies an offset only in the direction of the entry | `relationsToDocking`, `mirrorDockMode` (roomle-ui `hi-root-module-arrangement.ts`) |
| C29 | A unit `behind` another stands flush with the end of it where the unit's own row starts: `EndStart` on the neighbour's entry when the side relations that name the unit continue its row to its right only, else `StartEnd` (D98) | `pairOf` in `relationsToDocking` |

### 8.3 `create-or-replace-groups`

G23–G25, G29 and G61–G63 concern docking written as `contextData`; a payload with relations (D34)
has its own corrections, G31–G45 and G64. The tests named here without a file are in roomle-ui
`__tests__/hi-tool-commands/` (`create-or-replace-groups-input-test.ts`,
`create-or-replace-groups-placement-test.ts`).

| ID | Input | What the server does | Feedback |
|---|---|---|---|
| G1 | a group without roots | does not build the group | `notLoaded`: "needs a non-empty roots array" |
| G2 | a group of generated roots only | does not build the group | `notLoaded`: "needs at least one article root" |
| G3 | `pos`/`rotationY` on a group | drops them | correction |
| G4 | a root without `articleId` | does not build the group | `notLoaded`: "articleId must be a non-empty string" |
| G4 | a root without `id` | gives it `root-1`, `root-2`, … | correction |
| G5 | `articlePos`/`rotationY` on roots | drops them; the docking positions the roots | correction |
| G6 | a duplicate root id no docking entry names | renames it (`u1` → `u1-2`) | correction |
| G6 | a duplicate root id a docking entry names | does not build the group — the entry is ambiguous | `notLoaded`: "duplicate root id '…' named in the docking" |
| G7 | roots the docking does not connect to the first root — an entry connects in both directions, as the planner mirrors every entry before it arranges from the first root (guarded by `it('accepts a root docked by an entry written on the new root')`) | adds a docking entry (`dockingVector`, `mode` `StartStart`, `offset` `[0, 0, 0]`) that docks the part to the free end of a row of its kind by a root of that kind — a part with a floor unit by a floor unit to the floor row, a part of wall units by a wall unit to the wall-unit row (recognized wall units and hoods, plus upper roots established by relations, docking or retained calculated placement); a wall unit of the part stays on its carrier. A part of wall units in a group with no wall unit placed yet hangs its first wall unit above the first placed floor unit with a free `LeftTop` that is not a tall unit, at the hang height of D35 (`LeftTop` → `LeftBottom`, offset `[0, gap, 0]`), and the next wall units continue its row (guarded by `it('hangs undocked wall units above a placed floor unit when the group has no wall unit yet')` and `it('docks a part with floor units by a floor unit, and its wall unit stays on its carrier')`) | correction naming the roots and the entry; for a hung wall unit: "… the wall unit 'w1' was docked above 'u1' (its LeftBottom on the LeftTop of 'u1'), 660 mm above it at the height of the wall units" — without a known height "… so it stands on it; above with gapMm hangs it" |
| G7 | a part that cannot be docked: no free end of its kind, wall units in a group whose floor units are tall units only or have no free `LeftTop`. An article the catalog lists without docking vectors counts as having them — unknown, not undockable; a range hood belongs to the upper row and can hang above a carrier | does not build the group | `notLoaded` naming the relation to send: `{ "id": "B", "articleId": "...", "rightOf": "A" }`, a wall unit `"above"` its floor unit |
| G8 | two roots on one side vector (`LeftBottom`, `RightBottom`) at the same place — the same mode and offset. Partners the mode or the offset separates (a shallow unit at the back and one at the front of a deep unit's side, a unit further along the row), several partners on `BackBottom`, and a unit on top of or hanging above another are no conflict (guarded by `it('accepts roots on one side vector that the mode or the offset separates')`) | docks the later one to the free end of that row; when the row ends at a corner article, to the free end of the leg in the other direction | correction |
| G8 | two wall units on one Top side vector (`LeftTop`, `RightTop`) of a tall unit at the same place — beside it with the tops flush, the same mode and offset. A wall unit on the Top vector and a base unit on the Bottom vector of the same side are no conflict | docks the later one to the free end of the row of wall units that starts with the other one (`RightBottom` for `RightTop`); when it follows that one already, drops its second docking | correction: "roots 'w1', 'w2' were docked to the RightTop of root 't1' at the same place - 'w2' was docked to the RightBottom of 'w1', the free end of the row of 'w1'" (guarded by `it("docks the second wall unit beside a tall unit to the free end of the first one's row")`) |
| G8 | the same, where the later root already follows in that row (a chain plus an extra entry on the first root) | drops the extra entry | correction |
| G9 | `repositioningData` | takes it as the placement, or drops it beside a placement | correction |
| G10 | a placement that is not an object | does not use it: no `repositioningData`, the planner positions the group | correction |
| G11 | placement fields of neither form | drops them | correction naming the fields of both forms |
| G12 | `posGroup` `[x, z]` | completes it to `[x, 0, z]` | correction |
| G12, G13 | another `posGroup`, or no numeric `posRotationY` | does not use the placement, as G10 | correction |
| G14 | a `rootId` that names no root | drops it; the server picks the anchor | correction |
| G55 | a placement by wall whose `wall` is neither a side label nor a wall index, or names a room or a wall the plan does not have | does not use it: the planner positions the group | correction: "the placement's wall … is neither a side label (left, right, back, front) nor a wall index - …" / the message of G19 followed by "- the placement was not used, so the planner positions the group" |
| G56 | a placement by wall with an `alignment`, `offsetMm` or `roomIndex` it cannot read | takes the default: `center`, 0, room 0 | correction |
| G57 | a placement with a wall and a point | uses the wall and drops `posGroup`, `posRotationY` and `rootId` | correction: "the placement names a wall and a point - the wall was used, … dropped" |
| G20, G22 | a placement by wall with an alignment parallel to the wall, or a target that overlaps another group — a group of the call placed by wall counts at its target, not where the planner first put it | as in `place-group` (§8.4) | correction |
| G58 | a new group placed by wall that the planner has not calculated | leaves it where the planner put it | correction: "group '…' has no calculated geometry - it was not placed at the … wall; place-group moves it once it is calculated" |
| G59 | a group placed by wall that still covers the floor it covered before the reload — the load answers what the planner calculated, not where the group stands, and the planner keeps the group origin elsewhere after a reload, so the server compares the floor | leaves it where the planner put it | correction: "group '…' was not moved to the … wall - the planner did not reload it there; place-group moves it" |
| G15 | an article id in another spelling (case, whitespace) | reads it in the catalog's spelling | correction |
| G15 | an article id the catalog does not have, beside roots it has | builds the group without that root; a relation or docking entry that named it names nothing, so its root gets the default (G31, G7) | `notLoaded` entry with `rootIds` and the valid article ids (the first 100): "… the root was not built, the other roots were; send it with merge-article-into-group or a valid article id" |
| G15 | every article id of the group unknown | does not build the group | `notLoaded` with the valid article ids |
| G16 | a placement on a group that is already in the plan | does not use it; the group keeps its position | correction |
| G17 | an anchor whose article template cannot be calculated | loads the group without the frame, placed by the unit's origin | correction: "root '…' ('…') could not be calculated before loading - the group was placed by the unit's origin and may stand off posGroup; place-group puts it against a wall or into a room corner" |
| G23 | a unit written inside a docking entry — with its `articleId`, attributes and own docking | takes it as a root of the group, also nested deeper; the entry keeps the docking link | correction |
| G24 | a docking entry without `dockingVector` | uses the partner of the root's own vector (`RightBottom` → `LeftBottom`, a Top vector → the Bottom vector of that side, `BackBottom` → `BackBottom`) | correction |
| G25 | a docking context without `ownDockingVector` | drops it; the roots it named are docked like any undocked root (G7) | correction |
| G26 | in a new group, a root named in the docking but never sent — no `articleId` | drops the entry; nothing can be built for it | correction: "roots '…' are named in the docking but were never sent - nothing was built for them; send each as a root { id, articleId }" |
| G27 | a group, root or docking entry field the server does not use and `get-plan-context` does not return | ignores it | correction naming the fields |
| G28 | attribute overrides as an object `{ id: value }`, or with `attributeId` instead of `id` | reads them as `[{ id, value }]` | correction; an entry without any id is ignored and reported |
| G29 | docking in a shape that cannot be read — `contextData` or a `dockedRoots` that is not a list, a docking context or entry that is not an object | drops that part; the root is docked like any undocked root (G7), and the group loads | correction: "… could not be read and were dropped - contextData is { dockedRoots: [{ ownDockingVector, dockedRoots: [{ id, dockingVector, mode?, offset? }] }] }" |
| G31 | in a group with relations, a root without a relation that nothing connects | puts it `rightOf` the previous unit of its resolved row in the list (floor or upper); the first wall unit beside a tall unit of the group, else `above` the floor unit at its list position | correction |
| G32 | a relation that names no other root of the group, or the root itself | ignores it; the root gets the default (G31) | correction |
| G33 | a relation that closes a ring of relations | drops it | correction |
| G34 | a positively recognized floor unit (base/tall category) `above` a unit | puts it `rightOf` that unit | correction |
| G35 | a wall unit `rightOf` / `leftOf` a base unit | hangs it `above` that unit (D35). A tall unit is one by category ("Tall Units") or by height (≥ 1500 mm, e.g. the modular carcase `H60M` under "Modular") | correction |
| G36 | `behind` a corner article, or a corner article `behind` a unit | ignores it; the default (G31) | correction |
| G37 | `gapMm` on `rightOf`, `leftOf` or `behind`, `gapMm` that is not a number, an `align` other than left, right or back, `align` or `gapMm` without a relation | ignores it (`align` left). The planner applies an offset in the group's frame, where `x` is not the direction of a turned leg, so only a vertical gap is derived; a gap in a row is a filler article | correction |
| G38 | two relation fields on one root | uses the first of `rightOf`, `leftOf`, `onTop`, `above`, `behind` | correction |
| G40 | a positively recognized floor unit (base/tall category) `rightOf` / `leftOf` a wall unit | puts it into the floor row — the default of G31 | correction |
| G41 | a range hood `rightOf` / `leftOf` a tall unit — its Top vector is its chimney top | hangs it `above` the floor unit on that side of the tall unit; without one it stays beside the tall unit by its top edge. A hood without a relation hangs `above` a base unit, never beside or on a tall unit | correction |
| G42 | a wall unit (or a range hood) `onTop` a kitchen base unit (category "Base Units") — nothing stands on a worktop | hangs it `above` that unit (D35); a `gapMm` meant as a stacking lift is dropped. `onTop` a tall unit or a wall unit stays a stacking | correction |
| G43 | a positively recognized floor unit (base/tall category) `onTop` a kitchen base unit | puts it `rightOf` that unit — it continues the floor row | correction |
| G44 | a second unit `above` a floor unit on the same edge (`align`) — both would take the same place | puts it `rightOf` the last unit already hanging above that floor unit, so three units form one row; a range hood keeps the place above the hob unit, the wall unit moves with its row | correction |
| G45 | `above` a tall unit — nothing hangs above a tall unit | hangs it `above` the floor unit beside the tall unit when the relations name one (either side); else beside the tall unit with the tops flush (`rightOf`, Top vectors) | correction |
| G39 | `above` a floor unit where the catalog gives no tall unit height | the wall unit stands on the floor unit | correction naming `gapMm` |
| G30 | any other input that fails the preparation of a group | does not build that group; the other groups of the call load (D30) | `notLoaded`: "posGroups[i]: could not be read - …" |
| G46 | the group attributes that are not among the library's group settings (D36), on a create and on a replace | sets them on every unit and generated root of the loaded group with one `change-attributes`, the program attributes first; a root module's own value of one of them follows as an entry with its `rootModuleIds`, after the root module's own program attributes — the planner's root ids, read from the root ids a replace keeps, else from the order of the roots, which the planner keeps, else from the article and the value the root module was loaded with | `groupAttributes`: `{ index, id, set, notCarried?, rootValues? }` — an attribute no unit of the group has (P3) in `notCarried` (D65), the root modules that keep their own value in `rootValues`; the planner's answer when it refuses the command — none of them can be set — as the correction "posGroups[i]: the group attributes … could not be set on group '…' - …"; an attribute the library changed with them, as the correction "posGroups[i]: with its group attributes the library changed mod_FrontColor of root modules '…' (OTB60), '…' (OTB60) from \"324\" (Dark marble (#404040)) to \"152\" (Cloudy blue (#506080))" (D59) |
| G47 | a root override of an attribute the unit's own module does not carry but a generated root module does — the master data's root modules no catalog article has (`mod_CountertopColor` on a base unit) | moves it off the root and sets it on the whole group (G46) | correction |
| G48 | the input attributes of the generated roots C1 drops from a resubmitted group (the worktop colour) | sets them on the group again after the load (G46) | correction |
| G49 | `dockTo { rootId, ownDockingVector, dockingVector }` on a root — the field of `merge-article-into-group` — or `dockTo { id, relation }` | reads it as the relation it describes — the `relation` named inside, else by the vectors: `RightBottom -> LeftBottom` = `rightOf`, the mirror = `leftOf`, a Top → Bottom pair = `above`, `BackBottom -> BackBottom` = `behind`; a pair it cannot read, or a root that names a relation already, drops it | correction |
| G50 | a group id the agent gave an earlier group of this session, which the planner renamed | reads it as that group — a replace; G16 drops the placement | correction: "group id 'kitchen1' names the group '…' created earlier - it was replaced" |
| G51 | a wall unit `rightOf` / `leftOf` a tall unit on a side without a floor unit, while the other side has one — it would hang over empty floor | moves it to the side of the floor units, with the wall units chained to it | correction: "wall units '…' go leftOf the tall unit '…', on the side of the base units" |
| G61 | docking written as `contextData` that closes a row into a ring — side entries only, e.g. a unit docked to both ends of a row. The planner arranges breadth-first from the first root and places a root by the first entry that reaches it, so one entry of the ring is never used; a cycle that is not a row (wall units docked to each other and to their floor units) stays | drops the entry the planner never uses, after G8, so that the server anchors the group as the planner places it | correction: "the docking of 'cab4' on the RightBottom of 'cab3' closes the row into a ring - dropped; the planner places 'cab4' by its other docking, and a row has two ends" (guarded by `it('drops the entry that closes a row into a ring, so the group is anchored as the planner places it')`) |
| G62 | docking written as `contextData` to a vector the article does not have, where the catalog knows the article's docking vectors (an article in the plan) | a partner vector the article does not have becomes the partner of the root's own vector when the article has that one (as G24); an own vector the article does not have, or a partner vector without such a partner — `BackBottom` on a corner article, which has no back —, drops the entry, and the root is docked like an undocked root (G7) | correction: "docking vectors the article does not have were replaced - …" / "docking to a vector the article does not have was dropped - 'sink' on the BackBottom of 'c1' - 'corner-1' has no BackBottom; the root is docked like an undocked root" |
| G63 | docking written as `contextData` that puts a positively recognized floor unit on a Top vector of a base unit (category "Base Units") — nothing stands on a worktop; as G43 for the relations | drops the entry; the floor unit continues the floor row (G7). A unit on a tall unit or a wall unit stays a stacking, a wall unit or a range hood above a base unit stays, an article without affirmative floor-category evidence stays as sent | correction: "floor unit 'sink' was docked on the LeftTop of the base unit 'b1' - nothing stands on a base unit, so the docking was dropped and the unit continues the floor row" |
| G64 | a unit `above` a floor unit whose place a row of wall units takes already — a row from another floor unit, or from beside a tall unit, grew into it; also the place G44 moves a second unit to | puts it at the free end of that row: `rightOf` its last unit, `leftOf` its last unit for a row that grows to the left — from a tall unit, for example. The places come from the catalog widths (`mod_Width`, a root's override first) along each straight row of floor units; a unit of unknown width has no place, and a range hood keeps its place above the hob unit | correction: "'wall4' would hang above 'base3' in the place of 'wall3' - it was put rightOf 'wall3', the end of that row of wall units" (guarded by `it('puts a unit hung above a floor unit whose place a wall-unit row takes at the end of that row')`) |
| — | no group of the call can be built | — | error result: "Invalid pos groups - nothing was loaded: …" with every error |
| D73 | a group the planner left out — a calculation of the group in progress, an error while it was calculated | builds the other groups of the call (D30); a replace that fails so keeps its previous group | `notLoaded`: "posGroups[i]: the planner did not build the group - <reason>; check the group and send it again" |
| — | the planner builds no group of the call — it left every one out | — | error result: "No groups were created or replaced …" with the planner's reasons |
| D73 | a replace the planner restored — the library could not calculate the new layout, so the planner kept the previous group (roomle-ui `_discardCalculation`) | keeps the group as it was; the other groups of the call go on | `notLoaded`: `index`, the group `id`, `rootIds` the root modules the library could not calculate — by the ids the call gave them — and one error per cause, the root modules that failed alike together: "posGroups[i]: the planner could not calculate the new layout of group '…' and kept its previous content - the library could not calculate root modules 'w1', 'w2', 'w3' (OSKB60 ×2, OSKB90) - <first diagnostic line>. Check posGroups[i].attributes and the root modules' attribute overrides against the library data; change the failing values or replace the articles." (one root module: "root module 'u2' (OSKB60)", "the root's", "the article"); a root module of a loaded group with a library error (`logMessages`) alike: "the library could not calculate root modules … of group '…' - <cause>. … The loaded groups and other roots were kept." |
| — | a loaded root of a group of the call with an `Error` or `Fatal` calculation log | keeps the loaded groups and roots | `notLoaded`: original input `index`, the group `id`, the failing `rootIds`, and one error per root with its first diagnostic line and the action to check `posGroups[index].attributes` and the root's attribute overrides against the library data, then change the failing values or replace its article; warnings and unrelated groups are ignored |
| — | a group of the call has no position after the load | — | `hint` |
| D55 | a root module of a group of the call that overlaps an object or a root module of another group, or stands in the 600 mm strip in front of a door or a window within its height, `bottomMm` to `topMm` — by more than 5 mm; a replaced group only for what it did not stand on before | builds it (D51) | `hint`: "Root module 'w1' (OTB30) of group '…' stands in front of the window in the back wall (wall 5, fromEndMm 235 to 2335, 950 to 2170 mm) - free stretches of the left wall (wall 0) at its height: fromEndMm 0 to 4400. Group '…' stands clear of the window in the back wall at offsetMm 590 with wall left and alignment back. The groups were built as sent - move or change them if the user did not ask for them there." — the `offsetMm` sentence only for a group placed at a wall in front of a door or a window of an adjoining wall (D55); with another group named: "… overlaps root module 'r1' (…) of group '…' …", then "If the units belong together, send them as one group or join them with merge-groups." In front of a door or a floor-to-ceiling window, with no piece of wall behind the root module, the wall is the face, named by its pieces, and its stretches are listed per piece from that piece's end (D81): "- free stretches of the back wall (walls 5 to 7) at its height: wall 5 fromEndMm 0 to 1500; wall 7 fromEndMm 0 to 1600". Without a wall the stretches are left out; without a wide enough stretch: "- no stretch of the … is free for it at its height" |

### 8.4 `place-group`

| ID | Input | What the server does | Feedback |
|---|---|---|---|
| G18 | a group id that is neither an id nor a unique prefix of one, nor a root id (C23) (also in the command tools) | nothing | error: "Group '…' not found. Groups in the plan: …" |
| G19 | a room or wall index outside the plan, a side without a face that has a piece of wall | nothing | error: "Room index … not found" / "Wall '…' not found … Available walls: …" |
| G20 | an alignment that names the target wall or the opposite one | centres the group on the wall | correction |
| G21 | a group without calculated geometry | nothing | error: "Group '…' has no calculated geometry to place." |
| G22 | a target that overlaps another group — a root module of the one and a root module of the other overlap by more than 5 mm in their footprints and height ranges; the boxes around the groups are the quick test first, and a group whose root modules have no geometry is tested by its box | moves the group along the same wall to the nearest position free of overlap. Touching is no overlap, wall units above another group's base units do not overlap them, and a group without height data overlaps nothing (`volumesOverlap`, guarded by `it('does not count touching groups, groups above each other or groups without height data')` in roomle-ui `__tests__/hi-plan-space-test.ts`) | correction naming the group and the distance, suggesting `merge-groups` if the units belong together |
| G22 | the same, placed into a corner or without a free position on the wall | places the group as asked | correction: "… overlaps group '…' - there is no free position …" |
| D55 | after the reload, a root module that overlaps an object or stands in the 600 mm strip in front of a door or a window within its height, `bottomMm` to `topMm` (another group is G22's) | places it as asked | `hint`: "Root module '…' (…) of group '…' overlaps an object (x … to …, z … to …, … to … mm) - free stretches of the left wall (wall 3) at its height: fromEndMm … The group was placed anyway - move or change it if the user did not ask for it there." — in front of a door or a window of an adjoining wall, before the closing: "Group '…' stands clear of the window in the back wall at offsetMm … with wall … and alignment …." (D55) |
| D70 | after the reload, the group as built at the new place does not stand as asked — the library built it with another width there | places it once more by its measure at the new place | the corrections of that measure (G22) in place of the first measure's |
| — | a group that already stands where asked (origin within 5 mm, same rotation) | no reload | correction: "Group '…' already stands at the … wall as asked - nothing was reloaded" |
| — | the reload fails | — | error: "Group '…' could not be reloaded at the new position." |

### 8.5 Command tools

**In the tool command, before the group operation:**

| ID | Input | What the server does | Feedback |
|---|---|---|---|
| G18 | an unknown group id | nothing | error with the groups in the plan |
| C23 | a root module id, or a unique prefix of one, as `groupId` (every tool that takes a group id, `place-group` included) | runs the command on the group that holds that root module | correction: "change-group-attribute: 'u2' names a root module, not a group - the command ran on its group 'kitchen-1'" (guarded by `it('reads a root id sent as the group id as the group that holds the root module')` in roomle-ui `__tests__/hi-tool-commands/group-commands-test.ts`) |
| C17 | a root module id that is a unique prefix of a root id, differs from one root id only in its first UUID segment, or differs from one in a single character (`change-module-attribute`, `delete-article-in-place`, `delete-article-and-compact` — without `groupId` among the roots of every group —, `exchange-root-module`, `dockTo.rootId` of `merge-article-into-group`, `between` of `insert-article-into-group`, `rootModuleIds` of `swap-root-modules`) | reads it as that root | correction: "root id '…' was read as '…'" |
| C17 | a root module id that matches no root, or more than one | forwards it as sent | the planner's P11 with "Roots in the plan: …" appended |
| G15 | an article id in another spelling (`merge-article-into-group`, `insert-article-into-group`, `exchange-root-module`) | reads it in the catalog's spelling | correction |
| C19 | `insert-article-into-group` with two roots of one row that are no neighbours | inserts the unit beside the first-named root, towards the second — the walk passes a corner article | correction: "'r1' and 'r3' are not neighbours - the unit was inserted between 'r1' and 'r2', the neighbour of 'r1' towards 'r3'" |
| G52 | `insert-article-into-group` with two roots that are in no row together | nothing: the server cannot tell where the unit goes | error naming the side neighbours of the first root and asking for two neighbours of one row |
| G53 | `swap-root-modules` naming one root twice | nothing | error asking for the two units that change places |
| G54 | `delete-article-and-compact` without `groupId`, with a root module id that matches no root of the plan, or more than one | nothing: without a group the delete cannot run | error "Root module '…' not found. Roots in the plan: …" — the answer the planner gives `delete-article-in-place` for the same id (C17, P11); guarded by `describe('delete-article-and-compact without a group id')` in roomle-ui `__tests__/hi-tool-commands/group-commands-test.ts` |
| C20 | a correction of the planner (a dropped docking, a hung unit moved to another carrier, a unit above that keeps its place and the unit that moved in now overlaps it — in any group —, a deletion instead of closing the gap) | passes it on after the server's own, named by the tool; `delete-article-and-compact` labels the named roots from the original group as id plus article id, falling back to the article name or just the id | correction |
| C22 | `change-module-attribute` or `change-group-attribute` after which the library changed another attribute of a root module — a front program switched by a front colour —, or a root module the command set ends with another value | passes the result on; compares the input attributes of the root modules before and after (D59) | correction after the planner's: "with mod_FrontColor \"324\" (Dark marble (#404040)) the library changed mod_FrontProgram of root module 'w1' (OTB60) from \"Classic\" (Simple fronts in plain decors) to \"Modern\" (Mitred frame fronts with glass filling)" — the root modules changed alike in one sentence, several by article and count: "of 3 root modules (OTB60 ×3)" |
| D43 | an insert, a merge, a `delete-article-and-compact`, an exchange or a swap that makes the row reach past a wall of the room, overlap another group that stood beside it before (not a group the edit split off), or makes a root module stand in front of a door or a window or on an object it did not stand on before (D55, by the groups before the edit) | builds it | `hint`: "the row now reaches past a wall of the room - …" / "the row now overlaps group '…'" / "Root module '…' (…) of group '…' stands in front of the door in the right wall (wall 1, fromEndMm …) - free stretches of the right wall … The row was edited as asked - move the group or edit the row if the user did not ask for it there." |
| D42 | a row edit that moved or rotated upper roots, including the units of another group the edit moved, unknown-category units and finishing parts (by catalog recognition, measured carriers, side docking and room-space poses) | — | `hint`: "the wall units and the range hood above the moved units moved with them ('<root id>' (<article id>), …) - edit the wall row the same way if it should line up with the floor units" |
| D52 | `delete-article-and-compact` that turns a leg | compares calculated root geometry and rotations in room coordinates; identifies each root's room and wall before and after; omits unknown walls | `hint`: "the leg on the left wall turned by 90° and now runs along the back wall (root modules '<root id>' (<article id>), …)" — roots making the same wall-to-wall turn in one sentence |
| G15 | an article id the catalog does not have | nothing | error with the valid article ids |
| D29 | `merge-article-into-group` on a taken side vector | docks the unit to the root at the free end of that row in the named direction — when that row ends at a corner article, to the free end of the leg in the other direction —, or to the named root's free other side when the unit would stand outside the room at that end (the calculated group and the contour of the room the group stands in decide, not the bounding box of its walls) | correction, naming the end it skipped |
| P7 | a `dockingVector` the new article does not have (by the catalog) | uses the partner of `ownDockingVector` when the article has it | correction |
| C25 | an Error/Fatal diagnostic on a root in a group changed by either attribute command, after its final follow-up calculation | keeps the applied changes and other roots | `corrections`, after library-change feedback: "<tool>: the library could not calculate root module '<root id>' (<article id>) of group '<group id>' - <first diagnostic line>. Check the group's attributes and the root's attribute overrides against the library data; change the failing values or replace the article. The applied changes and other roots were kept." Roots with the same cause are grouped per group; warnings and unrelated groups are omitted. Guarded in roomle-ui `hi-tool-commands/group-commands-test.ts` and `hi-tools-test.ts`, and the MCP `tool-executors.test.ts`. |
| D35 | a wall unit or range hood docked Top-to-Top above a floor unit is corrected to Top-to-Bottom; a known wall article or unknown-category article explicitly docked Top-to-Bottom receives the default only when its y offset is omitted | sets the y offset to the hang gap of the wall units (`hangGapOf`) | correction: "'OTB60' hangs 660 mm above '…', at the height of the wall units" |

**In the interior fitting commands** (roomle-ui `hi-interior-design.ts`, D89):

| ID | Input | What the server does | Feedback |
|---|---|---|---|
| C26 | an add, move or replace whose fitting the library places elsewhere than the requested point, even after the corrective add | keeps the library's placement | correction: "The library placed fitting '…' at [x,y,z] instead of the requested [x,y,z]." |
| C27 | a move or replace with the same article that the library keeps at the source's place, with the source's settings | nothing: `changed: false`, no load, no history step | correction: "The library kept fitting '…' at [x,y,z] instead of the requested [x,y,z]." — names the source instance |
| C28 | an explicit setting of the source that the new fitting cannot keep — it fails the calculation or moves a fitting, as an insertion-derived height does | keeps the calculated value | correction: "Setting '…' was reset to the calculated replacement value." |

**In the planner's group operations** (roomle-ui `hi-tools.ts`, `hi-plan-context.ts`). These checks
protect the planner and stay as they are (D5); the tool command passes their message on as an error
result.

| ID | Planner message |
|---|---|
| P1 | "Root module '…' has no sub-module '…'." |
| P2 | "Module '…' has no attribute '…'." — the sub module, or neither the root module nor its sub modules carry it (`find-attributes` names the modules that have it) |
| P3 | "No module of group '…' has the attribute '…'." |
| P4 | "Root module '…' is generated by the library and cannot be deleted." (`delete-article-and-compact`: "… cannot be removed.") |
| P5 | "Root module '…' is not an article root of group '…'." |
| P6 | "Root module '…' has no free docking vector '…' - its free docking vectors: …" — reached only when the planner reports a side as taken although the row ends there: a deletion removes every docking entry that names the deleted root module (roomle-ui `deleteRootModule`), so its neighbours report that side free |
| P7 | "Article '…' has no / more than one docking vector '…' - its docking vectors: …" |
| P8 | "Group '…' is still being calculated - try again once it is loaded." |
| P9 | "Article '…' has n root modules - a root module is exchanged with an article of exactly one." |
| P10 | "Groups of different libraries cannot be merged: …" |
| P11 | "Root module '…' not found." / "Group '…' is not in the plan." / "Article '…' is not in the article catalog." |
| P12 | "Another operation on group '…' is still in progress." (rare: D4) |
| P13 | payload-shape messages — not reachable, the tool commands build these payloads |
| P14 | "Root modules '…' and '…' are not docked side by side - the side neighbours of '…': …" — reached only when the plan context and the planner disagree, since the server corrects non-neighbours (C19) |
| P15 | "A corner article and a straight unit cannot change places: '…' is a corner article." — no result keeps the corner |
| P16 | "Article '…' has n root modules - an article of exactly one root module is inserted." |
| P17 | correction, not an error: "Group '…' has no doors or drawers that open." / "Root module '…' has no doors or drawers that open." — `open-or-close-group`, `open-or-close-article`; nothing is switched |
| — | "The planner did not delete …" (a refused deletion) |

### 8.6 Schema checks

The zod schemas in `hi-mcp-server.ts` reject a call before the tool logic runs, with "Input
validation error: …".

| ID | Schema |
|---|---|
| S1 | `create-or-replace-groups` `posGroups`: a non-empty array of objects |
| S2 | `place-group` `wall`: `left`, `right`, `top`, `bottom`, `back`, `front` or an index ≥ 0; `roomIndex` an integer ≥ 0 |
| S3 | `place-group` `alignment`: `start`, `center`, `end`, a side label, `back` or `front` |
| S4 | attribute `value`: a string, a number or a boolean |
| S5 | `merge-article-into-group` `dockTo.mode` (4 modes), `offset` `[x, y, z]`, `attributes` `[{ id, value }]` |
| S6 | `get-plan-context` `include`: an array of strings; `find-attributes` `text` non-empty (also "text must not be empty." in the executor); `merge-groups` `groupIds` non-empty |

### 8.7 Connection and bridge messages

Infrastructure checks, kept. The page allow-list is the security boundary.

| Message | When |
|---|---|
| "No HI page connected. Have the user open the ligna-store in their browser at … and start planning there …" | no page on the bridge; Cloudflare's configured store link carries the requesting session or `mcp_session=default` for an unnamed client. The local fallback includes `mcp_server` with its configured port and HTTP/TLS scheme. The store starts its bridge independently of chat |
| "The connected page (…) runs an outdated HI MCP page bridge that expects tool calls. Have the user update the page bridge to protocol 2 … and reload the page." | a page with an old bridge |
| "Planner call '…' timed out after …ms" | a planner call exceeded its timeout (§4). The page is not told to stop, so a plan change may still complete: read the plan before sending it again |
| "The demo page disconnected" | the page left during a call |
| WebSocket close 4409, "Planner session in use" | another page already owns the planner; the newcomer must retry after the owner leaves |
| HTTP 409, "This chat is not connected to its planner page" | the browser chat's `client` ID does not own the active page |
| the page's own error (e.g. a method not on its allow-list) | the planner call failed in the page |

### 8.8 `undo` and `redo`

Nothing here is an error result: the tool answers with its name `null` and a `hint`.

| Situation | What the server does | `hint` |
|---|---|---|
| no record | nothing | "Nothing to undo: no tool call has changed the plan since the planner page connected." / "Nothing to redo: redo brings back a tool call that undo reverted, and a new change of the plan ends redo." |
| a history event while no tool call ran, or the plan differs from the state the call left | forgets the records | "The plan was changed in the planner after the last tool call, so no tool call was reverted - the planner's own undo button reverts the changes made there." |
| a planner undo or redo without its history event | forgets the records | "The planner's undo history no longer holds … - the plan was loaded again, nothing was undone." / "… ended after n of m steps of … - check the plan with get-plan-context." |
| the plan after the steps is not the plan before (`undo`) or after (`redo`) the call | takes the steps back, forgets the records | "Undo of … did not give back the plan before it - the plan was changed in the planner while the tool call ran. The undo was taken back and the plan is as it was; the planner's undo button reverts the changes made there." / "… could not be taken back completely - check the plan with get-plan-context." |
| a page without `undo` on its allow-list | — | error result: the page's "Planner method not exposed: undo" (§8.7) |

### 8.9 `get-skill`

| ID | When | Error result |
|---|---|---|
| G65 | `name` is no skill of the index | "Unknown skill "<name>" - the skills are image-planning, kitchen-planning, kitchen-planning-fr, living-room-planning" |
| G66 | `file` is no file of the skill — another path, a directory, a path outside the skill | "Unknown file "<file>" of the skill <name> - its files are SKILL.md, references/planning-reference.md, references/source-catalog.md" |
| G67 | `skills/get` of the Skills extension: `uri` is no `SKILL.md` URI of `skills/list` — another skill, a supporting file, none | error `-32602` (invalid params): "Unknown skill "<uri>" - the skills are skill://image-planning/SKILL.md, skill://kitchen-planning/SKILL.md, skill://kitchen-planning-fr/SKILL.md, skill://living-room-planning/SKILL.md" |

All three are the last resort of §2.2, an id that matches nothing; the message names what to send.

## 9. Limits

| Limit | Value | Where |
|---|---|---|
| Planner call timeout | 30 s, 120 s for the tool commands and snapshots | `page-bridge.ts`, `planner-api.ts` |
| Chat steps per turn | 16, the last without tools | `MAX_CHAT_STEPS`, roomle-ui `hi-planning-assistant.ts` |
| `find-attributes` matches | 20 | `MAX_ATTRIBUTE_MATCHES` |
| Valid article ids in G15's message | 100 | `unknownArticleMessage`, roomle-ui `hi-tool-ids.ts` |
| Overlap tolerance of `place-group` and of the obstacle hint | 5 mm | `OVERLAP_TOLERANCE_MM`, roomle-ui `hi-wall-placement.ts` |
| Strip along a wall: in front of a door or a window, and where a root module stands at a wall (D55) | 600 mm | `WALL_STRIP_MM`, roomle-ui `hi-wall-placement.ts` |
| Wait for the history event of a planner undo or redo | 1 s | `HISTORY_EVENT_WAIT_MS` |
| Comparison of the plan before and after a tool call | 0.1 mm | `groupsKey` |
| Planning skills | the directories of `hi-mcp/hi-mcp-server/skills/`, read once at start | `SKILLS_DIR`, `loadSkills` |

## Interior Design tools

Interior Design, interior fittings and sub-articles refer to supported fittings inside an existing HI group. Read `get-interior-design-options` with `groupId` and optional `rootId`, `containerModuleId`, `articleId` filters. It returns unique installed instance IDs, parent-local positions where each fitting's parts start (D89), explicit settings and compatible library articles with destination tuples. It uses the existing context read with a scoped `interiorDesign` section; it waits behind writes, changes no selection and creates no history entry. Unsupported capability, no available additions and a discovery error have different outcomes.

`articles` lists compatible additions in currently free containers. Each scoped fitting also carries `replacementArticles` for its current parent: discovery removes that source on a copy, calculates the freed capacity and asks the same library for compatible articles. A full cabinet can therefore have no additions but still offer replacements. `articleId` filters addition and replacement candidates; installed sources that can take that replacement remain visible. `status: available` includes either kind of choice. Use a fitting's replacement article IDs with its installed instance ID; generated containers on the copy are not add destinations. Normal group/history context remains compact and does not calculate these choices.

| Tool | Required arguments beyond groupId |
| --- | --- |
| `add-interior-fitting` | `articleId`, `destination: { rootId, containerModuleId, parentModuleId }` |
| `move-interior-fitting` | `instanceId`, destination and/or `insertPosition` |
| `delete-interior-fittings` | Non-empty `instanceIds` list |
| `replace-interior-fitting` | `instanceId`, replacement `articleId` |

Add, move and replace accept an optional `insertPosition: [x, y, z]`: millimetres, x right/y up/z front, relative to the destination parent module — the frame of the discovered `position`, so a fitting moves by an offset added to its position. The tool command places the fitting at that point whatever frame the library reads it in (D89). Add without it uses the library default; move/replace retain measured source placement. Missing source measurement requires a point. Library adjustments are reported (C26), including a no-op when the library keeps a moved fitting at its place (C27). An upper/lower instance is chosen from measured heights within the same parent, never list order. Clarify an ambiguous instance or an unspecified interior edit.

Discovery precedes edits. A generated container ID can expire after calculation; a stale explicit destination fails. The UI revalidates library compatibility inside each edit, stages changes and awaits final loading. Transfer stays within one group. Delete validates the complete batch and deduplicates IDs with a correction. Replacement removes the source only on the working copy, calculates available containers, adds/calculates the replacement and publishes one final group. Calculation failure preserves the original; a load failure restores it and awaits restoration. If restoration fails, the error says so.

Results retain `changed`, `addedInstanceIds`, `removedInstanceIds`, final `fittings`, and `corrections`. Recreation may change IDs. A changed call is one undoable action; no-op or failed-before-change calls add none. A failure after loading retains the planner's undo record. Groups include compact `interiorFittings`, so history detects an interior-only move or setting change with an unchanged cabinet outline. Never rebuild nested module trees or issue separate delete/add calls as replacement.

The server owns schemas, serial forwarding and agent wording. roomle-ui (`homag-intelligence/src/hi-interior-design.ts`) owns fitting identity, compatibility, calculation, completion and restoration. The planner API stays at six methods (D71, D96).
