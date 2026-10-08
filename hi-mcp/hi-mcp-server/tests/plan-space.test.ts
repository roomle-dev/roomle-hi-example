import { describe, expect, it } from 'vitest';
import {
  adjoiningWall,
  alignmentRunsParallel,
  convexHull,
  convexPolygonsTouch,
  freeStretchesAlongWall,
  groupCornerGeometry,
  groupFootprint,
  groupHeightRange,
  placeAgainstWall,
  placeCornerAtWalls,
  pointInsideRoom,
  repositioningFromPlacement,
  resolveWallAlignment,
  roomCorners,
  roomOfPoint,
  rootVolumesInRoom,
  spanAlongWall,
  stripInFrontOfWall,
  volumesOverlap,
  wallName,
  wallOfOpening,
  wallOfRoot,
  wallSpanStart,
  type DerivedWall,
  type GroupFootprint,
  type RootVolume,
} from '../plan-space';

const IDENTITY_MATRIX = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

const WALL_RIGHT: DerivedWall = {
  index: 1,
  side: 'right',
  start: [4000, 0, 0],
  end: [4000, 0, -3000],
  lengthMm: 3000,
  type: 'wall',
  facingRotationY: 270,
};

const WALL_TOP: DerivedWall = {
  index: 2,
  side: 'top',
  start: [4000, 0, -3000],
  end: [0, 0, -3000],
  lengthMm: 4000,
  type: 'wall',
  facingRotationY: 0,
};

const FOOTPRINT: GroupFootprint = {
  x: [0, 800],
  z: [0, 600],
  widthMm: 800,
  depthMm: 600,
};

describe('groupFootprint', () => {
  it('derives the bounding box from part boxes transformed by the root', () => {
    const root = {
      id: 'r1',
      articlePos: [100, 0, 200],
      rotationY: 0,
      parts: [
        {
          relPos: [0, 0, 0],
          dim: [800, 720, 600],
          fullMatrix: IDENTITY_MATRIX,
        },
      ],
    };
    expect(groupFootprint({ roots: [root] })).toEqual({
      x: [100, 900],
      z: [200, 800],
      widthMm: 800,
      depthMm: 600,
    });
  });

  it('treats part matrices as group space when ver is positive', () => {
    const root = {
      id: 'r1',
      articlePos: [100, 0, 200],
      rotationY: 0,
      parts: [
        {
          relPos: [0, 0, 0],
          dim: [800, 720, 600],
          fullMatrix: IDENTITY_MATRIX,
        },
      ],
    };
    expect(groupFootprint({ ver: 1, roots: [root] })).toEqual({
      x: [0, 800],
      z: [0, 600],
      widthMm: 800,
      depthMm: 600,
    });
  });

  it('falls back to docking vector points', () => {
    const root = {
      id: 'r1',
      articlePos: [10, 0, 20],
      rotationY: 0,
      dockInfos: [
        { id: 'LeftBottom', start: [0, 0, 600], end: [600, 0, 600] },
        { id: 'RightBottom', start: [0, 0, 0], end: [600, 0, 0] },
      ],
    };
    expect(groupFootprint({ roots: [root] })).toEqual({
      x: [10, 610],
      z: [20, 620],
      widthMm: 600,
      depthMm: 600,
    });
  });

  it('falls back to the b/t dimension attributes', () => {
    const root = {
      id: 'r1',
      articlePos: [10, 0, 20],
      rotationY: 0,
      attributes: [
        { id: 'b', value: 800 },
        { id: 't', value: 600 },
      ],
    };
    expect(groupFootprint({ roots: [root] })).toEqual({
      x: [10, 810],
      z: [20, 620],
      widthMm: 800,
      depthMm: 600,
    });
  });

  it('returns undefined for a group without geometry', () => {
    expect(groupFootprint({})).toBeUndefined();
    expect(groupFootprint({ roots: [{ id: 'r1' }] })).toBeUndefined();
  });
});

