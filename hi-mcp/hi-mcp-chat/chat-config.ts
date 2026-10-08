import type { ModelMessage } from 'ai';

export const DEFAULT_CHAT_PORT = 3200;
export const DEFAULT_MCP_URL = 'http://localhost:3100/mcp';
// A turn ends with a message to the user when the model has not answered
// within this time (gpt-5-mini went silent for 10 minutes on large kitchens).
export const DEFAULT_TURN_TIMEOUT_MS = 5 * 60_000;
const CHAT_ROLES = ['user', 'assistant'] as const;

// The model learns the server's rules only through get-authoring-rules; the
// system prompt tells it what HI plans, how to work and to answer from the tool results.
export const CHAT_SYSTEM_PROMPT = [
  'You are a planning assistant for HOMAG Intelligence (HI) furniture in a Roomle planner: kitchens, wardrobes, living room and utility furniture, all made of articles.',
  'Use the provided tools to read the plan context and to create, modify, or position object groups.',
  'Call tools instead of describing what you would do, then summarize what you changed.',
  'When the request names a kind of article, not an article id, take the closest article of the catalog - from the category of its neighbours where that category has one - and say which one you chose instead of asking.',
  'Summarize what you changed in a few sentences from the last tool results only - the groups, their roots and attributes, corrections and notLoaded - never by repeating the results, and name what was asked but is not in the plan.',
].join(' ');

export class ChatRequestError extends Error {}

export type ChatProvider = 'mistral' | 'anthropic' | 'google' | 'azure';

export interface ChatModel {
  provider: ChatProvider;
  modelId: string;
  baseUrl?: string;
}

// Deployments on the HI Azure AI Foundry resource, reached through its OpenAI
// v1 endpoint: the CLI name is the deployment name. A deployment without a
// reasoning effort runs at its Foundry default.
export const FOUNDRY_BASE_URL =
  'https://dfhifoundrysweden.services.ai.azure.com/openai/v1';
export const FOUNDRY_DEPLOYMENTS: Record<string, { reasoningEffort?: string }> =
  {
    'gpt-5-mini': { reasoningEffort: 'high' },
    'gpt-5.4-mini': { reasoningEffort: 'high' },
    'gpt-6-astra': {},
  };

// CLI provider names (npm start <provider>) resolved to a provider and model.
// Full model ids pass through: mistral-*, claude-* and gemini-* ids map to their
// provider; azure deployments are user-named and come via HI_CHAT_MODEL.
export const PROVIDER_MODEL_ALIASES: Record<
  ChatProvider,
  Record<string, string>
