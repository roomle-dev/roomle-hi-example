import { describe, expect, it } from 'vitest';
import {
  convexPolygonsTouch,
  groupCornerGeometry,
  groupFootprint,
  placeAgainstWall,
  placeCornerAtWalls,
  repositioningFromPlacement,
  resolveWallAlignment,
  type DerivedWall,
  type GroupFootprint,
} from '../plan-space';



const IDENTITY_MATRIX = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

const WALL_RIGHT: DerivedWall = {
  index: 1,
  side: 'right',
  start: [4000, 0],
  end: [4000, -3000],
  lengthMm: 3000,
  type: 'wall',
  facingRotationY: 270,
};

const WALL_TOP: DerivedWall = {
  index: 2,
  side: 'top',
  start: [4000, -3000],
  end: [0, -3000],
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
        { relPos: [0, 0, 0], dim: [800, 720, 600], fullMatrix: IDENTITY_MATRIX },
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
        { relPos: [0, 0, 0], dim: [800, 720, 600], fullMatrix: IDENTITY_MATRIX },
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
  const corner = { rootId: 'c1', point: [0, 0] as [number, number], directions: [[1, 0], [0, -1]] as [[number, number], [number, number]] };

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
    expect(convexPolygonsTouch([[0, 0], [1, 1]], squareA, 5)).toBe(false);
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
  const placement = { pos: [1000, 0, -2000] as [number, number, number], rotationY: 270 };

  it('transforms the anchor into the room and sums the rotations', () => {
    expect(
      repositioningFromPlacement(placement, {
        id: 'r1',
        articlePos: [800, 0, 0],
        rotationY: 90,
      }),
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
