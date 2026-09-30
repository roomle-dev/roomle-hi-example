import { describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createHiMcpServer } from '../hi-mcp-server';
import { PageBridge } from '../page-bridge';
import type { PlannerApi } from '../planner-api';
import { createPlannerApi } from '../planner-api';
import { attachPage } from './fake-page-socket';

const EXPECTED_TOOLS = [
  'change-group-attribute',
  'change-module-attribute',
  'create-or-replace-groups',
  'delete-group',
  'delete-root-module',
  'exchange-root-module',
  'find-attributes',
  'get-authoring-rules',
  'get-order-data',
  'get-plan-context',
  'get-plan-images',
  'get-price',
  'merge-article-into-group',
  'merge-groups',
  'place-group',
];

const createMockPlannerApi = (
  overrides: Partial<PlannerApi['extended']> = {},
): PlannerApi => ({
  extended: {
    getExternalObjectPlanContext: vi.fn(async () => ({})),
    loadExternalObjectGroupLayout: vi.fn(async () => []),
    externalObjectGroupOperation: vi.fn(async () => ({})),
    fetchPrice: vi.fn(async () => null),
    getExternalObjectSnapshot: vi.fn(async () => ({})),
    getExternalObjectGroups: vi.fn(async () => []),
    removeExternalObject: vi.fn(async () => undefined),
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
  it('exposes exactly the expected tools', async () => {
    const client = await connectClient(createMockPlannerApi());
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(EXPECTED_TOOLS);
  });
});

describe('hi-mcp-server tool calls', () => {
  it('points the agent to the command tools for editing an existing group', async () => {
    const client = await connectClient(createMockPlannerApi());
    const rules = textOf(
      await client.callTool({ name: 'get-authoring-rules', arguments: {} }),
    );
    const { tools } = await client.listTools();

    expect(client.getInstructions()).toContain(
      'Edit an existing group with the command tools',
    );
    expect(rules).toContain('To change an existing group, use the command tools');
    expect(rules).toContain('call merge-article-into-group');
    expect(
      tools.find((tool) => tool.name === 'merge-groups')?.description,
    ).toContain('nothing is moved and no docking is added');
  });

  it.each([
    ['change-module-attribute', { attributeId: 'front', value: 'white' }],
    ['change-group-attribute', { groupId: 'g1', value: 'white' }],
    ['delete-group', {}],
    ['delete-root-module', {}],
    ['merge-article-into-group', { groupId: 'g1', articleId: 'a1' }],
    ['exchange-root-module', { groupId: 'g1', rootModuleId: 'r1' }],
    ['merge-groups', { targetGroupId: 'g1', groupIds: [] }],
  ])(
    'rejects %s without a required argument before any planner call',
    async (name, args) => {
      const plannerApi = createMockPlannerApi();
      const client = await connectClient(plannerApi);

      const result = await client.callTool({ name, arguments: args });

      expect((result as { isError?: boolean }).isError).toBe(true);
      expect(textOf(result)).toContain('Input validation error');
      for (const method of Object.values(plannerApi.extended)) {
        expect(method).not.toHaveBeenCalled();
      }
    },
  );

  it('runs a command tool against the planner API and returns its result', async () => {
    const operationResult = {
      command: 'delete-root-module',
      groups: [{ id: 'g1' }],
      removedGroupIds: [],
    };
    const plannerApi = createMockPlannerApi({
      externalObjectGroupOperation: vi.fn(async () => operationResult),
    });
    const client = await connectClient(plannerApi);

    const result = await client.callTool({
      name: 'delete-root-module',
      arguments: { rootModuleId: 'r1' },
    });

    expect(plannerApi.extended.externalObjectGroupOperation).toHaveBeenCalledWith(
      'delete-root-module',
      { rootModuleId: 'r1' },
    );
    expect(JSON.parse(textOf(result))).toEqual(operationResult);
  });

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
    expect(text).toContain(
      'To move an existing group against a wall or into a room corner, call place-group',
    );
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
      'externalObjectGroupOperation',
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

  it('rejects an unknown wall label of place-group without a planner call', async () => {
    const plannerApi = createMockPlannerApi();
    const client = await connectClient(plannerApi);
    const result = await client.callTool({
      name: 'place-group',
      arguments: { groupId: 'g1', wall: 'north' },
    });
    expect((result as { isError?: boolean }).isError).toBe(true);
    expect(textOf(result)).toContain('Input validation error');
    for (const method of Object.values(plannerApi.extended)) {
      expect(method).not.toHaveBeenCalled();
    }
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

  it('runs place-group as planner calls the page executes', async () => {
    const bridge = new PageBridge();
    const socket = attachPage(bridge);
    const rightWall = {
      index: 1,
      side: 'right',
      start: [4000, 0, 0],
      end: [4000, 0, -3000],
      lengthMm: 3000,
      type: 'wall',
      facingRotationY: 270,
    };
    const attributes = [
      { id: 'b', value: 800 },
      { id: 't', value: 600 },
    ];
    const calculatedGroup = {
      id: 'g1',
      libraryId: 'lib-1',
      pos: [0, 0, 0],
      rotationY: 0,
      roots: [
        { id: 'u1', articleId: 'a1', articlePos: [0, 0, 0], rotationY: 0, attributes },
      ],
    };
    let loaded = false;
    socket.respond = (method) => {
      if (method === 'getExternalObjectGroups') {
        return [calculatedGroup];
      }
      if (method === 'loadExternalObjectGroupLayout') {
        loaded = true;
        return [{ id: 'g1' }];
      }
      return {
        rooms: { rooms: [{ walls: [rightWall] }] },
        groups: [{ id: 'g1', position: { pos: loaded ? [4000, 0, -3000] : [0, 0, 0] } }],
      };
    };
    const client = await connectClient(createPlannerApi(bridge));

    const result = await client.callTool({
      name: 'place-group',
      arguments: { groupId: 'g1', wall: 'right', alignment: 'top' },
    });

    const calls = socket.sent.map((data) => JSON.parse(data));
    expect(calls.map((call) => call.method)).toEqual([
      'getExternalObjectPlanContext',
      'getExternalObjectGroups',
      'loadExternalObjectGroupLayout',
      'getExternalObjectPlanContext',
    ]);
    expect(calls[0].args).toEqual([['rooms', 'groups']]);
    expect(calls[2].args).toEqual([
      {
        posGroups: [
          {
            id: 'g1',
            libraryId: 'lib-1',
            roots: [{ id: 'u1', articleId: 'a1', attributes }],
            repositioningData: { posGroup: [4000, 0, -3000], posRotationY: 270, rootId: 'u1' },
          },
        ],
      },
      'posGroups',
      { reason: 'adjusted' },
    ]);
    expect(JSON.parse(textOf(result))).toEqual({
      placedIn: 'wall',
      wall: rightWall,
      group: { id: 'g1', position: { pos: [4000, 0, -3000] } },
    });
  });
});
