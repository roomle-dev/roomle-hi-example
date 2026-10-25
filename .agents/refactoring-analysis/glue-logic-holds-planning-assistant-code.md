# The glue logic holds implementation of the Planning Assistant

> **Type**: Refactoring analysis
> **Status**: Open
> **Date**: 2026-10-25
> **Base**: roomle-hi-example `docs/analyse-glue-logic-holds-planning-assistant-code` on `master`
> `575d0da`; roomle-ui `feat/hi-mcp` `80b1d3145` (local, 18 commits ahead of `origin/feat/hi-mcp`
> `5d4a0f314`; the lines below are those of `80b1d3145`)
> **Backlog**: [mcp-issues.md #108](../backlog/mcp-issues.md#108-the-glue-logic-holds-implementation-of-the-planning-assistant)

## Affected repositories

- **roomle-ui** (`feat/hi-mcp`) — `homag-intelligence/src/`: the methods of `glue-logic.ts` that
  only the HI tools reach move into the tools (`hi-tools.ts`); the UI's swap gets back an
  implementation of its own; the glue logic keeps its UI paths, the API function of the `posGroups`
  layout (it delegates to the tools), and opens the steps of its own the moved code runs; the tests
  of the moved methods move with them. Documents: `.agents/homag-intelligence.md`,
  `.agents/homag-intelligence/` (`agent-architecture.md`, `hi-tools-behaviour.md` — the state of
  D110 —, `tool-executors.md`, `layout-and-placement.md`, `library-errors.md`,
  `coordinate-systems.md`) and the ADR `.agents/decisions/hi-mcp-tool-logic-in-the-planner.md`.
- **roomle-hi-example** — the backlog item leaves at close-out; the wiki page
  [why-the-agent-cannot-plan-what-the-library-cannot-build.md](../wiki/why-the-agent-cannot-plan-what-the-library-cannot-build.md)
  names the article picks and the calculation by their place in `glue-logic.ts`.
- **embedding-lib** (in roomle-ui) — unchanged: `createHiMcpTools` forwards the calls. No new
  version.
- **ligna-store** — unchanged: it gets the change with the planner.
- **RoomleCore**, **HOMAG library** — unchanged.

## Summary

- `glue-logic.ts` holds about 590 lines that only the Planning Assistant reaches, apart from the
  planner's public `posGroups` layout load: the create of a `posGroups` layout with the article
  picks, the kept sub module inputs, the inherited attributes and the id remap; the article
  template; the interior fittings; the agent's part of the exchange. D110 places them in the HI
  tools.
- The trace confirms four of the six groups the backlog item names and corrects two:
  - `loadWithChangedAttributes` and `arrangeAndLoad` (with `groupBeforeChange`) are steps of the
    UI's own paths. The UI's `modifyAttribute` and `swapRootModule` run them; they were split out of
    those paths so that the tools could share them (`3a1ea137b`, `385a64252`). They stay.
  - `swapRootModuleWithAttributes` is the UI's swap with two additions of the agent (`ff972b316`,
    `e55be7ab1`). The item lets the UI's `swapRootModule` delegate to the tools; D110 implements the
    UI's manipulations in the glue logic. The UI's swap gets back its own form, and the tools'
    exchange runs the swap's steps itself.
- `findPosArticleKey` and `_replaceRootModuleIdsAndRemapDockedRoots` move as well: only the moved
  code calls them. `modifyAttributesOfModules`, `verifiedOptionsOfModule` and
  `collectModulesWithAttribute` serve the UI too and stay.
- The moved code runs steps of the glue logic that every path runs: the calculation, the library's
  initial checks, the arrangement, the group map, the host notification. They stay in the glue
  logic. The recommendation makes the ones the moved code calls public members without underscore,
  as `381f4b968` did for the members the tools already use (decision 1).
- No behaviour changes: the same steps run in the same order. Baseline: the ten test files of the
  area, 813 tests, pass on `80b1d3145`.
- Four decisions are open (section 6).

## 1. What the current code does

roomle-ui paths are relative to `packages/web-sdk/packages/homag-intelligence/src/`; a bare line
number is one of `glue-logic.ts`.

