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

const FOOTPRINT = { x: [0, 800], z: [0, 600], widthMm: 800, depthMm: 600 };

// a group as the plan context returns it (shaped); the raw makeGroup is what
// getExternalObjectGroups returns
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
    getExternalObjectGroups: vi.fn(async () => []),
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
    const shapedExisting = makeShapedGroup({
      id: 'g1',
      position: { pos: [2000, 0, -3000] },
    });
    const shapedLoaded = makeShapedGroup({
      id: 'g2',
      position: { pos: undefined },
      roots: [makeShapedRoot({ id: 'r2' })],
    });
    const shapedPlaced = makeShapedGroup({
      id: 'g2',
      position: { pos: [4000, 0, -1900], rotationY: 270 },
      roots: [makeShapedRoot({ id: 'r2' })],
    });
    const rawExisting = makeGroup({ id: 'g1', pos: [2000, 0, -3000] });
    const rawLoaded = makeGroup({
      id: 'g2',
      pos: undefined,
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
              groups: [shapedExisting],
            });
          }
          groupsFetches += 1;
          return Promise.resolve({
            groups:
              groupsFetches === 1
                ? [shapedExisting, shapedLoaded]
                : [shapedExisting, shapedPlaced],
          });
        }),
        getExternalObjectGroups: vi.fn(async () => [
          rawExisting,
          rawLoaded,
        ]),
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
    const shapedExisting = makeShapedGroup({
      id: 'g1',
      position: { pos: [4000, 0, -1500], rotationY: 270 },
    });
    const shapedLoaded = makeShapedGroup({
      id: 'g2',
      position: { pos: undefined },
      roots: [makeShapedRoot({ id: 'r2' })],
    });
    const rawExisting = makeGroup({
      id: 'g1',
      pos: [4000, 0, -1500],
      rotationY: 270,
    });
    const rawLoaded = makeGroup({
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
              groups: [shapedExisting],
            });
          }
          return Promise.resolve({ groups: [shapedExisting, shapedLoaded] });
        }),
        getExternalObjectGroups: vi.fn(async () => [
          rawExisting,
          rawLoaded,
        ]),
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
  // shaped groups for the plan context, raw groups for the placement math
  const createPlaceApi = (
    shapedGroups: any[],
    rawGroups: any[],
    afterShapedGroups: any[] = shapedGroups,
  ) => ({
    extended: {
      getExternalObjectPlanContext: vi.fn((sections: string[]) => {
        if (sections.includes('rooms')) {
          return Promise.resolve({
            rooms: { rooms: [room] },
            groups: shapedGroups,
          });
        }
        return Promise.resolve({ groups: afterShapedGroups });
      }),
      getExternalObjectGroups: vi.fn(async () => rawGroups),
      loadExternalObjectGroupLayout: vi.fn(async () => [{ id: 'g1' }]),
      removeExternalObject: vi.fn(),
    },
  });

  it('rejects an unknown group id', async () => {
    const api = createPlaceApi([], []);
    await expect(
      toolExecutors['place-group'](api, { groupId: 'nope', wall: 'right' }),
    ).rejects.toThrow(/Group 'nope' not found/);
  });

  it('accepts a unique id prefix', async () => {
    const api = createPlaceApi(
      [makeShapedGroup({ id: 'group-abc' })],
      [makeGroup({ id: 'group-abc' })],
    );
    const result = await toolExecutors['place-group'](api, {
      groupId: 'group-a',
      wall: 'right',
    });
    expect((result as Record<string, any>).pos).toEqual([4000, 0, -1900]);
  });

  it('places the group against a wall and reloads it there', async () => {
    const movedShaped = makeShapedGroup({
      id: 'g1',
      position: { pos: [4000, 0, -3000], rotationY: 270 },
    });
    const api = createPlaceApi(
      [makeShapedGroup()],
      [makeGroup({ id: 'g1', pos: [0, 0, 0] })],
      [movedShaped],
    );
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
    const api = createPlaceApi(
      [
        makeShapedGroup({ id: 'g1' }),
        makeShapedGroup({
          id: 'g2',
          position: { pos: [4000, 0, -1900], rotationY: 270 },
        }),
      ],
      [
        makeGroup({ id: 'g1', pos: [0, 0, 0] }),
        makeGroup({ id: 'g2', pos: [4000, 0, -1900], rotationY: 270 }),
      ],
    );
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

