import { FastifyPluginAsync } from 'fastify';

import { buildRepositories } from '../../../../utils/repositories';
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
    { schema: getLikesForMember, preHandler: fastify.verifyAuthentication },
    async ({ member, log }) => {
      return itemLikeService.getForMember(member, buildRepositories());
    },
  );

  // get likes
  // TODO: anonymize private members
  fastify.get<{ Params: { itemId: string } }>(
    '/:itemId/likes',
    { schema: getLikesForItem, preHandler: fastify.attemptVerifyAuthentication },
    async ({ member, params: { itemId }, log }) => {
      return itemLikeService.getForItem(member, buildRepositories(), itemId);
    },
  );

  // create item like entry
  fastify.post<{ Params: { itemId: string } }>(
    '/:itemId/like',
    { schema: create, preHandler: fastify.verifyAuthentication },
    async (request) => {
      const {
        member,
        params: { itemId },
      } = request;
      return db.transaction(async (manager) => {
        // action like item
        const item = await itemService.get(member, buildRepositories(manager), itemId);
        // TODO: chnage type from graasp/sdk
        const action = {
          item,
          type: 'item-like',
          extra: {},
        };

        await actionService.postMany(member, buildRepositories(manager), request, [action]);
        return itemLikeService.post(member, buildRepositories(manager), itemId);
      });
    },
  );

  // delete item like entry
  fastify.delete<{ Params: { itemId: string } }>(
    '/:itemId/like',
    { schema: deleteOne, preHandler: fastify.verifyAuthentication },
    async (request) => {
      const {
        member,
        params: { itemId },
      } = request;
      return db.transaction(async (manager) => {
        // action unlike item
        const item = await itemService.get(member, buildRepositories(manager), itemId);

        // TODO: chnage type from graasp/sdk
        const action = {
          item,
          type: 'item-unlike',
          extra: {},
        };

        await actionService.postMany(member, buildRepositories(manager), request, [action]);
        return itemLikeService.removeOne(member, buildRepositories(manager), itemId);
      });
    },
  );
};

export default plugin;
