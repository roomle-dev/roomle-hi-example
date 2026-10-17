# Bug analysis — an island's back row of other widths lands off the front row

> **Type**: Bug analysis
> **Status**: Open — fix proposed, not implemented
> **Date**: 2026-10-17
> **Base**: roomle-hi-example `analysis/mcp-72-wall-units-two-heights-plinth` (`6feaff7`);
> roomle-ui `fix/room-corners-at-openings` (`a008be42d`) — the branch every roomle-ui change for
> this bug must be based on
> **Backlog**: item 74 of [`../backlog/mcp-issues.md`](../backlog/mcp-issues.md)

## Affected repositories

- **roomle-hi-example** — the proposed fix: the served description of `behind` and of the relation
  directions in a turned row in `AUTHORING_RULES` (`hi-mcp/hi-mcp-server/hi-mcp-server.ts:27`,
  served by `get-authoring-rules` and the session `INSTRUCTIONS` at `hi-mcp-server.ts:84`), in
  library-neutral words; the test `it('teaches the relations for a new group instead of docking
  vectors')` (`hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts:1085`) pins the new sentences. The
  fallback fix below adds one served sentence for a new `align` field on `behind`, in the same
  place. No change of the server's logic: the payload the agent sends is legitimate.
- **roomle-ui** — the fallback fix, only if the clarified text does not suffice: `pairOf` for
  `behind` (`packages/web-sdk/packages/homag-intelligence/src/hi-group-layout.ts:742-744`) honors
  `align` and derives the offset from the catalog widths (`rootWidth`, `hi-group-layout.ts:103`);
  the tests in `__tests__/hi-group-layout-test.ts` (the `behind` case at line 206). The fix is
  based on `fix/room-corners-at-openings`.
- **RoomleCore (the planner kernel)** — no change: a docking entry with the mode `StartStart` and a
  group-frame offset already exists and is applied (the re-dock of a unit above another root before
  a reload writes offsets in the group's frame, C24 of
  [`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md)).
- **ligna-store** — no change: the store runs the same MCP server and the same roomle-ui and holds
  no copy of the served text or of the relation compile.
- **The library (HOMAG Furniture_Smith, server-side calculation)** — no change: the fix is
  library-neutral; the served text names no article, category, attribute, value or measure of a
  library.

## Symptom

An island whose front row is 900, 600 and 900 mm wide and whose back row is four 600 mm units
comes out with the back row 300 mm off the front row at both ends — a step in the worktop the
library generates over the two rows. Reproduce: `mcp-test-2026-10-16_19-30-19`, gpt-6.1-sol 48
(`image-planning-right-wall`, the second `create-or-replace-groups`, the island group; planner call
index 9, the second `externalObjectGroupOperation`, of the run directory
`.temp/result/mcp-test-2026-10-16_19-30-19/gpt-6.1-sol/48-image-planning-right-wall/`). The payload:

```
islandleft (EUS2A90, 900); islandhob (EUKS2A60, 600) rightOf islandleft; islandright (EUS2A90, 900) rightOf islandhob
rear1 (EUTB60, 600) behind islandright; rear2, rear3, rear4 (EUTB60, 600) rightOf the one before
```

Both rows are 2400 mm wide — the agent lines the back row up with the front row. The final
geometry (`obstacles.groups` of `plan-context.json`):

| Row | Roots | Extent along the row | Depth |
|---|---|---|---|
| front | `islandleft`, `islandhob`, `islandright` | z -2940 to -540 (2400) | x 1818 to 2400 |
| back | `rear1` … `rear4` | z -3240 to -840 (2400) | x 2400 to 2982 |

`rear1` (600) shares `islandright`'s (900) left end, seen from the front row's front (z -1440), and
covers 600 of the 900 from that end; `rear2` to `rear4` continue past the front row's far end. The
back row is shifted 300 mm along the row against the front row: 300 past at one end, 300 short at
the other.

The same compile lands flush for the mirror composition. `mcp-test-2026-10-17_13-28-41`,
gpt-6-astra 52 (`kitchen-conversation`): front row `islandprep` (US2A90, 900), `islandcooking`
(UHS60, 600), `islanddishes` (US2A60, 600), z -2619 to -519; back row `reverse1` (U2TB90, 900)
`behind` `islandprep` — the row's first unit —, `reverse2`, `reverse3` `leftOf` the one before:
z -2619 to -519, flush at both ends.

## Investigation trace

1. **The served description of `behind` says neither where a turned unit lines up nor which way
   the relations run in a turned row.** `hi-mcp-server.ts:27`: `behind: "<id>" - back to back with
   that root module, turned by 180 degrees (an island).` The `rightOf`/`leftOf` line
   (`hi-mcp-server.ts:24`) says "right and left as seen from the front" without naming whose
   front; in a turned row the two readings run opposite ways along the row. The agent composes the
   back row it cannot predict.
2. **The compile pins the turned unit at the neighbour's left end.** `pairOf` for `behind`
   (`hi-group-layout.ts:742-744`): `BackBottom -> BackBottom`, no mode — the planner's default
   `StartStart` —, offset `[0,0,0]`. The mode chooses which endpoints of the two vectors meet (the
   own anchor in group space meets the rotated other anchor,
   `hi-root-module-arrangement.ts:530-546`); with the turned unit's 180° rotation the pin lands the
   turned unit at the neighbour's LEFT end, seen from the neighbour's front. The reproduce proves
   it: `rear1` (600) behind `islandright` (900) shares its left end (z -1440) and covers 600 of the
   900 from that end.
3. **`rightOf` in the turned row runs the other way round.** `pairOf` for `rightOf`/`leftOf`
   (`hi-group-layout.ts:731-740`): `RightBottom -> LeftBottom` (mirrored), `StartStart` — the side
   vectors of the turned unit, so the relation follows the turned unit's own front. `rear2`
   `rightOf` `rear1` stands at `rear1`'s right, which is the neighbour's left direction: the back
   row grows away from the front row's extent (`rear2` to `rear4` at z -2040 to -1440, -2640 to
   -2040, -3240 to -2640).
4. **The agent has no field to name the end.** `align` is read for every relation
   (`hi-group-layout.ts:238-243`, default `left`, kept when it is `left`, `right` or `back` at
   `hi-group-layout.ts:297-298`) but `pairOf` ignores it for `behind`; `gapMm` on `behind` is
   ignored with a correction (`hi-group-layout.ts:288-293`, G37 of
   [`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md): the planner applies an offset in
   the group's frame, where x is not the direction of a turned leg, so only a vertical gap is
   derived). The pos-group schema is free-form (`z.record(z.unknown())`, `hi-mcp-server.ts:405-413`),
   so an `align` on a `behind` root reaches the compile untouched.
