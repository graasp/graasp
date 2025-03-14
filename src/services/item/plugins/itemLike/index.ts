import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { ActionTriggers } from '@graasp/sdk';

import { resolveDependency } from '../../../../di/utils.js';
import { db } from '../../../../drizzle/db.js';
import { asDefined } from '../../../../utils/assertions.js';
import { ActionService } from '../../../action/action.service.js';
import {
  isAuthenticated,
  matchOne,
  optionalIsAuthenticated,
} from '../../../auth/plugins/passport/index.js';
import { assertIsMember } from '../../../authentication.js';
import { memberAccountRole } from '../../../member/strategies/memberAccountRole.js';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole.js';
import { BasicItemService } from '../../basic.service.js';
import { create, deleteOne, getLikesForCurrentMember, getLikesForItem } from './schemas.js';
import { ItemLikeService } from './service.js';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const basicItemService = resolveDependency(BasicItemService);
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
      return itemLikeService.getForMember(db, member);
    },
  );

  // get likes
  // TODO: anonymize private members
  fastify.get(
    '/:itemId/likes',
    { schema: getLikesForItem, preHandler: optionalIsAuthenticated },
    async ({ user, params: { itemId } }) => {
      return itemLikeService.getForItem(db, user?.account, itemId);
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
      db.transaction(async (tx) => {
        await itemLikeService.post(tx, member, itemId);
        // action like item
        const item = await basicItemService.get(tx, member, itemId);
        const action = {
          item,
          type: ActionTriggers.ItemLike,
          extra: {
            itemId: item.id,
          },
        };
        await actionService.postMany(tx, member, request, [action]);
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
        const item = await basicItemService.get(tx, member, itemId);

        const action = {
          item,
          type: ActionTriggers.ItemUnlike,
          extra: {
            itemId: item.id,
          },
        };
        await actionService.postMany(tx, member, request, [action]);
        return newItemLike.id;
      });
    },
  );
};

export default plugin;
