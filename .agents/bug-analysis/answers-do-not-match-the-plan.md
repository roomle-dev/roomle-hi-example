# Answers do not match the plan

> **Type**: Bug Analysis  
> **Status**: Open  
> **Date**: 2026-11-01  
> **Backlog**: [Where Mistral Large falls short of the prompts](../backlog/mistral-large-prompt-issues.md), issue 10 ("Answers do not match the plan")  
> **Base**: roomle-hi-example `analysis/answers-do-not-match-the-plan` (from `master` `4a93dde`); roomle-ui `feat/hi-planning-assistant-lightweight` (`5bef43482`)

**Affected repositories**

- **roomle-ui** (on `feat/hi-planning-assistant-lightweight`): the result shaping every plan-changing tool and `get-plan-context` share — `inPlacementFrame` / `withWalls` (`packages/web-sdk/packages/homag-intelligence/src/hi-tool-commands.ts:434-497`, applied at `:1754` and in `hi-tools.ts:367,476`), the geometry helpers (`hi-plan-space.ts`), the read-only field lists (`hi-tool-payload.ts:499-504`), the served text (`hi-mcp/hi-mcp-server.ts` — `AUTHORING_RULES`, the tool descriptions), the system prompt (`hi-agent-prompts.ts`), the unit tests (`__tests__/hi-tool-commands/placement-frame-test.ts`, `create-or-replace-groups-input-test.ts`), and the references (`.agents/homag-intelligence/hi-tools-behaviour.md`, `hi-tools-reference.md`).
- **roomle-hi-example**: this analysis and the backlog item it comes from; the skill `.agents/skills/hi-mcp-tools.md` when the tool reference changes.
- **Unchanged:** the example pages and the embedding-lib (no forwarding change); `glue-logic.ts`; the library's calculation — the fix adds words to the results, never changes what the library calculates.

## 1. Symptom and reproduction

The model's final answer does not match the plan the tools built. Of the 56 runs of
`mcp-test-2026-10-17_10-50-12` (`mistral-large-latest`), 9 answer wrong: runs 09, 22, 24, 43 name a
wall the groups do not stand at; 42 names units that were not added; 44 misreads the images of
`get-plan-images`; 46 and 47 call wall units hanging on a wall the ones that stand on the floor;
01 names front colours the plan does not have. `mistral-large-4` shows it once in 52 runs
(`mcp-test-2026-10-21_16-59-20`, large-4 31): the wall unit that moved with an inserted drawer unit
is called the one "above the fridge" — it hangs above the drawer unit next to the fridge.

**Reproduce.** Run "test the mcp" with `mistral:mistral-large-latest` on the tests of the runs above
(09, 22, 24, 42, 43, 44, 46, 47, 01 of `mcp-test-2026-10-17_10-50-12`) and compare the final answer
with the last tool result: the answer's wall per group against the result groups' `position` and
per-root `wall`, the answer's units against the result's `roots` and `notLoaded`, the answer's
heights against the roots' `bottomMm`/`topMm`, the answer's colours against the roots' `attributes`
and `corrections`.

## 2. Investigation trace

1. The answer may only repeat the last tool results: the system prompt says "Summarize what you
   changed in a few sentences from the last tool results only - the groups, their roots with the
   wall each stands at and their attributes, corrections and notLoaded - never by repeating the
   results, and name what was asked but is not in the plan" (roomle-ui
   `hi-agent-prompts.ts:10`).
2. What a plan-changing result carries: `runToolCommand` wraps every command's result in
   `inPlacementFrame` (roomle-ui `hi-tool-commands.ts:1753-1757`; the group operations too,
   `hi-tools.ts:476`). `inFrame` (`hi-tool-commands.ts:480-496`) adds to each result group the
   `position` in the placement frame — `pos`, `rotationZ`, `footprint`, coordinates only (C14) —
   and, via `withWalls` (`:434-457`), a `wall` name per **root module** at a wall
   (`wallNameOfRoot`, `hi-tool-hints.ts:183-196`, D113), plus `rowIndex`. The
   `create-or-replace-groups` result itself is `loaded`, the changed `groups` in full,
   `groupAttributes`, `hint`, `corrections`, `notLoaded`, `groupLabels`
   (`hi-tool-commands.ts:975-990`) — no field says where a **group** stands in words.
3. The only tool whose result names a group-level place is `place-group`: `placedIn`
   (`corner`/`wall`/`point`) and `wall` (`hi-tool-commands.ts:1084-1086, 1139-1141`) — and only for
   the wall target, as the raw wall face (`resultWall`, `hi-wall-placement.ts:636-640`), not the
   plan context's name, corner or stretch.
4. The plan context's words for places (what the answer should repeat): walls carry `name` ("back
   wall", "left wall", …, `wallName`, `hi-mcp/agent-facing.ts:57-67`, applied in
   `agentFacingRooms` `:383-400`); room corners carry `name` ("back right", …) and `posRotationY`
   (`roomCorners`, `agent-facing.ts:82-113`); doors and windows carry the wall and their span along
   it as `fromEndMm`, measured from the wall's end (`wallOfOpening`, `:142-176`, applied in
   `agentFacingObstacles` `:405-425`); the free stretches of a wall are `fromEndMm` ranges
   (`freeStretchesAlongWall`, `hi-plan-space.ts:1092-1140`).
