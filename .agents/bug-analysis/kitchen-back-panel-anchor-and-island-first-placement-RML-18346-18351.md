# Back-panel anchor and island first placement still wrong after the 2026-10-31 fixes (RML-18346, RML-18351)

> **Type:** Bug analysis
>
> **Status:** Open — superseded by [island-back-panel-docking-and-placement-anchor-RML-18346-18351.md](island-back-panel-docking-and-placement-anchor-RML-18346-18351.md): its instruction-level fixes were implemented and reverted; model-free probes show the root cause in the docking derivation and the placement anchor, not the instructions
>
> **Date:** 2026-11-01
>
> **Tickets:** [RML-18346](https://roomle.atlassian.net/browse/RML-18346) (kitchen image 16, comment 156767), [RML-18351](https://roomle.atlassian.net/browse/RML-18351) (kitchen image 5, comment 156766)
>
> **Base:** roomle-hi-example `master` `f1bd307`; roomle-ui `feat/hi-planning-assistant` `9b8181406` (the head `release/bo-test` the ligna-store test stage and the example page load)

## Affected repositories

- **roomle-ui** — the remaining gaps are served text and catalog/feedback logic in the HI tools: the image-planning skill (`hi-mcp/skills/image-planning/SKILL.md`), the served rules of `hi-mcp/hi-mcp-server.ts`, `compactArticle` in `hi-plan-context.ts`, `checkRootOverrides` in `hi-tool-attributes.ts` / `hi-attribute-check.ts`, with unit tests, the served-text fixture and the rows of `.agents/homag-intelligence/hi-tools-behaviour.md`. The tools run in the planner: bo-test deployment, no embedding-lib build.
- **roomle-hi-example** — this analysis, the test prompts in `docs/test-prompts.json`, and the comment of the analysis on both tickets.
- **HOMAG library** — unchanged: the `RWV` / `mod_IslandBackwallWidth` / `mr_IslandBackwall` descriptions are applied (backlog library issue 23, Done). No new library change is proposed; the library's calculation is not touched.

Related earlier analysis: [kitchen-5-island-orientation-and-back-panel.md](kitchen-5-island-orientation-and-back-panel.md) (RML-18351, Open), whose tool-side fixes have landed (see below).

## Symptom

Both tickets were re-run on 2026-10-31 with the fixes of `feat/hi-mcp-performance` / `fix/hi-island-placement` in place (bo-test head), and both latest comments say "It's not fixed yet. There are still a lot of wrong attempts until the final result is decided."

- **RML-18346, kitchen image 16** — attempt 1 `ps_tev8txpav3xpk8ean5fg7mnzv0s5xse`, final `ps_tevl1rdg5nvbmel126ta3mwrxv9440q`. "The back cover panel of the kitchen island is still causing problems"; one intermediate attempt (no stored data) had "the cover panel protruded the kitchen island".
- **RML-18351, kitchen image 5** — attempt 1 `ps_tevc8l1fd4kpjvwn9uapk7iqq4ixqjh`, attempt 2 `ps_tev11tay04xc7ks2ch93kf5ezii5quvt`, final `ps_teu5dw6irh9fmj3w2a8k0tsd4xmnf5h`. "It's not just the cover panel that's wrong; the position of the kitchen island is completely off at the start."

## What already landed and works (verified in the base commit)

- Replacement retains the placed transform: `hi-tools.ts` copies `previousGroup.pos/rotationY/contours` into the resubmitted group and computes `previousPlacement` via `positionInPlacementFrame` when no repositioning is requested (~lines 819–851). The RML-18351 pose-feedback defect is closed in code.
- `place-group` accepts a point form (`posGroup` + `posRotationZ`, same placement-frame corner and angle as a new group) — `hi-mcp-server.ts` place-group schema (~line 538ff). A freestanding island can now be moved/rotated without delete/recreate.
- The image-planning skill carries the island axis/working-side guidance and the rotation mapping (`SKILL.md` section 2, line 25), the wall-units-fit-the-leg rule (section 3), the returned-position check (section 4) and the back-panel-with-height-profile rule (section 5, line 45).
- Back-to-back docking without a mode defaults to `StartEnd` in `hi-tool-docking.ts:231-239`, as `behind` places a unit without a row of its own (D98).
- The library descriptions of `RWV` (1.8), `mod_IslandBackwallWidth` (2.13) and `mr_IslandBackwall` (3.1) in `docs/library-information/suggested-library-changes.md` are applied — the desc now names the peninsula and the length attribute.

## Investigation trace and root causes

### 1. The back panel's anchor root is still unspecified — the protruding panel (both tickets)

The skill says to finish the back "`behind` its cabinet row and as long as that row" (`image-planning/SKILL.md:45`), and the served `behind` rule says "the panel that closes the back of such a row" (`hi-mcp-server.ts:31`). Neither names **which root of the row** the panel is `behind`.

The docking decides the rest: back-to-back without a mode gets `StartEnd` (`hi-tool-docking.ts:231-239`), so the panel *starts at the end of the named neighbour and runs from there along the row*. Named behind a middle unit — the hob unit in four of the six 2026-10-30 runs, and again in the latest RML-18346 attempt — the panel runs from that unit's end toward the far end of the row and sticks out past it: the "cover panel protruded the kitchen island" of the unstored attempt. This was already reproduced model-free on 2026-10-31 (RML-18346 verification comment): behind the hob unit the panel covers x 61–1091 of a peninsula back running x -424–1200; behind the end unit at rowIndex 1 it closes the whole back (x -439–1391) in one create. The one-sentence fix proposed there — the panel goes behind the root module at the **left end of the row as seen from its front (rowIndex 1)** and runs from there along the row, as long as the row — is **not in the served text**: no skill contains "rowIndex 1" / "left end of that row" next to the panel rule.

Root cause (file:line): `image-planning/SKILL.md:45` and `hi-mcp-server.ts:31` — instruction gap, not a tool defect.

### 2. The catalog still names `mod_Width` as the panel's size, and the override still passes silently (RML-18346)

`compactArticle` takes every `Dim` attribute of the calculated article template without asking whether the root's module carries it in the master data (`hi-plan-context.ts:663-665`). `RWV`'s template carries the *calculated* `mod_Width` 1000; its module `mr_IslandBackwall` does not take `mod_Width` — its length is `mod_IslandBackwallWidth`. Of the library's articles, `RWV` is the only one whose served dimensions name an attribute its module does not take. The served rule (`hi-mcp-server.ts:21`) says "dimensions give its size … change-module-attribute with that attribute id … changes the size of a root module", so the catalog still invites sizing the panel with `mod_Width`. The filter proposed as step 6 of the RML-18346 plan (keep only the dimensions the module carries by `assignedAttributes`) was an open decision "only with a go" and did **not** land.

Worse, the wrong override is accepted without a word: `checkRootOverrides` (`hi-tool-attributes.ts:480-…`) asks only the library's verdict, and a module has no drop-down options for an attribute it does not carry, so "without options every value is taken" (`hi-attribute-check.ts:61-62`). The load sets `mod_Width` on the root as a last resort, the library drops it, and the result carries no correction — the agent learns it from the images or a `get-plan-context` and resends the whole group, which is where the time of RML-18346 goes. The applied desc (issue 23) mitigates by naming `mod_IslandBackwallWidth`, but the contradicting dimension entry and the silent acceptance remain.

Root cause (file:line): `hi-plan-context.ts:663-665` (catalog), `hi-tool-attributes.ts:480` + `hi-attribute-check.ts:61-62` (silent override) — tool/catalog gap, not a library calculation issue.

### 3. The island's first placement is still computed wrong from the image (RML-18351)

The tool side is clean: explicit new-group angles 0/90/180/270 are preserved, replacement keeps the pose, and point-form `place-group` exists for corrections — established model-free on 2026-10-31 and not re-reproduced as a tool defect here. What remains is the instruction: `SKILL.md:25` maps front directions to plan-space rotations and says to choose the angle from the aisle direction, but it never states that `posGroup` for a freestanding group is the **back-left-bottom corner of the placed group as a whole** — the placement frame includes the rear panel (`hi-mcp-server.ts:36` says "back left bottom corner", but nothing tells the agent that for an island with a back panel this corner is the panel's corner, not the cabinet front's). An agent that computes the point from the front-left cabinet corner places the island offset by its depth (with panel, depth + 250 mm) and/or facing the wrong way — "the position of the kitchen island completely off at the start" of `ps_tevc8l1…`. The section 4 check asks to verify the returned position only *after* mapping; nothing pins the anchor at the first create.

Root cause (file:line): `image-planning/SKILL.md:25` and `:45` with `hi-mcp-server.ts:36` — the rotation mapping is there, the anchor semantics for a freestanding group with a rear panel are not.

## Why the current code produces the wrong results

Not a calculation problem: the docking (`StartEnd`), the placement frame and the catalog projection each behave as designed; the served instructions leave the two decisions the agent keeps getting wrong — which root anchors the back panel, and which corner of the placed group `posGroup` names — to inference from examples the text never gives. The silent acceptance of `mod_Width` on the panel then hides the resulting mistakes until an image or a context read reveals them, costing a full group resend per wrong attempt.

## Proposed clean fix

All in roomle-ui, library-neutral, no guard (per "Guards are a last resort" — each item clarifies instructions, simplifies the API, or corrects the input and says so):

1. **Name the panel's anchor.** One sentence in `image-planning/SKILL.md` section 5 and in the `behind` line of `hi-mcp-server.ts:31`: the panel that closes the back of a free-standing row goes `behind` the root module at the **left end of that row as seen from its front (rowIndex 1)** and runs from there along the row, as long as the row — the widths of the row's base units added up. Served-text fixture and `skills-test.ts` follow.
2. **The catalog names the dimensions the module takes.** In `compactArticle` (`hi-plan-context.ts:663`), a `Dim` attribute of the template that the root's module does not carry in `masterData.modules[].assignedAttributes` is replaced by the module's `Dim` attribute of the same name with the template's value, or left out when the module has none — `RWV` then serves `mod_IslandBackwallWidth` as its Width. `rootWidth`/wall-unit placement keep reading `mod_Width` for every article whose module takes it. Tests in `hi-plan-context-test.ts`; rule row in `hi-tools-behaviour.md` §5.4 and a decision row in §3 (this closes the open decision of the RML-18346 plan).
3. **A root override no module of the root carries is left out and named.** In `checkRootOverrides` (`hi-tool-attributes.ts:480`), before the library verdict: drop overrides whose id is in no `assignedAttributes` of the root's modules and add a correction — "root 'backPanel': a 'RWV' has no attribute `mod_Width` — the root was built without it; the dimensions it takes: …" — following the existing correction style (correction, not rejection: the rest of the group is built). Tests in `create-or-replace-groups-input-test.ts`; correction in `hi-tools-behaviour.md` §8.
4. **Pin the freestanding anchor.** In `image-planning/SKILL.md` sections 2/4 and the placement rule (`hi-mcp-server.ts:36`): for an island or peninsula, `posGroup` is the back-left-bottom corner of the **whole placed group including its rear panel**; give one worked example — aisle direction → `posRotationZ` via the rotation mapping, then the point from the group's back-left corner, not the cabinet front's — and check the returned `pos`/`rotationZ` against the intended axis before the next step (section 4 already asks for the check; move the anchor statement to the first create).
5. **Test prompts.** Extend `image-kitchen-16-peninsula` in `docs/test-prompts.json`: the peninsula's back panel is flush with both ends of the row and docked behind the row's end root in the first create. Extend `image-kitchen-5-island`: the first create's `posGroup`/`posRotationZ` are consistent with the intended axis and working side, verified against the returned pose.

## Verification

- roomle-ui: new and existing tests of homag-intelligence (`skills-test.ts`, `hi-mcp-fixture-test.ts`, `hi-plan-context-test.ts`, `create-or-replace-groups-input-test.ts`, placement tests), typecheck, lint, format of the package.
- Model-free replay on a dev server: the latest attempt-1 payloads of both tickets through `callExternalObjectAgentTool` — with fix 1 the panel closes the row flush at both ends in one create; with fixes 2–3 `get-plan-context` serves `mod_IslandBackwallWidth` for `RWV` and the create's corrections name `mod_Width` as not taken; with fix 4 an explicit island point at the panel's back-left corner lands as requested. (The unstored RML-18346 protrusion attempt has no payload; the 2026-10-31 replay evidence stands.)
- Model check when asked for: gpt-6-astra, kitchen images 5 and 16 on the default room, three runs each, compared against the plan IDs of the 2026-10-31 comments — no protruding or short panel, no off-position island in the first create, chat time not worse than the runs of 2026-10-31. A run that is not better is a failure, not a result.
- roomle-hi-example: `npm test` in `.agents/scripts` validates the changed prompts, `npm run format:check`, the markdown link check.
