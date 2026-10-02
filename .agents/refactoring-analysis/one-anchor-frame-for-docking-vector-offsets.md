# Refactoring Analysis: One anchor frame for articles with docking vector offsets

> **Type**: Refactoring Analysis
> **Domain**: hi-mcp — the placement of a new group (`group-placement.ts`), the corner probe (`tool-executors.ts`), the positions the agent reads back, the served rules (`hi-mcp-server.ts`); the planner's repositioning (roomle-ui `homag-intelligence/src/hi-root-module-arrangement.ts`, read only)
> **Trigger**: "There is already a fix for the corner cabinets, which also have offset. This is technically exactly the same situation, there is a docking vector offset. If we suggest a solution it should be one solution for both cases. Do a deeper analysis - one clean solution for articles with docking vector offsets."
> **Date**: 2026-10-02
> **Author**: AI Assistant
> **Status**: Done
> **Follows**: [The range hood lands half its width off](../bug-analysis/range-hood-placed-half-a-width-off.md) — this analysis replaces its proposed fix, point 1
> **Branch**: `docs/guards-as-last-resort`
> **Code read**: roomle-hi-example `dd88f9c`; roomle-ui `c2de4d15f` (`master`), the same repositioning code as `origin/feat/hi-mcp-command-api-RML-18004`; RoomleCore `feat/curved-walls-wall-curve`

## Problem

A placement says where the group's back left bottom corner goes (`posGroup`) and how the group is
turned (`posRotationY`). The server puts the anchor root's **origin** at `posGroup`. That is right
only for an article whose origin is the back left bottom corner of its docking vectors.

Two kinds of article break this assumption, and both for the same reason — their docking vectors
are offset from their origin:

- **Corner articles.** Their corner point lies 261 mm left of the origin (carcase direction Left)
  or 1161 mm right of it (carcase direction Right, which is also turned). The server compensates
  for them with the corner frame (C6, D18).
- **The range hood.** Its origin is its horizontal centre; its back left corner lies 299 mm left of
  it. The server does not compensate, and a hood placed by the rules lands half its width off.

Two mechanisms for one geometric fact is one too many, and the second one does not exist yet.

## Survey: which articles have an offset

Every article of the catalog (`Furniture_Smith`, backend `HI_PRE_Roomle_Milestone_2`, 111
articles) was calculated once as a single pick in the example page, headless, and its docking
vectors were read from the planner's raw groups.

| Article | What it is | Docking corner, root-local | Turn |
|---|---|---|---|
| 105 articles | cabinets, tall units, panels, fillers, closets, lowboards, utility | [0, 0, 0] — the origin | 0 |
| `DU` | range hood ("Dunstabzug"), 598 mm wide | [−299, 0, 0] | 0 |
| `SM_TV` | TV wall panel, 1270 mm wide, its back 40 mm behind the origin | [−635, 0, −40] | 0 |
| `UERTB90`, `EUERTB90` | corner base unit, carcase direction Left | [−261, 0, 0] — the corner point | 0 |
| `UELTB90`, `EUELTB90` | corner base unit, carcase direction Right | [1161, 0, 0] — the corner point | 270 |

The **docking corner** is the back left bottom corner of an article's docking vectors: the
minimum of their end points, taken after the article is turned so that a corner points back left.
The **turn** is that rotation — 270 for a right-handed corner article, 0 for every other article.

## The corner frame is already the general mechanism

`toRepositioningData` (`group-placement.ts:224-256`) works with a frame `F = (point, turnY)`. The
anchor root lands in the room at `T(posGroup, posRotationY) · F⁻¹`, where `F` turns by `turnY` and
then moves to `point`. Nothing in that calculation is about corners. Only the source of the frame is:

- `isCornerArticle` decides whether a frame is looked up at all (`group-placement.ts:232`), and
  only corner anchors are probed (`tool-executors.ts`, the `cornerAnchors` step).
- `cornerFrameOfRoot` (`group-placement.ts:166-183`) reads only the `LeftBack`/`RightBack`
  vectors.

The corner point is not a separate concept. It is the docking corner:

- Left-handed corner article: its docking vectors reach from x −261 to 900 and from z 0 to 661.
  The minimum, [−261, 0, 0], is the corner point.
- Right-handed corner article: after its turn, the minimum of its docking vectors is again the
  corner point, [1161, 0, 0].
- Hood and TV: the minimum is the start of their `LeftBottom` vector.

