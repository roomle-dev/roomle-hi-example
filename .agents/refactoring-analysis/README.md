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

| Document | Status | Description |
|---|---|---|
| [object-image-in-get-plan-images.md](object-image-in-get-plan-images.md) | Open | Use an object perspective image and label each returned view in get-plan-images |

Add refactoring analysis documents as needed following the naming convention:
`kebab-case-description.md` (e.g., `mcp-bridge-simplification.md`).
