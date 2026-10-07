# Backlog: a relation for a unit under a tabletop

> **Type**: Backlog item (MCP server; needs a live check with a library that has tabletops)
> **Domain**: hi-mcp — the relations of `create-or-replace-groups` (`group-layout.ts`, `tool-executors.ts`); read only: roomle-ui `hi-root-module-arrangement.ts`, RoomleCore docking rules
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
- Written as `contextData`, an entry names vectors only: the server strips the indices (C3,
  `stripDockingIndices`, `tool-executors.ts:84`), and roomle-ui resolves a name that matches several
  vectors of the article to the outermost of them on that side (`dockingVectorIndexByName`,
  `hi-root-module-arrangement.ts:549`) — the plate's inner `LeftBottom` cannot be named, and a name
  without a single outermost vector resolves to no index and is not arranged
  (`_completeDockingReference`, `:751`).

## To do

1. **Live check** with DeMaat (`DeMaatFabriek_CabinetLibrary`, backend
   `HI_PRE_HOMAG_TecConfig_Library_Development_DeMaat`): which inner vector a cabinet under the left
   and under the right end of the plate takes.
2. **The relation** `under: "<tabletop id>"`, `at: left | right` (the end of the plate):
   `relationsToDocking` compiles it to the tabletop's inner vector ↔ the unit's Top vector, or its
   `BackBottom` when the unit is turned. The server picks the inner vector by its position from the
   calculated article — a probe load, as for the anchor frame — and writes `ownDockingVectorIndex` /
   `dockingVectorIndex`.
3. **Keep the indices** of a compiled entry in `toArticlePick`; C3 strips every index today.
4. The served rules name `under` beside the other relations; §5.2 and the relation corrections of
   [hi-mcp-behaviour.md](../../docs/hi-mcp-behaviour.md) describe it.

## Test

- `tests/group-layout.test.ts`: a tabletop fixture with two `LeftBottom` vectors — a cabinet `under`
  it `at: left` docks to the inner vector, with its index.
- `tests/tool-executors.test.ts`: the load payload keeps the indices of a compiled `under` entry;
  every other entry loses them as today.
- Live: a cabinet under each end of the DeMaat tabletop stands under the plate.

**Reproduce.** Not reproduced: Furniture_Smith has no multi-vector article; follows from the code
above.
