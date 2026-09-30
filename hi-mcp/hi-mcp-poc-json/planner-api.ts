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
    updateExternalObjectGroupAttribute(
      rootModuleId: unknown,
      moduleId: unknown,
      attributeId: unknown,
      value: unknown,
    ): Promise<any>;
    fetchPrice(): Promise<any>;
    getExternalObjectSnapshot(options: Record<string, boolean>): Promise<any>;
    getExternalObjectGroups(): Promise<any>;
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
    updateExternalObjectGroupAttribute: (
      rootModuleId,
      moduleId,
      attributeId,
      value,
    ) =>
      bridge.call('updateExternalObjectGroupAttribute', [
        rootModuleId,
        moduleId,
        attributeId,
        value,
      ]),
    fetchPrice: () => bridge.call('fetchPrice', []),
    getExternalObjectSnapshot: (options) =>
      bridge.call(
        'getExternalObjectSnapshot',
        [options],
        SNAPSHOT_CALL_TIMEOUT_MS,
      ),
    getExternalObjectGroups: () => bridge.call('getExternalObjectGroups', []),
  },
});
