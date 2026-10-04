# RML-18041: implementation plan — the fixes and their unit tests

> **Type**: Implementation plan (step 4 of the [change workflow](../../AGENTS.md#suggested-change-workflow))
> **Analysis**: [rml-18041-mcp-test-open-issues.md](rml-18041-mcp-test-open-issues.md) — the causes
> verified on `master` `3a263d1`, the live reproduction, the fix per issue
> **Date**: 2026-10-04
> **Author**: AI Assistant
> **Status**: Implemented 2026-10-04 — PR 1 `e200cd0`, PR 2 `ed856f2`, PR 3 `1bf3b63`, PR 4 `9b064e7`, PR 5 `c01d758` + `fae8575`, PR 6 `3df8f22` on the branch; PR 7 awaits the D23 decision. Deviations: the `onTop` corrections of PR 1 apply to kitchen base units (category "Base Units") only, so stacking on other floor units stays possible; the near-side rule of PR 2 lives in `merge-article-into-group` only (see the assumption); the root entries of `notLoaded` carry `rootIds`
> **Branch**: `fix/mcp-test-open-issues-RML-18041` — [PR #62](https://github.com/roomle-dev/roomle-hi-example/pull/62)

---

## Assumptions

- **#6**: a unit attribute on some roots (walnut on one of nine) stays per unit. Only an attribute
  that no root module of the group carries but a generated root does (`mod_CountertopColor` on a
  base unit) is applied kitchen-wide. The rule sentence tells the agent where a kitchen-wide
  material goes.
- **#27 (D23)**: planned as the last work package and not started until the decision is taken.
- **One refinement of the analysis** (#1): the near-side rule applies to `merge-article-into-group`
  only. In `create-or-replace-groups`, two units `rightOf` one unit name the same direction twice,
  so the later one keeps going to the free end of the row in that direction; only the corner stop
  is added there.
- **Six pull requests** in the ticket's order, each with code, unit tests and documentation, each
  removing the entries it fixes from [mcp-test-open-issues.md](../backlog/mcp-test-open-issues.md)
  and the [backlog README](../backlog/README.md). Every PR passes `npm test`, `npm run typecheck`,
  `npm run lint` and `npm run format:check` in `hi-mcp`. The live script of the analysis (headless
  page on the local planner) is re-run after PR 2 and PR 4; "test the mcp" with gpt-5-mini,
  gpt-5.4-mini and gpt-6-astra closes the ticket (definition of done).

Every PR updates [hi-mcp-behaviour.md](../../hi-mcp/docs/hi-mcp-behaviour.md) in the same change
(the §8 tables, the decisions it touches), the tool reference
[hi-mcp-tools.md](../skills/hi-mcp-tools.md) and the user documentation
[hi-mcp-server.md](../../minimal-hi-example/docs/hi-mcp-server.md) where a result or a rule changes.
The analysis is closed out at the end with the fix summary per issue.

## Shared preparation (PR 1)

`group-layout.ts` keeps the kind of a unit and the hang height inside `relationsToDocking`. Two
later packages need them in `tool-executors.ts`, so PR 1 exports them without changing behaviour:

- `isWallUnitArticle`, `isTallUnitArticle`, `isHoodArticle` (`group-layout.ts:59-66`);
- `hangGapOf(articles, libraryId, roots, unit, carrier)` — the arithmetic of `hangGap`
  (`group-layout.ts:131-150`) as a module function; `relationsToDocking` calls it.

Covered by the existing tests ("hangs a wall unit above a base unit at the top line of the tall
units").

## PR 1 — compile gaps: `fix: compile onTop and above where a unit cannot stand`

Issues 29, 32, 21, 19; D35 confirmed.

### Code — `group-layout.ts`, the intent branches of `relationsToDocking` (`:196-228`)

| # | New branch | Result | Correction |
|---|---|---|---|
| 29 | `onTop`, the unit is a wall unit, the target neither a wall unit nor a tall unit | relation `above` (D35 gap) | "wall unit 'w' hangs above the floor unit 'c' instead of onTop it" |
| 32 | `onTop`, the unit is a floor unit, the target a base unit (neither tall nor wall) | relation `rightOf` | "floor unit 'x' cannot stand on the base unit 'c' - it continues the floor row" |
| 19 | `above` a tall unit | the G41 path (`:244-280`), generalised from "a hood `rightOf`/`leftOf` a tall unit" to "any unit `above` a tall unit": above the floor unit beside the tall unit when the relations name one (`floorBeside`, either side), else beside the tall unit with the tops flush | "'h1' cannot hang above the tall unit 't1' - it hangs above 'b1' beside it" / "… - it hangs beside 't1' with the tops flush; put it above the floor unit below it" |
| 21 | after the defaults (G31) are in `kept`: a second `above` link to a carrier that already carries a unit | relation `rightOf` the first unit above that carrier | "'hood1' and 'w2' both hang above 'l3' - 'hood1' was put rightOf 'w2'" |

`onTop` a tall unit or a wall unit stays a stacking without a note, whatever the unit.

### Code — the served text, `hi-mcp-server.ts`

Line 13: "onTop: "<id>" - the unit stands on top of that unit (stacking on a tall unit or a wall
unit, also several levels); …".

### Behaviour reference

New rows G42 (#29), G43 (#32), G44 (#21), G45 (#19) in §8.3; D35 loses "to be confirmed" and gets
"confirmed live 2026-10-04: bottom 1480, top 2200 in Furniture_Smith".

### Unit tests — `tests/group-layout.test.ts` (fixtures `UTB60`, `H2TB60`, `OTB60`, `UERTB90`, `DU`, `HK60` exist)

1. **hangs a wall unit onTop a floor unit above it, and keeps a stacking on a tall unit or a wall
   unit** — `OTB60 onTop UERTB90` → `UERTB90.LeftTop -> w.LeftBottom StartStart [0,660,0]` and the
   note; `OTB60 onTop H2TB60` → `[0,0,0]`, no note; `OTB60 onTop OTB60` → stacking.
2. **continues the floor row for a floor unit onTop a base unit** — `UTB60 onTop UERTB90` →
   `UERTB90.RightBottom -> x.LeftBottom` and the note; `UTB60 onTop H2TB60` → stacking.
3. **puts the second unit above one floor unit rightOf the first** — `OTB60 above b1`, `DU above
   b1` → `w1.RightBottom -> h1.LeftBottom StartStart [0,0,0]` and the note; the first keeps its
   `[0,660,0]`.
4. **hangs a unit above a tall unit above the floor unit beside it, or beside it with the tops
   flush** — `DU above HK60` with `UTB60 leftOf HK60` → `UTB60.LeftTop -> DU.LeftBottom [0,660,0]`
   and the note; `DU above HK60` alone → `HK60.RightTop -> DU.LeftTop` and the note.

`tests/tool-executors.test.ts`, "create-or-replace-groups relations": **reports a wall unit onTop
a floor unit as hanging above it** — the note reaches `corrections`.

`tests/hi-mcp-server.test.ts`, "teaches the relations…": the rules contain "stacking on a tall unit
or a wall unit".

## PR 2 — `fix: dock to the near end of the row and keep the generated roots on a reload`

Issues 1, 4, 22 (`place-group` part), 28, 34.

### Code — `tool-executors.ts`

- **`dockTarget` (`:224-268`)**, when the named side vector is taken:
  1. the opposite side vector (`SIDE_PARTNER`, `:641`) of the named root is in its
     `freeDockingVectors` → `ownDockingVector` becomes the opposite vector, `dockingVector` its
     partner (`PARTNER_VECTOR`, `:1344`); correction "the LeftBottom of root '…' is taken - the unit
     was docked to its free RightBottom";
  2. otherwise `rowEnd` in the named direction, which now **stops at a corner article** (a
     predicate `isCorner(rootId)` from `isCornerArticle(articles, root)`): when the walk meets one,
     the unit goes to the free end of the row in the other direction; correction "… the RightBottom
     row of '…' ends at the corner article '…' - the unit was docked to the LeftBottom of '…', the
     free end of its leg".
- **`separateSideVectorPartners` (`:717-753`)**: the corner stop only (assumption above).
- **`rowEnd` (`:621-639`)** takes the corner predicate; `completeDocking` passes it.
- **`repositionedGroup` (`:111-125`)**: keeps every raw root, generated ones included, each without
  `articlePos` and `rotationY` (`withoutPositions`); the anchor is the first article root. C1 is
  narrowed to `create-or-replace-groups`.
- **`place-group` (`:1883-1982`)**, before the reload: the computed `placement.pos` equals the raw
  group's `pos` within 5 mm (`OVERLAP_TOLERANCE_MM`) and `placement.rotationY` equals its
  `rotationY` modulo 360 (the planner reports −90 for 270) → no load; the result is
  `{ placedIn, wall, group }` from the plan context with the correction "group '…' already stands
  at the … wall … - nothing was reloaded".
- **`create-or-replace-groups`** after the load, for every replaced group (`beforeGroupIds`,
  `:1726`): when the result group's article roots are not those sent but those of the group before
  the call (`preContext`, `:1724`) → correction "the planner could not calculate the new layout of
  group '…' and kept its previous content - the page console names the module; send the layout
  again with another article" (#34).

### Behaviour reference

D29 refined (the named root's free side first in `merge-article-into-group`; the walk stops at a
corner article, in both corrections); C1 narrowed; new rows in §8.4 ("already stands there") and
§8.3 ("kept its previous content").

### Unit tests — `tests/tool-executors.test.ts`

"merge-article-into-group docking" (the `row()` fixture r1 → r2 → r3):

1. **docks a unit sent to the taken side of a row end to that root's free side** — `dockTo` r3
   `LeftBottom` → sent `{ rootId: 'r3', ownDockingVector: 'RightBottom', dockingVector: 'LeftBottom' }`
   and the correction.
2. **walks to the free end from a root with both sides taken** — `dockTo` r2 `RightBottom` → r3
   (the existing wording); the existing test "docks a unit on a taken side to the free end of that
   row" is rewritten to start from r2.
3. **stops the walk at a corner article** — a corner fixture (`cornerArticle: true`): `c` with
   `LeftBottom -> b1`, `b1` with `LeftBottom -> b0`; `dockTo` b1 `RightBottom` (taken by `c`) →
   b0's `LeftBottom`, the correction names the corner article.

"create-or-replace-groups validation": **moves the later of two roots on one side vector to the
free end of the leg, not through the corner article** — `b1` on the corner's left leg, `b2` and
`b3` on `b1`'s `RightBottom` → `b3` on `b0`'s `LeftBottom`.

"place-group":

5. "reloads the article roots only and anchors the first of them" becomes **reloads the group with
   its generated roots and anchors the first article root** — roots `['w1', 'r1']` sent,
   `rootId: 'r1'`, no `articlePos` on any root.
6. **does not reload a group that already stands where asked** — `createPlaceApi` with a raw
   group whose `pos`/`rotationY` equal the centred position on the right wall → no load call, the
   correction, `placedIn: 'wall'`.
7. **treats −90 and 270 as the same rotation** when comparing.

"create-or-replace-groups loading": **reports a replace the planner reverted** — the plan context
after the load returns the previous roots (`mockResolvedValueOnce` chain as in `:425-427`) → the
correction; a replace that took keeps `corrections` empty.

## PR 3 — `feat: apply a kitchen-wide material from the group attributes`

Issues 6, and the replace part of 22.

### Code — `tool-executors.ts`, `create-or-replace-groups`

1. **Kitchen-wide attributes.** After the load and the plan context read: for every input group,
   every `{ id, value }` of its normalised `attributes` whose id is not among the result group's
   `attributes` (the library's group settings) is applied with the planner command
   `change-group-attribute` on the result group (new groups are matched to the input groups in
   order; a replaced group by its id). Each is reported: "mod_FrontColor 215 was set on every unit
   of group '…'". The planner's P3 ("No module of group … has the attribute") becomes the
   correction "no unit of group '…' carries 'mod_X' - ignored"; any other planner message is
   reported the same way, and the load stands.
2. **An override only a generated root carries.** Before the load, with the master data of the
   library (`getExternalObjectPlanContext(['masterData'])`, read once per library and remembered
   like `knownAnchorFrames`): a root override whose id no root module of the root's article
   carries (the article's `rootModules[].module.id` against `masterData.modules[].attributes`) but
   a generated root module does (`mr_Countertop`, `mr_Toekick`) moves to the group's kitchen-wide
   list; correction "mod_CountertopColor on root 'r1' - a base unit has no worktop colour; it was
   set on the group's worktop". An override nobody carries is dropped and reported ("no module
   carries 'x' - ignored").
3. **The colours of the generated roots over a replace (#22).** The input attributes of the
   generated roots that C1 drops (`mr_Countertop`: `mod_CountertopColor`, as `get-plan-context`
   returns them) join the kitchen-wide list of that group and are set again after the load;
   correction "the worktop colour 224 was set again after the replace".

### Code — the served text, `hi-mcp-server.ts`

Line 7: "attributes is an optional list of { id, value } overrides of that unit; a material for the
whole kitchen - fronts, worktop, carcase - goes into the group's attributes". INSTRUCTIONS step 2
and the `create-or-replace-groups` description get the half sentence "a material for the whole
kitchen goes into the group's attributes".

### Behaviour reference

New rows G46 (group attributes applied kitchen-wide), G47 (a generated-root attribute on a root →
the group), G48 (the generated roots' colours set again after a replace), the "nobody carries it"
correction; §6 `create-or-replace-groups` gets step 7; §5.2 the payload sentence.

### Unit tests — `tests/tool-executors.test.ts`, a new describe "create-or-replace-groups materials"

The master data fixture gets a generated root module `mr_Countertop` with the attribute
`countertop`, and `module-1` keeps `front`.

1. **applies the group attributes that are not group settings to every unit after the load** —
   `attributes: [{ id: 'front', value: 'white' }, { id: 'mod_GroupHeight', value: 1500 }]`; the
   plan context after the load returns the group with `attributes: [{ id: 'mod_GroupHeight', … }]`
   → one `externalObjectGroupOperation('change-group-attribute', { groupId, attributeId: 'front',
   value: 'white' })`, `mod_GroupHeight` not; the correction.
2. **moves an override only a generated root carries to the group** — root `u1` with
   `[{ id: 'countertop', value: '224' }]` → the override leaves the root in the load payload, the
   group command runs, the correction.
3. **reports an attribute no module carries without a command** — `{ id: 'nope' }` on the group
   and on a root → two corrections, no `change-group-attribute`.
4. **passes the planner's answer on as a correction and keeps the load** — the command mock throws
   P3 → correction, `loaded` and `groups` as before.
5. **sets the colours of the generated roots again after a replace** — a replace with a generated
   root carrying `[{ id: 'countertop', value: '224' }]` → dropped from the payload (C1), the group
   command after the load, the correction.

`tests/hi-mcp-server.test.ts`: the rules contain "a material for the whole kitchen"; the "describes
how to succeed" test keeps passing (no "reject").

## PR 4 — `feat: build what can be built and resolve what the agent means`

Issues 26, 24, 8, 25.

### Code — `tool-executors.ts`

- **#26** `resolveArticleIds` (`:204-218`) removes a root whose article the catalog does not have
  instead of failing the group, and returns what it dropped. A relation that named the root falls
  to G32/G31 (reported as today). The group goes on when at least one root remains; `notLoaded`
  gets a root entry for it: `{ index, id?, rootIds: ['w2'], errors: ["root 'w2': articleId 'OTB90'
  is not in the article catalog. Valid article ids: …"] }`. A group whose every root is unknown
  stays a whole-group `notLoaded` entry (G15). The rules line 27: "notLoaded lists the groups and
  the roots it could not build, with what to send instead" (the sentence start the server test
  asserts stays).
- **#24** a module-level `Map` of the agent's group id → the planner's id, filled after a create
  (new plan groups matched to the input groups in order), with `forgetAgentGroupIds()` for the
  tests. Before the replace check (`:1742`): an input id that is not in the plan but remembered,
  and whose planner id is in the plan, is read as that id → a replace; correction "group id
  'kitchen1' names the group '8b3f…' created earlier - it was replaced"; G16 then drops the
  placement as today. A remembered id whose planner id left the plan is forgotten. After the load,
  a new group whose `position.pos` lies within 5 mm of another group's `pos` with the same
  `rotationY` gets a `hint`: "group '…' stands at the place of group '…' - if the units belong
  together, send them as one group or join them with merge-groups". Never a refusal (D22).
- **#8** `findRoot(groups, rootId)`: the exact id; else a unique prefix; else the unique root whose
  last four UUID segments equal the sent ones; else the unique root of the same length that
  differs in one character. Used by `change-module-attribute` and `delete-root-module` (which now
  read the plan's groups first), `exchange-root-module`, and `dockTo.rootId` of
  `merge-article-into-group` (within the resolved group). A resolution is a correction ("root id
  '378c6f4a-…' was read as '378c6f4e-…'"); no unique match → the id is forwarded as sent and the
  planner's P11 message is passed on with "Roots in the plan: …" appended.
- **#25** in `prepareGroup`, after `completeDockingEntries`: a root with `dockTo { rootId,
  ownDockingVector, dockingVector }` gets the relation it describes — `RightBottom -> LeftBottom` =
  `rightOf rootId`, `LeftBottom -> RightBottom` = `leftOf`, a Top → Bottom pair = `above` (G34
  turns a floor unit's into `rightOf`), `BackBottom -> BackBottom` = `behind` — and loses `dockTo`;
  correction "root 'cab2': dockTo was read as rightOf 'cab1'". `dockTo` joins `ROOT_FIELDS` so G27
  does not report it.

### Behaviour reference

G15 split (one unknown root → dropped and named; all unknown → not loaded); §2.3 and §8.1 the root
entries of `notLoaded`; new rows for the remembered agent id and the hint (#24), the root id
resolution (#8, as C4 is for group ids), `dockTo` on a root (#25).

### Unit tests — `tests/tool-executors.test.ts`

1. **loads a group without the root whose article the catalog does not have and names it** —
   two roots, one unknown → one root in the payload, `notLoaded: [{ index: 0, rootIds: ['u2'],
   errors: [...] }]`; the existing "rejects an article id that is not in the catalog" keeps its
   single-root payload (all unknown → still the error, no load).
2. **replaces the group created earlier under the agent's own id** — a first call creates
   `kitchen1`; the plan context afterwards holds `g-new`; a second call with `id: 'kitchen1'` and a
   placement → payload id `g-new`, no `repositioningData`, the two corrections (the remembered id,
   G16).
3. **hints at a new group that stands at the place of another** — the plan context after the load
   returns two groups with the same `pos` and `rotationY` → the hint.
4. **resolves a root id by a unique prefix, by its last segments and by one character** —
   `change-module-attribute` with each form → the planner command carries the real id, the
   correction; **forwards an ambiguous root id with the roots of the plan** → the planner's error
   with "Roots in the plan: …".
5. **resolves dockTo.rootId of merge-article-into-group the same way.**
6. **reads dockTo on a root as its relation** — `cab2` with `dockTo` on `cab1` → the docking of
   `rightOf`, no G27 note, the correction.

`tests/hi-mcp-server.test.ts`: the "describes how to succeed" test asserts the extended
`notLoaded` sentence.

## PR 5 — `feat: name the walls, the openings and the room corners in the plan context`

Issues 12, 30, 31, 33, the merge part of 10, the description part of 5.

### Code

- **`plan-space.ts`**: `wallName(side)` (`top` → "back wall", `bottom` → "front wall", `left`,
  `right`) and `roomCorners(walls)`: for every pair of walls of type `wall` that share a point
  (`sharedCorner`, `:360-366`) and are not parallel, `{ name, point, posRotationY }` — the name
  from the two sides, back/front first ("back right"), `posRotationY` the `facingRotationY` of the
  wall that ends in the corner (the contour runs counter-clockwise, so this gives 0, 90, 180, 270
  for back left, front left, front right, back right — the table of §7).
- **`get-plan-context` (`tool-executors.ts:1623-1644`)**: when the rooms are present, every wall
  gets `name`, a wall with `type: null` gets `type: 'opening'`, every room gets `corners`.
  `place-group`'s `resolveWall` (`:1437-1466`) is untouched: `opening` is not `wall`.
- **`dockTarget`** (#10): the new article is a wall unit or a hood (`isWallUnitArticle`),
  `ownDockingVector` ends with `Top`, `dockingVector` with `Bottom`, the named root is a floor unit
  that is not a tall unit, and `offset[1]` is 0 or missing → `offset[1]` = `hangGapOf(articles,
  group.libraryId, group.roots, article pick, named root)` (the named root's `mod_Height` is among
  its input attributes; the article's height in the catalog); correction "'OTB60' hangs 660 mm
  above '…', at the height of the wall units". An explicit y offset is kept.
- **`relationsToDocking`** (#33): a wall unit `rightOf`/`leftOf` a tall unit on a side where the
  tall unit has no floor unit, while the other side has one (`sideOfTall`, `:322-342`) → the
  relation flips; correction "wall unit 'w1' goes leftOf the tall unit 't1', on the side of the
  base units".
- **The served text**:
  - line 21: "use the walls of type wall; an entry of type opening is a door";
  - line 22: the corner table becomes "every room carries a corners list - per corner its name
    (back left, back right, front left, front right), its point and the posRotationY of a corner
    kitchen there; take both from it. This holds for both hands of corner article. Straight walls:
    back 0, left 90, front 180, right 270";
  - line 16 (#33): "A wall unit rightOf or leftOf a tall unit hangs beside it with the tops flush,
    on the side of the base units (leftOf a tall unit that ends the row); …";
  - line 17 and Example 3 (#31): "the wall units of each leg hang above the floor units of that leg -
    the first one above a floor unit of the leg, the next ones rightOf or leftOf it; never put a
    wall unit on or above the corner article"; Example 3 gets `w1 above r1` and `w2 above l1`;
  - the `merge-article-into-group` description (`:391-397`, `:437`) (#10, #5): "LeftTop ->
    LeftBottom hangs a wall unit or a range hood above a floor unit at the height of the wall
    units" and the `offset` description without `[0, 600, 0]`.

### Behaviour reference

§5.4 `rooms` (`name`, `type: opening`, `corners`), §7 the corner table replaced by the `corners`
list, §8.5 the derived hang height of `merge-article-into-group` (beside P7), new row G49 (#33);
D12 extended by the names.

### Unit tests

`tests/plan-space.test.ts`:

1. **lists the four corners of a rectangular room with their names and rotations** — the 4000 ×
   3000 fixture → back left `[0, 0, -3000]` 0, back right `[4000, 0, -3000]` 270, front right
   `[4000, 0, 0]` 180, front left `[0, 0, 0]` 90.
2. **still lists four corners when a door splits a wall, and none between collinear walls** — the
   default room's right wall as three entries (stub, opening, wall).

`tests/tool-executors.test.ts`, "get-plan-context": **names the walls, marks the openings and lists
the room corners** (the pass-through test adapts its expectation).

`tests/group-layout.test.ts`: **moves a wall unit beside a tall unit to the side of the floor
units** — `b1`, `t1 rightOf b1`, `w1 rightOf t1` → `t1.LeftTop -> w1.RightTop` and the note; with
floor units on both sides nothing moves.

`tests/tool-executors.test.ts`, "merge-article-into-group docking": **hangs a wall unit merged on a
floor unit's top vector at the height of the wall units** — a wall-unit article fixture with
`mod_Height` 720 and a tall unit in the catalog (2100), the named root with `mod_Height` 720 →
`offset [0, 660, 0]` and the correction; **keeps an explicit offset**; **adds no offset beside a
wall unit or on a tall unit**.

`tests/hi-mcp-server.test.ts`: the rules contain the corners sentence, "type opening", the wall-unit
sentences of #31 and #33; the `<gap` assertion of "teaches the relations…" extends to the
`merge-article-into-group` description, which also loses "600".

## PR 6 — `feat: ground the chat answer and limit a turn`

Issues 9, 17.

### Code — `hi-mcp/hi-mcp-chat`

- `chat-config.ts`: `CHAT_SYSTEM_PROMPT` moves here from `chat-server.ts:15-19` and gets the
  fourth sentence "Answer only with what the last tool results show - the groups, their roots and
  attributes, corrections and notLoaded - and name what was asked but is not in the plan."
  `getChatConfig` reads `HI_CHAT_TURN_TIMEOUT_MS` (default 300 000) and `HI_CHAT_REASONING_EFFORT`
  (optional; passed as `providerOptions.azure.reasoningEffort` for the Foundry deployments, the key of `@ai-sdk/azure` — the
  measurement the [backlog note](../backlog/reasoning-effort-for-the-gpt-chat-models.md) asks for
  becomes a setting).
- `chat-steps.ts`: `logStepUsage` (`onStepFinish`: input, output and reasoning tokens, the size of
  the tool input, the step's duration, one `[hi-chat] step n …` line) and `turnTimeout(ms)` — an
  `AbortSignal` for `streamText`; `chat-server.ts` passes both and, when the signal fires, ends the
  stream with "[error] the turn took longer than 5 minutes - the plan holds what the tools changed
  so far".

### Unit tests

`tests/chat-handler.test.ts`: **the system prompt asks the model to answer from the tool results**
(the sentence); **reads the turn timeout and the reasoning effort from the environment**.

`tests/chat-steps.test.ts` (the `MockLanguageModelV3` pattern): **ends a turn that never answers
after the turn timeout with the message** — a stream that stalls, a 50 ms timeout; **logs the usage
of every step** — a `console.log` spy sees one line per step with the token counts.

The behaviour reference §4 ("The HI chat") names the fourth sentence, the turn limit and the
reasoning setting.

## PR 7 — after the D23 decision: `feat: place a new group by wall and alignment`

Issue 27. Only if the decision takes the proposal of the analysis.

- `normalizePlacement` (`tool-executors.ts:384-442`) accepts `{ wall, alignment?, offsetMm?,
  roomIndex? }` beside `{ posGroup, posRotationY, rootId? }` (G11 no longer drops the wall fields);
  the group loads without `repositioningData`, and after the load the server runs the `place-group`
  logic for it — `placeGroupAtWall`, the overlap check and the reload, extracted from the
  `place-group` executor into `placeLoadedGroup(api, group, spec)` that both use — and reports as
  `place-group` does. Rules line 20/21 and Example 4 (`{ wall: "back", alignment: "center" }`);
  D23 → in effect.
- Tests: **places a new group by wall and alignment in one call** (one load without repositioning,
  one reload with the computed `repositioningData`), **puts a new corner kitchen into the corner the
  alignment names**, the rule sentence; the G11 test adapts.

## Summary

| PR | Issues | Code | New or changed tests |
|---|---|---|---|
| 1 | 29, 32, 21, 19, D35 | `group-layout.ts`, rules line 13 | 4 + 1 + 1 |
| 2 | 1, 4, 22 (place-group), 28, 34 | `tool-executors.ts` | 8 |
| 3 | 6, 22 (replace) | `tool-executors.ts`, rules line 7, descriptions | 5 + 1 |
| 4 | 26, 24, 8, 25 | `tool-executors.ts`, rules line 27 | 6 + 1 |
| 5 | 12, 30, 31, 33, 10 (merge), 5 (description) | `plan-space.ts`, `tool-executors.ts`, `group-layout.ts`, rules lines 16, 17, 21, 22, Example 3, descriptions | 2 + 1 + 1 + 3 + 1 |
| 6 | 9, 17 | `chat-config.ts`, `chat-steps.ts`, `chat-server.ts` | 2 + 2 |
| 7 | 27 (D23) | `tool-executors.ts`, rules lines 20, 21, Example 4 | 2 + 1 |

Issues 3, 7, 13, 14 and 15 (docking written as `contextData`) stay in the backlog at low
priority; 11, 16 and 23 are planner tickets.