describe('groupHeightRange', () => {
  it('derives the height from part boxes', () => {
    const group = {
      roots: [
        {
          articlePos: [0, 100, 0],
          parts: [
            {
              relPos: [0, 0, 0],
              dim: [600, 720, 560],
              fullMatrix: IDENTITY_MATRIX,
            },
          ],
        },
      ],
    };
    expect(groupHeightRange(group)).toEqual([100, 820]);
  });

  it('falls back to docking vector points and the height attribute', () => {
    expect(
      groupHeightRange({
        roots: [{ dockInfos: [{ start: [0, 0, 0], end: [0, 720, 0] }] }],
      })
    ).toEqual([0, 720]);
    expect(
      groupHeightRange({
        roots: [
          { articlePos: [0, 1400, 0], attributes: [{ id: 'h', value: 700 }] },
        ],
      })
    ).toEqual([1400, 2100]);
  });

  it('returns undefined without height data', () => {
    expect(
      groupHeightRange({ roots: [{ attributes: [{ id: 'b', value: 600 }] }] })
    ).toBeUndefined();
    expect(
      groupHeightRange({
        roots: [{ dockInfos: [{ start: [0, 0, 0], end: [0, 0, 600] }] }],
      })
    ).toBeUndefined();
  });
});

describe('volumesOverlap', () => {
  const square = (x: number): [number, number][] => [
    [x, 0],
    [x + 600, 0],
    [x + 600, 600],
    [x, 600],
  ];

  it('counts footprints and heights that overlap', () => {
    expect(
      volumesOverlap(
        { corners: square(0), heights: [0, 900] },
        { corners: square(300), heights: [0, 2000] },
        5
      )
    ).toBe(true);
  });

  it('does not count touching groups, groups above each other or groups without height data', () => {
    expect(
      volumesOverlap(
        { corners: square(0), heights: [0, 900] },
        { corners: square(600), heights: [0, 900] },
        5
      )
    ).toBe(false);
    expect(
      volumesOverlap(
        { corners: square(0), heights: [0, 900] },
        { corners: square(0), heights: [1400, 2100] },
        5
      )
    ).toBe(false);
    expect(
      volumesOverlap(
        { corners: square(0) },
        { corners: square(0), heights: [0, 900] },
        5
      )
    ).toBe(false);
  });
});

describe('spanAlongWall and wallSpanStart', () => {
  it('measures room points along the wall from its start', () => {
    expect(
      spanAlongWall(WALL_RIGHT, [
        [3400, -1100],
        [4000, -1900],
      ])
    ).toEqual([1100, 1900]);
  });

  it('starts the span where the alignment puts the group', () => {
    expect(wallSpanStart(WALL_RIGHT, FOOTPRINT, 'center', 0)).toBe(1100);
    expect(wallSpanStart(WALL_RIGHT, FOOTPRINT, 'start', 200)).toBe(200);
    expect(wallSpanStart(WALL_RIGHT, FOOTPRINT, 'end', 0)).toBe(2200);
  });
});

