# Using Local Ollama Models with VS Code and the HI MCP Server

> **Guide Type:** Setup Documentation  
> **Purpose:** Connect local Ollama models with GitHub Copilot Chat in VS Code and the HI MCP server (`hi-orchestrator`)  
> **Use When:** Setting up a local AI development environment for HI room planning

---

## Overview

This guide explains how to connect your **local Ollama models**, **GitHub Copilot Chat in VS Code**, and your **HI MCP server** (`hi-orchestrator`) to enable local AI inference with access to HI room planning tools.

This setup allows you to:
- Run local models (e.g., `qwen2.5-coder:32b`, `phi4-tools`) on your machine
- Use GitHub Copilot Chat as the interface
- Access HI-specific MCP tools through the `hi-orchestrator` server
- Keep model inference local — only the inference runs on your machine. MCP tool arguments
  and the returned plan/order context are sent to the configured MCP server (the
  Cloudflare-hosted endpoint by default). Use the [local MCP server](#alternative-local-mcp-server)
  if your plan data must remain local.

---

## Step-by-Step Guide

### Step 1: Ensure Ollama is Running

1. Open your macOS Terminal and verify that Ollama is running with your preferred tool-calling model (e.g., `qwen2.5-coder:32b` or `phi4-tools`):

```bash
ollama list
```

2. If Ollama is not running, start it:

```bash
ollama serve
```

3. Pull your desired model if not already available:

```bash
ollama pull qwen2.5-coder:32b
# or
ollama pull phi4-tools
```

---

### Step 2: Install Required VS Code Extensions

1. Open **VS Code**
2. Press `Cmd + Shift + X` to open the **Extensions Marketplace**
3. Install the following extensions:
   - **GitHub Copilot** (and **GitHub Copilot Chat**)
   - **Ollama** (Official VS Code extension)

---

### Step 3: Configure Your HI MCP Server in VS Code

VS Code Copilot manages MCP connections natively using its user configuration.

1. Press `Cmd + Shift + P` to open the Command Palette
2. Type **`MCP: Open User Configuration`** and press **Enter**
3. Add your `hi-orchestrator` server endpoint inside the JSON file:

```json
{
  "servers": {
    "hi-orchestrator": {
      "type": "http",
      "url": "https://hi-mcp-poc.hi-orchestrator.workers.dev/mcp"
    }
  }
}
```

**Note:** `~/.copilot/mcp-config.json` (with `"mcpServers"` as the top-level key) is the
configuration file of the GitHub Copilot **CLI** — VS Code does not read it. In VS Code, use
the `servers` configuration above.

**Note:** If you're running a local HI MCP server (e.g. `npm start` in `minimal-hi-example`), use:
```json
{
  "servers": {
    "hi-orchestrator": {
      "type": "http",
      "url": "http://localhost:3100/mcp"
    }
  }
}
```

---

### Step 4: Select Local Ollama as Model Provider in Copilot

1. Open the **GitHub Copilot Chat** panel in VS Code (`Cmd + Shift + I` or click the Copilot icon in the left sidebar)
2. Click the **Model Picker** dropdown located in the chat input field (where it defaults to `GPT-4o` or `Claude 3.5`)
3. Select **Manage Language Models** or pick **Ollama**
4. Choose your local model (such as `qwen2.5-coder:32b` or `phi4-tools`)

---

### Step 5: Run Your Prompt

1. In the Copilot Chat panel, switch the mode to **Agent Mode** (or ensure the **`⚡` Tools** button is enabled)
2. Verify that **`hi-orchestrator`** is listed under attached tools
3. Open the HI page the tools operate on and keep it open — the server is only a relay, every tool call executes in the connected browser page:
   - Cloud server: open the Roomle store with the `mcp_server` parameter, e.g. `https://www.roomle.com/t/ligna-store-test/?store.stage=INT&mcp_server=https://hi-mcp-poc.hi-orchestrator.workers.dev` (see [Connecting an agent to the cloud MCP server](connect-agent-to-cloud-mcp.md))
   - Local server: open `http://localhost:3100/?mcp=true` (the server opens this page automatically on startup)
4. Enter your kitchen planning prompt—VS Code Copilot will route the inference directly to your local Ollama model while calling HI-specific functions on your MCP server!

---

## Example Prompts

Once connected, you can use prompts like:

- "Create a kitchen plan with a U-shaped layout and place the Furniture_Smith cabinet group against wall A"
- "Show me the available Furniture_Smith materials and their colors"
- "Generate a plan with a specific article and color configuration"
- "Get the current plan context and list all available groups"

---

## Troubleshooting

### Ollama Not Detected

If Ollama doesn't appear in the model picker:
1. Ensure Ollama is running: `ollama serve`
2. Verify the Ollama VS Code extension is installed
3. Restart VS Code
4. Check that your model is pulled: `ollama list`

### MCP Server Not Connected

If `hi-orchestrator` doesn't appear under attached tools:
1. Verify the server URL is correct in your MCP configuration
2. Ensure the server is running — for local servers, watch the startup log in the terminal running the launcher or the server, or probe with `curl -i -X POST http://localhost:3100/mcp` (the `/mcp` endpoint accepts POST only and answers a plain GET with 404)
3. Restart VS Code
4. Check the Copilot Chat output for connection errors

### Tool Calls Failing

If tool calls to the HI MCP server fail:
1. Verify the server is accessible from your network
2. Check that the HI page is open in your browser — tool calls execute in the connected page: the local server via the WebSocket bridge (the example page at `http://localhost:3000/?mcp=true`, or the store with `store.stage=INT`), the cloud server via the store page opened with the `mcp_server` parameter
3. Ensure you have the correct permissions and session state

---

## Alternative: Local MCP Server

Instead of using the Cloudflare-hosted `hi-orchestrator`, you can run the MCP server locally:

```bash
# Start the local HI MCP server (example page + server)
npm start          # from the repository root
```

Then configure VS Code to use the local endpoint:

```json
{
  "servers": {
    "hi-orchestrator": {
      "type": "http",
      "url": "http://localhost:3100/mcp"
    }
  }
}
```

**Benefits of local server:**
- No network latency to Cloudflare
- Full control over server logs and debugging
- No dependency on external hosting

---

## Related Documentation

- [HI MCP Server Documentation](../../minimal-hi-example/docs/hi-mcp-server.md) - Complete server reference
- [HI MCP Tools Reference](../../.agents/skills/hi-mcp-tools.md) - Available tool definitions
- [Roomle HI Concepts](../../.agents/skills/roomle-hi-concepts.md) - Core HI data model
- [Cloudflare MCP Server Setup](cloudflare-mcp-server.md) - Cloudflare deployment guide
