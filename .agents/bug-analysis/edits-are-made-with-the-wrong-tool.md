# Edits are made with the wrong tool

> **Type**: Bug Analysis  
> **Status**: Open — the fix is implemented and verified on the working branch, and the analysis stays open until
> it lands on `release/bo-test` or `master`; ["cleanup analyses"](../skills/hi-analysis-cleanup.md) closes and
> deletes it  
> **Date**: 2026-11-01  
> **Backlog**: [Where Mistral Large falls short of the prompts](../backlog/mistral-large-prompt-issues.md), issue 4
> ("Edits are made with the wrong tool")  
> **Base**: roomle-hi-example `analyse/mistral-large-prompt-issues-bug-4` (from `master` `7c18480d`); roomle-ui
> `feat/hi-planning-assistant-lightweight` (`31def74f2`)  
> **Fix**: roomle-ui `feat/hi-planning-assistant-lightweight` `72be4d1a2` — the edit tools' descriptions open with
> the words the user says for the edit and the `create-or-replace-groups` description names the replace as the
> rebuild and lists the edit tools by those words (`hi-mcp-server.ts`); a replace that only adds, reorders or
> exchanges root modules answers with a `hint` naming the edit tool, and a replaced row that now reaches past a
> wall of the room gets the row-reach note (`hi-tool-commands.ts`, `hi-tool-hints.ts` `replaceReachHints`); the
> group-attribute failure message names `change-module-attribute`/`change-group-attribute` and
> `exchange-root-module` (`hi-tool-attributes.ts`); unit tests in `__tests__/hi-mcp/hi-mcp-server-test.ts` and
> `__tests__/hi-tool-commands/create-or-replace-groups-replace-test.ts`, the schema fixture rewritten; durable
> outcome in roomle-ui D137 and G69–G71 of `hi-tools-behaviour.md` and in `hi-tools-reference.md`. Verified with
> the unit tests (1745 in `homag-intelligence`) — see §6

**Affected repositories**

- **roomle-ui** (on `feat/hi-planning-assistant-lightweight`): the tool descriptions of the edit tools and of
  `create-or-replace-groups` (`packages/web-sdk/packages/homag-intelligence/src/hi-mcp/hi-mcp-server.ts`), the replace
  path and the result hints of the `create-or-replace-groups` command (`hi-tool-commands.ts`, `hi-tool-hints.ts`),
  their unit tests (`__tests__/hi-mcp/hi-mcp-server-test.ts`, `__tests__/hi-tool-commands/`), and the references
  (`.agents/homag-intelligence/hi-tools-behaviour.md`, `hi-tools-reference.md`).
- **roomle-hi-example**: this analysis and the backlog item it comes from; the skill `.agents/skills/hi-mcp-tools.md`
  when the tool reference changes.
- **Unchanged:** the example pages and the embedding-lib (the page loads the tool set from the planner at its server
  URL, no forwarding change); the planner's group operations and `glue-logic.ts` (the Planning Assistant stays out of
  the glue logic); the library's calculation — the fix changes the served text and the tool results, never what the
  library calculates.

## 1. Symptom and reproduction

`mistral-large-latest` re-sends a whole group with `create-or-replace-groups` for edits that have their own tool:
a move (run 09), a width (15, 31 — exchanged for another article), an exchange (23), one more unit (18, 42, 54,
55). A replace without a placement keeps the group's origin, so a reversed or extended row runs through a wall
(09, 55); a new group with the id of an existing unit duplicates it (18); a new group of one wall cabinet lands at
the plan origin (54). Run 30 deletes with the compacting delete where the test expects the in-place delete.
`mistral-large-4` uses the edit tools, with two exceptions: "delete the middle unit" closes the gap with
`delete-article-and-compact` where D58 makes the in-place delete the default (large-4 44, 45, 46), and a widening
the library cannot calculate (Error 14019) is answered with another kind of article instead of a size-attribute
change (large-4 36) — the correction ends "change the failing values or replace the article".

