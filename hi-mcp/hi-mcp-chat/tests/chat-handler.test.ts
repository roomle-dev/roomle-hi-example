import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  getChatConfig,
  parseChatMessages,
  resolveChatModel,
} from '../chat-config';
import { createChatRequestHandler, type StreamChat } from '../chat-handler';

const PAGE_ORIGIN = 'http://localhost:3000';

const startServer = (env: NodeJS.ProcessEnv, streamChat: StreamChat) =>
  new Promise<{ server: Server; url: string }>((resolve, reject) => {
    const server = createServer(
      createChatRequestHandler(getChatConfig(env), streamChat),
    );
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address !== 'object' || address === null) {
        reject(new Error('no listen address'));
        return;
      }
      resolve({ server, url: `http://127.0.0.1:${address.port}` });
    });
  });

const withServer = async (
  env: NodeJS.ProcessEnv,
  streamChat: StreamChat,
  run: (url: string) => Promise<void>,
) => {
  const { server, url } = await startServer(env, streamChat);
  try {
    await run(url);
  } finally {
    server.close();
  }
};

describe('getChatConfig', () => {
  it('falls back to the defaults', () => {
    const config = getChatConfig({});
    expect(config.port).toBe(3200);
    expect(config.apiToken).toBeUndefined();
    expect(config.provider).toBe('mistral');
    expect(config.modelId).toBe('mistral-large-latest');
    expect(config.azureResourceName).toBeUndefined();
    expect(config.azureBaseUrl).toBeUndefined();
    expect(config.mcpUrl).toBe('http://localhost:3100/mcp');
    expect(config.pageOrigins).toEqual([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ]);
  });

  it('reads the overrides from the environment', () => {
    const config = getChatConfig({
      HI_CHAT_PORT: '3300',
      HI_CHAT_TOKEN: 'secret',
      HI_CHAT_PROVIDER: 'claude',
      HI_CHAT_MODEL: 'claude-opus-4-1',
      AZURE_RESOURCE_NAME: 'my-resource',
      HI_MCP_URL: 'http://localhost:3101/mcp',
      HI_CHAT_PAGE_ORIGINS: 'http://localhost:3101, https://example.com',
    });
    expect(config.port).toBe(3300);
    expect(config.apiToken).toBe('secret');
    expect(config.provider).toBe('anthropic');
    expect(config.modelId).toBe('claude-opus-4-1');
    expect(config.azureResourceName).toBe('my-resource');
    expect(config.mcpUrl).toBe('http://localhost:3101/mcp');
    expect(config.pageOrigins).toEqual([
      'http://localhost:3101',
      'https://example.com',
    ]);
  });

  it('resolves providers, aliases, and full model ids', () => {
    expect(resolveChatModel(undefined)).toEqual({
      provider: 'mistral',
      modelId: 'mistral-large-latest',
    });
    expect(resolveChatModel('mistral-medium')).toEqual({
      provider: 'mistral',
      modelId: 'mistral-medium-latest',
    });
    expect(resolveChatModel('mistral-small-latest')).toEqual({
      provider: 'mistral',
      modelId: 'mistral-small-latest',
    });
    expect(resolveChatModel('claude')).toEqual({
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-5',
    });
    expect(resolveChatModel('claude-opus-4-1')).toEqual({
      provider: 'anthropic',
      modelId: 'claude-opus-4-1',
    });
    expect(resolveChatModel('gemini')).toEqual({
      provider: 'google',
      modelId: 'gemini-2.5-pro',
    });
    expect(resolveChatModel('gemini-flash')).toEqual({
      provider: 'google',
      modelId: 'gemini-2.5-flash',
    });
    expect(resolveChatModel('gemini-3-pro-preview')).toEqual({
      provider: 'google',
      modelId: 'gemini-3-pro-preview',
    });
    expect(resolveChatModel('azure')).toEqual({
      provider: 'azure',
      modelId: 'gpt-4o',
    });
    expect(() => resolveChatModel('gpt-4o')).toThrow(/Unknown chat provider/);
    expect(() => resolveChatModel('geminix')).toThrow(/Unknown chat provider/);
    expect(getChatConfig({ HI_CHAT_PROVIDER: 'claude' }).modelId).toBe(
      'claude-sonnet-4-5',
    );
    expect(
      getChatConfig({ HI_CHAT_PROVIDER: 'azure', HI_CHAT_MODEL: 'my-deployment' })
        .modelId,
    ).toBe('my-deployment');
  });

  it('resolves the Foundry deployments to the Foundry endpoint', () => {
    const foundryBaseUrl = 'https://dfhifoundrysweden.services.ai.azure.com/openai/v1';
    expect(resolveChatModel('gpt-5-mini')).toEqual({
      provider: 'azure',
      modelId: 'gpt-5-mini',
      baseUrl: foundryBaseUrl,
    });
    expect(resolveChatModel('gpt-5.4-mini')).toEqual({
      provider: 'azure',
      modelId: 'gpt-5.4-mini',
      baseUrl: foundryBaseUrl,
    });
    expect(resolveChatModel('openai')).toEqual({
      provider: 'azure',
      modelId: 'gpt-4o',
    });
    const config = getChatConfig({ HI_CHAT_PROVIDER: 'gpt-5.4-mini' });
    expect(config.provider).toBe('azure');
    expect(config.modelId).toBe('gpt-5.4-mini');
    expect(config.azureBaseUrl).toBe(foundryBaseUrl);
    expect(
      getChatConfig({ HI_CHAT_PROVIDER: 'gpt-5-mini', HI_CHAT_MODEL: 'my-gpt4o-deployment' })
        .modelId,
    ).toBe('gpt-5-mini');
    expect(getChatConfig({ HI_CHAT_PROVIDER: 'azure' }).azureBaseUrl).toBeUndefined();
  });
});