### 1.1 How the tools reach the glue logic

- `GlueLogicImplementation` (`:560`) creates its tools, `_hiTools = new HiToolsImplementation(this)`
  (`:566`), and delegates the agent's API functions to them: `getPlanContext` (`:1197`),
  `getLibraryContext` (`:1204`) and `executeGroupOperation` (`:1216`); `getAgentPrompts` (`:1223`)
  delegates to `hi-agent-prompts.ts`.
- `HiToolsImplementation` (`hi-tools.ts:318`) holds the glue logic as `_glueLogic` (`:319`) and calls
  its public members at 66 places. It imports the glue logic's types only (`hi-tools.ts:63-67`);
  the glue logic imports `HiToolsImplementation` at runtime (`:43`). The tool commands
  (`hi-tool-commands.ts`, `hi-tool-*.ts`) never touch the glue logic: they reach the planner through
  `HiToolPlanner` (`_toolPlanner`, `hi-tools.ts:325`).
- The planner sees the `GlueLogic` interface only (`homag-intelligence.ts:69`, `:363`). No module
  outside `homag-intelligence` names `GlueLogicImplementation` or `LayoutGroupOutcome`.
- `381f4b968` (2026-10-15) made the glue logic's members the tools use public and dropped their
  underscore; `d495fabee` (2026-10-13) moved the docking helpers both use into
  `pos-group-docking.ts`.

### 1.2 Who reaches each method

| Method | Line | Callers | Verdict |
|---|---|---|---|
| `createOrReplacePosGroupsFromLayout` | `:865` | `_loadGroupLayout` (`hi-tools.ts:514`); `createOrReplacePosDataFromArticleLayout(…, 'posGroups')` (`:750`) | agent and the public layout load (1.3) |
| `_keepSubModuleInputsOfKeptRoots`, `_inheritAttributesOfAddedRoots`, `_replaceRootModuleIdsAndRemapDockedRoots` | `:1689`, `:1745`, `:1162` | the create only (`:904`, `:909`, `:914`, `:930`) | agent |
| `prepareArticlePickRoots`, `_isArticlePickRoot` | `:1032`, `:965` | the create (`:896`), the template (`:1138`), `_expandArticlePick` (`hi-tools.ts:1457`) | agent |
| `_applyRootAttributeOverrides`, `overrideTargetsOf` | `:978`, `:1009` | `prepareArticlePickRoots` (`:1087`), `inheritNeighbourAttributes` (`:1676`), the swap with the agent's attributes (`:2823`); `_checkAttributeValues` (`hi-tools.ts:1647`) | agent — the UI's swap sends no attributes, so the method returns at once (`:983`) |
| `inheritNeighbourAttributes` | `:1665` | `_inheritAttributesOfAddedRoots` (`:1760`); merge, exchange and insert of the tools (`hi-tools.ts:887`, `:958`, `:1074`) | agent |
| `calculateArticleTemplate` with its cache `_articleTemplates` | `:1105`, `:568` | the tool planner and the library context (`hi-tools.ts:336`, `:366`), `_checkAttributeValues` (`:1629`); `loadPosData` clears the cache (`:671`) | agent |
| `findPosArticleKey` | `:1252` | `prepareArticlePickRoots` (`:1039`), the template (`:1109`), `_requirePosArticleKey` (`hi-tools.ts:1594`) | agent once the two move |
| `getInteriorDesignOptions`, `editInterior` | `:3031`, `:3046` | `_createPlanContext` (`hi-tools.ts:428`), `editInterior` (`hi-tools.ts:446`) | agent |
| `LayoutGroupOutcome` | `:345` | the create; `LoadOutcome` (`hi-tool-payload.ts:1`, `:292`) | agent |
| `swapRootModuleWithAttributes` | `:2788` | the UI's `swapRootModule` (`:2779`, from the planner's swap in child-object mode, `roomle-planner.ts:2189`); `exchangeRootModule` (`hi-tools.ts:977`) | UI, with two additions of the agent (1.4) |
| `arrangeAndLoad`, `groupBeforeChange` | `:2876`, `:2865` | the UI's swap (`:2846`, `:2830`); the row edits of the tools (`hi-tools.ts:912`, `:1106`, `:1251`, `:1413`, `:1555`; `:882`, `:950`, `:1064`, `:1171`, `:1331`, `:1514`) | shared — split out of the UI's swap (`385a64252`) |
| `loadWithChangedAttributes` | `:2449` | the UI's `modifyAttribute` (`:2445`); `_changeAttributes` (`hi-tools.ts:637`) | shared — split out of the UI's path (`3a1ea137b`) |
| `modifyAttributesOfModules` | `:2937` | the UI's `updateAttribute` and `modifyAttribute` through `_modifyAttributeOfModules` (`:2399`, `:2435`, `:2924`); `_changeAttributes` (`hi-tools.ts:625`) | shared |
| `verifiedOptionsOfModule`, `collectModulesWithAttribute` | `:2481`, `:2725` | the UI's `getVerifiedAttributeOptions` (`:2472`) and `_groupAttributesByModule` (`:2592`); `_checkAttributeValues`, `_attributeTargets` (`hi-tools.ts:1654-1700`) | shared |
| `createOrReplacePosDataFromArticleLayout` | `:743` | the planner's `loadExternalObjectGroupLayout` (`roomle-planner.ts:2500`); the debug-logging wrapper (`debug-logging.ts:395`) | API function of the `GlueLogic` interface |

