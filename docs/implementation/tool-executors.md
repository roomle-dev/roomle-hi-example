# Tool Executors

`hi-mcp/hi-mcp-server/tool-executors.ts` holds the logic of every tool: it validates and corrects
the agent's input, composes the planner calls, and shapes the result. It is the largest file of the
server (≈3,700 lines). What the tools do towards the agent, with every correction and message, is
in [hi-mcp-behaviour.md §6](../hi-mcp-behaviour.md#6-tools) and
[§8](../hi-mcp-behaviour.md#8-guards-corrections-and-feedback). [Back to the overview](./README.md).

## The file

The file is ordered from helpers to executors; `toolExecutors`, the map the tool handlers call, is
at the end.

| Section | Main identifiers |
| ------- | ---------------- |
| Plan-context sections | `PLAN_CONTEXT_SECTIONS`, `DEFAULT_SECTIONS` |
| Root shapes for the planner | `isGeneratedRoot`, `toArticlePick`, `withoutPositions`, `repositionedGroup` |
| find-attributes matching | `attributeMatches` |
| Article and root id resolution | `catalogArticleId`, `catalogSpellingOf`, `resolveArticleIds`, `removeReferencesTo`, `resolveRootId`, `withPlanRoots` |
| merge-article-into-group target | `articleWidth`, `unitStaysInRoom`, `dockTarget` |
| Row-edit helpers | `neighbourTowards`, `rowReachHints`, `movedUnitsAboveHint`, `withRowHints`, `insertBetween` |
| Group lookup | `findGroup`, `planGroups` |
| The plan context the agent sees | `agentFacingArticle`, `agentFacingRooms`, `agentFacingObstacles` |
| Anchor probe | `knownAnchorFrames`, `probeAnchorFrame`, `takeBackProbe` |
| Placement normalisation | `normalizePlacement` |
| Docking graph and its completion | `sidePartnersOf`, `rowWalk`, `separateSideVectorPartners`, `connectUnreachedRoots`, `reportUnsentRoots`, `completeDocking` |
| Group-wide attributes, group id memory, post-load checks | `generatedRootAttributes`, `moveGeneratedRootOverrides`, `agentGroupIds`, `applyKitchenWideAttributes`, `groupsAtTheSamePlace`, `reportRevertedReplaces` |
| Partial loads | `NotLoadedGroup`, `keepBuildable`, `nothingLoaded` |
| Payload preparation | `dropMalformedDocking`, `liftNestedRoots`, `completeDockingEntries`, `normalizedAttributes`, `reportUnusedFields`, `readDockToAsRelation`, `prepareGroup` |
| Geometry for place-group | `placedGroupVolumes`, `overlappedGroupIds`, `resolveWall`, `placeGroupAtWall`, `standsAt`, `freePlacementAlongWall` |
| Concurrency and undo recording | `oneAtATime`, `countingPlannerApi`, `recorded`, `planChange` |
| Undo and redo | `stepHistory`, `revertToolCall` |
| Positions in the placement frame | `inPlacementFrame` |
| The executors | `toolExecutors` |

## Wrappers

| Wrapper | What it does | Used by |
| ------- | ------------ | ------- |
| `oneAtATime` | Chains the call onto a module-level promise (`planChanges`), so plan changes never run concurrently; a failed call does not block the next | `get-plan-context`, every plan-changing tool, `undo`, `redo` |
| `recorded(tool, …)` | Counts the planner steps of the call for undo ([MCP server](./mcp-server.md#undo-and-redo)) | every plan-changing tool |
| `planChange` | `oneAtATime(recorded(…))` | `create-or-replace-groups`, `place-group`, the ten command tools |
| `inPlacementFrame` | Rewrites every group `position` in the result into the placement frame ([Layout and placement](./layout-and-placement.md#reading-a-group-back-positioninplacementframe)) | every tool that returns groups |

Why `oneAtATime` exists: the page runs every call it receives at once; the anchor probe finds its own
group by comparing the plan before and after its load, and `get-plan-context` reads the context and
then the raw groups — both must see the same plan.

## get-plan-context

1. Keeps the `include` sections that exist; none left means `DEFAULT_SECTIONS` (all but `masterData`).
2. `obstacles` needs `rooms` to assign doors and windows to walls; it fetches them and removes them
   again if they were not asked for.
3. One `getExternalObjectPlanContext(sections)` call — roomle-ui shapes the context
   (`hi-plan-context.ts`).
4. Adds the agent's vocabulary ([The plan context the agent sees](#the-plan-context-the-agent-sees)).
5. `inPlacementFrame` rewrites the group positions.

## find-attributes

Reads the master data fresh on every call, filters by `libraryId`, and matches the text
(lower-cased substring) against the attribute's id, name, description and group and every
selection's name, description and value (`attributeMatches`). Returns the first
`MAX_ATTRIBUTE_MATCHES` (20) with the root modules that carry each attribute, the total, and a hint
when there were more.

## create-or-replace-groups

The longest pipeline. Each group of the call is prepared on its own; a group that fails leaves the
call and is reported in `notLoaded`, the others load
([§8.3](../hi-mcp-behaviour.md#83-create-or-replace-groups)).

1. **Kitchen-wide attributes first.** `generatedRootAttributes` takes the attributes the agent set on
   generated roots (worktop, toe kick) before they are dropped.
2. **Prepare** each group (`prepareGroup`, through `keepBuildable`): drop malformed docking, lift
   units nested in docking entries to roots, complete docking entries, read `dockTo` as a relation,
   report unused fields, normalise attributes, drop positions (group `pos`/`rotationY`, root
   `articlePos`/`rotationY`), read `repositioningData` as a `placement`, give missing ids, rename
   duplicates, normalise the placement (`normalizePlacement`).
3. **Reduce every root to an article pick** (`toArticlePick`): id, article id, library, attributes,
   docking without indices, relation fields.
4. **Resolve article ids** against the catalog (`resolveArticleIds`): another spelling is read as the
   catalog's; an unknown article drops that root and every reference to it, and the group still
   loads — only a group without any known article fails.
5. **Relations to docking** (`relationsToDocking`, [Layout and placement](./layout-and-placement.md#relations-to-docking--group-layoutts)).
6. **Move attribute overrides** meant for generated roots (`moveGeneratedRootOverrides`).
7. **Group ids:** a group id the agent invented for a new group in an earlier call is mapped to the id
   the planner gave it (`resolveAgentGroupIds`), so resending it replaces instead of duplicating.
8. **Complete the docking** of new groups (`completeDocking`): a second unit on an occupied side goes
   to the free end of the row (`separateSideVectorPartners`, `rowWalk`); unconnected parts are
   docked to a free row end of their kind (`connectUnreachedRoots`); roots that cannot be reached
   are reported (`reportUnsentRoots`).
9. **Placement:** a group already in the plan keeps its place (its placement is dropped, with a
   correction). For a new group with a placement, the anchor root is found (`anchorRootOf`), its
   anchor frame is taken from `knownAnchorFrames` or learned by `probeAnchorFrame`, and
   `toRepositioningData` derives the planner's repositioning.
10. **Load:** `loadExternalObjectGroupLayout({ posGroups }, 'posGroups', { reason: 'adjusted' })`. An
    empty result throws "No groups were created or replaced", with every `notLoaded` reason.
11. **After the load:** read the groups again; detect a replace the planner silently reverted
    (`reportRevertedReplaces`); apply the kitchen-wide attributes with
    `externalObjectGroupOperation('change-group-attribute', …)` (`applyKitchenWideAttributes`);
    remember the agent's group ids (`rememberAgentGroupIds`); hint at unpositioned groups and
    groups at the same place (`groupsAtTheSamePlace`).

Result: `{ loaded, groups, hint?, corrections?, notLoaded? }`. `groups` is every group of the plan,
`loaded` the planner's ids of the loaded groups.

### The anchor probe

The planner positions a group by one root's transform, and where that root's docking corner lies
differs per article and per attribute variant. `probeAnchorFrame` learns it: it loads a one-unit
group with the id `anchor-probe`, finds it by comparing group ids before and after, reads its
calculated docking vectors (`anchorFrameOfRoot`), and takes the load back with `takeBackProbe`
(`undo()`, then `removeExternalObject` for anything left). Frames are cached for the process by
`anchorVariantKey` (library, article, sorted attribute overrides). A frame that cannot be learned
gives `IDENTITY_FRAME` and a correction: the group may stand off the requested point.

## place-group

1. Reads `wall` and `alignment` side labels (`back` → `top`, `front` → `bottom`, `sideLabel`);
   defaults: alignment `center`, offset 0, room 0.
2. Reads `rooms` and `groups`, finds the group (`findGroup`) and the wall (`resolveWall`: a side label
   means the longest real wall on that side).
3. An alignment that runs along the wall (`alignmentRunsParallel`) becomes `center`, with a
   correction.
4. Reads the raw group (`getExternalObjectGroups`) — without calculated geometry it throws.
5. `placeGroupAtWall` computes the raw group position: into the corner (`placeCornerAtWalls`) when
   the alignment names an adjoining wall and the group has a corner geometry, else against the wall
   (`placeAgainstWall`). The group keeps its height.
6. If the group would overlap another (`volumesOverlap`, 5 mm tolerance) when placed against a wall,
   `freePlacementAlongWall` tries the free spans beside the other groups, nearest first; if none is
   free, it stays as asked, with a correction.
7. If the group already stands there (`standsAt`), nothing is loaded.
8. Loads `repositionedGroup(rawGroup, placement)` with `loadExternalObjectGroupLayout`.

Result: `{ placedIn: 'wall' | 'corner', wall, group }` with corrections.

## The command tools

Every command tool resolves the ids it is given, corrects what it can, and forwards one planner
command: `externalObjectGroupOperation(command, payload)`. The planner (roomle-ui `glue-logic.ts`)
performs the edit with its own group features and answers once the result is loaded.

| Tool | Resolves | Result wrapping |
| ---- | -------- | --------------- |
| `change-module-attribute` | the root among all roots of the plan | `withPlanRoots`, `withCorrections` |
| `change-group-attribute` | the group | the planner's result |
| `delete-group` | the group | the planner's result |
| `delete-root-module` | the root among all roots | `withPlanRoots`, `withCorrections` |
| `remove-article-from-group` | the group, the root within it | `withRowHints` + both |
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

For insert, remove, exchange and swap the server does **not** rewrite the row's docking — the planner
does: it closes or opens the gap, keeps the ends at a wall or in a corner, and moves the units
above with their carrier (roomle-ui `hi-root-module-arrangement.ts`, `carriersOfUnitsAbove`). The
server's part:

- `insertBetween`: two roots that are not neighbours are read as the first root and its neighbour
  towards the second (`neighbourTowards`), with a correction; two roots of different rows throw,
  naming the side neighbours.
- `withRowHints` compares the raw groups before and after the edit and adds a `hint` when the row
  newly reaches past a wall or into a group it did not overlap before (`rowReachHints`), and names
  the wall units that moved with the unit below them (`movedUnitsAboveHint`). It does not apply to
  `merge-article-into-group` and `delete-root-module`.

## undo, redo

`revertToolCall(direction)` — described in [MCP server](./mcp-server.md#undo-and-redo).

## get-price, get-order-data, get-plan-images

Thin forwards: `fetchPrice()`; `getExternalObjectSnapshot({ orderData: true })` returning `orderData`;
`getExternalObjectSnapshot({ perspectiveImage, topImage })` returning both images.

## The plan context the agent sees

roomle-ui returns the plan context agent-ready (D48); the server adds its vocabulary:

| Function | Adds |
| -------- | ---- |
| `agentFacingRooms` | per wall `name` (`wallName`: back, front, left, right wall), `type: 'opening'` for a wall entry without type (a door); per room `corners` (`roomCorners`) |
| `agentFacingObstacles` | per door and window its room, wall and span from the wall's end (`wallOfOpening`) |
| `agentFacingArticle` | `cornerArticle` (`isCornerArticle`); removes `cornerPoint` |
| `inPlacementFrame` | group positions in the placement frame |
| `withoutImageUrls` (`hi-mcp-server.ts`) | removes every `imageUrl` |

## Corrections, hints and partial loads

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

## Before you change this file

- **Input is mutated in place.** `prepareGroup`, `normalizePlacement` and `resolveArticleIds` change
  `args.posGroups`; `runTool` clones the arguments before the executor runs so the log shows what
  the agent sent.
- **Process-lifetime caches:** `knownAnchorFrames`, `knownMasterData`, `agentGroupIds`. Their
  `forget…` functions are called only by tests.
- **Constants declared late:** `PARTNER_VECTOR` and `OVERLAP_TOLERANCE_MM` are declared after
  functions that use them; that works only because those functions run after module
  initialisation.
- **Two partner maps:** `SIDE_PARTNER` is the opposite side of the same root; `PARTNER_VECTOR` is the
  vector that meets a given vector on the neighbour.
- **Messages are contract** — quoted in the behaviour reference, read by the agents and the tests.
- **Step counting mirrors roomle-ui** — a change to roomle-ui's reloads changes `FOLLOW_UP_COMMANDS`
  (D47).
