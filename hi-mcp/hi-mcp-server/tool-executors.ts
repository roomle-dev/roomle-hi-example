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
  relationsToDocking,
} from './group-layout';
import {
  adjoiningWall,
  alignmentRunsParallel,
  footprintCornersInRoom,
  groupCornerGeometry,
  groupFootprint,
  groupHeightRange,
  placeAgainstWall,
  placeCornerAtWalls,
  repositioningFromPlacement,
  spanAlongWall,
  volumesOverlap,
  wallSpanStart,
} from './plan-space';
import type {
  DerivedWall,
  GroupFootprint,
  PlacedVolume,
  WallAlignment,
  WallSide,
} from './plan-space';
import type { PlannerApi } from './planner-api';

export type ToolExecutor = (
  roomDesignerApi: PlannerApi,
  args: Record<string, unknown>
) => Promise<unknown>;

type PlanContextSection = 'masterData' | 'rooms' | 'articles' | 'groups';

const PLAN_CONTEXT_SECTIONS: unknown[] = [
  'masterData',
  'rooms',
  'articles',
  'groups',
];

const DEFAULT_SECTIONS: PlanContextSection[] = ['rooms', 'articles', 'groups'];

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
// repositioningData of the first article root, the library regenerates the
// generated roots (worktop, toe kick), and no root carries a position.
const repositionedGroup = (resultGroup: any, placement: GroupPlacement) => {
  const roots = (resultGroup.roots ?? []).filter(
    (root: any) => !isGeneratedRoot(root)
  );
  const anchor = roots[0];
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

const resolveArticleIds = (
  articles: any[],
  group: any,
  prefix: string,
  corrections: string[]
): string[] =>
  (group.roots as any[]).filter(isArticlePickOnly).flatMap((root) => {
    const label = `${prefix} root '${root.id}'`;
    try {
      root.articleId = catalogArticleId(articles, root, label, corrections);
      return [];
    } catch (error) {
      return [`${label}: ${(error as Error).message}`];
    }
  });

// Where a new unit docks to a group as get-plan-context shows it: a side that
// is taken moves to the free end of that row, and a docking vector the article
// does not have becomes the partner of the root's vector. A side the planner
// reports as taken although the row ends there stays as asked.
const dockTarget = (
  group: any,
  article: any,
  dockTo: any,
  corrections: string[]
): any => {
  const roots = (group.roots ?? []) as any[];
  const vector = dockTo.ownDockingVector;
  const root = roots.find((candidate) => candidate.id === dockTo.rootId);
  if (
    root &&
    SIDE_VECTORS.includes(vector) &&
    !(root.freeDockingVectors ?? []).includes(vector)
  ) {
    const end = rowEnd(sidePartnersOf(roots), root.id, vector);
    const endRoot = roots.find((candidate) => candidate.id === end);
    if (
      endRoot &&
      end !== root.id &&
      (endRoot.freeDockingVectors ?? []).includes(vector)
    ) {
      corrections.push(
        `merge-article-into-group: the ${vector} of root '${root.id}' is taken - the unit was docked to the ` +
          `${vector} of '${end}', the free end of that row`
      );
      dockTo.rootId = end;
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
  return dockTo;
};

const withCorrections = (result: any, corrections: string[]) =>
  corrections.length > 0 ? { ...result, corrections } : result;

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
// the raw groups, and every group the probe load added is removed again (the
// load result carries runtime ids only, which removal does not take). An
// article calculated without docking vectors gets the identity. Undefined when
// the planner calculated nothing.
const probeAnchorFrame = async (
  roomDesignerApi: PlannerApi,
  anchor: any,
  libraryId: string | undefined,
  planGroupIds: Set<string>
): Promise<AnchorFrame | undefined> => {
  await roomDesignerApi.extended.loadExternalObjectGroupLayout(
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
  for (const probe of probes) {
    await roomDesignerApi.extended.removeExternalObject(probe.id);
  }
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

// From a root along one side vector, root by root, to the root of that row
// whose same side vector is free.
const rowEnd = (
  partners: SidePartners,
  rootId: string,
  vector: string
): string | undefined => {
  const visited = new Set([rootId]);
  let current = rootId;
  for (;;) {
    const [next] = partners.get(current)?.get(vector)?.keys() ?? [];
    if (next === undefined) {
      return current;
    }
    if (visited.has(next)) {
      return undefined;
    }
    visited.add(next);
    current = next;
  }
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
// free end of that row.
const separateSideVectorPartners = (
  roots: any[],
  prefix: string,
  corrections: string[]
): string[] => {
  for (let round = 0; round <= roots.length * 2; round++) {
    const [conflict] = sideVectorConflicts(sidePartnersOf(roots));
    if (!conflict) {
      return [];
    }
    const { rootId, vector, sharing } = conflict;
    const [kept, moved] = sharing;
    removeDocking(roots, rootId, vector, moved);
    const end = rowEnd(sidePartnersOf(roots), rootId, vector);
    if (end === moved) {
      corrections.push(
        `${prefix}: roots ${quotedIds([kept, moved])} were docked to the ${vector} of root '${rootId}' at the ` +
          `same place - '${moved}' already follows in that row, so its second docking was dropped`
      );
      continue;
    }
    const endRoot = roots.find((root) => root.id === end);
    if (!endRoot) {
      break;
    }
    addDocking(endRoot, vector, moved, SIDE_PARTNER[vector]);
    corrections.push(
      `${prefix}: roots ${quotedIds([kept, moved])} were docked to the ${vector} of root '${rootId}' at the ` +
        `same place - '${moved}' was docked to the ${vector} of '${end}', the free end of that row`
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
  const errors = separateSideVectorPartners(group.roots, prefix, corrections);
  return errors.length > 0
    ? errors
    : connectUnreachedRoots(group.roots, articles, prefix, corrections);
};

interface CallGroup {
  group: any;
  index: number;
}

interface NotLoadedGroup {
  index: number;
  id?: string;
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
      const context =
        await roomDesignerApi.extended.getExternalObjectPlanContext(requested);
      if (!Array.isArray(context?.articles)) {
        return context;
      }
      const articles = context.articles as any[];
      return {
        ...context,
        articles: articles.map((article) =>
          agentFacingArticle(article, articles)
        ),
      };
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

  'create-or-replace-groups': oneAtATime(
    inPlacementFrame(async (roomDesignerApi, args) => {
      const corrections: string[] = [];
      const notLoaded: NotLoadedGroup[] = [];
      let callGroups = keepBuildable(
        (args.posGroups as any[]).map((group, index) => ({ group, index })),
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
      callGroups = keepBuildable(callGroups, notLoaded, ({ group, index }) =>
        resolveArticleIds(articles, group, `posGroups[${index}]`, corrections)
      );
      failIfNothingLeft();
      callGroups = keepBuildable(callGroups, notLoaded, ({ group, index }) =>
        relationsToDocking(group, articles, `posGroups[${index}]`, corrections)
      );
      failIfNothingLeft();

      const preContext =
        await roomDesignerApi.extended.getExternalObjectPlanContext(['groups']);
      const beforeGroupIds = new Set(
        ((preContext.groups ?? []) as any[]).map((group) => group.id)
      );
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
      const context =
        await roomDesignerApi.extended.getExternalObjectPlanContext(['groups']);

      const groups = context.groups;
      const replacedInputIds = new Set(
        posGroups
          .map((group) => group.id)
          .filter((id) => id && beforeGroupIds.has(id))
      );
      const unpositionedGroupIds = (groups ?? [])
        .filter(
          (group: any) =>
            group.position.pos === undefined &&
            (!beforeGroupIds.has(group.id) || replacedInputIds.has(group.id))
        )
        .map((group: any) => group.id);
      return {
        loaded,
        groups,
        ...(unpositionedGroupIds.length > 0 && {
          hint:
            `Groups ${unpositionedGroupIds.join(', ')} are not positioned and sit at the plan origin. ` +
            'A group gets its position from the placement ({ posGroup, posRotationY }) it is created ' +
            'with (see get-authoring-rules), or place-group moves it against a wall or into a room corner.',
        }),
        ...(corrections.length > 0 && { corrections }),
        ...(notLoaded.length > 0 && { notLoaded }),
      };
    })
  ),

  'place-group': oneAtATime(
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
      return withCorrections(
        {
          placedIn: placement.placedIn,
          wall: resolved.wall,
          group: ((after.groups ?? []) as any[]).find(
            (candidate) => candidate.id === group.id
          ),
        },
        corrections
      );
    })
  ),

  // The group commands run in the planner (externalObjectGroupOperation); the
  // executors resolve group id prefixes and check article ids against the
  // catalog first, so the agent gets the lists of valid ids on a mistake.
  'change-module-attribute': oneAtATime(
    inPlacementFrame(async (roomDesignerApi, args) =>
      roomDesignerApi.extended.externalObjectGroupOperation(
        'change-module-attribute',
        {
          rootModuleId: args.rootModuleId,
          moduleId: args.moduleId ?? null,
          attributeId: args.attributeId,
          value: attributeValue(args.value),
        }
      )
    )
  ),

  'change-group-attribute': oneAtATime(
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

  'delete-group': oneAtATime(
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

  'delete-root-module': oneAtATime(
    inPlacementFrame(async (roomDesignerApi, args) =>
      roomDesignerApi.extended.externalObjectGroupOperation(
        'delete-root-module',
        { rootModuleId: args.rootModuleId }
      )
    )
  ),

  'merge-article-into-group': oneAtATime(
    inPlacementFrame(async (roomDesignerApi, args) => {
      const corrections: string[] = [];
      const context =
        await roomDesignerApi.extended.getExternalObjectPlanContext([
          'groups',
          'articles',
        ]);
      const group = findGroup(context.groups ?? [], args.groupId as string);
      const articles = (context.articles ?? []) as any[];
      const articleId = catalogArticleId(
        articles,
        { articleId: args.articleId, libraryId: group.libraryId },
        'merge-article-into-group',
        corrections
      );
      const dockTo = dockTarget(
        group,
        catalogArticleOf(articles, { articleId, libraryId: group.libraryId }),
        { ...(args.dockTo as any) },
        corrections
      );
      return withCorrections(
        await roomDesignerApi.extended.externalObjectGroupOperation(
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
        corrections
      );
    })
  ),

  'exchange-root-module': oneAtATime(
    inPlacementFrame(async (roomDesignerApi, args) => {
      const corrections: string[] = [];
      const context =
        await roomDesignerApi.extended.getExternalObjectPlanContext([
          'groups',
          'articles',
        ]);
      const group = findGroup(context.groups ?? [], args.groupId as string);
      const articleId = catalogArticleId(
        context.articles ?? [],
        { articleId: args.articleId, libraryId: group.libraryId },
        'exchange-root-module',
        corrections
      );
      return withCorrections(
        await roomDesignerApi.extended.externalObjectGroupOperation(
          'exchange-root-module',
          {
            groupId: group.id,
            rootModuleId: args.rootModuleId,
            articleId,
          }
        ),
        corrections
      );
    })
  ),

  'merge-groups': oneAtATime(
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
