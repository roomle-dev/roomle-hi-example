import { describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createHiMcpServer } from '../hi-mcp-server';
import { PageBridge } from '../page-bridge';
import { connectPlanHistory, planHistory } from '../plan-history';
import type { PlannerApi } from '../planner-api';
import { createPlannerApi } from '../planner-api';
import { attachPage } from './fake-page-socket';

const EXPECTED_TOOLS = [
  'change-group-attribute',
  'change-module-attribute',
  'create-or-replace-groups',
  'delete-article-and-compact',
  'delete-article-in-place',
  'delete-group',
  'exchange-root-module',
  'find-attributes',
  'get-authoring-rules',
  'get-order-data',
  'get-plan-context',
  'get-plan-images',
  'get-price',
  'insert-article-into-group',
  'merge-article-into-group',
  'merge-groups',
  'place-group',
  'redo',
  'swap-root-modules',
  'undo',
];

const createMockPlannerApi = (
  overrides: Partial<PlannerApi['extended']> = {}
): PlannerApi => ({
  extended: {
    getExternalObjectPlanContext: vi.fn(async () => ({})),
    loadExternalObjectGroupLayout: vi.fn(async () => []),
    externalObjectGroupOperation: vi.fn(async () => ({})),
    fetchPrice: vi.fn(async () => null),
    getExternalObjectSnapshot: vi.fn(async () => ({})),
    getExternalObjectGroups: vi.fn(async () => []),
    removeExternalObject: vi.fn(async () => undefined),
    undo: vi.fn(async () => undefined),
    redo: vi.fn(async () => undefined),
    ...overrides,
  },
});

