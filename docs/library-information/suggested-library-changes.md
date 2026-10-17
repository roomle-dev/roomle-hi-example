# Suggested library changes

> **Type**: Living reference — every change suggested for the library data so the agent plans right,
> applied in the library or not
> **Domain**: the library data the plan context passes on — the article list and the master data,
> and in them the `desc` properties
> **Source**: the issues of [`.agents/backlog/library-issues.md`](../../.agents/backlog/library-issues.md)
> and the stored test runs under `.temp/result/`

The MCP server is library-neutral ([§2.4](../hi-mcp-behaviour.md#24-instructions)): what the agent
knows of a library comes only from the library data. When the agent plans wrong because that data
lacks information, the fix is in the library. This document collects the text to propose to the
library development team: the complete new description of every affected article, and the new
`desc` of every affected attribute and value.

The document keeps every suggested change, applied in the library or not. The **Status** of each
section says which; an applied text stays as the record of what the library got.

## Overview

| Section | Articles or attributes | Status | Ticket |
|---|---|---|---|
| [2.1 Sink base units](#21-sink-base-units) | `SUT60`, `SUBA60`, `SUB2A90`, `ESUT60`, `ESUB2A90` | partly applied | RML-18124 |
| [2.2 Articles with two doors](#22-articles-with-two-doors) | `H2TB60`, `HWR_HB600T2`, `U2TB90`, `O2TB90`, `US2TB90`, `EU2TB90` | not reported | RML-18203 |
| [2.3 Flap wall cabinets](#23-flap-wall-cabinets) | `OSKB60`, `OSKB90`, `OFKB60`, `OFKB90` | not reported | — |
| [3.1 Colour values](#31-colour-values) | the colour list of `mod_FrontColor`, `mod_CarcaseColor`, `mod_UprightColor` and the other colour attributes | not reported | — |
| [3.2 Front program](#32-front-program) | `mod_FrontProgram` | not reported | — |
| [3.3 Carcase colours](#33-carcase-colours) | `mod_CarcaseColor`, `mod_CarcaseOutsideColor` | not reported | — |
| [3.4 Upright colour and program](#34-upright-colour-and-program) | `mod_UprightColor`, `mod_UprightProgram` | not reported | — |
| [3.5 Handle design](#35-handle-design) | `mod_HandleDesign` | not reported | — |
| [3.6 Door direction](#36-door-direction) | `mod_DoorDirectionSelection` | applied | RML-18203 |
| [3.7 Handle position type](#37-handle-position-type) | `mod_HandlePosType` | applied, except `14` | RML-18203 |
| [3.8 Sink](#38-sink) | `mod_SinkId` | not reported | — |

[Chapter 4](#4-beyond-the-descriptions) lists what the descriptions cannot do — changes to the
library's logic and data, and the points the library team confirms. [Chapter 5](#5-how-the-library-behaves)
holds the evidence, [chapter 6](#6-the-backlog-items) maps the backlog items to the sections.

## 1. What reaches the agent

- **Article descriptions** are written in sections — `FUNCTION`, `PURPOSE`, `TYPICAL_PLACEMENT`,
  `REQUIREMENTS`, `RECOMMENDED_NEIGHBOURS`, `RESTRICTIONS`, `STYLE_COMPATIBILITY`, `SEARCH_KEYWORDS`,
  `AI_SELECTION_HINT` — and hold **at most 1000 characters**. The catalog of `get-plan-context` serves
  the `FUNCTION` and `AI_SELECTION_HINT` lines only (D63 of
  [`docs/hi-mcp-behaviour.md`](../hi-mcp-behaviour.md)); the full description only when the agent
  requests `articleDescriptions`. What the agent needs to pick an article goes into these two lines.
- **The attribute vocabulary** of `get-plan-context` serves the customer-facing attributes —
  `isMain`, or `userRight` `Simple` — with the `desc` of the attribute and the name and `desc` of each
  value, in full (D76). A value list several attributes share is listed once.
- **Any other attribute** reaches the agent only when the library changes its value and the result
  names the change (D59) — `mod_CarcaseProgram`, `mod_CarcaseOutsideProgram` and
  `mod_FingergripType`, for example. A rule the agent needs goes into a customer-facing attribute.

## 2. Article descriptions

Each section gives the complete new description of every article, one line per section, as the
library carries it. Every description stays below the limit of 1000 characters; the count is in its
heading.

### 2.1 Sink base units

**Status.** Partly applied (RML-18124): the library carries "A base unit belongs on its right,
because the sink with its drainer is wider than the unit." in `FUNCTION` and "Place a base unit on
its right." in `AI_SELECTION_HINT`. Not reported: the width of the sink and how far it reaches, and
"not a hob unit".

**Why.** The sink with its drainer is wider than the unit and reaches over the unit on its right
([5.1](#51-sink-and-drainer)). Without an article there the drainer hangs in the air; beside a hob
unit it covers the hob.

**Changed lines.** `FUNCTION` and `AI_SELECTION_HINT`.

`SUT60` (SBD60) — 917 characters:

```
FUNCTION: Sink base unit, 60 cm wide, with 1 hinged door. Its sink with the drainer is 980 mm wide and reaches 396 mm past its right side, over the unit on its right.
PURPOSE: Supports a kitchen sink and gives access to the plumbing below.
TYPICAL_PLACEMENT: Base row, within the washing zone.
REQUIREMENTS: Requires a compatible sink, water supply and waste-water connection. base unit: carcase height 720 mm, depth 561 mm, plinth height 20-200 mm.
RECOMMENDED_NEIGHBOURS: Dishwasher unit, drawer base units, worktop elements.
RESTRICTIONS: Cannot house an oven; not suitable for islands without plumbing.
STYLE_COMPATIBILITY: Modern handled kitchen. Also suits classic, Scandinavian and country-house designs.
SEARCH_KEYWORDS: sink cabinet, sink base unit, wash basin cabinet, plumbing cabinet.
AI_SELECTION_HINT: Select when the user requests a sink or washing area. Place a base unit on its right, not a hob unit.
```

`SUBA60` (SBFP60) — 938 characters:

```
FUNCTION: Sink base unit, 60 cm wide, with 1 fixed front and 1 pull-out. Its sink with the drainer is 980 mm wide and reaches 396 mm past its right side, over the unit on its right.
PURPOSE: Supports a sink while offering a lower pull-out for storage.
TYPICAL_PLACEMENT: Base row, within the washing zone.
REQUIREMENTS: Requires a compatible sink, water supply and waste-water connection. base unit: carcase height 720 mm, depth 561 mm, plinth height 20-200 mm.
RECOMMENDED_NEIGHBOURS: Dishwasher unit, drawer base units, worktop elements.
RESTRICTIONS: Cannot house an oven; not suitable for islands without plumbing.
STYLE_COMPATIBILITY: Modern handled kitchen. Also suits classic, Scandinavian and country-house designs.
SEARCH_KEYWORDS: sink cabinet, sink base unit, pull-out sink unit, plumbing cabinet.
AI_SELECTION_HINT: Select for a sink cabinet that also offers a storage pull-out. Place a base unit on its right, not a hob unit.
```

`SUB2A90` (SBF2P90) — 960 characters:

```
FUNCTION: Sink base unit, 90 cm wide, with 1 fixed front and 2 pull-outs. Its sink with the drainer is 980 mm wide and reaches 246 mm past its right side, over the unit on its right.
PURPOSE: Wide sink cabinet combining plumbing access with two storage pull-outs.
TYPICAL_PLACEMENT: Base row, within the washing zone.
REQUIREMENTS: Requires a compatible sink, water supply and waste-water connection. base unit: carcase height 720 mm, depth 561 mm, plinth height 20-200 mm.
RECOMMENDED_NEIGHBOURS: Dishwasher unit, drawer base units, worktop elements.
RESTRICTIONS: Cannot house an oven; not suitable for islands without plumbing.
STYLE_COMPATIBILITY: Modern handled kitchen. Also suits classic, Scandinavian and country-house designs.
SEARCH_KEYWORDS: sink cabinet, wide sink base unit, sink pull-out cabinet, plumbing cabinet.
AI_SELECTION_HINT: Select for a wide sink cabinet with additional pull-out storage. Place a base unit on its right, not a hob unit.
```

`ESUT60` (FSBD60) — 932 characters:

```
FUNCTION: Handleless sink base unit, 60 cm wide, with 1 door (fingergrip). Its sink with the drainer is 980 mm wide and reaches 396 mm past its right side, over the unit on its right.
PURPOSE: Supports a kitchen sink in a handleless kitchen, with plumbing access.
TYPICAL_PLACEMENT: Base row, within the washing zone.
REQUIREMENTS: Requires a compatible sink, water supply and waste-water connection. base unit: carcase height 720 mm, depth 561 mm, plinth height 20-200 mm.
RECOMMENDED_NEIGHBOURS: Handleless dishwasher unit, handleless drawer base units.
RESTRICTIONS: Cannot house an oven; not for islands without plumbing.
STYLE_COMPATIBILITY: Modern handleless (fingergrip) kitchen. Minimalist and premium designs.
SEARCH_KEYWORDS: handleless sink cabinet, fingergrip sink unit, grip-less sink base.
AI_SELECTION_HINT: Select for a sink in a handleless kitchen with a single door. Place a base unit on its right, not a hob unit.
```

`ESUB2A90` (FSBF2P90) — 943 characters:

```
FUNCTION: Handleless sink base unit, 90 cm wide, with 1 fixed front and 2 drawers (fingergrip). Its sink with the drainer is 980 mm wide and reaches 246 mm past its right side, over the unit on its right.
PURPOSE: Wide handleless sink cabinet with plumbing access and drawer storage.
TYPICAL_PLACEMENT: Base row, within the washing zone.
REQUIREMENTS: Requires a compatible sink, water supply and waste-water connection. base unit: carcase height 720 mm, depth 561 mm, plinth height 20-200 mm.
RECOMMENDED_NEIGHBOURS: Handleless dishwasher unit, handleless drawer base units.
RESTRICTIONS: Cannot house an oven; not for islands without plumbing.
STYLE_COMPATIBILITY: Modern handleless (fingergrip) kitchen. Minimalist and premium designs.
SEARCH_KEYWORDS: handleless sink cabinet, fingergrip sink unit, sink drawer base.
AI_SELECTION_HINT: Select for a wide handleless sink cabinet with drawers. Place a base unit on its right, not a hob unit.
```

### 2.2 Articles with two doors

**Status.** Not reported (RML-18203).

**Why.** "with 2 doors" stands for two doors one above the other (`H2TB60`, `HWR_HB600T2`) and for a pair
of doors side by side (`U2TB90`, `O2TB90`, `US2TB90`, `EU2TB90`). The door direction takes other
values for each ([3.6](#36-door-direction)); a value the article does not take is not built
([5.2](#52-doors-and-handles)).

**Changed line.** `FUNCTION`.

`H2TB60` (T2DS60) — 693 characters:

```
FUNCTION: Tall cabinet, 60 cm wide, with 2 doors one above the other and adjustable shelves.
PURPOSE: Full-height larder storage split across two door heights.
TYPICAL_PLACEMENT: Tall-unit block, at the end of a run or between other tall units.
REQUIREMENTS: tall unit: carcase height approx. 2016-2160 mm, depth 561 mm.
RECOMMENDED_NEIGHBOURS: Fridge/oven tall units, pantry tall units.
RESTRICTIONS: No appliance, sink or water installation.
STYLE_COMPATIBILITY: Modern handled kitchen. Also suits classic, Scandinavian and country-house designs.
SEARCH_KEYWORDS: tall cabinet, larder unit, pantry cabinet, two door tall unit
AI_SELECTION_HINT: Select for tall pantry storage with two doors.
```

`HWR_HB600T2` (HWR_TD600D2) — 653 characters:

```
FUNCTION: Utility-room tall unit, 60 cm wide, with 2 doors one above the other.
PURPOSE: Full-height closed storage split across two door heights.
TYPICAL_PLACEMENT: Utility / laundry room, as a tall storage unit.
REQUIREMENTS: tall unit: carcase height approx. 2016-2160 mm, depth 561 mm.
RECOMMENDED_NEIGHBOURS: Utility base and wall units, washing-machine unit.
RESTRICTIONS: No appliance or sink installation.
STYLE_COMPATIBILITY: Functional utility and laundry room. Modern and minimalist.
SEARCH_KEYWORDS: utility tall unit, laundry cupboard, two door tall unit, household cabinet
AI_SELECTION_HINT: Select for tall utility storage with two doors.
```

`U2TB90` (B2DS90) — 693 characters:

```
FUNCTION: Base cabinet, 90 cm wide, with a pair of doors side by side and adjustable shelves.
PURPOSE: Wide closed base storage for pots, pans and supplies.
TYPICAL_PLACEMENT: Base row, anywhere along the worktop.
REQUIREMENTS: base unit: carcase height 720 mm, depth 561 mm, plinth height 20-200 mm.
RECOMMENDED_NEIGHBOURS: Drawer base units, sink cabinet, corner units.
RESTRICTIONS: No appliance, sink or water installation.
STYLE_COMPATIBILITY: Modern handled kitchen. Also suits classic, Scandinavian and country-house designs.
SEARCH_KEYWORDS: base cabinet, two door base unit, wide storage cabinet, lower cabinet
AI_SELECTION_HINT: Select for wide general base storage behind two doors.
```

`O2TB90` (O2TB90) — 692 characters:

```
FUNCTION: Wall cabinet, 90 cm wide, with a pair of doors side by side and adjustable shelves.
PURPOSE: Wide wall-hung closed storage for crockery and dry goods.
TYPICAL_PLACEMENT: Wall-unit row above the worktop.
REQUIREMENTS: Wall-mounted unit; requires a load-bearing wall and suspension rail.
RECOMMENDED_NEIGHBOURS: Further wall units, extractor hood, open wall shelves.
RESTRICTIONS: Wall mounting only; not floor-standing; no appliances.
STYLE_COMPATIBILITY: Modern handled kitchen. Also suits classic, Scandinavian and country-house designs.
SEARCH_KEYWORDS: wall cabinet, two door wall unit, upper cabinet
AI_SELECTION_HINT: Select for wide wall-hung kitchen storage behind two doors.
```

`US2TB90` (BDR2DS90) — 710 characters:

```
FUNCTION: Base cabinet, 90 cm wide, with 1 drawer and a pair of doors side by side, adjustable shelves.
PURPOSE: Combines a top drawer with a wide two-door shelf compartment.
TYPICAL_PLACEMENT: Base row, anywhere along the worktop.
REQUIREMENTS: base unit: carcase height 720 mm, depth 561 mm, plinth height 20-200 mm.
RECOMMENDED_NEIGHBOURS: Drawer base units, sink cabinet, corner units.
RESTRICTIONS: No appliance, sink or water installation.
STYLE_COMPATIBILITY: Modern handled kitchen. Also suits classic, Scandinavian and country-house designs.
SEARCH_KEYWORDS: base cabinet, drawer and door unit, combined base cabinet, lower cabinet
AI_SELECTION_HINT: Select for mixed drawer and two-door base storage.
```

`EU2TB90` (FB2DS90) — 694 characters:

```
FUNCTION: Handleless base cabinet, 90 cm wide, with a pair of doors side by side and shelves (fingergrip).
PURPOSE: Wide closed base storage in a handleless kitchen.
TYPICAL_PLACEMENT: Base row, anywhere along the worktop.
REQUIREMENTS: base unit: carcase height 720 mm, depth 561 mm, plinth height 20-200 mm.
RECOMMENDED_NEIGHBOURS: Handleless drawer base units, corner units.
RESTRICTIONS: No appliance, sink or water installation.
STYLE_COMPATIBILITY: Modern handleless (fingergrip) kitchen. Minimalist and premium designs.
SEARCH_KEYWORDS: handleless base cabinet, fingergrip two door unit, grip-less base storage
AI_SELECTION_HINT: Select for wide handleless base storage behind two doors.
```

### 2.3 Flap wall cabinets

**Status.** Not reported.

**Why.** The flap fitting takes a limited range of heights and depths: a flap cabinet outside it is
not built ([5.4](#54-flap-fitting-sizes)). A flap is not built as a glass frame either
([5.6](#56-the-front-program-modern)). Glass fronts and other sizes come with wall cabinets with doors.

**Changed line.** `AI_SELECTION_HINT`.

`OSKB60` (OSKB60) — 806 characters:

```
FUNCTION: Wall cabinet, 60 cm wide, with 1 swing-up flap and shelves.
PURPOSE: Wall-hung storage with a single upward-swinging flap door.
TYPICAL_PLACEMENT: Wall-unit row above the worktop.
REQUIREMENTS: Wall-mounted unit; requires a load-bearing wall and suspension rail. Requires clearance above for the flap.
RECOMMENDED_NEIGHBOURS: Further wall units, extractor hood.
RESTRICTIONS: Wall mounting only; needs clearance above; no appliances.
STYLE_COMPATIBILITY: Modern handled kitchen. Also suits classic, Scandinavian and country-house designs.
SEARCH_KEYWORDS: swing flap wall unit, lift-up cabinet, flap door
AI_SELECTION_HINT: Select for a wall cabinet with a single swing-up flap, at the height and depth it comes with. For glass fronts or another height or depth, choose a wall cabinet with doors.
```

`OSKB90` (OSKB90) — 816 characters:

```
FUNCTION: Wall cabinet, 90 cm wide, with 1 swing-up flap and shelves.
PURPOSE: Wide wall-hung storage with a single upward-swinging flap door.
TYPICAL_PLACEMENT: Wall-unit row above the worktop.
REQUIREMENTS: Wall-mounted unit; requires a load-bearing wall and suspension rail. Requires clearance above for the flap.
RECOMMENDED_NEIGHBOURS: Further wall units, extractor hood.
RESTRICTIONS: Wall mounting only; needs clearance above; no appliances.
STYLE_COMPATIBILITY: Modern handled kitchen. Also suits classic, Scandinavian and country-house designs.
SEARCH_KEYWORDS: swing flap wall unit, lift-up cabinet, flap door
AI_SELECTION_HINT: Select for a wide wall cabinet with a single swing-up flap, at the height and depth it comes with. For glass fronts or another height or depth, choose a wall cabinet with doors.
```

`OFKB60` (OFKB60) — 837 characters:

```
FUNCTION: Wall cabinet, 60 cm wide, with 1 folding flap (two-part lift) and shelves.
PURPOSE: Wall-hung storage with a folding upward flap for easy overhead access.
TYPICAL_PLACEMENT: Wall-unit row above the worktop.
REQUIREMENTS: Wall-mounted unit; requires a load-bearing wall and suspension rail. Requires clearance above for the flap.
RECOMMENDED_NEIGHBOURS: Further wall units, extractor hood.
RESTRICTIONS: Wall mounting only; needs clearance above; no appliances.
STYLE_COMPATIBILITY: Modern handled kitchen. Also suits classic, Scandinavian and country-house designs.
SEARCH_KEYWORDS: folding flap wall unit, lift-up cabinet, bi-fold flap
AI_SELECTION_HINT: Select for a wall cabinet with a folding upward flap, at the height and depth it comes with. For glass fronts or another height or depth, choose a wall cabinet with doors.
```

`OFKB90` (OFKB90) — 822 characters:

```
FUNCTION: Wall cabinet, 90 cm wide, with 1 folding flap (two-part lift) and shelves.
PURPOSE: Wide wall-hung storage with a folding upward flap.
TYPICAL_PLACEMENT: Wall-unit row above the worktop.
REQUIREMENTS: Wall-mounted unit; requires a load-bearing wall and suspension rail. Requires clearance above for the flap.
RECOMMENDED_NEIGHBOURS: Further wall units, extractor hood.
RESTRICTIONS: Wall mounting only; needs clearance above; no appliances.
STYLE_COMPATIBILITY: Modern handled kitchen. Also suits classic, Scandinavian and country-house designs.
SEARCH_KEYWORDS: folding flap wall unit, lift-up cabinet, bi-fold flap
AI_SELECTION_HINT: Select for a wide wall cabinet with a folding upward flap, at the height and depth it comes with. For glass fronts or another height or depth, choose a wall cabinet with doors.
```

## 3. Attribute descriptions

All attributes of this chapter are in the attribute vocabulary, so the agent reads each `desc` in full
when it chooses a value.

### 3.1 Colour values

**Attributes.** The colour list shared by `mod_FrontColor`, `mod_CarcaseColor`,
`mod_CarcaseOutsideColor`, `mod_UprightColor`, `mod_CountertopColor`, `mod_PaneltopColor`,
`mod_BacksplashColor`, `mod_ToekickColor`, `mod_CeilingFillerColor`, `mod_Color` and the edge colours.

**Status.** Not reported.

**Why.** The programs are named by the kind of colour they take — "plain decors", "wood decors" —,
the colours by their name only. The kind tells the agent which program a colour needs
([3.2](#32-front-program), [3.4](#34-upright-colour-and-program)) and which colours build together
([3.3](#33-carcase-colours)). The kinds follow the library's own program switches
([5.5](#55-colours-and-programs)); the library team confirms the values the runs did not show. The
colour code stays first: `materials.md` reads it from the `desc`.

| Value | Name | `desc` in the library | Proposed `desc` |
|---|---|---|---|
| `152` | Cloudy blue | Cloudy blue (#506080) | Cloudy blue (#506080), plain decor |
| `155` | Denim blue | Denim blue (#102040) | Denim blue (#102040), plain decor |
| `160` | Olive green | Olive green (#909060) | Olive green (#909060), plain decor |
| `165` | Seaweed green | Seaweed green (#606040) | Seaweed green (#606040), plain decor |
| `178` | Light grey | Light grey (#D0C0C0) | Light grey (#D0C0C0), plain decor |
| `190` | Sunny white | Sunny white (#F0F0E0) | Sunny white (#F0F0E0), plain decor |
| `192` | Snow white | Snow white (#F0F0F0) | Snow white (#F0F0F0), plain decor |
| `199` | Jet black | Jet black (#000000) | Jet black (#000000), plain decor |
| `214` | Dark walnut | Dark walnut (#906040) | Dark walnut (#906040), wood decor |
| `215` | Walnut | Walnut (#C09070) | Walnut (#C09070), wood decor |
| `216` | Tiepolo walnut | Tiepolo walnut (#705040) | Tiepolo walnut (#705040), wood decor |
| `222` | Oak | Oak (#704020) | Oak (#704020), wood decor |
| `224` | Bijoux oak | Bijoux oak (#806050) | Bijoux oak (#806050), wood decor |
| `229` | Dark oak | Dark oak (#101010) | Dark oak (#101010), wood decor |
| `230` | Maple | Maple (#E0D0C0) | Maple (#E0D0C0), wood decor |
| `240` | Ash grey | Ash grey (#303030) | Ash grey (#303030), wood decor |
| `250` | Ponderosa pine | Ponderosa pine (#909080) | Ponderosa pine (#909080), wood decor |
| `316` | Concrete | Concrete (#808080) | Concrete (#808080), stone decor; as a front color only with Modern, on doors |
| `324` | Dark marble | Dark marble (#404040) | Dark marble (#404040), stone decor; as a front color only with Modern, on doors |
| `326` | Slate | Slate (#303030) | Slate (#303030), stone decor; as a front color only with Modern, on doors |
| `380` | Marble | Marble (#E0E0E0) | Marble (#E0E0E0), stone decor; as a front color only with Modern, on doors |

### 3.2 Front program

**Attribute.** `mod_FrontProgram` (Front program).

**Status.** Not reported.

**Why.** Modern builds doors only, in stone decors. A drawer, a pull-out or a flap with Modern is not
built ([5.6](#56-the-front-program-modern)). The agent sets Modern for glass fronts, or the library
sets it when the front colour is a stone decor.

| Value | Name | `desc` in the library | Proposed `desc` |
|---|---|---|---|
| `Modern` | Modern | Mitred frame fronts with glass filling | Mitred frame doors with glass filling, in stone decors. Drawers, pull-outs and flaps are not built with it: an article with them takes another program. |

### 3.3 Carcase colours

**Attributes.** `mod_CarcaseColor` (Carcase color), `mod_CarcaseOutsideColor` (Carcase color outside).

**Status.** Not reported.

**Why.** The visible sides of a carcase — at the end of a row — take `mod_CarcaseOutsideColor`, and
where it is not set, the front colour. A wood or stone carcase colour builds the visible sides with
the wood program, and a plain colour there is not built ([5.5](#55-colours-and-programs)). The two
program attributes are not in the attribute vocabulary, so the rule goes into the colours.

| Attribute | Name | `desc` in the library | Proposed `desc` |
|---|---|---|---|
| `mod_CarcaseColor` | Carcase color | Color of the carcase inside and outside if not visible | Color of the carcase inside and of its sides that are not visible. The visible sides take Carcase color outside: with a wood or stone decor here, set Carcase color outside to a wood or stone decor too. |
| `mod_CarcaseOutsideColor` | Carcase color outside | Outside color of the carcase | Color of the visible sides of the carcase, such as the side at the end of a row. Where it is not set, the visible sides take the front color. |

### 3.4 Upright colour and program

**Attributes.** `mod_UprightColor` (Color, group Upright) and `mod_UprightProgram` (Upright Program)
— the end and cover panels `W60H`, `W60U` and `W35O`.

**Status.** Not reported.

**Why.** The end and cover panels come with the program ModernNature. A plain colour without the
program Classic is not built; the library switches the front program with the front colour, not the
upright program with the upright colour ([5.5](#55-colours-and-programs)). The three program values
are the same for `mod_CarcaseProgram` and `mod_CarcaseOutsideProgram`; the proposed value descs fit
all three.

| Attribute or value | Name | `desc` in the library | Proposed `desc` |
|---|---|---|---|
| `mod_UprightColor` | Color | Color of the upright | Color of the end and cover panels. Set Upright Program with it: Classic for a plain decor, ModernNature or Nature for a wood or stone decor. The panels come with ModernNature. |
| `mod_UprightProgram` | Upright Program | Upright Program | How the end and cover panels are built for the kind of their color. Set it with Color. |
| `ModernNature` | ModernNature | Carcase in wooden colors horizontal | Wood and stone decors, grain horizontal. |
| `Nature` | Nature | Carcase in wooden colors vertical | Wood and stone decors, grain vertical. |
| `Classic` | Classic | Classic carcase in single colors | Plain decors. |

### 3.5 Handle design

**Attribute.** `mod_HandleDesign` (Handle design).

**Status.** Not reported.

**Why.** No handle on a handled article builds fronts without a handle and without a fingergrip. The
handleless fronts with a fingergrip are articles of their own — the handleless base units
([5.3](#53-no-handle-and-the-handleless-articles)).

| Attribute or value | Name | `desc` in the library | Proposed `desc` |
|---|---|---|---|
| `mod_HandleDesign` | Handle design | Design of a handle | Design of the handle on the fronts of a handled article. A handleless front with a fingergrip is no handle design: it comes with the handleless articles (fingergrip). |
| `10` | No handle | No handle | Fronts without a handle and without a fingergrip. For handleless fronts, choose the handleless articles (fingergrip) where the catalog has one. |

### 3.6 Door direction

**Attribute.** `mod_DoorDirectionSelection` (Door direction).

**Status.** Applied as proposed (RML-18203); the `desc` of `Automatic` keeps "Setting via
tab_DoorSettings." before the proposed text. Open: `LeftLeft` and `RightRight` are offered but not
calculated on `U2TB90` (chapter 4).

**Why.** In a row no handle is on the outside: the door at the left end is hinged on the left, the
door at the right end on the right. `Automatic` hinges every single door on the left
([5.2](#52-doors-and-handles)).

| Attribute or value | Name | `desc` in the library |
|---|---|---|
| `mod_DoorDirectionSelection` | Door direction | The side a door is hinged on, as seen from the front: the handle is on the other side, and the door opens to the hinge side. Left and Right are for single doors, also two doors one above the other; Left & Right is for a pair of doors side by side. Automatic hinges a single door on the left wherever the cabinet stands: in a row, set the door at the right end to Right, so no handle is on the outside of the row. |
| `Left` | Left | Hinged on the left, as seen from the front: the handle on the right, the door opens to the left. For single doors. |
| `Right` | Right | Hinged on the right, as seen from the front: the handle on the left, the door opens to the right. For single doors. |
| `LeftRight` | Left & Right | A pair of doors side by side: the left door hinged on the left, the right door on the right, as seen from the front; the handles meet in the middle. |
| `LeftLeft` | Left & Left | A pair of doors side by side, both hinged on the left, as seen from the front. |
| `RightRight` | Right & Right | A pair of doors side by side, both hinged on the right, as seen from the front. |
| `Automatic` | Automatic | Setting via tab_DoorSettings. The library chooses: a single door hinged on the left, a pair of doors side by side left and right — wherever the cabinet stands in a row. |

### 3.7 Handle position type

**Attribute.** `mod_HandlePosType` (Handle position type).

**Status.** Applied (RML-18203), except `14`: its `desc` names "the place of 03"; as the frame-door
value of `04`, it is the place of `13`. Not reported.

**Why.** The values read like a door direction — "Door vertical rotation left / right" — but place
and turn the handle only ([5.2](#52-doors-and-handles)).

| Value | Name | `desc` in the library | Proposed `desc` |
|---|---|---|---|
| `14` | Position type 14 | Door: vertical handle at the edge opposite the hinge, turned to the right — the place of 03, the handle turned by 180°, for a frame door with a 75 mm frame. | Door: vertical handle at the edge opposite the hinge, turned to the right — the place of 13, the handle turned by 180°, for a frame door with a 75 mm frame. |

In the library, as proposed:

| Attribute or value | Name | `desc` in the library |
|---|---|---|
| `mod_HandlePosType` | Handle position type | Where a handle sits on a front and how it is turned. It does not change the side a door opens to: a handle at the edge of a door sits opposite its hinge, which Door direction sets. |
| `03` | Position type 03 | Door: vertical handle at the edge opposite the hinge, turned to the left. |
| `04` | Position type 04 | Door: vertical handle at the edge opposite the hinge, turned to the right — the place of 03, the handle turned by 180°. |
| `05` | Position type 05 | Door: vertical handle in the middle of the door's width, turned to the left. |
| `06` | Position type 06 | Door: vertical handle in the middle of the door's width, turned to the right — the place of 05, the handle turned by 180°. |
| `03.1` – `06.1` | Position type 03.1 – 06.1 | as `03` – `06`, followed by "; the top of the handle at the handle line." |
| `13` | Position type 13 | Door: vertical handle at the edge opposite the hinge, turned to the left, for a frame door with a 75 mm frame. |

### 3.8 Sink

**Attribute.** `mod_SinkId` (Article code of the sink).

**Status.** Not reported.

**Why.** Every sink unit comes with `Axia_Grey_L`, whose `desc` is its code: nothing says that its
drainer is on the right and reaches over the unit on the right ([5.1](#51-sink-and-drainer)). The
drainer side of the basin-right values follows from their names, the widths of the Axis, Dinas and
Metra sinks are not known (chapter 4).

| Value | Name | `desc` in the library | Proposed `desc` |
|---|---|---|---|
| `Axia_Grey_L` | Axia color grey basin left | Axia_Grey_L | Blanco Axia sink in grey, 980 mm wide with the drainer: basin on the left, drainer on the right. |
| `Axia_Grey_R` | Axia color grey basin right | Axia_Grey_R | Blanco Axia sink in grey, 980 mm wide with the drainer: basin on the right, drainer on the left. |
| `Axia_White_L` | Axia color white basin left | Axia_White_L | Blanco Axia sink in white, 980 mm wide with the drainer: basin on the left, drainer on the right. |
| `Axia_White_R` | Axia color white basin right | Axia_White_R | Blanco Axia sink in white, 980 mm wide with the drainer: basin on the right, drainer on the left. |
| `Axia_Anthrazit_L` | Axia color anthrazit basin left | Axia_Anthrazit_L | Blanco Axia sink in anthracite, 980 mm wide with the drainer: basin on the left, drainer on the right. |
| `Axia_Anthrazit_R` | Axia color anthrazit basin right | Axia_Anthrazit_R | Blanco Axia sink in anthracite, 980 mm wide with the drainer: basin on the right, drainer on the left. |
| `Axis_L` | Axis basin left | Axis_L | Blanco Axis sink: basin on the left, drainer on the right. |
| `Axis_R` | Axis basin right | Axis_R | Blanco Axis sink: basin on the right, drainer on the left. |
| `Dinas_L` | Dinas basin left | Dinas_L | Blanco Dinas sink: basin on the left, drainer on the right. |
| `Dinas_R` | Dinas basin right | Dinas_R | Blanco Dinas sink: basin on the right, drainer on the left. |
| `Metra_R` | Metra basing right | Metra_R | Blanco Metra sink: basin on the right, drainer on the left. |

## 4. Beyond the descriptions

Changes to the library's logic and data the descriptions cannot replace:

| Change | Why | Sections |
|---|---|---|
| The size ranges of the flap fittings in `tab_FlipliftSettings`, per fitting and width | the flap wall cabinets could then name the sizes they take | 2.3 |
| Entries for `LeftLeft` and `RightRight` in `tab_DoorSettings` on the articles with a pair of doors, or descs that name the articles taking them | offered, but not calculated on `U2TB90` | 3.6 |
| Switch `mod_UprightProgram` with `mod_UprightColor`, as the front program with the front colour | optional: the agent no longer sets the program, and the `desc` of `mod_UprightColor` keeps its first sentence | 3.4 |
| Switch `mod_CarcaseOutsideProgram` with `mod_CarcaseOutsideColor` | plain visible sides on a wood or stone carcase build only then | 3.3 |
| Entries for `Fliplift` and `Drawer` with `ModernFrame01` in `tab_PanelWoodFrameConstruction` | only if the library wants glass flaps and glass drawer fronts | 3.2 |

The library team confirms:

- the kind of the colour values the runs did not show (3.1), and whether Nature takes stone decors (3.4);
- the drainer side of the basin-right sinks, whether the sink units take them, and the widths of the
  Axis, Dinas and Metra sinks (3.8) — with a basin-right sink the drainer reaches over the unit on the
  left, and the sink unit descriptions (2.1) name the side by the sink;
- whether `mod_CarcaseOutsideProgram` Classic builds plain visible sides on a wood carcase today (3.3).

## 5. How the library behaves

### 5.1 Sink and drainer

All five sink units come with `mod_SinkId` `Axia_Grey_L` (Blanco), basin on the left, drainer on the
right, 980 mm wide with the drainer. The outlines of the root modules in the plan contexts of the
stored runs overlap the root module at the next `rowIndex`, the unit on the right:

| Articles | Unit width | Outline along the row | Reaches past the right side |
|---|---|---|---|
| `SUT60`, `SUBA60`, `ESUT60` | 600 mm | 995.75 mm | 396 mm |
| `SUB2A90`, `ESUB2A90` | 900 mm | 1145.75 mm | 246 mm |

`mcp-test-2026-10-17_13-28-41`: gpt-6-astra 30 (`edit-swap-hob-unit`): the swapped sink's top reaches
396 mm over the hob unit on its right.

### 5.2 Doors and handles

Checked on the bo-test planner on 2026-10-17, without a model, through the MCP tools:

| Articles | Doors | `Automatic` resolves to | Calculated | Not calculated (Error 14019) |
|---|---|---|---|---|
| `KS_HT600K`, `HEST60`, `HEMT60`, `HEET60`, `UTB60`, `SB_UB600` | one door | `Left` | `Left`, `Right` (set on `KS_HT600K` and `SB_UB600`) | not checked |
| `H2TB60` | two doors, one above the other | `Left` on both | `Right` on both | `LeftRight` |
| `U2TB90` | a pair of doors side by side | `LeftRight` | `LeftRight` | `Left`, `Right`, `LeftLeft`, `RightRight` |

A value an article does not take fails with "Error 14019: Could not find entry in tab_DoorSettings",
and the root module is not built. By their door modules in the article list, `H2TB60` and
`HWR_HB600T2` have two `mf_Door` on 60 cm, one above the other; `U2TB90`, `O2TB90`, `US2TB90` and
`EU2TB90` one `mf_Door` on 90 cm, a pair.

`mod_HandlePosType` on a single door of `KS_HT600K`, hinged left and hinged right: `03` and `04` both
put a vertical handle at the edge opposite the hinge, at the same place, turned by 180° against each
other; `05` and `06` put it in the middle of the door's width. None changes the hinge side.

### 5.3 No handle and the handleless articles

The handleless articles come with `mod_HandleDesign` `10`, `mod_FingergripType` `Wood` and
`mod_CreateFingergrip` `True` (`article.json`): fronts with a wooden fingergrip. A handled article set
to `mod_HandleDesign` `10` keeps `mod_CreateFingergrip` `False` and `mod_FingergripType` `None`
(order data of `mcp-test-2026-10-17_13-28-41` gpt-6-astra 52). The catalog has handleless variants of
base units only — sink, storage, corner and hob units.

`mcp-test-2026-10-17_13-28-41`: gpt-6-astra 52 and `mcp-test-2026-10-16_19-30-19`: gpt-6.1-sol 50
(`kitchen-conversation`, turn 5): `mod_HandleDesign` `10` on the handled articles; gpt-6.1-sol answers
"No fingergrip profiles were added—the existing units do not support that attribute".

### 5.4 Flap fitting sizes

| Article | `mod_Height` × `mod_Depth` | Built | Runs |
|---|---|---|---|
| `OSKB60`, `OSKB90`, `OFKB60`, `OFKB90` | 720 × 350, as they come | yes | every run that plans them in their own size |
| `OSKB90` | 360 × 561 | no: "Error 14023: … tab_FlipliftSettings … SHF - 324 - 862 - 533 - Handle" | `mcp-test-2026-10-16_19-30-19` gpt-6.1-sol 48, `mcp-test-2026-10-17_13-28-41` gpt-6-astra 50 |
| `OSKB90` | 300 × 561 | no: "… SHF - 264 - 862 - 533 - Handle" | `mcp-test-2026-10-17_09-31-13` gpt-6-astra 48 |
| `O2TB90` (doors) | 360 × 561 | yes | `mcp-test-2026-10-17_13-28-41` gpt-6-astra 50, the `exchange-root-module` |

Both failing sizes change the height and the depth; which of the two the fitting does not take is
not known.

### 5.5 Colours and programs

**The kinds.** In the stored runs the library switched the front program to Classic for 160 and 178,
to Nature for 222 and 229, to Modern for 326, and the carcase program to ModernNature for 215, 230,
240 and 326; the stone decors 316, 324, 326 and 380 come as fronts only with Modern (D59). The
calculation errors call a plain colour `NoGrain`, a wood or stone decor `Grain`. The value numbers
follow the kinds: 1xx plain, 2xx wood, 3xx stone.

**End and cover panels** — "Error 14034: Could not find entry in tab_GrainDirectionSettings for
input values: part_FinishPanel - Upright - Horizontal - NoGrain - …":

| `mod_UprightColor` | `mod_UprightProgram` | Built | Runs |
|---|---|---|---|
| plain (192, 190) | not set | no | `mcp-test-2026-10-16_19-30-19` gpt-6.1-sol 50 (`W60U`, `W60H`, `W35O`); `mcp-test-2026-10-17_13-28-41` gpt-6-astra 52 and 53 |
| plain (192) | Classic | yes | `mcp-test-2026-10-17_13-28-41` gpt-6-astra 52, the second create of turn 1 |
| wood (222) | Nature | yes | `mcp-test-2026-10-17_13-28-41` gpt-6-astra 52 turn 4; `mcp-test-2026-10-17_09-31-13` gpt-6-astra 50 turn 4 |
| wood (240) | Classic | yes | `mcp-test-2026-10-17_13-28-41` gpt-6-astra 52 turn 7 |

**Visible carcase sides** — "Error 14034: … part_Sidepanelleft - TallUnitAppliance - Horizontal -
NoGrain - 2100 - 561", alike for base and wall units. Where `mod_CarcaseOutsideColor` is not set, it
is the front colour (order data of `mcp-test-2026-10-16_19-30-19` gpt-6.1-sol 46:
`mod_CarcaseOutsideColor` 160, the front colour). A wood or stone `mod_CarcaseColor` switches
`mod_CarcaseProgram` to ModernNature, and the visible sides are built with it.

| Front | `mod_CarcaseColor` | `mod_CarcaseOutsideColor` | Visible sides built | Runs |
|---|---|---|---|---|
| plain (160, 192) | wood (230, 215, 229) | not set: the front colour | no | `mcp-test-2026-10-16_19-30-19` gpt-6.1-sol 46 (`HK260`, `USTB60`, `UTB60`); `mcp-test-2026-10-17_10-50-12` mistral-large-latest 50 (base, wall and tall units) |
| plain (160) | wood (224, 215) | the same wood | yes | `mcp-test-2026-10-17_09-31-13` gpt-6-astra 46; `mcp-test-2026-10-17_13-28-41` gpt-6-astra 48 |
| wood (229, 240) | plain (178, 190) | the front wood | yes | `mcp-test-2026-10-16_19-30-19` gpt-6.1-sol 45; `mcp-test-2026-10-17_09-31-13` gpt-6-astra 45 |

### 5.6 The front program Modern

"Error 14036: Could not find entry in tab_PanelWoodFrameConstruction for input values: Fliplift -
ModernFrame01 - Grain - Grain - None" for flaps, "Drawer - ModernFrame01 - NoGrain - NoGrain - Glass"
for drawers and pull-outs:

| Fronts with Modern | Built | Runs |
|---|---|---|
| doors (`OTB60`) | yes; the library sets Concrete 316 in place of Sunny white 190 | `mcp-test-2026-10-17_13-28-41` gpt-6-astra 51 |
| flaps (`OFKB60`), Modern set | no | `mcp-test-2026-10-16_19-30-19` gpt-6.1-sol 49 |
| flaps (`OSKB60`, `OSKB90`), Slate 326 set as front colour, the library switched to Modern | no | `mcp-test-2026-10-17_10-50-12` mistral-large-latest 48 |
| drawers and pull-outs (`US2A60`, `UKS2A60`, `HTS2AB60`) | no; the doors of the same calls are built | `mcp-test-2026-10-17_10-50-12` mistral-large-latest 50, attempt 1, turn 5 |

The kitchen catalog has no wall cabinet with glass fronts; the glass display cabinets `SM_WT300S` and
`SM_HT600S` are living-room articles.

## 6. The backlog items

The items of [`library-issues.md`](../../.agents/backlog/library-issues.md) and the sections that
address them. "Solved" means that with the descriptions the agent builds at the first attempt what it
wants, without a call the library cannot calculate.

| Item | Solved by the descriptions | Sections | Test |
|---|---|---|---|
| [60](../../.agents/backlog/library-issues.md#60-the-sink-top-of-a-sink-unit-reaches-past-the-row-or-over-the-hob) sink top over the row end or the hob | yes | 2.1, 3.8 | `edit-swap-hob-unit`, `image-kitchen-left-wall` |
| [61](../../.agents/backlog/library-issues.md#61-handleless-fronts-done-with-a-handle-attribute) handleless fronts | yes | 3.5 | `kitchen-conversation` turn 5 |
| [64](../../.agents/backlog/library-issues.md#64-flip-lift-wall-cabinets-with-sizes-the-library-cannot-calculate) flip-lift sizes | yes, with the sizes from the library | 2.3 | `image-planning-right-wall` |
| [69](../../.agents/backlog/library-issues.md#69-end-panels-with-a-plain-upright-colour-the-library-cannot-calculate) end panels in a plain colour | yes | 3.1, 3.4 | `kitchen-conversation` turn 1, `image-kitchen-back-right-corner` |
| [70](../../.agents/backlog/library-issues.md#70-carcase-side-panels-with-a-plain-outside-colour-the-library-cannot-calculate) visible sides in a plain colour | partly: plain visible sides on a wood carcase need the library (chapter 4) | 3.1, 3.3 | `image-kitchen-left-wall` |
| [71](../../.agents/backlog/library-issues.md#71-folding-flap-wall-cabinets-with-glass-fronts-the-library-cannot-calculate) glass flaps | partly: the agent builds glass wall cabinets with doors; glass flaps need the library (chapter 4) | 2.3, 3.1, 3.2 | `image-only-no-text` |
| [76](../../.agents/backlog/library-issues.md#76-articles-with-two-doors-that-do-not-say-how-their-doors-stand) two doors | yes | 2.2, 3.6, 3.7 | `wardrobe-door-hinges`, `wardrobe-extend-door-hinge` |
