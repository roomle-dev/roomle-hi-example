# Backlog: article template geometry in the roomle-ui plan context

> **Type**: Backlog item (deferred approach, with a tried implementation)
> **Domain**: roomle-ui `homag-intelligence` — `GlueLogicImplementation.getPlanContext`, `hi-plan-context.ts`; consumer: the hi-mcp server's `create-or-replace-groups`
> **Origin**: [corner-offset-missing-on-an-empty-plan.md](../bug-analysis/corner-offset-missing-on-an-empty-plan.md), alternative to the server-side probe chosen there
> **Date**: 2026-09-30
> **Status**: Deferred — "too dangerous for now"; the server-side probe is in place instead

---

## The gap this would close

The docking vectors and the corner point of a Furniture_Smith article exist only as calculated
geometry: the article templates (`loadPosData`) and the master data carry no `dockInfos`. The
compact catalog of `getPlanContext` therefore derives `dockingVectors`, `cornerArticle` and
`cornerPoint` from calculated roots of the article in the plan (`calculatedDockingVectorsByRoot`,
`calculatedCornerPointsByRoot`), and has nothing for an article that has never been placed. On an
empty plan every article comes without docking vectors and without the corner flag, and a corner
kitchen cannot be anchored by its corner point.

Today the hi-mcp server works around this itself: it reads the corner point from the planner's raw
groups (`getExternalObjectGroups`) and, when the plan has no calculated corner article, loads a
single-pick probe of the article, reads its docking vectors, removes it again
(`removeExternalObject`) and caches the point for the server's lifetime. That costs a visible
extra load per corner module and server start, needs two planner methods on every page
allow-list, and leaves the catalog itself incomplete for every other consumer.

## The roomle-ui approach

`getPlanContext` calculates the template of every article whose roots have no docking geometry and
no calculated root in the plan, and feeds the result into the existing derivation:

1. Build a single-pick group of the article: `{ libraryId, roots: [{ id, articleId }] }`.
2. Complete it from the template (`_prepareArticlePickRoots`) and run it through the library
   calculation (`_calculateNewGroup(pick, true, true)` → `libraryData.calculateGroup`), which gives
   its roots the `dockInfos`. The group is never added to `_groupMap` or the plan.
3. Cache the calculated template per `articleId` (`null` when the calculation threw); clear the
   cache in `loadPosData`.
4. Pass `[...calculatedGroups, ...calculatedTemplates]` to `calculatedDockingVectorsByRoot` and
   `calculatedCornerPointsByRoot`; `compactArticle` then carries `dockingVectors`, `cornerArticle`
   and `cornerPoint` for every article, also on an empty plan.

The implementation with three unit tests (template calculated once and exposed; no calculation when
the plan has a calculated root; cache cleared on a new catalog) was made on the roomle-ui branch
`refactor/hi-plan-context-RML-17966` as "feat: calculate article templates for the plan context
catalog" and reverted on 2026-09-30 — 229 homag-intelligence tests passed, typecheck and lint were
clean.

## Why it is deferred

- **Cost and side effects of the library calculation are unmeasured.** On an empty plan the first
  `getPlanContext(['articles'])` would calculate all 111 Furniture_Smith articles through the
  HOMAG library. Duration, memory and possible side effects inside the library (it is not known to
  be pure) have not been checked in a browser.
- **Deployment.** The example page and the ligna-store load the deployed UI (`bo-test`); the change
  has no effect on them until that UI is deployed, and the deployed UI does not even carry the
  existing `cornerPoint` derivation of `a574b204b` yet.
- **The probe works now**, without touching roomle-ui.

## When it is done

- The hi-mcp server's probe (`probeCornerPoint`, `knownCornerPoints` in `tool-executors.ts`) and
  the `removeExternalObject` exposure become unnecessary; `getExternalObjectGroups` can stay for
  the plan's own calculated corner articles or go too, since the catalog then carries
  `cornerPoint`.
- The agent-facing catalog shows `cornerArticle` and the docking vector names for every article
  on an empty plan without the server completing the flag from the category.
- Acceptance: `get-plan-context` on an empty plan returns `cornerPoint: [-261, 0, 0]` and the
  eight docking vector names for `EUERTB90`; the first corner kitchen of an empty plan lands with
  its corner point on the room corner without any probe load.

## Open questions before starting

1. Is `LibraryData.calculateGroup` side-effect free for the HOMAG library, and how long do 111
   calculations take? Measure in the example page; restrict to corner articles (category
   "… | Base Units | Corner") if the full catalog is too slow.
2. Should the calculation run lazily per article on the first `getPlanContext` (as tried) or once
   after `loadPosData`?