5. So to say where a group stands, the model must derive it: map `position.rotationZ`
   (0/90/180/270) back to a wall with the served mapping (back 0, left 90, front 180, right 270 —
   the Walls rule of `AUTHORING_RULES`, `hi-mcp-server.ts:18`), or aggregate the per-root `wall`
   fields — two walls for the legs of a corner group, and for wall units the hangs-vs-stands fact
   only from the per-root `bottomMm`/`topMm`. The "Verify results numerically" rule asks for exactly
   that check ("check that each row and each leg of a corner stands at the wall you meant",
   `hi-mcp-server.ts` AUTHORING_RULES), but the answer's group-level sentence has no result field
   in the plan context's words to repeat.

## 3. Root cause

`inPlacementFrame` (roomle-ui `hi-tool-commands.ts:461-497`) states a result group's place only as
placement-frame **coordinates** (`position.pos`/`rotationZ`/`footprint`, C14) plus a per-root
`wall` name (D113). No group-level field names where the group stands in the plan context's words —
the wall's name, the corner, the stretch along the wall as `fromEndMm`, the hanging height — and
only `place-group` names `placedIn`/`wall`, for the wall target only and as the raw face
(`hi-tool-commands.ts:1084-1086, 1139-1141`). The result of `create-or-replace-groups` — the tool
that builds the plan in most runs — carries none of it (`hi-tool-commands.ts:975-990`).

## 4. Why the current code produces wrong answers

The answer is built from the result alone (step 1 above), and for the group's place the result
offers numbers the model must map back to wall names (rotationZ 0/90/180/270 → back/left/front/
right). That mapping is a derivation step, and a weaker model gets it wrong — 9 of 56
`mistral-large-latest` runs name a wall the group does not stand at. The same shape covers the
other mismatches: hangs-vs-stands needs aggregating per-root `bottomMm`/`topMm` (46, 47), and the
units and colours the answer names must come from the result's `roots`, `attributes`,
`corrections` and `notLoaded` (01, 42) — the result carries them, but where it speaks numbers or
scattered per-root fields instead of the plan context's words, the model fills the gap from its
own intent and coordinates, and the answer does not match the plan. D113's rejected alternative
says why a served sentence alone does not fix this: "the results hold no wall to name" — at group
level they still hold none.

## 5. Proposed clean fix

All in roomle-ui on `feat/hi-planning-assistant-lightweight`; a read-only note field, never a
refusal — nothing the user may want is rejected (AGENTS.md "Guards Are a Last Resort").

1. **Name each group's place in its result, in the plan context's words.** In `inPlacementFrame`
   (`hi-tool-commands.ts:461-497`), beside `withWalls`, add a read-only group field — e.g.
   `standsAt` — computed from the calculated raw group and the rooms with the existing helpers
   (`wallFaces`, `wallOfRoot`, `spanAlongWall`, `roomCorners`, `floorCorners`, `groupHeightRange`,
   `hi-plan-space.ts`; `wallName`, `agent-facing.ts`), room data only, library-neutral:
   - at one wall: `{ placedIn: 'wall', wall: '<name as the plan context names it>', fromEndMm: [from, to] }`
     — the group's span along that wall measured from the wall's end, the same measure the
     obstacles' `fromEndMm` and the free stretches use;
   - at a room corner (the legs at two walls, or the group's corner at a corner of the room):
     `{ placedIn: 'corner', corner: '<back right>', walls: ['<name>', '<name>'] }`;
   - anywhere else: `{ placedIn: 'point' }` (the `position` already carries the point);
   - plus the height range (`bottomMm`/`topMm` of the group) so the field says "stands on the
     floor" vs "hangs at 1480 mm on the wall".
   Because `get-plan-context` groups pass through the same `inPlacementFrame` (`hi-tools.ts:367`),
   the plan context and every tool result then speak one vocabulary of places.
2. **Read-only on resubmit:** add the field to `READ_ONLY_GROUP_FIELDS`
   (`hi-tool-payload.ts:499-504`), so a group sent back from a result drops it without a
   correction, like `position`.
3. **Served text and references:** the "Verify results numerically" rule and the `get-plan-context`
   description (`AUTHORING_RULES` and the tool descriptions, `hi-mcp-server.ts`); the summary
   sentence of the system prompt (`hi-agent-prompts.ts:10`) names the new field; the `groups` result
   table and the C14/D113 rows plus a decision row in §3 of roomle-ui
   `.agents/homag-intelligence/hi-tools-behaviour.md`; `hi-tools-reference.md`; here
   `.agents/skills/hi-mcp-tools.md`.
4. **Tests:** `__tests__/hi-tool-commands/placement-frame-test.ts` — a row at a wall carries the
   wall name and its `fromEndMm` span; a corner group names the corner and both legs; a group of
   wall units names the wall it hangs on with its height range; an island names `point`;
   `create-or-replace-groups-input-test.ts` — the field on a resubmitted group is taken back
   without a correction.

No change to `glue-logic.ts`, the planner methods or the library.

## 6. Validation

- Unit tests of 4 pass.
- Then "test the mcp" with `mistral:mistral-large-latest` on the issue-10 runs (09, 22, 24, 42, 43,
  44, 46, 47, 01) and with `mistral:mistral-large-4` on large-4 31: every answer names the wall,
  corner, stretch and height the result's `standsAt` states, and the units and colours from the
  result's `roots`/`attributes`/`corrections`/`notLoaded` — no answer names a wall the group does
  not stand at.
