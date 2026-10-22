# Split the library context from the plan context

> **Type**: Refactoring analysis
> **Status**: Open
> **Date**: 2026-10-22
> **Base**: roomle-hi-example `master` `34abf72`; roomle-ui `release/bo-test` `142e1a96d` (the branch
> the bo-test planner runs — the HI tool set is not on roomle-ui `master`)

## Affected repositories

- **roomle-ui** — a new planner method `getExternalObjectLibraryContext` with the types
  `HiLibraryContextSection`, `HiLibraryContextOptions` and `HiLibraryContext` (homag-intelligence,
  planner-core, the web-sdk exports); the HI tools and the HI tool commands read the library sections
  from it; the tests; `.agents/homag-intelligence.md` and the embedding-lib documentation.
- **roomle-hi-example** — the readiness check of `run-hi-mcp-prompt.js`; the behaviour reference
  (D48, D71, D74, the planner methods); the context documents; a new ADR if the tools take a seventh
  planner method (question 2).
- **embedding-lib** (in roomle-ui) — documentation only. `createHiMcpTools` forwards the tool calls to
  the planner and reads no plan context itself, so no new embedding-lib version is needed.
- **ligna-store** — unchanged: it calls neither method, and the tools come with the planner.

## What the current code does

`getExternalObjectPlanContext(include?, options?)` of the planner returns `HiPlanContext` with seven
sections (`HiPlanContextSection`, `external-object-api.ts:217-224`; `HiPlanContext`,
`external-object-api.ts:241-249`). They are of two kinds:

| Section | Source | Changes when |
|---|---|---|
| `masterData` | the library: `GlueLogicImplementation.libraryData` | a library is added (`addLibrary`, `glue-logic.ts:600-605`) |
| `articles` | the library: `posArticleMap` and the article templates — **and the plan**, see below | the article catalog is loaded (`loadPosData`, `glue-logic.ts:607-623`, which clears the templates) |
| `rooms` | the plan: `designerRequests.getRoomInformation` | a wall is moved, a room is changed |
| `groups` | the plan: `designerRequests.getPosDataOfAllGroups` | every plan change |
| `obstacles` | the plan: `getPlanObstacles` and the calculated groups | every plan change |
| `installationElements` | the plan: `getPlanObstacles` | a plug or a connection is moved |
| `interiorDesign` | one group of the plan, scoped by `options.interiorDesign` | every change of that group |

The options mix the two kinds as well (`HiPlanContextOptions`, `external-object-api.ts:226-234`):
`interiorDesign` scopes a plan section, `articleIds` narrows the template calculation of the library
section `articles`.

The call chain, which the new method follows:

1. `RoomlePlanner.getExternalObjectPlanContext` (`planner-core/src/roomle-planner.ts:3209-3218`) —
   `{}` without the HI module, else the glue logic.
2. `GlueLogic.getPlanContext` (`glue-logic.ts:281-284`, implementation `:1114-1119`), wrapped for
   logging by `debug-logging.ts:404-414`.
3. `HiTools.getPlanContext` (`hi-tools.ts:280-283`, implementation `:314-321`) — the groups in the
   placement frame (`inPlacementFrame`); `_createPlanContext` (`hi-tools.ts:351-381`) adds the scoped
   `interiorDesign` section.
4. `createPlanContext` (`hi-plan-context.ts:996-1101`) builds the sections: `compactMasterData` for
   `masterData`, `compactArticle` with the calculated docking vectors and corner points for
   `articles`.

**The article geometry depends on the plan.** For an article whose root modules carry no docking
vectors of their own, `createPlanContext` takes the docking vectors and the corner point from a root
of that article **calculated in the plan**, and calculates a template outside the plan only when the
plan has none (`hi-plan-context.ts:1060-1099`, `calculateArticleTemplate`, `glue-logic.ts:1022-1076`).
A root in the plan can be configured differently from the article's default — another
`mod_Width`, for example — so the catalog shows the geometry of that configured root. Because of
this, `articles` also triggers the fetch of the calculated groups (`hi-plan-context.ts:1011-1019`).

### The callers

