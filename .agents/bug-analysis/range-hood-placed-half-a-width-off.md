# The range hood lands half its width off and takes the agent several attempts

> **Type**: Bug Analysis
> **Domain**: hi-mcp — the placement of a new group (`group-placement.ts`), the docking corrections (`tool-executors.ts`), the served rules (`hi-mcp-server.ts`); the plan context of roomle-ui (catalog without size and docking vectors on an empty plan)
> **Trigger**: user report 2026-10-02 — "the agent always has a lot of trouble to get the range hood positioned correctly and needs several attempts", with two screenshots and the plan snapshots `ps_qou14tltrtkszff9n7m05kalrr2puem4` and `ps_qouy1f7diacd5ogftqoumxrpdkfu5bb`
> **Date**: 2026-10-02
> **Author**: AI Assistant
> **Status**: Fixed

## Symptom

A kitchen along the right wall: fridge (tall), base unit, stove unit with hob, base unit, sink unit,
and wall cabinets above.
- **Wrong:** the hood hangs half its width to the left of the hob, in front of the left wall
  cabinet.
- **Right:** the hood hangs centred over the hob, in the gap between the wall cabinets.

The agent reaches the right state only after several attempts.

## Evidence

Both plans were downloaded with RoomleCore (`node/`: `npm run rapi:plan -- <id>`). Both were also
loaded in the example page in headless Chromium (`plan_id=<id>`), where the planner's raw groups
(`getExternalObjectGroups`), the plan context and the rendered images were read.

The top views of the planner give the hood's span along the right wall. The kitchen runs from
z −3765, so the hob unit spans z −2565 to −1965.

| Plan | How the hood is built | Hood spans (z) | Result |
|---|---|---|---|
| `ps_qou14tltrtkszff9n7m05kalrr2puem4` | root of the kitchen group, docked `LeftBottom → RightBottom` of the wall cabinet left of the gap | −2562 … −1964 | centred over the hob — **right** |
| `ps_qouy1f7diacd5ogftqoumxrpdkfu5bb` | a group of its own, placed with a placement | −2864 … −2272 | 299 mm to the left, in front of the wall cabinet — **wrong** |

The rendering matches the data in both plans. Against the screenshot labels the two ids look
swapped: the snapshot labelled "at the beginning" is the right one, and the one labelled "correct" is
the shifted one. The analysis below does not depend on which came first.

## The hood's geometry

The calculated hood (`DU`, root module `mr_Hood`, "Dunstabzug") is 598 × 501 × 741 mm. Its origin
is at its **horizontal centre**:

- `dockInfos`: `LeftBottom` starts at x −299, `RightBottom` at x +299; `LeftTop`/`RightTop` lie at
  y 741.
- `parts`: the canopy at `relPos` [−299, 0, 0], `dim` [598, 41, 500]; the chimney at [−130, 41, 0],
  [260, 700, 250].

Every cabinet has its origin at its back left bottom corner: its `LeftBottom` starts at x 0, and its
parts sit at `relPos` [0, 0, 0] with the offset in the matrix. The hood is the exception.

## Investigation: why the agent struggles

### 1. The rules send the agent down the hard path

The served rules (`hi-mcp-server.ts`, docking bullet) say: "A root without docking vectors (a hood,
for example) cannot be docked: give it its own group and position it with a placement."

The calculated hood has four docking vectors: `LeftBottom`, `RightBottom`, `LeftTop`, `RightTop`.
Docked, it lands exactly right: `LeftBottom` on the `RightBottom` of the wall cabinet beside the
gap puts its left edge at the cabinet's right edge (`ps_qou14…`, root at x 1499, spanning 1200 …
1798).

The agent cannot see this:
- On an empty plan the catalog lists no docking vectors for the hood (the template has no
  `dockInfos`; see [article template geometry](../backlog/roomle-ui-article-template-geometry.md)).
- The catalog lists no `dimensions` either (the template has no size attribute).

To the agent the hood is an article without size and without docking — just what the rule
describes.

### 2. The placement path is wrong for an article whose origin is not its back left corner

- The rules define `posGroup` as "the room point of the group's back left bottom corner".
- `toRepositioningData` (`group-placement.ts:224-256`) puts the anchor root's **origin** at
  `posGroup`, and corrects for that only for corner articles (the corner frame, C6).
- For the hood the origin is the centre. The saved plan `ps_qouy1…` holds the hood's origin at
  z −2565, the hob's left edge — the point the rules call the back left corner. The hood is centred
  on that edge and spans −2864 … −2266, half its width too far left. The agent's payload for this
  plan was not recorded; the saved origin is the placement point, as the server sends it.

### 3. What the agent reads back contradicts what it sent

After the load the planner shapes the group to its footprint: the raw group of `ps_qouy1…` has `pos`
z −2864 and the hood root at `articlePos` [299, 0, 0]. `get-plan-context` therefore reports `pos`
[4815, 1530, −2864] with the footprint x [0, 598] — not the −2565 the agent sent.

The agent sees its group 299 mm away from where it put it, and the image shows the hood off the
hob. Without the hood's size or origin, it can only try again. That is the series of attempts.

