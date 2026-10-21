# Backlog: attribute values checked against the library's verified options before an edit

> **Type**: Backlog item (HI tool commands; an MCP issue by D99)
> **Domain**: roomle-ui `homag-intelligence` — the attribute edits of the HI tools: `change-module-attribute`, `change-group-attribute`, and the group attributes and root overrides of `create-or-replace-groups` (`hi-tool-commands.ts`, `hi-tools.ts`, `hi-tool-attributes.ts`, `glue-logic.ts`); read only: the planner's parameter validation (`planner-kernel-access.ts`); roomle-ui embedding-lib: the served text (`packages/web-sdk/packages/homag-intelligence/src/hi-mcp/hi-mcp-server.ts`); roomle-hi-example: the documentation
> **Status**: Open — the behaviour on a value the module does not take is to be decided

---

## Problem

The HI tools apply an attribute value the agent sends without checking it against what the library
accepts for that module. By D99 of [`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md#3-decisions),
a calculation error caused by such a value is an MCP bug. The tools only catch the error afterwards
(D73, D95, C25), when the root module is already left without geometry.

The library offers the check. `getVerifiedAttributeOptions` (roomle-ui `glue-logic.ts:2232`; for a
group `getVerifiedGroupAttributeOptions`, `:2287`) asks the library (`getAttributesDropDownValues`,
`homag-intelligence.ts:175`) which values each attribute of a module takes:

- a list of entries, each with a kind: `Normal`, `Conflicting` or `Invalid` (`CheckDropDownEntryKind`);
- or a range: `min`, `max`, `step`.

The planner's attribute panel narrows its choices with it (`_validateParameters`,
`planner-core/src/services/planner-kernel-access.ts:328`), and the planner API returns it
(`getExternalObjectAttributeOptionsOrRanges`, `roomle-planner.ts:2806`). No HI tool path calls it:

- `change-module-attribute` and `change-group-attribute` (`hi-tool-commands.ts:909`, `:1017`) run
  the planner's attribute edits (`hi-tools.ts:461`, `:519`, `:555`). `modifyAttributesOfModules`
  (`glue-logic.ts:2690`) asks the library only to resolve conflicts (`solveModuleAttributeConflict`,
  `:2702`), then sets the value and calculates.
- `create-or-replace-groups` sets attributes at two stages:
  - **In the layout:** the roots' attribute overrides and the library's group settings
    (`groupSettings` of the master data) are calculated with the load.
  - **After the load:** every other group attribute is set with one `change-attributes`
    (`applyGroupWideAttributes`, `hi-tool-attributes.ts:392`), the same planner operation as
    `change-group-attribute`. A root module's own value of one of them is kept.

  Neither stage checks the values.
- `find-attributes` and the plan context's attribute vocabulary list the values of the master data
  (`tool-executors.ts:479` of the HI tools in the planner). Those are the attribute's selections, the same for
  every article, not the values one module takes.

## What the library verifies (Furniture_Smith)

The check covers part of the attributes only. Probed in the example page against a local roomle-ui:
`instance.extended.getExternalObjectAttributeOptionsOrRanges(<module id>)` for every module of a
600 mm `OTB60`, all attributes.

- The root module (`mr_StorageunitSingle`) verifies 16 attributes: the programs, colours and designs,
  and the plinth height. Its door (`mf_Door`) verifies 12.
- The entries carry the kinds `Normal` and `Conflicting`.
- None of them is `mod_Width`, `mod_Height` or `mod_DoorDirectionSelection`.
- Every module of the plan carries an empty `checkAttributes`.

So the check would catch a colour, program or design a module does not take. It would not catch the
900 mm single door of [library issue 80](library-issues.md#80-wall-units-at-900-mm-with-a-single-door-the-library-cannot-calculate):
the library accepts that width, so the failure is a library bug.

## To do

1. **Decide with the user** what an edit does with a value the module does not take. Following
   [Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort), the candidates are:
   - An `Invalid` value, a value the entries do not list, or one outside the range: correct it where
     the intent is clear, otherwise
     leave that value out on that root module. The result names the values the module takes. The
     other values and root modules of the call go on, and the call is not refused.
   - A `Conflicting` value: apply it. The library resolves the conflict and the result names what it
     changed (D59).
   - An attribute the library does not verify: apply it as today.
2. **roomle-ui**: check the values against the verified options before they are set, at both
   stages:
   - **The planner's attribute operations** (`change-attributes`, `change-module-attribute`). They
     serve `change-module-attribute`, `change-group-attribute` and the group attributes a create sets
     after its load.
   - **The layout inputs of a create**, the root overrides and the group settings. Their roots exist
     only after the calculation, so check either on the calculated group and calculate again, or on
     the article template (`calculateArticleTemplate`).
3. **Served text** (roomle-ui planner, `hi-mcp-server.ts`): say what the result names when a
   value is not taken, so the agent picks among the values the module takes. It reaches the example
   page and the ligna-store with the planner at their server URL.
4. **Documentation** (roomle-hi-example): the decision in §3 and the feedback row in §8 of
   `docs/hi-mcp-behaviour.md`, `docs/hi-mcp-server.md` and `.agents/skills/hi-mcp-tools.md`.

## Test

roomle-ui `hi-tool-commands` tests, with the verified options mocked:

- A `change-module-attribute` with a value marked `Invalid`, or not listed, is not applied, and the
  result names the values the module takes.
- A `Conflicting` value is applied, with the library's changes.
- An attribute without verified options is applied as today.
- A create with an invalid group attribute value builds the group without that value on the root
  modules that do not take it (the stage after the load).
- A create with an invalid root override builds the root module without it (the layout stage).

## Reproduce

In the example page with a local roomle-ui (`--dev`):

1. Create a group with one `OTB60` and read `getExternalObjectAttributeOptionsOrRanges` for its root
   module and its door.
2. Set an attribute the library verifies to a value its entries do not list as `Normal` or
   `Conflicting`, with `change-module-attribute`. The tool applies it without a check.
