import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetCornerFrames, toolExecutors } from '../tool-executors';

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
    externalObjectGroupOperation: vi.fn(async (command: string) => ({
      command,
      groups: [],
      removedGroupIds: [],
    })),
    fetchPrice: vi.fn(async () => ({ price: 42 })),
    getExternalObjectSnapshot: vi.fn(async () => ({})),
    getExternalObjectGroups: vi.fn(async () => []),
    removeExternalObject: vi.fn(async () => undefined),
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
    // the plan context arrives agent-ready from the planner API; only the
    // articles' cornerArticle flag is completed
    expect(result).toEqual({
      ...planContextFixture,
      articles: [{ ...articleFixture, cornerArticle: false }],
    });
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

  it('keeps the corner point of the articles to the server', async () => {
    const cornerArticle = {
      ...articleFixture,
      articleId: 'corner-1',
      cornerArticle: true,
      cornerPoint: [-261, 0, 0],
    };
    const api = createApi({ articles: [articleFixture, cornerArticle] });
    const result = (await toolExecutors['get-plan-context'](api, {
      include: ['articles'],
    })) as Record<string, any>;
    const { cornerPoint: _cornerPoint, ...withoutCornerPoint } = cornerArticle;
    expect(result.articles).toEqual([
      { ...articleFixture, cornerArticle: false },
      withoutCornerPoint,
    ]);
    expect(result.articles[1].cornerArticle).toBe(true);
  });

  it('flags a corner article on an empty plan, where the planner has not derived the flag yet', async () => {
    const uncalculatedCorner = {
      ...articleFixture,
      articleId: 'EUERTB90',
      category: 'Kitchen handleless | Base Units | Corner',
      cornerArticle: false,
    };
    const api = createApi({ articles: [uncalculatedCorner] });
    const result = (await toolExecutors['get-plan-context'](api, {
      include: ['articles'],
    })) as Record<string, any>;
    expect(result.articles[0].cornerArticle).toBe(true);
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
      /roots 'u2' are not docked to a placed root \('u1' is placed/,
    );
  });

  it('rejects roots docked only among themselves', async () => {
    const dockedRight = (id: string) => ({
      dockedRoots: [
        {
          ownDockingVector: 'RightBottom',
          dockedRoots: [{ id, dockingVector: 'LeftBottom' }],
        },
      ],
    });
    await expectRejectedBeforeLoad(
      [
        {
          roots: [
            { id: 'c', articleId: 'article-1', contextData: dockedRight('f') },
            { id: 's', articleId: 'article-1', contextData: dockedRight('o') },
            { id: 'o', articleId: 'article-1' },
            { id: 'f', articleId: 'article-1' },
          ],
        },
      ],
      /roots 's', 'o' are not docked to a placed root \('c', 'f' are placed/,
    );
  });

  it('does not count a docking to a root outside the group as connecting', async () => {
    // a merged group whose middle unit was deleted: both roots still name it
    const dockedTo = (ownDockingVector: string, dockingVector: string) => ({
      dockedRoots: [
        { ownDockingVector, dockedRoots: [{ id: 'deleted', dockingVector }] },
      ],
    });
    await expectRejectedBeforeLoad(
      [
        {
          roots: [
            { id: 'u1', articleId: 'article-1', contextData: dockedTo('RightBottom', 'LeftBottom') },
            { id: 'u2', articleId: 'article-1', contextData: dockedTo('LeftBottom', 'RightBottom') },
          ],
        },
      ],
      /roots 'u2' are not docked to a placed root \('u1' is placed/,
    );
  });

  it('rejects repositioningData and points to placement', async () => {
    await expectRejectedBeforeLoad(
      [
        {
          roots: [pick()],
          repositioningData: { posGroup: [0, 0, 0], posRotationY: 0, rootId: 'u1' },
        },
      ],
      /repositioningData is not supported - position the group with placement/,
    );
  });

  it('rejects an invalid placement', async () => {
    const withPlacement = (placement: unknown) => [
      { roots: [pick()], placement },
    ];
    await expectRejectedBeforeLoad(
      withPlacement('right'),
      /placement must be \{ posGroup, posRotationY, rootId\? \}/,
    );
    await expectRejectedBeforeLoad(
      withPlacement({ posGroup: [0, 0], posRotationY: 0 }),
      /placement: posGroup must be \[x, y, z\] in millimetres/,
    );
    await expectRejectedBeforeLoad(
      withPlacement({ posGroup: [0, '0', 0], posRotationY: 0 }),
      /placement: posGroup must be \[x, y, z\] in millimetres/,
    );
    await expectRejectedBeforeLoad(
      withPlacement({ posGroup: [0, 0, 0], posRotationY: '90' }),
      /placement: posRotationY must be a number of degrees/,
    );
    // posRotationY is required: 0 must be stated explicitly
    await expectRejectedBeforeLoad(
      withPlacement({ posGroup: [0, 0, 0] }),
      /placement: posRotationY must be a number of degrees/,
    );
    await expectRejectedBeforeLoad(
      withPlacement({ posGroup: [0, 0, 0], posRotationY: 0, rootId: 'u9' }),
      /placement: rootId must be the id of one of the group's roots/,
    );
    await expectRejectedBeforeLoad(
      withPlacement({ wall: 'right', alignment: 'top' }),
      /placement takes only posGroup, posRotationY and rootId - remove wall, alignment - to stand a group against a wall or into a corner by its side label, call place-group/,
    );
    await expectRejectedBeforeLoad(
      withPlacement({ posGroup: [0, 0, 0], posRotationY: 0, scale: 2 }),
      /placement takes only posGroup, posRotationY and rootId - remove scale\n/,
    );
  });

  it('rejects a placement on a group that is already in the plan', async () => {
    const api = createApi(planContextFixture);
    await expect(
      toolExecutors['create-or-replace-groups'](api, {
        posGroups: [
          {
            ...makeShapedGroup(),
            placement: { posGroup: [0, 0, 0], posRotationY: 0 },
          },
        ],
      }),
    ).rejects.toThrow(
      /placement positions a new group only - group 'g1' is already in the plan; resubmit it without placement to keep its position, or move it with place-group/,
    );
    expect(api.extended.loadExternalObjectGroupLayout).not.toHaveBeenCalled();
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

  it('rejects two roots on one side vector at the same place', async () => {
    // the corner and the fridge both meet the oven's RightBottom; the corner's
    // entry is written on the corner, so it reaches the oven mirrored
    const kitchen = (cornerMode?: string, fridgeMode?: string) => [
      {
        roots: [
          {
            id: 'corner',
            articleId: 'article-1',
            contextData: {
              dockedRoots: [
                {
                  ownDockingVector: 'LeftBottom',
                  dockedRoots: [
                    { id: 'oven', dockingVector: 'RightBottom', ...(cornerMode && { mode: cornerMode }) },
                  ],
                },
              ],
            },
          },
          {
            id: 'oven',
            articleId: 'article-1',
            contextData: {
              dockedRoots: [
                {
                  ownDockingVector: 'RightBottom',
                  dockedRoots: [
                    { id: 'fridge', dockingVector: 'LeftBottom', ...(fridgeMode && { mode: fridgeMode }) },
                  ],
                },
              ],
            },
          },
          { id: 'fridge', articleId: 'article-1' },
        ],
      },
    ];
    await expectRejectedBeforeLoad(
      kitchen(),
      /posGroups\[0\]: roots 'corner', 'fridge' are docked to the RightBottom of root 'oven' with the same mode and offset - they stand in the same place/,
    );
    await expectRejectedBeforeLoad(
      kitchen('EndStart', 'StartEnd'),
      /roots 'corner', 'fridge' are docked to the RightBottom of root 'oven' with the same mode and offset/,
    );
  });
});

describe('create-or-replace-groups loading', () => {
  beforeEach(() => forgetCornerFrames());

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

  it('positions a new row by its leftmost root in one load, whatever order it is authored in', async () => {
    const api = createApi(planContextFixture);
    const placement = { posGroup: [4000, 0, -3000], posRotationY: 270 };
    const dockedLeft = (id: string) => ({
      dockedRoots: [
        {
          ownDockingVector: 'LeftBottom',
          dockedRoots: [{ id, dockingVector: 'RightBottom' }],
        },
      ],
    });
    const rightToLeft = [
      { id: 'u3', articleId: 'article-1', contextData: dockedLeft('u2') },
      { id: 'u2', articleId: 'article-1', contextData: dockedLeft('u1') },
      { id: 'u1', articleId: 'article-1' },
    ];
    await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [{ roots: rightToLeft, placement }],
    });
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledTimes(1);
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledWith(
      {
        posGroups: [
          {
            roots: rightToLeft,
            repositioningData: { ...placement, rootId: 'u1' },
          },
        ],
      },
      'posGroups',
      { reason: 'adjusted' },
    );
  });

  it('positions a new corner kitchen by the corner article, calculated once by a probe', async () => {
    const cornerArticle = {
      ...articleFixture,
      articleId: 'corner-1',
      cornerArticle: true,
    };
    let loads = 0;
    const api = createApi(
      { ...planContextFixture, articles: [articleFixture, cornerArticle] },
      {
        loadExternalObjectGroupLayout: vi.fn(async () => [{ id: `loaded-${++loads}` }]),
        getExternalObjectGroups: vi.fn(async () =>
          loads === 1
            ? [{ id: 'probe-group', roots: [{ id: 'p1', articleId: 'corner-1', dockInfos: [
                { id: 'LeftBackBottom', start: [-261, 0, 0], end: [-261, 0, 661] },
                { id: 'RightBackBottom', start: [-261, 0, 0], end: [900, 0, 0] },
              ] }] }]
            : [],
        ),
      },
    );
    const lShape = [
      { id: 'r1', articleId: 'article-1' },
      {
        id: 'c1',
        articleId: 'corner-1',
        contextData: {
          dockedRoots: [
            {
              ownDockingVector: 'RightBottom',
              dockedRoots: [{ id: 'r1', dockingVector: 'LeftBottom' }],
            },
            {
              ownDockingVector: 'LeftBottom',
              dockedRoots: [{ id: 'l1', dockingVector: 'RightBottom' }],
            },
          ],
        },
      },
      { id: 'l1', articleId: 'article-1' },
    ];
    await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        {
          roots: lShape,
          placement: { posGroup: [4815, 0, -3765], posRotationY: 270 },
        },
      ],
    });
    // the probe, then the kitchen
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledTimes(2);
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenLastCalledWith(
      {
        posGroups: [
          {
            roots: lShape,
            repositioningData: {
              // the corner point [-261, 0, 0] of c1 lands at the corner: the
              // origin offset [261, 0, 0], turned by 270, points to room +z
              posGroup: [4815, 0, -3504],
              posRotationY: 270,
              rootId: 'c1',
            },
          },
        ],
      },
      'posGroups',
      { reason: 'adjusted' },
    );
  });

  describe('corner probe', () => {

    const loadPayload = (api: any, call: number) =>
      api.extended.loadExternalObjectGroupLayout.mock.calls[call][0];

    const cornerArticle = {
      ...articleFixture,
      articleId: 'EUERTB90',
      cornerArticle: true,
      rootModules: [{ module: { id: 'mr_CornerunitStraight' } }],
    };
    const otherCornerArticle = {
      ...cornerArticle,
      articleId: 'UERTB90',
    };
    const calculatedProbe = (articleId: string) => ({
      id: 'probe-group',
      roots: [
        {
          id: 'p1',
          articleId,
          name: 'mr_CornerunitStraight',
          dockInfos: [
            { id: 'LeftBackBottom', start: [-261, 0, 0], end: [-261, 0, 661] },
            { id: 'RightBackBottom', start: [-261, 0, 0], end: [900, 0, 0] },
          ],
        },
      ],
    });
    // the right-handed corner article as the planner calculates it: its corner
    // point on the right, its back edges turned by 270 degrees
    const rightHandedProbe = (articleId: string) => ({
      id: 'probe-group',
      roots: [
        {
          id: 'p1',
          articleId,
          name: 'mr_CornerunitStraight',
          dockInfos: [
            { id: 'LeftBackBottom', start: [1161, 0, 0], end: [0, 0, 0] },
            { id: 'RightBackBottom', start: [1161, 0, 0], end: [1161, 0, 661] },
          ],
        },
      ],
    });
    const rightHandedArticle = { ...cornerArticle, articleId: 'UELTB90' };
    const placement = { posGroup: [4815, 0, -3765], posRotationY: 270 };
    const kitchen = (articleId: string, attributes?: object[]) => ({
      libraryId: 'lib-1',
      roots: [{ id: 'c1', articleId, ...(attributes && { attributes }) }],
      placement,
    });
    // every load before the probe's own read counts: the probe is the first load
    const probingApi = (catalog: object[], probeGroups: (load: number) => object[], planGroups: object[] = []) => {
      let loads = 0;
      return createApi(
        { ...planContextFixture, articles: [articleFixture, ...catalog], groups: [] },
        {
          loadExternalObjectGroupLayout: vi.fn(async () => [{ id: `loaded-${++loads}` }]),
          getExternalObjectGroups: vi.fn(async () => [...planGroups, ...probeGroups(loads)]),
        },
      );
    };

    it('has the planner calculate the corner article once, removes the probe and loads the group at the corrected point', async () => {
      // an empty plan: no calculated corner article anywhere
      let loads = 0;
      const api = createApi(
        { ...planContextFixture, articles: [articleFixture, cornerArticle], groups: [] },
        {
          loadExternalObjectGroupLayout: vi.fn(async () => [{ id: `loaded-${++loads}` }]),
          getExternalObjectGroups: vi.fn(async () =>
            loads === 1 ? [calculatedProbe('EUERTB90')] : [],
          ),
        },
      );
      const result = (await toolExecutors['create-or-replace-groups'](api, {
        posGroups: [kitchen('EUERTB90')],
      })) as Record<string, any>;

      const { loadExternalObjectGroupLayout, removeExternalObject } = api.extended;
      expect(loadExternalObjectGroupLayout).toHaveBeenCalledTimes(2);
      expect(loadExternalObjectGroupLayout).toHaveBeenNthCalledWith(
        1,
        { posGroups: [{ libraryId: 'lib-1', roots: [{ id: 'corner-probe', articleId: 'EUERTB90' }] }] },
        'posGroups',
        { reason: 'adjusted' },
      );
      expect(removeExternalObject).toHaveBeenCalledWith('probe-group');
      expect(loadExternalObjectGroupLayout).toHaveBeenNthCalledWith(
        2,
        {
          posGroups: [
            {
              libraryId: 'lib-1',
              roots: [{ id: 'c1', articleId: 'EUERTB90' }],
              repositioningData: { posGroup: [4815, 0, -3504], posRotationY: 270, rootId: 'c1' },
            },
          ],
        },
        'posGroups',
        { reason: 'adjusted' },
      );
      // the probe is removed before the group is loaded
      const order = [
        ...vi.mocked(loadExternalObjectGroupLayout).mock.invocationCallOrder,
        ...vi.mocked(removeExternalObject).mock.invocationCallOrder,
      ];
      expect(order[2]).toBeLessThan(order[1]);
      // the agent sees only the real load
      expect(result.loaded).toEqual([{ id: 'loaded-2' }]);
    });

    it('turns a right-handed corner article by 90 degrees and puts its corner point into the corner', async () => {
      // "test the mcp" 17:48, prompt 04: UELTB90 at 270 stood behind the back wall
      const api = probingApi([rightHandedArticle], (load) => (load === 1 ? [rightHandedProbe('UELTB90')] : []));
      await toolExecutors['create-or-replace-groups'](api, { posGroups: [kitchen('UELTB90')] });
      expect(loadPayload(api, 1).posGroups[0].repositioningData).toEqual({
        posGroup: [3654, 0, -3765],
        posRotationY: 0,
        rootId: 'c1',
      });
    });

    it('probes the anchor with its attributes and keeps one frame per attribute set', async () => {
      // "test the mcp" 16:04, prompt 04: UERTB90 with the carcase direction Right
      const right = [{ id: 'mod_CarcaseDirection', value: 'Right' }];
      const api = probingApi([otherCornerArticle], (load) =>
        load === 1 ? [rightHandedProbe('UERTB90')] : load === 3 ? [calculatedProbe('UERTB90')] : [],
      );
      await toolExecutors['create-or-replace-groups'](api, { posGroups: [kitchen('UERTB90', right)] });
      await toolExecutors['create-or-replace-groups'](api, { posGroups: [kitchen('UERTB90')] });
      await toolExecutors['create-or-replace-groups'](api, { posGroups: [kitchen('UERTB90', right)] });

      expect(loadPayload(api, 0)).toEqual({
        posGroups: [{ libraryId: 'lib-1', roots: [{ id: 'corner-probe', articleId: 'UERTB90', attributes: right }] }],
      });
      expect(loadPayload(api, 1).posGroups[0].repositioningData).toEqual({
        posGroup: [3654, 0, -3765], posRotationY: 0, rootId: 'c1',
      });
      expect(loadPayload(api, 2)).toEqual({
        posGroups: [{ libraryId: 'lib-1', roots: [{ id: 'corner-probe', articleId: 'UERTB90' }] }],
      });
      expect(loadPayload(api, 3).posGroups[0].repositioningData).toEqual({
        posGroup: [4815, 0, -3504], posRotationY: 270, rootId: 'c1',
      });
      // the third call reuses the frame of the first: no probe
      expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledTimes(5);
      expect(loadPayload(api, 4).posGroups[0].repositioningData.posRotationY).toBe(0);
    });

    it('probes another article of the same module again', async () => {
      const api = probingApi([cornerArticle, rightHandedArticle], (load) =>
        load === 1 ? [calculatedProbe('EUERTB90')] : load === 3 ? [rightHandedProbe('UELTB90')] : [],
      );
      await toolExecutors['create-or-replace-groups'](api, { posGroups: [kitchen('EUERTB90')] });
      await toolExecutors['create-or-replace-groups'](api, { posGroups: [kitchen('UELTB90')] });

      expect(api.extended.removeExternalObject).toHaveBeenCalledTimes(2);
      expect(loadPayload(api, 1).posGroups[0].repositioningData.posGroup).toEqual([4815, 0, -3504]);
      expect(loadPayload(api, 3).posGroups[0].repositioningData).toEqual({
        posGroup: [3654, 0, -3765], posRotationY: 0, rootId: 'c1',
      });
    });

    it('probes although the plan has a calculated root of the same corner article', async () => {
      // its attributes may differ from the anchor's; the probe keeps the plan's groups
      const inPlan = { ...calculatedProbe('EUERTB90'), id: 'kitchen-1' };
      const api = probingApi([cornerArticle], (load) => (load === 1 ? [calculatedProbe('EUERTB90')] : []), [inPlan]);
      await toolExecutors['create-or-replace-groups'](api, { posGroups: [kitchen('EUERTB90')] });

      expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledTimes(2);
      expect(api.extended.removeExternalObject).toHaveBeenCalledTimes(1);
      expect(api.extended.removeExternalObject).toHaveBeenCalledWith('probe-group');
    });

    it('rejects the call instead of loading the group off the corner when the probe yields no calculated group', async () => {
      const api = createApi(
        { ...planContextFixture, articles: [articleFixture, cornerArticle], groups: [] },
        { getExternalObjectGroups: vi.fn(async () => []) },
      );
      await expect(
        toolExecutors['create-or-replace-groups'](api, { posGroups: [kitchen('EUERTB90')] }),
      ).rejects.toThrow(
        /Nothing was loaded: the corner article 'EUERTB90' of posGroups\[0\] could not be calculated/,
      );
      // only the probe was loaded, and it left nothing behind
      expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledTimes(1);
      expect(api.extended.removeExternalObject).not.toHaveBeenCalled();
    });

    it('removes every group the probe load added, whatever its roots are called', async () => {
      const inPlan = { id: 'kitchen-1', roots: [{ id: 'k1', articleId: 'article-1' }] };
      let loads = 0;
      const api = createApi(
        { ...planContextFixture, articles: [articleFixture, cornerArticle], groups: [] },
        {
          loadExternalObjectGroupLayout: vi.fn(async () => [{ id: `loaded-${++loads}` }]),
          getExternalObjectGroups: vi.fn(async () =>
            loads === 1
              ? [inPlan, { ...calculatedProbe('regenerated-article-id'), id: 'probe-group' }]
              : [inPlan],
          ),
        },
      );
      await toolExecutors['create-or-replace-groups'](api, { posGroups: [kitchen('EUERTB90')] });

      expect(api.extended.removeExternalObject).toHaveBeenCalledTimes(1);
      expect(api.extended.removeExternalObject).toHaveBeenCalledWith('probe-group');
      // the frame comes from the probe's roots all the same
      expect(loadPayload(api, 1).posGroups[0].repositioningData.posGroup).toEqual([4815, 0, -3504]);
    });

    it.each([
      [
        'its corner point is the origin',
        [
          { id: 'LeftBackBottom', start: [0, 0, 0], end: [0, 0, 661] },
          { id: 'RightBackBottom', start: [0, 0, 0], end: [900, 0, 0] },
        ],
      ],
      ['it has no corner vectors', [{ id: 'LeftBottom', start: [0, 0, 0], end: [0, 0, 600] }]],
    ])('probes a corner article only once when %s and adds no offset', async (_case, dockInfos) => {
      let loads = 0;
      const api = createApi(
        { ...planContextFixture, articles: [articleFixture, cornerArticle], groups: [] },
        {
          loadExternalObjectGroupLayout: vi.fn(async () => [{ id: `loaded-${++loads}` }]),
          getExternalObjectGroups: vi.fn(async () =>
            loads === 1
              ? [{ id: 'probe-group', roots: [{ id: 'p1', articleId: 'EUERTB90', dockInfos }] }]
              : [],
          ),
        },
      );
      await toolExecutors['create-or-replace-groups'](api, { posGroups: [kitchen('EUERTB90')] });
      await toolExecutors['create-or-replace-groups'](api, { posGroups: [kitchen('EUERTB90')] });

      expect(api.extended.removeExternalObject).toHaveBeenCalledTimes(1);
      // probe + two real loads
      expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledTimes(3);
      for (const call of [1, 2]) {
        expect(loadPayload(api, call).posGroups[0].repositioningData.posGroup).toEqual([
          4815, 0, -3765,
        ]);
      }
    });

    it('probes although the catalog has a corner point - it tells neither the hand nor the attributes', async () => {
      const api = probingApi([{ ...cornerArticle, cornerPoint: [0, 0, 0] }], (load) =>
        load === 1 ? [calculatedProbe('EUERTB90')] : [],
      );
      await toolExecutors['create-or-replace-groups'](api, { posGroups: [kitchen('EUERTB90')] });
      expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledTimes(2);
      expect(loadPayload(api, 1).posGroups[0].repositioningData.posGroup).toEqual([4815, 0, -3504]);
    });
  });

  it('does not ask for the raw groups when no corner article is placed', async () => {
    const api = createApi(planContextFixture);
    await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [{ roots: [pick()], placement: { posGroup: [4000, 0, -3000], posRotationY: 270 } }],
    });
    expect(api.extended.getExternalObjectGroups).not.toHaveBeenCalled();
  });

  it('replaces an existing group resubmitted without placement, which keeps its position', async () => {
    const api = createApi(planContextFixture);
    // the group exactly as get-plan-context returns it
    await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [makeShapedGroup()],
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
          },
        ],
      },
      'posGroups',
      { reason: 'adjusted' },
    );
  });

  it('accepts a root docked by an entry written on the new root', async () => {
    const api = createApi(planContextFixture);
    const roots = [
      { id: 'u1', articleId: 'article-1' },
      {
        id: 'u2',
        articleId: 'article-1',
        contextData: {
          dockedRoots: [
            {
              ownDockingVector: 'LeftBottom',
              dockedRoots: [{ id: 'u1', dockingVector: 'RightBottom' }],
            },
          ],
        },
      },
    ];
    await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [{ libraryId: 'lib-1', roots }],
    });
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledWith(
      { posGroups: [{ libraryId: 'lib-1', roots }] },
      'posGroups',
      { reason: 'adjusted' },
    );
  });

  it('accepts a group resubmitted with a docking to a root deleted from it', async () => {
    const api = createApi(planContextFixture);
    // get-plan-context after delete-root-module: r2 still names the deleted root
    const roots = [
      {
        id: 'r1',
        articleId: 'article-1',
        contextData: {
          dockedRoots: [
            {
              ownDockingVector: 'RightBottom',
              dockedRoots: [{ id: 'r2', dockingVector: 'LeftBottom' }],
            },
          ],
        },
      },
      {
        id: 'r2',
        articleId: 'article-1',
        contextData: {
          dockedRoots: [
            {
              ownDockingVector: 'RightBottom',
              dockedRoots: [{ id: 'deleted', dockingVector: 'LeftBottom' }],
            },
          ],
        },
      },
    ];
    await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [makeShapedGroup({ roots })],
    });
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledWith(
      { posGroups: [{ id: 'g1', libraryId: 'lib-1', roots }] },
      'posGroups',
      { reason: 'adjusted' },
    );
  });

  it('fetches the article catalog once per call', async () => {
    const api = createApi(planContextFixture);
    await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        {
          roots: [pick()],
          placement: { posGroup: [0, 0, 0], posRotationY: 0 },
        },
        { roots: [pick()] },
      ],
    });
    const { getExternalObjectPlanContext } = api.extended;
    expect(getExternalObjectPlanContext).toHaveBeenCalledTimes(3);
    expect(getExternalObjectPlanContext).toHaveBeenNthCalledWith(1, ['articles']);
    expect(getExternalObjectPlanContext).toHaveBeenNthCalledWith(2, ['groups']);
    expect(getExternalObjectPlanContext).toHaveBeenNthCalledWith(3, ['groups']);
  });

  it('hints at placement for a created group without a position', async () => {
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
    expect(result.hint).toMatch(/Groups g2 are not positioned/);
    expect(result.hint).toMatch(/placement/);
    expect(result.hint).toMatch(/place-group moves it against a wall or into a room corner/);
    expect(result.hint).not.toMatch(/repositioningData/);
  });

  it('accepts several roots on one vector where they do not take the same place', async () => {
    const dock = (
      ownDockingVector: string,
      id: string,
      dockingVector: string,
      offset?: number[],
    ) => ({ ownDockingVector, dockedRoots: [{ id, dockingVector, ...(offset && { offset }) }] });
    const api = createApi(planContextFixture);
    await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        {
          roots: [
            // beside the tall unit: a base unit on the floor and a wall unit
            // at mounting height, both on its RightBottom
            {
              id: 'tall',
              articleId: 'article-1',
              contextData: {
                dockedRoots: [
                  dock('RightBottom', 'base', 'LeftBottom'),
                  dock('RightBottom', 'wall', 'LeftBottom', [0, 1400, 0]),
                ],
              },
            },
            // mirrored as get-plan-context returns it, plus the wall unit
            // above and the neighbour's top edge on the base unit's LeftTop
            {
              id: 'base',
              articleId: 'article-1',
              contextData: {
                dockedRoots: [
                  dock('LeftBottom', 'tall', 'RightBottom'),
                  dock('LeftTop', 'wall', 'LeftBottom', [0, 600, 0]),
                  dock('LeftTop', 'tall', 'RightTop'),
                ],
              },
            },
            { id: 'wall', articleId: 'article-1' },
          ],
        },
      ],
    });
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledTimes(1);
  });

  it('accepts roots on one side vector that the mode or the offset separates', async () => {
    // beside a deep tall unit: a shallow unit at the back, one at the front,
    // and one further along the row
    const api = createApi(planContextFixture);
    await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        {
          roots: [
            {
              id: 'tall',
              articleId: 'article-1',
              contextData: {
                dockedRoots: [
                  {
                    ownDockingVector: 'RightBottom',
                    dockedRoots: [
                      { id: 'back', dockingVector: 'LeftBottom', mode: 'StartStart' },
                      { id: 'front', dockingVector: 'LeftBottom', mode: 'EndEnd' },
                      { id: 'gap', dockingVector: 'LeftBottom', offset: [600, 0, 0] },
                    ],
                  },
                ],
              },
            },
            { id: 'back', articleId: 'article-1' },
            { id: 'front', articleId: 'article-1' },
            { id: 'gap', articleId: 'article-1' },
          ],
        },
      ],
    });
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledTimes(1);
  });
});

