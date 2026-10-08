import {
  IDENTITY_FRAME,
  anchorFrameOfRoot,
  anchorRootOf,
  anchorVariantKey,
  catalogArticleOf,
  isCornerArticle,
  positionInPlacementFrame,
  toRepositioningData,
} from './group-placement';
import type { AnchorFrame } from './group-placement';
import {
  RELATIONS,
  RELATION_FIELDS,
  WALL_UNIT,
  hangGapOf,
  isTallUnitArticle,
  isWallUnitArticle,
  relationsToDocking,
} from './group-layout';
import {
  adjoiningWall,
  alignmentRunsParallel,
  convexHull,
  footprintCornersInRoom,
  freeStretchesAlongWall,
  groupCornerGeometry,
  groupFootprint,
  groupPointToRoom,
  groupHeightRange,
  placeAgainstWall,
  placeCornerAtWalls,
  pointInsideRoom,
  repositioningFromPlacement,
  roomCorners,
  roomOfPoint,
  rootFootprintInRoom,
  rootVolumesInRoom,
  rotateDirection,
  spanAlongWall,
  stripInFrontOfWall,
  volumesOverlap,
  wallName,
  wallOfOpening,
  wallOfRoot,
  wallSpanStart,
} from './plan-space';
import type {
  DerivedWall,
  GroupFootprint,
  PlacedVolume,
  RootVolume,
  WallAlignment,
  WallSide,
} from './plan-space';
import { planHistory } from './plan-history';
import type { PlannerApi } from './planner-api';

export type ToolExecutor = (
  roomDesignerApi: PlannerApi,
  args: Record<string, unknown>
) => Promise<unknown>;

type PlanContextSection =
  | 'masterData'
  | 'rooms'
  | 'articles'
  | 'groups'
  | 'obstacles';

const PLAN_CONTEXT_SECTIONS: unknown[] = [
  'masterData',
  'rooms',
  'articles',
  'groups',
  'obstacles',
];

const DEFAULT_SECTIONS: PlanContextSection[] = [
  'rooms',
  'articles',
  'groups',
  'obstacles',
];

const MAX_ATTRIBUTE_MATCHES = 20;

const isGeneratedRoot = (root: any): boolean => root?.isGenerated === true;

const stripDockingIndices = (contextData: any) => ({
  dockedRoots: (contextData?.dockedRoots ?? []).map((dockedContext: any) => ({
    ownDockingVector: dockedContext.ownDockingVector,
    dockedRoots: (dockedContext.dockedRoots ?? []).map((dockedRoot: any) => ({
      id: dockedRoot.id,
      dockingVector: dockedRoot.dockingVector,
      ...(dockedRoot.mode !== undefined && { mode: dockedRoot.mode }),
      ...(dockedRoot.offset !== undefined && { offset: dockedRoot.offset }),
    })),
  })),
});

// The only shape a root module takes on its way from the agent to the
// planner: an article pick with attribute overrides and docking. Root
// positions never travel; the arrangement derives them from contextData.
const toArticlePick = (root: any) => ({
  id: root.id,
  articleId: root.articleId,
  ...(root.libraryId && { libraryId: root.libraryId }),
  ...(root.attributes?.length && {
    attributes: root.attributes.map((attribute: any) => ({
      id: attribute.id,
      value: attribute.value,
    })),
  }),
  ...(root.contextData && {
    contextData: stripDockingIndices(root.contextData),
  }),
  ...Object.fromEntries(
    RELATION_FIELDS.filter((field) => root[field] !== undefined).map(
      (field) => [field, root[field]]
    )
  ),
});

// The planner's own roots on the way back into the planner: unchanged apart
// from the positions and the docking indices.
const withoutPositions = (root: any) => {
  const copy = { ...root };
  delete copy.articlePos;
  delete copy.rotationY;
  if (copy.contextData) {
    copy.contextData = stripDockingIndices(copy.contextData);
  }
  return copy;
};

// A calculated group sent back with a new placement: the placement becomes
// repositioningData of the first article root, and no root carries a
// position. The generated roots (worktop, toe kick) travel with the group, so
// they keep their attributes - the colours - over the reload.
const repositionedGroup = (resultGroup: any, placement: GroupPlacement) => {
  const roots = (resultGroup.roots ?? []) as any[];
  const anchor = roots.find((root) => !isGeneratedRoot(root));
  if (!anchor) {
    throw new Error(`Group '${resultGroup.id}' has no article root to place.`);
  }
  return {
    id: resultGroup.id,
    ...(resultGroup.libraryId && { libraryId: resultGroup.libraryId }),
    roots: roots.map(withoutPositions),
    repositioningData: repositioningFromPlacement(placement, anchor),
  };
};

const attributeMatches = (attribute: any, needle: string): boolean =>
  [
    attribute.id,
    attribute.name,
    attribute.desc,
    attribute.group,
    ...(attribute.selections ?? []).flatMap((selection: any) => [
      selection.name,
      selection.desc,
      selection.value,
    ]),
  ].some(
    (value) =>
      value !== undefined &&
      value !== null &&
      String(value).toLowerCase().includes(needle)
  );

const isArticlePickOnly = (root: any): boolean =>
  !root?.posData && !root?.modules && !root?.parts;

// A root authored by the agent is just an article pick (id, articleId,
// optional attribute overrides and docking contextData). The glue logic
// completes it from the article template; here the article id is validated
// against the catalog so the agent gets a helpful error instead of a
// half-calculated group.
// With a libraryId, only the articles of that library are valid.
const unknownArticleMessage = (articles: any[], root: any): string => {
  const validIds = articles
    .filter(
      (candidate) => !root.libraryId || candidate.libraryId === root.libraryId
    )
    .map((candidate) => candidate.articleId);
  return (
    `articleId '${root.articleId}' is not in the article catalog` +
    (root.libraryId ? ` of library '${root.libraryId}'` : '') +
    `. Valid article ids: ${validIds.slice(0, 100).join(', ')}`
  );
};

// The catalog's spelling of an article id that differs only in case or
// surrounding whitespace, when exactly one article of the library matches.
const catalogSpellingOf = (articles: any[], root: any): string | undefined => {
  const wanted = String(root.articleId).trim().toLowerCase();
  const matches = new Set(
    articles
      .filter(
        (candidate) =>
          (!root.libraryId || candidate.libraryId === root.libraryId) &&
          String(candidate.articleId).trim().toLowerCase() === wanted
      )
      .map((candidate) => candidate.articleId as string)
  );
  return matches.size === 1 ? [...matches][0] : undefined;
};

// The article id as the catalog spells it; an id the catalog does not have
// fails with the valid ids.
const catalogArticleId = (
  articles: any[],
  root: any,
  label: string,
  corrections: string[]
): string => {
  if (catalogArticleOf(articles, root)) {
    return root.articleId;
  }
  const spelling = catalogSpellingOf(articles, root);
  if (!spelling) {
    throw new Error(unknownArticleMessage(articles, root));
  }
  corrections.push(
    `${label}: articleId '${root.articleId}' was read as '${spelling}'`
  );
  return spelling;
};

// A root whose article the catalog does not have is not built; the other
// roots of the group are. The dropped root is named in notLoaded, and what
// named it - a relation, a docking entry - names nothing any more. A group
// whose every root is unknown is not built.
const resolveArticleIds = (
  articles: any[],
  { group, index }: CallGroup,
  prefix: string,
  corrections: string[],
  notLoaded: NotLoadedGroup[]
): string[] => {
  const unknown: { root: any; message: string }[] = [];
  for (const root of (group.roots as any[]).filter(isArticlePickOnly)) {
    const label = `${prefix} root '${root.id}'`;
    try {
      root.articleId = catalogArticleId(articles, root, label, corrections);
    } catch (error) {
      unknown.push({ root, message: `${label}: ${(error as Error).message}` });
    }
  }
  if (unknown.length === 0) {
    return [];
  }
  const remaining = (group.roots as any[]).filter(
    (root) => !unknown.some((entry) => entry.root === root)
  );
  if (remaining.length === 0) {
    return unknown.map((entry) => entry.message);
  }
  const droppedIds = unknown.map((entry) => String(entry.root.id));
  group.roots = remaining;
  removeReferencesTo(group.roots, new Set(droppedIds));
  notLoaded.push({
    index,
    ...(typeof group.id === 'string' && { id: group.id }),
    rootIds: droppedIds,
    errors: unknown.map(
      (entry) =>
        `${entry.message} - the root was not built, the other roots were; send it with merge-article-into-group or a valid article id`
    ),
  });
  return [];
};

// Relations and docking entries that named a dropped root name nothing: the
// root they are on gets the default of a root without a relation.
const removeReferencesTo = (roots: any[], droppedIds: Set<string>): void => {
  for (const root of roots) {
    for (const relation of RELATIONS) {
      if (droppedIds.has(root[relation])) {
        delete root[relation];
      }
    }
    for (const context of root.contextData?.dockedRoots ?? []) {
      context.dockedRoots = (context.dockedRoots ?? []).filter(
        (entry: any) => !droppedIds.has(entry?.id)
      );
    }
    if (root.contextData?.dockedRoots) {
      root.contextData.dockedRoots = root.contextData.dockedRoots.filter(
        (context: any) => context.dockedRoots.length > 0
      );
    }
  }
};

// A root module id as the plan knows it: the exact id, else a unique prefix,
// else the unique root whose UUID differs only in its first segment, else the
// unique root whose id differs in one character. An id that matches nothing
// or more than one root is forwarded as sent.
const resolveRootId = (
  roots: any[],
  rootId: string,
  label: string,
  corrections: string[]
): string => {
  const ids = roots.map((root) => String(root?.id));
  // an empty id is no prefix of anything; the planner answers it
  if (rootId.length === 0 || ids.includes(rootId)) {
    return rootId;
  }
  const unique = (candidates: string[]): string | undefined =>
    candidates.length === 1 ? candidates[0] : undefined;
  const withoutFirstSegment = (id: string) => id.split('-').slice(1).join('-');
  const oneCharacterOff = (id: string) =>
    id.length === rootId.length &&
    [...id].filter((character, position) => character !== rootId[position])
      .length === 1;
  const resolved =
    unique(ids.filter((id) => id.startsWith(rootId))) ??
    unique(
      ids.filter(
        (id) =>
          id.includes('-') &&
          id.length === rootId.length &&
          withoutFirstSegment(id) === withoutFirstSegment(rootId)
      )
    ) ??
    unique(ids.filter(oneCharacterOff));
  if (resolved === undefined) {
    return rootId;
  }
  corrections.push(`${label}: root id '${rootId}' was read as '${resolved}'`);
  return resolved;
};

const rootsOfGroups = (groups: any[]): any[] =>
  groups.flatMap((group) => (group?.roots ?? []) as any[]);

// The planner's "not found" for a root module, with the roots of the plan.
const withPlanRoots = async <T>(
  run: () => Promise<T>,
  groups: any[]
): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/root module .* not found/i.test(message)) {
      throw new Error(
        `${message} Roots in the plan: ${rootsOfGroups(groups)
          .map((root) => root.id)
          .join(', ')}`
      );
    }
    throw error;
  }
};

// The calculated group and the room, for the question whether a unit docked
// to a row end would stand outside the room.
interface RowGeometry {
  rawGroup?: any;
  walls: any[];
}

const ARTICLE_WIDTH = 'mod_Width';

const articleWidth = (article: any): number => {
  const width = Number(
    ((article?.rootModules?.[0]?.dimensions ?? []) as any[]).find(
      (dimension) => dimension?.id === ARTICLE_WIDTH
    )?.value
  );
  return Number.isFinite(width) && width > 0 ? width : 600;
};

// Whether a unit of widthMm docked to the side vector of the given root stays
// inside the room; undefined when the geometry is not known.
const unitStaysInRoom = (
  geometry: RowGeometry,
  rootId: string,
  vector: string,
  widthMm: number
): boolean | undefined => {
  const rawRoot = ((geometry.rawGroup?.roots ?? []) as any[]).find(
    (candidate) => candidate.id === rootId
  );
  if (!rawRoot || geometry.walls.length < 3) {
    return undefined;
  }
  const footprint = rootFootprintInRoom(geometry.rawGroup, rawRoot);
  if (footprint.length === 0) {
    return undefined;
  }
  // the row runs along the root's local x axis: +x for RightBottom, -x for LeftBottom
  const [dx, dz] = rotateDirection(
    [vector === 'RightBottom' ? 1 : -1, 0],
    (rawRoot.rotationY ?? 0) + (geometry.rawGroup.rotationY ?? 0)
  );
  const along = ([x, z]: [number, number]) => x * dx + z * dz;
  const edge = footprint.reduce((best, point) =>
    along(point) > along(best) ? point : best
  );
  const far: [number, number] = [
    edge[0] + dx * widthMm,
    edge[1] + dz * widthMm,
  ];
  return pointInsideRoom(far, geometry.walls, OVERLAP_TOLERANCE_MM);
};

