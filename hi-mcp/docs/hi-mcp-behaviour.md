# HI MCP server — behaviour

> **Living reference.** It describes how the HI MCP server (`hi-mcp/hi-mcp-poc-json`) behaves towards an
> agent: the guidelines and decisions it follows, its tools, the information it provides, and every
> guard, automatic correction and feedback message. Every change to a tool, a served rule, a guard, a
> correction or a result updates this document in the same change.
>
> **State**: the code of 2026-10-02, after the refactoring of the guards
> ([analysis and plan](../../.agents/refactoring-analysis/guards-in-the-hi-mcp-server.md)). A decision
> that is not implemented yet would be marked **Planned**; none is.
>
> **Not covered here**: setup, clients and deployment. See
> [hi-mcp-server.md](../../minimal-hi-example/docs/hi-mcp-server.md) (the example page and MCP
> clients), [hi-mcp-poc-json/README.md](../hi-mcp-poc-json/README.md) (server setups and environment
> variables) and [cloudflare-mcp-server.md](cloudflare-mcp-server.md).

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
([ADR 0001](../../.agents/decisions/0001-hi-mcp-tool-logic-in-the-server.md)).

Two parts have different responsibilities:

- **The MCP server** decides what the agent is told and how the agent's input becomes planner calls.
  Its guards and corrections follow the [guidelines](#2-guidelines) of this document.
- **The planner** (roomle-ui `homag-intelligence`) decides what can be built. Its checks protect the
  planner from breaking, and they are not loosened for the agent. Where it can, the server corrects
  the input before forwarding it, and it passes the planner's messages on to the agent
  ([§8.5](#85-command-tools)).

## 2. Guidelines

### 2.1 The agent declares what and where, the planner arranges

The agent picks articles, sets their attributes, docks them to each other, and gives a new group
one point and one rotation. The planner calculates every root position. The server completes
everything else: the article template, the docking indices, the anchor root, and the corner frame of
a corner article.

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
[AGENTS.md — Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort).

### 2.3 Feedback to the agent

Every result tells the agent what happened:

- **what was built** — the resulting groups with their position
- **what the server corrected** — a `corrections` list, one sentence per correction
- **what was not built, and why** — a `notLoaded` list (`create-or-replace-groups`) that names what to send instead
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
- **Never mention internals**: `repositioningData`, the corner frame, the corner probe, `rootRelPos`,
  `cornerPoint`. `tests/hi-mcp-server.test.ts` guards this
  ("never tells the agent how the server positions a group internally").

## 3. Decisions

Decisions about the behaviour towards the agent. **State**: *in effect* (implemented), *planned*
(decided, not implemented yet), *superseded* (replaced by a later decision, kept for the record).

### Architecture

| # | Decision | Date | Source | State |
|---|---|---|---|---|
| D1 | The tool logic runs in the MCP server. Pages execute only the planner methods on their allow-list, and the allow-list is the page's security boundary | 2026-09-29 | [ADR 0001](../../.agents/decisions/0001-hi-mcp-tool-logic-in-the-server.md) | in effect — `tool-executors.ts`, `planner-api.ts` |
| D2 | Planner methods that place orders or overwrite the plan are added to the allow-list only by explicit decision | 2026-09-29 | ADR 0001 | in effect |
| D3 | Group edits are commands the planner performs with its own group features (`externalObjectGroupOperation`); `update-attribute` is retired | 2026-09-30 | [command API](../../.agents/feature-analysis/hi-mcp-command-api.md) Q1 | in effect |
| D4 | Tools that change the plan run one after another, never side by side | 2026-09-30 | `oneAtATime`, `tool-executors.ts:602-615` | in effect |
| D5 | The planner's checks protect the planner and are not changed for the agent. The server corrects input before forwarding it | 2026-10-02 | user decision | in effect |
| D6 | In the planner, merge, split, delete and move are always carried out, even if the result is incorrect; the errors of a previous operation never block the next one | 2026-10-01 | user rule (RML-18017, roomle-ui glue logic) | in effect (roomle-ui) |

### Information for the agent

| # | Decision | Date | Source | State |
|---|---|---|---|---|
| D7 | `imageUrl` is stripped from every JSON result: signed CDN URLs no agent can open, three quarters of the plan context's tokens | 2026-10-01 | [tool results exceed the context](../../.agents/bug-analysis/tool-results-exceed-mistral-context.md) | in effect — `withoutImageUrls`, `hi-mcp-server.ts:75-84` |
| D8 | Every `desc` is authoritative, and `dimensions` give an article's size — over the catalog images only. A wrong `desc` is fixed in the library data, never worked around in the instructions | 2026-10-01 | [article size and trusted descriptions](../../.agents/feature-analysis/article-size-and-trusted-descriptions.md) | in effect — rules `hi-mcp-server.ts:8` |
| D9 | The groups of the plan context carry no parts and no log messages | 2026-10-01 | [plan context without parts](../../.agents/refactoring-analysis/hi-plan-context-without-parts.md) | in effect (roomle-ui) |
| D10 | The agent is never told how the server positions a group internally; the articles' `cornerPoint` is removed from the plan context | 2026-09-30 | [group placement](../../.agents/feature-analysis/group-placement-computed-in-the-mcp-server.md) P3 | in effect — `agentFacingArticle`, `tool-executors.ts:177-183` |
| D11 | A group returned by `get-plan-context` is a valid `create-or-replace-groups` payload as it is | 2026-09-16 | rules `hi-mcp-server.ts:7` | in effect |
| D12 | Walls are named by their side in the top-view image — `left`, `right`, `top`, `bottom`; the text maps back = top, front = bottom | 2026-09-02 | [repositioning data](../../.agents/refactoring-analysis/group-placement-via-repositioning-data.md) D7 | in effect |
| D13 | Rotations are counter-clockwise as seen from above; a group against the right wall has 270, against the left wall 90 | 2026-09-29 | repositioning data D1 | in effect |

### Authoring and positioning

| # | Decision | Date | Source | State |
|---|---|---|---|---|
| D14 | One kitchen is one group: units beside, above or back to back are docked roots of the same group | 2026-09-29 | rules `hi-mcp-server.ts:9` | in effect (rule) |
| D15 | A root is an article pick; root positions come from the docking only | 2026-09-16 | rules `hi-mcp-server.ts:7`, `:10` | in effect |
| D16 | A new group is positioned with `placement { posGroup, posRotationY, rootId? }`, applied once, when the group is created; the server anchors it | 2026-09-30 | group placement | in effect |
| D17 | With two corner articles, `rootId` names the one that goes into the corner `posGroup` names | 2026-09-30 | group placement P1 | in effect |
| D18 | The server places a corner article by its corner point and turns a right-handed one by 90° itself | 2026-09-30 | group placement; `toRepositioningData` | in effect |
| D19 | `merge-article-into-group` positions by docking (`dockTo`), never by coordinates | 2026-09-30 | command API Q3 | in effect |
| D20 | `change-group-attribute` sets the attribute on every root and sub module of the group whose master-data module carries it, in one calculation | 2026-09-30 | command API Q2 | in effect |
| D21 | `place-group` works on the calculated group, keeps the group's height, and returns `{ placedIn, wall, group }`; it knows walls and corners, not free points | 2026-09-30 | [place-group](../../.agents/feature-analysis/reintroduce-place-group-tool-in-the-server.md) Q1, Q3–Q5 | in effect |
| D22 | A group outside the room is never refused, removed or warned about: the user may ask for it | 2026-10-01 | [outside the room](../../.agents/bug-analysis/new-group-outside-the-room-accepted.md) (rejected fix) | in effect |
| D23 | `placement { wall, alignment, offsetMm }` in `create-or-replace-groups` — deferred, "ask first" | 2026-09-30 | place-group D2 | deferred |
| D24 | `place-group` rejects a target that meets another group (contact guard) | 2026-09-30 | place-group D1 | superseded by D27 |
| D25 | A placement on a group that is already in the plan is rejected | 2026-09-30 | group placement | superseded by D26 |

### Guards and corrections (2026-10-02)

| # | Decision | Source | State |
|---|---|---|---|
| D26 | **A conflicting placement creates no `repositioningData`.** For a placement on a group that is already in the plan, or a placement the server cannot use, the server sends no `repositioningData`, and the planner (roomle-ui, RoomleCore) positions the group — an existing group keeps its position. The result says that the placement was not used | user decision 1 | in effect — `normalizePlacement`, `tool-executors.ts` |
| D27 | **Intersecting groups are allowed** (`place-group`). When the target overlaps another group, the server corrects the position along the wall and informs the agent; it never rejects. Touching is not an overlap | user decision 2 | in effect — `freePlacementAlongWall`, `tool-executors.ts` |
| D28 | **Unconnected roots are connected automatically.** The server adds a docking entry (`PosDockedContextRoot`: `dockingVector`, `mode`, `offset`) that docks them to the free end of the row. The guard stays for roots that cannot be connected | user decision 3 | in effect — `connectUnreachedRoots`, `tool-executors.ts` |
| D29 | **A unit docked to an occupied side goes to the free end of that row** (`merge-article-into-group`, and two roots on one side vector in `create-or-replace-groups`) | user decision 4 | in effect — `separateSideVectorPartners`, `dockTarget`, `tool-executors.ts` |
| D30 | **A call loads every group that can be built** and reports the others with what to send instead | user decision 5 | in effect — `keepBuildable`, `tool-executors.ts` |
| D31 | Guards are a last resort; the server corrects and informs, and gives feedback where it cannot correct | user guideline | in effect — §8 |

## 4. How a tool call runs

- **MCP endpoint**: `POST /mcp` — Streamable HTTP, JSON response mode, stateless (a new transport per
  request), port 3100 (`HI_MCP_PORT` or `PORT`). On Cloudflare, `?session=` routes to a per-session
  container.
- **Page bridge**: the page connects to the WebSocket `/bridge` (origins in `HI_MCP_PAGE_ORIGINS`),
  announces bridge protocol 2, and executes the planner methods the tools send on
  `roomDesignerApi.extended`.
- **Planner methods** (`planner-api.ts`), with the timeout per call:

  | Method | Used by | Timeout |
  |---|---|---|
  | `getExternalObjectPlanContext(include)` | every tool that reads the plan | 30 s |
  | `loadExternalObjectGroupLayout(layout, 'posGroups', { reason: 'adjusted' })` | `create-or-replace-groups`, `place-group`, the corner probe | 120 s |
  | `externalObjectGroupOperation(command, payload)` | the command tools | 120 s |
  | `getExternalObjectGroups()` | `place-group`, the corner probe (calculated geometry) | 30 s |
  | `removeExternalObject(id)` | the corner probe (removes its probe group) | 30 s |
  | `fetchPrice()` | `get-price` | 30 s |
  | `getExternalObjectSnapshot(options)` | `get-order-data`, `get-plan-images` | 120 s |

- **One plan change at a time.** The tools that change the plan wait for each other (D4). The corner
  probe tells its own groups by comparing the plan before and after its load, and a concurrent load
  would disturb that.
- **The HI chat** (`hi-mcp-chat`) is an MCP client of this server. It gives the model a
  three-sentence system prompt and **not** the server's instructions, so the model learns the rules
  only when it calls `get-authoring-rules`. A chat turn has 16 steps; the last one cannot call a
  tool, so the turn always ends with an answer (`chat-steps.ts`).

## 5. Information the server provides

### 5.1 Server instructions (at initialize)

`INSTRUCTIONS` (`hi-mcp-server.ts:65-73`) contains the typical workflow followed by the full
authoring rules:

1. `get-plan-context` — rooms with walls, the article catalog, the groups; `masterData` or
   `find-attributes` for attributes.
2. `create-or-replace-groups` — the whole kitchen as one group: article picks, docking, one
   placement. A matching id replaces a group and keeps its position. Units next to an existing
   group are added to it.
3. The command tools to edit an existing group; `place-group` to move one.
4. `get-price` / `get-order-data` to check, `get-plan-images` to inspect.

Not every client passes these instructions to the model; the HI chat does not (§4).

### 5.2 Authoring rules (`get-authoring-rules`)

`AUTHORING_RULES` (`hi-mcp-server.ts:6-63`) is plain text. It is served at initialize and by the
tool. It covers:

- **The payload**: a group is `{ id?, libraryId?, placement?, roots }`, and a root is
  `{ id, articleId, attributes?, contextData? }`. Which catalog fields say what an article is
  (`desc`, `category`), how big it is (`dimensions`), how it docks (`dockingVectors`), and what it
  contains (`subModules`), plus `cornerArticle`.
- **Trusted descriptions** (D8), **one kitchen is one group** (D14), **never author a position**
  (D15).
- **Docking**: the entry is written on the placed root; the valid pairs (beside, on top, back to
  back); `mode` and `offset`; one neighbour per place on a side vector; recipes for a row, a wall
  unit above a base unit, an island and a room corner.
- **Placement**: the point and the rotation taken from the walls array, the table of room corners,
  and the right-handed corner article.
- **Extending**, moving with `place-group`, editing with the command tools, and verifying results
  numerically.
- **Five examples**: a row along a wall, wall units above base units, an L-shaped corner kitchen, a
  row centred on a wall, adding a unit with `merge-article-into-group`.

### 5.3 Result format

- **JSON results** are one text content with compact JSON. Every `imageUrl` is removed at any depth
  (D7).
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
| `rooms` | `{ rooms: [{ levels, walls }] }`. `levels`: the contour per level, segments with `cmd`, `pos`, `type` (e.g. `wall`, or none for an opening), `height`, `thickness`. `walls`, derived per room: `index`, `side` (as seen in the top view), `start`/`end` (`[x, 0, z]` on the floor), `lengthMm`, `type`, `heightMm`, `thicknessMm`, `facingRotationY` — the rotation of a group with its back against that wall |
| `articles` | The catalog: `articleId`, `articleName`, `desc`, `category`, `libraryId`, `catalog`, `cornerArticle`. Per root module: `module` (id, name, desc), `dimensions` (size attributes with id, name and value in mm), `mainAttributes`, `dockingVectors` (names), `insertLevels`, `subModules` (id, name, desc). The server sets `cornerArticle` also on an empty plan (from the category or the module name) and removes `cornerPoint` (D10) |
| `groups` | Per group: `id`, `libraryId`, `attributes`, read-only `position` (`pos`, `rotationY`, `footprint` with `x`, `z`, `widthMm`, `depthMm`), and `roots`. Per root: the article pick (`id`, `articleId`, input `attributes`, `contextData` with vector names only) and read-only facts (`articleName`, `desc`, `category`, `isGenerated`, `dockingVectors`, `freeDockingVectors`, `subModules` with their id). No root positions, no geometry |
| `masterData` | Only when requested. Per library id: the root modules (`id`, `name`, `desc`, assigned attribute ids) and the customer-facing attributes (`id`, `name`, `desc`, `type`, `group`, `selections` with value, name and desc) |

Default sections: `rooms`, `articles`, `groups`.

### 5.5 What the agent is not given

| Withheld | Why |
|---|---|
| `imageUrl` everywhere | The agent cannot open them, and they cost three quarters of the tokens (D7) |
| Root positions and geometry | Root positions come from the docking (D15) |
| Articles' `cornerPoint`, `repositioningData`, the corner frame | Internal to the server's placement (D10) |
| Parts and log messages of the groups | Not needed, and large (D9) |

## 6. Tools

| Tool | Changes the plan | Result |
|---|---|---|
| `get-plan-context` | no | the plan context (§5.4) |
| `find-attributes` | no | `{ matches, total, hint? }` |
| `get-authoring-rules` | no | the rules as text |
| `create-or-replace-groups` | yes | `{ loaded, groups, hint? }` |
| `place-group` | yes | `{ placedIn, wall, group }` |
| `change-module-attribute`, `change-group-attribute`, `delete-group`, `delete-root-module`, `merge-article-into-group`, `exchange-root-module`, `merge-groups` | yes | `{ command, groups, removedGroupIds, changedModuleIds? }` |
| `get-price` | no | the planner's price result |
| `get-order-data` | no | the order data, or `null` |
| `get-plan-images` | no | two images |

### get-plan-context

| Parameter | Type | Default |
|---|---|---|
| `include` | `('masterData' \| 'rooms' \| 'articles' \| 'groups')[]` | rooms, articles, groups |

The server passes the planner's plan context through. In the articles it sets `cornerArticle` and
removes `cornerPoint` (C7).

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

1. It drops generated roots (C1) and prepares each group: positions, root ids, repositioning data
   and the placement (G1–G14).
2. It reduces the roots to article picks and strips the docking indices (C2, C3).
3. It reads the article ids in the catalog's spelling (G15), completes the docking (G7, G8), and
   drops a placement on a group that is already in the plan (G16).
4. For a placed group whose anchor is a corner article, it learns the article's corner frame by a
   probe load, once per article and attribute set (C6, G17).
5. It turns the placement into the planner's repositioning of the anchor root (C5, C6) and strips
   every other group field.
6. It loads the groups that can be built in one call with `reason: 'adjusted'`, reads the groups,
   and adds a hint for a group of the call that has no position.

A group that cannot be built at one of these steps leaves the call and goes to `notLoaded`; the
others go on.

**Result**: `loaded` (the planner's runtime ids), `groups` (**every** group in the plan, in the
plan-context shape), `hint`, `corrections` (what the server changed in the input), and `notLoaded`
— `[{ index, id?, errors }]` for the groups it could not build (D30). A conflicting placement is
not sent (D26).

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
the group once, with its roots and docking unchanged.

**Result**: `placedIn` (`corner` or `wall`), the `wall`, the resulting `group`, and `corrections`
when the server corrected the request — an overlap moves the group along the wall (D27), an
alignment parallel to the wall centres it.

### The command tools

Each command tool forwards one command to the planner (`externalObjectGroupOperation`), which edits
the group with its own features and answers once the result is loaded. The group keeps its
position.

| Tool | Parameters | Server before forwarding | Planner |
|---|---|---|---|
| `change-module-attribute` | `rootModuleId`, `moduleId?`, `attributeId`, `value` | — | sets the attribute of the root or of its sub module (P1, P2) |
| `change-group-attribute` | `groupId`, `attributeId`, `value` | resolves the group id (G18) | sets it on every module that has it (D20, P3) |
| `delete-group` | `groupId` | resolves the group id | removes the group |
| `delete-root-module` | `rootModuleId` | — | removes the unit; units no longer docked together become separate groups where they stand (P4) |
| `merge-article-into-group` | `groupId`, `articleId`, `attributes?`, `dockTo { rootId, ownDockingVector, dockingVector, mode?, offset? }` | resolves the group id, reads the article id in the catalog's spelling (G15), moves an occupied side to the free end of the row (D29) and derives a missing partner vector (P7) | docks the new unit (P5–P8) |
| `exchange-root-module` | `groupId`, `rootModuleId`, `articleId` | resolves the group id, checks the article (G15) | replaces the unit, which keeps its docking (P9) |
| `merge-groups` | `targetGroupId`, `groupIds` | resolves every group id | merges where they stand: nothing is moved, no docking is added (P10) |

`value` is a string, a number (passed on as its string) or a boolean. **Result**:
`{ command, groups, removedGroupIds, changedModuleIds? }` — the affected groups in the plan-context
shape — plus `corrections` when the server corrected the input before forwarding.

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
- **In a room corner**, a corner kitchen starts with a corner article. `posGroup` is the corner
  point, with the rotation of the corner (rectangular room, back = top):

  | Corner | `posRotationY` | `RightBottom` row runs along | `LeftBottom` row runs along |
  |---|---|---|---|
  | left back | 0 | back wall, to the right | left wall, to the front |
  | left front | 90 | left wall, to the back | front wall, to the right |
  | right front | 180 | front wall, to the left | right wall, to the back |
  | right back | 270 | right wall, to the front | back wall, to the left |

  The table holds for both hands of corner article: the server turns a right-handed one by 90° more
  itself (D18).
- **The anchor**: the root whose back left corner goes to `posGroup`. The server finds it (C5).
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
| `corrections` | the server changed the input | One sentence per correction: the group (input index and id) or the command, what was sent, and what the server did. In `create-or-replace-groups`, `place-group`, `merge-article-into-group` and `exchange-root-module` |
| `notLoaded` | a group of `create-or-replace-groups` cannot be built | `[{ index, id?, errors }]`, each error naming what to send instead; the other groups load |
| `hint` | something to check; nothing stopped | an unpositioned group (`create-or-replace-groups`), more than 20 matches (`find-attributes`) |
| Error result | nothing in the call can be done | `create-or-replace-groups`: no group can be built, or the planner loaded none; the other tools: a guard of §8.4–8.6, or the planner's message |

A correction that the rules describe as normal is silent (§8.2). A correction of a mistake is
always reported.

### 8.2 Silent corrections

| ID | Correction | Where |
|---|---|---|
| C1 | Roots marked `isGenerated` (worktop, toe kick) are dropped; the library regenerates them | `prepareGroup` |
| C2 | Every root field other than the article pick, and every group field other than `id`, `libraryId` and `roots`, is ignored | `toArticlePick`; the field strip of `create-or-replace-groups` |
| C3 | Docking vector indices are stripped and resolved from the names | `stripDockingIndices` |
| C4 | A unique prefix of a group id is accepted | `findGroup` |
| C5 | The anchor is found by walking from the start root down to the floor unit carrying it, then left along its row, stopping at a corner article. A wall unit named as anchor leads to the base unit below it | `findAnchorRoot`, `group-placement.ts` |
| C6 | A corner article is placed by its corner point, and a right-handed one is turned by 90°. The frame is learned by a probe load and remembered per library, article and attributes | `toRepositioningData`; `probeCornerFrame` |
| C7 | `cornerArticle` is set on an empty plan from the category or the module name; `cornerPoint` is removed | `isCornerArticle`; `agentFacingArticle` |
| C8 | A docking entry that names a root outside the group connects nothing and is kept, so a resubmitted group whose unit was deleted still loads | `dockingNeighbours` |
| C9 | `place-group` defaults: alignment `center`, offset 0, room 0; the group keeps its height | `place-group` |
| C10 | `back` and `front` name the `top` and the `bottom` wall (`place-group` `wall` and `alignment`) | `sideLabel` |
| C11 | A number as an attribute value is passed on as its string | `attributeValue` |
| C12 | An unknown `get-plan-context` section is ignored; none left means the default sections | `get-plan-context` |

### 8.3 `create-or-replace-groups`

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
| G7 | roots the docking does not connect to the first root | adds a docking entry (`dockingVector`, `mode` `StartStart`, `offset` `[0, 0, 0]`) that docks the part to the free end of a row of its kind — floor units or wall units (catalog category "Wall Units") | correction naming the roots and the entry |
| G7 | a part that cannot be docked: an article with neither docking vectors nor a size (a range hood, a TV), no free end, a wall unit without a reached wall-unit row | does not build the group | `notLoaded` with the docking entry to send |
| G8 | two roots on one side vector at the same place (mode and offset) | docks the later one to the free end of that row | correction |
| G8 | the same, where the later root already follows in that row (a chain plus an extra entry on the first root) | drops the extra entry | correction |
| G9 | `repositioningData` | takes it as the placement, or drops it beside a placement | correction |
| G10 | a placement that is not an object | does not use it: no `repositioningData`, the planner positions the group | correction |
| G11 | other placement fields (`wall`, `alignment`, `offsetMm`, …) | drops them; points to `place-group` for the wall fields | correction |
| G12 | `posGroup` `[x, z]` | completes it to `[x, 0, z]` | correction |
| G12, G13 | another `posGroup`, or no numeric `posRotationY` | does not use the placement, as G10 | correction |
| G14 | a `rootId` that names no root | drops it; the server picks the anchor | correction |
| G15 | an article id in another spelling (case, whitespace) | reads it in the catalog's spelling | correction |
| G15 | an article id the catalog does not have | does not build the group | `notLoaded` with the valid article ids (the first 100) |
| G16 | a placement on a group that is already in the plan | does not use it; the group keeps its position | correction |
| G17 | a corner article the probe cannot calculate | does not build the group | `notLoaded`: "the corner article '…' could not be calculated" |
| — | no group of the call can be built | — | error result: "Invalid pos groups - nothing was loaded: …" with every error |
| — | the planner loads nothing | — | error result: "No groups were created or replaced …" |
| — | a group of the call has no position after the load | — | `hint` |

### 8.4 `place-group`

| ID | Input | What the server does | Feedback |
|---|---|---|---|
| G18 | a group id that is neither an id nor a unique prefix (also in the command tools) | nothing | error: "Group '…' not found. Groups in the plan: …" |
| G19 | a room or wall index outside the plan, a side without a real wall | nothing | error: "Room index … not found" / "Wall '…' not found … Available walls: …" |
| G20 | an alignment that names the target wall or the opposite one | centres the group on the wall | correction |
| G21 | a group without calculated geometry | nothing | error: "Group '…' has no calculated geometry to place." |
| G22 | a target that overlaps another group — footprints and height ranges overlap by more than 5 mm | moves the group along the same wall to the nearest position free of overlap. Touching is no overlap, and wall units above another group's base units do not overlap them | correction naming the group and the distance, suggesting `merge-groups` if the units belong together |
| G22 | the same, placed into a corner or without a free position on the wall | places the group as asked | correction: "… overlaps group '…' - there is no free position …" |
| — | the reload fails | — | error: "Group '…' could not be reloaded at the new position." |

### 8.5 Command tools

**In the server, before forwarding:**

| ID | Input | What the server does | Feedback |
|---|---|---|---|
| G18 | an unknown group id | nothing | error with the groups in the plan |
| G15 | an article id in another spelling (`merge-article-into-group`, `exchange-root-module`) | reads it in the catalog's spelling | correction |
| G15 | an article id the catalog does not have | nothing | error with the valid article ids |
| D29 | `merge-article-into-group` on a taken side vector | docks the unit to the root at the free end of that row | correction |
| P7 | a `dockingVector` the new article does not have (by the catalog) | uses the partner of `ownDockingVector` when the article has it | correction |

**In the planner** (roomle-ui `glue-logic.ts`, `hi-plan-context.ts`). These checks protect the
planner and stay as they are (D5); the server passes their message on as an error result.

| ID | Planner message |
|---|---|
| P1 | "Root module '…' has no sub-module '…'." |
| P2 | "Module '…' has no attribute '…'." (`find-attributes` names the modules that have it) |
| P3 | "No module of group '…' has the attribute '…'." |
| P4 | "Root module '…' is generated by the library and cannot be deleted." |
| P5 | "Root module '…' is not an article root of group '…'." |
| P6 | "Root module '…' has no free docking vector '…' - its free docking vectors: …" — reached only when the planner reports a side as taken although the row ends there (a stale docking entry after a deletion) |
| P7 | "Article '…' has no / more than one docking vector '…' - its docking vectors: …" |
| P8 | "Group '…' is still being calculated - try again once it is loaded." |
| P9 | "Article '…' has n root modules - a root module is exchanged with an article of exactly one." |
| P10 | "Groups of different libraries cannot be merged: …" |
| P11 | "Root module '…' not found." / "Group '…' is not in the plan." / "Article '…' is not in the article catalog." |
| P12 | "Another operation on group '…' is still in progress." (rare: D4) |
| P13 | payload-shape messages — not reachable, the server builds these payloads |
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
| "Planner call '…' timed out after …ms" | a planner call exceeded its timeout (§4) |
| "The demo page disconnected" / "The demo page was replaced by a newer one" | the page left during a call |
| the page's own error (e.g. a method not on its allow-list) | the planner call failed in the page |

## 9. Limits

| Limit | Value | Where |
|---|---|---|
| Planner call timeout | 30 s, 120 s for loads, commands and snapshots | `page-bridge.ts`, `planner-api.ts` |
| Chat steps per turn | 16, the last without tools | `hi-mcp-chat/chat-steps.ts` |
| `find-attributes` matches | 20 | `MAX_ATTRIBUTE_MATCHES` |
| Valid article ids in G15's message | 100 | `requireCatalogArticle` |
| Overlap tolerance of `place-group` | 5 mm | `OVERLAP_TOLERANCE_MM` |
