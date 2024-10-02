import { FastifyPluginAsync } from 'fastify';

import { resolveDependency } from '../../../../di/utils';
import { asDefined } from '../../../../utils/assertions';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated, optionalIsAuthenticated } from '../../../auth/plugins/passport';
import { matchOne } from '../../../authorization';
import { assertIsMember } from '../../../member/entities/member';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { create, deleteOne, getCategories, getItemCategories } from './schemas';
import { CategoryService } from './services/category';
import { ItemCategoryService } from './services/itemCategory';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db } = fastify;
  const itemCategoryService = resolveDependency(ItemCategoryService);
  const categoryService = resolveDependency(CategoryService);

  // get categories
  fastify.get<{ Params: { categoryId: string } }>(
    '/categories',
    { schema: getCategories, preHandler: optionalIsAuthenticated },
    async ({ user }) => {
      return categoryService.getAll(user?.account, buildRepositories());
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
      return itemCategoryService.getForItem(user?.account, buildRepositories(), itemId);
    },
  );

  // insert item category
  fastify.post<{ Params: { itemId: string }; Body: { categoryId: string } }>(
    '/:itemId/categories',
    { schema: create, preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)] },
    async ({ user, params: { itemId }, body: { categoryId } }) => {
      return db.transaction(async (manager) => {
        const member = asDefined(user?.account);
        assertIsMember(member);
        return itemCategoryService.post(member, buildRepositories(manager), itemId, categoryId);
      });
    },
  );

  // delete item category entry
  fastify.delete<{ Params: { itemCategoryId: string; itemId: string } }>(
    '/:itemId/categories/:itemCategoryId',
    { schema: deleteOne, preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)] },
    async ({ user, params: { itemCategoryId, itemId } }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      return db.transaction(async (manager) => {
        const { id: deletedId } = await itemCategoryService.delete(
          member,
          buildRepositories(manager),
          itemId,
          itemCategoryId,
        );

        return deletedId;
      });
    },
  );
};

export default plugin;
