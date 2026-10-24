# Feature analysis: attribute values checked against the library's verified options before an edit

> **Type**: Feature analysis
> **Status**: Open — the behaviour on a value the module does not take is proposed below and to be
> confirmed by the user
> **Date**: 2026-10-24
> **Base**: roomle-hi-example `master` `6b0a806`; roomle-ui `feat/hi-mcp` `6512f5890`
> **Backlog**: [attribute-values-checked-before-an-edit.md](../backlog/attribute-values-checked-before-an-edit.md)

## Affected repositories

- **roomle-ui** — the check in the HI tools: a pure check of attribute values against the library's
  verified options (new `homag-intelligence/src/hi-attribute-check.ts`), run by the planner's
  attribute operations (`hi-tools.ts`) and, for the root overrides of a create, by a new method of
  the tool-command planner; the feedback of the tool commands (`hi-tool-commands.ts`,
  `hi-tool-attributes.ts`); one extracted helper of the glue logic (`glue-logic.ts`); the served
  text (`hi-mcp/hi-mcp-server.ts`); the tests; `.agents/homag-intelligence/hi-tools-behaviour.md`,
  `hi-tools-reference.md`, `library-errors.md`.
- **roomle-hi-example** — documentation only: `.agents/skills/hi-mcp-tools.md`, the wiki page on the
  calculation guarantee, the backlog (the item leaves; `library-calculation-gaps.md` and
  `library-issues.md` 80 and 106 refer to it).
- **ligna-store** — unchanged: it gets the behaviour with the planner at its server URL. No new
  embedding-lib version: the forwarding of `createHiMcpTools` does not change.

