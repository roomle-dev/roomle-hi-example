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
- **Language**: JavaScript/TypeScript (Node.js 20+), HTML
- **Purpose**: Standalone HI presets example with MCP server for orchestrating HOMAG Intelligence object groups in Roomle room-planner sessions

## Project Overview

roomle-hi-example is a demonstration and development environment for:

1. **HI Presets Example** — A standalone HTML page (`index.html`) that demonstrates HOMAG Intelligence (HI) room planning with preset configurations
2. **MCP Server** — The TypeScript MCP server (`hi-mcp/hi-mcp-poc-json`) that provides Model Context Protocol (MCP) tools for AI agents to orchestrate HI object groups in live Roomle sessions, started together with the example page by the launcher `minimal-hi-example/start.mjs`

The start script (`npm start`) provides:
- A build gate: installs and typechecks the `hi-mcp` workspace before starting
- Static file serving for the example HTML page on port 3000
- The MCP server on port 3100 with its MCP endpoint (`POST /mcp`, Streamable HTTP)
- A page bridge (WebSocket `/bridge`) relaying the tools' planner method calls to the Roomle planner API via `roomDesignerApi.extended`
- With `npm start <provider> <api-key>` (providers: `mistral`/`mistral-medium`/`mistral-large`, `claude`/`anthropic`, `azure`, or any `mistral-*`/`claude-*` model id): the AI chat backend on port 3200 (Vercel AI SDK) and the page opened with the chat window visible
- Browser auto-open at the example URL

## Repository Structure

