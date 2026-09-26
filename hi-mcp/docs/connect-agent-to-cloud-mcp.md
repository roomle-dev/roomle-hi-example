# Connecting an Agent to the Cloud MCP Server

How to connect any AI agent (Claude, Mistral Le Chat, Cursor, …) to the **cloud-hosted**
hi-mcp MCP server, so the agent works live in the kitchen the user is watching in their
browser — with **Mistral Le Chat as the worked example**. For the local and tunnel variants
see [local-mcp-server.md](./local-mcp-server.md); for deploying the server itself see
[cloudflare-mcp-server.md](./cloudflare-mcp-server.md).

## What you need

- The public URL of the deployed server: `https://<worker>.<subdomain>.workers.dev` (the
  `wrangler deploy` output prints it — never build it from the account ID, it does not resolve)
- Nothing installed: no repository access, no npm, no tunnel

## How it works

```text
your agent (e.g. Mistral) ──https──> https://<worker>.<subdomain>.workers.dev/mcp
                                           │ the server relays tool calls…
your browser (store tab open) ──wss──> …/bridge
                                           ▼
                          the kitchen changes live in your visible browser tab
```

The agent never touches the plan alone — every tool call executes in **your open store tab**.
Keep the tab open; it is the session the agent works in.

## Step by step (Mistral Le Chat)

### 1. Open the store page (first, and keep the tab open)

```text
https://www.roomle.com/t/ligna-store-test/?store.stage=INT&mcp_server=https://<worker>.<subdomain>.workers.dev
```

Open it and start planning — no plan id needed; append `&id=<plan id>` only to open a specific
existing plan. The page's bridge connects to the cloud server — in the server log
(`npx wrangler tail` in `hi-mcp/cf`) appears `page connected`. Without this tab, the tools
answer `No HI page connected` — and the agent tells the user to open exactly this URL.

### 2. Add the connector in Mistral

1. Open **[chat.mistral.ai](https://chat.mistral.ai)** — or go directly to
   `chat.mistral.ai/connections` (skips the sidebar menus; Mistral labels the sidebar
   "Context", "Intelligence" or "Connectors" depending on the account).
2. Click **+ Add connector** (top right) → select the **Custom MCP Connector** tab.
3. Fill in:
   - **Connector Name:** `hi-orchestrator`
   - **Server URL:** `https://<worker>.<subdomain>.workers.dev/mcp`
4. Click **Connect**.

If Mistral refuses to connect: the URL is wrong — take it from the `wrangler deploy` output
(the common mistake is the account ID instead of the account subdomain; see
[cloudflare-mcp-server.md](./cloudflare-mcp-server.md), "The public URL").

### 3. Talk to the agent

Start a new chat, select the connector, and try:

| Prompt | What happens |
| ------ | ------------ |
| "Get the plan context of the HI session and summarize it." | `get-plan-context` — rooms, articles, groups; confirms the chain end-to-end |
| "Describe the room and the groups currently in the plan." | `get-plan-context` (`rooms`, `groups`) |
| "Add a group of three tall units to the wall on the right." | the agent authors the pos group and calls `create-or-replace-groups` — the kitchen appears **live in your browser tab** |
| "Show me the plan." | `get-plan-images` — the agent sees the plan |

The first request after a pause takes ~10 s — the container boots on demand.

## Other agents

Every MCP client that supports a Streamable HTTP server URL works the same way; only the
registration UI differs:

| Client | Registration |
| ------ | ------------ |
| Claude Code | `claude mcp add --transport http hi-orchestrator https://<worker>.<subdomain>.workers.dev/mcp` |
| Claude Desktop | `mcp-remote` bridge with the same URL — see [local-mcp-server.md](./local-mcp-server.md#claude-desktop-app) |
| Cursor / generic `mcpServers` schema | `{ "hi-orchestrator": { "url": "https://<worker>.<subdomain>.workers.dev/mcp" } }` |
| VS Code Copilot (agent mode) | Command Palette → MCP: Open User Configuration → `{ "servers": { "hi-orchestrator": { "type": "http", "url": "https://<worker>.<subdomain>.workers.dev/mcp" } } }` |

In every case the store tab must be open with the `mcp_server` parameter — the agent works in
the page the user sees.

## Rules and limits of this PoC

- **One planning session at a time**: the server holds one connected page; a second tab
  replaces the first. (Per-session containers are the planned phase 2.)
- The store URL needs `store.stage=INT` and the `mcp_server` parameter; a plan `id` is optional
  (without it the user starts planning from the store).
- Everything the agent does happens in the visible tab — reload the tab if the connection was
  lost; the bridge reconnects on its own after container sleeps and restarts.

## Troubleshooting

| Symptom | Cause / fix |
| ------- | ----------- |
| Mistral refuses the Server URL | wrong URL — account ID instead of account subdomain; take it from the deploy output |
| Agent: `No HI page connected` | store tab not open or was closed — the agent names the URL to open (configured per deployment, `HI_MCP_STORE_URL`); open it, start planning, keep the tab open |
| First answer is slow | container boots on demand (~10 s) — just resend |
| Agent: `... is not a function` | the `bo-test` UI lacks the HI planner APIs — a web-sdk deployment issue, not the setup |
| Another colleague's session took over | one page at a time — the newest tab wins; open your own tab and reconnect |
