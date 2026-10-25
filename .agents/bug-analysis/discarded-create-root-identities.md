# Discarded creates report root identities the call never sent

- **Type:** Bug analysis
- **Status:** Open
- **Date:** 2026-10-25
- **Base:** roomle-hi-example `master` at `4d2430c03d3d8966eca749f6ce63dc830c40cbf1`; roomle-ui `feat/hi-mcp` at `7b39f30ef2481005cf22ac16a0fe35f72af10df5`
- **Analysis branch:** roomle-hi-example `docs/analyse-discarded-group-root-ids`
- **Backlog:** [MCP issue 111](../backlog/mcp-issues.md#111-a-discarded-new-group-of-a-create-names-its-root-modules-by-ids-the-call-never-sent)

## Affected repositories

- **roomle-ui, `feat/hi-mcp`:** proposed correction in the HI tools' layout-load failure reporting and shared failure formatter, with regression tests and the HI behaviour reference.
- **roomle-hi-example:** this analysis, its indexes and the backlog links. No productive-code change is part of this analysis.

## Finding

The defect is confirmed. A discarded new group reports a root sent as `u1` as `id0002` in both
`notLoaded[].rootIds` and the error sentence. It also names `id0003` as the group, although that
group never reaches the scene. A discarded replacement reports a newly added root the same way;
retained roots already have the plan's IDs and are correctly identifiable.

The tools correctly generate fresh internal IDs and correctly discard the failed calculation.
The missing step is carrying the input identity into the discard verdict. `_loadGroupLayout`
calls `newLibraryFailures` without the existing `newRoots` naming map. The formatter separately
assumes that every group ID is meaningful to the agent, including a new group discarded before
its first load.

This is an output-identity defect, not an agent instruction or library-calculation defect. A valid
call can encounter it. The recovery instruction asks the agent to change a root whose reported ID
exists neither in its submitted payload nor in the resulting plan.

## Reproduction and observed result

Use the model-free test setup in roomle-ui
`packages/web-sdk/packages/homag-intelligence/__tests__/hi-tools-test.ts:4619`:
`discards a new group of a create the library could not calculate before the load and builds the others`.
The test catalog offers `cabinet-600`; the library mock writes an `Error` with
`Width cannot be calculated` on a root with `color: red`. The second group calculates normally.

Send this through `glueLogic.executeGroupOperation('create-or-replace-groups', payload)`:

```json
{
  "posGroups": [
    {
      "libraryId": "test-library",
      "roots": [{ "id": "u1", "articleId": "cabinet-600", "attributes": [{ "id": "color", "value": "red" }] }]
    },
    {
      "libraryId": "test-library",
      "roots": [{ "id": "u2", "articleId": "cabinet-600" }]
    }
  ]
}
```

Observed `notLoaded` entry:

```json
{
  "index": 0,
  "rootIds": ["id0002"],
  "errors": ["posGroups[0]: nothing was changed - the library could not calculate root module 'id0002' (cabinet-600) of group 'id0003' - Width cannot be calculated. Change the failing values or replace the article, and send the group again"]
}
```

The second group loads as `id0005`; the failed group is absent from the group map. Expected:
`rootIds: ["u1"]`, and the same error with `root module 'u1' (cabinet-600)` and no
`of group 'id0003'`. `posGroups[0]` already identifies the discarded group.

Additional temporary probes through the same tool entry point establish:

| Case | Observation | Required result |
|---|---|---|
| Replace an existing group and add a failing root `u1` | Existing group `id0003` is retained; the error and `rootIds` name added root `id0004` | Name `u1`, retaining the existing group ID |
| Put the error on the new group itself | `rootIds: []`; error says `could not calculate group 'id0003'` | The existing `posGroups[0]` prefix identifies it; say `could not calculate the group` |
| Pick one article containing two roots, both failing | One input pick `u1` becomes roots `id0003`, `id0004`; the error groups both under `article-multi ×2` | Map the explicitly named first root to `u1`; leave the unnamed extra root's internal ID as the fallback |

These are synthetic library diagnostics used to exercise the tools, not evidence of an actual
catalog calculation defect. No model, browser session or external library service is required.

## Investigation trace

All source references below are relative to roomle-ui
`packages/web-sdk/packages/homag-intelligence/src/` at the base above.

| Location | What happens and why it matters |
|---|---|
| `hi-tool-commands.ts:508`, `:796` | The create command prepares buildable groups, retaining their original input indices, then sends the prepared layout to `loadExternalObjectGroupLayout`. |
| `hi-tools.ts:713` | `_loadGroupLayout` snapshots replaced groups and calls `createOrReplacePosGroupsFromLayout`. Each outcome identifies its built group and layout index. |
| `hi-tools.ts:797`, `:2055` | `_prepareArticlePickRoots` expands article picks. For a multi-root article the first template root gets the pick ID and additional roots get `<pick-id>:<index>` (`:2082`). |
| `hi-tools.ts:820`, `:835`, `:961` | Both new groups and roots newly added during replacement pass through `_replaceRootModuleIdsAndRemapDockedRoots`. Existing root IDs are retained; new roots get planner IDs. Its local `idMap` records input-to-planner IDs but is used only for docking and placement references and is not returned. |
| `hi-tools.ts:836` | `addNewGroup` assigns the new group's internal identity before calculation. It is not an identity the agent can read from the plan when the group is discarded. |
| **`hi-tools.ts:736`** | **The discard verdict calls `newLibraryFailures(before, after)` without the root naming map. This is the immediate missing identity handoff.** |
| **`hi-tool-payload.ts:376`, `:382`, `:383`** | **`rootIds` and `rootModulesLabel` fall back to internal root IDs; both group-level and root-level error sentences always include the internal group ID.** |
| `hi-tools.ts:743`, `:999` | A failed group is discarded before loading: a replacement restores the previous group; a new group leaves the group map. Its internal IDs therefore cannot be recovered through a subsequent plan-context query. |
| `hi-tool-payload.ts:395` | `readLoadOutcomes` copies the failure root IDs into `notLoaded`, adds the original `posGroups[i]` prefix, and retains a submitted group ID where present. |
| `hi-tool-commands.ts:803`, `:811` | When every group is discarded, the command throws `DiscardedChange` with the same failure sentences and original input indices. Fixing only `notLoaded` would miss this path. |
| `hi-tools.ts:1026`, `:1058`; `hi-tool-payload.ts:248` | Staged row edits already pass `newRoots`: comparison uses internal IDs while presentation uses the call's root ID, or “the new root module”. The create path lacks this handoff. |

The tests leave the defect uncovered: `hi-tools-test.ts:4681` accepts any string in `rootIds`, and
`:4684` matches any quoted root and group ID. The replacement test at `:4549` changes a retained
root only, whose ID does not change. It does not add a root with a fresh ID.

## Proposed clean fix

Keep the fix in the HI tools and their failure formatter on **roomle-ui `feat/hi-mcp`**.
`glue-logic.ts`, the library calculation, the embedding bridge and the example page require no
behaviour change. The host-notification defect in issue 112 is separate work.

### Preserve root identity at the existing remap

Retain the mapping `_replaceRootModuleIdsAndRemapDockedRoots` already computes and carry it with
the corresponding built group to `_loadGroupLayout`. Keep this metadata within the tools' build
result; do not add it to `PosGroup`, persisted plans, tool arguments or public load outcomes.
Use the roots of `layout.posGroups[outcome.index]` to distinguish IDs actually supplied in the
prepared call from synthetic expansion IDs, invert their remapped entries, and pass that map as
`newRoots` to `newLibraryFailures`.

A retained root needs no rename. A named root of a new group or an added root of a replacement
gets its call ID in both the sentence and `rootIds`. Generated roots and extra roots from an
article expansion have no explicit call ID and retain their internal ID fallback. IDs introduced
by input normalization remain consistent with the correction already reported to the agent.
Do not change the IDs used by `failedBefore`, docking, discard, loading or history.

The backlog suggests matching by retained ID, then by root order when article IDs line up, as
`loadedRootOf` does (`hi-tool-attributes.ts:582`). That is a smaller change for one-root articles,
but its positional branch requires equal root counts (`:589`). One multi-root pick breaks that
condition for the whole group; guessing by article ID also confuses repeated picks of one article.
Its attribute-value fallback serves loaded accent values and cannot identify a failed root in
general. Reusing the actual remap avoids guessing and preserves the named first root even when
extra roots are expanded. The `<pick-id>:<index>` expansion names are intermediate: they too are
regenerated before the verdict and must not be presented as IDs the call supplied.

### Name only a group the agent can identify

Let the shared formatter distinguish an existing group from a new group being discarded before
load, without changing its comparison identity. In `_loadGroupLayout`, the captured `previous`
group supplies that distinction. A failed replacement retains `of group '<existing-id>'`; a new
group omits that suffix, and its own diagnostic says `the group`.

Keep the original input-index prefix at `readLoadOutcomes` and the all-discarded branch of the
create command. Earlier validation may have removed a group, so a layout outcome index is not
necessarily the original `posGroups` index. Do not add another prefix inside `_loadGroupLayout`.
The existing `labels` argument only adds a prefix; it does not remove a generated group ID and is
not sufficient on its own.

Other callers of `newLibraryFailures` keep their current group names. In particular, a failure
from a follow-up calculation **after a successful load** names a group and roots that really are
in the plan (`hi-tool-commands.ts:1574`); absence from the before-state alone must not hide them.
Do not repair the finished sentence by replacing substrings: one cause may name several roots,
and the structured `rootIds` must agree with the text.

This adds no guard or refusal. It preserves D106's discard and partial-success policy and improves
the feedback required by §2.3 and G68 of the
[HI behaviour reference](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md).
Prompt changes or a library-description change cannot restore identity lost by the server.

## Regression coverage and documentation

The implementation should strengthen `__tests__/hi-tools-test.ts` through the real tool entry
point, using exact IDs and output sentences:

- The existing mixed-success create test names `u1` in both fields, omits the discarded new group
  ID, loads only the valid group and retains the current history result.
- A single failed new group returns the same call ID through the all-discarded error path and
  performs no load or history step. A new group's own `Error`/`Fatal` names `the group` without its
  generated ID.
- A replacement that adds a failing root names its call ID and the existing group ID, leaves the
  old group intact and does not load the failed replacement. A failing retained root keeps its
  original ID; a root already failing before the call does not count as a new failure.
- Repeated article picks report the correct failing root, including several roots with one cause.
  A multi-root pick maps its named first root without misnaming extra or generated roots.
- A group filtered out before the layout load does not shift the reported original `posGroups[i]`.
  A failed follow-up calculation after a successful load keeps the actual plan IDs.

Run the focused `hi-tools-test.ts` cases and the affected
`__tests__/hi-tool-commands/create-or-replace-groups-input-test.ts` and
`run-tool-command-test.ts` cases. The formatter's existing row-edit naming and failure-comparison
behaviour must remain covered. No model-based prompt test is necessary to establish this defect.

With the fix, update roomle-ui `.agents/homag-intelligence/library-errors.md` and
`hi-tools-behaviour.md` (D106, G68, create result naming), and the result contract in
`hi-tools-reference.md` and roomle-hi-example `.agents/skills/hi-mcp-tools.md` where needed.
Those living references must describe implemented behaviour, so this analysis does not change them.

## Verification performed

- On the recorded roomle-ui base, the existing new-group and replacement discard tests pass:
  **2 passed, 154 skipped**. Command from `roomle-ui/packages/web-sdk`, with Node 24.12.0 on `PATH`:

  ```sh
  npm run test -- --run packages/homag-intelligence/__tests__/hi-tools-test.ts -t 'discards a (new group of a create|replace)'
  ```

- Temporary probes assert the expected identity through that same entry point. The new-group
  `['u1']` assertion fails against `['id0002']`; the added-root replacement assertion fails against
  `['id0004']`; the assertion excluding a new group's generated ID fails as well. These are
  **three reproduced defects**, not tests of an implementation.
- The separate multi-root observation yields two generated root IDs for one submitted pick,
  confirming the limitation of equal-count positional matching. It is an observation probe, not a
  passing regression test for the proposed fix.
- The first test launch fails before collection because the default test subprocess uses an older
  Node runtime without `node:util.styleText`. Re-running with the installed project-pinned
  Node 24.12.0 succeeds; no dependency or configuration change is needed.
- Temporary test instrumentation is restored byte for byte. The roomle-ui checkout is clean on
  `feat/hi-mcp`; no productive code or regression test is committed there. The fix remains open.
