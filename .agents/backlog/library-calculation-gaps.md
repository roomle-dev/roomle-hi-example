# Backlog: the gaps of the library calculation guarantee

> **Type**: Backlog — the work that closes the gaps named in
> [Why the agent cannot plan what the library cannot build](../wiki/why-the-agent-cannot-plan-what-the-library-cannot-build.md#where-the-guarantee-ends)
> **Domain**: roomle-ui `homag-intelligence` — the HI tool set (`hi-mcp/`) and the plan context
> (`hi-plan-context.ts`), never the glue logic
> ([Hard Rule](../../AGENTS.md#hard-rule-the-planning-assistant-stays-out-of-the-glue-logic)); the
> HOMAG libraries; roomle-hi-example: the documentation

The agent only chooses, and the library calculates. Every gap below is a path on which a planning
reaches the plan, the price or the order without a complete calculation of the library, or without
a note that says so. A tool call of the agent that the library cannot calculate changes nothing —
the tools discard it before the load (D106); a root module without a complete calculation comes
from an edit in the planner, from a loaded plan (D95) or from a follow-up calculation after a load. None of the items refuses the agent's input
([Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort)): they make the library's
verdict visible wherever the planning is read, and have the library calculate every value it
offers. Where an
item needs behaviour that is not decided, its first to-do is the decision (D51).

The roomle-ui paths are relative to `packages/web-sdk/packages/homag-intelligence/src/`. The
D-numbers are the decisions in §3 of
[roomle-ui `hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#3-decisions).

## Overview

| # | Gap | Responsible | Priority |
|---|---|---|---|
| 1 | [Price and order include root modules the library could not calculate, without a note](#1-price-and-order-include-root-modules-the-library-could-not-calculate-without-a-note) | roomle-ui HI tool set (`get-price`, `get-order-data`); the library's `getOrderData` | high |
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

**Cause.** The handling of a failed calculation discards a tool call of the agent before the load
(D106) and reports nothing for an edit in the planner; the order path reads no diagnostic.

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
   `newLibraryFailures` reads them (`calculationErrorOf`, `hi-plan-context.ts:338`), or as the
   plan context marks them (`calculationError`, D108).
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
