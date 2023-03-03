import { FastifyPluginAsync } from 'fastify';

import { buildRepositories } from '../../util/repositories';
import common, { create, deleteOne, getLikeCount, getLikedItems } from './schemas/schemas';
import { ItemLikeService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db } = fastify;

  const itemLikeService = new ItemLikeService();

  fastify.addSchema(common);
  //get items of liked items
  fastify.get<{ Params: { memberId: string } }>(
    '/:memberId/liked',
    { schema: getLikedItems, preHandler: fastify.verifyAuthentication },
    async ({ member, params: { memberId }, log }) => {
      return itemLikeService.getItemsForMember(member, buildRepositories(), memberId);
    },
  );

  // get likes
  // TODO: anonymize private members
  fastify.get<{ Params: { itemId: string } }>(
    '/:itemId/likes',
    { schema: getLikeCount, preHandler: fastify.fetchMemberInSession },
    async ({ member, params: { itemId }, log }) => {
      return itemLikeService.getForItem(member, buildRepositories(), itemId);
    },
  );

  // create item like entry
  fastify.post<{ Params: { itemId: string } }>(
    '/:itemId/like',
    { schema: create, preHandler: fastify.verifyAuthentication },
    async ({ member, params: { itemId }, log }) => {
      return db.transaction(async (manager) => {
        return itemLikeService.post(member, buildRepositories(manager), itemId);
      });
    },
  );

  // delete item like entry
  fastify.delete<{ Params: { itemId: string } }>(
    '/:itemId/like',
    { schema: deleteOne, preHandler: fastify.verifyAuthentication},
    async ({ member, params: { itemId }, log }) => {
      return db.transaction(async (manager) => {
        return itemLikeService.removeOne(member, buildRepositories(manager), itemId);
      });
    },
  );
};

export default plugin;