The other members the tools call — `getGroup`, `getLibraryData`, `getLibraryIdForPosData`,
`requestKernelOperation`, `getNextID`, `replacesModuleIDs`, `findModule`,
`findRootModuleInAllGroups`, `changedGroupFromHistory`, `removedGroup`, `designerRequests`,
`libraryData`, `posArticleMap`, `posSubArticleMap` — serve the UI or the kernel's reports as well.

### 1.3 The public `posGroups` layout load

`loadExternalObjectGroupLayout(layout, layoutType, options)` is a public method of the planner,
documented in `external-object-api.ts:360` with the types `nobila` and `posGroups`. It calls
`createOrReplacePosDataFromArticleLayout` (`roomle-planner.ts:2512`), whose `posGroups` branch is the
create (`:748-752`) and whose `nobila` branch builds one group from the shapes of a layout
(`:753-835`). No code in roomle-ui, ligna-store or roomle-hi-example loads a `posGroups` layout
through the planner: the tools load through `_loadGroupLayout` in the planner itself (D71, D94), and
the embedding-lib catalog demo loads `nobila` (`homag-intelligence-catalog-example.ts:348`, `:368`).
The `posGroups` type is a documented contract without a caller. The `nobila` branch is no code of
the Planning Assistant and stays.

### 1.4 The swap

The UI's `swapRootModule` (`:2779`) calls `swapRootModuleWithAttributes` without attributes and
drops its result. The method builds the new root module from the catalog article (`newPosDataFromId`,
`:2805`), passes the neighbour's implicitRelevant attributes on (`_applyImplicitRelevantAttributes`,
`:2817`), sets the position and the rotation, takes the group before the change (`:2830`), carries
the docking context over (`transferDockingContext`, `:2841`) and calculates, arranges and loads the
group (`arrangeAndLoad`, `:2846`). Two parts were added for the agent: the sent attributes as
overrides (`_applyRootAttributeOverrides`, `:2823`, `e55be7ab1`) and the dockings the new article has
no vector for as the result (`droppedDockings`, `:2857`, `ff972b316`), which the tools report as
corrections (`hi-tools.ts:977-1009`).

### 1.5 The steps of the glue logic the agent-only code runs

