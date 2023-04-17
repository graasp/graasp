import { FastifyPluginAsync } from 'fastify';

import { buildRepositories } from '../../../../utils/repositories';
import { ItemFlag } from './itemFlag';
import common, { create, getFlags } from './schemas';
import { ItemFlagService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db, items } = fastify;

  const iFS = new ItemFlagService(items.service);

  // schemas
  fastify.addSchema(common);

  // get flags
  fastify.get('/flags', { schema: getFlags }, async ({ member, log }) => {
    return iFS.getAllFlags(member, buildRepositories());
  });

  // create item flag
  fastify.post<{ Params: { itemId: string }; Body: Partial<ItemFlag> }>(
    '/:itemId/flags',
    { schema: create },
    async ({ member, params: { itemId }, body, log }) => {
      return db.transaction(async (manager) => {
        return iFS.post(member, buildRepositories(manager), itemId, body);
      });
    },
  );
};

export default plugin;
