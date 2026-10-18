# Bug analysis — the wall units hang at two heights after a plinth height in the group attributes

> **Type**: Bug analysis
> **Status**: Open — fix proposed, not implemented
> **Date**: 2026-10-17
> **Base**: roomle-hi-example `master` (`6b9a981`); roomle-ui `fix/room-corners-at-openings`
> (`a008be42d`) — the branch every roomle-ui change for this bug must be based on
> **Backlog**: item 72 of [`../backlog/mcp-issues.md`](../backlog/mcp-issues.md)

## Affected repositories

- **roomle-ui** — the proposed fix: the `create-or-replace-groups` tool command
  (`packages/web-sdk/packages/homag-intelligence/src/hi-tool-commands.ts`), the relation compile
  that records the hangs (`relationsToDocking`, `hangGapOf`, `hi-group-layout.ts`), the group
  attributes step (`applyGroupWideAttributes`, `hi-tool-attributes.ts`) and the unit tests in
  `__tests__/hi-tool-commands/create-or-replace-groups-input-test.ts`. The fix is based on
  `fix/room-corners-at-openings`.
- **roomle-hi-example** — this analysis and backlog item 72 (the cause and the responsible
  updated with the analysis). No code change: the issue rules out a change of the served text,
  and the stored test `kitchen-back-right-corner` of `docs/test-prompts.json` already covers the
  outcome.
- **RoomleCore (the planner kernel)** — no change for the proposed fix. Named because the
  root-cause alternative lives here: keep the docking link of a wall unit to the floor unit it
  hangs above across the load, or re-apply the group's docking entries (with their offsets) when
  the group is recalculated (`src/planner/configurable/external/`, the docking context). The
  touching-vectors rule is load-bearing for the row edits and snapping (D42), so this is the
  option with the widest blast radius.
- **The library (HOMAG Furniture_Smith, server-side calculation)** — no repository change here.
  The ultimate fix: when the plinth height changes, lift every wall unit hung above a floor
  unit by the same delta. Reported to the HOMAG library development team like the items of
  [`../backlog/library-issues.md`](../backlog/library-issues.md).
- **ligna-store** — no change: the store runs the same roomle-ui and planner and holds no copy
  of the tool command.

## Symptom

A `create-or-replace-groups` whose group attributes set a plinth height other than the library's
(`mod_PlinthAreaHeight` 150 or 120 against the default 100) hangs the wall units of one kitchen at
two heights. Reproduce: `mcp-test-2026-10-17_13-28-41`, gpt-6-astra 49
(`image-kitchen-back-right-corner`, the second `create-or-replace-groups`, planner call 11 of the
run directory `.temp/result/mcp-test-2026-10-17_13-28-41/gpt-6-astra/49-image-kitchen-back-right-corner/`).
The payload puts `mod_PlinthAreaHeight` 150 into the group attributes and hangs two `OTB45`
(`display1`, `display2`) `above` the base unit `prep` (`UTB60`), a range hood `DU` `above` the hob
with `gapMm` 650 and an open shelf `ORFB60` `above` the dishwasher with `gapMm` 600.

The final geometry (`obstacles.groups` of `plan-context.json`, `bottomMm`/`topMm`):

| Root | Article | Bottom | Top | Verdict |
|---|---|---|---|---|
| `prep` and the other floor units | `UTB60`, … | 0.5 | 870 | rose 50 with the plinth (100 → 150) |
| `fridge` | `HK260` (tall) | 0.5 | 2250 | rose 50 |
| `display1`, `display2` | `OTB45` | 1480 | 2200 | **stayed** — 50 below the tall units' top 2250 that D35 hangs them flush with |
| `shelf` | `ORFB60` | 1470 | 1830 | rose 50 (1420 → 1470), kept its `gapMm` 600 above the dishwasher (top 870) |
| `hood` | `DU` | 1520 | 2648 | rose 50 (1470 → 1520), kept its `gapMm` 650 above the hob's carcase top (870) |

