import {
  agentFacingArticle,
  agentFacingAttributes,
  agentFacingObstacles,
  agentFacingRooms,
  withSharedSelectionsOnce,
} from './agent-facing';
import { planHistory } from './plan-history';
import type { ToolCallRecord } from './plan-history';
import type { PlannerApi } from './planner-api';
import { readSkillFile, skills } from './skills';

export type ToolExecutor = (
  roomDesignerApi: PlannerApi,
  args: Record<string, unknown>
) => Promise<unknown>;

type PlanContextSection =
  | 'masterData'
  | 'rooms'
  | 'articles'
  | 'groups'
  | 'obstacles'
  | 'installationElements';

const PLAN_CONTEXT_SECTIONS: unknown[] = [
  'masterData',
  'rooms',
  'articles',
  'groups',
  'obstacles',
  'installationElements',
];

// The sections of the server: the full descriptions of the catalog's
// articles, and the attribute vocabulary, both derived from the planner's
// sections.
const ARTICLE_DESCRIPTIONS = 'articleDescriptions';
const ATTRIBUTES = 'attributes';
const SERVER_SECTIONS: unknown[] = [ARTICLE_DESCRIPTIONS, ATTRIBUTES];

const DEFAULT_SECTIONS: unknown[] = [
  'rooms',
  'articles',
  ATTRIBUTES,
  'groups',
  'obstacles',
  'installationElements',
];

const MAX_ATTRIBUTE_MATCHES = 20;

// The library spells one way, the agent often the other: both read alike.
const SPELLINGS: [RegExp, string][] = [
  [/colour/g, 'color'],
  [/grey/g, 'gray'],
  [/worktop/g, 'countertop'],
];

const searchable = (text: string): string =>
  SPELLINGS.reduce(
    (normalized, [spelling, as]) => normalized.replace(spelling, as),
    text.toLowerCase()
  );

const searchWords = (text: string): string[] =>
  searchable(text)
    .split(/[\s,;()-]+/)
    .filter((word) => word.length > 0);

// Every word is in one of the attribute's fields.
const attributeMatches = (attribute: any, words: string[]): boolean => {
  const fields = [
    attribute.id,
    attribute.name,
    attribute.desc,
    attribute.group,
    ...(attribute.selections ?? []).flatMap((selection: any) => [
      selection.name,
      selection.desc,
      selection.value,
    ]),
  ]
    .filter((value) => value !== undefined && value !== null)
    .map((value) => searchable(String(value)));
  return words.every((word) => fields.some((field) => field.includes(word)));
};

const rootsOfGroups = (groups: any[]): any[] =>
  groups.flatMap((group) => (group?.roots ?? []) as any[]);

const planGroups = async (roomDesignerApi: PlannerApi): Promise<any[]> =>
  ((await roomDesignerApi.extended.getExternalObjectPlanContext(['groups']))
    .groups ?? []) as any[];

const isObject = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// The tool calls that change the plan run one after another: the record of a
// call for undo compares the plan before and after it, and the page runs every
// planner call it receives at once, so a concurrent call would mix into the
// record. get-plan-context waits as well, so that it never reads a plan
// halfway through a change.
let planChanges: Promise<unknown> = Promise.resolve();

const oneAtATime =
  (executor: ToolExecutor): ToolExecutor =>
  (roomDesignerApi, args) => {
    const run = planChanges.then(() => executor(roomDesignerApi, args));
    planChanges = run.catch(() => undefined);
    return run;
  };

// A planner undo or redo is confirmed by its history event.
const HISTORY_EVENT_WAIT_MS = 1000;

const roundedToTenthMm = (_key: string, value: unknown) =>
  typeof value === 'number' ? Math.round(value * 10) / 10 : value;

// The plan's groups as a comparison key, sorted by id - an undo restores them
// to the tenth of a millimetre.
const groupsKey = (groups: unknown): string =>
  JSON.stringify(
    [...((groups ?? []) as any[])].sort((a, b) =>
      String(a?.id).localeCompare(String(b?.id))
    ),
    roundedToTenthMm
  );

const readGroupsKey = async (roomDesignerApi: PlannerApi) =>
  groupsKey(await planGroups(roomDesignerApi));

