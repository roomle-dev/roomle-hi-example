# Local MCP Server — Installation and Client Setup

This documents the **local** MCP server of the `hi-mcp` workspace (`hi-mcp-server`): running on
your machine, with the MCP endpoint at `http://localhost:3100/mcp` — in contrast to the cloud
variants ([Cloudflare](./cloudflare-mcp-server.md), [Azure App Service](./azure-mcp-server.md)).
The server runs the tools of any connected AI agent and relays their planner calls into a connected
ligna-store page (local or deployed), where they execute against the planner.

> Note: [`minimal-hi-example/docs/hi-mcp-server.md`](../../minimal-hi-example/docs/hi-mcp-server.md) documents the standalone HI presets
> example, which uses this same server (started by `minimal-hi-example/start.mjs`) as its client.
> Tool reference and authoring rules live in the
> [PoC README](../../hi-mcp/hi-mcp-server/README.md).

## Prerequisites

- Node 20
- The [ligna-store](https://github.com/roomle/ligna-store) as the client page — locally
  (`npm run dev`) or the deployed test stage (the deployment must contain the `hi-mcp/` bridge and
  the hook in `Planner.vue`)

## Installing and starting the server

```bash
cd hi-mcp
npm install     # once: installs the workspace and all PoCs
npm start       # MCP server on http://localhost:3100/mcp
```

The server prints `➜  Local: http://localhost:3100/mcp` when it is ready, and it reports an
occupied port with the command to free it instead of a bare stack trace.

### Connecting the page (ligna-store)

| Client page | URL |
| ----------- | --- |
| local store | `http://localhost:3000/?store.stage=INT&id=<plan id>&model=<model>&api_key=<key>&mcp_server=http://localhost:3100` (`npm run dev` in the ligna-store) |
| deployed store | `https://www.roomle.com/t/ligna-store-test/?store.stage=INT&id=<plan id>&model=<model>&api_key=<key>&mcp_server=http://localhost:3100` |

The store starts its bridge only together with its chat window, so it needs `model`, `api_key` and
`mcp_server`. The page connects outward to the server at `ws://localhost:3100/bridge` — loopback
connections are not mixed content, so this works from the local http page and the deployed https
page alike; for a browser that refuses it, start the server with the optional
`HI_MCP_TLS_CERT`/`HI_MCP_TLS_KEY` and use `mcp_server=https://localhost:3100`. The deployed store
may also need the browser's permission for the local network. The server terminal logs
`page connected`. The server holds **one page at a time** — the first connected tab keeps the
planner, and a second page is refused (WebSocket close 4409) until the first one leaves.
Which setup needs which URL parameters — local server, deployed store, cloud server, parallel
sessions — is covered by the **setup matrix** in the
[PoC README](../../hi-mcp/hi-mcp-server/README.md#the-setup-matrix-which-setup-needs-which-url-parameters).

### Configuration (environment variables, all optional)

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `HI_MCP_PORT` / `PORT` | `3100` | listen port |
| `HOST` | all interfaces | bind address |
| `HI_MCP_PAGE_ORIGINS` | `http://localhost:3000`, `http://127.0.0.1:3000`, `https://www.roomle.com` | comma-separated allowed page origins: the only origins that may open the `/bridge` WebSocket and call `/mcp` from a browser (CORS, e.g. the ligna-store chat window) |
| `HI_MCP_TLS_CERT` + `HI_MCP_TLS_KEY` | plain HTTP | optional TLS for the wss fallback |

## Connecting an MCP client

Prefer the **user scope**: the server is installed once and available in every folder, so the
agent session does not have to run in this repository.

### Claude Code

Via CLI (user scope):

```bash
claude mcp add --transport http --scope user hi-orchestrator http://localhost:3100/mcp
```

Without the CLI on the PATH (e.g. VS Code extension only): merge the `mcpServers` entry into the
**top level** of the existing `~/.claude.json` — do not replace the file, it holds other state:

```json
{ "mcpServers": { "hi-orchestrator": { "type": "http", "url": "http://localhost:3100/mcp" } } }
```

Project-scoped alternative: the same object in a `.mcp.json` file in the folder the session runs
in.

### Claude desktop app

A pure chat client — nothing of the code is visible, which makes it a good fit for audience
demos.

Register the server in the desktop config file via the
[`mcp-remote`](https://www.npmjs.com/package/mcp-remote) bridge (the app's Connectors settings
offer no way to add a custom localhost server):

| OS | Config file |
| -- | ----------- |
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

```json
{
  "mcpServers": {
    "hi-orchestrator": {
      "command": "/absolute/path/to/npx",
      "args": ["mcp-remote", "http://localhost:3100/mcp"]
    }
  }
}
```

Use the **absolute** path to `npx` (find it with `which npx` on macOS/Linux, `where npx` on
Windows) — GUI apps do not see your shell PATH, so a bare `npx` fails silently. If the file
already exists, merge the `mcpServers` entry into it. Fully quit and reopen the app afterwards;
the tools appear behind the tools icon of the chat input.

### GitHub Copilot (VS Code agent mode)

User scope (works in every folder): Command Palette → _MCP: Open User Configuration_ and add the
server to the `mcp.json` that opens — note VS Code's own schema with the `servers` key:

```json
{ "servers": { "hi-orchestrator": { "type": "http", "url": "http://localhost:3100/mcp" } } }
```

Workspace-scoped alternative: the same JSON in a `.vscode/mcp.json` in the folder the session
runs in. Then open Copilot Chat, switch to **Agent** mode, and check the tools picker — the
`hi-orchestrator` tools appear there (a trust prompt is shown on first use).

### GitHub Copilot CLI

Register the server in `~/.copilot/mcp-config.json`
(`%USERPROFILE%\.copilot\mcp-config.json` on Windows) — the CLI uses the common `mcpServers`
schema, **not** VS Code's `servers` key:

```json
{ "mcpServers": { "hi-orchestrator": { "type": "http", "url": "http://localhost:3100/mcp" } } }
```

### Copilot on github.com

Copilot web chat, the cloud coding agent, and a repository-level `.github/mcp.json` all run on
GitHub's servers and cannot reach `http://localhost:3100` — like Mistral Le Chat below, they
need a public HTTPS tunnel URL.

### Other clients

Cursor and most other clients use the common `mcpServers` schema:

```json
{ "mcpServers": { "hi-orchestrator": { "url": "http://localhost:3100/mcp" } } }
```

Clients that only support the stdio transport can bridge via
[`mcp-remote`](https://www.npmjs.com/package/mcp-remote):

```json
{ "mcpServers": { "hi-orchestrator": { "command": "npx", "args": ["mcp-remote", "http://localhost:3100/mcp"] } } }
```

At initialize, the server delivers **instructions** to the agent: the workflow, the pos-group
authoring rules, and the docking semantics (see the
[PoC README](../../hi-mcp/hi-mcp-server/README.md)).

## Mistral (chat.mistral.ai)

Mistral's web app (Le Chat) natively supports custom MCP servers directly in the browser. But
`chat.mistral.ai` runs on Mistral's cloud servers — it cannot reach `http://localhost:3100` on
your machine, so you must give it a public HTTPS tunnel URL.

### Expose the local server with a tunnel

With the MCP server running on port 3100, open a second terminal and run:

```bash
ssh -R 80:localhost:3100 nokey@localhost.run
```

The command prints a public HTTPS URL (something like `https://<id>.lhr.life`). Keep the terminal
open for as long as you use the connector. The URL changes whenever you restart the tunnel —
update the connector's Server URL afterwards.

### Add the connector in Mistral

1. Open `chat.mistral.ai` — or go directly to `chat.mistral.ai/connections`, which skips the
   sidebar menus entirely.
2. Click **+ Add connector** (top right) and select the **Custom MCP Connector** tab.
3. Fill in:
   - **Connector Name:** `hi-orchestrator`
   - **Server URL:** `https://<tunnel-id>.lhr.life/mcp` — your active tunnel URL with `/mcp`
     appended
4. Click **Connect**.
5. Start a new chat, select the connector, and Mistral executes tool calls against your local
   server in the browser.

Note: Mistral labels the sidebar differently depending on the account (free, pro, or
organization) — "Context", "Intelligence", or "Connectors" — which is why manual sidebar
navigation can be inconsistent. The direct link `chat.mistral.ai/connections` always reaches
the configuration panel.

As with every client: the tunnel only exposes the `/mcp` endpoint. Tool execution still happens
in the ligna-store page connected to your server (see
[Connecting the page](#connecting-the-page-ligna-store)) — without a connected page, the tools
answer with "No HI page connected".

### Permanent alternative: cloud host

If you don't want to run the tunnel command every time, use the server deployed on Cloudflare
([cloudflare-mcp-server.md](./cloudflare-mcp-server.md); connecting an agent:
[connect-agent-to-cloud-mcp.md](./connect-agent-to-cloud-mcp.md)), or host it on Azure App Service
([azure-mcp-server.md](./azure-mcp-server.md)). With the server in the cloud, open the deployed store
with its chat parameters and the `mcp_server` parameter so the page connects to it:
`https://www.roomle.com/t/ligna-store-test/?store.stage=INT&id=<plan id>&model=<model>&api_key=<key>&mcp_server=https://<server>`
