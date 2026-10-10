import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { planHistory } from '../plan-history';
import {
  forgetAgentGroupIds,
  forgetAnchorFrames,
  forgetMasterData,
  toolExecutors,
} from '../tool-executors';

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

// the room as get-plan-context returns it: the walls named, the corners listed
const WALL_NAMES: Record<string, string> = {
  top: 'back wall',
  bottom: 'front wall',
  left: 'left wall',
  right: 'right wall',
};
const namedRoom = {
  ...room,
  walls: room.walls.map((wall) => ({ ...wall, name: WALL_NAMES[wall.side] })),
  corners: [
    { name: 'front right', point: [4000, 0, 0], posRotationY: 180 },
    { name: 'back right', point: [4000, 0, -3000], posRotationY: 270 },
    { name: 'back left', point: [0, 0, -3000], posRotationY: 0 },
    { name: 'front left', point: [0, 0, 0], posRotationY: 90 },
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
      // a generated root module: no catalog article has it
      {
        id: 'mr_Countertop',
        name: 'Worktop',
        desc: 'The generated worktop',
        attributes: ['countertop'],
      },
    ],
    // the attributes as the compacted master data returns them
    attributes: [
      {
        id: 'countertop',
        name: 'Worktop colour',
        desc: 'the colour of the worktop',
        type: 'Simple',
        group: 'worktop',
        selections: [],
      },
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

// The front attributes of Furniture_Smith: a colour the program does not offer
// switches the program, a program resets a colour it does not offer.
const frontAttributes = [
  {
    id: 'mod_FrontProgram',
    name: 'Front program',
    desc: 'Program of the front',
    type: 'Text',
    group: 'Front | Design',
    selections: [
      {
        value: 'Classic',
        desc: 'Simple fronts in plain decors',
        name: 'Classic',
      },
      {
        value: 'Modern',
        desc: 'Mitred frame fronts with glass filling',
        name: 'Modern',
      },
    ],
  },
  {
    id: 'mod_FrontColor',
    name: 'Front color',
    desc: 'Color of the front',
    type: 'Text',
    group: 'Front | Design',
    selections: [
      { value: '324', desc: 'Dark marble (#404040)', name: 'Dark marble' },
      { value: '152', desc: 'Cloudy blue (#506080)', name: 'Cloudy blue' },
    ],
  },
];

const frontMasterData = {
  'lib-1': {
    ...masterDataFixture['lib-1'],
    attributes: [...masterDataFixture['lib-1'].attributes, ...frontAttributes],
  },
};

// A wall unit with its input attributes.
const wallUnit = (id: string, attributes: Record<string, string>) =>
  makeShapedRoot({
    id,
    articleId: 'OTB60',
    attributes: Object.entries(attributes).map(([attributeId, value]) => ({
      id: attributeId,
      value,
    })),
  });

const articleFixture = {
  articleId: 'article-1',
  articleName: 'Tall unit',
  desc: 'A tall unit',
  imageUrl: 'https://example.com/a1.png',
  category: 'storage',
  libraryId: 'lib-1',
  catalog: {},
  rootModules: [{ module: { id: 'module-1' } }],
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
      undo: vi.fn(async () => undefined),
      redo: vi.fn(async () => undefined),
      ...overrides,
    },
  };
};

