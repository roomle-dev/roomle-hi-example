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
- The main [`../../docs/hi-mcp-server.md`](../../docs/hi-mcp-server.md) document
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
| [generated-mcp-standard-tests.md](generated-mcp-standard-tests.md) | Implemented locally — not landed | MCP test infrastructure #4: generated standard coverage, checked session preparation, reporting and resume; verified locally |
| [explain-opening-clearance.md](explain-opening-clearance.md) | Implemented locally — not landed | RML-18103 #63: whether and how the answer names the door or window that determined a placement |
| [sales-configurator-ai-integration.md](sales-configurator-ai-integration.md) | Open — product integration scope | Core MCP/chat prototype implemented; reusable integration package, production agent loop and product qualification remain open |
| [reasoning-effort-per-gpt-chat-model.md](reasoning-effort-per-gpt-chat-model.md) | Open — example high effort landed; store effort and measurement open | RML-18043: example sets `high` for gpt-5-mini and gpt-5.4-mini and keeps the provider default for gpt-6-astra; store effort settings remain open; further measurement only on request |
| [reasoning-effort-per-gpt-chat-model-implementation-plan.md](reasoning-effort-per-gpt-chat-model-implementation-plan.md) | Open — example high effort landed; store effort and measurement open | RML-18043: example effort and usage logging implemented; store effort settings and their verification remain open; detailed measurement only on request |
| [article-template-geometry-in-plan-context.md](article-template-geometry-in-plan-context.md) | Open | RML-18140: derive the docking vectors and the corner point of an article that is not in the plan from a calculated template in `getPlanContext`, and drop the MCP server's anchor probe |

Add feature analysis documents as needed following the naming convention:
`kebab-case-description.md` (e.g., `group-adjustment-to-wall-width.md`).
