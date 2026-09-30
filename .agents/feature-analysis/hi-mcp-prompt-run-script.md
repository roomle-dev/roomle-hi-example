# Feature Analysis: HI MCP testing skill — the prompt run script

> **Type**: Feature Analysis
> **Domain**: agent tooling (`.agents/scripts`, `.agents/skills`); uses the launcher `minimal-hi-example/start.mjs`, the chat backend `hi-mcp/hi-mcp-chat`, the MCP server `hi-mcp/hi-mcp-poc-json` and the example page `minimal-hi-example/index.html`
> **Trigger**: Request of 2026-09-30: "create a new skill for testing the hi mcp … the first thing you need to do is a script in .agents/scripts" — start the MCP with a provider and key given as parameters (like `npm start`), apply a prompt given as a parameter and wait for the result, read the result with `roomDesignerApi.extended.getExternalObjectSnapshot()` and store it in a new subdirectory of `.temp/result`
> **Date**: 2026-09-30
> **Author**: AI Assistant
> **Status**: Implemented
> **Branch**: `feat/hi-mcp-testing-skill` (roomle-hi-example)

> **Close-out (2026-09-30)**: implemented with the recommendations of the open questions (decoded
> assets, `<UTC timestamp>-<provider>`, MCP port 3110, `--dev` and `--headed`, the names as
> proposed) and the implementation decisions in the [close-out report](#close-out-report-2026-09-30)
> — the main one: one abort race around the whole session instead of one per wait. Verified with
> real Mistral runs. The living reference is `.agents/skills/hi-mcp-testing.md`. The analysis
> below is kept as written.

---

## What was asked and why

A new skill for testing the HI MCP. Its first building block is a script in `.agents/scripts` that

1. starts the MCP server and the chat with a provider and an API key given as parameters — the same
   way `npm start <provider> <api-key>` does in the repository root;
2. applies a prompt, also given as a parameter, and waits until the agent has finished;
3. reads the resulting plan with `roomDesignerApi.extended.getExternalObjectSnapshot()` and stores it
   in a new subdirectory of `.temp/result`.

Changes to `minimal-hi-example/index.html` are allowed if the script needs them. The next steps of
the skill are announced for later; this analysis covers the script and the first version of the
skill file only.

Why: every prompt test is manual today — start the launcher, type the prompt into the chat window,
look at the plan, press "Get snapshot" to download the result. The prompts in
[`docs/testing-prompts.md`](../../docs/testing-prompts.md) and the model comparison in
[AI model selection for kitchen planning](ai-model-selection-for-kitchen-planning.md) need runs that
can be repeated per prompt and per model, starting from the same plan, and that leave a result on
disk an agent can inspect.

## How the area works today

### The launcher

`minimal-hi-example/start.mjs` takes the provider and the key as plain positional arguments
(`parseChatArgs`, `start.mjs:59-83`) and validates the provider against its own list
(`CHAT_PROVIDERS`). It runs the build gate (`npm install` on the first run, then the typecheck of
the `hi-mcp` workspace, `start.mjs:107-114`), serves the page on `EXAMPLE_PORT` (3000), spawns the
MCP server (`HI_MCP_PORT`, 3100) and the chat backend (`HI_CHAT_PORT`, 3200), prints the example URL
(`start.mjs:217`) and opens it unless `--no-open` is given (`start.mjs:223`). `--dev` points the
planner at the local Rubens UI dev server (`server_url=http://localhost:5173/`). The URL is composed
in one place (`EXAMPLE_URL`, `start.mjs:84-90`): `mcp=true`, the HI backend and library, `chat=true`
with a chat provider, `mcp_port`/`chat_port` when the port variables are set, `server_url` for
`--dev`. The launcher runs until SIGINT/SIGTERM and then kills its two children
(`start.mjs:226-231`).

### The chat backend

`hi-mcp/hi-mcp-chat` answers `POST /chat` with a body `{ messages: [{ role, content }] }`
(`chat-config.ts`, `parseChatMessages`). It opens an MCP client per request, runs `streamText` with
the MCP tools and a step limit of 8 (`chat-server.ts:109`) and streams plain text back. Tool calls
appear as `[tool] <name>` lines (`chat-server.ts:46`), failures as `[error] <message>` lines
(`chat-server.ts:114`); the stream closes when the model is done (`chat-server.ts:132`). The backend
binds to 127.0.0.1 (`chat-server.ts:163`), answers `GET /health` (`chat-handler.ts:36`) and accepts
requests without an `Origin` header (`chat-handler.ts:53` rejects only foreign origins) — a Node
script can call it directly.

### The page

- `window.instance = roomDesignerApi` (`index.html:884`) exposes the planner to scripts in the page.
- With `mcp=true` the page opens the WebSocket bridge to the MCP server and reconnects 3 s after
  every close (`index.html:1060-1121`).
- With `chat=true` the chat window is a client of `POST /chat`; it keeps the conversation in the page
  and drops the `[tool]` lines from the reply (`index.html:1130-1256`). Whether a turn is still
  running is held in a local `busy` variable only.
- "Get snapshot" calls `getExternalObjectSnapshot()` and downloads the JSON (`index.html:909-920`).
- The planner persists its state (`saveToIdb: true`, `index.html:590`): a browser that has run the
  example before can come back with that state instead of the preset plan.

### The MCP server

Stateless Streamable HTTP in JSON response mode: every `POST /mcp` gets a new server and transport,
so a single `tools/call` request works without a preceding `initialize`
(`hi-mcp-poc-json/server.ts:29-55`). A tool call before a page is connected fails with the
"No HI page connected" error. The bridge keeps one page: a newer connection replaces the current one
and the replaced page is closed (`page-bridge.ts:29-38`).

### The snapshot

`getExternalObjectSnapshot()` without a request object produces everything
(`roomle-ui/packages/web-sdk/packages/planner-core/src/roomle-planner.ts:1708-1800`):

| Field | Content |
|---|---|
| `orderData` | the order manager group data (object) — the groups, articles and attributes |
| `planXML` | the plan XML (string) |
| `objectGlb` | the HI objects as GLB, base64 |
| `perspectiveImage`, `topImage` | the whole plan rendered, base64 PNG without the data-URL prefix |
| `perspectiveObjectImage`, `topObjectImage` | the HI objects only, base64 PNG |

The object fields are only produced when the plan contains HI groups.

### Existing test aids

- `docs/testing-prompts.md` — the prompt collection and a manual test procedure.
- Root `package.json` — `plan:mistral`, `plan:gpt5`, `plan:gpt5.4` start the chat with the key from
  an environment variable.
- The live check of RML-18004 ([close-out](hi-mcp-command-api.md#verification-1)) ran the example in
  headless Chromium with an MCP client — an ad-hoc scratchpad script that imported Playwright by
  absolute path from the roomle-ui checkout. Nothing of it is in this repository.

### `.agents/scripts`

Its own npm package (`.agents/scripts/package.json`, ESM, dependencies `sharp` and `node-fetch`),
not part of the root workspaces; `node_modules` and `package-lock.json` are ignored
(`.agents/scripts/.gitignore`). Scripts there must be JavaScript. Playwright is not a dependency
anywhere in this repository; roomle-ui uses `playwright` 1.55.0, whose Chromium build (1187) is
already in the local Playwright browser cache.

## The gap

1. **No browser without a human.** The planner needs a browser; nothing in this repository can open
   the example page and keep it open under script control.
2. **No end-of-run signal in the page.** The chat window's `busy` flag is local. The only reliable
   signal that the agent is done is the end of the `POST /chat` stream.
3. **No readiness signal.** A prompt sent before the page is connected and the HI library is loaded
   makes the model's first `get-plan-context` fail or return no articles.
4. **No result on disk.** The snapshot reaches the disk only as a browser download.
5. **No isolation from other example tabs.** A tab from an earlier `npm start` session keeps
   reconnecting to port 3100; since a newer connection replaces the current page, such a tab takes
   the bridge away from the script's page and the tools edit the wrong plan — without any error.

## Proposed design

### Command

```bash
node .agents/scripts/run-hi-mcp-prompt.js <provider> <api-key> "<prompt>" [--dev] [--headed]
```

`<provider>` and `<api-key>` are the launcher's arguments, passed through unchanged; the provider is
validated by the launcher (`CHAT_PROVIDERS` stays the only list). `--dev` is passed through too.
`--headed` shows the browser window, for watching a run.

### Flow

1. **Start the launcher** — `node minimal-hi-example/start.mjs <provider> <api-key> --no-open
   [--dev]` as a child in its own process group, with `HI_MCP_PORT` set to a port of its own (see
   [open question 3](#open-questions-for-the-review-of-this-analysis)), so tabs of an interactive
   session cannot reach the script's MCP server. The launcher's output is echoed; the script takes
   the example URL from the printed `➜  Example:` line, so the URL composition stays in one place.
   If the launcher exits early (unknown provider, busy port, typecheck error), the script stops with
   the launcher's exit code.
2. **Wait for the chat backend** — poll `GET /health` until 200 (the build gate runs first).
3. **Open the page** — Playwright Chromium, headless unless `--headed`, with the SwiftShader flags
   that made the renders work in the RML-18004 check. A fresh browser context has no IndexedDB, so
   every run starts from the preset plan.
4. **Wait for readiness** — poll the MCP tool `get-plan-context` (a single JSON-RPC `tools/call` on
   `/mcp`) until the result lists articles. This is the call the model makes first; it succeeds only
   when the server runs, the page is connected and the HI library is loaded.
5. **Apply the prompt** — `POST /chat` with `{ messages: [{ role: 'user', content: prompt }] }`,
   read the stream to its end and split it into the answer text, the `[tool]` names (in order) and
   the `[error]` lines.
6. **Read the result** — `page.evaluate(() => window.instance.extended.getExternalObjectSnapshot())`.
7. **Store the result** in `.temp/result/<YYYY-MM-DDTHH-MM-SS>-<provider>/` (`.temp` is ignored by
   git):
   - `snapshot.json` — the return value of `getExternalObjectSnapshot()`, unchanged;
   - `run.json` — provider, prompt, answer, tool names, errors, start time and durations, example URL;
   - decoded assets, if [open question 1](#open-questions-for-the-review-of-this-analysis) is
     answered as recommended.
8. **Clean up** in every case (success, error, Ctrl+C) — close the browser, then SIGTERM to the
   launcher's process group, which also reaches the npm and vite-node processes below it (the chat
   backend has no orphan guard of its own). The script prints the result directory.

Exit code 0 when the stream had no `[error]` and the snapshot is stored; 1 otherwise. The result
directory is written in both cases — after an error the plan state is the evidence.

Timeouts as named constants: launcher ready 3 min (first run installs), page ready 2 min, chat
10 min (8 steps, a tool call can take up to 120 s), snapshot 2 min.

### `index.html`

No change. The planner is reachable as `window.instance`, and the prompt goes to the chat backend
directly instead of through the chat window (see
[alternatives](#alternatives-considered-and-rejected)). The model sees the same system prompt and
tools either way.

### Dependency

`playwright` 1.55.0, exactly pinned, in `.agents/scripts/package.json` — the version roomle-ui uses,
so the cached Chromium build is reused on this machine; elsewhere `npx playwright install chromium`
once. Nothing is added to the `hi-mcp` workspace or to the launcher. Without Playwright installed the
script stops with the install hint (`npm install` in `.agents/scripts`).

### The skill

`.agents/skills/hi-mcp-testing.md`, first version: when to load it, prerequisites (Node 20+,
`npm install` in `.agents/scripts`, an API key, for `--dev` a running roomle-ui dev server), the
run command, the content of a result directory and how to inspect it (the top image with Read, the
groups in `orderData`), and what to check when a run fails (busy ports, the launcher's typecheck,
`[error]` lines in `run.json`). The skill grows with the next steps. It is registered in the skill
tables of `AGENTS.md`, `.agents/README.md` and `.github/copilot-instructions.md`, and the testing
guidelines in `docs/testing-prompts.md` point to it.

## Alternatives considered and rejected

| Alternative | Why rejected |
|---|---|
| Type the prompt into the page's chat window and wait for the status line to hide | Couples the script to DOM ids and to the page-internal `busy` state; the page drops the `[tool]` lines, so the tool trace is lost; no exact end signal. Its only advantage — the conversation is visible in a headed run — does not change what the model does |
| The script as the agent (Vercel AI SDK called from the script) | Duplicates `chat-server.ts` (system prompt, step limit, provider wiring) and would test something other than the chat; the request asks for the `npm start` path |
| The user's default browser (as `npm start` opens it), the page posts the snapshot back | Needs a new page hook and an endpoint to receive the snapshot; the browser restores the planner state from IndexedDB, so runs do not start from the same plan; the script cannot control or close the tab |
| Playwright imported by absolute path from the roomle-ui checkout (as in the RML-18004 check) | Works on one machine only and ties this repository to a sibling checkout |
| Readiness from a log line (page console "connected to the MCP server", server "page connected") | Depends on log wording and does not show that the HI library is loaded; the `get-plan-context` call checks exactly what the model needs |
| Compose the example URL in the script | A second copy of `EXAMPLE_URL` that drifts when the launcher changes |
| Move all three ports (`EXAMPLE_PORT` too) to run next to an interactive session | The page origin is what the HI test proxy and the Roomle embedding see; other origins than `localhost:3000` are not verified. A busy port 3000 or 3200 fails loudly with the launcher's message, a stale tab on the MCP port does not — only the MCP port needs moving |

## Open questions (for the review of this analysis)

1. **Result content.** (a) `snapshot.json` and `run.json` only, or (b) additionally every snapshot
   field as a file in its own format: `top-image.png`, `perspective-image.png`,
   `top-object-image.png`, `perspective-object-image.png`, `object.glb`, `plan.xml`,
   `order-data.json`. **Recommendation: (b)** — the images can be looked at directly (an agent reads
   the PNG), the GLB opens in a viewer, and `snapshot.json` stays the unchanged source. Cost: the
   assets are on disk twice (the GLB is several MB).
2. **Directory name.** `<YYYY-MM-DDTHH-MM-SS>-<provider>` (recommended; the prompt is in `run.json`)
   or with a slug of the prompt appended.
3. **MCP port.** Run the script's MCP server on its own port (recommended: 3110 via `HI_MCP_PORT`,
   which the launcher forwards to the page and the chat backend) to keep example tabs of an
   interactive session out of the run — or stay on 3100 and require that no example tab is open.
4. **Options beyond the request.** `--dev` and `--headed` (recommended, one line each). Not planned:
   a plan id, several prompts in one conversation, configurable timeouts.
5. **Names.** Script `run-hi-mcp-prompt.js`, skill `hi-mcp-testing.md`. An npm script for it is not
   planned.

## Code and documents the work would touch

| File | Change |
|---|---|
| `.agents/scripts/run-hi-mcp-prompt.js` | new — the script |
| `.agents/scripts/package.json` | `playwright` 1.55.0 |
| `.agents/skills/hi-mcp-testing.md` | new — the skill, first version |
| `AGENTS.md`, `.agents/README.md`, `.github/copilot-instructions.md` | register the skill; `.agents/README.md` also lists this analysis |
| `.agents/feature-analysis/README.md` | list this analysis |
| `docs/testing-prompts.md` | the testing guidelines point to the skill |
| `minimal-hi-example/index.html`, `start.mjs`, `hi-mcp/*` | unchanged |

## Verification

No unit tests: `.agents/scripts` has no test setup, and the script's behaviour is the orchestration
of real processes. Verified by running it:

| Check | Expected |
|---|---|
| A prompt from `docs/testing-prompts.md` ("add a group of three tall units to the wall on the right") with a real key | exit 0; the result directory holds `snapshot.json` with the new group in `orderData`, `run.json` with the tool names; the top image shows the group on the right wall |
| An unknown provider | the launcher's message, exit 1, no result directory |
| An invalid API key | `[error]` in `run.json`, exit 1, the snapshot of the unchanged plan is stored |
| Ctrl+C during a run | browser closed, ports 3000, 3110 and 3200 free |
| An example tab open in the user's browser during a run (with open question 3 as recommended) | the run is not affected |
| After every run | no process left on the ports 3000, 3110, 3200 |

## Implementation plan

Written ahead so the review can cover it; it assumes the recommendations above.

1. Add `playwright` 1.55.0 to `.agents/scripts/package.json`, `npm install` there
   → verify: `node -e "import('playwright')"` in `.agents/scripts` resolves, Chromium 1187 found
   without a download.
2. Write `run-hi-mcp-prompt.js` along the flow above
   → verify: the checks in [Verification](#verification), one run each.
3. Write `.agents/skills/hi-mcp-testing.md` and register it; point `docs/testing-prompts.md` to it
   → verify: every link resolves.
4. Close out this analysis with the results → commit on `feat/hi-mcp-testing-skill`; push and pull
   request wait for the review.

## Close-out report (2026-09-30)

### What was built

- `.agents/scripts/run-hi-mcp-prompt.js` — the script along the proposed flow, with the
  recommendations of all five open questions.
- `.agents/scripts/package.json` — `playwright` 1.55.0; the cached Chromium 1187 is used without a
  download.
- `.agents/skills/hi-mcp-testing.md` — the skill, first version, registered in `AGENTS.md`,
  `.agents/README.md` and `.github/copilot-instructions.md`; `docs/testing-prompts.md` points to it.
- `minimal-hi-example/index.html`, `start.mjs` and `hi-mcp/*` are unchanged.

### Decisions taken during the implementation

| Decision | Why |
|---|---|
| One abort race around the whole session (launcher ready → page ready → chat → snapshot) against a promise that rejects on the launcher's exit or on SIGINT/SIGTERM; the result is stored only when the session wins | A race per wait let a stopped run continue: stopping the servers failed the chat request, the session went on to the snapshot, stored a partial result and overwrote the exit code |
| Playwright's `handleSIGINT`/`handleSIGTERM` off | Playwright's own handlers call `process.exit(130)` after closing the browser — before the script stopped the servers; the MCP server was left running on its port |
| `process.exit()` once the servers are stopped | An aborted session keeps its timers and polls; the unknown-provider run otherwise took the full 3-minute launcher timeout to end |
| The browser starts before the launcher | The session and the cleanup both need it; the signal handlers are in place from the launcher's start on |
| The example URL is taken only from a complete `Example:` line | A stdout chunk can end inside the URL |
| Readiness through a single JSON-RPC `tools/call` without `initialize` | Works against the stateless server as expected; no MCP SDK needed in `.agents/scripts` |

### Verification

| Check | Result |
|---|---|
| Usage error (prompt missing) | usage printed, exit 1 |
| Unknown provider | the launcher's message, `the launcher exited with code 1`, exit 1 after 0.2 s, no result directory |
| "add a group of three tall units to the wall on the right", Mistral Large | exit 0; ready 9.7 s, chat 99 s, snapshot 17 s; tools `get-plan-context`, `get-authoring-rules`, `create-or-replace-groups`; all nine files written (`snapshot.json` 21 MB, `object.glb` 13 MB, PNGs 1024 px) |
| Invalid API key | `errors: ["Unauthorized"]`, exit 1, snapshot of the empty plan stored without the object images and the GLB |
| SIGINT during the chat | exit 130, `stopped by SIGINT`, no result directory, ports 3000/3110/3200 free, no process left |
| SIGTERM during the chat | exit 143, same cleanup |
| "plan a kitchen in the back right corner of the room", Mistral Large (after the restructure) | exit 1 with the model's error (see finding 2), result stored |
| `--headed`, `--dev`, an example tab open during a run | not run: `--headed` opens a window on the desktop, `--dev` needs the roomle-ui dev server, the tab isolation holds by construction (nothing listens on 3100 during a run) |

Testing the signals from a second shell needs the real Node binary: with Volta, `node` is a shim
that does not pass `kill -INT <pid>` on to the script (a Ctrl+C in the terminal reaches both).

### Findings for the next steps

Not bugs of the script — results of the first runs, for the HI MCP and the chat:

1. **Groups placed outside the room.** Both groups Mistral Large created stand on the far side of
   the right wall: the three tall units beyond the wall's front end
   (`.temp/result/2026-09-30T12-42-58-mistral`), the L-shaped corner kitchen behind the wall at
   the back (`.temp/result/2026-09-30T12-53-16-mistral`).
2. **`get-plan-images` overflows the model's context.** After creating the corner kitchen the model
   called `get-plan-images`; the next model call failed with
   `Prompt 2125087 > 262144 maximum context length` — the base64 images of the tool result reach
   the model as text.

The result directories are local (`.temp` is ignored by git).