describe('wallOfOpening', () => {
  // the right wall split at a door: a stub, the opening and the long wall
  const splitRight: DerivedWall[] = [
    { ...WALL_RIGHT, end: [4000, 0, -100], lengthMm: 100 },
    {
      ...WALL_RIGHT,
      index: 2,
      start: [4000, 0, -100],
      end: [4000, 0, -1000],
      lengthMm: 900,
      type: 'opening',
    },
    {
      ...WALL_RIGHT,
      index: 3,
      start: [4000, 0, -1000],
      lengthMm: 2000,
    },
  ];

  it('finds the wall a window lies in and measures its span from the end of the wall', () => {
    // behind the back wall, x 1000 to 2000
    const window: [number, number][] = [
      [2000, -3120],
      [1000, -3120],
      [1000, -3000],
      [2000, -3000],
    ];
    expect(wallOfOpening(window, [{ walls: [WALL_RIGHT, WALL_TOP] }])).toEqual({
      roomIndex: 0,
      wall: 2,
      fromEndMm: [1000, 2000],
    });
  });

  it('takes the wall entry the outline runs along the longest', () => {
    // 100 mm along the opening, 500 mm along the wall after it
    const window: [number, number][] = [
      [4120, -900],
      [4120, -1500],
      [4000, -1500],
      [4000, -900],
    ];
    expect(wallOfOpening(window, [{ walls: splitRight }])).toEqual({
      roomIndex: 0,
      wall: 3,
      fromEndMm: [1500, 2000],
    });
  });

  it('ignores a wall the outline only touches at its end', () => {
    // a door in the right wall at the back right corner
    const door: [number, number][] = [
      [4100, -3000],
      [4100, -2100],
      [4000, -2100],
      [4000, -3000],
    ];
    expect(wallOfOpening(door, [{ walls: [WALL_TOP, WALL_RIGHT] }])).toEqual({
      roomIndex: 0,
      wall: 1,
      fromEndMm: [0, 900],
    });
  });

  it('accepts an outline within the thickness of the wall and none away from every wall', () => {
    const inTheWall: [number, number][] = [
      [2000, -3100],
      [1000, -3100],
      [1000, -3220],
      [2000, -3220],
    ];
    expect(wallOfOpening(inTheWall, [{ walls: [WALL_TOP] }])).toBeUndefined();
    expect(
      wallOfOpening(inTheWall, [{ walls: [{ ...WALL_TOP, thicknessMm: 120 }] }])
    ).toEqual({ roomIndex: 0, wall: 2, fromEndMm: [1000, 2000] });
    const chair: [number, number][] = [
      [1500, -1500],
      [2000, -1500],
      [2000, -1000],
      [1500, -1000],
    ];
    expect(
      wallOfOpening(chair, [{ walls: [WALL_RIGHT, WALL_TOP] }])
    ).toBeUndefined();
  });
});

describe('convexHull', () => {
  // an L-shaped sofa, and a unit in its bounding box beyond the hull
  const lShaped: [number, number][] = [
    [1000, -2500],
    [3000, -2500],
    [3000, -2000],
    [1500, -2000],
    [1500, -1000],
    [1000, -1000],
  ];
  const unit = {
    corners: [
      [2400, -1500],
      [2900, -1500],
      [2900, -1100],
      [2400, -1100],
    ] as [number, number][],
    heights: [0, 720] as [number, number],
  };

  it('drops the notch of an L-shaped outline, so a unit beyond the hull overlaps nothing', () => {
    const hull = convexHull(lShaped);
    expect(hull).toHaveLength(5);
    expect(hull).toEqual(
      expect.arrayContaining([
        [1000, -2500],
        [3000, -2500],
        [3000, -2000],
        [1500, -1000],
        [1000, -1000],
      ])
    );
    // the separating-axis test needs a convex outline
    expect(
      volumesOverlap(unit, { corners: lShaped, heights: [0, 800] }, 5)
    ).toBe(true);
    expect(volumesOverlap(unit, { corners: hull, heights: [0, 800] }, 5)).toBe(
      false
    );
  });
});