```
.
├── minimal-hi-example/         # Minimal standalone HI example
│   ├── index.html              # HI presets example page (single file, inline JS)
│   ├── start.mjs               # Launcher: build gate, static serving (:3000), spawns the MCP server
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
│       ├── tool-executors.ts     # Tool logic: validation, planner call composition, hints
│       ├── group-placement.ts    # Placement of a new group -> anchor root and planner repositioning
│       ├── plan-space.ts         # place-group geometry: footprint, wall and corner placement, contact test
│       ├── planner-api.ts        # The planner methods the tools call, relayed to the page
│       ├── page-bridge.ts        # Connected-page registry, call correlation
│       ├── types.ts              # WebSocket message protocol
│       ├── tests/                # Unit tests (tool-executors, group-placement, plan-space, planner-api, page-bridge, hi-mcp-server)
│       ├── README.md             # Complete PoC documentation (clients: INT-stage ligna-store, HI presets example)
│       └── QUICKSTART.md         # Shortest path to a first tool call
│   ├── hi-mcp-poc-json-client/   # Page side of the server (reference copy; the store runs its own)
│       ├── browser-bridge.ts     # WebSocket client: executes allow-listed planner methods, replies
│       └── tests/                # Unit tests (browser-bridge)
│   ├── hi-mcp-chat/              # AI chat backend (Vercel AI SDK, Mistral): POST /chat on :3200, MCP client of hi-mcp-poc-json, started by the launcher with `npm start mistral <api-key>`
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
| [`.agents/skills/hi-mcp-server.md`](./.agents/skills/hi-mcp-server.md) | MCP server architecture, tool definitions, protocol handling, WebSocket bridge |
| [`.agents/skills/hi-mcp-cloudflare-deployment.md`](./.agents/skills/hi-mcp-cloudflare-deployment.md) | Updating/deploying the Cloudflare-hosted hi-mcp server: wrangler deploy, URL anatomy, container cleanup, teardown |
| [`.agents/skills/hi-authoring-rules.md`](./.agents/skills/hi-authoring-rules.md) | HI authoring rules, docking patterns, group creation, article catalog |
| [`.agents/skills/hi-mcp-tools.md`](./.agents/skills/hi-mcp-tools.md) | MCP tool reference, get-plan-context, create-or-replace-groups |
| [`.agents/skills/roomle-hi-concepts.md`](./.agents/skills/roomle-hi-concepts.md) | HI concepts: rooms, walls, articles, groups, docking vectors, positioning |
| [`.agents/skills/vercel-ai-sdk-chat.md`](./.agents/skills/vercel-ai-sdk-chat.md) | Vercel AI SDK chat integration: providers, server-side auth, @ai-sdk/mcp, streamText |
| [`.agents/skills/hi-mcp-testing.md`](./.agents/skills/hi-mcp-testing.md) | The user asks to **"test the mcp"** (runs the prompt suite of `docs/testing-prompts.md`, writes an evaluated report); testing the HI MCP end to end: running a prompt through the chat with a real model and planner, the stored snapshot result |
| [`.github/skills/roomle-pr-resolution.md`](./.github/skills/roomle-pr-resolution.md) | Resolving a pull request: verifying suggested changes, applying them, replying to every review comment, resolving threads. Never merge the PR |

## Key Architecture Patterns

### MCP Server Architecture

1. **Single MCP Server Implementation** — The TypeScript server in `hi-mcp/hi-mcp-poc-json` (`@modelcontextprotocol/sdk`, `ws`, zod, run via `vite-node`) is the only MCP server; clients (example page, ligna-store) wire themselves to it via environment variables
2. **Streamable HTTP** — MCP protocol handled by the MCP SDK, JSON response mode, stateless (a new transport per request)
3. **WebSocket Bridge** — The `/bridge` WebSocket connects the MCP server to the browser page
4. **Tool Logic in the Server, Planner Calls in the Page** — The tools run in the server (`tool-executors.ts`); the planner methods they call (`planner-api.ts`) are relayed to `roomDesignerApi.extended` in the page, which executes only the methods on its allow-list

### HI Data Model

1. **Rooms** — Each room has a `walls` array with side labels, coordinates, dimensions
2. **Articles** — Catalog of available modules with dimensions, docking vectors, categories
3. **Groups** — Collections of root modules (article picks) with docking relationships
4. **Docking** — Roots are positioned relative to each other via docking vectors and modes
5. **Positioning** — New groups are positioned with a `placement`: one point and one rotation, taken from a wall's `end` and `facingRotationY`; the server anchors the group (`group-placement.ts`). Existing groups are moved with `place-group` (`plan-space.ts`)

### Authoring Rules

- Never author root positions — roots are positioned by docking only
- New groups are positioned with a `placement` only (`posRotationY` counter-clockwise as seen from above: right wall 270, left wall 90)
- Roots within a group must be docked to already-placed roots
- Docking uses vector pairs: ownDockingVector -> dockingVector with mode and offset
- Free docking vectors indicate where new modules can be added

## Hard Rules

### Code Style

- **ES Modules** — Use `import/export` syntax, not CommonJS `require`
- **TypeScript Types** — Use JSDoc comments for type annotations when needed
- **Async/Await** — Prefer async/await over Promise chains
- **Error Handling** — Use try/catch for synchronous errors, .catch() for promises
- **No new dependencies without reason** — The MCP server is the `hi-mcp` workspace package with its own locked dependencies; do not add dependencies to it or to the launcher without need

### Naming Conventions

- **Variables**: camelCase (`planContext`, `dockingVector`)
- **Constants**: UPPER_SNAKE_CASE (`PORT`, `DEFAULT_CALL_TIMEOUT_MS`)
- **Functions**: camelCase (`getPlanContext`, `createOrReplaceGroups`)
- **Files**: kebab-case (`minimal-hi-example/start.mjs`, `minimal-hi-example/docs/hi-mcp-server.md`)

### Comments

> "Every time you write a comment, you should grimace and feel the failure of your ability of expression." — Robert C. Martin (Uncle Bob)

- **Minimal comments** — Code must express its intent through naming and structure
- **JSDoc for public APIs** — Functions exposed via MCP should have JSDoc
- **No header comments** — No file-level author/license headers
- **No section dividers** — No `// ===` or `// ---` lines

## MCP Server Specific Rules

### Protocol Compliance

- Support multiple MCP protocol versions as needed
- Implement the required MCP endpoint: `POST /mcp` (Streamable HTTP, JSON response mode)
- Validate tool call parameters before processing
- Return proper error responses for invalid inputs

### Tool Implementation

- Each tool must have a clear description and parameter schema
- Tools should handle errors gracefully and return meaningful error messages
- Tool timeouts should be configurable (default 30s, snapshot calls 120s)
- Tools should log their operations for debugging

### Bridge Communication

