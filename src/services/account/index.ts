import { FastifyPluginAsync } from 'fastify';

import common from './fluent-schemas';

const plugin: FastifyPluginAsync = async (fastify) => {
  // schemas
  fastify.addSchema(common);
};

export default plugin;
