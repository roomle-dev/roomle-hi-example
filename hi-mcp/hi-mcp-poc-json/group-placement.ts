export interface Placement {
  posGroup: [number, number, number];
  posRotationY: number;
  rootId?: string;
}

export interface RepositioningData {
  posGroup: [number, number, number];
  posRotationY: number;
  rootId: string;
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

// The corner geometry of a calculated corner article, root-local: the corner
// point - the shared start of its LeftBack/RightBack docking vectors - and the
// turn of its corner from the left-handed frame, whose RightBack edge runs
// along +x and whose LeftBack edge runs along +z. A right-handed article
// (carcase direction Right) has its corner on its right and a turn of 270.
export interface CornerFrame {
  point: [number, number, number];
  turnY: number;
}

// + 0 turns -0 into 0
const round2 = (value: number): number => Math.round(value * 100) / 100 + 0;

const normalizeDegrees = (degrees: number): number =>
  round2(((degrees % 360) + 360) % 360);

const cornerVector = (root: any, side: 'Left' | 'Right'): any =>
  ['Bottom', 'Top']
    .map((row) =>
      (root?.dockInfos ?? []).find(
        (dockInfo: any) =>
          dockInfo?.id === `${side}Back${row}` &&
          Array.isArray(dockInfo.start) &&
          dockInfo.start.length >= 3 &&
          Array.isArray(dockInfo.end) &&
          dockInfo.end.length >= 3,
      ),
    )
    .find(Boolean);

const degreesOf = (radians: number): number => (radians * 180) / Math.PI;

export const cornerFrameOfRoot = (root: any): CornerFrame | undefined => {
  const right = cornerVector(root, 'Right');
  const left = cornerVector(root, 'Left');
  const vector = right ?? left;
  if (!vector) {
    return undefined;
  }
  const dx = vector.end[0] - vector.start[0];
  const dz = vector.end[2] - vector.start[2];
  // rotatedAboutY turns +x into [cos, -sin] and +z into [sin, cos] (x, z)
  const turnY = right
    ? degreesOf(Math.atan2(-dz, dx))
    : degreesOf(Math.atan2(dx, dz));
  return {
    point: [vector.start[0], vector.start[1], vector.start[2]],
    turnY: normalizeDegrees(turnY),
  };
};

// The hand and the corner point depend on the article and its attributes, so a
// frame is learned per library, article and attribute overrides.
export const cornerVariantKey = (root: any, libraryId?: string): string =>
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

// Counter-clockwise as seen from above (the planner's rotationY): local +x
// turns towards room -z, local +z towards room +x.
const rotatedAboutY = (
  [x, y, z]: [number, number, number],
  degrees: number,
): [number, number, number] => {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [x * cos + z * sin, y, -x * sin + z * cos];
};

/**
 * The planner's repositioning of a new group from the agent's placement: the
 * anchor root's origin lands at posGroup. A corner article is anchored by its
 * corner point, and its turn is taken off the rotation, so that its back edges
 * run along the walls the corner rules name whatever its hand; the origin
 * offset, rotated into the room, is added to the point the agent gave.
 */
export const toRepositioningData = (
  roots: any[],
  placement: Placement,
  articles: any[],
  cornerFrames: Map<string, CornerFrame> = new Map(),
  libraryId?: string,
): RepositioningData => {
  const anchor = anchorRootOf(roots, placement, articles);
  const frame = isCornerArticle(articles, anchor)
    ? cornerFrames.get(cornerVariantKey(anchor, libraryId))
    : undefined;
  if (!frame) {
    return {
      posGroup: placement.posGroup,
      posRotationY: placement.posRotationY,
      rootId: anchor.id,
    };
  }
  const posRotationY = normalizeDegrees(placement.posRotationY - frame.turnY);
  const originOffset = rotatedAboutY(
    [-frame.point[0], -frame.point[1], -frame.point[2]],
    posRotationY,
  );
  return {
    posGroup: [
      round2(placement.posGroup[0] + originOffset[0]),
      round2(placement.posGroup[1] + originOffset[1]),
      round2(placement.posGroup[2] + originOffset[2]),
    ],
    posRotationY,
    rootId: anchor.id,
  };
};
