# Bug analysis — the backsplash of an image kitchen is reported as not buildable

> **Type**: Bug analysis
> **Status**: Fixed — closed as resolved at the user's direction on 2026-10-18; roomle-ui change pending landing
> **Date**: 2026-10-17
> **Verified and implemented**: 2026-10-18
> **Implementation branches**: `fix/generated-part-switch-discovery` in both repositories
> **Base**: roomle-hi-example plan commit `2f52c50`; roomle-ui
> `fix/wall-level-article-relations` (`e4989a862`)
> **roomle-ui implementation**: `cf377cfd4`, directly based on the required branch
> **Former backlog**: MCP issue 75, removed as resolved

## Affected repositories

- **roomle-hi-example** — implemented the approved `notCarried` recovery guidance and its
  description/discovery tests; updated the behaviour, tool documentation, implementation context
  and image-test expectations. The acceptance record below includes the generated-part diagnostic
  and recovery proposal recorded before closure.
- **roomle-ui** — implemented root-assigned Bool retention in `compactMasterData`, three
  regression cases and HI documentation on a branch based on `fix/wall-level-article-relations`.
  The predicate change is locally verified. No further planner correction is implemented.

## Closure

The user declared this issue resolved on 2026-10-18 and requested its removal from the backlog.
The MCP implementation is on `master` (`e9d996f`); the roomle-ui implementation remains on the
local `fix/generated-part-switch-discovery` branch (`cf377cfd4`). The earlier acceptance results
and follow-up proposal below are historical evidence, not remaining backlog work. No new image
acceptance run was performed for this closure.

## Original symptom and verified causes

The stored reproduction was
`.temp/result/mcp-test-2026-10-18_14-48-28/gpt-6-astra/51-image-only-no-text/`.
For `docs/images/kitchen-4.png`, the model sent group attributes
`mod_BacksplashColor=216` and `mod_BacksplashHeight=600` / 300, but no
`mod_CreateBacksplash`. All 14 modules carrying that switch had false in `order-data.json`;
no `mr_Backsplash` root existed, while two `mr_Countertop` roots did. The answer said the wood
backsplash and window ledge were not included. Runs 48 and 50 had the same omitted switch.

Two causes were verified against roomle-hi-example `b4865ca` and roomle-ui `e4989a862`:

1. `hi-mcp/hi-mcp-server/hi-mcp-server.ts:405–406` described `notCarried` as a part the library
   would not build and asked the agent to report the omission, without a recovery path. The test
   at `tests/hi-mcp-server.test.ts:503` pinned that sentence.
2. roomle-ui `packages/web-sdk/packages/homag-intelligence/src/hi-plan-context.ts:276–280`
   retained root-assigned attributes only when main or Simple.
   `mod_CreateBacksplash` was Advanced, Bool and not main. Its useful description was removed
   before either the default vocabulary or `find-attributes` could return it. Its material
   attributes were Simple and assigned to the generated root, so they remained discoverable.

The catalog's `mainAttributes` was no escape: it retained main attributes only. The worktop's
switch was Simple and served; the older utility-room run 07 enabled it and built one generated
worktop root. There were three units with the switch, not three generated roots.

The stored master data had 61 served attributes and 210 excluded root-assigned attributes: 12
Bools and 198 non-Bools. The approved extension yields 73 attributes, about 20% more. Serving all
271 assigned attributes would be about 4.4 times the original count, not twenty-fold.

## Approved implementation

The approved plan was implemented without a new guard, retry loop, automatic generation,
dependency, planner method or library calculation change.

- In roomle-ui, `compactMasterData` now requires root assignment and
  `isCustomerFacingAttribute(attribute) || attribute.type === MDType.Bool`. The exported
  customer-facing predicate keeps its original meaning. Module assignments retain the Bool ids;
  the attribute whitelist, group settings and catalog main-attribute semantics stay the same.
- The `create-or-replace-groups` description replaces its final-omission clause with:

  > notCarried: attributes no current module carries. For a requested part the library generates,
  > use find-attributes to look for an enabling attribute on the units; if available, enable it,
  > then set the part's attributes after it is generated. Report only what is still missing.

- The server's existing vocabulary/search consumers pass the added Bools through. The new
  cross-tool test checks a Bool without selections and identifies its carrying unit separately
  from the generated part's material owner.
- D48, D65, D76 and the information/tool sections of
  [the behaviour reference](../../docs/hi-mcp-behaviour.md), the tool READMEs, domain skills and
  [implementation context](../context/tool-executors.md) describe the effective contract.
  The existing three image tests have backsplash expectations; their user prompts and images
  are unchanged.

The UI branch was created directly from `fix/wall-level-article-relations`; its ancestry was
checked before changes and after the implementation commit. No work was based on the superseded
`fix/room-corners-at-openings` branch.

## Unit tests and static checks

The regression-first checks produced the expected failures before implementation:

- MCP: the replacement description test failed; the new consumer discovery test already passed.
- roomle-ui: the Advanced and Master Bool retention cases failed under the original predicate.
  The assignment-boundary case already passed.

The final tests cover both rights levels, article and generated-root carrier assignments,
metadata and optional selections, exclusion of unassigned/submodule-only Bools and internal
non-Bools, and the library-neutral recovery description. Existing tests continue to cover
skipped attributes, `notCarried`, generated-root materials and main-only catalog attributes.

