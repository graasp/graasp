import { FastifyPluginAsync } from 'fastify';

import { resolveDependency } from '../../../../di/utils';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated, optionalIsAuthenticated } from '../../../auth/plugins/passport';
import common, { create, deleteOne, getCategories, getItemCategories } from './schemas';
import { CategoryService } from './services/category';
import { ItemCategoryService } from './services/itemCategory';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db } = fastify;
  const itemCategoryService = resolveDependency(ItemCategoryService);
  const categoryService = resolveDependency(CategoryService);

  // schemas
  fastify.addSchema(common);

  // get categories
  fastify.get<{ Params: { categoryId: string } }>(
    '/categories',
    { schema: getCategories, preHandler: optionalIsAuthenticated },
    async ({ user }) => {
      return categoryService.getAll(user?.member, buildRepositories());
    },
  );

  //get item category of an item
  fastify.get<{ Params: { itemId: string } }>(
    '/:itemId/categories',
    {
      schema: getItemCategories,

      preHandler: optionalIsAuthenticated,
    },
    async ({ user, params: { itemId } }) => {
      return itemCategoryService.getForItem(user?.member, buildRepositories(), itemId);
    },
  );

  // insert item category
  fastify.post<{ Params: { itemId: string }; Body: { categoryId: string } }>(
    '/:itemId/categories',
    { schema: create, preHandler: isAuthenticated },
    async ({ user, params: { itemId }, body: { categoryId } }) => {
      return db.transaction(async (manager) => {
        return itemCategoryService.post(
          user?.member,
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
    { schema: deleteOne, preHandler: isAuthenticated },
    async ({ user, params: { itemCategoryId, itemId } }) => {
      return db.transaction(async (manager) => {
        return itemCategoryService.delete(
          user?.member,
          buildRepositories(manager),
          itemId,
          itemCategoryId,
        );
      });
    },
  );
};

export default plugin;
