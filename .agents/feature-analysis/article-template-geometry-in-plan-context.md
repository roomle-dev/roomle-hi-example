# Article template geometry in getPlanContext

- **Ticket**: RML-18140 — https://roomle.atlassian.net/browse/RML-18140
- **Status**: Open
- **Branch**: roomle-ui `fix/hi-mcp-api-and-tools`, roomle-hi-example `fix/hi-mcp-api-and-tools`
- **Type**: Feature analysis (a new capability in `getPlanContext` plus the removal of a server workaround)
- **Sequencing**: the calculation is an **independent, reusable prerequisite** — it lives in the
  glue-logic and is consumed by the existing `getPlanContext` articles branch, so it needs no new
  group-operation command and no server change to land. The refactoring
  ([`move-tool-logic-to-glue-logic.md`](../refactoring-analysis/move-tool-logic-to-glue-logic.md))
  then reuses the same calculation for the placement commands and deletes the server probe. See §4.

## Affected repositories

- **roomle-ui** — `getPlanContext` derives the docking vectors and the corner point of an article
  that is not in the plan from a **per-article, lazily calculated and cached** template;
  `loadPosData` clears the template cache.
- **roomle-hi-example** — the MCP server drops the anchor probe (`probeAnchorFrame`, `takeBackProbe`,
  `knownAnchorFrames`) and the planner methods it needs.
- **ligna-store** — no change; it consumes `getPlanContext` and benefits from the complete catalog.

## 1. What was asked and why

The compact article catalog of `getPlanContext` describes every article of the loaded libraries so
the agent can pick one and dock it. Two facts the agent needs are missing for an article that is not
yet in the plan:

- **the docking vectors** of its root modules — the agent needs them to dock a new root to a free
  vector of an existing root, and to know which vectors a new root offers;
- **the corner point** and the **corner flag** of a corner article — the agent needs them to place a
  group into a room corner.

Both exist only as *calculated* geometry. The article templates (`loadPosData`) and the master data
carry no `dockInfos`, so the catalog derives them from calculated roots of the same article that are
already in the plan (`calculatedDockingVectorsByRoot`, `calculatedCornerPointsByRoot` in
`hi-plan-context.ts`). On an empty plan there is no such root, so every article comes without
docking vectors and without the corner flag.

The MCP server works around this: for the anchor of every placed group it loads a single-pick probe
of the article, reads the probe's docking vectors from the planner's raw groups, undoes the load and
caches the anchor frame per library, article and attribute overrides for the server's lifetime
(`probeAnchorFrame`, `takeBackProbe`, `knownAnchorFrames` in `tool-executors.ts`). That costs an
extra load per anchor variant and per server start, needs planner methods on every page allow-list,
and leaves the catalog incomplete for every other consumer.

The template calculation would also give a size to articles whose template has no `Dim` attribute —
for example the range hood `DU` and the TV `SM_TV` in Furniture_Smith: their dimensions are empty, so
the agent cannot know their width. This is a side benefit, not the reason for the change.

## 2. How the area works today

### 2.1 The catalog derivation (`hi-plan-context.ts`)

`calculatedDockingVectorsByRoot(groups)` (line 528) and `calculatedCornerPointsByRoot(groups)`
(line 550) walk the calculated roots of the given groups and key the docking vector names and the
corner point by article id and root module id. `compactArticle(article, masterData,
calculatedDockingVectors, calculatedCornerPoints?)` fills `rootModules[].dockingVectors`,
`cornerArticle` and `cornerPoint` from those maps, falling back to the template's own `dockInfos`
when it has them.

### 2.2 The catalog assembly (`glue-logic.ts`, `getPlanContext`)

`getPlanContext(include?)` (line ~1240) fetches `calculatedGroups = await
this._designerRequests.getPosDataOfAllGroups()` once when `groups`, `articles` or `obstacles` are
included. The `articles` branch (line 1263) then computes

```ts
const calculatedDockingVectors = calculatedDockingVectorsByRoot(calculatedGroups ?? []);
const calculatedCornerPoints = calculatedCornerPointsByRoot(calculatedGroups ?? []);
```

and maps every `_posArticleMap` value through `compactArticle`. This is the exact insertion point:
the derivation must see the calculated templates in addition to the calculated groups.

### 2.3 The template calculation (`glue-logic.ts`)

- `loadPosData(articleCatalogJson, libraryId)` (line 825) fills `_posArticleMap` (or
  `_posSubArticleMap` when `isConfigDummy`), each entry `deepCopy`'d with `libraryId` set. This is
  where the template cache must be cleared.