// every test learns its anchor frames and reads its master data itself
beforeEach(() => {
  forgetAnchorFrames();
  forgetMasterData();
  forgetAgentGroupIds();
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
      'obstacles',
    ]);
    // a planner without the obstacles section (an older roomle-ui) returns
    // none, and the context is the same
    // the plan context arrives agent-ready from the planner API; the server
    // completes the articles' cornerArticle flag, names the walls and lists
    // the room corners
    expect(result).toEqual({
      ...planContextFixture,
      rooms: { rooms: [namedRoom] },
      articles: [{ ...articleFixture, cornerArticle: false }],
    });
  });

  // r1, r2 and r3 stand in a row, n was inserted between r1 and r2 and is
  // listed last; w1 hangs above r1
  const side = (id: string, vector: string, partner: string) => ({
    dockedRoots: [
      {
        ownDockingVector: vector,
        dockedRoots: [
          {
            id: partner,
            dockingVector:
              vector === 'RightBottom' ? 'LeftBottom' : 'RightBottom',
          },
        ],
      },
    ],
  });
  const rowAfterInsert = makeShapedGroup({
    roots: [
      makeShapedRoot({
        id: 'r1',
        contextData: {
          dockedRoots: [
            ...side('r1', 'RightBottom', 'n').dockedRoots,
            {
              ownDockingVector: 'LeftTop',
              dockedRoots: [{ id: 'w1', dockingVector: 'LeftBottom' }],
            },
          ],
        },
      }),
      makeShapedRoot({
        id: 'r2',
        contextData: side('r2', 'RightBottom', 'r3'),
      }),
      makeShapedRoot({ id: 'r3' }),
      makeShapedRoot({ id: 'n', contextData: side('n', 'RightBottom', 'r2') }),
      makeShapedRoot({ id: 'w1' }),
    ],
  });

  it('gives every root module of a row its place in the row, counted from the left end', async () => {
    const api = createApi({ ...planContextFixture, groups: [rowAfterInsert] });
    const result: any = await toolExecutors['get-plan-context'](api, {});
    const rowIndexOf = (id: string) =>
      result.groups[0].roots.find((root: any) => root.id === id).rowIndex;
    expect(['r1', 'n', 'r2', 'r3'].map(rowIndexOf)).toEqual([1, 2, 3, 4]);
    // a unit beside no other one has no place in a row
    expect(rowIndexOf('w1')).toBeUndefined();
  });

  it('reads the row from the docking written on either root', async () => {
    // the planner completes the reciprocal entries; here only the left
    // neighbour of each pair names the other
    const mirrored = makeShapedGroup({
      roots: [
        makeShapedRoot({ id: 'b', contextData: side('b', 'LeftBottom', 'a') }),
        makeShapedRoot({ id: 'a' }),
        makeShapedRoot({ id: 'c', contextData: side('c', 'LeftBottom', 'b') }),
      ],
    });
    const api = createApi({ ...planContextFixture, groups: [mirrored] });
    const result: any = await toolExecutors['get-plan-context'](api, {});
    expect(
      result.groups[0].roots.map((root: any) => [root.id, root.rowIndex])
    ).toEqual([
      ['b', 2],
      ['a', 1],
      ['c', 3],
    ]);
  });

  it('names the walls, marks the openings and lists the room corners', async () => {
    // issues 12 and 30: the right wall of the default room is a stub, the
    // door opening and the long wall
    const splitRight = [
      {
        index: 1,
        side: 'right',
        start: [4000, 0, 0],
        end: [4000, 0, -100],
        lengthMm: 100,
        type: 'wall',
        facingRotationY: 270,
      },
      {
        index: 2,
        side: 'right',
        start: [4000, 0, -100],
        end: [4000, 0, -1000],
        lengthMm: 900,
        type: null,
        facingRotationY: 270,
      },
      {
        index: 3,
        side: 'right',
        start: [4000, 0, -1000],
        end: [4000, 0, -3000],
        lengthMm: 2000,
        type: 'wall',
        facingRotationY: 270,
      },
    ];
    const walls = [
      room.walls[0],
      ...splitRight,
      { ...room.walls[2], index: 4 },
      { ...room.walls[3], index: 5 },
    ];
    const api = createApi({ rooms: { rooms: [{ ...room, walls }] } });
    const result = (await toolExecutors['get-plan-context'](api, {
      include: ['rooms'],
    })) as Record<string, any>;
    const [shaped] = result.rooms.rooms;
    expect(shaped.walls.map((wall: any) => [wall.name, wall.type])).toEqual([
      ['front wall', 'wall'],
      ['right wall', 'wall'],
      ['right wall', 'opening'],
      ['right wall', 'wall'],
      ['back wall', 'wall'],
      ['left wall', 'wall'],
    ]);
    expect(shaped.corners).toEqual([
      { name: 'front right', point: [4000, 0, 0], posRotationY: 180 },
      { name: 'back right', point: [4000, 0, -3000], posRotationY: 270 },
      { name: 'back left', point: [0, 0, -3000], posRotationY: 0 },
      { name: 'front left', point: [0, 0, 0], posRotationY: 90 },
    ]);
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
      'obstacles',
    ]);
  });

  // the obstacles as roomle-ui returns them: a window behind the back wall, a
  // door behind the right wall, a chair and the root outlines of a group
  const obstaclesFixture = {
    objects: [
      {
        kind: 'window',
        outline: [
          [2000, 0, -3120],
          [1000, 0, -3120],
          [1000, 0, -3000],
          [2000, 0, -3000],
        ],
        bottomMm: 950,
        topMm: 2170,
      },
      {
        kind: 'door',
        outline: [
          [4100, 0, -1000],
          [4100, 0, -100],
          [4000, 0, -100],
          [4000, 0, -1000],
        ],
        bottomMm: 0,
        topMm: 2100,
      },
      {
        kind: 'object',
        outline: [
          [1500, 0, -1500],
          [2000, 0, -1500],
          [2000, 0, -1000],
          [1500, 0, -1000],
        ],
        bottomMm: 0,
        topMm: 790,
      },
    ],
    groups: [
      {
        id: 'g1',
        roots: [
          {
            id: 'r1',
            outline: [
              [0, 0, 0],
              [800, 0, 0],
              [800, 0, -600],
              [0, 0, -600],
            ],
            bottomMm: 0,
            topMm: 720,
          },
        ],
      },
    ],
  };

  it('names the wall every door and window of the obstacles lies in', async () => {
    const api = createApi({
      rooms: { rooms: [room] },
      obstacles: obstaclesFixture,
    });
    const result = (await toolExecutors['get-plan-context'](api, {
      include: ['rooms', 'obstacles'],
    })) as Record<string, any>;
    expect(api.extended.getExternalObjectPlanContext).toHaveBeenCalledWith([
      'rooms',
      'obstacles',
    ]);
    const [window, door, chair] = obstaclesFixture.objects;
    expect(result.obstacles).toEqual({
      objects: [
        { ...window, roomIndex: 0, wall: 2, fromEndMm: [1000, 2000] },
        { ...door, roomIndex: 0, wall: 1, fromEndMm: [2000, 2900] },
        chair,
      ],
      groups: obstaclesFixture.groups,
    });
    expect(result.rooms.rooms[0].walls[2].name).toBe('back wall');
  });

  it('fetches the rooms for the obstacles alone and returns only the obstacles', async () => {
    const api = createApi({
      rooms: { rooms: [room] },
      obstacles: obstaclesFixture,
    });
    const result = (await toolExecutors['get-plan-context'](api, {
      include: ['obstacles'],
    })) as Record<string, any>;
    expect(api.extended.getExternalObjectPlanContext).toHaveBeenCalledWith([
      'obstacles',
      'rooms',
    ]);
    expect(Object.keys(result)).toEqual(['obstacles']);
    expect(result.obstacles.objects[0].wall).toBe(2);
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

  describe('article descriptions', () => {
    // a description as Furniture_Smith writes them, in nine sections
    const sectioned =
      'FUNCTION:\nLiving-room sideboard, 60 cm wide, with 1 door and 1 drawer.\n\n' +
      'PURPOSE:\nCombines a drawer for small items with a door compartment.\n\n' +
      'RESTRICTIONS:\nNot a kitchen or wet-area unit.\n\n' +
      'AI_SELECTION_HINT:\nSelect for mixed drawer and door storage in a living room.';
    const sideboard = {
      ...articleFixture,
      articleId: 'SB_UB600S',
      desc: sectioned,
    };

    it('shortens an article description to its function and selection hint', async () => {
      const api = createApi({ articles: [sideboard] });
      const result = (await toolExecutors['get-plan-context'](api, {
        include: ['articles'],
      })) as Record<string, any>;
      expect(result.articles[0].desc).toBe(
        'Living-room sideboard, 60 cm wide, with 1 door and 1 drawer. ' +
          'Select for mixed drawer and door storage in a living room.'
      );
      expect(result.articleDescriptions).toBeUndefined();
    });

    it('keeps an article description without these sections as it is', async () => {
      const api = createApi({ articles: [articleFixture] });
      const result = (await toolExecutors['get-plan-context'](api, {
        include: ['articles'],
      })) as Record<string, any>;
      expect(result.articles[0].desc).toBe('A tall unit');
    });

    it('returns the full article descriptions only in the articleDescriptions section', async () => {
      const api = createApi({ articles: [sideboard, articleFixture] });
      const result = (await toolExecutors['get-plan-context'](api, {
        include: ['articleDescriptions'],
      })) as Record<string, any>;
      expect(api.extended.getExternalObjectPlanContext).toHaveBeenCalledWith([
        'articles',
      ]);
      expect(result.articleDescriptions).toEqual([
        { articleId: 'SB_UB600S', desc: sectioned },
        { articleId: 'article-1', desc: 'A tall unit' },
      ]);
      expect(result.articles).toBeUndefined();

      const both = (await toolExecutors['get-plan-context'](api, {
        include: ['articles', 'articleDescriptions'],
      })) as Record<string, any>;
      expect(both.articles[0].desc).not.toBe(sectioned);
      expect(both.articleDescriptions[0].desc).toBe(sectioned);
    });
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
      'groups',
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
          rootModules: [{ id: 'module-1', name: 'Tall module' }],
        },
      ],
      total: 1,
    });
  });

  // Furniture_Smith: the panel top's colour is listed before the worktop's in
  // the master data, and both are named Color
  const topsMasterData = {
    'lib-1': {
      libraryId: 'lib-1',
      modules: [
        {
          id: 'mr_Paneltop',
          name: 'Top panel',
          attributes: ['mod_PaneltopColor'],
        },
        {
          id: 'mr_Countertop',
          name: 'Countertop',
          attributes: ['mod_CountertopColor'],
        },
      ],
      attributes: [
        {
          id: 'mod_PaneltopColor',
          name: 'Color',
          desc: 'Color of the panel top',
          group: 'Paneltop',
          selections: [{ value: '316', name: 'Dark marble' }],
        },
        {
          id: 'mod_CountertopColor',
          name: 'Countertop color',
          desc: 'Color of the countertop',
          group: 'Countertop | Design',
          selections: [{ value: '316', name: 'Dark marble' }],
        },
      ],
    },
  };
  const worktop = {
    id: 'w',
    articleId: 'mr_Countertop',
    isGenerated: true,
    attributes: [{ id: 'mod_CountertopColor', value: '215' }],
  };

  it('lists the attributes the root modules in the plan carry first, and names the root modules', async () => {
    const api = createApi({
      masterData: topsMasterData,
      groups: [makeShapedGroup({ roots: [makeShapedRoot(), worktop] })],
    });
    const result: any = await toolExecutors['find-attributes'](api, {
      text: 'marble',
    });
    expect(result.matches.map((match: any) => match.id)).toEqual([
      'mod_CountertopColor',
      'mod_PaneltopColor',
    ]);
    expect(result.matches[0].rootModules).toEqual([
      { id: 'mr_Countertop', name: 'Countertop' },
    ]);
    expect(result.matches[1].rootModules).toEqual([
      { id: 'mr_Paneltop', name: 'Top panel' },
    ]);
  });

  it('finds the worktop colour first for "worktop colour"', async () => {
    const api = createApi({ masterData: topsMasterData, groups: [] });
    const result: any = await toolExecutors['find-attributes'](api, {
      text: 'worktop colour',
    });
    expect(result.matches[0].id).toBe('mod_CountertopColor');
  });

  it('keeps the master data order on a plan without groups', async () => {
    const api = createApi({ masterData: topsMasterData, groups: [] });
    const result: any = await toolExecutors['find-attributes'](api, {
      text: 'marble',
    });
    expect(result.matches.map((match: any) => match.id)).toEqual([
      'mod_PaneltopColor',
      'mod_CountertopColor',
    ]);
  });

  describe('words', () => {
    // colour attributes spelled as Furniture_Smith spells them, two of them
    // with the same values
    const palette = [
      { value: '190', name: 'Sunny white', desc: 'Sunny white (#F0F0E0)' },
      { value: '240', name: 'Ash grey', desc: 'Ash grey (#303030)' },
    ];
    const colourApi = () =>
      createApi({
        masterData: {
          'lib-1': {
            libraryId: 'lib-1',
            modules: [],
            attributes: [
              {
                id: 'mod_FrontColor',
                name: 'Front color',
                group: 'Front | Design',
                selections: palette,
              },
              {
                id: 'mod_CountertopColor',
                name: 'Countertop color',
                group: 'Countertop | Design',
                selections: palette,
              },
              {
                id: 'mod_HandleDesign',
                name: 'Handle design',
                group: 'FrontOpening | Handle',
                selections: [
                  { value: '20', name: 'Rail', desc: 'Rail handle' },
                ],
              },
            ],
          },
        },
      });
    const idsFound = async (text: string) =>
      (
        (await toolExecutors['find-attributes'](colourApi(), {
          text,
        })) as Record<string, any>
      ).matches.map((match: any) => match.id);

    it('matches every word of the text on its own, in any order', async () => {
      expect(await idsFound('front color')).toEqual(['mod_FrontColor']);
      expect(await idsFound('color front')).toEqual(['mod_FrontColor']);
      expect(await idsFound('design handle')).toEqual(['mod_HandleDesign']);
      expect(await idsFound('front walnut')).toEqual([]);
    });

    it('reads colour as color, grey as gray and worktop as countertop', async () => {
      expect(await idsFound('front colour')).toEqual(['mod_FrontColor']);
      expect(await idsFound('worktop colour')).toEqual(['mod_CountertopColor']);
      expect(await idsFound('ash gray')).toEqual([
        'mod_FrontColor',
        'mod_CountertopColor',
      ]);
    });

    it('lists a value list several attributes share once', async () => {
      const result = (await toolExecutors['find-attributes'](colourApi(), {
        text: 'colour',
      })) as Record<string, any>;
      expect(result.matches[0].selections).toEqual(palette);
      expect(result.matches[1]).toEqual({
        libraryId: 'lib-1',
        id: 'mod_CountertopColor',
        name: 'Countertop color',
        group: 'Countertop | Design',
        sameSelectionsAs: 'mod_FrontColor',
        rootModules: [],
      });
      expect(result.total).toBe(2);
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

  it('reads dockTo on a root as its relation', async () => {
    // issue 25: dockTo is the docking field of merge-article-into-group
    const { loadedGroup, result } = await loadedWith([
      {
        roots: [
          { id: 'cab1', articleId: 'article-1' },
          {
            id: 'cab2',
            articleId: 'article-1',
            dockTo: {
              rootId: 'cab1',
              ownDockingVector: 'RightBottom',
              dockingVector: 'LeftBottom',
            },
          },
          {
            id: 'top',
            articleId: 'article-1',
            dockTo: { rootId: 'cab2', ownDockingVector: 'LeftTop' },
          },
          // gpt-5.4-mini of 2026-10-04: the relation named inside dockTo
          {
            id: 'cab3',
            articleId: 'article-1',
            dockTo: { id: 'top', relation: 'rightOf' },
          },
        ],
      },
    ]);
    expect(loadedGroup.roots[0].contextData).toEqual({
      dockedRoots: [
        {
          ownDockingVector: 'RightBottom',
          dockedRoots: [entry('cab2', 'LeftBottom')],
        },
      ],
    });
    expect(loadedGroup.roots[2].contextData).toEqual({
      dockedRoots: [
        {
          ownDockingVector: 'RightBottom',
          dockedRoots: [entry('cab3', 'LeftBottom')],
        },
      ],
    });
    expect(JSON.stringify(loadedGroup)).not.toContain('dockTo');
    expect(result.corrections).toEqual([
      "posGroups[0] root 'cab2': dockTo was read as rightOf 'cab1'",
      "posGroups[0] root 'top': dockTo could not be read as a relation - ignored; name the neighbour with rightOf, leftOf, onTop, above or behind",
      "posGroups[0] root 'cab3': dockTo was read as rightOf 'top'",
      "posGroups[0]: root 'top' names no neighbour - it was put rightOf 'cab2'",
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

  const withHeight = (article: any, height: number) => ({
    ...article,
    rootModules: [
      {
        module: { id: `${article.articleId}-module` },
        dimensions: [{ id: 'mod_Height', name: 'Height', value: height }],
      },
    ],
  });

  it('hangs undocked wall units above a placed floor unit when the group has no wall unit yet', async () => {
    const base = withHeight(articleFixture, 720);
    const wallUnit = withHeight(
      {
        ...articleFixture,
        articleId: 'wall-1',
        category: 'Kitchen | Wall Units | Storage',
      },
      720
    );
    const tall = withHeight(
      {
        ...articleFixture,
        articleId: 'tall-1',
        category: 'Kitchen | Tall Units',
      },
      2100
    );
    const { loadedGroup, result } = await loadedWith(
      [
        {
          roots: [
            { id: 'u1', articleId: 'article-1' },
            { id: 'u2', articleId: 'article-1' },
            { id: 'w1', articleId: 'wall-1' },
            { id: 'w2', articleId: 'wall-1' },
          ],
        },
      ],
      { ...planContextFixture, articles: [base, wallUnit, tall] }
    );
    const docking = Object.fromEntries(
      loadedGroup.roots.map((root: any) => [root.id, root.contextData])
    );
    expect(docking.u1.dockedRoots).toEqual([
      {
        ownDockingVector: 'RightBottom',
        dockedRoots: [entry('u2', 'LeftBottom')],
      },
      {
        ownDockingVector: 'LeftTop',
        dockedRoots: [{ ...entry('w1', 'LeftBottom'), offset: [0, 660, 0] }],
      },
    ]);
    expect(docking.w1.dockedRoots).toEqual([
      {
        ownDockingVector: 'RightBottom',
        dockedRoots: [entry('w2', 'LeftBottom')],
      },
    ]);
    expect(result.corrections).toEqual([
      expect.stringContaining("'u2' was docked to the RightBottom of 'u1'"),
      "posGroups[0]: roots 'w1' were not docked to the placed roots - the wall unit 'w1' was docked above 'u1' " +
        "(its LeftBottom on the LeftTop of 'u1'), 660 mm above it at the height of the wall units",
      expect.stringContaining("'w2' was docked to the RightBottom of 'w1'"),
    ]);
    expect(result.notLoaded).toBeUndefined();
  });

  it('docks a part with floor units by a floor unit, and its wall unit stays on its carrier', async () => {
    const wallUnit = {
      ...articleFixture,
      articleId: 'wall-1',
      category: 'Kitchen | Wall Units | Storage',
    };
    const { loadedGroup, result } = await loadedWith(
      [
        {
          roots: [
            { id: 'r0', articleId: 'article-1' },
            // the first root of the part: a wall unit with a free LeftBottom
            { id: 'w', articleId: 'wall-1' },
            {
              id: 'b1',
              articleId: 'article-1',
              contextData: {
                dockedRoots: [
                  {
                    ownDockingVector: 'LeftTop',
                    dockedRoots: [
                      {
                        id: 'w',
                        dockingVector: 'LeftBottom',
                        offset: [0, 660, 0],
                      },
                    ],
                  },
                  {
                    ownDockingVector: 'RightBottom',
                    dockedRoots: [{ id: 'b2', dockingVector: 'LeftBottom' }],
                  },
                ],
              },
            },
            { id: 'b2', articleId: 'article-1' },
          ],
        },
      ],
      catalogWith(wallUnit)
    );
    const docking = Object.fromEntries(
      loadedGroup.roots.map((root: any) => [root.id, root.contextData])
    );
    expect(docking.r0).toEqual({
      dockedRoots: [
        {
          ownDockingVector: 'RightBottom',
          dockedRoots: [entry('b1', 'LeftBottom')],
        },
      ],
    });
    expect(docking.w).toBeUndefined();
    expect(result.corrections).toEqual([
      "posGroups[0]: roots 'w', 'b1', 'b2' were not docked to the placed roots - 'b1' was docked to the " +
        "RightBottom of 'r0', the free end of that row (mode StartStart, offset [0, 0, 0])",
    ]);
  });

  const sideEntry = (vector: string, id: string, dockingVector: string) => ({
    ownDockingVector: vector,
    dockedRoots: [{ id, dockingVector }],
  });

  it('drops the entry that closes a row into a ring, so the group is anchored as the planner places it', async () => {
    // cab1 -> cab2 -> cab3 -> cab4 along RightBottom, and cab4 on cab1's
    // LeftBottom: from cab1 the planner reaches cab2 and cab4 first, so cab3's
    // entry to cab4 is the one it never uses
    const { loadedGroup, result } = await loadedWith([
      {
        placement: { posGroup: [0, 0, 0], posRotationY: 0 },
        roots: [
          {
            id: 'cab1',
            articleId: 'article-1',
            contextData: {
              dockedRoots: [
                sideEntry('RightBottom', 'cab2', 'LeftBottom'),
                sideEntry('LeftBottom', 'cab4', 'RightBottom'),
              ],
            },
          },
          {
            id: 'cab2',
            articleId: 'article-1',
            contextData: {
              dockedRoots: [sideEntry('RightBottom', 'cab3', 'LeftBottom')],
            },
          },
          {
            id: 'cab3',
            articleId: 'article-1',
            contextData: {
              dockedRoots: [sideEntry('RightBottom', 'cab4', 'LeftBottom')],
            },
          },
          { id: 'cab4', articleId: 'article-1' },
        ],
      },
    ]);
    expect(loadedGroup.roots[2].contextData).toEqual({ dockedRoots: [] });
    // the left end of the row cab4, cab1, cab2, cab3
    expect(loadedGroup.repositioningData.rootId).toBe('cab4');
    expect(result.corrections).toEqual([
      "posGroups[0]: the docking of 'cab4' on the RightBottom of 'cab3' closes the row into a ring - dropped; " +
        "the planner places 'cab4' by its other docking, and a row has two ends",
    ]);
  });

  it('reads the reciprocal entries of a group from get-plan-context as one link, not as a ring', async () => {
    const { loadedGroup, result } = await loadedWith([
      {
        roots: [
          {
            id: 'u1',
            articleId: 'article-1',
            contextData: {
              dockedRoots: [sideEntry('RightBottom', 'u2', 'LeftBottom')],
            },
          },
          {
            id: 'u2',
            articleId: 'article-1',
            contextData: {
              dockedRoots: [
                sideEntry('LeftBottom', 'u1', 'RightBottom'),
                sideEntry('RightBottom', 'u3', 'LeftBottom'),
              ],
            },
          },
          {
            id: 'u3',
            articleId: 'article-1',
            contextData: {
              dockedRoots: [sideEntry('LeftBottom', 'u2', 'RightBottom')],
            },
          },
        ],
      },
    ]);
    expect(loadedGroup.roots[2].contextData).toEqual({
      dockedRoots: [sideEntry('LeftBottom', 'u2', 'RightBottom')],
    });
    expect(result.corrections).toBeUndefined();
  });

  it('keeps wall units docked to each other and to their floor units', async () => {
    const wallUnit = {
      ...articleFixture,
      articleId: 'wall-1',
      category: 'Kitchen | Wall Units | Storage',
    };
    const hung = (id: string) => ({
      ownDockingVector: 'LeftTop',
      dockedRoots: [{ id, dockingVector: 'LeftBottom', offset: [0, 660, 0] }],
    });
    const { result } = await loadedWith(
      [
        {
          roots: [
            {
              id: 'b1',
              articleId: 'article-1',
              contextData: {
                dockedRoots: [
                  sideEntry('RightBottom', 'b2', 'LeftBottom'),
                  hung('w1'),
                ],
              },
            },
            {
              id: 'b2',
              articleId: 'article-1',
              contextData: { dockedRoots: [hung('w2')] },
            },
            {
              id: 'w1',
              articleId: 'wall-1',
              contextData: {
                dockedRoots: [sideEntry('RightBottom', 'w2', 'LeftBottom')],
              },
            },
            { id: 'w2', articleId: 'wall-1' },
          ],
        },
      ],
      catalogWith(wallUnit)
    );
    expect(result.corrections).toBeUndefined();
  });

  const cornerArticle = {
    ...articleFixture,
    articleId: 'corner-1',
    category: 'Kitchen | Base Units | Corner',
    rootModules: [
      {
        module: { id: 'mr_CornerunitStraight' },
        dockingVectors: [
          'LeftBackBottom',
          'RightBackBottom',
          'LeftBottom',
          'RightBottom',
        ],
      },
    ],
  };

  it('drops docking to a vector the article does not have and docks the root like an undocked root', async () => {
    // a corner article has no back
    const { loadedGroup, result } = await loadedWith(
      [
        {
          roots: [
            {
              id: 'c1',
              articleId: 'corner-1',
              contextData: {
                dockedRoots: [
                  sideEntry('RightBottom', 'r1', 'LeftBottom'),
                  sideEntry('BackBottom', 'sink', 'BackBottom'),
                ],
              },
            },
            { id: 'r1', articleId: 'article-1' },
            { id: 'sink', articleId: 'article-1' },
          ],
        },
      ],
      catalogWith(cornerArticle)
    );
    expect(loadedGroup.roots[0].contextData).toEqual({
      dockedRoots: [sideEntry('RightBottom', 'r1', 'LeftBottom')],
    });
    expect(loadedGroup.roots[1].contextData).toEqual({
      dockedRoots: [
        {
          ownDockingVector: 'RightBottom',
          dockedRoots: [entry('sink', 'LeftBottom')],
        },
      ],
    });
    expect(result.corrections).toEqual([
      "posGroups[0]: docking to a vector the article does not have was dropped - 'sink' on the BackBottom of 'c1' - " +
        "'corner-1' has no BackBottom; the root is docked like an undocked root",
      expect.stringContaining("'sink' was docked to the RightBottom of 'r1'"),
    ]);
  });

  it('meets a vector with its partner when the article does not have the one named', async () => {
    const { loadedGroup, result } = await loadedWith(
      [
        {
          roots: [
            {
              id: 'u1',
              articleId: 'article-1',
              contextData: {
                dockedRoots: [sideEntry('LeftBottom', 'c1', 'LeftTop')],
              },
            },
            { id: 'c1', articleId: 'corner-1' },
          ],
        },
      ],
      catalogWith(cornerArticle)
    );
    expect(loadedGroup.roots[0].contextData).toEqual({
      dockedRoots: [sideEntry('LeftBottom', 'c1', 'RightBottom')],
    });
    expect(result.corrections).toEqual([
      "posGroups[0]: docking vectors the article does not have were replaced - 'c1' meets the LeftBottom of 'u1' " +
        "with its RightBottom - 'corner-1' has no LeftTop",
    ]);
  });

  it('puts a floor unit docked on a base unit into the floor row, and keeps a wall unit above it', async () => {
    const baseUnit = {
      ...articleFixture,
      articleId: 'base-1',
      category: 'Kitchen | Base Units | Storage',
    };
    const wallUnit = {
      ...articleFixture,
      articleId: 'wall-1',
      category: 'Kitchen | Wall Units | Storage',
    };
    const { loadedGroup, result } = await loadedWith(
      [
        {
          roots: [
            {
              id: 'b1',
              articleId: 'base-1',
              contextData: {
                dockedRoots: [
                  {
                    ownDockingVector: 'LeftTop',
                    dockedRoots: [
                      {
                        id: 'sink',
                        dockingVector: 'LeftBottom',
                        offset: [0, 660, 0],
                      },
                    ],
                  },
                  {
                    ownDockingVector: 'RightTop',
                    dockedRoots: [
                      {
                        id: 'w1',
                        dockingVector: 'RightBottom',
                        offset: [0, 660, 0],
                      },
                    ],
                  },
                ],
              },
            },
            { id: 'sink', articleId: 'base-1' },
            { id: 'w1', articleId: 'wall-1' },
          ],
        },
      ],
      catalogWith(baseUnit, wallUnit)
    );
    expect(loadedGroup.roots[0].contextData.dockedRoots).toEqual([
      {
        ownDockingVector: 'RightTop',
        dockedRoots: [
          { id: 'w1', dockingVector: 'RightBottom', offset: [0, 660, 0] },
        ],
      },
      {
        ownDockingVector: 'RightBottom',
        dockedRoots: [entry('sink', 'LeftBottom')],
      },
    ]);
    expect(result.corrections).toEqual([
      "posGroups[0]: floor unit 'sink' was docked on the LeftTop of the base unit 'b1' - nothing stands on a base " +
        'unit, so the docking was dropped and the unit continues the floor row',
      expect.stringContaining("'sink' was docked to the RightBottom of 'b1'"),
    ]);
  });

  it('reports a root it cannot dock and loads the other groups', async () => {
    const wallUnit = {
      ...articleFixture,
      articleId: 'wall-1',
      category: 'Kitchen | Wall Units | Storage',
    };
    const tall = {
      ...articleFixture,
      articleId: 'tall-1',
      category: 'Kitchen | Tall Units',
    };
    const api = createApi(catalogWith(wallUnit, tall));
    const result = (await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        {
          // nothing hangs above a tall unit
          roots: [
            { id: 't1', articleId: 'tall-1' },
            { id: 'w1', articleId: 'wall-1' },
          ],
        },
        { roots: [pick()] },
      ],
    })) as Record<string, any>;
    expect(result.notLoaded.map((entry: any) => entry.index)).toEqual([0]);
    expect(result.notLoaded[0].errors).toEqual([
      expect.stringMatching(
        /^posGroups\[0\]: roots 'w1' are not docked to a placed root \('t1' is placed/
      ),
    ]);
    expect(result.notLoaded[0].errors[0]).toContain(
      '{ "id": "B", "articleId": "...", "rightOf": "A" }'
    );
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
      'posGroups[0]: the placement takes wall, alignment, offsetMm and roomIndex, or posGroup, posRotationY and rootId - scale dropped',
    ]);

    // a placement by wall: loaded without a position, placed after the load -
    // this planner builds no new group, so none can be placed
    ({ loadedGroup, result } = await placed({
      wall: 'right',
      alignment: 'top',
    }));
    expect(loadedGroup).toEqual({ roots: [pick()] });
    expect(result.corrections).toEqual([
      expect.stringMatching(
        /^posGroups\[0\]: the planner built 0 new groups for the 1 of the call/
      ),
    ]);
  });

  it('uses no placement on a group that is already in the plan, which keeps its position', async () => {
    for (const placement of [
      { posGroup: [0, 0, 0], posRotationY: 0 },
      { wall: 'right', alignment: 'back' },
    ]) {
      const { api, loadedGroup, result } = await loadedWith([
        { ...makeShapedGroup(), placement },
      ]);
      expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledTimes(
        1
      );
      expect(loadedGroup).not.toHaveProperty('repositioningData');
      expect(loadedGroup.id).toBe('g1');
      expect(result.corrections).toEqual([
        "posGroups[0]: group 'g1' is already in the plan - its placement was not used and the group keeps its position; place-group moves it",
      ]);
    }
  });

  it('loads a group without the root whose article the catalog does not have and names it', async () => {
    // issue 26: one unknown article no longer rejects the whole group
    const { loadedGroup, result } = await loadedWith([
      {
        roots: [
          { id: 'u1', articleId: 'article-1' },
          { id: 'u2', articleId: 'nope', rightOf: 'u1' },
          { id: 'u3', articleId: 'article-1', rightOf: 'u2' },
        ],
      },
    ]);
    expect(loadedGroup.roots.map((root: any) => root.id)).toEqual(['u1', 'u3']);
    expect(result.notLoaded).toEqual([
      {
        index: 0,
        rootIds: ['u2'],
        errors: [
          expect.stringMatching(
            /^posGroups\[0\] root 'u2': articleId 'nope' is not in the article catalog\. Valid article ids: article-1 - the root was not built, the other roots were; send it with merge-article-into-group or a valid article id$/
          ),
        ],
      },
    ]);
    // u3 named the dropped root, so it continues the row after u1
    expect(result.corrections).toHaveLength(1);
    expect(result.corrections[0]).toMatch(
      /'u3' was docked to the RightBottom of 'u1', the free end of that row/
    );
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

  it('does not walk through a second corner article when both ends of a leg are corners', async () => {
    // review of PR 62: a U-shaped kitchen - the leg c1 -> b1 -> c2 is full,
    // and the other leg of c1 ends at the corner article c3 as well
    const cornerArticle = {
      ...articleFixture,
      articleId: 'corner-1',
      cornerArticle: true,
    };
    const corner = (id: string, contexts: unknown[]) => ({
      id,
      articleId: 'corner-1',
      contextData: { dockedRoots: contexts },
    });
    const api = createApi({
      ...planContextFixture,
      articles: [articleFixture, cornerArticle],
    });
    await expect(
      toolExecutors['create-or-replace-groups'](api, {
        posGroups: [
          {
            roots: [
              corner('c1', [
                {
                  ownDockingVector: 'RightBottom',
                  dockedRoots: [
                    entry('b1', 'LeftBottom'),
                    entry('x', 'LeftBottom'),
                  ],
                },
                {
                  ownDockingVector: 'LeftBottom',
                  dockedRoots: [entry('l1', 'RightBottom')],
                },
              ]),
              {
                id: 'b1',
                articleId: 'article-1',
                contextData: {
                  dockedRoots: [
                    {
                      ownDockingVector: 'RightBottom',
                      dockedRoots: [entry('c2', 'LeftBottom')],
                    },
                  ],
                },
              },
              corner('c2', []),
              {
                id: 'l1',
                articleId: 'article-1',
                contextData: {
                  dockedRoots: [
                    {
                      ownDockingVector: 'LeftBottom',
                      dockedRoots: [entry('c3', 'RightBottom')],
                    },
                  ],
                },
              },
              corner('c3', []),
              { id: 'x', articleId: 'article-1' },
            ],
          },
        ],
      })
    ).rejects.toThrow(/could not move them apart/);
    expect(api.extended.loadExternalObjectGroupLayout).not.toHaveBeenCalled();
  });

  it('moves the later of two roots on one side vector to the free end of the leg, not through the corner article', async () => {
    // issue 4: b1 stands on the corner's left leg; b2 is docked to b1's
    // RightBottom, which the corner article takes
    const cornerArticle = {
      ...articleFixture,
      articleId: 'corner-1',
      cornerArticle: true,
    };
    const { loadedGroup, result } = await loadedWith(
      [
        {
          roots: [
            {
              id: 'c',
              articleId: 'corner-1',
              contextData: {
                dockedRoots: [
                  {
                    ownDockingVector: 'LeftBottom',
                    dockedRoots: [entry('b1', 'RightBottom')],
                  },
                ],
              },
            },
            {
              id: 'b1',
              articleId: 'article-1',
              contextData: {
                dockedRoots: [
                  {
                    ownDockingVector: 'RightBottom',
                    dockedRoots: [entry('b2', 'LeftBottom')],
                  },
                ],
              },
            },
            { id: 'b2', articleId: 'article-1' },
          ],
        },
      ],
      { ...planContextFixture, articles: [articleFixture, cornerArticle] }
    );
    const [, b1] = loadedGroup.roots;
    expect(b1.contextData).toEqual({
      dockedRoots: [
        {
          ownDockingVector: 'LeftBottom',
          dockedRoots: [entry('b2', 'RightBottom')],
        },
      ],
    });
    expect(result.corrections).toEqual([
      "posGroups[0]: roots 'c', 'b2' were docked to the RightBottom of root 'b1' at the same place - 'b2' was docked to the LeftBottom of 'b1', the free end of its leg (the RightBottom row ends at the corner article 'c')",
    ]);
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
    // the fake plan holds g1 before and after the load: the call built no
    // group of its own there, and g1 is named by its id only
    expect(result).toMatchObject({
      loaded: [{ id: 'loaded-1' }],
      groups: [],
      otherGroupIds: ['g1'],
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

  // the groups the plan context returns per read, the last entry for every
  // further read
  const createSequenceApi = (reads: any[][]) => {
    let read = 0;
    return createApi(planContextFixture, {
      getExternalObjectPlanContext: vi.fn(async (sections: string[]) =>
        sections.includes('groups')
          ? { groups: reads[Math.min(read++, reads.length - 1)] }
          : planContextFixture
      ),
    });
  };

  it("replaces the group created earlier under the agent's own id", async () => {
    // issue 24: the planner regenerates the id; the second call must not
    // build a second kitchen on the same spot
    const created = makeShapedGroup({ id: 'g-new' });
    const api = createSequenceApi([[], [created]]);
    const kitchen = {
      id: 'kitchen1',
      libraryId: 'lib-1',
      placement: { posGroup: [4000, 0, -3000], posRotationY: 270 },
      roots: [pick()],
    };
    await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [structuredClone(kitchen)],
    });
    const result = (await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [structuredClone(kitchen)],
    })) as Record<string, any>;
    const calls = api.extended.loadExternalObjectGroupLayout.mock
      .calls as unknown as any[][];
    const second = calls[calls.length - 1][0].posGroups[0];
    expect(second.id).toBe('g-new');
    expect(second.repositioningData).toBeUndefined();
    expect(result.corrections).toEqual([
      "posGroups[0]: group id 'kitchen1' names the group 'g-new' created earlier - it was replaced",
      "posGroups[0]: group 'g-new' is already in the plan - its placement was not used and the group keeps its position; place-group moves it",
    ]);
    expect(result.hint).toBeUndefined();
  });

  it.each(['Error', 'Fatal'])(
    'reports a new root calculation %s while keeping the loaded groups',
    async (category) => {
      const failed = makeShapedGroup({
        id: 'new-runtime-id',
        roots: [
          makeShapedRoot({ id: 'failed-runtime-root' }),
          makeShapedRoot({ id: 'valid-runtime-root' }),
        ],
      });
      const other = makeShapedGroup({ id: 'other-runtime-id' });
      let loaded = false;
      const api = createApi(planContextFixture, {
        getExternalObjectPlanContext: vi.fn(async () => ({
          ...planContextFixture,
          groups: loaded
            ? [...planContextFixture.groups, failed, other]
            : planContextFixture.groups,
        })),
        loadExternalObjectGroupLayout: vi.fn(async () => {
          loaded = true;
          return [{ id: 'loaded-failed' }, { id: 'loaded-other' }];
        }),
        getExternalObjectGroups: vi.fn(async () =>
          loaded
            ? [
                {
                  id: 'g1',
                  roots: [
                    {
                      id: 'unrelated',
                      logMessages: [
                        { category: 'Error', msg: 'Unrelated error' },
                      ],
                    },
                  ],
                },
                {
                  id: failed.id,
                  roots: [
                    {
                      id: 'failed-runtime-root',
                      articleId: 'article-1',
                      logMessages: [
                        {
                          category,
                          msg: 'Width cannot be calculated\nInternal stack trace',
                        },
                      ],
                    },
                    {
                      id: 'valid-runtime-root',
                      articleId: 'article-1',
                      logMessages: [
                        { category: 'Warning', msg: 'Optional note' },
                      ],
                    },
                  ],
                },
                {
                  id: other.id,
                  roots: [{ id: 'other-root', logMessages: [] }],
                },
              ]
            : []
        ),
      });
      const result = (await toolExecutors['create-or-replace-groups'](api, {
        posGroups: [
          { roots: [{ id: 'unknown', articleId: 'not-an-article' }] },
          {
            roots: [
              { id: 'bad', articleId: 'article-1' },
              { id: 'good', articleId: 'article-1', rightOf: 'bad' },
            ],
          },
          { roots: [pick()] },
        ],
      })) as Record<string, any>;

      expect(result.loaded).toHaveLength(2);
      expect(result.groups.map((group: any) => group.id)).toEqual([
        failed.id,
        other.id,
      ]);
      expect(result.notLoaded).toEqual([
        expect.objectContaining({ index: 0 }),
        {
          index: 1,
          id: failed.id,
          rootIds: ['failed-runtime-root'],
          errors: [expect.stringContaining('Width cannot be calculated')],
        },
      ]);
      expect(result.notLoaded[1].errors[0]).toContain(
        "'failed-runtime-root' (article-1)"
      );
      expect(result.notLoaded[1].errors[0]).toContain('attribute overrides');
      expect(result.notLoaded[1].errors[0]).not.toContain(
        'Internal stack trace'
      );
    }
  );

  it('reports a replace the planner reverted to the previous content', async () => {
    // issue 34: the plan context after the load still holds the one root of g1
    const api = createApi(planContextFixture);
    const result = (await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        {
          id: 'g1',
          libraryId: 'lib-1',
          roots: [
            { id: 'r1', articleId: 'article-1' },
            { id: 'u2', articleId: 'article-1', rightOf: 'r1' },
          ],
        },
      ],
    })) as Record<string, any>;
    expect(result.loaded).toEqual([{ id: 'loaded-1' }]);
    expect(result.corrections).toEqual([
      "posGroups[0]: the planner could not calculate the new layout of group 'g1' and kept its previous content - the page console names the module that failed; send the layout again with another article",
    ]);
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
    expect(getExternalObjectPlanContext).toHaveBeenNthCalledWith(2, [
      'groups',
      'obstacles',
    ]);
    expect(getExternalObjectPlanContext).toHaveBeenNthCalledWith(3, [
      'groups',
      'obstacles',
      'rooms',
    ]);
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

  // the same catalog, every article 600 mm wide
  const loadedWithWidths = async (posGroups: unknown[]) => {
    const api = createApi({
      ...kitchenContext,
      articles: kitchenContext.articles.map((article) => ({
        ...article,
        rootModules: article.rootModules.map((rootModule) => ({
          ...rootModule,
          dimensions: [
            ...rootModule.dimensions,
            { id: 'mod_Width', name: 'Width', value: 600 },
          ],
        })),
      })),
    });
    const result = (await toolExecutors['create-or-replace-groups'](api, {
      posGroups,
    })) as Record<string, any>;
    const calls = api.extended.loadExternalObjectGroupLayout.mock
      .calls as unknown as any[][];
    return { result, loadedGroup: calls[calls.length - 1][0].posGroups[0] };
  };
  const baseRow = [
    { id: 'base1', articleId: 'base' },
    { id: 'base2', articleId: 'base', rightOf: 'base1' },
    { id: 'base3', articleId: 'base', rightOf: 'base2' },
  ];
  const hangsRightOf = (group: any, unit: string, target: string) =>
    (dockingOf(group)[target] as any[]).some(
      (context) =>
        context.ownDockingVector === 'RightBottom' &&
        context.dockedRoots.some((docked: any) => docked.id === unit)
    );

  it('puts a unit hung above a floor unit whose place a wall-unit row takes at the end of that row', async () => {
    const { result, loadedGroup } = await loadedWithWidths([
      {
        libraryId: 'lib-1',
        roots: [
          ...baseRow,
          { id: 'wall1', articleId: 'wall', above: 'base1' },
          { id: 'wall2', articleId: 'wall', rightOf: 'wall1' },
          { id: 'wall3', articleId: 'wall', rightOf: 'wall2' },
          { id: 'wall4', articleId: 'wall', above: 'base3' },
        ],
      },
    ]);
    expect(hangsRightOf(loadedGroup, 'wall4', 'wall3')).toBe(true);
    expect(result.corrections).toEqual([
      "posGroups[0]: 'wall4' would hang above 'base3' in the place of 'wall3' - it was put rightOf 'wall3', the end of that row of wall units",
    ]);
  });

  it('puts it at the left end of a wall-unit row that grows to the left', async () => {
    const { result, loadedGroup } = await loadedWithWidths([
      {
        libraryId: 'lib-1',
        roots: [
          ...baseRow,
          { id: 'wall3', articleId: 'wall', above: 'base3' },
          { id: 'wall2', articleId: 'wall', leftOf: 'wall3' },
          { id: 'wall1', articleId: 'wall', leftOf: 'wall2' },
          { id: 'wall4', articleId: 'wall', above: 'base2' },
        ],
      },
    ]);
    const hangsLeftOf = (unit: string, target: string) =>
      (dockingOf(loadedGroup)[target] as any[]).some(
        (context) =>
          context.ownDockingVector === 'LeftBottom' &&
          context.dockedRoots.some((docked: any) => docked.id === unit)
      );
    expect(hangsLeftOf('wall4', 'wall1')).toBe(true);
    expect(result.corrections).toEqual([
      "posGroups[0]: 'wall4' would hang above 'base2' in the place of 'wall2' - it was put leftOf 'wall1', the end of that row of wall units",
    ]);
  });

  it('checks the place a second unit above one floor unit moves to the same way', async () => {
    const { result, loadedGroup } = await loadedWithWidths([
      {
        libraryId: 'lib-1',
        roots: [
          ...baseRow,
          { id: 'wall1', articleId: 'wall', above: 'base1' },
          // G44 puts wall2 rightOf wall1, into the place above base2
          { id: 'wall2', articleId: 'wall', above: 'base1' },
          { id: 'wall3', articleId: 'wall', above: 'base2' },
        ],
      },
    ]);
    expect(hangsRightOf(loadedGroup, 'wall2', 'wall1')).toBe(true);
    expect(hangsRightOf(loadedGroup, 'wall3', 'wall2')).toBe(true);
    expect(result.corrections).toEqual([
      "posGroups[0]: 'wall1' and 'wall2' both hang above 'base1' - 'wall2' was put rightOf 'wall1'",
      "posGroups[0]: 'wall3' would hang above 'base2' in the place of 'wall2' - it was put rightOf 'wall2', the end of that row of wall units",
    ]);
  });

  it('leaves wall units that hang side by side above their floor units as they are', async () => {
    const { result } = await loadedWithWidths([
      {
        libraryId: 'lib-1',
        roots: [
          ...baseRow,
          { id: 'wall1', articleId: 'wall', above: 'base1' },
          { id: 'wall2', articleId: 'wall', above: 'base2' },
          { id: 'wall3', articleId: 'wall', rightOf: 'wall2' },
        ],
      },
    ]);
    expect(result.corrections).toBeUndefined();
  });

  it("docks the second wall unit beside a tall unit to the free end of the first one's row", async () => {
    const { result, loadedGroup } = await loaded([
      {
        libraryId: 'lib-1',
        roots: [
          { id: 't1', articleId: 'tall' },
          { id: 'w1', articleId: 'wall', rightOf: 't1' },
          { id: 'w2', articleId: 'wall', rightOf: 't1' },
        ],
      },
    ]);
    expect(dockingOf(loadedGroup)).toEqual({
      t1: [
        {
          ownDockingVector: 'RightTop',
          dockedRoots: [entry('w1', 'LeftTop')],
        },
      ],
      w1: [
        {
          ownDockingVector: 'RightBottom',
          dockedRoots: [entry('w2', 'LeftBottom')],
        },
      ],
      w2: [],
    });
    expect(result.corrections).toEqual([
      "posGroups[0]: roots 'w1', 'w2' were docked to the RightTop of root 't1' at the same place - 'w2' was " +
        "docked to the RightBottom of 'w1', the free end of the row of 'w1'",
    ]);
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

describe('create-or-replace-groups materials', () => {
  // the groups before the load, then the groups after it
  const createMaterialsApi = (
    groupsBefore: any[],
    groupsAfter: any[],
    overrides: Record<string, unknown> = {},
    masterData: Record<string, unknown> = masterDataFixture
  ) => {
    let groupReads = 0;
    return createApi(planContextFixture, {
      getExternalObjectPlanContext: vi.fn(async (sections: string[]) =>
        sections.includes('groups')
          ? { groups: groupReads++ === 0 ? groupsBefore : groupsAfter }
          : { ...planContextFixture, masterData }
      ),
      ...overrides,
    });
  };
  const commandsOf = (api: ReturnType<typeof createApi>) =>
    api.extended.externalObjectGroupOperation.mock.calls;
  const loadedRoots = (api: ReturnType<typeof createApi>) => {
    const calls = api.extended.loadExternalObjectGroupLayout.mock
      .calls as unknown as any[][];
    return calls[calls.length - 1][0].posGroups[0].roots;
  };

  it('sets the group attributes that are not group settings in one planner command after the load', async () => {
    const created = makeShapedGroup({
      id: 'g-new',
      attributes: [{ id: 'mod_GroupHeight', value: 1500 }],
    });
    const api = createMaterialsApi([], [created]);
    const result = (await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        {
          libraryId: 'lib-1',
          attributes: [
            { id: 'front', value: 'white' },
            { id: 'mod_GroupHeight', value: 1500 },
            { id: 'carcase', value: 'oak' },
          ],
          roots: [pick()],
        },
      ],
    })) as Record<string, any>;
    expect(commandsOf(api)).toEqual([
      [
        'change-attributes',
        {
          groupId: 'g-new',
          attributes: [
            { attributeId: 'front', value: 'white' },
            { attributeId: 'carcase', value: 'oak' },
          ],
        },
      ],
    ]);
    expect(result.groupAttributes).toEqual([
      { index: 0, id: 'g-new', set: ['front', 'carcase'] },
    ]);
    expect(result.corrections).toBeUndefined();
    // the groups are read again after the command
    expect(api.extended.getExternalObjectPlanContext).toHaveBeenLastCalledWith([
      'groups',
      'obstacles',
      'rooms',
    ]);
    expect(result.groups).toEqual([created]);
  });

  it('passes on the root module the library could not calculate with the group attributes', async () => {
    const plannerCorrection =
      "the library could not calculate root module 'panel-1' with these attributes, so they were not set on it - the other root modules carry them";
    const api = createMaterialsApi([], [makeShapedGroup({ id: 'g-new' })], {
      externalObjectGroupOperation: vi.fn(async (command: string) => ({
        command,
        groups: [],
        removedGroupIds: [],
        corrections: [plannerCorrection],
      })),
    });
    const result = (await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        {
          libraryId: 'lib-1',
          attributes: [
            { id: 'front', value: 'white' },
            { id: 'mod_UprightColor', value: '192' },
          ],
          roots: [pick()],
        },
      ],
    })) as Record<string, any>;
    expect(result.corrections).toEqual([`posGroups[0]: ${plannerCorrection}`]);
  });

  it('names the attributes set and those no unit of the group carries in groupAttributes, not in corrections', async () => {
    const api = createMaterialsApi([], [makeShapedGroup({ id: 'g-new' })], {
      externalObjectGroupOperation: vi.fn(async (command: string) => ({
        command,
        groups: [],
        removedGroupIds: [],
        skippedAttributes: [{ attributeId: 'backsplash' }],
      })),
    });
    const result = (await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        {
          libraryId: 'lib-1',
          attributes: [
            { id: 'front', value: 'white' },
            { id: 'backsplash', value: 'grey' },
          ],
          roots: [pick()],
        },
      ],
    })) as Record<string, any>;
    expect(result.groupAttributes).toEqual([
      { index: 0, id: 'g-new', set: ['front'], notCarried: ['backsplash'] },
    ]);
    expect(result.corrections).toBeUndefined();
  });

  it('sends the program attributes of the group before the others, so a colour sent with its program stays', async () => {
    const api = createMaterialsApi([], [makeShapedGroup({ id: 'g-new' })]);
    await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        {
          libraryId: 'lib-1',
          attributes: [
            { id: 'mod_CountertopColor', value: '216' },
            { id: 'mod_CountertopProgram', value: 'Cube' },
          ],
          roots: [pick()],
        },
      ],
    });
    expect(
      ((commandsOf(api)[0] as any[])[1] as any).attributes.map(
        (attribute: any) => attribute.attributeId
      )
    ).toEqual(['mod_CountertopProgram', 'mod_CountertopColor']);
  });

  // the planner regenerates the ids of new roots and keeps their order
  const loadedAccentGroup = (frontColors: (string | undefined)[]) =>
    makeShapedGroup({
      id: 'g-new',
      roots: [
        ...frontColors.map((color, position) =>
          makeShapedRoot({
            id: `n${position + 1}`,
            attributes: color ? [{ id: 'mod_FrontColor', value: color }] : [],
          })
        ),
        {
          id: 'worktop',
          articleId: 'mr_Countertop',
          isGenerated: true,
          attributes: [],
        },
      ],
    });
  const accentPayload = () => ({
    posGroups: [
      {
        libraryId: 'lib-1',
        attributes: [{ id: 'mod_FrontColor', value: '190' }],
        roots: [
          { id: 'u1', articleId: 'article-1' },
          {
            id: 'u2',
            articleId: 'article-1',
            rightOf: 'u1',
            attributes: [{ id: 'mod_FrontColor', value: '326' }],
          },
          {
            id: 'u3',
            articleId: 'article-1',
            rightOf: 'u2',
            attributes: [{ id: 'mod_FrontColor', value: 326 }],
          },
        ],
      },
    ],
  });

  it("sets a root module's own value of a group attribute on that root module after the group's value", async () => {
    const changed = loadedAccentGroup(['190', '326', '326']);
    const api = createMaterialsApi(
      [],
      [loadedAccentGroup([undefined, '326', '326'])],
      {
        externalObjectGroupOperation: vi.fn(async (command: string) => ({
          command,
          groups: [changed],
          removedGroupIds: [],
        })),
      }
    );
    const result = (await toolExecutors['create-or-replace-groups'](
      api,
      accentPayload()
    )) as Record<string, any>;
    expect(commandsOf(api)).toEqual([
      [
        'change-attributes',
        {
          groupId: 'g-new',
          attributes: [
            { attributeId: 'mod_FrontColor', value: '190' },
            {
              attributeId: 'mod_FrontColor',
              value: '326',
              rootModuleIds: ['n2', 'n3'],
            },
          ],
        },
      ],
    ]);
    expect(result.groupAttributes).toEqual([
      {
        index: 0,
        id: 'g-new',
        set: ['mod_FrontColor'],
        rootValues: [
          { id: 'mod_FrontColor', value: '326', rootModuleIds: ['n2', 'n3'] },
        ],
      },
    ]);
    // the accents are what was sent, no library change
    expect(result.corrections).toBeUndefined();
  });

  it("sets a root module's own program again before its accent, since the group's colour may have switched it", async () => {
    const api = createMaterialsApi([], [loadedAccentGroup([undefined, '326'])]);
    await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        {
          libraryId: 'lib-1',
          attributes: [{ id: 'mod_FrontColor', value: '190' }],
          roots: [
            { id: 'u1', articleId: 'article-1' },
            {
              id: 'u2',
              articleId: 'article-1',
              rightOf: 'u1',
              attributes: [
                { id: 'mod_FrontColor', value: '326' },
                { id: 'mod_FrontProgram', value: 'Nature' },
              ],
            },
          ],
        },
      ],
    });
    expect(((commandsOf(api)[0] as any[])[1] as any).attributes).toEqual([
      { attributeId: 'mod_FrontColor', value: '190' },
      {
        attributeId: 'mod_FrontProgram',
        value: 'Nature',
        rootModuleIds: ['n2'],
      },
      { attributeId: 'mod_FrontColor', value: '326', rootModuleIds: ['n2'] },
    ]);
  });

  it('finds the root modules of the accents by the value they were loaded with when the order does not tell', async () => {
    // the planner added a root module of its own
    const loaded = loadedAccentGroup([undefined, '326', '326', undefined]);
    const api = createMaterialsApi([], [loaded]);
    await toolExecutors['create-or-replace-groups'](api, accentPayload());
    expect(((commandsOf(api)[0] as any[])[1] as any).attributes[1]).toEqual({
      attributeId: 'mod_FrontColor',
      value: '326',
      rootModuleIds: ['n2', 'n3'],
    });
  });

  it('keeps the ids of the root modules a replace keeps', async () => {
    const before = makeShapedGroup({
      id: 'g1',
      roots: [makeShapedRoot({ id: 'r1' }), makeShapedRoot({ id: 'r2' })],
    });
    const api = createMaterialsApi([before], [before]);
    await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        {
          id: 'g1',
          libraryId: 'lib-1',
          attributes: [{ id: 'mod_FrontColor', value: '190' }],
          roots: [
            { id: 'r1', articleId: 'article-1' },
            {
              id: 'r2',
              articleId: 'article-1',
              rightOf: 'r1',
              attributes: [{ id: 'mod_FrontColor', value: '326' }],
            },
          ],
        },
      ],
    });
    expect(((commandsOf(api)[0] as any[])[1] as any).attributes).toEqual([
      { attributeId: 'mod_FrontColor', value: '190' },
      { attributeId: 'mod_FrontColor', value: '326', rootModuleIds: ['r2'] },
    ]);
  });

  it('names the group attributes once as the cause of a library change', async () => {
    const loaded = makeShapedGroup({
      id: 'g-new',
      roots: [
        wallUnit('w1', { mod_FrontColor: '324' }),
        wallUnit('w2', { mod_FrontColor: '324' }),
      ],
    });
    const changed = makeShapedGroup({
      id: 'g-new',
      roots: [
        wallUnit('w1', { mod_FrontColor: '152', mod_FrontProgram: 'Classic' }),
        wallUnit('w2', { mod_FrontColor: '152', mod_FrontProgram: 'Classic' }),
      ],
    });
    const api = createMaterialsApi(
      [],
      [loaded],
      {
        externalObjectGroupOperation: vi.fn(async (command: string) => ({
          command,
          groups: [changed],
          removedGroupIds: [],
        })),
      },
      frontMasterData
    );
    const result = (await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        {
          libraryId: 'lib-1',
          attributes: [{ id: 'mod_FrontProgram', value: 'Classic' }],
          roots: [pick()],
        },
      ],
    })) as Record<string, any>;
    expect(result.corrections).toEqual([
      'posGroups[0]: with its group attributes the library changed ' +
        "mod_FrontColor of root modules 'w1' (OTB60), 'w2' (OTB60) from \"324\" (Dark marble (#404040)) " +
        'to "152" (Cloudy blue (#506080))',
    ]);
  });

  it('does not name a colour the group sets itself after its program', async () => {
    const loaded = makeShapedGroup({
      id: 'g-new',
      roots: [wallUnit('w1', { mod_FrontColor: '324' })],
    });
    const changed = makeShapedGroup({
      id: 'g-new',
      roots: [
        wallUnit('w1', { mod_FrontColor: '178', mod_FrontProgram: 'Classic' }),
      ],
    });
    const api = createMaterialsApi(
      [],
      [loaded],
      {
        externalObjectGroupOperation: vi.fn(async (command: string) => ({
          command,
          groups: [changed],
          removedGroupIds: [],
        })),
      },
      frontMasterData
    );
    const result = (await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        {
          libraryId: 'lib-1',
          attributes: [
            { id: 'mod_FrontProgram', value: 'Classic' },
            { id: 'mod_FrontColor', value: '178' },
          ],
          roots: [pick()],
        },
      ],
    })) as Record<string, any>;
    expect(result.corrections).toBeUndefined();
  });

  it('sets the group attributes on every unit after a replace, except the group settings of the master data', async () => {
    // RML-18075: after a replace the planner lists the attributes the call sent
    const sent = [
      { id: 'mod_ToekickColor', value: '224' },
      { id: 'mod_GroupHeight', value: 1500 },
    ];
    const api = createMaterialsApi(
      [makeShapedGroup()],
      [makeShapedGroup({ attributes: sent })],
      {},
      {
        'lib-1': {
          ...masterDataFixture['lib-1'],
          groupSettings: ['mod_GroupHeight'],
        },
      }
    );
    const result = (await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        {
          id: 'g1',
          libraryId: 'lib-1',
          attributes: sent,
          roots: [{ id: 'r1', articleId: 'article-1' }],
        },
      ],
    })) as Record<string, any>;
    expect(commandsOf(api)).toEqual([
      [
        'change-attributes',
        {
          groupId: 'g1',
          attributes: [{ attributeId: 'mod_ToekickColor', value: '224' }],
        },
      ],
    ]);
    expect(result.groupAttributes).toEqual([
      { index: 0, id: 'g1', set: ['mod_ToekickColor'] },
    ]);
    expect(result.corrections).toBeUndefined();
  });

  it('moves an override only a generated root carries to the group', async () => {
    const created = makeShapedGroup({ id: 'g-new' });
    const api = createMaterialsApi([], [created]);
    const result = (await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        {
          libraryId: 'lib-1',
          roots: [
            {
              id: 'u1',
              articleId: 'article-1',
              attributes: [
                { id: 'countertop', value: '224' },
                { id: 'front', value: 'white' },
              ],
            },
          ],
        },
      ],
    })) as Record<string, any>;
    expect(api.extended.getExternalObjectPlanContext).toHaveBeenCalledWith([
      'masterData',
    ]);
    expect(loadedRoots(api)).toEqual([
      {
        id: 'u1',
        articleId: 'article-1',
        attributes: [{ id: 'front', value: 'white' }],
      },
    ]);
    expect(commandsOf(api)).toEqual([
      [
        'change-attributes',
        {
          groupId: 'g-new',
          attributes: [{ attributeId: 'countertop', value: '224' }],
        },
      ],
    ]);
    expect(result.corrections).toEqual([
      "posGroups[0] root 'u1': a 'article-1' has no attribute 'countertop' - the generated roots of the group carry it, so it is set on the whole group",
    ]);
    expect(result.groupAttributes).toEqual([
      { index: 0, id: 'g-new', set: ['countertop'] },
    ]);
  });

  it("leaves an override the unit's own module carries on the root", async () => {
    const api = createMaterialsApi([], [makeShapedGroup({ id: 'g-new' })]);
    const result = (await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        {
          libraryId: 'lib-1',
          roots: [
            {
              id: 'u1',
              articleId: 'article-1',
              attributes: [{ id: 'front', value: 'white' }],
            },
          ],
        },
      ],
    })) as Record<string, any>;
    expect(loadedRoots(api)[0].attributes).toEqual([
      { id: 'front', value: 'white' },
    ]);
    expect(commandsOf(api)).toEqual([]);
    expect(result.corrections).toBeUndefined();
  });

  it("passes the planner's answer on as a correction and keeps the load", async () => {
    const api = createMaterialsApi([], [makeShapedGroup({ id: 'g-new' })], {
      externalObjectGroupOperation: vi.fn(async () => {
        throw new Error("No module of group 'g-new' has the attribute 'nope'.");
      }),
    });
    const result = (await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        {
          libraryId: 'lib-1',
          attributes: [{ id: 'nope', value: 'x' }],
          roots: [pick()],
        },
      ],
    })) as Record<string, any>;
    expect(result.loaded).toEqual([{ id: 'loaded-1' }]);
    expect(result.corrections).toEqual([
      "posGroups[0]: the group attributes nope could not be set on group 'g-new' - No module of group 'g-new' has the attribute 'nope'.",
    ]);
    expect(result.groupAttributes).toBeUndefined();
  });

  it('sets the colours of the generated roots again after a replace', async () => {
    // issue 22: the plan-context group carries the worktop with its colour,
    // C1 drops the worktop, the colour is set again after the load
    const api = createMaterialsApi([makeShapedGroup()], [makeShapedGroup()]);
    const result = (await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        {
          id: 'g1',
          libraryId: 'lib-1',
          roots: [
            { id: 'r1', articleId: 'article-1' },
            {
              id: 'wt',
              articleId: 'mr_Countertop',
              isGenerated: true,
              attributes: [{ id: 'countertop', value: '224' }],
            },
          ],
        },
      ],
    })) as Record<string, any>;
    expect(loadedRoots(api)).toEqual([{ id: 'r1', articleId: 'article-1' }]);
    expect(commandsOf(api)).toEqual([
      [
        'change-attributes',
        {
          groupId: 'g1',
          attributes: [{ attributeId: 'countertop', value: '224' }],
        },
      ],
    ]);
    expect(result.groupAttributes).toEqual([
      { index: 0, id: 'g1', set: ['countertop'] },
    ]);
    expect(result.corrections).toBeUndefined();
  });
});

