# Vercel AI SDK Chat Integration

> **Provenance**: Jira ticket [RML-17984](https://roomle.atlassian.net/browse/RML-17984) ("add chat in hi mcp example"), comment [155492](https://roomle.atlassian.net/browse/RML-17984?focusedCommentId=155492) by Gernot Steinegger, 2026-09-29. Content added verbatim (formatting adapted to markdown).

Load this skill when integrating an AI chat window with the HI MCP server using the Vercel AI SDK. The living reference for the implemented chat is [`../../docs/ai-chat.md`](../../docs/ai-chat.md); why the chat is an MCP client beside the server, not a route of it: [ADR 0003](../decisions/0003-the-ai-chat-is-an-mcp-client-beside-the-server.md).

## Local wiring in roomle-hi-example

The comment's three-tier architecture is implemented as:

- **Browser**: the chat UI in `minimal-hi-example/index.html` — no React, so instead of `useChat` the page streams the backend's plain text response with a fetch body reader, rendering replies as sanitized markdown (marked + DOMPurify, imported dynamically only when the chat is enabled).
- **Backend API route**: the `hi-mcp/hi-mcp-chat` workspace package (`POST /chat`). Started by `minimal-hi-example/start.mjs` via `npm start <provider> <api-key>`; the API key goes from the CLI argument into the backend's environment (`HI_CHAT_TOKEN`), never into the page or URL.
- **MCP server**: the existing `hi-mcp/hi-mcp-server` server, unchanged. The chat backend creates a per-request MCP client via `@ai-sdk/mcp` + `StreamableHTTPClientTransport`, fetches the tools, and passes them to `streamText`.

Providers wired in the local implementation: Mistral (`createMistral`), Anthropic (`createAnthropic`, CLI names `claude`/`anthropic`), Google Gemini (`createGoogleGenerativeAI` from `@ai-sdk/google`, Gemini API key from Google AI Studio, CLI names `gemini`/`google`/`gemini-pro` → `gemini-2.5-pro`, `gemini-flash` → `gemini-2.5-flash`, any `gemini-*` id passed through), and Azure OpenAI (`createAzure`, CLI names `azure`/`openai`, requires `AZURE_RESOURCE_NAME` and the deployment name in `HI_CHAT_MODEL` — the comment's keyless Azure Entra ID variant is not implemented; CLI names `gpt-5-mini`/`gpt-5.4-mini`/`gpt-6-astra` are deployments on the HI Azure AI Foundry resource, reached via `createAzure({ baseURL: 'https://dfhifoundrysweden.services.ai.azure.com/openai/v1' })` without extra env vars). `streamText` needs `stopWhen: stepCountIs(n)` — with the default `stepCountIs(1)` tool calls are never executed and tool-driving prompts return an empty stream; the chat runs up to 16 steps and its last step with `toolChoice: 'none'` (`prepareStep`, `hi-mcp-chat/chat-steps.ts`), so a turn that uses every step still ends with the model's answer instead of a tool result ([a chat turn](../../docs/ai-chat.md#a-chat-turn)); `abortSignal: AbortSignal.timeout(HI_CHAT_TURN_TIMEOUT_MS)` ends a turn that never answers — the SDK emits an `abort` part on the stream, which the backend turns into an `[error]` line — and `onStepEnd` logs the tokens, tool calls and duration of every step (`logStepUsage`, `chat-steps.ts`); the system prompt (`CHAT_SYSTEM_PROMPT`, `chat-config.ts`) asks the model to answer only from the last tool results. `@ai-sdk/mistral` sends the image parts of a tool result as JSON text (base64 included); the Mistral model is wrapped with a `wrapLanguageModel` middleware that moves them into a user message after the tool message (`hi-mcp-chat/tool-result-images.ts`). Images the user attaches go to `POST /chat` as `images` (base64 data URLs) on a user message and to `streamText` as file parts with the image media type (`toModelMessages`, `hi-mcp-chat/chat-config.ts`); a user message with images and no text gets `DEFAULT_IMAGE_PROMPT` ("Identify the furniture in the image (for example a kitchen, wardrobe, media unit, lowboard, sideboard, cabinet or utility room) and create a planning as close to it as possible.") there — the `image` content part is deprecated in AI SDK 7 and logs a warning on every step. The backend accepts no image URL, because the SDK downloads an image given as a URL in the backend unless the provider fetches URLs itself (`downloadAssets` in `ai`). `GET /capabilities` tells the page whether the model reads images (`readsImages`).

Deviations from the comment's example code, found during implementation:

- `StreamableHTTPClientTransport` takes a `URL` object (`new StreamableHTTPClientTransport(new URL(url))`), not an options object with `url`.
- The Vercel AI SDK packages require zod 4.6+; the workspace's `zod` pin was aligned so a single copy is deduped.
- The provider API key does **not** come from a URL parameter (as the ticket required) — it is passed as a CLI argument to the launcher and forwarded as an environment variable, keeping it out of the browser history and server logs.
- The ligna-store chat is the exception: the store is a static site without a backend, so it runs the AI SDK in the page (`streamText` and `@ai-sdk/mcp` in ligna-store `hi-mcp/chat.ts`) and takes the key from the store URL (`api_key`) — acceptable for a demo only. In the browser, `@ai-sdk/mcp` needs a bound `fetch` (`fetch: (input, init) => fetch(input, init)`): the transport calls it detached, which the browser rejects.

The store's browser `streamChat` has an eight-step budget (`MAX_CHAT_STEPS` in ligna-store `hi-mcp/chat.ts`). Its `prepareStep` disables tools on the final model step, reserving that call for an answer from the preceding tool results; earlier steps may call tools, and an early normal answer ends the turn. The policy applies to both Azure and Mistral. The example keeps its own 16-step budget.

## Interrupted turns

The example's `chat-stream.ts` records MCP execution through `chat-recovery.ts`. Provider errors,
thrown streams and aborts finish with one readable outcome summary plus the diagnostic marker.
Only successful returned write results are reported as completed. An MCP error, thrown write or
pending write is unconfirmed; the answer asks to read the plan before trying it again. Read-only
turns say that nothing was created or changed. Partial text stays visible and is marked incomplete.
Recovery repeats no operation, calls no model and performs no automatic undo. Logging is best
effort and cannot stop recovery. A thrown tool-completion log also leaves the successful MCP
result intact for the next model step. `chat-stream.test.ts` covers these paths with mock models,
including `keeps a completed write successful when its completion log throws`.

Keep the store's `hi-mcp/chat-recovery.ts` copy in sync. Its chat returns completed assistant/tool
message pairs and the interruption summary, which the window retains for the next turn. Pending
calls have no fabricated result; failed model-output conversion keeps the actual result as text.
The recovery implementation and completed message pairs are covered in the example's `chat-stream.test.ts`.

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
