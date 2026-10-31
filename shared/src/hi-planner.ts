import { omPostRequest } from '@roomle/embedding-lib/hi';

export const EMBEDDING_ID = '948zg40lbmdbthwcoym0m1e4coqa55z';
export const SERVER_URL = 'https://www.roomle.com/t/bo-test/';
export const DEFAULT_PLAN_ID = 'ps_8jjg0zezlblb48vzn8qas9vwwn7fqbg';
export const HI_ROOT_TAGS = [
  '__ext__obj__#external:root-tag',
  'g1a15v0676q3kgibgvu7pqf1nsdykd',
];

export type UserRight = 'Simple' | 'Advanced' | 'Master';

type HiOptions = Parameters<typeof omPostRequest>[0];

/**
 * The `externalObjectSettings` of the planner for an HI library: the
 * parameter level `userRight` and the library's `tecConfigInfo`.
 */
export const externalObjectSettings = <TecConfigInfo extends object>(
  userRight: UserRight,
  tecConfigInfo: TecConfigInfo
) => ({
  enableArrangementCorrection: true,
  uiConfiguration: {
    userRight,
    showPossibleSubModules: true,
    animatedOpenClose: false,
    showThumbnails: true,
  },
  materialConfiguration: {
    defaultMaterial: 'roomle_script_test:gray_transparent',
  },
  debugConfiguration: { createDebugGeometry: false },
  tecConfigInfo,
});

/**
 * Asks the order manager of the HI library in `hiOptions` for the prices of
 * `orderData`, with the request `headers`.
 */
export const requestPrice = (
  hiOptions: HiOptions,
  orderData: unknown,
  headers: Record<string, string>
) => omPostRequest(hiOptions, { orderData }, '/api/price/calculate', headers);
