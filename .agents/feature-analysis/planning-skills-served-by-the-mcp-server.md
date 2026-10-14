# Planning skills served by the HI MCP server

> **Date**: 2026-10-14
> **Status**: Implemented — roomle-hi-example `feat/planning-skills-tool-RML-18148`, ligna-store `feat/planning-skills-read-only-RML-18148`, not merged; the live check and the measurement (steps 6 and 7) not run (section 10)
> **Ticket**: [RML-18148](https://roomle.atlassian.net/browse/RML-18148) — HI MCP: add kitchen planning skills
> **Base**: roomle-hi-example `feat/planning-skills` (`5c4e81f`, the planning skills in `docs/planning-skills`, not on `master`; `master` is `154d14f`)
> **Related**: [ADR 0003](../decisions/0003-the-ai-chat-is-an-mcp-client-beside-the-server.md) (every chat is an MCP client), [hi-mcp-behaviour.md §2.4](../../docs/hi-mcp-behaviour.md#24-instructions) (the served text), the backlog items [library neutrality of the served text](../backlog/mcp-policy-issues.md) and [Spec Kit for the prompting](../backlog/speckit-for-the-prompting.md)

## Affected repositories

- **roomle-hi-example** — the MCP server serves the skills: the skill files in the server package
  (`hi-mcp/hi-mcp-server/skills/`), one new tool `get-skill` with the skill index in its description,
  one sentence in the served instructions, the unit tests, the Docker ignore list of the Cloudflare
  image, and the documentation (`docs/hi-mcp-behaviour.md`, `docs/hi-mcp-server.md`,
  `.agents/skills/hi-mcp-tools.md`, the user guide).
- **roomle-ui** — no change. The skills tell the agent how to plan; the planner is not involved.
- **ligna-store** — one line: `get-skill` joins the read-only tools of the store chat's recovery
  (`READ_ONLY_TOOLS`, ligna-store `hi-mcp/chat-recovery.ts`, the copy of the example's), or an
  interrupted turn would report a skill fetch as an unconfirmed write. The store chat takes every
  tool from the server (`createMCPClient().tools()`, `hi-mcp/chat.ts`), so it gets `get-skill` with
  the next deployment; its system prompt needs no new sentence.

## 1. What was asked and why

Jochen Kalmbach (HOMAG) wrote three planning skills and attached them to the ticket; the user
committed them to `docs/planning-skills` (`5c4e81f`). `docs/planning-skills/skills` is byte for byte
the ticket's `skills.zip`; `docs/planning-skills/kitchen-planning-skill` is the kitchen skill once
more, in the VS Code Copilot layout `.github/skills/kitchen-planning/`, plus the Python builder of
its Word documentation. The two PDFs are the documentation of the skills.

| Skill | `SKILL.md` | `references/planning-reference.md` | `references/source-catalog.md` |
|---|---|---|---|
| `kitchen-planning` — a residential kitchen, Germany/EU default | 19.2 KB (about 4.8k tokens) | 15.4 KB (3.8k) | 5.2 KB (1.3k) |
| `kitchen-planning-fr` — a kitchen in France (NF C 15-100, VMC, copropriété, rental) | 14.1 KB (3.5k) | 17.1 KB (4.3k) | 8.5 KB (2.1k) |
| `living-room-planning` — a living room: seating, TV, storage, routes | 17.8 KB (4.4k) | 13.3 KB (3.3k) | 8.7 KB (2.2k) |

Every skill follows the [Agent Skills format](https://agentskills.io/specification): a directory
named like the skill, a `SKILL.md` whose YAML frontmatter carries `name` and `description`, and
supporting files the body refers to by relative path. The `SKILL.md` is a workflow — the brief and
the survey, a constraint register with rule classes, the zones and routes, the contents before the
cabinet sizes, two or three alternatives with task trials, the deliverable with its readiness
status —; the planning reference carries the dimensions with their qualification (the 900 mm
preparation width between sink and hob is Blum's recommendation, not a law; a working aisle of
1000–1200 mm is a sizing heuristic) and a checklist of 40 installation and usability checks; the
source catalog the ten sources behind them. The skill tells the agent to read the planning reference
before applying numbers and to load the source catalog only for a citation question.

The skills were written for VS Code Copilot (`.github/skills/<name>/SKILL.md`, invoked with
`/kitchen-planning`). Their documentation says for every other host: "load the skill through that
application's instruction/resource mechanism". The ticket asks:

1. How can these skills be added to the HI MCP server so that the agents using the server have them?
2. Should the skills be added on the client side, or can the server provide the information? On the
   client side every client would have to implement them; as a feature of the server every client
   could just use them.

Section 4 answers both; sections 5 and 6 give the design and the alternatives.

## 2. How the area works today

### 2.1 What the server tells the agent, and which client passes what

The server has three channels for text ([§5 of the behaviour reference](../../docs/hi-mcp-behaviour.md#5-information-the-server-provides)),
all in `hi-mcp/hi-mcp-server/hi-mcp-server.ts`:

| Channel | Content | Size | Who passes it to the model |
|---|---|---|---|
| The server instructions at initialize | `INSTRUCTIONS`: what everything is made of, the typical workflow, then the full `AUTHORING_RULES` | 21.6 KB, about 5.4k tokens | Claude Code; Copilot and Cursor as their host decides; **neither chat** — `createMCPClient` of the AI SDK takes the tools only, the model gets `CHAT_SYSTEM_PROMPT` (`hi-mcp-chat/chat-config.ts`, ligna-store `hi-mcp/chat.ts`) |
| The tool `get-authoring-rules` | the same `AUTHORING_RULES` as plain text | 18.8 KB | every client, when the agent calls it |
| The 19 tool descriptions | what each tool does and how to succeed with it | 9.0 KB, about 2.3k tokens | **every client**, in the tool list |

The tool list is the one channel every client passes, and the tool result the one channel every
client supports ([§2.3](../../docs/hi-mcp-behaviour.md#23-feedback-to-the-agent)). That is why the
authoring rules are served by a tool as well as at initialize: the chats learn the rules only
through `get-authoring-rules`, and the description of `get-plan-context` carries the sentence about
openings "so both chats receive it in the tool list, even without reading `get-authoring-rules`"
(§2.4). The server registers no MCP resources and no MCP prompts.

### 2.2 The policy of the served text

[§2.4](../../docs/hi-mcp-behaviour.md#24-instructions): one source (`hi-mcp-server.ts`), describe how
to succeed, keep it short, library-neutral — "the served text, the results and the server's logic
carry no information about a specific library — no article, category, attribute, value or measure
of one library". The policy bans one library's content, not the domain's vocabulary; the
[backlog item on library neutrality](../backlog/mcp-policy-issues.md) nevertheless asks that the
general served text stops baking in a kitchen taxonomy as if every library were a kitchen, and the
test `it('speaks of articles and root modules, not of kitchens, …')` in
`hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` caps "kitchen" at seven occurrences in the rules
and bans it from the tool descriptions.

### 2.3 Where the planning agent's domain knowledge comes from today

From the model itself, from one sentence of the chat prompt ("kitchens, wardrobes, living room and
utility furniture, all made of articles") and from the library: the `desc` of every article,
module and value, with the `FUNCTION` and `AI_SELECTION_HINT` lines of a sectioned description
(D63). Nothing tells the agent how a good kitchen is laid out — the zones, the sequence sink,
preparation surface, hob, the dishwasher beside the sink, the clean storage within a turn of it,
landing surfaces beside oven and fridge, no tall unit across the workflow. The skills of the
repository (`.agents/skills`, `.claude/skills`, `.github/skills`) are for the coding agents that
work on the repository, not for the planning agent.

### 2.4 The standard: Agent Skills, and Skills over MCP

**Agent Skills** load progressively: the name and the description of every skill are always in the
model's context (about 100 tokens per skill), the body only when the model or the user picks the
skill, the supporting files only when the body asks for them.

**Skills over MCP** is the official MCP extension `io.modelcontextprotocol/skills`
([SEP-2640](https://modelcontextprotocol.io/seps/2640-skills-extension), final since 2026-09-13;
[overview](https://modelcontextprotocol.io/extensions/skills/overview)). It adds no new primitive —
a new primitive, SEP-2076, was closed in February 2026 — but a convention over resources:

- the server declares the `resources` capability and the extension in `capabilities.extensions`;
- `skills/list` returns one entry per skill: `uri` (`skill://kitchen-planning/SKILL.md`), the
  `frontmatter` unchanged, and `resources`, the complete file manifest with the SHA-256 digest and
  the byte size of every file; `skills/get` returns one entry by URI;
- the files are read with `resources/read`; the host verifies size, digest and frontmatter, asks the
  user for approval bound to the manifest, loads `SKILL.md` into the model's context and reads the
  supporting files on demand, never ahead of need.

Client support on 2026-10-14 ([client matrix](https://modelcontextprotocol.io/extensions/client-matrix),
[survey](https://github.com/zeke/skills-over-mcp)): none of the clients in use here — Claude Code
loads skills from the filesystem and plugins only, Claude Desktop, Claude web, VS Code Copilot and
Cursor have no support; ChatGPT plugins import skills once at submission, the MCP Inspector verifies
them since 2.6.0, fast-agent and the `mcpc` CLI load them. The libraries of this repository:
`@ai-sdk/mcp` 2.0.62 (both chats) offers `tools()`, `listResources`, `readResource`, `listPrompts`
and `getPrompt`, nothing for skills; `@modelcontextprotocol/sdk` 1.30.0 offers `registerResource`,
`registerPrompt` and a typed `capabilities.extensions`, no helper for `skills/list` and `skills/get`
— they would be two request handlers of the server.

## 3. The gap

What the agent is told comes in three layers, and the middle one has no channel:

| Layer | Content | Where it lives | Who maintains it |
|---|---|---|---|
| How to operate the tools | the payload, the relations, the placement, the corrections | the served text (§2.1), library-neutral and short | the MCP server |
| **How to plan a room of one kind well** | the zones, the sequence, the distances, the checks, the deliverable | **nowhere today** — the three skills | HOMAG (Jochen Kalmbach), per room kind and region |
| What the library offers | the articles, their descs, the attributes | the library data, through the plan context | the library team |

The skills belong to the middle layer. They must stay out of the first — the general served text
stays neutral and short, and a kitchen's zones are no use to an agent planning a wardrobe — and
they must reach the agent of every client when the task is a kitchen or a living room, whatever the
client passes to the model.

## 4. Answers to the questions of the ticket

**How can the skills be added to the HI MCP server so that agents using the server have them?** As
files of the server package in the Agent Skills format, served by one tool, `get-skill`, whose
description lists every skill with its name and its description. The agent reads the index in the
tool list, fetches the matching skill before planning a room of that kind, and the files the skill
tells it to read. The same files can later be served by the Skills extension of MCP in addition,
with no change to the files (section 5.4).

**Client side or server side?** Server side. The ticket's argument holds, and the clients make it
stronger:

- The two chats take the tools from the server and nothing else; a skill in their system prompts
  would be two implementations (ADR 0003) paid in every step of every turn, kitchen or not.
- Claude Code, Copilot and Cursor load skills from the filesystem only, inside a workspace that
  holds the files. The server is installed at user scope so that a session can run in any folder;
  the skills would have to be installed per machine and per client.
- Claude Desktop and Le Chat have no skills at all.

A tool reaches all of them with no client code, as `get-authoring-rules` does today. Skills over MCP
is the standard way to serve skills, and the server should offer it as soon as a client in use
supports it; today none does, so the tool is the one channel that works now.

## 5. Proposed design

### 5.1 The skill files live in the server package

`hi-mcp/hi-mcp-server/skills/<name>/SKILL.md` with `references/`, Jochen's files unchanged — the
maintained originals, one source. The server reads the directory at start with `fs` (no build step:
`vite-node` runs the TypeScript, the files sit beside it), parses the frontmatter of every
`SKILL.md` (`name`, `description`) and checks that `name` equals the directory name, as the
Agent Skills format requires.

The Cloudflare image copies only `*.ts`, `package.json` and `tsconfig.json` of the server
(`.dockerignore`); `!hi-mcp/hi-mcp-server/skills/` is added, or the deployed server would serve
no skill. `docs/planning-skills` keeps the two PDFs as the documentation Jochen delivered; the
duplicate skill copies, the `.docx`, the Python builder and the `.DS_Store` files go (open decision
1 in section 8).

### 5.2 The tool `get-skill`

```text
get-skill { name: string, file?: string }
```

`name` is a skill of the index, `file` a path inside the skill (`references/planning-reference.md`),
`SKILL.md` by default. The result is the file as plain text, as `get-authoring-rules` answers. A
name or a file that matches nothing is an error that lists the skills and the files available —
the last-resort case of [§2.2](../../docs/hi-mcp-behaviour.md#22-guards-are-a-last-resort): an id
that matches nothing.

The description is generated from the frontmatter, so it cannot drift from the files:

> Returns a planning skill: how to plan a room of one kind well — the workflow, the zones, the
> dimensions and the checks. Fetch the skill whose description matches the task before planning that
> kind of room, and read the files it names with `file`. Skills: `kitchen-planning` — Plan or review
> a residential kitchen: … ; `kitchen-planning-fr` — Plan or review a residential kitchen in France …
> ; `living-room-planning` — Plan or review a living room …

The three descriptions are 480–600 characters each, the index about 1.9 KB — a fifth of today's
tool descriptions, and it is the one text every client passes to the model. Step 2 of the workflow
in `INSTRUCTIONS` gets one sentence: "For a room of a kind `get-skill` lists, fetch that skill
first."

### 5.3 How a skill meets the planning session

The skills are written for a consultant's workflow: interview the household, measure the room,
collect the services and the budget, register every constraint with an id, build two or three
alternatives, run the task trials, deliver a seven-part report with a readiness status. The planning
session is different: the room, its openings, the obstacles and the catalog are in the plan
context; the services, the budget, the inventory and the household are not; a turn has 16 model
steps in the example chat and 8 in the store ([§9](../../docs/hi-mcp-behaviour.md#9-limits)); and
the user who writes "plan an L-shaped kitchen in the back right corner" expects the kitchen in the
planner, not a questionnaire — every kitchen test of `docs/test-prompts.json` does.

The skills already carry the answer: "Ask only for missing information that changes the next
decision", "Offer concepts with explicit assumptions when facts are incomplete", "Use a planner's
authoritative geometry, catalog, and prices where available", "If no drawing tool exists, supply
wall-by-wall cabinet sequences" — the planner is the drawing tool. What the server adds is the
mapping of the skill onto the session, in the served text, because it is about the tools and holds
for every skill:

> In this session the survey is the plan context — the walls, the doors and windows, the obstacles —
> and the products are the article catalog. What the plan context does not carry — services, budget,
> inventory, the household — is unknown: plan a concept with stated assumptions and name them in the
> answer, instead of asking first, unless the user asks to be interviewed. The layout is the group you
> create; check it against the returned positions and the obstacles; name the alternatives and the
> open checks in the answer instead of building them.

The parts of the kitchen skill the agent can apply directly are its sections 3 to 5: the five zones
and the routes, sink → preparation surface → hob, the dishwasher beside the sink with the dish
drawers within a turn, the landing surfaces, no tall unit across the workflow, the storage schedule
(what cabinets a kitchen needs and where), and the order of placing — immovable constraints,
then sink, preparation, hob and fridge landing, then the dishwasher group, then the rest. Whether
Jochen wants a trimmed variant of the skills for the HI agent is his decision (open decision 2);
this analysis proposes to serve the originals with the mapping above and to measure.

### 5.4 Later: the Skills extension of MCP

With the files in place, the extension is additive: `registerResource` per file under
`skill://<name>/<path>` with `text/markdown`, the two request handlers `skills/list` and
`skills/get` answering the entries with the frontmatter and the manifest (SHA-256 and size computed
from the bytes served), and the capability `extensions['io.modelcontextprotocol/skills']` beside
`resources`. The MCP Inspector CLI verifies a server's skills (`--verify`). It changes nothing for
the clients in use until one of them supports the extension, and the tool stays for the ones that
never will — the two chats among them, unless they implement the host side themselves.

### 5.5 Tests

Unit tests in `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts`:

- `get-skill` answers the `SKILL.md` of every skill directory without a planner call, and a
  supporting file by its path.
- The description of `get-skill` lists every skill of the directory with its frontmatter
  description, nothing else.
- Every `SKILL.md` has a frontmatter with `name` equal to its directory and a `description`.
- An unknown name or file answers with the names and files available.
- The policy test exempts the description of `get-skill` from "no kitchen in the tool descriptions":
  the index names the room kinds by design; the other 19 descriptions stay neutral. The skills
  themselves are domain knowledge, not library content, and may name a kitchen; they must never
  name one library's article or attribute — a rule of §2.4, checked in review, not by a test.
- The existing tests "describes how to succeed instead of what is rejected" and "never tells the
  agent how the server positions a group internally" cover the new text.

The effect on the plannings is measured, not assumed (ADR 0006): "test the mcp" on the kitchen
tests with the skill served and not served, and the
[kitchen-from-image benchmark](../benchmarks/kitchen-from-image-time.md) for the cost. A turn that
loads the kitchen skill and its planning reference adds about 9k input tokens to every later step
and one or two steps; the benchmark puts input at 13 ms per 1,000 tokens with gpt-6-astra, so the
time cost is in the steps, not the tokens.

## 6. Alternatives considered and rejected

| Alternative | Why not |
|---|---|
| **Skill files on the client side only** (`.github/skills`, `.claude/skills` of a workspace) | Reaches the IDE agents in a workspace that holds the files and nobody else: the server is installed at user scope, the chats, Claude Desktop and Le Chat have no filesystem skills. The same files can still be installed in a developer's workspace — they are the standard format — as an extra, not as the channel. |
| **The skills in the chats' system prompts** | Two implementations to keep in sync (ADR 0003), about 9k tokens in every step of every turn whether the task is a kitchen or not, and the IDE clients get nothing. |
| **The skills inlined in `INSTRUCTIONS` or `AUTHORING_RULES`** | About 50 KB more at every initialize, which the chats do not even pass to the model; against "keep it short" and the neutral general text; every agent would carry every skill for every task. |
| **MCP resources without a tool** | The chats would need code to list and read them (`listResources`, `readResource` exist in `@ai-sdk/mcp`, but when to read which skill is a decision the client would have to make); in Claude Code and Copilot a resource is an attachment the user adds by hand. Not model-driven. |
| **One MCP prompt per skill** | A slash command the user invokes in Claude Code, VS Code and Claude Desktop; the model cannot call a prompt, and the chats have no prompt UI. Cheap to add later for the IDE users, no channel for the agent. |
| **The Skills extension alone, now** | No client in use supports it; nothing would change for any user. It is the second step (5.4), not the first. |
| **One tool per skill** (`get-kitchen-planning-skill`, …) | The tool list grows with every room kind and region, and every description repeats the same sentence; one tool with a name mirrors the extension's URI. |
| **The server applies the skill** (a `plan-kitchen` tool that takes a brief and lays out the kitchen) | A planning engine in the server, against [§2.1](../../docs/hi-mcp-behaviour.md#21-the-agent-declares-what-and-where-the-planner-arranges) — the agent declares, the planner arranges — and it would need the kitchen taxonomy in the server's logic, which the neutrality policy keeps out. |

## 7. Code and documents the work would touch

| File | Change |
|---|---|
| `hi-mcp/hi-mcp-server/skills/<name>/` | the three skills, moved from `docs/planning-skills/skills` unchanged |
| `hi-mcp/hi-mcp-server/hi-mcp-server.ts` | the tool `get-skill`, its description generated from the frontmatter, one sentence in `INSTRUCTIONS` step 2, the mapping sentence of 5.3 |
| `hi-mcp/hi-mcp-server/tool-executors.ts` | the executor: read the directory at start, serve a file by name and path |
| `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts` | the tests of 5.5; the registration test "exposes exactly the expected tools" gains `get-skill` |
| `.dockerignore` | `!hi-mcp/hi-mcp-server/skills/` |
| `docs/planning-skills/` | the PDFs stay as the delivered documentation; the duplicate copies, the `.docx`, the builder and the `.DS_Store` files go |
| `docs/hi-mcp-behaviour.md` | a decision row (planning skills are served on demand by `get-skill`; the general served text stays neutral), the tool in §6, the channel in §5, the limit (skills served) in §9 |
| `docs/hi-mcp-server.md`, `.agents/skills/hi-mcp-tools.md` | the tool reference |
| `docs/user-guide/README.md` | one paragraph: the assistant plans a kitchen with HOMAG's kitchen planning skill |
| `.agents/backlog/mcp-policy-issues.md` | the exemption of the `get-skill` description from the taxonomy rule |
| `docs/test-prompts.json`, `.agents/benchmarks/` | the comparison runs of 5.5 |

## 8. Open decisions

1. **Where the maintained skills live.** Proposed: the server package, served from there; the
   documentation PDFs stay in `docs/planning-skills`. The alternative, the server reading
   `docs/planning-skills/skills`, ties the server to a path outside its package and the Docker image
   to the docs folder.
2. **The originals or a variant for the HI agent.** Proposed: the originals as Jochen maintains
   them, plus the mapping sentence of 5.3 in the served text; then measure. A trimmed variant is his
   call once the runs show what the agent does with the brief, the register and the alternatives.
3. **All three skills.** Proposed: yes — the France skill costs 600 characters of index and is
   fetched only for a French kitchen. The agent tells the skills apart by their descriptions.
4. **The Skills extension.** Proposed: after the tool, when a client in use supports it (5.4).

## Sources

- [Skills over MCP — overview](https://modelcontextprotocol.io/extensions/skills/overview) and
  [SEP-2640](https://modelcontextprotocol.io/seps/2640-skills-extension), the
  [ext-skills repository](https://github.com/modelcontextprotocol/ext-skills)
- [Extension support matrix](https://modelcontextprotocol.io/extensions/client-matrix) and the
  [skills-over-mcp survey](https://github.com/zeke/skills-over-mcp) of the harnesses
- [Agent Skills specification](https://agentskills.io/specification)
- [Copilot: create skills](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/create-skills)
  (`.github/skills`, `.claude/skills`, `.agents/skills`)

## 9. Implementation plan

> Step 4 of the [change workflow](../../AGENTS.md#suggested-change-workflow). Written 2026-10-14
> against `feat/planning-skills` (`5c4e81f`). **Branch**: roomle-hi-example
> `feat/planning-skills-tool-RML-18148`, created from `docs/planning-skills-analysis-RML-18148`
> when the implementation starts; ligna-store: the one-line change of `chat-recovery.ts` on a
> branch of its own. **Commits** in roomle-hi-example: the skill files moved with the Docker ignore
> rule; the tool with its tests and documentation; the measurement, if one is run.

### 9.1 Decisions the plan takes

| Decision | Choice | Why |
|---|---|---|
| Where the skills live (open decision 1) | `hi-mcp/hi-mcp-server/skills/<name>/`, moved with `git mv` from `docs/planning-skills/skills`; the duplicate copy, the `.docx`, the Python builder and the `.DS_Store` files are deleted; the two PDFs stay with a three-line `README.md` | one source, inside the package the Docker image copies |
| Line endings | the files carry CRLF throughout (checked: every `SKILL.md` and reference); they are normalised to LF once in the move — the content is unchanged, Prettier ignores Markdown — and the loader tolerates CRLF anyway | fewer tokens, no `\r` in results, and the Skills extension can later serve the files byte for byte |
| The originals or a variant (2) | the originals; the mapping of the skill onto the session is a **preamble the server prepends to the `SKILL.md` result**, never written into the files | the files stay Jochen's; the preamble is served text and lives in `hi-mcp-server.ts` (§2.4, one source) |
| All three skills (3), the extension later (4) | as proposed | — |
| Logging | `get-skill` goes through `runTool`, so every call is logged like every other tool (`[hi-mcp] tool get-skill`); the result is plain text, as `get-authoring-rules` answers | the test runs pair log lines per tool |
| The description | generated from the frontmatter at module load, one line per skill: `- <name>: <description>` | cannot drift from the files |
| The error | an unknown name or file is an error result that names the skills, or the files of that skill, available | the last-resort case of §2.2: an id that matches nothing; the message names what to send |

### 9.2 Steps

1. **The skill files.** `git mv docs/planning-skills/skills/<name> hi-mcp/hi-mcp-server/skills/<name>`
   for the three skills, LF line endings; delete `docs/planning-skills/kitchen-planning-skill/` and
   every `.DS_Store`; add `docs/planning-skills/README.md` (the PDFs are the documentation Jochen
   delivered; the skills are served by the MCP server from `hi-mcp/hi-mcp-server/skills/`); add
   `!hi-mcp/hi-mcp-server/skills/` to `.dockerignore`.
   → verify: `git status` shows three renames; `docker build -f hi-mcp/cf/Dockerfile -t hi-mcp-skills .`
   and `docker run --rm hi-mcp-skills ls hi-mcp/hi-mcp-server/skills` lists the three directories.
2. **The loader** `hi-mcp/hi-mcp-server/skills.ts` (9.3): reads the directory once at module load,
   parses the frontmatter, checks the name against the directory, lists the files, serves a file by
   name and path.
   → verify: `tests/skills.test.ts` (9.4).
3. **The tool.** The executor `get-skill` in `tool-executors.ts`; the registration in
   `hi-mcp-server.ts` with the generated description, the preamble before a `SKILL.md` result and
   one sentence in `INSTRUCTIONS` step 2.
   → verify: the tests of 9.4 in `hi-mcp-server.test.ts` and `tool-executors.test.ts`;
   `npm run typecheck`, `npm test`, `npm run lint`, `npm run format:check` in the repository root.
4. **The clients and the scripts.** `get-skill` joins `READ_ONLY_TOOLS` in
   `hi-mcp/hi-mcp-chat/chat-recovery.ts` and in ligna-store `hi-mcp/chat-recovery.ts` (the two
   copies stay identical), and `INFO_TOOLS` in `.agents/scripts/benchmark-hi-mcp-runs.js`. The
   browser bridges are untouched: no planner method is added.
   → verify: the chat tests pass; one new test per copy (9.4).
5. **The documentation** (9.5), in the same commit as the tool.
6. **The live check.** `npm start gpt-6-astra <key>`, the prompt "plan a kitchen in the back right
   corner of the room": the log shows `tool get-skill` once with `kitchen-planning`, the kitchen
   stands in the corner, and the answer names the assumptions. Then "add a wardrobe to the left
   wall": no skill is fetched.
7. **The measurement** — only when asked for (a model run): "test the mcp" on the kitchen tests
   `kitchen-back-right-corner`, `kitchen-oven-fridge-sink-corner`,
   `kitchen-oven-hood-sink-fridge-corner`, `full-kitchen-walnut-marble-corner`,
   `image-kitchen-left-wall`, `image-kitchen-back-right-corner`, `image-planning-right-wall`,
   `image-only-no-text` and `kitchen-conversation`, compared per test with the reference session
   of the same model, and `benchmark-hi-mcp-runs.js` over both. Expected: one `get-skill` call per
   kitchen turn, one or two more steps, about 9k more input tokens per later step; in the plannings
   the sequence sink, preparation surface, hob and the dishwasher beside the sink. A non-kitchen
   test that fetches a skill it does not need (a sideboard fetching `living-room-planning`) is
   noted, not fixed, unless it costs a step in every run.

### 9.3 The code

`hi-mcp/hi-mcp-server/skills.ts` — no new dependency; `import.meta.url` resolves the directory
beside the module under `vite-node` and under vitest alike (the launcher does the same with
`fileURLToPath`):

```ts
export interface Skill { name: string; description: string; dir: string; files: string[] }

export const SKILLS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'skills');
const SKILL_FILE = 'SKILL.md';

// The frontmatter is one `key: value` per line, the value optionally quoted;
// a line of any other shape is an error that names the file.
const frontmatterOf = (text: string, file: string): Record<string, string> => { … };

export const loadSkills = (dir = SKILLS_DIR): Skill[] =>
  readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const skillDir = join(dir, entry.name);
      const { name, description } = frontmatterOf(readFileSync(join(skillDir, SKILL_FILE), 'utf8'), …);
      if (name !== entry.name) throw new Error(`${…}: name "${name}" differs from its directory "${entry.name}"`);
      if (!description) throw new Error(`${…}: no description`);
      return { name, description, dir: skillDir, files: [SKILL_FILE, ...supportingFilesOf(skillDir)] };
    });

export const skillIndex = (skills: Skill[]): string =>
  skills.map((skill) => `- ${skill.name}: ${skill.description}`).join('\n');

// Only a file of the manifest is read, so a path cannot leave the skill directory.
export const readSkillFile = (skills: Skill[], name: string, file = SKILL_FILE): string => {
  const skill = skills.find((candidate) => candidate.name === name);
  if (!skill) throw new Error(`Unknown skill "${name}" - the skills are ${skills.map((s) => s.name).join(', ')}`);
  if (!skill.files.includes(file)) throw new Error(`Unknown file "${file}" of ${name} - its files are ${skill.files.join(', ')}`);
  return readFileSync(join(skill.dir, file), 'utf8').replace(/\r\n/g, '\n');
};

export const skills = loadSkills();
```

`supportingFilesOf` lists the files of the directory recursively as relative POSIX paths, hidden
files left out, sorted. A directory without `SKILL.md` fails the load (a broken skill is a
developer error, the server does not start); a file beside the skill directories is ignored.

`tool-executors.ts`:

```ts
'get-skill': async (_roomDesignerApi, { name, file }) =>
  readSkillFile(skills, String(name), file === undefined ? undefined : String(file)),
```

`hi-mcp-server.ts` — the registration, after `get-authoring-rules`:

```ts
const SKILL_IN_SESSION =
  'In this planning session the survey is the plan context - the walls, the doors and windows, the obstacles - and the products are the article catalog. What the plan context does not carry - services, budget, inventory, the household - is unknown: plan a concept with stated assumptions and name them in your answer, instead of asking first, unless the user asks to be interviewed. The layout is the group you create: check it against the returned positions and the obstacles, and name the alternatives and the open checks in your answer instead of building them.';

server.registerTool(
  'get-skill',
  {
    description:
      'Returns a planning skill: how to plan a room of one kind well - the workflow, the zones, the ' +
      'dimensions and the checks. Before planning a room of a kind listed here, fetch its skill and ' +
      'follow it; fetch the files it names with file. Skills:\n' + skillIndex(skills),
    inputSchema: {
      name: z.string().describe('The name of the skill'),
      file: z.string().optional().describe('A file of the skill by its path, e.g. references/planning-reference.md; SKILL.md by default'),
    },
  },
  async ({ name, file }) => {
    const text = (await runTool('get-skill', { name, file })) as string;
    const preamble = file === undefined || file === 'SKILL.md' ? `${SKILL_IN_SESSION}\n\n` : '';
    return { content: [{ type: 'text' as const, text: `${preamble}${text}` }] };
  }
);
```

`INSTRUCTIONS`, step 2, first sentence: "For a room of a kind get-skill lists, fetch that skill first
and follow it." — neutral: the kinds are named by the index, not by the instructions.

### 9.4 Unit tests

The fixture of `tests/skills.test.ts` is a temporary directory (`mkdtempSync`) with skills written
by a helper `writeSkill(root, name, frontmatter, body, files)`; the real directory is tested once.

| File | Test | Checks |
|---|---|---|
| `tests/skills.test.ts` | loads a skill with its name, description and files, SKILL.md first | two fixture skills, one with `references/a.md`; `files` is `['SKILL.md', 'references/a.md']`, relative POSIX paths |
| | reads a single-quoted and a double-quoted description and CRLF line endings | the three quoting styles of Jochen's files, `\r\n` throughout |
| | ignores a file beside the skill directories and hidden files inside a skill | a `README.md` in the root, a `.DS_Store` in a skill |
| | fails the load when the name differs from the directory, when the frontmatter or the description is missing, and when a frontmatter line is not a field | four fixtures; every error names the file |
| | fails the load for a directory without SKILL.md | a developer error, the server does not start |
| | serves SKILL.md by default and a file by its path with LF line endings | `readSkillFile(skills, 'a')`, `readSkillFile(skills, 'a', 'references/a.md')`; no `\r` |
| | answers an unknown skill with the skills available, and an unknown or outside path with the files of that skill | `'b'`; `'../../server.ts'`, `'/etc/passwd'`, `'references'`; the message lists `SKILL.md, references/a.md` |
| | the server's skills directory holds kitchen-planning, kitchen-planning-fr and living-room-planning, each with its planning reference and source catalog | `loadSkills()` on the real directory — guards Jochen's files and the move |
| `tests/tool-executors.test.ts` ("remaining tools") | returns a skill file without a planner call | `get-skill` with `name` resolves to the text starting with `---`; with `file` to the reference; no planner method called |
| | rejects an unknown skill naming the skills available | `rejects.toThrow(/the skills are kitchen-planning, kitchen-planning-fr, living-room-planning/)` |
| `tests/hi-mcp-server.test.ts` | exposes exactly the expected tools | `EXPECTED_TOOLS` gains `get-skill` |
| | lists every planning skill with its description in the get-skill description and tells the agent to fetch it before planning | for every skill of `skills`: the description contains `- ${name}: ${description}`; it contains "Before planning a room of a kind listed here, fetch its skill"; `client.getInstructions()` contains "fetch that skill first" |
| | answers get-skill as text, with the session preamble before the skill and without it before a supporting file | no planner method called; the SKILL.md result starts with "In this planning session" and contains "# Kitchen Planning"; the reference result starts with "# Kitchen Planning Evidence"; `console.log` was called with `[hi-mcp] tool get-skill` |
| | answers an unknown skill or file with what is available | `isError` true; the text names the three skills, or the files of `kitchen-planning` |
| | speaks of articles and root modules, not of kitchens, … (existing) | the `/kitchen/i` check runs on `tools.filter((tool) => tool.name !== 'get-skill')`, and `descriptionOf('get-skill')` is asserted to name a kitchen — the exemption is explicit |
| | describes how to succeed instead of what is rejected (existing), never tells the agent how the server positions a group internally (existing) | run unchanged over the new description, preamble and sentence: no "reject", no "the unit", no internals |
| `hi-mcp-chat/tests/chat-recovery.test.ts` (or `chat-stream.test.ts`, where the read-only outcomes are tested) | reports a get-skill call as read-only in an interruption summary | an interrupted turn whose only outcome is `get-skill` says that nothing was created or changed |
| ligna-store `hi-mcp/__tests__` (the store's copy) | the same test on the store's `chat-recovery.ts` | — |

Not unit-tested, verified by hand: the Docker image carries the skills (step 1), the live check
(step 6).

### 9.5 Documentation

| File | Change |
|---|---|
| `docs/hi-mcp-behaviour.md` | §2.4 a bullet: the planning skills are served text in files, served on demand, and the only served text that names a room kind — the general text stays neutral; §3 a group "Planning skills (2026-10-14)" with **D75**: domain planning knowledge is served on demand by `get-skill` as skills in the Agent Skills format, the index in the tool description, the session preamble before `SKILL.md`; rejected: the chats' prompts, the IDE skill folders, the instructions, resources or prompts alone, the Skills extension alone (no client in use supports it — the later step), one tool per skill, a planning tool in the server; §5.3 `get-skill` returns text; §5 a new 5.6 "Planning skills (`get-skill`)": the index, the preamble, what a skill is for the agent; §6 the table row and a section `### get-skill`; §8 the error of an unknown name or file, in the words of the message |
| `docs/hi-mcp-server.md` | `### get-skill` in the tool reference after `get-authoring-rules`; the tool list of the example |
| `hi-mcp/hi-mcp-server/README.md` | the tool section |
| `docs/implementation/mcp-server.md`, `docs/implementation/tool-executors.md` | the tool tables; `skills.ts` in the module list |
| `.agents/skills/hi-mcp-tools.md` | the "Core Tools" row, a reference section, the standard workflow (fetch the skill first) |
| `.agents/skills/roomle-hi-concepts.md` | one sentence beside the one on `get-authoring-rules` |
| `.agents/skills/hi-mcp-server.md` | the module `skills.ts` and the skills directory in the architecture |
| `docs/user-guide/README.md` | "How it works": for a kitchen or a living room the assistant reads a planning skill written by HOMAG first — the zones, the sequence sink, preparation surface, hob, the dishwasher beside the sink |
| `AGENTS.md` "Testing Tool Calls", `.github/copilot-instructions.md` (its mirror) | `get-skill` in the tool list; "Adding New Tools" unchanged |
| `.agents/backlog/mcp-policy-issues.md` | the description of `get-skill` is exempt from the taxonomy rule by design |
| `docs/planning-skills/README.md` | new: what the PDFs are, where the skills live |
| `.agents/README.md`, `.agents/feature-analysis/README.md` | the status at close-out |
| this document | §10 implementation report at close-out |

### 9.6 Definition of done

- [ ] The three skills are in `hi-mcp/hi-mcp-server/skills/`, byte for byte Jochen's content with LF line endings; the duplicates are gone; the Docker image lists them.
- [ ] `get-skill` is registered, its description lists the three skills, `SKILL.md` comes with the preamble, a reference without it, an unknown name or file answers with what is available.
- [ ] The tests of 9.4 pass; `npm run typecheck`, `npm test`, `npm run lint` and `npm run format:check` are clean.
- [ ] `get-skill` is read-only for both chats' recovery and an information tool for the benchmark script.
- [ ] The documents of 9.5 are updated in the same commits.
- [ ] The live check of step 6 passes.
- [ ] The measurement of step 7 is run when asked for, and its result is in the implementation report.

## 10. Implementation report

> Written 2026-10-14. roomle-hi-example `feat/planning-skills-tool-RML-18148`, ligna-store
> `feat/planning-skills-read-only-RML-18148`.

### 10.1 What was built

| Step | Result |
|---|---|
| 1. The skill files | the three skills moved with `git mv` to `hi-mcp/hi-mcp-server/skills/`, LF line endings — every file compared against `5c4e81f` with the carriage returns removed: identical; the second copy of the kitchen skill, the `.docx`, the Python builder and the `.DS_Store` files deleted; `docs/planning-skills/README.md` beside the PDFs; `.dockerignore` re-includes `hi-mcp/hi-mcp-server/skills/**` |
| 2. The loader | `hi-mcp/hi-mcp-server/skills.ts` as planned (`loadSkills`, `skillIndex`, `readSkillFile`, `skills`); the skills sorted by name; a hidden directory beside the skills is ignored |
| 3. The tool | `get-skill` in `tool-executors.ts` and `hi-mcp-server.ts`, the description generated from the frontmatter, `SKILL_IN_SESSION` before a `SKILL.md`, the sentence in `INSTRUCTIONS` step 2 |
| 4. The clients and scripts | `get-skill` in `READ_ONLY_TOOLS` of `hi-mcp/hi-mcp-chat/chat-recovery.ts` and ligna-store `hi-mcp/chat-recovery.ts`, and in `INFO_TOOLS` of `.agents/scripts/benchmark-hi-mcp-runs.js` |
| 5. The documentation | `docs/hi-mcp-behaviour.md` (§2.4, D75, §5.1, §5.3, §5.6, §6, G65 and G66 in §8.9, §9), `docs/hi-mcp-server.md`, `hi-mcp/hi-mcp-server/README.md`, `docs/implementation/mcp-server.md` and `tool-executors.md`, the skills `hi-mcp-tools.md`, `roomle-hi-concepts.md` and `hi-mcp-server.md`, the user guide, `AGENTS.md` and its Copilot mirror, the policy backlog item |

Deviation from the plan: the ligna-store has no test runner, so its one-line change has no test of its
own; the example's test covers the same code, and the two copies differ only in their formatting.

### 10.2 Verification

| Check | Result |
|---|---|
| `npm test` in `hi-mcp` | 15 files, 268 tests passed — 22 new: 16 in `tests/skills.test.ts` (with the parametrised cases), 2 in `tool-executors.test.ts`, 3 in `hi-mcp-server.test.ts`, where 2 more changed in `hi-mcp-server.test.ts`; 1 new in `hi-mcp-chat/tests/chat-stream.test.ts` |
| `npm run typecheck` in `hi-mcp`, `npm run lint`, `npm run format:check` | clean |
| The server over HTTP (`HI_MCP_PORT=3187`, no page) | `tools/list` carries `get-skill` with the three index lines and the schema `name`, `file?`; `get-skill` `living-room-planning` answers 18,159 characters starting with the preamble; `file` `../../server.ts` is an error naming the three files of the skill |
| The Docker image | not built — the Docker daemon was not running; the ignore rules checked with Docker's matching (`@balena/dockerignore`, outside the repository): the six skill files and `skills.ts` are in the build context, the tests and the READMEs are not; the Dockerfile copies the whole server folder |
| Step 6, the live check with a model | not run: a model run needs the user's go |
| Step 7, the measurement | not run, as planned: only when asked for |

### 10.3 Still open

- The live check with a model (step 6) and the comparison runs (step 7).
- A Docker build of the Cloudflare image, or the next deployment, to confirm the skills are in it.
- The Skills extension of MCP (5.4), once a client in use supports it.
