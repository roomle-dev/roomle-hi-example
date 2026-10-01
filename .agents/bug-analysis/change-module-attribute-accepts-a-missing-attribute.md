# change-module-attribute reports success for an attribute the module does not have

> **Type**: Bug Analysis
> **Domain**: roomle-ui `homag-intelligence` — the group command `change-module-attribute` (`src/glue-logic.ts`, `changeModuleAttribute`), forwarded by the MCP tool of the same name (`hi-mcp/hi-mcp-poc-json/tool-executors.ts:879-889`)
> **Trigger**: "test the mcp" run `.temp/result/mcp-test-2026-10-01_10-23-00/report.md` (gpt-5-mini, planner `bo-test`), run 06
> **Date**: 2026-10-01
> **Author**: AI Assistant
> **Status**: Fixed — roomle-ui `473191323` on `fix/hi-attribute-commands-RML-18004`, not merged, not deployed
> **Branch**: roomle-ui `fix/hi-attribute-commands-RML-18004` (stacked on `feat/hi-mcp-command-api-RML-18004`, PR #3065)

---

## Symptom

Run 06, for "the worktop should be made of dark marble" (`planner-calls.json`):

| Call | Planner result |
|---|---|
| `change-group-attribute` `{ attributeId: 'mod_PaneltopColor', value: '324' }` | `ok: false` — "No module of group '2da754d3-…' has the attribute 'mod_PaneltopColor'." |
| `change-module-attribute` `{ rootModuleId: <countertop root 1031fe51>, attributeId: 'mod_PaneltopColor', value: '324' }` | `ok: true` |

The countertop root (`mr_Countertop`) has no `mod_PaneltopColor`: the second call changed nothing,
yet it reported success, and the model took the worktop as done. The gpt-6-astra suite of 09:44
shows the same with `mod_Color` on the countertop root ("accepted, no effect").

## Investigation

**The two commands** (`glue-logic.ts` on `feat/hi-mcp-command-api-RML-18004`):

- `changeGroupAttribute` (`:1004-1040`) collects the modules of the group whose master-data module
  has the attribute assigned (`_collectModulesWithAttribute`, `:2559-2582`:
  `masterData.modules.find((m) => m.id === module.name)?.assignedAttributes.includes(attributeId)`)
  and throws "No module of group … has the attribute …" when there is none.
- `changeModuleAttribute` (`:978-1002`) resolves the root module and the optional sub module, then
  calls `updateAttribute(rootModuleId, subModuleId, attributeId, value)` — without asking whether
  that module has the attribute. `updateAttribute` writes the value into the posData and
  recalculates; the library ignores an attribute its module does not define.

**Live check on bo-test** (headless page, MCP calls, two `UTB60` on the back wall):

| Call | Module | `mod_PaneltopColor` assigned? | Result |
|---|---|---|---|
| `change-module-attribute` on a `UTB60` root | `mr_StorageunitSingle` | no | `ok` |
| `change-module-attribute` on the countertop root | `mr_Countertop` | no | `ok` |

The MCP executor (`tool-executors.ts:879-889`) forwards the command unchanged; it cannot check
the attribute itself — it sees only the compacted master data (root modules, customer-facing
attributes), not the sub modules or the other attributes.

## Root cause

roomle-ui `packages/web-sdk/packages/homag-intelligence/src/glue-logic.ts:978-1002` —
`changeModuleAttribute` sets the attribute without checking it against the module's master data,
while `changeGroupAttribute` does. A wrong attribute id is reported as a successful change.

## Fix

roomle-ui `473191323` "fix: reject an attribute the module does not have in
change-module-attribute": `changeModuleAttribute` checks the target module — the root or the
named sub module — against the master data of its group's library with `hasAttribute`, the check
`_collectModulesWithAttribute` of `changeGroupAttribute` now shares, and throws "Module '…' has no
attribute '…'." before anything is changed or loaded. The command table of
`packages/embedding-lib/docs/homag-intelligence-embedding.md` says so. New unit test: an
attribute the master data does not assign is rejected for a root and for a sub module, nothing is
loaded and the value is not set; the existing tests (valid attributes) pass unchanged.

The MCP server needs no change: the planner's error reaches the agent as the tool's error, as for
`change-group-attribute`. Takes effect with the next deployment of the planner (bo-test).

## Validation

- roomle-ui: the 465 tests of `homag-intelligence` pass, `lint:types:sdk` and `lint:code:sdk`
  clean.
- Live check against a dev server of the branch (see
  [worktop-colour-not-discoverable.md](worktop-colour-not-discoverable.md#validation)):
  `change-module-attribute mod_PaneltopColor 324` is rejected on a `UTB60` root and on the
  countertop root ("iframe: Module '…' has no attribute 'mod_PaneltopColor'."); `mod_Width 900` on
  the `UTB60` is still applied (footprint 1510 mm).