The roomle-ui paths below are relative to `packages/web-sdk/packages/homag-intelligence/src/`
unless they name another package. The D-, C- and G-numbers are those of
[roomle-ui `hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md).

## 1. What was asked and why

The HI tools apply an attribute value the agent sends without asking the library whether the module
takes it. The library offers that check: `getVerifiedAttributeOptions` answers per module and
attribute with the values it takes, each marked `Normal`, `Conflicting` or `Invalid`, or with a
range. The planner's attribute panel narrows its choices with it; no HI tool path calls it.

Today a value the module does not take is caught only by the calculation. When the library cannot
calculate the root module, the whole tool call changes nothing (D106): the planner undoes the call's
step, every group of a create goes with it, and the agent reads the first line of the library's
message — which value failed, not which values the module takes. By D99 a calculation error caused
by a value the library rules out is an MCP bug: the tool applied the value without checking it.

The backlog item asks for four things: the decision what an edit does with a value the module does
not take; the check in roomle-ui at both stages of a create and in the attribute edits; the served
text that says what the result then names; the documentation.

## 2. How the area works today

### 2.1 The verified options

`getVerifiedAttributeOptions(moduleId, attributeIds?)` (roomle-ui `glue-logic.ts:2448`):

1. finds the module in the plan's groups (`_findModuleInAllGroups`); a module that is not in the
   plan gives `undefined`;
2. gives `undefined` when the module has no `checkAttributes` (`:2457`) — the field the library fills
   in its calculation ("the attributes required for validating checks",
   `model/oc-scripts-domain.model.ts:132`). Furniture_Smith fills an empty map on every calculated
   module, so the check runs; a module that was never calculated has none;
3. asks the library: `getAttributesDropDownValues(module, attributeIds)` (`homag-intelligence.ts:195`)
   calls the library's `getAttributesDropDownValuesV2`, or `getAttributesDropDownValues`, once per
   attribute, with the module data; an exception gives `[]` for that attribute;
4. converts each answer to a `CheckDropDownResult` (`model/oc-scripts-domain.model.ts:490`): `dropDownEntries` `[{ value, kind }]`
   sorted `Normal`, `Conflicting`, `Invalid` (`_getKindRank`, `:2675`), or `dropDownRange`
   `{ min, max, step? }`.

`getVerifiedGroupAttributeOptions(groupId, attributeIds)` (`:2503`) asks every module of the group
that carries the attribute (`collectModulesWithAttribute`, `:2695`) and combines the answers per
attribute: the same value in several modules keeps the more restricted kind
(`_getMoreRestrictedKind`, `:2688`); a range is taken from the first module that gives one.

**The planner's attribute panel** (`_validateParameters`,
`planner-core/src/services/planner-kernel-access.ts:328`) is the one consumer: a parameter without
verified options stays as it is; a range narrows the slider to `min`, `max` and `step`; a list keeps
the master-data values the entries list as `Normal` or `Conflicting`, in that order, and drops an
`Invalid` value and a value the entries do not list. The panel of a sub module asks for that module
(`_validateExternalComponentParameters`, `:435`), the panel of a root module for the root
(`:463`), the panel of a group for the group (`:500`). The public planner API returns the options
as they are (`getExternalObjectAttributeOptionsOrRanges`, `planner-core/src/roomle-planner.ts:2816`).

**What Furniture_Smith verifies** (probed in the example page with a local roomle-ui, every module
of a 600 mm `OTB60`, all attributes): the root module `mr_StorageunitSingle` verifies 16
attributes — the programs, colours and designs, and the plinth height —, its door `mf_Door` 12; the
entries carry `Normal` and `Conflicting`; none of them is `mod_Width`, `mod_Height` or
`mod_DoorDirectionSelection`. The check would catch a colour, program or design a module does not
take. It would not catch the 900 mm single door of
[library issue 80](../backlog/library-issues.md#80-wall-units-at-900-mm-with-a-single-door-the-library-cannot-calculate)
or the 720 mm drawer sideboard of
[issue 106](../backlog/library-issues.md#106-a-drawer-sideboard-lowered-to-720-mm-the-library-cannot-calculate):
the library accepts those sizes, so their failures are library bugs (D99), and both issues ask the
library to declare the sizes it takes as the verified range — which the check then reads.

### 2.2 The attribute edits

The two attribute tools are tool commands (`hi-tool-commands.ts`):

- `change-module-attribute` (`:894`) resolves the root ids, groups them by group and runs one
  planner operation `change-attributes` per group with `{ attributeId, value, rootModuleIds }`;
  with `moduleId` one operation `change-module-attribute` per root module (`:918`).
- `change-group-attribute` (`:1002`) runs the planner operation `change-group-attribute` for one
  attribute, `change-attributes` for several, the programs first (`programsFirst`,
  `hi-tool-attributes.ts:268`, D67).

The planner's group operations (`hi-tools.ts`) resolve the modules and set the values:

- `changeModuleAttribute` (`:500`), `changeGroupAttribute` (`:558`) and `changeAttributes` (`:594`)
  collect per root module the modules that carry the attribute — the root module and its sub
  modules, by the master data — with `_attributeTargets` (`:1391`); an attribute no module carries
  is an error (`:519`, `:579`) or, in `changeAttributes`, a `skippedAttributes` entry (`:632`).
- The glue logic sets the values: `modifyAttribute` (`glue-logic.ts:2401`) and `updateAttribute`
  (`:2365`) lead to `modifyAttributesOfModules` (`:2907`), which per target asks the library to
  resolve the conflicts of the value (`solveModuleAttributeConflict`, `:2919`), sets the value and
  the conflict results on the module (`_setAttribute`, `:2945`) and calculates the group once
  (`_calculateAndUpdateGroupMap`). The same setters serve the planner's own panel
  (`planner-kernel-access.ts:1462`, `roomle-planner.ts:2789`).
- The tool command's result names what the library changed with the value (`withLibraryChanges`,
  `hi-tool-attributes.ts:231`, D59) and an attribute no module has (C22, P2, P3).

Nothing in this path reads the verified options.

### 2.3 The two stages of a create

`create-or-replace-groups` (`hi-tool-commands.ts:377`) sets attributes at two stages:

- **In the layout.** The roots' attribute overrides go into the layout as they are: the glue logic
  copies the article template for every article pick (`prepareArticlePickRoots`, `glue-logic.ts:1017`)
  and sets the overrides as input values on the root module or on the sub modules that carry the
  attribute (`_applyRootAttributeOverrides`, `:978`). The group's `attributes` stay on the group
  (`:646`); the library's group settings among them (`groupSettings` of the master data) are
  calculated with the load, the others are set after it. The load calculates the group
  (`createOrReplacePosGroupsFromLayout`, `:865`). An override the library rules out reaches the
  calculation unchecked, and the library's conflict resolution does not run for it
  ([gap 3 of the calculation-gaps backlog](../backlog/library-calculation-gaps.md#3-a-create-skips-the-librarys-conflict-resolution-and-the-checks-of-its-root-modules)).
- **After the load.** `applyGroupWideAttributes` (`hi-tool-attributes.ts:363`) sets the group
  attributes that are not group settings, the overrides moved off the roots
  (`moveGeneratedRootOverrides`, `:22`) and the roots' own accent values with one planner operation
  `change-attributes` per group — the path of §2.2. It reports per group `set`, `notCarried` and
  `rootValues` (`GroupAttributesReport`, `:256`) and the library's changes (D65).

Before the load, the tool command calculates the anchor's article template with the anchor's
overrides for the frame of a placement by point (`planner.calculateArticleTemplate`, `:596`).
`calculateArticleTemplate(articleId, attributes?)` (`glue-logic.ts:1090`) calculates an article as
a single-pick group outside the plan, cached per library, article and overrides; the planner also
calculates every article's template without overrides for the article catalog of the plan context
(`hi-tools.ts:352`). A calculated template's modules carry `checkAttributes`.

### 2.4 Afterwards

`runToolCommand` (`hi-tool-commands.ts:1366`) reads the calculated groups before the call's first
plan change and after the call; a root module or a group that fails after the call and did not
before is a `libraryFailures` entry, and the tool set reverts the call with the planner's undo
(D106). The error names the root modules and the first line of the library's message.

### 2.5 What the agent reads

The `attributes` section of `get-plan-context` and `find-attributes` list the master data's
`selections` of an attribute (`hi-mcp/tool-executors.ts:577`): the same values for every article,
not the values one module takes. The served text says so and names no value a module rules out: the
library's dependencies between attributes live in its calculation, not in the master data (D59).

## 3. The gap

Four questions the backlog leaves open:

1. **What an edit does with a value the module does not take** — the decision (D51: the tools say
   what happens).
2. **Where the check runs so that it sees the values set earlier in the same call.** The options
   depend on the module's other values: which colours a module takes depends on its program.
   `change-attributes` sets a program and its colours in one call, the programs first (D67); a check
   of every value against the module as it is before the call would rule out a colour the new
   program offers.
3. **How the layout stage of a create is checked** when the root modules exist only after the
   calculation.
4. **What the result says**, compactly: D59's lesson is that ten long correction sentences made a
   result of 23k tokens.

## 4. Proposed design

### 4.1 The decision (D107, to confirm)

**A value the library's verified options rule out is not set on that module, and the result names
the values the module takes.** The measure is the planner's attribute panel, which already applies
the library's verdict to the user:

| The library says about the value | The planner's panel | The HI tools |
|---|---|---|
| `Normal` | offers it | set it |
| `Conflicting` | offers it, after the `Normal` values | set it; the library resolves the conflict in `solveModuleAttributeConflict`, and the result names what it changed (D59) |
| `Invalid`, or the entries do not list it | does not offer it | not set on that module; the other modules and values of the call are set; the correction names the values the module takes |
| outside the range | the slider cannot reach it | not set on that module; the correction names the range |
| off the range's step | the slider snaps | set to the nearest value on the step; the correction says so |
| no verified options for the attribute, or a module without `checkAttributes` | offers the master data's values | set as today; the calculation decides (D106) |

The check is not a guard in the sense of §2.2: the server judges nothing itself, the library rules
the value out and the planner does not offer it to the user either — the user cannot want it in the
planner. The tools take the steps of [Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort):
a value off the step is corrected (step 3); a value the module does not take is left out on that
module and the rest of the call is built, with the values the module takes in the result (step 4);
only a call of which nothing can be set ends in an error (step 5) — the path a call already takes
when no module carries the attribute. The served text describes what happens, not what is rejected
(§2.4).

**Why not correct a list value to a taken one** (step 3): the server cannot tell which value the
agent meant. The nearest colour by its code is library content (§2.4), and a value of another
program is another front. The agent picks from the values the result names, with their descs in the
attribute vocabulary. **Why not clamp a range value**: a 900 mm width asked and 600 mm taken is not
a 600 mm unit; the agent decides, perhaps for another article. Only the step is clear intent.

### 4.2 Where the check runs: one pure check, three callers

A new module `hi-attribute-check.ts` holds one pure function:

```
checkAttributeValues(libraryData, roots, targets) → { taken, notTaken }
```

- `roots` are the root modules the values go to — the calculated roots of a group of the plan, or
  the roots of an article template; `targets` are the values in their order,
  `{ moduleIds, attributeId, value }` as `modifyAttributesOfModules` takes them.
- It walks the targets in order on **copies of the modules** (`structuredClone` per module, once).
  For each module of a target it asks the module's verified options for the attribute and decides by
  the table of §4.1. A taken value is set on the copy together with the library's conflict results
  (`solveModuleAttributeConflict`), as the setter will do, so the next target is checked against the
  module as it will be: a colour after its program sees the program.
- The options of one module, in or outside the plan, come from a helper extracted from
  `getVerifiedAttributeOptions`: its lines `:2457`–`:2487` — the `checkAttributes` gate, the library
  call, the conversion and the sort — become `verifiedOptionsOfModule(libraryData, module,
  attributeIds)`, and `getVerifiedAttributeOptions` is the lookup in the plan plus that helper. No
  other change to the glue logic; its setters stay as they are, so the planner's own panel is not
  touched.
- `taken` are the targets with the modules that take the value, in the same order; `notTaken` lists
  per attribute and value the modules that do not take it — the root module id, the sub module id
  when only a sub module carries the attribute — and the options the library gave, so the caller
  can name the values the module takes. A corrected step value is a taken target with the corrected
  value and a note.

The three callers:

1. **The planner's attribute operations** (`hi-tools.ts`): `changeAttributes`, `changeModuleAttribute`
   and `changeGroupAttribute` build their targets as today, pass them through the check, hand
   `taken` to the glue logic's setter and return `notTaken` on the outcome
   (`HiGroupOperationOutcome`, `hi-plan-context.ts:1185`, beside `skippedAttributes`). When no
   target is left, the operation throws as it does when no module carries the attribute
   (`changeAttributes`, `hi-tools.ts:641`): nothing is loaded, no history step.
2. **The root overrides of a create** (stage 1): the tool command needs the library, so the
   tool-command planner (`HiToolPlanner`, `hi-tool-commands.ts:105`, implemented at
   `hi-tools.ts:313`) gets one method, `checkArticleAttributes(articleId, attributes, libraryId?)`:
   it takes the article template **without overrides** — cached, calculated for the article catalog
   already — and runs the check over the template's roots with the overrides as the targets, the
   programs first. The tool command calls it for every root with `attributes` after
   `moveGeneratedRootOverrides` (`:509`) and before the anchor frames (`:596`), strips the overrides
   that are not taken from the root, replaces an off-step value by its corrected one, and pushes a
   correction per value. The anchor's frame is then calculated with the overrides the root is built
   with. The template without overrides is checked in the order of the values, so the check is the
   same as for an edit of the loaded root module one value after the other — which is also what
   gap 3 asks the layout to become.
3. **The group attributes after the load** (stage 2): `applyGroupWideAttributes` already runs
   `change-attributes`; it reads `notTaken` from the outcome, prefixes the corrections with
   `posGroups[i]`, and leaves an attribute out of `set` when no module of the group took it.

**The library's group settings in the layout** (`groupSettings` of the master data, sent as group
attributes) are not checked at the layout stage: before the load there is no group to ask, the
generated roots that carry them exist only after the calculation, and a template of a root carries
none of them. They stay as today — the calculation decides (D106). This is a known limit of the
design; the alternative is in §5.

### 4.3 The feedback

One correction sentence per attribute, value and set of modules, the modules changed alike in one
sentence as D59 does, the values by their `value` only — their descs are in the attribute vocabulary
of the plan context — in the order the library gives them, the `Conflicting` ones marked:

- an edit: `change-module-attribute: root module 'w1' (OTB60) does not take mod_FrontColor "999" -
  it kept its value; the values it takes: "199", "316", "324" (and "380", "381", which change
  another attribute with them)`
- several root modules: `change-group-attribute: 3 root modules (OTB60 ×3) do not take
  mod_FrontColor "999" - they kept their value; the values they take: …` — when the modules differ
  in the values they take, one sentence per set
- a range: `change-module-attribute: root module 'u1' (UB60) does not take mod_Width "900" - it kept
  its value; it takes 300 to 600 in steps of 10`
- a corrected step: `change-module-attribute: mod_Width "905" was set to "900" on root module 'u1'
  (UB60), the nearest value of its steps of 10`
- a create, stage 1: `posGroups[0] root 'u1' ('UB60'): does not take mod_Width "900" - the root
  module was built without it; it takes 300 to 600 in steps of 10`
- a create, stage 2: `posGroups[0]: 3 root modules (OTB60 ×3) do not take the group attribute
  mod_FrontColor "999" - they kept their value; the values they take: …`
- nothing of the call set: the error `change-module-attribute: root module 'w1' (OTB60) does not
  take mod_FrontColor "999"; the values it takes: …` — the same sentence as the error.

The sentences are built in the tool commands (`hi-tool-attributes.ts`, beside
`libraryChangeSentences`), so the planner's outcome carries data, not text — as `skippedAttributes`
does today. A sub module is named with its root module: `root module 'w1' (OTB60) does not take
mod_DoorDirectionSelection "LeftRight" on its sub module 'mf_Door'`; a `change-module-attribute`
with `moduleId` names the sub module the call named.

### 4.4 The served text (`hi-mcp/hi-mcp-server.ts`)

One sentence in each of the two attribute tool descriptions (`:596`, `:635`) and in the
`corrections` part of the create's description (`:500`): "A value a module does not take by the
library's own check is not set on it; corrections names the values it takes." The rule "Read
corrections, notLoaded and hint in a result" (`:45`) lists it among what `corrections` holds. The
sentence "A value the library cannot calculate a root module with changes nothing" stays: it covers
the attributes the library does not verify. Library-neutral: no attribute, value or library is
named.

### 4.5 Cost

One library call per module and attribute of a call: `change-group-attribute` of a front colour on
a group of ten units asks the ten root modules and their fronts, about thirty calls into a table
lookup of the library. The planner's panel asks for every parameter of the panel on each selection.
Measure the attribute commands before and after with `benchmark-hi-mcp-runs.js` over a test run
([hi-mcp-benchmarking](../skills/hi-mcp-benchmarking.md)) and note the figure in the pull request.

**Assumption to verify first:** the library computes the options from the module's attribute
values, so that a copy with the call's earlier values applied answers for the module as it will be.
`solveModuleAttributeConflict` is called in that very state by `modifyAttributesOfModules` and
works; `getAttributesDropDownValues` takes the same module data. Verify in the example page with a
local roomle-ui before the implementation: read the options of `mod_FrontColor` of an `OTB60` with
`mod_FrontProgram` `Classic`, set `Modern` on a copy of the module data, read them again. If the
options do not follow the copy, the check of a later value needs the module calculated with the
earlier ones — one `calculateArticleTemplate` with the values set so far —, and §5 names the
fallback.

## 5. Alternatives considered

| Alternative | Why rejected |
|---|---|
| Apply the value and let D106 revert the call (today) | The whole call is lost, also the groups a create could calculate, and the agent learns the library's message, not the values the module takes. D99 names it an MCP bug |
| Serve the verified options up front: per root module in the plan context, or a `rootModuleId` on `find-attributes` | The options are per module and change with every value set — stale by the time the agent uses them; per root module 16 attributes with some 40 values each cost more tokens than the plan context (D59's lesson). A `find-attributes` by root module can come later if the agent asks before it sets; the result's list covers the case the item is about |
| The check inside the glue logic's `modifyAttributesOfModules`, as an opt-in flag | The setter serves the planner's own panel as well (D106's reasoning against policy in the glue logic); its return type would change for every caller. The copies keep the glue logic as it is, with one extracted helper |
| Check the root overrides of a create after the load, on the calculated group | A root module the library could not calculate has no geometry when the arrangement and the placement by wall run; and "left out" after the load needs a second value the agent did not send |
| Calculate the article template **with** the overrides for the check | A template with a value the library rules out may fail to calculate and gives no options; the template without overrides is cached, and the ordered check mirrors the edit path |
| Correct an `Invalid` list value to the nearest taken value, clamp a range value | The server cannot tell the intent (§4.1); the step is the one clear case |
| Treat `Conflicting` as not taken | The planner offers these values; the library resolves the conflict and D59 names the change |
| Refuse the whole call when one value is not taken | Step 4 of the guards: one module's value does not cost the others; the planner builds the rest |
| A served rule that names the combinations a module takes | Library content (§2.4 of the behaviour reference) |
| Set the library's group settings after the load, so the check covers them | Moves them out of the calculation of the load: a second calculation for every create with group settings, and the placement by wall would run before a generated part exists. Not needed for the item; the calculation decides as today. If the user wants them covered: `getVerifiedGroupAttributeOptions` on the loaded group and the stage-2 `change-attributes` for a value not taken — but a "left out" value then needs a default the master data does not give |

## 6. Code and documents the work touches

**roomle-ui**

| File | Change |
|---|---|
| `hi-attribute-check.ts` (new) | `checkAttributeValues` (§4.2): the ordered check on module copies, the verdict per kind and range, the step correction |
| `glue-logic.ts` | `verifiedOptionsOfModule(libraryData, module, attributeIds)` extracted from `getVerifiedAttributeOptions` (`:2448`); `getVerifiedAttributeOptions` keeps its signature and behaviour |
| `hi-tools.ts` | `changeAttributes`, `changeModuleAttribute`, `changeGroupAttribute` run the check before the setter and return `notTaken`; `_toolPlanner.checkArticleAttributes` (§4.2, caller 2) |
| `hi-plan-context.ts` | `notTaken` on `HiGroupOperationOutcome` (`:1185`) |
| `hi-tool-commands.ts` | `HiToolPlanner.checkArticleAttributes`; the create strips the overrides that are not taken before the anchor frames (`:509`–`:596`); `runToolCommand`'s `counting` planner forwards the method; `change-module-attribute` and `change-group-attribute` turn `notTaken` into corrections |
| `hi-tool-attributes.ts` | `notTakenSentences` beside `libraryChangeSentences`; `applyGroupWideAttributes` reads `notTaken`, prefixes the sentences, excludes an attribute no module took from `set` |
| `hi-mcp/hi-mcp-server.ts` | the sentences of §4.4 |
| `__tests__/hi-attribute-check-test.ts` (new) | with a `LibraryData` mock: an `Invalid`, an unlisted and an out-of-range value are not taken; a `Conflicting` value is taken; a value off the step is corrected to the nearest step; an attribute without options and a module without `checkAttributes` are taken; a colour after its program is checked against the module with the program; the library's conflict results are applied on the copy |
| `__tests__/hi-tools-test.ts` | `describe('changeAttributes')`, `describe('changeModuleAttribute')`, `describe('changeGroupAttribute')`: with `getAttributesDropDownValues` mocked, a value the module does not take is not set on it and the others are, the outcome carries `notTaken`; when nothing is taken the operation throws and loads nothing |
| `__tests__/hi-tool-commands/group-commands-test.ts` | `describe('attribute tools')`: the correction sentences for a list, a range and a corrected step; the error when nothing was set |
| `__tests__/hi-tool-commands/create-or-replace-groups-input-test.ts` | an override not taken is stripped before the load and named `posGroups[i] root …`; the anchor template is calculated with the remaining overrides; a group attribute no module took is not in `set` and is named |
| `__tests__/hi-mcp/hi-mcp-server-test.ts` | `it('tells the agent that a value a module does not take is not set and that corrections names the values it takes')` |
| `__tests__/glue-logic-test.ts` | the tests of `getVerifiedAttributeOptions` (`:3600` ff.) stay green through the extraction |
| `.agents/homag-intelligence/hi-tools-behaviour.md` | D107 in §3 (a new heading "Verified values" after "Calculation errors"); D99's state cell no longer names open work; §2.3 lists the correction; §6 `create-or-replace-groups` and "The command tools"; §8.3 a G69 row for the create's two stages, §8.5 a C31 row for the edits |
| `.agents/homag-intelligence/hi-tools-reference.md` | the attribute commands (`:345`, `:346`, `:355`), the create's `corrections` (`:227`) |
| `.agents/homag-intelligence/library-errors.md` | the bullet "Values are not checked before an edit" (`:279`) becomes the description of the check; the call-site row of `getAttributesDropDownValues` (`:79`) gains the new callers |

**roomle-hi-example**

| File | Change |
|---|---|
| `.agents/skills/hi-mcp-tools.md` | the command tools (`:292`–`:330`) and the create's returns (`:182`) |
| `.agents/wiki/why-the-agent-cannot-plan-what-the-library-cannot-build.md` | the short answer's bullet, the table "What happens to wrong input" (a row for a value the module does not take), the section "Values are not checked before an edit" (`:157`) describes the check |
| `.agents/backlog/attribute-values-checked-before-an-edit.md`, `README.md`, `.agents/README.md` | the item leaves the backlog when the work is on its branch |
| `.agents/backlog/library-calculation-gaps.md` | the intro (`:18`), the overview row (`:33`), gap 3's to-do 4 (`:160`), gap 4 (`:182`, `:192`) |
| `.agents/backlog/library-issues.md` | issues 80 (`:437`) and 106 (`:608`): "the check the tools make" |
| `docs/user-guide/README.md` | Limits (`:223`): one line that a value a unit does not take is not set and the assistant is told which values it takes |

## 7. Verification

- The unit tests of §6, run in roomle-ui `packages/web-sdk` with vitest.
- A model-free check in the example page with a local roomle-ui (`--dev`), through
  `instance.extended.callExternalObjectAgentTool`: `change-module-attribute` with a front colour the
  module's entries do not list — the result's correction names the values it takes and the plan is
  unchanged; a create with such a colour as a root override — the group loads without it and the
  correction names it; a `Conflicting` colour — set, with D59's sentence; `mod_Width` 900 on an
  `OTB60` — unchanged behaviour, the library does not verify the width, so D106 answers.
- The benchmark of §4.5.

No test of `docs/test-prompts.json` depends on the change; the stored runs of library issues 80 and
106 fail on attributes the library does not verify and keep failing until the library declares the
ranges.
