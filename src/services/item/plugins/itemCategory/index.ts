import { FastifyPluginAsync } from 'fastify';

import { buildRepositories } from '../../../../utils/repositories';
import common, {
  create,
  deleteOne,
  getByCategories,
  getCategories,
  getCategory,
  getCategoryTypes,
  getItemCategories,
} from './schemas';
import { CategoryService } from './services/category';
import { ItemCategoryService } from './services/itemCategory';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db, items } = fastify;
  const itemCategoryService = new ItemCategoryService(items.service);
  const categoryService = new CategoryService();

  // schemas
  fastify.addSchema(common);

  // get categories
  fastify.get<{ Params: { categoryId: string } }>(
    '/categories',
    { schema: getCategories, preHandler: fastify.fetchMemberInSession },
    async ({}) => {
      return categoryService.getAll(null, buildRepositories());
    },
  );

  //get item category of an item
  fastify.get<{ Params: { itemId: string } }>(
    '/:itemId/categories',
    {
      schema: getItemCategories,

      preHandler: fastify.fetchMemberInSession,
    },
    async ({ member, params: { itemId }, log }) => {
      return itemCategoryService.getForItem(member, buildRepositories(), itemId);
    },
  );

  // insert item category
  fastify.post<{ Params: { itemId: string }; Body: { categoryId: string } }>(
    '/:itemId/categories',
    { schema: create, preHandler: fastify.verifyAuthentication },
    async ({ member, params: { itemId }, body: { categoryId }, log }) => {
      return db.transaction(async (manager) => {
        return itemCategoryService.post(member, buildRepositories(manager), itemId, categoryId);
      });
    },
  );

  // delete item category entry
  fastify.delete<{ Params: { itemCategoryId: string; itemId: string } }>(
    '/:itemId/categories/:itemCategoryId',
    { schema: deleteOne, preHandler: fastify.verifyAuthentication },
    async ({ member, params: { itemCategoryId, itemId }, log }) => {
      return db.transaction(async (manager) => {
        return itemCategoryService.delete(
          member,
          buildRepositories(manager),
          itemId,
          itemCategoryId,
        );
      });
    },
  );

};

export default plugin;
