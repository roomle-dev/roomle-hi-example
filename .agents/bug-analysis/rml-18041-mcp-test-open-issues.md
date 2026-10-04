# RML-18041: the open issues of the MCP test — causes verified, fixes proposed

> **Type**: Bug Analysis
> **Domain**: hi-mcp — `create-or-replace-groups`, `place-group`, `merge-article-into-group` and the
> command tools (`hi-mcp/hi-mcp-server/tool-executors.ts`, `group-layout.ts`, `group-placement.ts`),
> the served rules (`hi-mcp-server.ts`), `get-plan-context`, the chat (`hi-mcp/hi-mcp-chat`)
> **Trigger**: [RML-18041](https://roomle.atlassian.net/browse/RML-18041) — work up the open issues of
> the MCP test backlog, [mcp-test-open-issues.md](../backlog/mcp-test-open-issues.md)
> **Date**: 2026-10-04
> **Author**: AI Assistant
> **Status**: Open
> **Branch**: `fix/mcp-test-open-issues-RML-18041` (from `master` `3a263d1`)

---

## Scope

The backlog names 34 issues found by "test the mcp" between 2026-10-02 and 2026-10-04, each with a
suspected cause and a to-do. This analysis takes the issues of the ticket's scope and, for each one:

- verifies the cause against the code of `master` (`3a263d1`, the relations format of RML-18038);
- reproduces the server issues live against the local roomle-ui dev server (`http://localhost:5173/`,
  where RML-18039 and RML-18040 are already fixed), with the MCP tools called from a script and the
  planner's raw groups read from the page;
- decides the fix along [Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort) —
  clarify, simplify the API, correct and report, give feedback — and names its test.

Out of scope, as the ticket says: #11 (RoomleCore, RML-18040), #16 (roomle-ui, RML-18039) and #23
(roomle-ui, its own ticket). Two issues of the ticket's first block are **already fixed on
`master`**: #18 (a floor unit `rightOf` a wall unit, G40, `group-layout.ts:211-219`) and #20 (a
range hood beside a tall unit, G41, `group-layout.ts:244-280`), both with tests in
`tests/group-layout.test.ts` ("puts a floor unit that names a wall unit into the floor row", "hangs a
range hood beside a tall unit above the floor unit on that side"). They leave the ticket's scope.

## Live reproduction

Setup: `node minimal-hi-example/start.mjs --dev --no-open` (page :3000, MCP :3100, planner from
:5173), headless Chromium on the example URL with `plan_id=ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv` (the
default room of the test prompts), the MCP SDK client on `/mcp`, and
`window.instance.extended.getExternalObjectGroups()` for the planner's raw groups (root positions
and the attributes of the generated roots). Furniture_Smith throughout; the back wall is `top`
(`[4815, 0, -3765]` → `[-685, 0, -3765]`, facing 0), the back right corner `[4815, 0, -3765]`.

| Scenario | Payload | Planner result | Issue |
|---|---|---|---|
| wall unit `above` a base unit | `UTB60`; `OTB60 above` | wall unit at y **1480**, top 2200 = top of the tall units (`HOTS2AB60`: `mod_Height` 2100 at insertion 100) | **D35 confirmed** |
| hood `above` a tall unit | `HOTS2AB60`; `DU above` | hood at y **2200** — on the tower; no correction | #19 |
| wall unit `onTop` a corner base unit | `UELTB90`; `OTB60 onTop`; `OTB60 rightOf` it | both wall units at y **820** — on the worktop; no correction | #29 |
| base corner unit `onTop` a corner base unit | `UELTB90`; `EUELTB90 onTop`; `OTB60 rightOf` it | the corner unit at y 820 on the worktop; the wall unit hung `above` it (G35) at y **2300**; only the G35 note | #32 |
| two units `above` one base unit | `UHS60`; `OTB60 above`; `DU above` | both at y 1480 on the same `LeftTop`, the hood inside the wall unit; no correction | #21 |
| a material as a group attribute | `attributes: [{ mod_FrontColor: 215 }]`, two `UTB60` | the fronts keep **240**; the group's `attributes` in the result are the library's group settings; nothing reported | #6 |
| `change-group-attribute mod_CountertopColor 224`, then `place-group top center` | a row of two | worktop 224 → **380** after the reload; no correction | #22 |
| `place-group` again, same wall and alignment | the same row, colour set again | reloaded: the colour resets again and `pos` drifts from `[1460, 0, -3765]` to `[1465, 0, -3765]` | #28 |
| the reload with the generated roots kept (`loadExternalObjectGroupLayout` from the page, all four roots, `repositioningData` +300 mm) | the same row, colour 224 | the group moves, the worktop **keeps 224**, still four roots | fix of #22 |
| a replace through the tool with the group as `get-plan-context` returned it | the same row, colour 224 | worktop **380**: C1 drops the generated roots | #22 (replace path) |
| `merge-article-into-group` on the taken `LeftBottom` of the front end unit | three `UTB60` along the right wall from the back corner | correction "docked to the LeftBottom of 〈u1〉, the free end of that row"; the group's `pos` moves from z −3765 to **−4375**: the new unit stands behind the back wall | #1 |
| `change-module-attribute` with one character of the root id wrong | | planner error "Root module '…' not found." passed through | #8 |
| a second create with `id: "kitchen1"` and the same placement | one `UTB60` | **two groups** at `[-685, 0, -3765]`; no correction | #24 |
| one unknown article id (`OTB90`) among three roots | | error "Invalid pos groups - nothing was loaded"; **no group** | #26 |
| `get-plan-context` rooms | | the right wall is three entries: a 55 mm stub (`wall`), the 900 mm door (`type: null`), the 4045 mm wall — as on bo-test | #12, #30 |