The planner uses the same reference point. `getDockingVectorCorner` is "the bottom-left-back
corner of the group's docking vectors", and `keepDockingVectorCorner` keeps an adjusted group's
docking vector corner where it stood in the room (`hi-root-module-arrangement.ts:129-163`).

**Why the docking vectors and not the parts or the footprint:** the docking vectors are the
article's contact edges. The back edge goes against the wall, and the side edges go to the
neighbours. Parts reach further. The footprint of two `UTB60` side by side is x [−10, 1210], because
the generated worktop overhangs by 10 mm, so a footprint corner would put the group 10 mm off the
wall line.

## Verification

Five single-article groups were loaded with repositioning data in the example page at
rotations 0 and 270, with the target point [2000, 0, −2000]. Three ways of sending the
placement were tried:

| Mode | What reaches the planner | Docking corner lands on the target |
|---|---|---|
| origin — today for every non-corner anchor | `posGroup`, `posRotationY` as the agent sent them | `UTB60` only. `DU` 299 mm off, `SM_TV` 635 mm and 40 mm off, `UERTB90` 261 mm off, `UELTB90` 1161 mm off |
| frame — today's corner frame, applied to every anchor | `posGroup`, `posRotationY` combined with `F⁻¹` | all 10 cases |
| relative — the frame as the planner's own fields | `posGroup`, `posRotationY` as sent, plus `rootRelPos = rotate(−point, −turn)` and `rootRelRotationY = −turn` | all 10 cases, the same group position as "frame" |

The planner's repositioning already has the two fields:
`G = T(posGroup, posRotationY) · T(rootRelPos, rootRelRotationY) · R_root⁻¹`
(`_applyRepositioningData`, `hi-root-module-arrangement.ts:414-445`). In its own words, the first
two terms are "where the referenced root should end up in the room". The frame fits that contract
exactly, and roomle-ui needs no change.

## Proposed solution

### Part 1 — one anchor frame for every anchor (the fix)

1. **The frame** (`group-placement.ts`): `cornerFrameOfRoot` becomes `anchorFrameOfRoot`. The
   turn comes from the `LeftBack`/`RightBack` vectors as today, and is 0 when there are none. The
   point is the docking corner. A root without docking vectors gets the identity frame. `CornerFrame`
   becomes `AnchorFrame`.
2. **Every anchor gets its frame** (`tool-executors.ts`): `isCornerArticle` no longer decides
   whether a frame is needed. `knownCornerFrames` becomes `knownAnchorFrames`, with the same key
   (library, article, attribute overrides). `probeCornerFrame` becomes `probeAnchorFrame`: it
   calculates each unknown anchor variant in a probe load, as it does today for corners. A combined
   load for all variants of a call was considered and dropped; see the implementation plan.
3. **The hand-off** (`toRepositioningData`): `posGroup` and `posRotationY` go to the planner as the
   agent sent them. For a frame that is not the identity, `rootRelPos = rotate(−point, −turn)` and
   `rootRelRotationY = −turn` are added. The server stops combining the frame with the placement
   itself, and the logged `repositioningData` shows the agent's placement unchanged.
4. **Guard G17 goes** (question 1): when the probe cannot calculate an anchor, the group is
   loaded with the identity frame and the result says so, for example "the anchor '…' could not be
   calculated beforehand and is placed by its origin; place-group puts the group against a wall or
   into a corner". `place-group` works on the calculated group (D21), so it places an offset group
   exactly.

**What it fixes:**
- A hood or a TV panel in a group of its own lands with its back left corner at `posGroup`.
- Corner articles get the same values as today, now from the general definition.
- Any article of any library whose origin is not its back left corner is covered, with no list of
  special articles.

**What stays:**
- The anchor walk (C5) and `rootId` with two corner articles (D17).
- The corner rules and their rotations.
- `place-group`: it measures the calculated group, using the footprint for walls and the
  calculated corner vectors for corners, so offsets are already included.
- Docking: it names vectors and has no coordinates.

**Cost:** one probe load per new anchor variant for the lifetime of the server. Today only corner
anchors pay this; after the change, the first use of a base unit variant pays it too.
- Measured headless, in the example page with a nine-unit kitchen loaded: 0.1–0.9 s per probe. The
  first probe after the page load took 7 s, which is library warm-up the real load would pay anyway.
- A session typically places groups with 1–3 anchor variants.
- On Cloudflare the cache lives as long as the container.

