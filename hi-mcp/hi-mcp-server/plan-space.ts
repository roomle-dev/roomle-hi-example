import type { RepositioningData } from './group-placement';

export type WallSide = 'left' | 'right' | 'top' | 'bottom';

export interface DerivedWall {
  index: number;
  side: WallSide;
  start: [number, number, number];
  end: [number, number, number];
  lengthMm: number;
  type?: string;
  heightMm?: number;
  thicknessMm?: number;
  facingRotationY: number;
}

export interface GroupFootprint {
  x: [number, number];
  z: [number, number];
  widthMm: number;
  depthMm: number;
}

export type WallAlignment = 'start' | 'center' | 'end' | WallSide;

interface FootprintPart {
  hidden?: boolean;
  relPos?: number[];
  dim?: number[];
  fullMatrix?: number[];
}

interface FootprintModule {
  modules?: FootprintModule[];
  containers?: FootprintModule[];
  parts?: FootprintPart[];
}

interface FootprintRoot extends FootprintModule {
  id?: string;
  articleId?: string;
  isGenerated?: boolean;
  articlePos?: number[];
  rotationY?: number;
  dockInfos?: { id?: string; start?: number[]; end?: number[] }[];
  attributes?: { id: string; value?: unknown }[];
}

export interface CornerGeometry {
  rootId: string;
  point: [number, number];
  directions: [[number, number], [number, number]];
}

export interface FootprintGroup {
  ver?: number;
  roots?: FootprintRoot[];
}

// + 0 turns IEEE -0 into +0 so serialized values never show -0
const round2 = (value: number): number => Math.round(value * 100) / 100 + 0;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

const normalizeDegrees = (degrees: number): number => {
  const normalized = degrees % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

type Point3 = [number, number, number];

const transformPointByMatrix = (matrix: number[], point: Point3): Point3 => {
  const [x, y, z] = point;
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ];
};

const transformPointByRoot = (root: FootprintRoot, point: Point3): Point3 => {
  const theta = toRadians(root.rotationY ?? 0);
  const [translationX, translationY, translationZ] = root.articlePos ?? [
    0, 0, 0,
  ];
  const [x, y, z] = point;
  return [
    translationX + x * Math.cos(theta) + z * Math.sin(theta),
    translationY + y,
    translationZ - x * Math.sin(theta) + z * Math.cos(theta),
  ];
};

const collectParts = (module: FootprintModule, parts: FootprintPart[]) => {
  for (const part of module.parts ?? []) {
    if (
      !part.hidden &&
      (part.relPos?.length ?? 0) >= 3 &&
      (part.dim?.length ?? 0) >= 3 &&
      part.fullMatrix?.length === 16
    ) {
      parts.push(part);
    }
  }
  for (const subModule of module.modules ?? []) {
    collectParts(subModule, parts);
  }
  for (const container of module.containers ?? []) {
    collectParts(container, parts);
  }
};

const boxCorners = (minimum: number[], size: number[]): Point3[] => {
  const corners: Point3[] = [];
  for (const offsetX of [0, size[0]]) {
    for (const offsetY of [0, size[1]]) {
      for (const offsetZ of [0, size[2]]) {
        corners.push([
          minimum[0] + offsetX,
          minimum[1] + offsetY,
          minimum[2] + offsetZ,
        ]);
      }
    }
  }
  return corners;
};

const dimensionAttribute = (
  root: FootprintRoot,
  attributeId: string
): number | undefined => {
  const value = Number(
    root.attributes?.find((attribute) => attribute.id === attributeId)?.value
  );
  return Number.isFinite(value) && value > 0 ? value : undefined;
};

