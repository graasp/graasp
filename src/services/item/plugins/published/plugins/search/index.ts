import { StatusCodes } from 'http-status-codes';
import { MultiSearchParams } from 'meilisearch';

import { FastifyPluginAsync } from 'fastify';

import { ActionTriggers } from '@graasp/sdk';

import { MEILISEARCH_REBUILD_SECRET } from '../../../../../../utils/config';
import { buildRepositories } from '../../../../../../utils/repositories';
import { optionalAuthenticated } from '../../../../../auth/plugins/passport';
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
    { preHandler: optionalAuthenticated, schema: search },
    async (request) => {
      const { user, body } = request;
      const repositories = buildRepositories();
      const member = user?.member;
      const searchResults = await searchService.search(member, repositories, body);
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
      searchService.rebuildIndex();
      reply.status(StatusCodes.ACCEPTED);
    } else {
      reply.status(StatusCodes.UNAUTHORIZED);
    }
  });
};

export default plugin;
