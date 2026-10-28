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
| [0001 — HI MCP tool logic runs in the MCP server, pages only execute planner methods](decisions/0001-hi-mcp-tool-logic-in-the-server.md) | Superseded by ADR 0011 |
| [0002 — One MCP server for every client, configured from outside](decisions/0002-one-mcp-server-configured-from-outside.md) | Superseded by ADR 0011 |
| [0003 — The AI chat is an MCP client beside the MCP server](decisions/0003-the-ai-chat-is-an-mcp-client-beside-the-server.md) | Superseded by ADR 0011 |
| [0004 — The HI MCP server runs as a Cloudflare Container, one container per session](decisions/0004-hi-mcp-server-on-cloudflare-containers.md) | Superseded by ADR 0011 |
| [0005 — The HI MCP server is deployed by a push to `release/cloudflare`](decisions/0005-deploy-hi-mcp-from-release-cloudflare.md) | Superseded by ADR 0011 |
| [0006 — The prompt tests assess the agent, the unit tests the tools](decisions/0006-prompt-tests-assess-the-agent.md) | Accepted |
| [0007 — The tool logic of the plan-changing HI MCP tools runs in the planner](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/hi-mcp-tool-logic-in-the-planner.md) | Accepted — its six-methods clause superseded by 0013; lives in roomle-ui |
| [0008 — The HI MCP server runs in the Roomle Cloudflare account, as PRD and DEV](decisions/0008-hi-mcp-prd-and-dev-in-the-roomle-cloudflare-account.md) | Superseded by ADR 0011 |
| [0009 — The chat window is a panel of the planner, the agent loop stays in the host](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/the-chat-window-is-a-panel-of-the-planner.md) | Accepted; lives in roomle-ui |
| [0010 — The example's chat runs in the page, with the planning assistant of the embedding-lib](decisions/0010-the-example-chat-runs-in-the-page.md) | Accepted — its server clause superseded by 0011 |
| [0011 — The HI tools live only in the roomle-ui embedding-lib](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/the-hi-tools-live-in-the-embedding-lib.md) | Accepted — its embedding-lib clause superseded by 0012; lives in roomle-ui |
| [0012 — The HI tool set runs in the planner, the embedding-lib forwards to it](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/the-hi-tool-set-runs-in-the-planner.md) | Accepted; lives in roomle-ui |
| [0013 — The library context is a planner method of its own](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/the-library-context-is-a-planner-method-of-its-own.md) | Accepted; lives in roomle-ui |
| [0014 — The Planning Assistant uses a shared reference prefix](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/the-planning-assistant-uses-a-shared-reference-prefix.md) | Accepted; lives in roomle-ui |
| [0015 — Keep live plan state and image guidance on demand](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/keep-live-plan-state-and-image-guidance-on-demand.md) | Accepted — automatic live/image preloads rejected; lives in roomle-ui |

---

## Living Reference

### Skills (On-Demand Domain Knowledge)

Skills provide deep domain knowledge for AI agents. Load them when the task matches their domain.

| Skill | Description | Load When |
|---|---|---|
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
| [hi-mcp-timing-benchmark.md](./skills/hi-mcp-timing-benchmark.md) | Detailed per-step model/tool/planner deltas, skills-to-first-kitchen and full-run times; report in benchmarks, local evidence and PDF | Detailed time measurements or how long the agent operates at each step |
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
| [hi-mcp-server.md](context/hi-mcp-server.md) | The example page: architecture, running, a demo walkthrough, example prompts, troubleshooting |
| [pages-chat-and-launcher.md](context/pages-chat-and-launcher.md) | `start.mjs`, the chat of the example page |
| [deployment-and-testing.md](context/deployment-and-testing.md) | The workspaces and scripts, the unit tests, the end-to-end test runs |
| [roomle-ui HOMAG Intelligence guideline](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence.md) | In roomle-ui: the HI tools, the planning assistant and the chat window — the architecture, the behaviour reference, the tool reference, the tool executors, layout and placement, library errors, coordinate systems, interior fittings |

### Wiki

Durable answers to recurring questions. Full index in [`wiki/README.md`](wiki/README.md).

| Page | Covers |
|---|---|
| [Planning Assistant: response time targets](wiki/planning-assistant-response-time-targets.md) | How fast the assistant has to plan a kitchen from a text prompt and from an image, milestone by milestone; where the time goes, and the levers that do not shorten it |
| [Group splitting in the UI and agent tools](wiki/group-splitting-in-the-ui-and-agent-tools.md) | Intentional splits when dragging out or deleting a middle module; UI behavior and agent tool contracts |
| [An MCP endpoint for the HI tools at `…/hi-mcp`](wiki/hi-mcp-endpoint-for-external-clients.md) | Why the planner cannot serve an MCP endpoint itself; the relay and the page bridge in the planner, what needs to be done and the concerns |
| [Why the agent cannot plan what the library cannot build](wiki/why-the-agent-cannot-plan-what-the-library-cannot-build.md) | The agent only chooses, the library calculates; what happens to wrong input and where the guarantee ends |

### Decisions (Architecture Decision Records)

ADRs document why the code is shaped the way it is; they are listed under [Decisions](#decisions). Create numbered ADR documents in `.agents/decisions/` as needed, following the [RoomleCore pattern](https://github.com/roomle-internal/RoomleCore/blob/master/documentation/decisions/README.md).

### User-Facing Documentation

`docs/` is for external readers. It holds user guides, setup and integration guides, and the
overviews those readers need: user-friendly and at a higher level. It says what the HI agent does
and how to use it. How the code of this repository is built lives in [`context/`](context/README.md),
never in `docs/`; the HI tools are documented in roomle-ui. Index:
[`docs/README.md`](../docs/README.md).

---

## Historical Records

**Point-in-time. May not reflect current behaviour.**

`Last touched` is the date of the last commit that changed the file's content. A pure move or rename does
not reset it. Treat it as a weak proxy for age and prefer the `Date` or `Status` in a document's own
status block where one is present.

### Bug Analyses

One document per bug: root-cause analysis written **before** the fix, closed out **after** it.

No bug analysis is open.

### Feature Analyses

One document per feature question: a proposed feature, a change to an existing one, or *why* a
feature behaves the way it does. Written **before** the work, closed out **after** it.

| Document | Status | Last touched |
|---|---|---|
| [Sales configurator AI integration: kickoff proposal](feature-analysis/sales-configurator-ai-integration.md) | Open — product integration scope; core MCP/chat prototype implemented | 2026-09-27 |

### Refactoring Analyses

One document per refactoring, written **before** the work and carrying the report once the work is
done. The analysis and the report are the same document — the report is appended at close-out.

| Document | Status | Last touched |
|---|---|---|
| [Planning Assistant performance: remaining work after the October 28 baselines](refactoring-analysis/planning-assistant-performance-next-steps.md) | Open — layout then refinement, staged article retrieval, description sharing and benchmark criteria | 2026-10-28 |

### Benchmarks & Performance Analyses

Performance measurements, bottleneck analyses, and optimization studies, in
[`benchmarks/`](benchmarks/README.md), written with
[hi-mcp-benchmarking.md](skills/hi-mcp-benchmarking.md). Each document keeps its benchmark in a
folder of the same name.

| Document | Status | Last touched |
|---|---|---|
| [Where the time goes when the HI agent plans a kitchen from an image](benchmarks/kitchen-from-image-time.md) | Third measurement (RML-18164): the six improvements one after another on one build and the local planner — baseline 104 s, 8.4 steps, 531k; the vocabulary section takes the search steps away (75 s, 6.5, 383k), the rest is stable within the spread | 2026-10-14 |
| [One skill round on the Azure deployment](benchmarks/06-az-skill-2026-10-27.md) | Proposal A measured on `gpt-6-astra` on Azure: every run creates at call 2, no reference fetch; first kitchen 29.655 s (image) and 30.290 s (text) against the session's 36.4 and 31.7 s | 2026-10-27 |
| [The library read before the first prompt on the Azure deployment](benchmarks/08-az-warm-2026-10-27.md) | Proposal F measured on `gpt-6-astra` on Azure: every page reads the library before the first prompt (729–754 ms); the first turn reads it in 6–8 ms and sends its first request after 0.03–0.05 s instead of 0.78–0.81 s on the build of 07; the creations keep the shape of 06 | 2026-10-27 |
| [The Azure series: benchmark comparison](benchmarks/az-cmp-2026-10-27.md) | The series from 06 on against the test session of 2026-10-27; A, the plan state per turn and the library read before the first prompt kept; 09 against the baselines: the two-level attribute section meets the criteria of the analysis, with the corrected sink descriptions without a measured cost; 10 against the baselines: the finishing calls in one response (D123) not accepted and reverted — the model keeps one call per response | 2026-10-27 |
| [Benchmark 11: left-wall image kitchen with the shortened descriptions and article details by id](benchmarks/11-iklw-az-arts-2026-10-28.md) | Reverted, not the refactoring of section 7.2, which is not yet tried properly. Benchmark 11 of image-kitchen-left-wall with the article descriptions shortened in both section forms and `get-plan-context` by `articleIds` (D63, D124), `gpt-6-astra` on Azure, in the layout of the baseline: every request 2,587 input tokens smaller, the seven calls of the baseline and no catalog read; the kitchen after 19.1 / 21.0 s, the turn 62.2 / 43.6 s; a door unit beside the sink instead of the dishwasher, as in the photo; the library changed since the baseline (five sink texts) | 2026-10-28 |
| [Benchmark 11: walnut text kitchen with the shortened descriptions and article details by id](benchmarks/11-fkwm-az-arts-2026-10-28.md) | Reverted, not the refactoring of section 7.2, which is not yet tried properly. Benchmark 11 of full-kitchen-walnut-marble-corner with the article descriptions shortened in both section forms and `get-plan-context` by `articleIds` (D63, D124), `gpt-6-astra` on Azure, in the layout of the baseline: every request 2,587 input tokens smaller, three calls and no catalog read; the kitchen after 29.4 / 26.3 s, the skill call waiting longer at the provider, the turn 34.8 / 32.2 s | 2026-10-28 |
| [Benchmark 10: left-wall image kitchen with the finishing calls in one response](benchmarks/10-iklw-az-resp-2026-10-28.md) | Benchmark 10 of image-kitchen-left-wall with the finishing calls in one response (D123), `gpt-6-astra` on Azure, in the layout of the baseline: the sentence reaches the model, but both runs keep the seven calls — the handle edit, the backsplash attempt and the render one per response —; the kitchen after 27.1 / 29.9 s, the turn 57.4 / 64.6 s, the create calls waiting 12.8 / 13.1 s for their first output | 2026-10-28 |
| [Benchmark 10: walnut text kitchen with the finishing calls in one response](benchmarks/10-fkwm-az-resp-2026-10-28.md) | Benchmark 10 of full-kitchen-walnut-marble-corner with the finishing calls in one response (D123), `gpt-6-astra` on Azure, in the layout of the baseline: three calls and no render, as in the baseline; the kitchen after 25.5 / 22.5 s, the turn 32.9 / 28.2 s | 2026-10-28 |
| [Benchmark 09: left-wall image kitchen with the two-level attribute section](benchmarks/09-iklw-az-attrs-2026-10-28.md) | Benchmark 09 of image-kitchen-left-wall with the two-level attribute section (D122) and the corrected sink descriptions, `gpt-6-astra` on Azure, in the layout of the baseline: the kitchen at call 2 with no lookup before it after 24.5 / 24.8 s (mean 24.7 s), the turn 47.8 / 48.8 s, 8,533 input tokens less per request, the create call 18.2 / 19.5 s; the sink clear of the hob; the handle colour looked up and set after the kitchen | 2026-10-27 |
| [Benchmark 09: walnut text kitchen with the two-level attribute section](benchmarks/09-fkwm-az-attrs-2026-10-28.md) | Benchmark 09 of full-kitchen-walnut-marble-corner with the two-level attribute section (D122) and the corrected sink descriptions, `gpt-6-astra` on Azure, in the layout of the baseline: the kitchen at call 2 after 40.0 / 25.9 s (mean 33.0 s), no lookup, 8,533 input tokens less per request, the create call 29.3 / 18.9 s; the article's hob and oven are the models the baseline chose | 2026-10-27 |
| [The baseline: walnut text kitchen on the Azure deployment](benchmarks/baseline-fkwm-az-2026-10-28.md) | The baseline of full-kitchen-walnut-marble-corner on `gpt-6-astra` on Azure, in the layout of 01: the kitchen at call 2 after 24.0 s in the mean, the create call the largest block | 2026-10-28 |
| [The baseline: left-wall image kitchen on the Azure deployment](benchmarks/baseline-iklw-az-2026-10-28.md) | The baseline of image-kitchen-left-wall on `gpt-6-astra` on Azure, in the layout of 01: the kitchen at call 2 after 21.4 s in the mean, the create call the largest block | 2026-10-28 |
| [Original left-wall image kitchen timing](benchmarks/01-iklw-oa-orig-2026-10-26.md) | Original baseline, preserved unchanged | 2026-10-26 |
| [Left-wall image kitchen: response-chaining run](benchmarks/02-iklw-oa-rc-2026-10-26.md) | Two chained repetitions; independent timing and per-call byte report | 2026-10-26 |
| [Left-wall image kitchen: preloads run](benchmarks/03-iklw-oa-rc-preloads-2026-10-26.md) | Discarded attempt — two measured repetitions retained; response-chaining behavior from 02 selected | 2026-10-26 |
| [Left-wall image kitchen: JPEG images and renders when due](benchmarks/04-iklw-oa-rc-jpg-due-2026-10-27.md) | Two repetitions on the local planner: 02's chaining with JPEG plan images and the served text on renders and reads; first kitchen 29.661 s, turn 52.327 s, 69 % less upload than 02 | 2026-10-27 |
| [Left-wall image kitchen: the status line of the window](benchmarks/05-iklw-oa-rc-status-2026-10-27.md) | Two repetitions on 04's planner with proposal B: the create named 5.6 / 3.7 s before it runs (04: 0.18 s); the reasoning summary is a call's first output and does not fill the wait for it; first kitchen 28.456 s, turn 59.954 s with 10 / 7 calls by the agent's post-create choices | 2026-10-27 |
| [Left-wall image kitchen: timing comparison](benchmarks/iklw-oa-rc-cmp-2026-10-26.md) | Original 01, chaining 02, preloads 03, JPEG images with renders when due 04 and the status line 05; per-call bytes, timing/stage deltas, the status line and usage | 2026-10-27 |
| [Planning Assistant shared-reference benchmark](benchmarks/planning-assistant-prompt-caching.md) | A/B/C content comparison, Azure cache-boundary checks, transport/input overhead and final minimum-suite validation | 2026-10-26 |

### Backlog

Outstanding defects, performance optimizations, and refactoring follow-ups for roomle-hi-example.

| Document | Last touched |
|---|---|
| [Backlog](backlog/README.md) — the open work: planning by the MCP server, the planner, the chat, the test infrastructure, the deployment and the page sessions, the ligna-store | 2026-10-25 |
| [Open MCP issues](backlog/mcp-issues.md) — defects and hardening in the HI tools, chat and planner | 2026-10-25 |
| [Open issues of the libraries](backlog/library-issues.md) — what the library data lacks for the agent to plan right and the calculation errors of values the library accepts, with description coverage and remaining work: colour classifications, door-resizing guidance, the shelf descriptor format, supported sizes, hinge configurations, traditional frame colours, end-panel colours and missing appliances | 2026-10-25 |
| [Open issues of roomle-ui](backlog/roomle-ui-issues.md) — defects of the planner outside the HI tool commands that the MCP prompt tests show: a dark worktop the renderer's top light makes look white | 2026-10-25 |
| [Where Mistral Large falls short of the prompts](backlog/mistral-large-prompt-issues.md) — improvement candidates from the `mistral-large-latest` test run: where the MCP server could give a weaker model better information or hints | 2026-10-17 |
| [Library-neutrality issues of the MCP server](backlog/mcp-policy-issues.md) — what in the MCP server still carries library-specific content: the served text's kitchen taxonomy, the search normalization and the result messages of the HI tool commands | 2026-10-14 |
| [Open issues of the MCP test infrastructure](backlog/mcp-test-infrastructure-issues.md) — the object-only render under software GL | 2026-10-17 |
| [A relation for a unit under a tabletop](backlog/under-relation-for-tabletops.md) — a live check of the tabletop's inner vectors, then an `under` relation | 2026-10-14 |
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
| **Living reference** — how things work now | `.agents/context/` or `.agents/skills/`; a user guide for external readers in `docs/` | Updated when behaviour changes; says what holds today — never what was wrong, when something was solved, or a ticket number |
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

Add to `docs/` folder and update the main README.md if appropriate. Only documentation for external
readers goes there — user guides, setup and integration guides, at a higher level; a document for
developers or agents goes into `.agents/`.

## See Also

- [AGENTS.md](../AGENTS.md) — AI assistant instructions and workflow

