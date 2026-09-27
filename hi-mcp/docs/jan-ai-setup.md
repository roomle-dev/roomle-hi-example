# Jan AI Setup with Ollama and MCP Server

This guide describes how to set up **Jan AI**, your **local Ollama models**, and your **Cloudflare MCP server** (`hi-orchestrator`).

> **Note:** The Cloudflare MCP server uses a shared default session. For multi-user scenarios, each user should append a unique `?session=<name>` parameter to the MCP server URL and `&mcp_session=<name>` to the store page URL to avoid interference. Without these parameters, all users share the same container and the newest connected tab wins.

## Prerequisites

- Jan AI installed (macOS)
- Ollama running locally with downloaded models
- Cloudflare MCP server deployed and accessible

## Step 1: Install Jan AI

1. Download the macOS installer directly from [jan.ai](https://jan.ai/?utm_source=gemini).
2. Open the downloaded `.dmg` file and move **Jan** into your `Applications` folder.

## Step 2: Connect Your Local Ollama Models

Because Ollama exposes an OpenAI-compatible API locally, you can attach your existing downloaded models (`qwen3.8:27b-mlx`, `gemma4:31b`, `deepseek-r1:70b`, etc.) directly without re-downloading anything:

1. Open **Jan** and click **Settings** (⚙) in the bottom-left corner.
2. In the left sidebar, scroll down to **MODEL PROVIDERS**.
3. Click on **Ollama** (or click the **`+`** icon next to **MODEL PROVIDERS** if you need to add a custom OpenAI-compatible provider).
4. Set the **Base URL** to:
   ```text
   http://localhost:11434/v1
   ```
5. Set the **API Key** to `sk-placeholder` or `ollama` (Ollama runs locally and does not require a real key).
6. Click **`+ Add Model`** and type the exact name of your downloaded Ollama models (for example, `gemma4:31b` or `deepseek-r1:70b`).

## Step 3: Open the Store Page

The MCP server is only a relay — tool calls execute in an open Roomle ligna-store tab. Before connecting Jan, open the store page in your browser and keep the tab open:

1. Open this URL in your browser:
   ```text
   https://www.roomle.com/t/ligna-store-test/?store.stage=INT&mcp_server=https://hi-mcp-poc.hi-orchestrator.workers.dev
   ```
2. Start planning or open an existing plan in the store.
3. Keep this tab open — it is the session the agent works in.

## Step 4: Add Your Cloudflare MCP Server (`hi-orchestrator`)

1. In Jan's **Settings** panel, look under **INTEGRATIONS** in the left sidebar and click **MCP Servers**.
2. Click the **`+ Add MCP Server`** button located in the **top-right corner** of the window.
3. Enter your Cloudflare server details:
   - **Name:** `hi-orchestrator`
   - **Transport:** `HTTP`
   - **URL:** `https://hi-mcp-poc.hi-orchestrator.workers.dev/mcp`
4. Click **Save** and verify the server toggle switch is set to **Active**.

> **Why not SSE?** The Cloudflare deployment exposes Streamable HTTP on `/mcp` and does not provide an SSE transport. Selecting `SSE` will fail to connect.

## Step 5: Start Chatting

1. Click **New Chat** (⌘N) in the top-left corner.
2. Select your local Ollama model from the model selector at the top.
3. Start prompting—your local model will now execute tools and queries via your Cloudflare-hosted MCP server, with results appearing live in your open store tab!

## Related Resources

- MCP Server Endpoint: https://hi-mcp-poc.hi-orchestrator.workers.dev/mcp
- Store Page: https://www.roomle.com/t/ligna-store-test/?store.stage=INT&mcp_server=https://hi-mcp-poc.hi-orchestrator.workers.dev
- See also: [QUICKSTART.md](../hi-mcp-poc-json/QUICKSTART.md) for additional setup details
