# GitHub Copilot Instructions — roomle-hi-example

This file provides GitHub Copilot-specific context and guidance for the roomle-hi-example repository. For general AI assistant instructions, see [AGENTS.md](../AGENTS.md).

## Repository Context

- **Project**: roomle-hi-example
- **Repository**: `roomle/roomle-hi-example`
- **Purpose**: Standalone HI presets example with MCP server for orchestrating HOMAG Intelligence object groups in Roomle room-planner sessions
- **Primary Language**: JavaScript/TypeScript (Node.js 18+), HTML
- **Current Branch**: `feat/hi-mcp`

## What This Repository Is

roomle-hi-example provides:

1. **HI Presets Example Page** (`index.html`) — Demonstrates HOMAG Intelligence (HI) room planning with preset configurations in a browser
2. **MCP Server** (`hi-mcp/hi-mcp-poc-json`) — TypeScript Node.js MCP server (started together with the example page by `minimal-hi-example/start.mjs`) providing Model Context Protocol tools for AI agents

The MCP server enables AI assistants (Claude, Copilot, etc.) to:
- Query plan state (rooms, walls, articles, groups)
- Create and manipulate HI object groups
- Place groups in the scene
- Calculate pricing
- Generate order data
- Render plan images

## Key Concepts

### HOMAG Intelligence (HI)

HOMAG Intelligence is a system for kitchen cabinet management, price calculation, and order submission. In Roomle:
- **Articles** — Individual cabinet modules from a catalog
- **Groups** — Collections of articles (root modules) with docking relationships
- **Docking Vectors** — Connection points that define how articles can attach to each other
- **Positioning** — Positioning new groups with a `placement` (a point and a rotation taken from the walls)

### MCP (Model Context Protocol)

MCP is a standard protocol for AI agents to interact with tools and resources. This server implements:
- **Streamable HTTP transport** — MCP SDK, JSON responses over HTTP POST
- **WebSocket Bridge** — WebSocket connection to the browser page
- **Tool execution** — Tool logic in the server, its planner calls relayed to the Roomle planner API in the page

### Server Stack

The MCP server is the TypeScript workspace package `hi-mcp/hi-mcp-poc-json` (`@modelcontextprotocol/sdk`, `ws`, `zod`, run via `vite-node`). This ensures:
- SDK protocol compliance and zod-validated tool schemas
- Unit-tested server and client code (vitest at the `hi-mcp` root)
- One implementation shared with the ligna-store client and the cloud deployments
- Fast startup

## Workflow Patterns

### For AI Agents Using the MCP Server

1. **Start the server**: `npm start` (installs and typechecks the `hi-mcp` workspace on first run, serves the example page on :3000, starts the MCP server on :3100)
2. **Open the page**: Browser opens to `http://localhost:3000/?mcp=true`
3. **Connect MCP client** (see below for client-specific instructions)
4. **Call tools** to interact with the Roomle planner

### MCP Client Connection

| Client | Connection Method |
|---|---|
| **Claude Code** | `claude mcp add --transport http --scope user hi-orchestrator http://localhost:3100/mcp` |
| **Claude Desktop** | Add to `claude_desktop_config.json` |
| **Copilot VS Code** | MCP: Open User Configuration → Add Server → `http://localhost:3100/mcp` |
| **Custom HTTP Client** | POST JSON-RPC to `http://localhost:3100/mcp` |

**Important**: Browser-based Copilot cannot reach localhost servers due to CORS and security restrictions.

### Available MCP Tools

All tools are defined in `hi-mcp/hi-mcp-poc-json/hi-mcp-server.ts` and documented in:
- [`.agents/skills/hi-mcp-tools.md`](../.agents/skills/hi-mcp-tools.md) — Complete tool reference
- [`minimal-hi-example/docs/hi-mcp-server.md`](../minimal-hi-example/docs/hi-mcp-server.md) — User-facing documentation

Primary tools:
- `get-plan-context` — Get current rooms, walls, articles, groups, docking vectors
- `create-or-replace-groups` — Add, modify or extend groups; position new groups (`placement`)
- `place-group` — Move an existing group against a wall or into a room corner
- `merge-article-into-group`, `exchange-root-module`, `delete-root-module`, `delete-group`, `change-module-attribute`, `change-group-attribute`, `merge-groups` — Edit an existing group
- `get-price` — Calculate pricing for current configuration
- `get-order-data` — Generate order data for manufacturing
- `get-plan-images` — Render 2D and 3D images of the plan
- `set-wall-configuration` — Configure room walls (experimental)
- `remove-all-objects` — Clear the scene (for testing)

### Common Workflows

**Creating a Kitchen Layout:**
```
1. get-plan-context → inspect current rooms
2. create-or-replace-groups → add cabinet groups, positioned with a placement
3. get-price → calculate pricing
```

**Debugging Group Issues:**
```
1. get-plan-context → examine current groups and docking
2. Analyze docking vectors and positions
3. create-or-replace-groups → fix docking relationships
```