The corrections of the call name the floor and tall units — "with its group attributes the library
changed `mod_HeightPosInsertion` of 7 root modules (UTB60, UKS2A60, US2A30, HK260, SUT60, H2TB60,
HOTS2AB60) from \"100\" to \"150\"" — and the shelf — "… `mod_HeightPosInsertion` of root module
'…' (ORFB60) from \"1420\" to \"1470\"" — and no `OTB45`: the two wall cabinets the D35 gap hung
flush with the tall units kept the height of the old plinth. The order data (`order-data.json`)
shows the wall units carry their height as an absolute input attribute: `mod_HeightPosInsertion`
1480 (`isInput: true`) on both `OTB45`, 1470 on the `ORFB60`, 1500 on the hood (not an input — the
library computes it).

## Investigation trace

1. **The height of a wall unit is fixed at the load, with the library's default plinth.** The
   `create-or-replace-groups` tool command compiles the agent's relations into docking entries
   (`relationsToDocking`, roomle-ui `hi-group-layout.ts:170`, called at
   `hi-tool-commands.ts:338`): a wall unit `above` a floor unit docks its `LeftBottom` on the
   carrier's `LeftTop` with the offset `[0, gap, 0]`, where `gap` is the agent's `gapMm` or the
   D35 hang gap (`hangGapOf`, `hi-group-layout.ts:141`: tall-unit height − wall-unit height −
   carrier height; "base and tall units stand on the same plinth, so the plinth cancels out",
   `hi-group-layout.ts:747`). The load (`planner.loadExternalObjectGroupLayout`,
   `hi-tool-commands.ts:502`) resolves the docking and writes each wall unit's absolute insertion
   height into an input attribute — 1480 = 100 (default plinth) + 720 (carrier) + 660 (D35 gap) on
   the `OTB45`, 1420 = 100 + 720 + 600 on the shelf. The before-values of the D59 corrections and
   the order data agree.
2. **The group attributes are applied only after the load.** `applyGroupWideAttributes`
   (`hi-tool-attributes.ts:363`, called at `hi-tool-commands.ts:543`, after the wall placement
   reload at `hi-tool-commands.ts:533`) sends the attributes that are not the library's group
   settings with one `change-attributes` group operation (D36). `mod_PlinthAreaHeight` is not a
   group setting (it is assigned to root modules, not to a group orchestrator module), so the
   plinth changes only in this after-load command — the correction's "from \"100\" to \"150\""
   proves the floor units were still at the default plinth after the load.
