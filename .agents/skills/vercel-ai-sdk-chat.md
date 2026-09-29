# Vercel AI SDK Chat Integration

> **Provenance**: Jira ticket [RML-17984](https://roomle.atlassian.net/browse/RML-17984) ("add chat in hi mcp example"), comment [155492](https://roomle.atlassian.net/browse/RML-17984?focusedCommentId=155492) by Gernot Steinegger, 2026-09-29. Content added verbatim (formatting adapted to markdown).

Load this skill when integrating an AI chat window with the HI MCP server using the Vercel AI SDK. The feature analysis for the concrete implementation in this repository is in [`../feature-analysis/add-ai-chat-to-hi-example.md`](../feature-analysis/add-ai-chat-to-hi-example.md); the living reference for the implemented chat is [`../../minimal-hi-example/docs/ai-chat.md`](../../minimal-hi-example/docs/ai-chat.md).

## Local wiring in roomle-hi-example

The comment's three-tier architecture is implemented as:

- **Browser**: the chat UI in `minimal-hi-example/index.html` — no React, so instead of `useChat` the page streams the backend's plain text response with a fetch body reader, rendering replies as sanitized markdown (marked + DOMPurify, imported dynamically only when the chat is enabled).
- **Backend API route**: the `hi-mcp/hi-mcp-chat` workspace package (`POST /chat`). Started by `minimal-hi-example/start.mjs` via `npm start <provider> <api-key>`; the API key goes from the CLI argument into the backend's environment (`HI_CHAT_TOKEN`), never into the page or URL.
- **MCP server**: the existing `hi-mcp/hi-mcp-poc-json` server, unchanged. The chat backend creates a per-request MCP client via `@ai-sdk/mcp` + `StreamableHTTPClientTransport`, fetches the tools, and passes them to `streamText`.

Providers wired in the local implementation: Mistral (`createMistral`), Anthropic (`createAnthropic`, CLI names `claude`/`anthropic`), and Azure OpenAI (`createAzure`, CLI names `azure`/`openai`, requires `AZURE_RESOURCE_NAME` and the deployment name in `HI_CHAT_MODEL` — the comment's keyless Azure Entra ID variant is not implemented; CLI names `gpt-5-mini`/`gpt-5.4-mini` are deployments on the HI Azure AI Foundry resource, reached via `createAzure({ baseURL: 'https://dfhifoundrysweden.services.ai.azure.com/openai/v1' })` without extra env vars). `streamText` needs `stopWhen: stepCountIs(n)` — with the default `stepCountIs(1)` tool calls are never executed and tool-driving prompts return an empty stream.

Deviations from the comment's example code, found during implementation:

- `StreamableHTTPClientTransport` takes a `URL` object (`new StreamableHTTPClientTransport(new URL(url))`), not an options object with `url`.
- The Vercel AI SDK packages require zod 4.6+; the workspace's `zod` pin was aligned so a single copy is deduped.
- The provider API key does **not** come from a URL parameter (as the ticket required) — it is passed as a CLI argument to the launcher and forwarded as an environment variable, keeping it out of the browser history and server logs.

## System Architecture Overview

The application uses a **three-tier architecture** to keep API keys secure while allowing the model to manipulate your 3D scene:

```
[Browser / Web App]
  └── Renders 3D Scene (Three.js/Babylon) & Chat UI
  └── Sends user messages to backend API
       │
[Server / API Route (Backend)] ───────────── Vercel AI SDK
  ├── Authenticates with Provider (Azure / Anthropic / Mistral)
  └── Connects to MCP Server (via @ai-sdk/mcp)
       │
       ├──❭ Fetch tools from MCP Server
       ├──❭ Send Prompt + Tools to LLM Provider
       └──❭ Receive tool execution call from LLM
       └──❭ Send execution command back to MCP Server / 3D Scene
```

## 1. Provider Integration (Vercel AI SDK)

To support Azure OpenAI, Anthropic, and Mistral within the same application, install the core SDK along with the respective provider packages:

```bash
npm install ai @ai-sdk/azure @ai-sdk/anthropic @ai-sdk/mistral
```

The Vercel AI SDK standardizes model calls across providers using the `streamText` function. Switching AI models requires changing only the model instance:

```ts
import { azure } from '@ai-sdk/azure';
import { anthropic } from '@ai-sdk/anthropic';
import { mistral } from '@ai-sdk/mistral';
import { streamText } from 'ai';

// Select target provider based on app configuration or request parameters
function getLanguageModel(provider: 'azure' | 'anthropic' | 'mistral') {
  switch (provider) {
    case 'azure':
      // Configured via deployment name
      return azure('gpt-4o-deployment');
    case 'anthropic':
      return anthropic('claude-3-5-sonnet-20241022');
    case 'mistral':
      return mistral('mistral-large-latest');
  }
}
```

## 2. API Key Authentication

All provider authentication must take place on the **server side** (Node.js API routes, Next.js Server Actions, Express endpoints) to prevent exposing keys to the browser.

### Automatic Environment Variable Detection

By default, the provider packages automatically read process-level environment variables from your `.env` file:

```bash
# Azure OpenAI Credentials
AZURE_API_KEY=your_azure_api_key
AZURE_RESOURCE_NAME=your_azure_resource_name

# Anthropic Credentials
ANTHROPIC_API_KEY=your_anthropic_api_key

# Mistral AI Credentials
MISTRAL_API_KEY=your_mistral_api_key
```

### Keyless Authentication (Azure Entra ID / Managed Identity)

For production Azure environments, static API keys can be avoided by using Microsoft Entra ID with `@azure/identity`:

```bash
npm install @azure/identity
```

```ts
import { createAzure } from '@ai-sdk/azure';
import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';

const credential = new DefaultAzureCredential();
const tokenProvider = getBearerTokenProvider(
  credential,
  'https://cognitiveservices.azure.com/.default'
);

const azureKeyless = createAzure({
  resourceName: 'your-azure-resource-name',
  tokenProvider,
});

const model = azureKeyless('gpt-4o-deployment');
```

## 3. Connecting the MCP Server

The Model Context Protocol (MCP) server exposes tools (e.g., `rotate_mesh`, `change_material`, `scale_object`) that the model uses to modify the 3D scene. The Vercel AI SDK provides native MCP client support via `@ai-sdk/mcp`.

### npm Packages

```bash
npm install @ai-sdk/mcp @modelcontextprotocol/sdk
```

### Complete API Route Implementation

Below is an end-to-end server endpoint combining provider selection, MCP tool retrieval, and streaming back to the client:

```ts
import { streamText } from 'ai';
import { azure } from '@ai-sdk/azure';
import { anthropic } from '@ai-sdk/anthropic';
import { mistral } from '@ai-sdk/mistral';
import { createMCPClient } from '@ai-sdk/mcp';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export async function POST(req: Request) {
  const { messages, provider = 'azure' } = await req.json();

  // Step 1: Connect to the 3D Scene MCP Server
  const mcpClient = await createMCPClient({
    transport: new StreamableHTTPClientTransport({
      url: process.env.MCP_SERVER_URL || 'http://localhost:3001/mcp',
    }),
  });

  // Step 2: Retrieve available 3D tools from MCP Server
  const tools = await mcpClient.tools();

  // Step 3: Select the AI Model
  const model =
    provider === 'anthropic'
      ? anthropic('claude-3-5-sonnet-20241022')
      : provider === 'mistral'
      ? mistral('mistral-large-latest')
      : azure('gpt-4o-deployment');

  // Step 4: Stream output and automatically handle 3D tool calls
  const result = streamText({
    model,
    messages,
    tools,
    onEnd: async () => {
      // Clean up MCP client connection when the stream completes
      await mcpClient.close();
    },
  });

  return result.toDataStreamResponse();
}
```

## Tool Execution Lifecycle for 3D Mutation

1. **Prompt Ingestion:** The user types `"Change the car color to red"` in the browser chat.
2. **Tool Discovery:** `@ai-sdk/mcp` queries the MCP server, converting 3D server endpoints into function definitions expected by Azure, Claude, or Mistral.
3. **Execution Routing:** The LLM inspects the request and issues a structured tool call (e.g., `set_color({ target: "car", color: "#FF0000" })`).
4. **Scene Update:** The backend MCP client executes the function, returning the result to the LLM or propagating scene mutations back to the web frontend (via WebSockets, SSE, or direct state streaming).
