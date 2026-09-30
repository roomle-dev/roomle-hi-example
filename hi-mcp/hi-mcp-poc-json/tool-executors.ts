import {
  anchorRootOf,
  catalogArticleOf,
  cornerPointFor,
  cornerPointsByArticle,
  isCornerArticle,
  moduleIdOf,
  toRepositioningData,
} from './group-placement';
import {
  adjoiningWall,
  convexPolygonsTouch,
  footprintCornersInRoom,
  groupCornerGeometry,
  groupFootprint,
  placeAgainstWall,
  placeCornerAtWalls,
  repositioningFromPlacement,
  resolveWallAlignment,
  rootFootprintInRoom,
} from './plan-space';
import type {
  DerivedWall,
  GroupFootprint,
  WallAlignment,
  WallSide,
} from './plan-space';
import type { PlannerApi } from './planner-api';

export type ToolExecutor = (
  roomDesignerApi: PlannerApi,
  args: Record<string, unknown>,
) => Promise<unknown>;

type PlanContextSection = 'masterData' | 'rooms' | 'articles' | 'groups';

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
    (root: any) => !isGeneratedRoot(root),
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
      String(value).toLowerCase().includes(needle),
  );

const isArticlePickOnly = (root: any): boolean =>
  !root?.posData && !root?.modules && !root?.parts;

// A root authored by the agent is just an article pick (id, articleId,
// optional attribute overrides and docking contextData). The glue logic
// completes it from the article template; here the article id is validated
// against the catalog so the agent gets a helpful error instead of a
// half-calculated group.
const requireCatalogArticle = (articles: any[], root: any): void => {
  if (!catalogArticleOf(articles, root)) {
    const validIds = articles.map((candidate) => candidate.articleId);
    throw new Error(
      `articleId '${root.articleId}' is not in the article catalog. ` +
        `Valid article ids: ${validIds.slice(0, 100).join(', ')}`,
    );
  }
};

const validateArticlePickIds = (articles: any[], posGroups: any[]): void => {
  const articlePicks = posGroups.flatMap((group) =>
    (group?.roots ?? []).filter(isArticlePickOnly),
  );
  for (const root of articlePicks) {
    requireCatalogArticle(articles, root);
  }
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
        `${groupIds.join(', ') || 'none'}.`,
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
  const compact = { ...article, cornerArticle: isCornerArticle(articles, article) };
  delete compact.cornerPoint;
  return compact;
};

const PLACEMENT_FIELDS = ['posGroup', 'posRotationY', 'rootId'];

const WALL_PLACEMENT_FIELDS = ['wall', 'alignment', 'offsetMm'];

const PROBE_ROOT_ID = 'corner-probe';

// Corner points the server has learned from calculated corner articles, by
// article id and module name, for its lifetime.
const knownCornerPoints = new Map<string, [number, number, number]>();

export const forgetCornerPoints = (): void => knownCornerPoints.clear();

const learnCornerPoints = (
  cornerPoints: Map<string, [number, number, number]>,
): void => {
  for (const [key, point] of cornerPoints) {
    knownCornerPoints.set(key, point);
  }
};

// The corner point of a corner article exists only as calculated geometry.
// When neither the plan nor the catalog has it, the planner calculates the
// article once: a single-pick probe group is loaded, its docking vectors are
// read from the raw groups, and every group the probe load added is removed
// again (the load result carries runtime ids only, which removal does not
// take). An article calculated without corner vectors has no offset. False
// when the planner calculated nothing.
const probeCornerPoint = async (
  roomDesignerApi: PlannerApi,
  anchor: any,
  libraryId: string | undefined,
  planGroupIds: Set<string>,
): Promise<boolean> => {
  await roomDesignerApi.extended.loadExternalObjectGroupLayout(
    {
      posGroups: [
        {
          ...(libraryId && { libraryId }),
          roots: [{ id: PROBE_ROOT_ID, articleId: anchor.articleId }],
        },
      ],
    },
    'posGroups',
    { reason: 'adjusted' },
  );
  const probes = (
    ((await roomDesignerApi.extended.getExternalObjectGroups()) ?? []) as any[]
  ).filter((group) => !planGroupIds.has(group.id));
  for (const probe of probes) {
    await roomDesignerApi.extended.removeExternalObject(probe.id);
  }
  if (probes.length === 0) {
    return false;
  }
  const cornerPoints = cornerPointsByArticle(probes);
  learnCornerPoints(
    cornerPoints.size > 0
      ? cornerPoints
      : new Map([[anchor.articleId, [0, 0, 0] as [number, number, number]]]),
  );
  return true;
};

