# Bug analysis — the corner-removal correction reports wall units as turned that stay on the back wall

> **Type**: Bug analysis
> **Status**: Open — reproduced in two runs; fix proposed, not implemented
> **Date**: 2026-10-20
> **Base**: roomle-ui `feat/hi-mcp-improvements` (`60bc7cd48`); roomle-hi-example `master` (`8a5680c`)
> **Backlog**: [item 81](../backlog/mcp-issues.md#81-the-corner-removal-correction-reports-wall-units-as-turned-that-stay-on-the-back-wall);
> shares its root cause with [item 89](../backlog/mcp-issues.md#89-wall-units-in-separate-groups-do-not-follow-their-edited-carriers)

## Affected repositories

- **roomle-ui** (`feat/hi-mcp-improvements`) — the planner side of `delete-article-and-compact`.
  `removeArticleFromGroup` (`packages/web-sdk/packages/homag-intelligence/src/hi-tools.ts:830-975`)
  also moves the wall-unit groups whose units stand above the edited row, in the same edit, and its
  corner correction stops claiming units it did not turn (`:966`). The carrier lookup of
  `hi-root-module-arrangement.ts:144` gets a room-space form for units of other groups, and
  `movedUnitsAboveHint` (`hi-tool-hints.ts:117-167`) names moved units of every group. Tests go in
  `homag-intelligence/__tests__/hi-tools-test.ts`, `hi-root-module-arrangement-test.ts` and
  `hi-tool-commands/group-commands-test.ts`. The served description
  (`packages/embedding-lib/src/homag-intelligence/hi-mcp/hi-mcp-server.ts:693-694`) stays as it is:
  after the fix it is true.
- **roomle-hi-example** — documentation only: D42, D52 and the §8.5 rows C20 and D42 of
  `docs/hi-mcp-behaviour.md`, the row-edit section of `.agents/context/tool-executors.md:312-315`,
  `.agents/skills/hi-mcp-tools.md:341`, and the backlog. No embedding-lib pin: the fix runs in
  the planner (web-sdk), so it reaches the clients with the bo-test deployment.

ligna-store needs no change; it loads the same planner. RoomleCore and the library calculation
need no change.

## Symptom and reproduction

`delete-article-and-compact` of the corner unit of an L-shaped kitchen answers:

> '814c6854-…' (UERTB90) was a corner article - the leg of '46ce47e7-…' (UTB60) **with the units
> above it** turned by 90° and is docked to '7cd04e00-…' (US2A60)

The back-wall leg turns onto the right wall. The two wall units that hung above it stay on the back
wall, above empty floor. The plan contradicts the correction, and the agent passes the claim on
("The former back-wall leg rotated 90° to form one straight run along the right wall").

**Reproduce.** Test `edit-remove-corner-unit` (plan `corner-kitchen-wall-units`,
`ps_s7hy5nqvtts37wl79u6q8tq67bc12s2`), prompt "remove the corner unit and close the gap". The
item's original run `mcp-test-2026-10-20_06-45-46` is no longer kept locally. Both later runs of
the day reproduce it with the same correction and are rated *partial*:
`mcp-test-2026-10-20_12-45-30` and `mcp-test-2026-10-20_19-13-28`, gpt-6-astra 33, local roomle-ui
:5173. The before state is the `plan.xml` of `mcp-test-2026-10-20_12-45-30` 31, a run that did not
change the plan. Positions are in room coordinates (the right wall at x 4815, the back wall at
z −3765), read from the `externalConfiguration` of the two `plan.xml`:

| Group | Root | Carrier (by position) | Before | After |
|---|---|---|---|---|
| `031ee57a` (the kitchen) | `27d63628` GSP, `31616143` SUT60, `46ce47e7` UTB60 | — | back wall, x 2354..4154 | **turned** onto the right wall, z −3765..−1965 |
| `031ee57a` | `7cd04e00` US2A60, `379fa7a9` UKS2A60 (hob), `b9bbab7e` US2A60, `ad52e21b` HK60 | — | right wall, z −2604..−204 | moved 639 mm along the right wall, z −1965..435 |
| `031ee57a` | `5b754b36` OTB60 | `b9bbab7e` | z −1404..−804 | z −765..−165 — **follows** |
| `85510a7e` (wall units) | `1450cfe7` OTB60, `ba294c27` OTB60 | `31616143`, `46ce47e7` (turned leg) | back wall, x 2954..4154 | **unchanged** |
| `afbe92eb` (wall unit + hood) | `4c722e3d` OTB60, `a834858d` DU | `7cd04e00`, `379fa7a9` (moved leg) | right wall, z −2604..−1406 | **unchanged**: the hood now hangs above `7cd04e00`, not the hob |

The wall unit in the edited group follows its carrier. The four wall units in separate groups do
not, on either leg.

## Investigation trace

1. **The tool command** `delete-article-and-compact` (`hi-tool-commands.ts:1123-1160`) runs the
   group operation `remove-article-from-group` on the group of the root and wraps it in
   `withRowHints` (`:1149`).
2. **The operation** `removeArticleFromGroup` (`hi-tools.ts:830`) works on one group: the
   `groupItem` of `groupId` (`:834`). It docks the two neighbours of the corner unit to each other
   and calls `arrangeAndLoad` (`:933-939`).
3. **The arrangement** `arrangeAndLoad` (`glue-logic.ts:2604-2626`) calculates and arranges that
   group and loads only it (`:2618`). Units above follow their carriers in
   `_arrangeRootModulesAndCalculateIfChanged` → `moveUnitsAboveWithTheirCarriers(originalGroup,
   group, …)` (`glue-logic.ts:3256`).
4. **The carrier lookup** `moveUnitsAboveWithTheirCarriers` (`hi-root-module-arrangement.ts:219`)
   takes its followers from `carriersOfUnitsAbove(originalGroup)` (`:226`), and
   `carriersOfUnitsAbove` (`:144-172`) compares the roots of that one group with each other. A
   carrier that turns makes its unit turn with it (`:265-278`). That is why `5b754b36` follows,
   and the units of `85510a7e` and `afbe92eb` never enter the lookup.
5. **The correction** (`hi-tools.ts:958-968`) is written after the load. It finds the leg that
   turned by comparing its rotation before and after (`turnOfRoot`). The words "with the units above
   it" are fixed text in the template (`:966`); nothing checks whether a unit stood above the leg or
   whether it turned.
6. **The hints** `movedUnitsAboveHint` (`hi-tool-hints.ts:117-167`) and `turnedLegHints`
   (`:169-223`) read only the edited group (`rawAfter`, `:123`; `original`, `:176`). The hint can
   name `5b754b36` as moved. It cannot say that the four units of the other groups stayed. The run
   logs do not show the hint: the served log prints `corrections` and `notLoaded` only
   (`hi-mcp-server.ts:179`).

## Root cause

Two defects meet in this edit.

1. **The units above only follow carriers of their own group.** `carriersOfUnitsAbove`
   (`hi-root-module-arrangement.ts:144`) enumerates the roots of the edited group, and
   `arrangeAndLoad` (`glue-logic.ts:2618`) loads only that group. A wall unit that the agent
   created as a separate group (the common case: wall units are created in a call of their own)
   keeps its place when its carrier turns or moves. That contradicts D52 ("The units above the
   turned leg turn with it") and D42 ("Units above follow the unit they hang from"). Neither
   decision restricts it to one group, and both describe how the plan stands, not how it was built.
2. **The correction states a fixed text, not what happened.** `hi-tools.ts:966` says "with the
   units above it" whenever a leg turned. That holds for a leg without units above it as much as
   for this one. D52 assigns the units to the row hint ("the correction names the leg that turned
   and the leg it is docked to, and the row hint names the wall units that moved"). The correction
   repeats a promise that the code only keeps within one group.

Defect 1 is item 89's cause as well, there for a carrier that moves along its wall
(`edit-remove-next-to-corner`) or that is swapped (`edit-swap-hob-unit`).

## Why the current code produces this result

The units of `85510a7e` hang above `31616143` and `46ce47e7`, measured by position, as
`carriersOfUnitsAbove` measures them. They belong to another group, so the lookup does not see
them. The arrangement turns the leg, the load writes the kitchen group, and `85510a7e` is not
touched. The correction is then written from the leg's rotation alone and adds the units by its
template.

## Proposed fix

**The units above follow their carriers in every group, in the same edit (roomle-ui).** The
following is the D42/D52 behaviour, and only correcting the text would document the defect instead
of fixing it.

1. **Before the edit** `removeArticleFromGroup` collects the units above the edited group's roots
   from the other groups of the scene. It uses the rule of `carriersOfUnitsAbove`, in room space: a
   unit whose docking vectors begin at or above a root's top, with their centre over that root.
   One way is to map the other groups' roots into the edited group's frame and run
   `carriersOfUnitsAbove` over the combined roots. The existing transformation helpers are
   `getPositionTransformation` and `getModuleTransformation` (`hi-root-module-arrangement.ts:49,61`).
   Generated roots carry nothing, as today.
2. **After the arrangement** every carrier has a room-space move: its transformation after,
   times the inverse of its transformation before. This includes a group origin that the
   arrangement moved (`arrangementMovedGroup`). **A separate group follows as a whole** when all of
   its carried units have carriers with the same move. Its `pos` and `rotationY` take that move
   (`setGroupPositionFromTransformation`, `:85`), and it is loaded with `applyGroupPosition`, in
   the same `loadPosGroups` call as the edited group or right after it. The tool command is one
   step of the planner's undo history (`runToolCommand`, `hi-tool-commands.ts:1404-1471`), so
   `undo` reverts both.
   - In the reproduce, `85510a7e` follows the turned leg (both carriers turn by 90° about the same
     point) onto the right wall at z −3165..−1965. `afbe92eb` follows the moved leg 639 mm along the
     right wall, and the hood is above the hob again.
   - **Both legs are needed.** If only `85510a7e` turned, its unit `ba294c27` would land at
     z −2565..−1965, over `4c722e3d` of `afbe92eb` (z −2604..−2004), which only stays clear when it
     follows its own carrier. A fix for the turned leg alone builds overlapping wall units.
3. **Fallback — a group whose carried units move differently keeps its place.** Examples are a
   wall row that spans the corner, with units above both legs, or units above the edited row and
   above another group. Moving such a group as a whole puts some of its units in the wrong place,
   and splitting it creates groups nobody asked for. The group keeps its place, as a unit above
   does in D42 when it cannot follow, and the correction says so: "the wall units '…' (OTB60), …
   of group '…' keep their place - they hang above root modules that moved differently; move the
   group with place-group or edit the wall row". This is a proposal; see Open point.
4. **The correction and the hint say what happened.** The corner correction names the leg and the
   leg it is docked to, without "with the units above it". `movedUnitsAboveHint` takes the upper
   roots of the groups that followed as well, so the hint names every unit that moved with the
   floor units, by id and article id (D42). The wording of `turnedLegHints` does not change.

**Alternatives considered.**

- *Only correct the text: name what turned and name the wall units that stayed* (the second
  option of the backlog item). Rejected as the fix: it leaves the plan against D52 and D42 and the
  test's expectation ("one leg turns by 90 degrees with its wall units"). It is kept as the
  feedback of the fallback (3).
- *Move every group that has one carried unit, by the turned leg's move.* Rejected: a wall row
  over both legs, or over the moved leg, goes to the wrong place (see "Both legs are needed").
- *Serve a rule that the agent puts wall units into the kitchen group, or calls `place-group`
  after the edit.* Rejected: the agent built a valid plan. The served rules provide for a group of
  wall units of its own (its placement by point, `hi-mcp-server.ts:34`), and item 89 rejects the
  extra `place-group` call too.

## Tests

- roomle-ui `__tests__/hi-tools-test.ts`, beside `it('removes a corner article by turning one leg
  with the units above it and docking it to the other')`, with the wall units in separate groups:
  - a corner removal in which the wall-unit group above the turned leg turns with it and the group
    above the other leg moves with that leg along its wall (the reproduce's layout);
  - a wall-unit group above both legs that keeps its place, with the correction naming its units;
  - a wall-unit group in the room that stands above no root of the edited row and stays where it is;
  - the correction without "with the units above it". The existing test's expected correction
    changes accordingly.
- roomle-ui `__tests__/hi-root-module-arrangement-test.ts`: the room-space carrier lookup across
  groups, including a group rotated against the edited group and a gap between carrier and unit
  that the kernel's docking does not link (D42).
- roomle-ui `__tests__/hi-tool-commands/group-commands-test.ts`: the D42 hint names the moved
  units of another group.
- The prompt test `edit-remove-corner-unit` of `docs/test-prompts.json`: its expectation already
  asks for the wall units to turn with the leg; it passes once both wall-unit groups follow.

## Open point

The fallback (3) is a behaviour detail for the user to confirm: a separate wall-unit group whose
carried units move differently keeps its place and is named in the correction. The alternative
would be to split it along its carriers. Item 89 asks the same for insert and swap, and the
carrier lookup in `arrangeAndLoad` serves all three edits: whether this fix covers
`delete-article-and-compact` only or all row edits (closing item 89 with it) is the scope
decision.
