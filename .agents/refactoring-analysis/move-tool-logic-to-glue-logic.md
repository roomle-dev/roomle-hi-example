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
   server patches this with the probe; the ligna-store and any other consumer get nothing.
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
| `probeAnchorFrame`, `takeBackProbe`, `knownAnchorFrames`, `anchorFrameOfRoot`, `anchorVariantKey`, `toRepositioningData` | removed from the server; replaced by the template calculation of RML-18140 in `getPlanContext` (`calculatedDockingVectorsByRoot` / `calculatedCornerPointsByRoot` fed with calculated templates) |
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
  application and hints. RML-18140 adds the template-calculation tests (calculated once, cached,
  cleared on a new catalog, no calculation when the plan has a calculated root).
- **roomle-hi-example unit tests** (`hi-mcp/hi-mcp-server/tests`): the executor tests shrink to the
  adapter behaviour (argument reading, result shaping, error phrasing); the moved logic is tested in
  roomle-ui.
- **End-to-end**: `docs/test-prompts.json` runs unchanged; the observable tool results must stay
  equivalent (same `groupIds`, same corrections, same hints).

## 5. Output changes to expect

- Tool results keep their shape; `corrections` and `hints` now originate in the glue-logic.
- `get-plan-context` on an empty plan returns docking vectors and `cornerPoint` for articles not in
  the plan (RML-18140), so the server's `agentFacingArticle` no longer completes `cornerArticle`
  from the category.
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

1. **RML-18140 first** — the template calculation in `getPlanContext` removes the probe workaround
   and completes the catalog. This is the prerequisite the ticket names.
2. **Move id and article resolution** into the glue-logic operations; the server sends the raw ids
   and the result carries the resolved ones plus corrections.
3. **Add `create-or-replace-groups` and `place-group` commands**; move `group-layout.ts` and the
   placement geometry down; drop `loadExternalObjectGroupLayout` from the tool path.
4. **Move the hints** into the glue-logic result.
5. **Delete the moved helpers** from the server and update the page allow-lists.

## 8. Open questions

- Does `LibraryData.calculateGroup` have side effects for the HOMAG library, and how long do the
  calculations of all 111 Furniture_Smith articles take? (RML-18140 step 1 — measure first.)
- Should the hints travel in `HiGroupOperationResult` as a new `hints` field, or stay in
  `corrections`?
- The anchor frame depends on the attribute overrides; a template calculated per `articleId` gives
  the default variant only. An anchor with overrides keeps the probe unless templates are calculated
  per override set (RML-18140 constraint).
