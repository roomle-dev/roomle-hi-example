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
| [hi-mcp-deployment-in-roomle-cloudflare-account.md](hi-mcp-deployment-in-roomle-cloudflare-account.md) | Open — PRD and DEV deployed by hand (`hi-planning-assistant[-dev].dashiell-bell.workers.dev`); local deploy scripts, `account_id` and the workflow on `ci/cludflare-deplyoment`; GitHub environments and token open | RML-18154: the MCP server moves from the personal Cloudflare account to the Roomle account as the Workers `hi-planning-assistant` (PRD, `release/cloudflare`) and `hi-planning-assistant-dev` (DEV, `release/cloudflare.dev`); the setup, an account API token for GitHub, and the wrangler account cache that `account_id` in the config overrides |
| [kitchen-from-image-improvements.md](kitchen-from-image-improvements.md) | Implemented — roomle-hi-example `feat/rml-18164-kitchen-from-image-improvements`, roomle-ui `feat/hi-kitchen-from-image-improvements-RML-18164` (from `release/bo-test`); not merged | RML-18164: the six improvements of the kitchen-from-image benchmark (§9.6) — per improvement today's code, the change, the unit tests and the check after it; the order, the runs and the open decisions |
| [planning-skills-served-by-the-mcp-server.md](planning-skills-served-by-the-mcp-server.md) | Implemented — roomle-hi-example `feat/planning-skills-tool-RML-18148`, ligna-store `feat/planning-skills-read-only-RML-18148`, not merged | RML-18148: the planning skills of HOMAG (kitchen, kitchen in France, living room) served to every client by the MCP server — the skill files in the server package, one tool `get-skill` with the skill index in its description, the Skills extension of MCP (SEP-2640) as the later step |
| [sales-configurator-ai-integration.md](sales-configurator-ai-integration.md) | Open — product integration scope | Core MCP/chat prototype implemented; reusable integration package, production agent loop and product qualification remain open |
| [article-template-geometry-in-plan-context.md](article-template-geometry-in-plan-context.md) | Implemented — roomle-ui `feat/hi-plan-context-article-geometry-RML-18140`, not merged | RML-18140: the catalog of the plan context carries the docking vectors and the corner flag of every article from templates the planner calculates once per page (0.75 s for 111 articles, measured), the article selector and the corner word matches of the server and the glue logic go; based on roomle-ui `feat/hi-layout-load-outcome-RML-18139` |
| [group-load-result-per-input-group.md](group-load-result-per-input-group.md) | Implemented — roomle-ui `feat/hi-layout-load-outcome-RML-18139`, not merged | RML-18139: the glue-logic answers a layout load per input group — built, restored or left out with the reason — and `create-or-replace-groups` reports a left-out group and a restored replace in `notLoaded` and pairs the groups of the call by that answer; based on roomle-ui `refactor/hi-tool-logic-RML-18147` |

Add feature analysis documents as needed following the naming convention:
`kebab-case-description.md` (e.g., `group-adjustment-to-wall-width.md`).
