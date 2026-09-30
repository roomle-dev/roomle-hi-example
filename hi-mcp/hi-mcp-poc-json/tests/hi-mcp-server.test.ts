import { describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createHiMcpServer } from '../hi-mcp-server';
import { PageBridge } from '../page-bridge';
import type { PlannerApi } from '../planner-api';
import { createPlannerApi } from '../planner-api';
import { attachPage } from './fake-page-socket';

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

const createMockPlannerApi = (
  overrides: Partial<PlannerApi['extended']> = {},
): PlannerApi => ({
  extended: {
    getExternalObjectPlanContext: vi.fn(async () => ({})),
    loadExternalObjectGroupLayout: vi.fn(async () => []),
    updateExternalObjectGroupAttribute: vi.fn(async () => undefined),
    fetchPrice: vi.fn(async () => null),
    getExternalObjectSnapshot: vi.fn(async () => ({})),
    getExternalObjectGroups: vi.fn(async () => []),
    ...overrides,
  },
});

const connectClient = async (plannerApi: PlannerApi): Promise<Client> => {
  const server = createHiMcpServer(plannerApi);
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
    const client = await connectClient(createMockPlannerApi());
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(EXPECTED_TOOLS);
  });
});

describe('hi-mcp-server tool calls', () => {
  it('answers get-authoring-rules without a planner call', async () => {
    const plannerApi = createMockPlannerApi();
    const client = await connectClient(plannerApi);
    const result = await client.callTool({ name: 'get-authoring-rules', arguments: {} });
    for (const method of Object.values(plannerApi.extended)) {
      expect(method).not.toHaveBeenCalled();
    }
    expect(textOf(result)).toMatch(/^Authoring rules for pos groups:/);
    expect(textOf(result)).toContain('Never author a position');
  });

  it('explains positioning with placement in the verified rotation sense', async () => {
    const client = await connectClient(createMockPlannerApi());
    const text = textOf(
      await client.callTool({ name: 'get-authoring-rules', arguments: {} }),
    );
    expect(text).toContain(
      'placement: { posGroup: [x, y, z], posRotationY, rootId? } positions a new group',
    );
    expect(text).toContain('counter-clockwise as seen from above');
    expect(text).toContain("posRotationY = the wall's facingRotationY");
    expect(text).toContain('right back 270');
    expect(text).not.toMatch(/\bplace-group\b/);
  });

  it('carries the one-group principle and the docking examples', async () => {
    const client = await connectClient(createMockPlannerApi());
    const text = textOf(
      await client.callTool({ name: 'get-authoring-rules', arguments: {} }),
    );
    expect(text).toContain('One kitchen is one group');
    // docking to the left, spelled out as a payload snippet
    expect(text).toContain(
      '{ "ownDockingVector": "LeftBottom", "dockedRoots": [{ "id": "B", "dockingVector": "RightBottom"',
    );
    // the complete L-shaped corner kitchen example, placed at the room corner point
    expect(text).toContain(
      '"placement": { "posGroup": [<corner x>, 0, <corner z>], "posRotationY": 270 }',
    );
    expect(text).toContain('Example 5');
  });

  it('never tells the agent how the server positions a group internally', async () => {
    const client = await connectClient(createMockPlannerApi());
    const rules = textOf(
      await client.callTool({ name: 'get-authoring-rules', arguments: {} }),
    );
    const { tools } = await client.listTools();
    const served = [client.getInstructions() ?? '', rules, JSON.stringify(tools)];
    for (const internal of [
      'repositioningData',
      'rootRelPos',
      'cornerPoint',
      'blind zone',
      '261',
    ]) {
      expect(served.join('\n')).not.toContain(internal);
    }
  });

  it('runs get-plan-context against the planner API and returns the JSON text', async () => {
    const plannerApi = createMockPlannerApi({
      getExternalObjectPlanContext: vi.fn(async () => ({ rooms: [], articles: [] })),
    });
    const client = await connectClient(plannerApi);
    const result = await client.callTool({
      name: 'get-plan-context',
      arguments: { include: ['articles'] },
    });
    expect(plannerApi.extended.getExternalObjectPlanContext).toHaveBeenCalledWith([
      'articles',
    ]);
    expect(JSON.parse(textOf(result))).toEqual({ rooms: [], articles: [] });
  });

  it('returns an error result when a planner call fails', async () => {
    const plannerApi = createMockPlannerApi({
      fetchPrice: vi.fn(async () => {
        throw new Error('No HI page connected.');
      }),
    });
    const client = await connectClient(plannerApi);
    const result = await client.callTool({ name: 'get-price', arguments: {} });
    expect((result as { isError?: boolean }).isError).toBe(true);
    expect(textOf(result)).toContain('No HI page connected.');
  });

  it('rejects an invalid payload in the server without loading anything', async () => {
    const plannerApi = createMockPlannerApi();
    const client = await connectClient(plannerApi);
    const result = await client.callTool({
      name: 'create-or-replace-groups',
      arguments: { posGroups: [{ roots: [] }] },
    });
    expect((result as { isError?: boolean }).isError).toBe(true);
    expect(textOf(result)).toContain('Invalid pos groups - nothing was loaded');
    expect(textOf(result)).toContain('needs a non-empty roots array');
    expect(plannerApi.extended.loadExternalObjectGroupLayout).not.toHaveBeenCalled();
  });

  it('shapes get-plan-images into MCP image content without the data-url prefix', async () => {
    const plannerApi = createMockPlannerApi({
      getExternalObjectSnapshot: vi.fn(async () => ({
        perspectiveImage: 'data:image/png;base64,AAA=',
        topImage: 'data:image/png;base64,BBB=',
      })),
    });
    const client = await connectClient(plannerApi);
    const result = await client.callTool({ name: 'get-plan-images', arguments: {} });
    const content = (result as { content: unknown[] }).content;
    expect(content).toEqual([
      { type: 'image', data: 'AAA=', mimeType: 'image/png' },
      { type: 'image', data: 'BBB=', mimeType: 'image/png' },
    ]);
  });

  it('reports when the plan has no images', async () => {
    const client = await connectClient(createMockPlannerApi());
    const result = await client.callTool({ name: 'get-plan-images', arguments: {} });
    expect(JSON.parse(textOf(result))).toEqual({ error: 'No images available' });
  });
});

