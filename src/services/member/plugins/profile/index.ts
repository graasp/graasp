import { FastifyPluginAsync } from 'fastify';

import { MEMBER_PROFILE_ROUTE_PREFIX } from '../../../../utils/config.js';
import memberProfileController from './controller.js';

const plugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(
    async function (fastify) {
      fastify.register(memberProfileController);
    },
    { prefix: MEMBER_PROFILE_ROUTE_PREFIX },
  );
};

export default plugin;
