# Open issues of the libraries

> **Type**: Backlog — what the library data lacks for the agent to plan right, and the calculation
> errors of values the library accepts
> **Domain**: the library data the plan context passes on — the article list and the master data,
> and in them the `desc` properties
> **Maintained by**: step 7 of [the testing skill](../skills/hi-mcp-testing.md#7-open-issues)

The MCP server is library-neutral ([§2.4](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#24-instructions)): what
the agent knows of a library comes only from the library data. When the agent plans wrong because
that data lacks information, the fix is in the library, and the issue is here. What a library builds
is intended; an issue asks for information, not for other geometry. A calculation error is no
intended behaviour: a value the library accepts must calculate, so a calculation that fails for it
is a library bug and is tracked here; a calculation error caused by an invalid attribute value the
tools sent is an MCP issue in [mcp-issues.md](mcp-issues.md) (D99 of
[roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#3-decisions)). Each issue names the library,
the problem, its cause, how the library behaves, the to-do for the library, the test, whether it is
reported to the library development team, and how to reproduce it. MCP, chat and planner issues are
tracked in [mcp-issues.md](mcp-issues.md). The **Status** of an issue says what the library already
carries of it; the issue leaves this document when the library carries all of it. The description
texts proposed to the library are in
[`suggested-library-changes.md`](../../docs/library-information/suggested-library-changes.md), which
keeps every suggested text, applied in the library or not.

## What reaches the agent

- **Article descriptions** are written in sections — `FUNCTION`, `PURPOSE`, `TYPICAL_PLACEMENT`,
  `REQUIREMENTS`, `RECOMMENDED_NEIGHBOURS`, `RESTRICTIONS`, `STYLE_COMPATIBILITY`, `SEARCH_KEYWORDS`,
  `AI_SELECTION_HINT` — and hold at most 1000 characters. The catalog of `get-plan-context` serves
  the `FUNCTION` and `AI_SELECTION_HINT` lines only (D63 of
  [roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md)); the full description only when the
  agent requests `articleDescriptions`. What the agent needs to pick an article goes into these two
  lines.
- **The attribute vocabulary** of `get-plan-context` serves every attribute of the library but
  the element type — id, name, `desc`, group, type and every value with its name and `desc`, in
  full (D76, D100). A value list several attributes share is listed once. What it costs and what
  the agent uses of it: [the analysis of the attribute information](../feature-analysis/planning-assistant-attribute-information.md)
  while it is open.
- **A value the library changes along** — a program switched by a colour — is named in the result
  with its `desc` (D59). A rule the agent needs goes into the `desc` of the attribute or the value
  it concerns.

## Overview

### Solved entirely by descriptions

With the descriptions the agent builds at the first attempt what it wants, without a call the
library cannot calculate.

| # | Issue | Library | Responsible | Status | Priority |
|---|---|---|---|---|---|
| 1 | [Handleless fronts done with a handle attribute](#1-handleless-fronts-done-with-a-handle-attribute) | HOMAG Furniture_Smith | HOMAG library development team | the handle design descs done | medium — handled articles where the user asked for handleless ones |
| 2 | [Flip-lift wall cabinets with sizes the library cannot calculate](#2-flip-lift-wall-cabinets-with-sizes-the-library-cannot-calculate) | HOMAG Furniture_Smith | HOMAG library development team | the flap cabinet descs done; supported heights and width/opening combinations not reported | low — the cabinets are not built, the agent needs a second create |
| 3 | [End panels with a plain upright colour the library cannot calculate](#3-end-panels-with-a-plain-upright-colour-the-library-cannot-calculate) | HOMAG Furniture_Smith | HOMAG library development team | the upright descs done; the colour value descs not done; the calculation error not reported | low — the end panels are not built, the agent needs one or two extra calls |
| 6 | [Articles with two doors that do not say how their doors stand](#6-articles-with-two-doors-that-do-not-say-how-their-doors-stand) | HOMAG Furniture_Smith | HOMAG library development team | the article and attribute descs done; `LeftLeft` and `RightRight` not reported | low — two doors one above the other taken for a pair are not built, the agent needs a second call |
| 7 | [Tall-unit descriptions omit width-dependent door arrangements](#7-tall-unit-descriptions-omit-width-dependent-door-arrangements) | HOMAG Furniture_Smith | HOMAG library development team | the `HTB60` desc done; the shared resize guidance open; the calculation error not reported | medium — a widened unit keeps an incompatible single-door hinge input |
| 8 | [Base units narrowed to 150 mm the library cannot calculate](#8-base-units-narrowed-to-150-mm-the-library-cannot-calculate) | HOMAG Furniture_Smith | HOMAG library development team | the width desc done; the calculation error not reported | low — the unit is not built, the agent needs a second create |
| 12 | [A worktop on the tall units from the group's countertop switch](#12-a-worktop-on-the-tall-units-from-the-groups-countertop-switch) | HOMAG Furniture_Smith | HOMAG library development team | open, not reported | low — a worktop on top of the tall units |
| 15 | [The shelf descriptor names no format](#15-the-shelf-descriptor-names-no-format) | HOMAG Furniture_Smith | HOMAG library development team | the desc names the default spacing; the actual format and example open | low — the number of adjustable shelves cannot be set, so "one more shelf" is not possible with adjustable shelves |
| 21 | [The description of SUT60 names the drainer on the right; its sink reaches over the unit on its left](#21-the-description-of-sut60-names-the-drainer-on-the-right-its-sink-reaches-over-the-unit-on-its-left) | HOMAG Furniture_Smith | HOMAG library development team | the descs applied (1.1, 2.8); open: the desc of `Axia_Anthrazit_R`, `None` | high — the sink stands over the hob, and the agent cannot see it before its render |

### Not solved entirely by descriptions

"partly" names in the issue what only the library's logic or data can do; "no" is a library bug
(D99) the descriptions do not solve.

| # | Issue | Library | Responsible | Status | Solved by descriptions | Priority |
|---|---|---|---|---|---|---|
| 4 | [Carcase side panels with a plain outside colour the library cannot calculate](#4-carcase-side-panels-with-a-plain-outside-colour-the-library-cannot-calculate) | HOMAG Furniture_Smith | HOMAG library development team | the carcase colour descs done; the colour value descs and the outside program not done; the calculation error not reported | partly | low — the end units are not built, the agent needs three extra calls and loses the wood carcase |
| 5 | [Folding-flap wall cabinets with glass fronts the library cannot calculate](#5-folding-flap-wall-cabinets-with-glass-fronts-the-library-cannot-calculate) | HOMAG Furniture_Smith | HOMAG library development team | the flap cabinet and front program descs done; the colour value descs not done; the calculation error not reported | partly | low — the cabinets are not built, the agent needs two attribute changes and loses the glass fronts |
| 9 | [Wall units resized with a fixed door direction the library cannot calculate](#9-wall-units-resized-with-a-fixed-door-direction-the-library-cannot-calculate) | HOMAG Furniture_Smith | HOMAG library development team | the single-door article descs done; the calculation error not reported | no — a library bug (D99) | low — the cabinets are not built, the agent needs a second create |
| 10 | [Backsplashes the library cannot calculate](#10-backsplashes-the-library-cannot-calculate) | HOMAG Furniture_Smith | HOMAG library development team | the desc applied; its result-field wording and the calculation cause open | partly | low — the backsplash is not built; the agent must drop it and report the omission |
| 11 | [A handle strip the library cannot calculate](#11-a-handle-strip-the-library-cannot-calculate) | HOMAG Furniture_Smith | HOMAG library development team | open, not reported | partly | low — the units with a handle are not built, the agent needs a second create |
| 13 | [A drawer sideboard lowered to 720 mm the library cannot calculate](#13-a-drawer-sideboard-lowered-to-720-mm-the-library-cannot-calculate) | HOMAG Furniture_Smith | HOMAG library development team | open, not reported | no — a library bug (D99) | low — the drawer sideboard is not built, the agent needs a second create |
| 16 | [A built-in microwave selected on the tall oven housing is not built](#16-a-built-in-microwave-selected-on-the-tall-oven-housing-is-not-built) | HOMAG Furniture_Smith | HOMAG library development team | the housing and appliance-code descs done; the missing second appliance not reported | partly | medium — the agent reports an appliance that is not in the plan |
| 17 | [A Bora hob on the base hob cabinet UKS2A90 the library cannot calculate](#17-a-bora-hob-on-the-base-hob-cabinet-uks2a90-the-library-cannot-calculate) | HOMAG Furniture_Smith | HOMAG library development team | open, not reported | no — a library bug (D99) | low — the unit is not built, the agent replaces it |
| 18 | [A wide paired-door wall cabinet with a push opening the library cannot calculate](#18-a-wide-paired-door-wall-cabinet-with-a-push-opening-the-library-cannot-calculate) | HOMAG Furniture_Smith | HOMAG library development team | open, not reported | no | low — the requested upper cabinet needs a replacement |
| 19 | [A traditional front program with a retained plain colour the library cannot calculate](#19-a-traditional-front-program-with-a-retained-plain-colour-the-library-cannot-calculate) | HOMAG Furniture_Smith | HOMAG library development team | the sequencing desc proposed; calculation error not reported | partly | medium — switching the program needs an extra colour change |
| 20 | [A push-to-open sink unit without the front gap it needs the library cannot calculate](#20-a-push-to-open-sink-unit-without-the-front-gap-it-needs-the-library-cannot-calculate) | HOMAG Furniture_Smith | HOMAG library development team | open, not reported | no — a library bug (D99) | low — the unit is not built, the agent needs a second create |

`run.json` and `planner-calls.json` of the run directories named under **Reproduce** hold the payload
the model sent; the directories are under `.temp/result/`.

Whether the library accepts a value is the verdict of its verified options (D107): a value without
verified options, or with a `Normal` or `Conflicting` entry, is accepted, and a calculation error with
it is a library bug (D99). Furniture_Smith gives no verified options for `mod_Width`, `mod_Height`,
`mod_Depth`, `mod_DoorDirectionSelection`, `mod_UprightColor` on the end panels and
`mod_CreateBacksplash`, so every value of them reaches the calculation. The library can rule a value
out without a change of its API: the verified options carry `Invalid` entries and a range
(`dropDownRange` with `min`, `max` and `step`), which the tools apply before every edit. A range in the
master data (a `{ min, max, step }` selection, as for `mod_GroupWidth`) is one range for every
article; the values that calculate differ per article, so the verified options of the module are the
place for them.

**The probe of 2026-10-24** checked the calculation errors without a model, on roomle-ui
`feat/hi-mcp` `42d17c4f3`: per case a group with the article as it comes, the verified options of
the probed attribute on every module that carries it (`getExternalObjectAttributeOptionsOrRanges`),
then the value by `change-module-attribute` or `change-group-attribute`. The scripts and results are
in `.temp/result/probe-values-the-library-cannot-calculate-2026-10-24/`.

## 1. Handleless fronts done with a handle attribute

**Problem.** For "only handleless fronts" the agent keeps the handled articles and sets
`mod_HandleDesign` to the value without a handle, where the test expects the handleless articles of
the catalog (category `Kitchen handleless`).

**Cause.** The handleless articles say what they are: their descs start with "Handleless …
(fingergrip)" and select them for handleless fronts. The handle design value without a handle
(`mod_HandleDesign` 10, `master-data.json:4158`) has the desc "No handle" only, so nothing tells
the agent that setting it on a handled article is not the same as choosing a handleless article.

**How the library behaves.** The handleless articles come with `mod_HandleDesign` `10`,
`mod_FingergripType` `Wood` and `mod_CreateFingergrip` `True` (`article.json`): fronts with a wooden
fingergrip. A handled article set to `mod_HandleDesign` `10` keeps `mod_CreateFingergrip` `False`
and `mod_FingergripType` `None`: fronts without a handle and without a grip (order data of
`mcp-test-2026-10-17_13-28-41` gpt-6-astra 52). The two fingergrip attributes are `userRight`
`Advanced`; the attribute vocabulary lists them (D100). The catalog has handleless variants of base units
only — sink, storage, corner and hob units. In `mcp-test-2026-10-16_19-30-19` gpt-6.1-sol 50, turn 5,
the model answers "No fingergrip profiles were added—the existing units do not support that
attribute".

**To do.** The library: the descs of `mod_HandleDesign` and its value `10` — section 2.5 of
[`suggested-library-changes.md`](../../docs/library-information/suggested-library-changes.md#25-handle-design).
Then check that the served text needs nothing more.

**Status.** Done in the library: the descs of `mod_HandleDesign` and its value `10` (section 2.5).

**Test.** The test `kitchen-conversation` turn 5 ends with handleless articles.

**Reproduce.** `mcp-test-2026-10-17_13-28-41`: gpt-6-astra 52 (`kitchen-conversation`, turn 5): `mod_HandleDesign` 10 on the handled articles of both groups.

## 2. Flip-lift wall cabinets with sizes the library cannot calculate

**Problem.** To copy the band of cabinets above the tall units of a photo, the agent puts flip-lift
wall cabinets (`OSKB90`) on top of the tall units with `mod_Height` 360 and `mod_Depth` 561. The
library cannot calculate them — "Error 14023: Could not find entry in tab_FlipliftSettings for input
value: SHF - 324 - 862 - 533 - Handle" — so they are not built; the server builds the rest of the
group and names them in `notLoaded`. The agent replaces them with `O2TB90` of the same height and
depth, at the cost of two `exchange-root-module` calls.

**Cause.** The flap fitting takes a limited range of heights. The descriptions of the
flap wall cabinets send the agent to a wall cabinet with doors for any height or depth other than
their own; they name no range, and neither do `mod_Height` and `mod_Depth`.

**How the library behaves.**

| Article | `mod_Height` × `mod_Depth` | Built | Runs |
|---|---|---|---|
| `OSKB60`, `OSKB90`, `OFKB60`, `OFKB90` | 720 × 350, as they come | yes | every run that plans them in their own size |
| `OSKB90` | 360 × 561 | no: "… SHF - 324 - 862 - 533 - Handle" | `mcp-test-2026-10-16_19-30-19` gpt-6.1-sol 48, `mcp-test-2026-10-17_13-28-41` gpt-6-astra 50 |
| `OSKB90` | 300 × 561 | no: "… SHF - 264 - 862 - 533 - Handle" | `mcp-test-2026-10-17_09-31-13` gpt-6-astra 48 |
| `O2TB90` (doors) | 360 × 561 | yes | `mcp-test-2026-10-17_13-28-41` gpt-6-astra 50, the `exchange-root-module` |
| `OSKB90` | 360 × 350, the height alone | no: "… SHF - 324 - 862 - 322 - Handle" | the probe of 2026-10-24 |
| `OSKB90` | 720 × 561, the depth alone | yes | the probe of 2026-10-24 |

The fitting does not take the height; the depth 561 calculates. `mod_Height` has no verified
options, so the library accepts the height it cannot calculate: a library bug (D99).

A 1500 mm-wide `OSKB90` at its nominal 720 mm height and 350 mm depth with
`mod_OpeningType` `PushToOpenManual` also fails Error 14023
(`SHF - 684 - 1462 - 322 - PushToOpenManual`). The width/opening combination is accepted
without a verified-range correction; whether the width, opening type or their combination causes
the missing entry is not isolated. Switching that wide flap to handle strip 40 gives
`Unexpected token 'N', "None" is not valid JSON`.

**To do.** The library: calculate the flap cabinets at every height `mod_Height` accepts, or declare
the heights the flap fitting takes in `tab_FlipliftSettings` as the verified range of `mod_Height`
per flap cabinet (D107), and establish and expose the supported width/opening combinations; with
them the `FUNCTION` lines of the flap wall cabinets can name the sizes the flap takes. Then check that the served text needs nothing more.

**Status.** Done in the library: the `AI_SELECTION_HINT` of `OSKB60`, `OSKB90`, `OFKB60` and
`OFKB90` — a flap cabinet at the height and depth it comes with, a wall cabinet with doors for glass
fronts or another height or depth (section 1.3 of
[`suggested-library-changes.md`](../../docs/library-information/suggested-library-changes.md#13-flap-wall-cabinets)).
Open, not reported: the supported heights and width/opening combinations.

**Test.** `image-only-no-text-2`: the first create builds the requested upper cupboards, or
verified options guide the agent to compatible dimensions and opening types.

**Reproduce.** `mcp-test-2026-10-25_18-06-08`, gpt-6-astra 72 (`image-only-no-text-2`, bo-test):
the first create sends `OSKB90` with `mod_Width` 1500 and `PushToOpenManual` at nominal height/depth,
which fails Error 14023; the second create uses handle strip 40 and fails the JSON parse. The
fourth create uses nominal-width open and hinged wall units and builds.

## 3. End panels with a plain upright colour the library cannot calculate

**Problem.** A create whose group attributes set a plain `mod_UprightColor` (Snow white 192, Sunny
white 190) without `mod_UprightProgram` does not build its end and cover panels `W60H`, `W60U` and
`W35O`: "Error 14034: Could not find entry in tab_GrainDirectionSettings for input values:
part_FinishPanel - Upright - Horizontal - NoGrain - 584 - 870" (`W35O`: `- 373 - 720`); the server
builds the rest of the group and names them in `notLoaded`. The agent sets `mod_UprightProgram`
Classic on the end panels with `change-module-attribute`, or undoes the create and sends it again
with that program or without the end panels — one or two extra calls. With `mod_UprightProgram`
Classic, with a wood upright colour and its program, or without an upright colour the end panels
load.

**Cause.** The end panels keep their wood upright program ("Horizontal": `ModernNature`, "Carcase
in wooden colors horizontal") when the group attributes give them a plain colour, for which the
library has no grain direction. The library switches `mod_FrontProgram` itself when a front colour
of the other kind is set (the server reports it as a correction, D59), but not `mod_UprightProgram`;
the descs of the `mod_UprightColor` values name the colour only, not the program it needs. Only the
program's own desc ("Classic carcase in single colors") hints at it.

**How the library behaves.** The colour values are of three kinds. In the stored runs the library
switched the front program to Classic for 160 and 178, to Nature for 222 and 229, to Modern for 326,
and the carcase program to ModernNature for 215, 230, 240 and 326; the stone decors 316, 324, 326 and
380 come as fronts only with Modern (D59). The calculation errors call a plain colour `NoGrain`, a
wood or stone decor `Grain`. The value numbers follow the kinds: 1xx plain, 2xx wood, 3xx stone. The
end and cover panels come with the program ModernNature:

| `mod_UprightColor` | `mod_UprightProgram` | Built | Runs |
|---|---|---|---|
| plain (192, 190) | not set | no | `mcp-test-2026-10-16_19-30-19` gpt-6.1-sol 50 (`W60U`, `W60H`, `W35O`); `mcp-test-2026-10-17_13-28-41` gpt-6-astra 52 and 53 |
| plain (192) | Classic | yes | `mcp-test-2026-10-17_13-28-41` gpt-6-astra 52, the second create of turn 1 |
| wood (222) | Nature | yes | `mcp-test-2026-10-17_13-28-41` gpt-6-astra 52 turn 4; `mcp-test-2026-10-17_09-31-13` gpt-6-astra 50 turn 4 |
| wood (240) | Classic | yes | `mcp-test-2026-10-17_13-28-41` gpt-6-astra 52 turn 7 |
| plain (192), on `W60U` beside a `UTB60` by `change-group-attribute` | not set | no: "… part_FinishPanel - Upright - Horizontal - NoGrain - 584 - 820" | the probe of 2026-10-24 |

`W60U` has no verified options for `mod_UprightColor`: the library accepts the plain colour it cannot
calculate under the program the end panel comes with, a library bug (D99).

**To do.** The library: the colour value descs name their kind, and the descs of `mod_UprightColor`
and `mod_UprightProgram` name the program for each kind — sections 2.1 and 2.4 of
[`suggested-library-changes.md`](../../docs/library-information/suggested-library-changes.md#21-colour-values).
The colour code stays first in each value desc: `materials.md` reads it from there. The library team
confirms the kind of the values the runs did not show, and whether Nature takes stone decors.
The library bug: the library switches `mod_UprightProgram` with `mod_UprightColor`, as the front
program with the front colour, or rules a plain colour under a wood program out in the verified
options of the end panels (D107); with the switch the agent needs no second attribute, and the desc
of `mod_UprightColor` keeps its first sentence. Then check that the served text needs nothing more.

**Status.** Done in the library: the descs of `mod_UprightColor`, `mod_UprightProgram` and its values
(section 2.4). Open: the kind in the colour value descs (section 2.1); the program values of
`mod_CarcaseProgram` and `mod_CarcaseOutsideProgram` keep their old descs. Open, not reported to the
library development team: the calculation error.

**Test.** `kitchen-conversation` turn 1 and `image-kitchen-back-right-corner`: the first create with
a plain upright colour builds its end panels.

**Reproduce.** `mcp-test-2026-10-17_13-28-41`: gpt-6-astra 53 (`kitchen-family-two-kids`, the `create-or-replace-groups`): `mod_UprightColor` 190 without `mod_UprightProgram`, the end panels `W60U` and `W60H` not calculated, Error 14034; the model set `mod_UprightProgram` Classic.

## 4. Carcase side panels with a plain outside colour the library cannot calculate

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
the library has no grain direction — as the end panels of issue 3. The descs of `mod_CarcaseColor`,
`mod_CarcaseOutsideColor` and `mod_CarcaseProgram` do not say which colour the visible sides take or
which program a plain outside colour needs; `mod_CarcaseProgram` and `mod_CarcaseOutsideProgram`
are `userRight` `Master`, not `isMain`; the attribute vocabulary lists them (D100).

**How the library behaves.** A visible side — at the end of a row — takes `mod_CarcaseOutsideColor`;
where the create does not set it, it is the front colour (order data of
`mcp-test-2026-10-16_19-30-19` gpt-6.1-sol 46: `mod_CarcaseOutsideColor` 160, the front colour). A
wood or stone `mod_CarcaseColor` switches `mod_CarcaseProgram` to ModernNature, and the visible sides
are built with it. The same error hits base, wall and tall units:

| Front | `mod_CarcaseColor` | `mod_CarcaseOutsideColor` | Visible sides built | Runs |
|---|---|---|---|---|
| plain (160, 192) | wood (230, 215, 229) | not set: the front colour | no | `mcp-test-2026-10-16_19-30-19` gpt-6.1-sol 46 (`HK260`, `USTB60`, `UTB60`); `mcp-test-2026-10-17_10-50-12` mistral-large-latest 50 (base, wall and tall units) |
| plain (160) | wood (224, 215) | the same wood | yes | `mcp-test-2026-10-17_09-31-13` gpt-6-astra 46; `mcp-test-2026-10-17_13-28-41` gpt-6-astra 48 |
| wood (229, 240) | plain (178, 190) | the front wood | yes | `mcp-test-2026-10-16_19-30-19` gpt-6.1-sol 45; `mcp-test-2026-10-17_09-31-13` gpt-6-astra 45 |
| plain (160, set first; the library switched the front program to Classic) | wood (230) | not set: the front colour | no: "… part_Sidepanelleft - BaseUnit - Horizontal - NoGrain - 720 - 561" | the probe of 2026-10-24, two `UTB60`, `change-group-attribute` |

The wood carcase colours are `Conflicting` in the verified options of `UTB60`: the library accepts
them, and its conflict resolution switches `mod_CarcaseProgram` but leaves the visible sides in a
plain colour it cannot calculate under that program, a library bug (D99).

**To do.** The library: the colour value descs name their kind, and the descs of `mod_CarcaseColor`
and `mod_CarcaseOutsideColor` say that the visible sides take the outside colour and which kind it
needs with a wood or stone carcase — sections 2.1 and 2.3 of
[`suggested-library-changes.md`](../../docs/library-information/suggested-library-changes.md#23-carcase-colours).
With them the agent builds the units at the first attempt, the visible sides in a wood or stone
decor. Plain visible sides on a wood or stone carcase need the library, the library bug: it switches
`mod_CarcaseOutsideProgram` with `mod_CarcaseOutsideColor`, as the front program with the front
colour, or its conflict resolution leaves no plain visible side under a wood or stone program; the
desc of `mod_CarcaseColor` then keeps its first two sentences. The library team confirms whether
`mod_CarcaseOutsideProgram` Classic builds such sides today. Then check that the served text needs
nothing more.

**Status.** Done in the library: the descs of `mod_CarcaseColor` and `mod_CarcaseOutsideColor`
(section 2.3). Open: the kind in the colour value descs (section 2.1), and the switch of
`mod_CarcaseOutsideProgram` with `mod_CarcaseOutsideColor`. Open, not reported to the library
development team: the calculation error.

**Test.** `image-kitchen-left-wall`: the first create with green fronts and a wood carcase builds
every root module.

**Reproduce.** `mcp-test-2026-10-16_19-30-19`: gpt-6.1-sol 46 (`image-kitchen-left-wall`, the first `create-or-replace-groups`): `mod_FrontColor` 160 and `mod_CarcaseColor` 230 in the group attributes, `HK260`, `USTB60` and `UTB60` not calculated, Error 14034; the `change-group-attribute` with `mod_CarcaseProgram` Classic and `mod_CarcaseColor` 192 builds them.

## 5. Folding-flap wall cabinets with glass fronts the library cannot calculate

**Problem.** To copy the glass wall cabinets of a photo, the agent gives two folding-flap wall
cabinets (`OFKB60`) the front program Modern ("Mitred frame fronts with glass filling"). The library
cannot calculate them — "Error 14036: Could not find entry in tab_PanelWoodFrameConstruction for
input values: Fliplift - ModernFrame01 - Grain - Grain - None" — and sets their front colour to
Concrete; the server builds the rest of the group and names them in `notLoaded`. The agent sets the
program Classic and the colour back, two `change-module-attribute` calls, and the glass fronts of the
photo are plain. A stone decor as front colour leads there too: it comes only with Modern, and the
library switches the program. Drawers and pull-outs with Modern fail alike: "Drawer - ModernFrame01 -
NoGrain - NoGrain - Glass".

**Cause.** The library builds Modern on doors only, and the desc of Modern says so; the stone decors
name their colour only, not that a front in them is a Modern door. The
kitchen catalog has no wall cabinet with glass fronts; the glass display cabinets `SM_WT300S` and
`SM_HT600S` are living-room articles.

**How the library behaves.**

| Fronts with Modern | Built | Runs |
|---|---|---|
| doors (`OTB60`) | yes; the library sets Concrete 316 in place of Sunny white 190 | `mcp-test-2026-10-17_13-28-41` gpt-6-astra 51 |
| flaps (`OFKB60`), Modern set | no | `mcp-test-2026-10-16_19-30-19` gpt-6.1-sol 49 |
| flaps (`OSKB60`, `OSKB90`), Slate 326 set as front colour, the library switched to Modern | no | `mcp-test-2026-10-17_10-50-12` mistral-large-latest 48 |
| drawers and pull-outs (`US2A60`, `UKS2A60`, `HTS2AB60`) | no; the doors of the same calls are built | `mcp-test-2026-10-17_10-50-12` mistral-large-latest 50, attempt 1, turn 5 |
| flaps (`OFKB60`), Modern set by `change-module-attribute` | no: "… Fliplift - ModernFrame01 - Grain - Grain - None" | the probe of 2026-10-24 |

Modern is `Conflicting` in the verified options of `OFKB60` and its flap (`Normal`: Nature,
Tradition): the library accepts it, and its conflict resolution leaves a flap it cannot calculate, a
library bug (D99).

**To do.** The library: the desc of Modern says that it builds doors in stone decors, and the stone
decors that a front in them is a Modern door — sections 2.1 and 2.2 of
[`suggested-library-changes.md`](../../docs/library-information/suggested-library-changes.md#22-front-program).
With them the agent builds glass wall cabinets with doors. The library bug: glass flaps and glass
drawer fronts calculate — entries for `Fliplift` and `Drawer` with `ModernFrame01` in
`tab_PanelWoodFrameConstruction` —, or Modern is `Invalid` in the verified options of flaps, drawers
and pull-outs (D107). Then check that the served text needs nothing more.

**Status.** Done in the library: the `AI_SELECTION_HINT` of the flap wall cabinets sends the agent to
a wall cabinet with doors for glass fronts (section 1.3), and the desc of Modern (section 2.2).
Open: the stone decors in the colour value descs (section 2.1). Open, not reported to the library
development team: the calculation error of Modern on flaps, drawers and pull-outs.

**Test.** `image-only-no-text`: the create builds the glass wall cabinets of the photo, or picks
articles that take the glass front.

**Reproduce.** `mcp-test-2026-10-16_19-30-19`: gpt-6.1-sol 49 (`image-only-no-text`, the `create-or-replace-groups`): two `OFKB60` with `mod_FrontProgram` Modern not calculated, Error 14036, in one `notLoaded` error.

## 6. Articles with two doors that do not say how their doors stand

**Problem.** In a row, the agent hinges the doors at the two ends at the outer sides of the row
([D84](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#doors)), with the value of
`mod_DoorDirectionSelection` for single doors or for a pair of doors. A value the article does not
take fails with error 14019 and the root module is not built: `H2TB60` with `LeftRight`, `U2TB90`
with `Left` or `Right`. `LeftLeft` and `RightRight` are offered for a pair but not calculated on
`U2TB90`.

**Cause.** `tab_DoorSettings` has no entry for `LeftLeft` and `RightRight` on `U2TB90`, at the width
it comes with. The library gives no verified options for `mod_DoorDirectionSelection`, so it accepts
both values it cannot calculate: a library bug (D99).

**How the library behaves.** Checked on the bo-test planner on 2026-10-17, without a model, through
the MCP tools:

| Articles | Doors | `Automatic` resolves to | Calculated | Not calculated (Error 14019) |
|---|---|---|---|---|
| `KS_HT600K`, `HEST60`, `HEMT60`, `HEET60`, `UTB60`, `SB_UB600` | one door | `Left` | `Left`, `Right` (set on `KS_HT600K` and `SB_UB600`) | not checked |
| `H2TB60` | two doors, one above the other | `Left` on both | `Right` on both | `LeftRight` |
| `U2TB90` | a pair of doors side by side | `LeftRight` | `LeftRight` | `Left`, `Right`, `LeftLeft`, `RightRight` |

The probe of 2026-10-24 gives the same Error 14019 for `LeftLeft` and `RightRight` on `U2TB90` ("…
BaseUnit - All - Standard - 240 - mr_StorageunitSingle - 900 - Automatic - LeftLeft - Cleat").

By their door modules in the article list, `H2TB60` and `HWR_HB600T2` have two `mf_Door` on 60 cm,
one above the other; `U2TB90`, `O2TB90`, `US2TB90` and `EU2TB90` one `mf_Door` on 90 cm, a pair.
`mod_HandlePosType` on a single door of `KS_HT600K`, hinged left and hinged right: `03` and `04` both
put a vertical handle at the edge opposite the hinge, at the same place, turned by 180° against each
other; `05` and `06` put it in the middle of the door's width. None changes the hinge side.

**To do.** The library: `LeftLeft` and `RightRight` are calculated on the articles with a pair of
doors, or the verified options rule them out where they do not calculate (D107), and their descs
name the articles that take them — section 2.6 of
[`suggested-library-changes.md`](../../docs/library-information/suggested-library-changes.md#26-door-direction).
Then check that the served text needs nothing more.

**Status.** Done in the library: the `FUNCTION` lines of the articles with two doors say "2 doors one
above the other" or "a pair of doors side by side" (section 1.2), and the descs of
`mod_DoorDirectionSelection` and `mod_HandlePosType` and their values, `14` with the place of `13`
(sections 2.6 and 2.7). Open, not reported to the library development team: `LeftLeft` and
`RightRight`.

**Test.** `wardrobe-door-hinges` and `wardrobe-extend-door-hinge`: the doors at the ends of the row
hinged at the outer sides, with values the library calculates.

**Reproduce.** The planner probe of [RML-18203](https://roomle.atlassian.net/browse/RML-18203), without a model, on the bo-test planner: `create-or-replace-groups` with `U2TB90` and `mod_DoorDirectionSelection` `Left`, `Right`, `LeftLeft` or `RightRight`, or `H2TB60` with `LeftRight` — error 14019 in `notLoaded`.

## 7. Tall-unit descriptions omit width-dependent door arrangements

**Problem.** At 900 mm, the calculated `HTB60` has paired doors with `Automatic` or `LeftRight`;
retaining `mod_DoorDirectionSelection: Right` gives Error 14019 and an incomplete root.
The article description explains the 600 and 900 mm configurations and the retained setting to
correct. The shared Door direction description still asks for `Right` at a row's right end without
explaining that resizing can turn a single-door unit into a paired-door unit.

**Cause.** A library bug (D99), the error of [issue 9](#9-wall-units-resized-with-a-fixed-door-direction-the-library-cannot-calculate)
on a tall unit: with `Automatic` the library chooses the door arrangement by the width, and a fixed
`mod_DoorDirectionSelection` of the other arrangement has no entry in `tab_DoorSettings` at that
width. The library's conflict resolution does not change the door direction with the width, and it
gives no verified options for `mod_Width` and `mod_DoorDirectionSelection`. The shared Door direction
description omits resize guidance.

**How the library behaves.** Checked in the probe of 2026-10-24:

| Door direction | Width | Built |
|---|---|---|
| `Automatic` | 600 mm, as it comes | yes: a single door (`mod_DoorDirection` `Left` on `mf_Door`) |
| `Automatic` | 900 mm, widened | yes: a pair of doors side by side (`LeftRight`) |
| `Right`, then widened | 900 mm | no: Error 14019 ("… TallUnit - All - Standard - 240 - mr_StorageunitSingle - 900 - Automatic - Right - Automatic") |

**To do.** Apply the proposed shared resize guidance in
[section 2.6](../../docs/library-information/suggested-library-changes.md#26-door-direction).
Keep the facts in library data; the verified nominal and widened configurations do not
establish an intermediate-width threshold. The library bug: as in issue 9.

**Status.** Done in the library: the complete `HTB60` description (section 1.5). Open: the shared
Door direction resize guidance (section 2.6). Open, not reported to the library development team:
the calculation error.

**Test.** `edit-swap-units`: the agent corrects incompatible retained input after resizing,
then swaps the complete paired-door unit into the back corner. The row is contiguous at
2100 mm, back end z −3765, with appropriate single/paired outer hinges.

**Reproduce.** `mcp-test-2026-10-21_08-37-33`, gpt-6-astra 36 (`edit-swap-units`, local roomle-ui
:5173): the last `HTB60` `8774cac2` widened to 900 mm retains `Right`; the correction carries Error
14019 (`tab_DoorSettings`) and the model undoes the widening.

## 8. Base units narrowed to 150 mm the library cannot calculate

**Problem.** To copy the narrow unit at the end of a row of a photo, the agent narrows a base
storage unit to 150 mm (`UTB30` with `mod_Width` 150) in a group whose plinth height is 150 mm.
The library cannot calculate it — "Error 14011: Could not find entry in tab_PlinthAreaSettings for
input values: BaseUnit - 30 - LCF - RCF - BCF - FCR - 150 - 150 - 50" — so the unit is not built;
the server builds the rest of the group and names it in `notLoaded`. The agent undoes the create and
sends it again with the filler panel `PU15L` for the narrow space.

**Cause.** A library bug (D99): `tab_PlinthAreaSettings` has no entry for a 150 mm wide base unit of
the 30 cm class, with the plinth the unit comes with (100 mm) as with 150 mm, and `mod_Width` has no
verified options, so the library accepts the width it cannot calculate. The desc of `mod_Width`
warns against base units under 300 mm and directs the agent to a filler panel or pull-out unit;
it does not supply the verified widths per article.

**How the library behaves.** Checked in the stored runs:

| Article | Width | Plinth height | Built | Runs |
|---|---|---|---|---|
| `UTB60` | 450 mm, narrower | the library's default | yes | `mcp-test-2026-10-18_14-48-28` gpt-6-astra 07 |
| `UTB30` | 150 mm, narrower | 150 mm | no: Error 14011 (`tab_PlinthAreaSettings`) | `mcp-test-2026-10-18_14-48-28` gpt-6-astra 49 |
| `UTB30` | 150 mm, narrower | the library's default (base unit tops at 820 mm) | no: Error 14011 with the same input values (`… - 150 - 150 - 50`) | `mcp-test-2026-10-21_08-37-33` gpt-6-astra 65 |
| `H2TB60` (tall unit) | 300 mm, narrower | 150 mm | yes | `mcp-test-2026-10-18_14-48-28` gpt-6-astra 49, the second create |
| `PU15L` (filler panel, 15 cm) | 150 mm, as it comes | 150 mm | yes | `mcp-test-2026-10-18_14-48-28` gpt-6-astra 49, the second create |
| `UTB30` | 150 mm, narrower | 100 mm, as it comes | no: Error 14011 with the same input values | the probe of 2026-10-24 |
| `UTB30` | 150 mm, narrower | 150 mm (`Normal` in the verified options) | no: Error 14011 with the same input values | the probe of 2026-10-24 |

The width alone fails. Not known: which widths `tab_PlinthAreaSettings` takes per base unit class,
and whether the wider classes take 150 mm.

**To do.** The library: calculate the base units at every width `mod_Width` accepts, or declare the
widths each takes as the verified range of `mod_Width` (D107); with them the `desc` of `mod_Width`
can name the widths the library calculates — section 2.9 of
[`suggested-library-changes.md`](../../docs/library-information/suggested-library-changes.md#29-width).
Then check that the served text needs nothing more.

**Status.** Done in the library: the desc of `mod_Width` (section 2.9). Open, not reported to the
library development team: the calculation error and the verified widths per article.

**Test.** `image-kitchen-back-right-corner`: the first create builds the narrow unit of the photo,
or the agent fills the narrow space with a filler panel or a pull-out at the first attempt.

**Reproduce.** `mcp-test-2026-10-21_12-49-36`: gpt-6-astra 65 (`image-kitchen-back-right-corner`,
bo-test, the `create-or-replace-groups`): root `UTB30` with `mod_Width` 150
(`ba5b0fab-b40d-4988-9a98-8330cf4b852a`) in the group `3097c084-4a02-4a23-9f9c-ff4df67d48e3`, with
`mod_PlinthAreaHeight` 150 in the group attributes, not calculated, Error 14011; the model exchanged
it for the 150 mm filler `PU15L`.

## 9. Wall units resized with a fixed door direction the library cannot calculate

**Problem.** To copy the wide light band above the tall units of a photo, the agent widens two
wall units to 900 mm (`OTB60` with `mod_Width` 900, `mod_DoorDirectionSelection` `Left` and
`Right`) bridging over the dark cabinets. The library cannot calculate them — "Error 14019: Could
not find entry in tab_DoorSettings for input value: WallUnit - All - Standard - 190 -
mr_StorageunitSingle - 900 - Automatic - Left - Automatic" (and the `Right` variant) — so they are
not built; the server builds the rest of the group and names them in `notLoaded`. The agent undoes
the create and sends it again with four `OTB45` and two `O2TB90`. Narrowed, the wall cabinet with a
pair of doors fails the same way: `O2TB90` at 600 mm with `LeftRight` ("… 600 - Automatic -
LeftRight - Automatic").

**Cause.** A library bug (D99): the library accepts the width and the door direction but cannot
calculate them together. With `Automatic` it chooses the door arrangement by the width: `OTB60` and
`O2TB90` get a single door at 600 mm and a pair of doors side by side at 750 and 900 mm (the
resolved `mod_DoorDirection` of `mf_Door`: `Left`, `LeftRight`). A fixed
`mod_DoorDirectionSelection` is looked up with the width in `tab_DoorSettings`
(`… - <width> - Automatic - <direction> - …`), which has a single-door entry only where the width
gives a single door and a pair entry only where it gives a pair; a resize that changes the
arrangement fails when it keeps the direction of the arrangement before. The library's conflict
resolution does not change the direction with the width, and its verified options rule neither
out: `mod_Width` is a `Dim` slider whose master data names no range, and the root module and its
door give no verified options for `mod_Width` and `mod_DoorDirectionSelection`. In the runs, the
library's scripts throw after the missing entry ("Cannot read properties of undefined (reading
'RealDoorDirection')", "\"undefined\" is not valid JSON"). The served rule and the desc of
`mod_DoorDirectionSelection` ask for `Right` at the right end of a row (D84), and the descs of the
single-door wall cabinets (`OTB30`, `OTB45`, `OTB60`) direct the agent to keep their nominal width
and choose a paired-door article or two narrower units for a wider cabinet. The shared Door
direction description does not explain resizing. [Issue 7](#7-tall-unit-descriptions-omit-width-dependent-door-arrangements)
is the same error on a tall unit.

**How the library behaves.** Checked in the stored runs and in the probe of 2026-10-24:

| Article | Door direction | Width | Built | Runs |
|---|---|---|---|---|
| `OTB30`, `OTB45`, `OTB60` | as they come | as they come (300, 450, 600 mm) | yes | every run that plans them |
| `OTB60` | `Automatic` | 450, 750, 900 mm | yes; at 750 and 900 mm a pair of doors (`LeftRight`) | the probe of 2026-10-24 |
| `OTB60` | `Left`, `Right` | 900 mm, widened | no: Error 14019 (`tab_DoorSettings`) | `mcp-test-2026-10-18_14-48-28` gpt-6-astra 50; the probe of 2026-10-24 |
| `OTB60` | `Left` | 750 mm, widened | no: Error 14019 ("… 750 - Automatic - Left - Automatic") | the probe of 2026-10-24 |
| `O2TB90` | as it comes | 900 mm, as it comes | yes | `mcp-test-2026-10-18_14-48-28` gpt-6-astra 50, the second create |
| `O2TB90` | `Automatic` | 600 mm, narrowed | yes: a single door (`Left`) | the probe of 2026-10-24 |
| `O2TB90` | `LeftRight` | 600 mm, narrowed | no: Error 14019 (`tab_DoorSettings` … `600 - Automatic - LeftRight`) | `mcp-test-2026-10-22_19-45-49` gpt-6-astra 67, the first create; the probe of 2026-10-24 |

The verified options of a 600 mm `OTB60` (local roomle-ui, `getExternalObjectAttributeOptionsOrRanges`
of every module, all attributes): the root module verifies 16 attributes — programs, colours,
designs, the plinth height —, its door 12; none of them is `mod_Width`, `mod_Height` or
`mod_DoorDirectionSelection`.

Not known: the width between 600 and 750 mm at which `Automatic` gives a pair of doors.

**To do.** The library: change the door direction with the width where the width changes the door
arrangement — a conflict its conflict resolution resolves, which the tools name as a library change
(D59) —, or rule the direction of the other arrangement out in the verified options of the module
(D107); and no script exception after a missing table entry. With the widths of each arrangement
known, the `AI_SELECTION_HINT` of the single-door wall cabinets can name them — section 1.4 of
[`suggested-library-changes.md`](../../docs/library-information/suggested-library-changes.md#14-wall-units-with-a-single-door).

**Status.** Done in the library: the `AI_SELECTION_HINT` of `OTB30`, `OTB45` and `OTB60`
(section 1.4). Open, not reported to the library development team: the calculation error and
the supported widths per door arrangement.

**Test.** `image-planning-right-wall`, `image-kitchen-back-right-corner`: the first create builds
the resized wall units, or the agent picks the articles that take the width at the first attempt.

**Reproduce.** `mcp-test-2026-10-26_11-51-16`, gpt-6-astra 08 (`image-kitchen-back-right-corner`, local `feat/hi-mcp-performance`, default reasoning): `change-module-attribute` sets root `f9c6aaf1-9cae-48b5-8836-67a7a6eb119a` (`O2TB90`) to width 600 while retaining `LeftRight`, causing Error 14019 (`WallUnit - All - Standard - 240 - mr_StorageunitSingle - 600 - Automatic - LeftRight - Automatic`); exchanging it for `OTB60` with `Left` succeeds.

## 10. Backsplashes the library cannot calculate

**Problem.** The image tests ask for a kitchen like the photo, backsplash included; the agent sets
`mod_CreateBacksplash` — its desc says it "Adds the contour for the backsplash and also starts
generating the backsplashes" — with `mod_BacksplashColor` and `mod_BacksplashHeight`. The library
does not calculate the backsplash — "Error 14034: Could not find entry in tab_GrainDirectionSettings
for input values: part_Backsplash - undefined - undefined - undefined - 600 - 110" — so the
tools discard the change the library cannot calculate before the load (D106): a create that enables
the backsplash on its units is not built and named in `notLoaded`, and a `change-group-attribute`
that enables it on the built group answers "nothing was changed" with the same error — the served
text asks for that second way, so the kitchen stands while the backsplash fails. The agent drops the backsplash and the final answer reports the
omission — the image tests' expects ask for exactly that ("the backsplash visible in the image is
generated when the library supports it").

**Cause.** Not established. Every failure looks up `tab_GrainDirectionSettings` with the three
values after `part_Backsplash` undefined — whether the colour and height come with the create or in
a separate call — and no entry matches. The same separate call built the backsplash on 2026-10-18 on
the local roomle-ui commit `cf377cfd4` (the last row of the table below); that commit is on no branch
any more, only in the reflog of the local roomle-ui checkout, and its Bool retention is on roomle-ui
`master` and `release/bo-test` in `1db06b18c`. Whether the library data or the planner changed since
is open. The descs of `mod_CreateBacksplash`
and `mod_BacksplashColor` invite generating the backsplash and name no limit.

**How the library behaves.**

| Backsplash settings | Built | Where |
|---|---|---|
| `mod_CreateBacksplash` true with `mod_BacksplashColor` 240, `mod_BacksplashHeight` 635 in the create; then a separate `change-group-attribute` with 240 / 635 | no: Error 14034 after both calls (`1200 - 635`) | `mcp-test-2026-10-20_06-45-46` gpt-6-astra 59 |
| `mod_CreateBacksplash` true, no colour; a second create with 240 / 485 | no: Error 14034 (`600 - 110`, `600 - 485`) | `mcp-test-2026-10-20_06-45-46` gpt-6-astra 61 |
| `mod_CreateBacksplash` true with 216 / 500 and 216 / 250 in the create; then separate `change-group-attribute` calls with the same values | no: Error 14034 after both calls (`620 - 500`, `1220 - 250`) | `mcp-test-2026-10-20_06-45-46` gpt-6-astra 62 |
| The switch on a lone `UTB60`, then a separate call with 216 / 500; on a lone `EUTB60`, then 240 / 635; on two `UTB60`, then 240 / 635; the create of run 59, then 240 / 635 | no: Error 14034 after the create and after the separate call (`620 - 500`, `620 - 635`, `1220 - 635`, `1200 - 635`) | bo-test planner, 2026-10-20, without a model |
| The switch on a lone `UTB60`, then a separate call with 216 / 500; on a lone `EUTB60`, then 240 / 635; the right-wall image payload, then 240 / 635 | yes, after the separate call | local roomle-ui `cf377cfd4`, 2026-10-18 |
| `mod_CreateBacksplash` true in the create, then 240 / 635 by `change-group-attribute` (64); the switch in the create, then 240 / 515 in a replace by ids (66); 216 / 550 and 216 / 250 in the create, then the same by `change-group-attribute` (67) | no: Error 14034 after every call (`1200 - 110`, `1200 - 635`; `600 - 110`, `600 - 515`; `600 - 550`, `1220 - 250`) | local roomle-ui `4bc1636cf`, `mcp-test-2026-10-21_08-37-33` gpt-6-astra 64, 66, 67 |
| 240 / 660 in the create (64); 240 / 455 in the create, then the same by `change-group-attribute` (66); the switch with 216 / 500 and 216 / 250 in the create, then the same by `change-group-attribute` (67) | no: Error 14034 after every call (`1200 - 660`; `600 - 455`, `600 - 455`; `620 - 110`, `1210 - 110`, `620 - 500`, `1210 - 250`) | bo-test `c92cf6b11`, `mcp-test-2026-10-21_12-49-36` gpt-6-astra 64, 66, 67 |
| The switch per root in the create, then 326 / 660 by `change-group-attribute` (07); the switch per root in the create of two groups, then 216 / 600 and 216 / 200 by `change-group-attribute` (10) | no: Error 14034 after every call (`1800 - 110`, `1800 - 660`; `600 - 110`, `1470 - 110`, `600 - 600`, `1470 - 200`) | bo-test `83f01375e`, `mcp-test-2026-10-22_07-57-33` gpt-6-astra 07, 10 |
| The switch per root in the create, then 326 / 635 with a thickness of 16 by `change-group-attribute` (07); 216 in the create of two groups, then 216 / 600 and 216 / 200 with a thickness of 16 (10) | no: Error 14034 after every call (`1200 - 110`, `1200 - 635`; `600 - 110`, `1220 - 110`, `600 - 600`, `1220 - 200`) | local roomle-ui `725e0dda3`, `mcp-test-2026-10-22_09-29-56` gpt-6-astra 07, 10 |
| The switch on one root with 326 / 660 in the create, then 240 by `change-group-attribute` (66); the switch per root with 216 in the create of two groups, then 216 / 600 and 216 / 300 with a thickness of 16 (69) | no: Error 14034 after every call (`1200 - 660`, `1200 - 660`; `600 - 110`, `600 - 600`, `1220 - 300`) | bo-test `205cc9bc8`, `mcp-test-2026-10-22_19-45-49` gpt-6-astra 66, 69 |
| The switch on a lone `UTB60` by `change-group-attribute`, alone and with 240 / 635 in the same call | no: Error 14034 on `mr_Backsplash` (`610 - 110`); `mod_CreateBacksplash` has no verified options | local roomle-ui `42d17c4f3`, the probe of 2026-10-24 |

**To do.** Establish which side changed: replay the lone `UTB60` check on roomle-ui `cf377cfd4`
(recover it from the reflog before it expires). `cf377cfd4` reports no library failure after an attribute
command, so the replay reads the `mr_Backsplash` root's log messages, not only the tool result.
Built there, the cause is in roomle-ui and the issue moves to
[roomle-ui-issues.md](roomle-ui-issues.md); not built, the library: the backsplash's entries in
`tab_GrainDirectionSettings` or the inputs of its lookup. The desc in
[section 2.10](../../docs/library-information/suggested-library-changes.md#210-backsplash) tells the
agent to report a backsplash the library does not calculate. It names `notLoaded`, a field of the
HI tools that a library desc does not name, and a `change-group-attribute` that enables the
backsplash answers with an error (D106), not in `notLoaded`: the text is rewritten without the field
once the replay has settled the cause. Then check that the served text needs
nothing more.

**Status.** Done in the library: the proposed desc of `mod_CreateBacksplash` (section 2.10).
Open: its result-field wording. The calculation failure is not reported to the library development
team until the replay places the cause in the library.

**Test.** `image-kitchen-left-wall`, `image-planning-right-wall`, `image-only-no-text`: the backsplash
of the image is generated; where it is not, the answer reports the omission.

**Reproduce.** `mcp-test-2026-10-27_07-11-41`, gpt-6-astra 68 (`image-kitchen-left-wall`, bo-test): after the create built the kitchen, `change-group-attribute` sets `mod_CreateBacksplash` true on group `98039b08`; the generated `mr_Backsplash` fails Error 14034 (`part_Backsplash - undefined - undefined - undefined - 620 - 110`), nothing is changed, and the answer names the missing splashback.

## 11. A handle strip the library cannot calculate

**Problem.** For a modern kitchen the agent sets the handle strip (Furniture_Smith
`mod_HandleDesign` 40) on the group. The library calculates none of the root modules with a handle:
the server builds the dishwasher, the panels and the hood and names the other 14 of the 20 roots in
`notLoaded`. The agent undoes the create and sends it again with rail handles (20).

The library also replaces the handle design the agent sets in the group attributes: the rail handle
(20) becomes the strip (40) or the curved bow (100), the strip (40) and the rectangular handle (60)
become the curved bow (100), the curved bow (100) becomes the strip (40). The server reports each
replacement in `corrections`; a strip the library chose itself fails as above. A combination the
handle mapping lacks fails the whole group: the curved bow (100) in stainless steel matt brushed at
the default length 160 (Error 13003, "Could not find entry in tab_HandleMapping").

**Cause.** A library bug (D99): the strip (40) is `Normal` in the verified options of `UTB60` and its
door, so the library accepts it, and the probe of 2026-10-24 gives Error 22025 for it on a lone
`UTB60` by `change-group-attribute`. Not analysed further. The library answers with three errors:
"Error 22025: There is a HandleStripe selected in the HandleDesign and the HandlePosType selected is
not valid" for the corner unit, the tall units and the wall units; a raw "Unexpected token 'N',
\"None\" is not valid JSON" for the base units; and "The variant 'mod_HandleDrill' is not set in
'mc_Handlestrip01'" for the sink unit. The agent sent no `mod_HandlePosType`; with
`mod_HandlePosType` 03 sent, a strip the library chose fails with Error 22025 as well. Which value a handle strip needs, and whether the JSON error is a
defect of the library's script, is open. The `desc` of `mod_HandleDesign` does not say that a handle
strip needs another handle position. Which group attributes make the library replace the handle
design — the front program, the handle colour or the handle length — is open too; the descs of the
handle designs do not say which of them each takes.

**To do.** The library: say in the `desc` of the handle strip value which `mod_HandlePosType` it
takes, and set it with the strip — the strip `Conflicting` in the verified options, its conflict
resolution setting the handle position —, or calculate the strip with the handle position the unit
has; say in the descs of the handle designs which front programs,
handle colours and lengths each takes; report the JSON parse error of the base units to the library
development team. The proposed text goes into
[`suggested-library-changes.md`](../../docs/library-information/suggested-library-changes.md) once
the handle position is known.

**Status.** Open, not reported to the library development team.

**Test.** `kitchen-conversation`, `kitchen-oven-hood-sink-fridge-corner`,
`kitchen-oven-fridge-sink-corner`: a kitchen with a handle strip is built at the first create, or
the agent picks a handle the library keeps and calculates.

**Reproduce.** `mcp-test-2026-10-27_07-11-41`, gpt-6-astra 67 (`image-only-tall-units`, bo-test): the group attributes of the create (`mod_HandleDesign` with `mod_HandlePosType`) and three `change-group-attribute` calls fail with HandleStripe Error 22025 on three `KS_HT600`; the finishes apply once the agent sends them without the handle.

## 12. A worktop on the tall units from the group's countertop switch

**Problem.** The agent sets `mod_CreateCountertop` true in the group attributes of a kitchen with
tall units. The library puts the worktop on every root that carries the attribute, tall units
included: the oven tower and the pantry carry a worktop on top (visible in the object image). The
agent switches it off root by root and misses some.

**Cause.** Not analysed. Without the group attribute the library puts the worktop over the base units
only (an `HTB60` beside two drawer units has none); with it, the tall units get one. The `desc` of
`mod_CreateCountertop` does not say that it reaches every root module of the group.

**To do.** The library: say in the `desc` of `mod_CreateCountertop` that set on the group it puts a
worktop on the tall units too, and that the base units get one by default — once the library's
default is confirmed, the text goes into
[`suggested-library-changes.md`](../../docs/library-information/suggested-library-changes.md).

**Status.** Open, not reported to the library development team.

**Test.** `image-kitchen-back-right-corner`: no tall unit carries a worktop.

**Reproduce.** `mcp-test-2026-10-21_12-49-36`, gpt-6-astra 65 (`image-kitchen-back-right-corner`,
bo-test): `mod_CreateCountertop` true in the group attributes of `3097c084`; the model switched it off
on `HK260`, its end panel and the wall units, the worktop stays on `H2TB60` and `HOTS2AB60`.

## 13. A drawer sideboard lowered to 720 mm the library cannot calculate

**Problem.** For a sideboard of "low cabinets" the agent lowers three living-room sideboards to
720 mm (`mod_Height` 720 on two `SB_UB600` and one `SB_US600`). The library calculates the door
sideboards but not the drawer sideboard — "Error 13008: Could not find entry in
tab_DrawerBoxDimensionMapping for input values: Legrabox - 322 - 30.5" — so it is not built; the
server builds the other two and names it in `notLoaded`. The agent undoes the create and sends it
again with three door sideboards.

**Cause.** A library bug (D99): the library accepts the height but cannot calculate the drawer
boxes for it. `mod_Height` is a `Dim` whose master data names no range and for which the module
gives no verified options, and the drawer sideboard
takes four drawers with fixed front heights (`mod_FrontHeightSelection` 290, 290, 160, …); lowered
by 180 mm, the drawer box mapping has no entry for the resulting box. The descs of `SB_US600` and of
`mod_Height` name no height limit.

**How the library behaves.** Checked in the stored runs:

| Article | Height | Built | Runs |
|---|---|---|---|
| `SB_UB600` (1 door) | 720 mm, lowered from 900 | yes | `mcp-test-2026-10-22_19-45-49` gpt-6-astra 60, both creates |
| `SB_US600` (4 drawers) | 720 mm, lowered from 900 | no: Error 13008 (`tab_DrawerBoxDimensionMapping`) | `mcp-test-2026-10-22_19-45-49` gpt-6-astra 60, the first create; the probe of 2026-10-24 (`Legrabox - 322 - 30.5`) |
| `SB_US600` (4 drawers) | 800 mm, lowered from 900 | no: Error 13008 (`Legrabox - 322 - 40.5`) | `mcp-test-2026-10-27_07-11-41` gpt-6-astra 75, the first create |
| `SB_US600` (4 drawers) | 900 mm, as it comes | yes | `mcp-test-2026-10-27_07-11-41` gpt-6-astra 75, the second create |

Not known: the heights the drawer sideboard takes, and whether the other drawer articles of the
library fail the same way when lowered.

**To do.** The library: calculate the drawer sideboard at every height `mod_Height` accepts (entries
in `tab_DrawerBoxDimensionMapping`), or declare the heights it takes as the verified range of
`mod_Height`, so that a height outside it is ruled out before the edit — the tools check a value
against the verified options before they set it (D107).
With the heights known, the proposed desc of `SB_US600` naming them goes into
[`suggested-library-changes.md`](../../docs/library-information/suggested-library-changes.md).

**Status.** Open, not reported to the library development team.

**Test.** `sideboard-living-room-front-wall`: the first create builds every sideboard the agent
sends, or the agent keeps a drawer sideboard at a height the library takes.

**Reproduce.** `mcp-test-2026-10-27_07-11-41`, gpt-6-astra 75 (`random-1-drawer-sideboard-under-window`, bo-test): the first create sends three `SB_US600` with `mod_Height` 800, fails Error 13008 (`Legrabox - 322 - 40.5`) and builds nothing; the second create sends them without `mod_Height` and builds the row under the window.

## 15. The shelf descriptor names no format

**Problem.** The number of adjustable shelves cannot be set. `AdjShelves` carries no input for it,
and the library spaces its shelves over the free height. The only attribute that names a quantity,
`mod_ShelfadjDescriptor` (Descriptor, `Text`, user right `Master`), carried by the door module of
`HTB60` and by `me_ShelfadjMultiple01`, names no format. A request for one more adjustable shelf
therefore cannot be met.

**Cause.** The desc explains the default spacing for an empty descriptor but gives neither the
format nor an example: it contains the placeholder "the format, with an example (to be named by
the library)".

**How the library behaves.** Checked model-free on bo-test: `change-module-attribute` of
`mod_ShelfadjDescriptor` on the door module `mf_Door` of the middle `HTB60` with `5`, `5x`, `5*` and
`1;2;3;4;5` removes every shelf, without an error or a log message. Empty, the library renders its
four shelves. A `FixedShelf` followed by `AdjShelves` in the container left beside it fails the
calculation.

**To do.** The library: the format of the descriptor, with an example, in the desc of
`mod_ShelfadjDescriptor` — section 2.11 of
[`suggested-library-changes.md`](../../docs/library-information/suggested-library-changes.md#211-shelf-descriptor),
completed once the library development team names the format.

**Status.** The proposed text is in the library (section 2.11), including its placeholder. Open:
the actual format and an example from the library development team.

**Test.** With the format known, `edit-add-subarticle-look-inside`: the middle cabinet shows five
adjustable shelves.

**Reproduce.** `.temp/result/repro-one-more-shelf-2026-10-24/descriptor.mjs` on bo-test, the plan
`ps_s3p5hmscmmsnshopj2tybjwmt7ijy5o`: after each of the four values the door module renders no
`part_ShelfadjWood`.

## 16. A built-in microwave selected on the tall oven housing is not built

**Problem.** The image tests show a tall unit with a microwave built in above the oven; the agent
selects the microwave — `mod_OvenId2` BE732R1B1, whose value desc is "Built-in microwave" — on the
tall oven housing `HOTS2AB60`. The library accepts the code and keeps it on the oven module, but
builds no microwave: the plan holds one `mf_Oven` and the equipment niche above the oven keeps an
empty `md_EquipmentPlaceholder`. Nothing reports the drop — no error, no `notLoaded`, no
`corrections` — and the plan context does not serve the appliance attributes on the built root, so
the agent cannot detect it and reports the microwave as built.

**Cause.** Not established. `HOTS2AB60` is the only tall oven housing of the kitchen catalog and
its desc names one oven niche ("1 door, 1 oven niche, 1 drawer and 2 pull-outs"); the built unit
carries three drawers, the oven at 816 mm and a door at 1804.5 mm over an empty equipment
placeholder. The master data offers `mod_OvenId1`, `mod_OvenId2` and `mod_OvenId3` ("Article code
1/2/3", group Oven) with the microwave among their selections, on a unit with one appliance niche;
no kitchen unit of the catalog has a second appliance niche. Whether the library should build the
second appliance in the placeholder niche, or rule the selection out (verified options), is open.

**How the library behaves.** Checked in the stored runs:

| Selection | Built | Where |
|---|---|---|
| `HOTS2AB60` with `mod_OvenId1` HB774G1B1 (oven) and `mod_OvenId2` BE732R1B1 (Built-in microwave) | one `mf_Oven` at 816 mm; no microwave; `mod_OvenId2` kept on the oven module; the niche above holds `md_EquipmentPlaceholder` only | `mcp-test-2026-10-25_15-24-34` gpt-6-astra 08 (local roomle-ui); the same payload in `mcp-test-2026-10-22_19-45-49` gpt-6-astra 67 (bo-test `205cc9bc8`) builds the same |

**To do.** The library: build the second appliance in the equipment niche of `HOTS2AB60`, or rule
the microwave out of `mod_OvenId2` on the single-niche units (an `Invalid` entry in its verified
options, D107). The desc of `HOTS2AB60` in
[section 1.7](../../docs/library-information/suggested-library-changes.md#17-tall-oven-housing) and
of `mod_OvenId1` to `mod_OvenId3` in
[section 2.12](../../docs/library-information/suggested-library-changes.md#212-oven-article-codes)
tell the agent that the unit carries one built-in appliance.

**Status.** Done in the library: the desc of `HOTS2AB60` (section 1.7) and of `mod_OvenId1`,
`mod_OvenId2` and `mod_OvenId3` (section 2.12). Open, not reported to the library development team:
the missing second appliance and its verified options.

**Test.** `image-kitchen-back-right-corner`: the tall unit at the far end of the long leg carries
the microwave above the oven, or the answer reports that the library cannot build it.

**Reproduce.** `mcp-test-2026-10-25_15-24-34`, gpt-6-astra 08 (`image-kitchen-back-right-corner`):
the create sends `HOTS2AB60` with `mod_OvenId1` HB774G1B1 and `mod_OvenId2` BE732R1B1 — `plan.xml`
holds one `mf_Oven` and no microwave; the same in `mcp-test-2026-10-22_19-45-49` gpt-6-astra 67.

## 17. A Bora hob on the base hob cabinet UKS2A90 the library cannot calculate

**Problem.** The image tests put a hob with built-in extraction (a Bora `PUXU`) on the island; the
agent selects it on the base hob cabinet `UKS2A90`. The library cannot calculate the unit —
"Error 13008: Could not find entry in tab_DrawerBoxDimensionMapping for input values: Legrabox -
533 - 0" — so it is not built; the server names it in `notLoaded` and builds the rest. The agent
replaces it with the base appliance cabinet `UKB2A90`, which carries the same hob.

**Cause.** A library bug (D99): the hob selection is accepted (the calculation fails in the drawer
box mapping, not in a hob lookup), and `UKS2A90` calculates with a Siemens hob. Which input the
missing entry needs — the Bora hob's installation depth, the drawer configuration under it, or the
900 mm width — is open.

**How the library behaves.** Checked in the stored runs:

| Article | Hob | Built | Where |
|---|---|---|---|
| `UKS2A90` | Bora `PUXU`, `mod_HandleDesign` 20 | no: Error 13008 (`Legrabox - 533 - 0`) | `mcp-test-2026-10-25_15-24-34` gpt-6-astra 09, the first create |
| `UKB2A90` | Bora `PUXU` | yes | `mcp-test-2026-10-25_15-24-34` gpt-6-astra 09, the rebuild |
| `UKS2A90` | Siemens `EX975LXC1E` | yes | `mcp-test-2026-10-25_15-24-34` gpt-6-astra 06 |

**To do.** The library: an entry in `tab_DrawerBoxDimensionMapping` for the drawer boxes of
`UKS2A90` under a Bora hob, or the hob ruled out for the unit (verified options). No desc change
proposed — the unit and the hob are both wanted.

**Status.** Open, not reported to the library development team.

**Test.** `image-planning-right-wall`: the island carries its hob unit with the Bora hob at the
first create, without a replacement.

**Reproduce.** `mcp-test-2026-10-26_11-51-16`, gpt-6-astra 09 (`image-planning-right-wall`, local `feat/hi-mcp-performance`, default reasoning): the first create sends `UKS2A90` with `mod_HobSupplier` Bora, `mod_HobId` PUXU and no-handle setting 10; the island fails Error 13008 (`Legrabox - 533 - 0`) while the tall bank builds. Resubmitting the island with `UKB2A90` and the same hob succeeds; snapshot `ps_sxj11r22858wir474hwiftq77oshh62c` contains both groups.

## 18. A wide paired-door wall cabinet with a push opening the library cannot calculate

**Library.** HOMAG Furniture_Smith. **Responsible.** HOMAG library development team.

**Problem.** A 1500 mm-wide, 600 mm-high `O2TB90` with paired doors, no handle and
`PushToOpenManual` cannot calculate. The create reports Error 15002 in
`tab_HingePosition` and leaves the plan unchanged. The agent uses nominal-width hinged upper
cabinets instead of the wide upper block of the image.

**Cause.** The hinge lookup has no entry for `WallUnit`, `StandardPanel01`, front height 600,
front width 750, `NoFingergrip` above and below, handle design 10 and handle position
`HandleLine`. The request passes the tool's library-backed value checks without a range or
invalid-value correction. Which dimension or opening combination needs another hinge configuration
is not isolated; this is an accepted configuration the library cannot calculate (D99), separate
from the door-direction lookup of issue 9.

**How the library behaves.** The failing third create of run 72 sends `mod_Width` 1500,
`mod_Height` 600, `mod_DoorDirectionSelection` `LeftRight`, `mod_HandleDesign` 10 and
`mod_OpeningType` `PushToOpenManual` on `O2TB90`. The fourth create uses a nominal
`O2TB90` and `OTB60` with handles, and builds. The supported dimensions and opening
combinations between those configurations are not established.

**To do.** The library: calculate each accepted width, height and opening configuration, or expose
the supported combinations through verified options/ranges before calculation. Establish the
missing hinge configuration before proposing article-description limits; no exact width limit
or new desc is inferred from this one failing combination.

**Status.** Open, not reported to the library development team.

**Test.** `image-only-no-text-2`: a supported wide upper block builds on the first create, or
the library's verified options guide the agent to compatible nominal-width units.

**Reproduce.** `mcp-test-2026-10-25_18-06-08`, gpt-6-astra 72 (`image-only-no-text-2`,
bo-test), the third `create-or-replace-groups`: root `upper`, `O2TB90` with the values
above, Error 15002. Its payload and diagnostic are in `run.json` and `planner-calls.json`.

## 19. A traditional front program with a retained plain colour the library cannot calculate

**Library.** HOMAG Furniture_Smith. **Responsible.** HOMAG library development team.

**Problem.** Selecting `mod_FrontProgram` `Tradition` on a kitchen whose front colour is
Light grey 178 cannot calculate its doors and drawers. The library returns Error 14036 in
`tab_PanelWoodFrameConstruction`; the attribute transaction is not applied.

**Cause.** The traditional frame lookup receives `TraditionFrame01 - NoGrain - NoGrain -
WoodVertical` for both Door and Drawer. A program change keeps the incompatible plain colour
without supplying a compatible wood colour through conflict resolution. The tool's value check
permits the request, so the failure is an accepted library configuration (D99).

**How the library behaves.** Light grey 178 with the program `Tradition` supplied in the create
switches the program to `Classic`. Selecting `Tradition` alone afterwards fails Error 14036.
Setting Maple 230, then selecting `Tradition`, calculates the framed fronts. Setting the
program and wood colour together can resolve back to `Nature`, so the measured order matters.
The supported full colour range of `Tradition` is not established by this run.

**To do.** The library: selecting `Tradition` resolves its colour conflict to a compatible
wood colour, or exposes the incompatible combination in verified options before calculation.
Apply the proposed sequencing guidance of `Tradition` in
[section 2.2](../../docs/library-information/suggested-library-changes.md#22-front-program),
which keeps the compatibility information in library data.

**Status.** The desc is proposed, not applied. The calculation error is not reported to the
library development team.

**Test.** `image-kitchen-tall-column-right-corner`: switching to the supported traditional
frame style calculates or resolves the colour conflict before any failed transaction, with an
accurate final answer about available colours.

**Reproduce.** `mcp-test-2026-10-25_18-06-08`, gpt-6-astra 73
(`image-kitchen-tall-column-right-corner`, bo-test): the first `change-group-attribute`
sets `mod_FrontProgram` `Tradition` on group `b8e61d93-d008-42fb-9910-4936b079a906`,
whose roots retain front colour 178, and fails Error 14036. The same program calculates after
front colour 230 is applied.

## 20. A push-to-open sink unit without the front gap it needs the library cannot calculate

**Library.** HOMAG Furniture_Smith. **Responsible.** HOMAG library development team.

**Problem.** A create of a handleless kitchen sends the sink unit `SUT60` with `mod_HandleDesign`
10 (no handle, no fingergrip) and `mod_OpeningType` `PushToOpenManual`. The library cannot
calculate it — "Error 22006: Could not calculate the position of the push to open: The gap between
the front and the carcase needs to set to a minimum of: 3.1" — so the create builds nothing; the
agent sends the kitchen again without the push opening.

**Cause.** A library bug (D99): the library accepts `PushToOpenManual` on the unit but cannot place
the push-to-open fitting with the gap between front and carcase (`mod_FrontGapCarcase`) the unit
comes with. The library switches dependent attributes itself elsewhere — the front program with
the front colour (D59) — but not the gap with the opening type; the descs of `mod_OpeningType` and
its value name no gap.

**How the library behaves.** Checked in the stored runs:

| Article | Opening | Front gap | Built | Runs |
|---|---|---|---|---|
| `SUT60` | `PushToOpenManual`, `mod_HandleDesign` 10 | as the unit comes | no: Error 22006 | `mcp-test-2026-10-27_07-11-41` gpt-6-astra 72, the first create |

Not known: the gap the unit comes with, whether a gap of 3.1 or more builds it, and which other
articles fail the same way.

**To do.** The library: set the front gap a push opening needs when `mod_OpeningType` selects it,
as it switches the front program with the front colour, or rule the opening out in the verified
options of the units whose gap is too small (D107). With the behaviour known, a proposed desc of
`PushToOpenManual` naming the gap goes into
[`suggested-library-changes.md`](../../docs/library-information/suggested-library-changes.md).

**Status.** Open, not reported to the library development team.

**Test.** `image-only-no-text-2`: a handleless kitchen with push-to-open fronts builds on the
first create.

**Reproduce.** `mcp-test-2026-10-27_07-11-41`, gpt-6-astra 72 (`image-only-no-text-2`, bo-test): the first create sends root `sink`, `SUT60` with `mod_SinkId` `Axis_R`, `mod_HandleDesign` 10 and `mod_OpeningType` `PushToOpenManual`, and fails Error 22006.

## 21. The description of SUT60 names the drainer on the right; its sink reaches over the unit on its left

**Library.** HOMAG Furniture_Smith. **Responsible.** HOMAG library development team.

**Problem.** An image kitchen puts the sink unit `SUT60` beside the oven-and-hob unit `UHS60`:
the hob unit on the left of the sink unit, a base unit on its right, as the unit's
`AI_SELECTION_HINT` asks ("Place a base unit on its right, not a hob unit"). The sink then reaches
410 mm over the hob.

**Cause.** The library delivers `SUT60` with `mod_SinkId` `Metra_R`, basin on the right, whose
drainer reaches past the unit's left side. Its description still names the right side ("reaches 396
mm past its right side, over the unit on its right"), written for `Axia_Grey_L`, the sink it came
with (suggested change 1.1). No description says that the side follows the sink: the drainer lies
opposite the basin. Since D122 the value descs of `mod_SinkId` are not in the prefix, so the
article line is the only sink information of the create.

**How the library behaves.** Measured on the planner, a row `UTB60` | sink unit | `UTB60`
([the analysis](../bug-analysis/sink-unit-description-names-the-wrong-drainer-side.md#3-how-the-library-builds-the-sink)):
`SUT60` with `Metra_R` reaches 410 mm past its left side; `SUBA60` and `ESUT60` with
`Axia_Grey_L` 395.8 mm past their right side, `SUB2A90` and `ESUB2A90` 245.8 mm. A value ending in
`_L` reaches right, one ending in `_R` left, about 400 mm past a 60 cm unit and 250 mm past a
90 cm unit (Dinas 340 / 190 mm, Metra 410 / 260 mm). `None` leaves an outline like a basin-left
sink.

**To do.** The library: the desc of the value `Axia_Anthrazit_R` is the proposed text alone, without
the pasted table row (2.8 of
[`suggested-library-changes.md`](../../docs/library-information/suggested-library-changes.md#28-sink)); explain what `None` builds; when the sink a unit
comes with changes, change its `FUNCTION` line with it.

**Status.** Done in the library: the descriptions of the five sink units (1.1) and of
`mod_SinkId` and its values (2.8), checked 2026-10-28 against the article list and the master data.
Open, not reported to the library development team: the desc of `Axia_Anthrazit_R`, which carries
the pasted table row "Axia color anthrazit basin right | see 2.8 | …", and what `None` builds.

**Test.** `image-kitchen-left-wall`, two runs on the build of D122: no run puts the hob unit on the
drainer side of the sink unit; `edit-swap-hob-unit`: the drainer does not cover the hob.

**Reproduce.** `.temp/result/benchmark-09-az-attrs-2026-10-27/iklw-rep-2`, plan
`ps_t26104gn9m11h4qy8df24p5pfeh4sx2e`: the outline of `SUT60` spans y 1150–2160, `UHS60` 960–1560.