5. **The planner's own docking after the load confirms the geometry.** The `contextData` of the
   calculated group links `islandright`'s `BackBottom` to `rear1`'s `BackBottom` and `rear1`'s
   `RightBottom` to `rear2`'s `LeftBottom`: the rows stand as the compile put them; nothing
   re-aligns a back row with the row in front of it.
6. **The outcome turns on a choice the served text does not cover** — not on the articles, not on
   the library: the mirror composition (symptom, last paragraph) lands flush with the same compile,
   and the one-behind-each style of the other stored runs (`50-kitchen-conversation`: one back unit
   behind each front unit, equal widths) is immune to the pin.

## Root cause

The description of `behind` does not say where a turned unit lines up with a wider neighbour nor
which way `rightOf`/`leftOf` run in a turned row, and the compile pins the turned unit at the
neighbour's left end (seen from the neighbour's front) with offset 0 and no field to name the other
end. The agent's natural composition — the first back unit behind the row's end unit, the back row
continuing `rightOf` like the front row — then lands the back row off the front row by the width
difference at both ends.

## Why the current code produces this

`pairOf` writes the back-to-back docking as the two back vectors, start on start, offset 0
(`hi-group-layout.ts:742-744`). For equal widths the pin is invisible; for a turned unit narrower
than its neighbour it leaves the width difference on the far side of the neighbour, and the turned
row's `rightOf` grows away from the row, so the whole back row shifts by the width difference — 300
mm at both ends in the reproduce. Nothing in the tool result tells the agent: the groups come back
with their positions, and no correction, `notLoaded` or `hint` names the misalignment (the rows do
not overlap; every unit stands in the room).

## Proposed fix

Two steps; the first is served text only, in roomle-hi-example.

**Step 1 — clarify the description of `behind`** (`hi-mcp-server.ts:27`), in library-neutral words:
where a turned unit lines up and which way the relations run in a turned row, and the composition
that lines a back row up with the row in front of it. For example:

> `behind: "<id>" - back to back with that root module, turned by 180 degrees (an island): the
> turned unit lines up with the left end of that root module, seen from its front, and in the
> turned row rightOf and leftOf run as seen from the turned unit's own front, the other way round
> than in the row it stands behind. To line a back row up with the row in front of it, put its
> first unit behind the first unit of that row and continue the back row leftOf.`

