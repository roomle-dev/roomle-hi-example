# Refactoring Analyses

One document per refactoring, written **before** the work and carrying the report once the work is
done. The analysis and the report are the same document — the report is appended at close-out, not
written into a separate file.

Triggered by **"analyse the refactoring"** / **"analyze the refactoring"** /
**"refactoring analysis"** — see **Analysis Triggers** in [`../../AGENTS.md`](../../AGENTS.md).

## What belongs here

The analysis must cover:

- what the current code does and why it is a problem
- the full scope of the change, with file references for every affected location
- the proposed target shape
- the tests covering the affected behaviour and the output changes to expect
- for a performance refactoring, the benchmark to run before and after

## What does not belong here

A general algorithm write-up — how a pattern, a protocol, or a data structure works, independent of
any one refactoring — belongs in domain-specific documentation.

## Close-out

When the refactoring is complete, append the report to this same document with:

- Status set to `Done`
- Pre-work sections rewritten into past tense
- Report appended with:
  - Summary of changes
  - Changed files
  - Before/after comparison
  - Test adaptations
  - Risks and open items
  - Performance measurements (if applicable)

Mechanics: Follow the pattern from RoomleCore's refactoring close-out process.
Once the work is on `master`, ["cleanup analyses"](../skills/hi-analysis-cleanup.md) promotes the durable outcome and deletes this document.

## Current Documents

| Document | Status | Date |
|---|---|---|
| [One calculation and one load per create](one-calculation-and-one-load-per-create.md) | Open — proposal C of the performance analysis: the three or four rounds of calculate, publish and load of a create placed by wall with group materials become two calculations and one load; the two planner methods of the tools, `change-attributes` before the load, the model-free replay before and after, the decisions D23, D36, D70 and D106 | 2026-10-29 |
| [Planning Assistant performance: what a second of a turn is made of, and the levers that move it](planning-assistant-performance-next-steps.md) | Open — the four prices of a turn (round, reasoning token, output token, planner load); levers A–E: the skills supplied with the request, the tool call before the narration, one load per create, the finishes in the create, the payload with the defaults; sections 6 and 7.2 of the earlier analysis failed and are replaced | 2026-10-29 |

Add refactoring analysis documents as needed following the naming convention:
`kebab-case-description.md` (e.g., `mcp-bridge-simplification.md`).
