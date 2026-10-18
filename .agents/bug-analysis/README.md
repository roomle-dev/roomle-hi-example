# Bug Analyses

One document per bug analysis: a deep root-cause investigation written **before** the fix, closed out **after** it.

Triggered by **"analyse the bug"** / **"analyze the bug"** / **"bug analysis"** — see
**Analysis Triggers** in [`../../AGENTS.md`](../../AGENTS.md).

## What belongs here

Point-in-time, investigation-driving write-ups. The document must cover:

- symptom and reproduction steps
- investigation trace with code references
- the exact root cause (file:line)
- why the current code produces wrong results
- the proposed clean fix

## What does not belong here

A symptom-level fix or workaround. All bug fixes must address the root cause, not hide the symptom.

## Close-out

When the bug is fixed, the durable outcome (the invariant, the rule, the corrected understanding)
is promoted into the appropriate living-reference document, and this document is closed out with:

- Status set to `Fixed`
- Pre-work sections rewritten into past tense
- Fix summary and validation results

Mechanics: Follow the pattern from RoomleCore's analysis close-out process.
Once the fix has landed — on `master`, a roomle-ui fix on `release/bo-test` or `master` — ["cleanup analyses"](../skills/hi-analysis-cleanup.md) promotes the durable outcome and deletes this document. A solved bug keeps no analysis.

## Current Documents

| Document | Status | Issue |
|---|---|---|
| [The sink unit descriptions do not say that a sink unit needs an article on its right](sink-unit-description-missing-right-neighbour.md) | Open — library change proposed | RML-18124; library #60 |
| [A corner group stands in front of the adjoining wall's window](corner-group-in-front-of-adjoining-wall-window.md) | Fixed | RML-18201; backlog #66 |
| [The planning skills are served by a tool only](planning-skills-served-by-a-tool-only.md) | Fixed | RML-18148 (follow-up); backlog #67 |
| [The room corners leave out a corner where an opening meets a wall](room-corners-left-out-at-openings.md) | Fixed | backlog #68 |
| [The wall units hang at two heights after a plinth height in the group attributes](wall-units-hang-at-two-heights-after-plinth-change.md) | Open — validated; shared arrangement fix and unit-test plan (roomle-ui, based on `fix/room-corners-at-openings`) | backlog #72 |
| [A wall-level article of another category is taken for a floor unit](wall-level-article-of-another-category-taken-for-floor-unit.md) | Open — fix proposed (roomle-ui, based on `fix/room-corners-at-openings`) | backlog #73 |
| [An island's back row of other widths lands off the front row](islands-back-row-of-other-widths-lands-off-the-front-row.md) | Open — fix proposed (roomle-hi-example served text; roomle-ui fallback, based on `fix/room-corners-at-openings`) | backlog #74 |
| [The backsplash of an image kitchen is reported as not buildable](backsplash-of-an-image-kitchen-reported-as-not-buildable.md) | Open — fix proposed (roomle-hi-example served text; roomle-ui, based on `fix/room-corners-at-openings`) | backlog #75 |
| [An edit that gives a row a new end leaves a door hinged to the outside](edit-that-gives-a-row-a-new-end-leaves-a-door-hinged-to-the-outside.md) | Open — fix proposed (roomle-hi-example served text) | backlog #77 |

Add bug analysis documents as needed following the naming convention:
`kebab-case-description.md` (e.g., `stale-group-position-after-move.md`).
