import { describe, expect, it, vi } from 'vitest';
import { HiMcpContainer } from '../src/container';

const mocks = vi.hoisted(() => ({
  starts: vi.fn(),
  fetch: vi.fn(
    async (_request: Request, _port: number) => new Response('from-container')
  ),
}));

vi.mock('@cloudflare/containers', () => ({
  Container: class {
    envVars: Record<string, string> = {};
    constructor(_ctx: unknown, _env: unknown) {}
    async startAndWaitForPorts() {
      mocks.starts({ ...this.envVars });
    }
    async containerFetch(request: Request, port: number) {
      await this.startAndWaitForPorts();
      return mocks.fetch(request, port);
    }
  },
}));

const createContainer = (storeUrl: string) =>
  new HiMcpContainer({} as never, { HI_MCP_STORE_URL: storeUrl } as never);

describe('container store link', () => {
  it.each([
    ['?session=check', 'check'],
    ['', 'default'],
    ['?session=first%20%26%20second', 'first & second'],
  ])(
    'passes the matching page session before startup (%s)',
    async (query, session) => {
      const container = createContainer(
        'https://www.roomle.com/t/ligna-store-test/?store.stage=INT&mcp_server=https://mcp.example&id=plan&mcp_session=stale'
      );
      const request = new Request(`https://mcp.example/mcp${query}`, {
        method: 'POST',
        body: '{}',
      });
      mocks.starts.mockClear();
      mocks.fetch.mockClear();
      const response = await container.fetch(request);
      expect(await response.text()).toBe('from-container');
      expect(mocks.starts).toHaveBeenCalledTimes(1);
      const env = mocks.starts.mock.calls[0][0];
      const url = new URL(env.HI_MCP_STORE_URL);
      expect(url.searchParams.get('mcp_session')).toBe(session);
      expect(url.searchParams.get('store.stage')).toBe('INT');
      expect(url.searchParams.get('mcp_server')).toBe('https://mcp.example');
      expect(url.searchParams.get('id')).toBe('plan');
      expect(url.searchParams.has('model')).toBe(false);
      expect(url.searchParams.has('api_key')).toBe(false);
      expect(env.PORT).toBe('3000');
      expect(mocks.fetch).toHaveBeenCalledWith(request, 3000);
    }
  );

  it('uses the same session when a bridge reconnects', async () => {
    const container = createContainer(
      'https://www.roomle.com/?mcp_server=https://mcp.example'
    );
    await container.fetch(new Request('https://mcp.example/mcp?session=check'));
    await container.fetch(
      new Request('https://mcp.example/bridge?session=check')
    );
    const url = new URL(container.envVars!.HI_MCP_STORE_URL!);
    expect(url.searchParams.getAll('mcp_session')).toEqual(['check']);
  });

  it('starts without a configured store link', async () => {
    const container = createContainer('');
    await container.fetch(new Request('https://mcp.example/mcp?session=check'));
    expect(container.envVars!.HI_MCP_STORE_URL).toBe('');
  });
});