const isPoint = (value: unknown): boolean =>
  Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);

// Each error continues the "posGroups[i]" prefix of its group.
const placementErrors = (placement: any, rootIds: Set<string>): string[] => {
  if (
    typeof placement !== 'object' ||
    placement === null ||
    Array.isArray(placement)
  ) {
    return [': placement must be { posGroup, posRotationY, rootId? }'];
  }
  const errors: string[] = [];
  const unknownFields = Object.keys(placement).filter(
    (field) => !PLACEMENT_FIELDS.includes(field),
  );
  if (unknownFields.length > 0) {
    errors.push(
      '.placement takes only posGroup, posRotationY and rootId - remove ' +
        unknownFields.join(', ') +
        (unknownFields.some((field) => WALL_PLACEMENT_FIELDS.includes(field))
          ? ' - to stand a group against a wall or into a corner by its side label, call place-group'
          : ''),
    );
  }
  if (!isPoint(placement.posGroup)) {
    errors.push('.placement: posGroup must be [x, y, z] in millimetres');
  }
  if (!Number.isFinite(placement.posRotationY)) {
    errors.push(
      '.placement: posRotationY must be a number of degrees - state 0 explicitly for no rotation',
    );
  }
  if (placement.rootId !== undefined && !rootIds.has(placement.rootId)) {
    errors.push(
      ".placement: rootId must be the id of one of the group's roots",
    );
  }
  return errors;
};

const invalidPosGroups = (errors: string[]): Error =>
  new Error(
    'Invalid pos groups - nothing was loaded:\n' +
      errors.join('\n') +
      '\nFetch the payload format with the get-authoring-rules tool.',
  );

const PARTNER_VECTOR: Record<string, string> = {
  LeftBottom: 'RightBottom',
  RightBottom: 'LeftBottom',
  LeftTop: 'LeftBottom',
  RightTop: 'RightBottom',
  BackBottom: 'BackBottom',
  BackTop: 'BackBottom',
};

const CONTACT_TOLERANCE_MM = 5;

interface GroupContact {
  group: any;
  root: any;
}

// The existing group whose footprint the placed footprint touches or
// overlaps, with the root of that group nearest to the placed footprint.
const findGroupContact = (
  placedCorners: [number, number][],
  groups: any[],
  excludedGroupIds: Set<string>,
): GroupContact | undefined => {
  const center: [number, number] = [
    placedCorners.reduce((sum, [x]) => sum + x, 0) / placedCorners.length,
    placedCorners.reduce((sum, [, z]) => sum + z, 0) / placedCorners.length,
  ];
  for (const group of groups) {
    if (excludedGroupIds.has(group.id)) {
      continue;
    }
    const footprint = groupFootprint(group);
    if (
      !footprint ||
      !convexPolygonsTouch(
        placedCorners,
        footprintCornersInRoom(footprint, group),
        CONTACT_TOLERANCE_MM,
      )
    ) {
      continue;
    }
    let nearestRoot: any;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const root of group.roots ?? []) {
      if (isGeneratedRoot(root)) {
        continue;
      }
      for (const [x, z] of rootFootprintInRoom(group, root)) {
        const distance = Math.hypot(x - center[0], z - center[1]);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestRoot = root;
        }
      }
    }
    return { group, root: nearestRoot ?? group.roots?.[0] };
  }
  return undefined;
};

// The free docking vectors are the ones get-plan-context shows for that root.
const contactError = (
  what: string,
  contact: GroupContact,
  shapedGroups: any[],
): string => {
  const free: string[] =
    shapedGroups
      .find((group) => group.id === contact.group.id)
      ?.roots?.find((root: any) => root.id === contact.root.id)
      ?.freeDockingVectors ?? [];
  const sideVector = free.find(
    (name) => name.endsWith('Bottom') && !name.includes('Back'),
  );
  const example = sideVector
    ? ` - e.g. on root '${contact.root.id}': { "ownDockingVector": "${sideVector}", "dockedRoots": [{ "id": "<new root>", "dockingVector": "${PARTNER_VECTOR[sideVector]}", "mode": "StartStart", "offset": [0, 0, 0] }] }`
    : '';
  return (
    `${what} would meet group '${contact.group.id}' (root '${contact.root.id}', article ${contact.root.articleId}; ` +
    `free docking vectors: ${free.join(', ') || 'none'}). Units next to an existing group are roots of that group: ` +
    `take group '${contact.group.id}' from get-plan-context, add the new roots docked to a free vector of the root they ` +
    `continue${example}, and resubmit it with its id. A new group with a placement is only for a free stretch of wall.`
  );
};

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
  placedIn: 'corner' | 'wall';
}

