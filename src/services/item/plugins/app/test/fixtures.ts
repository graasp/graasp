import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import { HttpMethod } from '@graasp/sdk';

import { APPS_PUBLISHER_ID, APP_ITEMS_PREFIX } from '../../../../../utils/config';

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

export const GRAASP_PUBLISHER = {
  id: APPS_PUBLISHER_ID,
  name: 'graasp',
  origins: ['https://origin.org'],
};

export const BOB_PUBLISHER = {
  id: '13844630-eaef-4286-b12b-6fd537d33d45',
  name: 'bob',
  origins: ['https://bob.org'],
};
