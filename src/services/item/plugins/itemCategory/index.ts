import { FastifyPluginAsync } from 'fastify';

import { buildRepositories } from '../../../../utils/repositories';
import { authenticated, optionalAuthenticated } from '../../../auth/plugins/passport';
import common, { create, deleteOne, getCategories, getItemCategories } from './schemas';
import { CategoryService } from './services/category';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db } = fastify;
  const itemCategoryService = fastify.itemsCategory.service;
  const categoryService = new CategoryService();

  // schemas
  fastify.addSchema(common);

  // get categories
  fastify.get<{ Params: { categoryId: string } }>(
    '/categories',
    { schema: getCategories, preHandler: optionalAuthenticated },
    async ({ user }) => {
      return categoryService.getAll(user?.member, buildRepositories());
    },
  );

  //get item category of an item
  fastify.get<{ Params: { itemId: string } }>(
    '/:itemId/categories',
    {
      schema: getItemCategories,

      preHandler: optionalAuthenticated,
    },
    async ({ user, params: { itemId } }) => {
      return itemCategoryService.getForItem(user?.member, buildRepositories(), itemId);
    },
  );

  // insert item category
  fastify.post<{ Params: { itemId: string }; Body: { categoryId: string } }>(
    '/:itemId/categories',
    { schema: create, preHandler: authenticated },
    async ({ user, params: { itemId }, body: { categoryId } }) => {
      return db.transaction(async (manager) => {
        return itemCategoryService.post(
          user!.member,
          buildRepositories(manager),
          itemId,
          categoryId,
        );
      });
    },
  );

  // delete item category entry
  fastify.delete<{ Params: { itemCategoryId: string; itemId: string } }>(
    '/:itemId/categories/:itemCategoryId',
    { schema: deleteOne, preHandler: authenticated },
    async ({ user, params: { itemCategoryId, itemId } }) => {
      return db.transaction(async (manager) => {
        return itemCategoryService.delete(
          user!.member,
          buildRepositories(manager),
          itemId,
          itemCategoryId,
        );
      });
    },
  );
};

export default plugin;
