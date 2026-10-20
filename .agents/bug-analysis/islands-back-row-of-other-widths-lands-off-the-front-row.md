# Bug analysis — an island's back row of other widths lands off the front row

> **Type**: Bug analysis
> **Status**: Open — reproduced; compiler fix proposed, not implemented
> **Date**: 2026-10-18, re-evaluated 2026-10-20
> **Base**: roomle-ui `feat/hi-mcp-improvements` (`345824f2d`, the embedding-lib
> `0.0.0-dev-345824f` both clients pin); roomle-hi-example `master` (`85f2084`)
> **Backlog**: [item 74](../backlog/mcp-issues.md#74-an-islands-back-row-of-other-widths-lands-off-the-front-row)

## Affected repositories

- **roomle-ui** (`feat/hi-mcp-improvements`) — `relationsToDocking` gives `behind` an explicit
  endpoint mode derived from the turned unit's own row, and mirrors the mode when it writes the
  entry on the unit (`packages/web-sdk/packages/homag-intelligence/src/hi-group-layout.ts:872-887`,
  `:946-962`); tests in `homag-intelligence/__tests__/hi-group-layout-test.ts`. The served text
  (`packages/embedding-lib/src/homag-intelligence/hi-mcp/hi-mcp-server.ts:26-29`) stays as it is.
- **roomle-hi-example** — documentation: C16 and a new correction row in
  `docs/hi-mcp-behaviour.md`, the vector-pair table of `.agents/context/layout-and-placement.md:109`,
  `docs/hi-mcp-server.md:618`, `.agents/skills/hi-authoring-rules.md:92`; the embedding-lib pin of
  `minimal-hi-example/index.html:225,235` once a build carries the fix (built only after asking).
- **ligna-store** — the embedding-lib pin (`package.json:22`) with that build; no code.

RoomleCore and the library calculation need no change. `feat/hi-mcp-improvements` does not contain
four commits of the earlier base (`a008be42d` room corners at openings, `8cfd98e71`, `e4989a862`,
`cf377cfd4`); none of them touches the `behind` docking, and the fix does not need them.

## Symptom and reproduction

An island has a front row of 900, 600 and 900 mm units and a back row of four 600 mm units.
Both rows total 2400 mm, but the back row stands 300 mm off at both ends, producing a step in
the generated worktop.

**Reproduce.** First seen in `mcp-test-2026-10-16_19-30-19`, gpt-6.1-sol 48,
`image-planning-right-wall` (the run's artifacts are no longer kept locally):

```text
islandleft (900)
islandhob (600) rightOf islandleft
islandright (900) rightOf islandhob
rear1 (600) behind islandright
rear2, rear3, rear4 (600) rightOf the preceding rear unit
```

The same payload through the real `relationsToDocking` and `HiRootModuleArrangementOperator`, with
the library's vector convention (`BackBottom` from x 0 to the width, `LeftBottom` at x 0,
`RightBottom` at the width, front at +z — as in the `plan.xml` of the runs), reproduces it
deterministically: back-vector extents along the row front 0..2400, back −300..2100. The check is
`.temp/verify-mcp-74/tmp-island-74-test.ts`.

**The newer runs.** Five islands of 2026-10-18 and 2026-10-20 (read with
`.temp/verify-mcp-74/island-rows.mjs`) all end flush, and none has a back-to-back pair of
different widths at the start of a row:

| Run | Composition | First pair | Rows |
|---|---|---|---|
| `2026-10-18_08-45-09` gpt-6.1-sol 50 `image-planning-right-wall` | each rear unit `behind` its own front unit | 600 / 600 | flush, z −2650..−250 |
| `2026-10-18_08-45-09` gpt-6.1-sol 52 `kitchen-conversation` | each rear unit `behind` its own front unit | 600 / 600 | flush, z −2800..−1000 |
| `2026-10-20_12-45-30` gpt-6-astra 66 `image-planning-right-wall` | first rear unit `behind` the **last** front unit, the row `rightOf` — the reproduce's composition | side panel / side panel | flush, z −3188..−750 |
| `2026-10-20_19-13-28` gpt-6-astra 66 `image-planning-right-wall` | each rear unit `behind` its own front unit, side panels at the ends | 600 / 600 | flush, z −2888..−450 |
| `2026-10-20_19-13-28` gpt-6-astra 68 `kitchen-conversation` | first rear unit `behind` the **first** front unit, the row `leftOf` | 900 / 900 | flush, z −2750..−612 |

gpt-6-astra writes the reproduce's composition as well; it ends flush there only because the
first pair has equal widths.

## Investigation trace

Code references are in roomle-ui `packages/web-sdk/packages/homag-intelligence/src/` on
`345824f2d` unless prefixed with a path.

1. **The served text names no end.** `packages/embedding-lib/src/homag-intelligence/hi-mcp/hi-mcp-server.ts:26`
   says `rightOf` / `leftOf` are seen "from the front"; `:29` describes `behind` as back to back,
   turned by 180°. Neither says which ends of a back-to-back pair coincide.
2. **The compiler emits no mode for `behind`.** `pairOf` (`hi-group-layout.ts:885-887`) emits
   `BackBottom → BackBottom`, offset `[0,0,0]`, no `mode`; the side relations use `StartStart`
   (`:874-883`). `align` is parsed (`:331-342`) but the `behind` branch does not read it:
   `align: "right"` on `behind` has no effect and no correction (G37 does not list it).
3. **An absent mode on back vectors puts the owner's start on the partner's end.**
   `isVectorPairOnlyValidIfReverse` (`hi-root-module-arrangement.ts:516-534`) reverses the partner
   frame for two back vectors; `setModulePositionFromDocking` (`:593-635`) composes the frames and
   applies `applyDockModeAnchor` (`:574-591`) only when a mode is given (`:616-624`). The result is
   the placement of an explicit `StartEnd` on the entry's owner. Explicit `StartStart` is another
   placement (the reproduce's back row at −900..1500).
4. **The owner is decided by the order of the roots.** C16: an entry goes on the root the
   breadth-first walk from the first root reaches first (`hi-group-layout.ts:902-962`), with the
   offset negated when it goes on the unit — the mode is copied unchanged (`:946-962`). That is
   right for the symmetric `StartStart`, but an absent mode on back vectors is not symmetric: the
   pair aligns at the left end, seen from its own front, of whichever root comes first. The same
   relations give different layouts:

   | Composition | Front row first in `roots` | Rear row first in `roots` |
   |---|---|---|
   | first rear unit `behind` the last front unit, the row `rightOf` (the reproduce) | back −300..2100, front 0..2400 — step | flush |
   | first rear unit `behind` the first front unit, the row `leftOf` | flush | back −1800..600, front −1500..900 — step |

5. **The side relations in the turned row follow its own front.** `rightOf` in the rear row grows
   towards the front row's left. Every run above writes the direction right: the rear rows run
   along the island. Only the end the first rear unit aligns with is wrong.
6. **Explicit endpoint modes place either end exactly.** On the entry the target owns, `EndStart`
   puts the turned unit at the target's right end (seen from the target's front), `StartEnd` at its
   left end — the placement of the absent mode with the front row first. On the unit, the mirrored
   mode gives the same placement, as the planner's reciprocal entries already do (`mirrorDockMode`,
   `hi-root-module-arrangement.ts:541`, used at `:975`; `MIRRORED_MODE`, `hi-tool-docking.ts:351`).
   This holds with the front unit at 0°, 90°, 180° and 270° and for a 1200 mm turned unit. The
   calculated group carries every back-to-back pair with an explicit `StartEnd` / `EndStart` in
   `get-plan-context` (all 2026-10-20 runs), so an explicit mode matches what the agent reads back.