## Digital Brain

The `.agents/` folder is the "digital brain" for this repository, containing:

```
.agents/
├── README.md                     # Digital brain index
├── bug-analysis/                 # Bug root-cause analyses
├── feature-analysis/             # Feature investigations
├── refactoring-analysis/         # Refactoring analyses
├── scripts/                      # Utility scripts (JavaScript only)
└── skills/                      # On-demand domain knowledge
    ├── hi-mcp-server.md          # MCP server architecture
    ├── hi-authoring-rules.md     # HI authoring patterns
    ├── hi-mcp-tools.md           # MCP tool reference
    └── roomle-hi-concepts.md      # Core HI concepts
```

**IMPORTANT**: All scripts in `.agents/scripts/` MUST be JavaScript (Node.js), not Python. This ensures consistency with the repository's primary language (JavaScript/TypeScript) and tooling.

**See Also**: [.agents/README.md](../.agents/README.md) for complete digital brain structure and analysis workflows.

### On-Demand Skills

Load these skills when the task matches their domain:

| Skill | Load When |
|---|---|
| [hi-mcp-server.md](../.agents/skills/hi-mcp-server.md) | MCP server architecture, protocol handling, WebSocket bridge |
| [hi-authoring-rules.md](../.agents/skills/hi-authoring-rules.md) | HI authoring, docking patterns, group creation |
| [hi-mcp-tools.md](../.agents/skills/hi-mcp-tools.md) | Using MCP tools, tool parameters, examples |
| [roomle-hi-concepts.md](../.agents/skills/roomle-hi-concepts.md) | HI data model, rooms, walls, articles, groups |
| [hi-mcp-testing.md](../.agents/skills/hi-mcp-testing.md) | Running a prompt end to end and checking the stored result |

## Code Style Guidelines

### JavaScript/TypeScript

- **ES Modules**: Use `import/export`, not CommonJS `require`
- **JSDoc Types**: Use JSDoc comments for type annotations
- **Async/Await**: Prefer over Promise chains
- **Error Handling**: Use try/catch for sync errors, .catch() for promises

### Naming

- **Variables**: camelCase (`planContext`, `dockingVector`)
- **Constants**: UPPER_SNAKE_CASE (`PORT`, `DEFAULT_CALL_TIMEOUT_MS`)
- **Functions**: camelCase (`getPlanContext`, `createOrReplaceGroups`)
- **Files**: kebab-case (`minimal-hi-example/start.mjs`, `minimal-hi-example/docs/hi-mcp-server.md`)

### Comments

- **Minimal**: Code should express intent through naming
- **JSDoc**: Required for public APIs (MCP-exposed functions)
- **No headers**: No file-level author/license comments
- **No dividers**: No `// ===` or `// ---` section markers

## Documentation Structure

### For AI Agents

- **[AGENTS.md](../AGENTS.md)** — Primary AI assistant instructions
- **[.agents/README.md](../.agents/README.md)** — Digital brain index
- **[.agents/skills/](../.agents/skills/)** — On-demand domain knowledge
- **[.agents/bug-analysis/](../.agents/bug-analysis/)** — Bug analyses
- **[.agents/feature-analysis/](../.agents/feature-analysis/)** — Feature investigations
- **[.agents/refactoring-analysis/](../.agents/refactoring-analysis/)** — Refactoring analyses

### For Humans

- **[README.md](../README.md)** — Quickstart and usage
- **[minimal-hi-example/docs/hi-mcp-server.md](../minimal-hi-example/docs/hi-mcp-server.md)** — MCP server documentation
- **[minimal-hi-example/docs/hi-mcp-poc-presentation.md](../minimal-hi-example/docs/hi-mcp-poc-presentation.md)** — POC presentation

## Analysis Workflow

When investigating issues, follow this workflow:

### Bug Analysis ("analyse the bug")
1. **Reproduce** — Identify exact steps to trigger the issue
2. **Investigate** — Trace data flow, identify root cause with file:line references
3. **Document** — Create analysis in `.agents/bug-analysis/<slug>.md`
4. **Fix** — Implement clean fix addressing root cause
5. **Validate** — Test fix thoroughly
6. **Close out** — Update analysis with results, promote durable knowledge

### Feature Analysis ("analyse the feature")
1. **Question** — Clearly state what needs investigation
2. **Current State** — Document how it works today with code references
3. **Gap/Question** — Identify what's missing or unclear
4. **Proposed** — Design or change proposal
5. **Alternatives** — Considered and rejected approaches
6. **Document** — Create analysis in `.agents/feature-analysis/<slug>.md`

### Refactoring Analysis ("analyse the refactoring")
1. **Current** — What the code does and why it's a problem
2. **Scope** — Full scope with file:line references
3. **Target** — Proposed target shape
4. **Tests** — Coverage of affected behaviour
5. **Benchmark** — Performance measurements if applicable
6. **Document** — Create analysis in `.agents/refactoring-analysis/<slug>.md`

