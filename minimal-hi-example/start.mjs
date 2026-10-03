// Starts the HI example page and the hi-mcp-poc-json MCP server together:
//   - installs and typechecks the hi-mcp workspace before anything starts
//   - serves this directory (the example page) on port 3000 - the port the
//     MCP server's default origin allow-list already contains
//   - spawns the MCP server (vite-node hi-mcp/hi-mcp-poc-json/server.ts) on
//     port 3100 and points its "no page connected" error at the example URL
//
// Start it with:  npm start   (from the repository root or this directory)
// No browser:     npm start -- --no-open
// Other page port: EXAMPLE_PORT=3101 npm start
// Local Rubens UI: npm run dev  (server_url=http://localhost:5173/, override via EXAMPLE_SERVER_URL)
// Cloudflare MCP: npm run start:cf  (the deployed MCP server instead of the local one,
//                  session = the OS user name; page port 3000 only)
// AI chat:        npm start mistral <api-key>          (mistral-large-latest)
//                  npm start mistral-medium <api-key>   (mistral-medium-latest)
//                  npm start claude <api-key>           (claude-sonnet-4-5)
//                  npm start gemini <api-key>           (gemini-2.5-pro; gemini-flash: gemini-2.5-flash)
//                  npm start azure <api-key>            (gpt-4o deployment; also set
//                                                          AZURE_RESOURCE_NAME and HI_CHAT_MODEL=<deployment>)
//                  npm start gpt-5-mini <api-key>       (gpt-5-mini / gpt-5.4-mini / gpt-6-astra deployment
//                                                          on the HI Azure AI Foundry resource)
//                  npm start mistral-<model-id> <api-key> passes the id through
//                  npm run dev <provider> <api-key> combines chat and local Rubens UI server.
//                  npm run start:cf <provider> <api-key> combines chat and the Cloudflare MCP server.
//                  spawns the hi-mcp-chat backend (Vercel AI SDK) and opens the
//                  example with the chat window visible

import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { userInfo } from 'node:os';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXAMPLE_DIR = dirname(fileURLToPath(import.meta.url));
const HI_MCP_DIR = join(EXAMPLE_DIR, '..', 'hi-mcp');
const STATIC_PORT = Number(process.env.EXAMPLE_PORT ?? 3000);
const MCP_PORT = process.env.HI_MCP_PORT ?? '3100';
const CHAT_PORT = process.env.HI_CHAT_PORT ?? '3200';
const DEV_SERVER_URL = 'http://localhost:5173/';
const EXAMPLE_SERVER_URL =
  process.env.EXAMPLE_SERVER_URL ??
  (process.argv.includes('--dev') ? DEV_SERVER_URL : undefined);
// The deployed server accepts the page only from its default origins
// (http://localhost:3000), and routes every session to its own container.
const CLOUDFLARE_MCP_SERVER_URL = 'https://hi-mcp-poc.hi-orchestrator.workers.dev';
const CLOUDFLARE_PAGE_PORT = 3000;
const useCloudflareMcp = process.argv.includes('--cf');
const MCP_SESSION = useCloudflareMcp ? userInfo().username : undefined;
const MCP_URL = useCloudflareMcp
  ? `${CLOUDFLARE_MCP_SERVER_URL}/mcp?session=${encodeURIComponent(MCP_SESSION)}`
  : `http://localhost:${MCP_PORT}/mcp`;
// Chat providers the launcher accepts: the aliases below plus any full
// mistral-*/claude-*/gemini-* model id. The chat backend resolves the same names
// (chat-config.ts PROVIDER_MODEL_ALIASES); azure deployments are user-named
// and set via HI_CHAT_MODEL.
const CHAT_PROVIDERS = [
  'mistral',
  'mistral-medium',
  'mistral-large',
  'anthropic',
  'claude',
  'google',
  'gemini',
  'gemini-pro',
  'gemini-flash',
  'azure',
  'openai',
  'gpt-5-mini',
  'gpt-5.4-mini',
  'gpt-6-astra',
];
const isChatProvider = (name) =>
  CHAT_PROVIDERS.includes(name) ||
  name.startsWith('mistral-') ||
  name.startsWith('claude-') ||
  name.startsWith('gemini-');
const parseChatArgs = () => {
  const positionalArgs = process.argv
    .slice(2)
    .filter((arg) => !arg.startsWith('--'));
  if (positionalArgs.length === 0) {
    return undefined;
  }
  const [provider, apiKey] = positionalArgs;
  if (!isChatProvider(provider)) {
    console.error(
      `[hi-example] unsupported chat provider "${provider}" - currently supported: ${CHAT_PROVIDERS.join(
        ', ',
      )} or any mistral-*/claude-*/gemini-* model id`,
    );
    process.exit(1);
  }
  if (!apiKey) {
    console.error(
      `[hi-example] missing API key - start with: npm start <provider> <api-key>`,
    );
    process.exit(1);
  }
  return { provider, apiKey };
};
const chat = parseChatArgs();
const MCP_SERVER_PARAMS = useCloudflareMcp
  ? `&mcp_server=${encodeURIComponent(CLOUDFLARE_MCP_SERVER_URL)}&mcp_session=${encodeURIComponent(MCP_SESSION)}`
  : process.env.HI_MCP_PORT
    ? `&mcp_port=${MCP_PORT}`
    : '';
