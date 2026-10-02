# Refactoring Analysis: Simplify the docking for the agent in `create-or-replace-groups`

> **Type**: Refactoring Analysis
> **Domain**: hi-mcp — creating a group from scratch with `create-or-replace-groups`: its payload, the served rules (`hi-mcp-server.ts`) and the preparation of a group (`tool-executors.ts`). Read only: the planner's docking (roomle-ui `homag-intelligence/src/model/oc-scripts-domain.model.ts` `PosContextData`, `hi-root-module-arrangement.ts`) and the kernel's docking rules (RoomleCore)
> **Trigger**: [RML-18038](https://roomle.atlassian.net/browse/RML-18038) — "Is the docking mechanism too complicated for the agent? Should it be replaced with something simpler? … The complicated contextData could be created by a script on the server. … groups can be a combination of floor cabinets, wall cabinets and high cabinets … corner articles, which form an L- or U-shape. Articles can also be stacked."
> **Date**: 2026-10-02
> **Author**: AI Assistant
> **Status**: Open
> **Branch**: `refactor/simple-group-layout`
> **Code read**: roomle-hi-example `a6bf1af` (`master`); roomle-ui `93f750abd` (`master`); RoomleCore `561ddd77f` (`feat/curved-walls-wall-curve`): `src/shared/core/docking-vector.h`, `docking-vector-validation.h`, `docking-vector-alignment.h`, `documentation/homag-intelligence/docking-vectors-guide.md`
> **Evidence**: the three-model run `mcp-test-2026-10-02_13-47-02` (17 tests each, `docs/test-prompts.json`), stored under `.temp/result/`

## Problem

To create a group, the agent writes the planner's docking format, `PosContextData`, on every root
of `create-or-replace-groups`. The ticket asks two things:

- Is this format too hard for a lightweight model?
- Could the tool take a simpler structure, from which the server builds `contextData`? It still has
  to cover floor, wall and tall cabinets, L and U corners and stacked units in one group.

**Answer in short.** It is too hard, but in a narrow way:

- Lightweight models build rows and corners correctly.
- They cannot write the stacked units: wall cabinets and the hood.
- The weakest model cannot write the format at all.

All 206 docking entries the three models wrote in the test run reduce to five relations between
two units. A flat list in which each unit names one neighbour and one relation covers every shape
the ticket names, and the server can compile it to `contextData` ([Target shape](#target-shape)).
This includes:

- **stacking**: one unit on top of another, docked Top to Bottom, chained to any depth;
- **wall cabinets beside a tall cabinet**: docked to the tall cabinet's Top vectors, which gives
  them their height without any gap;
- **tabletops** over floor cabinets: multi-vector articles whose inner vectors only the vector index
  tells apart;
- **independent clusters**: floor and wall cabinets in one group without a docking between them.

Vertical docking vectors are ignored.

## What the agent assembles today

For one group, from the rules served by `get-authoring-rules` (`AUTHORING_RULES`,
`hi-mcp-server.ts:6-63`):

| Level | What the agent writes | Where it gets it |
|---|---|---|
| Group | `libraryId`, `placement { posGroup, posRotationY, rootId? }` | walls array: `end`, `start`, `lengthMm`, `facingRotationY`; the corner table; arithmetic with the group width |
| Root | `id` (own choice), `articleId`, `attributes [{ id, value }]` | catalog, `masterData`, `find-attributes` |
| Docking entry | on the **placed** root: `contextData.dockedRoots[{ ownDockingVector, dockedRoots[{ id, dockingVector, mode, offset [x, y, z] }] }]` | the vector names of the catalog, the pair table, the mode and offset rules |

A docking entry is the hard part. For every unit after the first, the agent decides:

1. **On which root** to write it — the neighbour, not the unit itself. "An offset only takes effect
   in this direction - an entry written on the new root loses it."
2. **Two levels of nesting** — a docking context per own vector, an entry per docked root.
3. **The own vector and the partner vector** — from a table of five pairs plus the hood, with
   unit-local Left and Right.
4. **The mode** — one of four.
5. **The offset** — three numbers, of which `y`, the gap below a wall unit, appears nowhere in the
   catalog or the rules ("offset [0, <gap between the top of A and the bottom of W>, 0]").
6. **The graph rules** — every root reachable from the first root, one neighbour per place on a side
   vector, no ring.

The rules spend about 5,700 of their 15,400 characters on docking, and examples 1–3 and 5 (another
4,000) are mostly docking. In `tool-executors.ts`, about 500 of the 1,853 lines repair docking
input: `dockingNeighbours` … `completeDockingEntries` (`:407-990`), with the guards and corrections
G7, G8, G23–G26, G29, C3, C8 and C13 of
[the behaviour reference](../../hi-mcp/docs/hi-mcp-behaviour.md#83-create-or-replace-groups).

## Evidence: three models, 17 tests each

The run `mcp-test-2026-10-02_13-47-02`
([report](../../.temp/result/mcp-test-2026-10-02_13-47-02/report.md)):

| Model | Pass / partial / fail | Largest group it built | Units on top it docked | Corrections |
|---|---|---|---|---|
| gpt-6-astra | 17 / 0 / 0 | 21 roots, 19 entries | 30 entries in 7 tests | none |
| gpt-5-mini | 12 / 3 / 2 | 8 roots, 7 entries | 1 (the hood of test 04) | 1 run |
| gpt-5.4-mini | 7 / 6 / 4 | 9 roots | 7, in 2 tests | 6 runs |

What each model gets wrong:

- **gpt-5-mini docks rows and corners correctly** (01–05, 07–09, without docking corrections except
  08). It **never builds a wall cabinet**:
  - in 07 and 09 it leaves out the wall cabinets and the hood of the photo;
  - on the two prompts that need them — the image-1 kitchen (06, twice) and the full kitchen with
    wall cabinets (10) — it went silent after `get-authoring-rules` and sent nothing for 600 s.

  What it did in those minutes is not logged ([open issue 17](../backlog/mcp-test-open-issues.md#17-a-chat-turn-without-an-answer-for-10-minutes)),
  so the cause is a **hypothesis**: the stacked part is what it cannot compose — a second level of
  docking with a gap it cannot know.
- **gpt-5.4-mini cannot write the format.**
  - It sends roots with no docking at all (01, 03, 06, 10).
  - It writes units inside a neighbour's docking entry (07, 10; G23).
  - It omits `dockingVector` (11 entries; G24).
  - Wall cabinets docked to floor side vectors stand on the floor (issue 10).

  Each of these is a unit and its neighbour written in one place, the way it wanted to say it.
- **gpt-6-astra writes the format correctly, but guesses the gap**: its wall-unit offsets are 600,
  650, 660 and 700 in different runs. Only 660 hangs a Furniture_Smith wall unit at the height of the
  tall units (issue 10's measurement).
- **No model docks a wall cabinet to a tall cabinet.** All 38 entries on a Top vector are
  `LeftTop → LeftBottom` on a base unit:
  - 32 with a guessed gap: 600 ×15, 650 ×14, 660 ×2, 700 ×1;
  - 6 without one.

  Wall cabinets are docked to tall cabinets with the Top vectors — `tall.RightTop → LeftTop`
  aligns their top edges and hangs the wall cabinet at 1480 mm without a gap (issue 10). The served
  rules do not name this pairing: an instruction gap today, which the target shape closes by
  choosing the pairing in the server.

**What the models write, reduced.** The 35 stored `create-or-replace-groups` calls, converted with a
script (each entry → a relation on the docked unit):

| Relation | Docking pair | Entries |
|---|---|---|
| right of | `RightBottom → LeftBottom` | 126 |
| left of | `LeftBottom → RightBottom` | 39 |
| above (hanging, `y` gap) | `*Top → *Bottom`, offset `[0, gap, 0]` | 32 |
| on top (standing) | `*Top → *Bottom`, no offset | 5 |
| behind (back to back) | `BackBottom → BackBottom` | 4 |
| — | entries without `dockingVector`, completed by the server (G24) | 11 |

- No model used a mode other than `StartStart`.
- Only two entries carry an `x` offset, both on a back-to-back pairing.
- The payload shrinks to 30–45 % for the row and corner kitchens: gpt-5-mini 09 1,472 → 478
  characters, gpt-6-astra 03 1,745 → 696. It shrinks less where attribute overrides dominate:
  gpt-6-astra 08 6,962 → 5,056.

## Root cause

By [Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort), wrong content is an
instruction or API problem. Here it is the API (step 2): the format makes the agent **encode what
the server can derive**. The server knows each article's category, docking vectors and size. From a
relation such as "w1 hangs above b1", it can derive:

- the vectors;
- the mode;
- the root the entry goes on;
- the direction in which the offset takes effect;
- the gap.

In the kernel, `contextData` is not an authoring format at all. It is "read-only output — you do
not set it in the input JSON": the kernel computes it from the docking vectors that coincide
geometrically (RoomleCore `documentation/homag-intelligence/docking-vectors-guide.md`, "Group
Structure Output"). The MCP server asks the agent to write by hand what the kernel derives.

The current trajectory goes the other way. Eight of the 17 open issues — 2, 3, 5, 7, 10, 13, 14,
15 — each add or fix a docking correction. The relation format makes most of these mistakes
impossible to write.

## Can a simple structure cover every shape?

The planner arranges a group from its docking breadth-first (`hi-root-module-arrangement.ts:825-895`).
Every unit is placed through one docking to a unit that is already placed, and further entries to
an already placed unit are skipped (`:848`). One relation per unit is therefore all the arrangement
needs:

| Shape | Written as | Compiled to |
|---|---|---|
| a row | each unit `rightOf` the one before | `RightBottom → LeftBottom` |
| an L corner | a corner article; one leg `rightOf` it, the other `leftOf` it | the corner's `RightBottom` / `LeftBottom`; the corner table of the rules holds unchanged |
| a U | the second corner article `rightOf` the last unit of a leg, the third leg `rightOf` it | as a row; `placement.rootId` as today |
| tall cabinets in the row | like any unit | as a row |
| **wall cabinets beside a tall cabinet** | `rightOf` / `leftOf` the tall cabinet | `tall.RightTop → LeftTop` / `tall.LeftTop → RightTop`: the top edges align, and the wall cabinet hangs at the tall cabinet's top line without a gap |
| further wall cabinets, the hood | `rightOf` / `leftOf` each other | `RightBottom → LeftBottom` |
| wall cabinets without a tall cabinet | the first `above` a floor unit | `LeftTop → LeftBottom` with the derived gap (Decision 1) |
| **stacking** — any article on any article, chained to any depth | `onTop: X`, optional `align: left` (default) / `right` / `back` | Top of X → Bottom of the unit: `LeftTop → LeftBottom`, `RightTop → RightBottom`, `BackTop → BackBottom` |
| **a tabletop bridging floor cabinets** | each cabinet `under` the tabletop, `at: left` / `right` (the end of the plate) | the cabinet docks to an **inner** vector of the tabletop (see below) |
| an island | the back row `behind` the front row | `BackBottom → BackBottom` |

Floor, wall and tall cabinets, corners, stacks and bridges can all appear in the same group.
Nothing nests, and there is no array of rows to keep in step with another.

**The kernel's pair rules agree** (RoomleCore `src/shared/core/docking-vector.h:75-86`, the
`dockingPairCapabilitiesArray`; `docking-vector-validation.h`, `ValidPairType`):

- **`SIDE_BY_SIDE`**: `RightBottom ↔ LeftBottom`, `RightTop ↔ LeftTop` (the wall cabinet beside a
  tall cabinet), `BackBottom ↔ BackBottom`, and the back vectors with the corner vectors. The back
  pairs are valid only reversed (`isOnlyValidIfReverse`): the unit is turned by 180°.
- **`TOP_TO_BOTTOM`** (stacking): `LeftTop ↔ LeftBottom`, `RightTop ↔ RightBottom`,
  `BackTop ↔ BackBottom`.
  - The pairs are valid in both directions. A unit docked under another is tested
    (`test/planner/configurable/plan-external-configuration-dock-test.cpp:1220-1245`).
  - Two-level stacks are tested (`plan-external-configuration-docking-vector-test.cpp:601-743`);
    a chain of three is not.
  - The corner vectors (`LeftBackTop`, …) have no stacking pair.
- **`SIDE_BY_SIDE_MULTI_VECTOR`**: active when an article has several vectors of the same name.
  It adds `BackBottom ↔ LeftBottom` / `RightBottom` — the "wrap-around pairs".
- **A docking needs the vectors to touch** (`docking-vector.h:787-794`). An offset shifts a unit
  along the vector, for example to centre a narrower unit. It cannot express a gap: a wall cabinet
  hanging 660 mm above a base unit is not docked to it, and neither is a unit standing at a gap in a
  row.

### Tabletops: multi-vector articles

A HOMAG tabletop (DeMaat `DMF_TableTopDesk_011`: 2000 × 620 × 750 mm, one leg) carries a second
`LeftBottom`/`LeftTop` and `RightBottom`/`RightTop` pair on the inner faces of its ends. A cabinet
under the plate docks with its Top vectors to the plate's Bottom vectors (`RightTop → RightBottom`,
`BackTop → BackBottom`). Turned by 90°, it docks with its `BackBottom` to an inner `LeftBottom`
(the wrap-around pair). Sources:

- RoomleCore `documentation/bug-analysis/hi-tabletop-not-docked-over-cabinet-at-wall.md`
  (RML-16056);
- `test/planner/configurable/plan-external-configuration-dock-test.cpp:638-892` and `:2925-3060`;
- `test/test-helper/article-definitions.cpp:1863-1935` (`createTableTop`).

So an article can have **two vectors of the same name**, which only the index tells apart.

- **Today the agent cannot say which one.** It writes vector names only, and the server strips the
  indices (C3). The planner resolves a name that matches two vectors to no index — "Cannot
  reproduce dockingVectorIndex …" (`hi-root-module-arrangement.ts:596-611`) — and does not arrange
  that entry. This follows from the code; it is not reproduced, because Furniture_Smith has no
  multi-vector article.
- **In the relation format**, the agent says which end the cabinet stands under (`at: left` /
  `right`). The server picks the inner vector by its position and sends the index. The vectors come
  from the calculated article, from a probe load as for the anchor today.

The worktop and the toe kick of Furniture_Smith are something else: generated roots without docking
vectors, which never dock (C1).

### Floor and wall cabinets as independent clusters

A group may hold clusters that are not docked to each other, for example the floor cabinets and
the wall cabinets (RoomleCore
`test/configurator/external/external-object-group-strcuture-test.cpp:179-204`).

For a new group, the placement positions the group. `create-or-replace-groups` generates the
group's `repositioningData` from it: `posGroup`, `posRotationY`, and the `rootRelPos` /
`rootRelRotationY` of the anchor root (C6, `toRepositioningData` in `group-placement.ts`). The
docking positions the roots within the group, so the wall cabinets are placed through the docking
too. A wall cabinet docked
with an offset hangs where the offset puts it. Because the kernel
docks only vectors that touch, it is no longer docked after the load: it becomes a cluster of its
own. gpt-6-astra 10 shows it:

- the agent sent four wall cabinets docked on base units' `LeftTop` with `[0, 650, 0]`;
- after the load, the planner's group has three clusters: the floor row, `w1`–hood–`w2`, and
  `w3`–`w4` (`plan-context.json` of the run).

In the relation format the agent writes `above: X`, where the wall cabinet hangs, and the server
compiles the offset docking. The independent cluster is the result, as today.

## Target shape

The root keeps its fields and gains one relation instead of `contextData`:

```json
{ "libraryId": "Furniture_Smith",
  "placement": { "posGroup": [4815, 0, -3765], "posRotationY": 270 },
  "roots": [
    { "id": "c1", "articleId": "<corner article>" },
    { "id": "b1", "articleId": "UTB60", "rightOf": "c1" },
    { "id": "s1", "articleId": "SUT60", "rightOf": "b1" },
    { "id": "t1", "articleId": "H2TB60", "rightOf": "s1" },
    { "id": "l1", "articleId": "UTB60", "leftOf": "c1" },
    { "id": "w1", "articleId": "OTB60", "leftOf": "t1" },
    { "id": "h1", "articleId": "DU", "leftOf": "w1" },
    { "id": "w2", "articleId": "OTB60", "leftOf": "h1" },
    { "id": "a1", "articleId": "<top unit>", "onTop": "t1" }
  ] }
```

Here w1 docks to the tall cabinet's `LeftTop` and hangs at its top line. The hood and w2 continue
the wall row, and a1 stands on the tall cabinet. `rightOf` and `leftOf` mean as seen from the
front of the units, as the Left and Right vectors do today.

| Relation | Kernel pair, between the unit and X | Note |
|---|---|---|
| `rightOf: X` | `X.RightBottom ↔ LeftBottom` | side by side; one neighbour per side vector |
| `rightOf: X`, a wall cabinet beside a tall cabinet | `X.RightTop ↔ LeftTop` | the top edges align: the wall cabinet hangs at the tall cabinet's top line |
| `leftOf: X` | `X.LeftBottom ↔ RightBottom`; beside a tall cabinet `X.LeftTop ↔ RightTop` | mirrored |
| `onTop: X` | `X.LeftTop ↔ LeftBottom`; `align: right` → `RightTop ↔ RightBottom`; `align: back` → `BackTop ↔ BackBottom` | **stacking**: any article on any article, chained to any depth. The upper unit may be narrower. `gapMm` lifts it. A back vector takes several units |
| `above: X` | `X.LeftTop ↔ LeftBottom`, offset `[0, gap, 0]` | a wall cabinet hanging above a floor unit where no tall cabinet gives the height; the gap is derived (Decision 1) |
| `under: X`, `at: left` / `right` | X's inner vector ↔ the unit's Top vector, or its `BackBottom` when turned (wrap-around pair) | a cabinet under a tabletop (multi-vector article); the server picks the vector index |
| `behind: X` | `X.BackBottom ↔ BackBottom`, reversed | an island |

**Vertical docking vectors are ignored.** `VerticalLeftBack` and the other `Vertical*` vectors are
auto-generated by the kernel, and roomle-ui's arrangement does not support them
(`hi-root-module-arrangement.ts:865-871`). No relation compiles to one. The same holds for
`Socket`, `Plug` and `CollisionBox`.

An optional `gapMm` lifts a unit on `onTop` and `above`. The planner adds an offset as a
translation in the group's frame (`hi-root-module-arrangement.ts:384-390`), so only a vertical gap
can be derived safely. On a turned leg of a corner kitchen, `x` is not the direction of the row,
so a gap in a row stays a filler article. Everything else is completed by the server, and the
defaults are reported in `corrections`:

- **A unit without a relation** goes `rightOf` the previous unit of its kind in the list: the
  previous floor unit, or the previous wall unit.
  - The first wall cabinet without a relation docks beside a tall cabinet of the group by its Top
    vectors.
  - With no tall cabinet in the group, it goes `above` the floor unit at the same list position.
  - The list order replaces G7's free-end-of-the-row search, which caused issue 15.
- **A relation that closes a ring** is dropped (issue 3).
- **Two units `rightOf` the same unit**: the later one goes to the free end of the row (D29). The
  relation names the side, so issue 2 cannot occur.
- **A floor unit `above` a floor unit** is docked `rightOf` it (issue 14).
- **The vectors come from the relation.** On an empty plan the catalog lists no docking vectors
  (`articleDockingVectors`, `tool-executors.ts:624-631`), so the server uses each relation's
  standard vectors. It checks them where the catalog lists them. `behind` a corner article, which
  has no `BackBottom`, falls back to the default (issue 7).
- **The direction of each entry.** The planner adds the reciprocal of every entry with the mode
  mirrored and without the offset (`hi-root-module-arrangement.ts:621-705`). The server therefore
  writes each entry on the root the arrangement reaches first, so an offset always takes effect.

**`contextData` stays accepted, but the rules no longer teach it.** Existing payloads keep working,
and a group may mix both: the server compiles the relations and then runs the existing preparation
on the result.

**Where the code changes.** A new module, `hi-mcp-poc-json/group-layout.ts`, holds
`relationsToDocking(roots, articles)`. It runs in `prepareGroup` (`tool-executors.ts:1054`), before
`dropMalformedDocking`. `findAnchorRoot` (`group-placement.ts:91`), the probe and the planner are
unchanged: they see the same `contextData` as today.

## Alternatives considered

| Option | Why not |
|---|---|
| **Keep `contextData`, add corrections** (open issues 2, 3, 5, 7, 10, 13–15) | Each fix repairs one mistake after the agent made it. The agent still writes the nesting, the pair, the direction and the gap. The guideline asks to simplify the API before correcting |
| **Runs as arrays** (`runs: [{ units: [...] }, { above: 2, units: [...] }]`) | Natural for a single row. Wall units, corners between runs, tall units that break the wall row, stacking and islands each need their own field or index, and the nesting comes back |
| **The server lays out the kitchen** from a list of articles and a wall | The order, the corner side and the wall units are the user's intent. The server would have to guess them |
| **Only the stacked units** (`above` / `onTop` on a root, `contextData` for the rest) | Fixes gpt-5-mini's gap but not gpt-5.4-mini's format errors. It also leaves two ways to write one group in the rules |

## Scope

| File | Change |
|---|---|
| `hi-mcp/hi-mcp-poc-json/group-layout.ts` (new) | `relationsToDocking` and the defaults above |
| `hi-mcp/hi-mcp-poc-json/tool-executors.ts` | the compile step in `create-or-replace-groups` after `resolveArticleIds` (`:1482-1485`); `ROOT_FIELDS` (`:843`) and `toArticlePick` (`:65-78`); `sidePartnersOf` (`:488-515`, open issue 2); `WALL_UNIT` (`:619`) |
| `hi-mcp/hi-mcp-poc-json/group-placement.ts` | `dockingRelations` (`:50-81`): Top-Top side pairs for the anchor walk |
| `hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts` | `AUTHORING_RULES`: the docking bullets, the recipes and examples 1–3 become the relation table. `INSTRUCTIONS` step 2. The `create-or-replace-groups` description (`:216-243`) |
| `hi-mcp/hi-mcp-poc-json/tests/` | new `group-layout.test.ts`; `tool-executors.test.ts`; `hi-mcp-server.test.ts` (served text) |
| `hi-mcp/docs/hi-mcp-behaviour.md` | a new decision; §5.2, §6 `create-or-replace-groups`, §8.3 (the new defaults; G23–G25 and G29 apply to `contextData` only) |
| `minimal-hi-example/docs/hi-mcp-server.md`, `.agents/skills/hi-mcp-tools.md`, `hi-authoring-rules.md`, `roomle-hi-concepts.md` | the payload format |
| `.agents/backlog/mcp-test-open-issues.md` | issues 2, 3, 7, 13, 14 and 15 are closed by the format; 5 and 10 depend on Decision 1 |

Out of scope: the planner (roomle-ui) and RoomleCore — the planner keeps receiving `contextData`.

## Open decisions (for the review)

1. **The hang height of `above`.** It is needed only where no tall cabinet gives the height: beside
   a tall cabinet, the Top vectors hang a wall cabinet at its top line. The server needs one value
   per library. This is the same open decision as issue 10:
   - the top of the tall units (Furniture_Smith 2200, so gap = 2200 − 720 − 820 = 660);
   - the library's wall height lines (`mod_WallHeightLines`);
   - a value per library.

   With an explicit `gapMm` on `above`, the agent can override it.
2. **`contextData` input**: accepted silently (recommended) or reported as a correction.
3. **How the wall-unit kind is read**: `isWallUnit` matches the category with `/\bwall units?\b/i`
   (`tool-executors.ts:619`). The Living category is spelled "Living | Wallunits" (7 articles) and
   does not match. The relation defaults depend on the kind, so check this before relying on it.
4. **Tabletops need a live check with a library that has them.** Furniture_Smith has none. The check
   uses DeMaat (`DeMaatFabriek_CabinetLibrary`, backend
   `HI_PRE_HOMAG_TecConfig_Library_Development_DeMaat`). It confirms which inner vector `under`,
   `at: left` / `right` maps to.

## Verification before the implementation

The cause of gpt-5-mini's silence is not proven, so measure it before the work, without a planner:

- **An A/B run.** Give gpt-5-mini the prompts of tests 06 and 10 with the tool schema and the rules
  in both formats. Record the time to the first `create-or-replace-groups` call, the size of the
  payload, and whether wall units and the hood are in it. The chat backend can run it against a stub
  of the tool.
- **The logging of issue 17.** Reasoning tokens and the size of the tool input per step show where
  the 600 s go.

If gpt-5-mini builds the wall units in the relation format and the current format still stalls, the
hypothesis holds.

## Implementation plan

Phase 1 covers every relation except `under`. `under` (tabletops) is phase 2, after the live check
of Decision 4. Each step ends with its check.

1. **Gate: the A/B run** ([Verification before the implementation](#verification-before-the-implementation)).
   If gpt-5-mini stalls in both formats, the format is not the cause, and the plan stops here.
2. **`group-layout.ts`** (new; pure functions, no planner call). Check: `group-layout.test.ts`.
   - `RELATIONS`: `rightOf`, `leftOf`, `onTop`, `above`, `behind`. The options are `align`
     (`left` default, `right`, `back`) and `gapMm` (for `onTop` and `above` only).
   - `unitKind(article)`: `wall`, `tall` or `floor`. It is read from the catalog category
     (`/\bwall ?units?\b/i`, `/\btall ?units?\b/i`), and for the hood from the module id
     (`/hood/i`).
   - `hangGap(wall, carrier, group, articles)` (Decision 1, proposed):
     - the `mod_Height` of a tall unit of the group, else of the library's tall units in the
       catalog, minus the wall cabinet's and the carrier's `mod_Height`;
     - never below 0;
     - Furniture_Smith: 2100 − 720 − 720 = 660. The plinth cancels out, because base and tall
       units stand on the same plinth.
   - `relationsToDocking(group, articles, prefix, corrections)`:
     1. **Read** one relation per root. A second relation field is reported and ignored.
     2. **Fall back** to the default for a relation to an unknown id, to the root itself, or one
        that closes a ring (union-find in list order). Each is reported.
     3. **Add the defaults** for roots without a relation ([Target shape](#target-shape)). The first
        wall cabinet without a relation docks to a tall cabinet of the group by the Top vector on
        the side where the floor row continues.
     4. **Continue the row** when two units are `rightOf` / `leftOf` the same unit: the later one
        goes to the end of that row, reported (D29).
     5. **Correct the intent**, each reported: a floor unit `above` a floor unit becomes `rightOf` it; a wall cabinet `rightOf` / `leftOf` a base unit becomes `above` it (issue 10: wall cabinets on floor side vectors); `behind` a corner article falls back to the default; `gapMm` on a side relation is ignored.
     6. **Write the entries.** The tree is oriented breadth-first from the first root, the order
        the planner arranges in. Each entry goes on the root reached first: `ownDockingVector`,
        `id`, `dockingVector`, `mode` (`StartStart`, none for `behind`) and `offset`. A relation
        whose target is reached later is written mirrored on the unit, with the offset negated.
     7. **Delete** the relation fields.

     8. **Return errors** only for what cannot be compiled at all, none expected in phase 1. Such a
        group goes to `notLoaded` (D30).
3. **`tool-executors.ts`.** Check: `tool-executors.test.ts`, with every existing test green.
   - `ROOT_FIELDS` (`:843`) gets the relation fields and options, so G27 does not report them;
     `toArticlePick` (`:65-78`) carries them to the compile.
   - In `create-or-replace-groups`, `relationsToDocking` runs through `keepBuildable` right after
     `resolveArticleIds` (`:1482-1485`), because it needs the catalog. That is before
     `reportUnsentRoots` and `completeDocking`. The placement, the probe and the load stay as they
     are.
   - `sidePartnersOf` (`:488-515`) counts a pairing as side neighbours only when both vectors are
     side vectors (open issue 2). The compile writes `onTop` pairs onto `LeftBottom`, so without
     this fix the side correction would move the neighbour of a stacked unit.
   - `WALL_UNIT` (`:619`) becomes `/\bwall ?units?\b/i`, so the Living wall units ("Living |
     Wallunits") count as wall units (Decision 3). `unitKind` uses the same expression.
4. **`group-placement.ts`, `dockingRelations`** (`:50-81`). `RightTop → LeftTop` and
   `LeftTop → RightTop` count as side neighbours, like the Bottom pairs. Otherwise the anchor walk
   stops at a wall cabinet docked to a tall cabinet. Check: `group-placement.test.ts`.
5. **Served text, `hi-mcp-server.ts`.** Check: `hi-mcp-server.test.ts`.
   - In `AUTHORING_RULES`, the root becomes `{ id, articleId, attributes?, <relation>? }`.
   - The four docking bullets (`Docking (contextData)…`, `Docking vectors are named edges…`,
     `mode selects…`, `Recipes…`) become one bullet with the relation table and the defaults.
   - Examples 1–3 use relations; example 2 shows wall cabinets beside a tall cabinet and above
     base units. Examples 4 (placement) and 5 (`merge-article-into-group`) stay.
   - One sentence stays for groups read from `get-plan-context`: their docking is `contextData`,
     and they are resubmitted as they are. `merge-article-into-group` and its `dockTo` are
     unchanged (out of scope).
   - `INSTRUCTIONS` step 2 and the `create-or-replace-groups` description (`:216-243`) name the
     relations instead of "the placed root names the new root by its id".
6. **Docs, in the same change.**
   - `hi-mcp/docs/hi-mcp-behaviour.md`:
     - decision D34, the relations;
     - §5.2;
     - §6 `create-or-replace-groups`, with the compile as a new step;
     - §8.3: the compile's corrections as new rows, G23–G25 and G29 for `contextData` only, G8
       with the issue 2 fix.
   - `minimal-hi-example/docs/hi-mcp-server.md`, `.agents/skills/hi-mcp-tools.md`,
     `hi-authoring-rules.md` (the patterns), `roomle-hi-concepts.md`.
   - `.agents/backlog/mcp-test-open-issues.md`:
     - issue 2 fixed;
     - 3, 13, 14 and 15 fixed for relation payloads, still open for `contextData`;
     - 10 depends on Decision 1.
7. **Live check, then "test the mcp"** ([testing skill](../skills/hi-mcp-testing.md)).
   - Live, headless against the example page:
     - a row with wall cabinets beside a tall cabinet: the wall cabinets' bottom at y 1480;
     - wall cabinets above base units without a tall cabinet: y 1480 from the derived gap;
     - a stack of three;
     - an L corner;
     - an island.
   - "test the mcp" with the three models, with the acceptance below.

**Phase 2: `under` (tabletops)**, after the live check of Decision 4.

- The probe also calculates the tabletop's docking vectors.
- `relationsToDocking` picks the inner vector by its position and writes `ownDockingVectorIndex` /
  `dockingVectorIndex`.
- `toArticlePick` keeps the indices of compiled entries; C3 strips them today.

## Unit test plan

**`tests/group-layout.test.ts`** (new), with catalog fixtures from Furniture_Smith: `UTB60` (base,
720), `H2TB60` (tall, 2100), `OTB60` (wall, 720), `UERTB90` (corner), `DU` (hood, `mr_Hood`) and a
Living wall unit.

| Test | Expectation |
|---|---|
| `rightOf` / `leftOf` | the target carries `RightBottom → LeftBottom` / `LeftBottom → RightBottom`, `StartStart`, offset 0; no relation field is left |
| a wall cabinet `rightOf` / `leftOf` a tall cabinet | `RightTop → LeftTop` / `LeftTop → RightTop` |
| a wall cabinet beside a wall cabinet, the hood beside a wall cabinet | the Bottom side pair |
| `onTop` with `align` left / right / back | `LeftTop → LeftBottom` / `RightTop → RightBottom` / `BackTop → BackBottom`; `gapMm` becomes `[0, gap, 0]` |
| a chain of three units `onTop` | each on the one below |
| two units `onTop`, `align: back`, on one unit | both on its `BackTop`, no correction |
| `above` a base unit, with a tall unit in the group | offset `[0, 660, 0]` |
| `above` a base unit, without a tall unit in the group | the library's tall-unit height: `[0, 660, 0]` |
| `above` with `gapMm` | the given gap |
| `above` a tall cabinet | gap 0: it stands on it |
| `behind` | `BackBottom → BackBottom`, no mode |
| the first root names its neighbour (`rightOf` a later unit) | the entry is written mirrored on the first root; for `above`, with the offset negated |
| shapes: a row, an L corner, a U with two corners, an island | the expected `contextData` per root |
| the kitchen of gpt-6-astra 10, written with relations | the `contextData` the model sent, with the derived gap 660 instead of 650 |
| no relation: a floor unit; a wall cabinet with and without a tall cabinet | `rightOf` the previous unit of its kind; beside the tall cabinet; `above` the floor unit at the same list position. Each is reported |
| an unknown target, the root itself, a ring | the default, reported |
| two units `rightOf` one unit | the later one continues the row, reported |
| a floor unit `above` a floor unit; a wall cabinet `rightOf` a base unit | `rightOf` it; `above` it. Both reported |
| `behind` a corner article; `gapMm` on `rightOf`; two relation fields | the default; ignored; the first kept. Each reported |
| a Living wall unit | counted as a wall unit |
| a root with `contextData` and no relation | its entries are untouched |

**`tests/tool-executors.test.ts`:**

| Test | Expectation |
|---|---|
| a relation payload | `loadExternalObjectGroupLayout` receives `contextData` and no relation fields |
| relation fields | not reported as unused (G27) |
| a relation default | listed in `corrections` |
| a placed relation payload | the anchor is the left end of the floor row; `repositioningData` as for the same `contextData` today |
| issue 2: a unit on `LeftTop` without an offset, with a neighbour on the stacked unit's `LeftBottom` | loads unchanged, without a correction |
| `contextData` payloads | every existing test green |

**`tests/group-placement.test.ts`:** a wall cabinet docked `RightTop → LeftTop` to a tall cabinet is
a side neighbour in `findAnchorRoot`. A group started from it anchors at the left end of the floor
row.

**`tests/hi-mcp-server.test.ts`:**

- the rules contain the relation table and the new examples;
- the rules and the `create-or-replace-groups` description contain no `ownDockingVector` and no
  `<gap` placeholder; the `merge-article-into-group` description still does;
- "carries the one-group principle and the docking examples" and the hood test use the relation
  snippets;
- the checks for no rejections and no internals stay unchanged.

**Acceptance in "test the mcp"** with the three models:

- gpt-5-mini builds tests 06 and 10 with wall units and a hanging hood within the time limit;
- gpt-5.4-mini's docking corrections drop;
- gpt-6-astra stays at 17 passes;
- every wall unit hangs at y 1480.
