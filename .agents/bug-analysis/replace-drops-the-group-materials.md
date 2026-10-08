# Bug Analysis: a replace drops the group's materials

> **Type**: Bug Analysis
> **Domain**: hi-mcp — `create-or-replace-groups` (`applyKitchenWideAttributes`, `tool-executors.ts`), the served text of the tools that add a root module (`hi-mcp-server.ts`); roomle-ui `homag-intelligence` — the group load (`_createOrReplacePosGroupsFromLayout`, `glue-logic.ts`), the compacted master data (`compactMasterData`, `hi-plan-context.ts`)
> **Trigger**: [RML-18075](https://roomle.atlassian.net/browse/RML-18075) with the decisions of [comment 155885](https://roomle.atlassian.net/browse/RML-18075?focusedCommentId=155885); backlog [`mcp-test-open-issues.md`](../backlog/mcp-test-open-issues.md) issues 51 and 39; related: [RML-18041](https://roomle.atlassian.net/browse/RML-18041) (D36), [RML-18074](https://roomle.atlassian.net/browse/RML-18074) (D54), issue 52 of the same backlog
> **Date**: 2026-10-08
> **Author**: AI Assistant
> **Status**: Open — implemented on `fix/replace-keeps-group-materials-RML-18075` in roomle-ui (based on `fix/unit-attribute-reaches-fronts-RML-18074`) and roomle-hi-example, [verified by the unit tests](#verification), not merged

## Affected repositories

- **roomle-hi-example**: the server takes the library's group settings from the master data instead
  of the loaded group, so a replace sets the group's materials like a create does. The names in
  `tool-executors.ts` speak of groups, not kitchens. The descriptions of the tools that add a root
  module say that it takes the materials of its neighbour. Also: tests, `docs/hi-mcp-behaviour.md`
  (D36, D48, two new decisions), the tool references, the implementation docs, and backlog issues
  51 and 39.
- **roomle-ui**: the compacted master data names the library's group settings. A new root module
  added by a replace, by `merge-article-into-group` or by `insert-article-into-group` takes the
  materials of its neighbour, as the planner's own merge does. Tests and the command JSDoc change
  with it.

Not changed:

- **RoomleCore**: the kernel's merge and the library's calculation stay as they are.
- **ligna-store**: it gets the roomle-ui part with the roomle-ui deployment. Its page bridge passes
  the plan context through, like the example page.

## Symptom

1. `create-or-replace-groups` creates a group with materials in the group's `attributes`, for
   example `mod_FrontColor` 190 and `mod_CountertopColor` 216. The server sets each of them on
   every unit and reports it (D36, G46).
2. `create-or-replace-groups` then sends the same group again under its id, a replace, with the
   same group `attributes`.

The replace runs no `change-group-attribute` and reports nothing about the materials. Its root
modules show the defaults of their article templates: dark fronts and a white marble worktop
instead of cream fronts and a walnut worktop. The served rules promise the opposite: a material for
the whole group "goes into the group's attributes …, and the server sets it on every root module
and on the worktop" (`AUTHORING_RULES`, `hi-mcp-server.ts:8`).

A second gap comes from the ticket's decisions (see [Decisions of the ticket](#decisions-of-the-ticket)):
an article added to a group with `insert-article-into-group` or `merge-article-into-group` keeps
the materials of its article template, while the planner's own add gives it the materials of its
neighbour.

## Reproduction

The run is `mcp-test-2026-10-07_11-58-22`, gpt-6-astra. The payloads are in `run.json`, the
planner calls in `planner-calls.json`.

### The replace (test 32, "image only, no text")

- Tool call 3 creates both groups with eight group attributes (`mod_FrontColor`,
  `mod_CarcaseColor`, `mod_CarcaseOutsideColor` 190, `mod_FrontProgram` Classic,
  `mod_HandleDesign` 100, `mod_HandlePosType` 02, `mod_CountertopColor` 216,
  `mod_CountertopProgram` Cube). Planner calls #76–#91 are the server's `change-group-attribute`
  for each of them on both groups, and the result reports 16 corrections.
- Tool call 6 replaces both groups with the same eight group attributes. The roots are written
  anew: `articleId`, a relation and `mod_Depth` only. Planner call #108 is the load. No
  `externalObjectGroupOperation` follows it, and the only correction is a G42 note about a wall
  unit.
- `plan-context.json` (the end of the run): both groups list exactly the eight sent attributes,
  and none of the root modules carries one of them. The renders show the default dark fronts and
  the white marble worktop on the right-hand row.

### After a create, the group lists the library's group settings

The same session shows what a group lists after a create. In tests 29, 30 and 31 every group lists
the seven attributes of the library's group orchestrator: `mod_GroupHeightAdjustment`,
`mod_GroupWidthAdjustment`, `mod_GroupGenerationLogic`, `mod_GroupHeight`, `mod_GroupWidth`,
`mod_VisibleSideSolution` and `mod_CarcaseDistanceWall`. None of the materials the call sent is
among them.

### The insert (test 12, backlog issue 39)

`insert-article-into-group` puts `LB_UB600` between two `KS_HT600` (planner call #5). The
neighbours carry `mod_CarcaseColor` 224, `mod_CarcaseOutsideColor` 224 and `mod_FrontColor` 160.
The inserted root module carries 229, 229 and 152, the values of its article template.

## Cause

### 1. The server takes the group settings from the loaded group

`applyKitchenWideAttributes` (`tool-executors.ts:1850`) sets on every unit each group attribute
that the loaded group does not list among its attributes:

```ts
const settingIds = new Set(
  ((result.attributes ?? []) as any[]).map((attribute) => attribute?.id)
);
```

(`tool-executors.ts:1863`). `result` is the group as the planner returns it after the load. The
server assumes that this list holds the library's group settings, and only those.

### 2. Only a create lets the library set the group's attributes

roomle-ui loads every group of the call in `_createOrReplacePosGroupsFromLayout`
(`glue-logic.ts:1000`):

- **A create** goes through `_addNewGroup` → `_calculateNewGroup`, which calls
  `_initializePosGroup` (`glue-logic.ts:2708`). That runs the library's group orchestrator
  (`libraryData.initializePosGroup`), which sets the group's `attributes` to the library's group
  settings. The materials the call sent are not among them.
- **A replace** sets `existingGroupItem.posDataJson = posGroup` (`glue-logic.ts:1037`) and
  calculates it. The group orchestrator does not run, so the group keeps the `attributes` as they
  were sent.

`shapeGroup` passes the group's `attributes` into the plan context unchanged
(`hi-plan-context.ts:697`). After a replace, the server therefore finds every sent material in
`settingIds` and sets none of them. The roots were rebuilt from their article picks, so the values
that the first call's `change-group-attribute` had written on every unit are gone.

### 3. The master data the server reads cannot tell the group settings today

The group settings are the `assignedAttributes` of the master data's group orchestrator module
(`mr_GroupOrchestrator`, `moduleType: 'GroupOrchestrator'`, `isGroupOrchestrator: true`). The server
reads the master data through `getExternalObjectPlanContext(['masterData'])` (`masterDataOf`,
`tool-executors.ts:1513`). That is roomle-ui's compacted master data, and `compactMasterData`
(`hi-plan-context.ts:257`) keeps only root modules and the generated root modules. The orchestrator
is not among them.

Two server-only rules were checked against the Furniture_Smith master data
(`docs/library-information/master-data.json`), and neither works:

- **"No root module carries it"**: `mod_GroupHeight` and `mod_CarcaseDistanceWall` are group
  settings, and `mr_StorageunitSingle` (and other modules for the second one) carries them as
  well.
- **The attribute's `group` field** ("Group management"): this is a naming convention of the
  library. `mod_CarcaseDistanceWall` is in "Carcase | Dimensions".

### Root cause

The served text promises that a material for the whole group reaches every root module. The server
keeps that promise only on a create, because it tells the library's group settings apart by a list
that the planner fills only on a create. The planner does not expose the list the server would need
(the group orchestrator's attributes).

## Decisions of the ticket

[Comment 155885](https://roomle.atlassian.net/browse/RML-18075?focusedCommentId=155885) sets two
decisions for this ticket.

### A. No "kitchen" in the names of `tool-executors.ts`

> "The hi-mcp/hi-mcp-server/tool-executors.ts file should avoid using the word 'kitchen' in the
> names of functions and variables. The MCP works with groups and articles. The products are
> furniture made of cabinets. The result can be a kitchen, but it can also be something else. This
> needs to be refactored in this context."

These names change:

| Today | New |
|---|---|
| `KitchenWideAttribute` (`tool-executors.ts:1481`) | `GroupWideAttribute` |
| `CallGroup.kitchenWide` (`:1490`, `:1581`, `:3134`) | `groupWide` |
| `applyKitchenWideAttributes` (`:1850`, `:3332`) | `applyGroupWideAttributes` |

The two comments of the file that name a kitchen change with them: "is meant for the kitchen"
(`:1529`) becomes "for the whole group", and "the rotation of a corner kitchen there" (`:825`)
becomes "the rotation of a group that starts with a corner article there". The documents that name
these identifiers or speak of "kitchen-wide attributes" follow (see [Fix](#fix), step 6). The test
variables named `kitchen` in `tests/tool-executors.test.ts` are outside the decision's file and
stay.

### B. A new root module takes the attributes of its neighbour, whatever the tool

> "When something is added to a group using the UI, the new root modules inherit attributes from
> the neighbouring root module in the group. The same is expected to happen when something is
> added to a group via the MCP, regardless of which tool is used to add a new root module."

**How the planner does it.** The planner's add, a drag onto a group, ends in the kernel's merge
callback `mergeGroups` (`glue-logic.ts:2166`). It calls `_applyImplicitRelevantAttributes`
(`:2238`) with the root module the new one docks to:

- For each attribute that the neighbour's master-data module assigns and the master data marks
  `implicitRelevant`, and that the new root module's module also has, the new root module takes
  the neighbour's value if the neighbour holds it as input (`isInput`).
- If the neighbour does not hold the value as input, the new root module's value stops being input
  as well, so the library's default applies.

roomle-ui's own test is "attributes should be transferred when groups are merged"
(`__tests__/glue-logic-test.ts:788`). Furniture_Smith marks 17 attributes `implicitRelevant`, among
them the fronts (`mod_FrontColor`, `mod_FrontProgram`), the handles (`mod_HandleDesign`,
`mod_HandlePosType`, `mod_HandleColor`), the carcase (`mod_CarcaseColor`,
`mod_CarcaseOutsideColor`, `mod_CarcaseDistanceWall`), `mod_PlinthAreaHeight`, the baseboard and
the ceiling filler. The worktop and toe kick colours are not among them: they belong to the
generated roots of the group.

**Where the MCP tools stand.**

| Tool | Adds a root module to an existing group | Takes the neighbour's attributes today |
|---|---|---|
| `merge-article-into-group` | yes — `mergeArticleIntoGroup` (`glue-logic.ts:1375`) loads the group with the new article pick through the replace path of `_createOrReplacePosGroupsFromLayout` | no |
| `insert-article-into-group` | yes — `insertArticleIntoGroup` (`:1503`) expands the pick with `_expandArticlePick` (`:1815`) | no (test 12) |
| `exchange-root-module` | yes, in place of another — `_swapRootModule` (`:3305`) | yes, from the root module it replaces (`:3334`), but no description says so |
| `create-or-replace-groups` | yes, a replace with new roots — the rules teach it: "several at once by adding the picks … to the group from get-plan-context and resubmitting it" (`hi-mcp-server.ts:25`) | no |
| `merge-groups` | no new root module — it joins two groups through the kernel's merge, the planner's own path | as the planner does (unchanged) |

Decision B extends backlog issue 39 ("a unit added to a coloured kitchen keeps the default
material") to every tool. It also replaces that issue's server-side to-do, the value that all
roots of the group share reported as a correction, with the planner's own rule.

## Fix

1. **roomle-ui — the compacted master data names the group settings.** `compactMasterData` adds
   `groupSettings`, the `assignedAttributes` of the module marked `isGroupOrchestrator` or
   `moduleType: 'GroupOrchestrator'` (an empty list when the library has none), to
   `HiPlanMasterData` (`hi-plan-context.ts:101`).
2. **roomle-hi-example — the server reads them from the master data.** `applyGroupWideAttributes`
   takes the group settings of the group's library from `masterDataOf`, not from the loaded group.
   Every other group attribute is set on every unit after the load, on a create and on a replace
   alike, and each is reported as today (G46). A planner whose master data names no
   `groupSettings` (a roomle-ui release without step 1) gets today's rule, the loaded group's
   list, so a create works there as before.
3. **roomle-ui — a new root module takes the attributes of its neighbour.** The planner's own
   `_applyImplicitRelevantAttributes` runs in two more places:
   - In the replace branch of `_createOrReplacePosGroupsFromLayout`, for every new root (an id that
     is not in the group yet, not generated) with a root it is docked to. This covers a replace with
     new roots and `merge-article-into-group`, which goes the same way, where the neighbour is
     `dockTo.rootId`.
   - In `insertArticleIntoGroup`, for the inserted root module.

   An attribute the agent sends for the new root module wins over the inherited one, as in
   `_swapRootModule` (inherit first, then `_applyRootAttributeOverrides`). `exchange-root-module`
   stays as it is.
4. **roomle-hi-example — the served text says what happens (D51).** The descriptions of
   `merge-article-into-group`, `insert-article-into-group` and `exchange-root-module` say that the
   new root module takes the materials of its neighbour (of the replaced root module, for
   `exchange-root-module`) and that its `attributes` override them. The "Extending a group" rule
   (`hi-mcp-server.ts:25`) says the same for picks added by a replace. The returned group shows the
   inherited values as the new root module's input attributes, so the result needs no new field.
5. **roomle-hi-example — the renames of decision A.**
6. **Documents.** In `docs/hi-mcp-behaviour.md`:
   - D36 is amended: on a create and on a replace, with the group settings taken from the master
     data.
   - D48 is amended: the master data names the group settings.
   - Two new rows: D56 for decision B, D57 for decision A.
   - §6 step 7, the command tools table, G46 and §4 ("kitchen-wide attributes") are updated.

   Also updated: `docs/hi-mcp-server.md`, `.agents/skills/hi-mcp-tools.md`,
   `docs/implementation/tool-executors.md` and `docs/implementation/README.md`. Backlog issues 51
   and 39 leave the backlog once the fix has landed, and the backlog's other mentions of the old
   name are updated.

### Defaults taken for the details of decision B

These defaults follow the planner. Say if one should be different:

1. **`insert-article-into-group`: the first-named root of `between`.** The inserted root module
   takes the attributes of `between[0]`, the root module the planner docks it to first, which C19
   also treats as the reference. The two neighbours usually share their materials.
2. **A replace: the neighbour as the call sends it.** In the call, the new root takes the
   attributes of the root it is docked to, as the call sends that root. A group resubmitted from
   `get-plan-context` carries each root's input attributes, so the neighbour has its values from
   the plan. A neighbour that the call itself changes passes on its new value. Several new roots in
   a chain take the attributes in docking order, starting from the roots that were already in the
   group.

## Open question

**A replace that sends existing roots without their attributes and the group without its
materials.** Neither the ticket nor its decisions cover this case: the agent writes the roots anew
(as in test 32) but leaves out the group `attributes`. The replace then builds what it was sent,
and the root modules fall back to their templates. The fix above does not change this. Run 32 sent
its materials as group attributes, so the fix covers it.

Recommendation: keep it. A replace builds what is sent (D11: a group from `get-plan-context` is
resubmitted as it is, with its roots' input attributes), and the rules teach both ways to keep the
materials. Alternatively, a root that already exists could keep the input values from the plan for
every attribute the call does not send. That would be new behaviour of the replace and would need
a decision.

**Decided (Gernot, 2026-10-08): kept.** A replace builds what it is sent. A root sent again without
its attributes takes those of its article template. The amended D36 records it.

## Consequences

- **A replace takes more planner steps:** one `change-group-attribute` per group material, as a
  create does. Each step is one more step on the planner's undo history, which `undo` counts (D38).
- **Backlog issue 52 also applies to a replace.** A group material overwrites a root module's own
  value of the same attribute. After a replace, `get-plan-context` lists the group's materials,
  because the planner keeps the sent `attributes`. An agent that resubmits such a group sets them
  again on every unit, over an accent set in between with `change-module-attribute`. Issue 52's fix
  (each root's own value set again after the group attribute) covers that and stays a ticket of its
  own.
- **`mod_CarcaseDistanceWall` is a group setting and an inherited attribute.** As a group attribute
  it stays with the group (as on a create today). Between neighbours it is passed on like the other
  `implicitRelevant` attributes.

## Implementation plan

Both repositories work on `fix/replace-keeps-group-materials-RML-18075`. In roomle-ui the branch is
based on `fix/unit-attribute-reaches-fronts-RML-18074` (D54, not merged yet). The line numbers are
those of roomle-ui `master` and roomle-hi-example `master`.

### roomle-ui

1. **The group settings in the compacted master data** (`hi-plan-context.ts`):
   - Add `isGroupOrchestratorModule` beside `isRootModule` (`:230`). It is true for
     `isGroupOrchestrator === true` or `moduleType === 'GroupOrchestrator'`, the same test that
     `_hasGroupOrchestrator` (`glue-logic.ts`) makes today. `_hasGroupOrchestrator` then uses it,
     so the test lives in one place.
   - Add `groupSettings: string[]` to `HiPlanMasterData` (`:101`).
   - `compactMasterData` (`:257`) fills `groupSettings` with the `assignedAttributes` of the
     orchestrator modules. A library without an orchestrator gets an empty list.
2. **One helper for passing attributes on** (`glue-logic.ts`):
   `_inheritNeighbourAttributes(group, neighbour, newRoots, sentAttributes)` runs
   `_applyImplicitRelevantAttributes` (`:2238`) from the neighbour onto the new roots. Then it runs
   `_applyRootAttributeOverrides` with the sent attributes on the first of them.

   The order matters. `_applyImplicitRelevantAttributes` overwrites an input value, and it clears
   `isInput` when the neighbour holds no input value. So the agent's attributes go on afterwards,
   as in `_swapRootModule` (`:3334`), which stays as it is.
3. **The replace branch** of `_createOrReplacePosGroupsFromLayout` (`:1022`–`:1044`). Before
   `_replaceRootModuleIdsAndRemapDockedRoots`, every new root takes the attributes of a root it is
   linked to (`areLinked`, `:617`). A new root is one whose id is not among `existingRootIds` and
   that is not generated.
   - Order: first the new roots linked to a root that was already in the group, then those linked
     to a new root that is done, until none is left.
   - A new root linked to nothing takes none.
   - A pick's sent attributes come from the input group's root with that id, because
     `_prepareArticlePickRoots` has already applied them once.

   This covers a replace with new roots, and `merge-article-into-group`, whose new pick is linked
   to `dockTo.rootId`. It also holds for every other caller of `loadExternalObjectGroupLayout` with
   `posGroups`: a root added by a replace takes its neighbour's attributes, as an add in the
   planner does.
4. **`insertArticleIntoGroup`** (`:1503`). Call `_expandArticlePick(articleId)` without the
   attributes, and call `_inheritNeighbourAttributes(group, first, newRoots, attributes)` once the
   docking entries are added.
5. **JSDoc** (`external-object-api.ts`). These entries say that a new root module takes the
   `implicitRelevant` input attributes of its neighbour, and that `attributes` override them:
   - in `externalObjectGroupOperation`, the lines of `merge-article-into-group` and
     `exchange-root-module` (`:476`, `:477`; for exchange, the neighbour is the replaced root
     module);
   - `loadExternalObjectGroupLayout` (`:291`).

   The list does not name `insert-article-into-group` today, and it stays that way.

### roomle-hi-example

1. **`tool-executors.ts`**:
   - The renames of decision A, and the two comments that name a kitchen.
   - New `groupSettingIdsOf(roomDesignerApi, group)`. It returns the `groupSettings` that the
     master data (`masterDataOf`) gives for the group's library. A planner without the list falls
     back to the attribute ids the loaded group lists, as today.
   - `applyGroupWideAttributes` takes its `settingIds` from it. It reads them only for a call group
     with group attributes, so a call without them reads no master data.
2. **`hi-mcp-server.ts`** (the served text, D51):
   - The description of `merge-article-into-group`: "The new root module inherits the attributes
     the library passes on between neighbours - fronts, handles, carcase - from dockTo.rootId;
     attributes override them."
   - The same sentence in `insert-article-into-group` (from the first root module of `between`) and
     in `exchange-root-module` (from the replaced root module).
   - `create-or-replace-groups`: the sentence on a replace says that a new root module of a
     replaced group inherits them from the root module it is docked to.
   - The rule "Extending a group" (`:25`) says the same for picks added by resubmitting the group.
3. **Documents**:
   - `docs/hi-mcp-behaviour.md`:
     - the header's state;
     - D36 amended: on a create and on a replace, with the group settings from the master data's
       `groupSettings`, else from the loaded group. A replace builds what it is sent: a root sent
       again without its attributes takes those of its template (decision of 2026-10-08);
     - D48 amended: the master data names the group settings;
     - new D56 (decision B, with the two defaults) and D57 (decision A);
     - "kitchen-wide" in §4, "the whole kitchen" in §5.2, the `masterData` row of §5.4, step 7 of
       `create-or-replace-groups` in §6, the rows of the three tools in the command table, and
       G46.
   - `docs/hi-mcp-server.md` and `.agents/skills/hi-mcp-tools.md`: the three tools and the group
     attributes.
   - `docs/implementation/tool-executors.md` and `docs/implementation/README.md`: the new names.
   - The backlog:
     - issues 51 and 39 leave `mcp-test-open-issues.md`, with their overview rows;
     - the mentions of the old name and of "kitchen-wide" in issues 23, 48 and 52,
       `one-undo-step-per-tool-call.md` and `planner-load-outcome-per-group.md` follow the rename.

### Unit tests

**roomle-ui: one new test, and one more expectation in an existing test.**

- New, in `glue-logic-test.ts` under "row edits", beside "applies the attribute overrides of the
  pick to the new root": **"gives a new root module the implicitRelevant input attributes of its
  neighbour, and a sent attribute wins"**.

  Setup: the free row gets the modules of the mock library, where `color` is `implicitRelevant`.
  `root-1` has the input value blue, `root-2` and `root-3` have green. The article's template is
  `module-3`.

  1. `insertArticleIntoGroup` between `root-1` and `root-2`, without attributes: the new root
     module has blue, the first-named root's value.
  2. `mergeArticleIntoGroup` onto the free `RightBottom` of `root-3`, without attributes: the new
     root module has green, through the replace branch.
  3. `mergeArticleIntoGroup` onto that new root module, with `color` red: red, as input.

  If the arrangement gets in the way of the merges, steps 2 and 3 mock `arrangeRootModules`, as the
  merge test does.
- Existing, in `hi-plan-context-test.ts`: "should keep only the modules of group roots and their
  customer-facing attributes". Its fixture already has the orchestrator module `orchestrator-e`. It
  gets one more expectation: `groupSettings` equals `['attr-orchestrated']`.

Because of the one-test limit, no roomle-ui unit test covers two cases: a chain of new roots in one
replace, and a library without an orchestrator.

**roomle-hi-example: two new tests.**

- In `tool-executors.test.ts` under "create-or-replace-groups materials": **"sets the group
  attributes on every unit after a replace, except the group settings of the master data"**.

  Setup: a replace of `g1` with `mod_ToekickColor` and `mod_GroupHeight` in its `attributes`. The
  loaded group lists both, as the planner returns it after a replace. The master data of `lib-1`
  names `groupSettings: ['mod_GroupHeight']`.

  Expected: one `change-group-attribute mod_ToekickColor`, reported as "… was set on every unit of
  group 'g1'". This is the ticket's test, extended by the setting.
- In `hi-mcp-server.test.ts`: **"tells the agent that a new root module inherits the attributes of
  its neighbour"**. The descriptions of the three tools and of `create-or-replace-groups`, and the
  rule "Extending a group", each say it, together with "attributes override them".

Not changed:

- "applies the group attributes that are not group settings to every unit after the load". Its
  master data has no `groupSettings`, so it now covers the fallback to the loaded group's list.
- Tests that count the reads of `getExternalObjectPlanContext` in a call with group attributes are
  checked: the master data is read once more there (once per server, then cached).

### Verification

1. roomle-ui: in `packages/web-sdk`, run `CI=true npm run test -- --run packages/homag-intelligence`,
   `npm run lint:code:sdk` and `npm run lint:types`.
2. roomle-hi-example: in `hi-mcp`, run `npm test` and `npm run typecheck`; at the top level, run
   `npm run lint` and `npm run format:check`.
3. No live check and no model run without a request. If wanted, a live check of about 15 minutes
   calls the tools directly, without a model, with the local roomle-ui:
   - test 32's create and replace: the materials are on every unit after the replace;
   - test 12's insert: the inserted root module carries 224, 224 and 160.

### Commits

- roomle-hi-example: this plan, then one commit with the fix, its tests, the served text, the
  documents and the backlog.
- roomle-ui: one commit with the fix, its test and the JSDoc.

## Implementation

The plan was carried out as written. Where the implementation differs from it or adds to it:

- **roomle-ui**:
  - `_inheritAttributesOfAddedRoots` takes neither a generated root (worktop, toe kick) as a
    neighbour nor one as an added root.
  - `_expandArticlePick` lost its `attributes` parameter, because the insert was its only caller.
  - The template of the new test carries an empty `attributes` list.
    `_applyImplicitRelevantAttributes` adds an inherited value only to a root that has such a list,
    and every article template of a library has one.
- **roomle-hi-example**:
  - The materials tests' `createMaterialsApi` takes the master data as an optional fourth
    parameter.
  - "kitchen-wide" also became "group-wide" in `hi-mcp/hi-mcp-server/README.md` and in the
    implementation docs.
  - The user guide's prompts ("the whole kitchen") are the user's words, so they stay.
  - After the review of PR #79, backlog issues 51 and 39 stay open, reduced to the roomle-ui step,
    and `docs/hi-mcp-behaviour.md` marks the replace part of D36, the `groupSettings` of D48 and
    D56 as planned until the roomle-ui branch is released.

## Verification

1. **roomle-ui, homag-intelligence:** 532 tests pass. Without the source changes, the new test
   and the extended `compactMasterData` test fail. `tsc` (`lint:types:sdk`) is clean, and so are
   oxlint and prettier on the changed files.
2. **roomle-hi-example, hi-mcp:** 472 tests pass. Without the changes to `tool-executors.ts` and
   `hi-mcp-server.ts`, both new tests fail. The typecheck, `npm run lint` and
   `npm run format:check` are clean.
3. **Not run:** the live check and any model run, which wait for a request (see the plan).