The plan context shows the generated worktop's colour as an input attribute after a change
(`mr_Countertop`: `attributes: [{ mod_CountertopColor: "224" }]`), so the server can read it.

## A. Gaps of the compile (`group-layout.ts`)

The compile `relationsToDocking` corrects the intent of a relation in one place
(`group-layout.ts:196-228`): `above` by a floor unit (G34), `rightOf`/`leftOf` a base unit by a wall
unit (G35), `rightOf`/`leftOf` a wall unit by a floor unit (G40), `behind` a corner article (G36).
**`onTop` has no branch**, and the hang height is derived only for `above` (`pairOf`,
`group-layout.ts:420-428`). Every issue of this block is one more branch in the same place.

### #19 `above` a tall unit puts the unit on top of it, unreported — cause confirmed

`hangGap` (`group-layout.ts:131-150`) is `max(0, tall − unit − carrier)`; with a tall carrier the
difference is negative and becomes 0 silently. Live: the hood stands at y 2200 on the tower.

**Fix.** Treat `above` a tall unit like `rightOf`/`leftOf` it: the G41 path (`group-layout.ts:244-280`)
hangs the unit above the floor unit beside the tall unit when the relations name one, else beside the
tall unit by its top edge — and reports it: "'hood1' cannot hang above the tall unit 'oven1' - it
hangs above 'sink1' / beside 'oven1' with the tops flush". Nothing is silent any more.

**Test.** `above` a tall unit with a base unit `leftOf` it → the unit hangs above the base unit, the
correction names it; without a floor unit → `oven1.LeftTop -> hood1.LeftTop` (tops flush) and the
correction. `onTop` a tall unit stays a stacking without a note.

### #21 Two units `above` one floor unit take the same place — cause confirmed

Both links compile to `carrier.LeftTop -> unit.LeftBottom StartStart [0, 660, 0]`
(`pairOf`, `group-layout.ts:418-429`); `separateSideVectorPartners` (`tool-executors.ts:717-753`)
knows side vectors only (`SIDE_VECTORS`, `:504`). Live: wall unit and hood at the same place.

**Fix.** In `relationsToDocking`, after the links are collected: a second `above` link to a carrier
that already carries a unit becomes `rightOf` that unit (the wall-unit row above the floor row),
reported: "'hood1' and 'w2' both hang above 'l3' - 'hood1' was put rightOf 'w2'".

**Test.** Two units `above` one base unit: the second is `rightOf` the first, the correction says so.

### #29 A wall unit `onTop` a floor unit stands on the worktop — cause confirmed

`onTop` is compiled as sent (`group-layout.ts:418-419`: `gap = link.gapMm ?? 0`). The rule line 13
says `onTop` is stacking, line 14 that `above` is "a wall unit hanging above that floor unit"; the
models read "the corner wall cabinet on top of the corner base" as `onTop`. Live: y 820, and the
wall units `rightOf` it follow at 820.

