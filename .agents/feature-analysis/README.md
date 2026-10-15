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
| [agent-prompts-from-the-glue-logic.md](agent-prompts-from-the-glue-logic.md) | Implemented, branches not merged | RML-18187: the system and image prompts as an API of the roomle-ui glue logic, an image-planning skill of the MCP server, and the prompts naming the skills |
| [planning-assistant-chat-in-roomle-ui.md](planning-assistant-chat-in-roomle-ui.md) | Open, analysed and planned | RML-18190: the Planning Assistant chat window as a drawer panel of roomle-ui behind `featureFlags.planningAssistant`, the prompt callback and the output API it needs, the example page and the store as its hosts; the implementation plan with the unit tests in §8 |
| [sales-configurator-ai-integration.md](sales-configurator-ai-integration.md) | Open — product integration scope | Core MCP/chat prototype implemented; reusable integration package, production agent loop and product qualification remain open |

Add feature analysis documents as needed following the naming convention:
`kebab-case-description.md` (e.g., `group-adjustment-to-wall-width.md`).
