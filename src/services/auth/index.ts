import { fastifyCors } from '@fastify/cors';
import type { FastifyPluginAsync } from 'fastify';

import magicLinkController from './plugins/magicLink/magicLink.controller';
import passwordController from './plugins/password/password.controller';

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.register(async function (fastify) {
    // add CORS support
    if (fastify.corsPluginOptions) {
      await fastify.register(fastifyCors, fastify.corsPluginOptions);
    }
    fastify.register(magicLinkController);
    fastify.register(passwordController);
  });
};

export default plugin;
