# Report calculation errors of newly loaded groups

> **Date**: 2026-10-10
> **Status**: Fixed — verified locally; not landed
> **Ticket**: [RML-18103](https://roomle.atlassian.net/browse/RML-18103)
> **Backlog**: Plan-context finding #3

## Affected repositories

- **roomle-hi-example** — inspect the existing raw-group result after a create and report roots the library could not calculate; regression coverage and behaviour/tool documentation.

## Root cause

The planner exposes Error/Fatal root logs through getExternalObjectGroups. The compact plan context deliberately omits them (D9). create-or-replace-groups reads raw geometry for positioning and obstacle feedback, but does not inspect these calculation diagnostics. A new group has no previous calculated state to restore, so the planner loads the library result and the MCP response contains no failure feedback.

## Reproduction

Direct tools against the local planner at localhost:5173, starting from the Default Room snapshot ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv. Creating an OTB60 with mod_Width set to invalid-width, -1 or 0 produces Error logs in raw root data. The tool result has no corresponding notLoaded entry. Evidence is in /tmp/plan-context-live/invalid-*.json.

## Implementation

Read the calculated raw groups after the create and its placement/attribute steps. Match them to the final result group IDs and the original input indexes. Add a notLoaded entry with the runtime group ID, failing runtime root IDs and one error per root containing the first calculation diagnostic and the action to take. Keep all loaded groups and valid roots; warnings are not failures. Do not expose stack traces or raw logs in the plan context.

This is feedback after calculation, not a new rejection. No planner, bridge or ligna-store change is needed.

## Verification

The Error and Fatal regression cases failed before the change because the result omitted the failed-root entry and pass afterward. They also check a prior invalid input, regenerated group/root IDs, valid roots, unrelated existing errors, the surviving other group and omitted stack traces. All 600 MCP workspace tests pass, including the 301 tool-executor tests and the page-bridge integration test. Workspace typechecking passes.

Direct local tool calls confirm invalid-width, -1 and 0 overrides return a notLoaded diagnostic for the failed runtime root while retaining the loaded group. A valid wall-unit create succeeds before the height check. The compact plan context stays free of raw logs. Finding #3 was removed from the backlog after verification.
