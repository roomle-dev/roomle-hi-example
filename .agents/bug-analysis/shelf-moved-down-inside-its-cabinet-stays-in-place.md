# Bug analysis — a shelf moved down inside its cabinet stays in place

> **Type**: Bug analysis
> **Status**: Open
> **Date**: 2026-10-20
> **Base**: roomle-hi-example `master` (`ea89c3b`); roomle-ui `origin/release/bo-test` (`728317a91`),
> the only branch with the interior fitting tools — the local `feat/interior-fittings` lacks
> `9ed4f3c9a`
> **Test**: `edit-move-subarticle` of [test-prompts.json](../../docs/test-prompts.json), and turn 2 of
> `edit-add-move-delete-subarticle`

## Affected repositories

- **roomle-ui** — `packages/web-sdk/packages/homag-intelligence/src/hi-interior-design.ts`: the
  measured position of a fitting (`interiorFittings`) and the settings copy of a move
  (`stageInteriorEdit`), with its two placement checks; unit tests in
  `homag-intelligence/__tests__/hi-interior-design-test.ts`. Implementation base
  `origin/release/bo-test`.
- **roomle-hi-example** — the served frame of `insertPosition` and of the discovered positions
  (`hi-mcp/hi-mcp-server/hi-mcp-server.ts:205` and `:216`); the Interior Design section of
  [hi-mcp-behaviour.md](../../docs/hi-mcp-behaviour.md#interior-design-tools),
  [interior-fittings.md](../context/interior-fittings.md) and the tool skill. No server logic
  changes: the plan-changing tool runs in roomle-ui.
- **HI library** — unchanged. How it places a fixed shelf (below) is its intended behaviour.

## Symptom and reproduction

Plan `three-open-wardrobes-with-shelves` (`ps_sbga21bftgc6paechjqf8x5qbk538sp`), prompt "move the
shelf inside the middle cabinet down by 500 mm". The shelf does not move; the agent reports that
the move failed.

Reproduced without a model on 2026-10-20 against the deployed bo-test planner: the launcher without
`--dev` (`EXAMPLE_PORT=3001 HI_MCP_PORT=3110 node minimal-hi-example/start.mjs --no-open`), headless
Chromium and the MCP SDK client. Scripts and outputs:
`.temp/result/issue-interior-fitting-move-2026-10-20/` (git-ignored). Every call starts from the
fresh plan.

| # | Call | Result |
|---|---|---|
| a | `move-interior-fitting` of the middle shelf `19d07551…`, `insertPosition` = its discovered position − 500 mm in y: `[19, -480.5, -533]` | error `The library could not calculate the edited interior.`; plan unchanged |
| b | the same move with the point in the library's frame (below): `[303, 1179, -533]` | `changed: false`; correction `The library placed fitting '9c8216c6-…' at [19,19.5,-533] instead of the requested [303,1179,-533].` — `9c8216c6` does not exist afterwards; the shelf keeps its id and `mod_ShelffixedPosY` 1679 |
| c | `add-interior-fitting` of a `FixedShelf` into the middle cabinet at `[300, 800, -300]` | `changed: true`; the new shelf carries the inputs `mod_ShelffixedPosX` 300 and `mod_ShelffixedPosY` 800 and stands at that height — and the result still says the library placed it at `[19,19.5,-533]` instead of the requested point |
| d | the same add into the **upper** compartment at `[300, 100, -300]` | the board stands 100 mm above the interior's bottom, not above the compartment's |

Both points an agent can derive fail: from the discovered position (a) and from the shelf's
attributes (b). No model run was made for this analysis; the user's run stored no result, so its
exact payload is unknown.

## How the library places a fixed shelf

Measured in the middle cabinet (`getExternalObjectGroups()`, root-local millimetres):

| Module | `positionRelativeToRoot` | Size | Note |
|---|---|---|---|
| parent `8000c16b…` (the interior) | `[0, 100, 561]` | | holds the shelf module and the containers |
| shelf module `me_Shelffixed01` | `[19, 119.5, 28]` | `mod_Height` 2061 | the whole interior; the same origin for every shelf |
| its part `part_Shelffixed` | translation y 1798.5 | 562 × 19 × 533 | the board |
| lower container | `[19, 119.5, 28]` | height 1679 | below the board |
| upper container | `[19, 1817.5, 28]` | height 363 | above the board |

- The shelf module stays at the interior's origin; the board stands at module origin +
  `mod_ShelffixedPosY` (119.5 + 1679 = 1798.5; the left shelf 119.5 + 1646 = 1765.5).
- `addSubArticle` turns the insertion point into the inputs `mod_ShelffixedPosX` = x and
  `mod_ShelffixedPosY` = y (call c). The point is measured from the shelf module's origin — the
  interior's inner corner —, whichever container the destination names (call d).
- `mod_ShelffixedPosX` and `mod_ShelffixedPosY` are assigned attributes of `me_Shelffixed01` in the
  master data.

## Investigation trace

roomle-ui `origin/release/bo-test`, `homag-intelligence/src/hi-interior-design.ts`:

1. **Discovery** — `interiorFittings` (`:144-175`) reports a fitting's `position` as its module's
   `positionRelativeToRoot` minus its parent's (`:148-155`). For every fixed shelf that is
   `[19, 19.5, -533]`: the shelf module's origin, which says nothing about where the board is. The
   served text calls it a "parent-local calculated position" (`hi-mcp-server.ts:216`) and the
   insertion point "relative to parentModuleId" (`hi-mcp-server.ts:205`). An agent that moves the
   shelf down by 500 mm from there sends y = −480.5, 480.5 mm below the interior's bottom, and the
   calculated group carries an error: `stageInteriorEdit` throws at `:651-668` (call a).
2. **Move** — `stageInteriorEdit` removes the source (`:503-511`), takes the source's parent as the
   destination (`:529-541`) and adds the article at `edit.insertPosition` (`:555-573`): the library
   sets the placement inputs from the point. Then it copies every input setting of the source onto
   the new fitting (`:580-649`). `mod_ShelffixedPosX` and `mod_ShelffixedPosY` are inputs of the
   source and assigned attributes of the module (`:598`), the trial calculation keeps them, and the
   placement comparison (`:626-636`) passes because the module origins never change — so the old
   height 1679 overwrites the requested one.
3. **Checks** — `:709-722` compares the requested point with the new fitting's `position`, the
   module origin: it always differs, so every add and move with a point reports a library
   adjustment, also when the library honoured the point (call c). `:723-740` finds the replacement
   in the same parent with the same article, position and attributes and returns `unchanged()`
   (call b), together with the correction about the discarded temporary instance.
4. **The planner's own move** — `glue-logic.ts:3293-3329` (`_moveSubArticle`, the drag in the
   planner) deletes the fitting and adds it at the drop point without copying settings back, so the
   library's placement from the point stands.

