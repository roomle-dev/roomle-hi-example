# RML-18064: implementation plan — the five improvements of the kitchen-from-image benchmark

> **Type**: Implementation plan (step 4 of the [change workflow](../../AGENTS.md#suggested-change-workflow))
> **Analysis**: [kitchen-from-image-time.md](kitchen-from-image-time.md) — the flaws, the five
> improvements and their expected savings
> **Date**: 2026-10-08
> **Author**: AI Assistant
> **Status**: Open — reviewed 2026-10-08: compact answers agreed; "test the mcp" with its report is the
> required last step
> **Branches**: roomle-ui `feat/hi-batch-attribute-commands-RML-18064` (created from
> `fix/hi-mcp-api-and-tools`); roomle-hi-example
> `feat/kitchen-from-image-speedups-RML-18064` (from `master`, created when the implementation
> starts)

**Repositories**

- **roomle-ui** — one new group operation, `change-attributes`: several attributes on a group, or
  one attribute on several root modules, in one calculation, one load and one undo step
  (improvements 2 and 3).
- **roomle-hi-example** — the MCP server: `find-attributes` (1), the group attributes of a create
  (2, 4), `change-module-attribute` for several root modules and compact attribute results (3), the
  corrections (4), the compact catalog (5); the served text, the unit tests and the living docs.
- **ligna-store** — no change: its page bridge already forwards `externalObjectGroupOperation`, its
  chat takes the tool descriptions from the server, and it gets `change-attributes` with the planner
  it embeds.

---

## Rules of this plan

- **Implement all five improvements first, test at the end.** Between the improvements: no test
  runs, no live checks, no model runs — only what the editor shows. The unit tests are written with
  each improvement and run once, together, in [the end](#6-at-the-end-the-tests). A test suite is run
  in between only when a change cannot be continued without it, and the agent says so.
- **Developed and tested locally.** The roomle-ui checkout is on
  `feat/hi-batch-attribute-commands-RML-18064` and runs with `npm run dev` on
  http://localhost:5173/; roomle-hi-example uses that planner with `--dev`.
- **"test the mcp" must run at the end.** The user wants its report after all changes are
  implemented: the implementation is finished only with the session's `report.md` and `report.pdf`
  ([6](#6-at-the-end-the-tests), step 4). Other model runs (the benchmark again, the other two
  models) start only when the user asks for them.
- **Pull requests only on request** in roomle-hi-example (`AGENTS.md`). Commits: two or three per
  repository.

## Decisions

| # | Decision | Rejected |
|---|---|---|
| 1 | **One planner command for improvements 2 and 3**, `change-attributes` `{ groupId, attributes: [{ attributeId, value, rootModuleIds? }] }`: an entry without `rootModuleIds` sets the attribute on every module of the group that carries it (as `change-group-attribute`), an entry with them on those root modules and their sub modules that carry it (as `change-module-attribute` without `moduleId`) | two commands (`change-group-attributes`, a list in `change-module-attribute`): twice the payload types, handlers and docs for the same loop |
| 2 | **No fallback** in the server for a planner without `change-attributes`: the server is developed and tested against the local planner, which has it | one command per attribute when the planner refuses the new one |
| 3 | **Attribute commands answer compactly** (agreed by the user, 2026-10-08): `change-module-attribute` and `change-group-attribute` return `{ command, groupIds, changedModuleIds, corrections? }` — no `groups`. The structural commands (merge, insert, exchange, swap, delete) keep the whole group: the agent needs its new root ids | compacting every command result: the agent would read the plan context after every structural edit |
| 4 | **The catalog description is the article's FUNCTION and AI_SELECTION_HINT lines** (about 120 characters), the full description in a new `get-plan-context` section `articleDescriptions` | the hint alone (56 characters): the function line says what the article is ("Living-room sideboard, 60 cm wide, with 1 door and 1 drawer"); filtering the catalog by category: the agent would have to know the category before it reads the catalog |
| 5 | **find-attributes reads three spelling pairs** — colour/color, grey/gray, worktop/countertop — and matches every word of the text on its own | a synonym list of its own: every entry is a guess about the library's words; fuzzy matching: more matches, more tokens |
| 6 | **The group attributes of a create are reported in `groupAttributes`, not in `corrections`** — per group the attributes set and those no unit of the group carries; a D59 sentence after a create names "its group attributes" as the cause instead of listing them | keeping them in `corrections` and shortening the sentences: the channel still tells the agent that its input was wrong |

The decision rows go into [§3 of hi-mcp-behaviour.md](../../docs/hi-mcp-behaviour.md#3-decisions)
as D62–D65 (decisions 3–6; decisions 1 and 2 amend D36), with the date of the approval of this
plan.

## 1. roomle-ui — `change-attributes` (improvements 2 and 3)

The roomle-ui checkout switches to `feat/hi-batch-attribute-commands-RML-18064`; `npm run dev`
serves it on http://localhost:5173/.

### Code — `packages/web-sdk/packages/homag-intelligence/`

| File | Change |
|---|---|
| `src/hi-plan-context.ts` | `HI_GROUP_OPERATION.CHANGE_ATTRIBUTES: 'change-attributes'`; payload type `'change-attributes': { groupId: string; attributes: HiAttributeChange[] }` with `HiAttributeChange = { attributeId: string; value: HiAttributeValue; rootModuleIds?: string[] }`; its handler: `requiredString('groupId')`, a non-empty `attributes` list checked like the `attributes` of `articlePick`, `rootModuleIds` a non-empty list of strings when present; `HiGroupOperations.changeAttributes`; `HiGroupOperationResult` gets the optional `skippedAttributes?: HiAttributeChange[]` (the entries no targeted module carries, without their value) |
| `src/glue-logic.ts` | `changeAttributes(groupId, changes)`: `_requireGroupsInScene([groupId])`; every `rootModuleIds` entry a root of that group, else `Root module '…' is not in group '…'.`; per entry the targets with `_attributeTargets` (every root, or the named ones); an entry without targets goes to `skippedAttributes`; no entry with targets → the error of `change-group-attribute` (`No module of group '…' has the attribute '…'.`, every attribute named), no load. Then `_modifyAttributesOfModules(item, [{ moduleIds, attributeId, value }])`: per entry and module `solveModuleAttributeConflict` and `_setAttribute` in the given order, then **one** `_calculateAndUpdateGroupMap` and **one** `loadPosGroups` (reason `CHANGE_ATTRIBUTE`) — one undo step. `_modifyAttributeOfModules` becomes the call with a list of one. Result `{ groupIds: [groupId], removedGroupIds: [], changedModuleIds, skippedAttributes? }` |
| `src/external-object-api.ts` | typedoc of `externalObjectGroupOperation`: the new command |
| `packages/embedding-lib/docs/homag-intelligence-embedding.md` | the command table (around line 1783), its payload and result, `skippedAttributes`, an example; `changedModuleIds` also for `change-module-attribute` without `moduleId` |
| `.agents/homag-intelligence.md` | the attribute flow (around line 123): several attributes in one calculation and one undo step |

Order semantics (the library is asked per entry as with single commands, the calculation runs once
at the end): a conflict result of a later entry overrides an earlier one; a value the library
changes only in its calculation is changed once, after all entries.

### Unit tests

`__tests__/hi-plan-context-test.ts`, `describe('runGroupOperation')`:

1. rows in **rejects an invalid %s payload %j**: no `groupId`; `attributes` missing, empty or no
   list; an entry without `attributeId`; a number as `value`; `rootModuleIds` empty or not a list of
   strings.
2. a row in **performs %s with %s**: `change-attributes` calls `changeAttributes(groupId, attributes)`
   and `getCalculatedGroups`.
3. **reports the changed modules and the skipped attributes of change-attributes**.

`__tests__/glue-logic-test.ts`, `describe('group operations')` → new `describe('changeAttributes')`:

4. **sets several attributes on every module of the group that has them, with one calculation and
   one load** — `calculateGroup` and `loadPosGroups` spied: once each.
5. **sets an attribute on the named root modules and their sub modules that carry it, and on no other
   root module**.
6. **skips an attribute no targeted module has and names it in skippedAttributes**.
7. **rejects when no targeted module has any of the attributes, without loading**.
8. **rejects an unknown group, a group not in the scene and a root module of another group, without
   loading**.
9. **applies the entries in their order with the library's conflict results** —
   `solveModuleAttributeConflict` spied: the conflict result of the second entry overrides the first
   entry's value.
10. **keeps the plan when the library cannot calculate the changed group** — as the existing test
    'changes an attribute after the library could not calculate the previous change' (line 9352).

## 2. roomle-hi-example — group attributes in one command, reported apart (improvements 2 and 4)

| File | Change |
|---|---|
| `hi-mcp/hi-mcp-server/tool-executors.ts` | `applyGroupWideAttributes`: one `externalObjectGroupOperation('change-attributes', { groupId, attributes })` with every entry of `toApply` instead of one `change-group-attribute` each. The result's `skippedAttributes` and the set ones go into the new create result field `groupAttributes: [{ index, groupId, set, notCarried? }]`; no "was set on every unit" correction any more. A refused command stays a correction ("… could not be set on group …", the load is kept). `libraryChangeSentences` takes the cause as a text: after a create "its group attributes", after a command the attribute set. `FOLLOW_UP_COMMANDS` gets `change-attributes` |
| `hi-mcp/hi-mcp-server/hi-mcp-server.ts` | `create-or-replace-groups` description: the result names `groupAttributes` (the attributes set on every unit, and those no unit of the group carries — the group stands without them, nothing to undo) |

### Unit tests — `tests/tool-executors.test.ts`

In `describe('create-or-replace-groups materials')` (`createMaterialsApi` answers
`change-attributes`):

11. **sets the group attributes that are not group settings in one planner command after the load**
    (replaces 'applies the group attributes …', line 3093).
12. **names the attributes set and those no unit of the group carries in groupAttributes, not in
    corrections**.
13. **names the group attributes once as the cause of a library change** (adapts 'names the colour
    the library reset with a group front program', line 3129).
14. Adapted: the replace (line 3215), the colours of the generated roots (line 3339) — now entries of
    the same command — and the refused command (line 3318).

In `describe('undo and redo')`:

15. **reverts a kitchen with three materials with two planner undos** — the load and the one
    command.
16. Adapted: 'waits for the follow-up reload of an attribute change' (line 6856) also for
    `change-attributes`.

## 3. roomle-hi-example — several root modules, compact answers (improvement 3)

| File | Change |
|---|---|
| `hi-mcp/hi-mcp-server/hi-mcp-server.ts` | `change-module-attribute`: `rootModuleIds: string[]` (one or more root modules), `rootModuleId` still read as a list of one; description: "the root modules may belong to one group or to several"; result: `{ command, groupIds, changedModuleIds }` and the corrections. `change-group-attribute`: the same compact result |
| `hi-mcp/hi-mcp-server/tool-executors.ts` | `change-module-attribute`: every id resolved (C17); the root modules grouped by group; per group one `change-attributes` with one entry `{ attributeId, value, rootModuleIds }`; with `moduleId`, one `change-module-attribute` per root module as today. No root module given → the error names `rootModuleIds`. Both attribute tools return the compact result, `withLibraryChanges` reading the groups of the planner's result before they are dropped |

### Unit tests

In `tests/tool-executors.test.ts`, `describe('group command tools')`:

17. **sets an attribute on several root modules of one group in one planner command**.
18. **sends one planner command per group for root modules of several groups**.
19. **reads a single rootModuleId as a list of one**.
20. **sets the sub module of every root module with moduleId, one command each**.
21. **answers an attribute change with the changed groups and modules, not the whole group** — both
    attribute tools.
22. **resolves every root id of the list** (in `describe('root module ids')`).
23. Adapted: the rows of the two attribute tools in '%s forwards its command to the planner'
    (line 4875) and the library-change tests (from line 5681) with the compact result.

In `tests/hi-mcp-server.test.ts`: the `change-module-attribute` row of 'rejects %s without a required
argument before any planner call' (line 98) moves to the executor's error.

## 4. roomle-hi-example — one search finds the material (improvement 1)

| File | Change |
|---|---|
| `hi-mcp/hi-mcp-server/tool-executors.ts` | `attributeMatches`: the text split into words; an attribute matches when every word is in one of its fields; text and fields compared with colour→color, grey→gray, worktop→countertop. The executor lists a value list it already listed for another attribute once: later attributes carry `sameSelectionsAs: '<attribute id>'` instead of `selections` |
| `hi-mcp/hi-mcp-server/hi-mcp-server.ts` | `find-attributes` description: every word is matched on its own, British and American spelling alike; "color" returns every colour attribute — front, carcase, countertop (worktop), toe kick — and their values once; it keeps "pick a dark, a light or a blue value by its code" |

### Unit tests

In `tests/tool-executors.test.ts`, `describe('find-attributes')`:

24. **matches every word of the text on its own, in any order**.
25. **reads colour as color, grey as gray and worktop as countertop**.
26. **lists a value list several attributes share once** — the later attribute carries
    `sameSelectionsAs`.

In `tests/hi-mcp-server.test.ts`:

27. **tells the agent that one search finds every colour attribute and its values once**.

## 5. roomle-hi-example — the compact catalog (improvement 5)

| File | Change |
|---|---|
| `hi-mcp/hi-mcp-server/tool-executors.ts` | `agentFacingArticle`: `desc` becomes the FUNCTION and AI_SELECTION_HINT lines of a sectioned description, a description without these sections stays as it is. New section `articleDescriptions` in `PLAN_CONTEXT_SECTIONS`, not a default: `[{ articleId, desc }]` with the full description |
| `hi-mcp/hi-mcp-server/hi-mcp-server.ts` | `get-plan-context` description and `include`: the short `desc`, the section `articleDescriptions` for the full one |

### Unit tests

In `tests/tool-executors.test.ts`, `describe('get-plan-context')`:

28. **shortens an article description to its function and selection hint**.
29. **keeps an article description without these sections as it is**.
30. **returns the full article descriptions only in the articleDescriptions section**.

### Documentation of 2–5, written with the code

| Document | Change |
|---|---|
| `docs/hi-mcp-behaviour.md` | D36 amended, D62–D65 ([decisions](#decisions)); §4 the step count of a create (one step for the group attributes); §5.4 the `articles` row and the new section; §6 `find-attributes`, `create-or-replace-groups` result, the command tools table and result paragraph; §8.1 `corrections` row; G46 rewritten; C22 |
| `docs/hi-mcp-server.md` | the `find-attributes` section, the command rows, `get-plan-context` |
| `.agents/skills/hi-mcp-tools.md` | the `find-attributes` section, the command results |

## 6. At the end: the tests

One round, after all five improvements, in this order — each step only when the one before is green:

| # | Check | Time |
|---|---|---|
| 1 | roomle-ui: `CI=true npm run test -- --run packages/homag-intelligence` in `packages/web-sdk`, lint of the changed files | about 3 min |
| 2 | roomle-hi-example: `npm test` and `npm run typecheck` in `hi-mcp`, `npm run lint`, `npm run format:check`, `check-markdown-links.js` on the changed documents | about 2 min |
| 3 | A live check without a model against the local planner (http://localhost:5173/): the launcher with `--dev` on spare ports, headless Chromium, the MCP SDK client. `create-or-replace-groups` with three group attributes (one planner command, `groupAttributes`), `undo` (two planner undos), `change-module-attribute` on two root modules (one command, compact result), `find-attributes "front colour"` and `"worktop"` (matches, shared values once), `get-plan-context` (catalog size against 167,480 characters) | about 10 min |
| 4 | **"test the mcp" — required** ([hi-mcp-testing.md](../skills/hi-mcp-testing.md)): every test of `docs/test-prompts.json` with gpt-6-astra and `--dev`, evaluated, with its report `report.md` and `report.pdf` for the user, and the backlog updated from it — the shorter catalog descriptions and the compact answers may change which articles and steps the agent picks. The implementation is finished only with this report | about 60–75 min, about 15M input tokens |

Only on the user's go — proposals, not part of the implementation:

| Run | Runs | Time | Input tokens |
|---|---|---|---|
| the benchmark: the four tests × gpt-6-astra, twice, with `--dev`, compared with [benchmark.md](kitchen-from-image-time/benchmark.md) | 8 | about 15 min | about 4M |
| the same for gpt-5-mini and gpt-5.4-mini (open in the analysis) | 16 | about 30–40 min | about 6–8M |
