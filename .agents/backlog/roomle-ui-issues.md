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
| 2 | [The water connection is an installation element only through a planner override](#2-the-water-connection-is-an-installation-element-only-through-a-planner-override) | catalog data, PoC override | Rubens Admin catalog (`room_designer`); roomle-ui `planner-kernel-access.ts` | medium |

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

**Reproduce.** `mcp-test-2026-10-25_18-06-08`, gpt-6-astra 71 (`image-only-no-text`,
plan snapshot `ps_sv5ngzarx0q25sl3eevrxo42g3cdrcv`, bo-test): the main run's worktop is
light/white in the saved object/top views while the opposite top remains brown. Both generated
worktops carry Tiepolo walnut 216 in `plan.xml`; the model's group attributes also request 216.

## 2. The water connection is an installation element only through a planner override

**Problem.** The plan context lists a water connection in `installationElements` only because
roomle-ui sets level 28 for every catalog item whose `externalIdentifier` is `water_connections`
(`planner-core/src/services/planner-kernel-access.ts:637`, marked as a PoC to be removed). The
catalog item `room_designer:water_connections` carries level 43. A planner without the override
reports the water connection as an obstacle object, and `installationElements` lacks it.

**Cause.** Rubens Admin has no water-connection level on the wall water connection items
([RML-18023](https://roomle.atlassian.net/browse/RML-18023), steps 1 and 2). The planner classifies
installation elements by the exact catalog levels 27 and 28 (roomle-ui `api.ts`,
`PLAN_INSTALLATION_ELEMENT_LEVELS`). Level 43 is a general height level other objects share, so it
cannot classify.

**To do.** Rubens Admin: set level 28 on the water connection items mounted on a wall. An item
configured as a floor connection (`connectionType = 'floor'`) does not get the wall level; its level
is decided with RML-18023. Then remove the override in roomle-ui `planner-kernel-access.ts`.

**Test.** Without the override, `installation-elements-supplies` and `sink-cabinet-at-water-connection`
list the water connection in `installationElements` and not in `obstacles`; roomle-ui
`it('classifies the levels 27 and 28 as electric plug and water connection')` holds.

**Reproduce.** `mcp-test-2026-10-25_15-24-34`, gpt-6-astra 02 (`sink-cabinet-at-water-connection`,
local roomle-ui without the override): `get-plan-context` lists no `installationElements` for the
plan `ps_sau169slquuapnhdz3fdmc0u24eplrcf` — the water connection comes as an obstacle object.
`GET https://api.roomle.com/v2/items/room_designer:water_connections` answers `layer` 43; roomle-ui
`release/bo-test` `planner-kernel-access.ts:637` sets 28.
