# Backlog: a deletion makes the wall units groups of their own

> **Type**: Backlog item (roomle-ui)
> **Domain**: roomle-ui `homag-intelligence` — the kernel deletion behind `delete-root-module` and the corner case of `remove-article-from-group`; consumer: the hi-mcp command tools (D40 in [hi-mcp-behaviour.md](../../hi-mcp/docs/hi-mcp-behaviour.md#row-edits-2026-10-05))
> **Jira**: no ticket of its own yet; related: [RML-18045](https://roomle.atlassian.net/browse/RML-18045) (the row edit tools)

## Problem

`delete-root-module` of a floor unit in a group with wall units, and `remove-article-from-group` of
a corner article between two legs, leave every cluster of wall units as a group of its own, beside
the floor units it hangs above.

## Cause

- Both go through the kernel deletion: `deleteRootModuleById` (roomle-ui
  `packages/web-sdk/packages/homag-intelligence/src/glue-logic.ts:1347`), which
  `removeArticleFromGroup` calls for a corner article between two legs or the only unit
  (`_deleteInsteadOfRemove`, `:1776`).
- The kernel splits the rest of the group into assemblies by docking-vector contact
  (`tryDeleteChild`, `findRootModuleAssembliesByAnalyzingAdjacentDockingVectors`, RoomleCore
  `src/configurator/external/docking/external-module-group-dock-configurator.cpp:151`, `:788`), and
  the glue logic loads every assembly as a group where it stands (`deleteRootModule`,
  `glue-logic.ts:1978`, `_splitOffGroupsFromGroups`, `:2617`).
- After a load the kernel's docking context links only docking vectors that touch, so a wall unit
  or a range hood that hangs with a gap above its floor unit is not docked to it. Every wall-unit
  cluster is an assembly of its own. The row edits find the unit below by position instead
  (`carriersOfUnitsAbove`, `hi-root-module-arrangement.ts:141`); the deletion does not.

## To do

In the glue logic's `deleteRootModule`, before the split-off groups are loaded: put every unit above
(`carriersOfUnitsAbove` of the group before the deletion) into the group of the floor unit it hangs
above. Where a unit above the deleted floor unit goes is to be decided in the analysis — it has no
carrier left. The kernel's split by docking stays for the floor units: that is what "delete" means
(D40).

## Test

- roomle-ui `glue-logic-test.ts`: deleting the middle floor unit of a row with a wall unit above
  each floor unit gives two groups, each with its floor units and the wall units above them; deleting
  the corner article of a corner kitchen gives one group per leg with its wall units.
- `docs/test-prompts.json`: a delete test on the Corner Kitchen with Wall Units plan that expects no
  group made of wall units only.

Constraint: the regrouping happens in the same `deleteRootModule` call, before `_loadPosData`. A
second load would put a second step on the planner's undo history, and the server's undo counts one
step for a group command (D38).

**Reproduce.** Corner Kitchen with Wall Units (`ps_r081k1nfl8nmtzget0sug199vhudbtd`):
`remove-article-from-group` of the corner unit `814c6854-af4a-4370-807b-b1c0526dc1a0` gives four
groups — the two legs and their wall-unit clusters.
