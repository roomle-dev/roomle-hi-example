# Bug analysis — a conflict a row edit leaves is not resolved

> **Type**: Bug analysis
> **Status**: Open
> **Date**: 2026-10-28
> **Base**: roomle-hi-example `master` (`dcfae48`); roomle-ui `feat/hi-mcp-performance` (`b2c28910b`)
> **Backlog**: item 116 of [`../backlog/mcp-issues.md`](../backlog/mcp-issues.md)

## Affected repositories

- **roomle-ui** (`feat/hi-mcp-performance`) — the fix, served text only: one sentence in the rule
  for results of `AUTHORING_RULES` and one clause in the description of `delete-article-and-compact`
  (`hi-mcp/hi-mcp-server.ts`), the end of the overlap correction of `removeArticleFromGroup`
  (`hi-tools.ts`); their assertions in `__tests__/hi-mcp/hi-mcp-server-test.ts` and
  `__tests__/hi-tools-test.ts`; D42, a new D124 and the `delete-article-and-compact` row of
  `.agents/homag-intelligence/hi-tools-behaviour.md` and `hi-tools-reference.md`. No logic change:
  the delete, its corrections and its hints compute the right thing.
- **roomle-hi-example** — the `expect` of `edit-remove-next-to-corner` in `docs/test-prompts.json`
  (and of `edit-remove-corner-unit`, by [the open question](#open-question-the-door)), backlog item
  116 and this analysis.
- **embedding-lib** — no build. The rules, the descriptions and the corrections come from the
  planner; `createHiMcpTools` forwards them.

## Symptom

Plan `corner-kitchen-wall-units` (`ps_s7hy5nqvtts37wl79u6q8tq67bc12s2`): an L-shaped kitchen in the
back right corner of a 5,500 × 5,000 mm room. The back leg holds GSP, SUT60 and UTB60. The corner
unit is UERTB90 `814c6854`. The right leg holds US2A60 `7cd04e00`, the hob unit UKS2A60 `379fa7a9`,
US2A60 `b9bbab7e` and the tall fridge unit HK60 `ad52e21b`. Above the right leg hang the wall unit
OTB60 `5b754b36`, in the base group, and the wall unit OTB60 `4c722e3d` with the range hood DU
`a834858d`, in a group of their own (`afbe92eb`). The right wall has a 900 mm door at its front
end (y −1180 to −280). Its piece from the door to the back corner (wall 4) is 4,045 mm long.

### `edit-remove-next-to-corner` — two units in one place

Prompt: "remove the base unit next to the corner unit on the right wall and close the gap. Decide
any open details yourself instead of asking."

`delete-article-and-compact` of `7cd04e00`: the hob unit moves into the gap and takes the hood with
it. The hob unit carries the hood already, so the wall unit `4c722e3d` above the removed unit keeps
its place (D42). The hood now hangs inside the wall unit: y 2006..2604 against y 2004..2604, both
from 1480 mm up. The correction says:

> the unit '4c722e3d-…' (OTB60) above '7cd04e00-…' (US2A60) keeps its place - '379fa7a9-…'
> (UKS2A60) carries a unit above it already, and it now overlaps the unit 'a834858d-…' (DU) that
> moved in above '379fa7a9-…' (UKS2A60) - remove one of them or move the units above

| Run | Model | After the delete | Final plan |
|---|---|---|---|
| `mcp-test-2026-10-18_08-45-09` | gpt-6.1-sol | — | the overlap stays: "This upper-row conflict remains unresolved" |
| `mcp-test-2026-10-21_16-59-20` | mistral-large-4 | `delete-article-and-compact` of `4c722e3d`, `merge-article-into-group` of an OTB60 left of the hood | resolved |
| `mcp-test-2026-10-22_19-45-49` | gpt-6-astra | `create-or-replace-groups` of `afbe92eb` with the OTB60 `leftOf` the hood, `place-group` | resolved |
| `mcp-test-2026-10-25_18-06-08` | gpt-6-astra | the same | resolved |
| `mcp-test-2026-10-27_07-11-41` | gpt-6-astra | — | the overlap stays: "Both remain in the plan; the upper row still needs adjustment." |

Three of five runs resolve the overlap. The other two end the turn on the report. The 10-25 and
10-27 runs got the same correction word for word, and no change on `release/bo-test` between them
touches the served rules or the delete's corrections. The difference is the model's choice.

### `edit-remove-corner-unit` — a root module in front of the door

Prompt: "remove the corner unit and close the gap. Decide any open details yourself instead of
asking."

`delete-article-and-compact` of `814c6854`: the back leg turns by 90° onto the right wall (D52).
The straight row is 4,200 mm long, 155 mm longer than wall 4. The tall fridge unit ends at y −435,
155 mm into the strip in front of the door.

All five runs (gpt-6.1-sol, mistral-large-4, gpt-6-astra three times) keep the row and name the
door in the answer. Mistral says why: "left as-is since fixing them would mean deleting a cabinet
or relocating the whole kitchen, which you didn't ask for".

**Reproduce.** `mcp-test-2026-10-27_07-11-41`, gpt-6-astra (provider default effort), tests 23
(`edit-remove-next-to-corner`) and 24 (`edit-remove-corner-unit`). Model-free replays on bo-test of
the runs' calls and of two resolutions are in `.temp/result/row-edit-conflict-probe-2026-10-28/`:
`probe.mjs`, and `next-to-corner.json`, `corner.json`, `resolve-move.json` and
`resolve-delete.json` with the full results and the plan images.

## Investigation trace

### What the results tell the agent — complete

The run logs only part of a result: the `[hi-mcp] tool … feedback` line carries `corrections` and
`notLoaded`, not `hint`. The replay returns the full results. bo-test carries the same
`hi-tools.ts`, `hi-tool-commands.ts` and `hi-tool-hints.ts` as `feat/hi-mcp-performance`.

**`edit-remove-corner-unit`.** `corrections` names the corner article and the leg that turned
(`hi-tools.ts:1893`). `hint` (`withRowHints`, `hi-tool-hints.ts:245`) names three things: the wall
units that moved (D42), the leg that moved from the back wall to the right wall (D52), and the
door (D43, D55):

> Root module 'ad52e21b-…' (HK60) of group '031ee57a-…' stands in front of the door in the right
> wall (wall 3, fromEndMm 0 to 900, 0 to 2100 mm) - free stretches of the right wall (wall 4) at
> its height: fromEndMm 0 to 600, 2998 to 4045. The row was edited as asked - move the group or edit
> the row if the user did not ask for it there.

The backlog item gives as part of the cause that "a turned leg's correction says nothing about the
door it now reaches". That is true of the correction but beside the point: the hint of the same
result names the door, and every answer passes it on. The turned leg's correction needs no change.

**`edit-remove-next-to-corner`.** `corrections` holds the overlap quoted above (`hi-tools.ts:1793`,
extended at `:1878` when `unitsOverlapping` finds the units that moved in). `hint`: "the wall
units and the range hood above the moved units moved with them ('5b754b36-…' (OTB60), 'a834858d-…'
(DU)) - edit the wall row the same way if it should line up with the floor units".

Both results are right and complete. The decisions say that the edit is built and that the result
names what the edit left: D42 ("Nothing edits the wall row automatically: the same tools edit it"),
D43 ("the row is built anyway"), D55 and D51.

### The tools resolve the overlap — checked model-free

On bo-test, after the delete of `7cd04e00`:

| Follow-up | Calls | Final plan |
|---|---|---|
| `delete-article-in-place` of `4c722e3d` | 1 | the hood above the hob unit, no overlap |
| `create-or-replace-groups` of `afbe92eb` with the OTB60 `leftOf` the hood, then `place-group` `{ wall: right, alignment: back, offsetMm: 561 }` (the 10-25 run) | 2 | the hood above the hob unit (y 2006..2604), the wall unit beside it towards the corner (y 2604..3204), no overlap |

Nothing in the tools stops the agent. The gap is in what the agent is asked to do with the report.

### What the served text asks the agent to do with a result

The rule for results, `AUTHORING_RULES` (`hi-mcp/hi-mcp-server.ts:46`):

> Read corrections, notLoaded and hint in a result: corrections lists what the server changed in
> your input and has already applied, and what the library changed beyond the attribute you set
> …; notLoaded lists the groups and the roots it could not build, with what to send instead; hint
> names something to check that stopped nothing - a root module on an obstacle, with the free
> stretches of its wall.

The overlap of D42 is neither thing the rule says `corrections` holds. The server did not change
the agent's input, and the library did not change an attribute. The overlap is a state the call
left in the plan. The rule has no reading and no instruction for it. Its tone fits only "has
already applied", which says that nothing is left to do.

The system prompt (roomle-ui `hi-agent-prompts.ts:19`) ends the turn with "Summarize what you
changed … corrections and notLoaded …, and name what was asked but is not in the plan". By that
text, a correction is something to summarise.

The correction itself ends "- remove one of them or move the units above" (`hi-tools.ts:1881`). It
names two edits and does not say who makes them. Read with the rule above, it is advice to pass on
to the user, and that is how the two runs read it.

The description of `delete-article-and-compact` (`hi-mcp-server.ts:730`) says before the call: "A
wall unit or a range hood that hung from the deleted root module hangs from the one that moves into
the gap." It does not mention the exception of D42. When the neighbour carries a unit already, the
unit keeps its place, and D51 asks for what happens to be specified "in the tool description
before the call and in the result after it".

The obstacles rule (`hi-mcp-server.ts:39`) covers the door: "A group goes where the user puts it
… also when a door, a window or other furniture is there: the result's hint names what it stands in
front of or on, and your answer says so". For a wall with no free stretch wide enough, it adds:
"your answer names what it stands on and the alternatives - another wall where it fits, narrower
units". The kitchen skill adds: "Never silently shrink a required clearance or alter a user
must-have" (`kitchen-planning/SKILL.md:184`). The answers of `edit-remove-corner-unit` do what
these rules ask.

## Root cause

`hi-mcp/hi-mcp-server.ts:46`: the rule for results calls `corrections` changes already applied
and `hint` a check. It has no sentence for a conflict a call leaves in the plan, two units in one
place. The overlap correction ends by naming two edits without saying that the agent makes one of
them (`hi-tools.ts:1881`). With both texts, ending the turn on the report is as valid a reading as
resolving the overlap, and gpt-6-astra takes both readings: two of its three runs resolve.

The door of `edit-remove-corner-unit` is not an instance of this defect. The served rules ask the
agent to keep a group where the user puts it and to name the door and the alternatives, and the
result gives the agent what it needs for that. Clearing the door means deleting or narrowing a
unit, or moving the row and both groups of wall units to the back wall. The user asked for none of
these changes ([Open question](#open-question-the-door)).

## Why the current code produces the wrong result

Two units in one place is a plan no user wants: the hood hangs inside a wall unit. The agent made
it with its own call, and one more call resolves it. The served text treats the overlap like any
other correction, as information to pass on, so whether the agent resolves it is left to chance.
In two of five runs the turn ends on a plan that cannot be built, and the user has to ask again.

## Proposed fix

roomle-ui `feat/hi-mcp-performance`, served text only. This is the first step of
[Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort): clarify the instruction.

| Text | Today | Proposed |
|---|---|---|
| The rule for results (`hi-mcp-server.ts:46`), after the `hint` clause | — | "A result that says two units now overlap leaves a plan that cannot be built: resolve it in the same turn with one more call - delete one of them or move it - and say how." |
| The end of the overlap correction (`hi-tools.ts:1881`) | "- remove one of them or move the units above" | "- delete one of them or move it with one more call" |
| `delete-article-and-compact` (`hi-mcp-server.ts:730`) | "A wall unit or a range hood that hung from the deleted root module hangs from the one that moves into the gap." | append: "- unless that one carries a unit above already: then it keeps its place, and the result names the units that now overlap." |

The rule's sentence also covers the other overlap a row edit reports, "the row now overlaps group
'…'" (D43, after an insert, a merge, an exchange or a swap). In that case too, the agent's own call
put two units in one place. The rule sends no door or window case to the agent: a root module in
front of an opening stays under the obstacles rule. None of the three texts names an article or a
value of a library (§2.4), and none says what is refused.

**Tests, roomle-ui.**

- `__tests__/hi-mcp/hi-mcp-server-test.ts`: the rules contain the new sentence, in
  `it('describes how to succeed instead of what is rejected, and where the corrections are')`
  (`:1176`); the description of `delete-article-and-compact` contains the exception, in
  `it('names the delete edits by their outcome and leaves the gap by default')` (`:973`).
- `__tests__/hi-tools-test.ts`: the new end of the correction in
  `it('keeps a unit above in place when the neighbour carries one already')` (`:3702`),
  `it('names the overlap with a unit on top of a unit that moved in')` (`:3754`),
  `it('names the unit of another group that moved in above a kept unit')` (`:4033`) and
  `it('moves a unit on top of the unit of another group that moves in above the neighbour with it')`
  (`:4066`).

**Documentation.**

- roomle-ui `hi-tools-behaviour.md`: D42's sentence on the correction gains "and the agent resolves
  the overlap with one more call (D124)". A new D124, "A conflict a call leaves is resolved in the
  same turn", records the rule, its scope (two units in one place; a door or a window stays under
  D55 and D81) and the rejected alternatives below. The `delete-article-and-compact` row of §6 and
  `hi-tools-reference.md:380` name the exception of the unit that keeps its place.
- roomle-hi-example `docs/test-prompts.json`, `edit-remove-next-to-corner`: "the wall unit above
  the removed unit keeps its place and the answer says so" becomes "the wall unit above the
  removed unit keeps its place and overlaps the range hood; one more call resolves the overlap -
  deletes that wall unit or moves it beside the hood - and the answer says how".

**Verification.** Unit tests and `npm run lint` in roomle-ui. A model check needs a request of its
own, on the build that carries the change: the served text comes from the planner, so a `--dev`
page on `feat/hi-mcp-performance`. It would run tests 23 and 24 with gpt-6-astra, the model of the
backlog item, three runs each. It must show the overlap of test 23 resolved in every run, and test
24 unchanged.

### Alternatives considered

- **The server resolves the overlap itself**, by deleting the kept unit or moving it beside the
  units that moved in. D42 decides against it: "Nothing edits the wall row automatically". The
  server cannot tell which of the two edits the user wants, and a move needs a free place that the
  wall row may not have.
- **A guard that refuses a delete that would leave an overlap.** The user asked to close the gap.
  The refusal costs a step and builds nothing, and the agent can resolve the overlap after the
  delete ([Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort), step 5).
- **The turned leg's correction names the door** (the backlog item's to-do). The hint of the same
  result names it already, with the free stretches. A second sentence would add nothing the agent
  lacks.
- **A sentence in the system prompt** (`hi-agent-prompts.ts`). The rule for results is where an
  agent of the tools reads what a result means (§2.4, one source), and the correction it explains
  comes from the tools.
- **Only the rule, the correction unchanged.** "Remove one of them or move the units above" stays
  addressed to no one, and the agent would have to connect it to the rule. The correction is the
  text the agent reads at the moment of the decision.

## Open question: the door

The analysis leaves `edit-remove-corner-unit` to the review. There are two readings:

- **(a) Keep the row, and name the door and the alternatives — recommended.** This is what every
  run does now, and what D55, D81, D112 and the kitchen skill ask. The alternative that fits is the
  back wall by its measures (5,500 mm; its window starts 950 mm up, above the base units), and the
  served rule already asks the answer to name it ("another wall where it fits"). The `expect` of
  the test then says: "the answer names the tall unit in front of the door and what would clear
  it". No served text changes.
- **(b) Clear the door.** The agent moves the row to the back wall, or shortens it by a unit. A
  move takes at least three `place-group` calls, one for the base row and one for each group of
  wall units:
  the units of other groups follow their carrier on a row edit only (D42). Either way the kitchen
  changes beyond the request, and for a row edit it would need a decision against D81's "a group
  goes where the user puts it".

Under (a), the backlog item's test for `edit-remove-corner-unit` checks the answer only.
