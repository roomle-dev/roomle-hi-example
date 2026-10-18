# Bug analysis — the backsplash of an image kitchen is reported as not buildable

> **Type**: Bug analysis
> **Status**: Open — fix proposed, not implemented
> **Date**: 2026-10-17
> **Base**: roomle-hi-example `analysis/mcp-72-wall-units-two-heights-plinth` (`948fcd9`);
> roomle-ui `fix/room-corners-at-openings` (`a008be42d`) — the branch every roomle-ui change for
> this bug must be based on
> **Backlog**: item 75 of [`../backlog/mcp-issues.md`](../backlog/mcp-issues.md)

## Affected repositories

- **roomle-hi-example** — the proposed fix, part 1: the `notCarried` sentence of the
  `create-or-replace-groups` description (`hi-mcp/hi-mcp-server/hi-mcp-server.ts:395-397`), in
  library-neutral words without the kitchen example; the test `it('asks the agent to say which group
  material the library does not build')` (`hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts:464`)
  pins the new sentence. D65 of [`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md) quotes
  the sentence and carries the same example; its wording changes with the sentence. No change of the
  server's logic: the payload the agent sends is legitimate.
- **roomle-ui** — the proposed fix, part 2: the compaction of the master data
  (`packages/web-sdk/packages/homag-intelligence/src/hi-plan-context.ts:269-302`,
  `isCustomerFacingAttribute` at `hi-plan-context.ts:250-252`) keeps only customer-facing
  attributes; it must keep also the Bool attributes the root modules carry, so the generation
  switches reach the attribute vocabulary of `get-plan-context` and the search space of
  `find-attributes`. The fix is based on `fix/room-corners-at-openings`. The tests of
  `describe('compactMasterData')` (`__tests__/hi-plan-context-test.ts:317`) gain a Bool-switch
  fixture.
- **The library (HOMAG Furniture_Smith, server-side calculation)** — the smaller alternative:
  `mod_CreateBacksplash` is `userRight` "Advanced" while its sibling `mod_CreateCountertop` is
  "Simple"; marking it Simple puts the switch into the served vocabulary without a roomle-ui
  change. A library change, proposed as a library issue
  ([`../backlog/library-issues.md`](../backlog/library-issues.md)); it depends on HOMAG and covers
  one library, while part 2 serves every library's switches.
- **RoomleCore (the planner kernel)** — no change: the generation of the part is the library's
  calculation, driven by the attribute on the units; the kernel applies what it is given.
- **ligna-store** — no change: the store runs the same MCP server and the same roomle-ui and holds
  no copy of the served text or of the compaction.

## Symptom

For a kitchen image with a backsplash, the agent sends the backsplash's material attributes in the
group attributes of `create-or-replace-groups` but not the attribute that generates the backsplash,
so no backsplash is built, the result lists the two material attributes in
`groupAttributes.notCarried`, and the agent tells the user that the backsplash cannot be built.
Reproduce: `mcp-test-2026-10-17_13-28-41`, gpt-6-astra 51 (`image-only-no-text`, the
`create-or-replace-groups`; the run directory
`.temp/result/mcp-test-2026-10-17_13-28-41/gpt-6-astra/51-image-only-no-text/`). The payload sends
`mod_BacksplashColor` 216 and `mod_BacksplashHeight` 500 (left group) and 300 (right group) in the
group attributes of both groups, with no generation attribute anywhere. The outcome
(`order-data.json`): `mod_CreateBacksplash` false on every root module, no backsplash item, while
the worktop is built — two `mr_Countertop` items, `mod_CreateCountertop` true on the floor units the
agent never set it on. The answer: "the photo's wood backsplash and under-window worktop link are
not built."

The same in the other two image runs of the batch. gpt-6-astra 48 (`image-kitchen-left-wall`): the
same two material attributes without the switch, `mod_CreateBacksplash` false on every unit in
`order-data.json`, the answer says the backsplash is not included (verdict 48). gpt-6-astra 50
(`image-planning-right-wall`): the same payload pattern, no backsplash root in `order-data.json`.
No run of the batch sent `mod_CreateBacksplash`.

The contrast that names the cause: the same model, in run 07 (`utility-room-cabinets-left-wall`),
sends `mod_CreateCountertop` true as the only group attribute of its `create-or-replace-groups`, and
the library builds three `mr_Countertop` items (`order-data.json` of the run). The worktop's
generation switch is in the served vocabulary; the backsplash's is not.

## Investigation trace

1. **The `notCarried` sentence presents the missing part as final.** `hi-mcp-server.ts:395-397`:
   "notCarried: those no unit of the group has - the library builds no part for them in this
   group, a backsplash or an end panel for example, so the group stands without them, nothing to
   undo; say in the answer which material is not built". It tells the agent to report the missing
   part in its answer; it does not say that a part the library generates may wait for an attribute
   of the units that switches it on. D65
   ([`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md), line 273) records the decision
   with the same example.
