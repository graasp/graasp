import fastifyCors from '@fastify/cors';
import { FastifyPluginAsync } from 'fastify';

import memberController from './controller';
import actionMemberPlugin from './plugins/action';
import memberProfilePlugin from './plugins/profile';
import memberThumbnailPlugin from './plugins/thumbnail';
import common from './schemas';

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

      fastify.register(actionMemberPlugin);

      // routes
      fastify.register(memberController);

      fastify.register(memberThumbnailPlugin);
      fastify.register(memberProfilePlugin);
    },
    { prefix: ROUTES_PREFIX },
  );
};

export default plugin;
