export const DEFAULT_CHAT_PORT = 3200;
export const DEFAULT_MODEL_ID = 'mistral-large-latest';
export const DEFAULT_MCP_URL = 'http://localhost:3100/mcp';
// Provider names accepted on the command line (npm start <provider>),
// resolved to Mistral model ids. Full model ids pass through unchanged.
export const MODEL_ALIASES = {
  mistral: DEFAULT_MODEL_ID,
  'mistral-large': 'mistral-large-latest',
  'mistral-medium': 'mistral-medium-latest',
} as const;
const CHAT_ROLES = ['user', 'assistant'] as const;

export const resolveModelId = (requested: string | undefined): string => {
  if (!requested) {
    return DEFAULT_MODEL_ID;
  }
  return MODEL_ALIASES[requested as keyof typeof MODEL_ALIASES] ?? requested;
};

export class ChatRequestError extends Error {}

export interface ChatMessage {
  role: (typeof CHAT_ROLES)[number];
  content: string;
}

export interface ChatConfig {
  port: number;
  apiToken: string | undefined;
  modelId: string;
  mcpUrl: string;
  pageOrigins: string[];
}

export const getChatConfig = (env: NodeJS.ProcessEnv): ChatConfig => ({
  port: Number(env.HI_CHAT_PORT) || DEFAULT_CHAT_PORT,
  apiToken: env.HI_CHAT_TOKEN || undefined,
  modelId: resolveModelId(env.HI_CHAT_MODEL),
  mcpUrl: env.HI_MCP_URL || DEFAULT_MCP_URL,
  pageOrigins: env.HI_CHAT_PAGE_ORIGINS
    ? env.HI_CHAT_PAGE_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
});

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
