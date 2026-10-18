import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { planHistory } from '../plan-history';
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

// A planner whose plan context is the given one.
const createApi = (
  planContext: unknown,
  overrides: Record<string, unknown> = {}
) => ({
  extended: {
    getExternalObjectPlanContext: vi.fn(async () => planContext),
    externalObjectGroupOperation: vi.fn(
      async (command: string): Promise<any> => ({
        command,
        groups: [],
        removedGroupIds: [],
      })
    ),
    fetchPrice: vi.fn(async () => ({ price: 42 })),
    getExternalObjectSnapshot: vi.fn(async () => ({})),
    undo: vi.fn(async () => undefined),
    redo: vi.fn(async () => undefined),
    ...overrides,
  },
});

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
      'masterData',
    ]);
    // a planner without the obstacles section (an older roomle-ui) returns
    // none, and the context is the same
    // the plan context arrives agent-ready from the planner API; the server
    // names the walls, lists the room corners and derives the attribute
    // vocabulary from the master data
    const { masterData, ...sections } = planContextFixture;
    expect(result).toEqual({
      ...sections,
      rooms: { rooms: [namedRoom] },
      attributes: { 'lib-1': masterData['lib-1'].attributes },
    });
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

  it('lists the room corners where a window meets a wall, and none of the partition', async () => {
    // the living room of the prompt tests: a window reaches the front left,
    // the front right and the back right corner; the inner corner of the L and
    // the partition turn away from the room
    const livingRoomWall = (
      index: number,
      side: string,
      [x1, z1]: [number, number],
      [x2, z2]: [number, number],
      facingRotationY: number,
      type: string | null = 'wall'
    ) => ({
      index,
      side,
      start: [x1, 0, z1],
      end: [x2, 0, z2],
      lengthMm: Math.hypot(x2 - x1, z2 - z1),
      type,
      facingRotationY,
    });
    const walls = [
      livingRoomWall(0, 'left', [1935, -5265], [1935, -3765], 90),
      livingRoomWall(1, 'top', [1935, -3765], [-3185, -3765], 0),
      livingRoomWall(2, 'left', [-3185, -3765], [-3185, 2235], 90),
      livingRoomWall(3, 'bottom', [-3185, 2235], [-1705, 2235], 180, null),
      livingRoomWall(4, 'bottom', [-1705, 2235], [315, 2235], 180, null),
      livingRoomWall(5, 'bottom', [315, 2235], [1815, 2235], 180, null),
      livingRoomWall(6, 'bottom', [1815, 2235], [3315, 2235], 180, null),
      livingRoomWall(7, 'bottom', [3315, 2235], [4815, 2235], 180, null),
      livingRoomWall(8, 'bottom', [4815, 2235], [6315, 2235], 180, null),
      livingRoomWall(9, 'bottom', [6315, 2235], [6320, 2235], 180),
      livingRoomWall(10, 'right', [6320, 2235], [6320, 735], 270, null),
      livingRoomWall(11, 'right', [6320, 735], [6320, -765], 270, null),
      livingRoomWall(12, 'right', [6320, -765], [6320, -2265], 270, null),
      livingRoomWall(13, 'right', [6320, -2265], [6320, -3765], 270, null),
      livingRoomWall(14, 'right', [6320, -3765], [6320, -3825], 270),
      livingRoomWall(15, 'right', [6320, -3825], [6320, -5265], 270, null),
      livingRoomWall(16, 'top', [6320, -5265], [5030, -5265], 0),
      livingRoomWall(17, 'top', [5030, -5265], [3230, -5265], 0, null),
      livingRoomWall(18, 'top', [3230, -5265], [1935, -5265], 0),
      livingRoomWall(20, 'right', [1810, 1050], [1810, -2550], 270),
      livingRoomWall(21, 'bottom', [1810, -2550], [1930, -2550], 180),
      livingRoomWall(22, 'left', [1930, -2550], [1930, 1050], 90),
      livingRoomWall(23, 'top', [1930, 1050], [1810, 1050], 0),
    ];
    const api = createApi({ rooms: { rooms: [{ ...room, walls }] } });
    const result = (await toolExecutors['get-plan-context'](api, {
      include: ['rooms'],
    })) as Record<string, any>;
    expect(result.rooms.rooms[0].corners).toEqual([
      { name: 'back left', point: [-3185, 0, -3765], posRotationY: 0 },
      { name: 'front left', point: [-3185, 0, 2235], posRotationY: 90 },
      { name: 'front right', point: [6320, 0, 2235], posRotationY: 180 },
      { name: 'back right', point: [6320, 0, -5265], posRotationY: 270 },
      { name: 'back left', point: [1935, 0, -5265], posRotationY: 0 },
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
      'masterData',
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
    expect(result.articles).toEqual([articleFixture, withoutCornerPoint]);
    expect(result.articles[1].cornerArticle).toBe(true);
  });

  it('passes the corner flag through as the planner reports it', async () => {
    const flagged = {
      ...articleFixture,
      articleId: 'flagged',
      category: 'Kitchen | Base Units | Storage',
      cornerArticle: true,
    };
    const namedOnly = {
      ...articleFixture,
      articleId: 'named-only',
      category: 'Kitchen handleless | Base Units | Corner',
      cornerArticle: false,
    };
    const api = createApi({ articles: [flagged, namedOnly] });
    const result = (await toolExecutors['get-plan-context'](api, {
      include: ['articles'],
    })) as Record<string, any>;
    expect(
      result.articles.map((article: any) => article.cornerArticle)
    ).toEqual([true, false]);
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

  describe('attribute vocabulary', () => {
    const white = { value: 'white', name: 'White', desc: 'White (#ffffff)' };
    const vocabularyMasterData = {
      'lib-1': {
        libraryId: 'lib-1',
        modules: [
          { id: 'module-1', name: 'Tall module', attributes: ['front'] },
        ],
        attributes: [
          {
            id: 'front',
            name: 'Front color',
            type: 'Text',
            selections: [white],
          },
          {
            id: 'carcase',
            name: 'Carcase color',
            type: 'Text',
            selections: [white],
          },
          { id: 'b', name: 'Width', type: 'Dim' },
        ],
        groupSettings: ['front'],
      },
    };

    it('returns the attribute vocabulary by default, a shared value list once, and no master data', async () => {
      const api = createApi({
        rooms: { rooms: [room] },
        articles: [],
        groups: [],
        masterData: vocabularyMasterData,
      });
      const result = (await toolExecutors['get-plan-context'](api, {})) as any;
      expect(api.extended.getExternalObjectPlanContext).toHaveBeenCalledWith([
        'rooms',
        'articles',
        'groups',
        'obstacles',
        'masterData',
      ]);
      expect(result.attributes).toEqual({
        'lib-1': [
          {
            id: 'front',
            name: 'Front color',
            type: 'Text',
            selections: [white],
          },
          {
            id: 'carcase',
            name: 'Carcase color',
            type: 'Text',
            sameSelectionsAs: 'front',
          },
          { id: 'b', name: 'Width', type: 'Dim' },
        ],
      });
      expect(result.masterData).toBeUndefined();
    });

    it('exposes a Bool generation switch without selections in the vocabulary and attribute search', async () => {
      const toggle = {
        id: 'generate-trim',
        name: 'Generate trim',
        desc: 'Enables generation of the trim on this unit',
        group: 'Generation',
        type: 'Bool',
      };
      const material = {
        id: 'trim-color',
        name: 'Trim color',
        desc: 'Color of the generated trim',
        type: 'Text',
        selections: [white],
      };
      const unit = { id: 'unit', name: 'Unit' };
      const trim = { id: 'trim', name: 'Trim' };
      const api = createApi({
        groups: [],
        masterData: {
          'lib-1': {
            libraryId: 'lib-1',
            modules: [
              { ...unit, attributes: [toggle.id] },
              { ...trim, attributes: [material.id] },
            ],
            attributes: [toggle, material],
          },
        },
      });

      const context = (await toolExecutors['get-plan-context'](api, {})) as any;
      expect(context.attributes['lib-1']).toEqual([toggle, material]);
      expect(context.masterData).toBeUndefined();
      expect(
        await toolExecutors['find-attributes'](api, { text: 'trim' })
      ).toEqual({
        matches: [
          { libraryId: 'lib-1', ...toggle, rootModules: [unit] },
          { libraryId: 'lib-1', ...material, rootModules: [trim] },
        ],
        total: 2,
      });
    });

    it('returns the master data as it is beside the vocabulary when both are requested', async () => {
      const api = createApi({ masterData: vocabularyMasterData });
      const result = (await toolExecutors['get-plan-context'](api, {
        include: ['masterData', 'attributes'],
      })) as any;
      expect(api.extended.getExternalObjectPlanContext).toHaveBeenCalledTimes(
        1
      );
      expect(api.extended.getExternalObjectPlanContext).toHaveBeenCalledWith([
        'masterData',
      ]);
      expect(result.masterData).toEqual(vocabularyMasterData);
      expect(result.attributes['lib-1'][1].sameSelectionsAs).toBe('front');
    });

    it('returns the vocabulary alone when only it is requested', async () => {
      const api = createApi({ masterData: vocabularyMasterData });
      const result = (await toolExecutors['get-plan-context'](api, {
        include: ['attributes'],
      })) as any;
      expect(api.extended.getExternalObjectPlanContext).toHaveBeenCalledWith([
        'masterData',
      ]);
      expect(Object.keys(result)).toEqual(['attributes']);
    });

    it('keeps the vocabulary out when the request names other sections', async () => {
      const api = createApi({ rooms: { rooms: [room] } });
      const result = (await toolExecutors['get-plan-context'](api, {
        include: ['rooms'],
      })) as any;
      expect(api.extended.getExternalObjectPlanContext).toHaveBeenCalledWith([
        'rooms',
      ]);
      expect(result.attributes).toBeUndefined();
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

describe('remaining tools', () => {
  it('returns a planning skill file without a planner call', async () => {
    const api = createApi({});
    const skill = (await toolExecutors['get-skill'](api, {
      name: 'kitchen-planning',
    })) as string;
    expect(skill).toMatch(/^---\nname: kitchen-planning\n/);
    expect(skill).not.toContain('\r');
    await expect(
      toolExecutors['get-skill'](api, {
        name: 'kitchen-planning',
        file: 'references/planning-reference.md',
      })
    ).resolves.toMatch(/^# Kitchen Planning Evidence and Constraints\n/);
    for (const method of Object.values(api.extended)) {
      expect(method).not.toHaveBeenCalled();
    }
  });

  it('rejects an unknown skill naming the skills available', async () => {
    await expect(
      toolExecutors['get-skill'](createApi({}), { name: 'bathroom-planning' })
    ).rejects.toThrow(
      'the skills are image-planning, kitchen-planning, kitchen-planning-fr, living-room-planning'
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

describe('plan changes', () => {
  // a planner command that takes a moment and records when it runs
  const recordingApi = (events: string[], failing: string[] = []) =>
    createApi(planContextFixture, {
      externalObjectGroupOperation: vi.fn(
        async (command: string, payload: any) => {
          const id = payload.rootModuleId ?? payload.rootModuleIds?.join(',');
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
    await Promise.all([
      toolExecutors['delete-article-in-place'](api, { rootModuleId: 'a' }),
      toolExecutors['get-plan-context'](api, { include: ['groups'] }),
    ]);
    // the first two reads are the change's own: the plan before and after
    // its step, for undo
    expect(events).toEqual([
      'plan context',
      'start a',
      'end a',
      'plan context',
      'plan context',
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

describe('tools that change the plan', () => {
  beforeEach(() => {
    planHistory.reset();
  });

  // the tools that change the plan, with arguments as an agent sends them
  const attributeCalls: [string, Record<string, unknown>][] = [
    [
      'change-module-attribute',
      { rootModuleIds: ['r1'], attributeId: 'b', value: 900 },
    ],
    [
      'change-group-attribute',
      { groupId: 'g1', attributes: [{ attributeId: 'front', value: 'white' }] },
    ],
  ];
  const toolCalls: [string, Record<string, unknown>][] = [
    [
      'create-or-replace-groups',
      {
        posGroups: [
          {
            libraryId: 'lib-1',
            placement: { wall: 'back', alignment: 'left' },
            roots: [
              { id: 'u1', articleId: 'article-1' },
              { id: 'u2', articleId: 'article-1', rightOf: 'u1' },
            ],
          },
        ],
      },
    ],
    ['place-group', { groupId: 'g1', wall: 'right', alignment: 'back' }],
    ['delete-group', { groupId: 'g1' }],
    ['delete-article-in-place', { rootModuleId: 'r1' }],
    ['delete-article-and-compact', { groupId: 'g1', rootModuleId: 'r1' }],
    [
      'merge-article-into-group',
      {
        groupId: 'g1',
        articleId: 'article-1',
        dockTo: {
          rootId: 'r1',
          ownDockingVector: 'RightBottom',
          dockingVector: 'LeftBottom',
        },
      },
    ],
    [
      'exchange-root-module',
      { groupId: 'g1', rootModuleId: 'r1', articleId: 'ARTICLE-1' },
    ],
    [
      'insert-article-into-group',
      { groupId: 'g1', articleId: 'article-1', between: ['r1', 'r2'] },
    ],
    ['swap-root-modules', { groupId: 'g1', rootModuleIds: ['r1', 'r2'] }],
    ['merge-groups', { targetGroupId: 'g1', groupIds: ['g2'] }],
  ];

  it.each(toolCalls)(
    'runs %s in the planner with its arguments as sent and returns the result without the planner steps',
    async (tool, args) => {
      const sent = structuredClone(args);
      const toolResult = {
        command: tool,
        groups: [makeShapedGroup()],
        removedGroupIds: [],
        corrections: [`${tool}: corrected by the planner`],
      };
      const api = createApi(planContextFixture, {
        externalObjectGroupOperation: vi.fn(async () => ({
          ...toolResult,
          historySteps: 2,
          historyFollowUps: 0,
        })),
      });

      const result = await toolExecutors[tool](api, args);

      expect(api.extended.externalObjectGroupOperation).toHaveBeenCalledOnce();
      expect(api.extended.externalObjectGroupOperation).toHaveBeenCalledWith(
        tool,
        sent
      );
      expect(args).toEqual(sent);
      expect(result).toEqual(toolResult);
      expect(planHistory.lastDone()).toMatchObject({ tool, steps: 2 });
    }
  );

  it.each(attributeCalls)(
    'runs %s in the planner with its arguments as sent and answers with the ids of what changed',
    async (tool, args) => {
      const sent = structuredClone(args);
      const corrections = [
        "mod_FrontProgram was changed to 'Modern' by the library",
      ];
      const api = createApi(planContextFixture, {
        externalObjectGroupOperation: vi.fn(async () => ({
          command: tool,
          groups: [
            makeShapedGroup({ id: 'g1' }),
            makeShapedGroup({ id: 'g2' }),
          ],
          removedGroupIds: [],
          changedModuleIds: ['m1', 'm2'],
          corrections,
          historySteps: 2,
          historyFollowUps: 0,
        })),
      });

      const result = await toolExecutors[tool](api, args);

      expect(api.extended.externalObjectGroupOperation).toHaveBeenCalledOnce();
      expect(api.extended.externalObjectGroupOperation).toHaveBeenCalledWith(
        tool,
        sent
      );
      expect(args).toEqual(sent);
      expect(result).toEqual({
        command: tool,
        groupIds: ['g1', 'g2'],
        changedModuleIds: ['m1', 'm2'],
        corrections,
      });
      expect(planHistory.lastDone()).toMatchObject({ tool, steps: 2 });
    }
  );

  it.each(attributeCalls)(
    'leaves the changed module ids and the corrections out of the answer of %s when there are none',
    async (tool, args) => {
      const api = createApi(planContextFixture, {
        externalObjectGroupOperation: vi.fn(async () => ({
          command: tool,
          groups: [makeShapedGroup()],
          removedGroupIds: [],
          changedModuleIds: [],
          corrections: [],
        })),
      });
      await expect(toolExecutors[tool](api, args)).resolves.toEqual({
        command: tool,
        groupIds: ['g1'],
      });
    }
  );

  it('counts a result without planner steps as one undo step', async () => {
    const api = createApi(planContextFixture);
    const result = await toolExecutors['delete-group'](api, { groupId: 'g1' });
    expect(result).toEqual({
      command: 'delete-group',
      groups: [],
      removedGroupIds: [],
    });
    expect(planHistory.lastDone()).toMatchObject({
      tool: 'delete-group',
      steps: 1,
    });
  });

  it('leaves no record for undo when the planner made no step', async () => {
    const api = createApi(planContextFixture, {
      externalObjectGroupOperation: vi.fn(async () => ({
        loaded: [],
        notLoaded: [{ index: 0, reason: 'nothing to build' }],
        historySteps: 0,
        historyFollowUps: 0,
      })),
    });
    await toolExecutors['create-or-replace-groups'](api, {
      posGroups: [{ roots: [{ id: 'u1', articleId: 'article-1' }] }],
    });

    const result = (await toolExecutors.undo(api, {})) as any;
    expect(result.undone).toBeNull();
    expect(result.hint).toMatch(/^Nothing to undo/);
    expect(api.extended.undo).not.toHaveBeenCalled();
  });

  it("relays the planner's rejection as the tool's error and records nothing", async () => {
    const api = createApi(planContextFixture, {
      externalObjectGroupOperation: vi.fn(async () => {
        throw new Error(
          'Invalid pos groups - nothing was loaded:\nposGroups[0]: needs a non-empty roots array'
        );
      }),
    });
    await expect(
      toolExecutors['create-or-replace-groups'](api, {
        posGroups: [{ roots: [] }],
      })
    ).rejects.toThrow(
      'Invalid pos groups - nothing was loaded:\nposGroups[0]: needs a non-empty roots array'
    );
    expect(planHistory.lastDone()).toBeUndefined();
  });

  it('records the steps of a tool that failed after it changed the plan and relays its error', async () => {
    const api = createApi(planContextFixture, {
      externalObjectGroupOperation: vi.fn(async () => ({
        error: 'The plan context could not be read.',
        historySteps: 1,
        historyFollowUps: 0,
      })),
    });
    await expect(
      toolExecutors['create-or-replace-groups'](api, {
        posGroups: [{ roots: [{ id: 'u1', articleId: 'article-1' }] }],
      })
    ).rejects.toThrow('The plan context could not be read.');
    expect(planHistory.lastDone()).toMatchObject({
      tool: 'create-or-replace-groups',
      steps: 1,
    });
  });
});

describe('undo and redo', () => {
  const initialGroup = {
    id: 'g1',
    libraryId: 'lib-1',
    attributes: [],
    roots: [{ id: 'r1', articleId: 'article-1' }],
  };

  // A planner with an undo history, relaying its history events like the
  // page. A tool runs in it as one call and one step of the history, whatever
  // it loads and runs - one event; the reload of a group command lands before
  // the planner answers and makes no event of its own. The call returns the
  // tool's result with historySteps 1, and the follow-ups an older planner
  // reports. Undo and redo fire one event, none when there is nothing to step.
  const historyPlanner = (
    options: {
      editDuringCall?: boolean;
      callDelayMs?: number;
      readDelayMs?: number;
      order?: string[];
    } = {}
  ) => {
    let groups: any[] = [initialGroup];
    let past: any[][] = [];
    let future: any[][] = [];
    let created = 0;
    const step = (next: any[]) => {
      past.push(groups);
      groups = next;
      future = [];
      planHistory.historyChanged();
    };
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    type Change = (current: any[]) => any[];
    const changeGroup =
      (id: string, change: (group: any) => any): Change =>
      (current) =>
        current.map((group) => (group.id === id ? change(group) : group));
    const withAttribute =
      (attributeId: string, value: unknown) => (group: any) => ({
        ...group,
        attributes: [{ id: attributeId, value }],
      });
    // the planner steps of a tool and the groups whose step has a follow-up
    const tools: Record<
      string,
      (args: any) => { steps: Change[]; followUps: string[] }
    > = {
      'create-or-replace-groups': ({ posGroups: [posGroup] }) => {
        const id = `new-${++created}`;
        return {
          steps: [
            (current) => [
              ...current,
              { id, libraryId: 'lib-1', attributes: [], roots: posGroup.roots },
            ],
            ...(posGroup.attributes
              ? [
                  changeGroup(id, (group) => ({
                    ...group,
                    attributes: posGroup.attributes,
                  })),
                ]
              : []),
            // the reload that moves the group against its wall
            ...(posGroup.placement?.wall
              ? [
                  changeGroup(id, (group) => ({
                    ...group,
                    pos: [1600, 0, -3000],
                  })),
                ]
              : []),
          ],
          followUps: posGroup.attributes ? [id] : [],
        };
      },
      'change-group-attribute': ({ groupId, attributeId, value }) => ({
        steps: [changeGroup(groupId, withAttribute(attributeId, value))],
        followUps: [groupId],
      }),
      // one group command per group of the root modules
      'change-module-attribute': ({ rootModuleIds, attributeId, value }) => {
        const ids = groups
          .filter((group) =>
            group.roots.some((root: any) => rootModuleIds.includes(root.id))
          )
          .map((group) => group.id);
        return {
          steps: ids.map((id) =>
            changeGroup(id, withAttribute(attributeId, value))
          ),
          followUps: ids,
        };
      },
      'delete-group': ({ groupId }) => ({
        steps: [(current) => current.filter((group) => group.id !== groupId)],
        followUps: [],
      }),
      'delete-article-and-compact': ({ groupId, rootModuleId }) => ({
        steps: [
          changeGroup(groupId, (group) => ({
            ...group,
            roots: group.roots.filter((root: any) => root.id !== rootModuleId),
          })),
        ],
        followUps: [groupId],
      }),
    };
    const api = createApi(planContextFixture, {
      getExternalObjectPlanContext: vi.fn(async () => {
        if (options.readDelayMs) {
          await delay(options.readDelayMs);
        }
        return { ...planContextFixture, groups };
      }),
      externalObjectGroupOperation: vi.fn(
        async (tool: string, args: any): Promise<any> => {
          options.order?.push(`${tool} start`);
          if (options.callDelayMs) {
            await delay(options.callDelayMs);
          }
          options.order?.push(`${tool} end`);
          if (args.attributeId === 'colour') {
            throw new Error(
              "No module of root module 'r1' has the attribute 'colour'."
            );
          }
          const { steps, followUps } = tools[tool](args);
          if (steps.length > 0) {
            step(steps.reduce((current, change) => change(current), groups));
          }
          if (options.editDuringCall) {
            step(groups.map((group) => ({ ...group, moved: true })));
          }
          // the reload the kernel's position answer causes, within the step
          for (const id of followUps) {
            groups = changeGroup(id, (group) => ({
              ...group,
              pos: [0, 0, 10],
            }))(groups);
          }
          return {
            command: tool,
            groups,
            removedGroupIds: tool === 'delete-group' ? [args.groupId] : [],
            historySteps: steps.length > 0 ? 1 : 0,
            historyFollowUps: followUps.length,
          };
        }
      ),
      undo: vi.fn(async () => {
        options.order?.push('undo');
        const previous = past.pop();
        if (!previous) {
          return;
        }
        future.push(groups);
        groups = previous;
        planHistory.historyChanged();
      }),
      redo: vi.fn(async () => {
        const next = future.pop();
        if (!next) {
          return;
        }
        past.push(groups);
        groups = next;
        planHistory.historyChanged();
      }),
    });
    return {
      api,
      groups: () => groups,
      // the user changes the plan in the planner
      editInPlanner: () =>
        step(groups.map((group) => ({ ...group, moved: true }))),
      // the plan changes without a history event
      changeWithoutEvent: () => {
        groups = groups.map((group) => ({ ...group, recalculated: true }));
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
  const createRow = (planner: ReturnType<typeof historyPlanner>) =>
    toolExecutors['create-or-replace-groups'](planner.api, {
      posGroups: [
        { libraryId: 'lib-1', roots: [{ id: 'u1', articleId: 'article-1' }] },
      ],
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
      groups: [initialGroup],
    });
    expect(planner.groups()).toEqual([initialGroup]);
  });

  it('returns the groups the reverted call changed, and the others by their id', async () => {
    const planner = historyPlanner();
    await createRow(planner);
    await changeFront(planner);
    const result = (await toolExecutors.undo(planner.api, {})) as any;
    expect(result).toEqual({
      undone: 'change-group-attribute',
      groups: [initialGroup],
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

  it('reverts a create with materials with one planner undo', async () => {
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
    expect(planHistory.lastDone()?.steps).toBe(1);

    const result = (await toolExecutors.undo(planner.api, {})) as any;
    expect(planner.api.extended.undo).toHaveBeenCalledTimes(1);
    expect(result.undone).toBe('create-or-replace-groups');
    expect(planner.groups()).toEqual([initialGroup]);
  });

  it('reverts a new group placed by wall, its load and its reload, with one planner undo', async () => {
    const planner = historyPlanner();
    await toolExecutors['create-or-replace-groups'](planner.api, {
      posGroups: [
        {
          libraryId: 'lib-1',
          placement: { wall: 'back' },
          roots: [{ id: 'u1', articleId: 'article-1' }],
        },
      ],
    });
    expect(planner.groups()[1].pos).toEqual([1600, 0, -3000]);

    const result = (await toolExecutors.undo(planner.api, {})) as any;
    expect(planner.api.extended.undo).toHaveBeenCalledTimes(1);
    expect(result.undone).toBe('create-or-replace-groups');
    expect(planner.groups()).toEqual([initialGroup]);
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
      groups: [initialGroup],
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

  it('keeps redo after a call that made no planner step', async () => {
    const planner = historyPlanner();
    await changeFront(planner);
    await toolExecutors.undo(planner.api, {});
    planner.api.extended.externalObjectGroupOperation.mockResolvedValueOnce({
      loaded: [],
      notLoaded: [{ index: 0, reason: 'nothing to build' }],
      historySteps: 0,
      historyFollowUps: 0,
    });
    await createRow(planner);

    const result = (await toolExecutors.redo(planner.api, {})) as any;
    expect(result.redone).toBe('change-group-attribute');
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
    await createRow(planner);
    const afterCall = planner.groups();
    const result = (await toolExecutors.undo(planner.api, {})) as any;

    expect(planner.api.extended.undo).toHaveBeenCalledTimes(1);
    expect(planner.api.extended.redo).toHaveBeenCalledTimes(1);
    expect(result.undone).toBeNull();
    expect(result.hint).toBe(
      "Undo of create-or-replace-groups did not give back the plan before it - the plan was changed in the planner while the tool call ran. The undo was taken back and the plan is as it was; the planner's undo button reverts the changes made there."
    );
    expect(planner.groups()).toEqual(afterCall);
    const again = (await toolExecutors.undo(planner.api, {})) as any;
    expect(again.hint).toMatch(/changed in the planner/);
  });

  it('records a call as soon as it resolves, whatever follow-ups its result reports', async () => {
    // the planner answers after its reload; an older planner still reports
    // the reload as a follow-up
    const planner = historyPlanner();
    const started = Date.now();
    await changeFront(planner);
    expect(Date.now() - started).toBeLessThan(500);
    expect(planHistory.lastDone()).toMatchObject({
      tool: 'change-group-attribute',
      steps: 1,
    });
    expect(planHistory.lastDone()?.groupsAfter).toContain('"pos":[0,0,10]');
  });

  it('reverts an attribute change right after it with one planner undo', async () => {
    const planner = historyPlanner();
    await changeFront(planner);
    const result = (await toolExecutors.undo(planner.api, {})) as any;

    expect(planner.api.extended.undo).toHaveBeenCalledTimes(1);
    expect(result.undone).toBe('change-group-attribute');
    expect(result.hint).toBeUndefined();
    expect(planner.groups()).toEqual([initialGroup]);
  });

  it('runs undo in the queue, never beside another plan change', async () => {
    const order: string[] = [];
    const planner = historyPlanner({ callDelayMs: 20, order });
    await changeFront(planner);
    const [, result] = (await Promise.all([
      createRow(planner),
      toolExecutors.undo(planner.api, {}),
    ])) as any[];

    expect(order).toEqual([
      'change-group-attribute start',
      'change-group-attribute end',
      'create-or-replace-groups start',
      'create-or-replace-groups end',
      'undo',
    ]);
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