describe('rootVolumesInRoom', () => {
  const cabinet = (overrides: Record<string, unknown> = {}) => ({
    id: 'r1',
    articleId: 'base-60',
    articlePos: [0, 0, 0],
    rotationY: 0,
    parts: [
      { relPos: [0, 0, 0], dim: [600, 720, 560], fullMatrix: IDENTITY_MATRIX },
    ],
    ...overrides,
  });
  const rounded = (corners: [number, number][]) =>
    corners.map(([x, z]) => [Math.round(x) + 0, Math.round(z) + 0]);

  it('turns the box of each root module into room space with its height and rotation', () => {
    const volumes = rootVolumesInRoom({
      pos: [1000, 0, -3000],
      rotationY: 90,
      roots: [
        cabinet(),
        // a root module of the other leg of an L
        cabinet({ id: 'r2', rotationY: 90 }),
        cabinet({ id: 'worktop', isGenerated: true }),
      ],
    });
    expect(
      volumes.map(({ corners, ...volume }) => ({
        ...volume,
        corners: rounded(corners),
      }))
    ).toEqual([
      {
        id: 'r1',
        articleId: 'base-60',
        corners: [
          [1000, -3000],
          [1000, -3600],
          [1560, -3600],
          [1560, -3000],
        ],
        heights: [0, 720],
        rotationY: 90,
      },
      {
        id: 'r2',
        articleId: 'base-60',
        corners: [
          [400, -3000],
          [400, -3560],
          [1000, -3560],
          [1000, -3000],
        ],
        heights: [0, 720],
        rotationY: 180,
      },
    ]);
  });
});

describe('stripInFrontOfWall', () => {
  it('lies in front of the span, into the room', () => {
    expect(stripInFrontOfWall(WALL_TOP, [1000, 2000], 600)).toEqual([
      [1000, -3000],
      [2000, -3000],
      [2000, -2400],
      [1000, -2400],
    ]);
  });
});

const rootVolume = (
  [minX, maxX]: [number, number],
  [minZ, maxZ]: [number, number],
  heights: [number, number],
  rotationY: number
): RootVolume => ({
  id: 'r1',
  corners: [
    [minX, minZ],
    [maxX, minZ],
    [maxX, maxZ],
    [minX, maxZ],
  ],
  heights,
  rotationY,
});

describe('wallOfRoot', () => {
  it('finds the wall a root module faces away from', () => {
    const walls = [WALL_RIGHT, WALL_TOP, WALL_LEFT];
    const baseUnit = rootVolume([1000, 1600], [-3000, -2400], [0, 720], 0);
    expect(wallOfRoot(walls, baseUnit, 600)).toBe(WALL_TOP);
    // in the back left corner, turned like the left wall
    const cornerUnit = rootVolume([0, 600], [-3000, -2400], [0, 720], 90);
    expect(wallOfRoot(walls, cornerUnit, 600)).toBe(WALL_LEFT);
    // a dishwasher stands 13 mm off the wall
    const offTheWall = rootVolume([1000, 1600], [-2987, -2387], [0, 720], 0);
    expect(wallOfRoot(walls, offTheWall, 600)).toBe(WALL_TOP);
    const island = rootVolume([1000, 1600], [-2000, -1400], [0, 720], 0);
    expect(wallOfRoot(walls, island, 600)).toBeUndefined();
  });
});

describe('freeStretchesAlongWall', () => {
  const windowStrip = {
    corners: stripInFrontOfWall(WALL_TOP, [1500, 2500], 600),
    heights: [950, 2170] as [number, number],
  };

  it('leaves out what stands in front of the wall at its height', () => {
    const wallUnit = rootVolume([1000, 1600], [-3000, -2650], [1480, 2200], 0);
    expect(
      freeStretchesAlongWall(WALL_TOP, wallUnit, [windowStrip], 5)
    ).toEqual([
      [0, 1500],
      [2500, 4000],
    ]);
    // below the window's sill
    const baseUnit = rootVolume([1000, 1600], [-3000, -2400], [0, 720], 0);
    expect(
      freeStretchesAlongWall(WALL_TOP, baseUnit, [windowStrip], 5)
    ).toEqual([[0, 4000]]);
    // deeper in the room than the wall unit, and a gap of 300 mm beside it
    const deeper = {
      corners: [
        [3000, -2500],
        [3500, -2500],
        [3500, -2000],
        [3000, -2000],
      ] as [number, number][],
      heights: [0, 2000] as [number, number],
    };
    const atTheWall = {
      corners: [
        [300, -3000],
        [1500, -3000],
        [1500, -2700],
        [300, -2700],
      ] as [number, number][],
      heights: [0, 2200] as [number, number],
    };
    expect(
      freeStretchesAlongWall(
        WALL_TOP,
        wallUnit,
        [windowStrip, deeper, atTheWall],
        5
      )
    ).toEqual([[2500, 4000]]);
  });
});

