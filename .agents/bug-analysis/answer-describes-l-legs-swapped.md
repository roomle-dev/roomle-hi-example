# The answer describes the two legs of the L-shaped kitchen swapped

> **Type**: Bug analysis
> **Status**: Open
> **Date**: 2026-10-24
> **Base**: roomle-hi-example `master` (`fc00c93`); roomle-ui `feat/hi-mcp` (`00b07666f`)
> **Backlog**: [mcp-issues.md #91](../backlog/mcp-issues.md#91-the-answer-describes-the-two-legs-of-the-l-shaped-kitchen-swapped)

## Affected repositories

- **roomle-ui** (`feat/hi-mcp`) — every root module of a group the agent reads carries `wall`, the
  wall it stands at. `inPlacementFrame` (`hi-tool-commands.ts`) derives it with `wallOfRoot` and
  `wallName` (`hi-plan-space.ts`). It is a read-only field (`READ_ONLY_ROOT_FIELDS`,
  `hi-tool-payload.ts`).
  - The served text names the field: the result-reading rule `hi-mcp-server.ts:42` and the
    `get-plan-context` description.
  - The system prompt (`hi-agent-prompts.ts:17`) says that the summary takes the walls from it.
  - Unit tests are in `__tests__/hi-tool-commands/placement-frame-test.ts` and
    `__tests__/hi-mcp/hi-mcp-server-test.ts`.
  - A new decision beside D66 and the result format go into
    `.agents/homag-intelligence/hi-tools-behaviour.md` and `hi-tools-reference.md`.
- **roomle-hi-example** — this analysis, backlog item 91, the root fields in
  `.agents/skills/hi-mcp-tools.md`, and the `expect` of `image-kitchen-back-right-corner` in
  `docs/test-prompts.json` (the answer names the legs as the plan has them).
- **embedding-lib, ligna-store** — unchanged. `createHiMcpTools` forwards the result as it is, so no
  new embedding-lib version is needed. The example page and the store get the field with the planner
  at their server URL.

The roomle-ui paths are relative to `packages/web-sdk/packages/homag-intelligence/src/` unless they
start with `__tests__/` or `.agents/`. The D-numbers are the decisions of
[roomle-ui `hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md).

## Result

The answer has nothing to read the walls from. The groups of `get-plan-context` and of every tool
result carry no wall per root module. The model takes the walls of the two legs from what it
intended, not from the plan. When its relations put a leg on the other wall, neither its check of the
result nor its answer can notice.

The swap does not reproduce in the stored runs:

- The run of the backlog record is no longer on disk.
- Its plan snapshot `ps_scriq9ltecd67bb427i97vk6f2dbkbi` answers 404 at `api.roomle.com`.
- The five later runs of the test all build the same legs, and each answer matches its plan.

## Symptom (as recorded)

`mcp-test-2026-10-20_06-45-46`, gpt-6-astra 60 (`image-kitchen-back-right-corner`, local roomle-ui
:5173), from the backlog record:

> the plan is right — the fridge HK260 and the hob UKS2A60 with the hood on the right run, the sink
> SUT60, dishwasher GSP, pantry H2TB60 and the oven HOTS2AB60 at working height on the back run — but
> the answer's bullet says "Fridge-freezer and hob on the back run; sink, integrated dishwasher,
> pantry and raised oven on the right", swapping the two legs.

The prompt is "create a kitchen like the one shown in the image, in the back right corner of the
room", with [`docs/images/kitchen-2.png`](../../docs/images/kitchen-2.png) on the plan
`default-room`.

## Investigation

### What the image asks for

The image shows the corner at the back. The long leg runs from it to the left: the tall units, the
fridge, the oven with the microwave above it, and the hob with the chimney hood. The short leg comes
forward on the right and ends with the sink. In the back right corner of the room, the long leg
stands at the back wall and the short leg at the right wall. The test's `expect` says the same.

### Where the legs stand in the stored runs

Every stored run sends one group with `placement` `{ wall: "right", alignment: "back" }`:

| Run | Corner article | `leftOf` the corner (the back wall) | `rightOf` the corner (the right wall) | Answer |
|---|---|---|---|---|
| 2026-10-18 gpt-6.1-sol 49 | `UELTB90` | prep, hob, filler, fridge | sink, dishwasher, pantry, oven | lengths per wall only |
| 2026-10-21 gpt-6-astra 65 | `UELTB90` | prep, hob, filler, fridge | sink, dishwasher, pantry, oven | "fridge and hob on the back wall and the sink and oven storage along the right wall" |
| 2026-10-22 07:57 gpt-6-astra 08 | `UERTB90` | drawers, hob, oven, fridge | sink, dishwasher | "the sink on the right-hand return" |
| 2026-10-22 09:29 gpt-6-astra 08 | `UERTB90` | drawers, hob, oven, fridge | sink, dishwasher | "keeping the sink on the right-hand return" |
| 2026-10-22 19:45 gpt-6-astra 67 | `UERTB90` | drawers, hob, oven, fridge | sink, dishwasher | "sink on the right-hand return" |
| 2026-10-20 gpt-6-astra 60 (record) | not recorded | — | fridge, hob (the record) | "Fridge-freezer and hob on the back run" |

The outlines in `plan-context.json` (pos space, `x` and `z` on the floor) confirm the walls for both
hands of corner article. In the 19:45 run, the fridge `HK260` stands at x 1754..2354, z −3765 (the
back wall), and the sink `SUT60` at x 4201..4815 (the right wall, x 4815). The `UELTB90` runs show
the same. The planner builds the corner as the rule `hi-mcp-server.ts:37` says: `rightOf` the corner
article runs along the right wall, `leftOf` it along the back wall.

In six recorded runs, the model meant the fridge and the hob for the back wall: five payloads and
the 2026-10-20 answer. According to the record, the 2026-10-20 plan has them on the right wall.
That plan therefore most likely sent the long leg `rightOf` the corner article — against the corner
rule and against what the model meant — and the answer described what the model meant. The record
calls the plan "right", but it also fits the room, so the record cannot tell which of the two the
model got wrong. Both readings have the same gap.

### What the model reads to describe a leg

- **Its own payload**, mapped through the corner rules: the relations `rightOf` and `leftOf`
  (`hi-mcp-server.ts:32`) and which wall each runs along (`:37`).
- **The returned groups.** The rule `hi-mcp-server.ts:42` lists what they carry: `position` (`pos`,
  `rotationZ`, `footprint` of the whole group) and per root `dockingVectors`, attributes, docking and
  `rowIndex`. The `get-plan-context` description adds "no root positions, no geometry". `rowIndex`
  (D66, `withRowIndices`, `hi-tool-docking.ts:1078`) counts a corner group as one row through the
  corner article, so it names no leg either.
- **The obstacles section of `get-plan-context`** carries per group the root outlines. The model
  could compare them with the wall coordinates, but no rule asks for that, and the result of a create
  carries no obstacles.
- **The system prompt** (`hi-agent-prompts.ts:17`): "Summarize what you changed in a few sentences
  from the last tool results only - the groups, their roots and attributes, corrections and
  notLoaded". Those results hold no wall, so a sentence that names a wall comes from the model's
  mapping of its relations, not from the results.

The server already knows the wall of every root module. `wallOfRoot` (`hi-plan-space.ts:1060`) finds
the wall piece a root module stands at, facing the same way within `WALL_STRIP_MM` (600 mm), and
`wallName` (`hi-plan-space.ts:554`) names it in the words of the plan context. The turned-leg hint
of a gap-closing delete uses both ("the leg on the back wall turned by 90° and now runs along the
right wall", `turnedLegHints`, `hi-tool-hints.ts:180`). No group the agent reads carries the result.

## Root cause

`inPlacementFrame` (`hi-tool-commands.ts:342`) shapes every group the agent reads: the groups of
`get-plan-context` (`hi-tools.ts:347`) and of every tool command (`hi-tool-commands.ts:1528`). It
gives a group its position in the placement frame and every root module its `rowIndex`, but not the
wall the root module stands at. To name the walls of the legs, the model has to repeat the mapping
it encoded with: relation, hand of the corner, wall. That mapping is the step that slipped in the
recorded run. The result offers nothing to compare it against.

The backlog's to-do, one served sentence ("the answer describes the plan as it stands, naming the
wall of each group"), does not reach the cause:

- **No source for the sentence.** The plan holds nothing the model could read the walls from.
- **The wrong unit.** An L-shaped group stands at two walls, so it has no single wall to name.

## Proposed fix

This follows step 2 of [Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort): the
server derives what the agent would have to compute.

1. **Every root module carries `wall`** — the name of the wall it stands at (`back wall`,
   `right wall`, …, the `name` of the plan context's walls) — in every group the agent reads.
   - `inPlacementFrame` derives it from the calculated group (`rootVolumesInRoom`), as
     `turnedLegHints` does: `wallOfRoot` on the room's wall pieces, then on the wall faces
     (`wallFaces`) for a root module in front of a door or a floor-to-ceiling window.
   - A root module at no wall gets none: an island, a free-standing piece, a group without a
     calculated position.
   - A corner article gets the wall it faces. A wall unit gets the wall it hangs on.
   - The field is read-only like `rowIndex`: it joins `READ_ONLY_ROOT_FIELDS`
     (`hi-tool-payload.ts:480`) and the `HiPlanRoot` type (`hi-plan-context.ts:199`), so a
     resubmitted group loads as without it.
   - It is not a root position (D9, D10). It names a wall of the plan context and carries no
     geometry.
2. **The served text names it in two places, briefly.** The result-reading rule
   (`hi-mcp-server.ts:42`) lists "and wall, the wall it stands at" among the per-root fields. The
   model can then check each leg against what it meant before it answers, so a leg sent to the
   wrong side is noticed and corrected. The `get-plan-context` description lists the field beside
   `rowIndex`.
3. **The system prompt** (`hi-agent-prompts.ts:17`) reads "… the groups, their roots with their walls
   and attributes, …", so the summary takes the walls from the results.

`inPlacementFrame` needs the rooms. It reads them once per call with positioned groups
(`getExternalObjectPlanContext(['rooms'])`), or takes them from a plan context that already includes
them. That costs a few milliseconds.

The field adds about 6 tokens per root module, about 90 for a kitchen of 15 root modules per group
returned.

The name `wall` matches the wall names and the hint's words. The model might write it into a new
root. The server ignores it there, as it ignores every other field (rule `hi-mcp-server.ts:20`). The
plan can still choose another name, such as `standsAt`.

### Alternatives considered

- **The backlog's served sentence alone** — rejected: there is no source for the walls, and an L has
  two walls (see Root cause).
- **A `walls` list per group** — rejected: it does not say which root module stands at which wall,
  which is exactly what a leg description needs.
- **A hint for corner groups only** ("the root modules rightOf c1 run along the right wall: …") —
  rejected: it is special text for one shape. The per-root field covers rows, corners, U-shapes and
  the plan context the same way.
- **Telling the model to compute the walls from the obstacles' root outlines** — rejected: it asks
  the agent for geometry the server already computes, and a create's result carries no obstacles.

## Tests

- `__tests__/hi-tool-commands/placement-frame-test.ts`:
  - The root modules of an L-shaped group in the back right corner carry `back wall` on the leg
    along the back wall and `right wall` on the leg along the right wall.
  - Its wall units carry the wall they hang on.
  - The root modules of an island carry no `wall`.
  - A group without a calculated position carries none.
  - The groups of `create-or-replace-groups` and of the command tools carry it the same way as the
    groups of `get-plan-context`. The test "reports the groups of create-or-replace-groups and of
    the command tools the same way" is extended.
- `__tests__/hi-tool-commands/` (the payload of a create): a group resubmitted with `wall` on its
  roots loads as without it.
- `__tests__/hi-mcp/hi-mcp-server-test.ts`: the result-reading rule and the `get-plan-context`
  description name the field.
- Model acceptance: `image-kitchen-back-right-corner` — the answer names the two legs as the plan
  has them, and a leg sent to the wrong side is corrected before the answer. This runs only on
  request, on a planner that carries the change (bo-test after deployment, or the local roomle-ui
  with `--dev`).
