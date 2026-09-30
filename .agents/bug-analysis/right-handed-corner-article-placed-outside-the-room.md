# Right-handed corner article placed outside the room

> **Type**: Bug Analysis
> **Domain**: hi-mcp — placement of a new corner group in `create-or-replace-groups` (`hi-mcp/hi-mcp-poc-json/group-placement.ts`, `tool-executors.ts`); evidence from two "test the mcp" runs and from the live planner (bo-test, Furniture_Smith)
> **Trigger**: "test the mcp" run `.temp/result/mcp-test-2026-09-30_17-48-25/report.md`, prompt 04 — the only result classified as a bug; the same defect also hit prompt 04 of the run before (`mcp-test-2026-09-30_16-04-31`), hidden behind the docking bug fixed in [unconnected-docking-graph-accepted.md](unconnected-docking-graph-accepted.md)
> **Date**: 2026-09-30
> **Author**: AI Assistant
> **Status**: Open
> **Branch**: `fix/right-handed-corner-article-placement` (stacked on `fix/docking-graph-connectivity-check`)

---

## Symptom

Prompt: "plan a kitchen with an oven, a range hood, a sink and a fridge in the back right corner of
the room". Room: interior x −685 … 4815, z −3765 … 1235; back right corner `[4815, 0, -3765]`
(right wall `end`, back wall `start`).

**Run 17:48** — the model followed the served rules to the letter: corner article `UELTB90`
(`cornerArticle` true), `placement { posGroup [4815, 0, -3765], posRotationY 270 }`, the tall
units on the corner's `RightBottom`, the sink row on its `LeftBottom`. The server probed `UELTB90`
and sent `repositioningData { posGroup [4815, 0, -3765 − 1161 = -4926], posRotationY 270 }`. The
whole kitchen stands behind the back wall (top image of the run; group `pos [4815, 0, -4926]`).

**Run 16:04** — the model chose `UERTB90` with the attribute override
`mod_CarcaseDirection = Right`. The server probed the bare `UERTB90` (no attributes) and sent
`posGroup [4815, 0, -3504]` (+261, the left-handed offset), `posRotationY 270`. The saved plan
shows right-handed geometry: the fridge on the corner's `RightBottom` at root-local
`[1161, 0, 661]`, turned −90 — the corner unit stood along the right wall, its corner point
1422 mm in front of the back wall.

## The geometry (live planner, 2026-09-30)

Each corner article loaded once as a single root; the root-local docking vectors:

| Article | `mod_CarcaseDirection` | Corner point | `RightBackBottom` from the corner | `LeftBackBottom` from the corner | `RightBottom` | `LeftBottom` |
|---|---|---|---|---|---|---|
| `UERTB90`, `EUERTB90` | Left (template default) | `[-261, 0, 0]` | +x (to `[900,0,0]`) | +z (to `[-261,0,661]`) | `[900,0,0]→[900,0,561]` | `[-261,0,661]→[300,0,661]` |
| `UELTB90`, `EUELTB90` | Right (template attribute) | `[1161, 0, 0]` | +z (to `[1161,0,661]`) | −x (to `[0,0,0]`) | `[1161,0,661]→[600,0,661]` | `[0,0,0]→[0,0,561]` |

All four share the module `mr_CornerunitStraight` (`docs/library-information/article.json`); the
hand is the attribute `mod_CarcaseDirection`, which the agent may also override. The right-handed
frame is the left-handed one turned by 270° about y (`rotatedAboutY` convention of
`group-placement.ts`: +x → +z, +z → −x).

Put into the back right corner so that both back edges run along the walls:

| Hand | `posRotationY` | Back edge `RightBack` runs | Back edge `LeftBack` runs | Row on `RightBottom` | Row on `LeftBottom` |
|---|---|---|---|---|---|
| Left | 270 | along the right wall, to the front | along the back wall, to the left | right wall, to the front | back wall, to the left |
| Right | **0** | along the right wall, to the front | along the back wall, to the left | right wall, to the front | back wall, to the left |