// what stands in the 4000 x 3000 room as the planner returns it: a window
// behind the back wall, a door behind the right wall, a chair in the room and
// a sofa at the left wall
const windowBehindTheBackWall = (fromX: number, toX: number) => ({
  kind: 'window',
  outline: [
    [toX, 0, -3120],
    [fromX, 0, -3120],
    [fromX, 0, -3000],
    [toX, 0, -3000],
  ],
  bottomMm: 950,
  topMm: 2170,
});
const obstaclesInTheRoom = {
  objects: [
    windowBehindTheBackWall(1000, 2000),
    {
      kind: 'door',
      outline: [
        [4100, 0, -1000],
        [4100, 0, -100],
        [4000, 0, -100],
        [4000, 0, -1000],
      ],
      bottomMm: 0,
      topMm: 2100,
    },
    {
      kind: 'object',
      outline: [
        [1500, 0, -1500],
        [2000, 0, -1500],
        [2000, 0, -1000],
        [1500, 0, -1000],
      ],
      bottomMm: 0,
      topMm: 790,
    },
    {
      kind: 'object',
      outline: [
        [0, 0, -2000],
        [900, 0, -2000],
        [900, 0, -1000],
        [0, 0, -1000],
      ],
      bottomMm: 0,
      topMm: 800,
    },
  ],
  groups: [],
};

