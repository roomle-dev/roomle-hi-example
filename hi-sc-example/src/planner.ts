import RoomleEmbeddingApi from '@roomle/embedding-lib';
import {
  setupHi,
  startPlanningAssistant,
  type PlanningAssistantConfig,
} from '@roomle/embedding-lib/hi';
import {
  DEFAULT_PLAN_ID,
  EMBEDDING_ID,
  HI_ROOT_TAGS,
  SERVER_URL,
  externalObjectSettings,
  importOrder,
  requestPrice,
} from '../../shared/src/hi-planner.ts';
import { hiProxyBaseUrl, type HiBackend } from './hi-server.ts';
import type { QueryOptions } from './query-options.ts';

const LANGUAGE = 'en-US,en';

export interface PlannerSettings {
  authorization: string;
  backend?: HiBackend;
  libraryId: string;
  chat?: PlanningAssistantConfig;
  queryOptions: QueryOptions;
}

/**
 * Starts the planner in `container` with the HI library of the backend and,
 * with a `chat` model, the AI Planning Assistant of the embedding-lib. The
 * `queryOptions` overwrite the planner options.
 */
export const startPlanner = async (
  container: HTMLElement,
  { authorization, backend, libraryId, chat, queryOptions }: PlannerSettings
) => {
  const hiOptions = {
    libraryId,
    serverOptions: {
      authData: authorization,
      baseUrl: hiProxyBaseUrl(backend?.backendId),
      language: LANGUAGE,
    },
  };
  await setupHi(hiOptions, {
    onFetchPrice: (orderData: unknown) =>
      requestPrice(hiOptions, orderData, { Authorization: authorization }),
    onPlaceOrder: (order: unknown) =>
      importOrder(hiOptions, order, { Authorization: authorization }),
  });
  const planner = await RoomleEmbeddingApi.createPlanner(
    EMBEDDING_ID,
    container,
    {
      id: backend?.planId ?? DEFAULT_PLAN_ID,
      overrideServerUrl: backend?.overrideServerUrl ?? SERVER_URL,
      customApiUrl: 'https://api.roomle.com/v2',
      moc: true,
      locale: LANGUAGE,
      autoStart: true,
      featureFlags: {
        globalCallbacks: false,
        openCloseAnimation: true,
        planningAssistant: chat !== undefined,
      },
      // the additional catalogs of the backend, each catalog once
      catalogRootTag: [
        ...new Set([...HI_ROOT_TAGS, ...(backend?.additionalCatalogs ?? [])]),
      ],
      configureInRoom: backend?.configureInRoom ?? false,
      hi: hiOptions,
      externalObjectSettings: externalObjectSettings('Simple', {
        language: LANGUAGE,
        libraryId,
      }),
      ...queryOptions,
    }
  );
  // Add to Cart sends the plan with its prices to the order manager
  planner.ui.callbacks.onRequestPlan = async () => {
    await planner.extended.placeOrder(true);
  };
  if (chat) {
    await startPlanningAssistant(planner, chat, new AbortController().signal);
  }
};
