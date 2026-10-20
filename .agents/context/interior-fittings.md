# Interior fitting implementation

## Interior Design tools

Interior Design, interior fittings and sub-articles refer to supported fittings inside an existing HI group. Read `get-interior-design-options` with `groupId` and optional `rootId`, `containerModuleId`, `articleId` filters. It returns unique installed instance IDs, parent-local positions where each fitting's parts start, explicit settings and compatible library articles with destination tuples. It uses the existing context read with a scoped `interiorDesign` section; it waits behind writes, changes no selection and creates no history entry. Unsupported capability, no available additions and a discovery error have different outcomes.

`articles` lists compatible additions in currently free containers. Each scoped fitting also carries `replacementArticles` for its current parent: discovery removes that source on a copy, calculates the freed capacity and asks the same library for compatible articles. A full cabinet can therefore have no additions but still offer replacements. `articleId` filters addition and replacement candidates; installed sources that can take that replacement remain visible. `status: available` includes either kind of choice. Use a fitting's replacement article IDs with its installed instance ID; generated containers on the copy are not add destinations. Normal group/history context remains compact and does not calculate these choices.

| Tool | Required arguments beyond groupId |
| --- | --- |
| `add-interior-fitting` | `articleId`, `destination: { rootId, containerModuleId, parentModuleId }` |
| `move-interior-fitting` | `instanceId`, destination and/or `insertPosition` |
| `delete-interior-fittings` | Non-empty `instanceIds` list |
| `replace-interior-fitting` | `instanceId`, replacement `articleId` |

Add, move and replace accept an optional `insertPosition: [x, y, z]`: millimetres, x right/y up/z front, relative to the destination parent module — the frame of the discovered `position`, so a fitting moves by an offset added to its position ([Placement](#placement)). Add without it uses the library default; move/replace retain measured source placement. Missing source measurement requires a point. Library adjustments are reported, including a no-op when the library keeps a moved fitting at its place. An upper/lower instance is chosen from measured heights within the same parent, never list order. Clarify an ambiguous instance or an unspecified interior edit.

Discovery precedes edits. A generated container ID can expire after calculation; a stale explicit destination fails. The UI revalidates library compatibility inside each edit, stages changes and awaits final loading. Transfer stays within one group. Delete validates the complete batch and deduplicates IDs with a correction. Replacement removes the source only on the working copy, calculates available containers, adds/calculates the replacement and publishes one final group. Calculation failure preserves the original; a load failure restores it and awaits restoration. If restoration fails, the error says so.

Results retain `changed`, `addedInstanceIds`, `removedInstanceIds`, final `fittings`, and `corrections`. Recreation may change IDs. A changed call is one undoable action; no-op or failed-before-change calls add none. A failure after loading retains the planner's undo record. Groups include compact `interiorFittings`, so history detects an interior-only move or setting change with an unchanged cabinet outline. Never rebuild nested module trees or issue separate delete/add calls as replacement.

The server owns schemas, serial forwarding and agent wording. The roomle-ui implementation is based on `feat/water-connection`; it owns fitting identity, compatibility, calculation, completion and restoration. The bridge still exposes six planner methods. Chat recovery treats discovery as read-only and distinguishes returned fitting results from pending/failed edits.


To see the fittings in `get-plan-images`, the agent opens the cabinet first with
`open-or-close-article` — the descriptions of `get-interior-design-options` and `get-plan-images`
say so; see [Doors and drawers](tool-executors.md#doors-and-drawers).

## Placement

D89 of the [behaviour reference](../../docs/hi-mcp-behaviour.md#interior-fittings-2026-10-20).
roomle-ui `hi-interior-design.ts`:

- **Position** (`interiorFittings`): the lowest corner of the fitting's own visible parts — their
  boxes through `fullMatrix`, nested fittings excluded —, relative to the parent's
  `positionRelativeToRoot` (the root's origin when the parent is the root), rounded to 0.01 mm.
  Part matrices are in group space when the group's `ver` is above 0 and are converted back with
  `groupPointToRoot` of `hi-plan-space.ts`. A fitting without parts reports its module origin.
- **Placement** (`stageInteriorEdit`): the command adds at the point R, calculates and measures the
  new fitting at A; when A differs, it adds once more on the pre-add copy at R + (R − A). A constant
  offset between the library's insertion frame and the parent frame lands exactly; what still
  differs is a library adjustment (C26 of the behaviour reference).
- **Retained settings**: a source setting is kept only when the calculation keeps it and no fitting
  moves; an insertion-derived height moves the fitting's parts, so it is reset (C28) and the
  placement from the point stands. A move or replace the library keeps at the source's place
  returns `changed: false` and names the source (C27).

How Furniture_Smith places its fittings (backend `HI_PRE_Roomle_Milestone_2`):

- A `FixedShelf` module (`me_Shelffixed01`) spans the whole interior (its `mod_Height` is the
  interior's height) and stands at the interior's inner corner, 19.5 mm above the carcase interior
  module it belongs to. The library turns the insertion point into the inputs `mod_ShelffixedPosX`
  = x and `mod_ShelffixedPosY` = y, measured from that corner whichever container the destination
  names, and draws the board (`part_Shelffixed`) at the corner + `mod_ShelffixedPosY`. Both inputs
  are assigned attributes of the module. The shelf splits the interior into a container below and
  one above the board. x has no effect on a board that spans the width.
- An `InnerDrawer` lands at the requested height; its parts start 20 mm off the requested z, which
  the library keeps (C26).

## Validation

Unit tests cover MCP schema rejection, exact scoped/legacy forwarding, serial reads, interior-only undo/redo comparison, browser transport and interrupted chat feedback. SDK tests cover staging, awaited restoration of cache and scene, and read-only replacement discovery in occupied parents with regenerated containers; the `interior fittings placed by their parts` tests cover a library that keeps the module at the interior's origin and places the part by the inserted height: the measured position in root and group space, a move by an offset, a transfer without a point, the corrective add, a library adjustment, a no-op that names the source and a replace at the measured height. The focused live smoke scenario covers discovery/addition, replacement and undo, using both “interior fitting” and “Interior Design”. It checks the restored instance and parent, actual placement, cabinet identity and the final answer. Acceptance evidence and library script identity are recorded in [the feature analysis](../feature-analysis/interior-design-sub-articles.md#implementation-evidence--2026-10-19). Furniture_Smith generates new container IDs across calculations and its modular front inserts may ignore requested vertical positions. Other libraries need their own acceptance runs to establish supported fitting and placement behaviour.
