import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../di/utils';
import { buildRepositories } from '../../utils/repositories';
import { optionalIsAuthenticated } from '../auth/plugins/passport';
import { getCountForTags } from './schemas';
import { TagService } from './service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const tagService = resolveDependency(TagService);

  fastify.get(
    '/tags',
    { schema: getCountForTags, preHandler: optionalIsAuthenticated },
    async ({ query: { search, category } }) => {
      const repositories = buildRepositories();

      return await tagService.getCountBy(repositories, search, category);
    },
  );
};

export default plugin;
