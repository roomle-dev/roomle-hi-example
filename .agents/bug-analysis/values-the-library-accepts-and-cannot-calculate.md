# Values the library accepts and cannot calculate

> **Type**: Bug analysis
> **Status**: Open
> **Date**: 2026-10-24
> **Base**: roomle-hi-example `master` (`ed4bb6f`); roomle-ui `feat/hi-mcp` (`42d17c4f3`)
> **Backlog**: [library-calculation-gaps.md #4](../backlog/library-calculation-gaps.md#4-values-the-library-accepts-and-cannot-calculate)

## Affected repositories

- **roomle-hi-example** — the report of the calculation errors to the HOMAG library development
  team (a new document in `docs/library-information/`), the facts and the status of the issues in
  [library-issues.md](../backlog/library-issues.md), the backlog item.
- **The HOMAG library Furniture_Smith** — the library development team: every value the library
  offers calculates, or its verified options rule it out.
- **roomle-ui** — unchanged. The check before an edit (D107) already takes a range and `Invalid`
  entries from the library, and the discard (D106) already keeps every failing call out of the plan.
  `feat/hi-mcp` gets no change from this item.

The D-numbers are the decisions in §3 of
[roomle-ui `hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#3-decisions).
The roomle-ui paths are relative to `packages/web-sdk/packages/homag-intelligence/`.

## Symptom

The library accepts a value — its verified options do not rule it out — and then cannot calculate
the root module with it. A tool call with such a value changes nothing: the tools discard it before
the load and answer "nothing was changed - the library could not calculate …" (D106). The agent
loses a step and usually plans something other than what was asked, such as narrower units in place of
widened ones, or rail handles in place of a handle strip. The same value set in the planner's attribute
panel is kept with the failed calculation, which leaves a root module without geometry in the plan,
its price and its order (D95; [item 1](../backlog/library-calculation-gaps.md#1-price-and-order-include-root-modules-the-library-could-not-calculate-without-a-note)).

[library-issues.md](../backlog/library-issues.md) records these errors one by one. Its **Status**
column says "not reported" for most of them, so the library development team does not know them.

## Reproduction

A probe without a model, on 2026-10-24: the tools through `callExternalObjectAgentTool` in the
example page (launcher `--dev`, ports 3002/3202), the planner of roomle-ui `feat/hi-mcp` `42d17c4f3`
on `:5173`, the library Furniture_Smith of the backend `HI_PRE_Roomle_Milestone_2`. Per case:

1. a group with the article as it comes, at wall 1 (`create-or-replace-groups`);
2. the library's verified options of the probed attribute on every module that carries it
   (`getExternalObjectAttributeOptionsOrRanges`), read on the module as it comes;
3. the value with `change-module-attribute` or `change-group-attribute`;
4. `delete-group`.

The scripts and their results are in `.temp/result/probe-values-the-library-cannot-calculate-2026-10-24/`
(`probe.mjs`, `probe.mjs --extra`, `doors.mjs`; git-ignored).

| Issue | Article | Value | Verified options of the value | Result |
|---|---|---|---|---|
| 80 | `OTB60` | `mod_Width` 750 or 900 | none | calculated: a pair of doors (`mod_DoorDirection` `LeftRight` on `mf_Door`) |
| 80 | `OTB60` | `mod_Width` 450 | none | calculated |
| 80 | `OTB60` | `mod_DoorDirectionSelection` `Left` or `Right`, then `mod_Width` 750 or 900 | none | Error 14019: `tab_DoorSettings` … `WallUnit - All - Standard - 240 - mr_StorageunitSingle - 900 - Automatic - Left - Automatic` |
| 80 | `O2TB90` | `mod_Width` 600 | none | calculated: a single door (`Left`) |
| 80 | `O2TB90` | `LeftRight`, then `mod_Width` 600 | none | Error 14019: … `600 - Automatic - LeftRight - Automatic` |
| 78 | `HTB60` | `mod_Width` 900 | none | calculated: a pair of doors (`LeftRight`) |
| 78 | `HTB60` | `Right`, then `mod_Width` 900 | none | Error 14019: `TallUnit - All - Standard - 240 - mr_StorageunitSingle - 900 - Automatic - Right - Automatic` |
| 76 | `U2TB90` | `mod_DoorDirectionSelection` `LeftLeft` or `RightRight` | none | Error 14019: `BaseUnit - All - Standard - 240 - mr_StorageunitSingle - 900 - Automatic - LeftLeft - Cleat` |
| 79 | `UTB30` | `mod_Width` 150, with the plinth as it comes (100 mm) or with `mod_PlinthAreaHeight` 150 (`Normal`) | none | Error 14011: `tab_PlinthAreaSettings` … `BaseUnit - 30 - LCF - RCF - BCF - FCR - 150 - 150 - 50`, the same input values for both plinths |
| 106 | `SB_US600` | `mod_Height` 720 | none | Error 13008: `tab_DrawerBoxDimensionMapping` … `Legrabox - 322 - 30.5` |
| 64 | `OSKB90` | `mod_Height` 360 | none | Error 14023: `tab_FlipliftSettings` … `SHF - 324 - 862 - 322 - Handle` |
| 64 | `OSKB90` | `mod_Depth` 561 | none | calculated |
| 69 | `W60U` beside a `UTB60` | `mod_UprightColor` 192 on the group | none on `W60U` | Error 14034: `tab_GrainDirectionSettings` … `part_FinishPanel - Upright - Horizontal - NoGrain - 584 - 820` |
| 70 | two `UTB60` | `mod_FrontColor` 160 on the group (`Conflicting`; the library switches the front program to Classic), then `mod_CarcaseColor` 230 | `Conflicting` | Error 14034: … `part_Sidepanelleft - BaseUnit - Horizontal - NoGrain - 720 - 561` |
| 71 | `OFKB60` | `mod_FrontProgram` Modern | `Conflicting` (`Normal`: Nature, Tradition) | Error 14036: `tab_PanelWoodFrameConstruction` … `Fliplift - ModernFrame01 - Grain - Grain - None` |
| 99 | `UTB60` | `mod_HandleDesign` 40 on the group | `Normal` | Error 22025: "There is a HandleStripe selected in the HandleDesign and the HandlePosType selected is not valid" |
| 93 | `UTB60` | `mod_CreateBacksplash` true on the group, alone or with `mod_BacksplashColor` 240 and `mod_BacksplashHeight` 635 in one call | none | Error 14034 on `mr_Backsplash`: … `part_Backsplash - undefined - undefined - undefined - 610 - 110` |

Every failing call answered "nothing was changed", and the group stayed as it was: the tools'
handling works (D106).

## Investigation trace

### What the tools check before they set a value

The tools set a value only when the library's verified options take it (D107):

- `verdictOf` (roomle-ui `src/hi-attribute-check.ts:62`) applies the options as the planner's
  attribute panel does. A range takes a value between `min` and `max`, off its step on the nearest
  step. A list takes a `Normal` or `Conflicting` entry, and the library resolves the conflict
  (D59, D111). Without options, every value is taken (`:89`).
- The options come from `verifiedOptionsOfModule` (`src/glue-logic.ts:2481`), which asks the
  library's `getAttributesDropDownValues` per module. The wrapper answers `[]` for an attribute
  whose lookup throws (`src/homag-intelligence.ts:195`, `:214`).
- The type the library answers with already carries both forms the item asks for:
  `CheckDropDownResult` with `dropDownEntries` (`Normal`, `Conflicting`, `Invalid`) or a
  `dropDownRange` with `min`, `max` and `step` (`src/model/oc-scripts-domain.model.ts:490-510`).
  The tests are `it('does not take a value outside the range and sets one off the step on the nearest step')`
  and `it('names a root module whose value the range takes on the nearest step')` in
  `__tests__/hi-attribute-check-test.ts`, and the range cases in
  `__tests__/hi-tool-commands/group-commands-test.ts` and `create-or-replace-groups-input-test.ts`.

### What the library answers

- **Nothing** for `mod_Width`, `mod_Height`, `mod_Depth` and `mod_DoorDirectionSelection` on any
  probed module, for `mod_UprightColor` on the end panel `W60U`, and for `mod_CreateBacksplash`. The
  answer is an empty object, so every value of these attributes goes to the calculation.
- **A list that accepts the failing value** where it does verify: Modern on the flap of `OFKB60` and
  the wood carcase colours on `UTB60` are `Conflicting`, and the handle strip 40 on `UTB60` is
  `Normal`. For 70 and 71 the library's own conflict resolution runs, and the combination it leaves
  does not calculate. For 99 no conflict is reported, and the handle position the strip needs is not
  set.
- **The master data names no range for the sizes.** A `Dim` attribute can carry a
  `{ min, max, step }` selection (`MDNumberMinMaxAttributeSelection`,
  `src/model/oc-scripts-domain.model.ts:389`). Furniture_Smith declares one for `mod_GroupWidth`
  (600–6000) and `mod_IslandBackwallWidth` (150–5000), not for `mod_Width`, `mod_Height` or
  `mod_Depth` (`docs/library-information/master-data.json`). A master-data attribute is the same
  for every article. The widths that calculate differ per article and per door arrangement, so
  the verified options of the module are the place for them.

### The door arrangement follows the width; the door direction does not

With `Automatic`, the library chooses the arrangement by the width. `OTB60`, `O2TB90` and `HTB60`
get a single door at 600 mm and a pair of doors side by side at 750 and 900 mm (the resolved
`mod_DoorDirection` of `mf_Door`: `Left`, `LeftRight`). The probe does not show at which width
between 600 and 750 mm the pair starts.

A fixed `mod_DoorDirectionSelection` is looked up together with the width in `tab_DoorSettings`:
`… - <width> - Automatic - <direction> - …`. The table has a single-door entry only where the width
gives a single door, and a pair entry only where it gives a pair. A resize that changes the
arrangement therefore fails when it keeps the direction of the arrangement before:

- issue 80: `OTB60` with `Left` or `Right` widened to 750 or 900 mm, and `O2TB90` with `LeftRight`
  narrowed to 600 mm;
- issue 78: `HTB60` with `Right` widened to 900 mm.

Issues 78 and 80 are therefore the same error: the conflict resolution does not adapt the door
direction when the width changes the arrangement, and the verified options do not rule the
combination out. Issue 76 is a different gap in the same table: `U2TB90` at the width it comes with
(900 mm) has no entry for `LeftLeft` or `RightRight`, although the master data offers both values.

The served text does not cause this. The served rule asks the agent to hinge the doors at the ends of
a row at the outer sides (D84), and the desc of `mod_DoorDirectionSelection` asks the same: "in a row,
set the door at the right end to Right". `OTB60`'s article description says "1 door", and nothing the
agent reads says that the article has a pair of doors at 900 mm.

### What the issues say and what the probe adds

- **80**: the title and the table say "a single door at 900 mm". The error needs a fixed single-door
  direction. Widened with `Automatic`, `OTB60` calculates as a pair of doors at 750 and 900 mm. That
  answers two of the three "Not known" points of the issue.
- **79**: the title names the 150 mm plinth. The width fails with the plinth as it comes as well, and
  the issue's own table shows this; the plinth is not the cause.
- **64**: the height fails and the depth calculates. That answers the question "which of the two the
  fitting does not take".
- **69, 70, 71, 99**: the issues treat these errors as missing descriptions. By the verified options
  the library accepts each value (no options, `Conflicting` or `Normal`), so by D99 they are library
  bugs. Their **Status** names the descriptions done in the library, but no report of the calculation
  error.
- **93**: still fails, now on a single base unit with the switch alone. Its cause is not established:
  the same separate call built the backsplash on roomle-ui `cf377cfd4`, which is still in the reflog
  of the local roomle-ui checkout. Its own to-do, the replay on that commit, comes first.

## Root cause

The defect is in the HOMAG library, outside these repositories. The calculation script, the master
data and the article list come from TecConfig at runtime (`onLoadJavascript`, `onLoadMasterData`,
`onLoadArticleCatalog`). It has two parts, and by D99 both make each case a library bug:

1. **The calculation tables lack entries for values the library offers:** `tab_DoorSettings` (76, 78,
   80), `tab_PlinthAreaSettings` (79), `tab_DrawerBoxDimensionMapping` (106), `tab_FlipliftSettings`
   (64), `tab_GrainDirectionSettings` (69, 70), `tab_PanelWoodFrameConstruction` (71), and the handle
   strip's handle position check (99, Error 22025).
2. **The verified options do not rule these values out.** `getAttributesDropDownValues` answers nothing
   for the sizes, the door direction, the upright colour of an end panel and the backsplash switch.
   Where it does answer, it marks the failing value `Normal` or `Conflicting`, and its conflict
   resolution (`solveModuleAttributeConflict`) leaves a combination that does not calculate.

In roomle-hi-example, the cause is that the errors are not reported. Item 4's first to-do, the report
to the library development team, has not been done: [library-issues.md](../backlog/library-issues.md)
records the errors, but no report of them has been sent to the team.

roomle-ui is not at fault. `verdictOf` takes a value without options (`src/hi-attribute-check.ts:89`)
because D107 decides so: an attribute the library does not verify is set, and the calculation decides
(D106). It takes the library's verdict wherever the library gives one.

## Why the current code produces wrong results

The tools can only refuse what the library rules out (D107), and they never author a value the library
has not offered (§2.4). For every value above, the library's verdict says "taken" and its calculation
says "cannot". The tools follow the calculation and discard the call (D106). This keeps the plan clean,
but the agent loses the step and ends with a different planning. The planner's own edit keeps the failed
root module (D95). Neither the served text nor the tools can close the gap, because they would need the
library's valid combinations, and those are library content.

## Proposed fix

### 1. roomle-hi-example: the report to the library development team

A new document, `docs/library-information/calculation-errors.md`, written for the HOMAG library
development team and grouped by the library table that fails. Per case:

- the article and the values set, in the order they are set;
- the library's message;
- the verdict of the library's verified options on the value;
- what is expected: the value calculates, or the verified options rule it out — an `Invalid` entry,
  a `dropDownRange` per module for the sizes, or a `Conflicting` entry whose conflict resolution sets
  a value that calculates. The door direction is an example: at a width that gives a pair of doors,
  `Left` and `Right` are `Conflicting`, and the conflict resolution sets `Automatic` or `LeftRight`.

The cases are the rows of the table above that fail, except 93. Each one can be reproduced in the
planner's attribute panel without the agent, and the planner keeps the failed root module there (D95).

When the user has sent the report, the **Status** of each issue in
[library-issues.md](../backlog/library-issues.md) says "reported to the library development team",
and so does the overview row.

### 2. roomle-hi-example: the facts of the issues

In [library-issues.md](../backlog/library-issues.md), with the evidence of the probe:

- 80: the error needs a fixed direction of the other door arrangement; `Automatic` calculates a pair
  of doors at 750 and 900 mm. The **How the library behaves** table gets the probe's rows. 78 is the
  same error on a tall unit: the two issues become one, "a door direction of the other door
  arrangement after a resize", which keeps 78's description proposals (sections 1.5 and 2.6 of
  [`suggested-library-changes.md`](../../docs/library-information/suggested-library-changes.md)).
- 79: the title without the plinth height.
- 64: the height fails, the depth calculates.
- 69, 70, 71, 99: the **Cause** names the calculation error of an accepted value as a library bug
  (D99), with the verdict of the verified options.
- 93: unchanged, apart from the probe's row.

### 3. The library

This is the second to-do of item 4. The library calculates every value it offers, or its verified
options rule out every value it cannot calculate. Neither needs a library API change or a roomle-ui
change: the options' type carries ranges and `Invalid` entries, and the tools apply them to every
attribute tool and to the root and group values of a create (D107, D111). The description proposals
that are still open stay the information the agent needs until then:

- the resize text of section 2.6, which the probe confirms;
- section 1.5;
- section 2.9.

### 4. roomle-ui

No change.

## Alternatives considered and rejected

- **The tools set `Automatic` when a resize changes the door arrangement**, or reset another failing
  attribute. That puts one library's content into the tools' logic (§2.4). D95 and D106 reject it too:
  "resetting the failing attribute — the server would need the library's valid combinations".
- **A served rule that names the widths, the heights or the door combinations.** That is library
  content in the served text, and the served text stays library-neutral. Such information goes into
  the `desc` of the library data.
- **A trial calculation of every value before the edit.** D106 already calculates the change and
  discards it. A check before that would repeat the calculation and still know no valid value to name.
- **Ranges in the master data for `mod_Width` and `mod_Height`.** A master-data range is one range
  for every article, but the widths that calculate differ per article and per door arrangement.
- **Reporting 93 now.** Its cause can be in roomle-ui, since the same call built the backsplash on
  `cf377cfd4`.

## Open points

1. **The form of the report.** Option 1: a document in `docs/library-information/` that you forward to
   the team, as `suggested-library-changes.md` is (recommended). Option 2: a ticket in the team's
   tracker.
2. **Merging 78 into 80.** Both are the same table and the same cause.

## Side finding

The proposed desc of `mod_CreateBacksplash` (section 2.10 of
[`suggested-library-changes.md`](../../docs/library-information/suggested-library-changes.md#210-backsplash))
says "the result names it in notLoaded; report it as not built". That puts the HI tools' vocabulary
into library data. Since D106 it is also out of date: a `change-group-attribute` that enables the
backsplash answers with an error, not with `notLoaded`. The text belongs with 93's own to-do.

## Test

- The tests of the issues in [library-issues.md](../backlog/library-issues.md).
- After a library update, the probe is run again
  (`.temp/result/probe-values-the-library-cannot-calculate-2026-10-24/probe.mjs`). Every case
  calculates, or the attribute tool names the values the module takes (D107) and changes nothing.
  The probe could also become a script in `.agents/scripts/` that re-checks the reported errors after
  every library data refresh. That is a proposal, not part of this fix.

## Code and documents the work touches

- `docs/library-information/calculation-errors.md` — new, the report.
- [`.agents/backlog/library-issues.md`](../backlog/library-issues.md) — issues 64, 69, 70, 71, 76, 78,
  79, 80, 99, 106: the facts and, once reported, the status.
- [`.agents/backlog/library-calculation-gaps.md`](../backlog/library-calculation-gaps.md) — item 4.
- [`.agents/backlog/README.md`](../backlog/README.md) — the rows of the merged and renamed issues.
- [`.agents/wiki/why-the-agent-cannot-plan-what-the-library-cannot-build.md`](../wiki/why-the-agent-cannot-plan-what-the-library-cannot-build.md)
  — "A value the library accepts can still fail": its two examples, with the door example named by
  its fixed direction.
