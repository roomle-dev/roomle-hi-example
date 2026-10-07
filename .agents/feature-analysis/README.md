# Feature Analyses

One document per feature question: a proposed feature, a change to an existing one, or *why* a
feature behaves the way it does. Written **before** the work, closed out **after** it.

Triggered by **"analyse the feature"** / **"analyze the feature"** / **"feature analysis"** — see
**Analysis Triggers** in [`../../AGENTS.md`](../../AGENTS.md).

## What belongs here

Point-in-time, decision-driving write-ups. The document must cover:

- what was asked and why
- how the area works today, with code/file references
- the gap or question the analysis answers
- the proposed design or change
- the alternatives considered and why they were rejected
- the code and documents the work would touch

## What does not belong here

**A description of how a feature works today.** That is living reference and belongs in
domain-specific documentation. Everything in this folder is historical/point-in-time records.

For roomle-hi-example, living-reference feature descriptions should be in:
- The main [`../../minimal-hi-example/docs/hi-mcp-server.md`](../../minimal-hi-example/docs/hi-mcp-server.md) document
- Tool-specific documentation in the skill files under `.agents/`

## Close-out

When the feature is implemented, the description of how it works is promoted into the
appropriate living-reference document, and this document is set to `Implemented`.
When the approach is rejected, the reasoning is documented here and the document is set to `Rejected`.

Mechanics: Update the relevant documentation, then close out this analysis.
Once the work is on `master`, ["cleanup analyses"](../skills/hi-analysis-cleanup.md) promotes the durable outcome and deletes this document.

## Current Documents

| Document | Status | Description |
|---|---|---|
| [sales-configurator-ai-integration.md](sales-configurator-ai-integration.md) | Open | Feature analysis for Sales Configurator AI integration kickoff proposal |
| [mcp-azure-deployment-and-session-bootstrapping.md](mcp-azure-deployment-and-session-bootstrapping.md) | Open | The three PoC setups (local/deployed store, local/Azure MCP server): one bridge URL rule plus env-driven server config, all implemented; Azure App Service deployment mechanics and roadmap |
| [reasoning-effort-per-gpt-chat-model.md](reasoning-effort-per-gpt-chat-model.md) | Open | RML-18043, step by step: (1) the step log read the wrong usage field — fixed; (2) an effort per Foundry deployment from the measured data — gpt-5.4-mini does not reason by default — verified by unit tests and one live run per deployment; (3) detailed measurement only on request, with its time and token cost |
| [reasoning-effort-per-gpt-chat-model-implementation-plan.md](reasoning-effort-per-gpt-chat-model-implementation-plan.md) | Open | RML-18043 implementation plan, one verified step at a time: step 1 the log fix (done), step 2 `low` / `medium` / `medium` in the example chat and the ligna-store with four unit tests and a five-minute live check, step 3 only on request |

Add feature analysis documents as needed following the naming convention:
`kebab-case-description.md` (e.g., `group-adjustment-to-wall-width.md`).
