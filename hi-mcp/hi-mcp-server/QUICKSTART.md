# Quickstart — HI Group Orchestrator MCP Server (hi-mcp-server)

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

**4. Open the store page with the chat parameters, the INT stage and a plan id**, keep the tab
open — the store's bridge starts only together with its chat window (`model`, `api_key`,
`mcp_server`; the models: [README](./README.md#notes-on-the-client-page)):

```text
http://localhost:3000/?store.stage=INT&model=<model>&api_key=<key>&mcp_server=http://localhost:3100&id=ps_bse5tc50687uh64hm8jul7j1kiuacyx
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

The agent calls `get-plan-context` and summarizes the articles, rooms, groups and obstacles.
Then try a write operation:

```text
Add a group of three tall units to the wall on the right.
```

The agent authors article picks, each after the first `rightOf` its neighbour, and a
`placement` taken from the right wall — one `create-or-replace-groups` call creates, docks, and
positions the group. Then move it:

```text
Move the group to the back right corner.
```

The agent calls `place-group` with the right wall and the back wall's side
label as alignment; the server computes the position and reloads the group. `Undo that.`
reverts the move.

The unit tests live in `tests/` (server and tool logic) and `../hi-mcp-client/tests/` (page bridge) —
`npm test` in the `hi-mcp/` folder runs them (vitest).

More: [example prompts](./README.md#example-prompts) ·
[troubleshooting](./README.md#troubleshooting)
