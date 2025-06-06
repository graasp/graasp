import type { FastifyInstance } from 'fastify';

import { HttpMethod } from '@graasp/sdk';

import { APP_ITEMS_PREFIX } from '../../../../../utils/config';

export const getAccessToken = async (
  app: FastifyInstance,
  item: { id: string },
  chosenApp: { key: string; url: string },
) => {
  const response = await app.inject({
    method: HttpMethod.Post,
    url: `${APP_ITEMS_PREFIX}/${item.id}/api-access-token`,
    payload: { key: chosenApp.key, origin: chosenApp.url },
  });
  const { token } = response.json();
  return token;
};
