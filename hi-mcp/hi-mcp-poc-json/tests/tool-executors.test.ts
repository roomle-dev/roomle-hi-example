import { describe, expect, it, vi } from 'vitest';
import { toolExecutors } from '../tool-executors';

// rectangular room 4000 x 3000 mm as the plan context returns it: contour
// in 3D pos space and the derived walls
const room = {
  levels: [
    {
      level: 0,
      segments: [
        { cmd: 'M', pos: [0, 0, 0] },
        { cmd: 'L', pos: [4000, 0, 0], type: 'wall' },
        { cmd: 'L', pos: [4000, 0, -3000], type: 'wall' },
        { cmd: 'L', pos: [0, 0, -3000], type: 'wall' },
        { cmd: 'L', pos: [0, 0, 0], type: 'wall' },
      ],
    },
  ],
  walls: [
    {
      index: 0,
      side: 'bottom',
      start: [0, 0, 0],
      end: [4000, 0, 0],
      lengthMm: 4000,
      type: 'wall',
      facingRotationY: 180,
    },
    {
      index: 1,
      side: 'right',
      start: [4000, 0, 0],
      end: [4000, 0, -3000],
      lengthMm: 3000,
      type: 'wall',
      facingRotationY: 270,
    },
    {
      index: 2,
      side: 'top',
      start: [4000, 0, -3000],
      end: [0, 0, -3000],
      lengthMm: 4000,
      type: 'wall',
      facingRotationY: 0,
    },
    {
      index: 3,
      side: 'left',
      start: [0, 0, -3000],
      end: [0, 0, 0],
      lengthMm: 3000,
      type: 'wall',
      facingRotationY: 90,
    },
  ],
};

const FOOTPRINT = { x: [0, 800], z: [0, 600], widthMm: 800, depthMm: 600 };

// a group as the plan context returns it (shaped)
const makeShapedRoot = (overrides: Record<string, unknown> = {}) => ({
  id: 'r1',
  articleId: 'article-1',
  attributes: [
    { id: 'b', value: 800 },
    { id: 't', value: 600 },
  ],
  dockingVectors: ['LeftBottom', 'RightBottom'],
  freeDockingVectors: ['LeftBottom', 'RightBottom'],
  subModules: [],
  ...overrides,
});

const makeShapedGroup = (overrides: Record<string, unknown> = {}) => {
  const { position, ...rest } = overrides as Record<string, any>;
  return {
    id: 'g1',
    libraryId: 'lib-1',
    position: {
      pos: [0, 0, 0],
      rotationY: 0,
      footprint: FOOTPRINT,
      ...(position ?? {}),
    },
    roots: [makeShapedRoot()],
    logMessages: [],
    ...rest,
  };
};

const masterDataFixture = {
  'lib-1': {
    libraryId: 'lib-1',
    modules: [
      {
        id: 'module-1',
        name: 'Tall module',
        desc: 'A tall module',
        imageUrl: 'https://example.com/module-1.png',
        isRoot: true,
        moduleType: 'RootModule',
        attributes: ['b', 't', 'front'],
      },
      {
        id: 'sub-1',
        name: 'Sub 1',
        desc: 'A sub module',
        imageUrl: 'https://example.com/sub-1.png',
      },
    ],
    // the attributes as the compacted master data returns them
    attributes: [
      {
        id: 'b',
        name: 'Width',
        desc: 'the width',
        type: 'Dim',
        group: 'dim',
        selections: [],
      },
      {
        id: 't',
        name: 'Depth',
        desc: 'the depth',
        type: 'Dim',
        group: 'dim',
        selections: [],
      },
      {
        id: 'front',
        name: 'Front colour',
        desc: 'the colour of the front',
        imageUrl: 'https://example.com/front.png',
        type: 'Simple',
        group: 'fronts',
        selections: [
          {
            id: 'white',
            name: 'White',
            value: 'white',
            desc: 'White',
            imageUrl: 'https://example.com/white.png',
          },
        ],
      },
    ],
  },
};

