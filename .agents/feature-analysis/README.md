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
Never delete an analysis document.

## Current Documents

| Document | Status | Description |
|---|---|---|
| [planner-mcp-server-analysis.md](planner-mcp-server-analysis.md) | Implemented | Comprehensive analysis of Planner MCP server from roomle-model-exporter |
| [sales-configurator-ai-integration.md](sales-configurator-ai-integration.md) | Open | Feature analysis for Sales Configurator AI integration kickoff proposal |
| [hi-mcp-poc-json.md](hi-mcp-poc-json.md) | Open | Feature analysis for the hi-mcp TypeScript project and the hi-mcp-poc-json MCP server with the INT-stage ligna-store as client |
| [mcp-azure-deployment-and-session-bootstrapping.md](mcp-azure-deployment-and-session-bootstrapping.md) | Open | The three PoC setups (local/deployed store, local/Azure MCP server): one bridge URL rule plus env-driven server config, all implemented; Azure App Service deployment mechanics and roadmap |
| [mcp-cloudflare-containers-deployment.md](mcp-cloudflare-containers-deployment.md) | Open | Hosting the hi-mcp server on Cloudflare Containers following the roomle-model-exporter cf/ pattern: unchanged server in a container, Worker front, per-session containers for company-wide try-out; WebSocket passthrough as the core unknown |

Add feature analysis documents as needed following the naming convention:
`kebab-case-description.md` (e.g., `group-adjustment-to-wall-width.md`).
