# Planning Assistant: the compacted library context kept

> **Type**: Feature analysis — proposal F of
> [the time-to-first-attempt analysis](planning-assistant-time-to-first-attempt.md), held against
> the code and a measurement without a model
> **Status**: Open — F as proposed saves about 5 ms per read and is proposed for rejection; the
> 0.75 s of the first read of a page is the calculation of the article templates, which the planner
> already keeps; a warm-up read of the planning assistant before the first prompt takes it
> ([§5](#5-the-proposed-change)), to be decided ([§9](#9-decisions-to-take-before-the-plan))
> **Date**: 2026-10-27
> **Ticket**: [RML-18303](https://roomle.atlassian.net/browse/RML-18303)
> **Backlog**: [Caching the library context](../backlog/README.md#planner-roomle-ui-roomlecore)
> **Base**: roomle-ui `feat/hi-mcp-merge` at 053a008f7, which carries `feat/hi-mcp-performance` at
> d06fe91de (the library context `hi-library-context.ts`, its reader `hi-tools.ts`, the planning
> assistant `packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts`); the library
> context code is the same on `release/bo-test`. roomle-hi-example `master` at 75275c3
> **Data**: a probe without a model, three fresh example pages on the local planner (Furniture_Smith,
> 111 articles, 16 sub-articles), kept in `.temp/result/library-context-probe-2026-10-27/`
> (`probe-library-context.mjs`, `probe-1.json`, `probe-2.json`); the warm reference acquisition of
> benchmarks [01](../benchmarks/01-iklw-oa-orig-2026-10-26.md) to
> [06](../benchmarks/06-az-skill-2026-10-27.md); the first change of the edit in
> [benchmark 07](../benchmarks/07-az-state-2026-10-27.md)

## Affected repositories

- **roomle-ui** — with the proposed change, the planning assistant of the embedding-lib
  (`hi-planning-assistant.ts`: one read of the library reference once the catalog has loaded,
  before the first prompt) and its tests; the living reference of the assistant
  (`agent-architecture.md`, a decision row of `prompt-caching.md`). An embedding-lib change: the
  build is asked for. The planner's library context (`hi-library-context.ts`, `hi-tools.ts`) stays
  as it is; it would change only with F as proposed, which this analysis proposes to reject.
- **roomle-hi-example** — this analysis, the time-to-first-attempt analysis, the backlog item
  "Caching the library context"; the embedding-lib pin with the build.
- **ligna-store** — no code change; the embedding-lib pin with the build. It is the host the change
  is for: it reads nothing of the library before the first prompt.

## 1. What was asked

Proposal F of the time-to-first-attempt analysis, from the backlog item of the planner: keep the
compacted library context from the library load until the next catalog load (`hi-library-context.ts`).
The proposal claims the 0.7 s of the first read after the load, once per page, in a host without
the test runner's warm-up read — the ligna-store — and nothing for the later prompts. ADR 0013 of
roomle-ui, which made the library context a planner method of its own, names the consequence: "The
library context can be read once per library load; nothing of the plan invalidates it."

This analysis checks where the time of a read goes, what keeping the compacted context saves, and
which change takes the time of the first read.

## 2. How the library context is read today

**The readers.** The library context is the planner method `getExternalObjectLibraryContext`
(roomle-ui `roomle-planner.ts:3228`), which delegates through the glue logic's API function to
`HiToolsImplementation.getLibraryContext` (`hi-tools.ts:369`) and `createLibraryContext`
(`hi-library-context.ts:27`). It is read by:

- the planning assistant at the start of every turn: `get-plan-context` with `articles` and
  `attributes` (`hi-planning-assistant.ts:239`), which reads the library sections `articles` and
  `masterData` (`tool-executors.ts:483`); in parallel with the plan state of the turn (proposal G),
  but `get-plan-context` runs one call at a time (`oneAtATime`, `tool-executors.ts:268`), so the
  plan state waits for the library read;
- the tool commands: the create reads `articles` (`hi-tool-commands.ts:532`), the row edits read
  `articles` (`rowEditContext`, `hi-tool-commands.ts:221`), the attribute checks read `masterData`
  (`masterDataOf`, `hi-tool-attributes.ts:28`, three call sites); `find-attributes` reads
  `masterData`;
- the test runner, in its wait loop before the first prompt: `getExternalObjectLibraryContext`
  with `articles` until the catalog lists articles (`run-hi-mcp-prompt.js:298`, `:551`).

Neither host page reads the library before the first prompt: the example page and the ligna-store
start the assistant early (`index.html:1036`, ligna-store `components/blocks/Planner.vue:269`), and
the catalog loads later (`HomagIntelligence.loadCatalog`, `homag-intelligence.ts:125`).

**What a read does** (`createLibraryContext`):

1. The master data of every library: a deep copy, compacted (`compactMasterData`).
2. The articles: for every article whose root modules carry no docking vectors of their own, its
   template — the article calculated as a single-pick group outside the plan
   (`calculateArticleTemplate`, `hi-tools.ts:389`). The planner keeps a template per article object
   and attribute overrides (`_articleTemplates`, a `WeakMap` keyed by the `PosArticle`,
   `hi-tools.ts:333`); a failed calculation is not kept. From the templates the docking vectors and
   corner points by root, then per article a deep copy, compacted with the master data
   (`compactArticle`).
3. The sub-articles: id, library and description.

**The catalog** lives in maps the glue logic changes in place: `libraryData`, `posArticleMap` and
`_posSubArticleMap` (`glue-logic.ts:464`–`468`). `addLibrary` adds a library, `loadPosData` sets a
deep copy of every article of a catalog (`glue-logic.ts:563`–`585`), so an article loaded again is
a new object and its template is calculated again.

## 3. Where the time of a read goes

The probe opens the example page in headless Chromium on the local planner, instruments
`calculateArticleTemplate` in the planner frame before the catalog loads, waits for the plan's
groups and three seconds more, then sends the assistant's read — `get-plan-context` with `articles`
and `attributes` through `callExternalObjectAgentTool` — once on the fresh page and ten times after
it, and times the sections of `getLibraryContext` in the planner frame ten times each. No model is
involved.

| Measure | Page 1 | Page 2 | Page 3 |
|---|---|---|---|
| The first read after the catalog load, from the page | 787.9 ms | 800.4 ms | 782.9 ms |
| Of it, the article templates (calculated / asked) | 747.7 ms (111 / 111) | 764.6 ms (111 / 111) | 744.6 ms (111 / 111) |
| The ten later reads, from the page | 7.6–10.1 ms | 7.7–9.1 ms | 7.4–8.8 ms |
| `getLibraryContext` `articles` and `masterData` in the planner, median | 5.2 ms | 5.2 ms | 5.3 ms |
| — `articles` alone / `masterData` alone | 4.2 / 1.0 ms | 4.0 / 1.0 ms | 4.1 / 1.0 ms |
| — every template from the planner's cache | 0.1 ms | 0.0 ms | 0.0 ms |
| — the deep copy of the catalog / of the master data | 0.4 / 0.9 ms | 0.4 / 1.0 ms | 0.4 / 0.9 ms |

The sizes: the catalog 248,747 bytes as loaded, 310,729 bytes compacted (with the calculated
docking vectors); the master data 695,687 bytes, 656,975 compacted; the sub-articles 11,811 bytes;
the tool result 237,492 characters.

What the table shows:

1. **The 0.75 s of the first read are the templates.** Every one of the 111 articles lacks docking
   vectors of its own, and each template takes about 6.8 ms. The planner keeps them already; the
   second read finds all of them in 0.1 ms.
2. **A warm read costs 5 ms in the planner**, 8 ms from the page. The warm reference acquisition
   of benchmarks 01–06, 15–32 ms, is this read plus the assistant's digest of the reference.
3. **`createLibraryContext` is synchronous.** The 0.75 s are one task of the planner frame: the
   planner's view does not react while they run. Derived from the code, not measured as a frame
   drop.

**Where the 0.75 s fall.** On the first prompt of every page in the ligna-store and in the
example's chat window: the assistant's library read takes about 0.8 s, the plan state waits for
it, and the first model call starts about 0.8 s later. The benchmarks and "test the mcp" never see
it, because the runner's wait loop has calculated the templates before the first prompt. Against
the first change of a creation, 26–36 s in benchmarks 06 and 07, it is 2–3 %; against the first
change of an edit with the plan state supplied, 3.5–4.5 s in benchmark 07, it is about a fifth.

## 4. The gap

**F as proposed does not take the 0.7 s.** A compacted context kept from the first read on leaves
the first read as it is, because the templates are calculated in it. A context built at the
catalog load moves the 0.75 s into the planner's load, on every planner page with or without the
assistant, and needs a hook in the catalog load, which runs through the glue logic.

**What keeping it saves is the warm read**: about 5 ms per `articles` and `masterData` read,
1–4 ms per section. A creation turn reads the library in the planner a few times — the reference,
the articles of the create, the master data of its attribute steps (`moveGeneratedRootOverrides`,
`applyGroupWideAttributes`, `checkRootOverrides`), some of them per group —, so 10–25 ms per turn,
estimated from the code: under 0.1 % of a creation and under 1 % of an edit. That is the
class of tool memoization and attribute indexing, which the time-to-first-attempt analysis rejects
with "nothing to save". The cache would cost:

- an invalidation the tools cannot observe: the maps change in place, so the cache compares the
  identity of every article, sub-article and master data object on each read — cheap, but one more
  thing to keep right;
- a failed template must not be frozen into the cache, since today the next read calculates it
  again;
- every reader shares one object: the agent-facing helpers copy (`agent-facing.ts`), but one reader
  that changes it changes the next read; handing out copies costs 1.3 ms of the 5 ms.

**What takes the 0.75 s is calculating the templates before the first prompt** — the ticket's idea
"Precalculate docking vectors of articles", which the time-to-first-attempt analysis maps to F.

## 5. The proposed change

**A warm-up read of the planning assistant.** After its setup, when it reports itself available
(`hi-planning-assistant.ts:492`), `startPlanningAssistant` reads the library reference once —
`get-plan-context` with `articles` and `attributes`, the read of every turn — without waiting for
it and without sending it anywhere. While the result lists no articles, the catalog has not loaded
yet, and the read is repeated after an interval; the warm-up ends with the first read that lists
articles, with the first prompt (the turn reads anyway), with the abort signal, or after a bound.
The read calculates the templates, the planner keeps them, and the first turn's read takes about
8 ms. The hosts get what the runner's wait loop gives the benchmarks.

**What it saves.** About 0.75 s on the first prompt of every page in the ligna-store and in the
example's chat window, with Furniture_Smith's 111 articles; more with a library of more articles
without docking vectors of their own. Nothing in the later turns, nothing in the benchmarks and in
"test the mcp".

**What it costs.**

- 0.75 s of the planner's main thread on every page that runs the assistant, also when nobody
  prompts — today the same task runs on the first prompt. It falls shortly after the catalog load,
  while the planner may still load the plan's groups, so the plan may appear up to 0.75 s later.
  The measurement checks the time to the loaded plan with and without the warm-up; if it is later,
  the warm-up waits until the plan's groups are loaded.
- A prompt within the first seconds finds the warm-up read running; its own reads wait for it in
  `oneAtATime` and are then warm — never later than today.
- The empty reads before the catalog loads, about 1 ms each.
- An embedding-lib change: a build, asked for. The ligna-store and the example get it with the pin.

**The measurement** is without a model, as for proposal D: the probe of §3 on a fresh example page
with the chat enabled and no prompt sent — the config served, the assistant started, no model
request — reads the library reference a few seconds after the catalog load. Before the change it
takes about 0.79 s, after it about 8 ms; the time to the loaded plan stays within the spread of
three pages. A unit test of the embedding-lib covers the warm-up: the read repeated until the
catalog lists articles, ended by the first prompt, the abort and the bound, and no message of the
warm-up in a turn.

## 6. Alternatives, rejected

| Alternative | Why not |
|---|---|
| F as proposed: the compacted context kept from the first read until the next catalog load (`hi-tools.ts`, `hi-library-context.ts`) | About 5 ms per read, 10–25 ms per turn; the first read stays at 0.75 s. An invalidation by object identity, a failed template kept out, and one object shared by every reader ([§4](#4-the-gap)) |
| The context or the templates built at the catalog load in the planner (`HomagIntelligence.loadCatalog` into the tools) | The 0.75 s on every planner page, also those of the UI alone, which needs no template; a step in the planner's load path for the agent's benefit |
| The warm-up when the chat window opens | The window is a panel of the planner and the assistant lives in the host page; it needs a new callback between them for the same effect. In the example with a model, the window is open from the start |
| The templates calculated in slices, so that the planner's view keeps reacting | It spreads the 0.75 s, it does not take them. A candidate if the long task proves visible — a planner change in `createLibraryContext` |
| The docking vectors delivered with the library's article catalog | A change of the data the library calculates; the templates are the library's own calculation, which the planner runs anyway |
| The templates kept across pages, keyed by a digest of the catalog | A versioned browser cache for 0.75 s per page |
| No change | The 0.75 s stay on the first prompt of a page in the hosts. A valid choice: it is one prompt per page |

## 7. Code and documents the work would touch

| Repository | Code | Documents |
|---|---|---|
| roomle-ui | `packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts` (the warm-up after the setup), `tests/unit/embedding-lib/homag-intelligence/hi-planning-assistant.spec.ts` | `.agents/homag-intelligence/agent-architecture.md` (the start of the assistant), a decision row of `prompt-caching.md`; ADR 0013 unchanged — its consequence stays true |
| roomle-hi-example | the embedding-lib pin of `minimal-hi-example/index.html` with the build | this analysis; [the time-to-first-attempt analysis](planning-assistant-time-to-first-attempt.md) (§2, F, §7, §10); the backlog item "Caching the library context" leaves the backlog — rejected, or replaced by the warm-up while it is open; `docs/setup` and `.agents/context` with the pin |
| ligna-store | — | the embedding-lib pin with the build |

## 8. Measurement gaps

- One library: Furniture_Smith with 111 articles, all without docking vectors of their own. The
  cost of the first read grows with the number of such articles.
- The probe measures the read from the example page and inside the planner frame, not the first
  turn of a real conversation; the first turn adds the plan state's wait in `oneAtATime`, 17–27 ms
  in benchmark 07.
- That the view does not react during the 0.75 s follows from the synchronous code; no frame was
  measured.
- The local planner on :5173 serves the source with Vite; the deployed planner is a production
  build, whose calculation may be faster.

## 9. Decisions to take before the plan

1. **F as proposed** — the compacted context kept: rejected with this measurement, and the backlog
   item leaves the backlog. Recommended.
2. **The warm-up read of the assistant** — 0.75 s on the first prompt of a page in the hosts, for
   an embedding-lib change and a build. Recommended, with the next embedding-lib build rather than
   a build of its own.
3. **Its bound and interval**, and whether it waits for the plan's groups — decided in the plan,
   and on the measurement of the time to the loaded plan.