const isWallSide = (
  alignment: WallAlignment | undefined,
): alignment is WallSide =>
  alignment !== undefined && WALL_SIDES.includes(alignment);

const resolveWall = (rooms: any[], spec: WallPlacementSpec): ResolvedWall => {
  const roomIndex = spec.roomIndex ?? 0;
  const room = rooms[roomIndex];
  if (!room) {
    throw new Error(
      `Room index ${roomIndex} not found - the plan has ${rooms.length} room(s).`,
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
        (candidate) =>
          candidate.side === spec.wall && candidate.type === 'wall',
      )
      .sort((a, b) => b.lengthMm - a.lengthMm)[0];
  }
  if (!wall) {
    throw new Error(
      `Wall '${spec.wall}' not found. Pass a side label (left/right/top/bottom) or a wall index. ` +
        'Available walls: ' +
        JSON.stringify(walls),
    );
  }
  // fails early on an alignment that runs parallel to the wall
  resolveWallAlignment(wall, spec.alignment ?? 'center');
  return { wall, walls };
};

// A corner article is placed by its corner point when the alignment names the
// adjoining wall; every other group is placed by its footprint. The wall
// arithmetic works on the floor, so the group keeps its height (a group of
// wall units only stays at its mounting height).
const placeGroupAtWall = (
  group: any,
  { wall, walls }: ResolvedWall,
  spec: WallPlacementSpec,
): GroupPlacement => {
  const footprint = groupFootprint(group);
  if (!footprint) {
    throw new Error(
      `Group '${group.id}' has no geometry to derive a footprint from.`,
    );
  }
  const alignment = spec.alignment ?? 'center';
  const offsetMm = spec.offsetMm ?? 0;
  const height = group.pos?.[1] ?? 0;
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
          placedIn: 'corner',
        };
      }
    }
  }
  const {
    pos: [x, , z],
    rotationY,
  } = placeAgainstWall(wall, footprint, alignment, offsetMm);
  return { pos: [x, height, z], rotationY, footprint, placedIn: 'wall' };
};

