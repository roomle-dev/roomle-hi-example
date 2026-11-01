# The payload format is guessed: relations and ids the server does not read

> **Type**: Bug Analysis  
> **Status**: Open — the fix is implemented and verified on the working branch, and the analysis stays open until it lands on the planner branch (`release/bo-test`) or `master`; the release verification is recorded here then, and ["cleanup analyses"](../skills/hi-analysis-cleanup.md) closes and deletes it  
> **Date**: 2026-11-01  
> **Backlog**: [Where Mistral Large falls short of the prompts](../backlog/mistral-large-prompt-issues.md), issue 1 ("The payload format is guessed: relations and ids the server does not read") — removed when the fix was implemented, per [the backlog rule](../backlog/README.md)  
> **Base**: roomle-hi-example `feat/analyse-guessed-payload-format` (from `master` `f1bd307`); roomle-ui `feat/hi-planning-assistant-lightweight` (`0cfceb693`)  
> **Fix**: roomle-ui `feat/hi-planning-assistant-lightweight` `31def74f2` — the `posGroups` input schema declares the group and root fields on open objects (`hi-mcp-server.ts`), `readPairRelations` maps the pair forms and `resolveIdRefs` the id variants (`hi-tool-payload.ts`); unit tests in `create-or-replace-groups-input-test.ts` plus the schema fixture; durable outcome in roomle-ui D136 and G50–G53 of `hi-tools-behaviour.md` and in `hi-tools-reference.md`. Verified with `mistral:mistral-large-latest` (16 tests) and `mistral:mistral-large-4` (6 tests) against the local dev planner — see §6

**Affected repositories**

- **roomle-ui** (on `feat/hi-planning-assistant-lightweight`): the input schema of `create-or-replace-groups`
  (`packages/web-sdk/packages/homag-intelligence/src/hi-mcp/hi-mcp-server.ts`), the payload
  normalisation (`hi-tool-payload.ts`), the relation compilation (`hi-group-layout.ts`), their unit
  tests (`__tests__/hi-tool-commands/create-or-replace-groups-input-test.ts`, the fixture
  `packages/web-sdk/packages/test-helpers/unit/hi-mcp-fixture.json`), and the references
  (`.agents/homag-intelligence/hi-tools-behaviour.md`, `hi-tools-reference.md`).
- **roomle-hi-example**: this analysis and the backlog item it comes from; the skill
  `.agents/skills/hi-mcp-tools.md` when the tool reference changes.
- **Unchanged:** the example pages and the embedding-lib (the page loads the tool set from the
  planner at its server URL, no forwarding change); the library's calculation — the fix explains
  and corrects the agent's input, never changes what the library calculates.

## 1. Symptom and reproduction

`mistral-large-latest` writes the relations of a `create-or-replace-groups` call in forms the
server does not read, and refers to roots by ids the server did not assign:

- `"relation": "rightOf"` without a neighbour field, or `relation` together with `relatesTo`,
  `relToRootId` or `neighbourId`;
- a `relations` list beside the `roots` of the group;
- the first root without an id while the others refer to it as `root_1` or `ROOT#1` — the server
  names the id-less root `root-1`.