describe('obstacle hints', () => {
  // a unit of a calculated group: its side and top vectors give its outline
  // and its height
  const rawUnit = (
    id: string,
    articleId: string,
    articlePos: number[],
    [width, height, depth]: [number, number, number]
  ) => ({
    id,
    articleId,
    articlePos,
    rotationY: 0,
    dockInfos: [
      { id: 'LeftBottom', start: [0, 0, 0], end: [0, 0, depth] },
      { id: 'RightBottom', start: [width, 0, 0], end: [width, 0, depth] },
      { id: 'LeftTop', start: [0, height, 0], end: [0, height, depth] },
    ],
  });
  const baseUnit = (id: string, x: number) =>
    rawUnit(id, 'base-unit', [x, 0, 0], [600, 720, 600]);
  const wallUnit = (id: string, x: number, depth = 350) =>
    rawUnit(id, 'wall-unit', [x, 1480, 0], [600, 720, depth]);
  const rawGroup = (
    id: string,
    pos: number[],
    rotationY: number,
    roots: any[]
  ) => ({ id, pos, rotationY, roots });

  // the plan before and after the load: the shaped groups of the plan
  // context and the calculated groups
  const createObstacleApi = ({
    shapedBefore = [],
    shapedAfter,
    rawBefore = [],
    rawAfter,
    obstacles = obstaclesInTheRoom,
  }: {
    shapedBefore?: any[];
    shapedAfter: any[];
    rawBefore?: any[];
    rawAfter: any[];
    obstacles?: unknown;
  }) => {
    let loaded = false;
    return createApi(planContextFixture, {
      getExternalObjectPlanContext: vi.fn(async (sections: string[]) =>
        sections.includes('groups')
          ? {
              groups: loaded ? shapedAfter : shapedBefore,
              obstacles,
              rooms: { rooms: [room] },
            }
          : planContextFixture
      ),
      loadExternalObjectGroupLayout: vi.fn(async () => {
        loaded = true;
        return [{ id: 'loaded-1' }];
      }),
      getExternalObjectGroups: vi.fn(async () =>
        loaded ? rawAfter : rawBefore
      ),
    });
  };

  const createGroups = async (
    api: ReturnType<typeof createApi>,
    posGroups: any[] = [{ libraryId: 'lib-1', roots: [pick()] }]
  ) =>
    (await toolExecutors['create-or-replace-groups'](api, {
      posGroups,
    })) as Record<string, any>;

  const BUILT_AS_SENT =
    'The groups were built as sent - move or change them if the user did not ask for them there.';

  it('names the wall units across a window with the free stretches of the wall', async () => {
    const api = createObstacleApi({
      shapedAfter: [makeShapedGroup({ id: 'g-new' })],
      rawAfter: [
        rawGroup('g-new', [800, 0, -3000], 0, [
          baseUnit('b1', 0),
          baseUnit('b2', 600),
          wallUnit('w1', 0),
          wallUnit('w2', 600),
        ]),
      ],
    });
    const result = await createGroups(api);
    const inFrontOfTheWindow =
      'stands in front of the window in the back wall (wall 2, fromEndMm 1000 to 2000, 950 to 2170 mm) - ' +
      'free stretches of the back wall (wall 2) at its height: fromEndMm 0 to 1000, 2000 to 4000.';
    expect(result.hint).toBe(
      [
        `Root module 'w1' (wall-unit) of group 'g-new' ${inFrontOfTheWindow}`,
        `Root module 'w2' (wall-unit) of group 'g-new' ${inFrontOfTheWindow}`,
        BUILT_AS_SENT,
      ].join(' ')
    );
  });

  it('names a corner unit on the adjoining wall that reaches into a window', async () => {
    // test 32: a base unit with a 400 mm deep wall unit above it in the back
    // left corner, against the left wall; the window starts 300 mm from the
    // corner
    const api = createObstacleApi({
      shapedAfter: [makeShapedGroup({ id: 'g-new' })],
      rawAfter: [
        rawGroup('g-new', [0, 0, -2400], 90, [
          baseUnit('b1', 0),
          wallUnit('w1', 0, 400),
        ]),
      ],
      obstacles: { objects: [windowBehindTheBackWall(300, 1300)], groups: [] },
    });
    const result = await createGroups(api);
    expect(result.hint).toBe(
      "Root module 'w1' (wall-unit) of group 'g-new' stands in front of the window in the back wall " +
        '(wall 2, fromEndMm 300 to 1300, 950 to 2170 mm) - free stretches of the left wall (wall 3) at its ' +
        `height: fromEndMm 0 to 2400. ${BUILT_AS_SENT}`
    );
  });

  it('names a root module on an object', async () => {
    const api = createObstacleApi({
      shapedAfter: [makeShapedGroup({ id: 'g-new' })],
      rawAfter: [rawGroup('g-new', [1400, 0, -1600], 0, [baseUnit('i1', 0)])],
    });
    const result = await createGroups(api);
    expect(result.hint).toBe(
      "Root module 'i1' (base-unit) of group 'g-new' overlaps an object (x 1500 to 2000, z -1500 to -1000, " +
        `0 to 790 mm). ${BUILT_AS_SENT}`
    );
  });

  it('names a root module in another group and advises merging', async () => {
    const existing = rawGroup('g1', [1000, 0, -3000], 0, [
      rawUnit('r1', 'article-1', [0, 0, 0], [600, 720, 600]),
    ]);
    const api = createObstacleApi({
      shapedBefore: [makeShapedGroup({ id: 'g1' })],
      shapedAfter: [
        makeShapedGroup({ id: 'g1' }),
        makeShapedGroup({ id: 'g-new' }),
      ],
      rawBefore: [existing],
      rawAfter: [
        existing,
        rawGroup('g-new', [1000, 0, -3000], 0, [
          rawUnit('u1', 'article-1', [0, 0, 0], [600, 720, 600]),
        ]),
      ],
    });
    const result = await createGroups(api);
    expect(result.hint).toBe(
      "Root module 'u1' (article-1) of group 'g-new' overlaps root module 'r1' (article-1) of group 'g1' - " +
        'free stretches of the back wall (wall 2) at its height: fromEndMm 0 to 1000, 1600 to 4000. ' +
        `${BUILT_AS_SENT} If the units belong together, send them as one group or join them with merge-groups.`
    );
  });

  it('tests an L-shaped object like its convex hull', async () => {
    // the unit stands in the bounding box of the sofa, beyond its hull
    const api = createObstacleApi({
      shapedAfter: [makeShapedGroup({ id: 'g-new' })],
      rawAfter: [
        rawGroup('g-new', [2400, 0, -1500], 0, [
          rawUnit('i1', 'base-unit', [0, 0, 0], [500, 720, 400]),
        ]),
      ],
      obstacles: {
        objects: [
          {
            kind: 'object',
            outline: [
              [1000, 0, -2500],
              [3000, 0, -2500],
              [3000, 0, -2000],
              [1500, 0, -2000],
              [1500, 0, -1000],
              [1000, 0, -1000],
            ],
            bottomMm: 0,
            topMm: 800,
          },
        ],
        groups: [],
      },
    });
    const result = await createGroups(api);
    expect(result.hint).toBeUndefined();
  });

  it('tests a door or a window within its height', async () => {
    // a wall unit over the door of the right wall, above its top at 2100 mm
    const api = createObstacleApi({
      shapedAfter: [makeShapedGroup({ id: 'g-new' })],
      rawAfter: [
        rawGroup('g-new', [4000, 0, -900], 270, [
          rawUnit('w1', 'wall-unit', [0, 2150, 0], [600, 350, 350]),
        ]),
      ],
    });
    const result = await createGroups(api);
    expect(result.hint).toBeUndefined();
  });

  it('says nothing about a group beside or touching an obstacle', async () => {
    const api = createObstacleApi({
      shapedAfter: [
        makeShapedGroup({ id: 'g-row' }),
        makeShapedGroup({ id: 'g-island' }),
      ],
      rawAfter: [
        // the wall units end where the window's span starts
        rawGroup('g-row', [400, 0, -3000], 0, [
          baseUnit('b1', 0),
          wallUnit('w1', 0),
        ]),
        // the island touches the chair
        rawGroup('g-island', [900, 0, -1500], 0, [baseUnit('i1', 0)]),
      ],
    });
    const result = await createGroups(api, [
      { libraryId: 'lib-1', roots: [pick()] },
      { libraryId: 'lib-1', roots: [pick()] },
    ]);
    expect(result.hint).toBeUndefined();
  });

  it('names only what a replaced group did not stand on before', async () => {
    // w1 stood in front of the window before the replace, w2 is new
    const api = createObstacleApi({
      shapedBefore: [makeShapedGroup({ id: 'g1' })],
      shapedAfter: [makeShapedGroup({ id: 'g1' })],
      rawBefore: [
        rawGroup('g1', [1000, 0, -3000], 0, [
          baseUnit('r1', 0),
          wallUnit('w1', 0),
        ]),
      ],
      rawAfter: [
        rawGroup('g1', [1000, 0, -3000], 0, [
          baseUnit('r1', 0),
          wallUnit('w1', 0),
          wallUnit('w2', 600),
        ]),
      ],
    });
    const result = await createGroups(api, [
      {
        id: 'g1',
        libraryId: 'lib-1',
        roots: [
          { id: 'r1', articleId: 'article-1' },
          { id: 'u2', articleId: 'article-1', rightOf: 'r1' },
        ],
      },
    ]);
    expect(result.hint).toBe(
      "Root module 'w2' (wall-unit) of group 'g1' stands in front of the window in the back wall " +
        '(wall 2, fromEndMm 1000 to 2000, 950 to 2170 mm) - free stretches of the back wall (wall 2) at its ' +
        `height: fromEndMm 0 to 1000, 2000 to 4000. ${BUILT_AS_SENT}`
    );
  });

  it('builds without obstacle hints and reads raw calculation diagnostics', async () => {
    // D45: a planner without the obstacles section
    const api = createApi(planContextFixture);
    const result = await createGroups(api, [
      { id: 'g1', libraryId: 'lib-1', roots: [pick()] },
    ]);
    expect(result.hint).toBeUndefined();
    // History, calculation diagnostics and placement frame; no obstacle hint.
    expect(api.extended.getExternalObjectGroups).toHaveBeenCalledTimes(4);
  });
});

