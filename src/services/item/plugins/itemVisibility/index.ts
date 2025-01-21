import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils';
import { asDefined } from '../../../../utils/assertions';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated } from '../../../auth/plugins/passport';
import { matchOne } from '../../../authorization';
import { assertIsMember } from '../../../member/entities/member';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { create, deleteOne } from './schemas';
import { ItemVisibilityService } from './service';

/**
 * Item Visibility plugin
 * Dynamic visibility behavior for simple cases
 * - public
 * - hidden
 *
 * The feature should be stackable and be inherited (a parent public and an item public is allowed)
 * The visibility can be copied alongside the item
 */

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { db } = fastify;

  const itemVisibilityService = resolveDependency(ItemVisibilityService);

  fastify.post(
    '/:itemId/visibilities/:type',
    { schema: create, preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)] },
    async ({ user, params: { itemId, type } }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      return db.transaction(async (manager) => {
        return itemVisibilityService.post(member, buildRepositories(manager), itemId, type);
      });
    },
  );

  // delete item visibility
  fastify.delete(
    '/:itemId/visibilities/:type',
    { schema: deleteOne, preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)] },
    async ({ user, params: { itemId, type } }) => {
      return db.transaction(async (manager) => {
        const member = asDefined(user?.account);
        assertIsMember(member);
        return itemVisibilityService.deleteOne(member, buildRepositories(manager), itemId, type);
      });
    },
  );
};

export default plugin;
