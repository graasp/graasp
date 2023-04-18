import { FastifyPluginAsync } from 'fastify';

import { buildRepositories } from '../../../../../../utils/repositories';
import { search } from './schemas';
import { SearchService } from './service';

export type SearchFields = {
  keywords?: string;
  tags?: string[];
  parentId?: string;
  name?: string;
  creator?: string;
};

const plugin: FastifyPluginAsync = async (fastify) => {
  const searchService = new SearchService();

  fastify.decorate('search', { service: searchService });

  // search for items with keyword
  // range: title, tag, all, author
  fastify.get<{ Querystring: SearchFields }>(
    '/collections/search',
    { schema: search, preHandler: fastify.fetchMemberInSession },
    async ({ member, query, log }) => {
      return searchService.search(member, buildRepositories(), query);
    },
  );
};

export default plugin;
