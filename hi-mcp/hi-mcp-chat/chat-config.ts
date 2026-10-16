import type { ModelMessage } from 'ai';

export const DEFAULT_CHAT_PORT = 3200;
export const DEFAULT_MCP_URL = 'http://localhost:3100/mcp';
// A turn ends with a message to the user when the model has not answered
// within this time (gpt-5-mini went silent for 10 minutes on large kitchens).
export const DEFAULT_TURN_TIMEOUT_MS = 5 * 60_000;
const CHAT_ROLES = ['user', 'assistant'] as const;

export class ChatRequestError extends Error {}

export type ChatProvider = 'mistral' | 'anthropic' | 'google' | 'azure';

export interface ChatModel {
  provider: ChatProvider;
  modelId: string;
  baseUrl?: string;
  chatCompletions?: boolean;
}

// Deployments on the HI Azure AI Foundry resource, reached through its OpenAI
// v1 endpoint: the CLI name is the deployment name, and every gpt-* name is a
// deployment there. A deployment without a reasoning effort runs at its
// Foundry default. mistral-large-3 is served from the Foundry resource, so it
// is an exception to the mistral provider. A deployment on another Foundry
// resource names that resource's OpenAI v1 endpoint as its baseUrl.
export const FOUNDRY_BASE_URL =
  'https://dfhifoundrysweden.services.ai.azure.com/openai/v1';
export const FOUNDRY_DEPLOYMENTS: Record<
  string,
  { reasoningEffort?: string; baseUrl?: string }
> = {
  'gpt-5-mini': { reasoningEffort: 'high' },
  'gpt-5.4-mini': { reasoningEffort: 'high' },
  'gpt-6-astra': {},
  'gpt-6.1-sol': {
    baseUrl: 'https://controller-mes-resource.services.ai.azure.com/openai/v1',
  },
  'mistral-large-3': {},
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

export const resolveChatModel = (requested: string | undefined): ChatModel => {
  // Provider names and model ids are matched case-insensitively (`Mistral-Large-3`),
  // and the resolved model id is lowercased, since every provider model id is lowercase.
  const name = requested ?? 'mistral';
  const lower = name.toLowerCase();
  if (Object.hasOwn(FOUNDRY_DEPLOYMENTS, lower) || lower.startsWith('gpt-')) {
    return {
      provider: 'azure',
      modelId: lower,
      baseUrl: FOUNDRY_DEPLOYMENTS[lower]?.baseUrl ?? FOUNDRY_BASE_URL,
      chatCompletions: lower === 'mistral-large-3',
    };
  }
  for (const provider of Object.keys(
    PROVIDER_MODEL_ALIASES
  ) as ChatProvider[]) {
    const modelId = PROVIDER_MODEL_ALIASES[provider][lower];
    if (modelId) {
      return { provider, modelId };
    }
  }
  if (lower.startsWith('mistral')) {
    return { provider: 'mistral', modelId: lower };
  }
  if (lower.startsWith('claude')) {
    return { provider: 'anthropic', modelId: lower };
  }
  if (lower.startsWith('gemini-')) {
    return { provider: 'google', modelId: lower };
  }
  throw new ChatRequestError(
    `Unknown chat provider or model "${name}" - supported: mistral, mistral-medium, mistral-large, mistral-large-4, anthropic, claude, google, gemini, gemini-pro, gemini-flash, azure, mistral-large-3, or a full gpt-*/mistral-*/claude-*/gemini-* model id`
  );
};

export interface ChatMessage {
  role: (typeof CHAT_ROLES)[number];
  content: string;
  images?: string[];
}

// The prompts of the planner (getExternalObjectAgentPrompts), which the page
// sends with every request: the system prompt of the chat, and the text of a
// user message that carries images but no text.
export interface ChatPrompts {
  systemPrompt: string;
  imagePrompt: string;
}

// Inline image data only: the AI SDK downloads an image given as a URL itself.
const IMAGE_DATA_URL =
  /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+=*$/;

// Models of the other providers known to read images; Anthropic and Google
// models and the gpt-* deployments on the Foundry resource all do. Any other
// model id gets no image input, so does an Azure deployment named with
// HI_CHAT_MODEL that is not in this list.
export const IMAGE_INPUT_MODELS = [
  'mistral-large-latest',
  'mistral-medium-latest',
  'mistral-large-3',
  'mistral-large-4-0',
  'gpt-4o',
  'gpt-5-mini',
  'gpt-5.4-mini',
  'gpt-6-astra',
];

export const readsImages = (
  provider: ChatProvider,
  modelId: string,
  foundry = false
) =>
  provider === 'anthropic' ||
  provider === 'google' ||
  (foundry && modelId.startsWith('gpt-')) ||
  IMAGE_INPUT_MODELS.includes(modelId);

export interface ChatConfig {
  port: number;
  provider: ChatProvider;
  apiToken: string | undefined;
  modelId: string;
  imageInput: boolean;
  azureResourceName: string | undefined;
  azureBaseUrl: string | undefined;
  // the azure model is reached through the Chat Completions API instead of the Responses API
  azureChatCompletions: boolean;
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
    imageInput: readsImages(
      chatModel.provider,
      modelId,
      chatModel.baseUrl !== undefined
    ),
    azureResourceName: env.AZURE_RESOURCE_NAME || undefined,
    azureBaseUrl: chatModel.baseUrl,
    azureChatCompletions: chatModel.chatCompletions === true,
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
        ? FOUNDRY_DEPLOYMENTS[modelId]?.reasoningEffort
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

export const parseChatPrompts = (body: unknown): ChatPrompts => {
  const { prompts } = body as { prompts?: unknown };
  const { systemPrompt, imagePrompt } = (prompts ?? {}) as {
    systemPrompt?: unknown;
    imagePrompt?: unknown;
  };
  if (
    typeof systemPrompt !== 'string' ||
    !systemPrompt.trim() ||
    typeof imagePrompt !== 'string' ||
    !imagePrompt.trim()
  ) {
    throw new ChatRequestError(
      "Chat request requires prompts - the systemPrompt and imagePrompt of the planner's getExternalObjectAgentPrompts()"
    );
  }
  return { systemPrompt, imagePrompt };
};

export const toModelMessages = (
  messages: ChatMessage[],
  imagePrompt: string
): ModelMessage[] =>
  messages.map(({ role, content, images }) =>
    images?.length
      ? {
          role: 'user',
          content: [
            { type: 'text', text: content.trim() || imagePrompt },
            ...images.map((image) => ({
              type: 'file' as const,
              data: image,
              mediaType: image.slice('data:'.length, image.indexOf(';')),
            })),
          ],
        }
      : { role, content }
  );
