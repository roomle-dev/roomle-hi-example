import { createServer } from 'node:http';
import { createMCPClient } from '@ai-sdk/mcp';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createAzure } from '@ai-sdk/azure';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createMistral } from '@ai-sdk/mistral';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { streamText, wrapLanguageModel } from 'ai';
import type { ChatConfig } from './chat-config';
import { CHAT_SYSTEM_PROMPT, getChatConfig } from './chat-config';
import { createChatRequestHandler, type StreamChat } from './chat-handler';
import {
  chatSteps,
  createStepLog,
  isTurnTimeout,
  turnTimeoutMessage,
} from './chat-steps';
import { toolResultFilesAsUserMessages } from './tool-result-images';

const config = getChatConfig(process.env);

// The reasoning effort reaches the GPT deployments as a provider option.
const providerOptions = (config: ChatConfig) =>
  config.reasoningEffort && config.provider === 'azure'
    ? { azure: { reasoningEffort: config.reasoningEffort } }
    : undefined;

const getLanguageModel = (config: ChatConfig) => {
  const apiKey = config.apiToken;
  if (!apiKey) {
    throw new Error('No API token configured');
  }
  switch (config.provider) {
    case 'anthropic':
      return createAnthropic({ apiKey })(config.modelId);
    case 'google':
      return createGoogleGenerativeAI({ apiKey })(config.modelId);
    case 'azure':
      if (!config.azureBaseUrl && !config.azureResourceName) {
        throw new Error(
          'AZURE_RESOURCE_NAME is required for the azure provider (the model id is the deployment name - set it with HI_CHAT_MODEL)'
        );
      }
      return createAzure({
        apiKey,
        resourceName: config.azureResourceName,
        baseURL: config.azureBaseUrl,
      })(config.modelId);
    default:
      return wrapLanguageModel({
        model: createMistral({ apiKey })(config.modelId),
        middleware: toolResultFilesAsUserMessages,
      });
  }
};

// [tool] lines are status, not answer text: the page shows them in the
// status area while the tool call runs and keeps them out of the reply.
const TOOL_STATUS_PREFIX = '[tool] ';

const streamChat: StreamChat = async (messages, clientId) => {
  const startedAt = Date.now();
  console.log(`[hi-chat] chat request: ${messages.length} messages`);
  const mcpUrl = new URL(config.mcpUrl);
  mcpUrl.searchParams.set('client', clientId);
  const mcpClient = await createMCPClient({
    transport: new StreamableHTTPClientTransport(mcpUrl),
  });
  let mcpClientClosed = false;
  const closeMcpClient = async () => {
    if (!mcpClientClosed) {
      mcpClientClosed = true;
      await mcpClient.close();
    }
  };
  let emit = (_text: string) => {};
  try {
    const mcpTools = await mcpClient.tools();
    const toolNames = Object.keys(mcpTools);
    console.log(
      `[hi-chat] MCP connected (${toolNames.length} tools: ${toolNames.join(', ')})`
    );
    const tools = Object.fromEntries(
      Object.entries(mcpTools).map(([name, tool]) => {
        if (!tool.execute) {
          return [name, tool];
        }
        const execute = tool.execute.bind(tool);
        return [
          name,
          {
            ...tool,
            execute: async (input: never, options: never) => {
              emit(`\n${TOOL_STATUS_PREFIX}${name}\n`);
              const toolStartedAt = Date.now();
              console.log(`[hi-chat] tool call: ${name}`);
              try {
                const result = await execute(input, options);
                console.log(
                  `[hi-chat] tool done: ${name} (${Date.now() - toolStartedAt}ms)`
                );
                return result;
              } catch (error) {
                console.error(
                  `[hi-chat] tool failed: ${name} (${Date.now() - toolStartedAt}ms)`,
                  error instanceof Error ? error.message : error
                );
                throw error;
              }
            },
          },
        ];
      })
    );
    const model = getLanguageModel(config);
    const stepLog = createStepLog();
    const result = streamText({
      model,
      instructions: CHAT_SYSTEM_PROMPT,
      messages,
      tools,
      // Without this the stream stops after the first step: tool calls are
      // never executed and never sent back to the model, so tool-driving
      // prompts produce an empty answer.
      ...chatSteps,
      // A turn that does not answer in time ends with a message instead of
      // "assistant is working…" without end.
      abortSignal: AbortSignal.timeout(config.turnTimeoutMs),
      onStepEnd: stepLog.onStepEnd,
      ...(providerOptions(config) && {
        providerOptions: providerOptions(config),
      }),
    });
    // Mid-stream failures (Mistral auth, tool relay) surface as [error] parts
    // in the stream - the response has already started by then.
    const encoder = new TextEncoder();
    const errorText = (error: unknown) =>
      `\n[error] ${
        isTurnTimeout(error)
          ? turnTimeoutMessage(config.turnTimeoutMs)
          : error instanceof Error
            ? error.message
            : String(error)
      }`;
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        emit = (text: string) => controller.enqueue(encoder.encode(text));
        try {
          for await (const part of result.stream) {
            if (part.type === 'text-delta') {
              controller.enqueue(encoder.encode(part.text));
            }
            if (part.type === 'error') {
              stepLog.onError(part.error);
              controller.enqueue(encoder.encode(errorText(part.error)));
            }
            // the turn timeout ends the stream with an abort part
            if (part.type === 'abort') {
              console.error('[hi-chat] turn aborted', part);
              controller.enqueue(
                encoder.encode(
                  `\n[error] ${turnTimeoutMessage(config.turnTimeoutMs)}`
                )
              );
            }
          }
        } catch (error) {
          // a provider answer the SDK cannot process ends the stream with a
          // throw, not with an error part
          stepLog.onError(error);
          controller.enqueue(encoder.encode(errorText(error)));
        } finally {
          controller.close();
          await closeMcpClient();
          console.log(`[hi-chat] chat done (${Date.now() - startedAt}ms)`);
        }
      },
    });
    return new Response(body, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error) {
    await closeMcpClient();
    throw error;
  }
};

const server = createServer(createChatRequestHandler(config, streamChat));

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `[hi-chat] port ${config.port} is already in use - stop the previous instance or pick another with HI_CHAT_PORT.`
    );
  } else {
    console.error('[hi-chat] server failed to start', error);
  }
  process.exit(1);
});

// The chat backend holds the provider API key and accepts originless
// requests (curl debugging), so it binds to loopback only - no other device
// on the local network can reach the token-backed endpoint.
server.listen(config.port, '127.0.0.1', () => {
  console.log('');
  console.log('  HI example AI chat ready');
  console.log('');
  console.log(`  \u279c  Local:   http://localhost:${config.port}/chat`);
  console.log(`  \u279c  MCP:     ${config.mcpUrl}`);
  console.log(`  \u279c  Model:   ${config.provider}:${config.modelId}`);
  console.log(`  \u279c  Images:  ${config.imageInput ? 'yes' : 'no'}`);
  console.log('');
  if (!config.apiToken) {
    console.log(
      '[hi-chat] no API token - POST /chat answers 503 until HI_CHAT_TOKEN is set'
    );
  }
});