// The planner API of a tool call that changes the plan. The tool runs in the
// planner page as one group command, which answers after its last reload and
// reports the steps it put on the planner's undo history - one per load that
// loaded something and one per group command. The API counts the steps and
// reads the plan before the first one.
const countingPlannerApi = (roomDesignerApi: PlannerApi) => {
  const { extended } = roomDesignerApi;
  const count = {
    steps: 0,
    groupsBefore: undefined as string | undefined,
  };
  const api: PlannerApi = {
    extended: {
      ...extended,
      externalObjectGroupOperation: async (command, payload) => {
        count.groupsBefore ??= await readGroupsKey(roomDesignerApi);
        const result = await extended.externalObjectGroupOperation(
          command,
          payload
        );
        count.steps += Number(result?.historySteps ?? 1);
        return result;
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
      if (recordable && groupsAfter === undefined) {
        planHistory.forget();
      } else if (recordable) {
        planHistory.record({
          tool,
          steps: count.steps,
          groupsBefore: count.groupsBefore!,
          groupsAfter: groupsAfter!,
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

// The groups a tool call changed, by the plan before and after it: those it
// created, removed or changed.
const changedGroupIds = (call: ToolCallRecord): Set<string> => {
  const byId = (key: string) =>
    new Map(
      ((JSON.parse(key) ?? []) as any[]).map((group) => [
        String(group?.id),
        JSON.stringify(group),
      ])
    );
  const before = byId(call.groupsBefore);
  const after = byId(call.groupsAfter);
  return new Set(
    [...before.keys(), ...after.keys()].filter(
      (id) => before.get(id) !== after.get(id)
    )
  );
};

// A result that changed some groups of the plan: those groups in full, the
// others by their id - the agent knows them already.
const changedGroupsOnly = (
  groups: any[],
  changed: (group: any) => boolean
): { groups: any[]; otherGroupIds?: string[] } => {
  const others = groups.filter((group) => !changed(group));
  return {
    groups: groups.filter(changed),
    ...(others.length > 0 && {
      otherGroupIds: others.map((group) => group.id),
    }),
  };
};

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
    const changed = changedGroupIds(call);
    const groups = await planGroups(roomDesignerApi);
    const removed = [...changed].filter(
      (id) => !groups.some((group) => group.id === id)
    );
    return {
      [undo ? 'undone' : 'redone']: call.tool,
      ...changedGroupsOnly(groups, (group) => changed.has(group.id)),
      ...(removed.length > 0 && { removedGroupIds: removed }),
    };
  };

// An attribute change answers with what changed, not with the whole group:
// get-plan-context shows the group.
const compactAttributeResult = (result: any) => ({
  command: result.command,
  groupIds: ((result.groups ?? []) as any[]).map((group) => group.id),
  ...(result.changedModuleIds?.length > 0 && {
    changedModuleIds: result.changedModuleIds,
  }),
  ...(result.corrections?.length > 0 && { corrections: result.corrections }),
});

// The tools that change the plan run in the planner page: roomle-ui performs
// the tool with the agent's arguments and reports the planner steps it made,
// which the server records for undo. A tool that failed after it changed the
// plan answers with its error and its steps: the steps are recorded, so undo
// reverts them, and the agent gets the error.
const inPlanner = (
  tool: string,
  shape: (result: any) => any = (result) => result
): ToolExecutor =>
  planChange(tool, async (roomDesignerApi, args) => {
    const result = {
      ...(await roomDesignerApi.extended.externalObjectGroupOperation(
        tool,
        args
      )),
    };
    delete result.historySteps;
    delete result.historyFollowUps;
    if (typeof result.error === 'string') {
      throw new Error(result.error);
    }
    return shape(result);
  });

export const toolExecutors: Record<string, ToolExecutor> = {
  // The plan context arrives agent-ready from the planner API (compacted
  // sections, 3D room contours with derived walls, the groups in the frame a
  // placement names); the executor names the walls and leaves out the
  // articles' corner points.
  'get-plan-context': oneAtATime(async (roomDesignerApi, args) => {
    // an unknown section is ignored
    const named = (Array.isArray(args.include) ? args.include : []).filter(
      (section) =>
        PLAN_CONTEXT_SECTIONS.includes(section) ||
        SERVER_SECTIONS.includes(section)
    );
    const include = named.length > 0 ? named : DEFAULT_SECTIONS;
    const withDescriptions = include.includes(ARTICLE_DESCRIPTIONS);
    const withAttributes = include.includes(ATTRIBUTES);
    const requested = include.filter((section): section is PlanContextSection =>
      PLAN_CONTEXT_SECTIONS.includes(section)
    );
    // the descriptions come with the articles
    const withArticles = withDescriptions && !requested.includes('articles');
    // the walls name the doors and windows of the obstacles
    const withRooms =
      requested.includes('obstacles') && !requested.includes('rooms');
    // the vocabulary comes with the master data
    const withMasterData = withAttributes && !requested.includes('masterData');
    const context = await roomDesignerApi.extended.getExternalObjectPlanContext(
      [
        ...requested,
        ...(withRooms ? ['rooms' as const] : []),
        ...(withArticles ? ['articles' as const] : []),
        ...(withMasterData ? ['masterData' as const] : []),
      ]
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
      if (withDescriptions) {
        result[ARTICLE_DESCRIPTIONS] = articles.map(({ articleId, desc }) => ({
          articleId,
          desc,
        }));
      }
      result.articles = articles.map((article) => agentFacingArticle(article));
    }
    if (withArticles) {
      delete result.articles;
    }
    if (withAttributes && result.masterData !== undefined) {
      result[ATTRIBUTES] = agentFacingAttributes(result.masterData);
    }
    if (withMasterData) {
      delete result.masterData;
    }
    return result;
  }),

  'find-attributes': async (roomDesignerApi, args) => {
    const words = searchWords(String(args.text ?? ''));
    if (words.length === 0) {
      throw new Error('text must not be empty.');
    }
    const libraryId = args.libraryId as string | undefined;
    const context = await roomDesignerApi.extended.getExternalObjectPlanContext(
      ['masterData', 'groups']
    );
    // the attributes the root modules in the plan carry - the worktop of a
    // group, not a panel top it does not have
    const inPlan = new Set(
      rootsOfGroups((context.groups ?? []) as any[]).flatMap((root) =>
        ((root?.attributes ?? []) as any[]).map((attribute) => attribute?.id)
      )
    );
    const matches: any[] = [];
    for (const [id, masterData] of Object.entries(
      (context.masterData ?? {}) as Record<string, any>
    )) {
      if (libraryId && id !== libraryId) {
        continue;
      }
      // The master data arrives compacted: root modules and their
      // customer-facing or Bool attributes.
      const rootModules = (masterData.modules ?? []) as any[];
      for (const attribute of masterData.attributes ?? []) {
        if (!attributeMatches(attribute, words)) {
          continue;
        }
        matches.push({
          libraryId: id,
          ...attribute,
          rootModules: rootModules
            .filter((module: any) =>
              (module.attributes ?? []).includes(attribute.id)
            )
            .map((module: any) => ({ id: module.id, name: module.name })),
        });
      }
    }
    const ranked = [
      ...matches.filter((match) => inPlan.has(match.id)),
      ...matches.filter((match) => !inPlan.has(match.id)),
    ];
    return {
      matches: withSharedSelectionsOnce(ranked.slice(0, MAX_ATTRIBUTE_MATCHES)),
      total: matches.length,
      ...(matches.length > MAX_ATTRIBUTE_MATCHES && {
        hint: `Only the first ${MAX_ATTRIBUTE_MATCHES} of ${matches.length} matches are listed - narrow the text.`,
      }),
    };
  },

  'create-or-replace-groups': inPlanner('create-or-replace-groups'),
  'place-group': inPlanner('place-group'),
  'change-module-attribute': inPlanner(
    'change-module-attribute',
    compactAttributeResult
  ),
  'change-group-attribute': inPlanner(
    'change-group-attribute',
    compactAttributeResult
  ),
  'delete-group': inPlanner('delete-group'),
  'delete-article-in-place': inPlanner('delete-article-in-place'),
  'delete-article-and-compact': inPlanner('delete-article-and-compact'),
  'merge-article-into-group': inPlanner('merge-article-into-group'),
  'exchange-root-module': inPlanner('exchange-root-module'),
  'insert-article-into-group': inPlanner('insert-article-into-group'),
  'swap-root-modules': inPlanner('swap-root-modules'),
  'merge-groups': inPlanner('merge-groups'),

  undo: oneAtATime(revertToolCall('undo')),

  redo: oneAtATime(revertToolCall('redo')),

  'get-skill': async (_roomDesignerApi, { name, file }) =>
    readSkillFile(
      skills,
      String(name),
      file === undefined ? undefined : String(file)
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
