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
| [0001 — HI MCP tool logic runs in the MCP server, pages only execute planner methods](decisions/0001-hi-mcp-tool-logic-in-the-server.md) | Accepted |
| [0002 — One MCP server for every client, configured from outside](decisions/0002-one-mcp-server-configured-from-outside.md) | Accepted |
| [0003 — The AI chat is an MCP client beside the MCP server](decisions/0003-the-ai-chat-is-an-mcp-client-beside-the-server.md) | Accepted |
| [0004 — The HI MCP server runs as a Cloudflare Container, one container per session](decisions/0004-hi-mcp-server-on-cloudflare-containers.md) | Accepted |
| [0005 — The HI MCP server is deployed by a push to `release/cloudflare`](decisions/0005-deploy-hi-mcp-from-release-cloudflare.md) | Accepted |
| [0006 — The prompt tests assess the agent, the unit tests the tools](decisions/0006-prompt-tests-assess-the-agent.md) | Accepted |

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
| [vercel-ai-sdk-chat.md](./skills/vercel-ai-sdk-chat.md) | Vercel AI SDK chat integration: provider selection, server-side auth, @ai-sdk/mcp, streamText route | Implementing the AI chat window (RML-17984), Vercel AI SDK, MCP client integration |
| [hi-mcp-testing.md](./skills/hi-mcp-testing.md) | "Test the MCP": a temporary subset of `docs/test-prompts.json` (default every test, `gpt-5-mini`) run by `run-hi-mcp-tests.js` into `.temp/result/<session>/<model>/`, `report.md` with plan snapshot ids, images, evaluation and bug verdicts; the run script `run-hi-mcp-prompt.js` (a plan, operations, prompts and an image in headless Chromium, snapshot, plan snapshot id, planner calls) | The user asks to "test the mcp"; testing prompts or models against the real planner |
| [hi-analysis-cleanup.md](./skills/hi-analysis-cleanup.md) | "Cleanup analyses": clean up `bug-analysis/`, `feature-analysis/` and `refactoring-analysis/` — verify every analysis, promote the durable outcome of the landed ones into the living reference, decisions, ADRs, backlog and skills, delete them, fix the links, rebuild this index | The user says "cleanup analyses" or "cleanup analysis"; reviewing or tidying the analysis folders |
| [hi-backlog-cleanup.md](./skills/hi-backlog-cleanup.md) | "Cleanup backlog": the backlog as open todos only — verify every item against the code, remove what landed, strip history, refresh the code references | The user says "cleanup backlog"; reviewing or updating the backlog |
| [hi-mcp-benchmarking.md](./skills/hi-mcp-benchmarking.md) | Benchmarks of the HI agent: the chat time of test runs per model step (tokens, model time, tool time, planner calls) with `benchmark-hi-mcp-runs.js`, the analysis of where the time goes, the document in `benchmarks/` | The user asks to benchmark or measure the performance, where the time goes, or to compare the speed before and after a change |

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
| [Snapshot loss after a prompt test page navigates](bug-analysis/mcp-test-navigation-snapshot-loss.md) | Fixed — verified locally | 2026-10-09 |
| [Reserve a final answer step in the store chat](bug-analysis/store-chat-final-answer-step.md) | Fixed — verified locally | 2026-10-09 |
| [Readable article and wall names in row-edit feedback](bug-analysis/readable-row-edit-feedback.md) | Fixed — verified locally | 2026-10-09 |
| [Preserve the outcome when a provider failure interrupts a chat turn](bug-analysis/chat-provider-failure-recovery.md) | Fixed locally — interrupted turns recovered; provider cause unconfirmed | 2026-10-09 |
| [Connect a store planner to an external MCP agent without built-in chat](bug-analysis/external-agent-store-bridge.md) | Fixed locally — independent bridge and matching session links | 2026-10-09 |
| [Build the Cloudflare MCP image from the repository lockfile](bug-analysis/cloudflare-image-root-lockfile.md) | Fixed locally — root lockfile and build context | 2026-10-09 |
| [Forward launcher flags through the root npm scripts](bug-analysis/root-launcher-flags.md) | Fixed locally — direct Node invocation | 2026-10-09 |
| [Stop the example servers when the launcher receives SIGTERM](bug-analysis/launcher-sigterm-shutdown.md) | Fixed locally — direct server children and signal checks | 2026-10-09 |

### Feature Analyses

One document per feature question: a proposed feature, a change to an existing one, or *why* a
feature behaves the way it does. Written **before** the work, closed out **after** it.

| Document | Status | Last touched |
|---|---|---|
| [Generate standard MCP prompt tests per session](feature-analysis/generated-mcp-standard-tests.md) | Implemented — verified locally | 2026-10-09 |
| [Explain the door or window a placement keeps clear](feature-analysis/explain-opening-clearance.md) | Implemented — verified locally | 2026-10-09 |
| [A reasoning effort per GPT chat model](feature-analysis/reasoning-effort-per-gpt-chat-model.md) | Open (step 1 done, step 2 open, step 3 on request) | 2026-10-07 |
| [A reasoning effort per GPT chat model: implementation plan](feature-analysis/reasoning-effort-per-gpt-chat-model-implementation-plan.md) | Open (step 1 done) | 2026-10-07 |
| [Sales configurator AI integration: kickoff proposal](feature-analysis/sales-configurator-ai-integration.md) | Open (product goal) | 2026-09-27 |

### Refactoring Analyses

