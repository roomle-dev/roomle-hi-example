> **Type**: Refactoring Analysis
> **Domain**: homag-intelligence (roomle-ui), hi-mcp (roomle-hi-example, ligna-store)
> **Trigger**: Jira RML-17966, comment 155424 (Design flaw in the mcp api) — `compactMasterData` must not be used in the embedding systems; the plan context returned by `getExternalObjectPlanContext` must be agent-ready, compacted, and in one consistent 3D coordinate system, produced by the glue logic in roomle-ui.
> **Date**: 2026-09-28
> **Author**: AI Assistant
> **Status**: Done

> **Close-out (2026-09-28)**: Implemented as analyzed on branch `refactor/hi-plan-context-RML-17966` in
> all three repositories. All decisions were applied as resolved; the placement math on the embedding
> side reads the derived walls from the context and the calculated groups from
> `getExternalObjectGroups()`. Verification: roomle-ui web-sdk vitest suite fully green (1922 tests,
> including the new hi-plan-context-test.ts and the adapted glue-logic-test.ts; tsc clean), hi-mcp
> typecheck clean and 70 tests passing (only the pre-existing `cf` worker test fails for a missing
> `@cloudflare/containers` install), lint hook on the roomle-ui commit clean. Not verified here: a
> live planner session (`npm start` + MCP client round-trip) - see Open items.

---

## Executive Summary

`getExternalObjectPlanContext` / `getPlanContext` is an API that exists solely to give an AI agent
context about the planning session. Today it returns the raw kernel data (full master data, full
article data, 2D room contours), and every embedding system compensates by reshaping the result
before handing it to the agent:

- `compactMasterData` (root modules + customer-facing attributes only) is **duplicated three
  times**: in `ligna-store/hi-mcp/tool-executors.ts:52`,
  `roomle-hi-example/hi-mcp/hi-mcp-poc-json-client/tool-executors.ts:52`, and inline in
  `roomle-hi-example/minimal-hi-example/index.html:1449`.
- The room contour (`PosRoom` → `PosContour` → `PosContourSegment`) is a 2D SVG-path-like
  structure (`cmd`, `x`, `y`), while `PosGroup.pos` is 3D (right-handed, Y up). Each embedding
  converts contour points to pos space itself (`contourPointToPosSpace`: `[x, -y]`,
  `plan-space.ts:101-106` in both clients).

This is a design flaw: the embedding systems change and manipulate data the API was supposed to
provide in an agent-understandable form. The refactoring moves **all** of the shaping — master-data
and attribute compaction (`compactMasterData`, `compactAttribute`), article compaction with the
docking-vector enrichment, group shaping, the room contour conversion into a new 3D data structure
((x, y) → (x, level, -y)) and the wall derivation — into the roomle-ui glue logic, in a new file
`packages/web-sdk/packages/homag-intelligence/src/hi-plan-context.ts`. `getPlanContext` then
returns an object that can be handed to the AI agent **as is, without any further preparation** —
that is the purpose of `getPlanContext`. The shaping code is removed from ligna-store and the
minimal example, `find-attributes` works on the compacted attributes, and the MCP server
information is updated.

Three repositories are involved: **roomle-ui**, **ligna-store**, **roomle-hi-example**
(all three on branch `refactor/hi-plan-context-RML-17966`).

---

## Current State

### Where the plan context is assembled (roomle-ui)

`glue-logic.ts:871` — `getPlanContext(include?)` builds `HiPlanContext` from four sections:

| Section | Source today | Problem |
|---|---|---|
| `rooms` | `getRoomInformation(PLAN_ROOM_GEOMETRY_MODE.PLAN)` → `ExternalRoomInformation` (`external-object-api.ts:56`) with `PosRoom[]` | `PosContourSegment` (`oc-scripts-domain.model.ts:207`) is 2D: `{ cmd, x, y, angle?, type?, height?, thickness? }` per level. Inconsistent with the 3D `PosGroup` coordinate system (right-handed, Y up). |
| `groups` | `getPosDataOfAllGroups()` → `PosGroup[]` | Contains everything the kernel calculated, not only what an agent needs. |
| `masterData` | deep copy of `libraryData.masterData` per library, minus `materialProviders` (`glue-logic.ts:884-897`) | Full master data: all modules (including non-root), all attributes (including non-customer-facing). |
| `articles` | `PosArticle[]` from `_posArticleMap` | Full article data including sub-articles and internals. |

