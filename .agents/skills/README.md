# Skills

On-demand domain knowledge — procedures an agent loads when the task matches the skill's domain. Skills live exclusively in this folder.

## Core Skills

| Skill | Description | Load when |
|---|---|---|
| [`hi-analysis`](hi-analysis.md) | Analyse the bug, feature, or refactoring | "analyse the bug/feature/refactoring", "analyze...", "bug/feature/refactoring analysis" |
| [`hi-plan-implementation`](hi-plan-implementation.md) | Plan an implementation with unit tests | Planning a task or implementation |
| [`hi-backlog-cleanup`](hi-backlog-cleanup.md) | Sweep the backlog, verify every item against the code | "cleanup backlog", "clean up the backlog", "backlog cleanup" |
| [`hi-analysis-cleanup`](hi-analysis-cleanup.md) | Close out finished analyses across all three folders | "cleanup analyses", "clean up the analyses", "analysis cleanup" |
| [`roomle-pr-resolution`](roomle-pr-resolution.md) | Resolve a PR's code review | Resolving a pull request's code review |
| [`hi-analysis-closeout`](hi-analysis-closeout.md) | Close out a single analysis document at commit time | Work with an analysis document is being committed |
| [`hi-github-workflow`](hi-github-workflow.md) | Git staging, conventional commits, pre-commit checklist, PR guidelines | Before every commit, push, or pull request |

## Project Skills

| Skill | Description | Load when |
|---|---|---|
| [`hi-mcp-server`](hi-mcp-server.md) | MCP server architecture, tool definitions, protocol handling, WebSocket bridge | MCP server architecture, tool definitions, protocol handling, WebSocket bridge |
| [`hi-mcp-cloudflare-deployment`](hi-mcp-cloudflare-deployment.md) | Cloudflare deployment of the hi-mcp server | Updating/deploying the Cloudflare-hosted hi-mcp server |
| [`hi-authoring-rules`](hi-authoring-rules.md) | HI authoring rules, docking patterns, group creation, article catalog | HI authoring rules, docking patterns, group creation, article catalog |
| [`hi-mcp-tools`](hi-mcp-tools.md) | MCP tool reference, get-plan-context, create-or-replace-groups | MCP tool reference |
| [`roomle-hi-concepts`](roomle-hi-concepts.md) | HI concepts: rooms, walls, articles, groups, docking vectors, positioning | HI concepts and data model |
| [`vercel-ai-sdk-chat`](vercel-ai-sdk-chat.md) | Vercel AI SDK chat integration | Vercel AI SDK chat integration |
| [`hi-mcp-testing`](hi-mcp-testing.md) | Testing the HI MCP end to end | "test the mcp", testing the HI MCP end to end |
| [`hi-mcp-benchmarking`](hi-mcp-benchmarking.md) | Benchmarking the HI agent | Benchmarking the HI agent |
| [`update-planning-results`](update-planning-results.md) | Regenerate docs/planning-results.md | "update planning results" |
| [`hi-furniture-smith-article-catalog`](hi-furniture-smith-article-catalog.md) | Furniture Smith article catalog | Article catalog reference |
| [`hi-furniture-smith-attributes`](hi-furniture-smith-attributes.md) | Furniture Smith attributes reference | Attribute reference |
| [`hi-furniture-smith-materials`](hi-furniture-smith-materials.md) | Furniture Smith materials reference | Materials reference |

## Adding a New Skill

1. Write the skill file in this folder with a kebab-case name.
2. The skill file must have: title, trigger statement, goal, procedure, hard rules, completion checklist.
3. Add a row to this table.
4. Add a row to the skills table in `AGENTS.md` and in `.agents/README.md`.

Never create a `.claude/skills/` folder, never create `SKILL.md` wrapper files outside this folder, and never make tool-specific copies of a skill.
