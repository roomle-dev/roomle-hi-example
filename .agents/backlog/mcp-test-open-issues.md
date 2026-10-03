# Open issues of the MCP test

> **Type**: Backlog — what is to be done after the analyses of "test the mcp"
> **Domain**: hi-mcp — `create-or-replace-groups`, `merge-article-into-group`, the command tools
> (`hi-mcp/hi-mcp-poc-json/tool-executors.ts`, `group-layout.ts`, `group-placement.ts`), the served
> rules (`hi-mcp-server.ts`), the chat (`hi-mcp/hi-mcp-chat`); two roomle-ui defects and one
> RoomleCore defect
> **Maintained by**: step 7 of [the testing skill](../skills/hi-mcp-testing.md#7-open-issues)

Each issue names the problem, the test prompt that shows it, the cause in the code, the to-do and
its test. An issue leaves this list when its fix is in the code. The guideline for every server
issue is [Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort): correct where the
intent is clear, report what was corrected, and never drop the agent's content silently.

## Overview

| # | Issue | Kind | Test prompt | Priority |
|---|---|---|---|---|
| 1 | [A taken side is re-targeted to the far end of the row](#1-a-taken-side-is-re-targeted-to-the-far-end-of-the-row) | bug, MCP server | add one unit; image: kitchen in the back right corner | high — a unit behind the wall, a row through the wall |
| 3 | [A docking ring anchors the wrong root](#3-a-docking-ring-anchors-the-wrong-root) | bug, MCP server | four cabinets on the back wall; oven, fridge, sink in the corner | low — docking written as `contextData` only |
| 4 | [The side correction walks through a corner article](#4-the-side-correction-walks-through-a-corner-article) | hardening | kitchen in the back right corner | medium |
| 5 | [A range hood without wall units has no docking recipe](#5-a-range-hood-without-wall-units-has-no-docking-recipe) | bug, rules | oven, range hood, sink, fridge; full kitchen around the corner | low — with relations the hood hangs `above` the hob |
| 6 | [A material for the whole kitchen is not applied](#6-a-material-for-the-whole-kitchen-is-not-applied) | bug, MCP server | full kitchen around the corner; image: kitchen on the left-hand wall | high — the requested material is missing |
| 7 | [Docking to a vector the article does not have](#7-docking-to-a-vector-the-article-does-not-have) | hardening | oven, fridge, sink in the corner | medium |
| 8 | [Root module ids are passed on unresolved](#8-root-module-ids-are-passed-on-unresolved) | hardening | change one unit | medium |
| 9 | [Answers claim what the plan does not have](#9-answers-claim-what-the-plan-does-not-have) | hardening, chat | most prompts with a wrong result (8 of 17 runs on 2026-10-02 12:45) | medium |
| 10 | [A wall unit stands on the worktop instead of hanging on the wall](#10-a-wall-unit-stands-on-the-worktop-instead-of-hanging-on-the-wall) | bug, MCP server | full kitchen around the corner | medium — `contextData` only; with relations the height is derived (D35, to confirm) |
| 11 | [A merged group reaches into the back wall](#11-a-merged-group-reaches-into-the-back-wall) | bug, RoomleCore — [RML-18040](https://roomle.atlassian.net/browse/RML-18040) | join groups | — |
| 12 | [The door opening is listed as a wall](#12-the-door-opening-is-listed-as-a-wall) | hardening | image: planning on the right-hand wall | medium |
| 13 | [Undocked wall units reject the whole group](#13-undocked-wall-units-reject-the-whole-group) | hardening | full kitchen around the corner | low — docking written as `contextData` only |
| 14 | [A floor unit is docked onto a top vector](#14-a-floor-unit-is-docked-onto-a-top-vector) | hardening | image: kitchen on the left-hand wall | low — docking written as `contextData` only |
| 15 | [A G7 correction docks a part by a wall unit at floor level](#15-a-g7-correction-docks-a-part-by-a-wall-unit-at-floor-level) | bug, MCP server | image: kitchen in the back right corner | low — docking written as `contextData` only |
| 16 | [`change-module-attribute` fails with "checkAttributes.get is not a function"](#16-change-module-attribute-fails-with-checkattributesget-is-not-a-function) | bug, roomle-ui — [RML-18039](https://roomle.atlassian.net/browse/RML-18039) | image only, no text | critical — an attribute edit fails |
| 17 | [A chat turn without an answer for 10 minutes](#17-a-chat-turn-without-an-answer-for-10-minutes) | hardening, chat | image: kitchen on the left-hand wall; full kitchen around the corner | medium |
| 19 | [`above` a tall unit puts the unit on top of it, unreported](#19-above-a-tall-unit-puts-the-unit-on-top-of-it-unreported) | bug, MCP server | oven, range hood, sink, fridge in the corner | medium — a hood on the oven tower |
| 21 | [Two units `above` one floor unit take the same place](#21-two-units-above-one-floor-unit-take-the-same-place) | hardening | image: kitchen on the left-hand wall; full kitchen around the corner | medium — the hood inside a wall unit |
| 22 | [`place-group` resets the worktop and toe kick colours](#22-place-group-resets-the-worktop-and-toe-kick-colours) | bug, MCP server | image: kitchen on the left-hand wall | medium — the requested worktop colour is lost |
| 23 | [A worktop colour change drops hanging wall units onto the worktop](#23-a-worktop-colour-change-drops-hanging-wall-units-onto-the-worktop) | bug, roomle-ui | full kitchen around the corner | high — wall cabinets on the worktop |
| 24 | [A second create with the agent's own group id builds a duplicate group](#24-a-second-create-with-the-agents-own-group-id-builds-a-duplicate-group) | hardening | full kitchen around the corner | medium — two kitchens on one spot |
| 25 | [`dockTo` written on the roots of `create-or-replace-groups`](#25-dockto-written-on-the-roots-of-create-or-replace-groups) | hardening | four cabinets on the back wall | low — corrected right by G7 |
| 26 | [One unknown article id rejects the whole group](#26-one-unknown-article-id-rejects-the-whole-group) | hardening | full kitchen around the corner | medium — a retry step |
| 27 | [A new group without a placement, moved with `place-group` right after](#27-a-new-group-without-a-placement-moved-with-place-group-right-after) | hardening | three tall units; four cabinets; image only | medium — a second call and a reload |
| 28 | [`place-group` on a group that already stands where asked reloads it](#28-place-group-on-a-group-that-already-stands-where-asked-reloads-it) | hardening | image: kitchen in the back right corner; full kitchen around the corner | low |

Since RML-18038 the agent writes relations (`rightOf`, `leftOf`, `onTop`, `above`, `behind`) and the
server compiles the docking (`group-layout.ts`). In the test with all three models
(`mcp-test-2026-10-02_17-25-40`) no relation needed a correction. What comes first:

- **Gaps of the compile**: 19 and 21. 18 (a floor unit beside a wall unit) and 20 (a hood beside a
  tall unit) are fixed by the review of PR #51 (G40, G41).
- **Wrong results of the server's own corrections or placement**: 1, and 22 (`place-group` resets the
  worktop colour).
- **Requests the tool API makes the agent get wrong**: 6 (a material for the whole kitchen).
- **Planner defects**: 23 (a worktop colour change drops hanging wall units), 16 (RML-18039).

Issue 2 (an on-top docking counted as a side neighbour) is fixed: `sidePartnersOf` counts side pairs
only. Issues 3, 13, 14 and 15 no longer occur with relations; they stay for docking written as
`contextData`, which the server still accepts.

## 1. A taken side is re-targeted to the far end of the row

**Problem.** `merge-article-into-group` on the rightmost unit of a row, with its `LeftBottom`,
which the neighbour already takes. The unit's own `RightBottom` is free: it is itself the free end
of the row. The server walks along `LeftBottom` to the far end of the row and docks the new unit
there. In a row flush into a corner, the new unit stands behind the wall.

**Cause.** `dockTarget` (`tool-executors.ts`) knows one direction only: `rowEnd` walks in the
direction of the taken vector. Decision D29 says "the free end of that row", and the row has two
ends.

**To do.**
- When the named root's opposite side vector is free, the root is itself an end of the row. Dock
  there, and report "the LeftBottom of root … is taken - the unit was docked to its free
  RightBottom".
- Otherwise walk in the named direction.
- Apply the same rule in `separateSideVectorPartners`.

**Test.** A row of three, `merge-article-into-group` on the last root's taken `LeftBottom`, docks
to that root's `RightBottom`. A middle root with both sides taken still goes to the end in the
named direction.

**Latest runs** (`mcp-test-2026-10-02_12-45-24`).
- 11 (add one unit): the taken `LeftBottom` of the front end unit sent the drawer cabinet to the
  first unit, behind the back wall (group `pos` z −4365, the wall at −3765).
- 07 (image: kitchen in the back right corner): two roots on the corner unit's `RightBottom`. The
  later one went to the end of the tall row, not to the corner unit's free `LeftBottom`. The result
  is a straight 6271 mm row through the front wall instead of the image's L shape.

## 3. A docking ring anchors the wrong root

**Problem.** The model docks cab1 → cab2 → cab3 → cab4 along `RightBottom` and also cab4 on cab1's
`LeftBottom`, which closes the row into a ring. The planner arranges cab4 left of cab1, but the
server anchors another root: the row stands through the side wall, without a correction. A unit
docked to both ends of a corner kitchen's legs closes the same kind of ring.

**Cause.**
- `findAnchorRoot` (`group-placement.ts`) walks left through `dockingRelations`, whose maps keep one
  partner per root (the last entry wins). On a ring it stops wherever it meets a visited root.
- The planner arranges breadth-first from the first root, so the first entry that reaches a root
  places it.
- Server and planner disagree, and the anchor is not the leftmost unit.

**To do.**
- Break a ring in `completeDocking` (`tool-executors.ts`). In the planner's order (breadth-first
  from the first root), the side entry that reaches an already reached root is dropped and reported:
  "the docking of 'cab4' on the LeftBottom of 'cab1' closes a ring - dropped".
- Then the anchor walk and the planner agree.

**Test.** The ring of four loads as one row with the ring entry dropped; the anchor is the row's
left end (cab1); the correction is reported.

**Relation payloads** (RML-18038): fixed — one relation per unit cannot form a ring that the server
does not see; a relation that closes one is dropped and reported (G33). Open for docking written as
`contextData`.

## 4. The side correction walks through a corner article

**Problem.** `b1` stands on a corner article's left leg (the back wall); the model docks `b2` to
`b1`'s `RightBottom`, which faces the corner and is taken by the corner article. The correction walks
along `RightBottom` through the corner article onto the other leg and docks `b2` at the end of the
right wall. The model meant the back wall: `b1`'s `LeftBottom` was free.

**Cause.** `rowEnd` follows the same vector name through a corner article. A corner article ends a
leg: its `LeftBottom` and `RightBottom` arms run along different walls.

**To do.** The walk stops at a corner article. If the named direction runs into one, the unit goes
to the free end of the root's own leg, the other direction. This applies to both
`separateSideVectorPartners` and `dockTarget`. Issue 1's rule — the named root's own free side first
— covers most cases.

**Test.** The corner shape above docks `b2` to `b1`'s `LeftBottom`, on the back wall.

## 5. A range hood without wall units has no docking recipe

**Problem.** The rules tell how a range hood hangs between two wall units. A kitchen without wall
units, or with a single wall unit, has no recipe. The model then:
- names the hood in the docking of a base unit's `RightTop` without sending it (the server reports
  the unsent root);
- or leaves the hood out, and answers that it was built.

**Cause.** `hi-mcp-server.ts`, the docking pairs of the served rules: the only hood sentence is
"range hood: it hangs between two wall units like a unit beside them".

**To do.**
- Verify in a live check how a hood docks above a hob unit without wall units: `LeftTop` of the hob
  unit → `LeftBottom` of the hood with `offset [0, <gap>, 0]`. Measure where it hangs, and which gap
  puts it at the height of the wall units.
- Add the verified recipe to the docking pairs, beside the one between wall units.

**Test.** `hi-mcp-server.test.ts` asserts the recipe. In "test the mcp", the two prompts with a
hood carry a hood root, and it hangs above the hob, not on the floor or the worktop.

**Latest runs** (`mcp-test-2026-10-02_12-45-24`).
- 04: the model docked the hood to the sink unit's `RightBottom`; it stands on the floor.
- 10: the hood was docked to the sink unit's `LeftTop` without an offset; it stands on the worktop.

Neither run reported it. A hood at a height it cannot have is a bug by the rules of the testing
skill, so the kind is now "bug, rules". Also look at G7 in
[the behaviour reference](../../hi-mcp/docs/hi-mcp-behaviour.md): it sends an undocked range hood
to the floor row on purpose.

**Latest runs** (`mcp-test-2026-10-02_13-47-02`).
- gpt-5.4-mini 04: the hood on the sink unit's `RightBottom` stands on the floor.
- gpt-5.4-mini 10: on a base unit's `LeftTop` without an offset, it stands on the worktop.
- Hoods that hang: gpt-5-mini 04 docked the hood on the oven base's `LeftTop` with
  `offset [0, 600, 0]`, and gpt-6-astra 03/04 hung it between two wall cabinets (offset 650/700).
  The recipe the to-do asks for works.

**Relation payloads** (RML-18038): the hood counts as a wall unit — it continues `rightOf` / `leftOf`
the wall units, or hangs `above` the hob with the gap of the wall units (D35). Not verified live yet.

**Latest runs** (`mcp-test-2026-10-02_17-25-40`): with relations the hood hangs `above` the hob —
gpt-5-mini 04 (`[0, 660, 0]`, y 1480), gpt-6-astra 03 and 04 (`gapMm` 750). What stays: the served rules
name the hood only beside wall units, and a hood `above` a tall unit stands on it (issue 19).

## 6. A material for the whole kitchen is not applied

**Problem.** "The front of the kitchen should be made of walnut and the worktop should be made of
dark marble" — the plan has one walnut front, and the worktop keeps its colour.
- The model sent the materials as attribute overrides of a single root: `mod_FrontColor` 215 and
  `mod_CountertopColor` 324 on the corner root.
- An override changes one unit only, so only the corner's front is walnut.
- `mod_CountertopColor` belongs to the generated worktop root (`mr_Countertop`), not to a base unit,
  so it has no effect ([worktop colour analysis](../bug-analysis/worktop-colour-not-discoverable.md)).
- Nothing reports either.

**Cause.** The tool API cannot express a kitchen-wide material when it creates a kitchen:
- the `attributes` of a root are overrides of that unit (rules, `hi-mcp-server.ts`: "attributes is
  an optional list of { id, value } overrides");
- the `attributes` of a group are the library's group settings (`mod_GroupHeight`,
  `mod_GroupGenerationLogic`, …), not materials;
- `change-group-attribute` sets an attribute on every root and sub module that carries it, the
  generated worktop included (D20). But it works on a group that already exists, and the rules
  present it for editing only ("change-group-attribute (attributes, e.g. the front colour of the
  whole kitchen)"). One prompt therefore needs two calls, and the rules do not say so.
- `create-or-replace-groups` passes the overrides on unchecked. The library ignores an attribute the
  module does not carry, and nothing reports an override that reaches one unit of a kitchen.

**To do** — simplify the tool API first ([Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort)):
- `create-or-replace-groups` takes kitchen-wide attributes with the group: `{ id, value }` entries
  of the group's `attributes` that are not group settings. After the load the server applies them
  with `change-group-attribute` — every unit and generated root that carries the attribute — and
  reports what it applied.
- The rules say it in one sentence: a material for the whole kitchen (fronts, worktop, carcase) goes
  into the group's `attributes`, a material for one unit into that root's `attributes`.
- Correction for the input of this run: an override that roots of a new group carry but only some
  of them set — the walnut on the corner root — is applied to the whole group and reported. An
  override of an attribute only a generated root carries (`mod_CountertopColor` on a base unit) is
  applied to the group the same way and reported.
- An override no root and no generated root of the group carries is reported.
- Needs a decision: whether an override on some roots is always meant for the whole kitchen, or only
  when the request names the kitchen. The server cannot read the request, so the first is the
  simpler rule.

**Test.**
- A new group with `mod_FrontColor` and `mod_CountertopColor` in its `attributes`: after the load,
  `change-group-attribute` runs for both, and the result reports them.
- The overrides of this run: both reach the whole group and are reported.
- An override nobody carries is reported.
- In "test the mcp", the full kitchen has walnut fronts on every unit and a dark marble worktop.

**Latest runs** (`mcp-test-2026-10-02_12-45-24`).
- 10: the first call had walnut on every unit and was rejected (issue 13). The retry set
  `mod_FrontColor` 215 on the corner unit only, so the plan has one walnut front.
  `mod_CountertopColor` was never sent.
- 06 (image): the sage fronts of the picture (`mod_FrontColor` 160) reached the tall and wall
  units; the base units kept the default front.

**Latest runs** (`mcp-test-2026-10-02_13-47-02`).
- gpt-5.4-mini 10: walnut on the corner unit only.
- gpt-5.4-mini 06: the image's sage on four of six units.
- gpt-5-mini 07 and every gpt-6-astra run set the materials with `change-group-attribute` and got
  the whole kitchen. The API change of the to-do matches what the stronger models do on their own.

**Latest run** (`mcp-test-2026-10-02_17-25-40`): gpt-5.4-mini 10 — dark marble on the fridge root only; the worktop keeps 380.

## 7. Docking to a vector the article does not have

**Problem.** The model docks the sink `BackBottom → BackBottom` to a corner article. A corner article
has no `BackBottom`; its vectors are `Left/RightBack*`, `Left*` and `Right*`. The planner puts the
sink at the corner's origin, inside the corner cabinet, without an error.

**Cause.** `create-or-replace-groups` does not check `ownDockingVector` or `dockingVector` against
the article's vectors. On an empty plan the catalog has none (backlog
[article template geometry](roomle-ui-article-template-geometry.md)). The anchor probe calculates
the anchor's docking vectors, but the server keeps only its frame.

**To do.**
- Check the vectors of an entry where they are known: the catalog's `dockingVectors` (articles
  already in the plan), and the probe's `dockInfos` (anchors — keep the vector names alongside the
  anchor frame).
- A vector the article does not have is replaced by the nearest valid one if the intent is clear.
  `BackBottom` on a corner article means behind it, and a corner article has no behind, so the entry
  is dropped, the root is docked like an undocked root (G7), and both are reported.

**Test.** The shape above with the corner's vectors known: the sink entry is dropped and reported,
and the sink is docked to a free row end, not inside the corner.

**Relation payloads** (RML-18038): the server picks the vectors of the relation; `behind` a corner
article is ignored and reported (G36). Open for docking written as `contextData`.

## 8. Root module ids are passed on unresolved

**Problem.** The model chooses the right tool, `change-module-attribute` with `mod_Width`, but
mistypes the root id: a segment of the group id mixed into the root's UUID. The planner answers "not
found", and the model gives up.

**Cause.** `findGroup` (`tool-executors.ts`) resolves group ids by a unique prefix (C4). The root ids
of `change-module-attribute`, `delete-root-module`, `exchange-root-module` and `dockTo.rootId` of
`merge-article-into-group` go to the planner as sent.

**To do.**
- Resolve root ids against the plan's roots: the exact id, else a unique prefix — the first UUID
  segment is enough.
- Report the resolution as a correction; an id that matches nothing or more than one root stays the
  planner's error, with the root ids of the group added.

**Test.** `change-module-attribute` with a root id whose first segment is right resolves to the root
and reports it; an ambiguous prefix fails with the candidates.

**Latest run** (`mcp-test-2026-10-02_12-45-24`): 14.
- The model sent `378c6f4a-acee-4206-81c9-92b22c32e522`; the root is
  `378c6f4e-acee-4206-81c9-92b22c32e522`.
- The typo is in the first segment, so a unique prefix does not resolve it, but the other four
  segments match exactly.
- Extend the to-do: if no prefix matches, resolve a unique root whose id differs in one character
  (or whose last four segments match), and report the resolution.

## 9. Answers claim what the plan does not have

**Problem.** The model's final answer lists units, materials or edits the plan does not have:
- a hood and a sink that were never built;
- walnut fronts and a marble worktop that were not applied;
- a unit "placed" that was not added;
- a 900 mm unit that is 600 mm wide.

The tool results show the truth: `corrections`, the groups with their roots, the attributes.

**Cause.** The chat's system prompt (`hi-mcp/hi-mcp-chat`, three sentences) does not ask the model
to check its answer against the tool results. The rule "Verify results numerically" is served by the
MCP server, which the chat's model reads only through `get-authoring-rules`.

**To do.**
- Add one sentence to the chat's system prompt: answer only with what the last tool results show,
  and name what was asked but is not in the plan.
- Check in "test the mcp" whether the answers of the corner kitchens and the edits match the plan.

**Test.** The chat handler's test asserts the sentence in the system prompt.

**Latest runs** (`mcp-test-2026-10-02_12-45-24`): 02, 04, 05, 06, 08, 09, 10, 11. Examples:
"aligned to the back wall" for a row outside the room, a sink that is not there, "walnut and dark
marble" for one walnut front and a white worktop.

**Latest runs** (`mcp-test-2026-10-02_13-47-02`): gpt-5.4-mini 01, 02, 04, 10, 14.

**Latest runs** (`mcp-test-2026-10-02_17-25-40`): gpt-5-mini 06; gpt-5.4-mini 05, 07, 09, 10, 14.

## 10. A wall unit stands on the worktop instead of hanging on the wall

**Problem.** A wall cabinet docked on top of a base unit (`LeftTop → LeftBottom`) without a `y`
offset stands directly on the base unit, at y 820, on the worktop. A wall cabinet hangs on the wall
above the worktop: in Furniture_Smith at y 1480, with its top at 2200, flush with the tall units.

**What decides the height** (measured in the example page):

| Wall unit `OTB60` | Its bottom |
|---|---|
| alone | 0 — on the floor |
| on a base unit, no offset | 820 — the top of the base unit |
| on a base unit, no offset, `mod_HeightPosInsertion` 1480 | 820 — the library computes the attribute and ignores the override |
| on a base unit, `offset [0, 660, 0]` | 1480 |
| top edges aligned to a tall unit (`HK260.RightTop → LeftTop`) | 1480 |

The library never hangs a wall unit by itself; only the docking does.

**Cause.**
- The rules make the agent supply a height it cannot know: "wall unit W above base unit A: A -> W
  LeftTop -> LeftBottom, offset [0, <gap between the top of A and the bottom of W>, 0]"
  (`hi-mcp-server.ts`). Neither the rules nor the catalog give the gap. The description of
  `merge-article-into-group` suggests `[0, 600, 0]` instead, which hangs the unit 60 mm too low.
- `create-or-replace-groups` and `merge-article-into-group` pass a wall unit docked on a floor unit
  without a `y` offset on as sent, unreported.

**To do** — let the server derive what the agent cannot know
([Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort), step 2):
- A wall unit (catalog category "Wall Units") docked with a `*Top → *Bottom` pairing on a floor unit
  without a `y` offset gets the offset that hangs it at the library's wall-unit height. The server
  reports it ("'wall1' hangs 660 mm above 'back1', at the height of the wall units").
- The same in `dockTarget` for `merge-article-into-group`.
- Decide the source of the height before implementing:
  - the top of the tall units (`HK260`: 2200);
  - the library's wall height lines (`mod_WallHeightLines` = `WallCabinetsPlinthArea`);
  - a value per library.

  The offset is then the top line minus the wall unit's height minus the top of its carrier
  (2200 − 720 − 820 = 660).
- The rules: the wall-unit pairing loses the `<gap>` placeholder — dock it on top, and the server
  hangs it at the wall-unit height; an explicit `y` offset is kept. The `merge-article-into-group`
  description drops `[0, 600, 0]`.

**Test.**
- A base unit with a wall unit on its `LeftTop` without an offset loads with `offset [0, 660, 0]`
  and the correction.
- An explicit `y` offset is kept.
- A wall unit beside another wall unit gets no offset.
- In "test the mcp", the wall cabinets of the full kitchen hang at y 1480.

**Latest run** (`mcp-test-2026-10-02_12-45-24`): 10.
- Both `OTB60` were docked on the same `LeftTop` of a base unit without a `y` offset.
- They stand on the worktop, one inside the other; the server completed both entries without
  separating them.
- The separation of two roots on one vector covers side vectors only — check `*Top` too.

**Latest run** (`mcp-test-2026-10-02_13-47-02`): gpt-5.4-mini 10.
- Two `OTB60` were docked to the side vectors of floor units (`corner.LeftBottom`,
  `sink.RightBottom`). They stand on the floor, unreported.
- A wall unit on a floor unit's side vector needs the same correction as one on its top without an
  offset.
- gpt-6-astra hung its wall units with offsets 650/700. The height the server should derive is still
  the open decision.

**Relation payloads** (RML-18038): `above` hangs a wall unit with the derived gap (D35: tall − wall −
base `mod_Height`, 660 in Furniture_Smith), a wall unit beside a tall unit docks by the Top vectors,
and a wall unit `rightOf` / `leftOf` a base unit is hung `above` it (G35). The source of the height
(D35) is still to be confirmed. Open for docking written as `contextData`.

## 11. A merged group reaches into the back wall

**Problem.** After `delete-root-module` and `merge-groups`, the merged group's toe kick reaches
120 mm into the back wall: the group's footprint starts at x −120 before the unit in the corner.

**Cause and to-do.** Not the HOMAG library: the kernel's merge report gives the merged group an
origin 120 mm inside the wall and a wrong surrounding contour, and `calculateGroup` uses both
([analysis](../bug-analysis/merged-group-toe-kick-reaches-into-the-wall.md#result-2026-10-02)).
Follow-up in RoomleCore: [RML-18040](https://roomle.atlassian.net/browse/RML-18040). No MCP server
change.

**Latest run** (`mcp-test-2026-10-02_12-45-24`): 16 — footprint 1920 mm for two units spanning 1800 mm.

**Latest run** (`mcp-test-2026-10-02_13-47-02`): gpt-5-mini 16 (1920 mm). Not in gpt-6-astra 16: the model moved the second
group next to the first with `place-group` before merging. The toe kick reaches into the wall only
when the merged units stand apart.

**Latest runs** (`mcp-test-2026-10-02_17-25-40`): gpt-5-mini 16, gpt-5.4-mini 16 (1920 mm). Not in gpt-6-astra 16, which closed the gap with `place-group` first.

## 12. The door opening is listed as a wall

**Problem.** The model placed a group at `[4815, 0, 280]` / 270: the `end` of the right wall's
900 mm entry, which is the door opening. The corner unit stands in front of the door, and the run
goes through the front wall.

**Cause.** `get-plan-context` lists the opening among the walls (`side` "right", `type: null`,
`start`, `end`, `facingRotationY`). The rule "use the walls of type wall" (`hi-mcp-server.ts`) asks
the model to skip it, but `type: null` does not say that the entry is an opening.

**To do.**
- Name the type of an opening in the walls array (`door`, `opening`), or leave openings out of the
  walls and list them separately.
- Check whether the planner's plan context knows the opening kind (roomle-ui
  `getExternalObjectPlanContext`).

**Test.** A plan context with a door lists it with its type. In "test the mcp", the image prompt on
the right-hand wall places the group at the end of the long right wall.

**Latest run** (`mcp-test-2026-10-02_12-45-24`): 08.

**Latest run** (`mcp-test-2026-10-02_17-25-40`): gpt-5-mini 09 — wall units hang in front of the back wall's window; the walls list no windows either.

## 13. Undocked wall units reject the whole group

**Problem.** `create-or-replace-groups` with every unit undocked — floor units and two wall units —
fails with "Invalid pos groups - nothing was loaded: roots 'wall1', 'wall2' are not docked to a
placed root". The floor units would have been docked as a row (G7), but the wall units had no
wall-unit row to join. The model's retry kept the walnut fronts on one unit only (issue 6).

**Cause.** `connectUnreachedRoots` (`tool-executors.ts`) docks an unreached part only to a reached
root of its own kind (`isWallUnit(root) === kind`). The first wall unit of a kitchen has none, so
the group is not built ([Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort):
the intent is clear, and the server can correct it).

**To do.**
- Hang the first undocked wall unit on a free `*Top` of a reached floor unit, at the wall-unit
  height of issue 10. Dock further wall units beside it, as G7 does, and report it.
- This depends on the height decision of issue 10.

**Test.** A group of floor units and two undocked wall units loads. The wall units hang above the
floor row, and the correction names them.

**Latest run** (`mcp-test-2026-10-02_12-45-24`): 10.

**Latest run** (`mcp-test-2026-10-02_13-47-02`): gpt-5.4-mini 10.
- The first call was refused for the undocked `wallcab1`, `wallcab2`, `hood`.
- The second was refused for an empty group (`posGroups[1]: needs a non-empty roots array`) and two
  roots on one side vector the server could not move apart.
- The third call loaded, with walnut on one unit.

**Relation payloads** (RML-18038): fixed — a wall unit without a relation hangs beside a tall unit or
above a floor unit (G31). Open for docking written as `contextData`.

## 14. A floor unit is docked onto a top vector

**Problem.** The model docked the sink base unit `SUT60` on `U2TB90.LeftTop` with
`offset [0, 660, 0]`. The sink base unit hangs in the air above a base unit.

**Cause.** The server uses the catalog category only for undocked roots (G7). A docking entry that
puts a floor unit (category not "Wall Units") on a `*Top` vector passes unchanged.

**To do.**
- A floor unit docked on a `*Top` vector of another floor unit is docked to the free end of that
  row instead, and the correction says so.
- Decide on the exceptions first (a top unit on a tall unit, an article whose category is unknown).

**Test.** A sink base unit on a base unit's `LeftTop` is docked beside it, with the correction.

**Latest run** (`mcp-test-2026-10-02_12-45-24`): 06.

**Relation payloads** (RML-18038): fixed — a floor unit `above` a unit is put `rightOf` it (G34). Open
for docking written as `contextData`.

## 15. A G7 correction docks a part by a wall unit at floor level

**Problem.** The first root of a group is not connected to the rest. G7 docks the unconnected part to
the free end of the first root's row, but it may pick a wall unit of the part as the lead:
- in gpt-5.4-mini 07, `upperLeft`, an `OFKB90`, was docked to the fridge's `RightBottom`;
- the wall unit then stands at floor level, and the 24 other roots hang off it.

**Cause.** `connectUnreachedRoots` (`tool-executors.ts`) takes `kind = isWallUnit(partRoots[0])` and
filters the target by that kind. The lead is `partRoots.find(…)`, any root of the part with a free
side vector, whatever its kind.

**To do.**
- Filter the lead by the same kind as the target: a floor part is docked by a floor unit, a
  wall-unit part by a wall unit.
- If the part has no lead of its kind with a free side vector, it is not built (G7, second row),
  with the docking entry to send.

**Test.** A group whose first root stands alone and whose other roots form a floor row with a wall
unit as the first root of the part with a free `LeftBottom`: the part is docked by its floor unit,
and the wall unit stays on its carrier.

**Latest run** (`mcp-test-2026-10-02_13-47-02`): gpt-5.4-mini 07.

**Relation payloads** (RML-18038): fixed — a root without a relation continues the row of its kind
in list order (G31); G7 does not run for them. Open for docking written as `contextData`.

## 16. `change-module-attribute` fails with "checkAttributes.get is not a function"

**Problem.** `change-module-attribute` with `mod_HeightPosInsertion` 1420 on a root of a group the
model had created, changed and recreated in the same session fails in the page with "iframe:
checkAttributes.get is not a function" — a TypeError, not a validation message.

**Cause** (reproduced — [analysis](../bug-analysis/check-attributes-lost-after-a-discarded-calculation.md),
follow-up [RML-18039](https://roomle.atlassian.net/browse/RML-18039)). The trigger is a replace the
library cannot calculate: the glue discards it and restores the last calculated group from a JSON
copy. A module's `checkAttributes` is a `Map`
(`homag-intelligence/src/model/oc-scripts-domain.model.ts`). roomle-ui's `deepCopy` is
`JSON.parse(JSON.stringify(…))` (`common-core/src/utils/common-utils.ts`), so a copied or restored
group carries `checkAttributes` as a plain object. The glue logic copies groups in several places
(`_storeCalculatedGroup`, `_discardCalculation`, the article maps). The `.get` call is not in
roomle-ui's sources, so it is in the HOMAG library code that receives the module.

**To do.** roomle-ui: copy the restorable group with `structuredClone` instead of `deepCopy` in
`_storeCalculatedGroup`, `_addGroupToMap` and `_discardCalculation` (reproduced and verified
2026-10-03 — see the analysis).

**Test.** `glue-logic-test.ts`, `changeModuleAttribute`: "changes an attribute after the library
could not calculate the previous change" — the restored root keeps its `checkAttributes` `Map`, and
the next change succeeds.

**Latest run** (`mcp-test-2026-10-02_13-47-02`): gpt-6-astra 09 (the model recovered by deleting and rebuilding the groups).

## 17. A chat turn without an answer for 10 minutes

**Problem.** gpt-5-mini went silent after `get-authoring-rules` on the two largest prompts — the
kitchen of image 1 (twice) and the full walnut kitchen — and built nothing within 10 minutes. In the
chat window the user sees "assistant is working…" with no end.

**Cause.** The chat backend (`hi-mcp/hi-mcp-chat/chat-server.ts`):
- sets no reasoning effort for the Foundry deployments (provider default);
- has no turn timeout;
- streams nothing while the model reasons or writes a large tool call.

What the model did in those minutes is not logged.

**To do.**
- Log per step what the model produced (reasoning tokens, the size of the tool input) to find out
  where the time goes.
- Then set a reasoning effort for `gpt-5-mini` that keeps a large kitchen within a few minutes.
- End a turn after a time limit with a message to the user.

**Test.** A chat handler test for the turn limit. In "test the mcp", gpt-5-mini answers the image-1
kitchen and the full kitchen within 10 minutes.

**Latest runs** (`mcp-test-2026-10-02_13-47-02`): gpt-5-mini 06 (twice), 10.

**Latest runs** (`mcp-test-2026-10-02_17-25-40`): not shown — with the relations (RML-18038) gpt-5-mini answered 06 in 68 s and 10 in 54 s. The chat still has no turn limit and no progress, so the issue stays.

## 19. `above` a tall unit puts the unit on top of it, unreported

**Problem.** `hood above oven`, where the oven is the 2100 mm `HOTS2AB60` tower, became
`oven.LeftTop → hood.LeftBottom offset [0, 0, 0]`: the hood stands on the tower. Nothing reports it.

**Cause.** `hangGap` (`group-layout.ts`) is negative above a tall unit and is set to 0 silently.

**To do.** Report it: "hood stands on the tall unit oven - above hangs a unit above a floor
unit". A hood `above` a tall unit could instead hang `above` the next floor unit of the row — needs a
decision.

**Test.** `above` a tall unit is reported; `onTop` a tall unit is not.

**Latest run** (`mcp-test-2026-10-02_17-25-40`): gpt-5.4-mini 04.

## 21. Two units `above` one floor unit take the same place

**Problem.** A wall unit and the hood both `above` one base unit get the same entry on its `LeftTop`
with the same offset: the hood stands inside the wall unit.

**Cause.** The side correction (G8) separates units on side vectors only; the compile writes both
`above` entries as asked.

**To do.** The later unit `above` the same floor unit goes `rightOf` the earlier one, reported.

**Test.** Two units `above` one base unit: the second is `rightOf` the first.

**Latest run** (`mcp-test-2026-10-02_17-25-40`): gpt-5-mini 06, 10.

## 22. `place-group` resets the worktop and toe kick colours

**Problem.** After `mod_CountertopColor` 224 and `mod_ToekickColor` 224, `place-group` reloaded the
group; the worktop ends with 380 and the toe kick with 326 (`order-data.json`). Nothing reports it.
In 07–10 the model set the colour again after each reload.

**Cause.** `repositionedGroup` (`tool-executors.ts`) reloads the group without its generated roots
(C1), and the library regenerates them with the default colours.

**To do.** Keep the attributes of the generated roots over the reload — read them before and set
them again after it, or keep the generated roots in the reload — and say so.

**Test.** `place-group` on a group whose worktop carries `mod_CountertopColor` keeps the colour.

**Latest run** (`mcp-test-2026-10-02_17-25-40`): gpt-6-astra 06.

## 23. A worktop colour change drops hanging wall units onto the worktop

**Problem.** Replaying gpt-5-mini 10: the wall units and the hood stand at y 1480 after the load and
after `change-group-attribute mod_FrontColor`, and at y 820 after `mod_CountertopColor`. A group of
one base unit and one wall unit keeps y 1480 after the same command, with the relation and with the
same docking written as `contextData`. gpt-6-astra 10 lost the wall units above the sink the same
way and deleted them.

**Cause.** Not found. The worktop regeneration of `mod_CountertopColor` is the likely trigger; the
planner stores the reciprocal of a docking entry without its offset
(`hi-root-module-arrangement.ts:684-692`).

**To do.** Reproduce in roomle-ui with the payload of gpt-5-mini 10 (`run.json`, second
`create-or-replace-groups`), find where the offset is lost, fix it there.

**Test.** A glue-logic test: a group with a wall unit hung by an offset keeps its height after a
worktop colour change.

**Latest run** (`mcp-test-2026-10-02_17-25-40`): gpt-5-mini 10, gpt-6-astra 10.

## 24. A second create with the agent's own group id builds a duplicate group

**Problem.** Both calls sent `"id": "kitchen1"` with a placement; the planner had regenerated the id,
so the second call built a second kitchen on the same spot, unreported.

**Cause.** The description says a group whose id matches an existing group replaces it; the model
reused its own id, not the regenerated one.

**To do.** Resolve an id the server regenerated earlier in the session to that group, or report a new
group that stands on an existing one — report only, never refuse.

**Test.** A second create with the same agent id reports the existing group.

**Latest run** (`mcp-test-2026-10-02_17-25-40`): gpt-5.4-mini 10.

## 25. `dockTo` written on the roots of `create-or-replace-groups`

**Problem.** The model skipped `get-authoring-rules` and docked each root with `dockTo` (the field of
`merge-article-into-group`); the server ignored it (G27) and chained the roots (G7).

**Cause.** The chat passes no server instructions; `dockTo` is the only typed docking field among the
tools.

**To do.** Read `dockTo` `RightBottom → LeftBottom` as `rightOf` (and the mirror as `leftOf`) and
report it.

**Test.** A root with `dockTo` compiles like the matching relation, reported.

**Latest run** (`mcp-test-2026-10-02_17-25-40`): gpt-5.4-mini 02.

## 26. One unknown article id rejects the whole group

**Problem.** `w2` `OTB90` returned "Invalid pos groups - nothing was loaded"; the eight valid roots
were not built either. The model fixed the id on its next call.

**Cause.** G15 fails the whole group for one unknown article id.

**To do.** Build the group without that root and report it in `notLoaded` with the valid ids
([guideline step 4](../../AGENTS.md#guards-are-a-last-resort)).

**Test.** A group with one unknown article loads the other roots and reports the unknown one.

**Latest run** (`mcp-test-2026-10-02_17-25-40`): gpt-5-mini 10.

## 27. A new group without a placement, moved with `place-group` right after

**Problem.** For a centred or offset row the model sent no placement and called `place-group`
(`alignment` center, `offsetMm`) right after; the reload exposes the group to issues 22 and 23.

**Cause.** The rules make a centred row a computation (example 4); `place-group` takes alignment and
offset. `placement { wall, alignment, offsetMm }` is deferred (D23).

**To do.** Decide D23: a placement by wall, alignment and offset in `create-or-replace-groups`.

**Test.** A centred row is placed in one call.

**Latest run** (`mcp-test-2026-10-02_17-25-40`): gpt-6-astra 01, 02, 09.

## 28. `place-group` on a group that already stands where asked reloads it

**Problem.** After resubmitting a corner group, the model called `place-group` for the same corner;
the server reloaded the group anyway (and reset the worktop colour, issue 22).

**To do.** Skip the reload when the computed position equals the group's position, and say so.

**Test.** `place-group` to the group's own position makes no load call.

**Latest run** (`mcp-test-2026-10-02_17-25-40`): gpt-6-astra 07, 10.