describe('place-group', () => {
  // a calculated group as getExternalObjectGroups returns it (raw), next to
  // the shaped groups of the plan context
  const makeRoot = (overrides: Record<string, unknown> = {}) => ({
    id: 'r1',
    articleId: 'article-1',
    articlePos: [0, 0, 0],
    rotationY: 0,
    attributes: [
      { id: 'b', value: 800, isInput: true },
      { id: 't', value: 600, isInput: true },
    ],
    dockInfos: [{ id: 'LeftBottom' }, { id: 'RightBottom' }],
    contextData: { dockedRoots: [] },
    modules: [],
    ...overrides,
  });

  const makeGroup = (overrides: Record<string, unknown> = {}) => ({
    id: 'g1',
    libraryId: 'lib-1',
    pos: [0, 0, 0],
    rotationY: 0,
    roots: [makeRoot()],
    logMessages: [],
    ...overrides,
  });

  // mr_CornerunitStraight as calculated: the corner point lies 261 mm left of
  // the root origin
  const cornerDockInfos = [
    { id: 'LeftBackBottom', start: [-261, 0, 0], end: [-261, 0, 661] },
    { id: 'RightBackBottom', start: [-261, 0, 0], end: [900, 0, 0] },
  ];

  const createPlaceApi = (
    shapedGroups: any[],
    rawGroups: any[],
    afterShapedGroups: any[] = shapedGroups,
  ) =>
    createApi(undefined, {
      getExternalObjectPlanContext: vi.fn(async (sections: string[]) =>
        sections.includes('rooms')
          ? { rooms: { rooms: [room] }, groups: shapedGroups }
          : { groups: afterShapedGroups },
      ),
      getExternalObjectGroups: vi.fn(async () => rawGroups),
      loadExternalObjectGroupLayout: vi.fn(async () => [{ id: 'g1' }]),
    });

  const reloadedGroup = (api: ReturnType<typeof createPlaceApi>) => {
    const calls = api.extended.loadExternalObjectGroupLayout.mock
      .calls as unknown as any[][];
    expect(calls).toHaveLength(1);
    return calls[0][0].posGroups[0];
  };

  it('rejects an unknown group id', async () => {
    const api = createPlaceApi([makeShapedGroup({ id: 'g7' })], []);
    await expect(
      toolExecutors['place-group'](api, { groupId: 'nope', wall: 'right' }),
    ).rejects.toThrow(/Group 'nope' not found. Groups in the plan: g7/);
    expect(api.extended.loadExternalObjectGroupLayout).not.toHaveBeenCalled();
  });

  it('accepts a unique id prefix and a wall index', async () => {
    const api = createPlaceApi(
      [makeShapedGroup({ id: 'group-abc' })],
      [makeGroup({ id: 'group-abc' })],
    );
    await toolExecutors['place-group'](api, { groupId: 'group-a', wall: 1 });
    const reloaded = reloadedGroup(api);
    expect(reloaded.id).toBe('group-abc');
    // centred on the right wall by default
    expect(reloaded.repositioningData).toEqual({
      posGroup: [4000, 0, -1900],
      posRotationY: 270,
      rootId: 'r1',
    });
  });

  it('places the group against a wall and reloads it there once', async () => {
    const moved = makeShapedGroup({
      position: { pos: [4000, 0, -3000], rotationY: 270 },
    });
    const api = createPlaceApi([makeShapedGroup()], [makeGroup()], [moved]);
    const result = await toolExecutors['place-group'](api, {
      groupId: 'g1',
      wall: 'right',
      alignment: 'top',
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
                  { id: 'b', value: 800, isInput: true },
                  { id: 't', value: 600, isInput: true },
                ],
                dockInfos: [{ id: 'LeftBottom' }, { id: 'RightBottom' }],
                contextData: { dockedRoots: [] },
                modules: [],
              },
            ],
            repositioningData: {
              posGroup: [4000, 0, -3000],
              posRotationY: 270,
              rootId: 'r1',
            },
          },
        ],
      },
      'posGroups',
      { reason: 'adjusted' },
    );
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      placedIn: 'wall',
      wall: room.walls[1],
      group: moved,
    });
  });

  it('rejects a target that meets another group without moving it', async () => {
    const api = createPlaceApi(
      [
        makeShapedGroup(),
        makeShapedGroup({
          id: 'g2',
          roots: [makeShapedRoot({ id: 'r2', freeDockingVectors: ['LeftBottom'] })],
        }),
      ],
      [
        makeGroup(),
        makeGroup({
          id: 'g2',
          pos: [4000, 0, -1900],
          rotationY: 270,
          roots: [makeRoot({ id: 'r2' })],
        }),
      ],
    );
    await expect(
      toolExecutors['place-group'](api, { groupId: 'g1', wall: 'right' }),
    ).rejects.toThrow(
      /Placement rejected - the group was not moved: Group 'g1' placed at the right wall would meet group 'g2' \(root 'r2', article article-1; free docking vectors: LeftBottom\).*"ownDockingVector": "LeftBottom", "dockedRoots": \[\{ "id": "<new root>", "dockingVector": "RightBottom"/s,
    );
    expect(api.extended.loadExternalObjectGroupLayout).not.toHaveBeenCalled();
  });

  it('puts a group with a corner article into the corner the alignment names', async () => {
    const api = createPlaceApi(
      [makeShapedGroup({ roots: [makeShapedRoot({ id: 'c1' })] })],
      [makeGroup({ roots: [makeRoot({ id: 'c1', dockInfos: cornerDockInfos })] })],
    );
    const result = (await toolExecutors['place-group'](api, {
      groupId: 'g1',
      wall: 'right',
      alignment: 'top',
    })) as Record<string, any>;
    // the corner point [-261, 0, 0], turned by 270, lands on [4000, 0, -3000]
    expect(reloadedGroup(api).repositioningData).toEqual({
      posGroup: [4000, 0, -2739],
      posRotationY: 270,
      rootId: 'c1',
    });
    expect(result.placedIn).toBe('corner');
    expect(JSON.stringify(result)).not.toMatch(
      /repositioningData|rootRelPos|cornerPoint/,
    );
  });

  it('puts the corner point into the corner whichever root comes first', async () => {
    // r1 at the group origin, the corner article docked left of it
    const api = createPlaceApi(
      [makeShapedGroup()],
      [
        makeGroup({
          roots: [
            makeRoot(),
            makeRoot({
              id: 'c1',
              articlePos: [-900, 0, 0],
              dockInfos: cornerDockInfos,
            }),
          ],
        }),
      ],
    );
    await toolExecutors['place-group'](api, {
      groupId: 'g1',
      wall: 'right',
      alignment: 'top',
    });
    const { posGroup, posRotationY, rootId } = reloadedGroup(api).repositioningData;
    expect(rootId).toBe('r1');
    expect(posRotationY).toBe(270);
    // the planner puts r1 at posGroup; c1's corner point lies at x -1161 in
    // the group and turns with it
    const theta = (posRotationY * Math.PI) / 180;
    expect(posGroup[0] - 1161 * Math.cos(theta)).toBeCloseTo(4000);
    expect(posGroup[2] + 1161 * Math.sin(theta)).toBeCloseTo(-3000);
  });

  it('keeps the height of a group of wall units', async () => {
    const api = createPlaceApi(
      [makeShapedGroup()],
      [makeGroup({ pos: [0, 1400, 0] })],
    );
    await toolExecutors['place-group'](api, {
      groupId: 'g1',
      wall: 'right',
      alignment: 'top',
    });
    expect(reloadedGroup(api).repositioningData.posGroup).toEqual([
      4000, 1400, -3000,
    ]);
  });

  it('reloads the article roots only and anchors the first of them', async () => {
    const api = createPlaceApi(
      [makeShapedGroup()],
      [makeGroup({ roots: [makeRoot({ id: 'w1', isGenerated: true }), makeRoot()] })],
    );
    await toolExecutors['place-group'](api, { groupId: 'g1', wall: 'right' });
    const reloaded = reloadedGroup(api);
    expect(reloaded.roots.map((root: any) => root.id)).toEqual(['r1']);
    expect(reloaded.repositioningData.rootId).toBe('r1');
  });

  it('rejects an unknown room or wall and a parallel alignment before reading the calculated groups', async () => {
    const api = createPlaceApi([makeShapedGroup()], [makeGroup()]);
    const place = (args: Record<string, unknown>) =>
      toolExecutors['place-group'](api, { groupId: 'g1', ...args });
    await expect(place({ wall: 'right', alignment: 'right' })).rejects.toThrow(
      /Alignment 'right' runs parallel to this 'right' wall/,
    );
    await expect(place({ wall: 'right', roomIndex: 1 })).rejects.toThrow(
      /Room index 1 not found - the plan has 1 room\(s\)/,
    );
    await expect(place({ wall: 7 })).rejects.toThrow(/Wall '7' not found/);
    expect(api.extended.getExternalObjectGroups).not.toHaveBeenCalled();
    expect(api.extended.loadExternalObjectGroupLayout).not.toHaveBeenCalled();
  });

  it('rejects a group the planner has not calculated', async () => {
    const api = createPlaceApi([makeShapedGroup()], []);
    await expect(
      toolExecutors['place-group'](api, { groupId: 'g1', wall: 'right' }),
    ).rejects.toThrow(/Group 'g1' has no calculated geometry to place/);
    expect(api.extended.loadExternalObjectGroupLayout).not.toHaveBeenCalled();
  });
});

