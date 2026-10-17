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
| 72 | [The wall units hang at two heights after a plinth height in the group attributes](#72-the-wall-units-hang-at-two-heights-after-a-plinth-height-in-the-group-attributes) | defect | roomle-ui `create-or-replace-groups` tool command (`hi-tool-commands.ts`, `hangGapOf` in `hi-group-layout.ts`) or the planner — not analysed | medium | gpt-6-astra | |
| 73 | [A wall-unit side panel beside a wall unit is moved into the floor row](#73-a-wall-unit-side-panel-beside-a-wall-unit-is-moved-into-the-floor-row) | defect | roomle-ui `relationsToDocking`, `isWallUnitArticle` (`hi-group-layout.ts`) | low | gpt-6.1-sol | |
| 74 | [An island's back row of other widths lands off the front row](#74-an-islands-back-row-of-other-widths-lands-off-the-front-row) | hardening | roomle-hi-example served text (`hi-mcp-server.ts`, `behind`), roomle-ui `relationsToDocking` (`hi-group-layout.ts`) | low | gpt-6.1-sol | |
| 75 | [The backsplash of an image kitchen is reported as not buildable](#75-the-backsplash-of-an-image-kitchen-is-reported-as-not-buildable) | hardening | roomle-hi-example served text (`hi-mcp-server.ts`, the `notCarried` sentence of `create-or-replace-groups`) | medium | gpt-6-astra | |

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

**Cause.** Not analysed. The hang gap of a wall unit `above` a floor unit is relative to the floor
unit (D35, `hangGapOf`: the plinth cancels out); the group attributes are set after the load (D36);
after a reload the kernel's docking no longer links a wall unit to the floor unit it was placed above
(D42). A wall unit placed above a floor unit may therefore keep its height when the floor unit rises.

**To do.** Analyse where the height of the wall units is fixed and why some wall units follow the
plinth and others do not. Then every wall unit hung above a floor unit stays flush with the tall units
after the group attributes change the plinth height — no change of the served text.

**Test.** A roomle-ui test of `create-or-replace-groups` with `mod_PlinthAreaHeight` in the group
attributes (`__tests__/hi-tool-commands/create-or-replace-groups-input-test.ts`), and
`kitchen-back-right-corner`: every wall unit's top at the tall units' top.

**Reproduce.** `mcp-test-2026-10-17_09-31-13`: gpt-6-astra 35 (`kitchen-back-right-corner`): `mod_PlinthAreaHeight` 150 in the group attributes; the two `O2TB90` at 1480 to 2200, the hood at 1530 and the fridge-freezer `HK260` to 2250 (`obstacles.groups` of `plan-context.json`); the corrections name no wall unit.

## 73. A wall-unit side panel beside a wall unit is moved into the floor row

**Problem.** The agent puts the wall-unit side panel `W35O` ("Wall-unit side / cover panel",
category "Kitchen / Cover Panels / Side Panels") `rightOf` a wall unit to close the wall-unit row.
The tool command takes it for a floor unit — "floor unit 'wallend' cannot stand rightOf the wall unit
'cups' - it continues the floor row" —, drops the relation, puts it `rightOf` the last root by
default and docks it at the free end of the floor leg, where a wall-unit panel stands on the floor.

**Cause.** `isWallUnitArticle` (`hi-group-layout.ts`) knows a wall unit by the words "Wall Units" in
the category, or a hood; a wall-level article of another category counts as a floor unit, and the
correction for a floor unit beside a wall unit moves it. The correction changes what the agent
asked for instead of carrying it out ([Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort):
correct only where the intent is clear).

**To do.** Tell wall-level articles from floor articles by data the library gives every article —
its default mounting height or its docking vectors — rather than by a category word, so an article
`rightOf` a wall unit docks beside it; until then, keep an article the agent puts beside a wall unit
there and report it, rather than moving it to the floor row.

**Test.** `__tests__/hi-group-layout-test.ts`: a wall-level panel `rightOf` a wall unit docks to the
wall unit's side.

**Reproduce.** `mcp-test-2026-10-16_19-30-19`: gpt-6.1-sol 50 (`kitchen-conversation`, turn 1, the first `create-or-replace-groups`): `wallend` (`W35O`) `rightOf` the wall unit `cups` (`OFKB60`), the three corrections on `wallend`.

## 74. An island's back row of other widths lands off the front row

**Problem.** For an island with a front row of 900, 600 and 900 mm units and a back row of four
600 mm units, the agent docks the first back unit `behind` the 900 mm unit at the end of the front
row and the others `rightOf` it. The back row lines up with the inner end of that unit and runs past
the far end of the front row: 300 mm off at both ends, a step in the worktop.

**Cause.** The served description of `behind` ("back to back with that root module, turned by 180
degrees (an island)", `hi-mcp-server.ts`) says neither where a turned unit lines up with a wider
neighbour nor which way `rightOf` runs in the turned row. The compile docks the back vectors to each
other (`relationsToDocking`, `hi-group-layout.ts`): in this run the turned unit lines up with its
neighbour's left end, seen from the neighbour's front, and `rightOf` in the turned row runs on to that
side.

**To do.** Clarify the description of `behind` first: where a turned unit lines up and which way the
relations run in a turned row, in library-neutral words. If that does not suffice, simplify the API:
the server lines up a unit `behind` a wider one at the end the agent names (`align`) and derives the
offset.

**Test.** `image-planning-right-wall`: the island's two rows end flush at both ends.

**Reproduce.** `mcp-test-2026-10-16_19-30-19`: gpt-6.1-sol 48 (`image-planning-right-wall`, the second `create-or-replace-groups`, the island group): `rear1` (`EUTB60`) `behind` `islandright` (`EUS2A90`), `rear2` to `rear4` `rightOf`; back row z -3240 to -840 against the front row z -2940 to -540.

## 75. The backsplash of an image kitchen is reported as not buildable

**Problem.** For a kitchen image with a backsplash, the agent sends `mod_BacksplashColor` and
`mod_BacksplashHeight` in the group attributes of `create-or-replace-groups`, but not the attribute
that generates the backsplash (Furniture_Smith: `mod_CreateBacksplash`, "Adds the contour for the
backsplash and also starts generating the backsplashes"). No root module carries the two attributes,
the result lists them in `groupAttributes.notCarried` (D65), and the agent tells the user that the
backsplash cannot be built. The same agent switches the worktop on with `mod_CreateCountertop`.

**Cause.** The `notCarried` sentence of the `create-or-replace-groups` description
(`hi-mcp-server.ts`): "the library builds no part for them in this group, a backsplash or an end
panel for example, so the group stands without them, nothing to undo; say in the answer which
material is not built". It presents the missing part as final and asks the agent to report it; it
does not say that a part the library generates may wait for an attribute of the units that switches
it on.

**To do.** Clarify the sentence first, in library-neutral words: an attribute no unit carries can
belong to a part the library generates only when an attribute of the units switches it on; look for
that attribute (`find-attributes`) and set it, and say in the answer only what still is not built.
Leave out the example "a backsplash or an end panel" (kitchen vocabulary, see the library neutrality
item in [mcp-policy-issues.md](mcp-policy-issues.md)). If that does not suffice, the result names per
attribute in `notCarried` the generated root module that carries it (`assignedAttributes` of the
master data), so the agent looks for its switch.

**Test.** `it('asks the agent to say which group material the library does not build')` in
`hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` checks the new sentence, and
`image-kitchen-left-wall`, `image-planning-right-wall`, `image-only-no-text`: the image's backsplash
is in the plan (`mod_CreateBacksplash` true and a backsplash root in `order-data.json`).

**Reproduce.** `mcp-test-2026-10-17_09-31-13`: gpt-6-astra 46 (`image-kitchen-left-wall`, the `create-or-replace-groups`): `mod_BacksplashColor` 326 and `mod_BacksplashHeight` 650 in the group attributes, no `mod_CreateBacksplash` (`mod_CreateBacksplash=false` on every root of `order-data.json`); the answer: "the dark backsplash could not be built and is not included".
