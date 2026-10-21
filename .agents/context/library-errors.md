# Library errors

How roomle-ui handles the errors of an HI library, from the call into the library's calculation
script to the result the agent reads. It covers four layers: the library boundary, the glue logic,
the HI tool commands, and the HI tools of the embedding-lib.

Two things are documented elsewhere:

- Which errors are MCP bugs and which are library bugs: D99 of
  [hi-mcp-behaviour.md](../../docs/hi-mcp-behaviour.md#3-decisions).
- The messages the agent gets: quoted there in §8 (C25, the `notLoaded` rows).

[Back to the overview](./README.md).

All paths are in roomle-ui:

- `homag-intelligence/src/` stands for `packages/web-sdk/packages/homag-intelligence/src/`.
- `hi-mcp/` stands for `packages/embedding-lib/src/homag-intelligence/hi-mcp/`.

## What a library error is

A library error takes one of two forms.

**1. A diagnostic in `logMessages`.** The library writes messages onto the group and onto every root
module it calculates (`PosErrorMsg`, `homag-intelligence/src/model/oc-scripts-domain.model.ts:187`).

- **Fields:** `category`, `msg`, `seqNo`, `timestamp` and `scope`. The scope holds `moduleUniqueId`
  and `attrId`, and in practice also `area`, `moduleId` and `partId`.
- **Categories:** `Fatal`, `Error`, `Warning`, `Info` or `Debug` (`LogMessageCategoryType`, `:200`).
  The library sets the category.
- **What counts:** roomle-ui decides by the category alone, never by the text. Everywhere, only
  `Error` and `Fatal` count as an error.
- **Where they sit:** a root carries the messages of its sub-modules and parts as well, which the
  scope names.

Furniture_Smith writes, for example:

- `Info` "Exception used (mod_TypeElement: WallUnit) …" for nearly every root.
- `Error` "Error 14019: Could not find entry in tab_DoorSettings for input value: …" for a value
  combination its tables lack.
- Further `Error`s from script exceptions in the library code, after a missing table entry:
  "Cannot read properties of undefined (reading 'RealDoorDirection')", "\"undefined\" is not valid
  JSON".

A root module with an `Error` can be left incomplete: without docking vectors (`dockInfos`) and
without front parts (D95). A generated root, such as a backsplash, can carry an `Error` too. An
`Error` on a parts-list entry counts the same as one that leaves the root without geometry. The
category says that the library reported an error, not how much of the root is missing.

**2. An exception** thrown by a library function.

## The library boundary

`homag-intelligence/src/homag-intelligence.ts` loads a library and wraps its exports into a
`LibraryData`:

- **Loading:** `_requestHiLibrary` loads the master data and the script, and `_initCalcScript`
  (`:321`) imports the script. A script that cannot be imported fails with "Failed to load calc.js!".
- **The wrappers** pass every call through. Only `getAttributesDropDownValues` (`:175`) catches: per
  attribute, it logs the error and answers `[]`.

Every call site handles an exception itself:

| Library function | Call site (`homag-intelligence/src/`) | When the library throws |
|---|---|---|
| `calc` (`calculateGroup`, `homag-intelligence.ts:165`) | `_calculate` (`glue-logic.ts:3239`): every group calculation of the glue logic | logged as "Error adding sub article to group:"; the **uncalculated copy** is returned as the result |
| `calc` | `_addSubArticle` (`glue-logic.ts:3356`), `_deleteSubArticle` (`:3392`) | the same log label; the uncalculated copy |
| `calc` | `_moveSubArticle` (`glue-logic.ts:3318`) | "Error moving sub article inside group:"; `null`, nothing changes |
| `calc` | `calculateArticleTemplate` (`glue-logic.ts:998`) | "Error calculating the template of '…':"; no template (`undefined`) |
| `calc` | `stageInteriorEdit` (`hi-interior-design.ts:435`), the calculation of a candidate setting (`:677`) | the candidate is dropped, and a reset correction is pushed |
| `calc` | `stageInteriorEdit`, the other calculations (`:558`, `:630`, `:637`, `:719`) | not caught: the interior edit fails before anything is loaded |
| `groupAdjust` | `_adjustGroup` (`glue-logic.ts:1332`, the call `:1350`) | "Error adjusting group:"; the group is left unadjusted |
| `initializePosGroup` | `_initializePosGroup` (`glue-logic.ts:3293`) | "Error initializing group:"; the group is left uninitialized |
| `solveModuleAttributeConflict` | `modifyAttributesOfModules` (`glue-logic.ts:2690`, the call `:2702`) | not caught: the attribute operation fails |
| `getOrderData` | `getGroupDataForOrder` (`glue-logic.ts:1766`) | logged; `null` |
| `getValidSubArticles` | `findValidSubArticles` (`glue-logic.ts:2754`) | logged; that group contributes nothing |
| `getValidContainerModulesForSubArticle` | `getValidContainerModulesForSubArticle` (`glue-logic.ts:2920`) | logged; that group contributes nothing |
| `addSubArticle`, `deleteSubArticle` | `stageInteriorEdit` (`hi-interior-design.ts:104`, `:107`) | not caught: the interior edit fails |
| `getAttributesDropDownValues` | `getVerifiedAttributeOptions` (`glue-logic.ts:2232`) | `[]` for that attribute (the wrapper) |

An exception of `calc` reaches only the console:

- `_updatePosData` (`glue-logic.ts:3418`) clears the group's `logMessages` before the call.
- `_calculate` returns the group as it was sent.
- Every later step takes that uncalculated group for a calculated one, and its root modules keep the
  messages of their last calculation.

## The glue logic

### Detecting a failed root module

`glue-logic.ts` has three helpers, and none of them refuses anything:

- `rootModulesWithCalculationError` (`:453`) finds the roots that carry an `Error` or `Fatal`
  message (`CALCULATION_ERROR_CATEGORIES`, `:444`).
- `newlyFailedRootModules` (`:468`) keeps the roots that fail now and did not fail in the group
  before the change. A root that already failed is a library problem the change did not cause.
- `_logFailedRootModules` (`:2113`) writes
  `Library messages for root module <root id> of group <group id>: <logMessages>` with `console.log`.
  This is the glue logic's only output for a failed root.

The detection runs in three places:

- **`_runGroupCalculation` (`:2051`)**, the calculation of every group change that goes through
  `_calculateAndUpdateGroupMap` (`:2020`): attribute edits, replaces and row edits. It compares
  against the group's `lastCalculatedPosDataJson`.
- **`_addSubArticle` (`:3356`)**, against the group before the edit.
- **`calculateArticleTemplate` (`:998`)**: every failed root of the template.

### A calculation keeps a failed result

`_runGroupCalculation` stores what the library returns, failed roots included. Nothing discards the
calculation or restores the previous group (D95). Its steps:

1. **Calculate:** `_calculate` (`:3239`).
2. **Log** the newly failed roots.
3. **Arrange** the root modules (`_arrangeRootModulesAndCalculateIfChanged`, `:3257`), but only when
   the calculation kept the same non-generated roots (`hasSameNonGeneratedRoots`, `:432`).
4. **Decide on the group position** (`appliesGroupPosition`, `:2081`). It is set when the
   arrangement moved the group, or when a root gained or lost its docking vectors
   (`rootModuleGainedOrLostDockingVectors`, `:486`). The load then passes
   `applyGroupPosition: true`. Without it, RoomleCore keeps the group in place by that root's
   center, which moves between the failed and the calculated geometry.
5. **Store** the result (`_storeCalculatedGroup`, `:2103`).

### The arrangement of a root without docking vectors

In `homag-intelligence/src/hi-root-module-arrangement.ts`:

- **The breadth-first docking** (`_arrangeConnectedRoots`, `:1249`) skips a root without vectors
  (`:1261`, `:1282`).
- **A docking entry** that names a vector of such a root logs "dockInfos is missing for root …"
  (`_completeDockingReference`, `:988`).
- **A root left unplaced** logs "Module … is not connected and has no position set." (`:1239`) and
  keeps the position it has.
- **The dock mode** (`_getDockMode`, `:1128`): the original vectors of a root that had none are not
  compared, and the requested mode is kept.
- **The seed of a docking cluster** (`_seedCandidates`, `:1350`; `_wasNeverDocked`, `:1357`): a root
  that failed when it was added was never docked. It has no vectors in the original group and stands
  on another root's `articlePos`, where RoomleCore put it. Once it has vectors, it does not start a
  docking cluster while another root left to arrange has a position.
- **The wall distances** (`keepWallDistances`, `:551`): no wall-distance translation is applied while
  either docking footprint lacks an article root's vectors.
- **The units above** (`getDockingVectorBox`, `:104`; `carriersOfUnitsAbove`, `:144`): a root without
  vectors has no box, so it neither carries a unit nor is carried.

### The layout load of `create-or-replace-groups`

`createOrReplacePosGroupsFromLayout` (`glue-logic.ts:803`) answers per group of the call
(`LayoutGroupOutcome`, `:326`) with `built` or `leftOut`.

- **`built`:** a group the library calculates with errors is built, its failed roots included.
- **`leftOut`** only in three cases:
  - its calculation throws inside the method (`:880`); a replace then gets its previous
    `posDataJson` back, and a new group leaves the group map;
  - it has no roots;
  - a calculation of it is in progress.

`_calculate` catches the library's exceptions, so an exception of `calc` does not leave a group out.

### Interior edits

`editInterior` (`glue-logic.ts:2799`) is the only flow that refuses a library error.

- **The staging** (`stageInteriorEdit`, `hi-interior-design.ts:435`) rejects an edit that leaves a
  root failed which did not fail before: "The library could not calculate the edited interior."
  (`:735`). Nothing is loaded.
- **A failure after the load** reloads the original group and throws "Interior edit failed; the
  original group was restored: …" with `historySteps: 1` (`glue-logic.ts:2877`).

## The HI tool commands

In `homag-intelligence/src/hi-tool-commands.ts` and its modules.

### `create-or-replace-groups`

1. **Groups left out:** `readLoadOutcomes` (`hi-tool-payload.ts:281`) puts a `leftOut` group into
   `notLoaded`: `posGroups[i]: the planner did not build the group - <reason>; check the group and
   send it again`.
2. **Group attributes:** after the load and the wall placement, the group-wide attributes are set
   with one `change-attributes` (`applyGroupWideAttributes`, `hi-tool-attributes.ts:392`, called at
   `hi-tool-commands.ts:683`).
   - The attribute values the library changed become corrections: "posGroups[i]: with its group
     attributes the library changed …" (`hi-tool-attributes.ts:466`).
   - An exception of that operation becomes a correction: `posGroups[i]: the group attributes … could
     not be set on group '…' - <message>` (`:484`).
3. **Failed roots** (`hi-tool-commands.ts:701-735`): the raw groups (`getExternalObjectGroups`) are
   read after step 2, so a failure the group attributes cause is reported as well. For every built
   group, each root with an `Error` or `Fatal` message goes into `notLoaded` with `index`, `id`,
   `rootIds` and `errors`.
   - Only the root's first such message is used, and only its first line (`firstLineOf`,
     `hi-tool-payload.ts:233`).
   - Roots with the same cause are named together (`byCause`, `:266`; `rootModulesLabel`, `:256`):
     `posGroups[i]: the library could not calculate root module 'u2' (OSKB60) of group '…' -
     <first line>. Check posGroups[i].attributes and the root's attribute overrides against the
     library data; change the failing values or replace the article. The loaded groups and other
     roots were kept.`
   - The group stays in the plan with its failed roots. Group-level `logMessages` are not read.

