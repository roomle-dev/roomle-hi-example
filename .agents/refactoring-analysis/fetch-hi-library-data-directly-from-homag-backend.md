> **Type**: Refactoring Analysis
> **Domain**: .agents/scripts, docs/library-information, .agents/skills
> **Trigger**: "The script .agents/scripts/fetch-hi-plan-context.js/.html is far too complicated. Its only purpose is to get the articles and the master data with backendId=HI_PRE_Roomle_Milestone_2, library=Furniture_Smith, userRight=Master, language=en. For this the script opens a complete Roomle planner, which is unnecessary. The resulting docs/library-information/hi-plan-context.json is not needed; only the articles and the master data are needed, in two separate JSON files. This data can be fetched directly from the HOMAG backend via the proxy server (https://dfscfgtest01-app.azurewebsites.net) using the libLoadArticleCatalog and libLoadMasterData implementation of roomle-ui (packages/embedding-lib/src/homag-intelligence/hi-requests.ts). Articles need to be filtered — only articles, not subArticles, are relevant (see loadPosData in packages/web-sdk/packages/homag-intelligence/src/glue-logic.ts). The script should generate an article.json and a master-data.json in docs/library-information. The skills hi-furniture-smith-article-catalog.md and hi-furniture-smith-materials.md need to be adapted."
> **Date**: 2026-09-28
> **Author**: AI Assistant
> **Status**: Done

> **Close-out (2026-09-28)**: Implemented on branch `refactor/fetch-hi-library-data-directly-from-backend`
> as analyzed. Open decisions resolved as recommended: `materialProviders` stripped, `{"articles": [...]}`
> wrapper kept, file names `article.json` / `master-data.json`. The `--all-from-context` flag of
> `extract-dominant-color-from-image.js` became `--all` (the "context" concept no longer exists).
> Verification: `fetch-hi-library-data.js` wrote both files (111 articles, 16 sub-articles filtered);
> `generate-article-catalog.js` reproduced `articles.md` with all 111 rows identical;
> `extract-dominant-color-from-image.js --all` reproduced `materials.md` with all 48 material rows,
> identical colors and SAS expiry date — only the intentional source-mention lines differ.

---

## Executive Summary

`fetch-hi-plan-context.js` + `fetch-hi-plan-context.html` spin up a local HTTP server
(port 3101), load a complete Roomle planner in the browser (embedding-lib, scene, kernel,
calc script), and wait for `roomDesignerApi.extended.getExternalObjectPlanContext()` just to
write the two sections that matter — `articles` and `masterData` — into
`docs/library-information/hi-plan-context.json` (1.2 MB, 26,562 lines, ~15 s per run,
browser required). The planner is pure overhead: the page already calls
`libLoadArticleCatalog` and `libLoadMasterData` (`hi-requests.ts:133–157`) during setup and
then reads the same data back out through the kernel.

The refactoring replaces the browser round-trip with a plain Node script (no dependencies,
Node 18 global `fetch`) that calls the same two HOMAG proxy endpoints directly and writes
two small files: `docs/library-information/article.json` (articles, sub-articles filtered
out) and `docs/library-information/master-data.json` (library master data).
`hi-plan-context.json`, the fetch HTML page, and the local server are removed; the two
generator scripts and the two skills are adapted to the new files.

**Verified, not assumed**: both proxy endpoints were called with `curl` and the responses
compared byte-level against the existing `hi-plan-context.json`. Result: identical content,
down to the same 111 articles, 47 modules, 398 attributes (the only differences are JSON
number formats such as `0` vs `0.0`). The refactoring is therefore a pure simplification
with no change in data.

---

## Current State

### What the fetch does today

```
fetch-hi-plan-context.js          serves fetch-hi-plan-context.html on :3101, opens browser
  ↓ browser loads full Roomle planner (scene HI_PRE_Roomle_Milestone_2, ~15 s)
  ↓ setupHi callbacks: libLoadArticleCatalog(), libLoadMasterData(), libLoadCalcScript()
  ↓ kernel consumes the data; onCompletelyLoaded fires
  ↓ getExternalObjectPlanContext() reads it back from the kernel
  ↓ POST /hi-plan-context → docs/library-information/hi-plan-context.json
```

The page loads a planner with WebGL scene, room geometry, kernel, and the library calc
script (`calc.js` — executed via blob import in the browser) only to write the *input* of
that machinery to disk. `rooms` and `groups` in the output are unused by every consumer.

### Who consumes hi-plan-context.json

