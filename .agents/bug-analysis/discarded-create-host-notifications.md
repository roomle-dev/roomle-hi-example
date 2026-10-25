# A discarded group of a create is reported to the host as added and then deleted

- **Type:** Bug analysis
- **Status:** Open
- **Date:** 2026-10-25
- **Base:** roomle-hi-example `master` at `aa3806bc60ad0ce40397c3c3562012321c1499f0`; roomle-ui `feat/hi-mcp` at `3918ff2fbb4ae0ad19cb8a48a56702564e0ea5cd`
- **Analysis branch:** roomle-hi-example `docs/analyse-discarded-create-host-notifications`
- **Backlog:** [MCP issue 112](../backlog/mcp-issues.md#112-a-discarded-group-of-a-create-is-reported-to-the-host-as-added-and-then-deleted)

## Affected repositories

- **roomle-ui, `feat/hi-mcp`:** the proposed fix separates layout calculation from host publication in `hi-tools.ts`, adds callback regression tests and updates the HI implementation and behaviour references.
- **roomle-hi-example:** this analysis and its index/backlog references. The example consumes the callbacks correctly and needs no productive change.

## Symptom and reproduction

`create-or-replace-groups` discards a group whose new calculation fails before loading it (D106),
but the host receives that calculation as a completed addition or change. A failed new group is
then reported as deleted; a failed replacement is reported as changed again with the restored
group. The final plan and the tool's `notLoaded`/error result are correct. The host temporarily
observes a group or a version of it that never reaches the scene.

Reproduce without a model, server or library download, using the real glue logic and the existing
`cabinet-600` test article in roomle-ui `hi-tools-test.ts`:

1. Use the setup of `discards a new group of a create the library could not calculate before the
   load and builds the others` (`:4619`). The mock library writes an `Error` diagnostic,
   `Width cannot be calculated`, when a root has `color: red`.
2. Spy on `onPosGroupAdded`, `onPosGroupChanged`, `onPosGroupDeleted` and `onPriceCalc`, copying
   their payloads when invoked. Send the red root `u1` and a valid root `u2` in separate groups of
   one call.
3. Observe the failed group `id0003` in the added batch and first price payload, although only
   `id0005` loads. The failed group is subsequently deleted from the host.
4. Use `discards a replace the library could not calculate before the load, through the real
   glue-logic - the group stays as it was` (`:4548`): create a valid group, start recording after
   that setup, then replace it with the red value. Observe two changes and two price payloads,
   although the replacement makes no load and the tool rejects with “nothing was changed”.

The IDs below are from the deterministic test run, not IDs a caller must supply:

| Case | Observed callbacks in order | Required outcome |
|---|---|---|
| Failed new group plus valid new group | `added([id0003 failed, id0005 valid])`; `price([id0003 failed, id0005 valid])`; `deleted([id0003])`; `price([id0005])` | Add only `id0005`; emit no addition or deletion for `id0003`; price payloads exclude the discarded candidate. |
| Failed replacement of `id0003` | `changed([id0003 red, Error])`; `price([id0003 red, Error])`; `changed([id0003 restored])`; `price([id0003 restored])` | One change with the restored group, as specified by issue 112; no failed candidate in host or price payloads. No load or history step. |

The example wires these callbacks to `updatePosGroups` (`minimal-hi-example/index.html:765–767`).
That function stores each supplied group and rebuilds its controls (`:688–698`), so it processes
both the addition and deletion, or both changes. `onPriceCalc` requests a price refresh (`:720`,
`:597`). The probe proves the transient callback payloads and redundant refresh requests; it
does not establish a visible flicker, a wrong displayed price or an incorrect saved order.

## Investigation trace and exact root cause

All source/test paths in this section are relative to roomle-ui
`packages/web-sdk/packages/homag-intelligence/`, at the recorded base.

| Location | What happens |
|---|---|
| `src/hi-tools.ts:721–732` | `_loadGroupLayout` snapshots existing groups, then awaits `createOrReplacePosGroupsFromLayout`. |
| `src/hi-tools.ts:840–870` | The shared method calculates replacements or adds new groups to the map. It collects the resulting groups as built, including groups carrying library diagnostics. A diagnostic is data, so it does not enter the exception handler. |
| **`src/hi-tools.ts:883–887`** | **The shared method calls and awaits `groupsModified` with all calculated additions/replacements, before returning them for the tool's failure check. This is the premature publication.** |
| `src/glue-logic.ts:2756–2786` | `groupsModified` forwards the added/changed/deleted payloads to the host, then requests pricing from the current group map. This is why the failed candidate also appears in `onPriceCalc`. |
| **`src/hi-tools.ts:740–751`** | **Only after publication, `_loadGroupLayout` runs `newLibraryFailures` and calls `_discardCalculated`.** |
| `src/hi-tools.ts:1021–1026`; `src/glue-logic.ts:1251–1287` | A new candidate is removed through `removedGroup`, producing a delete callback. A replacement is restored through `changedGroupFromHistory(previous, false)`, producing the second change callback without loading it. Each callback also requests pricing. |
| `src/hi-tools.ts:759–764` | Only surviving groups are sent to `loadPosGroups`. The earlier host publication cannot be taken back. |
| `__tests__/hi-tools-test.ts:4548–4692` | Existing tests assert the load count, retained group, result, failure IDs and history count, but never inspect these host callbacks. |

The root cause is the ownership of publication: a shared calculation method publishes results
before its tool caller has decided which results can load. Using scene-removal/history callbacks
to clean up those unpublished candidates then creates a second, externally visible transaction.
The calculation, ID mapping and D106 failure comparison are not the defect.

This is a tool/host output defect, not wrong content caused by agent instructions. Clarifying
served text or changing library descriptions cannot order these callbacks. No new input guard,
library calculation change or agent retry is needed.

## Shared public API constraint

The same calculation method also serves the public layout API. `RoomlePlanner.loadExternalObjectGroupLayout`
(`packages/web-sdk/packages/planner-core/src/roomle-planner.ts:2500–2526`) calls
`createOrReplacePosDataFromArticleLayout`, whose `posGroups` branch delegates to
`createOrReplacePosGroupsFromLayout` (`src/glue-logic.ts:651–656`). It then loads the returned groups.
This path does not use `_loadGroupLayout` and its D106 discard policy.

The direct-call test `builds a replace although the library reports an error for a root module of
it` (`__tests__/hi-tools-test.ts:5769`) deliberately preserves the failed calculation. The test
`should create several groups and notify once with the full batch` (`:5119`) guards direct-call
notifications. Moving the tool verdict into the shared public method unconditionally would
change that API's behaviour. Removing publication there without preserving the direct wrapper
would lose its callbacks. Neither change is required by this issue.

## Proposed clean fix

Separate calculation from publication inside `hi-tools.ts`. A private calculation phase can
retain the current per-group work, outcomes, root-name remapping and added/changed classification.
The existing public `createOrReplacePosGroupsFromLayout` wrapper continues to publish and return
its calculation results for direct layout callers. The tool's `_loadGroupLayout` uses the same
calculation phase, applies its existing failure verdict, completes map cleanup/restoration, then
publishes only the accepted additions and the final versions of existing groups.

For this layout path, discard cleanup must not itself publish:

- Remove a failed new candidate with the existing `deleteFromGroupMap` API
  (`src/glue-logic.ts:1816`), which sends no host notification.
- Restore a failed replacement's already calculated snapshot through the existing
  `storeCalculatedGroup` API (`:1781`), which restores both `posDataJson` and
  `lastCalculatedPosDataJson`. Include that restored group once in the final changed batch,
  preserving issue 112's one-change contract.
- Finish **all** discards before invoking `groupsModified`. In a mixed batch, restoring one
  replacement through `changedGroupFromHistory` would request pricing while other failed
  candidates could still be in the map. Silent cleanup followed by one publication avoids that
  intermediate state as well.

The accepted groups then load through the existing path. “Accepted” means they pass the current
pre-load verdict; a kernel-load failure or a calculation during the kernel's position follow-up
remains governed by its existing contract. This proposal does not add rollback after loading.

Keep the general `_discardCalculated` behaviour used by attribute operations outside this layout
path. Keep `rootNames` internal and retain `notLoaded`, original input indexes, call root IDs,
existing group IDs, mixed success, exceptions and history accounting. Preserve D106's distinction
between a newly failed root/group and one that already failed before the call. The related
[discarded-root identity analysis](discarded-create-root-identities.md) covers those names.

This keeps the fix in the HI tools (D110). It changes neither `glue-logic.ts`, the public callback
types, the library nor the example. It needs no timer, callback suppression flag, event queue or
host-side filtering. Debouncing or coalescing at the host would still expose incorrect payloads
to other consumers and would hide the publication defect.

## Regression coverage and documentation scope

Permanent regressions belong in roomle-ui `__tests__/hi-tools-test.ts`, using the real glue logic
and `spyOnNotifications` from `__mocks__.ts`:

| Case | Assertions |
|---|---|
| Failed new group beside a valid one | Added batch contains only the valid group; no deletion for the discarded candidate; every price payload excludes it; existing `notLoaded`, root IDs, one load and one history step stay correct. |
| Every new group discarded | No added/changed/deleted callbacks, price request, load or history step; map empty; existing all-discarded error unchanged. |
| Failed replacement | One changed payload containing the restored snapshot, including its valid values; no failed candidate in price payloads; no addition/deletion or load/history step. A subsequent valid replacement still works. |
| Mixed accepted/discarded new and existing groups | Exactly the final additions and changes, no delete for a discarded new candidate, and no failed candidate in any price payload, regardless of input order. This guards cleanup of the whole batch before publication. |
| Library verdict variants | Root `Error`/`Fatal` and group-level calculation exceptions use the same publication boundary; a root already failing before the call retains D106's current comparison semantics. |
| Successful and direct layouts | Existing batching and create/replace notification tests stay green; the public layout API still retains and reports its calculated diagnostic-bearing groups. |

The implementation should update roomle-ui `.agents/homag-intelligence/library-errors.md`
(layout calculation, discard and publication), `hi-tools-behaviour.md` (D106 and the create
contract) and the layout-load description in `.agents/homag-intelligence.md`. No served tool
schema, library data, embedding-lib build or user-facing example change is necessary.

## Verification performed

The two existing discard tests pass unchanged. Temporary callback assertions then reproduce both
failures: the added batch contains the failed new group; the replacement sends two changes where
one is expected. Callback payloads are copied at invocation, including pricing, so the trace does
not rely on later reads of mutable spy arguments.

After the probe, `hi-tools-test.ts` is restored byte for byte (SHA-256
`385205a91f97244a7a2847d5248c5954ad998b94de2049658423fa9212daabd5`). The original suites pass:
**397 tests in two files**, with no persistent roomle-ui changes. Commands from
`roomle-ui/packages/web-sdk`, using the repository's npm test script and installed Node 24.12.0:

```sh
volta run --node 24.12.0 npm run test -- --run \
  packages/homag-intelligence/__tests__/hi-tools-test.ts \
  -t 'discards a replace the library could not calculate before the load|discards a new group of a create the library could not calculate before the load'

volta run --node 24.12.0 npm run test -- --run \
  packages/homag-intelligence/__tests__/hi-tools-test.ts \
  packages/homag-intelligence/__tests__/glue-logic-test.ts
```

The local probe and its log are git-ignored scratch files under
`.temp/discarded-create-host-notifications/` in roomle-hi-example. The fix and permanent regression
tests are not implemented. No live planner or release verification is performed.
