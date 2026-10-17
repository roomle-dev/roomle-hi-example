# Bug analysis — the planning skills are served by a tool only

> **Type**: Bug analysis
> **Status**: Fixed
> **Ticket**: none of its own — the follow-up of [RML-18148](https://roomle.atlassian.net/browse/RML-18148)
> **Date**: 2026-10-17
> **Base**: roomle-hi-example `fix/corner-group-window-offset-hint-RML-18201` (`ac69cda`); roomle-ui
> `fix/corner-group-window-offset-hint-RML-18201` (`822e50fb5`)
> **Backlog**: item 67 of [`../backlog/mcp-issues.md`](../backlog/mcp-issues.md), removed with the fix

## Affected repositories

- **roomle-hi-example** — the fix: the skill manifest (`hi-mcp/hi-mcp-server/skills.ts`), the
  capabilities, the skill resources and the handlers of `skills/list` and `skills/get` in
  `createHiMcpServer` (`hi-mcp/hi-mcp-server/hi-mcp-server.ts`), their tests, D75, §5.6 and §8.9 of
  [`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md), the server references, backlog
  item 67 and this analysis. The fix is based on `fix/corner-group-window-offset-hint-RML-18201`.
  The Cloudflare and Azure servers get it with their next deployment. They run the same package,
  their image already holds the skill files (`!hi-mcp/hi-mcp-server/skills/**` in `.dockerignore`),
  and the worker passes the JSON-RPC requests through unchanged.
- **roomle-ui** — no change. The fix makes no planner call, and the skill names in the chats'
  system prompt (`hi-agent-prompts.ts`, D80) stay the same. Its branch
  `fix/corner-group-window-offset-hint-RML-18201` is the planner the example page loads.
- **ligna-store** — no change. Its chat connects to the same MCP server through `@ai-sdk/mcp`, which
  only reads the tools and has no skills API. `get-skill` stays in `hi-mcp/chat-recovery.ts`. The
  store runs no MCP server of its own.

## Symptom

A host that loads skills through the official MCP extension `io.modelcontextprotocol/skills`
([SEP-2640](https://modelcontextprotocol.io/extensions/skills/overview)) finds no skills on the
server. An SDK client connected in memory to `createHiMcpServer` on the base gets this answer:

```
capabilities {"tools":{"listChanged":true}}
resources/list -> MCP error -32601: Method not found
skills/list -> MCP error -32601: Method not found
```

**Reproduce.** `initialize` against the local server (`npm start`): its capabilities carry no
`resources` and no `extensions`. The extension check of the MCP Inspector,
`npx @modelcontextprotocol/inspector@2.11.0 --cli http://localhost:3100/mcp --transport http --method skills/list --verify`,
fails with the same "Method not found".

## Investigation trace

### What the server declares and serves

`createHiMcpServer` (`hi-mcp-server.ts:127-131`) creates the `McpServer` with its instructions and
nothing else. The SDK declares `tools` because tools are registered. Nothing calls
`registerResource` and no `capabilities` option is passed, so the server serves no resources and no
extension. `server.ts:72` creates one server per request (stateless mode).

The skills reach the agent through `get-skill` only (`hi-mcp-server.ts:267-295`):

- the tool description carries the index, one line per skill, built from the frontmatter
  (`skillIndex`, `skills.ts:121`);
- the result is the file (`readSkillFile`, `skills.ts:125-143`, with LF line endings);
- a `SKILL.md` result starts with `SKILL_IN_SESSION` (`hi-mcp-server.ts:78`), which tells the agent
  how the skill applies to this session: the survey is the plan context, the products are the
  catalog, and what the plan context does not carry is an assumption to state, not a question to
  ask.

`loadSkills` (`skills.ts:90`) reads the skills once, when the module loads.

| Skill | Files | Size | Description |
|---|---|---|---|
| `image-planning` | `SKILL.md` | 4,830 bytes | 323 code points |
| `kitchen-planning` | `SKILL.md`, `references/planning-reference.md`, `references/source-catalog.md` | 19,004 + 15,247 + 5,112 bytes | 478 code points |
| `kitchen-planning-fr` | the same three | 13,978 + 16,977 + 8,427 bytes | 588 code points |
| `living-room-planning` | the same three | 17,596 + 13,189 + 8,575 bytes | 587 code points |

Every file has LF line endings. Every frontmatter has two fields, `name` and `description`, as
quoted one-line scalars.

### What the extension asks of a server

From the stable specification (`ext-skills`, `specification/stable/skills.mdx`, SEP-2640, merged
2026-09-13):

| What | Requirement |
|---|---|
| Declaration | the `resources` capability plus `extensions['io.modelcontextprotocol/skills']`, an empty object or `{ directoryRead: true }` |
| `skills/list` | MUST: every skill as `{ uri, frontmatter, resources }`. `uri` is the URI of its `SKILL.md`, `frontmatter` holds every YAML field of that file, and `resources` is the file manifest (or `"dynamic"`) |
| `skills/get` | MUST: params `{ uri }`, the URI of a skill's `SKILL.md`; result `{ skill }`; an unknown URI answers `-32602` (invalid params) |
| Manifest entry | `{ uri, digest, size }`, where `digest` is `sha256:` plus 64 lower-case hex digits and `size` is the byte count |
| Files | read with `resources/read`; the URI SHOULD use `skill://<name>/<path>` |
| Limits | SHOULD NOT exceed 512 files or 16 MiB per skill |
| `resources/directory/read` | only with `directoryRead: true` |

The specification is written against protocol revision `2026-07-28`, where the declaration sits in
`server/discover` and the results carry `resultType: "complete"`, `ttlMs` and `cacheScope`. It does
not say what applies to an older revision.

### The clients and the SDKs on 2026-10-17

The [client matrix](https://modelcontextprotocol.io/extensions/client-matrix) and the
[implementations list](https://github.com/modelcontextprotocol/ext-skills/blob/main/docs/implementations.md):

| Client or SDK | Skills extension |
|---|---|
| Claude Code | not in the matrix; loads skills from the filesystem and from plugins |
| Claude Desktop, Claude web, VS Code GitHub Copilot, Cursor | no (a community fork of VS Code has a prototype) |
| Le Chat | not in the matrix |
| the two chats, `@ai-sdk/mcp` 2.0.62 (newest 2.0.78) | no skills API; they call only `tools()` (`chat-stream.ts:69-81`) |
| ChatGPT plugins, fast-agent, MCP Inspector (from 2.6.0) | partial — ChatGPT imports the skills when the plugin is submitted, as a static snapshot |
| mcpc MCP CLI | yes |
| Goose | planned |
| `@modelcontextprotocol/sdk` 1.30.0 (ours) and 1.32.1 (newest) | no skills API; protocol up to `2025-11-25`, no `server/discover` |
| `@modelcontextprotocol/server` 2.3.1 (TypeScript SDK v2) | knows `server/discover` of `2026-07-28`, no skills API |
| TypeScript SDK skills API | [typescript-sdk#2798](https://github.com/modelcontextprotocol/typescript-sdk/issues/2798) open, draft PR #2818 (label `v2`) |

None of the clients in use supports the extension. This is the trigger the backlog item waits for
("When a client in use supports the extension"), so the trigger has not occurred.

### What SDK 1.30.0 allows

- `ServerCapabilitiesSchema` has `extensions` (`node_modules/@modelcontextprotocol/sdk/dist/esm/types.js:534`),
  so `new McpServer(info, { instructions, capabilities: { extensions: { 'io.modelcontextprotocol/skills': {} } } })`
  declares the extension in the `initialize` result.
- `registerResource` declares `resources` and answers `resources/list` and `resources/read`.
- `server.server.setRequestHandler` accepts a zod request schema for `skills/list` and `skills/get`.
  `assertRequestHandlerCapability` only checks the methods of the core specification, so it accepts
  an extension method.
- `node:crypto` computes the SHA-256.

No new dependency is needed.

### How a host checks a server on `2025-11-25`

The Inspector 2.11.0 CLI reads the extension from the server's capabilities "deliberately without
an era check: `skills/*` are not spec method names in either codec, so a legacy-era server that
declares the extension is serving it (#2234)". It requires `ttlMs` and `cacheScope` only from a
server on the modern revision, and an ad-hoc `--server-url` run negotiates the legacy revision.
`--verify` checks:

- the name: `^[a-z0-9]+(-[a-z0-9]+)*$`, at most 64 characters;
- the description: at most 1024 code points;
- per manifest entry, the digest and the size against the bytes `resources/read` answers;
- the frontmatter of the listing against the frontmatter of the served `SKILL.md`, parsed as YAML;
- name collisions.

The four skills meet the name and description limits (see the table above).

### The session preamble on the extension's path

A host that loads a skill through the extension reads the `SKILL.md` resource, not a `get-skill`
result. If the file is served as it is, which is what the backlog's To-do and the RML-18148 plan ask
("so the Skills extension can later serve the files byte for byte"), that agent never reads
`SKILL_IN_SESSION`. This is the one difference in content between the two paths.

## Root cause

`createHiMcpServer` (`hi-mcp-server.ts:128-131`) declares neither the `resources` capability nor the
Skills extension, and the server has no handler for `skills/list`, `skills/get` or
`resources/read`. That is what D75 decided on 2026-10-14. It rejected "the Skills extension of MCP
alone — no client in use supports it, it is the later step over the same files" and kept the
extension as the later step. The served text sends no agent wrong content: every client in use
reaches the skills through `get-skill`.

## Why the current code produces this

A host with the extension checks the server's capabilities for
`extensions['io.modelcontextprotocol/skills']` before it calls `skills/list`. The `initialize`
result carries only `tools`, so the host lists no skills from this server. Its agent sees the
skills only through the description of `get-skill`, as a tool it may or may not call, not through
the host's own skill loading with its approval and digest checks.

## Proposed fix

The same files are served through the extension too, unchanged, and `get-skill` stays.

1. **The manifest — `skills.ts`.** When the module loads, each skill also gets its manifest: per
   file, the URI `skill://<name>/<path>`, the `sha256:` digest and the byte size of the UTF-8 bytes
   of the text `readSkillFile` serves. Computing it from the served text keeps the digest right for
   a file with CRLF line endings, which `readSkillFile` serves with LF.
2. **The declaration — `createHiMcpServer`.** `capabilities: { extensions:
   { 'io.modelcontextprotocol/skills': {} } }` beside the instructions. There is no
   `directoryRead`, because the manifest is complete.
3. **The resources.** `registerResource` per file, named `<name>/<path>`, under its `skill://` URI
   with `mimeType: 'text/markdown'`. It answers the same text as `readSkillFile`, without the
   preamble. That makes ten resources, which also appear in the resource list of hosts without the
   extension (Claude Desktop, VS Code), where a user can attach one.
4. **`skills/list` and `skills/get`.** Request schemas in zod and handlers through
   `server.server.setRequestHandler`:
   - `skills/list` answers `{ skills }`, every skill with `uri` `skill://<name>/SKILL.md`, the
     frontmatter as `loadSkills` reads it and the manifest. With four skills there is no cursor.
   - `skills/get` answers `{ skill }` for the `uri` of a `SKILL.md`.
   - Following draft PR #2818 for the legacy revision, the results carry no `resultType`, `ttlMs`
     or `cacheScope`.
5. **An unknown URI in `skills/get`** answers `-32602` with the URIs of the skills:
   `Unknown skill "<uri>" - the skills are skill://image-planning/SKILL.md, …`. Like G65, this is
   the last resort, an id that matches nothing. It goes into §8.9 as G67.
6. **Documentation.**
   - D75: the extension serves the same files in addition to `get-skill`; the decision date and the
     state.
   - §5.6 and §8.9 of `docs/hi-mcp-behaviour.md`.
   - The server and skill references: `docs/hi-mcp-server.md`,
     `docs/implementation/mcp-server.md`, `.agents/skills/hi-mcp-server.md`,
     `.agents/skills/hi-mcp-tools.md` and `hi-mcp/hi-mcp-server/README.md`.
   - Backlog item 67 is removed.

`get-skill`, its preamble, the instructions (step 2) and the skill files stay unchanged.

## Test of the fix

- `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts`:
  - the `initialize` capabilities carry `resources` and the extension;
  - `skills/list` answers every skill of `loadSkills()` with its manifest;
  - `resources/read` of every manifest entry answers text whose SHA-256 and byte size match the
    entry, and the text equals `readSkillFile`;
  - the listed frontmatter equals that of the served `SKILL.md`;
  - `skills/get` answers a skill by its URI and answers an unknown URI with `-32602`, naming the
    skill URIs.
- `hi-mcp/hi-mcp-server/tests/skills.test.ts`: the manifest of a fixture skill — digest and size of a
  known text, and a CRLF file digested as served.
- The Inspector check against the local server (`npm start`) exits 0:
  `npx @modelcontextprotocol/inspector@2.11.0 --cli http://localhost:3100/mcp --transport http --method skills/list --verify`.
- Typecheck, lint and format check. No model run: no client in use loads skills through the
  extension.

## What the fix does not do

- **The clients in use** keep loading the skills through `get-skill`. The fix changes nothing for
  the two chats, Claude Code, Claude Desktop, VS Code Copilot, Cursor or Le Chat until one of them
  supports the extension.
- **Protocol `2026-07-28`** (`server/discover`, `resultType`, `ttlMs`, `cacheScope`) is not
  supported, because SDK 1.x does not speak it. The handlers written for this fix give way to the
  skills API of the TypeScript SDK when it ships (#2798), together with the move to that revision.
- **The session preamble** is not served on the extension's path: an agent that loads a skill
  through the extension does not get `SKILL_IN_SESSION`. Serving the files as they are is what the
  RML-18148 plan and the backlog item decided. The review can choose instead to put the preamble
  after the frontmatter of the `SKILL.md` served through the extension. The files would stay
  unchanged and the digest would be computed from the served text.
- **A nested frontmatter field** such as `metadata` is not served. `loadSkills` reads it as an empty
  scalar, so the Inspector's frontmatter check would fail for a skill that has one. No skill has
  one today.

## Rejected approaches

- **The skill files as resources without the extension**: a resource is something the user
  attaches, not something the agent loads (D75).
- **Removing `get-skill`**: the two chats and every other client in use load the skills only through
  it.
- **The preamble in `INSTRUCTIONS`**: the chats do not pass the instructions, every agent would carry
  the preamble in every session, and agents that use `get-skill` would read it twice.
- **Waiting for the TypeScript SDK's skills API**: #2818 is a draft for v2. The fix would have to
  wait for the move to the SDK v2 and to revision `2026-07-28` as well.

## Fix

Implemented as planned on roomle-hi-example `fix/planning-skills-extension`; roomle-ui and
ligna-store are unchanged. The server declares `resources` and `io.modelcontextprotocol/skills`,
answers `skills/list` and `skills/get`, and serves the ten skill files as `skill://` resources (D75,
§5.6 and G67 in [`docs/hi-mcp-behaviour.md`](../../docs/hi-mcp-behaviour.md)). One difference from
the plan: the date column of D75 reads "the Skills extension 2026-10-17, user", without the backlog
item, because the item leaves the backlog with the fix.

Validation:

- `hi-mcp`: 290 tests pass, 14 of them new (4 in `skills.test.ts`, 10 in `hi-mcp-server.test.ts`).
  The 10 new server tests fail against the server code of the base. `typecheck`, `lint` and
  `format:check` are clean.
- The MCP Inspector 2.11.0 against the server alone on port 3120 exits 0: "Verified 4 skills and 10
  files: no conformance errors." No conformance or frontmatter issue; every digest and size is
  verified, and the digests equal the SHA-256 of the files on disk.
- No model run.

## Implementation plan

Branches: roomle-hi-example `fix/planning-skills-extension` (this branch, created from
`fix/corner-group-window-offset-hint-RML-18201`, `ac69cda`). roomle-ui gets no branch and no
change. The plan serves the files as they are, without the preamble, as the RML-18148 plan decided.

A probe of SDK 1.30.0 with zod 4.6.5 confirmed the building blocks:

- `capabilities.extensions` in the `McpServer` options reaches the `initialize` result next to the
  `resources` and `tools` the SDK adds;
- a `skill://` resource is listed and read under its URI unchanged;
- a custom handler answers `skills/list`;
- an `McpError` with `InvalidParams` reaches the client as `-32602`. If the request schema
  requires `uri`, a request without one answers `-32603` from the schema instead, so the schema
  leaves `uri` optional and the handler rejects it.

### 1. The manifest — `hi-mcp/hi-mcp-server/skills.ts`

- `Skill` gets `frontmatter: Record<string, string>`: every field of the `SKILL.md` frontmatter as
  `frontmatterOf` reads it. `loadSkills` already parses that record and keeps only `name` and
  `description` from it; both stay as they are.
- The file read of `readSkillFile` (`skills.ts:142`, the text with LF line endings) becomes a private
  `skillFileText(skill, path)`. `readSkillFile` keeps its signature, its checks and its errors, and
  calls it.
- `skillUri(name, file = SKILL_FILE)`, exported: `skill://<name>/<file>`.
- `skillManifest(skill)`, exported, returns `{ uri, digest, size }[]` in the order of
  `skill.files`, `SKILL.md` first. Per file:
  - `bytes` is `Buffer.from(skillFileText(skill, file), 'utf8')`;
  - `digest` is `sha256:` plus `createHash('sha256').update(bytes).digest('hex')`, with
    `createHash` from `node:crypto`;
  - `size` is `bytes.byteLength`.

→ verify: the new cases of `tests/skills.test.ts` pass, and the existing ones still pass.

### 2. The extension — `hi-mcp/hi-mcp-server/hi-mcp-server.ts`

- **Module constants.** `SKILLS_EXTENSION = 'io.modelcontextprotocol/skills'` and `SKILL_ENTRIES`,
  per skill `{ uri: skillUri(skill.name), frontmatter: skill.frontmatter, resources:
  skillManifest(skill) }`. They are computed once when the module loads, like the skill index;
  the server itself is created per request (`server.ts:72`).
- **Declaration.** `createHiMcpServer` passes `{ instructions: INSTRUCTIONS, capabilities:
  { extensions: { [SKILLS_EXTENSION]: {} } } }` to the `McpServer`.
- **Resources.** After the registration of `get-skill`, every file of every skill is registered
  with `server.registerResource(name, skillUri(skill.name, file), { mimeType: 'text/markdown' }, read)`,
  where `name` is `<skill>/<file>`. `read` logs `[hi-mcp] resources/read <uri>` and returns
  `{ contents: [{ uri, mimeType: 'text/markdown', text: readSkillFile(skills, skill.name, file) }] }`.
  The SDK declares `resources` with the first registration.
- **`skills/list`.** `server.server.setRequestHandler(z.object({ method: z.literal('skills/list') }), …)`
  logs `[hi-mcp] skills/list` and returns `{ skills: SKILL_ENTRIES }`. There is no cursor.
- **`skills/get`.** `server.server.setRequestHandler(z.object({ method: z.literal('skills/get'),
  params: z.object({ uri: z.string().optional() }).optional() }), …)` logs
  `[hi-mcp] skills/get <uri>` and returns `{ skill }`, the entry whose `uri` matches. Any other
  `uri` — an unknown skill, a supporting file, none — throws an `McpError` with
  `ErrorCode.InvalidParams` and the message
  `Unknown skill "<uri>" - the skills are skill://image-planning/SKILL.md, …`, the list built from
  `SKILL_ENTRIES`.
- **What stays out.** No result carries `resultType`, `ttlMs` or `cacheScope` (protocol
  `2025-11-25`), and the extension object has no `directoryRead`.
- **Imports.** `ErrorCode` and `McpError` from `@modelcontextprotocol/sdk/types.js`;
  `readSkillFile`, `skillManifest` and `skillUri` from `./skills`.
- **Unchanged.** `get-skill`, `SKILL_IN_SESSION`, `INSTRUCTIONS` and the tool list.

A skill file changed while the server runs needs a restart, as the index of `get-skill` does: the
manifest is computed at start.

→ verify: the new cases of `tests/hi-mcp-server.test.ts` pass; `npm test` and `npm run typecheck`
in `hi-mcp`.

### 3. Documentation — roomle-hi-example

`docs/hi-mcp-behaviour.md`:

- **§2.4** (lines 128-134): the skills reach the agent through `get-skill` and, in a host with the
  Skills extension of MCP, as that host's skills.
- **D75**:
  - the decision text gets the second path over the same files: the declaration, `skills/list`,
    `skills/get`, the resources under `skill://`, the manifest of the served text, no preamble,
    protocol `2025-11-25`;
  - its rejected list keeps "the Skills extension alone";
  - the date column adds "extended 2026-10-17, user (backlog item 67)";
  - the state column names `skillManifest`, `skillUri`, the registrations and the new tests.
- **§5.6**: a bullet "The Skills extension" with the same content. The heading stays, because five
  documents link its anchor.
- **§8.9**: G67, `skills/get` with a `uri` that is no `SKILL.md` of the index, answered with
  `-32602` and its message. The paragraph below the table names it as the same last resort as G65.

The other documents:

- **`docs/hi-mcp-server.md`** (lines 396-406), **`hi-mcp/hi-mcp-server/README.md`** (lines
  363-367) and **`docs/planning-skills/README.md`** (line 7): the skills are also served through
  the extension.
- **`docs/implementation/mcp-server.md`**: the served-text table (line 77) gets the skill resources
  and the `skills/list` entries; a short paragraph after the tool table names the two handlers.
- **`.agents/skills/hi-mcp-server.md`** (line 64) and **`.agents/skills/hi-mcp-tools.md`** (after
  the tool table): one sentence each.
- **`AGENTS.md`** (line 112) and **`.github/copilot-instructions.md`** (line 120): the description
  of `skills.ts` adds "the manifest of the Skills extension".
- **Backlog**: item 67 leaves `.agents/backlog/mcp-issues.md` (its overview row and its section)
  and `.agents/backlog/README.md` (line 13).

→ verify: `npm run lint` and `npm run format:check` at the root.

### 4. The check against the local server

1. Start the server alone, which needs no page:
   `cd hi-mcp && HI_MCP_PORT=3120 npm start`. Port 3120 leaves port 3100 to the user's servers.
2. Run the check:
   `npx @modelcontextprotocol/inspector@2.11.0 --cli http://localhost:3120/mcp --transport http --method skills/list --verify`.
   It exits 0 with one report per skill and no error. This check also compares the listed
   frontmatter with the served `SKILL.md` parsed by a YAML parser, which the unit tests cannot do
   without a YAML dependency.
3. Stop the server by its PID.

No model run, because no client in use loads skills through the extension.

### 5. Commits

1. `feat: serve the planning skills by the skills extension of mcp`: `skills.ts`,
   `hi-mcp-server.ts` and their tests.
2. `docs: describe the skills extension of the mcp server`: the documentation, the backlog, and
   this analysis set to Fixed with the fix and its verification.

Push the branch and open no pull request. "Cleanup analyses" deletes the analysis later.

## Unit tests

### `hi-mcp/hi-mcp-server/tests/skills.test.ts`

In `describe('loadSkills')`:

- `it('keeps every field of the frontmatter')`: `writeSkill('a', 'name: a\ndescription: Plan an
  a.\nlicense: MIT')`, so `frontmatter` equals `{ name: 'a', description: 'Plan an a.', license:
  'MIT' }`.

A new `describe('skillManifest')`:

- `it('lists every file of a skill under its skill:// URI, SKILL.md first')`: skill `a` with
  `references/b.md` and `references/a.md`. The URIs are `skill://a/SKILL.md`,
  `skill://a/references/a.md` and `skill://a/references/b.md`; `skillUri('a')` is the first one.
- `it('digests and measures the text it serves: LF line endings, UTF-8 bytes')`: `references/a.md`
  holds `'# Küche\r\nline\r\n'`. The entry has `size` 14, the bytes of `'# Küche\nline\n'` and not
  its 13 characters, and `digest` equals `sha256:` plus the hex SHA-256 of `'# Küche\nline\n'`.
  The `SKILL.md` entry digests `readSkillFile(skills, 'a')`.

In `describe('the skills of the server')`:

- `it('meets the limits of the Skills extension')`, the checks of the Inspector's `--verify` in
  CI:
  - every name matches `^[a-z0-9]+(-[a-z0-9]+)*$` and has at most 64 characters;
  - every description has at most 1024 code points;
  - every skill has at most 512 files;
  - the sizes of a skill's manifest add up to at most 16 MiB.

The existing `readSkillFile` cases guard that its checks and errors stay the same.

### `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts`

A new `describe('hi-mcp-server skills extension')` with `connectClient(createMockPlannerApi())`
and a helper that sends `skills/list` or `skills/get` with `client.request(…, z.looseObject({}))`:

- `it('declares the resources capability and the Skills extension')`: `getServerCapabilities()`
  has `resources` and `tools`, and `extensions` equals
  `{ 'io.modelcontextprotocol/skills': {} }`.
- `it('lists every skill with the URI of its SKILL.md, its frontmatter and the manifest of its files')`:
  - the result has the one key `skills`, so no `resultType`, `ttlMs`, `cacheScope` or `nextCursor`;
  - `skills` equals, per skill of `skills`, `{ uri: 'skill://<name>/SKILL.md', frontmatter:
    skill.frontmatter, resources }`;
  - `resources` holds per file `{ uri: 'skill://<name>/<file>', digest:
    expect.stringMatching(/^sha256:[0-9a-f]{64}$/), size: expect.any(Number) }`.
- `it('answers every manifest entry by resources/read with text that matches its digest and size, without a planner call')`:
  per entry, `readResource({ uri })` answers one content with that `uri`, `mimeType`
  `text/markdown` and the text of `readSkillFile`. The SHA-256 of its UTF-8 bytes is the
  digest, and their length is the size. No method of the mocked planner API is called.
- `it('serves SKILL.md as the file, without the session preamble that get-skill puts before it')`:
  the resource `skill://kitchen-planning/SKILL.md` starts with `---\nname: kitchen-planning\n`. The
  `get-skill` text of `kitchen-planning` starts with "In this planning session the survey is the
  plan context" and ends with the resource text.
- `it('lists every skill file as a resource, named by its skill and path')`: `listResources()`
  answers the ten files as `{ name: '<name>/<file>', uri, mimeType: 'text/markdown' }`, in the
  order of `skills` and their files.
- `it('answers skills/get with the entry skills/list lists for that SKILL.md')`: per skill, the
  result has the one key `skill`, which equals its `skills/list` entry.
- `it.each` over `['an unknown skill', 'skill://bathroom-planning/SKILL.md']`,
  `['a supporting file', 'skill://kitchen-planning/references/planning-reference.md']` and
  `['no URI', undefined]`:
  `'answers skills/get for %s with invalid params and the URIs of the skills'`. The request
  rejects with code `-32602`, and the message contains "the skills are
  skill://image-planning/SKILL.md, skill://kitchen-planning/SKILL.md,
  skill://kitchen-planning-fr/SKILL.md, skill://living-room-planning/SKILL.md".
- `it('logs skills/list, skills/get and resources/read')`: with `console.log` spied on, the calls
  log `[hi-mcp] skills/list`, `[hi-mcp] skills/get skill://kitchen-planning/SKILL.md` and
  `[hi-mcp] resources/read skill://kitchen-planning/SKILL.md`.

These existing tests guard that the rest stays as it is:

- `it('exposes exactly the expected tools')`: no new tool;
- the three `get-skill` tests (lines 314-401): index, preamble, G65 and G66;
- `describe('the skills of the server')` in `skills.test.ts`.
