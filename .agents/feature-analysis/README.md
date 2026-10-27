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
- The main [`.agents/context/hi-mcp-server.md`](../context/hi-mcp-server.md) document and the other documents of `.agents/context/`
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
| [planning-assistant-attribute-information.md](planning-assistant-attribute-information.md) | Open — the question answered; the two-level design proposed, the same for every library, accepted only after its measurement; validated, the level-1 section 88 KB instead of 121 KB | What the agent gets about the attributes (every attribute with its values, 121 KB, about 27,000 tokens, half of the cached library reference), what it costs and how it grows, what the agent set in 79 runs (50 of 397 attributes, the look of the group at the create, the rest after the first kitchen) and when it needs the values; the size is the library's and grows with its descriptions, so the design cannot rest on one library's state; the two-level design: the possibilities in the prefix, the values of the attributes the library's structure marks for the create, the details on request; the alternatives and the measurement |
| [sales-configurator-ai-integration.md](sales-configurator-ai-integration.md) | Open — product integration scope | Core MCP/chat prototype implemented; reusable integration package, production agent loop and product qualification remain open |

Add feature analysis documents as needed following the naming convention:
`kebab-case-description.md` (e.g., `group-adjustment-to-wall-width.md`).
