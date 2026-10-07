# HI MCP server — behaviour

> **Living reference.** It describes how the HI MCP server (`hi-mcp/hi-mcp-server`) behaves towards an
> agent: the guidelines and decisions it follows, its tools, the information it provides, and every
> guard, automatic correction and feedback message. Every change to a tool, a served rule, a guard, a
> correction or a result updates this document in the same change.
>
> **State**: the code of 2026-10-06 — with the obstacles of the plan context
> ([RML-18036](https://roomle.atlassian.net/browse/RML-18036), D45) —, the served text speaks of
> articles and root modules, not of kitchens (D44), with the row edit tools
> ([RML-18045](https://roomle.atlassian.net/browse/RML-18045)) and the undo and redo tools
> ([RML-18044](https://roomle.atlassian.net/browse/RML-18044)), after the fixes of the MCP test backlog
> ([RML-18041](https://roomle.atlassian.net/browse/RML-18041)), which built on the refactoring of
> the guards ([RML-18033](https://roomle.atlassian.net/browse/RML-18033)).
> A decision that is not implemented yet is marked **deferred** (D23); every other one is in effect.
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
relation (D34), and gives a new group one point and one rotation. The planner calculates every root
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
- **what the server corrected** — a `corrections` list, one sentence per correction
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
| D9 | The groups of the plan context carry no parts and no log messages. The parts stay in the planner's raw groups: the footprint, the server's placement geometry, the planner's article pick detection and its part list read them | 2026-10-01 | user | in effect — roomle-ui `shapeRoot`, `shapeGroup` |
| D48 | **The plan context is agent-ready as the planner returns it.** roomle-ui shapes it (`hi-plan-context.ts`): the master data reduced to the root modules — the generated ones included — and their customer-facing attributes, which `find-attributes` searches; the catalog with its docking vectors; the groups; the room contour in 3D (`[x, level, -y]`, the system of a group's `pos`) with the derived walls; the obstacles. The pages pass it through. The server adds its own vocabulary — wall names, corners, the wall of a door or window, `cornerArticle` on an empty plan (C18, C21, C7) —, reports the group positions in the frame of a placement (C14), and removes what the agent must not see (D7, D10). The footprint geometry exists twice, in roomle-ui for the plan context and in `plan-space.ts` for the server's placement: accepted | 2026-09-28 | [RML-17966](https://roomle.atlassian.net/browse/RML-17966) | in effect — roomle-ui `getPlanContext`, `hi-plan-context.ts` |
| D10 | The agent is never told how the server positions a group internally; the articles' `cornerPoint` is removed from the plan context | 2026-09-30 | [RML-18007](https://roomle.atlassian.net/browse/RML-18007) Task 1, P3 | in effect — `agentFacingArticle`, `tool-executors.ts`; guarded by `it('never tells the agent how the server positions a group internally')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` |
| D11 | A group returned by `get-plan-context` is a valid `create-or-replace-groups` payload as it is | 2026-09-16 | rules (`AUTHORING_RULES`, `hi-mcp-server.ts`) | in effect |
| D12 | Walls are named by their side in the top-view image — `left`, `right`, `top`, `bottom`; the text maps back = top, front = bottom. Every wall also carries its `name` in the user's words (back wall, front wall, …), an opening its `type`, and every room its `corners` with their names and rotations ([RML-18041](https://roomle.atlassian.net/browse/RML-18041)) | 2026-09-02 | [RML-17966](https://roomle.atlassian.net/browse/RML-17966), D7 of the repositioning refactoring | in effect — `agentFacingRooms`, `roomCorners` |
| D13 | Rotations are counter-clockwise as seen from above; a group against the right wall has 270, against the left wall 90. Not clockwise, as the ticket comment assumed: RoomleCore passes the angle through a proper rotation from HI space (Y up) to kernel space (Z up), and the golden Furniture_Smith L-shape at 270 stands in the back right corner ([rotation sense](../.agents/skills/roomle-hi-concepts.md#rotation-sense)) | 2026-09-29 | [RML-17966](https://roomle.atlassian.net/browse/RML-17966) comment 155478 (its clockwise values rejected), D1 of the repositioning refactoring | in effect |

### Authoring and positioning

| # | Decision | Date | Source | State |
|---|---|---|---|---|
| D14 | One piece of furniture is one group ("one kitchen" until D44): articles beside, above or back to back are docked root modules of the same group | 2026-09-29 | rules `hi-mcp-server.ts:10` | in effect (rule) |
| D15 | A root is an article pick; root positions come from the docking only | 2026-09-16 | rules (`AUTHORING_RULES`, `hi-mcp-server.ts`) | in effect |
| D16 | A new group is positioned with `placement { posGroup, posRotationY, rootId? }`, applied once, when the group is created; the server anchors it | 2026-09-30 | [RML-18007](https://roomle.atlassian.net/browse/RML-18007) Task 1 | in effect |
| D17 | With two corner articles, `rootId` names the one that goes into the corner `posGroup` names | 2026-09-30 | [RML-18007](https://roomle.atlassian.net/browse/RML-18007) Task 1, P1 | in effect |
| D18 | The server places a corner article by its corner point and turns a right-handed one by 90° itself | 2026-09-30 | [RML-18007](https://roomle.atlassian.net/browse/RML-18007) Task 1; `toRepositioningData` | superseded by D33, which keeps both for every article |
| D19 | `merge-article-into-group` positions by docking (`dockTo`), never by coordinates | 2026-09-30 | [RML-18004](https://roomle.atlassian.net/browse/RML-18004) | in effect |
| D20 | `change-group-attribute` sets the attribute on every root and sub module of the group whose master-data module carries it, in one calculation | 2026-09-30 | [RML-18004](https://roomle.atlassian.net/browse/RML-18004) | in effect |
| D21 | `place-group` works on the calculated group, keeps the group's height, and returns `{ placedIn, wall, group }`; it knows walls and corners, not free points | 2026-09-30 | [RML-18007](https://roomle.atlassian.net/browse/RML-18007) Task 2, Q1, Q3–Q5 | in effect — `place-group`, `tool-executors.ts`; `plan-space.ts` |
| D22 | A group outside the room is never refused, removed or warned about: the user may ask for it — a terrace, a space without walls in the plan, a parking spot while planning —, and the server cannot tell that request from a wrong placement. Rejected: a room check after the load. In "test the mcp" a group outside the room is a model finding ([hi-mcp-testing.md](../.agents/skills/hi-mcp-testing.md)) | 2026-10-01 | user, review before [PR #42](https://github.com/roomle-dev/roomle-hi-example/pull/42), which dropped the check with its rule sentence and tests | in effect |
| D23 | `placement { wall, alignment, offsetMm }` in `create-or-replace-groups` — deferred, "ask first" | 2026-09-30 | [RML-18007](https://roomle.atlassian.net/browse/RML-18007) Task 2, D2; [backlog issue 27](../.agents/backlog/mcp-test-open-issues.md#27-a-new-group-needs-a-point-the-model-computes) | deferred |
| D24 | `place-group` rejects a target that meets another group (contact guard) | 2026-09-30 | [RML-18007](https://roomle.atlassian.net/browse/RML-18007) Task 2, D1 | superseded by D27 |
| D25 | A placement on a group that is already in the plan is rejected | 2026-09-30 | [RML-18007](https://roomle.atlassian.net/browse/RML-18007) Task 1 | superseded by D26 |
| D46 | **A new group stands where the placement says after the one load that creates it, and the server owns its anchor.** The server finds the anchor by the docking (C5), not by the order of the roots — the models did not list it first —, and learns the anchor's frame before the load (C6, D33). Rejected: a correction load after the creation — load, read the calculated anchor, move it: every offset group would load twice and visibly jump, and moving is `place-group`'s (D21); a planner repositioning option that places a root by its docking corner — the corner turn is a convention of the served corner rules, not of the planner, and it needs a roomle-ui release; the footprint corner as the reference — it includes generated parts, the worktop overhangs by 10 mm; a special case for the range hood, such as centring it over the nearest hob — it guesses the intent, which docking states. Whether the probe can go away is open ([backlog](../.agents/backlog/roomle-ui-article-template-geometry.md)): the frame depends on the attribute overrides, and an article template gives the default variant | 2026-10-02 | [RML-18007](https://roomle.atlassian.net/browse/RML-18007); user, 2026-10-02 (D33) | in effect — `findAnchorRoot`, `toRepositioningData`, `group-placement.ts`; `probeAnchorFrame`, `tool-executors.ts` |

### Guards and corrections (2026-10-02)

| # | Decision | Source | State |
|---|---|---|---|
| D26 | **A conflicting placement creates no `repositioningData`.** For a placement on a group that is already in the plan, or a placement the server cannot use, the server sends no `repositioningData`, and the planner (roomle-ui, RoomleCore) positions the group — an existing group keeps its position. The result says that the placement was not used | user, [RML-18033](https://roomle.atlassian.net/browse/RML-18033) | in effect — `normalizePlacement`, `tool-executors.ts` |
| D27 | **Intersecting groups are allowed** (`place-group`). When the target overlaps another group, the server corrects the position along the wall and informs the agent; it never rejects. Touching is not an overlap | user, [RML-18033](https://roomle.atlassian.net/browse/RML-18033) | in effect — `freePlacementAlongWall`, `tool-executors.ts` |
| D28 | **Unconnected roots are connected automatically.** The server adds a docking entry (`PosDockedContextRoot`: `dockingVector`, `mode`, `offset`) that docks them to the free end of the row. The guard stays for roots that cannot be connected | user, [RML-18033](https://roomle.atlassian.net/browse/RML-18033) | in effect — `connectUnreachedRoots`, `tool-executors.ts` |
| D29 | **A unit docked to an occupied side goes to the free end of that row** (`merge-article-into-group`, and two roots on one side vector in `create-or-replace-groups`). Refined 2026-10-04 ([RML-18041](https://roomle.atlassian.net/browse/RML-18041)): a row has two ends — `merge-article-into-group` walks in the direction the agent named and takes the named root's own free side only when the unit would stand outside the room at that end (the test runs showed the agents name the wrong root as often as the wrong direction; the room decides); a corner article ends a row, so a walk that meets one turns to the free end of the leg in the other direction | user, [RML-18033](https://roomle.atlassian.net/browse/RML-18033) | in effect — `separateSideVectorPartners`, `dockTarget`, `rowWalk`, `tool-executors.ts` |
| D30 | **A call loads every group that can be built** and reports the others with what to send instead | user, [RML-18033](https://roomle.atlassian.net/browse/RML-18033) | in effect — `keepBuildable`, `tool-executors.ts` |
| D31 | Guards are a last resort; the server corrects and informs, and gives feedback where it cannot correct | user guideline | in effect — §8 |
| D33 | **One anchor frame for every article.** A placement puts the docking corner of the anchor root — the back left bottom corner of its docking vectors — at `posGroup`, whatever article it is: the origin of a cabinet, the left edge of a range hood, the corner point of a corner article, which is also turned so that its corner lies back left. The groups the tools return report their position in the same frame: `pos` is the back left bottom corner, `rotationY` the rotation of the placement. An anchor the probe cannot calculate no longer fails its group (G17) | user, 2026-10-02 ([RML-18007](https://roomle.atlassian.net/browse/RML-18007); the range hood placed half its width off) | in effect — `anchorFrameOfRoot`, `toRepositioningData`, `positionInPlacementFrame`, `group-placement.ts`; `inPlacementFrame`, `tool-executors.ts` |
| D34 | **A unit names its neighbour, the server builds the docking.** Every root after the first names one neighbour with one relation — `rightOf`, `leftOf`, `onTop` (`align`, `gapMm`), `above` (`gapMm`), `behind` — and the server compiles the docking entries (`contextData`) from it: the vectors, the mode, the offset, and the root the entry goes on. A wall unit `rightOf` / `leftOf` a tall unit docks by the Top vectors. `contextData` stays accepted and is no longer taught; a group without any relation field is not touched. Rejected: rows written as arrays — wall units, corners between rows, stacking and islands each need a field of their own, and the nesting returns —, and a server that lays the group out from a list of articles and a wall — the order, the corner side and the wall units are the user's intent | user, 2026-10-02 ([RML-18038](https://roomle.atlassian.net/browse/RML-18038)) | in effect — `relationsToDocking`, `group-layout.ts` |
| D35 | **The hang height of a wall unit `above` a floor unit** is the height of the tall units — a tall unit of the group, else the usual tall unit of the library — minus the heights of the wall unit and the floor unit (`mod_Height`); base and tall units stand on the same plinth. Furniture_Smith: 2100 − 720 − 720 = 660. `gapMm` overrides it | [RML-18038](https://roomle.atlassian.net/browse/RML-18038) Decision 1, 2026-10-02; confirmed live 2026-10-04 ([RML-18041](https://roomle.atlassian.net/browse/RML-18041)): bottom 1480, top 2200, flush with the tall units | in effect — `hangGapOf`, `group-layout.ts` |
| D36 | **A material for the whole group goes into the group's `attributes`.** A root's `attributes` are overrides of that root module. A group attribute that is not one of the library's group settings is set on every unit and generated root of the group after the load (`change-group-attribute`, D20); an override only a generated root carries (the worktop colour on a base unit) is moved to the group; the colours of the generated roots a replace drops (C1) are set again. A unit attribute on some roots stays per unit — it may be an accent | 2026-10-04 ([RML-18041](https://roomle.atlassian.net/browse/RML-18041)) | in effect — `applyKitchenWideAttributes`, `moveGeneratedRootOverrides`, `tool-executors.ts` |
| D32 | **Nothing the agent sends is dropped without a report.** What the server can build it builds — a unit written inside the docking becomes a root — and every field it cannot use is named in `corrections`. Only the read-only fields of a group from `get-plan-context` are ignored silently | user, 2026-10-02 ([RML-18033](https://roomle.atlassian.net/browse/RML-18033)) | in effect — `prepareGroup`, `tool-executors.ts` |

### Row edits (2026-10-05)

| # | Decision | Source | State |
|---|---|---|---|
| D39 | **The row edits are planner commands.** `insert-article-into-group`, `remove-article-from-group` and `swap-root-modules` are roomle-ui commands that rewrite the docking of the row and let the root module arrangement move the units, against the group before the edit, in one reload (D3). The server resolves the ids, corrects what it can and forwards one command. Rejected: the server rewriting the relations and replacing the group with `create-or-replace-groups` — the replace path keeps no wall distance, the server would have to pick the end that stays and position the group without the planner (D26), and a replace regenerates the ids; and an insert as a mode of `merge-article-into-group` — a tool named for the intent is what the model selects by, and a taken side there means the end of the row (D29) | [RML-18045](https://roomle.atlassian.net/browse/RML-18045) | in effect — `insert-article-into-group`, `swap-root-modules`, `tool-executors.ts`; roomle-ui `glue-logic.ts` |
| D40 | **Remove and delete are two edits, named by the user's word.** The rules and the two tool descriptions tell the agent to take the user's word: "remove" is `remove-article-from-group`, "delete" is `delete-root-module` (added after the MCP test of 2026-10-05, where gpt-5-mini closed the gap for "delete the middle unit"). `delete-root-module` deletes a unit and leaves the gap: units no longer docked together become separate groups where they stand. `remove-article-from-group` removes a unit and closes the gap: its two neighbours are docked to each other, and a unit hung on it hangs on the neighbour that moves into the gap. A unit at the end of a row leaves no gap: it is removed in the same reload and nothing else moves. A corner article between two legs, which cannot be docked to each other, and the only unit of a group are deleted as `delete-root-module` does, and the result says so (`gapClosed: false`); the kernel deletion splits by docking, so wall units no longer docked to their floor units become groups of their own | user, review of the plan, 2026-10-05 | in effect — `remove-article-from-group`, `tool-executors.ts`; roomle-ui `glue-logic.ts` |
| D41 | **Which part of a row moves.** The end of the row at a wall or in a corner keeps its place, and the other end moves; a row without a wall on its axis keeps the end at the group origin — the left end as seen from the front, the corner article of a corner kitchen. A row that grows from wall to wall is built anyway | [RML-18045](https://roomle.atlassian.net/browse/RML-18045) | in effect (roomle-ui `keepWallDistances`) |
| D42 | **Units above follow the unit they hang from.** A wall unit, a range hood or a unit on top moves with the unit below it — on an insert with the pushed unit, on a swap with its own unit, on a remove with the neighbour that takes the place of the removed unit. The planner finds the unit below by position: its docking context links only vectors that touch, so after a load a wall unit hanging with a gap is no longer docked to its floor unit (found live, 2026-10-05). Nothing edits the wall row automatically: the same tools edit it | [RML-18045](https://roomle.atlassian.net/browse/RML-18045) | in effect (roomle-ui) |
| D43 | **A row edit says what it did to the row.** When an insert, a remove, an exchange or a swap makes a row that stood inside the room reach past a wall, or overlap a group it did not overlap before, the result's `hint` says so; the row is built anyway. This is no warning about a group outside the room (D22): a group that stood outside before the edit is never reported. The `hint` also names the units above that moved with the unit below them (D42) | [RML-18045](https://roomle.atlassian.net/browse/RML-18045), 2026-10-05 | in effect — `withRowHints`, `tool-executors.ts` |
| D49 | **A size is an attribute.** A root module of another size is the same article with its size attribute set (`mod_Width` 900) — in `create-or-replace-groups` and in the `attributes` of `merge-article-into-group`, `insert-article-into-group` and `exchange-root-module`. The catalog has one size per article: without the rule, gpt-5-mini asked back whether "a 900 mm cabinet with drawers" meant a tall or a base unit (MCP test of 2026-10-05) | [RML-18045](https://roomle.atlassian.net/browse/RML-18045), 2026-10-05 | in effect — `AUTHORING_RULES`, the `exchange-root-module` description, `hi-mcp-server.ts` |

### Words (2026-10-06)

| # | Decision | Source | State |
|---|---|---|---|
| D44 | **The served text speaks of articles and root modules, not of kitchens.** The catalog offers articles; a group is one piece of furniture made of articles — a kitchen, a wardrobe, a sideboard, a utility room —; an article placed in a group is a root module. Kitchens are named only where a rule is about them (the corner rules) and in the list of kinds; no tool description names one. `insert-article-into-group` inserts between two root modules that stand side by side, whatever the group and whatever the article — a low cabinet between two high cabinets or wardrobes too —, and a group of two root modules has one place to insert, no gap needed (the sentence that made gpt-5.4-mini reach the tool); the user decides what stands between what. An article named by its kind comes from the category of its neighbours where that category has one. The chat's system prompt names every kind of HI furniture and tells the model to take the closest article of the catalog when the request names a kind. Found with "insert a low cabinet between the high cabinets" on a wardrobe group: the agent looked for a kitchen run of high cabinets and found none | user, 2026-10-06 ([RML-18045](https://roomle.atlassian.net/browse/RML-18045)); guarded by `it('speaks of articles and root modules, not of kitchens, and inserts between any two root modules')` in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` and the test `edit-insert-low-between-high` of `docs/test-prompts.json` | in effect — `AUTHORING_RULES`, `INSTRUCTIONS`, the tool descriptions, `hi-mcp-server.ts`; `CHAT_SYSTEM_PROMPT`, `chat-config.ts` |

### Obstacles (2026-10-06)

| # | Decision | Source | State |
|---|---|---|---|
| D45 | **What stands in the room is a default section of its own.** `get-plan-context` returns `obstacles`: the doors, windows and other plan objects of the kernel's obstacle map as floor outlines with their height range — `kind` door, window or object, no names: an obstacle is an obstacle —, and per HI group the room-space outlines of its root modules. The group outlines come from the parts of the calculated groups, not from the obstacle map: the kernel's outline of an HI group was 50 to 250 mm off on the ticket's plan. The walls of the map are left out — the `rooms` section has them, named and per room. Doors and windows lie behind the room boundary and only touch it, so an overlap test never flags them; the server gives each its wall and its span from the wall's end (C21), the terms of a placement. Root geometry stays out of `groups` (D15); the outlines in `obstacles` are read-only. A planner without the section returns none, and the tool works as before | [RML-18036](https://roomle.atlassian.net/browse/RML-18036) | in effect — `shapeObstacles` (roomle-ui `hi-plan-context.ts`), `agentFacingObstacles`, `wallOfOpening` |

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
  | `loadExternalObjectGroupLayout(layout, 'posGroups', { reason: 'adjusted' })` | `create-or-replace-groups`, `place-group`, the anchor probe | 120 s |
  | `externalObjectGroupOperation(command, payload)` | the command tools | 120 s |
  | `getExternalObjectGroups()` | `place-group`, the anchor probe, the position of every returned group (calculated geometry), the plan before and after a tool call that changes it (D38) | 30 s |
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
  the call. After `change-module-attribute`, `change-group-attribute`, `exchange-root-module`, `insert-article-into-group` and `swap-root-modules`, and after a
  `remove-article-from-group` that closed the gap (`gapClosed`) —
  also the kitchen-wide attributes of `create-or-replace-groups` — it waits until the command has
  produced its second history event, the follow-up reload roomle-ui makes when the kernel answers
  with the group's position, at most 2 s; a page that relays no history events gets no wait. A call
  whose follow-up has not arrived by the end of the call — a follow-up that lands after the wait,
  while the call still reads the plan, counts as arrived (guarded by `it("takes a follow-up that lands after the wait, while the call still reads the plan, as the call's own")` in `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts`) —
  is recorded as unsettled, and its late reloads, when they arrive, are the call's own — as many as are outstanding, so two kitchen-wide attributes of `create-or-replace-groups` whose reloads both land late count both. The history events while a call runs are its own; any other one is a
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
  tokens (in, out, reasoning), its tool calls and its duration; `HI_CHAT_REASONING_EFFORT` sets the
  reasoning effort of the GPT deployments ([RML-18041](https://roomle.atlassian.net/browse/RML-18041)). The example page sends its
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
  take the library's group settings and a material for the whole kitchen (D36) —, and a root is
  `{ id, articleId, attributes?, contextData? }`. Which catalog fields say what an article is
  (`desc`, `category`), how big it is (`dimensions`), how it docks (`dockingVectors`), and what it
  contains (`subModules`), plus `cornerArticle`.
- **Trusted descriptions** (D8) — a desc says what an article is, not where the user may put it —,
  **one piece of furniture is one group** (D14), **never author a position** (D15).
- **Relations**: every root after the first names one neighbour — `rightOf`, `leftOf`, `onTop`
  (`align`, `gapMm`), `above` (`gapMm`), `behind`; wall units beside a tall unit, corner kitchens,
  and the default for a root without a relation (D34).
- **Docking vectors**: how to read the `contextData` of a group from `get-plan-context`, and the
  vectors `merge-article-into-group` names in `dockTo`.
- **Placement**: the point and the rotation taken from the walls array, the table of room corners,
  and the right-handed corner article.
- **Obstacles** (D45): what the `obstacles` section lists, that a root module cannot stand where an
  object or another group's root module overlaps it in outline and height range, and that the span of
  a door is kept free from the floor, the span of a window from its `bottomMm` — base units lower
  than that fit below a window. Free spots and free stretches of wall are the ones `obstacles` leaves.
- **Extending** — at the end of a row with `merge-article-into-group`, between two root modules
  with `insert-article-into-group` —, moving with `place-group`, editing with the command tools and which
  end of a row moves in a row edit (D41, D42), verifying results
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
- Results that change the plan carry `corrections` when the server corrected the input, and
  `create-or-replace-groups` reports the groups it could not build in `notLoaded` (§2.3).

### 5.4 The plan context (`get-plan-context`)

One coordinate system throughout: 3D, right-handed, Y up, millimetres. A contour point is
`[x, level, -y]`, the same system as a group's `pos`.

| Section | Content |
|---|---|
| `rooms` | `{ rooms: [{ levels, walls }] }`. `levels`: the contour per level, segments with `cmd`, `pos`, `type` (e.g. `wall`, or none for an opening), `height`, `thickness`. `walls`, derived per room: `index`, `side` (as seen in the top view), `name` (back wall, front wall, left wall, right wall), `start`/`end` (`[x, 0, z]` on the floor), `lengthMm`, `type` (`wall`, or `opening` for a door — the contour gives it no type), `heightMm`, `thicknessMm`, `facingRotationY` — the rotation of a group with its back against that wall. `corners`, per room: `name` (back left, back right, front left, front right), `point` and `posRotationY` — the rotation of a corner kitchen in that corner. The server adds the names, the opening type and the corners (C18) |
| `articles` | The catalog: `articleId`, `articleName`, `desc`, `category`, `libraryId`, `catalog`, `cornerArticle`. Per root module: `module` (id, name, desc), `dimensions` (size attributes with id, name and value in mm), `mainAttributes`, `dockingVectors` (names), `insertLevels`, `subModules` (id, name, desc). The server sets `cornerArticle` also on an empty plan (from the category or the module name) and removes `cornerPoint` (D10) |
| `groups` | Per group: `id`, `libraryId`, `attributes`, read-only `position` (`pos`, `rotationY`, `footprint` with `x`, `z`, `widthMm`, `depthMm`), and `roots`. `pos` and `rotationY` are what a placement would name for the group where it stands: `pos` the room point of its back left bottom corner — the docking corner of its anchor root — and `rotationY` the rotation of the placement; the footprint is measured from `pos`. A group with two corner articles also carries `rootId`, the corner article `pos` belongs to, as in a placement (D17): the planner regenerates root ids, so the corner a placement named cannot be told after the load. The server derives them from the planner's calculated groups, wherever the planner keeps the group origin (D33); a group the planner has not positioned keeps the planner's `position`. Per root: the article pick (`id`, `articleId`, input `attributes`, `contextData` with vector names only) and read-only facts (`articleName`, `desc`, `category`, `isGenerated`, `dockingVectors`, `freeDockingVectors`, `subModules` with their id). No root positions, no geometry |
| `masterData` | Only when requested. Per library id: the root modules (`id`, `name`, `desc`, assigned attribute ids) — the article roots and the roots the library generates (worktop `mr_Countertop`, toe kick, finger grip, backsplash, …: the sub modules of the master data's `Root` group), so the worktop colour `mod_CountertopColor` is found — and the customer-facing attributes (`id`, `name`, `desc`, `type`, `group`, `selections` with value, name and desc) |
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
| `create-or-replace-groups` | yes | `{ loaded, groups, hint? }` |
| `place-group` | yes | `{ placedIn, wall, group }` |
| `change-module-attribute`, `change-group-attribute`, `delete-group`, `delete-root-module`, `remove-article-from-group`, `merge-article-into-group`, `insert-article-into-group`, `exchange-root-module`, `swap-root-modules`, `merge-groups` | yes | `{ command, groups, removedGroupIds, changedModuleIds?, gapClosed?, corrections?, hint? }` |
| `undo`, `redo` | yes | `{ undone \| redone, groups, hint? }` |
| `get-price` | no | the planner's price result |
| `get-order-data` | no | the order data, or `null` |
| `get-plan-images` | no | two images |

### get-plan-context

| Parameter | Type | Default |
|---|---|---|
| `include` | `('masterData' \| 'rooms' \| 'articles' \| 'groups' \| 'obstacles')[]` | rooms, articles, groups, obstacles |

The server passes the planner's plan context through. In the articles it sets `cornerArticle` and
removes `cornerPoint` (C7); every door and window of the obstacles gets its wall (C21).

### find-attributes

| Parameter | Type | Default |
|---|---|---|
| `text` | non-empty string | — |
| `libraryId` | string | all libraries |

The server searches the compacted master data case-insensitively: attribute id, name, desc, group,
and per selection its name, desc and value. A match is the attribute with its `libraryId` and the
`rootModules` that carry it. It returns at most 20 matches, the `total`, and a `hint` to narrow the
text when there are more.

### get-authoring-rules

No parameters. Answered by the server without a planner call, so it works without a connected page.

### create-or-replace-groups

| Parameter | Type |
|---|---|
| `posGroups` | non-empty array of pos groups (§5.2) |

A group whose id is in the plan is **replaced** and keeps its position (the planner keeps root ids
that already exist). Every other group is **created** with regenerated ids, and the docking
references are remapped.

The server runs these steps:

1. It drops generated roots (C1) and prepares each group: it drops docking it cannot read (G29),
   takes units written inside the docking as roots (G23), completes the docking entries (G24, G25), reports the fields it does not use
   (G27), reads the attribute overrides (G28), and corrects positions, root ids, repositioning data
   and the placement (G1–G14).
2. It reduces the roots to article picks and strips the docking indices (C2, C3).
3. It reads the article ids in the catalog's spelling (G15), compiles the relations into docking
   entries (D34, C15, C16, G31–G45), reports the roots a new group names in its docking but never
   sends (G26), completes the docking (G7, G8), and drops a placement on a group that is already in
   the plan (G16).
4. For every placed group, it learns the frame of the anchor — its docking corner and, for a corner
   article, its turn — by a probe load, once per library, article and attribute set (C6, G17).
5. It turns the placement into the planner's repositioning of the anchor root (C5, C6). The group
   reaches the planner with `id`, `libraryId`, `roots`, `attributes` and the repositioning.
6. It loads the groups that can be built in one call with `reason: 'adjusted'`, reads the groups,
   and adds a hint for a group of the call that has no position.
7. It sets the kitchen-wide attributes (D36) — the group attributes that are not among the loaded
   group's settings, the overrides moved off the roots (G47) and the colours of the generated roots
   it dropped (G48) — on every unit of the group with the planner's `change-group-attribute` command
   (G46), and reads the groups again.

A group that cannot be built at one of these steps leaves the call and goes to `notLoaded`; the
others go on.

**Result**: `loaded` (the planner's runtime ids), `groups` (**every** group in the plan, in the
plan-context shape), `hint`, `corrections` (what the server changed in the input), and `notLoaded`
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
the group once, with its roots — the generated ones included — and docking unchanged. A group that
already stands where asked is not reloaded.

**Result**: `placedIn` (`corner` or `wall`), the `wall`, the resulting `group`, and `corrections`
when the server corrected the request — an overlap moves the group along the wall (D27), an
alignment parallel to the wall centres it.

### The command tools

Each command tool forwards one command to the planner (`externalObjectGroupOperation`), which edits
the group with its own features and answers once the result is loaded. The group keeps its
position.

| Tool | Parameters | Server before forwarding | Planner |
|---|---|---|---|
| `change-module-attribute` | `rootModuleId`, `moduleId?`, `attributeId`, `value` | resolves the root id (C17) | sets the attribute of the root or of its sub module (P1, P2) |
| `change-group-attribute` | `groupId`, `attributeId`, `value` | resolves the group id (G18) | sets it on every module that has it (D20, P3) |
| `delete-group` | `groupId` | resolves the group id | removes the group |
| `delete-root-module` | `rootModuleId` | resolves the root id (C17) | deletes the root module and leaves the gap: root modules no longer docked together become separate groups where they stand (P4, D40) |
| `remove-article-from-group` | `groupId`, `rootModuleId` | resolves the group id and the root id (C17) | removes the root module and closes the gap; a root module with a neighbour on one side only is removed and nothing else moves; a corner article between two legs or the only root module is deleted instead, reported with `gapClosed: false` (D40, P4) |
| `merge-article-into-group` | `groupId`, `articleId`, `attributes?`, `dockTo { rootId, ownDockingVector, dockingVector, mode?, offset? }` | resolves the group id and `dockTo.rootId` (C17), reads the article id in the catalog's spelling (G15), moves an occupied side to the free end of the row (D29), derives a missing partner vector (P7) and the hang gap of a wall unit on a floor unit (D35) | docks the article as a new root module (P5–P8) |
| `insert-article-into-group` | `groupId`, `articleId`, `attributes?`, `between [rootId, rootId]` | resolves the group id and the root ids (C17), reads the article id in the catalog's spelling (G15), inserts beside the first-named root when the two are no neighbours (C19, G52) | docks the new root module between the two, whatever the group and the article (D44); the root modules at a wall stay (D41, P14, P16) |
| `exchange-root-module` | `groupId`, `rootModuleId`, `articleId`, `attributes?` | resolves the group id and the root id (C17), checks the article (G15) | replaces the root module, which keeps its docking; `attributes` override attributes of the new root module, e.g. another width, and the other root modules move by the difference; a docking the new article cannot take is named in `corrections` (P9, C20) |
| `swap-root-modules` | `groupId`, `rootModuleIds [rootId, rootId]` | resolves the group id and the root ids (C17); one root twice is an error (G53) | the two root modules change places with their attributes and the wall units above them (D42, P15) |
| `merge-groups` | `targetGroupId`, `groupIds` | resolves every group id | merges where they stand: nothing is moved, no docking is added (P10) |

`value` is a string, a number (passed on as its string) or a boolean. **Result**:
`{ command, groups, removedGroupIds, changedModuleIds?, gapClosed? }` — the affected groups in the plan-context
shape, and for `remove-article-from-group` whether the gap was closed — plus `corrections` when the server corrected the input before forwarding, followed by the planner's corrections, each named by its tool (C20).

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
6. The call moves to the other list. The result names the tool and returns every group of the plan
   in the plan-context shape.

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

- **A new group** gets `placement { posGroup, posRotationY, rootId? }`:
  - `posGroup` is the room point of the group's back left bottom corner (`y` = 0 on the floor; for
    wall units only, their mounting height).
  - `posRotationY` is in degrees, counter-clockwise from above (D13).
- **Against a wall**: `posRotationY` is the wall's `facingRotationY`. `posGroup` is the wall's
  `end` (flush into that corner) or `end + d · (start − end) / lengthMm`. The group runs from
  `posGroup` towards `start`.
- **In a room corner**, a corner kitchen starts with a corner article. `posGroup` and `posRotationY`
  are the `point` and the `posRotationY` of the corner in the room's `corners` list (§5.4) — the
  `facingRotationY` of the wall that ends in the corner. For a rectangular room (back = top):

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
- **The anchor**: the root whose back left corner goes to `posGroup`. The server finds it (C5) and
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
- **Overlaps**: in `place-group`, a target that overlaps another group is moved along the wall
  (D27). Groups may touch.

## 8. Guards, corrections and feedback

### 8.1 How feedback reaches the agent

| Channel | When | Content |
|---|---|---|
| `corrections` | the server changed the input | One sentence per correction: the group (input index and id) or the command, what was sent, and what the server did. In `create-or-replace-groups`, `place-group` and the command tools that take a root id or an article — `change-module-attribute`, `delete-root-module`, `remove-article-from-group`, `merge-article-into-group`, `insert-article-into-group`, `exchange-root-module`, `swap-root-modules` —, there followed by the planner's corrections (C20) |
| `notLoaded` | a group of `create-or-replace-groups` cannot be built, or a group loads without some of its roots | `[{ index, id?, rootIds?, errors }]`, each error naming what to send instead; the other groups and roots load |
| `hint` | something to check; nothing stopped | an unpositioned group and a new group at the place of another (`create-or-replace-groups`), what a row edit did to the row (D42, D43), more than 20 matches (`find-attributes`), why `undo` or `redo` reverted nothing, groups that differ after an `undo` or `redo` (§8.8) |
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
| C1 | Roots marked `isGenerated` (worktop, toe kick) are dropped from a `create-or-replace-groups` payload; the library regenerates them, and their input attributes are set again after the load (G48). `place-group` keeps them in its reload, so they keep their attributes — the worktop colour — over the move | `prepareGroup`; `repositionedGroup` |
| C2 | The read-only fields of a group from `get-plan-context` are ignored: per root `articleName`, `desc`, `category`, `imageUrl`, `isGenerated`, `dockingVectors`, `freeDockingVectors`, `subModules`, `logMessages`; per group `position`, `logMessages`. Every other field the server does not use is reported (G27). The group `attributes` reach the planner | `prepareGroup`; the field strip of `create-or-replace-groups` |
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
| C16 | A relation is written as a docking entry on the root the planner reaches first — breadth-first from the first root —, mirrored with the offset negated when its target comes later; the planner applies an offset only in the direction of the entry | `relationsToDocking` |

### 8.3 `create-or-replace-groups`

G23–G25 and G29 concern docking written as `contextData`; a payload with relations (D34) has its own
corrections, G31–G45.

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
| G7 | roots the docking does not connect to the first root — an entry connects in both directions, as the planner mirrors every entry before it arranges from the first root (guarded by `it('accepts a root docked by an entry written on the new root')`) | adds a docking entry (`dockingVector`, `mode` `StartStart`, `offset` `[0, 0, 0]`) that docks the part to the free end of a row of its kind — floor units or wall units (catalog category "Wall Units", also "Wallunits") | correction naming the roots and the entry |
| G7 | a part that cannot be docked: no free end, a wall unit without a reached wall-unit row. An article the catalog lists without docking vectors counts as having them — unknown, not undockable; a range hood, whose category does not say "Wall Units", joins the floor row | does not build the group | `notLoaded` with the docking entry to send |
| G8 | two roots on one side vector (`LeftBottom`, `RightBottom`) at the same place — the same mode and offset. Partners the mode or the offset separates (a shallow unit at the back and one at the front of a deep unit's side, a unit further along the row), several partners on a Top vector or on `BackBottom`, and a unit on top of another are no conflict (guarded by `it('accepts roots on one side vector that the mode or the offset separates')`) | docks the later one to the free end of that row; when the row ends at a corner article, to the free end of the leg in the other direction | correction |
| G8 | the same, where the later root already follows in that row (a chain plus an extra entry on the first root) | drops the extra entry | correction |
| G9 | `repositioningData` | takes it as the placement, or drops it beside a placement | correction |
| G10 | a placement that is not an object | does not use it: no `repositioningData`, the planner positions the group | correction |
| G11 | other placement fields (`wall`, `alignment`, `offsetMm`, …) | drops them; points to `place-group` for the wall fields | correction |
| G12 | `posGroup` `[x, z]` | completes it to `[x, 0, z]` | correction |
| G12, G13 | another `posGroup`, or no numeric `posRotationY` | does not use the placement, as G10 | correction |
| G14 | a `rootId` that names no root | drops it; the server picks the anchor | correction |
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
| G46 | a group attribute that is not one of the library's group settings (D36) | sets it on every unit and generated root of the loaded group with `change-group-attribute` | correction: "mod_FrontColor \"215\" was set on every unit of group '…'"; the planner's answer when it cannot — P3, no module has it — as the correction "… could not be set on group '…' - …" |
| G47 | a root override of an attribute the unit's own module does not carry but a generated root module does — the master data's root modules no catalog article has (`mod_CountertopColor` on a base unit) | moves it off the root and sets it on the whole group (G46) | correction |
| G48 | the input attributes of the generated roots C1 drops from a resubmitted group (the worktop colour) | sets them on the group again after the load (G46) | correction |
| G49 | `dockTo { rootId, ownDockingVector, dockingVector }` on a root — the field of `merge-article-into-group` — or `dockTo { id, relation }` | reads it as the relation it describes — the `relation` named inside, else by the vectors: `RightBottom -> LeftBottom` = `rightOf`, the mirror = `leftOf`, a Top → Bottom pair = `above`, `BackBottom -> BackBottom` = `behind`; a pair it cannot read, or a root that names a relation already, drops it | correction |
| G50 | a group id the agent gave an earlier group of this session, which the planner renamed | reads it as that group — a replace; G16 drops the placement | correction: "group id 'kitchen1' names the group '…' created earlier - it was replaced" |
| G51 | a wall unit `rightOf` / `leftOf` a tall unit on a side without a floor unit, while the other side has one — it would hang over empty floor | moves it to the side of the floor units, with the wall units chained to it | correction: "wall units '…' go leftOf the tall unit '…', on the side of the base units" |
| — | no group of the call can be built | — | error result: "Invalid pos groups - nothing was loaded: …" with every error |
| — | the planner loads nothing | — | error result: "No groups were created or replaced …" |
| — | a replaced group that still holds its previous articles instead of the ones sent — the planner could not calculate the new layout and restored the group (roomle-ui `_discardCalculation`) | — | correction: "the planner could not calculate the new layout of group '…' and kept its previous content - …; send the layout again with another article" |
| — | a group of the call has no position after the load | — | `hint` |
| — | a new group that stands at the place of another group — the same point within 5 mm and the same rotation (D22: never refused) | — | `hint`: "Group '…' stands at the place of group '…' - if the units belong together, send them as one group or join them with merge-groups" |

### 8.4 `place-group`

| ID | Input | What the server does | Feedback |
|---|---|---|---|
| G18 | a group id that is neither an id nor a unique prefix (also in the command tools) | nothing | error: "Group '…' not found. Groups in the plan: …" |
| G19 | a room or wall index outside the plan, a side without a real wall | nothing | error: "Room index … not found" / "Wall '…' not found … Available walls: …" |
| G20 | an alignment that names the target wall or the opposite one | centres the group on the wall | correction |
| G21 | a group without calculated geometry | nothing | error: "Group '…' has no calculated geometry to place." |
| G22 | a target that overlaps another group — footprints and height ranges overlap by more than 5 mm | moves the group along the same wall to the nearest position free of overlap. Touching is no overlap, wall units above another group's base units do not overlap them, and a group without height data overlaps nothing (`volumesOverlap`, guarded by `it('does not count touching groups, groups above each other or groups without height data')` in `plan-space.test.ts`) | correction naming the group and the distance, suggesting `merge-groups` if the units belong together |
| G22 | the same, placed into a corner or without a free position on the wall | places the group as asked | correction: "… overlaps group '…' - there is no free position …" |
| — | a group that already stands where asked (origin within 5 mm, same rotation) | no reload | correction: "Group '…' already stands at the … wall as asked - nothing was reloaded" |
| — | the reload fails | — | error: "Group '…' could not be reloaded at the new position." |

### 8.5 Command tools

**In the server, before forwarding:**

| ID | Input | What the server does | Feedback |
|---|---|---|---|
| G18 | an unknown group id | nothing | error with the groups in the plan |
| C17 | a root module id that is a unique prefix of a root id, differs from one root id only in its first UUID segment, or differs from one in a single character (`change-module-attribute`, `delete-root-module`, `remove-article-from-group`, `exchange-root-module`, `dockTo.rootId` of `merge-article-into-group`, `between` of `insert-article-into-group`, `rootModuleIds` of `swap-root-modules`) | reads it as that root | correction: "root id '…' was read as '…'" |
| C17 | a root module id that matches no root, or more than one | forwards it as sent | the planner's P11 with "Roots in the plan: …" appended |
| G15 | an article id in another spelling (`merge-article-into-group`, `insert-article-into-group`, `exchange-root-module`) | reads it in the catalog's spelling | correction |
| C19 | `insert-article-into-group` with two roots of one row that are no neighbours | inserts the unit beside the first-named root, towards the second — the walk passes a corner article | correction: "'r1' and 'r3' are not neighbours - the unit was inserted between 'r1' and 'r2', the neighbour of 'r1' towards 'r3'" |
| G52 | `insert-article-into-group` with two roots that are in no row together | nothing: the server cannot tell where the unit goes | error naming the side neighbours of the first root and asking for two neighbours of one row |
| G53 | `swap-root-modules` naming one root twice | nothing | error asking for the two units that change places |
| C20 | a correction of the planner (a dropped docking, a hung unit moved to another carrier, a deletion instead of a remove) | passes it on after the server's own, named by the tool | correction |
| D43 | an insert, a remove, an exchange or a swap that makes the row reach past a wall of the room, or overlap another group that stood beside it before (not a group the edit split off) | builds it | `hint`: "the row now reaches past a wall of the room - …" / "the row now overlaps group '…'" |
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
| P2 | "Module '…' has no attribute '…'." (`find-attributes` names the modules that have it) |
| P3 | "No module of group '…' has the attribute '…'." |
| P4 | "Root module '…' is generated by the library and cannot be deleted." (`remove-article-from-group`: "… cannot be removed.") |
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
| Overlap tolerance of `place-group` | 5 mm | `OVERLAP_TOLERANCE_MM` |
| Wait for the follow-up reload of an attribute change or exchange | 2 s | `FOLLOW_UP_WAIT_MS` |
| Wait for the history event of a planner undo or redo | 1 s | `HISTORY_EVENT_WAIT_MS` |
| Wait in `undo` for a late follow-up reload of the last call | 2 s | `FOLLOW_UP_WAIT_MS` |
| Comparison of the plan before and after a tool call | 0.1 mm | `groupsKey` |