const articleFixture = {
  articleId: 'article-1',
  articleName: 'Tall unit',
  desc: 'A tall unit',
  imageUrl: 'https://example.com/a1.png',
  category: 'storage',
  libraryId: 'lib-1',
  catalog: {},
  roots: [
    {
      name: 'module-1',
      attributes: [
        { id: 'b', value: 800 },
        { id: 't', value: 600 },
        { id: 'front', value: 'white' },
      ],
      dockInfos: [{ id: 'LeftBottom' }, { id: 'RightBottom' }],
      insertLevelInfos: [],
      modules: [{ name: 'sub-1' }],
    },
  ],
};

// every context section, returned for every fetch unless a test overrides it
const planContextFixture = {
  masterData: masterDataFixture,
  rooms: { rooms: [room] },
  articles: [articleFixture],
  groups: [makeShapedGroup()],
};

const createApi = (
  planContext: unknown,
  overrides: Record<string, unknown> = {},
) => ({
  extended: {
    getExternalObjectPlanContext: vi.fn(async () => planContext),
    loadExternalObjectGroupLayout: vi.fn(async () => [{ id: 'loaded-1' }]),
    updateExternalObjectGroupAttribute: vi.fn(async () => undefined),
    fetchPrice: vi.fn(async () => ({ price: 42 })),
    getExternalObjectSnapshot: vi.fn(async () => ({})),
    ...overrides,
  },
});

const pick = () => ({ id: 'u1', articleId: 'article-1' });

describe('get-plan-context', () => {
  it('passes the plan context through with the default sections', async () => {
    const api = createApi(planContextFixture);
    const result = (await toolExecutors['get-plan-context'](api, {})) as Record<
      string,
      any
    >;
    expect(api.extended.getExternalObjectPlanContext).toHaveBeenCalledWith([
      'rooms',
      'articles',
      'groups',
    ]);
    // the plan context arrives agent-ready from the planner API
    expect(result).toEqual(planContextFixture);
  });

  it('passes only the explicitly requested sections through', async () => {
    const masterDataOnly = { masterData: masterDataFixture };
    const api = createApi(masterDataOnly);
    const result = await toolExecutors['get-plan-context'](api, {
      include: ['masterData'],
    });
    expect(api.extended.getExternalObjectPlanContext).toHaveBeenCalledWith([
      'masterData',
    ]);
    expect(result).toEqual(masterDataOnly);
  });

  it('keeps the images and descriptions of the attributes and their selections', async () => {
    const api = createApi(planContextFixture);
    const result = await toolExecutors['get-plan-context'](api, {
      include: ['masterData'],
    });
    const front = (result as Record<string, any>).masterData['lib-1'].attributes.find(
      (attribute: any) => attribute.id === 'front',
    );
    expect(front.desc).toBe('the colour of the front');
    expect(front.imageUrl).toBe('https://example.com/front.png');
    expect(front.selections).toEqual([
      {
        id: 'white',
        name: 'White',
        value: 'white',
        desc: 'White',
        imageUrl: 'https://example.com/white.png',
      },
    ]);
  });
});

describe('find-attributes', () => {
  it('finds attributes by text with their root modules', async () => {
    const api = createApi(planContextFixture);
    const result = await toolExecutors['find-attributes'](api, {
      text: 'front',
    });
    expect(api.extended.getExternalObjectPlanContext).toHaveBeenCalledWith([
      'masterData',
    ]);
    expect(result).toEqual({
      matches: [
        {
          libraryId: 'lib-1',
          id: 'front',
          name: 'Front colour',
          desc: 'the colour of the front',
          imageUrl: 'https://example.com/front.png',
          type: 'Simple',
          group: 'fronts',
          selections: [
            {
              id: 'white',
              name: 'White',
              value: 'white',
              desc: 'White',
              imageUrl: 'https://example.com/white.png',
            },
          ],
          rootModules: ['module-1'],
        },
      ],
      total: 1,
    });
  });

  it('restricts the search to one library and rejects empty text', async () => {
    const api = createApi(planContextFixture);
    const result = (await toolExecutors['find-attributes'](api, {
      text: 'front',
      libraryId: 'other-lib',
    })) as Record<string, any>;
    expect(result.total).toBe(0);
    await expect(
      toolExecutors['find-attributes'](api, { text: '  ' }),
    ).rejects.toThrow(/text must not be empty/);
  });

  it('caps the matches at 20 with a hint', async () => {
    const attributes = Array.from({ length: 25 }, (_, index) => ({
      id: `attr-${index}`,
      name: `Front colour ${index}`,
      desc: '',
      type: 'Simple',
      selections: [],
    }));
    const api = createApi({
      masterData: {
        'lib-1': {
          libraryId: 'lib-1',
          modules: [
            {
              id: 'module-1',
              name: 'M',
              isRoot: true,
              moduleType: 'RootModule',
              attributes: attributes.map((attribute) => attribute.id),
            },
          ],
          attributes,
        },
      },
    });
    const result = (await toolExecutors['find-attributes'](api, {
      text: 'colour',
    })) as Record<string, any>;
    expect(result.matches).toHaveLength(20);
    expect(result.total).toBe(25);
    expect(result.hint).toMatch(/narrow the text/);
  });
});

