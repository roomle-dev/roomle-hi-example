# Group splitting in the UI and agent tools

Dragging a module out of the middle of a group intentionally splits the group. Deleting a
middle module in the UI also splits the remaining group. For a simple row `A — B — C`, dragging
out `B` produces separate groups for `A`, `B` and `C`; deleting `B` leaves separate groups for `A`
and `C`. The exact partition follows the remaining connections.

UI operations and AI agent tools have their own intended behavior. A difference between them
does not establish a defect. In particular, the docking preservation used for a deletion does
not define what the interactive drag must do.

## Code trace

- RoomleCore `src/configurator/external/docking/external-module-group-dock-configurator.cpp:553`,
  `tryUndockAndCreateSeparatePlanObject`, removes the dragged root from the original structure,
  partitions the remainder with `splitManipulatedGroupIntoAssemblies`, and adds the dragged root
  as a separate group. The partition helper is at line 724.
- roomle-ui `packages/web-sdk/packages/planner-core/src/services/planner-kernel-access.ts:1571`,
  `_externalObjectComponentSplitOff`, forwards the reported groups to the glue logic.
- roomle-ui `packages/web-sdk/packages/homag-intelligence/src/glue-logic.ts:1757`,
  `splitRootModuleFromGroup`, applies those groups. `_splitOffRootModulesFromGroup` at line 2139
  removes docking references across the resulting group boundaries.
- In the same file, `deleteRootModule` at line 1321 preserves parts still linked to the remaining
  group with `splitOffGroupsStillDocked`. Disconnected parts still become separate groups.

The roomle-ui tests in
`packages/web-sdk/packages/homag-intelligence/__tests__/glue-logic-test.ts` explicitly cover
`group should be split when central root module is deleted` (line 1104) and
`group should be split when central root module is split off` (line 1374). RoomleCore documents
the corresponding callbacks under **API callback examples** in
`.agents/context/homag-intelligence/hi-object/externalObjects.md`.

## Agent tool contracts

`delete-article-in-place` leaves the gap and can split the group. `delete-article-and-compact`
closes the gap. These explicit tool contracts guide the agent's choice; they do not prescribe a
change to UI dragging or deletion. See
[the command tools](../skills/hi-mcp-tools.md#the-command-tools).

A claim about additional wall units or hoods separating needs a concrete reproduction and an
expected result for that UI operation. Reading a different operation's preservation logic is
insufficient evidence of a bug in `splitRootModuleFromGroup`.
