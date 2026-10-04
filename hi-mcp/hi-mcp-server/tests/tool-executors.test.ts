import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetAnchorFrames, toolExecutors } from '../tool-executors';

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
      ...position,
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

const isProbeLoad = (layout: any) =>
  layout?.posGroups?.length === 1 &&
  layout.posGroups[0].roots?.[0]?.id === 'anchor-probe';

// A planner that calculates a probe pick as a cabinet whose docking corner is
// its origin, until the probe is removed.
const createApi = (
  planContext: unknown,
  overrides: Record<string, unknown> = {}
) => {
  let probeGroups: any[] = [];
  return {
    extended: {
      getExternalObjectPlanContext: vi.fn(async () => planContext),
      loadExternalObjectGroupLayout: vi.fn(async (layout: any) => {
        if (isProbeLoad(layout)) {
          probeGroups = [
            {
              id: 'probe-group',
              roots: [
                {
                  id: 'p1',
                  articleId: layout.posGroups[0].roots[0].articleId,
                  dockInfos: [
                    { id: 'LeftBottom', start: [0, 0, 0], end: [0, 0, 561] },
                  ],
                },
              ],
            },
          ];
        }
        return [{ id: 'loaded-1' }];
      }),
      externalObjectGroupOperation: vi.fn(async (command: string) => ({
        command,
        groups: [],
        removedGroupIds: [],
      })),
      fetchPrice: vi.fn(async () => ({ price: 42 })),
      getExternalObjectSnapshot: vi.fn(async () => ({})),
      getExternalObjectGroups: vi.fn(async () => probeGroups),
      removeExternalObject: vi.fn(async (id: string) => {
        probeGroups = probeGroups.filter((group) => group.id !== id);
      }),
      ...overrides,
    },
  };
};