The server drops the unread fields (the result's `corrections` says "the server does not use … -
ignored") and docks the roots in a row in their array order. Right when the order is the row's,
wrong otherwise: a START piece of an endless wardrobe listed second ends up second in the row.

**Reproduce.** Test session `mcp-test-2026-10-17_10-50-12` (`mistral-large-latest`), run 45
(`image-only-tall-units`); runs 01, 05, 08, 11, 12, 14, 18, 36, 40, 42, 45, 46, 47, 51, 52 show the
relations, the id-less roots in 16 runs — 18 of 56 runs in total. 16 of the 19 runs with a create
but without a `get-authoring-rules` call show the issue, 2 of the 16 runs that fetched the rules:
the input schema the model reads first carries none of the format. `mistral-large-4` does not show
it in its 52 runs (`mcp-test-2026-10-21_16-59-20`).

## 2. Investigation trace

1. The tool's input schema, roomle-ui
   `packages/web-sdk/packages/homag-intelligence/src/hi-mcp/hi-mcp-server.ts:527-533`:
   `posGroups: z.array(z.record(z.string(), z.unknown())).min(1)` — a record of unknown fields. The
   group fields (`id`, `libraryId`, `placement`, `attributes`, `roots`) and the root fields (`id`,
   `articleId`, `attributes`, `rightOf`, `leftOf`, `onTop`, `above`, `behind`) are declared only in
   the served text: the `AUTHORING_RULES` of `get-authoring-rules` (`hi-mcp-server.ts:18`, served
   at `:448-456`) and the prose of the tool description (`:489-526`). A model that reads the
   schema first — and skips `get-authoring-rules` — has to guess the field names.
2. The command normalises each group, roomle-ui `hi-tool-commands.ts:517-531`: `keepBuildable(…,
   prepareGroup(group, 'posGroups[i]', corrections))` (`:526`). `prepareGroup`
   (`hi-tool-payload.ts:839`) reads a relation only from the declared relation fields
   (`RELATION_FIELDS`, `hi-group-layout.ts:14` = `rightOf, leftOf, onTop, above, behind` plus
   `align, gapMm`, `hi-group-layout.ts:4-10`). `relation` with a neighbour key and a `relations`
   list are not among `ROOT_FIELDS`/`GROUP_FIELDS`, so `reportUnusedFields`
   (`hi-tool-payload.ts:752`, correction at `:784`) reports them as "the server does not use … -
   ignored" and drops them. An id-less root is assigned `root-1` by `nextFreeId(taken, 'root', 1)`
   (`hi-tool-payload.ts:947-951`), with a correction — but nothing maps `root_1`/`ROOT#1` to it.
3. `toArticlePick` (`hi-tool-payload.ts:9-24`) then strips the root to the article pick plus the
   `RELATION_FIELDS` it carries — by now the guessed relation is gone.
4. `relationsToDocking` (`hi-group-layout.ts:268`, called at `hi-tool-commands.ts:639`) builds
   `byId` from the roots' `id`s (`:284`) and looks the relation value up in it; `root_1` names no
   entry, so the link is dropped with "names no other root of the group - ignored" (`:346-351`).
5. Every root left without a link gets the fallback `defaultLink` (`hi-group-layout.ts:599-640`):
   not a wall unit → `rightOf` the previous floor-standing root of the list — "names no neighbour -
   it was put rightOf …" (`:654`). The roots are docked in a row in their array order.

## 3. Root cause

Two gaps, both in roomle-ui on `feat/hi-planning-assistant-lightweight`:

- **The input schema does not carry the payload format.** `hi-mcp-server.ts:528` declares
  `posGroups` as `z.record(z.string(), z.unknown())`, so the field names a model reads first are
  absent from the schema and live only in the `get-authoring-rules` text and the description prose.
- **The payload normalisation does not map the forms a model writes onto the declared fields.**
  `prepareGroup` (`hi-tool-payload.ts:839`) maps `dockTo` onto a relation
  (`readDockToAsRelation`, `:693-730`) but not `relation` + neighbour key or a `relations` list,
  and resolves no id variants: an id-less root becomes `root-1` (`:947`) while references to it as
  `root_1`/`ROOT#1` fail the `byId` lookup in `relationsToDocking` (`hi-group-layout.ts:284, 346`)
  and fall through to the order-based row docking (`hi-group-layout.ts:599-654`).

## 4. Why the current code produces wrong results

The server is built to correct input whose intent is clear and to report every correction, but the
correction layer only knows the declared field names. A guessed relation field is not an error —
the group is valid, the root articles are valid — so the call succeeds, the unread fields are
dropped with a note, and the fallback docks the roots in array order. The plan is then built
confidently in the wrong order (a START piece second), and the correction text ("the server does
not use relation, relatesTo - ignored") does not tell a weaker model which field to write instead,
so it guesses again on the next call. The schema being an open record makes the guessed payload
pass validation silently; that is the design that keeps corrections possible, and it is why the
format has to be declared in the schema itself rather than enforced as a guard.

## 5. Proposed clean fix

All in roomle-ui on `feat/hi-planning-assistant-lightweight`; corrections, never refusals — the intent of a
guessed relation is clear, so the server maps it and names the mapping in `corrections` (the rules
of AGENTS.md "Guards Are a Last Resort", steps 1–3).

1. **Declare the format in the input schema** (`hi-mcp-server.ts:527`): the group fields `id`,
   `libraryId`, `placement`, `attributes`, `roots` and the root fields `id`, `articleId`,
   `libraryId`, `attributes`, `contextData`, `rightOf`, `leftOf`, `onTop`, `above`, `behind`,
   `align`, `gapMm`, each with a one-line `.describe`, on objects that stay **open to further
   fields** (loose objects / passthrough). Open matters: the AI SDK adds `additionalProperties:
   false` to nested objects of the input schemas (roomle-ui D94, `.agents/homag-intelligence/
   hi-tools-behaviour.md`), so a closed object would reject the guessed fields at validation
   before the server can correct them — the opposite of the correction-first design.
2. **Map the pair forms onto the relations** in `prepareGroup` (`hi-tool-payload.ts`), beside
   `readDockToAsRelation`: a root's `relation` with one of the neighbour keys `relatesTo`,
   `relToRootId`, `neighbourId` (or `id`) becomes that relation field; a group-level `relations`
   list of `{ rootId/from, relation, to/neighbourId }` entries is distributed onto the roots.
   Every mapping is named in `corrections` ("root 'u2': relation/relatesTo was read as rightOf
   'u1'").
3. **Resolve the id variants**: when a relation names no root id but matches the n-th root in a
   normalised form (`root_1`, `ROOT#1`, `root 1`, `#1` → the n-th root), resolve it to that root's
   id — or give an id-less root the id the model's reference uses — and name the resolution in
   `corrections`. The existing assignment of `root-1` (`:947`) stays as the fallback.
4. **Tests**: `__tests__/hi-tool-commands/create-or-replace-groups-input-test.ts` — a root with
   `relation` + each neighbour key, a `relations` list, an id-less first root referenced as
   `root_1`/`ROOT#1`, each asserting the built docking and the correction text; the schema fixture
   `packages/web-sdk/packages/test-helpers/unit/hi-mcp-fixture.json` is updated in the same commit
   (D94), with `__tests__/hi-mcp/hi-mcp-fixture-test.ts` guarding the served schema.
5. **References**: roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md` (§8 corrections and
   the decision row in §3) and `hi-tools-reference.md`; here `.agents/skills/hi-mcp-tools.md`. The
   `AUTHORING_RULES` text stays the full format; the schema now carries its field names.

No change to `get-plan-context`, the planner methods, `glue-logic.ts` or the library.

## 6. Validation

- Unit tests of 4 pass; the fixture test guards the served schema.
- Executed with the models on 2026-11-01 against the local roomle-ui dev server
  (`feat/hi-planning-assistant-lightweight` `31def74f2`, `--dev`):
  - `mistral:mistral-large-latest`, 16 tests (the create-heavy tests named in issue 1:
    `image-only-tall-units`, `attic-room-tall-units-right-wall`,
    `obstacle-back-wall-beside-the-sofa`, `attic-room-storage-under-slope`,
    `four-cabinets-back-wall`, `wardrobe-door-hinges`,
    `wardrobe-back-wall-without-a-free-stretch`, `closets-two-wardrobes-corner`,
    `three-tall-units-right-wall`, `kitchen-back-right-corner`, `kitchen-oven-fridge-sink-corner`,
    `full-kitchen-walnut-marble-corner`, `kitchen-family-two-kids`, `media-unit-left-wall`,
    `image-only-no-text`, `edit-delete-group`), session
    `.temp/result/mcp-test-verify-payload-latest-2026-11-01_16-59-55`: every run wrote the
    declared relation fields — the schema now carries the format, so the model no longer guesses —
    no run dropped a relation field ("the server does not use …"), every group built in its row
    order with sound docking (checked `plan-context.json`, e.g. `15-image-only-tall-units`: the
    row docks 1→2→3 `RightBottom->LeftBottom`) and stood at the asked wall or corner (rotation 270
    right wall, 0 back wall, 90 left wall). 15 of 16 runs clean; `16-image-only-no-text` hit a
    Mistral rate limit on attempt 1 (environment) and passed on retry; the non-payload errors of
    05 and 13 are model-side and library-side (Error 14019), recovered in-turn.
  - `mistral:mistral-large-4`, 6 spot-check tests, session
    `.temp/result/mcp-test-verify-payload-large4-2026-11-01_17-00-54`: all clean, declared fields,
    correct placements — no regression.
  - The pair-form mapping and id resolution (fix 2 and 3) were not exercised by the models in
    these runs — with the schema declaring the fields, the models write them; the mapping is
    covered by the unit tests of 4.
