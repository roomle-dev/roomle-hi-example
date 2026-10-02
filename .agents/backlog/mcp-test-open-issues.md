# Open issues of the MCP test

> **Type**: Backlog — what is to be done after the analyses of "test the mcp"
> **Domain**: hi-mcp — `create-or-replace-groups`, `merge-article-into-group`, the command tools
> (`hi-mcp/hi-mcp-poc-json/tool-executors.ts`, `group-placement.ts`), the served rules
> (`hi-mcp-server.ts`), the chat (`hi-mcp/hi-mcp-chat`); one roomle-ui defect
> **Maintained by**: step 7 of [the testing skill](../skills/hi-mcp-testing.md#7-open-issues)

Each issue names the problem, the test prompt that shows it, the cause in the code, the to-do and
its test. An issue leaves this list when its fix is in the code. The guideline for every server
issue is [Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort): correct where the
intent is clear, report what was corrected, and never drop the agent's content silently.

## Overview

| # | Issue | Kind | Test prompt | Priority |
|---|---|---|---|---|
| 1 | [A taken side is re-targeted to the far end of the row](#1-a-taken-side-is-re-targeted-to-the-far-end-of-the-row) | bug, MCP server | add one unit; image: kitchen in the back right corner | high — a unit behind the wall, a row through the wall |
| 2 | [An on-top docking is counted as a side neighbour](#2-an-on-top-docking-is-counted-as-a-side-neighbour) | bug, MCP server | full kitchen around the corner | high — a wall cabinet on the floor |
| 3 | [A docking ring anchors the wrong root](#3-a-docking-ring-anchors-the-wrong-root) | bug, MCP server | four cabinets on the back wall; oven, fridge, sink in the corner | high — a row through the wall |
| 4 | [The side correction walks through a corner article](#4-the-side-correction-walks-through-a-corner-article) | hardening | kitchen in the back right corner | medium |
| 5 | [A range hood without wall units has no docking recipe](#5-a-range-hood-without-wall-units-has-no-docking-recipe) | bug, rules | oven, range hood, sink, fridge; full kitchen around the corner | high — a hood on the floor or on the worktop |
| 6 | [A material for the whole kitchen is not applied](#6-a-material-for-the-whole-kitchen-is-not-applied) | bug, MCP server | full kitchen around the corner; image: kitchen on the left-hand wall | high — the requested material is missing |
| 7 | [Docking to a vector the article does not have](#7-docking-to-a-vector-the-article-does-not-have) | hardening | oven, fridge, sink in the corner | medium |
| 8 | [Root module ids are passed on unresolved](#8-root-module-ids-are-passed-on-unresolved) | hardening | change one unit | medium |
| 9 | [Answers claim what the plan does not have](#9-answers-claim-what-the-plan-does-not-have) | hardening, chat | most prompts with a wrong result (8 of 17 runs on 2026-10-02 12:45) | medium |
| 10 | [A wall unit stands on the worktop instead of hanging on the wall](#10-a-wall-unit-stands-on-the-worktop-instead-of-hanging-on-the-wall) | bug, MCP server | full kitchen around the corner | high — a wall cabinet on the worktop |
| 11 | [A merged group reaches into the back wall](#11-a-merged-group-reaches-into-the-back-wall) | bug, roomle-ui | join groups | — |
| 12 | [The door opening is listed as a wall](#12-the-door-opening-is-listed-as-a-wall) | hardening | image: planning on the right-hand wall | medium |
| 13 | [Undocked wall units reject the whole group](#13-undocked-wall-units-reject-the-whole-group) | hardening | full kitchen around the corner | medium — the retry loses content |
| 14 | [A floor unit is docked onto a top vector](#14-a-floor-unit-is-docked-onto-a-top-vector) | hardening | image: kitchen on the left-hand wall | medium |

Issues 1–3 are wrong results of the server's own corrections or placement; issues 5, 6 and 10 are
requests the tool API makes the agent get wrong. They come first.

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

## 2. An on-top docking is counted as a side neighbour

**Problem.** `wall1` sits on top of a base unit (`base.LeftTop → wall1.LeftBottom`), and `wall2` is
docked beside `wall1` on its `LeftBottom`. The side vector correction reports two roots on `wall1`'s
`LeftBottom` at the same place and moves `wall2` along the floor row: a wall cabinet on the floor.

**Cause.**
- `sidePartnersOf` (`tool-executors.ts`) records a partner on a root's side vector whenever *that*
  vector is `LeftBottom`/`RightBottom`, whatever the other end is. The entry `base.LeftTop →
  wall1.LeftBottom` puts `base` on `wall1`'s `LeftBottom`, although it is a carrier below, not a
  neighbour beside.
- `rowEnd` then follows the carrier link down into the floor row.

**To do.**
- Count a pairing as side neighbours only when both vectors are side vectors (`LeftBottom` ↔
  `RightBottom`). An on-top pairing (`*Top` ↔ `*Bottom`) is no neighbour.
- `rowEnd` follows side pairings only, so a walk never changes level.
- Check `dockTarget` with the reciprocal entries that `get-plan-context` returns.

**Test.** A wall unit on a base unit with a second wall unit beside the first loads unchanged with
no correction. Two wall units beside each other on one side vector are still separated.

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

## 11. A merged group reaches into the back wall

**Problem.** After `delete-root-module` and `merge-groups`, the merged group's toe kick reaches
120 mm into the back wall: the group's footprint starts at x −120 before the unit in the corner.

**Cause and to-do.** roomle-ui:
[merged-group-toe-kick-reaches-into-the-wall.md](../bug-analysis/merged-group-toe-kick-reaches-into-the-wall.md).
No MCP server change.

**Latest run** (`mcp-test-2026-10-02_12-45-24`): 16 — footprint 1920 mm for two units spanning 1800 mm.

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
