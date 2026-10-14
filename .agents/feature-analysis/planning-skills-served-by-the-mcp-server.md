# Planning skills served by the HI MCP server

> **Date**: 2026-10-14
> **Status**: Open
> **Ticket**: [RML-18148](https://roomle.atlassian.net/browse/RML-18148) — HI MCP: add kitchen planning skills
> **Base**: roomle-hi-example `master` (`5c4e81f`, the planning skills in `docs/planning-skills`)
> **Related**: [ADR 0003](../decisions/0003-the-ai-chat-is-an-mcp-client-beside-the-server.md) (every chat is an MCP client), [hi-mcp-behaviour.md §2.4](../../docs/hi-mcp-behaviour.md#24-instructions) (the served text), the backlog items [library neutrality of the served text](../backlog/mcp-policy-issues.md) and [Spec Kit for the prompting](../backlog/speckit-for-the-prompting.md)

## Affected repositories

- **roomle-hi-example** — the MCP server serves the skills: the skill files in the server package
  (`hi-mcp/hi-mcp-server/skills/`), one new tool `get-skill` with the skill index in its description,
  one sentence in the served instructions, the unit tests, the Docker ignore list of the Cloudflare
  image, and the documentation (`docs/hi-mcp-behaviour.md`, `docs/hi-mcp-server.md`,
  `.agents/skills/hi-mcp-tools.md`, the user guide).
- **roomle-ui** — no change. The skills tell the agent how to plan; the planner is not involved.
- **ligna-store** — no change. The store chat takes every tool from the server
  (`createMCPClient().tools()`, ligna-store `hi-mcp/chat.ts`), so it gets `get-skill` with the next
  deployment; its system prompt needs no new sentence.

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
