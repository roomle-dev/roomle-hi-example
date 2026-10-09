# Validation of the MCP test fixes of RML-18103

> **Type**: Refactoring Analysis — validation of a branch's changes
> **Status**: Done
> **Branch**: roomle-hi-example `fix/mcp-test-open-issues-RML-18103`, roomle-ui
> `fix/hi-mcp-open-issues-RML-18103`, ligna-store `fix/hi-mcp-open-issues-RML-18103`
> **Reference**: `.temp/result/mcp-test-2026-10-08_16-33-40` (gpt-6-astra on `master`)

Repositories:

- roomle-hi-example — the MCP server changes below
- roomle-ui — the remove correction (#42) and the attribute command after a discarded calculation (D69)
- ligna-store — the failing chat step is logged (#38)

## Question

Does each change fix the cause its issue names, or does it work around a symptom? The test is
[Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort): a change is a root-cause fix
when it clarifies the instructions (step 1), lets the server derive what the agent had to compute
(step 2), or fixes a defect of the server or the planner; a correction of agent input (step 3) or
feedback (step 4) is legitimate where the intent is clear. A workaround guesses around a defect
that sits elsewhere.

## The changes

| Change | Issue | What it does | Verdict |
|---|---|---|---|
| `rowIndex` on every root of a row | 45 | the server derives the place in the row | root cause — step 2 |
| served clauses: one call with all articles; an article beside a group goes into it | 37, 46 | the description says what only the rules said | root cause — step 1 |
| `find-attributes` names the root modules of a match, the plan's attributes first | 48 | the match says which part carries the attribute | root cause — step 2 |
| a root module's own value of a group attribute is kept | 52 | the server overwrote it with the group's value | root cause — server defect |
| the program attributes go first | 57 | a program reset a colour sent before it | root cause — server order |
| `change-group-attribute` takes a list | 58 | one command instead of one call per attribute | root cause — tool API |
| create, undo and redo return the groups they changed | 59 | the results carried every group of the plan | root cause — tool API |
| a root id as `groupId` names its group | 47 | the intent is unambiguous | correction — step 3 |
| overlaps tested per root module | 53 | the rectangle of an L-shaped group covered its inside | root cause — server geometry |
| a row edit names a door or window it now stands in front of | 41 | the hint tested the room contour only | root cause — missing feedback |
| a ring of a row is broken in the planner's order | 3 | server and planner anchored different roots | root cause — server and planner disagreed |
| G7 docks a part by a lead of its own kind | 15 | the lead could be a wall unit at floor level | root cause — defect of G7 |
| lone wall units hang above a floor unit | 13 | the whole group was refused | correction — step 3 |
| a vector the article does not have is dropped, reported | 7 | the unit stood inside the corner article | correction — step 3/4 |
| a floor unit on a base unit's Top vector goes to the row's free end | 14 | the unit hung in the air | correction — step 3 |
| two units on one Top side vector | 50 | the side correction counted Bottom vectors only | root cause — gap of G8 |
| a unit `above` in the place of a wall-unit row continues it | 36 | G44 moved units into occupied places | root cause — defect of G44 |
| a unit above is docked to the unit below before a reload (C24) | — | the reload sent docking without the hang links, wall units fell to the floor | root cause — the server composes the reload |
| the materials after the wall reload again | 54 | revert of a reorder that broke wall units and materials | revert |
| the `notCarried` sentence asks the answer to name the material | 56 | the answer kept silent about an unbuilt backsplash | root cause — step 1 |
| the attributes set one by one after a discarded command (old D69) | — | the server guessed a discard from "nothing changed" | **workaround — reverted** |
| the planner sets the values on the other root modules after a discard (D69) | — | the planner restored the whole group and answered as for a success | root cause — planner |
| `place-group` measures the group again as built at the new place (D70) | test 34 | the library widens end units at a wall; the old measure shifted the group | root cause — the measure of the old place |
| a hint for a sink top past the row end | test 30 | named one article's geometry | **workaround — dropped, never committed** |

## Test 34

Not a regression of the branch: `master` places the run the same way (replay of the run's create
and `place-group`, same planner). At its first place, 200 mm from the back wall, the library widens
the end units `US2A30` and `OTB30` from 300 to about 500 mm so that the row reaches the wall; the
group measures 2900 mm instead of 2700 mm, and `place-group` placed it by that width. At 650 mm from
the wall the units are 300 mm again, and the run stood 850 mm from the wall. Excluding the worktop
and the toe kick from the measure does not help — the article roots themselves change. D70 measures
after the reload: the replay stands 660 mm from the wall.

## Test 30

Not a server defect: the same create on `master` and on the branch gets the same answer (obstacles
and rooms byte-identical); the drainer of `SUT60` past the row end depends on whether the model swaps
the sink unit into the row afterwards (`master` 1 of 3 runs, the branch 0 of 3). The catalog does not
say that the sink top is 980 mm wide. A library matter — see the backlog.

## Report

The verification is the "test the mcp" run with gpt-6-astra after these changes.
