# hi-mcp — MCP Server Proof of Concepts

Node.js TypeScript project hosting MCP server proof of concepts (PoCs) for orchestrating
HOMAG Intelligence (HI) object groups in live Roomle planning sessions. One self-contained
npm workspace folder per PoC.

| PoC | Description |
| --- | ----------- |
| [hi-mcp-server](./hi-mcp-server/) | HI object groups (kitchens) generated from a single JSON pos-group payload; its planner page is the ligna-store, its clients the store's chat window and external MCP clients |
| [hi-mcp-client](./hi-mcp-client/) | Page side of hi-mcp-server: the browser bridge that executes the allow-listed planner methods, with its unit tests; the ligna-store runs a copy in `hi-mcp/` |
| [cf](./cf/) | Cloudflare deployment of the hi-mcp-server: Worker + Container, one `wrangler deploy` |

## Quick Access

The HI MCP server is deployed at Cloudflare, as PRD and DEV:
- **Store Page** — the bridge starts without chat credentials; add `model` and `api_key` only to show the store's chat window:
  - PRD: `https://www.roomle.com/t/ligna-store-test/?store.stage=INT&mcp_server=https://hi-planning-assistant.dashiell-bell.workers.dev&mcp_session=<name>`
  - DEV: `https://www.roomle.com/t/ligna-store-test/?store.stage=INT&mcp_server=https://hi-planning-assistant-dev.dashiell-bell.workers.dev&mcp_session=<name>`
- **MCP Server Endpoint** — the same `<name>` as the store page's `mcp_session`:
  - PRD: `https://hi-planning-assistant.dashiell-bell.workers.dev/mcp?session=<name>`
  - DEV: `https://hi-planning-assistant-dev.dashiell-bell.workers.dev/mcp?session=<name>`
- **Cloudflare Dashboard**: https://dash.cloudflare.com/0da066df4193493f75b3eb6f8fd23d85/ (account Roomle)

Documentation:

- [docs/hi-mcp-behaviour.md](../docs/hi-mcp-behaviour.md) — how the MCP server behaves towards an agent: guidelines, decisions, tools, the information it provides, guards, corrections and feedback
- [docs/setup/local-mcp-server.md](../docs/setup/local-mcp-server.md) — install the local MCP server and connect every MCP client to it, including Mistral Le Chat via a localhost.run tunnel
- [docs/setup/azure-mcp-server.md](../docs/setup/azure-mcp-server.md) — deploy the MCP server to Azure App Service: access rights, the full setup runbook, verification, troubleshooting, teardown
- [docs/setup/cloudflare-mcp-server.md](../docs/setup/cloudflare-mcp-server.md) — deploy the MCP server to Cloudflare Containers: the colleague handout links, verification, teardown
- [docs/setup/connect-agent-to-cloud-mcp.md](../docs/setup/connect-agent-to-cloud-mcp.md) — connect any agent to the cloud MCP server, with the Mistral Le Chat worked example

Source of the first PoC: roomle-ui `packages/embedding-lib/examples/hi-mcp-server`
([RML-17693](https://roomle.atlassian.net/browse/RML-17693)), adapted to the ligna-store client.

## Commands

```bash
npm install                     # once, installs all workspaces
npm start                       # run the hi-mcp-server MCP server on :3100
npm test                        # unit tests (vitest) across all PoCs
npm run typecheck               # tsc --noEmit
```

Each PoC keeps its own dependencies in its `package.json`, hoisted into this root — the
repository root of roomle-hi-example carries only the formatter and the linter. The server runs
through `vite-node` 3.2.4 with `vite` 6.4.3: a newer `vite-node` needs `vite` 8 and Node 20.19 or
later.
