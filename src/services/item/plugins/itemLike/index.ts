import { FastifyPluginAsync } from 'fastify';

import { ActionTriggers } from '@graasp/sdk';

import { buildRepositories } from '../../../../utils/repositories';
import { authenticated, optionalAuthenticated } from '../../../auth/plugins/passport';
import common, { create, deleteOne, getLikesForItem, getLikesForMember } from './schemas';
import { ItemLikeService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db, items } = fastify;

  const itemLikeService = new ItemLikeService(items.service);
  const actionService = fastify.actions.service;
  const itemService = fastify.items.service;

  fastify.addSchema(common);
  //get liked entry for member
  // BUG: hide item you dont have membership (you liked then lose membership)
  fastify.get<{ Querystring: { memberId: string } }>(
    '/liked',
    { schema: getLikesForMember, preHandler: authenticated },
    async ({ user }) => {
      return itemLikeService.getForMember(user!.member, buildRepositories());
    },
  );

  // get likes
  // TODO: anonymize private members
  fastify.get<{ Params: { itemId: string } }>(
    '/:itemId/likes',
    { schema: getLikesForItem, preHandler: optionalAuthenticated },
    async ({ user, params: { itemId } }) => {
      return itemLikeService.getForItem(user?.member, buildRepositories(), itemId);
    },
  );

  // create item like entry
  fastify.post<{ Params: { itemId: string } }>(
    '/:itemId/like',
    { schema: create, preHandler: authenticated },
    async (request) => {
      const {
        user,
        params: { itemId },
      } = request;
      const member = user!.member!;
      return db.transaction(async (manager) => {
        const newItemLike = await itemLikeService.post(member, buildRepositories(manager), itemId);
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
  fastify.delete<{ Params: { itemId: string } }>(
    '/:itemId/like',
    { schema: deleteOne, preHandler: authenticated },
    async (request) => {
      const {
        user,
        params: { itemId },
      } = request;
      const member = user!.member!;
      return db.transaction(async (manager) => {
        const newItemLike = await itemLikeService.removeOne(
          member,
          buildRepositories(manager),
          itemId,
        );
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
        return newItemLike;
      });
    },
  );
};

export default plugin;
