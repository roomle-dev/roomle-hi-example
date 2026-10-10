import { createServer } from 'node:http';
import { getChatConfig } from './chat-config';
import { createChatRequestHandler } from './chat-handler';
import { createStreamChat } from './chat-stream';

const config = getChatConfig(process.env);
const streamChat = createStreamChat(config);

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