const rootFootprintPoints = (
  root: FootprintRoot,
  partMatricesAreGroupSpace: boolean
): [number, number][] => {
  const parts: FootprintPart[] = [];
  collectParts(root, parts);
  const points: [number, number][] = [];
  for (const part of parts) {
    for (const corner of boxCorners(part.relPos!, part.dim!)) {
      let point = transformPointByMatrix(part.fullMatrix!, corner);
      if (!partMatricesAreGroupSpace) {
        point = transformPointByRoot(root, point);
      }
      points.push([point[0], point[2]]);
    }
  }
  if (points.length > 0) {
    return points;
  }
  for (const dockInfo of root.dockInfos ?? []) {
    for (const dockPoint of [dockInfo.start, dockInfo.end]) {
      if ((dockPoint?.length ?? 0) >= 3) {
        const point = transformPointByRoot(root, [
          dockPoint![0],
          dockPoint![1],
          dockPoint![2],
        ]);
        points.push([point[0], point[2]]);
      }
    }
  }
  if (points.length > 0) {
    return points;
  }
  const width = dimensionAttribute(root, 'b');
  const depth = dimensionAttribute(root, 't');
  if (width !== undefined && depth !== undefined) {
    for (const corner of boxCorners([0, 0, 0], [width, 0, depth])) {
      const point = transformPointByRoot(root, corner);
      points.push([point[0], point[2]]);
    }
  }
  return points;
};

export const groupFootprint = (
  group: FootprintGroup
): GroupFootprint | undefined => {
  const partMatricesAreGroupSpace = (group.ver ?? 0) > 0;
  const points: [number, number][] = [];
  for (const root of group.roots ?? []) {
    points.push(...rootFootprintPoints(root, partMatricesAreGroupSpace));
  }
  if (points.length === 0) {
    return undefined;
  }
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const [x, z] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return {
    x: [round2(minX), round2(maxX)],
    z: [round2(minZ), round2(maxZ)],
    widthMm: round2(maxX - minX),
    depthMm: round2(maxZ - minZ),
  };
};

const rootHeights = (
  root: FootprintRoot,
  partMatricesAreGroupSpace: boolean
): number[] => {
  const parts: FootprintPart[] = [];
  collectParts(root, parts);
  const heights: number[] = [];
  for (const part of parts) {
    for (const corner of boxCorners(part.relPos!, part.dim!)) {
      let point = transformPointByMatrix(part.fullMatrix!, corner);
      if (!partMatricesAreGroupSpace) {
        point = transformPointByRoot(root, point);
      }
      heights.push(point[1]);
    }
  }
  if (heights.length > 0) {
    return heights;
  }
  for (const dockInfo of root.dockInfos ?? []) {
    for (const dockPoint of [dockInfo.start, dockInfo.end]) {
      if ((dockPoint?.length ?? 0) >= 3) {
        heights.push(
          transformPointByRoot(root, [
            dockPoint![0],
            dockPoint![1],
            dockPoint![2],
          ])[1]
        );
      }
    }
  }
  const height = dimensionAttribute(root, 'h');
  if (height !== undefined) {
    const bottom = root.articlePos?.[1] ?? 0;
    heights.push(bottom, bottom + height);
  }
  return heights;
};

// The vertical extent of a group in group space; undefined without height data.
export const groupHeightRange = (
  group: FootprintGroup
): [number, number] | undefined => {
  const partMatricesAreGroupSpace = (group.ver ?? 0) > 0;
  const heights = (group.roots ?? []).flatMap((root) =>
    rootHeights(root, partMatricesAreGroupSpace)
  );
  if (heights.length === 0) {
    return undefined;
  }
  const bottom = Math.min(...heights);
  const top = Math.max(...heights);
  return top - bottom < 1 ? undefined : [round2(bottom), round2(top)];
};

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

export const rotateDirection = (
  [x, z]: [number, number],
  degrees: number
): [number, number] => {
  const theta = toRadians(degrees);
  return [
    x * Math.cos(theta) + z * Math.sin(theta),
    -x * Math.sin(theta) + z * Math.cos(theta),
  ];
};

const sameDirection = (a: [number, number], b: [number, number]): boolean =>
  a[0] * b[0] + a[1] * b[1] > 0.999;

