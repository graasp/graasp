import fastifyCors from '@fastify/cors';
import { FastifyPluginAsync } from 'fastify';

import { BUGS_REPORTING_PREFIX } from '../../utils/config';
import bugController from './controller';

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.register(
    async function (fastify) {
      // add CORS support
      if (fastify.corsPluginOptions) {
        fastify.register(fastifyCors, fastify.corsPluginOptions);
      }

      // core routes - require authentication
      fastify.register(async function (fastify) {
        fastify.register(bugController);
      });
    },
    { prefix: BUGS_REPORTING_PREFIX },
  );
};

export default plugin;
