# Unconnected docking graph accepted by create-or-replace-groups

> **Type**: Bug Analysis
> **Domain**: hi-mcp — `create-or-replace-groups` validation and placement (`hi-mcp/hi-mcp-poc-json/tool-executors.ts`, `group-placement.ts`); the planner's root arrangement (roomle-ui `packages/web-sdk/packages/homag-intelligence/src/hi-root-module-arrangement.ts`); evidence from the saved plans of the test run
> **Trigger**: "test the mcp" run `.temp/result/mcp-test-2026-09-30_16-04-31/report.md` (gpt-5.4-mini, planner `bo-test`): 3 of 13 prompts failed — 04 through a server bug, 02 and 06 through the model's input that the server let through
> **Date**: 2026-09-30
> **Author**: AI Assistant
> **Status**: Open
> **Branch**: `fix/docking-graph-connectivity-check`

> **Progress (2026-09-30)**: The connectivity check is implemented (`4f91b38`), with one change
> to the reviewed plan: an entry that names an id outside the group is **not** rejected — it
> connects nothing (see [Amendment](#amendment-ids-outside-the-group)). Unit tests pass; the
> live "test the mcp" run (2026-09-30 17:48) loaded only connected layouts but showed that the
> amendment leaves a gap for new groups (see [Live verification](#live-verification-2026-09-30-1748)).
> The document stays Open until that is decided.

---

## Scope

The report of the run classifies the three failing prompts:

| Run | Prompt | Verdict of the report | This analysis |
|---|---|---|---|
| 04 | plan a kitchen with an oven, a range hood, a sink and a fridge in the back right corner | **bug — MCP server validation** | root cause and fix: [§ The bug](#the-bug-run-04) |
| 02 | add a group of 4 cabinets to the wall in the back | model finding; hardening candidate | gap located: [H1](#h1-a-footprint-outside-the-room-runs-02-06) |
| 06 | create a kitchen with an oven, hob, cooker hood, fridge, sink … around the corner, walnut fronts, dark marble worktop | model finding; three hardening candidates | gaps located: [H1](#h1-a-footprint-outside-the-room-runs-02-06), [H2](#h2-several-roots-on-one-docking-vector-run-06), [H3](#h3-a-wall-unit-as-the-placement-anchor-run-06) |

The bug is the subject of the fix on this branch. The hardening items were implemented once
(PR #24, `bc6ce15`) and reverted the same evening (`1e979da`); this analysis records why they
would have caught 02 and 06, what has changed since the revert, and leaves the decision to
the review.

The root positions below come from the saved plan of each run (`plan.xml`, the group JSON in
`<planobject><idMap><externalConfiguration>`), which the plan context does not carry (no root
positions, by design). They were read with:

```bash
node -e '
const xml = require("fs").readFileSync(process.argv[1], "utf8");
const decode = (s) => s.replace(/&quot;/g, "\"").replace(/&amp;/g, "&");
for (const m of xml.matchAll(/<externalConfiguration>([\s\S]*?)<\/externalConfiguration>/g)) {
  const group = JSON.parse(decode(m[1]));
  console.log("group pos", JSON.stringify(group.pos), "rotationY", group.rotationY);
  for (const r of group.roots) console.log(" ", r.id.slice(0, 8), r.articleId ?? r.name, JSON.stringify(r.articlePos), r.rotationY,
    (r.contextData?.dockedRoots ?? []).map((d) => d.ownDockingVector + "->" + d.dockedRoots.map((x) => x.id.slice(0, 8)).join(",")).join(" "));
}' "$R/plan.xml"
```

---

## The bug (run 04)

### Symptom

Prompt: "plan a kitchen with an oven, a range hood, a sink and a fridge in the back right corner
of the room". Plan snapshot `ps_qjaxn446eqgux1ki3g2kypcokzg52aq`.

The model called `create-or-replace-groups` three times. The first two calls were rejected by the
server's validation (the chat log shows `tool done` after 14 ms and 6 ms with no planner call in
between; the tool results are not recorded, so the rejection reasons are unknown). The third call
passed validation and loaded this layout (`planner-calls.json`, call 9):

| Root | Article | Docking entries written on it |
|---|---|---|
| `corner` | `UERTB90` corner base cabinet | `RightBottom -> fridge.LeftBottom`, `LeftTop -> hood.LeftBottom` (offset y 600) |
| `sink` | `ESUT60` sink base cabinet | `RightBottom -> oven.LeftBottom` |
| `oven` | `HOTS2AB60` tall oven cabinet | — |
| `fridge` | `HK60` tall fridge cabinet | — |
| `hood` | `DU` range hood | — |

Nothing docks `sink`. The docking graph has two parts: {corner, fridge, hood} and {sink, oven}.
The placement was right — corner point `[4815, 0, -3765]`, `posRotationY 270`; the server ran
its corner probe and sent `posGroup [4815, 0, -3504]`, `rootId corner` (the corner offset of
261 mm applied, as in the passing runs 03 and 05).

What the planner made of it (`plan.xml`, group `3868024c`, `pos [4815, 0, -3504]`, `rotationY
-90`, footprint 1210 × 1261 mm):

| Root | `articlePos` (group-local) | `rotationY` |
|---|---|---|
| corner | `[0, 0, 0]` | 0 |
| **sink** | **`[0, 0, 0]`** | 0 |
| **oven** | **`[600, 0, 0]`** | 0 |
| fridge | `[1161, 0, 661]` | -90 |
| hood | `[299, 1420, 0]` | 0 |

The sink stands on the corner article's origin, the oven 600 mm beside it — the second part of the
graph was arranged on its own from the group origin. In the images the two tall units stand in
front of the corner unit and the sink is hidden; a five-unit kitchen with a 1.2 × 1.3 m footprint.
The model's answer claims "one connected group".

### The served rule

`hi-mcp-server.ts:10` (served as the server's `instructions` and by `get-authoring-rules`):

> Docking (contextData) relates the root modules of a group to each other and is required: in a
> group with several roots, every additional root must be docked to a root that is already
> placed (undocked roots are rejected).

The living docs say the same (`minimal-hi-example/docs/hi-mcp-server.md:339`, `:560`;
`hi-mcp/hi-mcp-poc-json/README.md:356`, `:561`; `.agents/skills/hi-authoring-rules.md:107`,
`:185`, `:255`; `.agents/skills/hi-mcp-tools.md:219`).

### Investigation

**The check** — `tool-executors.ts:602-629`, run before any planner call:

```ts
if (group.roots.length > 1) {
  const dockedRootIds = new Set<string>();
  for (const root of group.roots) {
    for (const dockedContext of root?.contextData?.dockedRoots ?? []) {
      if (dockedContext?.dockedRoots?.length) {
        dockedRootIds.add(root.id);          // a root that lists another root
      }
      for (const dockedRoot of dockedContext?.dockedRoots ?? []) {
        dockedRootIds.add(dockedRoot?.id);   // a root that is listed
      }
    }
  }
  const undockedRoots = group.roots.filter((root: any) => !dockedRootIds.has(root.id));
  const undockedLimit = dockedRootIds.size === 0 ? 1 : 0;
  if (undockedRoots.length > undockedLimit) { /* "roots ... are not related by docking" */ }
}
```

A root counts as docked when it *takes part in any docking entry* — as the root that writes the
entry or as the root that is listed. It is a membership test, not a connectivity test. For run 04:
`corner`, `fridge`, `hood` are in the set through the corner's entries, `sink` and `oven` through
the sink's entry; the set holds all five roots, `undockedRoots` is empty, the payload passes.

The same test has a second hole: a listed id is added without checking that it names a root of
the group. `A -> X` with an unknown `X` makes `A` "docked"; the planner skips the entry
(`_arrangeConnectedRoots`: `roots.find` fails, `continue`) and `A`'s partner never gets a place.

**What the planner does with an unconnected part** — `HiRootModuleArrangementOperator`
(`hi-root-module-arrangement.ts`):

1. `arrangeRootModules` (`:404`) first runs `_validateAndCompleteContextData` (`:621`): every
   entry `A -> B` gets its mirror written on `B`. From here on the docking graph is undirected.
2. `_arrangePositions` (`:771`) seeds the arrangement with `_findRootClosestToZero`. Every
   article pick carries the template's `articlePos [0, 0, 0]` (`glue-logic.ts:779`
   `_prepareArticlePickRoots` keeps the template's position; the server strips authored
   positions and rejects them), so the seed is `roots[0]` — the first root the agent listed.
3. `_arrangeConnectedRoots` (`:825`) places every root reachable from the seed, breadth first.
4. `_findRemainingSeedWithPosition` (`:897`) then picks, among the unreached roots, the one with
   a position closest to zero — every unreached pick, since all carry `[0, 0, 0]` — and arranges
   *its* part from there. The loop repeats until no root is left. The `console.error` "Module …
   is not connected and has no position set" (`:815`) never fires for article picks: they all
   have a position.
5. `_applyRepositioningData` (`:414`) moves the whole group so that the anchor root's origin
   lands at `posGroup` — both parts together.

So a detached part is not dropped and not reported; it is arranged as a second kitchen whose
first root sits on the group origin, i.e. on the first root of the group. That is exactly the
symptom the check's own error message describes ("undocked roots all land at the same spot and
look like a single unit") — the check catches it only for roots with no docking entry at all.

### Root cause

`tool-executors.ts:602-629` tests whether every root appears in some docking entry. The served
rule requires that every root is docked, directly or through a chain, to a root that is placed —
that is, reachable from the group's first root over the docking graph. Two chains that never
meet, or an entry that names an id outside the group, satisfy the test and violate the rule; the
planner then arranges the detached part on the group origin, on top of the first root, without
an error.

### Proposed fix

In the validation block of `create-or-replace-groups` (`tool-executors.ts:602-629`), replace the
membership test with reachability:

1. **Adjacency**: for every entry on root `A` that lists root `B`, an undirected edge `A – B` —
   undirected because the planner mirrors every entry before arranging (step 1 above), so an entry
   written on the new root connects it too (it only loses its `offset`, as the rules say).
2. **Unknown ids**: an entry that lists an id that is not a root of the group is a validation
   error of its own ("docking on root 'A' names 'X', which is not a root of this group") instead
   of counting as a docking.
3. **Start**: the first root of the group after the generated roots are dropped (`:561`) — the
   planner's seed. The placement's `rootId` does not change the seed; it is applied to the whole
   group afterwards.
4. **Error**: the roots not reached, before any planner call, e.g.
   `posGroups[0]: roots 'sink', 'oven' are not docked to the group's placed roots ('corner',
   'fridge', 'hood') - every root must be reachable through the docking from the first root;
   roots docked only among themselves land on the group origin, on top of the first root. Dock
   every additional root to a placed root by listing it on that root, e.g. …` (keep the existing
   example).

The `undockedLimit` special case disappears: a single root is always reachable, and with several
roots every root but the first has to be reached.

The rule sentence in `hi-mcp-server.ts:10` and the docs listed above say "must be docked to a root
that is already placed"; at fix time add the words the check now enforces ("reachable through the
docking from the first root") to the rule and to the error table of `hi-mcp-tools.md`.

**Tests** (`hi-mcp/hi-mcp-poc-json/tests/tool-executors.test.ts`, `expectRejectedBeforeLoad`):

- two chains that never meet (the shape of run 04: `c -> f`, `s -> o`) are rejected, the error
  names `s` and `o` and none of the reached roots;
- an entry written on the new root only (`B` lists `A`) is accepted — the graph is undirected;
- an entry naming an unknown id is rejected with the id in the message;
- the existing tests keep passing: `rejects duplicate root ids and undocked roots` (two roots, no
  docking), the loading tests for the row, the corner kitchen (example 3) and the wall units
  (example 2), and the corner probe tests.

**Verification**: `npm run typecheck` and `npm test` in `hi-mcp`; then the prompt of run 04 through
`node .agents/scripts/run-hi-mcp-prompt.js gpt-5.4-mini "$AZURE_GPT_KEY" "<prompt>" --out …`
— every `create-or-replace-groups` that loads has one connected docking graph (evaluation commands
of `.agents/skills/hi-mcp-testing.md`), and no group has two roots at the same `articlePos`.

---

## Hardening gaps (runs 02 and 06)

In both runs the model's input broke the served rules; the server accepted it. These are the
"hardening candidates" of the report, located in the code. Each was part of PR #24 (`bc6ce15`,
"keep a straight row from docking past the corner"), which was reverted in `1e979da` after a bad
evening of corner runs; the findings document
([agent-placement-in-a-room-corner-findings.md](agent-placement-in-a-room-corner-findings.md),
§7 A1) attributes that outcome to the rule sentences of the PR and to the out-of-room hint firing
on the corner article's uncorrected first load — at the time the server did not add the corner
offset. Since `686fe94`/`3134bf3`/`91075c9` the server computes and applies the corner offset
itself (runs 03 and 05 of this session put the corner point exactly into the corner), so that
objection no longer holds.

### H1 A footprint outside the room (runs 02, 06)

**02**: four `UTB60` chained `RightBottom -> LeftBottom`, placement `posGroup [4815, 0, -3765]`,
`posRotationY 0`. The point is the back wall's `start` (the back-right corner); the rule says
`end` (`[-685, 0, -3765]`, the back-left corner) for a row that runs towards `start`. With
rotation 0 the row grows in room +x from 4815: the saved plan object is centred at x 6015 with a
width of 2420 — the whole group stands in and beyond the right wall. The model's answer says
"back-left corner".

**06**: see H3 — group `pos [4815, 120, -4665]`, 900 mm behind the back wall.

**Gap**: after the load the server reads the created groups with `position.pos`, `rotationY` and
`footprint` (`tool-executors.ts:750-766`) and returns a hint only for a group without a position
(`:770-776`). It does not compare the footprint with the room. The rooms' floor contour is in the
plan context (`rooms.rooms[].levels[0].segments`, 3D points on the floor) and `plan-space.ts` has
`footprintCornersInRoom` (`:399`) to turn a footprint into room points. PR #24 had this as
`outOfRoomHints` (a hint, not a rejection — the group is loaded; the model resubmits it or moves
it with `place-group`). A check before the load is not possible: the footprint is the planner's
arrangement, not the catalog's dimensions.

### H2 Several roots on one docking vector (run 06)

The layout docks three roots to the corner's `RightBottom` (`tb1`, `tb2`, `hb1`) and two to its
`LeftBottom` (`wb1`, `wb2`). The planner places each of them at the same spot: `tb1` and `tb2`
both at `[900, 0, 0]`, `wb1` and `wb2` both at `[-261, 0, 1261]` (saved plan, group `4ab863af`).
The same was seen on 2026-09-29 (findings document, F-S1: the oven's `RightBottom` claimed
twice).

**Gap**: nothing in `tool-executors.ts` counts the partners of a side vector. PR #24 had
`conflictingNeighbourJoints`: for the beside and back-to-back pairs (`RightBottom/LeftBottom`,
`BackBottom/BackBottom`, `BackTop/BackTop`) a vector with two different partners is a rejection;
Top → Bottom pairs were excluded because a wall unit's `LeftBottom` is legitimately claimed by
the base unit below and by the neighbour beside it. The planner never resolves the conflict, so
a rejection before the load is the right form.

### H3 A wall unit as the placement anchor (run 06)

The placement named `rootId: "hb1"` — `OFKB90`, category `Kitchen | Wall Units | Storage` — and
docked it with `corner.RightBottom -> hb1.LeftTop`, a pair the rules do not list. Two things
followed:

1. `findAnchorRoot` (`group-placement.ts:87`) walks from `rootId` down to the carrying floor unit
   and left along its row. `dockingRelations` (`:46`) reads an own `Bottom` vector against a
   foreign `Top` vector as "this root is carried by the other" — so the entry makes `hb1` the
   carrier of the corner article, and from `hb1` there is nowhere to walk. The anchor is `hb1`;
   it is no corner article, so no corner offset is applied and `posGroup` is sent raw
   (`repositioningData { posGroup [4815, 0, -3765], rootId hb1 }`, `planner-calls.json`).
2. The planner puts `hb1`'s origin — group-local `[900, -120, 0]` — on the corner point: group
   `pos [4815, 120, -4665]`; the corner article's own corner point (local `[-261, 0, 0]`) lands at
   room z −4926, 1161 mm behind the back wall.

**Gaps**: the server validates docking vector *names* (the planner resolves them to indices) but
not the *pairs*; and `rootId` may name any root, although the rules give it one purpose ("with two
corner articles in the group, set it to the corner article that goes into the corner"). The
cheapest check that would have rejected this payload is the pair check against the served list
(beside, on top, back to back) — with the caveat that the list must then be complete for what
the planner supports; the corner article's `LeftBack*`/`RightBack*` vectors are not in it. The
second is a rejection of a `rootId` that is not a corner article when the group contains one.

### Not a server gap

Run 06 also carries no attributes at all (neither walnut fronts nor a dark marble worktop) while
the answer claims both. The server cannot know what the prompt asked for; this stays a model
finding.

---

## Code and documents the fix touches

| Item | File |
|---|---|
| The validation block | `hi-mcp/hi-mcp-poc-json/tool-executors.ts:602-629` |
| Tests | `hi-mcp/hi-mcp-poc-json/tests/tool-executors.test.ts` (`create-or-replace-groups validation`) |
| The rule sentence | `hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts:10` |
| Living docs | `minimal-hi-example/docs/hi-mcp-server.md:336-342`, `:558-562`; `hi-mcp/hi-mcp-poc-json/README.md:354-360`, `:559-563`; `.agents/skills/hi-authoring-rules.md:104-112`, `:178-186`, `:252-258`; `.agents/skills/hi-mcp-tools.md:213-219` |
| Hardening H1–H3, if taken up | the same validation block and the post-load hint (`tool-executors.ts:750-777`); `plan-space.ts` for the room contour; the reverted code of PR #24 (`git show 1e979da -- hi-mcp/hi-mcp-poc-json/tool-executors.ts`) as the starting point |

## Open points

1. The tool results of the two rejected calls of run 04 are not recorded (neither the chat stream
   nor `run.json` keeps them), so which rule the model broke first is unknown. Recording the tool
   results in the run script would close this for future runs.
2. Whether the served pair list is complete for the planner (H3) has to be confirmed before a
   pair check is added.

---

## Implementation plan (2026-09-30)

Scope: the bug of run 04 — the connectivity check and the unknown-id check. The hardening items
H1–H3 are not part of this plan; they wait for the decision of the review.

**Definition of done**

1. The payload of run 04 (two docking chains that never meet) is rejected before any planner call,
   with an error that names the unreached roots (`sink`, `oven`) and the placed ones.
2. A docking entry that names an id outside the group is rejected before any planner call.
3. A root docked by an entry written on the new root (the mirrored direction) is still accepted,
   and so is a row authored in reverse order (existing test).
4. The served rule, the living docs and the error table state what the check enforces.
5. `npm run typecheck` and `npm test` in `hi-mcp` pass; the live check below shows no loaded
   group with two roots at the same `articlePos`.

### Step 1 — the check (`hi-mcp/hi-mcp-poc-json/tool-executors.ts`)

Replace the block `if (group.roots.length > 1) { … }` (`:602-629`) by a call to a module-level
helper, shaped like `placementErrors` (`:252`): it returns messages without the
`posGroups[i]` prefix and the executor maps the prefix on.

```ts
validationErrors.push(
  ...dockingErrors(group.roots).map((error) => `posGroups[${groupIndex}]${error}`),
);
```

`dockingErrors(roots)`:

1. `rootIds` = the ids of `roots` (built here, independent of the duplicate-id check above).
2. Walk every entry `A.contextData.dockedRoots[].dockedRoots[]`:
   - an entry whose `id` is not in `rootIds` (including a missing id) adds
     `: the docking on root 'A' names 'X', which is not a root of this group` and is skipped;
   - every other entry adds the undirected edge `A – B` to a `Map<string, Set<string>>`.
3. Breadth-first search from `roots[0].id` over the map; `reached` is the set of visited ids.
4. Every root not in `reached` is unreached. With unreached roots, add one message:
   `: roots 'sink', 'oven' are not docked to a placed root ('corner', 'fridge', 'hood' are placed
   - reached through the docking from the first root); roots docked only among themselves land on
   the group origin, on top of the first root. Dock every additional root to a placed root by
   listing it on that root, e.g. to place root B directly right of root A: { "id": "A", … }` —
   the JSON example is the one of the current message.

Why undirected and why from the first root: the planner mirrors every entry before it arranges
(`_validateAndCompleteContextData`) and seeds the arrangement with `roots[0]`; and since the
check requires *all* roots in one component, the start root changes only which roots the message
names, never whether the payload passes. The helper runs for every group, also with one root —
the reachability part is then trivially satisfied and the unknown-id check still applies. The
`undockedLimit` special case goes away.

### Step 2 — the served rule (`hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts:10`)

Replace "in a group with several roots, every additional root must be docked to a root that is
already placed (undocked roots are rejected)" by "in a group with several roots, every additional
root must be docked, directly or through a chain, to the first root of the group — a root the
docking does not connect to the first root is rejected, and so is a docking that names a root
outside the group (roots docked only among themselves would land on the group origin)". The rest
of the bullet (where to write the entry, the mirrored entry, chains) stays.

### Step 3 — unit tests (`hi-mcp/hi-mcp-poc-json/tests/tool-executors.test.ts`)

In `describe('create-or-replace-groups validation')`, with `expectRejectedBeforeLoad` (it also
asserts that `loadExternalObjectGroupLayout` was not called):

| Test | Payload | Expectation |
|---|---|---|
| `rejects duplicate root ids and undocked roots` (existing) | `u1`, `u2`, no docking | regex updated to `/roots 'u2' are not docked to a placed root/` |
| `rejects roots docked only among themselves` (new, the shape of run 04) | `c -> f` (`RightBottom -> LeftBottom`), `s -> o`, four roots | `/roots 's', 'o' are not docked to a placed root \('c', 'f' are placed/` |
| `rejects a docking that names a root outside the group` (new) | `u1 -> u2` and `u1 -> u9`, roots `u1`, `u2` | `/docking on root 'u1' names 'u9', which is not a root of this group/` |

In `describe('create-or-replace-groups loading')`, with `createApi(planContextFixture)`:

| Test | Payload | Expectation |
|---|---|---|
| `accepts a root docked by an entry written on the new root` (new) | `u1` without docking, `u2` lists `u1` (`LeftBottom -> RightBottom`) | `loadExternalObjectGroupLayout` called once with both roots, no error |

Existing tests that must keep passing unchanged: `positions a new row by its leftmost root in one
load, whatever order it is authored in` (reverse-ordered chain — the undirected walk from `u3`
reaches `u1`), `positions a new corner kitchen by the corner article in one load` (example 3),
`loads article picks only, with docking stripped to vector names`, and the corner probe tests
(the probe loads its single-root group directly, not through the validation).

### Step 4 — living docs

| File | Change |
|---|---|
| `minimal-hi-example/docs/hi-mcp-server.md:339`, `hi-mcp/hi-mcp-poc-json/README.md:356` | "undocked roots in a multi-root group" → "roots the docking does not connect to the first root, a docking that names a root outside the group" |
| `minimal-hi-example/docs/hi-mcp-server.md:558-562`, `hi-mcp/hi-mcp-poc-json/README.md:559-563` | the docking bullet mirrors the rule text of step 2 |
| `.agents/skills/hi-authoring-rules.md:107`, `:185`, `:255` | "No undocked roots (except first)" → "Every root connected to the first root through the docking (either direction)"; the rejected list gains "a docking that names a root outside the group" |
| `.agents/skills/hi-mcp-tools.md:219` | the error row: `roots … are not docked to a placed root` — cause: a root or chain the docking does not connect to the first root — fix: dock it to a placed root; a new row for `names '…', which is not a root of this group` |
| this document | close-out: status `Fixed`, sections in past tense, fix summary and validation results |

### Step 5 — verification

1. `cd hi-mcp && npm run typecheck && npm test`.
2. Live, with the run script of the testing skill (`gpt-5.4-mini`, `$AZURE_GPT_KEY`):
   the prompt of run 04, "plan a kitchen with an oven, a range hood, a sink and a fridge in the
   back right corner of the room". Evaluate with the commands of `.agents/skills/hi-mcp-testing.md`:
   every `loadExternalObjectGroupLayout` in `planner-calls.json` carries one connected docking
   graph, and in the saved plan (the node one-liner at the top of this document) no two roots
   share an `articlePos`. The prompt of run 05 (a passing corner kitchen) as the regression check
   of the corner path.

### Step 6 — commits (conventional, no amend)

1. `fix: reject roots the docking does not connect to the first root` — the helper, the rule
   text, the tests.
2. `docs: describe the docking connectivity check` — the living docs and the close-out of this
   analysis.

### Considered and rejected

- **Directed reachability** (only entries written on the placed root count): would reject
  payloads the planner arranges correctly — an entry on the new root, a row authored from its
  right end — because the planner mirrors the entries first.
- **A check after the load** (two roots at the same position): the plan context carries no root
  positions, and the group would already be in the plan.
- **The check in the planner** (roomle-ui refusing an unconnected group): the rule is served by
  the MCP server and promises a rejection before anything is loaded; the planner deliberately
  arranges what it is given (findings F-P1).
- **Seeding from the placement anchor** (`findAnchorRoot`) instead of `roots[0]`: no effect on
  acceptance (one component is required either way) and one dependency more; the planner's own
  seed is `roots[0]`.

### Amendment: ids outside the group

Found while implementing: the planner's own groups carry docking entries that name roots no
longer in the group. In the stored plan contexts of this test session:

| Run | After | Group roots | Entry naming a root that is gone |
|---|---|---|---|
| 09 | `delete-root-module` of the middle unit | `35bda1c9` | `RightBottom -> 2091bc43` (the deleted unit) |
| 09 | the same | `9f32378d` | `LeftBottom -> 2091bc43` |
| 12 | `merge-groups` of the two remaining units | `b4ac6768`, `38b85ae7` | both to `74de77c9` (the deleted unit) |

The rules tell the agent to resubmit a group from `get-plan-context` as it is, so step 1.2 of the
plan (reject such an entry) would have rejected the planner's own output after every delete. The
check therefore treats such an entry as no edge. The harmful case stays covered: a root whose only
docking names an id outside the group is unreached and rejected — the merged group of run 12 is
exactly that (both roots dock only to the deleted unit; resubmitted today, the second unit would
land on the first, because root positions never travel to the planner).

The tests follow the amendment: `does not count a docking to a root outside the group as
connecting` (the run 12 shape, rejected) replaces the planned unknown-id rejection, and `accepts a
group resubmitted with a docking to a root deleted from it` (the run 09 shape, loaded) is added.

**A second finding, not fixed here**: the stale entry also makes the planner report the side as
taken — in run 09, `35bda1c9` has no `RightBottom` in `freeDockingVectors` although nothing is
docked there any more, so `merge-article-into-group` on that side would be refused. The entries
come from roomle-ui's delete of a root module, which does not remove the references to the deleted
root from its neighbours. Recorded for a separate analysis.

## Live verification (2026-09-30 17:48)

"test the mcp" on `c32f38d` (gpt-5.4-mini, planner `bo-test`), report
`.temp/result/mcp-test-2026-09-30_17-48-25/report.md`: 9 pass, 1 partial, 3 fail, 1 bug.

| Check | Result |
|---|---|
| Every loaded layout has one connected docking graph | yes — 13 layout loads in 13 runs, plus 4 single-root corner probes |
| No root stacked on the group origin by a detached part | yes — the only shared position (07, setup) comes from two roots docked to one vector (H2), in a connected graph |
| Run 04 of the previous session | not reproduced; the model sent a connected layout on its first call, so the new rejection was not exercised there |
| Rejections before any planner call | 05 (1), 07 (3), 10 (1), 12 (1); the rejection texts are not recorded (open point 1); in 05 the model reports "invalid docking structure" and corrected it |

**The gap the amendment left open (run 06)**: the model sent a new group with one root whose
docking entries name `hob1` and `back1` — no docking vector, and no roots of that name in the
group (the other units were most likely nested in the entries, which the server reduces to id,
vector, mode and offset). The check accepted it (one root, trivially reached), the planner loaded
the corner unit alone, the rest of the kitchen was dropped without an error. The plan's original
step 1.2 would have rejected this payload. The stale entries that made the amendment necessary
exist only in groups already in the plan (runs 09 and 12 again), so the rejection can be restored
for **new** groups — a group whose id is not in the plan — after the pre-context is read
(`beforeGroupIds`, where the existing-group placement check already runs). Proposed, not
implemented.

**A new bug, not related to this fix (run 04)**: the served corner rules ("right back 270 -
RightBottom along the right wall, LeftBottom along the back wall") fit corner articles whose corner
point lies on their left (`UERTB90`, `EUERTB90`: root-local x −261). For `UELTB90` the probe
gave the corner point at x 1161 (its right end); the server put that point into the corner and the
rule's rotation 270 turned the whole kitchen behind the back wall. The catalog descriptions do not
tell the two apart (`EUERTB90` says "direction right" with its corner on the left). To be analysed
separately.
