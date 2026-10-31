import type { UserRight } from '../../shared/src/hi-planner.ts';

export interface DemoSettings {
  locale: string;
  apiKey: string;
  libraryId: string;
  subscriptionId: string;
  endpointUrl: string;
  userRight: UserRight;
}

const STORAGE_KEY = 'nobilia-demo-settings';

export const DEFAULT_SETTINGS: DemoSettings = {
  locale: 'en-US,en',
  apiKey: '',
  libraryId: '',
  subscriptionId: '',
  endpointUrl: 'https://connect.homag.com/',
  userRight: 'Simple',
};

export const isUserRight = (value: string | null): value is UserRight =>
  value === 'Simple' || value === 'Advanced' || value === 'Master';

/** The settings stored in `storage` over the defaults; the defaults for none or an invalid entry. */
export const loadSettings = (storage: Pick<Storage, 'getItem'>) => {
  try {
    const stored = storage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } as DemoSettings;
    }
  } catch {
    // an invalid entry keeps the defaults
  }
  return { ...DEFAULT_SETTINGS };
};

export const saveSettings = (
  storage: Pick<Storage, 'setItem'>,
  settings: DemoSettings
) => storage.setItem(STORAGE_KEY, JSON.stringify(settings));

/**
 * `settings` with the values of the query parameters in `search`: `locale`
 * (or `language`), `apiKey`, `libraryId` (or `library_id`), `subscriptionId`,
 * `endpointUrl` and `user_right`.
 */
export const applyQueryParams = (
  settings: DemoSettings,
  search: string
): DemoSettings => {
  const params = new URLSearchParams(search);
  const userRight = params.get('user_right');
  return {
    ...settings,
    locale: params.get('locale') ?? params.get('language') ?? settings.locale,
    apiKey: params.get('apiKey') ?? settings.apiKey,
    libraryId:
      params.get('libraryId') ?? params.get('library_id') ?? settings.libraryId,
    subscriptionId: params.get('subscriptionId') ?? settings.subscriptionId,
    endpointUrl: params.get('endpointUrl') ?? settings.endpointUrl,
    userRight: isUserRight(userRight) ? userRight : settings.userRight,
  };
};