### What the embedding systems do with it (the flaw)

The `get-plan-context` tool executor (identical in `ligna-store/hi-mcp/tool-executors.ts:540`,
`hi-mcp/hi-mcp-poc-json-client/tool-executors.ts:540`, and inline in
`minimal-hi-example/index.html:1926`) re-fetches more sections than requested (articles need
masterData + groups for compaction) and then reshapes everything:

- `compactMasterData` (line 52 in both `tool-executors.ts` files, line 1449 in `index.html`):
  filters root modules, keeps only assigned, customer-facing (`isMain` / `userRight Simple`)
  attributes, strips everything but id/name/desc/imageUrl/attributes from modules and
  id/name/desc/imageUrl/type/group/selections from attributes.
- `compactAttribute` (`ligna-store/hi-mcp/tool-executors.ts:40`): keeps
  id/name/desc/imageUrl/type/group/selections of an attribute — the same compaction
  `find-attributes` has to work with after this refactoring.
- `shapeRooms` (`tool-executors.ts:393`): derives per-room `walls` from the 2D contour
  (`deriveWalls`, `plan-space.ts:124`) — side labels, `start`/`end` in pos space `[x, -y]`,
  `lengthMm`, `facingRotationY`, etc.
- `compactArticle` + `calculatedDockingVectorsByArticle`: compact article catalog enriched with
  master-data module info and docking vectors of the calculated roots.
- `shapeGroup` (`tool-executors.ts:380`): position with pos, rotationY, footprint; roots as
  article picks with docking info and free docking vectors.

The result: the same ~500 lines of shaping code exist in three copies, every consumer of
`getExternalObjectPlanContext` receives data it must first decode (2D contours, raw master data),
and the API contract ("data the agent can understand") is actually implemented by the embedders,
not by the API.

---

## Scope of the Change

### 1. roomle-ui — all shaping moves here

| File | Change |
|---|---|
| `packages/web-sdk/packages/homag-intelligence/src/hi-plan-context.ts` | **New file.** All context shaping: `compactMasterData` (root modules, customer-facing attributes), `compactAttribute`, article compaction with docking-vector enrichment, group shaping (position with footprint, roots as article picks with docking info and free docking vectors), and the room shaping with the 2D → 3D contour conversion and wall derivation (side labels, `facingRotationY`). |
| `packages/web-sdk/packages/homag-intelligence/src/glue-logic.ts:871` | `getPlanContext` uses `hi-plan-context` when assembling the context; returns the agent-ready structure directly. |
| `packages/web-sdk/packages/homag-intelligence/src/external-object-api.ts` (~line 405-427) | Update the API header comment of `getExternalObjectPlanContext` (and `HiPlanContext` / `HiPlanContextSection` / `ExternalRoomInformation` types to the new shapes). The return shape changes — acceptable, see Decisions. |
| `packages/web-sdk/packages/homag-intelligence/src/model/oc-scripts-domain.model.ts` (or the new file) | New 3D contour segment structure that mirrors `PosContourSegment` exactly, except that `x` and `y` are gone and replaced by `pos: [x, level, -y]` — the `level` of the parent `PosContour` plus the segment's `x`/`y` give the 3D coordinate. All other properties (`cmd`, `angle`, `type`, `height`, `thickness`) survive. Right-handed, Y up, same coordinate system as `PosGroup`. |
| `packages/web-sdk/packages/homag-intelligence/__tests__/hi-plan-context-test.ts` | **New unit tests** for the compaction, the shaping, and the coordinate conversion. |

### 2. ligna-store — embedding-side shaping removed

| File | Change |
|---|---|
| `hi-mcp/tool-executors.ts:40` | Remove `compactAttribute` (moved to glue logic). |
| `hi-mcp/tool-executors.ts:52` | Remove `compactMasterData`. |
| `hi-mcp/tool-executors.ts:540-585` | `get-plan-context` executor passes the API result through — no re-fetch of extra sections, no compaction, no shaping. |
| `hi-mcp/tool-executors.ts` (`find-attributes`) | Works on the compacted attributes the API now returns; only its search/filter logic stays. |
| `hi-mcp/plan-space.ts` | `contourPointToPosSpace`, `deriveWalls` and the other context-shaping helpers become obsolete for the plan context and move to roomle-ui (wall derivation, footprint, free docking vectors). |

