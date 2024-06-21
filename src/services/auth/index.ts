import { fastifyCors } from '@fastify/cors';
import { FastifyPluginAsync } from 'fastify';

import magicLinkController from './plugins/magicLink';
import mobileController from './plugins/mobile';
import passwordController from './plugins/password';

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    authentication: { service: authService },
  } = fastify;

  // TODO: decorate auth service and use it instead of decorating function
  fastify.decorate('generateRegisterLinkAndEmailIt', authService.generateRegisterLinkAndEmailIt);

  fastify.decorate('generateLoginLinkAndEmailIt', authService.generateLoginLinkAndEmailIt);

  fastify.register(async function (fastify) {
    // add CORS support
    if (fastify.corsPluginOptions) {
      await fastify.register(fastifyCors, fastify.corsPluginOptions);
    }
    fastify.register(magicLinkController);
    fastify.register(passwordController);
    fastify.register(mobileController, { prefix: '/m' });
  });
};

export default plugin;
