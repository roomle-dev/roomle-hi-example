# Bug analysis — a wall-level article of another category is taken for a floor unit

> **Type**: Bug analysis
> **Status**: Open — fix proposed, not implemented
> **Date**: 2026-10-17
> **Base**: roomle-hi-example `analysis/mcp-72-wall-units-two-heights-plinth` (`09c5ee2`);
> roomle-ui `fix/room-corners-at-openings` (`a008be42d`) — the branch every roomle-ui change for
> this bug must be based on
> **Backlog**: item 73 of [`../backlog/mcp-issues.md`](../backlog/mcp-issues.md)

## Affected repositories

- **roomle-ui** — the proposed fix: `isWallUnitArticle`
  (`packages/web-sdk/packages/homag-intelligence/src/hi-group-layout.ts:70`), the two correction
  branches of `relationsToDocking` that rewrite or drop the agent's relation
  (`hi-group-layout.ts:244-249` and `hi-group-layout.ts:273-279`), and the unit tests in
  `__tests__/hi-group-layout-test.ts`. The fix is based on `fix/room-corners-at-openings`. The
  other users of the classifier — `hi-tool-docking.ts:187-204` (the merge docking gap) and
  `hi-tool-docking.ts:982` (`dropFloorUnitsOnBaseUnits`), `hi-tool-hints.ts:153` and
  `hi-tool-hints.ts:195` — inherit the wider classification without a change of their own; their
  tests may gain a case each.
- **roomle-hi-example** — this analysis and backlog item 73 (the cause and the responsible
  updated with the analysis). No code change: the issue rules out a change of the served text —
  the agent's payload is legitimate, the tool misclassifies it — and the stored tests already
  cover the outcomes (`kitchen-conversation`; the random test
  `random-1-utility-room-right-wall-with-wall-units` of the reproduce run).
- **RoomleCore (the planner kernel)** — no change. The catalog compaction already passes the
  library data the fix reads (`mainAttributes` and `dimensions` of `hi-plan-context.ts:616-655`),
  and the planner already writes the insertion height at the load. Named because the
  alternative — the planner teaching the tool which articles mount on the wall — would be a
  kernel change for data the catalog already carries.
- **The library (HOMAG Furniture_Smith, server-side calculation)** — no change for the fix.
  The library already marks every wall-level article in its data (below); the categories "Cover
  Panels" and "Utility" are the library's taxonomy and stay. A library change is only the
  fallback for a wall-level article that carries neither marker.
- **ligna-store** — no change: the store runs the same roomle-ui and planner and holds no copy
  of the tool command.

## Symptom

A `create-or-replace-groups` whose roots put a wall-level article of a category other than "Wall
Units" beside a wall unit or above a floor unit has the article taken for a floor unit: its
relation is rewritten or dropped, and it lands in the floor row.

**Case 1 — a wall-level panel beside a wall unit.** The agent puts the wall-unit side panel
`W35O` ("Wall-unit side / cover panel", category "Kitchen | Cover Panels | Side Panels") `rightOf`
the wall unit `cups` (`OFKB60`) to close the wall-unit row. Reproduce:
`mcp-test-2026-10-16_19-30-19`, gpt-6.1-sol 50 (`kitchen-conversation`, the first
`create-or-replace-groups`, planner call in the run directory
`.temp/result/mcp-test-2026-10-16_19-30-19/gpt-6.1-sol/50-kitchen-conversation/`). The payload:
`{"id":"wallend","articleId":"W35O","rightOf":"cups"}` with `cups` `above` the base unit `return`.

The corrections of the call:

```
posGroups[0]: floor unit 'wallend' cannot stand rightOf the wall unit 'cups' - it continues the floor row
posGroups[0]: root 'wallend' names no neighbour - it was put rightOf 'endtall'
posGroups[0]: roots 'fridge', 'wallend' were docked to the RightBottom of root 'endtall' at the same place - 'wallend' was docked to the LeftBottom of 'endtall', the free end of its leg (the RightBottom row ends at the corner article 'corner')
```

The relation is dropped, the default link puts the panel `rightOf` `endtall` (a `W60H` tall end
panel of the floor row), and the wall-unit panel stands on the floor at the end of the floor leg.
(The same call also fails to calculate the panel for an unrelated library reason — Error 14034,
the plain upright colour of backlog item 69 — but the misplacement is this bug: had the relation
survived, the panel would dock beside `cups` at the wall-unit height.)

**Case 2 — a wall unit of another category above a floor unit.** The agent puts the utility-room
open wall units `openwall1` and `openwall2` (`HWR_WR600V1`, category "Utility") `above` the base
units `HWR_UB600`. Reproduce: `mcp-test-2026-10-17_13-28-41`, gpt-6-astra 54
(`random-1-utility-room-right-wall-with-wall-units`, turn 2, the second `create-or-replace-groups`,
planner call 6 of the run directory
`.temp/result/mcp-test-2026-10-17_13-28-41/gpt-6-astra/54-random-1-utility-room-right-wall-with-wall-units/`).

