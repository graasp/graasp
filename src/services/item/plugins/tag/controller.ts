import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils';
import { buildRepositories } from '../../../../utils/repositories';
import { optionalIsAuthenticated } from '../../../auth/plugins/passport';
import { getTagsForItem } from './schemas';
import { ItemTagService } from './service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { db } = fastify;

  const itemToTagService = resolveDependency(ItemTagService);

  fastify.get(
    '/:itemId/tags',
    { schema: getTagsForItem, preHandler: optionalIsAuthenticated },
    async ({ user, params: { itemId } }) => {
      return await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);

        return await itemToTagService.getForItem(user?.account, repositories, itemId);
      });
    },
  );
};

export default plugin;