**Fix.** A wall unit `onTop` a floor unit that is not a tall unit hangs `above` it (D35), reported:
"wall unit 'wallCorner' hangs above the floor unit 'cornerBase' instead of onTop it". A wall unit
`onTop` a tall unit or another wall unit stays a stacking. One more rule word on line 13: "onTop …
stacking on a tall unit or a wall unit".

**Test.** `OTB60 onTop UELTB90` → `LeftTop -> LeftBottom [0, 660, 0]` and the correction; `OTB60
onTop H2TB60` → offset 0, no note.

### #32 A floor unit `onTop` a base unit stands on the worktop — cause confirmed

Same place, no check of the unit's kind. Live: the corner unit at y 820, and G35 then hung the next
wall unit `above` it at y 2300.

**Fix.** A floor unit (not a wall unit, not a hood) `onTop` a base unit (not a tall unit) continues
the floor row `rightOf` it, as G34 does for `above`, reported: "floor unit 'wallCorner' cannot
stand on the base unit 'cornerBase' - it continues the floor row". What counts as a top unit stays
by the target: stacking on a tall unit or a wall unit is kept, whatever the unit's category — the
library has no "top unit" category to check.

**Test.** `EUELTB90 onTop UELTB90` → `rightOf` with the correction; `UTB60 onTop H2TB60` → stacking.

### D35 — the hang height, confirmed

The ticket asks to confirm D35 before #10 and #19 are closed. Live: a wall unit `above` a base unit
hangs with its bottom at 1480 and its top at 2200, the top of the tall units (`mod_Height` 2100 on
the 100 mm plinth). `hangGap` = 2100 − 720 − 720 = 660 is right for Furniture_Smith. D35 loses its
"to be confirmed" in the behaviour reference.

## B. Bugs — MCP server

### #1 A taken side is re-targeted to the far end of the row — cause confirmed

`dockTarget` (`tool-executors.ts:224-268`) walks `rowEnd` (`:621-639`) in the direction of the taken
vector only. The named root's opposite side vector is never considered. Live: the new unit stands
behind the back wall, with a correction that sounds right ("the free end of that row").

**Fix** (D29 refined: a row has two ends):
1. If the named root's **opposite** side vector is free, the root is itself an end of the row — dock
   there: `dockTo.ownDockingVector` becomes the opposite vector, `dockingVector` its partner
   (`PARTNER_VECTOR`, `:1344`). Correction: "the LeftBottom of root '…' is taken - the unit was
   docked to its free RightBottom".