| Check | Result |
|---|---|
| `npm test` in `hi-mcp/` | 296 passed, 15 files |
| `npm run test -- --run homag-intelligence` in roomle-ui `packages/web-sdk/` | 1,064 passed, 18 files |
| Final `hi-plan-context-test` after strengthening the non-Bool boundary for both rights levels | 103 passed |
| MCP `npm run typecheck` | passed |
| roomle-ui `npm run lint:types:sdk` | passed |
| MCP `npm run lint` and `npm run format:check` | passed |
| roomle-ui `npm run lint:code:sdk` and pre-commit code lint | zero errors; one unrelated unused-helper warning |
| Formatting, whitespace and changed-document links | checked |

The warning names `isCeilingShown` in roomle-ui
`packages/web-sdk/packages/planner-core/__tests__/plan-view-model.ts:46`; that file is unchanged.
UI checks used the installed Node 24.12.0 runtime. The full MCP integration suite needed local-port
access beyond the sandbox; rerunning with that access passed.

## Real-library acceptance

Artifacts and the evaluated report are in
`.temp/result/backsplash-generation-2026-10-18/`. The planner was the changed local roomle-ui
on port 5173; the chat used the changed MCP server and `gpt-6-astra`.

### Deterministic checks

Both input paths passed for each of these simple base-unit groups:

| Article | Requested colour / height | Switch on root at creation | Switch in group, then material call |
|---|---|---|---|
| `UTB60` | 216 / 500 | generated root and both values present | generated root and both values present |
| `EUTB60` | 240 / 635 | generated root and both values present | generated root and both values present |

Group-level enabling reported the material attributes in `notCarried`; the separate
`change-group-attribute` applied them after generation. With root-level enabling, the simple
create applied group materials in the same call. The live context exposed the switch and its
description. Evidence: `library/` and `library-eutb/` in the session.

### Image prompts — targeted backsplash acceptance

| Test | Outcome | Evidence |
|---|---|---|
| `image-kitchen-left-wall` | pass | Switches enabled on the relevant units; a material follow-up produced colour 326, height 635. Order data, rendering and answer agree. Snapshot `ps_s7olkpl5ki1ne21g8n7ryhcznehqj1l` |
| `image-planning-right-wall` | partial | The switch is enabled and materials 240 / 635 are sent, but the generated root remains in `notLoaded` with Error 14034. The agent reports it could not be generated. A deterministic replay builds it after a material follow-up. Snapshot `ps_s7p454f09wg5uhqouyu3s92vc868d1j` |
| `image-only-no-text` | pass | Two initial generated-root diagnostics were recovered by material follow-ups. Both backsplash roots exist: colour 216, heights 600 and 250. Order data, rendering and answer agree. Snapshot `ps_s7p81v6bynfa2bef6syfnnjy8nxhku4` |

All three runs completed without transport errors. These verdicts assess the backsplash recovery,
not general image fidelity or unrelated edit/resize behaviour. They are **not** three full
planning-quality passes. The report and PDF retain the screenshots and detailed evaluations.

## Reopened finding — a calculated-part diagnostic also needs recovery

The second image case changed the diagnosis: it did not omit the switch. In its final create it
sent the requested colour and height in group attributes, and the result's `groupAttributes.set`
even named both. Nevertheless, `notLoaded` still reported the generated root with:

> Error 14034: Could not find entry in tab_GrainDirectionSettings for input values:
> part_Backsplash - undefined - undefined - undefined - 600 - 635.

The current generic advice in roomle-ui `hi-tool-commands.ts:680–682` asks the agent to check
group/root attributes and change failing values or replace the article. The new description
discusses generated-part recovery under `notCarried`. Neither explicitly explains this case:
a generated part can still need a separate material call even after the create reports its
requested attributes set.

**Exact replay:** the final `create-or-replace-groups` payload of
`02-image-planning-right-wall/run.json` reproduced the diagnostic on a fresh instance. A separate
`change-group-attribute` with the **same** `mod_BacksplashColor=240` and
`mod_BacksplashHeight=635` built the missing part; `library-replay/order.json` contains the
generated root with those exact values. The article and colour also passed in the simpler checks.

This disproves a general claim that the library cannot build this backsplash or colour. The
remaining instruction/feedback gap is the recovery from `notLoaded`, not missing Bool visibility.
The evidence does not yet identify why the combined attribute calculation leaves the generated
part incomplete; no library calculation change is proposed.

### Follow-up proposal recorded before closure

1. Extend the existing library-neutral generated-part recovery guidance to a requested generated
   part in `notLoaded`, not only attributes in `notCarried`: when generation is enabled and
   the part's requested attributes are known, apply those attributes in a separate settled call
   before declaring the part unbuildable. Keep explicit diagnostics visible.
2. Add a served-description regression that covers the calculated-part case and preserves the
   conditional user intent; rerun the exact replay and the right-wall image prompt. If the
   recovery belongs in the tool's diagnostic message, test it in roomle-ui
   `hi-tool-commands/create-or-replace-groups-placement-test.ts` as well.
3. Investigate the combined-attribute calculation separately before proposing an automatic
   correction. Reapplying values blindly as a retry would hide the cause and is not implemented.

The original plan required reopening the analysis on a generation/material acceptance failure
before adding further code. That gate is respected: the approved code is implemented and tested,
the new reproduction and follow-up plan were recorded before the user closed MCP issue 75.
The MCP changes are merged; the roomle-ui change remains on its local branch.

## Alternatives considered

- Text alone could not reveal the filtered-out switch; library-only Simple metadata would fix
  discovery for one library and still require the instruction change.
- Serving all assigned attributes would add 198 unrelated non-facing non-Bools beyond the 12
  Bools required by the data-type selection.
- Guessing a generated part's switch from library-specific ids or attribute-group names would
  embed library content in tool logic. Bool type alone does not imply generation or user intent.
- A new guard would reject legitimate material requests and would not supply the missing
  recovery. The approved implementation retained the existing `notCarried` reporting.