The corrections of the call:

```
posGroups[0]: root 'openwall1' is no wall unit - it stands rightOf 'b82d67ff-…' instead of above it
posGroups[0]: root 'openwall2' is no wall unit - it stands rightOf '25f6650f-…' instead of above it
posGroups[0]: roots '25f6650f-…', 'openwall1' were docked to the RightBottom of root 'b82d67ff-…' at the same place - 'openwall1' was docked to the RightBottom of 'openwall2', the free end of that row
```

Both units land in the floor row. The agent then undoes the call (planner call 9) and hangs the
two units with two `merge-article-into-group` calls (planner calls 13 and 16) that set
`mod_TypeElement` `WallUnit`, `mod_HeightPosInsertion` 1420, `mod_PlacementLevels` `WallHanging`
and `mod_CreateToekick` false, docked by a Top vector with the offset `[0,500,0]` — three calls
and an undo for what one create should have built.

## Investigation trace

1. **The classifier knows a wall unit by a category word only.** `isWallUnitArticle`
   (`hi-group-layout.ts:70-71`) is `WALL_UNIT.test(category) || isHoodArticle(article)`, with
   `WALL_UNIT = /\bwall ?units?\b/i` (`hi-group-layout.ts:11`). The regex catches "Kitchen | Wall
   Units | …" and "Living | Wallunits" (the test `counts the Living wall units as wall units`,
   `__tests__/hi-group-layout-test.ts:651`), but not "Kitchen | Cover Panels | Side Panels"
   (`W35O`) or "Utility" (`HWR_WR600V1`). Neither article is a hood. Both count as floor units
   everywhere the tool classifies: `relationsToDocking` (`hi-group-layout.ts:191-194`),
   `hi-tool-docking.ts`, `hi-tool-hints.ts`.