| File | Uses | Needs after refactoring |
|---|---|---|
| `.agents/scripts/generate-article-catalog.js` | `articles` array → `articles.md` | `article.json` |
| `.agents/scripts/extract-dominant-color-from-image.js` | `masterData.Furniture_Smith.attributes` → `materials.md` | `master-data.json` |
| `.agents/skills/hi-furniture-smith-article-catalog.md` | documents the process | updated process |
| `.agents/skills/hi-furniture-smith-materials.md` | documents the process | updated process |
| `docs/library-information/materials.md` | mentions the file as source | updated mention |
| `fetch-hi-plan-context.js` / `.html` | producers | deleted |

Nothing else references the file (grep across the repo, excluding node_modules). `rooms` and
`groups` have no consumer at all.

---

## How the Data Is Actually Served

### The proxy request (hi-requests.ts, copied knowledge)

`libLoadArticleCatalog` / `libLoadMasterData` fetch via `fetchDataWithAuthorization`
(`hi-requests.ts:3–40`):

```
GET {baseUrl}{encodeURIComponent(url)}
headers:  Authorization: <authData>        (Basic, from the page)
          Accept-Language: <language>      (en)
          Content-Type: application/json
```

With the page's `serverOptions` (`fetch-hi-plan-context.html:73–80`) the concrete URLs are:

```
https://dfscfgtest01-app.azurewebsites.net/proxy_request?backendId=HI_PRE_Roomle_Milestone_2&url=api%2Fpos%2Flibraries%2FFurniture_Smith%2Farticles
https://dfscfgtest01-app.azurewebsites.net/proxy_request?backendId=HI_PRE_Roomle_Milestone_2&url=api%2Fpos%2Flibraries%2FFurniture_Smith%2FmasterData
```

Details verified against `createUrl` (`hi-requests.ts:122–130`):

- The path format is `api/pos/libraries/{libraryId}/{type}`. The legacy format
  (`api/pos/{type}?libraryId=…`, `LEGACY_URL_REGISTRY`) only applies when
  `serverOptions.subscriptionId` is set — the example page does not set it, so it never
  applied here.
- `subscriptionId`, `apiKey`, `endpointUrl` query parameters are absent because the page's
  `serverOptions` does not define them.
- The whole relative path is `encodeURIComponent`-encoded (slashes included) after
  `&url=`; the proxy decodes it.

### The article filter (glue-logic.ts:482–503, copied knowledge)

`loadPosData` is the kernel's article-catalog preparation:

```ts
if (articleCatalogJson?.articles) {
  articleCatalogJson = articleCatalogJson.articles;   // response is wrapped in { articles: [...] }
}
articleCatalogJson.forEach((posDataGroup) => {
  const articleId = posDataGroup.id || posDataGroup.articleId;
  const posArticle = deepCopy(posDataGroup);
  posArticle.libraryId = libraryId;
  if (posArticle.isConfigDummy) {
    this._posSubArticleMap.set(articleId, posArticle);   // sub-articles (config dummies)
  } else {
    this._posArticleMap.set(articleId, posArticle);     // real articles
  }
});
```

For the new script this reduces to: unwrap `.articles`, **drop every article with
`isConfigDummy === true`** (sub-articles), keep the rest. `libraryId` and `catalog` are
already present on every article in the backend response (verified), so no rewriting is
needed; the script filters only.

### `userRight=Master` is not a request parameter

`userRight` configures the planner UI (`externalObjectSettings.uiConfiguration.userRight`,
`fetch-hi-plan-context.html:105`); it is **not** sent to the backend — neither as header
nor as query parameter (`hi-requests.ts` has no `userRight`). The backend returns all 398
attributes with their per-attribute `userRight` fields, and the old
`getExternalObjectPlanContext()` master data was equally unfiltered. **Consequence:** the
direct fetch needs no userRight handling; `master-data.json` automatically contains the
same data the old path produced. The skills should keep documenting `Master` as the
relevant user right for interpreting the attributes.

---

## Verification (executed 2026-09-28)

Both endpoints were called with `curl` (Basic auth, `Accept-Language: en`) and the
responses compared against `docs/library-information/hi-plan-context.json`:

| Check | Result |
|---|---|
| Articles HTTP status / size | 200, 190 KB, wrapped in `{ articles: [...] }` |
| Articles total / `isConfigDummy` | 127 total, 16 sub-articles → **111 articles**, same ID set as plan context |
| Article content | identical for all 111; only `articlePos` number format differs (`0` backend vs `0` int in plan context — numerically equal) |
| Master data | 200, 684 KB, `{ modules, attributes, materialProviders }` |
| Modules | 47, **identical** to plan context |
| Attributes | 398, identical except number formats in `selections[].value/min/step/max` (`0.0` vs `0` — numerically equal) |
| `materialProviders` | present in backend response, absent in plan context (kernel stores it as a Map, which the plan-context deep copy deletes) |