In room terms both hands end up identical — the served corner rule ("right back 270 - RightBottom
along the right wall to the front, LeftBottom along the back wall to the left") describes the right
result for either hand; only the rotation that produces it differs, by +90° for the right-handed
frame. The same holds for the other three corners (left back 0 → 90, left front 90 → 180,
right front 180 → 270).

## Investigation

**Placement** — `toRepositioningData` (`group-placement.ts:232`) finds the anchor (the corner
article), takes its corner point and returns
`posGroup = placement.posGroup + rotatedAboutY(−cornerPoint, placement.posRotationY)` with the
agent's `posRotationY` unchanged. For `UELTB90` at 270 the corner point lands in the corner, but
the article's back edge `LeftBack` (local −x) runs to room −z — behind the back wall — and the
whole L with it. The rotation is never adapted to the article.

**Corner point** — `cornerPointOfRoot` (`group-placement.ts:142`) reads only the *start* of the
`LeftBack*`/`RightBack*` vectors; the directions, which tell the hand, are dropped. The points
are learned (`tool-executors.ts:196-246`, `:710-735`, `knownCornerPoints`):

1. from the plan's calculated groups (`getExternalObjectGroups`), keyed by `articleId` **and by
   module name** (`cornerPointsByArticle`, `group-placement.ts:159`) — introduced in `0dd5372`
   ("serve the corner offset to every article of the calculated corner module");
2. from the catalog's `cornerPoint` (`cornerPointFor`, `:186`);
3. otherwise by a probe: the bare article, `{ id: 'corner-probe', articleId }`, without the
   anchor's attributes (`probeCornerPoint`, `tool-executors.ts:205`).

None of the three knows the anchor's attributes. The module key is wrong across hands (a
calculated `UERTB90` serves `[-261, 0, 0]` to a later `UELTB90`), the article key is wrong when the
attributes differ (run 16:04), and the catalog point, like the module key, carries no hand at all.

**place-group is not affected** — `placeCornerAtWalls` (`plan-space.ts:329`) works on the
calculated group: `rootCornerGeometry` takes both corner vectors with their directions and turns
the group until they run along the two walls, for either hand.

## Root cause

`create-or-replace-groups` positions a corner group from the corner **point** of the anchor's
article and the agent's `posRotationY`. The served rotations are those of a left-handed corner
frame; a right-handed corner article (by its template, `UELTB90`/`EUELTB90`, or by the override
`mod_CarcaseDirection = Right`) needs 90° more, which the server never adds
(`group-placement.ts:232-262`). And the corner point is learned per article and per module
without the attributes that decide the hand (`tool-executors.ts:196-246`, `group-placement.ts:142-199`),
so even the offset is wrong when the hand comes from an attribute or from another article of the
module.

## Proposed fix

1. **A corner frame instead of a corner point** (`group-placement.ts`): from a calculated root's
   `LeftBack*`/`RightBack*` vectors (bottom row preferred, as today) the corner point **and**
   `turnY` — the rotation that maps the left-handed reference frame (`RightBack` along +x,
   `LeftBack` along +z) onto the root's frame: 0 for Left, 270 for Right. With only one of the two
   vectors, `turnY` comes from that one.
2. **Placement with the frame** (`toRepositioningData`): the group is turned by
   `posRotationY − turnY` (normalized), and `posGroup = placement.posGroup +
   rotatedAboutY(−point, that rotation)`. A left-handed article is unchanged; a right-handed one at
   the rule's 270 goes to 0 with its corner point in the corner — the served corner rules hold for
   both hands and need no change beyond one sentence for the verification ("the returned
   `rotationY` of a group anchored at a right-handed corner article is 90° more than
   `posRotationY`").
3. **One frame per article variant** (`tool-executors.ts`): the probe loads the anchor as it is —
   article **and** attribute overrides; the learned frame is keyed by library, article and the
   attribute overrides, for the server's lifetime. The module key, the plan's calculated groups
   and the catalog `cornerPoint` are no longer used for the placement: none of them can tell the
   variant the agent authored. Cost: one probe per distinct corner variant per server lifetime
   (a load and a remove, ~0.5 s, before the real load — as on an empty plan today).

## Tests

`hi-mcp/hi-mcp-poc-json/tests/group-placement.test.ts`:
- the frame of a left-handed and of a right-handed root (the live vectors above): point and turn
  0 / 270; one vector only; no corner vectors;
- `toRepositioningData` with a right-handed frame at 270: `posRotationY 0`,
  `posGroup [4815 − 1161, 0, -3765]`, corner point in the corner — for all four rotations;
- a left-handed frame keeps the current results (the existing offset tests, now fed with frames).

`hi-mcp/hi-mcp-poc-json/tests/tool-executors.test.ts` (corner probe):
- the probe carries the anchor's attributes;
- `UERTB90` with `mod_CarcaseDirection = Right` and the bare `UERTB90` are probed separately and
  placed differently (the run 16:04 case);
- `UELTB90` at 270 loads with `posRotationY 0` (the run 17:48 case);
- a calculated corner article in the plan or a catalog `cornerPoint` does not replace the probe;
- a second article of the same module is probed again.

## Verification

1. `npm run typecheck` and `npm test` in `hi-mcp`.
2. Live, with the planner: the payload of run 17:48 (`UELTB90`, 270) and of run 16:04
   (`UERTB90` + `mod_CarcaseDirection = Right`, 270) through `create-or-replace-groups`; the loaded
   group's footprint lies inside the room with the corner in the back right corner.
3. "test the mcp" again.
