import { describe, expect, it, vi } from 'vitest';
import { HiMcpContainer } from '../src/container';

describe('container startup responses', () => {
  it.each([
    [
      'there is no container instance that can be provided to this durable object',
      503,
    ],
    ['you are requesting too many containers per second', 429],
    ['container port never became ready', 500],
  ])('returns the SDK response for %s', async (message, status) => {
    const start = vi.fn().mockRejectedValue(new Error(message));
    const container = Object.create(HiMcpContainer.prototype) as HiMcpContainer;
    Object.assign(container, {
      defaultPort: 3000,
      envVars: {
        HI_MCP_STORE_URL:
          'https://www.roomle.com/t/ligna-store-test/?mcp_server=https://mcp.example',
      },
      container: { running: false },
      state: { getState: async () => ({ status: 'stopped' }) },
      startAndWaitForPorts: start,
    });
    const request = new Request('https://mcp.example/mcp?session=check');

    const response = await container.fetch(request);

    expect(response.status).toBe(status);
    expect(await response.text()).not.toBe('');
    expect(start).toHaveBeenCalledExactlyOnceWith(3000, {
      abort: request.signal,
    });
    expect(
      new URL(container.envVars!.HI_MCP_STORE_URL!).searchParams.get(
        'mcp_session'
      )
    ).toBe('check');
  });
});