// Where a new unit docks to a group as get-plan-context shows it. A side that
// is taken moves to the free end of that row in the direction the agent named
// - a corner article ends a row, so a walk that meets one turns to the other
// end of the leg -; when the unit would stand outside the room there, it
// takes the named root's own free side instead. A docking vector the article
// does not have becomes the partner of the root's vector. A side the planner
// reports as taken although the row ends there stays as asked.
const dockTarget = (
  group: any,
  article: any,
  dockTo: any,
  corrections: string[],
  articles: any[],
  geometry: RowGeometry = { walls: [] }
): any => {
  const roots = (group.roots ?? []) as any[];
  const vector = dockTo.ownDockingVector;
  const root = roots.find((candidate) => candidate.id === dockTo.rootId);
  if (
    root &&
    SIDE_VECTORS.includes(vector) &&
    !(root.freeDockingVectors ?? []).includes(vector)
  ) {
    const opposite = SIDE_PARTNER[vector];
    const partnerOf = (own: string) =>
      dockTo.dockingVector === PARTNER_VECTOR[vector]
        ? PARTNER_VECTOR[own]
        : dockTo.dockingVector;
    const partners = sidePartnersOf(roots);
    const isCorner = cornerPredicate(roots, articles);
    const freeEnd = (along: string, end: string | undefined) => {
      const endRoot = roots.find((candidate) => candidate.id === end);
      return endRoot &&
        end !== root.id &&
        (endRoot.freeDockingVectors ?? []).includes(along)
        ? end
        : undefined;
    };
    const candidates: { rootId: string; vector: string; note: string }[] = [];
    const walk = rowWalk(partners, root.id, vector, isCorner);
    const end = freeEnd(vector, walk.end);
    if (end !== undefined) {
      candidates.push({
        rootId: end,
        vector,
        note: `the ${vector} of '${end}', the free end of that row`,
      });
    } else if (walk.corner !== undefined) {
      const legEnd = freeEnd(
        opposite,
        rowWalk(partners, root.id, opposite, isCorner).end
      );
      if (legEnd !== undefined) {
        candidates.push({
          rootId: legEnd,
          vector: opposite,
          note: `the ${opposite} of '${legEnd}', the free end of its leg (the row ends at the corner article '${walk.corner}')`,
        });
      }
    }
    if ((root.freeDockingVectors ?? []).includes(opposite)) {
      candidates.push({
        rootId: root.id,
        vector: opposite,
        note: `its free ${opposite}`,
      });
    }
    if (candidates.length > 0) {
      const width = articleWidth(article);
      const inside = candidates.map((candidate) =>
        unitStaysInRoom(geometry, candidate.rootId, candidate.vector, width)
      );
      const chosenIndex = Math.max(
        0,
        inside.findIndex((stays) => stays !== false)
      );
      const chosen = candidates[chosenIndex];
      const skipped = candidates
        .slice(0, chosenIndex)
        .map(
          (candidate) =>
            ` (a unit at ${candidate.note} would stand outside the room)`
        )
        .join('');
      corrections.push(
        `merge-article-into-group: the ${vector} of root '${root.id}' is taken - the unit was docked to ${chosen.note}${skipped}`
      );
      dockTo.rootId = chosen.rootId;
      if (chosen.vector !== vector) {
        dockTo.dockingVector = partnerOf(chosen.vector);
        dockTo.ownDockingVector = chosen.vector;
      }
    }
  }
  const vectors = articleDockingVectors(article);
  const partner = PARTNER_VECTOR[vector];
  if (
    vectors &&
    vectors.length > 0 &&
    !vectors.includes(dockTo.dockingVector) &&
    partner &&
    vectors.includes(partner)
  ) {
    corrections.push(
      `merge-article-into-group: article '${article.articleId}' has no docking vector '${dockTo.dockingVector}' - ` +
        `its ${partner} meets the ${vector}`
    );
    dockTo.dockingVector = partner;
  }
  // A wall unit or a range hood docked on top of a floor unit meets the Top
  // vector with its Bottom vector and hangs at the height of the wall units
  // (D35) unless the agent sets the gap itself.
  const carrier = roots.find((candidate) => candidate.id === dockTo.rootId);
  const carrierArticle = carrier && catalogArticleOf(articles, carrier);
  const own = String(dockTo.ownDockingVector);
  if (
    article &&
    carrierArticle &&
    isWallUnitArticle(article) &&
    !isWallUnitArticle(carrierArticle) &&
    !isTallUnitArticle(carrierArticle) &&
    own.endsWith('Top') &&
    String(dockTo.dockingVector).endsWith('Top') &&
    PARTNER_VECTOR[own]
  ) {
    corrections.push(
      `merge-article-into-group: a wall unit above '${carrier.id}' meets its ${own} with its ${PARTNER_VECTOR[own]}, not with its ${dockTo.dockingVector}`
    );
    dockTo.dockingVector = PARTNER_VECTOR[own];
  }
  if (
    article &&
    carrierArticle &&
    isWallUnitArticle(article) &&
    !isWallUnitArticle(carrierArticle) &&
    !isTallUnitArticle(carrierArticle) &&
    own.endsWith('Top') &&
    String(dockTo.dockingVector).endsWith('Bottom') &&
    !(Number(dockTo.offset?.[1]) > 0)
  ) {
    const gap = hangGapOf(
      articles,
      group.libraryId,
      roots,
      { articleId: article.articleId, libraryId: group.libraryId },
      carrier
    );
    if (gap) {
      dockTo.offset = [
        Number(dockTo.offset?.[0] ?? 0) || 0,
        gap,
        Number(dockTo.offset?.[2] ?? 0) || 0,
      ];
      corrections.push(
        `merge-article-into-group: '${article.articleId}' hangs ${gap} mm above '${carrier.id}', at the height of the wall units`
      );
    }
  }
  return dockTo;
};

// The server's corrections, then the planner's, each named by its tool.
const withCorrections = (result: any, corrections: string[]) => {
  const all = [
    ...corrections,
    ...((result?.corrections ?? []) as string[]).map(
      (correction) => `${result.command}: ${correction}`
    ),
  ];
  return all.length > 0 ? { ...result, corrections: all } : result;
};

// The root after `start` along a side vector, when the row reaches `target`
// in that direction - past a corner article, which joins two legs.
const neighbourTowards = (
  partners: SidePartners,
  start: string,
  vector: string,
  target: string
): string | undefined => {
  const [next] = partners.get(start)?.get(vector)?.keys() ?? [];
  const visited = new Set([start]);
  let current = next;
  while (current !== undefined && !visited.has(current)) {
    if (current === target) {
      return next;
    }
    visited.add(current);
    [current] = partners.get(current)?.get(vector)?.keys() ?? [];
  }
  return undefined;
};

const roundedPosition = (position: unknown): string =>
  JSON.stringify(
    ((position ?? []) as number[]).map((value) => Math.round(Number(value)))
  );

const volumeOfGroup = (
  groups: any[],
  groupId: string
): PlacedVolume | undefined => {
  const group = groups.find((candidate) => candidate.id === groupId);
  const footprint = group && groupFootprint(group);
  return footprint
    ? volumeOf(footprint, groupHeightRange(group), group)
    : undefined;
};

// What a row edit did to a row that stood inside the room and clear of the
// other groups (D43). A group that stood outside before is the user's choice
// and is never reported (D22).
const rowReachHints = (
  groupId: string,
  before: any[],
  after: any[],
  walls: any[]
): string[] => {
  const volumeBefore = volumeOfGroup(before, groupId);
  const volumeAfter = volumeOfGroup(after, groupId);
  if (!volumeAfter) {
    return [];
  }
  const hints: string[] = [];
  const reachesOut = (volume: PlacedVolume | undefined) =>
    volume !== undefined &&
    volume.corners.some(
      (corner) => !pointInsideRoom(corner, walls, OVERLAP_TOLERANCE_MM)
    );
  if (
    walls.length >= 3 &&
    volumeBefore &&
    !reachesOut(volumeBefore) &&
    reachesOut(volumeAfter)
  ) {
    hints.push(
      'the row now reaches past a wall of the room - move it with place-group or edit the row if that is not what was asked'
    );
  }
  const overlappedBefore = new Set(
    volumeBefore
      ? overlappedGroupIds(volumeBefore, placedGroupVolumes(before, groupId))
      : []
  );
  // only the groups that stood beside the row: a group the edit split off
  // was part of it
  const stoodBefore = new Set(before.map((group) => group.id));
  const overlapped = overlappedGroupIds(
    volumeAfter,
    placedGroupVolumes(after, groupId)
  ).filter((id) => stoodBefore.has(id) && !overlappedBefore.has(id));
  if (overlapped.length > 0) {
    hints.push(
      `the row now overlaps ${overlapped.map((id) => `group '${id}'`).join(', ')}`
    );
  }
  return hints;
};

// The wall units and the range hood the edit moved: they go with the unit
// below them (D42), and the kernel's docking no longer links them to it, so
// the catalog and the positions tell.
const movedUnitsAboveHint = (
  groupId: string,
  before: any[],
  after: any[],
  articles: any[]
): string[] => {
  const rawAfter = after.find((group) => group.id === groupId);
  if (!rawAfter) {
    return [];
  }
  // where a root stands in the room: the planner may move the group origin
  const roomPosition = (group: any, root: any): string => {
    const [x = 0, y = 0, z = 0] = (root.articlePos ?? []) as number[];
    const [roomX, roomZ] = groupPointToRoom(group, [x, z]);
    return roundedPosition([roomX, Number(group.pos?.[1] ?? 0) + y, roomZ]);
  };
  const positionBefore = new Map<string, string>(
    before.flatMap((group) =>
      ((group.roots ?? []) as any[]).map((root) => [
        root.id,
        roomPosition(group, root),
      ])
    )
  );
  const moved = ((rawAfter.roots ?? []) as any[])
    .filter(
      (root) =>
        !root.isGenerated &&
        positionBefore.has(root.id) &&
        isWallUnitArticle(catalogArticleOf(articles, root)) &&
        positionBefore.get(root.id) !== roomPosition(rawAfter, root)
    )
    .map((root) => `'${root.id}'`);
  return moved.length > 0
    ? [
        `the wall units and the range hood above the moved units moved with them (${moved.join(', ')}) - edit the wall row the same way if it should line up with the floor units`,
      ]
    : [];
};

// A row edit with its hints: the plan before and after the edit decides.
const withRowHints = async (
  roomDesignerApi: PlannerApi,
  groupId: string,
  context: any,
  edit: () => Promise<any>
): Promise<any> => {
  const rooms = (context?.rooms?.rooms ?? []) as any[];
  const before = ((await roomDesignerApi.extended.getExternalObjectGroups()) ??
    []) as any[];
  const result = await edit();
  const after = ((await roomDesignerApi.extended.getExternalObjectGroups()) ??
    []) as any[];
  const rawGroup = after.find((candidate) => candidate.id === groupId);
  const room =
    (isPoint(rawGroup?.pos) &&
      roomOfPoint(
        rooms,
        [rawGroup.pos[0], rawGroup.pos[2]],
        OVERLAP_TOLERANCE_MM
      )) ||
    rooms[0];
  const hints = [
    ...rowReachHints(groupId, before, after, room?.walls ?? []),
    ...movedUnitsAboveHint(groupId, before, after, context?.articles ?? []),
  ];
  return hints.length > 0 ? { ...result, hint: hints.join('; ') } : result;
};

// The two neighbours a unit is inserted between. Two roots of one row that
// are not neighbours name the first root and the direction: the unit goes
// beside the first-named root, towards the second.
const insertBetween = (
  group: any,
  [first, second]: [string, string],
  corrections: string[]
): [string, string] => {
  const partners = sidePartnersOf(group.roots ?? []);
  const neighbours = SIDE_VECTORS.flatMap((vector) => [
    ...(partners.get(first)?.get(vector)?.keys() ?? []),
  ]);
  if (neighbours.includes(second)) {
    return [first, second];
  }
  for (const vector of SIDE_VECTORS) {
    const neighbour = neighbourTowards(partners, first, vector, second);
    if (neighbour !== undefined) {
      corrections.push(
        `insert-article-into-group: '${first}' and '${second}' are not neighbours - the unit was inserted between '${first}' and '${neighbour}', the neighbour of '${first}' towards '${second}'`
      );
      return [first, neighbour];
    }
  }
  throw new Error(
    `insert-article-into-group: '${first}' and '${second}' are not in one row - send two neighbours of one row (the side neighbours of '${first}': ${neighbours.join(', ') || 'none'})`
  );
};

// A group by its id or a unique id prefix.
const findGroup = (groups: any[], groupId: string): any => {
  const prefixMatches = groupId
    ? groups.filter((candidate) => candidate.id.startsWith(groupId))
    : [];
  const group =
    groups.find((candidate) => candidate.id === groupId) ??
    (prefixMatches.length === 1 ? prefixMatches[0] : undefined);
  if (!group) {
    const groupIds = groups.map((candidate) => candidate.id);
    throw new Error(
      `Group '${groupId}' not found. Groups in the plan: ` +
        `${groupIds.join(', ') || 'none'}.`
    );
  }
  return group;
};

// The group whose roots hold a root module, by the root id as resolveRootId
// reads it across the plan.
const groupOfRoot = (groups: any[], rootId: string): any => {
  const resolved = resolveRootId(rootsOfGroups(groups), rootId, '', []);
  const group = groups.find((candidate) =>
    (candidate.roots ?? []).some((root: any) => String(root?.id) === resolved)
  );
  if (!group) {
    const rootIds = rootsOfGroups(groups).map((root) => root.id);
    throw new Error(
      `Root module '${rootId}' not found. Roots in the plan: ` +
        `${rootIds.join(', ') || 'none'}.`
    );
  }
  return group;
};

const planGroups = async (roomDesignerApi: PlannerApi): Promise<any[]> =>
  ((await roomDesignerApi.extended.getExternalObjectPlanContext(['groups']))
    .groups ?? []) as any[];

// The agent picks corner articles by cornerArticle; the flag is completed for
// an empty plan, and the corner point stays with the server.
const agentFacingArticle = (article: any, articles: any[]) => {
  const compact = {
    ...article,
    cornerArticle: isCornerArticle(articles, article),
  };
  delete compact.cornerPoint;
  return compact;
};

// The walls in the words of the user: a name per wall, an opening named as
// such (the contour gives it no type), and the room corners with their point
// and the rotation of a corner kitchen there.
const agentFacingRooms = (rooms: any) => {
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
const agentFacingObstacles = (obstacles: any, rooms: any) => {
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

const PLACEMENT_FIELDS = ['posGroup', 'posRotationY', 'rootId'];

// The planner takes a string or a boolean; a number is passed as its string.
const attributeValue = (value: unknown): unknown =>
  typeof value === 'number' ? String(value) : value;

const WALL_PLACEMENT_FIELDS = ['wall', 'alignment', 'offsetMm'];

const PROBE_ROOT_ID = 'anchor-probe';

// Anchor frames the server has learned by probing, per library, article and
// attribute overrides, for its lifetime.
const knownAnchorFrames = new Map<string, AnchorFrame>();

export const forgetAnchorFrames = (): void => knownAnchorFrames.clear();

// The frame of an anchor exists only as calculated geometry - the catalog has
// no docking vector coordinates - and it depends on the attributes. The
// planner calculates the anchor once as authored - article and attribute
// overrides - in a single-pick probe group; its docking vectors are read from
// the raw groups, and the probe load is undone, so it leaves no step on the
// planner's undo history. An article calculated without docking vectors gets
// the identity. Undefined when the planner calculated nothing.
// The groups the probe load added and an undo left in the plan - on a page
// without undo on its allow-list - are removed (the load result carries
// runtime ids only, which removal does not take).
const takeBackProbe = async (
  roomDesignerApi: PlannerApi,
  loaded: unknown,
  probes: any[],
  planGroupIds: Set<string>
): Promise<void> => {
  let left = probes;
  if (Array.isArray(loaded) && loaded.length > 0) {
    try {
      await roomDesignerApi.extended.undo();
      left = (
        ((await roomDesignerApi.extended.getExternalObjectGroups()) ??
          []) as any[]
      ).filter((group) => !planGroupIds.has(group.id));
    } catch {
      left = probes;
    }
  }
  for (const probe of left) {
    await roomDesignerApi.extended.removeExternalObject(probe.id);
  }
};

const probeAnchorFrame = async (
  roomDesignerApi: PlannerApi,
  anchor: any,
  libraryId: string | undefined,
  planGroupIds: Set<string>
): Promise<AnchorFrame | undefined> => {
  const loaded = await roomDesignerApi.extended.loadExternalObjectGroupLayout(
    {
      posGroups: [
        {
          ...(libraryId && { libraryId }),
          roots: [
            {
              id: PROBE_ROOT_ID,
              articleId: anchor.articleId,
              ...(anchor.attributes?.length && {
                attributes: anchor.attributes,
              }),
            },
          ],
        },
      ],
    },
    'posGroups',
    { reason: 'adjusted' }
  );
  const probes = (
    ((await roomDesignerApi.extended.getExternalObjectGroups()) ?? []) as any[]
  ).filter((group) => !planGroupIds.has(group.id));
  await takeBackProbe(roomDesignerApi, loaded, probes, planGroupIds);
  if (probes.length === 0) {
    return undefined;
  }
  const calculated = probes
    .flatMap((probe) => probe.roots ?? [])
    .find(
      (root: any) => !root?.isGenerated && (root?.dockInfos?.length ?? 0) > 0
    );
  return calculated ? anchorFrameOfRoot(calculated) : IDENTITY_FRAME;
};

const isPoint = (value: unknown): boolean =>
  Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);

const isFloorPoint = (value: unknown): value is [number, number] =>
  Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);

const PLACEMENT_NOT_USED =
  'it was not used, so the planner positions the group (an existing group keeps its position)';

