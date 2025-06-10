import { fastifyCors } from '@fastify/cors';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../di/utils';
import { db } from '../../drizzle/db';
import type { FastifyInstanceTypebox } from '../../plugins/typebox';
import { optionalIsAuthenticated } from '../auth/plugins/passport';
import { getCountForTags } from './tag.schemas';
import { TagService } from './tag.service';

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
          return await tagService.getCountBy(db, search, category);
        },
      );
    },
    { prefix: '/tags' },
  );
};

export default plugin;