describe('remaining tools', () => {
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


describe('group command tools', () => {
  const planWithGroups = {
    ...planContextFixture,
    groups: [
      makeShapedGroup({ id: 'kitchen-1' }),
      makeShapedGroup({ id: 'kitchen-2' }),
      makeShapedGroup({ id: 'island-1' }),
    ],
  };

  const dockTo = {
    rootId: 'r1',
    ownDockingVector: 'RightBottom',
    dockingVector: 'LeftBottom',
  };

  it.each([
    [
      'change-module-attribute',
      { rootModuleId: 'r1', attributeId: 'front', value: 'white' },
      { rootModuleId: 'r1', moduleId: null, attributeId: 'front', value: 'white' },
    ],
    [
      'change-module-attribute',
      { rootModuleId: 'r1', moduleId: 'sub-1', attributeId: 'front', value: 'white' },
      { rootModuleId: 'r1', moduleId: 'sub-1', attributeId: 'front', value: 'white' },
    ],
    [
      'change-group-attribute',
      { groupId: 'island', attributeId: 'front', value: 'white' },
      { groupId: 'island-1', attributeId: 'front', value: 'white' },
    ],
    ['delete-group', { groupId: 'kitchen-2' }, { groupId: 'kitchen-2' }],
    ['delete-root-module', { rootModuleId: 'r1' }, { rootModuleId: 'r1' }],
    [
      'merge-article-into-group',
      { groupId: 'island', articleId: 'article-1', dockTo },
      { groupId: 'island-1', articleId: 'article-1', dockTo },
    ],
    [
      'merge-article-into-group',
      {
        groupId: 'kitchen-1',
        articleId: 'article-1',
        attributes: [{ id: 'front', value: 'white' }],
        dockTo,
      },
      {
        groupId: 'kitchen-1',
        articleId: 'article-1',
        attributes: [{ id: 'front', value: 'white' }],
        dockTo,
      },
    ],
    [
      'exchange-root-module',
      { groupId: 'kitchen-1', rootModuleId: 'r1', articleId: 'article-1' },
      { groupId: 'kitchen-1', rootModuleId: 'r1', articleId: 'article-1' },
    ],
    [
      'merge-groups',
      { targetGroupId: 'kitchen-1', groupIds: ['kitchen-2', 'island'] },
      { targetGroupId: 'kitchen-1', groupIds: ['kitchen-2', 'island-1'] },
    ],
  ])('%s forwards its command to the planner', async (tool, args, payload) => {
    const api = createApi(planWithGroups);

    await expect(toolExecutors[tool](api, args)).resolves.toEqual({
      command: tool,
      groups: [],
      removedGroupIds: [],
    });
    expect(api.extended.externalObjectGroupOperation).toHaveBeenCalledWith(
      tool,
      payload,
    );
  });

  it.each([
    ['change-group-attribute', { groupId: 'kitchen', attributeId: 'front', value: 'white' }],
    ['delete-group', { groupId: 'hall-1' }],
    ['merge-article-into-group', { groupId: 'kitchen', articleId: 'article-1', dockTo }],
    ['exchange-root-module', { groupId: 'hall', rootModuleId: 'r1', articleId: 'article-1' }],
    ['merge-groups', { targetGroupId: 'kitchen-1', groupIds: ['kitchen'] }],
  ])(
    '%s rejects an unknown or ambiguous group id with the groups in the plan',
    async (tool, args) => {
      const api = createApi(planWithGroups);

      await expect(toolExecutors[tool](api, args)).rejects.toThrow(
        /Group '\w+(-\d)?' not found\. Groups in the plan: kitchen-1, kitchen-2, island-1\./,
      );
      expect(api.extended.externalObjectGroupOperation).not.toHaveBeenCalled();
    },
  );

  it.each(['merge-article-into-group', 'exchange-root-module'])(
    '%s rejects an article that is not in the catalog with the catalog',
    async (tool) => {
      const api = createApi(planWithGroups);

      await expect(
        toolExecutors[tool](api, {
          groupId: 'kitchen-1',
          rootModuleId: 'r1',
          articleId: 'article-9',
          dockTo,
        }),
      ).rejects.toThrow(
        "articleId 'article-9' is not in the article catalog of library 'lib-1'. Valid article ids: article-1",
      );
      expect(api.extended.externalObjectGroupOperation).not.toHaveBeenCalled();
    },
  );

  it.each(['merge-article-into-group', 'exchange-root-module'])(
    "%s rejects an article of another library than the group's",
    async (tool) => {
      const api = createApi({
        ...planWithGroups,
        articles: [
          articleFixture,
          { ...articleFixture, articleId: 'article-2', libraryId: 'lib-2' },
        ],
      });

      await expect(
        toolExecutors[tool](api, {
          groupId: 'kitchen-1',
          rootModuleId: 'r1',
          articleId: 'article-2',
          dockTo,
        }),
      ).rejects.toThrow(
        "articleId 'article-2' is not in the article catalog of library 'lib-1'. Valid article ids: article-1",
      );
      expect(api.extended.externalObjectGroupOperation).not.toHaveBeenCalled();
    },
  );

  it('passes the reason of a refused command through', async () => {
    const api = createApi(planWithGroups, {
      externalObjectGroupOperation: vi.fn(async () => {
        throw new Error(
          "Root module 'r1' has no free docking vector 'RightBottom' - its free docking vectors: LeftBottom.",
        );
      }),
    });

    await expect(
      toolExecutors['merge-article-into-group'](api, {
        groupId: 'kitchen-1',
        articleId: 'article-1',
        dockTo,
      }),
    ).rejects.toThrow("Root module 'r1' has no free docking vector 'RightBottom'");
  });
});

describe('plan changes', () => {
  // a planner command that takes a moment and records when it runs
  const recordingApi = (events: string[], failing: string[] = []) =>
    createApi(planContextFixture, {
      externalObjectGroupOperation: vi.fn(async (command: string, payload: any) => {
        events.push(`start ${payload.rootModuleId}`);
        await new Promise((resolve) => setTimeout(resolve, 10));
        events.push(`end ${payload.rootModuleId}`);
        if (failing.includes(payload.rootModuleId)) {
          throw new Error(`refused ${payload.rootModuleId}`);
        }
        return { command, groups: [], removedGroupIds: [] };
      }),
    });

  it('runs tool calls that change the plan one after another', async () => {
    const events: string[] = [];
    const api = recordingApi(events);
    await Promise.all([
      toolExecutors['delete-root-module'](api, { rootModuleId: 'a' }),
      toolExecutors['change-module-attribute'](api, { rootModuleId: 'b', attributeId: 'b', value: '900' }),
    ]);
    expect(events).toEqual(['start a', 'end a', 'start b', 'end b']);
  });

  it('runs the next plan change after one that fails', async () => {
    const events: string[] = [];
    const api = recordingApi(events, ['a']);
    const [first, second] = await Promise.allSettled([
      toolExecutors['delete-root-module'](api, { rootModuleId: 'a' }),
      toolExecutors['delete-root-module'](api, { rootModuleId: 'b' }),
    ]);
    expect(first).toMatchObject({ status: 'rejected', reason: new Error('refused a') });
    expect(second).toMatchObject({ status: 'fulfilled' });
    expect(events).toEqual(['start a', 'end a', 'start b', 'end b']);
  });
});
