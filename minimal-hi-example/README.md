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

Port 3000 taken (e.g. by the ligna-store dev server)? Start with
`EXAMPLE_PORT=3101 npm start`. More: [example prompts](./docs/hi-mcp-server.md#example-prompts) ·
[configuring the example](./docs/hi-mcp-server.md#the-example) ·
[tool reference](./docs/hi-mcp-server.md#tool-reference) ·
[troubleshooting](./docs/hi-mcp-server.md#troubleshooting) ·
[PoC presentation with demo results](./docs/hi-mcp-poc-presentation.md)