describe('hi-mcp-server through the page bridge', () => {
  it('runs create-or-replace-groups as planner calls the page executes', async () => {
    const bridge = new PageBridge();
    const socket = attachPage(bridge);
    let loaded = false;
    socket.respond = (method, args) => {
      if (method === 'loadExternalObjectGroupLayout') {
        loaded = true;
        return [{ id: 'g1' }];
      }
      const [include] = args as [string[]];
      if (include.includes('articles')) {
        return { articles: [{ articleId: 'a1' }] };
      }
      return { groups: loaded ? [{ id: 'g1', position: { pos: [0, 0, 0] } }] : [] };
    };
    const client = await connectClient(createPlannerApi(bridge));
    const roots = [{ id: 'u1', articleId: 'a1' }];
    const posGroups = [
      { roots, placement: { posGroup: [0, 0, 0], posRotationY: 0 } },
    ];

    const result = await client.callTool({
      name: 'create-or-replace-groups',
      arguments: { posGroups },
    });

    const calls = socket.sent.map((data) => JSON.parse(data));
    expect(calls.map((call) => call.method)).toEqual([
      'getExternalObjectPlanContext',
      'getExternalObjectPlanContext',
      'loadExternalObjectGroupLayout',
      'getExternalObjectPlanContext',
    ]);
    expect(calls[2].args).toEqual([
      {
        posGroups: [
          {
            roots,
            repositioningData: { posGroup: [0, 0, 0], posRotationY: 0, rootId: 'u1' },
          },
        ],
      },
      'posGroups',
      { reason: 'adjusted' },
    ]);
    expect(JSON.parse(textOf(result))).toEqual({
      loaded: [{ id: 'g1' }],
      groups: [{ id: 'g1', position: { pos: [0, 0, 0] } }],
    });
  });
});
