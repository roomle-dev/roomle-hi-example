// Starts the HI example page:
//   - serves this directory (the example page) on port 3000
//   - with a model and its API key, serves the model of the page's AI chat at
//     /planning-assistant-config.json (to this machine only) and opens the
//     page with the chat window visible; the chat runs in the page with the
//     planning assistant of the embedding-lib (startPlanningAssistant)
//
// Start it with:  npm start   (from the repository root or this directory)
// No browser:     npm start -- --no-open
// Other page port: EXAMPLE_PORT=3101 npm start
// Local Rubens UI: npm run dev  (server_url=http://localhost:5173/, override via EXAMPLE_SERVER_URL)
// AI chat:        npm start mistral <api-key>          (mistral-large-latest)
//                  npm start mistral-medium <api-key>   (mistral-medium-latest)
//                  npm start mistral-large-3 <api-key>  (mistral-large-3 deployment
//                                                          on the HI Azure AI Foundry resource)
//                  npm start claude <api-key>           (claude-sonnet-4-5)
//                  npm start gemini <api-key>           (gemini-2.5-pro; gemini-flash: gemini-2.5-flash)
//                  npm start azure <api-key>            (gpt-4o deployment; also set
//                                                          AZURE_RESOURCE_NAME and HI_CHAT_MODEL=<deployment>)
//                  npm start gpt-6-astra <api-key>      (any gpt-* deployment on the HI Azure AI
//                                                          Foundry resource, e.g. gpt-5-mini, gpt-5.4-mini)
//                  npm start gpt-6.1-sol <api-key>      (deployment on its own Foundry resource,
//                                                          with the key of that resource)
//                  npm start mistral-<model-id> <api-key> passes the id through
//                  npm run dev <model> <api-key> combines chat and local Rubens UI server.

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXAMPLE_DIR = dirname(fileURLToPath(import.meta.url));
const STATIC_PORT = Number(process.env.EXAMPLE_PORT ?? 3000);
const DEV_SERVER_URL = 'http://localhost:5173/';
const EXAMPLE_SERVER_URL =
  process.env.EXAMPLE_SERVER_URL ??
  (process.argv.includes('--dev') ? DEV_SERVER_URL : undefined);
const PLANNING_ASSISTANT_CONFIG_PATH = '/planning-assistant-config.json';

// Deployments on the HI Azure AI Foundry resource, reached through its OpenAI
// v1 endpoint: every gpt-* name is a deployment there, and mistral-large-3 is
// served from it as well. A deployment on another Foundry resource names that
// resource's endpoint; a deployment without a reasoning effort runs at its
// Foundry default.
const FOUNDRY_BASE_URL =
  'https://dfhifoundrysweden.services.ai.azure.com/openai/v1';
const FOUNDRY_DEPLOYMENTS = {
  'gpt-5-mini': { reasoningEffort: 'high' },
  'gpt-5.4-mini': { reasoningEffort: 'high' },
  'gpt-6-astra': {},
  'gpt-6.1-sol': {
    baseUrl: 'https://controller-mes-resource.services.ai.azure.com/openai/v1',
  },
  'mistral-large-3': {},
};
// The model names of the other providers; a full mistral-*, claude-* or
// gemini-* model id passes through. azure is a deployment on the resource
// AZURE_RESOURCE_NAME, named with HI_CHAT_MODEL.
const MODEL_ALIASES = {
  mistral: {
    mistral: 'mistral-large-latest',
    'mistral-large': 'mistral-large-latest',
    'mistral-medium': 'mistral-medium-latest',
    'mistral-large-4': 'mistral-large-4-0',
  },
  anthropic: {
    anthropic: 'claude-sonnet-4-5',
    claude: 'claude-sonnet-4-5',
    'claude-sonnet': 'claude-sonnet-4-5',
    'claude-opus': 'claude-opus-4-1',
  },
  google: {
    google: 'gemini-2.5-pro',
    gemini: 'gemini-2.5-pro',
    'gemini-pro': 'gemini-2.5-pro',
    'gemini-flash': 'gemini-2.5-flash',
  },
  azure: {
    azure: 'gpt-4o',
    openai: 'gpt-4o',
  },
};
// The models of the other providers known to read images; Anthropic and
// Google models and the gpt-* deployments on the Foundry resources all do.
const IMAGE_INPUT_MODELS = [
  'mistral-large-latest',
  'mistral-medium-latest',
  'mistral-large-3',
  'mistral-large-4-0',
  'gpt-4o',
  'gpt-5-mini',
  'gpt-5.4-mini',
  'gpt-6-astra',
];

const providerModel = (lower) => {
  for (const [provider, aliases] of Object.entries(MODEL_ALIASES)) {
    if (aliases[lower]) {
      return { provider, model: aliases[lower] };
    }
  }
  if (lower.startsWith('mistral')) {
    return { provider: 'mistral', model: lower };
  }
  if (lower.startsWith('claude')) {
    return { provider: 'anthropic', model: lower };
  }
  if (lower.startsWith('gemini-')) {
    return { provider: 'google', model: lower };
  }
  return undefined;
};