### `change-module-attribute` and `change-group-attribute`

- **An exception of a planner operation**, such as "Module '…' has no attribute '…'"
  (`hi-tool-commands.ts:950-980`), becomes a correction per command:
  `root module '…' kept its value - <message>`. When every command fails, the tool throws.
- **Library changes:** `withLibraryChanges` (`hi-tool-attributes.ts:237`) compares the input values
  of every root before and after the call (`findLibraryChanges`, `:144`). Every change the call did
  not set is named as a library change (`libraryChangeSentences`, `:206`): "with mod_FrontColor
  "324" (…) the library changed …".
  - The values come from the calculation, so a value derived from roomle-ui's arrangement is named
    the same way, for example an insertion height after the arrangement moved a unit.
- **Failed roots:** for every changed group, each root with an `Error` or `Fatal` message becomes a
  correction (`hi-tool-attributes.ts:254-276`, C25): `<tool>: the library could not calculate … -
  <first line>. Check the group's attributes and the root's attribute overrides against the library
  data; change the failing values or replace the article. The applied changes and other roots were
  kept.`

### The other tool commands

`place-group`, the delete, merge, exchange, insert and swap commands, and `merge-groups` report no
library error. A root the library cannot calculate after such an edit stays in the plan without a
note.

### Errors after a plan change

