# Feature Analysis: Group placement computed in the MCP server (RML-18007, Task 1)

> **Type**: Feature Analysis
> **Domain**: hi-mcp — the MCP server's agent-facing text and the `create-or-replace-groups` / `get-plan-context` executors (`hi-mcp/hi-mcp-poc-json`); verified against the arrangement and plan-context code of roomle-ui `homag-intelligence`
> **Trigger**: Jira [RML-18007](https://roomle.atlassian.net/browse/RML-18007), Task 1 — the agent must neither set nor know `repositioningData`; it sets the group's placement (`posGroup`, `posRotationY`, optionally a root to start from), the MCP server finds the anchor root by following the docking and applies the corner article's corner point offset itself
> **Date**: 2026-09-30
> **Author**: AI Assistant
> **Status**: Open

> **Scope — Task 1 defines the position of NEW groups, nothing else.**
> A group gets its position once, in the `create-or-replace-groups` call that creates it, and that
> position must be right in that one load. Task 1 does **not** move, reposition or reload any
> group: no second load, no correction after the load, no placement on a group that already
> exists in the plan. **Moving or repositioning a group is Task 2**
> ([reintroduce-place-group-tool-in-the-server.md](reintroduce-place-group-tool-in-the-server.md)).
> Resubmitting an existing group without a placement (to modify or extend it) keeps working
> exactly as today — it keeps its position and is not touched by Task 1.

---

## What was asked and why

The ticket states that positioning in the HI MCP is unstable because the positioning system is
too complex: setting up `repositioningData` on a `PosGroup` is unmanageable for many models. The
findings of 2026-09-29/30 ([agent-placement-in-a-room-corner-findings.md](../bug-analysis/agent-placement-in-a-room-corner-findings.md), §8)
reached the same conclusion and opened the backlog item "make group positioning easier for the
agent" ([backlog](../backlog/README.md)).

Task 1 asks for:

1. The agent sets only the group's placement: `posGroup` and `posRotationY` — the position of
   the farthest left and back point of the group, and its rotation. Optionally a `root` to start
   the anchor search from.
2. The MCP server acts as middleware: it finds the farthest left root module by starting with the
   first root (or the given one) and following the docking, and builds the `repositioningData`
   the planner needs from that.
3. All information about `repositioningData` disappears from the agent-facing text. Information
   about the position and rotation of groups stays.
4. The agent receives no information about the corner point offset of a corner article
   (roomle-ui `calculatedCornerPointsByRoot`); the MCP server applies that offset to the group
   position.

## How it works today

### The agent authors `repositioningData`

- `create-or-replace-groups` validates `repositioningData { posGroup, posRotationY, rootId, rootRelPos? }`
  ([tool-executors.ts:245-279](../../hi-mcp/hi-mcp-poc-json/tool-executors.ts)), keeps it in the
  payload whitelist (`:293`) and hints at it for an unpositioned group (`:342-345`). A stale
  `placement` is rejected with a pointer to `repositioningData` (`:239-243`).
- The authoring rules ([hi-mcp-server.ts:6-59](../../hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts))
  teach it in five rules and three examples: the `repositioningData` rule (`:26`, anchor =
  "the root the docking starts from, listed first; in a row its leftmost unit"), the corner article
  rule (`:27`, `rootRelPos` = the negated catalog `cornerPoint`, plus "verify the first load and
  correct it"), the wall rule (`:28`), the corner table (`:29`) and the verify rule (`:32`, "for a
  corner-anchored group, pos IS the corner point"). `INSTRUCTIONS` (`:64-72`) and the
  `create-or-replace-groups` description (`:166-197`) repeat it; the `get-plan-context`
  description (`:105`) advertises `cornerPoint`.
- The docs mirror it: [hi-mcp-server.md](../../minimal-hi-example/docs/hi-mcp-server.md)
  ("create-or-replace-groups", "Authoring pos groups", "Positioning a group"), the PoC README,
  the skills `hi-mcp-tools.md`, `hi-authoring-rules.md`, `roomle-hi-concepts.md`, `AGENTS.md`
  (`:177`, `:182`) and `.github/copilot-instructions.md` (`:36`, `:81`, `:93`, `:100-101`).

### What the planner does with it (roomle-ui)

- `_applyRepositioningData` (`hi-root-module-arrangement.ts:414-447`): the root `rootId` receives
  the world transform `T(posGroup, posRotationY) · T(rootRelPos, rootRelRotationY)`, and the group
  transform follows as `G = T · R_root⁻¹`. Two consequences that the design below relies on:
  - the anchor's **world rotation is always `posRotationY`**, whatever its rotation inside the
    group is (a root turned by 90° in the group turns the whole group by −90° in the room), and
  - the anchor's **origin** (its left back bottom corner) lands at `posGroup + R(posRotationY) · rootRelPos`.
- The arrangement seeds at `roots[0]` when no authored root carries a position
  (`_findRootClosestToZero`, `:929-941`), puts it at `[0, 0, 0]` with rotation 0 and places every
  other root breadth-first along the docking (`_arrangeConnectedRoots`, `:825`). A root docked to
  a `LeftBottom` gets a negative x; a root docked to a corner article's `LeftBottom` arm is turned
  by 90° (findings F-P1, S3).
- The corner point of a corner article is the shared start of its `LeftBack*`/`RightBack*`
  vectors, root-local (`cornerPointOfRoot`, `hi-plan-context.ts:280`); Furniture_Smith:
  `[-261, 0, 0]`. The compacted article carries it as `cornerPoint` only when the template's
  `dockInfos` have it or a calculated root of the article is in the plan
  (`calculatedCornerPointsByRoot` `:506`, `compactArticle` `:592-610`). Furniture_Smith templates
  carry no `dockInfos`, so **an empty plan has no `cornerPoint`** (findings F-C1).

### What the agent reads back

- `get-plan-context` is a pass-through ([tool-executors.ts:106-112](../../hi-mcp/hi-mcp-poc-json/tool-executors.ts)):
  articles with `cornerArticle` and `cornerPoint`, groups with `position { pos, rotationY, footprint }`
  and roots without positions (`shapeGroup`, `hi-plan-context.ts:643`).
- Whether `position.pos` of a returned group is the seed root's origin or the corner of the
  docking-vector box differs between loads (findings F-P4, F-C4), so the verify rule's premise is
  not reliable.

## The gap

Everything the agent has to add on top of "this point, this rotation" is deterministic given the
payload and the catalog: which root is the anchor (follow the docking), what `posGroup` means for
that root (its origin) and the corner offset (the catalog `cornerPoint`, negated, root-local). The
findings show that models fail
exactly on these steps (S1/S2 anchored the last-named unit and chained the row into the wall, S3
stood 261 mm inside the wall). ADR 0001 already places tool logic in the server; the positioning
arithmetic is tool logic.

## Proposed design

### Agent-facing payload

```json
{ "id?": "...", "libraryId?": "...",
  "placement": { "posGroup": [x, y, z], "posRotationY": 0, "rootId?": "u1" },
  "roots": [ ... ] }
```

**The agent specifies exactly two things about the position of a group: the room point of the
group's back left corner and the group's rotation.** Nothing else — no anchor, no offset, no
root-local correction.

- `posGroup` — the room point where the group's back left bottom corner goes, in millimetres
  (y = 0 on the floor; for a group of wall units only, the mounting height). Against a wall: the
  wall's `end` puts the group flush into the corner at the wall's end; a point from `end` towards
  `start` shifts it along the wall. In a corner: the corner point.
- `posRotationY` — unchanged: degrees, counter-clockwise as seen from above; against a wall the
  wall's `facingRotationY`.

**How the position and the rotation are explained to the agent is not new.** The rules already
explain both for walls and corners, and that text is kept with `placement` in place of
`repositioningData`:

| Existing text ([hi-mcp-server.ts](../../hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts)) | Kept as |
|---|---|
| The wall rule (`:28`): walls of type `wall`, `posRotationY` = the wall's `facingRotationY`, `posGroup` = `end` flush into the corner at the wall's end, `end + d · (start − end) / lengthMm` along the wall, centred and right-end variants, the group width from the catalog dimensions, "a room corner is the point two walls share", free points anywhere else | The explanation of `posGroup`/`posRotationY` for walls, unchanged |
| The corner table (`:29`): left back 0, left front 90, right front 180, right back 270 with the `RightBottom`/`LeftBottom` rows along the two walls; straight walls back 0, left 90, front 180, right 270 | The explanation of the rotation in corners, unchanged (it describes the group, not the anchor) |
| Example 1 (row along the right wall from the back right corner: `posGroup` = the right wall's `end`, `posRotationY` 270), example 3 (L in the back right corner: `posGroup` = the corner point, 270), example 4 (row centred on the back wall: 0 and the `d` formula) | The same examples with `placement`; example 3 without `rootRelPos` and the 261 mm sentence, example 1 without "u1 is the anchor" |
| The `get-plan-context` description: `facingRotationY` is "the posRotationY of a group standing with its back against that wall" | Unchanged |
| Docs: "Positioning a group" in `hi-mcp-server.md` with the wall table and the rectangular-room table | Unchanged apart from the field name; the "Corner offset" and "Anchor" bullets go |

What goes is only what explained the anchor and the offset: "rootId is the anchor … listed first
… in a row its leftmost unit", the corner article / `rootRelPos` rule, and the verify-and-correct
sentence.
- `rootId` (the ticket's `root`, optional) — the root the anchor search starts from; default the
  first root. Named `rootId` because it holds a root's `id`, like `rootId` did.
- **New groups only.** A `placement` is accepted only on a group the call creates. A group whose
  `id` matches a group already in the plan and that carries a `placement` is rejected before
  anything loads. This guard is what keeps Task 1 out of Task 2: without it the planner would
  re-apply the position on the replace and move the group. A replace without `placement` is
  unchanged.
- `repositioningData` in an input payload is rejected with a pointer to `placement` (stale agent
  contexts), exactly as `placement { wall, alignment }` is rejected today; a `placement` that
  carries `wall` gets the same treatment.
- The name `placement` is the ticket's word ("the group's placement, consisting of posGroup and
  posRotationY"); the alternative `position` is discussed below (A3).

### Server: deriving `repositioningData` (new module `group-placement.ts`)

`toRepositioningData(group, placement, articles)`:

1. **Start root** — `placement.rootId` if given (must be a root of the group, else a validation
   error), otherwise the first non-generated root.
2. **Step down to the floor** — while the current root is the docked root of an entry whose
   `ownDockingVector` ends in `Top` (`LeftTop/RightTop/BackTop → *Bottom`, a wall unit or worktop
   on a unit), move to the carrying root. A wall unit is never the anchor: its origin at
   `posGroup` with y = 0 would put the base units below the floor.
3. **Collect the row** — from there follow the side pairs in both directions:
   L is left of R when L's entry `RightBottom → R.LeftBottom` names R, or R's entry
   `LeftBottom → L.RightBottom` names L. Only `LeftBottom`/`RightBottom` pairs are followed; Top
   pairs (stacked units) and Back pairs (a back-to-back partner, turned 180°) are not. A visited
   set guards against cycles.
4. **Anchor** — a corner article in the row (catalog `cornerArticle`) is the anchor. Otherwise the
   left end of the row is: the root with no left neighbour. Reason for the corner article rule: its
   `LeftBottom` arm is turned 90°, so "left of the corner article" runs along the second wall, away
   from the group's left back point; the ticket's own definition of `posGroup` — the farthest left
   and back point of the group — is the corner point of an L. Following the docking from any root
   of the L (c1, r1, r2, l1 or l2 in the rules' example 3) reaches c1.
5. **Corner offset — server only.** When the anchor's article has a `cornerPoint` other than
   `[0, 0, 0]`, `rootRelPos = −cornerPoint` (root-local, rotated by the planner). The articles are
   fetched anyway for the article id check (`validateArticlePickIds`, `tool-executors.ts:70-100`);
   one fetch serves both. **The offset of a corner module is nothing the agent has to care about
   and nothing the agent knows about.** It is handled entirely inside the tool implementation:
   the agent gives the room corner point as `posGroup`, and the corner module's corner point lands
   there. No rule, description, hint, error, example or document tells the agent that such an
   offset exists — see the hard rule under [Agent-facing text](#agent-facing-text).
6. **Result** — `repositioningData = { posGroup, posRotationY, rootId: anchor.id, rootRelPos? }`
   replaces `placement` in the payload. The whitelist (`id`, `libraryId`, `roots`,
   `repositioningData`) is unchanged; the page and the planner see exactly what they see today.

The anchor's rotation inside the group does not matter (`G = T · R_root⁻¹`), so the seed root of
the arrangement may be any root — the agent no longer has to list the anchor first.

### Open prerequisite: corner data on an empty plan

The anchor walk needs the catalog's `cornerArticle` flag and the offset needs its `cornerPoint`,
both **before** the one load. On an empty plan the catalog has neither for Furniture_Smith: the
templates carry no `dockInfos`, so `dockingVectors` is empty, `cornerArticle` (derived from the
vector names, `hi-plan-context.ts:560-580`, `:606-608`) is false and `cornerPoint` is missing
(findings F-C1). The first corner kitchen of an empty plan can therefore not be positioned
correctly by the MCP server alone.

A correction after the load (load, read the offset, load again) is **not** an option: it
repositions a group, which is Task 2, and the position must be right in the creating call. The
data has to exist before the load — a roomle-ui change (see A2). Decision pending.

### `get-plan-context`

The executor strips `cornerPoint` from the articles before returning them; the planner keeps
computing it because the server needs it. `cornerArticle` stays — the agent still has to pick a
corner article for a corner.

### Agent-facing text

**Hard rule: `repositioningData` is an internal detail between the server and the planner and is
not mentioned anywhere the agent can read.** That covers the server `instructions`, the
`get-authoring-rules` text, every tool description and parameter description, every hint and
error message the tools return, the `get-plan-context` output, and the documentation an agent may
be given as context (`minimal-hi-example/docs/hi-mcp-server.md`, the PoC README and QUICKSTART, the
skills, `AGENTS.md`, `.github/copilot-instructions.md`). The same holds for `rootRelPos` and
`cornerPoint`. The only exception is the validation error for a payload that itself carries
`repositioningData` (a stale agent context): it echoes the agent's own field name and points to
`placement` — the word appears only because the agent used it. The guard test below enforces the
rule for the served text; the docs are checked by a grep at close-out.

- Remove from `AUTHORING_RULES`: the `repositioningData` rule (`:26`), the corner article /
  `rootRelPos` rule (`:27`), the verify rule's "pos IS the corner point … shift `posGroup` by the
  delta" part (`:32`); replace them with one placement rule (draft):

  > `placement: { posGroup: [x, y, z], posRotationY, rootId? }` positions a new group: `posGroup`
  > is the room point of the group's left back bottom point — against a wall the wall's `end`
  > (flush into the corner at the wall's end) or a point from `end` towards `start`; in a room
  > corner the corner point — and `posRotationY` the rotation in degrees, counter-clockwise as
  > seen from above: the wall's `facingRotationY`. Applied once when the group loads; groups
  > returned by `get-plan-context` never carry this field.

  The draft deliberately says nothing about how the server anchors the group, about corner
  modules having a corner point that differs from their origin, or about offsets: from the
  agent's point of view the group's back left corner goes to `posGroup`, full stop.

  The wall rule (`:28`, the `end + d · (start − end) / lengthMm` arithmetic) and the corner table
  (`:29`) stay — they describe `posGroup`/`posRotationY`, not `repositioningData`. Examples 1, 3
  and 4 carry `placement`; example 3 loses `rootRelPos` and the 261 mm sentence.
- `INSTRUCTIONS` step 2, the `create-or-replace-groups` description, the `get-plan-context`
  description (no `cornerPoint`), the unpositioned-group hint.
- The moving text — `INSTRUCTIONS` step 3 and the rule "To move an existing group … a new
  repositioningData" — is removed, because it names `repositioningData` and moving is not Task 1.
  Task 2 brings moving back. Until then the server offers no way to move a group.
- Docs and skills listed under [Code and documents touched](#code-and-documents-touched).

### Tests

- `group-placement.test.ts` (new): straight row, start = first root → itself; start at the right
  end → the leftmost; start on a wall unit → steps down, then left; L with a corner article,
  start at each of c1, r1, l1, l2 → c1, `rootRelPos [261, 0, 0]`; corner article without
  `cornerPoint` → no `rootRelPos`; a cycle in the docking terminates; an unknown `rootId` is
  reported.
- `tool-executors.test.ts`: `placement` reaches the planner as `repositioningData` of the derived
  anchor in exactly one load; `repositioningData` in the input is rejected; `placement.wall` is
  rejected; a `placement` on a group whose id is in the plan is rejected; `cornerPoint` is absent
  from the returned articles; the hint names `placement`. Adapt `rejects a placement and points to
  repositioningData`, `rejects invalid repositioningData`, `passes repositioningData through …`,
  `hints at repositioningData …`; remove `moves an existing group …` (moving is Task 2).
- `hi-mcp-server.test.ts`: the served instructions, the rules text and every tool description
  contain neither `repositioningData` nor `rootRelPos` nor `cornerPoint` (a guard against the text
  creeping back); the unpositioned-group hint and the rejection of `placement.wall` name
  `placement` only.
- Live verification: the two prompts of the findings (P1 straight row, P2 corner article) on an
  empty plan, with the chat window (`gpt-5.4-mini`, `mistral-large-latest`) — the row along the
  right wall from the corner, the L flush in the corner, snapshot checked as in the findings.

## Alternatives considered

| # | Alternative | Why rejected |
|---|---|---|
| A1 | Anchor mode in the glue logic (`repositioningData.rootAnchor: 'cornerPoint'`, S3 of the [corner point analysis](../bug-analysis/corner-article-corner-point-offset-from-root-origin.md)) | Needs the roomle-ui PR train; the server can do it with data it already receives. Remains an option if the server-side derivation proves insufficient |
| A2 | The catalog in roomle-ui carries `dockingVectors`, `cornerArticle` and `cornerPoint` also for articles without a calculated root, so that an empty plan has them | **Not rejected — the open prerequisite** (see [Open prerequisite](#open-prerequisite-corner-data-on-an-empty-plan)). An earlier version of this analysis called it an optional follow-up and put a correction load after the creation instead; that was wrong, because the correction repositions a group (Task 2) |
| A3 | Reuse the read-only `position { pos, rotationY }` of a returned group as the input (resubmit with an edited `pos`) | Mirrors the output, but `pos` (the group box corner, F-P4) and the ticket's `posGroup` (the anchor's origin) differ in meaning, the ticket names `posGroup`/`posRotationY`, and the server rejects `pos`/`rotationY` on a group today for good reason |
| A4 | Find the leftmost root by geometry after the load (minimum x) instead of by docking | Needs the raw geometry (`getExternalObjectGroups`, not exposed to the server) or a second load for every group; the docking walk is deterministic before the load |
| A5 | Anchor = always `roots[0]`, as the rules demand today | The models did not list the anchor first reliably (S1/S2 anchored the fridge, the last-named unit); the ticket wants the server to find it |

## Risks and open points

- **Row detection follows side pairs only.** A group whose floor units are related by Back pairs
  only (an island of two back-to-back rows) has two rows; the walk stays in the start root's row and
  anchors its left end — the front row when the agent lists a front unit first. Acceptable: the
  agent chooses `rootId`, and a back-to-back partner (turned 180°) is never the anchor.
- **Wall units only** (no floor unit): the step-down finds nothing, the leftmost wall unit is the
  anchor, `posGroup` y is the mounting height — as today.
- **Stale agent contexts** keep sending `repositioningData`; the rejection points to `placement`.
- **No page change**: the planner methods stay the same, so the example page, the reference bridge
  and the ligna-store copy are untouched. The deployed server must be updated
  ([hi-mcp-cloudflare-deployment.md](../skills/hi-mcp-cloudflare-deployment.md)).
- **No moving until Task 2.** Task 1 removes today's way of moving a group (resubmit with a new
  `repositioningData`) and adds none; Task 2
  ([reintroduce-place-group-tool-in-the-server.md](reintroduce-place-group-tool-in-the-server.md))
  brings moving back and builds on `toRepositioningData`.
- **Empty-plan corner kitchen** depends on the open prerequisite above.

## Code and documents touched

| File | Change |
|---|---|
| `hi-mcp/hi-mcp-poc-json/group-placement.ts` | New: `toRepositioningData` (start root, step down, row walk, corner article rule, corner offset) |
| `hi-mcp/hi-mcp-poc-json/tool-executors.ts` | `create-or-replace-groups`: validate `placement`, reject `repositioningData`, `placement.wall` and a placement on an existing group, derive `repositioningData` before the one load, hint text; `get-plan-context`: strip `cornerPoint` from the articles |
| `hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts` | `AUTHORING_RULES`, `INSTRUCTIONS`, descriptions of `create-or-replace-groups` and `get-plan-context` |
| `hi-mcp/hi-mcp-poc-json/tests/` | `group-placement.test.ts` (new), `tool-executors.test.ts`, `hi-mcp-server.test.ts` |
| `minimal-hi-example/docs/hi-mcp-server.md`, `hi-mcp/hi-mcp-poc-json/README.md`, `QUICKSTART.md:55` | Tool reference, "Authoring pos groups", "Positioning a group", demo walkthrough, example prompts — `placement` instead of `repositioningData`, no corner offset arithmetic |
| `.agents/skills/hi-mcp-tools.md`, `hi-authoring-rules.md`, `roomle-hi-concepts.md`, `hi-mcp-server.md` | Same |
| `AGENTS.md:177,182`, `.github/copilot-instructions.md:36,81,93,100-101`, `minimal-hi-example/docs/hi-mcp-poc-presentation.md:76` | Same |
| `.agents/backlog/README.md` | The entry leaves the backlog at close-out |
| Not touched | Pages and bridges (`minimal-hi-example/index.html`, `hi-mcp-poc-json-client/`, ligna-store), roomle-ui, RoomleCore |

---

## Implementation plan (2026-09-30)

> **Progress (2026-09-30)**: commits 1–4 of §7 are implemented on the branch, with P1, P3 and P4
> applied as recommended: `group-placement.ts` with 19 tests; `create-or-replace-groups` with the
> placement input, the rejections and the rewritten agent text, guarded by a test of the served
> text; `get-plan-context` without `cornerPoint`; the documentation. `npx vitest run`: 96 tests
> pass (the pre-existing `cf` load failure is unchanged); typecheck clean. Every create is one
> load. Not done: the live verification (§8.2, §8.3) and the close-out (commit 5); P0 is still
> open, so the first corner kitchen of an empty plan is anchored at the left end of its row.
>
> **Live run (2026-09-30), failed** — "Plan a kitchen in the back right corner of the room",
> snapshot `ps_qid6jsck322rq3g2stszoxzue4uwnxw`, empty plan: the kitchen stood turned by 90°
> with its corner mid-wall (group `pos [4554, 0, -1604]`, `rotationY 180`). Reconstructed from
> the stored transform: the agent sent the correct corner point `[4815, 0, -3765]` with 270; the
> server anchored `l2`, the far end of the corner article's left arm (local rotation 90), because
> `isCornerArticle` read only the catalog flag, which is false on an empty plan (P0). An earlier
> reading of this run blamed the agent's rotation; that was wrong. **Fixed**: a corner article is
> also recognised by its category ("… | Base Units | Corner") or module name
> (`mr_CornerunitStraight`), in the anchor walk and in the `cornerArticle` flag `get-plan-context`
> returns; regression test with the snapshot's L.
>
> **Live run (2026-09-30)** — "plan a kitchen with an oven, a sink and a fridge in the back right
> corner", snapshot `ps_qig8umdjdt1k2rl5nten51kyiuzlt19`: correct corner and rotation, the corner
> point 261 mm inside the back wall — no `rootRelPos`. Checked live against the running server: the
> deployed UI returns `cornerPoint: null` for `EUERTB90` even with a calculated root in the plan
> (finding F-C2 was wrong; the compact catalog carries vector names only). **Fixed**: the server
> computes the corner point itself from the docking vectors of a calculated root of the article,
> read from the planner's raw groups (`getExternalObjectGroups`, added to the planner API and the
> page allow-lists), rotates its negation by `posRotationY` and adds it to `posGroup` when it derives
> `repositioningData` (decided 2026-09-30: no `rootRelPos`, the planner gets the anchor origin's room
> point). Still open:
> the very first corner article of an empty plan has no calculated root anywhere, so that one
> kitchen keeps the 261 mm offset until the geometry exists before the load (P0).

> **Status**: proposed, awaiting review (step 5 of the suggested change workflow) — no code before
> it is approved.
> **Scope**: the position of **new** groups only, set in the one load that creates them. Nothing in
> this plan moves, repositions or reloads a group; moving is Task 2.
> **Branch**: `refactor/hi-mcp-group-positioning-RML-18007`.
> **Baseline**: `cd hi-mcp && npx vitest run` — 72 tests pass in 6 files;
> `cf/tests/worker.test.ts` fails to load (`@cloudflare/containers` not installed locally,
> pre-existing, unrelated); `npm run typecheck` clean.

### 0. Prerequisite (open)

The corner data on an empty plan — see
[Open prerequisite](#open-prerequisite-corner-data-on-an-empty-plan). Everything below works as
soon as the catalog carries `cornerArticle` and `cornerPoint`; on an empty plan without them the
first corner kitchen is anchored at the wrong unit. Not part of this plan until decided.

### 1. New module `hi-mcp/hi-mcp-poc-json/group-placement.ts`

Pure functions, no planner calls:

```ts
export interface Placement {
  posGroup: [number, number, number];
  posRotationY: number;
  rootId?: string;
}
// articleId (+ libraryId) lookup, moved here from validateArticlePickIds
export const catalogArticleOf = (articles: any[], root: any): any | undefined;
export const findAnchorRoot = (
  roots: any[],
  startRootId: string | undefined,
  isCornerArticle: (root: any) => boolean,
): any;
export const toRepositioningData = (
  roots: any[],
  placement: Placement,
  articles: any[],
): { posGroup; posRotationY; rootId; rootRelPos? };
```

**Docking relations** are read from every `contextData` entry, in both directions (the planner
completes reciprocal entries). Ids that name no root of the group (the dropped generated roots)
are ignored.

| Entry on root A: `ownDockingVector → dockingVector` of B | Relation |
|---|---|
| own ends in `Top`, B's ends in `Bottom` | A carries B (wall unit, worktop) |
| own ends in `Bottom`, B's ends in `Top` | B carries A |
| `RightBottom → LeftBottom` | B is right of A |
| `LeftBottom → RightBottom` | B is left of A |
| anything else (`BackBottom → BackBottom`, `BackTop → BackTop`) | not followed |

**`findAnchorRoot`**, one visited set for the whole walk:

1. Current = the start root: `placement.rootId`, else the first root.
2. Repeat: carried by an unvisited root → go to the carrier; else a corner article → return it;
   else an unvisited root left of it → go there; else stop.
3. At the left end of a floor row without a corner article: walk right along that row; the first
   corner article met is the anchor (a start on the outer arm of an L). Otherwise the left end is
   the anchor.

**`toRepositioningData`** returns `{ posGroup, posRotationY, rootId: anchor.id }`, plus
`rootRelPos` = the negated `cornerPoint` of the anchor's catalog article when it has one other
than `[0, 0, 0]` (`+ 0` so that no `-0` travels).

### 2. `create-or-replace-groups` (`tool-executors.ts`)

**Validation**, before the load — replaces the `placement` rejection (`:239-243`) and the
`repositioningData` checks (`:245-279`):

| Input | Error |
|---|---|
| `repositioningData` on a group | `posGroups[i]: repositioningData is not supported - position the group with placement { posGroup, posRotationY }` (echoes the agent's own field, the one exception of the hard rule) |
| `placement` not a plain object | `posGroups[i]: placement must be { posGroup, posRotationY, rootId? }` |
| unknown keys in `placement` (stale `wall`, `alignment`, `offsetMm`, `rootRelPos`) | `posGroups[i].placement takes only posGroup, posRotationY and rootId - remove <keys>` |
| `posGroup`, `posRotationY` | today's messages, under `posGroups[i].placement` |
| `rootId` given, not an article root of the group | `posGroups[i].placement: rootId must be the id of one of the group's roots` |
| `placement` on a group whose `id` is already in the plan (checked against the pre-context, before the load) | `posGroups[i]: placement positions a new group only - group '<id>' is already in the plan; resubmit it without placement to keep its position` |

The `pos`/`rotationY` and `articlePos`/`rotationY` messages (`:179`, `:198`) say "placement"
instead of "repositioningData".

**Flow — exactly one load per call, as today:**

1. Synchronous validation errors → throw, as today.
2. Fetch the articles once when any group has article picks or a placement (today only for
   picks); `validateArticlePickIds` (`:70-100`) receives them and uses `catalogArticleOf`.
3. Pre-context, as today; reject a placement on an existing group id.
4. Per group with a placement: `repositioningData = toRepositioningData(roots, placement,
   articles)`.
5. Whitelist unchanged (`id`, `libraryId`, `roots`, `repositioningData`); `placement` is dropped
   there.
6. The one load, the post-context, `{ loaded, groups, hint? }` — as today; the hint for an
   unpositioned group names `placement`.

A resubmitted existing group without a placement goes through unchanged: no `repositioningData`,
the planner keeps its position.

### 3. `get-plan-context`

Returns the articles without `cornerPoint`; every other section and field passes through.

### 4. Agent-facing text (`hi-mcp-server.ts`)

Following the table under [Agent-facing payload](#agent-facing-payload):

- `AUTHORING_RULES`:
  - group shape `{ id?, libraryId?, placement?, roots }`; "the group position comes from
    placement"; "remaps your docking references";
  - "one kitchen is one group" without "the anchor carries the group position via
    repositioningData";
  - "never author a position … a new group is positioned with placement only"; the hood sentence;
  - room-corner recipe: "give the group a placement with the room corner point and the rotation
    from the corner rules";
  - the new placement rule replaces the `repositioningData` rule; the corner-article rule is
    deleted; one sentence for two corner articles (decision P1);
  - wall rule "puts the group flush", corner table "with the corner article in the corner",
    verify rule without the corner-point correction;
  - the moving sentence ("To move an existing group … a new repositioningData …") is removed;
    the modify sentence stays ("take it from get-plan-context, change it, and resubmit it with
    its id");
  - examples 1 (`:34`) and 3 (`:49`) as in the table; example 4 unchanged; example 5 (`:62`,
    extending) says "without placement" instead of "without repositioningData".
- `INSTRUCTIONS` step 2 rewritten; step 3 (moving) removed; the descriptions of
  `get-plan-context` (no `cornerPoint`), `get-authoring-rules` and `create-or-replace-groups`
  (positioning of new groups only).

### 5. Unit tests

**`tests/group-placement.test.ts`** (new):

| Case | Expected anchor |
|---|---|
| single root | itself; no `rootRelPos` |
| row u1 → u2 → u3 (entries on the left roots), default start | u1 |
| same row, `rootId` u3 | u1 |
| row authored right to left (`LeftBottom → RightBottom`), roots listed u3, u2, u1 — the S1/S2 shape | u1 |
| reciprocal entries in both directions | u1, terminates |
| base row b1 → b2 with wall units w1, w2 on top, start w2 | b1 |
| wall-unit row w1 → w2, only w1 on a base unit b1, start w2 | b1 |
| wall units only, start w2 | w1 |
| L of example 3, start at each of c1, r1, r2, l1, l2 | c1, `rootRelPos [261, 0, 0]` for catalog `cornerPoint [-261, 0, 0]` |
| corner article with `cornerPoint` `[0, 0, 0]` or none | c1, no `rootRelPos` |
| U with c1 and c2: start c1; start c2; start a back-wall unit | c1; c2; c2 |
| island f1 → f2 back to back with k1 → k2, start f2; start k2 | f1; k1 |
| docking entries naming dropped generated roots | ignored |
| cyclic docking (u1 right of u2, u2 right of u1) | terminates |
| `posGroup` and `posRotationY` | passed through unchanged |

**`tests/tool-executors.test.ts`**:

- Replace "rejects a placement and points to repositioningData" and "rejects invalid
  repositioningData" with: rejects `repositioningData` and points to `placement`; rejects an
  invalid placement (not an object, `posGroup [0, 0]`, a string coordinate, `posRotationY '90'`,
  missing `posRotationY`, `rootId 'u9'`, unknown key `wall`) — nothing loaded.
- New: rejects a placement on a group whose id is in the plan — nothing loaded.
- "passes repositioningData through …" becomes: a new row authored right to left with a placement
  reaches the planner as `repositioningData` of u1, in exactly one load, without `placement`.
- New: a new L listed with a straight unit first reaches the planner anchored at c1 with
  `rootRelPos [261, 0, 0]`, in exactly one load.
- New: an existing group resubmitted without a placement reaches the planner without
  `repositioningData`.
- "moves an existing group resubmitted with its id and new repositioningData" is **removed** —
  moving is Task 2.
- New: the articles are fetched once per call with picks and placements.
- "hints at repositioningData …" becomes: the hint names `placement` and not
  `repositioningData`.
- New, `get-plan-context`: `cornerPoint` is stripped, `cornerArticle` kept; a context without
  articles passes through unchanged.

**`tests/hi-mcp-server.test.ts`**:

- New guard: the server instructions (`client.getInstructions()`), the `get-authoring-rules` text
  and every tool description and input schema contain none of `repositioningData`, `rootRelPos`,
  `cornerPoint`, `blind zone`, `261`. The word "offset" stays allowed — it is the docking offset.
- The bridge round trip sends a placement; the load receives the derived `repositioningData`; the
  planner call sequence is unchanged (articles, groups, load, groups) — one load.

Expected: 72 + about 20 tests, all green; typecheck clean.

### 6. Documentation

- Agent-facing, `placement` for new groups only, no offset, no moving: `minimal-hi-example/docs/hi-mcp-server.md`
  (tool reference, "Authoring pos groups", "Positioning a group" without the "Anchor", "Corner
  offset" and "Moving a group" bullets, demo walkthrough without the move step, example prompts
  without "Move the group to the back right corner"), `hi-mcp/hi-mcp-poc-json/README.md`,
  `QUICKSTART.md:55`, `minimal-hi-example/docs/ai-chat.md:125`, `hi-mcp-poc-presentation.md:76`,
  `.agents/skills/hi-mcp-tools.md` (without the "Moving" paragraph), `hi-authoring-rules.md`,
  `roomle-hi-concepts.md`, `AGENTS.md:177,182`, `.github/copilot-instructions.md:36,81,93,100-101`,
  the skill line in `.agents/README.md:44`. Moving is documented again by Task 2.
- Internal, for server development only (decision P3): `.agents/skills/hi-mcp-server.md` gets a
  short "Group placement (internal)" section — placement → anchor walk → `repositioningData`, the
  corner offset.
- Historical records stay untouched.

### 7. Commits

Conventional, no ticket number, each commit green:

1. `refactor: find the group anchor by following the docking` — §1 and its tests.
2. `feat: position new groups with a placement the server anchors` — §2 and §4 together, so that
   the executor and the text never disagree; tests and the guard test.
3. `refactor: keep the corner point out of the plan context` — §3 and its test.
4. `docs: describe group positioning with placement` — §6.
5. `docs: close out the group placement analysis` — after the live verification: status, report.

### 8. Verification

1. `cd hi-mcp && npx vitest run && npm run typecheck`.
2. Live, maintainer: `npm start gpt-5.4-mini <key>` and `npm start mistral-large <key>`:
   "plan a kitchen with an oven, a sink and a fridge in the back right corner of the room" and
   "plan a kitchen in the back right corner of the room", the second prompt also for the other
   three corners. Each creates one new group in one load. Pass: the row runs along the right wall
   from the corner, the L's corner point sits in the interior corner, nothing inside a wall —
   checked in the snapshot as in the findings (`npm run rapi:plan` in RoomleCore). On an empty
   plan the corner prompts depend on §0.
3. The served text: `get-authoring-rules` and the instructions in Claude Desktop contain no
   internal field and no moving instruction.

### Decisions to confirm

| # | Question | Recommendation |
|---|---|---|
| P0 | Corner data on an empty plan (§0) | Make the roomle-ui catalog carry `dockingVectors`, `cornerArticle` and `cornerPoint` for every article, also on an empty plan (A2) — a roomle-ui analysis first |
| P1 | Two corner articles (U-shaped) | The walk above: the first corner article met walking left from the start root, else walking right. The rules add one sentence: "With two corner articles, set rootId to the corner article that goes into the corner posGroup names." |
| P3 | Docs vs the hard rule | Agent-facing documents never mention the internal fields; one internal section in `.agents/skills/hi-mcp-server.md` (the server development skill) describes the conversion for maintainers. This narrows "the skills" in the hard rule to the agent-facing ones |
| P4 | Stale `wall`/`alignment`/`rootRelPos` in a placement | One generic "placement takes only posGroup, posRotationY and rootId" error instead of a message per field |

### Considered and rejected

- **A correction load after the creation** (load, read the corner offset, load the group again at
  the corrected position): it repositions a group, which is Task 2, and the position must be
  right in the creating call. Removed from this plan; the corner data has to exist before the
  load (P0).
- **Accepting a placement on an existing group**: the planner would re-apply the position on the
  replace and move the group — moving is Task 2.
- **A message per stale field**: more code, and a message about `rootRelPos` would name the
  concept the agent must not know (P4).
- **Deriving the anchor after the load from geometry**: the server has no raw geometry
  (`getExternalObjectGroups` is not exposed) and it would need a second load.
