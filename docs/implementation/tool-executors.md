# Tool Executors

[`tool-executors.ts`](../../hi-mcp/hi-mcp-server/tool-executors.ts) runs the tools in the server: it
reads the plan context and puts it into the agent's words, searches the attributes, forwards every
tool that changes the plan as one planner call, and keeps the undo record. The HI tool commands of
roomle-ui (`hi-tool-commands.ts` and its modules) perform the tools that change the plan: they
validate and correct the agent's input, run the planner's operations, and shape the result.
What the tools do towards the agent, with every correction and message, is
in [hi-mcp-behaviour.md §6](../hi-mcp-behaviour.md#6-tools) and
[§8](../hi-mcp-behaviour.md#8-guards-corrections-and-feedback). [Back to the overview](./README.md).

## Tool overview

The server exposes these 20 MCP tools. Their names, input schemas and handlers are registered in
[`hi-mcp-server.ts`](../../hi-mcp/hi-mcp-server/hi-mcp-server.ts). Nineteen handlers call the
matching entry in `toolExecutors`; `get-authoring-rules` returns `AUTHORING_RULES` directly from
the server and needs no connected planner page. Parameters and result formats are in the
[tool reference](../hi-mcp-server.md#tool-reference).

| Tool | Purpose | Changes the plan | Implementation details |
| ---- | ------- | ---------------- | ---------------------- |
| `get-plan-context` | Read rooms, articles, groups, obstacles and optional master data | No | [Context reads and shaping](#get-plan-context) |
| `find-attributes` | Search library attributes and their available values | No | [Attribute search](#find-attributes) |
| `get-authoring-rules` | Read the group payload format, relations, placement rules and examples | No | [Direct server handler](../hi-mcp-server.md#get-authoring-rules) |
| `create-or-replace-groups` | Create groups with a placement or rebuild existing groups by id | Yes | [Creation and replacement pipeline](#create-or-replace-groups) |
| `place-group` | Move an existing group against a wall or into a room corner | Yes | [Placement pipeline](#place-group) |
| `change-module-attribute` | Set an attribute on selected root modules or their submodules | Yes | [Command forwarding and result wrapping](#the-command-tools) |
| `change-group-attribute` | Set one or several attributes on the modules of a group | Yes | [Command forwarding and result wrapping](#the-command-tools) |
| `delete-group` | Delete an entire group | Yes | [Command forwarding and result wrapping](#the-command-tools) |
| `delete-article-in-place` | Delete an article and leave the gap; disconnected roots become separate groups | Yes | [Command forwarding and result wrapping](#the-command-tools) |
| `delete-article-and-compact` | Delete an article and close the gap where the row permits it | Yes | [Row edits](#row-edits) |
| `merge-article-into-group` | Add an article at a free docking side of an existing group | Yes | [Docking target selection](#merge-article-into-group-where-the-unit-goes) |
| `exchange-root-module` | Replace a root module with another article | Yes | [Row edits](#row-edits) |
| `insert-article-into-group` | Insert an article between two root modules | Yes | [Row edits](#row-edits) |
| `swap-root-modules` | Exchange the places of two root modules | Yes | [Row edits](#row-edits) |
| `merge-groups` | Join existing groups where they stand | Yes | [Command forwarding and result wrapping](#the-command-tools) |
| `undo` | Revert the last tool call that changed the plan | Yes | [Tool-call history](#undo-redo) |
| `redo` | Reapply the tool call reverted by undo | Yes | [Tool-call history](#undo-redo) |
| `get-price` | Calculate the plan's price | No | [Price and snapshot forwards](#get-price-get-order-data-get-plan-images) |
| `get-order-data` | Read order data from a plan snapshot | No | [Price and snapshot forwards](#get-price-get-order-data-get-plan-images) |
| `get-plan-images` | Render perspective and top-view images of the plan | No | [Price and snapshot forwards](#get-price-get-order-data-get-plan-images) |

## The files

The server runs the tools that read the plan, forwards every tool that changes it as one planner
call, and keeps the undo record. The tool commands that perform the plan-changing tools are in
roomle-ui, `packages/web-sdk/packages/homag-intelligence/src/` (D71).

| File | Main identifiers |
| ---- | ---------------- |
| `tool-executors.ts` | plan-context sections (`PLAN_CONTEXT_SECTIONS`, `DEFAULT_SECTIONS`); find-attributes matching (`searchWords`, `attributeMatches`, `withSharedSelectionsOnce`); concurrency and undo recording (`oneAtATime`, `countingPlannerApi`, `readGroupsKey`, `recorded`, `planChange`); undo and redo (`stepHistory`, `revertToolCall`, `changedGroupIds`, `changedGroupsOnly`); the forward of a plan-changing tool (`inPlanner`, `compactAttributeResult`); `toolExecutors`, at the end |
| `agent-facing.ts` | the plan context the agent sees: `agentFacingArticle` (`isCornerArticle`, `shortDescription`), `agentFacingRooms` (`wallName`, `roomCorners`), `agentFacingObstacles` (`wallOfOpening`) |
| roomle-ui `hi-tool-commands.ts` | `HiToolPlanner` (what the commands read from the plan and change in it), `HiToolState`, `HI_TOOL_COMMANDS` (one command per plan-changing tool), `runToolCommand` (counts `historySteps` and `historyFollowUps`), `FOLLOW_UP_COMMANDS`, `hasFollowUp`, `placeAtWalls`, `inPlacementFrame`, `withCorrections`, `asTool`, `changedGroupsOnly` |
| roomle-ui `hi-tool-ids.ts` | article and root id resolution: `catalogArticleId`, `catalogSpellingOf`, `resolveArticleIds`, `removeReferencesTo`, `resolveRootId`, `withPlanRoots`, `rootModulesByGroup`; group lookup: `findGroup` (a root id names the group that holds it: `groupHoldingRoot`), `groupOfRoot`; the agent's group ids: `matchResultGroups`, `resolveAgentGroupIds`, `rememberAgentGroupIds` |
| roomle-ui `hi-tool-payload.ts` | payload preparation: `dropMalformedDocking`, `liftNestedRoots`, `completeDockingEntries`, `normalizedAttributes`, `reportUnusedFields`, `readDockToAsRelation`, `prepareGroup`; placement normalisation: `normalizePlacement`, `normalizeWallPlacement`, `isWallPlacement`; `toArticlePick`, `generatedRootAttributes`, `readLoadOutcomes`; partial loads: `NotLoadedGroup`, `keepBuildable`, `nothingLoaded` |
| roomle-ui `hi-tool-docking.ts` | merge-article-into-group target: `articleWidth`, `unitStaysInRoom`, `dockTarget`; row edits: `neighbourTowards`, `insertBetween`; the docking graph and its completion: `sidePartnersOf` (Bottom and Top side vectors, `isSidePair`), `rowWalk`, `separateSideVectorPartners`, `breakRowRings`, `vectorFree`, `connectUnreachedRoots`, `reportUnsentRoots`, `completeDocking`; before the relations `dropUnknownDockingVectors`, `dropFloorUnitsOnBaseUnits`; places in a row: `withRowIndices` |
| roomle-ui `hi-tool-hints.ts` | row hints: `rowReachHints`, `movedUnitsAboveHint`, `turnedLegHints`, `withRowHints` (with `obstacleHint` against the groups before the edit); the obstacle hint (D55): `objectBlockers`, `rootBlockersBeside`, `freeStretchesNote`, `obstacleHint`, with the geometry of `hi-plan-space.ts` |
| roomle-ui `hi-tool-attributes.ts` | group-wide attributes: `moveGeneratedRootOverrides`, `applyGroupWideAttributes`, `programsFirst`, `rootValuesOf`, `loadedRootOf`, `groupSettingIdsOf`; library changes: `findLibraryChanges`, `libraryChangeSentences`, `withLibraryChanges` |
| roomle-ui `hi-wall-placement.ts` | root shapes for the planner: `isGeneratedRoot`, `withoutPositions`, `withUnitsAboveDocked`, `repositionedGroup`; the geometry of place-group and a placement by wall: `groupVolumes` (the box of the group and of each root module), `placedGroupVolumes`, `overlappedGroupIds` (root module against root module, the boxes first), `resolveWall`, `placeGroupAtWall`, `standsAt`, `freePlacementAlongWall`, `floorCorners`, `sameFloor`; shared: `wallPlacementSpec`, `resolveWallPlacement`, `wallTarget`; `OVERLAP_TOLERANCE_MM`, `WALL_STRIP_MM` |

The relations, the anchor and the geometry are in roomle-ui `hi-group-layout.ts`,
`hi-group-placement.ts` and `hi-plan-space.ts` ([Layout and placement](./layout-and-placement.md)).
`HiToolsImplementation` (`hi-tools.ts`) implements `HiToolPlanner` in the planner itself: the plan
context, the calculated groups, the layout load, the group operations (`runGroupOperation`) and
`calculateArticleTemplate`.

## Wrappers

| Wrapper | What it does | Used by |
| ------- | ------------ | ------- |
| `oneAtATime` | Chains the call onto a module-level promise (`planChanges`), so plan changes never run concurrently; a failed call does not block the next | `get-plan-context`, every plan-changing tool, `undo`, `redo` |
| `recorded(tool, …)` | Counts the planner steps the tool command reports, for undo ([MCP server](./mcp-server.md#undo-and-redo)) | every plan-changing tool |
| `planChange` | `oneAtATime(recorded(…))` | every plan-changing tool |
| `inPlanner(tool, shape?)` | `planChange` around the one planner call `externalObjectGroupOperation(tool, args)`; removes `historySteps` and `historyFollowUps` from the result and raises its `error` (a tool that failed after it changed the plan); the two attribute tools shape it with `compactAttributeResult` | `create-or-replace-groups`, `place-group`, the ten command tools |
| `inPlacementFrame` (roomle-ui) | Rewrites every group `position` into the placement frame and adds `rowIndex` ([Layout and placement](./layout-and-placement.md#reading-a-group-back-positioninplacementframe)) | the plan context of the planner, every tool command and group operation |

Why `oneAtATime` exists: the page runs every call it receives at once, and the undo record of a
call compares the plan before and after it; `get-plan-context` waits too, so it never reads a plan
halfway through a change.

## get-plan-context

1. Keeps the `include` sections that exist; none left means `DEFAULT_SECTIONS` (all but `masterData`).
2. `obstacles` needs `rooms` to assign doors and windows to walls; it fetches them and removes them
   again if they were not asked for.
3. One `getExternalObjectPlanContext(sections)` call — roomle-ui shapes the context
   (`hi-plan-context.ts`) and reports the groups in the placement frame with the `rowIndex` of every
   root (`HiToolsImplementation.getPlanContext`, `inPlacementFrame`).
4. Adds the agent's vocabulary ([The plan context the agent sees](#the-plan-context-the-agent-sees)).

## find-attributes

Reads the master data fresh on every call, filters by `libraryId`, and matches the text
(lower-cased substring) against the attribute's id, name, description and group and every
selection's name, description and value (`attributeMatches`). Returns the first
`MAX_ATTRIBUTE_MATCHES` (20) with the root modules that carry each attribute, the total, and a hint
when there were more.

## create-or-replace-groups

The longest pipeline, in roomle-ui (`HI_TOOL_COMMANDS['create-or-replace-groups']`,
`hi-tool-commands.ts`); the server forwards the arguments. Each group of the call is prepared on its
own; a group that fails leaves the
call and is reported in `notLoaded`, the others load
([§8.3](../hi-mcp-behaviour.md#83-create-or-replace-groups)).

1. **Group-wide attributes first.** `generatedRootAttributes` takes the attributes the agent set on
   generated roots (worktop, toe kick) before they are dropped.
2. **Prepare** each group (`prepareGroup`, through `keepBuildable`): drop malformed docking, lift
   units nested in docking entries to roots, complete docking entries, read `dockTo` as a relation,
   report unused fields, normalise attributes, drop positions (group `pos`/`rotationY`, root
   `articlePos`/`rotationY`), read `repositioningData` as a `placement`, give missing ids, rename
   duplicates, normalise the placement (`normalizePlacement`; a placement with a `wall` field by
   `normalizeWallPlacement`).
3. **Reduce every root to an article pick** (`toArticlePick`): id, article id, library, attributes,
   docking without indices, relation fields.
4. **Resolve article ids** against the catalog (`resolveArticleIds`): another spelling is read as the
   catalog's; an unknown article drops that root and every reference to it, and the group still
   loads — only a group without any known article fails.
5. **Relations to docking** (`relationsToDocking`, [Layout and placement](./layout-and-placement.md#relations-to-docking--hi-group-layoutts)).
   Docking written as `contextData` is checked first: a vector the article does not have, where the
   catalog knows its vectors (`dropUnknownDockingVectors`, G62), and a floor unit on a Top vector of
   a base unit (`dropFloorUnitsOnBaseUnits`, G63).
6. **Move attribute overrides** meant for generated roots (`moveGeneratedRootOverrides`).
7. **Group ids:** a group id the agent invented for a new group in an earlier call is mapped to the id
   the planner gave it (`resolveAgentGroupIds`), so resending it replaces instead of duplicating.
8. **Complete the docking** of new groups (`completeDocking`): a second unit on an occupied side —
   also a second wall unit on a Top side vector of a tall unit — goes to the free end of the row
   (`separateSideVectorPartners`, `rowWalk`); an entry that closes a row into a ring is dropped
   (`breakRowRings`, G61); unconnected parts are docked to a free row end of their kind by a root of
   their kind, or a first wall unit hangs above a floor unit (`connectUnreachedRoots`); roots that
   cannot be reached are reported (`reportUnsentRoots`).
9. **Placement:** a group already in the plan keeps its place (its placement is dropped, with a
   correction). A placement by wall is resolved (`resolveWallPlacement`; a wall the room does not
   have leaves the group without it) and kept aside for the step after the load. For a new group
   placed by point, the anchor root is found (`anchorRootOf`), its
   anchor frame comes from its article template ([The anchor frame](#the-anchor-frame)), and
   `toRepositioningData` derives the planner's repositioning.
10. **Load:** `loadExternalObjectGroupLayout({ posGroups }, 'posGroups', { reason: 'adjusted' })` of
    the `HiToolPlanner` — in the planner `createOrReplacePosGroupsFromLayout` and `loadPosGroups`
    with the group position. The load answers per group of the layout (`LayoutGroupOutcome`): the
    group of the plan it became, the previous group restored because the library could not calculate
    the replace, with the failed root modules under the ids the call gave them, or why the group was
    left out (D73). `readLoadOutcomes` sets `CallGroup.resultId` from that answer, the pairing of
    every later step (`matchResultGroups`), and puts a group left out and a replace restored into
    `notLoaded`; the group left out leaves the call. A call of which no group was built or restored
    throws "No groups were created or replaced", with every `notLoaded` reason.
11. **After the load:** read the groups again. With groups placed by wall, `placeAtWalls`
    computes every target with `wallTarget` — a group of the call counts in the overlap test once it
    has its target — and reloads them in one load, and names each group that still covers the floor
    it covered before (`floorCorners`, `sameFloor`, G59) — the load answers what the planner
    calculated, not where the group stands, and the group origin moves to another root or corner on
    a reload; then the groups are read once more. Apply the group-wide attributes
    with one group operation, `change-attributes` (`applyGroupWideAttributes`) —
    every group attribute but the library's group settings, which `groupSettingIdsOf` takes from the
    master data's `groupSettings`, the programs first (`programsFirst`), and a root module's own value
    of one after it (`rootValuesOf`, `loadedRootOf`) —, and read the groups again. Remember the
    agent's group ids (`rememberAgentGroupIds`); hint at unpositioned groups. The
    reads after the load take `groups`, `obstacles` and `rooms`. The final calculated groups are read
    for calculation diagnostics; roots with `Error` or `Fatal` logs get a `notLoaded` entry with the
    original input index, the group and root ids of the plan, the first diagnostic line and the action to check
    the group's attributes and the root's overrides against the library data, then change the failing
    values or replace the article. Loaded groups stay in the result. With an `obstacles` section,
    `obstacleHint` uses the same calculated groups and names every root module of the call's groups on an
    object, in another group or in front of a door or a window (D55). For a replace, the read
    before the load takes `obstacles` too, and the calculated groups before the load tell what the
    group stood on already.

Result: `{ loaded, groups, otherGroupIds?, groupAttributes?, hint?, corrections?, notLoaded? }`.
`groups` holds the groups of the call (`changedGroupsOnly`), `otherGroupIds` the other groups of the
plan, `loaded` the ids of the groups the planner built or restored. `runToolCommand` adds `historySteps` and
`historyFollowUps`, which the server removes.

### The anchor frame

The planner positions a group by one root's transform, and where that root's docking corner lies
differs per article and per attribute variant. The tool command takes it from the anchor's article
template: `calculateArticleTemplate(articleId, attributes)` of the glue logic calculates the article
with the anchor's attribute overrides as a single-pick group outside the plan — nothing is loaded,
nothing reaches the undo history —, and `anchorFrameOfRoot` reads the frame from the docking vectors
of its first root that is not generated. The glue logic keeps the templates per library, article and
sorted attribute overrides until the library's article templates are loaded again (`loadPosData`);
a failed calculation is not kept. Within a call the frames are kept by `anchorVariantKey`. A
template without docking vectors gives `IDENTITY_FRAME`; an anchor whose template cannot be
calculated is placed by its origin, with a correction: the group may stand off the requested point
(G17).

## place-group

In roomle-ui (`HI_TOOL_COMMANDS['place-group']`, `hi-tool-commands.ts`):

1. Reads `wall` and `alignment` side labels (`back` → `top`, `front` → `bottom`, `sideLabel`);
   defaults: alignment `center`, offset 0, room 0 (`wallPlacementSpec`, shared with a placement by
   wall).
2. Reads `rooms`, `groups` and `obstacles`, finds the group (`findGroup`) and the wall (`resolveWall`: a side label
   means the longest real wall on that side).
3. An alignment that runs along the wall (`alignmentRunsParallel`) becomes `center`, with a
   correction (steps 2 and 3: `resolveWallPlacement`).
4. Reads the calculated group (`getExternalObjectGroups` of the `HiToolPlanner`: the planner's
   calculated groups) — without calculated geometry it throws.
5. `placeGroupAtWall` computes the raw group position: into the corner (`placeCornerAtWalls`) when
   the alignment names an adjoining wall and the group has a corner geometry, else against the wall
   (`placeAgainstWall`). The group keeps its height.
6. If the group would overlap another (`volumesOverlap`, 5 mm tolerance) when placed against a wall,
   `freePlacementAlongWall` tries the free spans beside the other groups, nearest first; if none is
   free, it stays as asked, with a correction (steps 5 and 6: `wallTarget`).
7. If the group already stands there (`standsAt`), nothing is loaded.
8. Loads `repositionedGroup(rawGroup, placement)` with `loadExternalObjectGroupLayout`: the roots,
   the generated ones included, and the group's attributes, which the planner keeps as sent.
9. With an `obstacles` section, reads the calculated groups again and `obstacleHint` names the root modules
   on an object or in front of a door or a window; the other groups stay with step 6 (D55).

Result: `{ placedIn: 'wall' | 'corner', wall, group, hint? }` with corrections.

## The command tools

Every command tool is a tool command (roomle-ui `hi-tool-commands.ts`): it resolves the ids it is
given, corrects what it can, and runs one group operation of the planner through the
`externalObjectGroupOperation` of its `HiToolPlanner` (`runGroupOperation`, `hi-plan-context.ts`) —
`change-module-attribute` one per group, with `moduleId` one per root module. The group operation
(roomle-ui `hi-tools.ts`) performs the edit with the planner's own group features and answers once
the result is loaded.
The planner load awaits the planning-situation callbacks emitted by its own kernel call and their
calculated follow-up loads. Attribute commands retain their per-group operation slot from the first
mutation through that completion, so competing commands cannot change their attributes. The result
and library-change feedback use the actual placement's attributes.

`PlannerKernelAccess.loadExternalObjectGroups` captures callback promises during the synchronous
kernel load and restores that capture scope before yielding. Earlier user moves, later callbacks
and nested loads have independent completion. A failed calculated reload rejects its originating
load. Deletion and merge reports claim only their corresponding operation kind; the operation slot
stays occupied until completion and is released in `finally` on success or failure.

This contract is guarded by these roomle-ui tests:

- `glue-logic-test.ts`: `returns the position height after the kernel callback and follow-up load (%s)`,
  `does not let a planning callback claim a pending deletion`,
  `rejects a competing batch without changing the accepted attributes (first batch: %s)` and
  `releases the batch operation slot after a pre-load attribute conflict failure`, plus
  `rejects a failed callback reload and permits the next attribute command`.
- `planner-kernel-access.ts`: `awaits only planning callbacks emitted by its own load` and
  `rejects a load when its planning callback reload fails`.
- `roomle-planner.ts`: `attribute loads await their planning-situation reload`.

| Tool | Resolves | Result wrapping |
| ---- | -------- | --------------- |
| `change-module-attribute` | the root among all roots of the plan | `withCorrections`, `withLibraryChanges`; the server: `compactAttributeResult` |
| `change-group-attribute` | the group (a root id: its group); one attribute as `change-group-attribute`, several as one `change-attributes`, the programs first | `withLibraryChanges`; the server: `compactAttributeResult` |
| `delete-group` | the group (a root id: its group) | `withCorrections` |
| `delete-article-in-place` | the root among all roots | `withPlanRoots`, `asTool` (the result names the tool, not the planner command), `withCorrections` |
| `delete-article-and-compact` | the group — without `groupId` the group that holds the root (`groupOfRoot`) —, the root within it | `withRowHints` + `withPlanRoots`, `asTool`, `withCorrections` |
| `merge-article-into-group` | the group, the article, the target root and side (`dockTarget`) | `withPlanRoots`, `withCorrections` |
| `exchange-root-module` | the group, the article, the root | `withRowHints` + both |
| `insert-article-into-group` | the group, the article, both roots (`insertBetween`) | `withRowHints` + both |
| `swap-root-modules` | the group, both roots (the same root twice throws) | `withRowHints` + both |
| `merge-groups` | the target and every group | the planner's result |

`attributeValue` turns a number into a string for the two attribute commands; the `attributes` of
merge, insert and exchange are forwarded unchanged.

### merge-article-into-group: where the unit goes

`dockTarget` decides the docking the planner gets:

- **Side already taken:** the candidates are the free end of the row in the named direction
  (`rowWalk`), past a corner article the free end of the other leg, then the root's other side. The
  first candidate where the unit stays in the room (`unitStaysInRoom`, which projects the article's
  width past the root's footprint) wins; if none does, the first.
- **A vector the article does not have** becomes the partner of `ownDockingVector`
  (`PARTNER_VECTOR`).
- **A wall unit on a floor unit** (not a tall unit): `Top → Top` becomes `Top → Bottom`, and the y
  offset is the hang gap of the wall units (`hangGapOf`) unless the agent gave one.

### Row edits

For insert, `delete-article-and-compact`, exchange and swap the tool command does **not** rewrite the row's docking — the group
operation does: it closes or opens the gap, keeps the ends at a wall or in a corner, and moves the
units above with their carrier (roomle-ui `hi-root-module-arrangement.ts`, `carriersOfUnitsAbove`).
The tool command's part:

- `insertBetween`: two roots that are not neighbours are read as the first root and its neighbour
  towards the second (`neighbourTowards`), with a correction; two roots of different rows throw,
  naming the side neighbours.
- `withRowHints` compares the calculated groups before and after the edit and adds a `hint` when the
  row newly reaches past a wall or into a group it did not overlap before (`rowReachHints`), and names
  the wall units that moved with the unit below them (`movedUnitsAboveHint`) and the leg a corner
  deletion turned (`turnedLegHints`). It does not apply to
  `merge-article-into-group` and `delete-article-in-place`.

## undo, redo

`revertToolCall(direction)` — described in [MCP server](./mcp-server.md#undo-and-redo).

## get-price, get-order-data, get-plan-images

Thin forwards: `fetchPrice()`; `getExternalObjectSnapshot({ orderData: true })` returning `orderData`;
`getExternalObjectSnapshot({ perspectiveImage, topImage })` returning both images.

## The plan context the agent sees

Root outlines in `obstacles` bound the calculated parts, so they can extend beyond their docking
edges over a neighbour in the same group. The authoring rules and `get-plan-context` description
explain that this overlap alone is not a placement error; the executor passes the geometry through.

roomle-ui returns the plan context agent-ready (D48), with the group positions in the placement
frame and the `rowIndex` of every root (`inPlacementFrame`); the server adds its vocabulary
(`agent-facing.ts`):

| Function | Adds |
| -------- | ---- |
| `agentFacingRooms` | per wall `name` (`wallName`: back, front, left, right wall), `type: 'opening'` for a wall entry without type (a door); per room `corners` (`roomCorners`) |
| `agentFacingObstacles` | per door and window its room, wall and span from the wall's end (`wallOfOpening`) |
| `agentFacingArticle` | `cornerArticle` (`isCornerArticle`); removes `cornerPoint`; shortens a sectioned `desc` (`shortDescription`) |
| `withoutImageUrls` (`hi-mcp-server.ts`) | removes every `imageUrl` |

## Corrections, hints and partial loads

In the tool commands of roomle-ui:

- **One `corrections: string[]` per call**, passed by reference into every helper. Each entry starts
  with its source: `posGroups[i]`, `posGroups[i] root 'x'`, or the tool name. `withCorrections` adds
  the planner's own corrections after the server's, prefixed with the command.
- **`hint`** is for things the agent should check — never for something the server changed.
- **Partial loads:** `keepBuildable(callGroups, notLoaded, errorsOf)` keeps the groups without errors
  and moves the rest to `notLoaded` (`{ index, id?, rootIds?, errors }`); an exception becomes
  "could not be read". It runs after each preparation stage; when nothing is left, `nothingLoaded`
  throws "Invalid pos groups - nothing was loaded".
- **Group ids** (`findGroup`): the exact id, else a unique prefix; otherwise the error lists the groups
  of the plan.
- **Root ids** (`resolveRootId`): exact, unique prefix, a UUID that differs only in its first segment,
  or one character off — each reported as "root id 'x' was read as 'y'". An id that matches nothing
  is forwarded, and `withPlanRoots` adds the roots of the plan to the planner's "not found" error.
- **Article ids** (`catalogArticleId`): exact, else a unique case- or whitespace-insensitive match,
  reported; otherwise the error lists valid ids.

## Before you change these files

- **Input is mutated in place** in roomle-ui: `prepareGroup`, `normalizePlacement` and
  `resolveArticleIds` change the `posGroups` of the payload, the page's copy of the call; `runTool`
  clones the arguments before the executor runs, so the log shows what the agent sent.
- **State:** the agent's group ids live in the `HiToolState` of `HiToolsImplementation` for the life
  of the planner page, the article templates in the glue logic until the library's article
  templates are loaded again; the master data is read on every call.
- **Constants declared late:** `PARTNER_VECTOR` and `SIDE_PARTNER` (`hi-tool-docking.ts`) are
  declared after functions that use them; that works only because those functions run after module
  initialisation.
- **Two partner maps:** `SIDE_PARTNER` is the opposite side of the same root; `PARTNER_VECTOR` is the
  vector that meets a given vector on the neighbour.
- **Messages are contract** — quoted in the behaviour reference, read by the agents and the tests.
- **Step counting follows roomle-ui's reloads** — a group operation that reloads twice belongs in
  `FOLLOW_UP_COMMANDS` (`hi-tool-commands.ts`, D47), and a tool command reaches the planner only
  through the `HiToolPlanner` it is given, or `runToolCommand` does not count its steps.
