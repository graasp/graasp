import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { ActionTriggers } from '@graasp/sdk';

import { resolveDependency } from '../../../../../../../di/utils';
import { MEILISEARCH_REBUILD_SECRET } from '../../../../../../../utils/config';
import { buildRepositories } from '../../../../../../../utils/repositories';
import { ActionService } from '../../../../../../action/services/action';
import { optionalIsAuthenticated } from '../../../../../../auth/plugins/passport';
import { getFacets, search } from './schemas';
import { SearchService } from './service';

export type SearchFields = {
  keywords?: string;
  tags?: string[];
  parentId?: string;
  name?: string;
  creator?: string;
};

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const searchService = resolveDependency(SearchService);
  const actionService = resolveDependency(ActionService);

  // use post to allow complex body
  fastify.post(
    '/collections/search',
    { preHandler: optionalIsAuthenticated, schema: search },
    async (request) => {
      const { user, body } = request;
      const repositories = buildRepositories();
      const member = user?.account;
      const searchResults = await searchService.search(body);
      const action = {
        type: ActionTriggers.ItemSearch,
        extra: body,
      };
      await actionService.postMany(member, repositories, request, [action]);
      return searchResults;
    },
  );

  // use post to allow complex body
  fastify.post(
    '/collections/facets',
    { preHandler: optionalIsAuthenticated, schema: getFacets },
    async (request) => {
      const { body, query } = request;
      const searchResults = await searchService.getFacets(query.facetName, body);
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
