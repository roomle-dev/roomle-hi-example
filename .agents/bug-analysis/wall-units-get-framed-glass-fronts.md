# Bug Analysis: the wall units get framed glass fronts

> **Type**: Bug Analysis
> **Domain**: hi-mcp — the attribute vocabulary the server serves (`AUTHORING_RULES` and the
> descriptions of `get-plan-context`, `find-attributes`, `change-module-attribute` and
> `change-group-attribute`, `hi-mcp-server.ts`), the group materials set after the load (D36,
> `applyGroupWideAttributes`, `tool-executors.ts`) and the results of the attribute commands
> **Trigger**: [RML-18094](https://roomle.atlassian.net/browse/RML-18094)
> **Date**: 2026-10-08
> **Author**: AI Assistant
> **Status**: Open — [implemented](#implementation) with (a) of the [open decision](#open-decision)
> (D60) and verified with unit tests and without a model against the planner; not merged

## Affected repositories

- **roomle-hi-example**: the fix. The served text says what a front program is and that a front
  colour can switch it. The results name a program the library switched. Plus
  `docs/hi-mcp-behaviour.md` and unit tests.

Not changed:

- **roomle-ui**: the planner and the library calculation behave as the library defines them. The
  plan context passes the master data through as it is (D48).
- **ligna-store**: its chat sends the same default image text and uses the same MCP server, so it
  gets the fix with the next deploy.

## Symptom

gpt-6-astra got only the image of a kitchen in the ligna-store chat (`DEFAULT_IMAGE_PROMPT`). The
wall units in the image have slab doors. The generated plan (`ps_r9269o5n4tcsrqd1stq2citkwlm8qn6`)
has them as **mitred frames with glass filling**.

Scope: the framed fronts of the wall units.

## Reproduction

**The generated plan** (loaded without a model, `replay/read-plan.mjs`): the three wall units
(O2TB90, OTB60, O2TB90) carry `mod_FrontProgram` **Modern** — "Mitred frame fronts with glass
filling" — with `mod_FrontColor` 324 (Dark marble). All other units carry Classic, "Simple fronts
in plain decors".

**The chat, 3 of 3 runs** — gpt-6-astra, the ticket's image without text, the store's "From scratch"
plan `ps_8jjg0zezlblb48vzn8qas9vwwn7fqbg`, `run-hi-mcp-prompt.js` (runs in
`.temp/result/issue-rml-18094-wrong-front-design/gpt-6-astra-{1,2,3}`). Every run ends with the
wall units on Modern and glass frames in the image. **No run sends Modern.** All three send:

1. `create-or-replace-groups` with the group attribute `mod_FrontProgram` Classic and
   `mod_FrontColor` 324 on the three wall units.
2. `change-module-attribute mod_FrontColor 324` on each of the three wall units.
3. The answer: "dark marble-look upper fronts". The frames are not mentioned.

**Without a model** (`replay/replay-sequence.mjs`, data in `replay2.json`):

| Step | Wall unit `mod_FrontProgram` | Wall unit `mod_FrontColor` | What the result says |
|---|---|---|---|
| create: group `mod_FrontProgram` Classic, wall units `mod_FrontColor` 324 | Classic | 152 — the library reset 324 | "mod_FrontProgram "Classic" was set on every unit of group …" |
| `change-module-attribute mod_FrontColor 324` on one wall unit | **Modern** | 324 | the changed group and `changedModuleIds` — no word on the program |

**Why 324 means a frame** (`replay/probe-palette.mjs`, data in `palette-probe.json`): each program
set on a wall unit, then each front colour. Dark marble 324 — like the other stone decors 316, 326
and 380 — is offered only by Modern. Setting it under Classic, Nature, Tradition or Tuscan switches
the program to Modern; setting Classic resets it.

## Investigation

1. **The library ties the colour to the program, only in its calculation.** The master data has no
   field that says which program offers which colour; the coupling shows when the planner
   recalculates after an attribute change.
2. **The served text presents the two attributes as independent.** `mod_FrontProgram` lists five
   values, "Mitred frame fronts with glass filling" among them; `mod_FrontColor` lists "Dark marble
   (#404040)". Nothing says that a colour can switch the program, and the served text calls both
   lists "allowed values":
   - [`hi-mcp-server.ts:8`](../../hi-mcp/hi-mcp-server/hi-mcp-server.ts#L8): "attributes is an
     optional list of { id, value } overrides of that root module … Attribute ids and allowed values
     come from the masterData section";
   - `get-plan-context` ([`hi-mcp-server.ts:172-173`](../../hi-mcp/hi-mcp-server/hi-mcp-server.ts#L172-L173)):
     "the customer-facing attributes with their allowed values";
   - `find-attributes` ([`hi-mcp-server.ts:197-200`](../../hi-mcp/hi-mcp-server/hi-mcp-server.ts#L197-L200)):
     "returns the matching attributes with their allowed values … Use it to find the attribute for
     a requested property, e.g. the front colour, and the value to set";
   - `change-module-attribute` ([`hi-mcp-server.ts:352-356`](../../hi-mcp/hi-mcp-server/hi-mcp-server.ts#L352-L356)):
     "Sets one attribute … attribute ids and allowed values come from the masterData section".

   No sentence says that the front program decides how the front is built. The agent's payload is
   the faithful reading: a slab program for the group (Classic), the image's colour on the wall
   units.
3. **The server's group program resets the wall units' colour.** D36 sets every group attribute on
   every unit after the load with `change-group-attribute`
   ([`tool-executors.ts:1972-2013`](../../hi-mcp/hi-mcp-server/tool-executors.ts#L1972-L2013)).
   Classic does not offer 324, so the library resets it on the wall units. The correction says only
   "was set on every unit" (`tool-executors.ts:2005`).
4. **Setting the colour again switches the wall units to the frame.** The agent sees the reset
   colour and sends 324 again with `change-module-attribute`. The library switches the program to
   Modern. The result is the planner's: the changed group, whose input attributes now list Modern,
   and `changedModuleIds` ([`tool-executors.ts:3892-3920`](../../hi-mcp/hi-mcp-server/tool-executors.ts#L3892-L3920)).
   No correction names the switch, so the agent reports slab-like "marble-look fronts".
5. **A frame program the agent chooses itself is chosen by its desc.** In "test the mcp"
   (`mcp-test-2026-10-07_11-58-22`, test 33) gpt-6-astra chose Tradition for "country-house style"
   and said "traditional framed oak fronts". Here it never chose a frame. The switch came from
   setting a colour.

## Root cause

**The served text** does not say that the front program decides how the fronts are built, or that
setting a front colour the program does not offer switches the program. It calls the lists
"allowed values" (`hi-mcp-server.ts:8`, `172-173`, `197-200`, `352-356`). So the agent cannot know
that setting dark marble turns slab fronts into glass frames.

**The results** do not name a program the library switched, neither after `change-module-attribute`
(`tool-executors.ts:3892-3920`) nor after the group materials of D36 (`tool-executors.ts:1995-2006`).
The switch to the glass frame happened silently, against D51: "What happens has to be clearly
specified at all times — in the tool description before the call and in the result after it."

## Proposed fix

In the order of [Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort):

1. **Clarify the served text** (`AUTHORING_RULES`, the descriptions of `get-plan-context`,
   `find-attributes`, `change-module-attribute`, `change-group-attribute`):
   - The front program says how the fronts are built — its desc: slab, frame with wooden filling,
     mitred frame with glass, milled. Choose it by its desc first.
   - A front program offers only some front colours. Setting a colour the program does not offer
     switches the program to one that does — the fronts are then built as that program says — and
     the result names the switch.
   - Drop "allowed values" where it suggests that every value combines with every other.
2. **Name a program the library switched.** After `change-module-attribute`,
   `change-group-attribute` and the D36 group materials, the server compares each root module's
   input attributes before and after. A changed attribute the call did not set goes into
   `corrections`, with the value descs from the master data, for example: "root module 'upperleft'
   (O2TB90): mod_FrontProgram changed from Classic (Simple fronts in plain decors) to Modern (Mitred
   frame fronts with glass filling) - Classic does not offer mod_FrontColor 324 (Dark marble)". The
   comparison needs no table of the library's palette.
3. **No correction of the input.** The server cannot tell whether the user prefers the slab front
   or the colour, and the library offers no slab front in dark marble. Which one the agent keeps is
   the [open decision](#open-decision).

Rejected: **sending Classic and 324 together in one load** (the group materials before the load
instead of after it). The planner renders that as slab doors in dark marble, but the library's own
rules never produce the combination. The next attribute change of that root module switches it to
Modern anyway.

**Tests** (roomle-hi-example):

- `tests/tool-executors.test.ts`: a fake planner whose `change-module-attribute` also switches
  `mod_FrontProgram` → the corrections name the switch with both value descs; a D36 group program
  that changes a root's attributes → the corrections name it; an attribute command that changes
  nothing else → no extra correction.
- `tests/hi-mcp-server.test.ts`: the rules and the four descriptions carry the program sentences.

**Verification**: `replay/replay-sequence.mjs` without a model — the result of the
`change-module-attribute` names the switch to Modern. No chat run unless asked.

## Open decision

When the image's front colour is offered only by a program that builds the fronts differently —
here dark marble, only with glass frames:

- **(a) Keep the fronts of the image** — a slab program and the closest colour it offers — and say
  that dark marble comes only with glass frames. *Recommended:* the defect of the ticket is the
  frames.
- **(b) Keep the colour**, accept the frames, and say so.
- **(c) Ask the user** before choosing.

## Plan

Only roomle-hi-example changes. The plan takes (a) of the open decision; (b) or (c) change only
the last sentence of the new "Fronts" rule (step 1).

### 1. The served text — `hi-mcp-server.ts`

- **`AUTHORING_RULES`, a new rule after the desc rule (line 9):** "Fronts: the front program says
  how a front is built - its desc: a simple front, a frame with wooden filling, a mitred frame with
  glass filling, a milled front. Choose it by its desc first, then the front colour. A program
  offers only some colours: a colour it does not offer switches the program to one that does, and
  the fronts are then built as that program says; a program resets a colour it does not offer.
  corrections name every such change. When the colour the user wants comes only with fronts built
  differently, keep the fronts: undo, take the closest colour the program offers, and tell the user
  which fronts that colour comes with."
- **Line 8:** "Attribute ids and allowed values come from the masterData section" becomes
  "Attribute ids and their values come from …".
- **Line 30**, the corrections rule, gets: "… and what the library changed beyond the attribute you
  set - a front program switched by a front colour".
- **`get-plan-context`** (line 172-173): "the customer-facing attributes with their allowed values"
  becomes "with their values".
- **`find-attributes`** (line 197-200): "with their allowed values" becomes "with their values".
- **`change-module-attribute`** (line 352-356) and **`change-group-attribute`** (line 378-380):
  "allowed values" becomes "values", and both get: "The library may change a related attribute with
  it - a front colour the front program does not offer switches the program, and the fronts are
  built differently; corrections name every attribute the library changed besides the one set."

### 2. Name the library's changes — `tool-executors.ts`

**A new helper**, `libraryChanges(before, after, applied, masterData, prefix)`. It compares the root
modules' input attributes of the groups before and after one or more attribute commands. Roots are
matched by group id and root id. It returns one sentence per change, roots with the same change
together:

- An attribute that was not set by the command is reported when its value differs, also when it
  had no input value before.
- An attribute the command did set is reported on a root that ends with another value.

The value descs come from the master data of the group's library (`masterDataOf`), a value without
a desc stands alone:

```text
change-module-attribute: with mod_FrontColor "324" (Dark marble (#404040)) the library changed
mod_FrontProgram of root module 'w1' (OTB60) from "Classic" (Simple fronts in plain decors) to
"Modern" (Mitred frame fronts with glass filling)
```

```text
posGroups[0]: with mod_FrontProgram "Classic" (Simple fronts in plain decors) the library changed
mod_FrontColor of root modules 'w1' (OTB60), 'w2' (OTB60) from "324" (Dark marble (#404040)) to
"152" (Cloudy blue (#506080))
```

**The three places**, none with an extra planner call:

- **`change-module-attribute`** (`tool-executors.ts:3892-3920`): before = the groups it already
  reads to resolve the root id, after = the planner result's `groups`. The sentences follow the
  server's and the planner's corrections (C20).
- **`change-group-attribute`** (`tool-executors.ts:3922-3938`): before = the groups it reads for
  `findGroup`, after = the result's `groups`. The result carries the sentences as `corrections`.
- **`applyGroupWideAttributes`** (D36, `tool-executors.ts:1972-2013`): before = the loaded group
  `result`, after = the group the last `change-group-attribute` returns. One comparison per group
  covers all its group attributes, so a colour the group itself sets after its program is not
  reported as reset.

A command with `moduleId` changes a sub module's attributes, which the root inputs do not show.
It gets no sentence, as before.

### 3. Documentation

- `docs/hi-mcp-behaviour.md`:
  - **D59** "The library's own changes are named" (§3, Flexibility, D51);
  - **D60** "Keep the fronts, not the colour" — the user's open decision, recorded once decided;
  - §5.2: the Fronts rule;
  - §5.3 and §8.1: corrections also carry the library's changes;
  - §6, the command tools' result;
  - §8.3 G46: its feedback gains the library sentence;
  - §8.5: a new row **C22**.
- `docs/hi-mcp-server.md` (lines 541-542) and `.agents/skills/hi-mcp-tools.md` (lines 26-27, 228):
  the attribute commands name the library's changes in `corrections`.
- This analysis: the status and the outcome after the implementation.

### 4. Unit tests

`hi-mcp/hi-mcp-server/tests/tool-executors.test.ts`, a new `describe('library changes')` in the group
command tools. It has a master data with `mod_FrontProgram` and `mod_FrontColor` and their descs
(not added to the shared `masterDataFixture`, which other tests count), and a fake
`externalObjectGroupOperation` that returns the group after the change:

- `it('names the front program the library switched with a front colour')` — before: w1 Classic;
  `change-module-attribute mod_FrontColor 324`; after: w1 324 + Modern. Corrections equal the first
  sentence above.
- `it('names a value the library set on a root module without one')` — w1 had no program input;
  after: Modern. The sentence reads "changed mod_FrontProgram … to "Modern" (…)", without "from".
- `it('names the root modules the library changed alike in one sentence')` —
  `change-group-attribute` on three wall units.
- `it('names the library changes after the corrections of the planner')` — the planner's correction
  first, then the library's.
- `it('adds nothing when the library changed only the attribute that was set')` — no `corrections`
  field.
- `it('names a value without a desc by the value alone')`.

`describe('create-or-replace-groups materials')`:

- `it('names the colour the library reset with a group front program')` — loaded w1, w2 with 324;
  group attribute Classic; the command returns them with 152. The corrections are "…
  mod_FrontProgram "Classic" was set on every unit …" followed by the second sentence above.
- `it('does not name a colour the group sets itself after its program')` — group Classic and 178;
  the first command resets the colour, the second sets 178. Only the two "was set" corrections.

`hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts`:

- `it('tells the agent that the front program says how a front is built and that a colour can switch it')`
  — the Fronts rule in `get-authoring-rules`, the library sentence in the descriptions of
  `change-module-attribute` and `change-group-attribute`, and no "allowed values" anywhere in the
  served text.
- `it('describes how to succeed instead of what is rejected, and where the corrections are')` —
  extended by the new end of the corrections rule.

### 5. Verification

- `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`.
- Without a model, against the planner: `replay/replay-sequence.mjs`. The create names the reset
  324 → 152, the `change-module-attribute` names the switch Classic → Modern, and no other
  attribute is named (no noise from the library's write-back).
- No chat run unless asked.

## Implementation

As planned, on `docs/wrong-front-design-analysis-RML-18094`
([#84](https://github.com/roomle-dev/roomle-hi-example/pull/84)):

- `hi-mcp-server.ts`: the Fronts rule, the end of the corrections rule, "values" instead of "allowed
  values", the library sentence in the descriptions of `change-module-attribute` and
  `change-group-attribute`.
- `tool-executors.ts`: `findLibraryChanges` (the comparison, root modules changed alike grouped),
  `libraryChangeSentences` (the value descs, master data read only when something changed),
  `withLibraryChanges` (the two commands); `applyGroupWideAttributes` compares the loaded group with
  the group the last of its commands returns. `change-module-attribute` compares the set value only
  on the root module it set, and with `moduleId` on none.
- `docs/hi-mcp-behaviour.md`: D59, D60, the Fronts rule (§5.2), §5.3, §6, §8.1, G46, C22;
  `docs/hi-mcp-server.md` and `.agents/skills/hi-mcp-tools.md`: the attribute commands.

Limit: after a create, the sentence names all group attributes the server set as the cause, also
those that did not change the attribute ("with mod_FrontProgram "Classic" (…) and
mod_CountertopColor "324" (…) the library changed mod_FrontColor …"): one comparison per group, so
that a colour the group sets itself after its program is not reported as reset.

### Verification

- Unit tests: 502 passed — 9 new in `tool-executors.test.ts` (`describe('library changes')`, two in
  `describe('create-or-replace-groups materials')`), 1 new and 1 extended in
  `hi-mcp-server.test.ts`. Typecheck, lint and format check pass.
- Without a model, against the deployed planner (`replay/replay-sequence.mjs`, result in the
  scratchpad `verify/replay2.json`):
  - the create with group `mod_FrontProgram` Classic and wall units on 324: "with mod_FrontProgram
    "Classic" (Simple fronts in plain decors) and mod_CountertopColor "324" (Dark marble (#404040))
    the library changed mod_FrontColor of root modules '…' (OTB60), '…' (OTB60) from "324" (Dark
    marble (#404040)) to "152" (Cloudy blue (#506080))";
  - `change-module-attribute mod_FrontColor 324`: "with mod_FrontColor "324" (Dark marble
    (#404040)) the library changed mod_FrontProgram of root module '…' (OTB60) from "Classic"
    (Simple fronts in plain decors) to "Modern" (Mitred frame fronts with glass filling)";
  - no other attribute is named.
- No chat run.

