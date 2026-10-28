# The article catalog in three levels: an overview the agent plans from, details by article id, and discovery for a large library

| Field | Value |
|---|---|
| Type / domain | Refactoring analysis / HI Planning Assistant performance — §7.2 of [the remaining-work analysis](planning-assistant-performance-next-steps.md#72-supply-useful-article-summaries-retrieve-details-in-batches-and-scale-discovery-separately), as a whole |
| Status | Open — analysis only, no productive implementation |
| Date / author | 2026-10-28 / Claude |
| Ticket | [RML-18303](https://roomle.atlassian.net/browse/RML-18303) |
| Base | roomle-hi-example `6ffed32` (master); roomle-ui `da0f50b80` (`feat/hi-mcp-performance`) |
| Evidence | The code at the base; the library data of four HI libraries read from the HOMAG test proxy on 2026-10-28 — Furniture_Smith (`docs/library-information/article.json`, SHA-256 `4bad0aa9…8941`), nobilia_Minifabrik, DeMaatFabriek_CabinetLibrary and cabinet_ts — projected offline with the rules of `compactArticle` and `agentFacingArticle`; the two October 28 baselines and benchmark 11; D63, D74, D76, D122 |
| Scope | Analysis only. No model run, no deployment, no embedding-lib build |

Affected repositories:

- **roomle-ui**, branch `feat/hi-mcp-performance` — stage 1, the planner's tools: the catalog projection (`hi-mcp/agent-facing.ts`), the `get-plan-context` executor and a new `find-articles` executor (`hi-mcp/tool-executors.ts`), the tool registrations and the served text (`hi-mcp/hi-mcp-server.ts`), the system prompt (`hi-agent-prompts.ts`), the counterpart vector of `merge-article-into-group` (`hi-tool-docking.ts`), the tool fixture, the unit tests, and the behaviour, tool and executor references in `.agents/homag-intelligence/`. Stage 2, the planning assistant of the embedding-lib (`packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts`): the library reference as the overview or as the category directory, by a budget of the host; its spec, `prompt-caching.md`, `agent-architecture.md` and ADR 0014. The planner API (`external-object-api.ts`, `hi-library-context.ts`), `glue-logic.ts`, the planning skills and the library stay as they are.
- **roomle-hi-example**: this analysis and its index rows; `.agents/skills/hi-mcp-tools.md` (the three levels, `find-articles`); `docs/ai-chat.md` (the budget option of the assistant); the wiki row on selective retrieval; the benchmark reports of §6. The pinned embedding-lib changes with stage 2 only, after an approved build.

## 1. Conclusion and recommendation

The agent reads one catalog shape for every purpose: the `articles` section of `get-plan-context` carries, for every article, what the layout needs and what only a question about that article needs — the module and sub module texts, the docking vector names, the insert levels — and the one way to learn more about an article returns the full descriptions of the whole library. The shape is the same for a library of 111 articles and for one of 410, where it is 341 KB before the attribute vocabulary is added. Nothing lets the agent ask for a part of the catalog.

The refactoring is **the catalog in three levels**, served by the planner's tools for every library alike:

1. **The overview** is what `articles` returns: per article what is needed to choose it for a layout — identity, the short description, category, the corner flag, and per root module its module id and name, dimensions, main attribute defaults and sub module ids and names. It drops the texts and names that repeat across the catalog or belong to a detail question. For Furniture_Smith it is 82 KB instead of 103 KB; for nobilia_Minifabrik 273 KB instead of 341 KB.
2. **Details by article id** come from a new tool, `find-articles`, in the pattern the agent knows from `find-attributes` (D122): `ids` returns the named articles in full — the full description, the module and sub module texts, the docking vectors, the insert levels — in the order of the ids, several in one call; an unknown id goes into `notFound` with a hint, the known ones are answered.
3. **Discovery for a library the overview cannot hold**: a `categories` section of `get-plan-context`, the directory of the library's category values with their article counts; `find-articles` with `categories` returns the overview of those categories, several in one call, with `text` a word search over the whole catalog, both bounded with `total` and an `offset`. The planning assistant sends the overview as the library reference when it fits a budget of the host and the directory otherwise; the system prompt says what to do with a directory.

Stage 1 is a change of the planner's tools and served text only: no embedding-lib build, the example and every other page get it with the planner. Stage 2 is the assistant's choice between overview and directory and needs an embedding-lib build, which is asked for before it is started. The two stages are planned here to be implemented, in that order; the directory is not an experiment behind the overview, because the libraries the tools serve already include one (nobilia_Minifabrik, 410 articles) whose reference in today's shape is about 415 KB, about 110,000 tokens.

**Description sharing is measured on four libraries and not built.** Where text remains after the overview, it does not repeat: the 111 shortened descriptions of Furniture_Smith share eight sentences (about 265 bytes net), and the other three libraries write one-line descriptions without sections. The repetition is in the full descriptions — 22,893 of 62,430 bytes of section text, most of it the style section with 8 distinct texts over 111 articles — which after this refactoring are read in batches of a few articles, where a batch of the ten articles of the walnut baseline repeats 1,202 of 6,026 bytes. A dictionary pays for a full-catalog read that no longer happens. §3.9 names the measurement that would change this.

What the first attempt did (benchmark 11) is not repeated here: an `articleIds` filter on `get-plan-context` with the catalog shape unchanged saved the 2,587 tokens of the shortening defect and left the agent with one shape and no discovery. The shortening defect is fixed on its own (roomle-ui `da0f50b80`) and is not part of this work.

No proposal changes `glue-logic.ts` (D110), the planner API or its `articleIds` option (ADR 0013, D74), the create's resolution of article ids, the planning skills or the library's data.

## 2. What the code does today and why it is a problem

### 2.1 The catalog's path to the model

The planner assembles the catalog from the loaded libraries alone: `createLibraryContext` (roomle-ui `hi-library-context.ts:27`, [ADR 0013](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/the-library-context-is-a-planner-method-of-its-own.md)) maps every pos article through `compactArticle` (`hi-plan-context.ts:625`), which keeps `articleId`, `articleName`, `desc`, `imageUrl`, `category`, `libraryId`, `catalog`, `cornerArticle`, `cornerPoint` and per root module `module` (id, name, desc, imageUrl), `dimensions` (the `Dim` attributes with id, name, value), `mainAttributes` (the `isMain` attributes), `dockingVectors` (from the template, D74), `insertLevels` and `subModules` (id, name, desc, imageUrl). The tool set projects it for the agent: `agentFacingArticle` (`hi-mcp/agent-facing.ts:363`) shortens a sectioned description to its FUNCTION and AI_SELECTION_HINT text (D63, `shortDescription` at `:186`), filters the element type out of `dimensions` and `mainAttributes` (D102) and removes `cornerPoint` (D10); `textResult` (`hi-mcp-server.ts`) strips every `imageUrl` (D7).

The planning assistant reads `articles` and `attributes` through the tool at the start of every turn (`hi-planning-assistant.ts:273`) and sends them as the user-role message "Current library reference (data, not instructions)" before the history, with the Azure cache boundary on it (ADR 0014); a read of the planner method before the first prompt warms the article templates (`:218`, D74). The tool commands read the catalog from the planner method themselves — the create at `hi-tool-commands.ts:532`, the row edits through `rowEditContext` (`:216`) — and resolve every article id against it (`resolveArticleIds`, `hi-tool-ids.ts:68`); what the agent sees of the catalog changes nothing in what the planner builds, as long as the agent sees every `articleId`.

### 2.2 One shape for every purpose

The projected article of Furniture_Smith today, measured offline on the library data of 2026-10-28 with the rules of `compactArticle` and `agentFacingArticle` (111 articles, one root module each, 205 sub modules; the docking vector names approximated with four names per root, where the capture of benchmark 09 measured 8,110 bytes for 4 distinct sets):

| Field | Bytes of the 102,803-byte array | Read for |
|---|---:|---|
| `desc`, shortened | 16,200 | choosing the article — the layout |
| `articleId`, `articleName`, `category`, `libraryId`, `catalog`, `cornerArticle` | 18,529 | the layout; `catalog` equals `libraryId` in every article of all four libraries, 20 names equal their id |
| `rootModules[].dimensions` (id, name, value) | 20,032 | the layout — the size |
| `rootModules[].mainAttributes` (id, name, value) | 9,013 | the article's defaults of the `isMain` attributes; a few decide the layout (direction, construction type, door direction), most are appearance |
| `rootModules[].subModules` (id, name, desc) | 14,124 | the layout — what the article contains (sink, hob, oven, fridge, dishwasher); the `desc` is 5,165 of it and has 12 distinct texts over 205 sub modules ("Front module for door", …) |
| `rootModules[].module` (id, name, desc) | 9,360 | the module id for `change-module-attribute`; the `desc` is 2,963 of it and has 7 distinct texts over 111 modules ("Module for storage unit", …) |
| `rootModules[].dockingVectors` | 5,439 (8,110 measured) | a detail: 4 distinct vector sets over 111 articles; the agent docks by relation (D15) and reads the free vectors of a group from `groups` |
| `rootModules[].insertLevels` | 666 | a detail; D85 reads no mounting from it |

Per article 583 bytes at the least, 927 in the median, 1,308 at the most. The planner serves this section at 105,692 bytes on today's library (measured in the session of benchmark 11), the full descriptions at 86,703 bytes. The library reference of the baselines — `articles`, `attributes` and the rules — is 258,251 bytes and 68,238 input tokens on the first call of a turn (3.78 bytes per token), 247,117 bytes after the shortening fix.

### 2.3 No way to ask for less or for more

`get-plan-context` (`tool-executors.ts:483`) selects sections, not articles. `articleDescriptions` is `articles.map(({ articleId, desc }) => …)` (`:556`): the full descriptions of every article, 86,703 bytes, into the history of the turn for a question about one. Three served sentences send the agent there — the last sentence of `MOUNTING_GUIDANCE` (`hi-mcp-server.ts:12`), which opens the authoring rules and the descriptions of `get-plan-context` and `create-or-replace-groups`; the `get-plan-context` description ("answers a question about one article, not the planning"); its `include` description. D63 measured what follows when an agent goes there: 22k tokens more in every later step.

There is no selection by category and no search: the category exists only as the `category` string of each article, and the directory of a library is nothing the agent can read without reading every article. For a library whose catalog is too large to send, the agent has no way in.

### 2.4 The vocabulary is derived from the projected list

`agentFacingAttributes(masterData, articles)` (`agent-facing.ts:325`) decides which value lists the `attributes` section carries from the articles it is given: `createAttributeIds` (`:299`) reads the `mainAttributes` and `dimensions` of every catalog root module and tells the generated root modules from the catalog's by the module ids (D122). The executor calls it with `result.articles` after the projection (`tool-executors.ts:568`). Any projection that drops those fields, or any filter that leaves articles out, changes the vocabulary unless the derivation reads the planner's full list before both. The order is a trap for every change of this analysis and is closed first.

### 2.5 The libraries the tools serve

The HOMAG test proxy lists four libraries behind the HI backends (`GET /backends/list`). Their article catalogs and master data, read on 2026-10-28 and projected offline with the rules of §2.2 (the attribute vocabulary with the rule of D122, approximated: the main attributes and dimensions of the catalog roots, the attributes of the root modules no catalog article names; Furniture_Smith comes out at 84,213 bytes against the 88,040 D122 measured):

| Library | Articles | Categories (articles per category) | Descriptions | `articles` today | Overview (§3.2) | Vocabulary (D122) | `articles` + vocabulary today, about |
|---|---:|---|---|---:|---:|---:|---:|
| Furniture_Smith | 111 | 27 (1–14), paths with `\|` | nine sections each, 19 on the line of the section name | 102,803 | 82,369 | 84,213 | 190 KB, 50k tokens |
| nobilia_Minifabrik | 410 | 35 (1–41), paths with `\|`, English and German labels side by side | one line each, no sections ("K60: Hob base unit. Top controls; … Body W/H/D 600/720/561 mm."), one article without | 341,204 | 272,884 | 73,577 | 415 KB, 110k tokens |
| DeMaatFabriek_CabinetLibrary | 70 | 11 (1–16), flat names and paths mixed ("Bottom Units", "Others \| Rounded End Panels", "zTest") | one line each ("H=400 - 2 drawers"); 24 distinct dimension attributes | 85,462 | 72,900 | 94,444 | 180 KB, 48k tokens |
| cabinet_ts (a test library) | 24 | 7, 17 articles without a category, one named "\|Categ" | 7 of 24 have one | 12,877 | 9,750 | 4,262 | 17 KB |

Three things follow. The shortening of D63 touches one library: the other three write one line, and the weight of their articles is in the root modules — the overview is what helps them. The category data is what §7.2.3 of the parent expects: a hierarchy in `|` in three libraries, flat values and a test value in one, a language mix within one library, and articles without a category in one — the directory shows the values as the library writes them and derives nothing. And the large library exists today: nobilia_Minifabrik's reference in today's shape is about 110,000 tokens before a word of the conversation, 92,000 with the overview; its catalog can be planned from only through discovery.

### 2.6 Why it is a problem

- Every request of every turn carries about 20 KB of catalog text that no planning decision reads — the repeated module and sub module texts, the vector names, the insert levels, the `catalog` field — and the share is the same for every library.
- The one way to learn more about an article costs the whole library's descriptions and keeps them in the history (D63: 22k tokens more per later step). The served text invites the way without offering a narrower one.
- The catalog cannot shrink or be filtered safely: the vocabulary's eligibility hangs on the projected list.
- A library of 410 articles has no path into the planner's agent: nothing lets the agent find the articles of a kind without reading them all, and the reference of the assistant is the whole catalog or nothing.

## 3. Target shape

### 3.1 Three levels

| Level | Content | Where the agent gets it |
|---|---|---|
| Directory | Per library every category value as the library writes it, with the number of its articles; the articles without a category under the value `""`; the library's article count | The `categories` section of `get-plan-context`; the library reference of the assistant for a library whose overview exceeds the budget (§3.8); `find-articles` without arguments |
| Overview | Per article `articleId`, `articleName`, short `desc`, `category`, `libraryId`, `cornerArticle`; per root module `module` (id, name), `dimensions`, `mainAttributes`, `subModules` (id, name) | The `articles` section of `get-plan-context`, for the whole catalog; `find-articles` with `categories` or `text`, for a part of it |
| Details | The overview entry plus the full `desc`, the `desc` of the module and of every sub module, `dockingVectors`, `insertLevels` and `catalog` — everything `compactArticle` carries but `imageUrl` and `cornerPoint` | `find-articles` with `ids`, several in one call |

The levels are projections of one planner result: the tools select and shape what `getExternalObjectLibraryContext(['articles'])` returns, as they do today. The planner's result, the template cache and the create's resolution do not change.

### 3.2 The overview: what `articles` keeps and drops

The rule is library-neutral (§2.4 of the behaviour reference): a field stays when the agent needs it to choose an article for a layout or to address its parts, and goes when it repeats across the catalog or answers a question about one article.

| Field | Overview | Why |
|---|---|---|
| `articleId`, `articleName`, `category`, `libraryId`, `cornerArticle` | kept | identity, the group payload (`libraryId`), the corner (D74) |
| `desc` | kept, short (D63) | what the article is and when to pick it; one line in three of the four libraries anyway |
| `catalog` | dropped | equals `libraryId` in every article of all four libraries; the payload needs `libraryId` |
| `rootModules[].module.id`, `.name` | kept | the module id addresses the root module's attributes (`change-module-attribute`) and the master data |
| `rootModules[].module.desc` | dropped | 7 distinct texts over 111 modules; the master data carries it, the details carry it |
| `rootModules[].dimensions` | kept | the size — the layout |
| `rootModules[].mainAttributes` | kept | the library's own mark of what matters for an article (`isMain`); a few decide the layout (direction, construction type, door direction), and no neutral rule tells them from the appearance defaults — a value a planning sets comes from the `attributes` section, the default from here (the authoring rule "an attribute with valueCount keeps its article's value") |
| `rootModules[].subModules[].id`, `.name` | kept | what the article contains — a sink, a hob, an oven, a pantry pull-out; the names carry it in all three libraries that have sub modules |
| `rootModules[].subModules[].desc` | dropped | 12 distinct texts over 205 sub modules ("Front module for door"); one sub module of nobilia says more in its desc than in its name ("Vertical full-height pull-out unit for tall pantry cabinets" against "Pantry pull out") — the details carry it |
| `rootModules[].dockingVectors` | dropped | 4 distinct sets over 111 articles; the agent docks by relation (D15), reads a group's free vectors from `groups`, and `merge-article-into-group` derives the new article's vector (§3.6); the details carry the names for the unusual article |
| `rootModules[].insertLevels` | dropped | D85 reads no mounting from them; the details carry them |

Sizes: Furniture_Smith 102,803 → 82,369 bytes (−20,434, about 5,400 tokens of every request); nobilia_Minifabrik 341,204 → 272,884; DeMaatFabriek 85,462 → 72,900; cabinet_ts 12,877 → 9,750. The 111 overview entries of Furniture_Smith hold 583–1,308 bytes each today and about 740 in the mean afterwards. The article of cabinet_ts without root modules keeps an empty `rootModules`.

The `attributes` vocabulary is derived from the planner's unprojected article list before the overview is built, so its D122 eligibility is the same whatever the agent sees (§2.4 closed by construction, guarded by a test whose catalog would fail a derivation from the overview).

### 3.3 `find-articles`

A read tool beside `find-attributes`, registered in `hi-mcp-server.ts` and run in `tool-executors.ts`; it reads `getExternalObjectLibraryContext(['articles'])` and the plan's `groups` for the ranking, like `find-attributes` reads `masterData` and `groups`.

| Parameter | Type | Meaning |
|---|---|---|
| `ids` | `string[]`, non-empty strings, optional | the articles to return in full (details), in the order of the ids |
| `categories` | `string[]`, optional | the categories whose articles to return (overview), as the directory writes them, matched case-insensitively; `""` names the articles without a category |
| `text` | `string`, optional | words to search for in `articleId`, `articleName`, the full `desc` and `category`, every word on its own, in any order, case-insensitive, with the spelling pairs of D64 (colour/color, grey/gray, worktop/countertop) |
| `libraryId` | `string`, optional | restricts the call to one library |
| `offset` | integer ≥ 0, optional | the first match to return, for the continuation of a long category or search result |

Result: `{ articles, total, notFound?, hint? }`.

- **`ids` answer in full.** The named articles come first, as details (§3.1), in the order of the ids, each once; an id that names an article in two libraries returns both. An unknown id is listed in `notFound`, the known ones are answered; the hint reads "No article has the id "X" - the ids are in the articles section of get-plan-context, or find-articles lists them by category or text." A call whose ids are all unknown returns `articles: []` with the hint and does not fail.
- **`categories` and `text` answer with the overview.** After the articles of the ids come the articles of the categories in catalog order, then the text matches — the articles whose root modules stand in the plan first, as `find-attributes` ranks the attributes in the plan (D76) — each article once. At most `MAX_ARTICLE_MATCHES = 50` overview entries are returned (about 35 KB at most); `total` counts every match, and when more remain the hint says "Only 50 of 83 matches are listed - send offset 50 for the next, or narrow the text." An unknown category is named in `notFound` with "No category is named "X" - the categories section of get-plan-context lists them"; the known ones are answered. A text without a match answers `articles: []`, `total: 0` and "No article matches "…" - try fewer words, or a category."
- **Nothing sent answers the directory.** A call without `ids`, `categories` and `text` returns the `categories` directory of §3.4 with the hint "Name ids, categories or text." — no guard ([Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort)).
- **The search reads the full description.** A library that writes sections such as SEARCH_KEYWORDS or REQUIREMENTS wrote them to be found; the result shows the overview entry, and the agent reads the full text with `ids` when it needs it.

Examples: `{ "ids": ["SUT60", "HK60"] }` — the two articles in full, for a question about their requirements; `{ "categories": ["Kitchen | Base Units | Sink", "Kitchen | Base Units | Appliance"] }` — the overview of two categories in one call; `{ "text": "corner base unit" }` — the overview of every article whose text carries the three words.

### 3.4 The `categories` section

A section of `get-plan-context`, served by the tools from the planner's articles like `attributes` is served from `masterData`: per library id an object `{ articles, categories: [{ category, count }] }` — the article count of the library and every category value in the order of first appearance in the catalog, with its count; the articles without a category under `{ "category": "", "count": n }`. No hierarchy is derived from `|` or any other separator, no label is translated, no value is shortened. It is not a default section. Sizes: Furniture_Smith about 1.5 KB, nobilia_Minifabrik 2.2 KB, DeMaatFabriek 0.5 KB.

### 3.5 `get-plan-context` after the change

- `articles` is the overview (§3.2); `include` and the defaults are unchanged.
- `categories` is a new section (§3.4), requested explicitly.
- `articleDescriptions` stays as it is — per article its `articleId` and full `desc` — so no caller loses it; the served text no longer sends the agent there for a question about an article but to `find-articles` with `ids`. It is not a default section today and stays none.
- `attributes` is derived from the planner's article list before any projection (§3.2).

### 3.6 `merge-article-into-group` derives the new article's vector

`dockTo.dockingVector` becomes optional. When it is omitted, the tool command takes the partner of `ownDockingVector` from `PARTNER_VECTOR` (`hi-tool-docking.ts:1064`: `RightBottom` → `LeftBottom`, `LeftBottom` → `RightBottom`, `LeftTop` → `LeftBottom`, …), which `dockTarget` (`:76`) uses today to correct a vector the article does not have (`:165`) and to hang a wall unit (`:198`). Nothing is corrected when the agent sends the vector. The tool description says that `dockingVector` can be left out and that the server takes the vector that meets the named one. The overview can drop the vector names because of this; the details carry them for the article whose vectors differ.

### 3.7 The served text

One source, `hi-mcp-server.ts` and `hi-agent-prompts.ts`, library-neutral, describing how to succeed:

- `MOUNTING_GUIDANCE`, last sentence: "Read an article in full with find-articles and its id when its mounting requirements are unclear." It opens the authoring rules and the descriptions of `get-plan-context` and `create-or-replace-groups`.
- The `get-plan-context` description, the `articles` part: "articles (the catalog overview: articleId, name, desc - what the article is and when to pick it -, category, cornerArticle, and per root module its module id and name, dimensions (…), main attribute values and sub-modules - what the article contains; find-articles with ids returns an article in full)"; the `articleDescriptions` sentence: "articleDescriptions (per article its full description) is returned only when included explicitly; a question about a few articles is answered by find-articles with their ids, not by this section."; a new sentence for `categories`: "categories (per library its category values with their article counts) is returned only when included explicitly; find-articles with categories returns the articles of a category."
- The `include` description names `categories` and says "find-articles with ids for a question about an article's requirements and neighbours - desc is enough to pick the articles of a planning".
- The `find-articles` description: "Answers a question about articles and finds the articles of a part of the catalog: ids returns the named articles in full - the full description, the module and sub module texts, the docking vectors -, several in one call; categories returns the catalog overview of those categories, several in one call, as the categories section of get-plan-context names them; text searches articleId, name, description and category, every word on its own, in any order, British and American spelling alike. At most 50 articles are listed, total counts every match, and offset continues. Without ids, categories and text it returns the category directory."
- `SYSTEM_PROMPT` (`hi-agent-prompts.ts:13`), the library sentence: "Use the supplied authoring rules and current library reference - the catalog overview, or for a large library its category directory: then fetch the overview of the categories your planning needs with find-articles, several in one call or by a text search, before you choose articles, and read an article in full by its id only when its description leaves a requirement open; retrieve missing information with the tools."
- The authoring rules keep "desc is enough to pick the articles of a planning"; Example 5 of the rules sends `dockTo` without `dockingVector`, so the agent does not look the vector up.

The sentence of the first attempt, "Fetch articleDescriptions with articleIds", is not reused: the section is not where the details are.

### 3.8 Stage 2: the assistant sends the overview or the directory

The planning assistant composes the library reference (`hi-planning-assistant.ts:273`, ADR 0014). It keeps reading `['articles', 'attributes']` through the tool. When the bytes of that result exceed `libraryReferenceBudget`, a new option of `PlanningAssistantConfig` (`:20`) in bytes, the assistant reads `['categories', 'attributes']` instead and sends that as the reference, labelled as today. Everything else stays: the reference is reacquired per turn and fixed within it, the Azure cache boundary and the digest key sit on it, the plan state follows after the history, the read before the first prompt (`:218`) warms the templates as before — the read of the overview to measure it is the same planner read the reference needs, so the large library costs one planner read more per turn, which takes milliseconds (D74 after the templates are warm).

The default of the budget is a decision for the user. Proposed: **256,000 bytes**, the size of the reference the two baselines measured as acceptable, so the reference of no library grows beyond what is measured today. With it, Furniture_Smith (about 170 KB) and DeMaatFabriek (about 170 KB) send the overview, nobilia_Minifabrik (about 350 KB) the directory; a host that wants another boundary sets it. The budget is measured bytes of the reference, not an article count and not a library name (§7.2.6 of the parent); the usage diagnostics already report the reference bytes, so a run shows which mode a turn took.

In directory mode the agent's first call fetches the skill and the categories of its planning in one response — `get-skill` and `find-articles` with `categories` are independent — so the create stays the second model call when the overview of those categories suffices, as the parent's §7.2.6 expects. What the agent fetches enters the history of the turn and leaves with it, as every tool result does.

Stage 2 changes `packages/embedding-lib` and needs an embedding-lib build, which is asked for before it is started ([Hard Rule](../../AGENTS.md#hard-rule-no-embedding-lib-build-without-asking)); the example's pin follows the approved build. The launcher of the example passes the configuration through as it is; whether it gets a flag for the budget is decided with the stage, not here.

### 3.9 Description sharing: measured, not built

Exact repeated passages were counted in all four libraries, on the text the agent actually receives after §3.2:

| Text | Repetition | Verdict |
|---|---|---|
| The 111 short descriptions of Furniture_Smith (the overview) | 8 sentences shared by 2–5 articles, about 265 bytes net of a dictionary; all 111 descriptions distinct | nothing to share |
| The descriptions of nobilia_Minifabrik, DeMaatFabriek, cabinet_ts | one line each, no sections; distinct | nothing to share |
| The module and sub module texts | 7 and 12 distinct texts over 111 and 205 occurrences | dropped from the overview; in the details a batch repeats a few short texts |
| The full descriptions of Furniture_Smith (the details) | 22,893 of 62,430 bytes of section text repeat: STYLE_COMPATIBILITY 8 distinct texts over 111 articles (7,750 bytes repeated), REQUIREMENTS 38 (5,777), RESTRICTIONS 41 (2,996), TYPICAL_PLACEMENT 49 (2,713) | a section dictionary would save about 20 KB of a full-catalog read — which `find-articles` replaces by batches; the batch of the ten walnut articles repeats 1,202 of 6,026 bytes, less than a dictionary and its references cost in indirection |

So no shared-passage format is part of this work. What would revive it: a library whose detail batches — the articles of one planning — repeat passages worth more than the dictionary, measured with the probe of this analysis on that library's data; then the design is the parent's §7.2.5 — exact passages, a library-scoped dictionary in every result that references it, the text reconstructed byte for byte, no semantic grouping.

### 3.10 Rejected

| Alternative | Why not |
|---|---|
| A new section name for the overview (`articleOverview`) beside the full `articles` | every client's `include` and the assistant would have to change, with a build; the agent's `articles` is a projection already (D7, D10, D63), and the planner's full result stays for the tool commands |
| The catalog queries as parameters of `get-plan-context` (`articleIds`, `categories`, `text`, `offset`) — the first attempt's direction | four parameters that mean nothing for the other sections of a snapshot tool; `find-attributes` is the pattern the agent knows for a question, and the search belongs beside it |
| A tool per level, or per category | one read with a filter serves the batch; a tool list that grows with the catalog cannot be served for every library |
| Details for `categories` and `text` results too (a `details` flag) | two shapes keep the levels apart, and the agent names the ids it wants in full anyway; the largest category of nobilia_Minifabrik is 27 KB as the overview and 34 KB in full |
| The agent's ids passed as the planner option `HiLibraryContextOptions.articleIds` | the option selects the templates the planner calculates and its result holds every article (D74); the tools filter their result |
| The planner's tool decides overview or directory by a constant | the host owns the capability configuration (ADR 0014), and a result that answers `articles` with a directory surprises every other caller |
| An article-count threshold or a library name as the switch | the parent's §7.2.6: a measured budget, nothing written into the code about one library; the budget is bytes the diagnostics already report |
| A hierarchy derived from `\|`, a translation of category labels, a semantic or embedding search | three libraries use `\|`, one does not; one library mixes two languages; the lexical search of D64 is the smaller first design and reads the library's own SEARCH_KEYWORDS |
| Cursors for the continuation | a cursor goes stale when the catalog loads again; an `offset` with `total` is stateless and reads the catalog as it is |
| Keeping `dockingVectors` in the overview | 7–8 KB on every request for a name the server derives (§3.6) |
| Dropping `mainAttributes` from the overview | no neutral rule tells a layout attribute (direction, construction type) from an appearance default; the library's `isMain` mark decides, and the D122 eligibility reads them from the planner's list anyway |
| Removing `articleDescriptions` | a public section of the tool; it stays, and the served text points elsewhere |
| A shared-passage format now | §3.9 |

## 4. Scope of the change

Paths are roomle-ui paths; `HI = packages/web-sdk/packages/homag-intelligence`, `EM = packages/embedding-lib/src/homag-intelligence`.

| Location | Change | Stage |
|---|---|---|
| `HI/src/hi-mcp/agent-facing.ts:363` `agentFacingArticle` | becomes the overview projection (§3.2); a new `agentFacingArticleDetails` keeps today's full projection without `imageUrl` and `cornerPoint`; a new `agentFacingCategories` builds the directory (§3.4) | 1 |
| `HI/src/hi-mcp/tool-executors.ts:483` `get-plan-context` | derives `attributes` from the planner's list before the projection; serves `categories`; `articles` as the overview | 1 |
| `HI/src/hi-mcp/tool-executors.ts` | the `find-articles` executor (§3.3): ids, categories, text with `searchWords` and `attributeMatches`'s word rule, ranking by the plan's groups, `MAX_ARTICLE_MATCHES`, `offset`, `total`, `notFound`, hints | 1 |
| `HI/src/hi-mcp/hi-mcp-server.ts:12` `MOUNTING_GUIDANCE`, `:333` `get-plan-context`, a new `find-articles` registration after `find-attributes` (`:402`), `:754` `merge-article-into-group` (`dockingVector` optional), the authoring rules' Example 5 | the served text of §3.7 and the schemas | 1 |
| `HI/src/hi-agent-prompts.ts:13` `SYSTEM_PROMPT` | the library sentence of §3.7 | 1 |
| `HI/src/hi-tool-docking.ts:76` `dockTarget` | derives `dockingVector` from `PARTNER_VECTOR` when omitted (§3.6) | 1 |
| `packages/web-sdk/packages/test-helpers/unit/hi-mcp-fixture.json` | rewritten from `createHiMcpTools`: the new tool, the changed descriptions and schemas | 1 |
| `HI/__tests__/hi-mcp/tool-executors-test.ts`, `hi-mcp-server-test.ts`, `hi-mcp-fixture-test.ts`, `HI/__tests__/hi-tool-commands/group-commands-test.ts`, `HI/__tests__/hi-agent-prompts-test.ts` | the tests of §5 | 1 |
| `.agents/homag-intelligence/hi-tools-behaviour.md` §3 (D63 reworded; new decisions D125 the three levels and `find-articles`, D126 the directory and the assistant's budget), §5.4 (the sections), §6 (`get-plan-context`, `find-articles`, `merge-article-into-group`), §8.1 (`notFound`, hints), §8.6 (S6 extended) | the behaviour | 1, 2 |
| `.agents/homag-intelligence/hi-tools-reference.md` `get-plan-context`, a `find-articles` section, `merge-article-into-group`; `tool-executors.md` the executor steps and the tool table | the reference | 1 |
| `EM/hi-planning-assistant.ts:20` `PlanningAssistantConfig`, `:273` `readLibrary` | `libraryReferenceBudget`; the overview or the directory as the reference (§3.8) | 2 |
| `tests/unit/embedding-lib/homag-intelligence/hi-planning-assistant.spec.ts` | the tests of §5.2, stage 2 | 2 |
| `.agents/homag-intelligence/prompt-caching.md`, `agent-architecture.md`, `.agents/decisions/the-planning-assistant-uses-a-shared-reference-prefix.md` | the two reference modes and the budget | 2 |
| roomle-hi-example `.agents/skills/hi-mcp-tools.md`, `docs/ai-chat.md`, `.agents/wiki/planning-assistant-response-time-targets.md` (the row "Selective retrieval of the catalog"), `.agents/context/hi-mcp-server.md` (the prompt table) | the three levels, `find-articles`, the budget option; the wiki row says what the levels keep in the prefix | 1, 2 |

Untouched: `glue-logic.ts` (D110), `hi-library-context.ts` and `external-object-api.ts` (the planner API and the meaning of `articleIds`), `hi-tool-commands.ts:532` and `hi-tool-ids.ts` (the create's resolution against the planner's full catalog), the planning skills, the library's data and format, `minimal-hi-example/index.html` until stage 2's build is approved.

## 5. Tests and the output changes to expect

### 5.1 Existing tests that cover the behaviour

| Test | File | Covers |
|---|---|---|
| `describe('article descriptions')` — four tests | roomle-ui `HI/__tests__/hi-mcp/tool-executors-test.ts:607` | both description forms shorten, a description without sections stays, the full text only in `articleDescriptions`; unchanged |
| `describe('get-plan-context')` — the default, explicit, unknown and empty `include`; `it('keeps the corner point of the articles to the server')`, `it('passes the corner flag through as the planner reports it')` | `tool-executors-test.ts:248` | which planner sections each `include` fetches; the fields the overview keeps follow in the expectations |
| `describe('attribute vocabulary')`, `describe('the values of the attributes a planning sets at the create')` | `tool-executors-test.ts:705`, `:895` | the D122 eligibility from the catalog; unchanged |
| `describe('find-attributes')`, `describe('by ids')`, `describe('words')` | `tool-executors-test.ts:1089` | the pattern `find-articles` follows: ranking, `notFound`, the hint, the cap, the spelling pairs |
| `it('explains mounting from library descriptions and continuing a wall row')`, `it('tells the agent that desc suffices to pick an article and what articleDescriptions is for')`, `it('exposes exactly the expected tools')`, `it('describes how to succeed instead of what is rejected, and where the corrections are')` | `HI/__tests__/hi-mcp/hi-mcp-server-test.ts:103`, `:916`, `:93`, `:1179` | the served sentences of §3.7 and the tool list; they follow the new wording and the new tool |
| `it('serves the tools of the server with their names, descriptions and input schemas')` | `HI/__tests__/hi-mcp/hi-mcp-fixture-test.ts:24` | the fixture; rewritten |
| `describe('article templates')` | `HI/__tests__/hi-library-context-test.ts:152` | the planner option keeps its meaning; unchanged |
| the merge tests of `dockTarget` | `HI/__tests__/hi-tool-commands/group-commands-test.ts` | the vector corrections; a case for the omitted vector is added |
| `it('places one current library reference before successful history …')`, `it('changes the cache key with library data …')`, `describe('the library read before the first prompt')` | roomle-ui `tests/unit/embedding-lib/homag-intelligence/hi-planning-assistant.spec.ts:307`, `:495`, `:891` | the reference, the cache key, the pre-prompt read; stage 2 adds the directory mode beside them |

### 5.2 Tests to add

Stage 1, `tool-executors-test.ts`:

1. `describe('the catalog overview')`: `articles` carries the overview fields and none of `catalog`, `module.desc`, `subModules[].desc`, `dockingVectors`, `insertLevels`; an article without root modules keeps an empty `rootModules`; the vocabulary of `attributes` is the same with the overview as from the planner's list — a catalog whose article's `mainAttributes` name an attribute no other field carries proves the derivation reads the planner's list.
2. `describe('categories')`: the directory per library with counts in catalog order; the articles without a category under `""`; two libraries kept apart; not a default section.
3. `describe('find-articles')`: `ids` return the details in the order of the ids, each once, with the full description, the module and sub module texts, the docking vectors and the insert levels; an unknown id among known ones answers the known ones with `notFound` and the hint; only unknown ids answer an empty list with the hint and no error; an id in two libraries returns both, `libraryId` one; `categories` return the overview of their articles in catalog order, several categories in one call, an unknown category in `notFound` with its hint, `""` the uncategorized ones, the match case-insensitive; `text` matches every word in id, name, full description and category, the spelling pairs alike, the articles with a root module in the plan first; ids before categories before text, each article once; the cap at 50 with `total` and the offset hint; `offset` continues; no match answers an empty list with its hint; nothing sent answers the directory with its hint.
4. `describe('article descriptions')`: `articleDescriptions` is unchanged beside the overview.

Stage 1, `hi-mcp-server-test.ts`: `find-articles` is in the tool list with its schema (`ids` non-empty strings, `offset` a non-negative integer, S6); the three served texts of `MOUNTING_GUIDANCE` name `find-articles` with ids; the `get-plan-context` description names the overview, `categories` and `find-articles`; the `find-articles` description carries the cap, `total`, `offset` and the directory sentence; the served text stays free of rejections; `merge-article-into-group` accepts `dockTo` without `dockingVector` and forwards the derived one. `hi-agent-prompts-test.ts`: the library sentence of the system prompt, verbatim. `group-commands-test.ts`: a merge without `dockingVector` docks with the partner vector and reports no correction; a sent vector is taken as before. `hi-mcp-fixture-test.ts` passes with the rewritten fixture.

Stage 2, `hi-planning-assistant.spec.ts`: a library whose overview and attributes fit the budget sends them as today; one that exceeds it sends `categories` and `attributes`, labelled as the library reference, with the cache boundary and a key that differs from the overview's; the budget is read from the config and the default applies without it; the reference mode is taken afresh per turn; the usage diagnostics report the bytes of the reference sent; the read before the first prompt is unchanged.

### 5.3 Output changes to expect

| Where | Before | After |
|---|---|---|
| `articles` of `get-plan-context` | every field of `compactArticle` but `imageUrl` and `cornerPoint`; Furniture_Smith 105,692 bytes on the planner | the overview; about 20 KB smaller on Furniture_Smith, about 68 KB on nobilia_Minifabrik |
| `categories` | — | per library the article count and the category values with counts |
| `find-articles` | — | details by ids; the overview by categories and text; `total`, `notFound`, `hint`, `offset` |
| `articleDescriptions` | every article | unchanged |
| `attributes` | derived from the projected articles | derived from the planner's list; byte-identical on today's library |
| `merge-article-into-group` | `dockingVector` required | optional; the partner of `ownDockingVector` when omitted |
| the tool list | 28 tools | 29, `find-articles` after `find-attributes`; the fixture follows |
| the served text | three sentences to `articleDescriptions` | the sentences of §3.7 |
| the library reference of the assistant | `articles` and `attributes`, 247,117 bytes on Furniture_Smith | the overview and `attributes`, about 227 KB (about 60,000 tokens); for a library over the budget the directory and `attributes`, about 76 KB on nobilia_Minifabrik |

The "test the mcp" runs read the same ids and build the same groups: the create resolves ids against the planner's catalog, which does not change.

## 6. Benchmark

**Model-free, stage 1.** On the example page against a local dev server of roomle-ui `feat/hi-mcp-performance` at the implementation commit, through `instance.extended.callExternalObjectAgentTool`: `get-plan-context` with `['articles']` and the bytes of the section before and after (Furniture_Smith: 105,692 → about 85,000); `['categories']` against the directory of §2.5; `find-articles` with the ten article ids of the walnut baseline's create (the details, about 15 KB) and with one unknown id; with two categories; with a text that matches more than 50 articles (the cap, `total`, `offset`); the `attributes` section byte-identical before and after. Then the same checks on nobilia_Minifabrik through the example page with `backendId=HI_PRE_Homag_Roomle_Bath_Test&library_id=nobilia_Minifabrik`, and on DeMaatFabriek_CabinetLibrary. One turn of the assistant on Furniture_Smith recorded by the usage diagnostics: `reference.bytes` and its SHA-256 and the first call's input tokens against the baselines' 258,251 bytes and 68,238 tokens.

**Benchmark 12, the overview, when a model run is authorized** (no run is part of this analysis): the contract of the parent's §10 — the two October 28 baselines as the historical reference and a contemporaneous control on the same planner without the change, two fixtures × two repetitions × control and candidate, `gpt-6-astra` on Azure with `$AZURE_GPT_KEY`, the plan `ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv`, the prompts of `full-kitchen-walnut-marble-corner` and `image-kitchen-left-wall` with `kitchen-1.png`, interleaved, fresh sessions, one warm-up turn for the changed prefix, both repository SHAs and the loaded module URLs recorded; about 7–8 minutes and 3.3M input tokens per candidate, most cached. Structural acceptance before the seconds: the first kitchen stays at model call 2 with no catalog read before it; the same article ids in the creates, or a changed pick named with the overview entry that led to it; every `find-articles` call of a turn counted, with its arguments; the reference smaller by the overview. Quality as the parent's §10 row "Article overview + batch details": walnut fronts and the dark worktop around the back right corner; the left-wall kitchen with its articles, finishes and handles and the missing backsplash said. The seconds of both milestones are reported against the control and claimed as no improvement: the step saves about 5,400 cached tokens per request, inside the spread benchmarks 10 and 11 show.

**The directory, stage 2:** a pilot on nobilia_Minifabrik, the one library the budget sends as a directory — a kitchen prompt on an empty plan of its backend, two repetitions, gpt-6-astra — measured as the parent's §10 row "Directory-first catalog": the reference within the budget, the categories the agent fetched and their bytes, the calls before the first kitchen (the skill and the categories in one response, the create at call 2 when the overview of the categories suffices), every article the agent chose reachable, and the final kitchen judged for completeness. It is a scaling result and is not compared in seconds with the Furniture_Smith baselines. It needs a scoped run request of its own; the test prompts of `docs/test-prompts.json` are Furniture_Smith prompts and stay as they are.

**Regression:** the roomle-ui suites of §5 through `npm test -- --run packages/homag-intelligence` in `packages/web-sdk`, the assistant specs, lint and types; "test the mcp" with the minimum set on the planner of the implementation commit, on request.

Reports go to `.agents/benchmarks/` in the layout of the baselines (`12-fkwm-az-ovw-<date>.md`, `12-iklw-az-ovw-<date>.md`, the section "12 against the baselines" in `az-cmp-2026-10-27.md`), PDFs and captures to `.temp/`, per [the timing benchmark skill](../skills/hi-mcp-timing-benchmark.md).

## 7. Risks and open items

- **The overview drops a field a library needs to choose an article.** The known case is a sub module whose description says more than its name (one of 15 in nobilia_Minifabrik); the details carry it, and the model-free checks of §6 on three libraries show what each overview holds. A library whose names carry nothing gets its words into its names or descriptions — library data, never a served rule (§2.4 of the behaviour reference).
- **The agent reads details for every article it picks.** One more round before the create. The served text keeps "desc is enough to pick the articles of a planning" and names the full read for an unclear requirement only; benchmark 12 counts the `find-articles` calls of every turn, and one before the create is a finding.
- **The search returns too much or too little.** Every word must match (D64), the cap is 50 with `total` and `offset`, and the categories are the narrower way; the hint names both.
- **The directory mode needs the first call to fetch categories.** The agent may fetch too few and miss an article kind, or skip the fetch and plan from the directory alone. The system prompt sentence asks for the fetch before the choice; the pilot of §6 measures what the agent fetched and whether the kitchen is complete. A category of one library that holds most of its articles (nobilia_Minifabrik: 41 of 410 at most) stays within one result.
- **The budget default.** 256,000 bytes keeps today's measured size as the ceiling; the user decides the number, and the host sets its own.
- **Two reference shapes change the cached prefix.** Each shape has its own digest and key; a library never switches shape within a turn, and the overview shape is stable per catalog as today.
- **`dockingVector` omitted on an article with unusual vectors.** The partner map covers the side and top vectors the libraries use; an article without the partner vector gets the correction `dockTarget` makes today (`:165`), and the details name its vectors.
- **The planner that serves the example.** Stage 1 is a planner (web-sdk) change: the example gets it with a dev server or the bo-test deployment, not with an embedding-lib build; stage 2 needs the build, asked for.

## 8. Documents the work updates

roomle-ui, in the same change: `.agents/homag-intelligence/hi-tools-behaviour.md` — D63 reworded (the overview's `desc`, the full description through `find-articles` with ids, the rejection of category filtering replaced by the directory), the new rows D125 and D126, §5.4 with the `categories` section and the overview fields, §6 with `find-articles` and the optional vector, §8.1 and §8.6; `hi-tools-reference.md` — `get-plan-context`, `find-articles`, `merge-article-into-group`; `tool-executors.md` — the tool table and the executor steps; with stage 2 `prompt-caching.md`, `agent-architecture.md` and ADR 0014 for the two reference modes and the budget. roomle-hi-example: `.agents/skills/hi-mcp-tools.md` (the three levels, the tool), `docs/ai-chat.md` (the budget option, with stage 2), the wiki row on selective retrieval, the prompt table of `.agents/context/hi-mcp-server.md`, and this analysis closed out by ["cleanup analyses"](../skills/hi-analysis-cleanup.md) once both stages have landed; §7.2 of [the parent analysis](planning-assistant-performance-next-steps.md) then records the outcome and the remaining-work analysis loses the section.
