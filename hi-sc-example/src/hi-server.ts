export const HI_SERVER_BASE_URL = 'https://dfscfgtest01-app.azurewebsites.net';

/** A backend of the HI server, as `/backends/list` answers it. */
export interface HiBackend {
  backendId: string;
  libraryId: string;
  planId: string | null;
  configureInRoom: boolean | null;
  additionalCatalogs: string[] | null;
}

/**
 * Signs in to the HI server with the Basic `authorization` and returns the
 * backend: the backend list answers 401 to a wrong user or password.
 */
export const fetchBackend = async (
  authorization: string,
  backendId: string
): Promise<HiBackend> => {
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
  const backend = backends.find((entry) => entry.backendId === backendId);
  if (!backend) {
    throw new Error(`The HI server has no backend "${backendId}"`);
  }
  return backend;
};
