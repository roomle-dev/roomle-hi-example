# Open issues of roomle-ui

> **Type**: Backlog — defects of the roomle-ui planner that the MCP prompt tests show
> **Domain**: roomle-ui outside the HI tool commands — the renderer and the planner core; the HI
> tool commands (`hi-tool-commands.ts` and the modules they use) are tracked in
> [mcp-issues.md](mcp-issues.md)
> **Maintained by**: the evaluation of the MCP prompt tests ([testing skill](../skills/hi-mcp-testing.md))

These defects lie in roomle-ui, not in the MCP server, the chat or the library data: they change
what the planner shows, not the plan the agent made. Each issue names the problem, its cause, the
to-do, the test of the fix and how to reproduce it. An issue leaves this document when its fix is in
the code.

## Overview

| # | Issue | Kind | Responsible | Priority |
|---|---|---|---|---|
| 1 | [A dark worktop renders white under the top light](#1-a-dark-worktop-renders-white-under-the-top-light) | defect, known | roomle-ui renderer | medium |

The run directories named under **Reproduce** are under `.temp/result/`.

## 1. A dark worktop renders white under the top light

**Problem.** A dark countertop renders white in the planner's images, depending on the line of
sight: in the object image of the handleless kitchen of the test `image-planning-right-wall` both
worktops look white, while `order-data.json` carries `mod_CountertopColor` 324 (Dark marble) or 326
(Slate). The plan is right; the image shows another colour than the countertop has.

**Cause.** A known issue of the roomle-ui renderer: the top light overexposes the tabletop,
depending on the line of sight, so black appears white.

**To do.** roomle-ui renderer: render the tabletop in its material colour from every line of sight,
without the overexposure of the top light.

**Test.** `image-planning-right-wall`: the object image shows the worktops in the colour of
`mod_CountertopColor`.

**Reproduce.** `mcp-test-2026-10-26_11-51-16`, gpt-6-astra 10 (`image-only-no-text`, local `feat/hi-mcp-performance`, default reasoning), snapshot `ps_sxjs0nfgpo2b48bst6sggvt7kpra5j`: the main run's worktop is white in the saved object image while the opposite top is brown. Both generated worktops retain Tiepolo walnut 216 in `plan-context.json` and the order data.
