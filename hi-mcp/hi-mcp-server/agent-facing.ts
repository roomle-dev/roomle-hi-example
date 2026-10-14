// The plan context in the words of the agent: wall names, room corners, the
// wall of a door or a window, and the catalog's short descriptions.

type WallSide = 'left' | 'right' | 'top' | 'bottom';

interface DerivedWall {
  index: number;
  side: WallSide;
  start: [number, number, number];
  end: [number, number, number];
  lengthMm: number;
  type?: string;
  thicknessMm?: number;
  facingRotationY: number;
}

// + 0 turns IEEE -0 into +0 so serialized values never show -0
const round2 = (value: number): number => Math.round(value * 100) / 100 + 0;

const POINT_EPSILON_MM = 1;

const samePoint = (a: [number, number], b: [number, number]): boolean =>
  Math.hypot(a[0] - b[0], a[1] - b[1]) < POINT_EPSILON_MM;

const unitDirection = (
  from: [number, number],
  to: [number, number]
): [number, number] | undefined => {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  return length < 1e-6
    ? undefined
    : [(to[0] - from[0]) / length, (to[1] - from[1]) / length];
};

const projectOntoAxis = (
  polygon: [number, number][],
  [axisX, axisZ]: [number, number]
): [number, number] => {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (const [x, z] of polygon) {
    const projection = x * axisX + z * axisZ;
    minimum = Math.min(minimum, projection);
    maximum = Math.max(maximum, projection);
  }
  return [minimum, maximum];
};

const wallFloorPoints = ({
  start,
  end,
}: DerivedWall): [[number, number], [number, number]] => [
  [start[0], start[2]],
  [end[0], end[2]],
];

const WALL_NAMES: Record<WallSide, string> = {
  top: 'back wall',
  bottom: 'front wall',
  left: 'left wall',
  right: 'right wall',
};

// The name of a wall in the words of the user: back and front for the top and
// the bottom of the top-view image.
export const wallName = (side: WallSide): string =>
  WALL_NAMES[side] ?? `${side} wall`;

export interface RoomCorner {
  name: string;
  point: [number, number, number];
  posRotationY: number;
}

// The corners of a room: where a wall ends and another wall starts at an
// angle (the contour runs counter-clockwise; collinear walls split by a door
// form no corner). The name is back/front plus left/right, and posRotationY is
// the facingRotationY of the wall that ends in the corner - the rotation of a
// corner kitchen there, for both hands of corner article (D13, D33).
export const roomCorners = (walls: DerivedWall[]): RoomCorner[] => {
  const real = walls.filter((wall) => wall.type === 'wall');
  const corners: RoomCorner[] = [];
  for (const ending of real) {
    const [endingStart, endPoint] = wallFloorPoints(ending);
    const along = unitDirection(endingStart, endPoint);
    for (const starting of real) {
      const [startPoint, startingEnd] = wallFloorPoints(starting);
      const next = unitDirection(startPoint, startingEnd);
      if (
        starting === ending ||
        !samePoint(endPoint, startPoint) ||
        !along ||
        !next ||
        Math.abs(along[0] * next[0] + along[1] * next[1]) > 0.999
      ) {
        continue;
      }
      const sides = [ending.side, starting.side];
      const depth = sides.find((side) => side === 'top' || side === 'bottom');
      const hand = sides.find((side) => side === 'left' || side === 'right');
      if (!depth || !hand) {
        continue;
      }
      corners.push({
        name: `${depth === 'top' ? 'back' : 'front'} ${hand}`,
        point: [endPoint[0], 0, endPoint[1]],
        posRotationY: ending.facingRotationY,
      });
    }
  }
  return corners;
};

// The extent of room points along a wall, measured from the wall's start.
export const spanAlongWall = (
  wall: DerivedWall,
  points: [number, number][]
): [number, number] => {
  const [[startX, startZ], [endX, endZ]] = wallFloorPoints(wall);
  const length = Math.hypot(endX - startX, endZ - startZ);
  const along: [number, number] = [
    (endX - startX) / length,
    (endZ - startZ) / length,
  ];
  return projectOntoAxis(
    points.map(([x, z]) => [x - startX, z - startZ]),
    along
  );
};

export interface WallOfOpening {
  roomIndex: number;
  wall: number;
  fromEndMm: [number, number];
}

