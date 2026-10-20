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
| [installation-elements-in-hi-plan-context.md](installation-elements-in-hi-plan-context.md) | Open | RML-18023: separate electric plugs and water connections from obstacles, with their type and position; scope across Core, roomle-ui `feat/water-connection` and HI MCP |
| [sales-configurator-ai-integration.md](sales-configurator-ai-integration.md) | Open — product integration scope | Core MCP/chat prototype implemented; reusable integration package, production agent loop and product qualification remain open |
| [hi-mcp-open-and-close-cabinets.md](hi-mcp-open-and-close-cabinets.md) | Open | RML-18232: MCP tools that open and close a group or an article through `externalObjectGroupOperation` (operations in roomle-ui `hi-tools.ts`), and a snapshot property that renders open doors and drawers as they are |
| [hi-mcp-tools-in-the-embedding-lib-first-step.md](hi-mcp-tools-in-the-embedding-lib-first-step.md) | Open | RML-18196, first step: the MCP server's tools copied into roomle-ui `packages/embedding-lib/src/homag-intelligence/hi-mcp/` as `createHiMcpTools` of `src/hi.ts`, the HI presets demo on the tool set; the model-facing surface kept by MCP-shaped results |
| [interior-design-sub-articles.md](interior-design-sub-articles.md) | Implemented on feature branches | Interior-fitting discovery, add, move, delete and replace through the roomle-ui HI API, MCP and AI assistant; completion, identity and history contracts |

Add feature analysis documents as needed following the naming convention:
`kebab-case-description.md` (e.g., `group-adjustment-to-wall-width.md`).