### 3. roomle-hi-example — embedding-side shaping removed, MCP info updated

| File | Change |
|---|---|
| `minimal-hi-example/index.html:1449, 1926-1975` | Remove inline `compactMasterData`, `compactAttribute` and the shaping in the `get-plan-context` executor. |
| `hi-mcp/hi-mcp-poc-json-client/tool-executors.ts` | Same removals as in the store (this is the reference copy the store imports; keep the copy in sync per the hi-mcp-server skill). |
| `hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts:74-101` | Update the `get-plan-context` tool description: the compact sections and the 3D room contour (x, level, -y, Y up, with derived walls) are part of the API result now. |
| `hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts:103-111` | Update the `find-attributes` tool description: it no longer promises "the attributes the compact masterData section of get-plan-context leaves out" — it searches the compacted attribute vocabulary that `getPlanContext` returns. |
| `minimal-hi-example/docs/hi-mcp-server.md`, `.agents/skills/hi-mcp-tools.md`, `.agents/skills/hi-mcp-server.md` | Update the tool reference and the data-shape documentation. |
| `hi-mcp/hi-mcp-poc-json/tests/` | Adapt the executor/tool tests to the new context shape. |

---

## Proposed Target Shape

```
MCP client ── hi-mcp server ── bridge ── page executor ── getExternalObjectPlanContext
                                                          │
                        roomle-ui glue logic              ▼
                   (hi-plan-context.ts, new)      agent-ready HiPlanContext:
                                                 - masterData: root modules +
                                                   compacted customer-facing
                                                   attributes (compactAttribute)
                                                 - articles: compact catalog with
                                                   docking-vector enrichment
                                                 - groups: compact groups with
                                                   footprints and free docking
                                                   vectors
                                                 - rooms: 3D contour
                                                   (x, level, -y, Y up)
                                                   with derived walls
                                                          │
   page executors: pass-through (get-plan-context, find-attributes alike)
```

Key decisions:

1. **Everything is done in the glue logic.** `getPlanContext` returns an object that can be
   directly provided to the AI agent and needs no further preparation — that is the purpose of
   `getPlanContext`. The embedding systems must not change or manipulate the data; their plan
   context executors become pass-through.
2. **One coordinate system.** Every `PosContourSegment` point (x, y) becomes (x, level, -y) in a
   **new data structure** — the room contour is provided in 3D, right-handed with Y as the up
   vector, matching `PosGroup`. The new segment structure looks exactly like the old one, except
   that `x` and `y` are replaced by `pos: [x, level, -y]`; every other property survives. The wall
   derivation (side labels, `facingRotationY`) happens on the converted contour in the glue
   logic, so `place-group`'s placement vocabulary is preserved.
3. **`find-attributes` takes what it gets.** The attributes remain part of the masterData section,
   but compacted through `compactAttribute` — which is implemented in the glue logic via
   `getPlanContext`, like all other shaping. `find-attributes` searches this compacted vocabulary;
   everything not needed is removed from the data.
4. **Breaking change accepted.** Changing `getExternalObjectPlanContext` is technically a breaking
   change, but practically it is not: it is currently only used for this one purpose, which is now
   refactored. The API is considered "under development".

---

## Tests

- **roomle-ui**: new `hi-plan-context-test.ts` in
  `packages/web-sdk/packages/homag-intelligence/__tests__/` (vitest, following
  `glue-logic-test.ts` / `__mocks__.ts` patterns): master-data and attribute compaction
  (`compactMasterData`/`compactAttribute` semantics: root modules only, customer-facing attributes
  only, field whitelists), article and group shaping (docking-vector enrichment, footprints, free
  docking vectors), contour conversion to `pos: [x, level, -y]` with all other segment properties
  (`cmd`, `angle`, `type`, `height`, `thickness`) surviving, wall derivation, level handling,
  degenerate/empty contours, and `getPlanContext` returning the compacted sections.
- **roomle-hi-example**: adapt `hi-mcp/hi-mcp-poc-json/tests/` (hi-mcp-server, tool-executors,
  plan-space) to the pass-through executors and the new context shape; `npm test` +
  `npm run typecheck` at the `hi-mcp` root.