### Part 2 — the agent reads back the frame it wrote (question 2)

`get-plan-context` and the tool results report `position.pos` and `rotationY` as the planner's
**group origin**. For an offset article that origin is not what the agent sent, and it moves:

- After a create it is the anchor's origin: the hood's centre, 299 mm along the wall from the
  `posGroup` sent; 261 mm off the corner point for a left-handed corner article; for a right-handed
  one, 1161 mm off and turned, with `rotationY` = `posRotationY` + 90. The rules carry a sentence
  just to explain that last case.
- After a plan reload, the kernel moves the origin. The hood group of `ps_qouy1…` reports its left
  edge, with the hood root at `articlePos` [299, 0, 0].
- After a replace it is gone (side finding below).

This is cause 3 of the hood analysis: the agent sees its group in a different place from where it
put it.

**Proposal:** report `position` in the same frame as the placement:
- `pos`: the room point of the anchor's docking corner;
- `rotationY`: the group rotation plus the anchor's rotation plus the turn;
- the footprint: relative to that point.

What the agent sends as a placement is then what it reads back, for every article and both hands,
before and after a reload. The rule "its returned rotationY is posRotationY + 90" goes.

| Where | Data | Cost | Consequence |
|---|---|---|---|
| **Server** — the same `anchorFrameOfRoot` (recommended) | raw groups (`getExternalObjectGroups`): `articlePos`, `rotationY` and `dockInfos` of the anchors | 330–600 KB per call for the nine-unit kitchen, against 30 KB of plan context; reading the groups took 75–145 ms in the page. A lean read would need a new planner method on every page allow-list | one definition for both directions; the planner's raw values stay what the server's own geometry (overlap, `place-group`) uses |
| roomle-ui plan context (`shapeGroup`) | in-process | none | the turn of the corner rules — an MCP convention — would be implemented in two repositories |

### Part 3 — instructions and the docking heuristic

- **Drop** "A root without docking vectors (a hood, for example) cannot be docked: give it its own
  group and position it with a placement." The hood has four docking vectors, and after Part 1 a
  placement works as well.
