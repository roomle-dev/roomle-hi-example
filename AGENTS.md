# AGENTS.md — roomle-hi-example

> Open-standard "README for AI" — structured context for GitHub Copilot, Copilot Workspace, coding agents, and LLM-based dev tools.

## Always Do This First

1. **Load matching skills.** Check the [On-Demand Skills](#on-demand-skills) catalog and read every skill file whose domain matches the task *before* taking action. Multiple skills may apply to one task.
2. **Read [`.agents/context/hi-mcp-server.md`](.agents/context/hi-mcp-server.md)** before answering questions about the example page. The HI tools are roomle-ui code and documented there: **read [roomle-ui `.agents/homag-intelligence.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence.md)** before answering architecture or domain questions, and **[roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md)** before changing a tool, a served rule, a guard or a correction — the single reference for how the HI tools behave towards an agent, with every decision, guard, correction and feedback message.
3. **Read [`.agents/README.md`](./.agents/README.md)** for the complete digital brain index, separating living reference from historical records.
4. **Treat documentation as part of the task, not a follow-up.** Every analysis produces a document, and every change to productive code updates one — see [Where Documentation Goes](#where-documentation-goes).

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
- **Purpose**: Standalone HI presets example with the planning assistant of the roomle-ui embedding-lib, which orchestrates HOMAG Intelligence object groups in Roomle room-planner sessions; the prompt tests of the HI tools

## Project Overview

roomle-hi-example is a demonstration and development environment for:

1. **HI Presets Example** — A standalone HTML page (`index.html`) that demonstrates HOMAG Intelligence (HI) room planning with preset configurations, with the AI chat of the roomle-ui embedding-lib: its planning assistant (`startPlanningAssistant`) runs the HI MCP tools (`createHiMcpTools`) in the page
2. **HI Sign-in Example** (`hi-sc-example/`) — the same planner with its chat in TypeScript (Vite), behind a sign-in page where the HI server login, backend ID, library, and the provider, model and API key of the chat are entered ([`.agents/context/hi-sc-example.md`](./.agents/context/hi-sc-example.md))
3. **Demo Proxy** (`minifabric-example/proxy-server/`) — the Cloud Function `proxy_request` that forwards the requests of the Roomle demos to HOMAG and Azure AI Foundry; `npm run dev:proxy` runs it locally, `npm run deploy:proxy` deploys it ([`.agents/context/demo-proxy.md`](./.agents/context/demo-proxy.md))

The start script (`npm start`, the launcher `minimal-hi-example/start.mjs`) provides:
- Static file serving for the example HTML page on port 3000
- With `npm start <provider>:<model-id> <api-key>` (the provider of the embedding-lib — `azure`, `openai`, `mistral`, `anthropic`, `google`, `openai-compatible` — and the exact model id, no aliases, e.g. `npm start azure:gpt-6-astra $AZURE_GPT_KEY`; options such as `--reasoning-effort` after `--`): the model of the chat for the page (`/planning-assistant-config.json`, to this machine only) and the page opened with the chat window visible; without a model, the chat runs on the model proxy of the HI server when the backend enables it
- Browser auto-open at the example URL

## Repository Structure

```
.
├── minimal-hi-example/         # Minimal standalone HI example
│   ├── index.html              # HI presets example page (single file, inline JS)
│   └── start.mjs               # Launcher: static serving (:3000), the model of the chat
├── hi-sc-example/              # Sign-in example in TypeScript (Vite, :3300)
│   ├── index.html              # Sign-in view and planner view
│   ├── src/                    # main.ts, fields-cookie.ts, hi-server.ts, model-config.ts, planner.ts, query-options.ts, style.css, assets/
│   └── tests/                  # Unit tests (Node test runner)
├── df-salesPortal_sc-example/  # Sales portal example: the df-salesPortal page, the chat on the model proxy of the HI server
│   └── index.html              # Single file, inline JS (.agents/context/df-sales-portal-sc-example.md)
├── minifabric-example/
│   └── proxy-server/           # The demo proxy, Cloud Function proxy_request: index.js, package.json (.agents/context/demo-proxy.md)
├── package.json                  # Project metadata and scripts
├── README.md                     # Quickstart and usage guide
├── AGENTS.md                     # This file - AI assistant instructions
├── CLAUDE.md                     # Redirect to AGENTS.md (for Claude Code)
├── .agents/                      # Digital Brain - AI agent knowledge base
│   ├── README.md                 # Digital brain index
│   ├── benchmarks/               # Benchmarks and performance analyses
│   │   └── README.md
│   ├── bug-analysis/             # Bug root-cause analyses
│   │   └── README.md
│   ├── context/                  # The digital brain for the implementation: the example page, its launcher and chat, the prompt test runs
│   │   └── README.md
│   ├── feature-analysis/         # Feature investigations
│   │   └── README.md
│   ├── decisions/               # Architecture Decision Records (ADRs)
│   │   └── README.md
│   ├── images/                   # Images of the backlog and the analyses
│   │   └── README.md
│   ├── refactoring-analysis/     # Refactoring analyses with reports
│   │   └── README.md
│   ├── scripts/                  # Utility scripts (JavaScript only)
│   │   └── README.md
│   ├── skills/                   # On-demand domain knowledge
│   │   ├── README.md
│   │   ├── hi-authoring-rules.md   # HI authoring patterns
│   │   ├── hi-mcp-tools.md         # MCP tool reference
│   │   └── roomle-hi-concepts.md  # Core HI concepts
│   └── wiki/                     # Living-reference pages for recurring questions
│       └── README.md
├── docs/
│   ├── hi-mcp-server.md          # Reference: the example page and the HI tools
│   ├── ai-chat.md                # The AI chat of the example: providers, models, images
│   ├── user-guide/README.md      # User guide: what the HI MCP does, the ways to use it, prompts, limits
│   ├── setup/                    # Setup guides
│   │   └── unreleased-embedding-lib.md # Run the example with an unreleased embedding-lib
│   ├── external/                 # Documents received from outside the development, kept as received
│   ├── test-prompts.json         # MCP test cases (prompt, plan, expectations)
│   ├── minimum-test-prompts.json # The minimum set of the MCP test cases
│   ├── test-prompts.md           # The test plans and how the tests run
│   ├── planning-results.md       # The plannings of the kitchen images (generated by "update planning results")
│   ├── library-information/      # Generated library data: articles, attributes, materials
│   └── images/                   # Test plan and example screenshots
```

## On-Demand Skills

Skills provide deep domain knowledge. Load them by reading the file when the task matches their domain. Skill files are located in `.agents/skills/`.

**Skills belong in `.agents/skills/`.** Every skill of this repository is a Markdown file there with a row in the table below. **Never create a `.claude/` folder in this repository** — no `.claude/skills/`, no `SKILL.md` wrappers and no other tool-specific copy of a skill.

| Skill | Load when the task involves |
|---|---|
| [`.agents/skills/hi-authoring-rules.md`](./.agents/skills/hi-authoring-rules.md) | HI authoring rules, docking patterns, group creation, article catalog |
| [`.agents/skills/hi-mcp-tools.md`](./.agents/skills/hi-mcp-tools.md) | MCP tool reference, get-plan-context, create-or-replace-groups |
| [`.agents/skills/roomle-hi-concepts.md`](./.agents/skills/roomle-hi-concepts.md) | HI concepts: rooms, walls, articles, groups, docking vectors, positioning |
| [`.agents/skills/hi-furniture-smith-article-catalog.md`](./.agents/skills/hi-furniture-smith-article-catalog.md) | Furniture Smith article catalog reference |
| [`.agents/skills/hi-furniture-smith-attributes.md`](./.agents/skills/hi-furniture-smith-attributes.md) | Furniture Smith attributes reference |
| [`.agents/skills/hi-furniture-smith-materials.md`](./.agents/skills/hi-furniture-smith-materials.md) | Furniture Smith materials reference |
| [`.agents/skills/vercel-ai-sdk-chat.md`](./.agents/skills/vercel-ai-sdk-chat.md) | Vercel AI SDK chat integration: providers, server-side auth, @ai-sdk/mcp, streamText |
| [`.agents/skills/hi-mcp-testing.md`](./.agents/skills/hi-mcp-testing.md) | The user asks to **"test the mcp"** (runs the tests of `docs/test-prompts.json` with `run-hi-mcp-tests.js`, writes an evaluated report), or with **"the minimum set"** (`docs/minimum-test-prompts.json`, the report marked as the minimum set); testing the HI MCP end to end: running a prompt through the chat with a real model and planner, the stored snapshot result |
| [`.agents/skills/hi-mcp-timing-benchmark.md`](./.agents/skills/hi-mcp-timing-benchmark.md) | Detailed timing of each agent step: model/tool/planner deltas, skills to the first kitchen, full-run latency, report in `.agents/benchmarks/` and PDF/evidence in `.temp/` |
| [`.agents/skills/hi-mcp-benchmarking.md`](./.agents/skills/hi-mcp-benchmarking.md) | Benchmarking the HI agent: measuring the performance, where the time goes, why the agent is slow, comparing the speed before and after a change — `benchmark-hi-mcp-runs.js` over test runs, the analysis and its document in `.agents/benchmarks/` |
| [`.agents/skills/hi-analysis.md`](./.agents/skills/hi-analysis.md) | The user asks to **"analyse the bug"** / "analyze the bug" / "bug analysis", **"analyse the feature"** / "feature analysis" or **"analyse the refactoring"** / "refactoring analysis": writing the analysis — what it must cover, the affected repositories it names first, where the fix lives (never the library's calculation) |
| [`.agents/skills/hi-analysis-cleanup.md`](./.agents/skills/hi-analysis-cleanup.md) | The user says **"cleanup analyses"** / "cleanup analysis": clean up `.agents/bug-analysis/`, `.agents/feature-analysis/` and `.agents/refactoring-analysis/` — close out every analysis whose work has landed: verify it, promote its durable outcome into the living reference, decisions, ADRs and backlog, delete it, fix the links, rebuild the index |
| [`.agents/skills/hi-backlog-cleanup.md`](./.agents/skills/hi-backlog-cleanup.md) | The user says **"cleanup backlog"**: verify every backlog item against the code, remove what landed, strip history, refresh the code references; reviewing or updating the backlog |
| [`.agents/skills/update-planning-results.md`](./.agents/skills/update-planning-results.md) | The user says **"update planning results"**: regenerate `docs/planning-results.md` — every kitchen image of `docs/images` planned by the HI chat with `update-planning-results.js`, the plan snapshots, the ligna-store plan links and the top, perspective and perspective object images, on a new branch |
| [`.agents/skills/roomle-pr-resolution.md`](./.agents/skills/roomle-pr-resolution.md) | Resolving a pull request: verifying suggested changes, applying them, replying to every review comment, resolving threads. Never merge the PR |
| [`.agents/skills/hi-plan-implementation.md`](./.agents/skills/hi-plan-implementation.md) | Planning a task or implementation — the plan must include unit tests |
| [`.agents/skills/hi-analysis-closeout.md`](./.agents/skills/hi-analysis-closeout.md) | Closing out a single analysis document once its work has landed: verify it landed, promote the durable outcome into living reference, ADRs, tests, skills and the backlog, then delete the analysis |
| [`.agents/skills/hi-github-workflow.md`](./.agents/skills/hi-github-workflow.md) | Before every commit, push, or pull request — git staging rules, conventional commit format, pre-commit verification checklist, pull request guidelines |

### Analysis Triggers

These phrases are shorthand for a full, mandatory workflow. When the user's message contains one, load the skill and execute it in full, without asking for the details it defines.

- **"analyse the bug"** / **"analyze the bug"** / **"bug analysis"** → [`hi-analysis`](./.agents/skills/hi-analysis.md): deep root-cause analysis, written before the fix, in `.agents/bug-analysis/`.
- **"analyse the feature"** / **"analyze the feature"** / **"feature analysis"** → [`hi-analysis`](./.agents/skills/hi-analysis.md): feature investigation, written before the work, in `.agents/feature-analysis/`.
- **"analyse the refactoring"** / **"analyze the refactoring"** / **"refactoring analysis"** → [`hi-analysis`](./.agents/skills/hi-analysis.md): refactoring analysis, written before the work, in `.agents/refactoring-analysis/`.
- **"cleanup backlog"** / **"clean up the backlog"** / **"backlog cleanup"** → [`hi-backlog-cleanup`](./.agents/skills/hi-backlog-cleanup.md).
- **"cleanup analyses"** / **"clean up the analyses"** / **"analysis cleanup"** → [`hi-analysis-cleanup`](./.agents/skills/hi-analysis-cleanup.md).

Analysis is analysis-only: do not modify productive code unless the user also asks for the change.

### Living Reference vs Historical Records

Everything in `.agents/` is one of two kinds:

- **Living reference** describes how the code works *now*. Present tense. No "was fixed", "previously", "no longer", "the old code". No ticket numbers. Updated in the same commit that changes the behaviour it describes. This includes: `.agents/context/`, `.agents/wiki/`, `.agents/skills/`, `.agents/decisions/` (ADRs), all README indexes, and `docs/`.
- **Historical record** is a point-in-time write-up. Written at one moment and never updated after close-out. Deleted when the work it describes has landed and its durable outcome has been promoted. This includes: `.agents/bug-analysis/`, `.agents/feature-analysis/`, `.agents/refactoring-analysis/`, `.agents/backlog/`, and `.agents/benchmarks/`.

### Instructions Home

- `AGENTS.md` is the canonical instruction file.
- `CLAUDE.md` contains exactly `@AGENTS.md` — a one-line redirect so Claude Code picks up the same instructions.
- Do not create `.github/copilot-instructions.md` — Copilot automatically reads `AGENTS.md`.
- The repository root contains a `.temp` folder for temporary and scratch files; the folder is git-ignored (`.gitignore` lists `.temp`), so it is created locally and never committed.

### Infrastructure

- `.agents/skills/` is the only place for skills. Never create a `.claude/` folder, no `SKILL.md` wrappers outside `.agents/skills/`, no tool-specific copies of a skill.
- Every skill is a single markdown file in `.agents/skills/` with a row in the skills table of this file.
- Scripts in `.agents/scripts/` must be written in the repository's primary scripting language (JavaScript/Node.js).
- Temporary and scratch files go in a git-ignored `.temp/` folder, never in `.agents/`.
- Files prefixed with `__` in test resources are temporary and git-ignored; never commit them and never reference them from unit tests.

### Jira / Ticketing

When the repository uses Atlassian Jira:

- **The `jira` CLI is the primary and always-available way to read and write Jira.** Never conclude that Jira is unavailable because an MCP connector needs authorization — the CLI is the source of truth. Always prefix commands with `PAGER=cat`.
- **Never declare Jira unavailable** without first trying the CLI: `PAGER=cat jira issue view <KEY> --plain` and `PAGER=cat jira issue comment add <KEY> --template <file> --no-input`.
- **Never delete a Jira ticket.** No exception.
- **Create a ticket only when the user explicitly asks for it to be created in Jira.** "Write a ticket" or "draft a ticket" asks for the ticket text in the chat.
- **Ticket preflight:** Analyse the ticket before changing code. Tickets often contain only IDs or URLs instead of the actual data. Download the data automatically before investigating. If the ticket is missing required information, add a Jira comment explaining what is missing instead of starting implementation.
- **What must be written back to the ticket:** Analyses (bug, feature, refactoring) and implementation plans. Everything else lives in the repository.
- **Never comment these:** What was implemented (that belongs in the PR description). That a pull request was created. Progress, status, or completion notes.

## Key Architecture Patterns

### HI Tools Architecture

1. **The Tools in the roomle-ui Planner** — the planner serves the only implementation of the HI tools (roomle-ui `packages/web-sdk/packages/homag-intelligence/src/hi-mcp/`, `getExternalObjectAgentTools` and `callExternalObjectAgentTool`); `createHiMcpTools` of `@roomle/embedding-lib/hi` hands them to an agent in the page as tools in the shape of MCP tools, without the MCP protocol, and forwards every call (D94, [ADR 0012](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/decisions/the-hi-tool-set-runs-in-the-planner.md))
2. **The Planning Assistant in the Page** — `startPlanningAssistant` of the embedding-lib runs the agent loop in the page of the example and of the ligna-store; the tools run in the planner of the page (`instance.extended.callExternalObjectAgentTool`) and call its seven planner methods there
3. **Plan-Changing Tools Run in roomle-ui** — Every tool that changes the plan is one planner call, `externalObjectGroupOperation(<tool name>, <the tool's arguments>)`; roomle-ui performs the whole tool as an HI tool command (`hi-tool-commands.ts` in `packages/web-sdk/packages/homag-intelligence/src/`): corrections, ids, docking from the relations, placement, group materials, hints. It answers with the tool's result and the planner steps it made, which the tool set counts for undo (D71 of [roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#3-decisions))

### HI Data Model

1. **Rooms** — Each room has a `walls` array with side labels, coordinates, dimensions
2. **Articles** — Catalog of available modules with dimensions, docking vectors, categories
3. **Groups** — Collections of root modules (article picks) with docking relationships
4. **Docking** — Roots are positioned relative to each other via docking vectors and modes
5. **Positioning** — New groups are positioned with a `placement`: at a wall or in a room corner by `wall`, `alignment` and `offsetMm` — the tool loads the group and moves it there with the logic of `place-group` (roomle-ui `hi-wall-placement.ts`, `hi-plan-space.ts`) —, anywhere else by one point and one rotation, which the tool anchors by the frame of the anchor's article template (roomle-ui `hi-group-placement.ts`). Existing groups are moved with `place-group`

### Authoring Rules

- Never author root positions — roots are positioned by their relation only
- New groups are positioned with a `placement` only (`posRotationZ` counter-clockwise as seen from above: right wall 270, left wall 90); every coordinate the agent reads or writes is in the planner's plan space — millimetres, Z up, `x` to the right and `y` to the top of the top-view image
- Every root after the first names one neighbour with one relation: `rightOf`, `leftOf`, `onTop`, `above` or `behind`
- The tool builds the docking from the relations — vector pairs ownDockingVector -> dockingVector with mode and offset (roomle-ui `hi-group-layout.ts`); groups from `get-plan-context` carry it as `contextData`
- Free docking vectors indicate where new modules can be added

## Hard Rules

### Code Style

- **Prettier** — Format with `npm run format` before committing; `npm run format:check` checks it. The settings are in `.prettierrc.json`, the excluded paths in `.prettierignore` (Markdown and the generated `docs/library-information` are not formatted)
- **Oxlint** — `npm run lint` checks the JavaScript and TypeScript files for correctness errors, `npm run lint:fix` fixes what it can. The settings are in `.oxlintrc.json`; the inline script of `minimal-hi-example/index.html` is not linted
- **ES Modules** — Use `import/export` syntax, not CommonJS `require`
- **TypeScript Types** — Use JSDoc comments for type annotations when needed
- **Async/Await** — Prefer async/await over Promise chains
- **Error Handling** — Use try/catch for synchronous errors, .catch() for promises
- **No new dependencies without reason** — do not add dependencies to the launcher or the scripts without need

### Naming Conventions

- **Variables**: camelCase (`planContext`, `dockingVector`)
- **Constants**: UPPER_SNAKE_CASE (`PORT`, `DEFAULT_CALL_TIMEOUT_MS`)
- **Functions**: camelCase (`getPlanContext`, `createOrReplaceGroups`)
- **Files**: kebab-case (`minimal-hi-example/start.mjs`, `.agents/context/hi-mcp-server.md`)

### Comments

> "Every time you write a comment, you should grimace and feel the failure of your ability of expression." — Robert C. Martin (Uncle Bob)

- **Minimal comments** — Code must express its intent through naming and structure
- **JSDoc for public APIs** — Functions exposed via MCP should have JSDoc
- **No header comments** — No file-level author/license headers
- **No section dividers** — No `// ===` or `// ---` lines

## HI Tool Rules

### Tool Implementation

- Each tool must have a clear description and parameter schema
- Tools should handle errors gracefully and return meaningful error messages
- Tool timeouts should be configurable (default 30s, snapshot calls 120s)
- Tools should log their operations for debugging
- Tools correct agent input whose intent is clear rather than reject it — see [Guards Are a Last Resort](#guards-are-a-last-resort)

### Hard Rule: The Planning Assistant Stays Out of the Glue Logic

The glue logic (roomle-ui `homag-intelligence/src/glue-logic.ts`) implements the manipulations
through the planner's UI: the drag-in, the attribute panel, the moves, splits and deletes the user
makes. The HI tools implement the manipulations through the Planning Assistant: the tool set
(`hi-mcp/`), the tool commands (`hi-tool-commands.ts` and the `hi-tool-*.ts` modules) and the group
operations of `hi-tools.ts`. The two stay apart (D110 of
[roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#3-decisions)):

- **A change for the Planning Assistant never changes `glue-logic.ts`** — not for a fix, not for a
  feature, not for a library step the agent's path lacks. The UI's behaviour stays as it is.
- **The tools implement what they need themselves.** When the Planning Assistant needs behaviour the
  glue logic implements for the UI — the library's conflict resolution, its initial checks, a
  calculation — the tools run it on their side: through the library interface (`LibraryData`), on a
  copy of the group, with conditions of their own. If that means splitting up logic or adding
  conditions in the tools, that is done; there is no alternative.
- **For the Planning Assistant, `glue-logic.ts` holds API functions only**, and they delegate to the
  implementation in the tools.
- **Analyses, plans and backlog items place the fix there.** A gap of the agent's path against the
  UI's path — a library step a create skips, a check the tools do not run — is closed in the tools,
  never by changing the glue logic.

### Library-Neutral

The HI tools serve every HI library, not only Furniture_Smith. The served rules, the tool
descriptions, the results and the tools' logic contain no information about a specific library —
no article, category, attribute, value or measure of one library, not even as an example. The only
source of library information is the library data: the master data and the article list, and in
them the `desc` properties. When an agent picks the wrong library content because it lacks
information, the fix is the desc in the library data, never a served rule. See §2.4 of
[roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#24-instructions).

The policy covers the served text, the results and the tools' logic only. Code comments, tests
and markdown files are no violation: a comment, a test fixture or a README example may name a
library's content freely.

One exception: the attribute filter of the tools (`isAgentFacingAttribute`, roomle-ui
`hi-mcp/agent-facing.ts`) names the element type `mod_TypeElement`, which the agent leaves to the
article. The library does not mark such attributes yet; once it does, the filter reads the mark
(D102 of [roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#3-decisions)).

### Guards Are a Last Resort

A **guard** is a check in the HI tools that refuses an agent's input because it identifies the
input as wrong: the call fails and nothing is created. A guard fights the symptom, not the cause, and it hinders the agent from creating the
planning: every refusal costs the agent a step of its turn, and one wrong group discards every
group of the call.

When an agent creates wrong content, the root cause is the MCP instructions: a rule, a tool
description or an example misleads the agent, asks it to combine more than it can, or the tool
API makes the wrong payload easy to write. That is where the fix belongs.

This is about the HI tools and the HI tool commands their plan-changing tools run in roomle-ui
(`hi-tool-commands.ts`). The planner's checks (the group operations of roomle-ui) protect the planner
from breaking and stay as they are; the tool command corrects the input before it runs an operation,
where it can.

**Guards are always treated as a last resort.** Take the first step that works:

1. **Clarify the instructions.** Find the rule sentence, tool description or example that led the
   agent to the wrong content, and make it say the right thing plainly — shorter, not longer.
2. **Simplify the tool API.** When the agent has to compute or encode something the server can
   derive — a point, a rotation, a docking entry, a partner vector — let the server derive it, so
   the wrong payload cannot be written in the first place.
3. **Correct the input and inform the agent.** Whenever the server can, it corrects the input,
   creates the planning, and says in the tool result what it corrected, so the agent learns from
   the note without losing a step.
4. **Give feedback and ask for the correction.** When the server cannot correct the input, it
   still builds what it can — a wrong group does not cancel the valid groups beside it — and the
   result says what was not built, why, and what to send instead.
5. **Reject only as a last resort** — when nothing in the call can be built, or its intent cannot
   be told (an article id that matches nothing, a group id that is not in the plan). The error
   says what to send instead.

Rules:

- A new guard needs a written reason in its analysis why steps 1–4 do not work.
- An error message that names the one fix is a sign that the server can apply that fix itself.
- Never refuse what the user may legitimately want — a group outside the room, for example. The
  server cannot tell such a request from a mistake.
- The served rules and tool descriptions describe how to succeed, not which payloads are rejected.
- A bug analysis of wrong content an agent created names the instruction or the part of the tool
  API that led the agent there. "The server accepted it" is not a root cause.

Every guard, correction and feedback message of the server is in §8 of
[roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md), the decisions behind them in
its §3.

## Where Documentation Goes

Documentation lives in markdown files under `docs/` and `.agents/`, never in code comments.

### `docs/` is for external readers

- **`docs/`** holds documentation for readers outside the development of this repository: user
  guides, setup and integration guides, and the overviews they need. It is user-friendly and at a
  higher level. It says what the HI agent does and how to use it, not how the code is built.
- **`.agents/`** holds everything about the implementation:
  - the architecture;
  - the decisions, the analyses and the backlog.

  How the code works lives in `.agents/context/`. The HI tools, the planning assistant and the chat
  window are roomle-ui code: their architecture, behaviour reference and tool reference live in
  roomle-ui `.agents/homag-intelligence.md` and `.agents/homag-intelligence/`.
- **Linking:** a page in `docs/` links into `.agents/` where a reader needs the detail, instead of
  repeating it. A document written for developers or agents goes into `.agents/`, never into
  `docs/`.

### Digital Brain Structure

The `.agents/` folder serves as the "digital brain" for roomle-hi-example, containing:

```
.agents/
├── README.md                     # Digital brain index (this file)
├── benchmarks/                   # Benchmarks and performance analyses
├── bug-analysis/                 # Bug root-cause analyses (written before fix)
├── context/                      # The digital brain for the implementation in this repository
├── decisions/                    # Architecture Decision Records (ADRs)
├── feature-analysis/             # Feature investigations and decisions
├── images/                       # Images of the backlog and the analyses
├── refactoring-analysis/         # Refactoring analyses with reports
├── scripts/                      # Utility scripts (JavaScript only)
├── skills/                       # On-demand domain knowledge (skills)
└── wiki/                         # Living-reference pages for recurring questions
```

**IMPORTANT**: All scripts in `.agents/scripts/` MUST be JavaScript (Node.js), not Python. This ensures consistency with the repository's primary language and tooling.

`.agents/context/` is the digital brain for the implementation in this repository — how the code
is built: the processes, the modules and their responsibilities, the protocols between them.
Every new feature is documented and added to `.agents/context/`; every change to the
implementation requires an update in `.agents/context/`. A change to the HI tools is a roomle-ui
change and updates roomle-ui `.agents/homag-intelligence/` in the same roomle-ui branch.

### Analysis Documents

Every change to productive code should be accompanied by analysis documents:

| Analysis Type | Folder | When to Create | Status Values |
|---|---|---|---|
| Bug Analysis | `.agents/bug-analysis/` | "analyse the bug", "analyze the bug", "bug analysis" | Open, Fixed |
| Feature Analysis | `.agents/feature-analysis/` | "analyse the feature", "analyze the feature", "feature analysis" | Open, Implemented, Rejected |
| Refactoring Analysis | `.agents/refactoring-analysis/` | "analyse the refactoring", "analyze the refactoring", "refactoring analysis" | Open, Done |

Each analysis document follows the same lifecycle: written **before** the work, closed out **after** the work. Writing one follows [the analysis skill](./.agents/skills/hi-analysis.md).

**Every analysis names the affected repositories first.** A bug, feature or refactoring analysis
starts, right after its header block, with a short list of the repositories the work changes, one
line each saying what changes there (for example roomle-ui, roomle-hi-example, ligna-store,
RoomleCore). A repository the work leaves unchanged is named only where a reader would expect a
change.

| What you produced | Where it goes |
|---|---|
| Bug analysis | new file in `.agents/bug-analysis/` with kebab-case slug |
| Feature analysis | new file in `.agents/feature-analysis/` with kebab-case slug |
| Refactoring analysis | new file in `.agents/refactoring-analysis/` with kebab-case slug |
| Benchmark and performance analysis | new report in `.agents/benchmarks/` with kebab-case slug; evidence and PDF in `.temp/` unless publication is requested — see [benchmarking](./.agents/skills/hi-mcp-benchmarking.md) and [detailed timing](./.agents/skills/hi-mcp-timing-benchmark.md) |
| New feature capability | `.agents/context/`: update `.agents/context/hi-mcp-server.md` or the document of the area, or create a new one; a user-facing guide for it in `docs/` |
| HI tool behaviour — a tool, a served rule, a result, a guard, a correction, feedback, a decision | roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md`, in the roomle-ui change |
| MCP tool reference updates | roomle-ui `.agents/homag-intelligence/hi-tools-reference.md` and `.agents/skills/hi-mcp-tools.md` |
| Architecture decisions | Create ADR in `.agents/decisions/` |
| Wiki page — a durable answer to a recurring question | `.agents/wiki/` |
| Open work | `.agents/backlog/` |
| Living reference of the implementation | `.agents/context/` |
| User guide, setup or integration guide for external readers | `docs/` |

**Important**: Analysis documents in `.agents/bug-analysis/`, `.agents/feature-analysis/`, and `.agents/refactoring-analysis/` are **historical records** — they document the analysis process and decisions, but the durable knowledge should be promoted to living-reference documentation in `.agents/context/` or the skill files, and to `docs/` where users need it.

**The living reference describes today.** Everything outside the analyses and the backlog —
`.agents/context/`, `.agents/skills/`, `docs/`, the READMEs — says how the code works now:

- When an analysis is deleted, its valuable content goes there first: the invariants, the decisions
  and the rejected approaches someone could re-propose, the guarding tests, and how the planner and
  the library behave as the investigation found it.
- It never says what was wrong in the past: no defect, no earlier behaviour, no "found in" or
  "found with", no "previously", "no longer" or "was fixed".
- It does not record when something was solved, fixed, verified or confirmed.
- It carries no ticket numbers. They belong to the analyses, the backlog items, the pull requests
  and the Jira comments.
- A decision of the HI tools is a row in §3 of roomle-ui
  `.agents/homag-intelligence/hi-tools-behaviour.md` with who decided and its state. It carries no
  date: roomle-ui's `.agents/` holds no history.

**A solved bug keeps no analysis.** Once its fix has landed — on `master`, a roomle-ui fix on
`release/bo-test` or `master` — ["cleanup analyses"](./.agents/skills/hi-analysis-cleanup.md) promotes the valuable content and
deletes the document, and the bug's item leaves the backlog.

## Development Workflow

### Starting the Example

```bash
npm start          # or: node minimal-hi-example/start.mjs
```

This serves the example page `minimal-hi-example/index.html` on port 3000 and opens it;
`npm start <provider>:<model-id> <api-key>` adds the chat ([docs/ai-chat.md](./docs/ai-chat.md)), whose planning
assistant runs the HI tools. `npm run start:sc` starts the sign-in example (`hi-sc-example/`) on
port 3300; a push to the branch `release/pages` publishes it to GitHub Pages
(<https://roomle-dev.github.io/roomle-hi-example/>).

### The Tools

- `get-plan-context` — Get current rooms, articles, groups and obstacles
- `get-skill` — Get a planning skill: how to plan a kitchen or a living room well
- `create-or-replace-groups` — Add, modify or extend groups; position new groups
- `place-group` — Move an existing group against a wall or into a room corner
- `merge-article-into-group`, `insert-article-into-group`, `exchange-root-module`, `swap-root-modules`, `delete-article-and-compact`, `delete-article-in-place`, `delete-group`, `change-module-attribute`, `change-group-attribute`, `merge-groups` — Edit an existing group (commands the planner performs)
- `undo`, `redo` — Revert the last tool call that changed the plan, or bring it back
- `get-price` — Calculate pricing
- `get-order-data` — Get order information
- `get-plan-images` — Render plan images, with the doors and drawers as they are
- `open-or-close-group`, `open-or-close-article` — Open or close the doors and drawers of a group or of one root module, to look inside (the view only, no plan change)

### Adding New Tools

1. Register the tool in roomle-ui `packages/web-sdk/packages/homag-intelligence/src/hi-mcp/hi-mcp-server.ts` (zod schema + handler)
2. Implement the executor in `tool-executors.ts` there. A tool that changes the plan is a tool command in roomle-ui (`HI_TOOL_COMMAND` in `homag-intelligence/src/hi-plan-context.ts`, the command in `HI_TOOL_COMMANDS` of `hi-tool-commands.ts`) plus a forwarder, `inPlanner('<tool name>')`, which sends it through `externalObjectGroupOperation` and wraps it in `oneAtATime`, so it never runs beside another plan change, and in the undo record
3. An edit the planner does not offer yet is a group operation the tool command runs (`HI_GROUP_OPERATION` in `homag-intelligence/src/hi-plan-context.ts`, executed in `hi-tools.ts`) — no new planner method and no implementation in `glue-logic.ts` ([Hard Rule](#hard-rule-the-planning-assistant-stays-out-of-the-glue-logic)). Only if a tool needs a planner method the tools do not call yet: add it to `planner-api.ts` of the tools
4. Add or extend unit tests in roomle-ui `packages/web-sdk/packages/homag-intelligence/__tests__/hi-mcp/` and the fixture `packages/web-sdk/packages/test-helpers/unit/hi-mcp-fixture.json` — a tool command's in `homag-intelligence/__tests__/hi-tool-commands/`
5. Update roomle-ui `.agents/homag-intelligence/hi-tools-behaviour.md` and `.agents/homag-intelligence/hi-tools-reference.md`, and `.agents/skills/hi-mcp-tools.md` here
6. The example page and the ligna-store get the tool with the planner at their server URL; a new embedding-lib version is needed only when the forwarding of `createHiMcpTools` changes — built only after asking ([Hard Rule](#hard-rule-no-embedding-lib-build-without-asking))

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
| 6 | Implement the plan | agent | code, tests, and documentation on a purpose branch, opened as a pull request only when the human asks for it — see [Hard Rule: NO Automatic Pull Requests](#hard-rule-no-automatic-pull-requests) |
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

### Hard Rule: NO Automatic Pull Requests

**NEVER create a pull request on your own.** Not with `gh pr create`, not through the GitHub API or any other tool, not as the last step of a finished task. A pull request is created only when the user explicitly asks for one in the current conversation. When the work is finished, commit it on a purpose branch and say that a pull request can be opened on request.

**You are only allowed to create a pull request when the user requests it.** The rule holds in every repository the work touches — roomle-hi-example, ligna-store, roomle-ui, RoomleCore and any other — not only in this one. No saved note, memory, earlier habit or other repository's workflow makes an exception. A request covers only the pull request it names: a later branch, a follow-up change or a change in another repository needs a request of its own.

### Hard Rule: NO Embedding-Lib Build Without Asking

**NEVER build or publish the roomle-ui embedding-lib without asking the user first.** Not by starting the workflow `CD - GCP - rubens.*` (`gh workflow run cd-gcp-rubens-stage-roomle-com.yaml`, the manual run that publishes `@roomle/embedding-lib` as `0.0.0-dev-<sha>`), not with `npm publish`, not by any other way that builds a new embedding-lib version. A published version cannot be taken back. When a change needs a new embedding-lib version — the example page and the ligna-store load a pinned `0.0.0-dev-<sha>` — finish and push the code, stop, and ask before the build. A confirmation covers that one build only.

### Commit Message Format

Use conventional commits: `type: lowercase description` — no trailing period.

Examples:
- `feat: add new MCP tool for article lookup`
- `fix: correct docking vector resolution`
- `docs: update example prompts`
- `refactor: simplify SSE bridge connection handling`

**Do not put ticket numbers in commit messages or PR titles.** Reference the ticket in the PR body if needed.

### Pull Requests

- Create a PR only when the user requests it — see [Hard Rule: NO Automatic Pull Requests](#hard-rule-no-automatic-pull-requests)
- Keep PRs focused and small
- Include clear description of changes
- Reference related documentation
- Ensure all tests pass (if applicable)
- Update documentation in same PR as code changes

### Pull Request Resolution

**NEVER merge a PR.** Not with `gh pr merge`, not by enabling auto-merge. Merging is always a human decision performed by maintainers — finish the review resolution and stop.

**Load the skill** [`.agents/skills/roomle-pr-resolution.md`](./.agents/skills/roomle-pr-resolution.md) when resolving a PR.

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
- **Wrong content from an agent is an instruction problem** — Find the misleading or too complex
  instruction and clarify it, or simplify the tool API; correct the input automatically before
  rejecting it. A guard is a last resort — see [Guards Are a Last Resort](#guards-are-a-last-resort)
- **Test the fix** — Verify it resolves the issue without introducing regressions

### Process

1. **Reproduce** — Identify steps to reproduce the issue
2. **Investigate** — Trace the data flow and identify the root cause
3. **Implement** — Write clean, focused fix
4. **Validate** — Test the fix thoroughly
5. **Document** — Update documentation if needed

### Refactoring Rules

1. Execute aggressively — investigate failing tests and fix unintended regressions before adapting expectations; update test assertions only for explicitly approved behavior changes.
2. Changed outputs are typically the desired result, but confirm each change is intended.
3. Apply completely — no mix of old and new patterns in the same code path.
4. Every refactoring produces a report — in the pull request description.

## Performance Considerations

- The planner calls of the tools have timeouts (30 s; plan changes and snapshots 120 s)
- Tool implementations should be efficient
- Large plan contexts should be handled efficiently
- Image generation can be expensive — use appropriate timeouts
