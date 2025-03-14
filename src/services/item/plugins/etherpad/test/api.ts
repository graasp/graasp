import nock from 'nock';

import Etherpad from '@graasp/etherpad-api';

import { ETHERPAD_API_KEY, ETHERPAD_URL } from '../../../../../utils/config.js';
import { ETHERPAD_API_VERSION } from '../constants.js';

type PickMatching<T, V> = { [K in keyof T as T[K] extends V ? K : never]: T[K] };
// eslint-disable-next-line @typescript-eslint/ban-types
type ExtractMethods<T> = PickMatching<T, Function>;

type EtherpadApiResponse<T> = [
  statusCode: number,
  payload?: { code: number; message: string; data: T },
];

type Api = {
  [MethodName in keyof ExtractMethods<Etherpad>]+?: EtherpadApiResponse<
    Awaited<ReturnType<Etherpad[MethodName]>>
  >;
};

/**
 * Helper to setup an emulator for the etherpad server
 * @param replies Enables which endpoints should be emulated with the given responses
 */
export function setUpApi(replies: Api): Promise<{ [Endpoint in keyof Api]: URLSearchParams }> {
  const api = nock(`${ETHERPAD_URL}/api/${ETHERPAD_API_VERSION}/`);

  const endpointAndParams = Object.entries(replies).map(
    ([endpoint, response]) =>
      new Promise<[endpoint: string, params: URLSearchParams]>((resolve) => {
        api
          .get(`/${endpoint}`)
          .query(true)
          .reply((uri) => {
            const url = new URL(uri, ETHERPAD_URL);
            // check that API key is always sent
            expect(url.searchParams.get('apikey')).toEqual(ETHERPAD_API_KEY);
            resolve([endpoint, url.searchParams]);
            return response;
          });
      }),
  );

  return Promise.all(endpointAndParams).then(Object.fromEntries);
}