// The wall a door or a window lies in: the wall whose line its floor outline
// touches - within the wall's thickness - over the longest stretch. The span
// is measured from the wall's end, like the d of a placement.
export const wallOfOpening = (
  outline: [number, number][],
  rooms: { walls?: DerivedWall[] }[]
): WallOfOpening | undefined => {
  let found: WallOfOpening | undefined;
  let longestOverlap = POINT_EPSILON_MM;
  rooms.forEach((room, roomIndex) => {
    for (const wall of room.walls ?? []) {
      const [[startX, startZ], [endX, endZ]] = wallFloorPoints(wall);
      const along = unitDirection([startX, startZ], [endX, endZ]);
      if (!along) {
        continue;
      }
      const distanceToLine = Math.min(
        ...outline.map(([x, z]) =>
          Math.abs((x - startX) * along[1] - (z - startZ) * along[0])
        )
      );
      if (distanceToLine > (wall.thicknessMm ?? 0) + POINT_EPSILON_MM) {
        continue;
      }
      const length = Math.hypot(endX - startX, endZ - startZ);
      const [from, to] = spanAlongWall(wall, outline);
      const overlap = Math.min(to, length) - Math.max(from, 0);
      if (overlap > longestOverlap) {
        longestOverlap = overlap;
        found = {
          roomIndex,
          wall: wall.index,
          fromEndMm: [
            round2(length - Math.min(to, length)),
            round2(length - Math.max(from, 0)),
          ],
        };
      }
    }
  });
  return found;
};

// A sectioned article description - FUNCTION:, PURPOSE:, …,
// AI_SELECTION_HINT: - shortened to what the article is and when to pick it.
const SHORT_DESCRIPTION_SECTIONS = ['FUNCTION', 'AI_SELECTION_HINT'];
const shortDescription = (desc: unknown): unknown => {
  if (typeof desc !== 'string') {
    return desc;
  }
  const lines = SHORT_DESCRIPTION_SECTIONS.map((section) =>
    desc
      .match(new RegExp(`(?:^|\\n)${section}:[ \\t]*\\n([^\\n]+)`))?.[1]
      ?.trim()
  ).filter((line) => line);
  return lines.length > 0 ? lines.join(' ') : desc;
};

// A value list several attributes share is listed once: the later attributes
// name the attribute that lists it.
export const withSharedSelectionsOnce = (attributes: any[]): any[] => {
  const listedBy = new Map<string, string>();
  return attributes.map((attribute) => {
    if (
      !Array.isArray(attribute.selections) ||
      attribute.selections.length === 0
    ) {
      return attribute;
    }
    const key = `${attribute.libraryId}\n${JSON.stringify(attribute.selections, (field, value) => (field === 'imageUrl' ? undefined : value))}`;
    const listing = listedBy.get(key);
    if (listing === undefined) {
      listedBy.set(key, attribute.id);
      return attribute;
    }
    const shared = { ...attribute, sameSelectionsAs: listing };
    delete shared.selections;
    return shared;
  });
};

// The attribute vocabulary: per library the customer-facing attributes of
// the compacted master data with their values, a shared value list listed
// once. The root modules and the group settings stay in masterData.
export const agentFacingAttributes = (masterData: any) =>
  Object.fromEntries(
    Object.entries((masterData ?? {}) as Record<string, any>).map(
      ([libraryId, library]) => [
        libraryId,
        withSharedSelectionsOnce((library?.attributes ?? []) as any[]),
      ]
    )
  );

// The corner point is not the agent's. The description is short; the
// articleDescriptions section has the full one.
export const agentFacingArticle = (article: any) => {
  const compact = {
    ...article,
    ...(article.desc !== undefined && { desc: shortDescription(article.desc) }),
  };
  delete compact.cornerPoint;
  return compact;
};

// The walls in the words of the user: a name per wall, an opening named as
// such (the contour gives it no type), and the room corners with their point
// and the rotation of a group that starts with a corner article there.
export const agentFacingRooms = (rooms: any) => {
  if (!Array.isArray(rooms?.rooms)) {
    return rooms;
  }
  return {
    ...rooms,
    rooms: rooms.rooms.map((room: any) => {
      const walls = ((room?.walls ?? []) as any[]).map((wall) => ({
        ...wall,
        ...(wall?.type === null || wall?.type === undefined
          ? { type: 'opening' }
          : {}),
        name: wallName(wall?.side),
      }));
      return { ...room, walls, corners: roomCorners(walls) };
    }),
  };
};

// A door or a window lies in a wall: the room, the wall and its span along the
// wall, measured from the wall's end like the d of a placement.
export const agentFacingObstacles = (obstacles: any, rooms: any) => {
  if (!Array.isArray(obstacles?.objects)) {
    return obstacles;
  }
  return {
    ...obstacles,
    objects: obstacles.objects.map((object: any) => {
      if (object?.kind !== 'door' && object?.kind !== 'window') {
        return object;
      }
      const wall = wallOfOpening(
        ((object.outline ?? []) as number[][]).map(
          ([x, , z]): [number, number] => [x, z]
        ),
        rooms?.rooms ?? []
      );
      return wall ? { ...object, ...wall } : object;
    }),
  };
};
