# Vercel AI SDK Chat Integration

> **Provenance**: Jira ticket [RML-17984](https://roomle.atlassian.net/browse/RML-17984) ("add chat in hi mcp example"), comment [155492](https://roomle.atlassian.net/browse/RML-17984?focusedCommentId=155492) by Gernot Steinegger, 2026-09-29. Content added verbatim (formatting adapted to markdown).

Load this skill when integrating an AI chat window with the HI MCP server using the Vercel AI SDK. The living reference for the implemented chat is [`../../docs/ai-chat.md`](../../docs/ai-chat.md); why the chat is an MCP client beside the server, not a route of it: [ADR 0003](../decisions/0003-the-ai-chat-is-an-mcp-client-beside-the-server.md).

## Local wiring in roomle-hi-example

The example's chat is the planning assistant of the roomle-ui embedding-lib, which runs the agent
loop in the page ([ADR 0010](../decisions/0010-the-example-chat-runs-in-the-page.md)); the comment's
three-tier architecture below is what [ADR 0003](../decisions/0003-the-ai-chat-is-an-mcp-client-beside-the-server.md)
implemented before:

- **Browser**: the chat window is the planner's AI Planning Assistant (roomle-ui `PlanningAssistantChat.vue`, `featureFlags.planningAssistant`), which renders the replies as sanitized markdown (marked + DOMPurify). The host is `minimal-hi-example/index.html` — no React and no `useChat`: `startPlanningAssistant(roomDesignerApi, config, signal)` of `@roomle/embedding-lib/hi` takes each message from the planner callback `onPlanningAssistantPrompt`, runs `streamText` with the HI MCP tools of the embedding-lib (`createHiMcpTools`) and passes the new text, the running tool and the end of the turn to the window with `planningAssistantOutput`.
- **No backend route**: the launcher `minimal-hi-example/start.mjs` turns `npm start <provider>:<model-id> <api-key>` and its options into the `PlanningAssistantConfig` of the embedding-lib (`{ provider, model, apiKey, baseUrl?, chatCompletions?, reasoningEffort?, referenceCacheBreakpoint?, readsImages }`) and serves it at `/planning-assistant-config.json` to this machine only; the page calls the provider with the key. Without a model, the page runs the chat on the model proxy of the HI server (`openai-compatible`), when the backend enables it.
- **No MCP server**: the tools call the planner of the page directly.

Providers wired in the embedding-lib (`loadChatModel`, roomle-ui `hi-planning-assistant.ts`, the AI SDK and the providers from esm.sh): Mistral (`createMistral`), Anthropic (`createAnthropic` with `anthropic-dangerous-direct-browser-access`), Google Gemini (`createGoogleGenerativeAI`, Gemini API key from Google AI Studio), OpenAI (`createOpenAI`, the Responses API), an OpenAI-compatible endpoint (`createOpenAICompatible` with the host's headers, Chat Completions) and Azure (`createAzure({ apiKey, baseURL })`). The launcher maps no names: the model is `<provider>:<model-id>`, the exact id at that provider — `azure:<deployment>` is a deployment on the HI Azure AI Foundry resource (`https://dfhifoundrysweden.services.ai.azure.com/openai/v1`) unless `--base-url` names another resource; the comment's keyless Azure Entra ID variant is not implemented. The Foundry GPT deployments use the Responses API (`azure(deployment)`) for images, function tools and reasoning together; GPT-6 Astra tool calls require Responses, even when the reasoning effort is omitted. Foundry `mistral-large-3` runs with `--chat-completions` (`chatCompletions: true`, `azure.chat(deployment)`), because its Responses endpoint rejects image input. `streamText` needs `stopWhen: stepCountIs(n)` — with the default `stepCountIs(1)` tool calls are never executed and tool-driving prompts return an empty stream; the planning assistant runs up to 16 steps and its last step with `toolChoice: 'none'` (`prepareStep`), so a turn that uses every step still ends with the model's answer instead of a tool result; the system prompt is the planner's (`getExternalObjectAgentPrompts().systemPrompt`, passed as `instructions`). Images the user attaches go to `streamText` as file parts with the image media type; a message with images and no text gets the planner's image prompt. `@ai-sdk/mistral` sends the image parts of a tool result as JSON text (base64 included), and the planning assistant has no middleware that moves them, so a Mistral model fails on a turn that calls `get-plan-images` ([backlog](../backlog/README.md#chat)).

Deviations from the comment's example code, found during implementation:

- `StreamableHTTPClientTransport` takes a `URL` object (`new StreamableHTTPClientTransport(new URL(url))`), not an options object with `url`.
- The Vercel AI SDK packages require zod 4.6+; esm.sh loads them with one zod (`?deps=zod@4.6.5`).
- The provider API key does **not** come from a URL parameter (as the ticket required) — it is passed as a CLI argument to the launcher, which serves it to the page on this machine only, keeping it out of the browser history and the printed URL.
- The ligna-store chat runs the AI SDK in the page as well (`streamText` and `@ai-sdk/mcp` in ligna-store `hi-mcp/chat.ts`), but takes its tools from the MCP server and the key from the store URL (`api_key`) — acceptable for a demo only. In the browser, `@ai-sdk/mcp` needs a bound `fetch` (`fetch: (input, init) => fetch(input, init)`): the transport calls it detached, which the browser rejects.

The store's browser `streamChat` has an eight-step budget (`MAX_CHAT_STEPS` in ligna-store `hi-mcp/chat.ts`). Its `prepareStep` disables tools on the final model step, reserving that call for an answer from the preceding tool results; earlier steps may call tools, and an early normal answer ends the turn. The policy applies to both Azure and Mistral. The example's planning assistant has a 16-step budget.

Direct OpenAI requests use `npm start openai:<model-id> <api-key>` (also `npm run dev`), provider
`openai` and the embedding-lib's `@ai-sdk/openai` Responses adapter. The model ID is preserved
exactly.

## Interrupted turns


The planning assistant of the example keeps no failed turn: it shows "The planning assistant
failed: <message>" in the window, and the next turn sees the completed turns only, with their tool
calls and results. It has no interruption summary.

The store's chat records MCP execution through its `hi-mcp/chat-recovery.ts`. Provider errors,
thrown streams and aborts finish with one readable outcome summary. Only successful returned write
results are reported as completed; an MCP error, thrown write or pending write is unconfirmed, and
the answer asks to read the plan before trying it again. Its chat returns completed assistant/tool
message pairs and the interruption summary, which the window retains for the next turn.

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
