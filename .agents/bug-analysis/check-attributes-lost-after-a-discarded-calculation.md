# `change-module-attribute` fails with "checkAttributes.get is not a function"

> **Type**: Bug Analysis
> **Domain**: roomle-ui `homag-intelligence` — `glue-logic.ts` (`_storeCalculatedGroup`, `_discardCalculation`), `common-core` `deepCopy`
> **Trigger**: "test the mcp" session `mcp-test-2026-10-02_13-47-02`, gpt-6-astra, test 09 "image only, no text"
> **Date**: 2026-10-02
> **Author**: AI Assistant
> **Status**: Open — [RML-18039](https://roomle.atlassian.net/browse/RML-18039) (roomle-ui)

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

## Cause

- The glue keeps the last calculated group as `lastCalculatedPosDataJson = deepCopy(group)`, and
  `_discardCalculation` restores `deepCopy(restorableGroup)`. Both came with RML-17848 (roomle-ui
  PR #2997).
- `deepCopy` is a JSON round trip. It turns a module's `checkAttributes` `Map` into `{}`.
- After a discard, the group's modules carry `checkAttributes: {}`. That value passes the glue's
  `if (!module.checkAttributes)` checks, and the library calls `checkAttributes.get()` and throws.
- RML-18019 saw the same class of error ("checkAttributes.has is not a function") as a side
  finding.

Not the MCP server: the server sends no `checkAttributes`. The `{}` that `place-group` reloads (the
group read through the bridge) is harmless; the replays show it.

## Fix

In roomle-ui — see RML-18039: copy groups so that a `Map` survives (`structuredClone`), or rebuild
`checkAttributes` after the copy. No change in the MCP server.