describe('create-or-replace-groups validation', () => {
  const expectRejectedBeforeLoad = async (
    posGroups: unknown[],
    message: RegExp,
  ) => {
    const api = createApi({ articles: [] });
    await expect(
      toolExecutors['create-or-replace-groups'](api, { posGroups }),
    ).rejects.toThrow(message);
    expect(api.extended.loadExternalObjectGroupLayout).not.toHaveBeenCalled();
  };

  it('rejects a group without roots', async () => {
    await expectRejectedBeforeLoad([{}], /needs a non-empty roots array/);
  });

  it('rejects a group of only generated roots', async () => {
    await expectRejectedBeforeLoad(
      [{ roots: [{ id: 'w', isGenerated: true }] }],
      /needs at least one article root/,
    );
  });

  it('rejects a position on the group', async () => {
    await expectRejectedBeforeLoad(
      [{ roots: [pick()], pos: [0, 0, 0] }],
      /do not set pos\/rotationY on a group/,
    );
  });

  it('rejects a position on a root module', async () => {
    await expectRejectedBeforeLoad(
      [
        {
          roots: [
            { id: 'u1', articleId: 'article-1', articlePos: [0, 0, 0] },
          ],
        },
      ],
      /a root module carries no articlePos\/rotationY/,
    );
    await expectRejectedBeforeLoad(
      [{ roots: [{ id: 'u1', articleId: 'article-1', rotationY: 90 }] }],
      /a root module carries no articlePos\/rotationY/,
    );
  });

  it('rejects roots without id or articleId', async () => {
    await expectRejectedBeforeLoad(
      [{ roots: [{}] }],
      /articleId must be a non-empty string/,
    );
    await expectRejectedBeforeLoad(
      [{ roots: [{ articleId: 'article-1' }] }],
      /id must be a non-empty string/,
    );
  });

  it('rejects duplicate root ids and undocked roots', async () => {
    await expectRejectedBeforeLoad(
      [
        {
          roots: [
            { id: 'u1', articleId: 'article-1' },
            { id: 'u1', articleId: 'article-1' },
          ],
        },
      ],
      /duplicate root id 'u1'/,
    );
    await expectRejectedBeforeLoad(
      [
        {
          roots: [
            { id: 'u1', articleId: 'article-1' },
            { id: 'u2', articleId: 'article-1' },
          ],
        },
      ],
      /are not related by docking/,
    );
  });

  it('rejects a placement and points to repositioningData', async () => {
    await expectRejectedBeforeLoad(
      [{ roots: [pick()], placement: { wall: 'right' } }],
      /placement is not supported - position the group with repositioningData/,
    );
  });

  it('rejects invalid repositioningData', async () => {
    const withRepositioning = (repositioningData: unknown) => [
      { roots: [pick()], repositioningData },
    ];
    await expectRejectedBeforeLoad(
      withRepositioning({ posGroup: [0, 0], posRotationY: 0, rootId: 'u1' }),
      /posGroup must be \[x, y, z\] in millimetres/,
    );
    await expectRejectedBeforeLoad(
      withRepositioning({ posGroup: [0, '0', 0], rootId: 'u1' }),
      /posGroup must be \[x, y, z\] in millimetres/,
    );
    await expectRejectedBeforeLoad(
      withRepositioning({ posGroup: [0, 0, 0], posRotationY: '90', rootId: 'u1' }),
      /posRotationY must be a number of degrees/,
    );
    // posRotationY is required: 0 must be stated explicitly
    await expectRejectedBeforeLoad(
      withRepositioning({ posGroup: [0, 0, 0], rootId: 'u1' }),
      /posRotationY must be a number of degrees/,
    );
    await expectRejectedBeforeLoad(
      withRepositioning({ posGroup: [0, 0, 0], posRotationY: 0, rootId: 'u9' }),
      /rootId must be the id of one of the group's roots/,
    );
    await expectRejectedBeforeLoad(
      withRepositioning({
        posGroup: [0, 0, 0],
        posRotationY: 0,
        rootId: 'u1',
        rootRelPos: [261, 0],
      }),
      /rootRelPos must be \[x, y, z\] in millimetres/,
    );
  });

  it('rejects an article id that is not in the catalog', async () => {
    const api = createApi(planContextFixture);
    await expect(
      toolExecutors['create-or-replace-groups'](api, {
        posGroups: [{ roots: [{ id: 'u1', articleId: 'nope' }] }],
      }),
    ).rejects.toThrow(/articleId 'nope' is not in the article catalog/);
    expect(api.extended.loadExternalObjectGroupLayout).not.toHaveBeenCalled();
  });
});