describe('create-or-replace-groups compile corrections', () => {
  it('reports a wall unit onTop a base unit as hanging above it', async () => {
    const api = createApi({
      ...planContextFixture,
      articles: [
        {
          ...articleFixture,
          articleId: 'base',
          category: 'Kitchen | Base Units | Storage',
          rootModules: [
            {
              module: { id: 'mr_StorageunitSingle' },
              dimensions: [{ id: 'mod_Height', name: 'Height', value: 720 }],
              dockingVectors: [],
            },
          ],
        },
        {
          ...articleFixture,
          articleId: 'wall',
          category: 'Kitchen | Wall Units | Storage',
          rootModules: [
            {
              module: { id: 'mr_StorageunitSingle' },
              dimensions: [{ id: 'mod_Height', name: 'Height', value: 720 }],
              dockingVectors: [],
            },
          ],
        },
        {
          ...articleFixture,
          articleId: 'tall',
          category: 'Kitchen | Tall Units | Storage',
          rootModules: [
            {
              module: { id: 'mr_StorageunitSingle' },
              dimensions: [{ id: 'mod_Height', name: 'Height', value: 2100 }],
              dockingVectors: [],
            },
          ],
        },
      ],
    });
    const result = (await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [
        {
          roots: [
            { id: 'b1', articleId: 'base' },
            { id: 'w1', articleId: 'wall', onTop: 'b1' },
          ],
        },
      ],
    })) as Record<string, any>;
    const calls = api.extended.loadExternalObjectGroupLayout.mock
      .calls as unknown as any[][];
    expect(
      calls[calls.length - 1][0].posGroups[0].roots[0].contextData
    ).toEqual({
      dockedRoots: [
        {
          ownDockingVector: 'LeftTop',
          dockedRoots: [
            {
              id: 'w1',
              dockingVector: 'LeftBottom',
              mode: 'StartStart',
              offset: [0, 660, 0],
            },
          ],
        },
      ],
    });
    expect(result.corrections).toEqual([
      "posGroups[0]: wall unit 'w1' hangs above the base unit 'b1' instead of onTop it",
    ]);
  });
});

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
const repositioned = (group: any, { posGroup, posRotationY, rootId }: any) => {
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

describe('place-group', () => {
  const createPlaceApi = (
    shapedGroups: any[],
    rawGroups: any[],
    afterShapedGroups: any[] = shapedGroups,
    obstacles?: unknown
  ) => {
    let currentRawGroups = rawGroups;
    return createApi(undefined, {
      getExternalObjectPlanContext: vi.fn(async (sections: string[]) =>
        sections.includes('rooms')
          ? {
              rooms: { rooms: [room] },
              groups: shapedGroups,
              ...(obstacles !== undefined && { obstacles }),
            }
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

  it('places the group once more by its measure at the new place when the library builds it there with another width', async () => {
    // at its old place, at a wall, the library built the unit 1000 mm wide;
    // at the new place it builds it 800 mm wide again
    const wide = makeRoot({
      attributes: [
        { id: 'b', value: 1000, isInput: true },
        { id: 't', value: 600, isInput: true },
      ],
    });
    let rawGroups: any[] = [makeGroup({ roots: [wide] })];
    const api = createApi(undefined, {
      getExternalObjectPlanContext: vi.fn(async () => ({
        rooms: { rooms: [room] },
        groups: [makeShapedGroup()],
      })),
      getExternalObjectGroups: vi.fn(async () => rawGroups),
      loadExternalObjectGroupLayout: vi.fn(async (layout: any) => {
        const { repositioningData } = layout.posGroups[0];
        rawGroups = rawGroups.map((group) =>
          repositioned({ ...group, roots: [makeRoot()] }, repositioningData)
        );
        return [{ id: 'g1' }];
      }),
    });
    await toolExecutors['place-group'](api, { groupId: 'g1', wall: 'right' });
    const placements = (
      api.extended.loadExternalObjectGroupLayout.mock
        .calls as unknown as any[][]
    ).map(([layout]) => layout.posGroups[0].repositioningData.posGroup);
    // centred by 1000 mm first, then by the 800 mm it has at the new place
    expect(placements).toEqual([
      [4000, 0, -2000],
      [4000, 0, -1900],
    ]);
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

  it('reports an overlap the measure at the new place finds when it places the group once more', async () => {
    // g2 ends 50 mm beside where g1, 800 mm wide, stands centred; at the new
    // place the library builds g1 1000 mm wide, into g2
    let rawGroups: any[] = [
      makeGroup({ roots: [tallRoot()] }),
      neighbourOnTheRightWall([4000, 0, -2750]),
    ];
    const api = createApi(undefined, {
      getExternalObjectPlanContext: vi.fn(async () => ({
        rooms: { rooms: [room] },
        groups: shapedPair,
      })),
      getExternalObjectGroups: vi.fn(async () => rawGroups),
      loadExternalObjectGroupLayout: vi.fn(async (layout: any) => {
        const { id, repositioningData } = layout.posGroups[0];
        rawGroups = rawGroups.map((group) =>
          group.id === id
            ? repositioned(
                {
                  ...group,
                  roots: [
                    tallRoot({
                      attributes: [
                        { id: 'b', value: 1000, isInput: true },
                        { id: 't', value: 600, isInput: true },
                        { id: 'h', value: 2000, isInput: true },
                      ],
                    }),
                  ],
                },
                repositioningData
              )
            : group
        );
        return [{ id: 'g1' }];
      }),
    });
    const result = (await toolExecutors['place-group'](api, {
      groupId: 'g1',
      wall: 'right',
    })) as Record<string, any>;

    expect(api.extended.loadExternalObjectGroupLayout).toHaveBeenCalledTimes(2);
    expect(result.corrections).toEqual([
      expect.stringMatching(
        /^Group 'g1' would overlap group 'g2' at the right wall - it was moved \d+ mm along the wall/
      ),
    ]);
  });

  it('names an object the placed group stands on', async () => {
    // centred on the left wall, the tall unit stands on the sofa
    const api = createPlaceApi(
      [makeShapedGroup()],
      [makeGroup({ roots: [tallRoot()] })],
      [makeShapedGroup()],
      obstaclesInTheRoom
    );
    const result = (await toolExecutors['place-group'](api, {
      groupId: 'g1',
      wall: 'left',
    })) as Record<string, any>;
    expect(result.hint).toBe(
      "Root module 'r1' (article-1) of group 'g1' overlaps an object (x 0 to 900, z -2000 to -1000, 0 to 800 mm) - " +
        'free stretches of the left wall (wall 3) at its height: fromEndMm 0 to 1000, 2000 to 3000. ' +
        'The group was placed anyway - move or change it if the user did not ask for it there.'
    );
    expect(result).not.toHaveProperty('corrections');
  });

  it('leaves another group to the corrections', async () => {
    const api = createPlaceApi(
      shapedPair,
      [
        makeGroup({ roots: [tallRoot()] }),
        neighbourOnTheRightWall([4000, 0, -1900]),
      ],
      shapedPair,
      obstaclesInTheRoom
    );
    const result = (await toolExecutors['place-group'](api, {
      groupId: 'g1',
      wall: 'right',
    })) as Record<string, any>;
    expect(result.corrections).toEqual([
      "Group 'g1' would overlap group 'g2' at the right wall - it was moved 800 mm along the wall to stand beside it. If the units belong together, join the groups with merge-groups",
    ]);
    expect(result).not.toHaveProperty('hint');
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

  // a base unit and a wall unit hanging 660 mm above it: the kernel's docking
  // links only vectors that touch, so the wall unit is docked to nothing below
  const sideVectors = (width: number, depth: number, height: number) => [
    { id: 'LeftBottom', start: [0, 0, 0], end: [0, 0, depth] },
    { id: 'RightBottom', start: [width, 0, 0], end: [width, 0, depth] },
    { id: 'LeftTop', start: [0, height, 0], end: [0, height, depth] },
    { id: 'RightTop', start: [width, height, 0], end: [width, height, depth] },
  ];
  const kitchenWithWallUnit = makeGroup({
    id: 'k1',
    roots: [
      makeRoot({ id: 'b1', dockInfos: sideVectors(600, 561, 720) }),
      makeRoot({
        id: 'w1',
        articlePos: [0, 1380, 0],
        dockInfos: sideVectors(600, 350, 720),
      }),
      makeRoot({
        id: 'w2',
        articlePos: [600, 1380, 0],
        dockInfos: sideVectors(600, 350, 720),
        contextData: {
          dockedRoots: [
            {
              ownDockingVector: 'LeftBottom',
              dockedRoots: [{ id: 'w1', dockingVector: 'RightBottom' }],
            },
          ],
        },
      }),
    ],
  });

  it('docks a wall unit hanging above a floor unit to it again before the reload, so it keeps its place', async () => {
    const api = createPlaceApi(
      [makeShapedGroup({ id: 'k1' })],
      [kitchenWithWallUnit]
    );
    await toolExecutors['place-group'](api, { groupId: 'k1', wall: 'back' });
    const roots = reloadedGroup(api).roots;
    expect(roots.find((root: any) => root.id === 'b1').contextData).toEqual({
      dockedRoots: [
        {
          ownDockingVector: 'LeftTop',
          dockedRoots: [
            {
              id: 'w1',
              dockingVector: 'LeftBottom',
              mode: 'StartStart',
              offset: [0, 660, 0],
            },
          ],
        },
      ],
    });
    // w2 hangs beside w1 and over nothing: its docking stays as it is
    expect(roots.find((root: any) => root.id === 'w2').contextData).toEqual(
      kitchenWithWallUnit.roots[2].contextData
    );
  });

  // an L-shaped group in the back left corner: three root modules along the
  // back wall, two down the left wall; its box covers the floor inside the L
  const boxRoot = (
    id: string,
    articlePos: number[],
    widthMm: number,
    depthMm: number
  ) =>
    makeRoot({
      id,
      articlePos,
      attributes: [
        { id: 'b', value: widthMm, isInput: true },
        { id: 't', value: depthMm, isInput: true },
        { id: 'h', value: 2000, isInput: true },
      ],
    });
  const lShaped = makeGroup({
    id: 'L',
    pos: [0, 0, -3000],
    rotationY: 0,
    roots: [
      boxRoot('a1', [0, 0, 0], 800, 600),
      boxRoot('a2', [800, 0, 0], 800, 600),
      boxRoot('a3', [1600, 0, 0], 800, 600),
      boxRoot('b1', [0, 0, 600], 600, 800),
      boxRoot('b2', [0, 0, 1400], 600, 800),
    ],
  });
  const smallGroupAt = (pos: number[]) =>
    makeGroup({
      id: 'small',
      pos,
      rotationY: 0,
      roots: [boxRoot('s1', [0, 0, 0], 800, 600)],
    });

  it('reports no overlap with a group inside an L-shaped group that no root module touches', async () => {
    const api = createPlaceApi(
      [makeShapedGroup({ id: 'L' }), makeShapedGroup({ id: 'small' })],
      // inside the L: x 1000 to 1800, z -2000 to -1400
      [lShaped, smallGroupAt([1000, 0, -2000])]
    );
    const result: any = await toolExecutors['place-group'](api, {
      groupId: 'L',
      wall: 'back',
      alignment: 'left',
    });
    expect(result.corrections).toEqual([
      "Group 'L' already stands at the top wall as asked - nothing was reloaded",
    ]);
  });

  it('still moves an L-shaped group away from a group that one of its root modules overlaps', async () => {
    const api = createPlaceApi(
      [makeShapedGroup({ id: 'L' }), makeShapedGroup({ id: 'small' })],
      // on the leg down the left wall: x 200 to 1000, z -2200 to -1600
      [lShaped, smallGroupAt([200, 0, -2200])]
    );
    const result: any = await toolExecutors['place-group'](api, {
      groupId: 'L',
      wall: 'back',
      alignment: 'left',
    });
    expect(result.corrections).toEqual([
      "Group 'L' would overlap group 'small' at the top wall - it was moved 1000 mm along the wall to stand " +
        'beside it. If the units belong together, join the groups with merge-groups',
    ]);
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

  it('reloads the group with its generated roots and anchors the first article root', async () => {
    // issue 22: the worktop keeps its colour only when it travels with the group
    const api = createPlaceApi(
      [makeShapedGroup()],
      [
        makeGroup({
          roots: [
            makeRoot({
              id: 'w1',
              isGenerated: true,
              attributes: [{ id: 'mod_CountertopColor', value: '224' }],
            }),
            makeRoot({ articlePos: [0, 0, 0], rotationY: 0 }),
          ],
        }),
      ]
    );
    await toolExecutors['place-group'](api, { groupId: 'g1', wall: 'right' });
    const reloaded = reloadedGroup(api);
    expect(reloaded.roots.map((root: any) => root.id)).toEqual(['w1', 'r1']);
    expect(reloaded.roots[0].attributes).toEqual([
      { id: 'mod_CountertopColor', value: '224' },
    ]);
    expect(reloaded.roots.some((root: any) => 'articlePos' in root)).toBe(
      false
    );
    expect(reloaded.repositioningData.rootId).toBe('r1');
  });

  it('reloads the group with its group attributes, which the planner keeps as sent', async () => {
    const settings = [
      { id: 'mod_GroupGenerationLogic', value: 'Closet' },
      { id: 'mod_CarcaseDistanceWall', value: 0 },
    ];
    const api = createPlaceApi(
      [makeShapedGroup()],
      [makeGroup({ attributes: settings })]
    );
    await toolExecutors['place-group'](api, { groupId: 'g1', wall: 'right' });
    expect(reloadedGroup(api).attributes).toEqual(settings);
  });

  it('does not reload a group that already stands where asked', async () => {
    // issue 28: centred on the right wall, where the group stands already
    for (const rotationY of [270, -90]) {
      const standing = makeGroup({ pos: [4000, 0, -1900], rotationY });
      const api = createPlaceApi([makeShapedGroup()], [standing]);
      const result = (await toolExecutors['place-group'](api, {
        groupId: 'g1',
        wall: 'right',
      })) as Record<string, any>;
      expect(api.extended.loadExternalObjectGroupLayout).not.toHaveBeenCalled();
      expect(result).toEqual({
        placedIn: 'wall',
        wall: room.walls[1],
        // the position as the placement frame reports it for the raw group
        group: makeShapedGroup({
          position: { pos: [4000, 0, -1900], rotationY: 270 },
        }),
        corrections: [
          "Group 'g1' already stands at the right wall as asked - nothing was reloaded",
        ],
      });
    }
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

describe('create-or-replace-groups wall placement', () => {
  // the attributes the library sets on a new group
  const LIBRARY_GROUP_SETTINGS = [
    { id: 'mod_GroupGenerationLogic', value: 'Closet' },
  ];
  // a base unit with its height, so that the overlap test counts it
  const BASE_UNIT_ATTRIBUTES = [
    { id: 'b', value: 800, isInput: true },
    { id: 't', value: 600, isInput: true },
    { id: 'h', value: 720, isInput: true },
  ];

  // A planner that calculates a new group as a row of its picks, 800 mm each,
  // where it puts a group without a position (arrival), and moves a reloaded
  // group of the plan to its repositioning. With reloadedLast it lists a
  // reloaded group after the others, as the kernel may.
  const createWallApi = (
    options: {
      existing?: any[];
      arrival?: number[];
      cornerRootIds?: string[];
      reloadedLast?: boolean;
      reloadFails?: boolean;
      reloadFailsFor?: string[];
      omitted?: number[];
      uncalculated?: boolean;
    } = {}
  ) => {
    let raw: any[] = [...(options.existing ?? [])];
    let created = 0;
    const calculatedRoot = (root: any, index: number) =>
      makeRoot({
        id: root.id,
        articleId: root.articleId,
        articlePos: [800 * index, 0, 0],
        attributes: BASE_UNIT_ATTRIBUTES,
        ...(options.cornerRootIds?.includes(root.id) && {
          dockInfos: cornerDockInfos,
        }),
        ...(options.uncalculated && { attributes: [], dockInfos: [] }),
      });
    const shaped = (group: any) =>
      makeShapedGroup({
        id: group.id,
        position: { pos: group.pos, rotationY: group.rotationY },
        roots: group.roots.map((root: any) => makeShapedRoot({ id: root.id })),
      });
    return createApi(undefined, {
      getExternalObjectPlanContext: vi.fn(async () => ({
        ...planContextFixture,
        groups: raw.filter((group) => group.id !== 'probe-group').map(shaped),
      })),
      getExternalObjectGroups: vi.fn(async () => raw),
      removeExternalObject: vi.fn(async (id: string) => {
        raw = raw.filter((group) => group.id !== id);
      }),
      loadExternalObjectGroupLayout: vi.fn(async (layout: any) => {
        if (isProbeLoad(layout)) {
          raw = [
            ...raw,
            makeGroup({
              id: 'probe-group',
              roots: [
                makeRoot({
                  id: 'p1',
                  dockInfos: [
                    { id: 'LeftBottom', start: [0, 0, 0], end: [0, 0, 561] },
                  ],
                }),
              ],
            }),
          ];
          return [{ id: 'probe-group' }];
        }
        const loadedIds: string[] = [];
        const reloadedIds: string[] = [];
        for (const [index, posGroup] of layout.posGroups.entries()) {
          const inPlan = raw.find((group) => group.id === posGroup.id);
          if (inPlan) {
            if (
              options.reloadFails ||
              options.reloadFailsFor?.includes(inPlan.id)
            ) {
              continue;
            }
            const moved = posGroup.repositioningData
              ? repositioned(inPlan, posGroup.repositioningData)
              : inPlan;
            raw = raw.map((group) => (group === inPlan ? moved : group));
            loadedIds.push(inPlan.id);
            reloadedIds.push(inPlan.id);
            continue;
          }
          if (options.omitted?.includes(index)) {
            continue;
          }
          const group = makeGroup({
            id: `new-${++created}`,
            pos: options.arrival ?? [0, 0, 0],
            attributes: LIBRARY_GROUP_SETTINGS,
            roots: posGroup.roots.map(calculatedRoot),
          });
          raw = [
            ...raw,
            posGroup.repositioningData
              ? repositioned(group, posGroup.repositioningData)
              : group,
          ];
          loadedIds.push(group.id);
        }
        if (options.reloadedLast) {
          raw = [
            ...raw.filter((group) => !reloadedIds.includes(group.id)),
            ...raw.filter((group) => reloadedIds.includes(group.id)),
          ];
        }
        return loadedIds.map((id) => ({ id }));
      }),
    });
  };

  const loadCalls = (api: ReturnType<typeof createWallApi>) =>
    (
      api.extended.loadExternalObjectGroupLayout.mock
        .calls as unknown as any[][]
    ).map(([layout]) => layout.posGroups);

  const placedBy = async (
    posGroups: unknown[],
    options: Parameters<typeof createWallApi>[0] = {}
  ) => {
    const api = createWallApi(options);
    const result = (await toolExecutors['create-or-replace-groups'](api, {
      posGroups,
    })) as Record<string, any>;
    return { api, result, loads: loadCalls(api) };
  };

  const row = (placement: unknown, extra: Record<string, unknown> = {}) => ({
    libraryId: 'lib-1',
    placement,
    roots: [pick()],
    ...extra,
  });

  it('loads a new group placed by wall once without a position and reloads it once at the wall', async () => {
    const { result, loads } = await placedBy([
      row({ wall: 'right', alignment: 'back' }),
    ]);
    expect(loads).toHaveLength(2);
    expect(loads[0]).toEqual([{ libraryId: 'lib-1', roots: [pick()] }]);
    expect(loads[1]).toHaveLength(1);
    expect(loads[1][0].id).toBe('new-1');
    expect(loads[1][0].repositioningData).toEqual({
      posGroup: [4000, 0, -3000],
      posRotationY: 270,
      rootId: 'u1',
    });
    // the reload changes nothing but the position: the planner keeps the
    // group attributes as sent
    expect(loads[1][0].attributes).toEqual(LIBRARY_GROUP_SETTINGS);
    expect(result.corrections).toBeUndefined();
    expect(result.groups[0].position).toMatchObject({
      pos: [4000, 0, -3000],
      rotationY: 270,
    });
  });

  it('centres a new group on the wall by default', async () => {
    const { loads } = await placedBy([row({ wall: 'back' })]);
    expect(loads[1][0].repositioningData).toMatchObject({
      posGroup: [1600, 0, -3000],
      posRotationY: 0,
    });
  });

  it("measures offsetMm from the wall's end with alignment end", async () => {
    const { loads } = await placedBy([
      row({ wall: 'back', alignment: 'end', offsetMm: 500 }),
    ]);
    expect(loads[1][0].repositioningData).toMatchObject({
      posGroup: [500, 0, -3000],
      posRotationY: 0,
    });
  });

  it('puts a new group that starts with a corner article into the corner the alignment names', async () => {
    const { loads } = await placedBy(
      [
        {
          libraryId: 'lib-1',
          placement: { wall: 'right', alignment: 'top' },
          roots: [{ id: 'c1', articleId: 'article-1' }],
        },
      ],
      { cornerRootIds: ['c1'] }
    );
    // the corner point [-261, 0, 0], turned by 270, lands on [4000, 0, -3000]
    expect(loads[1][0].repositioningData).toEqual({
      posGroup: [4000, 0, -2739],
      posRotationY: 270,
      rootId: 'c1',
    });
  });

  it('moves a new group off another group along the wall and says so', async () => {
    const { result, loads } = await placedBy(
      [row({ wall: 'back', alignment: 'right' })],
      {
        existing: [
          makeGroup({
            id: 'g7',
            pos: [3200, 0, -3000],
            roots: [makeRoot({ attributes: BASE_UNIT_ATTRIBUTES })],
          }),
        ],
      }
    );
    expect(loads[1][0].repositioningData).toMatchObject({
      posGroup: [2400, 0, -3000],
      posRotationY: 0,
    });
    expect(result.corrections).toEqual([
      "posGroups[0]: group 'new-1' would overlap group 'g7' at the top wall - it was moved 800 mm along the " +
        'wall to stand beside it. If the units belong together, join the groups with merge-groups',
    ]);
  });

  it('counts the other new groups of the call at their targets, not where the planner first put them', async () => {
    // the planner puts every new group into the back left corner, where the
    // first one goes
    const { result, loads } = await placedBy(
      [
        row({ wall: 'back', alignment: 'left' }),
        row({ wall: 'back', alignment: 'left' }),
      ],
      { arrival: [0, 0, -3000] }
    );
    expect(
      loads[1].map((group: any) => [group.id, group.repositioningData.posGroup])
    ).toEqual([
      ['new-1', [0, 0, -3000]],
      ['new-2', [800, 0, -3000]],
    ]);
    expect(result.corrections).toEqual([
      expect.stringMatching(
        /^posGroups\[1\]: group 'new-2' would overlap group 'new-1' at the top wall - it was moved 800 mm/
      ),
    ]);
  });

  it('places one group by wall and another by point in one call', async () => {
    const { loads } = await placedBy([
      row({ posGroup: [4000, 0, -3000], posRotationY: 270 }),
      row({ wall: 'back' }),
    ]);
    // the probe, the load of both, the reload of the group placed by wall
    expect(loads).toHaveLength(3);
    expect(loads[0][0].roots[0].id).toBe('anchor-probe');
    expect(loads[1][0].repositioningData).toMatchObject({
      posGroup: [4000, 0, -3000],
      posRotationY: 270,
    });
    expect(loads[1][1]).not.toHaveProperty('repositioningData');
    expect(loads[2].map((group: any) => group.id)).toEqual(['new-2']);
    expect(loads[2][0].repositioningData).toMatchObject({
      posGroup: [1600, 0, -3000],
      posRotationY: 0,
    });
  });

  it('keeps each new group matched to its input when the planner lists a reloaded group last', async () => {
    const { api } = await placedBy(
      [
        row(
          { wall: 'back' },
          { attributes: [{ id: 'front', value: 'white' }] }
        ),
        { libraryId: 'lib-1', roots: [pick()] },
      ],
      { reloadedLast: true }
    );
    expect(api.extended.externalObjectGroupOperation).toHaveBeenCalledTimes(1);
    expect(api.extended.externalObjectGroupOperation).toHaveBeenCalledWith(
      'change-attributes',
      {
        groupId: 'new-1',
        attributes: [{ attributeId: 'front', value: 'white' }],
      }
    );
  });

  it('builds a new group without its placement when the room has no such wall, and says so', async () => {
    for (const [placement, message] of [
      [
        { wall: 9 },
        /^posGroups\[0\]: Wall '9' not found\. .* Available walls: \[.*\]/,
      ],
      [
        { wall: 'back', roomIndex: 3 },
        /^posGroups\[0\]: Room index 3 not found - the plan has 1 room\(s\)/,
      ],
    ] as const) {
      const { result, loads } = await placedBy([row(placement)]);
      expect(loads).toHaveLength(1);
      expect(loads[0]).toEqual([{ libraryId: 'lib-1', roots: [pick()] }]);
      expect(result.corrections).toEqual([expect.stringMatching(message)]);
      expect(result.corrections[0]).toMatch(
        /[^.] - the placement was not used, so the planner positions the group$/
      );
    }
  });

  it('reads a wall placement it can partly use with its defaults, and says so', async () => {
    let { result, loads } = await placedBy([
      row({
        wall: 'back',
        alignment: 'diagonal',
        offsetMm: 'far',
        roomIndex: -1,
      }),
    ]);
    expect(loads[1][0].repositioningData).toMatchObject({
      posGroup: [1600, 0, -3000],
      posRotationY: 0,
    });
    expect(result.corrections).toEqual([
      'posGroups[0]: the placement\'s alignment "diagonal" is not center, end, start or the side label of an adjoining wall - the group was centred',
      'posGroups[0]: the placement\'s offsetMm "far" is not a number of millimetres - 0 was used',
      "posGroups[0]: the placement's roomIndex -1 is not a room index - room 0 was used",
    ]);

    for (const wall of [{}, 'middle', -1]) {
      ({ result, loads } = await placedBy([row({ wall })]));
      expect(loads).toHaveLength(1);
      expect(result.corrections).toEqual([
        `posGroups[0]: the placement's wall ${JSON.stringify(wall)} is neither a side label (left, right, back, ` +
          'front) nor a wall index - it was not used, so the planner positions the group (an existing group ' +
          'keeps its position)',
      ]);
    }
  });

  it('uses the wall when a placement names a wall and a point, and says so', async () => {
    const { result, loads } = await placedBy([
      row({ wall: 'back', posGroup: [0, 0, 0], posRotationY: 90, scale: 2 }),
    ]);
    expect(loads).toHaveLength(2);
    expect(loads[0][0]).not.toHaveProperty('repositioningData');
    expect(loads[1][0].repositioningData).toMatchObject({
      posGroup: [1600, 0, -3000],
      posRotationY: 0,
    });
    expect(result.corrections).toEqual([
      'posGroups[0]: the placement names a wall and a point - the wall was used, posGroup, posRotationY dropped',
      'posGroups[0]: the placement takes wall, alignment, offsetMm and roomIndex, or posGroup, posRotationY and rootId - scale dropped',
    ]);
  });

  it('centres a new group when the alignment runs parallel to the wall', async () => {
    const { result, loads } = await placedBy([
      row({ wall: 'back', alignment: 'front' }),
    ]);
    expect(loads[1][0].repositioningData).toMatchObject({
      posGroup: [1600, 0, -3000],
    });
    expect(result.corrections).toEqual([
      "posGroups[0]: the alignment 'bottom' runs parallel to the top wall - the group was centred on the wall instead",
    ]);
  });

  it('leaves a new group it cannot place where the planner put it, and says so', async () => {
    let { result, loads } = await placedBy([row({ wall: 'back' })], {
      uncalculated: true,
    });
    expect(loads).toHaveLength(1);
    expect(result.corrections).toEqual([
      "posGroups[0]: group 'new-1' has no calculated geometry - it was not placed at the top wall; " +
        'place-group moves it once it is calculated',
    ]);

    ({ result, loads } = await placedBy([row({ wall: 'back' })], {
      reloadFails: true,
    }));
    expect(loads).toHaveLength(2);
    expect(result.corrections).toEqual([
      "posGroups[0]: group 'new-1' was not moved to the top wall - the planner did not reload it there; " +
        'place-group moves it',
    ]);
  });

  it('names each group the reload left where it was, also when the planner reloaded the others', async () => {
    // the load answers with runtime ids, so the server checks where each
    // group stands
    const { result, loads } = await placedBy(
      [
        row({ wall: 'back', alignment: 'left' }),
        row({ wall: 'back', alignment: 'right' }),
      ],
      { reloadFailsFor: ['new-1'] }
    );
    expect(loads[1].map((group: any) => group.id)).toEqual(['new-1', 'new-2']);
    expect(result.corrections).toEqual([
      "posGroups[0]: group 'new-1' was not moved to the top wall - the planner did not reload it there; " +
        'place-group moves it',
    ]);
  });

  it('moves no group by wall when the planner built more or fewer new groups than the call sent, and says so', async () => {
    // the planner leaves out the first group: paired by order, the second
    // group would take the first one's wall
    const { result, loads } = await placedBy(
      [row({ wall: 'left' }), row({ wall: 'back' })],
      { omitted: [0] }
    );
    expect(loads).toHaveLength(1);
    expect(result.corrections).toEqual(
      [0, 1].map((index) =>
        expect.stringMatching(
          new RegExp(
            `^posGroups\\[${index}\\]: the planner built 1 new groups for the 2 of the call, so the server ` +
              'cannot tell which one this group became - it was not placed at the (left|top) wall'
          )
        )
      )
    );
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
      posGroups: [{ id: hoodGroup.id, roots: [pick()] }],
    })) as Record<string, any>;
    expect(created.groups[0].position).toEqual(atLeftEdge);
    const changed = (await toolExecutors['delete-article-in-place'](api, {
      rootModuleId: 'h1',
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
    ['delete-group', { groupId: 'kitchen-2' }, { groupId: 'kitchen-2' }],
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
      'exchange-root-module',
      {
        groupId: 'kitchen-1',
        rootModuleId: 'r1',
        articleId: 'article-1',
        attributes: [{ id: 'b', value: 900 }],
      },
      {
        groupId: 'kitchen-1',
        rootModuleId: 'r1',
        articleId: 'article-1',
        attributes: [{ id: 'b', value: 900 }],
      },
    ],
    [
      'merge-groups',
      { targetGroupId: 'kitchen-1', groupIds: ['kitchen-2', 'island'] },
      { targetGroupId: 'kitchen-1', groupIds: ['kitchen-2', 'island-1'] },
    ],
    [
      'swap-root-modules',
      { groupId: 'island', rootModuleIds: ['r1', 'unit-2'] },
      { groupId: 'island-1', rootModuleIds: ['r1', 'unit-2'] },
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

  describe('attribute tools', () => {
    const kitchenAndIsland = {
      ...planContextFixture,
      groups: [
        makeShapedGroup({
          id: 'kitchen-1',
          roots: ['u1', 'u2', 'u3'].map((id) => makeShapedRoot({ id })),
        }),
        makeShapedGroup({
          id: 'island-1',
          roots: [makeShapedRoot({ id: 'i1' })],
        }),
      ],
    };
    // the planner answers with the group of the command and the root modules
    // it was given
    const attributeApi = (overrides: Record<string, unknown> = {}) =>
      createApi(kitchenAndIsland, {
        externalObjectGroupOperation: vi.fn(
          async (command: string, payload: any) => ({
            command,
            groups: kitchenAndIsland.groups.filter(
              (group) =>
                group.id === payload.groupId ||
                group.roots.some((root) => root.id === payload.rootModuleId)
            ),
            removedGroupIds: [],
            changedModuleIds:
              payload.attributes?.[0]?.rootModuleIds ??
              (payload.rootModuleId ? [] : ['u1', 'u2', 'u3']),
          })
        ),
        ...overrides,
      });
    const commandsOf = (api: ReturnType<typeof createApi>) =>
      api.extended.externalObjectGroupOperation.mock.calls;

    it('sets an attribute on several root modules of one group in one planner command', async () => {
      const api = attributeApi();
      const result = await toolExecutors['change-module-attribute'](api, {
        rootModuleIds: ['u1', 'u3'],
        attributeId: 'front',
        value: 'black',
      });
      expect(commandsOf(api)).toEqual([
        [
          'change-attributes',
          {
            groupId: 'kitchen-1',
            attributes: [
              {
                attributeId: 'front',
                value: 'black',
                rootModuleIds: ['u1', 'u3'],
              },
            ],
          },
        ],
      ]);
      expect(result).toEqual({
        command: 'change-module-attribute',
        groupIds: ['kitchen-1'],
        changedModuleIds: ['u1', 'u3'],
      });
    });

    it('sends one planner command per group for root modules of several groups', async () => {
      const api = attributeApi();
      const result = await toolExecutors['change-module-attribute'](api, {
        rootModuleIds: ['u1', 'i1', 'u2'],
        attributeId: 'front',
        value: 900,
      });
      expect(commandsOf(api)).toEqual([
        [
          'change-attributes',
          {
            groupId: 'kitchen-1',
            attributes: [
              {
                attributeId: 'front',
                value: '900',
                rootModuleIds: ['u1', 'u2'],
              },
            ],
          },
        ],
        [
          'change-attributes',
          {
            groupId: 'island-1',
            attributes: [
              { attributeId: 'front', value: '900', rootModuleIds: ['i1'] },
            ],
          },
        ],
      ]);
      expect(result).toEqual({
        command: 'change-module-attribute',
        groupIds: ['kitchen-1', 'island-1'],
        changedModuleIds: ['u1', 'u2', 'i1'],
      });
    });

    it('reads a single rootModuleId as a list of one', async () => {
      const api = attributeApi();
      await toolExecutors['change-module-attribute'](api, {
        rootModuleId: 'u2',
        attributeId: 'front',
        value: 'white',
      });
      expect(commandsOf(api)).toEqual([
        [
          'change-attributes',
          {
            groupId: 'kitchen-1',
            attributes: [
              { attributeId: 'front', value: 'white', rootModuleIds: ['u2'] },
            ],
          },
        ],
      ]);
    });

    it('sets the sub module of every root module with moduleId, one command each', async () => {
      const api = attributeApi();
      await toolExecutors['change-module-attribute'](api, {
        rootModuleIds: ['u1', 'i1'],
        moduleId: 'front-1',
        attributeId: 'front',
        value: 'white',
      });
      expect(commandsOf(api)).toEqual([
        [
          'change-module-attribute',
          {
            rootModuleId: 'u1',
            moduleId: 'front-1',
            attributeId: 'front',
            value: 'white',
          },
        ],
        [
          'change-module-attribute',
          {
            rootModuleId: 'i1',
            moduleId: 'front-1',
            attributeId: 'front',
            value: 'white',
          },
        ],
      ]);
    });

    it('names a group once when the commands of several of its root modules changed it', async () => {
      const api = attributeApi();
      const result = await toolExecutors['change-module-attribute'](api, {
        rootModuleIds: ['u1', 'u3'],
        moduleId: 'front-1',
        attributeId: 'front',
        value: 'white',
      });
      expect(commandsOf(api)).toHaveLength(2);
      expect(result).toEqual({
        command: 'change-module-attribute',
        groupIds: ['kitchen-1'],
      });
    });

    it('answers an attribute change with the changed groups and modules, not the whole group', async () => {
      const api = attributeApi();
      const result = await toolExecutors['change-group-attribute'](api, {
        groupId: 'kitchen',
        attributeId: 'front',
        value: 'white',
      });
      expect(commandsOf(api)).toEqual([
        [
          'change-group-attribute',
          { groupId: 'kitchen-1', attributeId: 'front', value: 'white' },
        ],
      ]);
      expect(result).toEqual({
        command: 'change-group-attribute',
        groupIds: ['kitchen-1'],
        changedModuleIds: ['u1', 'u2', 'u3'],
      });
    });

    it('sets several attributes of a group with one planner command, the programs first', async () => {
      const api = attributeApi();
      const result = await toolExecutors['change-group-attribute'](api, {
        groupId: 'kitchen-1',
        attributes: [
          { attributeId: 'front', value: 'black' },
          { attributeId: 'mod_FrontProgram', value: 'Modern' },
          { attributeId: 'handle', value: 0 },
        ],
      });
      expect(commandsOf(api)).toEqual([
        [
          'change-attributes',
          {
            groupId: 'kitchen-1',
            attributes: [
              { attributeId: 'mod_FrontProgram', value: 'Modern' },
              { attributeId: 'front', value: 'black' },
              { attributeId: 'handle', value: '0' },
            ],
          },
        ],
      ]);
      expect(result).toEqual({
        command: 'change-group-attribute',
        groupIds: ['kitchen-1'],
        changedModuleIds: ['u1', 'u2', 'u3'],
      });
    });

    it('asks for the value of an attribute sent without one, and sends nothing', async () => {
      const api = attributeApi();
      await expect(
        toolExecutors['change-group-attribute'](api, {
          groupId: 'kitchen-1',
          attributeId: 'front',
        })
      ).rejects.toThrow(
        'change-group-attribute: name the attribute with attributeId and value, or several with attributes [{ attributeId, value }].'
      );
      expect(commandsOf(api)).toEqual([]);
    });

    it('names an attribute of the list that no module of the group has', async () => {
      const api = attributeApi({
        externalObjectGroupOperation: vi.fn(async (command: string) => ({
          command,
          groups: [kitchenAndIsland.groups[0]],
          removedGroupIds: [],
          skippedAttributes: [{ attributeId: 'backsplash' }],
        })),
      });
      const result: any = await toolExecutors['change-group-attribute'](api, {
        groupId: 'kitchen-1',
        attributes: [
          { attributeId: 'front', value: 'black' },
          { attributeId: 'backsplash', value: 'grey' },
        ],
      });
      expect(result.corrections).toEqual([
        "change-group-attribute: no module of group 'kitchen-1' has the attribute 'backsplash' - it was not set",
      ]);
    });

    it('asks for the attribute when none is named', async () => {
      await expect(
        toolExecutors['change-group-attribute'](attributeApi(), {
          groupId: 'kitchen-1',
        })
      ).rejects.toThrow(
        'change-group-attribute: name the attribute with attributeId and value, or several with attributes [{ attributeId, value }].'
      );
    });

    it('reads a root id sent as the group id as the group that holds the root module', async () => {
      const api = attributeApi();
      const result: any = await toolExecutors['change-group-attribute'](api, {
        groupId: 'u2',
        attributeId: 'front',
        value: 'white',
      });
      expect(((commandsOf(api)[0] as any[])[1] as any).groupId).toBe(
        'kitchen-1'
      );
      expect(result.corrections).toEqual([
        "change-group-attribute: 'u2' names a root module, not a group - the command ran on its group 'kitchen-1'",
      ]);
    });

    it('reads a unique prefix of a root id as the group that holds the root module', async () => {
      const api = createApi({
        ...planContextFixture,
        groups: [
          makeShapedGroup({
            id: 'g-1',
            roots: [makeShapedRoot({ id: '7f3a-root' })],
          }),
          makeShapedGroup({ id: 'g-2' }),
        ],
      });
      const result: any = await toolExecutors['delete-group'](api, {
        groupId: '7f3a',
      });
      expect(commandsOf(api)).toEqual([['delete-group', { groupId: 'g-1' }]]);
      expect(result.corrections).toEqual([
        "delete-group: '7f3a' names a root module, not a group - the command ran on its group 'g-1'",
      ]);
    });

    it('still names the groups of the plan for an id that names no group and no root module', async () => {
      await expect(
        toolExecutors['delete-group'](attributeApi(), { groupId: 'nothing' })
      ).rejects.toThrow(
        "Group 'nothing' not found. Groups in the plan: kitchen-1, island-1."
      );
    });

    it('changes the root modules the planner takes and names the others', async () => {
      const api = attributeApi({
        externalObjectGroupOperation: vi.fn(
          async (command: string, payload: any) => {
            if (payload.groupId === 'island-1') {
              throw new Error(
                "No module of root module 'i1' has the attribute 'front'."
              );
            }
            return {
              command,
              groups: [kitchenAndIsland.groups[0]],
              removedGroupIds: [],
              changedModuleIds: ['u1'],
            };
          }
        ),
      });
      const result = await toolExecutors['change-module-attribute'](api, {
        rootModuleIds: ['u1', 'i1', 'x9'],
        attributeId: 'front',
        value: 'white',
      });
      expect(result).toEqual({
        command: 'change-module-attribute',
        groupIds: ['kitchen-1'],
        changedModuleIds: ['u1'],
        corrections: [
          "change-module-attribute: root module 'x9' is not in the plan - it was not changed",
          "change-module-attribute: root module 'i1' kept its value - No module of root module 'i1' has the attribute 'front'.",
        ],
      });
    });

    it("rejects with the planner's reason when its only command is refused", async () => {
      const api = attributeApi({
        externalObjectGroupOperation: vi.fn(async () => {
          throw new Error(
            "No module of root module 'u1' has the attribute 'nope'."
          );
        }),
      });
      await expect(
        toolExecutors['change-module-attribute'](api, {
          rootModuleIds: ['u1'],
          attributeId: 'nope',
          value: 'x',
        })
      ).rejects.toThrow(
        "No module of root module 'u1' has the attribute 'nope'."
      );
      await expect(
        toolExecutors['change-module-attribute'](api, {
          attributeId: 'front',
          value: 'x',
        })
      ).rejects.toThrow(
        'change-module-attribute: name the root modules that get the value in rootModuleIds.'
      );
    });
  });

  it.each([
    [
      'delete-article-in-place',
      'delete-root-module',
      { rootModuleId: 'r1' },
      { rootModuleId: 'r1' },
    ],
    [
      'delete-article-and-compact',
      'remove-article-from-group',
      { groupId: 'kitchen-2', rootModuleId: 'r1' },
      { groupId: 'kitchen-2', rootModuleId: 'r1' },
    ],
  ])(
    '%s forwards the planner command %s and names itself in the result',
    async (tool, command, args, payload) => {
      const api = createApi(planWithGroups);

      await expect(toolExecutors[tool](api, args)).resolves.toEqual({
        command: tool,
        groups: [],
        removedGroupIds: [],
      });
      expect(api.extended.externalObjectGroupOperation).toHaveBeenCalledWith(
        command,
        payload
      );
    }
  );

  it.each([
    ['delete-article-in-place', { rootModuleId: 'r1' }],
    [
      'delete-article-and-compact',
      { groupId: 'kitchen-2', rootModuleId: 'r1' },
    ],
  ])(
    '%s names itself, not the planner command, in the corrections of the planner',
    async (tool, args) => {
      const api = createApi(planWithGroups, {
        externalObjectGroupOperation: vi.fn(async (command: string) => ({
          command,
          groups: [],
          removedGroupIds: [],
          corrections: ['the planner corrected something'],
        })),
      });

      const result = (await toolExecutors[tool](api, args)) as Record<
        string,
        any
      >;

      expect(result.command).toBe(tool);
      expect(result.corrections).toEqual([
        `${tool}: the planner corrected something`,
      ]);
    }
  );

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
    [
      'insert-article-into-group',
      { groupId: 'hall', articleId: 'article-1', between: ['r1', 'r2'] },
    ],
    ['swap-root-modules', { groupId: 'kitchen', rootModuleIds: ['r1', 'r2'] }],
    ['delete-article-and-compact', { groupId: 'hall', rootModuleId: 'r1' }],
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

    it('docks a unit on a taken side of a root with both sides taken to the free end of that row', async () => {
      const { result, dockTo: sent } = await merge(row(), {
        ...dockTo,
        rootId: 'r2',
      });
      expect(sent).toEqual({ ...dockTo, rootId: 'r3' });
      expect(result.corrections).toEqual([
        "merge-article-into-group: the RightBottom of root 'r2' is taken - the unit was docked to the RightBottom of 'r3', the free end of that row",
      ]);
    });

    it("docks a unit on the taken side of a row end to the far end, or to that root's free side when the far end leaves the room", async () => {
      // without the calculated group, the direction the agent named wins
      const atStart = await merge(row(), dockTo);
      expect(atStart.dockTo).toEqual({ ...dockTo, rootId: 'r3' });
      expect(atStart.result.corrections).toEqual([
        "merge-article-into-group: the RightBottom of root 'r1' is taken - the unit was docked to the RightBottom of 'r3', the free end of that row",
      ]);

      // issue 1: the row stands on the right wall from the back corner, so
      // the far end of r3's LeftBottom - r1 - is at the back wall
      const rawRow = {
        id: 'kitchen-1',
        pos: [4000, 0, -3000],
        rotationY: 270,
        roots: ['r1', 'r2', 'r3'].map((id, index) => ({
          id,
          articlePos: [index * 600, 0, 0],
          rotationY: 0,
          attributes: [
            { id: 'b', value: 600 },
            { id: 't', value: 600 },
          ],
        })),
      };
      const mergeOnTheWall = async (sent: Record<string, unknown>) => {
        const api = createApi(
          { ...planContextFixture, groups: [row()] },
          { getExternalObjectGroups: vi.fn(async () => [rawRow]) }
        );
        const result = (await toolExecutors['merge-article-into-group'](api, {
          groupId: 'kitchen-1',
          articleId: 'article-1',
          dockTo: sent,
        })) as Record<string, any>;
        const [, payload] = (
          api.extended.externalObjectGroupOperation.mock
            .calls as unknown as any[][]
        )[0];
        return { result, dockTo: payload.dockTo };
      };
      const atTheBackWall = await mergeOnTheWall({
        rootId: 'r3',
        ownDockingVector: 'LeftBottom',
        dockingVector: 'RightBottom',
      });
      expect(atTheBackWall.dockTo).toEqual({ ...dockTo, rootId: 'r3' });
      expect(atTheBackWall.result.corrections).toEqual([
        "merge-article-into-group: the LeftBottom of root 'r3' is taken - the unit was docked to its free RightBottom (a unit at the LeftBottom of 'r1', the free end of that row would stand outside the room)",
      ]);
      // gpt-5.4-mini 12 of 2026-10-04: the back unit's taken RightBottom
      // means the front end, which stays inside the room
      const towardsTheFront = await mergeOnTheWall(dockTo);
      expect(towardsTheFront.dockTo).toEqual({ ...dockTo, rootId: 'r3' });
    });

    it('tests the row end against the room the group stands in', async () => {
      // review of PR 62: a second room 10 m to the right; the row stands in
      // it, and the far end of the row is inside that room only
      const roomB = {
        ...room,
        walls: room.walls.map((wall) => ({
          ...wall,
          start: [wall.start[0] + 10000, 0, wall.start[2]],
          end: [wall.end[0] + 10000, 0, wall.end[2]],
        })),
      };
      const rawRow = {
        id: 'kitchen-1',
        pos: [14000, 0, -3000],
        rotationY: 270,
        roots: ['r1', 'r2', 'r3'].map((id, index) => ({
          id,
          articlePos: [index * 600, 0, 0],
          rotationY: 0,
          attributes: [
            { id: 'b', value: 600 },
            { id: 't', value: 600 },
          ],
        })),
      };
      const api = createApi(
        {
          ...planContextFixture,
          rooms: { rooms: [room, roomB] },
          groups: [row()],
        },
        { getExternalObjectGroups: vi.fn(async () => [rawRow]) }
      );
      const result = (await toolExecutors['merge-article-into-group'](api, {
        groupId: 'kitchen-1',
        articleId: 'article-1',
        dockTo,
      })) as Record<string, any>;
      const [, payload] = (
        api.extended.externalObjectGroupOperation.mock
          .calls as unknown as any[][]
      )[0];
      expect(payload.dockTo).toEqual({ ...dockTo, rootId: 'r3' });
      expect(result.corrections).toEqual([
        "merge-article-into-group: the RightBottom of root 'r1' is taken - the unit was docked to the RightBottom of 'r3', the free end of that row",
      ]);
    });

    it('stops the walk at a corner article and docks to the free end of the leg', async () => {
      // b0 -> b1 -> c along RightBottom: b1 stands on the corner's left leg
      const cornerArticle = {
        ...articleFixture,
        articleId: 'corner-1',
        cornerArticle: true,
      };
      const leg = makeShapedGroup({
        id: 'kitchen-1',
        roots: [
          makeShapedRoot({
            id: 'c',
            articleId: 'corner-1',
            freeDockingVectors: ['RightBottom'],
            contextData: {
              dockedRoots: [
                {
                  ownDockingVector: 'LeftBottom',
                  dockedRoots: [{ id: 'b1', dockingVector: 'RightBottom' }],
                },
              ],
            },
          }),
          makeShapedRoot({
            id: 'b1',
            freeDockingVectors: [],
            contextData: {
              dockedRoots: [
                {
                  ownDockingVector: 'RightBottom',
                  dockedRoots: [{ id: 'c', dockingVector: 'LeftBottom' }],
                },
                {
                  ownDockingVector: 'LeftBottom',
                  dockedRoots: [{ id: 'b0', dockingVector: 'RightBottom' }],
                },
              ],
            },
          }),
          makeShapedRoot({
            id: 'b0',
            freeDockingVectors: ['LeftBottom'],
            contextData: {
              dockedRoots: [
                {
                  ownDockingVector: 'RightBottom',
                  dockedRoots: [{ id: 'b1', dockingVector: 'LeftBottom' }],
                },
              ],
            },
          }),
        ],
      });
      const { result, dockTo: sent } = await merge(
        leg,
        { ...dockTo, rootId: 'b1' },
        [articleFixture, cornerArticle]
      );
      expect(sent).toEqual({
        rootId: 'b0',
        ownDockingVector: 'LeftBottom',
        dockingVector: 'RightBottom',
      });
      expect(result.corrections).toEqual([
        "merge-article-into-group: the RightBottom of root 'b1' is taken - the unit was docked to the LeftBottom of 'b0', the free end of its leg (the row ends at the corner article 'c')",
      ]);
    });

    // issue 10: a wall unit merged on top of a floor unit hangs at the height
    // of the wall units; the catalog gives the heights
    const wallUnitArticle = {
      ...articleFixture,
      articleId: 'wall-1',
      category: 'Kitchen | Wall Units | Storage',
      rootModules: [
        {
          module: { id: 'mr_Wall' },
          dimensions: [{ id: 'mod_Height', name: 'Height', value: 720 }],
        },
      ],
    };
    const tallUnitArticle = {
      ...articleFixture,
      articleId: 'tall-1',
      category: 'Kitchen | Tall Units | Storage',
      rootModules: [
        {
          module: { id: 'mr_Tall' },
          dimensions: [{ id: 'mod_Height', name: 'Height', value: 2100 }],
        },
      ],
    };
    const mergeWallUnit = async (
      carrier: Record<string, unknown>,
      dockTo: Record<string, unknown>
    ) => {
      const api = createApi({
        ...planContextFixture,
        articles: [articleFixture, wallUnitArticle, tallUnitArticle],
        groups: [
          makeShapedGroup({
            id: 'kitchen-1',
            roots: [makeShapedRoot(carrier)],
          }),
        ],
      });
      const result = (await toolExecutors['merge-article-into-group'](api, {
        groupId: 'kitchen-1',
        articleId: 'wall-1',
        dockTo,
      })) as Record<string, any>;
      const [, payload] = (
        api.extended.externalObjectGroupOperation.mock
          .calls as unknown as any[][]
      )[0];
      return { result, dockTo: payload.dockTo };
    };
    const onTop = {
      rootId: 'r1',
      ownDockingVector: 'LeftTop',
      dockingVector: 'LeftBottom',
    };
    const baseUnit = {
      attributes: [{ id: 'mod_Height', value: 720 }],
      freeDockingVectors: ['LeftTop'],
    };

    it("hangs a wall unit merged on a floor unit's top vector at the height of the wall units", async () => {
      const { result, dockTo: sent } = await mergeWallUnit(baseUnit, onTop);
      expect(sent).toEqual({ ...onTop, offset: [0, 660, 0] });
      expect(result.corrections).toEqual([
        "merge-article-into-group: 'wall-1' hangs 660 mm above 'r1', at the height of the wall units",
      ]);
    });

    it('reads a Top-to-Top pair of a wall unit on a floor unit as hanging above it', async () => {
      // gpt-5-mini 08 of 2026-10-04: LeftTop -> RightTop put the wall unit at floor level
      const { result, dockTo: sent } = await mergeWallUnit(baseUnit, {
        ...onTop,
        dockingVector: 'RightTop',
      });
      expect(sent).toEqual({ ...onTop, offset: [0, 660, 0] });
      expect(result.corrections).toEqual([
        "merge-article-into-group: a wall unit above 'r1' meets its LeftTop with its LeftBottom, not with its RightTop",
        "merge-article-into-group: 'wall-1' hangs 660 mm above 'r1', at the height of the wall units",
      ]);
    });

    it('keeps an explicit offset of a wall unit above a floor unit', async () => {
      const { result, dockTo: sent } = await mergeWallUnit(baseUnit, {
        ...onTop,
        offset: [0, 500, 0],
      });
      expect(sent).toEqual({ ...onTop, offset: [0, 500, 0] });
      expect(result).not.toHaveProperty('corrections');
    });

    it('adds no gap on top of a tall unit', async () => {
      const { result, dockTo: sent } = await mergeWallUnit(
        { ...baseUnit, articleId: 'tall-1' },
        onTop
      );
      expect(sent).toEqual(onTop);
      expect(result).not.toHaveProperty('corrections');
    });

    it('forwards a side the planner reports as taken although the row ends there', async () => {
      // r3 still names a deleted unit on its RightBottom
      const stale = row([
        {
          ownDockingVector: 'RightBottom',
          dockedRoots: [{ id: 'deleted', dockingVector: 'LeftBottom' }],
        },
      ]);
      const fromMiddle = { ...dockTo, rootId: 'r2' };
      const { result, dockTo: sent } = await merge(stale, fromMiddle);
      expect(sent).toEqual(fromMiddle);
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

  describe('root module ids', () => {
    // issue 8: the models mistype root ids
    const first = 'aaaa1111-bbbb-cccc-dddd-eeee';
    const second = 'ffff2222-9999-cccc-dddd-eeee';
    const uuidPlan = {
      ...planContextFixture,
      groups: [
        makeShapedGroup({
          id: 'kitchen-1',
          roots: [
            makeShapedRoot({ id: first }),
            makeShapedRoot({ id: second }),
          ],
        }),
      ],
    };

    it.each([
      ['a unique prefix', 'aaaa1111'],
      ['its last segments', 'aaaa1119-bbbb-cccc-dddd-eeee'],
      ['one character', 'aaaa1111-bbbb-cccc-dddd-eeef'],
    ])('resolves a root id by %s and reports it', async (_, sent) => {
      const api = createApi(uuidPlan);
      const result = (await toolExecutors['change-module-attribute'](api, {
        rootModuleId: sent,
        attributeId: 'b',
        value: '900',
      })) as Record<string, any>;
      expect(api.extended.externalObjectGroupOperation).toHaveBeenCalledWith(
        'change-attributes',
        {
          groupId: 'kitchen-1',
          attributes: [
            { attributeId: 'b', value: '900', rootModuleIds: [first] },
          ],
        }
      );
      expect(result.corrections).toEqual([
        `change-module-attribute: root id '${sent}' was read as '${first}'`,
      ]);
    });

    it('resolves every root id of the list', async () => {
      const api = createApi(uuidPlan);
      const result = (await toolExecutors['change-module-attribute'](api, {
        rootModuleIds: ['aaaa1111', 'ffff2222'],
        attributeId: 'b',
        value: '900',
      })) as Record<string, any>;
      expect(api.extended.externalObjectGroupOperation).toHaveBeenCalledWith(
        'change-attributes',
        {
          groupId: 'kitchen-1',
          attributes: [
            { attributeId: 'b', value: '900', rootModuleIds: [first, second] },
          ],
        }
      );
      expect(result.corrections).toEqual([
        `change-module-attribute: root id 'aaaa1111' was read as '${first}'`,
        `change-module-attribute: root id 'ffff2222' was read as '${second}'`,
      ]);
    });

    it('forwards a root id that matches nothing and adds the roots of the plan to the answer', async () => {
      const api = createApi(uuidPlan, {
        externalObjectGroupOperation: vi.fn(async () => {
          throw new Error("Root module 'x' not found.");
        }),
      });
      await expect(
        toolExecutors['delete-article-in-place'](api, { rootModuleId: 'x' })
      ).rejects.toThrow(
        `Root module 'x' not found. Roots in the plan: ${first}, ${second}`
      );
      expect(api.extended.externalObjectGroupOperation).toHaveBeenCalledWith(
        'delete-root-module',
        { rootModuleId: 'x' }
      );
    });

    it('forwards an empty root id as sent instead of taking it as a prefix', async () => {
      // review of PR 62: '' is a prefix of every id, so a plan with one root
      // would have resolved a delete-article-in-place with an empty id to it
      const api = createApi(uuidPlan, {
        externalObjectGroupOperation: vi.fn(async () => {
          throw new Error("Root module '' not found.");
        }),
      });
      await expect(
        toolExecutors['delete-article-in-place'](api, { rootModuleId: '' })
      ).rejects.toThrow("Root module '' not found. Roots in the plan:");
      expect(api.extended.externalObjectGroupOperation).toHaveBeenCalledWith(
        'delete-root-module',
        { rootModuleId: '' }
      );
    });

    it('resolves the root of dockTo in merge-article-into-group', async () => {
      const api = createApi({
        ...planContextFixture,
        groups: [makeShapedGroup({ id: 'kitchen-1' })],
      });
      const result = (await toolExecutors['merge-article-into-group'](api, {
        groupId: 'kitchen-1',
        articleId: 'article-1',
        dockTo: { ...dockTo, rootId: 'r2' },
      })) as Record<string, any>;
      const [, payload] = (
        api.extended.externalObjectGroupOperation.mock
          .calls as unknown as any[][]
      )[0];
      expect(payload.dockTo).toEqual(dockTo);
      expect(result.corrections).toEqual([
        "merge-article-into-group: root id 'r2' was read as 'r1'",
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

  describe('library changes', () => {
    const wallUnits = (attributes: Record<string, string>[]) =>
      makeShapedGroup({
        id: 'g1',
        roots: attributes.map((unit, index) => wallUnit(`w${index + 1}`, unit)),
      });
    // the group in the plan before the command, the group the planner returns
    const libraryApi = (
      before: any,
      after: any,
      plannerCorrections?: string[]
    ) =>
      createApi(
        {
          ...planContextFixture,
          groups: [before],
          masterData: frontMasterData,
        },
        {
          externalObjectGroupOperation: vi.fn(async (command: string) => ({
            command,
            groups: [after],
            removedGroupIds: [],
            ...(plannerCorrections && { corrections: plannerCorrections }),
          })),
        }
      );
    const classic = { mod_FrontProgram: 'Classic', mod_FrontColor: '152' };
    const modern = { mod_FrontProgram: 'Modern', mod_FrontColor: '324' };
    const switched =
      'with mod_FrontColor "324" (Dark marble (#404040)) the library changed mod_FrontProgram of ' +
      'root module \'w1\' (OTB60) from "Classic" (Simple fronts in plain decors) to "Modern" ' +
      '(Mitred frame fronts with glass filling)';

    it('names the front program the library switched with a front colour', async () => {
      const api = libraryApi(wallUnits([classic]), wallUnits([modern]));
      const result = (await toolExecutors['change-module-attribute'](api, {
        rootModuleId: 'w1',
        attributeId: 'mod_FrontColor',
        value: '324',
      })) as Record<string, any>;
      expect(result.corrections).toEqual([
        `change-module-attribute: ${switched}`,
      ]);
    });

    it('names a value the library set on a root module without one', async () => {
      const api = libraryApi(
        wallUnits([{ mod_FrontColor: '152' }]),
        wallUnits([modern])
      );
      const result = (await toolExecutors['change-module-attribute'](api, {
        rootModuleId: 'w1',
        attributeId: 'mod_FrontColor',
        value: '324',
      })) as Record<string, any>;
      expect(result.corrections).toEqual([
        'change-module-attribute: with mod_FrontColor "324" (Dark marble (#404040)) the library changed ' +
          'mod_FrontProgram of root module \'w1\' (OTB60) to "Modern" (Mitred frame fronts with glass filling)',
      ]);
    });

    it('names the root modules the library changed alike in one sentence', async () => {
      const api = libraryApi(
        wallUnits([classic, classic, classic]),
        wallUnits([modern, modern, modern])
      );
      const result = (await toolExecutors['change-group-attribute'](api, {
        groupId: 'g1',
        attributeId: 'mod_FrontColor',
        value: '324',
      })) as Record<string, any>;
      expect(result.corrections).toEqual([
        'change-group-attribute: with mod_FrontColor "324" (Dark marble (#404040)) the library changed ' +
          "mod_FrontProgram of root modules 'w1' (OTB60), 'w2' (OTB60), 'w3' (OTB60) from \"Classic\" " +
          '(Simple fronts in plain decors) to "Modern" (Mitred frame fronts with glass filling)',
      ]);
    });

    it('names the library changes after the corrections of the server and the planner', async () => {
      const api = libraryApi(wallUnits([classic]), wallUnits([modern]), [
        'the docking of a neighbour was dropped',
      ]);
      const result = (await toolExecutors['change-module-attribute'](api, {
        rootModuleId: 'w',
        attributeId: 'mod_FrontColor',
        value: '324',
      })) as Record<string, any>;
      expect(result.corrections).toEqual([
        "change-module-attribute: root id 'w' was read as 'w1'",
        'change-module-attribute: the docking of a neighbour was dropped',
        `change-module-attribute: ${switched}`,
      ]);
    });

    it('adds nothing when the library changed only the attribute that was set', async () => {
      const api = libraryApi(
        wallUnits([classic, { ...classic, mod_FrontColor: '190' }]),
        wallUnits([
          { ...classic, mod_FrontColor: '178' },
          { ...classic, mod_FrontColor: '190' },
        ])
      );
      const result = (await toolExecutors['change-module-attribute'](api, {
        rootModuleId: 'w1',
        attributeId: 'mod_FrontColor',
        value: '178',
      })) as Record<string, any>;
      expect(result.corrections).toBeUndefined();
    });

    it('does not take a root module for changed when the command set one of its sub modules', async () => {
      const api = libraryApi(wallUnits([classic]), wallUnits([classic]));
      const result = (await toolExecutors['change-module-attribute'](api, {
        rootModuleId: 'w1',
        moduleId: 'sub-1',
        attributeId: 'mod_FrontColor',
        value: '324',
      })) as Record<string, any>;
      expect(result.corrections).toBeUndefined();
    });

    it('names a value without a desc by the value alone', async () => {
      const api = libraryApi(
        wallUnits([classic]),
        wallUnits([{ mod_FrontProgram: 'Tuscan', mod_FrontColor: '324' }])
      );
      const result = (await toolExecutors['change-module-attribute'](api, {
        rootModuleId: 'w1',
        attributeId: 'mod_FrontColor',
        value: '324',
      })) as Record<string, any>;
      expect(result.corrections).toEqual([
        'change-module-attribute: with mod_FrontColor "324" (Dark marble (#404040)) the library changed ' +
          'mod_FrontProgram of root module \'w1\' (OTB60) from "Classic" (Simple fronts in plain decors) to "Tuscan"',
      ]);
    });
  });
});

describe('row edit tools', () => {
  // r1 -> r2 -> r3 along RightBottom, with the reciprocal entries, and r9
  // in the same group but docked to none of them
  const side = (
    ownDockingVector: string,
    id: string,
    dockingVector: string
  ) => ({
    ownDockingVector,
    dockedRoots: [{ id, dockingVector }],
  });
  const rowGroup = makeShapedGroup({
    id: 'kitchen-1',
    roots: [
      makeShapedRoot({
        id: 'r1',
        contextData: { dockedRoots: [side('RightBottom', 'r2', 'LeftBottom')] },
      }),
      makeShapedRoot({
        id: 'r2',
        contextData: {
          dockedRoots: [
            side('LeftBottom', 'r1', 'RightBottom'),
            side('RightBottom', 'r3', 'LeftBottom'),
          ],
        },
      }),
      makeShapedRoot({
        id: 'r3',
        contextData: { dockedRoots: [side('LeftBottom', 'r2', 'RightBottom')] },
      }),
      makeShapedRoot({ id: 'r9' }),
    ],
  });

  const insert = async (
    between: string[],
    extra: Record<string, unknown> = {}
  ) => {
    const api = createApi({ ...planContextFixture, groups: [rowGroup] }, extra);
    const result = (await toolExecutors['insert-article-into-group'](api, {
      groupId: 'kitchen',
      articleId: 'article-1',
      between,
    })) as Record<string, any>;
    return { api, result };
  };

  it('forwards two neighbours in either order', async () => {
    const { api, result } = await insert(['r2', 'r1']);

    expect(api.extended.externalObjectGroupOperation).toHaveBeenCalledWith(
      'insert-article-into-group',
      { groupId: 'kitchen-1', articleId: 'article-1', between: ['r2', 'r1'] }
    );
    expect(result.corrections).toBeUndefined();
  });

  it('inserts beside the first-named root, towards the second, when the two are no neighbours', async () => {
    const { api, result } = await insert(['r1', 'r3']);

    expect(api.extended.externalObjectGroupOperation).toHaveBeenCalledWith(
      'insert-article-into-group',
      expect.objectContaining({ between: ['r1', 'r2'] })
    );
    expect(result.corrections).toEqual([
      "insert-article-into-group: 'r1' and 'r3' are not neighbours - the unit was inserted between 'r1' and 'r2', the neighbour of 'r1' towards 'r3'",
    ]);
  });

  it('asks for two neighbours of one row when the two roots are in no row together', async () => {
    const api = createApi({ ...planContextFixture, groups: [rowGroup] });

    await expect(
      toolExecutors['insert-article-into-group'](api, {
        groupId: 'kitchen-1',
        articleId: 'article-1',
        between: ['r1', 'r9'],
      })
    ).rejects.toThrow(
      "insert-article-into-group: 'r1' and 'r9' are not in one row - send two neighbours of one row (the side neighbours of 'r1': r2)"
    );
    expect(api.extended.externalObjectGroupOperation).not.toHaveBeenCalled();
  });

  it("passes on the planner's corrections after its own, each named by its tool", async () => {
    const { result } = await insert(['R1', 'r2'], {
      externalObjectGroupOperation: vi.fn(async (command: string) => ({
        command,
        groups: [],
        removedGroupIds: [],
        corrections: [
          "the unit 'w1' that hung above 'r2' now hangs above 'r3'",
        ],
      })),
    });

    expect(result.corrections).toEqual([
      "insert-article-into-group: root id 'R1' was read as 'r1'",
      "insert-article-into-group: the unit 'w1' that hung above 'r2' now hangs above 'r3'",
    ]);
  });

  it('passes on that a remove deleted a unit at the end of its row, with the reason', async () => {
    const api = createApi(
      { ...planContextFixture, groups: [rowGroup] },
      {
        externalObjectGroupOperation: vi.fn(async (command: string) => ({
          command,
          groups: [],
          removedGroupIds: [],
          gapClosed: false,
          corrections: [
            "'r3' was at the end of its row - it was deleted, nothing else moved",
          ],
        })),
      }
    );

    const result = (await toolExecutors['delete-article-and-compact'](api, {
      groupId: 'kitchen-1',
      rootModuleId: 'r3',
    })) as Record<string, any>;

    expect(api.extended.externalObjectGroupOperation).toHaveBeenCalledWith(
      'remove-article-from-group',
      { groupId: 'kitchen-1', rootModuleId: 'r3' }
    );
    expect(result.gapClosed).toBe(false);
    expect(result.corrections).toEqual([
      "delete-article-and-compact: 'r3' was at the end of its row - it was deleted, nothing else moved",
    ]);
  });

  describe('delete-article-and-compact without a group id', () => {
    const islandGroup = makeShapedGroup({
      id: 'island-1',
      roots: [
        makeShapedRoot({ id: 'isl-a7' }),
        makeShapedRoot({ id: 'isl-b3' }),
      ],
    });
    const remove = (args: Record<string, unknown>) => {
      const api = createApi({
        ...planContextFixture,
        groups: [rowGroup, islandGroup],
      });
      return {
        api,
        result: toolExecutors['delete-article-and-compact'](api, args),
      };
    };

    it.each([
      [{ rootModuleId: 'r2' }, { groupId: 'kitchen-1', rootModuleId: 'r2' }],
      [
        { rootModuleId: 'isl-a7' },
        { groupId: 'island-1', rootModuleId: 'isl-a7' },
      ],
      [
        { groupId: '', rootModuleId: 'isl-a7' },
        { groupId: 'island-1', rootModuleId: 'isl-a7' },
      ],
    ])(
      'removes the root module from the group that holds it (%o)',
      async (args, payload) => {
        const { api, result } = remove(args);

        await expect(result).resolves.toBeDefined();
        expect(api.extended.externalObjectGroupOperation).toHaveBeenCalledWith(
          'remove-article-from-group',
          payload
        );
      }
    );

    it('reads a root id prefix in every group', async () => {
      const { api, result } = remove({ rootModuleId: 'isl-b' });

      expect(((await result) as Record<string, any>).corrections).toEqual([
        "delete-article-and-compact: root id 'isl-b' was read as 'isl-b3'",
      ]);
      expect(api.extended.externalObjectGroupOperation).toHaveBeenCalledWith(
        'remove-article-from-group',
        { groupId: 'island-1', rootModuleId: 'isl-b3' }
      );
    });

    it.each(['no-such-root', 'isl-'])(
      "names the roots of the plan for '%s', which matches no root or two",
      async (rootModuleId) => {
        const { api, result } = remove({ rootModuleId });

        await expect(result).rejects.toThrow(
          `Root module '${rootModuleId}' not found. Roots in the plan: r1, r2, r3, r9, isl-a7, isl-b3.`
        );
        expect(
          api.extended.externalObjectGroupOperation
        ).not.toHaveBeenCalled();
      }
    );
  });

  it('passes on the docking an exchanged article cannot take', async () => {
    const api = createApi(
      { ...planContextFixture, groups: [rowGroup] },
      {
        externalObjectGroupOperation: vi.fn(async (command: string) => ({
          command,
          groups: [],
          removedGroupIds: [],
          corrections: [
            "the new unit has no docking vector 'LeftTop' - its docking to 'w1' was dropped",
          ],
        })),
      }
    );

    const result = (await toolExecutors['exchange-root-module'](api, {
      groupId: 'kitchen-1',
      rootModuleId: 'r2',
      articleId: 'article-1',
    })) as Record<string, any>;

    expect(result.corrections).toEqual([
      "exchange-root-module: the new unit has no docking vector 'LeftTop' - its docking to 'w1' was dropped",
    ]);
  });

  describe('hints', () => {
    // a cabinet of the calculated group: its side vectors give the footprint
    // and the height
    const rawCabinet = (id: string, x: number) => ({
      id,
      articlePos: [x, 0, 0],
      rotationY: 0,
      dockInfos: [
        { id: 'LeftBottom', start: [0, 0, 0], end: [0, 0, 600] },
        { id: 'RightBottom', start: [600, 0, 0], end: [600, 0, 600] },
        { id: 'LeftTop', start: [0, 720, 0], end: [0, 720, 600] },
      ],
    });
    const rawRow = (id: string, x: number, count: number) => ({
      id,
      pos: [x, 0, -1500],
      rotationY: 0,
      roots: Array.from({ length: count }, (_, index) =>
        rawCabinet(`${id}-${index + 1}`, index * 600)
      ),
    });

    // the calculated groups before the edit, then after it
    const editWithGroups = async (before: unknown[], after: unknown[]) => {
      const api = createApi(
        { ...planContextFixture, groups: [rowGroup] },
        {
          getExternalObjectGroups: vi
            .fn()
            .mockResolvedValueOnce(before)
            .mockResolvedValue(after),
        }
      );
      return (await toolExecutors['insert-article-into-group'](api, {
        groupId: 'kitchen-1',
        articleId: 'article-1',
        between: ['r1', 'r2'],
      })) as Record<string, any>;
    };

    it('tells when the edit makes the row reach past a wall', async () => {
      const result = await editWithGroups(
        [rawRow('kitchen-1', 100, 3)],
        [rawRow('kitchen-1', 100, 7)]
      );

      expect(result.hint).toBe(
        'the row now reaches past a wall of the room - move it with place-group or edit the row if that is not what was asked'
      );
    });

    it('says nothing about a row that stood outside the room before', async () => {
      const result = await editWithGroups(
        [rawRow('kitchen-1', 100, 7)],
        [rawRow('kitchen-1', 100, 8)]
      );

      expect(result.hint).toBeUndefined();
    });

    // a row along the right wall from its back end; the door of the room
    // spans z -1000 to -100 of that wall
    const rightWallRow = (count: number) => ({
      id: 'kitchen-1',
      pos: [4000, 0, -3000],
      rotationY: 270,
      roots: Array.from({ length: count }, (_, index) =>
        rawCabinet(`kitchen-1-${index + 1}`, index * 600)
      ),
    });
    const editBesideTheDoor = async (before: unknown[], after: unknown[]) => {
      const api = createApi(
        {
          ...planContextFixture,
          groups: [rowGroup],
          obstacles: obstaclesInTheRoom,
        },
        {
          getExternalObjectGroups: vi
            .fn()
            .mockResolvedValueOnce(before)
            .mockResolvedValue(after),
        }
      );
      return (await toolExecutors['insert-article-into-group'](api, {
        groupId: 'kitchen-1',
        articleId: 'article-1',
        between: ['r1', 'r2'],
      })) as Record<string, any>;
    };

    it('names a door the row stands in front of after the edit', async () => {
      const result = await editBesideTheDoor(
        [rightWallRow(3)],
        [rightWallRow(4)]
      );
      expect(result.hint).toContain(
        "Root module 'kitchen-1-4' of group 'kitchen-1' stands in front of the door in the right wall (wall 1"
      );
      expect(result.hint).not.toContain("'kitchen-1-3'");
      expect(result.hint).toContain(
        'The row was edited as asked - move the group or edit the row if the user did not ask for it there.'
      );
    });

    it('says nothing about a row that stood in front of the door before the edit', async () => {
      const result = await editBesideTheDoor(
        [rightWallRow(4)],
        [rightWallRow(4)]
      );
      expect(result.hint).toBeUndefined();
    });

    it('tells when the edit makes the row overlap another group', async () => {
      const result = await editWithGroups(
        [rawRow('kitchen-1', 0, 3), rawRow('island-1', 2400, 2)],
        [rawRow('kitchen-1', 0, 5), rawRow('island-1', 2400, 2)]
      );

      expect(result.hint).toBe("the row now overlaps group 'island-1'");
    });

    it('says nothing about wall units that stand where they stood, when the planner moved the group origin', async () => {
      const wallArticle = {
        ...articleFixture,
        articleId: 'wall-article',
        category: 'Kitchen | Wall Units | Storage',
      };
      // the same room positions from another group origin
      const raw = (originX: number) => [
        {
          id: 'kitchen-1',
          pos: [originX, 0, -1500],
          roots: [
            {
              id: 'r1',
              articleId: 'article-1',
              articlePos: [600 - originX, 0, 0],
            },
            {
              id: 'w1',
              articleId: 'wall-article',
              articlePos: [600 - originX, 1380, 0],
            },
          ],
        },
      ];
      const api = createApi(
        {
          ...planContextFixture,
          articles: [articleFixture, wallArticle],
          groups: [rowGroup],
        },
        {
          getExternalObjectGroups: vi
            .fn()
            .mockResolvedValueOnce(raw(0))
            .mockResolvedValue(raw(600)),
        }
      );

      const result = (await toolExecutors['swap-root-modules'](api, {
        groupId: 'kitchen-1',
        rootModuleIds: ['r1', 'r3'],
      })) as Record<string, any>;

      expect(result.hint).toBeUndefined();
    });

    it('says nothing about a group the edit split off the row', async () => {
      const result = await editWithGroups(
        [rawRow('kitchen-1', 0, 3)],
        [rawRow('kitchen-1', 0, 3), rawRow('split-off', 600, 1)]
      );

      expect(result.hint).toBeUndefined();
    });

    it('names the wall units and the range hood that moved with the unit below them', async () => {
      const wallArticle = {
        ...articleFixture,
        articleId: 'wall-article',
        category: 'Kitchen | Wall Units | Storage',
      };
      const raw = (r2x: number, w1x: number) => [
        {
          id: 'kitchen-1',
          pos: [0, 0, -1500],
          roots: [
            { id: 'r1', articleId: 'article-1', articlePos: [0, 0, 0] },
            { id: 'r2', articleId: 'article-1', articlePos: [r2x, 0, 0] },
            { id: 'w1', articleId: 'wall-article', articlePos: [w1x, 1380, 0] },
            { id: 'w2', articleId: 'wall-article', articlePos: [0, 1380, 0] },
          ],
        },
      ];
      const api = createApi(
        {
          ...planContextFixture,
          articles: [articleFixture, wallArticle],
          groups: [rowGroup],
        },
        {
          getExternalObjectGroups: vi
            .fn()
            .mockResolvedValueOnce(raw(600, 600))
            .mockResolvedValue(raw(1200, 1200)),
        }
      );

      const result = (await toolExecutors['swap-root-modules'](api, {
        groupId: 'kitchen-1',
        rootModuleIds: ['r1', 'r3'],
      })) as Record<string, any>;

      expect(result.hint).toBe(
        "the wall units and the range hood above the moved units moved with them ('w1' (wall-article)) - edit the wall row the same way if it should line up with the floor units"
      );
    });

    it.each([
      ['left wall', 0, 0, true],
      ['left wall', 6000, 0, true],
      ['left wall', 0, 270, true],
      [undefined, 0, 0, false],
    ])(
      'names the turned leg by its original wall %s (room x %s, group turn %s, walls %s)',
      async (sourceWall, roomX, groupTurn, withWalls) => {
        const shiftedRoom = (x: number) => ({
          ...room,
          walls: room.walls.map((wall) => ({
            ...wall,
            start: [wall.start[0] + x, wall.start[1], wall.start[2]],
            end: [wall.end[0] + x, wall.end[1], wall.end[2]],
          })),
        });
        const raw = (turned: boolean) => [
          {
            id: 'kitchen-1',
            pos: [roomX, 0, -3000],
            rotationY: groupTurn,
            roots: ['r1', 'r2'].map((id, index) => ({
              ...rawCabinet(id, index * 600),
              articleId: 'article-1',
              articlePos: turned
                ? [600 + index * 600, 0, 0]
                : [0, 0, 1200 + index * 600],
              rotationY: (turned ? 0 : 90) - groupTurn,
            })),
          },
        ];
        // compensate the rotated group frame while preserving the room positions
        const inRoom = (groups: any[]) =>
          groups.map((group) => ({
            ...group,
            roots: group.roots.map((root: any) => ({
              ...root,
              articlePos:
                groupTurn === 270
                  ? [
                      root.articlePos[2],
                      root.articlePos[1],
                      -root.articlePos[0],
                    ]
                  : root.articlePos,
            })),
          }));
        const api = createApi(
          {
            ...planContextFixture,
            groups: [rowGroup],
            rooms: {
              rooms: withWalls
                ? roomX
                  ? [room, shiftedRoom(roomX)]
                  : [room]
                : [],
            },
          },
          {
            getExternalObjectGroups: vi
              .fn()
              .mockResolvedValueOnce(inRoom(raw(false)))
              .mockResolvedValue(inRoom(raw(true))),
            externalObjectGroupOperation: vi.fn(async () => ({
              groups: [],
              removedGroupIds: [],
              gapClosed: true,
            })),
          }
        );

        const result: any = await toolExecutors['delete-article-and-compact'](
          api,
          {
            groupId: 'kitchen-1',
            rootModuleId: 'r9',
          }
        );

        expect(result.hint).toBe(
          `${sourceWall ? 'the leg on the left wall' : 'the leg'} turned by 90°` +
            (withWalls ? ' and now runs along the back wall' : '') +
            " (root modules 'r1' (article-1), 'r2' (article-1))"
        );
      }
    );

    it('names a wall unit that rotates in place', async () => {
      const wallArticle = {
        ...articleFixture,
        articleId: 'wall-article',
        category: 'Kitchen | Wall Units | Storage',
      };
      const raw = (rotationY: number) => [
        {
          id: 'kitchen-1',
          pos: [600, 0, -1500],
          roots: [
            {
              id: 'w1',
              articleId: 'wall-article',
              articlePos: [0, 1380, 0],
              rotationY,
            },
          ],
        },
      ];
      const api = createApi(
        {
          ...planContextFixture,
          groups: [rowGroup],
          articles: [articleFixture, wallArticle],
        },
        {
          getExternalObjectGroups: vi
            .fn()
            .mockResolvedValueOnce(raw(90))
            .mockResolvedValue(raw(0)),
        }
      );

      const result: any = await toolExecutors['swap-root-modules'](api, {
        groupId: 'kitchen-1',
        rootModuleIds: ['r1', 'r3'],
      });

      expect(result.hint).toContain("'w1' (wall-article)");
    });

    it('does not report a turned leg when only the group frame changes', async () => {
      const wallArticle = {
        ...articleFixture,
        articleId: 'wall-article',
        category: 'Kitchen | Wall Units | Storage',
      };
      const raw = (rotationY: number) => [
        {
          id: 'kitchen-1',
          pos: [600, 0, -1500],
          rotationY,
          roots: [
            {
              ...rawCabinet('r1', 0),
              articleId: 'article-1',
              rotationY: -rotationY,
            },
            {
              id: 'w1',
              articleId: 'wall-article',
              articlePos: [0, 1380, 0],
              rotationY: -rotationY,
            },
          ],
        },
      ];
      const api = createApi(
        {
          ...planContextFixture,
          groups: [rowGroup],
          articles: [articleFixture, wallArticle],
        },
        {
          getExternalObjectGroups: vi
            .fn()
            .mockResolvedValueOnce(raw(0))
            .mockResolvedValue(raw(90)),
          externalObjectGroupOperation: vi.fn(async () => ({
            groups: [],
            removedGroupIds: [],
            gapClosed: true,
          })),
        }
      );

      const result: any = await toolExecutors['delete-article-and-compact'](
        api,
        {
          groupId: 'kitchen-1',
          rootModuleId: 'r9',
        }
      );

      expect(result.hint).toBeUndefined();
    });
  });

  it('swaps two roots of the group and asks for two different ones', async () => {
    const api = createApi({ ...planContextFixture, groups: [rowGroup] });

    await toolExecutors['swap-root-modules'](api, {
      groupId: 'kitchen',
      rootModuleIds: ['r1', 'r3'],
    });
    expect(api.extended.externalObjectGroupOperation).toHaveBeenCalledWith(
      'swap-root-modules',
      { groupId: 'kitchen-1', rootModuleIds: ['r1', 'r3'] }
    );

    await expect(
      toolExecutors['swap-root-modules'](api, {
        groupId: 'kitchen-1',
        rootModuleIds: ['r2', 'r2'],
      })
    ).rejects.toThrow(
      "swap-root-modules: both ids name the root 'r2' - name the two units that change places"
    );
    expect(api.extended.externalObjectGroupOperation).toHaveBeenCalledTimes(1);
  });
});

describe('plan changes', () => {
  // a planner command that takes a moment and records when it runs
  const recordingApi = (events: string[], failing: string[] = []) =>
    createApi(planContextFixture, {
      externalObjectGroupOperation: vi.fn(
        async (command: string, payload: any) => {
          const id =
            payload.rootModuleId ??
            payload.attributes?.[0]?.rootModuleIds?.join(',');
          events.push(`start ${id}`);
          await new Promise((resolve) => setTimeout(resolve, 10));
          events.push(`end ${id}`);
          if (failing.includes(id)) {
            throw new Error(`refused ${id}`);
          }
          return { command, groups: [], removedGroupIds: [] };
        }
      ),
    });

  it('runs tool calls that change the plan one after another', async () => {
    const events: string[] = [];
    const api = recordingApi(events);
    await Promise.all([
      toolExecutors['delete-article-in-place'](api, { rootModuleId: 'a' }),
      toolExecutors['change-module-attribute'](api, {
        rootModuleIds: ['r1'],
        attributeId: 'b',
        value: '900',
      }),
    ]);
    expect(events).toEqual(['start a', 'end a', 'start r1', 'end r1']);
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
      toolExecutors['delete-article-in-place'](api, { rootModuleId: 'a' }),
      toolExecutors['get-plan-context'](api, { include: ['groups'] }),
    ]);
    // the first reads are the change's own: it resolves the root id and
    // reads the plan before and after its step, for undo
    expect(events).toEqual([
      'plan context',
      'calculated groups',
      'start a',
      'end a',
      'calculated groups',
      'plan context',
      'calculated groups',
    ]);
  });

  it('runs the next plan change after one that fails', async () => {
    const events: string[] = [];
    const api = recordingApi(events, ['a']);
    const [first, second] = await Promise.allSettled([
      toolExecutors['delete-article-in-place'](api, { rootModuleId: 'a' }),
      toolExecutors['delete-article-in-place'](api, { rootModuleId: 'b' }),
    ]);
    expect(first).toMatchObject({
      status: 'rejected',
      reason: new Error('refused a'),
    });
    expect(second).toMatchObject({ status: 'fulfilled' });
    expect(events).toEqual(['start a', 'end a', 'start b', 'end b']);
  });
});

describe('undo and redo', () => {
  const initialGroup = {
    id: 'g1',
    libraryId: 'lib-1',
    attributes: [],
    roots: [{ id: 'r1', articleId: 'article-1' }],
  };
  const probeGroup = {
    id: 'probe-group',
    roots: [
      {
        id: 'p1',
        articleId: 'article-1',
        dockInfos: [{ id: 'LeftBottom', start: [0, 0, 0], end: [0, 0, 561] }],
      },
    ],
  };
  // the plan context reports no position for these groups
  const shaped = (group: any) => ({
    id: group.id,
    libraryId: group.libraryId,
    attributes: group.attributes,
    position: {},
    roots: group.roots.map((root: any) => makeShapedRoot({ id: root.id })),
  });

  // A planner with an undo history, relaying its history events like the
  // page: every load, command and removal is one step and one event; the
  // follow-up of an attribute change is a second event that joins the step,
  // right after the command resolves unless followUpDelayMs says otherwise;
  // undo and redo fire one event, none when there is nothing to step.
  const historyPlanner = (
    options: {
      followUpDelayMs?: number;
      undoFails?: boolean;
      editDuringCall?: boolean;
      failRealLoad?: boolean;
      loadDelayMs?: number;
      gapClosed?: boolean;
      readDelayMs?: number;
      order?: string[];
      // new groups calculated with a footprint, and a load of a group in
      // the plan that moves it
      calculated?: boolean;
    } = {}
  ) => {
    let raw: any[] = [initialGroup];
    let past: any[][] = [];
    let future: any[][] = [];
    let created = 0;
    const step = (next: any[]) => {
      past.push(raw);
      raw = next;
      future = [];
      planHistory.historyChanged();
    };
    const api = createApi(planContextFixture, {
      getExternalObjectPlanContext: vi.fn(async () => ({
        ...planContextFixture,
        groups: raw.filter((group) => group !== probeGroup).map(shaped),
      })),
      getExternalObjectGroups: vi.fn(async () => {
        if (options.readDelayMs) {
          await new Promise((resolve) =>
            setTimeout(resolve, options.readDelayMs)
          );
        }
        return raw;
      }),
      loadExternalObjectGroupLayout: vi.fn(async (layout: any) => {
        options.order?.push('load start');
        if (options.loadDelayMs) {
          await new Promise((resolve) =>
            setTimeout(resolve, options.loadDelayMs)
          );
        }
        options.order?.push('load end');
        if (isProbeLoad(layout)) {
          step([...raw, probeGroup]);
          return [{ id: 'probe' }];
        }
        if (options.failRealLoad) {
          throw new Error('The planner could not load the group.');
        }
        const [posGroup] = layout.posGroups;
        const inPlan = raw.find((group) => group.id === posGroup.id);
        if (options.calculated && inPlan) {
          const moved = repositioned(inPlan, posGroup.repositioningData);
          step(raw.map((group) => (group === inPlan ? moved : group)));
          return [{ id: inPlan.id }];
        }
        const id = `new-${++created}`;
        step([
          ...raw,
          {
            id,
            libraryId: 'lib-1',
            attributes: [],
            roots: options.calculated
              ? posGroup.roots.map((root: any) =>
                  makeRoot({ id: root.id, articleId: root.articleId })
                )
              : posGroup.roots,
            ...(options.calculated && { pos: [0, 0, 0], rotationY: 0 }),
          },
        ]);
        return [{ id }];
      }),
      externalObjectGroupOperation: vi.fn(
        async (command: string, payload: any) => {
          const attributeIds = payload.attributes?.map(
            (change: any) => change.attributeId
          ) ?? [payload.attributeId];
          if (attributeIds.includes('colour')) {
            throw new Error(
              "No module of root module 'r1' has the attribute 'colour'."
            );
          }
          if (command === 'delete-group') {
            step(raw.filter((group) => group.id !== payload.groupId));
            return { command, groups: [], removedGroupIds: [payload.groupId] };
          }
          step(
            raw.map((group) =>
              group.id === payload.groupId
                ? {
                    ...group,
                    attributes: payload.attributes
                      ? payload.attributes.map((change: any) => ({
                          id: change.attributeId,
                          value: change.value,
                        }))
                      : [{ id: payload.attributeId, value: payload.value }],
                  }
                : group
            )
          );
          if (options.editDuringCall) {
            step(raw.map((group) => ({ ...group, moved: true })));
          }
          // a remove that deleted the unit has no follow-up reload
          const removed = command === 'remove-article-from-group';
          if (removed && options.gapClosed === false) {
            return {
              command,
              groups: raw.map(shaped),
              removedGroupIds: [],
              gapClosed: false,
            };
          }
          {
            setTimeout(() => {
              raw = raw.map((group) =>
                group.id === payload.groupId
                  ? { ...group, pos: [0, 0, 10] }
                  : group
              );
              planHistory.historyChanged();
            }, options.followUpDelayMs ?? 0);
          }
          return {
            command,
            groups: raw.map(shaped),
            removedGroupIds: [],
            ...(removed && { gapClosed: true }),
          };
        }
      ),
      removeExternalObject: vi.fn(async (id: string) => {
        step(raw.filter((group) => group.id !== id));
      }),
      undo: vi.fn(async () => {
        options.order?.push('undo');
        if (options.undoFails) {
          throw new Error('Planner method not exposed: undo');
        }
        const previous = past.pop();
        if (!previous) {
          return;
        }
        future.push(raw);
        raw = previous;
        planHistory.historyChanged();
      }),
      redo: vi.fn(async () => {
        const next = future.pop();
        if (!next) {
          return;
        }
        past.push(raw);
        raw = next;
        planHistory.historyChanged();
      }),
    });
    return {
      api,
      raw: () => raw,
      future: () => future,
      // the user changes the plan in the planner
      editInPlanner: () =>
        step(raw.map((group) => ({ ...group, moved: true }))),
      // the plan changes without a history event
      changeWithoutEvent: () => {
        raw = raw.map((group) => ({ ...group, recalculated: true }));
      },
      // the planner starts a new history, e.g. a plan load
      clearHistory: () => {
        past = [];
        future = [];
      },
    };
  };
  const changeFront = (
    planner: ReturnType<typeof historyPlanner>,
    value = 'black'
  ) =>
    toolExecutors['change-group-attribute'](planner.api, {
      groupId: 'g1',
      attributeId: 'front',
      value,
    });

  beforeEach(() => {
    planHistory.reset();
  });

  // a follow-up the fake planner scheduled must not reach the next test
  afterEach(async () => {
    vi.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  it('reverts the last tool call with one planner undo and returns the groups as before', async () => {
    const planner = historyPlanner();
    await changeFront(planner);
    const result = (await toolExecutors.undo(planner.api, {})) as any;

    expect(planner.api.extended.undo).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      undone: 'change-group-attribute',
      groups: [shaped(initialGroup)],
    });
    expect(planner.raw()).toEqual([initialGroup]);
  });

  const createRow = (planner: ReturnType<typeof historyPlanner>) =>
    toolExecutors['create-or-replace-groups'](planner.api, {
      posGroups: [
        { libraryId: 'lib-1', roots: [{ id: 'u1', articleId: 'article-1' }] },
      ],
    });

  it('answers a create with the groups of the call and the other groups by their id', async () => {
    const planner = historyPlanner();
    const result = (await createRow(planner)) as any;
    expect(result.groups.map((group: any) => group.id)).toEqual(['new-1']);
    expect(result.otherGroupIds).toEqual(['g1']);
  });

  it('returns the groups the reverted call changed, and the others by their id', async () => {
    const planner = historyPlanner();
    await createRow(planner);
    await changeFront(planner);
    const result = (await toolExecutors.undo(planner.api, {})) as any;
    expect(result).toEqual({
      undone: 'change-group-attribute',
      groups: [shaped(initialGroup)],
      otherGroupIds: ['new-1'],
    });
  });

  it('names the group an undone create took out of the plan, and the group a redo brought back', async () => {
    const planner = historyPlanner();
    await createRow(planner);
    const undone = (await toolExecutors.undo(planner.api, {})) as any;
    expect(undone).toEqual({
      undone: 'create-or-replace-groups',
      groups: [],
      otherGroupIds: ['g1'],
      removedGroupIds: ['new-1'],
    });
    const redone = (await toolExecutors.redo(planner.api, {})) as any;
    expect(redone.groups.map((group: any) => group.id)).toEqual(['new-1']);
    expect(redone.otherGroupIds).toEqual(['g1']);
    expect(redone.removedGroupIds).toBeUndefined();
  });

  it('reverts a kitchen with three materials with two planner undos', async () => {
    const planner = historyPlanner();
    await toolExecutors['create-or-replace-groups'](planner.api, {
      posGroups: [
        {
          libraryId: 'lib-1',
          attributes: [
            { id: 'front', value: 'white' },
            { id: 'carcase', value: 'oak' },
            { id: 'countertop', value: '224' },
          ],
          roots: [{ id: 'u1', articleId: 'article-1' }],
        },
      ],
    });
    expect(
      planner.api.extended.externalObjectGroupOperation
    ).toHaveBeenCalledOnce();
    expect(
      planner.api.extended.externalObjectGroupOperation
    ).toHaveBeenCalledWith(
      'change-attributes',
      expect.objectContaining({ groupId: 'new-1' })
    );

    const result = (await toolExecutors.undo(planner.api, {})) as any;
    expect(planner.api.extended.undo).toHaveBeenCalledTimes(2);
    expect(result.undone).toBe('create-or-replace-groups');
    expect(planner.raw()).toEqual([initialGroup]);
  });

  it('reverts a new group placed by wall, its load and its reload, in one undo', async () => {
    const planner = historyPlanner({ calculated: true });
    await toolExecutors['create-or-replace-groups'](planner.api, {
      posGroups: [
        {
          libraryId: 'lib-1',
          placement: { wall: 'back' },
          roots: [{ id: 'u1', articleId: 'article-1' }],
        },
      ],
    });
    expect(
      planner.api.extended.loadExternalObjectGroupLayout
    ).toHaveBeenCalledTimes(2);
    expect(planner.raw()[1].pos).toEqual([1600, 0, -3000]);

    const result = (await toolExecutors.undo(planner.api, {})) as any;
    expect(planner.api.extended.undo).toHaveBeenCalledTimes(2);
    expect(result.undone).toBe('create-or-replace-groups');
    expect(planner.raw()).toEqual([initialGroup]);
  });

  it('undoes the anchor probe instead of removing it', async () => {
    const planner = historyPlanner();
    await toolExecutors['create-or-replace-groups'](planner.api, {
      posGroups: [
        {
          libraryId: 'lib-1',
          placement: { posGroup: [0, 0, 0], posRotationY: 0 },
          roots: [{ id: 'u1', articleId: 'article-1' }],
        },
      ],
    });
    expect(planner.api.extended.undo).toHaveBeenCalledTimes(1);
    expect(planner.api.extended.removeExternalObject).not.toHaveBeenCalled();
    expect(planner.raw().map((group) => group.id)).toEqual(['g1', 'new-1']);
    // the real load ended the probe's redo
    expect(planner.future()).toEqual([]);
    expect(planHistory.lastDone()?.steps).toBe(1);

    const result = (await toolExecutors.undo(planner.api, {})) as any;
    expect(result.undone).toBe('create-or-replace-groups');
    expect(planner.raw()).toEqual([initialGroup]);
  });

  it('removes the probe group when the page cannot undo', async () => {
    const planner = historyPlanner({ undoFails: true });
    await toolExecutors['create-or-replace-groups'](planner.api, {
      posGroups: [
        {
          libraryId: 'lib-1',
          placement: { posGroup: [0, 0, 0], posRotationY: 0 },
          roots: [{ id: 'u1', articleId: 'article-1' }],
        },
      ],
    });
    expect(planner.api.extended.removeExternalObject).toHaveBeenCalledWith(
      'probe-group'
    );
    expect(planner.raw().map((group) => group.id)).toEqual(['g1', 'new-1']);
    // the probe load, its removal and the real load
    expect(planHistory.lastDone()?.steps).toBe(3);
  });

  it('reverts two tool calls in reverse order, then has nothing to undo', async () => {
    const planner = historyPlanner();
    await changeFront(planner);
    await toolExecutors['delete-group'](planner.api, { groupId: 'g1' });

    const first = (await toolExecutors.undo(planner.api, {})) as any;
    expect(first.undone).toBe('delete-group');
    expect(first.groups[0].attributes).toEqual([
      { id: 'front', value: 'black' },
    ]);
    const second = (await toolExecutors.undo(planner.api, {})) as any;
    expect(second.undone).toBe('change-group-attribute');
    expect(second.groups[0].attributes).toEqual([]);
    const third = (await toolExecutors.undo(planner.api, {})) as any;
    expect(third.undone).toBeNull();
    expect(third.hint).toMatch(/^Nothing to undo/);
    expect(planner.api.extended.undo).toHaveBeenCalledTimes(2);
  });

  it('says when there is nothing to undo or redo', async () => {
    const planner = historyPlanner();
    const undone = (await toolExecutors.undo(planner.api, {})) as any;
    const redone = (await toolExecutors.redo(planner.api, {})) as any;

    expect(undone).toEqual({
      undone: null,
      groups: [shaped(initialGroup)],
      hint: 'Nothing to undo: no tool call has changed the plan since the planner page connected.',
    });
    expect(redone.redone).toBeNull();
    expect(redone.hint).toMatch(/^Nothing to redo/);
    expect(planner.api.extended.undo).not.toHaveBeenCalled();
    expect(planner.api.extended.redo).not.toHaveBeenCalled();
  });

  it('brings an undone call back and forgets it after a new change', async () => {
    const planner = historyPlanner();
    await changeFront(planner);
    await toolExecutors.undo(planner.api, {});
    const redone = (await toolExecutors.redo(planner.api, {})) as any;
    expect(redone.redone).toBe('change-group-attribute');
    expect(redone.groups[0].attributes).toEqual([
      { id: 'front', value: 'black' },
    ]);
    expect(planner.api.extended.redo).toHaveBeenCalledTimes(1);

    await toolExecutors.undo(planner.api, {});
    await toolExecutors['delete-group'](planner.api, { groupId: 'g1' });
    const after = (await toolExecutors.redo(planner.api, {})) as any;
    expect(after.redone).toBeNull();
    expect(planner.api.extended.redo).toHaveBeenCalledTimes(1);
  });

  it('does not undo after a change in the planner', async () => {
    const planner = historyPlanner();
    await changeFront(planner);
    planner.editInPlanner();
    const afterEdit = (await toolExecutors.undo(planner.api, {})) as any;
    expect(afterEdit.undone).toBeNull();
    expect(afterEdit.hint).toMatch(
      /changed in the planner after the last tool call/
    );

    await changeFront(planner, 'white');
    planner.changeWithoutEvent();
    const afterChange = (await toolExecutors.undo(planner.api, {})) as any;
    expect(afterChange.undone).toBeNull();
    expect(afterChange.hint).toMatch(/changed in the planner/);
    expect(planner.api.extended.undo).not.toHaveBeenCalled();
  });

  it("stops when the planner's history no longer holds the change", async () => {
    const planner = historyPlanner();
    await changeFront(planner);
    planner.clearHistory();
    vi.useFakeTimers();
    const pending = toolExecutors.undo(planner.api, {});
    await vi.advanceTimersByTimeAsync(1000);
    const result = (await pending) as any;

    expect(planner.api.extended.undo).toHaveBeenCalledTimes(1);
    expect(result.undone).toBeNull();
    expect(result.hint).toMatch(
      /undo history no longer holds change-group-attribute/
    );
    const again = (await toolExecutors.undo(planner.api, {})) as any;
    expect(again.hint).toMatch(/^Nothing to undo/);
  });

  it('takes an undo back that does not give back the plan before the call - the planner was changed while the call ran', async () => {
    const planner = historyPlanner({ editDuringCall: true });
    await changeFront(planner);
    const afterCall = planner.raw();
    const result = (await toolExecutors.undo(planner.api, {})) as any;

    expect(planner.api.extended.undo).toHaveBeenCalledTimes(1);
    expect(planner.api.extended.redo).toHaveBeenCalledTimes(1);
    expect(result.undone).toBeNull();
    expect(result.hint).toBe(
      "Undo of change-group-attribute did not give back the plan before it - the plan was changed in the planner while the tool call ran. The undo was taken back and the plan is as it was; the planner's undo button reverts the changes made there."
    );
    expect(planner.raw()).toEqual(afterCall);
    const again = (await toolExecutors.undo(planner.api, {})) as any;
    expect(again.hint).toMatch(/changed in the planner/);
  });

  it('withholds undo while the follow-up reload of the last call is outstanding', async () => {
    vi.useFakeTimers();
    const planner = historyPlanner({ followUpDelayMs: 10_000 });
    const changing = changeFront(planner);
    await vi.advanceTimersByTimeAsync(2000);
    await changing;
    const withholding = toolExecutors.undo(planner.api, {});
    await vi.advanceTimersByTimeAsync(2000);
    const withheld = (await withholding) as any;

    expect(withheld.undone).toBeNull();
    expect(withheld.hint).toBe(
      'The planner has not finished the last change yet - its follow-up reload is still outstanding. Nothing was undone; call undo again in a moment.'
    );
    expect(planner.api.extended.undo).not.toHaveBeenCalled();

    // the late reload is the call's own, not a change in the planner
    await vi.advanceTimersByTimeAsync(6000);
    const result = (await toolExecutors.undo(planner.api, {})) as any;
    expect(result.undone).toBe('change-group-attribute');
    expect(planner.raw()).toEqual([initialGroup]);
  });

  it('undoes a call once its late follow-up reload has landed', async () => {
    vi.useFakeTimers();
    const planner = historyPlanner({ followUpDelayMs: 3000 });
    const changing = changeFront(planner);
    await vi.advanceTimersByTimeAsync(2000);
    await changing;
    const undoing = toolExecutors.undo(planner.api, {});
    await vi.advanceTimersByTimeAsync(1000);
    const result = (await undoing) as any;

    expect(result.undone).toBe('change-group-attribute');
    expect(planner.raw()).toEqual([initialGroup]);
  });

  it('ends redo with the first planner step of a call, also when the call leaves no step', async () => {
    const planner = historyPlanner({ failRealLoad: true });
    await changeFront(planner);
    await toolExecutors.undo(planner.api, {});
    await expect(
      toolExecutors['create-or-replace-groups'](planner.api, {
        posGroups: [
          {
            libraryId: 'lib-1',
            placement: { posGroup: [0, 0, 0], posRotationY: 0 },
            roots: [{ id: 'u1', articleId: 'article-1' }],
          },
        ],
      })
    ).rejects.toThrow('The planner could not load the group.');

    const result = (await toolExecutors.redo(planner.api, {})) as any;
    expect(result.redone).toBeNull();
    expect(result.hint).toMatch(/^Nothing to redo/);
    expect(planner.api.extended.redo).not.toHaveBeenCalled();
  });

  it('waits for the follow-up reload of a delete that closed the gap, and not after one that left it', async () => {
    const closing = historyPlanner({ followUpDelayMs: 50 });
    await toolExecutors['delete-article-and-compact'](closing.api, {
      groupId: 'g1',
      rootModuleId: 'r1',
    });
    expect(planHistory.lastDone()?.groupsAfter).toContain('"pos":[0,0,10]');
    expect(planHistory.lastDone()?.settled).toBe(true);

    planHistory.reset();
    const deleting = historyPlanner({ gapClosed: false });
    const started = Date.now();
    await toolExecutors['delete-article-and-compact'](deleting.api, {
      groupId: 'g1',
      rootModuleId: 'r1',
    });
    expect(Date.now() - started).toBeLessThan(1000);
    expect(planHistory.lastDone()?.settled).toBe(true);
  });

  it('waits for the follow-up reload of a swap', async () => {
    const planner = historyPlanner({ followUpDelayMs: 50 });
    await toolExecutors['swap-root-modules'](planner.api, {
      groupId: 'g1',
      rootModuleIds: ['r1', 'unit-2'],
    });

    expect(planner.raw()[0].pos).toEqual([0, 0, 10]);
    expect(planHistory.lastDone()?.groupsAfter).toContain('"pos":[0,0,10]');
  });

  it("takes a follow-up that lands after the wait, while the call still reads the plan, as the call's own", async () => {
    vi.useFakeTimers();
    // the wait gives up at 2000 ms, the follow-up lands at 2100 ms, while the
    // call reads the plan for its record (300 ms)
    const planner = historyPlanner({ followUpDelayMs: 2100, readDelayMs: 300 });
    const changing = changeFront(planner);
    await vi.advanceTimersByTimeAsync(5000);
    await changing;

    expect(planHistory.lastDone()?.settled).toBe(true);
    expect(planHistory.lastDone()?.groupsAfter).toContain('"pos":[0,0,10]');
    expect(planHistory.lateFollowUps).toBe(0);

    const undoing = toolExecutors.undo(planner.api, {});
    await vi.advanceTimersByTimeAsync(3000);
    const result = (await undoing) as any;
    expect(result.undone).toBe('change-group-attribute');
  });

  it('expects every follow-up reload of a call that lands after the call', async () => {
    const planner = historyPlanner({ followUpDelayMs: 2500 });
    await toolExecutors['create-or-replace-groups'](planner.api, {
      posGroups: [
        {
          libraryId: 'lib-1',
          placement: { posGroup: [0, 0, 0], posRotationY: 0 },
          roots: [{ id: 'u1', articleId: 'article-1' }],
        },
      ],
    });
    const created = planner.raw();
    vi.useFakeTimers();
    // one attribute on root modules of two groups: two group commands, both
    // reloads late
    const changing = toolExecutors['change-module-attribute'](planner.api, {
      rootModuleIds: ['r1', 'u1'],
      attributeId: 'front',
      value: 'white',
    });
    await vi.advanceTimersByTimeAsync(4100);
    await changing;
    expect(planHistory.lastDone()?.settled).toBe(false);
    expect(planHistory.lateFollowUps).toBe(1);

    await vi.advanceTimersByTimeAsync(2000);
    expect(planHistory.lateFollowUps).toBe(0);
    const undoing = toolExecutors.undo(planner.api, {});
    await vi.advanceTimersByTimeAsync(3000);
    const result = (await undoing) as any;
    expect(result.undone).toBe('change-module-attribute');
    expect(planner.raw()).toEqual(created);
  });

  it('waits for the follow-up reload of an attribute change', async () => {
    const planner = historyPlanner({ followUpDelayMs: 50 });
    await changeFront(planner);
    expect(planner.raw()[0].pos).toEqual([0, 0, 10]);
    expect(planHistory.lastDone()?.groupsAfter).toContain('"pos":[0,0,10]');

    const result = (await toolExecutors.undo(planner.api, {})) as any;
    expect(result.undone).toBe('change-group-attribute');
    expect(result.hint).toBeUndefined();
  });

  it('waits for the follow-up reload of the group attributes of a create', async () => {
    const planner = historyPlanner({ followUpDelayMs: 50 });
    await toolExecutors['create-or-replace-groups'](planner.api, {
      posGroups: [
        {
          libraryId: 'lib-1',
          attributes: [{ id: 'front', value: 'white' }],
          roots: [{ id: 'u1', articleId: 'article-1' }],
        },
      ],
    });
    expect(planHistory.lastDone()?.groupsAfter).toContain('"pos":[0,0,10]');
  });

  it('waits for a follow-up reload at most two seconds', async () => {
    vi.useFakeTimers();
    const planner = historyPlanner({ followUpDelayMs: 60_000 });
    let settled = false;
    const pending = changeFront(planner).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(1900);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    await pending;
    expect(settled).toBe(true);
  });

  it('does not wait after a command without a follow-up, nor on a page that relays no history', async () => {
    const planner = historyPlanner();
    const started = Date.now();
    await toolExecutors['delete-group'](planner.api, { groupId: 'g1' });
    await toolExecutors['change-group-attribute'](
      createApi(planContextFixture),
      { groupId: 'g1', attributeId: 'front', value: 'black' }
    );
    expect(Date.now() - started).toBeLessThan(500);
  });

  it('runs undo in the queue, never beside another plan change', async () => {
    const order: string[] = [];
    const planner = historyPlanner({ loadDelayMs: 20, order });
    await changeFront(planner);
    const [, result] = (await Promise.all([
      toolExecutors['create-or-replace-groups'](planner.api, {
        posGroups: [
          { libraryId: 'lib-1', roots: [{ id: 'u1', articleId: 'article-1' }] },
        ],
      }),
      toolExecutors.undo(planner.api, {}),
    ])) as any[];

    expect(order).toEqual(['load start', 'load end', 'undo']);
    expect(result.undone).toBe('create-or-replace-groups');
  });

  it('records nothing for a call the planner refused', async () => {
    const planner = historyPlanner();
    await changeFront(planner);
    await expect(
      toolExecutors['change-module-attribute'](planner.api, {
        rootModuleId: 'r1',
        attributeId: 'colour',
        value: 'red',
      })
    ).rejects.toThrow(
      "No module of root module 'r1' has the attribute 'colour'."
    );

    const result = (await toolExecutors.undo(planner.api, {})) as any;
    expect(result.undone).toBe('change-group-attribute');
    expect(planner.api.extended.undo).toHaveBeenCalledTimes(1);
  });
});
