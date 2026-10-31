import type { PlanningAssistantConfig } from '@roomle/embedding-lib/hi';
import {
  DEFAULT_PLAN_ID,
  HI_ROOT_TAGS,
  SERVER_URL,
  externalObjectSettings,
} from '../../shared/src/hi-planner.ts';
import type { DemoSettings } from './settings.ts';

export const DEMO_PROXY_URL =
  'https://europe-west3-rml-showcases.cloudfunctions.net/proxy_request';
const LIBRARY_ID = 'nobilia_Minifabrik';

// The chat runs on the Responses API through the Azure AI route of the demo proxy, which holds the
// endpoint and the key: gpt-6-astra takes function tools with reasoning on the Responses API only.
// The azure provider sends a key; the proxy drops it and sends its own.
export const PLANNING_ASSISTANT_CONFIG: PlanningAssistantConfig = {
  provider: 'azure',
  baseUrl: `${DEMO_PROXY_URL}/azure-ai`,
  model: 'gpt-6-astra',
  apiKey: 'held-by-the-demo-proxy',
  readsImages: true,
};

/**
 * The options of the planner: the HI library through the demo proxy with the
 * `settings`, and the plan, the planner's server and the debug geometry of the
 * query parameters `plan_id`, `server_url` and `debug` in `search`.
 */
export const plannerOptions = (settings: DemoSettings, search: string) => {
  const params = new URLSearchParams(search);
  const libraryId = settings.libraryId || LIBRARY_ID;
  const { locale, endpointUrl, subscriptionId, apiKey } = settings;
  return {
    id: params.get('plan_id') ?? DEFAULT_PLAN_ID,
    overrideServerUrl: params.get('server_url') ?? SERVER_URL,
    debugGeometry: params.get('debug') === 'true',
    moc: true,
    saveToIdb: false,
    autoStart: true,
    locale,
    notifications: {
      'first-person-controls': false,
      'interaction.add-element': false,
      'interaction.confirm-ghosts': false,
      'interaction.parameters-changed': false,
      'interaction.root-element': false,
      'load-idb-config': false,
      'stop-configure-hint': false,
    },
    buttons: { undo: true, redo: true, swap_product: true },
    enableTwoLevelCatalog: true,
    featureFlags: {
      globalCallbacks: false,
      localExport3d: true,
      openCloseAnimation: true,
      slopingRoof: true,
      enableTwoLevelCatalog: true,
      planningAssistant: true,
    },
    catalogRootTag: HI_ROOT_TAGS,
    externalObjectSettings: externalObjectSettings(settings.userRight, {
      language: locale,
      libraryId,
    }),
    hi: {
      libraryId,
      serverOptions: {
        baseUrl: `${DEMO_PROXY_URL}?url=`,
        language: locale,
        endpointUrl,
        subscriptionId,
        key: apiKey,
        om: { endpointUrl, subscriptionId, key: apiKey },
      },
    },
  };
};

/** The order-manager headers: the demo proxy takes its nobilia subscription for a nobilia library. */
export const orderManagerHeaders = (libraryId: string) => ({
  'x-aux-header': libraryId.includes('nobilia') ? 'nobilia' : 'none',
});
