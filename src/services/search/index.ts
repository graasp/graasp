import { FastifyPluginAsync } from 'fastify';

import { buildRepositories } from '../../util/repositories';
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
    '/search',
    { schema: search },
    async ({ query, log }) => {
      return searchService.search(null, buildRepositories(), query);
    },
  );
};

export default plugin;
