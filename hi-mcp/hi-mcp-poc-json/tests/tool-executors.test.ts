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
    getExternalObjectGroups: vi.fn(async () => []),
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
      /are not related by docking/,
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
      /placement takes only posGroup, posRotationY and rootId - remove wall, alignment/,
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
      /placement positions a new group only - group 'g1' is already in the plan/,
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

  it('positions a new corner kitchen by the corner article in one load', async () => {
    const cornerArticle = {
      ...articleFixture,
      articleId: 'corner-1',
      cornerArticle: true,
      cornerPoint: [-261, 0, 0],
    };
    const api = createApi({
      ...planContextFixture,
      articles: [articleFixture, cornerArticle],
    });
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
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledTimes(1);
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledWith(
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

  it('takes the corner offset from the docking vectors of a calculated corner article in the plan', async () => {
    // the deployed UI delivers no cornerPoint: the catalog flags the article only
    const cornerArticle = { ...articleFixture, articleId: 'EUERTB90', cornerArticle: true };
    const calculatedCornerRoot = {
      id: 'in-plan',
      articleId: 'EUERTB90',
      name: 'mr_CornerunitStraight',
      articlePos: [0, 0, 0],
      rotationY: 0,
      dockInfos: [
        { id: 'LeftBackBottom', start: [-261, 0, 0], end: [-261, 0, 661] },
        { id: 'RightBackBottom', start: [-261, 0, 0], end: [900, 0, 0] },
        { id: 'LeftBottom', start: [-261, 0, 661], end: [300, 0, 661] },
      ],
    };
    const api = createApi(
      { ...planContextFixture, articles: [articleFixture, cornerArticle] },
      { getExternalObjectGroups: vi.fn(async () => [{ id: 'g0', roots: [calculatedCornerRoot] }]) },
    );
    const lShape = [
      { id: 'c1', articleId: 'EUERTB90', contextData: { dockedRoots: [
        { ownDockingVector: 'RightBottom', dockedRoots: [{ id: 'r1', dockingVector: 'LeftBottom' }] },
      ] } },
      { id: 'r1', articleId: 'article-1' },
    ];
    await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [{ roots: lShape, placement: { posGroup: [4815, 0, -3765], posRotationY: 270 } }],
    });
    expect(api.extended.getExternalObjectGroups).toHaveBeenCalledTimes(1);
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledTimes(1);
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledWith(
      { posGroups: [{ roots: lShape, repositioningData: {
        posGroup: [4815, 0, -3504], posRotationY: 270, rootId: 'c1',
      } }] },
      'posGroups',
      { reason: 'adjusted' },
    );
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
    expect(result.hint).not.toMatch(/repositioningData/);
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

