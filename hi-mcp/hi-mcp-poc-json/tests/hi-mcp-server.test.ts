import { describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createHiMcpServer } from '../hi-mcp-server';
import type { PageBridge } from '../page-bridge';
import { SNAPSHOT_CALL_TIMEOUT_MS } from '../page-bridge';

const EXPECTED_TOOLS = [
  'create-or-replace-groups',
  'find-attributes',
  'get-authoring-rules',
  'get-order-data',
  'get-plan-context',
  'get-plan-images',
  'get-price',
  'update-attribute',
];

const createMockBridge = (
  implementation?: (tool: string, args: Record<string, unknown>, timeoutMs: number) => unknown,
): PageBridge => {
  const call = vi.fn(
    implementation ??
      (async () => null),
  );
  return { call } as unknown as PageBridge;
};

const connectClient = async (bridge: PageBridge): Promise<Client> => {
  const server = createHiMcpServer(bridge);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientTransport);
  return client;
};

const textOf = (result: unknown): string => {
  const content =
    (result as { content?: { type: string; text?: string }[] }).content ?? [];
  return content
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('');
};

describe('hi-mcp-server tool registration', () => {
  it('exposes exactly the eight expected tools', async () => {
    const client = await connectClient(createMockBridge());
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(EXPECTED_TOOLS);
  });
});

describe('hi-mcp-server tool calls', () => {
  it('answers get-authoring-rules without a bridge call', async () => {
    const bridge = createMockBridge();
    const client = await connectClient(bridge);
    const result = await client.callTool({ name: 'get-authoring-rules', arguments: {} });
    expect(bridge.call).not.toHaveBeenCalled();
    expect(textOf(result)).toMatch(/^Authoring rules for pos groups:/);
    expect(textOf(result)).toContain('Never author a position');
  });

  it('explains positioning with repositioningData in the verified rotation sense', async () => {
    const client = await connectClient(createMockBridge());
    const text = textOf(
      await client.callTool({ name: 'get-authoring-rules', arguments: {} }),
    );
    expect(text).toContain('counter-clockwise as seen from above');
    expect(text).toContain("posRotationY = the wall's facingRotationY");
    expect(text).toContain('right back 270');
    expect(text).not.toMatch(/\bplace-group\b/);
  });

  it('carries the one-group principle and the docking examples', async () => {
    const client = await connectClient(createMockBridge());
    const text = textOf(
      await client.callTool({ name: 'get-authoring-rules', arguments: {} }),
    );
    expect(text).toContain('One kitchen is one group');
    // docking to the left, spelled out as a payload snippet
    expect(text).toContain(
      '{ "ownDockingVector": "LeftBottom", "dockedRoots": [{ "id": "B", "dockingVector": "RightBottom"',
    );
    // the complete L-shaped corner kitchen example, anchored on the corner article
    expect(text).toContain('"rootId": "c1"');
    expect(text).toContain('Example 5');
    // the corner point offset: compensated root-locally, verified via position.pos
    expect(text).toContain('cornerPoint');
    expect(text).toContain('"rootRelPos": [261, 0, 0]');
    expect(text).toContain('posGroup shifted by (P - position.pos)');
  });

  it('relays get-plan-context with its arguments and returns the JSON text', async () => {
    const bridge = createMockBridge(async () => ({ rooms: [], articles: [] }));
    const client = await connectClient(bridge);
    const result = await client.callTool({
      name: 'get-plan-context',
      arguments: { include: ['articles'] },
    });
    expect(bridge.call).toHaveBeenCalledWith('get-plan-context', {
      include: ['articles'],
    });
    expect(JSON.parse(textOf(result))).toEqual({ rooms: [], articles: [] });
  });

  it('uses the snapshot timeout for the expensive tools', async () => {
    const bridge = createMockBridge(async () => null);
    const client = await connectClient(bridge);
    await client.callTool({
      name: 'create-or-replace-groups',
      arguments: { posGroups: [{ roots: [{ id: 'u1', articleId: 'a' }] }] },
    });
    expect(bridge.call).toHaveBeenCalledWith(
      'create-or-replace-groups',
      { posGroups: [{ roots: [{ id: 'u1', articleId: 'a' }] }] },
      SNAPSHOT_CALL_TIMEOUT_MS,
    );

    await client.callTool({ name: 'get-order-data', arguments: {} });
    expect(bridge.call).toHaveBeenCalledWith(
      'get-order-data',
      {},
      SNAPSHOT_CALL_TIMEOUT_MS,
    );

    await client.callTool({ name: 'get-price', arguments: {} });
    expect(bridge.call).toHaveBeenCalledWith('get-price', {});
  });

  it('returns an error result when the bridge fails', async () => {
    const bridge = createMockBridge(async () => {
      throw new Error('No HI page connected.');
    });
    const client = await connectClient(bridge);
    const result = await client.callTool({ name: 'get-price', arguments: {} });
    expect((result as { isError?: boolean }).isError).toBe(true);
    expect(textOf(result)).toContain('No HI page connected.');
  });

  it('shapes get-plan-images into MCP image content without the data-url prefix', async () => {
    const bridge = createMockBridge(async () => ({
      perspectiveImage: 'data:image/png;base64,AAA=',
      topImage: 'data:image/png;base64,BBB=',
    }));
    const client = await connectClient(bridge);
    const result = await client.callTool({ name: 'get-plan-images', arguments: {} });
    const content = (result as { content: unknown[] }).content;
    expect(content).toEqual([
      { type: 'image', data: 'AAA=', mimeType: 'image/png' },
      { type: 'image', data: 'BBB=', mimeType: 'image/png' },
    ]);
  });

  it('reports when the plan has no images', async () => {
    const bridge = createMockBridge(async () => ({}));
    const client = await connectClient(bridge);
    const result = await client.callTool({ name: 'get-plan-images', arguments: {} });
    expect(JSON.parse(textOf(result))).toEqual({ error: 'No images available' });
  });
});
