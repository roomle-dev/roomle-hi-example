# Agent placement in a room corner: findings

> **Type**: Bug Analysis (findings and conclusion — no proposed fix)
> **Domain**: the chain from the chat prompt to the placed group — chat backend (`hi-mcp/hi-mcp-chat`), MCP server instructions and tools (`hi-mcp/hi-mcp-poc-json`), plan context and arrangement (roomle-ui `homag-intelligence`), verified against plan snapshots (RoomleCore `npm run rapi:plan`)
> **Trigger**: "plan a kitchen with an oven, a sink and a fridge in the back right corner of the room" places the second unit inside the back wall and the third on top of the first; later the same day "plan a kitchen in the back right corner of the room" placed the corner kitchen 261 mm inside the back wall
> **Date**: 2026-09-29 / 2026-09-30
> **Author**: AI Assistant
> **Status**: Open

This document replaces the two earlier analyses of the same problem
(`straight-row-docked-past-the-corner.md`, `straight-row-past-the-corner-instruction-gap.md`)
and sums up every finding of 2026-09-29, including the attempts made that day and what was
observed after each. It records facts and open questions; it does not choose a fix.

---

## 1. Room and prompts

All runs used the same room (plan wall axes x −745 … 4875, plan-y −3825 … 1295, wall thickness
120): interior x `[-685, 4815]`, z `[-3765, 1235]` in pos space. The walls as `get-plan-context`
derives them (`hi-plan-context.ts` `deriveWalls`, contour counter-clockwise, interior on the left):

| Wall | `start` | `end` | `facingRotationY` |
|---|---|---|---|
| right | `[4815, 0, 1235]` | `[4815, 0, -3765]` | 270 |
| back | `[4815, 0, -3765]` | `[-685, 0, -3765]` | 0 |

The interior back right corner is `[4815, 0, -3765]`: the right wall's `end` and the back wall's
`start`.

Prompts: **P1** "plan a kitchen with an oven, a sink and a fridge in the back right corner of the
room" (straight units); **P2** "plan a kitchen in the back right corner of the room" (corner
article). Agents: the example page's chat window (`hi-mcp-chat`, Vercel AI SDK) with several
models; the two earlier corner analyses ran in Claude Desktop.

## 2. Evidence: the snapshots

All groups below are one group with `rotationY 270` (stored as −90) and `pos [4815, 0, -3765]`,
the interior corner — the anchor's `posGroup` and `posRotationY` were right in every run.

### S1 — P1, first observation (`ps_qg8qrlxkx1vwtq3yv1zk2fu3tcg5u2l`)

| # | Root | Article | Width | Authored docking | Room z |
|---|---|---|---|---|---|
| 1 | fridge | `HK60` | 600 | own `LeftBottom` → oven `RightBottom` | −3765 … −3165, flush in the corner |
| 2 | oven | `HOTS2AB60` | 600 | own `RightBottom` → sink `LeftBottom` | −4365 … −3765, inside the back wall |
| 3 | sink | `ESUB2A90` | 900 | — | −3765 … −2865, on top of the fridge |

The oven is docked to the anchor's left side; the sink to the oven's `RightBottom`, the side the
fridge already occupies (the planner completes the reciprocal entry `oven.RightBottom → fridge`).
Roots listed fridge, oven, sink; all straight `mr_StorageunitSingle` units.

### S2 — P1, after the rule changes of the day (`ps_qgshniwockmvxyn7ptijliqgn6hhz2g`)

| # | Root | Article | Authored docking | Group-local x |
|---|---|---|---|---|
| 1 | fridge | `HK60` | own `LeftBottom` → oven `RightBottom` | 0 |
| 2 | oven | `HOTS2AB60` | own `LeftBottom` → sink `RightBottom` | −600 |
| 3 | sink | `ESUB2A90` | — | −1500 |

A consistent chain to the left: fridge in the corner, oven and sink in the line of the right wall
beyond the back wall (top view: two units above the back wall). The rules served by the running
server at that time were checked with `get-authoring-rules`: they contained "a row grows in one
direction only" and "LeftBottom -> RightBottom is never used to build a new row", and no longer
"row to the left" or "leftmost unit".

### S3 — P2, corner article (`ps_qgtxeomqh36h88rpt1qjijcslkedhie`)

