import { FastifyPluginAsync } from 'fastify';

import { ItemTagType } from '@graasp/sdk';

import { IdParam, IdsParams } from '../../../../types';
import { buildRepositories } from '../../../../utils/repositories';
import { authenticated, optionalAuthenticated } from '../../../auth/plugins/passport';
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
    { schema: getItemTags, preHandler: optionalAuthenticated },
    async ({ user, params: { itemId } }) => {
      return iTS.getForItem(user?.member, buildRepositories(), itemId);
    },
  );

  // get item tags for many items
  fastify.get<{ Querystring: IdsParams }>(
    '/tags',
    { schema: getMany, preHandler: optionalAuthenticated },
    async ({ user, query: { id: ids } }) => {
      return iTS.getForManyItems(user?.member, buildRepositories(), ids);
    },
  );

  fastify.post<{ Params: { itemId: string; type: ItemTagType } }>(
    '/:itemId/tags/:type',
    { schema: create, preHandler: authenticated },
    async ({ user, params: { itemId, type } }) => {
      return db.transaction(async (manager) => {
        return iTS.post(user!.member, buildRepositories(manager), itemId, type);
      });
    },
  );

  // delete item tag
  fastify.delete<{ Params: { itemId: string; type: ItemTagType } & IdParam }>(
    '/:itemId/tags/:type',
    { schema: deleteOne, preHandler: authenticated },
    async ({ user, params: { itemId, type } }) => {
      return db.transaction(async (manager) => {
        return iTS.deleteOne(user!.member, buildRepositories(manager), itemId, type);
      });
    },
  );
};

export default plugin;