describe('create-or-replace-groups loading', () => {
  it('loads article picks only, with docking stripped to vector names', async () => {
    const api = createApi(planContextFixture);
    const result = await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        {
          libraryId: 'lib-1',
          roots: [
            {
              id: 'u1',
              articleId: 'article-1',
              extra: 'dropped',
              contextData: {
                dockedRoots: [
                  {
                    ownDockingVector: 'RightBottom',
                    dockingVectorIndex: 0,
                    dockedRoots: [
                      {
                        id: 'u2',
                        dockingVector: 'LeftBottom',
                        mode: 'StartStart',
                        offset: [0, 0, 0],
                      },
                    ],
                  },
                ],
              },
            },
            { id: 'u2', articleId: 'article-1' },
          ],
        },
      ],
    });
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledWith(
      {
        posGroups: [
          {
            libraryId: 'lib-1',
            roots: [
              {
                id: 'u1',
                articleId: 'article-1',
                contextData: {
                  dockedRoots: [
                    {
                      ownDockingVector: 'RightBottom',
                      dockedRoots: [
                        {
                          id: 'u2',
                          dockingVector: 'LeftBottom',
                          mode: 'StartStart',
                          offset: [0, 0, 0],
                        },
                      ],
                    },
                  ],
                },
              },
              { id: 'u2', articleId: 'article-1' },
            ],
          },
        ],
      },
      'posGroups',
      { reason: 'adjusted' },
    );
    expect(result).toMatchObject({
      loaded: [{ id: 'loaded-1' }],
      groups: [{ id: 'g1' }],
    });
    expect((result as Record<string, any>).hint).toBeUndefined();
  });

  it('passes repositioningData through to the planner in one load', async () => {
    const api = createApi(planContextFixture);
    const repositioningData = {
      posGroup: [4000, 0, -3000],
      posRotationY: 270,
      rootId: 'u1',
    };
    await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [{ roots: [pick()], repositioningData }],
    });
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledTimes(1);
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledWith(
      { posGroups: [{ roots: [pick()], repositioningData }] },
      'posGroups',
      { reason: 'adjusted' },
    );
  });

  it('moves an existing group resubmitted with its id and new repositioningData', async () => {
    const api = createApi(planContextFixture);
    const repositioningData = {
      posGroup: [4000, 0, -3000],
      posRotationY: 270,
      rootId: 'r1',
    };
    // the group exactly as get-plan-context returns it, plus the new position
    await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [{ ...makeShapedGroup(), repositioningData }],
    });
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledWith(
      {
        posGroups: [
          {
            id: 'g1',
            libraryId: 'lib-1',
            roots: [
              {
                id: 'r1',
                articleId: 'article-1',
                attributes: [
                  { id: 'b', value: 800 },
                  { id: 't', value: 600 },
                ],
              },
            ],
            repositioningData,
          },
        ],
      },
      'posGroups',
      { reason: 'adjusted' },
    );
  });

  it('hints at repositioningData for a created group without a position', async () => {
    const unpositioned = makeShapedGroup({
      id: 'g2',
      position: { pos: undefined },
    });
    let groupsFetches = 0;
    const api = createApi(planContextFixture, {
      getExternalObjectPlanContext: vi.fn(async (sections: string[]) => {
        if (sections.includes('articles')) {
          return { articles: [articleFixture] };
        }
        groupsFetches += 1;
        return { groups: groupsFetches === 1 ? [] : [unpositioned] };
      }),
    });
    const result = (await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [{ roots: [pick()] }],
    })) as Record<string, any>;
    expect(result.hint).toMatch(/Groups g2 are not positioned yet/);
    expect(result.hint).toMatch(/repositioningData/);
  });
});

