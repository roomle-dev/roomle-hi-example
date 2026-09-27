import { describe, expect, it, vi } from 'vitest';
import { toolExecutors } from '../tool-executors';

// rectangular room 4000 x 3000 mm, contour in plan space
const room = {
  levels: [
    {
      level: 0,
      segments: [
        { cmd: 'M', x: 0, y: 0 },
        { cmd: 'L', x: 4000, y: 0, type: 'wall' },
        { cmd: 'L', x: 4000, y: 3000, type: 'wall' },
        { cmd: 'L', x: 0, y: 3000, type: 'wall' },
        { cmd: 'L', x: 0, y: 0, type: 'wall' },
      ],
    },
  ],
};

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
        assignedAttributes: ['b', 't', 'front'],
      },
      {
        id: 'sub-1',
        name: 'Sub 1',
        desc: 'A sub module',
        imageUrl: 'https://example.com/sub-1.png',
      },
    ],
    attributes: [
      {
        id: 'b',
        name: 'Width',
        desc: 'the width',
        type: 'Dim',
        group: 'dim',
        isMain: true,
        userRight: 'Simple',
        selections: [],
      },
      {
        id: 't',
        name: 'Depth',
        desc: 'the depth',
        type: 'Dim',
        group: 'dim',
        isMain: true,
        selections: [],
      },
      {
        id: 'front',
        name: 'Front colour',
        desc: 'the colour of the front',
        imageUrl: 'https://example.com/front.png',
        type: 'Simple',
        group: 'fronts',
        isMain: true,
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
  groups: [makeGroup()],
};

const createApi = (
  planContext: unknown,
  overrides: Record<string, unknown> = {},
) => ({
  extended: {
    getExternalObjectPlanContext: vi.fn(async () => planContext),
    loadExternalObjectGroupLayout: vi.fn(async () => [{ id: 'loaded-1' }]),
    removeExternalObject: vi.fn(),
    updateExternalObjectGroupAttribute: vi.fn(async () => undefined),
    fetchPrice: vi.fn(async () => ({ price: 42 })),
    getExternalObjectSnapshot: vi.fn(async () => ({})),
    ...overrides,
  },
});

const pick = () => ({ id: 'u1', articleId: 'article-1' });

describe('get-plan-context', () => {
  it('fetches and returns the default sections', async () => {
    const api = createApi(planContextFixture);
    const result = (await toolExecutors['get-plan-context'](api, {})) as Record<
      string,
      any
    >;
    expect(api.extended.getExternalObjectPlanContext).toHaveBeenCalledWith([
      'rooms',
      'articles',
      'groups',
      'masterData',
    ]);
    expect(Object.keys(result).sort()).toEqual(['articles', 'groups', 'rooms']);
  });

  it('returns only the explicitly requested master data section', async () => {
    const api = createApi(planContextFixture);
    const result = (await toolExecutors['get-plan-context'](api, {
      include: ['masterData'],
    })) as Record<string, any>;
    expect(Object.keys(result)).toEqual(['masterData']);
    expect(api.extended.getExternalObjectPlanContext).toHaveBeenCalledWith([
      'masterData',
    ]);
    const masterData = (result as Record<string, any>).masterData['lib-1'];
    expect(masterData.modules).toEqual([
      {
        id: 'module-1',
        name: 'Tall module',
        desc: 'A tall module',
        imageUrl: 'https://example.com/module-1.png',
        attributes: ['b', 't', 'front'],
      },
    ]);
    expect(masterData.attributes.map((attribute: any) => attribute.id)).toEqual(
      ['b', 't', 'front'],
    );
  });

  it('keeps the images and descriptions of the attributes and their selections', async () => {
    const api = createApi(planContextFixture);
    const result = (await toolExecutors['get-plan-context'](api, {
      include: ['masterData'],
    })) as Record<string, any>;
    const front = result.masterData['lib-1'].attributes.find(
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

  it('compacts the article catalog with dimensions and docking vectors', async () => {
    const api = createApi(planContextFixture);
    const result = await toolExecutors['get-plan-context'](api, {
      include: ['articles'],
    });
    const article = (result as Record<string, any>).articles[0];
    expect(article.articleId).toBe('article-1');
    expect(article.desc).toBe('A tall unit');
    expect(article.imageUrl).toBe('https://example.com/a1.png');
    expect(article.cornerArticle).toBe(false);
    expect(article.rootModules[0]).toEqual({
      module: {
        id: 'module-1',
        name: 'Tall module',
        desc: 'A tall module',
        imageUrl: 'https://example.com/module-1.png',
      },
      dimensions: [
        { id: 'b', name: 'Width', value: 800 },
        { id: 't', name: 'Depth', value: 600 },
      ],
      mainAttributes: [{ id: 'front', name: 'Front colour', value: 'white' }],
      dockingVectors: ['LeftBottom', 'RightBottom'],
      insertLevels: [],
      subModules: [
        {
          id: 'sub-1',
          name: 'Sub 1',
          desc: 'A sub module',
          imageUrl: 'https://example.com/sub-1.png',
        },
      ],
    });
  });

  it('flags a corner article and falls back to calculated docking vectors', async () => {
    const withoutTemplateVectors = {
      ...planContextFixture,
      articles: [
        {
          ...articleFixture,
          roots: articleFixture.roots.map((root) => ({
            ...root,
            dockInfos: undefined,
          })),
        },
      ],
    };
    const api = createApi(withoutTemplateVectors);
    const result = await toolExecutors['get-plan-context'](api, {
      include: ['articles'],
    });
    const article = (result as Record<string, any>).articles[0];
    // the calculated root of article-1 in the plan carries the vectors
    expect(article.rootModules[0].dockingVectors).toEqual([
      'LeftBottom',
      'RightBottom',
    ]);
    expect(article.cornerArticle).toBe(false);

    const withCornerArticle = {
      ...planContextFixture,
      articles: [
        {
          ...articleFixture,
          roots: articleFixture.roots.map((root) => ({
            ...root,
            dockInfos: [{ id: 'LeftBackBottom' }, { id: 'RightBackBottom' }],
          })),
        },
      ],
    };
    const cornerApi = createApi(withCornerArticle);
    const cornerResult = await toolExecutors['get-plan-context'](cornerApi, {
      include: ['articles'],
    });
    expect(
      (cornerResult as Record<string, any>).articles[0].cornerArticle,
    ).toBe(true);
  });

  it('shapes rooms with derived walls and groups with free docking vectors', async () => {
    const api = createApi(planContextFixture);
    const result = await toolExecutors['get-plan-context'](api, {});
    const rooms = (result as Record<string, any>).rooms.rooms;
    expect(rooms[0].walls).toHaveLength(4);
    expect(rooms[0].walls[1].side).toBe('right');

    const group = (result as Record<string, any>).groups[0];
    expect(group.id).toBe('g1');
    expect(group.position.footprint).toEqual({
      x: [0, 800],
      z: [0, 600],
      widthMm: 800,
      depthMm: 600,
    });
    const root = group.roots[0];
    expect(root.attributes).toEqual([
      { id: 'b', value: 800 },
      { id: 't', value: 600 },
    ]);
    expect(root.freeDockingVectors).toEqual(['LeftBottom', 'RightBottom']);
  });

  it('keeps the images and descriptions of the roots and their sub-modules', async () => {
    const withImages = {
      ...planContextFixture,
      groups: [
        makeGroup({
          roots: [
            makeRoot({
              desc: 'A tall unit',
              imageUrl: 'https://example.com/a1.png',
              modules: [
                { name: 'sub-1', imageUrl: 'https://example.com/sub-1.png' },
              ],
            }),
          ],
        }),
      ],
    };
    const api = createApi(withImages);
    const result = await toolExecutors['get-plan-context'](api, {
      include: ['groups'],
    });
    const root = (result as Record<string, any>).groups[0].roots[0];
    expect(root.desc).toBe('A tall unit');
    expect(root.imageUrl).toBe('https://example.com/a1.png');
    expect(root.subModules).toEqual([
      { id: 'sub-1', imageUrl: 'https://example.com/sub-1.png' },
    ]);
  });

  it('reports the docking vectors no docking entry uses as free', async () => {
    const withDocking = {
      ...planContextFixture,
      groups: [
        makeGroup({
          roots: [
            makeRoot({
              contextData: {
                dockedRoots: [
                  {
                    ownDockingVector: 'RightBottom',
                    dockedRoots: [
                      { id: 'r2', dockingVector: 'LeftBottom' },
                    ],
                  },
                ],
              },
            }),
          ],
        }),
      ],
    };
    const api = createApi(withDocking);
    const result = await toolExecutors['get-plan-context'](api, {});
    const root = (result as Record<string, any>).groups[0].roots[0];
    expect(root.freeDockingVectors).toEqual(['LeftBottom']);
    expect(root.contextData).toEqual({
      dockedRoots: [
        {
          ownDockingVector: 'RightBottom',
          dockedRoots: [{ id: 'r2', dockingVector: 'LeftBottom' }],
        },
      ],
    });
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
          userRight: undefined,
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
              assignedAttributes: attributes.map((attribute) => attribute.id),
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

  it('rejects an invalid placement', async () => {
    await expectRejectedBeforeLoad(
      [{ roots: [pick()], placement: { wall: 'north' } }],
      /placement: wall must be a side label/,
    );
    await expectRejectedBeforeLoad(
      [{ roots: [pick()], placement: { wall: 'right', alignment: 'middle' } }],
      /alignment must be one of/,
    );
    await expectRejectedBeforeLoad(
      [
        {
          roots: [pick()],
          placement: { wall: 'right' },
          repositioningData: {
            posGroup: [0, 0, 0],
            posRotationY: 0,
            rootId: 'u1',
          },
        },
      ],
      /use either placement or repositioningData/,
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
    expect((result as Record<string, any>).placements).toBeUndefined();
    expect((result as Record<string, any>).hint).toBeUndefined();
  });

  it('keeps repositioningData of a group without a placement', async () => {
    const api = createApi(planContextFixture);
    const repositioningData = {
      posGroup: [100, 0, 100],
      posRotationY: 90,
      rootId: 'u1',
    };
    await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        {
          roots: [pick()],
          repositioningData,
        },
      ],
    });
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledWith(
      { posGroups: [{ roots: [pick()], repositioningData }] },
      'posGroups',
      { reason: 'adjusted' },
    );
  });

  it('resolves a placement before loading and re-applies it as repositioningData', async () => {
    const existingGroup = makeGroup({ id: 'g1', pos: [2000, 0, -3000] });
    const loadedGroup = makeGroup({
      id: 'g2',
      pos: undefined,
      roots: [makeRoot({ id: 'r2' })],
    });
    const placedGroup = makeGroup({
      id: 'g2',
      pos: [4000, 0, -1900],
      rotationY: 270,
      roots: [makeRoot({ id: 'r2' })],
    });
    let groupsFetches = 0;
    const api = {
      extended: {
        getExternalObjectPlanContext: vi.fn((sections: string[]) => {
          if (sections.includes('articles')) {
            return Promise.resolve({ articles: [articleFixture] });
          }
          if (sections.includes('rooms')) {
            return Promise.resolve({
              rooms: { rooms: [room] },
              groups: [existingGroup],
            });
          }
          groupsFetches += 1;
          return Promise.resolve({
            groups:
              groupsFetches === 1
                ? [existingGroup, loadedGroup]
                : [existingGroup, placedGroup],
          });
        }),
        loadExternalObjectGroupLayout: vi.fn(async () => [{ id: 'g2' }]),
        removeExternalObject: vi.fn(),
      },
    };
    const result = await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        {
          placement: { wall: 'right' },
          roots: [{ id: 'u1', articleId: 'article-1' }],
        },
      ],
    });
    const load = api.extended.loadExternalObjectGroupLayout.mock
      .calls as any[][];
    // the placement is resolved before anything loads and does not travel as a placement
    expect(load[0][0].posGroups[0].placement).toBeUndefined();
    expect(load[0][2]).toEqual({ reason: 'adjusted' });
    // it is re-applied after the calculation as repositioningData of the first root
    expect(load[1][0].posGroups).toHaveLength(1);
    const reloaded = load[1][0].posGroups[0];
    expect(reloaded.id).toBe('g2');
    expect(reloaded.repositioningData).toEqual({
      posGroup: [4000, 0, -1900],
      posRotationY: 270,
      rootId: 'r2',
    });
    expect(reloaded.roots[0].articlePos).toBeUndefined();
    expect(load[1][2]).toEqual({ reason: 'adjusted' });
    expect(result).toMatchObject({
      placements: [{ groupId: 'g2', wall: 'right', placedBy: 'footprint' }],
    });
    expect((result as Record<string, any>).hint).toBeUndefined();
  });

  it('removes the created groups again when a placement meets an existing group', async () => {
    const existingGroup = makeGroup({
      id: 'g1',
      pos: [4000, 0, -1500],
      rotationY: 270,
    });
    const loadedGroup = makeGroup({
      id: 'g2',
      pos: undefined,
      roots: [makeRoot({ id: 'r2' })],
    });
    const api = {
      extended: {
        getExternalObjectPlanContext: vi.fn((sections: string[]) => {
          if (sections.includes('articles')) {
            return Promise.resolve({ articles: [articleFixture] });
          }
          if (sections.includes('rooms')) {
            return Promise.resolve({
              rooms: { rooms: [room] },
              groups: [existingGroup],
            });
          }
          return Promise.resolve({ groups: [existingGroup, loadedGroup] });
        }),
        loadExternalObjectGroupLayout: vi.fn(async () => [{ id: 'g2' }]),
        removeExternalObject: vi.fn(),
      },
    };
    await expect(
      toolExecutors['create-or-replace-groups'](api, {
        posGroups: [
          {
            placement: { wall: 'right' },
            roots: [{ id: 'u1', articleId: 'article-1' }],
          },
        ],
      }),
    ).rejects.toThrow(/Placement rejected.*group 'g1'/s);
    expect(api.extended.removeExternalObject).toHaveBeenCalledWith('g2');
    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledTimes(1);
  });
});

describe('place-group', () => {
  const createPlaceApi = (groups: any[], afterGroups: any[] = groups) => ({
    extended: {
      getExternalObjectPlanContext: vi.fn((sections: string[]) => {
        if (sections.includes('rooms')) {
          return Promise.resolve({ rooms: { rooms: [room] }, groups });
        }
        return Promise.resolve({ groups: afterGroups });
      }),
      loadExternalObjectGroupLayout: vi.fn(async () => [{ id: 'g1' }]),
      removeExternalObject: vi.fn(),
    },
  });

  it('rejects an unknown group id', async () => {
    const api = createPlaceApi([]);
    await expect(
      toolExecutors['place-group'](api, { groupId: 'nope', wall: 'right' }),
    ).rejects.toThrow(/Group 'nope' not found/);
  });

  it('accepts a unique id prefix', async () => {
    const group = makeGroup({ id: 'group-abc' });
    const api = createPlaceApi([group]);
    const result = await toolExecutors['place-group'](api, {
      groupId: 'group-a',
      wall: 'right',
    });
    expect((result as Record<string, any>).pos).toEqual([4000, 0, -1900]);
  });

  it('places the group against a wall and reloads it there', async () => {
    const group = makeGroup({ id: 'g1', pos: [0, 0, 0] });
    const movedGroup = makeGroup({
      id: 'g1',
      pos: [4000, 0, -3000],
      rotationY: 270,
    });
    const api = createPlaceApi([group], [movedGroup]);
    const result = (await toolExecutors['place-group'](api, {
      groupId: 'g1',
      wall: 'right',
      alignment: 'top',
    })) as Record<string, any>;
    expect(result.pos).toEqual([4000, 0, -3000]);
    expect(result.rotationY).toBe(270);
    expect(result.placedBy).toBe('footprint');
    expect(result.wall).toMatchObject({ side: 'right', facingRotationY: 270 });
    const load = api.extended.loadExternalObjectGroupLayout.mock
      .calls as any[][];
    expect(load[0][0].posGroups[0].repositioningData).toEqual({
      posGroup: [4000, 0, -3000],
      posRotationY: 270,
      rootId: 'r1',
    });
    expect(result.group.id).toBe('g1');
    expect(result.group.position.pos).toEqual([4000, 0, -3000]);
  });

  it('rejects a target that meets another group without moving it', async () => {
    const target = makeGroup({ id: 'g1', pos: [0, 0, 0] });
    const blocker = makeGroup({
      id: 'g2',
      pos: [4000, 0, -1900],
      rotationY: 270,
    });
    const api = createPlaceApi([target, blocker]);
    await expect(
      toolExecutors['place-group'](api, { groupId: 'g1', wall: 'right' }),
    ).rejects.toThrow(/Placement rejected - the group was not moved/);
    expect(api.extended.loadExternalObjectGroupLayout).not.toHaveBeenCalled();
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

