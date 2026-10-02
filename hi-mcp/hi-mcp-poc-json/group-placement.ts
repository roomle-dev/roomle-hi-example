export interface Placement {
  posGroup: [number, number, number];
  posRotationY: number;
  rootId?: string;
}

import type { GroupFootprint } from './plan-space';

export interface RepositioningData {
  posGroup: [number, number, number];
  posRotationY: number;
  rootId: string;
  rootRelPos?: [number, number, number];
  rootRelRotationY?: number;
}

interface DockingRelations {
  carrierOf: Map<string, string>;
  leftOf: Map<string, string>;
  rightOf: Map<string, string>;
}

export const catalogArticleOf = (articles: any[], root: any): any | undefined =>
  articles.find(
    (candidate) =>
      candidate.articleId === root.articleId &&
      (!root.libraryId || candidate.libraryId === root.libraryId),
  );

const CORNER = /corner/i;

// The catalog's cornerArticle flag is derived from docking data that only a
// calculated root of the article provides; on an empty plan the category
// ("... | Base Units | Corner") and the module name (mr_CornerunitStraight)
// still tell a corner article.
export const isCornerArticle = (articles: any[], root: any): boolean => {
  const article = catalogArticleOf(articles, root);
  return (
    article !== undefined &&
    (article.cornerArticle === true ||
      CORNER.test(String(article.category ?? '')) ||
      (article.rootModules ?? []).some((rootModule: any) =>
        CORNER.test(String(rootModule?.module?.id ?? '')),
      ))
  );
};

// Read in both directions: groups returned by get-plan-context carry the
// reciprocal entries the planner completes.
const dockingRelations = (roots: any[]): DockingRelations => {
  const rootIds = new Set(roots.map((root) => root.id));
  const relations: DockingRelations = {
    carrierOf: new Map(),
    leftOf: new Map(),
    rightOf: new Map(),
  };
  const relate = (map: Map<string, string>, id: string, relatedId: string) => {
    if (rootIds.has(id) && rootIds.has(relatedId) && id !== relatedId) {
      map.set(id, relatedId);
    }
  };
  for (const root of roots) {
    for (const dockedContext of root?.contextData?.dockedRoots ?? []) {
      const own = String(dockedContext?.ownDockingVector ?? '');
      for (const dockedRoot of dockedContext?.dockedRoots ?? []) {
        const other = dockedRoot?.id;
        const theirs = String(dockedRoot?.dockingVector ?? '');
        if (own.endsWith('Top') && theirs.endsWith('Bottom')) {
          relate(relations.carrierOf, other, root.id);
        } else if (own.endsWith('Bottom') && theirs.endsWith('Top')) {
          relate(relations.carrierOf, root.id, other);
        } else if (own === 'RightBottom' && theirs === 'LeftBottom') {
          relate(relations.rightOf, root.id, other);
          relate(relations.leftOf, other, root.id);
        } else if (own === 'LeftBottom' && theirs === 'RightBottom') {
          relate(relations.leftOf, root.id, other);
          relate(relations.rightOf, other, root.id);
        }
      }
    }
  }
  return relations;
};

/**
 * The root whose origin goes to the placement point: from the start root down
 * to the floor unit carrying it and left along its row. A corner article on
 * the way is the anchor, because its left arm turns away along the second
 * wall; a start on that arm finds it walking right from the arm's end.
 */
export const findAnchorRoot = (
  roots: any[],
  startRootId: string | undefined,
  isCornerArticle: (root: any) => boolean,
): any => {
  const rootsById = new Map(roots.map((root) => [root.id, root]));
  const { carrierOf, leftOf, rightOf } = dockingRelations(roots);
  const visited = new Set<string>();
  const unvisited = (id: string | undefined) =>
    id !== undefined && !visited.has(id) ? rootsById.get(id) : undefined;

  let current = rootsById.get(startRootId) ?? roots[0];
  visited.add(current.id);
  for (;;) {
    const next = unvisited(carrierOf.get(current.id));
    if (next) {
      current = next;
      visited.add(current.id);
      continue;
    }
    if (isCornerArticle(current)) {
      return current;
    }
    const left = unvisited(leftOf.get(current.id));
    if (!left) {
      break;
    }
    current = left;
    visited.add(current.id);
  }

  const rowEnd = current;
  const row = new Set<string>([rowEnd.id]);
  for (
    let id = rightOf.get(rowEnd.id);
    id !== undefined && !row.has(id);
    id = rightOf.get(id)
  ) {
    const root = rootsById.get(id);
    if (isCornerArticle(root)) {
      return root;
    }
    row.add(id);
  }
  return rowEnd;
};