2. **The agent set the material attributes because the vocabulary serves them.** In the stored
   master data (`docs/library-information/master-data.json`): `mod_BacksplashColor` and
   `mod_BacksplashHeight` are `userRight` "Simple" and are assigned to `mr_Backsplash` ("Backsplash",
   `moduleType` "SubModule", `group` "Root") — a generated root module, which the compaction keeps
   (`isGeneratedRootModule`, `hi-plan-context.ts:243-244`). So the agent finds the two attributes
   in the attributes section of `get-plan-context` and sets them as group attributes, as the rules
   for a material of the whole group prescribe.
3. **The switch is not served.** `mod_CreateBacksplash` ("Create backsplash", group
   "GenerationMethod", type Bool, desc "Adds the contour for the backsplash and also starts
   generating the backsplashes.") is `userRight` "Advanced" and `isMain` false. The compaction
   keeps an attribute only when a kept root module carries it and it is customer-facing —
   `isCustomerFacingAttribute` (`hi-plan-context.ts:250-252`) is `isMain === true || userRight ===
   'Simple'`, the filter sits at `hi-plan-context.ts:276-280`. The attributes section of
   `get-plan-context` is built from the compacted master data (`tool-executors.ts:437`,
   `agent-facing.ts:223-232`), and `find-attributes` searches the same compacted list
   (`tool-executors.ts:469-480` — "the master data arrives compacted: root modules and
   customer-facing attributes only"). The article catalog does not carry the switch either: its
   `mainAttributes` keep `isMain` attributes only (`hi-plan-context.ts:642-648`), and the switch is
   `isMain` false. Simulated against the stored master data: the served vocabulary holds
   `mod_BacksplashColor`, `mod_BacksplashHeight` and `mod_CreateCountertop`, not
   `mod_CreateBacksplash`.
4. **The asymmetry with the worktop is a library marking, not a server rule.**
   `mod_CreateCountertop` is `userRight` "Simple" — served — which is why the agent of run 07 finds
   it and switches the worktop on. `mod_CreateBacksplash` is "Advanced" — dropped by the
   compaction. The two other generation switches of the library, `mod_CreateToekick` and
   `mod_CreateFingergrip`, are "Advanced" as well: the same gap, waiting for the next image with a
   toe kick or a fingergrip part.
5. **Why `notCarried` lists the two material attributes.** `create-or-replace-groups` runs
   `applyGroupWideAttributes` (`hi-tool-commands.ts:543`, `hi-tool-attributes.ts:363`), which sends
   one `change-attributes` per group with the group attributes. `changeAttributes`
   (`hi-tools.ts:456`) computes the targets of every attribute against the roots of the group as
   loaded (`hi-tools.ts:467-501`): the backsplash is not generated — the switch is off — so no root
   module carries `mod_BacksplashColor` or `mod_BacksplashHeight`, both are skipped
   (`hi-tools.ts:494`) and land in `notCarried` (`hi-tool-attributes.ts:416-423`). The worktop colour
   is carried because the library generates the worktop for those units by default
   (`mod_CreateCountertop` true on them in the `order-data.json` of run 51, never sent by the
   agent), so the generated root is among the roots and carries it.
6. **The agent cannot recover from the sentence alone.** The backlog's step 1 — "look for that
   attribute (`find-attributes`) and set it" — names the right move, but `find-attributes` cannot
   return an attribute that is not served (trace 3). The fallback as stated — the result names per
   attribute in `notCarried` the generated root module that carries it — does not surface the switch
   either: no data links a generated module to its switch. `mr_Backsplash`'s `assignedAttributes`
   name only its own material attributes; the switch sits on the unit modules (`mr_StorageunitSingle`,
   `mr_CornerunitStraight`, `mr_Upright`, `mr_Filler01`, `mr_Appliance`, `mr_CornerFiller`) with no
   cross-reference. Naming the switch would take a naming-convention match in the logic — one
   library's content in the server's logic, against the library-neutrality rule, and fragile.

## Root cause

Two causes compound. The `notCarried` sentence of the `create-or-replace-groups` description
presents a not-carried attribute as a part the library will not build — final, nothing to undo, say
it in the answer — and does not say that a part the library generates may wait for an attribute of
the units that switches it on. And the switch itself is not served: the compaction of the master
data keeps only customer-facing attributes, and the library marks the generation switch Advanced
while its countertop sibling is Simple, so neither the attributes section of `get-plan-context` nor
`find-attributes` shows it. The agent sets the part's material attributes, has no way to learn that
the part needs a switch, and reports the part as not built.

The backlog's proposed step 1 does not close the loop by itself: "look for that attribute
(`find-attributes`) and set it" fails because `find-attributes` searches the compacted,
customer-facing vocabulary (`tool-executors.ts:469-480`), where the switch does not appear. The fix
needs the sentence and the served vocabulary together.

## Why the current code produces this

The compaction's customer-facing filter (`hi-plan-context.ts:276-280`) drops the switch before any
agent sees it; the served sentence then reads the resulting `notCarried` listing as final. The
agent's payload is legitimate — the material attributes of a part the library can generate — and
the planner builds exactly what the payload says: no switch, no part. The information that would
correct the agent exists in the library data (the switch's desc says it "starts generating the
backsplashes") but never reaches the agent, so the agent's answer reports the gap instead of
closing it.

## Proposed fix

Two parts, both needed.

**Part 1 — the served sentence** (roomle-hi-example, `hi-mcp-server.ts:395-397`), in
library-neutral words, without the kitchen example:

> notCarried: those no unit of the group has - they can belong to a part the library generates only
> when an attribute of the units switches it on: look for that attribute (find-attributes) and set
> it; the part's own attributes are set on it once it is generated; say in the answer only what
> still is not built -

The "once it is generated" clause covers the two-call path below. The test at
`hi-mcp-server.test.ts:464` pins the new sentence; D65 (`docs/hi-mcp-behaviour.md:273`) drops the
example with it.

**Part 2 — serve the generation switches** (roomle-ui, based on `fix/room-corners-at-openings`):
`compactMasterData` (`hi-plan-context.ts:276-280`) keeps an attribute when a kept root module
carries it and it is customer-facing **or a Bool**. Bool is a data type, not library content, so
the rule stays library-neutral. For the library of the runs it adds 12 attributes to the
vocabulary: the 3 generation switches (`mod_CreateBacksplash`, `mod_CreateToekick`,
`mod_CreateFingergrip`, all Advanced) and 9 design toggles (edge visibility, handle drill, carcase
visibility, group height). The 9 toggles are the price of not naming a library's attribute group
("GenerationMethod") in the logic — the neutrality policy forbids that, and a naming-convention
match would be one library's content in the server's logic. Serving all 210 non-customer-facing
attributes instead would grow the vocabulary twenty-fold; 12 is the measured price of the switches.

With the switch served, the loop closes: the agent reads the backsplash in the image, sets the
material attributes as today, sees them in `notCarried`, looks for the switch — `find-attributes`
"backsplash" returns `mod_CreateBacksplash` with its desc ("Adds the contour for the backsplash and
also starts generating the backsplashes") and the root modules that carry it — and sets it. Two
ways to set it, with different one-call behavior:

- **On a root's attributes at the create**: the part is generated at the load, and the material
  attributes of the group's attributes reach it in the same call — `change-attributes` targets the
  roots of the loaded group, the generated part included (the worktop of run 51 carried
  `mod_CountertopColor` the same way).
- **In the group's attributes beside the materials**: the switch is set on every unit and the
  reload after it generates the part, but the material attributes are still `notCarried` in that
  call — the targets are computed against the roots as loaded, before the reload
  (`hi-tools.ts:467-501`) — so the agent sets them on the generated part with
  `change-group-attribute` afterwards.

**Alternative, smaller — the library data.** Mark `mod_CreateBacksplash` customer-facing
(`userRight` "Simple", like `mod_CreateCountertop`). One line in the library; the switch then
appears in the vocabulary with its desc and part 2 is unnecessary. Proposed as a library issue
([`../backlog/library-issues.md`](../backlog/library-issues.md)); it depends on HOMAG and covers
one library. Consider the siblings `mod_CreateToekick` and `mod_CreateFingergrip`, which carry the
same gap. Part 1 is needed either way: the sentence misleads even when the switch is served.

## What the fix does not do

- It does not serve the 210 non-customer-facing non-Bool attributes of the library's root modules;
  the vocabulary grows by the 12 Bools, not twenty-fold.
- It does not name a part or a switch in the served text: the sentence speaks of "a part the library
  generates" and "an attribute of the units that switches it on" — no article, category, attribute,
  value or measure of a library (the library-neutrality rule, §2.4 of
  [`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md)). The kitchen example "a backsplash
  or an end panel" leaves the sentence (item 1 of
  [`../backlog/mcp-policy-issues.md`](../backlog/mcp-policy-issues.md)).
- It does not set the switch itself: the agent decides from the image; the server cannot tell a part
  the user wants from one they do not, and it does not build content the agent never asked for
  ([Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort) — no guard, no correction
  here; the sentence teaches, the vocabulary enables).
- It does not change the `notCarried` report: the listing is accurate — no unit of the group carries
  the attributes. The backlog's fallback of naming the generated root module per attribute is not
  needed once the switch is served: `find-attributes` already names the root modules that carry an
  attribute.
- It does not touch the generation logic: the library generates the part when the switch is on; the
  kernel applies what it is given.

## Rejected approaches

- **The served sentence alone** (the backlog's step 1 as stated). "Look for that attribute
  (`find-attributes`) and set it" — `find-attributes` searches the compacted customer-facing
  vocabulary (`tool-executors.ts:469-480`) and cannot return the switch; the agent would look and
  find nothing. This is why the fix has a part 2.
- **Naming the generated root module per `notCarried` attribute** (the backlog's fallback). The
  agent would learn that the material attributes belong to a generated part, but the switch is
  still unserved, and no data links a generated module to its switch (trace 6) — the only way to
  name the switch would be a naming-convention match in the logic: one library's content in the
  server's logic, against the neutrality policy, and fragile.
- **A guard that rejects material attributes no unit carries.** A guard fights the symptom: the
  agent's payload is legitimate — the materials of a part the library can generate — and the
  refusal would cost the agent a step of its turn and tell it nothing it can act on.
- **The server sets the switch itself when it sees `notCarried` material attributes.** The server
  cannot tell a part the user wants from one they do not; it would build content the agent never
  asked for.
- **Serving every non-customer-facing attribute.** The vocabulary would grow from 61 to 271
  attributes for the library of the runs; the 12 Bools are the measured price of the generation
  switches.
- **Fix it in the kernel (RoomleCore).** The generation is the library's calculation, driven by the
  attribute on the units; the kernel has nothing to correct.

## Implementation plan (sketch)

1. roomle-hi-example `hi-mcp/hi-mcp-server/hi-mcp-server.ts:395-397` — the new `notCarried`
   sentence (part 1 above).
2. roomle-hi-example `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts:464` — extend
   `it('asks the agent to say which group material the library does not build')` with the new
   sentence.
3. roomle-hi-example `docs/hi-mcp-behaviour.md:273` — D65 drops the example with the sentence (the
   same change as the code).
4. roomle-ui `hi-plan-context.ts:276-280` — the compaction keeps also the Bool attributes the kept
   root modules carry (part 2 above). Based on `fix/room-corners-at-openings`.
5. roomle-ui `__tests__/hi-plan-context-test.ts` — `describe('compactMasterData')` (line 317)
   gains a Bool switch fixture (userRight Master, type Bool, assigned to a root module) that is
   kept, and the non-Bool non-facing attribute of the fixture stays dropped.
6. The stored tests `image-kitchen-left-wall`, `image-planning-right-wall`, `image-only-no-text`
   of `docs/test-prompts.json` hold the outcome: the image's backsplash is in the plan (the switch
   true on the units and a backsplash root in `order-data.json`).
