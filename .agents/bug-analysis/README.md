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
| [Preserve completed tool outcomes and clarify calculation recovery advice](pr-review-tool-outcomes-and-calculation-advice.md) | Fixed locally — PR review fixes | roomle-hi-example #94 |
| [Explain root outlines that extend over a neighbour](root-outline-overhang-explanation.md) | Fixed locally — MCP wording; library follow-up in #60 | Plan-context finding #2 (RML-18103) |
| [Report calculation errors of newly loaded groups](new-group-calculation-feedback.md) | Fixed locally | Plan-context finding #3 (RML-18103) |
| [Plan-context findings: affected repositories](plan-context-findings-repository-scope.md) | Open — kernel and library scope remains | Plan-context finding #4 (RML-18138); library #60 (RML-18103) |
| [Snapshot loss after a prompt test page navigates](mcp-test-navigation-snapshot-loss.md) | Fixed locally | MCP test infrastructure backlog #3 |
| [Reserve a final answer step in the store chat](store-chat-final-answer-step.md) | Fixed locally | Ligna-store chat backlog #2 (RML-18033) |
| [Readable article and wall names in row-edit feedback](readable-row-edit-feedback.md) | Fixed locally — MCP change unlanded; UI change released | RML-18103 #62 |
| [Preserve the outcome when a provider failure interrupts a chat turn](chat-provider-failure-recovery.md) | Fixed locally — provider cause unconfirmed | RML-18103 #38 |
| [Connect a store planner to an external MCP agent without built-in chat](external-agent-store-bridge.md) | Fixed locally | Deployment/session backlog #1 |
| [Build the Cloudflare MCP image from the repository lockfile](cloudflare-image-root-lockfile.md) | Fixed locally | Deployment/session backlog #4 |
| [Forward launcher flags through the root npm scripts](root-launcher-flags.md) | Fixed locally | Deployment/session backlog #5 |
| [Stop the example servers when the launcher receives SIGTERM](launcher-sigterm-shutdown.md) | Fixed locally | Deployment/session backlog #6 |

Add bug analysis documents as needed following the naming convention:
`kebab-case-description.md` (e.g., `stale-group-position-after-move.md`).
