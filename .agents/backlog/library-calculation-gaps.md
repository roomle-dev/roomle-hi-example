# Backlog: the gaps of the library calculation guarantee

> **Type**: Backlog — the work that closes the gaps named in
> [Why the agent cannot plan what the library cannot build](../wiki/why-the-agent-cannot-plan-what-the-library-cannot-build.md#where-the-guarantee-ends)
> **Domain**: roomle-ui `homag-intelligence` — the glue logic (`glue-logic.ts`), the HI tool
> commands (`hi-tool-commands.ts`, `hi-tool-attributes.ts`), the plan context (`hi-plan-context.ts`)
> and the HI tool set (`hi-mcp/`); the HOMAG libraries; roomle-hi-example: the documentation

The agent only chooses, and the library calculates. Every gap below is a path on which a planning
reaches the plan, the price or the order without a complete calculation of the library, or without
a note that says so. A tool call of the agent that the library cannot calculate changes nothing
(D106); a root module without a complete calculation comes from an edit in the planner or from a
loaded plan (D95). None of the items refuses the agent's input
([Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort)): they run the library's own
checks on every path and make the library's verdict visible wherever the planning is read. Where an
item needs behaviour that is not decided, its first to-do is the decision (D51).

The roomle-ui paths are relative to `packages/web-sdk/packages/homag-intelligence/src/`. The
D-numbers are the decisions in §3 of
[roomle-ui `hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#3-decisions).

## Overview

| # | Gap | Responsible | Priority |
|---|---|---|---|
| 1 | [Price and order include root modules the library could not calculate, without a note](#1-price-and-order-include-root-modules-the-library-could-not-calculate-without-a-note) | roomle-ui HI tool set (`get-price`, `get-order-data`); the library's `getOrderData` | high |
| 2 | [A root module the library could not calculate is not visible after the call that caused it](#2-a-root-module-the-library-could-not-calculate-is-not-visible-after-the-call-that-caused-it) | roomle-ui plan context (`hi-plan-context.ts`), served text — analysed in [bug-analysis/failed-root-module-not-visible-to-the-agent.md](../bug-analysis/failed-root-module-not-visible-to-the-agent.md): `shapeRoot` drops the library's verdict and the served text has no word for it; fix proposed, the group's own failure and a note after a failed repair to be confirmed | medium |
| 3 | [A create skips the library's conflict resolution and the checks of its root modules](#3-a-create-skips-the-librarys-conflict-resolution-and-the-checks-of-its-root-modules) | roomle-ui glue logic (`glue-logic.ts`), tool commands | medium |
| 4 | [Values the library accepts and cannot calculate](#4-values-the-library-accepts-and-cannot-calculate) | HOMAG library development team; roomle-hi-example: the report | medium |

Where a group stands in the room is no gap: the tools build a group on an obstacle or outside the
room and say so in `hint`, because the user may want it there (D51, D55).

## 1. Price and order include root modules the library could not calculate, without a note

**Problem.** A root module whose calculation ends with an `Error` or `Fatal` diagnostic after an
edit in the planner, or in a loaded plan, stays in the plan without docking vectors and front parts
(D95). `get-price` and `get-order-data` return the
planner's answer as it is (`hi-mcp/tool-executors.ts:629-640`): `fetchPrice` and the `orderData` of
the snapshot, both built by `getGroupDataForOrder` (`glue-logic.ts:1955`), which hands every group
of the scene to the library's `getOrderData`. Neither answer says that a root module of the order is
not built. What the library's `getOrderData` does with such a root module — prices it, leaves it
out or fails — is not known.

**Cause.** The handling of a failed calculation reverts a tool call of the agent (D106) and reports
nothing for an edit in the planner; the order path reads no diagnostic.

**To do.**

1. Probe what the library's order data carries for a root module with an `Error`: its order line,
   its price, its parts. Write the outcome into roomle-ui
   `.agents/homag-intelligence/library-errors.md`. A root module without geometry that the library
   prices is a library issue in [library-issues.md](library-issues.md).
2. Decide with the user what the price and the order say about it. The candidates:
   - `get-price` and `get-order-data` name every root module of the plan the library could not
     calculate, with the first line of its diagnostic, beside the price or the order data, so the
     agent tells the user that the price holds a unit that is not built as planned. Recommended: it
     builds on D95 and refuses nothing.
   - The planner's order flow (`onPlaceOrder` of the host) warns before an order with such a root
     module. It is outside the HI tools and a decision about the planner's order.
3. roomle-ui HI tool set: the decided note in `get-price` and `get-order-data`
   (`hi-mcp/tool-executors.ts`), the failed root modules read from `getExternalObjectGroups` as
   `newLibraryFailures` reads them (`calculationErrorOf`, `hi-tool-payload.ts:270`).
4. Served text (`hi-mcp/hi-mcp-server.ts`): the descriptions of the two tools say what the note
   means and that the answer names it to the user.
5. Documentation: the decision in §3 and the feedback in §8 of roomle-ui `hi-tools-behaviour.md`,
   `hi-tools-reference.md`, [`hi-mcp-tools.md`](../skills/hi-mcp-tools.md) and
   [the wiki page](../wiki/why-the-agent-cannot-plan-what-the-library-cannot-build.md).

**Test.** roomle-ui `__tests__/hi-mcp/tool-executors-test.ts`: on a plan whose group has a root
module with an `Error` message, `get-price` and `get-order-data` name it; on a plan without one they
answer as before.

**Reproduce.** In the example page, set `mod_Width` 900 on an `OTB60` with
`mod_DoorDirectionSelection` `Left` in the planner's attribute panel
([library issue 80](library-issues.md#80-wall-units-at-900-mm-with-a-single-door-the-library-cannot-calculate)),
then call `get-price` and `get-order-data` model-free (`instance.extended.callExternalObjectAgentTool`);
neither answer names the root module.

## 2. A root module the library could not calculate is not visible after the call that caused it

**Problem.** A root module the library could not calculate after an edit in the planner, or in a
loaded plan, stays in the plan (D95), and nothing shows it to the agent: `get-plan-context` carries
no diagnostic (D9; `shapeRoot`,
`hi-plan-context.ts:705`), and a failed root module shows only by what it lacks — its
`dockingVectors` are empty (`dockingVectorNames`, `hi-plan-context.ts:320`). An agent in a later
turn, a later conversation or on a planning opened from saved data does not know that the unit is
not built, and its answer describes the unit as planned. A later tool call that leaves the root
module failing is not reverted (D106), so the agent can also change the group around it unknowingly.

**Cause.** D9 withholds the log messages of the groups because they are large, and no smaller field
stands in for the one fact the agent needs.

**To do.**

1. roomle-ui plan context: `shapeRoot` (`hi-plan-context.ts:705`) gives a root module whose last
   calculation carries an `Error` or `Fatal` diagnostic one field with the first line of its first
   such diagnostic, worded as the library failures of D106 word it; the full `logMessages` stay
   withheld (D9). The field is
   new in the planner's public plan context (`getExternalObjectPlanContext`) as well; nothing there
   is removed or renamed.
2. Served text (`hi-mcp/hi-mcp-server.ts`, the `get-plan-context` description): such a root module
   is not built until a valid value recalculates it, and the answer says so.
3. Documentation: §5.4 and D9 of roomle-ui `hi-tools-behaviour.md`, `hi-tools-reference.md`,
   [`hi-mcp-tools.md`](../skills/hi-mcp-tools.md).

**Test.** roomle-ui `__tests__/hi-plan-context-test.ts`: a root module with an `Error` diagnostic
carries the field with its first line; a root module with `Warning` and `Info` messages only does
not.

**Reproduce.** After the edit of item 1, `get-plan-context` lists the `OTB60` with empty
`dockingVectors` and no diagnostic.

## 3. A create skips the library's conflict resolution and the checks of its root modules

**Problem.**

- The attribute values of a root in `create-or-replace-groups` go into the layout as input values
  (`_applyRootAttributeOverrides`, `glue-logic.ts:978`, from `prepareArticlePickRoots`, `:1017`)
  and are calculated with it. The library's conflict resolution runs only in the attribute edits
  (`solveModuleAttributeConflict` in `modifyAttributesOfModules`, `glue-logic.ts:2919`). A create
  therefore loads a front program with a front colour the program does not offer —
  `mod_FrontProgram` `Classic` with `mod_FrontColor` `324` (Dark marble), which comes only with
  `Modern` —, the planner renders it, and the next attribute change of that root module switches
  the program (D60). The served Fronts rule keeps the agent from it; nothing else does.
- An article dragged in gets the library's check of every root module (`solveInitialModule`:
  `_solveInitialRootModules`, `glue-logic.ts:3600`, in `newPosDataFromId`, `:707`). A new group of a
  create gets the check of the group only (`_solveInitialNewGroup`, `:3585`, in
  `createOrReplacePosGroupsFromLayout`, `:865`), and only from a library with a group orchestrator;
  a replaced group gets none.

**Cause.** The layout load builds the roots from the article templates as a catalog load does, not
as the planner's interactive edits do: it sets the values without asking the library about their
conflicts, and runs the drag-in's checks for the group only.

**To do.**

1. Decide with the user:
   - whether the root attribute values of a create go through the library's conflict resolution,
     in the order sent, so that a create gives the values the same edits give one after the other.
     The library's changes are then named in `corrections` (D59), as for the group attributes after
     the load (D65), and the Fronts rule of D60 works on what the agent reads in the result;
   - whether a new group of a create runs `solveInitialModule` per article root, as a drag-in does,
     and whether a replace runs it for the root modules it adds.
2. roomle-ui glue logic, per the decision: the conflict resolution in `_applyRootAttributeOverrides`
   (`glue-logic.ts:978`) for a layout load, also for the article template of the anchor
   (`calculateArticleTemplate`, `:1090`), so the anchor frame is read from the values the root is
   built with; `_solveInitialRootModules` after `_solveInitialNewGroup` in
   `createOrReplacePosGroupsFromLayout` (`:865`).
3. roomle-ui tool commands: name the values the library changed in the root attribute values of a
   create in `corrections` — the comparison of `findLibraryChanges` (`hi-tool-attributes.ts`)
   against the values the call sent.
4. Documentation: "Initial Checks of the Library" in roomle-ui `.agents/homag-intelligence.md`;
   D59, D60 and D65 of `hi-tools-behaviour.md`; `library-errors.md`.

**Test.** roomle-ui `__tests__/glue-logic-test.ts`, with a library whose
`solveModuleAttributeConflict` switches the program for a colour: a layout load with both values
loads the switched program, and the create's result names the change. `solveInitialModule` runs for
every article root of a new group of a layout load and for none of its generated roots.

**Reproduce.** In the example page, model-free: create an `OTB60` with `mod_FrontProgram` `Classic`
and `mod_FrontColor` `324`; the group loads with both values, and a `change-module-attribute` of
`mod_FrontColor` `324` on the root module switches `mod_FrontProgram`.

## 4. Values the library accepts and cannot calculate

**Problem.** A value the library offers must calculate (D99). The calculation errors of
[library-issues.md](library-issues.md) — wall units at 900 mm with a single door, base units at
150 mm with a 150 mm plinth, a drawer sideboard lowered to 720 mm, a handle strip, backsplashes —
leave root modules without geometry for values the library accepts. Several of them are not
reported to the library development team. The check of the values before an edit (D107) does not
catch them: the library does not rule these values out, and it verifies no range for `mod_Width` and
`mod_Height`.

**Cause.** The library's calculation or its tables lack the combinations its attributes offer.

**To do.**

1. roomle-hi-example: report every calculation error of [library-issues.md](library-issues.md)
   whose **Status** says "not reported" to the HOMAG library development team, and set its status.
2. The library: calculate every value it offers, or rule out in its verified options
   (`getAttributesDropDownValues`) every value it cannot calculate — with a range for `mod_Width`
   and `mod_Height` —, so that the check before an edit catches it.

**Test.** The tests of the issues in [library-issues.md](library-issues.md).

**Reproduce.** Per issue, in [library-issues.md](library-issues.md).
