# HI MCP server — behaviour

> **Living reference.** It describes how the HI MCP server (`hi-mcp/hi-mcp-server`) behaves towards an
> agent: the guidelines and decisions it follows, its tools, the information it provides, and every
> guard, automatic correction and feedback message. Every change to a tool, a served rule, a guard, a
> correction or a result updates this document in the same change.
>
> **State**: the code of 2026-10-08 — with the placement of a new group by wall
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
> **Not covered here**: setup, clients and deployment. See
> [hi-mcp-server.md](hi-mcp-server.md) (the example page and MCP
> clients), [hi-mcp-server/README.md](../hi-mcp/hi-mcp-server/README.md) (server setups and environment
> variables) and [cloudflare-mcp-server.md](setup/cloudflare-mcp-server.md).

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
kitchen, a row of cabinets — in a live Roomle planner session in the user's browser. The tools run
in the server. Every planner call they make runs in the connected page, and the page executes only
the planner methods on its allow-list
([ADR 0001](../.agents/decisions/0001-hi-mcp-tool-logic-in-the-server.md)).

Two parts have different responsibilities:

- **The MCP server** decides what the agent is told and how the agent's input becomes planner calls.
  Its guards and corrections follow the [guidelines](#2-guidelines) of this document.
- **The planner** (roomle-ui `homag-intelligence`) decides what can be built. Its checks protect the
  planner from breaking, and they are not loosened for the agent. Where it can, the server corrects
  the input before forwarding it, and it passes the planner's messages on to the agent
  ([§8.5](#85-command-tools)).

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
- **what was not built, and why** — a `notLoaded` list (`create-or-replace-groups`) that names what to send instead: a group, or with `rootIds` the roots of a group that loaded without them
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
- **Library-neutral.** The server serves every HI library. The served text, the results and the
  server's logic carry no information about a specific library — no article, category, attribute,
  value or measure of one library, not even as an example. The only source of library information
  is the library data the plan context passes on: the master data and the article list, and in them
  the `desc` properties (D8). When the agent picks the wrong library content because it lacks
  information, the fix is the desc in the library data, never a served rule.
- **Never mention internals**: `repositioningData`, the anchor frame, the anchor probe, `rootRelPos`,
  `cornerPoint`. `tests/hi-mcp-server.test.ts` guards this
  ("never tells the agent how the server positions a group internally").

## 3. Decisions

Decisions about the behaviour towards the agent. **State**: *in effect* (implemented), *planned*
(decided, not implemented yet), *superseded* (replaced by a later decision, kept for the record).

### Architecture

| # | Decision | Date | Source | State |
|---|---|---|---|---|
| D1 | The tool logic runs in the MCP server. Pages execute only the planner methods on their allow-list, and the allow-list is the page's security boundary | 2026-09-29 | [ADR 0001](../.agents/decisions/0001-hi-mcp-tool-logic-in-the-server.md) | in effect — `tool-executors.ts`, `planner-api.ts` |
| D2 | Planner methods that place orders or overwrite the plan are added to the allow-list only by explicit decision | 2026-09-29 | ADR 0001 | in effect |
| D3 | **Group edits are commands the planner performs** with its own group features, through one planner method, `externalObjectGroupOperation(command, payload)`: a new command is a payload, not a new page allow-list entry. Every command is its own MCP tool with its own schema and description — no generic `group-operation` tool. Rejected: one planner method per command (an allow-list entry in every page per command), and the edits rebuilt by the server on the replace path (it would re-implement the planner's swap, delete and merge with their load reasons, id maps and the kernel's split). `update-attribute` is retired | 2026-09-30 | [RML-18004](https://roomle.atlassian.net/browse/RML-18004) | in effect — `runGroupOperation` (roomle-ui `hi-plan-context.ts`); the command tools, `tool-executors.ts` |
| D4 | Tools that change the plan run one after another, never side by side | 2026-09-30 | `oneAtATime`, `tool-executors.ts` | in effect |
| D5 | The planner's checks protect the planner and are not changed for the agent. The server corrects input before forwarding it | 2026-10-02 | user decision | in effect |
| D37 | `undo` and `redo` join the page allow-lists by explicit decision (D2): they step through the planner's own undo history, as its undo button does, and place or overwrite nothing beyond it. The page relays the planner's `onHistoryChange` as a bridge event, so the server can tell the planner steps of its tool calls from the changes the user makes in the planner | 2026-10-05 | [RML-18044](https://roomle.atlassian.net/browse/RML-18044) | in effect — `planner-api.ts`, `plan-history.ts`, `browser-bridge.ts`, `index.html` |
| D38 | **The agent's undo reverts tool calls only.** The server records every tool call that changed the plan with the planner steps it made; `undo` reverts the last one while the plan is as that call left it. A history event while no tool call runs is a change in the planner: the server forgets its records, and `undo` says so — the planner's undo button serves the user's own changes | 2026-10-05 | [RML-18044](https://roomle.atlassian.net/browse/RML-18044) | in effect — `plan-history.ts`, `recorded`, `revertToolCall`, `tool-executors.ts` |
| D47 | **Undo steps back through the planner's own history.** `undo` calls the planner's `undo()` once per step the tool call made, and checks the plan against the one before the call. Rejected: a server snapshot restored by a load — a re-created group gets new ids, the library recalculates every restored group and may discard a replace it cannot calculate, the restore adds steps the user's undo button then undoes, and the user's own edits are overwritten; and stepping back blindly by a step table without the relayed history events — nothing would tell an empty or cleared history or a user's edit. The step count and the follow-up wait encode roomle-ui behaviour; one planner step per tool call in roomle-ui would remove both ([backlog](../.agents/backlog/one-undo-step-per-tool-call.md)) | 2026-10-05 | [RML-18044](https://roomle.atlassian.net/browse/RML-18044) | in effect — `countingPlannerApi`, `revertToolCall`, `tool-executors.ts` |
| D6 | In the planner, merge, split, delete and move are always carried out, even if the result is incorrect; the errors of a previous operation never block the next one | 2026-10-01 | user rule (RML-18017, roomle-ui glue logic) | in effect (roomle-ui) |

### Information for the agent

| # | Decision | Date | Source | State |
|---|---|---|---|---|
| D7 | `imageUrl` is stripped from every JSON result: signed CDN URLs no agent can open, three quarters of the plan context's tokens. Stripped in the server for every MCP client — not in a chat client, and not in roomle-ui, whose plan context also serves the page | 2026-10-01 | Mistral context overflow in "test the mcp" ([PR #39](https://github.com/roomle-dev/roomle-hi-example/pull/39)) | in effect — `withoutImageUrls`, `hi-mcp-server.ts` |
| D8 | Every `desc` is authoritative, and `dimensions` give an article's size — over the catalog images only. A wrong `desc` is fixed in the library data, never worked around in the instructions: the descs of `UELTB90` and `UERTB90` name the opposite hand, and an agent asked for a hand takes the article the desc names | 2026-10-01 | user | in effect — rules `hi-mcp-server.ts:9`; guarded by `it('limits the desc-over-image rule to the catalog images')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` |
| D53 | **A colour code in the desc of an attribute value is the colour of that value**, taken as it is: a `#rrggbb` code — `Cloudy blue (#506080)` — tells light from dark and one hue from another, not the name. The rules and the descriptions of `get-plan-context` and `find-attributes` say so. The agent never sees a thumbnail (D7); the library tooling takes the code from the desc and analyses a thumbnail only for a value without one. Every Furniture_Smith colour value with a thumbnail carries its code. Rejected: a `colour` field the server derives — the desc reaches the agent unchanged, and the field would repeat it on every selection of every match; a sentence telling the agent to analyse the thumbnail of a value without a code — the agent sees no thumbnail (D7), and it would contradict D8 | 2026-10-07 | user | in effect — rules `hi-mcp-server.ts:9`; guarded by `it('tells the agent that a colour code in a desc is the colour of the value')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` |
| D9 | The groups of the plan context carry no parts and no log messages. The parts stay in the planner's raw groups: the footprint, the server's placement geometry, the planner's article pick detection and its part list read them | 2026-10-01 | user | in effect — roomle-ui `shapeRoot`, `shapeGroup` |
| D48 | **The plan context is agent-ready as the planner returns it.** roomle-ui shapes it (`hi-plan-context.ts`): the master data reduced to the root modules — the generated ones included — and their customer-facing attributes, which `find-attributes` searches, plus the library's group settings, the attributes of its group orchestrator (`groupSettings`, [RML-18075](https://roomle.atlassian.net/browse/RML-18075)); the catalog with its docking vectors; the groups; the room contour in 3D (`[x, level, -y]`, the system of a group's `pos`) with the derived walls; the obstacles. The pages pass it through. The server adds its own vocabulary — wall names, corners, the wall of a door or window, `cornerArticle` on an empty plan (C18, C21, C7) —, reports the group positions in the frame of a placement (C14), and removes what the agent must not see (D7, D10). The footprint geometry exists twice, in roomle-ui for the plan context and in `plan-space.ts` for the server's placement: accepted | 2026-09-28 | [RML-17966](https://roomle.atlassian.net/browse/RML-17966) | in effect — roomle-ui `getPlanContext`, `hi-plan-context.ts`, with `groupSettings` ([RML-18075](https://roomle.atlassian.net/browse/RML-18075)) |
| D10 | The agent is never told how the server positions a group internally; the articles' `cornerPoint` is removed from the plan context | 2026-09-30 | [RML-18007](https://roomle.atlassian.net/browse/RML-18007) Task 1, P3 | in effect — `agentFacingArticle`, `tool-executors.ts`; guarded by `it('never tells the agent how the server positions a group internally')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` |
| D11 | A group returned by `get-plan-context` is a valid `create-or-replace-groups` payload as it is | 2026-09-16 | rules (`AUTHORING_RULES`, `hi-mcp-server.ts`) | in effect |
| D12 | Walls are named by their side in the top-view image — `left`, `right`, `top`, `bottom`; the text maps back = top, front = bottom. Every wall also carries its `name` in the user's words (back wall, front wall, …), an opening its `type`, and every room its `corners` with their names and rotations ([RML-18041](https://roomle.atlassian.net/browse/RML-18041)) | 2026-09-02 | [RML-17966](https://roomle.atlassian.net/browse/RML-17966), D7 of the repositioning refactoring | in effect — `agentFacingRooms`, `roomCorners` |
| D61 | **The walls follow the kernel's room contour as it is.** The `ROOM` and `PLAN` contour of RoomleCore runs counter-clockwise with the room on its left, and an opening splits only the wall piece it overlaps, so the points along a wall face follow its direction, also with several doors and windows in one wall. roomle-ui (`deriveWalls`) takes each wall's `side` and `facingRotationY` from the direction of its segment; the server names the walls and builds the corners from them (C18). A wall entry with the wrong side is corrected in the kernel's contour. Rejected: a side test in `deriveWalls` or in the server — it hides the defect: the wrong entry still spans the openings, the same contour reaches the HOMAG library and the order data, and the server cannot tell a wall that runs back from the wall of a room that bulges; and a further query of the kernel — the contour carries everything the walls need | 2026-10-07 | user | in effect — RoomleCore `ObjectSurroundings::addOpeningToContour`, roomle-ui `deriveWalls`; guarded by `TEST_CASE("object surroundings split only the wall piece an opening lies on")` in RoomleCore `test/planner/geometry/object-surrounding-geometry-test.cpp` |
| D13 | Rotations are counter-clockwise as seen from above; a group against the right wall has 270, against the left wall 90. Not clockwise, as the ticket comment assumed: RoomleCore passes the angle through a proper rotation from HI space (Y up) to kernel space (Z up), and the golden Furniture_Smith L-shape at 270 stands in the back right corner ([rotation sense](../.agents/skills/roomle-hi-concepts.md#rotation-sense)) | 2026-09-29 | [RML-17966](https://roomle.atlassian.net/browse/RML-17966) comment 155478 (its clockwise values rejected), D1 of the repositioning refactoring | in effect |

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
| D21 | `place-group` works on the calculated group, keeps the group's height, and returns `{ placedIn, wall, group }`; it knows walls and corners, not free points | 2026-09-30 | [RML-18007](https://roomle.atlassian.net/browse/RML-18007) Task 2, Q1, Q3–Q5 | in effect — `place-group`, `tool-executors.ts`; `plan-space.ts` |
| D22 | A group outside the room is never refused, removed or warned about: the user may ask for it — a terrace, a space without walls in the plan, a parking spot while planning —, and the server cannot tell that request from a wrong placement. Rejected: a room check after the load. In "test the mcp" a group outside the room is a model finding ([hi-mcp-testing.md](../.agents/skills/hi-mcp-testing.md)) | 2026-10-01 | user, review before [PR #42](https://github.com/roomle-dev/roomle-hi-example/pull/42), which dropped the check with its rule sentence and tests | in effect |
| D23 | **A new group is placed by wall, alignment and offset**, as `place-group` moves a group: `placement { wall, alignment?, offsetMm?, roomIndex? }` in `create-or-replace-groups`, with the walls, alignments and defaults of `place-group`, beside the placement by point, which stays for an island, a free spot and a group of wall units only. The server loads the group without a position, computes the target from the calculated group — the width a wall placement needs exists only after the calculation —, moves a target that overlaps another group along the wall (G22), reloads the group once and sets its group materials after the reload (D36): the planner answers an attribute command before the calculated group carries the new values, so a reload after it would send the values before it; the anchor probe is not needed. Two loads and the material command, planner steps which `undo` reverts together (D47); D46 holds for the placement by point. A placement with a wall and a point uses the wall (G57); with two corner articles the first one in roots goes into the corner. The new groups of the plan are paired with the call's by their order; when the planner built more or fewer new groups than the call sent — a group it leaves out shifts that order ([backlog](../.agents/backlog/planner-load-outcome-per-group.md)) —, the server moves no group by wall (G60). After the reload it tells a group the planner did not move by the floor it covers, which is the floor it covered before: the load answers with runtime ids that name no group, and after a reload the planner keeps the group origin at another root or corner, so neither tells (G59). The served text teaches the wall form for a wall or a room corner — a corner by the side label of the adjoining wall, a free stretch by `end` and `offsetMm` from `fromEndMm`. The alignment `start` stays accepted, as in `place-group`, and is not taught: it is a contour term the models take for the wrong corner. Rejected: a probe of the whole group and one load at the target — every call would calculate the group twice and turn the footprint into the anchor's frame on a second path; a width from the catalog before the load — it breaks on corner articles and range hoods. | 2026-10-08 | user | in effect — `placeAtWalls`, `normalizeWallPlacement`, `wallTarget`, `tool-executors.ts`; `AUTHORING_RULES`, the descriptions, `hi-mcp-server.ts`; guarded by `describe('create-or-replace-groups wall placement')` and `it('reverts a new group placed by wall, its load and its reload, in one undo')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts`, `it('places a new group by wall and alignment and leaves the point to the server')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts`, and the tests `four-cabinets-back-wall`, `four-cabinets-centred-back-wall` and `image-kitchen-left-wall` of `docs/test-prompts.json` |
| D24 | `place-group` rejects a target that meets another group (contact guard) | 2026-09-30 | [RML-18007](https://roomle.atlassian.net/browse/RML-18007) Task 2, D1 | superseded by D27 |
| D25 | A placement on a group that is already in the plan is rejected | 2026-09-30 | [RML-18007](https://roomle.atlassian.net/browse/RML-18007) Task 1 | superseded by D26 |
| D46 | **A new group stands where the placement says after the one load that creates it, and the server owns its anchor.** This holds for the placement by point; a placement by wall loads the group and moves it (D23). The server finds the anchor by the docking (C5), not by the order of the roots — the models did not list it first —, and learns the anchor's frame before the load (C6, D33). Rejected: a correction load after the creation — load, read the calculated anchor, move it: every offset group would load twice and visibly jump, and moving is `place-group`'s (D21); a planner repositioning option that places a root by its docking corner — the corner turn is a convention of the served corner rules, not of the planner, and it needs a roomle-ui release; the footprint corner as the reference — it includes generated parts, the worktop overhangs by 10 mm; a special case for the range hood, such as centring it over the nearest hob — it guesses the intent, which docking states. Whether the probe can go away is open ([backlog](../.agents/backlog/roomle-ui-article-template-geometry.md)): the frame depends on the attribute overrides, and an article template gives the default variant | 2026-10-02 | [RML-18007](https://roomle.atlassian.net/browse/RML-18007); user, 2026-10-02 (D33) | in effect — `findAnchorRoot`, `toRepositioningData`, `group-placement.ts`; `probeAnchorFrame`, `tool-executors.ts` |

### Guards and corrections (2026-10-02)

| # | Decision | Source | State |
|---|---|---|---|
| D26 | **A conflicting placement creates no `repositioningData`.** For a placement on a group that is already in the plan, or a placement the server cannot use, the server sends no `repositioningData`, and the planner (roomle-ui, RoomleCore) positions the group — an existing group keeps its position. The result says that the placement was not used | user, [RML-18033](https://roomle.atlassian.net/browse/RML-18033) | in effect — `normalizePlacement`, `tool-executors.ts` |
| D27 | **Intersecting groups are allowed** (`place-group`). When the target overlaps another group, the server corrects the position along the wall and informs the agent; it never rejects. Touching is not an overlap. Two groups overlap when a root module of one overlaps a root module of the other: the box around an L-shaped group covers the floor inside the L, which its root modules leave free, so the boxes are only the quick test first | user, [RML-18033](https://roomle.atlassian.net/browse/RML-18033) | in effect — `freePlacementAlongWall`, `overlappedGroupIds`, `groupVolumes`, `tool-executors.ts`; guarded by `it('reports no overlap with a group inside an L-shaped group that no root module touches')` and `it('still moves an L-shaped group away from a group that one of its root modules overlaps')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` |
| D28 | **Unconnected roots are connected automatically.** The server adds a docking entry (`PosDockedContextRoot`: `dockingVector`, `mode`, `offset`) that docks them to the free end of the row. The guard stays for roots that cannot be connected | user, [RML-18033](https://roomle.atlassian.net/browse/RML-18033) | in effect — `connectUnreachedRoots`, `tool-executors.ts` |
| D29 | **A unit docked to an occupied side goes to the free end of that row** (`merge-article-into-group`, and two roots on one side vector in `create-or-replace-groups`). Refined 2026-10-04 ([RML-18041](https://roomle.atlassian.net/browse/RML-18041)): a row has two ends — `merge-article-into-group` walks in the direction the agent named and takes the named root's own free side only when the unit would stand outside the room at that end (the test runs showed the agents name the wrong root as often as the wrong direction; the room decides); a corner article ends a row, so a walk that meets one turns to the free end of the leg in the other direction | user, [RML-18033](https://roomle.atlassian.net/browse/RML-18033) | in effect — `separateSideVectorPartners`, `dockTarget`, `rowWalk`, `tool-executors.ts` |
| D30 | **A call loads every group that can be built** and reports the others with what to send instead | user, [RML-18033](https://roomle.atlassian.net/browse/RML-18033) | in effect — `keepBuildable`, `tool-executors.ts` |
| D31 | Guards are a last resort; the server corrects and informs, and gives feedback where it cannot correct | user guideline | in effect — §8 |
| D33 | **One anchor frame for every article.** A placement puts the docking corner of the anchor root — the back left bottom corner of its docking vectors — at `posGroup`, whatever article it is: the origin of a cabinet, the left edge of a range hood, the corner point of a corner article, which is also turned so that its corner lies back left. The groups the tools return report their position in the same frame: `pos` is the back left bottom corner, `rotationY` the rotation of the placement. An anchor the probe cannot calculate no longer fails its group (G17) | user, 2026-10-02 ([RML-18007](https://roomle.atlassian.net/browse/RML-18007); the range hood placed half its width off) | in effect — `anchorFrameOfRoot`, `toRepositioningData`, `positionInPlacementFrame`, `group-placement.ts`; `inPlacementFrame`, `tool-executors.ts` |
| D34 | **A unit names its neighbour, the server builds the docking.** Every root after the first names one neighbour with one relation — `rightOf`, `leftOf`, `onTop` (`align`, `gapMm`), `above` (`gapMm`), `behind` — and the server compiles the docking entries (`contextData`) from it: the vectors, the mode, the offset, and the root the entry goes on. A wall unit `rightOf` / `leftOf` a tall unit docks by the Top vectors. `contextData` stays accepted and is no longer taught; a group without any relation field is not touched. Rejected: rows written as arrays — wall units, corners between rows, stacking and islands each need a field of their own, and the nesting returns —, and a server that lays the group out from a list of articles and a wall — the order, the corner side and the wall units are the user's intent | user, 2026-10-02 ([RML-18038](https://roomle.atlassian.net/browse/RML-18038)) | in effect — `relationsToDocking`, `group-layout.ts` |
| D35 | **The hang height of a wall unit `above` a floor unit** is the height of the tall units — a tall unit of the group, else the usual tall unit of the library — minus the heights of the wall unit and the floor unit (`mod_Height`); base and tall units stand on the same plinth. Furniture_Smith: 2100 − 720 − 720 = 660. `gapMm` overrides it | [RML-18038](https://roomle.atlassian.net/browse/RML-18038) Decision 1, 2026-10-02; confirmed live 2026-10-04 ([RML-18041](https://roomle.atlassian.net/browse/RML-18041)): bottom 1480, top 2200, flush with the tall units | in effect — `hangGapOf`, `group-layout.ts` |
| D36 | **A material for the whole group goes into the group's `attributes`.** A root's `attributes` are overrides of that root module. A group attribute that is not one of the library's group settings is set on every unit and generated root of the group after the load — all of them with one planner command, `change-attributes`, in one calculation and one undo step (amended 2026-10-08, [RML-18064](https://roomle.atlassian.net/browse/RML-18064)) — after a create and after a replace alike; an override only a generated root carries (the worktop colour on a base unit) is moved to the group; the colours of the generated roots a replace drops (C1) are set again. A unit attribute on some roots stays per unit — it may be an accent. A root module that names its own value of a group attribute keeps it: the same command sets the group's value on every unit and then the root module's own value on that root module — its own program attributes first, which the group's colour may have switched —, the entries applied in their order, and `groupAttributes` names those root modules in `rootValues`. The program attributes (`…Program`) go first in the command, because a program resets a colour it does not offer: a colour sent with its program stays. **The group settings come from the master data** (`groupSettings`, D48), not from the loaded group: the planner lets the library set a group's attributes on a create only and keeps them as sent on a replace, so a replace lost its materials (amended 2026-10-08, [RML-18075](https://roomle.atlassian.net/browse/RML-18075)); a planner without `groupSettings` falls back to the attributes the loaded group lists. **A replace builds what it is sent:** a root sent again without its attributes takes those of its article template — the group from `get-plan-context` carries each root's input attributes (user, 2026-10-08, [RML-18075](https://roomle.atlassian.net/browse/RML-18075)) | 2026-10-04 ([RML-18041](https://roomle.atlassian.net/browse/RML-18041)) | in effect — `applyGroupWideAttributes`, `rootValuesOf`, `programsFirst`, `groupSettingIdsOf`, `moveGeneratedRootOverrides`, `tool-executors.ts`; guarded by `it("sets a root module's own value of a group attribute on that root module after the group's value")` and `it('sends the program attributes of the group before the others, so a colour sent with its program stays')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts`; the replace part with the `groupSettings` of roomle-ui `compactMasterData` ([RML-18075](https://roomle.atlassian.net/browse/RML-18075)) |
| D32 | **Nothing the agent sends is dropped without a report.** What the server can build it builds — a unit written inside the docking becomes a root — and every field it cannot use is named in `corrections`. Only the read-only fields of a group from `get-plan-context` are ignored silently | user, 2026-10-02 ([RML-18033](https://roomle.atlassian.net/browse/RML-18033)) | in effect — `prepareGroup`, `tool-executors.ts` |

### Row edits (2026-10-05)

| # | Decision | Source | State |
|---|---|---|---|
| D39 | **The row edits are planner commands.** `insert-article-into-group`, `delete-article-and-compact` (the roomle-ui command `remove-article-from-group`) and `swap-root-modules` are roomle-ui commands that rewrite the docking of the row and let the root module arrangement move the units, against the group before the edit, in one reload (D3). The server resolves the ids, corrects what it can and forwards one command. Rejected: the server rewriting the relations and replacing the group with `create-or-replace-groups` — the replace path keeps no wall distance, the server would have to pick the end that stays and position the group without the planner (D26), and a replace regenerates the ids; and an insert as a mode of `merge-article-into-group` — a tool named for the intent is what the model selects by, and a taken side there means the end of the row (D29) | [RML-18045](https://roomle.atlassian.net/browse/RML-18045) | in effect — `insert-article-into-group`, `swap-root-modules`, `tool-executors.ts`; roomle-ui `glue-logic.ts` |
| D40 | **Remove and delete are two edits, named by the user's word.** The rules and the two tool descriptions tell the agent to take the user's word: "remove" is `remove-article-from-group`, "delete" is `delete-root-module` (added after the MCP test of 2026-10-05, where gpt-5-mini closed the gap for "delete the middle unit"). **Each description opens with its word** — "The tool for "delete": when the user asks to delete a unit, a cabinet, a module or an article, …" — and points to the other tool by its word, not by the gap: the HI chat does not read the rules, and with the word as an aside behind the gap gpt-5.4-mini took `delete-root-module` for "remove" in every chat run (amended 2026-10-08, [RML-18079](https://roomle.atlassian.net/browse/RML-18079)). "Remove" names this edit only: `delete-group` deletes a group. `remove-article-from-group` takes the `rootModuleId` alone, like `delete-root-module`; its `groupId` is optional (G54). `delete-root-module` deletes a unit and leaves the gap: units no longer docked together become separate groups where they stand. `remove-article-from-group` removes a unit and closes the gap: its two neighbours are docked to each other, and a unit hung on it hangs on the neighbour that moves into the gap. A unit at the end of a row leaves no gap: it is removed in the same reload and nothing else moves. **A remove never splits a group** (amended 2026-10-07, [RML-18065](https://roomle.atlassian.net/browse/RML-18065)): a corner article between two legs is removed and the gap closed as well (D52). Only the only unit of a group is deleted, with its group. A deletion splits by docking, so with `delete-root-module` wall units hanging with a gap above their floor units become groups of their own — that is what "delete" means | user, review of the plan, 2026-10-05; the corner article: user, 2026-10-07; the word first: [RML-18079](https://roomle.atlassian.net/browse/RML-18079), 2026-10-08 | superseded in part by D58 — what each edit does stays, under the names `delete-article-in-place` and `delete-article-and-compact`; the selection by the user's word goes |
| D41 | **Which part of a row moves.** The end of the row at a wall or in a corner keeps its place, and the other end moves; a row without a wall on its axis keeps the end at the group origin — the left end as seen from the front, the corner article of a corner kitchen. A row that grows from wall to wall is built anyway | [RML-18045](https://roomle.atlassian.net/browse/RML-18045) | in effect (roomle-ui `keepWallDistances`) |
| D42 | **Units above follow the unit they hang from.** A wall unit, a range hood or a unit on top moves with the unit below it — on an insert with the pushed unit, on a swap with its own unit, on a `delete-article-and-compact` with the neighbour that takes the place of the removed unit, unless that neighbour carries a unit above it already: then the unit keeps its place, and the correction names the unit above that moved in and now overlaps it. The planner finds the unit below by position: its docking context links only vectors that touch, so after a load a wall unit hanging with a gap is no longer docked to its floor unit (found live, 2026-10-05). Nothing edits the wall row automatically: the same tools edit it | [RML-18045](https://roomle.atlassian.net/browse/RML-18045) | in effect (roomle-ui) — `removeArticleFromGroup`, `unitsOverlapping`; guarded by `it('keeps a unit above in place when the neighbour carries one already')` in roomle-ui `glue-logic-test.ts` |
| D43 | **A row edit says what it did to the row.** When an insert, a `delete-article-and-compact`, an exchange or a swap makes a row that stood inside the room reach past a wall, overlap a group it did not overlap before, or stand in front of a door or a window or on an object it did not stand on before (the test of D55), the result's `hint` says so; the row is built anyway. This is no warning about a group outside the room (D22): a group that stood outside before the edit is never reported. The `hint` also names the units above that moved with the unit below them (D42) | [RML-18045](https://roomle.atlassian.net/browse/RML-18045), 2026-10-05 | in effect — `withRowHints`, `rowReachHints`, `obstacleHint`, `tool-executors.ts`; guarded by `it('names a door the row stands in front of after the edit')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` |
| D49 | **A size is an attribute.** A root module of another size is the same article with its size attribute set (`mod_Width` 900) — in `create-or-replace-groups` and in the `attributes` of `merge-article-into-group`, `insert-article-into-group` and `exchange-root-module`. The catalog has one size per article: without the rule, gpt-5-mini asked back whether "a 900 mm cabinet with drawers" meant a tall or a base unit (MCP test of 2026-10-05) | [RML-18045](https://roomle.atlassian.net/browse/RML-18045), 2026-10-05 | in effect — `AUTHORING_RULES`, the `exchange-root-module` description, `hi-mcp-server.ts` |

### Words (2026-10-06)

| # | Decision | Source | State |
|---|---|---|---|
| D44 | **The served text speaks of articles and root modules, not of kitchens.** The catalog offers articles; a group is one piece of furniture made of articles — a kitchen, a wardrobe, a sideboard, a utility room —; an article placed in a group is a root module. Kitchens are named only where a rule is about them (the corner rules) and in the list of kinds; no tool description names one. `insert-article-into-group` inserts between two root modules that stand side by side, whatever the group and whatever the article — a low cabinet between two high cabinets or wardrobes too —, and a group of two root modules has one place to insert, no gap needed (the sentence that made gpt-5.4-mini reach the tool); the user decides what stands between what. An article named by its kind comes from the category of its neighbours where that category has one. The chat's system prompt names every kind of HI furniture and tells the model to take the closest article of the catalog when the request names a kind. Found with "insert a low cabinet between the high cabinets" on a wardrobe group: the agent looked for a kitchen run of high cabinets and found none | user, 2026-10-06 ([RML-18045](https://roomle.atlassian.net/browse/RML-18045)); guarded by `it('speaks of articles and root modules, not of kitchens, and inserts between any two root modules')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` and the test `edit-insert-low-between-high` of `docs/test-prompts.json` | in effect — `AUTHORING_RULES`, `INSTRUCTIONS`, the tool descriptions, `hi-mcp-server.ts`; `CHAT_SYSTEM_PROMPT`, `chat-config.ts` |
| D57 | **The code of the tools speaks of groups and articles, not of kitchens.** The names of functions and variables in `tool-executors.ts` do not use the word "kitchen": the MCP works with groups and articles, the products are furniture made of cabinets, and the result can be a kitchen or something else — `applyKitchenWideAttributes` became `applyGroupWideAttributes` | user, 2026-10-08 ([RML-18075](https://roomle.atlassian.net/browse/RML-18075), comment 155885) | in effect — `tool-executors.ts` |

### Obstacles (2026-10-06)

| # | Decision | Source | State |
|---|---|---|---|
| D45 | **What stands in the room is a default section of its own.** `get-plan-context` returns `obstacles`: the doors, windows and other plan objects of the kernel's obstacle map as floor outlines with their height range — `kind` door, window or object, no names: an obstacle is an obstacle —, and per HI group the room-space outlines of its root modules. The group outlines come from the parts of the calculated groups, not from the obstacle map: the kernel's outline of an HI group was 50 to 250 mm off on the ticket's plan. The walls of the map are left out — the `rooms` section has them, named and per room. Doors and windows lie behind the room boundary and only touch it, so an overlap test never flags them; the server gives each its wall and its span from the wall's end (C21), the terms of a placement. Root geometry stays out of `groups` (D15); the outlines in `obstacles` are read-only. A planner without the section returns none, and the tool works as before | [RML-18036](https://roomle.atlassian.net/browse/RML-18036) | in effect — `shapeObstacles` (roomle-ui `hi-plan-context.ts`), `agentFacingObstacles`, `wallOfOpening` |
| D55 | **The server tests the obstacles, and the result names what a root module stands on.** After the load of `create-or-replace-groups` and the reload of `place-group`, the server tests every root module of the groups of the call: does it overlap an object, a root module of another group (`create-or-replace-groups` only — `place-group` keeps G22), or the strip in front of a door or a window, within its height from `bottomMm` to `topMm` — base units below a window's sill and wall units above a door or a window are clear? The strip along a wall is 600 mm deep (`WALL_STRIP_MM`). The `hint` names each such root module, what it stands on or in front of, and the free stretches of its wall at its height as `fromEndMm` ranges; the group is built anyway — the user may want a cabinet in front of a window (D51). `place-group` does not move a group off an object, a door or a window; it names them in the `hint`. A root module's wall is the wall it faces away from, with its back within the strip; at a corner its rotation decides, and each leg of an L-shaped group has its own wall. The root modules come from the calculated groups, which carry their rotation, the objects from `obstacles`. A replaced group is told only what it did not stand on before (as D43). An object outline that is not convex is tested like its convex hull. | user | in effect — `obstacleHint`, `objectBlockers`, `tool-executors.ts`; `rootVolumesInRoom`, `stripInFrontOfWall`, `wallOfRoot`, `freeStretchesAlongWall`, `convexHull`, `plan-space.ts`; guarded by `describe('obstacle hints')` and `it('names an object the placed group stands on')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts`, the tests of these five functions in `hi-mcp/hi-mcp-server/tests/plan-space.test.ts`, `it('tells the agent what stands in the room and that the hint names a root module on an obstacle')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts`, and the tests `obstacle-window-back-wall`, `obstacle-back-wall-beside-the-sofa` and `obstacle-island-free-spot` of `docs/test-prompts.json` |

### Flexibility (2026-10-07)

| # | Decision | Source | State |
|---|---|---|---|
| D51 | **The tools do not restrict the agent, and they always say what happens.** The goal is not to restrict the agent but to be as flexible as possible: a tool carries out what the agent asks wherever the planner can. What happens has to be clearly specified at all times — in the tool description before the call and in the result after it | user, 2026-10-07 ([RML-18065](https://roomle.atlassian.net/browse/RML-18065)) | in effect for every new or changed tool |
| D52 | **`delete-article-and-compact` of a corner article closes the gap.** It deletes a corner article between two legs like every other root module: its two neighbours are docked to each other, so one leg turns by 90° and the legs form one straight row. The units above the turned leg turn with it. The end of the row at a wall keeps its place (D41), so the other leg may move along its wall. The description says so before the call; after it, the correction names the leg that turned and the leg it is docked to, and the row hint names the wall units that moved (D42, D51). Rejected: a kernel deletion of a corner article instead — it splits the group into its docked clusters, so each leg and each cluster of wall units becomes a group of its own; the two legs can be docked to each other once one of them turns | user | in effect — roomle-ui `removeArticleFromGroup`, `moveUnitsAboveWithTheirCarriers`; `hi-mcp-server.ts`; guarded by `it('removes a corner article by turning one leg with the units above it and docking it to the other')` in roomle-ui `glue-logic-test.ts` and the test `edit-remove-corner-unit` of `docs/test-prompts.json` |

### New root modules (2026-10-08)

| # | Decision | Source | State |
|---|---|---|---|
| D56 | **A new root module inherits from its neighbour, whatever the tool.** As an article added in the planner, a root module added to a group takes the attributes the library passes on between neighbours — those the master data marks `implicitRelevant`, as input values of the neighbour (Furniture_Smith: fronts, handles, carcase, plinth height, baseboard, ceiling filler; not the worktop and toe kick colours, which belong to the generated roots) — through the planner's own `_applyImplicitRelevantAttributes`. The neighbour: `dockTo.rootId` for `merge-article-into-group`, the first root module of `between` for `insert-article-into-group`, the replaced root module for `exchange-root-module`, and for a root a replace adds the root it is docked to, as the call sends it — several added roots in a chain inherit in docking order from the roots already in the group. The attributes sent with the new root module override the inherited ones. The descriptions of the four tools and the rules say so (D51); the returned group shows the inherited values as the new root module's input attributes. `merge-groups` keeps the planner's merge | user, 2026-10-08 ([RML-18075](https://roomle.atlassian.net/browse/RML-18075), comment 155885); guarded by `it('gives a new root module the implicitRelevant input attributes of its neighbour, and a sent attribute wins')` in roomle-ui `glue-logic-test.ts` and `it('tells the agent that a new root module inherits the attributes of its neighbour')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` | in effect — the descriptions and `AUTHORING_RULES` (`hi-mcp-server.ts`); roomle-ui `_inheritNeighbourAttributes`, `_inheritAttributesOfAddedRoots`, `glue-logic.ts` ([RML-18075](https://roomle.atlassian.net/browse/RML-18075)) |

### Delete edits (2026-10-08)

| # | Decision | Source | State |
|---|---|---|---|
| D58 | **The delete edits are named by their outcome, and the default leaves the gap.** `delete-article-in-place` deletes an article and leaves the gap; `delete-article-and-compact` deletes an article and closes the gap. "Delete" and "remove" mean the same: the tool is `delete-article-in-place`, unless the user asks to close the gap. The names speak of articles, as the plan context and the other edits (`merge-article-into-group`, `insert-article-into-group`) do. Each description opens with its outcome and the case it is for, and points to the other tool by the outcome; the result and the planner's corrections name the tool, not the planner command, which keeps its name. The names carry the outcome, not the user's word: the two verbs are near-synonyms to the models, and a description or a name that differs only in the verb does not tell them apart. The descriptions carry the selection, because the HI chat reads the tool list, not the rules (§4). Rejected: a higher reasoning effort — the served text has to work at the effort the user runs; and a check of the call — the server cannot tell from it which word the user said | user | in effect — the descriptions, `AUTHORING_RULES`, `INSTRUCTIONS`, `hi-mcp-server.ts`; `asTool`, `tool-executors.ts`; guarded by `it('names the delete edits by their outcome and leaves the gap by default')` and `it("no longer names a delete edit by the user's word")` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts`, `it('%s forwards the planner command %s and names itself in the result')` and `it('%s names itself, not the planner command, in the corrections of the planner')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts`, and the tests `edit-delete-unit`, `edit-remove-unit` and `edit-remove-next-to-corner` of `docs/test-prompts.json` |

### Library changes (2026-10-08)

| # | Decision | Source | State |
|---|---|---|---|
| D59 | **The library's own changes are named.** After `change-module-attribute`, `change-group-attribute` and the group attributes set after a create or a replace (D36), the server compares the input attributes of the root modules before and after. Every other attribute whose value changed — a front program switched by a front colour, a front colour reset by a front program — and a set attribute that a root module the command set it on ends with another value of are named in `corrections`, with the value descs of the master data, the root modules changed alike in one sentence. The library ties attributes together only in its calculation, not in the master data (Furniture_Smith: the stone decors 316, 326, 324 and 380 come only with the front program Modern, mitred frame fronts with glass filling), so the agent learns it from the result. The rules and the descriptions of the two commands say so; the served text no longer calls the values "allowed values". After a create, the sentence names "its group attributes" as the cause (D65) | [RML-18094](https://roomle.atlassian.net/browse/RML-18094) | in effect — `findLibraryChanges`, `libraryChangeSentences`, `withLibraryChanges`, `applyGroupWideAttributes`, `tool-executors.ts`; guarded by `describe('library changes')` and `it('names the colour the library reset with a group front program')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` |
| D60 | **Keep the fronts, not the colour.** The front program says how a front is built; the agent chooses it by its desc first, then the colour. When the colour the user wants comes only with fronts built differently — dark marble only as mitred frame fronts with glass filling —, the agent keeps the fronts the user wants: it undoes a switched program, takes the closest colour their program offers and tells the user which fronts the wanted colour comes with. Rejected: loading a program and a colour together that the library's rules never produce — the planner renders it, but the next attribute change of that root module switches the program | the plan of [RML-18094](https://roomle.atlassian.net/browse/RML-18094), option (a), implemented on the user's go, 2026-10-08 | in effect — the Fronts rule of `AUTHORING_RULES`, `hi-mcp-server.ts`; guarded by `it('tells the agent that the front program says how a front is built and that a colour can switch it')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` |

### Speed (2026-10-08)

Decided with the plan of [RML-18064](https://roomle.atlassian.net/browse/RML-18064): every model step
costs a fixed 4–5 s, so the tools save steps and the agent's context.

| # | Decision | Source | State |
|---|---|---|---|
| D62 | **An attribute command answers with what changed.** `change-module-attribute` and `change-group-attribute` return `{ command, groupIds, changedModuleIds, corrections? }`, not the changed group: the agent knows what it set, and `get-plan-context` shows the group. The structural commands keep the whole group, because the agent needs its new root ids. `change-module-attribute` takes `rootModuleIds`, one or more root modules of one group or of several — the accent fronts of a kitchen in one call; the server sends one `change-attributes` per group, with `moduleId` one `change-module-attribute` per root module, names each group they changed once in `groupIds`, and names a root module it could not change in `corrections`. Rejected: compacting every command result — the agent would read the plan context after every structural edit | user, 2026-10-08 | in effect — `compactAttributeResult`, `rootModulesByGroup`, `tool-executors.ts`; roomle-ui `changeAttributes`, `glue-logic.ts`; guarded by `describe('attribute tools')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` |
| D63 | **The catalog describes an article in one or two sentences.** `get-plan-context` shortens a description written in sections (FUNCTION:, PURPOSE:, …, AI_SELECTION_HINT:) to its FUNCTION and AI_SELECTION_HINT lines — what the article is and when to pick it; a description without these sections stays as it is. The full descriptions are in the section `articleDescriptions`, returned only on request. The nine sections of the Furniture_Smith articles were half of the catalog, and the catalog nine tenths of what every later model step sends again. Rejected: the hint alone — the function line says what the article is; filtering the catalog by category — the agent would have to know the category before it reads the catalog | plan of RML-18064 | in effect — `shortDescription`, `agentFacingArticle`, `tool-executors.ts`; guarded by `describe('article descriptions')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` |
| D64 | **One search finds the material.** `find-attributes` matches every word of the text on its own, in any order, and reads colour/color, grey/gray and worktop/countertop alike — the library spells "Front color" and "Countertop", the agent often "front colour" and "worktop". A value list several attributes share is listed once; the later attributes carry `sameSelectionsAs`, the attribute that lists it. Every match names the root modules that carry it with their id and name — the worktop's colour is the colour of the root module Countertop, the panel top's that of Top panel, both attributes named Color —, and the attributes the root modules in the plan carry come first: a group with a worktop has no panel top. Rejected: a synonym list of its own — every entry is a guess about the library's words; fuzzy matching — more matches, more tokens | plan of RML-18064 | in effect — `searchWords`, `attributeMatches`, `withSharedSelectionsOnce`, `tool-executors.ts`; guarded by `describe('words')` and `it('lists the attributes the root modules in the plan carry first, and names the root modules')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` |
| D65 | **The group attributes of a create are reported apart, not as corrections.** The create result names per group the attributes set on every unit and those no unit of the group carries in `groupAttributes` — the library builds no part for them in this group, a backsplash or an end panel for example; the group stands without them, nothing to undo, and the description asks the agent to say in its answer which material is not built; `corrections` keeps what the server changed in the input and what the library changed. A library change after a create names "its group attributes" as its cause, once per change, instead of listing every attribute of the call | plan of RML-18064 | in effect — `applyGroupWideAttributes`, `libraryChangeSentences`, `tool-executors.ts`; guarded by `describe('create-or-replace-groups materials')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` and `it('asks the agent to say which group material the library does not build')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` |

### Rows and results (2026-10-08)

Decided with the backlog of the MCP test, implemented on the user's go.

| # | Decision | Source | State |
|---|---|---|---|
| D66 | **A root module of a row carries its place in it.** Every root module docked side by side with another one gets `rowIndex`, its place in its row, 1 at the left end as seen from the front; floor units and wall units form rows of their own, and a corner article joins the two legs into one row. The roots are listed in the order they were added — an inserted root module last —, so "the middle unit" is read from `rowIndex`, not from the order. Every group a tool returns in the plan-context shape carries it; it is read-only and ignored when the group is resubmitted (C2). A root module beside no other one, and a row closed into a ring, get none. Rejected: listing the roots in row order — the first root is where the planner starts its arrangement, and a resubmitted group would change | user, the MCP test backlog | in effect — `withRowIndices`, `inPlacementFrame`, `tool-executors.ts`; the description of `get-plan-context` and `AUTHORING_RULES`, `hi-mcp-server.ts`; guarded by `it('gives every root module of a row its place in the row, counted from the left end')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` and `it('tells the agent the place of a root module in its row')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` |
| D67 | **Several attributes of a group in one call.** `change-group-attribute` takes `attributes: [{ attributeId, value }]` beside the single `attributeId` and `value`, and sends them as one `change-attributes` command — one calculation, one undo step —, the program attributes first (D36). An attribute no module of the group has is named in `corrections`; the others are set. One attribute alone stays the planner's `change-group-attribute` command | user, the MCP test backlog | in effect — `change-group-attribute`, `tool-executors.ts`; the schema and description, `hi-mcp-server.ts`; guarded by `it('sets several attributes of a group with one planner command, the programs first')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` |
| D68 | **A create, an undo and a redo answer with the groups they changed.** `create-or-replace-groups` returns the groups of the call in the plan-context shape and `otherGroupIds`, the other groups of the plan; `undo` and `redo` return the groups the reverted call changed as they are now, `removedGroupIds` for the groups they took out of the plan, and `otherGroupIds`. The agent knows the other groups already; every later step of the turn would send them again. An `undo` or `redo` that reverts nothing still returns every group | user, the MCP test backlog | in effect — `changedGroupsOnly`, `changedGroupIds`, `revertToolCall`, `tool-executors.ts`; guarded by `it('answers a create with the groups of the call and the other groups by their id')` and `it('returns the groups the reverted call changed, and the others by their id')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` |
| D69 | **A value the library cannot calculate a root module with is left out on that root module.** When the library cannot calculate a root module with the values of a `change-attributes` — the upright colour `192` on an end panel `W60H`, for example —, the planner sets the values again on every other root module, in one load, and names the root modules that keep their previous values in `corrections`; when no root module can take them, the group stays as it was. The planner restores a group it cannot calculate (P-checks stay, D5), so one root module does not cost the others their values. The server passes the correction on — after a create prefixed with `posGroups[i]` | 2026-10-09, user | in effect — roomle-ui `changeAttributes`, `discardedRootModuleIds`, `glue-logic.ts`; `applyGroupWideAttributes`, `tool-executors.ts`; guarded by `it('sets the attributes on the other root modules when the library cannot calculate one of them with them, and names it')` in roomle-ui `glue-logic-test.ts` and `it('passes on the root module the library could not calculate with the group attributes')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` |
| D70 | **`place-group` places a group by its measure at the new place.** The library builds a group for its place — at a wall it widens the units at the end of a row to reach the wall —, so a group measured at its old place can be wider or narrower at the new one. After the reload the server measures the group as built there and, when it does not stand as asked, places it once more by that measure; what that measure finds — an overlap with another group at the new place — is reported instead of what the first measure said | 2026-10-09, user | in effect — `place-group`, `tool-executors.ts`; guarded by `it('places the group once more by its measure at the new place when the library builds it there with another width')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` |

## 4. How a tool call runs

- **MCP endpoint**: `POST /mcp` — Streamable HTTP, JSON response mode, stateless (a new transport per
  request), port 3100 (`HI_MCP_PORT` or `PORT`). On Cloudflare, `?session=` routes to a per-session
  container. Browser chats include `?client=<page ID>`; requests with an ID other than the active
  page's are refused with HTTP 409, including `tools/list`. External MCP clients without a page ID
  can still call tools against the currently connected page.
- **Page bridge**: the page connects to the WebSocket `/bridge` (origins in `HI_MCP_PAGE_ORIGINS`),
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
  | `getExternalObjectPlanContext(include)` | every tool that reads the plan | 30 s |
  | `loadExternalObjectGroupLayout(layout, 'posGroups', { reason: 'adjusted' })` | `create-or-replace-groups` (and its reload of the groups placed by wall), `place-group`, the anchor probe | 120 s |
  | `externalObjectGroupOperation(command, payload)` | the command tools | 120 s |
  | `getExternalObjectGroups()` | `place-group`, a placement by wall, the anchor probe, the position of every returned group (calculated geometry), the plan before and after a tool call that changes it (D38) | 30 s |
  | `undo()` | `undo`, the anchor probe (undoes its load) | 30 s |
  | `redo()` | `redo` | 30 s |
  | `removeExternalObject(id)` | the anchor probe, for a probe group its undo left in the plan (a page without `undo`) | 30 s |
  | `fetchPrice()` | `get-price` | 30 s |
  | `getExternalObjectSnapshot(options)` | `get-order-data`, `get-plan-images` | 120 s |

- **One plan change at a time.** The tools that change the plan wait for each other (D4). The anchor
  probe tells its own groups by comparing the plan before and after its load, and a concurrent load
  would disturb that. `get-plan-context` waits with them: it reads the plan context and the calculated
  groups its positions come from, and both reads see the same plan. `undo` and `redo` wait with them
  too: an undo never runs beside another plan change.
- **Every tool call that changes the plan is recorded** (D38): a planner API that counts the steps
  the call puts on the planner's undo history — one per load that loaded something, per group
  command and per removal, minus one per undo — reads the raw groups before the first step and after
  the call. The group-wide attributes of a create are one group command, one step (D36). After `change-module-attribute`, `change-group-attribute`, `change-attributes`, `exchange-root-module`, `insert-article-into-group` and `swap-root-modules`, and after a
  `delete-article-and-compact` that closed the gap (`gapClosed`) —
  also the group-wide attributes of `create-or-replace-groups` — it waits until the command has
  produced its second history event, the follow-up reload roomle-ui makes when the kernel answers
  with the group's position, at most 2 s; a page that relays no history events gets no wait. A call
  whose follow-up has not arrived by the end of the call — a follow-up that lands after the wait,
  while the call still reads the plan, counts as arrived (guarded by `it("takes a follow-up that lands after the wait, while the call still reads the plan, as the call's own")` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts`) —
  is recorded as unsettled, and its late reloads, when they arrive, are the call's own — as many as are outstanding, so the group-wide attributes of two groups of a `create-or-replace-groups` whose reloads both land late count both. The history events while a call runs are its own; any other one is a
  change in the planner. The first planner step of a call ends redo, as the planner drops its redo
  future with it — also when the call leaves no step in the end (a probe load undone, then a failed
  load).
- **The HI chat** (`hi-mcp-chat`) is an MCP client of this server. It gives the model a
  five-sentence system prompt (`CHAT_SYSTEM_PROMPT`, `chat-config.ts`) — the first names what HI
  plans, "kitchens, wardrobes, living room and utility furniture, all made of articles", not "a
  kitchen", which made a wardrobe group look foreign to the model (D44); the fourth tells it to
  take the closest article of the catalog when the request names a kind of article, and to say
  which one, instead of asking; the fifth asks it to summarise what it changed from the last tool
  results only, never by repeating them, and to name what was asked but is not in the plan — and **not** the server's instructions, so the model learns the rules only when it calls
  `get-authoring-rules`. A chat turn has 16 steps; the last one cannot call a tool, so the turn
  always ends with an answer (`chat-steps.ts`). A turn that has not answered after
  `HI_CHAT_TURN_TIMEOUT_MS` (5 minutes) is aborted and ends with "[error] the turn took longer than
  … minutes and was ended - the plan holds what the tools changed so far"; every step logs its
  tokens (in, out, reasoning), its tool calls and its duration, and a step that fails its number with
  what the provider answered — per cause the error, the HTTP status, the url, the provider's request id
  and the body, text or value the AI SDK could not process (`createStepLog`, `describeStepError`); gpt-5.4-mini and gpt-5-mini plan at
  reasoning effort `high` ([RML-18043](https://roomle.atlassian.net/browse/RML-18043)),
  `HI_CHAT_REASONING_EFFORT` overrides it for every GPT deployment ([RML-18041](https://roomle.atlassian.net/browse/RML-18041)). The example page sends its
  bridge `clientId` with every `/chat` request; the chat backend requires it and connects to
  `/mcp?client=<clientId>` (retaining any `session` query). The example disables chat submission
  until the bridge sends `ready`, and again when it closes or refuses the page.

## 5. Information the server provides

### 5.1 Server instructions (at initialize)

`INSTRUCTIONS` (`hi-mcp-server.ts`) says first what everything is made of — the catalog
offers articles, a group is one piece of furniture made of articles (a kitchen, a wardrobe, a
sideboard, a utility room), an article placed in a group is a root module (D44) — and contains the
typical workflow followed by the full authoring rules:

1. `get-plan-context` — rooms with walls, the article catalog, the groups, the obstacles; `masterData` or
   `find-attributes` for attributes.
2. `create-or-replace-groups` — the whole piece of furniture as one group: article picks, docking,
   one placement. A matching id replaces a group and keeps its position. Units next to an existing
   group are added to it.
3. The command tools to edit an existing group; `place-group` to move one; `undo` reverts the last
   tool call that changed the plan, `redo` brings it back.
4. `get-price` / `get-order-data` to check, `get-plan-images` to inspect.

Not every client passes these instructions to the model; the HI chat does not (§4).

### 5.2 Authoring rules (`get-authoring-rules`)

`AUTHORING_RULES` (`hi-mcp-server.ts`) is plain text. It is served at initialize and by the
tool. It covers:

- **Words** (D44): the catalog offers articles; a group is one piece of furniture made of
  articles — a kitchen, a wardrobe, a sideboard, a utility room, a row of cabinets; an article
  placed in a group is a root module, which the user may call a cabinet, a unit or a module; the
  kind of an article follows the catalog's category and dimensions (a high or tall cabinet or a
  wardrobe about 2000 mm high, a low cabinet or base cabinet 720 mm); the user decides which
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
- **Relations**: every root after the first names one neighbour — `rightOf`, `leftOf`, `onTop`
  (`align`, `gapMm`), `above` (`gapMm`), `behind`; wall units beside a tall unit, corner kitchens,
  and the default for a root without a relation (D34).
- **Docking vectors**: how to read the `contextData` of a group from `get-plan-context`, and the
  vectors `merge-article-into-group` names in `dockTo`.
- **Placement** (D23): by wall, alignment and offset at a wall or in a room corner — the server
  computes the point —, by point and rotation anywhere else and for a group of wall units only; the
  walls array for the point form; which leg of a corner group runs along which wall, as seen from
  the room.
- **Obstacles** (D45, D55): what the `obstacles` section lists, a door's or a window's wall and span
  from the wall's end, that a new group goes on a stretch of wall or a spot `obstacles` leaves free —
  a stretch by alignment `end` and `offsetMm` = the start of its `fromEndMm` —, that base units lower than a window's `bottomMm` fit
  below it, and that the result's `hint` names every root module on an obstacle with the free
  stretches of its wall.
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
- **`get-plan-images`** returns two image contents (PNG): the perspective and the top view.
- **`get-authoring-rules`** returns the rules as plain text.
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
| `rooms` | `{ rooms: [{ levels, walls }] }`. `levels`: the contour per level, segments with `cmd`, `pos`, `type` (e.g. `wall`, or none for an opening), `height`, `thickness`. `walls`, derived per room by roomle-ui from the direction of the contour, which runs counter-clockwise with the room on its left (D61): `index`, `side` (as seen in the top view), `name` (back wall, front wall, left wall, right wall), `start`/`end` (`[x, 0, z]` on the floor), `lengthMm`, `type` (`wall`, or `opening` for a door — the contour gives it no type), `heightMm`, `thicknessMm`, `facingRotationY` — the rotation of a group with its back against that wall. `corners`, per room: `name` (back left, back right, front left, front right), `point` and `posRotationY` — the rotation of a corner kitchen in that corner. The server adds the names, the opening type and the corners (C18) |
| `articles` | The catalog: `articleId`, `articleName`, `desc` — of a description written in sections its FUNCTION and AI_SELECTION_HINT lines (D63) —, `category`, `libraryId`, `catalog`, `cornerArticle`. Per root module: `module` (id, name, desc), `dimensions` (size attributes with id, name and value in mm), `mainAttributes`, `dockingVectors` (names), `insertLevels`, `subModules` (id, name, desc). The server sets `cornerArticle` also on an empty plan (from the category or the module name) and removes `cornerPoint` (D10) |
| `groups` | Per group: `id`, `libraryId`, `attributes`, read-only `position` (`pos`, `rotationY`, `footprint` with `x`, `z`, `widthMm`, `depthMm`), and `roots`. `pos` and `rotationY` are what a placement would name for the group where it stands: `pos` the room point of its back left bottom corner — the docking corner of its anchor root — and `rotationY` the rotation of the placement; the footprint is measured from `pos`. A group with two corner articles also carries `rootId`, the corner article `pos` belongs to, as in a placement (D17): the planner regenerates root ids, so the corner a placement named cannot be told after the load. The server derives them from the planner's calculated groups, wherever the planner keeps the group origin (D33); a group the planner has not positioned keeps the planner's `position`. Per root: the article pick (`id`, `articleId`, input `attributes`, `contextData` with vector names only) and read-only facts (`articleName`, `desc`, `category`, `isGenerated`, `dockingVectors`, `freeDockingVectors`, `subModules` with their id, and `rowIndex` — its place in its row, 1 at the left end as seen from the front, added by the server, D66). The roots are listed in the order they were added. No root positions, no geometry |
| `masterData` | Only when requested. Per library id: the root modules (`id`, `name`, `desc`, assigned attribute ids) — the article roots and the roots the library generates (worktop `mr_Countertop`, toe kick, finger grip, backsplash, …: the sub modules of the master data's `Root` group), so the worktop colour `mod_CountertopColor` is found — and the customer-facing attributes (`id`, `name`, `desc`, `type`, `group`, `selections` with value, name and desc; the desc of a colour value carries its code, e.g. `Cloudy blue (#506080)`, D53) — and `groupSettings`, the attributes the library's group orchestrator sets on a group (D36; planned, D48) |
| `articleDescriptions` | Only when requested. Per article `articleId` and its full `desc` (D63) |
| `obstacles` | `{ objects, groups }`. `objects`: every plan object that is not an HI group — `kind` (`door`, `window`, `object`), `outline` (floor points `[x, 0, z]`) and `bottomMm`/`topMm`; a door or a window also `roomIndex`, `wall` (its index in the walls array) and `fromEndMm`, its span along that wall measured from the wall's end (C21). `groups`: per HI group its `id` and per root module that is not generated its `id`, `outline` (four floor points in room space) and `bottomMm`/`topMm`, from the parts of the calculated group (D45). No walls |

Default sections: `rooms`, `articles`, `groups`, `obstacles`. Requested without `rooms`, `obstacles` makes the server fetch
the rooms too, for the walls of the doors and windows, and return only `obstacles`.

### 5.5 What the agent is not given

| Withheld | Why |
|---|---|
| `imageUrl` everywhere | The agent cannot open them, and they cost three quarters of the tokens (D7) |
| Root positions and geometry in `groups` | Root positions come from the docking (D15); the read-only root outlines of `obstacles` are the exception (D45) |
| Articles' `cornerPoint`, `repositioningData`, the anchor frame | Internal to the server's placement (D10) |
| Parts and log messages of the groups | Not needed, and large (D9) |

## 6. Tools

| Tool | Changes the plan | Result |
|---|---|---|
| `get-plan-context` | no | the plan context (§5.4) |
| `find-attributes` | no | `{ matches, total, hint? }` |
| `get-authoring-rules` | no | the rules as text |
| `create-or-replace-groups` | yes | `{ loaded, groups, otherGroupIds?, groupAttributes?, hint? }` |
| `place-group` | yes | `{ placedIn, wall, group }` |
| `change-module-attribute`, `change-group-attribute` | yes | `{ command, groupIds, changedModuleIds?, corrections? }` (D62) |
| `delete-group`, `delete-article-in-place`, `delete-article-and-compact`, `merge-article-into-group`, `insert-article-into-group`, `exchange-root-module`, `swap-root-modules`, `merge-groups` | yes | `{ command, groups, removedGroupIds, changedModuleIds?, gapClosed?, corrections?, hint? }` |
| `undo`, `redo` | yes | `{ undone \| redone, groups, removedGroupIds?, otherGroupIds?, hint? }` |
| `get-price` | no | the planner's price result |
| `get-order-data` | no | the order data, or `null` |
| `get-plan-images` | no | two images |

### get-plan-context

| Parameter | Type | Default |
|---|---|---|
| `include` | `('masterData' \| 'rooms' \| 'articles' \| 'articleDescriptions' \| 'groups' \| 'obstacles')[]` | rooms, articles, groups, obstacles |

The server passes the planner's plan context through. In the articles it sets `cornerArticle`,
removes `cornerPoint` (C7) and shortens a sectioned description (D63); `articleDescriptions` carries
the full ones, read from the planner's articles. Every door and window of the obstacles gets its
wall (C21).

### find-attributes

| Parameter | Type | Default |
|---|---|---|
| `text` | non-empty string | — |
| `libraryId` | string | all libraries |

The server searches the compacted master data case-insensitively: attribute id, name, desc, group,
and per selection its name, desc and value. Every word of the text has to be in one of these fields,
and colour/color, grey/gray and worktop/countertop read alike (D64). A match is the attribute with
its `libraryId` and the `rootModules` that carry it, each `{ id, name }`; a value list an earlier match already lists is
replaced by `sameSelectionsAs`, the id of that attribute. The attributes the root modules of the plan's
groups carry — among their input attributes — come first, the others after them in the order of the
master data (D64). It returns at most 20 matches, the
`total`, and a `hint` to narrow the text when there are more. The desc of a colour value carries its code, and the description tells
the agent to choose a dark, a light or a blue value by it (D53).

### get-authoring-rules

No parameters. Answered by the server without a planner call, so it works without a connected page.

### create-or-replace-groups

| Parameter | Type |
|---|---|
| `posGroups` | non-empty array of pos groups (§5.2) |

A group whose id is in the plan is **replaced** and keeps its position (the planner keeps root ids
that already exist); a root module the replace adds inherits from the root module it is docked to
(D56). Every other group is **created** with regenerated ids, and the docking references are
remapped.

The server runs these steps:

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
4. For every group placed by point, it learns the frame of the anchor — its docking corner and, for a corner
   article, its turn — by a probe load, once per library, article and attribute set (C6, G17).
5. It turns the placement by point into the planner's repositioning of the anchor root (C5, C6). The group
   reaches the planner with `id`, `libraryId`, `roots`, `attributes` and the repositioning.
6. It loads the groups that can be built in one call with `reason: 'adjusted'`, reads the groups,
   and adds a hint for a group of the call that has no position. For a replace it reads the
   calculated groups before the load (D55).
7. It moves the groups placed by wall to their walls (D23): it matches the groups of the call to
   the plan's groups once, computes each target from the calculated group as `place-group` does —
   an overlap with another group, or with a group of the call already at its target, moves it
   along the wall (G22) —, and reloads them in one call (G58–G60).
8. It sets the group-wide attributes (D36) — the group attributes that are not among the library's
   group settings (`groupSettings` of the master data; without them, the attributes the loaded
   group lists), the overrides moved off the roots (G47) and the colours of the generated roots it
   dropped (G48) — on every unit of the group with one planner command, `change-attributes`
   (G46), the programs first and a root module's own value after the group's, after a create and
   after a replace, and reads the groups again.
9. It tests the root modules of the groups of the call against the obstacles and the other groups
   and adds the `hint` of D55.

A group that cannot be built at one of these steps leaves the call and goes to `notLoaded`; the
others go on.

**Result**: `loaded` (the planner's runtime ids), `groups` (the groups of the call, in the
plan-context shape), `otherGroupIds` (the other groups of the plan, unchanged — D68), `groupAttributes` (per group of the call `{ index, id, set, notCarried?, rootValues? }`: the group attributes set on every unit, those no unit of the group carries — D65 —, and the root modules that keep their own value of one, `{ id, value, rootModuleIds }` — D36), `hint` (an unpositioned group, a root module on an obstacle — D55), `corrections` (what the server changed in the input, and what the library changed with the group attributes — D59), and `notLoaded`
— `[{ index, id?, rootIds?, errors }]` for the groups it could not build (D30) and, with `rootIds`,
for the roots of a loaded group it could not build (G15). A conflicting placement is not sent (D26).

### place-group

| Parameter | Type | Default |
|---|---|---|
| `groupId` | id or unique prefix | — |
| `wall` | `left` \| `right` \| `top` \| `bottom` \| `back` \| `front` \| wall index | — |
| `alignment` | `start` \| `center` \| `end` \| side label of an adjoining wall | `center` |
| `offsetMm` | number, along the wall | 0 |
| `roomIndex` | integer | 0 |

The server finds the group (G18) and the wall (G19, G20): a side label means the longest wall of
type `wall` on that side. It reads the calculated group (G21) and computes the position:

- **into the corner** — when the alignment names an adjoining wall and the group has a corner
  article: its corner point goes into the corner the two walls share, and its back edges run along
  them
- **against the wall** — otherwise, by its footprint

The group keeps its height. The server checks the target against the other groups (G22) and reloads
the group once, with its roots — the generated ones included —, its group attributes and its docking
(C1), a unit above docked to the unit below it again (C24). A group that
already stands where asked is not reloaded. The same logic places a new group by wall in
`create-or-replace-groups` (D23).

**Result**: `placedIn` (`corner` or `wall`), the `wall`, the resulting `group`, `corrections`
when the server corrected the request — an overlap moves the group along the wall (D27), an
alignment parallel to the wall centres it —, and a `hint` when a root module stands on an object or
in front of a door or a window after the reload (D55).

### The command tools

Each command tool forwards one command to the planner (`externalObjectGroupOperation`), which edits
the group with its own features and answers once the result is loaded. The group keeps its
position.

| Tool | Parameters | Server before forwarding | Planner |
|---|---|---|---|
| `change-module-attribute` | `rootModuleIds` (or one `rootModuleId`), `moduleId?`, `attributeId`, `value` | resolves every root id (C17); sends one `change-attributes` per group of the root modules, with `moduleId` one `change-module-attribute` per root module (D62) | sets the attribute on the root modules and on their sub modules that carry it, or with `moduleId` on that one sub module (D54, P1, P2); a root module it could not change, and the attributes the library changed with it, are named in `corrections` (C22) |
| `change-group-attribute` | `groupId`, `attributeId` and `value`, or `attributes [{ attributeId, value }]` | resolves the group id (G18, C23); one attribute: the planner command `change-group-attribute`, several: one `change-attributes`, the programs first (D67) | sets them on every module that has them (D20, P3); an attribute of the list no module has is named in `corrections`; the attributes the library changed with them are named in `corrections` (C22) |
| `delete-group` | `groupId` | resolves the group id | deletes the group |
| `delete-article-in-place` | `rootModuleId` | resolves the root id (C17) | deletes the root module and leaves the gap: root modules no longer docked together become separate groups where they stand (P4, D40) |
| `delete-article-and-compact` | `rootModuleId`, `groupId` optional | resolves the group id and the root id (C17); without `groupId`, the group that holds the root module (G54) | deletes the root module and closes the gap; a root module with a neighbour on one side only is deleted and nothing else moves; a corner article between two legs is deleted and the gap closed by turning one leg by 90° with the units above it, the correction names the leg (D52); the only root module is deleted with its group, reported with `gapClosed: false` (D40, P4) |
| `merge-article-into-group` | `groupId`, `articleId`, `attributes?`, `dockTo { rootId, ownDockingVector, dockingVector, mode?, offset? }` | resolves the group id and `dockTo.rootId` (C17), reads the article id in the catalog's spelling (G15), moves an occupied side to the free end of the row (D29), derives a missing partner vector (P7) and the hang gap of a wall unit on a floor unit (D35) | docks the article as a new root module, which inherits from `dockTo.rootId` (D56) (P5–P8) |
| `insert-article-into-group` | `groupId`, `articleId`, `attributes?`, `between [rootId, rootId]` | resolves the group id and the root ids (C17), reads the article id in the catalog's spelling (G15), inserts beside the first-named root when the two are no neighbours (C19, G52) | docks the new root module between the two, whatever the group and the article (D44); it inherits from the first root of `between` (D56); the root modules at a wall stay (D41, P14, P16) |
| `exchange-root-module` | `groupId`, `rootModuleId`, `articleId`, `attributes?` | resolves the group id and the root id (C17), checks the article (G15) | replaces the root module; the new one keeps its docking and inherits from the replaced one (D56); `attributes` override attributes of the new root module, e.g. another width, and the other root modules move by the difference; a docking the new article cannot take is named in `corrections` (P9, C20) |
| `swap-root-modules` | `groupId`, `rootModuleIds [rootId, rootId]` | resolves the group id and the root ids (C17); one root twice is an error (G53) | the two root modules change places with their attributes and the wall units above them (D42, P15) |
| `merge-groups` | `targetGroupId`, `groupIds` | resolves every group id | merges where they stand: nothing is moved, no docking is added (P10) |

`value` is a string, a number (passed on as its string) or a boolean. **Result** of the two
attribute commands: `{ command, groupIds, changedModuleIds?, corrections? }` (D62). **Result** of
the others: `{ command, groups, removedGroupIds, changedModuleIds?, gapClosed? }` — the affected groups in the plan-context
shape, and for `delete-article-and-compact` whether the gap was closed — plus `corrections` when the server corrected the input before forwarding, followed by the planner's corrections, each named by its tool (C20), and after an attribute command the attributes the library changed besides the one set (C22).

### undo, redo

No parameters. `undo` reverts the plan change of the last tool call that changed the plan; `redo`
brings back the call the last `undo` reverted (D38). The description of `undo` says when to use it — a result that is not
what was asked, then the corrected call — because a client that does not pass the server's
instructions on, like the HI chat (§4), shows the model only the tool list.

1. No record → the tool name is `null` and a `hint` says why: nothing to undo or redo, or the plan
   was changed in the planner after the last tool call.
2. `undo` of an unsettled call waits up to 2 s for its late follow-up reloads; while one is still
   outstanding, nothing is undone and the `hint` says so — an undo before the reload would make
   the reload a step of its own. Once it has arrived, the plan then is the call's plan after.
3. The plan must be as the call left it — the raw groups compared to the tenth of a millimetre —,
   else the records are forgotten and the result is the planner hint.
4. One planner `undo()` or `redo()` per step of the call, each confirmed by its history event
   within 1 s; a missing event — the planner's history was cleared, e.g. by a plan load — forgets
   the records and says so.
5. The plan must now be the plan before (for `undo`) or after (for `redo`) the call. If it is not
   — the user changed the plan in the planner while the call ran, so that change sits among the
   call's steps —, the same number of steps is taken back in the other direction, the records are
   forgotten, and the `hint` says so. A wrong revert is never left in place.
6. The call moves to the other list. The result names the tool and returns the groups the call
   changed — by the plan before and after it — as they are now, in the plan-context shape,
   `removedGroupIds` for the groups the revert took out of the plan, and `otherGroupIds` for the
   others (D68). A result that reverted nothing returns every group of the plan.

The first planner step of a new tool call ends redo, as in the planner. The records live in the
server process and start over when a page is accepted. Not covered: the planner's configurator
mode, where `undo()` acts on the configurator's history — the tool then sees no history event and
answers that the history no longer holds the call, though a configurator step may have been undone;
and the planner's own redo button after a `create-or-replace-groups` whose load failed after the
anchor probe was undone — the planner keeps the probe load as its redo future, and its redo button
brings the probe group back.

### get-price, get-order-data, get-plan-images

- **`get-price`** returns the planner's price calculation (`fetchPrice`).
- **`get-order-data`** returns the order data of the current plan without placing an order, or
  `null`.
- **`get-plan-images`** renders a perspective and a top view. The top view matches the wall side
  labels. Without images, the result is `{ "error": "No images available" }`.

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
  `it('turns the right-handed corner article by 90 degrees more at %d degrees')` in
  `hi-mcp/hi-mcp-server/tests/group-placement.test.ts`; `place-group` puts a corner article into
  each corner with the rotation of the table — guarded by
  `it('puts the corner point into the %s corner with the rotation of the corner rules')` in
  `hi-mcp/hi-mcp-server/tests/plan-space.test.ts`.
- **The anchor** of a placement by point: the root whose back left corner goes to `posGroup`. The server finds it (C5) and
  places it by its docking corner, wherever its origin is (C6, D33), before the one load that
  creates the group (D46) — guarded by
  `it('puts the docking corner of every offset article on posGroup at %d degrees')` in
  `hi-mcp/hi-mcp-server/tests/group-placement.test.ts` and
  `it('places a range hood by its left edge, not by its centre')` in
  `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts`.
- **Moving** an existing group: `place-group`, by wall, alignment and offset (D21).
- **Outside the room** is allowed (D22).
- **A conflicting placement** — on a group that is already in the plan, or one the server cannot
  use — creates no `repositioningData`, and the planner positions the group; an existing group
  keeps its position (D26).
- **Overlaps**: in `place-group` and in a placement by wall, a target that overlaps another group —
  a root module of the one overlaps a root module of the other — is moved along the wall
  (D27). Groups may touch. A root module on an object, in another group or in front of a door or a
  window is built as sent, and the `hint` names it with the free stretches of its wall (D55).

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
| C1 | Roots marked `isGenerated` (worktop, toe kick) are dropped from a `create-or-replace-groups` payload; the library regenerates them, and their input attributes are set again after the load (G48). The reload of `place-group` and of a placement by wall keeps them, so they keep their attributes — the worktop colour — over the move, and it sends the group's own attributes, which the planner keeps as sent on a reload — without them the reload drops the library's group settings (`mod_GroupGenerationLogic` and the others). Guarded by `it('reloads the group with its group attributes, which the planner keeps as sent')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` | `prepareGroup`; `repositionedGroup` |
| C2 | The read-only fields of a group from `get-plan-context` are ignored: per root `rowIndex`, `articleName`, `desc`, `category`, `imageUrl`, `isGenerated`, `dockingVectors`, `freeDockingVectors`, `subModules`, `logMessages`; per group `position`, `logMessages`. Every other field the server does not use is reported (G27). The group `attributes` reach the planner | `prepareGroup`; the field strip of `create-or-replace-groups` |
| C3 | Docking vector indices are stripped and resolved from the names | `stripDockingIndices` |
| C4 | A unique prefix of a group id is accepted | `findGroup` |
| C5 | The anchor is found by walking from the start root down to the floor unit carrying it, then left along its row, stopping at a corner article. A wall unit named as anchor leads to the base unit below it. Only the Bottom side pairs make row neighbours in this walk: counted as neighbours, the Top pairs of a wall unit hanging beside a tall unit would make that wall unit the anchor — C15 starts a relation group on the floor instead | `findAnchorRoot`, `dockingRelations`, `group-placement.ts` |
| C6 | The anchor is placed by its docking corner — the origin of a cabinet, the left edge of a range hood, the corner point of a corner article — and a right-handed corner article is turned by 90°. The frame is learned by a probe load and remembered per library, article and attributes, and reaches the planner as `rootRelPos` and `rootRelRotationY`. The probe load is undone, so it leaves no step on the planner's undo history and the planner's undo button never brings the probe group back; a probe group the undo left in the plan, or the probe of a page without `undo`, is removed (guarded by `it('undoes the anchor probe instead of removing it')` and `it('removes the probe group when the page cannot undo')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts`) | `anchorFrameOfRoot`, `toRepositioningData`; `probeAnchorFrame`, `takeBackProbe` |
| C7 | `cornerArticle` is set on an empty plan from the category or the module name; `cornerPoint` is removed | `isCornerArticle`; `agentFacingArticle` |
| C8 | In a resubmitted group, a docking entry that names a root outside the group connects nothing and is kept, so a group whose unit was deleted still loads. In a new group it is reported (G26) | `dockingNeighbours`, `reportUnsentRoots` |
| C9 | `place-group` defaults: alignment `center`, offset 0, room 0; the group keeps its height | `place-group` |
| C10 | `back` and `front` name the `top` and the `bottom` wall (`place-group` `wall` and `alignment`) | `sideLabel` |
| C11 | A number as the value of `change-module-attribute` or `change-group-attribute` is passed on as its string — the planner's attribute commands take a string or a boolean. Attribute overrides of `create-or-replace-groups` and `merge-article-into-group` keep their numbers: the layout and the article pick take a number, a string or a boolean | `attributeValue` |
| C12 | An unknown `get-plan-context` section is ignored; none left means the default sections | `get-plan-context` |
| C13 | A docking entry with `rootId` instead of `id` is read by its `rootId` | `completeDockingEntries` |
| C14 | The position of a returned group is reported in the frame of a placement: `pos` the back left bottom corner, `rotationY` the rotation of the placement, the footprint from there, and with two corner articles `rootId`, the one `pos` belongs to (D33) | `positionInPlacementFrame`; `inPlacementFrame` |
| C15 | A group with relations whose list starts with a wall unit starts with its first floor unit, so the placement anchors on the floor | `relationsToDocking` |
| C18 | Every wall of the plan context gets its `name` (back wall, front wall, left wall, right wall), a wall entry without a type — a door opening — the type `opening`, and every room its `corners` (`name`, `point`, `posRotationY`) | `agentFacingRooms`; `wallName`, `roomCorners`, `plan-space.ts` |
| C21 | Every door and window of the obstacles gets `roomIndex`, `wall` and `fromEndMm`: the wall whose line its outline touches — within the wall's thickness — over the longest stretch, and its span along that wall measured from the wall's end, like the `d` of a placement | `agentFacingObstacles`; `wallOfOpening`, `plan-space.ts` |
| C24 | Before the reload of `place-group` and of a placement by wall, a unit above another root module — a wall unit, a range hood, a unit on top — is docked to it again: the kernel's docking links only vectors that touch, so a unit hanging with a gap is docked to nothing below it in a calculated group, and the reload, which sends no positions, would put it on the floor. The unit below is found by position, as the planner finds it (roomle-ui `carriersOfUnitsAbove`): the unit's docking vectors begin at or above its top and their centre lies over it, the highest such root module carrying it. The entry docks the unit's `LeftBottom` to the carrier's `LeftTop` with the offset that keeps it where it stands, in the group's frame — also on a turned leg. Guarded by `it('docks a wall unit hanging above a floor unit to it again before the reload, so it keeps its place')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` | `withUnitsAboveDocked`, `repositionedGroup`; `dockingVectorBox`, `dockingVectorStart`, `plan-space.ts` |
| C16 | A relation is written as a docking entry on the root the planner reaches first — breadth-first from the first root —, mirrored with the offset negated when its target comes later; the planner applies an offset only in the direction of the entry | `relationsToDocking` |

### 8.3 `create-or-replace-groups`

G23–G25, G29 and G61–G63 concern docking written as `contextData`; a payload with relations (D34)
has its own corrections, G31–G45 and G64.

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
| G7 | roots the docking does not connect to the first root — an entry connects in both directions, as the planner mirrors every entry before it arranges from the first root (guarded by `it('accepts a root docked by an entry written on the new root')`) | adds a docking entry (`dockingVector`, `mode` `StartStart`, `offset` `[0, 0, 0]`) that docks the part to the free end of a row of its kind by a root of that kind — a part with a floor unit by a floor unit to the floor row, a part of wall units by a wall unit to the wall-unit row (catalog category "Wall Units", also "Wallunits"); a wall unit of the part stays on its carrier. A part of wall units in a group with no wall unit placed yet hangs its first wall unit above the first placed floor unit with a free `LeftTop` that is not a tall unit, at the hang height of D35 (`LeftTop` → `LeftBottom`, offset `[0, gap, 0]`), and the next wall units continue its row (guarded by `it('hangs undocked wall units above a placed floor unit when the group has no wall unit yet')` and `it('docks a part with floor units by a floor unit, and its wall unit stays on its carrier')`) | correction naming the roots and the entry; for a hung wall unit: "… the wall unit 'w1' was docked above 'u1' (its LeftBottom on the LeftTop of 'u1'), 660 mm above it at the height of the wall units" — without a known height "… so it stands on it; above with gapMm hangs it" |
| G7 | a part that cannot be docked: no free end of its kind, wall units in a group whose floor units are tall units only or have no free `LeftTop`. An article the catalog lists without docking vectors counts as having them — unknown, not undockable; a range hood, whose category does not say "Wall Units", joins the floor row | does not build the group | `notLoaded` naming the relation to send: `{ "id": "B", "articleId": "...", "rightOf": "A" }`, a wall unit `"above"` its floor unit |
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
| G59 | a group placed by wall that still covers the floor it covered before the reload — the load answers with runtime ids, and the planner keeps the group origin elsewhere after a reload, so the server compares the floor | leaves it where the planner put it | correction: "group '…' was not moved to the … wall - the planner did not reload it there; place-group moves it" |
| G60 | a call with a placement by wall for which the planner built more or fewer new groups than the call sent — the pairing by order cannot tell them apart | moves no group by wall | correction per group placed by wall: "the planner built … new groups for the … of the call, so the server cannot tell which one this group became - it was not placed at the … wall; get-plan-context shows the groups, place-group moves one" |
| G15 | an article id in another spelling (case, whitespace) | reads it in the catalog's spelling | correction |
| G15 | an article id the catalog does not have, beside roots it has | builds the group without that root; a relation or docking entry that named it names nothing, so its root gets the default (G31, G7) | `notLoaded` entry with `rootIds` and the valid article ids (the first 100): "… the root was not built, the other roots were; send it with merge-article-into-group or a valid article id" |
| G15 | every article id of the group unknown | does not build the group | `notLoaded` with the valid article ids |
| G16 | a placement on a group that is already in the plan | does not use it; the group keeps its position | correction |
| G17 | an anchor the probe cannot calculate | loads the group without the frame, placed by the unit's origin | correction: "root '…' ('…') could not be calculated before loading - the group was placed by the unit's origin and may stand off posGroup; place-group puts it against a wall or into a room corner" |
| G23 | a unit written inside a docking entry — with its `articleId`, attributes and own docking | takes it as a root of the group, also nested deeper; the entry keeps the docking link | correction |
| G24 | a docking entry without `dockingVector` | uses the partner of the root's own vector (`RightBottom` → `LeftBottom`, a Top vector → the Bottom vector of that side, `BackBottom` → `BackBottom`) | correction |
| G25 | a docking context without `ownDockingVector` | drops it; the roots it named are docked like any undocked root (G7) | correction |
| G26 | in a new group, a root named in the docking but never sent — no `articleId` | drops the entry; nothing can be built for it | correction: "roots '…' are named in the docking but were never sent - nothing was built for them; send each as a root { id, articleId }" |
| G27 | a group, root or docking entry field the server does not use and `get-plan-context` does not return | ignores it | correction naming the fields |
| G28 | attribute overrides as an object `{ id: value }`, or with `attributeId` instead of `id` | reads them as `[{ id, value }]` | correction; an entry without any id is ignored and reported |
| G29 | docking in a shape that cannot be read — `contextData` or a `dockedRoots` that is not a list, a docking context or entry that is not an object | drops that part; the root is docked like any undocked root (G7), and the group loads | correction: "… could not be read and were dropped - contextData is { dockedRoots: [{ ownDockingVector, dockedRoots: [{ id, dockingVector, mode?, offset? }] }] }" |
| G31 | in a group with relations, a root without a relation that nothing connects | puts it `rightOf` the previous unit of its kind in the list (floor units, wall units); the first wall unit beside a tall unit of the group, else `above` the floor unit at its list position | correction |
| G32 | a relation that names no other root of the group, or the root itself | ignores it; the root gets the default (G31) | correction |
| G33 | a relation that closes a ring of relations | drops it | correction |
| G34 | a floor unit `above` a unit | puts it `rightOf` that unit | correction |
| G35 | a wall unit `rightOf` / `leftOf` a base unit | hangs it `above` that unit (D35). A tall unit is one by category ("Tall Units") or by height (≥ 1500 mm, e.g. the modular carcase `H60M` under "Modular") | correction |
| G36 | `behind` a corner article, or a corner article `behind` a unit | ignores it; the default (G31) | correction |
| G37 | `gapMm` on `rightOf`, `leftOf` or `behind`, `gapMm` that is not a number, an `align` other than left, right or back, `align` or `gapMm` without a relation | ignores it (`align` left). The planner applies an offset in the group's frame, where `x` is not the direction of a turned leg, so only a vertical gap is derived; a gap in a row is a filler article | correction |
| G38 | two relation fields on one root | uses the first of `rightOf`, `leftOf`, `onTop`, `above`, `behind` | correction |
| G40 | a floor unit `rightOf` / `leftOf` a wall unit | puts it into the floor row — the default of G31 | correction |
| G41 | a range hood `rightOf` / `leftOf` a tall unit — its Top vector is its chimney top | hangs it `above` the floor unit on that side of the tall unit; without one it stays beside the tall unit by its top edge. A hood without a relation hangs `above` a base unit, never beside or on a tall unit | correction |
| G42 | a wall unit (or a range hood) `onTop` a kitchen base unit (category "Base Units") — nothing stands on a worktop | hangs it `above` that unit (D35); a `gapMm` meant as a stacking lift is dropped. `onTop` a tall unit or a wall unit stays a stacking | correction |
| G43 | a floor unit `onTop` a kitchen base unit | puts it `rightOf` that unit — it continues the floor row | correction |
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
| G63 | docking written as `contextData` that puts a floor unit on a Top vector of a base unit (category "Base Units") — nothing stands on a worktop; as G43 for the relations | drops the entry; the floor unit continues the floor row (G7). A unit on a tall unit or a wall unit stays a stacking, a wall unit or a range hood above a base unit stays, an article the catalog does not know stays as sent | correction: "floor unit 'sink' was docked on the LeftTop of the base unit 'b1' - nothing stands on a base unit, so the docking was dropped and the unit continues the floor row" |
| G64 | a unit `above` a floor unit whose place a row of wall units takes already — a row from another floor unit, or from beside a tall unit, grew into it; also the place G44 moves a second unit to | puts it at the free end of that row: `rightOf` its last unit, `leftOf` its last unit for a row that grows to the left — from a tall unit, for example. The places come from the catalog widths (`mod_Width`, a root's override first) along each straight row of floor units; a unit of unknown width has no place, and a range hood keeps its place above the hob unit | correction: "'wall4' would hang above 'base3' in the place of 'wall3' - it was put rightOf 'wall3', the end of that row of wall units" (guarded by `it('puts a unit hung above a floor unit whose place a wall-unit row takes at the end of that row')`) |
| — | no group of the call can be built | — | error result: "Invalid pos groups - nothing was loaded: …" with every error |
| — | the planner loads nothing | — | error result: "No groups were created or replaced …" |
| — | a replaced group that still holds its previous articles instead of the ones sent — the planner could not calculate the new layout and restored the group (roomle-ui `_discardCalculation`) | — | correction: "the planner could not calculate the new layout of group '…' and kept its previous content - …; send the layout again with another article" |
| — | a group of the call has no position after the load | — | `hint` |
| D55 | a root module of a group of the call that overlaps an object or a root module of another group, or stands in the 600 mm strip in front of a door or a window within its height, `bottomMm` to `topMm` — by more than 5 mm; a replaced group only for what it did not stand on before | builds it (D51) | `hint`: "Root module 'w1' (OTB30) of group '…' stands in front of the window in the back wall (wall 5, fromEndMm 235 to 2335, 950 to 2170 mm) - free stretches of the left wall (wall 0) at its height: fromEndMm 0 to 4400. The groups were built as sent - move or change them if the user did not ask for them there." — with another group named: "… overlaps root module 'r1' (…) of group '…' …", then "If the units belong together, send them as one group or join them with merge-groups." Without a wall the stretches are left out; without a wide enough stretch: "- no stretch of the … is free for it at its height" |

### 8.4 `place-group`

| ID | Input | What the server does | Feedback |
|---|---|---|---|
| G18 | a group id that is neither an id nor a unique prefix of one, nor a root id (C23) (also in the command tools) | nothing | error: "Group '…' not found. Groups in the plan: …" |
| G19 | a room or wall index outside the plan, a side without a real wall | nothing | error: "Room index … not found" / "Wall '…' not found … Available walls: …" |
| G20 | an alignment that names the target wall or the opposite one | centres the group on the wall | correction |
| G21 | a group without calculated geometry | nothing | error: "Group '…' has no calculated geometry to place." |
| G22 | a target that overlaps another group — a root module of the one and a root module of the other overlap by more than 5 mm in their footprints and height ranges; the boxes around the groups are the quick test first, and a group whose root modules have no geometry is tested by its box | moves the group along the same wall to the nearest position free of overlap. Touching is no overlap, wall units above another group's base units do not overlap them, and a group without height data overlaps nothing (`volumesOverlap`, guarded by `it('does not count touching groups, groups above each other or groups without height data')` in `plan-space.test.ts`) | correction naming the group and the distance, suggesting `merge-groups` if the units belong together |
| G22 | the same, placed into a corner or without a free position on the wall | places the group as asked | correction: "… overlaps group '…' - there is no free position …" |
| D55 | after the reload, a root module that overlaps an object or stands in the 600 mm strip in front of a door or a window within its height, `bottomMm` to `topMm` (another group is G22's) | places it as asked | `hint`: "Root module '…' (…) of group '…' overlaps an object (x … to …, z … to …, … to … mm) - free stretches of the left wall (wall 3) at its height: fromEndMm … The group was placed anyway - move or change it if the user did not ask for it there." |
| D70 | after the reload, the group as built at the new place does not stand as asked — the library built it with another width there | places it once more by its measure at the new place | the corrections of that measure (G22) in place of the first measure's |
| — | a group that already stands where asked (origin within 5 mm, same rotation) | no reload | correction: "Group '…' already stands at the … wall as asked - nothing was reloaded" |
| — | the reload fails | — | error: "Group '…' could not be reloaded at the new position." |

### 8.5 Command tools

**In the server, before forwarding:**

| ID | Input | What the server does | Feedback |
|---|---|---|---|
| G18 | an unknown group id | nothing | error with the groups in the plan |
| C23 | a root module id, or a unique prefix of one, as `groupId` (every tool that takes a group id, `place-group` included) | runs the command on the group that holds that root module | correction: "change-group-attribute: 'u2' names a root module, not a group - the command ran on its group 'kitchen-1'" (guarded by `it('reads a root id sent as the group id as the group that holds the root module')`) |
| C17 | a root module id that is a unique prefix of a root id, differs from one root id only in its first UUID segment, or differs from one in a single character (`change-module-attribute`, `delete-article-in-place`, `delete-article-and-compact` — without `groupId` among the roots of every group —, `exchange-root-module`, `dockTo.rootId` of `merge-article-into-group`, `between` of `insert-article-into-group`, `rootModuleIds` of `swap-root-modules`) | reads it as that root | correction: "root id '…' was read as '…'" |
| C17 | a root module id that matches no root, or more than one | forwards it as sent | the planner's P11 with "Roots in the plan: …" appended |
| G15 | an article id in another spelling (`merge-article-into-group`, `insert-article-into-group`, `exchange-root-module`) | reads it in the catalog's spelling | correction |
| C19 | `insert-article-into-group` with two roots of one row that are no neighbours | inserts the unit beside the first-named root, towards the second — the walk passes a corner article | correction: "'r1' and 'r3' are not neighbours - the unit was inserted between 'r1' and 'r2', the neighbour of 'r1' towards 'r3'" |
| G52 | `insert-article-into-group` with two roots that are in no row together | nothing: the server cannot tell where the unit goes | error naming the side neighbours of the first root and asking for two neighbours of one row |
| G53 | `swap-root-modules` naming one root twice | nothing | error asking for the two units that change places |
| G54 | `delete-article-and-compact` without `groupId`, with a root module id that matches no root of the plan, or more than one | nothing: without a group the delete cannot run | error "Root module '…' not found. Roots in the plan: …" — the answer the planner gives `delete-article-in-place` for the same id (C17, P11); guarded by `describe('delete-article-and-compact without a group id')` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts` |
| C20 | a correction of the planner (a dropped docking, a hung unit moved to another carrier, a unit above that keeps its place and the unit above it now overlaps, a deletion instead of closing the gap) | passes it on after the server's own, named by the tool | correction |
| C22 | `change-module-attribute` or `change-group-attribute` after which the library changed another attribute of a root module — a front program switched by a front colour —, or a root module the command set ends with another value | passes the result on; compares the input attributes of the root modules before and after (D59) | correction after the planner's: "with mod_FrontColor \"324\" (Dark marble (#404040)) the library changed mod_FrontProgram of root module 'w1' (OTB60) from \"Classic\" (Simple fronts in plain decors) to \"Modern\" (Mitred frame fronts with glass filling)" — the root modules changed alike in one sentence |
| D43 | an insert, a `delete-article-and-compact`, an exchange or a swap that makes the row reach past a wall of the room, overlap another group that stood beside it before (not a group the edit split off), or makes a root module stand in front of a door or a window or on an object it did not stand on before (D55, by the groups before the edit) | builds it | `hint`: "the row now reaches past a wall of the room - …" / "the row now overlaps group '…'" / "Root module '…' (…) of group '…' stands in front of the door in the right wall (wall 1, fromEndMm …) - free stretches of the right wall … The row was edited as asked - move the group or edit the row if the user did not ask for it there." |
| D42 | a row edit that moved wall units or the range hood of the group (by the catalog and the positions before and after) | — | `hint`: "the wall units and the range hood above the moved units moved with them ('w1', 'h1') - edit the wall row the same way if it should line up with the floor units" |
| G15 | an article id the catalog does not have | nothing | error with the valid article ids |
| D29 | `merge-article-into-group` on a taken side vector | docks the unit to the root at the free end of that row in the named direction — when that row ends at a corner article, to the free end of the leg in the other direction —, or to the named root's free other side when the unit would stand outside the room at that end (the calculated group and the contour of the room the group stands in decide, not the bounding box of its walls) | correction, naming the end it skipped |
| P7 | a `dockingVector` the new article does not have (by the catalog) | uses the partner of `ownDockingVector` when the article has it | correction |
| D35 | a wall unit or a range hood docked on a Top vector of a floor unit — a Top-to-Top pair becomes Top-to-Bottom first — without a y offset | sets the y offset to the hang gap of the wall units (`hangGapOf`) | correction: "'OTB60' hangs 660 mm above '…', at the height of the wall units" |

**In the planner** (roomle-ui `glue-logic.ts`, `hi-plan-context.ts`). These checks protect the
planner and stay as they are (D5); the server passes their message on as an error result.

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
| P13 | payload-shape messages — not reachable, the server builds these payloads |
| P14 | "Root modules '…' and '…' are not docked side by side - the side neighbours of '…': …" — reached only when the plan context and the planner disagree, since the server corrects non-neighbours (C19) |
| P15 | "A corner article and a straight unit cannot change places: '…' is a corner article." — no result keeps the corner |
| P16 | "Article '…' has n root modules - an article of exactly one root module is inserted." |
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

Infrastructure checks, kept. The page allow-list and the origin check are security boundaries.

| Message | When |
|---|---|
| "No HI page connected. Have the user open the ligna-store in their browser at … and start planning there …" | no page on the bridge |
| "The connected page (…) runs an outdated HI MCP page bridge that expects tool calls. Have the user update the page bridge to protocol 2 … and reload the page." | a page with an old bridge |
| "Planner call '…' timed out after …ms" | a planner call exceeded its timeout (§4). The page is not told to stop, so a plan change may still complete: read the plan before sending it again |
| "The demo page disconnected" | the page left during a call |
| WebSocket close 4409, "Planner session in use" | another page already owns the planner; the newcomer must retry after the owner leaves |
| HTTP 409, "This chat is not connected to its planner page" | the browser chat's `client` ID does not own the active page |
| HTTP 400, "Chat request requires a page clientId" | the example chat request omitted its browser page identity |
| the page's own error (e.g. a method not on its allow-list) | the planner call failed in the page |

### 8.8 `undo` and `redo`

Nothing here is an error result: the tool answers with its name `null` and a `hint`.

| Situation | What the server does | `hint` |
|---|---|---|
| no record | nothing | "Nothing to undo: no tool call has changed the plan since the planner page connected." / "Nothing to redo: redo brings back a tool call that undo reverted, and a new change of the plan ends redo." |
| a history event while no tool call ran, or the plan differs from the state the call left | forgets the records | "The plan was changed in the planner after the last tool call, so no tool call was reverted - the planner's own undo button reverts the changes made there." |
| a planner undo or redo without its history event | forgets the records | "The planner's undo history no longer holds … - the plan was loaded again, nothing was undone." / "… ended after n of m steps of … - check the plan with get-plan-context." |
| `undo` of a call whose follow-up reload has not arrived within 2 s more | nothing; the records stay | "The planner has not finished the last change yet - its follow-up reload is still outstanding. Nothing was undone; call undo again in a moment." |
| the plan after the steps is not the plan before (`undo`) or after (`redo`) the call | takes the steps back, forgets the records | "Undo of … did not give back the plan before it - the plan was changed in the planner while the tool call ran. The undo was taken back and the plan is as it was; the planner's undo button reverts the changes made there." / "… could not be taken back completely - check the plan with get-plan-context." |
| a page without `undo` on its allow-list | — | error result: the page's "Planner method not exposed: undo" (§8.7) |

## 9. Limits

| Limit | Value | Where |
|---|---|---|
| Planner call timeout | 30 s, 120 s for loads, commands and snapshots | `page-bridge.ts`, `planner-api.ts` |
| Chat steps per turn | 16, the last without tools | `hi-mcp-chat/chat-steps.ts` |
| `find-attributes` matches | 20 | `MAX_ATTRIBUTE_MATCHES` |
| Valid article ids in G15's message | 100 | `requireCatalogArticle` |
| Overlap tolerance of `place-group` and of the obstacle hint | 5 mm | `OVERLAP_TOLERANCE_MM` |
| Strip along a wall: in front of a door or a window, and where a root module stands at a wall (D55) | 600 mm | `WALL_STRIP_MM` |
| Wait for the follow-up reload of an attribute change or exchange | 2 s | `FOLLOW_UP_WAIT_MS` |
| Wait for the history event of a planner undo or redo | 1 s | `HISTORY_EVENT_WAIT_MS` |
| Wait in `undo` for a late follow-up reload of the last call | 2 s | `FOLLOW_UP_WAIT_MS` |
| Comparison of the plan before and after a tool call | 0.1 mm | `groupsKey` |
