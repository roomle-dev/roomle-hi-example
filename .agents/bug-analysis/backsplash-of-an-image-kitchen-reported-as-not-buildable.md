# Bug analysis — the backsplash of an image kitchen is reported as not buildable

> **Type**: Bug analysis
> **Status**: Open — analysis verified; implementation and unit-test plan, not implemented
> **Date**: 2026-10-17
> **Verified**: 2026-10-18
> **Base**: roomle-hi-example `docs/revalidate-wall-level-articles` (`b4865ca`);
> roomle-ui `fix/wall-level-article-relations` (`e4989a862`) — every roomle-ui change for this
> issue must start from this branch
> **Backlog**: [MCP issue 75](../backlog/mcp-issues.md#75-the-backsplash-of-an-image-kitchen-is-reported-as-not-buildable)

## Affected repositories

- **roomle-hi-example** — clarify the `notCarried` guidance of `create-or-replace-groups`, test
  the served description and the discovery of Bool switches through the existing tools, and
  update the behaviour reference, tool documentation and implementation context.
- **roomle-ui** — retain root-assigned Bool attributes in `compactMasterData` and test the
  compaction contract. Base the implementation branch on `fix/wall-level-article-relations`,
  not the older `fix/room-corners-at-openings` base of the original analysis.

## Verification verdict

The two-part root cause and the proposed fix are supported by the current code and stored
failures. The analysis needs these corrections and qualifications:

- The reproduction is also present in `mcp-test-2026-10-18_14-48-28`, runs 48, 50 and 51. Run
  51 sends heights 600 and 300, rather than the 500 and 300 of the older run.
- The stored master data has **61 served attributes and 210 excluded root-assigned attributes**.
  Of those excluded attributes, **12 are Bool and 198 are non-Bool**. Serving all 271 assigned
  attributes would be about 4.4 times the current count, not twenty-fold. The proposed Bool
  extension yields **73 attributes**, about 20% more.
- The older utility-room run 07 contains **one generated `mr_Countertop` root**, not three
  generated roots. Its three units carry `mod_CreateCountertop=true`; that is still a valid
  contrast with the omitted backsplash switch.
- A missing part is not necessarily unsupported. The recorded answer says it is "not included";
  the defect is that the available generation path is hidden and the instruction encourages a
  final omission report. The evidence does not establish that the model independently judged the
  part impossible.
- The exact generation/material sequence below follows from code inspection. A successful
  backsplash calculation with the real library is still an acceptance check, not a verified
  outcome of this investigation.

No productive code changes or new regression tests are implemented during this verification.

## Symptom and reproduction

Use `.temp/result/mcp-test-2026-10-18_14-48-28/gpt-6-astra/51-image-only-no-text/`.
The input is `docs/images/kitchen-4.png`, with no text. The agent reads the image and creates
two groups. In `run.json` and the `create-or-replace-groups` entry of `planner-calls.json`:

- Left group: `mod_BacksplashColor=216`, `mod_BacksplashHeight=600` in group attributes.
- Right group: the same colour, height 300.
- Neither group nor any authored root contains `mod_CreateBacksplash`.

In `order-data.json`, all 14 modules carrying `mod_CreateBacksplash` have false, and no
`mr_Backsplash` root exists. Two `mr_Countertop` roots exist; six units have
`mod_CreateCountertop=false`, eight true. The answer says: "The wood backsplash and connecting
window ledge are **not included**."

The same batch's runs 48 (`image-kitchen-left-wall`) and 50
(`image-planning-right-wall`) also send the material attributes without the switch; their order
data has no backsplash root. The older batch `mcp-test-2026-10-17_13-28-41` shows the same
omission in all three image tests. Its utility-room run 07 sends `mod_CreateCountertop=true`
as a group attribute, and its order data includes a generated worktop root.

These are stored reproductions. No new model/planner run is performed for this planning task.

## Investigation trace and root cause

All roomle-ui paths below are relative to
`packages/web-sdk/packages/homag-intelligence/` on `fix/wall-level-article-relations`
(`e4989a862`). roomle-hi-example references are at `b4865ca`.

1. **The description treats missing carriers as final.**
   [`hi-mcp-server.ts:405`](../../hi-mcp/hi-mcp-server/hi-mcp-server.ts#L405) says:
   "the library builds no part for them in this group, a backsplash or an end panel for example",
   followed by "nothing to undo; say in the answer which material is not built".
   It gives no recovery path. D65 of
   [the behaviour reference](../../docs/hi-mcp-behaviour.md#3-decisions) repeats that interpretation;
   the test at `tests/hi-mcp-server.test.ts:503` pins it.

2. **The material attributes survive compaction; the enabling switch does not.**
   In [the stored master data](../../docs/library-information/master-data.json),
   `mod_BacksplashColor` and `mod_BacksplashHeight` are Simple and assigned to
   `mr_Backsplash`, a `SubModule` of group `Root`. `isGeneratedRootModule`
   (`src/hi-plan-context.ts:244`) retains that generated root. The Bool switch
   `mod_CreateBacksplash` is Advanced and not `isMain`; its description says it starts
   generating the backsplashes. It belongs to the cabinet and finishing modules, rather than
   `mr_Backsplash`. `isCustomerFacingAttribute` (`:250–252`) accepts only
   `isMain === true || userRight === 'Simple'`; `compactMasterData` (`:269–280`) requires
   both root assignment and that predicate. The switch is removed.

3. **Neither discovery route can recover the missing attribute.**
   `createPlanContext` (`src/hi-plan-context.ts:1008`) returns the compacted master data.
   [`get-plan-context`](../../hi-mcp/hi-mcp-server/tool-executors.ts#L437) derives its
   default `attributes` section from it; [`find-attributes`](../../hi-mcp/hi-mcp-server/tool-executors.ts#L445)
   searches the same attributes and derives `rootModules` from the compacted module assignments
   (`:471–485`). Neither applies another visibility filter that could be changed to recover
   the switch. The catalog's `mainAttributes` (`src/hi-plan-context.ts:642–648`) is also no
   escape: it retains only `isMain` attributes.

4. **The worktop contrast is explained by the data.**
   `mod_CreateCountertop` is a Simple Bool and is served. `mod_CreateToekick` and
   `mod_CreateFingergrip` are Advanced Bools and are excluded like the backsplash switch.
   Replaying the compaction predicate over the stored master data confirms all four outcomes.

5. **`notCarried` accurately describes the current targets.**
   `src/hi-tool-commands.ts:628` runs `applyGroupWideAttributes`
   (`src/hi-tool-attributes.ts:363`) after loading and placing the groups. It forwards the
   group attributes with one `change-attributes` operation. `changeAttributes`
   (`src/hi-tools.ts:456–501`) resolves every target from the roots already loaded, before
   recalculation; no generated backsplash exists, so its material attributes have no targets.
   Skipped attributes become `groupAttributes.notCarried`
   (`src/hi-tool-attributes.ts:416–423`). If none of the attributes has a target, the existing
   operation throws and the tool reports the failure in `corrections` (`:455–460`).
   This fix changes neither result shape nor reporting path.

The exact causes are the customer-facing-only predicate at roomle-ui
`src/hi-plan-context.ts:276–280`, which hides the actionable library description, and the final
omission instruction at roomle-hi-example `hi-mcp/hi-mcp-server/hi-mcp-server.ts:405–406`.
The payload is legitimate. The tool builds the units asked for; the agent lacks the information
and guidance to generate the requested extra part.

## Proposed fix

### 1. Clarify the recovery in roomle-hi-example

Replace the `notCarried` clause of the `create-or-replace-groups` description with:

> notCarried: attributes no current module carries. For a requested part the library generates,
> use find-attributes to look for an enabling attribute on the units; if available, enable it,
> then set the part's attributes after it is generated. Report only what is still missing.

This wording is library-neutral, conditional on a requested part and an available enabling
attribute, and gives the order of the recovery. It replaces the existing clause rather than adding
a second rule. Keep `notCarried` accurate; it is not proof that the library cannot build the part.
An attribute without a generation path may remain unapplied and must still be reported.

### 2. Expose the switches in roomle-ui

In `compactMasterData`, keep an assigned attribute when:

```typescript
assignedAttributeIds.has(attribute.id) &&
  (isCustomerFacingAttribute(attribute) || attribute.type === MDType.Bool)
```

`MDType` is already imported. Keep the meaning and implementation of
`isCustomerFacingAttribute` unchanged. The broader selection belongs only in plan-context
compaction. The existing `attributeIds` set then keeps the Bool ids in each compacted module's
`attributes` as well, which `find-attributes` needs for its carrier list.

Keep the root-module restriction, attribute whitelist, selections, group settings and catalog
`mainAttributes` as they are. There is no library-specific id, group name or naming-convention
match. All 12 newly exposed Bools remain searchable by their existing library descriptions; nine
are design toggles rather than generation switches. That small vocabulary increase is the
tradeoff for a data-type rule that works across libraries. This is a discovery rule, not a claim
that every Bool enables generation.

### 3. Respect generation before materials

Two supported input paths have different ordering:

- **Switch in root attributes at creation:** it reaches the initial library calculation. If that
  calculation generates the part, the subsequent group-wide material operation can target it in
  the same `create-or-replace-groups` call.
- **Switch in group attributes, or recovery on an existing group:** the attribute operation
  resolves its targets before recalculation. When it generates a new part, the part's material
  attributes sent alongside the switch can still be skipped. After the settled enabling call,
  apply those attributes with `change-group-attribute` (`attributes` accepts several).
  The agent must not assume skipped values are queued or applied automatically.

Use this existing sequence; no retry loop, automatic generation, new guard, new tool or library
calculation change is needed. RoomleCore and ligna-store need no code changes: the former loads
the library's calculation, the latter consumes the same planner and MCP server.

## Implementation and unit-test plan

Implement on a focused roomle-hi-example fix branch and a new roomle-ui fix branch created from
`fix/wall-level-article-relations` (`e4989a862` at verification). Confirm that base is an
ancestor before making UI changes. Do not implement on, or reset to, the superseded base.

| Step | Change | Verification |
|---|---|---|
| 1 | In roomle-ui `__tests__/hi-plan-context-test.ts`, extend `describe('compactMasterData')` with the Bool cases below | Required producer regressions fail under the existing predicate |
| 2 | Change only the predicate in `src/hi-plan-context.ts` and its nearby description of the compacted vocabulary | New cases and existing compaction/catalog tests pass |
| 3 | In roomle-hi-example `hi-mcp-server/tests/hi-mcp-server.test.ts`, replace the final-omission test at :503; update the description in `hi-mcp-server.ts` | New text test fails before the wording change, passes after it |
| 4 | Add one cross-tool Bool discovery case in `hi-mcp-server/tests/tool-executors.test.ts` | Both the default vocabulary and `find-attributes` preserve the switch and its description; search names the carrying module |
| 5 | Update the documents listed below and run the relevant checks | No reference still describes the vocabulary as customer-facing only or treats missing carriers as permanent |
| 6 | With both changes loaded, verify generation/material ordering against the real library, then evaluate the three image prompts | Generated part and requested values exist; the final answer reflects the final plan |

The existing tests for skipped attributes and `notCarried` stay. The discovery test of step 4
covers a consumer that already accepts a Bool without selections; it is expected to pass before
the producer fix and does not substitute for step 1's failing regression.

### Unit-test cases

| Location | Fixture and assertion |
|---|---|
| roomle-ui `hi-plan-context-test.ts`, `compactMasterData` | Parameterize an assigned, non-main Bool with `userRight: 'Advanced'` and `'Master'`. Both survive in `compact.attributes` **and** the carrying module's `attributes`. Preserve id, name, desc, group, Bool type and optional selections through the existing whitelist. Use generic fixture ids. |
| Same suite, selection boundary | Include an unassigned Bool and a Bool assigned only to an ordinary submodule; neither is exposed. An Advanced/Master non-Bool assigned to a retained root stays excluded. Existing main/Simple attributes, generated-root materials and `groupSettings` retain their existing results. |
| roomle-hi-example `hi-mcp-server.test.ts`, tool-list description | Assert the conditional generated-part recovery, `find-attributes`, enabling before setting the part's attributes, and reporting only what remains missing. Assert the old "library builds no part" conclusion and the "backsplash or an end panel" example are absent from this clause. |
| roomle-hi-example `tool-executors.test.ts`, vocabulary/search | Provide compacted generic master data with a root-assigned Bool switch carrying a useful desc and no selections, plus a generated-part material. `get-plan-context({})` exposes both, and `find-attributes({ text: '<part name>' })` returns the switch with the unit module as carrier. This proves the existing consumers do not discard the producer's new vocabulary. |

Reuse the existing tests rather than duplicate unchanged command behaviour:
roomle-ui `hi-tools-test.ts:782` checks skipped attributes,
`create-or-replace-groups-placement-test.ts:1385` checks `notCarried` apart from corrections,
and the same materials suite covers generated-root overrides and colours after a replace.
Mocking a successful library generation in these suites would not prove that the actual library
generates a backsplash.

### Documentation in the implementation change

- [`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md): D65 and the create-result
  guidance; D48, D76 and §5.4 describe customer-facing **or root-assigned Bool** attributes.
  Preserve decision dates/source/state while updating their effective contract.
- [`docs/hi-mcp-server.md`](../../docs/hi-mcp-server.md),
  [server README](../../hi-mcp/hi-mcp-server/README.md),
  [`hi-mcp-tools.md`](../skills/hi-mcp-tools.md): vocabulary and `notCarried` recovery.
- [`hi-mcp-server.md`](../skills/hi-mcp-server.md) and
  [`context/tool-executors.md`](../context/tool-executors.md): the compacted vocabulary and
  generation-before-material sequence. Update the corresponding comments in
  `tool-executors.ts:468` and `agent-facing.ts:220` so they describe the same contract.
- Add a backsplash outcome to the existing three image tests' `expect` text in
  [`docs/test-prompts.json`](../../docs/test-prompts.json); keep the user prompts unchanged.
  The expectation asks for the part visible in the image when the library supports it and for
  an accurate final omission report when it does not.

### Acceptance with the real library

First use a minimal base-unit group to check that enabling `mod_CreateBacksplash` actually
creates `mr_Backsplash`. Verify both input paths above: switch on the root at creation with group
materials, and switch through a group attribute followed by the material call. Check actual
generated-root colour and height, not just that the switch is true or the attribute call succeeded.
A generation or material failure here reopens the analysis before adding further code.

Then evaluate `image-kitchen-left-wall`, `image-planning-right-wall` and
`image-only-no-text` against a local planner built from the specified roomle-ui base plus this
fix, using the stored failing model for comparison. Keep the same prompts and images.
Use `run.json`, `order-data.json`, the final context and rendering to establish:

- The model finds/sets the enabling switch on the relevant units, or reads it from the initial
  vocabulary and enables it at creation.
- The intended backsplash exists and carries the requested colour and height after any follow-up.
- The final answer reports the actual remaining omissions rather than the first `notCarried`
  result. Preserve genuine omissions; do not require all generated parts on all units.

These checks are model/library acceptance checks, separate from the deterministic unit tests.
The existing "pass / model finding" report classification alone does not establish success.

## Alternatives considered

- **Text only:** cannot recover a switch missing from both discovery tools.
- **Library metadata only:** marking `mod_CreateBacksplash` Simple would expose it in this
  library; the sibling switches have the same visibility gap. This is an alternative to the
  roomle-ui predicate change, not a dependency of the recommended plan. It still needs the
  instruction fix. No library API, process or calculation change is proposed.
- **Expose every assigned attribute:** 271 instead of 61 in the stored library, including 198
  non-facing non-Bools unrelated to this recovery.
- **Infer or set a switch automatically:** there is no explicit metadata link from a generated
  module to its enabling attribute. Matching one library's ids/group names embeds library content
  in tool logic; a Bool alone does not prove a generation relationship or user intent.
- **Name the generated carrier in every `notCarried` result:** may help identify the material
  owner, but does not expose the switch and is unnecessary for this fix.
- **Reject the material attributes or change the kernel/library calculation:** the requested
  content is legitimate. Existing discovery and attribute tools can support it once the switch
  and recovery guidance reach the agent. No new guard is justified.

## Verification performed

On the bases recorded above, before implementation:

- Rechecked the relevant production paths, existing tests and stored master data; replayed the
  current/proposed selection predicates (61 → 73 attributes).
- Inspected both stored batches' image payloads and order data and the older utility-room
  contrast. This validates the omitted-switch failure, not a successful generation.
- roomle-hi-example, from `hi-mcp/`:
  `npm test -- hi-mcp-server/tests/hi-mcp-server.test.ts hi-mcp-server/tests/tool-executors.test.ts`
  — **145 tests passed in 2 files**.
- roomle-ui, from `packages/web-sdk/`, with its installed Node 24.12.0 first on PATH:
  `npm run test -- --run hi-plan-context-test hi-tools-test create-or-replace-groups-placement-test`
  — **264 tests passed in 3 files**. The initial shell-selected Node 20.10.0 cannot start this
  Vitest version; using the repository's declared Node 24.12.0 resolves that runtime mismatch.

For implementation, rerun these suites, then the full HI workspace tests and the broader
`homag-intelligence` SDK tests once; run `npm run typecheck`, `npm run lint` and
`npm run format:check` in roomle-hi-example, and the relevant SDK type/lint/format scripts in
roomle-ui. Run the real-library acceptance checks only after both implementations are loaded.
Baseline passes do not prove the proposed fix or the model's recovery; those remain unimplemented
and unverified.
