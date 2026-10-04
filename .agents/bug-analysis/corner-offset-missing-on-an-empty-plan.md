# Corner article offset missing on an empty plan

> **Type**: Bug Analysis
> **Domain**: hi-mcp — `create-or-replace-groups` (`hi-mcp/hi-mcp-server/tool-executors.ts`, `group-placement.ts`); data verified live against the running server and the deployed UI, and against plan snapshots (RoomleCore `npm run rapi:plan`)
> **Trigger**: Jira [RML-18007](https://roomle.atlassian.net/browse/RML-18007), Task 1 — "plan a kitchen in the back right corner of the room" on branch `refactor/hi-mcp-group-positioning-RML-18007` at `ef50fc4`: the L stands in the right corner with the right rotation, but its corner point is 261 mm inside the back wall
> **Date**: 2026-09-30
> **Author**: AI Assistant
> **Status**: Open

---

## Symptom and reproduction

1. Start `npm start gpt-5.4-mini <key>`, open the example page, make sure the plan contains no
   HI group (delete the previous kitchen).
2. Prompt: "plan a kitchen in the back right corner of the room".
3. Result (plan snapshot `ps_qiin8a8lw2e7u7aqo0g771k29psup72`, screenshot 10:24:04): the group
   has `pos [4815, 0, -3765]`, `rotationY 270` — the room corner point and the right rotation —
   with the corner article `UERTB90` at its origin. The article's corner point is root-local
   `[-261, 0, 0]` (`LeftBackBottom` starts there), so the kitchen's back row stands 261 mm inside
   the back wall. Expected: `pos [4815, 0, -3504]`, the origin moved 261 mm towards the front so
   that the corner point lands on the room corner.

The same happened in `ps_qig8umdjdt1k2rl5nten51kyiuzlt19` (10:05, corner article `EUERTB90`,
straight-row prompt) with the code of `e1fa6b1`.

## Investigation trace

| Fact | Evidence |
|---|---|
| The new server code was running | `ps`: `start.mjs` and both `vite-node` processes started 10:23:12–15; the last code commit `3134bf3` is from 10:21:55 |
| The server derives the offset only from a corner point it can read | `toRepositioningData` (`group-placement.ts`): `cornerPoints.get(anchor.articleId) ?? catalogArticleOf(articles, anchor)?.cornerPoint`; without one it sends `posGroup` unchanged |
| The catalog never carries `cornerPoint` | Live `get-plan-context` against the running server with a calculated corner article in the plan: every corner article has `cornerArticle: true`, `UERTB90` lists its docking vector **names**, no article has `cornerPoint` (checked 10:1x with `EUERTB90` in the plan and 10:2x with `UERTB90`). The deployed UI the page loads does not compute it — finding F-C2 of the corner findings was wrong |
| The compact catalog and groups carry no coordinates | `hi-plan-context.ts`: `dockingVectors: string[]` on articles and roots; `shapeRoot` drops positions and geometry |
| The only source with coordinates is the planner's raw groups | `getExternalObjectGroups()` returns the calculated `PosGroup`s with `dockInfos` (`start`/`end`), the shape the snapshot XML stores; exposed to the server since `686fe94` (`cornerPointsByArticle`) |
| The raw groups are empty on an empty plan | Article templates carry no `dockInfos` (all 111 articles in `docs/library-information/article.json`, `posData: {}`), the master data none; roomle-ui's `_groupMap` holds catalog articles only after a user placed one; `loadPosData` stores templates uncalculated (`glue-logic.ts:492-506`) |
| The plan was empty at the call | Live plan after the run: one group, the new `UERTB90` kitchen. The previous run's `EUERTB90` kitchen was gone (reproduction step 1) |
| Second defect: the offset lookup is keyed by `articleId` | `cornerPointsByArticle` keys by `root.articleId`; the four corner articles `EUELTB90`, `EUERTB90`, `UELTB90`, `UERTB90` share the root module `mr_CornerunitStraight` and the same geometry. A calculated `EUERTB90` in the plan would not have served a new `UERTB90` kitchen |

## Root cause

**The corner point of a corner article exists only as calculated geometry, and nothing calculates a
corner article before the first one is loaded.** The HOMAG templates and master data have no
docking geometry; the deployed UI derives neither `cornerPoint` nor vector coordinates for the
catalog; the planner exposes no calculation without a load. On an empty plan — the user's test
flow, one kitchen per prompt — the server therefore has no corner point to add to `posGroup`, and
the first corner kitchen stands its blind-zone offset inside the wall. Every corner kitchen created
while a calculated `mr_CornerunitStraight` is in the plan is exact (once the lookup is keyed by the
module, see below).

Why the current code is wrong for this case: it treats the corner point as data it can look up.
For the first corner article of a plan there is no data; the geometry has to be **produced** by a
calculation before the group is loaded.

## Fix

### F1 — key the offset by root module (done with this analysis)

`cornerPointsByArticle` keys by the calculated root's module name (`root.name`,
`mr_CornerunitStraight`) as well as by `articleId`; the lookup for the anchor tries its article id
and its module id (`rootModules[0].module.id` in the catalog). A calculated corner article of any
of the four variants then serves the others.