### 4. The agent cannot read where the hob is

To centre anything above the hob, the agent needs the hob's position. The plan context carries no
root positions (by design, D9). The agent has to add up the widths of the units in docking order
from the group position — five units here — before it even starts.

### 5. The server treats the hood as undockable

The fix of `3c4ae69` added `isUndockable` (`tool-executors.ts`): an article with neither docking
vectors nor a size cannot be docked. That describes the hood's catalog entry, not the hood:
- An undocked hood in a new group is never connected to the free end of a row; the guard stays,
  and the group goes to `notLoaded`. That is the run 04 rejection of "test the mcp" on 2026-10-02.
- Backlog item 5 of
  the test run's remaining issues ("An undockable unit discards its group", since removed from
  [the open issues](../backlog/mcp-test-open-issues.md))
  rests on the same wrong premise.

## Root cause

Three causes add up. The decisive one is the second.

1. **The instructions are wrong about the hood.** They declare it undockable and push the agent to
   a placement, although docking is the path that works. There is no recipe for a hood.
2. **The placement assumes every article's origin is its back left bottom corner.** The server
   compensates for that only for corner articles, so a hood placed by the rules lands half its
   width off.
3. **The agent lacks the facts to correct itself.** On an empty plan it has no size and no docking
   vectors for the hood. After the load its group is reported at a different `pos` than it sent,
   and there are no root positions to aim with.

## Proposed fix

1. **An anchor frame for every article**, not only for corners — one solution for the hood and the
   corner articles, worked out in
   [One anchor frame for articles with docking vector offsets](../refactoring-analysis/one-anchor-frame-for-docking-vector-offsets.md).
   The corner frame becomes the general frame: the docking corner (the back left bottom corner of
   the anchor's docking vectors, [−299, 0, 0] for the hood, the corner point for a corner article)
   and the corner turn. It reaches the planner as `rootRelPos`/`rootRelRotationY`, and the
   positions the agent reads back use the same frame.
2. **The instructions:**
   - Drop "a hood cannot be docked".
   - Add a recipe: "a range hood between two wall cabinets: dock its `LeftBottom` to the
     `RightBottom` of the wall cabinet left of the gap". The `LeftBottom` of a centred article
     starts at its left edge, so the docking puts it in place.
   - Add a recipe: "a hood above the hob without wall cabinets: dock it on the hob unit's `LeftTop`
     with `offset [0, <gap>, 0]`".
   - Add to the article catalog rule: a hood is a wall-mounted unit like a wall cabinet.
3. **`isUndockable`:** remove the heuristic. An article whose catalog entry has no docking vectors
   is unknown, not undockable. Correct backlog item 5 accordingly.
4. **Size and vectors in the catalog:** the anchor probe of point 1 can also give the calculated
   footprint, so the server could fill `dimensions` (width, depth, height) and `dockingVectors` of
   articles whose template lacks them. The lasting fix is the roomle-ui backlog item
   [article template geometry](../backlog/roomle-ui-article-template-geometry.md).

**Alternatives considered:**
- **Root positions in the plan context:** they would let the agent aim, but they bring the
  geometry back that was taken out for size and for the "dock, don't position" principle.
  Docking a hood needs no positions.
- **A server correction that centres a hood over the nearest hob:** it guesses the intent, and
  docking already expresses it.

## Code and documents a fix touches

- `hi-mcp/hi-mcp-server/group-placement.ts`: the anchor frame in `toRepositioningData`, the
  frame type
- `hi-mcp/hi-mcp-server/tool-executors.ts`: `probeCornerFrame` → anchor frames; `isUndockable`
- `hi-mcp/hi-mcp-server/hi-mcp-server.ts`: the docking bullet and the recipes
- tests: placement of a centred anchor; a hood docked beside a wall cabinet; an unconnected hood
  docked to a row end
- `hi-mcp/docs/hi-mcp-behaviour.md` (C6, G7, the rules), `.agents/skills/hi-authoring-rules.md`,
  backlog item 5

## Fix

Implemented with [One anchor frame for articles with docking vector offsets](../refactoring-analysis/one-anchor-frame-for-docking-vector-offsets.md)
(`4f712e7`, `63d2775`):

1. Every anchor is placed by its docking corner. A hood in a group of its own lands with its left
   edge at `posGroup`.
2. The groups the tools return report `pos` and `rotationY` as a placement names them. The agent
   reads back what it sent.
3. The rules dock the hood between two wall units: `RightBottom` of the wall unit left of the gap →
   `LeftBottom` of the hood. The sentence "cannot be docked" is gone.
4. `isUndockable` is removed: a catalog entry without docking vectors is unknown, not undockable.

Not covered: the size and the docking vectors of the hood on an empty plan's catalog (the roomle-ui
backlog item [article template geometry](../backlog/roomle-ui-article-template-geometry.md)), and a
hood recipe without wall units
([open issue 5](../backlog/mcp-test-open-issues.md#5-a-range-hood-without-wall-units-has-no-docking-recipe)).