## Root cause

`behind` leaves the aligned end undefined in the tool API: `pairOf` emits no mode
(`hi-group-layout.ts:885-887`), so the end follows from the root that owns the entry (C16,
`:946-962`) — that is, from the order of the roots, which neither the relation nor the served text
expresses and which the agent cannot see. With the front row first, the turned unit aligns at the
left end of its neighbour; a rear row that continues `rightOf` from it — towards the front row's
left, along the island — then runs past the island's end by the first pair's width difference.

The agent's payload is a natural one: the rear row starts behind the island's end unit and runs
along the island, and two models write it. The library follows the docking it gets, and no hint
names the step: the rows touch back to back, stay inside the room and collide with nothing.

The served-text fix this analysis first proposed — start the group with the front row, put the
first rear unit behind the first front unit, continue `leftOf` — is correct only with the front row
first in `roots`, so the text would have to teach the order as well. It would get longer and work
against a composition the models write unprompted, while the server can derive the end from the
relations the agent already wrote (step 2 of
[Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort)).

## Proposed fix

In roomle-ui on `feat/hi-mcp-improvements`, `relationsToDocking`:

1. **`behind` aligns the turned unit with the end of its neighbour where its own row starts.**
   The turned unit's row is the side relations that name it or that it names: `x rightOf unit` or
   `unit leftOf x` continue it to its right, `x leftOf unit` or `unit rightOf x` to its left.
   - Its row continues to the right only: the target's right end, seen from the target's front —
     `EndStart` on the target's entry.
   - To the left only, to both sides, or no row: the target's left end — `StartEnd`, the placement
     of the absent mode with the front row first.