- **ligna-store**: the store's `hi-mcp` copy follows the reference client; run its checks.
- Manual: `npm start` in roomle-hi-example, connect an MCP client, call `get-plan-context` and
  `find-attributes` and verify the returned masterData is compact, `find-attributes` finds
  attributes in it, and the room contour is 3D with derived walls.

---

## Decisions (resolved with the ticket author, 2026-09-28)

1. **Scope of the compaction — everything moves into the glue logic.** Not only
   `compactMasterData`: article shaping, group shaping, wall derivation and the 3D contour
   conversion all move into `hi-plan-context.ts`. `getPlanContext` returns an object that can be
   directly provided to the AI agent without further preparation — that is its purpose.
2. **`find-attributes` takes what it gets.** It works on the attributes after `compactAttribute`.
   The attributes stay part of the masterData section, everything not needed is removed;
   `compactAttribute` itself is implemented in the glue logic through `getPlanContext`. The
   `find-attributes` tool description must be updated accordingly.
3. **Breaking change of `getExternalObjectPlanContext` accepted.** Technically breaking,
   practically not: the API is currently only used for this one purpose, which is now being
   refactored. It is considered "under development"; no compatibility layer is needed.
4. **New contour segment structure: the old shape, minus x/y, plus pos.** The `level` of the
   parent `PosContour` (`oc-scripts-domain.model.ts:217`) together with the `x`/`y` of the
   `PosContourSegment` gives the 3D coordinate (x, level, -y). The new structure looks exactly
   like the old one, except that `x` and `y` are gone and replaced by
   `pos: [x, level, -y]`; all other properties (`cmd`, `angle`, `type`, `height`, `thickness`)
   survive — the `type` can be very important.

No open points remain.

---

## Implementation Plan (reviewed before implementation)

Work order: **roomle-ui first** (API producer), then **roomle-hi-example** (reference client, MCP
server, example page, docs), then **ligna-store** (client copy). Each step lists its verification.

### Step 1 — roomle-ui: new `hi-plan-context.ts` (types + pure shaping)

New file `packages/web-sdk/packages/homag-intelligence/src/hi-plan-context.ts`:

**New agent-facing types** (defined here, re-exported via `external-object-api.ts`):

| Type | Shape |
|---|---|
| `HiPlanContourSegment` | Mirrors `PosContourSegment` exactly, except `x`/`y` are replaced by `pos: [x, level, -y]` (level from the parent `PosContour`). `cmd`, `angle`, `type`, `height`, `thickness` survive. |
| `HiPlanContour` | `PosContour` shape otherwise unchanged: `{ level, segments }`. |
| `HiPlanRoom` | `{ levels: HiPlanContour[], walls: HiPlanWall[] }` — converted contours plus derived walls. |
| `HiPlanWall` | Today's `DerivedWall` from the client `plan-space.ts`: `index, side, start: [x, z], end: [x, z], lengthMm, type?, heightMm?, thicknessMm?, facingRotationY`. Walls live in the floor plane; the 2D `start`/`end` keep the placement math unchanged. |
| `HiPlanMasterData`, `HiPlanMasterDataModule`, `HiPlanAttribute` | `compactMasterData` / `compactAttribute` output shapes (attribute: id, name, desc, imageUrl, type, group, selections). |
| `HiPlanArticle` (+ root-module shape) | `compactArticle` output: articleId, articleName, desc, imageUrl, category, libraryId, catalog, cornerArticle, rootModules (module info, dimensions, mainAttributes, dockingVectors, insertLevels, subModules). |
| `HiPlanGroup`, `HiPlanRoot` | `shapeGroup` / `shapeRoot` output (position with pos, rotationY, footprint; roots as article picks with docking, dockingVectors, freeDockingVectors, subModules, logMessages). |

**Pure functions** (all testable without mocks; semantics identical to today's embedding-side
implementations, ported from `hi-mcp/hi-mcp-poc-json-client/tool-executors.ts` and `plan-space.ts`):

- master data: `compactAttribute`, `compactMasterData` (+ `isRootModule`,
  `isCustomerFacingAttribute`)
- articles: `dockingVectorNames`, `isCornerDockingVector`, `calculatedDockingVectorsByArticle`,
  `compactArticle`