| Caller | Sections | Kind |
|---|---|---|
| tool `get-plan-context` (`hi-mcp/tool-executors.ts:411-477`) | the agent's `include`: `articles`, `articleDescriptions` (from `articles`), `masterData`, `attributes` (from `masterData`), `rooms`, `groups`, `obstacles`, `installationElements` | both, one call |
| tool `find-attributes` (`tool-executors.ts:479-489`) | `masterData`, `groups` | both, one call |
| tool `get-interior-design-options` (`tool-executors.ts:397`) | `interiorDesign` | plan |
| `planGroups` for undo and redo (`tool-executors.ts:91-93`) | `groups` | plan |
| `create-or-replace-groups`, the article lookup (`hi-tool-commands.ts:379`) | `articles` | library |
| `create-or-replace-groups` and `place-group`, the plan before and after (`hi-tool-commands.ts:186`, `:391`, `:662`, `:787`, `:873`) | `groups`, `obstacles`, `rooms` | plan |
| `delete-article-and-compact`, `merge-article-into-group`, `exchange-root-module`, `insert-article-into-group`, `swap-root-modules` (`hi-tool-commands.ts:1125`, `:1169`, `:1243`, `:1288`, `:1339`) | `groups`, `articles`, `rooms`, `obstacles` | both, one call |
| `masterDataOf`, the attribute checks and the group settings (`hi-tool-attributes.ts:17-21`, used at `:42`, `:93`) | `masterData` | library |
| `run-hi-mcp-prompt.js` of roomle-hi-example, the readiness check (`planContextHasArticles`, `.agents/scripts/run-hi-mcp-prompt.js:293-300`) | `articles` | library |

The tool commands reach the planner through the seam `HiToolPlanner` (`hi-tool-commands.ts:102-122`),
implemented by `HiToolsImplementation._toolPlanner` (`hi-tools.ts:297-307`) and wrapped by the
step counter of `runToolCommand` (`hi-tool-commands.ts:1417-1447`). The tools reach it through
`PlannerApi` (`hi-mcp/planner-api.ts:4-27`, `createPlannerApi` `:43-99`), six methods with a timeout
and a log line each.

## Why it is a problem

- **Static and changing data in one call.** The master data and the article catalog are fixed once
  the libraries are loaded; the rooms, groups and obstacles change with every edit. A caller cannot
  ask for the one without the API mixing in the other, and nothing in the API says which part it may
  keep.
- **The catalog is not deterministic.** The same article shows different docking vectors and corner
  points depending on what the plan holds. Library data should not depend on the plan.
- **Library sections fetch the plan.** `articles` makes `createPlanContext` fetch the calculated
  groups even when no plan section is requested.
- **The options mix the kinds.** `articleIds` belongs to the library, `interiorDesign` to the plan;
  both sit in `HiPlanContextOptions`.

## Proposed target shape

### The library context (roomle-ui)

The new API follows the pattern of the plan context, one level at a time:

```ts
export type HiLibraryContextSection = 'masterData' | 'articles';

export interface HiLibraryContextOptions {
  /** Only these articles get their docking vectors and corner point from a template calculated outside the plan. */
  articleIds?: string[];
}

export interface HiLibraryContext {
  masterData?: Record<string, HiPlanMasterData>;
  articles?: HiPlanArticle[];
}

// ExternalObjectAPI
getExternalObjectLibraryContext(
  include?: HiLibraryContextSection[],
  options?: HiLibraryContextOptions,
): Promise<HiLibraryContext>;
```

| Level | Plan context today | Library context |
|---|---|---|
| API | `ExternalObjectAPI.getExternalObjectPlanContext` (`external-object-api.ts:535-538`) | `getExternalObjectLibraryContext`, documented beside it |
| Planner | `RoomlePlanner.getExternalObjectPlanContext` | `RoomlePlanner.getExternalObjectLibraryContext` — `{}` without the HI module |
| Glue logic | `GlueLogic.getPlanContext`, `DebugLogging.getPlanContext` | `getLibraryContext` on both |
| HI tools | `HiTools.getPlanContext` | `HiTools.getLibraryContext` — no placement frame, no plan |
| Builder | `createPlanContext` (`hi-plan-context.ts`) | `createLibraryContext` in a new `hi-library-context.ts`; `compactMasterData`, `compactArticle` and the template geometry helpers move there |
| Exports | `HiPlanContext`, `HiPlanContextOptions` (`packages/web-sdk/packages/index.ts:204-205`) | the three new types beside them |

`createLibraryContext(include, libraries, posArticles, articleIds, calculateArticleTemplate)` takes no
`designerRequests`: it never reads the plan. The geometry of an article that lacks docking vectors
of its own comes from its template only (the default configuration of the article), calculated once
per article and cached as today until `loadPosData` loads the catalog again. The types keep their names
`HiPlanArticle` and `HiPlanMasterData`: they are exported, and renaming them is a public API change
of its own.

### The plan context after the split

**Recommended: `getExternalObjectPlanContext` keeps `masterData` and `articles`** as sections that
delegate to `createLibraryContext`, marked deprecated in its JSDoc, with `articleIds` kept in
`HiPlanContextOptions`. The method, its default (all sections) and its options are public API of the
embedding-lib; external pages may call them. The plan context's own code then builds only `rooms`,
`groups`, `obstacles`, `installationElements` and `interiorDesign`, and the calculated groups are
fetched only for `groups` and `obstacles`. Removing the two sections is a breaking change — see
question 1.

