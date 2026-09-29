> **Type**: Bug Analysis
> **Domain**: hi-mcp — agent instructions of the MCP server (`hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts`); article geometry facts verified against plan snapshot data (RoomleCore RAPI download)
> **Trigger**: Jira [RML-17966](https://roomle.atlassian.net/browse/RML-17966) — re-test after the docking fix ([corner-kitchen-not-docked-after-positioning-rules.md](corner-kitchen-not-docked-after-positioning-rules.md)): the corner kitchen now docks as one group, but stands 261 mm inside the back wall
> **Date**: 2026-09-29
> **Author**: AI Assistant
> **Status**: Open

> **Progress (2026-09-29)**: S1 and S2 are implemented. roomle-ui
> (`refactor/hi-plan-context-RML-17966`, commit `06119863c`) exposes `cornerPoint` on the compacted
> article, from the template dockInfos or — Furniture_Smith templates carry none — from a
> calculated root of the article in the plan, with one new unit test. roomle-hi-example
> (`refactor/group-placement-via-repositioning-data-RML-17966`) teaches the offset (`rootRelPos` =
> the negated `cornerPoint`, root-local and rotated with `posRotationY` — never added to the room
> point `posGroup` unrotated) and the verify-and-correct rule for the empty-plan case, validates
> `rootRelPos`, and mirrors both into the docs. S3 was not needed; S4 remains a suggestion for the
> library team. Verification with a live agent run is pending — note that on an empty plan the
> first corner placement still relies on the S1 correction, because `cornerPoint` only exists once
> a calculated root of the corner article is in the plan.

---

## Symptom and Reproduction

Prompt: "plan a kitchen in the back right corner of the room". Plan snapshot
`ps_qfs2p9vig2t187ytq4od7969vivuhgs` (downloaded with RoomleCore `node/`: `npm run rapi:plan -- <id>`,
external configuration extracted from the plan XML).

The docking fix worked: the snapshot contains **one** group with the corner article and both legs
docked (5 article roots + 3 generated), arranged by the planner. But the kitchen penetrates the
back wall: the whole back row sits 261 mm inside it, while the right edge is flush with the right
wall.

## Data (from the snapshot)

- Group: `pos [4815, 0, -4026]`, `rotationY 270`.
- Room interior back right corner: `[4815, 0, -3765]` (wall axes at x 4875 / plan-y −3825,
  thickness 120 → 60 mm to the interior face; identical to the corner of RoomleCore's golden
  Furniture_Smith L-shape plan of the same room).
- Corner article `mr_CornerunitStraight`: `articlePos [261, 0, 0]`, `rotationY 0`. Its corner
  vectors start **left of the root origin**:
  - `LeftBackBottom`: start `[-261, 0, 0]`, end `[-261, 0, 661]`
  - `RightBackBottom`: start `[-261, 0, 0]`, end `[900, 0, 0]`
- Straight unit `mr_StorageunitSingle`: `LeftBottom`/`BackBottom` start `[0, 0, 0]` — no offset.
- Docking-vector bounding box of the article roots in the room: x `2954 … 4815`,
  z `-4026 … -1665` → the back of the kitchen is at z −4026, **261 mm behind the interior wall
  face** at −3765; the right edge (4815) is flush.

## Root Cause

**The agent followed the instructions exactly — the instructions carry a false premise about the
corner article's geometry.**

- Reconstructed agent input: the corner article's root origin stands at `[4815, 0, -3765]` in the
  room — exactly the interior corner. So the agent sent
  `repositioningData: { posGroup: [4815, 0, -3765], posRotationY: 270, rootId: <corner article> }`,
  precisely as Example 3 and the corner rules instruct.
- `_applyRepositioningData` (roomle-ui `hi-root-module-arrangement.ts:414`) places the **root
  origin** at `posGroup`. The instructions equate root origin = left back point = corner point
  ("its corner point is its left back point").
- For the real Furniture_Smith corner article that is false: its corner point (the shared start of
  the `LeftBack*`/`RightBack*` vectors) lies at root-local `[-261, 0, 0]` — the 261 mm blind zone
  the second leg butts into lies left of the article origin. At `posRotationY 270`, local −x maps
  to room −z, so the corner point (and with it the whole back row) lands 261 mm behind the wall
  face: `[4815, 0, -4026]`.
- The previous analysis verified the premise against RoomleCore's parity-test fixture
  (`leftCornerDockInfos` starts at `[0, 0, 0]`) and misread the golden L-shape ("the corner module
  sits at the group origin" — its roots at `[0, 0, 0]` are the generated countertop/toekick; the
  corner unit sits at `articlePos [261, 0, 0]` there too, with its corner *point* at the group
  origin). The premise holds for the test fixture, not for the shipped library.
- The removed `placeCornerAtWalls` never had this problem: it computed the corner point from the
  `dockInfos` geometry (`groupCornerGeometry`), article-agnostic. The refactoring replaced that
  computation with a stated assumption.

A useful invariant, confirmed by the snapshot: the planner re-bases a returned group so that its
origin is the back-left corner of its docking-vector box — for a corner-anchored L that **is** the
corner point. Returned `position.pos` `[4815, 0, -4026]` = the corner point in the room. The
intended corner minus the returned `pos` is therefore exactly the correction the placement needs
(`[0, 0, 261]`), whatever the article's internal offset is.

## Fix Options

| # | Change | Where | Trade-off |
|---|---|---|---|
| S1 | **Verify and correct** (instructions only): warn that a corner article's corner point may lie left of its origin (blind zone), and add the check to the verify rule and Example 3 — after the load, compare the returned `position.pos` with the intended corner point P; if they differ, resubmit the group with its id and `posGroup` shifted by `P − position.pos` (the offset is rotation-constant, so one correction is exact) | `hi-mcp-server.ts` rules + docs | Works today, self-healing for any article; costs a second load and reacts instead of knowing |
| S2 | **Expose the corner point in the plan context**: `compactArticle` (roomle-ui `hi-plan-context.ts`) already derives `cornerArticle` from the corner vector names — also expose `cornerPoint: [x, y, z]` (root-local start of the `LeftBack*`/`RightBack*` vectors, with the same template/calculated-root fallback as `dockingVectors`). Instruction: for a corner article send `rootRelPos = -cornerPoint` in `repositioningData` (the field exists end-to-end; it was only left undocumented) — root origin lands at `posGroup + R·rootRelPos`, corner point exactly at `posGroup` | roomle-ui + instructions | One load, exact, fits the agent-ready-context principle; needs the roomle-ui PR train (#3051 still open) and re-documents `rootRelPos` |
| S3 | **Anchor mode in the glue logic**: `repositioningData.rootAnchor: 'cornerPoint'` — `_applyRepositioningData` subtracts the root-local corner point itself (the root's `dockInfos` exist at that time) | roomle-ui API | Zero agent arithmetic; the biggest API change, same PR-train dependency |
| S4 | **Fix the article data**: give the corner article its corner point as origin | HOMAG library | Structural and convention-true, but outside roomle's hands and does not protect against the next library |

**Recommendation**: S1 now (the immediate, code-free fix — and a generic safety net every flush
placement benefits from), S2 as the proper one-load fix in the next roomle-ui change; raise S4
with the library team. S3 only if S2's negation step still proves too much for agents.

## Verification

1. Same prompt, fresh session. With S1: the first load lands at z −4026, the returned `pos`
   differs from the intended corner by `[0, 0, -261]`, the agent resubmits with
   `posGroup [4815, 0, -3504]` and the corner point lands at `[4815, 0, -3765]` — flush.
2. `get-plan-images`: the L sits in the back right corner, nothing inside a wall.
3. Repeat for the other three corners (the offset direction rotates with `posRotationY`).
