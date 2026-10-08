# Bug Analysis: a lone wall unit drops onto the worktop

> **Type**: Bug Analysis
> **Domain**: roomle-ui — the root module arrangement (`_validateAndCompleteContextData`,
> `hi-root-module-arrangement.ts`) and the takeover of the planner's docking report
> (`_setRootModuleContextData`, `glue-logic.ts`); hi-mcp — the hang entry of `above` (D35,
> `group-layout.ts`) and the group materials set after the load (D36, `tool-executors.ts`)
> **Trigger**: [RML-18081](https://roomle.atlassian.net/browse/RML-18081); the same defect as
> [RML-18073](https://roomle.atlassian.net/browse/RML-18073), backlog
> [`mcp-test-open-issues.md`](../backlog/mcp-test-open-issues.md) issue 23
> **Date**: 2026-10-08
> **Author**: AI Assistant
> **Status**: Open — [implemented](#implementation) on roomle-ui
> `fix/lone-wall-unit-drops-RML-18081` ([roomle-ui#3105](https://github.com/roomle-dev/roomle-ui/pull/3105))
> and [verified](#verification-1) with unit tests and live without a model; not merged

## Affected repositories

- **roomle-ui**: the fix. The arrangement writes the mirrored docking entry with the offset
  negated, as the planner records a docked pair, plus an arrangement test and a glue-logic test.
- **roomle-hi-example**: this analysis. Backlog issue 23 leaves the backlog with the fix. The MCP
  server needs no code change.

Not changed:

- **RoomleCore**: its report links the vectors that touch, and it records a docked pair with the
  offset negated (`hi-root-module-arrangement-parity-test.ts:100-121` in roomle-ui mirrors that).
- **ligna-store**: it loads the planner and gets the fix with the roomle-ui release.

## Symptom

The kitchen of RML-18081 was created with gpt-6-astra from an image, without text. In the first
attempt, the wall unit over the left leg of the L stands on the worktop. The wall units beside
the tall unit and beside the range hood hang at the right height. The worktop already has the
dark colour of the image, so the group materials had been set. The final planning is out of
scope.

## Reproduction

The chat of the ticket was not stored. Test 32 of `mcp-test-2026-10-07_11-58-22` (gpt-6-astra,
"image-only-no-text") has the same input and the same result:

- The model sends `upper3 above drawers` and `rightupper above right2`. Both are lone wall units:
  no other wall unit is docked beside them.
- Both drop onto the worktop. The result's corrections only say that each material "was set on
  every unit".
- The model notices the drop from the images. It sets `mod_HeightPosInsertion` 1480 on both units,
  then replaces the group with `onTop` and `gapMm` 660, which the server corrects back to `above`.

Without a model, with MCP tool calls against the planner (deployed planner, Default Room;
`.temp/result/issue-RML-18081/replay-hang.mjs`, data in `replay.json`):

1. `create-or-replace-groups` with `placement: { wall: back }` and the roots `base1` UTB60,
   `base2` UTB60 `rightOf base1`, `base3` UTB60 `rightOf base2`, `wall` OTB60 `above base2`, no
   group attributes.
2. `change-group-attribute` `mod_FrontColor` 190, then `mod_CountertopColor` 216, then
   `mod_CountertopProgram` Cube.

| Group | After | `wall` position | `mod_HeightPosInsertion` | Docking of the carrier | Docking of `wall` |
|---|---|---|---|---|---|
| row (`wall above base2`) | the load | [610, 1480, 0] | 1480 | its side neighbours only — no entry for `wall` | `LeftBottom -> base2.LeftTop`, no offset |
| row | `mod_FrontColor` | **[610, 820, 0]** | 820 | `LeftTop`, `RightTop`, `BackTop -> wall`, offset 0 | `LeftBottom`, `RightBottom`, `BackBottom -> base2`, offset 0 |
| row | `mod_CountertopColor`, `mod_CountertopProgram` | [610, 820, 0] | 820 | unchanged | unchanged |
| pair (`base1`, `wall above base1`) | the load and all three commands | [10, 1480, 0] | 1480 | `LeftTop -> wall.LeftBottom [0, 660, 0]` | `LeftBottom -> base1.LeftTop`, no offset |

The row drops at the first attribute command, whichever attribute it sets. `mod_CountertopColor`
(backlog issue 23) is not the trigger. In the chat, the server's own D36 commands are that first
command: they run right after every create that carries group materials.

## Investigation

1. **The server sends the hang with its offset.** `above` compiles to an entry on the carrier,
   `base2.LeftTop -> wall.LeftBottom StartStart [0, 660, 0]` (`pairOf`,
   [`group-layout.ts:555-566`](../../hi-mcp/hi-mcp-server/group-layout.ts#L555-L566); gap D35).
   This is the payload the served rules teach: the first wall unit of a leg hangs `above` a floor
   unit of that leg ([`hi-mcp-server.ts:18`](../../hi-mcp/hi-mcp-server/hi-mcp-server.ts#L18)).
2. **The load mirrors the entry without its offset.** The arrangement completes every entry with
   its reverse on the partner root: `wall.LeftBottom -> base2.LeftTop`, with the mode mirrored but
   no offset (roomle-ui `hi-root-module-arrangement.ts:887-896`). The wall unit is placed at 1480
   from the carrier's entry, so the load looks right.
3. **The planner's report replaces the carrier's docking.** After the load, the planner reports
   the group's geometry. `changedGroupPlanningSituation` → `_updateGroupGeometry` →
   `_setRootModuleContextData` (roomle-ui `glue-logic.ts:2368-2384`, `2564-2573`, `2604-2618`)
   replaces the whole `contextData` of every root the report names. The report links only vectors
   that touch (comment at `hi-root-module-arrangement.ts:136-139`). The carrier touches its
   neighbours, so its new docking holds the side links, and the entry with the 660 mm offset is
   gone. The wall unit touches nothing and keeps the offset-less mirror. The replay's "after the
   load" row shows exactly this state.
4. **The next arrangement turns the mirror into the position.** An attribute change runs
   `_modifyAttributeOfModules` → `_calculateAndUpdateGroupMap` → `_runGroupCalculation` →
   `arrangeRootModules` (`glue-logic.ts:3524-3561`, `2838-2890`, `3959-3993`).
   `_validateAndCompleteContextData` mirrors the wall unit's entry back onto `base2.LeftTop`,
   again without an offset. `_arrangeConnectedRoots` reaches `base2` before the wall unit and docks
   the wall unit flush onto the carrier's top, at y 820, inside the worktop.
   `moveUnitsAboveWithTheirCarriers` leaves it there: a unit the docking moved stays where the
   docking put it (`hi-root-module-arrangement.ts:174-229`). The library then writes
   `mod_HeightPosInsertion` 820. From then on the vectors touch, and the planner links them.
5. **Why the other units keep their height.** A lone base unit with a wall unit touches nothing,
   so the planner reports no docking for it, and the entry with the offset stays (the pair). Wall
   units beside a tall unit or beside the hood are docked by touching vectors with offset 0, so
   they have no offset to lose.

## Root cause

roomle-ui `packages/web-sdk/packages/homag-intelligence/src/hi-root-module-arrangement.ts:887-896`:
`_validateAndCompleteContextData` writes the reverse of a docking entry with the mode mirrored but
without the offset. The planner records a docked pair with the offset negated for the reverse
direction (roomle-ui `__tests__/hi-root-module-arrangement-parity-test.ts:100-121`).

While the carrier keeps the authored entry, the missing offset on the mirror does no harm. Once
the planner's report has replaced the carrier's docking, the offset-less mirror is the only link
between the wall unit and its carrier. The next arrangement then makes it the wall unit's position.
That affects every wall unit hung `above` a floor unit that has a neighbour, unless another wall
unit is docked beside it. In a kitchen, the server's own material commands (D36) are that next
arrangement, so the first result already shows the drop.

The MCP server's share: the agent's relation is the one the served rules teach, and the server
compiles it correctly. But its own commands start the arrangement that moves the unit, and its
result reports every material as set without saying that a wall unit moved. The agent learns of
the drop only from the images.

## Proposed fix

roomle-ui, `_validateAndCompleteContextData`: write the reverse entry with the offset negated, as
the planner does:

```ts
dockedContextB.dockedRoots.push({
  id: rootA.id,
  dockingVector: ownVector,
  dockingVectorIndex: ownIndex,
  ...(dockedRootA.mode ? { mode: mirrorDockMode(dockedRootA.mode) } : {}),
  ...(dockedRootA.offset
    ? { offset: dockedRootA.offset.map((component) => -component) }
    : {}),
});
```

After the planner's report, the wall unit keeps `LeftBottom -> base2.LeftTop [0, -660, 0]`. The
next arrangement mirrors it back onto `base2` as `[0, 660, 0]` and hangs the wall unit at 1480.
A reverse entry is now correct in both directions, also when the arrangement reaches the wall
unit first.

Not chosen: merging the planner's report with the entries it cannot see
(`_setRootModuleContextData`). That changes how every report is taken over (split, merge,
planning situation) and is wider than the defect. The negated offset makes the arrangement agree
with the planner's own records.

**Tests** (roomle-ui):

- `hi-root-module-arrangement-test.ts`: the mirror of an entry with `[0, 660, 0]` carries
  `[0, -660, 0]`. A row of three base units whose middle unit has lost the hang entry, with only
  the wall unit's mirror left, arranges the wall unit 660 mm above the carrier's top.
- `glue-logic-test.ts` (the test of backlog issue 23): a group with a wall unit hung `above` the
  middle of three base units keeps its height after the report of the load and after
  `mod_FrontColor` and `mod_CountertopColor`.

**Verification**: the replay above against the local roomle-ui (`--dev`). The row's wall unit
stays at [610, 1480, 0] after every command.

## Implementation plan

roomle-ui works on `fix/lone-wall-unit-drops-RML-18081`, based on `fix/hi-mcp-api-and-tools`
(`e55be7ab1`, not merged yet). Its pull request targets that branch. roomle-hi-example keeps this
document on `docs/lone-wall-unit-drops-RML-18081` (PR #83). Line numbers are those of the roomle-ui
base branch. There, the `glue-logic.ts` functions sit at other lines than on master:
`changedGroupPlanningSituation` `:2429`, `_updateGroupGeometry` `:2625`,
`_setRootModuleContextData` `:2665`.

### roomle-ui

1. **The reverse entry carries the offset** (`hi-root-module-arrangement.ts`,
   `_validateAndCompleteContextData`, `:887-896`). The connection back to `rootA` gets
   `dockedRootA.offset` negated, beside the mirrored mode. The negation avoids `-0`
   (`-component + 0`, as `roundToSteps` does), so the entry reads `[0, -660, 0]`.

   Nothing else in the operator changes. `setModulePositionFromDocking` (`:546-550`) already adds
   an entry's offset as a group-space translation, so the negated offset places the carrier from
   the wall unit exactly where the original entry places the wall unit from the carrier.
2. **Living reference** (`.agents/homag-intelligence.md`):
   - `:125`: one sentence. The arrangement completes every entry with its reverse on the partner
     root, with the mode mirrored and the offset negated, as the kernel records a docked pair.
   - `:162`: "The docking context cannot do it: … wall units then form clusters of their own that
     the arrangement leaves in place". This now holds only for wall units docked beside each other.
     A lone wall unit touches nothing, so the kernel's answer does not name it. It keeps the reverse
     entry with the negated offset, and the arrangement hangs it from its floor unit again
     (RML-18081).

Considered and rejected:

- **Merge the kernel's answer with the entries it cannot see** (`_setRootModuleContextData`). That
  changes every takeover of a kernel answer (split, merge, delete, planning situation) and is wider
  than the defect.
- **Drop the reverse entry of a link the kernel's answer removed**, so that a lone wall unit becomes
  a cluster of its own and moves with its carrier by position. That needs a new cleanup step across
  roots the answer does not name. The offset-less mirror would also stay wrong for any arrangement
  that reaches the wall unit before its carrier.
- **A workaround in the MCP server**: set `mod_HeightPosInsertion` after the materials, or send the
  materials with the load. Every later arrangement would still drop the unit: a row edit, a swap,
  or an attribute change in the planner.

### Unit tests (roomle-ui)

- `hi-root-module-arrangement-test.ts`, `describe('_validateAndCompleteContextData')` (`:291`):
  `it('writes the connection back with the mode mirrored and the offset negated')`. A's `RightTop`
  carries B's `LeftTop` with `StartEnd` and `[0, 660, 0]`. B's entry back to A reads
  `EndStart` with `[0, -660, 0]`.
- The same file, `describe('_arrangePositions')`:
  `it('hangs a unit from its carrier by the unit's own entry when the carrier lost it')`. A row of
  three cabinets with `LeftTop` vectors at 720. The middle cabinet has only side links. The wall
  unit carries `LeftBottom -> middle.LeftTop` with `[0, -660, 0]`. It is arranged at y 1380. Today
  it lands at y 720.
- `glue-logic-test.ts`, `describe('row edits')`, beside `it('moves a unit above with the unit below
  it when an attribute change resizes a module')` (`:10122`): `it('keeps a lone wall unit hanging
  after the kernel's answer to a load drops the hang entry of its carrier')`.
  1. `hangWallUnit(freeRowGroup(), 'wall-1', 1)`.
  2. `changedGroupPlanningSituation` with an answer that names `root-2` with its side links only,
     not `wall-1`.
  3. `modifyAttribute`.
  4. The loaded `wall-1` stands at `[600, 1380, 0]`. Today it stands at `[600, 720, 0]`.

  The fixture `hangWallUnit` (`:10048`) gives the wall unit's entry `offset: [0, -660, 0]`, the
  state the arrangement writes now. The four row edit tests that use it keep their results: the
  carrier still holds its own entry there.

### Verification

- `cd packages/web-sdk && npm run test -- -t "<test name>"` for the new tests, then the whole
  homag-intelligence suite (`npm run test`), the lint and the typecheck (npm scripts only).
- Live, without a model: the replay `.temp/result/issue-RML-18081/replay-hang.mjs` against the
  local roomle-ui dev server. The row's wall unit stays at y 1480 after each of the three commands.
  The pair stays as before. No chat runs.

### roomle-hi-example

No server code and no served text change. With the roomle-ui fix:

- backlog issue 23 (RML-18073) and its overview row leave `mcp-test-open-issues.md`;
- this document records the implementation and the verification.

### Commits

- roomle-ui: one commit, `fix: keep the offset in the mirrored hi docking entry` — the code, the
  three tests, the fixture and `.agents/homag-intelligence.md`.
- roomle-hi-example: this plan; after the fix, one commit with the backlog and the close-out of
  this document.

## Implementation

roomle-ui `fix/lone-wall-unit-drops-RML-18081`, commit `389ba5e1c`, pull request
[roomle-ui#3105](https://github.com/roomle-dev/roomle-ui/pull/3105) into `fix/hi-mcp-api-and-tools`:

- `mirrorDockOffset` sits beside `mirrorDockMode`. `_validateAndCompleteContextData` writes the
  reverse entry with the negated offset.
- `.agents/homag-intelligence.md` describes the reverse entry and the lone wall unit.
- The tests and the fixture are as planned, with one deviation: the arrangement test of the hang
  is in `describe('units above')`, not in `describe('_arrangePositions')`. It reuses that block's
  `unit` helper. The pull request has it as a decision thread, beside the plan thread and the
  submitter thread.

roomle-hi-example: backlog issue 23 waits for the roomle-ui branch. It is renamed: the trigger is
the first attribute change after the load, not the worktop colour.

## Verification

- **Unit tests** (homag-intelligence): all 536 pass. The three new tests fail without the fix: the
  wall unit lands at y 720 instead of 1380, and the reverse entry has no offset.
- **Checks:** `lint:types:sdk`, `lint:code:sdk` and `format:push` pass, as do the pre-commit hooks.
  `lint:code:sdk` reports one warning that already existed, in
  `planner-core/__tests__/plan-view-model.ts`.
- **Live, without a model:** the replay of the reproduction against the dev server of the branch
  (`.temp/result/issue-RML-18081/fixed/replay.json`):

  | Group | After | `wall` position | `mod_HeightPosInsertion` | Docking of `wall` |
  |---|---|---|---|---|
  | row | the load and each of the three commands | [610, 1480, 0] | 1480 | `LeftBottom -> base2.LeftTop [0, -660, 0]` |
  | pair | the load and each of the three commands | [10, 1480, 0] | 1480 | `LeftBottom -> base1.LeftTop [0, -660, 0]` |

  Only the fixed code writes the offset on the wall unit's entry, which shows that the page ran the
  branch.
- No chat runs.

## Open points

- RML-18073 has the same cause. Link or close it as a duplicate of RML-18081?
- Should the server's result name a root module that one of its own commands moved? That is not
  part of this fix: once roomle-ui keeps the offset, the commands move nothing.