const rootCornerGeometry = (
  root: FootprintRoot
): CornerGeometry | undefined => {
  const vectorPair = (row: 'Bottom' | 'Top') => ({
    left: root.dockInfos?.find((dockInfo) => dockInfo.id === `LeftBack${row}`),
    right: root.dockInfos?.find(
      (dockInfo) => dockInfo.id === `RightBack${row}`
    ),
  });
  const bottom = vectorPair('Bottom');
  const { left, right } =
    bottom.left && bottom.right ? bottom : vectorPair('Top');
  if (!left?.start || !left.end || !right?.start || !right.end) {
    return undefined;
  }
  const toGroupXz = (point: number[]): [number, number] => {
    const [x, , z] = transformPointByRoot(root, [point[0], point[1], point[2]]);
    return [x, z];
  };
  const leftStart = toGroupXz(left.start);
  const rightStart = toGroupXz(right.start);
  const leftDirection = unitDirection(leftStart, toGroupXz(left.end));
  const rightDirection = unitDirection(rightStart, toGroupXz(right.end));
  // one corner point and two back edges running along different walls
  if (
    !samePoint(leftStart, rightStart) ||
    !leftDirection ||
    !rightDirection ||
    Math.abs(
      leftDirection[0] * rightDirection[0] +
        leftDirection[1] * rightDirection[1]
    ) > 0.01
  ) {
    return undefined;
  }
  return {
    rootId: root.id ?? '',
    point: rightStart,
    directions: [leftDirection, rightDirection],
  };
};

export const groupCornerGeometry = (
  group: FootprintGroup
): CornerGeometry | undefined => {
  for (const root of group.roots ?? []) {
    const geometry = rootCornerGeometry(root);
    if (geometry) {
      return geometry;
    }
  }
  return undefined;
};

const wallFloorPoints = ({
  start,
  end,
}: DerivedWall): [[number, number], [number, number]] => [
  [start[0], start[2]],
  [end[0], end[2]],
];

export const sharedCorner = (
  wall: DerivedWall,
  other: DerivedWall
): [number, number] | undefined =>
  wallFloorPoints(wall).find((point) =>
    wallFloorPoints(other).some((candidate) => samePoint(point, candidate))
  );

// The wall on the given side of the room that meets this wall in a corner.
export const adjoiningWall = (
  walls: DerivedWall[],
  wall: DerivedWall,
  side: WallSide
): DerivedWall | undefined =>
  walls.find(
    (candidate) =>
      candidate.index !== wall.index &&
      candidate.side === side &&
      candidate.type === 'wall' &&
      sharedCorner(wall, candidate) !== undefined
  );

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

// The floor polygon of a room: the start points of its walls in contour order
// (openings included - they are contour segments too).
const roomPolygon = (walls: DerivedWall[]): [number, number][] =>
  walls.map((wall) => [wall.start[0], wall.start[2]]);

const distanceToSegment = (
  [px, pz]: [number, number],
  [ax, az]: [number, number],
  [bx, bz]: [number, number]
): number => {
  const lengthSquared = (bx - ax) ** 2 + (bz - az) ** 2;
  const t =
    lengthSquared < 1e-9
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((px - ax) * (bx - ax) + (pz - az) * (bz - az)) / lengthSquared
          )
        );
  return Math.hypot(px - (ax + t * (bx - ax)), pz - (az + t * (bz - az)));
};

// Whether a floor point lies inside the room's contour or within the
// tolerance of one of its walls - also for an L-shaped room, whose cut-out
// lies inside the bounding box of its walls.
export const pointInsideRoom = (
  point: [number, number],
  walls: DerivedWall[],
  toleranceMm: number
): boolean => {
  const polygon = roomPolygon(walls);
  if (polygon.length < 3) {
    return false;
  }
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    if (
      zi > point[1] !== zj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - zi)) / (zj - zi) + xi
    ) {
      inside = !inside;
    }
  }
  return (
    inside ||
    polygon.some(
      (corner, index) =>
        distanceToSegment(
          point,
          corner,
          polygon[(index + 1) % polygon.length]
        ) <= toleranceMm
    )
  );
};

