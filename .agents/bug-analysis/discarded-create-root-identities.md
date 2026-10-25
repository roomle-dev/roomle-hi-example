# Discarded creates report root identities the call never sent

- **Type:** Bug analysis
- **Status:** Fixed — verified on `feat/hi-mcp`; release verification pending
- **Date:** 2026-10-25
- **Base:** roomle-hi-example `master` at `4d2430c03d3d8966eca749f6ce63dc830c40cbf1`; roomle-ui `feat/hi-mcp` at `7b39f30ef2481005cf22ac16a0fe35f72af10df5`
- **Analysis branch:** roomle-hi-example `docs/analyse-discarded-group-root-ids`
- **Source:** backlog issue 111; [RML-18295](https://roomle.atlassian.net/browse/RML-18295)
- **Fix:** roomle-ui `3918ff2fbb4ae0ad19cb8a48a56702564e0ea5cd` — `fix(hi): name discarded create roots by their call ids`

## Affected repositories

- **roomle-ui, `feat/hi-mcp`:** corrected layout-load failure reporting, added regression tests and updated the HI behaviour, tool and library-error references.
- **roomle-hi-example:** updated the MCP tool skill, removed verified backlog issue 111 and closed out this analysis with its indexes.

## Symptom and reproduction at the analysed base

A failed new group of `create-or-replace-groups` reported a root sent as `u1` as `id0002` in both
`notLoaded[].rootIds` and its error sentence. It named group `id0003`, although the failed group
never reached the scene. A root added by a discarded replacement was reported by its fresh
internal ID as well. Retained roots already had IDs the agent could identify in the plan.

The model-free reproduction used the existing `hi-tools-test.ts` create-discard setup: the
`cabinet-600` fixture, a library mock reporting `Width cannot be calculated` for `color: red`,
and a second group that calculated normally. The failed root was `u1`; the valid group's root
was `u2`. The observed entry was:

```json
{
  "index": 0,
  "rootIds": ["id0002"],
  "errors": ["posGroups[0]: nothing was changed - the library could not calculate root module 'id0002' (cabinet-600) of group 'id0003' - Width cannot be calculated. Change the failing values or replace the article, and send the group again"]
}
```

The valid group loaded and the failed group left the group map. Temporary probes also reproduced
the replacement's added `u1` being reported as `id0004`, and a group's own diagnostic naming its
discarded internal group ID. A multi-root article expanded one submitted pick into several roots,
showing why equal-count positional matching could not preserve the named first root.

## Root cause at the analysed base

Source paths below were relative to roomle-ui
`packages/web-sdk/packages/homag-intelligence/src/` at the recorded base.

| Location | Finding |
|---|---|
| `hi-tools.ts:797`, `:2055` | Article picks were expanded before calculation. The first template root received the pick ID; extra roots received intermediate `<pick-id>:<index>` IDs. |
| `hi-tools.ts:961` | `_replaceRootModuleIdsAndRemapDockedRoots` generated new internal IDs and built a local input-to-internal `idMap`. It used that map for docking and placement but did not return it. |
| **`hi-tools.ts:736`** | **`_loadGroupLayout` called `newLibraryFailures` without its existing `newRoots` naming map.** |
| **`hi-tool-payload.ts:376`, `:382`, `:383`** | **The formatter fell back to internal root IDs in both the sentence and `rootIds`, and always included the internal group ID.** |
| `hi-tool-payload.ts:395`; `hi-tool-commands.ts:811` | Both mixed-success `notLoaded` results and all-discarded errors forwarded those names. Correcting only one result shape would have left the other affected. |
| `hi-tools-test.ts:4681`, `:4684` | The existing test accepted any string as the root ID and any quoted root/group IDs in the error sentence. |

Fresh planner IDs and the discard itself were correct. Input identity was lost on the way to the
failure verdict. This was a tool-output defect; changing agent instructions or the library's
calculation would not have recovered those identities.

## Fix and durable outcome

The fix returned the existing remap from `_replaceRootModuleIdsAndRemapDockedRoots`, retained
explicitly named input roots as calculated-ID-to-call-ID `rootNames` beside the tools' built
groups/outcomes, and passed the names to `newLibraryFailures` through `newRoots`.

The formatter received the explicitly unnamed new groups through `unnamedGroups`. Their root
errors omitted the generated group-ID suffix, and their own diagnostics named `the group`.
`readLoadOutcomes` and the all-discarded command branch retained ownership of the original
`posGroups[i]` prefix. Replacements retained the existing group ID.

Failure comparison continued to use internal IDs. Unnamed expanded roots and generated roots
kept their calculated-ID fallback; retained roots and failures after loading kept real plan IDs.
Metadata stayed outside `PosGroup`, persisted data and public load outcomes. `glue-logic.ts` was
unchanged. Host notifications remained the separate open issue 112.

The durable contract and the reason to use the actual remap were promoted to roomle-ui
`.agents/homag-intelligence/library-errors.md`, `hi-tools-behaviour.md` (D106/G68 and the create
result), `hi-tools-reference.md`, and the example's [MCP tool skill](../skills/hi-mcp-tools.md).
The guarding tests are `describe('the identities in a discarded layout')` and the strengthened
mixed-success create-discard test in `__tests__/hi-tools-test.ts`.

## Validation

- Before the fix, the focused tests produced **8 failures and 3 passes**. Failures covered the
  exact call IDs, new group names, repeated picks and expanded articles. Companion cases confirmed
  existing-group names and the comparison against an already failed root.
- After the fix, all **11 focused cases passed**. Ten new parameterized cases were added, and the
  existing mixed-success test was strengthened with exact IDs/text, history and public-result checks.
- The three affected suites passed: **272 tests** across `hi-tools-test.ts`,
  `create-or-replace-groups-input-test.ts` and `run-tool-command-test.ts`. Existing tests guarded
  post-load plan IDs, discarded-call forwarding and staged row-edit naming/comparison.
- The complete HI suite passed: **1,638 tests in 32 files**, using Node 24.12.0 and the SDK's npm
  test script. SDK type checking, code lint, formatting and touched Markdown links passed.
  SDK lint reported one unrelated unused-variable warning in `planner-core/__tests__/plan-view-model.ts`.
- The Jira description gained the agreed bullet. Its original 18 entries and document structure
  were verified unchanged, with 19 bullets afterwards. The analysis/plan comment remained the
  ticket record; no implementation or completion comment was added.

## Pending release verification and deletion

The fix was committed locally on `roomle-ui/feat/hi-mcp` and was not pushed, as requested. No
remote branch contained the fix commit at close-out. Backlog issue 111 was removed after local
verification; release status belongs here rather than in the backlog.

Once the fix is verified on roomle-ui `origin/release/bo-test` or `origin/master`, delete this
analysis, remove its rows from `.agents/bug-analysis/README.md` and `.agents/README.md`, repair
inbound links and run the Markdown link checker. Git history and the Jira analysis/plan comment
retain the historical record. No release or live planner verification was performed in this task.
