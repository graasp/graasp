import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { ItemTagType } from '@graasp/sdk';

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
import { ItemTagService } from './service';

/**
 * Item tag plugin
 * Dynamic tag behavior for simple cases
 * - public:
 * - hidden
 *
 * The feature should be stackable and be inherited (a parent public and an item public is allowed)
 * The tag can be copied alongside the item
 */

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { db } = fastify;

  const itemService = resolveDependency(ItemService);
  const itemTagService = resolveDependency(ItemTagService);

  // TODO: where should we define this???
  // TODO: STRING
  // copy tags alongside item
  // TODO: AUTOMATIZE WITH OWN CLASS
  const hook = async (actor, repositories, { original, copy }: { original: Item; copy: Item }) => {
    await repositories.itemTagRepository.copyAll(actor, original, copy, [ItemTagType.Public]);
  };
  itemService.hooks.setPostHook('copy', hook);

  fastify.post(
    '/:itemId/tags/:type',
    { schema: create, preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)] },
    async ({ user, params: { itemId, type } }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      return db.transaction(async (manager) => {
        return itemTagService.post(member, buildRepositories(manager), itemId, type);
      });
    },
  );

  // delete item tag
  fastify.delete(
    '/:itemId/tags/:type',
    { schema: deleteOne, preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)] },
    async ({ user, params: { itemId, type } }) => {
      return db.transaction(async (manager) => {
        const member = asDefined(user?.account);
        assertIsMember(member);
        return itemTagService.deleteOne(member, buildRepositories(manager), itemId, type);
      });
    },
  );
};

export default plugin;
