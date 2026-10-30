import RoomleEmbeddingApi from '@roomle/embedding-lib';
import {
  omPostRequest,
  setupHi,
  startPlanningAssistant,
  type PlanningAssistantConfig,
} from '@roomle/embedding-lib/hi';
import { HI_SERVER_BASE_URL, type HiBackend } from './hi-server.ts';

const EMBEDDING_ID = '948zg40lbmdbthwcoym0m1e4coqa55z';
const SERVER_URL = 'https://www.roomle.com/t/bo-test/';
const DEFAULT_PLAN_ID = 'ps_8jjg0zezlblb48vzn8qas9vwwn7fqbg';
const LANGUAGE = 'en-US,en';
const HI_ROOT_TAGS = [
  '__ext__obj__#external:root-tag',
  'g1a15v0676q3kgibgvu7pqf1nsdykd',
];

export interface PlannerSettings {
  authorization: string;
  backend: HiBackend;
  libraryId: string;
  chat?: PlanningAssistantConfig;
}

/**
 * Starts the planner in `container` with the HI library of the backend and,
 * with a `chat` model, the AI Planning Assistant of the embedding-lib.
 */
export const startPlanner = async (
  container: HTMLElement,
  { authorization, backend, libraryId, chat }: PlannerSettings
) => {
  const hiOptions = {
    libraryId,
    serverOptions: {
      authData: authorization,
      baseUrl: `${HI_SERVER_BASE_URL}/proxy_request?backendId=${encodeURIComponent(backend.backendId)}&url=`,
      language: LANGUAGE,
    },
  };
  await setupHi(hiOptions, {
    onFetchPrice: (orderData: unknown) =>
      omPostRequest(hiOptions, { orderData }, '/api/price/calculate', {
        Authorization: authorization,
        'x-aux-header': libraryId.includes('nobilia') ? 'nobilia' : 'none',
      }),
  });
  const planner = await RoomleEmbeddingApi.createPlanner(
    EMBEDDING_ID,
    container,
    {
      id: backend.planId ?? DEFAULT_PLAN_ID,
      overrideServerUrl: SERVER_URL,
      customApiUrl: 'https://api.roomle.com/v2',
      moc: true,
      locale: LANGUAGE,
      autoStart: true,
      elements: { bottom_bar: false },
      featureFlags: {
        globalCallbacks: false,
        openCloseAnimation: true,
        planningAssistant: chat !== undefined,
      },
      catalogRootTag: [...HI_ROOT_TAGS, ...(backend.additionalCatalogs ?? [])],
      configureInRoom: backend.configureInRoom ?? false,
      hi: hiOptions,
      externalObjectSettings: {
        enableArrangementCorrection: true,
        uiConfiguration: {
          userRight: 'Simple',
          showPossibleSubModules: true,
          animatedOpenClose: false,
          showThumbnails: true,
        },
        materialConfiguration: {
          defaultMaterial: 'roomle_script_test:gray_transparent',
        },
        debugConfiguration: { createDebugGeometry: false },
        tecConfigInfo: { language: LANGUAGE, libraryId },
      },
    }
  );
  if (chat) {
    await startPlanningAssistant(planner, chat, new AbortController().signal);
  }
};
