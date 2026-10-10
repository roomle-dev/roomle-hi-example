# Refactoring Analysis: Move HI MCP tool logic into the roomle-ui glue-logic

**Status**: Open
**Ticket**: [RML-18140](https://roomle.atlassian.net/browse/RML-18140)
**Branch**: `refactor/move-tool-logic-to-glue-logic`

## Affected repositories

- **roomle-ui** — `packages/web-sdk/packages/homag-intelligence/src/glue-logic.ts` and
  `hi-plan-context.ts`: take over the validation, id resolution, geometry and hint logic that today
  lives in the MCP server, and expose it through the existing `externalObjectGroupOperation` seam.
- **roomle-hi-example** — `hi-mcp/hi-mcp-server/tool-executors.ts` (and the helpers it imports from
  `group-placement.ts`, `group-layout.ts`, `plan-space.ts`): shrink to a thin adapter that forwards
  agent input to the planner and shapes the result for the agent.
- **ligna-store** — no change expected; it consumes the same planner methods through its own page
  bridge and benefits from the same glue-logic.

## 1. What the current code does and why it is a problem

### 1.1 The two layers today

The HI MCP server (`hi-mcp/hi-mcp-server`) and the roomle-ui glue-logic
(`packages/web-sdk/packages/homag-intelligence/src/glue-logic.ts`) both implement parts of the same
feature: turning an agent's intent ("put a tall unit next to the fridge", "change the front colour")
into a planner mutation and a result the agent can read.

The seam between them is the planner method `externalObjectGroupOperation(command, payload)`
(`planner-api.ts`), which the page relays to `roomDesignerApi.extended`. On the roomle-ui side that
method is `GlueLogic.executeGroupOperation` → `runGroupOperation(command, payload, this)`
(`hi-plan-context.ts`), which validates the payload, dispatches to a `HiGroupOperations` method and
returns a `HiGroupOperationResult`.

The problem is that the MCP server does **not** stop at the seam. `tool-executors.ts` (5627 lines)
re-implements a large part of what the glue-logic already owns or could own:

- **Payload validation and normalisation** — `normalizePlacement`, `normalizeWallPlacement`,
  `dropUnknownPlacementFields`, `WALL_PLACEMENT_DEFAULTS`, `isArticlePickOnly`, `toArticlePick`,
  `stripDockingIndices`, `dockingErrors`, `sideVectorConflicts`. The glue-logic validates the same
  payloads again in `hi-plan-context.ts` (`articlePick`, `dockTarget`, `attributeChanges`,
  `mergedGroupIds`, `twoRootModuleIds`).
- **Id resolution** — `resolveRootId` (exact, unique prefix, UUID first segment, one-char-off),
  `findGroup`, `groupOfRoot`, `groupHoldingRoot`, `rootsOfGroups`, `rootModulesByGroup`,
  `catalogArticleId`, `catalogSpellingOf`, `resolveArticleIds`. The glue-logic resolves the same ids
  again (`_requireRootModule`, `_requireGroupsInScene`, `_requireArticleOfOneRoot`,
  `_requirePosArticleKey`).
- **Geometry and layout** — the whole of `plan-space.ts` (footprints, wall spans, corner geometry,
  overlap tests, `freeStretchesAlongWall`, `placeAgainstWall`, `placeCornerAtWalls`,
  `repositioningFromPlacement`) and `group-layout.ts` (relations → docking, `hangGapOf`,
  `isBaseUnitArticle`/`isWallUnitArticle`/`isTallUnitArticle`). The glue-logic has the calculated
  geometry of every root (`getCalculatedGroups`, `calculatedDockingVectorsByRoot`,
  `calculatedCornerPointsByRoot`) and does not need the server's re-derivation.
- **Anchor-frame probing** — `probeAnchorFrame`, `takeBackProbe`, `knownAnchorFrames`,
  `anchorFrameOfRoot`, `anchorVariantKey`, `toRepositioningData` in `group-placement.ts`. This is
  the workaround RML-18140 describes: the server loads a single-pick probe of an article to read its
  docking vectors, undoes the load and caches the frame per library/article/overrides.
- **Hints** — `rowReachHints`, `movedUnitsAboveHint`, `turnedLegHints`, `withRowHints`,
  `withCorrections`, `withLibraryChanges`, `withPlanRoots`, `withUnitsAboveDocked`. These read the
  plan before and after a mutation and describe what moved; the glue-logic already has the
  before/after calculated groups.

### 1.2 Why this is a problem

1. **Duplication and drift.** The same validation and id resolution exists twice, in two languages
   of intent (server-side "correct the agent" vs. glue-logic "protect the kernel"). A rule changed
   in one place silently diverges from the other.
2. **The server needs planner methods the pages must allow-list.** The probe workaround needs
   `getExternalObjectGroups` and `removeExternalObject` on every page's `MCP_PLANNER_METHODS` /
   `PLANNER_METHODS`. Every new server-side need adds a method to every page.
3. **The catalog is incomplete for every other consumer.** Docking vectors and the corner point are
   derived from calculated roots in the plan, so an article that is not in the plan has none. The
   server patches this with the probe; the ligna-store and any other consumer get nothing. The fix
   is a per-article calculation in the glue-logic (§2.4), which serves every consumer.
4. **The server cannot see the calculated geometry.** It re-derives footprints and wall spans from
   raw groups and the room, which is exactly the geometry the kernel already calculated. This is the
   source of the `PLACE_EPSILON_MM`, `OVERLAP_TOLERANCE_MM` and `WALL_STRIP_MM` fudge factors.
5. **The API surface grows.** The user's constraint: keep the number of planner API functions at a
   minimum and use `externalObjectGroupOperation` as much as possible.

## 2. Full scope of the change

### 2.1 roomle-ui — `glue-logic.ts` / `hi-plan-context.ts`

The glue-logic already owns the `HiGroupOperations` interface and the `runGroupOperation`
dispatcher. The refactoring extends that seam so the server can send **intent** instead of
pre-resolved ids and pre-computed geometry.

| Server logic today | Target home in roomle-ui |
|---|---|
| `resolveRootId`, `findGroup`, `groupOfRoot`, `groupHoldingRoot` | glue-logic resolves ids inside each operation (it already has `_requireRootModule`, `_requireGroupsInScene`); the result carries the resolved ids and a correction when a prefix or a root id named a group |
| `catalogArticleId`, `catalogSpellingOf`, `resolveArticleIds` | glue-logic resolves the article against the loaded catalog; the result carries the resolved `articleId` and a correction |
| `normalizePlacement`, `normalizeWallPlacement`, `dropUnknownPlacementFields`, `WALL_PLACEMENT_DEFAULTS` | a new `place-group` command on `externalObjectGroupOperation` (see §2.3) validates and applies the placement in the glue-logic, where the calculated footprint is available |
| `plan-space.ts` geometry (`groupFootprint`, `placeAgainstWall`, `placeCornerAtWalls`, `freeStretchesAlongWall`, `volumesOverlap`, …) | glue-logic, over the calculated groups; the server keeps only what it needs to *describe* a result to the agent |
| `group-layout.ts` relations → docking | already in the glue-logic for `merge-article-into-group` / `insert-article-into-group`; the server's `relationsToDocking` for `create-or-replace-groups` moves down as a `create-or-replace-groups` command |
| `probeAnchorFrame`, `takeBackProbe`, `knownAnchorFrames`, `anchorFrameOfRoot`, `anchorVariantKey`, `toRepositioningData` | removed from the server; replaced by a **per-article template calculation in the glue-logic** (see §2.4) — the same calculation the refactoring moves down, not a separate feature |
| `rowReachHints`, `movedUnitsAboveHint`, `turnedLegHints`, `withRowHints` | glue-logic computes the hints from the before/after calculated groups and returns them in `HiGroupOperationResult.corrections` / a new `hints` field |
| `withCorrections`, `withLibraryChanges`, `withPlanRoots`, `withUnitsAboveDocked` | glue-logic; the server keeps only the agent-facing phrasing |

### 2.2 roomle-hi-example — `tool-executors.ts`

The executors shrink to:

1. read the agent's arguments,
2. call `externalObjectGroupOperation(command, payload)` (or the few remaining planner methods),
3. shape the returned `HiGroupOperationResult` for the agent (rename `command` to the tool name,
   keep `corrections`, `hints`, `groupIds`, `changedModuleIds`).

The helpers that move down are deleted from the server; the helpers that stay are the ones that
only make sense for an agent (shortening `desc`, naming walls, `agentFacingArticle`,
`agentFacingRooms`, `agentFacingObstacles`, `shortDescription`).

### 2.3 The API-surface constraint

The user's rule: **keep the number of planner API functions at a minimum; use
`externalObjectGroupOperation` as much as possible.**

Today the server calls nine planner methods (`planner-api.ts`). The refactoring should reduce the
set the *tools* need to:

- `getExternalObjectPlanContext(include)` — read the plan (unchanged).
- `externalObjectGroupOperation(command, payload)` — **every** mutation, including the new
  `create-or-replace-groups` and `place-group` commands.
- `fetchPrice()`, `getExternalObjectSnapshot(options)` — read-only, unchanged.
- `undo()`, `redo()` — unchanged.

`loadExternalObjectGroupLayout` and `getExternalObjectGroups` and `removeExternalObject` leave the
tool path: the layout load becomes a `create-or-replace-groups` command, the raw groups are no
longer needed (the calculated groups come back in the result), and the probe is gone.

New commands on `externalObjectGroupOperation` (each a `HiGroupOperation` member):

- `create-or-replace-groups` — the whole pos-group payload; the glue-logic builds the docking from
  the relations, loads the layout and positions the group.
- `place-group` — `{ groupId, wall, alignment?, offsetMm?, roomIndex? }`; the glue-logic computes
  the placement from the calculated footprint and the room walls.

This keeps the planner API at the current size while moving the logic down.

### 2.4 The refactoring is the enabler for RML-18140, not its prerequisite

The first version of this analysis put RML-18140 (the template calculation in `getPlanContext`)
**before** the refactoring. That ordering is wrong, and the code says so.

**The calculation is already a pure library function.** `LibraryData.calculateGroup` is
`libraryExports.calc(groupData)` (`homag-intelligence.ts:159`) — no kernel, no scene, no planner
call. `_prepareArticlePickRoots(posGroup)` (`glue-logic.ts:1117`) turns an article pick into the
article's template roots by deep-copying the `PosArticle` from `_posArticleMap` — again without
touching the scene. `_calculateNewGroup(pick, true, true)` (`glue-logic.ts:2956`) is
`_replacesIDs` + `_initializePosGroup` + `_calculate`, and `_calculate` (`glue-logic.ts:4163`) runs
`libraryData.calculateGroup` inside `_updatePosData` (`glue-logic.ts:4354`), which touches no map.
Only `_addNewGroup` (`glue-logic.ts:3150`) writes `_groupMap`.

So the glue-logic can calculate **one article's** geometry on demand, in-process, with no scene
load and no planner round trip:

```ts
const pick = { libraryId, roots: [{ id, articleId, attributes? }] };
this._prepareArticlePickRoots(pick);          // template roots from _posArticleMap
const calculated = this._calculateNewGroup(pick, true, true); // libraryExports.calc
// calculated.roots[0].dockInfos, .articlePos, .dimensions, corner point
```

That is exactly what the server's probe does today — but the probe does it by **loading a group
into the live scene, reading it back and undoing it**, which is why it needs
`loadExternalObjectGroupLayout`, `getExternalObjectGroups`, `removeExternalObject` and `undo` on
every page allow-list, and why it costs a load per anchor variant.

**Consequences for the ordering:**

- The per-article calculation belongs **in the glue-logic**, next to `_prepareArticlePickRoots` and
  `_calculateNewGroup`, and it is reached through the **same seam** the refactoring builds
  (`externalObjectGroupOperation`). It is not a separate feature that must land first.
- Doing RML-18140 first would mean building the calculation **in the server** (or in
  `getPlanContext` as a catalog-wide pass) and then moving it down again — the duplication the
  refactoring exists to remove.
- The refactoring therefore **subsumes** RML-18140: once the calculation lives in the glue-logic,
  the probe is deleted, the catalog is completed for every consumer, and the planner methods the
  probe needed leave the allow-lists. RML-18140 becomes a consequence of the refactoring, not a
  prerequisite.

**Per article, not the whole catalog.** The calculation is per `articleId` (and per attribute
override set), computed lazily on first need and cached. It is never "calculate all 111" — a
library with 1000 articles costs nothing until an article is asked for. The cache is keyed by
`anchorVariantKey` (library, article, sorted attributes) — the same key the server's
`knownAnchorFrames` uses today — and cleared in `loadPosData` (`glue-logic.ts:825`), where the
templates are (re)loaded.

**Where the result is consumed.** Two consumers, one calculation:

- `getPlanContext`'s articles branch (`glue-logic.ts:1263`) feeds the calculated templates into
  `calculatedDockingVectorsByRoot` / `calculatedCornerPointsByRoot` so the catalog carries the
  docking vectors and the corner point of an article that is not in the plan.
- The `create-or-replace-groups` / `place-group` commands use the same calculated template to
  derive the anchor frame and the footprint, replacing `probeAnchorFrame` and the server's
  `plan-space.ts` re-derivation.

Both read the same per-article cache, so the catalog pass and the placement pass never calculate
the same article twice.

## 3. Proposed target shape

```
agent ──▶ MCP tool executor (thin)
             │  reads args, calls externalObjectGroupOperation(command, payload)
             ▼
        page bridge ──▶ roomDesignerApi.extended.externalObjectGroupOperation
             ▼
        GlueLogic.executeGroupOperation ──▶ runGroupOperation(command, payload, this)
             ▼
        HiGroupOperations.<operation>   (validation, id resolution, geometry, hints)
             ▼
        kernel / library calculation
```

The server keeps: argument reading, agent-facing phrasing, result shaping, the tool registry.
The glue-logic gains: id resolution, article resolution, placement validation and application,
geometry, hints, and the template calculation of RML-18140.

## 4. Tests covering the affected behaviour

- **roomle-ui unit tests** (`packages/web-sdk/packages/homag-intelligence`): the existing
  `runGroupOperation` tests extend to the new commands; new tests for id resolution, placement
  application and hints. The per-article calculation adds tests for the cache (calculated once per
  `anchorVariantKey`, cleared on a new catalog, no calculation when the plan already has a
  calculated root).
- **roomle-hi-example unit tests** (`hi-mcp/hi-mcp-server/tests`): the executor tests shrink to the
  adapter behaviour (argument reading, result shaping, error phrasing); the moved logic is tested in
  roomle-ui.
- **End-to-end**: `docs/test-prompts.json` runs unchanged; the observable tool results must stay
  equivalent (same `groupIds`, same corrections, same hints).

## 5. Output changes to expect

- Tool results keep their shape; `corrections` and `hints` now originate in the glue-logic.
- `get-plan-context` on an empty plan returns docking vectors and `cornerPoint` for articles not in
  the plan (the per-article calculation of §2.4), so the server's `agentFacingArticle` no longer
  completes `cornerArticle` from the category.
- The page allow-lists lose `getExternalObjectGroups` and `removeExternalObject` (the example page
  keeps `removeExternalObject` for its own UI).

## 6. Alternatives considered and rejected

- **Keep the logic in the server, add planner methods.** Rejected: it grows the API surface the user
  wants to shrink, and it keeps the catalog incomplete for other consumers.
- **Move everything at once.** Rejected: the change is large and touches two repositories; it should
  land in steps (see §7), each verified against the test prompts.
- **A new dedicated planner method per operation.** Rejected: `externalObjectGroupOperation` already
  carries a command and a payload; new commands are cheaper than new methods.

## 7. Suggested steps

The refactoring is the enabler; RML-18140 is a consequence of it, not a prerequisite (§2.4).

1. **Add the per-article template calculation to the glue-logic** — a private
   `_calculatedTemplateOf(articleId, attributes?)` next to `_prepareArticlePickRoots` /
   `_calculateNewGroup`, cached by `anchorVariantKey`, cleared in `loadPosData`. This is the
   calculation RML-18140 needs, in its final home.
2. **Feed it into `getPlanContext`** — the articles branch passes the calculated templates into
   `calculatedDockingVectorsByRoot` / `calculatedCornerPointsByRoot`. The catalog now carries the
   docking vectors and the corner point of an article that is not in the plan. (This is RML-18140,
   done in the glue-logic.)
3. **Add `create-or-replace-groups` and `place-group` commands** on
   `externalObjectGroupOperation`; move `group-layout.ts` and the placement geometry down; the
   commands use the same per-article calculation for the anchor frame and the footprint.
4. **Move id and article resolution** into the glue-logic operations; the server sends the raw ids
   and the result carries the resolved ones plus corrections.
5. **Move the hints** into the glue-logic result.
6. **Delete the moved helpers and the probe** from the server (`probeAnchorFrame`, `takeBackProbe`,
   `knownAnchorFrames`, `forgetAnchorFrames`, `plan-space.ts`, `group-layout.ts`) and drop
   `loadExternalObjectGroupLayout`, `getExternalObjectGroups`, `removeExternalObject` from the tool
   path and the page allow-lists.

Steps 1–2 are RML-18140; they are the first steps of the refactoring because the calculation must
land in the glue-logic, not in the server.

## 8. Open questions

- Does `LibraryData.calculateGroup` mutate any library-global state for the HOMAG library? (Measure
  once, in the glue-logic, before relying on the cache.)
- Should the hints travel in `HiGroupOperationResult` as a new `hints` field, or stay in
  `corrections`?
- The anchor frame depends on the attribute overrides; the per-article cache is keyed by
  `anchorVariantKey` (library, article, sorted attributes), so an anchor with overrides is a
  separate cache entry — the same granularity the server's `knownAnchorFrames` has today. Confirm
  that the override set is small enough that the cache stays bounded.