| Root | Article | `articlePos` | `rotationY` | Docking |
|---|---|---|---|---|
| corner | `UERTB90` (`mr_CornerunitStraight`) | `[0, 0, 0]` | 0 | own `RightBottom` → u1 `LeftBottom`; own `LeftBottom` → u3 `RightBottom` |
| u1, u2 | `UTB60` | `[900, 0, 0]`, `[1500, 0, 0]` | 0 | chained `RightBottom → LeftBottom` |
| u3, u4 | `UTB60` | `[-261, 0, 1261]`, `[-261, 0, 1861]` | 90 | chained `LeftBottom → RightBottom` |

The docking is the L of the rules' example 3. The corner article's corner vectors start at
root-local `[-261, 0, 0]` (`LeftBackBottom [-261,0,0]→[-261,0,661]`, `RightBackBottom
[-261,0,0]→[900,0,0]`); at rotation 270 the corner point lands at room z −4026, 261 mm inside the
back wall, and the back-wall leg with it. No `rootRelPos` was applied (the corner article's origin
sits at the group origin).

### S0 — P2 in Claude Desktop, earlier corner analysis (`ps_qfs2p9vig2t187ytq4od7969vivuhgs`)

Same L, same room position of the corner point (z −4026), different bookkeeping: group `pos
[4815, 0, -4026]`, corner article at `articlePos [261, 0, 0]`, the straight units `EUTB60`. There
the group origin was the corner point; in S3 it is the corner article's origin.

## 3. Findings: the planner (roomle-ui `homag-intelligence`)

- **F-P1** The planner arranges exactly what is authored. `_createOrReplacePosGroupsFromLayout`
  (`glue-logic.ts:680`) completes article picks from the catalog template
  (`_prepareArticlePickRoots`, `:779`) and arranges the group
  (`_arrangeRootModulesAndCalculateIfChanged`, `:2758`). The seed root is `roots[0]` when no
  authored root carries a position (`hi-root-module-arrangement.ts:786`, `:929`); every other
  root is placed breadth-first along the authored docking (`_arrangeConnectedRoots`, `:825`,
  `setModulePositionFromDocking`, `:351`). There is no collision check and no room-bounds check
  (by design, see the refactoring analysis of the placement, D3).
- **F-P2** `_applyRepositioningData` (`:414`) puts the **origin** of the root named by `rootId`
  at `posGroup` (`G = T · R⁻¹`), turned by `posRotationY`; `rootRelPos` shifts the origin
  root-locally. For a straight unit the origin is its left back bottom corner; for the
  Furniture_Smith corner article the corner point lies 261 mm left of the origin.
- **F-P3** The straight units' side vectors start at the root origin: `LeftBottom [0,0,0]→[0,0,561]`,
  `RightBottom [w,0,0]→[w,0,561]`, `BackBottom [0,0,0]→[w,0,0]`. At rotation 270 group-local +x
  maps to room +z (towards the front) and group-local −x to room −z (into the back wall).
- **F-P4** Whether a returned group is re-based so that its origin is the corner of its docking
  vector box differs between S0 and S3 (same room, same corner article, different straight
  articles `EUTB60` / `UTB60`). In S3 and in S1/S2 the group origin is the seed root's origin.
  The condition for the re-basing was not identified; `keepDockingVectorCorner` exists in
  `_adjustGroup` (`glue-logic.ts:1112`) but not in the first-load path.
- **F-P5** The wall data, the anchor placement and the docking arrangement were correct in every
  snapshot. `calculatedCornerPointsByRoot` / `cornerPointOfRoot` (`hi-plan-context.ts:506`, `:280`)
  concern only `LeftBack*`/`RightBack*` vectors; the straight units carry none and get no
  `cornerPoint`, so that mechanism is not involved in S1/S2.

## 4. Findings: the plan context the agent gets

- **F-C1** Catalog articles are stored as the library delivers them (`loadPosData`,
  `glue-logic.ts:492-506`), uncalculated: the Furniture_Smith templates carry no `dockInfos`. An
  article's `dockingVectors`, `cornerArticle` and `cornerPoint` therefore come from a calculated
  root of that article in the plan (`calculatedDockingVectorsByRoot`,
  `calculatedCornerPointsByRoot`), and exist only once such a root is in the scene. On an empty
  plan the corner article has no `cornerPoint` and no `dockingVectors` in the catalog.
- **F-C2** The deployed UI the example page loads by default (`https://www.roomle.com/t/bo-test/`)
  contains the corner point code: its SDK bundle carries `cornerPoint` on the compacted article
  and the `LeftBackTop/RightBackTop/LeftBackBottom/RightBackBottom` list. In roomle-ui git the
  change (`a574b204b`) is on `refactor/hi-plan-context-RML-17966`, not on `master`.