- groups: `isGeneratedRoot`, `freeDockingVectors`, `stripDockingIndices`, `shapeRoot`,
  `shapeGroup` plus the footprint helpers they need (`round2`, `transformPointByMatrix`,
  `transformPointByRoot`, `collectParts`, `boxCorners`, `dimensionAttribute`,
  `rootFootprintPoints`, `groupFootprint`)
- rooms: contour conversion `(level, x, y) → [round2(x), level, -round2(y)]`, `sideFromFacing`,
  `deriveWalls` (re-implemented on the converted 3D contour, reading `pos[0]`/`pos[2]`),
  `shapeRooms` (contours + walls)

Typed against the kernel types from `oc-scripts-domain.model.ts` — no `any`, unlike the client
copies. Verify: `npx tsc` / the web-sdk type check passes.

### Step 2 — roomle-ui: glue logic + API surface

- `glue-logic.ts` `getPlanContext` (line 871): keep the per-section fetching (`getRoomInformation(PLAN)`,
  `getPosDataOfAllGroups`, `_libraryData` master data, `_posArticleMap` articles) and the `include`
  semantics, but shape every section through `hi-plan-context` before returning. Article compaction
  uses the in-memory master data and calculated groups — no extra designer requests (this removes
  the embedding-side "fetch extra sections for articles" workaround).
- `external-object-api.ts`: update `HiPlanContext` to the new section types and rewrite the
  `getExternalObjectPlanContext` header comment: returns agent-ready, compacted data in one
  coordinate system (3D, right-handed, Y up); sections and include semantics.
- `debug-logging.ts:399` passes the context through unchanged — only the logged shape changes;
  verify it still compiles and the debug output remains useful.

### Step 3 — roomle-hi-example: reference client (`hi-mcp/hi-mcp-poc-json-client/`)

- `tool-executors.ts`:
  - `get-plan-context` becomes a pass-through of
    `getExternalObjectPlanContext(include ?? DEFAULT_SECTIONS)`. Remove `compactMasterData`,
    `compactAttribute`, `compactArticle`, `calculatedDockingVectorsByArticle`, `shapeRoot`,
    `shapeGroup`, `shapeRooms`.
  - Keep `dockingVectorNames`, `freeDockingVectors`, `isGeneratedRoot`, `stripDockingIndices` —
    the placement and input-shaping code (`contactError`, `toArticlePick`, `withoutPositions`,
    create-or-replace-groups validation) still uses them. They now exist in both places
    (roomle-ui for shaping, the client for tool logic) — inherent to the repository split, same
    situation as the footprint helpers below.
  - `find-attributes`: iterates the compacted attributes the API returns. `attributeMatches`
    needs id, name, desc, group, selections (name, desc, value) — all survive `compactAttribute`.
    The result carries libraryId, the compacted attribute and the root modules that reference it;
    `userRight` is no longer available and is dropped.
  - `create-or-replace-groups` / `place-group`: the placement math stays on the embedding side
    (it is tool logic, not context preparation) but changes its data sources:
    - walls: `resolveWall` reads `context.rooms[i].walls` instead of calling `deriveWalls`
    - raw group geometry (`placeGroupAtWall` → `groupFootprint`/`groupCornerGeometry`,
      `findGroupContact` → `rootFootprintInRoom`, `repositionedGroup` on calculated roots):
      fetch via the existing public API `getExternalObjectGroups()`
      (`external-object-api.ts:408`) instead of the now-shaped context groups
    - agent-visible results (`loaded`, `groups`, `placements`, place-group result) come from the
      pre-shaped context sections directly
  - **Verification gate:** `getExternalObjectGroups()` must return the same calculated `PosGroup`
    shape as the former context `groups` section. If it does not, the fallback is to extend the
    shaped group with the geometry the placement math needs (corner geometry, root footprints) —
    decision then, documented in the report.
- `plan-space.ts`: remove `contourPointToPosSpace`, `sideFromFacing`, `deriveWalls` and the
  contour types; keep the placement/geometry helpers (footprint stack, corner placement, contact
  detection, `placeAgainstWall`, `repositioningFromPlacement`, `resolveWallAlignment`,
  `adjoiningWall`, `convexPolygonsTouch`).
- `types.ts`: extend `RoomDesignerApiType` with `getExternalObjectGroups` if missing.

### Step 4 — roomle-hi-example: MCP server, example page, tests, docs