### The HI tools and the tool commands (roomle-ui)

Every library section is read from the library context; a caller that needs both kinds makes two
planner calls, in parallel where they are independent:

- `HiToolPlanner` gets `getExternalObjectLibraryContext`, implemented in `HiToolsImplementation._toolPlanner`
  and passed through by the step counter of `runToolCommand`.
- The article lookup of `create-or-replace-groups` and `masterDataOf` read the library context; the
  five row edits read `groups`, `rooms` and `obstacles` from the plan context and `articles` from the
  library context.
- `PlannerApi` gets `getExternalObjectLibraryContext` with the default timeout (30 s): `get-plan-context`
  splits the agent's `include` into library and plan sections and calls each method only when a
  section of its kind is requested; `find-attributes` reads `masterData` from the library context and
  `groups` from the plan context.
- **The agent sees no change.** `get-plan-context` keeps its `include` values, its defaults and its
  result; the tool list (`hi-mcp-fixture.json`) and the served text stay as they are.

### roomle-hi-example

- `planContextHasArticles` of `run-hi-mcp-prompt.js` asks `getExternalObjectLibraryContext(['articles'])`
  once the planner of bo-test serves it; until then the plan context still answers `articles`
  (with the recommended shape of the plan context).
- The behaviour reference and the context documents describe the two contexts (see the scope below).

## Scope

### roomle-ui (`release/bo-test` `142e1a96d`)

| File | Change |
|---|---|
| `packages/web-sdk/packages/homag-intelligence/src/external-object-api.ts` | the three types; `getExternalObjectLibraryContext` with JSDoc; `getExternalObjectPlanContext`'s JSDoc names the library sections as deprecated |
| `packages/web-sdk/packages/homag-intelligence/src/hi-library-context.ts` (new) | `createLibraryContext`; `compactMasterData`, `compactArticle` and the template geometry helpers from `hi-plan-context.ts` |
| `packages/web-sdk/packages/homag-intelligence/src/hi-plan-context.ts` | `createPlanContext` delegates `masterData` and `articles`; the calculated groups only for `groups` and `obstacles` |
| `packages/web-sdk/packages/homag-intelligence/src/hi-tools.ts` | `getLibraryContext`; `_toolPlanner.getExternalObjectLibraryContext` |
| `packages/web-sdk/packages/homag-intelligence/src/glue-logic.ts` | `GlueLogic.getLibraryContext` and its implementation |
| `packages/web-sdk/packages/homag-intelligence/src/debug-logging.ts` | `getLibraryContext` with its log line |
| `packages/web-sdk/packages/homag-intelligence/src/hi-tool-commands.ts` | `HiToolPlanner.getExternalObjectLibraryContext`; the step counter; the calls at `:379`, `:1125`, `:1169`, `:1243`, `:1288`, `:1339` |
| `packages/web-sdk/packages/homag-intelligence/src/hi-tool-attributes.ts` | `masterDataOf` |
| `packages/web-sdk/packages/homag-intelligence/src/hi-mcp/planner-api.ts` | `PlannerApi` and `createPlannerApi`: the seventh method |
| `packages/web-sdk/packages/homag-intelligence/src/hi-mcp/tool-executors.ts` | `get-plan-context`, `find-attributes` |
| `packages/web-sdk/packages/planner-core/src/roomle-planner.ts` | `getExternalObjectLibraryContext` |
| `packages/web-sdk/packages/index.ts` | the exports |
| `packages/embedding-lib/docs/homag-intelligence-embedding.md` | a section for `getExternalObjectLibraryContext` beside `getExternalObjectPlanContext` (`:1915`); the planner methods of the tools (`:2227`) |
| `.agents/homag-intelligence.md` | the planner seam (`:247`), the article templates (`:250`) |

### roomle-hi-example

