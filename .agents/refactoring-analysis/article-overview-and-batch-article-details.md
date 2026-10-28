# The article catalog the agent reads: shortened descriptions, article details by id, and discovery for large libraries

| Field | Value |
|---|---|
| Type / domain | Refactoring analysis / HI Planning Assistant performance — §7.2 of [the remaining-work analysis](planning-assistant-performance-next-steps.md#72-supply-useful-article-summaries-retrieve-details-in-batches-and-scale-discovery-separately) |
| Status | Open — analysis only, no productive implementation |
| Date / author | 2026-10-28 / Claude |
| Ticket | [RML-18303](https://roomle.atlassian.net/browse/RML-18303) |
| Backlog | [117 — The catalog serves 19 descriptions in full](../backlog/mcp-issues.md#117-the-catalog-serves-19-descriptions-in-full) |
| Base | roomle-hi-example `80ade44` (master); roomle-ui `471345046` (`feat/hi-mcp-performance`) |
| Evidence | The code at the base; the catalog capture of benchmark 09 (`.temp/result/benchmark-09-az-attrs-2026-10-28/probe/articles.json`, 111 articles, SHA-256 `3e3b77b5…0667e6`) and its offline probes (`.temp/rml-18303-analysis/catalog-probe.mjs`); the two October 28 baselines; D63, D74, D122 |
| Scope | Analysis only. No model run, no deployment, no embedding-lib build |

Affected repositories:

- **roomle-ui**, branch `feat/hi-mcp-performance`: the agent-facing catalog projection (`hi-mcp/agent-facing.ts`), the `get-plan-context` executor (`hi-mcp/tool-executors.ts`), the served text and the schema of `get-plan-context` (`hi-mcp/hi-mcp-server.ts`), the tool fixture, the unit tests, and the behaviour, tool and executor references in `.agents/homag-intelligence/`. The planner API, `glue-logic.ts`, the planning assistant and the library stay as they are.
- **roomle-hi-example**: this analysis and its index rows, the responsible cell of backlog item 117, the tool skill `.agents/skills/hi-mcp-tools.md`, and later the benchmark reports of the comparative screen. The pinned embedding-lib stays: every step is a planner change and reaches the example with the planner at its server URL.

## 1. Conclusion and recommendation

§7.2 of the parent analysis bundles three things of different value. The first is a defect, the second a gap of the tool API, the third a scaling measure without a measured latency benefit for the library of the baselines.

1. **The description shortening misses the inline form.** `shortDescription` takes a section's text from the line after its name only. 19 of the 111 descriptions of the captured catalog write the section on one line — the form the [suggested library changes](../../docs/library-information/suggested-library-changes.md) use for every proposed text —, so the catalog serves them in full: 11,323 bytes of the 116,454-byte article array, about 2,400 tokens of every request's cached prefix. The defect grows with every suggested description the library adopts. The fix is one regular expression and its tests (§4.1).
2. **A question about one article costs every description.** `get-plan-context` selects sections, not articles: `articleDescriptions` returns the full descriptions of all 111 articles. Three served sentences send the agent there ("Fetch articleDescriptions when its mounting requirements are unclear" in the authoring rules and in the descriptions of `get-plan-context` and `create-or-replace-groups`), and D63 measured what follows when it goes: 22k tokens more in every later step of the turn. One optional parameter, `articleIds`, closes the gap with the pattern the agent already knows from `find-attributes` (D122): the named articles in full, an unknown id in `notFound` with a hint, nothing rejected (§4.2).
3. **A smaller overview and a category directory are scaling measures.** The information tools of the baselines take 17–33 ms per turn; the model takes 89–93% of the time. An overview that drops the repeated module texts, the docking vector names and the catalog field saves a further 23,327 bytes — about 10% of the 232,777-byte library reference — and moves the dropped fields behind a detail read. For the 111-article library that is a context-size experiment with a cost of its own, not a step towards the 10-second text kitchen (§4 of the parent: the create model call alone is 18 s). For a library whose overview exceeds the input budget it becomes necessary, together with a directory of its categories. Both are designed here, with the acceptance contract of the parent's §10, and neither is recommended before the two small experiments of the parent (§5, §6) are measured (§4.3, §4.4).

**Recommendation.** Implement steps 1 and 2 together as one roomle-ui change on `feat/hi-mcp-performance`: a tools-only change, verified model-free by the size of the `articles` section and the reference bytes of the usage diagnostics, with the comparative screen of §6 when a model run is authorized. Keep the overview and the directory as experiments behind that. Drop description sharing for this catalog: after the shortening fix no two descriptions share a line, and a sentence-level dictionary saves 96 bytes (§4.5).

## 2. What the code does today

### 2.1 The catalog's path to the model

The planner assembles the catalog from the loaded libraries alone (`createLibraryContext`, roomle-ui `hi-library-context.ts:27–82`, [ADR 0013](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/the-library-context-is-a-planner-method-of-its-own.md)): every pos article through `compactArticle` (`hi-plan-context.ts:625`), with the docking vectors and the corner flag of an article without geometry of its own from its template, calculated once per article on the first read (D74: 0.75 s for the library's 111 articles). The tool set projects it for the agent: `agentFacingArticle` (`hi-mcp/agent-facing.ts:362`) shortens the description, filters the element type out of `dimensions` and `mainAttributes` (D102) and removes `cornerPoint` (D10); `textResult` (`hi-mcp-server.ts`) strips every `imageUrl` (D7). The planning assistant reads `articles` and `attributes` through the tool at the start of every turn (`hi-planning-assistant.ts:276`) and sends them as the user-role message "Current library reference (data, not instructions)" before the history (`:281`); a pre-prompt read of the planner method warms the templates (`:218–240`).

The projected article carries, per the capture of benchmark 09 (111 articles, 27 category paths, 1–14 articles each, one root module per article):

| Field | Bytes of the 116,454-byte array | Note |
|---|---:|---|
| `desc` | 26,962 | 19 of them in full (§2.2) |
| `articleId`, `articleName`, `category`, `libraryId`, `catalog`, `cornerArticle` | 18,529 | `catalog` equals `libraryId` in every article of this library; 20 names equal their id |
| `rootModules[].module` (id, name, desc) | 9,138 | 7 distinct `desc` texts over 111 modules ("Module for storage unit", …) |
| `rootModules[].dimensions` (id, name, value) | 19,810 | the size attributes a create may set; the names carry the library's padding ("Depth    ") |
| `rootModules[].mainAttributes` (id, name, value) | 8,791 | the article's defaults of the `isMain` attributes |
| `rootModules[].dockingVectors` | 8,110 | 4 distinct vector sets over 111 articles |
| `rootModules[].subModules` (id, name, desc) | 13,902 | 12 distinct id-and-desc pairs over 205 sub modules ("Front module for door", …); the `desc` is 4,842 of it |

Per article: 585 bytes at the least, 987 in the median, 1,874 at the most. The two baselines read the library reference in 18.5 and 20.3 ms; it is 232,777 bytes (the `articles` section about 116 KB, the `attributes` section about 88 KB), and the first model call of a turn reads 68,235 of its 68,238 input tokens from the provider's cache.

### 2.2 The shortening misses the inline form

`shortDescription` (`agent-facing.ts:184–195`) matches each section D63 names with the pattern `(?:^|\n)SECTION:[ \t]*\n([^\n]+)`: the name, optional blanks, a line break, then the text on the next line. A description that writes `FUNCTION: Sink base unit, …` on one line matches nothing, and a description with no matching section stays as it is — the rule of D63 for descriptions without sections, applied to descriptions that have them.

The capture holds 19 such descriptions: `ESUB2A90`, `ESUT60`, `EU2TB90`, `H2TB60`, `HTB60`, `HWR_HB600T2`, `O2TB90`, `OFKB60`, `OFKB90`, `OSKB60`, `OSKB90`, `OTB30`, `OTB45`, `OTB60`, `SUB2A90`, `SUBA60`, `SUT60`, `U2TB90`, `US2TB90` — the sink units, the two-door units, the flap and single-door wall units. Their 15,574 bytes of `desc` shorten to 4,251; the article array shrinks from 116,454 to 105,131 bytes. The inline form is the form of every text in `docs/library-information/suggested-library-changes.md`, so the share of full descriptions in the catalog grows as the library adopts them. The library's format is legitimate (D63 names the sections, not their layout); the fix is the tools'. The three existing tests of `describe('article descriptions')` (`__tests__/hi-mcp/tool-executors-test.ts:607–660`) cover the next-line form and a description without sections only.

### 2.3 The tool selects sections, not articles

The `get-plan-context` executor (`tool-executors.ts:483–580`) knows eight sections. `articleDescriptions` is built as `articles.map(({ articleId, desc }) => …)` (`:556`) — every article. There is no way to ask for the catalog entry or the description of one article or of a set. The served text tells the agent to go there in three places: `MOUNTING_GUIDANCE` (`hi-mcp-server.ts:12–16`, the last sentence) opens the authoring rules and the descriptions of `get-plan-context` and `create-or-replace-groups`; the `get-plan-context` description says that `articleDescriptions` "answers a question about one article, not the planning" (`:375–377`), and its `include` description "articleDescriptions for a question about one article's requirements and neighbours" (`:392–393`). An agent that follows the sentence for one article receives about 30 KB (the 26,962 bytes of descriptions plus the ids) into the history of the turn.

### 2.4 The attribute vocabulary is derived from the projected articles

`agentFacingAttributes(masterData, articles)` (`agent-facing.ts:324`) decides which value lists the `attributes` section carries from the articles it is given: `createAttributeIds` (`:298`) reads the ids of `mainAttributes` and `dimensions` of every catalog root module and tells the generated root modules from the catalog's by the module ids (D122). The executor calls it with `result.articles` after the projection (`tool-executors.ts:563–571`). Today the projection keeps those fields, so the eligibility is right. Any projection that drops `mainAttributes` or `dimensions`, or any filter that leaves articles out, changes the vocabulary unless the derivation moves before it and reads the planner's full list. This is the trap the parent names in §7.2.2; the code order makes it concrete.

### 2.5 Two contracts that stay

- `HiLibraryContextOptions.articleIds` (roomle-ui `external-object-api.ts:231–239`) selects the articles whose templates the planner calculates; the result holds every article (`hi-library-context.ts:52–63`, guarded by `it('calculates only the requested articles when the caller names them')` and `it('ignores an unknown article id in the selector')` in `__tests__/hi-library-context-test.ts`). A filter of the agent's result is a different thing and lives in the tools.
- The create reads the full catalog itself: `hi-tool-commands.ts:532` fetches `articles` from the planner and `resolveArticleIds` (`hi-tool-ids.ts:68`) resolves every pick; a root whose id matches nothing is dropped into `notLoaded`. What the agent sees of the catalog does not change what the planner builds, as long as the agent sees every `articleId`.

### 2.6 Why it is a problem

- Every request of every turn carries about 2,400 tokens of description text the agent is not meant to read for a planning, and the share grows with the library's adoption of the suggested descriptions. Cached tokens still occupy the model's context.
- The one way to learn more about an article costs the whole catalog's descriptions and keeps them in the history; D63 measured 22k tokens more per later step when an agent took that way. The served text invites the way without offering a narrower one.
- The agent-facing catalog cannot shrink safely: the vocabulary's eligibility hangs on the projected list.
- For a library several times the size of this one, the reference grows linearly with the articles and nothing in the API lets the agent discover a part of the catalog.

## 3. Scope of the change

Paths are roomle-ui paths; `HI = packages/web-sdk/packages/homag-intelligence`.

| Location | Change | Step |
|---|---|---|
| `HI/src/hi-mcp/agent-facing.ts:184–195` `shortDescription` | reads a section's text on the line of its name or on the next line, CRLF alike | 1 |
| `HI/src/hi-mcp/tool-executors.ts:483–580` `get-plan-context` | the `articleIds` argument: filters `articles` and `articleDescriptions`, implies them when `include` names no catalog section, names unknown ids in `notFound` with a `hint`; derives `attributes` from the planner's full article list before the filter and the projection | 2 |
| `HI/src/hi-mcp/hi-mcp-server.ts:12–16` `MOUNTING_GUIDANCE`, `:333–396` the `get-plan-context` description and schema | the `articleIds` parameter (non-empty strings, S6); the sentences that send the agent to `articleDescriptions` name `articleIds` | 2 |
| `packages/web-sdk/packages/test-helpers/unit/hi-mcp-fixture.json` | the served text and schema of `get-plan-context`, rewritten from `createHiMcpTools` | 2 |
| `HI/__tests__/hi-mcp/tool-executors-test.ts:607–660` `describe('article descriptions')`, `:248` `describe('get-plan-context')`, `:683` `describe('attribute vocabulary')` | the tests of §5 | 1, 2 |
| `HI/__tests__/hi-mcp/hi-mcp-server-test.ts:103`, `:911` | the served-text tests follow the new sentences; a schema test for `articleIds` | 2 |
| `.agents/homag-intelligence/hi-tools-behaviour.md` §3 (D63, a new decision), §5.4, §6 `get-plan-context`, §8.6 S6, §8.1 feedback | the behaviour of the parameter and the shortening | 1, 2 |
| `.agents/homag-intelligence/hi-tools-reference.md:30–135` `get-plan-context`, `.agents/homag-intelligence/tool-executors.md:96–110` | the parameter, the result fields, the executor steps | 2 |
| `HI/src/hi-mcp/agent-facing.ts:362` `agentFacingArticle` and the `articles` description | the overview shape of `articles` without `articleIds` — only if the experiment of §4.3 is adopted | 3 |
| `HI/src/hi-mcp/tool-executors.ts`, `hi-mcp-server.ts` | a `categories` section and filter and a text search over the catalog — only for a library that needs it (§4.4) | 4 |

Untouched: `glue-logic.ts` (D110), `hi-library-context.ts` and `external-object-api.ts` (the planner API and the meaning of its `articleIds` option), `hi-planning-assistant.ts` (the reference stays `['articles', 'attributes']`), the planning skills, the library's descriptions and calculation.

In roomle-hi-example: this document and its rows in `.agents/refactoring-analysis/README.md` and `.agents/README.md`; the responsible cell of backlog item 117; `.agents/skills/hi-mcp-tools.md` once the parameter exists; the benchmark reports of §6 when the screen runs.

## 4. Target shape

### 4.1 Step 1 — the shortening reads both forms

A section's text is the rest of its heading line when the heading line carries text after the colon; otherwise the first following line that is not empty. The pattern `(?:^|\n)SECTION:[ \t]*(?:\r?\n)?([^\r\n]+)` reads both forms and tolerates CRLF; the probe used it to produce the 105,131-byte figure. The sections stay the two of D63, `FUNCTION` and `AI_SELECTION_HINT`; a description with neither section stays as it is; `articleDescriptions` keeps the full text. Expected output: the catalog line of `SUT60` is its `FUNCTION` and `AI_SELECTION_HINT` text and holds no `PURPOSE:`; the `articles` section of the captured catalog is 11,323 bytes smaller.

### 4.2 Step 2 — article details by id

`get-plan-context` takes an optional `articleIds: string[]` (non-empty strings; S6 extends to it). Its contract:

- **It scopes the catalog sections.** `articles` and `articleDescriptions` hold the named articles only, in the order of the ids, as `find-attributes` orders its `ids` (D122). The other sections are untouched by it.
- **It implies the catalog sections.** When `include` names neither `articles` nor `articleDescriptions`, the result carries both for the named articles — the way `obstacles` fetches `rooms` it was not asked for. `{ "articleIds": ["SUT60"] }` alone answers "what is this article, what does it need, what stands next to it".
- **An unknown id is answered, not rejected.** The known ids are returned; the unknown ones are listed in `notFound`, and the `hint` says "No article has the id "…" - the ids are in the articles section of get-plan-context." — the wording of `find-attributes` (`tool-executors.ts:655–662`). A call whose ids are all unknown returns empty sections with the hint; the intent is clear, so nothing fails ([Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort), step 4).
- **The vocabulary ignores the filter.** `attributes` is derived from the planner's full article list before any filter or projection (the order of §2.4 reversed), so a call with `articleIds` and `attributes` lists the same value lists as a call without, and the D122 eligibility never depends on what the agent asked to see.
- **The planner option stays what it is.** The executor filters the planner's result; it does not pass the agent's ids as `HiLibraryContextOptions.articleIds`. A cold planner calculates all templates once on the first read, as today (0.75 s for 111 articles, D74); the assistant's pre-prompt read pays it before the first prompt.

The served text names the parameter where it sends the agent to the descriptions today, shorter than before:

- `MOUNTING_GUIDANCE`: "Fetch articleDescriptions with articleIds for an article whose mounting requirements are unclear."
- The `get-plan-context` description: "articleDescriptions (per article its full description: purpose, placement, requirements, neighbours, restrictions, style) is returned only when included explicitly; name the articles in articleIds - it answers a question about those articles, not the planning."
- The `include` description: "… articleDescriptions with articleIds for a question about an article's requirements and neighbours - desc is enough to pick the articles of a planning."
- The schema description of `articleIds`: "Article ids: restricts articles and articleDescriptions to these articles, several in one call; without a catalog section in include, returns both for them."

The authoring rules change nothing but the `MOUNTING_GUIDANCE` sentence they open with. Both chats send the tool description in their tool list, so the agent learns of the parameter without fetching the rules. The behaviour reference gets a decision row (the next number after D123): the catalog sections by `articleIds`, the implied sections, `notFound` and the hint, the vocabulary from the full list, the planner option untouched; D63's row names the two description forms and that `articleDescriptions` answers for the named articles. Rejected there: a tool of its own for the details — ADR 0013 keeps the tool list for a change of what the agent can select, and `find-attributes` with `ids` is the pattern the agent knows; the agent's ids passed as the planner option — the option selects templates and its result holds every article.

### 4.3 Step 3 — an overview as the catalog's default shape (experiment)

With `articleIds` in place, `articles` can take two shapes under one rule: the overview for the whole catalog, the full entry for the articles the agent names. The overview keeps `articleId`, `articleName`, the short `desc`, `category`, `libraryId`, `cornerArticle`, and per root module `module` (id, name), `dimensions`, `mainAttributes` and `subModules` (id, name). It drops `catalog` (equal to `libraryId` here, and the group payload needs `libraryId`), the `desc` of the module and of the sub modules (7 and 12 distinct texts repeated 111 and 205 times), and `dockingVectors`. On the shortened capture: 105,131 → 81,804 bytes (−23,327, about 6,000 tokens at the 3.8 bytes per token of D122's measurement); keeping `dockingVectors` leaves 91,912.

Conditions before it is adopted:

- `merge-article-into-group` asks the agent for the new article's own vector name (`dockTo.dockingVector`, `hi-mcp-server.ts:773–800`). The authoring rules give the mapping (a free `LeftBottom` takes the new root's `RightBottom`) and the capture has 4 distinct vector sets, so the agent can write it without the catalog; but an article with other vectors would need a detail read first. Either the overview keeps `dockingVectors` (−13,219 bytes instead of −23,327), or the server derives `dockingVector` from `ownDockingVector` when it is omitted — a tool API simplification of its own, not part of this analysis.
- A second library decides whether sub module names carry what their descriptions carry; the capture's do ("Doors", "Drawer", "Sink", "Hob", "Fridge", "Oven"), another library's may not. The rule is the same for every library; what a library loses goes into its article description (§2.4 of the behaviour reference).
- The D122 eligibility is unaffected by construction once §4.2 derives it from the full list.
- The assistant's include stays `['articles', 'attributes']`; the shape change comes with the planner, nothing in the assistant changes. The served `articles` description names the overview and that `articleIds` returns the full entries.

The parent's §10 row "Article overview + batch details" is the acceptance: a smaller stable prefix, the layout constraints present, no compulsory lookup before the first kitchen, the same final quality, both milestones measured. The numbers above are byte counts of one capture, not tokens or seconds, and a 10% smaller reference is no measured gain: the information reads of the baselines take milliseconds, and the model time §4 of the parent bounds does not move with them in any measured way.

### 4.4 Step 4 — a directory for a library the overview cannot hold (design, deferred)

For a library whose overview exceeds a measured input budget, discovery replaces the full overview: a `categories` section — per library every category value as the library writes it, with its article count, and the count of articles without a category —, a `categories` filter on the catalog sections beside `articleIds`, and a text search over `articleId`, `articleName`, `desc` and `category` in the manner of `find-attributes` (every word, case-insensitive, the spelling pairs of D64), capped with a `total` and a hint. Categories are navigation: an `articleIds` request is answered whatever the category, a search runs over the whole library, and a request that names several categories is one call. The directory makes D63's objection to category filtering — the agent would have to know the category before it reads the catalog — moot, but D63 stays in effect until a measurement on representative data decides otherwise; the trigger is a measured budget, never a library name or an article count written into the code. Nothing of this is built for the 111-article library.

### 4.5 Not proposed

- **Description sharing.** All 111 whole descriptions are distinct. After the shortening fix no line repeats; a dictionary of repeated sentences saves 96 bytes of the 105,131. The repetition of the catalog sits in the module and sub module texts (7,583 bytes), which the overview drops. A shared-passage format adds indirection for the model and a contract of its own; the parent's §7.2.5 keeps it for a library whose shortened descriptions still repeat, measured there.
- **A tool of its own** for the article details, a per-article call, or a tool per category — one read with a filter serves the batch.
- **A change of the planner API or of `glue-logic.ts`** — the tools select and project; the planner's catalog and the create's resolution stay (D110, ADR 0013).
- **A change of the library's descriptions or format** — the inline form is the library's convention; the tools read it.
- **Passing the agent's `articleIds` to the planner option** — see §4.2.

## 5. Tests and the output changes to expect

### 5.1 Existing tests that cover the behaviour

| Test | File | Covers |
|---|---|---|
| `describe('article descriptions')` — three tests | roomle-ui `HI/__tests__/hi-mcp/tool-executors-test.ts:607–660` | the next-line form shortens; a description without sections stays; `articleDescriptions` carries the full text and `articles` the short one |
| `describe('get-plan-context')` — the default, explicit, unknown and empty `include` | `tool-executors-test.ts:248–470` | which planner sections each `include` fetches; unchanged |
| `describe('attribute vocabulary')`, `describe('the values of the attributes a planning sets at the create')`, `describe('by ids')` | `tool-executors-test.ts:683…` | the D122 eligibility from the catalog, `find-attributes` with `ids`, `notFound` and the hint |
| `it('explains mounting from library descriptions and continuing a wall row')`, `it('tells the agent that desc suffices to pick an article and what articleDescriptions is for')` | `HI/__tests__/hi-mcp/hi-mcp-server-test.ts:103`, `:911` | the served sentences of §2.3; they follow the new wording |
| `it('serves the tools of the server with their names, descriptions and input schemas')` | `HI/__tests__/hi-mcp/hi-mcp-fixture-test.ts` | the fixture; rewritten from `createHiMcpTools` |
| `describe('article templates')` — the `articleIds` option | `HI/__tests__/hi-library-context-test.ts:152–300` | the planner option keeps its meaning; unchanged |
| `it('places one current library reference before successful history …')`, the pre-prompt read tests | roomle-ui `tests/unit/embedding-lib/homag-intelligence/hi-planning-assistant.spec.ts:307`, `:908–995` | the assistant's reference and warm-up; unchanged by steps 1–3 |

### 5.2 Tests to add

Step 1, in `describe('article descriptions')`: a description with every section on the line of its name shortens to its `FUNCTION` and `AI_SELECTION_HINT` text; a description that mixes both forms; CRLF line ends; a heading with no text on its line and none on the next keeps the description; `articleDescriptions` still carries the full inline description.

Step 2, in `describe('get-plan-context')`: `articleIds` with `articles` returns the named articles in the order of the ids; with `articleDescriptions` the named descriptions; alone, both sections for the named articles and nothing else from the planner's plan context; an unknown id among known ones answers the known ones with `notFound` and the hint; all ids unknown answers empty sections with the hint; `attributes` with `articleIds` lists the same value lists as without — a catalog whose named article carries none of the `mainAttributes` the others carry proves the full-list derivation. In `hi-mcp-server-test.ts`: `articleIds` of empty strings is a schema error (S6); the three served texts carry the new sentences and name `articleIds`; the fixture test follows.

Step 3, if adopted: the overview drops the named fields and keeps the rest; a named article comes in full; the vocabulary is unchanged by the overview.

### 5.3 Output changes to expect

| Where | Before | After |
|---|---|---|
| `articles[].desc` of the 19 inline-form articles | the whole description | `FUNCTION` and `AI_SELECTION_HINT` text — the `articles` section 11,323 bytes smaller on the captured catalog |
| `articleDescriptions` | every article | every article without `articleIds`; the named articles with it |
| `articles` | every article | every article without `articleIds`; the named articles with it |
| the result | — | `notFound` and `hint` when an id is unknown |
| the `get-plan-context` schema and three served texts | section-only | the `articleIds` parameter and the sentences of §4.2; the fixture follows |
| the library reference of the assistant | 232,777 bytes in the baselines | about 11 KB smaller after step 1; unchanged in structure by step 2 |

## 6. Benchmark

**Model-free, for steps 1 and 2.** On the example page against a local dev server of roomle-ui `feat/hi-mcp-performance`, call `get-plan-context` with `['articles']` through `instance.extended.callExternalObjectAgentTool` and record the section's bytes before and after the change: the capture predicts 116,454 → 105,131. Then one turn of the assistant, recorded by the usage diagnostics: `reference.bytes` and its SHA-256 (`describePayload`, `hi-planning-usage.ts:97`) and the first call's input tokens, against the baselines' 232,777 bytes and 68,238 tokens. A call with `articleIds` for the ten article ids of the walnut baseline's create against the full `articleDescriptions` gives the bytes the parameter saves for that question (the probe: 10,430 bytes for the ten articles against the whole catalog).

**The comparative screen**, when a model run is authorized (no run is part of this analysis): the contract of the parent's §10 — the two October 28 baselines as the historical reference, a contemporaneous control, two fixtures × two repetitions × control and candidate, `gpt-6-astra` on Azure with `$AZURE_GPT_KEY`, the same plan, prompts and image, interleaved order, fresh sessions, both repository SHAs and the loaded module URLs recorded; about 7–8 minutes and 3.28M input tokens per candidate, most of them cached. Structural acceptance for steps 1 and 2: no planning turn requests `articleDescriptions` without `articleIds`; the same article ids in the creates; the reference bytes smaller by the shortening. Timing: both milestones within the baselines' spread — the steps claim no seconds. Step 3 takes the §10 row "Article overview + batch details"; step 4 the row "Directory-first catalog", on a representative larger library. The report goes to `.agents/benchmarks/` in the layout of the baselines, per [the timing benchmark skill](../skills/hi-mcp-timing-benchmark.md).

## 7. Risks and open items

- **The agent writes an id the catalog does not have.** The hint names where the ids are; the create's own `notLoaded` path handles the same case there. No new guard.
- **The implied sections surprise a caller that filters nothing.** `articleIds` without a catalog section implies both; a caller that wants the catalog entries only names `articles`. The schema description says so.
- **A projection change changes the vocabulary.** Closed by deriving `attributes` from the full list before the filter (§4.2), guarded by the test of §5.2.
- **The overview loses a field a library needs.** Open until a second library is projected; the vector names are the known case (§4.3).
- **The served sentence steers too far.** An agent that fetches details for every article it picks adds a round before the create. The sentences name "an article whose mounting requirements are unclear" and keep "desc is enough to pick the articles of a planning"; the screen counts the detail reads.
- **The planner that serves the example.** A tools change is a planner (web-sdk) change: the example gets it with the bo-test deployment or a local dev server, not with an embedding-lib build.

## 8. Documents the work updates

roomle-ui, in the same change: `.agents/homag-intelligence/hi-tools-behaviour.md` (D63, the new decision, §5.4, §6, §8.1, §8.6), `hi-tools-reference.md` (`get-plan-context`: the parameter, `notFound`, `hint`), `tool-executors.md` (the executor's steps). roomle-hi-example: `.agents/skills/hi-mcp-tools.md` (the parameter), backlog item 117 (closed by step 1, its row leaves the backlog when the fix is in the code), and this analysis closed out by ["cleanup analyses"](../skills/hi-analysis-cleanup.md) once steps 1 and 2 have landed — the overview and the directory keep their own rows in the parent analysis until they are measured or dropped.