2. Otherwise walk in the named direction as today, and **stop at a corner article** (#4): a corner
   article ends a leg; if the walk reaches one, the unit goes to the free end of the root's own leg
   in the other direction, reported.
3. The same two rules in `separateSideVectorPartners` (`:717-753`), which calls the same `rowEnd`.

**Test.** A row of three, merge on the last root's taken `LeftBottom` → its `RightBottom`; a middle
root with both sides taken → the end in the named direction (the existing test "docks a unit on a
taken side to the free end of that row" keeps passing); the #4 shape (`b1` on a corner's left leg,
`b2` to `b1`'s taken `RightBottom`) → `b1`'s `LeftBottom`.

### #6 A material for the whole kitchen is not applied — cause confirmed, one part verified live

`create-or-replace-groups` passes a group's `attributes` on to the planner (`prepareGroup`,
`tool-executors.ts:1239-1243`, and `:1815-1831`), and the library reads them as its group settings
(`mod_GroupHeight`, `mod_GroupGenerationLogic`, …). Live: `mod_FrontColor` 215 in the group's
`attributes` changes nothing and nothing is reported. A root's `attributes` are overrides of that
unit (rule line 7); `mod_CountertopColor` on a base unit does nothing, because only the generated
worktop carries it. The tool API has no place for a kitchen-wide material, so the models put it
somewhere.

**Fix** (simplify the API, step 2):
1. **Group attributes that are not group settings are applied kitchen-wide.** After the load, for
   every `{ id, value }` of the group's `attributes` whose id is not among the loaded group's
   `attributes` (the planner returns the library's group settings there), the server runs the
   planner's `change-group-attribute` command (D20: every root and sub module that carries it, the
   generated worktop and toe kick included) and reports it: "mod_FrontColor 215 was set on every
   unit of the group". The planner's P3 ("No module of group … has the attribute") becomes the
   correction "no unit of the group carries 'mod_X' - ignored".
2. **An override only a generated root carries** (`mod_CountertopColor`, `mod_ToekickColor` on a
   base unit) is applied to the group the same way and reported — the intent is clear, the unit
   cannot carry it.
3. **A unit attribute on some roots stays per unit.** Walnut on one of nine roots may be an accent;
   the server cannot read the request. The rule says where the kitchen-wide material goes.
4. **The rules**, line 7: "attributes is an optional list of { id, value } overrides of that unit; a
   material for the whole kitchen (fronts, worktop, carcase) goes into the group's attributes"; the
   worktop colour example beside it. INSTRUCTIONS step 2 gets the same half sentence.

**Test.** A new group with `mod_FrontColor` and `mod_CountertopColor` in its `attributes`: two
`change-group-attribute` commands after the load, both reported; `mod_CountertopColor` on a root →
the group command and the correction; an attribute nobody carries → the correction, no error. In
"test the mcp", the full kitchen (10) has walnut on every unit and a dark marble worktop.

### #22 `place-group` resets the worktop and toe kick colours — cause confirmed, fix verified live

`repositionedGroup` (`tool-executors.ts:111-125`) drops the generated roots before the reload (C1),
and the library regenerates the worktop and the toe kick with their default colours. Live: 224 → 380
after `place-group`, unreported. The **replace path** does the same (`prepareGroup`, `:1229`): a
group resubmitted as `get-plan-context` returned it loses the worktop colour, verified live.

**Fix.** Keep the generated roots in the reload of `place-group`: the raw roots travel as they are,
without `articlePos` and `rotationY`. Verified live from the page — the group moves, the worktop
keeps its colour, no duplicate generated roots (roomle-ui `_prepareArticlePickRoots`,
`glue-logic.ts:832-838`, passes a root that is not an article pick on as it is). For the replace
path, where the roots are the plan-context shapes, the server reads the input attributes of the
generated roots it drops (`mr_Countertop`: `mod_CountertopColor`) and sets them again after the load
with `change-group-attribute`, reported — or keeps them, if a check shows that the planner accepts a
generated root in the plan-context shape. C1 in the behaviour reference changes accordingly.

**Test.** `place-group` sends the generated roots with the group and the loaded group keeps
`mod_CountertopColor`; a replace of a group with a coloured worktop sets the colour again and
reports it.

### #34 A replace the library cannot calculate is reverted without a word — cause confirmed

The load result carries runtime ids only (`tool-executors.ts:1833-1851`); roomle-ui restores the
previous group (`_discardCalculation`, `glue-logic.ts:2223`) and returns it as a success. The server
never compares the result with what it sent.

**Fix.** After the load, compare each replaced group's result roots (article ids, count) with the
roots sent; when the result still holds the previous content, add a correction: "the planner could
not calculate the new layout of group '…' and kept its previous content - the page console names the
modules". The durable fix is a roomle-ui contract change (the discard in the load result); this
keeps the agent informed until then.

**Test.** The replay of RML-18039 with a fake planner that returns the old roots → the correction.

## C. Hardening — MCP server

### #8 Root module ids are passed on unresolved — cause confirmed

`findGroup` (`tool-executors.ts:274-289`) resolves a unique prefix for group ids; `rootModuleId`
of `change-module-attribute` (`:1987-1999`), `delete-root-module` (`:2031-2038`),
`exchange-root-module` (`:2079-2106`) and `dockTo.rootId` of `merge-article-into-group` (`:2056`) go
to the planner as sent. Live: one wrong character → the planner's "not found".

**Fix.** `findRoot(groups, id)`: the exact id, else a unique prefix, else the unique root whose id
differs in one character or whose last four UUID segments match (the 12:45 run's typo was in the
first segment). Report the resolution as a correction; an ambiguous or unmatched id stays the
planner's error, with the root ids of the group appended.

**Test.** A first-segment typo resolves and is reported; an ambiguous prefix fails with the
candidates.

### #12 The door opening is listed as a wall, and the walls list no windows — cause confirmed

roomle-ui `deriveWalls` (`hi-plan-context.ts:719-757`) makes one entry per contour segment and
copies `type: to.type`; the kernel's contour segment has `cmd`, `pos`, `angle`, `type`, `height`,
`thickness` and nothing else — an opening is `type: null`. Windows are not in the contour at all.

**Fix.** Server side, in `get-plan-context` (`tool-executors.ts:1623-1644`, which passes the rooms
through): an entry with `type: null` becomes `type: "opening"`, so the model reads what it is; the
rule line 21 ("use the walls of type wall") keeps its meaning. Windows need roomle-ui: the room
information would have to carry the wall elements (doors, windows with their span and sill height) —
a roomle-ui follow-up, not this ticket.

**Test.** A plan context with a `type: null` segment lists it as `opening`.

### #30 The front right point is taken for the back right corner — cause confirmed

The walls carry `side` `top`/`bottom` only (`sideFromFacing`, `hi-plan-context.ts:703-715`); "back =
top" is a phrase of the corner rule (line 22) and does not reach the wall entries. The right wall
is three entries, the first starting at the front corner. `place-group` already knows `back` and
`front` (`SIDE_SYNONYMS`, `tool-executors.ts:1422-1425`).

**Fix** (clarify the plan context, step 1): in `get-plan-context`, give every wall a `name` in the
user's words — `back wall`, `front wall`, `left wall`, `right wall` (`side` stays) — and every room a
`corners` list derived from the walls of type `wall` that share a point (`sharedCorner`,
`plan-space.ts:360-366`): `{ name: "back right", point: [4815, 0, -3765], posRotationY: 270 }`. The
corner rule (line 22) then says "take the corner point and posRotationY from the room's corners"
and loses its table. Never refuse a point (D22).

**Test.** The default room lists `back right` at `[4815, 0, -3765]` with 270; a room with a door on
the right wall lists four corners.

### #24 A second create with the agent's own group id builds a duplicate — cause confirmed

The planner regenerates the group id of a new group; the server tells a replace by
`beforeGroupIds.has(group.id)` (`tool-executors.ts:1726-1728`, `:1742-1750`) and has no memory of
the ids the agent used. Live: two groups on one spot, unreported.

**Fix.** The server remembers, per created group, the agent's id → the planner's id (a module-level
map like `knownAnchorFrames`, `:318`; the server serves one page). A later call with that id
replaces the group — its placement is dropped with G16's correction — and reports "group id
'kitchen1' names the group '8b3f…' created earlier - it was replaced". Independently, a new group
whose placement lands on an existing group's position (same point within 5 mm, same rotation) gets
a `hint`, never a refusal: the mistral 11 run (no id, the same placement) is this case.

**Test.** The same agent id twice → one group, the correction; a new group at a taken position → the
hint.

### #25 `dockTo` written on the roots of `create-or-replace-groups` — cause confirmed

`dockTo` is the only typed docking field among the tools; the chat passes no server instructions.
G27 reports it as unused (`reportUnusedFields`, `tool-executors.ts:1181-1216`) and G7 chains the
roots.

**Fix.** In `prepareGroup`, read `dockTo { rootId, ownDockingVector, dockingVector }` on a root as
its relation — `RightBottom -> LeftBottom` = `rightOf rootId`, the mirror = `leftOf`, a Top → Bottom
pair = `above` for a wall unit and `onTop` otherwise, `BackBottom` = `behind` — and report it.

**Test.** A root with `dockTo` compiles like the matching relation, with the correction.

### #26 One unknown article id rejects the whole group — cause confirmed

`resolveArticleIds` (`tool-executors.ts:204-218`) returns one error per unknown root, and
`keepBuildable` (`:872-895`) drops the group. Live: nothing loaded.

**Fix** (feedback, step 4): remove the root with the unknown article from the group and build the
rest. Relations that named it fall back to G32/G31 (reported). The dropped root is named in
`notLoaded` as a root entry — `{ index, id?, rootIds: ['w2'], errors: ["root 'w2': articleId
'OTB90' is not in the article catalog … Valid article ids: …"] }` — so the agent knows what was not
built and what to send (one `merge-article-into-group`). §2.3 and §8.3 of the behaviour reference
describe the root entry. A group whose every root is unknown stays `notLoaded` as today.

**Test.** One unknown article among three roots loads two and names the third; all unknown → not
loaded.

### #27 A new group without a placement, moved with `place-group` right after — decision D23

The models skip the placement arithmetic of Example 4 (rule line 53) and call `place-group`
afterwards, which reloads the group (#22, #28). D23 (`placement { wall, alignment, offsetMm }`) is
deferred, "ask first".

**Proposal for the decision.** Accept `placement { wall, alignment?, offsetMm? }` — the fields of
`place-group`, `alignment` also the side label of an adjoining wall for a corner — in
`create-or-replace-groups`. The server loads the group first (the footprint exists only
calculated), then runs the `place-group` logic (`placeGroupAtWall`, `tool-executors.ts:1472-1515`)
in the same call. One agent call, one internal reload; with #22 fixed the reload keeps the colours.
The alternative — computing the width from the catalog's `mod_Width` of the floor row — breaks on
corner articles and hoods. Needs the user's decision before implementation.

**Test.** A centred row in one call; a corner placement by `wall` and `alignment`.

### #28 `place-group` on a group that already stands where asked reloads it — cause confirmed

The load is unconditional (`tool-executors.ts:1957-1962`). Live: the repeated call resets the
worktop again and drifts the group by 5 mm, because the footprint after the reload includes the
worktop's overhang (x −10 … 1210) that the first placement did not have.

**Fix.** Compare the computed placement with the group's current position in the placement frame
(`positionInPlacementFrame`, `group-placement.ts:331-361`): same point within 5 mm and same
rotation → no load, result `{ placedIn, wall, group }` plus the correction "group '…' already stands
there - nothing was reloaded".

**Test.** `place-group` to the group's own position makes no load call and says so.

### #31 A wall-unit row over a corner article runs through the side wall — cause confirmed

The corner rule (line 17) and Example 3 (lines 44-51) describe the floor rows only. Nothing says
where the wall units of an L go, and the catalog has no corner wall unit.

**Fix** (clarify first): line 17 gets one sentence — "the wall units of each leg hang above the floor
units of that leg: the first one `above` a floor unit of the leg, the next ones rightOf or leftOf it;
never put a wall unit on or above the corner article" — and Example 3 one wall unit per leg. A
derivation (a wall unit related to a corner article moved to the first floor unit of a leg) is a
second step once the runs show that the rule alone is not enough.

**Test.** `hi-mcp-server.test.ts` asserts the sentence; in "test the mcp", the corner kitchens have no
wall unit outside the room.

### #33 Wall units beside a tall unit at the end of the row hang over empty floor — cause confirmed

Rule line 16 and Example 2 put the tall unit first with the base units on the side the wall units
go to; nothing says that the wall units go on the side of the floor units. `sideOfTall`
(`group-layout.ts:322-342`) already knows that side for a wall unit *without* a relation (G31).

**Fix.** Rule line 16: "wall units beside a tall unit go on the side of the base units (leftOf a tall
unit that ends the row)". Then the correction with what the server already knows: a wall unit
`rightOf`/`leftOf` a tall unit on a side without a floor unit is moved to the side with the floor
units (`sideOfTall`), reported.

**Test.** A row with the tall unit last and a wall unit `rightOf` it → `leftOf` the tall unit with
the correction.

### #4, #7 — hardening of the corrections for docking written as `contextData`

- #4 `rowEnd` (`tool-executors.ts:621-639`) follows the same vector name through a corner article;
  covered by the fix of #1 (stop at a corner article, both in `dockTarget` and
  `separateSideVectorPartners`).
