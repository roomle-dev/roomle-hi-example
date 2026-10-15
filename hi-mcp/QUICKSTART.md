# Quickstart — HI MCP Server

## Cloud Deployment (Recommended)

The HI MCP server is deployed at Cloudflare, as PRD and DEV. No local setup required.

### URLs

- **Store Page**:
  - PRD: `https://www.roomle.com/t/ligna-store-test/?store.stage=INT&mcp_server=https://hi-planning-assistant.dashiell-bell.workers.dev&mcp_session=<name>`
  - DEV: `https://www.roomle.com/t/ligna-store-test/?store.stage=INT&mcp_server=https://hi-planning-assistant-dev.dashiell-bell.workers.dev&mcp_session=<name>`
- **MCP Server Endpoint**:
  - PRD: `https://hi-planning-assistant.dashiell-bell.workers.dev/mcp?session=<name>`
  - DEV: `https://hi-planning-assistant-dev.dashiell-bell.workers.dev/mcp?session=<name>`
- **Cloudflare Dashboard**: https://dash.cloudflare.com/0da066df4193493f75b3eb6f8fd23d85/ (account Roomle)

### Connect

1. Open the store page in your browser and start planning; its bridge needs no chat model or API key.
2. Connect your MCP client using the same session name as the store page. To use the optional store
   chat, also add `model` (any `gpt-*` model such as `gpt-6-astra`, `mistral-large-latest`,
   `mistral-medium-latest`, `mistral-large-4` or `mistral-large-3`) and its `api_key` to the page URL.
3. Start planning with HI object groups

## Local Development

For local development, see [hi-mcp-server/README.md](./hi-mcp-server/README.md) for detailed setup instructions.
