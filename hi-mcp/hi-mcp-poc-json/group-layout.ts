import { catalogArticleOf, isCornerArticle } from './group-placement';

export const RELATIONS = ['rightOf', 'leftOf', 'onTop', 'above', 'behind'] as const;

type Relation = (typeof RELATIONS)[number];

export const RELATION_FIELDS: string[] = [...RELATIONS, 'align', 'gapMm'];

export const WALL_UNIT = /\bwall ?units?\b/i;

const TALL_UNIT = /\btall ?units?\b/i;

const HOOD = /hood/i;

const HEIGHT = 'mod_Height';

const STACKING_VECTORS: Record<string, [string, string]> = {
  left: ['LeftTop', 'LeftBottom'],
  right: ['RightTop', 'RightBottom'],
  back: ['BackTop', 'BackBottom'],
};

interface Link {
  unit: any;
  target: any;
  relation: Relation;
  align: string;
  gapMm?: number;
}

interface Pair {
  own: string;
  other: string;
  mode?: string;
  offset: number[];
}

const quoted = (id: string) => `'${id}'`;

const numberOf = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const moduleIdsOf = (article: any): string[] =>
  ((article?.rootModules ?? []) as any[]).map((rootModule) => String(rootModule?.module?.id ?? ''));

const isWallUnitArticle = (article: any): boolean =>
  WALL_UNIT.test(String(article?.category ?? '')) || moduleIdsOf(article).some((id) => HOOD.test(id));

const isTallUnitArticle = (article: any): boolean => TALL_UNIT.test(String(article?.category ?? ''));

const articleHeight = (article: any): number | undefined =>
  numberOf(
    ((article?.rootModules?.[0]?.dimensions ?? []) as any[]).find((dimension) => dimension?.id === HEIGHT)
      ?.value,
  );

