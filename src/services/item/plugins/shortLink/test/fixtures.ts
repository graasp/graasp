import type { Static } from '@sinclair/typebox';

import type { FastifyInstance } from 'fastify';

import { ClientManager, Context, HttpMethod, type UUID } from '@graasp/sdk';

import { createShortLink, updateShortLink } from '../shortlink.schemas';
import { SHORT_LINKS_FULL_PREFIX, SHORT_LINKS_LIST_ROUTE } from '../shortlink.service';

export const MOCK_ALIAS = 'mocked-alias';

const shortLinkUrl = (alias: string) => {
  return `${SHORT_LINKS_FULL_PREFIX}/${alias}`;
};

export const injectGet = async (app: FastifyInstance, alias: string) => {
  return app.inject({
    method: HttpMethod.Get,
    url: shortLinkUrl(alias),
  });
};

export const injectGetAvailable = async (app: FastifyInstance, alias: string) => {
  return app.inject({
    method: HttpMethod.Get,
    url: `${SHORT_LINKS_FULL_PREFIX}/available/${alias}`,
  });
};

export const injectGetAll = async (app: FastifyInstance, itemId: UUID) => {
  return app.inject({
    method: HttpMethod.Get,
    url: `${SHORT_LINKS_FULL_PREFIX}${SHORT_LINKS_LIST_ROUTE}/${itemId}`,
  });
};

export const injectPost = async (
  app: FastifyInstance,
  payload?: Static<typeof createShortLink.body>,
) => {
  return app.inject({ method: HttpMethod.Post, url: SHORT_LINKS_FULL_PREFIX, payload });
};

export const injectPatch = async (
  app: FastifyInstance,
  alias: string,
  payload?: Static<typeof updateShortLink.body>,
) => {
  return app.inject({ method: HttpMethod.Patch, url: shortLinkUrl(alias), payload });
};

export const injectDelete = async (app: FastifyInstance, alias: string) => {
  return app.inject({ method: HttpMethod.Delete, url: shortLinkUrl(alias) });
};

export function getRedirection(itemId: string, platform: Context) {
  const clientHostManager = ClientManager.getInstance();

  return clientHostManager.getItemLink(platform, itemId);
}
