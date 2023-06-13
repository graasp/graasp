import { FastifyPluginAsync } from 'fastify';

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.get('/status', async () => 'OK');
};

export default plugin;
