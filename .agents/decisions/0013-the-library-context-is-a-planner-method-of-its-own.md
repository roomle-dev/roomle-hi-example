# ADR 0013 — The library context is a planner method of its own

> **Status**: Accepted
> **Date**: 2026-10-22
> **Supersedes**: the clause of [ADR 0007](0007-hi-mcp-tool-logic-in-the-planner.md) that keeps the tools at six planner methods; D71 of [hi-mcp-behaviour.md](../context/hi-mcp-behaviour.md#3-decisions) names seven

## Context

`getExternalObjectPlanContext` returned the data of the plan — the rooms, the groups, the obstacles,
the installation elements and the interior design options of a group — together with the data of
the loaded libraries: the master data and the article catalog. The library data changes only when a
library or its article catalog is loaded; the plan data changes with every edit. A caller could not
ask for the one without the API mixing in the other, and the catalog took the docking vectors and
corner point of an article from a root of that article in the plan, so the same article looked
different depending on what the plan held.

ADR 0007 kept the tools at six planner methods, argued from the page allow-lists of the MCP server
architecture. Since [ADR 0012](0012-the-hi-tool-set-runs-in-the-planner.md) the tools run in the
planner, and no allow-list remains.

## Decision

- The planner has a method of its own for the library data:
  `getExternalObjectLibraryContext(include?, options?)` returns `HiLibraryContext` with the sections
  `masterData`, `articles` and `subArticles` (the sub-article catalog: `articleId`, `libraryId`,
  `desc`). It reads nothing from the plan (roomle-ui `createLibraryContext`, `hi-library-context.ts`).
- The geometry of an article without docking vectors of its own comes from its template only, never
  from a root of the article in the plan.
- `getExternalObjectPlanContext` keeps `masterData` and `articles` as deprecated sections that
  return what the library context returns, and its default stays all sections but `interiorDesign`:
  the method is public API of the embedding-lib.
- The tools and the tool commands read the library sections from the library context, a seventh
  planner method of the tools. The agent sees no change: `get-plan-context` keeps its sections, its
  defaults and its result.

## Consequences

- The library context can be read once per library load; nothing of the plan invalidates it.
- A caller that needs both kinds makes two planner calls: `get-plan-context`, `find-attributes`
  and the row edits make them in parallel.
- An article in the plan whose root modules carry no docking vectors of their own shows the geometry
  of its template, not that of a configured root in the plan.
- The example's run script waits for the articles of the library context, so it needs a planner
  that has the method.
- Tested in roomle-ui `hi-library-context-test.ts` (the sections, no plan read, the templates),
  `hi-plan-context-test.ts` (the deprecated sections equal the library context's),
  `planner-core/__tests__/roomle-planner.ts` and `hi-mcp-tools-test.ts`
  (`it('reaches the planner only through the seven planner methods and its history callback')`).

## Rejected

- **Remove `masterData` and `articles` from the plan context**: it changes the default result of a
  public method for every page that calls it.
- **Keep the tools on the plan context for the library sections**: the split would stop at the
  planner API, and the tools would go on mixing the two kinds.
- **The geometry of a root in the plan**: the library context would need the plan again.
- **A tool of its own for the library data**: the tool list and the served text would change for a
  refactoring of the planner API.