export const toolExecutors: Record<string, ToolExecutor> = {
  // The plan context arrives agent-ready from the planner API (compacted
// sections, 3D room contours with derived walls); the executor passes it
// through with the articles' cornerArticle flag completed and without their
// corner points, which only the server uses.
  'get-plan-context': async (roomDesignerApi, args) => {
    const requested =
      Array.isArray(args.include) && args.include.length > 0
        ? (args.include as PlanContextSection[])
        : DEFAULT_SECTIONS;
    const context =
      await roomDesignerApi.extended.getExternalObjectPlanContext(requested);
    if (!Array.isArray(context?.articles)) {
      return context;
    }
    const articles = context.articles as any[];
    return {
      ...context,
      articles: articles.map((article) => agentFacingArticle(article, articles)),
    };
  },

  'find-attributes': async (roomDesignerApi, args) => {
    const needle = String(args.text ?? '')
      .trim()
      .toLowerCase();
    if (needle.length === 0) {
      throw new Error('text must not be empty.');
    }
    const libraryId = args.libraryId as string | undefined;
    const context = await roomDesignerApi.extended.getExternalObjectPlanContext(
      ['masterData'],
    );
    const matches: any[] = [];
    for (const [id, masterData] of Object.entries(
      (context.masterData ?? {}) as Record<string, any>,
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
              (module.attributes ?? []).includes(attribute.id),
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

  'create-or-replace-groups': async (roomDesignerApi, args) => {
    const posGroups = args.posGroups as any[];
    const validationErrors: string[] = [];
    posGroups.forEach((group, groupIndex) => {
      if (!Array.isArray(group?.roots) || group.roots.length === 0) {
        validationErrors.push(
          `posGroups[${groupIndex}]: needs a non-empty roots array`,
        );
        return;
      }
      // the library regenerates its generated roots (worktop, toe kick)
      group.roots = group.roots.filter((root: any) => !isGeneratedRoot(root));
      if (group.roots.length === 0) {
        validationErrors.push(
          `posGroups[${groupIndex}]: needs at least one article root (generated roots are dropped)`,
        );
        return;
      }
      if (group.pos !== undefined || group.rotationY !== undefined) {
        validationErrors.push(
          `posGroups[${groupIndex}]: do not set pos/rotationY on a group - position a new group with placement`,
        );
      }
      const rootIds = new Set<string>();
      group.roots.forEach((root: any, rootIndex: number) => {
        for (const field of ['id', 'articleId']) {
          const value = root?.[field];
          if (typeof value !== 'string' || value.length === 0) {
            validationErrors.push(
              `posGroups[${groupIndex}].roots[${rootIndex}]: ${field} must be a non-empty string` +
                (field === 'articleId'
                  ? ' (an article id from the catalog)'
                  : ''),
            );
          }
        }
        if (root?.articlePos !== undefined || root?.rotationY !== undefined) {
          validationErrors.push(
            `posGroups[${groupIndex}].roots[${rootIndex}]: a root module carries no articlePos/rotationY - ` +
              'root positions come from the docking (contextData) only, the group position from placement',
          );
        }
        const rootId = root?.id;
        if (typeof rootId === 'string' && rootId.length > 0) {
          if (rootIds.has(rootId)) {
            validationErrors.push(
              `posGroups[${groupIndex}].roots[${rootIndex}]: duplicate root id '${rootId}' - every root id must be unique within its group`,
            );
          }
          rootIds.add(rootId);
        }
      });
      if (group.roots.length > 1) {
        const dockedRootIds = new Set<string>();
        for (const root of group.roots) {
          for (const dockedContext of root?.contextData?.dockedRoots ?? []) {
            if (dockedContext?.dockedRoots?.length) {
              dockedRootIds.add(root.id);
            }
            for (const dockedRoot of dockedContext?.dockedRoots ?? []) {
              dockedRootIds.add(dockedRoot?.id);
            }
          }
        }
        const undockedRoots = group.roots.filter(
          (root: any) => !dockedRootIds.has(root.id),
        );
        const undockedLimit = dockedRootIds.size === 0 ? 1 : 0;
        if (undockedRoots.length > undockedLimit) {
          const ids = undockedRoots.map((root: any) => `'${root.id}'`);
          validationErrors.push(
            `posGroups[${groupIndex}]: roots ${ids.join(', ')} are not related by docking - ` +
              'undocked roots all land at the same spot and look like a single unit. Dock every ' +
              'additional root to a placed root by listing it on that root, e.g. to place root B directly right of root A: ' +
              '{ "id": "A", "articleId": "...", "contextData": { "dockedRoots": [{ "ownDockingVector": "RightBottom", ' +
              '"dockedRoots": [{ "id": "B", "dockingVector": "LeftBottom", "mode": "StartStart", ' +
              '"offset": [0, 0, 0] }] }] } }',
          );
        }
      }
      if (group.repositioningData !== undefined) {
        validationErrors.push(
          `posGroups[${groupIndex}]: repositioningData is not supported - position the group with ` +
            'placement { posGroup, posRotationY }',
        );
      }
      if (group.placement !== undefined) {
        validationErrors.push(
          ...placementErrors(group.placement, rootIds).map(
            (error) => `posGroups[${groupIndex}]${error}`,
          ),
        );
      }
    });
    if (validationErrors.length > 0) {
      throw invalidPosGroups(validationErrors);
    }
    for (const group of posGroups) {
      group.roots = group.roots.map(toArticlePick);
    }
    const catalog =
      await roomDesignerApi.extended.getExternalObjectPlanContext(['articles']);
    const articles = (catalog.articles ?? []) as any[];
    validateArticlePickIds(articles, posGroups);

    const preContext =
      await roomDesignerApi.extended.getExternalObjectPlanContext(['groups']);
    const beforeGroupIds = new Set(
      ((preContext.groups ?? []) as any[]).map((group) => group.id),
    );
    // a placement on a group in the plan would move it on the replace
    const existingGroupErrors = posGroups.flatMap((group, groupIndex) =>
      group.placement !== undefined && beforeGroupIds.has(group.id)
        ? [
            `posGroups[${groupIndex}]: placement positions a new group only - group '${group.id}' is ` +
              'already in the plan; resubmit it without placement to keep its position, or move it ' +
              'with place-group',
          ]
        : [],
    );
    if (existingGroupErrors.length > 0) {
      throw invalidPosGroups(existingGroupErrors);
    }
    // The corner point of a corner article - its origin offset - comes from
    // the docking vectors of a calculated root of that article: in the plan
    // (the planner's raw groups), learned earlier, or calculated by a probe.
    const cornerAnchors = posGroups.flatMap((group, groupIndex) => {
      if (
        group.placement === undefined ||
        !group.roots.some((root: any) => isCornerArticle(articles, root))
      ) {
        return [];
      }
      const anchor = anchorRootOf(group.roots, group.placement, articles);
      return isCornerArticle(articles, anchor)
        ? [{ anchor, libraryId: group.libraryId as string | undefined, groupIndex }]
        : [];
    });
    if (cornerAnchors.length > 0) {
      const planGroups = ((await roomDesignerApi.extended.getExternalObjectGroups()) ??
        []) as any[];
      learnCornerPoints(cornerPointsByArticle(planGroups));
      const planGroupIds = new Set(planGroups.map((group) => group.id));
      const probed = new Set<string>();
      for (const { anchor, libraryId, groupIndex } of cornerAnchors) {
        if (
          cornerPointFor(articles, anchor, knownCornerPoints) ||
          probed.has(anchor.articleId)
        ) {
          continue;
        }
        probed.add(anchor.articleId);
        // a corner group without its corner geometry would stand off the corner
        if (!(await probeCornerPoint(roomDesignerApi, anchor, libraryId, planGroupIds))) {
          throw new Error(
            `Nothing was loaded: the corner article '${anchor.articleId}' of posGroups[${groupIndex}] ` +
              'could not be calculated to position the group - check its articleId, libraryId and attributes.',
          );
        }
        const moduleId = moduleIdOf(articles, anchor);
        if (moduleId) {
          probed.add(moduleId);
        }
      }
    }
    const cornerPoints = knownCornerPoints;
    // Only article picks and the repositioning derived from the placement
    // reach the planner.
    for (const group of posGroups) {
      if (group.placement !== undefined) {
        group.repositioningData = toRepositioningData(
          group.roots,
          group.placement,
          articles,
          cornerPoints,
        );
      }
      for (const field of Object.keys(group)) {
        if (
          !['id', 'libraryId', 'roots', 'repositioningData'].includes(field)
        ) {
          delete group[field];
        }
      }
    }

    const loaded = await roomDesignerApi.extended.loadExternalObjectGroupLayout(
      { posGroups },
      'posGroups',
      // 'adjusted' makes the planner re-apply the group pos/rotationY when a
      // group is replaced; without it a replace keeps the old position.
      { reason: 'adjusted' },
    );
    if (!loaded || loaded.length === 0) {
      throw new Error(
        'No groups were created or replaced. Check that each root module name is a master-data ' +
          'module id and the articleId comes from the article catalog (see get-plan-context), ' +
          'and that the payload follows the rules returned by get-authoring-rules.',
      );
    }
    const context = await roomDesignerApi.extended.getExternalObjectPlanContext(
      ['groups'],
    );

    const groups = context.groups;
    const replacedInputIds = new Set(
      posGroups
        .map((group) => group.id)
        .filter((id) => id && beforeGroupIds.has(id)),
    );
    const unpositionedGroupIds = (groups ?? [])
      .filter(
        (group: any) =>
          group.position.pos === undefined &&
          (!beforeGroupIds.has(group.id) || replacedInputIds.has(group.id)),
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
    };
  },

  'place-group': async (roomDesignerApi, args) => {
    const groupId = args.groupId as string;
    const spec: WallPlacementSpec = {
      wall: args.wall as string | number,
      alignment: (args.alignment as WallAlignment | undefined) ?? 'center',
      offsetMm: (args.offsetMm as number | undefined) ?? 0,
      roomIndex: (args.roomIndex as number | undefined) ?? 0,
    };
    const context = await roomDesignerApi.extended.getExternalObjectPlanContext(
      ['rooms', 'groups'],
    );
    const groups = (context.groups ?? []) as any[];
    const group = findGroup(groups, groupId);
    const rooms = ((context.rooms as any)?.rooms ?? []) as any[];
    const resolved = resolveWall(rooms, spec);
    // the placement math needs the calculated group with its geometry; the
    // plan context returns the groups compacted
    const rawGroups =
      ((await roomDesignerApi.extended.getExternalObjectGroups()) ?? []) as any[];
    const rawGroup = rawGroups.find((candidate) => candidate.id === group.id);
    if (!rawGroup) {
      throw new Error(`Group '${groupId}' has no calculated geometry to place.`);
    }
    const placement = placeGroupAtWall(rawGroup, resolved, spec);
    const contact = findGroupContact(
      footprintCornersInRoom(placement.footprint, placement),
      rawGroups,
      new Set([group.id]),
    );
    if (contact) {
      throw new Error(
        'Placement rejected - the group was not moved: ' +
          contactError(
            `Group '${group.id}' placed at the ${resolved.wall.side} wall`,
            contact,
            groups,
          ),
      );
    }
    const loaded = await roomDesignerApi.extended.loadExternalObjectGroupLayout(
      { posGroups: [repositionedGroup(rawGroup, placement)] },
      'posGroups',
      { reason: 'adjusted' },
    );
    if (!loaded || loaded.length === 0) {
      throw new Error(
        `Group '${groupId}' could not be reloaded at the new position.`,
      );
    }
    const after = await roomDesignerApi.extended.getExternalObjectPlanContext([
      'groups',
    ]);
    return {
      placedIn: placement.placedIn,
      wall: resolved.wall,
      group: ((after.groups ?? []) as any[]).find(
        (candidate) => candidate.id === group.id,
      ),
    };
  },

  // The group commands run in the planner (externalObjectGroupOperation); the
  // executors resolve group id prefixes and check article ids against the
  // catalog first, so the agent gets the lists of valid ids on a mistake.
  'change-module-attribute': async (roomDesignerApi, args) =>
    roomDesignerApi.extended.externalObjectGroupOperation(
      'change-module-attribute',
      {
        rootModuleId: args.rootModuleId,
        moduleId: args.moduleId ?? null,
        attributeId: args.attributeId,
        value: args.value,
      },
    ),

  'change-group-attribute': async (roomDesignerApi, args) => {
    const group = findGroup(
      await planGroups(roomDesignerApi),
      args.groupId as string,
    );
    return roomDesignerApi.extended.externalObjectGroupOperation(
      'change-group-attribute',
      { groupId: group.id, attributeId: args.attributeId, value: args.value },
    );
  },

  'delete-group': async (roomDesignerApi, args) => {
    const group = findGroup(
      await planGroups(roomDesignerApi),
      args.groupId as string,
    );
    return roomDesignerApi.extended.externalObjectGroupOperation(
      'delete-group',
      { groupId: group.id },
    );
  },

  'delete-root-module': async (roomDesignerApi, args) =>
    roomDesignerApi.extended.externalObjectGroupOperation(
      'delete-root-module',
      { rootModuleId: args.rootModuleId },
    ),

  'merge-article-into-group': async (roomDesignerApi, args) => {
    const context = await roomDesignerApi.extended.getExternalObjectPlanContext(
      ['groups', 'articles'],
    );
    const group = findGroup(context.groups ?? [], args.groupId as string);
    requireCatalogArticle(context.articles ?? [], {
      articleId: args.articleId,
    });
    return roomDesignerApi.extended.externalObjectGroupOperation(
      'merge-article-into-group',
      {
        groupId: group.id,
        articleId: args.articleId,
        ...(args.attributes !== undefined && { attributes: args.attributes }),
        dockTo: args.dockTo,
      },
    );
  },

  'exchange-root-module': async (roomDesignerApi, args) => {
    const context = await roomDesignerApi.extended.getExternalObjectPlanContext(
      ['groups', 'articles'],
    );
    const group = findGroup(context.groups ?? [], args.groupId as string);
    requireCatalogArticle(context.articles ?? [], {
      articleId: args.articleId,
    });
    return roomDesignerApi.extended.externalObjectGroupOperation(
      'exchange-root-module',
      {
        groupId: group.id,
        rootModuleId: args.rootModuleId,
        articleId: args.articleId,
      },
    );
  },

  'merge-groups': async (roomDesignerApi, args) => {
    const groups = await planGroups(roomDesignerApi);
    return roomDesignerApi.extended.externalObjectGroupOperation(
      'merge-groups',
      {
        targetGroupId: findGroup(groups, args.targetGroupId as string).id,
        groupIds: (args.groupIds as string[]).map(
          (groupId) => findGroup(groups, groupId).id,
        ),
      },
    );
  },

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