// A placement as far as the server can use it. One it cannot use is dropped,
// so no repositioning reaches the planner and the planner positions the group.
const normalizePlacement = (
  group: any,
  rootIds: Set<string>,
  prefix: string,
  corrections: string[]
): void => {
  const { placement } = group;
  if (
    typeof placement !== 'object' ||
    placement === null ||
    Array.isArray(placement)
  ) {
    delete group.placement;
    corrections.push(
      `${prefix}: the placement is not { posGroup, posRotationY } - ${PLACEMENT_NOT_USED}`
    );
    return;
  }
  const unknownFields = Object.keys(placement).filter(
    (field) => !PLACEMENT_FIELDS.includes(field)
  );
  if (unknownFields.length > 0) {
    for (const field of unknownFields) {
      delete placement[field];
    }
    corrections.push(
      `${prefix}: the placement takes only posGroup, posRotationY and rootId - ` +
        `${unknownFields.join(', ')} dropped` +
        (unknownFields.some((field) => WALL_PLACEMENT_FIELDS.includes(field))
          ? '; place-group stands a group against a wall or into a corner by its side label'
          : '')
    );
  }
  if (isFloorPoint(placement.posGroup)) {
    const [x, z] = placement.posGroup;
    placement.posGroup = [x, 0, z];
    corrections.push(
      `${prefix}: the placement's posGroup [${x}, ${z}] was completed to [${x}, 0, ${z}] (y = 0 on the floor)`
    );
  }
  if (
    !isPoint(placement.posGroup) ||
    !Number.isFinite(placement.posRotationY)
  ) {
    delete group.placement;
    corrections.push(
      `${prefix}: the placement needs posGroup [x, y, z] in millimetres and posRotationY in degrees - ` +
        PLACEMENT_NOT_USED
    );
    return;
  }
  if (placement.rootId !== undefined && !rootIds.has(placement.rootId)) {
    corrections.push(
      `${prefix}: the placement's rootId '${placement.rootId}' is not a root of the group - ` +
        'dropped, the server anchors the group itself'
    );
    delete placement.rootId;
  }
};

// Every docking entry links two roots in both directions, as the planner
// mirrors it; an entry naming a root outside the group links nothing - a group
// keeps such an entry to a root deleted from it.
const dockingNeighbours = (roots: any[]): Map<string, Set<string>> => {
  const neighbours = new Map<string, Set<string>>();
  const link = (from: string, to: string) =>
    neighbours.set(from, (neighbours.get(from) ?? new Set()).add(to));
  const rootIds = new Set(roots.map((root) => root?.id));
  for (const root of roots) {
    for (const dockedContext of root?.contextData?.dockedRoots ?? []) {
      for (const dockedRoot of dockedContext?.dockedRoots ?? []) {
        if (rootIds.has(dockedRoot?.id)) {
          link(root.id, dockedRoot.id);
          link(dockedRoot.id, root.id);
        }
      }
    }
  }
  return neighbours;
};

// The roots the docking connects to the start roots.
const reachedFrom = (roots: any[], startIds: string[]): Set<string> => {
  const neighbours = dockingNeighbours(roots);
  const reached = new Set<string>(startIds);
  const queue = [...startIds];
  while (queue.length > 0) {
    for (const next of neighbours.get(queue.shift()!) ?? []) {
      if (!reached.has(next)) {
        reached.add(next);
        queue.push(next);
      }
    }
  }
  return reached;
};

// The planner arranges the roots reachable from the first root; a part the
// docking does not connect to it is arranged on its own from the group origin,
// on top of the first root. Each error continues the "posGroups[i]" prefix.
const dockingErrors = (roots: any[]): string[] => {
  const reached = reachedFrom(roots, [roots[0]?.id]);
  const quoted = (selected: any[]) =>
    selected.map((root) => `'${root?.id}'`).join(', ');
  const unreached = roots.filter((root) => !reached.has(root?.id));
  if (unreached.length === 0) {
    return [];
  }
  const placed = roots.filter((root) => reached.has(root?.id));
  return [
    `: roots ${quoted(unreached)} are not docked to a placed root (${quoted(placed)} ` +
      `${placed.length === 1 ? 'is' : 'are'} placed - reached through the docking from the first root); ` +
      'roots docked only among themselves land on the group origin, on top of the first root. Dock every ' +
      'additional root to a placed root by naming it on that root - root B itself is an entry of roots too -, e.g. to place root B directly right of root A: ' +
      '{ "id": "A", "articleId": "...", "contextData": { "dockedRoots": [{ "ownDockingVector": "RightBottom", ' +
      '"dockedRoots": [{ "id": "B", "dockingVector": "LeftBottom", "mode": "StartStart", ' +
      '"offset": [0, 0, 0] }] }] } }',
  ];
};

const SIDE_VECTORS = ['LeftBottom', 'RightBottom'];

const MIRRORED_MODE: Record<string, string> = {
  StartEnd: 'EndStart',
  EndStart: 'StartEnd',
};

// Where a docking entry puts the partner on a root's vector: the mode and the
// offset as seen from that root. An entry written on the partner names the
// two vectors the other way round, so its mode and offset are mirrored.
const dockingPlace = (dockedRoot: any, mirrored: boolean): string => {
  const mode =
    typeof dockedRoot.mode === 'string' ? dockedRoot.mode : 'StartStart';
  const offset = [0, 1, 2].map(
    (axis) =>
      Math.round(Number(dockedRoot.offset?.[axis] ?? 0) || 0) *
      (mirrored ? -1 : 1)
  );
  return JSON.stringify([
    mirrored ? (MIRRORED_MODE[mode] ?? mode) : mode,
    ...offset,
  ]);
};

// Per root and side vector the partners with the place the entry gives them -
// read in both directions, as the planner mirrors every entry. A mirrored
// entry names the same partner again, and a root outside the group takes no
// place.
type SidePartners = Map<string, Map<string, Map<string, string>>>;

const sidePartnersOf = (roots: any[]): SidePartners => {
  const rootIds = new Set(roots.map((root) => root?.id));
  const partnersOf: SidePartners = new Map();
  const meet = (
    rootId: string,
    vector: string,
    partnerId: string,
    place: string
  ) => {
    if (!SIDE_VECTORS.includes(vector)) {
      return;
    }
    const vectors =
      partnersOf.get(rootId) ?? new Map<string, Map<string, string>>();
    const partners = vectors.get(vector) ?? new Map<string, string>();
    if (!partners.has(partnerId)) {
      partners.set(partnerId, place);
    }
    vectors.set(vector, partners);
    partnersOf.set(rootId, vectors);
  };
  for (const root of roots) {
    for (const dockedContext of root?.contextData?.dockedRoots ?? []) {
      for (const dockedRoot of dockedContext?.dockedRoots ?? []) {
        if (!rootIds.has(dockedRoot?.id) || dockedRoot.id === root.id) {
          continue;
        }
        // a unit on top of another is no neighbour beside it
        if (
          !SIDE_VECTORS.includes(dockedContext.ownDockingVector) ||
          !SIDE_VECTORS.includes(dockedRoot.dockingVector)
        ) {
          continue;
        }
        meet(
          root.id,
          dockedContext.ownDockingVector,
          dockedRoot.id,
          dockingPlace(dockedRoot, false)
        );
        meet(
          dockedRoot.id,
          dockedRoot.dockingVector,
          root.id,
          dockingPlace(dockedRoot, true)
        );
      }
    }
  }
  return partnersOf;
};

const sideVectorFree = (
  partners: SidePartners,
  rootId: string,
  vector: string
): boolean => (partners.get(rootId)?.get(vector)?.size ?? 0) === 0;

interface SideVectorConflict {
  rootId: string;
  vector: string;
  sharing: string[];
}

// The planner arranges every root docked to a side vector against that edge,
// so two of them with the same mode and offset take the same place; a
// different mode or offset can separate them along the edge or beside it.
const sideVectorConflicts = (partners: SidePartners): SideVectorConflict[] => {
  const conflicts: SideVectorConflict[] = [];
  for (const [rootId, vectors] of partners) {
    for (const [vector, vectorPartners] of vectors) {
      const atPlace = new Map<string, string[]>();
      for (const [partnerId, place] of vectorPartners) {
        atPlace.set(place, [...(atPlace.get(place) ?? []), partnerId]);
      }
      for (const sharing of atPlace.values()) {
        if (sharing.length > 1) {
          conflicts.push({ rootId, vector, sharing });
        }
      }
    }
  }
  return conflicts;
};

interface RowWalk {
  end?: string;
  corner?: string;
}

// From a root along one side vector, root by root, to the root of that row
// whose same side vector is free. A corner article ends the row: the walk
// stops in front of it and names it. A ring has no end.
const rowWalk = (
  partners: SidePartners,
  rootId: string,
  vector: string,
  isCorner: (rootId: string) => boolean = () => false
): RowWalk => {
  const visited = new Set([rootId]);
  let current = rootId;
  for (;;) {
    const [next] = partners.get(current)?.get(vector)?.keys() ?? [];
    if (next === undefined) {
      return { end: current };
    }
    if (visited.has(next)) {
      return {};
    }
    if (isCorner(next)) {
      return { corner: next };
    }
    visited.add(next);
    current = next;
  }
};

const cornerPredicate =
  (roots: any[], articles: any[]) =>
  (rootId: string): boolean => {
    const root = roots.find((candidate) => candidate.id === rootId);
    return root !== undefined && isCornerArticle(articles, root);
  };

const SIDE_PARTNER: Record<string, string> = {
  LeftBottom: 'RightBottom',
  RightBottom: 'LeftBottom',
};

const addDocking = (
  root: any,
  ownDockingVector: string,
  partnerId: string,
  dockingVector: string
): void => {
  root.contextData ??= { dockedRoots: [] };
  root.contextData.dockedRoots ??= [];
  let dockedContext = root.contextData.dockedRoots.find(
    (candidate: any) => candidate.ownDockingVector === ownDockingVector
  );
  if (!dockedContext) {
    dockedContext = { ownDockingVector, dockedRoots: [] };
    root.contextData.dockedRoots.push(dockedContext);
  }
  dockedContext.dockedRoots.push({
    id: partnerId,
    dockingVector,
    mode: 'StartStart',
    offset: [0, 0, 0],
  });
};

// Removes the entries that put the partner on the root's side vector, written
// on either of the two.
const removeDocking = (
  roots: any[],
  rootId: string,
  vector: string,
  partnerId: string
): void => {
  for (const root of roots) {
    if (root.id !== rootId && root.id !== partnerId) {
      continue;
    }
    for (const dockedContext of root.contextData?.dockedRoots ?? []) {
      dockedContext.dockedRoots = (dockedContext.dockedRoots ?? []).filter(
        (dockedRoot: any) =>
          !(
            (root.id === rootId &&
              dockedContext.ownDockingVector === vector &&
              dockedRoot.id === partnerId) ||
            (root.id === partnerId &&
              dockedRoot.id === rootId &&
              dockedRoot.dockingVector === vector)
          )
      );
    }
    if (root.contextData?.dockedRoots) {
      root.contextData.dockedRoots = root.contextData.dockedRoots.filter(
        (dockedContext: any) => dockedContext.dockedRoots.length > 0
      );
    }
  }
};

// The docking vector names of an article; undefined when the catalog does not
// tell them. The catalog takes them from the template or from a calculated
// root of the article in the plan, so an article not in the plan has none.
const articleDockingVectors = (article: any): string[] | undefined => {
  const names = ((article?.rootModules ?? []) as any[]).flatMap(
    (rootModule) => rootModule?.dockingVectors ?? []
  );
  return names.length > 0 ? names : undefined;
};

const quotedIds = (ids: string[]): string =>
  ids.map((id) => `'${id}'`).join(', ');

// Two roots on one side vector at the same place: the later one goes to the
// free end of that row - or, when the row ends at a corner article, to the
// free end of the leg in the other direction.
const separateSideVectorPartners = (
  roots: any[],
  articles: any[],
  prefix: string,
  corrections: string[]
): string[] => {
  const isCorner = cornerPredicate(roots, articles);
  for (let round = 0; round <= roots.length * 2; round++) {
    const [conflict] = sideVectorConflicts(sidePartnersOf(roots));
    if (!conflict) {
      return [];
    }
    const { rootId, vector, sharing } = conflict;
    const [kept, moved] = sharing;
    removeDocking(roots, rootId, vector, moved);
    const partners = sidePartnersOf(roots);
    const walk = rowWalk(partners, rootId, vector, isCorner);
    if (walk.end === moved) {
      corrections.push(
        `${prefix}: roots ${quotedIds([kept, moved])} were docked to the ${vector} of root '${rootId}' at the ` +
          `same place - '${moved}' already follows in that row, so its second docking was dropped`
      );
      continue;
    }
    const along =
      walk.corner !== undefined && walk.end === undefined
        ? SIDE_PARTNER[vector]
        : vector;
    const end =
      along === vector
        ? walk.end
        : rowWalk(partners, rootId, along, isCorner).end;
    const endRoot = roots.find((root) => root.id === end);
    if (!endRoot) {
      break;
    }
    addDocking(endRoot, along, moved, SIDE_PARTNER[along]);
    corrections.push(
      `${prefix}: roots ${quotedIds([kept, moved])} were docked to the ${vector} of root '${rootId}' at the ` +
        `same place - '${moved}' was docked to the ${along} of '${end}', the free end of ` +
        (along === vector
          ? 'that row'
          : `its leg (the ${vector} row ends at the corner article '${walk.corner}')`)
    );
  }
  return [
    `${prefix}: roots on one side vector of a root stand in the same place, and the server could not move ` +
      'them apart - a side vector (LeftBottom, RightBottom) takes one neighbour: continue a row from the free ' +
      'side vector of its last unit',
  ];
};

// A part the docking does not connect to the first root is docked to the free
// end of a row of the same kind - floor units or wall units.
const connectUnreachedRoots = (
  roots: any[],
  articles: any[],
  prefix: string,
  corrections: string[]
): string[] => {
  const isWallUnit = (root: any) =>
    WALL_UNIT.test(String(catalogArticleOf(articles, root)?.category ?? ''));
  const hasVector = (root: any, vector: string) => {
    const article = catalogArticleOf(articles, root);
    const vectors = articleDockingVectors(article);
    return !vectors || vectors.includes(vector);
  };
  for (let round = 0; round < roots.length; round++) {
    const reached = reachedFrom(roots, [roots[0].id]);
    const unreached = roots.filter((root) => !reached.has(root.id));
    if (unreached.length === 0) {
      return [];
    }
    const part = reachedFrom(unreached, [unreached[0].id]);
    const partRoots = unreached.filter((root) => part.has(root.id));
    const kind = isWallUnit(partRoots[0]);
    const partners = sidePartnersOf(roots);
    const connection = [
      ['RightBottom', 'LeftBottom'],
      ['LeftBottom', 'RightBottom'],
    ]
      .map(([targetVector, leadVector]) => ({
        targetVector,
        leadVector,
        target: roots.find(
          (root) =>
            reached.has(root.id) &&
            isWallUnit(root) === kind &&
            sideVectorFree(partners, root.id, targetVector) &&
            hasVector(root, targetVector)
        ),
        lead: partRoots.find(
          (root) =>
            sideVectorFree(partners, root.id, leadVector) &&
            hasVector(root, leadVector)
        ),
      }))
      .find(({ target, lead }) => target && lead);
    if (!connection) {
      return dockingErrors(roots).map((error) => `${prefix}${error}`);
    }
    const { target, targetVector, lead, leadVector } = connection;
    addDocking(target, targetVector, lead.id, leadVector);
    corrections.push(
      `${prefix}: roots ${quotedIds(partRoots.map((root) => root.id))} were not docked to the placed roots - ` +
        `'${lead.id}' was docked to the ${targetVector} of '${target.id}', the free end of that row ` +
        '(mode StartStart, offset [0, 0, 0])'
    );
  }
  return dockingErrors(roots).map((error) => `${prefix}${error}`);
};

