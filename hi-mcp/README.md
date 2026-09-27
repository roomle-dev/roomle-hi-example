# hi-mcp — MCP Server Proof of Concepts

Node.js TypeScript project hosting MCP server proof of concepts (PoCs) for orchestrating
HOMAG Intelligence (HI) object groups in live Roomle planning sessions. One self-contained
npm workspace folder per PoC.

| PoC | Description |
| --- | ----------- |
| [hi-mcp-poc-json](./hi-mcp-poc-json/) | HI object groups (kitchens) generated from a single JSON pos-group payload; client is the INT-stage ligna-store |
| [cf](./cf/) | Cloudflare deployment of the hi-mcp-poc-json server: Worker + Container, one `wrangler deploy` |

## Quick Access

The HI MCP server is deployed at Cloudflare:
- **Store Page**: https://www.roomle.com/t/ligna-store-test/?store.stage=INT&mcp_server=https://hi-mcp-poc.hi-orchestrator.workers.dev
- **MCP Server Endpoint**: https://hi-mcp-poc.hi-orchestrator.workers.dev/mcp
- **Cloudflare Dashboard**: https://dash.cloudflare.com/be70a3966e4c4ccfa9349004b9ccf948/

Documentation:

- [docs/local-mcp-server.md](./docs/local-mcp-server.md) — install the local MCP server and connect every MCP client to it, including Mistral Le Chat via a localhost.run tunnel
- [docs/azure-mcp-server.md](./docs/azure-mcp-server.md) — deploy the MCP server to Azure App Service: access rights, the full setup runbook, verification, troubleshooting, teardown
- [docs/cloudflare-mcp-server.md](./docs/cloudflare-mcp-server.md) — deploy the MCP server to Cloudflare Containers: the colleague handout links, verification, teardown
- [docs/connect-agent-to-cloud-mcp.md](./docs/connect-agent-to-cloud-mcp.md) — connect any agent to the cloud MCP server, with the Mistral Le Chat worked example

Source of the first PoC: roomle-ui `packages/embedding-lib/examples/hi-mcp-server` (RML-17693),
adapted to the ligna-store client. See the
[feature analysis](../.agents/feature-analysis/hi-mcp-poc-json.md) for the full context.

## Commands

```bash
npm install                     # once, installs all workspaces
npm start                       # run the hi-mcp-poc-json MCP server on :3100
npm test                        # unit tests (vitest) across all PoCs
npm run typecheck               # tsc --noEmit
```

Each PoC keeps its own dependencies in its `package.json`, hoisted into this root — the
repository root of roomle-hi-example stays dependency-free.