| Moved code | Steps of the glue logic it runs | Also run by |
|---|---|---|
| the create, new group | `_addNewGroup` (`:2356`), `_solveInitialNewGroup` (`:3626`), `_arrangeRootModulesAndCalculateIfChanged` (`:3515`), `_storeCalculatedGroup` (`:2334`); on an exception the group leaves `_groupMap` (`:953`) | the drag-in (`newPosDataFromId`, `:735`), the `nobila` layout (`:828`), the calculation of every change (`_runGroupCalculation`, `:2306`, `:2320`) |
| the create, replace | `_calculateAndUpdateGroupMap(item, true, true)` (`:919`) | every UI change |
| the create, at the end | `_groupsModified(added, changed, [])` (`:960`) | every UI change |
| the article picks | `_updateRootModuleFromArticle` (`:837`) | the drag-in (`:726`), the `nobila` layout (`:806`), a loaded plan (`:1926`) |
| the inherited attributes | `_applyImplicitRelevantAttributes` (`:1604`) | the UI's merge (`:1563`) and swap (`:2817`) |
| the article template | `_replacesIDs` (`:3421`), `_initializePosGroup` (`:3684`), `_updatePosData` (`:3822`), `_logFailedRootModules` (`:2344`) with `rootModulesWithCalculationError` (`:472`) | a new group (`_calculateNewGroup`, `:2201`), every calculation (`_calculate`, `:3488`) |
| the interior edit | `_takeOverPropertiesFromOriginalGroup` (`:3854`), `_addGroupToMap` (`:2368`), `_groupsModified` | every calculation (`_updatePosData`), the sub-article edits of the UI (`:3750`, `:3792`, `:3818`) |
| the agent's exchange | `_applyImplicitRelevantAttributes`, `transferDockingContext` (`:386`), `_getArrangementCorrectionEnabled` (`:562`) | the UI's swap |

### 1.6 Why it is a problem

- D110: a change for the agent never changes `glue-logic.ts`. While these methods are in it, every
  fix of the create, the article picks, the template, the interior fittings or the exchange changes
  the glue logic. Item 111 shows it: the ids it names come from
  `_replaceRootModuleIdsAndRemapDockedRoots` (`:930`, `:1169`).
- The reader cannot tell the UI's code from the agent's in a class of 3,918 lines. The swap shows
  it: one method serves the UI's swap and the agent's exchange, and the agent's attributes run
  through the UI's path.
- The living reference describes the state as open work: `agent-architecture.md` lists the methods
  that "move to the tools", and the state of D110 points to this item.

## 2. The target shape

### 2.1 What moves to the tools

Into `HiToolsImplementation` (`hi-tools.ts`):

- **The create of a `posGroups` layout** — the loop over the input groups with the outcome per group,
  beside `_loadGroupLayout`, its caller in the tools; `_keepSubModuleInputsOfKeptRoots`,
  `_inheritAttributesOfAddedRoots`, `_replaceRootModuleIdsAndRemapDockedRoots`.
  `LayoutGroupOutcome` moves to `hi-tool-payload.ts`, where `LoadOutcome` builds on it. The `HiTools`
  interface (`hi-tools.ts:303`) gets the create, so that the API function can delegate (2.4).
- **The article picks** — `prepareArticlePickRoots`, `_isArticlePickRoot`,
  `_applyRootAttributeOverrides`, `overrideTargetsOf`, `inheritNeighbourAttributes`,
  `findPosArticleKey`.
- **The article template** — `calculateArticleTemplate` with its cache (2.5).
- **The interior fittings** — `getInteriorDesignOptions` into `_createPlanContext`, the glue logic's
  `editInterior` into the tools' `editInterior` (`hi-tools.ts:436`), which wraps it already.
- **The agent's exchange** — `exchangeRootModule` runs the swap's steps itself (2.3).

`hi-tools.ts` grows from 1,717 to about 2,300 lines, and `glue-logic.ts` shrinks to about 3,350. The
article picks need only the catalog, the master data and the ids; the plan may give them a module of
their own beside `hi-tools.ts`.

### 2.2 What stays in the glue logic

- Every UI path, unchanged.
- The steps shared with the UI (1.2): `arrangeAndLoad`, `groupBeforeChange`,
  `loadWithChangedAttributes`, `modifyAttributesOfModules`, `verifiedOptionsOfModule`,
  `collectModulesWithAttribute`, and the members of the last paragraph of 1.2.
