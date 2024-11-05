import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { ItemVisibilityType } from '@graasp/sdk';

import { resolveDependency } from '../../../../di/utils';
import { asDefined } from '../../../../utils/assertions';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated } from '../../../auth/plugins/passport';
import { matchOne } from '../../../authorization';
import { assertIsMember } from '../../../member/entities/member';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { Item } from '../../entities/Item';
import { ItemService } from '../../service';
import { create, deleteOne } from './schemas';
import { ItemVisibilityService } from './service';

/**
 * Item Visibility plugin
 * Dynamic visibility behavior for simple cases
 * - public:
 * - hidden
 *
 * The feature should be stackable and be inherited (a parent public and an item public is allowed)
 * The visibility can be copied alongside the item
 */

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { db } = fastify;

  const itemService = resolveDependency(ItemService);
  const itemVisibilityService = resolveDependency(ItemVisibilityService);

  // TODO: where should we define this???
  // TODO: STRING
  // copy tags alongside item
  // TODO: AUTOMATIZE WITH OWN CLASS
  const hook = async (actor, repositories, { original, copy }: { original: Item; copy: Item }) => {
    await repositories.itemVisibilityRepository.copyAll(actor, original, copy, [
      ItemVisibilityType.Public,
    ]);
  };
  itemService.hooks.setPostHook('copy', hook);

  fastify.post(
    '/:itemId/visibility/:type',
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
    '/:itemId/visibility/:type',
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
