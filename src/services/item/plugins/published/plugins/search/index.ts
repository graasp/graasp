import { StatusCodes } from 'http-status-codes';
import { MultiSearchParams } from 'meilisearch';

import { FastifyPluginAsync } from 'fastify';

import { MEILISEARCH_REBUILD_SECRET } from '../../../../../../utils/config';
import { buildRepositories } from '../../../../../../utils/repositories';
import { search } from './schemas';

export type SearchFields = {
  keywords?: string;
  tags?: string[];
  parentId?: string;
  name?: string;
  creator?: string;
};

const plugin: FastifyPluginAsync = async (fastify) => {
  const searchService = fastify.search.service;
  const actionService = fastify.actions.service;

  fastify.post(
    '/collections/search',
    { preHandler: fastify.attemptVerifyAuthentication, schema: search },
    async (request) => {
      const { member, body } = request;
      const repositories = buildRepositories();

      // TODO: chnage type from graasp/sdk
      const action = {
        type: 'item-search',
        extra: { ...(body as any) },
      };
      await actionService.postMany(member, repositories, request, [action]);
      return searchService.search(member, repositories, body as MultiSearchParams);
    },
  );

  fastify.get('/collections/search/rebuild', async ({ headers }, reply) => {
    // TODO: in the future, lock this behind admin permission and maybe add a button to the frontend admin panel
    const headerRebuildSecret = headers['meilisearch-rebuild'];

    if (MEILISEARCH_REBUILD_SECRET && MEILISEARCH_REBUILD_SECRET === headerRebuildSecret) {
      searchService.rebuildIndex();
      reply.status(StatusCodes.ACCEPTED);
    } else {
      reply.status(StatusCodes.UNAUTHORIZED);
    }
  });
};

export default plugin;
