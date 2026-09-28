export type WallSide = 'left' | 'right' | 'top' | 'bottom';

export interface DerivedWall {
  index: number;
  side: WallSide;
  start: [number, number];
  end: [number, number];
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
  attributeId: string,
): number | undefined => {
  const value = Number(
    root.attributes?.find((attribute) => attribute.id === attributeId)?.value,
  );
  return Number.isFinite(value) && value > 0 ? value : undefined;
};

const rootFootprintPoints = (
  root: FootprintRoot,
  partMatricesAreGroupSpace: boolean,
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
  group: FootprintGroup,
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

const POINT_EPSILON_MM = 1;

const samePoint = (a: [number, number], b: [number, number]): boolean =>
  Math.hypot(a[0] - b[0], a[1] - b[1]) < POINT_EPSILON_MM;

const unitDirection = (
  from: [number, number],
  to: [number, number],
): [number, number] | undefined => {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  return length < 1e-6
    ? undefined
    : [(to[0] - from[0]) / length, (to[1] - from[1]) / length];
};

const rotateDirection = (
  [x, z]: [number, number],
  degrees: number,
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
  root: FootprintRoot,
): CornerGeometry | undefined => {
  const vectorPair = (row: 'Bottom' | 'Top') => ({
    left: root.dockInfos?.find((dockInfo) => dockInfo.id === `LeftBack${row}`),
    right: root.dockInfos?.find(
      (dockInfo) => dockInfo.id === `RightBack${row}`,
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
        leftDirection[1] * rightDirection[1],
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
  group: FootprintGroup,
): CornerGeometry | undefined => {
  for (const root of group.roots ?? []) {
    const geometry = rootCornerGeometry(root);
    if (geometry) {
      return geometry;
    }
  }
  return undefined;
};

export const sharedCorner = (
  wall: DerivedWall,
  other: DerivedWall,
): [number, number] | undefined =>
  [wall.start, wall.end].find((point) =>
    [other.start, other.end].some((candidate) => samePoint(point, candidate)),
  );

// The wall on the given side of the room that meets this wall in a corner.
export const adjoiningWall = (
  walls: DerivedWall[],
  wall: DerivedWall,
  side: WallSide,
): DerivedWall | undefined =>
  walls.find(
    (candidate) =>
      candidate.index !== wall.index &&
      candidate.side === side &&
      candidate.type === 'wall' &&
      sharedCorner(wall, candidate) !== undefined,
  );

// Puts the corner point of a corner article into the corner the two walls
// share and turns the group so that its two back edges run along the walls.
// Undefined when the article's back edges cannot be matched to both walls.
export const placeCornerAtWalls = (
  wall: DerivedWall,
  adjoining: DerivedWall,
  corner: CornerGeometry,
  offsetMm: number,
): { pos: [number, number, number]; rotationY: number } | undefined => {
  const cornerPoint = sharedCorner(wall, adjoining);
  if (!cornerPoint) {
    return undefined;
  }
  const otherEnd = (candidate: DerivedWall): [number, number] =>
    samePoint(candidate.start, cornerPoint) ? candidate.end : candidate.start;
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
        Math.atan2(leftTarget[1], leftTarget[0]),
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

const groupPointToRoom = (
  group: PlacedGroup,
  [x, z]: [number, number],
): [number, number] => {
  const [roomX, , roomZ] = transformPointByRoot(
    { articlePos: group.pos, rotationY: group.rotationY },
    [x, 0, z],
  );
  return [roomX, roomZ];
};

export const footprintCornersInRoom = (
  footprint: GroupFootprint,
  group: PlacedGroup,
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
  root: FootprintRoot,
): [number, number][] =>
  rootFootprintPoints(root, (group.ver ?? 0) > 0).map((point) =>
    groupPointToRoom(group, point),
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
  [axisX, axisZ]: [number, number],
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
  toleranceMm: number,
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

export interface RepositioningData {
  posGroup: [number, number, number];
  posRotationY: number;
  rootId: string;
}

// The group placement expressed as the room transform of one root module, so
// the planner derives the group position from its own arrangement and no root
// position has to travel in the payload.
export const repositioningFromPlacement = (
  placement: GroupPlacementTransform,
  anchor: { id: string; articlePos?: number[]; rotationY?: number },
): RepositioningData => {
  const [x, y, z] = transformPointByRoot(
    { articlePos: placement.pos, rotationY: placement.rotationY },
    [
      anchor.articlePos?.[0] ?? 0,
      anchor.articlePos?.[1] ?? 0,
      anchor.articlePos?.[2] ?? 0,
    ],
  );
  return {
    posGroup: [round2(x), round2(y), round2(z)],
    posRotationY: round2(
      normalizeDegrees(placement.rotationY + (anchor.rotationY ?? 0)),
    ),
    rootId: anchor.id,
  };
};

// A side label as alignment means: flush into the corner this wall shares
// with the wall on that side of the room.
export const resolveWallAlignment = (
  wall: DerivedWall,
  alignment: WallAlignment,
): 'start' | 'center' | 'end' => {
  if (alignment === 'start' || alignment === 'center' || alignment === 'end') {
    return alignment;
  }
  const axis = alignment === 'left' || alignment === 'right' ? 0 : 1;
  const startCoordinate = wall.start[axis];
  const endCoordinate = wall.end[axis];
  if (Math.abs(startCoordinate - endCoordinate) < 1e-6) {
    throw new Error(
      `Alignment '${alignment}' runs parallel to this '${wall.side}' wall - ` +
        "use 'start', 'center', 'end' or the side of an adjoining wall.",
    );
  }
  const smallerIsCloser = alignment === 'left' || alignment === 'top';
  const startIsCloser = smallerIsCloser
    ? startCoordinate < endCoordinate
    : startCoordinate > endCoordinate;
  return startIsCloser ? 'start' : 'end';
};

export const placeAgainstWall = (
  wall: DerivedWall,
  footprint: GroupFootprint,
  alignment: WallAlignment,
  offsetMm: number,
): { pos: [number, number, number]; rotationY: number } => {
  const resolvedAlignment = resolveWallAlignment(wall, alignment);
  const [startX, startZ] = wall.start;
  const [endX, endZ] = wall.end;
  const length = Math.hypot(endX - startX, endZ - startZ);
  const alongX = (endX - startX) / length;
  const alongZ = (endZ - startZ) / length;
  const width = footprint.widthMm;
  let spanStart: number;
  if (resolvedAlignment === 'start') {
    spanStart = offsetMm;
  } else if (resolvedAlignment === 'end') {
    spanStart = length - width - offsetMm;
  } else {
    spanStart = (length - width) / 2 + offsetMm;
  }
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
