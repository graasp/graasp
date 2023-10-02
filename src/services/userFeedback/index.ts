import fastifyCors from '@fastify/cors';
import { FastifyPluginAsync } from 'fastify';

import { USER_FEEDBACK_PREFIX } from '../../utils/config';
import userFeedbackController from './controller';

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.register(
    async function (fastify) {
      // add CORS support
      if (fastify.corsPluginOptions) {
        fastify.register(fastifyCors, fastify.corsPluginOptions);
      }

      // core routes - require authentication
      fastify.register(userFeedbackController);
    },
    { prefix: USER_FEEDBACK_PREFIX },
  );
};

export default plugin;
