import type { RoomDesignerApiType } from './types';
import {
  adjoiningWall,
  convexPolygonsTouch,
  deriveWalls,
  footprintCornersInRoom,
  groupCornerGeometry,
  groupFootprint,
  isCornerDockingVector,
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

export type ToolExecutor = (
  roomDesignerApi: RoomDesignerApiType,
  args: Record<string, unknown>,
) => Promise<unknown>;

type PlanContextSection = 'masterData' | 'rooms' | 'articles' | 'groups';

const DEFAULT_SECTIONS: PlanContextSection[] = ['rooms', 'articles', 'groups'];

const MAX_ATTRIBUTE_MATCHES = 20;

const isRootModule = (module: any): boolean =>
  module?.isRoot === true || module?.moduleType === 'RootModule';

const isCustomerFacingAttribute = (attribute: any): boolean =>
  attribute?.isMain === true || attribute?.userRight === 'Simple';

const compactSelection = (selection: any) => {
  const compact = { ...selection };
  delete compact.imageUrl;
  if (compact.desc === compact.name) {
    delete compact.desc;
  }
  return compact;
};

const compactAttribute = (attribute: any) => ({
  id: attribute.id,
  name: attribute.name,
  desc: attribute.desc,
  type: attribute.type,
  group: attribute.group,
  selections: attribute.selections?.map(compactSelection),
});

// The root modules and the attributes a customer sees (isMain or userRight
// Simple). Everything else stays reachable through find-attributes.
const compactMasterData = (masterData: any) => {
  const rootModules = (masterData?.modules ?? []).filter(isRootModule);
  const assignedAttributeIds = new Set<string>(
    rootModules.flatMap((module: any) => module.assignedAttributes ?? []),
  );
  const attributes = (masterData?.attributes ?? []).filter(
    (attribute: any) =>
      assignedAttributeIds.has(attribute.id) &&
      isCustomerFacingAttribute(attribute),
  );
  const attributeIds = new Set<string>(
    attributes.map((attribute: any) => attribute.id),
  );
  return {
    libraryId: masterData?.libraryId,
    modules: rootModules.map((module: any) => ({
      id: module.id,
      name: module.name,
      desc: module.desc,
      attributes: (module.assignedAttributes ?? []).filter((id: string) =>
        attributeIds.has(id),
      ),
    })),
    attributes: attributes.map(compactAttribute),
  };
};

const dockingVectorNames = (root: any): string[] =>
  (root?.dockInfos ?? [])
    .map((dockInfo: any) => dockInfo.id)
    .filter((id: string) => id !== 'CollisionBox');

const isGeneratedRoot = (root: any): boolean => root?.isGenerated === true;

// The docking vectors of a root that no contextData entry uses - derived from
// the docking, not from geometry.
const freeDockingVectors = (root: any): string[] => {
  const used = new Set<string>(
    (root?.contextData?.dockedRoots ?? [])
      .filter((dockedContext: any) => dockedContext?.dockedRoots?.length)
      .map((dockedContext: any) => dockedContext.ownDockingVector),
  );
  return dockingVectorNames(root).filter((name) => !used.has(name));
};

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

const contactError = (what: string, contact: GroupContact): string => {
  const free = freeDockingVectors(contact.root);
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

// The docking vectors of the calculated roots in the plan by article id - the
// fallback for an article template that does not carry its own.
const calculatedDockingVectorsByArticle = (
  groups: any[],
): Map<string, string[]> => {
  const byArticle = new Map<string, string[]>();
  for (const group of groups) {
    for (const root of group.roots ?? []) {
      const names = dockingVectorNames(root);
      if (
        root.articleId &&
        names.length > 0 &&
        !byArticle.has(root.articleId)
      ) {
        byArticle.set(root.articleId, names);
      }
    }
  }
  return byArticle;
};

const compactArticle = (
  article: any,
  masterData: any,
  calculatedDockingVectors: Map<string, string[]>,
) => {
  const attributeInfos = new Map<string, any>(
    (masterData?.attributes ?? []).map((attribute: any) => [
      attribute.id,
      attribute,
    ]),
  );
  const moduleInfos = new Map<string, any>(
    (masterData?.modules ?? []).map((module: any) => [module.id, module]),
  );
  const namedValue = (attribute: any) => ({
    id: attribute.id,
    name: attributeInfos.get(attribute.id).name,
    value: attribute.value,
  });
  const rootModules = (article.roots ?? []).map((root: any) => {
    const moduleInfo = moduleInfos.get(root.name);
    const attributes = (root.attributes ?? []).filter((attribute: any) =>
      attributeInfos.has(attribute.id),
    );
    const dimensions = attributes.filter(
      (attribute: any) => attributeInfos.get(attribute.id).type === 'Dim',
    );
    const dimensionIds = new Set<string>(
      dimensions.map((attribute: any) => attribute.id),
    );
    const templateVectors = dockingVectorNames(root);
    return {
      module: {
        id: root.name,
        name: moduleInfo?.name,
        desc: moduleInfo?.desc,
      },
      dimensions: dimensions.map(namedValue),
      mainAttributes: attributes
        .filter(
          (attribute: any) =>
            attributeInfos.get(attribute.id).isMain === true &&
            !dimensionIds.has(attribute.id),
        )
        .map(namedValue),
      dockingVectors:
        templateVectors.length > 0
          ? templateVectors
          : calculatedDockingVectors.get(article.articleId) ?? [],
      insertLevels: root.insertLevelInfos,
      subModules: (root.modules ?? []).map((module: any) => ({
        id: module.name,
        name: moduleInfos.get(module.name)?.name ?? module.name,
      })),
    };
  });
  return {
    articleId: article.articleId,
    articleName: article.articleName,
    desc: article.desc,
    imageUrl: article.imageUrl,
    category: article.category,
    libraryId: article.libraryId,
    catalog: article.catalog,
    cornerArticle: rootModules.some((rootModule: any) =>
      rootModule.dockingVectors.some(isCornerDockingVector),
    ),
    rootModules,
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

// A root as the agent sees it: the article pick it can resubmit (id,
// articleId, input attributes, docking) plus read-only facts. No positions,
// no geometry.
const shapeRoot = (root: any) => ({
  id: root.id,
  articleId: root.articleId,
  articleName: root.articleName,
  desc: root.desc,
  category: root.category,
  ...(isGeneratedRoot(root) && { isGenerated: true }),
  attributes: (root.attributes ?? [])
    .filter((attribute: any) => attribute.isInput === true)
    .map((attribute: any) => ({ id: attribute.id, value: attribute.value })),
  ...(root.contextData && {
    contextData: stripDockingIndices(root.contextData),
  }),
  dockingVectors: dockingVectorNames(root),
  freeDockingVectors: freeDockingVectors(root),
  subModules: (root.modules ?? []).map((module: any) => module.name),
  ...(root.logMessages?.length && { logMessages: root.logMessages }),
});

// A group as the agent sees it: resubmittable as it is (the read-only
// position block and the generated roots are dropped on the way back).
const shapeGroup = (group: any) => ({
  id: group.id,
  libraryId: group.libraryId,
  position: {
    pos: group.pos,
    rotationY: group.rotationY,
    footprint: groupFootprint(group),
  },
  ...(group.attributes && { attributes: group.attributes }),
  roots: (group.roots ?? []).map(shapeRoot),
  logMessages: group.logMessages ?? [],
});

const shapeRooms = (rooms: any) => {
  if (!rooms) {
    return rooms;
  }
  return {
    ...rooms,
    rooms: (rooms.rooms ?? []).map((room: any) => ({
      ...room,
      walls: deriveWalls(room),
    })),
  };
};

const isArticlePickOnly = (root: any): boolean =>
  !root?.posData && !root?.modules && !root?.parts;

// A root authored by the agent is just an article pick (id, articleId,
// optional attribute overrides and docking contextData). The glue logic
// completes it from the article template; here the article id is validated
// against the catalog so the agent gets a helpful error instead of a
// half-calculated group.
const validateArticlePickIds = async (
  roomDesignerApi: RoomDesignerApiType,
  posGroups: any[],
): Promise<void> => {
  const articlePicks = posGroups.flatMap((group) =>
    (group?.roots ?? []).filter(isArticlePickOnly),
  );
  if (articlePicks.length === 0) {
    return;
  }
  const context = await roomDesignerApi.extended.getExternalObjectPlanContext([
    'articles',
  ]);
  const articles = (context.articles ?? []) as any[];
  for (const root of articlePicks) {
    const article = articles.find(
      (candidate) =>
        candidate.articleId === root.articleId &&
        (!root.libraryId || candidate.libraryId === root.libraryId),
    );
    if (!article) {
      const validIds = articles.map((candidate) => candidate.articleId);
      throw new Error(
        `articleId '${root.articleId}' is not in the article catalog. ` +
          `Valid article ids: ${validIds.slice(0, 100).join(', ')}`,
      );
    }
  }
};

const WALL_SIDES = ['left', 'right', 'top', 'bottom'];
const ALIGNMENTS = ['start', 'center', 'end', ...WALL_SIDES];

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
  placedBy: 'cornerPoint' | 'footprint';
  cornerRootId?: string;
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
  const walls = deriveWalls(room);
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
// adjoining wall; every other group is placed by its footprint.
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
  if (isWallSide(alignment)) {
    const corner = groupCornerGeometry(group);
    const adjoining = adjoiningWall(walls, wall, alignment);
    if (corner && adjoining) {
      const placement = placeCornerAtWalls(wall, adjoining, corner, offsetMm);
      if (placement) {
        return {
          ...placement,
          footprint,
          placedBy: 'cornerPoint',
          cornerRootId: corner.rootId,
        };
      }
    }
  }
  const placement = placeAgainstWall(wall, footprint, alignment, offsetMm);
  return { ...placement, footprint, placedBy: 'footprint' };
};

export const toolExecutors: Record<string, ToolExecutor> = {
  'get-plan-context': async (roomDesignerApi, args) => {
    const requested =
      Array.isArray(args.include) && args.include.length > 0
        ? (args.include as PlanContextSection[])
        : DEFAULT_SECTIONS;
    const sections = new Set<PlanContextSection>(requested);
    // the compact articles need the attribute types and module names of the
    // master data and the docking vectors of the calculated roots
    const fetched = new Set<PlanContextSection>(requested);
    if (sections.has('articles')) {
      fetched.add('masterData');
      fetched.add('groups');
    }
    const context = await roomDesignerApi.extended.getExternalObjectPlanContext(
      [...fetched],
    );
    const masterData = (context.masterData ?? {}) as Record<string, any>;
    const result: Record<string, unknown> = {};
    if (sections.has('masterData')) {
      result.masterData = Object.fromEntries(
        Object.entries(masterData).map(([libraryId, libraryMasterData]) => [
          libraryId,
          compactMasterData(libraryMasterData),
        ]),
      );
    }
    if (sections.has('rooms')) {
      result.rooms = shapeRooms(context.rooms);
    }
    if (sections.has('articles')) {
      const calculatedDockingVectors = calculatedDockingVectorsByArticle(
        (context.groups ?? []) as any[],
      );
      result.articles = ((context.articles ?? []) as any[]).map((article) =>
        compactArticle(
          article,
          masterData[article.libraryId],
          calculatedDockingVectors,
        ),
      );
    }
    if (sections.has('groups')) {
      result.groups = context.groups?.map(shapeGroup);
    }
    return result;
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
      const rootModules = (masterData.modules ?? []).filter(isRootModule);
      for (const attribute of masterData.attributes ?? []) {
        if (!attributeMatches(attribute, needle)) {
          continue;
        }
        matches.push({
          libraryId: id,
          ...compactAttribute(attribute),
          userRight: attribute.userRight,
          rootModules: rootModules
            .filter((module: any) =>
              (module.assignedAttributes ?? []).includes(attribute.id),
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
          `posGroups[${groupIndex}]: do not set pos/rotationY on a group - position it with placement or repositioningData`,
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
              'root positions come from the docking (contextData) only, the group position from placement or repositioningData',
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
      const placement = group.placement;
      if (placement !== undefined) {
        const wallValid =
          (typeof placement?.wall === 'string' &&
            WALL_SIDES.includes(placement.wall)) ||
          (typeof placement?.wall === 'number' &&
            Number.isInteger(placement.wall) &&
            placement.wall >= 0);
        if (!wallValid) {
          validationErrors.push(
            `posGroups[${groupIndex}].placement: wall must be a side label (${WALL_SIDES.join('/')}) or a wall index`,
          );
        }
        if (
          placement?.alignment !== undefined &&
          !ALIGNMENTS.includes(placement.alignment)
        ) {
          validationErrors.push(
            `posGroups[${groupIndex}].placement: alignment must be one of ${ALIGNMENTS.join(', ')}`,
          );
        }
      }
      if (placement !== undefined && group.repositioningData !== undefined) {
        validationErrors.push(
          `posGroups[${groupIndex}]: use either placement or repositioningData, not both`,
        );
      }
    });
    if (validationErrors.length > 0) {
      throw new Error(
        'Invalid pos groups - nothing was loaded:\n' +
          validationErrors.join('\n') +
          '\nFetch the payload format with the get-authoring-rules tool.',
      );
    }
    // Only article picks, placement and repositioningData reach the planner.
    for (const group of posGroups) {
      group.roots = group.roots.map(toArticlePick);
      for (const field of Object.keys(group)) {
        if (
          ![
            'id',
            'libraryId',
            'roots',
            'placement',
            'repositioningData',
          ].includes(field)
        ) {
          delete group[field];
        }
      }
    }
    await validateArticlePickIds(roomDesignerApi, posGroups);

    // Declarative wall placements: resolve the walls before anything is
    // loaded (so a bad wall fails the whole call), remember which input
    // groups carry one, apply them after the calculation when the footprints
    // exist. New group ids are regenerated by the planner, so created groups
    // are matched to their placements by order of appearance.
    const placementSpecs = new Map<
      number,
      { spec: WallPlacementSpec; resolved: ResolvedWall }
    >();
    const preContext =
      await roomDesignerApi.extended.getExternalObjectPlanContext([
        'rooms',
        'groups',
      ]);
    const rooms = ((preContext.rooms as any)?.rooms ?? []) as any[];
    const beforeGroupIds = new Set(
      ((preContext.groups ?? []) as any[]).map((group) => group.id),
    );
    posGroups.forEach((group, groupIndex) => {
      if (group.placement !== undefined) {
        const spec = group.placement as WallPlacementSpec;
        placementSpecs.set(groupIndex, {
          spec,
          resolved: resolveWall(rooms, spec),
        });
        delete group.placement;
      }
    });

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
    let context = await roomDesignerApi.extended.getExternalObjectPlanContext([
      'groups',
    ]);

    const placements: any[] = [];
    if (placementSpecs.size > 0) {
      const afterGroups = (context.groups ?? []) as any[];
      const newGroupIds = afterGroups
        .map((group) => group.id)
        .filter((id) => !beforeGroupIds.has(id));
      const groupsOfThisCall = new Set<string>([
        ...newGroupIds,
        ...posGroups.map((group) => group.id).filter(Boolean),
      ]);
      const contactErrors: string[] = [];
      const placedGroups: any[] = [];
      let newGroupCursor = 0;
      posGroups.forEach((group, groupIndex) => {
        const isReplace = group.id && beforeGroupIds.has(group.id);
        const resultGroupId = isReplace
          ? group.id
          : newGroupIds[newGroupCursor++];
        const placementEntry = placementSpecs.get(groupIndex);
        if (!placementEntry) {
          return;
        }
        const resultGroup = afterGroups.find(
          (candidate) => candidate.id === resultGroupId,
        );
        if (!resultGroup) {
          return;
        }
        const placement = placeGroupAtWall(
          resultGroup,
          placementEntry.resolved,
          placementEntry.spec,
        );
        // a placement that meets another group is a docking relation
        // expressed as a position: the roots belong into that group
        const contact = findGroupContact(
          footprintCornersInRoom(placement.footprint, placement),
          afterGroups,
          groupsOfThisCall,
        );
        if (contact) {
          contactErrors.push(
            contactError(
              `posGroups[${groupIndex}] placed at the ${placementEntry.resolved.wall.side} wall`,
              contact,
            ),
          );
          return;
        }
        placedGroups.push(repositionedGroup(resultGroup, placement));
        placements.push({
          groupId: resultGroup.id,
          wall: placementEntry.resolved.wall.side,
          placedBy: placement.placedBy,
          ...(placement.cornerRootId && {
            cornerRootId: placement.cornerRootId,
          }),
        });
      });
      if (contactErrors.length > 0) {
        // nothing of this call stays: the created groups are removed again,
        // replaced groups keep their new roots but were not moved
        for (const id of newGroupIds) {
          roomDesignerApi.extended.removeExternalObject(id);
        }
        throw new Error(
          'Placement rejected - the groups created by this call were removed again' +
            (posGroups.some((group) => beforeGroupIds.has(group.id))
              ? ', replaced groups were not moved'
              : '') +
            ':\n' +
            contactErrors.join('\n'),
        );
      }
      if (placedGroups.length > 0) {
        await roomDesignerApi.extended.loadExternalObjectGroupLayout(
          { posGroups: placedGroups },
          'posGroups',
          { reason: 'adjusted' },
        );
        context = await roomDesignerApi.extended.getExternalObjectPlanContext([
          'groups',
        ]);
      }
    }

    const groups = context.groups?.map(shapeGroup);
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
      ...(placements.length > 0 && { placements }),
      ...(unpositionedGroupIds.length > 0 && {
        hint:
          `Groups ${unpositionedGroupIds.join(', ')} are not positioned yet and sit at the plan origin. ` +
          'Give the group a placement ({ wall, alignment?, offsetMm? }) in create-or-replace-groups ' +
          'or call place-group to stand it against a wall.',
      }),
    };
  },

  'place-group': async (roomDesignerApi, args) => {
    const groupId = args.groupId as string;
    const wallArg = (args.wall ?? args.wallIndex) as string | number;
    const roomIndex = (args.roomIndex as number | undefined) ?? 0;
    const alignment = (args.alignment as WallAlignment | undefined) ?? 'center';
    const offsetMm = (args.offsetMm as number | undefined) ?? 0;
    const context = await roomDesignerApi.extended.getExternalObjectPlanContext(
      ['rooms', 'groups'],
    );
    const groups = (context.groups ?? []) as any[];
    let group = groups.find((candidate) => candidate.id === groupId);
    if (!group && groupId) {
      const prefixMatches = groups.filter((candidate) =>
        candidate.id.startsWith(groupId),
      );
      if (prefixMatches.length === 1) {
        group = prefixMatches[0];
      }
    }
    if (!group) {
      const groupIds = groups.map((candidate) => candidate.id);
      throw new Error(
        `Group '${groupId}' not found. Groups in the plan: ` +
          `${groupIds.join(', ') || 'none'}.`,
      );
    }
    const rooms = ((context.rooms as any)?.rooms ?? []) as any[];
    const spec: WallPlacementSpec = {
      wall: wallArg,
      alignment,
      offsetMm,
      roomIndex,
    };
    const resolved = resolveWall(rooms, spec);
    const placement = placeGroupAtWall(group, resolved, spec);
    const contact = findGroupContact(
      footprintCornersInRoom(placement.footprint, placement),
      groups,
      new Set([group.id]),
    );
    if (contact) {
      throw new Error(
        'Placement rejected - the group was not moved: ' +
          contactError(
            `Group '${group.id}' placed at the ${resolved.wall.side} wall`,
            contact,
          ),
      );
    }
    const loaded = await roomDesignerApi.extended.loadExternalObjectGroupLayout(
      { posGroups: [repositionedGroup(group, placement)] },
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
    const resultGroup = ((after.groups ?? []) as any[]).find(
      (candidate) => candidate.id === group.id,
    );
    return {
      pos: placement.pos,
      rotationY: placement.rotationY,
      footprint: placement.footprint,
      placedBy: placement.placedBy,
      ...(placement.cornerRootId && { cornerRootId: placement.cornerRootId }),
      wall: resolved.wall,
      group: resultGroup ? shapeGroup(resultGroup) : undefined,
    };
  },

  'update-attribute': async (roomDesignerApi, args) => {
    await roomDesignerApi.extended.updateExternalObjectGroupAttribute(
      args.rootModuleId,
      args.moduleId ?? null,
      args.attributeId,
      args.value,
    );
    return { ok: true };
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