### F2 — produce the geometry before the load (decision needed)

The server can make the planner calculate the corner article without keeping anything in the
plan: load a throwaway single-root group of the corner article, read the raw groups (its
`dockInfos` give the corner point), remove it (`removeExternalObject`, to be added to the planner
API and the page allow-lists), cache the corner point per module for the server's lifetime, then
load the agent's group **once**, at the corrected `posGroup`. The agent's group is never loaded
twice and never moved. Cost: one extra load and removal, the first time a corner module is placed
after a server start; the probe is visible in the plan for the duration of its calculation.

Alternatives:

| # | Alternative | Assessment |
|---|---|---|
| roomle-ui computes the template geometry for the catalog (calculate a single-root group at catalog time, expose `cornerPoint` and vector coordinates) | The clean source; needs a roomle-ui change **and** a deployment of the UI the page loads before it has any effect, and the deployed UI does not even carry the existing `cornerPoint` code yet |
| A constant per module in the server (`mr_CornerunitStraight` → `[-261, 0, 0]`) | Immediate, but a library constant that is not calculated; wrong the day the library changes |
| Correct the created group after the load | Repositions the group; ruled out for Task 1 |

**Decision (2026-09-30)**: F1 done (`0dd5372`). The roomle-ui alternative was implemented on
`refactor/hi-plan-context-RML-17966` with unit tests and then reverted as too risky for now — it is
recorded for the backlog in
[roomle-ui-article-template-geometry.md](../backlog/roomle-ui-article-template-geometry.md).
**F2 is implemented in the server**: `probeCornerPoint` in `tool-executors.ts` loads a single-pick
probe of the corner article when neither the plan's raw groups nor the learned points nor the
catalog know its corner point, reads the point from the probe's docking vectors, removes the probe
(`removeExternalObject`, added to the planner API and the page allow-lists of the example page, the
reference bridge and the ligna-store), remembers it per article and module for the server's
lifetime (`knownCornerPoints`), and then loads the agent's group once at the corrected `posGroup`.
Unit tests cover the probe sequence, the cache across articles of the same module, the plan already
holding a calculated corner article (no probe) and a probe that yields nothing.

## Verification

1. Unit: `cornerPointsByArticle` serves `UERTB90` from a calculated `EUERTB90` (module key); with
   F2, the probe sequence (load probe → raw groups → remove → one load of the group with the
   corrected `posGroup`) and the cache (no second probe for the same module).
2. Live, empty plan: "plan a kitchen in the back right corner of the room" → group `pos
   [4815, 0, -3504]`, `rotationY 270`; the corner point at `[4815, 0, -3765]`; nothing inside a
   wall. Repeat for the other three corners and for a second kitchen with another corner variant
   while the first is in the plan.
