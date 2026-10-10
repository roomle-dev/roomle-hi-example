# Quickstart — HI MCP Server

## Cloud Deployment (Recommended)

The HI MCP server is deployed at Cloudflare. No local setup required.

### URLs

- **Store Page**: `https://www.roomle.com/t/ligna-store-test/?store.stage=INT&mcp_server=https://hi-mcp-poc.hi-orchestrator.workers.dev&mcp_session=<name>`
- **MCP Server Endpoint**: `https://hi-mcp-poc.hi-orchestrator.workers.dev/mcp?session=<name>`
- **Cloudflare Dashboard**: https://dash.cloudflare.com/be70a3966e4c4ccfa9349004b9ccf948/

### Connect

1. Open the store page in your browser and start planning; its bridge needs no chat model or API key.
2. Connect your MCP client using the same session name as the store page. To use the optional store
   chat, also add `model` (`gpt-5-mini`, `gpt-5.4-mini`, `gpt-6-astra`, `mistral-large-latest` or
   `mistral-medium-latest`) and its `api_key` to the page URL.
3. Start planning with HI object groups

## Local Development

For local development, see [hi-mcp-server/README.md](./hi-mcp-server/README.md) for detailed setup instructions.
