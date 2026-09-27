# AGENTS.md — roomle-hi-example

> Open-standard "README for AI" — structured context for GitHub Copilot, Copilot Workspace, coding agents, and LLM-based dev tools.

## Always Do This First

1. **Load matching skills.** Check the [On-Demand Skills](#on-demand-skills) catalog and read every skill file whose domain matches the task *before* taking action. Multiple skills may apply to one task.
2. **Read [`minimal-hi-example/docs/hi-mcp-server.md`](./minimal-hi-example/docs/hi-mcp-server.md)** before answering architecture or domain questions. It is the comprehensive reference for the HI MCP server implementation and usage.
3. **Read [`.agents/README.md`](./.agents/README.md)** for the complete digital brain index, separating living reference from historical records.
4. **Treat documentation as part of the task, not a follow-up.** Every analysis produces a document, and every change to productive code updates one — see [Where Documentation Goes](#where-documentation-goes).
5. **For GitHub Copilot users:** See [`.github/copilot-instructions.md`](./.github/copilot-instructions.md) for Copilot-specific guidance.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## Identity

- **Project**: roomle-hi-example
- **Repository**: `roomle/roomle-hi-example`
- **Default branch**: `master`
- **Current branch**: `feat/hi-mcp`
- **Language**: JavaScript/TypeScript (Node.js 18+), HTML
- **Purpose**: Standalone HI presets example with MCP server for orchestrating HOMAG Intelligence object groups in Roomle room-planner sessions

## Project Overview

roomle-hi-example is a zero-dependency demonstration and development environment for:

1. **HI Presets Example** — A standalone HTML page (`index.html`) that demonstrates HOMAG Intelligence (HI) room planning with preset configurations
2. **MCP Server** — A Node.js HTTP server (`minimal-hi-example/hi-mcp-server.js`) that provides Model Context Protocol (MCP) tools for AI agents to orchestrate HI object groups in live Roomle sessions

The server provides:
- Static file serving for the example HTML page
- MCP endpoint (`POST /mcp`) with Streamable HTTP protocol
- Page bridge (`GET /bridge`, `POST /bridge/result`) using Server-Sent Events (SSE) and fetch
- Tool access to the Roomle planner API via `roomDesignerApi.extended`

## Repository Structure

```
.
├── minimal-hi-example/         # Minimal standalone HI example
│   ├── index.html              # HI presets example page
│   ├── hi-mcp-server.js         # Zero-dependency MCP server (Node.js)
│   └── docs/                    # Documentation
│       ├── hi-mcp-server.md    # Complete MCP server documentation
│       ├── hi-mcp-poc-presentation.md # Proof of concept presentation
│       └── images/             # Diagram and screenshot assets
├── hi-mcp/                       # TypeScript MCP server PoCs (npm workspaces, vitest)
│   ├── README.md                 # Project overview and PoC list
│   ├── package.json              # Workspace root: test/typecheck/start scripts
│   ├── tsconfig.base.json        # Shared compiler options for all PoCs
│   ├── vitest.config.ts          # Unit tests across all PoCs
│   └── hi-mcp-poc-json/          # PoC 1: HI groups from a single JSON pos-group payload
│       ├── server.ts             # Entry point: /mcp + WebSocket bridge on :3100
│       ├── hi-mcp-server.ts      # McpServer setup + tool registrations (zod)
│       ├── page-bridge.ts        # Connected-page registry, call correlation
│       ├── browser-bridge.ts     # Page-side bridge (reference copy; the store runs its own)
│       ├── tool-executors.ts     # Tool → roomDesignerApi.extended calls
│       ├── plan-space.ts         # Pure geometry: walls, footprints, placement
│       ├── tests/                # Unit tests (plan-space, page-bridge, hi-mcp-server, tool-executors)
│       ├── README.md             # Complete PoC documentation (client: INT-stage ligna-store)
│       └── QUICKSTART.md         # Shortest path to a first tool call
├── package.json                  # Project metadata and scripts
├── README.md                     # Quickstart and usage guide
├── AGENTS.md                     # This file - AI assistant instructions
├── CLAUDE.md                     # Redirect to AGENTS.md (for Claude Code)
├── .agents/                      # Digital Brain - AI agent knowledge base
│   ├── README.md                 # Digital brain index
│   ├── bug-analysis/             # Bug root-cause analyses
│   │   └── README.md
│   ├── feature-analysis/         # Feature investigations
│   │   └── README.md
│   ├── refactoring-analysis/     # Refactoring analyses with reports
│   │   └── README.md
│   └── skills/                  # On-demand domain knowledge
│       ├── hi-authoring-rules.md   # HI authoring patterns
│       ├── hi-mcp-server.md       # MCP server domain knowledge
│       ├── hi-mcp-tools.md         # MCP tool reference
│       └── roomle-hi-concepts.md  # Core HI concepts
├── docs/
│   ├── hi-mcp-server.md          # Complete MCP server documentation
│   ├── hi-mcp-poc-presentation.md # Proof of concept presentation
│   └── images/                   # Diagram and screenshot assets
└── .github/
    └── copilot-instructions.md   # GitHub Copilot specific instructions
```

## On-Demand Skills

Skills provide deep domain knowledge. Load them by reading the file when the task matches their domain. Skill files are located in `.github/skills/` for GitHub-specific workflows and `.agents/skills/` for domain knowledge.

| Skill | Load when the task involves |
|---|---|
| [`.agents/skills/hi-mcp-server.md`](./.agents/skills/hi-mcp-server.md) | MCP server architecture, tool definitions, protocol handling, SSE bridge |
| [`.agents/skills/hi-mcp-cloudflare-deployment.md`](./.agents/skills/hi-mcp-cloudflare-deployment.md) | Updating/deploying the Cloudflare-hosted hi-mcp server: wrangler deploy, URL anatomy, container cleanup, teardown |
| [`.agents/skills/hi-authoring-rules.md`](./.agents/skills/hi-authoring-rules.md) | HI authoring rules, docking patterns, group creation, article catalog |
| [`.agents/skills/hi-mcp-tools.md`](./.agents/skills/hi-mcp-tools.md) | MCP tool reference, get-plan-context, create-or-replace-groups, place-group |
| [`.agents/skills/roomle-hi-concepts.md`](./.agents/skills/roomle-hi-concepts.md) | HI concepts: rooms, walls, articles, groups, docking vectors, placements |
| [`.github/skills/roomle-pr-resolution.md`](./.github/skills/roomle-pr-resolution.md) | Resolving a pull request: verifying suggested changes, applying them, replying to every review comment, resolving threads. Never merge the PR |

## Key Architecture Patterns

### MCP Server Architecture

1. **Zero Dependencies** — Pure Node.js with no npm packages required
2. **Streamable HTTP** — MCP protocol implemented with hand-rolled JSON-RPC over HTTP
3. **SSE Bridge** — Server-Sent Events connect the MCP server to the browser page
4. **Tool Relay** — MCP tool calls are relayed to `roomDesignerApi.extended` in the page context

### HI Data Model

1. **Rooms** — Each room has a `walls` array with side labels, coordinates, dimensions
2. **Articles** — Catalog of available modules with dimensions, docking vectors, categories
3. **Groups** — Collections of root modules (article picks) with docking relationships
4. **Docking** — Roots are positioned relative to each other via docking vectors and modes
5. **Placement** — Groups are positioned against walls using wall labels and alignments

### Authoring Rules

- Never author coordinates directly — use docking and placement only
- Groups are positioned with `placement` (wall/alignment/offset) or `repositioningData`
- Roots within a group must be docked to already-placed roots
- Docking uses vector pairs: ownDockingVector -> dockingVector with mode and offset
- Free docking vectors indicate where new modules can be added

## Hard Rules

### Code Style

- **ES Modules** — Use `import/export` syntax, not CommonJS `require`
- **TypeScript Types** — Use JSDoc comments for type annotations when needed
- **Async/Await** — Prefer async/await over Promise chains
- **Error Handling** — Use try/catch for synchronous errors, .catch() for promises
- **No external dependencies** — The server must remain zero-dependency

### Naming Conventions

- **Variables**: camelCase (`planContext`, `dockingVector`)
- **Constants**: UPPER_SNAKE_CASE (`PORT`, `DEFAULT_CALL_TIMEOUT_MS`)
- **Functions**: camelCase (`getPlanContext`, `createOrReplaceGroups`)
- **Files**: kebab-case (`minimal-hi-example/hi-mcp-server.js`, `minimal-hi-example/docs/hi-mcp-server.md`)

### Comments

> "Every time you write a comment, you should grimace and feel the failure of your ability of expression." — Robert C. Martin (Uncle Bob)

- **Minimal comments** — Code must express its intent through naming and structure
- **JSDoc for public APIs** — Functions exposed via MCP should have JSDoc
- **No header comments** — No file-level author/license headers
- **No section dividers** — No `// ===` or `// ---` lines

## MCP Server Specific Rules

### Protocol Compliance

- Support multiple MCP protocol versions as needed
- Implement all required MCP endpoints: `/mcp`, `/sse`, etc.
- Validate tool call parameters before processing
- Return proper error responses for invalid inputs

### Tool Implementation

- Each tool must have a clear description and parameter schema
- Tools should handle errors gracefully and return meaningful error messages
- Tool timeouts should be configurable (default 30s, snapshot calls 120s)
- Tools should log their operations for debugging

### Bridge Communication

- SSE connections must be properly managed with cleanup
- Bridge messages should be validated before processing
- Error responses from the page should be relayed back to the MCP client
- Connection state should be tracked and logged

## Where Documentation Goes

Documentation lives in markdown files under `docs/` and `.agents/`, never in code comments.

### Digital Brain Structure

The `.agents/` folder serves as the "digital brain" for roomle-hi-example, containing:

```
.agents/
├── README.md                     # Digital brain index (this file)
├── bug-analysis/                 # Bug root-cause analyses (written before fix)
├── feature-analysis/             # Feature investigations and decisions
├── refactoring-analysis/         # Refactoring analyses with reports
├── scripts/                      # Utility scripts (JavaScript only)
└── skills/                      # On-demand domain knowledge (skills)
```

**IMPORTANT**: All scripts in `.agents/scripts/` MUST be JavaScript (Node.js), not Python. This ensures consistency with the repository's primary language and tooling.

### Analysis Documents

Every change to productive code should be accompanied by analysis documents:

| Analysis Type | Folder | When to Create | Status Values |
|---|---|---|---|
| Bug Analysis | `.agents/bug-analysis/` | "analyse the bug", "analyze the bug", "bug analysis" | Open, Fixed |
| Feature Analysis | `.agents/feature-analysis/` | "analyse the feature", "analyze the feature", "feature analysis" | Open, Implemented, Rejected |
| Refactoring Analysis | `.agents/refactoring-analysis/` | "analyse the refactoring", "analyze the refactoring", "refactoring analysis" | Open, Done |

Each analysis document follows the same lifecycle: written **before** the work, closed out **after** the work.

| What you produced | Where it goes |
|---|---|
| Bug analysis | new file in `.agents/bug-analysis/` with kebab-case slug |
| Feature analysis | new file in `.agents/feature-analysis/` with kebab-case slug |
| Refactoring analysis | new file in `.agents/refactoring-analysis/` with kebab-case slug |
| New feature capability | Update `minimal-hi-example/docs/hi-mcp-server.md` or create new file in `minimal-hi-example/docs/` |
| MCP tool reference updates | `.agents/skills/hi-mcp-tools.md` |
| Architecture decisions | Create ADR in `.agents/decisions/` (if needed) |
| Living reference | `docs/` for user-facing documentation |

**Important**: Analysis documents in `.agents/bug-analysis/`, `.agents/feature-analysis/`, and `.agents/refactoring-analysis/` are **historical records** — they document the analysis process and decisions, but the durable knowledge should be promoted to living-reference documentation in `docs/` or the skill files.

## MCP Client Connection

The server provides MCP endpoint at `http://localhost:3100/mcp` when running.

### Supported Clients

| Client | Connection Command |
|---|---|
| Claude Code | `claude mcp add --transport http --scope user hi-orchestrator http://localhost:3100/mcp` |
| Claude Desktop | Register in `claude_desktop_config.json` |
| GitHub Copilot VS Code | MCP: Open User Configuration → add server |

**Note**: Copilot in the browser cannot reach localhost servers.

## Development Workflow

### Starting the Server

```bash
npm start          # or: node minimal-hi-example/hi-mcp-server.js
```

This starts:
- HTTP server on port 3100
- Static file serving for minimal-hi-example/index.html
- MCP endpoint at /mcp
- SSE bridge at /bridge
- Opens browser to http://localhost:3100/?mcp=true

### Testing Tool Calls

1. Start the server
2. Open the page in browser
3. Connect MCP client
4. Call tools like:
   - `get-plan-context` — Get current rooms, articles, groups
   - `create-or-replace-groups` — Add or modify groups
   - `place-group` — Move existing groups
   - `get-price` — Calculate pricing
   - `get-order-data` — Get order information
   - `get-plan-images` — Render plan images

### Adding New Tools

1. Add tool definition to `TOOLS` array in `minimal-hi-example/hi-mcp-server.js`
2. Implement handler function
3. Add JSDoc documentation
4. Update `minimal-hi-example/docs/hi-mcp-server.md` tool reference
5. Test with MCP client

## Git Workflow Rules

### Hard Rule: NO Force Pushes

**NEVER use `git push --force` or `git push -f` on any branch, especially master.** Force pushing rewrites history and is absolutely forbidden. If you need to undo commits, create a new revert commit instead.

### Commit Message Format

Use conventional commits: `type: lowercase description` — no trailing period.

Examples:
- `feat: add new MCP tool for article lookup`
- `fix: correct docking vector resolution`
- `docs: update example prompts`
- `refactor: simplify SSE bridge connection handling`

**Do not put ticket numbers in commit messages or PR titles.** Reference the ticket in the PR body if needed.

### Pull Requests

- Keep PRs focused and small
- Include clear description of changes
- Reference related documentation
- Ensure all tests pass (if applicable)
- Update documentation in same PR as code changes

### Pull Request Resolution

**NEVER merge a PR.** Not with `gh pr merge`, not by enabling auto-merge. Merging is always a human decision performed by maintainers — finish the review resolution and stop.

**Load the skill** [`.github/skills/roomle-pr-resolution.md`](./.github/skills/roomle-pr-resolution.md) when resolving a PR.

**Hard Rules:**
- **Never rewrite history.** No `git commit --amend`, no `git push --force`. Every review fix is a **new** conventional commit.
- **Never silently ignore or resolve a comment.** Every handled thread gets a reply comment first, then is marked resolved.
- **Verify before implementing.** A reviewer suggestion is a hypothesis, not an instruction. Confirm it against the actual code before changing anything.

**Workflow:**
1. **Identify the PR** — Check out the PR branch explicitly, do not rely on current branch
2. **Fetch unresolved review threads** — Use GitHub API to get all unresolved threads
3. **Verify each suggestion** — Read the code, classify as valid/invalid/valid-intent-wrong-form
4. **Implement and validate** — Apply changes, test, commit as new conventional commits, push
5. **Reply to every comment** — State applied/applied-differently/not-applied with reasoning
6. **Resolve each thread** — Mark threads as resolved via GitHub API
7. **Final verification** — Confirm all threads are resolved. Stop. Do not merge.

**Completion Checklist:**
- [ ] Every unresolved thread was verified against the actual code
- [ ] Confirmed-valid suggestions are implemented, tested, and formatted
- [ ] Fixes are pushed as new commits (no amend, no force push)
- [ ] Every handled thread has a reply stating applied/applied differently/not applied
- [ ] Every handled thread is marked resolved
- [ ] The PR was **not** merged

## Bug Fixing Guidelines

### Core Principles

- **Root cause analysis is mandatory** — Understand why the bug occurs before fixing
- **Reproduce first** — Verify the bug exists and understand its impact
- **Fix at the source** — Address the root cause, not symptoms
- **Test the fix** — Verify it resolves the issue without introducing regressions

### Process

1. **Reproduce** — Identify steps to reproduce the issue
2. **Investigate** — Trace the data flow and identify the root cause
3. **Implement** — Write clean, focused fix
4. **Validate** — Test the fix thoroughly
5. **Document** — Update documentation if needed

## Performance Considerations

- MCP calls have timeout limits (default 30s, snapshots 120s)
- Tool implementations should be efficient
- Bridge communication uses SSE which has overhead
- Large plan contexts should be handled efficiently
- Image generation can be expensive — use appropriate timeouts
