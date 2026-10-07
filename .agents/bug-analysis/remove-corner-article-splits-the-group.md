# Bug Analysis: removing a corner article splits the group

> **Type**: Bug Analysis
> **Domain**: roomle-ui `homag-intelligence` — `glue-logic.ts` (`removeArticleFromGroup`), `hi-root-module-arrangement.ts` (`moveUnitsAboveWithTheirCarriers`); the `remove-article-from-group` tool and its served text
> **Trigger**: [RML-18065](https://roomle.atlassian.net/browse/RML-18065); related: [RML-18045](https://roomle.atlassian.net/browse/RML-18045) (the row edit tools, D40)
> **Date**: 2026-10-07
> **Author**: AI Assistant
> **Status**: Open — implemented on `fix/remove-corner-article-keeps-group-RML-18065` in roomle-ui and roomle-hi-example, [verified](#verification), not yet merged

## Affected repositories

- **roomle-ui** — the fix: `removeArticleFromGroup` removes a corner article like every other root
  module and names the leg that turned; `moveUnitsAboveWithTheirCarriers` turns the units above a
  turned leg with it; one unit test in `glue-logic-test.ts`; the remove paragraph of
  `.agents/homag-intelligence.md`.
- **roomle-hi-example** — this analysis; decisions D51 and D52; the description of
  `remove-article-from-group` (`hi-mcp-server.ts`); D40 and the tool tables in the docs; a remove
  test in `docs/test-prompts.json`.

Not changed: **RoomleCore** and roomle-ui's `deleteRootModule` — a deletion splits the group into
its docked clusters by definition (D40), and `delete-root-module` keeps doing so, corner article or
not. **ligna-store** — no code change; it gets the fix with the roomle-ui deployment.

## Symptom

`remove-article-from-group` of a corner article between two legs splits the group: each leg, and
each cluster of wall units that does not touch a floor unit, becomes a group of its own.

"Remove" deletes the root module and closes the gap — at a corner article as well, where one leg
has to be turned. "Delete" deletes the root module, and the group falls apart, for every article
(Gernot, 2026-10-07).

## Reproduction

Live on 2026-10-07: headless Chromium, the example page on the deployed bo-test planner, the MCP
tool called directly. Plan Corner Kitchen with Wall Units (`ps_r081k1nfl8nmtzget0sug199vhudbtd`),
one group: the corner unit `814c6854` UERTB90, leg A with the drawer unit, the hob unit, the sink
unit and the tall fridge unit, and leg B with a base unit, a drawer unit and the dishwasher. Wall
units and a range hood hang above both legs.

`remove-article-from-group` of the corner unit `814c6854-af4a-4370-807b-b1c0526dc1a0` gives four
groups: leg A, leg B, wall unit `4c722e3d` with range hood `a834858d`, and wall units `ba294c27` +
`1450cfe7`.

## Cause

1. `removeArticleFromGroup` (roomle-ui `glue-logic.ts`) closes the gap in one reload for a unit in
   a row, and removes a unit at the end of a row in one reload too. For a corner article with a
   neighbour on both sides it gave up: `if (left && right && isCornerRoot(root))` returned
   `_deleteInsteadOfRemove`, which calls `deleteRootModuleById`, the kernel deletion.
2. The kernel deletion splits the rest of the group into its docked clusters (RoomleCore
   `tryDeleteChild`, `external-module-group-dock-configurator.cpp:151`) — correct for a delete
   (D40), wrong for a remove. Every cluster of wall units becomes a group of its own, because a wall
   unit hangs with a gap and its docking vectors do not touch the floor unit's.
3. The fallback came with D40 (2026-10-05) on the assumption that the two legs "cannot be docked to
   each other". That assumption was wrong, and it was never tested: the legs can be docked once one
   of them turns by 90°.

## Fix

**Decisions (Gernot, 2026-10-07)**, in `docs/hi-mcp-behaviour.md` §3:

- **D51 — the tools do not restrict the agent, and they always say what happens.** The goal is not
  to restrict the agent but to be as flexible as possible. What happens has to be clearly specified
  at all times, in the tool description and in the result.
- **D52 — removing a corner article closes the gap.** One leg turns by 90° and is docked to the
  other.

**roomle-ui.**

- `removeArticleFromGroup`: the corner fallback is gone. A corner article takes the path of every
  other remove: its two neighbours are docked to each other (`addDockingEntry`), and the arrangement
  positions the second leg from that docking — `setModulePositionFromDocking` sets the rotation too,
  so the leg turns by 90° and the legs form one straight row. `keepWallDistances` keeps the end of
  the row at a wall (D41). The correction names the turned leg: "'…' was a corner article - the leg
  of '…' with the units above it turned by 90° and is docked to '…'". The result is `gapClosed:
  true`, so the server waits for the follow-up reload as for every closed gap. Only the only unit of
  a group is still deleted by the kernel (`_deleteInsteadOfRemove`).
- `moveUnitsAboveWithTheirCarriers`: a unit whose own carrier turned turns with it — the carrier's
  movement, rotation included, is applied to the unit. Before, "a carrier that turned takes nothing
  along", and the wall units above a turned leg stayed where they hung. A unit handed to another
  carrier (the neighbour that moves into a gap) keeps the old rule.

**roomle-hi-example.** The description of `remove-article-from-group` says what happens: "Removing
a corner article between two legs closes the gap as well: one leg turns by 90 degrees, with the
units above it, and is docked to the other, so the legs form one straight row - the result names the
leg that turned." D40, D52 and the tool tables say the same. The server needs no code change.

## Tests

- roomle-ui `glue-logic-test.ts`, one test, replacing "deletes a corner article and keeps its legs
  apart": "removes a corner article by turning one leg with the units above it and docking it to the
  other". An L of a corner article, one leg along x and one leg turned by 90° with a wall unit above
  it. After the remove: one load, no `deleteRootModule`; the turned leg at rotation 0, docked to the
  other leg; the wall unit turned with it; `gapClosed: true` with the correction.
- roomle-hi-example `docs/test-prompts.json`: `edit-remove-corner-unit`, "remove the corner unit"
  on `corner-kitchen-wall-units` — one group, one leg turned with its wall units, one straight row,
  the answer names the leg that turned.

## Verification

2026-10-07, on the branches (roomle-ui `31b49fdec`):

- roomle-ui: the test fails without the fix and passes with it; the `homag-intelligence` suite
  passes (529 tests); type check and lint clean.
- roomle-hi-example: 446 tests, type check, lint and format clean.
- Live, the local roomle-ui on the branch, the example page against it, headless:
  `remove-article-from-group` of the corner unit of the Corner Kitchen with Wall Units plan gives
  one group. Leg B (base unit `46ce`, drawer unit `b9bb`, dishwasher `27d6`) turned by 90° and is
  docked to the drawer unit `7cd0` of leg A; the row is straight along the right wall, its end in
  the back corner. Leg A moved 639 mm along its wall, the walled end of the row keeping its place
  (D41). The wall units above leg B turned with it, and those of leg A moved with it.
  `gapClosed: true`; the correction names the turned leg; the row hint names the five wall units
  that moved; no console error; one continuous worktop.
