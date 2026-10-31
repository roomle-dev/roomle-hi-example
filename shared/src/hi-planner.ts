import { omGetRequest, omPostRequest } from '@roomle/embedding-lib/hi';

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

const ORDER_IMPORT_PATH = '/api/orderManager/orders/import';

/**
 * Imports `order` into the order manager of the HI library in `hiOptions`,
 * with the request `headers`, as "Send to OM" of roomle-ui
 * `hi-presets-example.ts` does, and logs the answer, the import status and
 * the link of the order to the console.
 */
export const importOrder = async (
  hiOptions: HiOptions,
  order: unknown,
  headers: Record<string, string>
) => {
  const answer = await omPostRequest(
    hiOptions,
    order,
    ORDER_IMPORT_PATH,
    headers
  );
  console.info('ORDER-RESPONSE', JSON.stringify(answer));
  if (!answer.correlationId) {
    return;
  }
  const status = await omGetRequest(
    hiOptions,
    `${ORDER_IMPORT_PATH}/${answer.correlationId}`,
    headers
  );
  console.info('IMPORT-STATUS', JSON.stringify(status));
  if (status.link) {
    console.info(`OrderManager Order: ${status.link}`);
  }
};