describe('remaining tools', () => {
  it('updates an attribute of a root module or sub module', async () => {
    const api = createApi({});
    await expect(
      toolExecutors['update-attribute'](api, {
        rootModuleId: 'r1',
        attributeId: 'b',
        value: '900',
      }),
    ).resolves.toEqual({ ok: true });
    expect(api.extended.updateExternalObjectGroupAttribute).toHaveBeenCalledWith(
      'r1',
      null,
      'b',
      '900',
    );
    await toolExecutors['update-attribute'](api, {
      rootModuleId: 'r1',
      moduleId: 'sub-1',
      attributeId: 'front',
      value: 'white',
    });
    expect(api.extended.updateExternalObjectGroupAttribute).toHaveBeenCalledWith(
      'r1',
      'sub-1',
      'front',
      'white',
    );
  });

  it('returns the fetched price', async () => {
    const api = createApi({});
    await expect(toolExecutors['get-price'](api, {})).resolves.toEqual({
      price: 42,
    });
  });

  it('returns the order data of the external object snapshot', async () => {
    const api = createApi(
      {},
      {
        getExternalObjectSnapshot: vi.fn(async () => ({
          orderData: { orderId: 'o1' },
        })),
      },
    );
    await expect(toolExecutors['get-order-data'](api, {})).resolves.toEqual({
      orderId: 'o1',
    });
    expect(api.extended.getExternalObjectSnapshot).toHaveBeenCalledWith({
      orderData: true,
    });
    const emptyApi = createApi(
      {},
      { getExternalObjectSnapshot: vi.fn(async () => null) },
    );
    await expect(toolExecutors['get-order-data'](emptyApi, {})).resolves.toBeNull();
  });

  it('returns the plan images of the external object snapshot', async () => {
    const api = createApi(
      {},
      {
        getExternalObjectSnapshot: vi.fn(async () => ({
          perspectiveImage: 'data:image/png;base64,AAA=',
          topImage: 'data:image/png;base64,BBB=',
        })),
      },
    );
    await expect(toolExecutors['get-plan-images'](api, {})).resolves.toEqual({
      perspectiveImage: 'data:image/png;base64,AAA=',
      topImage: 'data:image/png;base64,BBB=',
    });
    expect(api.extended.getExternalObjectSnapshot).toHaveBeenCalledWith({
      perspectiveImage: true,
      topImage: true,
    });
  });
});


// docking helpers: the placed root lists the new root under its own vector
const dock = (
  ownDockingVector: string,
  id: string,
  dockingVector: string,
  offset: number[] = [0, 0, 0],
) => ({
  ownDockingVector,
  dockedRoots: [{ id, dockingVector, mode: 'StartStart', offset }],
});

const rootWith = (id: string, ...dockedRoots: unknown[]) => ({
  id,
  articleId: 'article-1',
  ...(dockedRoots.length > 0 && { contextData: { dockedRoots } }),
});