- `_prepareArticlePickRoots(posGroup)` (line 1117) turns an article-pick root (`_isArticlePickRoot`:
  has `articleId`, no `posData`/`modules`/`parts`) into the article's template roots: it deep-copies
  the `PosArticle`, gives each template root a unique id, remaps the internal docking references,
  calls `_updateRootModuleFromArticle` and, for index 0, copies `contextData`/`articlePos`/
  `rotationY` from the pick and applies `_applyRootAttributeOverrides`.
- `_calculateNewGroup(posDataJson, keepRootModuleIDs, initializePosGroup)` (line 2956) is
  `this._replacesIDs(posDataJson, keepRootModuleIDs); if (initializePosGroup) {
  this._initializePosGroup(posDataJson); } return this._calculate(posDataJson);`.
- `_calculate(originalPosDataJson)` (line 4163) runs `_updatePosData` with
  `libraryData.calculateGroup(posGroup)` inside a try/catch that logs and returns the input group on
  error.
- `_updatePosData` (line 4354) deep-copies the group, sets `libraryId`, clears `logMessages`, calls
  the update function and takes over `pos`/`rotationY`/`contextData` from the original. It touches
  no map.
- `_addNewGroup` (line 3150) is the only place that writes `_groupMap`; `_calculateNewGroup` alone
  does not.

So a template calculation is `_prepareArticlePickRoots(pick)` followed by
`_calculateNewGroup(pick, true, true)`, and it is free of side effects on `_groupMap` as long as the
result is not passed to `_addNewGroup`/`_storeCalculatedGroup`.

### 2.4 The server workaround (`tool-executors.ts`)

`probeAnchorFrame(roomDesignerApi, anchor, libraryId, planGroupIds)` loads a single-pick probe group
as authored, reads the calculated root's docking vectors from `getExternalObjectGroups()`, calls
`takeBackProbe` (undo, or `removeExternalObject` on a page without undo) and returns
`anchorFrameOfRoot(calculated)` or `IDENTITY_FRAME`. `knownAnchorFrames` caches the frame per
`anchorVariantKey` (library, article, sorted attributes) for the server's lifetime;
`forgetAnchorFrames()` clears it.

## 3. The gap

`getPlanContext` has no source for the docking geometry of an article that is not in the plan, so
the catalog is incomplete on an empty plan and the server compensates with a probe load. The gap is
closed by calculating the article template once and feeding it into the existing derivation.

## 4. Proposed design

The calculation is **per article, lazy, cached** — never the whole catalog. A library with 1000
articles costs nothing until an article is asked for. This is the same granularity the server's
`knownAnchorFrames` has today, moved into the glue-logic where the calculation belongs.

In roomle-ui, the glue-logic gains a private `_calculatedTemplateOf(articleId, attributes?)` next to
`_prepareArticlePickRoots` / `_calculateNewGroup`:

1. **Build a single-pick group** of the article: `{ libraryId, roots: [{ id, articleId, attributes? }] }`.
2. **Complete it from the template** (`_prepareArticlePickRoots`) and run it through the library
   calculation (`_calculateNewGroup(pick, true, true)` → `libraryData.calculateGroup`). The group is
   never added to `_groupMap` or the plan.
3. **Cache the calculated template** by `anchorVariantKey` (library, article, sorted attributes) —
   the same key the server uses today — and clear the cache in `loadPosData`.
4. **`getPlanContext`'s articles branch** passes the calculated templates of the requested articles
   into `calculatedDockingVectorsByRoot` / `calculatedCornerPointsByRoot`, in addition to the
   calculated groups. The catalog now carries the docking vectors and the corner point of an article
   that is not in the plan.

The same `_calculatedTemplateOf` serves the `create-or-replace-groups` / `place-group` commands of
the refactoring (anchor frame, footprint), so the catalog pass and the placement pass share one
cache and never calculate the same article twice.

Then remove the server workaround once roomle-ui is deployed: the probe (`probeAnchorFrame`,
`takeBackProbe`, `knownAnchorFrames`, `forgetAnchorFrames`) and the planner methods it needs
(`getExternalObjectGroups`, `removeExternalObject`) leave `tool-executors.ts` and `planner-api.ts`.

### 4.1 The articles branch needs an article-level selector

The `articles` branch of `getPlanContext` (line 1263) maps over **every** `_posArticleMap` value —
it has no article-id filter. Feeding "the calculated templates of the articles it is about to
describe" into that branch therefore means calculating **every uncached article of every loaded
library** on the first request: the catalog-wide pass rejected in §4.3, not work proportional to the
handful the agent uses. A 1000-article library would incur 1000 calculations on its first articles
request despite the cache.

