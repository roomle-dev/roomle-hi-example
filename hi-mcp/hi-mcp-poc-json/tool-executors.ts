import {
  catalogArticleOf,
  cornerPointsByArticle,
  isCornerArticle,
  toRepositioningData,
} from './group-placement';
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

// A root authored by the agent is just an article pick (id, articleId,
// optional attribute overrides and docking contextData). The glue logic
// completes it from the article template; here the article id is validated
// against the catalog so the agent gets a helpful error instead of a
// half-calculated group.
const validateArticlePickIds = (articles: any[], posGroups: any[]): void => {
  const articlePicks = posGroups.flatMap((group) =>
    (group?.roots ?? []).filter(isArticlePickOnly),
  );
  for (const root of articlePicks) {
    if (!catalogArticleOf(articles, root)) {
      const validIds = articles.map((candidate) => candidate.articleId);
      throw new Error(
        `articleId '${root.articleId}' is not in the article catalog. ` +
          `Valid article ids: ${validIds.slice(0, 100).join(', ')}`,
      );
    }
  }
};

// The agent picks corner articles by cornerArticle; the flag is completed for
// an empty plan, and the corner point stays with the server.
const agentFacingArticle = (article: any, articles: any[]) => {
  const compact = { ...article, cornerArticle: isCornerArticle(articles, article) };
  delete compact.cornerPoint;
  return compact;
};

const PLACEMENT_FIELDS = ['posGroup', 'posRotationY', 'rootId'];

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
        unknownFields.join(', '),
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
              'already in the plan; resubmit it without placement to keep its position',
          ]
        : [],
    );
    if (existingGroupErrors.length > 0) {
      throw invalidPosGroups(existingGroupErrors);
    }
    // The corner point of a corner article - its origin offset - comes from
    // the docking vectors of a calculated root of that article in the plan,
    // which only the planner's raw groups carry.
    const cornerPoints = posGroups.some(
      (group) =>
        group.placement !== undefined &&
        group.roots.some((root: any) => isCornerArticle(articles, root)),
    )
      ? cornerPointsByArticle(
          (await roomDesignerApi.extended.getExternalObjectGroups()) as any[],
        )
      : new Map();
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
          'with - see get-authoring-rules.',
      }),
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
