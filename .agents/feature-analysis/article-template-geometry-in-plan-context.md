# Article template geometry in getPlanContext

> **Date**: 2026-10-13 (supersedes the analysis of 2026-10-10, written before the tool logic moved into the planner)
> **Status**: Open
> **Ticket**: [RML-18140](https://roomle.atlassian.net/browse/RML-18140)
> **Base**: roomle-ui `feat/hi-layout-load-outcome-RML-18139` (`5b502b8c7`, the tool logic in the planner — [RML-18147](https://roomle.atlassian.net/browse/RML-18147), [ADR 0007](../decisions/0007-hi-mcp-tool-logic-in-the-planner.md) — and the load answer per group — [RML-18139](https://roomle.atlassian.net/browse/RML-18139)); roomle-hi-example `master` (`f30f307`)
> **Type**: Feature analysis — the catalog of the plan context carries the docking vectors and the corner flag of every article, and the corner word matches go

## Affected repositories

- **roomle-ui** — `createPlanContext` (`hi-plan-context.ts`) calculates the template of every
  article whose root modules carry no docking geometry and have no calculated root in the plan,
  through the `calculateArticleTemplate` of the glue logic that is already on the base branch; the
  `articleIds` option of `getExternalObjectPlanContext` goes; `isCornerArticle`
  (`hi-group-placement.ts`) reads the catalog's `cornerArticle` flag only.
- **roomle-hi-example** — the MCP server stops completing `cornerArticle` from the category or the
  module name (`isCornerArticle`, `agent-facing.ts`, C7); the plan context passes through as the
  planner reports it. The behaviour documentation, the tool reference and the skills change with
  the catalog.
- **ligna-store** — no change; its page bridge relays `getExternalObjectPlanContext` as it is, and
  the store's chat gets the complete catalog.

## 1. What was asked and why

The compact article catalog of `getPlanContext` describes every article of the loaded libraries so
the agent can pick one and dock it. Two facts the agent needs exist only as calculated geometry: the
docking vectors of an article's root modules, and the corner flag and corner point of a corner
article. The article templates (`loadPosData`) and the master data carry no `dockInfos`, so on an
empty plan every article comes without docking vectors and without the corner flag.

The ticket asks to measure the cost of calculating the article templates, to decide from the
measurement whether the plan context calculates them lazily on the first request or once after
`loadPosData`, to let `getPlanContext` calculate the template of every article whose roots have no
docking geometry and no calculated root in the plan, and to remove the server's workarounds: the
anchor probe and the completion of `cornerArticle` from the category.

## 2. How the area works today on the base branch

The refactoring of [RML-18147](https://roomle.atlassian.net/browse/RML-18147) moved the tool logic
into the planner and, with it, the first half of this ticket. The base branch has:

### 2.1 The template calculation (`glue-logic.ts`)

`GlueLogicImplementation.calculateArticleTemplate(articleId, attributes?)` (`glue-logic.ts:992`)
builds a single-pick group of the article, completes it from the template
(`_prepareArticlePickRoots`), regenerates the ids, initialises the group and runs
`libraryData.calculateGroup` through `_updatePosData` directly — not through `_calculate`, whose
catch would hide a failed calculation —, so an exception is caught in the method, logged and not
cached. The result is cached in `_articleTemplates` per library, article and sorted attribute
overrides (`glue-logic.ts:493`), cleared in `loadPosData` (`glue-logic.ts:596`). Nothing is added to
the group map and nothing is loaded. Six tests in `__tests__/article-template-test.ts` guard it.

### 2.2 The article selector of the plan context (`hi-plan-context.ts`)

`createPlanContext(include, designerRequests, libraries, posArticles, articleIds = [],
calculateArticleTemplate?)` (`hi-plan-context.ts:962`) calculates, in its articles branch
(`:1011-1030`), the template of every id in `articleIds` whose article has no root in the plan and
passes `[...calculatedGroups, ...templates]` into `calculatedDockingVectorsByRoot` (`:544`) and
`calculatedCornerPointsByRoot` (`:566`); `compactArticle` (`:604`) then fills
`rootModules[].dockingVectors`, `cornerArticle` and `cornerPoint` from those maps as before. The
selector reaches the planner API as `getExternalObjectPlanContext(include?, options?: { articleIds })`
(`HiPlanContextOptions`, `external-object-api.ts`; `roomle-planner.ts:3183`; `hi-tools.ts:338`).
Five tests in `__tests__/hi-plan-context-test.ts:1421-1493` guard it.

### 2.3 The consumers

- The `create-or-replace-groups` command takes the anchor frame of a placement by point from
  `calculateArticleTemplate` with the anchor's attribute overrides (`hi-tool-commands.ts:449`, C6,
  D46). The server's probe, `getExternalObjectGroups` and `removeExternalObject` are gone from the
  server: `planner-api.ts` has the six methods of D71.
- **Nobody passes `articleIds`.** The server's `get-plan-context` calls
  `getExternalObjectPlanContext([sections])` (`tool-executors.ts:455`, `planner-api.ts:33`); the
  tool commands fetch the catalog with `getExternalObjectPlanContext(['articles'])`
  (`hi-tool-commands.ts:333`) for the article resolution, the docking and the anchor. On an empty
  plan the catalog is as incomplete as before the refactoring.

### 2.4 Two word matches stand in for the flag

Because the catalog carries no flag on an empty plan, a corner article is recognised by the word
`corner` in its category or its module id:

- in the server, `isCornerArticle` (`agent-facing.ts:187-201`) completes `cornerArticle` for the
  agent (`agentFacingArticle`, C7);
- in roomle-ui, `isCornerArticle` (`hi-group-placement.ts:30-45`) tells the anchor of a group
  (`anchorRootOf`, `:245`), the root a `behind` relation may not dock to and where a row walk stops
  (`hi-group-layout.ts:281`, `:590`), and the corner check of the docking (`hi-tool-docking.ts:497`).

Both are guesses: a library that names its corner unit in another language, or by another word,
gets no corner anchor and no corner flag; the served results of the server must not carry
library-specific logic (§2.4 of [`hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md)).

### 2.5 The measurement

Measured on 2026-10-13 on the local dev build of the base branch (roomle-ui `npm run dev` on
`:5173`, the example page with `--dev` in headless Chromium, the HOMAG library of the example with
111 articles), through the planner API of the page:

| Call | Time |
|---|---|
| `getExternalObjectPlanContext(['articles'])`, first call, no templates | 29 ms |
| the same with the ids of all 111 articles — 111 template calculations | 773 ms |
| the same again, every template cached | 34 ms |
| `getExternalObjectPlanContext(['articles'])` again | 4 ms |

Per article through `calculateArticleTemplate` on a fresh page: 111 calculations in 738 ms,
median 6.2 ms, 90th percentile 10 ms, slowest 59 ms (one base unit); none failed, every template
carries docking vectors. The catalog with the templates lists the docking vectors of all 111
articles and four corner articles with their corner point (the four 90° corner units of the
library); without them it lists none.

Side effects: a corner kitchen (a corner unit and a base unit `rightOf` it, placed `{ wall:
'right', alignment: 'back' }`) loaded on a page that had calculated all 111 templates is identical,
ids stripped, to the one loaded on a fresh page. `calculateGroup` is `libraryExports.calc`
(`homag-intelligence.ts:159`), a library function without scene access.

The two articles whose template has no `Dim` attribute still list no `dimensions` after the
calculation: `compactArticle` reads the dimensions from the template's attributes, and the
calculated template of the range hood carries no size attribute either — its width exists only in
its docking vectors (598 mm between its left and right vectors) and its parts. The size the ticket
expects as a side benefit does not come from the calculation as it stands (§4.5).

## 3. The gap

The selector serves a caller that already knows which articles it wants, but the catalog is how
the agent picks — before its first `get-plan-context` nobody can name the ids. So the catalog on an
empty plan still carries no docking vectors and no corner flag, two word matches stand in for the
flag, and the ticket's step 3 ("every article whose roots have no docking geometry and no
calculated root in the plan") and step 4 (the server's completion of `cornerArticle`) are open.
The measurement answers the ticket's steps 1 and 2: the whole catalog costs 0.75 s once per page,
cached until the library's templates are loaded again, and the calculation has no side effect on the
plan — lazily on the first request, no background pass.

## 4. Proposed design

### 4.1 roomle-ui: the catalog is complete, always

`createPlanContext` loses the `articleIds` parameter. Its articles branch calculates, through the
`calculateArticleTemplate` callback, the template of every article of `posArticles` that has a root
module without docking vectors of its own (`dockingVectorNames(root)` empty) and without an entry
`${articleId}:${root.name}` in the maps of the calculated groups, once per article, and feeds the
templates into the two maps as the selector does today. The cache of the glue logic makes the pass
free after the first request: the catalog build itself (34 ms measured with every template cached).
An article whose calculation fails stays without geometry and without the flag, as today.

`HiPlanContextOptions` goes, with the `options` parameter of `getExternalObjectPlanContext`
(`external-object-api.ts`, `roomle-planner.ts`, `glue-logic.ts`, `debug-logging.ts`, `hi-tools.ts`,
the `HiToolPlanner` interface of `hi-tool-commands.ts`, the export in `packages/index.ts`). An
option nobody passes is dead API, and the behaviour is one: the catalog carries the geometry of
every article.

### 4.2 roomle-ui: the corner flag comes from the geometry only

`isCornerArticle` (`hi-group-placement.ts`) returns the catalog's `cornerArticle` flag and nothing
else; the word match on the category and the module id goes. The tool commands fetch the catalog
from the same `createPlanContext`, so the flag is there on an empty plan too. `anchorRootOf`, the
`behind` check, the row walk and the docking check keep their callers.

### 4.3 roomle-hi-example: the server passes the flag through

`agentFacingArticle` (`agent-facing.ts`) keeps the short description and the removal of
`cornerPoint` (D10) and drops `isCornerArticle`: `cornerArticle` is the planner's. `CORNER` and
`isCornerArticle` leave `agent-facing.ts`; C7 retires. `planner-api.ts` is unchanged — the catalog
needs no option.

The server change follows the planner: on a planner without the complete catalog the flag is
missing on an empty plan, so the server keeps C7 until the roomle-ui change is on the planner the
pages use.

### 4.4 Decisions to record

A row in §3 of [`hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md), to confirm:

> **The catalog carries the docking vectors and the corner flag of every article.** The geometry of
> an article that is not in the plan comes from its template, calculated by the planner once per
> page and library load on the first catalog request (0.75 s for a library of 111 articles,
> measured) and cached until the library's templates are loaded again; `cornerArticle` is derived
> from the corner docking vectors only, in the planner. Rejected: a word match on the category or
> the module id, in the server or the glue logic — a guess, wrong for a library that names its
> corner unit otherwise, and library knowledge in the server; a per-call article selector — the
> agent picks from the catalog, so the first call can name no article; a background pass after
> `loadPosData` — nothing to hide at 0.75 s.

C7 of §8.2 retires; the `articles` row of §5.4 and the `get-plan-context` paragraph of §6 say the
catalog carries the docking vectors and the corner flag of every article.

### 4.5 The size of an article without a `Dim` attribute — not in this ticket

The calculation gives the range hood and the TV no size attribute; a width would be a new derived
field from the extent of the docking vectors. The agent docks a hood by relation and the planner
places it by its template (C6), so the width matters only for choosing between hoods — which is
what the article's `desc` is for ([library issues](../backlog/library-issues.md)). Left out; the
ticket's sentence on it is answered by the measurement.

## 5. Alternatives considered and rejected

- **Keep the selector and let the server pass every id, or `'all'`.** Same cost, more API: the
  server must fetch the ids first or the planner must know a magic value, and the tool commands in
  the planner need the complete catalog anyway.
- **Calculate once after `loadPosData`, in the background.** Hides 0.75 s nobody waits for — the
  page takes 8 to 12 s to load the planner — and adds a scheduling path and a race with the first
  request. Revisit if a library of about 1000 articles (about 7 s at the measured rate) ever loads.
- **Restrict the calculation to corner articles by category.** Library-specific, and the docking
  vectors of every article are needed too.
- **Keep the word match beside the flag.** A guess in two places that is wrong for a library in
  another language and hides a failed calculation.
- **Add `dockInfos` to the article templates or the master data.** The templates come from the
  library and carry no geometry; the docking vectors are a result of the calculation.
- **A size derived from the docking vectors for articles without `Dim`.** A new field for two
  articles whose width the agent needs only to choose; the `desc` carries it (§4.5).

## 6. Tests

roomle-ui, `__tests__/hi-plan-context-test.ts` (replacing the selector tests of `:1421-1493`):

- `it('carries the docking vectors and the corner point of every article that is not in the plan')`
  — `calculateGroup` called once per article
- `it('does not calculate an article that has a calculated root in the plan')` (kept)
- `it('does not calculate an article whose template carries its own docking vectors')`
- `it('calculates an article once over two plan contexts')` — the cache
- `it('leaves the geometry out when the template calculation fails')` (kept)

roomle-ui, `__tests__/hi-group-placement-test.ts`: `it('recognises a corner article by its flag')`
replaces `:135` (flag, category or module name); `:237` (the L on an empty plan "where the catalog
has no flag yet") anchors by the flag the catalog now carries. `__tests__/article-template-test.ts`
stays. The planner-core test of the options forwarding goes.

roomle-hi-example, `hi-mcp/hi-mcp-server/tests/tool-executors.test.ts`: `it('flags a corner
article on an empty plan, where the planner has not derived the flag yet')` (`:524`) goes;
`it('keeps the corner point of the articles to the server')` (`:449`) stays with the flag as the
planner sends it. `tests/hi-mcp-server.test.ts:1022-1046` expects the compact JSON without a
`cornerArticle` the server added.

The ticket's test "get-plan-context on an empty plan returns `cornerPoint: [-261, 0, 0]`" holds for
the planner's plan context, not for the agent's: the server removes `cornerPoint` (D10). The agent's
result carries `cornerArticle: true` and the eight docking vector names of the corner unit. "The
first corner kitchen of an empty plan lands with its corner point on the room corner without a
probe load" holds on the base branch already (C6).

## 7. Code and documents the work touches

roomle-ui, on `feat/hi-layout-load-outcome-RML-18139`:

- `packages/web-sdk/packages/homag-intelligence/src/hi-plan-context.ts` — the articles branch of
  `createPlanContext`
- `src/external-object-api.ts`, `src/glue-logic.ts`, `src/debug-logging.ts`, `src/hi-tools.ts`,
  `src/hi-tool-commands.ts`, `packages/web-sdk/packages/index.ts`,
  `packages/planner-core/src/roomle-planner.ts` — the options parameter goes
- `src/hi-group-placement.ts` — `isCornerArticle`
- `.agents/homag-intelligence.md` (the article templates paragraph),
  `packages/embedding-lib/docs/homag-intelligence-embedding.md` (the plan context)

roomle-hi-example, after the planner change is deployed:

- `hi-mcp/hi-mcp-server/agent-facing.ts` — `agentFacingArticle` without `isCornerArticle`
- `docs/hi-mcp-behaviour.md` — the decision row of §4.4, C7, §5.4 `articles`, §6 `get-plan-context`
- `docs/hi-mcp-server.md`, `hi-mcp/hi-mcp-server/README.md` — the catalog and the `agent-facing.ts`
  row
- `docs/implementation/tool-executors.md`, `docs/implementation/layout-and-placement.md`,
  `docs/implementation/README.md` — `agentFacingArticle`, `anchorRootOf`
- `.agents/skills/hi-mcp-tools.md`, `.agents/skills/roomle-hi-concepts.md` (the range hood lists
  its docking vectors now; its size stays unknown), `.agents/skills/hi-authoring-rules.md`
- `.agents/backlog/roomle-ui-article-template-geometry.md` — closes with the work

## 8. Open questions

- Whether the word match of roomle-ui's `isCornerArticle` goes in this ticket (§4.2) or stays as a
  fallback for an article whose calculation fails. The analysis says it goes: a failed calculation
  is reported (G17), a wrong guess is not.
