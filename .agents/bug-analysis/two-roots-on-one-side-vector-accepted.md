# create-or-replace-groups accepts two roots on one side docking vector

> **Type**: Bug Analysis
> **Domain**: hi-mcp — `create-or-replace-groups` validation (`hi-mcp/hi-mcp-poc-json/tool-executors.ts`), the served rules (`hi-mcp-server.ts`)
> **Trigger**: "test the mcp" run `.temp/result/mcp-test-2026-10-01_11-35-00/report.md` (Mistral Large, planner `bo-test`), run 05
> **Date**: 2026-10-01
> **Author**: AI Assistant
> **Status**: Fixed — `8c272e4` on `fix/mistral-mcp-test` (docs `6329f3a`)
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
partners. It then places every partner of a vector against that vector's edge. Two partners on
a side vector at the same height take the same place. The planner never resolves the conflict
(the earlier analysis, H2), and the server never sees root positions, so the conflict can only be
caught in the payload.

## Root cause

`create-or-replace-groups` did not count the partners of a docking vector. A side vector
(`LeftBottom`, `RightBottom`) is one edge at floor level. Two different roots docked to it at the
same height are arranged into the same space, and the server accepted the payload: before the
fix, `tool-executors.ts:665-669` ran only the connectivity check.

## Which vectors can take one partner only

| Vector | Several partners legitimate? |
|---|---|
| `LeftBottom`, `RightBottom` | No, at one height. One neighbour beside. A second partner at another height (a unit beside a tall unit at mounting height, authored with a y offset) does not overlap, so only equal heights are a conflict |
| `LeftTop`, `RightTop`, `BackTop` | Yes. The neighbour's top edge (the planner adds `RightTop`↔`LeftTop` between units beside each other, as in 06: the sink's `LeftTop` carries the drawer unit and the wall cabinet) and a unit above |
| `BackBottom` | Yes. A wide unit can carry two narrower ones back to back (`StartStart` and `EndEnd`) |

PR #24 also counted `BackBottom`/`BackTop`. That would reject the island case above, so this fix
counts the side Bottom vectors only.

## Fix

1. **`tool-executors.ts`**: `sideVectorErrors(roots)` runs beside `dockingErrors` in the
   validation loop:
   - it reads every entry in both directions, as the planner does. The entry `A.V -> B.W` with
     offset `o` puts B on A's `V` at height `o[1]` and A on B's `W` at height `−o[1]`;
   - it considers only `V`/`W` ∈ {`LeftBottom`, `RightBottom`} and only partners that are roots
     of the group;
   - a partner counts once, so mirrored entries do not count twice;
   - two different partners at the same height on one side vector reject the payload before
     anything is loaded. Example: "roots 'corner', 'fridge' are docked to the RightBottom of root
     'oven' - roots on one side vector stand in the same place. A side vector (LeftBottom,
     RightBottom) takes one neighbour: continue a row from the free side vector of its last unit".
2. **The served rules** (`hi-mcp-server.ts`, the docking bullet): "A side vector (LeftBottom,
   RightBottom) takes one neighbour: two roots docked to one side vector at the same height would
   stand in the same place and are rejected - a row continues from the free side vector of its
   last unit."
3. **Tests** (`tests/tool-executors.test.ts`): the run-05 shape is rejected before the load. A
   layout with mirrored entries, two partners on a Top vector and a second partner on a side
   vector at another height (a wall unit beside a tall unit) is loaded.
4. **Living docs** (`6329f3a`): the validation lists of `minimal-hi-example/docs/hi-mcp-server.md`,
   `hi-mcp/hi-mcp-poc-json/README.md` and `.agents/skills/hi-authoring-rules.md`; the error table
   of `.agents/skills/hi-mcp-tools.md`.

## Validation

- `npm test` (hi-mcp, `hi-mcp-poc-json`): 186 tests pass (after the revert of the room check,
  `eb950a3`), `npm run typecheck` is clean.
- **Live, bo-test** (MCP tool calls straight to the server): the run-05 docking (`UELTB90`,
  `ESUB2A90`, `HOTS2AB60`, `HK260`) was rejected with the error above, with no load. The group
  already in the plan was untouched.
- **"test the mcp" again** (`.temp/result/mcp-test-2026-10-01_12-08-07/report.md`, run with the
  room check that was reverted afterwards):
  - no final plan has two roots on one side vector, and 05 went from partial to pass;
  - two calls were rejected before any planner call (03, 06). The tool results are not recorded,
    so whether this check fired there is unknown. The first suite had the same kind of
    rejection three times, before the check existed;
  - a new overlap of the same kind came through another vector. In 03 the sink is docked to the
    corner article's `LeftBack`, an unlisted pair, and stands inside the corner cabinet. That is
    the pair check of H3 in the earlier analysis, listed as a hardening candidate.

## Alternatives considered and rejected

- **A check after the load** (two roots at one position): the plan context carries no root
  positions, and the group would already be in the plan.
- **Counting every vector**: rejects legitimate layouts. Top vectors carry the neighbour and the
  unit above; `BackBottom` carries two units back to back.
- **Resolving the conflict** (moving the second partner to the end of the row): guesses the
  model's intent. In 05 the model most likely meant the fridge on the oven's other side.