describe('alignmentRunsParallel', () => {
  it('tells an alignment that names no corner of the wall', () => {
    expect(alignmentRunsParallel(WALL_RIGHT, 'right')).toBe(true);
    expect(alignmentRunsParallel(WALL_RIGHT, 'left')).toBe(true);
    expect(alignmentRunsParallel(WALL_RIGHT, 'top')).toBe(false);
  });
});

describe('resolveWallAlignment', () => {
  it('passes start/center/end through', () => {
    expect(resolveWallAlignment(WALL_RIGHT, 'start')).toBe('start');
    expect(resolveWallAlignment(WALL_RIGHT, 'center')).toBe('center');
    expect(resolveWallAlignment(WALL_RIGHT, 'end')).toBe('end');
  });

  it('resolves a side label to the wall end sharing that corner', () => {
    expect(resolveWallAlignment(WALL_RIGHT, 'top')).toBe('end');
    expect(resolveWallAlignment(WALL_RIGHT, 'bottom')).toBe('start');
  });

  it('rejects an alignment that runs parallel to the wall', () => {
    expect(() => resolveWallAlignment(WALL_RIGHT, 'left')).toThrow(/parallel/);
  });
});

describe('placeAgainstWall', () => {
  it('places the footprint centered against the wall', () => {
    expect(placeAgainstWall(WALL_RIGHT, FOOTPRINT, 'center', 0)).toEqual({
      pos: [4000, 0, -1900],
      rotationY: 270,
    });
  });

  it('honours start/end alignment and the offset along the wall', () => {
    expect(placeAgainstWall(WALL_RIGHT, FOOTPRINT, 'start', 0)).toEqual({
      pos: [4000, 0, -800],
      rotationY: 270,
    });
    expect(placeAgainstWall(WALL_RIGHT, FOOTPRINT, 'end', 100)).toEqual({
      pos: [4000, 0, -2900],
      rotationY: 270,
    });
    expect(placeAgainstWall(WALL_RIGHT, FOOTPRINT, 'start', 50)).toEqual({
      pos: [4000, 0, -850],
      rotationY: 270,
    });
  });

  it('resolves a side-label alignment flush into the corner', () => {
    expect(placeAgainstWall(WALL_RIGHT, FOOTPRINT, 'top', 0)).toEqual({
      pos: [4000, 0, -3000],
      rotationY: 270,
    });
  });
});

describe('placeCornerAtWalls', () => {
  const corner = {
    rootId: 'c1',
    point: [0, 0] as [number, number],
    directions: [
      [1, 0],
      [0, -1],
    ] as [[number, number], [number, number]],
  };

  it('puts the corner point into the room corner with the back edges along both walls', () => {
    expect(placeCornerAtWalls(WALL_RIGHT, WALL_TOP, corner, 0)).toEqual({
      pos: [4000, 0, -3000],
      rotationY: 180,
    });
  });

  it('shifts along the wall by the offset', () => {
    expect(placeCornerAtWalls(WALL_RIGHT, WALL_TOP, corner, 200)).toEqual({
      pos: [4000, 0, -2800],
      rotationY: 180,
    });
  });
});

