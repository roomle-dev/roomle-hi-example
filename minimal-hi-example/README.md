# Quickstart — HI Presets Example & MCP Server

Shortest path to a working session: the standalone HI presets example in one
[`index.html`](./index.html), started together with the MCP server from
[`hi-mcp/hi-mcp-poc-json`](../hi-mcp/hi-mcp-poc-json/) — the single MCP server
implementation of this repository — by the [`start.mjs`](./start.mjs) launcher.
Every detail and alternative: [docs/hi-mcp-server.md](./docs/hi-mcp-server.md).

**1. Once:** install Node 20+. The first `npm start` installs the `hi-mcp`
workspace and typechecks the server (the build gate) before anything starts.

**2. Start everything** (the launcher serves the example page on :3000 and
starts the MCP server on :3100):

```bash
npm start          # or directly: node start.mjs
```

To develop against a local Rubens UI dev server (start it first on
<http://localhost:5173/>), run `npm run dev` instead — it opens the example
with `server_url=http://localhost:5173/` so the planner loads from the local
UI instead of `https://www.roomle.com/t/bo-test/`.

**3. The example opens** at <http://localhost:3000/?mcp=true> (pass
`--no-open` to skip that). Select a preset in the top bar, keep the tab
open — the server terminal logs `page connected`.

**4. Connect your client** (once) to `http://localhost:3100/mcp`:

| Client | How |
| ------ | --- |
| Claude Code | `claude mcp add --transport http --scope user hi-orchestrator http://localhost:3100/mcp` |
| Claude desktop app | Register the server in `claude_desktop_config.json` — see [docs](./docs/hi-mcp-server.md#claude-desktop-app) |
| GitHub Copilot (VS Code) | Command Palette → _MCP: Open User Configuration_ → add the server ([docs](./docs/hi-mcp-server.md#github-copilot-vs-code-agent-mode)), then Copilot Chat in **Agent** mode |

Copilot in the browser (github.com) cannot reach a localhost server. Other
clients (Copilot CLI, Cursor, …):
[docs/hi-mcp-server.md](./docs/hi-mcp-server.md#connecting-an-mcp-client).

**5. Ask the agent:**

```text
Get the plan context of the HI session and summarize it.
```

The agent calls `get-plan-context` and summarizes the articles, rooms, and
groups. Then try a write operation:

```text
Add a group of three tall units to the wall on the right.
```

The agent authors article picks with a docking chain and a `placement` — one
`create-or-replace-groups` call creates, docks, and positions the group.

**No external client needed:** start with a Mistral API key and the example
opens with a built-in AI chat that drives the same tools:

```bash
npm start mistral <api-key>            # or: npm run dev mistral <api-key>
npm start mistral-medium <api-key>     # mistral-medium-latest instead of mistral-large-latest
```

Details: [docs/ai-chat.md](./docs/ai-chat.md).

## Scripts and parameters

Both root scripts delegate to the [`start.mjs`](./start.mjs) launcher:

| Command | What it does |
| ------- | ------------ |
| `npm start` | Build gate (install + typecheck of the `hi-mcp` workspace), serve the example page on :3000, start the MCP server on :3100, open the browser |
| `npm run dev` | Same, but the planner loads from the local Rubens UI dev server (<http://localhost:5173/>) instead of `bo-test` |

**Positional arguments** (provider first, then the API key):

| Argument | Meaning |
| -------- | ------- |
| `mistral` / `mistral-medium` / `mistral-large` / any `mistral-*` model id | Starts the AI chat backend on :3200 with that model (`mistral-medium` → `mistral-medium-latest`, others → `mistral-large-latest`) and opens the page with the chat window visible |
| `<api-key>` | Mistral API key — required when a provider is given |

**Flags:**

| Flag | Meaning |
| ---- | ------- |
| `--no-open` | Do not open the browser automatically |
| `--dev` | Set by `npm run dev`; use `EXAMPLE_SERVER_URL` to override the URL it implies |

**Environment variables:**

| Variable | Default | Sets |
| -------- | ------- | ---- |
| `EXAMPLE_PORT` | `3000` | Port of the example page |
| `HI_MCP_PORT` | `3100` | Port of the MCP server (appends `mcp_port` to the page URL) |
| `HI_CHAT_PORT` | `3200` | Port of the chat backend (appends `chat_port` to the page URL) |
| `EXAMPLE_SERVER_URL` | — | Overrides the planner server URL of `--dev` |

```bash
npm start mistral-medium <api-key> --no-open
EXAMPLE_PORT=3101 HI_MCP_PORT=3110 npm run dev
```

Inside the [`hi-mcp`](../hi-mcp/) workspace the build gate uses
`npm run typecheck`; `npm test` runs the vitest suites.

Port 3000 taken (e.g. by the ligna-store dev server)? Start with
`EXAMPLE_PORT=3101 npm start`. More: [example prompts](./docs/hi-mcp-server.md#example-prompts) ·
[configuring the example](./docs/hi-mcp-server.md#the-example) ·
[tool reference](./docs/hi-mcp-server.md#tool-reference) ·
[troubleshooting](./docs/hi-mcp-server.md#troubleshooting) ·
[PoC presentation with demo results](./docs/hi-mcp-poc-presentation.md)
