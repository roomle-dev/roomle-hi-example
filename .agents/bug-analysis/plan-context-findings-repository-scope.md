# Plan-context findings: affected repositories

> **Date**: 2026-10-10
> **Status**: Open — brief repository-scope analysis; no implementation
> **Ticket**: [RML-18103](https://roomle.atlassian.net/browse/RML-18103)
> **Jira comment**: [Repository-scope table](https://roomle.atlassian.net/browse/RML-18103?focusedCommentId=156000)
> **Backlog**: [Open findings about the plan context](../backlog/plan-context-open-findings.md)

## Affected repositories

- **roomle-hi-example** — possible generic outline clarification (#2), calculation-error feedback and regression coverage (#3).
- **roomle-ui** — height attribute/result consistency (#5); calculation-error data only if the existing raw-group API is insufficient (#3).
- **RoomleCore** — investigate the kernel obstacle contour of HI groups (#4).
- **HOMAG library data** — article descriptions for geometry overhangs (#2); its source repository is not identified here.

## Findings

| # | Finding | Affected repositories / source | Brief analysis |
|---|---|---|---|
| 2 | A root outline reaches into its neighbour | roomle-hi-example; HOMAG library data (external source) | Correct geometry: describe the overhang in the article data and consider library-neutral MCP wording. No planner or kernel geometry change is indicated. |
| 3 | A calculation error of a new group reaches the agent through nothing | roomle-hi-example; roomle-ui only if failure data is missing | Inspect raw root logs first, then report failed roots in create-or-replace-groups feedback. The existing raw-group API may be sufficient; a roomle-ui change is conditional. |
| 4 | The kernel’s obstacle outline of an HI group lies off the group | RoomleCore | Investigate the contour mismatch in the kernel obstacle map. The plan context already derives HI outlines from calculated parts, so no MCP or roomle-ui workaround is indicated. |
| 5 | A changed position height is reported with its old value | roomle-ui | Compare the kernel value with the returned input attributes and correct the planner command result. The MCP server forwards that result. |

## Code evidence

- **#2:** roomle-ui `hi-plan-context.ts:450,868,905` derives root outlines from parts. The recorded `SUBA60` description does not describe the overhang; `.agents/scripts/fetch-hi-library-data.js` fetches that data from HOMAG, rather than authoring it.
- **#3:** roomle-ui `glue-logic.ts:694,3019` detects Error/Fatal logs but restores failed calculations only when previous calculated state exists. `shapeRoot` (`hi-plan-context.ts:673`) omits logs; roomle-hi-example already reads raw groups (`tool-executors.ts:972`) and reports reverted replacements (`:2986`).
- **#4:** RoomleCore `plan-model-view-helper.cpp:1538` exposes the placement validator’s obstacle map. roomle-ui `shapeObstacles` (`hi-plan-context.ts:905`) excludes kernel HI-group contours and builds them from parts.
- **#5:** roomle-ui `changeModuleAttribute` (`glue-logic.ts:1298`) changes the planner state; `runGroupOperation` (`hi-plan-context.ts:1446`) shapes calculated groups through `shapeRoot`, which reads input attributes. The point where the old height survives still needs reproduction.

## Scope and limits

No ligna-store or roomle-model-exporter change is indicated. Library-specific descriptions belong in the library data, not in the MCP rules. No new planner method or bridge change is required by this scope.

This review traces the current code; it does not reproduce the four findings live. For #3, first confirm that an invalid override creates Error/Fatal root logs. For #4 and #5, reproduce the documented plan/command before choosing the implementation. A precise root cause for either is not established.

Analysis baselines: roomle-hi-example `3bc8f6a`, roomle-ui `b09c1ca8e`, RoomleCore `726fa30d6`.