const EXAMPLE_URL = `http://localhost:${STATIC_PORT}/?mcp=true&backendId=HI_PRE_Roomle_Milestone_2&library_id=Furniture_Smith${MCP_SERVER_PARAMS}${chat ? '&chat=true' : ''}${process.env.HI_CHAT_PORT ? `&chat_port=${CHAT_PORT}` : ''}${
  EXAMPLE_SERVER_URL ? `&server_url=${encodeURIComponent(EXAMPLE_SERVER_URL)}` : ''
}`;
const STATIC_CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
let shuttingDown = false;

const runNpm = (args) => {
  const result = spawnSync(npmCommand, args, { cwd: HI_MCP_DIR, stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`[hi-example] npm ${args.join(' ')} failed`);
    process.exit(result.status ?? 1);
  }
};

const buildHiMcp = () => {
  if (!existsSync(join(HI_MCP_DIR, 'node_modules'))) {
    console.log('[hi-example] installing the hi-mcp workspace (first run)');
    runNpm(['install']);
  }
  console.log('[hi-example] typechecking the MCP server');
  runNpm(['run', 'typecheck']);
};

const serveStatic = (response, pathname) => {
  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = normalize(join(EXAMPLE_DIR, relativePath));
  const contentType = STATIC_CONTENT_TYPES[extname(filePath)];
  if (!filePath.startsWith(EXAMPLE_DIR) || !contentType) {
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end('Not found');
    return;
  }
  readFile(filePath)
    .then((content) => {
      response.writeHead(200, { 'Content-Type': contentType });
      response.end(content);
    })
    .catch(() => {
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('Not found');
    });
};

const startExampleServer = () =>
  new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      serveStatic(response, new URL(request.url, `http://localhost:${STATIC_PORT}`).pathname);
    });
    server.on('error', reject);
    server.listen(STATIC_PORT, () => resolve(server));
  });

const startMcpServer = () => {
  const childEnv = { ...process.env, HI_MCP_STORE_URL: EXAMPLE_URL };
  if (!childEnv.HI_MCP_PAGE_ORIGINS) {
    childEnv.HI_MCP_PAGE_ORIGINS = `http://localhost:${STATIC_PORT},http://127.0.0.1:${STATIC_PORT},https://www.roomle.com`;
  }
  const mcpServer = spawn(npmCommand, ['start', '--workspace', 'hi-mcp-poc-json'], {
    cwd: HI_MCP_DIR,
    stdio: 'inherit',
    env: childEnv,
  });
  mcpServer.on('exit', (code) => {
    if (!shuttingDown) {
      process.exit(code ?? 0);
    }
  });
  return mcpServer;
};

const startChatServer = () => {
  const childEnv = {
    ...process.env,
    HI_CHAT_TOKEN: chat.apiKey,
    HI_CHAT_PROVIDER: chat.provider,
    HI_MCP_URL: MCP_URL,
  };
  if (!childEnv.HI_CHAT_PAGE_ORIGINS) {
    childEnv.HI_CHAT_PAGE_ORIGINS = `http://localhost:${STATIC_PORT},http://127.0.0.1:${STATIC_PORT}`;
  }
  const chatServer = spawn(npmCommand, ['start', '--workspace', 'hi-mcp-chat'], {
    cwd: HI_MCP_DIR,
    stdio: 'inherit',
    env: childEnv,
  });
  chatServer.on('exit', (code) => {
    if (!shuttingDown) {
      process.exit(code ?? 0);
    }
  });
  return chatServer;
};

const openInBrowser = (url) => {
  const command =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'cmd'
        : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(command, args, { stdio: 'ignore', detached: true });
  child.on('error', () => {});
  child.unref();
};

const main = async () => {
  if (useCloudflareMcp && STATIC_PORT !== CLOUDFLARE_PAGE_PORT) {
    console.error(
      `[hi-example] --cf needs the example on port ${CLOUDFLARE_PAGE_PORT} - the Cloudflare MCP server accepts the page only from http://localhost:${CLOUDFLARE_PAGE_PORT}`,
    );
    process.exit(1);
  }
  buildHiMcp();
  try {
    await startExampleServer();
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      console.error(`[hi-example] port ${STATIC_PORT} is already in use.`);
      console.error('[hi-example] pick another port: EXAMPLE_PORT=3101 npm start');
    } else {
      console.error('[hi-example] the example server failed to start', error);
    }
    process.exit(1);
  }
  const mcpServer = useCloudflareMcp ? undefined : startMcpServer();
  const chatServer = chat ? startChatServer() : undefined;
  console.log('');
  console.log('  HI example ready');
  console.log('');
  console.log(`  ➜  Example:  ${EXAMPLE_URL}`);
  console.log(`  ➜  MCP:      ${MCP_URL}`);
  if (chatServer) {
    console.log(`  ➜  Chat:     http://localhost:${CHAT_PORT}/chat`);
  }
  console.log('');
  if (!process.argv.includes('--no-open')) {
    openInBrowser(EXAMPLE_URL);
  }
  const shutdown = () => {
    shuttingDown = true;
    mcpServer?.kill();
    chatServer?.kill();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

main();