describe('convexPolygonsTouch', () => {
  const squareA = [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ] as [number, number][];

  it('detects separated polygons as not touching', () => {
    const far = [
      [500, 500],
      [600, 500],
      [600, 600],
      [500, 600],
    ] as [number, number][];
    expect(convexPolygonsTouch(squareA, far, 5)).toBe(false);
  });

  it('counts flush contact as touching', () => {
    const flush = [
      [100, 0],
      [200, 0],
      [200, 100],
      [100, 100],
    ] as [number, number][];
    expect(convexPolygonsTouch(squareA, flush, 0)).toBe(true);
  });

  it('detects overlap', () => {
    const overlap = [
      [50, 0],
      [150, 0],
      [150, 100],
      [50, 100],
    ] as [number, number][];
    expect(convexPolygonsTouch(squareA, overlap, 0)).toBe(true);
  });

  it('bridges gaps up to the tolerance', () => {
    const near = [
      [104, 0],
      [204, 0],
      [204, 100],
      [104, 100],
    ] as [number, number][];
    expect(convexPolygonsTouch(squareA, near, 5)).toBe(true);
    expect(convexPolygonsTouch(squareA, near, 0)).toBe(false);
  });

  it('returns false for degenerate polygons', () => {
    expect(
      convexPolygonsTouch(
        [
          [0, 0],
          [1, 1],
        ],
        squareA,
        5
      )
    ).toBe(false);
  });
});

describe('groupCornerGeometry', () => {
  it('derives the corner point and the two back edge directions', () => {
    const root = {
      id: 'c1',
      articlePos: [100, 0, 200],
      rotationY: 0,
      dockInfos: [
        { id: 'LeftBackBottom', start: [0, 0, 600], end: [600, 0, 600] },
        { id: 'RightBackBottom', start: [0, 0, 600], end: [0, 0, 0] },
      ],
    };
    expect(groupCornerGeometry({ roots: [root] })).toEqual({
      rootId: 'c1',
      point: [100, 800],
      directions: [
        [1, 0],
        [0, -1],
      ],
    });
  });

  it('returns undefined for a group without a corner article', () => {
    const root = {
      id: 'r1',
      dockInfos: [
        { id: 'LeftBottom', start: [0, 0, 600], end: [600, 0, 600] },
        { id: 'RightBottom', start: [0, 0, 0], end: [600, 0, 0] },
      ],
    };
    expect(groupCornerGeometry({ roots: [root] })).toBeUndefined();
    expect(groupCornerGeometry({})).toBeUndefined();
  });
});

describe('repositioningFromPlacement', () => {
  const placement = {
    pos: [1000, 0, -2000] as [number, number, number],
    rotationY: 270,
  };

  it('transforms the anchor into the room and sums the rotations', () => {
    expect(
      repositioningFromPlacement(placement, {
        id: 'r1',
        articlePos: [800, 0, 0],
        rotationY: 90,
      })
    ).toEqual({
      posGroup: [1000, 0, -1200],
      posRotationY: 0,
      rootId: 'r1',
    });
  });

  it('defaults a root without its own transform to the placement', () => {
    expect(repositioningFromPlacement(placement, { id: 'r2' })).toEqual({
      posGroup: [1000, 0, -2000],
      posRotationY: 270,
      rootId: 'r2',
    });
  });
});

// the 4000 x 3000 mm room of the tool tests, contour counter-clockwise
const WALL_BOTTOM: DerivedWall = {
  index: 0,
  side: 'bottom',
  start: [0, 0, 0],
  end: [4000, 0, 0],
  lengthMm: 4000,
  type: 'wall',
  facingRotationY: 180,
};

const WALL_LEFT: DerivedWall = {
  index: 3,
  side: 'left',
  start: [0, 0, -3000],
  end: [0, 0, 0],
  lengthMm: 3000,
  type: 'wall',
  facingRotationY: 90,
};

const ROOM_WALLS = [WALL_BOTTOM, WALL_RIGHT, WALL_TOP, WALL_LEFT];

