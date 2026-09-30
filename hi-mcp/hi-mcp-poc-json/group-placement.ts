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

const isOrigin = (point: number[]): boolean =>
  point.every((coordinate) => coordinate === 0);

const isCornerVector = (id: unknown): boolean =>
  /^(Left|Right)Back(Bottom|Top)$/.test(String(id));

/**
 * The corner point of a calculated corner article, root-local: the shared
 * start of its LeftBack/RightBack docking vectors. It lies left of the root
 * origin for a blind corner unit.
 */
export const cornerPointOfRoot = (root: any): [number, number, number] | undefined => {
  const cornerVectors = (root?.dockInfos ?? []).filter(
    (dockInfo: any) =>
      isCornerVector(dockInfo?.id) && Array.isArray(dockInfo.start) && dockInfo.start.length >= 3,
  );
  const vector =
    cornerVectors.find((dockInfo: any) => String(dockInfo.id).endsWith('Bottom')) ??
    cornerVectors[0];
  return vector ? [vector.start[0], vector.start[1], vector.start[2]] : undefined;
};

/**
 * The corner points the calculated groups of the plan reveal, by article id
 * and by root module name (the four corner articles share one module and its
 * geometry) - the planner's raw groups carry the docking vectors with
 * coordinates, the compact catalog only their names.
 */
export const cornerPointsByArticle = (
  calculatedGroups: any[],
): Map<string, [number, number, number]> => {
  const byKey = new Map<string, [number, number, number]>();
  for (const group of calculatedGroups ?? []) {
    for (const root of group?.roots ?? []) {
      const cornerPoint = cornerPointOfRoot(root);
      if (!cornerPoint) {
        continue;
      }
      for (const key of [root.articleId, root.name]) {
        if (key && !byKey.has(key)) {
          byKey.set(key, cornerPoint);
        }
      }
    }
  }
  return byKey;
};

export const moduleIdOf = (articles: any[], root: any): string | undefined =>
  catalogArticleOf(articles, root)?.rootModules?.[0]?.module?.id;

/**
 * The corner point of the root's article: from the calculated corner points of
 * the plan (by article or module), else from the catalog.
 */
export const cornerPointFor = (
  articles: any[],
  root: any,
  cornerPoints: Map<string, [number, number, number]>,
): [number, number, number] | undefined => {
  const cornerPoint =
    cornerPoints.get(root.articleId) ??
    cornerPoints.get(moduleIdOf(articles, root) ?? '') ??
    catalogArticleOf(articles, root)?.cornerPoint;
  return Array.isArray(cornerPoint) &&
    cornerPoint.length === 3 &&
    !isOrigin(cornerPoint)
    ? [cornerPoint[0], cornerPoint[1], cornerPoint[2]]
    : undefined;
};

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

// + 0 turns -0 into 0
const round2 = (value: number): number => Math.round(value * 100) / 100 + 0;

/**
 * The planner's repositioning of a new group from the agent's placement: the
 * anchor root's origin lands at posGroup. A corner article is anchored by its
 * corner point, so its origin offset, rotated into the room, is added to the
 * point the agent gave.
 */
export const toRepositioningData = (
  roots: any[],
  placement: Placement,
  articles: any[],
  cornerPoints: Map<string, [number, number, number]> = new Map(),
): RepositioningData => {
  const anchor = anchorRootOf(roots, placement, articles);
  const cornerPoint = cornerPointFor(articles, anchor, cornerPoints);
  if (!cornerPoint) {
    return {
      posGroup: placement.posGroup,
      posRotationY: placement.posRotationY,
      rootId: anchor.id,
    };
  }
  const originOffset = rotatedAboutY(
    [-cornerPoint[0], -cornerPoint[1], -cornerPoint[2]],
    placement.posRotationY,
  );
  return {
    posGroup: [
      round2(placement.posGroup[0] + originOffset[0]),
      round2(placement.posGroup[1] + originOffset[1]),
      round2(placement.posGroup[2] + originOffset[2]),
    ],
    posRotationY: placement.posRotationY,
    rootId: anchor.id,
  };
};
