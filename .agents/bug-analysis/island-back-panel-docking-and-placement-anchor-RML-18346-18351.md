# Island back panel protrudes and island lands off: the docking derivation and the placement anchor are the root cause (RML-18346, RML-18351)

> **Type:** Bug analysis
>
> **Status:** Open
>
> **Date:** 2026-11-01
>
> **Tickets:** [RML-18346](https://roomle.atlassian.net/browse/RML-18346) (comment 156767), [RML-18351](https://roomle.atlassian.net/browse/RML-18351) (comment 156766)
>
> **Base:** roomle-ui `release/bo-test` `9b8181406` — the planner the probes ran against (`https://www.roomle.com/t/bo-test/`, the same build the tickets' 2026-10-31 snapshots were planned with; the local `feat/hi-planning-assistant` `c7aeb092d` carries the same HI tool code); roomle-hi-example `fix/back-panel-anchor-island-first-placement-RML-18346-18351` `cc8e35b8`

Supersedes the instruction-level reading of [kitchen-back-panel-anchor-and-island-first-placement-RML-18346-18351.md](kitchen-back-panel-anchor-and-island-first-placement-RML-18346-18351.md): the fixes proposed there were implemented and reverted — they treated symptoms. The probes below show the defects are in the tool layer: the docking the server derives from `behind`, and the placement anchor the server picks.

**The ticket owner's suspicion is confirmed:** the tools lack a feature to close the back of a free-standing row whose back side is made of several modules — in kitchen 16 a corner module plus a straight module (RML-18346, comment 156767), in kitchen 5 an island of several modules (RML-18351, comment 156766). `behind` anchors one panel at one named root's back line; a corner article has no `BackBottom` to dock behind (the relation is ignored and the panel is put at the row's end as a side unit — probe D3); a panel docked behind one straight module runs along that module's back line only and does not cover the corner's back side (probes D1/D2, no corrections). The agent has to discover by trying which root to name and how long the panel must be — the multiple wrong attempts of both tickets.

## Affected repositories

- **roomle-ui** — the HI tool commands in the planner: `hi-group-layout.ts` (`behind` → docking derivation), `hi-group-placement.ts` (`findAnchorRoot` / `groupAnchorFrame` / `toRepositioningData` / `positionInPlacementFrame`), `hi-plan-context.ts` (`compactArticle`), with unit tests and the served-text fixture; the roomle-ui `.agents/homag-intelligence/` rows. No embedding-lib build; the tools run in the planner.
- **roomle-hi-example** — this analysis, the probe script in `.temp/probe-island.mjs` (git-ignored), the ticket comments.
- **HOMAG library** — unchanged. The `RWV` descriptions are applied; the library's calculation is not the defect (probe evidence below).

## Symptom and reproduction (model-free probes against bo-test)

Reproduction: open the HI example page (`http://localhost:3000/?backendId=HI_PRE_Roomle_Milestone_2&library_id=Furniture_Smith&chat=false`, planner from bo-test) and call `window.instance.extended.callExternalObjectAgentTool` with the payloads below (scripts: `.temp/probe-island.mjs`, `.temp/probe-corner.mjs`; results in `.temp/probe-out/`). Island payload: three `UTB60` in a row (`u2`/`u3` `rightOf`), one `RWV` with `mod_IslandBackwallWidth` 1800 `behind` a chosen root, `placement: { posGroup: [1250, 650, 0], posRotationZ: 180 }`. Corner payload (D probes): corner `UERTB90` with `u1`/`u2` `UTB60` rightOf it, panel `RWV` 2400 `behind` a chosen root, same placement.

| Probe | Payload difference | Result footprint (plan space, relative to pos) | Meaning |
|---|---|---|---|
| A1 | panel `behind` **u2** (middle root) | width **2425** (row is 1800) | panel protrudes ~600 mm past the row's far end; `corrections: null`, `hint: null` |
| A2 | panel `behind` **u1** (row's end root) | width **1830** (1800 + 30 overdimension) | flush with both ends |
| A3 | same as A1 but panel listed **first** in `roots` | y range **[-220, 617]** instead of A1's **[-617, 220]** | same `posGroup`/`posRotationZ` land the group differently — the anchor is the first-listed root |
| B1 | no panel, same point/rotation | y [-617, 0], depth 617 | baseline |
| B2 | panel behind u1, same point/rotation | y [-617, **220**], depth 837 | the panel extends 220 mm **past** the reported `pos` on the back side — `pos` is the anchor root's corner, not the group's back-left corner |
| C | create A2, then replace the group unchanged (no placement), then `place-group { posGroup: [2100,650,0], posRotationZ: 90 }` | replace keeps pos/rotZ exactly; move answers `placedIn: "point"`, pos [2100,650,0], rotationZ 90 | replacement pose retention and point-form `place-group` work on bo-test — not the defect |
| D1 | peninsula = corner `UERTB90` + `u1`,`u2` rightOf it; panel 2400 `behind` straight end root `u2` | footprint width **4176**, no corrections — the panel runs along u2's back line and does not cover the corner's back side | a multi-module back cannot be closed by one `behind` on a straight module |
| D2 | same, panel `behind` middle straight `u1` | width **3576**, no corrections | same — anchored mid-row, covers part of the row only |
| D3 | same, panel `behind` the **corner** `c1` | corrections: "a corner article has no back to dock behind - ignored", "root 'p1' names no neighbour - it was put **rightOf 'u2'**"; panel ends up as a side unit at the row end (rowIndex 4), footprint width 4776, depth 691 | `behind` a corner article is dropped (`hi-group-layout.ts:464`) and the panel is silently re-docked as a row unit |

Live catalog probe: `RWV` is served with `dimensions: [mod_Depth 250, mod_Height 1000, mod_Width 1000]` while its applied desc says the length is `mod_IslandBackwallWidth` — the catalog names an attribute the module does not take.

## Root causes (file:line)

1. **There is no operation that closes the whole back side of a free-standing row — `behind` anchors one panel at one named root's back line** — `hi-group-layout.ts:886-899`: `behind` becomes `BackBottom → BackBottom` with mode `StartEnd`/`EndStart` at the *named neighbour's* end, so the panel starts at that root's end and runs along that root's back line. Three consequences, all probed: named behind a middle unit, a panel as long as the row protrudes past the row's far end (A1: width 2425 vs 1830), with no correction and no hint — the server computed the row (`withRowIndices`), so it could have seen the protrusion; named behind a **corner article**, the relation is ignored (`hi-group-layout.ts:464`, "a corner article has no back to dock behind") and the panel is re-docked as a side unit at the row's end (D3: rowIndex 4, width 4776) — the corner's back side (`LeftBackBottom`/`RightBackBottom` vectors, served in the catalog) is never covered; named behind one straight module of a corner-plus-straight back, the panel covers only that module's back line, not the corner's (D1/D2). The agent must discover by trying which root to name, how long the panel must be (the back side's full extent), and that a corner cannot be named — the multiple wrong attempts of both tickets and the protruding cover panel of RML-18346's unstored attempt.
2. **The placement anchor is the first-listed root, not a geometric corner of the group** — `hi-group-placement.ts:89` (`findAnchorRoot`: `rootsById.get(startRootId) ?? roots[0]`, then walks carriers/leftOf), used by `toRepositioningData` (:257-), `groupPlacementByPoint` (:337-), and `groupAnchorFrame` (:315-) which also produces the *reported* `pos` via `positionInPlacementFrame` (:361-). Consequences proven by the probes: (a) root order changes where the same `posGroup` lands (A3 vs A1); (b) the reported `pos` is the anchor root's docking corner, while the served text tells the agent it is "the group's back left bottom corner" — with a rear panel in the group the group's back extends ~250 mm past `pos` (B2), so the agent's numeric verification of pos/rotationZ is based on a corner the group does not have. This is the "position of the kitchen island completely off at the start" of RML-18351's `ps_tevc8l1…`: which root the agent lists first decides where the island lands and which corner the result reports.
3. **The catalog serves a calculated template dimension the module does not take** — `hi-plan-context.ts:663-665` (`compactArticle` takes every `Dim` of the template): `RWV` serves `mod_Width` 1000 although `mr_IslandBackwall` does not carry it (its length is `mod_IslandBackwallWidth`), contradicting the applied desc and the served rule that dimensions name the size attribute. This is what makes the agent size the panel with the wrong attribute in the first create (RML-18346's resends).

Why the current code produces the wrong results: all three are derivation gaps — the server derives the docking from a single named relation and the anchor from list order instead of from the row/group geometry it already computes, and it serves template dimensions instead of the module's. The library calculates exactly what it is told; the wrong instructions reach it.

## Proposed clean fix (roomle-ui, server-side derivation — no guard, no instruction-only workaround)

1. **Give the tools a real back-closing derivation.** In `relationsToDocking` (`hi-group-layout.ts`): when a unit docks `behind` a root of a side row and the turned unit has no row of its own, anchor it at the **row's start end** (from the side partners the layout already derives), so a panel as long as the row covers the row whichever root the agent names; when the row ends at (or contains) a **corner article**, extend the docking across the corner's back side vector (`LeftBackBottom`/`RightBackBottom`) so the panel spans the corner's back too, or at minimum answer `behind` a corner article with a correction that names the straight root of the leg to dock behind and the back side's full length — never re-dock the panel as a row unit (D3). If the turned unit is longer than the back side, the result names the protrusion in `corrections` ("the panel reaches 600 mm past the back side's end"). Tests in `hi-group-layout-test.ts` / `create-or-replace-groups-placement-test.ts`.
2. **Make the placement anchor geometric and order-independent.** Pick the anchor as the root whose docking corner is the back-left extreme of the calculated group in the placement frame (the contour the footprint is measured from), in `findAnchorRoot`/`groupAnchorFrame` (`hi-group-placement.ts`) — then `posGroup` and the reported `pos` mean the same corner of the whole group, panel included, regardless of root order. `positionInPlacementFrame` then reports what the served text says. Tests in `placement-frame-test.ts`, `hi-group-placement-test.ts`, `agent-frame-test.ts`.
3. **Serve the module's dimensions** — `compactArticle` (`hi-plan-context.ts:663`): a template `Dim` the root's module does not carry in `assignedAttributes` is served as the module's same-named `Dim` (template value) or left out. Tests in `hi-plan-context-test.ts`.
4. Served-text wording follows from 2 (the existing "back left bottom corner" text becomes true); no new rule sentence is needed for 1 once the derivation is right.

## Verification

- Re-run the probes (`.temp/probe-island.mjs`, `.temp/probe-corner.mjs`) against a dev server of the branch: A1 and A3 footprints equal A2's (1830, y [-617, 220]); D1–D3 build the panel spanning the whole back side (corner included) with no protrusion, and `behind` a corner article no longer re-docks the panel as a row unit; B2's footprint back aligns with `pos`; the catalog serves `mod_IslandBackwallWidth` for `RWV`; C unchanged (pose retention, point move).
- roomle-ui homag-intelligence suite, typecheck, lint, format; fixture test.
- Model check when asked for: gpt-6-astra, kitchen images 5 and 16, against the plan IDs of the 2026-10-31 comments (RML-18351: `ps_tevc8l1…`, `ps_tev11t…`, `ps_teu5dw…`; RML-18346: `ps_tev8tx…`, `ps_tevl1r…`) — no protruding panel, first-create island at the intended axis/working side, fewer wrong attempts.
