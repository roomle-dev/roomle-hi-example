# Feature Analysis: Insert, remove, replace and swap units in a row of a group (RML-18045)

> **Type**: Feature Analysis
> **Domain**: roomle-ui `homag-intelligence` (`glue-logic.ts`, `hi-plan-context.ts`, `hi-root-module-arrangement.ts`), hi-mcp `tool-executors.ts`, `hi-mcp-server.ts` (roomle-hi-example); RoomleCore `external-module-group-dock-configurator.cpp` (read, not changed)
> **Trigger**: Jira [RML-18045](https://roomle.atlassian.net/browse/RML-18045) — the agent inserts a unit between two units, removes a unit and closes the gap, replaces a unit with an article of another width, and swaps two units, each in one tool call; the group stays one closed row. The ticket leaves open where the edits run, what "remove" means, which part of the row moves, what happens to the units above, how replace is built, and the tool API
> **Date**: 2026-10-05
> **Author**: AI Assistant
> **Status**: Implemented (locally, 2026-10-05) — on the feature branches, nothing pushed, merged or released; see the [close-out](#close-out-2026-10-05)
> **Branch**: `feat/hi-row-edit-tools-RML-18045` (roomle-hi-example); `feat/hi-row-edit-commands-RML-18045` (roomle-ui)
> **Plan**: [insert-remove-replace-swap-units-implementation-plan.md](insert-remove-replace-swap-units-implementation-plan.md) — the open questions resolved as recommended, and seven points the planning added
> **Review (2026-10-05)**: remove and delete are two edits. `delete-root-module` stays as it is and splits the group; a new `remove-article-from-group` removes a unit and closes the gap. Decision 2, the tool API, the design and the first open question are revised accordingly; the first proposal, a flag on `delete-root-module`, is kept under the alternatives
> **Code read**: roomle-hi-example `51ddf6a` (master), roomle-ui `165a71ecc` (master), RoomleCore `65cbae6bb`; the stored MCP test run `mcp-test-2026-10-04_13-00-37` (edit tests 12 to 15)

---

## What was asked and why

Today an agent can add a unit only at an end of a row (`merge-article-into-group`, and the server
moves a unit sent to a taken side to the free end, D29), remove a unit only with the split the
kernel makes (`delete-root-module`), and replace a unit with `exchange-root-module`, which no test
has run with another width. Nothing swaps two units. The user asks for the four row edits —
insert, remove with the gap closed, replace with a width change, swap — as single tool calls, with
the group staying one row: the part of the row that can move makes room or closes the gap, the
part against a wall end or in a corner keeps its place.

**Answer in one paragraph.** The edits belong in roomle-ui as commands of the group command API
(D3): a command rewrites the docking context of the group, arranges the roots with the
`HiRootModuleArrangementOperator`, keeps the group's distance to its walls with
`keepWallDistances` and reloads the group once — the path `swapRootModule` (the planner feature
behind `exchange-root-module`) already takes. That path gives the rule the ticket proposes for
free: the side of the row that stands at a wall keeps its place, a row without a wall on the axis
keeps the end at the group origin, and a row from wall to wall is built anyway. The server adds
the agent-facing tools, resolves ids, corrects input whose intent is clear and reports it. Three
things stand in the way today and are fixed on the way: a deletion leaves stale docking entries
in the glue logic (confirmed live, cause found in the kernel's callback), the units above a
removed unit lose their carrier, and `exchange-root-module` drops a docking the new article
cannot take with only a `console.error`.

## How the area works today

### The four edits with today's tools

| Edit | Today | Verified | Gap |
|---|---|---|---|
| Insert | `merge-article-into-group` docks to a free docking vector. The planner refuses a taken vector (`mergeArticleIntoGroup`, roomle-ui `glue-logic.ts:1097-1160`, P6); the server moves a taken side to the free end of the row first (`dockTarget`, `tool-executors.ts:401-560`, D29) | test `edit-add-one-unit` passes for all three models | No insert between two units |
| Remove | `delete-root-module` asks the kernel to delete the component. The kernel splits the rest into assemblies by docking-vector contact (`tryDeleteChild`, RoomleCore `external-module-group-dock-configurator.cpp:151-183`, `findRootModuleAssembliesByAnalyzingAdjacentDockingVectors:788-822`) and reports them; the glue logic removes the root, splits off the new groups and reloads them where they stand (`deleteRootModule`, `glue-logic.ts:1374-1416`) | test `edit-remove-unit` passes: two groups of one unit, z −3765…−3165 and −2565…−1965, the gap stays | No closing of the gap; stale docking entries afterwards (finding 3) |
| Replace | `exchange-root-module` → `swapRootModule` (`glue-logic.ts:2665-2734`): the new root takes the old one's `articlePos` and `rotationY`, `transferDockingContext` (`:331-373`) moves every docking reference onto it by vector name, the group is arranged against the original and reloaded with `applyGroupPosition` when the arrangement moved the group | test `edit-replace-unit` passes with a 600 mm article for a 600 mm unit; the roomle-ui unit test "keeps the group at its wall when a swap resizes a module" covers the width shift | Not verified live with another width; a docking vector the new article lacks is dropped with `console.error` (`uniqueDockingVectorIndex:309-329`); no `attributes` on the call, so "a 900 mm cabinet" is two calls; articles of several roots refused (P9, stays) |
| Swap | nothing | — | Nothing in the server, the glue logic or the kernel swaps units |

### How a group is rearranged

- **Positions come from the docking.** The arrangement (`HiRootModuleArrangementOperator`,
  roomle-ui `hi-root-module-arrangement.ts:395-931`) completes and mirrors the `contextData`
  entries, then positions every root breadth first from a **seed root**: the non-generated root
  whose `articlePos` is closest to the group origin (`_findRootClosestToZero:911-930`); a root
  reached twice keeps the first position (`_arrangeConnectedRoots:826-905`). Entries with
  `Vertical*` vectors are skipped; the HI libraries author horizontal vectors only, the Top
  vectors of a wall unit included.
- **The seed is the end at the group origin.** The kernel re-anchors the group origin at the box
  minimum on every reload (RoomleCore `arrangement-correction.md:43-55`,
  `displacementOfBoxMinimum`), so after a reload the seed is the root at the back left bottom
  corner of the group: the **left end** of a straight row as seen from the front, the corner
  article of a corner kitchen (its docking corner is the anchor, C6). Everything docked behind the
  seed moves when a unit is inserted, removed or resized. For a group placed from a wall's `end`
  (the rules' default: "`posGroup` = `end` puts the group flush into the corner at the wall's
  end, the row running towards `start`") this is the end in the corner — the right behaviour.
  For a group whose right end was placed flush into a corner, the row would grow into that wall.
- **`keepWallDistances`** (`hi-root-module-arrangement.ts:218-257`, `getWallSides:175-206`)
  corrects exactly that: per axis, the side of the docking vector box that faces a wall segment
  of the group's floor contour keeps its room coordinate; an axis without a wall, or walled on
  both sides, keeps what the seed defined. It moves the group (`pos` and `contours`), not the
  roots, and the following load needs `applyGroupPosition: true`
  (`arrangementMovedGroup`). It runs in `_arrangeRootModulesAndCalculateIfChanged`
  (`glue-logic.ts:3190-3215`) only when the arrangement moved a root **and** the flow may not
  reposition the group (`allowRepositioning: false` with an `originalGroup`) — the attribute
  changes and `swapRootModule`, gated by `enableArrangementCorrection`, which both clients turn
  on (`minimal-hi-example/index.html`, ligna-store `ext-objects/api-options.ts`).
- **The posGroups replace path does not keep the wall distance.** `mergeArticleIntoGroup` and the
  server's `create-or-replace-groups` replace the group through
  `_createOrReplacePosGroupsFromLayout` (`glue-logic.ts:733-798`), which arranges with
  `allowRepositioning: true` — `pendingArrangement.originalGroup` is `undefined`
  (`_calculateAndUpdateGroupMap:2122-2149`), so `keepWallDistances` never runs there. The group
  keeps its `pos` from the original (`_takeOverPropertiesFromOriginalGroup:3387`), and the seed
  stays.
- **A reload refreshes the cached positions** only when the kernel answers with the group's
  position: `respondWithPositionInPlan` is set for the load reasons `load`, `change_attribute`
  and `swap_module` (roomle-ui `roomle-planner.ts:2626-2636`); the answer reaches
  `changedGroupPlanningSituation` (`planner-kernel-access.ts:1495-1503`) and is the second
  history event the server waits for after those commands (`FOLLOW_UP_COMMANDS`,
  `tool-executors.ts:2315-2319`, D38).

### How the kernel deletes a root, and why stale dockings remain

The kernel copies the group structure, erases the deleted root **and every docking reference to
it** from the structure's `contextData` (`eraseRootModulesFromGroup`,
`external-module-group-dock-configurator.cpp:683-707`), splits the rest into assemblies — but the
assemblies it builds carry only `groupId`, `groupBox` and `rootModules`, not the cleaned
`contextData` (`getManipulatedGroupAssembliesFromAssemblyIds:825-848`). The `REMOVED_ROOT`
callback forwards these assemblies (`external-configurator-manipulation-callbacks.cpp:79-88`;
`PosGroupStructure.contextData` exists, `plan-overview.h:163-169`, but is empty here). In
roomle-ui, `_externalObjectComponentDeleted` (`planner-kernel-access.ts:1470-1487`) passes them
to `deleteRootModule`, whose `_updateGroupGeometry` sets positions and sets `contextData` **only
when the callback carries it** (`_setRootModuleContextData:1981-1995`). The glue logic's
`posDataJson` therefore keeps the docking entries that name the deleted root, in the remaining
group and in the split-off groups (`_splitOffRootModulesFromGroup:2031-2071` moves the roots with
their context unchanged).

**Confirmed in the stored run** `mcp-test-2026-10-04_13-00-37`, test 14 (gpt-5-mini and
gpt-6-astra alike): after `delete-root-module` of the middle unit `a7271f1b…`, the back unit
`0010443c…` still carries `RightBottom → a7271f1b:LeftBottom` and `RightTop → a7271f1b:LeftTop`,
its `freeDockingVectors` are `LeftBottom, LeftTop, BackBottom, BackTop` — the now free right side
is missing; the front unit mirrors it. `freeDockingVectors` is derived from the entries
(`hi-plan-context.ts:308-315`), so the plan context lies about the free sides, and
`merge-article-into-group` on them runs into P6. The behaviour doc already names the effect ("a
stale docking entry after a deletion"); this is its cause.

### What the server adds around the commands

- The command executors (`tool-executors.ts:3033-3251`) resolve group id prefixes (C4), root ids
  with a tolerant match (C17), article ids in the catalog's spelling (G15), and for
  `merge-article-into-group` the dock target (D29, P7, D35); every correction is reported.
- Every plan-changing tool runs in the `oneAtATime` queue (D4) and is recorded with its planner
  steps for `undo` (`planChange`, `countingPlannerApi`, `tool-executors.ts:2346-2441`, D38): one
  step per group command, plus the follow-up reload for the commands in `FOLLOW_UP_COMMANDS`.
- The row geometry helpers exist: `sidePartnersOf` (`:864`), `rowWalk` (`:957`),
  `cornerPredicate` (`:981`), `unitStaysInRoom` (`:362`), and in `plan-space.ts`
  `groupFootprint`, `pointInsideRoom`, `rootFootprintInRoom`, `volumesOverlap`.

## Findings — the ticket's six findings checked against the code

| # | Ticket finding | Result |
|---|---|---|
| 1 | After a reload the seed root is the one closest to the group origin, so the end at the origin stays; only `keepWallDistances` looks at walls, and only for exchanges and attribute changes | **Confirmed.** The origin is the box minimum after a reload, so the seed is the left end (or the corner article). `keepWallDistances` already implements "the walled side stays, otherwise the seed side" and runs for every flow that arranges with `allowRepositioning: false` — any new command can use it |
| 2 | Nothing stops a row from growing through a wall or into another group | **Confirmed.** The kernel loads what it gets; `keepWallDistances` holds a walled side but does not check the other end. The plan context has the walls and footprints; the server can report it (D22: never refuse) |
| 3 | A deletion likely leaves stale dockings | **Confirmed live**, cause found: the kernel cleans the context but does not pass it on, and the glue logic keeps its own (above). Fix in the glue logic, below |
| 4 | Units above move with the root they are placed from; a deletion leaves a wall unit connected only through the deleted floor unit on its own | **Confirmed by code.** The first wall unit of a row is docked `above` a floor unit, the next ones to each other (D34, C16), so the whole wall row follows the floor unit the first one hangs from. A root whose docking names a removed root is not reached by the arrangement; with its old `articlePos` it becomes a seed of its own and keeps its old place (`_findRemainingSeedWithPosition`). With the kernel's deletion it splits off as a group |
| 5 | Corner articles get no special treatment | **Confirmed.** `deleteRootModule` filters the root, `transferDockingContext` transfers by vector name; a corner article in the middle of the two legs is the seed of a corner kitchen, so an edit on one leg leaves it in place — the behaviour the ticket wants, without special code |
| 6 | Generated roots resubmitted as stubs | **Confirmed, no issue for the commands.** The glue logic works on its own `posDataJson`, generated roots included, and `calculateGroup` rebuilds them (`swapRootModule` and `mergeArticleIntoGroup` do this today). The server drops `isGenerated` roots only on `create-or-replace-groups` (C1) |

## The gap

1. No command inserts a unit between two docked units, and no command swaps two units.
2. `delete-root-module` cannot close the gap; the kernel's deletion is a split by design.
3. Three defects on the way: stale docking entries after a deletion (3), the units above a removed
   unit lose their carrier (4), and a dropped docking on an exchange is silent.
4. `exchange-root-module` takes no `attributes`, so "replace it with a 900 mm cabinet" is two
   calls, against "every edit is one tool call".
5. The served rules point every edit of an existing group to the command tools without saying
   which part of the row moves.

## Decisions (recommended; the review confirms them)

**Decision 1 — where the edits run: roomle-ui commands (option A).** Insert, remove with the gap
closed and swap are commands of `HI_GROUP_OPERATION`, performed by the glue logic with the
`swapRootModule` pattern: rewrite the docking context, arrange against the original group, keep
the wall distance, load once. Option B (the server rewrites the relations and replaces the group
with `create-or-replace-groups`) gets no `keepWallDistances` (the replace path arranges with
`allowRepositioning: true`), would have to choose the seed root and set the group position itself
with no planner support (D26: a placement on an existing group is not used), and would re-create
the whole group for one edit (regenerated ids, two history steps). Option A also serves other
clients of the command API and makes the stale-docking fix a roomle-ui unit test.

**Decision 2 — remove and delete are two edits** (revised in the review). `delete-root-module`
stays as it is: it deletes the unit, and units no longer docked together become separate groups
where they stand, so a unit from the middle splits the group. A new command and tool
`remove-article-from-group` removes the unit and closes the gap, as the ticket defines remove ("the
remaining part of the group has to be moved to close the gap"). A unit between two units is
removed and its neighbours are docked to each other; a unit at an end of a row is removed and
nothing else moves, as there is no gap. The test `edit-remove-unit` ("remove the middle unit")
expects the closed row; a new test `edit-delete-unit` ("delete the middle unit") expects the
split. The analysis first proposed a flag on `delete-root-module` instead (see the alternatives).

**Decision 3 — which part moves: the rule of `keepWallDistances`.** The side of the row that
stands at a wall keeps its place; without a wall on that axis the end at the group origin stays —
the left end of a straight row as seen from the front, the corner article of a corner kitchen. A
row from wall to wall keeps its left end and is built anyway; the result says how far it reaches
into the wall or into another group (D22). The rules tell the agent this in one sentence.

**Decision 4 — units above follow the unit they are docked to.** A unit docked `onTop` of or
`above` an edited unit moves with it: with the replaced unit (`transferDockingContext` does this
today), with the swapped unit (the hood stays over the hob), with the floor unit an insert pushes.
On a remove with the gap closed, a unit docked above the removed unit is docked above the unit
that moves into its place (the next unit of the row), so it never floats. Further wall units keep
their docking to each other and follow the first one. The result names the wall units and hoods
of the group whose unit below changed, so the agent can edit the wall row with the same tools — a
row of wall units is a row like any other for insert, remove and swap.

**Decision 5 — replace stays `exchange-root-module`, extended.** The command keeps the position
and the docking by vector name and already shifts the rest of the row by the width difference
with the wall distance kept. It gets `attributes?: [{ id, value }]` for the new unit (applied as
input overrides after `_applyImplicitRelevantAttributes`), reports every docking reference it
drops in the result instead of `console.error`, and the MCP test replaces a unit with a 900 mm
article. P9 (articles of several roots) stays.

**Decision 6 — the tool API.**

| Tool | Parameters | Command |
|---|---|---|
| `insert-article-into-group` | `groupId`, `articleId`, `attributes?`, `between: [rootId, rootId]` | `insert-article-into-group` |
| `remove-article-from-group` | `groupId`, `rootModuleId` | `remove-article-from-group` |
| `delete-root-module` | `rootModuleId` (unchanged) | `delete-root-module` (unchanged) |
| `exchange-root-module` | `groupId`, `rootModuleId`, `articleId`, `attributes?` | `exchange-root-module { …, attributes? }` |
| `swap-root-modules` | `groupId`, `rootModuleIds: [rootId, rootId]` | `swap-root-modules` |

`between` names the two neighbours in either order: it carries the intent ("between the first and
the second unit") without a direction, and the test runs showed the agents name the wrong
direction as often as the wrong root (D29). The server corrects what it can: two roots of one row
that are not neighbours become "beside the first-named root, towards the second" with a
correction; a `dockTo` sent by mistake is read as `between` the named root and its neighbour on
that side. Only two roots that are not in one row fail, naming the rows. `swap-root-modules`
takes two roots of the group, neighbours or not; swapping a unit with itself fails.
`merge-article-into-group` and D29 stay for "add at the end".

## Proposed design

### roomle-ui

**1. The commands** (`hi-plan-context.ts`): `INSERT_ARTICLE_INTO_GROUP: 'insert-article-into-group'`,
`REMOVE_ARTICLE_FROM_GROUP: 'remove-article-from-group'` and `SWAP_ROOT_MODULES: 'swap-root-modules'` in
`HI_GROUP_OPERATION`; the payload types `{ groupId, articleId, attributes?, between: [string, string] }`,
`{ groupId, rootModuleId }`, `{ groupId, rootModuleIds: [string, string] }`
and `exchange-root-module { …, attributes? }`; one handler each that validates the shape (two
distinct non-empty ids, an article pick without coordinates) and calls the operation.
`HiGroupOperationOutcome` and `HiGroupOperationResult` get `corrections?: string[]` — what the
operation changed about the request or could not keep (a dropped docking, a re-docked wall unit).

**2. One shared step in the glue logic — "rewire, arrange, load"**, factored out of
`swapRootModule` and used by the three row commands:

```
_rearrangeGroup(groupItem, originalGroup, reason):
  calculateAndUpdateGroupMap(groupItem, rearrange = true, allowRepositioning = false, originalGroup)
  loadPosGroups(group, { reason, applyGroupPosition: groupItem.arrangementMovedGroup })
```

The arrangement runs against the original group, so `keepWallDistances` applies (Decision 3), and
the load reason is one the planner answers with the position (`respondWithPositionInPlan`), so the
cached root positions and the context are fresh for the next edit — the follow-up reload the
server already waits for after `exchange-root-module`.

**3. The operations:**

- `insertArticleIntoGroup(groupId, pick, between)`: finds the side docking entry that connects the
  two roots (`RightBottom ↔ LeftBottom` or `RightTop ↔ LeftTop`; both directions, the context is
  mirrored); checks the article has that vector pair (`_requireArticleDockingVector`, else the
  partner, else the P7 message); removes the entry in both directions; adds `A ↔ N` and `N ↔ B`
  with the mode of the removed entry and its offset kept on the `A` side; appends the article pick
  root (`_prepareArticlePickRoots` expands it on the calculation, as `mergeArticleIntoGroup`
  relies on); runs the shared step.
- `removeArticleFromGroup(groupId, rootModuleId)`: for a root that has a side neighbour on both sides, removes the root from `posDataJson`, docks the two neighbours to each
  other with the removed root's left entry, moves every `*Top ↔ *Bottom` entry that hung a unit
  on the removed root onto the next unit of the row (Decision 4, reported in `corrections`), and
  runs the shared step — the reload without the root removes its component, as a
  `create-or-replace-groups` replace does (D11; verified live in the implementation). For a unit at an end of
  the row, the kernel deletion of `delete-root-module`. `deleteRootModuleById` stays unchanged.
- `swapRootModules(groupId, [a, b])`: exchanges the side docking entries of the two roots (every
  reference to `a` on a side vector names `b` and vice versa, including the entries on their
  neighbours; `onTop`/`above` entries stay with their root), gives the two roots each other's
  `articlePos` so the seed role passes to the root that takes the seed's place, and runs the
  shared step. Attributes travel with their roots.
- `exchangeRootModule(groupId, rootModuleId, pick)`: `swapRootModule` applies the pick's
  `attributes` to the new root; `transferDockingContext` collects the dropped references into
  `corrections` instead of `console.error`.

**4. The stale-docking fix** (finding 3): `deleteRootModule` (the kernel callback) erases every
docking entry that names the deleted root, and `_splitOffRootModulesFromGroup` erases the entries
that name a root of another group, in both the remaining and the split-off groups. A kernel-side
fix (copying the cleaned `contextData` into the assemblies) would also work but needs a kernel
release; the glue logic owns its `posDataJson`, so it owns the fix. Unit tests: "removes the
docking references to a deleted root" and "a split-off group carries no docking to the group it
left".

**5. Documentation**: the command table of `externalObjectGroupOperation` in
`packages/embedding-lib/docs/homag-intelligence-embedding.md` and the "Group Operations" notes in
`.agents/homag-intelligence.md` (the shared step, the seed and wall rule, the stale-docking fix).

### roomle-hi-example

- **Tools** (`hi-mcp-server.ts`): `insert-article-into-group` and `swap-root-modules` registered
  with zod schemas, and `remove-article-from-group`; `delete-root-module` stays, its description says
  that it leaves the gap; `exchange-root-module` gets `attributes`. The descriptions say which tool serves which wish and which part of the row moves
  (Decision 3), in one sentence each.
- **Executors** (`tool-executors.ts`), wrapped in `planChange` like the other commands: resolve
  the group (C4), the root ids (C17) and the article id (G15); for `between`, check the two roots
  are docked neighbours by `sidePartnersOf`, correct non-neighbours of one row to "beside the
  first-named, towards the second", read a `dockTo` as `between`; forward the command; merge the
  planner's `corrections` into the result's; after the load, compare the group's footprint with
  the room and the other groups (`rootFootprintInRoom`, `pointInsideRoom`, `volumesOverlap`) and
  add a hint when the row reaches into a wall or another group (D22, finding 2); list the hanging
  units whose unit below changed (Decision 4). `insert-article-into-group` and `swap-root-modules`
  join `FOLLOW_UP_COMMANDS` (their load answers with the position, like `exchange-root-module`),
  and `delete-root-module` with the gap closed does too.
- **Instructions**: the rule "To change an existing group, use the command tools …"
  (`hi-mcp-server.ts:25`) and step 3 of `INSTRUCTIONS` (`:65`) name the four edits and the rule
  which part moves; the "Extending a kitchen" rule (`:23`) keeps `merge-article-into-group` for
  the end of a row and points an insert between two units to the insert tool. Example 5 gets a
  sibling: "insert a unit between the first and the second unit". Shorter, not longer: one
  sentence per tool.
- **Behaviour doc** (`hi-mcp/docs/hi-mcp-behaviour.md`): the new tools in §6, the decisions as
  D39–D42 (where the edits run, remove closes the gap, which part moves, units above), the new
  corrections and the hint in §8.5, P6 rewritten once the stale docking is fixed.
- **Tool reference** (`minimal-hi-example/docs/hi-mcp-server.md`) and the skills
  `.agents/skills/hi-mcp-tools.md`, `hi-authoring-rules.md` ("Editing a group"),
  `hi-mcp-server.md` (the command list).
- **ligna-store**: no change — the commands need no new planner method and the page allow-lists
  stay (D3). The store needs the roomle-ui release that carries the commands.

### Tests

- **roomle-ui** (`glue-logic-test.ts`, vitest): insert between two roots (the new root docked to
  both, the far side moved by its width, the near side in place), insert at a walled far side (the
  group moved so the wall side stays), remove with the gap closed (neighbours docked, the hanging
  unit re-docked), remove an end unit (nothing moves), swap neighbours and
  non-neighbours (positions exchanged, attributes with their roots, the wall side kept, the seed
  passed on), exchange with `attributes` and with a dropped docking reported, the two
  stale-docking tests; `hi-plan-context-test.ts`: the payload validation of the three commands.
- **roomle-hi-example** (`tool-executors.test.ts`): per tool the forwarded command and payload,
  the id resolutions, the `between` corrections (order, non-neighbours, `dockTo`), the merged
  `corrections`, the wall/overlap hint, the hanging-unit list; `hi-mcp-server.test.ts`: the tool
  list and the served text (no rejections, no internals); `plan-history.test.ts`: the follow-up
  wait for the new commands.
- **"Test the mcp"** (`docs/test-prompts.json`), on the Three Tall Units plan: "insert a cabinet
  with drawers between the first and the second unit", "remove the middle unit and close the gap"
  (the changed `edit-remove-unit`), "remove the middle unit and leave the gap", "replace the
  middle unit with a 900 mm cabinet with drawers", "swap the first and the last unit". A new plan
  snapshot with base units, wall units and a corner article (saved with the example's snapshot
  button, documented in `docs/test-prompts.md`): "insert a sink unit between the oven unit and
  the fridge" (the wall units follow the pushed unit, reported), "remove the base unit next to
  the corner unit" (the corner article stays, the free end of the leg moves), "swap the oven and
  the fridge" (the hood follows the hob).

## Alternatives considered and rejected

- **Option B, the edits in the server** via relations and `create-or-replace-groups`: no wall
  correction, the server would have to pick the seed and position the group without planner
  support (D26), two history steps, regenerated root ids — rejected (Decision 1).
- **Insert as a mode of `merge-article-into-group`** (`between` beside `dockTo`): one tool for two
  intents blurs D29 — a taken side today means "the agent meant the end of the row", with insert
  it would mean "between" — and a long description. A tool named for the intent is what the model
  selects by; rejected.
- **Insert with one root and a side** (`rightOf`/`leftOf`): the direction problem of D29 again;
  accepted only as a corrected input, not as the API.
- **A flag on `delete-root-module`** (`keepGap` on the tool, `closeGap` on the command), closing
  the gap by default — the first proposal of Decision 2, rejected in the review: delete and remove
  are two edits the user names differently, and delete keeps splitting the group.
- **Closing the gap on the kernel's deletion path** (merge the split assemblies again in the
  callback): two groups to merge back, two or three history steps, and the kernel's split is the
  behaviour `delete-root-module` keeps; the reload without the root is one load.
- **Fixing the stale docking in the kernel** (pass the cleaned `contextData` with the
  assemblies): correct too, but a kernel release for a glue-logic cache; the glue logic fix is a
  unit test away.
- **Applying a floor-row edit to the wall row automatically** (insert a matching wall unit,
  remove the wall unit above a removed unit): the server cannot tell what the user wants above the
  new unit; the same tools on the wall row do it in a second call, and the result names the units
  to look at.

## Code and documents the work would touch

| Where | What |
|---|---|
| roomle-ui `packages/web-sdk/packages/homag-intelligence/src/hi-plan-context.ts` | `HI_GROUP_OPERATION`, the payload types, `HiGroupOperations`, the handlers, `corrections` in the outcome and result |
| roomle-ui `glue-logic.ts` | `insertArticleIntoGroup`, `swapRootModules`, `removeArticleFromGroup`, `exchangeRootModule(…, pick)`, the shared rearrange-and-load step, `transferDockingContext` reporting, the stale-docking fix in `deleteRootModule` and `_splitOffRootModulesFromGroup`; `debug-logging.ts` forwards |
| roomle-ui `external-object-api.ts`, `roomle-planner.ts` | the load reason `rearrange` for insert, remove and swap in the `respondWithPositionInPlan` set |
| roomle-ui `__tests__/glue-logic-test.ts`, `hi-plan-context-test.ts` | the tests above |
| roomle-ui `packages/embedding-lib/docs/homag-intelligence-embedding.md`, `.agents/homag-intelligence.md` | the command table, the notes |
| roomle-hi-example `hi-mcp/hi-mcp-server/hi-mcp-server.ts` | two tools, two extended schemas, the rules and the instructions |
| roomle-hi-example `hi-mcp/hi-mcp-server/tool-executors.ts` | the executors, the `between` corrections, the hint, `FOLLOW_UP_COMMANDS` |
| roomle-hi-example `hi-mcp/hi-mcp-server/tests/` | `tool-executors.test.ts`, `hi-mcp-server.test.ts`, `plan-history.test.ts` |
| roomle-hi-example `docs/test-prompts.json`, `docs/test-prompts.md`, `docs/images/` | the new tests, the plan with wall units and a corner |
| roomle-hi-example `hi-mcp/docs/hi-mcp-behaviour.md`, `minimal-hi-example/docs/hi-mcp-server.md`, `.agents/skills/hi-mcp-tools.md`, `hi-authoring-rules.md`, `hi-mcp-server.md`, `AGENTS.md` (tool list) | the documentation |

## Verification

1. roomle-ui: `npm test` in `packages/web-sdk` (the glue-logic and plan-context tests), typecheck.
2. roomle-hi-example: `npm test` and `npm run typecheck` at the `hi-mcp` root.
3. Live, headless, against the roomle-ui branch (worktree and `EXAMPLE_SERVER_URL`, as in the
   earlier live checks): on the Three Tall Units plan each edit as one `externalObjectGroupOperation`
   call; the plan context afterwards shows one group, the docking without the removed root, correct
   `freeDockingVectors`, and the footprint with the back end at z = −3765 in every edit; the
   kernel's reload without a root removes its component; the price and the order data show the
   edited row.
4. "Test the mcp" with gpt-5-mini: the five new edit tests and the three wall-unit tests pass,
   the existing edit tests still pass.

## Open questions for the review of this analysis

1. **Default of remove** (Decision 2) — answered in the review: remove and delete are two edits;
   `delete-root-module` keeps the split, `remove-article-from-group` closes the gap.
2. **The insert API** (Decision 6) — confirmed in the review: `between` only, two neighbours in
   either order. The plan leaves out reading a `dockTo` (the tool schema drops it).
3. **Units above** (Decision 4) — confirmed: a unit hung above a removed unit is docked above the
   unit that moves into the gap, and nothing edits the wall row automatically.
4. **The stale-docking fix in the glue logic**, not the kernel — confirmed.
5. **Tool names** — confirmed: `insert-article-into-group` and `swap-root-modules`; the remove
   tool is `remove-article-from-group` (the user's name, the inverse of the insert).

## Close-out (2026-10-05)

Implemented locally as planned — see the [plan's close-out](insert-remove-replace-swap-units-implementation-plan.md#close-out-2026-10-05)
for the commits, the live verification and the MCP test. Four findings of the live checks and the MCP test changed
the design of this analysis:

1. **Finding 4 was optimistic.** The units above do not follow the unit below them through the
   docking: after a load the kernel's docking context links only docking vectors that touch, and a
   wall unit or a range hood hanging with a gap is not docked to its floor unit any more. Decision 4
   holds by position instead — the planner finds the unit below each unit above and moves it along
   (`carriersOfUnitsAbove`, `moveUnitsAboveWithTheirCarriers`), in every rearrangement that keeps
   the group in place.
2. **A unit at the end of a row is removed in one reload**, not by the kernel's deletion: the kernel
   splits a group by docking, so its deletion makes the wall units groups of their own. Only a corner
   article between two legs and the only unit of a group are deleted by the kernel.
3. **The rearranged row loads with `applyGroupPosition`**: the kernel keeps the roots it knows by id
   where they were, which moved a swapped row into the wall.
4. **A unit above the removed unit** goes above the neighbour that moves into the gap, as Decision 4
   says, unless that neighbour carries a unit above it already. Then it keeps its place, and the
   result says so. In the corner kitchen it then overlaps the range hood that moved in, and nothing
   says that yet ([MCP test open issue 42](../backlog/mcp-test-open-issues.md#42-a-wall-unit-that-keeps-its-place-overlaps-the-unit-that-moved-in-below-it)).

`delete-root-module` itself is unchanged and still splits by docking: in a kitchen with wall units it
makes them groups of their own (a pre-existing behaviour, listed under the open issues of the plan's
close-out).