// every test learns its anchor frames itself
beforeEach(() => forgetAnchorFrames());

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

  it('ignores a section it does not know', async () => {
    const api = createApi(planContextFixture);
    await toolExecutors['get-plan-context'](api, {
      include: ['articles', 'walls'],
    });
    expect(api.extended.getExternalObjectPlanContext).toHaveBeenCalledWith([
      'articles',
    ]);
    await toolExecutors['get-plan-context'](api, { include: ['walls'] });
    expect(api.extended.getExternalObjectPlanContext).toHaveBeenLastCalledWith([
      'rooms',
      'articles',
      'groups',
    ]);
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
    const front = (result as Record<string, any>).masterData[
      'lib-1'
    ].attributes.find((attribute: any) => attribute.id === 'front');
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
      toolExecutors['find-attributes'](api, { text: '  ' })
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
  it.fails(
    'RML-18033: reports a group omitted by the planner in notLoaded',
    async () => {
      const api = createApi(planContextFixture);
      api.extended.getExternalObjectPlanContext
        .mockResolvedValueOnce(planContextFixture)
        .mockResolvedValueOnce({ ...planContextFixture, groups: [] })
        .mockResolvedValueOnce({
          ...planContextFixture,
          groups: [makeShapedGroup({ id: 'created-group' })],
        });
      const result = (await toolExecutors['create-or-replace-groups'](api, {
        posGroups: [
          { roots: [pick()] },
          { roots: [{ ...pick(), id: 'other-root' }] },
        ],
      })) as Record<string, any>;
      expect(result.notLoaded).toEqual([
        { index: 1, errors: expect.any(Array) },
      ]);
    }
  );

  it('RML-18033: passes numeric article overrides on as numbers, which the layout takes', async () => {
    // PosModuleAttribute.value is number | string | boolean; only the
    // attribute commands take strings (C11)
    const api = createApi(planContextFixture);
    await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        { roots: [{ ...pick(), attributes: [{ id: 'b', value: 900 }] }] },
      ],
    });
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledWith(
      {
        posGroups: [
          { roots: [{ ...pick(), attributes: [{ id: 'b', value: 900 }] }] },
        ],
      },
      'posGroups',
      { reason: 'adjusted' }
    );
  });

  it('RML-18033: reports invalid attributes and still loads both groups', async () => {
    const api = createApi(planContextFixture);
    const result = (await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        { roots: [{ ...pick(), attributes: 'invalid' }] },
        { roots: [pick()] },
      ],
    })) as Record<string, any>;
    expect(result).not.toHaveProperty('notLoaded');
    expect(result.corrections).toContainEqual(
      expect.stringMatching(/attributes must be.*ignored/)
    );
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledWith(
      { posGroups: [{ roots: [pick()] }, { roots: [pick()] }] },
      'posGroups',
      { reason: 'adjusted' }
    );
  });

  it.each([
    [{ contextData: { dockedRoots: {} } }, "the contextData of root 'u1'"],
    [{ contextData: 'docked' }, "the contextData of root 'u1'"],
    [
      {
        contextData: {
          dockedRoots: [{ ownDockingVector: 'RightBottom', dockedRoots: {} }],
        },
      },
      "docking context 0 of root 'u1'",
    ],
    [
      { contextData: { dockedRoots: [null] } },
      "docking context 0 of root 'u1'",
    ],
    [
      {
        contextData: {
          dockedRoots: [
            { ownDockingVector: 'RightBottom', dockedRoots: ['u2'] },
          ],
        },
      },
      "docking entry 0 of context 0 of root 'u1'",
    ],
  ])(
    'RML-18033: drops malformed docking data %j, reports it and loads every group',
    async (malformed, part) => {
      const api = createApi(planContextFixture);
      const result = (await toolExecutors['create-or-replace-groups'](api, {
        posGroups: [
          { roots: [{ ...pick(), ...malformed }] },
          { roots: [pick()] },
        ],
      })) as Record<string, any>;
      expect(result).not.toHaveProperty('notLoaded');
      expect(result.corrections).toContainEqual(
        expect.stringContaining(
          `posGroups[0]: ${part} could not be read and were dropped`
        )
      );
      expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledTimes(
        1
      );
      expect(
        api.extended.loadExternalObjectGroupLayout.mock.calls[0][0].posGroups
      ).toHaveLength(2);
    }
  );

  it('RML-18033: reports a group it cannot read in notLoaded and loads the others', async () => {
    const api = createApi(planContextFixture);
    const result = (await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [{ roots: [null] }, { roots: [pick()] }],
    })) as Record<string, any>;
    expect(result.notLoaded).toEqual([
      {
        index: 0,
        errors: [
          expect.stringMatching(/^posGroups\[0\]: could not be read - /),
        ],
      },
    ]);
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledWith(
      { posGroups: [{ roots: [pick()] }] },
      'posGroups',
      { reason: 'adjusted' }
    );
  });

  const expectRejectedBeforeLoad = async (
    posGroups: unknown[],
    message: RegExp
  ) => {
    const api = createApi({ articles: [] });
    await expect(
      toolExecutors['create-or-replace-groups'](api, { posGroups })
    ).rejects.toThrow(message);
    expect(api.extended.loadExternalObjectGroupLayout).not.toHaveBeenCalled();
  };

  it('rejects a group without roots', async () => {
    await expectRejectedBeforeLoad([{}], /needs a non-empty roots array/);
  });

  it('rejects a group of only generated roots', async () => {
    await expectRejectedBeforeLoad(
      [{ roots: [{ id: 'w', isGenerated: true }] }],
      /needs at least one article root/
    );
  });

  const loadedWith = async (
    posGroups: unknown[],
    planContext: unknown = planContextFixture
  ) => {
    const api = createApi(planContext);
    const result = (await toolExecutors['create-or-replace-groups'](api, {
      posGroups,
    })) as Record<string, any>;
    const calls = api.extended.loadExternalObjectGroupLayout.mock
      .calls as unknown as any[][];
    return {
      api,
      result,
      loadedGroup: calls[calls.length - 1][0].posGroups[0],
    };
  };

  it('drops a position on the group and reports it', async () => {
    const { loadedGroup, result } = await loadedWith([
      { roots: [pick()], pos: [0, 0, 0], rotationY: 90 },
    ]);
    expect(loadedGroup).toEqual({ roots: [pick()] });
    expect(result.corrections).toEqual([
      'posGroups[0]: pos/rotationY on a group were dropped - a new group is positioned with placement',
    ]);
  });

  it('drops the positions of root modules and reports them', async () => {
    const { loadedGroup, result } = await loadedWith([
      {
        roots: [
          {
            id: 'u1',
            articleId: 'article-1',
            articlePos: [0, 0, 0],
            rotationY: 90,
          },
        ],
      },
    ]);
    expect(loadedGroup.roots).toEqual([pick()]);
    expect(result.corrections).toEqual([
      "posGroups[0]: articlePos/rotationY of roots 'u1' were dropped - root positions come from the docking",
    ]);
  });

  it('rejects a root without articleId and names a root without id', async () => {
    await expectRejectedBeforeLoad(
      [{ roots: [{}] }],
      /posGroups\[0\]\.roots\[0\]: articleId must be a non-empty string/
    );
    const { loadedGroup, result } = await loadedWith([
      { roots: [{ articleId: 'article-1' }] },
    ]);
    expect(loadedGroup.roots).toEqual([
      { id: 'root-1', articleId: 'article-1' },
    ]);
    expect(result.corrections).toEqual([
      "posGroups[0].roots[0]: the root had no id - it is 'root-1'",
    ]);
  });

  it('renames a duplicate root id the docking does not name and rejects one it names', async () => {
    const docked = (
      ownDockingVector: string,
      id: string,
      dockingVector: string
    ) => ({
      dockedRoots: [{ ownDockingVector, dockedRoots: [{ id, dockingVector }] }],
    });
    const { loadedGroup, result } = await loadedWith([
      {
        roots: [
          { id: 'a', articleId: 'article-1' },
          {
            id: 'u1',
            articleId: 'article-1',
            contextData: docked('LeftBottom', 'a', 'RightBottom'),
          },
          {
            id: 'u1',
            articleId: 'article-1',
            contextData: docked('RightBottom', 'a', 'LeftBottom'),
          },
        ],
      },
    ]);
    expect(loadedGroup.roots.map((root: any) => root.id)).toEqual([
      'a',
      'u1',
      'u1-2',
    ]);
    expect(result.corrections).toEqual([
      "posGroups[0].roots[2]: the duplicate root id 'u1' was renamed to 'u1-2'",
    ]);
    await expectRejectedBeforeLoad(
      [
        {
          roots: [
            {
              id: 'u1',
              articleId: 'article-1',
              contextData: docked('RightBottom', 'u2', 'LeftBottom'),
            },
            { id: 'u2', articleId: 'article-1' },
            { id: 'u2', articleId: 'article-1' },
          ],
        },
      ],
      /posGroups\[0\]\.roots\[2\]: duplicate root id 'u2' named in the docking/
    );
  });

  const entry = (id: string, dockingVector: string) => ({
    id,
    dockingVector,
    mode: 'StartStart',
    offset: [0, 0, 0],
  });

  const catalogWith = (...articles: unknown[]) => ({
    ...planContextFixture,
    articles: [articleFixture, ...articles],
  });

  it('docks a root the docking does not connect to the free end of the row', async () => {
    const { loadedGroup, result } = await loadedWith([
      {
        roots: [
          { id: 'u1', articleId: 'article-1' },
          { id: 'u2', articleId: 'article-1' },
        ],
      },
    ]);
    expect(loadedGroup.roots[0].contextData).toEqual({
      dockedRoots: [
        {
          ownDockingVector: 'RightBottom',
          dockedRoots: [entry('u2', 'LeftBottom')],
        },
      ],
    });
    expect(result.corrections).toEqual([
      "posGroups[0]: roots 'u2' were not docked to the placed roots - 'u2' was docked to the RightBottom of 'u1', the free end of that row (mode StartStart, offset [0, 0, 0])",
    ]);
  });

  it('docks a chain docked only among itself by its free side', async () => {
    const dockedRight = (id: string) => ({
      dockedRoots: [
        {
          ownDockingVector: 'RightBottom',
          dockedRoots: [{ id, dockingVector: 'LeftBottom' }],
        },
      ],
    });
    const { loadedGroup, result } = await loadedWith([
      {
        roots: [
          { id: 'c', articleId: 'article-1', contextData: dockedRight('f') },
          { id: 's', articleId: 'article-1', contextData: dockedRight('o') },
          { id: 'o', articleId: 'article-1' },
          { id: 'f', articleId: 'article-1' },
        ],
      },
    ]);
    // the row continues c, f, s, o
    expect(loadedGroup.roots[3].contextData).toEqual({
      dockedRoots: [
        {
          ownDockingVector: 'RightBottom',
          dockedRoots: [entry('s', 'LeftBottom')],
        },
      ],
    });
    expect(result.corrections).toEqual([
      expect.stringContaining(
        "roots 's', 'o' were not docked to the placed roots - 's' was docked to the RightBottom of 'f'"
      ),
    ]);
  });

  it('reports roots of a new group named in the docking but never sent, and docks the rest', async () => {
    // the docking names a unit the payload does not contain
    const dockedTo = (ownDockingVector: string, dockingVector: string) => ({
      dockedRoots: [
        { ownDockingVector, dockedRoots: [{ id: 'deleted', dockingVector }] },
      ],
    });
    const { loadedGroup, result } = await loadedWith([
      {
        roots: [
          {
            id: 'u1',
            articleId: 'article-1',
            contextData: dockedTo('RightBottom', 'LeftBottom'),
          },
          {
            id: 'u2',
            articleId: 'article-1',
            contextData: dockedTo('LeftBottom', 'RightBottom'),
          },
        ],
      },
    ]);
    expect(loadedGroup.roots[0].contextData.dockedRoots).toEqual([
      {
        ownDockingVector: 'RightBottom',
        dockedRoots: [entry('u2', 'LeftBottom')],
      },
    ]);
    expect(result.corrections).toEqual([
      "posGroups[0]: roots 'deleted' are named in the docking but were never sent - nothing was built for them; send each as a root { id, articleId } of the group",
      expect.stringContaining("'u2' was docked to the RightBottom of 'u1'"),
    ]);
  });

  it('takes units written inside the docking as roots of the group', async () => {
    // the shape of run 06: the corner names its neighbours with their articles
    const { loadedGroup, result } = await loadedWith([
      {
        roots: [
          {
            id: 'corner1',
            articleId: 'article-1',
            contextData: {
              dockedRoots: [
                {
                  ownDockingVector: 'RightBottom',
                  dockedRoots: [
                    {
                      id: 'fridge1',
                      articleId: 'article-1',
                      contextData: {
                        dockedRoots: [
                          {
                            ownDockingVector: 'RightBottom',
                            dockedRoots: [
                              { id: 'oven1', articleId: 'article-1' },
                            ],
                          },
                        ],
                      },
                    },
                  ],
                },
                {
                  ownDockingVector: 'LeftBottom',
                  dockedRoots: [
                    {
                      id: 'sink1',
                      articleId: 'article-1',
                      attributes: { front: 'white' },
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    ]);
    expect(loadedGroup.roots.map((root: any) => root.id)).toEqual([
      'corner1',
      'fridge1',
      'sink1',
      'oven1',
    ]);
    expect(loadedGroup.roots[0].contextData).toEqual({
      dockedRoots: [
        {
          ownDockingVector: 'RightBottom',
          dockedRoots: [{ id: 'fridge1', dockingVector: 'LeftBottom' }],
        },
        {
          ownDockingVector: 'LeftBottom',
          dockedRoots: [{ id: 'sink1', dockingVector: 'RightBottom' }],
        },
      ],
    });
    expect(loadedGroup.roots[1].contextData).toEqual({
      dockedRoots: [
        {
          ownDockingVector: 'RightBottom',
          dockedRoots: [{ id: 'oven1', dockingVector: 'LeftBottom' }],
        },
      ],
    });
    expect(loadedGroup.roots[2].attributes).toEqual([
      { id: 'front', value: 'white' },
    ]);
    expect(result.corrections).toEqual([
      "posGroups[0]: roots 'fridge1', 'sink1', 'oven1' were written inside the docking - they are roots of the group now, linked by their docking entries",
      "posGroups[0]: docking entries without dockingVector were completed - 'fridge1' meets the RightBottom of 'corner1' with its LeftBottom, 'sink1' meets the LeftBottom of 'corner1' with its RightBottom, 'oven1' meets the RightBottom of 'fridge1' with its LeftBottom",
      "posGroups[0] root 'sink1': attributes were given as an object - read as [{ id, value }]",
    ]);
  });

  it("reads a docking entry by rootId and drops one without the root's own vector", async () => {
    const { loadedGroup, result } = await loadedWith([
      {
        roots: [
          {
            id: 'u1',
            articleId: 'article-1',
            contextData: {
              dockedRoots: [
                {
                  ownDockingVector: 'RightBottom',
                  dockedRoots: [{ rootId: 'u2', dockingVector: 'LeftBottom' }],
                },
                { dockedRoots: [{ id: 'u3', dockingVector: 'LeftBottom' }] },
              ],
            },
          },
          { id: 'u2', articleId: 'article-1' },
          { id: 'u3', articleId: 'article-1' },
        ],
      },
    ]);
    expect(loadedGroup.roots[0].contextData.dockedRoots[0]).toEqual({
      ownDockingVector: 'RightBottom',
      dockedRoots: [{ id: 'u2', dockingVector: 'LeftBottom' }],
    });
    expect(result.corrections).toEqual([
      "posGroups[0]: docking entries without ownDockingVector were dropped - 'u1' -> 'u3'",
      expect.stringContaining("'u3' was docked to the RightBottom of 'u2'"),
    ]);
  });

  it('reports the fields it does not use and keeps the attributes of a group', async () => {
    const { loadedGroup, result } = await loadedWith([
      {
        name: 'kitchen',
        attributes: [{ id: 'mod_GroupHeight', value: 1500 }],
        roots: [
          {
            id: 'u1',
            articleId: 'article-1',
            width: 900,
            attributes: [{ attributeId: 'b', value: '900' }, { value: 1 }],
          },
        ],
      },
    ]);
    expect(loadedGroup).toEqual({
      attributes: [{ id: 'mod_GroupHeight', value: 1500 }],
      roots: [
        {
          id: 'u1',
          articleId: 'article-1',
          attributes: [{ id: 'b', value: '900' }],
        },
      ],
    });
    expect(result.corrections).toEqual([
      "posGroups[0]: the server does not use the group's name; width of root 'u1' - ignored",
      "posGroups[0] root 'u1': attribute entries 1 have no id - ignored",
    ]);
  });

  it('docks articles whose docking vectors the catalog does not know yet', async () => {
    // on an empty plan the catalog has no docking vectors for any article
    const uncalculated = (articleId: string, category: string) => ({
      ...articleFixture,
      articleId,
      category,
      rootModules: [
        {
          module: { id: 'module-1' },
          dimensions: [{ id: 'mod_Width', name: 'Width', value: 600 }],
          dockingVectors: [],
        },
      ],
    });
    const { loadedGroup, result } = await loadedWith(
      [
        {
          roots: [
            { id: 'c1', articleId: 'corner-1' },
            { id: 'l1', articleId: 'base-1' },
          ],
        },
      ],
      {
        ...planContextFixture,
        articles: [
          uncalculated('corner-1', 'Kitchen handleless | Base Units | Corner'),
          uncalculated('base-1', 'Kitchen | Base Units | Storage'),
        ],
      }
    );
    expect(loadedGroup.roots[0].contextData).toEqual({
      dockedRoots: [
        {
          ownDockingVector: 'RightBottom',
          dockedRoots: [entry('l1', 'LeftBottom')],
        },
      ],
    });
    expect(result).not.toHaveProperty('notLoaded');
  });

  it('docks wall units only to a row of wall units', async () => {
    const wallUnit = {
      ...articleFixture,
      articleId: 'wall-1',
      category: 'Kitchen | Wall Units | Storage',
    };
    const above = {
      dockedRoots: [
        {
          ownDockingVector: 'LeftTop',
          dockedRoots: [
            { id: 'w1', dockingVector: 'LeftBottom', offset: [0, 600, 0] },
          ],
        },
      ],
    };
    const { loadedGroup, result } = await loadedWith(
      [
        {
          roots: [
            { id: 'b1', articleId: 'article-1', contextData: above },
            { id: 'w1', articleId: 'wall-1' },
            { id: 'w2', articleId: 'wall-1' },
          ],
        },
      ],
      catalogWith(wallUnit)
    );
    expect(loadedGroup.roots[1].contextData).toEqual({
      dockedRoots: [
        {
          ownDockingVector: 'RightBottom',
          dockedRoots: [entry('w2', 'LeftBottom')],
        },
      ],
    });
    expect(result.corrections).toEqual([
      expect.stringContaining("'w2' was docked to the RightBottom of 'w1'"),
    ]);
  });

  it('reports a root it cannot dock and loads the other groups', async () => {
    const wallUnit = {
      ...articleFixture,
      articleId: 'wall-1',
      category: 'Kitchen | Wall Units | Storage',
    };
    const api = createApi(catalogWith(wallUnit));
    const result = (await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        {
          roots: [
            { id: 'u1', articleId: 'article-1' },
            { id: 'w1', articleId: 'wall-1' },
          ],
        },
        { roots: [pick()] },
      ],
    })) as Record<string, any>;
    expect(result.notLoaded.map((entry: any) => entry.index)).toEqual([0]);
    expect(result.notLoaded[0].errors).toEqual([
      expect.stringMatching(
        /^posGroups\[0\]: roots 'w1' are not docked to a placed root \('u1' is placed/
      ),
    ]);
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledWith(
      { posGroups: [{ roots: [pick()] }] },
      'posGroups',
      { reason: 'adjusted' }
    );
  });

  it('docks a range hood whose docking vectors and size the catalog does not know like any other unit', async () => {
    // the catalog of an empty plan: the hood's template has neither, the
    // calculated hood has four docking vectors
    const hood = {
      ...articleFixture,
      articleId: 'hood-1',
      category: 'Kitchen | Appliances',
      rootModules: [
        { module: { id: 'mr_Hood' }, dimensions: [], dockingVectors: [] },
      ],
    };
    const api = createApi(catalogWith(hood));
    const result = (await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        {
          roots: [
            { id: 'u1', articleId: 'article-1' },
            { id: 'h1', articleId: 'hood-1' },
          ],
        },
      ],
    })) as Record<string, any>;
    expect(result.notLoaded).toBeUndefined();
    // the catalog does not name the hood a wall unit, so it joins the floor row
    expect(result.corrections).toEqual([
      "posGroups[0]: roots 'h1' were not docked to the placed roots - 'h1' was docked to the RightBottom of 'u1', " +
        'the free end of that row (mode StartStart, offset [0, 0, 0])',
    ]);
  });

  it('takes repositioningData as the placement', async () => {
    const { loadedGroup, result } = await loadedWith([
      {
        roots: [pick()],
        repositioningData: {
          posGroup: [4000, 0, -3000],
          posRotationY: 270,
          rootId: 'u1',
        },
      },
    ]);
    expect(loadedGroup.repositioningData).toEqual({
      posGroup: [4000, 0, -3000],
      posRotationY: 270,
      rootId: 'u1',
    });
    expect(result.corrections).toEqual([
      'posGroups[0]: repositioningData was taken as the placement',
    ]);
  });

  it('uses no placement it cannot use and lets the planner position the group', async () => {
    for (const placement of [
      'right',
      { posGroup: [0, '0', 0], posRotationY: 0 },
      { posGroup: [0, 0, 0], posRotationY: '90' },
      { posGroup: [0, 0, 0] },
    ]) {
      const { loadedGroup, result } = await loadedWith([
        { roots: [pick()], placement },
      ]);
      expect(loadedGroup).toEqual({ roots: [pick()] });
      expect(result.corrections).toEqual([
        expect.stringMatching(
          /^posGroups\[0\]: the placement (is not|needs).* - it was not used, so the planner positions the group \(an existing group keeps its position\)$/
        ),
      ]);
    }
  });

  it('completes a placement where the intent is clear', async () => {
    const placed = async (placement: unknown) =>
      loadedWith([{ roots: [pick()], placement }]);

    let { loadedGroup, result } = await placed({
      posGroup: [4000, -3000],
      posRotationY: 270,
    });
    expect(loadedGroup.repositioningData).toEqual({
      posGroup: [4000, 0, -3000],
      posRotationY: 270,
      rootId: 'u1',
    });
    expect(result.corrections).toEqual([
      "posGroups[0]: the placement's posGroup [4000, -3000] was completed to [4000, 0, -3000] (y = 0 on the floor)",
    ]);

    ({ loadedGroup, result } = await placed({
      posGroup: [0, 0, 0],
      posRotationY: 0,
      rootId: 'u9',
    }));
    expect(loadedGroup.repositioningData.rootId).toBe('u1');
    expect(result.corrections).toEqual([
      "posGroups[0]: the placement's rootId 'u9' is not a root of the group - dropped, the server anchors the group itself",
    ]);

    ({ loadedGroup, result } = await placed({
      posGroup: [0, 0, 0],
      posRotationY: 0,
      scale: 2,
    }));
    expect(loadedGroup.repositioningData).toEqual({
      posGroup: [0, 0, 0],
      posRotationY: 0,
      rootId: 'u1',
    });
    expect(result.corrections).toEqual([
      'posGroups[0]: the placement takes only posGroup, posRotationY and rootId - scale dropped',
    ]);

    ({ loadedGroup, result } = await placed({
      wall: 'right',
      alignment: 'top',
    }));
    expect(loadedGroup).toEqual({ roots: [pick()] });
    expect(result.corrections).toEqual([
      'posGroups[0]: the placement takes only posGroup, posRotationY and rootId - wall, alignment dropped; place-group stands a group against a wall or into a corner by its side label',
      expect.stringMatching(
        /the placement needs posGroup \[x, y, z\].* - it was not used/
      ),
    ]);
  });

  it('uses no placement on a group that is already in the plan, which keeps its position', async () => {
    const { loadedGroup, result } = await loadedWith([
      {
        ...makeShapedGroup(),
        placement: { posGroup: [0, 0, 0], posRotationY: 0 },
      },
    ]);
    expect(loadedGroup).not.toHaveProperty('repositioningData');
    expect(loadedGroup.id).toBe('g1');
    expect(result.corrections).toEqual([
      "posGroups[0]: group 'g1' is already in the plan - its placement was not used and the group keeps its position; place-group moves it",
    ]);
  });

  it('reads an article id the catalog spells differently', async () => {
    const { loadedGroup, result } = await loadedWith([
      { roots: [{ id: 'u1', articleId: ' ARTICLE-1 ' }] },
    ]);
    expect(loadedGroup.roots).toEqual([pick()]);
    expect(result.corrections).toEqual([
      "posGroups[0] root 'u1': articleId ' ARTICLE-1 ' was read as 'article-1'",
    ]);
  });

  it('rejects an article id that is not in the catalog', async () => {
    const api = createApi(planContextFixture);
    await expect(
      toolExecutors['create-or-replace-groups'](api, {
        posGroups: [{ roots: [{ id: 'u1', articleId: 'nope' }] }],
      })
    ).rejects.toThrow(/articleId 'nope' is not in the article catalog/);
    expect(api.extended.loadExternalObjectGroupLayout).not.toHaveBeenCalled();
  });

  it('drops a second docking of a root that already follows in that row', async () => {
    // a row u1 -> u2 -> u3, and u3 listed on u1's RightBottom as well
    const { loadedGroup, result } = await loadedWith([
      {
        roots: [
          {
            id: 'u1',
            articleId: 'article-1',
            contextData: {
              dockedRoots: [
                {
                  ownDockingVector: 'RightBottom',
                  dockedRoots: [
                    { id: 'u2', dockingVector: 'LeftBottom' },
                    { id: 'u3', dockingVector: 'LeftBottom' },
                  ],
                },
              ],
            },
          },
          {
            id: 'u2',
            articleId: 'article-1',
            contextData: {
              dockedRoots: [
                {
                  ownDockingVector: 'RightBottom',
                  dockedRoots: [{ id: 'u3', dockingVector: 'LeftBottom' }],
                },
              ],
            },
          },
          { id: 'u3', articleId: 'article-1' },
        ],
      },
    ]);
    expect(loadedGroup.roots[0].contextData).toEqual({
      dockedRoots: [
        {
          ownDockingVector: 'RightBottom',
          dockedRoots: [{ id: 'u2', dockingVector: 'LeftBottom' }],
        },
      ],
    });
    expect(result.corrections).toEqual([
      "posGroups[0]: roots 'u2', 'u3' were docked to the RightBottom of root 'u1' at the same place - 'u3' already follows in that row, so its second docking was dropped",
    ]);
  });

  it('docks the second of two roots on one side vector to the free end of that row', async () => {
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
                    {
                      id: 'oven',
                      dockingVector: 'RightBottom',
                      ...(cornerMode && { mode: cornerMode }),
                    },
                  ],
                },
                {
                  ownDockingVector: 'RightBottom',
                  dockedRoots: [{ id: 'sink', dockingVector: 'LeftBottom' }],
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
                    {
                      id: 'fridge',
                      dockingVector: 'LeftBottom',
                      ...(fridgeMode && { mode: fridgeMode }),
                    },
                  ],
                },
              ],
            },
          },
          { id: 'fridge', articleId: 'article-1' },
          { id: 'sink', articleId: 'article-1' },
        ],
      },
    ];
    for (const [cornerMode, fridgeMode] of [[], ['EndStart', 'StartEnd']]) {
      const { loadedGroup, result } = await loadedWith(
        kitchen(cornerMode, fridgeMode)
      );
      const [corner, oven, , sink] = loadedGroup.roots;
      // the fridge leaves the oven and continues the row after the sink
      expect(oven.contextData).toEqual({ dockedRoots: [] });
      expect(corner.contextData.dockedRoots).toHaveLength(2);
      expect(sink.contextData).toEqual({
        dockedRoots: [
          {
            ownDockingVector: 'RightBottom',
            dockedRoots: [entry('fridge', 'LeftBottom')],
          },
        ],
      });
      expect(result.corrections).toEqual([
        "posGroups[0]: roots 'corner', 'fridge' were docked to the RightBottom of root 'oven' at the same place - 'fridge' was docked to the RightBottom of 'sink', the free end of that row",
      ]);
    }
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
      { reason: 'adjusted' }
    );
    expect(result).toMatchObject({
      loaded: [{ id: 'loaded-1' }],
      groups: [{ id: 'g1' }],
    });
    expect((result as Record<string, any>).hint).toBeUndefined();
  });

  it('positions a new row by its leftmost root, whatever order it is authored in', async () => {
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
    // the probe of the anchor, then the row; a cabinet's docking corner is its origin
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledTimes(2);
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenLastCalledWith(
      {
        posGroups: [
          {
            roots: rightToLeft,
            repositioningData: { ...placement, rootId: 'u1' },
          },
        ],
      },
      'posGroups',
      { reason: 'adjusted' }
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
        loadExternalObjectGroupLayout: vi.fn(async () => [
          { id: `loaded-${++loads}` },
        ]),
        getExternalObjectGroups: vi.fn(async () =>
          loads === 1
            ? [
                {
                  id: 'probe-group',
                  roots: [
                    {
                      id: 'p1',
                      articleId: 'corner-1',
                      dockInfos: [
                        {
                          id: 'LeftBackBottom',
                          start: [-261, 0, 0],
                          end: [-261, 0, 661],
                        },
                        {
                          id: 'RightBackBottom',
                          start: [-261, 0, 0],
                          end: [900, 0, 0],
                        },
                      ],
                    },
                  ],
                },
              ]
            : []
        ),
      }
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
              // the corner point [-261, 0, 0] of c1 lands at posGroup: the
              // planner puts c1 at [261, 0, 0] from it
              posGroup: [4815, 0, -3765],
              posRotationY: 270,
              rootId: 'c1',
              rootRelPos: [261, 0, 0],
              rootRelRotationY: 0,
            },
          },
        ],
      },
      'posGroups',
      { reason: 'adjusted' }
    );
  });

  describe('anchor probe', () => {
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
    const leftHanded = {
      ...placement,
      rootId: 'c1',
      rootRelPos: [261, 0, 0],
      rootRelRotationY: 0,
    };
    // the planner turns the group to 0 and its corner point lands at posGroup
    const rightHanded = {
      ...placement,
      rootId: 'c1',
      rootRelPos: [0, 0, 1161],
      rootRelRotationY: 90,
    };
    const kitchen = (articleId: string, attributes?: object[]) => ({
      libraryId: 'lib-1',
      roots: [{ id: 'c1', articleId, ...(attributes && { attributes }) }],
      placement,
    });
    // every load before the probe's own read counts: the probe is the first load
    const probingApi = (
      catalog: object[],
      probeGroups: (load: number) => object[],
      planGroups: object[] = []
    ) => {
      let loads = 0;
      return createApi(
        {
          ...planContextFixture,
          articles: [articleFixture, ...catalog],
          groups: [],
        },
        {
          loadExternalObjectGroupLayout: vi.fn(async () => [
            { id: `loaded-${++loads}` },
          ]),
          getExternalObjectGroups: vi.fn(async () => [
            ...planGroups,
            ...probeGroups(loads),
          ]),
        }
      );
    };

    it('has the planner calculate the corner article once, removes the probe and loads the group with its frame', async () => {
      // an empty plan: no calculated corner article anywhere
      let loads = 0;
      const api = createApi(
        {
          ...planContextFixture,
          articles: [articleFixture, cornerArticle],
          groups: [],
        },
        {
          loadExternalObjectGroupLayout: vi.fn(async () => [
            { id: `loaded-${++loads}` },
          ]),
          getExternalObjectGroups: vi.fn(async () =>
            loads === 1 ? [calculatedProbe('EUERTB90')] : []
          ),
        }
      );
      const result = (await toolExecutors['create-or-replace-groups'](api, {
        posGroups: [kitchen('EUERTB90')],
      })) as Record<string, any>;

      const { loadExternalObjectGroupLayout, removeExternalObject } =
        api.extended;
      expect(loadExternalObjectGroupLayout).toHaveBeenCalledTimes(2);
      expect(loadExternalObjectGroupLayout).toHaveBeenNthCalledWith(
        1,
        {
          posGroups: [
            {
              libraryId: 'lib-1',
              roots: [{ id: 'anchor-probe', articleId: 'EUERTB90' }],
            },
          ],
        },
        'posGroups',
        { reason: 'adjusted' }
      );
      expect(removeExternalObject).toHaveBeenCalledWith('probe-group');
      expect(loadExternalObjectGroupLayout).toHaveBeenNthCalledWith(
        2,
        {
          posGroups: [
            {
              libraryId: 'lib-1',
              roots: [{ id: 'c1', articleId: 'EUERTB90' }],
              repositioningData: leftHanded,
            },
          ],
        },
        'posGroups',
        { reason: 'adjusted' }
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
      const api = probingApi([rightHandedArticle], (load) =>
        load === 1 ? [rightHandedProbe('UELTB90')] : []
      );
      await toolExecutors['create-or-replace-groups'](api, {
        posGroups: [kitchen('UELTB90')],
      });
      expect(loadPayload(api, 1).posGroups[0].repositioningData).toEqual(
        rightHanded
      );
    });

    it('probes the anchor with its attributes and keeps one frame per attribute set', async () => {
      // "test the mcp" 16:04, prompt 04: UERTB90 with the carcase direction Right
      const right = [{ id: 'mod_CarcaseDirection', value: 'Right' }];
      const api = probingApi([otherCornerArticle], (load) =>
        load === 1
          ? [rightHandedProbe('UERTB90')]
          : load === 3
            ? [calculatedProbe('UERTB90')]
            : []
      );
      await toolExecutors['create-or-replace-groups'](api, {
        posGroups: [kitchen('UERTB90', right)],
      });
      await toolExecutors['create-or-replace-groups'](api, {
        posGroups: [kitchen('UERTB90')],
      });
      await toolExecutors['create-or-replace-groups'](api, {
        posGroups: [kitchen('UERTB90', right)],
      });

      expect(loadPayload(api, 0)).toEqual({
        posGroups: [
          {
            libraryId: 'lib-1',
            roots: [
              { id: 'anchor-probe', articleId: 'UERTB90', attributes: right },
            ],
          },
        ],
      });
      expect(loadPayload(api, 1).posGroups[0].repositioningData).toEqual(
        rightHanded
      );
      expect(loadPayload(api, 2)).toEqual({
        posGroups: [
          {
            libraryId: 'lib-1',
            roots: [{ id: 'anchor-probe', articleId: 'UERTB90' }],
          },
        ],
      });
      expect(loadPayload(api, 3).posGroups[0].repositioningData).toEqual(
        leftHanded
      );
      // the third call reuses the frame of the first: no probe
      expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledTimes(
        5
      );
      expect(loadPayload(api, 4).posGroups[0].repositioningData).toEqual(
        rightHanded
      );
    });

    it('probes another article of the same module again', async () => {
      const api = probingApi([cornerArticle, rightHandedArticle], (load) =>
        load === 1
          ? [calculatedProbe('EUERTB90')]
          : load === 3
            ? [rightHandedProbe('UELTB90')]
            : []
      );
      await toolExecutors['create-or-replace-groups'](api, {
        posGroups: [kitchen('EUERTB90')],
      });
      await toolExecutors['create-or-replace-groups'](api, {
        posGroups: [kitchen('UELTB90')],
      });

      expect(api.extended.removeExternalObject).toHaveBeenCalledTimes(2);
      expect(loadPayload(api, 1).posGroups[0].repositioningData).toEqual(
        leftHanded
      );
      expect(loadPayload(api, 3).posGroups[0].repositioningData).toEqual(
        rightHanded
      );
    });

    it('probes although the plan has a calculated root of the same corner article', async () => {
      // its attributes may differ from the anchor's; the probe keeps the plan's groups
      const inPlan = { ...calculatedProbe('EUERTB90'), id: 'kitchen-1' };
      const api = probingApi(
        [cornerArticle],
        (load) => (load === 1 ? [calculatedProbe('EUERTB90')] : []),
        [inPlan]
      );
      await toolExecutors['create-or-replace-groups'](api, {
        posGroups: [kitchen('EUERTB90')],
      });

      expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledTimes(
        2
      );
      expect(api.extended.removeExternalObject).toHaveBeenCalledTimes(1);
      expect(api.extended.removeExternalObject).toHaveBeenCalledWith(
        'probe-group'
      );
    });

    it('loads the group by the origin of its anchor and says so when the probe yields no calculated group', async () => {
      const api = createApi(
        {
          ...planContextFixture,
          articles: [articleFixture, cornerArticle],
          groups: [],
        },
        { getExternalObjectGroups: vi.fn(async () => []) }
      );
      const result = (await toolExecutors['create-or-replace-groups'](api, {
        posGroups: [kitchen('EUERTB90'), { roots: [pick()] }],
      })) as Record<string, any>;
      // the probe, then both groups; the probe left nothing behind
      expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledTimes(
        2
      );
      expect(api.extended.removeExternalObject).not.toHaveBeenCalled();
      expect(loadPayload(api, 1).posGroups).toEqual([
        {
          libraryId: 'lib-1',
          roots: [{ id: 'c1', articleId: 'EUERTB90' }],
          repositioningData: { ...placement, rootId: 'c1' },
        },
        { roots: [pick()] },
      ]);
      expect(result.corrections).toEqual([
        "posGroups[0]: root 'c1' ('EUERTB90') could not be calculated before loading - the group was placed by " +
          "the unit's origin and may stand off posGroup; place-group puts it against a wall or into a room corner",
      ]);
      expect(result.notLoaded).toBeUndefined();
    });

    it('removes every group the probe load added, whatever its roots are called', async () => {
      const inPlan = {
        id: 'kitchen-1',
        roots: [{ id: 'k1', articleId: 'article-1' }],
      };
      let loads = 0;
      const api = createApi(
        {
          ...planContextFixture,
          articles: [articleFixture, cornerArticle],
          groups: [],
        },
        {
          loadExternalObjectGroupLayout: vi.fn(async () => [
            { id: `loaded-${++loads}` },
          ]),
          getExternalObjectGroups: vi.fn(async () =>
            loads === 1
              ? [
                  inPlan,
                  {
                    ...calculatedProbe('regenerated-article-id'),
                    id: 'probe-group',
                  },
                ]
              : [inPlan]
          ),
        }
      );
      await toolExecutors['create-or-replace-groups'](api, {
        posGroups: [kitchen('EUERTB90')],
      });

      expect(api.extended.removeExternalObject).toHaveBeenCalledTimes(1);
      expect(api.extended.removeExternalObject).toHaveBeenCalledWith(
        'probe-group'
      );
      // the frame comes from the probe's roots all the same
      expect(loadPayload(api, 1).posGroups[0].repositioningData).toEqual(
        leftHanded
      );
    });

    it.each([
      [
        'its corner point is the origin',
        [
          { id: 'LeftBackBottom', start: [0, 0, 0], end: [0, 0, 661] },
          { id: 'RightBackBottom', start: [0, 0, 0], end: [900, 0, 0] },
        ],
      ],
      [
        'it has no corner vectors',
        [{ id: 'LeftBottom', start: [0, 0, 0], end: [0, 0, 600] }],
      ],
    ])(
      'probes a corner article only once when %s and adds no offset',
      async (_case, dockInfos) => {
        let loads = 0;
        const api = createApi(
          {
            ...planContextFixture,
            articles: [articleFixture, cornerArticle],
            groups: [],
          },
          {
            loadExternalObjectGroupLayout: vi.fn(async () => [
              { id: `loaded-${++loads}` },
            ]),
            getExternalObjectGroups: vi.fn(async () =>
              loads === 1
                ? [
                    {
                      id: 'probe-group',
                      roots: [{ id: 'p1', articleId: 'EUERTB90', dockInfos }],
                    },
                  ]
                : []
            ),
          }
        );
        await toolExecutors['create-or-replace-groups'](api, {
          posGroups: [kitchen('EUERTB90')],
        });
        await toolExecutors['create-or-replace-groups'](api, {
          posGroups: [kitchen('EUERTB90')],
        });

        expect(api.extended.removeExternalObject).toHaveBeenCalledTimes(1);
        // probe + two real loads
        expect(
          api.extended.loadExternalObjectGroupLayout
        ).toHaveBeenCalledTimes(3);
        for (const call of [1, 2]) {
          expect(
            loadPayload(api, call).posGroups[0].repositioningData.posGroup
          ).toEqual([4815, 0, -3765]);
        }
      }
    );

    it('probes although the catalog has a corner point - it tells neither the hand nor the attributes', async () => {
      const api = probingApi(
        [{ ...cornerArticle, cornerPoint: [0, 0, 0] }],
        (load) => (load === 1 ? [calculatedProbe('EUERTB90')] : [])
      );
      await toolExecutors['create-or-replace-groups'](api, {
        posGroups: [kitchen('EUERTB90')],
      });
      expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledTimes(
        2
      );
      expect(loadPayload(api, 1).posGroups[0].repositioningData).toEqual(
        leftHanded
      );
    });

    it('places a range hood by its left edge, not by its centre', async () => {
      // ps_qouy1f7diacd5ogftqoumxrpdkfu5bb: the hood's centre stood at posGroup
      const hood = {
        ...articleFixture,
        articleId: 'DU',
        category: 'Kitchen | Appliances',
      };
      const api = probingApi([hood], (load) =>
        load === 1
          ? [
              {
                id: 'probe-group',
                roots: [
                  {
                    id: 'p1',
                    articleId: 'DU',
                    dockInfos: [
                      {
                        id: 'LeftBottom',
                        start: [-299, 0, 0],
                        end: [-299, 0, 501],
                      },
                      {
                        id: 'RightBottom',
                        start: [299, 0, 0],
                        end: [299, 0, 501],
                      },
                    ],
                  },
                ],
              },
            ]
          : []
      );
      await toolExecutors['create-or-replace-groups'](api, {
        posGroups: [kitchen('DU')],
      });
      expect(loadPayload(api, 1).posGroups[0].repositioningData).toEqual({
        ...placement,
        rootId: 'c1',
        rootRelPos: [299, 0, 0],
        rootRelRotationY: 0,
      });
    });

    it('probes a cabinet anchor once and adds nothing for its frame', async () => {
      const api = createApi(planContextFixture);
      const row = { roots: [pick()], placement };
      await toolExecutors['create-or-replace-groups'](api, {
        posGroups: [row],
      });
      await toolExecutors['create-or-replace-groups'](api, {
        posGroups: [structuredClone(row)],
      });
      // probe + two real loads
      expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledTimes(
        3
      );
      expect(loadPayload(api, 0).posGroups[0].roots).toEqual([
        { id: 'anchor-probe', articleId: 'article-1' },
      ]);
      expect(api.extended.removeExternalObject).toHaveBeenCalledWith(
        'probe-group'
      );
      for (const call of [1, 2]) {
        expect(loadPayload(api, call).posGroups[0].repositioningData).toEqual({
          ...placement,
          rootId: 'u1',
        });
      }
    });
  });

  it('does not probe a group without placement', async () => {
    const api = createApi(planContextFixture);
    await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [{ roots: [pick()] }],
    });
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledTimes(1);
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledWith(
      { posGroups: [{ roots: [pick()] }] },
      'posGroups',
      { reason: 'adjusted' }
    );
  });

  it('replaces an existing group resubmitted without placement, which keeps its position', async () => {
    const api = createApi(planContextFixture);
    // the group exactly as get-plan-context returns it
    const result = await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        makeShapedGroup({
          logMessages: [],
          roots: [
            makeShapedRoot({
              articleName: 'Tall unit',
              desc: 'A tall unit',
              category: 'storage',
              isGenerated: false,
            }),
          ],
        }),
      ],
    });
    expect(result).not.toHaveProperty('corrections');
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
      { reason: 'adjusted' }
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
      { reason: 'adjusted' }
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
      { reason: 'adjusted' }
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
    expect(getExternalObjectPlanContext).toHaveBeenNthCalledWith(1, [
      'articles',
    ]);
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
    expect(result.hint).toMatch(
      /place-group moves it against a wall or into a room corner/
    );
    expect(result.hint).not.toMatch(/repositioningData/);
  });

  it('loads the groups of a call that can be built and reports the others', async () => {
    const api = createApi(planContextFixture);
    const result = (await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        { id: 'broken', roots: [] },
        { roots: [pick()] },
        { roots: [{ id: 'u1', articleId: 'nope' }] },
      ],
    })) as Record<string, any>;
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledWith(
      { posGroups: [{ roots: [pick()] }] },
      'posGroups',
      { reason: 'adjusted' }
    );
    expect(result.notLoaded).toEqual([
      {
        index: 0,
        id: 'broken',
        errors: ['posGroups[0]: needs a non-empty roots array'],
      },
      {
        index: 2,
        errors: [
          "posGroups[2] root 'u1': articleId 'nope' is not in the article catalog. Valid article ids: article-1",
        ],
      },
    ]);
    expect(result).not.toHaveProperty('corrections');
  });

  it('reports neither corrections nor groups not loaded when there are none', async () => {
    const api = createApi(planContextFixture);
    const result = (await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [{ roots: [pick()] }],
    })) as Record<string, any>;
    expect(result).not.toHaveProperty('corrections');
    expect(result).not.toHaveProperty('notLoaded');
  });

  it('accepts several roots on one vector where they do not take the same place', async () => {
    const dock = (
      ownDockingVector: string,
      id: string,
      dockingVector: string,
      offset?: number[]
    ) => ({
      ownDockingVector,
      dockedRoots: [{ id, dockingVector, ...(offset && { offset }) }],
    });
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
                      {
                        id: 'back',
                        dockingVector: 'LeftBottom',
                        mode: 'StartStart',
                      },
                      {
                        id: 'front',
                        dockingVector: 'LeftBottom',
                        mode: 'EndEnd',
                      },
                      {
                        id: 'gap',
                        dockingVector: 'LeftBottom',
                        offset: [600, 0, 0],
                      },
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

describe('create-or-replace-groups relations', () => {
  const kitchenArticle = (
    articleId: string,
    category: string,
    height: number
  ) => ({
    articleId,
    category,
    libraryId: 'lib-1',
    catalog: {},
    cornerArticle: false,
    rootModules: [
      {
        module: { id: 'mr_StorageunitSingle' },
        dimensions: [{ id: 'mod_Height', name: 'Height', value: height }],
        mainAttributes: [],
        dockingVectors: [],
        subModules: [],
      },
    ],
  });
  const kitchenContext = {
    ...planContextFixture,
    articles: [
      kitchenArticle('base', 'Kitchen | Base Units | Storage', 720),
      kitchenArticle('tall', 'Kitchen | Tall Units | Storage', 2100),
      kitchenArticle('wall', 'Kitchen | Wall Units | Storage', 720),
    ],
  };
  const loaded = async (posGroups: unknown[]) => {
    const api = createApi(kitchenContext);
    const result = (await toolExecutors['create-or-replace-groups'](api, {
      posGroups,
    })) as Record<string, any>;
    const calls = api.extended.loadExternalObjectGroupLayout.mock
      .calls as unknown as any[][];
    return { result, loadedGroup: calls[calls.length - 1][0].posGroups[0] };
  };
  const dockingOf = (group: any) =>
    Object.fromEntries(
      group.roots.map((root: any) => [
        root.id,
        root.contextData?.dockedRoots ?? [],
      ])
    );
  const entry = (id: string, dockingVector: string) => ({
    id,
    dockingVector,
    mode: 'StartStart',
    offset: [0, 0, 0],
  });

  it('loads a relation payload as docking, without the relation fields', async () => {
    const { result, loadedGroup } = await loaded([
      {
        libraryId: 'lib-1',
        roots: [
          { id: 't1', articleId: 'tall' },
          { id: 'b1', articleId: 'base', rightOf: 't1' },
          { id: 'w1', articleId: 'wall', rightOf: 't1' },
          { id: 'w2', articleId: 'wall', rightOf: 'w1' },
        ],
      },
    ]);
    expect(dockingOf(loadedGroup)).toEqual({
      t1: [
        {
          ownDockingVector: 'RightBottom',
          dockedRoots: [entry('b1', 'LeftBottom')],
        },
        { ownDockingVector: 'RightTop', dockedRoots: [entry('w1', 'LeftTop')] },
      ],
      b1: [],
      w1: [
        {
          ownDockingVector: 'RightBottom',
          dockedRoots: [entry('w2', 'LeftBottom')],
        },
      ],
      w2: [],
    });
    expect(JSON.stringify(loadedGroup)).not.toMatch(
      /rightOf|leftOf|onTop|"above"|behind/
    );
    expect(result.corrections).toBeUndefined();
  });

  it('reports the defaults of the relations, and the relation fields not as unused', async () => {
    const { result, loadedGroup } = await loaded([
      {
        roots: [
          { id: 'b1', articleId: 'base' },
          { id: 'b2', articleId: 'base' },
          { id: 'w1', articleId: 'wall', above: 'b1', gapMm: 700 },
        ],
      },
    ]);
    expect(result.corrections).toEqual([
      "posGroups[0]: root 'b2' names no neighbour - it was put rightOf 'b1'",
    ]);
    expect(dockingOf(loadedGroup).b1).toHaveLength(2);
    expect(dockingOf(loadedGroup).b1).toEqual(
      expect.arrayContaining([
        {
          ownDockingVector: 'RightBottom',
          dockedRoots: [entry('b2', 'LeftBottom')],
        },
        {
          ownDockingVector: 'LeftTop',
          dockedRoots: [
            {
              id: 'w1',
              dockingVector: 'LeftBottom',
              mode: 'StartStart',
              offset: [0, 700, 0],
            },
          ],
        },
      ])
    );
  });

  it('anchors a placed relation payload at the left end of its floor row', async () => {
    const { loadedGroup } = await loaded([
      {
        placement: { posGroup: [4000, 0, -3000], posRotationY: 270 },
        roots: [
          { id: 'w1', articleId: 'wall', above: 'b1' },
          { id: 'b1', articleId: 'base' },
          { id: 'b2', articleId: 'base', rightOf: 'b1' },
          { id: 'b0', articleId: 'base', leftOf: 'b1' },
        ],
      },
    ]);
    expect(loadedGroup.roots[0].id).toBe('b1');
    expect(loadedGroup.repositioningData.rootId).toBe('b0');
  });

  it('docks the second of two units rightOf one unit to the free end of that row', async () => {
    const { result, loadedGroup } = await loaded([
      {
        roots: [
          { id: 'b1', articleId: 'base' },
          { id: 'b2', articleId: 'base', rightOf: 'b1' },
          { id: 'b3', articleId: 'base', rightOf: 'b1' },
        ],
      },
    ]);
    expect(dockingOf(loadedGroup).b2).toEqual([
      {
        ownDockingVector: 'RightBottom',
        dockedRoots: [entry('b3', 'LeftBottom')],
      },
    ]);
    expect(result.corrections).toEqual([
      "posGroups[0]: roots 'b2', 'b3' were docked to the RightBottom of root 'b1' at the same place - 'b3' was docked to the RightBottom of 'b2', the free end of that row",
    ]);
  });

  it('does not count a unit on top of another as its neighbour beside it', async () => {
    // open issue 2: base.LeftTop carries top1, whose LeftBottom also has a neighbour
    const roots = [
      {
        id: 'base',
        articleId: 'article-1',
        contextData: {
          dockedRoots: [
            {
              ownDockingVector: 'LeftTop',
              dockedRoots: [entry('top1', 'LeftBottom')],
            },
          ],
        },
      },
      {
        id: 'top1',
        articleId: 'article-1',
        contextData: {
          dockedRoots: [
            {
              ownDockingVector: 'LeftBottom',
              dockedRoots: [entry('top2', 'RightBottom')],
            },
          ],
        },
      },
      { id: 'top2', articleId: 'article-1' },
    ];
    const api = createApi(planContextFixture);
    const result = (await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [{ roots: structuredClone(roots) }],
    })) as Record<string, any>;
    const calls = api.extended.loadExternalObjectGroupLayout.mock
      .calls as unknown as any[][];
    expect(calls[calls.length - 1][0].posGroups[0].roots).toEqual(roots);
    expect(result.corrections).toBeUndefined();
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

  // The planner moves a reloaded raw group so that its repositioning root
  // lands at posGroup (G = T(posGroup, posRotationY) · R_root⁻¹).
  const repositioned = (
    group: any,
    { posGroup, posRotationY, rootId }: any
  ) => {
    const anchor = group.roots.find((root: any) => root.id === rootId) ?? {
      articlePos: [0, 0, 0],
      rotationY: 0,
    };
    const rotationY = posRotationY - (anchor.rotationY ?? 0);
    const radians = (rotationY * Math.PI) / 180;
    const [x, y, z] = anchor.articlePos ?? [0, 0, 0];
    const offset = [
      x * Math.cos(radians) + z * Math.sin(radians),
      y,
      -x * Math.sin(radians) + z * Math.cos(radians),
    ];
    return {
      ...group,
      pos: posGroup.map((value: number, axis: number) => value - offset[axis]),
      rotationY,
    };
  };

  const createPlaceApi = (
    shapedGroups: any[],
    rawGroups: any[],
    afterShapedGroups: any[] = shapedGroups
  ) => {
    let currentRawGroups = rawGroups;
    return createApi(undefined, {
      getExternalObjectPlanContext: vi.fn(async (sections: string[]) =>
        sections.includes('rooms')
          ? { rooms: { rooms: [room] }, groups: shapedGroups }
          : { groups: afterShapedGroups }
      ),
      getExternalObjectGroups: vi.fn(async () => currentRawGroups),
      loadExternalObjectGroupLayout: vi.fn(async (layout: any) => {
        const { id, repositioningData } = layout.posGroups[0];
        currentRawGroups = currentRawGroups.map((group) =>
          group.id === id && repositioningData
            ? repositioned(group, repositioningData)
            : group
        );
        return [{ id: 'g1' }];
      }),
    });
  };

  const reloadedGroup = (api: ReturnType<typeof createPlaceApi>) => {
    const calls = api.extended.loadExternalObjectGroupLayout.mock
      .calls as unknown as any[][];
    expect(calls).toHaveLength(1);
    return calls[0][0].posGroups[0];
  };

  it('rejects an unknown group id', async () => {
    const api = createPlaceApi([makeShapedGroup({ id: 'g7' })], []);
    await expect(
      toolExecutors['place-group'](api, { groupId: 'nope', wall: 'right' })
    ).rejects.toThrow(/Group 'nope' not found. Groups in the plan: g7/);
    expect(api.extended.loadExternalObjectGroupLayout).not.toHaveBeenCalled();
  });

  it('accepts a unique id prefix and a wall index', async () => {
    const api = createPlaceApi(
      [makeShapedGroup({ id: 'group-abc' })],
      [makeGroup({ id: 'group-abc' })]
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
      { reason: 'adjusted' }
    );
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      placedIn: 'wall',
      wall: room.walls[1],
      group: moved,
    });
  });

  // a group with height data: 800 x 600 mm, 2000 mm high
  const tallRoot = (overrides: Record<string, unknown> = {}) =>
    makeRoot({
      attributes: [
        { id: 'b', value: 800, isInput: true },
        { id: 't', value: 600, isInput: true },
        { id: 'h', value: 2000, isInput: true },
      ],
      ...overrides,
    });

  const neighbourOnTheRightWall = (pos: number[], widthMm = 800) =>
    makeGroup({
      id: 'g2',
      pos,
      rotationY: 270,
      roots: [
        tallRoot({
          id: 'r2',
          attributes: [
            { id: 'b', value: widthMm, isInput: true },
            { id: 't', value: 600, isInput: true },
            { id: 'h', value: 2000, isInput: true },
          ],
        }),
      ],
    });

  const shapedPair = [makeShapedGroup(), makeShapedGroup({ id: 'g2' })];

  it('moves a target that overlaps another group along the wall and reports it', async () => {
    // g2 stands centred on the right wall, where g1 is asked to go
    const api = createPlaceApi(shapedPair, [
      makeGroup({ roots: [tallRoot()] }),
      neighbourOnTheRightWall([4000, 0, -1900]),
    ]);
    const result = (await toolExecutors['place-group'](api, {
      groupId: 'g1',
      wall: 'right',
    })) as Record<string, any>;
    expect(reloadedGroup(api).repositioningData.posGroup).toEqual([
      4000, 0, -2700,
    ]);
    expect(result.corrections).toEqual([
      "Group 'g1' would overlap group 'g2' at the right wall - it was moved 800 mm along the wall to stand beside it. If the units belong together, join the groups with merge-groups",
    ]);
  });

  it('places a group that only touches another one as asked', async () => {
    const api = createPlaceApi(shapedPair, [
      makeGroup({ roots: [tallRoot()] }),
      neighbourOnTheRightWall([4000, 0, -2700]),
    ]);
    const result = (await toolExecutors['place-group'](api, {
      groupId: 'g1',
      wall: 'right',
    })) as Record<string, any>;
    expect(reloadedGroup(api).repositioningData.posGroup).toEqual([
      4000, 0, -1900,
    ]);
    expect(result).not.toHaveProperty('corrections');
  });

  it('does not count wall units above another group as an overlap', async () => {
    const wallUnits = makeGroup({
      pos: [0, 1400, 0],
      roots: [
        tallRoot({
          attributes: [
            { id: 'b', value: 800, isInput: true },
            { id: 't', value: 350, isInput: true },
            { id: 'h', value: 700, isInput: true },
          ],
        }),
      ],
    });
    const baseUnits = neighbourOnTheRightWall([4000, 0, -1900]);
    baseUnits.roots[0].attributes[2] = { id: 'h', value: 900, isInput: true };
    const api = createPlaceApi(shapedPair, [wallUnits, baseUnits]);
    const result = (await toolExecutors['place-group'](api, {
      groupId: 'g1',
      wall: 'right',
    })) as Record<string, any>;
    expect(reloadedGroup(api).repositioningData.posGroup).toEqual([
      4000, 1400, -1900,
    ]);
    expect(result).not.toHaveProperty('corrections');
  });

  it('places the group as asked and reports the overlap when the wall has no free position', async () => {
    const api = createPlaceApi(shapedPair, [
      makeGroup({ roots: [tallRoot()] }),
      neighbourOnTheRightWall([4000, 0, -3000], 3000),
    ]);
    const result = (await toolExecutors['place-group'](api, {
      groupId: 'g1',
      wall: 'right',
    })) as Record<string, any>;
    expect(reloadedGroup(api).repositioningData.posGroup).toEqual([
      4000, 0, -1900,
    ]);
    expect(result.corrections).toEqual([
      "Group 'g1' overlaps group 'g2' - there is no free position on the right wall for it, so it stands where it was asked to",
    ]);
  });

  it('puts a group with a corner article into the corner the alignment names', async () => {
    const api = createPlaceApi(
      [makeShapedGroup({ roots: [makeShapedRoot({ id: 'c1' })] })],
      [
        makeGroup({
          roots: [makeRoot({ id: 'c1', dockInfos: cornerDockInfos })],
        }),
      ]
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
      /repositioningData|rootRelPos|cornerPoint/
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
      ]
    );
    await toolExecutors['place-group'](api, {
      groupId: 'g1',
      wall: 'right',
      alignment: 'top',
    });
    const { posGroup, posRotationY, rootId } =
      reloadedGroup(api).repositioningData;
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
      [makeGroup({ pos: [0, 1400, 0] })]
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
      [
        makeGroup({
          roots: [makeRoot({ id: 'w1', isGenerated: true }), makeRoot()],
        }),
      ]
    );
    await toolExecutors['place-group'](api, { groupId: 'g1', wall: 'right' });
    const reloaded = reloadedGroup(api);
    expect(reloaded.roots.map((root: any) => root.id)).toEqual(['r1']);
    expect(reloaded.repositioningData.rootId).toBe('r1');
  });

  it('rejects an unknown room or wall before reading the calculated groups', async () => {
    const api = createPlaceApi([makeShapedGroup()], [makeGroup()]);
    const place = (args: Record<string, unknown>) =>
      toolExecutors['place-group'](api, { groupId: 'g1', ...args });
    await expect(place({ wall: 'right', roomIndex: 1 })).rejects.toThrow(
      /Room index 1 not found - the plan has 1 room\(s\)/
    );
    await expect(place({ wall: 7 })).rejects.toThrow(/Wall '7' not found/);
    expect(api.extended.getExternalObjectGroups).not.toHaveBeenCalled();
    expect(api.extended.loadExternalObjectGroupLayout).not.toHaveBeenCalled();
  });

  it('centres the group when the alignment runs parallel to the wall', async () => {
    const api = createPlaceApi([makeShapedGroup()], [makeGroup()]);
    const result = (await toolExecutors['place-group'](api, {
      groupId: 'g1',
      wall: 'right',
      alignment: 'right',
    })) as Record<string, any>;
    expect(reloadedGroup(api).repositioningData.posGroup).toEqual([
      4000, 0, -1900,
    ]);
    expect(result.corrections).toEqual([
      "The alignment 'right' runs parallel to the right wall - the group was centred on the wall instead",
    ]);
  });

  it('reads back and front as the top and the bottom wall', async () => {
    const api = createPlaceApi([makeShapedGroup()], [makeGroup()]);
    const result = (await toolExecutors['place-group'](api, {
      groupId: 'g1',
      wall: 'back',
      alignment: 'right',
    })) as Record<string, any>;
    expect(result.wall).toEqual(room.walls[2]);
    expect(result).not.toHaveProperty('corrections');
  });

  it('rejects a group the planner has not calculated', async () => {
    const api = createPlaceApi([makeShapedGroup()], []);
    await expect(
      toolExecutors['place-group'](api, { groupId: 'g1', wall: 'right' })
    ).rejects.toThrow(/Group 'g1' has no calculated geometry to place/);
    expect(api.extended.loadExternalObjectGroupLayout).not.toHaveBeenCalled();
  });
});