> = {
  mistral: {
    mistral: 'mistral-large-latest',
    'mistral-large': 'mistral-large-latest',
    'mistral-medium': 'mistral-medium-latest',
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

export const resolveChatModel = (requested: string | undefined): ChatModel => {
  const name = requested ?? 'mistral';
  if (Object.hasOwn(FOUNDRY_DEPLOYMENTS, name)) {
    return { provider: 'azure', modelId: name, baseUrl: FOUNDRY_BASE_URL };
  }
  for (const provider of Object.keys(
    PROVIDER_MODEL_ALIASES
  ) as ChatProvider[]) {
    const modelId = PROVIDER_MODEL_ALIASES[provider][name];
    if (modelId) {
      return { provider, modelId };
    }
  }
  if (name.startsWith('mistral')) {
    return { provider: 'mistral', modelId: name };
  }
  if (name.startsWith('claude')) {
    return { provider: 'anthropic', modelId: name };
  }
  if (name.startsWith('gemini-')) {
    return { provider: 'google', modelId: name };
  }
  throw new ChatRequestError(
    `Unknown chat provider or model "${name}" - supported: mistral, mistral-medium, mistral-large, anthropic, claude, google, gemini, gemini-pro, gemini-flash, azure, gpt-5-mini, gpt-5.4-mini, gpt-6-astra, or a full mistral-*/claude-*/gemini-* model id`
  );
};

export interface ChatMessage {
  role: (typeof CHAT_ROLES)[number];
  content: string;
  images?: string[];
}

// Inline image data only: the AI SDK downloads an image given as a URL itself.
const IMAGE_DATA_URL =
  /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+=*$/;
// The text of a user message that carries images but no text.
export const DEFAULT_IMAGE_PROMPT =
  'Identify the furniture in the image (for example a kitchen, wardrobe, media unit, lowboard, ' +
  'sideboard, cabinet or utility room) and create a planning as close to it as possible.';

// Models of the other providers known to read images; Anthropic and Google
// models all do. Any other model id gets no image input.
export const IMAGE_INPUT_MODELS = [
  'mistral-large-latest',
  'mistral-medium-latest',
  'gpt-4o',
  'gpt-5-mini',
  'gpt-5.4-mini',
  'gpt-6-astra',
];

export const readsImages = (provider: ChatProvider, modelId: string) =>
  provider === 'anthropic' ||
  provider === 'google' ||
  IMAGE_INPUT_MODELS.includes(modelId);

export interface ChatConfig {
  port: number;
  provider: ChatProvider;
  apiToken: string | undefined;
  modelId: string;
  imageInput: boolean;
  azureResourceName: string | undefined;
  azureBaseUrl: string | undefined;
  mcpUrl: string;
  pageOrigins: string[];
  turnTimeoutMs: number;
  // the reasoning effort of the GPT deployments; the provider's default when unset
  reasoningEffort: string | undefined;
}

export const getChatConfig = (env: NodeJS.ProcessEnv): ChatConfig => {
  const chatModel = resolveChatModel(env.HI_CHAT_PROVIDER);
  // HI_CHAT_MODEL overrides the resolved model id (e.g. an Azure deployment
  // name) without changing the provider; Foundry deployments are fixed by
  // their CLI name
  const modelId = chatModel.baseUrl
    ? chatModel.modelId
    : env.HI_CHAT_MODEL || chatModel.modelId;
  return {
    port: Number(env.HI_CHAT_PORT) || DEFAULT_CHAT_PORT,
    provider: chatModel.provider,
    apiToken: env.HI_CHAT_TOKEN || undefined,
    modelId,
    imageInput: readsImages(chatModel.provider, modelId),
    azureResourceName: env.AZURE_RESOURCE_NAME || undefined,
    azureBaseUrl: chatModel.baseUrl,
    mcpUrl: env.HI_MCP_URL || DEFAULT_MCP_URL,
    pageOrigins: env.HI_CHAT_PAGE_ORIGINS
      ? env.HI_CHAT_PAGE_ORIGINS.split(',')
          .map((origin) => origin.trim())
          .filter(Boolean)
      : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    turnTimeoutMs:
      Number(env.HI_CHAT_TURN_TIMEOUT_MS) || DEFAULT_TURN_TIMEOUT_MS,
    reasoningEffort:
      env.HI_CHAT_REASONING_EFFORT ||
      (chatModel.baseUrl
        ? FOUNDRY_DEPLOYMENTS[modelId].reasoningEffort
        : undefined),
  };
};

export const parseChatMessages = (body: unknown): ChatMessage[] => {
  if (typeof body !== 'object' || body === null) {
    throw new ChatRequestError(
      'Request body must be JSON with a messages array'
    );
  }
  const { messages } = body as { messages?: unknown };
  if (!Array.isArray(messages)) {
    throw new ChatRequestError(
      'Request body must be JSON with a messages array'
    );
  }
  return messages.map((message: unknown) => {
    if (typeof message !== 'object' || message === null) {
      throw new ChatRequestError(
        'Each message must be an object with role and content'
      );
    }
    const { role, content, images } = message as {
      role?: unknown;
      content?: unknown;
      images?: unknown;
    };
    if (
      typeof role !== 'string' ||
      !CHAT_ROLES.includes(role as ChatMessage['role'])
    ) {
      throw new ChatRequestError(`Invalid message role: ${role}`);
    }
    if (typeof content !== 'string') {
      throw new ChatRequestError('Message content must be a string');
    }
    if (images === undefined) {
      return { role: role as ChatMessage['role'], content };
    }
    if (
      !Array.isArray(images) ||
      !images.every(
        (image) => typeof image === 'string' && IMAGE_DATA_URL.test(image)
      )
    ) {
      throw new ChatRequestError(
        'Message images must be an array of base64 data URLs (image/jpeg, image/png, image/webp or image/gif)'
      );
    }
    if (images.length > 0 && role !== 'user') {
      throw new ChatRequestError('Only user messages can carry images');
    }
    return images.length > 0
      ? { role: role as ChatMessage['role'], content, images }
      : { role: role as ChatMessage['role'], content };
  });
};

export const toModelMessages = (messages: ChatMessage[]): ModelMessage[] =>
  messages.map(({ role, content, images }) =>
    images?.length
      ? {
          role: 'user',
          content: [
            { type: 'text', text: content.trim() || DEFAULT_IMAGE_PROMPT },
            ...images.map((image) => ({
              type: 'file' as const,
              data: image,
              mediaType: image.slice('data:'.length, image.indexOf(';')),
            })),
          ],
        }
      : { role, content }
  );
