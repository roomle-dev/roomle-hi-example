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

// The pairs that put a root beside or back to back with another: both
// vectors lie on the same level, so each side takes exactly one neighbour.
// Stacking pairs (Top -> Bottom) are left out - a wall unit's LeftBottom is
// legitimately claimed by the base unit below it and by the neighbour beside it.
const NEIGHBOUR_DOCKING_PAIRS: Record<string, string> = {
  RightBottom: 'LeftBottom',
  LeftBottom: 'RightBottom',
  BackBottom: 'BackBottom',
  BackTop: 'BackTop',
};

interface NeighbourConflict {
  rootId: string;
  vector: string;
  partnerIds: string[];
}

// Every beside or back-to-back joint occupies the own vector of the placed
// root and the named vector of the new root. A vector with two different
// partners means two units on the same side of one unit - they overlap.
const conflictingNeighbourJoints = (roots: any[]): NeighbourConflict[] => {
  const partnersBySlot = new Map<string, Set<string>>();
  const claim = (rootId: string, vector: string, partnerId: string) => {
    const slot = `${rootId}\u0000${vector}`;
    const partners = partnersBySlot.get(slot) ?? new Set<string>();
    partners.add(partnerId);
    partnersBySlot.set(slot, partners);
  };
  for (const root of roots) {
    for (const dockedContext of root?.contextData?.dockedRoots ?? []) {
      const ownVector = dockedContext?.ownDockingVector;
      for (const dockedRoot of dockedContext?.dockedRoots ?? []) {
        if (NEIGHBOUR_DOCKING_PAIRS[ownVector] !== dockedRoot?.dockingVector) {
          continue;
        }
        claim(root.id, ownVector, dockedRoot.id);
        claim(dockedRoot.id, dockedRoot.dockingVector, root.id);
      }
    }
  }
  return Array.from(partnersBySlot.entries())
    .filter(([, partners]) => partners.size > 1)
    .map(([slot, partners]) => {
      const [rootId, vector] = slot.split('\u0000');
      return { rootId, vector, partnerIds: Array.from(partners) };
    });
};

type FloorPoint = [number, number];

interface FloorContour {
  polygon: FloorPoint[];
  x: [number, number];
  z: [number, number];
}

// The floor contour of a room in pos space (x, z), from the level-0 contour
// of the plan context; the closing 'Z' repeats the first point and is skipped.
const floorContours = (roomsSection: any): FloorContour[] =>
  ((roomsSection?.rooms ?? []) as any[]).flatMap((room) => {
    const levels = (room?.levels ?? []) as any[];
    const contour = levels.find((level) => level.level === 0) ?? levels[0];
    const polygon: FloorPoint[] = (contour?.segments ?? [])
      .filter((segment: any) => segment.cmd !== 'Z' && segment.pos?.length >= 3)
      .map((segment: any): FloorPoint => [segment.pos[0], segment.pos[2]]);
    if (polygon.length < 3) {
      return [];
    }
    const xs = polygon.map(([x]) => x);
    const zs = polygon.map(([, z]) => z);
    return [
      {
        polygon,
        x: [Math.min(...xs), Math.max(...xs)],
        z: [Math.min(...zs), Math.max(...zs)],
      },
    ];
  });

const isInsidePolygon = ([x, z]: FloorPoint, polygon: FloorPoint[]): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
  }
  return inside;
};

const orientation = (a: FloorPoint, b: FloorPoint, c: FloorPoint): number =>
  Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));

// Proper crossing of two segments; touching endpoints and collinear overlap
// do not count, the shrunk box never touches a wall it stands flush against.
const segmentsCross = (
  a: FloorPoint,
  b: FloorPoint,
  c: FloorPoint,
  d: FloorPoint,
): boolean =>
  orientation(a, b, c) * orientation(a, b, d) < 0 &&
  orientation(c, d, a) * orientation(c, d, b) < 0;

// A flush placement puts the footprint exactly on the wall face, so the box
// is shrunk by a millimetre before it is tested.
const FOOTPRINT_TOLERANCE_MM = 1;