describe('positions in the placement frame', () => {
  // a range hood in a group of its own, just created: the planner keeps the
  // group origin at the hood's centre, 299 mm right of its left edge
  const hoodGroup = {
    id: 'hood',
    libraryId: 'lib-1',
    position: {
      pos: [2299, 0, -2000],
      rotationY: 0,
      footprint: { x: [-299, 299], z: [0, 501], widthMm: 598, depthMm: 501 },
    },
    roots: [{ id: 'h1', articleId: 'DU' }],
  };
  const rawHoodGroup = {
    id: 'hood',
    pos: [2299, 0, -2000],
    rotationY: 0,
    roots: [
      {
        id: 'h1',
        articleId: 'DU',
        articlePos: [0, 0, 0],
        rotationY: 0,
        dockInfos: [
          { id: 'LeftBottom', start: [-299, 0, 0], end: [-299, 0, 501] },
          { id: 'RightBottom', start: [299, 0, 0], end: [299, 0, 501] },
        ],
      },
    ],
  };
  const atLeftEdge = {
    pos: [2000, 0, -2000],
    rotationY: 0,
    footprint: { x: [0, 598], z: [0, 501], widthMm: 598, depthMm: 501 },
  };

  it('reports a group of get-plan-context by its back left corner, as a placement names it', async () => {
    const api = createApi(
      { ...planContextFixture, groups: [hoodGroup] },
      { getExternalObjectGroups: vi.fn(async () => [rawHoodGroup]) }
    );
    const result = (await toolExecutors['get-plan-context'](api, {
      include: ['groups'],
    })) as Record<string, any>;
    expect(result.groups[0]).toEqual({ ...hoodGroup, position: atLeftEdge });
    // the planner's own group stays as it is
    expect(hoodGroup.position.pos).toEqual([2299, 0, -2000]);
  });

  it('reads no raw groups for a plan context without groups', async () => {
    const api = createApi({ rooms: { rooms: [room] } });
    await toolExecutors['get-plan-context'](api, { include: ['rooms'] });
    expect(api.extended.getExternalObjectGroups).not.toHaveBeenCalled();
  });

  it('reports the groups of create-or-replace-groups and of the command tools the same way', async () => {
    const api = createApi(
      { ...planContextFixture, groups: [hoodGroup] },
      {
        getExternalObjectGroups: vi.fn(async () => [rawHoodGroup]),
        externalObjectGroupOperation: vi.fn(async (command: string) => ({
          command,
          groups: [hoodGroup],
          removedGroupIds: [],
        })),
      }
    );
    const created = (await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [{ roots: [pick()] }],
    })) as Record<string, any>;
    expect(created.groups[0].position).toEqual(atLeftEdge);
    const changed = (await toolExecutors['change-group-attribute'](api, {
      groupId: 'hood',
      attributeId: 'grp_Front',
      value: 'walnut',
    })) as Record<string, any>;
    expect(changed.groups[0].position).toEqual(atLeftEdge);
  });

  it('leaves a group as the planner reports it when there is no calculated group or no position', async () => {
    const unpositioned = {
      ...hoodGroup,
      id: 'replaced',
      position: { footprint: hoodGroup.position.footprint },
    };
    const api = createApi(
      { ...planContextFixture, groups: [hoodGroup, unpositioned] },
      { getExternalObjectGroups: vi.fn(async () => []) }
    );
    const result = (await toolExecutors['get-plan-context'](api, {
      include: ['groups'],
    })) as Record<string, any>;
    expect(result.groups).toEqual([hoodGroup, unpositioned]);
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
      }
    );
    await expect(toolExecutors['get-order-data'](api, {})).resolves.toEqual({
      orderId: 'o1',
    });
    expect(api.extended.getExternalObjectSnapshot).toHaveBeenCalledWith({
      orderData: true,
    });
    const emptyApi = createApi(
      {},
      { getExternalObjectSnapshot: vi.fn(async () => null) }
    );
    await expect(
      toolExecutors['get-order-data'](emptyApi, {})
    ).resolves.toBeNull();
  });

  it('returns the plan images of the external object snapshot', async () => {
    const api = createApi(
      {},
      {
        getExternalObjectSnapshot: vi.fn(async () => ({
          perspectiveImage: 'data:image/png;base64,AAA=',
          topImage: 'data:image/png;base64,BBB=',
        })),
      }
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
      {
        rootModuleId: 'r1',
        moduleId: null,
        attributeId: 'front',
        value: 'white',
      },
    ],
    [
      'change-module-attribute',
      {
        rootModuleId: 'r1',
        moduleId: 'sub-1',
        attributeId: 'front',
        value: 'white',
      },
      {
        rootModuleId: 'r1',
        moduleId: 'sub-1',
        attributeId: 'front',
        value: 'white',
      },
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
      payload
    );
  });

  it.each([
    [
      'change-group-attribute',
      { groupId: 'kitchen', attributeId: 'front', value: 'white' },
    ],
    ['delete-group', { groupId: 'hall-1' }],
    [
      'merge-article-into-group',
      { groupId: 'kitchen', articleId: 'article-1', dockTo },
    ],
    [
      'exchange-root-module',
      { groupId: 'hall', rootModuleId: 'r1', articleId: 'article-1' },
    ],
    ['merge-groups', { targetGroupId: 'kitchen-1', groupIds: ['kitchen'] }],
  ])(
    '%s rejects an unknown or ambiguous group id with the groups in the plan',
    async (tool, args) => {
      const api = createApi(planWithGroups);

      await expect(toolExecutors[tool](api, args)).rejects.toThrow(
        /Group '\w+(-\d)?' not found\. Groups in the plan: kitchen-1, kitchen-2, island-1\./
      );
      expect(api.extended.externalObjectGroupOperation).not.toHaveBeenCalled();
    }
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
        })
      ).rejects.toThrow(
        "articleId 'article-9' is not in the article catalog of library 'lib-1'. Valid article ids: article-1"
      );
      expect(api.extended.externalObjectGroupOperation).not.toHaveBeenCalled();
    }
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
        })
      ).rejects.toThrow(
        "articleId 'article-2' is not in the article catalog of library 'lib-1'. Valid article ids: article-1"
      );
      expect(api.extended.externalObjectGroupOperation).not.toHaveBeenCalled();
    }
  );

  it.each(['merge-article-into-group', 'exchange-root-module'])(
    '%s reads an article id the catalog spells differently and reports it',
    async (tool) => {
      const api = createApi(planWithGroups);

      const result = await toolExecutors[tool](api, {
        groupId: 'kitchen-1',
        rootModuleId: 'r1',
        articleId: 'Article-1',
        dockTo,
      });
      expect(api.extended.externalObjectGroupOperation).toHaveBeenCalledWith(
        tool,
        expect.objectContaining({ articleId: 'article-1' })
      );
      expect(result).toEqual({
        command: tool,
        groups: [],
        removedGroupIds: [],
        corrections: [`${tool}: articleId 'Article-1' was read as 'article-1'`],
      });
    }
  );

  describe('merge-article-into-group docking', () => {
    // r1 -> r2 -> r3 along RightBottom, as get-plan-context returns them with
    // the reciprocal entries
    const row = (r3Docking: unknown[] = []) =>
      makeShapedGroup({
        id: 'kitchen-1',
        roots: [
          makeShapedRoot({
            id: 'r1',
            freeDockingVectors: ['LeftBottom'],
            contextData: {
              dockedRoots: [
                {
                  ownDockingVector: 'RightBottom',
                  dockedRoots: [{ id: 'r2', dockingVector: 'LeftBottom' }],
                },
              ],
            },
          }),
          makeShapedRoot({
            id: 'r2',
            freeDockingVectors: [],
            contextData: {
              dockedRoots: [
                {
                  ownDockingVector: 'LeftBottom',
                  dockedRoots: [{ id: 'r1', dockingVector: 'RightBottom' }],
                },
                {
                  ownDockingVector: 'RightBottom',
                  dockedRoots: [{ id: 'r3', dockingVector: 'LeftBottom' }],
                },
              ],
            },
          }),
          makeShapedRoot({
            id: 'r3',
            freeDockingVectors: r3Docking.length > 0 ? [] : ['RightBottom'],
            contextData: {
              dockedRoots: [
                {
                  ownDockingVector: 'LeftBottom',
                  dockedRoots: [{ id: 'r2', dockingVector: 'RightBottom' }],
                },
                ...r3Docking,
              ],
            },
          }),
        ],
      });

    const merge = async (
      group: unknown,
      dockTo: Record<string, unknown>,
      articles = [articleFixture]
    ) => {
      const api = createApi({
        ...planContextFixture,
        articles,
        groups: [group],
      });
      const result = await toolExecutors['merge-article-into-group'](api, {
        groupId: 'kitchen-1',
        articleId: 'article-1',
        dockTo,
      });
      const [, payload] = (
        api.extended.externalObjectGroupOperation.mock
          .calls as unknown as any[][]
      )[0];
      return { result: result as Record<string, any>, dockTo: payload.dockTo };
    };

    it('docks a unit on a taken side to the free end of that row', async () => {
      const { result, dockTo: sent } = await merge(row(), dockTo);
      expect(sent).toEqual({ ...dockTo, rootId: 'r3' });
      expect(result.corrections).toEqual([
        "merge-article-into-group: the RightBottom of root 'r1' is taken - the unit was docked to the RightBottom of 'r3', the free end of that row",
      ]);
    });

    it('forwards a side the planner reports as taken although the row ends there', async () => {
      // r3 still names a deleted unit on its RightBottom
      const stale = row([
        {
          ownDockingVector: 'RightBottom',
          dockedRoots: [{ id: 'deleted', dockingVector: 'LeftBottom' }],
        },
      ]);
      const { result, dockTo: sent } = await merge(stale, dockTo);
      expect(sent).toEqual(dockTo);
      expect(result).not.toHaveProperty('corrections');
    });

    it("uses the partner of the root's vector when the article lacks the named one", async () => {
      const article = {
        ...articleFixture,
        rootModules: [
          {
            module: { id: 'module-1' },
            dockingVectors: ['LeftBottom', 'RightBottom'],
          },
        ],
      };
      const group = makeShapedGroup({ id: 'kitchen-1' });
      const { result, dockTo: sent } = await merge(
        group,
        { ...dockTo, dockingVector: 'LeftTop' },
        [article]
      );
      expect(sent).toEqual(dockTo);
      expect(result.corrections).toEqual([
        "merge-article-into-group: article 'article-1' has no docking vector 'LeftTop' - its LeftBottom meets the RightBottom",
      ]);
    });
  });

  it('passes a number as an attribute value on as its string', async () => {
    const api = createApi(planWithGroups);
    await toolExecutors['change-group-attribute'](api, {
      groupId: 'kitchen-1',
      attributeId: 'b',
      value: 900,
    });
    expect(api.extended.externalObjectGroupOperation).toHaveBeenCalledWith(
      'change-group-attribute',
      { groupId: 'kitchen-1', attributeId: 'b', value: '900' }
    );
  });

  it('passes the reason of a refused command through', async () => {
    const api = createApi(planWithGroups, {
      externalObjectGroupOperation: vi.fn(async () => {
        throw new Error(
          "Root module 'r1' has no free docking vector 'RightBottom' - its free docking vectors: LeftBottom."
        );
      }),
    });

    await expect(
      toolExecutors['merge-article-into-group'](api, {
        groupId: 'kitchen-1',
        articleId: 'article-1',
        dockTo,
      })
    ).rejects.toThrow(
      "Root module 'r1' has no free docking vector 'RightBottom'"
    );
  });
});

