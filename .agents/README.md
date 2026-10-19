# Digital Brain Index

## Purpose

The HI MCP Server enables interactive editing of HOMAG Intelligence objects (kitchens, cabinets, etc.) directly within the Roomle planner scene in the browser. This is explicitly **not** a headless approach where an AI agent defines a kitchen and outputs a file. The goal is to provide a chat window within a sales configurator where planning can be fully executed or modified through natural language prompting. The final deliverable will be an npm package that can be integrated into sales configurators with HI context, providing the infrastructure connection required for AI agent integration in the chat interface.

Every markdown document in this folder, in one place. Add a line here whenever you add a document —
see **Where Documentation Goes** in [`../AGENTS.md`](../AGENTS.md).

The split below matters when you are using these documents as context:

- **Living reference** — describes how the code works *now*. Keep it accurate; update it when the behaviour it
  describes changes.
- **Historical records** — point-in-time write-ups (a bug as it was analysed, a feature as it was studied, a
  refactoring as it was carried out). They are deliberately *not* updated. **Treat them as evidence of what was
  true on the date shown, not as a description of current behaviour** — always confirm against the code before
  acting on one.

Decisions about *why* the code is shaped the way it is live in `.agents/decisions/` (if needed).

---

## Decisions

Architecture Decision Records — why the code is shaped the way it is, and which approaches were
deliberately rejected. Read these before proposing a change to an area they cover.

| ADR | Status |
|---|---|
| [0001 — HI MCP tool logic runs in the MCP server, pages only execute planner methods](decisions/0001-hi-mcp-tool-logic-in-the-server.md) | Superseded in part by 0007 |
| [0002 — One MCP server for every client, configured from outside](decisions/0002-one-mcp-server-configured-from-outside.md) | Accepted |
| [0003 — The AI chat is an MCP client beside the MCP server](decisions/0003-the-ai-chat-is-an-mcp-client-beside-the-server.md) | Accepted |
| [0004 — The HI MCP server runs as a Cloudflare Container, one container per session](decisions/0004-hi-mcp-server-on-cloudflare-containers.md) | Superseded in part by 0008 |
| [0005 — The HI MCP server is deployed by a push to `release/cloudflare`](decisions/0005-deploy-hi-mcp-from-release-cloudflare.md) | Superseded in part by 0008 |
| [0006 — The prompt tests assess the agent, the unit tests the tools](decisions/0006-prompt-tests-assess-the-agent.md) | Accepted |
| [0007 — The tool logic of the plan-changing HI MCP tools runs in the planner](decisions/0007-hi-mcp-tool-logic-in-the-planner.md) | Accepted |
| [0008 — The HI MCP server runs in the Roomle Cloudflare account, as PRD and DEV](decisions/0008-hi-mcp-prd-and-dev-in-the-roomle-cloudflare-account.md) | Accepted |
| [0009 — The chat window is a panel of the planner, the agent loop stays in the host](decisions/0009-the-chat-window-is-a-panel-of-the-planner.md) | Accepted |

---

## Living Reference

### Skills (On-Demand Domain Knowledge)

Skills provide deep domain knowledge for AI agents. Load them when the task matches their domain.