- The steps of 1.5 the moved code runs. With decision 1 (a) they become public members without
  underscore: `addNewGroup`, `solveInitialNewGroup`, `arrangeRootModulesAndCalculateIfChanged`,
  `storeCalculatedGroup`, `calculateAndUpdateGroupMap`, `groupsModified`, `addGroupToMap`,
  `updateRootModuleFromArticle`, `applyImplicitRelevantAttributes`,
  `takeOverPropertiesFromOriginalGroup`, `replacesIDs`, `initializePosGroup`, `updatePosData`, a
  getter of the arrangement correction setting, and one member that takes a group out of the group
  map without a report (the create's exception path, `:953`; `removedGroup` would report it to the
  host). `_logFailedRootModules` stays private: the template logs its failed root modules itself
  with `calculationErrorOf` (`hi-plan-context.ts:339`).
- `transferDockingContext` with `uniqueDockingVectorIndex` (`:363-440`) moves to
  `pos-group-docking.ts`, as `d495fabee` did with the docking helpers both use: the tools cannot
  import a function of `glue-logic.ts` without an import cycle (1.1).

### 2.3 The UI's swap and the agent's exchange

- `swapRootModule` keeps the implementation of the UI's swap: the body of
  `swapRootModuleWithAttributes` without the sent attributes and without the result, as before
  `ff972b316`. `swapRootModuleWithAttributes` leaves the glue logic.
- `exchangeRootModule` (`hi-tools.ts:927`) runs the same steps after its staged verdict:
  `newPosDataFromId`, `applyImplicitRelevantAttributes`, its own attribute overrides, the position
  and the rotation, `groupBeforeChange`, the new id in the group before the change,
  `transferDockingContext` for the dropped dockings, `arrangeAndLoad` with the arrangement
  correction setting and the `SWAP_MODULE` reason with the module id map. About 30 lines of the swap
  run on both sides; D110 accepts the split ("even where that splits up logic").
- `newPosDataFromId` puts the catalog article into the group map as a group of its own and reports it
  to the host (`:735-739`); that group never reaches the scene. Both sides keep this, as the swap does
  now.

### 2.4 The API function of the `posGroups` layout

`createOrReplacePosDataFromArticleLayout` keeps its signature and its `nobila` branch, and hands a
`posGroups` layout to the tools: `this._hiTools.<create>(layout)`, as `getPlanContext` and
`executeGroupOperation` delegate. The planner's `loadExternalObjectGroupLayout`, the debug-logging
wrapper and `roomle-planner.ts` stay untouched. The public load keeps its behaviour: it builds the
groups the library calculates with errors and loads them; the discard (D106) stays in
`_loadGroupLayout`, which only the tools call.

### 2.5 The cache of the article templates

The cache moves with the template. `loadPosData` clears it (`:671`) when an article catalog loads,
and that clear must not stay in the glue logic as a call into the tools. Recommended: the tools key
the cache by the catalog article (`WeakMap<PosArticle, Map<string, PosGroup>>`, the inner key the
attribute overrides). `loadPosData` puts a fresh copy of every article into `posArticleMap`
(`:674-680`), so a catalog loaded again misses the cache on its own, and `loadPosData` keeps no line
of the tools. The one difference: when the catalog of one library loads, the templates of another
library's articles stay cached; they come from the same article and the same library, so they are
the same templates.

### 2.6 Public signatures

- **Unchanged:** the `GlueLogic` interface, `createOrReplacePosDataFromArticleLayout` and
  `swapRootModule` with it; the planner's `loadExternalObjectGroupLayout`; the `HiToolPlanner`
  interface of the tool commands; the tools' result shapes.
- **Removed from `GlueLogicImplementation`** — public members outside the `GlueLogic` interface,
  called only by the tools and the tests (1.1):
  `createOrReplacePosGroupsFromLayout`, `prepareArticlePickRoots`, `overrideTargetsOf`,
  `inheritNeighbourAttributes`, `calculateArticleTemplate`, `findPosArticleKey`,
  `swapRootModuleWithAttributes`, `getInteriorDesignOptions`, `editInterior`; the exported type
  `LayoutGroupOutcome` moves to `hi-tool-payload.ts`. The removal is what the item asks for; it is
  listed here so that nothing leaves unseen (decision 4).
- **Added:** the create on the `HiTools` interface; the public members of 2.2 (decision 1).

## 3. Alternatives

