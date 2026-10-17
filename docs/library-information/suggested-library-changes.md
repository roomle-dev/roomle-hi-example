# Suggested library changes

> **Type**: Living reference — every change suggested for the library data so the agent plans right,
> applied in the library or not
> **Domain**: the library data the plan context passes on — the article list and the master data,
> and in them the `desc` properties
> **Source**: the issues of [`.agents/backlog/library-issues.md`](../../.agents/backlog/library-issues.md)

The MCP server is library-neutral ([§2.4](../hi-mcp-behaviour.md#24-instructions)): what the agent
knows of a library comes only from the library data. When the agent plans wrong because that data
lacks information, the fix is in the library. This document collects the concrete changes to propose
to the library development team — the exact text to add to or change in the `desc` of the affected
articles and attributes.

Each change names the library, the affected articles or attributes, the problem, the proposed `desc`
change, the ticket and its status. The document keeps every suggested change, applied in the library
or not: the status says which, and an applied change stays as the record of the text the library got.

## Overview

| # | Change | Library | Articles or attributes | Status | Ticket |
|---|---|---|---|---|---|
| 1 | [The sink unit descriptions do not say that a sink unit needs an article on its right](#1-the-sink-unit-descriptions-do-not-say-that-a-sink-unit-needs-an-article-on-its-right) | HOMAG Furniture_Smith | `SUB2A90`, `SUBA60`, `SUT60`, `ESUB2A90`, `ESUT60` | applied in the library | RML-18124 |
| 2 | [The door direction and handle position descriptions do not say which side a door opens to](#2-the-door-direction-and-handle-position-descriptions-do-not-say-which-side-a-door-opens-to) | HOMAG Furniture_Smith | `mod_DoorDirectionSelection`, `mod_HandlePosType` | applied in the library | RML-18203 |
| 3 | [The articles with two doors do not say how their doors stand](#3-the-articles-with-two-doors-do-not-say-how-their-doors-stand) | HOMAG Furniture_Smith | `H2TB60`, `HWR_HB600T2`, `U2TB90`, `O2TB90`, `US2TB90`, `EU2TB90`; `mod_DoorDirectionSelection`, `mod_HandlePosType` | not reported | RML-18203 |
| 4 | [The sink unit descriptions do not say how far the sink reaches over the unit on its right](#4-the-sink-unit-descriptions-do-not-say-how-far-the-sink-reaches-over-the-unit-on-its-right) | HOMAG Furniture_Smith | `SUT60`, `SUBA60`, `SUB2A90`, `ESUT60`, `ESUB2A90`; `mod_SinkId` | not reported | — |
| 5 | [The handle design No handle does not say that handleless fronts are articles of their own](#5-the-handle-design-no-handle-does-not-say-that-handleless-fronts-are-articles-of-their-own) | HOMAG Furniture_Smith | `mod_HandleDesign` | not reported | — |
| 6 | [The flap wall cabinets do not say which sizes their flap fitting takes](#6-the-flap-wall-cabinets-do-not-say-which-sizes-their-flap-fitting-takes) | HOMAG Furniture_Smith | `OSKB60`, `OSKB90`, `OFKB60`, `OFKB90` | not reported | — |
| 7 | [The colour values do not say whether they are a plain, a wood or a stone decor](#7-the-colour-values-do-not-say-whether-they-are-a-plain-a-wood-or-a-stone-decor) | HOMAG Furniture_Smith | the colour values of `mod_FrontColor`, `mod_CarcaseColor`, `mod_UprightColor` and the other colour attributes | not reported | — |
| 8 | [The upright colour does not say which upright program it needs](#8-the-upright-colour-does-not-say-which-upright-program-it-needs) | HOMAG Furniture_Smith | `mod_UprightColor`, `mod_UprightProgram` | not reported | — |
| 9 | [The carcase colours do not say which colour the visible sides take](#9-the-carcase-colours-do-not-say-which-colour-the-visible-sides-take) | HOMAG Furniture_Smith | `mod_CarcaseColor`, `mod_CarcaseOutsideColor` | not reported | — |
| 10 | [The front program Modern does not say which fronts it builds](#10-the-front-program-modern-does-not-say-which-fronts-it-builds) | HOMAG Furniture_Smith | `mod_FrontProgram`; `OSKB60`, `OSKB90`, `OFKB60`, `OFKB90` | not reported | — |

## Which open library issues the descriptions solve

The issues of [`library-issues.md`](../../.agents/backlog/library-issues.md), checked against the
library data of this folder (`article.json`, `master-data.json`) and the stored test runs of
2026-10-16 and 2026-10-17 (`.temp/result/`). A description solves an issue when, with it, the agent
builds at the first attempt what it wants, without a call the library cannot calculate.

A description reaches the agent only where the plan context serves it: the `FUNCTION` and
`AI_SELECTION_HINT` lines of an article (D63 of [`docs/hi-mcp-behaviour.md`](../hi-mcp-behaviour.md)),
and the attribute vocabulary — the attributes with `isMain` or `userRight` `Simple`, with the name and
desc of every value (D76). The desc of any other attribute — `mod_CarcaseProgram`,
`mod_CarcaseOutsideProgram`, `mod_FingergripType` — reaches the agent only in a correction sentence.

| Issue | Solved by descriptions | Change | What the descriptions leave to the library |
|---|---|---|---|
| [60](../../.agents/backlog/library-issues.md#60-the-sink-top-of-a-sink-unit-reaches-past-the-row-or-over-the-hob) sink top over the row end or the hob | yes | 1 (applied), 4 | nothing; the geometry is intended |
| [61](../../.agents/backlog/library-issues.md#61-handleless-fronts-done-with-a-handle-attribute) handleless fronts | yes | 5 | nothing |
| [64](../../.agents/backlog/library-issues.md#64-flip-lift-wall-cabinets-with-sizes-the-library-cannot-calculate) flip-lift sizes | yes, once the library names the sizes | 6 | the size ranges of `tab_FlipliftSettings` for the text |
| [69](../../.agents/backlog/library-issues.md#69-end-panels-with-a-plain-upright-colour-the-library-cannot-calculate) end panels in a plain colour | yes | 7, 8 | optional: switching `mod_UprightProgram` with the colour spares the agent the second attribute |
| [70](../../.agents/backlog/library-issues.md#70-carcase-side-panels-with-a-plain-outside-colour-the-library-cannot-calculate) visible sides in a plain colour | partly: the agent builds the units with a wood or stone outside colour | 7, 9 | plain visible sides on a wood or stone carcase: switching the outside program with the outside colour |
| [71](../../.agents/backlog/library-issues.md#71-folding-flap-wall-cabinets-with-glass-fronts-the-library-cannot-calculate) glass flaps | partly: the agent builds glass wall cabinets with doors | 7, 10 | glass flaps and glass drawer fronts, if the library wants them |
| [76](../../.agents/backlog/library-issues.md#76-articles-with-two-doors-that-do-not-say-how-their-doors-stand) two doors | yes | 2 (applied), 3 | `LeftLeft` and `RightRight`, if the library offers them |

Two findings beyond the backlog: the end panels of issue 69 include the wall-unit side panel `W35O`
(change 8), and the front program Modern fails on drawers and pull-outs as on flaps (change 10).

## 1. The sink unit descriptions do not say that a sink unit needs an article on its right

**Library.** HOMAG Furniture_Smith.

**Articles.** `SUB2A90` (SBF2P90), `SUBA60` (SBFP60), `SUT60` (SBD60), and their handleless
variants `ESUB2A90` (FSBF2P90) and `ESUT60` (FSBD60).

**Ticket.** RML-18124. Backlog item 60 of
[`.agents/backlog/library-issues.md`](../../.agents/backlog/library-issues.md).

**Status.** Applied in the library: the `FUNCTION` and `AI_SELECTION_HINT` lines of the five sink
units carry the proposed text. Backlog item 60 keeps what is still open — the width of the sink with
its drainer, and that no hob stands immediately to the right of a sink unit.

**Problem.** A sink unit needs another article on its right. The agent does not know this and places
the sink unit without a neighbour, so the sink top with its drainer reaches past the end of the row,
into the air, or over the hob unit beside it.

The reason is the geometry: the sink of `SUT60` carries its drainer and is 980 mm wide on the
600 mm unit. Placed as the last unit of a row, the drainer reaches 396 mm past the end of the row.
`SUBA60` has the same geometry — its 600 mm unit spans 995.75 mm along the row in the Open-Plan
Room, including its sink geometry.

Nothing in the library data tells the agent this. The fix belongs in the `desc` of the sink units,
never in a served rule.

The handleless variants `ESUB2A90` and `ESUT60` carry the same sink geometry and the same missing
statement: their descriptions name a handleless sink base unit and its fronts, and say nothing about
the sink width, the drainer side or the article that belongs on their right.

**The descriptions before the change.** None of the articles states that another article belongs on the
sink unit's right, and none states the sink/drainer width or the side the drainer reaches over. The
three handled units share the same `REQUIREMENTS`, `RECOMMENDED_NEIGHBOURS` and `RESTRICTIONS`
sections; the two handleless units share their own.

| Article | Label | `FUNCTION` | `AI_SELECTION_HINT` |
|---|---|---|---|
| `SUB2A90` | SBF2P90 | Sink base unit, 90 cm wide, with 1 fixed front and 2 pull-outs. | Select for a wide sink cabinet with additional pull-out storage. |
| `SUBA60` | SBFP60 | Sink base unit, 60 cm wide, with 1 fixed front and 1 pull-out. | Select for a sink cabinet that also offers a storage pull-out. |
| `SUT60` | SBD60 | Sink base unit, 60 cm wide, with 1 hinged door. | Select when the user requests a sink or washing area. |
| `ESUB2A90` | FSBF2P90 | Handleless sink base unit, 90 cm wide, with 1 fixed front and 2 drawers (fingergrip). | Select for a wide handleless sink cabinet with drawers. |
| `ESUT60` | FSBD60 | Handleless sink base unit, 60 cm wide, with 1 door (fingergrip). | Select for a sink in a handleless kitchen with a single door. |

Shared sections of the three handled units:

- `REQUIREMENTS`: Requires a compatible sink, water supply and waste-water connection. base unit:
  carcase height 720 mm, depth 561 mm, plinth height 20-200 mm.
- `RECOMMENDED_NEIGHBOURS`: Dishwasher unit, drawer base units, worktop elements.
- `RESTRICTIONS`: Cannot house an oven; not suitable for islands without plumbing.

Shared sections of the two handleless units:

- `REQUIREMENTS`: Requires a compatible sink, water supply and waste-water connection. base unit:
  carcase height 720 mm, depth 561 mm, plinth height 20-200 mm.
- `RECOMMENDED_NEIGHBOURS`: Handleless dishwasher unit, handleless drawer base units.
- `RESTRICTIONS`: Cannot house an oven; not for islands without plumbing.

`RECOMMENDED_NEIGHBOURS` names neighbours as *recommendations*, not as a requirement, and it does
not say the neighbour belongs on the right.

**Where the change belongs.** The agent sees a shortened description by default: `get-plan-context`
serves only the `FUNCTION` and `AI_SELECTION_HINT` lines of a sectioned description (D63 of
[`docs/hi-mcp-behaviour.md`](../hi-mcp-behaviour.md)). The other sections are served only when the
agent explicitly requests the `articleDescriptions` section.

So the right-neighbour requirement must go into `FUNCTION` or `AI_SELECTION_HINT` to reach the
agent at the moment it picks the article. Any fuller detail — the sink width, the drainer side —
belongs in the other sections.

**Proposed `desc` changes.** The changed lines are `FUNCTION` and `AI_SELECTION_HINT`; the other
sections are unchanged and shown for completeness. Each description stays below the 1000-character
limit.

`SUB2A90` (SBF2P90):

```
FUNCTION: Sink base unit, 90 cm wide, with 1 fixed front and 2 pull-outs. A base unit belongs on its right, because the sink with its drainer is wider than the unit.
PURPOSE: Wide sink cabinet combining plumbing access with two storage pull-outs.
TYPICAL_PLACEMENT: Base row, within the washing zone.
REQUIREMENTS: Requires a compatible sink, water supply and waste-water connection. base unit: carcase height 720 mm, depth 561 mm, plinth height 20-200 mm.
RECOMMENDED_NEIGHBOURS: Dishwasher unit, drawer base units, worktop elements.
RESTRICTIONS: Cannot house an oven; not suitable for islands without plumbing.
STYLE_COMPATIBILITY: Modern handled kitchen. Also suits classic, Scandinavian and country-house designs.
SEARCH_KEYWORDS: sink cabinet, wide sink base unit, sink pull-out cabinet, plumbing cabinet.
AI_SELECTION_HINT: Select for a wide sink cabinet with additional pull-out storage. Place a base unit on its right.
```

`SUBA60` (SBFP60):

```
FUNCTION: Sink base unit, 60 cm wide, with 1 fixed front and 1 pull-out. A base unit belongs on its right, because the sink with its drainer is wider than the unit.
PURPOSE: Supports a sink while offering a lower pull-out for storage.
TYPICAL_PLACEMENT: Base row, within the washing zone.
REQUIREMENTS: Requires a compatible sink, water supply and waste-water connection. base unit: carcase height 720 mm, depth 561 mm, plinth height 20-200 mm.
RECOMMENDED_NEIGHBOURS: Dishwasher unit, drawer base units, worktop elements.
RESTRICTIONS: Cannot house an oven; not suitable for islands without plumbing.
STYLE_COMPATIBILITY: Modern handled kitchen. Also suits classic, Scandinavian and country-house designs.
SEARCH_KEYWORDS: sink cabinet, sink base unit, pull-out sink unit, plumbing cabinet.
AI_SELECTION_HINT: Select for a sink cabinet that also offers a storage pull-out. Place a base unit on its right.
```

`SUT60` (SBD60):

```
FUNCTION: Sink base unit, 60 cm wide, with 1 hinged door. A base unit belongs on its right, because the sink with its drainer is wider than the unit.
PURPOSE: Supports a kitchen sink and gives access to the plumbing below.
TYPICAL_PLACEMENT: Base row, within the washing zone.
REQUIREMENTS: Requires a compatible sink, water supply and waste-water connection. base unit: carcase height 720 mm, depth 561 mm, plinth height 20-200 mm.
RECOMMENDED_NEIGHBOURS: Dishwasher unit, drawer base units, worktop elements.
RESTRICTIONS: Cannot house an oven; not suitable for islands without plumbing.
STYLE_COMPATIBILITY: Modern handled kitchen. Also suits classic, Scandinavian and country-house designs.
SEARCH_KEYWORDS: sink cabinet, sink base unit, wash basin cabinet, plumbing cabinet.
AI_SELECTION_HINT: Select when the user requests a sink or washing area. Place a base unit on its right.
```

`ESUB2A90` (FSBF2P90):

```
FUNCTION: Handleless sink base unit, 90 cm wide, with 1 fixed front and 2 drawers (fingergrip). A base unit belongs on its right, because the sink with its drainer is wider than the unit.
PURPOSE: Wide handleless sink cabinet with plumbing access and drawer storage.
TYPICAL_PLACEMENT: Base row, within the washing zone.
REQUIREMENTS: Requires a compatible sink, water supply and waste-water connection. base unit: carcase height 720 mm, depth 561 mm, plinth height 20-200 mm.
RECOMMENDED_NEIGHBOURS: Handleless dishwasher unit, handleless drawer base units.
RESTRICTIONS: Cannot house an oven; not for islands without plumbing.
STYLE_COMPATIBILITY: Modern handleless (fingergrip) kitchen. Minimalist and premium designs.
SEARCH_KEYWORDS: handleless sink cabinet, fingergrip sink unit, sink drawer base.
AI_SELECTION_HINT: Select for a wide handleless sink cabinet with drawers. Place a base unit on its right.
```

`ESUT60` (FSBD60):

```
FUNCTION: Handleless sink base unit, 60 cm wide, with 1 door (fingergrip). A base unit belongs on its right, because the sink with its drainer is wider than the unit.
PURPOSE: Supports a kitchen sink in a handleless kitchen, with plumbing access.
TYPICAL_PLACEMENT: Base row, within the washing zone.
REQUIREMENTS: Requires a compatible sink, water supply and waste-water connection. base unit: carcase height 720 mm, depth 561 mm, plinth height 20-200 mm.
RECOMMENDED_NEIGHBOURS: Handleless dishwasher unit, handleless drawer base units.
RESTRICTIONS: Cannot house an oven; not for islands without plumbing.
STYLE_COMPATIBILITY: Modern handleless (fingergrip) kitchen. Minimalist and premium designs.
SEARCH_KEYWORDS: handleless sink cabinet, fingergrip sink unit, grip-less sink base.
AI_SELECTION_HINT: Select for a sink in a handleless kitchen with a single door. Place a base unit on its right.
```

**Acceptance criteria.**

- The descriptions of `SUB2A90`, `SUBA60`, `SUT60`, `ESUB2A90` and `ESUT60` say that another article
  belongs on their right.
- At the first attempt, the agent places a sink unit with an article on its right.

## 2. The door direction and handle position descriptions do not say which side a door opens to

**Library.** HOMAG Furniture_Smith.

**Attributes.** `mod_DoorDirectionSelection` (Door direction, `Front | Construction`) and
`mod_HandlePosType` (Handle position type, `FrontOpening | Handle`). Both are in the attribute
vocabulary of `get-plan-context`: a root module carries them, and they are customer-facing.

**Ticket.** RML-18203.

**Status.** Applied in the library as proposed, with two differences: the desc of `Automatic` keeps
"Setting via tab_DoorSettings." before the proposed text, and the desc of `14` names "the place of
03" — change 3 corrects it to `13`. The related article descriptions are not applied; change 3
carries them on.

**Problem.** In a row of cabinets, no handle may be on the outside of the row: the door at the left
end is hinged on the left, the door at the right end on the right. The library hinges every single
door on the left when the door direction is `Automatic`, the value every article comes with, so the
door at the right end of every row has its handle on the outside. The agent can set the side per
root module, but the descriptions do not tell it which attribute and which value:

- The desc of `mod_DoorDirectionSelection`, "Direction of the door", does not say that it is the
  hinge side as seen from the front, that the handle is on the other side, or which values a single
  door and a pair of doors take. The library calculates `Left` and `Right` only for single doors,
  `Left & Right` only for a pair of doors side by side; any other combination fails with "Error
  14019: Could not find entry in tab_DoorSettings", and the root module is not built.
- The desc of `Automatic`, "Setting via tab_DoorSettings", names an internal table instead of what
  the library chooses.
- `mod_HandlePosType` reads like a door direction — "Door vertical rotation left", "Door vertical
  rotation right" — but does not change the side a door opens to. An agent that wants a door to
  open to the right and takes `04` changes nothing but the turn of the handle.

**How the library behaves.** Checked on the bo-test planner on 2026-10-17, without a model, through
the MCP tools:

| Articles | Doors | `Automatic` resolves to | Calculated | Not calculated (Error 14019) |
|---|---|---|---|---|
| `KS_HT600K`, `HEST60`, `HEMT60`, `HEET60`, `UTB60`, `SB_UB600` | one door | `Left` | `Left`, `Right` (set on `KS_HT600K` and `SB_UB600`) | not checked |
| `H2TB60` | two doors, one above the other | `Left` on both | `Right` on both | `LeftRight` |
| `U2TB90` | a pair of doors side by side | `LeftRight` | `LeftRight` | `Left`, `Right`, `LeftLeft`, `RightRight` |

`mod_HandlePosType` on a single door of `KS_HT600K`, hinged left and hinged right: `03` and `04` both
put a vertical handle at the edge opposite the hinge, at the same place, the handle turned by 180°
against each other; `05` and `06` put it in the middle of the door's width. None changes the hinge
side.

**The descriptions before the change.**

| Attribute or value | Name | `desc` |
|---|---|---|
| `mod_DoorDirectionSelection` | Door direction | Direction of the door |
| `Left` | Left | Door left hinged |
| `Right` | Right | Door right hinged |
| `LeftRight` | Left & Right | First Door left hinged, Second Door right hinged |
| `LeftLeft` | Left & Left | First Door left hinged, Second Door left hinged |
| `RightRight` | Right & Right | First Door right hinged, Second Door right hinged |
| `Automatic` | Automatic | Setting via tab_DoorSettings |
| `mod_HandlePosType` | Handle position type | Position type of the handle |
| `03` | Position type 03 | Door vertical rotation left |
| `04` | Position type 04 | Door vertical rotation right |
| `05` | Position type 05 | Door vertical middle rotation left |
| `06` | Position type 06 | Door vertical middle rotation right |
| `03.1` – `06.1` | Position type 03.1 – 06.1 | as `03` – `06`, followed by "(Top of Handle in HandleLine)" |
| `13`, `14` | Position type 13, 14 | Frame door width 75 vertical rotation left, right |

**Where the change belongs.** The attribute vocabulary of `get-plan-context` serves the desc of an
attribute and the name and desc of each of its values in full (D76 of
[`docs/hi-mcp-behaviour.md`](../hi-mcp-behaviour.md)), and every desc is authoritative to the agent.
So the change goes into these descs directly.

**Proposed `desc` changes.**

`mod_DoorDirectionSelection`:

| Attribute or value | Proposed `desc` |
|---|---|
| `mod_DoorDirectionSelection` | The side a door is hinged on, as seen from the front: the handle is on the other side, and the door opens to the hinge side. Left and Right are for single doors, also two doors one above the other; Left & Right is for a pair of doors side by side. Automatic hinges a single door on the left wherever the cabinet stands: in a row, set the door at the right end to Right, so no handle is on the outside of the row. |
| `Left` | Hinged on the left, as seen from the front: the handle on the right, the door opens to the left. For single doors. |
| `Right` | Hinged on the right, as seen from the front: the handle on the left, the door opens to the right. For single doors. |
| `LeftRight` | A pair of doors side by side: the left door hinged on the left, the right door on the right, as seen from the front; the handles meet in the middle. |
| `LeftLeft` | A pair of doors side by side, both hinged on the left, as seen from the front. |
| `RightRight` | A pair of doors side by side, both hinged on the right, as seen from the front. |
| `Automatic` | The library chooses: a single door hinged on the left, a pair of doors side by side left and right — wherever the cabinet stands in a row. |

`LeftLeft` and `RightRight` are offered, but the library cannot calculate them for `U2TB90`, the one
article with a pair of doors that was checked. Either `tab_DoorSettings` gets their entries, or their
descs name the articles that take them.

`mod_HandlePosType`:

| Attribute or value | Proposed `desc` |
|---|---|
| `mod_HandlePosType` | Where a handle sits on a front and how it is turned. It does not change the side a door opens to: a handle at the edge of a door sits opposite its hinge, which Door direction sets. |
| `03` | Door: vertical handle at the edge opposite the hinge, turned to the left. |
| `04` | Door: vertical handle at the edge opposite the hinge, turned to the right — the place of 03, the handle turned by 180°. |
| `05` | Door: vertical handle in the middle of the door's width, turned to the left. |
| `06` | Door: vertical handle in the middle of the door's width, turned to the right — the place of 05, the handle turned by 180°. |
| `03.1` – `06.1` | as `03` – `06`, followed by "; the top of the handle at the handle line." |
| `13`, `14` | as `03` and `04`, for a frame door with a 75 mm frame. |

`03.1` – `06.1`, `13` and `14` were not checked; their proposals follow `03` – `06`.

**Related article descriptions.** The agent picks the value by the kind of doors an article has, and
"with 2 doors" says both kinds today: `H2TB60` ("Tall cabinet, 60 cm wide, with 2 doors") has two
doors one above the other, `U2TB90` ("Base cabinet, 90 cm wide, with 2 doors") a pair side by side.
The `FUNCTION` line of an article with two doors says which: "2 doors one above the other" or "a pair
of doors side by side". By their door modules in the article list, the other articles with two doors
are `HWR_HB600T2` (two door modules on 60 cm, one above the other) and `O2TB90`, `US2TB90`, `EU2TB90`
(one door module on 90 cm, a pair).

**Checked, no change.** `mod_CarcaseDirection` (corner units) and `mod_Direction` (fillers) are in
the vocabulary too, but on no article of a row with doors; `mod_DoorTypeSelection` is not
customer-facing.

**Acceptance criteria.**

- The descs of `mod_DoorDirectionSelection` and its values say the hinge side as seen from the front,
  that the handle is on the other side, which values single doors and a pair of doors take, and what
  `Automatic` chooses.
- The descs of `mod_HandlePosType` and its door values say where the handle sits and that it does not
  change the side a door opens to.
- With the served rule of RML-18203, the agent hinges the doors at the two ends of a row at the outer
  sides at the first attempt, with values the library calculates.

## 3. The articles with two doors do not say how their doors stand

**Library.** HOMAG Furniture_Smith.

**Articles and attributes.** `H2TB60`, `HWR_HB600T2`, `U2TB90`, `O2TB90`, `US2TB90`, `EU2TB90`; the
values `LeftLeft` and `RightRight` of `mod_DoorDirectionSelection`; the value `14` of
`mod_HandlePosType`.

**Ticket.** RML-18203.

**Status.** Not reported to the library development team.

**Problem.** In a row, the agent hinges the doors at the two ends at the outer sides of the row. The
desc of `mod_DoorDirectionSelection` says which values single doors and a pair of doors take: `Left`
and `Right` for single doors, also two doors one above the other, `Left & Right` for a pair of doors
side by side. The articles do not say which kind they have: "with 2 doors" stands for two doors one
above the other (`H2TB60`) and for a pair side by side (`U2TB90`). An agent that takes the doors of
`H2TB60` for a pair sets `LeftRight`; the library cannot calculate it — "Error 14019: Could not find
entry in tab_DoorSettings" — and the root module is not built.

Two smaller points of the door descs:

- `LeftLeft` and `RightRight` are offered for a pair of doors, but the library cannot calculate them
  on `U2TB90`, the one article with a pair that was checked (error 14019).
- The desc of `14` names "the place of 03"; as the frame-door value of `04`, it is the place of `13`.

**How the articles are built.** By their door modules in the article list: two `mf_Door` on 60 cm
are two doors one above the other, one `mf_Door` on 90 cm is a pair side by side. Calculated on the
bo-test planner: `H2TB60` with `Automatic` gets two single doors hinged left, with `Right` both hinged
right; `U2TB90` with `Automatic` gets `LeftRight`. The other four articles were not calculated.

**Proposed `desc` changes.** The `FUNCTION` line of each article — the agent sees it in the compact
catalog (D63 of [`docs/hi-mcp-behaviour.md`](../hi-mcp-behaviour.md)):

| Article | `FUNCTION` today | Proposed `FUNCTION` |
|---|---|---|
| `H2TB60` | Tall cabinet, 60 cm wide, with 2 doors and adjustable shelves. | Tall cabinet, 60 cm wide, with 2 doors one above the other and adjustable shelves. |
| `HWR_HB600T2` | Utility-room tall unit, 60 cm wide, with 2 doors. | Utility-room tall unit, 60 cm wide, with 2 doors one above the other. |
| `U2TB90` | Base cabinet, 90 cm wide, with 2 doors and adjustable shelves. | Base cabinet, 90 cm wide, with a pair of doors side by side and adjustable shelves. |
| `O2TB90` | Wall cabinet, 90 cm wide, with 2 doors and adjustable shelves. | Wall cabinet, 90 cm wide, with a pair of doors side by side and adjustable shelves. |
| `US2TB90` | Base cabinet, 90 cm wide, with 1 drawer and 2 doors, adjustable shelves. | Base cabinet, 90 cm wide, with 1 drawer and a pair of doors side by side, adjustable shelves. |
| `EU2TB90` | Handleless base cabinet, 90 cm wide, with 2 doors and shelves (fingergrip). | Handleless base cabinet, 90 cm wide, with a pair of doors side by side and shelves (fingergrip). |

The values:

- `LeftLeft` and `RightRight`: `tab_DoorSettings` gets their entries for the articles with a pair of
  doors, or their descs name the articles that take them.
- `14`: "Door: vertical handle at the edge opposite the hinge, turned to the right — the place of 13,
  the handle turned by 180°, for a frame door with a 75 mm frame."

**Acceptance criteria.**

- The `FUNCTION` line of every article with two doors says whether they stand one above the other
  or side by side.
- `LeftLeft` and `RightRight` are calculated on the articles with a pair of doors, or their descs
  name the articles that take them.
- The desc of `14` names the place of `13`.

## 4. The sink unit descriptions do not say how far the sink reaches over the unit on its right

**Library.** HOMAG Furniture_Smith.

**Articles and attributes.** `SUT60`, `SUBA60`, `SUB2A90`, `ESUT60`, `ESUB2A90`; the values of
`mod_SinkId`.

**Ticket.** None. Backlog item 60 — the part change 1 leaves open.

**Status.** Not reported to the library development team.

**Problem.** Change 1 tells the agent that a base unit belongs on the right of a sink unit. It does
not say how far the sink with its drainer reaches over that unit, and not that the unit must not be a
hob unit: swapped beside the hob unit, the drainer covers part of the hob. The value of `mod_SinkId`
every sink unit comes with, `Axia_Grey_L`, has the name "Axia color grey basin left" and the desc
`Axia_Grey_L`: nothing says that the drainer is on the right.

**How the library builds it.** All five sink units come with the same sink, `mod_SinkId`
`Axia_Grey_L` (Blanco), basin on the left, drainer on the right, 980 mm wide with the drainer. The
outlines of the root modules in the plan contexts of the stored runs span 995.75 mm along the row for
the 600 mm units and 1145.75 mm for the 900 mm units; the extra part overlaps the root module at the
next `rowIndex`, the unit on the right:

| Articles | Unit width | Outline along the row | Reaches past the right side |
|---|---|---|---|
| `SUT60`, `SUBA60`, `ESUT60` | 600 mm | 995.75 mm | 396 mm |
| `SUB2A90`, `ESUB2A90` | 900 mm | 1145.75 mm | 246 mm |

Reproduce: `mcp-test-2026-10-17_13-28-41`: gpt-6-astra 30 (`edit-swap-hob-unit`): the swapped sink's
top reaches 396 mm over the hob unit on its right.

**Where the change belongs.** The `FUNCTION` and `AI_SELECTION_HINT` lines, which the compact catalog
serves (D63); `mod_SinkId` is in the attribute vocabulary (`userRight` `Simple`), so its value descs
reach the agent in full (D76).

**Proposed `desc` changes.** The other sections stay as change 1 left them; each description stays
below 1000 characters (917 to 960).

| Article | Proposed `FUNCTION` | Proposed `AI_SELECTION_HINT` |
|---|---|---|
| `SUT60` | Sink base unit, 60 cm wide, with 1 hinged door. Its sink with the drainer is 980 mm wide and reaches 396 mm past its right side, over the unit on its right. | Select when the user requests a sink or washing area. Place a base unit on its right, not a hob unit. |
| `SUBA60` | Sink base unit, 60 cm wide, with 1 fixed front and 1 pull-out. Its sink with the drainer is 980 mm wide and reaches 396 mm past its right side, over the unit on its right. | Select for a sink cabinet that also offers a storage pull-out. Place a base unit on its right, not a hob unit. |
| `SUB2A90` | Sink base unit, 90 cm wide, with 1 fixed front and 2 pull-outs. Its sink with the drainer is 980 mm wide and reaches 246 mm past its right side, over the unit on its right. | Select for a wide sink cabinet with additional pull-out storage. Place a base unit on its right, not a hob unit. |
| `ESUT60` | Handleless sink base unit, 60 cm wide, with 1 door (fingergrip). Its sink with the drainer is 980 mm wide and reaches 396 mm past its right side, over the unit on its right. | Select for a sink in a handleless kitchen with a single door. Place a base unit on its right, not a hob unit. |
| `ESUB2A90` | Handleless sink base unit, 90 cm wide, with 1 fixed front and 2 drawers (fingergrip). Its sink with the drainer is 980 mm wide and reaches 246 mm past its right side, over the unit on its right. | Select for a wide handleless sink cabinet with drawers. Place a base unit on its right, not a hob unit. |

The values of `mod_SinkId`:

| Value | Name | Proposed `desc` |
|---|---|---|
| `Axia_Grey_L` | Axia color grey basin left | Blanco Axia sink in grey, 980 mm wide with the drainer: basin on the left, drainer on the right. |
| `Axia_Grey_R` | Axia color grey basin right | Blanco Axia sink in grey, 980 mm wide with the drainer: basin on the right, drainer on the left. |
| `Axia_White_L`, `Axia_White_R`, `Axia_Anthrazit_L`, `Axia_Anthrazit_R` | Axia color white / anthrazit basin left / right | as the grey ones, "in white", "in anthracite" |
| `Axis_L`, `Axis_R`, `Dinas_L`, `Dinas_R`, `Metra_R` | Axis / Dinas / Metra basin left / right | alike, with the width of each sink |

The drainer side of the `_R` values follows from their names; the library team confirms it. If the
sink units take a basin-right sink, the drainer reaches over the unit on their left, and the
`FUNCTION` line names the side by the sink.

**Acceptance criteria.**

- The `FUNCTION` line of every sink unit names the width of its sink with the drainer and how far it
  reaches over the unit on its right.
- The `AI_SELECTION_HINT` line of every sink unit asks for a base unit on its right, not a hob unit.
- The value descs of `mod_SinkId` name the basin side and the drainer side.
- `edit-swap-hob-unit`: the agent identifies a swap that puts the hob unit immediately right of the
  sink unit as conflicting with the sink unit's description.

## 5. The handle design No handle does not say that handleless fronts are articles of their own

**Library.** HOMAG Furniture_Smith.

**Attributes.** `mod_HandleDesign` (Handle design, `FrontOpening | Handle`) and its value `10` (No
handle).

**Ticket.** None. Backlog item 61.

**Status.** Not reported to the library development team.

**Problem.** For "only handleless fronts" the agent sets `mod_HandleDesign` `10` on the handled
articles instead of choosing the handleless articles (category `Kitchen handleless`). The desc of the
attribute is "Design of a handle", the desc of `10` "No handle": nothing says that a handled article
with No handle has no fingergrip either, or that the handleless fronts are articles of their own.

**How the library builds it.** The handleless articles come with `mod_HandleDesign` `10`,
`mod_FingergripType` `Wood` and `mod_CreateFingergrip` `True` (`article.json`): fronts with a wooden
fingergrip. A handled article set to `mod_HandleDesign` `10` keeps `mod_CreateFingergrip` `False`
and `mod_FingergripType` `None`: fronts without a handle and without a grip (order data of
`mcp-test-2026-10-17_13-28-41` gpt-6-astra 52). The two fingergrip attributes are not in the
attribute vocabulary (`userRight` `Advanced`). The catalog has handleless variants of base units
only — sink, storage, corner and hob units; the tall and wall units have none.

Reproduce: `mcp-test-2026-10-17_13-28-41`: gpt-6-astra 52 (`kitchen-conversation`, turn 5) and
`mcp-test-2026-10-16_19-30-19`: gpt-6.1-sol 50 (turn 5): `mod_HandleDesign` `10` on the handled
articles of both groups; gpt-6.1-sol answers "No fingergrip profiles were added—the existing units do
not support that attribute".

**Where the change belongs.** `mod_HandleDesign` is in the attribute vocabulary (`isMain`,
`userRight` `Simple`); the desc of the attribute and of `10` reach the agent when it chooses the value.

**Proposed `desc` changes.**

| Attribute or value | Name | `desc` today | Proposed `desc` |
|---|---|---|---|
| `mod_HandleDesign` | Handle design | Design of a handle | Design of the handle on the fronts of a handled article. A handleless front with a fingergrip is no handle design: it comes with the handleless articles (fingergrip). |
| `10` | No handle | No handle | Fronts without a handle and without a fingergrip. For handleless fronts, choose the handleless articles (fingergrip) where the catalog has one. |

**Acceptance criteria.**

- The descs of `mod_HandleDesign` and `10` say that handleless fronts with a fingergrip are the
  handleless articles, and that No handle builds no fingergrip.
- `kitchen-conversation` turn 5 ends with the handleless articles where a variant exists.

## 6. The flap wall cabinets do not say which sizes their flap fitting takes

**Library.** HOMAG Furniture_Smith.

**Articles.** `OSKB60`, `OSKB90` (swing-up flap, fitting `SHF`), `OFKB60`, `OFKB90` (folding
flap).

**Ticket.** None. Backlog item 64.

**Status.** Not reported to the library development team.

**Problem.** To copy a band of low, deep cabinets above the tall units of a photo, the agent gives
`OSKB90` `mod_Height` 360 or 300 and `mod_Depth` 561. The library cannot calculate the flap fitting —
"Error 14023: Could not find entry in tab_FlipliftSettings for input value: SHF - 324 - 862 - 533 -
Handle" (300: `SHF - 264 - …`) — and the cabinets are not built. The descs name a flap and the
clearance above it, no size; `mod_Height` and `mod_Depth` name none either.

**How the library builds it.**

| Article | `mod_Height` × `mod_Depth` | Built | Runs |
|---|---|---|---|
| `OSKB60`, `OSKB90`, `OFKB60`, `OFKB90` | 720 × 350, as they come | yes | every run that plans them with their own size |
| `OSKB90` | 360 × 561 | no, Error 14023 | `mcp-test-2026-10-16_19-30-19` gpt-6.1-sol 48, `mcp-test-2026-10-17_13-28-41` gpt-6-astra 50 |
| `OSKB90` | 300 × 561 | no, Error 14023 | `mcp-test-2026-10-17_09-31-13` gpt-6-astra 48 |
| `O2TB90` (doors) | 360 × 561 | yes | `mcp-test-2026-10-17_13-28-41` gpt-6-astra 50, the `exchange-root-module` |

Both failing sizes change the height and the depth; which of the two the fitting does not take is
not known.

**Where the change belongs.** The `FUNCTION` line, which the agent reads when it picks the article
and sets its size, and the `AI_SELECTION_HINT` line for the way out.

**Proposed `desc` changes.** `‹…›` are the ranges the library team takes from `tab_FlipliftSettings`,
per fitting and width. Each description stays below 1000 characters (about 890 to 920, with the
`AI_SELECTION_HINT` of change 10).

| Article | Proposed `FUNCTION` | Proposed `AI_SELECTION_HINT` |
|---|---|---|
| `OSKB60` | Wall cabinet, 60 cm wide, with 1 swing-up flap and shelves. Its flap fitting takes heights from ‹…› to ‹…› mm and depths from ‹…› to ‹…› mm. | Select for a wall cabinet with a single swing-up flap. For another size, such as a low cabinet above tall units, choose a wall cabinet with doors. |
| `OSKB90` | Wall cabinet, 90 cm wide, with 1 swing-up flap and shelves. Its flap fitting takes heights from ‹…› to ‹…› mm and depths from ‹…› to ‹…› mm. | Select for a wide wall cabinet with a single swing-up flap. For another size, such as a low cabinet above tall units, choose a wall cabinet with doors. |
| `OFKB60` | Wall cabinet, 60 cm wide, with 1 folding flap (two-part lift) and shelves. Its flap fitting takes heights from ‹…› to ‹…› mm and depths from ‹…› to ‹…› mm. | Select for a wall cabinet with a folding upward flap. For another size, such as a low cabinet above tall units, choose a wall cabinet with doors. |
| `OFKB90` | Wall cabinet, 90 cm wide, with 1 folding flap (two-part lift) and shelves. Its flap fitting takes heights from ‹…› to ‹…› mm and depths from ‹…› to ‹…› mm. | Select for a wide wall cabinet with a folding upward flap. For another size, such as a low cabinet above tall units, choose a wall cabinet with doors. |

**Acceptance criteria.**

- The `FUNCTION` line of every flap wall cabinet names the heights and depths its flap fitting takes.
- `image-planning-right-wall`: the first create builds the cabinets above the tall units.

## 7. The colour values do not say whether they are a plain, a wood or a stone decor

**Library.** HOMAG Furniture_Smith.

**Attributes.** The colour value list that `mod_FrontColor`, `mod_CarcaseColor`,
`mod_CarcaseOutsideColor`, `mod_UprightColor`, `mod_CountertopColor`, `mod_PaneltopColor`,
`mod_BacksplashColor`, `mod_ToekickColor`, `mod_CeilingFillerColor`, `mod_Color` and the edge colours
share. The attribute vocabulary lists it once; the other attributes name it with `sameSelectionsAs`
(D76).

**Ticket.** None. Backlog items 69, 70 and 71.

**Status.** Not reported to the library development team.

**Problem.** The programs are named by the kind of colour they take: the front program Classic
"Simple fronts in plain decors", Nature "Simple fronts in wood decors"; the upright and carcase
programs ModernNature and Nature "Carcase in wooden colors", Classic "Classic carcase in single
colors". The colour values name the colour only — "Snow white (#F0F0F0)", "Maple (#E0D0C0)", "Slate
(#303030)" — so the agent cannot tell which program a colour needs. The library switches the front
program and the carcase program with the colour, the upright program not (change 8); a plain colour
under a wood program is not built (changes 8 and 9); the stone decors come as fronts only with the
program Modern (change 10).

**How the library sorts the colours.** In the stored runs, the library switched the front program to
Classic for 160 and 178, to Nature for 222 and 229, to Modern for 326, and the carcase program to
ModernNature for 215, 230, 240 and 326; D59 names 316, 324, 326 and 380 as coming only with Modern.
The calculation errors name a plain colour `NoGrain`, a wood or stone decor `Grain`. The value numbers
follow the kinds — 1xx plain, 2xx wood, 3xx stone. The values the runs did not switch are sorted by
their name and number; the library team confirms them.

**Where the change belongs.** The value descs of the shared list: the attribute vocabulary serves them
in full (D76), and the program descs already use the words "plain decors" and "wood decors".

**Proposed `desc` changes.** The kind after the colour code; `materials.md` reads the code from
anywhere in the desc.

| Kind | Values | Proposed `desc`, for example |
|---|---|---|
| plain decor | 152 Cloudy blue, 155 Denim blue, 160 Olive green, 165 Seaweed green, 178 Light grey, 190 Sunny white, 192 Snow white, 199 Jet black | Snow white (#F0F0F0), plain decor |
| wood decor | 214 Dark walnut, 215 Walnut, 216 Tiepolo walnut, 222 Oak, 224 Bijoux oak, 229 Dark oak, 230 Maple, 240 Ash grey, 250 Ponderosa pine | Walnut (#C09070), wood decor |
| stone decor | 316 Concrete, 324 Dark marble, 326 Slate, 380 Marble | Slate (#303030), stone decor; as a front color only with Modern, on doors |

**Acceptance criteria.**

- Every value of the shared colour list names its kind: plain decor, wood decor or stone decor.
- The stone decors say that a front in them is a Modern door.

## 8. The upright colour does not say which upright program it needs

**Library.** HOMAG Furniture_Smith.

**Articles and attributes.** `mod_UprightColor`, `mod_UprightProgram` and its values; the end and
cover panels `W60H`, `W60U` and `W35O`.

**Ticket.** None. Backlog item 69.

**Status.** Not reported to the library development team.

**Problem.** A create whose group attributes set a plain `mod_UprightColor` without
`mod_UprightProgram` does not build its end and cover panels: "Error 14034: Could not find entry in
tab_GrainDirectionSettings for input values: part_FinishPanel - Upright - Horizontal - NoGrain - …".
Besides `W60H` and `W60U`, the wall-unit side panel `W35O` fails alike (`- 373 - 720`). The library
switches the front program with the front colour, not the upright program with the upright colour.
The desc of `mod_UprightColor` is "Color of the upright"; the program values speak of the carcase and
of "single colors", which the agent does not connect with Snow white.

**How the library builds it.** The end and cover panels come with the program ModernNature (grain
horizontal).

| `mod_UprightColor` | `mod_UprightProgram` | Built | Runs |
|---|---|---|---|
| plain (192, 190) | not set | no, Error 14034 | `mcp-test-2026-10-16_19-30-19` gpt-6.1-sol 50 (`W60U`, `W60H`, `W35O`); `mcp-test-2026-10-17_13-28-41` gpt-6-astra 52 and 53 |
| plain (192) | Classic | yes | `mcp-test-2026-10-17_13-28-41` gpt-6-astra 52, the second create of turn 1 |
| wood (222) | Nature | yes | `mcp-test-2026-10-17_13-28-41` gpt-6-astra 52 turn 4; `mcp-test-2026-10-17_09-31-13` gpt-6-astra 50 turn 4 |
| wood (240) | Classic | yes | `mcp-test-2026-10-17_13-28-41` gpt-6-astra 52 turn 7 |

**Where the change belongs.** Both attributes are in the attribute vocabulary (`mod_UprightColor`
`userRight` `Simple`, `mod_UprightProgram` `isMain`). The three program values are the same for
`mod_CarcaseProgram` and `mod_CarcaseOutsideProgram`; the proposed value descs fit all three.

**Proposed `desc` changes.**

| Attribute or value | Name | `desc` today | Proposed `desc` |
|---|---|---|---|
| `mod_UprightColor` | Color | Color of the upright | Color of the end and cover panels. Set Upright Program with it: Classic for a plain decor, ModernNature or Nature for a wood or stone decor. The panels come with ModernNature. |
| `mod_UprightProgram` | Upright Program | Upright Program | How the end and cover panels are built for the kind of their color. Set it with Color. |
| `ModernNature` | ModernNature | Carcase in wooden colors horizontal | Wood and stone decors, grain horizontal. |
| `Nature` | Nature | Carcase in wooden colors vertical | Wood and stone decors, grain vertical. |
| `Classic` | Classic | Classic carcase in single colors | Plain decors. |

Stone decors under Nature were not checked.

**What the descriptions leave to the library.** If the library switches `mod_UprightProgram` with
`mod_UprightColor`, as it switches the front program with the front colour, the agent needs no second
attribute, and the desc of `mod_UprightColor` keeps its first sentence only.

**Acceptance criteria.**

- The desc of `mod_UprightColor` names the program for each kind of colour.
- The values of `mod_UprightProgram` name the kind of colour they take.
- `kitchen-conversation` turn 1 and `image-kitchen-back-right-corner`: the first create with a plain
  upright colour builds its end panels.

## 9. The carcase colours do not say which colour the visible sides take

**Library.** HOMAG Furniture_Smith.

**Attributes.** `mod_CarcaseColor`, `mod_CarcaseOutsideColor`.

**Ticket.** None. Backlog item 70.

**Status.** Not reported to the library development team.

**Problem.** A create with a plain front colour and a wood carcase colour, without
`mod_CarcaseOutsideColor`, does not build the units whose side is visible — the units at the ends of a
row: "Error 14034: Could not find entry in tab_GrainDirectionSettings for input values:
part_Sidepanelleft - TallUnitAppliance - Horizontal - NoGrain - 2100 - 561", alike for base and wall
units. The desc of `mod_CarcaseColor`, "Color of the carcase inside and outside if not visible", says
that the visible sides take another colour, not which; the desc of `mod_CarcaseOutsideColor`,
"Outside color of the carcase", does not say that it is the visible sides, or what they take where it
is not set.

**How the library builds it.** A visible side takes `mod_CarcaseOutsideColor`; where the create does
not set it, it is the front colour (order data of `mcp-test-2026-10-16_19-30-19` gpt-6.1-sol 46:
`mod_CarcaseOutsideColor` 160, the front colour). A wood or stone `mod_CarcaseColor` switches
`mod_CarcaseProgram` to ModernNature (a correction, D59), and the visible sides are built with it.

| Front | `mod_CarcaseColor` | `mod_CarcaseOutsideColor` | Visible sides built | Runs |
|---|---|---|---|---|
| plain (160, 192) | wood (230, 215, 229) | not set: the front colour | no, Error 14034 | `mcp-test-2026-10-16_19-30-19` gpt-6.1-sol 46 (`HK260`, `USTB60`, `UTB60`); `mcp-test-2026-10-17_10-50-12` mistral-large-latest 50 (base, wall and tall units) |
| plain (160) | wood (224, 215) | the same wood | yes | `mcp-test-2026-10-17_09-31-13` gpt-6-astra 46; `mcp-test-2026-10-17_13-28-41` gpt-6-astra 48 |
| wood (229, 240) | plain (178, 190) | the front wood | yes | `mcp-test-2026-10-16_19-30-19` gpt-6.1-sol 45; `mcp-test-2026-10-17_09-31-13` gpt-6-astra 45 |

**Where the change belongs.** `mod_CarcaseColor` and `mod_CarcaseOutsideColor` are in the attribute
vocabulary (`userRight` `Simple`). `mod_CarcaseProgram` and `mod_CarcaseOutsideProgram` are not
(`userRight` `Master`, not `isMain`): a desc there reaches the agent only in a correction sentence.

**Proposed `desc` changes.**

| Attribute | Name | `desc` today | Proposed `desc` |
|---|---|---|---|
| `mod_CarcaseColor` | Carcase color | Color of the carcase inside and outside if not visible | Color of the carcase inside and of its sides that are not visible. The visible sides take Carcase color outside: with a wood or stone decor here, set Carcase color outside to a wood or stone decor too. |
| `mod_CarcaseOutsideColor` | Carcase color outside | Outside color of the carcase | Color of the visible sides of the carcase, such as the side at the end of a row. Where it is not set, the visible sides take the front color. |

**What the descriptions leave to the library.** Plain visible sides on a wood or stone carcase — the
sides in the plain front colour, the carcase in wood. If the library switches
`mod_CarcaseOutsideProgram` with `mod_CarcaseOutsideColor`, as it switches the front program with the
front colour, every combination builds, and the desc of `mod_CarcaseColor` keeps its first two
sentences. Whether `mod_CarcaseOutsideProgram` Classic builds such sides today was not checked.

**Acceptance criteria.**

- The desc of `mod_CarcaseColor` says that the visible sides take Carcase color outside, and which
  kind it needs with a wood or stone carcase.
- The desc of `mod_CarcaseOutsideColor` says that it is the colour of the visible sides, and that
  they take the front colour where it is not set.
- `image-kitchen-left-wall`: the first create with green fronts and a wood carcase builds every root
  module.

## 10. The front program Modern does not say which fronts it builds

**Library.** HOMAG Furniture_Smith.

**Articles and attributes.** The value `Modern` of `mod_FrontProgram`; the stone decors 316, 324, 326
and 380 (change 7); the flap wall cabinets `OSKB60`, `OSKB90`, `OFKB60`, `OFKB90`.

**Ticket.** None. Backlog item 71.

**Status.** Not reported to the library development team.

**Problem.** The library builds the front program Modern — "Mitred frame fronts with glass filling" —
on doors only. A flap or a drawer front with Modern is not built: "Error 14036: Could not find entry
in tab_PanelWoodFrameConstruction for input values: Fliplift - ModernFrame01 - Grain - Grain - None"
(flaps), "Drawer - ModernFrame01 - NoGrain - NoGrain - Glass" (drawers and pull-outs). The agent gets
there two ways: it sets Modern on flap cabinets for the glass wall cabinets of a photo, or it sets a
stone decor, which comes as a front only with Modern, and the library switches the program. Neither
the program nor the articles say it. The kitchen catalog has no wall cabinet with glass fronts; the
glass display cabinets `SM_WT300S` and `SM_HT600S` are living-room articles.

**How the library builds it.**

| Fronts with Modern | Built | Runs |
|---|---|---|
| doors (`OTB60`) | yes; the library sets Concrete 316 in place of Sunny white 190 | `mcp-test-2026-10-17_13-28-41` gpt-6-astra 51 |
| flaps (`OFKB60`), Modern set | no, Error 14036 | `mcp-test-2026-10-16_19-30-19` gpt-6.1-sol 49 |
| flaps (`OSKB60`, `OSKB90`), Slate 326 set as front colour, the library switched to Modern | no, Error 14036 | `mcp-test-2026-10-17_10-50-12` mistral-large-latest 48 |
| drawers and pull-outs (`US2A60`, `UKS2A60`, `HTS2AB60`) | no, Error 14036; the doors of the same calls are built | `mcp-test-2026-10-17_10-50-12` mistral-large-latest 50, attempt 1, turn 5 |

**Where the change belongs.** `mod_FrontProgram` is in the attribute vocabulary (`isMain`, `userRight`
`Simple`), so the desc of `Modern` reaches the agent when it chooses the program; the
`AI_SELECTION_HINT` of the flap wall cabinets reaches it when it picks the article. The stone decors
carry the same note (change 7).

**Proposed `desc` changes.**

| Value | Name | `desc` today | Proposed `desc` |
|---|---|---|---|
| `Modern` | Modern | Mitred frame fronts with glass filling | Mitred frame doors with glass filling, in stone decors. Drawers, pull-outs and flaps are not built with it: an article with them takes another program. |

The `AI_SELECTION_HINT` of the flap wall cabinets names glass fronts beside the sizes of change 6:

| Article | Proposed `AI_SELECTION_HINT` |
|---|---|
| `OSKB60` | Select for a wall cabinet with a single swing-up flap. For glass fronts or another size, such as a low cabinet above tall units, choose a wall cabinet with doors. |
| `OSKB90` | Select for a wide wall cabinet with a single swing-up flap. For glass fronts or another size, such as a low cabinet above tall units, choose a wall cabinet with doors. |
| `OFKB60` | Select for a wall cabinet with a folding upward flap. For glass fronts or another size, such as a low cabinet above tall units, choose a wall cabinet with doors. |
| `OFKB90` | Select for a wide wall cabinet with a folding upward flap. For glass fronts or another size, such as a low cabinet above tall units, choose a wall cabinet with doors. |

**What the descriptions leave to the library.** Glass flaps and glass drawer fronts, if the library
wants to offer them: entries in `tab_PanelWoodFrameConstruction` for `Fliplift` and `Drawer` with
`ModernFrame01`.

**Acceptance criteria.**

- The desc of `Modern` says that it builds doors, and in which colours.
- The `AI_SELECTION_HINT` of every flap wall cabinet points to a wall cabinet with doors for glass
  fronts.
- `image-only-no-text`: the create builds the glass wall cabinets of the photo as wall cabinets with
  doors.