## Root cause

1. **`hi-interior-design.ts:148-155`** — the measured position is the fitting module's origin
   relative to its parent, not the place of the fitting. A library that keeps the fitting module
   at the interior's origin and places its parts by the insertion point gives every fitting the
   same position, in a frame offset by that origin (`[19, 19.5, -533]`) from the frame the library
   reads the insertion point in. The
   agent cannot derive a point from it, and the served text (`hi-mcp-server.ts:205`, `:216`) tells
   it that this position and the insertion point share the parent's frame.
2. **`hi-interior-design.ts:584-648`** — the move copies back the settings the library derived from
   the insertion point, so an explicit `insertPosition` is overwritten by the source's place.
   Because of cause 1, the checks at `:709-722` and `:723-740` compare module origins and cannot see
   it: the move is declared a no-op and blamed on the library.

The transfer of `edit-move-subarticle`'s earlier prompt passed for the same reason: the copied
`mod_ShelffixedPosY` kept the shelf at its height in the other cabinet, and the new parent made
the call a change.

## Proposed fix

roomle-ui, on `origin/release/bo-test`:

1. **Measure the fitting's place in the insertion frame.** `interiorFittings` reports `position`
   from the fitting's calculated parts, measured from the fitting module's origin — the frame
   `addSubArticle` reads the insertion point in. The middle shelf then reports `[0, 1679, 0]`, and
   its position − 500 mm in y is the right point. The parts are already in the planner's
   calculated groups (D9 keeps them out of the plan context, not out of roomle-ui).
2. **Keep the placement the library derives from the point.** The settings copy of a move skips the
   inputs the library set on the new fitting while adding it at the point; it copies only the
   settings the new fitting carries at their calculated default. With fix 1 a move without
   `insertPosition` passes the source's measured place, so a transfer keeps the height without the
   copy.
3. **The checks compare real places.** With fix 1, `:709-722` reports an adjustment only when the
   library placed the fitting elsewhere, and `:723-740` returns `unchanged()` only for a real no-op —
   never with a correction about a discarded instance.

roomle-hi-example: the served text says that `position` and `insertPosition` share one frame, the
fitting's interior, and that a fitting moves by adding the offset to its position
(`hi-mcp-server.ts:205`, `:216`); the Interior Design section of
[hi-mcp-behaviour.md](../../docs/hi-mcp-behaviour.md#interior-design-tools),
[interior-fittings.md](../context/interior-fittings.md) and the tool skill say the same.
The expectations of the two tests already ask for "500 mm lower in y than the measured position".

**Unit tests** (roomle-ui `hi-interior-design-test.ts`, a fake library whose fitting module stays at
the interior's origin and whose part is offset by an input set from the insertion point):
discovery reports the part's offset; a move without destination at position − 500 mm in y changes
the placement input and keeps the other settings; a transfer without `insertPosition` keeps the
height; an add at a point the library honours reports no correction.

## Alternatives considered

- **Name the library's placement attributes in a served rule or report them as the position** —
  rejected: the served text and the server's logic are library-neutral, and the attribute ids are
  Furniture_Smith's.
- **Drop the settings copy, as the planner's drag does** — rejected: it keeps the explicit settings
  of a moved or replaced fitting (`9ed4f3c9a`); only the placement inputs must not be copied.
- **Reject an insertion point outside the interior** — a guard against a symptom; with fix 1 the
  agent derives points inside the interior.
- **An offset parameter for the move ("down by 500 mm")** — would let the tool derive the point
  (step 2 of [Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort)). It needs the
  measured place of fix 1 as well; a decision for the implementation plan.
