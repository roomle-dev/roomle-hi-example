import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  getChatConfig,
  parseChatMessages,
  resolveModelId,
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
    expect(config.modelId).toBe('mistral-large-latest');
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
      HI_CHAT_MODEL: 'mistral-small-latest',
      HI_MCP_URL: 'http://localhost:3101/mcp',
      HI_CHAT_PAGE_ORIGINS: 'http://localhost:3101, https://example.com',
    });
    expect(config.port).toBe(3300);
    expect(config.apiToken).toBe('secret');
    expect(config.modelId).toBe('mistral-small-latest');
    expect(config.mcpUrl).toBe('http://localhost:3101/mcp');
    expect(config.pageOrigins).toEqual([
      'http://localhost:3101',
      'https://example.com',
    ]);
  });

  it('resolves model aliases and passes full model ids through', () => {
    expect(resolveModelId(undefined)).toBe('mistral-large-latest');
    expect(resolveModelId('mistral')).toBe('mistral-large-latest');
    expect(resolveModelId('mistral-large')).toBe('mistral-large-latest');
    expect(resolveModelId('mistral-medium')).toBe('mistral-medium-latest');
    expect(resolveModelId('mistral-small-latest')).toBe('mistral-small-latest');
    expect(resolveModelId('mistral-medium-3-5')).toBe('mistral-medium-3-5');
    expect(resolveModelId('mistral-medium-latest')).toBe(
      'mistral-medium-latest',
    );
    expect(getChatConfig({ HI_CHAT_MODEL: 'mistral-medium' }).modelId).toBe(
      'mistral-medium-latest',
    );
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
