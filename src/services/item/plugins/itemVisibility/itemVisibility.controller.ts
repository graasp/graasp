import { StatusCodes } from 'http-status-codes';

import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { asDefined } from '../../../../utils/assertions';
import { isAuthenticated, matchOne } from '../../../auth/plugins/passport';
import { assertIsMember } from '../../../authentication';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { create, deleteOne } from './itemVisibility.schemas';
import { ItemVisibilityService } from './itemVisibility.service';

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
    async ({ user, params: { itemId, type } }, reply) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      await db.transaction(async (tx) => {
        await itemVisibilityService.post(tx, member, itemId, type);
      });
      reply.status(StatusCodes.NO_CONTENT);
    },
  );

  // delete item visibility
  fastify.delete(
    '/:itemId/visibilities/:type',
    { schema: deleteOne, preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)] },
    async ({ user, params: { itemId, type } }, reply) => {
      await db.transaction(async (tx) => {
        const member = asDefined(user?.account);
        assertIsMember(member);
        return itemVisibilityService.deleteOne(tx, member, itemId, type);
      });
      reply.status(StatusCodes.NO_CONTENT);
    },
  );
};

export default plugin;
