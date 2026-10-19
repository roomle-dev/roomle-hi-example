# Bug analysis — a swap of a widened unit is refused for want of a docking vector

> **Type**: Bug analysis
> **Status**: Open — feedback and recovery implemented and unit verified; final live replay, library descriptions and agent acceptance pending
> **Date**: 2026-10-18
> **Base**: roomle-hi-example `master` (`65c66f8`), verified on `docs/verify-mcp-74-78`;
> roomle-ui `fix/generated-part-switch-discovery` (`cf377cfd4`), descended from
> `fix/room-corners-at-openings` (`a008be42d`)
> **Implementation base**: roomle-ui `origin/release/bo-test` (`f15c22cc3`, checked
> 2026-10-19); the earlier branch names above record investigation context, not the required base
> **Backlog**: [item 78](../backlog/library-issues.md#78-tall-unit-descriptions-omit-width-dependent-door-arrangements)

## Affected repositories

- **roomle-ui** — surface library calculation errors after attribute edits, at the tool-result
  boundary (`packages/web-sdk/packages/homag-intelligence/src/hi-tool-attributes.ts:231`,
  `withLibraryChanges`, called by both attribute tools in `hi-tool-commands.ts:957,1013`).
  Keep the applied changes and name the affected roots, the diagnostic and the recovery action.
  Add tests through the tool commands backed by the glue logic. The implementation branch
  starts directly from `origin/release/bo-test`, as required by the user.
  Recovery also changes `hi-root-module-arrangement.ts`: tolerate absent original vectors
  when selecting a mode and require complete article-root bounds for wall-distance adjustment.
- **roomle-hi-example** — update the attribute-tool result contract in
  `docs/hi-mcp-behaviour.md`, `docs/hi-mcp-server.md`, the tool skill and implementation context
  when the fix is implemented; test that feedback survives the MCP result compaction. Adjust
  `edit-swap-units` acceptance to distinguish a widened paired-door unit from the remaining
  single-door units. The remaining library-data work is tracked separately in backlog item 78.

The **HI library data** also needs a description follow-up: resizing this article can change
its door configuration, so an article described as having one door cannot justify forcing a
single-door hinge value at every width. This is descriptive data, not a calculation change.

## Symptom and reproduction

Widen the last `HTB60` of `three-tall-units` to 900 mm, then swap the first and last units.
The widened root has no docking vectors, and the swap reports a dropped `RightBottom` docking.
The swap returns successfully with a correction and changes the plan; the model then undoes it.
The title describes the user-visible outcome, not a server guard or refusal.

**Reproduce.** `mcp-test-2026-10-18_14-48-28`, gpt-6-astra 32, `edit-swap-units`:
`.temp/result/mcp-test-2026-10-18_14-48-28/gpt-6-astra/32-edit-swap-units/`.
The session report identifies the local planner as roomle-ui `e4989a862` on :5173.

Group `064a7d91-b583-4883-b71b-95c324d3d824` has the roots:

| Place before the edit | Root id prefix | Article | Initial width |
|---|---|---|---|
| First | `0010443c` | `HTB60` | 600 mm |
| Middle | `a7271f1b` | `HTB60` | 600 mm |
| Last, at the wall | `8774cac2` | `HTB60` | 600 mm |

1. `change-module-attribute` on `8774cac2-8b83-405d-b88c-f0e5cd2452fb`,
   `attributeId: "mod_Width"`, `value: 900`: the answer claims success with no calculation warning.
2. `swap-root-modules` on `0010443c-519a-437b-8fe5-364f13887ca4` and `8774cac2…`:

```text
swap-root-modules: '8774cac2-8b83-405d-b88c-f0e5cd2452fb' has no docking vector 'RightBottom' - its docking to 'a7271f1b-50d5-4b50-97ca-7a5bf75f77fa' was dropped
```

3. The model calls `undo`. The final `plan-context.json` has the original order with the last
   root at width 900 and `dockingVectors: []`. `planner-calls.json` records `ok: true` for the
   width change and the swap, followed by `undo`.

The decisive evidence is in the root's `logMessages` inside `plan.xml`'s
`externalConfiguration`, which the compact plan context does not expose:

```text
Error 14019: Could not find entry in tab_DoorSettings for input value: TallUnit - All - Standard - 240 - mr_StorageunitSingle - 900 - Automatic - Right - Automatic
```

It is followed by a `RealDoorDirection` exception and downstream JSON errors. The root keeps
`mod_DoorDirectionSelection: "Right"` as an input, has no `dockInfos`, and its `mf_Door` has no
parts. This is a failed library calculation, not just missing docking metadata.

## Investigation trace

Code references below are in roomle-ui `packages/web-sdk/packages/homag-intelligence/src/`
unless prefixed with a repository path.

1. **The width / hinge combination explains the controls.** Decoding the saved plan XML gives:

   | Run | Widened root's hinge input | Calculated door direction | Docking vectors | Result |
   |---|---|---|---|---|
   | 2026-10-17 13:28, gpt-6-astra 32 | `Automatic` | `LeftRight` | 6 | Swap succeeds |
   | 2026-10-17 18:40, gpt-5-mini 32 | `Right` | Calculation fails | 0 | Swap applies with dropped docking; no undo |
   | 2026-10-18 08:45, gpt-6.1-sol 32 | `Right` | Calculation fails | 0 | Swap followed by undo |
   | 2026-10-18 14:48, gpt-6-astra 32 | `Right` | Calculation fails | 0 | Swap followed by undo |
   | 2026-10-18 08:45, gpt-6.1-sol 16, first unit widened | `Automatic` | `LeftRight` | 6 | Width change succeeds |

   In the last control the untouched final 600 mm unit keeps `Right` and six vectors. These
   cases do not isolate position: they differ in the hinge input of the widened unit. The
   successful 900 mm article uses paired-door direction despite its description saying one
   door. The former theories of random vector loss or a wall-side second calculation are not
   supported by this comparison.
2. **The authoring information permits resizing without describing this configuration change.**
   `hi-mcp/hi-mcp-server/hi-mcp-server.ts:24` explains that a different size is the same article
   with its size attribute changed. The saved `HTB60.desc` says "with 1 door" and "behind one
   door" without a width qualification. The door-direction description distinguishes single
   from paired doors, but does not tell the agent that this resize changes that distinction.
   A legitimate size request retains a now-incompatible existing hinge input.
3. **The library calculation returns the failed root and its diagnostics.**
   `changeAttributes` (`hi-tools.ts:456`) calls `modifyAttributesOfModules`
   (`glue-logic.ts:2650`); `_runGroupCalculation` (`:2014`) uses `_calculate` (`:3065`),
   `_updatePosData` (`:3255`) and `libraryData.calculateGroup`. The library export is wired in
   `homag-intelligence.ts:159-161`. `_takeOverPropertiesFromOriginalGroup` (`glue-logic.ts:3287`)
   restores position, context and article information; it does not invent vectors or front
   geometry after a failed calculation. `_logFailedRootModules` (`:2073`) logs errors to the
   browser console, and `_storeCalculatedGroup` (`:2063`) stores the calculated result.
4. **The attribute tool hides the useful diagnostic.** `change-module-attribute`
   (`hi-tool-commands.ts:859-965`) calls `withLibraryChanges`
   (`hi-tool-attributes.ts:231-251`). That helper compares attribute values and reports library
   adjustments; it does not read raw root `logMessages`. `shapeRoot`
   (`hi-plan-context.ts:689-710`) omits those messages. The MCP server's
   `compactAttributeResult` (`hi-mcp/hi-mcp-server/tool-executors.ts:344-352`) then returns
   command, group ids, changed-module ids and corrections. Neither the first result nor the
   next compact context tells the agent why the root is incomplete.
5. **The swap reports a downstream symptom.** `swapRootModules` (`hi-tools.ts:908`) calls
   `handOver` (`:954-972`), which reads `dockingVectorNames(newOwner)`
   (`hi-plan-context.ts:310`) and drops the side link at `hi-tools.ts:967` when no vector exists.
   It still calls `arrangeAndLoad` (`:997`). It does not refuse or fabricate the missing
   inventory. The correction proves the inventory was already missing when the swap began.
6. **There is an existing feedback pattern to follow.** `create-or-replace-groups`
   (`hi-tool-commands.ts:654-689`) reads raw groups after the operation, reports a root's first
   Error/Fatal diagnostic and asks for corrected values or another article, while retaining
   loaded content. Attribute edits need that information too. The existing test
   `keeps the change and logs the root module the library reports an error for`
   (`__tests__/glue-logic-test.ts:2699`) deliberately models a root losing its `dockInfos` on a
   door-settings error. Its expectation is to keep the applied edit, not restore old geometry.

## Root cause

The stored failing configuration is width 900 with an explicit single-side hinge input `Right`;
the library cannot calculate that door-settings combination. The saved successful configuration
at the same width uses `Automatic` and resolves to `LeftRight` with complete geometry.

The tool-level defect is missing feedback about the failed calculation at
`hi-tool-attributes.ts:231-251` / `hi-tool-commands.ts:957`. It leaves the agent treating the
width change as complete, until the subsequent swap reports the absent docking vector. The
article description also describes only its nominal single-door configuration, which gives the
agent no basis to revise the hinge input after resizing.

The absence of a `dockInfos` copy in `_takeOverPropertiesFromOriginalGroup` is not established as
a defect. Restoring those vectors would conceal the error while leaving the front unbuilt.

## Proposed clean fix

1. **Expose the calculation diagnostic in the attribute result.** Extend the existing shared
   attribute-result path (`withLibraryChanges`, both attribute tools) to read the settled raw
   groups and name affected roots with Error/Fatal messages. Report the first diagnostic line
   and ask the agent to check the requested value and retained overrides against the library
   data, correct the incompatible values or replace the article. Keep the edit and other roots;
   report partial calculation through `corrections`, which already survives MCP compaction.
   Cover group-attribute changes too, and verify errors from a final follow-up calculation are
   included. The create/replace pattern supplies the existing wording and retention contract.
2. **Clarify the library descriptions.** The article and door-direction descriptions must say
   how the door arrangement depends on size and which input a paired configuration takes.
   The stored result establishes `Automatic → LeftRight` at width 900; an explicit `LeftRight`
   recovery remains a live-library acceptance check. Put library-specific facts in data, never
   in a served rule or an automatic tool correction that hard-codes this attribute or width.
3. **Recover the requested plan through valid inputs.** The agent uses the diagnostic and data
   to correct the hinge setting, verifies complete calculation, then swaps the units. Keep the
   outer-hinge requirement for the actual door arrangement: a paired unit has two outer hinges;
   it must not receive a single-side value just because it is now the row's first unit (D84).
   `edit-swap-units` acceptance needs that distinction after the resize.

No new guard is proposed. The planner continues to keep valid changes and lets the agent repair
the failing configuration. `swapRootModules`, the kernel and ligna-store need no special case.

## Rejected approaches

- **Copy or reconstruct old `dockInfos` after any empty result.** A library error removed the
  front as well as the vectors. Old endpoints are also stale after resizing. Supplying vectors
  would make an incomplete article appear dockable without fixing the failed calculation.
- **Keep the swap link despite the absent vector, or refuse all swaps with missing vectors.**
  Both address the symptom after the width edit; neither exposes its actual cause.
- **Silently reset the hinge setting.** It may be a deliberate user input. The server must not
  encode this library's attribute, width threshold or door-settings combinations.
- **Change the library calculation to accept every combination or return old geometry.**
  This analysis does not establish a library formula bug. The supported configurations belong
  in descriptions, and calculation feedback belongs in the tools.
- **Require every attribute edit to return the entire raw group.** A short root-specific
  diagnostic preserves the compact result contract (D62) and gives the agent the missing fact.

## Verification and acceptance

On 2026-10-18 the five cases above were extracted from their saved `plan.xml` files, including
root inputs, vector counts, first calculation diagnostics and resolved `mf_Door` direction.
The failing gpt-6-astra run also has zero `mf_Door.parts`; the successful control has generated
front parts. A compact evidence extract is retained locally under `.temp/verify-mcp-74-78/`.

453 existing SDK tests passed across `hi-group-layout-test.ts`,
`hi-root-module-arrangement-test.ts`, `hi-tools-test.ts` and `glue-logic-test.ts`; this includes
the calculation-error retention test, not a test of the proposed feedback fix. The 78 MCP
server registration / served-text tests passed. Run the SDK via its npm script with Homebrew
Node 25.6.1; the default Node 20.10.0 cannot start the installed runner (`node:util.styleText`).

No production code was changed, and no new live library/model run was performed. Required
regressions and acceptance before closing:

- Through the actual tool/glue path, apply an attribute to a root whose calculation fails:
  retain the edit, report its diagnostic and root id, preserve the other roots, and do not
  invent `dockInfos`. Verify the final calculation's messages and both attribute tools.
- At the MCP boundary, retain the diagnostic through `compactAttributeResult`.
- On the real library, replay the failing width / hinge inputs, recover with a supported
  paired-door input, then swap. Require built front geometry, docking vectors, a contiguous
  2100 mm row, the 900 mm unit in the back corner and appropriate outer hinges. A dropped link
  followed by undo is a failure.

The saved inputs explain the pass/fail difference; they do not establish why the seed plan's
hinge input differed between sessions. The exact library source branch that omits the vectors
is not needed to diagnose the observed Error 14019, but a live recovery still needs checking.

## Independent validation — 2026-10-19

**Verdict: the diagnosis and proposed feedback boundary are supported.** Reviewed against
roomle-hi-example `master` (`29c6d22`) and roomle-ui `feat/hi-mcp-api-refactoring`
(`6771dc7e1`). The roomle-ui checkout retains `a008be42d` as an ancestor. The relevant
attribute-result, calculation and swap implementations still match the investigation above.

Decoded all five saved XML configurations again and asserted their values directly, rather
than relying on the previous evidence extract. Both 900 mm `Automatic` controls have six
docking vectors, `LeftRight` door direction, 73 door parts and no Error/Fatal diagnostics.
All three 900 mm `Right` cases have Error 14019, zero docking vectors and zero door parts.
The planner-call records mark the width edits and swaps successful; the two later failing
runs then undo the swap. The local gpt-6-astra console log also records empty attribute-tool
feedback followed by the swap's dropped-link correction.

The code confirms the proposed fix location: `withLibraryChanges` compares shaped attribute
values, `shapeRoot` omits `logMessages`, and `compactAttributeResult` retains `corrections`.
The existing create/replace path reads raw root Error/Fatal messages after the operation and
keeps the loaded roots. Reusing that diagnostic policy for both attribute tools fits the
current compact result contract. Copying old docking vectors would leave the missing door
geometry unresolved.

Existing regression suites run for this review:

- **481 SDK tests passed** across `hi-tools-test.ts`, `glue-logic-test.ts`,
  `hi-tool-commands/group-commands-test.ts` and
  `hi-tool-commands/create-or-replace-groups-placement-test.ts`.
- **147 MCP tests passed** across `tool-executors.test.ts` and `hi-mcp-server.test.ts`.
- **Five saved-case assertions passed.** The independent extract is local scratch evidence
  at `.temp/validate-mcp-78/evidence.json`; test logs are
  `.temp/validate-mcp-78-sdk-tests.log` and `.temp/validate-mcp-78-mcp-tests.log`.

These checks validate the diagnosis and existing behaviour, not the unimplemented feedback
fix. Cross-session controls do not replace a controlled replay on one live library version.
Recovery from the failing state with `Automatic`, an explicit `LeftRight` input, the final
swap geometry and the agent's response to the new feedback remain acceptance work. The
current `edit-swap-units.expect` still requires a left-hinged new left-end door without
distinguishing paired doors; the proposed acceptance update is necessary. No productive
code, library data or prompt expectations were changed by this validation.

The implementation base required by the user is checked against the fetched
`origin/release/bo-test` (`f15c22cc3`) on 2026-10-19. Its `hi-tool-attributes.ts`,
`hi-tool-commands.ts`, `hi-tools.ts` and `glue-logic.ts` match the independently validated
checkout, so the diagnosis and proposed feedback boundary apply on that base too.

## Recovery finding — 2026-10-19

The direct live replay with the feedback change returns Error 14019 on the width edit as
expected, but correcting the retained hinge to `Automatic` throws before the recovered group
loads. `HiRootModuleArrangementOperator._getDockMode` in roomle-ui
`hi-root-module-arrangement.ts:990-995` reads `originalRoot?.dockInfos.filter` and
`originalOtherRoot?.dockInfos.filter`: the original root exists, but its failed calculation
left `dockInfos` absent. The newly calculated root has valid vectors; the comparison against
the previous root is what fails.

Recovery therefore also requires optional access to the original roots' vector arrays in
those two expressions. The existing mode fallback already handles an unavailable original
vector pair and retains the requested docking mode. This uses the recovered calculation's
geometry, keeps the failed original intact and adds no refusal or fabricated vectors. A
regression must cover either endpoint missing its original vectors and verify the recovered
row's positions. The live recovery and swap are rerun after that change.

The next replay recovers complete geometry but moves the group 600 mm on each recovery.
`keepWallDistances` (`hi-root-module-arrangement.ts:412`) compares a partial original box
that omits the failed root with the full recovered box, then treats their difference as a
layout change. A partial box cannot establish the whole group's distance to a wall. The
wall-distance adjustment must therefore require docking geometry for every article root in
both groups; when either measurement is incomplete, it keeps the group transform rather than
deriving a translation from partial bounds. This is the same unavailable-measurement fallback
as the existing missing-box case, not an agent refusal. Regressions cover either incomplete
measurement and require the live recovered and swapped row to keep its original wall position.

## Implementation and verification — 2026-10-19

The changes are implemented on `fix/attribute-calculation-feedback` in both repositories;
roomle-ui starts from `release/bo-test` (`f15c22cc3`), with implementation commit `a2046b72b`.

- `withLibraryChanges` appends settled raw Error/Fatal diagnostics for the groups the command
  changed, using the existing cause grouping and root labels. The edit and other roots remain,
  existing corrections stay first, and the MCP attribute-result compaction retains the feedback.
- `_getDockMode` tolerates absent original docking vectors and keeps the requested mode.
  `keepWallDistances` requires complete article-root docking bounds in both states before
  deriving a translation. Generated roots without vectors do not prevent measurement.
- The tool reference, behaviour, implementation context and SDK reference describe these
  contracts. The prompt expectation distinguishes the widened paired doors from a single
  door at the other row end. Library-description proposals are prepared, not applied; the
  remaining description work is library backlog item 78.

The feedback regressions failed before the change; both missing-original-vector tests and
both incomplete-footprint tests independently reproduced their recovery defects before their
fixes. **1,085 tests pass across all 18 HI SDK test files**, and **297 tests pass across all
15 MCP workspace test files**. Both repository typechecks, SDK/MCP lint, formatting and local
Markdown-link checks pass. Test logs are local scratch files under `.temp/attribute-feedback-*`.

The live replay confirms that width 900 with retained `Right` returns Error 14019 through
MCP `corrections`, and correcting the hinge to `Automatic` or explicit `LeftRight` rebuilds
six vectors and paired-door parts. The swap then keeps all links. That replay exposes the
wall-distance defect above before its fix. Subsequent final acceptance attempts stall while
the example awaits an external HI proxy request during initial planner setup, before a page
connects to MCP. The final wall-position replay and the model's response to the feedback remain
unverified; unit tests cover the corrected incomplete-footprint behaviour. No model run or
remote library-data update is performed.
