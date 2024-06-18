import { FastifyPluginAsync } from 'fastify';

import { ItemTagType } from '@graasp/sdk';

import { IdParam, IdsParams } from '../../../../types.js';
import { buildRepositories } from '../../../../utils/repositories.js';
import { isAuthenticated, optionalIsAuthenticated } from '../../../auth/plugins/passport/index.js';
import { Item } from '../../entities/Item.js';
import common, { create, deleteOne, getItemTags, getMany } from './schemas.js';
import { ItemTagService } from './service.js';

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
    { schema: getItemTags, preHandler: optionalIsAuthenticated },
    async ({ user, params: { itemId } }) => {
      return iTS.getForItem(user?.member, buildRepositories(), itemId);
    },
  );

  // get item tags for many items
  fastify.get<{ Querystring: IdsParams }>(
    '/tags',
    { schema: getMany, preHandler: optionalIsAuthenticated },
    async ({ user, query: { id: ids } }) => {
      return iTS.getForManyItems(user?.member, buildRepositories(), ids);
    },
  );

  fastify.post<{ Params: { itemId: string; type: ItemTagType } }>(
    '/:itemId/tags/:type',
    { schema: create, preHandler: isAuthenticated },
    async ({ user, params: { itemId, type } }) => {
      return db.transaction(async (manager) => {
        return iTS.post(user?.member, buildRepositories(manager), itemId, type);
      });
    },
  );

  // delete item tag
  fastify.delete<{ Params: { itemId: string; type: ItemTagType } & IdParam }>(
    '/:itemId/tags/:type',
    { schema: deleteOne, preHandler: isAuthenticated },
    async ({ user, params: { itemId, type } }) => {
      return db.transaction(async (manager) => {
        return iTS.deleteOne(user?.member, buildRepositories(manager), itemId, type);
      });
    },
  );
};

export default plugin;
