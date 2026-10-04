# `change-module-attribute` fails with "checkAttributes.get is not a function"

> **Type**: Bug Analysis
> **Domain**: roomle-ui `homag-intelligence` — `glue-logic.ts` (`_storeCalculatedGroup`, `_addGroupToMap`, `_discardCalculation`), `common-core` `deepCopy`
> **Trigger**: "test the mcp" session `mcp-test-2026-10-02_13-47-02`, gpt-6-astra, test 09 "image only, no text"
> **Date**: 2026-10-02
> **Author**: AI Assistant
> **Status**: Open — [RML-18039](https://roomle.atlassian.net/browse/RML-18039) (roomle-ui); no branch or PR yet as of 2026-10-04

## Symptom

`change-module-attribute` with `mod_HeightPosInsertion` 1420 on a wall unit `OTB60` fails in the
page with "iframe: checkAttributes.get is not a function", a TypeError. The model recovered by
deleting and rebuilding its groups.

## Reproduction

The tool calls of the run, replayed on a fresh page (Default Room) with the ids mapped:

| Sequence | `change-module-attribute` |
|---|---|
| create → change | ok |
| create → `place-group` → change | ok |
| create → replace the group → change | TypeError |
| create → `place-group` → replace → change | TypeError |

The replace makes the library fail two root modules. The page logs "The library could not calculate
root module …, the modification of group … was discarded."

Reproduced again on 2026-10-03, headless on the deployed planner: the planner calls 11 (create), 27
(replace) and 30 (change) of the run's `planner-calls.json` on the Default Room plan. The load takes
today's arguments `'posGroups', { reason: 'adjusted' }`; the value is passed as the string `'1420'`.
The stack of the TypeError:

```text
TypeError: checkAttributes.get is not a function
  at ChecksLogic.calculateConflictingChange          (HOMAG library)
  at solveModuleAttributeConflict                    (HOMAG library)
  at GlueLogicImplementation._modifyAttributeOfModules  (glue-logic.ts)
  at GlueLogicImplementation.updateAttribute         (glue-logic.ts)
```

## Cause

- The glue keeps the last calculated group as `lastCalculatedPosDataJson = deepCopy(group)`, and
  `_discardCalculation` restores `deepCopy(restorableGroup)`. Both came with RML-17848 (roomle-ui
  PR #2997).
- `deepCopy` is a JSON round trip. It turns a module's `checkAttributes` `Map` into `{}`.
- After a discard, the group's modules carry `checkAttributes: {}`. That value passes the glue's
  `if (!module.checkAttributes)` checks, and the library calls `checkAttributes.get()` and throws.
- RML-18019 saw the same class of error ("checkAttributes.has is not a function") as a side
  finding. The attribute drop-downs pass the same module to `getAttributesDropDownValues`, which
  calls `checkAttributes.has`.
- The library's `calculateGroup` gives every module a new `checkAttributes` `Map` (`_articleId`,
  `_moduleId` and the module's attributes, all primitives) on every calculation. A group stored
  from a calculation always has it. `_discardCalculation` is the only place that stores a group
  without a calculation: the JSON copy. `_modifyAttributeOfModules` calls
  `solveModuleAttributeConflict` before it calculates, so every attribute change of the group fails
  until a calculation stores the group again.
- The replace of the reproduction runs through `_createOrReplacePosGroupsFromLayout`: the new layout
  is assigned to the existing group item and recalculated. Its roots are new to the group, so
  `newlyFailedRootModules` counts every failing one as broken by the change, and the whole replace is
  discarded: the previous group is restored from its JSON copy and loaded back with
  `applyGroupPosition`. Nothing calculates the group between the discard and the next attribute
  change, so the restored copy is what the change works on.

Not the MCP server: the server sends no `checkAttributes`. The `{}` that `place-group` reloads (the
group read through the bridge) is harmless; the replays show it.

## Fix

In roomle-ui — see RML-18039. No change in the MCP server.

`glue-logic.ts` copies the restorable group with `structuredClone` instead of `deepCopy`, so the
`Map` survives:

- `_storeCalculatedGroup`: `lastCalculatedPosDataJson = structuredClone(group)`
- `_addGroupToMap`: `lastCalculatedPosDataJson: structuredClone(posDataJson)`
- `_discardCalculation`: `restoredGroup = structuredClone(restorableGroup)`

The other `deepCopy` calls stay: their copies go through `calculateGroup` before they are stored.
Rebuilding `checkAttributes` after a JSON copy is rejected: the copy has lost the entries, and
rebuilding them would repeat library logic in the glue. Switching `common-core`'s `deepCopy` to
`structuredClone` is rejected too: it is used far beyond this bug, and `structuredClone` throws on
functions that the JSON copy drops.

`structuredClone` is new in productive web-sdk code (tests and `telemetry-ingest` use it). The lib of
`tsconfig.base.json` is ES2022 + DOM, and the browsers `.browserslistrc` resolves to are far above
its minimum versions (Chrome 98, Firefox 94, Safari 15.4); only KaiOS falls below, and it cannot run
the planner anyway.

**Unit test** — `glue-logic-test.ts`, `group operations › changeModuleAttribute`: "changes an
attribute after the library could not calculate the previous change". The library mock behaves
like the library: `calculateGroup` gives every root a `checkAttributes` `Map`, and
`solveModuleAttributeConflict` reads it with `get`. The first change fails in the library and is
discarded; the restored root still has its `Map`. The second change succeeds.

**Verified 2026-10-03** in a roomle-ui worktree of master:

- The test fails without the fix (`expected {} to be an instance of Map`; without that assertion
  `TypeError: module.checkAttributes.get is not a function`) and passes with it. The
  homag-intelligence suite (475 tests) and `lint:types:sdk` pass.
- Live, with the fixed glue on the dev server and the replay above: the replace is discarded as
  before, `change-module-attribute` succeeds, and the kernel holds `mod_HeightPosInsertion` 1420 —
  the same as the control run without the replace. `structuredClone` accepts the real groups.

**Checked again 2026-10-04** against roomle-ui master `eb65594b3` (after PR #3066): the three copy
sites, the call order and the guards are as described; the ticket description was corrected
(`_addGroupToMap` instead of `_addNewGroup`, the replace path, the wiki-markup artifacts).

Side finding, not part of this bug: the `change-module-attribute` result reports the unit's
`mod_HeightPosInsertion` as 0 while the kernel holds 1420. The control run shows the same.

Side finding, not part of this bug: the discarded replace looks like a success to the caller.
`loadExternalObjectGroupLayout` returns the id of the restored group, and only the page console names
the failed roots; `create-or-replace-groups` reports the replace as done, with the old roots in
`groups` — backlog item 34 in
[mcp-test-open-issues.md](../backlog/mcp-test-open-issues.md#34-a-replace-the-library-cannot-calculate-is-reverted-without-a-word-in-the-tool-result).