// Where a placement puts an anchor root, root-local: its docking corner - the
// back left bottom corner of its docking vectors - and the turn that brings the
// corner of a corner article to its back left. A right-handed corner article
// (carcase direction Right) has its corner on its right and a turn of 270;
// every other article has a turn of 0. The docking corner of a cabinet is its
// origin, of a range hood its left edge, of a corner article its corner point.
export interface AnchorFrame {
  point: [number, number, number];
  turnY: number;
}

export const IDENTITY_FRAME: AnchorFrame = { point: [0, 0, 0], turnY: 0 };

// + 0 turns -0 into 0
const round2 = (value: number): number => Math.round(value * 100) / 100 + 0;

const normalizeDegrees = (degrees: number): number =>
  round2(((degrees % 360) + 360) % 360);

const roundedPoint = ([x, y, z]: number[]): [number, number, number] => [
  round2(x),
  round2(y),
  round2(z),
];

const isPoint = (value: unknown): value is number[] =>
  Array.isArray(value) &&
  value.length >= 3 &&
  value.slice(0, 3).every((component) => Number.isFinite(component));

const cornerVector = (root: any, side: 'Left' | 'Right'): any =>
  ['Bottom', 'Top']
    .map((row) =>
      (root?.dockInfos ?? []).find(
        (dockInfo: any) =>
          dockInfo?.id === `${side}Back${row}` &&
          isPoint(dockInfo.start) &&
          isPoint(dockInfo.end),
      ),
    )
    .find(Boolean);

export const hasCornerVectors = (root: any): boolean =>
  cornerVector(root, 'Right') !== undefined ||
  cornerVector(root, 'Left') !== undefined;

const degreesOf = (radians: number): number => (radians * 180) / Math.PI;

// Counter-clockwise as seen from above (the planner's rotationY): local +x
// turns towards room -z, local +z towards room +x.
const rotatedAboutY = (
  [x, y, z]: number[],
  degrees: number,
): [number, number, number] => {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [x * cos + z * sin, y, -x * sin + z * cos];
};

// The turn of a corner from the left-handed frame, whose RightBack edge runs
// along +x and whose LeftBack edge runs along +z.
const cornerTurnOf = (root: any): number => {
  const right = cornerVector(root, 'Right');
  const vector = right ?? cornerVector(root, 'Left');
  if (!vector) {
    return 0;
  }
  const dx = vector.end[0] - vector.start[0];
  const dz = vector.end[2] - vector.start[2];
  // rotatedAboutY turns +x into [cos, -sin] and +z into [sin, cos] (x, z)
  return normalizeDegrees(
    right ? degreesOf(Math.atan2(-dz, dx)) : degreesOf(Math.atan2(dx, dz)),
  );
};

export const anchorFrameOfRoot = (root: any): AnchorFrame => {
  const turnY = cornerTurnOf(root);
  const turnedPoints = ((root?.dockInfos ?? []) as any[])
    .flatMap((dockInfo) => [dockInfo?.start, dockInfo?.end])
    .filter(isPoint)
    .map((point) => rotatedAboutY(point, -turnY));
  if (turnedPoints.length === 0) {
    return IDENTITY_FRAME;
  }
  const lowest = (axis: number) =>
    Math.min(...turnedPoints.map((point) => point[axis]));
  return {
    point: roundedPoint(rotatedAboutY([lowest(0), lowest(1), lowest(2)], turnY)),
    turnY,
  };
};

// The frame depends on the article and its attributes - the hand of a corner
// article, the width of a hood - so it is learned per library, article and
// attribute overrides.
export const anchorVariantKey = (root: any, libraryId?: string): string =>
  JSON.stringify([
    root.libraryId ?? libraryId ?? '',
    root.articleId,
    (root.attributes ?? [])
      .map((attribute: any) => [attribute.id, String(attribute.value)])
      .sort(([a]: string[], [b]: string[]) => a.localeCompare(b)),
  ]);

