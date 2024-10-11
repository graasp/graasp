import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils';
import { asDefined } from '../../../../utils/assertions';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated } from '../../../auth/plugins/passport';
import { matchOne } from '../../../authorization';
import { guestAccountRole } from '../../../itemLogin/strategies/guestAccountRole';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { create, getFlagTypes } from './schemas';
import { ItemFlagService } from './service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { db } = fastify;

  const itemFlagService = resolveDependency(ItemFlagService);

  // Get all flag types that can be assigned to an ItemFlag entity.
  fastify.get('/flags', { schema: getFlagTypes }, async () => {
    return itemFlagService.getAllFlagTypes();
  });

  // create item flag
  fastify.post(
    '/:itemId/flags',
    {
      schema: create,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole, guestAccountRole)],
    },
    async ({ user, params: { itemId }, body: { type } }) => {
      const account = asDefined(user?.account);
      return db.transaction(async (manager) => {
        return itemFlagService.post(account, buildRepositories(manager), itemId, type);
      });
    },
  );
};

export default plugin;
