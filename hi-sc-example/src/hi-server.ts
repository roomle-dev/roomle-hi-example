import type { PlanningAssistantConfig } from '@roomle/embedding-lib/hi';

const HI_SERVER_BASE_URL = 'https://dfscfgtest01-app.azurewebsites.net';

/** A backend of the HI server, as `/backends/list` answers it. */
export interface HiBackend {
  backendId: string;
  libraryId: string;
  planId: string | null;
  configureInRoom: boolean | null;
  additionalCatalogs: string[] | null;
  enableAIPlanning?: boolean | null;
}

/** The sign-in: the backend of the backend ID, and whether the model proxy of the HI server serves the chat. */
export interface SignIn {
  backend?: HiBackend;
  modelProxy: boolean;
}

/**
 * The base URL of the HI proxy for the backend of `backendId`; without one,
 * the proxy uses the backend of the user.
 */
export const hiProxyBaseUrl = (backendId?: string) =>
  `${HI_SERVER_BASE_URL}/proxy_request?${backendId ? `backendId=${encodeURIComponent(backendId)}&` : ''}url=`;

/**
 * Signs in to the HI server with the Basic `authorization` and returns the
 * backend of `backendId`, none without one: the backend list answers 401 to
 * a wrong user or password. The model proxy serves a user of exactly one
 * backend, when that backend enables it.
 */
export const fetchBackend = async (
  authorization: string,
  backendId: string
): Promise<SignIn> => {
  const response = await fetch(`${HI_SERVER_BASE_URL}/backends/list`, {
    headers: { Authorization: authorization },
  });
  if (response.status === 401) {
    throw new Error('Wrong user or password');
  }
  if (!response.ok) {
    throw new Error(
      `The HI server answered ${response.status} ${response.statusText}`
    );
  }
  const backends: HiBackend[] = await response.json();
  const modelProxy =
    backends.length === 1 && backends[0].enableAIPlanning === true;
  if (!backendId) {
    return { modelProxy };
  }
  const backend = backends.find((entry) => entry.backendId === backendId);
  if (!backend) {
    throw new Error(`The HI server has no backend "${backendId}"`);
  }
  return { backend, modelProxy };
};

/**
 * The library of the sign-in: the entered one, else the library of the
 * backend; one of them is needed.
 */
export const resolveLibraryId = (
  libraryId: string,
  backend?: HiBackend
): string => {
  const resolved = libraryId || backend?.libraryId;
  if (!resolved) {
    throw new Error('Enter a library, or a backend ID that has one');
  }
  return resolved;
};

/**
 * The chat on the model proxy of the HI server: the model, its endpoint and
 * its key stay in the backend; the page authorizes with the sign-in.
 */
export const modelProxyConfig = (
  authorization: string
): PlanningAssistantConfig => ({
  provider: 'openai-compatible',
  baseUrl: `${HI_SERVER_BASE_URL}/api/ai/v1`,
  model: 'planning',
  headers: { Authorization: authorization },
  readsImages: true,
});