- **The UI's `swapRootModule` delegates to the tools**, as the backlog item's to-do says. The UI's
  manipulation would then be implemented in the tools, against the first sentence of D110: the glue
  logic implements the manipulations through the planner's UI. Rejected.
- **One swap in the glue logic with a hook for the agent's root module** — the tools pass a function
  that sets the overrides. It saves the 30 lines, but the agent's need stays in the glue logic's
  signature, and the next need of the exchange changes the glue logic again. Rejected.
- **The create stays in the glue logic for the public load, and the tools call it.** That is the
  current state; the article picks, the kept inputs and the inherited attributes were built for the
  agent (`74f22512d`, `e55be7ab1`, `e05c597ed`). Rejected.
- **The tools run every library step through `LibraryData` on a copy and store through the glue
  logic's reports only** (`changedGroupFromHistory`, `removedGroup`) — decision 1 (b).

## 4. Scope

### roomle-ui (`feat/hi-mcp`)

- `homag-intelligence/src/glue-logic.ts` — the moved members leave; `swapRootModule` gets its own
  body; `createOrReplacePosDataFromArticleLayout` delegates `posGroups`; the steps of 2.2 become
  public; `_articleTemplates` and its clear leave.
- `homag-intelligence/src/hi-tools.ts` — the moved members; the exchange's swap; the `HiTools`
  interface.
- `homag-intelligence/src/hi-tool-payload.ts` — `LayoutGroupOutcome`.
- `homag-intelligence/src/pos-group-docking.ts` — `transferDockingContext`,
  `uniqueDockingVectorIndex`.
- Tests (section 5).
- `.agents/homag-intelligence.md` — the package layout (`:92`, "calculateArticleTemplate"), and the
  lines that place a moved method in the glue logic (`:128`, `:188`, `:196`, `:228`, `:237`, `:239`,
  `:273`, `:286`, `:289`, `:292`, `:402`).
- `.agents/homag-intelligence/agent-architecture.md` — "The glue logic, its HI tools and the HI tool
  commands" (`:262-324`; the open-work sentence at `:298`), `:524`, and the row "What a plan-changing
  tool does" of "Where a change goes", which names the glue logic.
- `.agents/homag-intelligence/hi-tools-behaviour.md` — the state of D110 (`:154`) and the lines that
  name a moved method (`:191`, `:248`, `:296`, `:304`, `:357`, `:385`, `:391`, `:1072`).
- `.agents/homag-intelligence/tool-executors.md` (`:72`, `:168`, `:169`, `:215`, `:218`, `:468`),
  `layout-and-placement.md` (`:187`), `library-errors.md` (`:69`, `:74`, `:110`, `:153`, `:154`,
  `:173`, `:287-291`), `coordinate-systems.md` (`:522`, `:529`).
- `.agents/decisions/hi-mcp-tool-logic-in-the-planner.md:24-25` — "the article template the glue
  logic calculates".

### roomle-hi-example

- The wiki page
  [why-the-agent-cannot-plan-what-the-library-cannot-build.md](../wiki/why-the-agent-cannot-plan-what-the-library-cannot-build.md)
  (`:48`, `:94`, `:98`): the article picks and the new group by their place after the move.
- At close-out: backlog item 108 and its row in `.agents/backlog/README.md` leave.

## 5. Tests

Baseline on `80b1d3145`, run in `packages/web-sdk`:
`npm run test -- --run glue-logic-test hi-tools-test article-template-test hi-interior-design-test hi-tool-commands`
— 10 files, 813 tests pass. The same command passes after the move with the same count; no
expectation changes.

- `__tests__/glue-logic-test.ts`, `describe('createOrReplacePosDataFromArticleLayout - posGroups')`
  (`:7298-8200`) — tests of the create through the API function. They move to
  `__tests__/hi-tools-test.ts` and call the tools' create; the six that call
  `createOrReplacePosGroupsFromLayout` directly (`:8031-8182`) with them. `glue-logic-test.ts` keeps
  the `nobila` tests and gets one test that a `posGroups` layout reaches the tools' create.