- #7 `create-or-replace-groups` checks no docking vector against the article's vectors; `dockTarget`
  does only when the catalog knows them (`articleDockingVectors`, `:705-710`). A vector the article
  does not have → the partner of the root's vector when the article has it (as P7), else the entry
  is dropped, the root docked like an undocked root (G7), both reported. Relation payloads never
  write a vector (G36 covers `behind` a corner article), so this stays low.

## D. Only for docking written as `contextData` (low)

Verified against the code; none of them occurs with relations, and the server still accepts
`contextData` (D34). They stay open at low priority:

| # | Where the cause still is | Covered for relations by |
|---|---|---|
| 3 | `dockingRelations` keeps one partner per root, the last entry wins (`group-placement.ts:57-61`) | G33 drops a relation that closes a ring |
| 5 | the merge tool's description still teaches the hood only between wall units (`hi-mcp-server.ts:391-397`) | rule line 16: "a range hood without wall units hangs above the hob unit" |
| 10 | `merge-article-into-group` has no `above`: its description asks for `[0, <gap>, 0]` (`:396`) and suggests `[0, 600, 0]` (`:437`), 60 mm too low; `dockTarget` passes a wall unit on a Top vector without a y offset on | D35 in `hangGap` for `above` |
| 13 | `connectUnreachedRoots` docks a wall-unit part only to a reached wall unit (`tool-executors.ts:778-793`) | G31 hangs the first wall unit beside a tall unit or above a floor unit |
| 14 | no category check for a docked root | G34 |
| 15 | the lead of a part is not filtered by its kind (`:794-799`) | G31 — G7 does not run for relation payloads |

