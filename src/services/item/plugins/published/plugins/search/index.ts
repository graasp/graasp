import { MultiSearchParams } from 'meilisearch';

import { FastifyPluginAsync } from 'fastify';

import { buildRepositories } from '../../../../../../utils/repositories';

export type SearchFields = {
  keywords?: string;
  tags?: string[];
  parentId?: string;
  name?: string;
  creator?: string;
};

const plugin: FastifyPluginAsync = async (fastify) => {
  const searchService = fastify.search.service;

  fastify.post(
    '/collections/search',
    // { schema: search, preHandler: fastify.fetchMemberInSession }, // tmp ignore schema
    { preHandler: fastify.fetchMemberInSession },
    async ({ params, member, body }) => {
      return searchService.search(member, buildRepositories(), body as MultiSearchParams);
    },
  );

  // TODO: delete this endpoint (only for testing full rebuild)
  fastify.get('/collections/search/rebuild', async () => {
    return searchService.rebuildIndex();
  });
};

export default plugin;