// The whole box must lie in the room: every corner inside the contour and no
// box edge crossing a contour edge - in a concave room a box can span two arms
// with all corners inside while its middle crosses the recessed wall.
const isFootprintInsideRoom = (
  footprint: any,
  contour: FloorContour,
): boolean => {
  const [x0, x1] = footprint.x as [number, number];
  const [z0, z1] = footprint.z as [number, number];
  const corners: FloorPoint[] = [
    [x0 + FOOTPRINT_TOLERANCE_MM, z0 + FOOTPRINT_TOLERANCE_MM],
    [x1 - FOOTPRINT_TOLERANCE_MM, z0 + FOOTPRINT_TOLERANCE_MM],
    [x1 - FOOTPRINT_TOLERANCE_MM, z1 - FOOTPRINT_TOLERANCE_MM],
    [x0 + FOOTPRINT_TOLERANCE_MM, z1 - FOOTPRINT_TOLERANCE_MM],
  ];
  if (!corners.every((corner) => isInsidePolygon(corner, contour.polygon))) {
    return false;
  }
  const { polygon } = contour;
  return corners.every((corner, index) => {
    const nextCorner = corners[(index + 1) % corners.length];
    return polygon.every(
      (point, pointIndex) =>
        !segmentsCross(
          corner,
          nextCorner,
          point,
          polygon[(pointIndex + 1) % polygon.length],
        ),
    );
  });
};

// The room the anchor stands in - it is where posGroup put it - or, when
// it stands in none, the room nearest to it.
const roomOfAnchor = (
  pos: number[],
  contours: FloorContour[],
): { contour: FloorContour; anchorInside: boolean } => {
  const anchor: FloorPoint = [pos[0], pos[2]];
  // a flush anchor lies exactly on the wall face, so a point a millimetre
  // to any diagonal side counts as inside too
  const nearAnchor: FloorPoint[] = [
    anchor,
    ...[-1, 1].flatMap((dx): FloorPoint[] =>
      [-1, 1].map((dz): FloorPoint => [
        anchor[0] + dx * FOOTPRINT_TOLERANCE_MM,
        anchor[1] + dz * FOOTPRINT_TOLERANCE_MM,
      ]),
    ),
  ];
  const containing = contours.find((contour) =>
    nearAnchor.some((point) => isInsidePolygon(point, contour.polygon)),
  );
  if (containing) {
    return { contour: containing, anchorInside: true };
  }
  const distanceToExtent = (contour: FloorContour) =>
    Math.hypot(
      Math.max(contour.x[0] - anchor[0], 0, anchor[0] - contour.x[1]),
      Math.max(contour.z[0] - anchor[1], 0, anchor[1] - contour.z[1]),
    );
  const nearest = contours.reduce((best, contour) =>
    distanceToExtent(contour) < distanceToExtent(best) ? contour : best,
  );
  return { contour: nearest, anchorInside: false };
};

const isFootprint = (footprint: any): boolean =>
  Array.isArray(footprint?.x) &&
  footprint.x.length === 2 &&
  Array.isArray(footprint?.z) &&
  footprint.z.length === 2 &&
  [...footprint.x, ...footprint.z].every(Number.isFinite);

const formatRange = ([from, to]: [number, number]) => `[${from}, ${to}]`;

// A positioned group whose footprint lies in no room. With the anchor inside
// a room, posGroup is right and a unit is docked in a direction the wall does
// not continue (typically to the anchor's LeftBottom in a corner); with the
// anchor outside every room, posGroup itself is wrong.
const outOfRoomHints = (groups: any[], contours: FloorContour[]): string[] => {
  if (contours.length === 0) {
    return [];
  }
  return groups
    .filter(
      (group) =>
        Array.isArray(group.position?.pos) &&
        group.position.pos.length >= 3 &&
        isFootprint(group.position?.footprint) &&
        !contours.some((contour) =>
          isFootprintInsideRoom(group.position.footprint, contour),
        ),
    )
    .map((group) => {
      const { pos, footprint } = group.position;
      const { contour: room, anchorInside } = roomOfAnchor(pos, contours);
      const extent =
        `Group ${group.id} extends beyond the room: footprint x ${formatRange(footprint.x)}, ` +
        `z ${formatRange(footprint.z)}, room x ${formatRange(room.x)}, z ${formatRange(room.z)}. `;
      return anchorInside
        ? extent +
            'Its anchor is where posGroup put it, so a unit is docked past a wall - with posGroup at a ' +
            "wall's end the row continues from the anchor's RightBottom only. Fix the docking and " +
            'resubmit the group with its id; see get-authoring-rules.'
        : extent +
            `Its anchor at pos [${pos.join(', ')}] stands in no room, so posGroup is wrong - ` +
            'take it from the walls of that room and resubmit the group with its id and a new ' +
            'repositioningData; see get-authoring-rules.';
    });
};

