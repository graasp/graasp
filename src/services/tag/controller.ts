import { fastifyCors } from '@fastify/cors';
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../di/utils';
import { FastifyInstanceTypebox } from '../../plugins/typebox';
import { buildRepositories } from '../../utils/repositories';
import { optionalIsAuthenticated } from '../auth/plugins/passport';
import { getCountForTags } from './schemas';
import { TagService } from './service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const tagService = resolveDependency(TagService);
  fastify.register(
    async function (fastify: FastifyInstanceTypebox) {
      // add CORS support
      if (fastify.corsPluginOptions) {
        fastify.register(fastifyCors, fastify.corsPluginOptions);
      }

      fastify.get(
        '/',
        { schema: getCountForTags, preHandler: optionalIsAuthenticated },
        async ({ query: { search, category } }) => {
          const repositories = buildRepositories();

          return await tagService.getCountBy(repositories, search, category);
        },
      );
    },
    { prefix: '/tags' },
  );
};

export default plugin;
