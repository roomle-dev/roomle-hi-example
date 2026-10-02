# Backlog: remaining issues of "test the mcp" on 2026-10-02 07:45

> **Type**: Backlog items (analysed, not implemented)
> **Domain**: hi-mcp — `create-or-replace-groups`, `merge-article-into-group`, the command tools (`hi-mcp/hi-mcp-poc-json/tool-executors.ts`, `group-placement.ts`); one roomle-ui defect
> **Origin**: the report `.temp/result/mcp-test-2026-10-02_07-45-57/report.md` (local, not in git) of the suite run with gpt-5.4-mini on `3f688c3` (RML-18033, branch `docs/guards-as-last-resort`) — 6 pass, 4 partial, 3 fail
> **Date**: 2026-10-02
> **Status**: Open
> **Code read**: `3e68df4`

Each item gives the run and its evidence, the cause in the code, and the to-do with its test. The
guideline for every server item is
[Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort): correct where the intent is
clear, report what was corrected, and never drop the agent's content silently.

## Overview

| # | Issue | Kind | Runs | Priority |
|---|---|---|---|---|
| 1 | [A taken side is re-targeted to the far end of the row](#1-a-taken-side-is-re-targeted-to-the-far-end-of-the-row) | bug, MCP server | 07 | high — a unit behind the wall |
| 2 | [An on-top docking is counted as a side neighbour](#2-an-on-top-docking-is-counted-as-a-side-neighbour) | bug, MCP server | 06 | high — a wall cabinet on the floor |
| 3 | [A docking ring anchors the wrong root](#3-a-docking-ring-anchors-the-wrong-root) | bug, MCP server | 02, 05 | high — a row through the wall |
| 4 | [The side correction walks through a corner article](#4-the-side-correction-walks-through-a-corner-article) | hardening | 03 | medium |
| 5 | [An undockable unit discards its group](#5-an-undockable-unit-discards-its-group) | hardening | 04 | medium |
| 6 | [Docking to a vector the article does not have](#6-docking-to-a-vector-the-article-does-not-have) | hardening | 05 | medium |
| 7 | [Root module ids are passed on unresolved](#7-root-module-ids-are-passed-on-unresolved) | hardening | 10 | medium |
| 8 | [Attribute overrides the module does not carry have no effect](#8-attribute-overrides-the-module-does-not-carry-have-no-effect) | hardening | 06 | medium |
| 9 | [A wall unit on a base unit without a gap](#9-a-wall-unit-on-a-base-unit-without-a-gap) | hardening, needs a decision | 06 | low |
| 10 | [A merged group reaches into the back wall](#10-a-merged-group-reaches-into-the-back-wall) | bug, roomle-ui (known, open) | 12 | — |

Items 1–3 are wrong results of the server's own corrections or placement. They come first.

## 1. A taken side is re-targeted to the far end of the row

**Run 07** ("add a cabinet with drawers to the right of the kitchen").
- The model called `merge-article-into-group` on the rightmost of three tall units with its
  `LeftBottom`, which the neighbour already takes. The unit's `RightBottom` was free: it is itself
  the free end of the row.
- The server walked along `LeftBottom` to the far end of the row, in the corner, and docked the
  drawer cabinet there.
- The group origin moved to z −4375 (the back wall is at −3765), and the cabinet stands behind the
  wall.
- Correction reported: "the LeftBottom of root '586…' is taken - the unit was docked to the
  LeftBottom of '8c82…', the free end of that row".

**Cause.** `dockTarget` (`tool-executors.ts:204`) knows one direction only: `rowEnd(partners, root,
vector)` (`:551`) walks in the direction of the taken vector. Decision 4 says "the free end of that
row", and the row has two ends.

**To do.**
- When the named root's opposite side vector is free, the root is itself an end of the row. Dock
  there, and report "the LeftBottom of root … is taken - the unit was docked to its free
  RightBottom".
- Otherwise walk in the named direction as today.
- Apply the same rule in `separateSideVectorPartners` (`:652`).

**Test.** The run-07 shape — a row of three, `merge-article-into-group` on the last root's taken
`LeftBottom` — docks to that root's `RightBottom`. A middle root with both sides taken still goes to
the end in the named direction.

## 2. An on-top docking is counted as a side neighbour

**Run 06** (full kitchen around the corner).
- `wall1` sits on top of the corner cabinet (`corner1.LeftTop → wall1.LeftBottom`), and `wall2` is
  docked beside `wall1` on its `LeftBottom`.
- The side vector correction reported "roots 'corner1', 'wall2' were docked to the LeftBottom of
  root 'wall1' at the same place". It moved `wall2` along the floor row to the `LeftBottom` of the
  fridge.
- `wall2` (a wall cabinet) stands on the floor at [−261, 0, 2461] (`order-data.json`, perspective
  image).

**Cause.**
- `sidePartnersOf` (`tool-executors.ts:490`) records a partner on a root's side vector whenever
  *that* vector is `LeftBottom`/`RightBottom`, whatever the other end is. The entry
  `corner1.LeftTop → wall1.LeftBottom` puts `corner1` on `wall1`'s `LeftBottom`, although it is a
  carrier below, not a neighbour beside.
- The rejection this correction replaced (`sideVectorErrors`) had the same false conflict.
- `rowEnd` then follows the carrier link down into the floor row.

**To do.**
- Count a pairing as side neighbours only when both vectors are side vectors (`LeftBottom` ↔
  `RightBottom`). An on-top pairing (`*Top` ↔ `*Bottom`) is no neighbour.
- `rowEnd` follows side pairings only, so a walk never changes level.
- Check `dockTarget` with the reciprocal entries that `get-plan-context` returns.

**Test.** The run-06 shape (a wall unit on a base unit, a second wall unit beside the first) loads
unchanged with no correction. Two wall units beside each other on one side vector are still
separated.

## 3. A docking ring anchors the wrong root

**Run 02** ("add a group of 4 cabinets to the wall in the back").
- The model docked cab1 → cab2 → cab3 → cab4 along `RightBottom`, and also cab4 on cab1's
  `LeftBottom`, which closes the row into a ring.
- The placement was right: the back wall's end, `[-685, 0, -3765]` / 0.
- The planner arranged cab4 left of cab1 (items at −600, 0, 600, 1200), but the server sent
  `rootId` cab2. cab1 and cab4 stand 1200 mm through the left wall.
- No correction was reported.

**Run 05** shows the same ring: the oven on the corner's left arm and right of the fridge. There the
planner's choice happened to be harmless.

**Cause.**
- `findAnchorRoot` (`group-placement.ts:87`) walks left through `dockingRelations` (`:46`), whose
  maps keep one partner per root (the last entry wins). On a ring it stops wherever it meets a
  visited root.
- The planner arranges breadth-first from the first root, so the first entry that reaches a root
  places it.
- Server and planner disagree, and the anchor is not the leftmost unit.

**To do.**
- Break a ring in `completeDocking` (`tool-executors.ts:779`). In the planner's order (breadth-first
  from the first root), the side entry that reaches an already reached root is dropped and reported:
  "the docking of 'cab4' on the LeftBottom of 'cab1' closes a ring - dropped".
- Then the anchor walk and the planner agree.

**Test.** The run-02 shape loads cab1–cab4 as one row with the ring entry dropped; the anchor is the
row's left end (cab1); the correction is reported.

## 4. The side correction walks through a corner article

**Run 03** (kitchen in the back right corner).
- `b1` stands on the corner's left arm (back wall); the model docked `b2` to `b1`'s `RightBottom`,
  which faces the corner.
- The correction walked along `RightBottom` through the corner article onto the right arm and docked
  `b2` at the end of the right wall.
- The model meant `b2` on the back wall: `b1`'s `LeftBottom` was free.

**Cause.** `rowEnd` follows the same vector name through a corner article. A corner article ends a
leg: its `LeftBottom` and `RightBottom` arms run along different walls.

**To do.** The walk stops at a corner article. If the named direction runs into one, the unit goes
to the free end of the root's own leg, the other direction. This applies to both
`separateSideVectorPartners` and `dockTarget`. Item 1's rule — the named root's own free side first
— covers most cases.

**Test.** The run-03 shape docks `b2` to `b1`'s `LeftBottom`, on the back wall.

## 5. An undockable unit discards its group

> **Premise corrected (2026-10-02)**: the range hood is not undockable — calculated, it has
> `LeftBottom`, `RightBottom`, `LeftTop` and `RightTop`, and docked beside a wall cabinet it lands
> exactly right. Only its catalog entry lacks vectors and a size on an empty plan. See
> [range-hood-placed-half-a-width-off.md](../bug-analysis/range-hood-placed-half-a-width-off.md):
> `isUndockable` is the bug, and the to-do below changes to "remove the heuristic".

**Run 04** (oven, range hood, sink, fridge).
- First call: the hood (`DU`, no docking vectors, no size) was undocked. `connectUnreachedRoots`
  (`tool-executors.ts:692`) cannot dock it (`isUndockable`, `:635`), so the guard stays and the
  group — the only one of the call — goes to `notLoaded`. Nothing was built.
- Second call: the model docked the hood on the oven tall unit's `LeftTop`, and it floats at
  2800 mm, through the ceiling.

**Cause.** Partial loading works per group (decision 5), so one unit that cannot be docked fails the
whole kitchen. The rules tell the agent to give a hood its own group with a placement; the server
does not do that itself.

**To do.**
- A root that cannot be docked is taken out of its group and loaded as a group of its own without a
  placement. The planner positions it (decision 1). Reported: "root 'hood' cannot be docked - it is
  a group of its own; place it with place-group".
- The same for a docking entry that names an undockable root — the run-04 second call: the entry is
  dropped and the root becomes its own group.

**Test.** The run-04 first call loads fridge, oven and sink, and the hood as a group of its own,
with the correction.

## 6. Docking to a vector the article does not have

**Run 05.**
- The model docked the sink `BackBottom → BackBottom` to the corner article. The corner article has
  no `BackBottom`; its vectors are `Left/RightBack*`, `Left*` and `Right*` (`plan-context.json`).
- The planner put the sink at the corner's origin, inside the corner cabinet, without an error.

**Cause.** `create-or-replace-groups` does not check `ownDockingVector` or `dockingVector` against
the article's vectors. On an empty plan the catalog has none (backlog
[article template geometry](roomle-ui-article-template-geometry.md)). For a corner article the
server has calculated it in the corner probe, but it keeps only the corner frame.

**To do.**
- Check the vectors of an entry where they are known: the catalog's `dockingVectors` (articles
  already in the plan), and the probe's `dockInfos` (corner articles — keep the vector names
  alongside the corner frame).
- A vector the article does not have is replaced by the nearest valid one if the intent is clear.
  `BackBottom` on a corner article means behind it, and a corner article has no behind, so the entry
  is dropped, the root is docked like an undocked root (G7), and both are reported.

**Test.** The run-05 shape with the corner's vectors known: the sink entry is dropped and reported,
and the sink is docked to a free row end, not inside the corner.

## 7. Root module ids are passed on unresolved

**Run 10** ("make the first unit 900 mm wide").
- The model chose the right tool, `change-module-attribute` with `mod_Width` 900. It mistyped the
  root id, though: `cc3900c2-b9cc-4d05-b863-…` for `…-b9c4-…`, a segment of the group id mixed in.
- The planner answered "not found", and the model gave up and asked the user.

**Cause.** `findGroup` (`tool-executors.ts:246`) resolves group ids by a unique prefix (C4). The
root ids of `change-module-attribute` (`:1660`), `delete-root-module` (`:1694`),
`exchange-root-module` (`:1734`) and `dockTo.rootId` of `merge-article-into-group` (`:1701`) go to
the planner as sent.

**To do.**
- Resolve root ids against the plan's roots: the exact id, else a unique prefix — the first UUID
  segment is enough, `cc3900c2` was unique.
- Report the resolution as a correction; an id that matches nothing or more than one root stays the
  planner's error, with the root ids of the group added.

**Test.** `change-module-attribute` with the run-10 id resolves to the root and reports it; an
ambiguous prefix fails with the candidates.

## 8. Attribute overrides the module does not carry have no effect

**Run 06.**
- The model set the colours as attribute overrides of single roots, instead of
  `change-group-attribute`: `mod_FrontColor` 215 on four of seven units, and `mod_CountertopColor`
  324 on the base units.
- The worktop stayed 380: `mod_CountertopColor` belongs to the generated worktop root
  (`mr_Countertop`), not to the base units
  ([worktop colour analysis](../bug-analysis/worktop-colour-not-discoverable.md)). Nothing reported
  it.

**Cause.** `create-or-replace-groups` passes attribute overrides on unchecked. The library ignores an
attribute the module does not carry. The planner reports this for `change-module-attribute`
(P2), but not for a load.

**To do.**
- Check the overrides against the master data of the root's module (`masterData` — the module's
  attribute ids).
- An attribute the group's generated roots carry (the worktop colour) is applied to the group with
  a group attribute change after the load. Any other attribute the module does not carry is
  reported.
- Optional, needs a decision: an attribute set on some units of a new group but not on others of
  the same module type — the walnut fronts — could be offered as a kitchen-wide change.

**Test.** The run-06 overrides: `mod_CountertopColor` reaches the worktop and is reported; an
override of an attribute nobody carries is reported.

## 9. A wall unit on a base unit without a gap

**Run 06.** `wall1` is docked `LeftTop → LeftBottom` on the corner cabinet without an `offset`, so
the wall cabinet sits directly on the worktop at 820 mm. The rules ask for `offset [0, <gap>, 0]`.

**Cause.** The server takes the docking as sent. Which gap is right depends on the kitchen. The
model also set `mod_WallHeightLines` = `WallCabinets`, which suggests the library has height lines
for wall cabinets. It is unknown whether they could position the unit.

**To do.**
- Investigate first: what `mod_WallHeightLines` does in Furniture_Smith, and whether the library
  places wall cabinets at a height line by itself.
- Then decide: the server adds the library's (or a fixed) gap to a wall unit — catalog category
  "Wall Units" — docked on a floor unit with no `y` offset, and reports it; or the rule stays and
  the case is reported only.

## 10. A merged group reaches into the back wall

**Run 12** (join groups). After `delete-root-module` and `merge-groups`, the merged group stands at
z −3885 — 120 mm into the back wall. Known and open:
[merged-group-toe-kick-reaches-into-the-wall.md](../bug-analysis/merged-group-toe-kick-reaches-into-the-wall.md)
(roomle-ui). No MCP server change.

## Model findings without a server to-do

- **Run 06**: the oven and the hood were never sent, though the prompt asks for them.
- **Runs 04, 06, 07**: the answers claim units, colours or positions the plan does not have. The
  verify rule ("Verify results numerically") exists; the chat's system prompt does not repeat it.
  Revisit if this keeps showing up.
