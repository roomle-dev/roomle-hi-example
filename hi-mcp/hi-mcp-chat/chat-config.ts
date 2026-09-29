export const DEFAULT_CHAT_PORT = 3200;
export const DEFAULT_MCP_URL = 'http://localhost:3100/mcp';
const CHAT_ROLES = ['user', 'assistant'] as const;

export class ChatRequestError extends Error {}

export type ChatProvider = 'mistral' | 'anthropic' | 'azure';

export interface ChatModel {
  provider: ChatProvider;
  modelId: string;
}

// CLI provider names (npm start <provider>) resolved to a provider and model.
// Full model ids pass through: mistral-* and claude-* ids map to their
// provider; azure deployments are user-named and come via HI_CHAT_MODEL.
export const PROVIDER_MODEL_ALIASES: Record<ChatProvider, Record<string, string>> = {
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
  azure: {
    azure: 'gpt-4o',
    openai: 'gpt-4o',
  },
};

export const resolveChatModel = (requested: string | undefined): ChatModel => {
  const name = requested ?? 'mistral';
  for (const provider of Object.keys(PROVIDER_MODEL_ALIASES) as ChatProvider[]) {
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
  throw new ChatRequestError(
    `Unknown chat provider or model "${name}" - supported: mistral, mistral-medium, mistral-large, anthropic, claude, azure, or a full mistral-*/claude-* model id`,
  );
};

export interface ChatMessage {
  role: (typeof CHAT_ROLES)[number];
  content: string;
}

export interface ChatConfig {
  port: number;
  provider: ChatProvider;
  apiToken: string | undefined;
  modelId: string;
  azureResourceName: string | undefined;
  mcpUrl: string;
  pageOrigins: string[];
}

export const getChatConfig = (env: NodeJS.ProcessEnv): ChatConfig => {
  const chatModel = resolveChatModel(env.HI_CHAT_PROVIDER);
  return {
    port: Number(env.HI_CHAT_PORT) || DEFAULT_CHAT_PORT,
    provider: chatModel.provider,
    apiToken: env.HI_CHAT_TOKEN || undefined,
    // HI_CHAT_MODEL overrides the resolved model id (e.g. an Azure deployment
    // name) without changing the provider
    modelId: env.HI_CHAT_MODEL || chatModel.modelId,
    azureResourceName: env.AZURE_RESOURCE_NAME || undefined,
    mcpUrl: env.HI_MCP_URL || DEFAULT_MCP_URL,
    pageOrigins: env.HI_CHAT_PAGE_ORIGINS
      ? env.HI_CHAT_PAGE_ORIGINS.split(',')
          .map((origin) => origin.trim())
          .filter(Boolean)
      : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  };
};

export const parseChatMessages = (body: unknown): ChatMessage[] => {
  const { messages } = body as { messages?: unknown };
  if (!Array.isArray(messages)) {
    throw new ChatRequestError('Request body must be JSON with a messages array');
  }
  return messages.map((message: unknown) => {
    if (typeof message !== 'object' || message === null) {
      throw new ChatRequestError('Each message must be an object with role and content');
    }
    const { role, content } = message as { role?: unknown; content?: unknown };
    if (typeof role !== 'string' || !CHAT_ROLES.includes(role as ChatMessage['role'])) {
      throw new ChatRequestError(`Invalid message role: ${role}`);
    }
    if (typeof content !== 'string') {
      throw new ChatRequestError('Message content must be a string');
    }
    return { role: role as ChatMessage['role'], content };
  });
};
