# Return height attributes after the kernel position callback

> **Date**: 2026-10-10
> **Status**: Fixed — verified locally; not landed
> **Ticket**: [RML-18103](https://roomle.atlassian.net/browse/RML-18103)
> **Backlog**: Plan-context finding #5

## Affected repositories

- **roomle-ui** — make attribute commands await the existing kernel planning-situation callback and its calculated follow-up load; regression coverage and HI documentation.
- **roomle-hi-example** — document the result contract and remove the verified backlog entry; no height workaround in the MCP server.

## Root cause

Attribute commands await their first loadPosGroups call, then runGroupOperation reads the kernel's serialized definitions. The kernel updates the placement before the library-derived input attributes reflect that placement. PlannerKernelAccess._externalObjectPlanChanged defers the planning-situation callback, and changedGroupPlanningSituation starts a second calculation/load that the attribute command does not await. The result is shaped from the first definition, which contains the earlier insertion height.

## Reproduction and evidence

A direct command on a newly created wall unit returned mod_HeightPosInsertion 0; the subsequent raw group and plan context reported 1700. Browser instrumentation confirmed the planning-situation callback and the second calculation ran after the command result. Evidence: /tmp/plan-context-live/height-trace*.json.

The current Furniture_Smith library derives this attribute from placement during prepareContext. Setting 1420 alone in this live fixture retains the default placement of 1700. Accurate feedback must report the value the planner actually keeps, including library adjustments, rather than manufacture the requested value. The regression reproduces the documented case by having the kernel apply 1420 while the first serialized definition still contains 0.

## Implementation

Reuse the existing _requestKernelOperation correlation for the three public attribute commands. The planning-situation callback claims the pending operation, recalculates using the kernel's actual positions, awaits its follow-up load, then resolves it. Keep lower-level attribute setters unchanged. No new timer, polling loop, mutex or event counter is needed.

## Verification

The regression failed before the fix and passes afterward. It enters through executeGroupOperation for all three attribute command forms and checks that each stays pending before the callback and while its follow-up load is pending. The final group position and input height are both 1420. A separate regression verifies a failed callback reload rejects the command and permits the next command. Existing command mocks provide the planning-situation callback the real kernel sends for CHANGE_ATTRIBUTE.

All 369 tests in glue-logic-test.ts and hi-plan-context-test.ts pass; SDK typechecking passes. Direct local planner and MCP calls return height 1700 immediately, matching the kernel and subsequent raw/context reads. MCP feedback correctly reports the library adjustment from the requested 1420 to actual 1700 in this fixture. Finding #5 was removed from the backlog after verification.