`runToolCommand` (`hi-tool-commands.ts:1404`) handles an error that a tool command throws:

- **After the plan changed**, or when the error carries `historySteps: 1` (the interior edit's
  does): the error becomes `{ error, historySteps: 1 }`, so undo counts the step.
- **Before any change:** the error is rethrown.

## The HI tools

In `hi-mcp/`:

- **Forwarding:** `inPlanner` (`tool-executors.ts:365`) forwards a plan-changing tool, removes
  `historySteps`, and throws a result's `error` string.
- **Attribute results:** `compactAttributeResult` (`tool-executors.ts:190`) returns `command`,
  `groupIds`, `changedModuleIds` and `corrections`; the library diagnostics are in `corrections`.
- **Logging:** `runTool` (`hi-mcp-server.ts:168`) logs `[hi-mcp] tool <name> feedback {corrections,
  notLoaded}`, or `[hi-mcp] tool <name> error {message, args}`. These are the lines the test runs
  read.
- **Error results:** `execute` of a registered tool (`mcp-tool.ts:72`) turns a thrown error into
  `{ isError: true, content: [{ type: 'text', text: <message> }] }`.
- **Timeouts:** a planner call that runs longer than 30 s, or 120 s for a snapshot (`planner-api.ts:1`),
  rejects with "Planner call '…' timed out after …ms".