## Suggested Change Workflow

This workflow is a suggestion and a guideline, not a requirement. It describes how a feature, a bug
fix, or a refactoring moves from an idea to a merged pull request when a human and an agent work on
it together. Small changes may skip steps; large or risky changes benefit from every one of them.
The steps alternate between agent work and human review, and every step builds on the reviewed
result of the step before it.

| # | Step | Who | Result |
|---|---|---|---|
| 1 | Describe the feature, bug, or refactoring and its definition of done | human, supported by the agent | a ticket with a clear problem statement and acceptance criteria |
| 2 | Analyse the feature, bug, or refactoring | agent | the analysis document in the matching folder and the same content as a ticket comment — see [Analysis Workflow](#analysis-workflow) |
| 3 | Review the analysis | human | the root cause, the gap, or the scope is confirmed |
| 4 | Plan the implementation and the unit tests | agent | the implementation plan as a ticket comment |
| 5 | Review the plan | human | the approach is approved before any code changes |
| 6 | Implement the plan | agent | code, tests, and documentation on a purpose branch, opened as a pull request — see [Pull Requests in AGENTS.md](../AGENTS.md#pull-requests) |
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

## Important Constraints

1. **Zero Dependencies** — Do not add npm packages without explicit approval
2. **Node.js 18+** — Target this minimum version
3. **Browser Compatibility** — The example page must work in modern browsers
4. **MCP Protocol** — Maintain compliance with MCP specification
5. **Roomle API** — Work within Roomle planner API constraints

## Common Pitfalls

1. **Bridge Reconnects** — The page reconnects its WebSocket every 3 s; no state to clean up in the server
2. **Timeout Values** — Use appropriate timeouts (30s default, 120s for snapshots)
3. **Error Propagation** — Relay errors from the page back to MCP client
4. **State Management** — Track bridge connection state carefully
5. **Docking Validation** — Always validate docking vectors before positioning a group

## Testing

The repository includes:

- **Manual Testing**: Start server, open page, connect MCP client, call tools
- **Tool Testing**: Use the MCP client to verify each tool works correctly
- **Integration Testing**: Verify end-to-end workflows (create groups, place, price, order)

For automated testing of the example page, use browser DevTools:
- Console for errors
- Network tab for API calls
- Elements tab for DOM inspection

## Performance Considerations

- **MCP Call Timeouts**: Default 30s, use 120s for snapshot generation
- **Bridge**: WebSocket with auto-reconnect
- **Large Plans**: Handle large plan contexts efficiently
- **Image Generation**: Can be expensive — use with appropriate timeouts
- **Memory**: Server should remain lightweight

## Quick Reference

### Server Commands

```bash
npm start                    # Start the example page and the MCP server
```

### Port Configuration

- **MCP server**: 3100 — change with `HI_MCP_PORT`
- **Example page**: 3000 — change with `EXAMPLE_PORT`

### URLs

- **MCP Endpoint**: `http://localhost:3100/mcp`
- **WebSocket Bridge**: `ws://localhost:3100/bridge`
- **Example Page**: `http://localhost:3000/?mcp=true`

## Pull Request Resolution

**NEVER merge a PR.** Not with `gh pr merge`, not by enabling auto-merge. Merging is always a human decision performed by maintainers.

**NEVER force push to GitHub.** Absolutely forbidden. Do not use `git push --force` or `git push -f`.

**Load the skill** [`roomle-pr-resolution.md`](.github/skills/roomle-pr-resolution.md) for the complete PR resolution workflow.

**Hard Rules:**
- **Never rewrite history.** No `git commit --amend`, no `git push --force`. Every review fix is a **new** conventional commit.
- **Never silently ignore or resolve a comment.** Every handled thread gets a reply comment first, then is marked resolved.
- **Verify before implementing.** A reviewer suggestion is a hypothesis, not an instruction. Confirm it against the actual code.

**Completion Checklist:**
- [ ] Every unresolved thread verified against actual code
- [ ] Valid suggestions implemented, tested, and formatted
- [ ] Fixes pushed as new commits (no amend, no force push)
- [ ] Every handled thread has a reply (applied/applied-differently/not-applied)
- [ ] Every handled thread is marked resolved
- [ ] The PR was **not** merged

## Related Resources

- [RoomleCore AGENTS.md](https://github.com/roomle-internal/RoomleCore/blob/master/AGENTS.md) — Pattern repository for these instructions
- [Roomle Documentation](https://roomle-documentation.netlify.app/) — General Roomle documentation
- [MCP Specification](https://github.com/modelcontextprotocol/specification) — MCP protocol details

## Version

This file is maintained on the `feat/hi-mcp` branch and should be kept in sync with [AGENTS.md](../AGENTS.md).

---

**Last Updated**: 2026-09-27