// The PlanningAssistantConfig of the embedding-lib for a model name of the
// command line; names are matched case-insensitively. HI_CHAT_MODEL replaces
// the model of a provider other than the Foundry deployments, and
// HI_CHAT_REASONING_EFFORT the reasoning effort of an azure model reached
// through the Responses API.
const planningAssistantConfig = (name, apiKey) => {
  const lower = name.toLowerCase();
  const reasoningEffort = process.env.HI_CHAT_REASONING_EFFORT;
  if (Object.hasOwn(FOUNDRY_DEPLOYMENTS, lower) || lower.startsWith('gpt-')) {
    const deployment = FOUNDRY_DEPLOYMENTS[lower] ?? {};
    const chatCompletions = lower === 'mistral-large-3';
    const effort = reasoningEffort || deployment.reasoningEffort;
    return {
      provider: 'azure',
      model: lower,
      apiKey,
      baseUrl: deployment.baseUrl ?? FOUNDRY_BASE_URL,
      chatCompletions,
      ...(effort && !chatCompletions && { reasoningEffort: effort }),
      readsImages:
        lower.startsWith('gpt-') || IMAGE_INPUT_MODELS.includes(lower),
    };
  }
  const resolved = providerModel(lower);
  if (!resolved) {
    throw new Error(
      `unsupported model "${name}" - supported: ${Object.values(MODEL_ALIASES)
        .flatMap(Object.keys)
        .join(
          ', '
        )}, ${Object.keys(FOUNDRY_DEPLOYMENTS).join(', ')} or any gpt-*/mistral-*/claude-*/gemini-* model id`
    );
  }
  const model = process.env.HI_CHAT_MODEL || resolved.model;
  const readsImages =
    resolved.provider === 'anthropic' ||
    resolved.provider === 'google' ||
    IMAGE_INPUT_MODELS.includes(model);
  if (resolved.provider !== 'azure') {
    return { provider: resolved.provider, model, apiKey, readsImages };
  }
  const resourceName = process.env.AZURE_RESOURCE_NAME;
  if (!resourceName) {
    throw new Error(
      'AZURE_RESOURCE_NAME is required for the azure provider (the model is the deployment name - set it with HI_CHAT_MODEL)'
    );
  }
  return {
    provider: 'azure',
    model,
    apiKey,
    // the endpoint the AI SDK builds from a resource name
    baseUrl: `https://${resourceName}.openai.azure.com/openai`,
    ...(reasoningEffort && { reasoningEffort }),
    readsImages,
  };
};

const parseChatConfig = () => {
  const positionalArgs = process.argv
    .slice(2)
    .filter((arg) => !arg.startsWith('--'));
  if (positionalArgs.length === 0) {
    return undefined;
  }
  const [name, apiKey] = positionalArgs;
  if (!apiKey) {
    console.error(
      '[hi-example] missing API key - start with: npm start <model> <api-key>'
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

const EXAMPLE_URL = `http://localhost:${STATIC_PORT}/?backendId=HI_PRE_Roomle_Milestone_2&library_id=Furniture_Smith${chatConfig ? '&chat=true' : ''}${
  EXAMPLE_SERVER_URL
    ? `&server_url=${encodeURIComponent(EXAMPLE_SERVER_URL)}`
    : ''
}`;
const STATIC_CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};
const LOOPBACK_ADDRESSES = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

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
const servePlanningAssistantConfig = (request, response) => {
  if (!chatConfig) {
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end(
      'No model - start the example with npm start <model> <api-key>'
    );
    return;
  }
  if (!LOOPBACK_ADDRESSES.includes(request.socket.remoteAddress)) {
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

const startExampleServer = () =>
  new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      const { pathname } = new URL(
        request.url,
        `http://localhost:${STATIC_PORT}`
      );
      if (pathname === PLANNING_ASSISTANT_CONFIG_PATH) {
        servePlanningAssistantConfig(request, response);
      } else {
        serveStatic(response, pathname);
      }
    });
    server.on('error', reject);
    server.listen(STATIC_PORT, () => resolve(server));
  });

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
  try {
    await startExampleServer();
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      console.error(`[hi-example] port ${STATIC_PORT} is already in use.`);
      console.error(
        '[hi-example] pick another port: EXAMPLE_PORT=3101 npm start'
      );
    } else {
      console.error('[hi-example] the example server failed to start', error);
    }
    process.exit(1);
  }
  console.log('');
  console.log('  HI example ready');
  console.log('');
  console.log(`  ➜  Example:  ${EXAMPLE_URL}`);
  if (chatConfig) {
    console.log(`  ➜  Model:    ${chatConfig.provider} ${chatConfig.model}`);
  }
  console.log('');
  if (!process.argv.includes('--no-open')) {
    openInBrowser(EXAMPLE_URL);
  }
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => process.exit(0));
  }
};

main();
