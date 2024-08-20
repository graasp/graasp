import { FastifyPluginAsync } from 'fastify';

import { resolveDependency } from '../../../../di/utils';
import { notUndefined } from '../../../../utils/assertions';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated, optionalIsAuthenticated } from '../../../auth/plugins/passport';
import { matchOne } from '../../../authorization';
import { guestAccountRole } from '../../../itemLogin/strategies/guestAccountRole';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { ItemFlag } from './itemFlag';
import common, { create, getFlags } from './schemas';
import { ItemFlagService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db } = fastify;

  const itemFlagService = resolveDependency(ItemFlagService);

  // schemas
  fastify.addSchema(common);

  // get flags
  fastify.get(
    '/flags',
    { schema: getFlags, preHandler: optionalIsAuthenticated },
    async ({ user }) => {
      return itemFlagService.getAllFlags(user?.account, buildRepositories());
    },
  );

  // create item flag
  fastify.post<{ Params: { itemId: string }; Body: Partial<ItemFlag> }>(
    '/:itemId/flags',
    {
      schema: create,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole, guestAccountRole)],
    },
    async ({ user, params: { itemId }, body }) => {
      const account = notUndefined(user?.account);
      return db.transaction(async (manager) => {
        return itemFlagService.post(account, buildRepositories(manager), itemId, body);
      });
    },
  );
};

export default plugin;