**Reproduce.** Test session `mcp-test-2026-10-17_10-50-12` (`mistral-large-latest`), runs 09, 15, 18, 23, 30, 31, 42,
54, 55; session `mcp-test-2026-10-21_16-59-20` (`mistral-large-4`), runs 36, 44, 45, 46. **Reproducibility:** high —
9 of 56 runs of `mistral-large-latest` and 4 of 52 of `mistral-large-4`.

## 2. Investigation trace

1. The HI chat shows the model only the tool list: roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md` §4 —
   a client that does not pass the server's instructions on, like the HI chat, "shows the model only the tool list",
   and "reminders in tool descriptions … reach it through the tool list on every request. A chat turn has 16 steps;
   the last one cannot call a tool". `AUTHORING_RULES` (roomle-ui
   `packages/web-sdk/packages/homag-intelligence/src/hi-mcp/hi-mcp-server.ts:18`) is served only on demand by
   `get-authoring-rules` (`:448-456`), so a model that skips that call never reads it.
2. The tool-choice rule for edits lives in the rules, not in the tool list. `AUTHORING_RULES` line 42: "To change an
   existing group, use the command tools: merge-article-into-group adds … delete-group deletes a group …
   merge-groups joins groups …"; line 46: "other sizes or materials of its root modules are a change, made with the
   command tools"; line 21: "change-module-attribute with that attribute id, never its name, changes the size of a
   root module". None of these sentences is in a tool description the model reads on every request.
3. The edit tools' descriptions open with their mechanics, not with the words a user says for the edit:
   `place-group` "Moves an existing group to a wall, a room corner, or a point and rotation" (`hi-mcp-server.ts:684`),
   `merge-article-into-group` "Adds one article to an existing group as a new root module" (`:914`),
   `insert-article-into-group` "Inserts one article from the catalog between two root modules" (`:971`),
   `exchange-root-module` "Replaces one root module of a group with an article from the catalog" (`:1002` — the
   width case appears only mid-text, as an attribute-id example), `swap-root-modules` "Lets two root modules of a
   group change places" (`:1027`), `change-module-attribute` "Sets one attribute of one or more root modules"
   (`:772`), `change-group-attribute` "Sets attributes on every module of a group" (`:812`), `delete-group`
   "Deletes a group with all its root modules from the plan" (`:855`). Only the two delete tools open with the case
   they are for — 'the tool for "delete" or "remove" when the user does not ask to close the gap' (`:869-871`) and
   'the tool when the user asks to close the gap' (`:885-887`) — the pattern D58 established
   (`.agents/homag-intelligence/hi-tools-behaviour.md:266`): "the descriptions carry the selection, because the HI
   chat reads the tool list, not the rules". `redo` follows the same pattern ('"redo it", "bring it back"',
   `:1085-1087`).
4. The `create-or-replace-groups` description itself invites the replace reading: "A group whose id matches an
   existing group completely replaces that group and keeps its position" (`hi-mcp-server.ts:648-652`). It names
   `merge-article-into-group`/`insert-article-into-group` only for an article beside an existing group (`:642-643`);
   no description says that a single edit — a move, a width, one more unit, an exchange, a swap — is its own tool
   rather than a replace.
5. The replace path answers nothing about the edit. On a replace of a group in the plan the only correction is about
   the unused placement (`hi-tool-commands.ts:673-680`); the result's `hint` covers only unpositioned groups and
   obstacles (`:892-911`). `rowReachHints` — "the row now reaches past a wall of the room - move it with place-group
   or edit the row if that is not what was asked" (`hi-tool-hints.ts:60-114`, message at `:84-87`) — is applied only
   through `withRowHints` around the five row-edit commands (`hi-tool-commands.ts:1376, 1444, 1484, 1530, 1575`),
   never around `create-or-replace-groups`. So a reversed or extended row sent as a replace runs through a wall with
   no note (runs 09, 55), where the same change through an edit tool would be reported.
6. The library-error correction at `hi-tool-attributes.ts:933` ends "change the failing values or replace the
   article" — for a width the library cannot calculate, "replace the article" sends the model to
   `exchange-root-module` with another article (large-4 36) instead of the size-attribute change the rules describe.

## 3. Root cause

Two gaps, both in roomle-ui on `feat/hi-planning-assistant-lightweight`:

- **The tool choice for an edit is served only where a weaker model does not read it.** The selection rule
  ("to change an existing group, use the command tools"; "sizes or materials are a change, made with the command
  tools"; the size-attribute sentence) is in `AUTHORING_RULES` (`hi-mcp-server.ts:18`, template lines 21, 42, 46),
  served by `get-authoring-rules` on demand — while the HI chat reads the tool list on every request and a turn has
  16 steps (`.agents/homag-intelligence/hi-tools-behaviour.md` §4). The edit tools' descriptions open with their
  mechanics, not with the user's words; only the delete tools open with their case (D58, `:869-887`). A model that
  therefore reads `create-or-replace-groups`' "a group whose id matches an existing group completely replaces that
  group" (`:648-652`) as the way to change a group re-sends the whole group for every edit.
- **The replace result does not name the edit tool and does not report the row out of the room.** On a replace,
  `create-or-replace-groups` corrects only the unused placement (`hi-tool-commands.ts:673-680`) and its hints cover
  unpositioned groups and obstacles only (`:892-911`); `rowReachHints` ("the row now reaches past a wall of the
  room") runs only on the five row-edit commands via `withRowHints` (`hi-tool-hints.ts:60-114`,
  `hi-tool-commands.ts:1376-1575`). So the wrong-shaped replace builds silently — through a wall, duplicated, at the
  origin — and the model is never told which tool the edit had.

## 4. Why the current code produces wrong results

The replace is a legitimate API — rebuilding a group with its id is the documented way to fix a wrong layout — and
the server is built correction-first, so the call succeeds and builds. But the description layer answers the
selection question only in the rules text a weaker model skips, and the result layer reports the consequences of a
replace (row out of the room, added roots) only for the edit tools. The model thus gets a successful, wrongly
shaped plan and a result that says nothing about the edit tool it should have used, so it repeats the pattern on the
next turn. The delete tools show the working shape: their descriptions open with the case, and the model picks
them (large-4's remaining delete slip aside, the delete choice works in both sessions).

## 5. Proposed clean fix

All in roomle-ui on `feat/hi-planning-assistant-lightweight`. Served text and results only — corrections and hints,
never refusals (the rules of "Guards Are a Last Resort"); library-neutral: no article, attribute id or value of a
library in the descriptions — the size attribute and its values come from the catalog and the plan context
(§2.4 of `hi-tools-behaviour.md`).

1. **Open each edit tool's description with the words a user says for it**, as D58 does for the delete tools:
   `place-group` — the tool for "move" / "shift it to the other wall" / "into the corner";
   `merge-article-into-group` — "add one more" / "extend the row" at its end; `insert-article-into-group` —
   "put one between"; `exchange-root-module` — "exchange" / "swap the X for a Y" / "make it wider, 900 mm wide" (the
   same article with another size, set by its size attribute id from the catalog, or another article);
   `swap-root-modules` — "swap the two units"; `change-module-attribute` / `change-group-attribute` — "change the
   colour of …" / "the whole group in …", a size change by the size attribute id. Each description also says what it
   is not for and points to the replace for a rebuild ("take the group from get-plan-context, change it, resubmit it
   with its id" via `create-or-replace-groups`).
2. **Make the replace case explicit in the `create-or-replace-groups` description** (`hi-mcp-server.ts:633-678`): a
   group whose id matches an existing group replaces it — that is the rebuild, for a wrong layout, wall or set of
   articles; a single edit — one article added, inserted, exchanged, swapped or deleted, a move, a size or material
   change — has its own tool, and the description names the edit tools by their user words.
3. **A hint on a replace that only adds or reorders roots** in the `create-or-replace-groups` command
   (`hi-tool-commands.ts`, beside the placement correction at `:673-680`): when a replaced group's sent roots keep
   the previous root ids and only add or reorder, the result names the edit tool — "group 'x' was replaced with one
   more root module — merge-article-into-group adds an article to an existing group at a free end" (insert /
   exchange / swap likewise). A note, never a refusal: the replace stays valid and the plan keeps it.
4. **The row-reach note on replaces**: apply `rowReachHints` (or its reaches-out part, `hi-tool-hints.ts:72-87`) to
   the replaced groups of a `create-or-replace-groups` call, so "the row now reaches past a wall of the room" also
   appears when a replace extended or reversed a row out of the room (runs 09, 55).
5. **The library-error correction** at `hi-tool-attributes.ts:933`: when the failing value is a size the library
   cannot calculate, the message names the edit tools for the intent — change the size attribute with
   `change-module-attribute`, or exchange the root module with `exchange-root-module` — instead of ending on
   "replace the article".
6. **Tests**: description tests in `__tests__/hi-mcp/hi-mcp-server-test.ts` — each edit tool's description opens
   with its user words, guarded like the D58 delete tests; command tests in `__tests__/hi-tool-commands/` — a replace
   that adds a root answers with the merge hint, a replace that reorders with the swap/insert hint, a replace whose
   row now stands out of the room answers with the reach hint.
7. **References**: roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md` (§8 corrections/hints and a decision row
   in §3) and `hi-tools-reference.md`; here `.agents/skills/hi-mcp-tools.md`.

