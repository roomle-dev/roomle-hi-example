# create-or-replace-groups accepts two roots on one side docking vector

> **Type**: Bug Analysis
> **Domain**: hi-mcp — `create-or-replace-groups` validation (`hi-mcp/hi-mcp-poc-json/tool-executors.ts`), the served rules (`hi-mcp-server.ts`)
> **Trigger**: "test the mcp" run `.temp/result/mcp-test-2026-10-01_11-35-00/report.md` (Mistral Large, planner `bo-test`), run 05
> **Date**: 2026-10-01
> **Author**: AI Assistant
> **Status**: Fixed — `e0427b7` on `fix/mistral-mcp-test` (PR #42), narrowed to the same mode and offset in the review
> **Branch**: `fix/mistral-mcp-test`

---

## Scope

The report classifies run 05 as a model finding with a hardening candidate. The model docked two
units to one side of the oven, and the server loaded a kitchen whose fridge stands inside the
corner cabinet. The server can tell this from the payload alone, before anything is loaded.

The gap was located before as H2 of
[unconnected-docking-graph-accepted.md](unconnected-docking-graph-accepted.md#h2-several-roots-on-one-docking-vector-run-06)
(gpt-5.4-mini, run 06: three roots on one corner `RightBottom`) and in the corner findings
(F-S1, 2026-09-29: the oven's `RightBottom` claimed twice). PR #24 rejected it and was reverted
together with its other changes (see
[new-group-outside-the-room-accepted.md](new-group-outside-the-room-accepted.md#why-it-was-left-open-before)).

## Symptom

Prompt: "create a kitchen with an oven, a fridge and a sink in the back right corner of the room".
Plan snapshot `ps_qm0151amfjz6310m7s8klanlngvbp7zu`. The loaded layout (`planner-calls.json`, last
`loadExternalObjectGroupLayout`):

| Root | Article | Docking entries written on it |
|---|---|---|
| `corner` | `UELTB90` corner base cabinet | `RightBottom -> sink.LeftBottom`, `LeftBottom -> oven.RightBottom` |
| `sink` | `ESUB2A90` | — |
| `oven` | `HOTS2AB60` tall oven cabinet | `RightBottom -> fridge.LeftBottom` |
| `fridge` | `HK260` tall fridge cabinet | — |

The oven's `RightBottom` meets the corner (the corner's entry names it) and the fridge (the
oven's own entry). The planner keeps both (`plan-context.json`:
`RightBottom->a931d202:LeftBottom,f06a7b65:LeftBottom`) and arranges both against that edge.
`order-data.json`:

| Module | Position (group-local) | Width |
|---|---|---|
| corner `mr_CornerunitStraight` | `[0, 0, 0]` | 900 |
| fridge | `[0, 0, 0]` | 600 |
| oven | `[-600, 0, 0]` | 600 |
| sink | `[1161, 0, 661]`, rotated −90 | 900 |

The fridge stands inside the corner cabinet. The images show the oven tower and the fridge on the
back wall, with the corner cabinet hidden under the fridge. The model answers that all units are
"docked together in a single group".

## Investigation

The validation of `create-or-replace-groups` (`tool-executors.ts:616-683`) checks per group:
roots and their fields, no positions, unique ids, the docking graph's connectivity
(`dockingErrors`, `:294-335`), and the placement. `dockingErrors` builds an undirected neighbour
graph from every entry. It answers whether every root is reached, not how many roots meet one
vector, so the run-05 graph (connected, four roots) passes.

The served rules (`hi-mcp-server.ts:10-11`) say "one placed root may carry several entries, one
per own vector", but no rule says that a vector takes one partner.

What the planner does with it: `HiRootModuleArrangementOperator` (roomle-ui
`hi-root-module-arrangement.ts`) mirrors every entry first, so the oven's `RightBottom` lists both
partners. It then places every partner of a vector against that vector's edge, by the entry's mode and
offset. Two partners on a side vector with the same mode and offset take the same place. The planner never resolves the conflict
(the earlier analysis, H2), and the server never sees root positions, so the conflict can only be
caught in the payload.

## Root cause

`create-or-replace-groups` did not count the partners of a docking vector. A side vector
(`LeftBottom`, `RightBottom`) is one edge at floor level. Two different roots docked to it with the
same mode and offset are arranged into the same space, and the server accepted the payload: before the
fix, `tool-executors.ts:665-669` ran only the connectivity check.

## Which vectors can take one partner only

| Vector | Several partners legitimate? |
|---|---|
| `LeftBottom`, `RightBottom` | No, at one place. One neighbour beside. The mode and the offset can separate partners: a shallow unit at the back (`StartStart`) and one at the front (`EndEnd`) of a deep unit's side, a unit further along the row (x offset), a wall unit beside a tall unit at mounting height (y offset). Only the same mode and offset are a conflict |
| `LeftTop`, `RightTop`, `BackTop` | Yes. The neighbour's top edge (the planner adds `RightTop`↔`LeftTop` between units beside each other, as in 06: the sink's `LeftTop` carries the drawer unit and the wall cabinet) and a unit above |
| `BackBottom` | Yes. A wide unit can carry two narrower ones back to back (`StartStart` and `EndEnd`) |

PR #24 also counted `BackBottom`/`BackTop`. That would reject the island case above, so this fix
counts the side Bottom vectors only.

## Fix

1. **`tool-executors.ts`**: `sideVectorErrors(roots)` runs beside `dockingErrors` in the
   validation loop:
   - it reads every entry in both directions, as the planner does. The entry `A.V -> B.W` with
     mode `m` and offset `o` puts B on A's `V` at (`m`, `o`), and A on B's `W` at the mirrored
     place: `StartEnd` and `EndStart` swap, the offset is negated, and a missing mode is
     `StartStart`;
   - it considers only `V`/`W` ∈ {`LeftBottom`, `RightBottom`} and only partners that are roots
     of the group;
   - a partner counts once, so mirrored entries do not count twice;
   - two different partners at the same place (mode and offset) on one side vector reject the
     payload before anything is loaded. Example: "roots 'corner', 'fridge' are docked to the
     RightBottom of root 'oven' with the same mode and offset - they stand in the same place. A side
     vector (LeftBottom, RightBottom) takes one neighbour there: continue a row from the free side
     vector of its last unit".
2. **The served rules** (`hi-mcp-server.ts`, the docking bullet): "A side vector (LeftBottom,
   RightBottom) takes one neighbour per place: two roots docked to one side vector with the same
   mode and offset would stand in the same place and are rejected - a row continues from the free
   side vector of its last unit."
3. **Tests** (`tests/tool-executors.test.ts`): the run-05 shape is rejected before the load, also
   with the corner's entry in the mirrored mode (`EndStart` on the corner, `StartEnd` on the oven).
   Loaded: a layout with mirrored entries, two partners on a Top vector and a wall unit beside a
   tall unit (y offset); and a shallow unit at the back, one at the front and one 600 mm along the
   row on one `RightBottom`.
4. **Living docs**: the validation lists of `minimal-hi-example/docs/hi-mcp-server.md`,
   `hi-mcp/hi-mcp-poc-json/README.md` and `.agents/skills/hi-authoring-rules.md`; the error table
   of `.agents/skills/hi-mcp-tools.md`.

## Validation

- `npm test` (hi-mcp, `hi-mcp-poc-json`): 187 tests pass, `npm run typecheck` is clean.
- **Live, bo-test** (MCP tool calls straight to the server, with the first, height-only form of
  the check): the run-05 docking (`UELTB90`, `ESUB2A90`, `HOTS2AB60`, `HK260`) was rejected
  with no load; the narrowed check rejects it the same way (unit test). The group
  already in the plan was untouched.
- **"test the mcp" again** (`.temp/result/mcp-test-2026-10-01_12-08-07/report.md`, run with the
  height-only form of this check and a room check that was dropped in review):
  - no final plan has two roots on one side vector, and 05 went from partial to pass;
  - two calls were rejected before any planner call (03, 06). The tool results are not recorded,
    so whether this check fired there is unknown. The first suite had the same kind of
    rejection three times, before the check existed;
  - a new overlap of the same kind came through another vector. In 03 the sink is docked to the
    corner article's `LeftBack`, an unlisted pair, and stands inside the corner cabinet. That is
    the pair check of H3 in the earlier analysis, listed as a hardening candidate.

## Review (PR #42)

The first form of the check compared only the height (`offset[1]`) of two partners. The review
pointed out that a side vector runs from the back to the front, and the mode and the offset can
separate two partners at the same height: a shallow unit at the back and one at the front of a
deep unit's side, or a unit further along the row. The check now compares the whole docking
place, mode and offset, and so rejects only what it can prove takes the same place.

## Alternatives considered and rejected

- **A check after the load** (two roots at one position): the plan context carries no root
  positions, and the group would already be in the plan.
- **Counting every vector**: rejects legitimate layouts. Top vectors carry the neighbour and the
  unit above; `BackBottom` carries two units back to back.
- **Resolving the conflict** (moving the second partner to the end of the row): guesses the
  model's intent. In 05 the model most likely meant the fridge on the oven's other side.