- **Served text:**
  - the instructions (`hi-mcp-server.ts:44`) and the `create-or-replace-groups` description (`:485`)
    say that `notLoaded` lists the groups and the roots it could not build or fully calculate, with
    what to send instead;
  - the attribute tools' descriptions (`:586`, `:622`) say that `corrections` name every attribute
    the library changed besides the one set.
- **The plan context carries no library messages.**
  - `get-plan-context` returns no `logMessages`.
  - Sent back in a payload, `logMessages` is ignored without a note (`READ_ONLY_GROUP_FIELDS` and
    `READ_ONLY_ROOT_FIELDS`, `hi-tool-payload.ts:372`, `:385`).
  - A failed root shows only through what it lacks: its `dockingVectors` come from its `dockInfos`
    (`dockingVectorNames`, `hi-plan-context.ts:321`).

## What the handling does not cover

- **Values are not checked before an edit.** `getVerifiedAttributeOptions` (`glue-logic.ts:2232`)
  serves the planner's parameter panel (`_validateParameters`,
  `planner-core/src/services/planner-kernel-access.ts:328`), not the HI tools. The code therefore
  cannot tell an MCP bug from a library bug (D99) when the error occurs. The open work is
  [attribute-values-checked-before-an-edit.md](../backlog/attribute-values-checked-before-an-edit.md).
- **An exception of `calc` reaches only the console**: see [The library boundary](#the-library-boundary).
- **No tool reads group-level `logMessages`.**
- **The row edits report no library error.**
- **Only part of a diagnostic reaches the agent:** the first `Error` or `Fatal` message of a root,
  by its first line. The library's later messages, such as script exceptions, stay in the console
  and the plan data.

## Tests

In roomle-ui `packages/web-sdk/packages/homag-intelligence/__tests__/`:

| Behaviour | Test |
|---|---|
| Failed roots in the glue logic | `describe('a root module the library could not calculate')`, `it('keeps the change and logs the root module the library reports an error for')`, `it('adds the sub-article and logs the root module the library reports an error for')`, `it('builds a replace although the library reports an error for a root module of it')` in `glue-logic-test.ts` |
| The attribute tools | `it.each(…)('keeps a failed calculation and reports its diagnostic through %s')`, `it.each(…)('reports only the final follow-up calculation errors through %s (final failure: %s)')`, `it('changes an attribute after the library could not calculate the previous change')` in `hi-tools-test.ts` |
| A replace with a failed root | `it('reports the root module of a replace the library could not calculate through the real glue-logic')` in `hi-tools-test.ts` |
| The group position on a recovery | `it('keeps the group in place when a change-module-attribute lets the library calculate a failed root module again')` and `it('keeps the wall unit in place when a change-module-attribute lets the library calculate the unit on top of it for the first time')` in `hi-tools-test.ts` |
| Grouping of diagnostics | `it('groups roots with the same diagnostic and appends it after library changes')` in `hi-tool-commands/group-commands-test.ts` |
| The arrangement | `it.each([0, 1])('uses the requested mode when original root %s has no vectors after a failed calculation')`, `it.each(['before', 'after'])('keeps the group transform when the %s measurement omits a failed root')`, `describe('a root the library calculates for the first time')` in `hi-root-module-arrangement-test.ts` |

## Reading a failed calculation in a run

The example page's console holds:

- the library's own messages: `Library messages for root module …`;
- the exceptions the call sites log: `Error adding sub article to group:`, `Error adjusting group:`,
  and so on;
- the feedback the agent saw: `[hi-mcp] tool <name> feedback` and `[hi-mcp] tool <name> error`.

The test runs keep that console in `console.log` and the calculated plan in `plan.xml`. The root
`logMessages` of a group are also in `getExternalObjectGroups()`.
