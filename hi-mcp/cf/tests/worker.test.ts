import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/worker';

const containerFetch = vi.fn(
  async (_request: Request) => new Response('from-container', { status: 200 }),
);
const getByName = vi.fn(() => ({ fetch: containerFetch }));
const env = { HI_MCP: { getByName } } as never;

const fetchWorker = (url: string, init?: RequestInit): Promise<Response> =>
  worker.fetch!(new Request(url, init), env);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('worker routing', () => {
  it('forwards /mcp to the container of the default session', async () => {
    const response = await fetchWorker('https://hi-mcp-poc.test/mcp', {
      method: 'POST',
      body: '{"jsonrpc":"2.0"}',
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('from-container');
    expect(getByName).toHaveBeenCalledWith('default');
    expect(containerFetch).toHaveBeenCalledTimes(1);
    const forwarded = containerFetch.mock.calls[0]![0];
    expect(forwarded.url).toBe('https://hi-mcp-poc.test/mcp');
    expect(forwarded.method).toBe('POST');
  });

  it('forwards /bridge (the store page WebSocket upgrade path)', async () => {
    await fetchWorker('https://hi-mcp-poc.test/bridge');
    expect(containerFetch).toHaveBeenCalledTimes(1);
  });

  it('answers 404 for other paths without touching the container', async () => {
    const response = await fetchWorker('https://hi-mcp-poc.test/other');
    expect(response.status).toBe(404);
    expect(containerFetch).not.toHaveBeenCalled();
  });
});
