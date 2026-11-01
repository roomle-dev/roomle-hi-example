// Starts the HI example page:
//   - serves this directory (the example page) on port 3000, or on the next
//     free port when 3000 is already in use
//   - opens the page without the AI chat: npm start and npm run dev start
//     only the example (the page gets chat=false)
//   - with a model and its API key, serves the model of the page's AI chat at
//     /planning-assistant-config.json (to this machine only) and opens the
//     page with chat=true and the chat window visible; the chat runs in the
//     page with the planning assistant of the embedding-lib
//     (startPlanningAssistant)
//
// Start it with:  npm start   (from the repository root or this directory)
// No browser:     npm start -- --no-open
// Other page port: EXAMPLE_PORT=3101 npm start
// Local Rubens UI: npm run dev  (server_url=http://localhost:5173/, override via EXAMPLE_SERVER_URL)
// AI chat:        npm start <provider>:<model-id> <api-key>
//                  <provider> is a provider of the embedding-lib (anthropic, azure,
//                  google, mistral, openai, openai-compatible), <model-id> the exact
//                  model id at it - for azure the deployment name, by default on the
//                  HI Azure AI Foundry resource:
//                  npm start azure:gpt-6-astra $AZURE_GPT_KEY
//                  npm start mistral:mistral-large-4 $MI_API_USAGE_KEY
//                  --base-url <url>          the endpoint (azure, openai-compatible)
//                  --reasoning-effort <e>    azure: the reasoning effort of the deployment
//                  --chat-completions        azure: Chat Completions instead of Responses
//                  --cache-breakpoint        azure: the cache breakpoint after the library reference
//                  npm run dev <provider>:<model-id> <api-key> combines chat and local Rubens UI server.

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const USAGE =
  'usage: npm start [<provider>:<model-id> <api-key>] [--base-url <url>] [--reasoning-effort <effort>] [--chat-completions] [--cache-breakpoint] [--dev] [--no-open]';
const parseOptions = () => {
  try {
    return parseArgs({
      allowPositionals: true,
      options: {
        'base-url': { type: 'string' },
        'reasoning-effort': { type: 'string' },
        'chat-completions': { type: 'boolean', default: false },
        'cache-breakpoint': { type: 'boolean', default: false },
        dev: { type: 'boolean', default: false },
        'no-open': { type: 'boolean', default: false },
      },
    });
  } catch (error) {
    console.error(`[hi-example] ${error.message}`);
    console.error(`[hi-example] ${USAGE}`);
    process.exit(1);
  }
};
const { values: options, positionals } = parseOptions();

const EXAMPLE_DIR = dirname(fileURLToPath(import.meta.url));
const REQUESTED_PORT = Number(process.env.EXAMPLE_PORT ?? 3000);
const DEV_SERVER_URL = 'http://localhost:5173/';
const EXAMPLE_SERVER_URL =
  process.env.EXAMPLE_SERVER_URL ?? (options.dev ? DEV_SERVER_URL : undefined);
const PLANNING_ASSISTANT_CONFIG_PATH = '/planning-assistant-config.json';

// The providers of the embedding-lib's planning assistant.
const PROVIDERS = [
  'anthropic',
  'azure',
  'google',
  'mistral',
  'openai',
  'openai-compatible',
];
// The OpenAI v1 endpoint of the HI Azure AI Foundry resource, where an azure
// deployment is unless --base-url names another resource.
const FOUNDRY_BASE_URL =
  'https://dfhifoundrysweden.services.ai.azure.com/openai/v1';

// The PlanningAssistantConfig of the embedding-lib for <provider>:<model-id>:
// the provider and the exact model id at it, with the options of the command
// line.
const planningAssistantConfig = (name, apiKey) => {
  const separator = name.indexOf(':');
  const provider = name.slice(0, separator);
  const model = name.slice(separator + 1);
  if (separator < 0 || !PROVIDERS.includes(provider) || !model) {
    throw new Error(
      `"${name}" is no <provider>:<model-id> - provider: ${PROVIDERS.join(', ')}`
    );
  }
  const baseUrl =
    options['base-url'] ??
    (provider === 'azure' ? FOUNDRY_BASE_URL : undefined);
  if (provider === 'openai-compatible' && !baseUrl) {
    throw new Error('openai-compatible needs --base-url <url>');
  }
  return {
    provider,
    model,
    apiKey,
    ...(baseUrl && { baseUrl }),
    ...(options['chat-completions'] && { chatCompletions: true }),
    ...(options['reasoning-effort'] && {
      reasoningEffort: options['reasoning-effort'],
    }),
    ...(options['cache-breakpoint'] && { referenceCacheBreakpoint: true }),
    readsImages: true,
  };
};

