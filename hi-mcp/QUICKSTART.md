# Quickstart — HI MCP Server

## Cloud Deployment (Recommended)

The HI MCP server is deployed at Cloudflare. No local setup required.

### URLs

- **Store Page**: `https://www.roomle.com/t/ligna-store-test/?store.stage=INT&model=<model>&api_key=<key>&mcp_server=https://hi-mcp-poc.hi-orchestrator.workers.dev`
- **MCP Server Endpoint**: https://hi-mcp-poc.hi-orchestrator.workers.dev/mcp
- **Cloudflare Dashboard**: https://dash.cloudflare.com/be70a3966e4c4ccfa9349004b9ccf948/

### Connect

1. Open the store page in your browser, with a chat model (`model`: `gpt-5-mini`, `gpt-5.4-mini`,
   `gpt-6-astra`, `mistral-large-latest` or `mistral-medium-latest`) and its key (`api_key`) — the
   store connects to the MCP server only together with its chat window
2. Plan in the chat window, or connect your own MCP client: add `&mcp_session=<name>` to the store
   page and connect the client to `https://hi-mcp-poc.hi-orchestrator.workers.dev/mcp?session=<name>`
3. Start planning with HI object groups

## Local Development

For local development, see [hi-mcp-server/README.md](./hi-mcp-server/README.md) for detailed setup instructions.