| File | Change |
|---|---|
| `.agents/scripts/run-hi-mcp-prompt.js:293-300` | the readiness check |
| `docs/hi-mcp-behaviour.md` | D48 (the plan context is agent-ready) names the two contexts; D74 (the catalog's geometry) — from the template only; D71 (six planner methods) — seven (question 2); the planner methods table (`:404-410`); the `get-plan-context` passage (`:701-708`) |
| `docs/hi-mcp-server.md:136-140` | `get-plan-context` reads both contexts |
| `.agents/context/tool-executors.md:88-95` | the steps of `get-plan-context` |
| `.agents/context/deployment-and-testing.md:64-66` | the readiness check |
| `.agents/context/README.md:128-129` | the planner and the HI tools methods |
| `.agents/decisions/` | a new ADR: the library context is a planner method of its own (question 2); ADR 0007 keeps its record |

Left as they are: the ADRs 0001 and 0007 (records of their decisions), `AGENTS.md:251` (a naming
example), `.agents/skills/hi-mcp-tools.md` (the agent-facing tool, unchanged), the benchmarks and
the test fixtures that quote recorded planner calls (`report-scripts.test.js:279`).
`benchmark-hi-mcp-runs.js` groups the planner calls by the method of the log line
(`[hi-mcp] call N: <method>`, `:45`), so the new method appears as its own row without a change.

## Tests

### Covering the behaviour today (roomle-ui)

- `homag-intelligence/__tests__/hi-plan-context-test.ts:1749-1972` — the sections: `should share one
  calculated-groups fetch between articles and groups` (`:1756`), `should return copies of the
  internal state` (`:1780`), and the `article templates` group (`:1799-1972`), among them `does not
  calculate an article that has a calculated root in the plan` (`:1855`) and `calculates only the
  requested articles when the caller names them` (`:1920`).
- `planner-core/__tests__/roomle-planner.ts:4636-4679` — the planner method delegates, forwards the
  article selector, answers `{}` without the HI module.
- `homag-intelligence/__tests__/hi-tools-test.ts`, `hi-interior-design-test.ts` — the plan context of
  the HI tools.
- `homag-intelligence/__tests__/hi-mcp/tool-executors-test.ts` (the `get-plan-context` and
  `find-attributes` cases, e.g. `:254`, `:396-450`, `:561-648`, `:804-847`), `hi-mcp-server-test.ts:1312-1353`,
  `hi-mcp-tools-test.ts:79-158`, `interior-fittings-test.ts` — the planner calls of the tools.
- `homag-intelligence/__tests__/hi-tool-commands/__mocks__.ts:345` and the command tests that stub
  the plan context (`create-or-replace-groups-placement-test.ts:1047-1059`, `place-group-test.ts`,
  `run-tool-command-test.ts`, `placement-frame-test.ts`).

### Changes to expect

- **New tests**: `createLibraryContext` (the sections, copies of the internal state, the templates
  with and without `articleIds`, no plan request at all); `RoomlePlanner.getExternalObjectLibraryContext`
  as the three plan context tests at `roomle-planner.ts:4636-4679`; the plan context's delegated
  sections return what the library context returns.
- **Tests that change meaning**: `does not calculate an article that has a calculated root in the
  plan` (`:1855`) — the library context calculates the template whatever the plan holds;
  `should share one calculated-groups fetch between articles and groups` (`:1756`) — `articles` no
  longer fetches the calculated groups.
- **Tests that change their expected calls**: the tool executor, server and command tests that assert
  `getExternalObjectPlanContext` with a library section expect `getExternalObjectLibraryContext` for it;
  the fake planners get the seventh method; `it('calls exactly the planner methods …')`-style checks of
  `PlannerApi` list seven.
- **Output changes**: an article in the plan whose root modules carry no docking vectors of their own
  shows the docking vectors and corner point of its template instead of those of the configured root
  in the plan. `cornerArticle` does not change (the corner vectors exist either way). The agent sees
  the docking vectors of the catalog; the corner point is removed for the agent (D10).
- **Unchanged**: the result of the tool `get-plan-context` for the same plan — apart from the article
  geometry above —, the tool list, the served text, the groups, rooms and obstacles.

No performance refactoring: the templates are calculated once per article as today — the articles
in the plan now included, a few milliseconds each (D74: 0.75 s for 111 articles) — so no benchmark is
required.

## Questions for the user

1. **The library sections of the plan context.** Keep `masterData` and `articles` in
   `getExternalObjectPlanContext` as deprecated sections that delegate to the library context
   (recommended — the method and its default are public API of the embedding-lib), or remove them?
   Removing them changes the default result of the plan context for every page that calls it.
2. **A seventh planner method for the tools.** D71 and ADR 0007 keep the tools at six planner methods,
   argued from the page allow-lists of the server architecture; since ADR 0012 the tools run in the
   planner and no allow-list remains. Let the tools call `getExternalObjectLibraryContext`
   (recommended — the split is incomplete if the tools keep reading the library through the plan
   context), with D71 updated and a new ADR?
3. **The article geometry from the template only.** Accept the output change above (recommended — it
   makes the catalog independent of the plan), or keep the geometry of a root in the plan, which
   needs the plan in the library context again?
4. **The agent-facing tool unchanged.** Keep `get-plan-context` as the agent's one tool for both kinds
   (recommended — the refactoring is about the planner API), or add a tool for the library data,
   which changes the tool list and the served text?

Not in this refactoring: caching the whole library context in the planner between
`addLibrary` / `loadPosData` and the next catalog load. The compaction copies the catalog on every
call; whether that is worth a cache is a question of measurements, not of the split.
