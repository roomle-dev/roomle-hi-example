# The exchange command fails on an uncalculated article template

- **Type:** Bug analysis
- **Status:** Open
- **Date:** 2026-10-27
- **Base:** roomle-ui `feat/hi-mcp-performance` (`432119f80`); roomle-hi-example `feat/test-report-planning-time`
- **Backlog:** [mcp-issues.md, 113](../backlog/mcp-issues.md#113-the-exchange-command-fails-for-every-input-on-bo-test)

## Affected repositories

- **roomle-ui** — `transferDockingContext` (`pos-group-docking.ts`) leaves the vector indices of a
  new root without docking vectors to the calculation; a guarding unit test in `hi-tools-test.ts`;
  the staged exchange in D106 of `hi-tools-behaviour.md` and in `library-errors.md`.
- **roomle-hi-example** — this analysis and the backlog item it closes; no code change.
- **embedding-lib** — unchanged: the tool command runs in the planner, a new planner build
  (bo-test deployment or `--dev`) carries the fix, no new embedding-lib version.

## Symptom and reproduction

`exchange-root-module` answers the TypeError "Cannot read properties of undefined (reading 'map')"
for every call on a root module that a neighbour docks to or that docks to one — with and without
`attributes` — and changes nothing. In `mcp-test-2026-10-27_07-11-41` five runs hit it (gpt-6-astra
18, 19, 27, 33, 35); the agent rebuilt each group with `create-or-replace-groups`. The same call
built in `mcp-test-2026-10-25_18-06-08`.

Model-free in the example page on the bo-test planner, plan `three-tall-units`:

```js
await instance.extended.callExternalObjectAgentTool('exchange-root-module', {
  groupId: '064a7d91-b583-4883-b71b-95c324d3d824',
  rootModuleId: 'a7271f1b-50d5-4b50-97ca-7a5bf75f77fa',
  articleId: 'HTS2AB60',
});
// isError, "Cannot read properties of undefined (reading 'map')"
```

In a unit test: the exchange test of `hi-tools-test.ts` with `swapArticle(undefined)` — an article
template without `dockInfos` — rejects with the TypeError:

```text
TypeError: Cannot read properties of undefined (reading 'map')
    at uniqueDockingVectorIndex (src/pos-group-docking.ts:107:6)
    at src/pos-group-docking.ts:142:25
    at Array.filter (<anonymous>)
    at transferDockingContext (src/pos-group-docking.ts:137:61)
    at … (src/hi-tools.ts:1475:9)
```

## Investigation

- `hi-tool-commands.ts:1405` — the tool command resolves the group, the article and the root id
  and sends the group operation. It shares `rowEditContext`, `catalogArticleId` and `withRowHints`
  with `insert-article-into-group`, which builds on the same planner (runs 20 to 22), so the
  failure lies behind the command.
- `hi-tools.ts:1433` — `exchangeRootModule` stages the change first (D106): `_stagedFailures`
  applies it to a copy of the group (`change(staged, original)`, `hi-tools.ts:1072`) and calculates
  the copy inside a `try` (`hi-tools.ts:1085`). A calculation that throws becomes a `Fatal` message,
  a change that throws escapes as it is — the raw TypeError of the symptom.
- `hi-tools.ts:1463` — the staged new root comes from `_expandArticlePick`: a deep copy of the
  article's template in `posArticleMap`, with new ids, not calculated.
- `glue-logic.ts:570` — `loadPosData` fills `posArticleMap` with the articles of the library's
  article list (`api/pos/libraries/<library>/articles`). The templates hold `articlePos`,
  `quantity`, `posData`, `id`, `name`, `modules` and `attributes` — no `dockInfos`: none of the 111
  articles of Furniture_Smith (`docs/library-information/article.json`, the same endpoint) has
  them. The library writes `dockInfos` when it calculates a group.
- `hi-tools.ts:1475` — the staged change calls `transferDockingContext(staged, replaced, newRoot)`.
- `pos-group-docking.ts:125` — `transferDockingContext` renames every reference to the replaced root
  and re-resolves its vector index on the new root by dock id (`pos-group-docking.ts:142` for the
  references of the neighbours, `:161` for the new root's own); `uniqueDockingVectorIndex`
  (`pos-group-docking.ts:102`) maps `root.dockInfos` (`:106`).
- `hi-tools.ts:1581` — the real exchange (`_swapRootModule`) calls `transferDockingContext` too,
  with a new root from `newPosDataFromId`, which the glue logic calculates: it has `dockInfos`, and
  the transfer works there.
- `__tests__/__mocks__.ts:268` — `swapArticle` builds the test template with `dockInfos`, so the
  exchange tests never stage a template as the library delivers it.
- `8d7537e6e` (2026-10-26, "fix: address hi edit validation and discovery failures") put
  `transferDockingContext` into the staged change, which copied `contextData` before; the commit is
  in `feat/hi-mcp`, `feat/hi-mcp-performance`, `feat/hi-mcp-merge` and `release/bo-test`.

## Root cause

`pos-group-docking.ts:106` — `uniqueDockingVectorIndex` reads `root.dockInfos` without a check,
and `transferDockingContext` calls it for the staged new root of the exchange
(`hi-tools.ts:1475`), an uncalculated article template that has no `dockInfos`. Every exchange of a
root module with a docking reference throws before the staged copy is calculated.

## Why the code produces wrong results

`transferDockingContext` assumes a calculated replacement: its contract re-resolves every vector
index on the new root "because the new article's dockInfos can differ in count and order". The
staged exchange hands it a replacement the library has not calculated yet, for which no vector
index exists. The unit tests did not see it because their template carries `dockInfos` the
library's templates do not have.

## Proposed fix

roomle-ui, `pos-group-docking.ts`: `transferDockingContext` re-resolves the vector indices only on a
new root that carries `dockInfos`. On a new root without them — an article template the library has
not calculated — the references are renamed to the new root and keep their vector names, without an
index into the new root; the calculation and the arrangement complete the indices from the names,
as they do for the entries `addDockingEntry` (`hi-tools.ts:233`) writes for a merge or an insert.
Such a root drops no docking: whether its article has a vector is known only after the
calculation, and the real exchange (`hi-tools.ts:1581`), whose new root is calculated, reports the
dockings it drops in `corrections` as before.

Rejected:

- `root.dockInfos ?? []` in `uniqueDockingVectorIndex` — the staged copy would drop every docking
  of the new root as missing, calculate a loose unit and log a console error per reference, while
  the real exchange keeps the dockings.
- Staging the new root as the real exchange builds it (`newPosDataFromId`, calculated, with
  `dockInfos`) — the staged check would validate the root as loaded, but it adds a calculation to
  every exchange and changes how the staged exchange builds its root (D106), beyond this defect.

## Tests

- roomle-ui `__tests__/hi-tools-test.ts`, `exchangeRootModule`: an exchange with an article template
  without `dockInfos` (`swapArticle(undefined)`) builds; the staged copy the library calculates
  docks the neighbour to the new root by the vector name, without an index into it.
- The existing exchange tests (templates with `dockInfos`) keep passing: incoming ids and vector
  indices are remapped before the staged calculation.
- Prompt tests `edit-replace-unit`, `edit-replace-unit-wider`, `wardrobe-exchange-end-door-hinge`
  and `edit-exchange-drawer-end` pass with one `exchange-root-module` call on a planner that carries
  the fix.
