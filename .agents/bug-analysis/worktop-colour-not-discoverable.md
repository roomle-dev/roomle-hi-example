# The worktop colour is not discoverable

> **Type**: Bug Analysis
> **Domain**: roomle-ui `homag-intelligence` — the compacted master data of the agent-ready plan context (`src/hi-plan-context.ts`, `compactMasterData`); the MCP tools that read it (`find-attributes`, `get-plan-context` with `masterData`)
> **Trigger**: "test the mcp" run `.temp/result/mcp-test-2026-10-01_10-23-00/report.md` (gpt-5-mini, planner `bo-test`), run 06 — the third suite in a row (Mistral 09:10, gpt-6-astra 09:44) where "the worktop should be made of dark marble" ends with a white marble worktop
> **Date**: 2026-10-01
> **Author**: AI Assistant
> **Status**: Open
> **Branch**: roomle-ui `fix/hi-attribute-commands-RML-18004` (stacked on `feat/hi-mcp-command-api-RML-18004`, PR #3065)

---

## Symptom

| Suite | What the model did for "the worktop should be made of dark marble" | Result |
|---|---|---|
| Mistral Large 09:10 | searched, set the panel attribute `mod_Color` on the countertop root | accepted, white marble |
| gpt-6-astra 09:44 | six `find-attributes`, then `change-module-attribute mod_Color 324` on the countertop root | accepted, white marble |
| gpt-5-mini 10:23 | `change-group-attribute mod_PaneltopColor 324` (rejected), `change-module-attribute mod_PaneltopColor 324` on the countertop root (accepted), `find-attributes` | white marble, no answer |

Every model found the value — `324` "Dark marble" is in the colour lists of fronts and panels —
but none found the worktop's attribute.

## Investigation

**The library.** The worktop colour is `mod_CountertopColor` ("Countertop color", `isMain: true`,
`userRight: Simple`), assigned to one module only: `mr_Countertop`
(`docs/library-information/master-data.json`). The library generates the worktop as a root of
the group (`isGenerated: true`, articleId `mr_Countertop`), but its module is typed
`moduleType: SubModule`, `group: Root` — like every generated root:

| Module (`SubModule`, group `Root`) | Customer-facing attributes |
|---|---|
| `mr_Countertop` | `mod_CountertopColor`, `mod_CountertopProgram` |
| `mr_Paneltop` | `mod_PaneltopColor`, `mod_PaneltopConstruction`, `mod_PaneltopProgram` |
| `mr_Toekick` | `mod_ToekickColor`, `mod_ToekickConnectionSequence` |
| `mr_Fingergrip` | `mod_FingergripColor` |
| `mr_Backsplash` | `mod_BacksplashColor`, `mod_BacksplashHeight` |
| `mr_PlinthAreaBaseboard` | `mod_PlinthAreaHeight`, `mod_CarcaseColor`, `mod_ToekickColor`, `mod_ToekickConnectionSequence` |
| `mr_CeilingFiller` | `mod_CeilingFillerTransitionType`, `mod_CeilingFillerColor`, `mod_CeilingFillerProgram`, `mod_CeilingFillerConstruction` |

**The compaction.** `compactMasterData` (`hi-plan-context.ts:225-250` on
`feat/hi-mcp-command-api-RML-18004`, the same on master) keeps the modules for which
`isRootModule` is true (`hi-plan-context.ts:204-205`: `isRoot === true` or `moduleType ===
'RootModule'`) and the customer-facing attributes **assigned to those modules**. `mr_Countertop`
is not a `RootModule`, so `mod_CountertopColor` is dropped — and with it the colours of the toe
kick, the finger grip and the backsplash. `mod_PaneltopColor` survives only because root modules
carry it too.

**The tools.** `find-attributes` (`hi-mcp/hi-mcp-poc-json/tool-executors.ts:568-609`) searches the
compacted master data; `get-plan-context` shows the countertop root with `attributes: []`. Neither
names `mod_CountertopColor`.

**Live check on bo-test** (headless page, MCP calls, two `UTB60` on the back wall):

| Call | Result |
|---|---|
| `get-plan-context` `masterData` | 13 modules, all `RootModule`s and article builders; no `mod_CountertopColor` |
| `find-attributes` `"countertop"` | one match: `mod_CreateCountertop` |
| `change-group-attribute` `mod_CountertopColor` `324` | applied: `changedModuleIds` = the countertop root, which then lists `mod_CountertopColor 324`; the render shows a dark marble worktop |

The planner applies the attribute — `changeGroupAttribute` checks the **full** master data
(`glue-logic.ts`, `_collectModulesWithAttribute`). Only the agent's view of the master data lacks
it.

## Root cause

roomle-ui `packages/web-sdk/packages/homag-intelligence/src/hi-plan-context.ts:226` —
`compactMasterData` takes the modules of the agent's master data from `isRootModule` alone. The
generated roots (worktop, panel top, toe kick, finger grip, backsplash, plinth, ceiling filler) are
roots of every group they appear in, but their modules are `SubModule`s of the `Root` group, so
their attributes never reach the agent.

## Fix

`compactMasterData` keeps the modules that stand as roots in a group: the `RootModule`s and the
sub modules of the master data's `Root` group (the generated roots). The `GroupOrchestrator`
(also in the `Root` group) is no root of a group and stays out. A unit test compacts master data
with a `RootModule` and a generated-root `SubModule` and expects the generated root's
customer-facing attribute in `attributes` and the module in `modules`.

No MCP server change: `find-attributes` lists the new module under `rootModules`, and
`change-group-attribute` already applies such attributes. The fix takes effect with the next
deployment of the planner the page loads (bo-test); against the local planner it is checked with
the live check above (`EXAMPLE_SERVER_URL` pointing at a dev server of the branch).

## Validation

- roomle-ui unit tests of `hi-plan-context` and `glue-logic`.
- Live check against the branch's dev server: `find-attributes "countertop"` lists
  `mod_CountertopColor` with `rootModules: ["mr_Countertop"]`.
