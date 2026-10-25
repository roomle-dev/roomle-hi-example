# A discarded exchange names the root module id of the unit it would have put in

> **Type**: Bug analysis
> **Status**: Open
> **Date**: 2026-10-25
> **Base**: roomle-hi-example `master` (`e753567`); roomle-ui `feat/hi-mcp` (`2061a6241`)
> **Backlog**: [mcp-issues.md #107](../backlog/mcp-issues.md#107-a-discarded-exchange-names-the-root-module-id-of-the-unit-it-would-have-put-in)

## Affected repositories

- **roomle-ui** (`feat/hi-mcp`):
  - `hi-tool-payload.ts`: `newLibraryFailures` and `rootModulesLabel` take the names the call
    gives the root modules of its change.
  - `hi-tools.ts`: `_stagedFailures` names the new units of a staged change. The exchange names its
    new root by the call's `rootModuleId`. A merge and an insert name theirs "the new root module".
  - Unit tests in `__tests__/hi-tools-test.ts`.
  - G68 and D106 in `.agents/homag-intelligence/hi-tools-behaviour.md`, and "The verdict after the
    call" and "The discard before the load" in `.agents/homag-intelligence/library-errors.md`.
  - `glue-logic.ts` stays unchanged.
- **roomle-hi-example**: this analysis and backlog item 107.
- **Library, embedding-lib, ligna-store**: unchanged. `createHiMcpTools` forwards the tool error as
  it is, so no new embedding-lib version is needed. The example page and the ligna-store get the fix
  with the planner.

The roomle-ui paths are relative to `packages/web-sdk/packages/homag-intelligence/src/` unless they
start with `__tests__/` or `.agents/`. The D and G numbers are those of
[roomle-ui `hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md).

## Result

The tools stage an `exchange-root-module`, a `merge-article-into-group` and an
`insert-article-into-group` on a copy of the group before they make the change (D106). On the copy,
the new unit gets a fresh planner id. When the library cannot calculate the copy, the change is
discarded and the error names the new unit by that fresh id. The plan never holds that id: nothing
was loaded, and a later successful call gives the new unit another id.

The agent reads a root module id that is neither in its call nor in the plan. For the exchange, the
call named the unit by `rootModuleId`. For a merge and an insert, the call names the new unit by its
article only.

A **create** names the root modules of a discarded new group the same way, with the same cause. That
case is outside backlog item 107 and is described under
[The same naming in a create](#the-same-naming-in-a-create).

## Symptom

An `exchange-root-module` of `root-2` whose new unit the library cannot calculate answers:

```
exchange-root-module: nothing was changed - the library could not calculate root module 'id0001'
(catalog-article-1) of group 'group-1' - Unsupported configuration. Change the failing values or
replace the article, and send the call again.
```

The group still holds `root-1` and `root-2`. `id0001` is neither in the call nor in the plan.

A merge answers the same way (`root module 'id0001' (article-3)`). The plan holds `root-1` and
`root-2`, and the merge's call named the new unit by `articleId` only.

The agent can still repair the call: the article and the library's message are right, and "nothing
was changed" says the plan is as before. But an agent that looks for `id0001` in `get-plan-context`
finds nothing. It may take the id for a unit of the plan that the library cannot build, and say so to
the user.

## Reproduction

**Model-free, unit level** (done for this analysis, on `2061a6241`): a scratch vitest beside
`__tests__/hi-tools-test.ts` ran the setups of the existing discard tests and printed the failures:

| Call | `libraryFailures[0].error` | Root ids of the plan after the call |
|---|---|---|
| `exchangeRootModule('group-1', 'root-2', { articleId: 'article-1' })` | `the library could not calculate root module 'id0001' (catalog-article-1) of group 'group-1' - Unsupported configuration` | `root-1`, `root-2` |
| `mergeArticleIntoGroup('group-1', { articleId: 'article-3' }, dockTo root-2)` | `the library could not calculate root module 'id0001' (article-3) of group 'group-1' - Unsupported configuration` | `root-1`, `root-2` |
| `create-or-replace-groups` with one new group, root `u1` | `create-or-replace-groups: nothing was changed - posGroups[0]: the library could not calculate root module 'id0002' (cabinet-600) of group 'id0003' - …` | no group |

The existing tests do not catch it. They match the id with `'[^']+'`: the exchange test at
`__tests__/hi-tools-test.ts:2089-2092`, the merge test at `:1888-1891`, the insert test at
`:2683-2686` and the create test at `:4568-4571`.

**Live, model-free**: as under **Reproduce** of the backlog item. In the example page with the
planner of `feat/hi-mcp` (`--dev`), create two `OTB60` side by side, then call
`exchange-root-module` on the second one with `OTB60` and the attributes `mod_Width` 900 and
`mod_DoorDirectionSelection` `Left`. This was not run again for this analysis, because the unit-level
run shows the same path.

## Investigation

1. **The tool command forwards the call's ids.** `exchange-root-module` (`hi-tool-commands.ts:1405`)
   resolves `groupId`, `articleId` and `rootModuleId` against the plan and sends them to
   `externalObjectGroupOperation('exchange-root-module', …)`. The planner runs
   `HiToolsImplementation.exchangeRootModule` (`hi-tools.ts:918`) with the plan's `rootModuleId`.
2. **The exchange is staged on a copy.** Before the real exchange, `exchangeRootModule` calls
   `_stagedFailures` (`hi-tools.ts:944-962`) with a change that builds the new unit with
   `_expandArticlePick(articleKey)` and puts it in place of `rootModuleId` in the copy.
3. **The new unit gets a fresh id.** `_expandArticlePick` (`hi-tools.ts:1443-1453`) builds the article
   pick as a posGroups layout expands it: `{ id: this._glueLogic.getNextID(), articleId }`
   (`:1445`), completed by `prepareArticlePickRoots`. `merge-article-into-group` (`:877`) and
   `insert-article-into-group` (`:1063`) build their new unit the same way. `delete-article-and-compact`
   (`:1229`) and `swap-root-modules` (`:1396`) add no root module, so they name only roots of the
   plan.
4. **The verdict names the root modules by their ids in the copy.** `_stagedFailures`
   (`hi-tools.ts:575-601`) calculates the copy with the library and returns
   `newLibraryFailures([group], [calculated])` (`:600`). `newLibraryFailures`
   (`hi-tool-payload.ts:302-357`) builds one failure per group and cause. Its error comes from
   `rootModulesLabel(failed)` (`:352`), which writes `root module '${root.id}' (${article})`
   (`:244-252`), and its `rootIds` from `failed.map((root) => root.id)` (`:351`). The function takes
   names for groups (`labels`, "posGroups[0]"), but none for root modules.
5. **The discard passes the error on as it is.** `exchangeRootModule` answers `_discardedOutcome`
   (`changed: false`, `libraryFailures`). `runToolCommand` turns it into a `DiscardedChange`
   (`hi-tool-commands.ts:1609-1610`) and throws `<tool>: <message>` (`:1638-1639`). `discardedChange`
   (`hi-tool-payload.ts:279-289`) joins the failures' errors. `rootIds` is used only to choose between
   "the article" and "the articles". Nothing on this path maps an id back.
6. **The real exchange would give another id.** `swapRootModuleWithAttributes` (`glue-logic.ts:2788`)
   builds its own new unit with `newPosDataFromId`, which has a fresh id as well, and points the
   docking of the original group at it (`:2835`). The id of the staged copy is never used again, even
   if the agent sends the same call with a value that works.
7. **The verdict must treat the new unit as new.** `failedBefore` of `newLibraryFailures` (`hi-tool-payload.ts:309-325`)
   ignores a root module that failed before the call (D95: a failed root module can be repaired). The
   staged new unit has an id that the group before the call does not hold, so a failure of the new unit
   always counts. This is right: the exchange puts in another unit, and D106 discards a change whose new
   unit the library cannot calculate, even when the unit it replaces failed too.

## Root cause

`newLibraryFailures` (`hi-tool-payload.ts:351-352`, through `rootModulesLabel` at `:244-252`) names
every failing root module by its id in the calculated copy. For a staged row edit, that copy holds a
new unit with an id that `_expandArticlePick` (`hi-tools.ts:1445`) drew only for the verdict.
`_stagedFailures` (`hi-tools.ts:575-601`) knows which root modules its change added, but passes no
name for them. So the verdict names a unit that only exists in the copy. The rule "the ids the call
gave them" in the comment of `rootModulesLabel` holds for root modules of the plan only. The verdict
is right; only the name in it is wrong.

The backlog item says that "only a create maps the plan's ids back to the call". That is true for
its groups only: the follow-up verdict and `notLoaded` name a group `posGroups[i]`. The root modules
of a discarded new group, and its group id inside the message, are the calculation's ids as well
(see below).

## Proposed fix

Name every root module of a change as the call names it, at the place where the verdict is written.
The verdict itself stays as it is.

1. **`newLibraryFailures` takes root names** (`hi-tool-payload.ts`). A fourth parameter,
   `rootLabels: Record<string, string>`, maps the id of a root module in the calculated copy to how
   the call names it. It is the counterpart of `labels`, which does the same for groups.
   `rootModulesLabel` writes that name instead of `'${root.id}'`. A root module without an entry
   keeps its id, which is the plan's id. `rootIds` uses the same names where the call has one.
   `failedBefore` still compares by the ids of the copy, so the verdict does not change.
2. **`_stagedFailures` names the new units of its change** (`hi-tools.ts`). After `change(staged)`,
   the root modules of the copy whose ids the group does not hold are the units the change adds.
   `_stagedFailures(group, change, newRootName?)` names them:
   - **`exchange-root-module`** passes the call's `rootModuleId`, which is the plan's id of the unit
     it replaces. The error reads `the library could not calculate root module 'root-2'
     (catalog-article-1) of group 'group-1' - …`. That is the unit the call named, with the article
     the call sent. "nothing was changed" makes clear that `root-2` stays as it is.
   - **`merge-article-into-group`** and **`insert-article-into-group`** pass no name. Their new unit
     reads `the new root module (article-3)`, and several new root modules read `the new root
     modules (…)`. When a root of the plan fails with the same cause, the two are joined: `root
     module 'root-1' and the new root module (…)`.
   - **`delete-article-and-compact`** and **`swap-root-modules`** add no unit, so their messages stay
     as they are.
3. **G68 keeps its format.** The error stays `<tool>: nothing was changed - the library could not
   calculate … - <first line>. Change the failing values or replace the article, and send the call
   again.` Only the name of a unit the plan does not hold changes. The served text says nothing about
   these ids, so it stays unchanged.

The fix corrects no agent input and adds no guard: it changes how the tools name a unit in their own
feedback (step 4 of [Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort): the result
says what was not built and what to send instead).

## The same naming in a create

A new group of `create-or-replace-groups` has the same symptom, from the same function. The glue
logic gives every root module of a new group a fresh id (`_replaceRootModuleIdsAndRemapDockedRoots`,
`glue-logic.ts:930`, `:1169`), and so does the group. The same happens to a root module that a
replace adds. `_loadGroupLayout` (`hi-tools.ts:522`) calls `newLibraryFailures` without names. A
discarded new group then answers `posGroups[0]: … root module 'id0002' (cabinet-600) of group
'id0003' - …`, and its `notLoaded[].rootIds` holds `id0002`, which the agent can read. The agent
sent `u1` and no group id.

The fix would use the same `rootLabels`. `_loadGroupLayout` pairs the roots of a built group with
the roots of `layout.posGroups[outcome.index]`, using the rule `loadedRootOf`
(`hi-tool-attributes.ts:582`) applies after the load: a root kept in a replace by its id, the others
by their order when the articles line up. A new group the plan does not hold is named by its
`posGroups[i]` prefix alone. The glue logic stays unchanged.

It is a separate decision because it needs a pairing that the row edits do not need. An article with
several root modules expands into roots the call did not name (`${root.id}:${index}`), and a replace
can add roots. Two options:

- **Same fix as item 107.** It uses the same mechanism, the same tests file, and the same G68
  message.
- **A backlog item of its own.** Item 107 then covers the three row edits that it names.

## Alternatives considered

- **Give the staged new unit the call's `rootModuleId` as its id.** Rejected: `failedBefore` would
  then compare it with the unit it replaces. A replaced unit that failed before would make the new
  unit's failure count as old, and the change would load. That changes the verdict, not only the
  name (D106). The real exchange gives the new unit a fresh id, so the copy would no longer match it.
  A merge and an insert have no id in the call to give.
- **Replace the id in the error text afterwards.** Rejected: the id is written in one place
  (`rootModulesLabel`). Replacing it in finished text is brittle when one failure names several root
  modules.
- **Give the real change the id of the staged copy.** Rejected: the real exchange takes its id from
  the glue logic (`swapRootModuleWithAttributes`), so this would change `glue-logic.ts` for the
  Planning Assistant ([Hard Rule](../../AGENTS.md#hard-rule-the-planning-assistant-stays-out-of-the-glue-logic)).
  A discarded change also loads nothing, so no id of it ever reaches the plan.
- **Name every failing unit by its article only.** Rejected: a root of the plan that fails with the
  change has a valid id that the agent can address. For the exchange, the call's `rootModuleId` tells
  which unit was meant.

## Tests

roomle-ui `__tests__/hi-tools-test.ts`. The three existing discard tests match the exact name instead
of `'[^']+'`:

- `it('discards an exchange the library cannot calculate before the load - the group stays as it is')`
  (`:2044`): `the library could not calculate root module 'root-2' (catalog-article-1) of group
  'group-1' - Unsupported configuration`, `rootIds: ['root-2']`.
- `it('discards a merge the library cannot calculate before the load - the group stays as it is')`
  (`:1847`): `the library could not calculate the new root module (article-3) of group 'group-1' -
  Unsupported configuration`.
- `it('discards an insert the library cannot calculate before the load - the row stays as it is')`
  (`:2643`): `the new root module (…)` with the inserted article.

New:

- A discarded merge in which a root of the plan fails with the same cause as the new unit names both:
  `root module 'root-2' and the new root module (…)`.
- An exchange of a unit that failed before, for a unit that fails as well, is still discarded and
  names the call's `rootModuleId`. This guards the verdict against the first rejected alternative.

`delete-article-and-compact` and `swap-root-modules` keep their tests as they are (`:3258`,
`:4000`). They pass unchanged, which shows that a staged change without new units keeps the plan's
ids.

## Documents

- roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md`, G68: the new root module of an
  exchange is named by the call's `rootModuleId`, and the new unit of a merge or an insert is
  "the new root module" with its article. D106: the verdict names the units of the staged copy as the
  call names them.
- roomle-ui `.agents/homag-intelligence/library-errors.md`, "The verdict after the call" and the
  `exchange-root-module` row of "The discard before the load": the same naming.
- roomle-hi-example `.agents/backlog/mcp-issues.md`, item 107: removed once the fix is in the code.