3. **The docking that hung the wall unit does not survive the load as a link.** D35's design hangs
   the wall unit relative to its carrier, so the plinth cancels out — but the kernel's docking
   context links only vectors that touch, and a wall unit hanging with a gap is no longer docked
   to its floor unit after a load (D42, [`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md)).
   Nothing ties the wall unit's height to its carrier's height anymore; the wall unit's height is
   the absolute number written at the load.
4. **When the plinth changes, the floor and tall units rise, and only some wall units follow.**
   The `change-attributes` recalculation lifts the floor and tall units (their insertion height
   becomes the new plinth — the first correction). The kernel moves the wall units whose docking
   vectors still touch a risen unit: stacks `onTop` another unit (the `OSKB90`/`O2TB90` bridges
   of `image-planning-right-wall`, bumped 2200 → 2250 / 2140 → 2190 in the same delta) and wall
   units docked by the Top vectors beside a tall unit (D34; the `OFKB60` pair `rightOf` the
   fridge in `image-only-no-text`, bumped 1480 → 1500). Of the wall units hung above floor units —
   no touching link — the library's own recalculation lifts some by the same delta and leaves the
   others: the shelf above the dishwasher in the reproduce (1420 → 1470, named), but not the two
   `OTB45` above the base unit.
5. **Which wall units the library lifts is its server-side calculation logic, and it is not
   derivable from the served data.** Across the stored runs the same article above the same
   carrier rises in one run and stays in another: an `OTB60` above a `US2A60` is lifted in
   `mcp-test-2026-10-16_19-30-19` run 35 (1480 → 1530) and left in `mcp-test-2026-10-17_09-31-13`
   run 35 (no wall unit named at all); an `OTB45` above a base unit is left in
   `mcp-test-2026-10-17_13-28-41` run 49 and lifted in run 48 of both earlier sessions (1480 → 1530
   and 1420 → 1470); the range hood above the hob rises in run 49 of `…_13-28-41` (to 1520, the
   hob's carcase top 870 + `gapMm` 650) and stays in run 35 of `…_10-16_19-30-19` (1480, the
   height of the old plinth) and run 49 of the same session (1540, the old hob top 840 +
   `gapMm` 700). The split follows neither the article, nor the carrier, nor the gap, nor the
   position beside a corner (`OFKB60` above a unit beside a corner is lifted in
   `…_10-16_19-30-19` run 50 and `…_18-40-40` run 49, while an `OTB60` beside a corner is left in
   `…_10-16_19-30-19` run 51). It is the HOMAG calculation on the backend, not reachable from
   these repositories.

## Root cause

The wall unit's height is fixed at the load as an absolute insertion height computed with the
library's default plinth, because the group attributes — which carry the plinth height — are
applied only after the load (D36), and the docking entry that hung the wall unit above its
carrier does not survive the load as a link (D42: the docking context links only touching
vectors). When the plinth attribute then lifts the floor and tall units, the kernel has no link
to move the wall units hung above them, and the library's recalculation lifts only some of them
by the same delta — its server-side rule, inconsistent across runs. The wall units it leaves keep
the load-time height: 50 or 20 mm below the tall units' top that D35 hangs them flush with.

## Why the current code produces this

`create-or-replace-groups` hangs the wall units at the load (step 1) and changes the plinth
afterwards (step 2), in the only order the planner allows: a reload after the attribute command
would send the values before it, because the planner answers an attribute command before the
calculated group carries the new values (D36, the comment at `hi-tool-commands.ts:538`). The D35
hang gap is relative to the carrier precisely so the plinth cancels out — but that only holds
while the docking link lives, and the link dies at the load because the hang gap keeps the
vectors apart (D42). The tool command then trusts the library to keep the wall row at the height
of the wall units, and the library does so only for some wall units (step 4).

## Proposed fix

In roomle-ui's `create-or-replace-groups` tool command, **re-assert the hang of every wall unit
the command hung above a floor unit, after the group attributes are applied**: the wall unit's
bottom must sit at its carrier's new top plus the compiled gap — the agent's `gapMm`, else the
D35 `hangGapOf` (which puts its top flush with the tall units). The command records the above
links while it compiles them (`relationsToDocking` returns the hang links: wall unit, carrier,
gap), reads the group after `applyGroupWideAttributes`, and where a hung wall unit's bottom is
off the target — because the library left it at the old plinth's absolute height — it sets the
wall unit's insertion height to the target bottom minus the unit's insertion-to-geometry offset
with one `change-attributes` entry on that root module and reports it as a correction, in
library-neutral words: the group attributes lifted the floor units by so many mm, the wall unit
did not follow, it was lifted to hang at its gap above its carrier again.

The insertion-to-geometry offset is read off the loaded unit — its bottom minus its insertion
height: 0 on the `OTB45` (bottom 1480, insertion 1480), 20 on the hood `DU` of the reproduce
(bottom 1520, insertion 1500, calculated). The attribute is the one the loaded unit carries
whose value is its position height from the floor — the input attribute the kernel wrote at the
load on a wall unit, the calculated one the library computes on the hood (in Furniture_Smith
both are `mod_HeightPosInsertion`, "Position height — height position of the element from the
floor"); `change-attributes` targets any attribute the module carries (`hi-tools.ts:456`), input
or calculated alike — so no library-specific id enters the code. This is the supported path
after the group attributes: a reload there would send the values before them (D36; the comment
at `hi-tool-commands.ts:538-540`). Verification: the unit test pins the sent value on a
calculated insertion height; whether the library honors a set on the hood's calculated attribute
is held by the stored test.

This makes the outcome independent of the library's partial plinth-following and needs no change
of the served text: the agent sends a legitimate plinth height, and the tool builds the plan the
D35 rule describes.

## What the fix does not do

- It does not cover `change-group-attribute` with a plinth height on an existing group: the same
  `change-attributes` mechanism lifts the floor units and some wall units there too, and the
  same two heights appear. The kernel fix (below) covers both paths; the roomle-ui fix is scoped
  to the create's group attributes as the issue asks. Extending the re-hang to
  `change-group-attribute` is a follow-up once the create path is proven.
- It does not teach the agent anything new: the correction names the lift, the wall unit and its
  carrier, so the agent learns what happened without a rule change.
- It does not move wall units the agent hung with an explicit `gapMm` beyond re-asserting that
  gap above the carrier's new top — the agent's gap is kept, not overridden.
- It does not assume the insertion height is the unit's bottom: the offset between them is read
  off the loaded unit per unit (20 mm on the hood of the reproduce), so a unit whose insertion
  point is not its bottom is lifted by the same geometry, not by the attribute's face value.

## Rejected approaches

- **Apply the plinth before or at the load.** The group attributes travel with the load, but the
  planner lets the library set a group's attributes on a create only, and `mod_PlinthAreaHeight`
  is not one of the library's group settings — the reproduce proves the floor units were still at
  100 after the load. Making it a group setting is a library-data and planner change, not a
  roomle-ui one.
- **Reload the group after the attributes, so the docking re-hangs the wall units.** A reload
  after the attribute command sends the values before it (D36); a reload from the changed group
  would replace the group and lose the just-set plinth again, because the plinth is not applied
  at the load. The wall placement reload already ran before the materials for the same reason.
- **A served-text change or a guard.** The issue rules out a text change, and the agent's payload
  is legitimate — a plinth height in the group attributes is a correct request ([Guards Are a
  Last Resort](../../AGENTS.md#guards-are-a-last-resort)). The wrong height is the tool's
  product, not the agent's input.
- **Fix it in the kernel (RoomleCore): keep the wall-unit→carrier link across the load, or
  re-apply the group's docking entries with their offsets on recalculation.** This is the
  root-cause fix and covers every path (create, `change-group-attribute`, future tools), but the
  touching-vectors rule of the docking context is load-bearing for the row edits and snapping
  (D42: the planner finds the unit below by position), so the blast radius is the whole planner.
  Kept as the alternative; the roomle-ui fix is the surgical one this issue asks for.
- **Fix it in the library (HOMAG server-side calculation): lift every wall unit hung above a
  floor unit by the plinth delta.** The ultimate fix, but it lives in the HOMAG calculation,
  outside these repositories; report it to the library development team.

## Implementation plan (sketch, roomle-ui, based on `fix/room-corners-at-openings`)

1. `hi-group-layout.ts` — `relationsToDocking` returns the hang links it compiles (wall unit id,
   carrier id, gap: `gapMm` or the D35 `hangGapOf`), beside the docking entries it writes.
2. `hi-tool-commands.ts` — `create-or-replace-groups` keeps the hang links per call group; after
   `applyGroupWideAttributes` (and the plan-context read that follows it), for each hang link it
   finds the wall unit and its carrier in the loaded group, computes the target bottom (carrier
   top + gap, from the obstacles), and collects the wall units whose bottom is off by more than
   a tolerance.
3. For the off wall units the command sends one `change-attributes` entry per group
   (`rootModuleIds`, the insertion-height attribute read off the wall unit, value = target
   bottom − insertion-to-geometry offset, the offset the wall unit's current bottom minus its
   current insertion height) and pushes a correction naming the lift, the wall unit and its
   carrier. Open details: whether the planner counts this second `change-attributes` as its own
   undo step beside the material command (D47 counts the two loads and the material command
   together), and whether the library honors a set on a calculated insertion height — the unit
   test pins the planner steps the command sends.
4. Tests in `__tests__/hi-tool-commands/create-or-replace-groups-input-test.ts`: a create with a
   plinth height in the group attributes whose mock planner lifts the floor units and leaves one
   hung wall unit at the old insertion height — the command lifts it to carrier top + gap and
   reports the correction; a wall unit the library already lifted is not touched again; a wall
   unit with an explicit `gapMm` keeps that gap; a hood the mock planner leaves at the old
   insertion height — a calculated insertion height 20 mm below its bottom, as the reproduce's
   `DU` — is lifted to the carrier's new top + `gapMm` with the value target − 20, and the
   correction names it (the regression case for a hood that did not follow the plinth; trace 4
   names the stored runs where the library leaves one). The stored test
   `kitchen-back-right-corner` of `docs/test-prompts.json` then holds: every wall unit's top at
   the tall units' top, the hood at its `gapMm` above the hob's new top.