2. **The entry writer mirrors the mode when it writes the entry on the unit** (`StartEnd` ↔
   `EndStart`), as it negates the offset — C16 then holds for every mode. The `StartStart` of the
   other relations is unchanged.

The endpoints of the actual vectors place the unit: no catalog widths, no orientation tracking, no
group-space offset. The served text stays: the relations the agent writes already say where the
rear row runs.

What changes: back-to-back pairs of different widths whose row starts at the other end — the
reproduce becomes flush — and every pair whose entry the unit owns becomes independent of the root
order. What stays: pairs of equal widths (all five newer islands), the `leftOf` composition with the
front row first, and a turned unit with neighbours on both sides.

**Tests (roomle-ui).** In `__tests__/hi-group-layout-test.ts`, replace
`it('docks behind by the back vectors, without a mode')` (`:350`) with the modes per row direction
and entry owner: a rear row `rightOf` writes `EndStart` on the target, `leftOf`, both sides and no
row write `StartEnd`, and an entry on the unit carries the mirrored mode. A geometry test through
`relationsToDocking` and `HiRootModuleArrangementOperator`: both compositions in both root orders
end flush; a wider turned unit; rows of different total lengths keep their step at the far end.

**Documentation (roomle-hi-example).** C16 (the mode mirrored with the offset), a correction row
for the end `behind` aligns, the vector-pair table of `.agents/context/layout-and-placement.md`,
`docs/hi-mcp-server.md:618` and `.agents/skills/hi-authoring-rules.md:92`.

## Constraints and rejected approaches

- **The served text alone** (the first proposal): it depends on the root order the text does not
  control, it asks for one of two natural compositions, and it gets longer.
- **`align: "left" | "right"` for `behind`** (the earlier fallback): the agent would have to work
  out which end, which the server derives from the relations. Not needed.
- **Aligning whole rows after the compilation, or rejecting pairs of different widths**: a
  deliberate overhang or step at the far end is legitimate, and the tool cannot tell it from a
  mistake.
- **Explicit `StartStart` for `behind`**: another placement (back row −900..1500 in the reproduce).
- **Offsets from catalog widths**: the vector endpoints already express the alignment.
- **Changing the library's worktop calculation, or compiling relations outside roomle-ui** (D72):
  not a valid fix.

`align` on `behind` is dropped without a correction note (item 2). It is outside this bug; the fix
does not need `align`.

## Verification

On 2026-10-20, on roomle-ui `345824f2d`, nine temporary checks through the real
`relationsToDocking` and `HiRootModuleArrangementOperator` pass: the 300 mm step; the `leftOf`
composition flush with the front row first; `align: "right"` ignored without a correction;
`EndStart` on the target at its right end; `StartEnd` on the target equal to the absent mode and
explicit `StartStart` different; a 1200 mm turned unit with `EndStart`; the reproduce with the
rear row first, flush, and with the mirrored `StartEnd` on the unit, flush; the `leftOf` composition
with the rear row first, stepped, and flush with the mirrored `EndStart`; the reproduce with
`EndStart` and the front unit at 90°, 180° and 270°, flush.

The check and the script that reads the island rows of a run are kept in
`.temp/verify-mcp-74/`. To run the check, copy it into roomle-ui
`packages/web-sdk/packages/homag-intelligence/__tests__/` and run
`PATH=/opt/homebrew/opt/node/bin:$PATH npm run test -- --run <path>` from `packages/web-sdk`
(Homebrew Node: the default Node 20 lacks the `styleText` export of `node:util` the runner
needs). No production or permanent test code is changed, and no model was run.
