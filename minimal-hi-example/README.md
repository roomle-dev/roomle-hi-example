# Quickstart — HI Presets Example & MCP Server

Shortest path to a working session: the standalone HI presets example in one
[`index.html`](./index.html), plus a zero-dependency MCP server
([`hi-mcp-server.js`](./hi-mcp-server.js)) so an AI agent can orchestrate HI
object groups in the live plan. Every detail and alternative:
[docs/hi-mcp-server.md](./docs/hi-mcp-server.md).

**1. Once:** install Node 18+. Nothing else — no `npm install`, no build.

**2. Start everything** (one process — serves the example and hosts the MCP
server on :3100):

```bash
npm start          # or directly: node hi-mcp-server.js
```

**3. The example opens** at <http://localhost:3100/?mcp=true> (pass
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

More: [example prompts](./docs/hi-mcp-server.md#example-prompts) ·
[configuring the example](./docs/hi-mcp-server.md#the-example) ·
[tool reference](./docs/hi-mcp-server.md#tool-reference) ·
[troubleshooting](./docs/hi-mcp-server.md#troubleshooting) ·
[PoC presentation with demo results](./docs/hi-mcp-poc-presentation.md)
