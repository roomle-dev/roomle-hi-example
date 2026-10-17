# Suggested library changes

> **Type**: Living reference — the changes the library data needs so the agent plans right
> **Domain**: the library data the plan context passes on — the article list and the master data,
> and in them the `desc` properties
> **Source**: the open issues of [`.agents/backlog/library-issues.md`](../../.agents/backlog/library-issues.md)

The MCP server is library-neutral ([§2.4](../hi-mcp-behaviour.md#24-instructions)): what the agent
knows of a library comes only from the library data. When the agent plans wrong because that data
lacks information, the fix is in the library. This document collects the concrete changes to propose
to the library development team — the exact text to add to or change in the `desc` of the affected
articles and attributes.

Each change names the library, the affected articles or attributes, the problem, the proposed `desc`
change and the ticket. A change leaves this document when the library carries it.

## Overview

| # | Change | Library | Articles or attributes | Status | Ticket |
|---|---|---|---|---|---|
| 1 | [The sink unit descriptions do not say that a sink unit needs an article on its right](#1-the-sink-unit-descriptions-do-not-say-that-a-sink-unit-needs-an-article-on-its-right) | HOMAG Furniture_Smith | `SUB2A90`, `SUBA60`, `SUT60`, `ESUB2A90`, `ESUT60` | reported to the library development team | RML-18124 |
| 2 | [The door direction and handle position descriptions do not say which side a door opens to](#2-the-door-direction-and-handle-position-descriptions-do-not-say-which-side-a-door-opens-to) | HOMAG Furniture_Smith | `mod_DoorDirectionSelection`, `mod_HandlePosType` | not reported | RML-18203 |

## 1. The sink unit descriptions do not say that a sink unit needs an article on its right

**Library.** HOMAG Furniture_Smith.

**Articles.** `SUB2A90` (SBF2P90), `SUBA60` (SBFP60), `SUT60` (SBD60), and their handleless
variants `ESUB2A90` (FSBF2P90) and `ESUT60` (FSBD60).

**Ticket.** RML-18124. Backlog item 60 of
[`.agents/backlog/library-issues.md`](../../.agents/backlog/library-issues.md).

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

**What the descriptions say today.** None of the articles states that another article belongs on the
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

**What the descriptions say today.**

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