// A root authored by the agent is just an article pick (id, articleId,
// optional attribute overrides and docking contextData). The glue logic
// completes it from the article template; here the article id is validated
// against the catalog so the agent gets a helpful error instead of a
// half-calculated group.
const validateArticlePickIds = async (
  roomDesignerApi: PlannerApi,
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

export const toolExecutors: Record<string, ToolExecutor> = {
  // The plan context arrives agent-ready from the planner API (compacted
// sections, 3D room contours with derived walls); the executor is a
// pass-through.
  'get-plan-context': async (roomDesignerApi, args) => {
    const requested =
      Array.isArray(args.include) && args.include.length > 0
        ? (args.include as PlanContextSection[])
        : DEFAULT_SECTIONS;
    return roomDesignerApi.extended.getExternalObjectPlanContext(requested);
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
          `posGroups[${groupIndex}]: do not set pos/rotationY on a group - position it with repositioningData`,
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
              'root positions come from the docking (contextData) only, the group position from repositioningData',
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
        for (const conflict of conflictingNeighbourJoints(group.roots)) {
          const partners = conflict.partnerIds.map((id) => `'${id}'`);
          validationErrors.push(
            `posGroups[${groupIndex}]: root '${conflict.rootId}' ${conflict.vector} is docked to both ` +
              `${partners.join(' and ')} - a side takes one neighbour, two units there overlap. ` +
              'Chain the row instead (A lists B on its RightBottom, B lists C on its RightBottom, ...); ' +
              "a row from a corner continues from the anchor's RightBottom only.",
          );
        }
      }
      if (group.placement !== undefined) {
        validationErrors.push(
          `posGroups[${groupIndex}]: placement is not supported - position the group with ` +
            'repositioningData { posGroup, posRotationY, rootId }',
        );
      }
      if (group.repositioningData !== undefined) {
        const { posGroup, posRotationY, rootId, rootRelPos } =
          group.repositioningData ?? {};
        if (
          !Array.isArray(posGroup) ||
          posGroup.length !== 3 ||
          !posGroup.every(Number.isFinite)
        ) {
          validationErrors.push(
            `posGroups[${groupIndex}].repositioningData: posGroup must be [x, y, z] in millimetres`,
          );
        }
        if (!Number.isFinite(posRotationY)) {
          validationErrors.push(
            `posGroups[${groupIndex}].repositioningData: posRotationY must be a number of degrees - state 0 explicitly for no rotation`,
          );
        }
        if (
          rootRelPos !== undefined &&
          (!Array.isArray(rootRelPos) ||
            rootRelPos.length !== 3 ||
            !rootRelPos.every(Number.isFinite))
        ) {
          validationErrors.push(
            `posGroups[${groupIndex}].repositioningData: rootRelPos must be [x, y, z] in millimetres ` +
              "- the negated cornerPoint of the anchor's article",
          );
        }
        if (!rootIds.has(rootId)) {
          validationErrors.push(
            `posGroups[${groupIndex}].repositioningData: rootId must be the id of one of the group's roots ` +
              '- the anchor root the docking starts from',
          );
        }
      }
    });
    if (validationErrors.length > 0) {
      throw new Error(
        'Invalid pos groups - nothing was loaded:\n' +
          validationErrors.join('\n') +
          '\nFetch the payload format with the get-authoring-rules tool.',
      );
    }
    // Only article picks and repositioningData reach the planner.
    for (const group of posGroups) {
      group.roots = group.roots.map(toArticlePick);
      for (const field of Object.keys(group)) {
        if (
          !['id', 'libraryId', 'roots', 'repositioningData'].includes(field)
        ) {
          delete group[field];
        }
      }
    }
    await validateArticlePickIds(roomDesignerApi, posGroups);

    const preContext = await roomDesignerApi.extended.getExternalObjectPlanContext(
      ['rooms', 'groups'],
    );
    const beforeGroupIds = new Set(
      ((preContext.groups ?? []) as any[]).map((group) => group.id),
    );

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
    const affectedGroups = ((groups ?? []) as any[]).filter(
      (group) =>
        !beforeGroupIds.has(group.id) || replacedInputIds.has(group.id),
    );
    const unpositionedGroupIds = affectedGroups
      .filter((group) => group.position.pos === undefined)
      .map((group) => group.id);
    const hints = [
      ...(unpositionedGroupIds.length > 0
        ? [
            `Groups ${unpositionedGroupIds.join(', ')} are not positioned yet and sit at the plan origin. ` +
              'Resubmit them with their id and repositioningData ({ posGroup, posRotationY, rootId }) - ' +
              'see get-authoring-rules.',
          ]
        : []),
      ...outOfRoomHints(affectedGroups, floorContours(preContext.rooms)),
    ];
    return {
      loaded,
      groups,
      ...(hints.length > 0 && { hint: hints.join('\n') }),
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