- WebSocket connections must be properly managed with cleanup
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
npm start          # or: node minimal-hi-example/start.mjs
```

This starts:
- The build gate: `npm install` (first run) + typecheck of the `hi-mcp` workspace
- Static file serving for minimal-hi-example/index.html on port 3000
- The MCP server (hi-mcp/hi-mcp-poc-json) with its MCP endpoint at /mcp on port 3100
- WebSocket bridge at /bridge
- Opens browser to http://localhost:3000/?mcp=true

### Testing Tool Calls

1. Start the server
2. Open the page in browser
3. Connect MCP client
4. Call tools like:
   - `get-plan-context` — Get current rooms, articles, groups
   - `create-or-replace-groups` — Add, modify or extend groups; position new groups
   - `place-group` — Move an existing group against a wall or into a room corner
   - `merge-article-into-group`, `exchange-root-module`, `delete-root-module`, `delete-group`, `change-module-attribute`, `change-group-attribute`, `merge-groups` — Edit an existing group (commands the planner performs)
   - `get-price` — Calculate pricing
   - `get-order-data` — Get order information
   - `get-plan-images` — Render plan images

### Adding New Tools

1. Register the tool in `hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts` (zod schema + handler)
2. Implement the executor in `hi-mcp/hi-mcp-poc-json/tool-executors.ts` — the pages stay untouched; an executor that changes the plan is wrapped in `oneAtATime`, so it never runs beside another plan change
3. An edit of existing groups needs no new planner method: add the command in roomle-ui (`HI_GROUP_OPERATION` in `homag-intelligence/src/hi-plan-context.ts`) and forward it through `externalObjectGroupOperation`. Only if the tool needs a planner method the pages do not expose yet: add it to `hi-mcp/hi-mcp-poc-json/planner-api.ts` and to every page allow-list (`MCP_PLANNER_METHODS` in `minimal-hi-example/index.html`, `PLANNER_METHODS` in `hi-mcp/hi-mcp-poc-json-client/browser-bridge.ts`, then copy to the ligna-store)
4. Add or extend unit tests in the matching `tests/` folder
5. Update `minimal-hi-example/docs/hi-mcp-server.md` tool reference and `.agents/skills/hi-mcp-tools.md`
6. Test with MCP client

## Suggested Change Workflow

This workflow is a suggestion and a guideline, not a requirement. It describes how a feature, a bug
fix, or a refactoring moves from an idea to a merged pull request when a human and an agent work on
it together. Small changes may skip steps; large or risky changes benefit from every one of them.
The steps alternate between agent work and human review, and every step builds on the reviewed
result of the step before it.

| # | Step | Who | Result |
|---|---|---|---|
| 1 | Describe the feature, bug, or refactoring and its definition of done | human, supported by the agent | a ticket with a clear problem statement and acceptance criteria |
| 2 | Analyse the feature, bug, or refactoring | agent | the analysis document in the matching folder and the same content as a ticket comment — see [Analysis Documents](#analysis-documents) |
| 3 | Review the analysis | human | the root cause, the gap, or the scope is confirmed |
| 4 | Plan the implementation and the unit tests | agent | the implementation plan as a ticket comment |
| 5 | Review the plan | human | the approach is approved before any code changes |
| 6 | Implement the plan | agent | code, tests, and documentation on a purpose branch, opened as a pull request — see [Pull Requests](#pull-requests) |
| 7 | Review the code | human | review comments on the pull request |
| 8 | Apply the review suggestions | agent | new commits, every review thread replied to or resolved — see [Pull Request Resolution](#pull-request-resolution) |
| 9 | Review the code again | agent, preferably a different one than the implementer | review comments on the pull request |
| 10 | Apply the review suggestions | agent or human | new commits, every review thread replied to or resolved |
| 11 | Final review and merge | human | the merged pull request — an agent never merges |

**Every review gates the next step.** Each step trusts the reviewed result of the step before it:
the plan builds on the analysis, the implementation on the plan, the code review on the
implementation. Every review therefore has to be done very carefully — a flaw that passes a review
is carried into every later step.

**A review can send the work back.** If a review identifies a fundamental problem — the analysis
missed the real root cause, the plan does not cover the definition of done, the implementation
contradicts the plan — the work goes back one or more steps instead of being patched at the current
step.

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
- Bridge communication uses a WebSocket with auto-reconnect
- Large plan contexts should be handled efficiently
- Image generation can be expensive — use appropriate timeouts