- **Add the hood recipe** verified in `ps_qou14…`: "a range hood between two wall cabinets: dock
  its `LeftBottom` to the `RightBottom` of the wall cabinet left of the gap". A recipe without wall
  cabinets (on the hob unit's `LeftTop` with a `y` offset) has to be verified in a live run first.
- **Keep** the definition of `posGroup` ("the room point of the group's back left bottom corner").
  After Part 1 it is true for every article.
- **Remove `isUndockable`**: an empty `dockingVectors` list in the catalog means unknown, not
  undockable. This changes the second G7 row and backlog item 5.

## Alternatives considered

| Alternative | Why not |
|---|---|
| The planner calculates the frame: a new repositioning option "place the root by its docking vector corner" | No probe and no cache. But the corner turn is a convention of the MCP's corner rules, not of the planner, and it needs a roomle-ui release plus a ligna-store update |
| The catalog carries the article template's docking vectors ([backlog: article template geometry](../backlog/roomle-ui-article-template-geometry.md)) | Not an alternative but the next step: the frame is then read from the catalog and the probe goes away. The definition and the hand-off of Part 1 stay |
| A correction load: load, read the calculated anchor, reposition | No probe for the 105 articles without offset, but every offset group loads twice and visibly jumps. The probe is paid once per variant |
| A special case for the hood: centre it over the nearest hob, or a hood flag | Guesses the intent, and adds a second mechanism for the same fact |
| The footprint corner as the reference, as `place-group` uses for walls | It includes generated parts: the 10 mm worktop overhang would put the group 10 mm off the wall line |

## Decisions

The user follows the recommendations (2026-10-02):

1. **Guard G17 goes.** When an anchor cannot be calculated beforehand, the group is loaded with the
   identity frame and the result says so.
2. **Part 2 is done in the server**, with the same frame function as the placement.

## Side finding: a replace loses the group's position

`create-or-replace-groups` with a group exactly as `get-plan-context` returned it, without a
placement:
- Afterwards the planner's group has neither `pos` nor `rotationY`.
- The result carries the server's own hint "are not positioned and sit at the plan origin".
- The top-view image renders blank, the kitchen already in the plan included.

Reproduced on an empty plan and on `ps_qou14…`, with fresh groups, with and without the group
`attributes`. The attributes pass-through of `3f688c3` is therefore not the cause. `master` strips
the same fields (`id`, `libraryId`, `roots`, `repositioningData`), so the defect is probably older
than this branch; that was not checked against `master`. It contradicts the behaviour reference
("a group whose id is in the plan is replaced and keeps its position"; D26). Listed in the
[backlog](../backlog/README.md); not part of this solution.

## Implementation plan

**roomle-ui: no change.**
- `_applyRepositioningData` has applied `rootRelPos` and `rootRelRotationY` since 2026-07-16
  (`f49a43a5a9`).
- `hi-root-module-arrangement.ts` is identical on `master` and on
  `feat/hi-mcp-command-api-RML-18004`.
- The page allow-lists stay as they are: `getExternalObjectGroups` and `removeExternalObject` are
  on them already.

**Branch:** `refactor/one-anchor-frame`, based on `docs/guards-as-last-resort`, so the pull request
covers this change only.

**Two refinements against the analysis:**

- **One probe load per variant, as today**, not one load per call. The planner regenerates the ids
  of new roots, and the probe test "removes every group the probe load added, whatever its roots are
  called" shows that even the article id of a probe root cannot be relied on. The groups of a
  combined load could therefore not be matched to their variants. One probe costs 0.1–0.9 s.
- **Removing `isUndockable` has a visible consequence** (review point). An undocked hood in a
  kitchen group is docked to the free end of the **floor-unit** row, because its category
  "Kitchen | Appliances" does not name it a wall unit. The result names the docking it added.
  Until now the whole group went to `notLoaded`. With the hood docking in the rules, an undocked
  hood becomes rare, and the catalog has no other signal that tells a wall-mounted article.

### Step 1 — the anchor frame (`group-placement.ts`)

- `CornerFrame` becomes `AnchorFrame { point, turnY }`.
- `cornerFrameOfRoot` becomes `anchorFrameOfRoot(root)`:
  - the turn: from `LeftBack`/`RightBack` as today, 0 without them;
  - the point: the docking corner, `R(turn) · min over the end points of R(−turn) · endpoint`;
  - a root without `dockInfos` gets the identity frame.
- `cornerVariantKey` becomes `anchorVariantKey`, with the same key.
- `RepositioningData` gets the optional `rootRelPos` and `rootRelRotationY`.
- `toRepositioningData` looks up the frame for every anchor, without `isCornerArticle`:
  - `posGroup` and `posRotationY` stay as the agent sent them;
  - a frame that is not the identity adds `rootRelPos = rotate(−point, −turn)` and
    `rootRelRotationY = −turn`.
- New `positionInPlacementFrame(rawGroup, footprint)`, for Part 2:
  - the anchor is found by `findAnchorRoot` over the roots that are not generated, with "has
    `LeftBack`/`RightBack` vectors" as the corner test;
  - `pos` is the room point of the anchor's docking corner;
  - `rotationY` is the group rotation plus the anchor rotation plus the turn;
  - the footprint is the four footprint corners moved into that frame;
  - undefined when the group has no `pos`.

Tests (`tests/group-placement.test.ts`):
- **`anchorFrameOfRoot`**, using the survey's `dockInfos` as fixtures:
  - `UTB60`: the identity;
  - `DU`: [−299, 0, 0], turn 0;
  - `SM_TV`: [−635, 0, −40], turn 0;
  - `UERTB90`: [−261, 0, 0], turn 0;
  - `UELTB90`: [1161, 0, 0], turn 270;
  - a root without vectors: the identity.
- **`toRepositioningData`**:
  - identity: no `rootRel*` fields;
  - `DU`: `rootRelPos` [299, 0, 0], `rootRelRotationY` 0;
  - `UELTB90`: [0, 0, 1161] and 90.
  - The existing corner tests change from a combined `posGroup` to: apply the planner's formula
    and assert that the docking corner lands on `posGroup`.
- **`positionInPlacementFrame`**:
  - the hood group after a create (`pos` [2299, 0, −2000]) reports [2000, 0, −2000], rotation 0
    and footprint x [0, 598];
  - the hood group after a reload (`ps_qouy1…`: `pos` [4815, 1530, −2864], −90, root at
    [299, 0, 0]) reports the same point and 270;
  - the right-handed corner group after a create ([2000, 0, −839], 90) reports [2000, 0, −2000]
    and 0;
  - a plain row is unchanged;
  - a group without `pos` gives undefined.

Verify: `vitest` for `group-placement`.

### Step 2 — every anchor gets its frame (`tool-executors.ts`)

- Renames:
  - `knownCornerFrames` → `knownAnchorFrames`;
  - `forgetCornerFrames` → `forgetAnchorFrames`;
  - `NO_CORNER_FRAME` → `IDENTITY_FRAME`;
  - `probeCornerFrame` → `probeAnchorFrame`;
  - the probe root id `corner-probe` → `anchor-probe`.
- `probeAnchorFrame` gives the frame of the first calculated root that has docking vectors, or the
  identity.
- The probe step covers the anchor of **every** placed group (`cornerAnchors` → `placedAnchors`).
  Unknown variants are probed one after another and cached.
- **G17 becomes a correction**: when a probe calculates nothing, the group is loaded without a
  frame, and `corrections` gets "posGroups[i]: the anchor '…' could not be calculated beforehand -
  the group is placed by the anchor's origin; place-group puts it against a wall or into a room
  corner".
- The comment of `oneAtATime` says "anchor probe".

Tests (`tests/tool-executors.test.ts`):
- **The fake planner** of `createApi` answers a probe load (one group, root `anchor-probe`) with a
  calculated cabinet until it is removed, so every probe gives the identity. The placement tests
  read the real load, which is the last load call, instead of `calls[0]`.
- **The "corner probe" block becomes "anchor probe"**:
  - a `DU` anchor is probed and gets `rootRelPos` [299, 0, 0];
  - a cabinet variant is probed once, then taken from the cache;
  - the corner tests expect `rootRel*`;
  - "rejects the call … when the probe yields no calculated group" becomes "loads the group by the
    anchor's origin and says so";
  - "does not ask for the raw groups when no corner article is placed" is dropped.

Verify: `vitest` for `tool-executors`.

### Step 3 — positions in the placement frame (`tool-executors.ts`)

- A wrapper `inPlacementFrame(executor)`, beside `oneAtATime`:
  - after the executor, it checks whether the result has `groups` or a `group` with a `pos`;
  - if so, it reads `getExternalObjectGroups` **once** and replaces each group's `position` with
    `positionInPlacementFrame` of the raw group with the same id;
  - a group without a raw match or without `pos` stays as it is.
- Applied to:
  - `get-plan-context` (only when its result has groups);
  - `create-or-replace-groups`;
  - `place-group`;
  - the seven command tools.
- The server's own reads keep the planner's values: `planGroups`, `place-group`'s geometry, and the
  "not positioned" hint.

Tests:
- `get-plan-context` with groups reports `position` from the raw group;
- without the groups section, `getExternalObjectGroups` is not called;
- the groups in the result of `create-or-replace-groups` and of a command tool are reshaped;
- a group without a raw match stays unchanged.

Verify: `vitest`, `npm run typecheck`.

### Step 4 — the instructions and the docking heuristic

- In `hi-mcp-server.ts`, the served rules:
  - "A root without docking vectors (a hood, for example) cannot be docked: give it its own group
    and position it with a placement." → "A range hood hangs between two wall units like a unit
    beside them: RightBottom of the wall unit left of the gap -> LeftBottom of the hood."
  - The corner rules: "This holds for both hands of corner article: the server turns one whose
    corner lies on its right (carcase direction Right) by 90 degrees more itself - its returned
    rotationY is posRotationY + 90." → "This holds for both hands of corner article."
  - The `get-plan-context` description: "position with pos (the room point of the group's back left
    bottom corner, as a placement names it), rotationY and footprint".