describe('parseChatMessages', () => {
  it('keeps valid messages', () => {
    expect(
      parseChatMessages({
        messages: [
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: 'hello' },
        ],
      }),
    ).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ]);
  });

  it('rejects bodies without a messages array', () => {
    expect(() => parseChatMessages({})).toThrow(/messages array/);
  });

  it('rejects roles outside the user/assistant conversation', () => {
    expect(() =>
      parseChatMessages({ messages: [{ role: 'system', content: 'nope' }] }),
    ).toThrow(/Invalid message role/);
  });

  it('rejects non-string content', () => {
    expect(() =>
      parseChatMessages({ messages: [{ role: 'user', content: 42 }] }),
    ).toThrow(/content must be a string/);
  });
});

describe('chat request handler', () => {
  it('answers /health with ok', async () => {
    await withServer({}, vi.fn(), async (url) => {
      const response = await fetch(`${url}/health`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('ok');
    });
  });

  it('rejects unknown paths', async () => {
    await withServer({}, vi.fn(), async (url) => {
      const response = await fetch(`${url}/nope`);
      expect(response.status).toBe(404);
    });
  });

  it('rejects POST /chat without a configured token', async () => {
    await withServer({}, vi.fn(), async (url) => {
      const response = await fetch(`${url}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: PAGE_ORIGIN },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
      });
      expect(response.status).toBe(503);
      expect(await response.text()).toMatch(/HI_CHAT_TOKEN/);
    });
  });

  it('answers CORS preflight for allowed origins only', async () => {
    await withServer({ HI_CHAT_TOKEN: 'secret' }, vi.fn(), async (url) => {
      const allowed = await fetch(`${url}/chat`, {
        method: 'OPTIONS',
        headers: { Origin: PAGE_ORIGIN },
      });
      expect(allowed.status).toBe(204);
      expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe(
        PAGE_ORIGIN,
      );

      const rejected = await fetch(`${url}/chat`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil.example' },
      });
      expect(rejected.status).toBe(403);
      expect(rejected.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });
  });

  it('rejects POST /chat from disallowed origins', async () => {
    await withServer({ HI_CHAT_TOKEN: 'secret' }, vi.fn(), async (url) => {
      const response = await fetch(`${url}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
      });
      expect(response.status).toBe(403);
    });
  });

  it('rejects invalid chat requests with 400', async () => {
    await withServer({ HI_CHAT_TOKEN: 'secret' }, vi.fn(), async (url) => {
      const noMessages = await fetch(`${url}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      expect(noMessages.status).toBe(400);

      const nullBody = await fetch(`${url}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'null',
      });
      expect(nullBody.status).toBe(400);

      const malformedJson = await fetch(`${url}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{oops',
      });
      expect(malformedJson.status).toBe(400);

      const badRole = await fetch(`${url}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'tool', content: 'x' }] }),
      });
      expect(badRole.status).toBe(400);
    });
  });

  it('streams the assistant answer with CORS headers', async () => {
    const streamChat = vi.fn(async () => new Response('hello there'));
    await withServer({ HI_CHAT_TOKEN: 'secret' }, streamChat, async (url) => {
      const response = await fetch(`${url}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: PAGE_ORIGIN },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
      });
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('hello there');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        PAGE_ORIGIN,
      );
      expect(streamChat).toHaveBeenCalledWith([
        { role: 'user', content: 'hi' },
      ]);
    });
  });

  it('relays stream errors as 500', async () => {
    const streamChat = vi.fn(async () => {
      throw new Error('MCP server unreachable');
    });
    await withServer({ HI_CHAT_TOKEN: 'secret' }, streamChat, async (url) => {
      const response = await fetch(`${url}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
      });
      expect(response.status).toBe(500);
      expect(await response.text()).toMatch(/MCP server unreachable/);
    });
  });
});