**#10 keeps one medium part**: `merge-article-into-group` is the tool for one wall unit added later,
and it makes the agent compute the gap. `dockTarget` derives the y offset for a wall unit (catalog
category "Wall Units" or a hood) docked `*Top -> *Bottom` on a floor unit without a y offset — the
`hangGap` arithmetic of `group-layout.ts`, moved where both can use it — and reports it; the tool
description loses `[0, <gap>, 0]` and `[0, 600, 0]`. Test: a wall unit merged on a base unit's
`LeftTop` without an offset gets `[0, 660, 0]`; an explicit offset is kept; a wall unit beside a
wall unit gets none.

## E. Hardening — chat (`hi-mcp/hi-mcp-chat`)

### #9 Answers claim what the plan does not have — cause confirmed

`CHAT_SYSTEM_PROMPT` (`chat-server.ts:15-19`) is three sentences and asks for no check against the
tool results; the rule "Verify results numerically" reaches the model only through
`get-authoring-rules`.

**Fix.** One sentence: "Answer only with what the last tool results show - the groups, their roots
and attributes, corrections and notLoaded - and name what was asked but is not in the plan." The
constant moves to `chat-config.ts` so that `tests/chat-handler.test.ts` can assert it.

### #17 A chat turn without an answer for 10 minutes — cause confirmed

