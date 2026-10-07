# Backlog: open findings about the plan context

> **Type**: Backlog — findings about what `get-plan-context` shows, not investigated yet
> **Domain**: roomle-ui `homag-intelligence` — `hi-plan-context.ts` (`deriveWalls`, `shapeObstacles`, `shapeRoot`), RoomleCore's room contour and obstacle map; consumer: `get-plan-context` (§5.4 of [hi-mcp-behaviour.md](../../docs/hi-mcp-behaviour.md#54-the-plan-context-get-plan-context))

Each finding names the problem, its cause where it is known, the to-do and its test. A finding
leaves this document when its fix is in the code or it is decided not to fix it.

| # | Finding | Kind | Priority |
|---|---|---|---|
| 1 | [A wall entry that runs against the contour gets the opposite side](#1-a-wall-entry-that-runs-against-the-contour-gets-the-opposite-side) | RoomleCore room contour, [RML-18072](https://roomle.atlassian.net/browse/RML-18072) | medium — a wrong wall name and rotation |
| 2 | [A root outline reaches into its neighbour](#2-a-root-outline-reaches-into-its-neighbour) | not a defect — article description, MCP text | low — neighbours of one group overlap in `obstacles` |
| 3 | [A calculation error of a new group reaches the agent through nothing](#3-a-calculation-error-of-a-new-group-reaches-the-agent-through-nothing) | roomle-ui, MCP server feedback | low — not seen in a run yet |
| 4 | [The kernel's obstacle outline of an HI group lies off the group](#4-the-kernels-obstacle-outline-of-an-hi-group-lies-off-the-group) | RoomleCore | low — the plan context does not use it |
| 5 | [A changed position height is reported with its old value](#5-a-changed-position-height-is-reported-with-its-old-value) | roomle-ui command result | low — the agent may set it again |

## 1. A wall entry that runs against the contour gets the opposite side

**Ticket.** [RML-18072](https://roomle.atlassian.net/browse/RML-18072) (RoomleCore)

**Problem.** The Open-Plan Room's contour runs back along the front wall between its two doors. The
wall entry there (an `opening`, from x 401 to −1749) gets the side `top` and the name "back wall",
and a `facingRotationY` that turns a group's back away from that wall. The entry after it is a
"front wall" from −1749 to 3248, across both doors.

**Cause.** The kernel's room contour. A second opening on a straight wall is inserted into both wall
pieces the first opening left, so the contour runs back along the wall (RoomleCore
`ObjectSurroundings::addOpeningToContour`, `object-surrounding-geometry.cpp:615`). `deriveWalls`
(roomle-ui `hi-plan-context.ts:752`) rightly takes the side from the segment direction: the
kernel's contour runs counter-clockwise with the room on its left.

**To do.** Wait for the RoomleCore fix (RML-18072). Then take the fixed kernel into roomle-ui and
check the reproduction below. Nothing changes in roomle-ui or in this repository, and no further
query of the kernel is added.

**Test.** In RoomleCore: the room contour of a wall with two doors (RML-18072).

**Reproduce.** `get-plan-context` on the Open-Plan Room (`ps_qwm5odi6tyflyqwpdcxz1la791ho633`).
Once fixed, every wall entry of the front wall has the side `bottom` and `facingRotationY` 180.

## 2. A root outline reaches into its neighbour

**Not a defect.** The obstacles are correct. A root module's outline is the outline of its
geometry, not the box of its docking vectors (D45). A part that reaches past the cabinet reaches
past it in the outline too.

**Observation.** In `obstacles.groups` of the Open-Plan Room, the outline of the sink unit `SUBA60`
reaches 996 mm along the row, into its neighbour, while the unit is 600 mm wide. The sink gives the
article its special geometry. `shapeObstacles` (`hi-plan-context.ts:897`) takes a root's outline
from its parts (`rootOutline`, `:860`, from `rootPoints`, `:442`).

**To do.**

- Library: the article's description (`desc`) states that its geometry reaches past its width.
  It does not yet: neither the live description (checked against the HI test backend on
  2026-10-07) nor the recorded one (`docs/library-information/article.json`) mentions it.
- MCP server: decide whether the obstacles text should say that an outline is the outline of the
  geometry and can reach past the docking vectors, over a neighbour. That text is in the
  instructions (`hi-mcp-server.ts:24`) and in the `get-plan-context` description (`:169`).

**Test.** None; the obstacles do not change.

**Reproduce.** `get-plan-context` on the Open-Plan Room (`ps_qwm5odi6tyflyqwpdcxz1la791ho633`): the
`SUBA60` root of the kitchen on the right wall.

## 3. A calculation error of a new group reaches the agent through nothing

**Problem.** The groups of the plan context carry no log messages (D9), and a new group loads as the
library calculated it: a root module the library could not calculate — for an attribute override it
cannot take — is loaded as it is, and nothing in the result of `create-or-replace-groups` says so.
A replaced group the library cannot calculate is restored and reported (§8.3 of the behaviour
reference); a new group has no previous state to restore.

**Cause.** The glue logic discards a failed calculation only when the group has a previous
calculation (`newlyFailedRootModules`, `_discardCalculation`, roomle-ui `glue-logic.ts:685`,
`:2836`). Whether the HOMAG library writes an `Error` for an invalid attribute value at all is not
known.

**To do.** Check first: create a group with an invalid `mod_Width` override and read the root's log
messages in the raw groups (`getExternalObjectGroups`). If the library writes an `Error`, report the
failing root modules in the result (`corrections`, or `notLoaded` with `rootIds`).

**Test.** A tool-executors test: a loaded group whose raw root carries an `Error` log message is
reported in the result.

**Reproduce.** Not seen in a run yet.

## 4. The kernel's obstacle outline of an HI group lies off the group

**Problem.** The kernel's obstacle map gives the HI group `c2b9fe06…` of the Open-Plan Room the
outline x 2687 to 3248, z 2563 to 6563; its parts span x 2623 to 3248, z 2314 to 6563 — the outline
starts 249 mm after the corner and is 64 mm too shallow. The other group is 109 mm too short and
56 mm too shallow. The plan context takes the group outlines from the parts (D45), but the kernel's
placement validation and snapping use the obstacle map.

**Cause.** Not investigated (RoomleCore `getObstacleMap`).

**To do.** Open a RoomleCore ticket with the plan and the numbers above.

**Test.** RoomleCore: the obstacle outline of an HI group equals the ground contour of its parts.

**Reproduce.** `getObstacleMap` on the Open-Plan Room (`ps_qwm5odi6tyflyqwpdcxz1la791ho633`).

## 5. A changed position height is reported with its old value

**Problem.** `change-module-attribute` with `mod_HeightPosInsertion` 1420 on a wall unit `OTB60`
succeeds, and the kernel holds 1420, but the group in the result lists the unit's
`mod_HeightPosInsertion` as 0.

**Cause.** Not investigated. The groups of a command result are shaped like the plan context
(`shapeRoot`, roomle-ui `hi-plan-context.ts:665`), which lists a root's input attributes.

**To do.** Compare the attribute in the glue logic's group with the kernel's after the command; find
which of them the result reads.

**Test.** A glue-logic test: the result of `change-module-attribute` lists the value just set.

**Reproduce.** Default Room (`ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv`): a group with an `OTB60`, then
`change-module-attribute` `mod_HeightPosInsertion` `1420` on it.
