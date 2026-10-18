# Bug analysis — a wall-level article of another category is taken for a floor unit

> **Type**: Bug analysis
> **Status**: Open — cause reproduced; revised fix proposed, not implemented
> **Date**: 2026-10-17; revalidated 2026-10-18
> **Base**: roomle-hi-example `1881ca4`, analysis branch `docs/revalidate-wall-level-articles`;
> roomle-ui `fix/wall-unit-heights-after-plinth-change` (`8cfd98e71`)
> **Backlog**: item 73 of [mcp-issues.md](../backlog/mcp-issues.md#73-a-wall-level-article-of-another-category-is-taken-for-a-floor-unit)

## Affected repositories

- **roomle-hi-example** — explain the existing library descriptions and mounting relations in
  the served rules and tool descriptions; test that contract and document it. This revision
  changes the analysis, backlog and their indexes only.
- **roomle-ui** — correct the interpretation of mounting intent in `hi-group-layout.ts` and
  matching docking cleanup in `hi-tool-docking.ts`, with regression tests, based on
  `fix/wall-unit-heights-after-plinth-change` and preserving its arrangement fix.

**The HOMAG Furniture_Smith library stays as it is.** No change to its calculation, API,
templates, categories or insert-level output is a prerequisite or fallback. RoomleCore and
ligna-store need no change for this proposal: the MCP interface and its roomle-ui tool commands
must explain and use the capabilities the library already offers.

## Verdict on the previous proposal

The relation rewrites and their immediate cause are reproducible. The proposed fix is rejected:
reading insert levels absent from the supplied templates cannot fix these cases, and requiring
HOMAG to supply them moves responsibility to the wrong component.

A category that does not identify a wall unit is **unknown mounting information**, not evidence
of floor mounting. The compiler turns a lack of recognition into a positive claim and overrides
a meaningful relation.

The dismissal of a served-text change is also wrong. The MCP must explain how the agent selects
and mounts articles using existing library data. Text alone cannot repair these reproductions:
the agent already chose the right articles and relations, which the tool then changed.

## Symptom and reproduction

**Wall-row finishing panel.** In `mcp-test-2026-10-16_19-30-19`, gpt-6.1-sol,
`50-kitchen-conversation`, the first `create-or-replace-groups` sends:

```json
{ "id": "wallend", "articleId": "W35O", "rightOf": "cups" }
```

`cups` is `OFKB60`, hanging `above` the base unit `return`. The tool reports:

```text
floor unit 'wallend' cannot stand rightOf the wall unit 'cups' - it continues the floor row
root 'wallend' names no neighbour - it was put rightOf 'endtall'
```

Side-vector conflict completion subsequently moves the panel to the free end of the floor leg.
The same payload also has a panel-colour calculation error. That is separate evidence: retaining
the intended docking does not prove that every material combination of this payload calculates.

**Utility wall units.** In `mcp-test-2026-10-17_13-28-41`, gpt-6-astra,
`54-random-1-utility-room-right-wall-with-wall-units`, turn 2 asks for an open wall unit above
each of two base units. The second create call (`planner-calls.json`, bridge call id 8) sends
two `HWR_WR600V1` roots `above` the existing `HWR_UB600` roots. Both become `rightOf`:

```text
root 'openwall1' is no wall unit - it stands rightOf 'b82d67ff-…' instead of above it
root 'openwall2' is no wall unit - it stands rightOf '25f6650f-…' instead of above it
```

The agent undoes the result and uses two merge calls with explicit Top-to-Bottom docking and a
500 mm gap, plus attribute overrides. That recovery shows the existing planning path can mount
the articles; it does not establish that all those overrides are necessary.

The run directories under `.temp/result/` contain `run.json`, `planner-calls.json` and the final
plan context. They are local evidence, not portable links or fixtures.

## Investigation trace

roomle-ui source references below are relative to
`packages/web-sdk/packages/homag-intelligence/src/` at `8cfd98e71`.

1. **The library already describes the intended use.** The stored
   [article catalog](../../docs/library-information/article.json) says:

   | Article | Category | Existing description |
   |---|---|---|
   | `W35O` | Kitchen / Cover Panels / Side Panels | FUNCTION: “Wall-unit side / cover panel.” AI_SELECTION_HINT: “Select to finish the exposed side of a wall unit.” |
   | `HWR_WR600V1` | Utility | FUNCTION: “Utility-room open wall unit, 60 cm wide, with full-height shelves.” AI_SELECTION_HINT: “Select for fully open wall shelving in a utility room.” |

   Both signals survive `shortDescription` (`hi-mcp/hi-mcp-server/agent-facing.ts:185`), which
   retains FUNCTION and AI_SELECTION_HINT. Full placement and requirements are available through
   `articleDescriptions`. Missing descriptive data is not the cause of these choices; expanding
   every catalog description is unnecessary for this fix.

2. **The classifier ignores that meaning.** `isWallUnitArticle` (`hi-group-layout.ts:70`)
   tests the category for “Wall Units”/“Wallunits” or recognizes a hood module. It returns false
   for both articles. This is a recognition heuristic, not a complete mounting-capability model.
   `relationsToDocking` (`:190`) reads the catalog article, then uses that boolean as though it
   described every article's allowed mounting.

3. **The explicit relation is destroyed.** `above && !isWall(root)` becomes `rightOf`
   (`hi-group-layout.ts:244`). A non-recognized article beside a recognized wall unit loses its
   relation (`:270`), then the default-link pass (`:398`) places it in the floor row. Sending
   `gapMm` cannot rescue `above`: after the rewrite the gap is discarded as invalid for a side
   relation (`:288`). The tool changes the intent before the library calculates the group.

4. **A replace can repeat the mistake through docking cleanup.**
   `dropFloorUnitsOnBaseUnits` (`hi-tool-docking.ts:982`) drops Top-to-Bottom docking to a base
   article when the other article is not recognized as a wall unit (`:1010`). It runs before
   `relationsToDocking` (`hi-tool-commands.ts:335`). A corrected create alone is insufficient:
   resubmitting returned `contextData` must retain the mounting too.

5. **Insert levels are neither available here nor an exclusive capability declaration.**
   `compactArticle` copies `root.insertLevelInfos` to `insertLevels`
   (`hi-plan-context.ts:654`). All 111 stored articles lack a nonempty insert-level list. The
   model describes suggested insertion heights and separately has `insertLevelFixed`
   (`model/oc-scripts-domain.model.ts:152`); default floor insertion does not prove that an
   article cannot be docked above another. The previous claim that any positive suggested
   height uniquely identifies a wall article was not established.

6. **Library attributes are evidence for the agent, not new classifier constants.** The utility
   article carries `mod_TypeElement: WallUnit`; the panel carries `mod_HeightPosInsertion: 1380`.
   These reach the catalog through `mainAttributes` and `dimensions`. Conversely the
   washing-machine article `HWR_WM700` carries `mod_PlacementLevels: WallHanging` while belonging
   to the base/appliance row. Neither a hardcoded attribute/value test nor “positive height means
   wall unit” is a sound replacement. Returned floor roots also carry positive insertion heights
   from their plinth. Attribute overrides configure an article; they are not proof of a
   catalog-wide capability.

7. **The required base branch solves a different stage.** Commit `8cfd98e71` changes
   `moveUnitsAboveWithTheirCarriers` (`hi-root-module-arrangement.ts:216`): after a carrier's
   docking top changes, an unchanged unit above it follows while keeping measured clearance.
   It changes neither the classifier nor the offending corrections. This issue needs that fix
   underneath it, but must first produce the mounting for the arrangement to preserve.

## Root cause

The MCP promises relations expressing layout intent, while its implementation uses an incomplete
category classifier to overrule them. In particular, `!isWallUnitArticle` is used as proof of
floor mounting. The library and agent already supply enough meaning for these requests; the
tool discards it. This is an MCP contract and correction problem, not a missing library feature.

## Revised fix direction

### Explain the existing library and the relations

Integrate this contract into the authoring rules and descriptions of `get-plan-context` and
`create-or-replace-groups` (`hi-mcp/hi-mcp-server/hi-mcp-server.ts:17`, `:190`, `:372`).
Proposed wording:

> Choose an article and its mounting settings from its descriptions and attributes. Categories
> organize the catalog. For an article used at wall level, `above` names the unit below it and
> `gapMm` sets the clearance; `rightOf` or `leftOf` continues that wall row, including its
> finishing parts. Fetch `articleDescriptions` when its mounting requirements are unclear.

Retain the automatic hang-gap explanation. No article ids, attribute ids, value names or fixed
mounting heights enter the served rules. The two short descriptions suffice; the full description
remains available for a question about requirements. Ship this wording with the tool correction,
so it describes behaviour the agent can use.

### Preserve mounting intent when category recognition is incomplete

Change the correction decision rather than requiring more library output:

- Distinguish recognized floor mounting from mounting the classifier does not establish.
  Absence of a wall-category match, an empty insert-level list and a height threshold alone
  are not affirmative floor evidence.
- Preserve explicit `above` for an article of unknown mounting, including `gapMm`. Preserve
  its `rightOf` / `leftOf` link into an established wall row, including a chain of finishing or
  utility articles. Determine the row from relations before applying defaults, so root order
  does not change that interpretation.
- Treat those relations as mounting intent for **this layout**, not a mutation of the catalog
  article's global type. Retain floor corrections only where floor mounting is positively
  identified; do not blanket-classify every unknown article as a wall unit.
- Apply the same distinction to `dropFloorUnitsOnBaseUnits`, so an unknown category does not
  erase returned Top-to-Bottom docking on the next replace. Read reciprocal docking too.
- Check completion and hints against that distinction. `connectUnreachedRoots`
  (`hi-tool-docking.ts:681`) tests the category directly, while moved-wall and turned-leg hints
  (`hi-tool-hints.ts:153`, `:195`) use `isWallUnitArticle`. They do not automatically inherit a
  layout-specific mounting decision. Existing groups provide actual docking and arrangement
  evidence; their position must not become a permanent catalog classification.

Use the existing relations and docking first. These reproductions justify no new agent field,
metadata schema, English-prose classifier or library adapter. Where the tool cannot establish
that explicit mounting is wrong, it must not reroute it to the floor and report its guess as
fact. Actual calculation failures retain existing `notLoaded` feedback and other buildable
content. No new guard is proposed.

## Heights and limits of the evidence

Bottom-to-Bottom docking aligns a panel with its actual wall neighbour. Its catalog insertion
height does not guarantee its final height, particularly after a plinth change.

The existing `hangGapOf` (`hi-group-layout.ts:141`) computes a default from catalog/root heights.
The stored utility defaults give `2100 - 1280 - 820 = 0`. That does not establish the recovery's
500 mm clearance or prove the desired visual result. Test the default separately from explicit
`gapMm: 500`, measure the result and library adjustments, and preserve the base branch's
clearance behaviour. Replacing the general height heuristics is outside this minimum fix.

## Implementation and acceptance checks

1. Branch roomle-ui from `fix/wall-unit-heights-after-plinth-change` (`8cfd98e71`). Add failing
   regressions with unchanged library facts: no fabricated insert levels or moved categories.
   Compile a panel beside a wall unit, a utility unit above a base, and the utility unit with an
   explicit gap. Assert retained neighbours, vectors, gap and absence of false floor corrections.
2. Correct unknown mounting in the compiler and docking cleanup. Test a returned group resubmitted
   unchanged, reciprocal docking, chains of finishing parts, and existing docking with new
   relations. Keep known floor-unit correction tests as controls. An unrelated article without a
   relation must not acquire wall mounting merely because it has a positive height attribute.
3. Verify completion and edit feedback. Keep the existing arrangement fix. The panel must stay
   beside its wall neighbour and the utility unit must keep its clearance after a carrier/plinth
   height change, including when a non-touching docking link is lost.
4. Integrate the served wording and tests in roomle-hi-example. Update
   [hi-mcp-behaviour.md](../../docs/hi-mcp-behaviour.md) (D34, D35, G34, G40, G63 and affected
   completion/feedback), [hi-mcp-server.md](../../docs/hi-mcp-server.md), authoring/tool skills
   and relevant [implementation context](../context/README.md) with the implementation.
   Do not describe the proposal as current behaviour yet.
5. Replay both scenarios against the local UI branch and existing library. Isolate the panel-colour
   failure from placement; inspect the first create/replace result and measured heights, not only
   the final image after agent recovery. Add a stable utility-room prompt regression: the stored
   random prompt is not a durable test identifier. Success needs neither an undo-and-merge
   workaround nor a library change.

## Validation performed for this revision

- Read the stored catalog and both run payloads. Executed the actual `compactArticle`,
  `isWallUnitArticle`, `relationsToDocking` and `dropFloorUnitsOnBaseUnits` from roomle-ui
  `8cfd98e71`, bundled in memory with the installed esbuild, against the stored catalog and
  master data. Production source was unchanged.
- Reproduced the panel moving to the base row; utility `above` becoming `rightOf`; explicit
  `gapMm: 500` being discarded; and raw Top-to-Bottom docking with that gap being dropped on
  a kitchen base unit. Confirmed zero nonempty insert-level lists across 111 compacted articles.
- Existing layout and arrangement suites: **2 files, 139 tests passed**. Command from roomle-ui
  `packages/web-sdk`:

  ```sh
  volta run --node 23.5.0 npm run test -- --run packages/homag-intelligence/__tests__/hi-group-layout-test.ts packages/homag-intelligence/__tests__/hi-root-module-arrangement-test.ts
  ```

  The initial repository-selected runtime failed before tests started because `node:util` did
  not export `styleText`; the explicit installed runtime above ran successfully.
- This validates the cause and required branch's baseline, **not an implemented fix**. No new
  model/planner session or visual verification was run. The acceptance checks remain implementation
  work.
