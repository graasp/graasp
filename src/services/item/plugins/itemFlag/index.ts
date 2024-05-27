import { FastifyPluginAsync } from 'fastify';

import { buildRepositories } from '../../../../utils/repositories';
import { authenticated, optionalAuthenticated } from '../../../auth/plugins/passport';
import { ItemFlag } from './itemFlag';
import common, { create, getFlags } from './schemas';
import { ItemFlagService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db, items } = fastify;

  const iFS = new ItemFlagService(items.service);

  // schemas
  fastify.addSchema(common);

  // get flags
  fastify.get(
    '/flags',
    { schema: getFlags, preHandler: optionalAuthenticated },
    async ({ user }) => {
      return iFS.getAllFlags(user?.member, buildRepositories());
    },
  );

  // create item flag
  fastify.post<{ Params: { itemId: string }; Body: Partial<ItemFlag> }>(
    '/:itemId/flags',
    { schema: create, preHandler: authenticated },
    async ({ user, params: { itemId }, body }) => {
      return db.transaction(async (manager) => {
        return iFS.post(user!.member!, buildRepositories(manager), itemId, body);
      });
    },
  );
};

export default plugin;