const parseChatConfig = () => {
  if (positionals.length === 0) {
    return undefined;
  }
  const [name, apiKey] = positionals;
  if (!apiKey) {
    console.error(
      '[hi-example] missing API key - start with: npm start <provider>:<model-id> <api-key>'
    );
    process.exit(1);
  }
  try {
    return planningAssistantConfig(name, apiKey);
  } catch (error) {
    console.error(`[hi-example] ${error.message}`);
    process.exit(1);
  }
};
const chatConfig = parseChatConfig();

// The page the launcher opens: the example always with an explicit chat
// parameter - true with a model, false without one, so plain npm start and
// npm run dev start only the example, without the AI planning assistant.
const exampleUrl = (port) =>
  `http://localhost:${port}/?backendId=HI_PRE_Roomle_Milestone_2&library_id=Furniture_Smith&chat=${chatConfig ? 'true' : 'false'}${
    EXAMPLE_SERVER_URL
      ? `&server_url=${encodeURIComponent(EXAMPLE_SERVER_URL)}`
      : ''
  }`;
const STATIC_CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};
const LOOPBACK_ADDRESSES = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
// The authorities the page has on this machine. Another Host is a site whose
// name resolves to this machine (DNS rebinding), which must not read the key.
const loopbackHosts = (port) =>
  ['localhost', '127.0.0.1', '[::1]'].map((host) => `${host}:${port}`);

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

// The model with its API key, for the page on this machine only.
const servePlanningAssistantConfig = (request, response, port) => {
  if (!chatConfig) {
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end(
      'No model - start the example with npm start <provider>:<model-id> <api-key>'
    );
    return;
  }
  if (
    !LOOPBACK_ADDRESSES.includes(request.socket.remoteAddress) ||
    !loopbackHosts(port).includes(request.headers.host?.toLowerCase())
  ) {
    response.writeHead(403, { 'Content-Type': 'text/plain' });
    response.end('The model is served to this machine only');
    return;
  }
  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(chatConfig));
};

// Binds the server to the port; a taken port falls through to the next one.
const listen = (server, port) =>
  new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening);
      if (error.code === 'EADDRINUSE') {
        resolve(listen(server, port + 1));
      } else {
        reject(error);
      }
    };
    const onListening = () => {
      server.off('error', onError);
      resolve(port);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port);
  });

// Serves the example and answers with the port it is bound to.
const startExampleServer = () => {
  let pagePort = REQUESTED_PORT;
  const server = createServer((request, response) => {
    const { pathname } = new URL(request.url, `http://localhost:${pagePort}`);
    if (pathname === PLANNING_ASSISTANT_CONFIG_PATH) {
      servePlanningAssistantConfig(request, response, pagePort);
    } else {
      serveStatic(response, pathname);
    }
  });
  return listen(server, REQUESTED_PORT).then((port) => {
    pagePort = port;
    return port;
  });
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
  let port;
  try {
    port = await startExampleServer();
  } catch (error) {
    console.error('[hi-example] the example server failed to start', error);
    process.exit(1);
  }
  if (port !== REQUESTED_PORT) {
    console.log(
      `[hi-example] port ${REQUESTED_PORT} is already in use - using ${port}`
    );
  }
  console.log('');
  console.log('  HI example ready');
  console.log('');
  console.log(`  ➜  Example:  ${exampleUrl(port)}`);
  if (chatConfig) {
    console.log(`  ➜  Model:    ${chatConfig.provider} ${chatConfig.model}`);
  }
  console.log('');
  if (!options['no-open']) {
    openInBrowser(exampleUrl(port));
  }
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => process.exit(0));
  }
};

main();
