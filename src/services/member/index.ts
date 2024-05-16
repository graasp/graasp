import fastifyCors from '@fastify/cors';
import { FastifyPluginAsync } from 'fastify';

import memberController from './controller';
import actionMemberPlugin from './plugins/action';
import memberExportDataPlugin from './plugins/export-data';
import memberProfilePlugin from './plugins/profile';
import memberThumbnailPlugin from './plugins/thumbnail';
import common from './schemas';

const ROUTES_PREFIX = '/members';

const plugin: FastifyPluginAsync = async (fastify) => {
  // schemas
  fastify.addSchema(common);

  await fastify.register(
    async function (fastify) {
      // add CORS support
      if (fastify.corsPluginOptions) {
        await fastify.register(fastifyCors, fastify.corsPluginOptions);
      }

      await fastify.register(actionMemberPlugin);

      // routes
      await fastify.register(memberController);

      await fastify.register(memberThumbnailPlugin);
      await fastify.register(memberProfilePlugin);
      await fastify.register(memberExportDataPlugin);
    },
    { prefix: ROUTES_PREFIX },
  );
};

export default plugin;
