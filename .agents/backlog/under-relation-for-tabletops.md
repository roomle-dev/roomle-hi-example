# Backlog: a relation for a unit under a tabletop

> **Type**: Backlog item (HI tool commands; needs a live check with a library that has tabletops)
> **Domain**: roomle-ui `homag-intelligence` — the relations of `create-or-replace-groups` (`hi-group-layout.ts`, `hi-tool-payload.ts`); read only: `hi-root-module-arrangement.ts`, RoomleCore docking rules; roomle-hi-example: the served rules
> **Status**: Open
> **Ticket**: [RML-18038](https://roomle.atlassian.net/browse/RML-18038); RoomleCore [RML-16056](https://roomle.atlassian.net/browse/RML-16056)

---

## Problem

A tabletop that bridges floor cabinets (DeMaat `DMF_TableTopDesk_011`: 2000 × 620 × 750 mm, one
leg) carries a second `LeftBottom`/`LeftTop` and `RightBottom`/`RightTop` pair on the inner faces of
its ends. A cabinet under the plate docks with its Top vectors to the plate's Bottom vectors; turned
by 90°, it docks with its `BackBottom` to an inner `LeftBottom` — the wrap-around pair the kernel
allows for an article with several vectors of one name (RoomleCore `docking-vector.h:604`
`isWrapAroundPair`; `test/planner/configurable/plan-external-configuration-dock-test.cpp`,
`createTableTop`).

The agent cannot write this:

- The relations (D34) have no relation for a unit under another.
- Written as `contextData`, an entry names vectors only: the tool command strips the indices (C3,
  `stripDockingIndices`, roomle-ui `hi-tool-payload.ts:20`), and the arrangement resolves a name that
  matches several vectors of the article to the outermost of them on that side
  (`dockingVectorIndexByName`, `hi-root-module-arrangement.ts:604`) — the plate's inner `LeftBottom` cannot be named, and a name
  without a single outermost vector resolves to no index and is not arranged
  (`_completeDockingReference`, `:806`).

## To do

1. **Live check** with DeMaat (`DeMaatFabriek_CabinetLibrary`, backend
   `HI_PRE_HOMAG_TecConfig_Library_Development_DeMaat`): which inner vector a cabinet under the left
   and under the right end of the plate takes.
2. **The relation** `under: "<tabletop id>"`, `at: left | right` (the end of the plate):
   `relationsToDocking` (`hi-group-layout.ts:174`) compiles it to the tabletop's inner vector ↔ the
   unit's Top vector, or its `BackBottom` when the unit is turned. The tool command picks the inner
   vector by its position from the article's calculated template (`calculateArticleTemplate`, as for
   the anchor frame) and writes `ownDockingVectorIndex` / `dockingVectorIndex`.
3. **Keep the indices** of a compiled entry in `toArticlePick` (`hi-tool-payload.ts:9`); C3 strips every index.
4. The served rules name `under` beside the other relations; §5.2 and the relation corrections of
   [hi-tools-behaviour.md](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md) describe it.

## Test

- roomle-ui `__tests__/hi-group-layout-test.ts`: a tabletop fixture with two `LeftBottom` vectors — a cabinet `under`
  it `at: left` docks to the inner vector, with its index.
- roomle-ui `__tests__/hi-tool-commands/create-or-replace-groups-input-test.ts`: the load payload keeps the indices of a compiled `under` entry;
  every other entry loses them.
- Live: a cabinet under each end of the DeMaat tabletop stands under the plate.

**Reproduce.** Not reproduced: Furniture_Smith has no multi-vector article; follows from the code
above.
