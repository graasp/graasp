import { StatusCodes } from 'http-status-codes';
import { MultiSearchParams } from 'meilisearch';

import { FastifyPluginAsync } from 'fastify';

import { ActionTriggers } from '@graasp/sdk';

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

  fastify.post<{ Body: MultiSearchParams }>(
    '/collections/search',
    { preHandler: fastify.attemptVerifyAuthentication, schema: search },
    async (request, reply) => {
      const { member, body } = request;
      const repositories = buildRepositories();

      const searchResults = await searchService.search(member, repositories, body);
      if (!searchResults) {
        return reply.status(StatusCodes.SERVICE_UNAVAILABLE);
      }
      const action = {
        type: ActionTriggers.ItemSearch,
        extra: body,
      };
      await actionService.postMany(member, repositories, request, [action]);
      return searchResults;
    },
  );

  fastify.get('/collections/search/rebuild', async ({ headers }, reply) => {
    // TODO: in the future, lock this behind admin permission and maybe add a button to the frontend admin panel
    const headerRebuildSecret = headers['meilisearch-rebuild'];

    if (MEILISEARCH_REBUILD_SECRET && MEILISEARCH_REBUILD_SECRET === headerRebuildSecret) {
      // explicitly rebuild index in the background
      void searchService.rebuildIndex();
      void reply.status(StatusCodes.ACCEPTED);
    } else {
      void reply.status(StatusCodes.UNAUTHORIZED);
    }
  });
};

export default plugin;