- In `tool-executors.ts`, `isUndockable` goes, and `hasVector` treats a list it does not know as
  "has it".

Tests:
- `hi-mcp-server.test.ts`: the rules contain the hood sentence and contain neither "cannot be
  docked" nor "+ 90".
- `tool-executors.test.ts`: an undocked `DU` without vectors and without size in a new kitchen
  group is docked to a free end and reported. Today it goes to `notLoaded`.

Verify: the whole suite (`npm test` in `hi-mcp`) and `npm run typecheck`.

### Step 5 — live check, headless

A script in the scratchpad works through the MCP server, like `frame-check.mjs`:

- **Placement:** `UTB60`, `DU`, `SM_TV`, `UERTB90` and `UELTB90`, each with a row on its arms, at
  rotations 0 and 270:
  - the anchor's docking corner lands on `posGroup` in the raw groups;
  - `get-plan-context` reports `pos` = `posGroup` and `rotationY` = `posRotationY`.
- **The hood recipe:** a base row with wall units and a gap, the hood docked `RightBottom ->
  LeftBottom`. The hood spans the gap.
- **The probe time** with a kitchen in the plan.

### Step 6 — documents

- `hi-mcp/docs/hi-mcp-behaviour.md`:
  - D33 (this decision); D18 superseded by D33;
  - C6 rewritten; G17 becomes a correction; the second G7 row changed;
  - the steps of `create-or-replace-groups` (§6) and the plan context (§5.4);
  - the probe in the table of planner calls.