| Skill | Description | Load When |
|---|---|---|
| [hi-mcp-server.md](./skills/hi-mcp-server.md) | MCP server architecture, HTTP handling, SSE bridge, protocol compliance | MCP server development, tool registration, bridge implementation |
| [hi-mcp-cloudflare-deployment.md](./skills/hi-mcp-cloudflare-deployment.md) | Cloudflare deployment of the hi-mcp server: wrangler deploy/update, URL anatomy, container cleanup, teardown | Deploying, updating, or troubleshooting the Cloudflare-hosted hi-mcp server |
| [hi-authoring-rules.md](./skills/hi-authoring-rules.md) | HI authoring patterns, docking vectors, group creation, positioning new groups with a placement | Creating or modifying HI groups, docking patterns, article selection |
| [hi-mcp-tools.md](./skills/hi-mcp-tools.md) | Complete MCP tool reference with parameters, examples, error handling | Using MCP tools, tool implementation, error diagnosis |
| [roomle-hi-concepts.md](./skills/roomle-hi-concepts.md) | Core HI concepts: rooms, walls, articles, groups, docking, data model | Understanding HI architecture, data structures, relationships |
| [hi-furniture-smith-article-catalog.md](./skills/hi-furniture-smith-article-catalog.md) | Furniture Smith article catalog | Article catalog reference |
| [hi-furniture-smith-attributes.md](./skills/hi-furniture-smith-attributes.md) | Furniture Smith attributes | Attribute reference |
| [hi-furniture-smith-materials.md](./skills/hi-furniture-smith-materials.md) | Furniture Smith materials | Materials reference |
| [vercel-ai-sdk-chat.md](./skills/vercel-ai-sdk-chat.md) | Vercel AI SDK chat integration: provider selection, server-side auth, @ai-sdk/mcp, streamText route | Implementing the AI chat window (RML-17984), Vercel AI SDK, MCP client integration |
| [hi-mcp-testing.md](./skills/hi-mcp-testing.md) | "Test the MCP": a temporary subset of `docs/test-prompts.json` (default every test, `gpt-5-mini`) run by `run-hi-mcp-tests.js` into `.temp/result/<session>/<model>/`, `report.md` with plan snapshot ids, images, evaluation and bug verdicts; the run script `run-hi-mcp-prompt.js` (a plan, operations, prompts and an image in headless Chromium, snapshot, plan snapshot id, planner calls) | The user asks to "test the mcp"; testing prompts or models against the real planner |
| [hi-analysis.md](./skills/hi-analysis.md) | "Analyse the bug" / "analyse the feature" / "analyse the refactoring": writing the analysis in `bug-analysis/`, `feature-analysis/` or `refactoring-analysis/` — what it must cover, the affected repositories it names first, where the fix lives (never the library's calculation) | The user asks to "analyse the bug", "analyze the bug", "bug analysis", "analyse the feature", "feature analysis", "analyse the refactoring" or "refactoring analysis"; investigating a defect, a feature or a refactoring |
| [hi-analysis-cleanup.md](./skills/hi-analysis-cleanup.md) | "Cleanup analyses": clean up `bug-analysis/`, `feature-analysis/` and `refactoring-analysis/` — verify every analysis, promote the durable outcome of the landed ones into the living reference, decisions, ADRs, backlog and skills, delete them, fix the links, rebuild this index | The user says "cleanup analyses" or "cleanup analysis"; reviewing or tidying the analysis folders |
| [hi-backlog-cleanup.md](./skills/hi-backlog-cleanup.md) | "Cleanup backlog": the backlog as open todos only — verify every item against the code, remove what landed, strip history, refresh the code references | The user says "cleanup backlog"; reviewing or updating the backlog |
| [update-planning-results.md](./skills/update-planning-results.md) | "Update planning results": `docs/planning-results.md` regenerated — every kitchen image of `docs/images` planned by the HI chat (default `gpt-6-astra`) with `update-planning-results.js`, the plan snapshots with their ligna-store links, the top, perspective and perspective object images | The user says "update planning results" |
| [hi-mcp-benchmarking.md](./skills/hi-mcp-benchmarking.md) | Benchmarks of the HI agent: the chat time of test runs per model step (tokens, model time, tool time, planner calls) with `benchmark-hi-mcp-runs.js`, the analysis of where the time goes, the document in `benchmarks/` | The user asks to benchmark or measure the performance, where the time goes, or to compare the speed before and after a change |
| [roomle-pr-resolution.md](./skills/roomle-pr-resolution.md) | Resolving a pull request: verifying suggested changes, applying them, replying to every review comment, resolving threads | Resolving a PR; never merge it |
| [hi-plan-implementation.md](./skills/hi-plan-implementation.md) | Planning a task or implementation — the plan must include unit tests | Planning a task or implementation |
| [hi-analysis-closeout.md](./skills/hi-analysis-closeout.md) | Closing out a single analysis document once its work has landed: verify it landed, promote the durable outcome, delete the analysis | Work with an analysis document is being committed |
| [hi-github-workflow.md](./skills/hi-github-workflow.md) | Git staging rules, conventional commit format, pre-commit verification checklist, PR guidelines | Before every commit, push, or pull request |

### Scripts

Agent utility scripts for automating repository tasks. Full index in [`scripts/README.md`](scripts/README.md).

| Script | Description |
|---|---|
| [run-hi-mcp-prompt.js](scripts/run-hi-mcp-prompt.js) | Run a single prompt through the chat with a real model and planner |
| [run-hi-mcp-tests.js](scripts/run-hi-mcp-tests.js) | Run the tests of `docs/test-prompts.json` and write an evaluated report |
| [update-planning-results.js](scripts/update-planning-results.js) | Regenerate `docs/planning-results.md` from kitchen images |
| [benchmark-hi-mcp-runs.js](scripts/benchmark-hi-mcp-runs.js) | Benchmark test runs: per-step timing, token counts, model and tool time |
| [check-markdown-links.js](scripts/check-markdown-links.js) | Check markdown links across the repository |

### Context

Living reference of the implementation: how the code is built today. Full index in [`context/README.md`](context/README.md).

| Document | Covers |
|---|---|
| [mcp-server.md](context/mcp-server.md) | `server.ts`, tool registration, the page bridge, the planner methods, undo and redo |
| [tool-executors.md](context/tool-executors.md) | Overview of all MCP tools, `tool-executors.ts`, `agent-facing.ts`, the tool commands of roomle-ui |
| [layout-and-placement.md](context/layout-and-placement.md) | roomle-ui `hi-group-layout.ts`, `hi-group-placement.ts`, `hi-plan-space.ts`, `hi-wall-placement.ts`, the coordinate conventions |
| [pages-chat-and-launcher.md](context/pages-chat-and-launcher.md) | The page side of the bridge, `start.mjs`, the chat backend `hi-mcp-chat` |
| [deployment-and-testing.md](context/deployment-and-testing.md) | Cloudflare, the workspaces and scripts, the unit tests, the end-to-end test runs |

### Wiki

Durable answers to recurring questions. Full index in [`wiki/README.md`](wiki/README.md).

| Page | Covers |
|---|---|
| — | No wiki pages yet |

### Decisions (Architecture Decision Records)

ADRs document why the code is shaped the way it is; they are listed under [Decisions](#decisions). Create numbered ADR documents in `.agents/decisions/` as needed, following the [RoomleCore pattern](https://github.com/roomle-internal/RoomleCore/blob/master/documentation/decisions/README.md).

### User-Facing Documentation

Living reference documentation for end users and developers is maintained in the `docs/` folder:

- [hi-mcp-behaviour.md](../docs/hi-mcp-behaviour.md) — How the MCP server behaves towards an agent: guidelines, decisions, tools, the information it provides, guards, corrections and feedback
- [hi-mcp-server.md](../docs/hi-mcp-server.md) — Complete MCP server documentation
- [hi-mcp-poc-presentation.md](../docs/hi-mcp-poc-presentation.md) — Proof of concept presentation

---

## Historical Records

**Point-in-time. May not reflect current behaviour.**

`Last touched` is the date of the last commit that changed the file's content. A pure move or rename does
not reset it. Treat it as a weak proxy for age and prefer the `Date` or `Status` in a document's own
status block where one is present.

### Bug Analyses

One document per bug: root-cause analysis written **before** the fix, closed out **after** it.

| Document | Status | Last touched |
|---|---|---|
| [The sink unit descriptions do not say that a sink unit needs an article on its right](bug-analysis/sink-unit-description-missing-right-neighbour.md) | Open — library change proposed | 2026-10-10 |
| [A corner group stands in front of the adjoining wall's window](bug-analysis/corner-group-in-front-of-adjoining-wall-window.md) | Fixed | 2026-10-16 |
| [The wall units hang at two heights after a plinth height in the group attributes](bug-analysis/wall-units-hang-at-two-heights-after-plinth-change.md) | Open — implemented and locally verified on branch; pending landing | 2026-10-18 |
| [A wall-level article of another category is taken for a floor unit](bug-analysis/wall-level-article-of-another-category-taken-for-floor-unit.md) | Fixed — locally verified on branches; pending landing | 2026-10-18 |
| [The backsplash of an image kitchen is reported as not buildable](bug-analysis/backsplash-of-an-image-kitchen-reported-as-not-buildable.md) | Fixed — closed as resolved by the user; roomle-ui change pending landing | 2026-10-18 |
| [An edit that gives a row a new end leaves a door hinged to the outside](bug-analysis/edit-that-gives-a-row-a-new-end-leaves-a-door-hinged-to-the-outside.md) | Open — implemented and unit verified; live model acceptance awaiting approval | 2026-10-18 |
| [An island's back row of other widths lands off the front row](bug-analysis/islands-back-row-of-other-widths-lands-off-the-front-row.md) | Open — reproduced; served-text fix first, endpoint-mode alignment as fallback | 2026-10-18 |
| [A swap of a widened unit is refused for want of a docking vector](bug-analysis/swap-of-widened-unit-refused-for-want-of-docking-vector.md) | Open — feedback and recovery implemented on a branch based on `release/bo-test`; live acceptance and library descriptions pending | 2026-10-19 |

### Feature Analyses

One document per feature question: a proposed feature, a change to an existing one, or *why* a
feature behaves the way it does. Written **before** the work, closed out **after** it.

| Document | Status | Last touched |
|---|---|---|
| [Sales configurator AI integration: kickoff proposal](feature-analysis/sales-configurator-ai-integration.md) | Open — product integration scope; core MCP/chat prototype implemented | 2026-09-27 |
| [Installation elements in the HI plan context](feature-analysis/installation-elements-in-hi-plan-context.md) | Open — RML-18023: type and position for electric plugs and water connections; roomle-ui `feat/water-connection` and HI MCP changes | 2026-10-19 |
| [Interior Design: editing HI sub-articles through MCP](feature-analysis/interior-design-sub-articles.md) | Implemented on feature branches — direct acceptance and limited AI smoke test | 2026-10-19 |

### Refactoring Analyses

One document per refactoring, written **before** the work and carrying the report once the work is
done. The analysis and the report are the same document — the report is appended at close-out.

| Document | Status | Last touched |
|---|---|---|
| [The object perspective image in get-plan-images instead of the plan perspective](refactoring-analysis/object-image-in-get-plan-images.md) | Open | 2026-10-06 |

### Benchmarks & Performance Analyses

Performance measurements, bottleneck analyses, and optimization studies, in
[`benchmarks/`](benchmarks/README.md), written with
[hi-mcp-benchmarking.md](skills/hi-mcp-benchmarking.md). Each document keeps its benchmark in a
folder of the same name.

| Document | Status | Last touched |
|---|---|---|
| [Where the time goes when the HI agent plans a kitchen from an image](benchmarks/kitchen-from-image-time.md) | Third measurement (RML-18164): the six improvements one after another on one build and the local planner — baseline 104 s, 8.4 steps, 531k; the vocabulary section takes the search steps away (75 s, 6.5, 383k), the rest is stable within the spread | 2026-10-14 |

### Backlog

Outstanding defects, performance optimizations, and refactoring follow-ups for roomle-hi-example.

| Document | Last touched |
|---|---|
| [Backlog](backlog/README.md) — the open work: planning by the MCP server, the planner, the chat, the test infrastructure, the deployment and the page sessions, the architecture, the ligna-store | 2026-10-18 |
| [Open MCP issues](backlog/mcp-issues.md) — the open defects and hardening of the MCP server, its served text, the chat and the planner: island back-row alignment | 2026-10-19 |
| [Open issues of the libraries](backlog/library-issues.md) — what the library data lacks for the agent to plan right, with the status of the report to the library development team: sink drainer width and the restriction on a hob to its right, handleless fronts, the sizes of flip-lift wall cabinets, end panels with a plain upright colour, width-dependent tall-unit doors | 2026-10-19 |
| [Open issues of roomle-ui](backlog/roomle-ui-issues.md) — defects of the planner outside the HI tool commands that the MCP prompt tests show: a dark worktop the renderer's top light makes look white | 2026-10-16 |
| [Where Mistral Large falls short of the prompts](backlog/mistral-large-prompt-issues.md) — improvement candidates from the `mistral-large-latest` test run: where the MCP server could give a weaker model better information or hints | 2026-10-17 |
| [Library-neutrality issues of the MCP server](backlog/mcp-policy-issues.md) — what in the MCP server still carries library-specific content: the served text's kitchen taxonomy, the search normalization and the result messages of the HI tool commands | 2026-10-14 |
| [Reasoning effort for the GPT chat models](backlog/reasoning-effort-for-the-gpt-chat-models.md) — the ligna-store chat sends no reasoning effort; further measurement only on request | 2026-10-14 |
| [Open issues of the MCP test infrastructure](backlog/mcp-test-infrastructure-issues.md) — the object-only render under software GL | 2026-10-17 |
| [Deployment, launcher and page sessions](backlog/deployment-and-session-issues.md) — access control, the DEV branch policy and the teardown of the personal deployment | 2026-10-14 |
| [A relation for a unit under a tabletop](backlog/under-relation-for-tabletops.md) — a live check of the tabletop's inner vectors, then an `under` relation | 2026-10-14 |
| [The HI tools in the embedding-lib instead of the Cloudflare MCP server](backlog/hi-tools-in-the-embedding-lib.md) — the page provides the MCP tools from the embedding-lib (`src/homag-intelligence`); the server, the page bridges and the Cloudflare deployment go | 2026-10-16 |
| [A backend-controlled agent loop with browser-executed scene tools](backlog/backend-agent-loop-with-browser-scene-tools.md) — the scene tools in the browser, the agent loop and the credentials in the backend | 2026-10-07 |
| [Analyse how Spec Kit can help with the prompting](backlog/speckit-for-the-prompting.md) — Spec Kit's prompt sections as inspiration for the served text and the chat prompt | 2026-10-07 |

---

## Analysis Workflow

### Trigger Phrases

The following phrases trigger the analysis workflow automatically:

- **"analyse the bug"** / **"analyze the bug"** / **"bug analysis"** → Creates document in `.agents/bug-analysis/`
- **"analyse the feature"** / **"analyze the feature"** / **"feature analysis"** → Creates document in `.agents/feature-analysis/`
- **"analyse the refactoring"** / **"analyze the refactoring"** / **"refactoring analysis"** → Creates document in `.agents/refactoring-analysis/`

### Document Lifecycle

1. **Write analysis** — Before any code changes, write the complete analysis document
2. **Do the work** — Implement the fix, feature, or refactoring
3. **Close out** — Update the document with the results, set status, promote durable knowledge
4. **Delete once landed** — when the work is on `master` (a roomle-ui fix: on `release/bo-test` or `master`), ["cleanup analyses"](skills/hi-analysis-cleanup.md) promotes the durable outcome and deletes the document; git history, the Jira comment and the pull request keep the record. A solved bug keeps no analysis

### Status Values

| Analysis Type | Status Values |
|---|---|
| Bug Analysis | `Open`, `Fixed` |
| Feature Analysis | `Open`, `Implemented`, `Rejected` |
| Refactoring Analysis | `Open`, `Done` |

### Naming Convention

Use kebab-case for document filenames:
- `stale-group-position-after-move.md`
- `mcp-bridge-simplification.md`
- `add-article-lookup-tool.md`

### Document Structure

Every analysis document should include:

**Bug Analysis:**
- Symptom and reproduction
- Investigation trace with file:line references
- Exact root cause
- Why current code is wrong
- Proposed clean fix

**Feature Analysis:**
- What was asked and why
- How the area works today with code references
- The gap or question answered
- Proposed design or change
- Alternatives considered and rejected
- Code and documents the work would touch

**Refactoring Analysis:**
- What current code does and why it's a problem
- Full scope with file:line references
- Proposed target shape
- Tests covering affected behaviour
- Output changes to expect
- For performance: benchmark to run before/after

---

## Where Documentation Goes

| What you produced | Where it goes | Lifecycle |
|---|---|---|
| **Living reference** — how things work now | `.agents/skills/` or `docs/` | Updated when behaviour changes; says what holds today — never what was wrong, when something was solved, or a ticket number |
| **Implementation context** — how the code is built | `.agents/context/` | Living reference; every new feature is documented and added here, every change requires an update here |
| **Historical record** — analysis, benchmark, refactoring | `.agents/<analysis-type>/` | Never updated after close-out; deleted by ["cleanup analyses"](skills/hi-analysis-cleanup.md) once the work has landed |
| **Decision** — why code is shaped this way | `.agents/decisions/` | Living reference |
| **ADR** — architecture decision record | `.agents/decisions/` | Living reference |
| **Wiki page** — a durable answer to a recurring question | `.agents/wiki/` | Living reference, no lifecycle |
| **Open work** | `.agents/backlog/` | Removed when done |

## Adding New Documentation

### For AI Agents (Digital Brain)

1. **Skills**: Add to `.agents/skills/` for on-demand domain knowledge
2. **Bug Analysis**: Add to `.agents/bug-analysis/` before fixing
3. **Feature Analysis**: Add to `.agents/feature-analysis/` before implementing
4. **Refactoring Analysis**: Add to `.agents/refactoring-analysis/` before refactoring
5. **Implementation context**: Add to `.agents/context/` when a feature is added or the implementation changes
6. **Wiki page**: Add to `.agents/wiki/` for a durable answer to a recurring question
7. **Update this index**: Add a line to the appropriate table

### For End Users

Add to `docs/` folder and update the main README.md if appropriate.

## See Also

- [AGENTS.md](../AGENTS.md) — AI assistant instructions and workflow

- [Interior fitting implementation](context/interior-fittings.md) — scoped discovery and fitting edits through the existing planner bridge.