- **F-C3** Groups in the context carry `position.pos`, `rotationY`, `footprint` and per root the
  docking, but **no root positions** (`shapeRoot`, "no positions, no geometry"). An overlap of two
  roots (S1: sink on fridge) is invisible in the context; a unit inside a wall shows only in the
  group footprint.
- **F-C4** On a first load the returned `position.pos` equals `posGroup` (F-P2, S3). The verify
  rule's premise "for a corner-anchored group, pos IS the corner point" held in S0 (re-based
  bookkeeping) and not in S3. In S3 the intended point and `pos` were identical while the corner
  point was 261 mm inside the wall.

## 5. Findings: the MCP server

- **F-S1** `create-or-replace-groups` validation (`tool-executors.ts:211-236`) checks that every
  root is related by docking. It accepts a side vector docked to two partners (S1: the oven's
  `RightBottom` claimed by the fridge's entry and by the oven's own entry towards the sink).
- **F-S2** The tool result returns the loaded ids, the post-load groups (F-C3) and a hint only for
  unpositioned groups. In S1–S3 `position.pos` was the intended corner, so the verify rule of the
  instructions reported success.
- **F-S3** The server logs tool names only (`hi-mcp-server.ts:90`). No payload of any run is
  logged; every payload above was reconstructed from a snapshot. The Claude Desktop MCP log
  records method names only.
- **F-S4** The authoring rules are a module constant read at server start. A rule edit takes
  effect only after the MCP server is restarted; the chat backend builds its system prompt per
  request.

## 6. Findings: what the agent reads

### The instructions

- **F-I1** `AUTHORING_RULES` (`hi-mcp-server.ts:6-59`) is one list of about 2,500 words plus five
  examples, served three ways: as the server's `instructions` on initialize, by the
  `get-authoring-rules` tool, and referenced from the `create-or-replace-groups` description.
- **F-I2** The wall rule (`:28`): "posGroup = end puts the anchor flush into the corner at the
  wall's end, the row running towards start". The direction is given in room terms; the docking
  vector that produces it is named only in example 1 ("a row of three tall units along the right
  wall, from the back right corner", chained `RightBottom → LeftBottom`).
- **F-I3** The corner rule (`:29`): "Corners of a rectangular room (…), with the corner article
  anchored at the corner point: … right back 270 - RightBottom along the right wall to the front,
  LeftBottom along the back wall to the left." True for a corner article (its two arms are turned
  90°); for a straight unit at 270 both side vectors lie on one line and `LeftBottom` points into
  the back wall. It is the only sentence that names "the back wall to the left" for the back right
  corner.
- **F-I4** The anchor rule (`:26`): "in an L-shaped kitchen the corner article, in a row its
  leftmost unit". "Leftmost" names no frame. In S1 and S2 the fridge (the unit named last in the
  prompt) was anchored in the corner and the others chained to its left.
- **F-I5** Left/Right of docking vectors are the sides as seen from the front of the unit
  (group-local x); "left wall", "to the left", "back = top" in the corner and wall rules are
  top-view room directions. The two frames coincide at rotation 0 and differ at 270. The rules
  state the rotation sense but not this consequence.
- **F-I6** The valid pairs list `RightBottom → LeftBottom (new root to the right)` and
  `LeftBottom → RightBottom (new root to the left)` as equal options; the recipes offered "row to
  the left" as a recipe of its own (until the change of 2026-09-29, see §7).
- **F-I7** The corner-article rule (`:27`) says: "An empty plan has no cornerPoint yet (…), so
  verify the first load and correct it - see the verify rule". The verify rule (`:32`) relies on
  `pos` being the corner point (F-C4).

### The chat backend

