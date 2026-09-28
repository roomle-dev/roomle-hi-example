> **Type**: Refactoring Analysis
> **Domain**: homag-intelligence (roomle-ui), hi-mcp (roomle-hi-example, ligna-store)
> **Trigger**: Jira RML-17966, comment 155424 (Design flaw in the mcp api) — `compactMasterData` must not be used in the embedding systems; the plan context returned by `getExternalObjectPlanContext` must be agent-ready, compacted, and in one consistent 3D coordinate system, produced by the glue logic in roomle-ui.
> **Date**: 2026-09-28
> **Author**: AI Assistant
> **Status**: Open (decisions resolved with the ticket author, 2026-09-28)

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