The generated `articles.md` (columns: id, category, label, dimensions, image, description,
suggested description) and `materials.md` depend only on values that are identical, so both
generators produce the same output from the new files. The material thumbnail SAS URLs
(HOMAG CDN, ~1 month validity) come from the same `selections[].imageUrl` fields and keep
their existing expiry behavior.

---

## Target State

### New script: `.agents/scripts/fetch-hi-library-data.js`

Plain Node 18 script (ES module, no dependencies, consistent with the JavaScript-only rule
for `.agents/scripts/`). Roughly 60 lines:

```
constants: BACKEND_ID, LIBRARY_ID, LANGUAGE, AUTH (Basic …), PROXY_BASE_URL
fetchLibraryData(type)   → GET proxy_request?backendId=…&url=api/pos/libraries/Furniture_Smith/{type}
                           with Authorization + Accept-Language + Content-Type headers
articles = response.articles.filter(article => !article.isConfigDummy)
write docs/library-information/article.json     (pretty-printed, filtered articles)
write docs/library-information/master-data.json (master data, see decision below)
print both paths and the article count
```

Run time drops from ~15 s (browser + full planner) to two HTTP requests (< 5 s), no
browser, no local server, no port, headless-safe, CI-friendly.

### Outputs

- `docs/library-information/article.json` — the 111 articles (sub-articles filtered out),
  same article objects as before (`articleId`, `articleName`, `desc`, `imageUrl`,
  `category`, `roots`, …)
- `docs/library-information/master-data.json` — the library master data. Shape decision
  (see below): `{ modules, attributes }` (plan-context parity) or the raw response
  additionally containing `materialProviders`.

### Removed

- `.agents/scripts/fetch-hi-plan-context.js`
- `.agents/scripts/fetch-hi-plan-context.html`
- `docs/library-information/hi-plan-context.json`

### Adapted

- `generate-article-catalog.js` — input path `article.json`, `const { articles } = …`
  stays (the new file could also be the bare array; keeping `{ articles }` is the smaller
  diff — decision below)
- `extract-dominant-color-from-image.js` — input `master-data.json`; read
  `attributes` directly instead of `masterData.Furniture_Smith.attributes`
- `.agents/skills/hi-furniture-smith-article-catalog.md` — new data flow, no planner
  step, `article.json`/`master-data.json` as sources, troubleshooting without browser
  section, remove the HiPlanContext JSON-structure section, keep the column mapping and
  the suggested-description rules (unchanged logic)
- `.agents/skills/hi-furniture-smith-materials.md` — same input change
- `docs/library-information/materials.md` — regenerated mention of the source file

---

## Open Decisions

1. **`materialProviders` in master-data.json.** The backend response contains it
   (`hc`, `hi`); the old plan-context file did not (kernel Map, deleted by deep copy). No
   consumer uses it. **Recommendation: strip it** — parity with the old data, smaller
   file, and consumers (materials skill) only need `attributes` and `modules`.
2. **article.json wrapper.** `{"articles": [...]}` (smaller diff in
   `generate-article-catalog.js`, mirrors the backend response) or a bare array. The
   trigger says "article.json" (singular name, content plural). **Recommendation: keep the
   `{"articles": [...]}` wrapper and the name `article.json` as requested.**
3. **Credentials.** `Basic test:6mABjMDnEq4tvaN` moves from the HTML page into the Node
   script. Same repo, same test credential, no new exposure — but the script now fails
   closed without it; keep it a constant at the top like the page did.

## Risks

- **Proxy availability.** The script depends on `dfscfgtest01-app.azurewebsites.net`
  being up (the old path depended on it too — the page fetched through the same proxy —
  plus on the Roomle scene server; the dependency surface shrinks).
- **Backend URL scheme drift.** If HOMAG migrates the subscription to the legacy URL
  format, the endpoints change. Mitigation: both URLs are constants in one place in the
  script; the legacy registry in `hi-requests.ts` never applied to this setup (no
  `subscriptionId`).
- **No planner-side validation anymore.** The old path implicitly proved the library
  loads and calculates (calc.js executed). The new path fetches data only — acceptable,
  since the artifacts being generated are pure reference data, and the actual planner
  usage is covered by the example page.
- **Number formatting.** Backend floats (`0.0`) vs plan-context ints (`0`) are the only
  content differences; all consumers stringify or compare values, none are affected.

## Definition of Done

1. `node .agents/scripts/fetch-hi-library-data.js` writes both files without browser or
   local server
2. `node .agents/scripts/generate-article-catalog.js` produces `articles.md` identical to
   the current one (111 articles, same rows)
3. `extract-dominant-color-from-image.js` produces `materials.md` with the same materials
4. The three old files are deleted, no dangling reference to `hi-plan-context.json`
   remains (grep)
5. Both skills describe the new process
6. Analysis document status updated
