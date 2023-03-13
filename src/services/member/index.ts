import fastifyCors from '@fastify/cors';
import { FastifyPluginAsync } from 'fastify';

import memberController from './controller';
import common from './schemas';
import memberThumbnailPlugin from './plugins/thumbnail';

const ROUTES_PREFIX = '/members';

const plugin: FastifyPluginAsync = async (fastify) => {
  // schemas
  fastify.addSchema(common);

  fastify.register(
    async function (fastify) {
      // add CORS support
      if (fastify.corsPluginOptions) {
        await fastify.register(fastifyCors, fastify.corsPluginOptions);
      }

      // routes
      fastify.register(
        memberController,
      );

      fastify.register(memberThumbnailPlugin);
    },
    { prefix: ROUTES_PREFIX },
  );
};

export default plugin;
