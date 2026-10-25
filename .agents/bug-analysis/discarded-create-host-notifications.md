# A discarded group of a create is reported to the host as added and then deleted

- **Type:** Bug analysis
- **Status:** Fixed — verified on `feat/hi-mcp`; release verification pending
- **Date:** 2026-10-25
- **Base:** roomle-hi-example `master` at `aa3806bc60ad0ce40397c3c3562012321c1499f0`; roomle-ui `feat/hi-mcp` at `3918ff2fbb4ae0ad19cb8a48a56702564e0ea5cd`
- **Analysis branch:** roomle-hi-example `docs/analyse-discarded-create-host-notifications`
- **Source:** former backlog issue 112; [RML-18295](https://roomle.atlassian.net/browse/RML-18295)
- **Plan:** [analysis and implementation-plan comment](https://roomle.atlassian.net/browse/RML-18295?focusedCommentId=156525)
- **Refactoring:** roomle-ui `e62a6ff39269829e8755b48d9c5419b82894ab22` — `refactor(hi): separate layout calculation from host publication`
- **Fix:** roomle-ui `afb5131e7d151ece3a9f172810f0277162ef9e50` — `fix(hi): publish layout groups after discarding failed calculations`

## Affected repositories

- **roomle-ui, `feat/hi-mcp`:** separated layout calculation from publication, completed the tool's discard before callbacks, added regression tests and updated the HI references.
- **roomle-hi-example:** closed out this analysis, removed verified backlog issue 112 and the empty issue document, repaired links and updated indexes/testing guidance.

## Symptom and reproduction at the analysed base

`create-or-replace-groups` discarded new failures before loading them, but its shared calculation
method had already reported the candidates to the host. A discarded new group was reported as
added and then deleted; a discarded replacement was reported as changed twice. The first price
callback also contained the failed calculation. The final plan and tool result were correct.

The model-free reproduction used the real glue logic and the existing `cabinet-600` fixture in
`hi-tools-test.ts`. The mock library reported `Width cannot be calculated` for `color: red`.
Callback payloads were copied at invocation to retain the transient states:

| Case | Observed callbacks before the fix |
|---|---|
| Failed new group beside a valid one | `added([failed, valid])`, `price([failed, valid])`, `deleted([failed])`, `price([valid])` |
| Failed replacement | `changed([failed])`, `price([failed])`, `changed([restored])`, `price([restored])` |

The example's `updatePosGroups` processed each addition/change/deletion and rebuilt its controls;
`onPriceCalc` requested a refresh. The probes established incorrect transient payloads and
redundant refresh requests, not a visible flicker, wrong displayed price or incorrect saved order.

## Root cause at the analysed base

Source paths below were relative to roomle-ui
`packages/web-sdk/packages/homag-intelligence/src/` at the recorded base.

| Location | Finding |
|---|---|
| **`hi-tools.ts:883–887`** | **`createOrReplacePosGroupsFromLayout` awaited `groupsModified` for every calculated addition/replacement before returning to the tool caller. Library diagnostics were data, not exceptions.** |
| **`hi-tools.ts:740–751`** | **Only after that publication, `_loadGroupLayout` checked `newLibraryFailures` and called `_discardCalculated`.** |
| `hi-tools.ts:1021–1026`; `glue-logic.ts:1251–1287` | Discard used `removedGroup` or `changedGroupFromHistory`, producing another host notification. |
| `glue-logic.ts:2756–2786` | Every publication also requested pricing from the current group map. |
| `hi-tools.ts:759–764` | Only surviving groups loaded, leaving the host callbacks inconsistent with the pre-load verdict. |

Publication belonged to a shared calculation method before the tool had made its verdict. The
public layout API also used that method and deliberately retained diagnostic-bearing calculations;
moving the discard into the public method would have changed that separate contract. The defect
was in tool/host output, not agent instructions, ID mapping or the library calculation.

## Fix and durable outcome

The mechanical extraction introduced `_calculatePosGroupsLayout`, retaining calculation,
classification, per-input outcomes and root-name mapping. The public wrapper kept its publication
and return shape. The extraction passed the original 397 tests and was committed separately.

The tool's `_loadGroupLayout` then used the private calculation phase. It silently removed failed
new candidates through `deleteFromGroupMap` and restored failed replacements through
`storeCalculatedGroup`, restoring both `posDataJson` and `lastCalculatedPosDataJson`. It completed
the entire batch's cleanup before one `groupsModified` publication: accepted additions and the
final accepted/restored replacements. A discarded replacement was changed once; a discarded new
candidate was neither added nor deleted. An all-discarded-new batch published nothing. Price
callbacks saw the final map, and only accepted groups loaded.

The direct layout API retained its diagnostic-bearing calculations and callbacks. Root naming,
partial success, original indexes, error results, history accounting and already-failed-root
comparison were preserved. `glue-logic.ts`, attribute operations, the library and the example were
unchanged. No timers, callback suppression flags or host filtering were added.

The publication invariant, snapshot restoration, direct-layout constraint and guarding tests were
promoted to roomle-ui `.agents/homag-intelligence/library-errors.md`,
`hi-tools-behaviour.md` (D106/create) and `.agents/homag-intelligence.md`.

## Validation

- The nine focused callback cases failed before the fix and passed afterwards: seven new
  parameterized cases and the two strengthened create/replace discard tests.
- Coverage included root Error/Fatal, group Error/Fatal, calculation exceptions, all-discarded
  creates, mixed batches in both orders, both restored calculation snapshots and a successful
  retry. Existing controls were strengthened for already-failed roots and the direct API's
  diagnostic-bearing replacement. Public results carried no new private metadata.
- The four affected suites passed: **510 tests** across `hi-tools-test.ts`,
  `glue-logic-test.ts`, `create-or-replace-groups-input-test.ts` and `run-tool-command-test.ts`.
- The full HI suite passed: **1,645 tests in 32 files**, using installed Node 24.12.0 and the SDK's
  npm test script. SDK type checks, code lint, formatting and touched Markdown links passed.
  Lint reported one unrelated unused-variable warning in `planner-core/__tests__/plan-view-model.ts`.
- The approved Jira description bullet was appended with the existing 19 bullets and their rich
  text preserved; the resulting count was 20. The analysis/plan comment remained the ticket record;
  no implementation, progress or completion comment was added.
- Backlog issue 112 was removed after local verification. Its empty `mcp-issues.md` was deleted,
  with links repaired in the backlog, master index, analysis index, testing/cleanup skills and wiki.

## Pending release verification and deletion

Both roomle-ui commits were kept locally on `feat/hi-mcp` and were not pushed, as requested. No
local remote-tracking branch contained the fix commit at close-out. No live planner, release
deployment or embedding-lib build was performed.

Once the fix is verified on roomle-ui `origin/release/bo-test` or `origin/master`, delete this
analysis, remove its rows from `.agents/bug-analysis/README.md` and `.agents/README.md`, repair
inbound links and run the Markdown link checker. Git history and the Jira plan comment retain the
historical record. Release verification belongs here rather than in the backlog.