export const anchorRootOf = (
  roots: any[],
  placement: Placement,
  articles: any[],
): any =>
  findAnchorRoot(roots, placement.rootId, (root) =>
    isCornerArticle(articles, root),
  );

const isIdentity = (frame: AnchorFrame): boolean =>
  frame.turnY === 0 && frame.point.every((component) => component === 0);

/**
 * The planner's repositioning of a new group from the agent's placement: the
 * docking corner of the anchor root lands at posGroup, turned by posRotationY.
 * The planner places the anchor root by rootRelPos and rootRelRotationY from
 * that point, so an anchor whose origin is not its docking corner - a range
 * hood, a corner article - is moved and turned by its frame.
 */
export const toRepositioningData = (
  roots: any[],
  placement: Placement,
  articles: any[],
  anchorFrames: Map<string, AnchorFrame> = new Map(),
  libraryId?: string,
): RepositioningData => {
  const anchor = anchorRootOf(roots, placement, articles);
  const frame =
    anchorFrames.get(anchorVariantKey(anchor, libraryId)) ?? IDENTITY_FRAME;
  const repositioning: RepositioningData = {
    posGroup: placement.posGroup,
    posRotationY: placement.posRotationY,
    rootId: anchor.id,
  };
  if (isIdentity(frame)) {
    return repositioning;
  }
  return {
    ...repositioning,
    rootRelPos: roundedPoint(
      rotatedAboutY(
        frame.point.map((component) => -component),
        -frame.turnY,
      ),
    ),
    rootRelRotationY: normalizeDegrees(-frame.turnY),
  };
};

export interface GroupPosition {
  pos?: number[];
  rotationY?: number;
  footprint?: GroupFootprint;
}

// The group-space footprint measured from a frame at corner, turned by
// rotationY.
const footprintInFrame = (
  footprint: GroupFootprint,
  corner: number[],
  rotationY: number,
): GroupFootprint => {
  const points = footprint.x.flatMap((x) =>
    footprint.z.map((z) =>
      rotatedAboutY([x - corner[0], 0, z - corner[2]], -rotationY),
    ),
  );
  const range = (axis: number): [number, number] => [
    round2(Math.min(...points.map((point) => point[axis]))),
    round2(Math.max(...points.map((point) => point[axis]))),
  ];
  const x = range(0);
  const z = range(2);
  return { x, z, widthMm: round2(x[1] - x[0]), depthMm: round2(z[1] - z[0]) };
};

/**
 * The position of a calculated group as a placement names it: pos is the room
 * point of its anchor root's docking corner, rotationY the rotation of the
 * placement, and the footprint is measured from there - wherever the planner
 * keeps the group origin. Undefined for a group without a position.
 */
export const positionInPlacementFrame = (
  rawGroup: any,
  footprint?: GroupFootprint,
): GroupPosition | undefined => {
  const roots = ((rawGroup?.roots ?? []) as any[]).filter(
    (root) => !root?.isGenerated,
  );
  if (!isPoint(rawGroup?.pos) || roots.length === 0) {
    return undefined;
  }
  const anchor = findAnchorRoot(roots, undefined, hasCornerVectors);
  const frame = anchorFrameOfRoot(anchor);
  const rootRotationY = anchor.rotationY ?? 0;
  const articlePos = isPoint(anchor.articlePos) ? anchor.articlePos : [0, 0, 0];
  const corner = rotatedAboutY(frame.point, rootRotationY).map(
    (component, axis) => component + articlePos[axis],
  );
  const groupRotationY = rawGroup.rotationY ?? 0;
  const pos = rotatedAboutY(corner, groupRotationY).map(
    (component, axis) => component + rawGroup.pos[axis],
  );
  const frameRotationY = rootRotationY + frame.turnY;
  return {
    pos: roundedPoint(pos),
    rotationY: normalizeDegrees(groupRotationY + frameRotationY),
    ...(footprint && {
      footprint: footprintInFrame(footprint, corner, frameRotationY),
    }),
  };
};
