> **Type**: Bug Analysis
> **Domain**: hi-mcp — agent instructions of the MCP server (`hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts`)
> **Trigger**: Jira [RML-17966](https://roomle.atlassian.net/browse/RML-17966) — after the group placement refactoring ([group-placement-via-repositioning-data.md](../refactoring-analysis/group-placement-via-repositioning-data.md), commit `45e3b6b`) the agent no longer plans a kitchen in a corner
> **Date**: 2026-09-29
> **Author**: AI Assistant
> **Status**: Open

> **Progress (2026-09-29)**: The instruction fix is implemented on branch
> `refactor/group-placement-via-repositioning-data-RML-17966`: docking rules before positioning
> rules, "one kitchen is one group" stated in the rules, the workflow and the tool description,
> the anchor rule replaced ("the root the docking starts from, listed first in roots"), the
> per-corner leg list added, and complete payload examples for docking to the left, the L-shaped
> corner kitchen and extending a group. The `rootId` validation message names the anchor rule; the
> living docs mirror all of it. The optional code items (multi-group hint, server-side argument
> logging) were not implemented. The verification (a fresh agent session with the same prompt) is
> pending — the analysis stays Open until then.

---

## Symptom and Reproduction

Prompt (Claude Desktop, local agent mode, local MCP server, example page):
"use the hi-orchestrator, plan a kitchen in the back right corner of the room" — room 5500 × 5000 mm,
empty plan.

Result of the first attempt (screenshots in `.temp/`, not committed):

- The corner module stands correctly in the back right corner.
- No row runs along the back wall or the right wall.
- One base unit stands alone near the left front of the room, about 400–1000 mm from the left
  wall and 3500–4100 mm from the back wall, turned like a unit of the back-wall row.

Before the refactoring the same kind of prompt produced a docked L-shaped kitchen.

What is not known: the `create-or-replace-groups` payload of that run. The Claude Desktop MCP log
(`~/Library/Logs/Claude/mcp-server-hi-orchestrator.log`, mcp-remote) records only the method names
(`tools/call`), not the arguments, and the MCP server does not log them either.

## Investigation

The planner-side flow was not changed by the refactoring: the executor sends the same article picks
and docking as before, and a docked group positioned with `repositioningData` is arranged by the glue
logic (seed root → breadth-first docking → `_applyRepositioningData`). The ticket author confirms
that the problem is the agent's understanding of the instructions, not the code. The instructions
were therefore read the way the agent reads them. Compared with the text before `45e3b6b`, the
docking rules are unchanged, but the agent now has to do what the server did before: choose the
anchor root and compute the position.

## Root Cause — the instructions

1. **No example for the cases the prompt needs.** The only complete JSON example is a straight row
   chained to the right (`hi-mcp-server.ts:32–37`, `RightBottom → LeftBottom`). Docking to the left
   exists only as a pair name (`:17`). The L-shaped kitchen, the most common request, is one
   sentence in the recipe (`:28`) and one in the third example (`:47`). Its second leg is exactly
   the undocumented case:
   - it is docked to the corner article's `LeftBottom`;
   - it is chained to the left (`LeftBottom → RightBottom`);
   - it ends up turned by 90° within the group.
2. **The anchor rule is ambiguous and contradicts the corner case.** "Set rootId to the leftmost
   root of the group's back row - a unit standing on the floor that is not turned within the group
   (in an L-shaped group the corner article)" (`:9`, and the tool description `:157–158`). "Left"
   and "back" refer to the group's own frame, but the same words name the room's walls ("back wall",
   "left back corner", "back = top"). For a kitchen in the back right corner, the leftmost unit of
   the row at the back wall is, in room terms, the far end of the second leg, not the corner
   article. The agent cannot resolve this from the data either: the plan context carries no root
   positions.
3. **"One kitchen is one group" is never stated.** "Author each group as article picks plus docking
   plus repositioningData" (`:55`) and "Position each group in the same call with
   repositioningData" (`:157`) read as "every group needs its own position". Nothing says that the
   corner article, both legs and the wall units form one group with one `repositioningData`, and
   that every other unit is docked, never positioned. The observed layout fits that misreading: a
   correctly positioned corner group plus units positioned separately with a computed point.
4. **Positioning dominates the rules, and the feedback is gone.** Three of the first six bullets are
   coordinate rules and formulas (`:9–11`), before the docking rules. Before the refactoring,
   positioning was one declarative bullet: the server picked the corner article as anchor itself
   and rejected a placement that met another group, with an error that pointed to docking. That
   guard was removed (decision D3), so a split kitchen now loads silently.

## Proposed Fix

Instructions only (`AUTHORING_RULES`, `INSTRUCTIONS`, `create-or-replace-groups` description in
`hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts`), mirrored into the living docs:

1. **Docking first, positioning second**, and state the principle: *a kitchen is one group — one
   anchor root carries the position, every other unit is docked; never position a second group to
   put units next to each other.*
2. **A mechanical anchor rule**: `rootId` is the root the docking chains start from, listed
   **first** in `roots`. The arrangement seeds the first root at the group origin
   (`hi-root-module-arrangement.ts`: `_findRootClosestToZero` falls back to `roots[0]` when no
   authored root carries a position), so its left back bottom corner is exactly the point
   `posGroup` places; in the authored payload it is also the root no other root lists under
   `dockedRoots`. In a corner kitchen that is the corner article. Drop "the leftmost root of the
   back row".
3. **Positioning as a lookup, not a derivation**: in a corner, `posGroup` = the corner point and
   `posRotationY` from the table below; along a wall, `posGroup` = the wall's `end` and
   `posRotationY` = its `facingRotationY`. Keep the offset/centring formula only as the one extra
   case.
4. **Complete JSON examples** — agents copy examples far more reliably than they apply rules:

   - *Dock to the right* (exists): `A → B` with `RightBottom → LeftBottom`.
   - *Dock to the left* (new): B directly left of A.

     ```json
     { "id": "A", "articleId": "<unit>", "contextData": { "dockedRoots": [
       { "ownDockingVector": "LeftBottom", "dockedRoots": [{ "id": "B", "dockingVector": "RightBottom", "mode": "StartStart", "offset": [0, 0, 0] }] } ] } }
     ```

   - *L-shaped kitchen in a corner* (new, complete). Corner article `c1`, two units on each leg,
     one group, one `repositioningData` on the corner article:

     ```json
     { "posGroups": [{ "libraryId": "<libraryId>",
       "repositioningData": { "posGroup": [<corner x>, 0, <corner z>], "posRotationY": 270, "rootId": "c1" },
       "roots": [
         { "id": "c1", "articleId": "<corner article>", "contextData": { "dockedRoots": [
           { "ownDockingVector": "RightBottom", "dockedRoots": [{ "id": "r1", "dockingVector": "LeftBottom", "mode": "StartStart", "offset": [0, 0, 0] }] },
           { "ownDockingVector": "LeftBottom", "dockedRoots": [{ "id": "l1", "dockingVector": "RightBottom", "mode": "StartStart", "offset": [0, 0, 0] }] } ] } },
         { "id": "r1", "articleId": "<base unit>", "contextData": { "dockedRoots": [
           { "ownDockingVector": "RightBottom", "dockedRoots": [{ "id": "r2", "dockingVector": "LeftBottom", "mode": "StartStart", "offset": [0, 0, 0] }] } ] } },
         { "id": "r2", "articleId": "<base unit>" },
         { "id": "l1", "articleId": "<base unit>", "contextData": { "dockedRoots": [
           { "ownDockingVector": "LeftBottom", "dockedRoots": [{ "id": "l2", "dockingVector": "RightBottom", "mode": "StartStart", "offset": [0, 0, 0] }] } ] } },
         { "id": "l2", "articleId": "<base unit>" }
       ] }] }
     ```

     Which wall each leg runs along (verified with the rotation convention of the refactoring
     analysis and the golden Furniture_Smith L-shape):

     | Corner | `posRotationY` | Leg from `RightBottom` runs along | Leg from `LeftBottom` runs along |
     |---|---|---|---|
     | left back | 0 | back wall, to the right | left wall, to the front |
     | right back | 270 | right wall, to the front | back wall, to the left |
     | right front | 180 | front wall, to the left | right wall, to the back |
     | left front | 90 | left wall, to the back | front wall, to the right |

   - *Wall unit above a base unit* (exists as the second example), *island* (back to back,
     `BackBottom → BackBottom`, no `mode`) and *extending an existing group to the left or right*
     through `freeDockingVectors` as short JSON snippets.

5. **Optional feedback, code**: a `hint` in the `create-or-replace-groups` result when one call
   creates several groups ("units next to each other belong into one group, docked"). Also
   optional: log the tool arguments in the MCP server, so a failed run can be diagnosed (AGENTS.md:
   "Tools should log their operations for debugging").

## Verification

1. A fresh agent session with the revised instructions and the same prompt.
2. The payload is one group, `rootId` is the corner article, and every other root is docked
   (captured through the server log from item 5, or from the agent transcript).
3. `get-plan-images` shows an L along the back and the right wall; repeat for the other three
   corners and for "a row along the left wall".