describe('create-or-replace-groups docking conflicts', () => {
  const expectRejected = async (posGroups: unknown[], message: RegExp) => {
    const api = createApi(planContextFixture);
    await expect(
      toolExecutors['create-or-replace-groups'](api, { posGroups }),
    ).rejects.toThrow(message);
    expect(api.extended.loadExternalObjectGroupLayout).not.toHaveBeenCalled();
  };

  const expectLoaded = async (posGroups: unknown[]) => {
    const api = createApi(planContextFixture);
    await toolExecutors['create-or-replace-groups'](api, { posGroups });
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledTimes(1);
  };

  it('rejects a side vector claimed through two joints - the row docked past the corner', async () => {
    // the reconstructed payload of the analysis: the fridge lists the oven on
    // its LeftBottom (the oven's RightBottom), the oven lists the sink on the
    // same RightBottom
    await expectRejected(
      [
        {
          roots: [
            rootWith('fridge', dock('LeftBottom', 'oven', 'RightBottom')),
            rootWith('oven', dock('RightBottom', 'sink', 'LeftBottom')),
            rootWith('sink'),
          ],
        },
      ],
      /posGroups\[0\]: root 'oven' RightBottom is docked to both 'fridge' and 'sink' - a side takes one neighbour/,
    );
  });

  it('rejects two roots listed on the same side of one root', async () => {
    await expectRejected(
      [
        {
          roots: [
            rootWith(
              'a',
              dock('RightBottom', 'b', 'LeftBottom'),
              dock('RightBottom', 'c', 'LeftBottom'),
            ),
            rootWith('b'),
            rootWith('c'),
          ],
        },
      ],
      /root 'a' RightBottom is docked to both 'b' and 'c'/,
    );
  });

  it('rejects two roots on the same side listed in one entry', async () => {
    await expectRejected(
      [
        {
          roots: [
            rootWith('a', {
              ownDockingVector: 'LeftBottom',
              dockedRoots: [
                { id: 'b', dockingVector: 'RightBottom' },
                { id: 'c', dockingVector: 'RightBottom' },
              ],
            }),
            rootWith('b'),
            rootWith('c'),
          ],
        },
      ],
      /root 'a' LeftBottom is docked to both 'b' and 'c'/,
    );
  });

  it('rejects two roots back to back with the same root', async () => {
    await expectRejected(
      [
        {
          roots: [
            rootWith(
              'front',
              dock('BackBottom', 'back1', 'BackBottom'),
              dock('BackBottom', 'back2', 'BackBottom'),
            ),
            rootWith('back1'),
            rootWith('back2'),
          ],
        },
      ],
      /root 'front' BackBottom is docked to both 'back1' and 'back2'/,
    );
  });

  it('rejects a new root whose side is claimed by two placed roots', async () => {
    // both a and b list c on the same side of c
    await expectRejected(
      [
        {
          roots: [
            rootWith('a', dock('RightBottom', 'c', 'LeftBottom')),
            rootWith('b', dock('RightBottom', 'c', 'LeftBottom')),
            rootWith('c'),
          ],
        },
      ],
      /root 'c' LeftBottom is docked to both 'a' and 'b'/,
    );
  });

  it('names the group index and reports every conflicting side', async () => {
    const api = createApi(planContextFixture);
    await expect(
      toolExecutors['create-or-replace-groups'](api, {
        posGroups: [
          { roots: [rootWith('ok1', dock('RightBottom', 'ok2', 'LeftBottom')), rootWith('ok2')] },
          {
            roots: [
              rootWith(
                'a',
                dock('RightBottom', 'b', 'LeftBottom'),
                dock('RightBottom', 'c', 'LeftBottom'),
                dock('LeftBottom', 'd', 'RightBottom'),
                dock('LeftBottom', 'e', 'RightBottom'),
              ),
              rootWith('b'),
              rootWith('c'),
              rootWith('d'),
              rootWith('e'),
            ],
          },
        ],
      }),
    ).rejects.toThrow(
      /posGroups\[1\]: root 'a' RightBottom is docked to both 'b' and 'c'[\s\S]*posGroups\[1\]: root 'a' LeftBottom is docked to both 'd' and 'e'/,
    );
    expect(api.extended.loadExternalObjectGroupLayout).not.toHaveBeenCalled();
  });

  it('accepts a chained row', async () => {
    await expectLoaded([
      {
        roots: [
          rootWith('a', dock('RightBottom', 'b', 'LeftBottom')),
          rootWith('b', dock('RightBottom', 'c', 'LeftBottom')),
          rootWith('c'),
        ],
      },
    ]);
  });

  it('accepts one joint written on both roots', async () => {
    await expectLoaded([
      {
        roots: [
          rootWith('a', dock('RightBottom', 'b', 'LeftBottom')),
          rootWith('b', dock('LeftBottom', 'a', 'RightBottom')),
        ],
      },
    ]);
  });

  it('accepts a row to the left and a row to the right of one root', async () => {
    await expectLoaded([
      {
        roots: [
          rootWith(
            'c1',
            dock('RightBottom', 'r1', 'LeftBottom'),
            dock('LeftBottom', 'l1', 'RightBottom'),
          ),
          rootWith('r1'),
          rootWith('l1'),
        ],
      },
    ]);
  });

  it('accepts several wall units above one base unit and beside each other', async () => {
    // w1 sits on b1's LeftTop, w2 on b2's LeftTop and beside w1: w2's
    // LeftBottom is claimed by a stacking joint and a beside joint - fine
    await expectLoaded([
      {
        roots: [
          rootWith(
            'b1',
            dock('RightBottom', 'b2', 'LeftBottom'),
            dock('LeftTop', 'w1', 'LeftBottom', [0, 600, 0]),
            dock('LeftTop', 'w3', 'LeftBottom', [300, 600, 0]),
          ),
          rootWith('b2', dock('LeftTop', 'w2', 'LeftBottom', [0, 600, 0])),
          rootWith('w1', dock('RightBottom', 'w2', 'LeftBottom')),
          rootWith('w2'),
          rootWith('w3'),
        ],
      },
    ]);
  });

  it('accepts a root docked beside one root and back to back with another', async () => {
    await expectLoaded([
      {
        roots: [
          rootWith('a', dock('RightBottom', 'b', 'LeftBottom')),
          rootWith('b', dock('BackBottom', 'c', 'BackBottom')),
          rootWith('c'),
        ],
      },
    ]);
  });
});