- `__tests__/article-template-test.ts` — `describe('calculateArticleTemplate')` calls the tools'
  template on `new HiToolsImplementation(glueLogic)`, as `hi-tools-test.ts:74` builds them;
  `it('forgets the templates when the library templates are loaded again')` guards the cache of 2.5.
- `__tests__/hi-interior-design-test.ts` (`:1079-1180`) — the tests of `editInterior` call the
  tools' `editInterior(groupId, edit)`.
- `__tests__/glue-logic-test.ts`, the swap tests (`:2402-2900`) — they call the UI's
  `swapRootModule` and stay; they guard that the UI's swap is kept, among them
  `it('drops docking references whose dock id is missing on the new article and reports them')`,
  which reads the dropped docking from the console. The agent's side, the sent attributes and the
  dropped docking as a correction, is guarded by
  `it('applies the attribute overrides to the new root and reports the docking it cannot take')`
  (`hi-tools-test.ts:2283`).
- `__tests__/hi-tools-test.ts` and `__tests__/hi-tool-commands/` — the exchange, the row edits, the
  attribute changes and the create pass unchanged; they guard that the tools' behaviour is kept.
- The grep of the backlog item's **Reproduce**: outside `glue-logic.ts`, no code calls a moved
  member; inside it, no UI path does.

## 6. Open decisions

1. **How the moved code reaches the glue logic's steps.**
   - (a) **Recommended:** the steps of 1.5 stay in the glue logic and become public members without
     underscore (2.2), as `381f4b968` did; the tools call them as they call `arrangeAndLoad`. The
     same code runs in the same order, so the behaviour is kept by construction.
   - (b) The tools run every library step through `LibraryData` on a copy and touch the group map
     only through the glue logic's reports (`changedGroupFromHistory`, `removedGroup`). No new public
     member, but the create re-implements the calculation of a new group — the calculation, the
     group check, the arrangement and the state of the group item (`calculationInProgress`,
     `pendingArrangement`, `lastCalculatedPosDataJson`) —, and storing a new group through
     `changedGroupFromHistory` calculates it once more: a behaviour change a refactoring should not
     carry. The article template is the exception where (b) costs little: it is calculated outside
     the plan and needs only `getNextID` and the take-over of the article's properties.
2. **The swap:** (a) **recommended** — the UI's `swapRootModule` keeps its own implementation and
   the tools' exchange runs the swap's steps itself (2.3); (b) the backlog item's to-do, the UI's
   swap delegating to the tools (rejected in section 3).
3. **The cache of the article templates:** (a) **recommended** — keyed by the catalog article
   (2.5); (b) `loadPosData` calls the tools to clear it.
4. **The removal of the public members of 2.6** — confirm that they leave the class. None of them is
   in the `GlueLogic` interface or used outside `homag-intelligence`.

## 7. Related work and observations

- **Item 111** names the root modules of a discarded new group by the ids the planner gave them;
  its to-do pairs them with the call's roots by order. `_replaceRootModuleIdsAndRemapDockedRoots`
  holds the exact pairing — the call's id to the new id (`idMap`, `:1166`). With the create in the
  tools, `_loadGroupLayout` can name them from that map. Doing 108 first makes the fix of 111
  exact; 111 stays an item of its own.
- **Outside the scope, unchanged by the move:** a new group of a create that the tools discard is
  reported to the host as added (`_groupsModified`, `:960`) and then as deleted (`removedGroup`,
  `hi-tools.ts:555`); a discarded replace is reported as changed twice. With the create in the
  tools, the verdict could come before the report — a behaviour change for an item of its own.

## 8. Risks

- **The swap on two sides.** A later fix of the UI's swap does not reach the agent's exchange, and
  the other way round. That is what D110 asks; the swap tests of `glue-logic-test.ts` and the
  exchange tests of `hi-tools-test.ts` guard each side.
- **The template cache by article object.** It holds as long as nothing changes a catalog article in
  place: `loadPosData` stores copies, and every reader copies the article first
  (`prepareArticlePickRoots`, `newPosDataFromId`).
- **The size of `hi-tools.ts`.** About 2,300 lines after the move (2.1).
- **The unpushed base.** The lines are those of the local `feat/hi-mcp` `80b1d3145`; the plan
  re-reads them on the branch it starts from.