const connectClient = async (plannerApi: PlannerApi): Promise<Client> => {
  const server = createHiMcpServer(plannerApi);
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
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
      await client.callTool({ name: 'get-authoring-rules', arguments: {} })
    );
    const { tools } = await client.listTools();

    expect(client.getInstructions()).toContain(
      'Edit an existing group with the command tools'
    );
    expect(rules).toContain(
      'To change an existing group, use the command tools'
    );
    expect(rules).toContain('call merge-article-into-group');
    expect(
      tools.find((tool) => tool.name === 'merge-groups')?.description
    ).toContain('nothing is moved and no docking is added');
  });

  it.each([
    ['change-module-attribute', { attributeId: 'front', value: 'white' }],
    ['change-group-attribute', { groupId: 'g1', value: 'white' }],
    ['delete-group', {}],
    ['delete-article-in-place', {}],
    ['merge-article-into-group', { groupId: 'g1', articleId: 'a1' }],
    ['exchange-root-module', { groupId: 'g1', rootModuleId: 'r1' }],
    ['merge-groups', { targetGroupId: 'g1', groupIds: [] }],
    ['insert-article-into-group', { groupId: 'g1', articleId: 'a1' }],
    ['swap-root-modules', { groupId: 'g1', rootModuleIds: ['r1'] }],
    ['delete-article-and-compact', { groupId: 'g1' }],
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
    }
  );

  it('logs what the agent sent to a plan-changing tool before the server corrects it', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const client = await connectClient(createMockPlannerApi());
    const posGroups = [
      {
        roots: [
          {
            id: 'c1',
            articleId: 'a',
            contextData: {
              dockedRoots: [
                {
                  ownDockingVector: 'RightBottom',
                  dockedRoots: [{ id: 'r1', articleId: 'b' }],
                },
              ],
            },
          },
        ],
      },
    ];
    // the in-memory transport hands the server this very object, which it corrects
    const sent = JSON.stringify({ posGroups });
    await client.callTool({
      name: 'create-or-replace-groups',
      arguments: { posGroups },
    });
    await client.callTool({ name: 'get-price', arguments: {} });

    const lines = log.mock.calls.map(([line]) => String(line));
    log.mockRestore();
    expect(lines).toContain(
      `[hi-mcp] tool create-or-replace-groups args ${sent}`
    );
    expect(
      lines.some((line) => line.startsWith('[hi-mcp] tool get-price args'))
    ).toBe(false);
  });

  it('logs the feedback and the errors of a tool as one JSON line', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const plannerApi = createMockPlannerApi({
      getExternalObjectPlanContext: vi.fn(async () => ({
        groups: [{ id: 'g1', libraryId: 'lib-1', roots: [] }],
        articles: [{ articleId: 'article-1', libraryId: 'lib-1' }],
      })),
    });
    const client = await connectClient(plannerApi);

    await client.callTool({
      name: 'exchange-root-module',
      arguments: { groupId: 'g1', rootModuleId: 'r1', articleId: 'ARTICLE-1' },
    });
    await client.callTool({
      name: 'create-or-replace-groups',
      arguments: { posGroups: [{ roots: [] }] },
    });

    const lines = log.mock.calls.map(([line]) => String(line));
    log.mockRestore();
    expect(lines).toContain(
      `[hi-mcp] tool exchange-root-module feedback ${JSON.stringify({
        corrections: [
          "exchange-root-module: articleId 'ARTICLE-1' was read as 'article-1'",
        ],
      })}`
    );
    const errorLine = lines.find((line) =>
      line.startsWith('[hi-mcp] tool create-or-replace-groups error ')
    );
    expect(
      JSON.parse(
        errorLine!.slice('[hi-mcp] tool create-or-replace-groups error '.length)
      )
    ).toEqual({
      message: expect.stringMatching(
        /^Invalid pos groups - nothing was loaded:\nposGroups\[0\]: needs a non-empty roots array/
      ),
      args: { posGroups: [{ roots: [] }] },
    });
  });

  it('ends every call of a tool that changes the plan with one feedback line, also without feedback', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const client = await connectClient(createMockPlannerApi());

    await client.callTool({
      name: 'delete-article-in-place',
      arguments: { rootModuleId: 'r1' },
    });
    await client.callTool({ name: 'get-price', arguments: {} });

    const lines = log.mock.calls.map(([line]) => String(line));
    log.mockRestore();
    expect(lines).toContain(
      '[hi-mcp] tool delete-article-in-place feedback {}'
    );
    expect(
      lines.some((line) => line.startsWith('[hi-mcp] tool get-price feedback'))
    ).toBe(false);
  });

  it('logs undo and redo like the other tools that change the plan', async () => {
    planHistory.reset();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const client = await connectClient(createMockPlannerApi());

    await client.callTool({ name: 'undo', arguments: {} });
    await client.callTool({ name: 'redo', arguments: {} });

    const lines = log.mock.calls.map(([line]) => String(line));
    log.mockRestore();
    expect(lines).toContain('[hi-mcp] tool undo args {}');
    expect(lines).toContain('[hi-mcp] tool undo feedback {}');
    expect(lines).toContain('[hi-mcp] tool redo args {}');
    expect(lines).toContain('[hi-mcp] tool redo feedback {}');
  });

  it('answers nothing to undo as a result, not an error', async () => {
    planHistory.reset();
    const client = await connectClient(createMockPlannerApi());
    const result = await client.callTool({ name: 'undo', arguments: {} });

    expect((result as { isError?: boolean }).isError).toBeFalsy();
    expect(JSON.parse(textOf(result))).toEqual({
      undone: null,
      groups: [],
      hint: 'Nothing to undo: no tool call has changed the plan since the planner page connected.',
    });
  });

  it('accepts a number as an attribute value and passes it on as its string', async () => {
    const plannerApi = createMockPlannerApi();
    const client = await connectClient(plannerApi);

    const result = await client.callTool({
      name: 'change-module-attribute',
      arguments: { rootModuleId: 'r1', attributeId: 'mod_Width', value: 900 },
    });

    expect((result as { isError?: boolean }).isError).toBeFalsy();
    expect(
      plannerApi.extended.externalObjectGroupOperation
    ).toHaveBeenCalledWith('change-module-attribute', {
      rootModuleId: 'r1',
      moduleId: null,
      attributeId: 'mod_Width',
      value: '900',
    });
  });

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
      name: 'delete-article-in-place',
      arguments: { rootModuleId: 'r1' },
    });

    expect(
      plannerApi.extended.externalObjectGroupOperation
    ).toHaveBeenCalledWith('delete-root-module', { rootModuleId: 'r1' });
    expect(JSON.parse(textOf(result))).toEqual({
      ...operationResult,
      command: 'delete-article-in-place',
    });
  });

  it('answers get-authoring-rules without a planner call', async () => {
    const plannerApi = createMockPlannerApi();
    const client = await connectClient(plannerApi);
    const result = await client.callTool({
      name: 'get-authoring-rules',
      arguments: {},
    });
    for (const method of Object.values(plannerApi.extended)) {
      expect(method).not.toHaveBeenCalled();
    }
    expect(textOf(result)).toMatch(/^Authoring rules for pos groups:/);
    expect(textOf(result)).toContain('Never author a position');
  });

  it('explains positioning with placement in the verified rotation sense', async () => {
    const client = await connectClient(createMockPlannerApi());
    const text = textOf(
      await client.callTool({ name: 'get-authoring-rules', arguments: {} })
    );
    expect(text).toContain(
      'placement positions a new group, in one of two forms. At a wall or in a room corner: { wall, alignment?, offsetMm?, roomIndex? }'
    );
    expect(text).toContain('{ posGroup: [x, y, z], posRotationY, rootId? }');
    expect(text).toContain('counter-clockwise as seen from above');
    expect(text).toContain('back 0, left 90, front 180, right 270');
    expect(text).toContain(
      'every room of get-plan-context carries a corners list'
    );
    expect(text).toContain(
      'Looking into the corner from the room, the root modules rightOf the corner article run along the wall on the right'
    );
    expect(text).toContain('an entry of type opening is a door');
    expect(text).toContain(
      'To move an existing group against a wall or into a room corner, call place-group'
    );
  });

  it('places a new group by wall and alignment and leaves the point to the server', async () => {
    const client = await connectClient(createMockPlannerApi());
    const rules = textOf(
      await client.callTool({ name: 'get-authoring-rules', arguments: {} })
    );
    const { tools } = await client.listTools();
    const descriptionOf = (name: string) =>
      tools.find((tool) => tool.name === name)?.description ?? '';
    // the whole wall placement, for a client that does not read the rules
    expect(descriptionOf('create-or-replace-groups')).toContain(
      'At a wall or in a room corner: { wall, alignment?, offsetMm?, roomIndex? }'
    );
    expect(descriptionOf('create-or-replace-groups')).toContain(
      "or end; offsetMm moves it along the wall away from that corner or from the wall's end - the fromEndMm of the obstacles is measured from there; roomIndex the room, 0 by default."
    );
    expect(descriptionOf('create-or-replace-groups')).toContain(
      'The server computes the point and the rotation.'
    );
    expect(descriptionOf('place-group')).toContain(
      'a new group takes the same wall, alignment and offsetMm in its placement in create-or-replace-groups'
    );
    expect(client.getInstructions()).toContain(
      '{ wall, alignment?, offsetMm? } at a wall or in a room corner - the server computes the point -'
    );
    const served = [
      client.getInstructions() ?? '',
      rules,
      JSON.stringify(tools),
    ].join('\n');
    for (const recipe of [
      'end + d',
      'd = (lengthMm',
      'its end point and its facingRotationY',
      'position a group created without placement',
      'never compute wall points',
    ]) {
      expect(served).not.toContain(recipe);
    }
  });

  it('carries the one-group principle and the relation examples', async () => {
    const client = await connectClient(createMockPlannerApi());
    const text = textOf(
      await client.callTool({ name: 'get-authoring-rules', arguments: {} })
    );
    expect(text).toContain('One piece of furniture is one group');
    // a row, wall units beside a tall unit and the second leg of a corner kitchen
    expect(text).toContain(
      '{ "id": "u2", "articleId": "<articleId>", "rightOf": "u1" }'
    );
    expect(text).toContain(
      '{ "id": "w1", "articleId": "<wall unit>", "rightOf": "t1" }'
    );
    expect(text).toContain(
      '{ "id": "l1", "articleId": "<base unit>", "leftOf": "c1" }'
    );
    // the complete L-shaped corner kitchen example, placed into the corner of
    // two walls
    expect(text).toContain(
      'is ONE group starting with the corner article c1, placed at the right wall with the back wall as alignment'
    );
    expect(text).toContain(
      '"placement": { "wall": "right", "alignment": "back" }'
    );
    expect(text).toContain('Example 5');
  });

  it('tells the agent where the size of an article is and to trust every desc over a catalog image', async () => {
    const client = await connectClient(createMockPlannerApi());
    const rules = textOf(
      await client.callTool({ name: 'get-authoring-rules', arguments: {} })
    );
    const { tools } = await client.listTools();
    const descriptionOf = (name: string) =>
      tools.find((tool) => tool.name === name)?.description;

    expect(rules).toContain('its value in millimetres');
    expect(rules).toContain(
      'change-module-attribute with that attribute id, never its name, changes the size of a root module'
    );
    expect(rules).toContain('Every desc');
    expect(rules).toContain('is authoritative');
    expect(rules).toContain(
      'authoritative over the catalog images of the master data (imageUrl)'
    );
    expect(descriptionOf('get-plan-context')).toContain(
      'with their values in millimetres'
    );
    expect(descriptionOf('get-plan-context')).toContain(
      'trust them over the catalog images (imageUrl)'
    );
    expect(descriptionOf('get-plan-images')).not.toContain(
      'evaluate the images only'
    );
  });

  it('limits the desc-over-image rule to the catalog images', async () => {
    const client = await connectClient(createMockPlannerApi());
    const rules = textOf(
      await client.callTool({ name: 'get-authoring-rules', arguments: {} })
    );
    const { tools } = await client.listTools();
    const servedTexts = [
      client.getInstructions() ?? '',
      rules,
      ...tools.map((tool) => tool.description ?? ''),
    ];

    for (const text of servedTexts) {
      expect(text).not.toContain('any other picture');
      expect(text).not.toContain('any image');
    }
  });

  it('tells the agent that a colour code in a desc is the colour of the value', async () => {
    const client = await connectClient(createMockPlannerApi());
    const rules = textOf(
      await client.callTool({ name: 'get-authoring-rules', arguments: {} })
    );
    const { tools } = await client.listTools();
    const descriptionOf = (name: string) =>
      tools.find((tool) => tool.name === name)?.description;

    expect(rules).toContain(
      'A colour code in the desc of an attribute value - Cloudy blue (#506080) - is the colour of that value'
    );
    expect(rules).toContain('not by the name');
    expect(rules).toContain('or the colour of a value, from a catalog image');
    expect(descriptionOf('get-plan-context')).toContain(
      'a colour code in the desc of an attribute value (#rrggbb) is the colour of that value'
    );
    expect(descriptionOf('find-attributes')).toContain(
      'pick a dark, a light or a blue value by its code'
    );
  });

  it('teaches the row edits and which end of a row keeps its place', async () => {
    const client = await connectClient(createMockPlannerApi());
    const rules = textOf(
      await client.callTool({ name: 'get-authoring-rules', arguments: {} })
    );

    for (const sentence of [
      'insert-article-into-group inserts an article between two root modules',
      'delete-article-and-compact deletes an article and closes the gap',
      'delete-article-in-place deletes an article and leaves the gap',
      'delete-group deletes a group',
      'swap-root-modules lets two root modules change places',
      'an article of another size - "a 900 mm cabinet" - is the same article with that attribute set',
      'Delete and remove mean the same: delete-article-in-place, unless the user asks to close the gap - then delete-article-and-compact',
      'In an insert, a delete that closes the gap, an exchange or a swap the root modules at a wall or in a corner keep their place and the others move',
      'an article between two root modules with insert-article-into-group',
      'Example 6 - "insert a low cabinet between the high cabinets" is insert-article-into-group',
    ]) {
      expect(rules).toContain(sentence);
    }
    expect(client.getInstructions()).toContain(
      'delete-article-and-compact (delete an article and close the gap)'
    );
  });

  it('names the delete edits by their outcome and leaves the gap by default', async () => {
    const client = await connectClient(createMockPlannerApi());
    const { tools } = await client.listTools();
    const toolNamed = (name: string) =>
      tools.find((tool) => tool.name === name);
    const inPlace = toolNamed('delete-article-in-place')?.description ?? '';
    const compact = toolNamed('delete-article-and-compact')?.description ?? '';

    expect(inPlace).toMatch(
      /^Deletes an article from its group and leaves the gap - the tool for "delete" or "remove" when the user does not ask to close the gap/
    );
    expect(compact).toMatch(
      /^Deletes an article from its group and closes the gap - the tool when the user asks to close the gap/
    );
    expect(inPlace).toContain(
      'To close the gap, use delete-article-and-compact.'
    );
    expect(compact).toContain('To leave the gap, use delete-article-in-place.');
    for (const name of [
      'delete-article-in-place',
      'delete-article-and-compact',
    ]) {
      expect(toolNamed(name)?.inputSchema.required).toEqual(['rootModuleId']);
    }
  });

  it("no longer names a delete edit by the user's word", async () => {
    const client = await connectClient(createMockPlannerApi());
    const rules = textOf(
      await client.callTool({ name: 'get-authoring-rules', arguments: {} })
    );
    const { tools } = await client.listTools();
    const served = [
      client.getInstructions() ?? '',
      rules,
      JSON.stringify(tools),
    ].join('\n');

    for (const text of [
      'delete-root-module',
      'remove-article-from-group',
      "Take the user's word",
      'The tool for "remove"',
    ]) {
      expect(served).not.toContain(text);
    }
    expect(rules).toContain('Delete and remove mean the same');
  });

  it('speaks of articles and root modules, not of kitchens, and inserts between any two root modules', async () => {
    const client = await connectClient(createMockPlannerApi());
    const rules = textOf(
      await client.callTool({ name: 'get-authoring-rules', arguments: {} })
    );
    const { tools } = await client.listTools();
    const descriptionOf = (name: string) =>
      tools.find((tool) => tool.name === name)?.description ?? '';
    const served = [
      client.getInstructions() ?? '',
      rules,
      JSON.stringify(tools),
    ].join('\n');

    for (const sentence of [
      'the catalog offers articles - cabinets, wardrobes, appliances, panels',
      'A group is one piece of furniture made of articles: a kitchen, a wardrobe, a sideboard, a utility room',
      'An article placed in a group is a root module',
      'a high or tall cabinet or a wardrobe is about 2000 mm high, a low cabinet or base cabinet about 720 mm high',
      'The user decides which articles stand next to each other: a low cabinet between two high cabinets is an order like any other',
      'A desc says what an article is, not where the user may put it',
      'take the article of that kind from the category of its neighbours where that category has one (a kitchen cabinet into a kitchen, a wardrobe into a wardrobe), else the closest kind of another category',
      'Two root modules that name each other with RightBottom -> LeftBottom stand side by side',
    ]) {
      expect(rules).toContain(sentence);
    }
    expect(client.getInstructions()).toContain(
      'an article placed in a group is a root module'
    );
    for (const sentence of [
      'between two root modules of an existing group that stand side by side',
      'whatever the group is and whatever the article is: a low cabinet between two high cabinets or wardrobes too',
      'the user decides what stands between what',
      'a group of two root modules has one place to insert: between them. No gap is needed - the tool makes room',
    ]) {
      expect(descriptionOf('insert-article-into-group')).toContain(sentence);
    }
    expect(descriptionOf('merge-article-into-group')).toContain(
      'To put an article between two root modules, use insert-article-into-group'
    );
    // kitchens are one kind of furniture: the rules name them in the list of kinds, in the corner rules and in the
    // category example (a kitchen cabinet into a kitchen), the tool descriptions not at all
    expect((rules.match(/kitchen/gi) ?? []).length).toBeLessThanOrEqual(7);
    expect(JSON.stringify(tools)).not.toMatch(/kitchen/i);
    expect(served).not.toMatch(/whole kitchen/);
    expect(served).not.toMatch(/the unit\b/);
  });

  it('tells the agent that a new root module inherits the attributes of its neighbour', async () => {
    // RML-18075: as an article added in the planner
    const client = await connectClient(createMockPlannerApi());
    const rules = textOf(
      await client.callTool({ name: 'get-authoring-rules', arguments: {} })
    );
    const { tools } = await client.listTools();
    const descriptionOf = (name: string) =>
      tools.find((tool) => tool.name === name)?.description ?? '';
    const inherited =
      'the attributes the library passes on between neighbours - fronts, handles, carcase -';

    for (const [text, neighbour] of [
      [
        descriptionOf('merge-article-into-group'),
        'from the root module of dockTo',
      ],
      [
        descriptionOf('insert-article-into-group'),
        'from the first root module of between',
      ],
      [descriptionOf('exchange-root-module'), 'of the replaced one'],
      [
        descriptionOf('create-or-replace-groups'),
        'from the root module it is docked to',
      ],
      [rules, 'from the root module it is docked to'],
    ]) {
      expect(text).toContain(`${inherited} ${neighbour}`);
      expect(text).toContain('attributes override them');
    }
  });

  it('describes how to succeed instead of what is rejected, and where the corrections are', async () => {
    const client = await connectClient(createMockPlannerApi());
    const rules = textOf(
      await client.callTool({ name: 'get-authoring-rules', arguments: {} })
    );
    const { tools } = await client.listTools();
    const served = [
      client.getInstructions() ?? '',
      rules,
      JSON.stringify(tools),
    ].join('\n');
    expect(served).not.toMatch(/reject/i);
    expect(served).not.toMatch(/lists? the new root/);
    expect(rules).toContain(
      'every root after the first names one neighbour of the same group by its id, with exactly one of these fields'
    );
    expect(rules).toContain(
      'Read corrections, notLoaded and hint in a result: corrections lists what the server changed in your input'
    );
    expect(rules).toContain(
      'notLoaded lists the groups and the roots it could not build'
    );
    expect(rules).toContain(
      'hint names something to check that stopped nothing - a root module on an obstacle, with the free stretches of its wall.'
    );
  });

  it('tells the agent to undo a wrong result and send the corrected call', async () => {
    const client = await connectClient(createMockPlannerApi());
    const rules = textOf(
      await client.callTool({ name: 'get-authoring-rules', arguments: {} })
    );
    expect(rules).toContain(
      'when a result is not what was asked - the wrong wall, a root module missing or replaced by mistake, a merge or a delete that went wrong - call undo and send the corrected call'
    );
    expect(rules).toContain('one undo reverts one tool call');
    expect(rules).toContain(
      'A group that only needs a change is edited with the command tools'
    );
    expect(client.getInstructions()).toContain(
      'undo reverts the last tool call that changed the plan, redo brings it back.'
    );
    // a chat that does not pass the instructions on still sees the tool list
    const { tools } = await client.listTools();
    expect(tools.find((tool) => tool.name === 'undo')?.description).toContain(
      'Use it when that result is not what was asked - the user says it was the wrong article, wall or group'
    );
  });

  it('tells the agent what stands in the room and that the hint names a root module on an obstacle', async () => {
    const client = await connectClient(createMockPlannerApi());
    const rules = textOf(
      await client.callTool({ name: 'get-authoring-rules', arguments: {} })
    );
    expect(rules).toContain(
      "Put a new group on a stretch of wall or a spot that obstacles leaves free: fromEndMm is measured from the wall's end, so a placement with that wall, alignment end and offsetMm = the start of a free stretch puts the group on it; base units lower than a window's bottomMm fit below it."
    );
    expect(rules).toContain(
      "The result's hint names every root module that overlaps an object or another group or stands in front of a door or a window, with the free stretches of its wall."
    );
    // the server tests the outlines, not the agent (D55)
    expect(rules).not.toContain('cannot stand where');
    expect(rules).not.toContain('keep that span free');
    expect(rules).toContain(
      'any point on the floor that obstacles leaves free as posGroup'
    );
    expect(client.getInstructions()).toContain(
      'the obstacles (doors, windows, other furniture and the root modules of the groups, where they stand)'
    );
    const { tools } = await client.listTools();
    const planContext = tools.find((tool) => tool.name === 'get-plan-context');
    expect(planContext?.description).toContain(
      'obstacles (what stands in the room, in the coordinates of the walls'
    );
    expect(planContext?.description).toContain('roomIndex, wall and fromEndMm');
    const createGroups = tools.find(
      (tool) => tool.name === 'create-or-replace-groups'
    );
    expect(createGroups?.description).toContain(
      'and hint (a root module on an obstacle, in another group or in front of a door or a window, with the free stretches of its wall)'
    );
    const placeGroup = tools.find((tool) => tool.name === 'place-group');
    expect(placeGroup?.description).toContain(
      'a hint when a root module stands on an object or in front of a door or a window'
    );
    expect(
      (planContext?.inputSchema.properties?.include as { description?: string })
        ?.description
    ).toContain('Default: rooms, articles, groups and obstacles.');
  });

  it('hangs a range hood beside the wall units and reads a position back in the frame of the placement', async () => {
    const client = await connectClient(createMockPlannerApi());
    const rules = textOf(
      await client.callTool({ name: 'get-authoring-rules', arguments: {} })
    );
    const { tools } = await client.listTools();
    const served = [
      client.getInstructions() ?? '',
      rules,
      JSON.stringify(tools),
    ].join('\n');
    expect(rules).toContain(
      'further wall units and the range hood continue rightOf or leftOf each other'
    );
    expect(served).not.toContain('cannot be docked');
    expect(served).not.toContain('posRotationY + 90');
    expect(JSON.stringify(tools)).toContain(
      "position with pos - the room point of the group's back left bottom corner, as a placement names it"
    );
  });

  it('teaches the relations for a new group instead of docking vectors', async () => {
    const client = await connectClient(createMockPlannerApi());
    const rules = textOf(
      await client.callTool({ name: 'get-authoring-rules', arguments: {} })
    );
    const { tools } = await client.listTools();
    const create = tools.find(
      (tool) => tool.name === 'create-or-replace-groups'
    );
    for (const relation of [
      'rightOf: "<id>"',
      'leftOf: "<id>"',
      'onTop: "<id>"',
      'above: "<id>"',
      'behind: "<id>"',
    ]) {
      expect(rules).toContain(relation);
    }
    expect(rules).toContain(
      'A wall unit rightOf or leftOf a tall unit hangs beside it with the tops flush, on the side of the base units'
    );
    expect(rules).toContain(
      'The wall units of each leg hang above the floor units of that leg'
    );
    expect(rules).toContain('stacking on a tall unit or a wall unit');
    expect(rules).toContain(
      "a material for the whole group - the fronts, the worktop, the carcase - goes into the group's attributes"
    );
    expect(create?.description).toContain(
      "a material for the whole group goes into the group's attributes"
    );
    expect(create?.description).toContain(
      'rightOf, leftOf, onTop, above or behind'
    );
    // example 5 extends a group with merge-article-into-group, which names docking vectors
    const creationRules = rules.slice(0, rules.indexOf('Example 5'));
    for (const text of [creationRules, create?.description ?? '']) {
      expect(text).not.toContain('"ownDockingVector"');
      expect(text).not.toContain('<gap');
      expect(text).not.toContain('the placed root names the new root');
    }
    // the server derives the hang gap of a wall unit merged on a floor unit
    const merge = JSON.stringify(
      tools.find((tool) => tool.name === 'merge-article-into-group')
    );
    expect(merge).not.toContain('<gap');
    expect(merge).not.toContain('600, 0');
    expect(merge).toContain('at the height of the wall units');
  });

  it('never tells the agent how the server positions a group internally', async () => {
    const client = await connectClient(createMockPlannerApi());
    const rules = textOf(
      await client.callTool({ name: 'get-authoring-rules', arguments: {} })
    );
    const { tools } = await client.listTools();
    const served = [
      client.getInstructions() ?? '',
      rules,
      JSON.stringify(tools),
    ];
    for (const internal of [
      'repositioningData',
      'rootRelPos',
      'cornerPoint',
      'blind zone',
      '261',
      'externalObjectGroupOperation',
      'probe',
      'step',
    ]) {
      expect(served.join('\n')).not.toContain(internal);
    }
  });

  it('runs get-plan-context against the planner API and returns the JSON text', async () => {
    const plannerApi = createMockPlannerApi({
      getExternalObjectPlanContext: vi.fn(async () => ({
        rooms: [],
        articles: [],
      })),
    });
    const client = await connectClient(plannerApi);
    const result = await client.callTool({
      name: 'get-plan-context',
      arguments: { include: ['articles'] },
    });
    expect(
      plannerApi.extended.getExternalObjectPlanContext
    ).toHaveBeenCalledWith(['articles']);
    expect(JSON.parse(textOf(result))).toEqual({ rooms: [], articles: [] });
  });

  it('returns tool results as compact JSON without image URLs', async () => {
    const imageUrl =
      'https://tecconfig-preview.homag.cloud/cdn/x.png?sv=2023-11-03&sig=abc%3D';
    const plannerApi = createMockPlannerApi({
      getExternalObjectPlanContext: vi.fn(async () => ({
        articles: [
          {
            articleId: 'HTB60',
            imageUrl,
            rootModules: [
              {
                module: { id: 'mr_Tall', imageUrl },
                subModules: [{ id: 'mf_Door', imageUrl }],
              },
            ],
          },
        ],
      })),
    });
    const client = await connectClient(plannerApi);
    const text = textOf(
      await client.callTool({ name: 'get-plan-context', arguments: {} })
    );
    expect(text).toBe(
      '{"articles":[{"articleId":"HTB60","rootModules":[{"module":{"id":"mr_Tall"},"subModules":[{"id":"mf_Door"}]}],"cornerArticle":false}]}'
    );
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
    expect(
      plannerApi.extended.loadExternalObjectGroupLayout
    ).not.toHaveBeenCalled();
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
    const result = await client.callTool({
      name: 'get-plan-images',
      arguments: {},
    });
    const content = (result as { content: unknown[] }).content;
    expect(content).toEqual([
      { type: 'image', data: 'AAA=', mimeType: 'image/png' },
      { type: 'image', data: 'BBB=', mimeType: 'image/png' },
    ]);
  });

  it('reports when the plan has no images', async () => {
    const client = await connectClient(createMockPlannerApi());
    const result = await client.callTool({
      name: 'get-plan-images',
      arguments: {},
    });
    expect(JSON.parse(textOf(result))).toEqual({
      error: 'No images available',
    });
  });
});

