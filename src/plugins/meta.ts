import { FastifyPluginAsync } from 'fastify';

import { TaskStatus } from '@graasp/sdk';

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.get('/status', async () => TaskStatus.OK);
};

export default plugin;
