# Refactoring Analysis: Guards in the HI MCP server

> **Type**: Refactoring Analysis
> **Domain**: hi-mcp — the input checks of the tools (`hi-mcp/hi-mcp-poc-json/tool-executors.ts`, `plan-space.ts`), the zod schemas and the served rules (`hi-mcp-server.ts`); the planner-side checks of the command tools (roomle-ui `homag-intelligence/src/glue-logic.ts`, `hi-plan-context.ts`)
> **Trigger**: "Guards fight symptoms, but do not fix the root cause … when an agent creates wrong content, the root cause is that the MCP instructions are not good enough or misleading. Guards should always be treated as a last resort … analyse which guards are implemented and what they do. What do they prevent or discard?"
> **Date**: 2026-10-02
> **Author**: AI Assistant
> **Status**: Open
> **Ticket**: [RML-18033](https://roomle.atlassian.net/browse/RML-18033) — hi mcp guards and auto correction
> **Branch**: `docs/guards-as-last-resort`
> **Code read**: roomle-hi-example `bd69d38` (`master`); roomle-ui `e2712a6a7` (`origin/feat/hi-mcp-command-api-RML-18004`)
>
> **Decided (2026-10-02)**: the refactoring covers the MCP server only — the planner's checks (P1–P13)
> protect the planner and stay as they are. The server corrects whenever it can and informs the agent;
> where it cannot, it gives feedback and asks the agent to correct. The answers to the open questions
> are in [Decisions](#decisions-2026-10-02), the steps in [Implementation plan](#implementation-plan).
> The resulting behaviour, guard by guard, is documented in
> [`hi-mcp/docs/hi-mcp-behaviour.md`](../../hi-mcp/docs/hi-mcp-behaviour.md#8-guards-corrections-and-feedback).

The principle this analysis applies is in [`AGENTS.md` — Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort):
clarify the instructions, simplify the tool API, correct the input automatically, and reject only
as a last resort.

## Verdict

**How many.** The MCP server rejects agent input in **22 places** (G1–G22), the planner rejects
command input in **13 more** (P1–P13), and the tool schemas reject a call before any tool logic
runs in **6** (S1–S6).

**What they prevent.** Three kinds of outcome:

1. **A layout the planner would build wrongly, without an error** — roots stacked on the group
   origin (G7), two units in one place (G8), a corner group off its corner (G17), an existing
   group moved by a replace (G16), a group touching another (G22).
2. **A field the agent believes takes effect, but the server would drop anyway** — positions on
   groups and roots (G3, G5), unknown placement fields (G11). Without the guard, the server would
   ignore the field and load the group.
3. **Input that cannot be built** — no roots, no article id, an unknown article, group, root or
   wall, groups of different libraries.

**What they discard.** Always the whole call. A `create-or-replace-groups` call with one wrong
group loads **none** of its groups, `place-group` moves nothing, a command changes nothing.

**Assessment.** Only the third kind is a last resort. The second kind can be corrected today: the
server already knows what it would do with the field. The first kind exists because of the two
parts of the tool API that earlier analyses found too complex for the agents — **docking** and
**positioning**. There, the guards stand in for an API simplification.

## How a guard reaches the agent, and what it costs

- **The whole call is discarded.** `create-or-replace-groups` collects the payload errors of all
  groups and throws once, "Invalid pos groups - nothing was loaded" (`tool-executors.ts:755-757`,
  `:408-413`). The valid groups of the call are discarded with the wrong one.
- **The checks run in stages.** After the payload checks (G1–G14) come the catalog (G15, which
  throws on the first unknown article), the plan (G16) and the corner probe (G17). A payload with
  problems in two stages costs two rejected calls.
- **Every rejection costs a step.** The chat gives a turn 16 steps, and the last step cannot call
  a tool (`hi-mcp-chat/chat-steps.ts:3-15`). The corner findings count about seven steps for a
  complete flow (F-A3 of [agent-placement-in-a-room-corner-findings.md](../bug-analysis/agent-placement-in-a-room-corner-findings.md)).
  Every rejection adds one more step and the whole payload again.
- **A schema failure** returns "Input validation error" as an error result before the tool logic
  runs (`tests/hi-mcp-server.test.ts:304-316`).
- **The served rules announce the guards.** Eight sentences of the rules and the tool descriptions
  say what is rejected instead of how to succeed: `hi-mcp-server.ts:7`, `:10`, `:11`, `:13`, `:27`,
  `:180-181`, `:190-191`, `:212-213`.

**Evidence from the stored test suites** (Mistral Large, `bo-test`, `.temp/result/`):

- **11:35 suite** — `create-or-replace-groups` was rejected before any planner call in runs 05,
  06 and the setup of 12. `merge-groups` was rejected in 12, and `delete-group` in 13 (a guessed
  id). `delete-root-module` failed in 12's setup on `root_2`, an id the model had authored and the
  planner had regenerated.
- **12:08 suite**, with the side-vector guard (G8) and a room check that has since been reverted:
  the room check fired in 9 calls of 5 runs, and run 07 still failed after three rejections.
  `create-or-replace-groups` was rejected before any planner call in 03 and 06. Run 03 ended with
  the sink docked to the corner article's `LeftBack`, inside the corner cabinet. Whether a
  rejection turned the model there cannot be told: the rejection texts are not recorded, because
  `run.json` holds tool names only.
- **Both reports end with more hardening candidates**: a docking pair check, a window, a door,
  a wall cabinet inside a tower. Each of them would become another guard.

## Inventory

**Direction** applies the principle to each guard:

- **Keep** — a last resort: the input cannot be built, or its intent cannot be told.
- **Correct** — the intent is clear: the server corrects the input and says so in the result.
- **Simplify** — an API change removes the cause.
- **Decide** — a correction is possible but guesses the intent, so it needs a decision.

### A. `create-or-replace-groups` — payload checks before any planner call

Discards: every group of the call. All line numbers are in `tool-executors.ts`.

| ID | Guard | Rejects | Prevents | Direction |
|---|---|---|---|---|
| G1 | "needs a non-empty roots array" `:688-693` | a group without roots | a group with nothing to build | **Correct**: skip that group with a note, load the others |
| G2 | "needs at least one article root (generated roots are dropped)" `:694-701` | a group of worktop/toe kick roots only | the same | **Correct**: as G1 |
| G3 | "do not set pos/rotationY on a group" `:702-706` | `pos` or `rotationY` on a group | nothing in the planner: the field strip `:834-840` drops both before the load. The guard only stops the agent from believing its position took effect | **Correct**: drop with a note |
| G4 | "id / articleId must be a non-empty string" `:708-719` | a root without `id` or `articleId` | a root the docking cannot name; an article that cannot be built | **Correct** a missing `id` (the planner regenerates ids anyway); **Keep** for `articleId` |
| G5 | "a root module carries no articlePos/rotationY" `:720-725` | root coordinates | nothing in the planner: `toArticlePick` `:55-71` drops them. Same as G3 | **Correct**: drop with a note; the docking positions the roots |
| G6 | "duplicate root id" `:726-734` | two roots with one id in a group | docking entries that name an ambiguous root | **Keep** when a docking entry names the id; **Correct** (rename) when none does |
| G7 | "roots … are not docked to a placed root" — `dockingErrors` `:289-335` (`4f91b38`, [analysis](../bug-analysis/unconnected-docking-graph-accepted.md)) | a root the docking graph does not connect to the first root | the planner arranging the unconnected part from the group origin, on top of the first root, without an error | **Simplify** (docking, below); **Correct** — decision 3: connect to the free end of the row, keep the guard when impossible |
| G8 | "roots … are docked to the RightBottom of root … with the same mode and offset" — `sideVectorErrors` `:337-406` (`e0427b7`, [analysis](../bug-analysis/two-roots-on-one-side-vector-accepted.md)) | two roots on one side vector with the same mode and offset | two units in the same place | **Simplify**; **Correct** — decision 4 by analogy: the free end of the row |
| G9 | "repositioningData is not supported" `:741-746` (`e685809`) | `repositioningData` on a group | the agent's raw repositioning reaching the planner (the field strip keeps it, `:836`) without the server's anchor and corner frame | **Correct**: it has the fields of a placement (`posGroup`, `posRotationY`, `rootId`) — take it as the placement |
| G10 | "placement must be { posGroup, posRotationY, rootId? }" `:253-259` | a placement that is not an object | — | **Correct** — decision 1: no `repositioningData` |
| G11 | "placement takes only posGroup, posRotationY and rootId - remove …" `:261-272` (`e685809`) | any other field; for `wall`/`alignment`/`offsetMm` it points to `place-group` | stale fields mistaken for working ones | **Correct**: the unknown fields are dropped, with a note |
| G12 | "posGroup must be [x, y, z] in millimetres" `:273-275` | a `posGroup` that is not three finite numbers | a group at an undefined point | **Correct** `[x, z]` to `[x, 0, z]`; otherwise decision 1: no `repositioningData` |
| G13 | "posRotationY must be a number of degrees - state 0 explicitly" `:276-280` (`c52aeca`) | a placement without a rotation | a group turned to 0° that should face its wall | **Correct** — decision 1: no `repositioningData` |
| G14 | "rootId must be the id of one of the group's roots" `:281-285` | a `rootId` that names no root | — | **Correct**: drop it, the server picks the anchor as it does without it |

### B. `create-or-replace-groups` — checks against the plan

| ID | Guard | Rejects | Prevents | Direction |
|---|---|---|---|---|
| G15 | "articleId '…' is not in the article catalog … Valid article ids: …" — `requireCatalogArticle` `:131-153`, called at `:764` and by `merge-article-into-group` `:996-999` and `exchange-root-module` `:1016-1019` | an article id that is not in the catalog (or not in the group's library) | a group or unit the planner cannot calculate | **Correct** an unambiguous match (case, whitespace, the article in another library than the one named); **Keep** otherwise |
| G16 | "placement positions a new group only - group … is already in the plan" `:771-783` (`e685809`) | a placement on a group whose id is in the plan | the replace moving the group: the planner re-applies the placement with `reason: 'adjusted'` | **Correct** — decision 1: no `repositioningData`, the planner keeps the group's position |
| G17 | "Nothing was loaded: the corner article … could not be calculated" `:811-818` (`e2f74ce`) | a corner anchor the probe could not calculate | a corner group standing off its corner | **Keep**: a load of the same article would fail too |

### C. `place-group`

Discards: the move — the group stays where it is.

| ID | Guard | Rejects | Prevents | Direction |
|---|---|---|---|---|
| G18 | "Group '…' not found. Groups in the plan: …" — `findGroup` `:155-171`, also in every command tool that takes a `groupId` | a group id that is neither an id nor a unique prefix | acting on the wrong group | **Keep** (11:35 run 13: a guessed id) |
| G19 | "Room index … not found", "Wall '…' not found" — `resolveWall` `:527-555` | a room or wall index outside the plan, a side without a real wall | — | **Keep** |
| G20 | "Alignment '…' runs parallel to this '…' wall" — `plan-space.ts:494-516`, via `:557` | an alignment that names the target wall or the opposite one | — | **Correct**: `center` with a note |
| G21 | "Group '…' has no calculated geometry to place" `:571-575`, `:905-908` | a group without calculated geometry | — | **Keep** |
| G22 | "Placement rejected - the group was not moved: … would meet group …" — `findGroupContact` `:431-474`, `contactError` `:476-499`, used at `:910-924` (`b70e82d`) | a target footprint that touches or overlaps another group (separating axis test, 5 mm tolerance) | two groups touching or overlapping — it enforces "one kitchen is one group" | **Correct** — decision 2: touching allowed, an overlap moves the group to the nearest free position |

### D. Command tools — the planner (roomle-ui)

The command tools forward to `externalObjectGroupOperation`, and the planner checks the command in
`glue-logic.ts`. Discards: the command — nothing changes. All line numbers are in `glue-logic.ts`
unless named otherwise. **Out of scope for changes (decided 2026-10-02)**: these checks protect the
planner and stay. The Direction column says what the MCP server does before forwarding.

| ID | Guard | Rejects | Prevents | Direction |
|---|---|---|---|---|
| P1 | "Root module '…' has no sub-module '…'" `:998-1002` | `change-module-attribute` with an unknown sub module | — | **Keep** |
| P2 | "Module '…' has no attribute '…'" `:1004-1008` ([analysis](../bug-analysis/change-module-attribute-accepts-a-missing-attribute.md)) | an attribute the module's master data does not assign | a change reported as success that changed nothing — the bug before this check | **Keep** — the server passes the message on |
| P3 | "No module of group '…' has the attribute '…'" `:1047-1050` | `change-group-attribute` with an attribute no module has | the same | **Keep**: there is nothing to set |
| P4 | "Root module '…' is generated by the library and cannot be deleted" `:1069-1073` | deleting the worktop or toe kick | a deletion the library would undo | **Keep** |
| P5 | "Root module '…' is not an article root of group '…'" `:1095-1098`, `:1155-1158` | a `dockTo.rootId` or `rootModuleId` that is not an article root of the group | — | **Keep** |
| P6 | "Root module '…' has no free docking vector '…' - its free docking vectors: …" `:1100-1104` | an own vector that is occupied, or reported as occupied | a unit docked over an existing neighbour | **Keep** in the planner. **Server**: before forwarding, move `dockTo` to the root at the free end of the row (decision 4). It still misfires after `delete-root-module` (below) |
| P7 | "Article '…' has no / more than one docking vector '…'" `:1224-1248` | a `dockingVector` the new article does not have | — | **Keep** in the planner. **Server**: before forwarding, derive the partner of `ownDockingVector` (`RightBottom` → `LeftBottom`, a Top vector → the Bottom vector of the same side) when the article has it; **Simplify**: make `dockingVector` optional |
| P8 | "Group '…' is still being calculated - try again once it is loaded" `:1134-1138` | `merge-article-into-group` while the group is calculating | — | **Keep** |
| P9 | "Article '…' has n root modules" `:1163-1168` | `exchange-root-module` with an article of several root modules | — | **Keep** |
| P10 | "Groups of different libraries cannot be merged" `:1183-1189` | `merge-groups` across libraries | a merge the kernel would ignore silently | **Keep** |
| P11 | "Root module '…' not found", "Group '…' is not in the plan", "Article '…' is not in the article catalog" `:1199-1202`, `:1214-1217`, `:1280-1285` | unknown ids | — | **Keep** |
| P12 | "Another operation on group '…' is still in progress" `:1290-1294` | a second kernel operation on one group | — | **Keep** — the server already runs plan changes one at a time (`oneAtATime`, `tool-executors.ts:602-615`) |
| P13 | payload shape — `hi-plan-context.ts:893-1035`, `:1098-1110` | non-string ids, a value that is no string or boolean, the `dockTo` shape, `mode`, `offset`, `groupIds`, positions on a merged article | — | **Keep** — the MCP server never sends such a payload: the zod schemas and the executors build it |

### E. Tool schemas (zod, `hi-mcp-server.ts`)

Discards: the call, before the tool logic runs.

| ID | Schema | Rejects | Direction |
|---|---|---|---|
| S1 | `create-or-replace-groups` `posGroups`: a non-empty array of objects `:194-199` | no groups | **Keep** |
| S2 | `place-group` `wall`: `left`/`right`/`top`/`bottom` or an index ≥ 0; `roomIndex` an integer ≥ 0 `:222-237` | `back`, `front`, `Right` | **Correct**/**Simplify**: accept `back`/`front` and any case. Today the agent has to translate the user's "back wall" into the top-view label `top` (the rules: "back = top, front = bottom") |
| S3 | `place-group` `alignment` enum `:238-245` | the same | **Correct**/**Simplify**: as S2 |
| S4 | attribute `value`: string or boolean — `change-module-attribute` `:283-285`, `change-group-attribute` `:303-305` | a number, although the description says "Numbers are passed as strings" (`merge-article-into-group` accepts numbers, `:359`) | **Correct**: convert a number to its string |
| S5 | `merge-article-into-group` `dockTo.mode` enum, `offset` a 3-tuple `:375-384` | other modes, other offsets | **Keep** |
| S6 | `get-plan-context` `include` enum `:123-128`; `find-attributes` `text` non-empty `:145-148` (again in `tool-executors.ts:643-645`); `merge-groups` `groupIds` non-empty `:425-428` | an unknown section, empty text, no groups | **Correct** `include`: ignore an unknown section; **Keep** the others |

### Not guards

**Corrections the server already makes** — the pattern to extend:

- Generated roots are dropped (`tool-executors.ts:694-695`).
- Every root field other than the article pick is ignored (`toArticlePick`, `:55-71`), every
  group field other than `id`, `libraryId` and `roots` is stripped (`:834-840`), and docking
  indices are resolved from the names (`stripDockingIndices`, `:43-53`).
- Group ids accept a unique prefix (`findGroup`, `:155-171`).
- The placement anchor walks from a wall unit down to the floor unit carrying it, then left along
  its row, and stops at a corner article (`findAnchorRoot`, `group-placement.ts:81-132`). The
  agent does not pick the anchor.
- The server turns a right-handed corner article and adds its corner point offset
  (`toRepositioningData`, `group-placement.ts:217-256`, with the probe `tool-executors.ts:199-246`).
  The agent does not need to know the article's hand.
- `place-group` defaults: alignment `center`, offset 0, room 0 (`:887-893`).

**Reports after the fact** — honest failure reports, not guards: "No groups were created or
replaced" (`:850-856`), "could not be reloaded at the new position" (`:930-934`), the planner's
refusal of a deletion (`glue-logic.ts:1266`), and the non-blocking hint for an unpositioned group
(`:867-883`).

**Infrastructure checks** — out of scope, kept: the page allow-lists of planner methods
(`MCP_PLANNER_METHODS`, `minimal-hi-example/index.html:1216`; `PLANNER_METHODS`,
`hi-mcp-poc-json-client/browser-bridge.ts:12`), the bridge's origin check (`server.ts:96-104`),
"No HI page connected" and the outdated bridge protocol (`page-bridge.ts:76-91`), the call
timeouts (`page-bridge.ts:98-105`), and the chat request validation (`hi-mcp-chat/chat-config.ts`).
The chat's step limit (`chat-steps.ts`) is not a content guard, but every rejection draws on it.

## The two guard families and their root cause

### Docking — G7, G8, P6, P7

The agent writes the arrangement as a graph. Per root it writes a list of
`{ ownDockingVector, dockedRoots: [{ id, dockingVector, mode, offset }] }` on the placed root.
The planner mirrors every entry, the modes pick the endpoints of the two vectors, and an offset
takes effect in one direction only. The rules need five bullets, a list of recipes and three
examples to explain it (`hi-mcp-server.ts:11-26`, `:35-59`).

The guards catch the failures this encoding invites:

- a second chain that never meets the first (run 04, gpt-5.4-mini)
- a row continued from the wrong unit, so two units share one side (11:35 run 05)
- a unit docked to the corner article's `LeftBack` (12:08 run 03)
- an own vector and a partner vector that do not pair (P7)

**Simplify.** The agent names the arrangement, and the server writes the docking: a row as an
ordered list of article picks, a unit `above` another with a gap, an island `backToBack`. The
server already knows every pair (`PARTNER_VECTOR`, `tool-executors.ts:415-422`; the recipes,
`hi-mcp-server.ts:20-26`). An ordered row cannot be unconnected and cannot put two units on one
side, so G7 and G8 would have nothing left to catch. P7 disappears once `dockingVector` is
optional. This is an API change and needs a feature analysis of its own.

**Interim (Decide).** G8's own error states the fix — "continue a row from the free side vector
of its last unit" — so the server could apply it: dock the second partner to the free side vector
at the end of the row, with a note. The analysis that added G8 rejected this as guessing: in run 05
the model may have meant the fridge on the oven's other side. Under the new principle, the question
is whether a plausible correction with a note is better than a discarded call. **Decided
(2026-10-02)**: yes — the unit goes to the free end of the row, and the agent is informed (decision 4).

### Positioning — G3, G5, G9, G11, G13, G16, G22

The corner findings concluded: "The positioning system for groups is too complicated for the
agents that have to use it … The long-term fix for this problem is to make the positioning easier,
not to explain the current one better" (§8 of
[agent-placement-in-a-room-corner-findings.md](../bug-analysis/agent-placement-in-a-room-corner-findings.md);
backlog item "Make group positioning easier for the agent").

A placement asks the agent for a room point and a rotation, computed from a wall's `end`, `start`,
`lengthMm` and `facingRotationY`. The common failure is the wall's `start` instead of its `end`
(11:35 runs 02 and 12): the row then runs away from the room.

**G11 rejects exactly the simpler form**, `placement: { wall, alignment, offsetMm }`. It tells the
agent to compute the points itself, or to make a second call to `place-group` — which already
computes the position from a wall and an alignment (`placeGroupAtWall`, `tool-executors.ts:561-600`).
Accepting the wall form in `create-or-replace-groups` was deferred as D2 of
[the place-group analysis](../feature-analysis/reintroduce-place-group-tool-in-the-server.md)
("ask before adding"). With it, the agent names a wall and a corner — the words of the user's
prompt — and the start/end mistake has no place to happen.

G3, G5 and G9 reject fields the server would drop or could map, and G13 a rotation the server can
derive from the wall. All four can become corrections now. **Decided (2026-10-02)**: a placement
the server cannot use creates no `repositioningData`, and the planner positions the group
(decision 1); the wall form stays deferred.

G16 and G22 guard the principle "one kitchen is one group". G16 refuses to move an existing group
by its placement, and G22 refuses to move a group against another. Both stop an agent from
building a second group next to an existing one. The root cause of that mistake was that
extending a group meant resubmitting it with new docking; `merge-article-into-group` now does it in
one call. Whether a user may want two groups side by side — a block of tall units next to the
kitchen, for example — is a product decision. G22 refuses it today, and its 5 mm tolerance also
rejects two groups that merely touch.

## Guards that misfired on valid input

- **P6 after `delete-root-module`.** The planner keeps a docking entry to the deleted unit, so the
  neighbour's side is reported as taken although it is free, and `merge-article-into-group` on that
  side is refused (Amendment of [unconnected-docking-graph-accepted.md](../bug-analysis/unconnected-docking-graph-accepted.md#amendment-ids-outside-the-group)).
- **The room checks.** The out-of-room hint of PR #24 fired on the first load of every correct
  corner kitchen while the corner offset was missing, and its rule sentences called a correct
  corner leg an error. The corner runs got worse, and the PR was reverted (`1e979da`; §7 A1 of the
  corner findings). The later room check was removed in review: a group outside the room can be
  what the user wants ([new-group-outside-the-room-accepted.md](../bug-analysis/new-group-outside-the-room-accepted.md)).
- **S4** rejects a number as an attribute value, although the tool description says numbers are
  passed as strings.

## Decisions (2026-10-02)

**Scope.** The refactoring covers the MCP server only. The planner's checks (P1–P13) protect the
planner from breaking and stay unchanged. The server may correct the input before it forwards it.

**General.** Whenever it can, the server corrects the input and informs the agent. Where it cannot,
it gives feedback and asks the agent to correct, without discarding what can be built.

| # | Guard | Decision |
|---|---|---|
| 1 | G16 — a placement on an existing group; G10, G13 — a placement the server cannot use | In a conflicting case the server creates **no `repositioningData`**. roomle-ui and RoomleCore then position the group: an existing group keeps its position. The result says that the placement was not used |
| 2 | G22 — `place-group` onto another group | Intersecting groups are allowed. The position is corrected along the wall and the agent informed. Touching is not an overlap |
| 3 | G7 — unconnected roots | The server connects them with a docking entry — `PosDockedContextRoot` with `dockingVector`, `mode` and `offset` — to the free end of the row, and reports it. The guard stays for roots that cannot be connected |
| 4 | P6 — `merge-article-into-group` onto an occupied side; G8 — two roots on one side vector | The new unit goes to the free end of that row |
| 5 | A call with an invalid group | The groups that can be built load; the others are reported with what to send instead |

The target behaviour of every guard is in
[`hi-mcp-behaviour.md` §8](../../hi-mcp/docs/hi-mcp-behaviour.md#8-guards-corrections-and-feedback),
as **Planned** entries.

## Tests covering the guards

`hi-mcp/hi-mcp-poc-json/tests/tool-executors.test.ts`:

- `create-or-replace-groups`:
  - `rejects a group without roots` (`:383`), `rejects a group of only generated roots` (`:387`)
  - `rejects a position on the group` (`:394`), `rejects a position on a root module` (`:401`)
  - `rejects roots without id or articleId` (`:418`)
  - `rejects duplicate root ids and undocked roots` (`:429`), `rejects roots docked only among themselves` (`:454`), `does not count a docking to a root outside the group as connecting` (`:478`)
  - `rejects repositioningData and points to placement` (`:498`), `rejects an invalid placement` (`:510`)
  - `rejects a placement on a group that is already in the plan` (`:549`)
  - `rejects an article id that is not in the catalog` (`:566`)
  - `rejects two roots on one side vector at the same place` (`:576`)
  - `rejects the call instead of loading the group off the corner when the probe yields no calculated group` (`:982`)
  - accepted counterparts: `accepts several roots on one vector where they do not take the same place` (`:1210`), `hints at placement for a created group without a position` (`:1186`)
- `place-group`:
  - `rejects an unknown group id` (`:1347`)
  - `rejects a target that meets another group without moving it` (`:1419`)
  - `rejects an unknown room or wall and a parallel alignment before reading the calculated groups` (`:1526`)
  - `rejects a group the planner has not calculated` (`:1541`)
- command tools: `passes the reason of a refused command through` (`:1742`), `runs the next plan change after one that fails` (`:1786`)
- `find-attributes`: `restricts the search to one library and rejects empty text` (`:325`)

`hi-mcp/hi-mcp-poc-json/tests/hi-mcp-server.test.ts`: `rejects an invalid payload in the server
without loading anything` (`:291`), `rejects an unknown wall label of place-group without a planner
call` (`:304`).

roomle-ui: `homag-intelligence/__tests__/hi-plan-context-test.ts` and the glue logic tests — not
inventoried here.

**Output changes to expect**: when a guard becomes a correction, its `rejects …` test becomes a
`corrects … and notes it` test. The tool result gains the correction note, and the served rules
lose their rejection sentences.

## Code and documents a change would touch

- `hi-mcp/hi-mcp-poc-json/tool-executors.ts`, `hi-mcp-server.ts`, `plan-space.ts`,
  `group-placement.ts` and their tests — no roomle-ui change
- `hi-mcp/docs/hi-mcp-behaviour.md` — each **Planned** entry becomes current when its step lands
- the validation lists of `minimal-hi-example/docs/hi-mcp-server.md` (`:356-362`, `:469`,
  `:496-498`, `:551`, `:582`, `:598-602`, `:696`), `hi-mcp/hi-mcp-poc-json/README.md`,
  `.agents/skills/hi-authoring-rules.md` and `.agents/skills/hi-mcp-server.md` (`:75-76`) — they
  point to the behaviour document instead of repeating the guards
- the Common Errors table of `.agents/skills/hi-mcp-tools.md` (`:234-253`)
- `.agents/scripts/run-hi-mcp-prompt.js` and `.agents/skills/hi-mcp-testing.md` (step 10)

## Implementation plan

**Ground rules for every step:**

- Test first: write the test that shows the correction and its report, then implement.
- `npm test` and `npm run typecheck` in `hi-mcp` after every step.
- One conventional commit per step, with the behaviour document updated in the same commit
  (**Planned** → current).
- No roomle-ui change, no new dependency.

### Step 1 — Feedback in the result

- `tool-executors.ts`: a per-call collector for corrections. The tools that change the plan return
  `corrections: string[]` when it is not empty. One sentence per correction names the group (input
  index and id), what was sent, and what the server did.
- Corrections the rules describe as normal (C1, C2 — dropping generated roots, ignoring the
  read-only fields of a resubmitted group) are not reported.
- Tests: no `corrections` field without a correction.

### Step 2 — Partial loading (decision 5)

- `create-or-replace-groups` validates per group. A group with errors goes to
  `notLoaded: [{ index, id?, errors }]`, and the other groups load in one call. This replaces the
  call-wide throw for G1, G2, G4 (`articleId`), G6 (ambiguous), G15 (no match), G17 and "No groups
  were created or replaced".
- `validateArticlePickIds` and the corner probe report per group instead of throwing.
- No group left → an error result with every error, as today.
- Tests: a valid and an invalid group → the valid one loads and `notLoaded` names the other; all
  invalid → `isError`; a probe failure of one group does not stop the others.

### Step 3 — Conflicting placements create no `repositioningData` (decision 1)

- G16 (a placement on a group that is already in the plan), G10 (a placement that is not an object),
  G12 (a `posGroup` that is not a point and not `[x, z]`) and G13 (no `posRotationY`): the server
  sends no `repositioningData` for that group, and roomle-ui and RoomleCore position it — an
  existing group keeps its position. Reported.
- Tests: rewrite `rejects a placement on a group that is already in the plan` and `rejects an
  invalid placement` → the load carries no `repositioningData` for that group, and the correction
  is reported.

### Step 4 — Field corrections

Each is a small function in the validation and adds its correction sentence (see the behaviour
document §8.3, §8.6):

- G3, G5: positions on groups and roots dropped
- G4: a missing root `id` generated
- G6: a duplicate root id renamed when no docking entry names it
- G9: `repositioningData` sent by the agent taken as the placement (the same fields)
- G11: unknown placement fields dropped
- G12: `[x, z]` completed to `[x, 0, z]`
- G14: an unknown `rootId` dropped
- G15: an unambiguous article id match (case, whitespace, the article in another library)
- S2/S3: `back`/`front` and any case accepted as wall labels (zod preprocessing)
- S4: a number accepted as an attribute value (its string)
- S6: unknown `include` sections ignored

Tests: per correction, the group loads and the sentence is in `corrections`.

### Step 5 — `place-group` corrects overlaps (decision 2)

- `plan-space.ts`:
  - a height range per calculated group, from the same sources as the footprint (part boxes,
    docking vector points, the height attribute)
  - `groupsOverlap(a, b)`: the footprints overlap by more than the tolerance (touching does not
    count) **and** the height ranges overlap, so wall units above another group's base units are
    not an overlap
  - `freeSpanOnWall(wall, footprint, occupied, preferredOffset)`: the nearest offset along the wall
    without overlap
- `tool-executors.ts` (G22): the contact rejection and `contactError` are removed. An overlap moves
  the group to the nearest free span on the same wall. The sentence names the neighbouring group
  and suggests `merge-groups` if the units belong together. Without a free span, the group is
  placed as asked, and the sentence says that it overlaps.
- G20: an alignment parallel to the wall becomes `center`, reported.
- Tests: pure geometry for the three functions. Rewrite `rejects a target that meets another group
  without moving it` → `moves a target that overlaps another group along the wall and reports it`;
  touching → placed, nothing reported; no free span → placed as asked, reported.

### Step 6 — Unconnected roots (decision 3)

For each part the docking does not reach from the first root (G7), the server adds a docking entry
(`PosDockedContextRoot`: `id`, `dockingVector`, `mode`, `offset`) on a reached root:

- **Floor units**: on the root at the free end of the reached row, `RightBottom` → the lead root's
  `LeftBottom`, `mode` `StartStart`, `offset` `[0, 0, 0]`. If the row's right end is not free, the
  entry goes on the row's left end, `LeftBottom` → `RightBottom`. The rows are walked with
  `dockingRelations` (`group-placement.ts`).
- **Wall units** (catalog category): the same at the free end of a reached wall-unit row.
- **No connection possible** — a root without side docking vectors (a hood), or no free end: the
  group goes to `notLoaded`. The message names the roots and the docking entry to send (the guard
  stays).
- Tests: the run-04 shape (two chains) → connected and reported; a hood → `notLoaded`.

### Step 7 — Occupied side vectors (decision 4)

- **G8**: the second partner in input order is docked to the free side vector at the end of the
  first partner's row, in the same direction. Reported.
- **`merge-article-into-group`**: the executor already reads the groups and the articles. When
  `dockTo.ownDockingVector` is a side vector that is not among the root's `freeDockingVectors`, it
  walks the row in that direction to the root whose vector is free, and re-targets
  `dockTo.rootId`. Top and Back vectors are forwarded unchanged.
- **P7**: when the article's catalog `dockingVectors` lack `dockTo.dockingVector`, the partner of
  `ownDockingVector` is used if the article has it. Reported.
- The planner's result gains the server's `corrections`.
- Tests: the run-05 shape → the fridge at the row's end; a merge on an occupied `RightBottom` → at
  the row's end; the stale-entry case → the planner's message is passed on.

### Step 8 — The served rules

- Remove the eight rejection sentences (`hi-mcp-server.ts:7`, `:10`, `:11`, `:13`, `:27`,
  `:180-181`, `:190-191`, `:212-213`) and describe the way to succeed.
- Add: "The result lists what the server corrected (`corrections`) and the groups it could not
  build (`notLoaded`), with what to send instead."
- "One kitchen is one group" stays as guidance, without a rejection.
- Tests: `hi-mcp-server.test.ts` on the served text (no "rejected" sentences; the corrections
  sentence is present).

### Step 9 — Documents

With each step: the behaviour document; the Common Errors table of `hi-mcp-tools.md`; "Validation
Rules" in `hi-authoring-rules.md`; the validation lists of `hi-mcp-server.md` and the README,
replaced by a link to the behaviour document.

### Step 10 — Measure

- `run-hi-mcp-prompt.js` stores per tool call the error text, `corrections` and `notLoaded` in
  `run.json`.
- `hi-mcp-testing.md`: the report lists the corrections per run. A frequent correction is an
  instruction to clarify (§2.2 of the behaviour document).

### Step 11 — Verify

- "Test the mcp" with Mistral Large and gpt-5.4-mini, compared with the 12:08 suite: rejected
  calls per run (expected: close to none), corrections per run, verdicts.
- A live headless check of the corrections against the local planner.

### Risks

- **A correction builds what the user did not want.** Every correction is reported, so the agent
  can say so and undo it.
- **Silent docking corrections can hide an instruction problem.** Step 10 makes them visible, and a
  frequent correction becomes a hardening candidate that names the instruction.
- **Height ranges.** If the calculated group lacks height data, `place-group` does not correct an
  overlap (step 5).

## Open points

None — the decisions of 2026-10-02 answer the questions of this analysis.
