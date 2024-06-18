import fastifyCors from '@fastify/cors';
import { FastifyPluginAsync } from 'fastify';

import memberController from './controller.js';
import actionMemberPlugin from './plugins/action/index.js';
import memberExportDataPlugin from './plugins/export-data/index.js';
import memberProfilePlugin from './plugins/profile/index.js';
import memberThumbnailPlugin from './plugins/thumbnail/index.js';
import common from './schemas.js';

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
      fastify.register(memberExportDataPlugin);
    },
    { prefix: ROUTES_PREFIX },
  );
};

export default plugin;
