# Refactoring Analysis: Move HI MCP tool logic into the roomle-ui glue-logic

**Status**: Open
**Ticket**: [RML-18147](https://roomle.atlassian.net/browse/RML-18147) — enables
[RML-18140](https://roomle.atlassian.net/browse/RML-18140) (steps 1–2 of §7)
**Branch**: `refactor/move-tool-logic-to-glue-logic`
**Code base**: the roomle-ui line numbers are those of `release/bo-test`; the hi-mcp ones of `master`

## Affected repositories

- **roomle-ui** — `packages/web-sdk/packages/homag-intelligence/src/glue-logic.ts` and
  `hi-plan-context.ts`: take over the validation, id resolution, geometry and hint logic that today
  lives in the MCP server, and expose it through the existing `externalObjectGroupOperation` seam.
- **roomle-hi-example** — `hi-mcp/hi-mcp-server/tool-executors.ts` (and the helpers it imports from
  `group-placement.ts`, `group-layout.ts`, `plan-space.ts`): shrink to a thin adapter that forwards
  agent input to the planner and shapes the result for the agent.
- **ligna-store** — `hi-mcp/browser-bridge.ts`, its copy of the page bridge (on `master`), loses
  the three planner methods in step 6 of §9; nothing else — it consumes the same planner methods
  through its own page bridge and benefits from the same glue-logic.

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
  again (`_requireRootModule`, `_requireGroupsInScene`, `_requirePosArticleKey`).
- **Geometry and layout** — the whole of `plan-space.ts` (footprints, wall spans, corner geometry,
  overlap tests, `freeStretchesAlongWall`, `placeAgainstWall`, `placeCornerAtWalls`,
  `repositioningFromPlacement`) and `group-layout.ts` (relations → docking, `hangGapOf`,
  `isBaseUnitArticle`/`isWallUnitArticle`/`isTallUnitArticle`). The glue-logic has the calculated
  geometry of every root (`getCalculatedGroups`; `calculatedDockingVectorsByRoot` and
  `calculatedCornerPointsByRoot` in `hi-plan-context.ts` derive from it) and does not need the
  server's re-derivation.
- **Anchor-frame probing** — `probeAnchorFrame`, `takeBackProbe`, `knownAnchorFrames` in
  `tool-executors.ts`; `anchorFrameOfRoot`, `anchorVariantKey`, `toRepositioningData` in
  `group-placement.ts`. This is the workaround RML-18140 describes: the server loads a single-pick
  probe of an article to read its docking vectors, undoes the load and caches the frame per
  library/article/overrides.
- **Hints** — `rowReachHints`, `movedUnitsAboveHint`, `turnedLegHints`, `withRowHints`,
  `withCorrections`, `withLibraryChanges`, `withPlanRoots`, `withUnitsAboveDocked`. These read the
  plan before and after a mutation and describe what moved; the glue-logic already has the
  before/after calculated groups.
- **Raw-group readers** — `getExternalObjectGroups` has fifteen call sites in `tool-executors.ts`,
  not only the probe: `placeAtWalls` (the wall placement of a new group), `withRowHints`,
  `withRowIndices` (the `rowIndex` of every root), `inPlacementFrame` /
  `positionInPlacementFrame` (the `position` of every returned group in the placement frame, D33)
  and `readGroupsKey` (`countingPlannerApi` tells a load that loaded nothing from one that did, for
  the undo bookkeeping). Everything the server derives from the raw groups has to come back in the
  operation result or the plan context before the method can leave the tool path (§2.3).

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

[RML-18145](https://roomle.atlassian.net/browse/RML-18145) (`chore/hi-tools-split-RML-18145`)
moves the HI MCP API implementation out of `glue-logic.ts` into `hi-tools.ts` (`HiTools`,
`HiToolsImplementation`) and the plan-context assembly into `hi-plan-context.ts`. Once it lands,
"glue-logic" in the table below means `hi-tools.ts`: the moved logic goes there, next to the
operations it extends.

| Server logic today | Target home in roomle-ui |
|---|---|
| `resolveRootId`, `findGroup`, `groupOfRoot`, `groupHoldingRoot` | glue-logic resolves ids inside each operation (it already has `_requireRootModule`, `_requireGroupsInScene`); the result carries the resolved ids and a correction when a prefix or a root id named a group |
| `catalogArticleId`, `catalogSpellingOf`, `resolveArticleIds` | glue-logic resolves the article against the loaded catalog; the result carries the resolved `articleId` and a correction |
| `normalizePlacement`, `normalizeWallPlacement`, `dropUnknownPlacementFields`, `WALL_PLACEMENT_DEFAULTS` | a new `place-group` command on `externalObjectGroupOperation` (see §2.3) validates and applies the placement in the glue-logic, where the calculated footprint is available |
| `plan-space.ts` geometry (`groupFootprint`, `placeAgainstWall`, `placeCornerAtWalls`, `freeStretchesAlongWall`, `volumesOverlap`, …) | glue-logic, over the calculated groups; the server keeps only what it needs to *describe* a result to the agent |
| `group-layout.ts` relations → docking | the glue-logic knows no relations: `mergeArticleIntoGroup` takes an explicit `dockTo` entry and `insertArticleIntoGroup` rewrites the existing side links (`bottomSideLinksOf`, `removeDockingEntries`, `addDockingEntry`); the server translates the relations for every tool (`relationsToDocking` for `create-or-replace-groups`, the side moves of `merge-article-into-group`). Whether the relation vocabulary moves down with the `create-or-replace-groups` command or the server keeps translating is open (§8) |
| `probeAnchorFrame`, `takeBackProbe`, `knownAnchorFrames`, `anchorFrameOfRoot`, `anchorVariantKey`, `toRepositioningData` | removed from the server; replaced by a **per-article template calculation in the glue-logic** (see §2.4) — the same calculation the refactoring moves down, not a separate feature |
| `rowReachHints`, `movedUnitsAboveHint`, `turnedLegHints`, `withRowHints` | glue-logic computes the hints from the before/after calculated groups and returns them in `HiGroupOperationResult.corrections` / a new `hints` field |
| `withCorrections`, `withLibraryChanges`, `withPlanRoots`, `withUnitsAboveDocked` | glue-logic; the server keeps only the agent-facing phrasing |

### 2.2 roomle-hi-example — `tool-executors.ts`

The executors shrink to:

1. read the agent's arguments,
2. call `externalObjectGroupOperation(command, payload)` (or the few remaining planner methods),
3. shape the returned `HiGroupOperationResult` for the agent (rename `command` to the tool name,
   keep `groups`, `removedGroupIds`, `changedModuleIds`, `corrections`, `gapClosed`,
   `skippedAttributes` and the new `hints`).

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
longer needed once the operation result and the plan context carry what the server reads from them
today — the position in the placement frame, the `rowIndex` of every root and whether a load built
something (§1.1, raw-group readers) —, and the probe is gone. `tests/planner-api.test.ts` keeps the
server's method set and the page allow-lists in step, so the three methods leave both together.

New commands on `externalObjectGroupOperation` (each an entry of `HI_GROUP_OPERATION` in
`hi-plan-context.ts`, eleven today):

- `create-or-replace-groups` — the whole pos-group payload; the glue-logic builds the docking from
  the relations, loads the layout and positions the group.
- `place-group` — `{ groupId, wall, alignment?, offsetMm?, roomIndex? }`; the glue-logic computes
  the placement from the calculated footprint and the room walls.

This keeps the planner API at the current size while moving the logic down.

### 2.4 The refactoring is the enabler for RML-18140, not its prerequisite

The first version of this analysis put RML-18140 (the template calculation in `getPlanContext`)
**before** the refactoring. That ordering is wrong, and the code says so.

**The calculation is already a library function without scene access.** `LibraryData.calculateGroup`
is `libraryExports.calc(groupData)` (`homag-intelligence.ts:159`) — no kernel, no scene, no planner
call; `libraryExports` is the library's calculation script (`onLoadJavascript`), imported once per
library as a blob module (`_initCalcScript`). `_prepareArticlePickRoots(posGroup)`
(`glue-logic.ts:1117`) turns an article pick into the article's template roots by deep-copying the
`PosArticle` from `_posArticleMap`, applies the first root's attribute overrides
(`_applyRootAttributeOverrides`) and writes the roots into the pick it is given — again without
touching the scene; an unknown article it leaves as it is with a console warning, so the
calculation has to check the article itself. `_calculateNewGroup(pick, true, true)`
(`glue-logic.ts:2956`) is `_replacesIDs` + `_initializePosGroup` + `_calculate`, and `_calculate`
(`glue-logic.ts:4163`) runs `libraryData.calculateGroup` inside `_updatePosData`
(`glue-logic.ts:4354`), which deep-copies the group and writes nothing on the glue-logic. The chain
writes no map: `_groupMap` is written by `_addGroupToMap` (from `_addNewGroup`,
`glue-logic.ts:3150`, and the reload paths), `_storeCalculatedGroup`, `_discardCalculation`,
`mergeGroups`, `removedGroup` and `setPosDataForLoading`, none of them on the way.
`_initializePosGroup` is a second call into the library (`initializePosGroup`, in place, only for a
library with a group orchestrator module), so the side-effect question of §8 covers both.

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
  `_calculateNewGroup`. It is reached through the existing `getPlanContext` articles branch, so it
  needs no new group-operation command and no server change to land — it is an **independent,
  reusable prerequisite** the refactoring then reuses.
- The refactoring **reuses** that calculation for the placement commands: once it lives in the
  glue-logic, the probe is deleted, the catalog is completed for every consumer, and the planner
  methods the probe needed leave the allow-lists. The refactoring does not have to land first for
  the calculation to exist; it is what makes the calculation serve the placement path too.

**Per article, not the whole catalog.** The calculation is per `articleId` (and per attribute
override set), computed lazily on first need and cached. It is never "calculate all 111" — a
library with 1000 articles costs nothing until an article is asked for. The cache is keyed by
`anchorVariantKey` (library, article, sorted attributes) — the same key the server's
`knownAnchorFrames` uses today — and cleared in `loadPosData` (`glue-logic.ts:825`), which adds or
overwrites the templates of one library and never clears `_posArticleMap`.

**The articles branch needs an article-level selector.** The `articles` branch of `getPlanContext`
(`glue-logic.ts:1263`) maps over every `_posArticleMap` value with no article-id filter, so feeding
"the calculated templates of the articles it is about to describe" into it would calculate every
uncached article of every loaded library on the first request — the catalog-wide pass this section
rejects. The calculation is therefore reached through an **article-level selector** on the articles
section (the caller names the article ids it wants geometry for), so the cost stays proportional to
the agent's use. See §4.1 of
[`article-template-geometry-in-plan-context.md`](../feature-analysis/article-template-geometry-in-plan-context.md).

**Where the result is consumed.** Two consumers, one calculation:

- `getPlanContext`'s articles branch (`glue-logic.ts:1263`) feeds the calculated templates of the
  **requested** articles into `calculatedDockingVectorsByRoot` / `calculatedCornerPointsByRoot` so
  the catalog carries the docking vectors and the corner point of an article that is not in the
  plan.
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
- The planner's plan context carries the docking vectors, `cornerArticle` and `cornerPoint` of the
  requested articles that are not in the plan (the per-article calculation of §2.4), so the server's
  `agentFacingArticle` no longer completes `cornerArticle` from the category (C7). What the agent
  sees does not change: `get-plan-context` keeps removing `cornerPoint` (D10).
- The page allow-lists lose `getExternalObjectGroups` and `removeExternalObject` (the example page
  keeps `removeExternalObject` for its own UI, `index.html:943`).

### 5.1 Decisions and corrections to amend

The refactoring changes who does what, not what the agent observes. These entries of
[`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md) describe the server as the owner and
have to be rewritten with it:

| Entry | What changes |
|---|---|
| D23 — a new group is placed by wall | "the server loads the group without a position, computes the target from the calculated group, reloads the group once" becomes the `place-group` command of the glue-logic; the observable sequence (one load, one reload, the materials after the reload — D36, D47) stays |
| D33 — one anchor frame for every article | the frame comes from the per-article calculation; `positionInPlacementFrame` / `inPlacementFrame` move down or the result carries the position |
| D46 — the server owns its anchor | the glue-logic owns the anchor; the open question of D46 — whether the probe can go away — is answered by §2.4 |
| C6 — the anchor probe | deleted, with its guarding tests `it('undoes the anchor probe instead of removing it')` and `it('removes the probe group when the page cannot undo')` |
| C7 — `cornerArticle` from the category on an empty plan | no longer needed |
| G17 — an anchor the probe cannot calculate | an article the template calculation cannot calculate; the same fallback (loaded by the unit's origin, a correction) |
| §4, the planner-method table | the rows of `loadExternalObjectGroupLayout`, `getExternalObjectGroups` and `removeExternalObject` go; `undo` loses "the anchor probe" |

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
- Does the relation vocabulary (`rightOf`, `leftOf`, `onTop`, `above`, `behind`) move into roomle-ui
  with the `create-or-replace-groups` command, or does the server keep translating relations into
  docking entries (`relationsToDocking` and the side moves of `merge-article-into-group` stay)? The
  glue-logic takes docking entries only today (§2.1). **Decided 2026-10-13 (user): into roomle-ui**
  — the translation needs the calculated plan (free sides, row ends, the hang gap from real
  heights), and the server sends intent (§9, step 3b).
- Should the hints travel in `HiGroupOperationResult` as a new `hints` field, or stay in
  `corrections`?
- The anchor frame depends on the attribute overrides; the per-article cache is keyed by
  `anchorVariantKey` (library, article, sorted attributes), so an anchor with overrides is a
  separate cache entry — the same granularity the server's `knownAnchorFrames` has today. Confirm
  that the override set is small enough that the cache stays bounded.

## 9. Implementation plan

The plan details the steps of §7 for roomle-ui, with the unit tests each step needs, and names
the server counterpart of every step. roomle-ui facts refer to `chore/hi-tools-split-RML-18145`
(RML-18145), the branch the work builds on: the HI MCP API implementation is
`HiToolsImplementation` in `hi-tools.ts` (it takes the glue-logic and reaches `_designerRequests`,
`_libraryData` and `_posArticleMap` through its public fields), the operations are dispatched by
`runGroupOperation` in `hi-plan-context.ts` (`HI_GROUP_OPERATION`, `GROUP_OPERATION_HANDLERS`,
`HiGroupOperations`, `HiGroupOperationOutcome` → `HiGroupOperationResult`), the plan context is
assembled by `createPlanContext` in `hi-plan-context.ts`. The tests are Vitest in
`packages/web-sdk/packages/homag-intelligence/__tests__/` (`cd packages/web-sdk && npm run test --
-t "<name>"`), built on `__mocks__.ts`: `newGlueLogic`, `LibraryDataMock` (identity
`calculateGroup`), `RoomDesignerRequestsMock`, the builders `dockedPairGroup`, `wallRowGroup`,
`cabinet`, `dockedTo`, and `glueLogicTestHelpers` (`arrangePosGroupForTest`, `mockCalculation`);
`hi-tools-test.ts` instantiates `new HiToolsImplementation(glueLogic)` and puts groups into the
scene with `inScene`.

### 9.1 Decisions the plan builds on

| Decision | Choice |
|---|---|
| Relations | Into roomle-ui (user, 2026-10-13, §8) — `create-or-replace-groups` and `merge-article-into-group` take relations; the glue-logic translates them |
| Hints | A new `hints?: string[]` field of `HiGroupOperationOutcome` / `HiGroupOperationResult` — `corrections` stays what the operation changed about the input, `hints` what to look at in the plan; the tool results already keep `corrections` and `hint` apart |
| Failure signal of the template calculation | `_calculate` catches and returns the input, so a variant that reports the failure is added (the preferred shape of §4.2 of the feature analysis); a failed calculation is not cached |
| Moving a group | By `repositioningData` and a reload with `applyGroupPosition: true` — the only path the glue-logic has (`_applyRepositioningData` in `hi-root-module-arrangement.ts`, `loadPosGroups` with `HI_LOAD_OBJECT_REASON.ADJUSTED`), and the sequence D23 and D47 describe; the kernel moves (`moveByRuntimeId`) stay out of the tool path |
| Article selector | `getPlanContext(include?, options?: { articleIds?: string[] })` on `GlueLogic`, `HiTools`, `createPlanContext` and `getExternalObjectPlanContext`; the selector calculates the default variant of the named articles — the commands calculate a variant with overrides themselves |
| C7 (`cornerArticle` from the category on an empty plan) | Stays until step 0 shows that the whole catalog is cheap enough to calculate on the first `get-plan-context` (then the selector takes `'all'` and C7 goes); the catalog-wide pass is never implicit |
| Group materials (D36) | The `create-or-replace-groups` command sets the group-wide attributes after its reload — one planner round trip less; the server's `generatedRootAttributes` / `moveGeneratedRootOverrides` move with it |
| Undo bookkeeping (D47) | The operation result carries `historySteps`, the planner history steps the command made; the server's `countingPlannerApi` / `readGroupsKey` go with it |
| Branches | The implementation in roomle-ui is based on `chore/hi-tools-split-RML-18145`: a new branch `refactor/hi-tool-logic-RML-18147` created on it. roomle-hi-example: a new branch `refactor/move-tool-logic-to-glue-logic` off `master`. ligna-store: a new branch `chore/mcp-planner-methods-RML-18147` off `master` for step 6 |
| Delivery | One roomle-ui PR and one hi-example PR per step; the server adapter of a step is developed against the local dev build (`--dev`, roomle-ui on :5173) and the test prompts of `docs/test-prompts.json` stay green after every step |

### 9.2 Steps

**Step 1 — the per-article template calculation (roomle-ui, RML-18140).** In
`GlueLogicImplementation`, next to `_prepareArticlePickRoots` and `_calculateNewGroup`:
`calculateArticleTemplate(articleId, attributes?, libraryId?): PosGroup | undefined` (on the
`GlueLogic` interface, forwarded by `debug-logging.ts`) builds a fresh single-pick group
`{ libraryId, roots: [{ id, articleId, attributes }] }`, completes it with
`_prepareArticlePickRoots` (checks the article first — the method leaves an unknown article as it
is), runs `_replacesIDs` + `_initializePosGroup` + the failure-reporting variant of `_calculate`, and
caches the result in a new `_templateCache: Map<string, PosGroup>` keyed by library, article and
sorted attributes (the server's `anchorVariantKey`), cleared in `loadPosData`. Nothing is written to
`_groupMap` and nothing is loaded.
Tests — new `__tests__/article-template-test.ts`, `calculateGroup` spied with `mockCalculation`
and a fake that returns `dockInfos` on the root:

- `it('calculates an article template once per article and attribute set')` — two calls with the
  same article and attributes calculate once; other attributes calculate again
- `it('applies the attribute overrides to the template root before calculating')`
- `it('does not add the calculated template to the plan')` — `_groupMap` unchanged,
  `loadPosGroups` not called
- `it('forgets the templates when the library templates are loaded again')` — `loadPosData`, then
  the same article calculates again
- `it('returns nothing for an unknown article without calculating')`
- `it('does not cache a failed calculation')` — a throwing `calculateGroup` gives nothing; the
  next call calculates again

**Step 0 — measure once (after step 1, on the dev build, by hand).** In the example page: the
time per article over the whole catalog through the selector of step 2, and the side-effect check —
a kitchen planned on a page that calculated every template equals the kitchen of a fresh page (plan
snapshot diff). The numbers decide the C7 row of §9.1 and the open questions of §8.

**Step 2 — the article selector of the plan context (roomle-ui, RML-18140).** `createPlanContext`
takes the options; its `articles` branch calculates, for every id in `articleIds` that has no
calculated root in the plan (`calculatedDockingVectorsByRoot` has no `${articleId}:${root.name}`
entry), the template of step 1 and passes `[...calculatedGroups, ...templates]` into
`calculatedDockingVectorsByRoot` and `calculatedCornerPointsByRoot`; `compactArticle` is unchanged.
`RoomlePlanner.getExternalObjectPlanContext(include?, options?)` forwards the options. The JSDoc in
`external-object-api.ts` and `packages/embedding-lib/docs/homag-intelligence-embedding.md` gain the
options. Server: nothing yet — `get-plan-context` passes `articleIds: 'all'` only if step 0 allows
it (C7 row).
Tests — `__tests__/hi-plan-context-test.ts` (`createPlanContext`) and `hi-tools-test.ts`:

- `it('carries the docking vectors and the corner point of a requested article that is not in the plan')`
- `it('calculates no template without an article selector')` — `calculateGroup` not called
- `it('does not calculate an article that has a calculated root in the plan')`
- `it('ignores an unknown article id in the selector')`
- `it('leaves the geometry out when the template calculation fails')`
- `it('forwards the options of getExternalObjectPlanContext to the glue-logic')` (planner-core)

**Step 3a — the `place-group` command (roomle-ui + server).** New `src/hi-plan-space.ts`, the
port of `plan-space.ts`: the room-space footprint of a calculated group (part boxes via
`fullMatrix`, docking points, the `b`/`t` fallback — `groupFootprint` of `hi-plan-context.ts` stays
the group-space one for `HiPlanGroupPosition`), the corner geometry from the `LeftBack*` /
`RightBack*` vectors, `placeCornerAtWalls`, `placeAgainstWall`, `freeStretchesAlongWall`,
`volumesOverlap`, `freePlacementAlongWall`, `wallTarget`, `repositioningFromPlacement`. In
`hi-tools.ts`: `placeGroup(groupId, { wall, alignment?, offsetMm?, roomIndex? })` resolves the
group (`_requireGroupsInScene`), reads the rooms (`getRoomInformation` → `shapeRooms`, the walls of
`HiPlanWall`), resolves wall and alignment as `resolveWallPlacement` does (side label or index,
`WALL_PLACEMENT_DEFAULTS`, a correction for a wrong value instead of a refusal), computes the target
from the calculated group, moves a target that overlaps another group to the nearest free place
along the wall (correction), sets `repositioningData` from the target for the first article root
and ends like `mergeArticleIntoGroup`: `createOrReplacePosDataFromArticleLayout` +
`loadPosGroups(…, { reason: ADJUSTED, applyGroupPosition: true })`; the outcome carries
`placedIn: 'corner' | 'wall'`. `HI_GROUP_OPERATION` gets `PLACE_GROUP`, `HiGroupOperationPayloads`
the payload, `GROUP_OPERATION_HANDLERS` the handler. Server: the `place-group` executor becomes
`findGroup` (until step 4) + the command call + result shaping; `plan-space.ts` and its test leave
the server in step 6.
Tests — `__tests__/hi-plan-space-test.ts` is `plan-space.test.ts` ported (footprint, corner
geometry, wall and corner placement, free stretches, overlap, repositioning), and in
`hi-tools-test.ts`, with `wallRowGroup` in a room of four walls:

- `it('moves a group against a wall by repositioning data and reloads it with its position')` —
  `loadPosGroups` called once with `ADJUSTED` and `applyGroupPosition`, the group's `pos` and
  `rotationY` at the wall
- `it('puts a corner group into the room corner the wall and the alignment name')`
- `it('moves a target that overlaps another group along the wall to the nearest free place and says so')`
- `it('places the group as asked and reports the overlap when the wall has no free place')`
- `it('reports whether the group was placed in a corner or at a wall')`
- `it('reads the wall by side label or index and the room by roomIndex, and corrects a wrong alignment')`
- `it('refuses a group that is not in the plan and names the known group ids')`

**Step 3b — the `create-or-replace-groups` command (roomle-ui + server).** New
`src/hi-group-layout.ts` — the port of `group-layout.ts`: `relationsToDocking` with its
corrections, the classification by category (`isWallUnitArticle`, `isTallUnitArticle`,
`isBaseUnitArticle`, `isHoodArticle` — read from the article's `category`), `hangGapOf` from the
calculated templates instead of catalog `Dim` attributes; `merge-article-into-group` takes a
relation beside `dockTo` and the side moves of the server (`dockTarget` with `RowGeometry`) move
into `mergeArticleIntoGroup`. New `src/hi-group-placement.ts` — the port of `group-placement.ts`:
`findAnchorRoot`, `anchorFrameOfRoot` on the template of step 1 (article and overrides),
`toRepositioningData`, `positionInPlacementFrame`. In `hi-tools.ts`:
`createOrReplaceGroups({ posGroups })` — per group: the normalisation the server does today
(`prepareGroup`, `dropUnknownPlacementFields`, `toArticlePick`, the generated roots dropped, every
correction reported, nothing refused that can be built), the group-wide attributes split off, the
relations into docking, the anchor frame into `repositioningData` for a placement by point, the
load through `createOrReplacePosDataFromArticleLayout`, for a placement by wall the `placeGroup`
of step 3a on the built group, the group-wide attributes set after the reload (D36), a replaced
group keeps its position and a placement on it is reported (D46). The outcome names per input group
what was built or why not (`notLoaded`, RML-18139) and `historySteps`. `shapeGroup` reports
`position` in the placement frame (D33, `positionInPlacementFrame`) and `shapeRoot` gains
`rowIndex` (the server's `withRowIndices`: `sidePartnersOf`, `rowWalk`), so the tools need no raw
groups for either. Server: the executor keeps `resolveArticleIds` and `findGroup` until step 4,
calls the command, shapes the result; `inPlacementFrame` and `withRowIndices` go.
Tests — `__tests__/hi-group-layout-test.ts` and `__tests__/hi-group-placement-test.ts` are
`group-layout.test.ts` and `group-placement.test.ts` ported (relations → docking with every
correction; anchor root, anchor frame, repositioning data, placement-frame position), and in
`hi-tools-test.ts`:

- `it('builds the docking from the relations and loads the group')`
- `it('places a new group by point with the anchor frame of its anchor article')` — a corner
  article turned, `rootRelPos` from the template's docking corner
- `it('places a new group by wall: loads it, moves it like place-group and reloads it once')`
- `it('replaces a group whose id is in the plan, keeps its position and reports an unused placement')`
- `it('names per input group what was built, and what was not and why')`
- `it('sets the group attributes on every root module and the worktop after the reload')`
- `it('reports the position of every returned group in the placement frame')`
- `it('numbers the root modules of a row from the left')`
- `it('merges an article by a relation and moves a taken side to the free end of the row')`

**Step 4 — id and article resolution (roomle-ui + server).** New `src/hi-id-resolution.ts`:
`resolveRootId` (exact, unique prefix, UUID first segment, one character off; an id that matches
nothing or more than one is forwarded as sent), `resolveGroupId` (the same over group ids),
`catalogSpellingOf` (the unique case-insensitive match). `_requireRootModule`,
`_requireGroupsInScene` and `_requirePosArticleKey` resolve through them and push the reading into
the outcome's `corrections`; an unknown article fails with the valid ids. Server: `resolveRootId`,
`findGroup`, `groupOfRoot`, `groupHoldingRoot`, `catalogArticleId`, `catalogSpellingOf`,
`resolveArticleIds` go; the executors send the ids as the agent gave them.
Tests — `__tests__/hi-id-resolution-test.ts`:

- `it('reads an exact id as it is')`, `it('reads a unique prefix')`, `it('reads the unique id that
  differs in its first UUID segment')`, `it('reads the unique id one character off')`,
  `it('forwards an ambiguous or unknown id as sent')`
- `it('reads an article id in the spelling of the catalog')`,
  `it('names the valid article ids for an unknown article')`
- in `hi-tools-test.ts`: `it.each` over the commands with a `rootModuleId` or `groupId` —
  `it('resolves a root id prefix in %s and reports the reading')`

**Step 5 — the hints (roomle-ui + server).** New `src/hi-hints.ts`: `rowReachHints`,
`movedUnitsAboveHint`, `turnedLegHints` and the obstacle hints, over the calculated groups before
and after the operation, the rooms and the articles. `runGroupOperation` reads the calculated groups
before the handler runs and after it and fills `hints`. Server: `withRowHints`, `withCorrections`'
hint part, the obstacle hints and the `walls` reads for them go; the executors pass `hints` through.
Tests — `__tests__/hi-hints-test.ts` with before/after groups from the builders:

- `it('hints when a group reaches out of the room after the operation')`
- `it('hints which wall units moved with their carrier')`
- `it('hints a turned leg of a corner group')`
- `it('hints a root module that overlaps an object or another group, or stands in front of a door,
  with the free stretches of its wall')`
- in `hi-plan-context-test.ts` (`runGroupOperation`): `it('returns the hints of the operation')`

**Step 6 — the server loses what moved.** Delete `probeAnchorFrame`, `takeBackProbe`,
`knownAnchorFrames`, `forgetAnchorFrames`, `plan-space.ts`, `group-layout.ts`,
`group-placement.ts`, `countingPlannerApi`, `readGroupsKey` and their tests
(`plan-space.test.ts`, `group-layout.test.ts`, `group-placement.test.ts`, the blocks `anchor
probe`, `create-or-replace-groups relations`, `wall placement`, `positions in the placement
frame`, `obstacle hints`, `root module ids` and `hints` of `tool-executors.test.ts` shrink to the
adapter: argument reading, the command call, result shaping, error phrasing). Drop
`loadExternalObjectGroupLayout`, `getExternalObjectGroups` and `removeExternalObject` from
`planner-api.ts`, `MCP_PLANNER_METHODS` in `index.html`, `PLANNER_METHODS` in
`browser-bridge.ts` and the ligna-store's `hi-mcp/browser-bridge.ts` (`tests/planner-api.test.ts`
keeps the server and the reference copy in step).
Documentation: §5.1 in `docs/hi-mcp-behaviour.md` (D23, D33, D46, C6, C7, G17, the method table,
a decision row for the relations), `docs/hi-mcp-server.md`, `docs/implementation/tool-executors.md`
and `layout-and-placement.md`, `.agents/skills/hi-mcp-server.md` and `hi-mcp-tools.md`,
`hi-mcp/hi-mcp-server/README.md`; in roomle-ui the command table of
`homag-intelligence-embedding.md` (today it lists eight of eleven commands), the JSDoc of
`external-object-api.ts` and `.agents/homag-intelligence.md`.

### 9.3 Verification

Every step: the roomle-ui package tests (`npm run test` in `packages/web-sdk`) and the hi-mcp
tests and typecheck (`npm test`, `npm run typecheck` in `hi-mcp`) green; the server step on the
local dev build. After steps 2, 3b, 4 and 5: the test prompts of `docs/test-prompts.json` against
the local roomle-ui with the models of the reference runs, compared per test with the reference
session — a step is done when no test regresses on any model. Done overall when §5 holds: the tool
results keep their shape, the probe and the three planner methods are gone, and
`tool-executors.ts` holds no validation, resolution, geometry or hint logic.