describe('plan changes', () => {
  // a planner command that takes a moment and records when it runs
  const recordingApi = (events: string[], failing: string[] = []) =>
    createApi(planContextFixture, {
      externalObjectGroupOperation: vi.fn(
        async (command: string, payload: any) => {
          events.push(`start ${payload.rootModuleId}`);
          await new Promise((resolve) => setTimeout(resolve, 10));
          events.push(`end ${payload.rootModuleId}`);
          if (failing.includes(payload.rootModuleId)) {
            throw new Error(`refused ${payload.rootModuleId}`);
          }
          return { command, groups: [], removedGroupIds: [] };
        }
      ),
    });

  it('runs tool calls that change the plan one after another', async () => {
    const events: string[] = [];
    const api = recordingApi(events);
    await Promise.all([
      toolExecutors['delete-root-module'](api, { rootModuleId: 'a' }),
      toolExecutors['change-module-attribute'](api, {
        rootModuleId: 'b',
        attributeId: 'b',
        value: '900',
      }),
    ]);
    expect(events).toEqual(['start a', 'end a', 'start b', 'end b']);
  });

  it('reads the plan context after a running plan change, both reads in one plan state', async () => {
    const events: string[] = [];
    const api = recordingApi(events);
    api.extended.getExternalObjectPlanContext.mockImplementation(async () => {
      events.push('plan context');
      return planContextFixture;
    });
    api.extended.getExternalObjectGroups.mockImplementation(async () => {
      events.push('calculated groups');
      return [];
    });
    await Promise.all([
      toolExecutors['delete-root-module'](api, { rootModuleId: 'a' }),
      toolExecutors['get-plan-context'](api, { include: ['groups'] }),
    ]);
    expect(events).toEqual([
      'start a',
      'end a',
      'plan context',
      'calculated groups',
    ]);
  });

  it('runs the next plan change after one that fails', async () => {
    const events: string[] = [];
    const api = recordingApi(events, ['a']);
    const [first, second] = await Promise.allSettled([
      toolExecutors['delete-root-module'](api, { rootModuleId: 'a' }),
      toolExecutors['delete-root-module'](api, { rootModuleId: 'b' }),
    ]);
    expect(first).toMatchObject({
      status: 'rejected',
      reason: new Error('refused a'),
    });
    expect(second).toMatchObject({ status: 'fulfilled' });
    expect(events).toEqual(['start a', 'end a', 'start b', 'end b']);
  });
});