// The height most articles of a kind have in the library.
const usualHeight = (
  articles: any[],
  libraryId: string | undefined,
  isKind: (article: any) => boolean,
): number | undefined => {
  const counts = new Map<number, number>();
  for (const article of articles) {
    if ((libraryId && article.libraryId !== libraryId) || !isKind(article)) {
      continue;
    }
    const height = articleHeight(article);
    if (height !== undefined) {
      counts.set(height, (counts.get(height) ?? 0) + 1);
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0];
};

/**
 * Compiles the relations of a pos group - every root naming one neighbour
 * with rightOf, leftOf, onTop, above or behind - into the docking
 * (contextData) the planner arranges the roots by. A group without any
 * relation field is left as it is. Defaults and corrections are reported.
 */
export const relationsToDocking = (
  group: any,
  articles: any[],
  prefix: string,
  corrections: string[],
): string[] => {
  const roots = group.roots as any[];
  if (!roots.some((root) => RELATION_FIELDS.some((field) => root?.[field] !== undefined))) {
    return [];
  }
  const notes: string[] = [];
  const byId = new Map<string, any>(roots.map((root) => [root.id, root]));
  const articleOf = (root: any) => catalogArticleOf(articles, root);
  const isWall = (root: any) => isWallUnitArticle(articleOf(root));
  const isTall = (root: any) => isTallUnitArticle(articleOf(root));
  const libraryId = group.libraryId ?? roots.find((root) => root.libraryId)?.libraryId;
  const heightOf = (root: any) =>
    numberOf(((root?.attributes ?? []) as any[]).find((attribute) => attribute?.id === HEIGHT)?.value) ??
    articleHeight(articleOf(root));

  // The wall units hang with their tops at the top of the tall units; base and
  // tall units stand on the same plinth, so the plinth cancels out.
  const hangGap = (unit: any, carrier: any): number | undefined => {
    const tallHeight =
      roots.filter(isTall).map(heightOf).find((height) => height !== undefined) ??
      usualHeight(articles, libraryId, isTallUnitArticle);
    if (tallHeight === undefined) {
      return undefined;
    }
    const unitHeight =
      heightOf(unit) ?? usualHeight(articles, libraryId, (article) => WALL_UNIT.test(String(article?.category)));
    return Math.max(0, tallHeight - (unitHeight ?? 0) - (heightOf(carrier) ?? 0));
  };

  const links: Link[] = [];
  for (const root of roots) {
    const values = Object.fromEntries(RELATION_FIELDS.map((field) => [field, root[field]]));
    for (const field of RELATION_FIELDS) {
      delete root[field];
    }
    const named = RELATIONS.filter((relation) => values[relation] !== undefined);
    if (named.length === 0) {
      if (values.align !== undefined || values.gapMm !== undefined) {
        notes.push(`root ${quoted(root.id)} has align or gapMm but no relation - ignored`);
      }
      continue;
    }
    let [relation] = named;
    if (named.length > 1) {
      notes.push(`root ${quoted(root.id)} names ${named.join(' and ')} - only ${relation} was used`);
    }
    const target = byId.get(values[relation]);
    if (!target || target === root) {
      notes.push(
        `root ${quoted(root.id)}: ${relation} ${JSON.stringify(values[relation])} names no other root of the group - ignored`,
      );
      continue;
    }
    let gapMm = numberOf(values.gapMm);
    if (values.gapMm !== undefined && gapMm === undefined) {
      notes.push(`root ${quoted(root.id)}: gapMm ${JSON.stringify(values.gapMm)} is not a number - ignored`);
    }
    const align = String(values.align ?? 'left');
    if (!STACKING_VECTORS[align]) {
      notes.push(`root ${quoted(root.id)}: align ${JSON.stringify(values.align)} is not left, right or back - left was used`);
    }
    if (relation === 'above' && !isWall(root)) {
      notes.push(`root ${quoted(root.id)} is no wall unit - it stands rightOf ${quoted(target.id)} instead of above it`);
      relation = 'rightOf';
    } else if ((relation === 'rightOf' || relation === 'leftOf') && isWall(root) && !isWall(target) && !isTall(target)) {
      notes.push(`wall unit ${quoted(root.id)} hangs above the floor unit ${quoted(target.id)} instead of ${relation} it`);
      relation = 'above';
    } else if (relation === 'behind' && (isCornerArticle(articles, target) || isCornerArticle(articles, root))) {
      notes.push(`root ${quoted(root.id)}: a corner article has no back to dock behind - ignored`);
      continue;
    }
    if (gapMm !== undefined && relation !== 'onTop' && relation !== 'above') {
      notes.push(`root ${quoted(root.id)}: gapMm only lifts a unit onTop or above - ignored`);
      gapMm = undefined;
    }
    links.push({ unit: root, target, relation, align: STACKING_VECTORS[align] ? align : 'left', gapMm });
  }

  // Connected so far - by the relations and by docking written as contextData.
  const parent = new Map<string, string>(roots.map((root) => [root.id, root.id]));
  const find = (id: string): string => {
    const up = parent.get(id) ?? id;
    if (up === id) {
      return id;
    }
    const top = find(up);
    parent.set(id, top);
    return top;
  };
  const union = (a: string, b: string) => parent.set(find(a), find(b));
  for (const root of roots) {
    for (const context of root.contextData?.dockedRoots ?? []) {
      for (const entry of context?.dockedRoots ?? []) {
        if (byId.has(entry?.id)) {
          union(root.id, entry.id);
        }
      }
    }
  }
  const kept = links.filter((link) => {
    if (find(link.unit.id) === find(link.target.id)) {
      notes.push(
        `root ${quoted(link.unit.id)}: ${link.relation} ${quoted(link.target.id)} closes a ring of relations - dropped`,
      );
      return false;
    }
    union(link.unit.id, link.target.id);
    return true;
  });

  // A floor unit before the wall units, so the placement anchors on the floor.
  const firstFloorIndex = roots.findIndex((root) => !isWall(root));
  if (firstFloorIndex > 0) {
    roots.unshift(...roots.splice(firstFloorIndex, 1));
  }
  const inMain = (root: any) => find(root.id) === find(roots[0].id);
  const sideOfTall = (tall: any): Relation => {
    const floorRight = kept.some(
      (link) =>
        (link.target === tall && link.relation === 'rightOf' && !isWall(link.unit)) ||
        (link.unit === tall && link.relation === 'leftOf' && !isWall(link.target)),
    );
    const floorLeft = kept.some(
      (link) =>
        (link.target === tall && link.relation === 'leftOf' && !isWall(link.unit)) ||
        (link.unit === tall && link.relation === 'rightOf' && !isWall(link.target)),
    );
    return floorLeft && !floorRight ? 'leftOf' : 'rightOf';
  };
  const defaultLink = (root: any, index: number): Link | undefined => {
    const before = roots.slice(0, index).filter(inMain);
    const main = roots.filter(inMain);
    if (!isWall(root)) {
      const target =
        [...before].reverse().find((candidate) => !isWall(candidate)) ??
        main.find((candidate) => !isWall(candidate)) ??
        main[main.length - 1];
      return target && { unit: root, target, relation: 'rightOf', align: 'left' };
    }
    const wallBefore = [...before].reverse().find(isWall);
    if (wallBefore) {
      return { unit: root, target: wallBefore, relation: 'rightOf', align: 'left' };
    }
    const tall = main.find(isTall);
    if (tall) {
      return { unit: root, target: tall, relation: sideOfTall(tall), align: 'left' };
    }
    const floor = main.filter((candidate) => !isWall(candidate));
    const wallIndex = roots.filter(isWall).indexOf(root);
    const carrier = floor[Math.min(wallIndex, floor.length - 1)];
    return carrier
      ? { unit: root, target: carrier, relation: 'above', align: 'left' }
      : main[main.length - 1] && { unit: root, target: main[main.length - 1], relation: 'rightOf', align: 'left' };
  };
  roots.forEach((root, index) => {
    if (inMain(root) || kept.some((link) => link.unit === root)) {
      return;
    }
    const fallback = defaultLink(root, index);
    if (!fallback) {
      return;
    }
    kept.push(fallback);
    union(root.id, fallback.target.id);
    notes.push(`root ${quoted(root.id)} names no neighbour - it was put ${fallback.relation} ${quoted(fallback.target.id)}`);
  });

  const pairOf = (link: Link): Pair => {
    const { unit, target, relation } = link;
    if (relation === 'rightOf' || relation === 'leftOf') {
      const [near, far] = relation === 'rightOf' ? ['Right', 'Left'] : ['Left', 'Right'];
      const edge = isWall(unit) && isTall(target) ? 'Top' : 'Bottom';
      return { own: `${near}${edge}`, other: `${far}${edge}`, mode: 'StartStart', offset: [0, 0, 0] };
    }
    if (relation === 'behind') {
      return { own: 'BackBottom', other: 'BackBottom', offset: [0, 0, 0] };
    }
    const [own, other] = STACKING_VECTORS[link.align];
    let gap = link.gapMm ?? 0;
    if (relation === 'above' && link.gapMm === undefined && !isWall(target)) {
      const derived = hangGap(unit, target);
      if (derived === undefined) {
        notes.push(
          `wall unit ${quoted(unit.id)}: the height of the wall units is unknown - it stands on ${quoted(target.id)}; gapMm sets the gap`,
        );
      }
      gap = derived ?? 0;
    }
    return { own, other, mode: 'StartStart', offset: [0, gap, 0] };
  };

  // The planner arranges breadth-first from the first root and applies an
  // offset only in the direction of the entry, so each entry is written on the
  // root it reaches first.
  const neighbours = new Map<string, string[]>();
  const connect = (a: string, b: string) => {
    neighbours.set(a, [...(neighbours.get(a) ?? []), b]);
    neighbours.set(b, [...(neighbours.get(b) ?? []), a]);
  };
  for (const root of roots) {
    for (const context of root.contextData?.dockedRoots ?? []) {
      for (const entry of context?.dockedRoots ?? []) {
        if (byId.has(entry?.id)) {
          connect(root.id, entry.id);
        }
      }
    }
  }
  for (const { unit, target } of kept) {
    connect(unit.id, target.id);
  }
  const order = new Map<string, number>([[roots[0].id, 0]]);
  const queue = [roots[0].id];
  while (queue.length > 0) {
    for (const next of neighbours.get(queue.shift()!) ?? []) {
      if (!order.has(next)) {
        order.set(next, order.size);
        queue.push(next);
      }
    }
  }
  const reachedAt = (root: any) => order.get(root.id) ?? Number.MAX_SAFE_INTEGER;
  const addEntry = (root: any, ownDockingVector: string, entry: any) => {
    root.contextData ??= { dockedRoots: [] };
    root.contextData.dockedRoots ??= [];
    let context = root.contextData.dockedRoots.find(
      (candidate: any) => candidate.ownDockingVector === ownDockingVector,
    );
    if (!context) {
      context = { ownDockingVector, dockedRoots: [] };
      root.contextData.dockedRoots.push(context);
    }
    context.dockedRoots.push(entry);
  };
  for (const entryLink of kept) {
    const { own, other, mode, offset } = pairOf(entryLink);
    if (reachedAt(entryLink.target) <= reachedAt(entryLink.unit)) {
      addEntry(entryLink.target, own, { id: entryLink.unit.id, dockingVector: other, ...(mode && { mode }), offset });
    } else {
      addEntry(entryLink.unit, other, {
        id: entryLink.target.id,
        dockingVector: own,
        ...(mode && { mode }),
        offset: offset.map((value) => (value === 0 ? 0 : -value)),
      });
    }
  }

  corrections.push(...notes.map((note) => `${prefix}: ${note}`));
  return [];
};
