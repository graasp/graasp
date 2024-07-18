import { FastifyPluginAsync } from 'fastify';

import { ItemTagType } from '@graasp/sdk';

import { resolveDependency } from '../../../../di/utils';
import { IdParam, IdsParams } from '../../../../types';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated, optionalIsAuthenticated } from '../../../auth/plugins/passport';
import { matchOne } from '../../../authorization';
import { validatedMember } from '../../../member/strategies/validatedMember';
import { Item } from '../../entities/Item';
import { ItemService } from '../../service';
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
  const { db } = fastify;

  const itemService = resolveDependency(ItemService);
  const itemTagService = resolveDependency(ItemTagService);

  // schemas
  fastify.addSchema(common);

  // TODO: where should we define this???
  // TODO: STRING
  // copy tags alongside item
  // TODO: AUTOMATIZE WITH OWN CLASS
  const hook = async (actor, repositories, { original, copy }: { original: Item; copy: Item }) => {
    await repositories.itemTagRepository.copyAll(actor, original, copy, [ItemTagType.Public]);
  };
  itemService.hooks.setPostHook('copy', hook);

  // get item tags
  fastify.get<{ Params: { itemId: string } }>(
    '/:itemId/tags',
    { schema: getItemTags, preHandler: optionalIsAuthenticated },
    async ({ user, params: { itemId } }) => {
      return itemTagService.getForItem(user?.member, buildRepositories(), itemId);
    },
  );

  // get item tags for many items
  fastify.get<{ Querystring: IdsParams }>(
    '/tags',
    { schema: getMany, preHandler: optionalIsAuthenticated },
    async ({ user, query: { id: ids } }) => {
      return itemTagService.getForManyItems(user?.member, buildRepositories(), ids);
    },
  );

  fastify.post<{ Params: { itemId: string; type: ItemTagType } }>(
    '/:itemId/tags/:type',
    { schema: create, preHandler: [isAuthenticated, matchOne(validatedMember)] },
    async ({ user, params: { itemId, type } }) => {
      return db.transaction(async (manager) => {
        return itemTagService.post(user?.member, buildRepositories(manager), itemId, type);
      });
    },
  );

  // delete item tag
  fastify.delete<{ Params: { itemId: string; type: ItemTagType } & IdParam }>(
    '/:itemId/tags/:type',
    { schema: deleteOne, preHandler: [isAuthenticated, matchOne(validatedMember)] },
    async ({ user, params: { itemId, type } }) => {
      return db.transaction(async (manager) => {
        return itemTagService.deleteOne(user?.member, buildRepositories(manager), itemId, type);
      });
    },
  );
};

export default plugin;
