# Backlog: article template geometry in the roomle-ui plan context

> **Type**: Backlog item (roomle-ui; replaces a workaround in the MCP server)
> **Domain**: roomle-ui `homag-intelligence` — `GlueLogicImplementation.getPlanContext`, `hi-plan-context.ts`; consumer: the hi-mcp server's `create-or-replace-groups`
> **Status**: Open — needs a measurement before it can be decided

---

## Problem

The docking vectors and the corner point of a Furniture_Smith article exist only as calculated
geometry: the article templates (`loadPosData`) and the master data carry no `dockInfos`. The compact
catalog of `getPlanContext` derives `dockingVectors`, `cornerArticle` and `cornerPoint` from
calculated roots of the article in the plan (`calculatedDockingVectorsByRoot`,
`calculatedCornerPointsByRoot`) and has nothing for an article that is not in the plan. On an empty
plan every article comes without docking vectors and without the corner flag.

The hi-mcp server works around it: for the anchor of every placed group it loads a single-pick probe
of the article as authored, reads the probe's docking vectors from the planner's raw groups
(`getExternalObjectGroups`), undoes the load (a page without `undo` removes the probe with
`removeExternalObject`) and caches the anchor frame per library, article and attribute overrides for
the server's lifetime (`probeAnchorFrame`, `takeBackProbe`, `knownAnchorFrames` in
`tool-executors.ts`). That costs an extra load per anchor variant and server start, needs planner
methods on every page allow-list, and leaves the catalog incomplete for every other consumer.

The template calculation would also give a size to the two Furniture_Smith articles whose template
has no `Dim` attribute — the range hood `DU` and the TV `SM_TV`: their `dimensions` are empty, so the
agent cannot know their width.

## To do

1. **Measure first** (in the example page): is `LibraryData.calculateGroup` free of side effects for
   the HOMAG library, and how long do the calculations of all 111 Furniture_Smith articles take? If the
   full catalog is too slow, restrict it to corner articles (category "… | Base Units | Corner").
2. **Decide** from the measurement: lazily per article on the first `getPlanContext`, or once after
   `loadPosData`.
3. **Implement in roomle-ui:** `getPlanContext` calculates the template of every article whose roots
   have no docking geometry and no calculated root in the plan, and feeds the result into the existing
   derivation:
   1. Build a single-pick group of the article: `{ libraryId, roots: [{ id, articleId }] }`.
   2. Complete it from the template (`_prepareArticlePickRoots`) and run it through the library
      calculation (`_calculateNewGroup(pick, true, true)` → `libraryData.calculateGroup`); the group is
      never added to `_groupMap` or the plan.
   3. Cache the calculated template per `articleId` (`null` when the calculation throws); clear the
      cache in `loadPosData`.
   4. Pass `[...calculatedGroups, ...calculatedTemplates]` to `calculatedDockingVectorsByRoot` and
      `calculatedCornerPointsByRoot`.
4. **Remove the workaround in the server** once roomle-ui is deployed: the probe
   (`probeAnchorFrame`, `takeBackProbe`, `knownAnchorFrames`), the `removeExternalObject` exposure on
   the page allow-lists, and the server's completion of `cornerArticle` from the category.
   Constraint: the anchor frame depends on the attribute overrides (`knownAnchorFrames` is keyed by
   library, article and overrides), and a template calculated per `articleId` gives the default
   variant only. An anchor with overrides (such as `mod_CarcaseDirection`) keeps the probe unless
   the templates are calculated per override set.

## Test

- roomle-ui unit tests: a template is calculated once and exposed; no calculation when the plan has a
  calculated root of the article; the cache is cleared on a new catalog.
- `get-plan-context` on an empty plan returns `cornerPoint: [-261, 0, 0]` and the eight docking vector
  names for `EUERTB90`; the first corner kitchen of an empty plan lands with its corner point on the
  room corner without a probe load.
