# Bug analysis — a wall-level article of another category is taken for a floor unit

> **Type**: Bug analysis
> **Status**: Open — cause reproduced; implementation and unit-test plan ready, not implemented
> **Date**: 2026-10-17; revalidated 2026-10-18
> **Implementation and unit-test plan**: 2026-10-18
> **Base**: roomle-hi-example `1881ca4`, analysis branch `docs/revalidate-wall-level-articles`;
> roomle-ui `fix/wall-unit-heights-after-plinth-change` (`8cfd98e71`)
> **Backlog**: item 73 of [mcp-issues.md](../backlog/mcp-issues.md#73-a-wall-level-article-of-another-category-is-taken-for-a-floor-unit)

## Affected repositories

- **roomle-hi-example** — explain the existing library descriptions and mounting relations in
  the served rules and tool descriptions; test that contract and document it. This revision
  changes the analysis, backlog and their indexes only.
- **roomle-ui** — correct mounting interpretation in `hi-group-layout.ts`, docking cleanup and
  completion in `hi-tool-docking.ts`, orchestration in `hi-tool-commands.ts` and edit feedback
  in `hi-tool-hints.ts`, with regression tests, based on
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

## Implementation plan

**Scope and branches.** Keep the planning work on roomle-hi-example
`docs/revalidate-wall-level-articles`. At implementation time create roomle-ui
`fix/wall-level-article-relations` directly from `fix/wall-unit-heights-after-plinth-change`
(`8cfd98e71`). The library is used unchanged. A successful fix retains the requested neighbour,
mounting and explicit clearance through create, replace and carrier edits.

### 1. Make the floor/unknown distinction concrete

In `hi-group-layout.ts`, add one affirmative floor predicate using the **existing explicit**
base-unit and tall-unit category matches, excluding the existing wall/hood matches. Do not use
the numeric-height fallback of `isTallUnitArticle` as proof of floor mounting. A category such as
Utility or Cover Panels remains unknown to that predicate. Reuse the existing category patterns;
add no library-specific names, ids, values or height cutoffs.

The affirmative predicate limits the existing G34, G40, G43 and G63 corrections. This is a
narrowing of when those corrections apply; their behaviour and messages for positively recognized
floor units stay. Unknown articles without a relation or mounting evidence keep the current
default-row fallback, reported as a default rather than a claim about their capabilities.

### 2. Resolve wall rows once per layout

Keep the layout reasoning in `hi-group-layout.ts`, with one shared resolver returning a
`Set<string>` of root ids used at wall level in the supplied layout. Its consumers are the
relation compiler, docking completion and edit hints. It is recomputed from current input; it
is neither a catalog field nor persistent state.

- Seed it from existing wall/hood recognition and valid `above` relations on articles that are
  not affirmatively floor units. Validate the named neighbour and select the one relation the
  existing parser accepts before it contributes evidence. Self-links and missing neighbours
  supply no evidence.
- Seed unknown articles on the Bottom end of valid Top-to-Bottom docking, including reverse-only
  entries. This identifies the upper root, never its carrier. An unknown article's `onTop`
  remains a stacking request with its own gap; membership in an upper row must not rewrite
  that explicit request to the default hanging gap.
- For existing retained roots without new layout instructions, also accept carrier evidence
  from the planner's calculated group using `carriersOfUnitsAbove`. Use only matching retained
  root ids and article ids. A changed article or an explicit new relation supersedes the old
  placement. An arbitrary positive origin or input height is insufficient evidence.
- Spread membership across side relations and Bottom-to-Bottom side docking in both directions
  through unknown articles. Stop at recognized floor units and tall-unit junctions, so a wall
  row cannot turn a tall carrier or a neighbouring base row into wall units. Walk the graph
  with a visited set so ordering, reciprocal entries and cycles cannot cause repeated work.
- Leave structural cycle rejection and occupied-side correction with the existing algorithms.
  Only links retained by structural validation may establish row membership; recompute after
  a correction that changes the relevant links. Inferred defaults do not manufacture evidence
  for unrelated unknown articles.

Use the resolved membership consistently for anchoring on a floor root, defaults, wall-side
alignment, wall-row collision handling and the Top/Bottom choice in `pairOf`. A root already
resolved into a wall row is not a tall carrier merely because its height exceeds the old tall
height threshold. Keep `hangGapOf`'s existing formula and library fallback; exclude resolved
upper roots from the current group's tall-carrier candidates.

### 3. Integrate creation, replacement and merging

In `hi-tool-commands.ts`, move the existing pre-context read and agent-group-id resolution ahead
of mounting interpretation. For replacements read the calculated groups once before the load,
so retained wall roots with a non-touching link have geometry evidence. Supply that evidence
only internally; introduce no planner method, bridge field, calculation or probe load.

In `hi-group-layout.ts`, replace negative wall tests in G34/G40/G43 with affirmative floor
tests and resolved row membership. Unknown `above` keeps its gap; unknown side continuations
keep their neighbour. Existing known-wall corrections and positively known-floor controls stay.

In `hi-tool-docking.ts`:

- Narrow `dropFloorUnitsOnBaseUnits` to affirmatively recognized floor articles. Unknown upper
  roots retain their docking and offset, including reciprocal entries.
- Replace `connectUnreachedRoots`' direct category-only wall check with the shared layout
  result, preserving an upper component's row during connection.
- In `dockTarget`, an unknown article explicitly merged Bottom-to-Top above a floor carrier
  uses the same hanging-gap derivation when the y offset is omitted. Keep Top-to-Top partner
  correction limited to cases the existing wall recognition establishes. A supplied numeric
  y offset, including zero, stays as requested; absence and zero are distinct.
- Keep the occupied-side, free-vector and article-resolution algorithms; assert their existing
  results in the regression suite.

Using the existing hood recognition in completion also changes the current no-relation hood
test: it must hang above a carrier instead of joining the floor row. Treat that as an explicit
expected effect of removing the inconsistent category-only check.

### 4. Cover edit feedback without changing arrangement

In `hi-tool-hints.ts`, use the same resolved membership for the raw before/after groups.
Seed unknown upper roots from `carriersOfUnitsAbove` and spread through their side docking.
Use the existing room-space pose comparison for movement. Name a moved utility wall root or
panel in the upper-row hint and keep it out of the floor-leg list. Preserve catalog recognition
as a fallback for existing fixtures without calculated docking geometry.

Keep `hi-root-module-arrangement.ts`'s carrier detection and clearance-preserving implementation
from `8cfd98e71`. Add a regression using its real geometry path; do not create another movement
or height-correction mechanism.

### 5. Ship the served contract and reference together

In roomle-hi-example `hi-mcp-server.ts`, integrate the wording under
[Explain the existing library and the relations](#explain-the-existing-library-and-the-relations)
into the authoring rules and the two tool descriptions. Keep the existing short catalog
descriptions and the on-demand full descriptions. Update the merge description's omitted versus
explicit offset contract too.

Update `docs/hi-mcp-behaviour.md` (D34/D35 and G31/G34/G40/G43/G63, completion and affected
feedback), `docs/hi-mcp-server.md`, `.agents/skills/hi-authoring-rules.md`,
`.agents/skills/hi-mcp-tools.md`, and `.agents/context/layout-and-placement.md` /
`tool-executors.md` with the implemented behaviour. In roomle-ui update the touched HI guidelines
in the same change. Close out this analysis only after the fix and its checks are complete;
remove issue 73 from the backlog after local verification.

## Unit-test plan

Use the existing fixture builders and test files. Add the smallest catalog fixtures representing
the relevant facts: a wall panel in Cover Panels, an open wall unit in Utility, a recognized wall
unit, a recognized base unit and a tall unit. Keep the actual 720/1280/820/2100 mm heights where
used in expectations. Use neutral article ids in an additional variant. Mounting must work
without descriptions being parsed, type attributes, insertion-height markers or insert levels;
dimension ids continue to follow the existing `hangGapOf` contract.

The tests assert docking sent to the planner, preserved offsets, measured geometry and agent
feedback. They must not merely inspect the resolver's set.

| Case | Existing test file, under `homag-intelligence/__tests__/` | Expected result |
|---|---|---|
| Panel at either end of a wall row | `hi-group-layout-test.ts` | Parameterize `rightOf`/`leftOf`: the wall neighbour's Bottom side meets the panel's opposite Bottom side at offset zero. No floor correction or fallback neighbour. |
| Utility unit above a base | `hi-group-layout-test.ts` | Parameterize omitted gap, 0 and 500: Top-to-Bottom docking survives, y offsets are respectively 0 (2100 − 1280 − 820), 0 and 500. No “is no wall unit” or discarded-gap feedback. |
| Chained unknown finishing parts and root order | `hi-group-layout-test.ts` | Two unknown side continuations keep their wall neighbours even when listed before the wall seed; mixed retained docking and a new relation give the same chain. |
| Positive floor controls and false markers | `hi-group-layout-test.ts` | Retain the existing known base-above/base-beside-wall/onTop-base correction tests. A marker on a root or an empty insertion list does not change a known floor unit's treatment; unknown units without mounting evidence keep default fallback. Invalid/self relations do not seed a wall row. |
| Unknown article stacked on a tall unit | `hi-group-layout-test.ts` | `onTop`, its alignment and explicit gap remain stacking. A tall carrier beside a wall chain remains in the floor row. |
| Returned docking on replace | `hi-tool-commands/create-or-replace-groups-input-test.ts` | Through the actual tool pipeline, unknown upper docking on a recognized base keeps its offset. Parameterize forward-only, reverse-only and reciprocal context. The known-floor control still removes its docking and reports the pair once. |
| Retained detached wall row plus a new panel | `hi-tool-commands/create-or-replace-groups-input-test.ts` | The fake planner supplies raw vectors/positions with no vertical docking link. On replace, existing utility roots stay upper roots, the new panel joins their row, and a newly explicit instruction or changed article is not overwritten by stale geometry. Include the agent's group-id alias path. |
| Completion of a disconnected upper component | `hi-tool-commands/create-or-replace-groups-input-test.ts` | A component containing a utility wall seed and a panel connects at the upper row's free end, not a base-row end. The hood-without-a-relation test expects its derived hang instead of floor continuation. |
| Merge above a carrier | `hi-tool-commands/group-commands-test.ts` | An unknown-category article with known 720 mm height and explicit Top-to-Bottom pairing gets 660 mm when y is omitted against a 720 mm base and 2100 mm tall reference. Explicit 0 and 500 stay. Existing known wall/hood partner correction tests still pass. |
| Edit feedback for moved upper roots | `hi-tool-commands/group-commands-test.ts` | Give raw before/after docking geometry for a utility unit and its side panel. A carrier edit moves them: hint names both root/article ids. A floor unit or mere group-frame change is not reported as an upper-row move; a turned-leg hint excludes the upper roots. |
| Clearance after carrier/plinth change | `hi-root-module-arrangement-test.ts`, `glue-logic-test.ts` | Extend the existing detached-carrier cases with a 1280 mm utility article and explicit 500 mm clearance; carrier docking top +50 makes upper docking bottom +50, preserves 500 and moves once. Existing connected/detached, disabled-arrangement and no-double-move controls stay green. No claim that a side panel follows without an actual side docking link. |

In roomle-hi-example `hi-mcp-server/tests/hi-mcp-server.test.ts`, test the served contract through
the MCP client: instructions/`get-authoring-rules` and `tools/list` expose the mounting guidance,
the create description explains wall-row finishing parts, and merge describes an omitted versus
explicit offset. Use a focused set of assertions for meaning; do not snapshot all descriptions.
Retain the existing library-neutrality and no-internals tests. Existing
`tool-executors.test.ts` description-compaction tests already cover FUNCTION/AI_SELECTION_HINT
and full descriptions; add no duplicate compaction tests.

### Test execution and definition of done

1. Add the compiler and tool-pipeline reproductions first and run them against `8cfd98e71`.
   Panel/utility relation, replace cleanup and missing upper-root feedback cases must fail for
   their expected reason. Controls protecting current behaviour may pass already.
2. Implement the shared interpretation and run the targeted cases to green. Add the served-text
   contract assertions before editing that text; verify those assertions fail on current text.
3. Run the complete affected HI suites through the repository scripts. From roomle-ui
   `packages/web-sdk`:

   ```sh
   npm run test -- --run packages/homag-intelligence/__tests__/hi-group-layout-test.ts packages/homag-intelligence/__tests__/hi-tool-commands/create-or-replace-groups-input-test.ts packages/homag-intelligence/__tests__/hi-tool-commands/group-commands-test.ts packages/homag-intelligence/__tests__/hi-root-module-arrangement-test.ts packages/homag-intelligence/__tests__/glue-logic-test.ts
   ```

   Use the repository's supported Node runtime (its Volta pin), then run SDK type/lint and
   formatting checks through the configured scripts. The earlier Node 23 workaround records a
   completed baseline run; it is not the implementation's required runtime.
4. From roomle-hi-example `hi-mcp`, run `npm test` and `npm run typecheck`; from its root run
   `npm run lint`, `npm run format`, `npm run format:check`, and the Markdown link checker on
   touched documents. Run all HI tests once after the focused suites pass to cover placement and
   other consumers; broaden further only for a concrete failure or changed dependency.
5. Unit tests cannot establish the library's retained mounting or appearance. As the separate
   acceptance check, replay the two stored scenarios against the local UI branch and unchanged
   library, inspect the first result before model recovery and measure heights/docking.
   Isolate the panel-colour failure from placement. Add a stable utility-room prompt regression
   using the testing skill when that acceptance work is run.

The implementation is ready when new regressions pass, known-floor and existing arrangement
controls remain green, returned docking survives replace, feedback names the actual moved upper
roots, and the served rules describe the same behaviour. This plan contains no code change or
new test execution; the baseline results below remain the earlier validation evidence.

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