- `.agents/skills/hi-mcp-tools.md`, `.agents/skills/hi-authoring-rules.md`,
  `.agents/skills/hi-mcp-server.md`, `minimal-hi-example/docs/hi-mcp-server.md` and
  `hi-mcp/hi-mcp-poc-json/README.md`: the "+ 90" sentence, `position`, the hood.
- Close-out:
  - this analysis → Done, with its report;
  - [the hood bug analysis](../bug-analysis/range-hood-placed-half-a-width-off.md) → Fixed;
  - backlog item 5 is removed from the backlog index and from the run's issue list.

### Step 7 — "test the mcp" (on request)

The run uses the skill with gpt-5.4-mini. The two corner prompts with a range hood show the effect:
- the hood is placed in fewer attempts;
- the agent does not place a group again after reading its position back.

**Commits**, one per step:
- `refactor: place every anchor by its docking corner`;
- `feat: report group positions in the placement frame`;
- `fix: dock the range hood like a unit beside the wall units`;
- `docs: …`.

## Report

Implemented on `refactor/one-anchor-frame`, based on `docs/guards-as-last-resort`:

| Commit | Content |
|---|---|
| `4f712e7` refactor: place and report every group by its anchor's docking corner | Steps 1–3: `AnchorFrame`, `anchorFrameOfRoot`, `toRepositioningData` with `rootRelPos`/`rootRelRotationY`, `positionInPlacementFrame`; the probe of every placed anchor, G17 as a correction; `inPlacementFrame` around the ten tools that return groups |
| `63d2775` fix: dock the range hood like a unit beside the wall units | Step 4: the hood sentence, the corner rules without "+ 90", `pos` in the `get-plan-context` description; `isUndockable` removed |
| `87bd34f`, `0d4a14b` docs | Step 6: behaviour reference (D33, C6, C14, G7, G17), skills, the server docs, the testing skill |

**Deviations from the plan.**
- Steps 1–3 are one commit: they change the same two files, and the frame is one concept in both
  directions.
- No roomle-ui change was needed, as planned.

**Verification.**
- **Unit tests:** 280 pass (`npm test` in `hi-mcp`), and `npm run typecheck` is clean. New tests:
  - the frame of a cabinet, a hood, a TV panel and both corner hands, from the survey's docking
    vectors;
  - the hand-off, checked with the planner's formula;
  - the read-back after a create, after a reload and for a right-handed corner kitchen;
  - the probe of every anchor, the G17 fallback, and the read-back in `get-plan-context`, in
    `create-or-replace-groups` and in a command result;
  - through the page bridge: a hood's `rootRelPos`, and the read-back after `place-group`.
- **Live check, headless, through the MCP server:**
  - `UTB60`, `DU`, `SM_TV`, `UERTB90` and `UELTB90` with a row on each arm, at 0 and 270: the
    docking corner lands on `posGroup`, and `get-plan-context` reports `posGroup` and `posRotationY`.
    The planner's own origin is off by 299, 635/40, 261 and 1161 mm.
  - The hood docked `RightBottom → LeftBottom` between two wall units spans the gap at their height.
  - A call took 30–370 ms with its probe; the first hood load took 3.9 s (loading its assets).
- **"test the mcp"**, gpt-5.4-mini: 8 pass, 3 partial, 2 fail; no fail from the placement.
  - Every placement reached the planner as sent, with the frame for the corner articles.
  - Every group was read back with the `pos` and `rotationY` the model sent.
  - The hood is no longer placed half a width off. In this run's two hood prompts the model did not
    send one: the rules have no hood recipe without wall units —
    [open issue 5](../backlog/mcp-test-open-issues.md#5-a-range-hood-without-wall-units-has-no-docking-recipe).