- `hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts`: update the `get-plan-context` description (3D
  contour `pos: [x, level, -y]`, derived walls, compact sections as the API returns them),
  the `find-attributes` description (compacted vocabulary, no `userRight`, no "attributes the
  compact masterData leaves out"), and the coordinate references in the intro prompt text
  (walls stay `[x, z]`, so the repositioningData guidance survives; contour references change).
- `minimal-hi-example/index.html`: the same executor changes inline (pass-through, walls from
  context, raw geometry via `getExternalObjectGroups`, find-attributes on compacted data).
- Tests: adapt the existing `hi-mcp` tests (plan-space loses the `deriveWalls` cases,
  tool-executors to pass-through and new shapes) so `npm test` and `npm run typecheck` at the
  `hi-mcp` root stay green. No new unit tests here — the unit-test plan below is roomle-ui only.
- Docs: `minimal-hi-example/docs/hi-mcp-server.md`, `.agents/skills/hi-mcp-tools.md`,
  `.agents/skills/hi-mcp-server.md`, `hi-mcp/hi-mcp-poc-json/README.md` / `QUICKSTART.md`
  response examples.

### Step 5 — ligna-store: client copy

- Sync `hi-mcp/tool-executors.ts`, `hi-mcp/plan-space.ts`, `hi-mcp/types.ts` from the reference
  client, checking for store-specific adaptations; run the store's checks.

### Step 6 — end-to-end verification

- roomle-ui: web-sdk vitest suite for homag-intelligence (new `hi-plan-context-test.ts` plus the
  adapted `glue-logic-test.ts` getPlanContext block).
- roomle-hi-example: `npm test` + `npm run typecheck` at the `hi-mcp` root; then `npm start`,
  connect an MCP client, and verify: `get-plan-context` (compact masterData, 3D contour with
  surviving segment properties, walls, footprints), `find-attributes` (finds compacted
  attributes), `create-or-replace-groups` and `place-group` round-trips (placement against walls
  and contact rejection still work).

## Unit Test Plan (roomle-ui only)

New `packages/web-sdk/packages/homag-intelligence/__tests__/hi-plan-context-test.ts` (pure
functions, vitest, following `glue-logic-test.ts` / `orders-test.ts` conventions), plus adapting
the existing `getPlanContext` describe block in `glue-logic-test.ts` (line 8244) to the new
shapes. Run via the web-sdk vitest setup (`packages/web-sdk`: `npm test`).

**hi-plan-context-test.ts:**

1. Contour conversion: (x, y) with the parent level → `pos: [x, level, -y]`; rounding to two
   decimals; IEEE `-0` normalized to `+0`; `cmd`, `angle`, `type`, `height`, `thickness` survive
   unchanged; multiple levels; `PosRooms`/`PosRoom` wrappers preserved.
2. Wall derivation on the converted contour: counter-clockwise rectangle → four walls with sides
   left/right/top/bottom and the matching `facingRotationY` values (90/180/270/0); `start`/`end`
   in pos space; `lengthMm`; `type`/`heightMm`/`thicknessMm` taken from the closing segment;
   free-space segments (`type` undefined); fewer than two segments → no walls; non `M`/`L`
   commands → no walls; zero-length segments skipped.
3. Master-data compaction: only root modules (`isRoot` true or `moduleType: 'RootModule'`);
   only attributes that are assigned to a surviving root module and customer-facing
   (`isMain` or `userRight: 'Simple'`); module whitelist (id, name, desc, imageUrl, attributes);
   `module.attributes` filtered to the surviving attribute ids.
4. Attribute compaction: exact field whitelist (id, name, desc, imageUrl, type, group,
   selections).
5. Article compaction: module info resolved by root name; dimensions are the `Dim`-type
   attributes; main attributes are `isMain` and not dimensions; docking vectors from the
   template with the calculated fallback; insert levels; sub-modules with resolved module info;
   `cornerArticle` true for the four corner docking vector ids; `CollisionBox` filtered.
6. `calculatedDockingVectorsByArticle`: first calculated root per article id wins; roots without
   article id or vectors skipped; empty groups.
7. Group shaping: `shapeRoot` keeps only `isInput` attributes as `{id, value}`; strips the
   docking indices from `contextData`; marks generated roots; `dockingVectors` without
   `CollisionBox`; `freeDockingVectors` excludes the used ones; sub-modules as `{id, imageUrl}`;
   log messages passed through. `shapeGroup`: position with `pos`, `rotationY` and footprint;
   group attributes; shaped roots; log messages.
8. Footprint: synthetic group (parts with `relPos`/`dim`/`fullMatrix`, hidden parts, `rotationY`,
   `articlePos`) → correct footprint box; `-0` never serialized.
9. `shapeRooms`: `undefined` rooms stay `undefined`; each room gains converted levels and walls.

**glue-logic-test.ts (adapt the existing five getPlanContext tests):**

10. All sections returned without a filter, now in the agent-ready shapes (compact masterData,
    converted rooms with walls, compact articles, shaped groups); `getPosDataOfAllGroups` called
    once; `getRoomInformation` called with `PLAN_ROOM_GEOMETRY_MODE.PLAN`.
11. The include filter still controls which designer requests happen and which sections are set.
12. Empty plan → empty sections.
13. Mutation isolation: mutating the returned context does not touch `_posArticleMap`,
    `_libraryData` master data or the group map.
14. Articles section compaction uses the in-memory master data and calculated groups without
    additional designer requests (spy counts).

## Risks and Assumptions

- `getExternalObjectGroups()` equivalence (Step 3 verification gate) is the main assumption; the
  fallback is documented there.
- The geometry helpers (`groupFootprint` and its chain) will exist in roomle-ui (shaping) and in
  the embedding clients (placement math) — accepted duplication across repositories, the same
  duplication that exists today between roomle-hi-example and ligna-store.
- The shaped payload is larger than the raw kernel payload for rooms (walls added) and smaller
  everywhere else; no performance concern expected, but the manual verification includes a
  real-library session.

## References

- Jira: RML-17966, comment 155424 (2026-09-28) — the authoritative request.
- `roomle-ui/packages/web-sdk/packages/homag-intelligence/src/glue-logic.ts:871` — current
  `getPlanContext`.
- `roomle-ui/packages/web-sdk/packages/homag-intelligence/src/external-object-api.ts:165,427` —
  `HiPlanContext` and `getExternalObjectPlanContext`.
- `roomle-ui/packages/web-sdk/packages/homag-intelligence/src/model/oc-scripts-domain.model.ts:207-227`
  — `PosContourSegment`, `PosContour`, `PosRoom`.
- `ligna-store/hi-mcp/tool-executors.ts`, `hi-mcp/plan-space.ts` — embedder-side shaping.
- `roomle-hi-example/hi-mcp/hi-mcp-poc-json-client/` — reference copy of the store client.
- `roomle-hi-example/minimal-hi-example/index.html` — inline executors of the minimal example.

---

## Report (close-out, 2026-09-28)

### Summary of changes

The plan context is now assembled agent-ready in the roomle-ui glue logic. `getPlanContext` returns
compacted sections in one coordinate system (3D, right-handed, Y up), the embedding systems
(ligna-store, minimal example) stopped reshaping it, and the MCP server information documents the
new shapes. `compactMasterData` is completely removed from the embedding repositories, as the
ticket demanded.

### Changed files

| Repository | File | Change |
|---|---|---|
| roomle-ui | `src/hi-plan-context.ts` | **New.** All shaping (compaction, article/group/room shaping, 3D contour conversion, wall derivation), typed against the kernel model, no `any`. |
| roomle-ui | `src/glue-logic.ts` | `getPlanContext` shapes every section through hi-plan-context; articles and groups share one calculated-groups fetch; master data and articles are deep-copied before compaction. |
| roomle-ui | `src/external-object-api.ts` | `HiPlanContext` uses the new agent-facing types; `getExternalObjectPlanContext` header comment rewritten (agent-ready, one coordinate system). |
| roomle-ui | `src/model/oc-scripts-domain.model.ts` | `PosContextData`, `PosDockedContext`, `PosDockedContextRoot` exported (needed for typed shaping). |
| roomle-ui | `__tests__/hi-plan-context-test.ts` | **New.** 23 unit tests for the pure shaping functions. |
| roomle-ui | `__tests__/glue-logic-test.ts` | getPlanContext block adapted to the agent-ready shapes + new fetch-sharing test; master data seeded per test (the shared mock stays untouched). |
| roomle-hi-example | `hi-mcp-poc-json-client/tool-executors.ts` | get-plan-context is a pass-through; find-attributes searches the compacted vocabulary (userRight dropped); placement math reads `room.walls` and `getExternalObjectGroups()`. |
| roomle-hi-example | `hi-mcp-poc-json-client/plan-space.ts` | Contour conversion and wall derivation removed (moved to roomle-ui); placement/geometry helpers kept. |
| roomle-hi-example | `hi-mcp-poc-json-client/tests/*` | plan-space tests lose the deriveWalls cases; tool-executor tests rewritten around pass-through, shaped context fixtures, walls and raw groups. |
| roomle-hi-example | `hi-mcp-poc-json/hi-mcp-server.ts` | get-plan-context and find-attributes tool descriptions updated (3D contour, compacted vocabulary). |
| roomle-hi-example | `minimal-hi-example/index.html` | Same executor changes inline (pass-through, walls from context, raw groups via getExternalObjectGroups). |
| roomle-hi-example | `docs`, `hi-mcp-poc-json/README.md` | Rooms (3D contour + walls) and find-attributes (compacted vocabulary) documented. |
| ligna-store | `hi-mcp/tool-executors.ts`, `hi-mcp/plan-space.ts` | Synced from the reference client (were byte-identical to it before the change). |

Commits: roomle-ui `04b4e24bb`, roomle-hi-example `ef51785`, ligna-store `ce4dd48` (all on
`refactor/hi-plan-context-RML-17966`, not pushed).

### Before/after

- **Before**: `getExternalObjectPlanContext` returned raw kernel data; ~500 lines of shaping code
  existed in three copies (ligna-store client, reference client, inline example page), each
  converting the 2D contour and compacting master data/articles/groups itself.
- **After**: the shaping exists once, in roomle-ui `hi-plan-context.ts`, behind unit tests; the
  embedding executors are pass-through for the context and consume `room.walls` plus
  `getExternalObjectGroups()` for the placement math. Net effect in the embedding repos: about 750
  lines removed in roomle-hi-example and 310 in ligna-store.
- **Data shape**: room contours are 3D now - `HiPlanContourSegment.pos: [x, level, -y]` with all
  other properties surviving, plus a derived `walls` array per room (unchanged wall shape, so the
  placement vocabulary and `place-group` semantics are preserved).

### Test adaptations

- New roomle-ui unit tests (hi-plan-context-test.ts): contour conversion (pos, rounding, -0,
  property survival), wall derivation (rectangle sides/facings, closing-segment properties,
  degenerate/curved/zero-length contours), master-data compaction (root-only, assigned +
  customer-facing, whitelists), attribute whitelist, article compaction (dimensions, main
  attributes, docking-vector fallback, cornerArticle, no-master-data case),
  calculatedDockingVectorsByArticle, root/group shaping (input attributes, stripped docking
  indices, free vectors, footprint from part boxes).
- glue-logic-test.ts: the five getPlanContext tests now assert the agent-ready shapes (converted
  rooms with walls, compact master data and articles, shaped groups) and a new test pins the
  single calculated-groups fetch shared by the articles and groups sections.
- hi-mcp tests: fixtures now model the API contract (shaped context groups, walls-carrying rooms,
  raw groups via a `getExternalObjectGroups` mock); the moved compaction semantics are covered by
  the roomle-ui tests.

### Risks and open items

- **Live verification pending.** The unit and integration tests are green, but the full round-trip
  (start the example with a real planner session, connect an MCP client, call get-plan-context /
  find-attributes / create-or-replace-groups / place-group) has not been run in this session.
  Specifically `getExternalObjectGroups()` (planner-core, `JSON.parse(group.serializedDefinition)`)
  must return the calculated `PosGroup` shape the placement math needs - the plan's verification
  gate. If it differs, the fallback is to extend the shaped group with the needed geometry.
- The geometry helpers (`groupFootprint` and its chain, docking vector names) now exist in
  roomle-ui (shaping) and in the embedding clients (placement math) - accepted duplication across
  repositories, documented in the analysis.
- The pre-existing `hi-mcp/cf` worker test fails for a missing `@cloudflare/containers` install in
  this checkout; unrelated to this refactoring.
- Not done (out of scope per the ticket comment): the `minimal-hi-example` `npm run dev` mode and
  the INT-stage planner build still need the roomle-ui changes released/deployed before the store
  and the example can consume them at runtime.
