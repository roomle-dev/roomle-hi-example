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
A fix proposal that changes the library's calculation — a library API change, a change of process
in the library, or a change in the data the library calculates. The MCP deals with the library as
it is and explains its behaviour and capabilities to the AI agent; the fix belongs in the MCP
server and the tools and API of roomle-ui. Valid library fixes are description updates (an article,
an attribute, a value) and real bugs in the library's code that work against its overall intention.

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
| [A discarded group of a create is reported to the host as added and then deleted](discarded-create-host-notifications.md) | Open | [MCP issue 112](../backlog/mcp-issues.md#112-a-discarded-group-of-a-create-is-reported-to-the-host-as-added-and-then-deleted) |
| [Discarded creates report root identities the call never sent](discarded-create-root-identities.md) | Fixed — release verification pending | [RML-18295](https://roomle.atlassian.net/browse/RML-18295) |

Add bug analysis documents as needed following the naming convention:
`kebab-case-description.md` (e.g., `stale-group-position-after-move.md`).