The design therefore needs an **article-level selector** on the articles section, so the caller
names the articles whose geometry it wants:

- `getPlanContext(include: ['articles'])` keeps returning the compact catalog for every article, as
  today, but **without** the calculated docking vectors and corner point for articles that are not
  in the plan (the current behaviour — the derivation still reads the calculated groups).
- A new opt-in detail request names the articles to calculate, for example
  `getPlanContext(include: ['articles'], articleIds: ['<id>', …])` or a dedicated
  `getArticleGeometry(articleIds)` call. Only those articles are calculated and cached; the catalog
  entries for them carry the docking vectors and the corner point.

The MCP server knows which articles it is about to describe — the ones the agent picked or is
choosing between — so it passes exactly those ids. The cost is then proportional to the agent's use,
which is what the per-article cache promises. Without the selector the cache is defeated on the
first call, so the selector is part of the design, not an optimisation.

### 4.2 The failure signal must be explicit

`_calculate` (line 4163) catches the calculation exception, logs it and returns the **input group**,
so `_calculateNewGroup` never throws and a caller cannot observe a failure by catching. Caching
`null` "when the calculation throws" is therefore not implementable through this call as written: a
failed calculation would be cached as a successful, uncalculated template.

The calculation path needs an explicit failure signal. Two options:

- **Validate the returned group** before caching: a calculated template carries the geometry the
  derivation reads (`dockInfos` on its roots, a corner point for a corner article); a group that
  still equals the input, or that carries no calculated geometry, is a failure. This needs no change
  to `_calculate`.
- **Return the outcome from the calculation**: a variant of `_calculateNewGroup` that reports
  whether `libraryData.calculateGroup` threw, so `_calculatedTemplateOf` caches the template only on
  success and caches the failure (or nothing) otherwise.

The second is cleaner and is the preferred shape; the first is the fallback if the calculation path
must stay untouched. Either way the cache never stores an uncalculated template as successful.

### 4.3 Why not "calculate all articles"

Calculating every article of every loaded library on each `getPlanContext` does not scale: the
Furniture_Smith library has 111 articles, a larger library has 1000, and the cost grows with the
catalog while the agent asks for a handful of articles. It is also not library-neutral — it bakes a
catalog-wide pass into a server that must serve every library. The per-article cache with the
article-level selector of §4.1 has neither problem: the cost is proportional to what the agent
actually uses, and the glue-logic knows nothing about a specific library.

### 4.4 Measure once

Before relying on the cache, measure in the example page whether `LibraryData.calculateGroup` is
free of side effects for the HOMAG library (it is `libraryExports.calc`, a pure library function —
`homag-intelligence.ts:159` — but confirm it mutates no library-global state). The per-article cost
is then the only number that matters, and it is paid once per article.

## 5. Alternatives considered

- **Keep the server probe.** Rejected: it costs an extra load per anchor variant and per server
  start, needs planner methods on every page allow-list, and leaves the catalog incomplete for every
  other consumer.
- **Add `dockInfos` to the article templates or the master data.** Rejected: the templates come from
  the library and carry no geometry; the docking vectors are a result of the calculation, not of the
  template.
- **Calculate the whole catalog eagerly on every `getPlanContext`.** Rejected: it does not scale to a
  large library and it is not library-neutral — see §4.3. The per-article cache with the
  article-level selector of §4.1 is the design.
- **Restrict the calculation to corner articles by category.** Rejected: it hard-codes a library
  category into the glue-logic. The per-article cache needs no such restriction.

## 6. Code and documents the work would touch

- `roomle-ui/packages/web-sdk/packages/homag-intelligence/src/glue-logic.ts` — the template
  calculation and its cache, the article-level selector on the `getPlanContext` articles branch,
  `loadPosData`.
- `roomle-ui/packages/web-sdk/packages/homag-intelligence/src/hi-plan-context.ts` — the derivation
  helpers already accept a list of groups; the selector narrows which templates are passed in.
- `roomle-hi-example/hi-mcp/hi-mcp-server/tool-executors.ts` — pass the article ids the agent is
  about to describe; remove the probe.
- `roomle-hi-example/hi-mcp/hi-mcp-server/planner-api.ts` — remove the methods the probe needed.
- `roomle-hi-example/docs/hi-mcp-behaviour.md` — the catalog description.
- `roomle-hi-example/.agents/skills/hi-mcp-tools.md` — the `get-plan-context` reference.

## 7. Open questions

- Does `calculateGroup` mutate any library-global state for the HOMAG library?
- Is the per-article calculation fast enough that the cache is a pure win, or does the first
  `getPlanContext` need to warm it in the background?