One document per refactoring, written **before** the work and carrying the report once the work is
done. The analysis and the report are the same document — the report is appended at close-out.

*This folder is initially empty. Add refactoring analysis documents as needed.*

| Document | Status | Last touched |
|---|---|---|
| [The object perspective image in get-plan-images instead of the plan perspective](refactoring-analysis/object-image-in-get-plan-images.md) | Open | 2026-10-06 |
| [Validation of the MCP test fixes of RML-18103](refactoring-analysis/mcp-test-branch-validation.md) | Done | 2026-10-09 |

### Benchmarks & Performance Analyses

Performance measurements, bottleneck analyses, and optimization studies, in
[`benchmarks/`](benchmarks/README.md), written with
[hi-mcp-benchmarking.md](skills/hi-mcp-benchmarking.md). Each document keeps its benchmark in a
folder of the same name.

| Document | Status | Last touched |
|---|---|---|
| [Where the time goes when the HI agent plans a kitchen from an image](benchmarks/kitchen-from-image-time.md) | Open (gpt-6-astra measured; gpt-5-mini and gpt-5.4-mini not run) | 2026-10-08 |
| [Where the time goes when the HI agent plans a kitchen from an image: implementation plan](benchmarks/kitchen-from-image-time-implementation-plan.md) | Open (reviewed; to be implemented) | 2026-10-08 |

### Backlog

Outstanding defects, performance optimizations, and refactoring follow-ups for roomle-hi-example.

| Document | Last touched |
|---|---|
| [Backlog](backlog/README.md) — the open work: planning by the MCP server, the planner, the chat, the test infrastructure, the deployment and the page sessions, the architecture, the ligna-store | 2026-10-09 |
| [Article template geometry in the roomle-ui plan context](backlog/roomle-ui-article-template-geometry.md) — measure, then let the plan context carry every article's docking vectors and corner point, and remove the server's probe where the default variant suffices | 2026-10-07 |
| [Open MCP issues](backlog/mcp-issues.md) — the open defects and hardening of the MCP server, its served text, the chat and the planner detected by the MCP prompt tests, each with the module, team or repository responsible | 2026-10-09 |
| [Open issues of the libraries](backlog/library-issues.md) — what the library data lacks for the agent to plan right, with the status of the report to the library development team: the sink width of a sink unit, handleless fronts | 2026-10-09 |
| [Reasoning effort for the GPT chat models](backlog/reasoning-effort-for-the-gpt-chat-models.md) — gpt-5.4-mini plans without reasoning: set an effort per Foundry deployment from the measured data and verify it; further measurement only on request | 2026-10-07 |
| [Open issues of the MCP test infrastructure](backlog/mcp-test-infrastructure-issues.md) — the object-only render under software GL | 2026-10-09 |
| [Deployment, launcher and page sessions](backlog/deployment-and-session-issues.md) — access control | 2026-10-09 |
| [The planner's load result per input group](backlog/planner-load-outcome-per-group.md) — roomle-ui names per input group what it built, so `create-or-replace-groups` reports a group left out in `notLoaded` | 2026-10-07 |
| [One planner undo step per tool call](backlog/one-undo-step-per-tool-call.md) — roomle-ui resolves a command after its follow-up reload and groups a tool call into one undo step; then the server drops its follow-up wait | 2026-10-07 |
| [Open findings about the plan context](backlog/plan-context-open-findings.md) — root outlines, calculation errors, the obstacle outline of a group, position heights | 2026-10-08 |
| [A relation for a unit under a tabletop](backlog/under-relation-for-tabletops.md) — a live check of the tabletop's inner vectors, then an `under` relation | 2026-10-07 |
| [One page bridge for every host](backlog/one-page-bridge-for-every-host.md) — one bridge package instead of three hand-synced copies, later a planner option | 2026-10-07 |
| [A backend-controlled agent loop with browser-executed scene tools](backlog/backend-agent-loop-with-browser-scene-tools.md) — the scene tools in the browser, the agent loop and the credentials in the backend | 2026-10-07 |
| [Analyse how Spec Kit can help with the prompting](backlog/speckit-for-the-prompting.md) — Spec Kit's prompt sections as inspiration for the served text and the chat prompt | 2026-10-07 |
| [The ligna-store chat as a client of the HI MCP server](backlog/ligna-store-chat-client.md) — the Mistral image adapter | 2026-10-09 |

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
| **Historical record** — analysis, benchmark, refactoring | `.agents/<analysis-type>/` | Never updated after close-out; deleted by ["cleanup analyses"](skills/hi-analysis-cleanup.md) once the work has landed |
| **Decision** — why code is shaped this way | `.agents/decisions/` (create folder if needed) | Living reference |
| **ADR** — architecture decision record | `.agents/decisions/` | Living reference |

## Adding New Documentation

### For AI Agents (Digital Brain)

1. **Skills**: Add to `.agents/skills/` for on-demand domain knowledge
2. **Bug Analysis**: Add to `.agents/bug-analysis/` before fixing
3. **Feature Analysis**: Add to `.agents/feature-analysis/` before implementing
4. **Refactoring Analysis**: Add to `.agents/refactoring-analysis/` before refactoring
5. **Update this index**: Add a line to the appropriate table

### For End Users

Add to `docs/` folder and update the main README.md if appropriate.

## See Also

- [AGENTS.md](../AGENTS.md) — AI assistant instructions and workflow
- [.github/copilot-instructions.md](../.github/copilot-instructions.md) — GitHub Copilot specific guidance
