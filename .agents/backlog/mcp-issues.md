# Open MCP issues

> **Type**: Backlog — defects and hardening in the MCP server, chat and planner
> **Domain**: hi-mcp — the served text (`hi-mcp/hi-mcp-server/hi-mcp-server.ts`), the forward of
> the plan-changing tools (`tool-executors.ts`), the chat (`hi-mcp/hi-mcp-chat`); roomle-ui — the HI
> tool commands (`hi-tool-commands.ts`, `hi-group-layout.ts`, `hi-group-placement.ts`,
> `hi-wall-placement.ts`, `hi-tool-hints.ts`) and the defects the runs show
> **Maintained by**: step 7 of [the testing skill](../skills/hi-mcp-testing.md#7-open-issues)

These are issues in the MCP server, chat or planner detected by the MCP prompt tests.

Each issue names the problem, its cause, the to-do, the test of the fix and how to reproduce it; the
overview names the module, team or repository responsible for the fix, and the model and the
reasoning effort of the run that reproduces it — empty where it is unknown; a model the chat sends
no effort for runs at its provider's default. Library data issues are tracked in
[library-issues.md](library-issues.md). An issue leaves this document when its fix is in the code.
The guideline for every server issue is
[Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort): wrong content an agent creates
is an instruction problem first; correct where the intent is clear, report what was corrected, and
never drop the agent's content silently.

## Overview

| # | Issue | Kind | Responsible | Priority | Model | Reasoning effort |
|---|---|---|---|---|---|---|
| 72 | [The wall units hang at two heights after a plinth height in the group attributes](#72-the-wall-units-hang-at-two-heights-after-a-plinth-height-in-the-group-attributes) | defect | analysed: roomle-ui `create-or-replace-groups` tool command (`hi-tool-commands.ts`, `hangGapOf` in `hi-group-layout.ts`) — the wall unit's height is fixed at the load with the library's default plinth (D36, D42); the library lifts some wall units when the plinth changes, the rest stay low. Fix proposed in [the analysis](../bug-analysis/wall-units-hang-at-two-heights-after-plinth-change.md), to be based on roomle-ui `fix/room-corners-at-openings` | medium | gpt-6-astra | |
| 73 | [A wall-level article of another category is taken for a floor unit](#73-a-wall-level-article-of-another-category-is-taken-for-a-floor-unit) | defect | analysed: roomle-ui `isWallUnitArticle`, `relationsToDocking` (`hi-group-layout.ts`) — the classifier knows a wall unit by a category word only; the library data marks wall-level articles (`mod_TypeElement`, the default mounting height) and the tool does not read the marks. Fix proposed in [the analysis](../bug-analysis/wall-level-article-of-another-category-taken-for-floor-unit.md), to be based on roomle-ui `fix/room-corners-at-openings` | low | gpt-6-astra | |
| 74 | [An island's back row of other widths lands off the front row](#74-an-islands-back-row-of-other-widths-lands-off-the-front-row) | hardening | analysed: roomle-hi-example served text (`hi-mcp-server.ts`, `behind`) — the description says neither where a turned unit lines up with a wider neighbour nor which way the relations run in a turned row; roomle-ui `pairOf` for `behind` (`hi-group-layout.ts`) — the compile pins the turned unit at the neighbour's left end with offset 0 and no field to name the other end. Fix proposed in [the analysis](../bug-analysis/islands-back-row-of-other-widths-lands-off-the-front-row.md): the served text first, the `align` the server derives the offset from along the neighbour's width axis as the fallback, to be based on roomle-ui `fix/room-corners-at-openings` | low | gpt-6.1-sol | |
| 75 | [The backsplash of an image kitchen is reported as not buildable](#75-the-backsplash-of-an-image-kitchen-is-reported-as-not-buildable) | hardening | analysed: roomle-hi-example served text (`hi-mcp-server.ts`, the `notCarried` sentence of `create-or-replace-groups`) — the sentence presents a not-carried attribute as a part the library will not build and asks the agent to report it; roomle-ui `compactMasterData` (`hi-plan-context.ts`) — the attribute that switches the generated part on is not customer-facing, so the vocabulary and `find-attributes` do not serve it and the agent cannot find it. Fix proposed in [the analysis](../bug-analysis/backsplash-of-an-image-kitchen-reported-as-not-buildable.md): the served sentence and the served vocabulary (roomle-ui, based on `fix/room-corners-at-openings`); the library data (the switch's `userRight`) as the smaller alternative | medium | gpt-6-astra | |
| 77 | [An edit that gives a row a new end leaves a door hinged to the outside](#77-an-edit-that-gives-a-row-a-new-end-leaves-a-door-hinged-to-the-outside) | hardening | analysed: roomle-hi-example served text (`hi-mcp-server.ts`, the descriptions of the edit tools) — the rule of D84 reaches the chats only through `get-authoring-rules`, which a conversation of edits fetches not, and the descriptions of the five tools that can give a row a new end do not name it. Fix proposed in [the analysis](../bug-analysis/edit-that-gives-a-row-a-new-end-leaves-a-door-hinged-to-the-outside.md): one sentence in the five descriptions, in roomle-hi-example only | medium | gpt-6-astra | |

`run.json` and `planner-calls.json` of the run directories named under **Reproduce** hold the payload
the model sent; the directories are under `.temp/result/`.

## 72. The wall units hang at two heights after a plinth height in the group attributes

**Problem.** A create whose group attributes set a plinth height other than the library's
(`mod_PlinthAreaHeight` 150 or 120 against 100) hangs the wall units of one kitchen at two heights.
The library raises the floor and tall units by the difference and some of the wall units, the
corrections name them (D59); the other wall units, and in some runs the range hood, keep the height
of the old plinth, 50 or 20 mm below the tall units that D35 hangs them flush with. Which wall units
stay low is tied neither to the article (`O2TB90`, `OTB60` and `OTB30` stay low in one run and rise in
another) nor to standing beside a tall unit.

**Cause.** Analysed in [the bug analysis](../bug-analysis/wall-units-hang-at-two-heights-after-plinth-change.md).
The height of a wall unit is fixed at the load as an absolute insertion height computed with the
library's default plinth: the group attributes — which carry the plinth height — are applied only
after the load (D36), and the docking that hung the wall unit above its carrier (Bottom on Top plus
the hang gap) does not survive the load as a link (D42: the docking context links only touching
vectors). When the plinth attribute then lifts the floor and tall units, the kernel moves only the
wall units whose vectors still touch a risen unit (stacks `onTop`, wall units beside tall units),
and the library's recalculation lifts some of the wall units hung above floor units by the same
delta (D59 names them) and leaves the others at the load-time height — 50 or 20 mm below the tall
units' top that D35 hangs them flush with. Which wall units the library lifts is its server-side
calculation logic: across the stored runs the same article above the same carrier rises in one run
and stays in another, so the split cannot be predicted from the served data.

**To do.** Fix, proposed in [the analysis](../bug-analysis/wall-units-hang-at-two-heights-after-plinth-change.md),
in roomle-ui `create-or-replace-groups` (based on `fix/room-corners-at-openings`): after the group
attributes are applied, re-assert the hang of every wall unit hung above a floor unit — its bottom
at its carrier's new top plus the compiled gap (`gapMm`, else the D35 `hangGapOf`) — and report the
lift as a correction. Then every wall unit hung above a floor unit stays flush with the tall units
after the group attributes change the plinth height — no change of the served text. The kernel
(RoomleCore) and the library (HOMAG, server-side calculation) are the root-cause alternatives named
in the analysis.

**Test.** A roomle-ui test of `create-or-replace-groups` with `mod_PlinthAreaHeight` in the group
attributes (`__tests__/hi-tool-commands/create-or-replace-groups-input-test.ts`), and
`kitchen-back-right-corner`: every wall unit's top at the tall units' top.

**Reproduce.** `mcp-test-2026-10-17_13-28-41`: gpt-6-astra 49 (`image-kitchen-back-right-corner`, the second `create-or-replace-groups`): `mod_PlinthAreaHeight` 150 in the group attributes; the two `OTB45` above the base unit at 1480 to 2200, the floor units at 870 and the fridge-freezer `HK260` to 2250 (`obstacles.groups` of `plan-context.json`); the corrections name no wall unit.

## 73. A wall-level article of another category is taken for a floor unit

**Problem.** The agent puts the wall-unit side panel `W35O` ("Wall-unit side / cover panel",
category "Kitchen / Cover Panels / Side Panels") `rightOf` a wall unit to close the wall-unit row.
The tool command takes it for a floor unit — "floor unit 'wallend' cannot stand rightOf the wall unit
'cups' - it continues the floor row" —, drops the relation, puts it `rightOf` the last root by
default and docks it at the free end of the floor leg, where a wall-unit panel stands on the floor.

The same happens to `above`: the open utility wall units `HWR_WR600V1` (category "Utility",
`mod_TypeElement` WallUnit in the library data) `above` a base unit are taken for floor units and put
`rightOf` it — "root 'openwall1' is no wall unit - it stands rightOf … instead of above it" —; the agent
needs an undo and two `merge-article-into-group` calls with `mod_PlacementLevels` WallHanging to hang
them.

**Cause.** Analysed in [the bug analysis](../bug-analysis/wall-level-article-of-another-category-taken-for-floor-unit.md).
`isWallUnitArticle` (`hi-group-layout.ts`) knows a wall unit by the words "Wall Units" in
the category, or a hood; a wall-level article of another category counts as a floor unit, and the
correction for a floor unit beside a wall unit moves it. The correction changes what the agent
asked for instead of carrying it out ([Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort):
correct only where the intent is clear). The library data marks every wall-level article —
`mod_TypeElement` `WallUnit` on the 21 wall-unit-typed articles, the default mounting height
(`mod_HeightPosInsertion` 1380/1580) on the 14 articles that hang — and reaches the tool in the
catalog's `mainAttributes` and `dimensions`; the classifier reads neither.

**To do.** Fix, proposed in [the analysis](../bug-analysis/wall-level-article-of-another-category-taken-for-floor-unit.md),
in roomle-ui `isWallUnitArticle` (`hi-group-layout.ts`, based on `fix/room-corners-at-openings`):
tell wall-level articles from floor articles by the data the library gives every article — the
`mod_TypeElement` `WallUnit` mark or the default mounting height — rather than by a category word,
so an article `rightOf` a wall unit docks beside it and a wall-level article `above` a floor unit
hangs above it. The corrections stay for genuine floor units, where moving them to the floor row is
right.

**Test.** `__tests__/hi-group-layout-test.ts`: a wall-level panel `rightOf` a wall unit docks to the
wall unit's side, and a wall-level article of another category `above` a floor unit hangs above it.

**Reproduce.** `mcp-test-2026-10-17_13-28-41`: gpt-6-astra 54 (`random-1-utility-room-right-wall-with-wall-units`, turn 2, the `create-or-replace-groups`): `openwall1` and `openwall2` (`HWR_WR600V1`) `above` the two `HWR_UB600`, the corrections "is no wall unit - it stands rightOf …" on both.

## 74. An island's back row of other widths lands off the front row

**Problem.** For an island with a front row of 900, 600 and 900 mm units and a back row of four
600 mm units, the agent docks the first back unit `behind` the 900 mm unit at the end of the front
row and the others `rightOf` it. The back row lines up with the inner end of that unit and runs past
the far end of the front row: 300 mm off at both ends, a step in the worktop.

**Cause.** Analysed in [the bug analysis](../bug-analysis/islands-back-row-of-other-widths-lands-off-the-front-row.md).
The served description of `behind` ("back to back with that root module, turned by 180 degrees (an
island)", `hi-mcp-server.ts`) says neither where a turned unit lines up with a wider neighbour nor
which way `rightOf` runs in the turned row, and the compile (`pairOf` for `behind`,
`hi-group-layout.ts`) pins the turned unit at the neighbour's left end, seen from the neighbour's
front, with offset 0 and no field to name the other end (`align` is read for every relation but
ignored for `behind`, `gapMm` is ignored, G37). The agent's natural composition — the first back unit
behind the row's end unit, the back row continuing `rightOf` — then lands the back row off the front
row by the width difference at both ends; the mirror composition (behind the row's first unit,
continuing `leftOf`) lands flush, which the other stored runs show.

**To do.** Fix, proposed in [the analysis](../bug-analysis/islands-back-row-of-other-widths-lands-off-the-front-row.md),
in roomle-hi-example first: clarify the description of `behind` (`hi-mcp-server.ts`) — where a turned
unit lines up and which way the relations run in a turned row, in library-neutral words, with the
composition that lines a back row up with the row in front of it. If that does not suffice, simplify
the API in roomle-ui `pairOf` (`hi-group-layout.ts`, based on `fix/room-corners-at-openings`): the
server lines up a unit `behind` a wider one at the end the agent names (`align`) and derives the
offset from the catalog widths along the neighbour's width axis in the group's frame.

**Test.** `image-planning-right-wall`: the island's two rows end flush at both ends.

**Reproduce.** `mcp-test-2026-10-16_19-30-19`: gpt-6.1-sol 48 (`image-planning-right-wall`, the second `create-or-replace-groups`, the island group): `rear1` (`EUTB60`) `behind` `islandright` (`EUS2A90`), `rear2` to `rear4` `rightOf`; back row z -3240 to -840 against the front row z -2940 to -540.

## 75. The backsplash of an image kitchen is reported as not buildable

**Problem.** For a kitchen image with a backsplash, the agent sends `mod_BacksplashColor` and
`mod_BacksplashHeight` in the group attributes of `create-or-replace-groups`, but not the attribute
that generates the backsplash (Furniture_Smith: `mod_CreateBacksplash`, "Adds the contour for the
backsplash and also starts generating the backsplashes"). No root module carries the two attributes,
the result lists them in `groupAttributes.notCarried` (D65), and the agent tells the user that the
backsplash cannot be built. The same agent switches the worktop on with `mod_CreateCountertop`.

**Cause.** Analysed in [the bug analysis](../bug-analysis/backsplash-of-an-image-kitchen-reported-as-not-buildable.md).
Two causes compound. The `notCarried` sentence of the `create-or-replace-groups` description
(`hi-mcp-server.ts`): "the library builds no part for them in this group, a backsplash or an end
panel for example, so the group stands without them, nothing to undo; say in the answer which
material is not built" — presents the missing part as final and asks the agent to report it; it does
not say that a part the library generates may wait for an attribute of the units that switches it
on. And the switch itself is not served: `compactMasterData` (roomle-ui `hi-plan-context.ts`) keeps
only customer-facing attributes, and the library marks the generation switch `mod_CreateBacksplash`
Advanced while its sibling `mod_CreateCountertop` is Simple — so neither the attributes section of
`get-plan-context` nor `find-attributes` shows it. The agent sets the backsplash's material
attributes (Simple, carried by the generated root module), they are carried by no unit of the group,
the result lists them in `notCarried`, and the agent reports the backsplash as not built.

**To do.** Fix, proposed in [the analysis](../bug-analysis/backsplash-of-an-image-kitchen-reported-as-not-buildable.md),
in two parts. roomle-hi-example: clarify the `notCarried` sentence in library-neutral words — an
attribute no unit carries can belong to a part the library generates only when an attribute of the
units switches it on; look for that attribute and set it; say in the answer only what still is not
built — and leave out the example "a backsplash or an end panel" (kitchen vocabulary, see the library
neutrality item in [mcp-policy-issues.md](mcp-policy-issues.md)). roomle-ui (based on
`fix/room-corners-at-openings`): serve the generation switches — `compactMasterData` keeps also the
Bool attributes the root modules carry — so the switch is in the vocabulary and `find-attributes`
finds it. The smaller alternative is the library data: the switch's `userRight` Simple, like
`mod_CreateCountertop` (a library issue, [library-issues.md](library-issues.md)).

**Test.** `it('asks the agent to say which group material the library does not build')` in
`hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` checks the new sentence, and
`image-kitchen-left-wall`, `image-planning-right-wall`, `image-only-no-text`: the image's backsplash
is in the plan (`mod_CreateBacksplash` true and a backsplash root in `order-data.json`).

**Reproduce.** `mcp-test-2026-10-17_13-28-41`: gpt-6-astra 51 (`image-only-no-text`, the `create-or-replace-groups`): `mod_BacksplashColor` 216 and `mod_BacksplashHeight` 500 and 300 in the group attributes, no `mod_CreateBacksplash` (`mod_CreateBacksplash=false` on every root of `order-data.json`); the answer: "the photo's wood backsplash … not built".

## 77. An edit that gives a row a new end leaves a door hinged to the outside

**Problem.** In a conversation of edits the agent swaps the end units of a row or deletes the end
unit, and the new end keeps the door side the library chose — the right end of the row has its
handle on the outside ([D84](../../docs/hi-mcp-behaviour.md#doors-2026-10-17)). The agent did not call
`get-authoring-rules` in these conversations; in the conversations that read the rules, a merge at an
end carries `mod_DoorDirectionSelection` for the new end, and every create sets both ends.

**Cause.** Analysed in [the bug analysis](../bug-analysis/edit-that-gives-a-row-a-new-end-leaves-a-door-hinged-to-the-outside.md).
The rule of D84 is only in `AUTHORING_RULES` (`hi-mcp-server.ts`), which reaches the chats
only through `get-authoring-rules` — they pass no server instructions (§4 of
[`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md#4-how-a-tool-call-runs)) —, and a
conversation of edits fetches no rules. The descriptions of the tools that can give a row a new end —
`swap-root-modules`, `delete-article-in-place`, `delete-article-and-compact`, `exchange-root-module`,
`merge-article-into-group` — do not name it.

**To do.** Fix, proposed in [the analysis](../bug-analysis/edit-that-gives-a-row-a-new-end-leaves-a-door-hinged-to-the-outside.md),
in roomle-hi-example: one library-neutral sentence in the descriptions of these tools: after an edit
that gives a row a new end, the door at that end is hinged at the outer side of the row — set it. The
rule in `AUTHORING_RULES` stays as it is.

**Test.** A unit test in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` checks the sentence in the
five descriptions; `edit-swap-units` and `undo-a-wrong-command`: the new ends hinged at the outer
sides.

**Reproduce.** `mcp-test-2026-10-17_13-28-41`: gpt-6-astra 32 (`edit-swap-units`, turn 2): `swap-root-modules` on the first and the last unit, no `get-authoring-rules` in the conversation; the new right end `0010443c` keeps `Automatic` (left), its handle on the outside of the row (`perspective-object-image.png`).
