# Backlog: open findings about the plan context

> **Type**: Backlog — open findings about what `get-plan-context` shows
> **Domain**: RoomleCore's obstacle map; consumers: planner placement validation and snapping. The HI plan context derives its group outlines from parts (§5.4 of [hi-mcp-behaviour.md](../../docs/hi-mcp-behaviour.md#54-the-plan-context-get-plan-context)).

Each finding names the problem, its cause where it is known, the to-do and its test. A finding
leaves this document when its fix is in the code or it is decided not to fix it.

| # | Finding | Kind | Affected repositories / source | Ticket | Priority |
|---|---|---|---|---|---|
| 4 | [The kernel's obstacle outline of an HI group lies off the group](#4-the-kernels-obstacle-outline-of-an-hi-group-lies-off-the-group) | kernel geometry | RoomleCore | [RML-18138](https://roomle.atlassian.net/browse/RML-18138) | low — the plan context does not use it |

The remaining finding changes RoomleCore. See the
[brief repository-scope analysis](../bug-analysis/plan-context-findings-repository-scope.md).

## 4. The kernel's obstacle outline of an HI group lies off the group

**Ticket.** [RML-18138](https://roomle.atlassian.net/browse/RML-18138).

**Problem.** The kernel's obstacle map gives the HI group `c2b9fe06…` of the Open-Plan Room the
outline x 2687 to 3248, z 2563 to 6563; its parts span x 2623 to 3248, z 2314 to 6563 — the outline
starts 249 mm after the corner and is 64 mm too shallow. The other group is 109 mm too short and
56 mm too shallow. The plan context takes the group outlines from the parts (D45), but the kernel's
placement validation and snapping use the obstacle map.

**Cause.** Not investigated (RoomleCore `getObstacleMap`).

**To do.** Reproduce the contour mismatch in RoomleCore, identify its cause and correct the
obstacle outline in [RML-18138](https://roomle.atlassian.net/browse/RML-18138).

**Test.** RoomleCore: the obstacle outline of an HI group equals the ground contour of its parts.

**Reproduce.** `getObstacleMap` on the Open-Plan Room (`ps_qwm5odi6tyflyqwpdcxz1la791ho633`).