describe('roomCorners', () => {
  // the 4000 x 3000 room, counter-clockwise: front, right, back, left
  const wall = (
    index: number,
    side: DerivedWall['side'],
    start: [number, number, number],
    end: [number, number, number],
    facingRotationY: number,
    type: string | null = 'wall'
  ): DerivedWall => ({
    index,
    side,
    start,
    end,
    lengthMm: Math.hypot(end[0] - start[0], end[2] - start[2]),
    type: type as string | undefined,
    facingRotationY,
  });
  const rectangle = [
    wall(0, 'bottom', [0, 0, 0], [4000, 0, 0], 180),
    wall(1, 'right', [4000, 0, 0], [4000, 0, -3000], 270),
    wall(2, 'top', [4000, 0, -3000], [0, 0, -3000], 0),
    wall(3, 'left', [0, 0, -3000], [0, 0, 0], 90),
  ];

  it('lists the four corners of a rectangular room with their names and rotations', () => {
    expect(roomCorners(rectangle)).toEqual([
      { name: 'front right', point: [4000, 0, 0], posRotationY: 180 },
      { name: 'back right', point: [4000, 0, -3000], posRotationY: 270 },
      { name: 'back left', point: [0, 0, -3000], posRotationY: 0 },
      { name: 'front left', point: [0, 0, 0], posRotationY: 90 },
    ]);
  });

  it('still lists four corners when a door splits a wall, and none between collinear walls', () => {
    const withDoor = [
      rectangle[0],
      wall(1, 'right', [4000, 0, 0], [4000, 0, -100], 270),
      wall(2, 'right', [4000, 0, -100], [4000, 0, -1000], 270, null),
      wall(3, 'right', [4000, 0, -1000], [4000, 0, -3000], 270),
      { ...rectangle[2], index: 4 },
      { ...rectangle[3], index: 5 },
    ];
    expect(roomCorners(withDoor).map((corner) => corner.name)).toEqual([
      'front right',
      'back right',
      'back left',
      'front left',
    ]);
    const split = [
      rectangle[0],
      wall(1, 'right', [4000, 0, 0], [4000, 0, -1000], 270),
      wall(2, 'right', [4000, 0, -1000], [4000, 0, -3000], 270),
      { ...rectangle[2], index: 3 },
      { ...rectangle[3], index: 4 },
    ];
    expect(roomCorners(split)).toHaveLength(4);
  });

  it('names the walls in the words of the top view', () => {
    expect((['top', 'bottom', 'left', 'right'] as const).map(wallName)).toEqual(
      ['back wall', 'front wall', 'left wall', 'right wall']
    );
  });
});

describe('pointInsideRoom and roomOfPoint', () => {
  const wall = (
    index: number,
    side: DerivedWall['side'],
    start: [number, number, number],
    end: [number, number, number],
    facingRotationY: number
  ): DerivedWall => ({
    index,
    side,
    start,
    end,
    lengthMm: Math.hypot(end[0] - start[0], end[2] - start[2]),
    type: 'wall',
    facingRotationY,
  });
  const rectangle = [
    wall(0, 'bottom', [0, 0, 0], [4000, 0, 0], 180),
    wall(1, 'right', [4000, 0, 0], [4000, 0, -3000], 270),
    wall(2, 'top', [4000, 0, -3000], [0, 0, -3000], 0),
    wall(3, 'left', [0, 0, -3000], [0, 0, 0], 90),
  ];
  // an L-shaped room: the rectangle without its back right quarter
  const lShaped = [
    wall(0, 'bottom', [0, 0, 0], [4000, 0, 0], 180),
    wall(1, 'right', [4000, 0, 0], [4000, 0, -1500], 270),
    wall(2, 'top', [4000, 0, -1500], [2000, 0, -1500], 0),
    wall(3, 'right', [2000, 0, -1500], [2000, 0, -3000], 270),
    wall(4, 'top', [2000, 0, -3000], [0, 0, -3000], 0),
    wall(5, 'left', [0, 0, -3000], [0, 0, 0], 90),
  ];

  it('tells a point inside the room from one outside, with a tolerance at the walls', () => {
    expect(pointInsideRoom([2000, -1500], rectangle, 5)).toBe(true);
    expect(pointInsideRoom([4003, -1500], rectangle, 5)).toBe(true);
    expect(pointInsideRoom([4020, -1500], rectangle, 5)).toBe(false);
    expect(pointInsideRoom([2000, -3600], rectangle, 5)).toBe(false);
  });

  it('knows the cut-out of an L-shaped room, which lies inside the bounding box of its walls', () => {
    expect(pointInsideRoom([3000, -2500], lShaped, 5)).toBe(false);
    expect(pointInsideRoom([1000, -2500], lShaped, 5)).toBe(true);
    expect(pointInsideRoom([3000, -1000], lShaped, 5)).toBe(true);
  });

  it('finds the room whose floor holds a point', () => {
    const rooms = [
      { id: 'a', walls: rectangle },
      {
        id: 'b',
        walls: rectangle.map((w) => ({
          ...w,
          start: [w.start[0] + 10000, 0, w.start[2]] as [
            number,
            number,
            number,
          ],
          end: [w.end[0] + 10000, 0, w.end[2]] as [number, number, number],
        })),
      },
    ];
    expect(roomOfPoint(rooms, [12000, -1500], 5)?.id).toBe('b');
    expect(roomOfPoint(rooms, [2000, -1500], 5)?.id).toBe('a');
    expect(roomOfPoint(rooms, [7000, -1500], 5)).toBeUndefined();
  });
});

