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
      options: Record<string, unknown>
    ): Promise<any>;
    externalObjectGroupOperation(
      command: string,
      payload: Record<string, unknown>
    ): Promise<any>;
    fetchPrice(): Promise<any>;
    getExternalObjectSnapshot(options: Record<string, boolean>): Promise<any>;
    getExternalObjectGroups(): Promise<any>;
    removeExternalObject(groupOrRootModuleId: string): Promise<any>;
    undo(): Promise<void>;
    redo(): Promise<void>;
  };
}

export const createPlannerApi = (
  bridge: PageBridge,
  clientId?: string
): PlannerApi => {
  const call = (method: string, args: unknown[], timeoutMs?: number) =>
    clientId
      ? bridge.call(method, args, timeoutMs, clientId)
      : timeoutMs === undefined
        ? bridge.call(method, args)
        : bridge.call(method, args, timeoutMs);
  return {
    extended: {
      getExternalObjectPlanContext: (include) =>
        call('getExternalObjectPlanContext', [include]),
      loadExternalObjectGroupLayout: (layout, layoutType, options) =>
        call(
          'loadExternalObjectGroupLayout',
          [layout, layoutType, options],
          SNAPSHOT_CALL_TIMEOUT_MS
        ),
      externalObjectGroupOperation: (command, payload) =>
        call(
          'externalObjectGroupOperation',
          [command, payload],
          SNAPSHOT_CALL_TIMEOUT_MS
        ),
      fetchPrice: () => call('fetchPrice', []),
      getExternalObjectSnapshot: (options) =>
        call('getExternalObjectSnapshot', [options], SNAPSHOT_CALL_TIMEOUT_MS),
      getExternalObjectGroups: () => call('getExternalObjectGroups', []),
      removeExternalObject: (groupOrRootModuleId) =>
        call('removeExternalObject', [groupOrRootModuleId]),
      undo: async () => {
        await call('undo', []);
      },
      redo: async () => {
        await call('redo', []);
      },
    },
  };
};