- **F-A1** `chat-server.ts` passed only `CHAT_SYSTEM_PROMPT` (three sentences: planning
  assistant, use the tools, call tools then summarise) as `instructions` to `streamText`. The MCP
  server's `instructions` were not part of the system prompt, although `@ai-sdk/mcp` exposes them
  as `mcpClient.instructions` (typed `readonly instructions?: string`, set from the initialize
  result). A model therefore saw the authoring rules only if it called `get-authoring-rules`
  itself. (Changed on 2026-09-29 in the day's last attempt, see §7.)
- **F-A2** Model dependence (user observation, P1 in the chat): gpt-5.4-mini produces a correct
  row; mistral-large-latest does not. Which model produced S1, S2 and S3 is not recorded.
- **F-A3** The chat stops after 8 steps (`stopWhen: stepCountIs(8)`). A complete flow —
  `get-plan-context`, `get-authoring-rules`, `create-or-replace-groups`, `get-plan-context` for
  the now-known `cornerPoint` or `pos`, a corrective resubmit, `get-plan-images`, the summary —
  is close to that limit.
- **F-A4** A provider rate limit was hit during one run ("Failed after 3 attempts … Rate limit
  exceeded", the AI SDK's default two retries). The step that fails is the one with the longest
  context, typically after the load; a corrective resubmit or the summary can be the step that is
  lost while the group is already placed.
- **F-A5** The page shows `[tool] <name>` status lines while a tool runs (`TOOL_STATUS_PREFIX`,
  `chat-server.ts:46`, `index.html:1138`), so whether `get-authoring-rules` was called in a run
  is visible in the chat window; the terminal shows `[hi-chat] tool call: <name>`.

## 7. Attempts on 2026-09-29 and what was observed

Recorded as facts about what was changed and what came out; each was reverted or superseded.

| # | Change | Observed |
|---|---|---|
| A1 (PR #24, merged, later reverted `1e979da`) | Rules rewritten: Left/Right frame sentence; "the row continues from the anchor's RightBottom only … a unit docked to its LeftBottom stands beyond the corner"; corner table moved under the corner recipe, marked "corner article only", with a "straight units only" alternative beside it; verify rule extended by a footprint check. Server: a side vector docked to two neighbours rejected; a group whose footprint lies outside the room gets a hint ("fix the docking" / "posGroup is wrong"). | P2 with several models: the corner article not in the corner, a leg missing, in one run the L outside the room (screenshots 21:27, 21:28, 21:40). Interpretation recorded then: the hint fired on the corner article's 261 mm first load and contradicted the delta rule; the new sentences described the corner article's second leg as an error. |
| A2 (PR #27 first state) | Two clauses only: each corner leg says "the corner article's … its …"; the wall rule adds "through the anchor's RightBottom (chained RightBottom -> LeftBottom, example 1)". | P1: same result as S1 (top view 22:02: fridge in the corner, two units beyond the back wall). |
| A3 (PR #27 second state) | "row to the left" removed from the recipes; `LeftBottom -> RightBottom` named for the corner article's second arm and for extending an existing group only; anchor rule: "in a row the unit that stands at posGroup …; which corner or wall it is changes only posGroup and posRotationY, never the docking". | P1: S2 — a clean chain to the left, with the served rules verified to contain the new text. |
| A4 (PR #27 third state) | Chat backend: `chatSystemPrompt` appends `mcpClient.instructions` to the system prompt; chat prompt names cabinets and wardrobes. | P2: S3 — correct L docking, corner point 261 mm inside the back wall, no `rootRelPos`. P1 not re-run with this state. |

After A4 the user reverted all code and rule changes; the repository is at `1e979da` plus this
document.

## 8. Conclusion

The positioning system for groups is too complicated for the agents that have to use it. To
place units in a corner the agent has to combine a room point, a rotation, the wall's start/end
orientation, the anchor choice, the unit-local Left/Right of the docking vectors and, for a corner
article, a root-local offset it may or may not be able to read from the catalog — and verify the
result from a position that does not always mean what the rules say it means. The outcome is bad
or worse depending on the model used: one model gets the same prompt right, another does not, and
wording changes to the rules moved the results around without making them reliable. The long-term
fix for this problem is to make the positioning easier, not to explain the current one better.
This is tracked in the backlog: [`../backlog/README.md`](../backlog/README.md).

## 9. Open questions (facts not established)

1. Which model produced S1, S2 and S3, and whether `get-authoring-rules` was called in those runs
   (visible in the chat window's `[tool]` lines or the terminal, not recorded).
2. Whether the plan was empty before S3, i.e. whether the catalog carried a `cornerPoint` for
   `UERTB90` at that moment (F-C1). Not readable afterwards; `get-plan-context` with `articles`
   answers it live while the page is connected.
3. Under which condition the planner re-bases the group origin to the docking-vector corner
   (S0) versus keeping the seed root's origin (S1–S3) (F-P4).
4. Whether Claude Desktop puts the server's `instructions` into the model's context (assumed in
   the earlier corner analyses; not verified).
5. The exact payloads of the runs: none was logged (F-S3); the reconstructions above are from
   the snapshots and are unambiguous for the docking and, via the group origin, for `rootId` and
   `posGroup`, but silent on `rootRelPos` when it was not applied.
6. Whether the 8-step limit or a rate limit cut a corrective step in any of the failing runs
   (F-A3, F-A4).
