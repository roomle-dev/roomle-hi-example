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

The hi-mcp server works around it: it reads the corner point from the planner's raw groups
(`getExternalObjectGroups`) and, when the plan has no calculated corner article, loads a single-pick
probe of the article, reads its docking vectors, removes it (`removeExternalObject`) and caches the
point for the server's lifetime (`probeCornerPoint`, `knownCornerPoints` in `tool-executors.ts`).
That costs an extra load per corner module and server start, needs two planner methods on every page
allow-list, and leaves the catalog incomplete for every other consumer.

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
   (`probeCornerPoint`, `knownCornerPoints`), the `removeExternalObject` exposure on the page
   allow-lists, and the server's completion of `cornerArticle` from the category.

## Test

- roomle-ui unit tests: a template is calculated once and exposed; no calculation when the plan has a
  calculated root of the article; the cache is cleared on a new catalog.
- `get-plan-context` on an empty plan returns `cornerPoint: [-261, 0, 0]` and the eight docking vector
  names for `EUERTB90`; the first corner kitchen of an empty plan lands with its corner point on the
  room corner without a probe load.