2. **The library marks every wall-level article in its data — the tool does not read the marks.**
   Surveyed over the stored catalog (`docs/library-information/article.json`,
   `docs/library-information/master-data.json`):
   - `mod_TypeElement` (master data: `isMain: true`, type Text, "Type Element") sits on the root
     module of all 21 wall-unit-typed articles — the Kitchen wall units, the Utility
     `HWR_WR600V1`, `HWR_WR600V2`, `HWR_WR600V3`, `HWR_WT600` and the Living `SM_WK900`, `SM_WR900`,
     `SM_WT300`, `SM_WT600`, `SM_WT300S`, `SM_WR300` — with the value `WallUnit`. The library's
     values are `BaseUnit` (9 articles), `BaseUnitSink` (5), `TallUnit` (33), `TallUnitAppliance`
     (2) and `WallUnit` (21); the storage-unit module assigns the attribute to every unit
     (`mr_StorageunitSingle`, `mr_Upright` and `mr_Hood` carry it in `assignedAttributes`).
   - `mod_HeightPosInsertion` (master data: type Dim, "Position height", `isMain: false`) is the
     default mounting height, carried by exactly the 14 wall-level articles that hang: the
     Kitchen wall units (1380; `OTB45` 1580), the wall fillers `PO15L`/`PO15R` (1380) and the
     wall side panel `W35O` (1380). No floor, tall or end-panel article carries it in the catalog.
   - `mod_PlacementLevels` `WallHanging` is **not** a marker: the floor-standing `HWR_WM700`
     (Utility, 920 mm, `mod_TypeElement` `BaseUnit`) carries it too, and `W35O` does not.
   - The docking vectors do **not** discriminate: the calculated roots of floor and wall units
     carry the same vector set (`LeftBottom`, `LeftTop`, `RightBottom`, `RightTop`, `BackBottom`,
     `BackTop` — the plan contexts of the stored runs).
   - `insertLevelInfos` (the planner's insert levels — "if no list is present, the default height
     is the floor", `oc-scripts-domain.model.ts:148-152`) would be the library-neutral mounting
     height, and the catalog compaction passes it through (`hi-plan-context.ts:129,654`), but the
     stored article templates carry none; whether the planner fills them for catalog articles is
     unverified. Not used by the proposed fix.
   - The marks reach the tool: the catalog compaction puts `mod_TypeElement` into `mainAttributes`
     and `mod_HeightPosInsertion` into `dimensions` of the article's root modules
     (`hi-plan-context.ts:616-655`), and `relationsToDocking` classifies by
     `catalogArticleOf(articles, root)` (`hi-group-layout.ts:190`), the catalog article.
3. **The corrections then change what the agent asked for.** In `relationsToDocking`:
   - `above` a floor unit with `!isWall(root)` is rewritten to `rightOf`
     (`hi-group-layout.ts:244-249`) — case 2.
   - `rightOf`/`leftOf` a wall unit with `!isWall(root)` drops the relation entirely
     (`hi-group-layout.ts:273-279`, `continue`) — case 1. The default link
     (`hi-group-layout.ts:398-476`) then puts the root `rightOf` the last floor unit of the main
     chain ("names no neighbour - it was put rightOf …", `hi-group-layout.ts:474`) and the row
     compiler docks it to the free end of the floor leg.
   Both corrections fight the agent's intent instead of carrying it out ([Guards Are a Last
   Resort](../../AGENTS.md#guards-are-a-last-resort)).
4. **The classification must read the catalog, never the agent's payload.** In the reproduce run
   the agent sent `mod_HeightPosInsertion` 100 on the floor units and `mod_TypeElement` values
   itself (planner call 6 of the run directory). A classifier that read the root's attributes
   would take the agent's word; `isWallUnitArticle` receives the catalog article, and the fix
   keeps it that way.
5. **With the article recognized as a wall unit, the existing compile does the right thing.**
   - `W35O` `rightOf` `cups` docks by the Bottom vectors (`pairOf`, `hi-group-layout.ts:734`:
     `edge = isWall(unit) && isTall(target) ? 'Top' : 'Bottom'`), the same docking two wall units
     get (the test `docks wall units and the range hood beside each other by the Bottom vectors`,
     `__tests__/hi-group-layout-test.ts:116`). The panel keeps its catalog default mounting
     height 1380 — the wall units' height — so it hangs beside the wall unit.
   - `HWR_WR600V1` `above` the base unit keeps `above` and gets the D35 gap
     (`hangGapOf`, `hi-group-layout.ts:141-168`): tall 2100 − unit 1280 − carrier 820 = 0, the
     open wall unit hangs with its top flush with the tall unit's top.
   - `W35O` carries no `mod_Height` dimension (its height is `mod_UprightHeight`), so
     `rootHeight` falls back to the usual wall-unit height of the library (720) in `hangGapOf`
     — the D35 gap for a panel above a floor unit is the gap of a 720 wall unit, which is what
     the panel is.

## Root cause

`isWallUnitArticle` recognizes a wall unit by the words "Wall Units" in the article's category (or
by a hood module), so a wall-level article of another category — a cover panel, a utility wall
unit — counts as a floor unit. The correction branches of `relationsToDocking` then rewrite
(`above` → `rightOf`) or drop (`rightOf`/`leftOf` a wall unit) the agent's relation, and the
default link places the article at the free end of the floor row. The library data that tells
wall-level articles from floor articles — the `mod_TypeElement` type marker and the default
mounting height — reaches the tool in the catalog but is not read.

## Why the current code produces this

The category word was the first signal the compiler had, and it covers the Kitchen and Living
wall units; the catalog's `mainAttributes` and `dimensions` carry the stronger signal and the
classifier never looked at them. The corrections were written for a genuine floor unit beside a
wall unit — docking it to the wall unit's Bottom vector would lift it to the wall-unit height —
so they reroute the unit to the floor row; with the misclassification they reroute the agent's
wall-level article too, and the `continue` drops the relation before the default link runs, so
the agent's intent is lost silently apart from the correction sentence.

## Proposed fix

In roomle-ui's `hi-group-layout.ts`, **tell wall-level articles from floor articles by the data
the library gives every article**, beside the category word:

`isWallUnitArticle` (`hi-group-layout.ts:70`) also returns true when the catalog article's root
modules carry

- a main attribute `mod_TypeElement` with the value `WallUnit`, or
- a dimension `mod_HeightPosInsertion` (the default mounting height) above floor level — the
  observed defaults are 1380 and 1580; a threshold well above any plinth (500 mm) keeps the check
  safe, and the catalog carries the attribute only on wall-level articles.

The check scans every root module of the article, reads the catalog article (never the agent's
root overrides), and degrades to today's behaviour for a library whose data carries neither
marker — the category word and the hood check stay. The two markers are both needed: the
Utility and Living wall units carry `mod_TypeElement` but no mounting height, the cover panels
and fillers (`W35O`, `PO15L`/`PO15R`) carry the mounting height but no type marker.