With the pin at the neighbour's left end, that composition lands flush: the front row's first unit
is the row's left end ("a row is each root module rightOf the one before", `hi-mcp-server.ts:24`),
so the first back unit pins at the row's left end, and `leftOf` in the turned row runs along the
row — the mirror of the front row's `rightOf`. It is the composition of the flush run
(`mcp-test-2026-10-17_13-28-41` run 52), and it lands the reproduce's island flush unchanged:
`rear1` behind `islandleft`, `rear2` to `rear4` `leftOf` — z -2940 to -540 at both rows.

**Step 2 — fallback, only if the prompt tests still land back rows off: the server lines up a unit
`behind` a wider one at the end the agent names** (roomle-ui, based on `fix/room-corners-at-openings`).
`behind` takes `align: "left"` (the default, today's pin) or `"right"` — which end of the neighbour
the turned unit lines up with —, and `pairOf` derives the offset from the catalog widths:
`[width(neighbour) - width(unit), 0, 0]` in the group's frame for `align: "right"` (the group's x is
the row direction of a straight row, the island the text documents; the entry's mirroring at
`hi-group-layout.ts:805-819` already negates the offset when the entry is written on the other
root). A turned unit wider than its neighbour gets a negative offset — it overhangs the
neighbour's left end, which is a legitimate back row. The served text gains: `align: "left"
(default) or "right" says which end of that root module the turned unit lines up with.` With it
the natural composition works: the first back unit behind the row's last unit with
`align: "right"`, the back row continuing `rightOf`.

## What the fix does not do

- It does not change the compile's default: existing payloads and stored plans keep the left pin;
  `align: "right"` is opt-in (step 2).
- It does not teach library content: the sentences name ends, fronts and rows — no article,
  category, attribute, value or measure of a library (the library-neutrality rule, §2.4 of
  [`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md)).
- Step 1 alone leaves the natural composition ("behind the row's last unit, continue `rightOf`")
  unavailable; the agent uses the mirrored composition. That is why step 2 exists as the fallback.
- It does not move a back row the agent placed deliberately off the front row — the server cannot
  tell that from a mistake, and it does not try
  ([Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort)).

## Rejected approaches

- **A guard that rejects a `behind` of other widths.** A guard fights the symptom: the agent's
  payload is a legitimate island, and the wrong alignment is the tool's product, not the agent's
  input.
- **Change the compile's default pin to the neighbour's right end.** It would silently move the
  back rows of existing payloads and stored plans — the flush island of `mcp-test-2026-10-17_13-28-41`
  run 52 would land off —, and the served text cannot announce a default change retroactively.
- **Teach only the pin, not the turned-row directions.** The agent still cannot tell which way
  `rightOf` runs behind a turned unit; the two facts come together or the composition stays a
  puzzle.
- **Derive the alignment in the MCP server instead of roomle-ui.** The relations are compiled in
  roomle-ui's tool command (D72); a second compile in the server would fork the relation logic.
- **Fix it in the kernel (RoomleCore): re-align a back row with the row in front of it after the
  load.** The planner cannot tell a deliberate step (a wider back row, a deeper row behind) from a
  mistake; it would fight legitimate plans. No kernel change is needed for the proposed fix.

## Implementation plan (sketch)

1. roomle-hi-example `hi-mcp/hi-mcp-server/hi-mcp-server.ts` — extend the `behind` line of
   `AUTHORING_RULES` (line 27) with the pin, the turned-row directions and the flush composition,
   in library-neutral words (step 1 above). The sentence reaches `get-authoring-rules` and the
   session `INSTRUCTIONS` (`hi-mcp-server.ts:84`).
2. roomle-hi-example `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` — extend
   `it('teaches the relations for a new group instead of docking vectors')` (line 1085) with the
   new sentences.
3. Fallback, only if the prompt tests still land back rows off: roomle-ui `hi-group-layout.ts`
   `pairOf` (`hi-group-layout.ts:742-744`) — honor `link.align` for `behind`: offset
   `[width(target) - width(unit), 0, 0]` for `align: "right"`, `[0, 0, 0]` for `left`, derived
   with `rootWidth` (`hi-group-layout.ts:103`); the served text gains the `align` sentence for
   `behind`. Based on `fix/room-corners-at-openings`.
4. roomle-ui `__tests__/hi-group-layout-test.ts` — the `behind` case (line 206) gains:
   `align: "right"` derives the offset from the catalog widths; the default keeps offset 0; a unit
   wider than its neighbour gets a negative offset; the entry written on the unit
   (`hi-group-layout.ts:805-819`) carries the negated offset.
5. The stored test `image-planning-right-wall` of `docs/test-prompts.json` holds the outcome: the
   island's two rows end flush at both ends.