describe('create-or-replace-groups room bounds', () => {
  const inside = { x: [3400, 4000], z: [-3000, -2400], widthMm: 600, depthMm: 600 };
  const flushCorner = { x: [3439, 4000], z: [-3000, -1500], widthMm: 561, depthMm: 1500 };
  const pastBackWall = { x: [3439, 4000], z: [-3600, -2100], widthMm: 561, depthMm: 1500 };
  const pastRightWall = { x: [3600, 4200], z: [-2000, -1400], widthMm: 600, depthMm: 600 };

  // a planner whose groups fetch answers the pre-load fetch with `before`
  // and the post-load fetch with `after`, together with the rooms
  const createLoadApi = ({
    before = [],
    after,
    rooms = { rooms: [room] } as unknown,
  }: {
    before?: unknown[];
    after: unknown[];
    rooms?: unknown; // null: the context carries no rooms section
  }) => {
    let groupsFetches = 0;
    return createApi(planContextFixture, {
      getExternalObjectPlanContext: vi.fn(async (sections: string[]) => {
        if (sections.includes('articles')) {
          return { articles: [articleFixture] };
        }
        groupsFetches += 1;
        return {
          ...(sections.includes('rooms') && rooms !== null && { rooms }),
          groups: groupsFetches === 1 ? before : after,
        };
      }),
    });
  };

  const positioned = (id: string, footprint: unknown, pos: number[] = [4000, 0, -3000]) =>
    makeShapedGroup({ id, position: { pos, rotationY: 270, footprint } });

  const create = async (api: ReturnType<typeof createApi>, posGroups: unknown[] = [{ roots: [pick()] }]) =>
    (await toolExecutors['create-or-replace-groups'](api, { posGroups })) as Record<string, any>;

  it('requests the rooms together with the groups before the load', async () => {
    const api = createLoadApi({ after: [positioned('g1', inside)] });
    await create(api);
    expect(api.extended.getExternalObjectPlanContext).toHaveBeenNthCalledWith(2, [
      'rooms',
      'groups',
    ]);
  });

  it('hints at a created group whose footprint crosses the back wall', async () => {
    const api = createLoadApi({ after: [positioned('g1', pastBackWall)] });
    const result = await create(api);
    expect(result.loaded).toEqual([{ id: 'loaded-1' }]);
    expect(result.hint).toBe(
      'Group g1 extends beyond the room: footprint x [3439, 4000], z [-3600, -2100], ' +
        'room x [0, 4000], z [-3000, 0]. Its anchor is where posGroup put it, so a unit is docked ' +
        "past a wall - with posGroup at a wall's end the row continues from the anchor's RightBottom only. " +
        'Fix the docking and resubmit the group with its id; see get-authoring-rules.',
    );
  });

  it('hints at a group crossing the right wall', async () => {
    const api = createLoadApi({ after: [positioned('g1', pastRightWall)] });
    expect((await create(api)).hint).toMatch(/Group g1 extends beyond the room: footprint x \[3600, 4200\]/);
  });

  it('gives no hint for a group inside the room or flush in a corner', async () => {
    for (const footprint of [inside, flushCorner]) {
      const api = createLoadApi({ after: [positioned('g1', footprint)] });
      expect((await create(api)).hint).toBeUndefined();
    }
  });

  it('hints at a replaced group but not at an untouched group outside the room', async () => {
    const untouched = positioned('old', pastBackWall);
    const api = createLoadApi({
      before: [untouched, positioned('g1', inside)],
      after: [untouched, positioned('g1', pastBackWall)],
    });
    const result = await create(api, [{ ...makeShapedGroup({ id: 'g1' }) }]);
    expect(result.hint).toMatch(/^Group g1 extends beyond the room/);
    expect(result.hint).not.toMatch(/Group old/);
  });

  it('combines the unpositioned and the out-of-room hints', async () => {
    const api = createLoadApi({
      after: [
        makeShapedGroup({ id: 'g2', position: { pos: undefined, footprint: pastBackWall } }),
        positioned('g3', pastBackWall),
      ],
    });
    const result = await create(api, [{ roots: [pick()] }, { roots: [pick()] }]);
    expect(result.hint).toMatch(/^Groups g2 are not positioned yet[^\n]*\nGroup g3 extends beyond the room/);
  });

  it('checks the floor contour, not its bounding box, in an L-shaped room', async () => {
    // 4000 x 3000 with the 1500 x 1500 front right quarter cut away
    const lShapedRoom = {
      levels: [
        {
          level: 0,
          segments: [
            { cmd: 'M', pos: [0, 0, 0] },
            { cmd: 'L', pos: [2500, 0, 0], type: 'wall' },
            { cmd: 'L', pos: [2500, 0, -1500], type: 'wall' },
            { cmd: 'L', pos: [4000, 0, -1500], type: 'wall' },
            { cmd: 'L', pos: [4000, 0, -3000], type: 'wall' },
            { cmd: 'L', pos: [0, 0, -3000], type: 'wall' },
            { cmd: 'Z', pos: [0, 0, 0], type: 'wall' },
          ],
        },
      ],
      walls: [],
    };
    const inNotch = { x: [3000, 3600], z: [-1000, -400], widthMm: 600, depthMm: 600 };
    const inArm = { x: [3000, 3600], z: [-2500, -1900], widthMm: 600, depthMm: 600 };
    const rooms = { rooms: [lShapedRoom] };
    expect(
      (await create(createLoadApi({ after: [positioned('g1', inNotch)], rooms }))).hint,
    ).toMatch(/Group g1 extends beyond the room: footprint x \[3000, 3600\], z \[-1000, -400\], room x \[0, 4000\], z \[-3000, 0\]/);
    expect(
      (await create(createLoadApi({ after: [positioned('g1', inArm)], rooms }))).hint,
    ).toBeUndefined();
  });

  it('accepts a group inside any room of a plan with several rooms', async () => {
    const secondRoom = {
      levels: [
        {
          level: 0,
          segments: [
            { cmd: 'M', pos: [5000, 0, 0] },
            { cmd: 'L', pos: [8000, 0, 0], type: 'wall' },
            { cmd: 'L', pos: [8000, 0, -3000], type: 'wall' },
            { cmd: 'L', pos: [5000, 0, -3000], type: 'wall' },
            { cmd: 'L', pos: [5000, 0, 0], type: 'wall' },
          ],
        },
      ],
      walls: [],
    };
    const inSecondRoom = { x: [6000, 6600], z: [-2000, -1400], widthMm: 600, depthMm: 600 };
    const api = createLoadApi({
      after: [positioned('g1', inSecondRoom)],
      rooms: { rooms: [room, secondRoom] },
    });
    expect((await create(api)).hint).toBeUndefined();
  });

  it('skips the check without a room contour or without a footprint', async () => {
    const noRooms = createLoadApi({ after: [positioned('g1', pastBackWall)], rooms: null });
    expect((await create(noRooms)).hint).toBeUndefined();
    const emptyRooms = createLoadApi({ after: [positioned('g1', pastBackWall)], rooms: { rooms: [] } });
    expect((await create(emptyRooms)).hint).toBeUndefined();
    const noFootprint = createLoadApi({ after: [positioned('g1', undefined)] });
    expect((await create(noFootprint)).hint).toBeUndefined();
  });
});