const reportUnsentRoots = (
  group: any,
  prefix: string,
  corrections: string[]
): void => {
  const rootIds = new Set((group.roots as any[]).map((root) => root.id));
  const unsent = new Set<string>();
  for (const root of group.roots as any[]) {
    for (const context of root.contextData?.dockedRoots ?? []) {
      context.dockedRoots = (context.dockedRoots ?? []).filter((entry: any) => {
        if (rootIds.has(entry?.id)) {
          return true;
        }
        unsent.add(String(entry?.id));
        return false;
      });
    }
    if (root.contextData?.dockedRoots) {
      root.contextData.dockedRoots = root.contextData.dockedRoots.filter(
        (context: any) => context.dockedRoots.length > 0
      );
    }
  }
  if (unsent.size > 0) {
    corrections.push(
      `${prefix}: roots ${quotedIds([...unsent])} are named in the docking but were never sent - nothing ` +
        'was built for them; send each as a root { id, articleId } of the group'
    );
  }
};

// The docking of a group as far as the server can complete it.
const completeDocking = (
  group: any,
  articles: any[],
  prefix: string,
  corrections: string[]
): string[] => {
  const errors = separateSideVectorPartners(
    group.roots,
    articles,
    prefix,
    corrections
  );
  return errors.length > 0
    ? errors
    : connectUnreachedRoots(group.roots, articles, prefix, corrections);
};

interface KitchenWideAttribute {
  id: string;
  value: unknown;
}

interface CallGroup {
  group: any;
  index: number;
  // attributes the server sets on the whole group after the load
  kitchenWide: KitchenWideAttribute[];
}

// The input attributes of the generated roots (the worktop's colour) a group
// from get-plan-context carries: C1 drops the roots, the attributes are set
// again after the load.
const generatedRootAttributes = (group: any): KitchenWideAttribute[] =>
  Array.isArray(group?.roots)
    ? group.roots
        .filter(isGeneratedRoot)
        .flatMap(
          (root: any) => normalizedAttributes(root?.attributes, '', []) ?? []
        )
    : [];

// The master data of the loaded libraries, read once and remembered for the
// server's lifetime, like the anchor frames.
let knownMasterData: Record<string, any> | undefined;

export const forgetMasterData = (): void => {
  knownMasterData = undefined;
};

const masterDataOf = async (
  roomDesignerApi: PlannerApi
): Promise<Record<string, any>> => {
  knownMasterData ??= ((
    await roomDesignerApi.extended.getExternalObjectPlanContext(['masterData'])
  )?.masterData ?? {}) as Record<string, any>;
  return knownMasterData;
};

const moduleIdsOf = (article: any): string[] =>
  ((article?.rootModules ?? []) as any[])
    .map((rootModule) => rootModule?.module?.id)
    .filter((id) => typeof id === 'string');

// An override of an attribute the unit's own module does not carry but a
// generated root module does - the worktop colour on a base unit - is meant
// for the kitchen: it leaves the root and is set on the group after the load.
// The generated modules are the master data's root modules no catalog article
// has.
const moveGeneratedRootOverrides = async (
  roomDesignerApi: PlannerApi,
  callGroups: CallGroup[],
  articles: any[],
  corrections: string[]
): Promise<void> => {
  const withOverrides = callGroups.flatMap((callGroup) =>
    (callGroup.group.roots as any[])
      .filter((root) => root.attributes?.length)
      .map((root) => ({ callGroup, root }))
  );
  if (withOverrides.length === 0) {
    return;
  }
  const masterData = await masterDataOf(roomDesignerApi);
  const articleModuleIds = new Set(articles.flatMap(moduleIdsOf));
  for (const { callGroup, root } of withOverrides) {
    const article = catalogArticleOf(articles, root);
    const libraryId =
      root.libraryId ?? callGroup.group.libraryId ?? article?.libraryId;
    const modules = (masterData[libraryId]?.modules ?? []) as any[];
    const ownModules = modules.filter((module) =>
      moduleIdsOf(article).includes(module?.id)
    );
    if (ownModules.length === 0) {
      continue;
    }
    const ownAttributeIds = new Set(
      ownModules.flatMap((module) => module.attributes ?? [])
    );
    const generatedAttributeIds = new Set(
      modules
        .filter((module) => !articleModuleIds.has(module?.id))
        .flatMap((module) => module.attributes ?? [])
    );
    const moved = (root.attributes as KitchenWideAttribute[]).filter(
      (attribute) =>
        !ownAttributeIds.has(attribute.id) &&
        generatedAttributeIds.has(attribute.id)
    );
    if (moved.length === 0) {
      continue;
    }
    root.attributes = root.attributes.filter(
      (attribute: KitchenWideAttribute) => !moved.includes(attribute)
    );
    if (root.attributes.length === 0) {
      delete root.attributes;
    }
    callGroup.kitchenWide.push(...moved);
    corrections.push(
      `posGroups[${callGroup.index}] root '${root.id}': a '${root.articleId}' has no attribute ` +
        `${quotedIds(moved.map((attribute) => attribute.id))} - the generated roots of the group carry it, so it is set on the whole group`
    );
  }
};

// The group of the plan each group of the call became: a replaced group by its
// id, a new group by its order among the groups the load added.
const matchResultGroups = (
  callGroups: CallGroup[],
  beforeGroupIds: Set<string>,
  groups: any[]
): [CallGroup, any][] => {
  const newGroups = groups.filter((group) => !beforeGroupIds.has(group.id));
  let nextNew = 0;
  return callGroups.flatMap((callGroup) => {
    const result = beforeGroupIds.has(callGroup.group.id)
      ? groups.find((candidate) => candidate.id === callGroup.group.id)
      : newGroups[nextNew++];
    return result ? [[callGroup, result]] : [];
  });
};

// The planner regenerates the id of a new group. The id the agent gave it is
// remembered, so that a later call with that id replaces the group instead of
// building a second one.
const agentGroupIds = new Map<string, string>();

export const forgetAgentGroupIds = (): void => agentGroupIds.clear();

const resolveAgentGroupIds = (
  callGroups: CallGroup[],
  beforeGroupIds: Set<string>,
  corrections: string[]
): void => {
  for (const { group, index } of callGroups) {
    if (typeof group.id !== 'string' || beforeGroupIds.has(group.id)) {
      continue;
    }
    const remembered = agentGroupIds.get(group.id);
    if (remembered === undefined) {
      continue;
    }
    if (!beforeGroupIds.has(remembered)) {
      agentGroupIds.delete(group.id);
      continue;
    }
    corrections.push(
      `posGroups[${index}]: group id '${group.id}' names the group '${remembered}' created earlier - it was replaced`
    );
    group.id = remembered;
  }
};

const rememberAgentGroupIds = (
  callGroups: CallGroup[],
  beforeGroupIds: Set<string>,
  groups: any[]
): void => {
  for (const [{ group }, result] of matchResultGroups(
    callGroups,
    beforeGroupIds,
    groups
  )) {
    if (typeof group.id === 'string' && group.id !== result.id) {
      agentGroupIds.set(group.id, result.id);
    }
  }
};

// What a root module can stand on: an object, the strip in front of a door or
// a window, or a root module of another group. The key tells the same blocker
// before and after a replace.
interface Blocker extends PlacedVolume {
  key: string;
  text: string;
  groupId?: string;
}

const wholeMm = (value: number): number => Math.round(value) + 0;

const rootLabel = (root: RootVolume): string =>
  `'${root.id}'${root.articleId ? ` (${root.articleId})` : ''}`;

// The objects of the obstacles section: furniture by its outline, a door or a
// window by the strip in front of it on its wall (D55).
const objectBlockers = (obstacles: any, rooms: any): Blocker[] =>
  ((agentFacingObstacles(obstacles, rooms)?.objects ?? []) as any[]).flatMap(
    (object): Blocker[] => {
      const outline = ((object?.outline ?? []) as number[][]).map(
        ([x, , z]): [number, number] => [x, z]
      );
      const heights: [number, number] = [
        Number(object.bottomMm),
        Number(object.topMm),
      ];
      const key = `${object.kind}:${JSON.stringify(
        outline.map(([x, z]) => [wholeMm(x), wholeMm(z)])
      )}`;
      if (object.kind === 'door' || object.kind === 'window') {
        const wall = (
          (rooms?.rooms?.[object.roomIndex]?.walls ?? []) as DerivedWall[]
        ).find((candidate) => candidate.index === object.wall);
        if (!wall || !Array.isArray(object.fromEndMm)) {
          return [];
        }
        const [from, to] = object.fromEndMm as [number, number];
        return [
          {
            key,
            corners: stripInFrontOfWall(wall, [from, to], WALL_STRIP_MM),
            heights,
            text: `stands in front of the ${object.kind} in the ${wallName(wall.side)} (wall ${wall.index}, fromEndMm ${wholeMm(from)} to ${wholeMm(to)}, ${wholeMm(heights[0])} to ${wholeMm(heights[1])} mm)`,
          },
        ];
      }
      const xs = outline.map(([x]) => x);
      const zs = outline.map(([, z]) => z);
      return [
        {
          key,
          corners: convexHull(outline),
          heights,
          text: `overlaps an object (x ${wholeMm(Math.min(...xs))} to ${wholeMm(Math.max(...xs))}, z ${wholeMm(Math.min(...zs))} to ${wholeMm(Math.max(...zs))}, ${wholeMm(heights[0])} to ${wholeMm(heights[1])} mm)`,
        },
      ];
    }
  );

interface GroupRootVolumes {
  id: string;
  roots: RootVolume[];
}

const rootVolumesOfGroups = (groups: any[]): GroupRootVolumes[] =>
  groups.map((group) => ({ id: group.id, roots: rootVolumesInRoom(group) }));

const rootBlockersBeside = (
  groups: GroupRootVolumes[],
  groupId: string
): Blocker[] =>
  groups
    .filter((group) => group.id !== groupId)
    .flatMap((group) =>
      group.roots.map((root) => ({
        corners: root.corners,
        ...(root.heights && { heights: root.heights }),
        key: `root:${root.id}`,
        text: `overlaps root module ${rootLabel(root)} of group '${group.id}'`,
        groupId: group.id,
      }))
    );

const freeStretchesNote = (
  walls: DerivedWall[],
  root: RootVolume,
  blockers: Blocker[]
): string => {
  const wall = wallOfRoot(walls, root, WALL_STRIP_MM);
  if (!wall) {
    return '';
  }
  const named = `the ${wallName(wall.side)} (wall ${wall.index})`;
  const stretches = freeStretchesAlongWall(
    wall,
    root,
    blockers,
    OVERLAP_TOLERANCE_MM
  );
  return stretches.length > 0
    ? ` - free stretches of ${named} at its height: fromEndMm ${stretches
        .map(([from, to]) => `${from} to ${to}`)
        .join(', ')}`
    : ` - no stretch of ${named} is free for it at its height`;
};

interface ObstacleHintInput {
  groupIds: string[];
  rawGroups: any[];
  obstacles: any;
  rooms: any;
  withGroups: boolean;
  before?: any[];
  closing: string;
}

// What the root modules of the named groups stand on, with the free stretches
// of their wall; the group is built anyway (D55, D51). A replaced group is told
// only what it did not stand on before. Without the obstacles section of the
// plan context nothing is told.
const obstacleHint = ({
  groupIds,
  rawGroups,
  obstacles,
  rooms,
  withGroups,
  before = [],
  closing,
}: ObstacleHintInput): string | undefined => {
  if (!Array.isArray(obstacles?.objects)) {
    return undefined;
  }
  const objects = objectBlockers(obstacles, rooms);
  const walls = ((rooms?.rooms ?? []) as any[]).flatMap(
    (room) => (room?.walls ?? []) as DerivedWall[]
  );
  const findings = (
    groups: GroupRootVolumes[],
    group: GroupRootVolumes,
    root: RootVolume
  ): Blocker[] =>
    [
      ...objects,
      ...(withGroups ? rootBlockersBeside(groups, group.id) : []),
    ].filter((blocker) => volumesOverlap(root, blocker, OVERLAP_TOLERANCE_MM));
  const tested = (groups: GroupRootVolumes[]) =>
    groups.filter((group) => groupIds.includes(group.id));
  const volumesBefore = rootVolumesOfGroups(before);
  const keysBefore = new Map<string, Set<string>>(
    tested(volumesBefore).flatMap((group) =>
      group.roots.map((root): [string, Set<string>] => [
        root.id,
        new Set(
          findings(volumesBefore, group, root).map((blocker) => blocker.key)
        ),
      ])
    )
  );
  const volumesAfter = rootVolumesOfGroups(rawGroups);
  const sentences: string[] = [];
  let namesAGroup = false;
  for (const group of tested(volumesAfter)) {
    const others = rootBlockersBeside(volumesAfter, group.id);
    for (const root of group.roots) {
      const known = keysBefore.get(root.id);
      const found = findings(volumesAfter, group, root).filter(
        (blocker) => !known?.has(blocker.key)
      );
      if (found.length === 0) {
        continue;
      }
      namesAGroup ||= found.some((blocker) => blocker.groupId !== undefined);
      const what = found.map((blocker) => blocker.text).join(' and ');
      const stretches = freeStretchesNote(walls, root, [...objects, ...others]);
      sentences.push(
        `Root module ${rootLabel(root)} of group '${group.id}' ${what}${stretches}.`
      );
    }
  }
  if (sentences.length === 0) {
    return undefined;
  }
  return [
    ...sentences,
    closing,
    ...(namesAGroup
      ? [
          'If the units belong together, send them as one group or join them with merge-groups.',
        ]
      : []),
  ].join(' ');
};

// The group attributes that are not the library's group settings, the
// overrides moved off the roots and the colours of the dropped generated roots
// are set on every unit of the group with the planner's change-group-attribute
// command. True when a command ran.
const applyKitchenWideAttributes = async (
  roomDesignerApi: PlannerApi,
  callGroups: CallGroup[],
  beforeGroupIds: Set<string>,
  groups: any[],
  corrections: string[]
): Promise<boolean> => {
  let applied = false;
  for (const [{ group, index, kitchenWide }, result] of matchResultGroups(
    callGroups,
    beforeGroupIds,
    groups
  )) {
    const settingIds = new Set(
      ((result.attributes ?? []) as any[]).map((attribute) => attribute?.id)
    );
    const toApply = new Map<string, unknown>();
    for (const attribute of [
      ...((group.attributes ?? []) as KitchenWideAttribute[]).filter(
        (attribute) => !settingIds.has(attribute.id)
      ),
      ...kitchenWide,
    ]) {
      toApply.set(attribute.id, attribute.value);
    }
    for (const [attributeId, value] of toApply) {
      applied = true;
      try {
        await roomDesignerApi.extended.externalObjectGroupOperation(
          'change-group-attribute',
          { groupId: result.id, attributeId, value: attributeValue(value) }
        );
        corrections.push(
          `posGroups[${index}]: ${attributeId} ${JSON.stringify(value)} was set on every unit of group '${result.id}'`
        );
      } catch (error) {
        corrections.push(
          `posGroups[${index}]: ${attributeId} could not be set on group '${result.id}' - ` +
            (error instanceof Error ? error.message : String(error))
        );
      }
    }
  }
  return applied;
};

const articlePicksOf = (roots: any[]): string =>
  roots
    .filter((root) => !isGeneratedRoot(root))
    .map((root) => String(root?.articleId))
    .sort()
    .join(',');