`streamText` (`chat-server.ts:112-120`) sets no `providerOptions` (reasoning effort) and no
`abortSignal`; the stream loop (`:125-150`) emits only text deltas and tool status lines, nothing
while the model reasons; no step logs its usage. Not seen since the relations (gpt-5-mini answered
06 in 68 s and 10 in 54 s), but the turn still has no limit.

**Fix.** `onStepFinish` logs the usage of every step (input, output and reasoning tokens, the size
of the tool input) — the measurement the backlog note
[reasoning-effort-for-the-gpt-chat-models.md](../backlog/reasoning-effort-for-the-gpt-chat-models.md)
asks for; a turn limit with `abortSignal` (e.g. 5 minutes) that ends the stream with "[error] the
turn took longer than … - the plan holds what the tools changed so far"; then the reasoning effort
per GPT deployment, measured with "test the mcp".

**Test.** `chat-handler.test.ts`: the turn limit ends a stream that never answers, with the message.

## Order of work

The ticket's order, with what this analysis adds:

1. **Compile gaps** (A): #29, #32, #21, #19 — four branches in `relationsToDocking`, one test file.
   D35 is confirmed; the behaviour reference drops "to be confirmed".
2. **Server bugs** (B): #1 (+#4), #22 (place-group with the generated roots; the replace path), #6
   (group attributes applied kitchen-wide, the rule sentence), #34.
3. **Hardening** (C): #28, #26, #24, #8, #25, #12 and #30 (the plan context), #33, #31, the
   medium part of #10; #27 after the D23 decision.
4. **Chat** (E): #9, #17.
5. The `contextData`-only entries (D) stay in the backlog at low priority.

Every fix updates [hi-mcp-behaviour.md](../../hi-mcp/docs/hi-mcp-behaviour.md) (the guards and
corrections table, C1, D29, D35, §2.3 for the root entries of `notLoaded`, §5.4 for `opening`,
`name` and `corners`), the tool reference in `.agents/skills/hi-mcp-tools.md`, and removes the issue
from [mcp-test-open-issues.md](../backlog/mcp-test-open-issues.md) and the backlog README. The
definition of done is a "test the mcp" run with gpt-5-mini, gpt-5.4-mini and gpt-6-astra that shows
none of the fixed issues.

## Where the backlog was imprecise

- #18 and #20 are fixed on `master` (G40, G41); the ticket still lists them first.
- #22 is not a `place-group` bug only: every replace through `create-or-replace-groups` loses the
  generated roots' colours the same way (C1).
- #28 also moves the group: a repeated `place-group` is not idempotent (5 mm per call).
- #10 is not `contextData`-only: `merge-article-into-group` still makes the agent compute the hang
  height.
- #12's cause is in roomle-ui's wall derivation, but the server can name an opening without a
  roomle-ui change; only the windows need roomle-ui.
