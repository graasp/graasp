import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { ItemTagType } from '@graasp/sdk';

import { IdParam, IdsParams } from '../../../../types';
import { buildRepositories } from '../../../../utils/repositories';
import { Item } from '../../entities/Item';
import common, { create, deleteOne, getItemTags, getMany } from './schemas';
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

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db, items } = fastify;

  const iTS = new ItemTagService(items.service);

  // schemas
  fastify.addSchema(common);

  // TODO: where should we define this???
  // TODO: STRING
  // copy tags alongside item
  // TODO: AUTOMATIZE WITH OWN CLASS
  const hook = async (actor, repositories, { original, copy }: { original: Item; copy: Item }) => {
    await repositories.itemTagRepository.copyAll(actor, original, copy, [ItemTagType.Public]);
  };
  items.service.hooks.setPostHook('copy', hook);

  // get item tags
  fastify.get<{ Params: { itemId: string } }>(
    '/:itemId/tags',
    { schema: getItemTags, preHandler: fastify.attemptVerifyAuthentication },
    async ({ member, params: { itemId } }) => {
      return iTS.getForItem(member, buildRepositories(), itemId);
    },
  );

  // get item tags for many items
  fastify.get<{ Querystring: IdsParams }>(
    '/tags',
    { schema: getMany, preHandler: fastify.attemptVerifyAuthentication },
    async ({ member, query: { id: ids } }) => {
      return iTS.getForManyItems(member, buildRepositories(), ids);
    },
  );

  fastify.post<{ Params: { itemId: string; type: ItemTagType } }>(
    '/:itemId/tags/:type',
    { schema: create, preHandler: fastify.verifyAuthentication },
    async ({ member, params: { itemId, type } }) => {
      return db.transaction(async (manager) => {
        return iTS.post(member, buildRepositories(manager), itemId, type);
      });
    },
  );

  // delete item tag
  fastify.delete<{ Params: { itemId: string; type: ItemTagType } & IdParam }>(
    '/:itemId/tags/:type',
    { schema: deleteOne, preHandler: fastify.verifyAuthentication },
    async ({ member, params: { itemId, type } }, reply) => {
      await db.transaction(async (manager) => {
        await iTS.deleteOne(member, buildRepositories(manager), itemId, type);
        reply.status(StatusCodes.NO_CONTENT);
      });
    },
  );
};

export default plugin;