// The room of the plan whose floor holds the point; undefined when none does.
export const roomOfPoint = <T extends { walls?: DerivedWall[] }>(
  rooms: T[],
  point: [number, number],
  toleranceMm: number
): T | undefined =>
  rooms.find((room) => pointInsideRoom(point, room.walls ?? [], toleranceMm));

// Puts the corner point of a corner article into the corner the two walls
// share and turns the group so that its two back edges run along the walls.
// Undefined when the article's back edges cannot be matched to both walls.
export const placeCornerAtWalls = (
  wall: DerivedWall,
  adjoining: DerivedWall,
  corner: CornerGeometry,
  offsetMm: number
): { pos: [number, number, number]; rotationY: number } | undefined => {
  const cornerPoint = sharedCorner(wall, adjoining);
  if (!cornerPoint) {
    return undefined;
  }
  const otherEnd = (candidate: DerivedWall): [number, number] => {
    const [start, end] = wallFloorPoints(candidate);
    return samePoint(start, cornerPoint) ? end : start;
  };
  const alongWall = unitDirection(cornerPoint, otherEnd(wall));
  const alongAdjoining = unitDirection(cornerPoint, otherEnd(adjoining));
  if (!alongWall || !alongAdjoining) {
    return undefined;
  }
  const [leftDirection, rightDirection] = corner.directions;
  const assignments: [[number, number], [number, number]][] = [
    [alongWall, alongAdjoining],
    [alongAdjoining, alongWall],
  ];
  for (const [leftTarget, rightTarget] of assignments) {
    const angle = toDegrees(
      Math.atan2(leftDirection[1], leftDirection[0]) -
        Math.atan2(leftTarget[1], leftTarget[0])
    );
    for (const rotationY of [angle, -angle]) {
      if (
        sameDirection(rotateDirection(leftDirection, rotationY), leftTarget) &&
        sameDirection(rotateDirection(rightDirection, rotationY), rightTarget)
      ) {
        const rotatedPoint = rotateDirection(corner.point, rotationY);
        return {
          pos: [
            round2(cornerPoint[0] - rotatedPoint[0] + alongWall[0] * offsetMm),
            0,
            round2(cornerPoint[1] - rotatedPoint[1] + alongWall[1] * offsetMm),
          ],
          rotationY: round2(normalizeDegrees(rotationY)),
        };
      }
    }
  }
  return undefined;
};

export interface GroupPlacementTransform {
  pos: [number, number, number];
  rotationY: number;
}

interface PlacedGroup {
  pos?: number[];
  rotationY?: number;
}

export const groupPointToRoom = (
  group: PlacedGroup,
  [x, z]: [number, number]
): [number, number] => {
  const [roomX, , roomZ] = transformPointByRoot(
    { articlePos: group.pos, rotationY: group.rotationY },
    [x, 0, z]
  );
  return [roomX, roomZ];
};

export const footprintCornersInRoom = (
  footprint: GroupFootprint,
  group: PlacedGroup
): [number, number][] => {
  const [minX, maxX] = footprint.x;
  const [minZ, maxZ] = footprint.z;
  const corners: [number, number][] = [
    [minX, minZ],
    [maxX, minZ],
    [maxX, maxZ],
    [minX, maxZ],
  ];
  return corners.map((corner) => groupPointToRoom(group, corner));
};

export const rootFootprintInRoom = (
  group: FootprintGroup & PlacedGroup,
  root: FootprintRoot
): [number, number][] =>
  rootFootprintPoints(root, (group.ver ?? 0) > 0).map((point) =>
    groupPointToRoom(group, point)
  );

