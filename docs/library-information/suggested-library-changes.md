# Suggested library changes

> **Type**: Living reference — the description texts suggested to the library, applied or not
> **Domain**: the `desc` properties of the article list and the master data
> **Issues**: why each text is needed, the evidence and what the library still has to do are in
> [`.agents/backlog/library-issues.md`](../../.agents/backlog/library-issues.md)

The texts to paste into the library: the complete description of every article and the `desc` of
every attribute and value. An article description holds at most 1000 characters; the count is in the
heading of each. Every text stays here once the library carries it, with its status.

Statuses compare the texts with the Furniture_Smith backend `HI_PRE_Roomle_Milestone_2`, in English:
the [article list](article.json) and [master data](master-data.json), plus the unfiltered backend
article list for `AdjShelves` (a sub-article excluded from `article.json`). Applied means the library
carries the description; it does not mean the underlying calculation issue is resolved.

## Overview

| Section | Articles or attributes | Status |
|---|---|---|
| [1.1 Sink base units](#11-sink-base-units) | `SUT60`, `SUBA60`, `SUB2A90`, `ESUT60`, `ESUB2A90` | applied |
| [1.2 Articles with two doors](#12-articles-with-two-doors) | `H2TB60`, `HWR_HB600T2`, `U2TB90`, `O2TB90`, `US2TB90`, `EU2TB90` | applied |
| [1.3 Flap wall cabinets](#13-flap-wall-cabinets) | `OSKB60`, `OSKB90`, `OFKB60`, `OFKB90` | applied |
| [1.4 Wall units with a single door](#14-wall-units-with-a-single-door) | `OTB30`, `OTB45`, `OTB60` | applied |
| [1.5 Width-dependent tall-unit doors](#15-width-dependent-tall-unit-doors) | `HTB60` | applied |
| [1.6 Adjustable shelves](#16-adjustable-shelves) | `AdjShelves` | applied |
| [1.7 Tall oven housing](#17-tall-oven-housing) | `HOTS2AB60` | applied |
| [1.8 Island back panel](#18-island-back-panel) | `RWV` | applied |
| [2.1 Colour values](#21-colour-values) | the colour list of `mod_FrontColor`, `mod_CarcaseColor`, `mod_UprightColor` and the other colour attributes | open |
| [2.2 Front program](#22-front-program) | `mod_FrontProgram` | Modern applied; Tradition sequencing proposed |
| [2.3 Carcase colours](#23-carcase-colours) | `mod_CarcaseColor`, `mod_CarcaseOutsideColor` | applied |
| [2.4 Upright colour and program](#24-upright-colour-and-program) | `mod_UprightColor`, `mod_UprightProgram` | applied; the program values of `mod_CarcaseProgram` and `mod_CarcaseOutsideProgram` keep their old descs |
| [2.5 Handle design](#25-handle-design) | `mod_HandleDesign` | applied |
| [2.6 Door direction](#26-door-direction) | `mod_DoorDirectionSelection` | applied; resize guidance open |
| [2.7 Handle position type](#27-handle-position-type) | `mod_HandlePosType` | applied |
| [2.8 Sink](#28-sink) | `mod_SinkId` | applied; the desc of `Axia_Anthrazit_R` carries the pasted table row |
| [2.9 Width](#29-width) | `mod_Width` | applied |
| [2.10 Backsplash](#210-backsplash) | `mod_CreateBacksplash` | applied; result-field wording needs correction |
| [2.11 Shelf descriptor](#211-shelf-descriptor) | `mod_ShelfadjDescriptor` | text applied; actual format and example open |
| [2.12 Oven article codes](#212-oven-article-codes) | `mod_OvenId1`, `mod_OvenId2`, `mod_OvenId3` | applied |
| [2.13 Island back panel length](#213-island-back-panel-length) | `mod_IslandBackwallWidth` | applied |

## 1. Article descriptions

Each article's complete description, one line per section.

### 1.1 Sink base units

**Status.** Applied verbatim for all five units (checked 2026-10-28 against the article list).

**Changed lines.** `FUNCTION` names the sink each unit comes with and how far its drainer reaches
over the neighbouring unit; `AI_SELECTION_HINT` gives the rule for every other sink: the drainer is
opposite the basin, an `_L` sink reaches over the unit on the right, an `_R` sink over the unit on
the left. `PURPOSE`, `REQUIREMENTS`, `RESTRICTIONS`, `STYLE_COMPATIBILITY` and `SEARCH_KEYWORDS`
are shortened to stay within 1000 characters. When the library changes the sink a unit comes with,
its `FUNCTION` line follows it. The reaches are measured on the planner
([library issue 21](../../.agents/backlog/library-issues.md#21-the-sink-descriptions-a-value-desc-with-its-pasted-table-row-and-what-none-builds)).

`SUT60` (SBD60) — 969 characters:

```
FUNCTION: Sink base unit, 60 cm wide, with 1 hinged door. Its sink, Blanco Metra with the basin on the right, reaches 410 mm over the unit on its left with its drainer.
PURPOSE: Supports a kitchen sink and gives access to the plumbing below.
TYPICAL_PLACEMENT: Base row, within the washing zone.
REQUIREMENTS: Water supply and waste-water connection. Base unit: carcase height 720 mm, depth 561 mm, plinth height 20-200 mm.
RECOMMENDED_NEIGHBOURS: Dishwasher unit, drawer base units, worktop elements.
RESTRICTIONS: Cannot house an oven; not for islands without plumbing.
STYLE_COMPATIBILITY: Modern handled kitchen; also classic, Scandinavian and country-house designs.
SEARCH_KEYWORDS: sink cabinet, sink base unit, wash basin cabinet.
AI_SELECTION_HINT: Select when the user requests a sink or washing area. The drainer is opposite the basin: an _L sink reaches over the unit on its right, an _R sink over the unit on its left; put a base unit there, not a hob unit.
```

`SUBA60` (SBFP60) — 989 characters:

```
FUNCTION: Sink base unit, 60 cm wide, with 1 fixed front and 1 pull-out. Its sink, Blanco Axia with the basin on the left, reaches 396 mm over the unit on its right with its drainer.
PURPOSE: Supports a sink while offering a lower pull-out for storage.
TYPICAL_PLACEMENT: Base row, within the washing zone.
REQUIREMENTS: Water supply and waste-water connection. Base unit: carcase height 720 mm, depth 561 mm, plinth height 20-200 mm.
RECOMMENDED_NEIGHBOURS: Dishwasher unit, drawer base units, worktop elements.
RESTRICTIONS: Cannot house an oven; not for islands without plumbing.
STYLE_COMPATIBILITY: Modern handled kitchen; also classic, Scandinavian and country-house designs.
SEARCH_KEYWORDS: sink cabinet, sink base unit, pull-out sink unit.
AI_SELECTION_HINT: Select for a sink cabinet that also offers a storage pull-out. The drainer is opposite the basin: an _L sink reaches over the unit on its right, an _R sink over the unit on its left; put a base unit there, not a hob unit.
```

`SUB2A90` (SBF2P90) — 997 characters:

```
FUNCTION: Sink base unit, 90 cm wide, with 1 fixed front and 2 pull-outs. Its sink, Blanco Axia with the basin on the left, reaches 246 mm over the unit on its right with its drainer.
PURPOSE: Wide sink cabinet with plumbing access and two pull-outs.
TYPICAL_PLACEMENT: Base row, within the washing zone.
REQUIREMENTS: Water supply and waste-water connection. Base unit: carcase height 720 mm, depth 561 mm, plinth height 20-200 mm.
RECOMMENDED_NEIGHBOURS: Dishwasher unit, drawer base units, worktop elements.
RESTRICTIONS: Cannot house an oven; not for islands without plumbing.
STYLE_COMPATIBILITY: Modern handled kitchen; also classic, Scandinavian and country-house designs.
SEARCH_KEYWORDS: sink cabinet, wide sink base unit, sink pull-out cabinet.
AI_SELECTION_HINT: Select for a wide sink cabinet with additional pull-out storage. The drainer is opposite the basin: an _L sink reaches over the unit on its right, an _R sink over the unit on its left; put a base unit there, not a hob unit.
```

`ESUT60` (FSBD60) — 988 characters:

```
FUNCTION: Handleless sink base unit, 60 cm wide, with 1 door (fingergrip). Its sink, Blanco Axia with the basin on the left, reaches 396 mm over the unit on its right with its drainer.
PURPOSE: Supports a kitchen sink in a handleless kitchen, with plumbing access.
TYPICAL_PLACEMENT: Base row, within the washing zone.
REQUIREMENTS: Water supply and waste-water connection. Base unit: carcase height 720 mm, depth 561 mm, plinth height 20-200 mm.
RECOMMENDED_NEIGHBOURS: Handleless dishwasher unit, handleless drawer base units.
RESTRICTIONS: Cannot house an oven; not for islands without plumbing.
STYLE_COMPATIBILITY: Modern handleless (fingergrip), minimalist and premium kitchens.
SEARCH_KEYWORDS: handleless sink cabinet, fingergrip sink unit.
AI_SELECTION_HINT: Select for a sink in a handleless kitchen with a single door. The drainer is opposite the basin: an _L sink reaches over the unit on its right, an _R sink over the unit on its left; put a base unit there, not a hob unit.
```

`ESUB2A90` (FSBF2P90) — 995 characters:

```
FUNCTION: Handleless sink base unit, 90 cm wide, with 1 fixed front and 2 drawers (fingergrip). Its sink, Blanco Axia with the basin on the left, reaches 246 mm over the unit on its right with its drainer.
PURPOSE: Wide handleless sink cabinet with plumbing access and drawers.
TYPICAL_PLACEMENT: Base row, within the washing zone.
REQUIREMENTS: Water supply and waste-water connection. Base unit: carcase height 720 mm, depth 561 mm, plinth height 20-200 mm.
RECOMMENDED_NEIGHBOURS: Handleless dishwasher unit, handleless drawer base units.
RESTRICTIONS: Cannot house an oven; not for islands without plumbing.
STYLE_COMPATIBILITY: Modern handleless (fingergrip), minimalist and premium kitchens.
SEARCH_KEYWORDS: handleless sink cabinet, fingergrip sink unit.
AI_SELECTION_HINT: Select for a wide handleless sink cabinet with drawers. The drainer is opposite the basin: an _L sink reaches over the unit on its right, an _R sink over the unit on its left; put a base unit there, not a hob unit.
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

### 1.4 Wall units with a single door

**Status.** Applied verbatim for all three articles.

**Changed line.** `AI_SELECTION_HINT`.

`OTB30` (OTB30) — 793 characters:

```
FUNCTION: Wall cabinet, 30 cm wide, with 1 door and adjustable shelves.
PURPOSE: Wall-hung closed storage for crockery, glasses and dry goods.
TYPICAL_PLACEMENT: Wall-unit row above the worktop.
REQUIREMENTS: Wall-mounted unit; requires a load-bearing wall and suspension rail.
RECOMMENDED_NEIGHBOURS: Further wall units, extractor hood, open wall shelves.
RESTRICTIONS: Wall mounting only; not floor-standing; no appliances.
STYLE_COMPATIBILITY: Modern handled kitchen. Also suits classic, Scandinavian and country-house designs.
SEARCH_KEYWORDS: wall cabinet, wall unit, upper cabinet, door wall unit
AI_SELECTION_HINT: Select for a narrow wall-hung kitchen cabinet behind a single door, at the width it comes with. For a wider cabinet, choose one with a pair of doors or two narrower units.
```

`OTB45` (OTB45) — 805 characters:

```
FUNCTION: Wall cabinet, 45 cm wide, with 1 door and adjustable shelves.
PURPOSE: Wall-hung closed storage for crockery, glasses and dry goods.
TYPICAL_PLACEMENT: Wall-unit row above the worktop.
REQUIREMENTS: Wall-mounted unit; requires a load-bearing wall and suspension rail.
RECOMMENDED_NEIGHBOURS: Further wall units, extractor hood, open wall shelves.
RESTRICTIONS: Wall mounting only; not floor-standing; no appliances.
STYLE_COMPATIBILITY: Modern handled kitchen. Also suits classic, Scandinavian and country-house designs.
SEARCH_KEYWORDS: wall cabinet, wall unit, upper cabinet, door wall unit, oberschrank
AI_SELECTION_HINT: Select for a 45 cm wall-hung kitchen cabinet behind a single door, at the width it comes with. For a wider cabinet, choose one with a pair of doors or two narrower units.
```

`OTB60` (OTB60) — 795 characters:

```
FUNCTION: Wall cabinet, 60 cm wide, with 1 door and adjustable shelves.
PURPOSE: Wall-hung closed storage for crockery, glasses and dry goods.
TYPICAL_PLACEMENT: Wall-unit row above the worktop.
REQUIREMENTS: Wall-mounted unit; requires a load-bearing wall and suspension rail.
RECOMMENDED_NEIGHBOURS: Further wall units, extractor hood, open wall shelves.
RESTRICTIONS: Wall mounting only; not floor-standing; no appliances.
STYLE_COMPATIBILITY: Modern handled kitchen. Also suits classic, Scandinavian and country-house designs.
SEARCH_KEYWORDS: wall cabinet, wall unit, upper cabinet, door wall unit
AI_SELECTION_HINT: Select for a standard wall-hung kitchen cabinet behind a single door, at the width it comes with. For a wider cabinet, choose one with a pair of doors or two narrower units.
```

### 1.5 Width-dependent tall-unit doors

**Status.** Applied verbatim. The text states the verified 600 and 900 mm configurations;
it does not infer a transition width or supported intermediate widths.

`HTB60` (TDS60) — 885 characters:

```
FUNCTION: Tall cabinet with adjustable shelves, one door at its nominal width of 600 mm and two doors side by side at 900 mm.
PURPOSE: Full-height pantry / larder storage for food and supplies.
TYPICAL_PLACEMENT: Tall-unit block, at the end of a run or between other tall units.
REQUIREMENTS: Tall unit: carcase height approx. 2016-2160 mm, depth 561 mm.
RECOMMENDED_NEIGHBOURS: Fridge/oven tall units, pantry tall units.
RESTRICTIONS: No appliance, sink or water installation.
STYLE_COMPATIBILITY: Modern handled kitchen. Also suits classic, Scandinavian and country-house designs.
SEARCH_KEYWORDS: tall cabinet, larder unit, pantry cabinet, food storage cupboard.
AI_SELECTION_HINT: Select for tall closed pantry storage. At 900 mm set Door direction to Automatic or Left & Right; a retained Left or Right is a single-door setting and cannot calculate this paired-door configuration.
```

### 1.6 Adjustable shelves

**Status.** Applied verbatim in the unfiltered backend article list. A cabinet described with
adjustable shelves renders this set while no fitting fills its interior, so adding the set changes
nothing for the user.

`AdjShelves` (Adjustable Shelves) — 942 characters:

```
FUNCTION: Set of height-adjustable interior shelves that fills a compartment; the library spaces the shelves over its free height.
PURPOSE: Adjustable shelf levels inside a cabinet. A cabinet described with adjustable shelves already shows this set while no fitting fills its interior.
TYPICAL_PLACEMENT: Inside base, wall, tall or wardrobe cabinets.
REQUIREMENTS: Requires a host cabinet with shelf supports.
RECOMMENDED_NEIGHBOURS: Any cabinet that accepts shelves.
RESTRICTIONS: Accessory only; cannot be used stand-alone. Takes the whole compartment; the number of shelves follows from its height.
STYLE_COMPATIBILITY: Neutral interior accessory. Fits all cabinet and furniture styles.
SEARCH_KEYWORDS: adjustable shelves, shelf, interior shelf, height adjustable shelf.
AI_SELECTION_HINT: Select for a compartment that shows no shelves. A cabinet described with adjustable shelves already shows this set; adding it there changes nothing.
```

### 1.7 Tall oven housing

**Status.** Applied verbatim. The unit carries one built-in appliance; a second appliance
code (a microwave above the oven) is accepted but not built, and nothing reports the drop, so the
agent reports a microwave that is not in the plan
([library issue 16](../../.agents/backlog/library-issues.md#16-a-built-in-microwave-selected-on-the-tall-oven-housing-is-not-built)).

`HOTS2AB60` (TODDR2PS60) — 995 characters:

```
FUNCTION:
Tall oven housing, 60 cm wide, with 1 door, 1 oven niche, 1 drawer and 2 pull-outs, adjustable shelves.

PURPOSE:
Integrates one built-in oven at ergonomic height with additional storage.

TYPICAL_PLACEMENT:
Tall-unit block, next to fridge or pantry units.

REQUIREMENTS:
Requires a compatible built-in oven and electrical connection (dedicated circuit). tall unit: carcase height approx. 2016-2160 mm, depth 561 mm. Carries one built-in appliance; a second appliance code is accepted but not built.

RECOMMENDED_NEIGHBOURS:
Fridge tall unit, pantry tall units.

RESTRICTIONS:
No sink installation; requires power for the oven.

STYLE_COMPATIBILITY:
Modern handled kitchen. Also suits classic, Scandinavian and country-house designs.

SEARCH_KEYWORDS:
oven cabinet, appliance tower, baking cabinet, built-in oven housing

AI_SELECTION_HINT:
Select when a built-in oven at working height is requested. The unit carries one built-in appliance; a microwave above the oven is not possible.
```

### 1.8 Island back panel

**Status.** Applied verbatim. The desc of the length attribute is
[2.13](#213-island-back-panel-length).

`RWV` (DP25KI) — 988 characters:

```
FUNCTION:
Decorative back panel for a row of base units that stands free in the room: a kitchen island or a peninsula.

PURPOSE:
Closes the backs of base units that face the room, so the row looks finished from all sides.

TYPICAL_PLACEMENT:
Behind an island or a peninsula, covering the backs of its base units along the whole row.

REQUIREMENTS:
Mounted back to back with the base units of the row. Its length along the row is mod_IslandBackwallWidth, not mod_Width: the length of the row it covers, the widths of its base units added up.

RECOMMENDED_NEIGHBOURS:
Island and peninsula base units, seating modules.

RESTRICTIONS:
Cladding only; no storage. Not for a row against a wall.

STYLE_COMPATIBILITY:
Finishing component. Matches the style of the kitchen it completes.

SEARCH_KEYWORDS:
island back panel, peninsula back panel, rear cladding, cover panel

AI_SELECTION_HINT:
Select for every island or peninsula whose base units show their backs to the room, as long as that row.
```

## 2. Attribute descriptions

### 2.1 Colour values

**Status.** Proposed, not applied. The colour selections name their colour and hex code, without
the plain, wood or stone classification or the restriction on stone fronts.

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

| Value | Name | `desc` before | Proposed `desc` |
|---|---|---|---|
| `Modern` | Modern | Mitred frame fronts with glass filling | Mitred frame doors with glass filling, in stone decors. Drawers, pull-outs and flaps are not built with it: an article with them takes another program. |
| `Tradition` | Tradition | Traditional frame fronts with wooden filling | Traditional frame fronts with wooden filling. When changing from a plain front colour, choose a supported wood Front color before selecting this program. |

**Status.** `Modern`: applied. `Tradition`: proposed, not applied. The program/colour conflict also needs the library change of [issue 19](../../.agents/backlog/library-issues.md#19-a-traditional-front-program-with-a-retained-plain-colour-the-library-cannot-calculate).

### 2.3 Carcase colours

**Attributes.** `mod_CarcaseColor` (Carcase color), `mod_CarcaseOutsideColor` (Carcase color outside).

| Attribute | Name | `desc` before | Proposed `desc` |
|---|---|---|---|
| `mod_CarcaseColor` | Carcase color | Color of the carcase inside and outside if not visible | Color of the carcase inside and of its sides that are not visible. The visible sides take Carcase color outside: with a wood or stone decor here, set Carcase color outside to a wood or stone decor too. |
| `mod_CarcaseOutsideColor` | Carcase color outside | Outside color of the carcase | Color of the visible sides of the carcase, such as the side at the end of a row. Where it is not set, the visible sides take the front color. |

### 2.4 Upright colour and program

**Attributes.** `mod_UprightColor` (Color, group Upright) and `mod_UprightProgram` (Upright Program)
— the end and cover panels `W60H`, `W60U` and `W35O`. The three program values are the same for
`mod_CarcaseProgram` and `mod_CarcaseOutsideProgram`; the proposed value descs fit all three.

| Attribute or value | Name | `desc` before | Proposed `desc` |
|---|---|---|---|
| `mod_UprightColor` | Color | Color of the upright | Color of the end and cover panels. Set Upright Program with it: Classic for a plain decor, ModernNature or Nature for a wood or stone decor. The panels come with ModernNature. |
| `mod_UprightProgram` | Upright Program | Upright Program | How the end and cover panels are built for the kind of their color. Set it with Color. |
| `ModernNature` | ModernNature | Carcase in wooden colors horizontal | Wood and stone decors, grain horizontal. |
| `Nature` | Nature | Carcase in wooden colors vertical | Wood and stone decors, grain vertical. |
| `Classic` | Classic | Classic carcase in single colors | Plain decors. |

### 2.5 Handle design

**Attribute.** `mod_HandleDesign` (Handle design).

| Attribute or value | Name | `desc` before | Proposed `desc` |
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

Additional proposed `mod_DoorDirectionSelection.desc` for resizing (not applied):

> The side a door is hinged on, as seen from the front: the handle is on the other side. Left and Right are for single doors, also two doors one above the other; Left & Right is for a pair of doors side by side. Resizing can change the door arrangement: use the arrangement at the requested size, not the nominal article description. Automatic selects that arrangement's default: a single door hinged left, a side-by-side pair hinged at both outer sides. A single door at a row's right end needs Right; a paired unit keeps both outer hinges at either end.

### 2.7 Handle position type

**Attribute.** `mod_HandlePosType` (Handle position type).

| Value | Name | `desc` before | Proposed `desc` |
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

**Status.** Applied verbatim (checked 2026-10-28 against the master data), except the value
`Axia_Anthrazit_R`: its desc carries the pasted table row, "Axia color anthrazit basin right | see
2.8 | Blanco Axia sink in anthracite: …", without the final full stop; its desc is to be the proposed
text alone. `None` keeps its desc: its outline still reaches 401 / 251 mm past the right side, which
the library team is asked to explain
([library issue 21](../../.agents/backlog/library-issues.md#21-the-sink-descriptions-a-value-desc-with-its-pasted-table-row-and-what-none-builds)).

**Attribute.** `mod_SinkId` (Article code of the sink), group Sink. Its desc states the rule for
every sink unit — the attributes section lists `mod_SinkId` with the number of its values (D122),
so its desc is what the agent reads at the create; the value descs add the reach of each sink,
measured on `SUT60` (60 cm) and `SUB2A90` (90 cm).

| Attribute | Name | `desc` before | Proposed `desc` |
|---|---|---|---|
| `mod_SinkId` | Article code of the sink | Article code of the sink | Article code of the sink. The drainer lies opposite the basin and reaches past the sink unit on that side: a value ending in _L (basin left) over the unit on its right, _R (basin right) over the unit on its left - about 400 mm past a 60 cm unit and 250 mm past a 90 cm unit (Dinas 340 / 190 mm, Metra 410 / 260 mm). Put a base unit on that side, not a hob unit. |

| Value | Name | `desc` before | Proposed `desc` |
|---|---|---|---|
| `Axia_Grey_L` | Axia color grey basin left | Blanco Axia sink in grey, 980 mm wide with the drainer: basin on the left, drainer on the right. | Blanco Axia sink in grey: basin on the left, drainer on the right; it reaches 396 mm past a 60 cm sink unit and 246 mm past a 90 cm unit, over the unit on its right. |
| `Axia_Grey_R` | Axia color grey basin right | Blanco Axia sink in grey, 980 mm wide with the drainer: basin on the right, drainer on the left. | Blanco Axia sink in grey: basin on the right, drainer on the left; it reaches 396 mm past a 60 cm sink unit and 246 mm past a 90 cm unit, over the unit on its left. |
| `Axia_White_L` | Axia color white basin left | Blanco Axia sink in white, 980 mm wide with the drainer: basin on the left, drainer on the right. | Blanco Axia sink in white: basin on the left, drainer on the right; it reaches 396 mm past a 60 cm sink unit and 246 mm past a 90 cm unit, over the unit on its right. |
| `Axia_White_R` | Axia color white basin right | Blanco Axia sink in white, 980 mm wide with the drainer: basin on the right, drainer on the left. | Blanco Axia sink in white: basin on the right, drainer on the left; it reaches 396 mm past a 60 cm sink unit and 246 mm past a 90 cm unit, over the unit on its left. |
| `Axia_Anthrazit_L` | Axia color anthrazit basin left | Blanco Axia sink in anthracite, 980 mm wide with the drainer: basin on the left, drainer on the right. | Blanco Axia sink in anthracite: basin on the left, drainer on the right; it reaches 396 mm past a 60 cm sink unit and 246 mm past a 90 cm unit, over the unit on its right. |
| `Axia_Anthrazit_R` | Axia color anthrazit basin right | Blanco Axia sink in anthracite, 980 mm wide with the drainer: basin on the right, drainer on the left. | Blanco Axia sink in anthracite: basin on the right, drainer on the left; it reaches 396 mm past a 60 cm sink unit and 246 mm past a 90 cm unit, over the unit on its left. |
| `Axis_L` | Axis basin left | Blanco Axis sink: basin on the left, drainer on the right. | Blanco Axis sink: basin on the left, drainer on the right; it reaches 401 mm past a 60 cm sink unit and 251 mm past a 90 cm unit, over the unit on its right. |
| `Axis_R` | Axis basin right | Blanco Axis sink: basin on the right, drainer on the left. | Blanco Axis sink: basin on the right, drainer on the left; it reaches 401 mm past a 60 cm sink unit and 251 mm past a 90 cm unit, over the unit on its left. |
| `Dinas_L` | Dinas basin left | Blanco Dinas sink: basin on the left, drainer on the right. | Blanco Dinas sink: basin on the left, drainer on the right; it reaches 340 mm past a 60 cm sink unit and 190 mm past a 90 cm unit, over the unit on its right. |
| `Dinas_R` | Dinas basin right | Blanco Dinas sink: basin on the right, drainer on the left. | Blanco Dinas sink: basin on the right, drainer on the left; it reaches 340 mm past a 60 cm sink unit and 190 mm past a 90 cm unit, over the unit on its left. |
| `Metra_R` | Metra basin right | Blanco Metra sink: basin on the right, drainer on the left. | Blanco Metra sink: basin on the right, drainer on the left; it reaches 410 mm past a 60 cm sink unit and 260 mm past a 90 cm unit, over the unit on its left. |

### 2.9 Width

**Status.** Applied verbatim. The calculation issue remains open
([library issue 8](../../.agents/backlog/library-issues.md#8-base-units-narrowed-to-150-mm-the-library-cannot-calculate)).

**Attribute.** `mod_Width` (Width).

| Attribute | Name | `desc` before | Proposed `desc` |
|---|---|---|---|
| `mod_Width` | Width | Width of the element | Width of the element. Set it to a width the library calculates for the article. Under 300 mm, the library does not calculate the plinth of a base unit: fill the gap with a filler panel (15 cm) or a pull-out unit. |

### 2.10 Backsplash

**Status.** Applied verbatim. The result-field wording still needs correction: a failed attribute
edit returns a calculation error rather than `notLoaded`. The cause of the calculation failure
remains open
([library issue 10](../../.agents/backlog/library-issues.md#10-backsplashes-the-library-cannot-calculate)).

**Attribute.** `mod_CreateBacksplash` (Create backsplash).

| Attribute | Name | `desc` before | Proposed `desc` |
|---|---|---|---|
| `mod_CreateBacksplash` | Create backsplash | Adds the contour for the backsplash and also starts generating the backsplashes. | Adds the contour for the backsplash and also starts generating the backsplashes. Where the library cannot calculate the backsplash, the result names it in notLoaded; report it as not built. |

### 2.11 Shelf descriptor

**Status.** Text applied verbatim, but incomplete: "the format, with an example (to be named by
the library)" is still a placeholder. The actual format and an example remain open.

**Attribute.** `mod_ShelfadjDescriptor` (Descriptor), carried by the door modules of the cabinets
with adjustable shelves and by `me_ShelfadjMultiple01`. The format of the descriptor is not known;
the library development team names it
([library issue 15](../../.agents/backlog/library-issues.md#15-the-shelf-descriptor-names-no-format)).

| Attribute | Name | `desc` before | Proposed `desc` |
|---|---|---|---|
| `mod_ShelfadjDescriptor` | Descriptor | Position and quantity of the adjustable shelf via descriptor | Position and quantity of the adjustable shelves via descriptor: the format, with an example (to be named by the library). Empty: the library spaces its shelves over the free height of the compartment. |

### 2.12 Oven article codes

**Status.** Applied verbatim for all three attributes. The three codes select the built-in
appliance of a unit; on a unit with one appliance niche a second or third code is accepted but not
built, and nothing reports the drop
([library issue 16](../../.agents/backlog/library-issues.md#16-a-built-in-microwave-selected-on-the-tall-oven-housing-is-not-built)).

**Attribute.** `mod_OvenId1`, `mod_OvenId2`, `mod_OvenId3` (Article code 1 / 2 / 3), group Oven.

| Attribute | Name | `desc` before | Proposed `desc` |
|---|---|---|---|
| `mod_OvenId1` | Article code 1 | Article code of the oven | Article code of the built-in appliance (oven or microwave) the unit carries. |
| `mod_OvenId2` | Article code 2 | Article code of the oven | Article code of a second built-in appliance. A unit with one appliance niche builds only its first code; a second code is accepted but not built. |
| `mod_OvenId3` | Article code 3 | Article code of the oven | Article code of a third built-in appliance. A unit with one appliance niche builds only its first code; a further code is accepted but not built. |

### 2.13 Island back panel length

**Status.** Applied verbatim. The article's desc is [1.8](#18-island-back-panel).

**Attribute.** `mod_IslandBackwallWidth` (Width), the module `mr_IslandBackwall` of `RWV`.

| Attribute | Name | `desc` before | Proposed `desc` |
|---|---|---|---|
| `mod_IslandBackwallWidth` | Width | Width of the island backwall | Length of the island back panel along the row of base units it covers, in mm. Set it to the length of that row: the widths of its base units added up. The panel's length is this attribute, not mod_Width. |
