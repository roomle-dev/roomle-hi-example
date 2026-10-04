import { describe, expect, it, vi } from 'vitest';
import { PLANNER_METHODS } from '../../hi-mcp-client/browser-bridge';
import type { PageBridge } from '../page-bridge';
import { SNAPSHOT_CALL_TIMEOUT_MS } from '../page-bridge';
import { createPlannerApi } from '../planner-api';

const createMockBridge = () =>
  ({ call: vi.fn(async () => ({ from: 'page' })) }) as unknown as PageBridge;

describe('createPlannerApi', () => {
  it('forwards each planner method with its positional arguments', async () => {
    const bridge = createMockBridge();
    const { extended } = createPlannerApi(bridge);

    await expect(
      extended.getExternalObjectPlanContext(['articles']),
    ).resolves.toEqual({ from: 'page' });
    expect(bridge.call).toHaveBeenCalledWith('getExternalObjectPlanContext', [
      ['articles'],
    ]);

    await extended.fetchPrice();
    expect(bridge.call).toHaveBeenCalledWith('fetchPrice', []);

    await extended.getExternalObjectGroups();
    expect(bridge.call).toHaveBeenCalledWith('getExternalObjectGroups', []);

    await extended.removeExternalObject('g1');
    expect(bridge.call).toHaveBeenCalledWith('removeExternalObject', ['g1']);
  });

  it('uses the snapshot timeout for loading, group commands and snapshots only', async () => {
    const bridge = createMockBridge();
    const { extended } = createPlannerApi(bridge);

    await extended.loadExternalObjectGroupLayout({ posGroups: [] }, 'posGroups', {
      reason: 'adjusted',
    });
    expect(bridge.call).toHaveBeenCalledWith(
      'loadExternalObjectGroupLayout',
      [{ posGroups: [] }, 'posGroups', { reason: 'adjusted' }],
      SNAPSHOT_CALL_TIMEOUT_MS,
    );

    await extended.externalObjectGroupOperation('delete-group', {
      groupId: 'g1',
    });
    expect(bridge.call).toHaveBeenCalledWith(
      'externalObjectGroupOperation',
      ['delete-group', { groupId: 'g1' }],
      SNAPSHOT_CALL_TIMEOUT_MS,
    );

    await extended.getExternalObjectSnapshot({ orderData: true });
    expect(bridge.call).toHaveBeenCalledWith(
      'getExternalObjectSnapshot',
      [{ orderData: true }],
      SNAPSHOT_CALL_TIMEOUT_MS,
    );

    // the default timeout applies when no timeout is passed
    await extended.getExternalObjectPlanContext(['groups']);
    expect(vi.mocked(bridge.call).mock.lastCall).toHaveLength(2);
  });

  it('calls exactly the planner methods the page bridge exposes', () => {
    const { extended } = createPlannerApi(createMockBridge());
    expect(Object.keys(extended).sort()).toEqual([...PLANNER_METHODS].sort());
  });

  it('passes the browser identity to planner calls', async () => {
    const bridge = createMockBridge();
    await createPlannerApi(bridge, 'this-page').extended.fetchPrice();
    expect(bridge.call).toHaveBeenCalledWith('fetchPrice', [], undefined, 'this-page');
  });
});
