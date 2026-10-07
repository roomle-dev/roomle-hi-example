# Bug Analysis: a unit attribute after a group attribute misses the unit's fronts

> **Type**: Bug Analysis
> **Domain**: roomle-ui `homag-intelligence` — `glue-logic.ts` (`changeModuleAttribute`, `updateAttribute`, `changeGroupAttribute`); the `change-module-attribute` tool and its served text
> **Trigger**: [RML-18074](https://roomle.atlassian.net/browse/RML-18074); backlog [`mcp-test-open-issues.md`](../backlog/mcp-test-open-issues.md) issue 40; related: [RML-18004](https://roomle.atlassian.net/browse/RML-18004) (D20), [RML-18041](https://roomle.atlassian.net/browse/RML-18041) (D36), issue 52 of the same backlog
> **Date**: 2026-10-07
> **Author**: AI Assistant
> **Status**: Open

## Affected repositories

- **roomle-ui**: the fix. `changeModuleAttribute` without a sub module sets the attribute on
  the root module and on each of its sub modules that carry it, in one calculation, and returns
  the changed module ids. The fix comes with a unit test in `glue-logic-test.ts` and the command's
  JSDoc in `external-object-api.ts`.
- **roomle-hi-example**: this analysis. The fix also changes the `change-module-attribute`
  description (`hi-mcp-server.ts`), a new decision row and the tool rows in
  `docs/hi-mcp-behaviour.md`, the tool reference in `docs/hi-mcp-server.md` and
  `.agents/skills/hi-mcp-tools.md`, and backlog issue 40, which is removed once the fix has
  landed.

Not changed:

- **RoomleCore**: when a root module is selected, its attribute change already reaches the root
  and its sub modules. That is the reference behaviour (see [Cause](#cause), step 4).
- **ligna-store**: it gets the fix with the roomle-ui deployment.

## Symptom

1. A group gets a material for the whole group, for example `mod_FrontColor` 190, from
   `change-group-attribute` or from a group attribute of `create-or-replace-groups` (D36).
2. `change-module-attribute mod_FrontColor` is then sent for one root module, without `moduleId`.

The command reports success, and the plan context shows the new value on the root module. The
root module's fronts (doors, drawers, flaps, appliance fronts) keep the group's colour.

## Reproduction

### MCP test run

The run is `mcp-test-2026-10-07_11-58-22`, gpt-6-astra test 29 ("create a planning as to the one
shown in the picture on the right-hand wall").

- `planner-calls.json` #20: the server's `change-group-attribute mod_FrontColor 190` on group
  `58a549fe` after the load (D36).
- The model then sent `change-module-attribute mod_FrontColor`:
  - #41: 326 on `01c8d895`
  - #46: 240 on `13583f98`
  - #51: 240 on `01c8d895`
- `order-data.json`, both O2TB90 wall units: the root module carries `mod_FrontColor` 240 and its
  `mf_Door` carries 190 (`isInput: true`). Both renders show the doors in the group's cream colour.
  `plan-context.json` reports 240.

### Live

The live check ran on 2026-10-07 with headless Chromium and the example page on the deployed
bo-test planner. The tools were called directly, without a model. The script and its output are
in `.temp/result/issue-RML-18074/` (`repro-18074.mjs`, `repro.json`). The step numbers below
continue the numbering of the [Symptom](#symptom).

| Step | Root module | Its `mf_Door` |
|---|---|---|
| 3. Two HTB60 in one group with group attribute `mod_FrontColor` 190 | 190* | 190* |
| 4. `change-module-attribute mod_FrontColor` 240 on the first root module | **240\*** | **190\*** |
| 5. Counter-check: two HTB60 without a group colour | 240 (default) | 240 |
| 6. `change-module-attribute mod_FrontColor` 326 on the first of them | 326* | 326 |

`*` marks the module's own input value (`isInput: true`).

After step 4, `get-plan-context` shows `mod_FrontColor` 240 on the root module. Its sub modules
appear by id and image only, so neither the agent nor the user can tell from the plan context that
the door stayed.

## Cause

1. **The library hands a root module's value down to a sub module that has no own value.** A sub
   module whose attribute is not an input (`isInput`) takes the value from its root module. A sub
   module with its own input value keeps that value. Steps 5 and 6 above show it, and so does run
   `mcp-test-2026-10-06_08-31-06` gpt-6-astra 08: there a replace left the doors without an own
   value, and the four OTB45 doors followed their root modules' 326.
2. **`change-group-attribute` gives every sub module its own value (D20).** `changeGroupAttribute`
   (`glue-logic.ts:1313`) collects every module of the group whose master-data module assigns the
   attribute (`_collectModulesWithAttribute`, `glue-logic.ts:3242`; `hasAttribute`,
   `glue-logic.ts:642`). `_setAttribute` (`glue-logic.ts:3474`) then writes the value on each of
   them with `isInput: true`, the fronts included. Since D36 (2026-10-04), every
   `create-or-replace-groups` with a group material runs it after the load
   (`applyKitchenWideAttributes`, `tool-executors.ts:1674`). In test 29 the fronts hold their own
   `mod_FrontColor`, `mod_FrontProgram`, `mod_HandleDesign`, `mod_HandleColor` and
   `mod_PlinthAreaHeight`.
3. **`change-module-attribute` without `moduleId` sets the root module alone.** The call chain is:
   - `changeModuleAttribute` (`glue-logic.ts:1281`)
   - `updateAttribute(rootModuleId, null, …)` (`glue-logic.ts:2919`)
   - `_modifyAttributeOfModules` (`glue-logic.ts:3434`), with the root module's id only.

   The fronts keep the value from step 2. Every unit-level change of a group material after a
   create with that material therefore misses the fronts. Before D20 and D36, the fronts had no
   value of their own and followed the root module.
4. **The planner does it differently.** Take a user who selects a root module in the planner and
   changes an attribute:
   - RoomleCore `ModuleGroupConfigurator::getTargetModules`
     (`external-module-group-configurator.cpp:685`) takes
     `findComponentsWithAttribute(attributeKey, selectedRootModule)` (`external-module-group.cpp:80`).
     That is the root module and each of its sub modules that has the attribute.
   - roomle-ui `_externalObjectParameterChanged` (`planner-kernel-access.ts:1444`) passes all of
     them to `modifyAttribute`, in one calculation.

   With the whole group selected, it covers every module that has the attribute, which is D20's
   scope. `change-module-attribute` is the only root-level path that sets the root module alone.
   `updateExternalObjectGroupAttribute` (`roomle-planner.ts:2760`) also calls `updateAttribute`,
   but that API names one module explicitly.
5. **Nothing tells the agent.** The command answers with the changed group. In the plan context,
   `shapeRoot` (`hi-plan-context.ts:665`) shows the root module's input attributes, and its sub
   modules only by id and image. The agent reads 240, reports success, and has no reason to look
   further.

The agent's input was right: it changed the front colour of one unit with the tool made for one
unit. The served description says "Sets one attribute of a root module … or of one of its sub
modules", but it does not say that a unit's attribute does not reach the unit's fronts. Even a
better description would only teach the agent a workaround: one call per front, with ids it would
have to find first. The defect is the command's scope, and so is the fix.

## Fix

**roomle-ui.** `changeModuleAttribute` (`glue-logic.ts:1281`), without `moduleId`:

- collects the root module and its sub modules whose master-data module assigns the attribute,
  with `_collectModulesWithAttribute(rootModule, …)`, the same helper `changeGroupAttribute` uses;
- sets them with one `modifyAttribute(group.id, moduleIdObjects, …)`: one calculation, one load,
  one undo step;
- returns `changedModuleIds` like `changeGroupAttribute`.

This is the root-level counterpart of D20, and it is what the planner already does when a root
module is selected. With `moduleId`, the command keeps setting that one sub module.
`updateAttribute` stays as it is.

**roomle-hi-example.**

- The `change-module-attribute` description says that the attribute of a root module also reaches
  its sub modules that carry it (the fronts with the front colour). With `moduleId` it changes
  that one sub module only.
- A new decision row next to D20 in `docs/hi-mcp-behaviour.md` §3, and the tool rows (§5) updated.
- The server passes `changedModuleIds` through as it does for `change-group-attribute`. No server
  code changes.

**Test.** A glue-logic test, next to the `changeModuleAttribute` tests in
`__tests__/glue-logic-test.ts`:

- `changeGroupAttribute('group-1', 'color', 'white')` on a root module with a sub module that
  carries `color`;
- then `changeModuleAttribute('root-1', null, 'color', 'blue')`;
- the root module and its sub module carry `blue`, the other root module keeps `white`;
- `loadPosGroups` is called once, and the result names the changed modules.

The live check of `.temp/result/issue-RML-18074/repro-18074.mjs` against the fixed planner then
shows step 4 with the door at 240.

## Open points

These are for Gernot to decide (D51: say what happens).

1. **A root module without the attribute whose sub modules carry it.** Today the command rejects
   it (P2, "Module '…' has no attribute '…'"). The planner's root selection sets the sub modules
   anyway. Should the command do the same?
2. **A sub module that has a value of its own.** Example: a door set with `moduleId`, as in run
   `mcp-test-2026-10-07_09-46-08` gpt-6-astra 08, where the root module is 326 and its `mf_Door`
   240. A later unit-level change overwrites the door, as the planner's root selection does.
   Should it keep its value instead?
3. **Size attributes on sub modules.** The master data assigns `mod_Height` and `mod_Depth` to
   `mf_Dishwasher` and `mf_BaseunitFridge` too. A root-level size change then reaches those sub
   modules as well, as it already does in the planner and with `change-group-attribute`. This is
   to be checked live before the merge.
4. **Issue 52** (a group material overwrites a unit's own value) builds on this fix. Its to do
   sets each root module's own value again "with its sub modules". It stays a ticket of its own.