describe('hi-mcp-server through the page bridge', () => {
  it('runs create-or-replace-groups as planner calls the page executes', async () => {
    const bridge = new PageBridge();
    const socket = attachPage(bridge);
    // a range hood, whose origin is its centre: 299 mm right of its left edge
    const hoodVectors = [
      { id: 'LeftBottom', start: [-299, 0, 0], end: [-299, 0, 501] },
      { id: 'RightBottom', start: [299, 0, 0], end: [299, 0, 501] },
    ];
    let rawGroups: object[] = [];
    let loaded = false;
    socket.respond = (method, args) => {
      if (method === 'loadExternalObjectGroupLayout') {
        const [layout] = args as [any];
        if (layout.posGroups[0].roots[0].id === 'anchor-probe') {
          rawGroups = [
            {
              id: 'probe',
              roots: [{ id: 'p1', articleId: 'DU', dockInfos: hoodVectors }],
            },
          ];
          return [{ id: 'probe' }];
        }
        // the planner keeps the group origin at the hood's centre
        rawGroups = [
          {
            id: 'g1',
            pos: [299, 0, 0],
            rotationY: 0,
            roots: [
              {
                id: 'u1',
                articleId: 'DU',
                articlePos: [0, 0, 0],
                rotationY: 0,
                dockInfos: hoodVectors,
              },
            ],
          },
        ];
        loaded = true;
        return [{ id: 'g1' }];
      }
      if (method === 'getExternalObjectGroups') {
        return rawGroups;
      }
      if (method === 'undo') {
        rawGroups = [];
        return undefined;
      }
      const [include] = args as [string[]];
      if (include.includes('articles')) {
        return { articles: [{ articleId: 'DU' }] };
      }
      return {
        groups: loaded
          ? [{ id: 'g1', position: { pos: [299, 0, 0], rotationY: 0 } }]
          : [],
      };
    };
    const client = await connectClient(createPlannerApi(bridge));
    const roots = [{ id: 'u1', articleId: 'DU' }];
    const posGroups = [
      { roots, placement: { posGroup: [0, 0, 0], posRotationY: 0 } },
    ];

    const result = await client.callTool({
      name: 'create-or-replace-groups',
      arguments: { posGroups },
    });

    const calls = socket.sent
      .map((data) => JSON.parse(data))
      .filter((message) => message.kind === 'call');
    expect(calls.map((call) => call.method)).toEqual([
      'getExternalObjectPlanContext',
      'getExternalObjectPlanContext',
      'getExternalObjectGroups',
      // the plan before the first step, for undo
      'getExternalObjectGroups',
      // the probe learns the hood's frame and undoes its load
      'loadExternalObjectGroupLayout',
      'getExternalObjectGroups',
      'undo',
      'getExternalObjectGroups',
      'loadExternalObjectGroupLayout',
      'getExternalObjectPlanContext',
      // the position read back in the placement frame
      'getExternalObjectGroups',
      // the plan after the call, for undo
      'getExternalObjectGroups',
    ]);
    expect(calls[8].args).toEqual([
      {
        posGroups: [
          {
            roots,
            repositioningData: {
              posGroup: [0, 0, 0],
              posRotationY: 0,
              rootId: 'u1',
              rootRelPos: [299, 0, 0],
              rootRelRotationY: 0,
            },
          },
        ],
      },
      'posGroups',
      { reason: 'adjusted' },
    ]);
    // the agent reads back the point it placed the hood's left edge at
    expect(JSON.parse(textOf(result))).toEqual({
      loaded: [{ id: 'g1' }],
      groups: [{ id: 'g1', position: { pos: [0, 0, 0], rotationY: 0 } }],
    });
  });

  it('runs undo through the page bridge and counts the history events the page relays', async () => {
    const bridge = new PageBridge();
    connectPlanHistory(bridge, planHistory);
    const socket = attachPage(bridge);
    const eventsBefore = planHistory.events;
    let rawGroups: any[] = [{ id: 'g1', roots: [] }];
    const past: any[][] = [];
    const historyEvent = (undo: boolean, redo: boolean) =>
      socket.receive({ kind: 'event', name: 'historyChange', undo, redo });
    socket.respond = (method) => {
      if (method === 'externalObjectGroupOperation') {
        past.push(rawGroups);
        rawGroups = [];
        historyEvent(true, false);
        return { command: 'delete-group', groups: [], removedGroupIds: ['g1'] };
      }
      if (method === 'undo') {
        rawGroups = past.pop() ?? rawGroups;
        historyEvent(false, true);
        return undefined;
      }
      if (method === 'getExternalObjectGroups') {
        return rawGroups;
      }
      return {
        groups: rawGroups.map((group) => ({ id: group.id, roots: [] })),
      };
    };
    const client = await connectClient(createPlannerApi(bridge));

    await client.callTool({
      name: 'delete-group',
      arguments: { groupId: 'g1' },
    });
    const result = await client.callTool({ name: 'undo', arguments: {} });

    const methods = socket.sent
      .map((data) => JSON.parse(data))
      .filter((message) => message.kind === 'call')
      .map((call) => call.method);
    expect(methods.filter((method) => method === 'undo')).toHaveLength(1);
    expect(planHistory.events - eventsBefore).toBe(2);
    expect(JSON.parse(textOf(result))).toEqual({
      undone: 'delete-group',
      groups: [{ id: 'g1', roots: [] }],
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
        {
          id: 'u1',
          articleId: 'a1',
          articlePos: [0, 0, 0],
          rotationY: 0,
          attributes,
        },
      ],
    };
    let loaded = false;
    socket.respond = (method) => {
      if (method === 'getExternalObjectGroups') {
        return [
          loaded
            ? { ...calculatedGroup, pos: [4000, 0, -3000], rotationY: 270 }
            : calculatedGroup,
        ];
      }
      if (method === 'loadExternalObjectGroupLayout') {
        loaded = true;
        return [{ id: 'g1' }];
      }
      return {
        rooms: { rooms: [{ walls: [rightWall] }] },
        groups: [
          {
            id: 'g1',
            position: { pos: loaded ? [4000, 0, -3000] : [0, 0, 0] },
          },
        ],
      };
    };
    const client = await connectClient(createPlannerApi(bridge));

    const result = await client.callTool({
      name: 'place-group',
      arguments: { groupId: 'g1', wall: 'right', alignment: 'top' },
    });

    const calls = socket.sent
      .map((data) => JSON.parse(data))
      .filter((message) => message.kind === 'call');
    expect(calls.map((call) => call.method)).toEqual([
      'getExternalObjectPlanContext',
      'getExternalObjectGroups',
      // the plan before the first step, for undo
      'getExternalObjectGroups',
      'loadExternalObjectGroupLayout',
      'getExternalObjectPlanContext',
      'getExternalObjectGroups',
      // the plan after the call, for undo
      'getExternalObjectGroups',
    ]);
    expect(calls[0].args).toEqual([['rooms', 'groups', 'obstacles']]);
    expect(calls[3].args).toEqual([
      {
        posGroups: [
          {
            id: 'g1',
            libraryId: 'lib-1',
            roots: [{ id: 'u1', articleId: 'a1', attributes }],
            repositioningData: {
              posGroup: [4000, 0, -3000],
              posRotationY: 270,
              rootId: 'u1',
            },
          },
        ],
      },
      'posGroups',
      { reason: 'adjusted' },
    ]);
    expect(JSON.parse(textOf(result))).toEqual({
      placedIn: 'wall',
      wall: rightWall,
      group: { id: 'g1', position: { pos: [4000, 0, -3000], rotationY: 270 } },
    });
  });
});
