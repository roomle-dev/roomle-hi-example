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
| [planning-assistant-time-to-first-attempt.md](planning-assistant-time-to-first-attempt.md) | Open — D (JPEG plan images) done, E (when a render is due, a turn's changes build on their results) done, accepted with the minimum set of "test the mcp" and the two asked-render tests, on `master` here; B done: the tool named at the start of its call kept, the reasoning summary discarded after benchmark 05; A done: the reference served with the skill, accepted in benchmark 06 on the Azure deployment; G done without its selector: the plan state supplied per turn, accepted in benchmark 07; F done as the library read before the first prompt, accepted in benchmark 08, the compacted library context kept rejected | The ticket's performance ideas and the proposals of the external document on the skill architecture (`docs/external/`) evaluated against the measurements and the implementation; where the time to the first attempt goes (three rounds and the reasoning of the create call); the improvements in order: one skill round, the skills of the turn selected before the first call, progress in the window, JPEG plan images, the library context kept, the rounds after the create; fine-tuning rejected |
| [planning-assistant-attribute-information.md](planning-assistant-attribute-information.md) | Open — the question answered; the two-level design proposed, the same for every library, accepted only after its measurement | What the agent gets about the attributes (every attribute with its values, 121 KB, about 27,000 tokens, half of the cached library reference), what it costs and how it grows, what the agent set in 79 runs (47 of 397 attributes, the look of the group at the create, the rest in edits) and when it needs the values; the size is the library's and grows with its descriptions, so the design cannot rest on one library's state; the two-level design: the possibilities in the prefix, the values of the attributes the library's structure marks for the create, the details on request; the alternatives and the measurement |
| [planning-assistant-skill-selector.md](planning-assistant-skill-selector.md) | Implemented in part — the plan state per turn done and accepted in benchmark 07 on the Azure deployment; the selector deferred to the backlog with the choice of the models | A small model selects the skills of a request before the first model call and the assistant supplies them with the live plan sections, so the create comes at call 1; the design against the code and the session's 99 turns (89 read the live sections first; a word match names the right skill in 13 of 40), the alternatives, the decisions to take, benchmark 07 on the Azure deployment |
| [prompt-preloads.md](prompt-preloads.md) | Rejected | Added lifecycle complexity without overall benefit; source restored to response-chaining behavior from 02; analysis and benchmark 03 retained |
| [openai-provider-launcher.md](openai-provider-launcher.md) | Implemented | Direct OpenAI CLI prefix, exact model selection and verified published embedding provider |
| [planning-assistant-token-count-protocol.md](planning-assistant-token-count-protocol.md) | Implemented | Prompt usage logging and report totals verified with the SHA-pinned embedding-lib dev package |
| [sales-configurator-ai-integration.md](sales-configurator-ai-integration.md) | Open — product integration scope | Core MCP/chat prototype implemented; reusable integration package, production agent loop and product qualification remain open |

Add feature analysis documents as needed following the naming convention:
`kebab-case-description.md` (e.g., `group-adjustment-to-wall-width.md`).