// The planner's load result does not say whether a replace took: when the
// library cannot calculate the new layout, the planner restores the previous
// group and answers as for a success. A replaced group that still holds its
// previous articles instead of the ones sent is reported.
const reportRevertedReplaces = (
  callGroups: CallGroup[],
  before: any[],
  after: any[],
  corrections: string[]
): void => {
  for (const { group, index } of callGroups) {
    const previous = before.find((candidate) => candidate.id === group.id);
    const result = after.find((candidate) => candidate.id === group.id);
    if (!previous || !result) {
      continue;
    }
    const sent = articlePicksOf(group.roots ?? []);
    const got = articlePicksOf(result.roots ?? []);
    if (got !== sent && got === articlePicksOf(previous.roots ?? [])) {
      corrections.push(
        `posGroups[${index}]: the planner could not calculate the new layout of group '${group.id}' and kept ` +
          'its previous content - the page console names the module that failed; send the layout again with another article'
      );
    }
  }
};

// A group the server could not build, or - with rootIds - a group it built
// without those roots.
interface NotLoadedGroup {
  index: number;
  id?: string;
  rootIds?: string[];
  errors: string[];
}

// A group with errors is reported instead of cancelling the other groups of
// the call; the groups without errors go on.
const keepBuildable = (
  callGroups: CallGroup[],
  notLoaded: NotLoadedGroup[],
  errorsOf: (callGroup: CallGroup) => string[]
): CallGroup[] =>
  callGroups.filter((callGroup) => {
    let errors: string[];
    try {
      errors = errorsOf(callGroup);
    } catch (error) {
      errors = [
        `posGroups[${callGroup.index}]: could not be read - ${error instanceof Error ? error.message : String(error)}`,
      ];
    }
    if (errors.length > 0) {
      const id = callGroup.group?.id;
      notLoaded.push({
        index: callGroup.index,
        ...(typeof id === 'string' && { id }),
        errors,
      });
    }
    return errors.length === 0;
  });

const nothingLoaded = (notLoaded: NotLoadedGroup[]): Error =>
  new Error(
    'Invalid pos groups - nothing was loaded:\n' +
      notLoaded.flatMap((entry) => entry.errors).join('\n') +
      '\nFetch the payload format with the get-authoring-rules tool.'
  );

