import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { ActionTriggers } from '@graasp/sdk';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { asDefined } from '../../../../utils/assertions';
import { buildRepositories } from '../../../../utils/repositories';
import { ActionService } from '../../../action/services/action.service';
import { isAuthenticated, optionalIsAuthenticated } from '../../../auth/plugins/passport';
import { matchOne } from '../../../authorization';
import { assertIsMember } from '../../../member/entities/member';
import { memberAccountRole } from '../../../member/strategies/memberAccountRole';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { ItemService } from '../../service';
import { create, deleteOne, getLikesForCurrentMember, getLikesForItem } from './schemas';
import { ItemLikeService } from './service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { db: typeormDB } = fastify;

  const itemService = resolveDependency(ItemService);
  const itemLikeService = resolveDependency(ItemLikeService);
  const actionService = resolveDependency(ActionService);

  //get liked entry for member
  // BUG: hide item you dont have membership (you liked then lose membership)
  fastify.get(
    '/liked',
    {
      schema: getLikesForCurrentMember,
      preHandler: [isAuthenticated, matchOne(memberAccountRole)],
    },
    async ({ user }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      return itemLikeService.getForMember(member, buildRepositories());
    },
  );

  // get likes
  // TODO: anonymize private members
  fastify.get(
    '/:itemId/likes',
    { schema: getLikesForItem, preHandler: optionalIsAuthenticated },
    async ({ user, params: { itemId } }) => {
      return itemLikeService.getForItem(user?.account, buildRepositories(), itemId);
    },
  );

  // create item like entry
  fastify.post(
    '/:itemId/like',
    { schema: create, preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)] },
    async (request) => {
      const {
        user,
        params: { itemId },
      } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);
      return typeormDB.transaction(async (manager) => {
        const newItemLike = await itemLikeService.post(
          db,
          member,
          buildRepositories(manager),
          itemId,
        );
        // action like item
        const item = await itemService.get(member, buildRepositories(manager), itemId);
        const action = {
          item,
          type: ActionTriggers.ItemLike,
          extra: {
            itemId: item.id,
          },
        };
        await actionService.postMany(member, buildRepositories(manager), request, [action]);
        return newItemLike;
      });
    },
  );

  // delete item like entry
  fastify.delete(
    '/:itemId/like',
    { schema: deleteOne, preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)] },
    async (request) => {
      const {
        user,
        params: { itemId },
      } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);

      return db.transaction(async (tx) => {
        const newItemLike = await itemLikeService.removeOne(tx, member, itemId);
        // action unlike item
        const item = await itemService.get(member, buildRepositories(manager), itemId);

        const action = {
          item,
          type: ActionTriggers.ItemUnlike,
          extra: {
            itemId: item.id,
          },
        };
        await actionService.postMany(member, buildRepositories(manager), request, [action]);
        return newItemLike.id;
      });
    },
  );
};

export default plugin;
