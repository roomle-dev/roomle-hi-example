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
| 74 | [An island's back row of other widths lands off the front row](#74-an-islands-back-row-of-other-widths-lands-off-the-front-row) | hardening | roomle-hi-example `AUTHORING_RULES` (`hi-mcp-server.ts:30-34`): explain the endpoint and turned-row viewpoint. Conditional roomle-ui fallback: explicit end alignment through endpoint modes in `pairOf` (`hi-group-layout.ts:846-860`), with reciprocal modes when the entry changes owner. [Analysis and verification](../bug-analysis/islands-back-row-of-other-widths-lands-off-the-front-row.md) | low | gpt-6.1-sol | |
| 81 | [The corner-removal correction reports wall units as turned that stay on the back wall](#81-the-corner-removal-correction-reports-wall-units-as-turned-that-stay-on-the-back-wall) | bug | roomle-ui `hi-tool-commands.ts` (the corner-article correction), `hi-root-module-arrangement.ts` (`moveUnitsAboveWithTheirCarriers`) | medium | gpt-6-astra | |
| 82 | [The model asks instead of building the group the user asked for on a wall of floor-to-ceiling windows](#82-the-model-asks-instead-of-building-the-group-the-user-asked-for-on-a-wall-of-floor-to-ceiling-windows) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:42`, the placement rule) | low | gpt-6-astra | |
| 83 | [Where no free stretch of the wall fits the group, it is placed over existing furniture and reported](#83-where-no-free-stretch-of-the-wall-fits-the-group-it-is-placed-over-existing-furniture-and-reported) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:42`, the placement rule) | low | gpt-6-astra | |
| 84 | [The find-attributes answer lists the values without naming the attribute](#84-the-find-attributes-answer-lists-the-values-without-naming-the-attribute) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:252-268`, the `find-attributes` description) | low | gpt-6-astra | |
| 85 | [insert-article-into-group takes a between-pair whose root modules do not stand side by side](#85-insert-article-into-group-takes-a-between-pair-whose-root-modules-do-not-stand-side-by-side) | hardening | roomle-hi-example served text (`hi-mcp-server.ts:700-708,720`); roomle-ui `hi-tool-commands.ts` (the insert's result) | low | gpt-6-astra | |

`run.json` and `planner-calls.json` of the run directories named under **Reproduce** hold the payload
the model sent; the directories are under `.temp/result/`. The root `logMessages` in `plan.xml`'s
`externalConfiguration` retain library calculation diagnostics that compact plan contexts omit.

## 74. An island's back row of other widths lands off the front row

**Problem.** An island with a front row of 900, 600 and 900 mm units and a back row of four
600 mm units has a 300 mm step at both ends. The first rear unit is `behind` the last front unit,
and its row continues `rightOf`.

**Cause.** The served `behind` description (`hi-mcp-server.ts:34`) omits the aligned end and the
viewpoint of side relations in the turned row. `pairOf` (`hi-group-layout.ts:859-860`) emits the
back-vector pair with no mode and zero offset. Its reversed partner frame aligns the turned
cabinet to the target's left end; `rightOf` in the rear row runs towards the front row's left.
For this composition the local extents are front `[0,2400]`, back `[-300,2100]`. An omitted mode
is different from explicit `StartStart` for back vectors. `align` is parsed but ignored for
`behind`. See [the analysis](../bug-analysis/islands-back-row-of-other-widths-lands-off-the-front-row.md).

**To do.** Clarify `AUTHORING_RULES` (`hi-mcp-server.ts:30-34`): side relations use the named
neighbour's front; for equal-length flush rows, put the first rear unit behind the first front
unit and continue `leftOf`. Verify model acceptance. If needed, let `behind` name an end in
roomle-ui: retain the default, use `EndStart` for right alignment and mirror it to `StartEnd`
when the unit owns the entry (`hi-group-layout.ts:922-937`). Actual endpoints supply the
geometry without catalog-width offsets or orientation tracking. Update served-text tests and
references; roomle-ui work retains `fix/room-corners-at-openings` ancestry.

**Test.** `image-planning-right-wall`: the island's equal-length rows end flush at both ends.
Permanent geometry tests cover different unit widths and preserve deliberate steps; a fallback
also covers rotated targets, wider rear units and reciprocal mode ownership.

**Reproduce.** `mcp-test-2026-10-16_19-30-19`, gpt-6.1-sol 48 (`image-planning-right-wall`, the
second `create-or-replace-groups`, the island): `rear1` (`EUTB60`) `behind` `islandright`
(`EUS2A90`), `rear2` to `rear4` `rightOf`; back row z −3240 to −840 against front z −2940 to −540.

## 81. The corner-removal correction reports wall units as turned that stay on the back wall

**Problem.** `delete-article-and-compact` of a corner unit answers "the leg of '46ce47e7' (UTB60)
with the units above it turned by 90°", but the wall units that stood above the turned leg reload
in a separate group and stay on the back wall. The plan contradicts the reported correction.

**Cause.** The corner-article correction (`hi-tool-commands.ts`) reports the units above the turned
leg as turned. `moveUnitsAboveWithTheirCarriers`
(`packages/web-sdk/packages/homag-intelligence/src/hi-root-module-arrangement.ts` in roomle-ui)
only maps roots of the edited group; the wall units above the leg belong to a separate group, so
they are not turned with it.

**To do.** roomle-ui: turn the separate group's wall units with the leg, or make the correction
name only what turned and name the wall units that stayed. This is correction and feedback
accuracy, not a guard: nothing is refused, the agent's content is built.

**Test.** `edit-remove-corner-unit`: the turned leg's wall units turn with it, or the correction
names them as staying on the back wall.

**Reproduce.** `mcp-test-2026-10-19_07-42-07`, gpt-6-astra 29 (`edit-remove-corner-unit`, plan
snapshot `ps_s9hcu3u3kv21brhbudhjx88qqcmahy5`, local roomle-ui :5173): the
`delete-article-and-compact` of UERTB90 `814c6854-af4a-4370-807b-b1c0526dc1a0` answers the
correction quoted above; the final plan has the main group `031ee57a` as one straight row of
4200 mm along the right wall (x 4198..4815, z −3765..435) while the wall-unit group `85510a7e`
(wl1+wl2) stays on the back wall (x 2954..4154, z −3765..−3359, rotationY 0.03).

## 82. The model asks instead of building the group the user asked for on a wall of floor-to-ceiling windows

**Problem.** On a wall of floor-to-ceiling windows the model asks a clarifying question instead of
creating the group the user asked for (05), and where it builds, it discloses the placement as a
problem (64). The served rule says a group goes where the user puts it, also when a door or a window
is there (D51), and the obstacle test builds the group anyway and names what it stands in front of
(D55).

**Cause.** The placement rule (`hi-mcp-server.ts:42`) states that a placement in front of a window is
legitimate and that the answer says what the group stands in front of, but not that the group is
built when the user names the wall — a model reads the legitimacy as a permission it may decline and
stops to ask.

**To do.** roomle-hi-example served text (`hi-mcp-server.ts:42`): say that a group the user asks for
on a wall of windows is built and the answer names the windows — one sentence. Verify model
acceptance.

**Test.** `sideboard-living-room-front-wall`: the model creates the sideboard on the glazed front
wall and the answer names the windows.

**Reproduce.** `mcp-test-2026-10-19_07-42-07`, gpt-6-astra 05 (`sideboard-living-room-front-wall`):
no `create-or-replace-groups` call — the model asks whether to place the sideboard in front of the
glazing or against a solid wall; and 64 (`random-4-cabinet-undo-redo`): the model places a low
cabinet in front of floor-to-ceiling windows and discloses it. Local roomle-ui :5173.

## 83. Where no free stretch of the wall fits the group, it is placed over existing furniture and reported

**Problem.** On the closets back wall, where no free stretch fits the requested row, the model places
the wardrobes over existing objects and reports the overlap: four wardrobes over two objects (12),
five wardrobes over the low cabinet by 568 mm (35); smaller overlaps are disclosed as well (34, 36,
39). The obstacle test builds the group anyway and names what a root stands on and the free stretches
of its wall (D55).

**Cause.** The placement rule (`hi-mcp-server.ts:42`) says to choose a stretch of wall that obstacles
leaves free only "where the user leaves the place open"; when the user names a wall whose free
stretches are too short for the requested width, no served sentence says what to do, and the model
builds over the furniture and reports.

**To do.** roomle-hi-example served text (`hi-mcp-server.ts:42`): say what to do when the wall the
user names has no free stretch of the requested width — ask, or place where a stretch fits and say
so. Verify model acceptance.

**Test.** `wardrobe-door-hinges`, `wardrobe-split-door-hinges`: the model asks or places in a free
stretch instead of overlapping the furniture.

**Reproduce.** `mcp-test-2026-10-19_07-42-07`, gpt-6-astra 12 (`wardrobe-door-hinges`): four
wardrobes over two objects on the closets back wall, the answer reports the overlap; 35
(`wardrobe-split-door-hinges`): five wardrobes over the low cabinet by 568 mm. Local roomle-ui :5173.

## 84. The find-attributes answer lists the values without naming the attribute

**Problem.** `find-attributes` returns the matching attributes with their values, and the model's
answer lists the values without naming the attribute id (18: the 21 front colours listed, the
attribute never named).

**Cause.** The `find-attributes` description (`hi-mcp-server.ts:252-268`) says what the tool returns
but not that the answer names the attribute id.

**To do.** roomle-hi-example served text: one sentence in the `find-attributes` description — the
answer names the attribute id with its values.

**Test.** `attributes-find-front-colour`: the answer names the attribute id with the front colours.

**Reproduce.** `mcp-test-2026-10-19_07-42-07`, gpt-6-astra 18 (`attributes-find-front-colour`): the
answer lists the 21 front colours, never names the attribute id. Local roomle-ui :5173.

## 85. insert-article-into-group takes a between-pair whose root modules do not stand side by side

**Problem.** `insert-article-into-group` inserts between two root modules that are adjacent in the
docking chain but do not stand side by side in space; the insert lands beside one of them (27: the
sink and a base unit on the back leg of the L-shape; the insert landed beside the sink).

**Cause.** The `insert-article-into-group` description (`hi-mcp-server.ts:700-708,720`) says "between
two root modules that stand side by side", but the payload's between-ids are not tested against the
geometry — chain adjacency is enough for the insert, and the result does not say that the named pair
does not stand side by side.

**To do.** roomle-ui `hi-tool-commands.ts` (the insert's result): when the two named root modules do
not stand side by side, the result says so and where the article landed — feedback, not a refusal
(Guards Are a Last Resort); alternatively one sentence in the served description says what side by
side means (two root modules that name each other's side docking vectors). Verify model acceptance.

**Test.** `edit-insert-below-wall-units`: the insert lands between the two root modules that stand
side by side, or the result says the named pair does not stand side by side.

**Reproduce.** `mcp-test-2026-10-19_07-42-07`, gpt-6-astra 27 (`edit-insert-below-wall-units`): the
model named the sink and a base unit (adjacent in the docking chain, not side by side in space); the
insert landed beside the sink. Local roomle-ui :5173.
