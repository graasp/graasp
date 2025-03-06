import { fastifyCors } from '@fastify/cors';
import { FastifyPluginAsync } from 'fastify';

import magicLinkController from './plugins/magicLink/magicLink.controller';
import mobileController from './plugins/mobile/mobile.controller';
import passwordController from './plugins/password';

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.register(async function (fastify) {
    // add CORS support
    if (fastify.corsPluginOptions) {
      await fastify.register(fastifyCors, fastify.corsPluginOptions);
    }
    fastify.register(magicLinkController);
    fastify.register(passwordController);
    // fastify.register(mobileController, { prefix: '/m' });
  });
};

export default plugin;
