# Digital Brain Index

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

*This folder is initially empty. Add ADR documents as needed.*

---

## Living Reference

### Skills (On-Demand Domain Knowledge)

Skills provide deep domain knowledge for AI agents. Load them when the task matches their domain.

| Skill | Description | Load When |
|---|---|---|
| [hi-mcp-server.md](./skills/hi-mcp-server.md) | MCP server architecture, HTTP handling, SSE bridge, protocol compliance | MCP server development, tool registration, bridge implementation |
| [hi-mcp-cloudflare-deployment.md](./skills/hi-mcp-cloudflare-deployment.md) | Cloudflare deployment of the hi-mcp server: wrangler deploy/update, URL anatomy, container cleanup, teardown | Deploying, updating, or troubleshooting the Cloudflare-hosted hi-mcp server |
| [hi-authoring-rules.md](./skills/hi-authoring-rules.md) | HI authoring patterns, docking vectors, group creation, placement rules | Creating or modifying HI groups, docking patterns, article selection |
| [hi-mcp-tools.md](./skills/hi-mcp-tools.md) | Complete MCP tool reference with parameters, examples, error handling | Using MCP tools, tool implementation, error diagnosis |
| [roomle-hi-concepts.md](./skills/roomle-hi-concepts.md) | Core HI concepts: rooms, walls, articles, groups, docking, data model | Understanding HI architecture, data structures, relationships |

### Decisions (Architecture Decision Records)

ADRs document why the code is shaped the way it is. This folder is initially empty. Create numbered ADR documents in `.agents/decisions/` as needed, following the [RoomleCore pattern](https://github.com/roomle-internal/RoomleCore/blob/master/documentation/decisions/README.md).

### User-Facing Documentation

Living reference documentation for end users and developers is maintained in the `docs/` folder:

- [hi-mcp-server.md](../minimal-hi-example/docs/hi-mcp-server.md) — Complete MCP server documentation
- [hi-mcp-poc-presentation.md](../minimal-hi-example/docs/hi-mcp-poc-presentation.md) — Proof of concept presentation

---

## Historical Records

**Point-in-time. May not reflect current behaviour.**

`Last touched` is the date of the last commit that changed the file's content. A pure move or rename does
not reset it. Treat it as a weak proxy for age and prefer the `Date` or `Status` in a document's own
status block where one is present.

### Bug Analyses

One document per bug: root-cause analysis written **before** the fix, closed out **after** it.

*This folder is initially empty. Add bug analysis documents as needed.*

| Document | Status | Last touched |
|---|---|---|

### Feature Analyses

One document per feature question: a proposed feature, a change to an existing one, or *why* a
feature behaves the way it does. Written **before** the work, closed out **after** it.

| Document | Status | Last touched |
|---|---|---|
| [Planner MCP Server Analysis - roomle-model-exporter](feature-analysis/planner-mcp-server-analysis.md) | Implemented | 2026-09-25 |
| [hi-mcp-poc-json](feature-analysis/hi-mcp-poc-json.md) | Open | 2026-09-26 |
| [MCP Azure deployment and session bootstrapping](feature-analysis/mcp-azure-deployment-and-session-bootstrapping.md) | Open | 2026-09-26 |
| [MCP Cloudflare Containers deployment](feature-analysis/mcp-cloudflare-containers-deployment.md) | Open | 2026-09-26 |

### Refactoring Analyses

One document per refactoring, written **before** the work and carrying the report once the work is
done. The analysis and the report are the same document — the report is appended at close-out.

*This folder is initially empty. Add refactoring analysis documents as needed.*

| Document | Status | Last touched |
|---|---|---|
| [Use hi-mcp-poc-json server for minimal-hi-example](refactoring-analysis/use-hi-mcp-poc-json-server-for-minimal-example.md) | Done | 2026-09-27 |

### Benchmarks & Performance Analyses

Performance measurements, bottleneck analyses, and optimization studies.

*This folder is initially empty. Add benchmark documents as needed.*

| Document | Last touched |
|---|---|

### Backlog

Outstanding defects, performance optimizations, and refactoring follow-ups for roomle-hi-example.

*This folder is initially empty. Add backlog documents as needed.*

| Document | Last touched |
|---|---|

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
4. **Never delete** — Analysis documents are historical records

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
| **Living reference** — how things work now | `.agents/skills/` or `docs/` | Updated when behaviour changes |
| **Historical record** — analysis, benchmark, refactoring | `.agents/<analysis-type>/` | Never updated after close-out |
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
