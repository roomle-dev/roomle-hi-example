# Open issues of the libraries

> **Type**: Backlog — what the library data lacks for the agent to plan right
> **Domain**: the library data the plan context passes on — the article list and the master data,
> and in them the `desc` properties
> **Maintained by**: step 7 of [the testing skill](../skills/hi-mcp-testing.md#7-open-issues)

The MCP server is library-neutral ([§2.4](../../docs/hi-mcp-behaviour.md#24-instructions)): what
the agent knows of a library comes only from the library data. When the agent plans wrong because
that data lacks information, the fix is in the library, and the issue is here. What a library builds
is intended; an issue asks for information, not for other geometry. Each issue names the library,
the problem, its cause, the to-do for the library, the test, whether it is reported to the library
development team, and how to reproduce it. MCP, chat and planner issues are tracked in
[mcp-issues.md](mcp-issues.md). An issue leaves this document when the library carries the fix.

## Overview

| # | Issue | Library | Responsible | Status | Priority |
|---|---|---|---|---|---|
| 60 | [The sink top of a sink unit reaches past the row or over the hob](#60-the-sink-top-of-a-sink-unit-reaches-past-the-row-or-over-the-hob) | HOMAG Furniture_Smith | HOMAG library development team | reported to the library development team | medium — the drainer in the air or over the hob |
| 61 | [Handleless fronts done with a handle attribute](#61-handleless-fronts-done-with-a-handle-attribute) | HOMAG Furniture_Smith | HOMAG library development team | not reported | medium — handled articles where the user asked for handleless ones |
| 64 | [Flip-lift wall cabinets with sizes the library cannot calculate](#64-flip-lift-wall-cabinets-with-sizes-the-library-cannot-calculate) | HOMAG Furniture_Smith | HOMAG library development team | not reported | low — the cabinets are not built, the agent needs a second create |
| 69 | [End panels with a plain upright colour the library cannot calculate](#69-end-panels-with-a-plain-upright-colour-the-library-cannot-calculate) | HOMAG Furniture_Smith | HOMAG library development team | not reported | low — the end panels are not built, the agent needs an undo and a second create |
| 70 | [Carcase side panels with a plain outside colour the library cannot calculate](#70-carcase-side-panels-with-a-plain-outside-colour-the-library-cannot-calculate) | HOMAG Furniture_Smith | HOMAG library development team | not reported | low — the end units are not built, the agent needs three extra calls and loses the wood carcase |
| 71 | [Folding-flap wall cabinets with glass fronts the library cannot calculate](#71-folding-flap-wall-cabinets-with-glass-fronts-the-library-cannot-calculate) | HOMAG Furniture_Smith | HOMAG library development team | not reported | low — the cabinets are not built, the agent needs two attribute changes and loses the glass fronts |

`run.json` and `planner-calls.json` of the run directories named under **Reproduce** hold the payload
the model sent; the directories are under `.temp/result/`.

## 60. The sink top of a sink unit reaches past the row or over the hob

**Problem.** The sink unit `SUT60` carries a sink with its drainer, 980 mm wide, on the 600 mm unit.
Placed as the last unit of a row, the drainer reaches 396 mm past the end of the row, into the air;
swapped beside the hob unit, it covers part of the hob. Whether the agent puts a base unit under the
drainer is chance.

**Cause.** Nothing tells the agent that the sink is wider than its unit: the catalog description of
`SUT60` names a 60 cm sink base unit, the sink's width and the side of its drainer are not in it.
The description also lacks the rule that a hob must not stand immediately to the right of a sink
unit in the row, because the drainer reaches over that neighbour. The
geometry is intended (the library builds the sink that way); the root module's outline in `obstacles`
shows it, but the description does not give the article-specific meaning. `SUBA60` has the same
missing description: its 600 mm unit spans 995.75 mm along the row in the Open-Plan Room, including
its sink geometry. Both descriptions omit the sink/drainer width and overhang. The generic MCP text explains that outlines can extend past docking edges over a
neighbour in the same group; the library data still needs the article-specific information.

**To do.** The library: the description of every sink unit names the width of its sink with the
drainer and the side the drainer reaches over, and that a base unit belongs under it — including
`SUT60` and `SUBA60`. Put this in `FUNCTION` or `AI_SELECTION_HINT` so the compact article catalog
carries it (D63), with any fuller detail in the other sections. State explicitly in the sink unit's
description: "Do not place a hob immediately to the right of this sink unit: the sink drainer
extends over the neighbouring unit on that side." This information belongs in the library data.
Then check that the served text needs nothing more.

**Status.** Reported to the HOMAG library development team.

**Example.** The sink unit beside the hob unit: the sink top covers part of the hob.

![A sink unit beside the hob unit: the sink top covers part of the hob](../images/sink-top-over-hob.png)

- [The plan in the HI presets example](https://rubens.alpha.roomle.com/examples/index.html?example=hi-presets-example&backendId=HI_PRE_Roomle_Milestone_2&library_id=Furniture_Smith&plan_id=ps_rcc154z2tb6cs0yl4sq2g3f38rh13tfb)
- [The order in the HOMAG order manager](https://ordermanager-preview.homag.cloud/#/e2fe8b3d-da31-4a20-92ab-ab6e3839300e/orders/dad09fbf-7dca-41c6-b0bb-d101c1befec6)

**Test.** The test `image-kitchen-left-wall` of `docs/test-prompts.json`: the sink unit stands with a
base unit under its drainer in three runs of gpt-6-astra; `edit-swap-hob-unit`: the drainer does not
cover the hob, and the agent identifies a swap that would put the hob immediately to the right of
the sink as conflicting with the library's selection rule.

**Reproduce.** `mcp-test-2026-10-16_19-30-19`: gpt-6.1-sol 29 (`edit-swap-hob-unit`): the swapped sink's top reaches 396 mm over the hob unit beside it.

## 61. Handleless fronts done with a handle attribute

**Problem.** For "only handleless fronts" the agent keeps the handled articles and sets
`mod_HandleDesign` to the value without a handle, where the test expects the handleless articles of
the catalog (category `Kitchen handleless`).

**Cause.** The handleless articles say what they are: their descs start with "Handleless …
(fingergrip)" and select them for handleless fronts. The handle design value without a handle
(`mod_HandleDesign` 10, `master-data.json:4158`) has the desc "No handle" only, so nothing tells
the agent that setting it on a handled article is not the same as choosing a handleless article.

**To do.** The library: the desc of "No handle" explains how setting that value on a handled
article differs from choosing a handleless article. The served text stays library-neutral; then check that it needs
nothing more.

**Status.** Not reported to the library development team.

**Test.** The test `kitchen-conversation` turn 5 ends with handleless articles.

**Reproduce.** `mcp-test-2026-10-16_19-30-19`: gpt-6.1-sol 50 (`kitchen-conversation`, turn 5): `mod_HandleDesign` 10 on the handled articles of both groups.

## 64. Flip-lift wall cabinets with sizes the library cannot calculate

**Problem.** To copy the band of cabinets above the tall units of a photo, the agent puts flip-lift
wall cabinets (`OSKB90`) on top of the tall units with `mod_Height` 360 and `mod_Depth` 561. The
library cannot calculate them — "Error 14023: Could not find entry in tab_FlipliftSettings for input
value: SHF - 324 - 862 - 533 - Handle" — so they are not built; the server builds the rest of the
group and names them in `notLoaded`. The agent replaces them with `O2TB90` of the same height and
depth, at the cost of two `exchange-root-module` calls.

**Cause.** The library data does not tell the agent which sizes a flip-lift wall cabinet takes: the
descs of `OSKB60` and `OSKB90` name a swing-up flap, a wall-unit row above the worktop and clearance
above for the flap, but no height or depth range of the flap fitting; the desc of `mod_Height` and
`mod_Depth` names none either.

**To do.** The library: the descs of the flip-lift wall cabinets name the heights and depths their
flap fitting supports, in `FUNCTION` or `AI_SELECTION_HINT`, so the compact article catalog carries
it (D63). Then check that the served text needs nothing more.

**Status.** Not reported to the library development team.

**Test.** `image-planning-right-wall`: the first create loads the flip-lift wall cabinets.

**Reproduce.** `mcp-test-2026-10-16_19-30-19`: gpt-6.1-sol 48 (`image-planning-right-wall`, the first `create-or-replace-groups`): two flip-lift wall cabinets `OSKB90` not calculated, Error 14023, in one `notLoaded` error; the model undid the create and sent it again with `O2TB90`.

## 69. End panels with a plain upright colour the library cannot calculate

**Problem.** A create whose group attributes set a plain `mod_UprightColor` (Snow white 192, Sunny
white 190) without `mod_UprightProgram` does not build its end panels `W60H` and `W60U`: "Error
14034: Could not find entry in tab_GrainDirectionSettings for input values: part_FinishPanel -
Upright - Horizontal - NoGrain - 584 - 870"; the server builds the rest of the group and names them
in `notLoaded`. The agent undoes the create and sends it again with `mod_UprightProgram` Classic,
or leaves the end panels out — an undo and a second create. With `mod_UprightProgram` Classic, with
a wood upright colour and its program, or without an upright colour the end panels load.

**Cause.** The end panels keep their wood upright program ("Horizontal": `ModernNature`, "Carcase
in wooden colors horizontal") when the group attributes give them a plain colour, for which the
library has no grain direction. The library switches `mod_FrontProgram` itself when a front colour
of the other kind is set (the server reports it as a correction, D59), but not `mod_UprightProgram`;
the descs of the `mod_UprightColor` values name the colour only, not the program it needs. Only the
program's own desc ("Classic carcase in single colors") hints at it.

**To do.** The library: it switches `mod_UprightProgram` with `mod_UprightColor` as it switches the
front program with the front colour, or the desc of `mod_UprightColor` (or of the end panels `W60H`
and `W60U`) says that a plain colour needs `mod_UprightProgram` Classic and a wood colour `Nature` or
`ModernNature`. Then check that the served text needs nothing more.

**Status.** Not reported to the library development team.

**Test.** `kitchen-conversation` turn 1 and `image-kitchen-back-right-corner`: the first create with
a plain upright colour builds its end panels.

**Reproduce.** `mcp-test-2026-10-16_19-30-19`: gpt-6.1-sol 50 (`kitchen-conversation`, turn 1, the first `create-or-replace-groups`): `mod_UprightColor` 192 without `mod_UprightProgram`, the end panels `W60U`, `W60H` and the wall-unit side panel `W35O` not calculated, Error 14034; the model undid the create and sent it again without the panels.

## 70. Carcase side panels with a plain outside colour the library cannot calculate

**Problem.** A create whose group attributes set a plain front colour (Olive green 160) and a wood
carcase colour (`mod_CarcaseColor` Maple 230, then Walnut 215) does not build the units whose side
panel is visible — the tall unit at the end of the row and the base units at both ends: "Error
14034: Could not find entry in tab_GrainDirectionSettings for input values: part_Sidepanelleft -
TallUnitAppliance - Horizontal - NoGrain - 2100 - 561" (`part_Sidepanelright - BaseUnit` alike); the
server builds the rest of the group and names them in `notLoaded`. A change of the carcase colour and
a second create fail alike; only `mod_CarcaseProgram` Classic with a plain carcase colour builds
them — three extra calls, and the carcase is no longer the wood colour the agent chose.

**Cause.** With the wood carcase colour the library switches `mod_CarcaseProgram` itself to
`ModernNature` ("Carcase in wooden colors horizontal"; the server reports it as a correction, D59),
while the outside carcase colour of the units follows the plain front colour (`mod_CarcaseOutsideColor`
160 in the order data). A visible side panel then has a plain colour under a wood program, for which
the library has no grain direction — as the end panels of issue 69. The descs of `mod_CarcaseColor`,
`mod_CarcaseOutsideColor` and `mod_CarcaseProgram` do not say which colour the visible sides take or
which program a plain outside colour needs.

**To do.** The library: it switches the program of the visible sides with their colour as it
switches the front program with the front colour, or the descs of `mod_CarcaseColor` and
`mod_CarcaseOutsideColor` say that the visible sides take the outside colour and that a plain outside
colour needs `mod_CarcaseOutsideProgram` (or `mod_CarcaseProgram`) Classic. Then check that the
served text needs nothing more.

**Status.** Not reported to the library development team.

**Test.** `image-kitchen-left-wall`: the first create with green fronts and a wood carcase builds
every root module.

**Reproduce.** `mcp-test-2026-10-16_19-30-19`: gpt-6.1-sol 46 (`image-kitchen-left-wall`, the first `create-or-replace-groups`): `mod_FrontColor` 160 and `mod_CarcaseColor` 230 in the group attributes, `HK260`, `USTB60` and `UTB60` not calculated, Error 14034; the `change-group-attribute` with `mod_CarcaseProgram` Classic and `mod_CarcaseColor` 192 builds them.

## 71. Folding-flap wall cabinets with glass fronts the library cannot calculate

**Problem.** To copy the glass wall cabinets of a photo, the agent gives two folding-flap wall
cabinets (`OFKB60`) the front program Modern ("Mitred frame fronts with glass filling"). The library
cannot calculate them — "Error 14036: Could not find entry in tab_PanelWoodFrameConstruction for
input values: Fliplift - ModernFrame01 - Grain - Grain - None" — and sets their front colour to
Concrete; the server builds the rest of the group and names them in `notLoaded`. The agent sets the
program Classic and the colour back, two `change-module-attribute` calls, and the glass fronts of the
photo are plain.

**Cause.** The library data does not tell the agent which front programs a flap front takes: the
desc of `OFKB60` names a folding flap (two-part lift), the desc of the program Modern names a
mitred frame with glass, neither says that a flap cannot be built as a glass frame; the glass wall
cabinets of the catalog, if any, are not named for it.

**To do.** The library: the descs of the folding-flap and flip-lift wall cabinets name the front
programs their flap takes, in `FUNCTION` or `AI_SELECTION_HINT`, or the desc of the program Modern
names the articles it applies to. Then check that the served text needs nothing more.

**Status.** Not reported to the library development team.

**Test.** `image-only-no-text`: the create builds the glass wall cabinets of the photo, or picks
articles that take the glass front.

**Reproduce.** `mcp-test-2026-10-16_19-30-19`: gpt-6.1-sol 49 (`image-only-no-text`, the `create-or-replace-groups`): two `OFKB60` with `mod_FrontProgram` Modern not calculated, Error 14036, in one `notLoaded` error.
