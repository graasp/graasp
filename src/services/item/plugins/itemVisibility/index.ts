import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils.js';
import { db } from '../../../../drizzle/db.js';
import { asDefined } from '../../../../utils/assertions.js';
import { isAuthenticated, matchOne } from '../../../auth/plugins/passport/index.js';
import { assertIsMember } from '../../../authentication.js';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole.js';
import { create, deleteOne } from './schemas.js';
import { ItemVisibilityService } from './service.js';

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
  const itemVisibilityService = resolveDependency(ItemVisibilityService);

  fastify.post(
    '/:itemId/visibilities/:type',
    { schema: create, preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)] },
    async ({ user, params: { itemId, type } }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      return db.transaction(async (tx) => {
        return itemVisibilityService.post(tx, member, itemId, type);
      });
    },
  );

  // delete item visibility
  fastify.delete(
    '/:itemId/visibilities/:type',
    { schema: deleteOne, preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)] },
    async ({ user, params: { itemId, type } }) => {
      return db.transaction(async (tx) => {
        const member = asDefined(user?.account);
        assertIsMember(member);
        return itemVisibilityService.deleteOne(tx, member, itemId, type);
      });
    },
  );
};

export default plugin;
