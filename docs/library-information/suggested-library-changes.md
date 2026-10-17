# Suggested library changes

> **Type**: Living reference — the description texts suggested to the library, applied or not
> **Domain**: the `desc` properties of the article list and the master data
> **Issues**: why each text is needed, the evidence and what the library still has to do are in
> [`.agents/backlog/library-issues.md`](../../.agents/backlog/library-issues.md)

The texts to paste into the library: the complete description of every article and the `desc` of
every attribute and value. An article description holds at most 1000 characters; the count is in the
heading of each. Every text stays here once the library carries it, with its status.

## Overview

| Section | Articles or attributes | Status |
|---|---|---|
| [1.1 Sink base units](#11-sink-base-units) | `SUT60`, `SUBA60`, `SUB2A90`, `ESUT60`, `ESUB2A90` | applied |
| [1.2 Articles with two doors](#12-articles-with-two-doors) | `H2TB60`, `HWR_HB600T2`, `U2TB90`, `O2TB90`, `US2TB90`, `EU2TB90` | applied |
| [1.3 Flap wall cabinets](#13-flap-wall-cabinets) | `OSKB60`, `OSKB90`, `OFKB60`, `OFKB90` | applied |
| [2.1 Colour values](#21-colour-values) | the colour list of `mod_FrontColor`, `mod_CarcaseColor`, `mod_UprightColor` and the other colour attributes | open |
| [2.2 Front program](#22-front-program) | `mod_FrontProgram` | open |
| [2.3 Carcase colours](#23-carcase-colours) | `mod_CarcaseColor`, `mod_CarcaseOutsideColor` | open |
| [2.4 Upright colour and program](#24-upright-colour-and-program) | `mod_UprightColor`, `mod_UprightProgram` | open |
| [2.5 Handle design](#25-handle-design) | `mod_HandleDesign` | open |
| [2.6 Door direction](#26-door-direction) | `mod_DoorDirectionSelection` | applied |
| [2.7 Handle position type](#27-handle-position-type) | `mod_HandlePosType` | applied, except `14` |
| [2.8 Sink](#28-sink) | `mod_SinkId` | open |

## 1. Article descriptions

Each article's complete description, one line per section.

### 1.1 Sink base units

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

### 1.2 Articles with two doors

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

### 1.3 Flap wall cabinets

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

## 2. Attribute descriptions

### 2.1 Colour values

**Attributes.** The colour list shared by `mod_FrontColor`, `mod_CarcaseColor`,
`mod_CarcaseOutsideColor`, `mod_UprightColor`, `mod_CountertopColor`, `mod_PaneltopColor`,
`mod_BacksplashColor`, `mod_ToekickColor`, `mod_CeilingFillerColor`, `mod_Color` and the edge colours.

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

### 2.2 Front program

**Attribute.** `mod_FrontProgram` (Front program).

| Value | Name | `desc` in the library | Proposed `desc` |
|---|---|---|---|
| `Modern` | Modern | Mitred frame fronts with glass filling | Mitred frame doors with glass filling, in stone decors. Drawers, pull-outs and flaps are not built with it: an article with them takes another program. |

### 2.3 Carcase colours

**Attributes.** `mod_CarcaseColor` (Carcase color), `mod_CarcaseOutsideColor` (Carcase color outside).

| Attribute | Name | `desc` in the library | Proposed `desc` |
|---|---|---|---|
| `mod_CarcaseColor` | Carcase color | Color of the carcase inside and outside if not visible | Color of the carcase inside and of its sides that are not visible. The visible sides take Carcase color outside: with a wood or stone decor here, set Carcase color outside to a wood or stone decor too. |
| `mod_CarcaseOutsideColor` | Carcase color outside | Outside color of the carcase | Color of the visible sides of the carcase, such as the side at the end of a row. Where it is not set, the visible sides take the front color. |

### 2.4 Upright colour and program

**Attributes.** `mod_UprightColor` (Color, group Upright) and `mod_UprightProgram` (Upright Program)
— the end and cover panels `W60H`, `W60U` and `W35O`. The three program values are the same for
`mod_CarcaseProgram` and `mod_CarcaseOutsideProgram`; the proposed value descs fit all three.

| Attribute or value | Name | `desc` in the library | Proposed `desc` |
|---|---|---|---|
| `mod_UprightColor` | Color | Color of the upright | Color of the end and cover panels. Set Upright Program with it: Classic for a plain decor, ModernNature or Nature for a wood or stone decor. The panels come with ModernNature. |
| `mod_UprightProgram` | Upright Program | Upright Program | How the end and cover panels are built for the kind of their color. Set it with Color. |
| `ModernNature` | ModernNature | Carcase in wooden colors horizontal | Wood and stone decors, grain horizontal. |
| `Nature` | Nature | Carcase in wooden colors vertical | Wood and stone decors, grain vertical. |
| `Classic` | Classic | Classic carcase in single colors | Plain decors. |

### 2.5 Handle design

**Attribute.** `mod_HandleDesign` (Handle design).

| Attribute or value | Name | `desc` in the library | Proposed `desc` |
|---|---|---|---|
| `mod_HandleDesign` | Handle design | Design of a handle | Design of the handle on the fronts of a handled article. A handleless front with a fingergrip is no handle design: it comes with the handleless articles (fingergrip). |
| `10` | No handle | No handle | Fronts without a handle and without a fingergrip. For handleless fronts, choose the handleless articles (fingergrip) where the catalog has one. |

### 2.6 Door direction

**Attribute.** `mod_DoorDirectionSelection` (Door direction).

| Attribute or value | Name | `desc` in the library |
|---|---|---|
| `mod_DoorDirectionSelection` | Door direction | The side a door is hinged on, as seen from the front: the handle is on the other side, and the door opens to the hinge side. Left and Right are for single doors, also two doors one above the other; Left & Right is for a pair of doors side by side. Automatic hinges a single door on the left wherever the cabinet stands: in a row, set the door at the right end to Right, so no handle is on the outside of the row. |
| `Left` | Left | Hinged on the left, as seen from the front: the handle on the right, the door opens to the left. For single doors. |
| `Right` | Right | Hinged on the right, as seen from the front: the handle on the left, the door opens to the right. For single doors. |
| `LeftRight` | Left & Right | A pair of doors side by side: the left door hinged on the left, the right door on the right, as seen from the front; the handles meet in the middle. |
| `LeftLeft` | Left & Left | A pair of doors side by side, both hinged on the left, as seen from the front. |
| `RightRight` | Right & Right | A pair of doors side by side, both hinged on the right, as seen from the front. |
| `Automatic` | Automatic | Setting via tab_DoorSettings. The library chooses: a single door hinged on the left, a pair of doors side by side left and right — wherever the cabinet stands in a row. |

### 2.7 Handle position type

**Attribute.** `mod_HandlePosType` (Handle position type).

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

### 2.8 Sink

**Attribute.** `mod_SinkId` (Article code of the sink).

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