describe('adjoiningWall', () => {
  it('finds the wall on that side sharing a corner with the wall', () => {
    expect(adjoiningWall(ROOM_WALLS, WALL_RIGHT, 'top')).toBe(WALL_TOP);
    expect(adjoiningWall(ROOM_WALLS, WALL_RIGHT, 'bottom')).toBe(WALL_BOTTOM);
    expect(adjoiningWall(ROOM_WALLS, WALL_RIGHT, 'left')).toBeUndefined();
    expect(
      adjoiningWall([{ ...WALL_TOP, type: 'window' }], WALL_RIGHT, 'top')
    ).toBeUndefined();
  });
});

describe('the Furniture_Smith corner article in the room corners', () => {
  // mr_CornerunitStraight as calculated: the corner point lies 261 mm left of
  // the root origin, the left arm's back edge runs to the front
  const cornerRoot = {
    id: 'c1',
    articlePos: [0, 0, 0],
    rotationY: 0,
    dockInfos: [
      { id: 'LeftBackBottom', start: [-261, 0, 0], end: [-261, 0, 661] },
      { id: 'RightBackBottom', start: [-261, 0, 0], end: [900, 0, 0] },
    ],
  };
  const cornerPointInRoom = ({
    pos,
    rotationY,
  }: {
    pos: number[];
    rotationY: number;
  }) => {
    const theta = (rotationY * Math.PI) / 180;
    return [
      Math.round(pos[0] - 261 * Math.cos(theta)) + 0,
      Math.round(pos[2] + 261 * Math.sin(theta)) + 0,
    ];
  };

  it.each([
    ['back right', WALL_RIGHT, WALL_TOP, [4000, 0, -2739], 270, [4000, -3000]],
    ['back left', WALL_TOP, WALL_LEFT, [261, 0, -3000], 0, [0, -3000]],
    ['front left', WALL_LEFT, WALL_BOTTOM, [0, 0, -261], 90, [0, 0]],
    ['front right', WALL_BOTTOM, WALL_RIGHT, [3739, 0, 0], 180, [4000, 0]],
  ])(
    'puts the corner point into the %s corner with the rotation of the corner rules',
    (_corner, wall, adjoining, pos, rotationY, corner) => {
      const placement = placeCornerAtWalls(
        wall,
        adjoining,
        groupCornerGeometry({ roots: [cornerRoot] })!,
        0
      );
      expect(placement).toEqual({ pos, rotationY });
      expect(cornerPointInRoom(placement!)).toEqual(corner);
    }
  );
});