No change to `get-plan-context`, the planner methods, the group operations, `glue-logic.ts` or the library.

## 6. Validation

- Unit tests: 1745 in roomle-ui `packages/web-sdk/packages/homag-intelligence` pass (`npm run test -- run
  packages/homag-intelligence`), including the new description tests in `__tests__/hi-mcp/hi-mcp-server-test.ts`
  and `describe('create-or-replace-groups on a replace of an existing group')` in
  `__tests__/hi-tool-commands/create-or-replace-groups-replace-test.ts`; the served-schema fixture
  `hi-mcp-fixture-test.ts` passes with the rewritten fixture; `lint:code`, `lint:types` and prettier clean.
- Prompt-test evaluation with `mistral:mistral-large-4` (the model whose 4 of 52 runs of
  `mcp-test-2026-10-21_16-59-20` showed this issue), against the local roomle-ui dev server on
  `feat/hi-planning-assistant-lightweight` (`5bef43482`, `--dev`): session
  `.temp/result/mcp-test-eval-bug4-2026-11-01_18-27-17` — the 18 `group edit` tests plus `undo-last-change`
  and `undo-a-wrong-command` of `docs/test-prompts.json`, `randomTests` 0. Report:
  `.temp/result/mcp-test-eval-bug4-2026-11-01_18-27-17/report.md`, PDF
  `.temp/reports/mcp-test-eval-bug4-2026-11-01_mistral-mistral-large-4.pdf`.
  - 20 pass, 0 partial, 0 fail, 0 bugs; every run exit 0 with no errors.
  - **No run re-sent a group with `create-or-replace-groups` for an edit** — zero create calls in all 20
    `planner-calls.json`. Every edit used its own tool: add → `merge-article-into-group` (01, 04, 18),
    exchange/widen → `exchange-root-module` with the size attribute in its attributes (02, 08, 09 — the
    `edit-replace-unit-wider` run sent `mod_Width 900`, the exact case large-4 36 got wrong with Error 14019),
    material → `change-group-attribute` / `change-module-attribute` (03, 17), insert →
    `insert-article-into-group` (10, 11, 12), swap → `swap-root-modules` (15, 17), delete →
    `delete-article-in-place` for "leave the gap"/"delete the middle unit" (05, 16, 19, 20) and
    `delete-article-and-compact` only where the prompt says close the gap (06, 13, 14) — large-4 44/45/46's
    wrong default is gone —, `delete-group` (07), `merge-groups` after the in-place delete (16), `undo` (19, 20).
  - Spot-checked plans against the expects: 05 two groups of 600 mm with the 600 mm gap between; 09 row
    2100 mm wide; 16 and 20 one group after the merge/undo sequence; 19 one group restored by undo.