const edgeNormals = (polygon: [number, number][]): [number, number][] => {
  const normals: [number, number][] = [];
  for (let index = 0; index < polygon.length; index++) {
    const [fromX, fromZ] = polygon[index];
    const [toX, toZ] = polygon[(index + 1) % polygon.length];
    const normal = unitDirection([fromX, fromZ], [toX, toZ]);
    if (normal) {
      normals.push([-normal[1], normal[0]]);
    }
  }
  return normals;
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

// Two convex footprints touch when no edge normal of either separates them by
// more than the tolerance (separating axis theorem); flush contact counts.
export const convexPolygonsTouch = (
  a: [number, number][],
  b: [number, number][],
  toleranceMm: number
): boolean => {
  if (a.length < 3 || b.length < 3) {
    return false;
  }
  for (const axis of [...edgeNormals(a), ...edgeNormals(b)]) {
    const [minA, maxA] = projectOntoAxis(a, axis);
    const [minB, maxB] = projectOntoAxis(b, axis);
    if (maxA < minB - toleranceMm || maxB < minA - toleranceMm) {
      return false;
    }
  }
  return true;
};

export interface PlacedVolume {
  corners: [number, number][];
  heights?: [number, number];
}

// Two placed groups overlap when their footprints and their height ranges
// overlap by more than the tolerance; touching is no overlap, and a group
// without height data overlaps nothing.
export const volumesOverlap = (
  a: PlacedVolume,
  b: PlacedVolume,
  toleranceMm: number
): boolean =>
  a.heights !== undefined &&
  b.heights !== undefined &&
  a.heights[1] > b.heights[0] + toleranceMm &&
  b.heights[1] > a.heights[0] + toleranceMm &&
  convexPolygonsTouch(a.corners, b.corners, -toleranceMm);

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

export interface RootVolume extends PlacedVolume {
  id: string;
  articleId?: string;
  rotationY: number;
}

// Every root module of a calculated group but the generated ones, as the box
// of its parts in room space with its height and its rotation in the room.
export const rootVolumesInRoom = (
  group: FootprintGroup & PlacedGroup
): RootVolume[] => {
  const partMatricesAreGroupSpace = (group.ver ?? 0) > 0;
  const groupY = group.pos?.[1] ?? 0;
  return (group.roots ?? []).flatMap((root) => {
    const points = root.isGenerated
      ? []
      : rootFootprintPoints(root, partMatricesAreGroupSpace);
    if (points.length === 0) {
      return [];
    }
    const xs = points.map(([x]) => x);
    const zs = points.map(([, z]) => z);
    const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
    const [minZ, maxZ] = [Math.min(...zs), Math.max(...zs)];
    const corners = (
      [
        [minX, minZ],
        [maxX, minZ],
        [maxX, maxZ],
        [minX, maxZ],
      ] as [number, number][]
    ).map((corner) => groupPointToRoom(group, corner));
    const heights = rootHeights(root, partMatricesAreGroupSpace);
    const [bottom, top] = [Math.min(...heights), Math.max(...heights)];
    return [
      {
        id: root.id ?? '',
        ...(root.articleId !== undefined && { articleId: root.articleId }),
        corners,
        ...(top - bottom >= 1 && {
          heights: [bottom + groupY, top + groupY] as [number, number],
        }),
        rotationY: normalizeDegrees(
          (group.rotationY ?? 0) + (root.rotationY ?? 0)
        ),
      },
    ];
  });
};

// Into the room from a wall: the front of a group with its back to the wall.
const intoRoom = (wall: DerivedWall): [number, number] =>
  rotateDirection([0, 1], wall.facingRotationY);

const distanceFromWall = (
  wall: DerivedWall,
  [x, z]: [number, number]
): number => {
  const [[startX, startZ]] = wallFloorPoints(wall);
  const [inX, inZ] = intoRoom(wall);
  return (x - startX) * inX + (z - startZ) * inZ;
};

const pointAlongWall = (
  wall: DerivedWall,
  fromEndMm: number,
  intoRoomMm: number
): [number, number] => {
  const [[startX, startZ], [endX, endZ]] = wallFloorPoints(wall);
  const length = Math.hypot(endX - startX, endZ - startZ);
  const [inX, inZ] = intoRoom(wall);
  return [
    endX + ((startX - endX) * fromEndMm) / length + inX * intoRoomMm,
    endZ + ((startZ - endZ) * fromEndMm) / length + inZ * intoRoomMm,
  ];
};

// The floor in front of a span of a wall, measured from the wall's end,
// reaching depthMm into the room.
export const stripInFrontOfWall = (
  wall: DerivedWall,
  [fromEndMm, toEndMm]: [number, number],
  depthMm: number
): [number, number][] => [
  pointAlongWall(wall, fromEndMm, 0),
  pointAlongWall(wall, toEndMm, 0),
  pointAlongWall(wall, toEndMm, depthMm),
  pointAlongWall(wall, fromEndMm, depthMm),
];

const sameAngle = (a: number, b: number): boolean => {
  const turn = normalizeDegrees(a - b);
  return Math.min(turn, 360 - turn) < 0.5;
};

// The wall a root module faces away from: turned like the wall's
// facingRotationY, beside it along the wall, and with its back nearest to it,
// at most depthMm away. A corner unit touches two walls; its rotation tells.
export const wallOfRoot = (
  walls: DerivedWall[],
  root: RootVolume,
  depthMm: number
): DerivedWall | undefined => {
  let found: DerivedWall | undefined;
  let nearest = depthMm;
  for (const wall of walls) {
    if (
      wall.type !== 'wall' ||
      !sameAngle(wall.facingRotationY, root.rotationY)
    ) {
      continue;
    }
    const [from, to] = spanAlongWall(wall, root.corners);
    if (Math.min(to, wall.lengthMm) - Math.max(from, 0) <= POINT_EPSILON_MM) {
      continue;
    }
    const back = Math.abs(
      Math.min(...root.corners.map((corner) => distanceFromWall(wall, corner)))
    );
    if (back <= nearest) {
      nearest = back;
      found = wall;
    }
  }
  return found;
};

// The stretches of a wall, measured from its end, where the root module -
// as deep and at the height it is - stands clear of every blocker; stretches
// narrower than the root module are left out.
export const freeStretchesAlongWall = (
  wall: DerivedWall,
  root: RootVolume,
  blockers: PlacedVolume[],
  toleranceMm: number
): [number, number][] => {
  const length = wall.lengthMm;
  const depth = Math.max(
    ...root.corners.map((corner) => distanceFromWall(wall, corner))
  );
  const [rootFrom, rootTo] = spanAlongWall(wall, root.corners);
  if (depth <= 0 || !root.heights) {
    return [];
  }
  const strip: PlacedVolume = {
    corners: stripInFrontOfWall(wall, [0, length], depth),
    heights: root.heights,
  };
  const taken = blockers
    .filter((blocker) => volumesOverlap(strip, blocker, toleranceMm))
    .map((blocker) => spanAlongWall(wall, blocker.corners))
    .map(([from, to]): [number, number] => [
      Math.max(from, 0),
      Math.min(to, length),
    ])
    .filter(([from, to]) => to > from)
    .sort(([a], [b]) => a - b);
  const free: [number, number][] = [];
  let start = 0;
  for (const [from, to] of taken) {
    if (from > start) {
      free.push([start, from]);
    }
    start = Math.max(start, to);
  }
  if (start < length) {
    free.push([start, length]);
  }
  return free
    .filter(([from, to]) => to - from >= rootTo - rootFrom - toleranceMm)
    .map(([from, to]): [number, number] => [
      Math.round(length - to) + 0,
      Math.round(length - from) + 0,
    ])
    .reverse();
};

// The group placement expressed as the room transform of one root module, so
// the planner derives the group position from its own arrangement and no root
// position has to travel in the payload.
export const repositioningFromPlacement = (
  placement: GroupPlacementTransform,
  anchor: { id: string; articlePos?: number[]; rotationY?: number }
): RepositioningData => {
  const [x, y, z] = transformPointByRoot(
    { articlePos: placement.pos, rotationY: placement.rotationY },
    [
      anchor.articlePos?.[0] ?? 0,
      anchor.articlePos?.[1] ?? 0,
      anchor.articlePos?.[2] ?? 0,
    ]
  );
  return {
    posGroup: [round2(x), round2(y), round2(z)],
    posRotationY: round2(
      normalizeDegrees(placement.rotationY + (anchor.rotationY ?? 0))
    ),
    rootId: anchor.id,
  };
};

const alignmentAxis = (alignment: WallSide): 0 | 1 =>
  alignment === 'left' || alignment === 'right' ? 0 : 1;

// A side label names a corner of this wall only when the wall runs towards
// that side.
export const alignmentRunsParallel = (
  wall: DerivedWall,
  alignment: WallSide
): boolean => {
  const axis = alignmentAxis(alignment);
  const [start, end] = wallFloorPoints(wall);
  return Math.abs(start[axis] - end[axis]) < 1e-6;
};

// A side label as alignment means: flush into the corner this wall shares
// with the wall on that side of the room.
export const resolveWallAlignment = (
  wall: DerivedWall,
  alignment: WallAlignment
): 'start' | 'center' | 'end' => {
  if (alignment === 'start' || alignment === 'center' || alignment === 'end') {
    return alignment;
  }
  const axis = alignmentAxis(alignment);
  const [start, end] = wallFloorPoints(wall);
  const startCoordinate = start[axis];
  const endCoordinate = end[axis];
  if (alignmentRunsParallel(wall, alignment)) {
    throw new Error(
      `Alignment '${alignment}' runs parallel to this '${wall.side}' wall - ` +
        "use 'start', 'center', 'end' or the side of an adjoining wall."
    );
  }
  const smallerIsCloser = alignment === 'left' || alignment === 'top';
  const startIsCloser = smallerIsCloser
    ? startCoordinate < endCoordinate
    : startCoordinate > endCoordinate;
  return startIsCloser ? 'start' : 'end';
};

// Where the group's span along the wall starts, measured from the wall's start.
export const wallSpanStart = (
  wall: DerivedWall,
  footprint: GroupFootprint,
  alignment: WallAlignment,
  offsetMm: number
): number => {
  const resolvedAlignment = resolveWallAlignment(wall, alignment);
  const [[startX, startZ], [endX, endZ]] = wallFloorPoints(wall);
  const length = Math.hypot(endX - startX, endZ - startZ);
  const width = footprint.widthMm;
  if (resolvedAlignment === 'start') {
    return offsetMm;
  }
  if (resolvedAlignment === 'end') {
    return length - width - offsetMm;
  }
  return (length - width) / 2 + offsetMm;
};

export const placeAgainstWall = (
  wall: DerivedWall,
  footprint: GroupFootprint,
  alignment: WallAlignment,
  offsetMm: number
): { pos: [number, number, number]; rotationY: number } => {
  const [[startX, startZ], [endX, endZ]] = wallFloorPoints(wall);
  const length = Math.hypot(endX - startX, endZ - startZ);
  const alongX = (endX - startX) / length;
  const alongZ = (endZ - startZ) / length;
  const width = footprint.widthMm;
  const spanStart = wallSpanStart(wall, footprint, alignment, offsetMm);
  // The group's local x axis runs against the wall direction, so the group
  // origin corner sits at the far end of the occupied span.
  const anchorX = startX + alongX * (spanStart + width);
  const anchorZ = startZ + alongZ * (spanStart + width);
  const theta = toRadians(wall.facingRotationY);
  const [minX] = footprint.x;
  const [minZ] = footprint.z;
  return {
    pos: [
      round2(anchorX - (minX * Math.cos(theta) + minZ * Math.sin(theta))),
      0,
      round2(anchorZ - (-minX * Math.sin(theta) + minZ * Math.cos(theta))),
    ],
    rotationY: wall.facingRotationY,
  };
};