const nextFreeId = (taken: Set<string>, base: string, first = 2): string => {
  let suffix = first;
  while (taken.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
};

const dockedRootIds = (roots: any[]): Set<string> =>
  new Set(
    roots.flatMap((root) =>
      (root?.contextData?.dockedRoots ?? []).flatMap((dockedContext: any) =>
        (dockedContext?.dockedRoots ?? []).map(
          (dockedRoot: any) => dockedRoot?.id
        )
      )
    )
  );

// The fields a pos group and its roots are built from. A group from
// get-plan-context also carries read-only fields; everything else would be
// lost, so it is reported.
const GROUP_FIELDS = [
  'id',
  'libraryId',
  'roots',
  'placement',
  'repositioningData',
  'attributes',
  'pos',
  'rotationY',
];

const READ_ONLY_GROUP_FIELDS = ['position', 'logMessages'];

const ROOT_FIELDS = [
  'id',
  'articleId',
  'libraryId',
  'attributes',
  'contextData',
  'articlePos',
  'rotationY',
  ...RELATION_FIELDS,
];

const READ_ONLY_ROOT_FIELDS = [
  'articleName',
  'desc',
  'category',
  'imageUrl',
  'isGenerated',
  'dockingVectors',
  'freeDockingVectors',
  'subModules',
  'logMessages',
];

const DOCKING_ENTRY_FIELDS = [
  'id',
  'dockingVector',
  'mode',
  'offset',
  'dockingVectorIndex',
];

const dockingEntriesOf = (root: any): { context: any; entry: any }[] =>
  (root?.contextData?.dockedRoots ?? []).flatMap((context: any) =>
    (context?.dockedRoots ?? []).map((entry: any) => ({ context, entry }))
  );

const isObject = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// The docking as lists of contexts and entries. A part in another shape
// cannot be read and is dropped; its root is docked like any undocked root.
const dropMalformedDocking = (
  roots: any[],
  prefix: string,
  corrections: string[]
): void => {
  const dropped: string[] = [];
  for (const root of roots) {
    if (root?.contextData === undefined) {
      continue;
    }
    if (
      !isObject(root.contextData) ||
      !Array.isArray(root.contextData.dockedRoots ?? [])
    ) {
      dropped.push(`the contextData of root '${root?.id}'`);
      delete root.contextData;
      continue;
    }
    const contexts = (root.contextData.dockedRoots ?? []) as any[];
    root.contextData.dockedRoots = contexts.filter((context, index) => {
      const readable =
        isObject(context) && Array.isArray(context.dockedRoots ?? []);
      if (!readable) {
        dropped.push(`docking context ${index} of root '${root.id}'`);
        return false;
      }
      context.dockedRoots = ((context.dockedRoots ?? []) as any[]).filter(
        (entry, entryIndex) => {
          if (!isObject(entry)) {
            dropped.push(
              `docking entry ${entryIndex} of context ${index} of root '${root.id}'`
            );
            return false;
          }
          return true;
        }
      );
      return true;
    });
  }
  if (dropped.length > 0) {
    corrections.push(
      `${prefix}: ${dropped.join(', ')} could not be read and were dropped - contextData is ` +
        '{ dockedRoots: [{ ownDockingVector, dockedRoots: [{ id, dockingVector, mode?, offset? }] }] }'
    );
  }
};

// A unit written inside a docking entry - with its articleId - is a root of
// the group; the entry keeps the docking link to it.
const liftNestedRoots = (
  group: any,
  prefix: string,
  corrections: string[]
): void => {
  const ids = new Set<string>(group.roots.map((root: any) => root?.id));
  const lifted: string[] = [];
  const pending = [...group.roots];
  while (pending.length > 0) {
    const root = pending.shift();
    for (const context of root?.contextData?.dockedRoots ?? []) {
      if (!Array.isArray(context?.dockedRoots)) {
        continue;
      }
      context.dockedRoots = context.dockedRoots.map((entry: any) => {
        if (typeof entry?.articleId !== 'string' || ids.has(entry.id)) {
          return entry;
        }
        const {
          dockingVector,
          mode,
          offset,
          dockingVectorIndex: _index,
          ...unit
        } = entry;
        if (typeof unit.id !== 'string' || unit.id.length === 0) {
          unit.id = nextFreeId(ids, 'root', 1);
        }
        ids.add(unit.id);
        group.roots.push(unit);
        pending.push(unit);
        lifted.push(unit.id);
        return {
          id: unit.id,
          ...(dockingVector !== undefined && { dockingVector }),
          ...(mode !== undefined && { mode }),
          ...(offset !== undefined && { offset }),
        };
      });
    }
  }
  if (lifted.length > 0) {
    corrections.push(
      `${prefix}: roots ${quotedIds(lifted)} were written inside the docking - they are roots of the ` +
        'group now, linked by their docking entries'
    );
  }
};

// Docking entries completed where the intent is clear: the id from rootId,
// and the vector of the new root from the vector of the root it docks to. An
// entry without the root's own vector cannot be placed and is dropped.
const completeDockingEntries = (
  roots: any[],
  prefix: string,
  corrections: string[]
): void => {
  const completed: string[] = [];
  const dropped: string[] = [];
  for (const root of roots) {
    const contexts = root?.contextData?.dockedRoots;
    if (!Array.isArray(contexts)) {
      continue;
    }
    root.contextData.dockedRoots = contexts.filter((context: any) => {
      const entries = (context?.dockedRoots ?? []) as any[];
      for (const entry of entries) {
        if (
          entry &&
          entry.id === undefined &&
          typeof entry.rootId === 'string'
        ) {
          entry.id = entry.rootId;
          delete entry.rootId;
        }
      }
      if (typeof context?.ownDockingVector !== 'string') {
        dropped.push(
          ...entries.map((entry) => `'${root.id}' -> '${entry?.id}'`)
        );
        return false;
      }
      const partner = PARTNER_VECTOR[context.ownDockingVector];
      for (const entry of entries) {
        if (entry && typeof entry.dockingVector !== 'string' && partner) {
          entry.dockingVector = partner;
          completed.push(
            `'${entry.id}' meets the ${context.ownDockingVector} of '${root.id}' with its ${partner}`
          );
        }
      }
      return true;
    });
  }
  if (completed.length > 0) {
    corrections.push(
      `${prefix}: docking entries without dockingVector were completed - ${completed.join(', ')}`
    );
  }
  if (dropped.length > 0) {
    corrections.push(
      `${prefix}: docking entries without ownDockingVector were dropped - ${dropped.join(', ')}`
    );
  }
};

// Attribute overrides as [{ id, value }]: an object of ids and values and an
// attributeId instead of id are read as such; an entry without an id is lost.
const normalizedAttributes = (
  attributes: unknown,
  label: string,
  corrections: string[]
): { id: string; value: unknown }[] | undefined => {
  if (attributes === undefined || attributes === null) {
    return undefined;
  }
  if (!Array.isArray(attributes)) {
    if (typeof attributes === 'object') {
      corrections.push(
        `${label}: attributes were given as an object - read as [{ id, value }]`
      );
      return Object.entries(attributes).map(([id, value]) => ({ id, value }));
    }
    corrections.push(`${label}: attributes must be [{ id, value }] - ignored`);
    return undefined;
  }
  const withoutId: number[] = [];
  const result = attributes.flatMap((attribute: any, index: number) => {
    const id =
      typeof attribute?.id === 'string' ? attribute.id : attribute?.attributeId;
    if (typeof id !== 'string' || id.length === 0) {
      withoutId.push(index);
      return [];
    }
    return [{ id, value: attribute.value }];
  });
  if (withoutId.length > 0) {
    corrections.push(
      `${label}: attribute entries ${withoutId.join(', ')} have no id - ignored`
    );
  }
  return result;
};

const unusedFields = (object: any, used: string[]): string[] =>
  object && typeof object === 'object' && !Array.isArray(object)
    ? Object.keys(object).filter((field) => !used.includes(field))
    : [];

// Fields the server does not use would vanish without a trace; they are
// reported.
const reportUnusedFields = (
  group: any,
  prefix: string,
  corrections: string[]
): void => {
  const notes: string[] = [];
  const groupFields = unusedFields(group, [
    ...GROUP_FIELDS,
    ...READ_ONLY_GROUP_FIELDS,
  ]);
  if (groupFields.length > 0) {
    notes.push(`the group's ${groupFields.join(', ')}`);
  }
  for (const root of group.roots as any[]) {
    const rootFields = unusedFields(root, [
      ...ROOT_FIELDS,
      ...READ_ONLY_ROOT_FIELDS,
    ]);
    if (rootFields.length > 0) {
      notes.push(`${rootFields.join(', ')} of root '${root.id}'`);
    }
    for (const { entry } of dockingEntriesOf(root)) {
      const entryFields = unusedFields(entry, DOCKING_ENTRY_FIELDS);
      if (entryFields.length > 0) {
        notes.push(
          `${entryFields.join(', ')} of the docking entry '${root.id}' -> '${entry.id}'`
        );
      }
    }
  }
  if (notes.length > 0) {
    corrections.push(
      `${prefix}: the server does not use ${notes.join('; ')} - ignored`
    );
  }
};

// dockTo is the docking field of merge-article-into-group; written on a root
// of create-or-replace-groups it describes the relation of that root.
const DOCK_TO_RELATION: Record<string, string> = {
  'RightBottom->LeftBottom': 'rightOf',
  'LeftBottom->RightBottom': 'leftOf',
  'BackBottom->BackBottom': 'behind',
};

const readDockToAsRelation = (
  roots: any[],
  prefix: string,
  corrections: string[]
): void => {
  for (const root of roots) {
    if (root?.dockTo === undefined) {
      continue;
    }
    const dockTo = isObject(root.dockTo) ? root.dockTo : {};
    const rootId = dockTo.rootId ?? dockTo.id;
    const own = String(dockTo.ownDockingVector ?? '');
    const theirs = String(dockTo.dockingVector ?? '');
    // the relation named inside dockTo, or the pair of vectors
    const relation = RELATIONS.includes(dockTo.relation)
      ? (dockTo.relation as string)
      : (DOCK_TO_RELATION[`${own}->${theirs}`] ??
        (own.endsWith('Top') && theirs.endsWith('Bottom')
          ? 'above'
          : undefined));
    delete root.dockTo;
    if (typeof rootId !== 'string' || relation === undefined) {
      corrections.push(
        `${prefix} root '${root.id}': dockTo could not be read as a relation - ignored; name the neighbour with rightOf, leftOf, onTop, above or behind`
      );
      continue;
    }
    if (RELATIONS.some((candidate) => root[candidate] !== undefined)) {
      corrections.push(
        `${prefix} root '${root.id}': dockTo was dropped - the root names its neighbour with a relation already`
      );
      continue;
    }
    root[relation] = rootId;
    corrections.push(
      `${prefix} root '${root.id}': dockTo was read as ${relation} '${rootId}'`
    );
  }
};

// One pos group before anything is fetched: corrected where the intent is
// clear, each correction reported. The errors name what cannot be built.
const prepareGroup = (
  group: any,
  prefix: string,
  corrections: string[]
): string[] => {
  if (!Array.isArray(group?.roots) || group.roots.length === 0) {
    return [`${prefix}: needs a non-empty roots array`];
  }
  // the library regenerates its generated roots (worktop, toe kick)
  group.roots = group.roots.filter((root: any) => !isGeneratedRoot(root));
  if (group.roots.length === 0) {
    return [
      `${prefix}: needs at least one article root (generated roots are dropped)`,
    ];
  }
  dropMalformedDocking(group.roots, prefix, corrections);
  liftNestedRoots(group, prefix, corrections);
  completeDockingEntries(group.roots, prefix, corrections);
  readDockToAsRelation(group.roots, prefix, corrections);
  reportUnusedFields(group, prefix, corrections);
  group.attributes = normalizedAttributes(
    group.attributes,
    `${prefix} group`,
    corrections
  );
  for (const root of group.roots as any[]) {
    root.attributes = normalizedAttributes(
      root?.attributes,
      `${prefix} root '${root?.id}'`,
      corrections
    );
  }
  if (group.pos !== undefined || group.rotationY !== undefined) {
    delete group.pos;
    delete group.rotationY;
    corrections.push(
      `${prefix}: pos/rotationY on a group were dropped - a new group is positioned with placement`
    );
  }
  if (group.repositioningData !== undefined) {
    const { posGroup, posRotationY, rootId } = group.repositioningData ?? {};
    if (group.placement === undefined) {
      group.placement = {
        posGroup,
        posRotationY,
        ...(rootId !== undefined && { rootId }),
      };
      corrections.push(
        `${prefix}: repositioningData was taken as the placement`
      );
    } else {
      corrections.push(
        `${prefix}: repositioningData was dropped - the placement is used`
      );
    }
    delete group.repositioningData;
  }
  const errors: string[] = [];
  const positionedRootIds: string[] = [];
  group.roots.forEach((root: any, rootIndex: number) => {
    if (typeof root?.articleId !== 'string' || root.articleId.length === 0) {
      errors.push(
        `${prefix}.roots[${rootIndex}]: articleId must be a non-empty string (an article id from the catalog)`
      );
      return;
    }
    if (root.articlePos !== undefined || root.rotationY !== undefined) {
      delete root.articlePos;
      delete root.rotationY;
      positionedRootIds.push(root.id ?? `roots[${rootIndex}]`);
    }
  });
  if (errors.length > 0) {
    return errors;
  }
  if (positionedRootIds.length > 0) {
    corrections.push(
      `${prefix}: articlePos/rotationY of roots ${positionedRootIds.map((id) => `'${id}'`).join(', ')} ` +
        'were dropped - root positions come from the docking'
    );
  }
  const taken = new Set<string>(
    group.roots
      .map((root: any) => root.id)
      .filter((id: unknown) => typeof id === 'string' && id.length > 0)
  );
  const referenced = dockedRootIds(group.roots);
  for (const root of group.roots as any[]) {
    for (const relation of RELATIONS) {
      if (typeof root[relation] === 'string') {
        referenced.add(root[relation]);
      }
    }
  }
  const rootIds = new Set<string>();
  group.roots.forEach((root: any, rootIndex: number) => {
    if (typeof root.id !== 'string' || root.id.length === 0) {
      root.id = nextFreeId(taken, 'root', 1);
      taken.add(root.id);
      corrections.push(
        `${prefix}.roots[${rootIndex}]: the root had no id - it is '${root.id}'`
      );
    } else if (rootIds.has(root.id)) {
      if (referenced.has(root.id)) {
        errors.push(
          `${prefix}.roots[${rootIndex}]: duplicate root id '${root.id}' named in the docking - ` +
            'every root id must be unique within its group'
        );
        return;
      }
      const renamed = nextFreeId(taken, root.id);
      corrections.push(
        `${prefix}.roots[${rootIndex}]: the duplicate root id '${root.id}' was renamed to '${renamed}'`
      );
      root.id = renamed;
      taken.add(renamed);
    }
    rootIds.add(root.id);
  });
  if (errors.length === 0 && group.placement !== undefined) {
    normalizePlacement(group, rootIds, prefix, corrections);
  }
  return errors;
};

const PARTNER_VECTOR: Record<string, string> = {
  LeftBottom: 'RightBottom',
  RightBottom: 'LeftBottom',
  LeftTop: 'LeftBottom',
  RightTop: 'RightBottom',
  BackBottom: 'BackBottom',
  BackTop: 'BackBottom',
};

const OVERLAP_TOLERANCE_MM = 5;

// The strip along a wall: a root module in it in front of a door or a window
// stands in front of that opening, and one whose back lies in it stands at
// the wall it faces away from (D55).
const WALL_STRIP_MM = 600;

const volumeOf = (
  footprint: GroupFootprint,
  heights: [number, number] | undefined,
  placement: { pos?: number[]; rotationY?: number }
): PlacedVolume => {
  const y = placement.pos?.[1] ?? 0;
  return {
    corners: footprintCornersInRoom(footprint, placement),
    ...(heights && { heights: [heights[0] + y, heights[1] + y] }),
  };
};

interface PlacedGroupVolume {
  id: string;
  volume: PlacedVolume;
}

const placedGroupVolumes = (
  groups: any[],
  excludedGroupId: string
): PlacedGroupVolume[] =>
  groups.flatMap((group) => {
    const footprint =
      group.id === excludedGroupId ? undefined : groupFootprint(group);
    return footprint
      ? [
          {
            id: group.id,
            volume: volumeOf(footprint, groupHeightRange(group), group),
          },
        ]
      : [];
  });

const overlappedGroupIds = (
  volume: PlacedVolume,
  others: PlacedGroupVolume[]
): string[] =>
  others
    .filter((other) =>
      volumesOverlap(volume, other.volume, OVERLAP_TOLERANCE_MM)
    )
    .map((other) => other.id);

const WALL_SIDES = ['left', 'right', 'top', 'bottom'];

interface WallPlacementSpec {
  wall: string | number;
  alignment?: WallAlignment;
  offsetMm?: number;
  roomIndex?: number;
}

interface ResolvedWall {
  wall: DerivedWall;
  walls: DerivedWall[];
}

interface GroupPlacement {
  pos: [number, number, number];
  rotationY: number;
  footprint: GroupFootprint;
  heights?: [number, number];
  placedIn: 'corner' | 'wall';
}

// back and front name the top and the bottom wall of the top-view image
const SIDE_SYNONYMS: Record<string, WallSide> = {
  back: 'top',
  front: 'bottom',
};

const sideLabel = <T>(value: T): T | WallSide =>
  typeof value === 'string' && value in SIDE_SYNONYMS
    ? SIDE_SYNONYMS[value]
    : value;

const isWallSide = (
  alignment: WallAlignment | undefined
): alignment is WallSide =>
  alignment !== undefined && WALL_SIDES.includes(alignment);

const resolveWall = (rooms: any[], spec: WallPlacementSpec): ResolvedWall => {
  const roomIndex = spec.roomIndex ?? 0;
  const room = rooms[roomIndex];
  if (!room) {
    throw new Error(
      `Room index ${roomIndex} not found - the plan has ${rooms.length} room(s).`
    );
  }
  // the plan context derives the walls of every room
  const walls = (room.walls ?? []) as DerivedWall[];
  let wall;
  if (typeof spec.wall === 'number') {
    wall = walls.find((candidate) => candidate.index === spec.wall);
  } else if (typeof spec.wall === 'string') {
    // side label: the longest real wall on that side of the room
    wall = walls
      .filter(
        (candidate) => candidate.side === spec.wall && candidate.type === 'wall'
      )
      .sort((a, b) => b.lengthMm - a.lengthMm)[0];
  }
  if (!wall) {
    throw new Error(
      `Wall '${spec.wall}' not found. Pass a side label (left/right/top/bottom) or a wall index. ` +
        'Available walls: ' +
        JSON.stringify(walls)
    );
  }
  return { wall, walls };
};

// A corner article is placed by its corner point when the alignment names the
// adjoining wall; every other group is placed by its footprint. The wall
// arithmetic works on the floor, so the group keeps its height (a group of
// wall units only stays at its mounting height).
const placeGroupAtWall = (
  group: any,
  { wall, walls }: ResolvedWall,
  spec: WallPlacementSpec
): GroupPlacement => {
  const footprint = groupFootprint(group);
  if (!footprint) {
    throw new Error(
      `Group '${group.id}' has no geometry to derive a footprint from.`
    );
  }
  const alignment = spec.alignment ?? 'center';
  const offsetMm = spec.offsetMm ?? 0;
  const height = group.pos?.[1] ?? 0;
  const heights = groupHeightRange(group);
  if (isWallSide(alignment)) {
    const corner = groupCornerGeometry(group);
    const adjoining = adjoiningWall(walls, wall, alignment);
    if (corner && adjoining) {
      const placement = placeCornerAtWalls(wall, adjoining, corner, offsetMm);
      if (placement) {
        const [x, , z] = placement.pos;
        return {
          pos: [x, height, z],
          rotationY: placement.rotationY,
          footprint,
          ...(heights && { heights }),
          placedIn: 'corner',
        };
      }
    }
  }
  const {
    pos: [x, , z],
    rotationY,
  } = placeAgainstWall(wall, footprint, alignment, offsetMm);
  return {
    pos: [x, height, z],
    rotationY,
    footprint,
    ...(heights && { heights }),
    placedIn: 'wall',
  };
};

// A calculated group already stands at a placement when its origin lies
// within the overlap tolerance of the placement's and it is turned the same
// way (the planner reports 270 as -90).
const standsAt = (rawGroup: any, placement: GroupPlacement): boolean => {
  const pos = rawGroup.pos as number[] | undefined;
  if (!Array.isArray(pos) || pos.length < 3) {
    return false;
  }
  const turn =
    ((((rawGroup.rotationY ?? 0) - placement.rotationY) % 360) + 360) % 360;
  return (
    Math.hypot(
      pos[0] - placement.pos[0],
      pos[1] - placement.pos[1],
      pos[2] - placement.pos[2]
    ) <= OVERLAP_TOLERANCE_MM && Math.min(turn, 360 - turn) < 0.01
  );
};

// The nearest position along the same wall where the group overlaps no other
// group: next to one of them, or where it was asked to stand.
const freePlacementAlongWall = (
  placement: GroupPlacement,
  wall: DerivedWall,
  spec: WallPlacementSpec,
  others: PlacedGroupVolume[]
): GroupPlacement | undefined => {
  const { footprint } = placement;
  const width = footprint.widthMm;
  const asked = wallSpanStart(
    wall,
    footprint,
    spec.alignment ?? 'center',
    spec.offsetMm ?? 0
  );
  const candidates = others
    .flatMap(({ volume }) => {
      const [from, to] = spanAlongWall(wall, volume.corners);
      return [to, from - width];
    })
    .filter(
      (spanStart) => spanStart > -0.5 && spanStart + width < wall.lengthMm + 0.5
    )
    .sort((a, b) => Math.abs(a - asked) - Math.abs(b - asked));
  for (const spanStart of candidates) {
    const {
      pos: [x, , z],
      rotationY,
    } = placeAgainstWall(wall, footprint, 'start', spanStart);
    const candidate: GroupPlacement = {
      ...placement,
      pos: [x, placement.pos[1], z],
      rotationY,
    };
    if (
      overlappedGroupIds(
        volumeOf(footprint, placement.heights, candidate),
        others
      ).length === 0
    ) {
      return candidate;
    }
  }
  return undefined;
};

// The page runs every planner call it receives at once, so the tool calls that
// change the plan run one after another: the anchor probe tells the groups it
// loaded by comparing the plan's groups before and after its load, and the
// groups a concurrent call loads or splits meanwhile would count as its own
// and be removed. get-plan-context waits as well: it reads the plan twice -
// the plan context and the calculated groups its positions come from - and a
// plan change between the two would mix two states of a group.
let planChanges: Promise<unknown> = Promise.resolve();

const oneAtATime =
  (executor: ToolExecutor): ToolExecutor =>
  (roomDesignerApi, args) => {
    const run = planChanges.then(() => executor(roomDesignerApi, args));
    planChanges = run.catch(() => undefined);
    return run;
  };

// The commands whose load the kernel answers with the group's position:
// roomle-ui reloads the group once more, and that follow-up joins the
// command's undo step as its second history event - usually before the
// command resolves, sometimes after it (roomle-ui respondWithPositionInPlan
// for the load reasons change_attribute and swap_module).
const FOLLOW_UP_COMMANDS = new Set([
  'change-module-attribute',
  'change-group-attribute',
  'exchange-root-module',
  'insert-article-into-group',
  'swap-root-modules',
]);
// A remove reloads the row only when it closed the gap; a unit at a row end
// is deleted by the kernel, as delete-root-module does, without a follow-up.
const hasFollowUp = (command: string, result: any): boolean =>
  FOLLOW_UP_COMMANDS.has(command) ||
  (command === 'remove-article-from-group' && result?.gapClosed === true);
const FOLLOW_UP_WAIT_MS = 2000;
const HISTORY_EVENT_WAIT_MS = 1000;

const roundedToTenthMm = (_key: string, value: unknown) =>
  typeof value === 'number' ? Math.round(value * 10) / 10 : value;

// The planner's raw groups as a comparison key, sorted by id - an undo
// restores them to the tenth of a millimetre.
const groupsKey = (groups: unknown): string =>
  JSON.stringify(
    [...((groups ?? []) as any[])].sort((a, b) =>
      String(a?.id).localeCompare(String(b?.id))
    ),
    roundedToTenthMm
  );

const readGroupsKey = async (roomDesignerApi: PlannerApi) =>
  groupsKey(await roomDesignerApi.extended.getExternalObjectGroups());

// The planner API of a tool call that changes the plan. It counts the steps
// the call puts on the planner's undo history - one per load that loaded
// something, per group command and per removal, minus one per undo (the
// anchor probe) - reads the plan before the first step, and waits for the
// follow-up reload of a command that has one. Every step ends redo at once:
// the planner drops its redo future with the step, also when the call leaves
// no step in the end (a probe load undone, then a failed load).
const countingPlannerApi = (roomDesignerApi: PlannerApi) => {
  const { extended } = roomDesignerApi;
  const count = {
    steps: 0,
    groupsBefore: undefined as string | undefined,
    // the event count the call's follow-up reloads bring, earlier ones that
    // have not landed yet included
    followUpEvents: 0,
  };
  const beforeStep = async () => {
    count.groupsBefore ??= await readGroupsKey(roomDesignerApi);
  };
  const stepped = () => {
    count.steps += 1;
    planHistory.endRedo();
  };
  const api: PlannerApi = {
    extended: {
      ...extended,
      loadExternalObjectGroupLayout: async (layout, layoutType, options) => {
        await beforeStep();
        const loaded = await extended.loadExternalObjectGroupLayout(
          layout,
          layoutType,
          options
        );
        if (Array.isArray(loaded) && loaded.length > 0) {
          stepped();
        }
        return loaded;
      },
      externalObjectGroupOperation: async (command, payload) => {
        await beforeStep();
        const eventsBefore = planHistory.events;
        const result = await extended.externalObjectGroupOperation(
          command,
          payload
        );
        stepped();
        // a page that relays no history events gets no wait
        if (hasFollowUp(command, result) && planHistory.events > eventsBefore) {
          count.followUpEvents =
            Math.max(count.followUpEvents, eventsBefore) + 2;
          await planHistory.waitForEvents(
            count.followUpEvents,
            FOLLOW_UP_WAIT_MS
          );
        }
        return result;
      },
      removeExternalObject: async (groupOrRootModuleId) => {
        await beforeStep();
        const result = await extended.removeExternalObject(groupOrRootModuleId);
        stepped();
        return result;
      },
      undo: async () => {
        await extended.undo();
        count.steps -= 1;
      },
    },
  };
  return { api, count };
};

// A tool call that changed the plan is recorded with its planner steps and
// the plan before and after it, so that undo can revert it; the history
// events while it runs are its own. A plan that cannot be read afterwards
// leaves no record the undo could trust.
const recorded =
  (tool: string, executor: ToolExecutor): ToolExecutor =>
  async (roomDesignerApi, args) => {
    const { api, count } = countingPlannerApi(roomDesignerApi);
    planHistory.begin();
    try {
      return await executor(api, args);
    } finally {
      const recordable = count.steps > 0 && count.groupsBefore !== undefined;
      let groupsAfter: string | undefined;
      if (recordable) {
        try {
          groupsAfter = await readGroupsKey(roomDesignerApi);
        } catch {
          groupsAfter = undefined;
        }
      }
      // From here on nothing awaits, so no history event comes between the
      // check and the end of the call: a follow-up that landed after the wait
      // gave up, while the call still ran, is the call's own.
      const lateFollowUps = Math.max(
        0,
        count.followUpEvents - planHistory.events
      );
      for (let late = 0; late < lateFollowUps; late++) {
        planHistory.expectLateFollowUp();
      }
      const settled = lateFollowUps === 0;
      if (recordable && groupsAfter === undefined) {
        planHistory.forget();
      } else if (recordable) {
        planHistory.record({
          tool,
          steps: count.steps,
          groupsBefore: count.groupsBefore!,
          groupsAfter: groupsAfter!,
          settled,
        });
      }
      planHistory.end();
    }
  };

const planChange = (tool: string, executor: ToolExecutor): ToolExecutor =>
  oneAtATime(recorded(tool, executor));

type HistoryDirection = 'undo' | 'redo';

// One planner undo or redo per step, each confirmed by its history event.
// Returns the number of steps done: fewer when the planner's history ran out.
const stepHistory = async (
  roomDesignerApi: PlannerApi,
  direction: HistoryDirection,
  steps: number
): Promise<number> => {
  planHistory.begin();
  try {
    for (let step = 0; step < steps; step++) {
      const eventsBefore = planHistory.events;
      await roomDesignerApi.extended[direction]();
      const confirmed = await planHistory.waitForEvents(
        eventsBefore + 1,
        HISTORY_EVENT_WAIT_MS
      );
      if (!confirmed) {
        return step;
      }
    }
    return steps;
  } finally {
    planHistory.end();
  }
};

const NOTHING_TO_UNDO =
  'Nothing to undo: no tool call has changed the plan since the planner page connected.';
const NOTHING_TO_REDO =
  'Nothing to redo: redo brings back a tool call that undo reverted, and a new change of the plan ends redo.';
const CHANGED_IN_PLANNER =
  "The plan was changed in the planner after the last tool call, so no tool call was reverted - the planner's own undo button reverts the changes made there.";
const STILL_FINISHING =
  'The planner has not finished the last change yet - its follow-up reload is still outstanding. Nothing was undone; call undo again in a moment.';

// undo reverts the last tool call that changed the plan, redo brings back the
// last one undo reverted - only while the plan is as that call left it. The
// server cannot keep the user from changing the plan in the planner while a
// tool call runs, and such a change sits among the call's steps: an undo or
// redo that does not give back the plan before or after the call is taken
// back, so it never leaves a wrong revert in place.
const revertToolCall =
  (direction: HistoryDirection): ToolExecutor =>
  async (roomDesignerApi) => {
    const undo = direction === 'undo';
    const call = undo ? planHistory.lastDone() : planHistory.lastUndone();
    const answer = async (tool: string | null, hint?: string) => ({
      [undo ? 'undone' : 'redone']: tool,
      groups: await planGroups(roomDesignerApi),
      ...(hint && { hint }),
    });
    if (!call) {
      return answer(
        null,
        planHistory.changedInPlanner
          ? CHANGED_IN_PLANNER
          : undo
            ? NOTHING_TO_UNDO
            : NOTHING_TO_REDO
      );
    }
    // an undo never runs before the call's late follow-up reload has landed:
    // a reload after the undo would become a step of its own and end redo
    if (undo && !call.settled) {
      if (planHistory.lateFollowUps > 0) {
        await planHistory.waitForEvents(
          planHistory.events + planHistory.lateFollowUps,
          FOLLOW_UP_WAIT_MS
        );
      }
      if (planHistory.lateFollowUps > 0) {
        return answer(null, STILL_FINISHING);
      }
      planHistory.settleLastDone(await readGroupsKey(roomDesignerApi));
    }
    const [from, to] = undo
      ? [call.groupsAfter, call.groupsBefore]
      : [call.groupsBefore, call.groupsAfter];
    if ((await readGroupsKey(roomDesignerApi)) !== from) {
      planHistory.forget();
      return answer(null, CHANGED_IN_PLANNER);
    }
    const done = await stepHistory(roomDesignerApi, direction, call.steps);
    if (done < call.steps) {
      planHistory.forget();
      return answer(
        null,
        done === 0
          ? `The planner's undo history no longer holds ${call.tool} - the plan was loaded again, nothing was ${undo ? 'undone' : 'redone'}.`
          : `The planner's undo history ended after ${done} of ${call.steps} steps of ${call.tool} - check the plan with get-plan-context.`
      );
    }
    if ((await readGroupsKey(roomDesignerApi)) !== to) {
      const back = await stepHistory(
        roomDesignerApi,
        undo ? 'redo' : 'undo',
        call.steps
      );
      const restored =
        back === call.steps && (await readGroupsKey(roomDesignerApi)) === from;
      planHistory.markChangedInPlanner();
      const missed = `${undo ? 'Undo' : 'Redo'} of ${call.tool} did not give back the plan ${undo ? 'before' : 'after'} it - the plan was changed in the planner while the tool call ran.`;
      return answer(
        null,
        restored
          ? `${missed} The ${direction} was taken back and the plan is as it was; the planner's undo button reverts the changes made there.`
          : `${missed} The ${direction} could not be taken back completely - check the plan with get-plan-context.`
      );
    }
    if (undo) {
      planHistory.markUndone();
    } else {
      planHistory.markRedone();
    }
    return answer(call.tool);
  };

// The agent reads a group's position in the frame it places a group with: pos
// is the room point of the group's back left bottom corner, rotationY the
// rotation of the placement - wherever the planner keeps the group origin. The
// planner's raw groups carry the geometry; the server's own geometry reads the
// planner's values.
const inPlacementFrame =
  (executor: ToolExecutor): ToolExecutor =>
  async (roomDesignerApi, args) => {
    const result: any = await executor(roomDesignerApi, args);
    const positioned = (group: any) => group?.position?.pos !== undefined;
    if (
      !(Array.isArray(result?.groups) && result.groups.some(positioned)) &&
      !positioned(result?.group)
    ) {
      return result;
    }
    const rawGroups =
      ((await roomDesignerApi.extended.getExternalObjectGroups()) ??
        []) as any[];
    const inFrame = (group: any) => {
      const rawGroup = positioned(group)
        ? rawGroups.find((candidate) => candidate.id === group.id)
        : undefined;
      const position =
        rawGroup &&
        positionInPlacementFrame(rawGroup, group.position.footprint);
      return position ? { ...group, position } : group;
    };
    return {
      ...result,
      ...(Array.isArray(result.groups) && {
        groups: result.groups.map(inFrame),
      }),
      ...(result.group && { group: inFrame(result.group) }),
    };
  };

export const toolExecutors: Record<string, ToolExecutor> = {
  // The plan context arrives agent-ready from the planner API (compacted
  // sections, 3D room contours with derived walls); the executor passes it
  // through with the articles' cornerArticle flag completed and without their
  // corner points, which only the server uses.
  'get-plan-context': oneAtATime(
    inPlacementFrame(async (roomDesignerApi, args) => {
      // an unknown section is ignored
      const known = (Array.isArray(args.include) ? args.include : []).filter(
        (section): section is PlanContextSection =>
          PLAN_CONTEXT_SECTIONS.includes(section)
      );
      const requested = known.length > 0 ? known : DEFAULT_SECTIONS;
      // the walls name the doors and windows of the obstacles
      const withRooms =
        requested.includes('obstacles') && !requested.includes('rooms');
      const context =
        await roomDesignerApi.extended.getExternalObjectPlanContext(
          withRooms ? [...requested, 'rooms'] : requested
        );
      if (!isObject(context)) {
        return context;
      }
      const result = { ...context };
      if (result.rooms !== undefined) {
        result.rooms = agentFacingRooms(result.rooms);
      }
      if (result.obstacles !== undefined) {
        result.obstacles = agentFacingObstacles(result.obstacles, result.rooms);
      }
      if (withRooms) {
        delete result.rooms;
      }
      if (Array.isArray(result.articles)) {
        const articles = result.articles as any[];
        result.articles = articles.map((article) =>
          agentFacingArticle(article, articles)
        );
      }
      return result;
    })
  ),

  'find-attributes': async (roomDesignerApi, args) => {
    const needle = String(args.text ?? '')
      .trim()
      .toLowerCase();
    if (needle.length === 0) {
      throw new Error('text must not be empty.');
    }
    const libraryId = args.libraryId as string | undefined;
    const context = await roomDesignerApi.extended.getExternalObjectPlanContext(
      ['masterData']
    );
    const matches: any[] = [];
    for (const [id, masterData] of Object.entries(
      (context.masterData ?? {}) as Record<string, any>
    )) {
      if (libraryId && id !== libraryId) {
        continue;
      }
      // the master data arrives compacted: root modules and customer-facing
      // attributes only
      const rootModules = (masterData.modules ?? []) as any[];
      for (const attribute of masterData.attributes ?? []) {
        if (!attributeMatches(attribute, needle)) {
          continue;
        }
        matches.push({
          libraryId: id,
          ...attribute,
          rootModules: rootModules
            .filter((module: any) =>
              (module.attributes ?? []).includes(attribute.id)
            )
            .map((module: any) => module.id),
        });
      }
    }
    return {
      matches: matches.slice(0, MAX_ATTRIBUTE_MATCHES),
      total: matches.length,
      ...(matches.length > MAX_ATTRIBUTE_MATCHES && {
        hint: `Only the first ${MAX_ATTRIBUTE_MATCHES} of ${matches.length} matches are listed - narrow the text.`,
      }),
    };
  },

  'create-or-replace-groups': planChange(
    'create-or-replace-groups',
    inPlacementFrame(async (roomDesignerApi, args) => {
      const corrections: string[] = [];
      const notLoaded: NotLoadedGroup[] = [];
      let callGroups = keepBuildable(
        (args.posGroups as any[]).map((group, index) => ({
          group,
          index,
          kitchenWide: generatedRootAttributes(group),
        })),
        notLoaded,
        ({ group, index }) =>
          prepareGroup(group, `posGroups[${index}]`, corrections)
      );
      const failIfNothingLeft = () => {
        if (callGroups.length === 0) {
          throw nothingLoaded(notLoaded);
        }
      };
      failIfNothingLeft();
      for (const { group } of callGroups) {
        group.roots = group.roots.map(toArticlePick);
      }
      const catalog =
        await roomDesignerApi.extended.getExternalObjectPlanContext([
          'articles',
        ]);
      const articles = (catalog.articles ?? []) as any[];
      callGroups = keepBuildable(callGroups, notLoaded, (callGroup) =>
        resolveArticleIds(
          articles,
          callGroup,
          `posGroups[${callGroup.index}]`,
          corrections,
          notLoaded
        )
      );
      failIfNothingLeft();
      callGroups = keepBuildable(callGroups, notLoaded, ({ group, index }) =>
        relationsToDocking(group, articles, `posGroups[${index}]`, corrections)
      );
      failIfNothingLeft();
      await moveGeneratedRootOverrides(
        roomDesignerApi,
        callGroups,
        articles,
        corrections
      );

      const preContext =
        await roomDesignerApi.extended.getExternalObjectPlanContext([
          'groups',
          'obstacles',
        ]);
      const beforeGroupIds = new Set(
        ((preContext.groups ?? []) as any[]).map((group) => group.id)
      );
      resolveAgentGroupIds(callGroups, beforeGroupIds, corrections);
      // In a new group, a root named in the docking but never sent cannot be
      // built; a replaced group keeps its entries to roots deleted from it.
      for (const { group, index } of callGroups) {
        if (!beforeGroupIds.has(group.id)) {
          reportUnsentRoots(group, `posGroups[${index}]`, corrections);
        }
      }
      callGroups = keepBuildable(callGroups, notLoaded, ({ group, index }) =>
        completeDocking(group, articles, `posGroups[${index}]`, corrections)
      );
      failIfNothingLeft();
      // A placement on a group in the plan would move it on the replace. Without
      // repositioning the planner keeps the group where it is.
      for (const { group, index } of callGroups) {
        if (group.placement !== undefined && beforeGroupIds.has(group.id)) {
          delete group.placement;
          corrections.push(
            `posGroups[${index}]: group '${group.id}' is already in the plan - its placement was not ` +
              'used and the group keeps its position; place-group moves it'
          );
        }
      }
      // The frame of an anchor - its docking corner and the turn of a corner
      // article - comes from the docking vectors of the anchor calculated as
      // authored: learned earlier, or calculated by a probe.
      const placedAnchors = callGroups.flatMap(({ group, index }) =>
        group.placement === undefined
          ? []
          : [
              {
                anchor: anchorRootOf(group.roots, group.placement, articles),
                libraryId: group.libraryId as string | undefined,
                index,
              },
            ]
      );
      const unknownAnchors = placedAnchors.filter(
        ({ anchor, libraryId }) =>
          !knownAnchorFrames.has(anchorVariantKey(anchor, libraryId))
      );
      const uncalculatedKeys = new Set<string>();
      if (unknownAnchors.length > 0) {
        const planGroups =
          ((await roomDesignerApi.extended.getExternalObjectGroups()) ??
            []) as any[];
        const planGroupIds = new Set(planGroups.map((group) => group.id));
        for (const { anchor, libraryId } of unknownAnchors) {
          const key = anchorVariantKey(anchor, libraryId);
          if (knownAnchorFrames.has(key) || uncalculatedKeys.has(key)) {
            continue;
          }
          const frame = await probeAnchorFrame(
            roomDesignerApi,
            anchor,
            libraryId,
            planGroupIds
          );
          if (frame) {
            knownAnchorFrames.set(key, frame);
          } else {
            uncalculatedKeys.add(key);
          }
        }
      }
      for (const { anchor, libraryId, index } of placedAnchors) {
        if (uncalculatedKeys.has(anchorVariantKey(anchor, libraryId))) {
          corrections.push(
            `posGroups[${index}]: root '${anchor.id}' ('${anchor.articleId}') could not be calculated before ` +
              "loading - the group was placed by the unit's origin and may stand off posGroup; place-group " +
              'puts it against a wall or into a room corner'
          );
        }
      }
      // Only article picks and the repositioning derived from the placement
      // reach the planner.
      const posGroups = callGroups.map(({ group }) => group);
      for (const group of posGroups) {
        if (group.placement !== undefined) {
          group.repositioningData = toRepositioningData(
            group.roots,
            group.placement,
            articles,
            knownAnchorFrames,
            group.libraryId
          );
        }
        if (!group.attributes?.length) {
          delete group.attributes;
        }
        for (const field of Object.keys(group)) {
          if (
            ![
              'id',
              'libraryId',
              'roots',
              'repositioningData',
              'attributes',
            ].includes(field)
          ) {
            delete group[field];
          }
        }
      }
      // a replaced group is told only what it did not stand on before (D55)
      const rawGroupsBefore =
        preContext.obstacles !== undefined &&
        posGroups.some((group) => beforeGroupIds.has(group.id))
          ? (((await roomDesignerApi.extended.getExternalObjectGroups()) ??
              []) as any[])
          : [];

      const loaded =
        await roomDesignerApi.extended.loadExternalObjectGroupLayout(
          { posGroups },
          'posGroups',
          // 'adjusted' makes the planner re-apply the group pos/rotationY when a
          // group is replaced; without it a replace keeps the old position.
          { reason: 'adjusted' }
        );
      if (!loaded || loaded.length === 0) {
        throw new Error(
          'No groups were created or replaced. Check that each root module name is a master-data ' +
            'module id and the articleId comes from the article catalog (see get-plan-context), ' +
            'and that the payload follows the rules returned by get-authoring-rules.' +
            notLoaded
              .flatMap((entry) => entry.errors)
              .map((error) => `\n${error}`)
              .join('')
        );
      }
      let placed = await roomDesignerApi.extended.getExternalObjectPlanContext([
        'groups',
        'obstacles',
        'rooms',
      ]);
      let groups = placed.groups;
      const replacedInputIds = new Set(
        posGroups
          .map((group) => group.id)
          .filter((id) => id && beforeGroupIds.has(id))
      );
      reportRevertedReplaces(
        callGroups,
        (preContext.groups ?? []) as any[],
        (groups ?? []) as any[],
        corrections
      );
      if (
        await applyKitchenWideAttributes(
          roomDesignerApi,
          callGroups,
          beforeGroupIds,
          (groups ?? []) as any[],
          corrections
        )
      ) {
        placed = await roomDesignerApi.extended.getExternalObjectPlanContext([
          'groups',
          'obstacles',
          'rooms',
        ]);
        groups = placed.groups;
      }
      rememberAgentGroupIds(
        callGroups,
        beforeGroupIds,
        (groups ?? []) as any[]
      );
      const unpositionedGroupIds = (groups ?? [])
        .filter(
          (group: any) =>
            group.position.pos === undefined &&
            (!beforeGroupIds.has(group.id) || replacedInputIds.has(group.id))
        )
        .map((group: any) => group.id);
      const obstacles =
        placed.obstacles !== undefined
          ? obstacleHint({
              groupIds: matchResultGroups(
                callGroups,
                beforeGroupIds,
                (groups ?? []) as any[]
              ).map(([, result]) => result.id),
              rawGroups:
                ((await roomDesignerApi.extended.getExternalObjectGroups()) ??
                  []) as any[],
              obstacles: placed.obstacles,
              rooms: placed.rooms,
              withGroups: true,
              before: rawGroupsBefore,
              closing:
                'The groups were built as sent - move or change them if the user did not ask for them there.',
            })
          : undefined;
      const hints = [
        ...(unpositionedGroupIds.length > 0
          ? [
              `Groups ${unpositionedGroupIds.join(', ')} are not positioned and sit at the plan origin. ` +
                'A group gets its position from the placement ({ posGroup, posRotationY }) it is created ' +
                'with (see get-authoring-rules), or place-group moves it against a wall or into a room corner.',
            ]
          : []),
        ...(obstacles ? [obstacles] : []),
      ];
      return {
        loaded,
        groups,
        ...(hints.length > 0 && { hint: hints.join(' ') }),
        ...(corrections.length > 0 && { corrections }),
        ...(notLoaded.length > 0 && { notLoaded }),
      };
    })
  ),

  'place-group': planChange(
    'place-group',
    inPlacementFrame(async (roomDesignerApi, args) => {
      const corrections: string[] = [];
      const groupId = args.groupId as string;
      const spec: WallPlacementSpec = {
        wall: sideLabel(args.wall as string | number),
        alignment: sideLabel(
          (args.alignment as WallAlignment | undefined) ?? 'center'
        ),
        offsetMm: (args.offsetMm as number | undefined) ?? 0,
        roomIndex: (args.roomIndex as number | undefined) ?? 0,
      };
      const context =
        await roomDesignerApi.extended.getExternalObjectPlanContext([
          'rooms',
          'groups',
          'obstacles',
        ]);
      const groups = (context.groups ?? []) as any[];
      const group = findGroup(groups, groupId);
      const rooms = ((context.rooms as any)?.rooms ?? []) as any[];
      const resolved = resolveWall(rooms, spec);
      if (
        isWallSide(spec.alignment) &&
        alignmentRunsParallel(resolved.wall, spec.alignment)
      ) {
        corrections.push(
          `The alignment '${spec.alignment}' runs parallel to the ${resolved.wall.side} wall - ` +
            'the group was centred on the wall instead'
        );
        spec.alignment = 'center';
      }
      // the placement math needs the calculated group with its geometry; the
      // plan context returns the groups compacted
      const rawGroups =
        ((await roomDesignerApi.extended.getExternalObjectGroups()) ??
          []) as any[];
      const rawGroup = rawGroups.find((candidate) => candidate.id === group.id);
      if (!rawGroup) {
        throw new Error(
          `Group '${groupId}' has no calculated geometry to place.`
        );
      }
      let placement = placeGroupAtWall(rawGroup, resolved, spec);
      const others = placedGroupVolumes(rawGroups, group.id);
      const overlapped = overlappedGroupIds(
        volumeOf(placement.footprint, placement.heights, placement),
        others
      );
      if (overlapped.length > 0) {
        const named = overlapped.map((id) => `'${id}'`).join(', ');
        const free =
          placement.placedIn === 'wall'
            ? freePlacementAlongWall(placement, resolved.wall, spec, others)
            : undefined;
        if (free) {
          const movedMm = Math.round(
            Math.hypot(
              free.pos[0] - placement.pos[0],
              free.pos[2] - placement.pos[2]
            )
          );
          corrections.push(
            `Group '${group.id}' would overlap group ${named} at the ${resolved.wall.side} wall - it was moved ` +
              `${movedMm} mm along the wall to stand beside it. If the units belong together, join the ` +
              'groups with merge-groups'
          );
          placement = free;
        } else {
          corrections.push(
            `Group '${group.id}' overlaps group ${named} - there is no free position on the ` +
              `${resolved.wall.side} wall for it, so it stands where it was asked to`
          );
        }
      }
      if (standsAt(rawGroup, placement)) {
        corrections.push(
          `Group '${group.id}' already stands at the ${resolved.wall.side} wall as asked - nothing was reloaded`
        );
        return withCorrections(
          { placedIn: placement.placedIn, wall: resolved.wall, group },
          corrections
        );
      }
      const loaded =
        await roomDesignerApi.extended.loadExternalObjectGroupLayout(
          { posGroups: [repositionedGroup(rawGroup, placement)] },
          'posGroups',
          { reason: 'adjusted' }
        );
      if (!loaded || loaded.length === 0) {
        throw new Error(
          `Group '${groupId}' could not be reloaded at the new position.`
        );
      }
      const after = await roomDesignerApi.extended.getExternalObjectPlanContext(
        ['groups']
      );
      // the objects, doors and windows; the other groups are G22's
      const hint =
        context.obstacles !== undefined
          ? obstacleHint({
              groupIds: [group.id],
              rawGroups:
                ((await roomDesignerApi.extended.getExternalObjectGroups()) ??
                  []) as any[],
              obstacles: context.obstacles,
              rooms: context.rooms,
              withGroups: false,
              closing:
                'The group was placed anyway - move or change it if the user did not ask for it there.',
            })
          : undefined;
      return withCorrections(
        {
          placedIn: placement.placedIn,
          wall: resolved.wall,
          group: ((after.groups ?? []) as any[]).find(
            (candidate) => candidate.id === group.id
          ),
          ...(hint && { hint }),
        },
        corrections
      );
    })
  ),

  // The group commands run in the planner (externalObjectGroupOperation); the
  // executors resolve group id prefixes and check article ids against the
  // catalog first, so the agent gets the lists of valid ids on a mistake.
  'change-module-attribute': planChange(
    'change-module-attribute',
    inPlacementFrame(async (roomDesignerApi, args) => {
      const corrections: string[] = [];
      const groups = await planGroups(roomDesignerApi);
      const rootModuleId = resolveRootId(
        rootsOfGroups(groups),
        args.rootModuleId as string,
        'change-module-attribute',
        corrections
      );
      return withCorrections(
        await withPlanRoots(
          () =>
            roomDesignerApi.extended.externalObjectGroupOperation(
              'change-module-attribute',
              {
                rootModuleId,
                moduleId: args.moduleId ?? null,
                attributeId: args.attributeId,
                value: attributeValue(args.value),
              }
            ),
          groups
        ),
        corrections
      );
    })
  ),

  'change-group-attribute': planChange(
    'change-group-attribute',
    inPlacementFrame(async (roomDesignerApi, args) => {
      const group = findGroup(
        await planGroups(roomDesignerApi),
        args.groupId as string
      );
      return roomDesignerApi.extended.externalObjectGroupOperation(
        'change-group-attribute',
        {
          groupId: group.id,
          attributeId: args.attributeId,
          value: attributeValue(args.value),
        }
      );
    })
  ),

  'delete-group': planChange(
    'delete-group',
    inPlacementFrame(async (roomDesignerApi, args) => {
      const group = findGroup(
        await planGroups(roomDesignerApi),
        args.groupId as string
      );
      return roomDesignerApi.extended.externalObjectGroupOperation(
        'delete-group',
        { groupId: group.id }
      );
    })
  ),

  'delete-root-module': planChange(
    'delete-root-module',
    inPlacementFrame(async (roomDesignerApi, args) => {
      const corrections: string[] = [];
      const groups = await planGroups(roomDesignerApi);
      const rootModuleId = resolveRootId(
        rootsOfGroups(groups),
        args.rootModuleId as string,
        'delete-root-module',
        corrections
      );
      return withCorrections(
        await withPlanRoots(
          () =>
            roomDesignerApi.extended.externalObjectGroupOperation(
              'delete-root-module',
              { rootModuleId }
            ),
          groups
        ),
        corrections
      );
    })
  ),

  'remove-article-from-group': planChange(
    'remove-article-from-group',
    inPlacementFrame(async (roomDesignerApi, args) => {
      const corrections: string[] = [];
      const context =
        await roomDesignerApi.extended.getExternalObjectPlanContext([
          'groups',
          'articles',
          'rooms',
        ]);
      const groups = (context.groups ?? []) as any[];
      const group = args.groupId
        ? findGroup(groups, args.groupId as string)
        : groupOfRoot(groups, args.rootModuleId as string);
      const rootModuleId = resolveRootId(
        group.roots ?? [],
        args.rootModuleId as string,
        'remove-article-from-group',
        corrections
      );
      return withRowHints(roomDesignerApi, group.id, context, async () =>
        withCorrections(
          await withPlanRoots(
            () =>
              roomDesignerApi.extended.externalObjectGroupOperation(
                'remove-article-from-group',
                { groupId: group.id, rootModuleId }
              ),
            [group]
          ),
          corrections
        )
      );
    })
  ),

  'merge-article-into-group': planChange(
    'merge-article-into-group',
    inPlacementFrame(async (roomDesignerApi, args) => {
      const corrections: string[] = [];
      const context =
        await roomDesignerApi.extended.getExternalObjectPlanContext([
          'groups',
          'articles',
          'rooms',
        ]);
      const group = findGroup(context.groups ?? [], args.groupId as string);
      const articles = (context.articles ?? []) as any[];
      const articleId = catalogArticleId(
        articles,
        { articleId: args.articleId, libraryId: group.libraryId },
        'merge-article-into-group',
        corrections
      );
      // the calculated group and the room decide between the two ends of a row
      const rawGroups =
        ((await roomDesignerApi.extended.getExternalObjectGroups()) ??
          []) as any[];
      const rawGroup = rawGroups.find((candidate) => candidate.id === group.id);
      const rooms = ((context.rooms as any)?.rooms ?? []) as any[];
      const room =
        (isPoint(rawGroup?.pos) &&
          roomOfPoint(
            rooms,
            [rawGroup.pos[0], rawGroup.pos[2]],
            OVERLAP_TOLERANCE_MM
          )) ||
        rooms[0];
      const geometry: RowGeometry = {
        rawGroup,
        walls: (room?.walls ?? []) as any[],
      };
      const sentDockTo = { ...(args.dockTo as any) };
      if (typeof sentDockTo.rootId === 'string') {
        sentDockTo.rootId = resolveRootId(
          group.roots ?? [],
          sentDockTo.rootId,
          'merge-article-into-group',
          corrections
        );
      }
      const dockTo = dockTarget(
        group,
        catalogArticleOf(articles, { articleId, libraryId: group.libraryId }),
        sentDockTo,
        corrections,
        articles,
        geometry
      );
      return withCorrections(
        await withPlanRoots(
          () =>
            roomDesignerApi.extended.externalObjectGroupOperation(
              'merge-article-into-group',
              {
                groupId: group.id,
                articleId,
                ...(args.attributes !== undefined && {
                  attributes: args.attributes,
                }),
                dockTo,
              }
            ),
          [group]
        ),
        corrections
      );
    })
  ),

  'exchange-root-module': planChange(
    'exchange-root-module',
    inPlacementFrame(async (roomDesignerApi, args) => {
      const corrections: string[] = [];
      const context =
        await roomDesignerApi.extended.getExternalObjectPlanContext([
          'groups',
          'articles',
          'rooms',
        ]);
      const group = findGroup(context.groups ?? [], args.groupId as string);
      const articleId = catalogArticleId(
        context.articles ?? [],
        { articleId: args.articleId, libraryId: group.libraryId },
        'exchange-root-module',
        corrections
      );
      const rootModuleId = resolveRootId(
        group.roots ?? [],
        args.rootModuleId as string,
        'exchange-root-module',
        corrections
      );
      return withRowHints(roomDesignerApi, group.id, context, async () =>
        withCorrections(
          await withPlanRoots(
            () =>
              roomDesignerApi.extended.externalObjectGroupOperation(
                'exchange-root-module',
                {
                  groupId: group.id,
                  rootModuleId,
                  articleId,
                  ...(args.attributes !== undefined && {
                    attributes: args.attributes,
                  }),
                }
              ),
            [group]
          ),
          corrections
        )
      );
    })
  ),

  'insert-article-into-group': planChange(
    'insert-article-into-group',
    inPlacementFrame(async (roomDesignerApi, args) => {
      const corrections: string[] = [];
      const context =
        await roomDesignerApi.extended.getExternalObjectPlanContext([
          'groups',
          'articles',
          'rooms',
        ]);
      const group = findGroup(context.groups ?? [], args.groupId as string);
      const articleId = catalogArticleId(
        context.articles ?? [],
        { articleId: args.articleId, libraryId: group.libraryId },
        'insert-article-into-group',
        corrections
      );
      const between = insertBetween(
        group,
        (args.between as [string, string]).map((rootId) =>
          resolveRootId(
            group.roots ?? [],
            rootId,
            'insert-article-into-group',
            corrections
          )
        ) as [string, string],
        corrections
      );
      return withRowHints(roomDesignerApi, group.id, context, async () =>
        withCorrections(
          await withPlanRoots(
            () =>
              roomDesignerApi.extended.externalObjectGroupOperation(
                'insert-article-into-group',
                {
                  groupId: group.id,
                  articleId,
                  ...(args.attributes !== undefined && {
                    attributes: args.attributes,
                  }),
                  between,
                }
              ),
            [group]
          ),
          corrections
        )
      );
    })
  ),

  'swap-root-modules': planChange(
    'swap-root-modules',
    inPlacementFrame(async (roomDesignerApi, args) => {
      const corrections: string[] = [];
      const context =
        await roomDesignerApi.extended.getExternalObjectPlanContext([
          'groups',
          'articles',
          'rooms',
        ]);
      const group = findGroup(context.groups ?? [], args.groupId as string);
      const rootModuleIds = (args.rootModuleIds as string[]).map((rootId) =>
        resolveRootId(
          group.roots ?? [],
          rootId,
          'swap-root-modules',
          corrections
        )
      );
      if (rootModuleIds[0] === rootModuleIds[1]) {
        throw new Error(
          `swap-root-modules: both ids name the root '${rootModuleIds[0]}' - name the two units that change places`
        );
      }
      return withRowHints(roomDesignerApi, group.id, context, async () =>
        withCorrections(
          await withPlanRoots(
            () =>
              roomDesignerApi.extended.externalObjectGroupOperation(
                'swap-root-modules',
                { groupId: group.id, rootModuleIds }
              ),
            [group]
          ),
          corrections
        )
      );
    })
  ),

  'merge-groups': planChange(
    'merge-groups',
    inPlacementFrame(async (roomDesignerApi, args) => {
      const groups = await planGroups(roomDesignerApi);
      return roomDesignerApi.extended.externalObjectGroupOperation(
        'merge-groups',
        {
          targetGroupId: findGroup(groups, args.targetGroupId as string).id,
          groupIds: (args.groupIds as string[]).map(
            (groupId) => findGroup(groups, groupId).id
          ),
        }
      );
    })
  ),

  undo: oneAtATime(inPlacementFrame(revertToolCall('undo'))),

  redo: oneAtATime(inPlacementFrame(revertToolCall('redo'))),

  'get-price': async (roomDesignerApi) => {
    return roomDesignerApi.extended.fetchPrice();
  },

  'get-order-data': async (roomDesignerApi) => {
    const snapshot = await roomDesignerApi.extended.getExternalObjectSnapshot({
      orderData: true,
    });
    return snapshot?.orderData ?? null;
  },

  'get-plan-images': async (roomDesignerApi) => {
    const snapshot = await roomDesignerApi.extended.getExternalObjectSnapshot({
      perspectiveImage: true,
      topImage: true,
    });
    return {
      perspectiveImage: snapshot?.perspectiveImage,
      topImage: snapshot?.topImage,
    };
  },
};
