# Quickstart — HI Group Orchestrator MCP Server (hi-mcp-poc-json)

Shortest path to a working session. Every detail and alternative: [README.md](./README.md).

**1. Once:** `npm install` in the `hi-mcp/` folder (Node 20), and the
[ligna-store](https://github.com/roomle/ligna-store) repository checked out (the client page, with
its `hi-mcp/` browser bridge).

**2. Start the MCP server** (:3100):

```bash
cd hi-mcp
npm start
```

**3. Start the store** (:3000):

```bash
npm run dev        # in the ligna-store repository
```

**4. Open the store page with the INT stage and a plan id**, keep the tab open — the bridge
starts automatically with the INT stage:

```text
http://localhost:3000/?store.stage=INT&id=ps_bse5tc50687uh64hm8jul7j1kiuacyx
```

The server terminal logs `page connected`.

**5. Connect your client** (once) to `http://localhost:3100/mcp`:

| Client                   | How                                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Claude Code CLI          | `claude mcp add --transport http --scope user hi-orchestrator http://localhost:3100/mcp` |
| Claude desktop app       | Register the server in `claude_desktop_config.json` — see [README](./README.md#claude-desktop-app) |
| GitHub Copilot (VS Code) | Command Palette → _MCP: Open User Configuration_ → add the server ([README](./README.md#github-copilot-vs-code-agent-mode)), then Copilot Chat in **Agent** mode |

Copilot in the browser (github.com) cannot reach a localhost server. Other clients (Cursor, …):
[README.md](./README.md#connecting-an-mcp-client).

**6. Ask the agent:**

```text
Get the plan context of the HI session and summarize it.
```

The agent calls `get-plan-context` and summarizes the articles, rooms, and groups.
Then try a write operation:

```text
Add a group of three tall units to the wall on the right.
```

The agent authors article picks with a docking chain and a `repositioningData`
taken from the right wall — one `create-or-replace-groups` call creates, docks,
and positions the group.

The unit tests live in `tests/` (server and tool logic) and `../hi-mcp-poc-json-client/tests/` (page bridge) —
`npm test` in the `hi-mcp/` folder runs them (vitest).

More: [example prompts](./README.md#example-prompts) ·
[troubleshooting](./README.md#troubleshooting)
