import { FastifyPluginAsync } from 'fastify';

import { MEMBER_EXPORT_DATA_ROUTE_PREFIX } from '../../../../utils/config';
import memberDataController from './controller';

const plugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(
    async function (fastify) {
      fastify.register(memberDataController);
    },
    { prefix: MEMBER_EXPORT_DATA_ROUTE_PREFIX },
  );
};

export default plugin;
