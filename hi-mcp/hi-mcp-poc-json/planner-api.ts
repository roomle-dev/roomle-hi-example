import type { PageBridge } from './page-bridge';
import { SNAPSHOT_CALL_TIMEOUT_MS } from './page-bridge';

// The planner methods the tools call, executed by the connected page on
// roomDesignerApi.extended. Every parameter is required: the call travels as
// JSON, which turns an undefined argument into null.
export interface PlannerApi {
  extended: {
    getExternalObjectPlanContext(include: string[]): Promise<any>;
    loadExternalObjectGroupLayout(
      layout: unknown,
      layoutType: string,
      options: Record<string, unknown>,
    ): Promise<any>;
    externalObjectGroupOperation(
      command: string,
      payload: Record<string, unknown>,
    ): Promise<any>;
    fetchPrice(): Promise<any>;
    getExternalObjectSnapshot(options: Record<string, boolean>): Promise<any>;
    getExternalObjectGroups(): Promise<any>;
    removeExternalObject(groupOrRootModuleId: string): Promise<any>;
  };
}

export const createPlannerApi = (bridge: PageBridge): PlannerApi => ({
  extended: {
    getExternalObjectPlanContext: (include) =>
      bridge.call('getExternalObjectPlanContext', [include]),
    loadExternalObjectGroupLayout: (layout, layoutType, options) =>
      bridge.call(
        'loadExternalObjectGroupLayout',
        [layout, layoutType, options],
        SNAPSHOT_CALL_TIMEOUT_MS,
      ),
    externalObjectGroupOperation: (command, payload) =>
      bridge.call(
        'externalObjectGroupOperation',
        [command, payload],
        SNAPSHOT_CALL_TIMEOUT_MS,
      ),
    fetchPrice: () => bridge.call('fetchPrice', []),
    getExternalObjectSnapshot: (options) =>
      bridge.call(
        'getExternalObjectSnapshot',
        [options],
        SNAPSHOT_CALL_TIMEOUT_MS,
      ),
    getExternalObjectGroups: () => bridge.call('getExternalObjectGroups', []),
    removeExternalObject: (groupOrRootModuleId) =>
      bridge.call('removeExternalObject', [groupOrRootModuleId]),
  },
});
