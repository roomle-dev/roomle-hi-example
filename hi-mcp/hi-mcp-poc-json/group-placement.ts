export interface Placement {
  posGroup: [number, number, number];
  posRotationY: number;
  rootId?: string;
}

export interface RepositioningData {
  posGroup: [number, number, number];
  posRotationY: number;
  rootId: string;
  rootRelPos?: [number, number, number];
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

/**
 * The planner's repositioning of a new group from the agent's placement: the
 * anchor root lands at posGroup, a corner article by its corner point.
 */
export const toRepositioningData = (
  roots: any[],
  placement: Placement,
  articles: any[],
): RepositioningData => {
  const anchor = findAnchorRoot(roots, placement.rootId, (root) =>
    isCornerArticle(articles, root),
  );
  const cornerPoint = catalogArticleOf(articles, anchor)?.cornerPoint;
  const hasCornerOffset =
    Array.isArray(cornerPoint) &&
    cornerPoint.length === 3 &&
    !isOrigin(cornerPoint);
  // + 0 turns -0 into 0
  const negated = (coordinate: number) => -coordinate + 0;
  return {
    posGroup: placement.posGroup,
    posRotationY: placement.posRotationY,
    rootId: anchor.id,
    ...(hasCornerOffset && {
      rootRelPos: [
        negated(cornerPoint[0]),
        negated(cornerPoint[1]),
        negated(cornerPoint[2]),
      ],
    }),
  };
};