With the wider classification the corrections fire only for genuine floor units, where they are
right: a floor unit `rightOf` a wall unit still continues the floor row (docking it to the wall
unit's Bottom vector would float it at the wall-unit height), and a floor unit `above` a base
unit still stands `rightOf` it. The keep-and-report interim the backlog names is covered by the
same data: an article the agent puts beside a wall unit stays there exactly when the library
marks it wall-mounted, which is what the extended classifier recognizes — there is no third
class of article the interim would catch that the classifier does not.

This needs no change of the served text: the agent sends a legitimate payload — a wall-level
article beside a wall unit, a wall unit above a floor unit — and the tool builds what the D34
relations describe.

## What the fix does not do

- It does not change `hi-tool-docking.ts` or `hi-tool-hints.ts`: they call `isWallUnitArticle`
  and inherit the wider classification — a merged wall-level panel above a floor unit gets the
  D35 gap (`hi-tool-docking.ts:187-204`), a wall-level panel docked `onTop` a base unit via
  `contextData` stays instead of being dropped (`dropFloorUnitsOnBaseUnits`,
  `hi-tool-docking.ts:982`), and the hints treat the panel as part of the wall row
  (`hi-tool-hints.ts:153,195`). Their behaviour for the new class is the consistent one; their
  tests gain a case each.
- It does not teach the agent anything new: no correction fires for a recognized wall-level
  article, so the agent's next payload is unchanged.
- It does not reclassify a floor unit: no floor, tall or end-panel article of the library carries
  either marker, and the agent's own `mod_HeightPosInsertion` or `mod_TypeElement` overrides on a
  root are not read.
- It does not cover a wall-level article of a library that marks wall-level articles neither by
  type nor by mounting height: the category word stays the fallback. The library fix for that is
  the markers in its data, reported like the items of
  [`../backlog/library-issues.md`](../backlog/library-issues.md).

## Rejected approaches

- **Keep an article the agent puts beside a wall unit there and report it, without the
  classification** (the backlog's interim). Docking aligns vectors: a floor unit docked to a wall
  unit's Bottom vector is lifted to the wall-unit height and floats, so the tool cannot keep every
  article beside a wall unit; and the articles it may keep are exactly the ones the mounting data
  marks — which is the classifier fix. The interim is a subset of the fix, not an alternative.
- **Classify by `mod_PlacementLevels` `WallHanging`.** The floor-standing `HWR_WM700` carries it
  and `W35O` does not; it marks a placement suggestion, not a level.
- **Classify by the docking vectors.** The calculated roots of floor and wall units carry the same
  vector set; the vectors say where a unit docks, not at which height it lives.
- **Classify by `insertLevelInfos`.** The library-neutral mounting height, but the stored article
  templates carry none and the planner's filling of them for catalog articles is unverified; the
  catalog's own default mounting height is the same information, readable today.
- **Classify by the root's attributes.** The agent sends `mod_HeightPosInsertion` and
  `mod_TypeElement` itself (the reproduce run); the root payload is not library data.
- **A served-text change or a guard.** The agent's payload is legitimate — a wall-level article
  belongs beside a wall unit and above a floor unit ([Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort));
  the misclassification is the tool's product, not the agent's input.
- **A library change (move the articles into a "Wall Units" category).** The categories "Cover
  Panels" and "Utility" are the library's taxonomy; the data already marks the articles, and the
  tool should read the marks. Reported to the library development team only for a wall-level
  article that carries neither marker.
- **A kernel change (RoomleCore).** The catalog compaction already passes `mainAttributes` and
  `dimensions`; no planner change is needed to read them.

## Implementation plan (sketch, roomle-ui, based on `fix/room-corners-at-openings`)

1. `hi-group-layout.ts` — `isWallUnitArticle` gains the two library-data checks (a helper reads
   `mod_TypeElement` off `rootModules[].mainAttributes` and the mounting height off
   `rootModules[].dimensions`, across all root modules, value `WallUnit` and height ≥ 500 mm).
2. `__tests__/hi-group-layout-test.ts` — the `article` fixture gains `mainAttributes` and a
   mounting-height dimension; new tests: a wall-level panel of another category (`W35O`-like,
   mounting height, no category word) `rightOf` a wall unit docks to the wall unit's side by the
   Bottom vectors with no correction; a wall-level article of another category
   (`HWR_WR600V1`-like, `mod_TypeElement` `WallUnit`, no mounting height) `above` a floor unit
   hangs above it with the D35 gap and no correction; a floor unit that sends
   `mod_HeightPosInsertion` in its root overrides is still taken for a floor unit; a genuine
   floor unit `rightOf` a wall unit still continues the floor row (the existing test
   `puts a floor unit that names a wall unit into the floor row` pins it).
3. Tests in `__tests__/hi-tool-docking-test.ts` and `__tests__/hi-tool-hints-test.ts` for the
   inherited behaviour: a wall-level panel merged above a floor unit gets the D35 gap; the hints
   name a moved wall-level panel with the wall row.
4. The stored tests then hold: `kitchen-conversation` — the `W35O` at the end of the wall-unit row
   docked beside `cups` at the wall-unit height; the random utility-room test — the `HWR_WR600V1`
   hung above the base units by the first create, no undo and no `merge-article-into-group`.
