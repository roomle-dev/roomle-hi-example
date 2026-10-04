# Quickstart — HI Presets Example & MCP Server

Shortest path to a working session: the standalone HI presets example in one
[`index.html`](./index.html), started together with the MCP server from
[`hi-mcp/hi-mcp-server`](../hi-mcp/hi-mcp-server/) — the single MCP server
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

To use the MCP server deployed on Cloudflare instead of a local one, run
`npm run start:cf` (with the chat: `npm run start:cf mistral <api-key>`). No
local MCP server starts. The page connects to the deployment in a session
named after your OS user name, and the launcher prints the matching MCP URL
for external clients. It needs page port 3000, because that is the only local
origin the deployed server accepts.

**3. The example opens** at <http://localhost:3000/?mcp=true> (pass
`--no-open` to skip that). Select a preset in the top bar, keep the tab
open — the server terminal logs `page connected`.

**4. Ask the agent** — the repository root [README](../README.md) lists every
`npm start` variant (including the built-in AI chat with Mistral, Anthropic, or
Azure) and the agent prompts. External MCP clients (Claude Code, Copilot,
Cursor, …) connect to `http://localhost:3100/mcp`.

Port 3000 taken (e.g. by the ligna-store dev server)? Start with
`EXAMPLE_PORT=3101 npm start`. More: [example prompts](./docs/hi-mcp-server.md#example-prompts) ·
[configuring the example](./docs/hi-mcp-server.md#the-example) ·
[tool reference](./docs/hi-mcp-server.md#tool-reference) ·
[troubleshooting](./docs/hi-mcp-server.md#troubleshooting) ·
[PoC presentation with demo results](./docs/hi-mcp-poc-presentation.md)
