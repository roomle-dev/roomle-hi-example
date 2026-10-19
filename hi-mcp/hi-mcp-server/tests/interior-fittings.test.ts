import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createHiMcpServer } from '../hi-mcp-server';
import type { PlannerApi } from '../planner-api';
import { toolExecutors } from '../tool-executors';
import { planHistory } from '../plan-history';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
};
const api = (): PlannerApi => ({
  extended: {
    getExternalObjectPlanContext: vi.fn(async () => ({ groups: [] })),
    externalObjectGroupOperation: vi.fn(async () => ({
      changed: false,
      historySteps: 0,
    })),
    fetchPrice: vi.fn(),
    getExternalObjectSnapshot: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
  },
});
const destination = {
  rootId: 'r',
  parentModuleId: 'r',
  containerModuleId: 'c',
};

describe('interior fitting tools', () => {
  beforeEach(() => planHistory.reset());

  it('forwards scoped read options and never enters the edit route', async () => {
    const planner = api();
    const options = { groupId: 'g', rootId: 'r', articleId: 'shelf' };
    const result = {
      status: 'available',
      articles: [],
      fittings: [
        { instanceId: 's1', replacementArticles: [{ articleId: 'shelf' }] },
      ],
    };
    vi.mocked(planner.extended.getExternalObjectPlanContext).mockResolvedValue({
      interiorDesign: result,
    });
    expect(
      await toolExecutors['get-interior-design-options'](planner, options)
    ).toEqual(result);
    expect(planner.extended.getExternalObjectPlanContext).toHaveBeenCalledWith(
      ['interiorDesign'],
      { interiorDesign: options }
    );
    expect(
      planner.extended.externalObjectGroupOperation
    ).not.toHaveBeenCalled();
  });

  it.each([
    [
      'add-interior-fitting',
      {
        groupId: 'g',
        articleId: 'shelf',
        destination,
        insertPosition: [0, 400, 0],
      },
    ],
    [
      'move-interior-fitting',
      { groupId: 'g', instanceId: 's1', insertPosition: [0, 500, 0] },
    ],
    ['delete-interior-fittings', { groupId: 'g', instanceIds: ['s1', 's1'] }],
    [
      'replace-interior-fitting',
      { groupId: 'g', instanceId: 's1', articleId: 'drawer' },
    ],
  ])('forwards %s once and preserves fitting outcomes', async (tool, args) => {
    const planner = api();
    const result = {
      changed: false,
      addedInstanceIds: [],
      removedInstanceIds: [],
      fittings: [{ instanceId: 's1', position: [0, 400, 0] }],
      corrections: ['Library adjusted the position'],
      historySteps: 0,
    };
    vi.mocked(planner.extended.externalObjectGroupOperation).mockResolvedValue(
      result
    );
    expect(
      await toolExecutors[tool as string](
        planner,
        args as Record<string, unknown>
      )
    ).toEqual({ ...result, historySteps: undefined });
    expect(
      planner.extended.externalObjectGroupOperation
    ).toHaveBeenCalledExactlyOnceWith(tool, args);
  });

  it('waits behind a pending write before reading the interior', async () => {
    const planner = api();
    const started = deferred(),
      release = deferred();
    vi.mocked(planner.extended.externalObjectGroupOperation).mockImplementation(
      async () => {
        started.resolve();
        await release.promise;
        return { historySteps: 0 };
      }
    );
    const write = toolExecutors['move-interior-fitting'](planner, {
      groupId: 'g',
      instanceId: 's1',
      insertPosition: [0, 500, 0],
    });
    await started.promise;
    const read = toolExecutors['get-interior-design-options'](planner, {
      groupId: 'g',
    });
    expect(
      vi.mocked(planner.extended.getExternalObjectPlanContext).mock.calls
    ).toEqual([[['groups']]]);
    release.resolve();
    await Promise.all([write, read]);
    expect(
      planner.extended.getExternalObjectPlanContext
    ).toHaveBeenLastCalledWith(['interiorDesign'], {
      interiorDesign: { groupId: 'g' },
    });
  });

  it('records an interior-only move and confirms undo and redo with unchanged cabinet roots', async () => {
    const planner = api();
    const before = [
      {
        id: 'g',
        roots: [{ id: 'r', articleId: 'cabinet' }],
        interiorFittings: [{ instanceId: 's1', position: [0, 100, 0] }],
      },
      { id: 'other', roots: [] },
    ];
    const after = structuredClone(before);
    after[0].interiorFittings![0].position = [0, 500, 0];
    let groups = before;
    vi.mocked(planner.extended.getExternalObjectPlanContext).mockImplementation(
      async () => ({ groups: structuredClone(groups) })
    );
    vi.mocked(planner.extended.externalObjectGroupOperation).mockImplementation(
      async () => {
        groups = after;
        planHistory.historyChanged();
        return { historySteps: 1, changed: true, groups: [after[0]] };
      }
    );
    vi.mocked(planner.extended.undo).mockImplementation(async () => {
      groups = before;
      planHistory.historyChanged();
    });
    vi.mocked(planner.extended.redo).mockImplementation(async () => {
      groups = after;
      planHistory.historyChanged();
    });
    await toolExecutors['move-interior-fitting'](planner, {
      groupId: 'g',
      instanceId: 's1',
      insertPosition: [0, 500, 0],
    });
    expect(await toolExecutors.undo(planner, {})).toMatchObject({
      undone: 'move-interior-fitting',
    });
    expect(groups).toEqual(before);
    expect(await toolExecutors.redo(planner, {})).toMatchObject({
      redone: 'move-interior-fitting',
    });
    expect(groups[0].interiorFittings![0].position).toEqual([0, 500, 0]);
    expect(groups[1]).toEqual(before[1]);
  });

  it('rejects malformed schemas before any planner edit and serves interior terminology', async () => {
    const planner = api();
    const server = createHiMcpServer(planner);
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(b);
    const client = new Client({ name: 'interior-test', version: '1' });
    await client.connect(a);
    try {
      const { tools } = await client.listTools();
      expect(
        tools.find((t) => t.name === 'get-interior-design-options')?.description
      ).toContain('Interior Design / interior fittings / sub-articles');
      for (const [name, args] of [
        ['add-interior-fitting', { groupId: 'g', articleId: 'shelf' }],
        [
          'move-interior-fitting',
          { groupId: 'g', instanceId: 's1', insertPosition: [0, 1] },
        ],
        ['delete-interior-fittings', { groupId: 'g', instanceIds: [] }],
        ['replace-interior-fitting', { groupId: 'g', instanceId: 's1' }],
      ] as const) {
        expect((await client.callTool({ name, arguments: args })).isError).toBe(
          true
        );
      }
      expect(
        planner.extended.externalObjectGroupOperation
      ).not.toHaveBeenCalled();
    } finally {
      await client.close();
      await server.close();
    }
  });
});
